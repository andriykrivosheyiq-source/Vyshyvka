/* Грошове ядро в адмінці: одне «сплачено», привʼязка без втрат, Звірка,
   заміна ТТН (04.10).

   Андрій: «щоб платежі ніяк ніде нікуди не утікали, особливо при створенні
   Нової пошти… щоб ми ніяк не втратили гроші».

   Запуск:  node tests/money-guard.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8953;
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
  products: { retail: { tee: 700 } },
  fin: { accounts: [{ id:'mono1', name:'Моно ФОП', bank:'mono' }, { id:'np1', name:'NovaPay', bank:'np' }] }
};
const ORDERS = [
  /* B2B: 6 000 ₴, 2 900 записано руками, решта — контроль оплати на ТТН */
  { id:'b1', orderId:'1000501', type:'client', name:'Ромашка Ольга', phone:'+380671112233',
    status:'done', site:'main', hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    totalPrice:6000, payments:[{ sum:2900, at:'2026-09-26T10:00:00.000Z', kind:'prepay' }],
    ttn:'20450000000111', ttnCod:3100, ttnAt:'2026-09-28T10:00:00.000Z',
    items:[{ kind:'main', name:'Худі базове', garmentId:'hoodie', qty:3, price:6000 }] },
  /* B2B: посилку з контролем оплати забрали 5 днів тому, грошей немає */
  { id:'b2', orderId:'1000502', type:'client', name:'Мельник Ірина', phone:'+380671112244',
    status:'done', site:'main', hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    totalPrice:2500, payments:[], ttn:'20450000000222', ttnCod:2500,
    items:[{ kind:'main', name:'Футболка', garmentId:'tee', qty:5, price:2500 }] },
  /* B2B: ТТН замінили, а стара була з контролем оплати */
  { id:'b3', orderId:'1000503', type:'client', name:'Коваль Петро', phone:'+380671112255',
    status:'production', site:'main', hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    totalPrice:800, payments:[], ttn:'20450000000666', ttnCod:800, ttnAt:'2026-09-29T10:00:00.000Z',
    items:[{ kind:'main', name:'Футболка', garmentId:'tee', qty:1, price:800 }] }
];
const NPSTATE = {
  t20450000000222: { code:'9', status:'Відправлення отримано', at: new Date(Date.now() - 5 * 864e5).toISOString() },
  t20450000000111: { code:'9', status:'Відправлення отримано', at:'2026-10-01T10:00:00.000Z' } };
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  'window.__NPSTATE=' + JSON.stringify(NPSTATE) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    if(this.__col==='loomiq' && this.__id==='npState') d=window.__NPSTATE;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'npc_20450000000111', at:'2026-10-01T10:00:00.000Z', amount:3100, acc:'np1', src:'np', ttn:'20450000000111', counter:'NovaPay · Ромашка Ольга', desc:'Контроль оплати · ТТН 20450000000111' },\n" +
  "    { id:'npc_20450000000666', at:'2026-10-01T11:00:00.000Z', amount:800, acc:'np1', src:'np', ttn:'20450000000666', counter:'NovaPay · Коваль' },\n" +
  "    { id:'nphome', at:'2026-10-02T09:00:00.000Z', amount:50000, acc:'mono1', src:'mono', counter:'ТОВ «НоваПей»', desc:'Переказ коштів' },\n" +
  "    { id:'lost1', at:'2026-09-30T09:00:00.000Z', amount:450, acc:'mono1', src:'mono', orderId:'1999999', tag:'prepay', counter:'Петро' },\n" +
  "    { id:'free1', at:'2026-10-02T12:00:00.000Z', amount:1200, acc:'mono1', src:'mono', counter:'Іван' },\n" +
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




const O = id => `orders.filter(x => x.orderId === '${id}')[0]`;
const P = id => `window.__PAYS.filter(x => x.id === '${id}')[0]`;
await p.evaluate(() => { watchPayments(); renderFin(); });
await p.waitForTimeout(700);

console.log('═══ КАРТКА B2B БАЧИТЬ НАЛОЖКУ ═══');
const a1 = await p.evaluate(`(() => { const o = ${O('1000501')}; const pp = ${P('npc_20450000000111')};
  return { doc: pp.orderId, tag: pp.tag, copy: (o.payments || []).filter(e => e.payId === pp.id).length,
           paid: paidSum(o), due: dueSum(o), st: payState(o), hist: (pp.linkHist || []).length }; })()`);
console.log('   ' + JSON.stringify(a1));
ok(a1.doc === '1000501' && a1.tag === 'cod' && a1.hist === 1, 'контроль оплати за ТТН сам привʼязався до замовлення (з історією)', 'автопривʼязка: ' + JSON.stringify(a1));
ok(a1.paid === 6000 && a1.due === 0 && a1.st === 'full' && a1.copy === 1,
  'картка B2B: 2 900 руками + 3 100 наложкою = сплачено повністю (доти картка показувала борг 3 100)', 'картка: ' + JSON.stringify(a1));
await p.evaluate(`(async () => { odFolds.pay = true; await openOrderDrawer(${O('1000501')}); })()`);
await p.waitForTimeout(600);
const rowsB = await p.evaluate(() => [...document.querySelectorAll('.od-money .pay-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
console.log('   ' + JSON.stringify(rowsB));
ok(rowsB.length === 2 && /контроль оплати · з банку · NovaPay · ТТН 20450000000111/.test(rowsB[1]),
  'у грошах картки видно рядок «контроль оплати · з банку · NovaPay · ТТН», без дубля від копії', 'рядки: ' + JSON.stringify(rowsB));

console.log('');
console.log('═══ ПЛАТІЖ НЕ ПЕРЕКИДАЄТЬСЯ МОВЧКИ ═══');
const st = await p.evaluate(`(async () => { try{ await payLinkSet(${P('npc_20450000000111')}, '1000502', 'prepay'); return 'ok'; }
  catch(e){ return e.message; } })()`);
ok(/уже привʼязаний до #1000501/.test(st) && await p.evaluate(`${P('npc_20450000000111')}.orderId`) === '1000501',
  'привʼязаний платіж в інше замовлення не переходить: «' + st + '»', 'перекинуто: ' + st);

console.log('');
console.log('═══ ВІДВʼЯЗКА З КАРТКИ ═══');
await p.evaluate(() => { [...document.querySelectorAll('.od-money .pay-row')].filter(r => /NovaPay/.test(r.textContent))[0].querySelector('[data-pay-del]').click(); });
await p.waitForTimeout(600);
const a2 = await p.evaluate(`(() => { const o = ${O('1000501')}; const pp = ${P('npc_20450000000111')};
  return { doc: pp.orderId, copy: (o.payments || []).filter(e => e.payId === pp.id).length, due: dueSum(o) }; })()`);
ok(!a2.doc && a2.copy === 0 && a2.due === 3100, 'відвʼязали — і рух у Фінансах вільний, і копії в картці немає; борг знову 3 100', 'відвʼязка: ' + JSON.stringify(a2));

console.log('');
console.log('═══ ЗВІРКА ГРОШЕЙ У ФІНАНСАХ ═══');
await p.evaluate(() => { document.querySelector('[data-view="fin"]').click(); });
await p.waitForTimeout(700);
await p.evaluate(() => { const t = document.querySelector('[data-fa-toggle]'); if(t) t.click(); });
await p.waitForTimeout(300);
const au = await p.evaluate(() => ({ head: (document.querySelector('.fa-h') || {}).textContent || '',
  items: [...document.querySelectorAll('.fa-i')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) }));
console.log('   ' + au.head.replace(/\s+/g, ' ').trim());
au.items.forEach(t => console.log('   · ' + t.slice(0, 150)));
const has = re => au.items.some(t => re.test(t));
ok(has(/ТТН 20450000000222 забрали .*грошей немає вже 5 дн/), 'посилку забрали 5 днів тому, грошей немає — у Звірці', 'немає пункту 222');
ok(has(/ТТН 20450000000111 .*гроші прийшли, але до замовлення не привʼязані.*Привʼязати/),
  'відвʼязана наложка — «гроші прийшли, не привʼязані» з кнопкою', 'немає пункту 111');
ok(has(/привʼязаний до #1999999, а такого замовлення немає/), 'платіж, привʼязаний до неіснуючого замовлення', 'немає lost');
ok(has(/переказ з NovaPay 50/), 'переказ з NovaPay на Моно — «позначте між своїми»', 'немає NovaPay');
ok(/терміново/.test(au.head), 'у шапці — скільки термінових', 'шапка: ' + au.head);
await p.evaluate(() => { [...document.querySelectorAll('.fa-i')].filter(x => /20450000000111/.test(x.textContent))[0].querySelector('[data-fa-fix="link"]').click(); });
await p.waitForTimeout(600);
await p.evaluate(() => { [...document.querySelectorAll('.fa-i')].filter(x => /NovaPay/.test(x.textContent))[0].querySelector('[data-fa-fix="own"]').click(); });
await p.waitForTimeout(600);
await p.evaluate(() => { [...document.querySelectorAll('.fa-i')].filter(x => /1999999/.test(x.textContent))[0].querySelector('[data-fa-fix="unlink"]').click(); });
await p.waitForTimeout(600);
await p.evaluate(() => { [...document.querySelectorAll('.fa-i')].filter(x => /20450000000222/.test(x.textContent))[0].querySelector('[data-fa-okay]').click(); });
await p.waitForTimeout(600);
const au2 = await p.evaluate(() => [...document.querySelectorAll('.fa-i')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const st2 = await p.evaluate(`({ l: ${P('npc_20450000000111')}.orderId, own: ${P('nphome')}.tag, lost: ${P('lost1')}.orderId,
  ok: Object.keys(${O('1000502')}.moneyOk || {}).join() })`);
console.log('   після: ' + JSON.stringify(st2) + ' · пунктів ' + au2.length);
ok(st2.l === '1000501' && st2.own === 'own' && !st2.lost && /cod_late:20450000000222/.test(st2.ok) && !au2.some(t => /20450000000111|NovaPay|1999999|20450000000222/.test(t)),
  'кнопки Звірки: привʼязали, «між своїми», відвʼязали, «гаразд» — пункти зникли', 'після кнопок: ' + JSON.stringify(au2));

console.log('');
console.log('═══ ЗАМІНА ТТН НЕ ГУБИТЬ ГРОШІ ЗА СТАРУ ═══');
const t1 = await p.evaluate(`(async () => { const o = ${O('1000503')}; await shipSetTtn(o, '20450000000777');
  return { ttn: o.ttn, cod: o.ttnCod, hist: o.ttnHist }; })()`);
ok(t1.ttn === '20450000000777' && t1.cod === 0 && t1.hist && t1.hist[0].ttn === '20450000000666' && t1.hist[0].cod === 800,
  'нова ТТН записана, стара з контролем оплати 800 ₴ — у ttnHist (після попередження)', 'заміна: ' + JSON.stringify(t1));
await p.evaluate(() => { payAutoLinkTtn(); });
await p.waitForTimeout(500);
const t2 = await p.evaluate(`({ doc: ${P('npc_20450000000666')}.orderId, due: dueSum(${O('1000503')}) })`);
ok(t2.doc === '1000503' && t2.due === 0, 'гроші за стару ТТН знайшли своє замовлення — сплачено', 'стара ТТН: ' + JSON.stringify(t2));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'гроші в адмінці рахуються одним ядром і не губляться');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
