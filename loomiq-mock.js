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
  async function card(data){
    var W2 = 1600;
    var макет = await img(data.art);
    var мокап = await img(data.mock);
    /* ВИСОТА РАХУЄТЬСЯ, А НЕ ЗАШИТА.

       Аркуш росте: у когось чотири числа розміщення, у когось жодного; у
       когось два рядки складу, у когось чотири; примітка буває на рядок і
       на чотири. Фіксовані 1000 px означали б, що в одних випадках унизу
       пів аркуша порожнечі, а в інших примітка просто не влазить і
       мовчки зникає — а вона саме та, заради якої аркуш і роблять. */
    var смуга = (data.wideCm > 0 && data.artCm > 0);
    var рядківНоти = 0;
    var проба = document.createElement('canvas').getContext('2d');
    if(data.note) рядківНоти = wrap(проба, String(data.note), W2 - 112 - 36,
                                    '400 15px Inter, system-ui, sans-serif').length;
    var H2 = 146 + 520 + 48
      + (смуга ? 80 : 0)
      + ((data.nums || []).length ? 112 : 0)
      + 12 + Math.min(4, (data.lines || []).length) * 27 + 8
      + (рядківНоти ? 22 + рядківНоти * 22 + 18 : 0)
      + 40;
    var cv = document.createElement('canvas');
    cv.width = W2; cv.height = H2;
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, W2, H2);

    x.fillStyle = '#0F2034';
    x.font = '700 30px Inter, system-ui, sans-serif';
    x.fillText(String(data.title || 'Макет'), 56, 64);
    x.fillStyle = '#7C8798';
    x.font = '400 17px Inter, system-ui, sans-serif';
    x.fillText(String(data.sub || ''), 56, 94);
    x.fillStyle = '#7C3AED'; x.fillRect(56, 118, W2 - 112, 3);

    /* Дві картинки поруч і однакового зросту: їх порівнюють очима, і різний
       розмір рамок читається як різна важливість. */
    var top = 146, cellH = 520, cellW = (W2 - 112 - 24) / 2;
    [[макет, 'Макет', 56], [мокап, 'Мокап на виробі', 56 + cellW + 24]].forEach(function(p){
      x.fillStyle = '#F5F6F8'; round(x, p[2], top, cellW, cellH, 18); x.fill();
      fit(x, p[0], p[2] + 22, top + 46, cellW - 44, cellH - 68);
      x.fillStyle = '#9AA5B5'; x.font = '700 13px Inter, system-ui, sans-serif';
      x.fillText(String(p[1]).toUpperCase(), p[2] + 22, top + 30);
    });

    var y = top + cellH + 48;
    /* ══════════ ШИРИНА НАНЕСЕННЯ ПРОТИ ШИРИНИ ВИРОБУ ══════════

       «23,7 см» саме по собі нічого не каже: багато це чи мало, залежить
       від того, на чому воно лежить. На дитячій футболці це через увесь
       перед, на XXL — скромний значок посередині.

       Тому малюємо пропорцію: сіра смуга — виріб, кольорова всередині —
       нанесення. Одного погляду досить, щоб сказати «завелике» або «ок», а
       числа поруч лишаються для тих, хто шитиме. */
    if(data.wideCm > 0 && data.artCm > 0){
      var bw = W2 - 112, bh = 46;
      x.fillStyle = '#EDEFF3'; round(x, 56, y, bw, bh, 12); x.fill();
      var частка = Math.max(0.02, Math.min(1, data.artCm / data.wideCm));
      var aw = bw * частка;
      /* Нанесення там, де воно й стоїть на виробі: зсув від центру теж
         видно, бо «по центру» і «зліва на грудях» це різні макети. */
      var зсув = (+data.sideCm || 0) / data.wideCm * bw;
      var ax = 56 + (bw - aw) / 2 + зсув;
      ax = Math.max(56, Math.min(56 + bw - aw, ax));
      x.fillStyle = '#7C3AED'; round(x, ax, y + 6, aw, bh - 12, 8); x.fill();
      x.fillStyle = '#7C8798'; x.font = '600 13px Inter, system-ui, sans-serif';
      x.fillText('ШИРИНА ВИРОБУ ' + String(data.wideCm).replace('.', ',') + ' СМ', 56, y - 10);
      x.textAlign = 'right';
      x.fillText('НАНЕСЕННЯ ' + String(data.artCm).replace('.', ',') + ' СМ · ' +
                 Math.round(частка * 100) + '%', 56 + bw, y - 10);
      x.textAlign = 'left';
      y += bh + 34;
    }
    /* Розміщення — рядком великих чисел. Саме їх шукають у цьому аркуші, і
       шукати їх у суцільному тексті означає не знайти. */
    var числа = data.nums || [];
    if(числа.length){
      var cw = (W2 - 112 - (числа.length - 1) * 16) / числа.length;
      числа.forEach(function(n, i){
        var a = 56 + i * (cw + 16);
        x.fillStyle = '#F5F6F8'; round(x, a, y, cw, 92, 14); x.fill();
        x.fillStyle = '#7C8798'; x.font = '600 13px Inter, system-ui, sans-serif';
        x.fillText(n[0], a + 18, y + 32);
        x.fillStyle = '#0F2034'; x.font = '700 30px Inter, system-ui, sans-serif';
        x.fillText(n[1], a + 18, y + 70);
      });
      y += 112;
    }
    /* Трохи повітря перед текстом: рядок, приліплений до низу плиток із
       числами, читається як їхній підпис, а не як окрема річ. */
    y += 12;
    x.fillStyle = '#0F2034'; x.font = '600 18px Inter, system-ui, sans-serif';
    (data.lines || []).slice(0, 4).forEach(function(t, i){
      x.fillStyle = i ? '#4A5768' : '#0F2034';
      x.font = (i ? '400 17px ' : '600 19px ') + 'Inter, system-ui, sans-serif';
      x.fillText(String(t).slice(0, 140), 56, y + 8 + i * 27);
      y += 0;
    });
    y += 8 + Math.min(4, (data.lines || []).length) * 27;

    /* ══════════ ПРИМІТКА ДЛЯ КЛІЄНТА ══════════

       Те, що ми й доти писали в кожному повідомленні руками: колір на
       екрані відрізняється від тканини, монітори показують по-різному,
       розташування — приблизне до сантиметра. Писати це щоразу заново
       означає одного разу не написати — і саме тоді отримати «а в мене
       інший відтінок».

       Тут воно їде разом із картинкою, тож губитись немає де. Текст лежить
       у налаштуваннях: він міняється частіше за код. */
    if(data.note){
      var nw = W2 - 112;
      x.fillStyle = '#F7F4FF';
      var рядки = wrap(x, String(data.note), nw - 36, '400 15px Inter, system-ui, sans-serif');
      var nh = 22 + рядки.length * 22;
      round(x, 56, y, nw, nh, 12); x.fill();
      x.fillStyle = '#4C2189'; x.font = '400 15px Inter, system-ui, sans-serif';
      рядки.forEach(function(t, i){ x.fillText(t, 74, y + 30 + i * 22); });
    }
    return cv.toDataURL('image/png');
  }

  window.LQMock = {
    set host(h){ HOST = h || {}; },
    get host(){ return HOST; },
    open: open, card: card, close: close,
    /* Назовні віддаємо й перерахунок: панель показує ті самі сантиметри в
       рядку під мокапом, і рахувати їх удруге своїм способом означає
       рано чи пізно показати інше число. */
    widthCm: widthCm, calOf: calOf, см: см
  };
})();
