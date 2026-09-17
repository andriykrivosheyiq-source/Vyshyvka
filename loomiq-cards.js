/* ══════════════════════════════════════════════════════════════════════
   КАРТКИ ДЛЯ DIRECT — другий формат виводу тієї самої пропозиції

   Менеджер склав пропозицію: товари, мокапи, кількість, ціни, термін. Далі
   половину клієнтів веде не посилання, а листування — і туди треба
   картинку. Доти її робили руками в сторонньому редакторі: заново шукали
   мокап, заново вписували ціну, і кожна правка в КП лишала в Direct старе
   число.

   Тому картки — це НЕ другий конструктор. Це той самий набір даних,
   виведений інакше:

       один склад пропозиції → веб-КП  або  картинки для Direct

   Нічого не дублюється: ні товари, ні ціни, ні кількості, ні мокапи, ні
   розрахунки. Менеджер керує тільки показом — шаблон, склад, заголовок,
   опис. Змінив ціну в «Збиранні» — картка перемалювалась, бо власних чисел
   у неї немає.

   Малюємо на полотні, а не html2canvas: сторонньої бібліотеки тут не буде
   (та й мережа в збірці до неї не дотягується), а головне — preview й
   готовий файл мусять бути ОДНИМ кодом. Інакше «як побачить клієнт» рано
   чи пізно розійдеться з тим, що завантажилось.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* 1.6:1 — верхня межа горизонтального формату. У Direct картинка
     показується цілком, і виробу дістається максимум місця. Ширина 1920 —
     щоб на сітківці не було видно піксельної сходинки на дрібному тексті. */
  var W = 1920, H = 1200;
  var PAD = 96;

  var SANS  = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';

  /* ── Шаблони ─────────────────────────────────────────────────────────
     Один нейтральний і далі одразу ніші. Абстрактних назв на кшталт
     «Editorial» тут більше немає: менеджер обирає не стиль верстки, а те,
     кому надсилає. «Картка для СТО» — це зрозуміло; «Corporate» — це треба
     відкрити й подивитись. */
  var TEMPLATES = [
    { id:'minimal', name:'Мінімалістичний', note:'Білий фон, багато повітря, великий виріб' },
    { id:'horeca',  name:'HoReCa',          note:'Кафе, ресторани, кавʼярні' },
    { id:'auto',    name:'СТО',             note:'Автосервіс, шиномонтаж, мийка' },
    { id:'medical', name:'Медицина',        note:'Клініки, лабораторії, аптеки' },
    { id:'office',  name:'Офіс',            note:'Корпоратив, строга подача' }
  ];
  var THEME = {
    minimal: { bg:'#FFFFFF', panel:'#F4F6F9', ink:'#0F2034', dim:'#7C8798',
               line:'#E4E9F0', accent:'', shape:false },
    horeca:  { bg:'#EDF4EF', panel:'#FFFFFF', ink:'#16332A', dim:'rgba(22,51,42,.55)',
               line:'rgba(22,51,42,.14)', accent:'#2F7A5B', shape:true },
    /* СТО — єдина темна тема, і це не примха: у майстерні картку дивляться
       з телефона в засвіченому приміщенні, а темне тло з білою панеллю
       тримає виріб краще за світле. Заодно вона не схожа на решту. */
    auto:    { bg:'#1E1C1A', panel:'#FFFFFF', ink:'#F6F2EE', dim:'rgba(246,242,238,.58)',
               line:'rgba(246,242,238,.20)', accent:'#F0762B', shape:true },
    medical: { bg:'#EAF2F8', panel:'#FFFFFF', ink:'#12283A', dim:'rgba(18,40,58,.55)',
               line:'rgba(18,40,58,.14)', accent:'#1C6FA8', shape:true },
    office:  { bg:'#FFFFFF', panel:'#F5F7FA', ink:'#101828', dim:'#667085',
               line:'#D7DEE8', accent:'#3B4B7A', shape:false, table:true }
  };
  function themeOf(tpl, accent){
    var base = THEME[tpl] || THEME.minimal;
    var t = {};
    Object.keys(base).forEach(function(k){ t[k] = base[k]; });
    // У нейтрального шаблону акцент бере колір логотипа клієнта: картка має
    // виглядати його матеріалом. У нішевих колір задає сама ніша.
    if(!t.accent) t.accent = accent || '#E8590C';
    t.display = SANS; t.body = SANS;
    return t;
  }

  /* Які поля можна прибрати з картки. Ціна потрібна не завжди: буває, що в
     Direct спершу показують сам виріб, а числа називають словами. */
  var FIELDS = [
    { id:'sub',   name:'Колір і нанесення' },
    { id:'about', name:'Опис виробу' },
    { id:'sizes', name:'Розміри' },
    { id:'qty',   name:'Кількість' },
    { id:'unit',  name:'Ціна за штуку' },
    { id:'sum',   name:'Загальна сума' },
    { id:'term',  name:'Термін' },
    { id:'warn',  name:'Застереження' }
  ];

  /* Застереження — те саме, що клієнт бачить у пропозиції під «Про кольори
     та розмір нанесення». Картку пересилають далі й дивляться з телефона,
     де колір передається як завгодно, тож сказати це треба тут, а не тільки
     на сторінці. Коротше, ніж у КП: на картці це виноска, а не розділ. */
  var WARN = 'Кольори на екрані передаються по-різному — відтінок на виробі ' +
             'може трохи відрізнятись. Пропорції нанесення змінюються від розміру ' +
             'до розміру: на фото показано M.';

  /* ══════════ СКЛАД КАРТОК ══════════
     Збирається сам, із позицій пропозиції. Менеджер не «створює картку» —
     він може хіба прибрати зайву.

     Кожен варіант іде СВОЄЮ карткою: у Direct надсилають картинки по одній,
     і виріб, стиснутий до половини кадру заради сусіда, втрачає рівно те,
     заради чого картку й шлють. */
  function buildCards(offer, cfg){
    offer = offer || {};
    cfg = cfg || {};
    var by = cfg.by || {};
    var term = +(offer.terms || {}).deadlineDays || 0;
    var out = [];

    var pics = function(it){ return (it.mockups || []).filter(Boolean); };
    /* Ракурси, які показуємо на картці: СТОРОНИ З НАНЕСЕННЯМ. Одне
       нанесення — один знімок, три (перед, спина, рукав) — три. Доти
       картка показувала один-єдиний мокап, і спина з рукавом, за які
       клієнт платить, на картинку не потрапляли взагалі. */
    var shotsOf = function(it){
      var views = (it.views || []).filter(function(v){ return v && v.show !== false && v.img; });
      var out2 = [];
      (it.prints || []).forEach(function(p){
        var side = p.side || '';
        var v = views.filter(function(x){ return x.side === side; })[0];
        var u = v ? v.img : '';
        if(u && out2.indexOf(u) < 0) out2.push(u);
      });
      if(!out2.length) out2 = views.map(function(v){ return v.img; });
      if(!out2.length) out2 = pics(it);
      return out2.slice(0, 3);
    };
    // «Колір · Вишивка» — без розмірів: кількість і так стоїть числом нижче,
    // і повторювати її рядком означає сказати те саме двічі
    var subOf = function(it){
      return [it.color, it.print].filter(Boolean).join(' · ');
    };
    var card = function(id, kind, it){
      var own = by[id] || {};
      var all = pics(it), shots = shotsOf(it);
      /* Обраний менеджером мокап стає ПЕРШИМ, а не єдиним: решта сторін
         однаково потрібні. */
      if(own.pic && shots.indexOf(own.pic) < 0) shots = [own.pic].concat(shots).slice(0, 3);
      else if(own.pic) shots = [own.pic].concat(shots.filter(function(u){ return u !== own.pic; }));
      return {
        id: id, kind: kind, type: 'item',
        name: own.title || it.name || 'Позиція',
        sub: subOf(it),
        about: own.note != null ? own.note : (it.recoNote || it.about || ''),
        sizes: it.sizes || '',
        qty: +it.qty || 0,
        unit: +it.unitPrice || 0,
        sum: +it.price || (+it.unitPrice || 0) * (+it.qty || 0),
        term: term,
        shots: shots, pics: all,
        pic: (own.pic && all.indexOf(own.pic) >= 0) ? own.pic : (shots[0] || all[0] || ''),
        hidden: !!(cfg.hidden || {})[id]
      };
    };

    (offer.items || []).forEach(function(it, i){ out.push(card('main:' + i, 'main', it)); });
    (offer.variants || []).forEach(function(it, i){ out.push(card('variant:' + i, 'variant', it)); });

    /* Рекомендовані — однією карткою на всіх: це не пропозиція взяти
       кожного, а питання «чим доповнити». Чотири позиції — межа, за якою
       плитки стають дрібнішими за виріб на них.

       Коли рекомендованих більше, вибирає менеджер. Доти зайві просто
       мовчки не потрапляли на картку — і не було видно ні того, що їх
       відкинуто, ні як поставити інші. */
    var pool = (offer.reco || []).filter(function(r){ return r && r.name; });
    if(pool.length){
      var own = by['reco'] || {};
      var picked = Array.isArray(own.pick)
        ? own.pick.filter(function(i){ return pool[i]; })
                  .sort(function(a, b){ return a - b; }).slice(0, 4)
        : [];
      if(!picked.length) picked = pool.map(function(r, i){ return i; }).slice(0, 4);
      out.push({
        id: 'reco', kind: 'reco', type: 'set',
        /* «Можемо доповнити комплект» — це про нас. «До цього зазвичай
           беруть» — про клієнта й про те, що так роблять інші; на цьому
           питанні рішення й ухвалюють. */
        name: own.title || 'До цього зазвичай беруть',
        note: own.note || '',
        term: term,
        items: picked.map(function(i){
          var r = pool[i];
          return { name: r.name || '', unit: +r.unitPrice || 0,
                   qty: +r.qty || 0, pic: pics(r)[0] || '',
                   /* Плитка з самою назвою нічого не пояснює: «кепка» —
                      яка, з чим, навіщо. Беремо підпис менеджера, а немає
                      його — опис виробу. */
                   note: r.recoNote || r.about || '',
                   sub: [r.color, r.print].filter(Boolean).join(' · ') };
        }),
        pool: pool.map(function(r, i){
          return { i: i, name: r.name || '', on: picked.indexOf(i) >= 0 };
        }),
        max: 4,
        hidden: !!(cfg.hidden || {})['reco']
      });
    }
    /* Переставляти картки більше нічим — і не треба: порядок задає сам
       склад пропозиції. Але пропозиції, у яких його колись переставили,
       мають малюватись як були: збережений порядок ми поважаємо, просто
       нового вже не складають. Картка, якої в тому списку немає, стає в
       кінець, а не зникає. */
    var want = Array.isArray(cfg.order) ? cfg.order : [];
    if(!want.length) return out;
    var rank = {};
    want.forEach(function(id, i){ rank[id] = i; });
    return out.map(function(c, i){ return { c: c, i: i }; })
      .sort(function(a, b){
        var ra = rank[a.c.id], rb = rank[b.c.id];
        if(ra == null && rb == null) return a.i - b.i;
        if(ra == null) return 1;
        if(rb == null) return -1;
        return ra - rb;
      })
      .map(function(x){ return x.c; });
  }

  /* ══════════ ДРІБНИЦІ МАЛЮВАННЯ ══════════ */
  function loadImg(src){
    return new Promise(function(res){
      if(!src) return res(null);
      var im = new Image();
      /* Без цього полотно «бруднішає» чужою картинкою й не віддає файл
         зовсім: мокапи лежать у хмарі, а не поруч зі сторінкою. */
      im.crossOrigin = 'anonymous';
      im.onload = function(){ res(im); };
      im.onerror = function(){ res(null); };
      im.src = src;
    });
  }
  function money(n){
    return Math.round(+n || 0).toLocaleString('uk-UA').replace(/ /g, ' ') + ' грн';
  }
  function rr(x, X, Y, w, h, r){
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + w, Y, X + w, Y + h, r);
    x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r);
    x.arcTo(X, Y, X + w, Y, r);
    x.closePath();
  }
  // Вписати картинку в прямокутник цілком — виріб не можна кадрувати
  function fit(x, img, X, Y, w, h){
    if(!img) return;
    var k = Math.min(w / img.width, h / img.height);
    var iw = img.width * k, ih = img.height * k;
    x.drawImage(img, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih);
  }
  function wrap(x, text, maxW, maxLines){
    var words = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [], line = '';
    for(var i = 0; i < words.length; i++){
      var t = line ? line + ' ' + words[i] : words[i];
      if(x.measureText(t).width > maxW && line){ lines.push(line); line = words[i]; }
      else line = t;
      if(maxLines && lines.length === maxLines){ line = ''; break; }
    }
    if(line) lines.push(line);
    if(maxLines && lines.length > maxLines) lines = lines.slice(0, maxLines);
    return lines;
  }
  // Розріджений капітеллю надпис — ним підписані всі дрібні мітки
  function eyebrow(x, text, X, Y, color, size){
    x.fillStyle = color;
    x.font = '700 ' + (size || 20) + 'px ' + SANS;
    var s = String(text || '').toUpperCase(), cx = X;
    for(var i = 0; i < s.length; i++){
      x.fillText(s[i], cx, Y);
      cx += x.measureText(s[i]).width + (size || 20) * 0.12;
    }
    return cx - X;
  }
  /* Зменшити шрифт, доки рядок не влізе. Числа тут різної довжини — «20 шт»
     і «7 робочих днів» стоять в одній колонці, — і задавати один кегль на
     всіх означає, що довше значення полізе на сусіда. */
  function fitFont(x, text, maxW, size, weight, family){
    var s = size;
    while(s > 13){
      x.font = weight + ' ' + s + 'px ' + family;
      if(x.measureText(text).width <= maxW) break;
      s -= 2;
    }
    return s;
  }
  /* Рядок «підпис ліворуч — число праворуч». Підпис міряємо на місці, і
     число вписуємо в те, що лишилось: інакше довгий підпис і довге число
     сходяться посередині. */
  function factRow(x, t, f, X, right, y){
    var lw = eyebrow(x, f[0], X, y, t.dim, 19);
    var big = f[2];
    var s = fitFont(x, f[1], right - X - lw - 32, big ? 46 : 38, big ? '800' : '700', t.body);
    x.textAlign = 'right';
    x.fillStyle = big ? t.accent : t.ink;
    x.font = (big ? '800 ' : '700 ') + s + 'px ' + t.body;
    x.fillText(f[1], right, y + 6);
    x.textAlign = 'left';
  }
  function placeholder(x, X, Y, w, h, ink){
    x.fillStyle = ink;
    x.globalAlpha = 0.28;
    x.font = '600 30px ' + SANS;
    x.textAlign = 'center';
    x.fillText('Макет буде додано', X + w / 2, Y + h / 2);
    x.textAlign = 'left';
    x.globalAlpha = 1;
  }

  /* Акцент беремо з логотипа клієнта: картка має виглядати його матеріалом,
     а не нашим бланком. Колір занадто блідий чи майже сірий до акценту не
     годиться — на ньому не прочитається сума. */
  function accentFrom(img, fallback){
    fallback = fallback || '#0F2034';
    if(!img) return fallback;
    try{
      var c = document.createElement('canvas');
      c.width = c.height = 24;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0, 24, 24);
      var d = x.getImageData(0, 0, 24, 24).data;
      var r = 0, g = 0, b = 0, n = 0;
      for(var i = 0; i < d.length; i += 4){
        if(d[i + 3] < 128) continue;                 // прозоре не рахуємо
        var mx = Math.max(d[i], d[i+1], d[i+2]), mn = Math.min(d[i], d[i+1], d[i+2]);
        if(mx - mn < 24 && mx > 200) continue;       // майже білий фон логотипа
        r += d[i]; g += d[i+1]; b += d[i+2]; n++;
      }
      if(!n) return fallback;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      var L = (r * 299 + g * 587 + b * 114) / 1000;
      if(L > 190) return fallback;                    // світле — на білому зникне
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }catch(e){ return fallback; }
  }

  /* Футер. Картку пересилають далі — по ній має бути зрозуміло, чия вона й
     до якої пропозиції належить. Підписуємось тим самим брендом, від якого
     пішла сама пропозиція: у картці замовлення є перемикач Loomiq / Stvory,
     і два різні підписи на тих самих даних — це рівно те непорозуміння, від
     якого той перемикач і заводили. */
  function brandName(offer){
    var b = (offer || {}).brand;
    return (b && (b.name || b.tagline)) ? String(b.name || '') : '';
  }
  function footer(x, t, offer){
    x.fillStyle = t.dim;
    x.font = '400 22px ' + t.body;
    var left = 'Комерційна пропозиція' + (offer.orderId ? ' № ' + offer.orderId : '');
    x.fillText(left, PAD, H - 46);
    var b = brandName(offer);
    if(b){
      x.textAlign = 'right';
      x.fillText(b, W - PAD, H - 46);
      x.textAlign = 'left';
    }
  }

  /* Рядки чисел — спільні на всі шаблони: це той самий зміст, і збиратись
     він має в одному місці. Розкладка вирішує лише, де їх покласти. */
  function factsOf(card, show){
    var out = [];
    if(show('qty') && card.qty) out.push(['Кількість', card.qty + ' шт', false]);
    if(show('unit') && card.unit) out.push(['Ціна за штуку', money(card.unit), false]);
    if(show('sum') && card.sum) out.push(['Загальна сума', money(card.sum), true]);
    if(show('term') && card.term) out.push(['Термін', card.term + ' робочих днів', false]);
    return out;
  }

  /* ══════════ РАКУРСИ ══════════
     Скільки сторін із нанесенням — стільки й знімків. Один займає панель
     цілком; два стають поруч; три — великий ліворуч і два дрібніші
     стовпчиком. Так спина й рукав, за які клієнт платить, нарешті видно. */
  function drawShots(x, imgs, X, Y, w, h, t){
    imgs = (imgs || []).filter(Boolean);
    if(!imgs.length){ placeholder(x, X, Y, w, h, t.ink); return; }
    if(imgs.length === 1){ fit(x, imgs[0], X, Y, w, h); return; }
    var gap = 26;
    if(imgs.length === 2){
      var cw = (w - gap) / 2;
      fit(x, imgs[0], X, Y, cw, h);
      fit(x, imgs[1], X + cw + gap, Y, cw, h);
      return;
    }
    var bw = w * 0.64 - gap / 2, sw = w * 0.36 - gap / 2;
    var sh = (h - gap) / 2;
    fit(x, imgs[0], X, Y, bw, h);
    fit(x, imgs[1], X + bw + gap, Y, sw, sh);
    fit(x, imgs[2], X + bw + gap, Y + sh + gap, sw, sh);
  }

  /* ══════════ РОЗКЛАДКА-АРКУШ ══════════
     Виріб на панелі ліворуч, підписи й числа праворуч. Права колонка
     вирівнюється по ЦЕНТРУ висоти цілим блоком: доти назва стояла зверху,
     числа знизу, а посередині лишалась діра на пів картки. */
  function paintSheet(x, card, t, imgs, show, o){
    o = o || {};
    var panelW = 900, panelH = H - PAD * 2 - 40;
    if(t.shape){
      x.fillStyle = t.accent;
      x.globalAlpha = 0.10;
      x.beginPath(); x.arc(W - 220, -80, 620, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }
    x.fillStyle = t.panel;
    rr(x, PAD, PAD, panelW, panelH, 28); x.fill();
    drawShots(x, imgs, PAD + 50, PAD + 50, panelW - 100, panelH - 100, t);

    var X = PAD + panelW + 84, right = W - PAD, maxW = right - X;
    var logo = o.logo, logoH = logo ? 46 : 0;

    x.font = '800 70px ' + t.display;
    var nameLines = wrap(x, card.name, maxW, 3);
    x.font = '400 27px ' + t.body;
    var subLines = (show('sub') && card.sub) ? wrap(x, card.sub, maxW, 2) : [];
    x.font = '400 26px ' + t.body;
    var aboutLines = (show('about') && card.about) ? wrap(x, card.about, maxW, 3) : [];
    var sizes = (show('sizes') && card.sizes) ? String(card.sizes) : '';
    var facts = factsOf(card, show);
    x.font = '400 19px ' + t.body;
    var warnLines = show('warn') ? wrap(x, WARN, maxW, 3) : [];

    var headH = (logoH ? logoH + 26 : 0) + nameLines.length * 74 +
                (subLines.length ? 42 + (subLines.length - 1) * 36 : 0) +
                (aboutLines.length ? 44 + (aboutLines.length - 1) * 34 : 0) +
                (sizes ? 38 : 0);
    var factsH = facts.length ? 48 + (facts.length - 1) * 84 : 0;
    var warnH = warnLines.length ? 44 + (warnLines.length - 1) * 26 : 0;
    var y = Math.max(PAD + 20, Math.round((H - (headH + 86 + factsH + warnH)) / 2));

    if(logo){
      var lk = Math.min(200 / logo.width, logoH / logo.height);
      x.drawImage(logo, X, y, logo.width * lk, logo.height * lk);
      y += logoH + 26;
    }
    x.fillStyle = t.ink; x.font = '800 70px ' + t.display;
    nameLines.forEach(function(ln){ y += 74; x.fillText(ln, X, y); });
    if(subLines.length){
      y += 42; x.fillStyle = t.dim; x.font = '400 27px ' + t.body;
      subLines.forEach(function(ln, i){ x.fillText(ln, X, y + i * 36); });
      y += (subLines.length - 1) * 36;
    }
    if(aboutLines.length){
      y += 44; x.fillStyle = t.ink; x.font = '400 26px ' + t.body;
      aboutLines.forEach(function(ln, i){ x.fillText(ln, X, y + i * 34); });
      y += (aboutLines.length - 1) * 34;
    }
    if(sizes){
      y += 38; x.fillStyle = t.dim; x.font = '600 24px ' + t.body;
      x.fillText(sizes, X, y);
    }
    if(facts.length){
      y += 86;
      x.strokeStyle = t.line; x.lineWidth = 2;
      x.beginPath(); x.moveTo(X, y - 48); x.lineTo(right, y - 48); x.stroke();
      facts.forEach(function(f, i){ factRow(x, t, f, X, right, y + i * 84); });
      y += (facts.length - 1) * 84;
    }
    if(warnLines.length){
      y += 44; x.fillStyle = t.dim; x.font = '400 19px ' + t.body;
      warnLines.forEach(function(ln, i){ x.fillText(ln, X, y + i * 26); });
    }
  }

  /* ══════════ РОЗКЛАДКА-ТАБЛИЦЯ (Офіс) ══════════
     Те саме, але числа в рядок із лінійками: у корпоративному листуванні
     дивляться на цифри, і таблиця читається швидше за перелік. */
  function paintTable(x, card, t, imgs, show, o){
    o = o || {};
    x.fillStyle = t.accent; x.fillRect(0, 0, W, 14);
    var panelW = 820, panelY = 180, panelH = H - panelY - 150;
    x.strokeStyle = t.line; x.lineWidth = 2;
    rr(x, PAD, panelY, panelW, panelH, 10);
    x.fillStyle = t.panel; x.fill(); x.stroke();
    drawShots(x, imgs, PAD + 40, panelY + 40, panelW - 80, panelH - 80, t);

    var X = PAD + panelW + 80, right = W - PAD, maxW = right - X;
    var y = panelY - 20;
    if(o.logo){
      var lk = Math.min(190 / o.logo.width, 42 / o.logo.height);
      x.drawImage(o.logo, PAD, 74, o.logo.width * lk, o.logo.height * lk);
    }
    x.fillStyle = t.ink; x.font = '700 60px ' + t.display;
    wrap(x, card.name, maxW, 2).forEach(function(ln){ y += 68; x.fillText(ln, X, y); });
    if(show('sub') && card.sub){
      y += 44; x.fillStyle = t.dim; x.font = '400 25px ' + t.body;
      wrap(x, card.sub, maxW, 2).forEach(function(ln, i){ x.fillText(ln, X, y + i * 34); y += i ? 34 : 0; });
    }
    if(show('about') && card.about){
      y += 42; x.fillStyle = t.ink; x.font = '400 25px ' + t.body;
      wrap(x, card.about, maxW, 3).forEach(function(ln, i){ x.fillText(ln, X, y + i * 34); y += i ? 34 : 0; });
    }
    if(show('sizes') && card.sizes){
      y += 36; x.fillStyle = t.dim; x.font = '600 23px ' + t.body;
      x.fillText(String(card.sizes), X, y);
    }
    var facts = factsOf(card, show);
    var ty = y + 76;
    facts.forEach(function(f, i){
      var yy = ty + i * 74;
      if(f[2]){ x.fillStyle = t.panel; rr(x, X - 22, yy - 42, maxW + 44, 66, 8); x.fill(); }
      x.fillStyle = t.dim; x.font = '600 24px ' + t.body;
      x.fillText(f[0], X, yy);
      var lw = x.measureText(f[0]).width;
      var s = fitFont(x, f[1], maxW - lw - 30, f[2] ? 40 : 32, f[2] ? '800' : '700', t.body);
      x.textAlign = 'right';
      x.fillStyle = f[2] ? t.accent : t.ink;
      x.font = (f[2] ? '800 ' : '700 ') + s + 'px ' + t.body;
      x.fillText(f[1], right, yy + 4);
      x.textAlign = 'left';
      x.strokeStyle = t.line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(X, yy + 28); x.lineTo(right, yy + 28); x.stroke();
    });
    if(show('warn')){
      x.fillStyle = t.dim; x.font = '400 19px ' + t.body;
      var wy = H - 150;
      wrap(x, WARN, maxW, 3).forEach(function(ln, i){ x.fillText(ln, X, wy + i * 26); });
    }
  }

  /* Картка рекомендованих. Плитками, бо тут порівнюють, а не роздивляються:
     питання не «який саме цей виріб», а «чим доповнити». */
  function paintSet(x, card, t, imgs, show, o){
    var y = PAD + 30;
    if(o && o.logo){
      var lk = Math.min(190 / o.logo.width, 42 / o.logo.height);
      x.drawImage(o.logo, PAD, y - 10, o.logo.width * lk, o.logo.height * lk);
      y += 78;
    }
    eyebrow(x, 'До вашого замовлення', PAD, y, t.accent, 20);
    y += 74;
    x.fillStyle = t.ink; x.font = '800 60px ' + t.display;
    x.fillText(card.name, PAD, y);

    var n = Math.max(1, card.items.length);
    var gap = 38;
    var tileW = (W - PAD * 2 - gap * (n - 1)) / n;
    var top = y + 56, tileH = H - top - 150;
    // Місце під підписи: назва, короткий опис і ціна
    var textH = 176;
    card.items.forEach(function(it, i){
      var X = PAD + i * (tileW + gap);
      x.fillStyle = t.panel;
      rr(x, X, top, tileW, tileH, 22); x.fill();
      var picH = tileH - textH;
      if(imgs[i]) fit(x, imgs[i], X + 26, top + 22, tileW - 52, picH - 22);
      else placeholder(x, X, top, tileW, picH, t.ink);
      var ty = top + picH + 30;
      x.fillStyle = t.ink; x.font = '700 30px ' + t.body;
      wrap(x, it.name, tileW - 52, 2).forEach(function(ln, k){
        x.fillText(ln, X + 26, ty + k * 34);
      });
      ty += 36;
      if(it.sub){
        x.fillStyle = t.dim; x.font = '400 21px ' + t.body;
        x.fillText(wrap(x, it.sub, tileW - 52, 1)[0] || '', X + 26, ty);
        ty += 26;
      }
      if(show('about') && it.note){
        x.fillStyle = t.dim; x.font = '400 21px ' + t.body;
        wrap(x, it.note, tileW - 52, 2).forEach(function(ln, k){
          x.fillText(ln, X + 26, ty + k * 26);
        });
      }
      if(show('unit') && it.unit){
        x.fillStyle = t.accent; x.font = '800 32px ' + t.body;
        x.fillText(money(it.unit), X + 26, top + tileH - 26);
      }
    });
  }

  /* ══════════ МАЛЮВАННЯ КАРТКИ ══════════
     Одна дорога на preview й на файл. Розійтись їм нема як. */
  async function drawCard(card, offer, cfg){
    cfg = cfg || {};
    var fields = cfg.fields || {};
    var show = function(k){ return fields[k] !== false; };

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    x.textBaseline = 'alphabetic';

    var logo = await loadImg((offer || {}).clientLogo || '');
    var tpl = cfg.tpl || 'minimal';
    var t = themeOf(tpl, accentFrom(logo, '#E8590C'));

    x.fillStyle = t.bg; x.fillRect(0, 0, W, H);

    if(card.type === 'set'){
      var imgs = await Promise.all(card.items.map(function(it){ return loadImg(it.pic); }));
      paintSet(x, card, t, imgs, show, { logo: logo });
    } else {
      var shots = await Promise.all((card.shots || []).map(loadImg));
      if(t.table) paintTable(x, card, t, shots, show, { logo: logo });
      else paintSheet(x, card, t, shots, show, { logo: logo });
    }
    footer(x, t, offer || {});
    return cv;
  }

  /* Імʼя файлу. Номер попереду — щоб у теці картки лягли в тому самому
     порядку, у якому вони стоять у пропозиції, а не за абеткою. */
  function fileName(card, i, offer, ext){
    var n = String(i + 1);
    if(n.length < 2) n = '0' + n;
    var base = 'kp-' + ((offer || {}).orderId || 'loomiq') + '-' + n + '-' +
               String(card.name || 'kartka').toLowerCase().replace(/\s+/g, '-');
    return base + '.' + (ext || 'png');
  }

  window.LQCards = {
    W: W, H: H,
    TEMPLATES: TEMPLATES, FIELDS: FIELDS, WARN: WARN,
    build: buildCards, draw: drawCard, fileName: fileName, money: money
  };
})();
