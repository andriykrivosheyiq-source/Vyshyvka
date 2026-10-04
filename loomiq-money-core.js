/* ══════════ ГРОШОВЕ ЯДРО (04.10) ══════════

   Андрій: «закласти в основну логіку, щоб платежі ніяк ніде нікуди не
   утікали, щоб ми на рівному місці не втрачали кошти».

   ЦЕЙ ФАЙЛ — ЄДИНЕ МІСЦЕ, ДЕ РАХУЄТЬСЯ «СКІЛЬКИ СПЛАЧЕНО».
   Картка B2B, картка B2C, сума контролю оплати в ТТН, аналітика й Звірка —
   усі питають тут. Доти в B2B і B2C було два різні «оплачено»: наложка,
   яка сама привʼязалась у Фінансах, у картці B2B не рахувалась, і картка
   показувала борг за вже отримані гроші.

   ПРАВИЛА (їх стереже tests/money-core.mjs; хук перед комітом не пустить
   зміну, яка їх ламає):
     1. Банківський рух (payments/<id>) рахується в замовленні, до якого він
        привʼязаний (orderId), — і лише там. Один рух — одне замовлення.
     2. Запис оплати в картці (o.payments) із payId — лише копія банківського
        руху. Коли рух завантажено, правда — сам рух: відвʼязали чи
        перенесли в інше замовлення — копія не рахується (і Звірка про неї
        каже). Коли руху в завантаженому вікні немає (старший за пів року),
        рахується копія — щоб давні оплати не перетворились на борг.
     3. Запис руками без payId (готівка, переказ, якого банк не бачить)
        рахується як є.
     4. Нічого не зникає мовчки: усе, що не сходиться, — пункт Звірки.

   Чисті функції: ні бази, ні сторінки. Тому їх можна перевіряти тестом
   за пів секунди. */
(function(root){
  'use strict';

  /* Звідки беруться банківські рухи. Їх пише лише грошовий воркер; адмінка
     їх не створює, не видаляє й суму не править (так само в firestore.rules). */
  var BANK_SRC = ['mono', 'privat', 'np'];
  /* Після отримання посилки з контролем оплати — стільки днів чекаємо гроші,
     далі Звірка бʼє тривогу (Андрій: «2 дні звичайні»). */
  var COD_DAYS = 2;
  /* Коди Нової пошти: забрали — гроші мають бути; відмова й повернення —
     грошей не буде, треба стежити за товаром. */
  var NP_GOT = ['9', '10', '11', '106'];
  var NP_BACK = ['102', '103', '105', '108'];
  var DAY = 864e5;

  function id(v){ return String(v == null ? '' : v).trim(); }
  function ttnOf(v){ return String(v || '').replace(/\D/g, ''); }
  function r(n){ return Math.round(+n || 0); }
  function isBank(p){ return !!p && BANK_SRC.indexOf(String(p.src || '')) >= 0; }
  function грн(n){ return String(r(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴'; }
  function time(s){ var t = Date.parse(s || ''); return isNaN(t) ? 0 : t; }

  /* Усі ТТН замовлення: поточна і ті, що були замінені (o.ttnHist). Гроші за
     стару накладну з контролем оплати інакше нікуди б не привʼязались. */
  function ttnsOf(o){
    var out = [];
    var t = ttnOf(o && o.ttn); if(t) out.push(t);
    ((o && o.ttnHist) || []).forEach(function(h){ var x = ttnOf(h && h.ttn); if(x && out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  /* СКІЛЬКИ СПЛАЧЕНО.
     pays — усі завантажені рухи Фінансів, або null, коли їх ще не
     завантажили (тоді рахуємо лише записи картки — як було). */
  function paid(o, pays){
    var oid = id(o && o.orderId);
    var rows = [];
    var map = null;
    if(Array.isArray(pays)){
      map = {};
      pays.forEach(function(p){ if(p && p.id) map[p.id] = p; });
    }
    var bySel = {};
    ((o && o.payments) || []).forEach(function(e, i){
      if(!e) return;
      var s = r(e.sum);
      if(e.payId && map){
        var p = map[e.payId];
        if(p){
          if(id(p.orderId) === oid && oid) bySel[e.payId] = i;   // рахуємо нижче, із самого руху
          else rows.push({ src:'stale', idx:i, payId:e.payId, sum:s, at:e.at, kind:e.kind, counted:false,
                           elsewhere: id(p.orderId) });
          return;
        }
      }
      rows.push({ src: e.payId ? 'cache' : 'hand', idx:i, payId:e.payId || '', sum:s, at:e.at,
                  kind:e.kind, by:e.by, acc:e.acc, counter:e.counter, counted:true });
    });
    if(map && oid){
      pays.forEach(function(p){
        if(!p || id(p.orderId) !== oid) return;
        var s = r(p.amount);
        if(s <= 0) return;   // витрата, привʼязана до замовлення, — не оплата клієнта
        rows.push({ src:'bank', idx: bySel[p.id] == null ? -1 : bySel[p.id], payId:p.id, sum:s, at:p.at,
                    kind: p.tag === 'cod' ? 'cod' : (p.tag || 'prepay'), acc:p.acc, counter:p.counter,
                    ttn: p.ttn || '', counted:true });
      });
    }
    rows.sort(function(a, b){ return String(a.at || '').localeCompare(String(b.at || '')); });
    var sum = rows.reduce(function(a, x){ return a + (x.counted ? x.sum : 0); }, 0);
    return { sum: sum, rows: rows };
  }
  function due(o, pays, total){
    var t = total == null ? (+(o && o.totalPrice) || 0) : (+total || 0);
    return Math.max(0, r(t - paid(o, pays).sum));
  }
  function state(o, pays, total){
    var t = total == null ? (+(o && o.totalPrice) || 0) : (+total || 0);
    var s = paid(o, pays).sum;
    if(s <= 0) return 'none';
    return (s + 0.5 >= t && t > 0) ? 'full' : 'part';
  }

  /* ЧИ МОЖНА ПРИВʼЯЗАТИ рух до замовлення. Привʼязаний рух не перекидається
     в інше замовлення мовчки — тільки свідомим «перенести» (move). */
  function linkCheck(p, orderId, opt){
    if(!p || !p.id) return 'Платежу немає';
    var cur = id(p.orderId), to = id(orderId);
    if(to && cur && cur !== to && !(opt && opt.move))
      return 'Цей платіж уже привʼязаний до #' + cur + '. Спершу відвʼяжіть його там.';
    if(to && p.tag === 'own') return 'Це переказ між своїми рахунками — до замовлення його не привʼязують.';
    return '';
  }

  /* Сума контролю оплати для нової ТТН — рівно залишок; більше не можна. */
  function codFor(o, pays, total){ return due(o, pays, total); }

  /* ══════════ ЗВІРКА ══════════
     Усе, де гроші можуть загубитись з поля зору. Кожен пункт:
       { kind, sev:'red'|'amber', orderId, payId, ttn, sum, text, fix }
     opt: { now, np: { <ttn>: {code, status, at} }, totalOf(o), accs:[{id,bank}],
            ordersLoaded:true } */
  function audit(orders, pays, opt){
    opt = opt || {};
    var now = opt.now || Date.now();
    var np = opt.np || {};
    var totalOf = opt.totalOf || function(o){ return +o.totalPrice || 0; };
    var out = [];
    var ordersById = {}, byTtn = {};
    (orders || []).forEach(function(o){
      if(!o || !o.orderId) return;
      ordersById[id(o.orderId)] = o;
      ttnsOf(o).forEach(function(t){ byTtn[t] = o; });
    });
    pays = Array.isArray(pays) ? pays : [];
    var payMap = {};
    pays.forEach(function(p){ if(p && p.id) payMap[p.id] = p; });
    var bankAcc = {};
    (opt.accs || []).forEach(function(a){ if(a && a.id) bankAcc[a.id] = a.bank || ''; });
    var дн = function(ms){ return Math.floor(ms / DAY); };
    var дата = function(t){ var d = new Date(t); return isNaN(d) ? '' :
      ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2); };

    (orders || []).forEach(function(o){
      if(!o || !o.orderId || o.status === 'cancel') return;
      var oid = id(o.orderId);
      var total = r(totalOf(o));
      var pd = paid(o, pays);
      var лишилось = Math.max(0, total - pd.sum);

      /* Контроль оплати: посилку забрали, а грошей у замовленні немає. */
      ttnsOf(o).forEach(function(t, i){
        var cod = i === 0 ? r(o.ttnCod) : r(((o.ttnHist || []).filter(function(h){ return ttnOf(h.ttn) === t; })[0] || {}).cod);
        if(cod <= 0) return;
        var гроші = pays.some(function(p){ return ttnOf(p.ttn) === t && r(p.amount) > 0 && id(p.orderId) === oid; });
        var st = np[t] || null;
        var code = st ? String(st.code || '') : '';
        var коли = st ? time(st.at) : 0;
        if(!st && i === 0 && /отриман/i.test(String(o.ttnStatus || ''))){ code = '9'; коли = time(o.ttnStatusAt); }
        if(гроші) return;
        if(NP_GOT.indexOf(code) >= 0 && коли && now - коли >= COD_DAYS * DAY){
          var вільні = pays.filter(function(p){ return ttnOf(p.ttn) === t && r(p.amount) > 0 && !id(p.orderId); })[0];
          out.push({ kind:'cod_late', sev:'red', orderId:oid, ttn:t, sum:cod, payId: вільні ? вільні.id : '',
            fix: вільні ? 'link' : '',
            text: 'Посилку ТТН ' + t + ' забрали ' + дата(коли) + ', контроль оплати ' + грн(cod) + ' — ' +
              (вільні ? 'гроші прийшли, але до замовлення не привʼязані'
                      : 'грошей немає вже ' + дн(now - коли) + ' дн.') });
        } else if(NP_BACK.indexOf(code) >= 0){
          out.push({ kind:'cod_back', sev:'amber', orderId:oid, ttn:t, sum:cod,
            text: 'ТТН ' + t + ': ' + (st.status || 'відмова / повернення') + ' — контролю оплати ' + грн(cod) +
              ' не буде. Перевірте, що товар повернувся.' });
        }
      });

      /* Контроль оплати більший за те, що лишилось: клієнт переплатить. */
      var t0 = ttnOf(o.ttn);
      if(t0 && r(o.ttnCod) > 0 && !(np[t0] && (NP_GOT.concat(NP_BACK)).indexOf(String(np[t0].code)) >= 0)){
        var свій = pays.some(function(p){ return ttnOf(p.ttn) === t0 && id(p.orderId) === oid && r(p.amount) > 0; });
        if(!свій && total > 0 && r(o.ttnCod) > лишилось + 1)
          out.push({ kind:'cod_over', sev:'red', orderId:oid, ttn:t0, sum:r(o.ttnCod) - лишилось,
            text: 'Контроль оплати ТТН ' + t0 + ' — ' + грн(r(o.ttnCod)) + ', а лишилось сплатити ' + грн(лишилось) +
              '. Клієнт переплатить ' + грн(r(o.ttnCod) - лишилось) + ' — змініть суму в кабінеті НП.' });
      }

      if(total > 0 && pd.sum > total + 1)
        out.push({ kind:'overpay', sev:'amber', orderId:oid, sum:pd.sum - total,
          text: 'Переплата ' + грн(pd.sum - total) + ': сплачено ' + грн(pd.sum) + ' при сумі ' + грн(total) + '.' });

      pd.rows.forEach(function(x){
        if(x.src === 'stale')
          out.push({ kind:'stale', sev:'red', orderId:oid, payId:x.payId, sum:x.sum,
            text: 'У картці записано оплату ' + грн(x.sum) + ' з банку, а у Фінансах цей платіж ' +
              (x.elsewhere ? 'привʼязаний до #' + x.elsewhere : 'відвʼязаний') + '. Її не рахуємо.' });
      });
      /* Те саме двічі: записали руками, а потім прийшло з банку. */
      var руками = pd.rows.filter(function(x){ return x.src === 'hand' && x.sum > 0; });
      var банк = pd.rows.filter(function(x){ return x.src === 'bank'; });
      руками.forEach(function(h){
        var пара = банк.filter(function(b){ return b.sum === h.sum && Math.abs(time(b.at) - time(h.at)) <= 7 * DAY; })[0];
        if(пара) out.push({ kind:'dup', sev:'amber', orderId:oid, payId:пара.payId, sum:h.sum, idx:h.idx,
          text: 'Можливий дубль: ' + грн(h.sum) + ' записано руками і такий самий платіж прийшов з банку. Якщо це одні гроші — приберіть запис руками.' });
      });
    });

    pays.forEach(function(p){
      if(!p || !p.id) return;
      var s = r(p.amount);
      /* Привʼязаний до замовлення, якого немає. */
      if(opt.ordersLoaded !== false && id(p.orderId) && !ordersById[id(p.orderId)] && s > 0)
        out.push({ kind:'lost_order', sev:'red', payId:p.id, orderId:id(p.orderId), sum:s, fix:'unlink',
          text: 'Платіж ' + грн(s) + ' (' + (p.counter || '—') + ') привʼязаний до #' + id(p.orderId) +
            ', а такого замовлення немає. Відвʼяжіть і привʼяжіть до правильного.' });
      if(id(p.orderId) || s <= 0 || p.tag === 'own' || p.tag === 'notown') return;
      /* Переказ із NovaPay на банк: гроші за наложки вже пораховані на
         NovaPay; не позначений «між своїми» — порахується вдруге. */
      if(bankAcc[p.acc] !== 'np' && /nova\s*pay|нова\s*пей|новапей|нова\s*пошта|nova\s*poshta/i.test((p.counter || '') + ' ' + (p.desc || '')))
        out.push({ kind:'np_in', sev:'amber', payId:p.id, sum:s, fix:'own',
          text: 'Схоже на переказ з NovaPay ' + грн(s) + ' (' + дата(time(p.at)) + '). Позначте «між своїми», щоб не порахувати двічі.' });
    });

    /* Гроші за ТТН, якої в CRM немає, — одним пунктом, бо їх буває сотні
       (накладні, створені в кабінеті НП повз CRM). */
    var сироти = pays.filter(function(p){ return p && ttnOf(p.ttn) && !id(p.orderId) && r(p.amount) > 0 &&
      !byTtn[ttnOf(p.ttn)] && now - time(p.at) >= COD_DAYS * DAY; });
    if(сироти.length)
      out.push({ kind:'cod_orphan', sev:'amber', sum: сироти.reduce(function(a, p){ return a + r(p.amount); }, 0),
        list: сироти.map(function(p){ return p.id; }),
        text: сироти.length + ' надходж. на ' + грн(сироти.reduce(function(a, p){ return a + r(p.amount); }, 0)) + ' за ТТН, яких немає в жодній картці CRM. Привʼяжіть їх у Фінансах або впишіть ТТН у замовлення.' });

    /* «Перевірено, все гаразд» — людина подивилась і закрила пункт
       (товар повернувся, переплату повернули). Позначка живе в самому
       замовленні (o.moneyOk) або в русі (p.auditOk), а не в памʼяті сторінки. */
    out = out.filter(function(x){
      var k = keyOf(x);
      var o = x.orderId ? ordersById[x.orderId] : null;
      if(o && o.moneyOk && o.moneyOk[k]) return false;
      var p = x.payId ? payMap[x.payId] : null;
      if(p && Array.isArray(p.auditOk) && p.auditOk.indexOf(k) >= 0) return false;
      return true;
    });
    var ваги = { red:0, amber:1 };
    out.sort(function(a, b){ return (ваги[a.sev] - ваги[b.sev]) || ((b.sum || 0) - (a.sum || 0)); });
    return out;
  }

  function keyOf(x){ return x.kind + ':' + (x.ttn || x.payId || '') ; }

  var api = { BANK_SRC:BANK_SRC, COD_DAYS:COD_DAYS, NP_GOT:NP_GOT, NP_BACK:NP_BACK,
              paid:paid, due:due, state:state, linkCheck:linkCheck, codFor:codFor, audit:audit,
              ttnsOf:ttnsOf, ttnOf:ttnOf, isBank:isBank, keyOf:keyOf };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LQMoney = api;
})(typeof window !== 'undefined' ? window : this);
