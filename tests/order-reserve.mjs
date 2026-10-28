/* БРОНЬ НОМЕРА В АДМІНЦІ (22.10) — зі стубом бази.

   1. Усі наявні номери власник бронює автоматично один раз.
   2. Нова картка: номер зайнятий у базі (чужа бронь) — картка бере
      наступний вільний, і саме він бронюється; картка записується з ним.
   3. Повторний запис тієї самої картки номер не міняє.
   4–5. Звірка: розʼєднана картка — «Зʼєднати», незаписана — «Відновити».
   6. Відновили порожню, а справжня з діалогом під іншим номером — «Обʼєднати».
   7. Журнал: видалена картка — не сирота; помилкове «Зʼєднати» — «Повернути».

   Запуск:  node tests/order-reserve.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9027;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
  rolesSeed: 2,
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ window.__TAKEN=window.__TAKEN||{}; window.__RES=window.__RES||[]; var t={ get:function(ref){ var no=ref.__id; var d=window.__TAKEN[no]; return Promise.resolve({ exists:!!d, data:function(){ return d; } }); }, set:function(ref,d){ window.__TAKEN[ref.__id]=d; window.__RES.push(ref.__id); } }; return Promise.resolve(f(t)); },")
  .replace("batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },",
  "batch:function(){ return { set:function(ref,d){ if(ref.__col && ref.__col!=='orderNos') return; window.__TAKEN=window.__TAKEN||{}; window.__TAKEN[ref.__id]=d; (window.__SEED=window.__SEED||[]).push(ref.__id); }, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };')
  .replace('Doc.prototype.delete=function(){ return Promise.resolve(); };',
  "Doc.prototype.delete=function(){ if(this.__col==='orderNos'){ window.__TAKEN=window.__TAKEN||{}; delete window.__TAKEN[this.__id]; (window.__FREED=window.__FREED||[]).push(this.__id); } return Promise.resolve(); };")
  .replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(this.__col==='orderNos'){ window.__TAKEN=window.__TAKEN||{}; if(window.__TAKEN[this.__id]) return Promise.reject(Object.assign(new Error('already exists'),{code:'already-exists'})); window.__TAKEN[this.__id]=d; (window.__RES=window.__RES||[]).push(this.__id); } return Promise.resolve(); };");
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype); SeedCol.prototype.__n="kanbanOrders";\n' +
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







const ЖДИ = ms => p.waitForTimeout(ms);
console.log('═══ 1. НАЯВНІ НОМЕРИ ЗАБРОНЬОВАНО ОДИН РАЗ ═══');
await p.evaluate(async () => { await orderNosSeedOnce(); });
await ЖДИ(300);
const сід = await p.evaluate(() => ({ seed: (window.__SEED || []).slice().sort(), flag: contentData.orderNosSeed, nos: orders.filter(o => !o.draft).map(o => o.orderId).sort() }));
console.log('   ' + JSON.stringify(сід));
ok(сід.seed.join() === сід.nos.join() && сід.flag === 1, 'кожен номер з дошки має бронь, позначка «зроблено»', JSON.stringify(сід));
const сід2 = await p.evaluate(async () => { window.__SEED = []; await orderNosSeedOnce(); return (window.__SEED || []).length; });
ok(сід2 === 0, 'вдруге не бронює', 'вдруге: ' + сід2);

console.log('');
console.log('═══ 2. НОМЕР ЗАЙНЯТИЙ ЧУЖОЮ БРОННЮ — КАРТКА БЕРЕ НАСТУПНИЙ ═══');
const нова = await p.evaluate(async () => {
  const no = makeOrderId('b2c');
  /* Хтось в іншій вкладці уже забронював цей номер і наступний. */
  window.__TAKEN[String(no)] = { id: 'chuzha-1' }; window.__TAKEN[String(+no + 1)] = { id: 'chuzha-2' };
  window.__RES = [];
  const o = { id: 'new-1', orderId: String(no), type: 'client', dir: 'b2c', name: 'Тест', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: new Date().toISOString() };
  orders.push(o);
  const failed = await saveOrders({ quiet: true });
  return { хотів: String(no), дали: o.orderId, res: window.__RES.slice(), failed: failed.length, taken: window.__TAKEN[o.orderId] && window.__TAKEN[o.orderId].id };
});
console.log('   ' + JSON.stringify(нова));
ok(+нова.дали === +нова.хотів + 2 && нова.res.join() === нова.дали && нова.taken === 'new-1' && !нова.failed,
  'хотів ' + нова.хотів + ', обидва зайняті — дали ' + нова.дали + ', і саме він заброньований за цією карткою', JSON.stringify(нова));
const знову = await p.evaluate(async () => { const o = orders.find(x => x.id === 'new-1'); o.name = 'Тест 2'; window.__RES = [];
  await saveOrders({ quiet: true }); return { no: o.orderId, res: window.__RES.length }; });
ok(знову.no === нова.дали && знову.res === 0, 'повторний запис тієї ж картки — номер той самий, нових броней немає', JSON.stringify(знову));

console.log('');
console.log('═══ 3. ПРАВИЛА ЩЕ НЕ ПУСКАЮТЬ ДО orderNos — НОМЕР НЕ ЧІПАЄМО, БРОНЬ ВИМКНЕНА (23.10) ═══');
const відмова = await p.evaluate(async () => {
  orderNosOff = false;
  const real = fbDb.runTransaction;
  fbDb.runTransaction = () => Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
  const no = makeOrderId('b2c');
  const o = { id: 'new-2', orderId: String(no), type: 'client', dir: 'b2c', name: 'Без правил', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: new Date().toISOString() };
  orders.push(o); window.__RES = [];
  const failed = await saveOrders({ quiet: true });
  const r = { хотів: String(no), дали: o.orderId, off: orderNosOff, res: window.__RES.length, failed: failed.length };
  fbDb.runTransaction = real; orderNosOff = false;
  return r;
});
console.log('   ' + JSON.stringify(відмова));
ok(відмова.дали === відмова.хотів && відмова.off && відмова.res === 0 && !відмова.failed,
  'відмова правил: номер картки той самий, бронь вимкнено, картка записана', JSON.stringify(відмова));

console.log('');
console.log('═══ 4. КАРТКА, ЩО ВТРАТИЛА НОМЕР, — ЗВІРКА ПОВЕРТАЄ (23.10) ═══');
const сирота = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const at = new Date().toISOString();
  /* Штучні картки з §2–3 (B2C без картки відділу) прибираємо — у житті кожна
     B2C-картка має картку відділу. */
  orders = orders.filter(x => x.id !== 'new-1' && x.id !== 'new-2');
  /* Як після збою: картка відділу й платіж під 5000301, сама картка — під 5000341. */
  const o = { id: 'lost-1', orderId: '5000341', type: 'client', dir: 'b2c', name: 'Марта', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at,
    payments: [] };
  orders.push(o); ordersSaved.set(o.id, JSON.stringify(o));
  const j = D.emptyJob('5000301'); j.no = '2000301'; j.createdAt = at; designJobs['5000301'] = j;
  payments.push({ id: 'p-lost', amount: 500, at, acc: 'mono1', src: 'mono', orderId: '5000301', tag: 'prepay' });
  payLoaded = true;
  const rows = orphanB2cRows();
  const r = { n: rows.length, row: rows[0] && { from: rows[0].orderId, to: rows[0].toNo, text: rows[0].text.slice(0, 80) } };
  if(rows[0]){ await orphanB2cRestore(rows[0]); }
  return Object.assign(r, { after: o.orderId, paid: paidSum(o), left: orphanB2cRows().length });
});
console.log('   ' + JSON.stringify(сирота));
ok(сирота.n === 1 && сирота.row.from === '5000341' && сирота.row.to === '5000301' && /#2000301 .*розʼєдналась/.test(сирота.row.text) && !/5000/.test(сирота.row.text),
  'Звірка: «Картка #2000301 розʼєдналась…» — без ключів 5000…', JSON.stringify(сирота.row));
ok(сирота.after === '5000301' && сирота.paid === 500 && сирота.left === 0, '«Зʼєднати» — картка знову під своїм ключем, платіж 500 ₴ на місці', JSON.stringify(сирота));

console.log('');
console.log('═══ 5. КАРТКА ВІДДІЛУ Є, ЗАМОВЛЕННЯ НЕ ЗАПИСАЛОСЬ — «ВІДНОВИТИ» (23.10) ═══');
const відн = await p.evaluate(async () => {
  const D = window.LQDesign;
  const at = new Date().toISOString();
  /* У картки Марти (§4) своя картка відділу з роботою — як у кожної живої
     B2C-картки (одяг додають до «Створити замовлення»). */
  designJobs['5000301'].brief.text = 'худі з вишивкою';
  const j = D.emptyJob('5000302'); j.no = '2000302'; j.createdAt = at; designJobs['5000302'] = j;
  payments.push({ id: 'p-lost2', amount: 6120, at, acc: 'mono1', src: 'mono', orderId: '5000302', tag: 'prepay', counter: 'Коваль Іра' });
  const rows = orphanB2cRows();
  const r = { n: rows.length, kind: rows[0] && rows[0].kind, text: rows[0] && rows[0].text.slice(0, 70) };
  if(rows[0]) await orphanB2cRestore(rows[0]);
  const o = orders.find(x => x.orderId === '5000302');
  return Object.assign(r, { є: !!o, dir: o && o.dir, paid: o ? paidSum(o) : 0, left: orphanB2cRows().length, lost: moneyAudit().filter(x => x.kind === 'lost_order' && x.orderId === '5000302').length, hint: (o && o.restoreHint) || '' });
});
console.log('   ' + JSON.stringify(відн));
ok(відн.n === 1 && відн.kind === 'orphan_job' && /#2000302 .*не дописалась/.test(відн.text), 'Звірка: «Картка #2000302 не дописалась…»', JSON.stringify(відн));
ok(відн.є && відн.dir === 'b2c' && відн.paid === 6120 && відн.left === 0 && відн.lost === 0, '«Відновити» — картка на дошці з тим самим номером, платіж 6 120 ₴ при ній, «такого замовлення немає» зникло', JSON.stringify(відн));
ok(/відновлено зі Звірки/.test(відн.hint) && /6.120 ₴ від Коваль Іра/.test(відн.hint) && /Sitniks/.test(відн.hint), 'у картці підказка, чия це розмова: платник і дата (28.10)', відн.hint);

console.log('');
console.log('═══ 6. ВІДНОВИЛИ ПОРОЖНЮ, А СПРАВЖНЯ З ДІАЛОГОМ — ПІД ІНШИМ НОМЕРОМ: «ОБʼЄДНАТИ» (23.10) ═══');
const двійня = await p.evaluate(async () => {
  const D = window.LQDesign;
  const A = orders.find(x => x.orderId === '5000302');          // відновлена порожня (§5)
  const at = A.createdAt;
  /* Справжня картка тієї ж людини: після стрибка номера стала 5000303, має діалог
     і клієнта; під її ключем — порожня картка відділу, що завелась сама. */
  const B = { id: 'real-303', orderId: '5000303', type: 'client', dir: 'b2c', name: 'Олена', phone: '+380501112233', status: 'prorahunok', site: 'main',
    items: [], hist: [], createdAt: at, crmChatId: 'c303', crmChatName: 'olena' };
  orders.push(B); ordersSaved.set(B.id, JSON.stringify(B));
  const j3 = D.emptyJob('5000303'); j3.no = '2000303'; j3.createdAt = at; j3.units = [D.ui.unitNew()]; designJobs['5000303'] = j3;   // під її номером уже додали одяг
  window.__TAKEN['5000302'] = { id: A.id }; window.__TAKEN['5000303'] = { id: B.id };
  window.__RES = []; window.__FREED = [];
  const rows = orphanB2cRows();
  const row = rows.find(x => x.kind === 'twin_b2c');
  const r = { n: rows.length, kinds: rows.map(x => x.kind).join(), text: row && row.text };
  if(row) await orphanB2cRestore(row);
  const зал = orders.filter(x => x.orderId === '5000302' || x.orderId === '5000303');
  const o = зал[0];
  return Object.assign(r, { карток: зал.length, id: o && o.id, no: o && o.orderId, chat: o && o.crmChatId, name: o && o.name,
    paid: o ? paidSum(o) : 0, job303gone: !!(designJobs['5000303'] && designJobs['5000303'].gone), job302: designJobs['5000302'] && { no: designJobs['5000302'].no, units: D.ui.unitsOf(designJobs['5000302']).length, gone: !!designJobs['5000302'].gone },
    retired: window.__TAKEN['5000303'] && window.__TAKEN['5000303'].id,
    taken: window.__TAKEN['5000302'] && window.__TAKEN['5000302'].id, freed: window.__FREED.slice().sort().join(), aGone: !ordersSaved.has(A.id) && !orders.some(x => x.id === A.id),
    left: orphanB2cRows().length, lost: moneyAudit().filter(x => x.kind === 'lost_order').length });
});
console.log('   ' + JSON.stringify(двійня));
ok(двійня.n === 1 && двійня.kinds === 'twin_b2c' && /#2000302 .*відновлена порожньою.*Олена.*#2000303.*у відділі є одяг/.test(двійня.text) && !/5000/.test(двійня.text),
  'Звірка: один пункт «Картка #2000302 відновлена порожньою, а діалог і клієнт (Олена) лишились на #2000303» — без ключів 5000…', JSON.stringify(двійня));
ok(двійня.карток === 1 && двійня.id === 'real-303' && двійня.no === '5000302' && двійня.chat === 'c303' && двійня.name === 'Олена' && двійня.paid === 6120,
  '«Обʼєднати» — одна картка: справжня (діалог, Олена) під #2000302, платіж 6 120 ₴ при ній', JSON.stringify(двійня));
ok(двійня.taken === 'real-303' && двійня.retired === 'gone:real-303' && двійня.aGone && двійня.left === 0 && двійня.lost === 0,
  'бронь #2000302 тепер за справжньою карткою, #2000303 помічено «вибув» (не видається знову), порожня картка зникла, Звірка чиста', JSON.stringify(двійня));
ok(двійня.job303gone && двійня.job302 && !двійня.job302.gone && двійня.job302.no === '2000302' && двійня.job302.units === 1,
  'одяг з-під #2000303 переїхав у картку відділу #2000302, під #2000303 — надгробок', JSON.stringify(двійня.job302));

console.log('');
console.log('═══ 7. ЖУРНАЛ ПАМʼЯТАЄ: ВИДАЛЕНА КАРТКА — НЕ СИРОТА; ПОМИЛКОВЕ «ЗʼЄДНАТИ» — «ПОВЕРНУТИ» (23.10) ═══');
const журн = await p.evaluate(async () => {
  const D = window.LQDesign;
  const at = new Date().toISOString();
  contentData.accessLog = [
    { at, by: 'test@loomiq', kind: 'del',   text: 'видалив замовлення B2C 5000310 · Іра · 900 грн' },
    { at, by: 'test@loomiq', kind: 'renum', text: 'зʼєднано картку #2000320 зі своєю карткою відділу (ключ 5000320 → 5000311)' } ];
  /* а) картку 5000310 видалили, картка відділу лишилась (правила не дали видалити); «Відновити» вже натиснули */
  const j10 = D.emptyJob('5000310'); j10.no = '2000310'; j10.createdAt = at; j10.units = [D.ui.unitNew()]; designJobs['5000310'] = j10;
  const R2 = { id: 'rest-310', orderId: '5000310', type: 'client', dir: 'b2c', name: '', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at, restoredAt: at };
  orders.push(R2); ordersSaved.set(R2.id, JSON.stringify(R2));
  /* б) живу картку Іри (5000320) «Зʼєднати» перекинуло на 5000311; її одяг і платіж — під 5000320, там відновили порожню */
  const X = { id: 'x-1', orderId: '5000311', type: 'client', dir: 'b2c', name: 'Іра', crmChatId: 'c320', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at };
  const R = { id: 'rest-320', orderId: '5000320', type: 'client', dir: 'b2c', name: '', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at, restoredAt: at };
  orders.push(X, R); ordersSaved.set(X.id, JSON.stringify(X)); ordersSaved.set(R.id, JSON.stringify(R));
  const j20 = D.emptyJob('5000320'); j20.no = '2000320'; j20.createdAt = at; j20.units = [D.ui.unitNew()]; designJobs['5000320'] = j20;
  /* під 5000311 — картка відділу ВИДАЛЕНОЇ картки (з нею й зʼєднали помилково) */
  const j11 = D.emptyJob('5000311'); j11.no = '2000311'; j11.createdAt = at; j11.units = [D.ui.unitNew()]; designJobs['5000311'] = j11;
  contentData.accessLog.push({ at, by: 'test@loomiq', kind: 'del', text: 'видалив замовлення B2C 5000311 · Хтось' });
  payments.push({ id: 'p-320', amount: 900, at, acc: 'mono1', src: 'mono', orderId: '5000320', tag: 'prepay' });
  const rows = orphanB2cRows();
  const r = { kinds: rows.map(x => x.kind).sort().join(), t1: (rows.find(x => x.kind === 'wrong_join') || {}).text, t2: (rows.find(x => x.kind === 'restored_del') || {}).text };
  for(const x of rows) await orphanB2cRestore(x);
  return Object.assign(r, { xNo: X.orderId, rGone: !orders.some(o => o.id === 'rest-320'), r2Gone: !orders.some(o => o.id === 'rest-310'),
    paid: paidSum(X), job310gone: !!(designJobs['5000310'] || {}).gone, left: orphanB2cRows().map(x => x.kind).join() });
});
console.log('   ' + JSON.stringify(журн));
ok(журн.kinds === 'restored_del,wrong_join' && /#2000320 \(Іра\).*test.*не з тією.*під #2000311.*під #2000320/.test(журн.t1) && /#2000310 відновлена даремно.*видалили/.test(журн.t2),
  'Звірка: «Картку #2000320 (Іра) зʼєднали не з тією…» → «Повернути»; «#2000310 відновлена даремно: її видалили» → «Прибрати»; сироти від видаленої немає', JSON.stringify(журн));
ok(журн.xNo === '5000320' && журн.rGone && журн.r2Gone && журн.paid === 900 && журн.job310gone && журн.left === '',
  '«Повернути»: Іра знову під #2000320 з платежем 900 ₴, порожня зникла; «Прибрати»: порожня #2000310 зникла, під нею надгробок; Звірка чиста', JSON.stringify(журн));

console.log('');
console.log('═══ 8. СИРОТА, ЯКУ МЕНЕДЖЕР ЗАВІВ ЗАНОВО, — «ОБʼЄДНАТИ В #Y» (28.10) ═══');
/* 27.10: картка #2000330 не дописалась (бронь, одяг і платіж є), менеджер
   через дві години завів Олену заново як #2000331. Андрій: «не потрібно
   робити відновити… обʼєднати». */
const злит = await p.evaluate(async () => {
  const D = window.LQDesign;
  const t0 = Date.now() - 3 * 3600000, at = new Date(t0).toISOString(), at2 = new Date(t0 + 2 * 3600000).toISOString();
  const j30 = D.emptyJob('5000330'); j30.no = '2000330'; j30.createdAt = at; j30.units = [Object.assign(D.ui.unitNew(), { gid:'tee', name:'Футболка', qty:2 })]; designJobs['5000330'] = j30;
  payments.push({ id: 'p-330', amount: 1560, at, acc: 'mono1', src: 'mono', counter: 'Коваль Олена', orderId: '5000330', tag: 'prepay' });
  const R = { id: 're-331', orderId: '5000331', type: 'client', dir: 'b2c', name: 'Олена Коваль', crmChatId: 'c331', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at2, payments: [] };
  orders.push(R); ordersSaved.set(R.id, JSON.stringify(R));
  const j31 = D.emptyJob('5000331'); j31.no = '2000331'; j31.createdAt = at2; designJobs['5000331'] = j31;
  /* картка того ж часу з іншою людиною й своїм платежем — не кандидат */
  const Z = { id: 'z-332', orderId: '5000332', type: 'client', dir: 'b2c', name: 'Петро', crmChatId: 'c332', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at2 };
  orders.push(Z); ordersSaved.set(Z.id, JSON.stringify(Z));
  payments.push({ id: 'p-332', amount: 500, at: at2, acc: 'mono1', src: 'mono', orderId: '5000332', tag: 'prepay' });
  window.__TAKEN['5000330'] = { id: 'dead-330' }; window.__TAKEN['5000331'] = { id: R.id }; window.__TAKEN['5000332'] = { id: Z.id };
  /* друга сирота тієї ж Олени (1 100 ₴) — кандидат той самий, з позначкою; картка з власним платежем за іменем теж кандидат */
  const j33 = D.emptyJob('5000329'); j33.no = '2000329'; j33.createdAt = at; j33.units = [Object.assign(D.ui.unitNew(), { gid:'hoodie', name:'Худі', qty:1 })]; designJobs['5000329'] = j33;
  payments.push({ id: 'p-333', amount: 1100, at, acc: 'mono1', src: 'mono', counter: 'Коваль Олена', orderId: '5000329', tag: 'prepay' });
  const at3 = new Date(t0 + 3 * 864e5).toISOString();
  const R2 = { id: 're-334', orderId: '5000334', type: 'client', dir: 'b2c', name: 'Олена Коваль', crmChatId: 'c331', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: at3, ttn: '20450000001234' };
  orders.push(R2); ordersSaved.set(R2.id, JSON.stringify(R2));
  const j34 = D.emptyJob('5000334'); j34.no = '2000334'; j34.createdAt = at3; designJobs['5000334'] = j34;
  payments.push({ id: 'p-334', amount: 300, at: at3, acc: 'mono1', src: 'mono', orderId: '5000334', tag: 'final' });
  window.__TAKEN['5000329'] = { id: 'dead-329' }; window.__TAKEN['5000334'] = { id: R2.id };
  const rows = orphanB2cRows();
  const row = rows.find(x => x.kind === 'orphan_job' && x.toNo === '5000330');
  const row2 = rows.find(x => x.kind === 'orphan_job' && x.toNo === '5000329');
  const r = { kinds: rows.map(x => x.kind).sort().join(), twins: row && (row.twins || []).map(t => t.no + ':' + t.name + ':' + t.why).join(), text: row && row.text,
    twins2: row2 && (row2.twins || []).map(t => t.no).join(), shared: /Увага: #2000331, #2000334 пропонується ще й іншій сироті/.test((row2 || {}).text || ''),
    ручна: (orphanMergeTarget('2000334', '5000330') || {}).id, ручнаКлюч: (orphanMergeTarget('#5000331', '5000330') || {}).id, сама: orphanMergeTarget('2000330', '5000330') };
  if(row) await orphanMergeInto(row, '5000331');
  const p = payments.find(x => x.id === 'p-330');
  return Object.assign(r, { pTo: p.orderId, copy: (R.payments || []).some(e => e.payId === 'p-330'), paid: paidSum(R),
    units: D.ui.unitsOf(designJobs['5000331']).length, no31: designJobs['5000331'].no, gone30: !!(designJobs['5000330'] || {}).gone,
    retired: window.__TAKEN['5000330'] && window.__TAKEN['5000330'].id, nR: orders.filter(x => x.orderId === '5000331').length,
    left: orphanB2cRows().filter(x => x.toNo === '5000330').length, lost: moneyAudit().filter(x => x.kind === 'lost_order' && x.orderId === '5000330').length });
});
console.log('   ' + JSON.stringify(злит));
ok(злит.twins === '5000331:Олена Коваль:імʼя,5000334:Олена Коваль:імʼя' && /#2000330 .*не дописалась.*платіж 1.560 ₴ від Коваль Олена \(\d\d\.\d\d\).*завів її заново: #2000331 \(Олена Коваль, \d\d\.\d\d, збіг імені платника\) або #2000334 \(Олена Коваль, .*уже має 1 платіж\(і\), є ТТН\).*«Обʼєднати в #2000331».*«Обʼєднати в №…».*«Створити картку»/.test(злит.text) && !/5000/.test(злит.text),
  'Звірка: платник і дата в рядку; кандидати за імʼям платника (і з власним платежем/ТТН — з позначкою); Петро зі своїм платежем — ні', JSON.stringify(злит));
ok(/ПЕРЕВІРТЕ: у цього платника кілька живих карток/.test(злит.text), 'порада в рядку: кілька карток платника — перевірити', злит.text);
ok(злит.twins2 === '5000331,5000334' && злит.shared, 'друга сирота тієї ж людини — ті самі кандидати з попередженням «пропонується ще й іншій сироті»', JSON.stringify({ twins2: злит.twins2, shared: злит.shared }));
ok(злит.ручна === 're-334' && злит.ручнаКлюч === 're-331' && злит.сама === null, '«Обʼєднати в №…»: номер відділу чи ключ знаходять картку, сама сирота — ні', JSON.stringify(злит));
ok(злит.pTo === '5000331' && злит.copy && злит.paid === 1560 && злит.units === 1 && злит.no31 === '2000331' && злит.gone30 && злит.retired === 'gone:re-331' && злит.nR === 1 && злит.left === 0 && злит.lost === 0,
  '«Обʼєднати в #2000331»: платіж 1 560 ₴ і одяг тепер у #2000331 (її номер відділу), під #2000330 надгробок, номер вибув, Звірка чиста', JSON.stringify(злит));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'номер бронюється в базі перед записом картки; сирота обʼєднується в живу картку');
process.exit(bad ? 1 : 0);
