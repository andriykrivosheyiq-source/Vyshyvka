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
   розрахунки. Менеджер керує тільки показом — шаблон, порядок, склад,
   заголовок, який мокап узяти. Змінив ціну в «Збиранні» — картка
   перемалювалась, бо власних чисел у неї немає.

   Малюємо на полотні, а не html2canvas: сторонньої бібліотеки тут не буде
   (та й мережа в збірці до неї не дотягується), а головне — preview й
   готовий файл мусять бути ОДНИМ кодом. Інакше «як побачить клієнт»
   рано чи пізно розійдеться з тим, що завантажилось.
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

  /* Шаблони міняють ТІЛЬКИ оформлення. Дані під ними однакові — інакше
     перемикання шаблону мовчки міняло б зміст картки, а не її вигляд. */
  var TEMPLATES = [
    { id:'minimal',   name:'Minimal',   note:'Білий фон, багато повітря, великий виріб' },
    { id:'editorial', name:'Editorial', note:'Журнальна подача, велика типографіка' },
    { id:'corporate', name:'Corporate', note:'Строгий формат для B2B' },
    { id:'industry',  name:'Industry',  note:'Візуальна тема під галузь' }
  ];

  /* Галузь обирає менеджер, а не автоматика: одна й та сама пропозиція може
     піти і в ресторан, і в клініку, і вгадати тут нізвідки. */
  var INDUSTRIES = [
    { id:'horeca',  name:'HoReCa',   ink:'#16332A', tint:'#EDF4EF', accent:'#2F7A5B' },
    { id:'auto',    name:'СТО',      ink:'#221C17', tint:'#F4F0EB', accent:'#B4531B' },
    { id:'medical', name:'Медицина', ink:'#12283A', tint:'#EAF2F8', accent:'#1C6FA8' },
    { id:'office',  name:'Офіс',     ink:'#1A1D26', tint:'#F0F2F6', accent:'#3B4B7A' }
  ];

  /* Які поля можна прибрати з картки. Ціна потрібна не завжди: буває, що
     в Direct спершу показують сам виріб, а числа називають словами. */
  var FIELDS = [
    { id:'sub',  name:'Колір і нанесення' },
    { id:'note', name:'Короткий опис' },
    { id:'qty',  name:'Кількість' },
    { id:'unit', name:'Ціна за штуку' },
    { id:'sum',  name:'Загальна сума' },
    { id:'term', name:'Термін' }
  ];

  function industryOf(id){
    for(var i = 0; i < INDUSTRIES.length; i++) if(INDUSTRIES[i].id === id) return INDUSTRIES[i];
    return INDUSTRIES[0];
  }

  /* ══════════ СКЛАД КАРТОК ══════════
     Збирається сам, із позицій пропозиції. Менеджер не «створює картку» —
     він може хіба прибрати зайву або переставити.

     Кожен варіант іде СВОЄЮ карткою: у Direct надсилають картинки по одній,
     і виріб, стиснутий до половини кадру заради сусіда, втрачає рівно те,
     заради чого картку й шлють. */
  function buildCards(offer, cfg){
    offer = offer || {};
    cfg = cfg || {};
    var by = cfg.by || {};
    var term = +(offer.terms || {}).deadlineDays || 0;
    var out = [];

    var pic = function(it){ return (it.mockups || []).filter(Boolean); };
    var subOf = function(it){
      return [it.color, it.print, it.sizes].filter(Boolean).join(' · ');
    };
    var card = function(id, kind, it){
      var own = by[id] || {};
      var pics = pic(it);
      return {
        id: id, kind: kind, type: 'item',
        name: own.title || it.name || 'Позиція',
        sub: subOf(it),
        note: own.note != null ? own.note : (it.recoNote || ''),
        qty: +it.qty || 0,
        unit: +it.unitPrice || 0,
        sum: +it.price || (+it.unitPrice || 0) * (+it.qty || 0),
        term: term,
        badge: kind === 'variant' ? 'варіант на вибір'
             : (it.optional ? 'на вибір' : ''),
        pics: pics,
        pic: (own.pic && pics.indexOf(own.pic) >= 0) ? own.pic : (pics[0] || ''),
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
      /* Порядок плиток — той самий, що в складі пропозиції, а не той, у
         якому менеджер наставив галочок. Інакше зняв і повернув галочку —
         і позиція без причини переїхала в кінець картки. */
      var picked = Array.isArray(own.pick)
        ? own.pick.filter(function(i){ return pool[i]; })
                  .sort(function(a, b){ return a - b; }).slice(0, 4)
        : [];
      if(!picked.length) picked = pool.map(function(r, i){ return i; }).slice(0, 4);
      out.push({
        id: 'reco', kind: 'reco', type: 'set',
        name: own.title || 'Можемо доповнити комплект',
        note: own.note || '',
        term: term,
        items: picked.map(function(i){
          var r = pool[i];
          return { name: r.name || '', unit: +r.unitPrice || 0,
                   qty: +r.qty || 0, pic: pic(r)[0] || '' };
        }),
        // Увесь список — щоб панель показала, з чого саме обирають
        pool: pool.map(function(r, i){
          return { i: i, name: r.name || '', on: picked.indexOf(i) >= 0 };
        }),
        max: 4,
        hidden: !!(cfg.hidden || {})['reco']
      });
    }

    /* Порядок менеджера головніший за природний, але не може нічого
       загубити: позиція, доданої після того, як порядок склали, просто
       стає в кінець, а не зникає з карток. */
    var want = Array.isArray(cfg.order) ? cfg.order : [];
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
  // Розріджений капітелью надпис — ним підписані всі дрібні мітки
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

  /* ══════════ ТЕМА ШАБЛОНУ ══════════
     Кольори й шрифти в одному місці: тоді розкладка думає про розкладку, а
     не про те, який зараз шаблон. */
  function themeOf(tpl, cfg, accent){
    var ind = industryOf(cfg.industry);
    if(tpl === 'editorial')
      return { bg:'#F5F1E8', panel:'#EBE5D8', ink:'#1A1710', dim:'#7A7263',
               line:'#D6CDBA', accent: accent, display: SERIF, body: SANS };
    if(tpl === 'corporate')
      return { bg:'#FFFFFF', panel:'#F5F7FA', ink:'#101828', dim:'#667085',
               line:'#D7DEE8', accent: accent, display: SANS, body: SANS };
    if(tpl === 'industry')
      return { bg: ind.tint, panel:'#FFFFFF', ink: ind.ink, dim:'rgba(0,0,0,.45)',
               line:'rgba(0,0,0,.12)', accent: ind.accent, display: SANS, body: SANS,
               industry: ind };
    return { bg:'#FFFFFF', panel:'#F4F6F9', ink:'#0F2034', dim:'#7C8798',
             line:'#E4E9F0', accent: accent, display: SANS, body: SANS };
  }

  /* Футер. Картку пересилають далі — по ній має бути зрозуміло, чия вона й
     до якої пропозиції належить. Рядок дрібний і стоїть у полі, тож виробу
     не заважає. */
  function footer(x, t, offer){
    x.fillStyle = t.dim;
    x.font = '400 22px ' + t.body;
    var left = 'Комерційна пропозиція' + (offer.orderId ? ' № ' + offer.orderId : '');
    x.fillText(left, PAD, H - 46);
    x.textAlign = 'right';
    x.fillText('loomiq.net', W - PAD, H - 46);
    x.textAlign = 'left';
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

  /* ══════════ РОЗКЛАДКИ ══════════
     Minimal і Industry — одна розкладка з різним оформленням: виріб на
     панелі ліворуч, підписи й числа праворуч. Писати її двічі означало б
     правити потім теж двічі.

     Права колонка вирівнюється по ЦЕНТРУ висоти цілим блоком. Доти назва
     стояла зверху, числа знизу, а посередині лишалась діра на пів картки —
     і виглядало це так, ніби щось не домалювалось. */
  function paintSheet(x, card, t, img, show, o){
    o = o || {};
    var panelW = o.panelW || 940;
    var panelH = H - PAD * 2 - 40;
    x.fillStyle = t.panel;
    rr(x, PAD, PAD, panelW, panelH, o.radius || 28); x.fill();
    if(img) fit(x, img, PAD + 50, PAD + 50, panelW - 100, panelH - 100);
    else placeholder(x, PAD, PAD, panelW, panelH, t.ink);

    var X = PAD + panelW + 84, right = W - PAD, maxW = right - X;
    var top = card.badge || o.eyebrow;

    x.font = '800 74px ' + t.display;
    var nameLines = wrap(x, card.name, maxW, 3);
    x.font = '400 27px ' + t.body;
    var subLines = (show('sub') && card.sub) ? wrap(x, card.sub, maxW, 2) : [];
    x.font = '400 28px ' + t.body;
    var noteLines = (show('note') && card.note) ? wrap(x, card.note, maxW, 3) : [];
    var facts = factsOf(card, show);

    var headH = (top ? 46 : 0) + nameLines.length * 78 +
                (subLines.length ? 44 + (subLines.length - 1) * 36 : 0) +
                (noteLines.length ? 52 + (noteLines.length - 1) * 40 : 0);
    var factsH = facts.length ? 48 + (facts.length - 1) * 86 : 0;
    var y = Math.max(PAD + 26, Math.round((H - (headH + 90 + factsH)) / 2));

    if(top){ eyebrow(x, top, X, y, t.accent, 20); y += 46; }
    x.fillStyle = t.ink; x.font = '800 74px ' + t.display;
    nameLines.forEach(function(ln){ y += 78; x.fillText(ln, X, y); });
    if(subLines.length){
      y += 44; x.fillStyle = t.dim; x.font = '400 27px ' + t.body;
      subLines.forEach(function(ln, i){ x.fillText(ln, X, y + i * 36); });
      y += (subLines.length - 1) * 36;
    }
    if(noteLines.length){
      y += 52; x.fillStyle = t.ink; x.font = '400 28px ' + t.body;
      noteLines.forEach(function(ln, i){ x.fillText(ln, X, y + i * 40); });
      y += (noteLines.length - 1) * 40;
    }
    if(!facts.length) return;
    y += 90;
    x.strokeStyle = t.line; x.lineWidth = 2;
    x.beginPath(); x.moveTo(X, y - 48); x.lineTo(right, y - 48); x.stroke();
    facts.forEach(function(f, i){ factRow(x, t, f, X, right, y + i * 86); });
  }
  function paintMinimal(x, card, t, img, show){
    paintSheet(x, card, t, img, show, { panelW:940, radius:28 });
  }

  function paintEditorial(x, card, t, img, show){
    /* Виріб праворуч і на весь зріст — як розворот у журналі. Смуга біла, а
       не кремова: мокапи здебільшого йдуть із білим тлом, і на кремовому
       навколо них проступав би світлий прямокутник. */
    var imgX = W * 0.46;
    x.fillStyle = '#FFFFFF';
    x.fillRect(imgX, 0, W - imgX, H);
    if(img) fit(x, img, imgX + 40, 60, W - imgX - 80, H - 120);
    else placeholder(x, imgX, 0, W - imgX, H, t.ink);

    var X = PAD, maxW = imgX - PAD - 70;
    var y = PAD + 30;
    eyebrow(x, card.badge || 'Пропозиція', X, y, t.accent, 20);
    y += 30;

    x.fillStyle = t.ink;
    x.font = '400 92px ' + t.display;
    wrap(x, card.name, maxW, 3).forEach(function(ln){ y += 100; x.fillText(ln, X, y); });

    y += 34;
    x.strokeStyle = t.line; x.lineWidth = 3;
    x.beginPath(); x.moveTo(X, y); x.lineTo(X + 160, y); x.stroke();

    if(show('sub') && card.sub){
      y += 52; x.fillStyle = t.dim; x.font = '400 27px ' + t.body;
      wrap(x, card.sub, maxW, 2).forEach(function(ln, i){ x.fillText(ln, X, y + i * 36); y += i ? 36 : 0; });
    }
    if(show('note') && card.note){
      y += 50; x.fillStyle = t.ink; x.font = '400 30px ' + t.display;
      wrap(x, card.note, maxW, 4).forEach(function(ln, i){ x.fillText(ln, X, y + i * 42); y += i ? 42 : 0; });
    }

    /* Числа — сіткою 2×2, а не рядком у чотири колонки. У рядку «7 робочих
       днів» і «45 540 грн» не вміщались у свою четвертину й налазили на
       сусідів: підпис однієї колонки опинявся всередині числа іншої. */
    var facts = factsOf(card, show);
    if(!facts.length) return;
    var cw = maxW / 2, rowH = 108;
    var rows = Math.ceil(facts.length / 2);
    var fy = H - PAD - 76 - (rows - 1) * rowH;
    facts.forEach(function(f, i){
      var fx = X + (i % 2) * cw, yy = fy + Math.floor(i / 2) * rowH;
      eyebrow(x, f[0], fx, yy, t.dim, 17);
      var s = fitFont(x, f[1], cw - 30, f[2] ? 44 : 38, '400', t.display);
      x.fillStyle = f[2] ? t.accent : t.ink;
      x.font = '400 ' + s + 'px ' + t.display;
      x.fillText(f[1], fx, yy + 52);
    });
  }

  function paintCorporate(x, card, t, img, show){
    x.fillStyle = t.accent; x.fillRect(0, 0, W, 14);

    var panelW = 820, panelY = 210;
    x.strokeStyle = t.line; x.lineWidth = 2;
    rr(x, PAD, panelY, panelW, H - panelY - 150, 10);
    x.fillStyle = t.panel; x.fill(); x.stroke();
    if(img) fit(x, img, PAD + 40, panelY + 40, panelW - 80, H - panelY - 230);
    else placeholder(x, PAD, panelY, panelW, H - panelY - 150, t.ink);

    var X = PAD + panelW + 80, maxW = W - PAD - X;
    eyebrow(x, card.badge || 'Позиція пропозиції', PAD, 92, t.dim, 19);

    var y = panelY - 10;
    x.fillStyle = t.ink; x.font = '700 62px ' + t.display;
    wrap(x, card.name, maxW, 2).forEach(function(ln){ y += 70; x.fillText(ln, X, y); });
    if(show('sub') && card.sub){
      y += 46; x.fillStyle = t.dim; x.font = '400 25px ' + t.body;
      wrap(x, card.sub, maxW, 2).forEach(function(ln, i){ x.fillText(ln, X, y + i * 34); y += i ? 34 : 0; });
    }
    if(show('note') && card.note){
      y += 44; x.fillStyle = t.ink; x.font = '400 26px ' + t.body;
      wrap(x, card.note, maxW, 3).forEach(function(ln, i){ x.fillText(ln, X, y + i * 36); y += i ? 36 : 0; });
    }

    /* Таблиця: підпис ліворуч, число праворуч, тонкі лінійки між рядками.
       Тримаємо її по центру висоти панелі з виробом — інакше між описом і
       числами лишалась діра на пів картки. */
    var facts = factsOf(card, show);
    if(!facts.length) return;
    var mid = (panelY + (H - 150)) / 2;
    var ty = Math.max(y + 80, Math.round(mid - facts.length * 78 / 2) + 30);
    facts.forEach(function(f, i){
      var yy = ty + i * 78;
      // Плашка ширша за число з обох боків: доти сума впиралась просто в її край
      if(f[2]){ x.fillStyle = t.panel; rr(x, X - 22, yy - 44, maxW + 44, 70, 8); x.fill(); }
      x.fillStyle = t.dim; x.font = '600 24px ' + t.body;
      x.fillText(f[0], X, yy);
      var lw = x.measureText(f[0]).width;
      var s = fitFont(x, f[1], maxW - lw - 30, f[2] ? 40 : 32, f[2] ? '800' : '700', t.body);
      x.textAlign = 'right';
      x.fillStyle = f[2] ? t.accent : t.ink;
      x.font = (f[2] ? '800 ' : '700 ') + s + 'px ' + t.body;
      x.fillText(f[1], W - PAD, yy + 4);
      x.textAlign = 'left';
      x.strokeStyle = t.line; x.lineWidth = 1;
      x.beginPath(); x.moveTo(X, yy + 30); x.lineTo(W - PAD, yy + 30); x.stroke();
    });
  }

  function paintIndustry(x, card, t, img, show){
    // Виріб — на білій картці поверх галузевого тла: тло задає настрій,
    // але виріб від нього не фарбується
    x.fillStyle = t.accent;
    x.globalAlpha = 0.10;
    x.beginPath(); x.arc(W - 220, -80, 620, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;
    paintSheet(x, card, t, img, show, {
      panelW: 900, radius: 32,
      eyebrow: (t.industry ? t.industry.name : '') + (card.badge ? ' · ' + card.badge : '')
    });
  }

  /* Картка рекомендованих. Плитками, бо тут порівнюють, а не роздивляються:
     питання не «який саме цей виріб», а «чим доповнити». */
  function paintSet(x, card, t, imgs, show){
    var y = PAD + 40;
    eyebrow(x, 'До вашого замовлення', PAD, y, t.accent, 20);
    y += 76;
    x.fillStyle = t.ink; x.font = '800 62px ' + t.display;
    x.fillText(card.name, PAD, y);

    var n = Math.max(1, card.items.length);
    var gap = 40;
    var tileW = (W - PAD * 2 - gap * (n - 1)) / n;
    var top = y + 70, tileH = H - top - 150;
    card.items.forEach(function(it, i){
      var X = PAD + i * (tileW + gap);
      x.fillStyle = t.panel;
      rr(x, X, top, tileW, tileH, 22); x.fill();
      var picH = tileH - 150;
      if(imgs[i]) fit(x, imgs[i], X + 28, top + 28, tileW - 56, picH - 28);
      else placeholder(x, X, top, tileW, picH, t.ink);
      x.fillStyle = t.ink; x.font = '700 30px ' + t.body;
      var nm = wrap(x, it.name, tileW - 56, 2);
      nm.forEach(function(ln, k){ x.fillText(ln, X + 28, top + picH + 34 + k * 36); });
      if(show('unit') && it.unit){
        x.fillStyle = t.accent; x.font = '800 34px ' + t.body;
        x.fillText(money(it.unit), X + 28, top + tileH - 30);
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
    var t = themeOf(cfg.tpl || 'minimal', cfg, accentFrom(logo, '#E8590C'));

    x.fillStyle = t.bg; x.fillRect(0, 0, W, H);

    if(card.type === 'set'){
      var imgs = await Promise.all(card.items.map(function(it){ return loadImg(it.pic); }));
      paintSet(x, card, t, imgs, show);
    } else {
      var img = await loadImg(card.pic);
      if(cfg.tpl === 'editorial') paintEditorial(x, card, t, img, show);
      else if(cfg.tpl === 'corporate') paintCorporate(x, card, t, img, show);
      else if(cfg.tpl === 'industry') paintIndustry(x, card, t, img, show);
      else paintMinimal(x, card, t, img, show);
    }
    footer(x, t, offer || {});
    return cv;
  }

  /* Імʼя файлу. Номер попереду — щоб у теці картки лягли в тому самому
     порядку, у якому їх склав менеджер, а не за абеткою. */
  function fileName(card, i, offer, ext){
    var n = String(i + 1);
    if(n.length < 2) n = '0' + n;
    var base = 'kp-' + ((offer || {}).orderId || 'loomiq') + '-' + n + '-' +
               String(card.name || 'kartka').toLowerCase().replace(/\s+/g, '-');
    return base + '.' + (ext || 'png');
  }

  window.LQCards = {
    W: W, H: H,
    TEMPLATES: TEMPLATES, INDUSTRIES: INDUSTRIES, FIELDS: FIELDS,
    build: buildCards, draw: drawCard, fileName: fileName, money: money
  };
})();
