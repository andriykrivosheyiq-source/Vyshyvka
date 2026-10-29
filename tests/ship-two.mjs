/* ДВІ ПОСИЛКИ З ОДНОГО ЗАМОВЛЕННЯ (29.10).
   Андрій: «одне замовлення — дві посилки в два різних місця: кнопка
   «Додатковий отримувач», привʼязуємо, який товар якому; кожен платить за
   свій товар, передоплата ділиться пропорційно; ТТН на кожного; на картці
   дві зебри». Перевіряємо: кнопка й форма другого отримувача, поділ позицій,
   контроль оплати кожної посилки (разом = залишок), дві накладні з НП
   (опис «посилка 2»), два блоки й дві «Зебри» в картці, колонка цеху за
   відстаючою посилкою, гроші за обома накладними — цього замовлення,
   видалення другої накладної, стара копія не знімає її.
   Запуск:  node tests/ship-two.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9061;
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
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' }],
  products: { retail: { tee: 700, hoodie: 1300 } }
};
const ORDERS = [
  /* B2C: футболка 700 + худі 1300 = 2 000 ₴, передоплата 500 → залишок 1 500 */
  { id:'c1', orderId:'2000777', type:'client', dir:'b2c', name:'Мороз Євгенія', phone:'+380688323228',
    status:'production', site:'main', payments:[], hist:[], createdAt:'2026-10-25T09:00:00.000Z',
    totalPrice:2000, items:[], tracks:{ qc:'ok' } }
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
  'window.__PAYS=[\n' +
  "    { id:'p1', at:'2026-10-26T10:12:00.000Z', amount:500, acc:'mono1', orderId:'2000777', tag:'prepay', counter:'Мороз Є.' }\n" +
  '  ];\n' +
  '  function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
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
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  "      if(n==='payments') return new PayCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

/* Підставний воркер Нової пошти: міста, відділення, накладні з лічильником. */
const npAsked = [];
let ttnN = 0;
await p.route(HOST + '/np', async r => {
  const b = JSON.parse(r.request().postData() || '{}');
  npAsked.push(b);
  const J = x => r.fulfill({ contentType:'application/json', body: JSON.stringify(x) });
  if(b.op === 'cities') return J({ ok:true, list: /він/i.test(b.q) ? [{ ref:'CITY-VIN', name:'Вінниця' }] : [{ ref:'CITY-K', name:'Київ' }] });
  if(b.op === 'warehouses') return J({ ok:true, list: [{ ref:'WH-1', name:'Відділення №1: вул. Соборна, 1', number:'1' }] });
  if(b.op === 'create'){ ttnN++; return J({ ok:true, ttn:'2045000000000' + ttnN, ref:'DOC' + ttnN, est:'07.11.2026' }); }
  if(b.op === 'ttnDelete') return J({ ok:true });
  if(b.op === 'track') return J({ ok:true, status:'Відправлення у відділенні' });
  return J({ ok:false, error:'?' });
});
const type = async (sel, txt) => { await p.fill(sel, ''); await p.type(sel, txt, { delay: 20 }); await p.waitForTimeout(700); };
const pick = async (listSel, i) => { await p.locator(listSel + ':not([hidden]) .ship-o').nth(i || 0).click(); await p.waitForTimeout(400); };
await p.evaluate(h => { contentData.bgApi = Object.assign({}, contentData.bgApi || {}, { npUrl: h + '/np' }); }, HOST);

const open = async () => {
  await p.evaluate(() => {
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
    document.getElementById('view-design').style.display = 'block';
    if(!designJobs['2000777']){ const job = designJobMake('2000777'); const U = window.LQDesign.ui;
      const at = new Date().toISOString();
      job.units = [ Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, price:700, priceAt:at, priceGid:'tee', priceKind:'' }),
                    Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Сірий', size:'L', qty:1, price:1300, priceAt:at, priceGid:'hoodie', priceKind:'' }) ]; }
    openDesign();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const c = document.querySelector('[data-open="2000777"]'); if(c) c.click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const b = document.querySelector('[data-fold="Відправка"]'); if(b && !document.querySelector('.dz-panel [data-shipform], .dz-panel [data-ship-ttn-del]')) b.click(); });
  await p.waitForTimeout(400);
};
const ord = () => p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0]; const s2 = o.ship2 || {};
  return { ttn: o.ttn || '', cod: +o.ttnCod || 0, two: !!(o.ship2 && o.ship2.on), units: (s2.units || []).slice(), ttn2: s2.ttn || '', cod2: +s2.ttnCod || 0,
           hist2: (s2.ttnHist || []).map(h => h.ttn), split: shipSplit(o), known: window.LQDesign.shipKnown(o) }; });

console.log('═══ 1. «+ ДОДАТКОВИЙ ОТРИМУВАЧ» → ФОРМА ДРУГОГО, ПОДІЛ ПОЗИЦІЙ, КОНТРОЛЬ ОПЛАТИ ═══');
await open();
const f0 = await p.evaluate(() => ({ two: !!document.querySelector('.dz-panel [data-shf-two]'), form2: !!document.querySelector('.dz-panel [data-shipform="2"]'),
  cod: (document.querySelector('.dz-panel [data-shf-cod]') || {}).value || '' }));
ok(f0.two && !f0.form2 && /1[\s ]?500/.test(f0.cod), 'у формі відправки є «+ Додатковий отримувач»; другої форми ще немає; контроль = залишок 1 500 ₴', JSON.stringify(f0));
await p.click('.dz-panel [data-shf-two]');
await p.waitForTimeout(700);
const f1 = await p.evaluate(() => ({ form2: !!document.querySelector('.dz-panel [data-shipform="2"]'), boxes: document.querySelectorAll('.dz-panel [data-shf2-u]').length,
  miss: (document.querySelector('.dz-panel [data-shipform]:not([data-shipform="2"]) .shf-miss') || {}).textContent || '' }));
const o1 = await ord();
ok(o1.two && f1.form2 && f1.boxes === 2 && /позиції другого/.test(f1.miss), 'другий отримувач увімкнено: форма 2 з двома позиціями на вибір; перша накладна чекає поділу', JSON.stringify({ f1, o1 }));
/* Худі (1 300 з 2 000) — другому: частка 0,65 → контроль 2 = 975, контроль 1 = 525, разом 1 500. */
await p.evaluate(() => { const cb = document.querySelectorAll('.dz-panel [data-shf2-u]')[1]; cb.checked = true; cb.dispatchEvent(new Event('change')); });
await p.waitForTimeout(800);
const o2 = await ord();
const f2 = await p.evaluate(() => ({ cod1: (document.querySelector('.dz-panel [data-shf-cod]') || {}).value || '', cod2: (document.querySelector('.dz-panel [data-shf2-cod]') || {}).value || '',
  note: (document.querySelector('.dz-panel [data-shipform]:not([data-shipform="2"]) .shf-note') || {}).textContent || '' }));
console.log('  ' + JSON.stringify({ split: o2.split, f2 }));
ok(o2.units.length === 1 && o2.split.live && o2.split.cod2 === 975 && o2.split.cod1 === 525 && o2.split.qty1 === 1 && o2.split.qty2 === 1,
  'худі — другому: кожен платить за свій товар, передоплата пропорційно: контроль 1 = 525 ₴, 2 = 975 ₴ (разом рівно залишок 1 500)', JSON.stringify(o2.split));
ok(/525/.test(f2.cod1) && /975/.test(f2.cod2) && /посилка 2: 1 шт/.test(f2.note), 'обидві форми показують свої суми контролю', JSON.stringify(f2));

console.log('═══ 2. ДВІ НАКЛАДНІ: СПЕРШУ ДРУГА, ПОТІМ ПЕРША ═══');
await type('.dz-panel [data-shf2="name"]', 'Коваль Анна'); await p.dispatchEvent('.dz-panel [data-shf2="name"]', 'change'); await p.waitForTimeout(500);
await type('.dz-panel [data-shf2="phone"]', '+380501112233'); await p.dispatchEvent('.dz-panel [data-shf2="phone"]', 'change'); await p.waitForTimeout(500);
await type('.dz-panel [data-shf2-city]', 'Він'); await pick('.dz-panel [data-shf2-list]', 0);
await type('.dz-panel [data-shf2-wh]', '1'); await pick('.dz-panel [data-shf2-list]', 0);
await p.waitForTimeout(500);
const m2 = await p.evaluate(() => ({ disabled: !!(document.querySelector('.dz-panel [data-shf2-make]') || {}).disabled, miss: (document.querySelector('.dz-panel [data-shipform="2"] .shf-miss') || {}).textContent || '' }));
ok(!m2.disabled && !m2.miss, 'форму другого заповнено — «Створити ТТН · посилка 2» активна', JSON.stringify(m2));
await p.click('.dz-panel [data-shf2-make]');
await p.waitForTimeout(1200);
const o3 = await ord();
const c2 = npAsked.filter(b => b.op === 'create').pop() || {};
console.log('  ' + JSON.stringify({ ttn2: o3.ttn2, cod2: o3.cod2, order: c2.order && { name: c2.order.name, cod: c2.order.cod, qty: c2.order.qty, description: c2.order.description, cityRef: c2.order.cityRef } }));
ok(o3.ttn2 === '20450000000001' && o3.cod2 === 975 && c2.order && c2.order.cod === 975 && c2.order.qty === 1 && c2.order.name === 'Коваль Анна' && c2.order.cityRef === 'CITY-VIN' && /^#\d+ · посилка 2$/.test(c2.order.description),
  'накладна другої посилки: контроль 975 ₴, 1 шт, отримувач 2, опис «#… · посилка 2»', JSON.stringify(o3));
ok(!o3.known, 'перша накладна ще не створена — відправка «не відома» (ТТН не створена)', JSON.stringify(o3));
await open();
await type('.dz-panel [data-shf="name"]', 'Мороз Євгенія'); await p.dispatchEvent('.dz-panel [data-shf="name"]', 'change'); await p.waitForTimeout(500);
await type('.dz-panel [data-shf="phone"]', '+380688323228'); await p.dispatchEvent('.dz-panel [data-shf="phone"]', 'change'); await p.waitForTimeout(500);
await type('.dz-panel [data-shf-city]', 'Киї'); await pick('.dz-panel [data-shf-list]', 0);
await type('.dz-panel [data-shf-wh]', '1'); await pick('.dz-panel [data-shf-list]', 0);
await p.waitForTimeout(500);
await p.click('.dz-panel [data-shf-make]');
await p.waitForTimeout(1200);
const o4 = await ord();
const c1 = npAsked.filter(b => b.op === 'create').pop() || {};
console.log('  ' + JSON.stringify({ ttn: o4.ttn, cod: o4.cod, order: c1.order && { cod: c1.order.cod, qty: c1.order.qty, description: c1.order.description } }));
ok(o4.ttn === '20450000000002' && o4.cod === 525 && c1.order && c1.order.cod === 525 && c1.order.qty === 1 && /^#\d+$/.test(c1.order.description) && o4.known,
  'накладна першої посилки: контроль 525 ₴, 1 шт; тепер відправка відома', JSON.stringify(o4));

console.log('═══ 3. КАРТКА: ДВА БЛОКИ, ДВІ «ЗЕБРИ»; ГРОШІ ЗА ОБОМА — ЦЬОГО ЗАМОВЛЕННЯ ═══');
await open();
const k = await p.evaluate(() => ({ blocks: document.querySelectorAll('.dz-panel .dz-ship-ttn').length, zebras: [...document.querySelectorAll('.dz-panel [data-ship-zebra]')].map(b => b.dataset.ttn),
  head: (document.querySelector('.dz-panel .dz-ship-two') || {}).textContent || '', del2: !!document.querySelector('.dz-panel [data-ship-ttn-del="2"]'),
  ttns: LQMoney.ttnsOf(orders.find(x => x.orderId === '2000777')),
  audit: LQMoney.audit(orders.filter(x => x.orderId === '2000777'), payments, { np: {}, totalOf: orderTotalOf }).filter(x => /^cod_/.test(x.kind)).map(x => x.kind) }));
console.log('  ' + JSON.stringify(k));
ok(k.blocks === 2 && k.zebras.join() === '20450000000002,20450000000001' && /Дві посилки/.test(k.head) && k.del2, 'у картці два блоки накладних, дві «Зебри», шапка «Дві посилки»', JSON.stringify(k));
ok(k.ttns.join() === '20450000000002,20450000000001' && !k.audit.length, 'грошове ядро знає обидві накладні; Звірка: 525 + 975 = залишок — без тривоги', JSON.stringify({ ttns: k.ttns, audit: k.audit }));

console.log('═══ 4. КОЛОНКА ЦЕХУ — ЗА ВІДСТАЮЧОЮ ПОСИЛКОЮ ═══');
const st = await p.evaluate(() => {
  const D = window.LQDesign, o = JSON.parse(JSON.stringify(orders.find(x => x.orderId === '2000777')));
  const r = [];
  o.npSt = { code:'9', status:'Отримано' }; delete o.ship2.npSt; r.push(D.npStage(o));
  o.ship2.npSt = { code:'4', status:'У дорозі' }; r.push(D.npStage(o));
  o.ship2.npSt = { code:'7', status:'Прибуло', arrivedAt: new Date().toISOString() }; r.push(D.npStage(o));
  o.ship2.npSt = { code:'9', status:'Отримано' }; r.push(D.npStage(o));
  o.ship2.npSt = { code:'102', status:'Відмова' }; r.push(D.npStage(o));
  return r;
});
console.log('  ' + st.join(' → '));
ok(st.join() === ',way,arrived,done,refused', 'друга ще без статусу — картка не поїхала; далі: у дорозі → у відділенні → доставлено лише коли обидві; відмова на будь-якій', st.join());

console.log('═══ 5. ВИДАЛИТИ НАКЛАДНУ ДРУГОЇ ПОСИЛКИ; СТАРА КОПІЯ ЇЇ НЕ ЗНІМАЄ ═══');
const keep = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000777');
  const db = JSON.parse(JSON.stringify(o)), live = JSON.parse(JSON.stringify(o));
  delete live.ship2.ttn; delete live.ship2.ttnCod;
  const rb = stateRollback(db, live);
  const kept = stateKeep(db, live);
  return { rb, ttn2: (kept.ship2 || {}).ttn || '' };
});
ok(keep.rb.includes('ТТН другої посилки') && keep.ttn2 === '20450000000001', 'запис без накладної другої посилки (і без історії) — відкат; поле береться з бази', JSON.stringify(keep));
await p.click('.dz-panel [data-ship-ttn-del="2"]');
await p.waitForTimeout(1000);
const o5 = await ord();
const del = npAsked.filter(b => b.op === 'ttnDelete').pop() || {};
ok(o5.ttn2 === '' && o5.hist2.join() === '20450000000001' && del.ref === 'DOC1' && o5.ttn === '20450000000002', 'накладну 2 скасовано в НП (ref) і забрано в історію другої посилки; перша на місці', JSON.stringify({ o5, del }));
await open();
const f5 = await p.evaluate(() => ({ form2: !!document.querySelector('.dz-panel [data-shipform="2"]'), locked: !!(document.querySelector('.dz-panel [data-shf2-u]') || {}).disabled }));
ok(f5.form2 && f5.locked, 'форма другого отримувача знову відкрита; поділ позицій замкнений першою накладною', JSON.stringify(f5));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close();
srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ дві посилки');
