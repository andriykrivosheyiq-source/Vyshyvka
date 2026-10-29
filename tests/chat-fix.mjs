/* ЧАТИ, ЗАГОТОВКИ, ФІКСАЦІЯ, ПОРЯДОК НА ДОШЦІ (14.10).

   Андрій: «щоб повідомлення відправлялись як у Telegram» (⏱ / ✓ / ✓✓, не
   надіслалось — червоним із «Повторити»); «клієнт написав, а CRM каже 18 днів
   не писав» (клієнт пише в іншу розмову); «B2B одні скрипти, B2C інші» і ✎
   зберегти текст назавжди; відвʼязати розмову в B2C; «Погоджено» → «Ескіз
   узгоджено» → «Фіксація» (одяг) → «Черга вишивки»; «коли перетягуємо картки
   вручну — вони повинні залишатись на своїх місцях».

   Запуск:  node tests/chat-fix.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8987;
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

const CONTENT = {
  team: [{ email:'test@loomiq', name:'Оля', role:'owner' }],
  b2c: {},
  qrSeed: 5,   /* набір уже після переходу 20.10 — тут перевіряємо сам фільтр напрямів */
  quickReplies: [
    { t:'Макет · B2B', m:'{макет} Підготували макет {версія} для компанії.' },
    { t:'Макет · B2C', m:'{макет} Привіт! Ось макет {версія} 🙌' },
    { t:'Подяка', m:'Дякуємо!' }
  ]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera', crmAt:'2026-09-25 10:00', totalPrice: 1000, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'4', orderId:'2000104', type:'client', dir:'b2c', name:'Г', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T12:00:00.000Z', totalPrice: 1000, items:[] }
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

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });



console.log('═══ 1. ВІДПРАВКА ЯК У TELEGRAM: ⏱ → ✓ → ✓✓, НЕВДАЧА — ЧЕРВОНИМ ═══');
const відпр = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000101');
  crmChat[o.id] = { chatId:'c1', msgs: [] };
  let пустити;
  window.crmFetch = () => new Promise((res, rej) => { пустити = { res, rej }; });
  const йде = crmSend(o, 'Добрий день, тест');
  await new Promise(r => setTimeout(r, 50));
  const поки = obList(o).map(x => x.state).join();
  пустити.rej(new Error('Sitniks не відповідає 20 с'));
  const r1 = await йде;
  const x = obList(o)[0] || {};
  const невдача = { r1, стан: x.state, err: x.err };
  /* Повтор — те саме повідомлення, а не друге. */
  window.crmFetch = async () => ({ id:'m1' });
  await obRetry(o, x.id);
  const після = { стан: x.state, скільки: obList(o).length };
  /* ✓ — поки переписка його не показала; повернулось — запис із черги зникає. */
  const видно1 = obVisible(o, 'crm').length;
  crmChat[o.id].msgs = [{ id:'m1', text:'Добрий день, тест', mine:true, at:'2026-10-13 10:00' }];
  const видно2 = obVisible(o, 'crm').length;
  return { поки, невдача, після, видно1, видно2 };
});
console.log('  ' + JSON.stringify(відпр));
ok(відпр.поки === 'pending', 'поки летить — ⏱ «надсилаю…»', 'стан під час відправки: ' + відпр.поки);
ok(відпр.невдача.r1 === false && відпр.невдача.стан === 'failed' && /20 с/.test(відпр.невдача.err),
  'Sitniks не відповів — повідомлення лишилось червоним із причиною, а не зникло', JSON.stringify(відпр.невдача));
ok(відпр.після.стан === 'sent' && відпр.після.скільки === 1,
  '«↻ Повторити» — те саме повідомлення пішло, другого не зʼявилось', JSON.stringify(відпр.після));
ok(відпр.видно1 === 1 && відпр.видно2 === 0,
  '✓ видно, доки переписка не повернула його; повернула — стоїть як звичайне (✓✓)', JSON.stringify(відпр));

console.log('\n═══ 1б. ФОТО З ПІДПИСОМ (15.10: «не працює надсилання фото») ═══');
const фото = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000101');
  crmChat[o.id] = { chatId:'c1', msgs: [] };
  chatOutbox[o.id] = [];
  chatWin = { id: o.id, kind:'crm', solo:true, sect:'b2c', draft:'' };
  const calls = [];
  window.picSendable = async b => b;
  window.uploadCloudinary = async () => 'https://c/ulk.png';
  window.crmFetch = async (path, opt) => { calls.push({ path, method: (opt || {}).method || 'GET', t: (opt || {}).timeoutMs || 0,
    body: typeof (opt || {}).body === 'string' ? opt.body : 'form' }); return { id: 'm' + calls.length }; };
  await chatSendPics(o, [{ url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=', blob: new Blob(['x'], { type:'image/png' }) }], 'ooo');
  const ok1 = { calls: calls.map(c => c.method + ' ' + (/ooo/.test(c.body) ? 'текст' : 'фото') + ' ' + c.t) };
  /* Хмара впала — підпис повертається в поле, фото — у смужку. */
  window.uploadCloudinary = async () => { throw new Error('мережа'); };
  calls.length = 0;
  chatWin.draft = '';
  await chatSendPics(o, [{ url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=', blob: new Blob(['x'], { type:'image/png' }) }], 'підпис');
  return { ok1, після: { draft: chatWin.draft, pics: (chatWin.pics || []).length, calls: calls.length, busy: !!chatWin.picsBusy } };
});
console.log('  ' + JSON.stringify(фото));
ok(фото.ok1.calls.length === 2 && /POST фото 90000/.test(фото.ok1.calls[0]) && /POST текст/.test(фото.ok1.calls[1]),
  'спершу фото (ліміт 90 с — файл важкий), під ним підпис', JSON.stringify(фото.ok1));
ok(фото.після.draft === 'підпис' && фото.після.pics === 1 && !фото.після.calls && !фото.після.busy,
  'фото не завантажилось — нічого не пішло, підпис у полі, фото в смужці, кнопка жива', JSON.stringify(фото.після));

console.log('\n═══ 1в. КНОПКА «➤» МИШКОЮ — НАВІТЬ ЯКЩО ВІКНО ПЕРЕМАЛЮВАЛОСЬ ПІД РУКОЮ ═══');
/* Андрій, 15.10: «по Ctrl+Enter надсилає, а кнопка — ні». Клік губився,
   коли між натиском і відпусканням вікно перемальовувалось. */
await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000101');
  window.__sent = [];
  window.crmFetch = async (path, opt) => { if(opt && opt.method === 'POST') __sent.push(String(opt.body || '')); return { data: [] }; };
  crmChat[o.id] = { chatId:'c1', msgs: [] };
  chatOpen(o, 'crm', { noDrawer: true, dir: 'b2c' });
});
await p.waitForTimeout(400);
const кн = [];
for(const [слово, як] of [['мишкою', 'клік'], ['під рукою', 'перемалювалось']]){
  await p.click('#chatWin .cw-inp');
  await p.keyboard.type(слово);
  /* Кнопку беремо заново в мить натиску (локатор чекає, поки вона на місці):
     під навантаженням вікно встигало перемалюватись між пошуком і замірами. */
  const r = await p.locator('#chatWin [data-cw-go]').boundingBox({ timeout: 5000 });
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  if(як === 'перемалювалось') await p.evaluate(() => { renderChatWin(); try{ chatsLive(); }catch(e){} });
  await p.mouse.up();
  await p.waitForTimeout(400);
  кн.push(await p.evaluate(() => __sent.slice(-1)[0] || ''));
}
console.log('  ' + JSON.stringify(кн));
ok(/мишкою/.test(кн[0]), 'натиснули «➤» мишкою — пішло', JSON.stringify(кн));
ok(/під рукою/.test(кн[1]), 'вікно перемалювалось між натиском і відпусканням — однаково пішло, один раз', JSON.stringify(кн));
ok(await p.evaluate(() => __sent.length) === 2, 'жодного дубля', 'надіслано ' + await p.evaluate(() => __sent.length));
/* Два замовлення в одній розмові (як #2000043 + #1000067): у шапці номери,
   і «➤» однаково має надсилати — доти обробник діставався номеру в шапці. */
await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000101'), o2 = orders.find(x => x.orderId === '2000102');
  o2.crmChatId = 'c1';
  chatOpen(o, 'crm', { noDrawer: true, dir: 'b2c' });
});
await p.waitForTimeout(300);
const шапка = await p.evaluate(() => document.querySelectorAll('#chatWin [data-cw-ord]').length);
await p.click('#chatWin .cw-inp');
await p.keyboard.type('два замовлення');
await p.click('#chatWin button.cw-go');
await p.waitForTimeout(400);
const два = await p.evaluate(() => __sent.slice(-1)[0] || '');
ok(шапка === 2 && /два замовлення/.test(два), 'розмова з двома замовленнями (номери в шапці) — «➤» надсилає', JSON.stringify({ шапка, два }));
await p.evaluate(() => { delete orders.find(x => x.orderId === '2000102').crmChatId; chatClose(); });

console.log('\n═══ 1г. КАРТИНКА — ПЕРЕВІРЕНИМ СПОСОБОМ, ПОЗНАЧКИ СКРИПТІВ КЛІЄНТУ НЕ ЙДУТЬ ═══');
const спосіб = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000101');
  crmChat[o.id] = { chatId:'c1', msgs: [] };
  /* «Поганий» спосіб, запамʼятований 14.10, не має братись першим. */
  contentData.crmPicWay = 'files';
  const тіла = [];
  window.crmFetch = async (path, opt) => { if(opt && opt.method === 'POST') тіла.push(String(opt.body || '')); return { id: 'm' + тіла.length }; };
  const way = await crmSendPic(o, ['https://res.cloudinary.com/x/a.png'], [], null);
  /* Перевірений відмовив прямо — запасний спрацював, але НЕ запамʼятався. */
  тіла.length = 0;
  let раз = 0;
  window.crmFetch = async (path, opt) => { if(opt && opt.method === 'POST'){ тіла.push(String(opt.body || ''));
    if(раз++ < 2){ const e = new Error('HTTP 400'); e.status = 400; throw e; } } return { id: 'x' }; };
  const way2 = await crmSendPic(o, ['https://res.cloudinary.com/x/a.png'], [], null);
  window.crmFetch = async (path, opt) => { if(opt && opt.method === 'POST') тіла.push(String(opt.body || '')); return { id: 'y' }; };
  тіла.length = 0;
  await crmSend(o, '{макет} Зробили макет — подивіться');
  const заготовка = qrFill('{макет} Привіт, {імʼя}!\n{правки} ще рядок', o);
  return { way, way2, запамʼятав: contentData.crmPicWay, текст: тіла[0] || '', заготовка };
});
console.log('  ' + JSON.stringify(спосіб));
ok(спосіб.way === 'attach-url', 'фото йде перевіреним способом attach-url, хоч запамʼятано інший', JSON.stringify(спосіб));
ok(спосіб.way2 !== 'attach-url' && спосіб.запамʼятав === 'files', 'запасний спосіб не запамʼятовується — наступне фото знову піде перевіреним', JSON.stringify(спосіб));
ok(!/\{макет\}/.test(спосіб.текст) && /Зробили макет/.test(спосіб.текст), 'позначка {макет} клієнту не йде', спосіб.текст);
ok(!/\{макет\}|\{правки\}/.test(спосіб.заготовка) && /Привіт, Асія!/.test(спосіб.заготовка), 'заготовка в полі — без службових позначок', спосіб.заготовка);

console.log('\n═══ 1д. ПАЧКА КАРТОК, ЩО ПОВЕРНУЛАСЬ ПООДИНЦІ, — НЕ ДВІЧІ ═══');
/* Андрій, 15.10 (#1000119): три картки «Варіанти…» стояли двічі — зверху
   з ✓✓ (від Sitniks), знизу з ✓ (наш запис). Ми шлемо пачку одним
   повідомленням, а Sitniks віддає її трьома. */
const пачка = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000102');
  delete o.crmPicsOut; crmChat[o.id] = { chatId:'cP', msgs: [] };
  const e = crmPicsAdd(o, ['https://c/1.png', 'https://c/2.png', 'https://c/3.png'], 'pending');
  e.state = 'sent'; e.t = '#999'; crmPicsKeep(o, e);
  const t0 = new Date(Date.now() - 60000);
  const at = s => new Date(t0.getTime() + s * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const list = [
    { id:'s1', text:'', files:[{ url:'https://sx/a.png', kind:'img' }], mine:true, at: at(20) },
    { id:'s2', text:'', files:[{ url:'https://sx/b.png', kind:'img' }], mine:true, at: at(21) },
    { id:'s3', text:'', files:[{ url:'https://sx/c.png', kind:'img' }], mine:true, at: at(22) },
    { id:'s4', text:'Добрий день. Підготувала для вас прорахунок', files:[], mine:true, at: at(25) }
  ];
  const out = crmPicsMerge(o, list);
  return { картинок: out.filter(m => (m.files || []).length).length, наших: out.filter(m => m.local).length,
           записів: crmPicsAll(o).length };
});
console.log('  ' + JSON.stringify(пачка));
ok(пачка.картинок === 3 && !пачка.наших && !пачка.записів,
  'Sitniks повернув пачку з трьох картинок трьома повідомленнями — у стрічці три, без дублів з ✓', JSON.stringify(пачка));

console.log('\n═══ 2. КЛІЄНТ ПИШЕ В ІНШУ РОЗМОВУ ═══');
const інша = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000101');
  const o2 = orders.find(x => x.orderId === '2000102');
  crmInbox = [{ chatId:'c9', name:'Асія Дерещук', rawNick:'asia_dera', nick:'asia_dera', at:'2026-10-13 09:00', text:'Пап', mine:false },
              { chatId:'c1', name:'Асія Дерещук', rawNick:'asia_dera', nick:'asia_dera', at:'2026-09-25 10:00', text:'старе', mine:false }];
  crmElsewhereScan();
  const є = o.__elsewhere ? o.__elsewhere.chatId : '';
  const html = crmElsewhereHtml(o);
  /* Розмова іншого замовлення того самого клієнта — не «інша розмова». */
  o2.crmChatId = 'c9';
  crmElsewhereScan();
  const чуже = !!o.__elsewhere;
  delete o2.crmChatId;
  crmElsewhereScan();
  return { є, кнопка: /data-crm-rebind/.test(html), текст: /Пап/.test(html), чуже, знову: !!o.__elsewhere };
});
console.log('  ' + JSON.stringify(інша));
ok(інша.є === 'c9' && інша.кнопка && інша.текст,
  'свіже «Пап» в іншій розмові з тим самим ніком — смуга в чаті з кнопкою «Перевʼязати на нову»', JSON.stringify(інша));
ok(!інша.чуже && інша.знову, 'розмова, привʼязана до іншого замовлення, тривоги не здіймає', JSON.stringify(інша));

console.log('\n═══ 3. ЗАГОТОВКИ B2B / B2C ОКРЕМО Й ✎ НАЗАВЖДИ ═══');
const скр = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000101');
  const напр = quickReplies().map(q => q.t + ':' + (q.dir || '-')).join(' | ');
  const b2c = scriptFor(o, 'design1', { v: 2 }, 'b2c');
  const b2b = scriptFor(o, 'design1', { v: 2 }, 'b2b');
  const r = await scriptSave(o, 'design1', 'Ось новий макет v2, гляньте 🙌', { v: 2 }, 'b2c');
  const b2c2 = scriptFor(o, 'design1', { v: 5 }, 'b2c');
  const b2b2 = scriptFor(o, 'design1', { v: 5 }, 'b2b');
  const збер = (contentData.quickReplies || []).filter(q => q.dir === 'b2c').map(q => q.m).join(' | ');
  return { напр, b2c, b2b, r, b2c2, b2b2, збер };
});
console.log('  ' + JSON.stringify(скр));
ok(/Макет · B2B:b2b/.test(скр.напр) && /Макет · B2C:b2c/.test(скр.напр) && /Подяка:-/.test(скр.напр),
  'напрям заготовки впізнається за назвою «· B2B / · B2C», решта — для обох', скр.напр);
ok(/Привіт/.test(скр.b2c) && /v2/.test(скр.b2c) && /компанії/.test(скр.b2b) && !/Привіт/.test(скр.b2b),
  'B2C-картка бере B2C-скрипт, B2B — свій', JSON.stringify([скр.b2c, скр.b2b]));
ok(скр.r === true && /гляньте/.test(скр.b2c2) && /v5/.test(скр.b2c2) && /компанії/.test(скр.b2b2),
  '✎ «зберегти назавжди» — B2C-скрипт переписано, номер версії знову підставляється, B2B не зачеплено', JSON.stringify(скр));
ok(/^\{макет\} Ось новий макет \{версія\}/.test(скр.збер),
  'у базі — з позначкою й {версія}, щоб наступного разу підставилась своя', скр.збер);

console.log('\n═══ 4. B2C: ВІДВʼЯЗАТИ РОЗМОВУ ═══');
const відвʼяз = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000101');
  obAdd(o, 'crm', { text:'хвіст', state:'failed' });
  designUnbindChat(o);
  return { id: o.crmChatId || '', чат: !!crmChat[o.id], хвіст: (chatOutbox[o.id] || []).length, інша: !!o.__elsewhere };
});
console.log('  ' + JSON.stringify(відвʼяз));
ok(!відвʼяз.id && !відвʼяз.чат && !відвʼяз.хвіст && !відвʼяз.інша,
  'відвʼязали — розмова, її кеш і черга відправки знялись разом; можна привʼязати іншу', JSON.stringify(відвʼяз));

console.log('\n═══ 5. ПОГОДЖЕНО → ЕСКІЗ УЗГОДЖЕНО → ФІКСАЦІЯ ПЕРЕТЯГУВАННЯМ ═══');
const SETUP = `(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const D = window.LQDesign, U = D.ui;
  ['2000102', '2000103', '2000104'].forEach(id => {
    const j = designJobMake(id);
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:2 })];
    const d = D.dzNew();
    D.dzAttach(d, 'test@loomiq', 'test@loomiq'); D.dzSend(d, 'test@loomiq'); D.dzTake(d, 'test@loomiq');
    D.dzVer(d, 'test@loomiq', [{ name:'м.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }], '');
    D.dzList(j.units[0], 'graphic').push(d);
    D.dzSubmit && D.dzSubmit(d, 'test@loomiq');
    d.status = 'review'; d.sentAt = new Date().toISOString(); d.vers[0].sentToClient = true;
    D.sketchOkMark(d, 1, 'test@loomiq');
  });
  openDesign();
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
})()`;
await p.evaluate(SETUP);
await p.waitForTimeout(500);
const кол = () => p.evaluate(() => [...document.querySelectorAll('#dzRoot .dz-col[data-col="sketchok"] [data-open]')].map(x => x.dataset.open));
const до = await кол();
console.log('  «Ескіз узгоджено»: ' + до.join(', '));
ok(до.length === 3 && до[0] === '2000104', 'три картки в «Ескіз узгоджено», новіша згори', до.join());

const тягни = (id, col, nizhche) => p.evaluate(async ([id, col, nizhche]) => {
  const w = document.querySelector('#dzRoot [data-open="' + id + '"]').closest('[draggable]');
  w.dispatchEvent(new DragEvent('dragstart', { bubbles:true, dataTransfer: new DataTransfer() }));
  const k = document.querySelector('#dzRoot .dz-col[data-col="' + col + '"]');
  const ціль = nizhche && document.querySelector('#dzRoot [data-open="' + nizhche + '"]');
  const y = ціль ? ціль.getBoundingClientRect().bottom + 2 : k.getBoundingClientRect().top + 5;
  const можна = k.classList.contains('can-drop');
  k.ondrop({ preventDefault(){}, clientY: y });
  await new Promise(r => setTimeout(r, 400));
  return можна;
}, [id, col, nizhche || '']);

console.log('\n═══ 6. ПЕРЕТЯГНУТА КАРТКА СТОЇТЬ ТАМ, ДЕ ЇЇ ВІДПУСТИЛИ ═══');
const можна1 = await тягни('2000104', 'sketchok', '2000102');
const після = await кол();
console.log('  після: ' + після.join(', '));
ok(можна1 && після.join() === '2000103,2000102,2000104',
  'верхню картку опустили під нижню — вона там і стоїть, а не стрибає нагору', після.join());
await p.evaluate(() => window.LQDesign.ui.render(document.getElementById('dzRoot')));
const знову = await кол();
ok(знову.join() === після.join() && await p.evaluate(() => designJobs['2000104'].boardOrd != null),
  'і після перемальовування теж — порядок записано в задачу (boardOrd)', знову.join());
await тягни('2000103', 'sketchok', '2000102');
const третє = await кол();
ok(третє.join() === '2000102,2000103,2000104', 'посередині теж ставиться точно між сусідами', третє.join());

const фікс = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const w = document.querySelector('#dzRoot [data-open="2000102"]').closest('[draggable]');
  w.dispatchEvent(new DragEvent('dragstart', { bubbles:true, dataTransfer: new DataTransfer() }));
  const k = document.querySelector('#dzRoot .dz-col[data-col="stitchq"]');
  const можна = !!k && k.classList.contains('can-drop');
  k.ondrop({ preventDefault(){}, clientY: 0 });
  await new Promise(r => setTimeout(r, 300));
  const вікно = !!document.querySelector('.dz-cl [data-cl-go]');
  const одяг = [...document.querySelectorAll('.dz-cl [data-cl]')].map(x => x.value);
  const go = document.querySelector('.dz-cl [data-cl-go]');
  if(go) go.click();
  await new Promise(r => setTimeout(r, 600));
  const j = designJobs['2000102'], u = j.units[0], d = D.dzList(u, 'graphic')[0];
  return { можна, вікно, одяг, підтв: !!u.confirmed, ok: !!d.ok, стан: d.status,
           колонка: D.chainAt(j, orders.find(x => x.orderId === '2000102')) };
});
console.log('  ' + JSON.stringify(фікс));
ok(фікс.можна && фікс.вікно && фікс.одяг.join() === 'tee,Чорний,M,2',
  'перетягнули «Ескіз узгоджено» → «Черга вишивки» — відкрилась фіксація з одягом', JSON.stringify(фікс));
ok(фікс.підтв && фікс.ok && фікс.стан === 'approved' && фікс.колонка === 'stitchq',
  'підтвердили — одяг зафіксовано, ескіз погоджено, картка в «Черзі вишивки»', JSON.stringify(фікс));

console.log('\n═══ 7. КАРТКА СТОЇТЬ ЗА НАЙВІДСТАЛІШОЮ ПОЗИЦІЄЮ ═══');
const відст = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui, m = 'test@loomiq';
  const j = designJobMake('2000103'), o = orders.find(x => x.orderId === '2000103');
  const нова = () => {
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1 });
    const d = D.dzNew(); D.dzAttach(d, m, m); D.dzSend(d, m); D.dzTake(d, m);
    D.dzVer(d, m, [{ name:'м.png', url:'x' }], ''); d.status = 'review'; d.vers[0].sentToClient = true;
    D.dzList(u, 'graphic').push(d); return u;
  };
  j.units = [нова(), нова(), нова()];
  const g = k => D.dzList(j.units[k], 'graphic')[0];
  const стіч = () => j.units.map(u => D.dzList(u, 'stitch').length).join('');
  const кроки = [];
  /* Дві позиції погоджено й зафіксовано, третя ще в клієнта. */
  [0, 1].forEach(k => { D.sketchOkMark(g(k), 1, m); D.dzOk(g(k), m, 'client', 1); D.clothConfirm(j.units[k], m); });
  D.dzAutoStitch(j, m);
  кроки.push(D.chainAt(j, o) + ':' + стіч());
  /* Третю узгодили, але ще не зафіксували. */
  D.sketchOkMark(g(2), 1, m);
  D.dzAutoStitch(j, m);
  кроки.push(D.chainAt(j, o) + ':' + стіч());
  /* Зафіксували — уся картка разом у «Черзі вишивки». */
  D.dzOk(g(2), m, 'client', 1); D.clothConfirm(j.units[2], m);
  D.dzAutoStitch(j, m);
  кроки.push(D.chainAt(j, o) + ':' + стіч());
  /* Одну позицію призначили вишивальному (29.10: черги немає, призначає
     акаунт) — картка в «Черзі», поки не призначено решту. */
  const s0 = D.dzList(j.units[0], 'stitch')[0]; D.dzAssign(s0, 'emb@loomiq', m, 'Ем');
  кроки.push(D.chainAt(j, o));
  /* Правки клієнта по одній — гучніші за все. */
  return кроки;
});
console.log('  ' + відст.join(' → '));
ok(відст[0] === 'client:000', 'дві позиції погоджено, одна в клієнта — картка «У клієнта», у вишивку не пішов ніхто', відст[0]);
ok(відст[1] === 'sketchok:000', 'третю узгодили — «Ескіз узгоджено», вишивки ще немає: чекаємо фіксації', відст[1]);
ok(відст[2] === 'stitchq:111', 'зафіксували — усі три позиції разом у «Черзі вишивки»', відст[2]);
ok(відст[3] === 'stitchq', 'призначили одну — картка чекає в «Черзі вишивки», поки не призначено всі', відст[3]);

console.log('\n═══ 7б. НЕПРОЧИТАНЕ ГОРИТЬ, ПОКИ НЕ НАТИСНУЛИ 👁 АБО НЕ ВІДПОВІЛИ ═══');
const непр = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000103');
  const мить = хв => new Date(Date.now() - хв * 60000).toISOString().replace('T', ' ').slice(0, 16);
  o.crmChatId = 'c3'; o.crmSeen = ''; o.crmUnread = 1; o.crmTheirs = true;
  crmChat[o.id] = { chatId:'c3', msgs: [{ text:'Розробили макет', mine:true, at: мить(30) }, { text:'Так, супер', mine:false, at: мить(5) }] };
  window.crmFetch = async () => ({ id:'r1' });
  chatOpen(o, 'crm', { noDrawer: true, dir: 'b2c' });
  await new Promise(r => setTimeout(r, 300));
  const відкрив = chatWaiting(o, 'crm');
  /* На картці канбану — теж «1». */
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const картка = ((document.querySelector('#dzRoot [data-open="2000103"]') || {}).closest
    ? (document.querySelector('#dzRoot [data-open="2000103"]').closest('.dz-card-w') || document.querySelector('#dzRoot [data-open="2000103"]')).textContent : '');
  /* Відповіли — гасне саме. */
  await crmSend(o, 'Дякуємо!');
  const відповіли = chatWaiting(o, 'crm');
  /* Такт опитування: нашої відповіді Sitniks ще не повернув — кружечок не вертається. */
  crmChat[o.id].msgs = crmNormMsgs([
    { id:'a', text:'Розробили макет', createdAt: мить(30).replace(' ', 'T') + ':00Z' },
    { id:'b', text:'Так, супер', createdAt: мить(5).replace(' ', 'T') + ':00Z' }], o);
  const такт = chatWaiting(o, 'crm');
  /* Клієнт написав ще — знову горить. */
  crmChat[o.id].msgs = crmNormMsgs([
    { id:'a', text:'Розробили макет', createdAt: мить(30).replace(' ', 'T') + ':00Z' },
    { id:'b', text:'Так, супер', createdAt: мить(5).replace(' ', 'T') + ':00Z' },
    { id:'c', text:'А коли буде?', createdAt: new Date().toISOString() }], o);
  const знову = chatWaiting(o, 'crm');
  chatClose();
  /* Telegram: відкрили картку — горить; відповіли — гасне. */
  const t = orders.find(x => x.orderId === '2000104') || orders.find(x => x.orderId === '2000102');
  t.webId = 'tg:777'; t.tgAt = мить(1); t.tgWrote = 3; t.tgSeen = мить(60); t.tgSeenWrote = 2; t.tgLast = 'Добрий день';
  try{ openOrderDrawer(t); }catch(e){}
  await new Promise(r => setTimeout(r, 200));
  const тгВідкрив = tgUnread(t);
  try{ closeOrderDrawer(); }catch(e){}
  contentData.bgApi = Object.assign({}, contentData.bgApi || {}, { tgUrl: 'https://tg.test' });
  window.fbAuth = window.fbAuth || {};
  fbAuth.currentUser = { getIdToken: async () => 'x', email: 'test@loomiq' };
  const f0 = window.fetch;
  window.fetch = async (u, opt) => /tg\.test/.test(String(u)) ? new Response(JSON.stringify({ ok: true }), { status: 200 }) : f0(u, opt);
  const тгВідповів = await tgSend(t, 'Так');
  window.fetch = f0;
  return { відкрив, картка, відповіли, такт, знову, тгВідкрив, тгВідповів, тгПісля: tgUnread(t) };
});
console.log('  ' + JSON.stringify(непр));
ok(непр.відкрив, 'відкрили розмову — непрочитане лишається (гасить лише 👁 або відповідь)', JSON.stringify(непр));
ok(/1/.test(непр.картка), 'на картці канбану — «1» від клієнта', непр.картка);
ok(!непр.відповіли && !непр.такт, 'відповіли — гасне саме, і такт опитування його не повертає', JSON.stringify(непр));
ok(непр.знову, 'клієнт написав ще — знову горить', JSON.stringify(непр));
ok(непр.тгВідкрив && непр.тгВідповів && !непр.тгПісля, 'Telegram так само: відкрили — горить, відповіли — гасне', JSON.stringify(непр));

console.log('\n═══ 8. ВИДАЛИТИ ЗАМОВЛЕННЯ B2C — ЛИШЕ ВЛАСНИК, УНИЗУ ІСТОРІЇ ═══');
const вид = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  window.confirm = () => true;
  const кнопка = () => !!document.querySelector('#dzRoot [data-do="order-del"]');
  const відкрий = id => { U.setTab('acct'); U.render(document.getElementById('dzRoot'));
    const c = document.querySelector('#dzRoot [data-open="' + id + '"]'); if(c) c.click();
    /* Історія згорнута — розгортаємо: кнопка внизу її вмісту. */
    const h = document.querySelector('#dzRoot [data-fold="Історія"]');
    if(h && !h.closest('.open')) h.click(); };
  відкрий('2000104');
  const власник = кнопка();
  const позиція = (() => { const b = document.querySelector('#dzRoot [data-do="order-del"]');
    const f = b && b.closest('.dz-z'); return f ? f.textContent.slice(0, 40) : ''; })();
  /* Менеджер — кнопки немає, і навіть прямий виклик відмовляє. */
  contentData.team = [{ email:'test@loomiq', name:'Оля', role:'manager' }, { email:'boss@loomiq', name:'Андрій', role:'owner' }];
  відкрий('2000104');
  const менеджер = кнопка();
  await U.host.deleteOrder(orders.find(x => x.orderId === '2000104'));
  const лишилось1 = !!orders.find(x => x.orderId === '2000104');
  contentData.team = [{ email:'test@loomiq', name:'Оля', role:'owner' }];
  /* З оплатою — не видаляється. */
  const o4 = orders.find(x => x.orderId === '2000104');
  o4.payments = [{ payId:'p1', sum: 500, at:'2026-10-14' }];
  await U.host.deleteOrder(o4);
  const лишилось2 = !!orders.find(x => x.orderId === '2000104');
  o4.payments = [];
  відкрий('2000104');
  const кн3 = document.querySelector('#dzRoot [data-do="order-del"]');
  if(!кн3) return { власник, позиція, менеджер, лишилось1, лишилось2, роль: myRole(), err: 'немає кнопки після повернення ролі' };
  кн3.click();
  await new Promise(r => setTimeout(r, 600));
  return { власник, позиція, менеджер, лишилось1, лишилось2, після: !!orders.find(x => x.orderId === '2000104'), job: !!designJobs['2000104'] };
});
console.log('  ' + JSON.stringify(вид));
ok(вид.власник && /Історія/.test(вид.позиція), 'власник бачить «🗑 Видалити замовлення» унизу Історії', JSON.stringify(вид));
ok(!вид.менеджер && вид.лишилось1, 'менеджер кнопки не бачить, і видалити не може навіть напряму', JSON.stringify(вид));
ok(вид.лишилось2, 'замовлення з привʼязаною оплатою не видаляється — гроші не губляться', JSON.stringify(вид));
ok(!вид.після && !вид.job, 'власник видалив — немає ні замовлення, ні роботи відділу', JSON.stringify(вид));
const зел = await p.evaluate(() => { const b = document.createElement('button'); b.className = 'fin-chip is-chk-go'; document.body.appendChild(b);
  const c = getComputedStyle(b); const r = { bg: c.backgroundColor, color: c.color }; b.remove(); return r; });
ok(зел.bg === 'rgb(27, 107, 58)' && зел.color === 'rgb(255, 255, 255)', 'у Фінансах «✓ Підтвердити» — суцільна зелена кнопка з білим текстом', JSON.stringify(зел));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nчати, заготовки, фіксація й порядок на дошці працюють');
process.exit(bad ? 1 : 0);
