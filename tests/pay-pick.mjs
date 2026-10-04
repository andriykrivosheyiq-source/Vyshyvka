/* Привʼязка платежу в картці — рядками, по датах, з пошуком (04.10).

   Андрій: «не плиткою, а в рядок — маленький, вниз-вниз; по датах; і пошук
   по всьому: сума, дата, час, хто платив, призначення». Лише непідписані
   надходження; однаково в B2B і B2C.

   Запуск:  node tests/pay-pick.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8951;
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



const rows = () => p.evaluate(() => [...document.querySelectorAll('.pp-list .pp-row')].map(r => r.dataset.pp));
const search = async q => { await p.fill('.pp-q', q); await p.waitForTimeout(150); return rows(); };

console.log('═══ B2B: ВІКНО ПРИВʼЯЗКИ ═══');
await p.evaluate(async () => { const o = orders.filter(x => x.orderId === '1000501')[0]; odFolds.pay = true; await openOrderDrawer(o); });
await p.waitForTimeout(700);
const btn = await p.evaluate(() => (document.querySelector('[data-pay-pick]') || {}).textContent || '');
ok(/Привʼязати платіж з банку/.test(btn) && /непідписаних 3/.test(btn), 'у грошах картки — кнопка «' + btn.trim() + '»', 'кнопка: ' + btn);
await p.click('[data-pay-pick]');
await p.waitForTimeout(300);
const r0 = await rows();
ok(r0.join() === 'p2,p1,p6', 'лише непідписані надходження, нові зверху: ' + r0.join(), 'рядки: ' + r0.join());
const look = await p.evaluate(() => { const r = document.querySelector('.pp-row'); const b = r.getBoundingClientRect();
  return { h: Math.round(b.height), txt: r.textContent.replace(/\s+/g, ' ').trim(), n: document.querySelector('.pp-n').textContent }; });
console.log('   ' + JSON.stringify(look));
ok(look.h <= 44 && /Оксана Петренко/.test(look.txt) && /2 400/.test(look.txt) && /худі ромашка/.test(look.txt),
  'рядок низенький (' + look.h + ' px): дата, сума, хто, призначення, рахунок', 'рядок: ' + JSON.stringify(look));
ok((await search('1 500')).join() === 'p1' && (await search('1500')).join() === 'p1', 'пошук сумою «1 500» і «1500»', 'сума: ' + await rows());
ok((await search('1250,5')).join() === 'p6' && (await search('25')).indexOf('p6') >= 0, 'сума з копійками і частиною', 'копійки: ' + await rows());
ok((await search('28.09')).join() === 'p2', 'пошук датою «28.09»', 'дата: ' + await rows());
const tm = await p.evaluate(() => payDate('2026-09-25T18:05:00.000Z').split(' ').pop());
ok((await search(tm)).join() === 'p6', 'пошук часом «' + tm + '»', 'час: ' + await rows());
ok((await search('асія')).join() === 'p1' && (await search('вишиванка')).join() === 'p6', 'пошук за платником і призначенням', 'хто: ' + await rows());
ok((await search('оксана 2400')).join() === 'p2' && (await search('оксана 1500')).length === 0, 'кілька слів — мають збігтися всі', 'слова');
const none = await p.evaluate(async () => { document.querySelector('.pp-q').value = 'нічого такого'; document.querySelector('.pp-q').dispatchEvent(new Event('input'));
  return document.querySelector('.pp-list').textContent; });
ok(/нічого немає/.test(none), 'нічого не знайшлось — так і каже', 'порожньо: ' + none);
await search('оксана');
await p.click('.pp-row[data-pp="p2"]');
await p.waitForTimeout(700);
const l1 = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '1000501')[0];
  const pay = window.__PAYS.filter(x => x.id === 'p2')[0];
  return { open: !!document.querySelector('.pp-w'), pays: o.payments.map(x => x.sum + ':' + (x.payId || '')), doc: pay.orderId, tag: pay.tag,
           due: dueSum(o), lbl: (document.querySelector('.pay-row:last-of-type .pay-k, .od-money .pay-k') ? [...document.querySelectorAll('.od-money .pay-k')].map(x => x.textContent).join('|') : '') }; });
console.log('   ' + JSON.stringify(l1));
ok(!l1.open && l1.pays.indexOf('2400:p2') >= 0 && l1.doc === '1000501' && l1.tag === 'prepay',
  'клік по рядку — оплата в картці з посиланням на платіж, у Фінансах платіж привʼязано', 'привʼязка: ' + JSON.stringify(l1));
ok(l1.due === 700 && /з банку/.test(l1.lbl), 'залишок 6 000 − 2 900 − 2 400 = 700 ₴; запис позначено «з банку»', 'залишок: ' + l1.due);
await p.click('[data-pay-pick]'); await p.waitForTimeout(300);
ok((await rows()).join() === 'p1,p6', 'привʼязаний платіж зі списку зник', 'після: ' + await rows());
await p.keyboard.press('Escape'); await p.waitForTimeout(150);
ok(!(await p.evaluate(() => !!document.querySelector('.pp-w'))), 'Esc закриває вікно', 'не закрилось');
await p.evaluate(() => { const o = orders.filter(x => x.orderId === '1000501')[0]; const i = o.payments.findIndex(x => x.payId === 'p2');
  document.querySelector('[data-pay-del="' + i + '"]').click(); });
await p.waitForTimeout(600);
const un = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '1000501')[0];
  return { has: o.payments.some(x => x.payId === 'p2'), doc: window.__PAYS.filter(x => x.id === 'p2')[0].orderId }; });
ok(!un.has && !un.doc, 'прибрали оплату з картки — платіж у Фінансах знову вільний', 'відвʼязка: ' + JSON.stringify(un));

console.log('');
console.log('═══ B2C: ТЕ САМЕ ВІКНО ═══');
await p.evaluate(() => { document.querySelectorAll('.od-drawer, .fin-modal').forEach(x => x.remove && 0);
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const job = designJobMake('2000777');
  const U = window.LQDesign.ui;
  job.units = [ Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:2 }) ];
  openDesign(); });
await p.waitForTimeout(700);
await p.evaluate(() => { const c = document.querySelector('[data-open="2000777"]'); if(c) c.click(); });
await p.waitForTimeout(700);
await p.evaluate(() => { const b = document.querySelector('[data-fold="Гроші"]'); if(b) b.click(); });
await p.waitForTimeout(400);
const bb = await p.evaluate(() => { const b = document.querySelector('[data-do="pay-pick"]'); return b ? b.textContent : null; });
ok(bb && /вільних 3/.test(bb), 'B2C: «' + (bb || '').trim() + '» — ті самі непідписані', 'кнопка B2C: ' + bb);
await p.evaluate(() => document.querySelector('[data-do="pay-pick"]').click());
await p.waitForTimeout(300);
ok((await rows()).join() === 'p2,p1,p6', 'B2C відкриває те саме вікно рядками', 'B2C рядки: ' + await rows());
ok((await search('іван')).join() === 'p6', 'і пошук той самий', 'B2C пошук');
await p.click('.pp-row[data-pp="p6"]');
await p.waitForTimeout(600);
const c2 = await p.evaluate(() => ({ open: !!document.querySelector('.pp-w'), doc: window.__PAYS.filter(x => x.id === 'p6')[0].orderId,
  html: (document.getElementById('dzRoot') || document.body).textContent }));
ok(!c2.open && c2.doc === '2000777' && /1 2(50|51)/.test(c2.html), 'B2C: платіж привʼязано до замовлення, видно в зоні «Гроші»', 'B2C: ' + JSON.stringify({ open: c2.open, doc: c2.doc }));

console.log('');
console.log('═══ ВУЗЬКИЙ ЕКРАН ═══');
await p.setViewportSize({ width: 420, height: 800 });
await p.evaluate(() => payPickOpen(orders[0], async () => {}));
await p.waitForTimeout(300);
const nar = await p.evaluate(() => { const r = document.querySelector('.pp-row'); const b = r.getBoundingClientRect();
  const w = document.querySelector('.pp-w').getBoundingClientRect(), l = document.querySelector('.pp-list');
  return { h: Math.round(b.height), w: Math.round(b.width), right: Math.round(w.right), over: l.scrollWidth - l.clientWidth }; });
ok(nar.h <= 64 && nar.right <= 420 && nar.over <= 0, 'на телефоні рядок у два рядки (' + nar.h + ' px), без горизонтальної прокрутки', 'вузько: ' + JSON.stringify(nar));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'платіж привʼязується з короткого списку рядками, по датах, з пошуком — у B2B і B2C');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
