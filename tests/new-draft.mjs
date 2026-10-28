/* НОВЕ B2C-ЗАМОВЛЕННЯ — ЧЕРНЕТКОЮ, ДО «СТВОРИТИ ЗАМОВЛЕННЯ» (22.10).

   Андрій: «коли тиснемо нове замовлення — воно поки не створюється, висить
   у правій зоні; привʼязав діалог, предоплату, додав одяг — і тоді
   «Створити замовлення»; стоїть галочка «Замовлення створено»; далі все
   автоматично, нічого не повторюється». Гроші не висять на замовленні,
   якого немає: платіж у чернетці лише обраний, привʼязка — у мить
   створення. Закрили чернетку — її немає, платіж вільний.

   Запуск:  node tests/new-draft.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8960;
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
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Оля',       role:'designer' }],
  /* Роздрібна ціна саме цього виробу. Саме з неї має рахуватись сума
     замовлення — а не з `totalPrice`, якого в приватних замовленнях немає. */
  products: { retail: { tee: 700 } }
};
const ORDERS = [
  /* B2B: 3 худі, із 6 000 ₴ сплачено 2 900 — залишок 3 100 */
  { id:'b1', orderId:'1000501', type:'client', name:'Ромашка Ольга', phone:'+380671112233',
    status:'production', site:'main', hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    totalPrice:6000, payments:[{ sum:2900, at:'2026-09-26T10:00:00.000Z' }],
    items:[{ kind:'main', name:'Худі базове', garmentId:'hoodie', qty:3, price:6000 }] },
  /* B2C у відділі дизайну: контроль якості ще не пройдено */
  { id:'c1', orderId:'2000777', type:'client', dir:'b2c', name:'Мороз Євгенія', phone:'+380688323228',
    status:'production', site:'main', payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Мороз Євгенія', crmNick:'moroz', totalPrice:2080, items:[] }
];
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
/* Транзакція як у справжній базі (28.10): читає через get документа, записи
   збирає й кладе їх через set кожного документа (тести бачать їх там само,
   де й звичайні записи); window.__TX — що саме пішло однією транзакцією;
   window.__TX_DENY=1 — одна відмова «permission-denied» (правила не
   опубліковано). */
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ var w=[]; var t={ get:function(ref){ return ref.get ? ref.get() : Promise.resolve({ exists:false, data:function(){ return null; } }); }," +
  " set:function(ref,d,opt){ w.push({ ref:ref, d:d, col:ref.__col||'' }); }, update:function(ref,d){ w.push({ ref:ref, d:d, col:ref.__col||'' }); }, delete:function(){} };" +
  " if(window.__TX_DENY){ window.__TX_DENY=0; return Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code:'permission-denied' })); }" +
  " return Promise.resolve(f(t)).then(function(){ (window.__TX=window.__TX||[]).push({ n:w.length, cols:w.map(function(x){ return x.col; }) });" +
  " return w.reduce(function(p,x){ return p.then(function(){ return x.ref.set(x.d); }); }, Promise.resolve()); }); },");
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Дмитренко', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-28T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана Петренко', desc:'худі ромашка' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' },\n" +
  "    { id:'p5', at:'2026-09-27T08:30:00.000Z', amount:5000, acc:'mono1', tag:'own', counter:'Переказ між рахунками' },\n" +
  "    { id:'p6', at:'2026-09-25T18:05:00.000Z', amount:1250.5, acc:'mono2', counter:'Іван Коваль', desc:'вишиванка' },\n" +
  '  ];\n' +
  '  function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype); SeedCol.prototype.__n="kanbanOrders";\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  function PayCol(){}\n' +
  '  PayCol.prototype=Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where=function(){ return this; };\n' +
  '  PayCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__PAYS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__PAYS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  PayCol.prototype.doc=function(id){ return { __col:"payments", __id:id, get:function(){ var p=window.__PAYS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve({ exists:!!p, data:function(){ return p; } }); }, set:function(v){\n' +
  '    var p=window.__PAYS.filter(function(x){ return x.id===id; })[0];\n' +
  '    if(p) Object.keys(v).forEach(function(k){ p[k]=v[k]; });\n' +
  '    return Promise.resolve(); } }; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  "      if(n==='payments') return new PayCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
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
await p.evaluate(() => {
  window.__ordW = []; window.__dzW = [];
  const oc = ORDERS_COL.doc.bind(ORDERS_COL); ORDERS_COL.doc = id => { const d = oc(id); const s0 = d.set; d.set = v => { window.__ordW.push(String((v && v.orderId) || id)); return s0 ? s0.call(d, v) : Promise.resolve(); }; return d; };
  const dc = DESIGN_COL.doc.bind(DESIGN_COL); DESIGN_COL.doc = id => { const d = dc(id); const s0 = d.set; d.set = v => { window.__dzW.push(String(id)); return s0 ? s0.call(d, v) : Promise.resolve(); }; return d; };
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.querySelector('.nav button[data-view="design"]').click();
  window.LQDesign.ui.setTab('acct'); window.LQDesign.ui.render(document.getElementById('dzRoot'));
});
await ЖДИ(300);
const стан = () => p.evaluate(() => {
  const U = window.LQDesign.ui;
  const d = orders.find(o => o.draft) || null;
  const bar = document.querySelector('#dzRoot .dz-panel .dz-write');
  const b = bar && bar.querySelector('[data-do="order-create"]');
  return { draft: d && { id: d.orderId, pays: (d.draftPays || []).slice() }, n: orders.length,
    onBoard: d ? !!document.querySelector('#dzRoot .dz-boards [data-open="' + d.orderId + '"]') : false,
    open: U.tabOpen ? U.tabOpen() : '', head: (document.querySelector('#dzRoot .dz-panel .dz-panel-l1 b') || {}).textContent || '',
    btn: b ? { dis: b.disabled, need: (bar.querySelector('.dz-create-n') || {}).textContent || '' } : null,
    done: !!(bar && bar.querySelector('.dz-create.is-done')), ig: !!(bar && bar.querySelector('.dz-ig')),
    ordW: window.__ordW.slice(), dzW: window.__dzW.slice() };
});

console.log('═══ 1. «+ НОВЕ ЗАМОВЛЕННЯ» — ЧЕРНЕТКА ПРАВОРУЧ ═══');
const було = await p.evaluate(() => orders.length);
await p.click('#dzRoot [data-do="order-new"]');
await ЖДИ(400);
const s1 = await стан();
console.log('   ' + JSON.stringify(s1));
ok(s1.draft && s1.open === s1.draft.id && /Нове замовлення/.test(s1.head) && !s1.onBoard, 'відкрилась картка «Нове замовлення» праворуч; на дошці її немає', JSON.stringify(s1));
ok(!s1.ordW.length && !s1.dzW.length, 'у базу нічого не пішло — ні замовлення, ні задачі відділу', JSON.stringify({ ordW: s1.ordW, dzW: s1.dzW }));
ok(s1.btn && s1.btn.dis && /діалог/.test(s1.btn.need) && /передоплата/.test(s1.btn.need) && /одяг/.test(s1.btn.need),
  'унизу «Створити замовлення» спить і каже: бракує діалогу, передоплати, одягу', JSON.stringify(s1.btn));

console.log('');
console.log('═══ 2. ДІАЛОГ, ПЕРЕДОПЛАТА (ЛИШЕ ОБРАНА), ОДЯГ ═══');
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new'; d.crmChatName = 'Нова клієнтка'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p1"] .pp-ck');
await p.click('[data-pp-go]');
await ЖДИ(500);
const s2 = await стан();
const p1 = await p.evaluate(() => { const x = payments.find(q => q.id === 'p1'); return { orderId: x.orderId || '', free: payFreeList().some(q => q.id === 'p1') }; });
ok(s2.draft && s2.draft.pays.join() === 'p1' && !p1.orderId && !p1.free, 'платіж 1 500 ₴ обрано, але не привʼязано (у Фінансах без замовлення), і у вільних для інших його вже немає', JSON.stringify({ s2: s2.draft, p1 }));
const рядок = await p.evaluate(() => { const f = document.querySelector('#dzRoot [data-fold="Гроші"]'); if(f) f.click(); return [...document.querySelectorAll('#dzRoot .dz-pay-r')].map(r => r.textContent).join(' | '); });
ok(/буде привʼязано/.test(рядок), 'у «Гроші» рядок «буде привʼязано при «Створити замовлення»»', рядок);
await p.evaluate(() => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft); const job = designJobs[d.orderId];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'Лого' })];
  U.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
const s3 = await стан();
ok(s3.btn && !s3.btn.dis && !s3.btn.need && s3.ig, 'усе є — «Створити замовлення» активна, ліворуч «Написати в Instagram»', JSON.stringify(s3.btn));
ok(!s3.ordW.length && !s3.dzW.length && !s3.onBoard, 'досі нічого в базі й на дошці', JSON.stringify({ ordW: s3.ordW, dzW: s3.dzW }));

console.log('');
console.log('═══ 3. «СТВОРИТИ ЗАМОВЛЕННЯ» ═══');
await p.click('#dzRoot [data-do="order-create"]');
await ЖДИ(800);
const s4 = await p.evaluate(() => {
  const U = window.LQDesign.ui; const id = U.tabOpen();
  const o = orders.find(x => x.orderId === id) || {};
  const x = payments.find(q => q.id === 'p1');
  const bar = document.querySelector('#dzRoot .dz-panel .dz-write');
  return { id, num: /^\d{7}$/.test(id), draft: !!o.draft, no: (designJobs[id] || {}).no || '', head: (document.querySelector('#dzRoot .dz-panel .dz-panel-l1 b') || {}).textContent || '',
    paidTo: x.orderId, tag: x.tag, paid: paidSum(o), copy: (o.payments || []).some(q => q.payId === 'p1'),
    onBoard: !!document.querySelector('#dzRoot .dz-boards [data-open="' + id + '"]'), done: !!(bar && bar.querySelector('.dz-create.is-done')),
    btn: !!(bar && bar.querySelector('[data-do="order-create"]')), ordW: window.__ordW.slice(), dzW: window.__dzW.slice(), drafts: orders.filter(q => q.draft).length };
});
console.log('   ' + JSON.stringify(s4));
ok(s4.num && !s4.draft && /^2\d{6}$/.test(s4.no) && s4.head.indexOf(s4.no) >= 0 && s4.onBoard, 'створено: номер відділу (' + s4.no + '), картка стала на дошку', JSON.stringify(s4));
ok(s4.ordW.indexOf(s4.id) >= 0 && s4.dzW.indexOf(s4.id) >= 0, 'замовлення й задача відділу записані в базу лише тепер', JSON.stringify({ ordW: s4.ordW, dzW: s4.dzW }));
ok(s4.paidTo === s4.id && s4.tag === 'prepay' && s4.paid === 1500 && s4.copy, 'платіж привʼязано тепер — до нового замовлення, як передоплату (ядро грошей: копія в картці)', JSON.stringify(s4));
ok(s4.done && !s4.btn && !s4.drafts, 'унизу «✓ Замовлення створено», кнопки «Створити» більше немає', JSON.stringify(s4));
const tx = await p.evaluate(() => (window.__TX || []).slice());
ok(tx.length === 1 && tx[0].n === 4 && tx[0].cols.slice().sort().join() === 'designJobs,kanbanOrders,orderNos,payments',
  'усе чотири — ОДНІЄЮ транзакцією: бронь номера, картка, картка відділу, платіж (неподільно, 28.10)', JSON.stringify(tx));
/* Далі — автоматично: закрили й відкрили — нічого не повторюється. */
const s5 = await p.evaluate(async (id) => { const U = window.LQDesign.ui;
  U.open(''); U.render(document.getElementById('dzRoot')); await new Promise(r => setTimeout(r, 100));
  U.open(id); U.render(document.getElementById('dzRoot'));
  const bar = document.querySelector('#dzRoot .dz-panel .dz-write');
  return { done: !!(bar && bar.querySelector('.dz-create.is-done')), btn: !!(bar && bar.querySelector('[data-do="order-create"]')), n: orders.filter(o => o.orderId === id).length };
}, s4.id);
ok(!s5.done && !s5.btn && s5.n === 1, 'відкрили знову — звичайне замовлення, ні кнопки, ні повторів', JSON.stringify(s5));

console.log('');
console.log('═══ 3б. КАРТКА ЗАМОВЛЕННЯ НЕ ЗАПИСАЛАСЬ — НІ КАРТКИ ВІДДІЛУ, НІ ПЛАТЕЖУ; ЧЕРНЕТКА ЛИШАЄТЬСЯ (27.10) ═══');
/* Звірка показала девʼять «не дописалась» поспіль: запис картки впав, а
   код ішов далі — писав картку відділу й привʼязував платіж. */
await p.evaluate(() => { window.__ordW = []; window.__dzW = []; window.__TOASTS = []; const t0 = toast; toast = m => { window.__TOASTS.push(String(m)); try{ t0(m); }catch(e){} };
  document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new3'; d.crmChatName = 'Третя'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p6"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
await p.evaluate(() => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft); const job = designJobs[d.orderId];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'Лого' })];
  /* База не читається (телефон без звʼязку) — запис картки відкладається. */
  const P = Object.getPrototypeOf(ORDERS_COL.doc('x')); window.__get0 = P.get;
  P.get = function(){ if(this.__col === 'kanbanOrders' || !this.__col) return Promise.reject(new Error('Failed to get document because the client is offline.')); return window.__get0.apply(this, arguments); };
  U.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
/* З чернетки клієнту не шлемо (28.10): «Надіслати клієнту» — лише після «Створити замовлення». */
const тел = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui; const o = orders.find(x => x.draft); const job = designJobs[o.orderId]; const u = job.units[0];
  const d = D.dzNew(); d.who = 'p@loomiq'; u.graphic = [d];
  D.dzVer(d, 'p@loomiq', [{ name:'мокап.png', url:'https://f/mock1.png', role:'mock' }], '', null, 'graphic');
  window.__TOASTS = [];
  try{ await U.act('dz-tell', document.getElementById('dzRoot'), { dz: u.id + '|graphic|0', v: 1 }); }catch(e){ window.__TOASTS.push('err:' + e.message); }
  const sent = (d.vers || []).some(v => v.sentToClient);
  u.graphic = [];
  return { says: window.__TOASTS.slice(), sent };
});
ok(тел.says.some(m => /Спершу.*Створити замовлення/.test(m)) && !тел.sent, 'з чернетки «Надіслати клієнту» не йде: «Спершу натисніть «Створити замовлення»»', JSON.stringify(тел));
await p.click('#dzRoot [data-do="order-create"]');
await ЖДИ(800);
const s3b = await p.evaluate(() => { const d = orders.find(o => o.draft) || null; const x = payments.find(q => q.id === 'p6');
  const P = Object.getPrototypeOf(ORDERS_COL.doc('x')); P.get = window.__get0; clearTimeout(saveDeferT);
  return { draft: !!d, drafts: orders.filter(o => o.draft).length, pays: d ? (d.draftPays || []).slice() : [], p6: x.orderId || '', ordW: window.__ordW.slice(), dzW: window.__dzW.slice(),
    toasts: window.__TOASTS.filter(m => /не створилось/.test(m)), jobs: Object.keys(designJobs).filter(k => designJobs[k] && designJobs[k].draft).length }; });
console.log('   ' + JSON.stringify(s3b));
ok(s3b.draft && s3b.drafts === 1 && s3b.pays.join() === 'p6' && !s3b.p6, 'чернетка лишилась з обраним платежем, платіж не привʼязано', JSON.stringify(s3b));
ok(!s3b.ordW.length && !s3b.dzW.length, 'у базу не пішло нічого — ні картка відділу, ні замовлення', JSON.stringify({ ordW: s3b.ordW, dzW: s3b.dzW }));
ok(s3b.toasts.length === 1 && /не записалась у базу/.test(s3b.toasts[0]), 'людині сказано: «Замовлення не створилось: картка не записалась…»', JSON.stringify(s3b.toasts));
const s3err = await p.evaluate(() => { const bar = document.querySelector('#dzRoot .dz-panel .dz-write'); const e = bar && bar.querySelector('.dz-create-err'); const b = bar && bar.querySelector('[data-do="order-create"]');
  return { err: e ? e.textContent : '', red: !!(b && b.classList.contains('is-err')), label: b ? b.textContent : '' }; });
ok(/НЕ СТВОРЕНО: .*не записалась у базу/.test(s3err.err) && s3err.red && /ще раз/.test(s3err.label), 'у картці червоним «НЕ СТВОРЕНО: …», кнопка червона «Створити ще раз» (28.10)', JSON.stringify(s3err));
await p.click('#dzRoot .dz-panel [data-close]'); await ЖДИ(300);

console.log('');
console.log('═══ 3в. БАЗА ЩЕ НЕ ПУСКАЄ ТРАНЗАКЦІЮ (правила не опубліковано) — СТАРИЙ ШЛЯХ, ВЛАСНИКУ СКАЗАНО (28.10) ═══');
await p.evaluate(() => { window.__ordW = []; window.__dzW = []; window.__TX = []; window.__TOASTS = []; window.__TX_DENY = 1; atomicOff = false;
  draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new3v'; d.crmChatName = 'Третя-в'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p6"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
await p.evaluate(() => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft); const job = designJobs[d.orderId];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'Лого' })]; U.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
await p.click('#dzRoot [data-do="order-create"]'); await ЖДИ(800);
const s3v = await p.evaluate(() => { const U = window.LQDesign.ui; const id = U.tabOpen(); const o = orders.find(x => x.orderId === id) || {}; const x = payments.find(q => q.id === 'p6');
  return { id, num: /^\d{7}$/.test(id), draft: !!o.draft, p6: x.orderId || '', ordW: window.__ordW.slice(), dzW: window.__dzW.slice(),
    txCard: (window.__TX || []).some(t => t.cols.indexOf('kanbanOrders') >= 0), off: atomicOff, toasts: window.__TOASTS.filter(m => /firestore\.rules/.test(m)) }; });
console.log('   ' + JSON.stringify(s3v));
ok(s3v.num && !s3v.draft && s3v.ordW.indexOf(s3v.id) >= 0 && s3v.dzW.indexOf(s3v.id) >= 0 && s3v.p6 === s3v.id && !s3v.txCard,
  'замовлення створено старим шляхом (картка, картка відділу, платіж — окремими записами), нічого не зламалось', JSON.stringify(s3v));
ok(s3v.off && s3v.toasts.length === 1, 'власнику сказано «опублікуйте firestore.rules», неподільний шлях на цій вкладці вимкнено до перезавантаження', JSON.stringify(s3v.toasts));
await p.evaluate(() => { atomicOff = false; });
await p.click('#dzRoot .dz-panel [data-close]'); await ЖДИ(300);

console.log('');
console.log('═══ 4. ЗАКРИЛИ ЧЕРНЕТКУ — ЇЇ НЕМАЄ, ПЛАТІЖ ВІЛЬНИЙ ═══');
await p.evaluate(() => { window.__ordW = []; window.__dzW = []; draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new2'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p2"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
await p.click('#dzRoot .dz-panel [data-close]'); await ЖДИ(300);
const s6 = await p.evaluate(() => { const x = payments.find(q => q.id === 'p2');
  return { drafts: orders.filter(o => o.draft).length, p2: x.orderId || '', free: payFreeList().some(q => q.id === 'p2'), ordW: window.__ordW.slice(), dzW: window.__dzW.slice() }; });
ok(!s6.drafts && !s6.p2 && s6.free && !s6.ordW.length && !s6.dzW.length, 'закрили — чернетки немає, у базі нічого, платіж 2 400 ₴ знову вільний', JSON.stringify(s6));

console.log('');
console.log('═══ 5. ПІШОВ В ІНШИЙ РОЗДІЛ — ЧЕРНЕТКИ НЕМАЄ; ОБРАНИЙ У ЧЕРНЕТЦІ ПЛАТІЖ НЕ ЗНИКАЄ МОВЧКИ (22.10) ═══');
await p.evaluate(() => { draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new3'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p2"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
/* Поки чернетка жива, у вікні привʼязки ІНШОЇ картки платіж видно з позначкою. */
const зПозначкою = await p.evaluate(async () => {
  const всі = payFreeList({ all: true }); const x = всі.find(q => q.id === 'p2');
  return { є: !!x, why: x ? x.__why : '', вільний: payFreeList().some(q => q.id === 'p2') };
});
ok(зПозначкою.є && /чернетці/.test(зПозначкою.why) && !зПозначкою.вільний, 'платіж 2 400 ₴ у чернетці: у вікні з позначкою «обраний у чернетці», а не зник', JSON.stringify(зПозначкою));
await p.evaluate(() => { document.querySelector('.nav button[data-view="chatsc"]').click(); });
await ЖДИ(300);
const s7 = await p.evaluate(() => ({ drafts: orders.filter(o => o.draft).length, free: payFreeList().some(q => q.id === 'p2') }));
ok(!s7.drafts && s7.free, 'перейшов у «Чати B2C» — чернетки немає, платіж 2 400 ₴ знову вільний без позначки', JSON.stringify(s7));

console.log('');
console.log('═══ 6. ЧЕРНЕТКА ЖИВЕ НА ПРИСТРОЇ: ПЕРЕЗАВАНТАЖИЛИ — «↩ ПРОДОВЖИТИ ЧЕРНЕТКУ» (28.10) ═══');
/* Менеджер заповнює чернетку довго, а «Створити» тисне в кінці; збій
   вкладки доти стирав усе, і картку заводили заново (двійники). */
await p.evaluate(() => { document.querySelector('.nav button[data-view="design"]').click(); window.LQDesign.ui.setTab('acct'); window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await ЖДИ(300);
/* Заповнену чернетку з §5 закрили переходом у Чати — вона лишилась на пристрої (28.10). */
const з5 = await p.evaluate(() => ({ resume: !!document.querySelector('#dzRoot [data-do="order-resume"]'), ls: !!localStorage.getItem('lq_draft:test@loomiq') }));
ok(з5.resume && з5.ls, 'заповнену чернетку закрили не «Створити» — вона на пристрої, на дошці «↩ Продовжити чернетку»', JSON.stringify(з5));
await p.evaluate(() => { draftForget(); window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
const без = await p.evaluate(() => ({ resume: !!document.querySelector('#dzRoot [data-do="order-resume"]'), ls: localStorage.getItem('lq_draft:test@loomiq') }));
ok(!без.resume && !без.ls, 'без чернетки — ні кнопки «Продовжити», ні запису на пристрої', JSON.stringify(без));
await p.evaluate(() => { draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c-new6'; d.crmChatName = 'Шоста'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p2"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
await p.evaluate(async () => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft); const job = designJobs[d.orderId];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'L', qty:2, note:'Квітка' })];
  await designSave(job, d); });
await ЖДИ(200);
const збер = await p.evaluate(() => { let d = null; try{ d = JSON.parse(localStorage.getItem('lq_draft:test@loomiq')); }catch(e){}
  return d && { chat: d.o.crmChatId, pays: d.o.draftPays, units: (d.job.units || []).length, draft: !!d.o.draft }; });
ok(збер && збер.chat === 'c-new6' && (збер.pays || []).join() === 'p2' && збер.units === 1 && збер.draft, 'чернетка на пристрої: діалог, обраний платіж 2 400 ₴, одяг', JSON.stringify(збер));
/* Вкладку перезавантажило (телефон, збій). */
await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.querySelector('.nav button[data-view="design"]').click(); window.LQDesign.ui.setTab('acct'); window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await ЖДИ(300);
const після = await p.evaluate(() => { const b = document.querySelector('#dzRoot [data-do="order-resume"]');
  return { btn: !!b, text: b ? b.textContent : '', drafts: orders.filter(o => o.draft).length, free: payFreeList().some(q => q.id === 'p2') }; });
ok(після.btn && /Продовжити чернетку · Шоста/.test(після.text) && !після.drafts && після.free, 'після перезавантаження на дошці «↩ Продовжити чернетку · Шоста»; у памʼяті чернетки ще немає, платіж вільний', JSON.stringify(після));
await p.click('#dzRoot [data-do="order-resume"]'); await ЖДИ(400);
const далі = await p.evaluate(() => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft) || null; const job = d && designJobs[d.orderId];
  const bar = document.querySelector('#dzRoot .dz-panel .dz-write'); const b = bar && bar.querySelector('[data-do="order-create"]');
  return { draft: !!d, open: !!d && U.tabOpen() === d.orderId, chat: d && d.crmChatId, pays: d && d.draftPays, units: job ? U.unitsOf(job).length : 0, btn: b ? !b.disabled : false,
    resume: !!document.querySelector('#dzRoot [data-do="order-resume"]'), onBoard: d ? !!document.querySelector('#dzRoot .dz-boards [data-open="' + d.orderId + '"]') : false }; });
ok(далі.draft && далі.open && далі.chat === 'c-new6' && (далі.pays || []).join() === 'p2' && далі.units === 1 && далі.btn, 'чернетка відкрита як була: діалог, платіж 2 400 ₴, одяг — «Створити замовлення» активна', JSON.stringify(далі));
ok(!далі.resume && !далі.onBoard, 'кнопки «Продовжити» більше немає, на дошці чернетки немає', JSON.stringify(далі));
await p.click('#dzRoot .dz-panel [data-close]'); await ЖДИ(300);
const закр = await p.evaluate(() => ({ ls: !!localStorage.getItem('lq_draft:test@loomiq'), resume: !!document.querySelector('#dzRoot [data-do="order-resume"]'), drafts: orders.filter(o => o.draft).length }));
ok(закр.ls && закр.resume && !закр.drafts, 'закрили заповнену чернетку — з памʼяті зникла, на пристрої лишилась, «Продовжити» є', JSON.stringify(закр));
/* Порожню (без діалогу, платежу й одягу) — забуваємо. */
await p.evaluate(() => { draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.click('#dzRoot .dz-panel [data-close]'); await ЖДИ(300);
const пор = await p.evaluate(() => ({ ls: !!localStorage.getItem('lq_draft:test@loomiq'), resume: !!document.querySelector('#dzRoot [data-do="order-resume"]') }));
ok(!пор.ls && !пор.resume, 'порожню чернетку закрили — на пристрої її немає', JSON.stringify(пор));

console.log('');
console.log('═══ 7. У РОЗМОВИ ВЖЕ Є ЖИВЕ ЗАМОВЛЕННЯ — ПИТАЄМО, НЕ БЛОКУЄМО (28.10) ═══');
await p.evaluate(() => { window.__TX = []; window.__CONFIRMS = []; window.__YES = 0; window.confirm = m => { window.__CONFIRMS.push(String(m)); return window.__YES === 1; };
  draftForget(); document.querySelector('#dzRoot [data-do="order-new"]').click(); });
await ЖДИ(300);
await p.evaluate(() => { const d = orders.find(o => o.draft); d.crmChatId = 'c1'; d.crmChatName = 'Мороз Євгенія'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.evaluate(() => { document.querySelector('#dzRoot .dz-gate [data-do="pay-pick"]').click(); });
await ЖДИ(300);
await p.click('.pp-row[data-pp="p2"] .pp-ck'); await p.click('[data-pp-go]'); await ЖДИ(400);
await p.evaluate(async () => { const U = window.LQDesign.ui; const d = orders.find(o => o.draft); const job = designJobs[d.orderId];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'S', qty:1, note:'' })]; await designSave(job, d); U.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
await p.click('#dzRoot [data-do="order-create"]'); await ЖДИ(600);
const ні = await p.evaluate(() => ({ asked: window.__CONFIRMS.slice(), drafts: orders.filter(o => o.draft).length, tx: (window.__TX || []).length, p2: (payments.find(q => q.id === 'p2') || {}).orderId || '' }));
ok(ні.asked.length === 1 && /#\d{7}/.test(ні.asked[0]) && /Мороз Євгенія/.test(ні.asked[0]) && ні.drafts === 1 && !ні.tx && !ні.p2,
  'спитано «У цієї розмови (Мороз Євгенія) уже є замовлення #…»; «Ні» — нічого не створено, чернетка лишилась', JSON.stringify(ні));
await p.evaluate(() => { window.__YES = 1; });
await p.click('#dzRoot [data-do="order-create"]'); await ЖДИ(800);
const так = await p.evaluate(() => ({ asked: window.__CONFIRMS.length, drafts: orders.filter(o => o.draft).length, tx: (window.__TX || []).length, p2: (payments.find(q => q.id === 'p2') || {}).orderId || '', ls: localStorage.getItem('lq_draft:test@loomiq') }));
ok(так.asked === 2 && !так.drafts && так.tx === 1 && /^\d{7}$/.test(так.p2) && !так.ls, '«Так» — створено однією транзакцією, чернетки на пристрої більше немає', JSON.stringify(так));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'нове B2C — чернеткою на пристрої, створюється кнопкою неподільно, гроші — лише в мить створення');
process.exit(bad ? 1 : 0);
