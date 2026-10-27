/* СТОРОЖ ДІАЛОГУ (19.10).

   Андрій: «постійні проблеми з діалогом, коли я зміни вношу… після кожного
   оновлення перевіряти діалог: відправка фоток, тексту, чи відображається
   вся переписка, чи всі повідомлення ми отримуємо». Зараз у всіх діалогах
   стояло «Повідомлень поки немає», хоч переписка була: Sitniks відмовляв
   (429), а вікно показувало це як порожню розмову.

   Тут — справжній код діалогу (crmFetch → воркер → Sitniks) із підміненим
   Sitniks. Перевіряємо те, що не має губитись ніколи:
     1. історія показується (їхнє ліворуч, наше праворуч, фото картинкою);
     2. Sitniks не відповів / 429 — чесна помилка й «Оновити», не «немає»;
        фонові запити тим часом мовчать;
     3. текст відправляється: ⏱ → ✓ → ✓✓, не зникає;
     4. не надіслалось — червоне з «Повторити», повідомлення лишається;
     5. нове від клієнта зʼявляється само, кружечок рахується й гасне;
     6. два діалоги не плутаються;
     7. фото відправляється картинкою (attachments) і стоїть у стрічці.

   Запуск:  node tests/chat-guard.mjs      (з кореня репозиторію)
   Хук .githooks/pre-commit і GitHub Action ганяють його на кожну зміну
   loomiqadmin.html — коміт, що ламає діалог, не проходить.  */
import fs from 'node:fs';
/* Playwright — локальний (/opt) або встановлений поруч (CI: npm i playwright). */
const PW_LOCAL = '/opt/node22/lib/node_modules/playwright/index.mjs';
const { chromium } = await import(fs.existsSync(PW_LOCAL) ? PW_LOCAL : 'playwright');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8979;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/* ── Підмінений Sitniks ────────────────────────────────────────────────── */
const SIT = 'https://sitniks.test';
const now = Date.now();
const iso = ms => new Date(ms).toISOString();
const sitniks = {
  mode: 'ok',                 // ok | 429 | 500 | timeout — на читання
  postMode: 'ok',             // те саме на надсилання
  seq: 100,
  log: [],                    // усі запити: method path
  q: [],                      // повний шлях + чи просили свіже (26.10)
  chats: {
    'c-a': [
      { id:'1', text:'Добрий день! Хочу худі з совою', createdAt: iso(now - 3600e3 * 5), sender:{ name:'Асія Дерещук' } },
      { id:'2', text:'Вітаю! Надсилаю варіанти', createdAt: iso(now - 3600e3 * 4), isOutgoing:true },
      { id:'3', text:'', createdAt: iso(now - 3600e3 * 3), sender:{ name:'Асія Дерещук' },
        attachmentUrl:'https://res.test/client-photo.png', attachments:[{ mediaType:'image', mediaUrl:'https://res.test/client-photo.png' }] },
      { id:'4', text:'Ось така сова подобається', createdAt: iso(now - 3600e3 * 2), sender:{ name:'Асія Дерещук' } }
    ],
    'c-b': [
      { id:'11', text:'Чи є розмір L?', createdAt: iso(now - 3600e3 * 6), sender:{ name:'Богдан Коваль' } },
      { id:'12', text:'Так, є', createdAt: iso(now - 3600e3 * 5), isOutgoing:true }
    ]
  }
};
const listOf = id => (sitniks.chats[id] || []).slice().sort((a, b) => b.createdAt < a.createdAt ? -1 : 1);

const CONTENT = {
  team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }],
  bgApi:{ sitniksUrl: SIT }
};
const ORDERS = [
  { id:'a', orderId:'2000501', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt: iso(now - 86400e3), crmChatId:'c-a', crmChatName:'Асія Дерещук', crmNick:'asia_dera', items:[] },
  { id:'b', orderId:'2000502', type:'client', dir:'b2c', name:'Богдан', status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt: iso(now - 86400e3 * 2), crmChatId:'c-b', crmChatName:'Богдан Коваль', crmNick:'bodya', items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', async r => {
  const u = r.request().url(), m = r.request().method();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  if(/^https:\/\/res\.test\//.test(u)) return r.fulfill({ contentType:'image/png', body: PNG1 });
  if(/api\.cloudinary\.com/.test(u)) return r.fulfill({ contentType:'application/json', body: JSON.stringify({ secure_url:'https://res.test/our-photo.png' }) });
  if(u.startsWith(SIT)){
    const url = new URL(u), pth = url.pathname;
    sitniks.log.push(m + ' ' + pth);
    /* Повний запит і чи просили свіже повз кеш воркера (26.10). */
    sitniks.q.push({ m, path: pth + url.search, fresh: (r.request().headers()['x-loomiq-fresh'] || '') === '1' });
    const mode = m === 'GET' ? sitniks.mode : sitniks.postMode;
    if(mode === '429') return r.fulfill({ status:429, contentType:'application/json', headers:{ 'Retry-After':'2' }, body: JSON.stringify({ message:'Too Many Requests' }) });
    if(mode === '500') return r.fulfill({ status:500, contentType:'application/json', body: JSON.stringify({ message:'Internal error' }) });
    if(mode === 'timeout') return;                      // не відповідаємо зовсім
    if(pth === '/chats') return r.fulfill({ contentType:'application/json', body: JSON.stringify({ items: Object.keys(sitniks.chats).map(id => {
      const l = listOf(id)[0] || {};
      return { id, lastMessage: { text: l.text || '', createdAt: l.createdAt, isOutgoing: !!l.isOutgoing } }; }) }) });
    const mm = pth.match(/^\/chats\/([^/]+)\/messages$/);
    if(mm && m === 'GET') return r.fulfill({ contentType:'application/json', body: JSON.stringify({ items: listOf(mm[1]) }) });
    if(mm && m === 'POST'){
      let j = {}; try{ j = JSON.parse(r.request().postData() || '{}'); }catch(e){}
      const id = String(++sitniks.seq);
      /* Як справжній Sitniks: надіслане через API повертається БЕЗ ознаки
         «вихідне» й без відправника — хто це писав, стрічка має знати сама. */
      const msg = { id, text: j.text || '', createdAt: iso(Date.now()) };
      /* Як справжній Sitniks: нашу адресу не повертає, картинка — вже з його CDN. */
      if(Array.isArray(j.attachments) && j.attachments.length){ msg.attachments = j.attachments.map((x, i) => ({ mediaType:'image', mediaUrl: 'https://res.test/cdn-' + id + '-' + i + '.jpg' })); msg.attachmentUrl = msg.attachments[0].mediaUrl; }
      (sitniks.chats[mm[1]] || (sitniks.chats[mm[1]] = [])).push(msg);
      /* Режим «без номера»: Sitniks прийняв, але номера повідомлення не дав. */
      return r.fulfill({ contentType:'application/json', body: JSON.stringify(sitniks.noId ? {} : { id }) });
    }
    return r.fulfill({ status:404, contentType:'application/json', body:'{}' });
  }
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

/* Розділ «Чати B2C» — тут відповідають. */
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-chatsc').style.display = 'block';
  renderChats('b2c');
});
await p.waitForTimeout(400);
const wait = async (f, n) => { for(let k = 0; k < (n || 50); k++){ const r = await p.evaluate(f); if(r) return r; await p.waitForTimeout(200); } return null; };
const openChat = async (orderId) => {
  await p.evaluate(id => {
    const o = orders.find(x => x.orderId === id);
    chatOpen(o, 'crm', { host: chatsHostId('b2c'), dir:'b2c' });
    renderChats('b2c');
  }, orderId);
  /* Чекаємо саме стрічку з Sitniks (або чесну помилку), а не перший малюнок
     вікна: черга відправленого малюється й до того, як історія приїхала. */
  return wait(() => { const st = crmChat[chatWin && chatWin.id] || {};
    const f = document.querySelector('#chatWin .cw-feed');
    return f && !st.loading && (Array.isArray(st.msgs) || st.noHistory) ? true : null; });
};
const feed = () => p.evaluate(() => {
  const f = document.querySelector('#chatWin .cw-feed');
  if(!f) return null;
  return { state: (f.querySelector('[data-cw-state]') || {}).dataset ? f.querySelector('[data-cw-state]').dataset.cwState : '',
           empty: (f.querySelector('.cw-empty') || {}).textContent || '',
           reload: !!f.querySelector('[data-cw-reload]'),
           rows: [...f.querySelectorAll('.od-crm-msg')].map(x => ({
             text: (x.querySelector('.od-crm-txt') || {}).textContent || '',
             mine: x.classList.contains('mine'), pending: x.classList.contains('pending'), failed: x.classList.contains('ob-failed'),
             img: !!x.querySelector('img'), src: ((x.querySelector('img') || {}).src || '').slice(-22), tick: (x.querySelector('.od-crm-at') || {}).textContent || '' })) };
});

console.log('═══ 1. ІСТОРІЯ ПОКАЗУЄТЬСЯ ═══');
await openChat('2000501');
const f1 = await feed();
console.log('  ' + JSON.stringify(f1 && f1.rows.map(r => (r.mine ? '→' : '←') + (r.img ? '[фото]' : '') + r.text)));
ok(f1 && f1.rows.length === 4 && f1.rows[0].text.startsWith('Добрий день') && f1.rows[3].text.startsWith('Ось така'),
  'уся переписка на місці, від давнього до нового', 'стрічка: ' + JSON.stringify(f1));
ok(f1 && !f1.rows[0].mine && f1.rows[1].mine && f1.rows[2].img && !f1.rows[2].mine,
  'клієнт ліворуч, наше праворуч, фото клієнта — картинкою', 'боки/фото: ' + JSON.stringify(f1 && f1.rows));

console.log('');
console.log('═══ 2. SITNIKS ВІДМОВИВ — ЧЕСНА ПОМИЛКА, НЕ «НЕМАЄ ПОВІДОМЛЕНЬ» ═══');
sitniks.mode = '429';
const n0 = sitniks.log.length;
await p.evaluate(() => { delete crmChat['b']; });
await openChat('2000502');
const f2 = await feed();
console.log('  ' + JSON.stringify({ state: f2 && f2.state, empty: f2 && f2.empty.slice(0, 80) }));
ok(f2 && f2.state === 'error' && f2.reload && /обмежив запити|не завантажилась/.test(f2.empty) && !/Повідомлень поки немає/.test(f2.empty),
  '429 → у вікні «Sitniks обмежив запити» і кнопка «Оновити», а не порожня розмова', 'вікно при 429: ' + JSON.stringify(f2));
const cool = await p.evaluate(() => crmCooling());
await p.evaluate(() => crmSweepOnce());
await p.waitForTimeout(600);
const зайвих = sitniks.log.slice(n0).filter(x => x.startsWith('GET /chats')).length;
console.log('  ' + JSON.stringify({ пауза: cool, запитівПісля429: зайвих }));
ok(cool > 0 && зайвих <= 2, 'після відмови фонові запити (обхід, опитування) мовчать, поки пауза не мине', 'запитів: ' + зайвих + ' · пауза ' + cool);
sitniks.mode = 'ok';
await p.click('#chatWin [data-cw-reload]');
const f2b = await wait(() => { const r = document.querySelectorAll('#chatWin .od-crm-msg').length; return r >= 2 ? r : null; });
ok(f2b === 2, '«Оновити» — переписка підтягнулась', 'після оновлення рядків: ' + f2b);

console.log('');
console.log('═══ 3. ТЕКСТ: ⏱ → ✓ → ✓✓, НЕ ЗНИКАЄ ═══');
await p.fill('#chatWin .cw-inp', 'Розмір L є, беріть');
await p.press('#chatWin .cw-inp', 'Control+Enter');
const f3a = await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg')].pop(); return r && /Розмір L є/.test(r.textContent) ? (r.querySelector('.od-crm-at') || {}).textContent : null; });
const posted = sitniks.log.filter(x => x === 'POST /chats/c-b/messages').length;
ok(posted === 1 && f3a != null, 'надіслали — рівно один POST у Sitniks, повідомлення одразу в стрічці', 'POST: ' + posted + ', рядок: ' + f3a);
const f3b = await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg')].filter(x => /Розмір L є/.test(x.textContent)).pop();
  return r && /✓✓/.test(r.textContent) && r.classList.contains('mine') ? r.textContent.slice(-30) : null; }, 40);
ok(f3b, 'Sitniks повернув його в переписці — ✓✓, стоїть праворуч', 'без ✓✓: ' + JSON.stringify(await feed()));
const dup = await p.evaluate(() => [...document.querySelectorAll('#chatWin .od-crm-msg')].filter(x => /Розмір L є/.test(x.textContent)).length);
ok(dup === 1, 'у стрічці воно одне, не двоїться', 'копій: ' + dup);

console.log('');
console.log('═══ 4. НЕ НАДІСЛАЛОСЬ — ЧЕРВОНЕ З «ПОВТОРИТИ», НЕ ЗНИКАЄ ═══');
sitniks.postMode = '500';
await p.fill('#chatWin .cw-inp', 'Це не дійде з першого разу');
await p.press('#chatWin .cw-inp', 'Control+Enter');
const f4 = await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg.ob-failed')].pop(); return r && /не дійде/.test(r.textContent) && r.querySelector('[data-ob-retry]') ? true : null; });
ok(f4, 'Sitniks відмовив — повідомлення лишилось у стрічці червоним, з «Повторити»', 'не видно провалу: ' + JSON.stringify(await feed()));
sitniks.postMode = 'ok';
await p.click('#chatWin .od-crm-msg.ob-failed [data-ob-retry]');
const f4b = await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg')].filter(x => /не дійде/.test(x.textContent)).pop();
  return r && !r.classList.contains('ob-failed') && /✓/.test(r.textContent) ? true : null; }, 40);
ok(f4b, '«Повторити» — пішло', 'повтор не спрацював');

console.log('');
console.log('═══ 5. НОВЕ ВІД КЛІЄНТА ПРИХОДИТЬ САМЕ ═══');
sitniks.chats['c-b'].push({ id:'77', text:'Тоді беру дві', createdAt: iso(Date.now()), sender:{ name:'Богдан Коваль' } });
const f5 = await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg')].pop(); return r && /беру дві/.test(r.textContent) && !r.classList.contains('mine') ? true : null; }, 40);
ok(f5, 'клієнт написав — за кілька секунд репліка в стрічці, ліворуч', 'нове не прийшло: ' + JSON.stringify(await feed()));
/* Кружечок: інша розмова (A) — клієнт пише, поки ми в B. Обхід має це
   побачити; відповідь — погасити. */
sitniks.chats['c-a'].push({ id:'78', text:'Коли буде готово?', createdAt: iso(Date.now()), sender:{ name:'Асія Дерещук' } });
await p.evaluate(() => crmSweepOnce());
const un = await wait(() => { const o = orders.find(x => x.id === 'a'); return (+o.crmUnread || 0) > 0 ? +o.crmUnread : null; }, 30);
/* Число — хвіст реплік клієнта після нашої останньої відповіді (Андрій:
   «скільки пропущених, стільки й показується»): тут їх дві. */
ok(un >= 1, 'клієнт написав в іншу розмову — обхід побачив, кружечок є (' + un + ')', 'кружечок: ' + un);
await openChat('2000501');
await p.fill('#chatWin .cw-inp', 'Завтра!');
await p.press('#chatWin .cw-inp', 'Control+Enter');
const un2 = await wait(() => { const o = orders.find(x => x.id === 'a'); return (+o.crmUnread || 0) === 0 && !o.crmTheirs ? true : null; }, 30);
ok(un2, 'відповіли — кружечок згас', 'кружечок не згас: ' + JSON.stringify(await p.evaluate(() => { const o = orders.find(x => x.id === 'a'); return { u: o.crmUnread, t: o.crmTheirs }; })));

console.log('');
console.log('═══ 6. ДВА ДІАЛОГИ НЕ ПЛУТАЮТЬСЯ ═══');
const fa = await feed();
await openChat('2000502');
const fb = await feed();
await openChat('2000501');
const fa2 = await feed();
const txt = f => (f.rows || []).map(r => r.text).join('|');
ok(/Добрий день/.test(txt(fa)) && !/розмір L/i.test(txt(fa)) && /Чи є розмір L/.test(txt(fb)) && !/Добрий день/.test(txt(fb)) && txt(fa2) === txt(fa),
  'A показує своє, B — своє, назад в A — те саме', JSON.stringify({ a: txt(fa), b: txt(fb) }));

console.log('');
console.log('═══ 7. ФОТО ЙДЕ КАРТИНКОЮ ═══');
await p.evaluate(async () => {
  const cv = document.createElement('canvas'); cv.width = 40; cv.height = 40;
  const g = cv.getContext('2d'); g.fillStyle = '#4F46E5'; g.fillRect(0, 0, 40, 40);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  await chatTake([new File([blob], 'sova.png', { type:'image/png' })]);
});
await wait(() => (chatWin.pics || []).length === 1 && chatWin.pics[0].url ? true : null);
await p.fill('#chatWin .cw-inp', 'Ось макет');
await p.press('#chatWin .cw-inp', 'Control+Enter');
const f7 = await wait(() => {
  const posts = window.__posts || 0;
  const r = [...document.querySelectorAll('#chatWin .od-crm-msg.mine')];
  const pic = r.filter(x => x.querySelector('img')).pop(), cap = r.filter(x => /Ось макет/.test(x.textContent)).pop();
  return (pic && cap && !document.querySelector('#chatWin .cw-go.is-busy')) ? { ticks: /✓/.test(pic.textContent) } : null; }, 60);
const picPost = sitniks.log.filter(x => x === 'POST /chats/c-a/messages').length;
const sentAtt = (sitniks.chats['c-a'] || []).filter(m => +m.id >= 100 && m.attachments).length;   // надіслані через API
console.log('  ' + JSON.stringify({ f7, picPost, sentAtt }));
ok(f7 && sentAtt === 1, 'фото пішло в Sitniks одним повідомленням attachments — і стоїть у стрічці картинкою, підпис окремо під ним', JSON.stringify({ f7, sentAtt, log: sitniks.log.slice(-6) }));
ok(await p.evaluate(() => (chatWin.pics || []).length === 0 && !chatWin.picsBusy), 'смужка фото очистилась, кнопка знову жива', 'смужка не очистилась');

console.log('');
console.log('═══ 8. З ДОШКИ (АРКУШ + ТЕКСТ) — НАШЕ Й ПІСЛЯ ПЕРЕЗАВАНТАЖЕННЯ ═══');
/* Як дошка дизайну: тримає СВОЮ копію замовлення, а не живу з масиву; у
   вікні діалогу розмова не відкрита. Поки летить — приходить знімок бази
   й підміняє масив замовлень. Після «перезавантаження» (чиста памʼять
   вкладки, картки з бази) наше має лишитись праворуч із ✓✓, і одним. */
await p.evaluate(() => { chatClose(); window.__db = {};
  /* Дошка дизайну заводить host (tellPic тощо) при відкритті розділу. */
  try{ document.getElementById('view-design').style.display = 'block'; openDesign(); }catch(e){ console.warn(e); }
  const orig = ORDERS_COL.doc.bind(ORDERS_COL);
  ORDERS_COL.doc = id => { const d = orig(id); const set0 = d.set.bind(d);
    /* Читання «з бази» — те, що лягло останнім (27.10: памʼять «це наше»
       пишеться дописом, і стуб має знати, до чого дописувати). */
    d.get = () => { const cur = window.__db[id] || orders.find(x => x.id === id) || null;
      return Promise.resolve({ id, exists: !!cur, data: () => cur ? JSON.parse(JSON.stringify(cur)) : null }); };
    /* Картка пишеться полями (крок 3): латка через update лягає поверх того, що «в базі». */
    d.set = (v, opt) => { const merge = (opt && opt.merge) || d.__via === 'update';
      const base = window.__db[id] || JSON.parse(JSON.stringify(orders.find(x => x.id === id) || {}));
      window.__db[id] = merge ? Object.assign(base, JSON.parse(JSON.stringify(v))) : JSON.parse(JSON.stringify(v)); return set0(v, opt); };
    return d; }; });
const r8 = await p.evaluate(async () => {
  const stale = JSON.parse(JSON.stringify(orders.find(x => x.id === 'a')));
  const going = window.LQDesign.ui.host.tellPic(stale, 'https://res.test/sheet-1.png', 'Подивіться як гарно вийшло');
  /* Знімок бази посеред відправки: масив замовлень — нові обʼєкти без нашого запису. */
  await new Promise(r => setTimeout(r, 150));
  orders = orders.map(o => JSON.parse(JSON.stringify(window.__db[o.id] || o)));
  const ok = await going;
  await new Promise(r => setTimeout(r, 1500));
  const live = orders.find(x => x.id === 'a');
  return { ok, liveOut: (live.crmOut || []).length, dbOut: ((window.__db['a'] || {}).crmOut || []).length,
           held: typeof crmHeldIds === 'function' && crmHeldIds().indexOf('a') >= 0 };
});
console.log('  ' + JSON.stringify(r8));
ok(r8.ok && r8.liveOut >= 2 && r8.dbOut >= 2 && r8.held, 'надіслано з копії картки — памʼять «це наше» в живій картці й у базі, картку тримаємо від підміни', JSON.stringify(r8));
/* «Перезавантаження»: усе, що жило у вкладці, — геть; картки — як у базі. */
await p.evaluate(() => {
  orders = orders.map(o => JSON.parse(JSON.stringify(window.__db[o.id] || o)));
  Object.keys(crmChat).forEach(k => delete crmChat[k]);
  Object.keys(crmOutHere).forEach(k => delete crmOutHere[k]);
  Object.keys(crmPicsMem).forEach(k => delete crmPicsMem[k]);
  try{ Object.keys(crmHold).forEach(k => delete crmHold[k]); }catch(e){}
  crmSent.clear();
});
await openChat('2000501');
const f8 = await feed();
const наші = (f8 && f8.rows || []).filter(r => /гарно вийшло/.test(r.text) || (r.img && r.mine && !r.text));
const аркуші = (f8 && f8.rows || []).filter(r => r.img && /cdn-|sheet-1/.test('') || (r.img && r.mine && !r.text));
console.log('  ' + JSON.stringify((f8 && f8.rows || []).slice(-4).map(r => (r.mine ? '→' : '←') + (r.img ? '[фото]' : '') + r.text + ' ' + r.tick)));
const txt8 = (f8 && f8.rows || []).filter(r => /гарно вийшло/.test(r.text))[0];
const pic8 = (f8 && f8.rows || []).filter(r => r.img && !r.text).slice(-1)[0];
ok(txt8 && txt8.mine && /✓✓/.test(txt8.tick), 'після перезавантаження текст з дошки — праворуч, ✓✓', 'текст: ' + JSON.stringify(txt8));
ok(pic8 && pic8.mine && /✓✓/.test(pic8.tick), 'аркуш, який Sitniks повернув своєю адресою, — праворуч, ✓✓', 'аркуш: ' + JSON.stringify(pic8));
/* Скільки картинок у стрічці — рівно стільки, скільки повідомлень із
   вкладенням у самому Sitniks (фото клієнта + наші): жодного дубля. */
const nPic = (f8 && f8.rows || []).filter(r => r.img).length;
const nSit = sitniks.chats['c-a'].filter(m => m.attachments && m.attachments.length).length;
ok(nPic === nSit, 'картинок у стрічці стільки ж, скільки в Sitniks (' + nSit + ') — нічого не двоїться', 'у стрічці ' + nPic + ', у Sitniks ' + nSit);

console.log('');
console.log('═══ 9. ФОТО КЛІЄНТА ОДРАЗУ ПІСЛЯ НАШОГО ЕСКІЗУ — ЛІВОРУЧ (20.10) ═══');
/* Аліна Корнійчук: ми надіслали ескіз, через хвилину вона — скріншот. Sitniks
   номера нашого повідомлення не дав — бік вирішувався часом, і її скріншот
   ставав праворуч. Тепер наша відправка забирає лише одне, найближче фото. */
sitniks.noId = true;
const r9 = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'a');
  return await window.LQDesign.ui.host.tellPic(o, 'https://res.test/sheet-2.png', '');
});
sitniks.noId = false;
sitniks.chats['c-a'].push({ id: 'cl-shot', text: '', createdAt: iso(Date.now() + 50e3), sender: { name: 'Асія Дерещук' },
  attachmentUrl: 'https://res.test/client-shot.png', attachments: [{ mediaType: 'image', mediaUrl: 'https://res.test/client-shot.png' }] });
await p.evaluate(() => { const o = orders.find(x => x.id === 'a'); delete crmChat[o.id]; });
await openChat('2000501');
const f9 = await feed();
const фото9 = (f9 && f9.rows || []).filter(r => r.img).slice(-2);
console.log('  ' + JSON.stringify(фото9.map(r => (r.mine ? '→' : '←') + ' ' + r.src)));
ok(r9 && фото9.length === 2 && фото9[0].mine && !фото9[1].mine,
  'наш ескіз — праворуч, скріншот клієнта хвилиною пізніше — ліворуч', 'фото: ' + JSON.stringify(фото9));
/* Той самий випадок, але Sitniks не підписав і клієнта — лишається найближче за часом. */
sitniks.chats['c-a'].find(m => m.id === 'cl-shot').sender = null;
await p.evaluate(() => { const o = orders.find(x => x.id === 'a'); delete crmChat[o.id]; });
await openChat('2000501');
const f9b = await feed();
const фото9b = (f9b && f9b.rows || []).filter(r => r.img).slice(-2);
ok(фото9b.length === 2 && фото9b[0].mine && !фото9b[1].mine,
  'навіть без підпису клієнта: одна наша відправка — одне фото, найближче', 'фото: ' + JSON.stringify(фото9b));

console.log('');
console.log('═══ 10. ВІДПОВІЛИ З ДОШКИ — «2» ГАСНЕ ВСЮДИ І НЕ ПОВЕРТАЄТЬСЯ ОБХОДОМ (20.10) ═══');
sitniks.chats['c-a'].push(
  { id: 'q1', text: 'Добрий день', createdAt: iso(Date.now() + 70e3), sender: { name: 'Асія Дерещук' } },
  { id: 'q2', text: 'Так)', createdAt: iso(Date.now() + 80e3), sender: { name: 'Асія Дерещук' } });
await p.evaluate(async () => { chatClose(); const o = orders.find(x => x.id === 'a'); delete crmChat[o.id];
  await crmLoadChat(o); chatsRepaint(); });
const до10 = await p.evaluate(() => +orders.find(x => x.id === 'a').crmUnread || 0);
const r10 = await p.evaluate(async () => {
  /* Як дошка дизайну: своя копія замовлення, не жива. */
  const stale = JSON.parse(JSON.stringify(orders.find(x => x.id === 'a')));
  const ok = await window.LQDesign.ui.host.tellPic(stale, 'https://res.test/sheet-3.png', 'Подивіться, як вийшло');
  const live = orders.find(x => x.id === 'a');
  const після = { u: +live.crmUnread || 0, t: !!live.crmTheirs };
  /* Обхід розмов: наша відповідь — остання в списку Sitniks, без ознаки «вихідне». */
  await crmSweepOnce();
  await new Promise(r => setTimeout(r, 1500));
  renderChats('b2c');
  const рядок = [...document.querySelectorAll('#chatscRoot [data-chl]')].find(b => /2000501/.test(b.textContent));
  return { ok, після, обхід: { u: +live.crmUnread || 0, t: !!live.crmTheirs },
           числоВСписку: рядок ? ((рядок.querySelector('.chl-n') || {}).textContent || '') : '?' };
});
console.log('  до: ' + до10 + ' · ' + JSON.stringify(r10));
ok(до10 >= 2, 'клієнт написав — є непрочитані (' + до10 + ')', 'до відповіді: ' + до10);
ok(r10.ok && r10.після.u === 0 && !r10.після.t, 'відповіли з дошки (з копії картки) — у живій картці 0', JSON.stringify(r10));
ok(r10.обхід.u === 0 && !r10.обхід.t, 'обхід розмов, побачивши нашу відповідь останньою, «+1» не додає', JSON.stringify(r10));
ok(r10.числоВСписку === '', 'у списку «Чати B2C» числа біля розмови немає', JSON.stringify(r10));

console.log('═══ 11. ЗАМІНИЛИ РОЗМОВУ — ВІКНО, ІМʼЯ Й КНОПКА ЗА НОВОЮ (22.10) ═══');
sitniks.mode = ''; sitniks.postMode = '';
/* Даємо відправкам з §10 долетіти: під навантаженням вони дописують «це
   наше» в картку вже після заміни розмови — і тест ловив не заміну, а хвіст. */
for(let k = 0; k < 40; k++){ const n0 = sitniks.log.length; await p.waitForTimeout(400);
  const тихо = await p.evaluate(() => Object.values(chatOutbox || {}).every(l => !l || !l.length));
  if(sitniks.log.length === n0 && тихо) break; }
sitniks.chats['abcdef0123456789'] = [
  { id:'31', text:'Привіт, це Роман', createdAt: iso(now - 3600e3 * 2), sender:{ name:'Роман Дяків' }, client:{ name:'Роман Дяків', username:'roman_d' } },
  { id:'32', text:'Хочу худі', createdAt: iso(now - 3600e3), sender:{ name:'Роман Дяків' }, client:{ name:'Роман Дяків', username:'roman_d' } } ];
await openChat('2000501');
const до = await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000501');
  chatOutbox[o.id] = [{ text:'стара черга' }];
  return { name: o.name, ig: o.ig || '', chat: o.crmChatId, head: (document.querySelector('#chatWin .cw-t, #chatWin .cw-h b, #chatWin .cw-name') || {}).textContent || '' }; });
/* Привʼязку запускаємо й далі опитуємо результат (wait нижче), а не чекаємо
   її всередині одного evaluate: довгий evaluate з мережею зрідка (≈1 з 6)
   рвався «Execution context was destroyed» без жодної навігації сторінки. */
await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000501');
  window.__bindDone = 0; crmBindUrl(o, 'https://app.sitniks.com/dialog/abcdef0123456789').then(() => { window.__bindDone = 1; }, e => { window.__bindDone = String(e); }); });
await wait(() => window.__bindDone || null, 100);
await wait(() => { const st = crmChat[(orders.find(x => x.orderId === '2000501') || {}).id] || {}; return (!st.loading && st.chatId === 'abcdef0123456789' && Array.isArray(st.msgs)) ? true : null; });
await p.waitForTimeout(300);
const після = await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000501');
  return { name: o.name, ig: o.ig || '', nick: o.crmNick || '', chat: o.crmChatId, chatName: o.crmChatName, outbox: (chatOutbox[o.id] || []).length,
           win: (document.querySelector('#chatWin') || {}).textContent || '', pollChat: (crmChat[o.id] || {}).chatId }; });
const f11 = await feed();
console.log('  ' + JSON.stringify({ до, після: Object.assign({}, після, { win: після.win.slice(0, 80) }), rows: f11 && f11.rows.map(r => r.text) }));
ok(після.chat === 'abcdef0123456789' && після.chatName === 'Роман Дяків', 'картка привʼязана до нової розмови', JSON.stringify(після));
ok(після.name === 'Роман Дяків' && /Роман Дяків/.test(після.win) && !/Асія/.test(після.win), 'імʼя зі старої розмови замінено новим — і у вікні теж', JSON.stringify({ name: після.name }));
ok(f11 && f11.rows.length === 2 && f11.rows[0].text === 'Привіт, це Роман', 'у вікні — повідомлення НОВОЇ розмови', JSON.stringify(f11 && f11.rows));
ok(після.ig !== до.ig && !/asia/.test(після.ig) && після.outbox === 0 && після.pollChat === 'abcdef0123456789',
  'нік Instagram (кнопка) — новий, стара черга забута, опитування слухає нову', JSON.stringify({ ig: після.ig, outbox: після.outbox, poll: після.pollChat }));
/* Імʼя, правлене руками, заміна не чіпає. */
sitniks.chats['fedcba9876543210'] = [{ id:'41', text:'Це Ольга', createdAt: iso(now - 1800e3), sender:{ name:'Ольга Петрів' }, client:{ name:'Ольга Петрів' } }];
const ручне = await p.evaluate(async () => { const o = orders.find(x => x.orderId === '2000501'); o.name = 'Роман (сплатив)';
  await crmBindUrl(o, 'https://app.sitniks.com/dialog/fedcba9876543210'); await new Promise(r => setTimeout(r, 400));
  return { name: o.name, chatName: o.crmChatName, chat: o.crmChatId }; });
ok(ручне.chat === 'fedcba9876543210' && ручне.name === 'Роман (сплатив)' && ручне.chatName === 'Ольга Петрів', 'імʼя, правлене руками, лишається', JSON.stringify(ручне));

console.log('═══ 12. ХТО В ЗАПИСІ SITNIKS — ТОЙ І ПИСАВ; НАШЕ З КАРТКИ — НАШЕ В УСІХ ВКЛАДКАХ (23.10) ═══');
sitniks.mode = ''; sitniks.postMode = '';
sitniks.chats['0123456789abcdef'] = [
  { id:'51', text:'Цікавить худі', createdAt: iso(now - 3600e3 * 3), sender:{ name:'Марина MV' } },
  { id:'52', text:'Підкажіть, як вам зручніше оплатити залишок', createdAt: iso(now - 3600e3 * 2) },
  { id:'53', text:'Так, реквізити', createdAt: iso(now - 3600e3), client:{ name:'Марина MV' } },
  { id:'54', text:'Надсилаю', createdAt: iso(now - 1800e3), manager:{ name:'Катерина' } } ];
await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000502'); o.crmChatId = '0123456789abcdef'; o.crmChatName = 'Марина MV'; o.crmNick = 'marina_mv';
  /* Текст без підпису надіслано з картки — памʼять про це лежить у САМІЙ
     картці (crmOut), тож і чужа вкладка його впізнає. */
  o.crmOut = []; crmOutNote(o, 'Підкажіть, як вам зручніше оплатити залишок');
  delete crmChat[o.id]; crmSent.clear(); delete crmOutHere[o.id]; });
await openChat('2000502');
const f12 = await feed();
console.log('  ' + JSON.stringify(f12 && f12.rows.map(r => (r.mine ? '→' : '←') + r.text)));
ok(f12 && f12.rows.length === 4 && !f12.rows[0].mine && f12.rows[1].mine && !f12.rows[2].mine && f12.rows[3].mine,
  'підписане клієнтом — ліворуч; наше з картки (памʼять у картці, не у вкладці) — праворуч; з обʼєктом менеджера — праворуч; з обʼєктом клієнта — ліворуч', JSON.stringify(f12 && f12.rows.map(r => [r.text, r.mine])));
const нові = await p.evaluate(() => (document.querySelector('#chatWin .cw-new, #chatWin .cw-unread') || {}).textContent || '');
ok(!/[2-9]|\d\d/.test(нові.replace(/[^\d]/g, '').slice(1)), 'наші без підпису не рахуються як «нові від клієнта»', нові);

console.log('═══ 13. ПОШУК У СПИСКУ РОЗМОВ ПО ІМЕНІ (23.10) ═══');
await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000502'); o.crmChatId = 'c-b'; o.crmChatName = 'Богдан Коваль'; o.crmNick = 'bodya'; o.name = 'Богдан';
  const a = orders.find(x => x.orderId === '2000501'); a.crmChatId = 'c-a'; a.crmChatName = 'Асія Дерещук'; a.crmNick = 'asia_dera'; a.name = 'Асія';
  delete crmChat[o.id]; delete crmChat[a.id]; renderChats('b2c'); });
await p.waitForTimeout(300);
const пошук = await p.evaluate(async () => {
  const q = document.querySelector('#chatscRoot .chl-q');
  const rows = () => [...document.querySelectorAll('#chatscRoot .chl-row .chl-who')].map(x => x.textContent.trim());
  const all = rows();
  q.value = 'богдан'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
  const r1 = rows();
  q.value = 'asia'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
  const r2 = rows();
  q.value = '2000502'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
  const r3 = rows();
  q.value = 'нікого такого'; q.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
  const порожньо = (document.querySelector('#chatscRoot .chl-empty') || {}).textContent || '';
  /* Обхід перемальовує список — набране в полі лишається. */
  renderChats('b2c'); await new Promise(r => setTimeout(r, 100));
  const q2 = document.querySelector('#chatscRoot .chl-q');
  const після = { value: q2 && q2.value, rows: rows().length };
  q2.value = ''; q2.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 100));
  return { all, r1, r2, r3, порожньо, після, назад: rows().length };
});
console.log('  ' + JSON.stringify(пошук));
ok(пошук.all.length >= 2 && пошук.r1.length === 1 && /Богдан/.test(пошук.r1[0]), 'по імені — лише Богдан', JSON.stringify(пошук.r1));
ok(пошук.r2.length === 1 && /Асія/.test(пошук.r2[0]) && пошук.r3.length === 1 && /Богдан/.test(пошук.r3[0]), 'по ніку й по номеру картки — теж', JSON.stringify({ r2: пошук.r2, r3: пошук.r3 }));
ok(/нічого немає/.test(пошук.порожньо) && пошук.після.value === 'нікого такого' && пошук.після.rows === 0 && пошук.назад === пошук.all.length,
  'нема збігу — «нічого немає»; перемальовування списку не стирає набране; очистив — усі', JSON.stringify(пошук));

console.log('═══ 14. КЕШ ВОРКЕРА: ПІСЛЯ НАШОЇ ВІДПРАВКИ — СВІЖЕ, СТОРІНКИ СПИСКУ — РАЗ НА 5 ХВ (26.10) ═══');
/* Воркер віддає читання з копії (стрічка 5 с). Щоб наша відправка не
   «зависала» на 5 с, найближчі читання після вдалого POST несуть
   `X-Loomiq-Fresh: 1`; без відправки заголовка немає. */
sitniks.mode = 'ok'; sitniks.postMode = 'ok';
await p.evaluate(() => { crmCoolUntil = 0; crmFreshUntil = 0; });
await openChat('2000502');
sitniks.q.length = 0;
await p.waitForTimeout(4500);
const без14 = sitniks.q.filter(x => x.m === 'GET' && /\/messages/.test(x.path));
ok(без14.length >= 1 && без14.every(x => !x.fresh), 'без відправки читання стрічки йде без X-Loomiq-Fresh (' + без14.length + ')', JSON.stringify(без14.slice(0, 3)));
sitniks.q.length = 0;
await p.fill('#chatWin .cw-inp', 'Відправляємо завтра');
await p.press('#chatWin .cw-inp', 'Control+Enter');
await wait(() => { const r = [...document.querySelectorAll('#chatWin .od-crm-msg')].filter(x => /Відправляємо завтра/.test(x.textContent)).pop(); return r && /✓✓/.test(r.textContent) ? true : null; }, 40);
const після14 = sitniks.q.filter(x => x.m === 'GET' && /\/messages/.test(x.path));
const пост14 = sitniks.q.findIndex(x => x.m === 'POST');
const свіжі14 = sitniks.q.filter((x, i) => i > пост14 && x.m === 'GET' && /\/messages/.test(x.path));
ok(пост14 >= 0 && свіжі14.length >= 1 && свіжі14[0].fresh, 'після POST перше читання стрічки — з X-Loomiq-Fresh: 1', JSON.stringify({ пост14, свіжі14: свіжі14.slice(0, 3) }));
await p.evaluate(() => { crmFreshUntil = 0; });
sitniks.q.length = 0;
await p.waitForTimeout(4500);
const знову14 = sitniks.q.filter(x => x.m === 'GET' && /\/messages/.test(x.path));
ok(знову14.length >= 1 && знову14.every(x => !x.fresh), 'минуло вікно свіжості — знову без заголовка', JSON.stringify(знову14.slice(0, 3)));
/* Сторінки 2–3 списку розмов — не щообходу. */
const стор14 = await p.evaluate(async () => {
  const був = crmChatsList;
  crmChatsList = async () => Array.from({ length: 12 }, (_, i) => ({ id: 'z' + i, lastMessage: { text: 'x' } }));
  crmChatsNext = null; crmPagesAt = 0; crmCoolUntil = 0;
  window.__q = [];
  const f = crmFetch; crmFetch = async (path, o) => { window.__q.push(path); return { items: [] }; };
  try{
    await crmChatsAll(); const a = window.__q.filter(x => /page=2/.test(x)).length;
    window.__q = []; crmChatsNext = null;
    await crmChatsAll(); const b = window.__q.filter(x => /page=2/.test(x)).length;
    crmPagesAt = 0; window.__q = []; crmChatsNext = null;
    await crmChatsAll(); const c = window.__q.filter(x => /page=2/.test(x)).length;
    return { a, b, c };
  } finally { crmChatsList = був; crmFetch = f; crmChatsNext = null; crmPagesAt = 0; }
});
ok(стор14.a >= 1 && стор14.b === 0 && стор14.c >= 1, 'сторінка 2 списку: перший обхід — так, наступний за 30 с — ні, через 5 хв — знову', JSON.stringify(стор14));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad + ' — ДІАЛОГ ЗЛАМАНО' : 'діалог цілий: історія, помилки вголос, текст, повтор, нове, два чати, фото');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
