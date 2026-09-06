/* Закупівля по розмірах і ворота тиражу.

   ЗАКУПІВЛЯ. «Одяг замовлений» однією галочкою не означає нічого: замовлено
   все чи половину, приїхало 42 із 50, чого саме бракує — з галочки не
   видно, а саме це число вирішує, можна вже шити чи ні. Тому потреба
   розписується по кожному розміру, «треба» береться з розмірного ряду
   позиції й руками не правиться, а запас на брак рахується сам: рівно 50 із
   50 купувати не можна, один зіпсований виріб інакше зупиняє все.

   ВОРОТА. Ніхто не вирішує головою, чи можна запускати тираж. П'ять умов:
   макет, тест, одяг, передоплата, файли на машину. Зійшлось усе — стан сам
   стає «готово до тиражу». Не зійшлось — «готово до тиражу» не вмикається
   й руками, і видно, чого саме бракує.

   Перевіряємо:
     — потреба збирається з розмірів позиції, запас додається зверху;
     — отримано рахується від «треба», а не від «замовити»;
     — трек одягу веде сама таблиця;
     — ворота бачать усі п'ять умов і називають те, чого бракує;
     — руками в «готово до тиражу» не стати;
     — остання умова, що закрилась, сама відчиняє ворота;
     — зведена відомість на день не показує вже замовлене.

   Запуск:  node tests/supply-gate.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8828;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', url:'', contact:'095 000 00 00', days:7 }],
  products:{ supplier:{ tshirt:'tex' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'},{size:'XL'}] }
};
const now = new Date().toISOString();
/* Замовлення оплачене, макет погоджено, тест іще ні: саме той стан, у якому
   ворота мають тримати тираж. */
const O = {
  id:'1', orderId:'1000901', type:'client', name:'Оксана', phone:'+380670000901',
  status:'paid', site:'main', createdAt:now, hist:[], dueAt:'2026-12-01', prodAt:now,
  tracks:{ design:'ok', supply:'todo', test:'inner', prod:'lock', qc:'wait', ship:'wait' },
  art:[{ n:3, at:now, by:'des@loomiq',
         files:[{ kind:'front', name:'1000901_front_v3', url:'https://files.example/f.dst' }],
         wilcom:'https://files.example/w.png', photo:'https://files.example/t.jpg',
         approvals:{ art:{ by:'test@loomiq', at:now, note:'' },
                     inner:{ by:'test@loomiq', at:now, note:'' } } }],
  payments:[{ at:now, sum:5000, kind:'prepay', by:'test@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt', qty:50,
           unitPrice:500, price:25000, unitCost:300, cost:15000,
           sizeQty:{ S:5, M:15, L:20, XL:10 },
           prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([O]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
const O1 = () => p.evaluate(() => orders.find(x => x.orderId === '1000901'));

console.log('═══ ПОТРЕБА Й ЗАПАС ═══');
const need = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000901');
  return { rows: buyRows(o).map(r => r.sz + ':' + r.need + '+' + r.res), sum: buySum(o) };
});
console.log('  ' + need.rows.join(' · ') + '  →  замовити ' + need.sum.buy);
ok(need.rows.join(' · ') === 'S:5+1 · M:15+1 · L:20+1 · XL:10+1',
  'потреба зібралась із розмірного ряду позиції, запас доданий зверху',
  'потреба не та: ' + need.rows.join(' · '));
ok(need.sum.need === 50 && need.sum.buy === 54,
  'треба 50, замовити 54 — запас округлений угору й не менший за штуку',
  'підсумок не той: ' + JSON.stringify(need.sum));
ok(!need.sum.enough,
  'нічого ще не приїхало — і система це знає',
  'порожня закупівля вважається вкомплектованою');

console.log('');
console.log('═══ ВОРОТА ТРИМАЮТЬ ТИРАЖ ═══');
const g1 = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000901');
  return { g: prodGates(o).map(x => (x.ok ? '✓ ' : '○ ') + x.label),
           open: prodGateOpen(o) };
});
g1.g.forEach(x => console.log('  ' + x));
ok(!g1.open, 'ворота зачинені', 'ворота відчинились без одягу й тесту');
ok(g1.g.filter(x => x[0] === '✓').length === 3,
  'три умови з п’яти вже закриті — макет, передоплата, файли',
  'закритих умов не три: ' + g1.g.join(' | '));

const hand = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000901');
  await setTrack(o, 'prod', 'ready');
  return { step:(o.tracks || {}).prod,
           toast:(document.querySelector('.toast') || {}).textContent || '' };
});
console.log('  ' + hand.toast.trim());
ok(hand.step === 'lock',
  'руками в «готово до тиражу» не стати',
  'тираж відкрили рукою: ' + hand.step);
ok(/одяг|тест/i.test(hand.toast),
  'і сказано, чого саме бракує',
  'причину не назвали: ' + hand.toast);

console.log('');
console.log('═══ ОДЯГ ЇДЕ ЧАСТИНАМИ ═══');
const part = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000901');
  await buyOrderAll(o);
  const afterOrder = { track:(o.tracks || {}).supply, eta: buyEta(o) };
  await buySet(o, 0, 'S', 'got', 5);
  await buySet(o, 0, 'M', 'got', 15);
  await buySet(o, 0, 'L', 'got', 12);
  await buySet(o, 0, 'XL', 'got', 10);
  return { afterOrder, sum: buySum(o), track:(o.tracks || {}).supply };
});
console.log('  замовлено → трек «' + part.afterOrder.track + '», одяг буде ' + part.afterOrder.eta);
console.log('  приїхало ' + part.sum.got + ' із ' + part.sum.need);
ok(part.afterOrder.track === 'sent',
  'позначили замовленим — трек одягу пішов сам',
  'трек лишився: ' + part.afterOrder.track);
ok(!!part.afterOrder.eta,
  'дата приїзду порахована зі строку доставки підрядника',
  'дати приїзду немає — строк підрядника не використали');
ok(part.track === 'part' && !part.sum.enough,
  '42 із 50 — це «частково отримано», і шити ще рано',
  'стан не той: ' + part.track + ' / ' + JSON.stringify(part.sum));

console.log('');
console.log('═══ ОСТАННЯ УМОВА ВІДЧИНЯЄ ВОРОТА ═══');
const done = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000901');
  await buySet(o, 0, 'L', 'got', 20);        // приїхала решта
  const midway = { supply:(o.tracks || {}).supply, prod:(o.tracks || {}).prod,
                   open: prodGateOpen(o) };
  await artApprove(o, 'client');             // клієнт погодив тест — це остання
  return { midway, prod:(o.tracks || {}).prod, open: prodGateOpen(o),
           sum: buySum(o) };
});
console.log('  одяг зібрано: трек «' + done.midway.supply + '», тираж «' + done.midway.prod + '»');
ok(done.midway.supply === 'got' && done.sum.enough,
  '50 із 50 — одяг отримано',
  'одяг не зарахований: ' + JSON.stringify(done.midway));
ok(!done.midway.open && done.midway.prod === 'lock',
  'поки тест не погоджений, ворота все ще зачинені',
  'ворота відчинились без тесту');
ok(done.open && done.prod === 'ready',
  'клієнт погодив тест — ворота відчинились самі, без жодної кнопки',
  'ворота не спрацювали: ' + done.prod);

console.log('');
console.log('═══ ЗАПАС НЕ ВИМАГАЄТЬСЯ ═══');
/* Замовили 54, приїхало 50 — це вже досить, щоб шити: запас наша страховка,
   а не обіцянка клієнту. */
const spare = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000901');
  const s = buySum(o);
  return { ord:s.ord, got:s.got, need:s.need, enough:s.enough };
});
console.log('  замовлено ' + spare.ord + ' · приїхало ' + spare.got + ' · треба ' + spare.need);
ok(spare.ord > spare.got && spare.enough,
  'ворота дивляться на «треба», а не на «замовити»',
  'запас вимагають як обов’язковий: ' + JSON.stringify(spare));

console.log('');
console.log('═══ ЗВЕДЕНА ВІДОМІСТЬ НА ДЕНЬ ═══');
const sheet = await p.evaluate(() => {
  const before = Object.keys(buySheet()).length;
  /* Друге замовлення, ще не замовлене — воно й має бути у відомості. */
  orders.push({ id:'2', orderId:'1000902', status:'paid', prodAt:new Date().toISOString(),
    name:'Ігор', payments:[], hist:[], createdAt:new Date().toISOString(),
    items:[{ kind:'main', name:'Худі', color:'сіре', garmentId:'tshirt', qty:12,
             sizeQty:{ M:6, L:6 } }] });
  const s = buySheet();
  const csv = buySheetCsv();
  return { before, sup:Object.keys(s),
           units: s.tex ? s.tex.units : 0,
           orders: s.tex ? s.tex.rows.map(x => x.o.orderId) : [],
           csvHead: csv.split('\r\n')[0], csvRows: csv.split('\r\n').length };
});
console.log('  до другого замовлення груп: ' + sheet.before +
            ' · тепер ' + sheet.units + ' шт у ' + sheet.sup.join(', '));
ok(sheet.before === 0,
  'уже замовлене у відомість не потрапляє — вдруге не замовимо',
  'замовлене лишилось у списку');
ok([...new Set(sheet.orders)].join() === '1000902' && sheet.units === 14,
  'у відомості лише нове замовлення, по рядку на розмір, із запасом: 12 + 2',
  'відомість не та: ' + JSON.stringify(sheet));
ok(/Підрядник;Замовлення/.test(sheet.csvHead) && sheet.csvRows === 3,
  'CSV для підрядника збирається з тих самих рядків',
  'CSV не той: ' + sheet.csvHead + ' · рядків ' + sheet.csvRows);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'одяг рахується по розмірах, а тираж запускають умови, а не рука');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
