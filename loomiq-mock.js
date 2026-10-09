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
    if(W && W.off){ try{ W.off(); }catch(e){} }
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
  /* ══════════ САНТИМЕТРИ З «ОБЛАСТЕЙ НАНЕСЕННЯ» ══════════
     Розмітка виробу одна — та, що в картці товару: верх і низ виробу (з них
     масштаб — висота для розміру з сітки) і краї. Відступи цех міряє від
     ВЕРХУ виробу й від його КРАЮ — так їх і рахуємо. `z` — розмітка
     (частки кадру + висота в см), `box` — положення роботи (частки кадру),
     `ar` — пропорції роботи (висота/ширина), `asp` — пропорції фото. */
  function zoneOf(gid, side, color, size){
    try{ return (HOST.zone && HOST.zone(gid, side, color, size)) || null; }catch(e){ return null; }
  }
  function measure(z, box, ar, asp){
    if(!z || !(z.B > z.T) || !(z.H > 0) || !(asp > 0) || !box) return null;
    var ky = z.H / (z.B - z.T), kx = ky / asp;
    var wCm = box.w * kx, edges = z.L != null && z.R != null && z.R > z.L;
    return { wCm: wCm, hCm: wCm * (ar || 1),
             topCm: (box.y - z.T) * ky,
             edgeCm: edges ? (box.x - box.w / 2 - z.L) * kx : null,
             sideCm: edges ? (box.x - (z.L + z.R) / 2) * kx : null,
             garmentW: edges ? (z.R - z.L) * kx : 0, garmentH: z.H };
  }
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
    /* БИТІ ПОЛОЖЕННЯ З ВЕРСІЙ (баг 03.10, див. docs/BUGS.md).
       Старе вікно встигло зберегти положення за кадром («упала крізь ногу»),
       а в деяких версіях координат немає зовсім. Нове вікно показувало їх
       чесно — під нижнім краєм фото чи в куті поза ним, — і картинку не можна
       було ні побачити, ні схопити: «зависла». Тому все, що приходить ззовні,
       спершу лагодимо: чого бракує — ставимо на груди, а за кадр не пускаємо
       (`втисни`, щойно відомі пропорції фото й роботи). */
    var число = function(v){ var n = parseFloat(v); return isFinite(n) ? n : NaN; };
    var працює = function(w){ return (+w === +w) && works[+w] ? +w : 0; };
    (opt.places || []).forEach(function(p){
      if(!p) return;
      var side = places[p.side] ? p.side : сторони[0].key;     // невідома сторона — на перед
      var x = число(p.x), y = число(p.y), w = число(p.w);
      var ar = число(p.ar);
      places[side].push({ work: працює(p.work), ar: ar > 0 ? ar : null,
        box:{ x: isFinite(x) ? x : 0.5, y: isFinite(y) ? y : 0.3,
              w: (w > 0) ? Math.min(w, 1) : 0.26 } });
    });
    var втиснуто = {};

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

    /* Пропорції фото відкритої сторони — з самої картинки на сцені. */
    function aspNow(){
      var im = el.querySelector('.mko-base');
      return (im && im.naturalWidth) ? im.naturalHeight / im.naturalWidth : (асп[бік] || 0);
    }
    function міри(pl){
      var a = арт[pl.work];
      return measure(zoneOf(opt.gid, бік, opt.color, opt.size), pl.box, a ? a.height / a.width : 1, aspNow());
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
    /* 1 — внутрішній (безкоштовно, у браузері), 2 — PhotoRoom (платний).
       Андрій (07.10): спершу внутрішній, зовнішній — коли той не впорався. */
    var ФОН = [['none', 'Не прибирати'], ['local', '1 · Внутрішній'],
               ['photoroom', '2 · PhotoRoom']];
    function фонHtml(){
      var i = активна();
      if(i < 0 || opt.placeOnly) return '';
      var w = works[i], cur = w.bg || 'none';
      /* Адаптована під нитки — фон уже прибраний підбором (від краю кадру);
         чіпати її далі означало б з'їхати з ниток. */
      if(w.threads) return '';
      return '<div class="mko-bg"><span>Фон роботи' + (works.length > 1 ? ' ' + (i + 1) : '') + ':</span>' +
        ФОН.map(function(f){
          return '<button type="button" class="mko-bg-b' + (f[0] === cur ? ' on' : '') +
            '" data-mko-bg="' + f[0] + '"' + (w.bgBusy ? ' disabled' : '') + '>' + esc(f[1]) + '</button>';
        }).join('') +
        (w.bgBusy ? '<i class="mko-bg-w">' + esc(w.bgNote || 'прибираю…') + '</i>' : '') +
        (!w.bgBusy && w.bg === 'local' ? '<i class="mko-bg-w">не чисто — спробуйте «2 · PhotoRoom»</i>' : '') +
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
      w.bgNote = '';
      try{ out = await removeBg(w.orig, mode, function(t){ w.bgNote = t; малюй(); }); }
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
    /* ── РАМКА = ФОТО ──
       Положення робіт — частки САМОГО ФОТО, а не сірої сцени навколо: саме
       так їх малює мокап і рахує сантиметри. Доти рамкою була сцена, і на
       вертикальному знімку логотип на екрані виходив удвічі більшим, ніж
       лягав у мокап, а витягнутий у сіре поле — зникав. Тому фото лежить
       у власній рамці точно свого розміру, а роботи стоять у ній у
       відсотках: хай сцена міняє розмір як завгодно — роботи їдуть разом
       із фото, а не повз нього. */
    var асп = {};            // пропорції фото кожної сторони (висота/ширина)
    var артГотові = false;   // картинки робіт довантажились — відомі їхні пропорції
    var ro = null;
    function малюй(){
      var body0 = el.querySelector('.mko-body');
      var прокрутка = body0 ? body0.scrollTop : 0;
      var pl = places[бік] || [];
      el.innerHTML =
        '<div class="mko-w is-work">' + шапкаHtml() +
          '<div class="mko-works">' +
            works.map(function(w, i){
              var треба = opt.needThreads && !w.threads;
              return '<span class="mko-wk-w">' +
                '<button type="button" class="mko-wk' + (треба ? ' need' : '') + '" data-mko-w="' + i + '" ' +
                'title="' + esc(w.name || 'робота') + ' — натисніть, щоб покласти на виріб">' +
                '<img draggable="false" src="' + esc(w.url) + '" alt="">' +
                (w.threads ? '<i class="mko-wk-t" title="Адаптовано під нитки">🧵' + w.threads.length + '</i>' : '') +
                '</button>' +
                (треба ? '<button type="button" class="mko-wk-a" data-mko-adapt="' + i + '">Під нитки</button>' : '') +
                (opt.placeOnly ? '' : '<button type="button" class="mko-wk-x" data-mko-wdel="' + i +
                  '" title="Прибрати картинку зовсім — з виробу й зі здачі" aria-label="Прибрати картинку">×</button>') +
                '</span>';
            }).join('') +
            (opt.placeOnly ? '' :
              '<button type="button" class="mko-wk add" data-mko-up>＋<i>завантажити</i></button>') +
          '</div>' +
          '<div data-mko-bgbox>' + фонHtml() + '</div>' +
          '<div class="mko-tabs">' + сторони.map(function(s){
            var n = (places[s.key] || []).length;
            return '<button type="button" class="mko-tab' + (s.key === бік ? ' on' : '') +
              '" data-mko-side="' + esc(s.key) + '">' + esc(s.label) +
              (n ? '<i>' + n + '</i>' : '') + '</button>';
          }).join('') + '</div>' +
          '<div class="mko-body">' +
            '<div class="mko-stage" data-mko-stage>' +
              '<div class="mko-frame" data-mko-frame>' +
                '<img class="mko-base" draggable="false" src="' + esc(сторонаUrl()) + '" alt="">' +
                /* Кут і × є в кожної роботи, видно їх лише в обраної: вибір —
                   це перемкнути клас, а не перебудувати сцену під курсором. */
                pl.map(function(p, i){
                  var w = works[p.work] || {};
                  return '<div class="mko-art' + (i === обране ? ' on' : '') +
                    '" data-mko-p="' + i + '"><img draggable="false" src="' + esc(w.url || '') + '" alt="">' +
                    '<i class="mko-gr" data-mko-grip></i>' +
                    '<button type="button" class="mko-rm" data-mko-rm="' + i + '">×</button>' +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="mko-side">' +
              '<div class="mko-num" data-mko-nums></div>' +
              '<div class="mko-note" data-mko-note></div>' +
              /* Запасний вихід: що б не сталося з положенням — обрана робота
                 одним натиском стає на груди по центру. */
              '<button type="button" class="mko-b mko-center" data-mko-center hidden>↺ У центр</button>' +
              '<div class="mko-acts">' +
                '<button class="mko-b" data-mko-x>Скасувати</button>' +
                '<button class="mko-b pri" data-mko-save>' +
                  (opt.placeOnly ? 'Зберегти розміщення' : 'Надіслати') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      var body1 = el.querySelector('.mko-body');
      if(body1) body1.scrollTop = прокрутка;
      var b = el.querySelector('.mko-base');
      if(b && !(b.complete && b.naturalWidth)) b.onload = влаштуй;
      if(ro) ro.disconnect();
      if(typeof ResizeObserver === 'function'){
        ro = new ResizeObserver(function(){ влаштуй(); });
        ro.observe(el.querySelector('[data-mko-stage]'));
      }
      влаштуй();
    }
    /* Рамку — точно під фото, вписане в сцену. Поки фото вантажиться,
       беремо його відомі пропорції: рамка не схлопується й не стрибає. */
    function влаштуй(){
      var st = el.querySelector('[data-mko-stage]');
      var fr = el.querySelector('[data-mko-frame]');
      var b = el.querySelector('.mko-base');
      if(!st || !fr) return;
      if(b && b.naturalWidth) асп[бік] = b.naturalHeight / b.naturalWidth;
      var a = асп[бік];
      /* Щойно знаємо пропорції фото цієї сторони й робіт — повертаємо в кадр
         усе, що з версії приїхало за його межі. Один раз на сторону. */
      if(a && артГотові && !втиснуто[бік]){
        втиснуто[бік] = 1;
        (places[бік] || []).forEach(втисни);
      }
      var sw = st.clientWidth, sh = st.clientHeight;
      if(a && sw && sh){
        var fw = Math.min(sw, sh / a);
        fr.style.width = Math.floor(fw) + 'px';
        fr.style.height = Math.floor(fw * a) + 'px';
      }
      постав();
    }
    /* Найменша робота — 6% ширини фото: менше вже не схопити мишею, а кут
       і × налазять один на одного. Нашивок, менших за це, ми не шиємо. */
    var МІН = 0.06;
    /* Пропорції роботи: з картинки, а поки вона не довантажилась чи не
       відкрилась — з версії (там вони записані при здачі). */
    function арПро(pl){
      var a = арт[pl.work];
      return (a && a.width) ? a.height / a.width : ((pl && pl.ar > 0) ? pl.ar : 1);
    }
    /* Робота завжди ЦІЛКОМ у кадрі: що вилізло за фото — того не видно й
       не схопити, а в мокап воно однаково не ляже. */
    function втисни(pl){
      var b = pl.box, ar = арПро(pl), a = асп[бік] || 0;
      if(!(b.w > 0)) b.w = 0.26;
      if(!isFinite(b.x)) b.x = 0.5;
      if(!isFinite(b.y)) b.y = 0.34;
      b.w = clamp(b.w, МІН, 1);
      if(a > 0){
        if(b.w * ar / a > 1) b.w = a / ar;
        b.y = clamp(b.y, 0, 1 - b.w * ar / a);
      } else b.y = clamp(b.y, 0, 0.97);
      b.x = clamp(b.x, b.w / 2, 1 - b.w / 2);
    }
    function сторонаUrl(){
      var s = сторони.filter(function(x){ return x.key === бік; })[0];
      return (s && s.url) || '';
    }
    /* Роботи стоять у відсотках рамки-фото: розмір сцени тут не потрібен
       зовсім, тому й розʼїхатись нема чому. */
    function постав(){
      var fr = el.querySelector('[data-mko-frame]');
      if(!fr) return;
      (places[бік] || []).forEach(function(p, i){
        var node = fr.querySelector('[data-mko-p="' + i + '"]');
        if(!node) return;
        node.style.left = ((p.box.x - p.box.w / 2) * 100) + '%';
        node.style.top = (p.box.y * 100) + '%';
        node.style.width = (p.box.w * 100) + '%';
        node.style.aspectRatio = String(1 / арПро(p));
      });
      числа();
    }
    function числа(){
      var nums = el.querySelector('[data-mko-nums]');
      var note = el.querySelector('[data-mko-note]');
      if(!nums || !note) return;
      var pl = (places[бік] || [])[обране];
      var cb = el.querySelector('[data-mko-center]');
      if(cb) cb.hidden = !pl;
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
        note.innerHTML = 'Цей бік виробу не розмічений в «Областях нанесення» (адмінка → товар → ' +
          'зелені лінії верху, низу й країв). Розмістити можна, але сантиметрів не буде: ' +
          'вигадувати їх не можна, за ними шиють.';
        return;
      }
      nums.innerHTML =
        '<div class="mko-n"><span>Ширина нанесення</span><b>' + esc(см(m.wCm)) + '</b></div>' +
        '<div class="mko-n"><span>Висота</span><b>' + esc(см(m.hCm)) + '</b></div>' +
        '<div class="mko-n"><span>Від верху виробу</span><b>' + esc(см(m.topCm)) + '</b></div>' +
        (m.edgeCm != null ? '<div class="mko-n"><span>Від краю виробу</span><b>' + esc(см(m.edgeCm)) + '</b></div>' : '');
      note.innerHTML = 'Рахується під розмір <b>' + esc(opt.size || '—') + '</b>: висота виробу ' +
        esc(см(m.garmentH)) + (m.garmentW ? ', ширина ≈ ' + esc(см(m.garmentW)) : ', краї виробу не виставлені') + '.';
    }

    /* ── Миша, палець, перо ──
       Що тут зламалось і чому так тепер:
       · вибір іншої роботи доти ПЕРЕБУДОВУВАВ усе вікно прямо під час
         натиску — разом із фото й прокруткою; сцена на мить міняла розмір,
         і наступний натиск ішов «крізь» роботу. Тепер вибір — лише клас;
       · кого схопили, рахуємо за тим, що ВИДНО під курсором: обрана має
         перевагу, далі верхня; порожнє місце знімає вибір;
       · курсор захоплюємо на весь рух: відпустили будь-де — рух скінчився.
         А якщо кнопку відпустили там, звідки подія не дійшла, — перший же
         рух без натиснутої кнопки сам закінчує тягання;
       · картинки у вікні браузер не тягає як файли — ні фото, ні роботи. */
    function frac(ev){
      var fr = el.querySelector('[data-mko-frame]');
      var r = fr.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / (r.width || 1),
               y: (ev.clientY - r.top) / (r.height || 1) };
    }
    function підКурсором(cx, cy){
      var fr = el.querySelector('[data-mko-frame]');
      if(!fr) return -1;
      var nodes = fr.querySelectorAll('[data-mko-p]');
      var під = function(n, pad){
        var r = n.getBoundingClientRect();
        return cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad;
      };
      var sel = fr.querySelector('[data-mko-p="' + обране + '"]');
      if(sel && під(sel, 2)) return обране;
      for(var k = nodes.length - 1; k >= 0; k--){
        if(під(nodes[k], 0)) return +nodes[k].getAttribute('data-mko-p');
      }
      return -1;
    }
    function вибір(){
      el.querySelectorAll('[data-mko-p]').forEach(function(n){
        n.classList.toggle('on', +n.getAttribute('data-mko-p') === обране);
      });
      var bg = el.querySelector('[data-mko-bgbox]');
      if(bg) bg.innerHTML = фонHtml();
      числа();
    }
    var drag = null;
    var натискНаФоні = false;
    function down(ev){
      натискНаФоні = ev.target === el;
      if(ev.button != null && ev.button !== 0) return;
      var t = ev.target;
      if(!(t.closest && t.closest('[data-mko-stage]'))) return;
      if(t.closest('[data-mko-rm]')) return;         // × — це клік, не тягання
      var fr = el.querySelector('[data-mko-frame]');
      if(!fr) return;
      ev.preventDefault();
      var grip = t.closest('[data-mko-grip]');
      var gi = grip ? +grip.parentNode.getAttribute('data-mko-p') : -1;
      var i = grip ? gi : підКурсором(ev.clientX, ev.clientY);
      if(i < 0 || !(places[бік] || [])[i]){
        drag = null;
        if(обране !== -1){ обране = -1; вибір(); }
        return;
      }
      if(i !== обране){ обране = i; вибір(); }
      var pl = places[бік][i], f = frac(ev);
      drag = grip
        ? { тип:'size', id: ev.pointerId, i: i, left: pl.box.x - pl.box.w / 2, top: pl.box.y }
        : { тип:'move', id: ev.pointerId, i: i, dx: pl.box.x - f.x, dy: pl.box.y - f.y };
      try{ if(ev.pointerId != null) fr.setPointerCapture(ev.pointerId); }catch(e){}
    }
    function move(ev){
      if(!drag) return;
      if(drag.id != null && ev.pointerId != null && ev.pointerId !== drag.id) return;
      if(ev.pointerType === 'mouse' && ev.buttons === 0){ drag = null; return; }
      var pl = (places[бік] || [])[drag.i];
      if(!pl){ drag = null; return; }
      var f = frac(ev);
      if(drag.тип === 'move'){
        pl.box.x = f.x + drag.dx;
        pl.box.y = f.y + drag.dy;
      } else {
        /* Тягнемо за кут — верхній лівий кут стоїть, ширина йде за мишею,
           висота — за пропорцією файлу. Розтягувати макет непропорційно не
           можна взагалі: це вже не той логотип, який погодив клієнт. */
        var ar = арПро(pl), a = асп[бік] || 0;
        var w = f.x - drag.left;
        if(a > 0) w = Math.max(w, (f.y - drag.top) * a / ar);
        var max = 1 - drag.left;
        if(a > 0) max = Math.min(max, (1 - drag.top) * a / ar);
        w = clamp(w, МІН, Math.max(МІН, max));
        pl.box.w = w; pl.box.x = drag.left + w / 2; pl.box.y = drag.top;
      }
      втисни(pl);
      постав();
    }
    var up = function(ev){
      if(drag && drag.id != null && ev && ev.pointerId != null && ev.pointerId !== drag.id) return;
      drag = null;
    };
    var кинути = function(){ drag = null; };
    var неТягни = function(ev){ ev.preventDefault(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('dragstart', неТягни);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    window.addEventListener('blur', кинути);
    window.addEventListener('resize', влаштуй);

    function прибрати(){ close(); }
    W.off = function(){
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', кинути);
      window.removeEventListener('resize', влаштуй);
      if(ro) ro.disconnect();
    };
    /* Дубль лягає поруч, а не точно поверх: дві однакові картинки одна в
       одній виглядають як одна, і незрозуміло, що саме тягнеш. */
    function нове(work){
      var box = { x:0.5, y:0.34, w:0.26 };
      var тут = places[бік] || [];
      for(var k = 0; k < 12 && тут.some(function(p){
            return Math.abs(p.box.x - box.x) < 0.02 && Math.abs(p.box.y - box.y) < 0.02; }); k++){
        box.x += 0.05; box.y += 0.05;
        if(box.x > 0.8){ box.x = 0.25; }
        if(box.y > 0.75){ box.y = 0.12; }
      }
      var pl = { work: work, box: box };
      втисни(pl);
      places[бік].push(pl);
      обране = places[бік].length - 1;
    }
    el.addEventListener('click', async function(ev){
      var t = ev.target;
      /* Закриваємо кліком по тлі, лише якщо й натиснули на тлі: відпустити
         мишу за вікном посеред тягання — не «закрий усе». */
      if((t === el && натискНаФоні) || (t.closest && t.closest('[data-mko-x]'))) return прибрати();
      /* ЗАЙВУ КАРТИНКУ — ГЕТЬ ЦІЛКОМ (Андрій, 09.10): завантажив не ту,
         поклав іншу, «ту видалив, а вона залишилась і відправилась». × на
         виробі знімав лише нанесення, а сама картинка лишалась у списку робіт
         і їхала у версію та в аркуш клієнту. Тепер × на картинці прибирає її
         звідусіль: зі списку й з усіх сторін виробу. */
      var wdel = t.closest && t.closest('[data-mko-wdel]');
      if(wdel){
        var di = +wdel.getAttribute('data-mko-wdel');
        if(!works[di]) return;
        works.splice(di, 1);
        арт.splice(di, 1);
        Object.keys(places).forEach(function(k){
          places[k] = places[k].filter(function(pl){ return pl.work !== di; });
          places[k].forEach(function(pl){ if(pl.work > di) pl.work--; });
        });
        обране = -1;
        drag = null;
        return малюй();
      }
      var rm = t.closest && t.closest('[data-mko-rm]');
      if(rm){
        places[бік].splice(+rm.getAttribute('data-mko-rm'), 1);
        обране = -1;
        drag = null;
        return малюй();
      }
      var tab = t.closest && t.closest('[data-mko-side]');
      if(tab){
        бік = tab.getAttribute('data-mko-side');
        обране = -1;
        drag = null;
        return малюй();
      }
      var wk = t.closest && t.closest('[data-mko-w]');
      if(wk){
        нове(+wk.getAttribute('data-mko-w'));
        return малюй();
      }
      if(t.closest && t.closest('[data-mko-center]')){
        var cp = (places[бік] || [])[обране];
        if(!cp) return;
        cp.box.x = 0.5; cp.box.y = 0.3;
        if(!(cp.box.w > 0) || cp.box.w > 0.6) cp.box.w = 0.26;
        втисни(cp);
        return постав();
      }
      if(t.closest && t.closest('[data-mko-up]')) return вантажити();
      var ad = t.closest && t.closest('[data-mko-adapt]');
      if(ad && opt.onAdapt){
        var ai = +ad.getAttribute('data-mko-adapt');
        var nw = null;
        try{ nw = await opt.onAdapt(works[ai]); }catch(e){ console.error(e); }
        if(!nw || !nw.url) return;
        works[ai] = nw;
        арт[ai] = await img(nw.url);
        return малюй();
      }
      var bgb = t.closest && t.closest('[data-mko-bg]');
      if(bgb) return фон(bgb.getAttribute('data-mko-bg'));
      if(t.closest && t.closest('[data-mko-save]')) return зберегти();
    });
    /* Стрілки посувають обрану роботу (Shift — більшим кроком): коли мишею
       незручно чи робота дрібна. У полях вводу стрілки свої — не чіпаємо. */
    var esk = function(ev){
      /* Escape закриває лише це вікно, а не ще й картку замовлення під ним. */
      if(ev.key === 'Escape'){ ev.stopPropagation(); ev.preventDefault(); return прибрати(); }
      var крок = { ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1] }[ev.key];
      if(!крок || drag) return;
      var tg = ev.target && ev.target.tagName;
      if(tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      var pl = (places[бік] || [])[обране];
      if(!pl) return;
      ev.preventDefault();
      var k = ev.shiftKey ? 0.02 : 0.005;
      pl.box.x += крок[0] * k; pl.box.y += крок[1] * k;
      втисни(pl);
      постав();
    };
    document.addEventListener('keydown', esk, true);
    W.esk = esk;
    /* Для перевірок: що зараз лежить і що обрано — лише читати. */
    W.peek = function(){
      return JSON.parse(JSON.stringify({ side: бік, sel: обране, places: places,
        asp: асп[бік] || 0, ar: (places[бік] || []).map(арПро), dragging: !!drag }));
    };

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
      нове(works.length - 1);
      малюй();
    }

    async function зберегти(){
      var btn = el.querySelector('[data-mko-save]');
      var c = рахунок();
      if(!c.нанесень) return say('Покладіть хоч одну роботу на виріб');
      /* Без адаптації під нитки не здаємо: на мокап і далі йде лише вона. */
      if(opt.needThreads){
        var неАд = {};
        Object.keys(places).forEach(function(k){ places[k].forEach(function(pl){
          var w = works[pl.work]; if(w && !w.threads) неАд[pl.work] = 1; }); });
        if(Object.keys(неАд).length) return say('Спершу адаптуйте роботу під нитки — кнопка «Під нитки» під нею');
      }
      /* НІЧОГО НЕ ГУБИМО МОВЧКИ. Доти робота, картинку якої не вдалося
         відкрити для мокапа, просто випадала з версії разом зі своїм
         положенням, а сторона з невідкритим фото — цілком. Виходила версія без
         розкладки, і наступне «✎ Розміщення» відкривало порожній виріб. Тепер
         кажемо, що не так, і нічого не зберігаємо — розкладка лишається у вікні. */
      for(var ci = 0; ci < сторони.length; ci++){
        var cs = сторони[ci];
        var cpl = places[cs.key] || [];
        if(!cpl.length) continue;
        if(!кадри[cs.key]) кадри[cs.key] = await img(cs.url);
        if(!кадри[cs.key]) return say('Фото сторони «' + cs.label + '» не відкрилось — мокап без нього не зібрати. ' +
          'Перезавантажте фото в каталозі товарів; розкладка у вікні лишилась.');
        for(var cj = 0; cj < cpl.length; cj++){
          var cw = cpl[cj].work;
          if(!арт[cw]) арт[cw] = await img((works[cw] || {}).url);
          if(!арт[cw]) return say('Робота «' + ((works[cw] || {}).name || 'робота') + '» не відкрилась — мокап без неї не зібрати. ' +
            'Розкладка у вікні лишилась; спробуйте ще раз або перезавантажте роботу.');
        }
      }
      /* У здачу — лише картинки, що лежать на виробі. Знята з виробу
         (× на нанесенні) і забута в списку не має їхати клієнту. */
      var вжиті = [], номер = {};
      Object.keys(places).forEach(function(k){ places[k].forEach(function(pl){
        if(номер[pl.work] === undefined && works[pl.work]){ номер[pl.work] = вжиті.length; вжиті.push(works[pl.work]); }
      }); });
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
          /* Сантиметри — для КОЖНОЇ сторони, а не лише для відкритої, і з
             розмітки саме цієї сторони в «Областях нанесення». */
          var zS = zoneOf(opt.gid, s.key, opt.color, opt.size);
          var asp = (base.naturalHeight || base.height) / (base.naturalWidth || base.width);
          for(var pi = 0; pi < pl.length; pi++){
            var p = pl[pi];
            var a = арт[p.work];
            if(!a) continue;
            var ar = a.height / a.width;
            var w = p.box.w * cv.width;
            x.drawImage(a, p.box.x * cv.width - w / 2, p.box.y * cv.height, w, w * ar);
            var m = measure(zS, p.box, ar, asp);
            var r1 = function(v){ return Math.round(v * 10) / 10; };
            мірки.push({ work: номер[p.work], name:(works[p.work] || {}).name || '',
                         x:p.box.x, y:p.box.y, w:p.box.w, ar: ar, ref:'top',
                         wCm: m ? r1(m.wCm) : 0,
                         hCm: m ? r1(m.hCm) : 0,
                         topCm: m ? r1(m.topCm) : 0,
                         edgeCm: (m && m.edgeCm != null) ? r1(m.edgeCm) : null,
                         sideCm: (m && m.sideCm != null) ? r1(m.sideCm) : 0,
                         garmentW: m ? r1(m.garmentW) : 0 });
          }
          out.push({ side:s.key, label:s.label, png: cv.toDataURL('image/png'),
                     places: мірки });
        }
        /* Розмітку тут більше не пишемо: вона одна — в «Областях нанесення». */
        прибрати();
        opt.onDone({ works: вжиті, sides: out, size: opt.size || '',
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
    артГотові = true;
    /* Пропорції робіт тепер відомі — ставимо їх точно (і повертаємо в кадр). */
    влаштуй();
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
    return out.slice(0, 6);
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
  /* КАРТКА «МАКЕТ НА УЗГОДЖЕННЯ» (Андрій, 02.10).
     Угорі в ряд — мокапи всіх сторін і ракурсів (скільки є, стільки рамок),
     під ними рядом менші плитки — самі ескізи. Підписів над картинками
     немає. Знизу ліворуч — характеристики виробу з картки товару й опис
     замовлення, праворуч — коротке попередження. Номер — тьмяніший і
     тонший: він потрібен, але не має тягнути погляд. Картка не
     розтягується: кількість картинок міняє ширину рамок, а не висоту. */
  function linesOf(x, rows, w, font){
    var out = [];
    rows.forEach(function(t){ wrap(x, t, w, font).forEach(function(l){ out.push(l); }); });
    return out;
  }
  /* КАРТКА «МАКЕТ НА УЗГОДЖЕННЯ» — ВИГЛЯД ВІД 06.10 (Андрій).

     Угорі в ряд рамки ОДНАКОВОГО розміру: спершу картинки (самі роботи),
     потім мокапи. Та сама картинка на переді й спині — одна картинка й два
     мокапи; різні — дві картинки й два мокапи. Окремої дрібної плитки з
     логотипом більше немає: картинка і є перша рамка.

     Знизу ліворуч — опис без повторів (модель з кольором і матеріалом,
     розмір, кількість, нанесення з розміром), праворуч — примітка звичайним
     сірим текстом, без плашки. */
  function artBox(im){
    if(im.__lqArt) return im.__lqArt;
    var t = { x:0, y:0, w:im.width, h:im.height };
    try{
      var c = document.createElement('canvas');
      var k = Math.min(200 / im.width, 200 / im.height, 1);
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      var q = c.getContext('2d'); q.drawImage(im, 0, 0, c.width, c.height);
      var d = q.getImageData(0, 0, c.width, c.height).data;
      var x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for(var y = 0; y < c.height; y++) for(var xx = 0; xx < c.width; xx++){
        if(d[(y * c.width + xx) * 4 + 3] < 24) continue;
        if(xx < x0) x0 = xx; if(xx > x1) x1 = xx; if(y < y0) y0 = y; if(y > y1) y1 = y;
      }
      if(x1 >= 0){
        /* Запас у піксель зменшеної копії — щоб не зʼїсти тонкий край. */
        x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
        x1 = Math.min(c.width - 1, x1 + 1); y1 = Math.min(c.height - 1, y1 + 1);
        t = { x: x0 / k, y: y0 / k, w: Math.min(im.width - x0 / k, (x1 - x0 + 1) / k),
              h: Math.min(im.height - y0 / k, (y1 - y0 + 1) / k) };
      }
    }catch(e){}
    im.__lqArt = t;
    return t;
  }
  function framedArt(x, im, a, b, w, h){
    if(!im) return;
    x.save();
    round(x, a, b, w, h, 16); x.clip();
    x.fillStyle = '#F4F5F7'; x.fillRect(a, b, w, h);
    /* ЕСКІЗ — ЦІЛКОМ (08.10). Андрій: «баг підрізає ескіз» — від «èva»
       лишалось «va». Межі брались «за кольором кутів» (LQCards.trim, для
       мокапів на папері): коли логотип торкається кута кадру, кут — це
       сам логотип, і половина малюнка ставала «фоном». Ескіз же — не фото
       на папері: обрізаємо лише ПРОЗОРІ поля; непрозорий кадр — увесь. */
    var t = artBox(im);
    var k = Math.min(w * 0.78 / t.w, h * 0.78 / t.h);
    var dw = t.w * k, dh = t.h * k;
    x.drawImage(im, t.x, t.y, t.w, t.h, a + (w - dw) / 2, b + (h - dh) / 2, dw, dh);
    x.restore();
  }
  async function card(data){
    var mocks = (data.mocks && data.mocks.length ? data.mocks : [data.mock]).filter(Boolean);
    var works = (data.works && data.works.length ? data.works : [data.art]).filter(Boolean);
    // Та сама картинка на кількох сторонах — одна рамка
    var бачив = {};
    works = works.filter(function(u){ var k = String(u); if(бачив[k]) return false; бачив[k] = 1; return true; });
    var роб = [], мок = [];
    for(var j = 0; j < works.length; j++){ var iw = await img(works[j]); if(iw) роб.push(iw); }
    for(var i = 0; i < mocks.length; i++){ var im = await img(mocks[i]); if(im) мок.push(im); }
    var рамки = роб.map(function(im){ return { im: im, art: true }; })
      .concat(мок.map(function(im){ return { im: im, art: false }; }));
    var проба = document.createElement('canvas').getContext('2d');
    var top = 52, головаH = 40, gap = 16;
    var innerW = DOC_W - 128;
    var n = Math.max(1, рамки.length), cw = (innerW - gap * (n - 1)) / n;
    var cellH = Math.round(Math.min(560, cw * 1.12));
    /* Низ (Андрій, 06.10) — три колонки під тонкою лінією:
         ВИРІБ (модель великим, під нею сірим колір · матеріал) │
         РОЗМІР · КІЛЬКІСТЬ │ НАНЕСЕННЯ (місце ліворуч, розмір праворуч).
       Примітка — компактним сірим блоком з «i» на всю ширину внизу. */
    var d = data.desc;
    if(!d){
      // Старий формат даних: рядки [підпис, значення]
      var rows = (data.nums || []).filter(function(r){ return r && r[1] != null && r[1] !== '' && r[1] !== '—'; });
      d = { model: (rows.filter(function(r){ return !r[0]; })[0] || [])[1] || '', sub: '',
            row: rows.filter(function(r){ return r[0] && !/нанесення/i.test(r[0]); }),
            apps: rows.filter(function(r){ return /нанесення/i.test(r[0] || ''); }).map(function(r){ return String(r[1]); }) };
    }
    var FM = '700 22px Inter, system-ui, sans-serif', FS = '400 16px Inter, system-ui, sans-serif',
        FL = '400 16px Inter, system-ui, sans-serif', FV = '600 16px Inter, system-ui, sans-serif',
        FN = '400 13px Inter, system-ui, sans-serif';
    var колG = 40, кол1 = Math.round(innerW * 0.34), кол2 = Math.round(innerW * 0.22), кол3 = innerW - кол1 - кол2 - колG * 2;
    var FLb = '600 11px Inter, system-ui, sans-serif';
    var subL = d.sub ? wrap(проба, String(d.sub), кол1, FS) : [];
    var c1H = 18 + 30 + subL.length * 22;
    var c2H = 18 + 30;
    var c3H = 18 + (d.apps || []).length * 28;
    var описH = Math.max(c1H, c2H, c3H) + 4;
    var опис = [{ h: описH, draw: function(y0){
      var X1 = 64, X2 = X1 + кол1 + колG, X3 = X2 + кол2 + колG;
      x.fillStyle = '#E6E9EE';
      x.fillRect(X2 - колG / 2, y0, 1, описH - 4); x.fillRect(X3 - колG / 2, y0, 1, описH - 4);
      var cap = function(t, px){ x.fillStyle = '#9AA5B5'; x.font = FLb; x.fillText(t, px, y0 + 10); };
      cap('ВИРІБ', X1);
      x.fillStyle = '#0F2034'; x.font = FM; x.fillText(String(d.model || ''), X1, y0 + 42);
      x.fillStyle = '#6B7280'; x.font = FS; subL.forEach(function(l, k){ x.fillText(l, X1, y0 + 66 + k * 22); });
      (d.row || []).forEach(function(r, k){
        var px = X2 + k * Math.round(кол2 / 2);
        cap(String(r[0]).toUpperCase(), px);
        x.fillStyle = '#0F2034'; x.font = FM; x.fillText(String(r[1]), px, y0 + 42);
      });
      cap('НАНЕСЕННЯ', X3);
      (d.apps || []).forEach(function(t, k){
        var m = String(t).match(/^(.*?)\s+(\d[\d,.]*\s*×\s*[\d,.]+\s*см)$/);
        var yy = y0 + 42 + k * 28;
        x.fillStyle = '#0F2034'; x.font = FV; x.fillText(m ? m[1] : String(t), X3, yy);
        if(m){ x.textAlign = 'right'; x.fillStyle = '#3B4656'; x.fillText(m[2], X3 + кол3, yy); x.textAlign = 'left'; }
      });
    } }];
    var нота = data.note ? wrap(проба, String(data.note), innerW - 60, FN) : [];
    var нотаH = нота.length ? 20 + нота.length * 19 : 0;
    var H = top + головаH + 20 + cellH + 28 + 1 + 24 + описH + (нотаH ? 22 + нотаH : 0) + 44;
    var cv = document.createElement('canvas');
    cv.width = DOC_W; cv.height = H;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, DOC_W, H);
    var y = top + 28;
    x.textAlign = 'left';
    x.fillStyle = '#0F2034'; x.font = '700 30px Inter, system-ui, sans-serif';
    x.fillText(String(data.title || 'Макет на узгодження'), 64, y);
    if(data.no){
      x.textAlign = 'right';
      x.fillStyle = '#A9B2C0'; x.font = '400 16px Inter, system-ui, sans-serif';
      x.fillText(String(data.no), DOC_W - 64, y);
      x.textAlign = 'left';
    }
    y = top + головаH + 20;
    рамки.forEach(function(r, k){
      var a = 64 + k * (cw + gap);
      if(r.art) framedArt(x, r.im, a, y, cw, cellH);
      else framed(x, r.im, a, y, cw, cellH);
    });
    y += cellH + 28;
    x.fillStyle = '#E6E9EE'; x.fillRect(64, y, innerW, 1);
    y += 1 + 24;
    опис.forEach(function(r){ r.draw(y); y += r.h; });
    if(нотаH){
      y += 22;
      x.fillStyle = '#F4F5F7'; round(x, 64, y, innerW, нотаH, 10); x.fill();
      x.strokeStyle = '#9AA5B5'; x.lineWidth = 1.4; x.beginPath(); x.arc(64 + 24, y + нотаH / 2, 7, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#9AA5B5'; x.font = '700 10px Inter, system-ui, sans-serif'; x.textAlign = 'center';
      x.fillText('i', 64 + 24, y + нотаH / 2 + 3.5); x.textAlign = 'left';
      x.fillStyle = '#6B7280'; x.font = FN;
      нота.forEach(function(t, k){ x.fillText(t, 64 + 42, y + 10 + 14 + k * 19); });
    }
    return cv.toDataURL('image/png');
  }
  /* Версія вигляду картки: аркуші, зібрані раніше, перезбираються. */
  var CARD_V = 5;   // 08.10: ескіз цілком (artBox) — старі картки перезбираються
  /* ══════════ ВИРОБНИЧА КАРТА ВИШИВКИ ══════════

     Андрій: «зліва оператор бачить ДЕ і ЯК розмістити вишивку, справа
     зверху — ЯК ВОНА МАЄ ВИГЛЯДАТИ, справа знизу — ЯКІ НИТКИ ВЗЯТИ».
     Аркуш A4 горизонтально, одна карта — одне нанесення. Зверху лише номер.

     Ліворуч — сам мокап сторони (фото виробу з роботою там, де її
     погодили), і просто на ньому червоні лінії в міліметрах: від верху
     виробу, від бокового краю, ширина й висота вишивки, центральна вісь і
     зона дизайну. Міліметри — з розмітки «Областей нанесення» під розмір
     замовлення, тож на S і на XL вони різні, як і має бути. Під фото —
     товар, колір, розмір.

     Праворуч угорі — сама робота, велика, на кольорі виробу, без жодної
     лінії: еталон, з яким звіряють готову вишивку. Під нею — нитки
     квадратами з номерами. */
  var EMB = { W: 2480, H: 1754, M: 104, gap: 56, line: '#D9DCE1', ink: '#0B0D10',
              soft: '#6B7280', red: '#E5322D', font: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif' };
  function мм(cm){ return Math.round((+cm || 0) * 10) + ' мм'; }
  function embBlock(x, a, b, w, h){
    x.save(); round(x, a, b, w, h, 22);
    x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = EMB.line; x.lineWidth = 2; x.stroke(); x.restore();
  }
  function embArrow(x, xa, ya, xb, yb){
    x.save();
    x.strokeStyle = EMB.red; x.fillStyle = EMB.red; x.lineWidth = 3.5; x.setLineDash([]);
    x.beginPath(); x.moveTo(xa, ya); x.lineTo(xb, yb); x.stroke();
    var ang = Math.atan2(yb - ya, xb - xa), r = 20;
    [[xa, ya, ang + Math.PI], [xb, yb, ang]].forEach(function(q){
      x.beginPath(); x.moveTo(q[0], q[1]);
      x.lineTo(q[0] - r * Math.cos(q[2] - 0.38), q[1] - r * Math.sin(q[2] - 0.38));
      x.lineTo(q[0] - r * Math.cos(q[2] + 0.38), q[1] - r * Math.sin(q[2] + 0.38));
      x.closePath(); x.fill();
    });
    x.restore();
  }
  function embDash(x, xa, ya, xb, yb, dash, alpha, width){
    x.save();
    x.strokeStyle = EMB.red; x.globalAlpha = alpha || 1; x.lineWidth = width || 2.5;
    x.setLineDash(dash || [16, 10]);
    x.beginPath(); x.moveTo(xa, ya); x.lineTo(xb, yb); x.stroke();
    x.restore();
  }
  /* Число на білій плашці з червоною рамкою: читається і на чорній кепці,
     і на білій футболці. */
  function embPill(x, text, cx, cy, align){
    x.save();
    x.font = '700 36px ' + EMB.font;
    var tw = x.measureText(text).width, pw = tw + 32, ph = 56;
    var l = align === 'left' ? cx : align === 'right' ? cx - pw : cx - pw / 2;
    round(x, l, cy - ph / 2, pw, ph, 14);
    x.fillStyle = '#fff'; x.fill();
    x.strokeStyle = EMB.red; x.lineWidth = 2.5; x.stroke();
    x.fillStyle = EMB.red; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(text, l + 16, cy + 2);
    x.restore();
  }
  function embFit(x, im, a, b, w, h){
    if(!im) return;
    var k = Math.min(w / im.width, h / im.height);
    var ww = im.width * k, hh = im.height * k;
    x.drawImage(im, a + (w - ww) / 2, b + (h - hh) / 2, ww, hh);
  }
  function embCut(x, text, w){
    text = String(text == null ? '' : text);
    if(x.measureText(text).width <= w) return text;
    while(text.length > 1 && x.measureText(text + '…').width > w) text = text.slice(0, -1);
    return text + '…';
  }
  /* Ліва схема: мокап, підрізаний до виробу, і лінії поверх. */
  function embScheme(x, мокап, z, sp, a, b, w, h){
    x.save();
    round(x, a, b, w, h, 16); x.clip();
    var C = window.LQCards || {};
    x.fillStyle = (мокап && C.tint && C.tint(мокап)) || '#F4F5F7';
    x.fillRect(a, b, w, h);
    if(!мокап){
      x.fillStyle = EMB.soft; x.font = '500 34px ' + EMB.font; x.textAlign = 'center';
      x.fillText('Мокапу немає', a + w / 2, b + h / 2);
      x.restore(); return;
    }
    var iw = мокап.width, ih = мокап.height, asp = ih / iw;
    var есть = sp && +sp.w > 0 && isFinite(+sp.x) && isFinite(+sp.y);
    var ar = есть ? (+sp.ar || ((+sp.hCm && +sp.wCm) ? sp.hCm / sp.wCm : 1)) : 1;
    var box = есть ? { l: +sp.x - sp.w / 2, t: +sp.y, w: +sp.w, h: sp.w * ar / asp } : null;
    var краї = z && z.R > z.L;
    /* Кадр — виріб із запасом під підписи, і так, щоб вишивка точно влізла. */
    var c = { l: 0, t: 0, r: 1, b: 1 };
    if(z && z.B > z.T){
      c.t = Math.max(0, z.T - 0.07); c.b = Math.min(1, z.B + 0.03);
      if(краї){ c.l = Math.max(0, z.L - 0.12); c.r = Math.min(1, z.R + 0.12); }
    }
    if(box){
      c.l = Math.max(0, Math.min(c.l, box.l - 0.1)); c.r = Math.min(1, Math.max(c.r, box.l + box.w + 0.14));
      c.t = Math.max(0, Math.min(c.t, box.t - 0.08)); c.b = Math.min(1, Math.max(c.b, box.t + box.h + 0.1));
    }
    var sx = c.l * iw, sy = c.t * ih, sw = (c.r - c.l) * iw, sh = (c.b - c.t) * ih;
    var k = Math.min(w / sw, h / sh);
    var dx = a + (w - sw * k) / 2, dy = b + (h - sh * k) / 2;
    x.drawImage(мокап, sx, sy, sw, sh, dx, dy, sw * k, sh * k);
    var P = function(fx, fy){ return [dx + (fx * iw - sx) * k, dy + (fy * ih - sy) * k]; };
    var m = (z && box) ? measure(z, { x: +sp.x, y: +sp.y, w: +sp.w }, ar, asp) : null;
    var від = m || (sp ? { wCm: +sp.wCm || 0, hCm: +sp.hCm || 0, topCm: +sp.topCm || 0,
                            edgeCm: sp.edgeCm != null ? +sp.edgeCm : null } : null);
    /* Опорні лінії: верх виробу, боковий край, центральна вісь. */
    if(z && z.B > z.T){
      var tl = P(краї ? z.L - 0.07 : 0.02, z.T), tr = P(краї ? z.R + 0.07 : 0.98, z.T);
      embDash(x, tl[0], tl[1], tr[0], tr[1]);
      if(краї){
        var e0 = P(z.L, z.T - 0.03), e1 = P(z.L, z.B);
        embDash(x, e0[0], e0[1], e1[0], e1[1]);
        var a0 = P((z.L + z.R) / 2, z.T - 0.04), a1 = P((z.L + z.R) / 2, z.B);
        embDash(x, a0[0], a0[1], a1[0], a1[1], [34, 10, 6, 10], 0.75, 2.5);
      }
    }
    if(!box){ x.restore(); return; }
    var p0 = P(box.l, box.t), p1 = P(box.l + box.w, box.t + box.h);
    var bl = p0[0], bt = p0[1], br = p1[0], bb = p1[1];
    /* Зона дизайну. */
    x.save();
    x.fillStyle = 'rgba(229,50,45,.07)'; x.fillRect(bl, bt, br - bl, bb - bt);
    x.restore();
    embDash(x, bl, bt, br, bt, [14, 8], 1, 3); embDash(x, br, bt, br, bb, [14, 8], 1, 3);
    embDash(x, br, bb, bl, bb, [14, 8], 1, 3); embDash(x, bl, bb, bl, bt, [14, 8], 1, 3);
    if(!від){ x.restore(); return; }
    /* Від верху виробу — вертикаль по центру вишивки. */
    if(z && z.B > z.T){
      var ty = P(0, z.T)[1], mx = (bl + br) / 2;
      if(bt - ty > 30){
        embArrow(x, mx, ty + 2, mx, bt - 2);
        if(bt - ty > 90) embPill(x, мм(від.topCm), mx + 18, (ty + bt) / 2, 'left');
        else embPill(x, мм(від.topCm), mx + 18, ty - 40, 'left');
      }
    }
    /* Від бокового краю — горизонталь на рівні середини вишивки. */
    if(краї && від.edgeCm != null){
      var ex = P(z.L, 0)[0], my = (bt + bb) / 2;
      if(bl - ex > 30){
        embArrow(x, ex + 2, my, bl - 2, my);
        if(bl - ex > 200) embPill(x, мм(від.edgeCm), (ex + bl) / 2, my - 46);
        else embPill(x, мм(від.edgeCm), ex - 14, my, 'right');
      }
    }
    /* Ширина — під вишивкою, висота — праворуч. */
    var wy = bb + 48;
    embDash(x, bl, bb + 6, bl, wy + 16, [], 1, 2); embDash(x, br, bb + 6, br, wy + 16, [], 1, 2);
    embArrow(x, bl + 2, wy, br - 2, wy);
    embPill(x, мм(від.wCm), (bl + br) / 2, wy + 52);
    if(від.hCm > 0){
      var hx = br + 48;
      embDash(x, br + 6, bt, hx + 16, bt, [], 1, 2); embDash(x, br + 6, bb, hx + 16, bb, [], 1, 2);
      embArrow(x, hx, bt + 2, hx, bb - 2);
      embPill(x, мм(від.hCm), hx + 18, (bt + bb) / 2, 'left');
    }
    x.restore();
  }
  /* data = { no, mock, zone, spot, work, garmentHex, threads:[{code,hex}],
              specs:[[назва, значення]…] } → PNG (data:URL). */
  async function prodCard(data){
    try{ if(document.fonts && document.fonts.load){
      await document.fonts.load('700 40px Inter'); await document.fonts.load('500 40px Inter'); } }catch(e){}
    var мокап = await img(data.mock);
    var робота = await img(data.work);
    var cv = document.createElement('canvas');
    cv.width = EMB.W; cv.height = EMB.H;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#F6F7F9'; x.fillRect(0, 0, EMB.W, EMB.H);
    var M = EMB.M, G = EMB.gap;
    /* Шапка: лише номер. */
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = EMB.soft; x.font = '500 52px ' + EMB.font;
    var підпис = '№ замовлення:';
    x.fillText(підпис, M, M + 72);
    var pw = x.measureText(підпис).width;
    x.fillStyle = EMB.ink; x.font = '800 92px ' + EMB.font;
    x.fillText(String(data.no || '—').replace(/^#/, ''), M + pw + 26, M + 76);
    var y0 = M + 140;
    var bodyH = EMB.H - M - y0;
    var inner = EMB.W - 2 * M - G;
    var lw = Math.round(inner * 0.56), rw = inner - lw;
    /* Ліворуч: схема + характеристики. */
    embBlock(x, M, y0, lw, bodyH);
    var specsH = 190, pad = 36;
    embScheme(x, мокап, data.zone, data.spot, M + pad, y0 + pad, lw - 2 * pad, bodyH - specsH - pad);
    x.fillStyle = EMB.line; x.fillRect(M + pad, y0 + bodyH - specsH, lw - 2 * pad, 2);
    var specs = (data.specs || []).filter(function(r){ return r && r[0]; });
    /* Назва товару — найдовша, їй половина рядка; решта ділять другу. */
    var full = lw - 2 * pad, sx = M + pad;
    specs.forEach(function(r, i){
      var colW = specs.length === 1 ? full : i === 0 ? full * 0.46 : full * 0.54 / (specs.length - 1);
      x.fillStyle = EMB.soft; x.font = '600 26px ' + EMB.font;
      try{ x.letterSpacing = '2px'; }catch(e){}
      x.fillText(String(r[0]).toUpperCase(), sx, y0 + bodyH - specsH + 68);
      try{ x.letterSpacing = '0px'; }catch(e){}
      x.fillStyle = EMB.ink; x.font = '700 44px ' + EMB.font;
      x.fillText(embCut(x, r[1] || '—', colW - 30), sx, y0 + bodyH - specsH + 130);
      sx += colW;
    });
    /* Праворуч угорі: робота на кольорі виробу. */
    var rx = M + lw + G, th = Math.round((bodyH - G) * 0.6), bh = bodyH - G - th;
    embBlock(x, rx, y0, rw, th);
    x.save(); round(x, rx + 2, y0 + 2, rw - 4, th - 4, 20); x.clip();
    x.fillStyle = /^#[0-9a-f]{3,8}$/i.test(String(data.garmentHex || '')) ? data.garmentHex : '#EEF0F3';
    x.fillRect(rx, y0, rw, th);
    embFit(x, робота, rx + 80, y0 + 80, rw - 160, th - 160);
    x.restore();
    /* Праворуч унизу: нитки. */
    var ny = y0 + th + G;
    embBlock(x, rx, ny, rw, bh);
    var нитки = (data.threads || []).filter(function(t){ return t && t.code; });
    x.fillStyle = EMB.soft; x.font = '600 26px ' + EMB.font;
    try{ x.letterSpacing = '2px'; }catch(e){}
    x.fillText('НИТКИ' + (нитки.length ? ' · ' + нитки.length : ''), rx + 44, ny + 64);
    try{ x.letterSpacing = '0px'; }catch(e){}
    var areaW = rw - 88, areaH = bh - 64 - 60;
    var S = 176, gap = 40, лейбл = 64;
    var cols, rows;
    for(var guard = 0; guard < 12; guard++){
      cols = Math.max(1, Math.floor((areaW + gap) / (S + gap)));
      rows = Math.ceil(нитки.length / cols);
      if(rows * (S + лейбл) + (rows - 1) * 14 <= areaH || S < 56) break;
      S = Math.round(S * 0.86); gap = Math.round(gap * 0.9); лейбл = Math.round(лейбл * 0.92);
    }
    if(!нитки.length){
      x.fillStyle = EMB.soft; x.font = '500 30px ' + EMB.font;
      x.fillText('Робота не адаптована під нитки', rx + 44, ny + 130);
    }
    нитки.forEach(function(t, i){
      var cx = rx + 44 + (i % cols) * (S + gap), cy = ny + 96 + Math.floor(i / cols) * (S + лейбл + 14);
      round(x, cx, cy, S, S, Math.round(S * 0.12));
      x.fillStyle = /^#[0-9a-f]{3,8}$/i.test(String(t.hex || '')) ? t.hex : '#ccc'; x.fill();
      x.strokeStyle = 'rgba(0,0,0,.16)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = EMB.ink; x.font = '700 ' + Math.round(Math.max(24, S * 0.26)) + 'px ' + EMB.font;
      x.textAlign = 'center';
      x.fillText(String(t.code), cx + S / 2, cy + S + Math.round(лейбл * 0.72));
      x.textAlign = 'left';
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
  /* Лічильник прибирань фону — щоб бачити, скільки пішло на PhotoRoom і
     скільки зекономив внутрішній. Рахує робоче місце (адмінка); там, де
     його немає (квіз, каталог), — мовчки нічого. */
  function bgCount(kind){ try{ if(HOST.bgCount) HOST.bgCount(kind); }catch(e){} }
  /* Внутрішній: рівне тло — швидкий алгоритм; інакше — нейромережа в
     браузері (loomiq-bg.js); вона не змогла — знову швидкий. */
  function removeBgInternal(d, onNote){
    var B = window.LQBg;
    if(!B) return removeBgLocal(d).then(function(r){ bgCount('simple'); return r; });
    return B.plain(d).catch(function(){ return true; }).then(function(рівне){
      if(рівне) return removeBgLocal(d).then(function(r){ bgCount('simple'); return r; });
      if(onNote && !B.ready()) onNote('перший раз — завантажую модель (~100 МБ)…');
      return B.smart(d, onNote).then(function(r){ bgCount('smart'); return r; })
        .catch(function(e){
          console.warn('розумне прибирання фону', e);
          return removeBgLocal(d).then(function(r){ bgCount('simple'); return r; });
        });
    });
  }
  /* mode: 'none' | 'local' (внутрішній) | 'photoroom'. Повертає data-URL або вихідну адресу. */
  function removeBg(src, mode, onNote){
    if(mode !== 'local' && mode !== 'photoroom') return Promise.resolve(src);
    return toDataUrl(src).then(function(d){
      return mode === 'photoroom'
        ? removeBgPhotoroom(d).then(function(r){ bgCount('photoroom'); return r; })
        : removeBgInternal(d, onNote);
    });
  }

  window.LQMock = {
    set host(h){ HOST = h || {}; },
    get host(){ return HOST; },
    open: open, openWork: openWork, peek: function(){ return W && W.peek ? W.peek() : null; }, card: card, cardV: CARD_V, prodCard: prodCard, close: close,
    /* Назовні віддаємо й перерахунок: панель показує ті самі сантиметри в
       рядку під мокапом, і рахувати їх удруге своїм способом означає
       рано чи пізно показати інше число. */
    widthCm: widthCm, calOf: calOf, см: см, removeBg: removeBg, measure: measure, zoneOf: zoneOf
  };
})();
