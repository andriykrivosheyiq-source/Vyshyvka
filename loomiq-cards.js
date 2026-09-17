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

  /* ══════════ ФОРМАТ ══════════
     Висота стала, ШИРИНА РОСТЕ від кількості фото. Це головне рішення тут,
     і воно змінює саму природу картки.

     Доти лист був фіксованим прямокутником: один ракурс отримував панель на
     пів аркуша, решта тулилась поруч дрібнішими. Виходив банер із нав'язаним
     акцентом — «ось головне фото, а це другорядні», — хоча спина й рукав
     для клієнта рівно такі самі, як перед: він платить за кожне нанесення.

     Тепер це каталожний лист: усі ракурси рівні, стоять в один ряд
     однаковими блоками, а лист просто ширшає. Два фото — 1400 × 1000, три —
     2040, чотири — 2680. Порожніх зон не буває взагалі: їх нема звідки
     взятись, бо ширина рахується з кількості колонок.

     Менше двох колонок лист не буває. Один ракурс на вузькому аркуші —
     це вже не каталожний лист, а сторіс: шапці ніде розкластись, назва
     ламається на три рядки. Тому знімок лишається однією колонкою, а лист
     тримає ширину на дві й ставить його по центру.

     Висота поділена так: шапка — числа й слова, галерея — виріб. Галереї
     віддано близько трьох чвертей, і це не компроміс: у листуванні картку
     відкривають заради виробу, а не заради нашої типографіки. */
  var H = 1000, PAD = 80, COL = 600, GAP = 40;
  var HEAD = 224, BOT = 40;            // шапка ≈22 %, галерея ≈74 %
  function sheetW(n){
    n = Math.max(2, Math.min(4, n | 0));
    return PAD * 2 + n * COL + (n - 1) * GAP;
  }

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
    /* Тло трохи тоноване, а панелі під знімками білі — не навпаки. Мокапи
       здебільшого йдуть із білим тлом, і на сірій панелі навколо кожного
       проступав світлий прямокутник: три знімки в ряд перетворювались на
       три різні за розміром білі коробки. */
    minimal: { bg:'#F5F7FA', panel:'#FFFFFF', ink:'#0F2034', dim:'#7C8798',
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
    office:  { bg:'#F7F9FC', panel:'#FFFFFF', ink:'#101828', dim:'#667085',
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
  /* Що взагалі буває на картці. Загальної суми тут немає навмисно: вона
     залежить від тиражу, а тираж у листуванні ще обговорюють — картка з
     сумою застаріває на першому ж «а якщо пʼятдесят?». Розмірного ряду
     теж: «S×4 · M×8 · L×8» у Direct не вирішує нічого, досить загальної
     кількості. Ба більше — самої кількості теж: тираж у листуванні
     обговорюють, і число «20 шт» на картці застаріває на першому ж «а якщо
     пʼятдесят?», тоді як ціна за штуку й термін від нього не залежать.
     Лишаються рівно два числа, з яких починається кожна розмова: скільки
     за штуку й коли буде. */
  var FIELDS = [
    { id:'sub',   name:'Колір і нанесення' },
    { id:'about', name:'Опис виробу' },
    { id:'unit',  name:'Ціна за штуку' },
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
    /* Ракурси, які показуємо на картці.

       ПЕРЕД І ЗАД — ЗАВЖДИ, незалежно від того, де саме нанесення. Доти
       бралися лише сторони з нанесенням, і виріб з одним логотипом на
       грудях показувався одним знімком — а перше питання у відповідь на
       таку картинку рівно одне: «а ззаду що?». Клієнт дивиться на виріб, а
       не на наш перелік сторін.

       Рукав і решта сторін додаються тоді, коли на них справді щось є. */
    var SIDE_UA = { front:'Спереду', back:'Ззаду', left:'Рукав', right:'Рукав' };
    var shotsOf = function(it){
      var views = (it.views || []).filter(function(v){ return v && v.show !== false && v.img; });
      var byId = {};
      views.forEach(function(v){ if(v.side && !byId[v.side]) byId[v.side] = v; });
      var out2 = [];
      var add = function(v, lb){
        if(!v || !v.img) return;
        for(var i = 0; i < out2.length; i++) if(out2[i].url === v.img) return;
        out2.push({ url: v.img, side: v.side || '',
                    label: lb || SIDE_UA[v.side] || v.label || '' });
      };
      add(byId.front); add(byId.back);
      (it.prints || []).forEach(function(p){
        var sd = p.side || '';
        if(sd === 'front' || sd === 'back') return;
        add(byId[sd], p.sideLabel && SIDE_UA[sd] ? SIDE_UA[sd] : (p.sideLabel || ''));
      });
      if(!out2.length) views.forEach(function(v){ add(v); });
      if(!out2.length) pics(it).forEach(function(u){
        if(out2.length < 3) out2.push({ url:u, side:'', label:'' }); });
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
      if(own.pic){
        var mine = shots.filter(function(sh){ return sh.url === own.pic; })[0];
        var rest = shots.filter(function(sh){ return sh.url !== own.pic; });
        shots = [mine || { url: own.pic, side:'', label:'' }].concat(rest).slice(0, 3);
      }
      return {
        id: id, kind: kind, type: 'item',
        name: own.title || it.name || 'Позиція',
        sub: subOf(it),
        about: own.note != null ? own.note : (it.recoNote || it.about || ''),
        /* Ні розмірного ряду, ні загальної суми тут немає — і не лежить
           мертвим вантажем: чого картка не малює, того вона й не возить. */
        qty: +it.qty || 0,
        unit: +it.unitPrice || 0,
        term: term,
        shots: shots, pics: all,
        pic: (own.pic && all.indexOf(own.pic) >= 0) ? own.pic
           : ((shots[0] && shots[0].url) || all[0] || ''),
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
  function fitFont(x, text, maxW, size, weight, family, min){
    var s = size;
    while(s > (min || 13)){
      x.font = weight + ' ' + s + 'px ' + family;
      if(x.measureText(text).width <= maxW) break;
      s -= 2;
    }
    return s;
  }
  /* Один рядок з трикрапкою. Обрізати «мовчки» тут не можна: у шапці все
     стоїть по одній лінії, і рядок, що просто скінчився на півслові,
     читається як помилка вивантаження, а не як «тут є ще». */
  function clip1(x, s, maxW){
    s = String(s || '');
    if(!s || x.measureText(s).width <= maxW) return s;
    while(s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s.replace(/[\s,;:.—–-]+$/, '') + '…';
  }

  /* Ширина розрідженого напису — та сама формула, що й у eyebrow, але без
     малювання: колонку чисел треба зміряти до того, як стало відомо, де
     вона починається. */
  function eyebrowW(x, text, size){
    x.font = '700 ' + size + 'px ' + SANS;
    var s = String(text || '').toUpperCase(), w = 0;
    for(var i = 0; i < s.length; i++) w += x.measureText(s[i]).width + size * 0.12;
    return w;
  }
  /* Колонки чисел у шапці. Кожна така, як її вміст, а не однакової
     ширини на всіх: «240 грн» і «7 робочих днів» у рівних колонках дають
     праворуч порожнечу, а посередині — дірку. Тому міряємо кожну й
     ставимо блок упритул до правого поля. */
  var CELL_GAP = 52;
  function statCells(x, t, facts){
    return facts.map(function(f){
      /* Спершу число, потім підпис — і в жодному разі не в одному виразі:
         eyebrowW сам перемикає шрифт, і число, зміряне після нього,
         виходить удвічі вужчим, ніж намалюється. */
      x.font = (f[2] ? '800 46px ' : '700 38px ') + t.body;
      var vw = x.measureText(f[1]).width;
      return { f: f, w: Math.max(vw, eyebrowW(x, f[0], 18)) };
    });
  }
  function statsW(cells){
    if(!cells.length) return 0;
    return cells.reduce(function(s, c){ return s + c.w; }, 0) + CELL_GAP * (cells.length - 1);
  }
  function drawStats(x, t, cells, X, yLab, yVal){
    var cx = X;
    cells.forEach(function(c, i){
      if(i){
        x.strokeStyle = t.line; x.lineWidth = 1;
        x.beginPath();
        x.moveTo(cx - CELL_GAP / 2, yLab - 26);
        x.lineTo(cx - CELL_GAP / 2, yVal + 12);
        x.stroke();
      }
      eyebrow(x, c.f[0], cx, yLab, t.dim, 18);
      x.fillStyle = c.f[2] ? t.accent : t.ink;
      x.font = (c.f[2] ? '800 46px ' : '700 38px ') + t.body;
      x.fillText(c.f[1], cx, yVal);
      cx += c.w + CELL_GAP;
    });
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

  /* Підпис «чия картка». Картку пересилають далі — по ній має бути
     зрозуміло, чия вона й до якої пропозиції належить. Підписуємось тим
     самим брендом, від якого пішла сама пропозиція: у картці замовлення є
     перемикач Loomiq / Stvory, і два різні підписи на тих самих даних — це
     рівно те непорозуміння, від якого той перемикач і заводили.

     Стоїть він у верхньому рядку, поруч із логотипом клієнта, а не
     футером унизу. Унизу він забирав би в галереї смугу заввишки з
     півсотні пікселів заради двох слів — а галерея тут головна. */
  function brandName(offer){
    var b = (offer || {}).brand;
    return (b && (b.name || b.tagline)) ? String(b.name || '') : '';
  }
  function topMeta(x, t, offer, W){
    var b = brandName(offer);
    var s = [b, offer.orderId ? 'КП № ' + offer.orderId : ''].filter(Boolean).join(' · ');
    if(!s) return;
    x.fillStyle = t.dim;
    x.font = '400 20px ' + t.body;
    x.textAlign = 'right';
    x.fillText(s, W - PAD, 76);
    x.textAlign = 'left';
  }

  /* Рядки чисел — спільні на всі шаблони: це той самий зміст, і збиратись
     він має в одному місці. Розкладка вирішує лише, де їх покласти. */
  /* Акцентним числом стала ЦІНА ЗА ШТУКУ, а не сума: саме її питають
     першою, і саме вона не залежить від того, скільки врешті замовлять. */
  function factsOf(card, show){
    var out = [];
    if(show('unit') && card.unit) out.push(['Ціна за 1 шт', money(card.unit), true]);
    if(show('term') && card.term) out.push(['Термін', card.term + ' робочих днів', false]);
    return out;
  }

  /* ══════════ РАКУРСИ ══════════
     Перед і зад показуємо завжди, рукав — коли на ньому щось є. Підписів
     під знімками немає навмисно: «Спереду» під фотографією переду не додає
     нічого, це підпис, який повторює те, що око вже побачило. Виріб ми
     показуємо цілком з кожного боку, а не макрозйомкою, де кроп сам по собі
     незрозумілий, — отже читати там нічого. */
  function shotPanel(x, t, X, Y, w, h){
    x.fillStyle = t.panel;
    rr(x, X, Y, w, h, 24); x.fill();
  }
  /* Галерея. Колонки рівні між собою — і тому, що ракурси рівні, і тому,
     що рівні колонки дають одну сітку на будь-яку кількість фото: підписи
     й поля стоять там само, що на сусідній картці. Ширину рахувати не
     треба, вона вже врахована в ширині аркуша. */
  function shotsRow(x, imgs, X, Y, w, h, t){
    var n = Math.max(1, imgs.length);
    /* Один знімок на всю ширину виглядав би банером, а не виробом: лист
       однаково тримає ширину на дві колонки, тож ставимо його по центру
       колонкою тієї ж ширини, що й у решти карток. */
    var full = n === 1 ? Math.min(w, COL) : w;
    var X0 = X + Math.round((w - full) / 2);
    var cw = (full - GAP * (n - 1)) / n;
    for(var i = 0; i < n; i++){
      var cx = X0 + i * (cw + GAP);
      shotPanel(x, t, cx, Y, cw, h);
      if(imgs[i]) fit(x, imgs[i], cx + 26, Y + 26, cw - 52, h - 52);
      else placeholder(x, cx, Y, cw, h, t.ink);
    }
  }
  // Смуга акценту згори — ознака строгого шаблону, а не окрема розкладка
  function topBar(x, t, W){
    if(!t.table) return 0;
    x.fillStyle = t.accent; x.fillRect(0, 0, W, 14);
    return 14;
  }
  function drawLogo(x, logo, X, Y, maxH){
    if(!logo) return 0;
    var k = Math.min(230 / logo.width, maxH / logo.height);
    x.drawImage(logo, X, Y, logo.width * k, logo.height * k);
    return maxH;
  }

  /* ══════════ РОЗКЛАДКА КАРТКИ ══════════
     Два блоки, і межа між ними одна на всі картки: шапка — усе, що
     словами й числами, галерея — виріб.

     Числа переїхали з нижньої смуги В ШАПКУ, і це не косметика. Нижня
     смуга працювала, поки лист був фіксованим: галерея впиралась у неї
     знизу й композицію тримала саме та лінія. Тепер аркуш ширшає під
     кількість фото — і смуга чисел під галереєю на 2560 пікселів
     розтягувалась би на всю ту ширину під три слова. Нагорі ж вона
     зчитується разом із назвою: «що це, почому, коли» — рівно те, з чим
     людина приходить у Direct, одним поглядом, до того як роздивлятись.

     Праворуч у шапці колонки чисел вирівняні по правому полю, ліворуч —
     логотип, назва й опис. Застереження йде найнижчим рядком шапки на всю
     ширину: це виноска, і вона має читатись як виноска, а не як ще одне
     число. */
  function paintCard(x, card, t, imgs, show, o, W){
    o = o || {};
    if(t.shape){
      x.fillStyle = t.accent;
      x.globalAlpha = 0.10;
      x.beginPath(); x.arc(W - 180, -140, 560, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }
    topBar(x, t, W);
    var right = W - PAD, maxW = right - PAD;

    // ── числа: міряємо першими, бо вони віднімають ширину в назви ──
    var facts = factsOf(card, show);
    var cells = statCells(x, t, facts);
    var sw = statsW(cells);
    if(sw) drawStats(x, t, cells, right - sw, 122, 174);

    // ── ліва частина шапки ──
    var leftW = Math.max(240, maxW - (sw ? sw + 72 : 0));
    if(o.logo) drawLogo(x, o.logo, PAD, 42, 38);
    x.fillStyle = t.ink;
    fitFont(x, card.name, leftW, 48, '800', t.display, 32);
    x.fillText(clip1(x, card.name, leftW), PAD, 140);
    /* Під назвою — один рядок: опис виробу, а немає його — колір і спосіб
       нанесення. Два рядки тут перетворюють шапку на абзац. */
    var lead = (show('about') && card.about) ? card.about
             : ((show('sub') && card.sub) ? card.sub : '');
    if(lead){
      x.fillStyle = t.dim;
      fitFont(x, lead, leftW, 24, '400', t.body, 19);
      x.fillText(clip1(x, lead, leftW), PAD, 176);
    }
    /* Застереження — на всю ширину й найдрібнішим кеглем, який ще
       читається: у вузького аркуша його просто нема куди подіти інакше, а
       переносити на другий рядок означає їсти в галереї ще 24 пікселі. */
    if(show('warn')){
      var ws = fitFont(x, WARN, maxW, 18, '400', t.body);
      x.fillStyle = t.dim; x.font = '400 ' + ws + 'px ' + t.body;
      x.fillText(WARN, PAD, HEAD - 16);
    }

    // ── галерея ──
    shotsRow(x, imgs, PAD, HEAD, maxW, H - BOT - HEAD, t);
  }

  /* Картка рекомендованих. Плитками, бо тут порівнюють, а не роздивляються:
     питання не «який саме цей виріб», а «чим доповнити». */
  function paintSet(x, card, t, imgs, show, o, W){
    topBar(x, t, W);
    if(o && o.logo) drawLogo(x, o.logo, PAD, 42, 38);
    eyebrow(x, 'До вашого замовлення', PAD, 118, t.accent, 18);
    x.fillStyle = t.ink;
    var maxW = W - PAD * 2;
    fitFont(x, card.name, maxW, 48, '800', t.display, 32);
    x.fillText(clip1(x, card.name, maxW), PAD, 176);

    var n = Math.max(1, card.items.length);
    var gap = GAP;
    var tileW = (maxW - gap * (n - 1)) / n;
    var top = HEAD, tileH = H - BOT - HEAD;
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

    /* Ширину аркуша задає САМА КАРТКА — скільки в неї колонок, така вона й
       завширшки. Це єдине місце, де розмір взагалі рахується: далі його
       передаємо вниз параметром, щоб жоден малювальник не міг узяти власне
       уявлення про те, де в цього листа правий край. */
    var cols = card.type === 'set' ? (card.items || []).length
                                   : (card.shots || []).length;
    var W = sheetW(cols);

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
      paintSet(x, card, t, imgs, show, { logo: logo }, W);
    } else {
      var shots = await Promise.all((card.shots || []).map(function(sh){
        return loadImg(sh && sh.url);
      }));
      paintCard(x, card, t, shots, show, { logo: logo }, W);
    }
    topMeta(x, t, offer || {}, W);
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
    H: H, sheetW: sheetW,
    TEMPLATES: TEMPLATES, FIELDS: FIELDS, WARN: WARN,
    build: buildCards, draw: drawCard, fileName: fileName, money: money
  };
})();
