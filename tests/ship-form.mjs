/* Відправка з картки B2B і B2C: налаштування відправників, вага, формат,
   контроль оплати, «Створити ТТН» (04.10).

   Андрій: «з карточки B2B, B2C створювати ТТН; поля підтягуються; відправників
   і місце відправки — в адмінці; вага й габарити — на відправника; вага
   кожного товару, щоб у ТТН ішла вага того, що в замовленні».

   Запуск:  node tests/ship-form.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8937;
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
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Д.', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-27T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана П.' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' }\n" +
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
  '  PayCol.prototype.doc=function(id){ return { set:function(v){\n' +
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


/* Підставний воркер Нової пошти: міста, відділення, накладна. */
const npAsked = [];
await p.route(HOST + '/np', async r => {
  const b = JSON.parse(r.request().postData() || '{}');
  npAsked.push(b);
  const J = x => r.fulfill({ contentType:'application/json', body: JSON.stringify(x) });
  if(b.op === 'cities') return J({ ok:true, list: /він/i.test(b.q) ? [{ ref:'CITY-VIN', name:'Вінниця' }] : [{ ref:'CITY-K', name:'Київ' }] });
  if(b.op === 'warehouses') return J({ ok:true, list: [{ ref:'WH-1', name:'Відділення №1: вул. Соборна, 1', number:'1' },
                                                      { ref:'PM-5', name:'Поштомат №5012', number:'5012', postomat:true }] });
  if(b.op === 'create') return J({ ok:true, ttn:'20450000009999', ref:'DOC', est:'07.10.2026' });
  return J({ ok:false, error:'?' });
});
const type = async (sel, txt) => { await p.fill(sel, ''); await p.type(sel, txt, { delay: 20 }); await p.waitForTimeout(700); };
const pick = async (i) => { await p.locator('.ship-pick:not([hidden]) .ship-o').nth(i || 0).click(); await p.waitForTimeout(400); };

console.log('═══ НАЛАШТУВАННЯ → ВІДПРАВКА ═══');
await p.evaluate(h => { contentData.bgApi = Object.assign({}, contentData.bgApi || {}, { npUrl: h + '/np' }); shipDraft = null; renderShipSettings(); }, HOST);
/* Розділ живе поруч з адресою воркера НП (Конструктор сайту) — показуємо
   його разом з усіма обгортками. */
await p.evaluate(() => { document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  let e = document.getElementById('ship-set');
  while(e && e !== document.body){ if(getComputedStyle(e).display === 'none') e.style.display = 'block'; e.hidden = false; e = e.parentElement; }
  document.getElementById('ship-set').scrollIntoView(); });
await p.click('#ship-sender-add');
await p.fill('.shs-s [data-ss="name"]', 'ФОП Юкальчук'); await p.dispatchEvent('.shs-s [data-ss="name"]', 'change');
await p.fill('.shs-s [data-ss="id"]', 'yukalchuk'); await p.dispatchEvent('.shs-s [data-ss="id"]', 'change');
await p.waitForTimeout(200);
await type('.shs-s [data-ss-city]', 'Він'); await pick(0);
await type('.shs-s [data-ss-wh]', '1'); await pick(0);
await p.fill('[data-sw="hoodie"]', '600'); await p.dispatchEvent('[data-sw="hoodie"]', 'change');
await p.fill('[data-spack]', '100'); await p.dispatchEvent('[data-spack]', 'change');
const formats = await p.evaluate(() => shipDraft.senders[0].formats.map(f => f.name));
await p.click('#ship-set-save');
await p.waitForTimeout(400);
const cfg = await p.evaluate(() => contentData.ship);
console.log('   ' + JSON.stringify({ s: cfg && cfg.senders[0] && { id: cfg.senders[0].id, city: cfg.senders[0].cityName, wh: cfg.senders[0].whName, def: cfg.senders[0].def }, w: cfg && cfg.weights, pack: cfg && cfg.packG }));
ok(cfg && cfg.senders.length === 1 && cfg.senders[0].id === 'yukalchuk' && cfg.senders[0].cityRef === 'CITY-VIN' &&
   cfg.senders[0].whRef === 'WH-1' && cfg.senders[0].def,
  'відправник заведений: назва, код, місто й відділення відправки з довідника НП', 'відправник: ' + JSON.stringify(cfg));
ok(formats.join() === 'Пакет S,Пакет M,Коробка L', 'новий відправник одразу з трьома форматами посилок (можна правити)', 'формати: ' + formats);
ok(cfg && cfg.weights.hoodie === 600 && cfg.packG === 100, 'вага товару (худі 600 г) і пакування (100 г) збережені', 'вага: ' + JSON.stringify(cfg && cfg.weights));
const keyHint = await p.evaluate(() => (document.querySelector('.shs-key') || {}).textContent || '');
const keyField = await p.evaluate(() => !!document.querySelector('#ship-set input[placeholder*="ключ" i], #ship-set input[data-ss="key"]'));
ok(/NP_KEY_yukalchuk/.test(keyHint) && !keyField,
  'ключ API — лише підказкою про секрет воркера, поля для ключа в адмінці немає', 'підказка: ' + keyHint);

console.log('');
console.log('═══ КАРТКА B2B: ФОРМА ВІДПРАВКИ ═══');
await p.evaluate(async () => { const o = orders.filter(x => x.orderId === '1000501')[0]; odFolds.ship = true; await openOrderDrawer(o); });
await p.waitForTimeout(800);
const f1 = await p.evaluate(() => {
  const b = document.querySelector('[data-shipform]'); if(!b) return null;
  const val = s => (b.querySelector(s) || {}).value;
  return { name: val('[data-shf="name"]'), phone: val('[data-shf="phone"]'), kg: val('[data-shf="weightKg"]'),
           format: val('[data-shf="format"]'), cod: val('[data-shf="cod"]'), codOn: (b.querySelector('[data-shf-codon]') || {}).checked,
           miss: (b.querySelector('.shf-miss') || {}).textContent || '', dis: (b.querySelector('[data-shf-make]') || {}).disabled,
           from: (b.querySelector('.shf-from') || {}).textContent || '' };
});
console.log('   ' + JSON.stringify(f1));
ok(f1 && f1.name === 'Ромашка Ольга' && f1.phone === '+380671112233', 'отримувач і телефон — самі із замовлення', 'отримувач: ' + JSON.stringify(f1));
ok(f1 && /ФОП Юкальчук/.test(f1.from) && /Вінниця/.test(f1.from), 'відправник за замовчуванням і звідки їде', 'відправник: ' + (f1 && f1.from));
ok(f1 && f1.kg === '1.9' && f1.format === 'Пакет M', 'вага 3 × 600 г + 100 г = 1,9 кг → формат «Пакет M» (до 3 кг)', 'вага/формат: ' + (f1 && f1.kg + ' / ' + f1.format));
ok(f1 && f1.codOn && f1.cod === '3100', 'контроль оплати на залишок: 6 000 − 2 900 = 3 100 ₴', 'контроль оплати: ' + (f1 && f1.cod));
ok(f1 && f1.dis && /місто/.test(f1.miss) && /відділення/.test(f1.miss), '«Створити ТТН» неактивна, і написано, чого бракує: ' + (f1 && f1.miss), 'кнопка: ' + JSON.stringify(f1));
await type('[data-shipform] [data-shf-city]', 'Київ'); await pick(0);
await type('[data-shipform] [data-shf-wh]', '50'); await pick(1);
const f2 = await p.evaluate(() => ({ dis: document.querySelector('[data-shf-make]').disabled, wh: document.querySelector('[data-shf-wh]').value }));
ok(!f2.dis && /Поштомат/.test(f2.wh), 'місто й поштомат обрано — кнопка ввімкнулась', 'після вибору: ' + JSON.stringify(f2));
await p.click('[data-shf-make]');
await p.waitForTimeout(900);
const made = npAsked.filter(x => x.op === 'create')[0] || {};
const ord = made.order || {};
console.log('   ' + JSON.stringify({ sender: ord.sender, kg: ord.weightKg, dims: ord.dims, cod: ord.cod, city: ord.cityRef, wh: ord.warehouseRef, tok: !!made.idToken }));
ok(made.idToken && ord.sender && ord.sender.id === 'yukalchuk' && ord.sender.cityRef === 'CITY-VIN' && ord.sender.warehouseRef === 'WH-1',
  'у воркер пішли відправник (код, місто, відділення) і токен входу', 'запит: ' + JSON.stringify(made));
ok(ord.weightKg === 1.9 && ord.dims && ord.dims.l === 40 && ord.dims.w === 30 && ord.dims.h === 10 && ord.cod === 3100 &&
   ord.cityRef === 'CITY-K' && ord.warehouseRef === 'PM-5' && ord.name === 'Ромашка Ольга',
  'вага, габарити формату, контроль оплати й поштомат — у запиті', 'запит: ' + JSON.stringify(ord));
const after = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '1000501')[0]; return { ttn: o.ttn, wh: o.ttnWh, cod: o.ttnCod }; });
ok(after.ttn === '20450000009999' && /Поштомат/.test(after.wh) && after.cod === 3100, 'номер ТТН записано в замовлення', 'після створення: ' + JSON.stringify(after));

console.log('');
console.log('═══ КАРТКА B2C: ТА САМА ФОРМА, ТІ САМІ ВОРОТА ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const job = designJobMake('2000777');
  const U = window.LQDesign.ui;
  job.units = [ Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі базове', color:'Чорний', size:'M', qty:2 }) ];
  openDesign();
});
await p.waitForTimeout(700);
await p.evaluate(() => { const c = document.querySelector('[data-open="2000777"]'); if(c) c.click(); });
await p.waitForTimeout(800);
const sub = await p.evaluate(() => { const b = document.querySelector('[data-fold="Відправка"]'); return b ? (b.querySelector('.dz-z-s') || {}).textContent : null; });
ok(sub === 'оберіть місто й відділення', 'згорнута «Відправка» каже, чого бракує: ' + sub, 'підпис зони: ' + sub);
await p.evaluate(() => { const b = document.querySelector('[data-fold="Відправка"]'); if(b) b.click(); });
await p.waitForTimeout(500);
const c1 = await p.evaluate(() => {
  const b = document.querySelector('#dzPanel [data-shipform], .dz-panel [data-shipform]'); if(!b) return null;
  return { kg: b.querySelector('[data-shf="weightKg"]').value, cod: b.querySelector('[data-shf="cod"]').value,
           lock: (b.querySelector('.gate-sum') || {}).textContent || '', dis: b.querySelector('[data-shf-make]').disabled,
           name: b.querySelector('[data-shf="name"]').value };
});
console.log('   ' + JSON.stringify(c1));
ok(c1 && c1.name === 'Мороз Євгенія' && c1.kg === '1.3', 'B2C: та сама форма; вага з позицій відділу — 2 × 600 г + 100 г = 1,3 кг', 'B2C форма: ' + JSON.stringify(c1));
/* Сума B2C — зі складу відділу (та сама, що в зоні «Гроші»), а не з поля
   прорахунку. Нічого не сплачено — контроль оплати на всю суму. */
const сумаB2C = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0];
  return window.LQDesign.ui.orderSum(o, designJobs['2000777']); });
ok(c1 && +c1.cod === сумаB2C && сумаB2C > 0, 'контроль оплати — залишок, як у зоні «Гроші» (нічого не сплачено): ' + сумаB2C + ' ₴',
  'B2C контроль оплати: ' + (c1 && c1.cod) + ' замість ' + сумаB2C);
ok(c1 && c1.dis && /погодив готовий виріб/.test(c1.lock), 'поки менеджер не погодив готовий виріб — 🔒 і кнопка неактивна', 'ворота: ' + JSON.stringify(c1));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'ТТН створюється з картки B2B і B2C за налаштуваннями відправки');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
