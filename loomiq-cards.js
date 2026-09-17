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

     Висота поділена на три смуги: шапка — хто й що, галерея — виріб,
     низ — числа. Смуги сталі, тож дві картки поруч у стрічці Direct
     вирівняні між собою: назви на одній лінії, ціни на одній лінії. */
  var H = 1000, PAD = 80, COL = 600, GAP = 40;
  var HEAD = 168, FOOT = 186, BOT = 40;
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
    { id:'old',   name:'Стара ціна' },
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
        /* Базова ціна — та сама, з якої сторінка пропозиції рахує «ви
           економите». Своєї старої ціни картка не вигадує. */
        base: +it.baseUnitPrice || 0,
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
  function metaText(offer){
    offer = offer || {};
    return [brandName(offer), offer.orderId ? 'КП № ' + offer.orderId : '']
      .filter(Boolean).join(' · ');
  }

  /* ══════════ ШАПКА ══════════
     Логотип клієнта ліворуч і невеликий, назва праворуч ВІД НЬОГО, опис під
     назвою. Не «логотип, а під ним усе інше»: у стрічці Direct картку
     пізнають по марці замовника, і марка має стояти поруч із назвою, а не
     над нею окремим поверхом, що зʼїдає тридцять пікселів висоти. */
  function head(x, card, t, show, o, W){
    var right = W - PAD;
    var lw = o.logo ? drawLogo(x, o.logo, PAD, 38, 56) : 0;
    var tx = PAD + (lw ? Math.round(lw) + 36 : 0);

    var meta = o.meta || '';
    var mw = 0;
    if(meta){
      x.font = '400 20px ' + t.body;
      mw = x.measureText(meta).width;
      x.fillStyle = t.dim;
      x.textAlign = 'right';
      x.fillText(meta, right, 66);
      x.textAlign = 'left';
    }

    x.fillStyle = t.ink;
    var nameW = right - (mw ? mw + 48 : 0) - tx;
    fitFont(x, card.name, nameW, 50, '800', t.display, 32);
    x.fillText(clip1(x, card.name, nameW), tx, 100);

    /* Під назвою — один рядок: опис виробу, а немає його — колір і спосіб
       нанесення. Два рядки тут перетворюють шапку на абзац. */
    var lead = (show('about') && card.about) ? card.about
             : ((show('sub') && card.sub) ? card.sub : '');
    if(lead){
      x.fillStyle = t.dim;
      fitFont(x, lead, right - tx, 24, '400', t.body, 18);
      x.fillText(clip1(x, lead, right - tx), tx, 138);
    }
    rule(x, t, PAD, right, HEAD);
  }
  function rule(x, t, x0, x1, y){
    x.strokeStyle = t.line; x.lineWidth = 2;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
  }

  /* ══════════ НИЖНЯ СМУГА ══════════
     Ціна, під нею стара ціна й знижка; далі термін; праворуч — застереження.

     Стара ціна НЕ вводиться окремо: беремо базову ціну самої позиції за тим
     самим правилом, що й сторінка пропозиції — показуємо, лише якщо вона
     більша за поточну. Інакше картка й КП рано чи пізно розійшлися б у тому,
     скільки саме клієнт економить, а розходження тут коштує довіри.

     Застереження стоїть третьою колонкою праворуч, а не рядком упоперек
     аркуша. Це виноска: збоку дрібним вона читається як виноска, а на всю
     ширину під числами — як попередження, яке ми чомусь кричимо. */
  function oldPrice(card, show){
    if(!show('old')) return null;
    var base = +card.base || 0, unit = +card.unit || 0;
    if(!unit || base <= unit) return null;
    return { was: money(base), off: '−' + Math.round((base - unit) / base * 100) + ' %' };
  }
  function numbers(x, card, t, show, W){
    var right = W - PAD;
    var yRule = H - FOOT, yLab = yRule + 48, yVal = yRule + 100;  // 814 · 862 · 914
    rule(x, t, PAD, right, yRule);

    // ── ціна ──
    var cut = oldPrice(card, show);
    var priceW = 0, price = (show('unit') && card.unit) ? money(card.unit) : '';
    if(price){
      x.font = '800 52px ' + t.body;
      priceW = x.measureText(price).width;
      if(cut){
        x.font = '400 26px ' + t.body;
        var wasW = x.measureText(cut.was).width;
        x.font = '800 20px ' + t.body;
        priceW = Math.max(priceW, wasW + 16 + x.measureText(cut.off).width + 30);
      }
      priceW = Math.max(priceW, eyebrowW(x, 'Ціна за 1 шт', 18));
    }
    // ── термін ──
    var term = (show('term') && card.term) ? card.term + ' робочих днів' : '';
    var termW = 0;
    if(term){
      x.font = '700 38px ' + t.body;
      termW = Math.max(x.measureText(term).width, eyebrowW(x, 'Термін виготовлення', 18));
    }

    var GAPC = 56;
    var tx = PAD + priceW + (priceW ? GAPC : 0);
    var wx = tx + termW + (termW ? GAPC : 0);

    if(price){
      eyebrow(x, 'Ціна за 1 шт', PAD, yLab, t.dim, 18);
      x.fillStyle = t.accent; x.font = '800 52px ' + t.body;
      x.fillText(price, PAD, yVal);
      if(cut){
        /* Стара ціна стоїть ПІД новою, а не поруч: поруч вона змагається з
           нею за той самий рядок, і око спершу читає більше число. */
        x.fillStyle = t.dim; x.font = '400 26px ' + t.body;
        var ww = x.measureText(cut.was).width;
        x.fillText(cut.was, PAD, yVal + 38);
        x.strokeStyle = t.dim; x.lineWidth = 2;
        x.beginPath(); x.moveTo(PAD, yVal + 29); x.lineTo(PAD + ww, yVal + 29); x.stroke();
        badge(x, t, cut.off, PAD + ww + 16, yVal + 38);
      }
    }
    if(term){
      eyebrow(x, 'Термін виготовлення', tx, yLab, t.dim, 18);
      x.fillStyle = t.ink; x.font = '700 38px ' + t.body;
      x.fillText(term, tx, yVal);
    }
    // розділювачі — те, що робить смугу смугою
    [priceW ? tx : 0, termW ? wx : 0].forEach(function(cx){
      if(!cx) return;
      x.strokeStyle = t.line; x.lineWidth = 1;
      x.beginPath();
      x.moveTo(cx - GAPC / 2, yRule + 22);
      x.lineTo(cx - GAPC / 2, H - 46);
      x.stroke();
    });
    /* Застереження забирає всю решту ширини праворуч. Якщо її менше за
       двісті пікселів — числа вийшли задовгі, і дрібний текст у щілину
       перетворився б на стовпчик по одному слову; тоді його просто немає. */
    var warnW = right - wx;
    if(show('warn') && warnW >= 200){
      x.fillStyle = t.dim; x.font = '400 15px ' + t.body;
      wrap(x, WARN, warnW, 5).forEach(function(ln, i){
        x.fillText(ln, wx, yLab + i * 21);
      });
    }
  }
  function badge(x, t, s, X, y){
    x.font = '800 20px ' + t.body;
    var w = x.measureText(s).width + 26;
    x.fillStyle = t.accent;
    rr(x, X, y - 22, w, 30, 15); x.fill();
    x.fillStyle = '#FFFFFF';
    x.textAlign = 'center';
    x.fillText(s, X + w / 2, y - 1);
    x.textAlign = 'left';
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
  /* Обрізати порожні поля мокапа.

     Мокапи приходять зі своїми полями — виріб займає в кадрі відсотків
     шістдесят, решта біле. Ми навколо того кадру малювали ще й власні поля,
     і на картці виходила біла коробка, у якій десь усередині худі. Тому
     міряємо, де в картинці починається непорожнє, і далі працюємо з тим
     прямокутником, а не з усім файлом.

     Скануємо зменшену копію: на повному розмірі це мільйони пікселів на
     кожну перемальовку preview, а межі виробу від такої точності не
     зміняться. Результат кешуємо на самому зображенні — одну й ту саму
     картинку малюють і в preview, і у файл.

     Обрізаємо, лише коли полів справді багато: у кадрі з тінню чи
     градієнтом «майже біле» тягнеться до самого краю, і різати там нема
     чого — краще лишити як є, ніж зрізати виробу пів рукава. */
  function trimOf(img){
    if(img.__lqTrim) return img.__lqTrim;
    var t = { x:0, y:0, w:img.width, h:img.height };
    try{
      var c = document.createElement('canvas');
      var k = Math.min(160 / img.width, 160 / img.height, 1);
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      var q = c.getContext('2d');
      q.drawImage(img, 0, 0, c.width, c.height);
      var d = q.getImageData(0, 0, c.width, c.height).data;
      var x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for(var py = 0; py < c.height; py++){
        for(var px = 0; px < c.width; px++){
          var i = (py * c.width + px) * 4;
          if(d[i + 3] < 24) continue;                               // прозоре
          if(d[i] > 243 && d[i+1] > 243 && d[i+2] > 243) continue;   // майже біле
          if(px < x0) x0 = px;
          if(px > x1) x1 = px;
          if(py < y0) y0 = py;
          if(py > y1) y1 = py;
        }
      }
      if(x1 >= 0){
        x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
        x1 = Math.min(c.width - 1, x1 + 2); y1 = Math.min(c.height - 1, y1 + 2);
        var rw = (x1 - x0 + 1) / c.width, rh = (y1 - y0 + 1) / c.height;
        if(rw < 0.94 || rh < 0.94)
          t = { x: x0 / c.width * img.width, y: y0 / c.height * img.height,
                w: rw * img.width, h: rh * img.height };
      }
    }catch(e){}
    try{ img.__lqTrim = t; }catch(e){}
    return t;
  }

  /* Ряд знімків. Головне тут не в тому, де стоять колонки, а в тому, що
     масштаб у них СПІЛЬНИЙ.

     Доти кожен ракурс вписувався у свою колонку окремо — і рукав, знятий
     крупно, роздувався до розміру худі. Виходили три різні товари в ряд.
     Тепер підбираємо один кадр на весь ряд: перед і зад однакові, рукав
     менший — рівно так, як у каталозі, де знімки одного виробу зіставні
     між собою. */
  /* Спільний кадр на весь ряд: підбираємо його так, щоб найбільший виріб
     ще вписався у відведений прямокутник. Далі всі малюються в тому самому
     масштабі — і стають зіставні між собою. */
  function rowScale(imgs, bw, bh){
    var S = Infinity;
    imgs.forEach(function(im){
      if(!im) return;
      var tr = trimOf(im), A = im.width / im.height;
      S = Math.min(S, bw / ((tr.w / im.width) * A), bh / (tr.h / im.height));
    });
    return S;
  }
  function drawShot(x, im, S, X, Y, bw, bh){
    var tr = trimOf(im), A = im.width / im.height;
    var dw = (tr.w / im.width) * S * A, dh = (tr.h / im.height) * S;
    x.drawImage(im, tr.x, tr.y, tr.w, tr.h,
                X + (bw - dw) / 2, Y + (bh - dh) / 2, dw, dh);
  }
  function shotsRow(x, imgs, X, Y, w, h, t){
    var n = Math.max(1, imgs.length);
    /* Один знімок на всю ширину виглядав би банером, а не виробом: лист
       однаково тримає ширину на дві колонки, тож ставимо його по центру
       колонкою тієї ж ширини, що й у решти карток. */
    var full = n === 1 ? Math.min(w, COL) : w;
    var X0 = X + Math.round((w - full) / 2);
    var cw = (full - GAP * (n - 1)) / n;
    var IN = 26, bw = cw - IN * 2, bh = h - IN * 2;
    var S = rowScale(imgs, bw, bh);

    for(var i = 0; i < n; i++){
      var cx = X0 + i * (cw + GAP);
      shotPanel(x, t, cx, Y, cw, h);
      if(imgs[i] && isFinite(S)) drawShot(x, imgs[i], S, cx + IN, Y + IN, bw, bh);
      else if(!imgs[i]) placeholder(x, cx, Y, cw, h, t.ink);
    }
  }
  // Смуга акценту згори — ознака строгого шаблону, а не окрема розкладка
  function topBar(x, t, W){
    if(!t.table) return 0;
    x.fillStyle = t.accent; x.fillRect(0, 0, W, 14);
    return 14;
  }
  // Повертає НАМАЛЬОВАНУ ширину: від неї відлічується початок назви
  function drawLogo(x, logo, X, Y, maxH){
    if(!logo) return 0;
    var k = Math.min(220 / logo.width, maxH / logo.height);
    var w = logo.width * k;
    x.drawImage(logo, X, Y, w, logo.height * k);
    return w;
  }

  /* ══════════ РОЗКЛАДКА КАРТКИ ══════════
     Три сталі смуги: шапка, галерея, числа. Порядок читання в Direct саме
     такий — хто й що, потім сам виріб, потім скільки й коли; і смуги сталі
     навмисно, щоб дві картки поруч у стрічці вирівнювались між собою.

     Шаблон відповідає за кольори й типографіку, а не за будову: розкладка
     одна на всі ніші. Інакше «Картка для СТО» й «Картка для клініки»
     розійшлися б у тому, де шукати ціну. */
  function paintCard(x, card, t, imgs, show, o, W){
    o = o || {};
    if(t.shape){
      x.fillStyle = t.accent;
      x.globalAlpha = 0.10;
      x.beginPath(); x.arc(W - 180, -140, 560, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }
    topBar(x, t, W);
    head(x, card, t, show, o, W);
    // Галерея не впирається в лінійки: 16 пікселів повітря згори й знизу
    shotsRow(x, imgs, PAD, HEAD + 16, W - PAD * 2, H - FOOT - HEAD - 34, t);
    numbers(x, card, t, show, W);
  }

  /* Картка рекомендованих. Плитками, бо тут порівнюють, а не роздивляються:
     питання не «який саме цей виріб», а «чим доповнити». */
  function paintSet(x, card, t, imgs, show, o, W){
    o = o || {};
    topBar(x, t, W);
    var right = W - PAD;
    var lw = o.logo ? drawLogo(x, o.logo, PAD, 42, 56) : 0;
    var tx = PAD + (lw ? Math.round(lw) + 36 : 0);
    if(o.meta){
      x.fillStyle = t.dim; x.font = '400 20px ' + t.body;
      x.textAlign = 'right'; x.fillText(o.meta, right, 70); x.textAlign = 'left';
    }
    eyebrow(x, 'До вашого замовлення', tx, 74, t.accent, 18);
    x.fillStyle = t.ink;
    var maxW = right - tx;
    fitFont(x, card.name, maxW, 50, '800', t.display, 32);
    x.fillText(clip1(x, card.name, maxW), tx, 134);
    rule(x, t, PAD, right, HEAD);
    maxW = W - PAD * 2;

    var n = Math.max(1, card.items.length);
    var gap = GAP;
    var tileW = (maxW - gap * (n - 1)) / n;
    var top = HEAD + 16, tileH = H - BOT - HEAD - 16;
    // Місце під підписи: назва, короткий опис і ціна
    var textH = 176;
    /* Плитки — теж ряд, і масштаб у них теж спільний: кепка поруч із худі
       має лишатись кепкою, а не роздуватись до нього. */
    var setS = rowScale(imgs, tileW - 52, tileH - textH - 44);
    card.items.forEach(function(it, i){
      var X = PAD + i * (tileW + gap);
      x.fillStyle = t.panel;
      rr(x, X, top, tileW, tileH, 22); x.fill();
      var picH = tileH - textH;
      if(imgs[i] && isFinite(setS))
        drawShot(x, imgs[i], setS, X + 26, top + 22, tileW - 52, picH - 44);
      else if(!imgs[i]) placeholder(x, X, top, tileW, picH, t.ink);
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

    var o = { logo: logo, meta: metaText(offer) };
    if(card.type === 'set'){
      var imgs = await Promise.all(card.items.map(function(it){ return loadImg(it.pic); }));
      paintSet(x, card, t, imgs, show, o, W);
    } else {
      var shots = await Promise.all((card.shots || []).map(function(sh){
        return loadImg(sh && sh.url);
      }));
      paintCard(x, card, t, shots, show, o, W);
    }
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
