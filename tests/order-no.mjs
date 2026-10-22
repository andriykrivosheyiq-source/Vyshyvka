/* ОДИН НОМЕР УСЮДИ (22.10).

   Андрій: «в одному місці одні номери замовлення, а в другому зовсім інші…
   потрібна одна система координат: B2B з одинички, B2C з двійки, везде
   однаково; і з номера — перехід у саму картку». Ключ у базі B2C з
   пʼятірки лишається (на ньому платежі й накладні), а людина всюди бачить
   номер своєї картки.

   Запуск:  node tests/order-no.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8952;
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
         { email:'boss@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Петро',     role:'designer' }],
  fin: { accounts: [{ id:'card1', name:'Карта Моно Юкальчук', bank:'mono' }, { id:'fop1', name:'ФОП Юкальчук', bank:'privat' }] },
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
  { id:'c5', orderId:'5000034', type:'client', dir:'b2c', name:'Zharko Vadym', phone:'+380671110000',
    status:'production', site:'main', payments:[], hist:[], createdAt:'2026-10-20T09:00:00.000Z',
    crmChatId:'c5', crmChatName:'Zharko Vadym', totalPrice:1200, items:[] },
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
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Дмитренко', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-28T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана Петренко', desc:'худі ромашка' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' },\n" +
  "    { id:'p5', at:'2026-09-27T08:30:00.000Z', amount:5000, acc:'mono1', tag:'own', counter:'Переказ між рахунками' },\n" +
  "    { id:'p6', at:'2026-09-25T18:05:00.000Z', amount:1250.5, acc:'mono2', counter:'Іван Коваль', desc:'вишиванка' },\n" +
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





const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => {
  const j = designJobMake('5000034'); j.no = '2000043';
  j.units = [ Object.assign(window.LQDesign.ui.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1 }) ];
  /* Платіж на карту, привʼязаний до B2C-замовлення, — для Фінансів і Звірки. */
  const c = { id:'card_x', amount:500, acc:'card1', src:'card', by:'test@loomiq', shot:'https://x/s.png', check:{ state:'wait' },
              orderId:'5000034', tag:'prepay', at:'2026-10-21T10:00:00.000Z', counter:'На карту' };
  window.__PAYS.push(c); if(!(payments || []).some(x => x.id === c.id)) (payments || (payments = [])).push(c);
  problems['pr1'] = { id:'pr1', orderId:'5000034', at:'2026-10-20T14:52:00.000Z', by:'test@loomiq', role:'manager', text:'правки в базі', open:true };
});

console.log('═══ 1. ОДИН ПОМІЧНИК НОМЕРА ═══');
const n1 = await p.evaluate(() => ({ c: noOf('5000034'), b: noOf('1000501'), z: noOf(''), x: noOf('9999999'),
  card: showNo(orders.find(o => o.orderId === '5000034')) }));
ok(n1.c === '2000043' && n1.card === '2000043' && n1.b === '1000501' && n1.z === '' && n1.x === '9999999',
  'B2C 5000034 → 2000043 (як у картці), B2B — свій номер, невідомий — як є', JSON.stringify(n1));

console.log('');
console.log('═══ 2. ПРОБЛЕМНІ ЗАМОВЛЕННЯ: НОМЕР КАРТКИ І ПЕРЕХІД ═══');
await p.evaluate(() => { document.querySelector('.nav button[data-view="problems"]').hidden = false; document.querySelector('.nav button[data-view="problems"]').click(); });
await ЖДИ(400);
const pr = await p.evaluate(() => ({ no: (document.querySelector('.prob-no') || {}).textContent || '', all: document.getElementById('problemsRoot').textContent }));
ok(pr.no === '#2000043' && !/5000034/.test(pr.all), 'у списку «#2000043», пʼятірки ніде немає', JSON.stringify(pr.no));
await p.click('.prob-no');
await ЖДИ(700);
const pr2 = await p.evaluate(() => ({ view: getComputedStyle(document.getElementById('view-design')).display,
  open: window.LQDesign.ui.tabOpen ? window.LQDesign.ui.tabOpen() : '', panel: (document.querySelector('#dzRoot .dz-panel:not(.hide)') || {}).textContent || '' }));
ok(pr2.view === 'block' && /5000034/.test(pr2.open) && /2000043/.test(pr2.panel), 'клік по номеру — розділ B2C і відкрита саме ця картка', JSON.stringify({ view: pr2.view, open: pr2.open }));

console.log('');
console.log('═══ 3. ЗВІРКА Й ФІНАНСИ ═══');
const au = await p.evaluate(() => { const l = moneyAudit().filter(x => x.orderId === '5000034'); return l.map(x => x.text); });
ok(au.length && au.every(t => /#2000043/.test(t) && !/5000034/.test(t)), 'текст пунктів Звірки — «#2000043»', JSON.stringify(au));
await p.evaluate(() => { document.querySelector('.nav button[data-view="fin"]').click(); });
await ЖДИ(600);
const fin = await p.evaluate(() => { finAudit.open = true; renderFinAudit();
  const b = document.querySelector('#fin-audit [data-fa-open]');
  return { btn: b ? b.textContent : '', chips: [...document.querySelectorAll('.fin-chip.on')].map(x => x.textContent).filter(t => /2000043|5000034/.test(t)) };
});
ok(fin.btn === '#2000043', 'кнопка номера у Звірці — «#2000043»', JSON.stringify(fin));
ok(!fin.chips.length || fin.chips.every(t => /2000043/.test(t) && !/5000034/.test(t)), 'привʼязка руху у Фінансах — «#2000043»', JSON.stringify(fin.chips));
await p.click('#fin-audit [data-fa-open]');
await ЖДИ(700);
const fa = await p.evaluate(() => ({ view: getComputedStyle(document.getElementById('view-design')).display, open: window.LQDesign.ui.tabOpen ? window.LQDesign.ui.tabOpen() : '' }));
ok(fa.view === 'block' && /5000034/.test(fa.open), 'клік по номеру у Звірці — картка B2C', JSON.stringify(fa));
const why = await p.evaluate(() => { const c = payments.find(x => x.id === 'card_x');
  return LQMoney.linkCheck(c, '1000501', { noOf: noOf }); });
ok(/#2000043/.test(why) && !/5000034/.test(why), '«уже привʼязаний до #2000043» — теж номер картки', why);

console.log('');
console.log('═══ 4. B2B — ЯК БУЛО ═══');
const b = await p.evaluate(async () => { document.querySelector('.nav button[data-view="board"]').click(); await new Promise(r => setTimeout(r, 300));
  problems['pr2'] = { id:'pr2', orderId:'1000501', at:'2026-10-21T10:00:00.000Z', by:'test@loomiq', text:'b2b', open:true };
  document.querySelector('.nav button[data-view="problems"]').click(); await new Promise(r => setTimeout(r, 300));
  const btn = [...document.querySelectorAll('.prob-no')].find(x => /1000501/.test(x.textContent));
  btn.click(); await new Promise(r => setTimeout(r, 600));
  return { txt: btn.textContent, drawer: !!document.querySelector('#orderDrawer.open'), oid: (document.querySelector('#orderDrawer .od-oid-b') || {}).textContent || '' };
});
ok(b.txt === '#1000501' && b.drawer && /1000501/.test(b.oid), 'B2B: «#1000501» відкриває картку B2B', JSON.stringify(b));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'номер усюди той, що в картці, і веде в неї');
process.exit(bad ? 1 : 0);
