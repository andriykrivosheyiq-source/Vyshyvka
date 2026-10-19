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
      const msg = { id, text: j.text || '', createdAt: iso(Date.now()), isOutgoing:true };
      if(Array.isArray(j.attachments) && j.attachments.length){ msg.attachments = j.attachments.map(x => ({ mediaType:'image', mediaUrl: String(x) })); msg.attachmentUrl = String(j.attachments[0]); }
      (sitniks.chats[mm[1]] || (sitniks.chats[mm[1]] = [])).push(msg);
      return r.fulfill({ contentType:'application/json', body: JSON.stringify({ id }) });
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
  return wait(() => { const f = document.querySelector('#chatWin .cw-feed'); return f && !f.querySelector('.is-busy') ? true : null; });
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
             img: !!x.querySelector('img'), tick: (x.querySelector('.od-crm-at') || {}).textContent || '' })) };
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
const sentAtt = (sitniks.chats['c-a'] || []).filter(m => m.isOutgoing && m.attachments).length;
console.log('  ' + JSON.stringify({ f7, picPost, sentAtt }));
ok(f7 && sentAtt === 1, 'фото пішло в Sitniks одним повідомленням attachments — і стоїть у стрічці картинкою, підпис окремо під ним', JSON.stringify({ f7, sentAtt, log: sitniks.log.slice(-6) }));
ok(await p.evaluate(() => (chatWin.pics || []).length === 0 && !chatWin.picsBusy), 'смужка фото очистилась, кнопка знову жива', 'смужка не очистилась');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad + ' — ДІАЛОГ ЗЛАМАНО' : 'діалог цілий: історія, помилки вголос, текст, повтор, нове, два чати, фото');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
