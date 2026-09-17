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
     кількості. Лишаються рівно ті числа, з яких починається кожна
     розмова: скільки штук, скільки за штуку, коли буде. */
  var FIELDS = [
    { id:'sub',   name:'Колір і нанесення' },
    { id:'about', name:'Опис виробу' },
    { id:'qty',   name:'Кількість' },
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
  /* Акцентним числом стала ЦІНА ЗА ШТУКУ, а не сума: саме її питають
     першою, і саме вона не залежить від того, скільки врешті замовлять. */
  function factsOf(card, show){
    var out = [];
    if(show('qty') && card.qty) out.push(['Кількість', card.qty + ' шт', false]);
    if(show('unit') && card.unit) out.push(['Ціна за штуку', money(card.unit), true]);
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
  function shotsRow(x, imgs, X, Y, w, h, t){
    var n = Math.max(1, imgs.length), gap = 26;
    /* Один знімок на всю ширину виглядав би банером, а не виробом: тримаємо
       його в межах половини смуги й ставимо по центру. */
    var full = n === 1 ? Math.min(w, Math.round(h * 1.05)) : w;
    var X0 = X + Math.round((w - full) / 2);
    var cw = (full - gap * (n - 1)) / n;
    for(var i = 0; i < n; i++){
      var cx = X0 + i * (cw + gap);
      shotPanel(x, t, cx, Y, cw, h);
      if(imgs[i]) fit(x, imgs[i], cx + 26, Y + 26, cw - 52, h - 52);
      else placeholder(x, cx, Y, cw, h, t.ink);
    }
  }
  // Смуга акценту згори — ознака строгого шаблону, а не окрема розкладка
  function topBar(x, t){
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
     Шапка — знімки — смуга чисел. Одна й та сама на будь-яку кількість
     ракурсів: шаблон відповідає за кольори й типографіку, а не за будову.

     Числа стоять ВНИЗУ смугою в три колонки з розділювачами. Картку в
     Direct читають згори вниз: спершу виріб, потім «скільки». Ціна в шапці
     конкурувала б із назвою й читалась раніше, ніж людина встигла подивитись
     на товар. А головне — нижня смуга дає лінію, на якій усе вирівняне:
     однакові підписи, однакові числа, однакові колонки. Саме вона й тримає
     композицію, коли зверху три різні фото. */
  function paintCard(x, card, t, imgs, show, o){
    o = o || {};
    if(t.shape){
      x.fillStyle = t.accent;
      x.globalAlpha = 0.10;
      x.beginPath(); x.arc(W - 180, -140, 560, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1;
    }
    topBar(x, t);
    var right = W - PAD, maxW = right - PAD;

    // ── шапка ──
    var y = PAD;
    if(o.logo){ drawLogo(x, o.logo, PAD, y, 42); y += 42 + 28; }
    x.fillStyle = t.ink; x.font = '800 72px ' + t.display;
    wrap(x, card.name, maxW, 2).forEach(function(ln){ y += 76; x.fillText(ln, PAD, y); });
    /* Під назвою — один рядок: опис виробу, а немає його — колір і спосіб
       нанесення. Два рядки тут перетворюють шапку на абзац. */
    var lead = (show('about') && card.about) ? card.about
             : ((show('sub') && card.sub) ? card.sub : '');
    if(lead){
      y += 44; x.fillStyle = t.dim; x.font = '400 28px ' + t.body;
      x.fillText(wrap(x, lead, maxW, 1)[0] || '', PAD, y);
    }
    var top = y + 46;

    // ── нижня смуга: рахуємо знизу вгору, щоб знімкам дісталась решта ──
    var facts = factsOf(card, show);
    x.font = '400 19px ' + t.body;
    var warnLines = show('warn') ? wrap(x, WARN, maxW, 2) : [];
    var warnY = H - 96 - (warnLines.length ? (warnLines.length - 1) * 26 : 0);
    var valY = warnLines.length ? warnY - 54 : H - 116;
    var labY = valY - 44;
    var ruleY = facts.length ? labY - 42 : (warnLines.length ? warnY - 30 : H - 116);
    var imgBottom = ruleY - 46;

    shotsRow(x, imgs, PAD, top, maxW, Math.max(200, imgBottom - top), t);

    if(facts.length){
      x.strokeStyle = t.line; x.lineWidth = 2;
      x.beginPath(); x.moveTo(PAD, ruleY); x.lineTo(right, ruleY); x.stroke();
      var cw = maxW / facts.length;
      facts.forEach(function(f, i){
        var cx = PAD + i * cw + (i ? 34 : 0);
        eyebrow(x, f[0], cx, labY, t.dim, 19);
        var s = fitFont(x, f[1], cw - 60, f[2] ? 50 : 44, '800', t.body);
        x.fillStyle = f[2] ? t.accent : t.ink;
        x.font = '800 ' + s + 'px ' + t.body;
        x.fillText(f[1], cx, valY);
        // Розділювач між колонками — те, що робить смугу смугою
        if(i){
          x.strokeStyle = t.line; x.lineWidth = 1;
          x.beginPath();
          x.moveTo(PAD + i * cw, labY - 24);
          x.lineTo(PAD + i * cw, valY + 12);
          x.stroke();
        }
      });
    }
    if(warnLines.length){
      x.fillStyle = t.dim; x.font = '400 19px ' + t.body;
      warnLines.forEach(function(ln, i){ x.fillText(ln, PAD, warnY + i * 26); });
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
      var shots = await Promise.all((card.shots || []).map(function(sh){
        return loadImg(sh && sh.url);
      }));
      paintCard(x, card, t, shots, show, { logo: logo });
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
