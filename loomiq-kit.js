/* ══════════════════════════════════════════════════════════════════════════
   LOOMIQ KIT — спільний двигун квізу (/quiz/) і міні-сайту клієнта (/k/)

   Одне місце для всього, що мусить збігатись на обох сторінках:
     • каталог — catalog-base.js + loomiq/photos (вироби, кольори, знімки);
     • розміщення — зони нанесення й нумеровані місця з адмінки
       (printAreas), сантиметри — як для цеху;
     • мокап — фото виробу + логотип (дві сторони — поруч);
     • ціна — дескриптор для LQ.priceOrder (рушій КП);
     • заявка — Telegram (воркер заявок) і хмара (Cloudinary).
   Квіз і міні-сайт показують той самий логотип на тому самому місці за
   ту саму ціну саме тому, що рахують це тут, а не кожен у себе.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var W = window, D = document;
  var LEAD_URL = 'https://loomiq-lead.stvory.workers.dev';
  var CLOUD = { cloud:'kmdoab3e', preset:'v8gljepg' };
  var FB = {
    apiKey: "AIzaSyDf7WmfVlny7T8SBo9N_Xr7TorWYdrDqTc",
    authDomain: "loomiq-admin.firebaseapp.com",
    projectId: "loomiq-admin",
    storageBucket: "loomiq-admin.firebasestorage.app",
    messagingSenderId: "828527183830",
    appId: "1:828527183830:web:69895ce3f3c5505d014677"
  };
  var BASE = W.LQ_BASE || { garments: [], colors: {}, angles: {} };
  var MAP = {};                       // '<виріб>-<колір>-<ракурс>' → адреса знімка (адмінка)
  W.SITE_CONTENT = W.SITE_CONTENT || {};
  var C = W.SITE_CONTENT;
  var db = null;

  var SPHERES = [
    { id:'cafe',   name:'Кавʼярня, ресторан, бар',  g:['tee','teeover','cap','tote'] },
    { id:'build',  name:'Будівництво, виробництво', g:['tee','hoodie','sweat','cap'] },
    { id:'it',     name:'IT та офіс',               g:['hoodie','hoodiezip','teeover','tote'] },
    { id:'beauty', name:'Салон, студія, клініка',   g:['tee','teeover','tote'] },
    { id:'sport',  name:'Спорт і команда',          g:['tee','hoodieover','cap'] },
    { id:'event',  name:'Школа, курси, івент',      g:['tee','hoodie','tote','cap'] },
    { id:'shop',   name:'Магазин, сервіс, доставка', g:['tee','hoodie','cap'] },
    { id:'other',  name:'Інше',                     g:[] }
  ];

  /* ВАРІАНТИ РОЗМІЩЕННЯ. Андрій: «різниця буде в розміщенні логотипу».
     Розміри — як шиє цех: «на серці» ~9 см, по центру грудей до 24 см,
     спина до 28 см; далі все одно вписуємо в зону нанесення виробу. */
  var PLACES = {
    left:   { name:'На серці',          side:'front', d:'класика, акуратно' },
    center: { name:'По центру грудей',  side:'front', d:'помітно, як бренд' },
    back:   { name:'Велике на спині',   side:'back',  d:'максимум уваги' },
    acc:    { name:'По центру',         side:'front', d:'' }
  };
  var ACCESSORY = { cap:1, tote:1 };
  var DEF_HEIGHT = { tee:72, teeover:74, hoodie:70, hoodieover:72, hoodieoverfleece:72, hoodiezip:70,
                     sweat:68, cap:18, tote:40 };


  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function грн(n){ return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴'; }
  function см(n){ return (Math.round(n * 10) / 10).toString().replace('.', ','); }

  /* ── Каталог ── */
  function key(gid, cid, side){ return gid + '-' + cid + '-' + side; }
  function picOf(gid, cid, side){ var k = key(gid, cid, side); return MAP[k] || ('/images/' + k + '.webp'); }
  function garments(){
    var prod = C.products || {}, hidden = prod.hidden || [], pcols = C.productColors || {};
    var list = [];
    BASE.garments.forEach(function(g){ if(hidden.indexOf(g.id) < 0) list.push({ id:g.id, name:g.name, colors: BASE.colors[g.id] || [] }); });
    (prod.custom || []).forEach(function(c){
      if(c && c.id && hidden.indexOf(c.id) < 0) list.push({ id:c.id, name:c.name || c.id, colors: c.colors || [] });
    });
    list.forEach(function(g){
      if(Array.isArray(pcols[g.id]) && pcols[g.id].length) g.colors = pcols[g.id];
      g.name = (C.names || {})[g.id] || g.name;
      g.colors = (g.colors || []).filter(function(c){ return c && c.id; });
    });
    var TOP = ['tee','teeover','hoodie','hoodieover','hoodieoverfleece','hoodiezip','sweat','cap','tote'];
    return list.filter(function(g){ return g.colors.length; })
      .map(function(g, i){ var t = TOP.indexOf(g.id); return { g:g, r: t < 0 ? 99 + i : t }; })
      .sort(function(a, b){ return a.r - b.r; }).map(function(x){ return x.g; });
  }
  function gOf(gid){ return garments().filter(function(g){ return g.id === gid; })[0] || null; }

  function loadImg(src){
    return new Promise(function(res){
      if(!src) return res(null);
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function(){ res(im); }; im.onerror = function(){ res(null); };
      im.src = src;
    });
  }
  function withTimeout(p, ms){
    return Promise.race([p, new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('timeout')); }, ms); })]);
  }

  /* ══════════ РОЗМІЩЕННЯ ══════════
     Та сама геометрія, що й у конструкторі (recPrintBox): зона нанесення —
     многокутник у частках «каліброваної висоти» виробу (від calibTop до
     calibBottom), центр — calibCx. Одна така одиниця = висота виробу в см
     (printAreas[gid].heightCm). Звідси сантиметри — чесні, як для цеху. */
  function heightCm(gid){
    var pa = (C.printAreas || {})[gid] || {};
    if(+pa.heightCm > 0) return +pa.heightCm;
    var hs = ((C.pricing || {}).heights || {});
    if(+hs[gid] > 0) return +hs[gid] / 10;
    return DEF_HEIGHT[gid] || 70;
  }
  function polyOf(cfg){
    var pts = (cfg.pts || []).map(function(p){ return Array.isArray(p) ? [+p[0], +p[1]] : [+(p && p.x) || 0, +(p && p.y) || 0]; });
    if(cfg.symmetric === false) return pts;
    return pts.concat(pts.slice(1, -1).reverse().map(function(p){ return [-p[0], p[1]]; }));
  }
  function zoneCfg(gid, side, cid){
    var a = ((C.printAreas || {})[gid] || {})[side];
    if(!a) return null;
    var cfg = (a.colors && a.colors[cid]) ? a.colors[cid] : a.base;
    return (cfg && cfg.pts && cfg.pts.length >= 3) ? cfg : null;
  }
  /* Без намальованої зони — рамка виробу на фото (як recGarmentBox) і
     типові пропорції зони: груди від 18% до 72% висоти, ширина ±30%. */
  function garmentBox(im){
    var box = { x0:0.1, y0:0.05, x1:0.9, y1:0.95 };
    try{
      var k = Math.min(1, 120 / Math.max(im.naturalWidth, im.naturalHeight));
      var w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
      var c = D.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
      var a = x.getImageData(0, 0, w, h).data, br = a[0], bg = a[1], bb = a[2];
      var rows = new Uint16Array(h), cols = new Uint16Array(w);
      for(var i = 0; i < w * h; i++){
        var o = i * 4;
        if(Math.abs(a[o] - br) + Math.abs(a[o+1] - bg) + Math.abs(a[o+2] - bb) <= 26) continue;
        var px = i % w; rows[(i - px) / w]++; cols[px]++;
      }
      var y0 = -1, y1 = -1, x0 = -1, x1 = -1;
      for(var r = 0; r < h; r++) if(rows[r] > Math.max(2, w * 0.02)){ if(y0 < 0) y0 = r; y1 = r; }
      for(var q = 0; q < w; q++) if(cols[q] > Math.max(2, h * 0.02)){ if(x0 < 0) x0 = q; x1 = q; }
      if(y1 > y0 && x1 > x0) box = { x0:x0 / w, y0:y0 / h, x1:(x1 + 1) / w, y1:(y1 + 1) / h };
    }catch(e){}
    return box;
  }
  function frameOf(gid, side, cid, im){
    var natW = im.naturalWidth, natH = im.naturalHeight;
    var cfg = zoneCfg(gid, side, cid);
    if(!cfg){
      var b = garmentBox(im), span0 = b.y1 - b.y0, kx0 = span0 * natH / natW;
      var hw = 0.30 * (b.x1 - b.x0) / kx0;
      cfg = { calibTop: b.y0, calibBottom: b.y1, calibCx: (b.x0 + b.x1) / 2, symmetric: false,
              pts: ACCESSORY[gid] ? [[-hw, 0.25], [hw, 0.25], [hw, 0.75], [-hw, 0.75]]
                                  : [[-hw, side === 'back' ? 0.15 : 0.18], [hw, side === 'back' ? 0.15 : 0.18], [hw, 0.72], [-hw, 0.72]] };
    }
    var calT = cfg.calibTop != null ? +cfg.calibTop : 0.06, calB = cfg.calibBottom != null ? +cfg.calibBottom : 0.96;
    var calX = cfg.calibCx != null ? +cfg.calibCx : 0.5, span = calB - calT;
    var ux0 = 1e9, ux1 = -1e9, uy0 = 1e9, uy1 = -1e9;
    polyOf(cfg).forEach(function(p){ ux0 = Math.min(ux0, p[0]); ux1 = Math.max(ux1, p[0]); uy0 = Math.min(uy0, p[1]); uy1 = Math.max(uy1, p[1]); });
    var H = heightCm(gid);
    return { H:H, x0: ux0 * H, x1: ux1 * H, top: uy0 * H, bot: uy1 * H,
             fx: function(cm){ return calX + cm / H * span * natH / natW; },
             fy: function(cm){ return calT + cm / H * span; },
             fw: function(cm){ return cm / H * span * natH / natW; } };
  }
  function fit(maxW, maxH, ar){
    var w = maxW, h = w * ar;
    if(h > maxH){ h = maxH; w = h / ar; }
    return { w: w, h: h };
  }
  /* Де лежить логотип у варіанті — у сантиметрах від центру й від верху
     виробу, і далі в частках фото. */
  function placeOn(gid, place, fr, ar){
    var zw = fr.x1 - fr.x0, zh = fr.bot - fr.top, s, cx, top;
    if(place === 'acc'){
      s = fit(zw * 0.78, zh * 0.78, ar); cx = (fr.x0 + fr.x1) / 2; top = fr.top + (zh - s.h) / 2;
    } else if(place === 'left'){
      s = fit(Math.min(9, zw * 0.42), Math.min(9, zh * 0.5), ar);
      /* «На серці» — ліва сторона того, хто вдягнув, тобто ПРАВА на фото. */
      cx = Math.max(s.w / 2 + 0.5, Math.min(fr.x1 - s.w / 2 - 0.5, fr.x1 * 0.55));
      top = fr.top + 1.5;
    } else if(place === 'center'){
      s = fit(Math.min(24, zw * 0.8), Math.min(24, zh * 0.62), ar); cx = (fr.x0 + fr.x1) / 2; top = fr.top + 2.5;
    } else {
      s = fit(Math.min(28, zw * 0.85), Math.min(32, zh * 0.72), ar); cx = (fr.x0 + fr.x1) / 2; top = fr.top + 3;
    }
    if(top + s.h > fr.bot) top = Math.max(fr.top, fr.bot - s.h);
    return { wCm: s.w, hCm: s.h, cx: fr.fx(cx), cy: fr.fy(top + s.h / 2), w: fr.fw(s.w) };
  }
  /* НУМЕРОВАНІ МІСЦЯ (06.10). Андрій: «ставимо одиничку — логотип
     спереду; двійку — спереду й ззаду». Менеджер ставить їх в адмінці
     (Області нанесення → Місця логотипа): рамка з номером на стороні
     виробу. Варіант №N = усі рамки з цим номером. Немає рамок у товару —
     лишаються автоматичні варіанти нижче. */
  var SIDE_W = { front:'спереду', back:'на спині', left:'лівий бік', right:'правий бік' };
  function boxesOf(gid){
    var pa = (C.printAreas || {})[gid] || {}, out = [];
    Object.keys(pa).forEach(function(side){
      var sd = pa[side];
      if(sd && typeof sd === 'object' && Array.isArray(sd.places))
        sd.places.forEach(function(q){ if(q && +q.w > 0 && +q.h > 0) out.push({ n: Math.max(1, Math.round(+q.n || 1)), side: side, x: +q.x || 0, y: +q.y || 0, w: +q.w, h: +q.h }); });
    });
    return out;
  }
  function vinfo(gid, key){
    var m = /^n(\d+)$/.exec(key);
    if(m){
      var n = +m[1], bx = boxesOf(gid).filter(function(b){ return b.n === n; });
      var sides = [];
      bx.forEach(function(b){ if(sides.indexOf(b.side) < 0) sides.push(b.side); });
      sides.sort(function(a, b){ return (a === 'front' ? 0 : a === 'back' ? 1 : 2) - (b === 'front' ? 0 : b === 'back' ? 1 : 2); });
      var where = sides.map(function(sd){ return SIDE_W[sd] || sd; }).join(' + ');
      return { name: 'Варіант ' + n, d: where, sides: sides, boxes: bx };
    }
    var P = PLACES[key] || PLACES.center;
    return { name: P.name, d: P.d, sides: [P.side], place: key };
  }
  function placesFor(gid){
    var ns = [];
    boxesOf(gid).forEach(function(b){ if(ns.indexOf(b.n) < 0) ns.push(b.n); });
    if(ns.length) return ns.sort(function(a, b){ return a - b; }).map(function(n){ return 'n' + n; });
    if(ACCESSORY[gid]) return ['acc'];
    if(gid === 'hoodiezip') return ['left', 'back'];   // по центру — блискавка
    return ['left', 'center', 'back'];
  }
  /* Мокап: фото виробу + логотип. Полотно «зіпсоване» чужим доменом — тоді
     показуємо накладанням (картинка поверх фото), а в замовлення йде лише
     геометрія й сам логотип. */
  /* Рамка з номером → де лежить логотип. Вписуємо і в ширину, і у висоту
     (Андрій: «більше не можна»), по центру рамки. */
  function placeBox(b, fr, ar){
    var s = fit(b.w * fr.H, b.h * fr.H, ar);
    return { wCm: s.w, hCm: s.h, cx: fr.fx(b.x * fr.H), cy: fr.fy(b.y * fr.H), w: fr.fw(s.w) };
  }
  /* Мокап варіанту: фото кожної сторони варіанту з логотипами; дві
     сторони (спереду + спина) — поруч на одній картинці. Полотно «зіпсоване»
     чужим доменом — тоді показуємо накладанням, а в замовлення йде лише
     геометрія й сам логотип. */
  function renderMock(gid, cid, key, logoIm, logo){
    var v = vinfo(gid, key);
    return Promise.all(v.sides.map(function(side){ return loadImg(picOf(gid, cid, side)); })).then(function(ims){
      var panels = [];
      v.sides.forEach(function(side, i){
        var im = ims[i]; if(!im) return;
        var fr = frameOf(gid, side, cid, im);
        var ps = v.boxes ? v.boxes.filter(function(b){ return b.side === side; }).map(function(b){ return placeBox(b, fr, logo.ar); })
                         : [placeOn(gid, v.place, fr, logo.ar)];
        panels.push({ im: im, side: side, ps: ps });
      });
      if(!panels.length) return null;
      var H0 = Math.min(1000, Math.max.apply(null, panels.map(function(p){ return p.im.naturalHeight; })));
      var widths = panels.map(function(p){ return Math.round(p.im.naturalWidth * H0 / p.im.naturalHeight); });
      var c = D.createElement('canvas');
      c.width = widths.reduce(function(a, b){ return a + b; }, 0); c.height = H0;
      var x = c.getContext('2d'), x0 = 0;
      panels.forEach(function(pn, i){
        var w = widths[i];
        x.drawImage(pn.im, x0, 0, w, H0);
        pn.ps.forEach(function(p){
          var lw = p.w * w, lh = lw * logo.ar;
          x.drawImage(logoIm, x0 + p.cx * w - lw / 2, p.cy * H0 - lh / 2, lw, lh);
        });
        x0 += w;
      });
      var url = null;
      try{ url = c.toDataURL('image/jpeg', 0.86); }catch(e){}
      var parts = [];
      panels.forEach(function(pn){ pn.ps.forEach(function(p){
        parts.push({ side: pn.side, wCm: p.wCm, hCm: p.hCm, mm2: Math.round(p.wCm * p.hCm * 100 * (logo.ink || 0.5)) });
      }); });
      var p0 = panels[0].ps[0];
      return { url: url, photo: panels[0].im.src, p: p0, side: panels[0].side, parts: parts,
               wCm: p0.wCm, hCm: p0.hCm, mm2: parts.reduce(function(a, q){ return a + q.mm2; }, 0) };
    });
  }
  function sizeText(mk){
    return (mk.parts || [mk]).map(function(q){ return '~' + см(q.wCm) + ' × ' + см(q.hCm) + ' см'; }).join(' + ');
  }

  /* ══════════ ЦІНА — той самий рушій, що в КП ══════════ */
  function priced(){ return !!(W.LQ && W.LQ.priceOrder && C.pricing && C.pricing.methods); }
  function methodFor(gid){
    var ok = W.LQ && W.LQ.garmentAllows ? W.LQ.garmentAllows(gid, 'embro') : true;
    return ok ? 'embro' : 'dtf';
  }
  function baseFor(gid){ return +((C.pricing || {}).basePrices || {})[gid] || 0; }
  /* Ціну показуємо лише там, де відома ціна самого виробу: без неї вийшла б
     сума за саму вишивку — заниженa, і клієнт тримався б за неї. */
  function hasPrice(gid){ return priced() && baseFor(gid) > 0; }
  function dtfCol(m, wCm, hCm){
    var b = m.bands || [];
    for(var i = 0; i < b.length; i++){
      var SW = +b[i].w || 0, SH = +b[i].h || 0;
      if((wCm <= SW && hCm <= SH) || (wCm <= SH && hCm <= SW)) return i;
    }
    return Math.max(0, b.length - 1);
  }
  /* Кожне нанесення варіанту — окремо, як у конструкторі: найбільше бере
     найдорожчу мінімалку (індекс 0), далі — дешевші. Логотип один — макет
     теж один (той самий відбиток і адреса). */
  function desc(gid, mk, units){
    var mkey = methodFor(gid), m = ((C.pricing || {}).methods || {})[mkey] || {};
    var parts = (mk && mk.parts) ? mk.parts.slice() : [{ mm2: mk ? mk.mm2 : 3000, wCm: mk ? mk.wCm : 10, hCm: mk ? mk.hCm : 10 }];
    parts.sort(function(a, b){ return b.mm2 - a.mm2; });
    var grid = m.mode === 'grid', co = 0, bp = 0, mp = 0;
    if(!grid) parts.forEach(function(q, i){ var ps = W.LQ.placeSell(m, false, q.mm2, i); co += ps.total; bp += ps.base; mp += ps.minAdd; });
    return { method: grid ? 'dtf' : 'embro', units: Math.max(1, units), gid: gid, base: baseFor(gid),
             coefPart: co, basePart: bp, minPart: mp, pieceFee: +m.pieceFee || 0,
             dtfCols: grid ? parts.map(function(q){ return dtfCol(m, q.wCm, q.hCm); }) : [],
             designs: parts.map(function(){ return 'quiz-logo'; }), designUrls: parts.map(function(){ return 'quiz-logo'; }),
             designKinds: parts.map(function(){ return 'img'; }), designMm2: parts.map(function(q){ return q.mm2; }), bare: false };
  }

  function phoneNorm(v){
    var d = String(v || '').replace(/\D/g, '');
    if(d.length === 10 && d[0] === '0') d = '38' + d;
    if(d.length === 9) d = '380' + d;
    return d.length === 12 && d.slice(0, 2) === '38' ? '+' + d : null;
  }

  function lead(phone, context, files){
    return fetch(LEAD_URL, { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ phone: phoneNorm(phone) || phone, page: location.href, context: context,
                             files: files || [], ts: new Date().toISOString() }) })
      .then(function(r){ return r.ok; }).catch(function(){ return false; });
  }

  function upload(dataUrl){
    if(!dataUrl) return Promise.resolve(null);
    var fd = new FormData();
    fd.append('file', dataUrl); fd.append('upload_preset', CLOUD.preset);
    return fetch('https://api.cloudinary.com/v1_1/' + CLOUD.cloud + '/auto/upload', { method:'POST', body: fd })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ return (j && (j.secure_url || j.url)) || null; })
      .catch(function(){ return null; });
  }

  /* Завантаження каталогу з бази (loomiq/photos, публічне читання). */
  function boot(cb){
    var done = false;
    function fin(){ if(done) return; done = true; cb && cb(); }
    try{
      if(!W.firebase) throw new Error('no firebase');
      if(!firebase.apps.length) firebase.initializeApp(FB);
      db = firebase.firestore();
      db.collection('loomiq').doc('photos').get().then(function(snap){
        var d = (snap && snap.exists) ? (snap.data() || {}) : {};
        MAP = d.map || {};
        Object.keys(d).forEach(function(k){ if(k !== 'map') C[k] = d[k]; });
        fin();
      }, function(e){ console.warn('kit: база не відповіла', e); fin(); });
    }catch(e){ console.warn('kit: firebase не піднявся', e); fin(); }
    setTimeout(fin, 5000);
  }
  /* Нове замовлення в Канбан (колонка «Нове»). */
  function addOrder(order){
    return db ? db.collection('webOrders').add(JSON.parse(JSON.stringify(order)))
              : Promise.reject(new Error('база не підключилась'));
  }
  /* ПОСИЛАННЯ НА МІНІ-САЙТ. Усе потрібне — у самій адресі (після #):
     компанія, логотип (адреса в хмарі), вибраний одяг і кольори, тираж.
     Нічого не треба зберігати в базі й відкривати правилами для всіх:
     посилання живе, доки живе файл логотипа. */
  function b64(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s){ s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while(s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function kitLink(k){
    var d = { v:1, c: k.company || '', s: k.sphere || '', n: k.people || 0, l: k.logo, a: Math.round((k.ar || 1) * 1000) / 1000,
              i: Math.round((k.ink || 0.5) * 100) / 100, g: k.garments || [], col: k.colors || {} };
    return location.origin + '/k/#d=' + b64(JSON.stringify(d));
  }
  function kitRead(hash){
    var m = /d=([A-Za-z0-9_-]+)/.exec(hash || location.hash);
    if(!m) return null;
    try{
      var d = JSON.parse(unb64(m[1]));
      if(!d || !/^https:\/\//.test(d.l || '')) return null;
      return { company: String(d.c || '').slice(0, 80), sphere: d.s || '', people: Math.max(0, +d.n || 0),
               logo: { url: d.l, ar: +d.a || 1, ink: +d.i || 0.5 }, garments: Array.isArray(d.g) ? d.g : [], colors: d.col || {} };
    }catch(e){ return null; }
  }

  W.LQKit = {
    SPHERES: SPHERES, PLACES: PLACES, ACCESSORY: ACCESSORY,
    esc: esc, грн: грн, см: см, picOf: picOf, garments: garments, gOf: gOf, loadImg: loadImg, withTimeout: withTimeout,
    frameOf: frameOf, placeOn: placeOn, placeBox: placeBox, boxesOf: boxesOf, vinfo: vinfo, placesFor: placesFor,
    renderMock: renderMock, sizeText: sizeText, priced: priced, hasPrice: hasPrice, methodFor: methodFor, desc: desc,
    phoneNorm: phoneNorm, lead: lead, upload: upload, boot: boot, addOrder: addOrder,
    kitLink: kitLink, kitRead: kitRead
  };
})();
