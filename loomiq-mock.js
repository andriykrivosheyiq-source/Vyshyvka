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
      return '<div class="mko-h"><b>Здати роботу · ' + esc(opt.name || 'виріб') + '</b>' +
        '<span class="mko-h-s">' + c.нанесень + ' ' +
          (c.нанесень === 1 ? 'нанесення' : 'нанесень') +
          (c.робіт && c.робіт !== c.нанесень ? ' · робіт ' + c.робіт : '') + '</span>' +
        '<button class="mko-x" data-mko-x>×</button></div>';
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
            '<button type="button" class="mko-wk add" data-mko-up>＋<i>завантажити</i></button>' +
          '</div>' +
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
                '<button class="mko-b pri" data-mko-save>Надіслати</button>' +
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
          for(var pi = 0; pi < pl.length; pi++){
            var p = pl[pi];
            var a = арт[p.work];
            if(!a) continue;
            var ar = a.height / a.width;
            var w = p.box.w * cv.width;
            x.drawImage(a, p.box.x * cv.width - w / 2, p.box.y * cv.height, w, w * ar);
            var m = (s.key === бік) ? міри(p) : null;
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
        btn.disabled = false; btn.textContent = 'Надіслати';
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
    if(!works.length) вантажити();
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
  /* Акцентний колір — із самого макета. Той самий прийом, що в картці
     пропозиції: аркуш береться в кольори роботи, а не в наші фірмові, і
     виглядає як частина замовлення, а не як бланк. */
  function accentOf(im){
    if(!im) return '#7C3AED';
    try{
      var c = document.createElement('canvas');
      var n = 24; c.width = n; c.height = n;
      var x = c.getContext('2d');
      x.drawImage(im, 0, 0, n, n);
      var d = x.getImageData(0, 0, n, n).data;
      var best = null, bestS = 0;
      for(var i = 0; i < d.length; i += 4){
        if(d[i + 3] < 200) continue;
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if(mx < 40 || mx > 235) continue;          // майже чорне й майже біле — не колір
        var s2 = (mx - mn) / (mx || 1);
        if(s2 > bestS){ bestS = s2; best = [r, g, b]; }
      }
      if(!best || bestS < 0.22) return '#7C3AED';
      return 'rgb(' + best[0] + ',' + best[1] + ',' + best[2] + ')';
    }catch(e){ return '#7C3AED'; }
  }
  /* ══════════════════════════════════════════════════════════════════════
     АРКУШ МАКЕТА

     Стиль узятий із картки комерційної пропозиції — тієї, яку вже качають у
     B2B. Це не наслідування заради наслідування: обидва аркуші виходять від
     нас до клієнта й до цеху, часто в одному листуванні, і різний вигляд
     читався б як різні компанії. Шапка з нашими контактами, акцентна риска,
     підписи капітеллю, значення великим — усе те саме, з тими самими
     розмірами й кольорами.

     Відрізняється те, що відрізняється по суті: тут не ціни, а робота —
     макет, мокап на виробі, розміри нанесення й примітка.
     ══════════════════════════════════════════════════════════════════════ */
  var DOC_W = 1240;
  function header(x, logo, accent, title, contacts){
    x.fillStyle = '#fff'; x.fillRect(0, 0, DOC_W, 168);
    if(logo) fit(x, logo, 64, 44, 150, 80);
    else {
      x.fillStyle = accent; x.font = '700 34px Inter, system-ui, sans-serif';
      x.textAlign = 'left'; x.fillText('Loomiq', 64, 96);
    }
    var lines = (contacts || []).slice(0, 4);
    x.textAlign = 'right';
    x.fillStyle = '#0F2034'; x.font = '700 15px Inter, system-ui, sans-serif';
    x.fillText('Loomiq · виробництво мерчу', DOC_W - 64, 56);
    x.fillStyle = '#7C8798'; x.font = '400 13px Inter, system-ui, sans-serif';
    lines.forEach(function(t, i){ x.fillText(String(t), DOC_W - 64, 80 + i * 19); });
    x.textAlign = 'left';
    x.fillStyle = accent; x.fillRect(64, 148, DOC_W - 128, 3);
    x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
    x.fillText(String(title || '').toUpperCase(), 64, 140);
  }
  /* Підпис капітеллю, значення великим — рядок характеристик, як у КП. */
  function specs(x, items, y, accent){
    var colW = (DOC_W - 128) / Math.max(1, Math.min(items.length, 5));
    items.slice(0, 5).forEach(function(s, i){
      var sx = 64 + i * colW;
      x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
      x.fillText(String(s[0]).toUpperCase(), sx, y);
      x.fillStyle = i === 0 ? accent : '#0F2034';
      x.font = '600 16px Inter, system-ui, sans-serif';
      var t = String(s[1]), maxW = colW - 18;
      if(x.measureText(t).width > maxW){
        while(t.length > 1 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        t += '…';
      }
      x.fillText(t, sx, y + 26);
    });
    return y + 62;
  }
  async function card(data){
    var макет = await img(data.art);
    var мокап = await img(data.mock);
    var accent = accentOf(макет);
    /* Висота рахується, а не зашита: у когось пʼять чисел розміщення, у
       когось жодного; примітка буває на рядок і на чотири. */
    var смуга = (data.wideCm > 0 && data.artCm > 0);
    var проба = document.createElement('canvas').getContext('2d');
    var рядківНоти = data.note
      ? wrap(проба, String(data.note), DOC_W - 128 - 40, '400 15px Inter, system-ui, sans-serif').length
      : 0;
    var cellH = 520;
    /* Висота — та сама арифметика, що й малювання нижче, крок у крок. Доти
       вона рахувалась «приблизно з запасом», і аркуш закінчувався смугою
       порожнечі в сотню пікселів: дрібниця, але саме з таких дрібниць
       документ і виглядає зробленим абияк. */
    var H = 168 + 44 + cellH + 46
      + ((data.nums || []).length ? 62 + 12 : 0)
      + (смуга ? 14 + 46 + 36 : 0)
      + (рядківНоти ? 26 + рядківНоти * 23 : 0)
      + 36;
    var cv = document.createElement('canvas');
    cv.width = DOC_W; cv.height = H;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, DOC_W, H);

    header(x, макет, accent, data.title || 'Макет на погодження', data.contacts);

    var y = 168 + 44;
    /* Дві картинки поруч і однакового зросту: їх порівнюють очима, і різний
       розмір рамок читається як різна важливість. */
    var cellW = (DOC_W - 128 - 24) / 2;
    [[макет, 'Макет', 64], [мокап, 'Мокап на виробі', 64 + cellW + 24]].forEach(function(p){
      x.fillStyle = '#F7F9FC'; round(x, p[2], y, cellW, cellH, 16); x.fill();
      fit(x, p[0], p[2] + 24, y + 48, cellW - 48, cellH - 72);
      x.fillStyle = '#9AA5B5'; x.font = '600 12px Inter, system-ui, sans-serif';
      x.fillText(String(p[1]).toUpperCase(), p[2] + 24, y + 32);
    });
    y += cellH + 46;

    if((data.nums || []).length){
      y = specs(x, data.nums, y, accent);
      x.strokeStyle = '#ECEFF3'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(64, y - 18); x.lineTo(DOC_W - 64, y - 18); x.stroke();
      y += 12;
    }

    /* ШИРИНА НАНЕСЕННЯ ПРОТИ ШИРИНИ ВИРОБУ.

       «23,7 см» саме по собі нічого не каже: багато це чи мало, залежить від
       того, на чому воно лежить. На дитячій футболці це через увесь перед,
       на XXL — скромний значок посередині. */
    if(смуга){
      var bw = DOC_W - 128, bh = 46;
      x.fillStyle = '#7C8798'; x.font = '600 12px Inter, system-ui, sans-serif';
      x.fillText('ШИРИНА ВИРОБУ ' + String(data.wideCm).replace('.', ',') + ' СМ', 64, y);
      var частка = Math.max(0.02, Math.min(1, data.artCm / data.wideCm));
      x.textAlign = 'right';
      x.fillText('НАНЕСЕННЯ ' + String(data.artCm).replace('.', ',') + ' СМ · ' +
                 Math.round(частка * 100) + '%', DOC_W - 64, y);
      x.textAlign = 'left';
      y += 14;
      x.fillStyle = '#EDEFF3'; round(x, 64, y, bw, bh, 12); x.fill();
      var aw = bw * частка;
      var зсув = (+data.sideCm || 0) / data.wideCm * bw;
      var ax = Math.max(64, Math.min(64 + bw - aw, 64 + (bw - aw) / 2 + зсув));
      x.fillStyle = accent; round(x, ax, y + 6, aw, bh - 12, 8); x.fill();
      y += bh + 36;
    }

    /* ══════════ ПРИМІТКА ДЛЯ КЛІЄНТА ══════════
       Те, що доти писали руками в кожному повідомленні: колір на екрані
       відрізняється від тканини. Писати це щоразу заново означає одного разу
       не написати — і саме тоді почути «а в мене інший відтінок». */
    if(рядківНоти){
      var рядки = wrap(x, String(data.note), DOC_W - 128 - 40,
                       '400 15px Inter, system-ui, sans-serif');
      var nh = 26 + рядки.length * 23;
      x.fillStyle = '#F7F9FC'; round(x, 64, y, DOC_W - 128, nh, 14); x.fill();
      x.fillStyle = accent; x.fillRect(64, y, 3, nh);
      x.fillStyle = '#4A5768'; x.font = '400 15px Inter, system-ui, sans-serif';
      рядки.forEach(function(t, i){ x.fillText(t, 88, y + 34 + i * 23); });
    }
    return cv.toDataURL('image/png');
  }


  window.LQMock = {
    set host(h){ HOST = h || {}; },
    get host(){ return HOST; },
    open: open, openWork: openWork, card: card, close: close,
    /* Назовні віддаємо й перерахунок: панель показує ті самі сантиметри в
       рядку під мокапом, і рахувати їх удруге своїм способом означає
       рано чи пізно показати інше число. */
    widthCm: widthCm, calOf: calOf, см: см
  };
})();
