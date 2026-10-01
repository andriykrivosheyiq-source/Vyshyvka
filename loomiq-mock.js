/* ══════════════════════════════════════════════════════════════════════════
   МОКАП: МАКЕТ НА ВИРОБІ, І ЦИФРИ ПІД НИМ

   Що тут відбувається й навіщо.

   Клієнту в Директ іде не сам макет. Файл із логотипом на прозорому тлі не
   каже нічого: великий він чи маленький, високо чи низько, як це виглядає
   на чорному. Іде мокап — той самий логотип, покладений на фото виробу. І
   доти його робили руками в чужій програмі, у вільному масштабі: «на око
   норм». Потім виробництво питало «а скільки сантиметрів», і відповіді не
   було ні в кого.

   Тому тут дві речі одночасно, і друга важливіша за першу:

     1. КАРТИНКА. Макет лягає на фото виробу, його можна посунути й
        розтягнути мишею.

     2. ЦИФРИ. Ширина нанесення в сантиметрах, відступ від горловини й зсув
        від центру. Не «на око» — рахуються з розмірної сітки товару.

   ЯК ПІКСЕЛІ СТАЮТЬ САНТИМЕТРАМИ

   Фото виробу — просто картинка, вона не знає свого масштабу. Тому виріб на
   ній розмічають ОДИН РАЗ: тягнуть смугу по ширині виробу (від шва під
   рукавом до шва) і лінію по горловині. Ці дві мірки лишаються при товарі
   назавжди, і другий дизайнер їх уже не робить.

   Далі арифметика чесна: смуга — це «Ширина» з розмірної сітки, в
   сантиметрах. Скільки в ній пікселів — стільки пікселів у тих
   сантиметрах.

   І головне, заради чого все: ширину беремо ДЛЯ ТОГО РОЗМІРУ, який стоїть у
   складі. Андрій: «взяли Ельку — рахуємо розміщення як на Ельки, взяли
   Еску — як на Есці». Логотип 22 см на дитячій футболці й на XXL — це два
   різні логотипи, хоч файл один. Фото в каталозі одне, тому масштаб на
   екрані ми перераховуємо під потрібний розмір: видно рівно те, що
   отримає замовник.

   Якщо розмірної сітки в товару немає, сантиметрів ми не вигадуємо.
   Мокап зробити можна, цифр під ним не буде, і про це сказано вголос —
   вигадане число тут гірше за його відсутність: за ним шиють.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var HOST = {};          // робоче місце: каталог, розмірна сітка, збереження
  var W = null;           // відкрите вікно

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function img(src){
    return new Promise(function(res){
      if(!src) return res(null);
      var im = new Image();
      /* Без цього canvas стає «зіпсованим» і toDataURL падає з
         SecurityError: фото виробів лежать на чужому домені. */
      im.crossOrigin = 'anonymous';
      im.onload = function(){ res(im); };
      im.onerror = function(){ res(null); };
      im.src = src;
    });
  }
  function num(v){ var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function см(n){ return (Math.round(n * 10) / 10).toString().replace('.', ',') + ' см'; }

  /* ── Розмітка виробу на фото ────────────────────────────────────────────
     Три числа в частках кадру: ліва й права межа виробу та лінія горловини.
     Лежать при ТОВАРІ, а не при замовленні: фото одне на всі замовлення, і
     розмічати його вдруге означає отримати дві різні правди про той самий
     знімок. */
  function calOf(gid){
    var c = null;
    try{ c = HOST.cal && HOST.cal(gid); }catch(e){}
    if(!c || !(c.x2 > c.x1)) return null;
    return { x1: +c.x1, x2: +c.x2, y: +c.y };
  }
  /* Ширина виробу в сантиметрах для потрібного розміру. */
  function widthCm(gid, size){
    try{ return Math.max(0, +(HOST.widthCm && HOST.widthCm(gid, size)) || 0); }
    catch(e){ return 0; }
  }

  /* ══════════ ВІКНО ══════════ */
  function close(){
    if(W && W.el && W.el.parentNode) W.el.parentNode.removeChild(W.el);
    if(W && W.esk) document.removeEventListener('keydown', W.esk, true);
    W = null;
  }

  /* `opt` = { base, art, gid, size, name, box, onDone }
     base — фото виробу, art — файл макета, box — попереднє розміщення. */
  async function open(opt){
    close();
    var base = await img(opt.base);
    var art = await img(opt.art);
    if(!base) return say('Фото виробу не завантажилось — мокап робити нема на чому');
    if(!art) return say('Макет не завантажився');

    var cal = calOf(opt.gid);
    var шир = widthCm(opt.gid, opt.size);
    /* Розмітка ще не зроблена — пропонуємо зробити її зараз, із
       заготовкою по центру кадру. Заготовка — не відповідь, її треба
       підвести під виріб; але вона хоча б показує, що саме тягнути. */
    var маркуємо = !cal;
    if(!cal) cal = { x1:0.22, x2:0.78, y:0.16 };

    var el = document.createElement('div');
    el.className = 'mko-wrap';
    el.innerHTML =
      '<div class="mko-w">' +
        '<div class="mko-h"><b>Мокап · ' + esc(opt.name || 'виріб') + '</b>' +
          '<span class="mko-h-s"></span>' +
          '<button class="mko-x" data-mko-x>×</button></div>' +
        '<div class="mko-body">' +
          '<div class="mko-stage" data-mko-stage>' +
            '<img class="mko-base" alt="">' +
            '<div class="mko-art" data-mko-art><img alt=""><i class="mko-gr" data-mko-grip></i></div>' +
            '<div class="mko-cal" data-mko-cal>' +
              '<i class="mko-cal-v" data-mko-cal-h="x1"></i>' +
              '<i class="mko-cal-v" data-mko-cal-h="x2"></i>' +
              '<i class="mko-cal-y" data-mko-cal-h="y"></i>' +
            '</div>' +
          '</div>' +
          '<div class="mko-side">' +
            '<div class="mko-num" data-mko-nums></div>' +
            '<div class="mko-note" data-mko-note></div>' +
            '<button class="mko-cal-b" data-mko-caltoggle>Розмітити виріб</button>' +
            '<div class="mko-acts">' +
              '<button class="mko-b" data-mko-x>Скасувати</button>' +
              '<button class="mko-b pri" data-mko-save>Зберегти мокап</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    var stage = el.querySelector('[data-mko-stage]');
    var baseEl = el.querySelector('.mko-base');
    var artEl = el.querySelector('[data-mko-art]');
    var artImg = artEl.querySelector('img');
    var calEl = el.querySelector('[data-mko-cal]');
    baseEl.src = opt.base;
    artImg.src = opt.art;

    /* Розміщення тримаємо В ЧАСТКАХ кадру, а не в пікселях екрана: вікно
       міняє розмір, а мокап потім малюється у повній роздільності фото. */
    var box = (opt.box && opt.box.w > 0)
      ? { x:+opt.box.x, y:+opt.box.y, w:+opt.box.w }
      : { x:0.5, y:0.34, w:0.26 };   // по центру грудей — звідки й починають
    var ar = art.height / art.width;

    var режим = маркуємо ? 'cal' : 'art';
    function paint(){
      var r = stage.getBoundingClientRect();
      if(!r.width) return;
      var w = box.w * r.width;
      artEl.style.width = w + 'px';
      artEl.style.height = (w * ar) + 'px';
      artEl.style.left = (box.x * r.width - w / 2) + 'px';
      artEl.style.top = (box.y * r.height) + 'px';
      calEl.style.display = режим === 'cal' ? 'block' : 'none';
      el.querySelector('[data-mko-caltoggle]').textContent =
        режим === 'cal' ? 'Готово, розмітив' : 'Розмітити виріб';
      calEl.querySelector('[data-mko-cal-h="x1"]').style.left = (cal.x1 * 100) + '%';
      calEl.querySelector('[data-mko-cal-h="x2"]').style.left = (cal.x2 * 100) + '%';
      calEl.querySelector('[data-mko-cal-h="y"]').style.top = (cal.y * 100) + '%';
      числа();
    }
    /* ЦИФРИ — ГОЛОВНЕ, ЩО ТУТ Є. Без них це просто картинка «на око». */
    function міри(){
      if(!шир) return null;
      var r = stage.getBoundingClientRect();
      if(!r.width) return null;
      var смуга = (cal.x2 - cal.x1) * r.width;          // виріб, пікселів
      if(смуга <= 0) return null;
      var pxСм = смуга / шир;                            // пікселів у сантиметрі
      var w = box.w * r.width;
      var центр = (cal.x1 + cal.x2) / 2 * r.width;
      return {
        wCm: w / pxСм,
        hCm: w * ar / pxСм,
        topCm: (box.y * r.height - cal.y * r.height) / pxСм,
        sideCm: (box.x * r.width - центр) / pxСм
      };
    }
    function числа(){
      var m = міри();
      var box1 = el.querySelector('[data-mko-nums]');
      var note = el.querySelector('[data-mko-note]');
      if(!m){
        box1.innerHTML = '';
        /* Мовчазний прочерк не відрізнити від нуля, тому кажемо причину й
           що з нею робити. Вигадане число тут гірше за його відсутність:
           за ним шиють. */
        note.innerHTML = шир
          ? 'Розмітьте виріб — без цього фото не знає свого масштабу, і ' +
            'сантиметри рахувати нема з чого.'
          : 'У товару немає розмірної сітки для розміру «' + esc(opt.size || '—') +
            '». Мокап зробити можна, але сантиметрів під ним не буде: ' +
            'вигадувати їх не можна, за ними шиють.';
        return;
      }
      box1.innerHTML =
        '<div class="mko-n"><span>Ширина нанесення</span><b>' + esc(см(m.wCm)) + '</b></div>' +
        '<div class="mko-n"><span>Висота</span><b>' + esc(см(m.hCm)) + '</b></div>' +
        '<div class="mko-n"><span>Від горловини</span><b>' + esc(см(m.topCm)) + '</b></div>' +
        '<div class="mko-n"><span>Від центру</span><b>' +
          esc((m.sideCm >= 0 ? '' : '−') + см(Math.abs(m.sideCm))) + '</b></div>';
      note.innerHTML = 'Рахується під розмір <b>' + esc(opt.size || '—') +
        '</b>: ширина виробу ' + esc(см(шир)) + '. Інший розмір — інші ' +
        'пропорції того самого файлу.';
    }

    /* ── Миша ── */
    function frac(ev){
      var r = stage.getBoundingClientRect();
      return { x: clamp((ev.clientX - r.left) / r.width, 0, 1),
               y: clamp((ev.clientY - r.top) / r.height, 0, 1), r: r };
    }
    var drag = null;
    stage.addEventListener('mousedown', function(ev){
      var h = ev.target.closest && ev.target.closest('[data-mko-cal-h]');
      if(h && режим === 'cal'){ drag = { тип:'cal', ключ:h.getAttribute('data-mko-cal-h') }; }
      else if(ev.target.closest && ev.target.closest('[data-mko-grip]')){
        drag = { тип:'size' };
      } else if(ev.target.closest && ev.target.closest('[data-mko-art]')){
        var f0 = frac(ev);
        drag = { тип:'move', dx: box.x - f0.x, dy: box.y - f0.y };
      } else return;
      ev.preventDefault();
    });
    function move(ev){
      if(!drag) return;
      var f = frac(ev);
      if(drag.тип === 'cal'){
        if(drag.ключ === 'y') cal.y = f.y;
        else if(drag.ключ === 'x1') cal.x1 = Math.min(f.x, cal.x2 - 0.03);
        else cal.x2 = Math.max(f.x, cal.x1 + 0.03);
      } else if(drag.тип === 'move'){
        box.x = clamp(f.x + drag.dx, 0, 1);
        box.y = clamp(f.y + drag.dy, 0, 1);
      } else {
        /* Тягнемо за кут — міняється ширина; висота йде за пропорцією
           файлу. Розтягувати макет непропорційно не можна взагалі: це вже
           не той логотип, який погодив клієнт. */
        box.w = clamp((f.x - (box.x - box.w / 2)) , 0.04, 1);
      }
      paint();
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', function(){ drag = null; });

    el.addEventListener('click', function(ev){
      if(ev.target === el || (ev.target.closest && ev.target.closest('[data-mko-x]'))){
        document.removeEventListener('mousemove', move);
        return close();
      }
      if(ev.target.closest && ev.target.closest('[data-mko-caltoggle]')){
        режим = режим === 'cal' ? 'art' : 'cal';
        if(режим === 'art' && HOST.calSave){
          try{ HOST.calSave(opt.gid, { x1:cal.x1, x2:cal.x2, y:cal.y }); }catch(e){}
        }
        return paint();
      }
      if(ev.target.closest && ev.target.closest('[data-mko-save]')) return зберегти();
    });
    var esk = function(ev){
      if(ev.key !== 'Escape') return;
      document.removeEventListener('mousemove', move);
      close();
    };
    document.addEventListener('keydown', esk, true);
    W = { el: el, esk: esk };

    async function зберегти(){
      var btn = el.querySelector('[data-mko-save]');
      btn.disabled = true; btn.textContent = 'Збираю…';
      try{
        /* Малюємо у ПОВНІЙ роздільності фото, а не в тій, що на екрані:
           мокап іде клієнту й у виробництво, і екранні 600 px там виглядають
           як зіпсована картинка. */
        var cv = document.createElement('canvas');
        cv.width = base.naturalWidth || base.width;
        cv.height = base.naturalHeight || base.height;
        var x = cv.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(base, 0, 0, cv.width, cv.height);
        var w = box.w * cv.width;
        x.drawImage(art, box.x * cv.width - w / 2, box.y * cv.height, w, w * ar);
        var url = cv.toDataURL('image/png');
        var m = міри();
        if(HOST.calSave){
          try{ HOST.calSave(opt.gid, { x1:cal.x1, x2:cal.x2, y:cal.y }); }catch(e){}
        }
        document.removeEventListener('mousemove', move);
        close();
        opt.onDone({
          png: url,
          box: { x:box.x, y:box.y, w:box.w },
          size: opt.size || '',
          wCm: m ? Math.round(m.wCm * 10) / 10 : 0,
          hCm: m ? Math.round(m.hCm * 10) / 10 : 0,
          topCm: m ? Math.round(m.topCm * 10) / 10 : 0,
          sideCm: m ? Math.round(m.sideCm * 10) / 10 : 0
        });
      }catch(e){
        console.error(e);
        btn.disabled = false; btn.textContent = 'Зберегти мокап';
        /* Найчастіша причина — чуже походження фото без CORS. Кажемо це
           словами: «не вдалось» відправляє людину гадати. */
        say('Мокап не зібрався. Найчастіше це фото виробу з чужого домену — ' +
            'перезавантажте його в каталог товарів.');
      }
    }

    /* Картинка може ще вантажитись — тоді розміри сцени нульові, і перше
       малювання лягло б у порожнечу. */
    if(baseEl.complete) paint(); else baseEl.onload = paint;
    window.addEventListener('resize', paint);
    setTimeout(paint, 60);
  }

  function say(m){
    try{ if(HOST.toast) return HOST.toast(m); }catch(e){}
    try{ console.warn(m); }catch(e){}
  }

  /* ══════════════════════════════════════════════════════════════════════
     ЗДАЧА РОБОТИ — ОДНЕ ВІКНО НА ВСЕ

     Доти здача була трьома кроками: завантаж макет → зроби мокап →
     надішли. Кроки бентежили, і не дарма: вони описували не роботу, а
     порядок натискань. Андрій: «просто завантажити роботу, потім випадає
     вікно, ми завантажуємо роботу, потім наступним кроком розміщуємо
     його, де можемо додати ще одну роботу, перед-зад, розмістили».

     Тому тут одне вікно. Зверху роботи: кинув файл — він одразу поїхав у
     сховище, нічого не тримається «в памʼяті вікна». Натиснув на роботу —
     вона лягла на виріб. Тягнеш, масштабуєш. Сторони вкладками — рівно
     ті, фото яких справді є: вкладка, за якою порожньо, це обіцянка, якої
     система не виконує.

     Одна кнопка «Надіслати» збирає мокапи всіх сторін і віддає їх у
     переписку. Дизайнер не думає про порядок дій — він розкладає роботу й
     віддає.

     ── ДВА РІЗНІ ЧИСЛА, І ПЛУТАТИ ЇХ ДОРОГО ──

     НАНЕСЕННЯ — те, що робить цех: той самий логотип спереду й ззаду
     вишивається двічі й коштує подвійно.
     РОБОТА — те, що робить дизайнер: той самий файл, покладений двічі,
     намальований один раз.

     Тому лічимо окремо: нанесення — по розміщеннях, роботи — по РІЗНИХ
     файлах. Однаковість беремо з відбитка вмісту, а не з назви: «logo.png»
     називається так у половини клієнтів, а той самий логотип приходить під
     трьома іменами. */
  var SIDE_UA = { front:'Перед', back:'Спина', left:'Лівий бік', right:'Правий бік' };
  async function openWork(opt){
    close();
    opt = opt || {};
    var сторони = (opt.sides || []).filter(function(s){ return s && s.url; });
    if(!сторони.length) return say('У цього виробу немає жодного фото в каталозі');
    var шир = widthCm(opt.gid, opt.size);

    /* Що вже лежить: роботи (файли) і розміщення по сторонах. */
    var works = (opt.works || []).slice();
    var places = {};
    сторони.forEach(function(s){ places[s.key] = []; });
    (opt.places || []).forEach(function(p){
      if(places[p.side]) places[p.side].push({ work:+p.work || 0,
        box:{ x:+p.x, y:+p.y, w:+p.w } });
    });

    var бік = сторони[0].key;
    /* Перше нанесення обране одразу: числа під ним — головне, що тут є, і
       відкривати вікно з порожньою колонкою й проханням «натисніть» —
       це зайвий крок рівно там, де людина вже прийшла дивитись розміри. */
    var обране = 0;
    var кадри = {};          // завантажені фото сторін
    var арт = [];            // завантажені картинки робіт

    var el = document.createElement('div');
    el.className = 'mko-wrap';
    document.body.appendChild(el);
    W = { el: el, esk: null };

    function calKey(){ return бік; }
    function calNow(){
      var c = null;
      try{ c = HOST.cal && HOST.cal(opt.gid, calKey()); }catch(e){}
      return (c && c.x2 > c.x1) ? { x1:+c.x1, x2:+c.x2, y:+c.y } : null;
    }
    var режим = 'art';
    var cal = calNow() || { x1:0.22, x2:0.78, y:0.16 };
    var маркуємо = !calNow();

    function міри(pl){
      var st = el.querySelector('[data-mko-stage]');
      if(!шир || !st) return null;
      var r = st.getBoundingClientRect();
      if(!r.width) return null;
      var смуга = (cal.x2 - cal.x1) * r.width;
      if(смуга <= 0) return null;
      var pxСм = смуга / шир;
      var a = арт[pl.work];
      var ar = a ? (a.height / a.width) : 1;
      var w = pl.box.w * r.width;
      var центр = (cal.x1 + cal.x2) / 2 * r.width;
      return { wCm: w / pxСм, hCm: w * ar / pxСм,
               topCm: (pl.box.y * r.height - cal.y * r.height) / pxСм,
               sideCm: (pl.box.x * r.width - центр) / pxСм };
    }
    /* Ті самі сантиметри, але без екрана: з розмітки сторони й пропорцій
       її фото. Потрібно для сторін, які зараз не відкриті. */
    function міриЗ(pl, c, asp){
      if(!шир || !c || !(c.x2 > c.x1) || !(asp > 0)) return null;
      var a = арт[pl.work];
      var ar = a ? (a.height / a.width) : 1;
      var k = шир / (c.x2 - c.x1);            // сантиметрів на всю ширину кадру
      var wCm = pl.box.w * k;
      return { wCm: wCm, hCm: wCm * ar,
               topCm: (pl.box.y - c.y) * asp * k,
               sideCm: (pl.box.x - (c.x1 + c.x2) / 2) * k };
    }
    function рахунок(){
      var нанесень = 0, хеші = {};
      Object.keys(places).forEach(function(k){
        places[k].forEach(function(pl){
          нанесень++;
          var w = works[pl.work];
          if(w) хеші[w.hash || w.url] = 1;
        });
      });
      return { нанесень: нанесень, робіт: Object.keys(хеші).length };
    }
    function шапкаHtml(){
      var c = рахунок();
      return '<div class="mko-h"><b>' + (opt.placeOnly ? 'Поправити розміщення · ' : 'Здати роботу · ') +
          esc(opt.name || 'виріб') + '</b>' +
        '<span class="mko-h-s">' + c.нанесень + ' ' +
          (c.нанесень === 1 ? 'нанесення' : 'нанесень') +
          (c.робіт && c.робіт !== c.нанесень ? ' · робіт ' + c.робіт : '') + '</span>' +
        '<button class="mko-x" data-mko-x>×</button></div>';
    }
    /* Яка робота зараз «в руках»: та, чиє нанесення обране, а якщо нічого
       не обрано — остання завантажена. Саме до неї й застосовується фон. */
    function активна(){
      var p = (places[бік] || [])[обране];
      if(p && works[p.work]) return p.work;
      return works.length ? works.length - 1 : -1;
    }
    var ФОН = [['none', 'Не прибирати'], ['local', 'Прибрати — вбудований'],
               ['photoroom', 'Прибрати — PhotoRoom']];
    function фонHtml(){
      var i = активна();
      if(i < 0 || opt.placeOnly) return '';
      var w = works[i], cur = w.bg || 'none';
      return '<div class="mko-bg"><span>Фон роботи' + (works.length > 1 ? ' ' + (i + 1) : '') + ':</span>' +
        ФОН.map(function(f){
          return '<button type="button" class="mko-bg-b' + (f[0] === cur ? ' on' : '') +
            '" data-mko-bg="' + f[0] + '"' + (w.bgBusy ? ' disabled' : '') + '>' + esc(f[1]) + '</button>';
        }).join('') +
        (w.bgBusy ? '<i class="mko-bg-w">прибираю…</i>' : '') +
      '</div>';
    }
    async function фон(mode){
      var i = активна();
      if(i < 0) return;
      var w = works[i];
      if((w.bg || 'none') === mode || w.bgBusy) return;
      if(!w.orig) w.orig = w.url;
      w.bgBusy = true; малюй();
      var out = null;
      try{ out = await removeBg(w.orig, mode); }
      catch(e){
        console.warn('фон', e);
        w.bgBusy = false; малюй();
        return say(mode === 'photoroom'
          ? 'PhotoRoom не відповів — перевірте адресу Worker у налаштуваннях або спробуйте вбудований'
          : 'Фон не прибрався — картинка з чужого домену або пошкоджена');
      }
      var im = await img(out);
      w.bgBusy = false;
      if(!im){ малюй(); return say('Картинка після прибирання фону не відкрилась'); }
      w.url = out; w.bg = mode;
      арт[i] = im;
      малюй();
    }
    function малюй(){
      var pl = places[бік] || [];
      el.innerHTML =
        '<div class="mko-w is-work">' + шапкаHtml() +
          '<div class="mko-works">' +
            works.map(function(w, i){
              return '<button type="button" class="mko-wk" data-mko-w="' + i + '" ' +
                'title="' + esc(w.name || 'робота') + ' — натисніть, щоб покласти на виріб">' +
                '<img src="' + esc(w.url) + '" alt=""></button>';
            }).join('') +
            (opt.placeOnly ? '' :
              '<button type="button" class="mko-wk add" data-mko-up>＋<i>завантажити</i></button>') +
          '</div>' +
          фонHtml() +
          '<div class="mko-tabs">' + сторони.map(function(s){
            var n = (places[s.key] || []).length;
            return '<button type="button" class="mko-tab' + (s.key === бік ? ' on' : '') +
              '" data-mko-side="' + esc(s.key) + '">' + esc(s.label) +
              (n ? '<i>' + n + '</i>' : '') + '</button>';
          }).join('') + '</div>' +
          '<div class="mko-body">' +
            '<div class="mko-stage" data-mko-stage>' +
              '<img class="mko-base" src="' + esc(сторонаUrl()) + '" alt="">' +
              pl.map(function(p, i){
                var w = works[p.work] || {};
                return '<div class="mko-art' + (i === обране ? ' on' : '') +
                  '" data-mko-p="' + i + '"><img src="' + esc(w.url || '') + '" alt="">' +
                  (i === обране ? '<i class="mko-gr" data-mko-grip></i>' +
                    '<button type="button" class="mko-rm" data-mko-rm="' + i + '">×</button>' : '') +
                '</div>';
              }).join('') +
              '<div class="mko-cal" data-mko-cal>' +
                '<i class="mko-cal-v" data-mko-cal-h="x1"></i>' +
                '<i class="mko-cal-v" data-mko-cal-h="x2"></i>' +
                '<i class="mko-cal-y" data-mko-cal-h="y"></i>' +
              '</div>' +
            '</div>' +
            '<div class="mko-side">' +
              '<div class="mko-num" data-mko-nums></div>' +
              '<div class="mko-note" data-mko-note></div>' +
              '<button class="mko-cal-b" data-mko-caltoggle>' +
                (режим === 'cal' ? 'Готово, розмітив' : 'Розмітити виріб') + '</button>' +
              '<div class="mko-acts">' +
                '<button class="mko-b" data-mko-x>Скасувати</button>' +
                '<button class="mko-b pri" data-mko-save>' +
                  (opt.placeOnly ? 'Зберегти розміщення' : 'Надіслати') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      постав();
    }
    function сторонаUrl(){
      var s = сторони.filter(function(x){ return x.key === бік; })[0];
      return (s && s.url) || '';
    }
    function постав(){
      var st = el.querySelector('[data-mko-stage]');
      if(!st) return;
      var r = st.getBoundingClientRect();
      if(!r.width) return;
      (places[бік] || []).forEach(function(p, i){
        var node = st.querySelector('[data-mko-p="' + i + '"]');
        if(!node) return;
        var a = арт[p.work];
        var ar = a ? (a.height / a.width) : 1;
        var w = p.box.w * r.width;
        node.style.width = w + 'px';
        node.style.height = (w * ar) + 'px';
        node.style.left = (p.box.x * r.width - w / 2) + 'px';
        node.style.top = (p.box.y * r.height) + 'px';
      });
      var calEl = el.querySelector('[data-mko-cal]');
      if(calEl){
        calEl.style.display = режим === 'cal' ? 'block' : 'none';
        calEl.querySelector('[data-mko-cal-h="x1"]').style.left = (cal.x1 * 100) + '%';
        calEl.querySelector('[data-mko-cal-h="x2"]').style.left = (cal.x2 * 100) + '%';
        calEl.querySelector('[data-mko-cal-h="y"]').style.top = (cal.y * 100) + '%';
      }
      числа();
    }
    function числа(){
      var nums = el.querySelector('[data-mko-nums]');
      var note = el.querySelector('[data-mko-note]');
      if(!nums || !note) return;
      var pl = (places[бік] || [])[обране];
      if(!pl){
        nums.innerHTML = '';
        note.innerHTML = (places[бік] || []).length
          ? 'Натисніть нанесення на виробі, щоб побачити його розміри.'
          : 'Натисніть роботу вгорі — вона ляже на виріб.';
        return;
      }
      var m = міри(pl);
      if(!m){
        nums.innerHTML = '';
        note.innerHTML = шир
          ? 'Розмітьте виріб — без цього фото не знає свого масштабу, і ' +
            'сантиметри рахувати нема з чого.'
          : 'У товару немає розмірної сітки для розміру «' + esc(opt.size || '—') +
            '». Розмістити можна, але сантиметрів під цим не буде: ' +
            'вигадувати їх не можна, за ними шиють.';
        return;
      }
      nums.innerHTML =
        '<div class="mko-n"><span>Ширина нанесення</span><b>' + esc(см(m.wCm)) + '</b></div>' +
        '<div class="mko-n"><span>Висота</span><b>' + esc(см(m.hCm)) + '</b></div>' +
        '<div class="mko-n"><span>Від горловини</span><b>' + esc(см(m.topCm)) + '</b></div>' +
        '<div class="mko-n"><span>Від центру</span><b>' +
          esc((m.sideCm >= 0 ? '' : '−') + см(Math.abs(m.sideCm))) + '</b></div>';
      note.innerHTML = 'Рахується під розмір <b>' + esc(opt.size || '—') +
        '</b>: ширина виробу ' + esc(см(шир)) + '.';
    }

    /* ── Миша ── */
    function frac(ev){
      var st = el.querySelector('[data-mko-stage]');
      var r = st.getBoundingClientRect();
      return { x: clamp((ev.clientX - r.left) / r.width, 0, 1),
               y: clamp((ev.clientY - r.top) / r.height, 0, 1) };
    }
    var drag = null;
    el.addEventListener('mousedown', function(ev){
      var h = ev.target.closest && ev.target.closest('[data-mko-cal-h]');
      if(h && режим === 'cal') return (drag = { тип:'cal', ключ:h.getAttribute('data-mko-cal-h') }),
        ev.preventDefault();
      if(ev.target.closest && ev.target.closest('[data-mko-grip]'))
        return (drag = { тип:'size' }), ev.preventDefault();
      var node = ev.target.closest && ev.target.closest('[data-mko-p]');
      if(!node) return;
      var i = +node.getAttribute('data-mko-p');
      if(i !== обране){ обране = i; малюй(); }
      var pl = (places[бік] || [])[обране];
      if(!pl) return;
      var f0 = frac(ev);
      drag = { тип:'move', dx: pl.box.x - f0.x, dy: pl.box.y - f0.y };
      ev.preventDefault();
    });
    function move(ev){
      if(!drag) return;
      var f = frac(ev);
      if(drag.тип === 'cal'){
        if(drag.ключ === 'y') cal.y = f.y;
        else if(drag.ключ === 'x1') cal.x1 = Math.min(f.x, cal.x2 - 0.03);
        else cal.x2 = Math.max(f.x, cal.x1 + 0.03);
        return постав();
      }
      var pl = (places[бік] || [])[обране];
      if(!pl) return;
      if(drag.тип === 'move'){
        pl.box.x = clamp(f.x + drag.dx, 0, 1);
        pl.box.y = clamp(f.y + drag.dy, 0, 1);
      } else {
        /* Тягнемо за кут — міняється ширина; висота йде за пропорцією
           файлу. Розтягувати макет непропорційно не можна взагалі: це вже
           не той логотип, який погодив клієнт. */
        pl.box.w = clamp(f.x - (pl.box.x - pl.box.w / 2), 0.04, 1);
      }
      постав();
    }
    document.addEventListener('mousemove', move);
    var up = function(){ drag = null; };
    document.addEventListener('mouseup', up);

    function прибрати(){
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      close();
    }
    el.addEventListener('click', async function(ev){
      var t = ev.target;
      if(t === el || (t.closest && t.closest('[data-mko-x]'))) return прибрати();
      var rm = t.closest && t.closest('[data-mko-rm]');
      if(rm){
        places[бік].splice(+rm.getAttribute('data-mko-rm'), 1);
        обране = -1;
        return малюй();
      }
      var tab = t.closest && t.closest('[data-mko-side]');
      if(tab){
        бік = tab.getAttribute('data-mko-side');
        обране = -1;
        cal = calNow() || cal;
        режим = calNow() ? 'art' : 'cal';
        малюй();
        var b = el.querySelector('.mko-base');
        if(b) b.onload = постав;
        return;
      }
      var wk = t.closest && t.closest('[data-mko-w]');
      if(wk){
        var i = +wk.getAttribute('data-mko-w');
        places[бік].push({ work:i, box:{ x:0.5, y:0.34, w:0.26 } });
        обране = places[бік].length - 1;
        return малюй();
      }
      if(t.closest && t.closest('[data-mko-up]')) return вантажити();
      var bgb = t.closest && t.closest('[data-mko-bg]');
      if(bgb) return фон(bgb.getAttribute('data-mko-bg'));
      if(t.closest && t.closest('[data-mko-caltoggle]')){
        режим = режим === 'cal' ? 'art' : 'cal';
        if(режим === 'art' && HOST.calSave){
          try{ HOST.calSave(opt.gid, { x1:cal.x1, x2:cal.x2, y:cal.y }, calKey()); }catch(e){}
        }
        return малюй();
      }
      if(t.closest && t.closest('[data-mko-save]')) return зберегти();
    });
    var esk = function(ev){ if(ev.key === 'Escape') прибрати(); };
    document.addEventListener('keydown', esk, true);
    W.esk = esk;

    async function вантажити(){
      if(!opt.onUpload) return say('Завантаження недоступне');
      var f = null;
      try{ f = await opt.onUpload(); }catch(e){ console.error(e); }
      if(!f || !f.url) return;
      var im = await img(f.url);
      if(!im) return say('Картинка не відкрилась');
      works.push(f);
      арт.push(im);
      /* Щойно завантажену роботу одразу кладемо на виріб: людина її для
         цього й вантажила, а зайве натискання тут читається як «а що тепер?». */
      places[бік].push({ work: works.length - 1, box:{ x:0.5, y:0.34, w:0.26 } });
      обране = places[бік].length - 1;
      малюй();
    }

    async function зберегти(){
      var btn = el.querySelector('[data-mko-save]');
      var c = рахунок();
      if(!c.нанесень) return say('Покладіть хоч одну роботу на виріб');
      btn.disabled = true; btn.textContent = 'Збираю…';
      try{
        var out = [];
        for(var si = 0; si < сторони.length; si++){
          var s = сторони[si];
          var pl = places[s.key] || [];
          if(!pl.length) continue;
          var base = кадри[s.key] || await img(s.url);
          if(!base){ say('Фото сторони «' + s.label + '» не відкрилось'); continue; }
          кадри[s.key] = base;
          var cv = document.createElement('canvas');
          cv.width = base.naturalWidth || base.width;
          cv.height = base.naturalHeight || base.height;
          var x = cv.getContext('2d');
          x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
          x.drawImage(base, 0, 0, cv.width, cv.height);
          var мірки = [];
          /* Сантиметри — для КОЖНОЇ сторони, а не лише для відкритої.
             Доти спина, на яку в мить збереження не дивились, лягала з
             нулями: «0 см від горловини» в цеху читається як виміряне. Від
             екрана тут нічого не залежить — лише розмітка сторони й
             пропорції її фото. */
          var calS = (s.key === бік) ? cal : (function(){
            var c = null;
            try{ c = HOST.cal && HOST.cal(opt.gid, s.key); }catch(e){}
            return (c && c.x2 > c.x1) ? { x1:+c.x1, x2:+c.x2, y:+c.y } : null;
          })();
          var asp = (base.naturalHeight || base.height) / (base.naturalWidth || base.width);
          for(var pi = 0; pi < pl.length; pi++){
            var p = pl[pi];
            var a = арт[p.work];
            if(!a) continue;
            var ar = a.height / a.width;
            var w = p.box.w * cv.width;
            x.drawImage(a, p.box.x * cv.width - w / 2, p.box.y * cv.height, w, w * ar);
            var m = міриЗ(p, calS, asp);
            мірки.push({ work:p.work, name:(works[p.work] || {}).name || '',
                         x:p.box.x, y:p.box.y, w:p.box.w,
                         wCm: m ? Math.round(m.wCm * 10) / 10 : 0,
                         hCm: m ? Math.round(m.hCm * 10) / 10 : 0,
                         topCm: m ? Math.round(m.topCm * 10) / 10 : 0,
                         sideCm: m ? Math.round(m.sideCm * 10) / 10 : 0 });
          }
          out.push({ side:s.key, label:s.label, png: cv.toDataURL('image/png'),
                     places: мірки });
        }
        if(HOST.calSave){
          try{ HOST.calSave(opt.gid, { x1:cal.x1, x2:cal.x2, y:cal.y }, calKey()); }catch(e){}
        }
        прибрати();
        opt.onDone({ works: works, sides: out, size: opt.size || '',
                     нанесень: c.нанесень, робіт: c.робіт });
      }catch(e){
        console.error(e);
        btn.disabled = false; btn.textContent = opt.placeOnly ? 'Зберегти розміщення' : 'Надіслати';
        say('Мокап не зібрався. Найчастіше це фото виробу з чужого домену — ' +
            'перезавантажте його в каталог товарів.');
      }
    }

    малюй();
    /* Картинки робіт і фото сторони можуть ще вантажитись — перше
       малювання лягло б у порожнечу. */
    for(var i = 0; i < works.length; i++) арт[i] = await img(works[i].url);
    var b0 = el.querySelector('.mko-base');
    if(b0){ if(b0.complete) постав(); else b0.onload = постав; }
    window.addEventListener('resize', постав);
    setTimeout(постав, 60);
    if(!works.length && !opt.placeOnly) вантажити();
  }

  /* ══════════════════════════════════════════════════════════════════════
     КАРТКА ДЛЯ МЕНЕДЖЕРА

     Те, що менеджер качає й кладе в роботу: горизонтальний аркуш, де ліворуч
     макет, праворуч мокап, а внизу — склад, примітка й розміщення в
     сантиметрах.

     Навіщо саме картинкою, а не посиланням на файли: її пересилають. У
     Директ, підряднику, у цех — скрізь, де відкрити нашу адмінку не можна,
     а знати, що і як шити, треба. Три файли й усний переказ на цьому шляху
     втрачаються, один аркуш — ні.
     ══════════════════════════════════════════════════════════════════════ */
  function round(x, a, b, w, h, r){
    x.beginPath();
    x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r);
    x.closePath();
  }
  /* Перенос по словах. Canvas сам цього не вміє: довгий рядок він малює
     рівно, доки не вийде за край аркуша й далі в нікуди. */
  function wrap(x, text, w, font){
    x.font = font;
    var out = [], рядок = '';
    String(text).split(/\s+/).forEach(function(сл){
      var спроба = рядок ? рядок + ' ' + сл : сл;
      if(x.measureText(спроба).width > w && рядок){ out.push(рядок); рядок = сл; }
      else рядок = спроба;
    });
    if(рядок) out.push(рядок);
    return out.slice(0, 4);
  }
  function fit(x, im, a, b, w, h){
    if(!im) return;
    var k = Math.min(w / im.width, h / im.height);
    var ww = im.width * k, hh = im.height * k;
    x.drawImage(im, a + (w - ww) / 2, b + (h - hh) / 2, ww, hh);
  }
  /* Ширина аркуша — та сама, що в картці комерційної пропозиції. */
  var DOC_W = 1240;
  /* ══════════ КАРТКА «НА ПОГОДЖЕННЯ» ══════════

     Андрій (30.09–01.10): шапку прибираємо зовсім — ні «Loomiq ·
     виробництво мерчу», ні контактів, ні лінії; зверху заголовок, справа
     лише номер; над рамками дрібно «Макет» і «Макет на виробі», на самих
     картинках нічого; фото підрізаються, як у картках B2B; унизу — опис
     замовлення (модель, колір, розмір, кількість, тип і розмір нанесення) і
     примітка; смужки «ширина виробу» й ціни немає. */
  /* Кадр — як у картках B2B: цілим, зі своїм рідним тлом, і заповнює рамку
     до країв (жодного «прямокутника фото» всередині рамки). Масштаб такий,
     щоб виріб (обрізані межі кадру) вліз із невеликим запасом, а сам кадр
     перекрив рамку; центруємо по виробу, а не по файлу — поля в мокапах
     несиметричні. */
  function framed(x, im, a, b, w, h){
    if(!im) return;
    var C = window.LQCards || {};
    var t = (C.trim && C.trim(im)) || { x:0, y:0, w:im.width, h:im.height };
    var tint = (C.tint && C.tint(im)) || '#F7F9FC';
    x.save();
    round(x, a, b, w, h, 16); x.clip();
    x.fillStyle = tint; x.fillRect(a, b, w, h);
    var kFit = Math.min(w / t.w, h / t.h) * 0.9;
    var kCover = Math.max(w / im.width, h / im.height);
    var k = Math.max(kFit, kCover);
    /* Виріб усе одно не різати: якщо покриття роздуло б його за рамку —
       повертаємось до «вліз цілком», а краї рамки візьме тло. */
    if(t.w * k > w || t.h * k > h) k = Math.min(w / t.w, h / t.h);
    var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    var dx = a + w / 2 - cx * k, dy = b + h / 2 - cy * k;
    /* Кадр не відриваємо від країв рамки, якщо його вистачає. */
    var iw = im.width * k, ih = im.height * k;
    if(iw >= w){ dx = Math.min(a, Math.max(a + w - iw, dx)); }
    if(ih >= h){ dy = Math.min(b, Math.max(b + h - ih, dy)); }
    /* Кадр вужчий (чи нижчий) за рамку — смуги по краях заповнюємо
       продовженням його ж крайніх пікселів: тло йде далі без шва, і рамка
       не перетворюється на «фото в паспарту». */
    var e = 2;
    if(dx > a) x.drawImage(im, 0, 0, e, im.height, a, dy, dx - a + 1, ih);
    if(dx + iw < a + w) x.drawImage(im, im.width - e, 0, e, im.height, dx + iw - 1, dy, a + w - dx - iw + 1, ih);
    if(dy > b) x.drawImage(im, 0, 0, im.width, e, a, b, w, dy - b + 1);
    if(dy + ih < b + h) x.drawImage(im, 0, im.height - e, im.width, e, a, dy + ih - 1, w, b + h - dy - ih + 1);
    x.drawImage(im, dx, dy, iw, ih);
    x.restore();
  }
  /* Опис — сіткою по три в ряд: підпис капітеллю, значення великим. */
  function specsGrid(x, items, y){
    var cols = 3, colW = (DOC_W - 128) / cols, rowH = 64;
    items.forEach(function(s, i){
      var sx = 64 + (i % cols) * colW, sy = y + Math.floor(i / cols) * rowH;
      x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
      x.fillText(String(s[0]).toUpperCase(), sx, sy);
      x.fillStyle = '#0F2034'; x.font = '600 18px Inter, system-ui, sans-serif';
      var t = String(s[1] == null || s[1] === '' ? '—' : s[1]), maxW = colW - 20;
      if(x.measureText(t).width > maxW){
        while(t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        t += '…';
      }
      x.fillText(t, sx, sy + 28);
    });
    return y + Math.ceil(items.length / cols) * rowH;
  }
  async function card(data){
    var макет = await img(data.art);
    var мокап = await img(data.mock);
    var nums = (data.nums || []).slice(0, 9);
    var проба = document.createElement('canvas').getContext('2d');
    var рядківНоти = data.note
      ? wrap(проба, String(data.note), DOC_W - 128 - 40, '400 15px Inter, system-ui, sans-serif').length
      : 0;
    var cellH = 560;
    var top = 56, головаH = 44, підпис = 30;
    /* Висота — та сама арифметика, що й малювання нижче, крок у крок. */
    var H = top + головаH + 28 + підпис + cellH + 48
      + (nums.length ? Math.ceil(nums.length / 3) * 64 + 8 : 0)
      + (рядківНоти ? 26 + рядківНоти * 23 + 12 : 0)
      + 44;
    var cv = document.createElement('canvas');
    cv.width = DOC_W; cv.height = H;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, DOC_W, H);
    /* Заголовок ліворуч, номер праворуч — і більше нічого. */
    var y = top + 30;
    x.textAlign = 'left';
    x.fillStyle = '#0F2034'; x.font = '700 30px Inter, system-ui, sans-serif';
    x.fillText(String(data.title || 'Макет на узгодження'), 64, y);
    if(data.no){
      x.textAlign = 'right';
      x.fillStyle = '#7C8798'; x.font = '600 18px Inter, system-ui, sans-serif';
      x.fillText(String(data.no), DOC_W - 64, y);
      x.textAlign = 'left';
    }
    y = top + головаH + 28;
    var cellW = (DOC_W - 128 - 24) / 2;
    [[макет, 'Макет', 64], [мокап, 'Макет на виробі', 64 + cellW + 24]].forEach(function(p){
      x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
      x.fillText(String(p[1]).toUpperCase(), p[2], y + 14);
      framed(x, p[0], p[2], y + підпис, cellW, cellH);
    });
    y += підпис + cellH + 48;
    if(nums.length){
      y = specsGrid(x, nums, y) + 8;
    }
    /* ══════════ ПРИМІТКА ДЛЯ КЛІЄНТА ══════════
       Те, що доти писали руками в кожному повідомленні: колір на екрані
       відрізняється від тканини. */
    if(рядківНоти){
      var рядки = wrap(x, String(data.note), DOC_W - 128 - 40,
                       '400 15px Inter, system-ui, sans-serif');
      var nh = 26 + рядки.length * 23;
      x.fillStyle = '#F7F9FC'; round(x, 64, y, DOC_W - 128, nh, 14); x.fill();
      x.fillStyle = '#C3CBD8'; x.fillRect(64, y, 3, nh);
      x.fillStyle = '#4A5768'; x.font = '400 15px Inter, system-ui, sans-serif';
      рядки.forEach(function(t, i){ x.fillText(t, 88, y + 34 + i * 23); });
    }
    return cv.toDataURL('image/png');
  }
  /* ══════════ КАРТКА ДЛЯ ЦЕХУ ══════════

     Андрій: «щоб вони подивилися на цю карточку і зрозуміли відступи, які
     будуть зверху, з боку, яка ширина вироба». Мокап показує, як виглядає;
     а машиністу треба знати, куди ставити п'яльця. Тому поруч із мокапом —
     схема виробу з розмірними лініями: ширина виробу, ширина й висота
     принта, відступ від горловини й від центру. Схема умовна (силует
     футболки), але цифри на ній — ті самі, що порахував мокап із розмірної
     сітки, і саме за ними ставлять вишивку. Одна картка — одна сторона. */
  var DIM = '#1F6FEB';
  function arrow(x, xa, ya, xb, yb){
    var ang = Math.atan2(yb - ya, xb - xa), r = 8;
    [[xa, ya, ang + Math.PI], [xb, yb, ang]].forEach(function(p){
      x.beginPath();
      x.moveTo(p[0], p[1]);
      x.lineTo(p[0] - r * Math.cos(p[2] - 0.45), p[1] - r * Math.sin(p[2] - 0.45));
      x.lineTo(p[0] - r * Math.cos(p[2] + 0.45), p[1] - r * Math.sin(p[2] + 0.45));
      x.closePath(); x.fill();
    });
  }
  function dim(x, xa, ya, xb, yb, label, lx, ly, align){
    x.save();
    x.strokeStyle = DIM; x.fillStyle = DIM; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(xa, ya); x.lineTo(xb, yb); x.stroke();
    arrow(x, xa, ya, xb, yb);
    x.font = '700 15px Inter, system-ui, sans-serif';
    x.textAlign = align || 'center';
    /* Підкладка під підписом — щоб число не губилось на лініях силуету. */
    var tw = x.measureText(label).width;
    var bx = align === 'right' ? lx - tw - 4 : align === 'left' ? lx - 4 : lx - tw / 2 - 4;
    x.fillStyle = 'rgba(247,249,252,.92)'; x.fillRect(bx, ly - 15, tw + 8, 20);
    x.fillStyle = DIM; x.fillText(label, lx, ly);
    x.restore();
  }
  function schema(x, a, b, w, h, W, spots){
    x.save();
    round(x, a, b, w, h, 16); x.clip();
    x.fillStyle = '#F7F9FC'; x.fillRect(a, b, w, h);
    if(!(W > 0)){
      x.fillStyle = '#7C8798'; x.font = '500 15px Inter, system-ui, sans-serif'; x.textAlign = 'center';
      x.fillText('Немає розмірної сітки — схему не намалювати', a + w / 2, b + h / 2);
      x.restore(); return;
    }
    var s = (w * 0.84) / (1.52 * W);            // пікселів у сантиметрі
    var ox = a + w / 2, oy = b + h * 0.12;
    var P = function(cx, cy){ return [ox + cx * s, oy + cy * s]; };
    var nw = 0.19 * W, neckY = 0.08 * W;
    /* Силует: горловина, плечі, рукави, низ. */
    x.beginPath();
    var p0 = P(-nw, 0); x.moveTo(p0[0], p0[1]);
    var c = P(0, 0.16 * W), p1 = P(nw, 0);
    x.quadraticCurveTo(c[0], c[1], p1[0], p1[1]);
    [[0.47, 0.04], [0.76, 0.30], [0.62, 0.42], [0.5, 0.33], [0.5, 1.2],
     [-0.5, 1.2], [-0.5, 0.33], [-0.62, 0.42], [-0.76, 0.30], [-0.47, 0.04]].forEach(function(q){
      var pt = P(q[0] * W, q[1] * W); x.lineTo(pt[0], pt[1]);
    });
    x.closePath();
    x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = '#9AA5B5'; x.lineWidth = 2; x.stroke();
    /* Лінія горловини й центр — від них і рахуються відступи. */
    x.save();
    x.setLineDash([6, 6]); x.strokeStyle = '#C3CBD8'; x.lineWidth = 1.4;
    var t0 = P(0, neckY), t1 = P(0, 1.2 * W);
    x.beginPath(); x.moveTo(t0[0], t0[1]); x.lineTo(t1[0], t1[1]); x.stroke();
    var n0 = P(-0.32 * W, neckY), n1 = P(0.32 * W, neckY);
    x.beginPath(); x.moveTo(n0[0], n0[1]); x.lineTo(n1[0], n1[1]); x.stroke();
    x.restore();
    /* Ширина виробу — внизу. */
    var wy = P(0, 1.1 * W)[1];
    dim(x, P(-0.5 * W, 0)[0] + 2, wy, P(0.5 * W, 0)[0] - 2, wy,
        'ширина виробу ' + см(W), ox, wy - 10);
    (spots || []).forEach(function(sp){
      if(!(+sp.wCm > 0)) return;
      var l = (+sp.sideCm || 0) - sp.wCm / 2, t = neckY + (+sp.topCm || 0);
      var tl = P(l, t), bw = sp.wCm * s, bh = (+sp.hCm || 0) * s;
      x.fillStyle = 'rgba(31,111,235,.12)'; x.fillRect(tl[0], tl[1], bw, bh);
      x.strokeStyle = DIM; x.lineWidth = 2; x.strokeRect(tl[0], tl[1], bw, bh);
      /* Ширина принта — над ним, висота — праворуч. */
      dim(x, tl[0], tl[1] - 14, tl[0] + bw, tl[1] - 14, см(sp.wCm), tl[0] + bw / 2, tl[1] - 22);
      if(bh > 0) dim(x, tl[0] + bw + 14, tl[1], tl[0] + bw + 14, tl[1] + bh,
                     см(sp.hCm), tl[0] + bw + 22, tl[1] + bh / 2 + 5, 'left');
      /* Від горловини — ліворуч від принта. */
      var ny = P(0, neckY)[1];
      if(tl[1] - ny > 6) dim(x, tl[0] - 14, ny, tl[0] - 14, tl[1],
                              см(sp.topCm), tl[0] - 22, (ny + tl[1]) / 2 + 5, 'right');
      /* Від центру — якщо принт зсунутий; інакше прямо кажемо «по центру». */
      var cy = tl[1] + bh / 2;
      if(Math.abs(+sp.sideCm || 0) >= 0.5){
        var cx = tl[0] + bw / 2;
        dim(x, ox, cy, cx, cy, 'від центру ' + см(Math.abs(sp.sideCm)), (ox + cx) / 2, cy - 10);
      } else {
        x.fillStyle = DIM; x.font = '600 13px Inter, system-ui, sans-serif'; x.textAlign = 'center';
        x.fillText('по центру', ox, tl[1] + bh + 22);
      }
    });
    x.restore();
  }
  async function prodCard(data){
    var мокап = await img(data.mock);
    var nums = (data.nums || []).slice(0, 9);
    var spots = (data.spots || []).filter(function(sp){ return +sp.wCm > 0; });
    var cellH = 560, top = 56, головаH = 44, підпис = 30;
    var H = top + головаH + 28 + підпис + cellH + 40
      + (nums.length ? Math.ceil(nums.length / 3) * 64 + 8 : 0)
      + (spots.length ? spots.length * 44 + 16 : 0) + 40;
    var cv = document.createElement('canvas');
    cv.width = DOC_W; cv.height = H;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, DOC_W, H);
    var y = top + 30;
    x.textAlign = 'left';
    x.fillStyle = '#0F2034'; x.font = '700 30px Inter, system-ui, sans-serif';
    var t = String(data.title || 'Картка для цеху') + (data.side ? ' · ' + data.side : '');
    x.fillText(t, 64, y);
    if(data.no){
      x.textAlign = 'right';
      x.fillStyle = '#7C8798'; x.font = '600 18px Inter, system-ui, sans-serif';
      x.fillText(String(data.no), DOC_W - 64, y);
      x.textAlign = 'left';
    }
    y = top + головаH + 28;
    var cellW = (DOC_W - 128 - 24) / 2;
    x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
    x.fillText('МАКЕТ НА ВИРОБІ', 64, y + 14);
    x.fillText('СХЕМА РОЗМІЩЕННЯ · УМОВНО', 64 + cellW + 24, y + 14);
    framed(x, мокап, 64, y + підпис, cellW, cellH);
    schema(x, 64 + cellW + 24, y + підпис, cellW, cellH, +data.widthCm || 0, spots);
    y += підпис + cellH + 40;
    if(nums.length) y = specsGrid(x, nums, y) + 8;
    spots.forEach(function(sp){
      x.fillStyle = '#F5F8FC'; round(x, 64, y, DOC_W - 128, 36, 10); x.fill();
      x.fillStyle = '#0F2034'; x.font = '700 17px Inter, system-ui, sans-serif';
      x.fillText((sp.label ? sp.label + ': ' : '') + 'принт ' + см(sp.wCm) + ' × ' + см(sp.hCm || 0) +
        ' · від горловини ' + см(sp.topCm || 0) +
        (Math.abs(+sp.sideCm || 0) >= 0.5 ? ' · від центру ' + (sp.sideCm > 0 ? '+' : '−') + см(Math.abs(sp.sideCm))
                                           : ' · по центру'), 80, y + 24);
      y += 44;
    });
    return cv.toDataURL('image/png');
  }
  /* ══════════ ПРИБРАТИ ФОН З РОБОТИ ══════════

     Андрій: «коли завантажуємо дизайн, повинен бути вибір… не видаляти фон,
     видалити фон внутрішнім інструментом, видалити фон зовнішнім». Клієнт
     часто шле логотип на білому чи кольоровому тлі, і без цього на мокапі
     видно прямокутник замість нашивки.

     Вбудований — той самий алгоритм, що й у конструкторі сайту (копія:
     конструктор живе в іншій сторінці й свого назовні не віддає).
     PhotoRoom — через наш Worker-проксі; ключ лежить лише в секретах
     Worker, сюди приходить тільки його адреса з налаштувань. */
  function loadImgEl(src){
    return new Promise(function(resolve, reject){
      var img = new Image();
      if(!/^data:/i.test(String(src))) img.crossOrigin = 'anonymous';
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }
  function toDataUrl(src){
    if(/^data:/i.test(String(src))) return Promise.resolve(String(src));
    return fetch(src).then(function(r){ return r.blob(); }).then(function(b){
      return new Promise(function(res, rej){
        var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    });
  }
  function removeBgLocal(dataUrl){
    return loadImgEl(dataUrl).then(function(img){
      var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
      var canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      var corners = [
        ctx.getImageData(0,     0,     1, 1).data,
        ctx.getImageData(W - 1, 0,     1, 1).data,
        ctx.getImageData(0,     H - 1, 1, 1).data,
        ctx.getImageData(W - 1, H - 1, 1, 1).data
      ];
      var cornersTransparent = corners.some(function(p){ return p[3] < 128; });

      var imageData = ctx.getImageData(0, 0, W, H);
      var px = imageData.data;
      var THR = 220;            // поріг "майже білого"
      var TOL = 40;             // допуск по каналах навколо кольору фону
      var visited = new Uint8Array(W * H);
      var NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      // Чи прибирати білі просвіти всередині букв: тільки коли дизайн "темне-на-світлому".
      // Для білого лого на темному/прозорому фоні білий — це сам логотип, його не чіпаємо.
      var removeCounters = false;

      // ── Заливка від країв (лише якщо є суцільний непрозорий фон) ──
      if(!cornersTransparent){
        // реальний колір фону з кутів (білий ТА сірий/кольоровий)
        var br = 0, bgc = 0, bb = 0;
        corners.forEach(function(c){ br += c[0]; bgc += c[1]; bb += c[2]; });
        br /= 4; bgc /= 4; bb /= 4;
        var bgAvg = (br + bgc + bb) / 3;
        var bgMax = Math.max(br, bgc, bb);
        var bgIsLight = bgAvg > 180;
        removeCounters = bgIsLight;
        var isWhiteBg = function(pos){
          var i = pos * 4;
          if(px[i + 3] < 10) return true;
          var r = px[i], g = px[i + 1], b = px[i + 2];
          // "майже білий = фон" лише на світлому фоні (інакше з'їдало б біле лого на темному)
          if(bgIsLight && r > THR && g > THR && b > THR) return true;
          return Math.abs(r - br) <= TOL && Math.abs(g - bgc) <= TOL && Math.abs(b - bb) <= TOL;
        };
        var seeds = [];
        for(var x = 0; x < W; x++){
          [0, H - 1].forEach(function(y){
            var p = y * W + x;
            if(!visited[p] && isWhiteBg(p)){ visited[p] = 1; seeds.push(p); }
          });
        }
        for(var y = 1; y < H - 1; y++){
          [0, W - 1].forEach(function(x2){
            var p = y * W + x2;
            if(!visited[p] && isWhiteBg(p)){ visited[p] = 1; seeds.push(p); }
          });
        }
        var head = 0;
        while(head < seeds.length){
          var pos = seeds[head++];
          var cx0 = pos % W, cy0 = (pos / W) | 0;
          for(var k = 0; k < 4; k++){
            var nx = cx0 + NB[k][0], ny = cy0 + NB[k][1];
            if(nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            var npos = ny * W + nx;
            if(!visited[npos] && isWhiteBg(npos)){ visited[npos] = 1; seeds.push(npos); }
          }
        }
        // Фаза 2: замкнені "кишені" сірого/кольорового фону (білий вміст захищений)
        if(bgMax < 244){
          var POCKET_TOL = 18;
          for(var i2 = 0; i2 < W * H; i2++){
            if(visited[i2]) continue;
            var j = i2 * 4;
            if(px[j + 3] < 10){ visited[i2] = 1; continue; }
            var r2 = px[j], g2 = px[j + 1], b2 = px[j + 2];
            var matchesBg = Math.abs(r2 - br) <= POCKET_TOL && Math.abs(g2 - bgc) <= POCKET_TOL && Math.abs(b2 - bb) <= POCKET_TOL;
            var brighterThanBg = (r2 + g2 + b2) / 3 > bgAvg + 10;
            if(matchesBg && !brighterThanBg) visited[i2] = 1;
          }
        }
      } else {
        // Прозорий фон: вирізати просвіти лише якщо вміст переважно ТЕМНИЙ (темне лого).
        var bsum = 0, bcnt = 0;
        for(var q = 0; q < W * H; q++){
          if(px[q * 4 + 3] >= 10){ bsum += (px[q*4] + px[q*4+1] + px[q*4+2]) / 3; bcnt++; }
        }
        removeCounters = bcnt > 0 && (bsum / bcnt) < 140;
      }

      // ── Фаза 3: замкнені майже-білі просвіти всередині букв (О, В, А, Q…) —
      // лише для "темне-на-світлому". Видаляємо замкнену (не до краю) майже-білу
      // ділянку, оточену непрозорим вмістом. Прозорі сусіди не рахуються.
      var isNearWhite = function(idx){
        var jj = idx * 4;
        return px[jj + 3] >= 10 && px[jj] > 200 && px[jj + 1] > 200 && px[jj + 2] > 200;
      };
      var OPAQUE_FRAC = 0.5;   // межа просвіту переважно з непрозорого вмісту → це дірка в букві
      if(removeCounters){
        var comp = new Int32Array(W * H); comp.fill(-1);
        for(var s = 0; s < W * H; s++){
          if(visited[s] || comp[s] !== -1 || !isNearWhite(s)) continue;
          var stack = [s]; comp[s] = s;
          var members = [s];
          var opaqueBorder = 0, totalBorder = 0, touchesEdge = false, h2 = 0;
          while(h2 < stack.length){
            var pp = stack[h2++];
            var xx = pp % W, yy = (pp / W) | 0;
            if(xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1) touchesEdge = true;
            for(var kk = 0; kk < 4; kk++){
              var nx2 = xx + NB[kk][0], ny2 = yy + NB[kk][1];
              if(nx2 < 0 || nx2 >= W || ny2 < 0 || ny2 >= H) continue;
              var np = ny2 * W + nx2;
              if(isNearWhite(np)){
                if(comp[np] === -1){ comp[np] = s; stack.push(np); members.push(np); }
              } else {
                totalBorder++;
                if(px[np * 4 + 3] >= 10) opaqueBorder++;   // непрозорий сусід (= обведення букви)
              }
            }
          }
          // замкнений (не торкається краю) білий просвіт, оточений непрозорим вмістом → прибрати
          if(!touchesEdge && totalBorder > 0 && opaqueBorder / totalBorder >= OPAQUE_FRAC){
            members.forEach(function(m){ visited[m] = 1; });
          }
        }
      }

      for(var i3 = 0; i3 < W * H; i3++){
        if(visited[i3]) px[i3 * 4 + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    });
  }
  function removeBgPhotoroom(dataUrl){
    var url = String((HOST.bgUrl && HOST.bgUrl()) || '').trim();
    if(!/^https:\/\//i.test(url)) return Promise.reject(new Error('no-proxy'));
    return fetch(dataUrl).then(function(r){ return r.blob(); }).then(function(blob){
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 25000);
      return fetch(url, { method:'POST', headers:{ 'Content-Type': blob.type || 'image/png' },
                          body: blob, signal: ctrl.signal })
        .then(function(r){
          clearTimeout(timer);
          if(!r.ok) throw new Error('api-' + r.status);
          return r.blob();
        });
    }).then(function(out){
      if(!out || !/^image\//.test(out.type || '')) throw new Error('api-bad-type');
      return new Promise(function(res, rej){
        var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = rej;
        fr.readAsDataURL(out);
      });
    });
  }
  /* mode: 'none' | 'local' | 'photoroom'. Повертає data-URL або вихідну адресу. */
  function removeBg(src, mode){
    if(mode !== 'local' && mode !== 'photoroom') return Promise.resolve(src);
    return toDataUrl(src).then(function(d){
      return mode === 'photoroom' ? removeBgPhotoroom(d) : removeBgLocal(d);
    });
  }

  window.LQMock = {
    set host(h){ HOST = h || {}; },
    get host(){ return HOST; },
    open: open, openWork: openWork, card: card, prodCard: prodCard, close: close,
    /* Назовні віддаємо й перерахунок: панель показує ті самі сантиметри в
       рядку під мокапом, і рахувати їх удруге своїм способом означає
       рано чи пізно показати інше число. */
    widthCm: widthCm, calOf: calOf, см: см, removeBg: removeBg
  };
})();
