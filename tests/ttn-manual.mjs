/* НОМЕР ТТН РУКАМИ — ЛИШЕ НОМЕР; ✎ ЗМІНИТИ (23.10).

   #2000184: у «Або номер ТТН руками» вставили пошту й телефон клієнта за
   кордоном — картка вирішила, що накладна є, форма зникла, і виправити
   було нічим. Тепер поле бере лише 14 цифр, а біля накладної в картці є
   «✎ Змінити»: помилковий текст просто знімається, справжній номер іде в
   o.ttnHist (гроші за нього мають знайти картку).

   Запуск:  node tests/ttn-manual.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9055;
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


await p.evaluate(h => { contentData.bgApi = Object.assign({}, contentData.bgApi || {}, { npUrl: h + '/np' }); }, HOST);


const open = async () => {
  await p.evaluate(() => {
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
    document.getElementById('view-design').style.display = 'block';
    if(!designJobs['2000777']){ const job = designJobMake('2000777'); const U = window.LQDesign.ui;
      job.units = [ Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі базове', color:'Чорний', size:'M', qty:2 }) ]; }
    openDesign();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const c = document.querySelector('[data-open="2000777"]'); if(c) c.click(); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const b = document.querySelector('[data-fold="Відправка"]'); if(b && !document.querySelector('.dz-panel [data-shipform], .dz-panel [data-ship-ttn-x]')) b.click(); });
  await p.waitForTimeout(400);
};
const ord = () => p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0];
  return { ttn: o.ttn || '', hist: (o.ttnHist || []).map(h => h.ttn), form: !!document.querySelector('.dz-panel [data-shipform]'),
           x: !!document.querySelector('.dz-panel [data-ship-ttn-x]'), say: (document.querySelector('.dz-say, #dzSay, .toast') || {}).textContent || '' }; });

console.log('═══ 1. ПОШТА Й ТЕЛЕФОН У ПОЛІ ТТН — НЕ ЗБЕРІГАЮТЬСЯ ═══');
await open();
await p.fill('.dz-panel [data-of="ttn"]', 'anna@gmail.com +48 500 100 200');
await p.dispatchEvent('.dz-panel [data-of="ttn"]', 'change');
await p.waitForTimeout(500);
const a1 = await ord();
console.log('  ' + JSON.stringify(a1));
ok(a1.ttn === '' && a1.form, 'не номер — не записано, форма відправки на місці', JSON.stringify(a1));

console.log('═══ 2. КАРТКА, ДЕ ТЕКСТ УЖЕ ЛІГ ЯК НАКЛАДНА (#2000184) ═══');
await p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0]; o.ttn = 'anna@gmail.com +48500100200'; });
await open();
const a2 = await ord();
ok(a2.x && !a2.form, 'біля «накладної» є «✎ Змінити»', JSON.stringify(a2));
await p.click('.dz-panel [data-ship-ttn-x]');
await p.waitForTimeout(600);
const a3 = await ord();
console.log('  ' + JSON.stringify(a3));
ok(a3.ttn === '' && a3.form && !a3.hist.length, '«✎ Змінити» — текст знято без питань, форма знову є, в історію накладних сміття не пішло', JSON.stringify(a3));
await p.click('.dz-panel [data-shf-abroad="1"]');
await p.waitForTimeout(400);
await p.fill('.dz-panel [data-shf="abroadTo"]', 'Polska, Warszawa, ul. Prosta 1, Anna Kowalska, anna@gmail.com, +48 500 100 200');
await p.click('.dz-panel [data-shf-abroad-save]');
await p.waitForTimeout(500);
ok(await p.evaluate(() => window.LQDesign.shipAbroad(orders.filter(x => x.orderId === '2000777')[0])), 'тепер адресу вписано в «✈ За кордон»', 'за кордон не записалось');
await p.click('.dz-panel [data-shf-abroad="0"]');
await p.waitForTimeout(400);

console.log('═══ 3. СПРАВЖНІЙ НОМЕР — ЗАПИСУЄТЬСЯ; ЗАМІНА — В ІСТОРІЮ ═══');
await p.fill('.dz-panel [data-of="ttn"]', '2045 0000 1234 56');
await p.dispatchEvent('.dz-panel [data-of="ttn"]', 'change');
await p.waitForTimeout(600);
const a4 = await ord();
ok(a4.ttn === '20450000123456', '14 цифр (з пробілами) — записано як 20450000123456', JSON.stringify(a4));
await open();
await p.click('.dz-panel [data-ship-ttn-x]');
await p.waitForTimeout(600);
const a5 = await ord();
console.log('  ' + JSON.stringify(a5));
ok(a5.ttn === '' && a5.hist.join() === '20450000123456' && a5.form, 'справжню накладну знято лише з підтвердженням — вона в історії накладних (гроші знайдуть картку)', JSON.stringify(a5));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'номер ТТН руками — лише номер, «✎ Змінити» працює');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
