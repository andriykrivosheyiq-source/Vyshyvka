/* Накладна: номер живе в замовленні, а не в переписці.

   Доти номер ТТН лежав у чаті. Клієнт питав «а де?», менеджер шукав у
   переписці, копіював, вставляв. І продажний етап закривали окремою рукою —
   тобто половину разів не закривали.

   Тепер номер лежить у картці, сам закриває трек відправки й продаж і сам
   летить на сторінку клієнта. Створюється двома рівноправними шляхами: якщо
   воркер Нової пошти налаштований — кнопкою з картки, ні — руками. Другий
   шлях працює завжди, зокрема коли відправляють іншою службою.

   Ключ API у воркері й тільки там: з ним стороння людина створює накладні
   за ваш рахунок і читає всі ваші відправлення.

   Перевіряємо:
     — без адреси воркера смуга працює, але створення вимкнене й сказано чому;
     — вписаний руками номер закриває відправку й продаж;
     — з воркером місто й відділення підказуються, накладна створюється;
     — ключ у полі адреси не приймається;
     — клієнт бачить номер, кроки «Одяг» і «Контроль» і перенесення дати.

   Запуск:  node tests/ship-ttn.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8830;
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

const now = new Date().toISOString();
const ORDER = {
  id:'1', orderId:'1001101', type:'client', name:'Оксана Лисенко', phone:'+380670001101',
  status:'paid', site:'main', createdAt:now, hist:[], prodAt:now, dueAt:'2026-12-01',
  offerToken:'tok1',
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'done', qc:'ok', ship:'wait' },
  art:[{ n:2, at:now, by:'d@loomiq', files:[{ kind:'front', name:'f', url:'https://x/f.dst' }],
         wilcom:'https://x/w.png', photo:'https://x/t.jpg',
         approvals:{ art:{ by:'a@loomiq', at:now }, inner:{ by:'a@loomiq', at:now },
                     client:{ by:'a@loomiq', at:now } } }],
  payments:[{ at:now, sum:25000, kind:'prepay', by:'a@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:50,
           sizeQty:{ S:10, M:20, L:20 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
                  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] } };

function stub(np){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  const c = Object.assign({}, CONTENT, np ? { bgApi:{ npUrl:'https://np.example/w' } } : {});
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(c) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace(
    "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(src){ this.__src=src; }\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
    '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
    '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
    '      var c=new Col(); c.__n=n; return c; },');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(np){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  p.on('dialog', d => d.accept());
  const body = stub(np);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}

console.log('═══ БЕЗ ВОРКЕРА: РУКАМИ, І ЦЕ НЕ ГІРШЕ ═══');
const p1 = await open(false);
await p1.click('#board .ticket');
await p1.waitForTimeout(900);
await p1.evaluate(() => { odFolds.ship = true; renderOrderDrawer(); });
await p1.waitForTimeout(400);
const off = await p1.evaluate(() => {
  const d = document.getElementById('orderDrawer');
  return { input: d.querySelectorAll('[data-ttn]').length,
           make: d.querySelectorAll('[data-np-make]').length,
           hint: /адреса воркера/i.test(d.textContent) };
});
ok(off.input === 1 && off.make === 0,
  'без адреси воркера номер вписують руками, кнопки створення немає',
  'смуга відправки не та: ' + JSON.stringify(off));
ok(off.hint, 'і сказано, чому створення вимкнене', 'причину не пояснили');

const manual = await p1.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001101');
  await shipSetTtn(o, ' 20450123456789 ');
  return { ttn:o.ttn, ship:(o.tracks || {}).ship, status:o.status, at:!!o.ttnAt };
});
console.log('  номер ' + manual.ttn + ' · відправка «' + manual.ship + '» · етап «' + manual.status + '»');
ok(manual.ttn === '20450123456789',
  'номер записався без зайвих пробілів',
  'номер не той: «' + manual.ttn + '»');
ok(manual.ship === 'sent' && manual.status === 'done',
  'один запис закрив і трек відправки, і продаж — двох натискань більше немає',
  'стан не закрився: ' + JSON.stringify(manual));

console.log('');
console.log('═══ КЛЮЧ У ПОЛІ АДРЕСИ НЕ ПРИЙМАЄТЬСЯ ═══');
const key = await p1.evaluate(async () => {
  const inp = document.getElementById('npapi-url');
  inp.value = 'https://np.example/w?apiKey=0123456789abcdef0123456789abcdef';
  document.getElementById('npapi-save').click();
  await new Promise(r => setTimeout(r, 300));
  return (document.querySelector('.toast') || {}).textContent || '';
});
console.log('  ' + key.trim());
ok(/не вставляйте ключ/i.test(key),
  'ключ у посиланні зупиняється — у базі його бачив би кожен, хто відкриє адмінку',
  'ключ пройшов у базу: ' + key);
await p1.close();

console.log('');
console.log('═══ З ВОРКЕРОМ: МІСТО, ВІДДІЛЕННЯ, НАКЛАДНА ═══');
const p2 = await open(true);
/* Нову пошту не чіпаємо: підміняємо саме воркер — те, що адмінка справді
   викликає. Перевіряємо, що вона шле й що робить із відповіддю. */
await p2.evaluate(() => {
  window.__CALLS = [];
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if(String(u).indexOf('np.example') < 0) return real(u, o);
    const b = JSON.parse(o.body);
    window.__CALLS.push(b);
    const J = d => new Response(JSON.stringify(d), { headers:{ 'Content-Type':'application/json' } });
    if(b.op === 'cities') return J({ ok:true, list:[{ ref:'c1', name:'Львів, Львівська обл.' }] });
    if(b.op === 'warehouses') return J({ ok:true, list:[{ ref:'w1', name:'Відділення №12', number:'12' }] });
    if(b.op === 'create') return J({ ok:true, ttn:'20450999888777', ref:'r1', est:'2026-12-04' });
    if(b.op === 'track') return J({ ok:true, status:'Прямує до відділення', code:'5' });
    return J({ ok:false, error:'?' });
  };
});
await p2.click('#board .ticket');
await p2.waitForTimeout(900);
await p2.evaluate(() => { odFolds.ship = true; renderOrderDrawer(); });
await p2.waitForTimeout(400);
await p2.fill('[data-np-city]', 'Льв');
await p2.waitForTimeout(900);
const cityList = await p2.evaluate(() =>
  [...document.querySelectorAll('.ship-o')].map(b => b.textContent.trim()));
console.log('  міста: ' + cityList.join(' | '));
ok(cityList.length === 1 && /Львів/.test(cityList[0]),
  'місто підказує Нова пошта, а не пам’ять менеджера',
  'підказки міст немає: ' + JSON.stringify(cityList));
await p2.click('.ship-o');
await p2.fill('[data-np-wh]', '12');
await p2.waitForTimeout(900);
await p2.click('.ship-o');
await p2.waitForTimeout(300);
const ready = await p2.evaluate(() => !document.querySelector('[data-np-make]').disabled);
ok(ready, 'після вибору відділення кнопка відкрилась', 'кнопка лишилась заблокованою');

await p2.click('[data-np-make]');
await p2.waitForTimeout(1200);
const made = await p2.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001101');
  const c = window.__CALLS.filter(x => x.op === 'create')[0] || {};
  return { ttn:o.ttn, est:o.ttnEst, ship:(o.tracks || {}).ship, status:o.status,
           sent:c.order || {}, ops:window.__CALLS.map(x => x.op) };
});
console.log('  виклики: ' + made.ops.join(' → ') + ' · накладна ' + made.ttn);
ok(made.ttn === '20450999888777' && made.ship === 'sent',
  'накладна створена й одразу закрила відправку',
  'накладна не створилась: ' + JSON.stringify(made));
ok(made.sent.qty === 50 && made.sent.cityRef === 'c1' && made.sent.warehouseRef === 'w1' &&
   made.sent.phone === '+380670001101',
  'у воркер пішло те, що система знає сама — кількість, клієнт, місто, відділення',
  'дані відправлення не ті: ' + JSON.stringify(made.sent));
ok(JSON.stringify(made.sent).indexOf('apiKey') < 0,
  'жодного ключа в тілі запиту з браузера немає — він лише у воркері',
  'ключ полетів із браузера');

const tracked = await p2.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001101');
  await shipTrack(o);
  return o.ttnStatus || '';
});
console.log('  статус: ' + tracked);
ok(/прямує/i.test(tracked), 'статус відправлення підтягується', 'статусу немає: ' + tracked);

console.log('');
console.log('═══ ЩО БАЧИТЬ КЛІЄНТ ═══');
const client = await p2.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001101');
  o.defects = [{ id:'d1', at:new Date().toISOString(), qty:2, sz:'M', reason:'crook',
                 label:'Криво вишито', blame:'ours', route:'resew', dueWas:'2026-12-01' }];
  o.dueAt = '2026-12-08';                    // саме так її й посуває брак
  const t = offerTrackBlock(o);
  return { steps:t.steps.map(s => s.label + ':' + s.state), ttn:t.ttn,
           dueWas:t.dueWas, dueAt:t.dueAt };
});
console.log('  ' + client.steps.join(' · '));
ok(client.steps.some(s => /Одяг на складі/.test(s)),
  'клієнт бачить крок «Одяг на складі» — саме про цей проміжок питають «чого так довго»',
  'кроку про одяг немає: ' + client.steps.join(' · '));
ok(client.steps.some(s => /Контроль якості/.test(s)),
  'і контроль якості теж — інакше між тиражем і відправкою знову порожнеча',
  'кроку контролю немає');
ok(client.ttn === '20450999888777',
  'номер накладної доїхав на сторінку клієнта сам',
  'номера в клієнта немає: ' + client.ttn);
ok(client.dueWas === '2026-12-01' && client.dueAt !== client.dueWas,
  'перенесення дати сказане прямо, а не підмінене мовчки',
  'про перенесення дати не сказано: ' + JSON.stringify(client));
/* Внутрішнього туди потрапити не має: ні браку, ні чиєїсь провини. */
const leak = await p2.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001101');
  return JSON.stringify(offerTrackBlock(o));
});
/* Список причин правок клієнту потрібен — він ним і користується. А от
   сам брак, чия це провина й куди пішов маршрут — ні. */
ok(!/blame|resew|ours|Текстиль|провина|дефект/i.test(leak),
  'ні браку, ні чиєїсь провини клієнту не видно',
  'внутрішнє протекло клієнту');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'номер накладної живе в замовленні й сам доходить до клієнта');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
