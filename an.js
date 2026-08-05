/* ============================================================================
   Аналітика Loomiq
   ----------------------------------------------------------------------------
   Один файл на всі сторінки (головна, HoReCa, будівництво, комерційна
   пропозиція). Робить дві речі одночасно:

   1) Штовхає кожну подію в dataLayer → GTM → GA4.
      Там дивимось «зовнішню» картину: джерела трафіку, гео, пристрої,
      порівняння з рекламними кабінетами.

   2) Пише сесію відвідувача в Firestore (колекція an_sessions).
      Це те, чого GA4 не дасть: воронка нашого конструктора по кроках,
      прив'язка замовлення до конкретної реклами, і далі — маржа з Канбану.

   Скільки коштує. На кожну сесію припадає 3–6 записів у базу, не більше:
   перший через 2 секунди, далі не частіше ніж раз на 30 секунд і лише коли
   реально щось змінилось, і останній — коли вкладку ховають. Тобто 1000
   візитів на день ≈ 5 тисяч записів, це в межах безкоштовного тарифу.

   Кого НЕ рахуємо: свої заходи (?staff=1), режим менеджера (?manager=1)
   і будь-який показ сайту всередині iframe — адмінка так показує превʼю
   конструктора, і без цього фільтра власні заходи зіпсували б статистику
   з першого ж дня.

   Персональних даних тут немає: тільки випадковий ідентифікатор пристрою.
   Ім'я й телефон живуть у замовленні, дублювати їх в аналітику не треба.
   ========================================================================== */
(function(){
  'use strict';
  var W = window, D = document;
  if(W.lqAn) return;

  /* ---------- 1. Кого не рахуємо ------------------------------------- */
  var Q = {};
  try{ Q = new URLSearchParams(location.search); }catch(e){ Q = { get:function(){ return null; } }; }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

  if(Q.get('staff') === '1') lsSet('lq_staff', '1');
  if(Q.get('staff') === '0') lsDel('lq_staff');

  var inFrame = false;
  try{ inFrame = W.top !== W.self; }catch(e){ inFrame = true; }
  var OFF = inFrame || lsGet('lq_staff') === '1' || Q.get('manager') === '1';

  /* ---------- 2. Хто прийшов ------------------------------------------ */
  var ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
  function rnd(n){
    var s = '';
    for(var i = 0; i < n; i++) s += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
    return s;
  }

  var vid = lsGet('lq_vid'), newVisitor = false;
  if(!vid){ vid = rnd(14); lsSet('lq_vid', vid); newVisitor = true; }

  /* Сесія живе 30 хвилин без активності — так само рахує GA, щоб наші
     цифри й GA4 не розходились удвічі. */
  var SESSION_MS = 30 * 60 * 1000;
  var sid = lsGet('lq_sid');
  var sidAt = +lsGet('lq_sid_at') || 0;
  var newSession = !sid || (Date.now() - sidAt > SESSION_MS);

  /* ---------- 3. Звідки прийшов --------------------------------------- */
  function detectSrc(){
    var ref = D.referrer || '', refHost = '';
    try{ if(ref) refHost = new URL(ref).hostname.replace(/^www\./, ''); }catch(e){}
    if(refHost && refHost === location.hostname.replace(/^www\./, '')) refHost = '';

    var o = {
      source:   Q.get('utm_source')   || '',
      medium:   Q.get('utm_medium')   || '',
      campaign: Q.get('utm_campaign') || '',
      content:  Q.get('utm_content')  || '',
      term:     Q.get('utm_term')     || '',
      ref:      refHost
    };
    if(Q.get('gclid'))       o.click = 'gclid';
    else if(Q.get('fbclid')) o.click = 'fbclid';
    else if(Q.get('ttclid')) o.click = 'ttclid';

    /* Міток немає — впізнаємо джерело по реферу, інакше весь органічний
       трафік злився б в одну купу «прямі заходи». */
    if(!o.source){
      if(!refHost){ o.source = 'direct'; o.medium = 'none'; }
      else if(/(^|\.)google\./.test(refHost))            { o.source = 'google';    o.medium = 'organic'; }
      else if(/instagram\./.test(refHost))               { o.source = 'instagram'; o.medium = 'social';  }
      else if(/(facebook\.|^fb\.)/.test(refHost))        { o.source = 'facebook';  o.medium = 'social';  }
      else if(/(^t\.me$|telegram)/.test(refHost))        { o.source = 'telegram';  o.medium = 'social';  }
      else if(/tiktok\./.test(refHost))                  { o.source = 'tiktok';    o.medium = 'social';  }
      else if(/(bing\.|duckduckgo\.|yahoo\.|ecosia\.)/.test(refHost)){ o.source = refHost.split('.')[0]; o.medium = 'organic'; }
      else if(/(olx\.|prom\.ua|rozetka\.)/.test(refHost)){ o.source = refHost.split('.')[0]; o.medium = 'marketplace'; }
      else                                               { o.source = refHost;     o.medium = 'referral'; }
    }
    if(!o.medium) o.medium = o.click ? 'cpc' : 'referral';
    return o;
  }

  /* Нова рекламна мітка серед сесії = нова сесія: інакше замовлення
     припишеться першому джерелу, і оцінити другу рекламу буде нічим. */
  var savedSrc = null, firstSrc = null;
  try{ savedSrc = JSON.parse(lsGet('lq_src') || 'null'); }catch(e){}
  try{ firstSrc = JSON.parse(lsGet('lq_src_first') || 'null'); }catch(e){}
  var freshUtm = !!Q.get('utm_source');
  if(!newSession && freshUtm && savedSrc && savedSrc.source !== Q.get('utm_source')) newSession = true;

  var src;
  if(newSession || !savedSrc){
    src = detectSrc();
    lsSet('lq_src', JSON.stringify(src));
  } else {
    src = savedSrc;
  }
  /* Перший дотик запамʼятовується назавжди. Реклама зазвичай не продає з
     першого заходу: людина приходить з Instagram, а замовляє через тиждень
     «прямим» візитом. Без першого джерела вся виручка припишеться прямим
     заходам, і рекламу визнають збитковою помилково. */
  if(!firstSrc){ firstSrc = src; lsSet('lq_src_first', JSON.stringify(firstSrc)); }

  if(newSession){ sid = rnd(16); lsSet('lq_sid', sid); }
  lsSet('lq_sid_at', String(Date.now()));

  /* Котрий це візит цього відвідувача — видно, з якого разу починають купувати. */
  var visitNo = +lsGet('lq_visits') || 0;
  if(newSession){ visitNo++; lsSet('lq_visits', String(visitNo)); }
  if(!visitNo) visitNo = 1;

  /* Котра це сторінка в межах сесії. Кожне відкриття сторінки пише СВІЙ
     документ, а не дописує спільний: інакше друга сторінка затирала б час,
     накопичений на першій, і кожен перехід всередині сайту з'їдав би
     хвилини. Дві вкладки одночасно — та сама історія. Звіт збирає сесію
     назад по полю sid. */
  var pv = 1;
  if(newSession) lsSet('lq_pv', '1');
  else { pv = (+lsGet('lq_pv') || 1) + 1; lsSet('lq_pv', String(pv)); }
  var docId = sid + '.' + rnd(5);

  /* ---------- 4. З чого дивиться -------------------------------------- */
  function device(){
    var w = Math.round(W.innerWidth || 0), h = Math.round(W.innerHeight || 0);
    var ua = navigator.userAgent || '';
    var type = w < 768 ? 'mobile' : (w < 1024 ? 'tablet' : 'desktop');
    if(/iPad|Tablet/i.test(ua)) type = 'tablet';
    var os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
           : /Android/i.test(ua)          ? 'Android'
           : /Mac OS X/i.test(ua)         ? 'macOS'
           : /Windows/i.test(ua)          ? 'Windows'
           : /Linux/i.test(ua)            ? 'Linux' : 'інша';
    return { type:type, w:w, h:h, os:os, lang:(navigator.language || '').slice(0, 5) };
  }

  /* Дата за Києвом, а не за годинним поясом відвідувача — інакше нічні
     замовлення розповзались би по сусідніх днях звіту. */
  function dayKey(){
    try{ return new Date().toLocaleDateString('sv-SE', { timeZone:'Europe/Kyiv' }); }
    catch(e){ return new Date().toISOString().slice(0, 10); }
  }
  /* Година й день тижня — теж за Києвом: за ними вирішують, коли вмикати
     рекламу і коли менеджеру бути на звʼязку. */
  function kyivHour(){
    try{
      return +new Date().toLocaleString('en-GB', { timeZone:'Europe/Kyiv', hour:'2-digit', hour12:false }).slice(0, 2);
    }catch(e){ return new Date().getHours(); }
  }
  function kyivDow(){
    var names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    try{
      var s = new Date().toLocaleDateString('en-US', { timeZone:'Europe/Kyiv', weekday:'short' });
      var i = names.indexOf(s);
      return i < 0 ? new Date().getDay() : i;
    }catch(e){ return new Date().getDay(); }
  }

  /* Швидкість сторінки. Повільний сайт зливає рекламний бюджет мовчки:
     людина йде ще до того, як побачила перший екран, і в звіті це виглядає
     як «поганий трафік», хоча трафік нормальний. */
  var perf = {};
  try{
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation') || [])[0];
    if(nav && nav.responseStart) perf.ttfb = Math.round(nav.responseStart);
    if(W.PerformanceObserver){
      var po = new PerformanceObserver(function(list){
        var e = list.getEntries(); if(!e.length) return;
        perf.lcp = Math.round(e[e.length - 1].startTime);
      });
      po.observe({ type:'largest-contentful-paint', buffered:true });
    }
  }catch(e){}

  /* ---------- 5. Стан сесії ------------------------------------------- */
  var S = {
    sid: sid, vid: vid,
    site: W.LQ_SITE || (/\/offer\.html/.test(location.pathname) ? 'offer' : 'main'),
    newVisitor: newVisitor,
    startAt: new Date().toISOString(),
    day: dayKey(), hour: kyivHour(), dow: kyivDow(),
    visitNo: visitNo,
    land: (location.pathname || '/').slice(0, 120),
    exit: (location.pathname || '/').slice(0, 120),
    src: src, first: firstSrc, dev: device(),
    steps: {}, ev: {},
    /* Що саме дивились у конструкторі: виріб, колір, спосіб нанесення.
       Звідси видно, який товар возити на склад і які кольори тримати. */
    pick: {},
    /* Найбільша сума, яку людина набрала в кошику. Якщо замовлення не
       сталось — це і є вартість покинутого кошика, найдорожча втрата. */
    cart: { sum:0, qty:0 },
    firstActionSec: null,
    depth: 0, pv: pv,
    perf: perf,
    order: null
  };

  /* Воронка. Порядок важливий: у звіті кроки йдуть саме так, і кожен
     наступний автоматично зараховує попередні — людина не може додати
     в кошик, не відкривши конструктор, навіть якщо подія загубилась. */
  var FUNNEL = ['visit', 'ctor', 'design', 'size', 'cart', 'checkout', 'order'];

  /* ---------- 6. Скільки часу реально дивились ------------------------ */
  var activeSec = 0, lastAct = Date.now(), IDLE_MS = 30000;
  ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(function(t){
    W.addEventListener(t, function(){ lastAct = Date.now(); }, { passive:true });
  });
  setInterval(function(){
    if(D.visibilityState === 'visible' && Date.now() - lastAct < IDLE_MS){
      activeSec++;
      if(activeSec % 30 === 0) lsSet('lq_sid_at', String(Date.now()));
    }
  }, 1000);

  function scrollTick(){
    var full = Math.max(1, D.documentElement.scrollHeight - W.innerHeight);
    var d = Math.round(Math.min(1, Math.max(0, (W.scrollY || 0) / full)) * 100);
    if(d > S.depth) S.depth = d;
  }
  W.addEventListener('scroll', scrollTick, { passive:true });
  W.addEventListener('resize', scrollTick);
  scrollTick();

  /* ---------- 7. Запис у базу ----------------------------------------- */
  function getDb(){
    try{
      if(W.firebase && firebase.apps && firebase.apps.length) return firebase.firestore();
    }catch(e){}
    return null;
  }

  function snapshot(){
    return {
      sid: S.sid, vid: S.vid, site: S.site, day: S.day,
      hour: S.hour, dow: S.dow, visitNo: S.visitNo,
      newVisitor: S.newVisitor,
      startAt: S.startAt, endAt: new Date().toISOString(),
      sec: activeSec, depth: S.depth, pv: S.pv,
      /* Сторінка вважається «живою», якщо або довше десяти секунд, або це вже
         не перша сторінка сесії, або людина дійшла хоч до якоїсь дії. Решта —
         ті, хто відкрив і одразу пішов. */
      engaged: activeSec >= 10 || S.pv > 1 || !!S.steps.ctor,
      firstActionSec: S.firstActionSec,
      land: S.land, exit: S.exit,
      src: S.src, first: S.first, dev: S.dev,
      steps: S.steps, ev: S.ev, pick: S.pick,
      cart: S.cart, perf: S.perf,
      order: S.order
    };
  }

  var dirty = true, lastWrite = 0, timer = null, MIN_GAP = 30000;
  var retries = 0, MAX_RETRY = 6;

  /* Невдалий запис МАЄ повторитись сам. Раніше після збою прапорець
     «є що писати» лишався піднятим, але наступний запис планувався лише
     з чергової дії користувача — якщо людина більше нічого не натискала,
     весь візит зникав безслідно. Те саме, коли база ще не піднялась на
     момент першого запису. */
  function retry(){
    if(OFF || retries >= MAX_RETRY) return;
    retries++;
    if(timer) clearTimeout(timer);
    timer = setTimeout(function(){ timer = null; flush(); }, Math.min(30000, 1500 * retries));
  }

  function flush(){
    if(OFF) return;
    var db = getDb();
    if(!db){ retry(); return; }      // база ще не піднялась — спробуємо ще раз
    dirty = false;
    lastWrite = Date.now();
    try{
      db.collection('an_sessions').doc(docId).set(snapshot(), { merge:true })
        .then(function(){ retries = 0; })
        .catch(function(e){
          dirty = true; retry();
          if(W.console) console.warn('an: запис не пройшов', e && (e.code || e.message));
        });
    }catch(e){ dirty = true; retry(); }
  }

  function schedule(now){
    if(OFF) return;
    dirty = true;
    if(timer) return;
    var wait = now ? 0 : Math.max(0, MIN_GAP - (Date.now() - lastWrite));
    timer = setTimeout(function(){ timer = null; if(dirty) flush(); }, wait);
  }

  /* Останній запис — коли вкладку ховають. На телефоні це єдиний надійний
     момент: подія unload там часто не приходить взагалі. */
  D.addEventListener('visibilitychange', function(){
    if(D.visibilityState === 'hidden'){ if(timer){ clearTimeout(timer); timer = null; } flush(); }
  });
  W.addEventListener('pagehide', function(){ if(timer){ clearTimeout(timer); timer = null; } flush(); });

  /* ---------- 8. Публічний інтерфейс ---------------------------------- */
  function toGtm(name, params){
    try{
      W.dataLayer = W.dataLayer || [];
      var o = { event:'lq_' + name, lq_site:S.site, lq_vid:S.vid, lq_sid:S.sid };
      if(params) Object.keys(params).forEach(function(k){ o['lq_' + k] = params[k]; });
      W.dataLayer.push(o);
    }catch(e){}
  }

  var born = Date.now();
  function markAction(){
    if(S.firstActionSec == null) S.firstActionSec = Math.round((Date.now() - born) / 1000);
  }

  function track(name, params){
    if(!name) return;
    name = String(name).slice(0, 40);
    if(OFF) return;
    toGtm(name, params);
    /* Стеля на кількість різних ключів. Документ у базі не безмежний, а
       відкритий на запис — значить, хтось може спробувати його роздути. */
    if(S.ev[name] == null && Object.keys(S.ev).length >= 60) return;
    S.ev[name] = (S.ev[name] || 0) + 1;
    markAction();
    schedule();
  }

  /* Вибір усередині конструктора: виріб, колір, спосіб нанесення, шрифт.
     Один спільний словник із префіксом — у звіті групується по префіксу,
     і новий вид вибору не потребує нового поля в базі. */
  function pick(kind, value){
    if(OFF || !kind || !value) return;
    var k = String(kind).slice(0, 12) + ':' + String(value).slice(0, 28);
    if(S.pick[k] == null && Object.keys(S.pick).length >= 80) return;
    S.pick[k] = (S.pick[k] || 0) + 1;
    markAction();
    schedule();
  }

  /* Найдорожчий кошик за сесію. Якщо замовлення не буде — саме ця сума
     і є втратою, яку видно у звіті про покинуті кошики. */
  function cart(sum, qty){
    if(OFF) return;
    sum = Math.round(+sum || 0); qty = Math.round(+qty || 0);
    if(sum > (S.cart.sum || 0)) S.cart = { sum:sum, qty:qty };
    schedule();
  }

  /* Крок воронки. Зараховується один раз за сесію — цікаво «скільки людей
     дійшло», а не «скільки разів клацнули». */
  function step(name, params){
    if(OFF) return;
    var i = FUNNEL.indexOf(name);
    if(i < 0) return;
    var novel = false;
    for(var k = 0; k <= i; k++){
      if(!S.steps[FUNNEL[k]]){ S.steps[FUNNEL[k]] = 1; novel = true; }
    }
    if(!novel) return;
    toGtm('step_' + name, params);
    schedule(i >= FUNNEL.indexOf('cart'));   // ближче до грошей — пишемо одразу
  }

  /* Замовлення оформлене. Ці ж дані летять у webOrders як атрибуція,
     тож у звіті видно виручку в розрізі реклами. */
  function order(o){
    o = o || {};
    S.order = {
      id: o.orderId || '', sum: +o.sum || 0, cost: +o.cost || 0,
      qty: +o.qty || 0, items: +o.items || 0
    };
    step('order');
    toGtm('purchase', { order_id:S.order.id, value:S.order.sum, currency:'UAH', items:S.order.items });
    if(timer){ clearTimeout(timer); timer = null; }
    flush();
  }

  /* Те, що сайт чіпляє до замовлення, щоб у Канбані було видно джерело. */
  function attribution(){
    return {
      vid: S.vid, sid: S.sid, day: S.day, hour: S.hour, dow: S.dow,
      src: S.src, first: S.first, land: S.land,
      visitNo: S.visitNo, dev: S.dev.type, sec: activeSec, depth: S.depth
    };
  }

  /* ---------- 9. Кліки ------------------------------------------------ */
  /* Ключові кнопки називаються самі: по data-an, по типу посилання або по
     цілі прокрутки. Так не треба обвішувати сотню кнопок вручну, а нові
     кнопки потрапляють у звіт одразу після появи. */
  function clickName(el){
    if(!el || !el.closest) return null;
    var t = el.closest('[data-an]');
    if(t) return t.getAttribute('data-an');

    var a = el.closest('a[href]');
    if(a){
      var h = a.getAttribute('href') || '';
      if(/^tel:/i.test(h))              return 'contact_phone';
      if(/^mailto:/i.test(h))           return 'contact_mail';
      if(/^viber:/i.test(h))            return 'contact_viber';
      if(/t\.me\//i.test(h))            return 'contact_telegram';
      if(/(wa\.me|whatsapp)/i.test(h))  return 'contact_whatsapp';
      if(/instagram\./i.test(h))        return 'social_instagram';
      if(/^https?:/i.test(h))           return 'link_out';
    }
    var s = el.closest('[data-scroll-to]');
    if(s) return 'nav_' + String(s.getAttribute('data-scroll-to') || '').slice(0, 24);
    return null;
  }
  D.addEventListener('click', function(e){
    var n = clickName(e.target);
    if(n) track(n);
  }, true);

  /* ---------- 10. Старт ----------------------------------------------- */
  W.lqAn = {
    track: track, step: step, order: order, attribution: attribution,
    pick: pick, cart: cart,
    flush: function(){ if(timer){ clearTimeout(timer); timer = null; } flush(); },
    state: function(){ return snapshot(); },
    off: OFF, sid: S.sid, vid: S.vid
  };

  if(!OFF){
    toGtm('session', {
      source: S.src.source, medium: S.src.medium, campaign: S.src.campaign,
      device: S.dev.type, new_visitor: S.newVisitor ? 1 : 0, page: S.land
    });
    S.steps.visit = 1;
    setTimeout(function(){ schedule(true); }, 2000);
  }
})();
