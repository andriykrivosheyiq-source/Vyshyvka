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
  /* Вишивальний узяв одну — картка в «Черзі», поки інші не взяли. */
  const s0 = D.dzList(j.units[0], 'stitch')[0]; D.dzTake(s0, 'emb@loomiq');
  кроки.push(D.chainAt(j, o));
  /* Правки клієнта по одній — гучніші за все. */
  return кроки;
});
console.log('  ' + відст.join(' → '));
ok(відст[0] === 'client:000', 'дві позиції погоджено, одна в клієнта — картка «У клієнта», у вишивку не пішов ніхто', відст[0]);
ok(відст[1] === 'sketchok:000', 'третю узгодили — «Ескіз узгоджено», вишивки ще немає: чекаємо фіксації', відст[1]);
ok(відст[2] === 'stitchq:111', 'зафіксували — усі три позиції разом у «Черзі вишивки»', відст[2]);
ok(відст[3] === 'stitchq', 'вишивальний узяв одну — картка чекає в «Черзі», поки не візьмуть усі', відст[3]);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nчати, заготовки, фіксація й порядок на дошці працюють');
process.exit(bad ? 1 : 0);
