/* ДОСТАВКА ЗА КОРДОН (21.10).

   Андрій: «ТТН там не створюється — одне поле, куди відправити; варіація,
   не основна, щоб постійно не вибирати». Поруч зі «Створити ТТН» — тихе
   «✈ За кордон»; обрали — одне поле; записали — ланцюг вважає, що відправка
   є: «ТТН не створена» гасне, фото з цеху можна погодити, цех бачить, куди,
   і тисне «Відправлено за кордон».

   Запуск:  node tests/ship-abroad.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9119;
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

console.log('═══ 1. B2C: «✈ ЗА КОРДОН» ПОРУЧ ЗІ «СТВОРИТИ ТТН» ═══');
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
await p.evaluate(() => { const b = document.querySelector('[data-fold="Відправка"]'); if(b) b.click(); });
await p.waitForTimeout(400);
const f0 = await p.evaluate(() => {
  const b = document.querySelector('.dz-panel [data-shipform]'); if(!b) return null;
  const a = b.querySelector('[data-shf-abroad="1"]');
  return { make: !!b.querySelector('[data-shf-make]'), link: a ? a.textContent : '', ta: !!b.querySelector('[data-shf="abroadTo"]') };
});
ok(f0 && f0.make && /За кордон/.test(f0.link) && !f0.ta, 'звичайна форма НП, під нею тихе посилання «✈ За кордон»', JSON.stringify(f0));
await p.click('.dz-panel [data-shf-abroad="1"]');
await p.waitForTimeout(500);
const f1 = await p.evaluate(() => {
  const o = orders.filter(x => x.orderId === '2000777')[0];
  const b = document.querySelector('.dz-panel [data-shipform]'); if(!b) return null;
  return { abroad: !!(o.ship && o.ship.abroad), ta: !!b.querySelector('[data-shf="abroadTo"]'), make: !!b.querySelector('[data-shf-make]'),
           saveDis: (b.querySelector('[data-shf-abroad-save]') || {}).disabled, back: !!b.querySelector('[data-shf-abroad="0"]'),
           known: window.LQDesign.shipKnown(o), sub: (document.querySelector('[data-fold="Відправка"] .dz-z-s') || {}).textContent };
});
console.log('   ' + JSON.stringify(f1));
ok(f1 && f1.abroad && f1.ta && !f1.make && f1.saveDis && f1.back && !f1.known,
  'за кордон: одне поле «куди відправити», без НП-полів і «Створити ТТН»; поки порожнє — не записано, повернутись можна', JSON.stringify(f1));
await p.fill('.dz-panel [data-shf="abroadTo"]', 'Польща, Warszawa, ul. Prosta 1\nAnna Kowalska +48 500 100 200\nDHL');
await p.click('.dz-panel [data-shf-abroad-save]');
await p.waitForTimeout(600);
const f2 = await p.evaluate(() => {
  const o = orders.filter(x => x.orderId === '2000777')[0];
  const D = window.LQDesign, U = D.ui, job = designJobs['2000777'];
  return { to: o.ship.abroadTo, known: D.shipKnown(o), noTtn: U.noTtn(job, o), ttn: o.ttn || '',
           sub: (document.querySelector('[data-fold="Відправка"] .dz-z-s') || {}).textContent,
           dataOk: U.host.shipDataOk(o) };
});
console.log('   ' + JSON.stringify(f2));
ok(/Warszawa/.test(f2.to) && f2.known && !f2.noTtn && !f2.ttn && /за кордон/.test(f2.sub) && f2.dataOk,
  'записано: ланцюг вважає відправку відомою без ТТН; «ТТН не створена» гасне; «чекаємо дані» знімається; підпис зони «✈ за кордон»', JSON.stringify(f2));

console.log('');
console.log('═══ 2. ЦЕХ: ПОГОДИТИ ФОТО МОЖНА, ВИДНО КУДИ, «ВІДПРАВЛЕНО ЗА КОРДОН» ═══');
const c1 = await p.evaluate(() => {
  const o = orders.filter(x => x.orderId === '2000777')[0];
  const D = window.LQDesign;
  const без = D.prodApprove({ orderId:'x', prodQc:{ photos:[] }, ship:{} }, 'v');
  o.prodQc = { photos: [{ url:'https://x/1.jpg' }], at: new Date().toISOString() };
  const рез = D.prodApprove(o, 'test@loomiq');
  return { без, рез, at: D.prodAt(designJobs['2000777'], o) };
});
ok(c1.без === 'ok' && c1.рез === 'ok' && c1.at === 'ship', 'без ТТН погодити можна (26.10, «ТТН ще немає»); за кордон — погоджено, колонка «Можна відправляти»', JSON.stringify(c1));
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.render(document.getElementById('dzRoot')); U.open('2000777'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(500);
const c2 = await p.evaluate(() => {
  const t = document.querySelector('.dz-ttn');
  return { txt: t ? t.textContent.replace(/\s+/g, ' ') : '', btn: !!document.querySelector('[data-do="prod-abroad-sent"]'), reg: /Реєстр/.test(document.querySelector('.dz-panel') ? document.querySelector('.dz-panel').textContent : '') };
});
console.log('   ' + JSON.stringify(c2));
ok(/За кордон: .*Warszawa/.test(c2.txt) && c2.btn, 'панель цеху: «✈ За кордон: …» замість ТТН і кнопка «Відправлено за кордон»', JSON.stringify(c2));
await p.click('[data-do="prod-abroad-sent"]');
await p.waitForTimeout(500);
const c3 = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0]; return { sent: !!o.ship.abroadSentAt, at: window.LQDesign.prodAt(designJobs['2000777'], o) }; });
ok(c3.sent && c3.at === 'done', '«Відправлено за кордон» → замовлення «Виконано»', JSON.stringify(c3));

console.log('');
console.log('═══ 3. B2B: ТА САМА ФОРМА В КАРТЦІ, НАЗАД ДО НП ═══');
await p.evaluate(async () => { document.querySelectorAll('main > section').forEach(x => x.style.display = ''); const o = orders.filter(x => x.orderId === '1000501')[0]; odFolds.ship = true; await openOrderDrawer(o); });
await p.waitForTimeout(700);
await p.click('#orderDrawer [data-shf-abroad="1"]');
await p.waitForTimeout(400);
await p.fill('#orderDrawer [data-shf="abroadTo"]', 'Німеччина, Berlin');
await p.click('#orderDrawer [data-shf-abroad-save]');
await p.waitForTimeout(500);
const b1 = await p.evaluate(() => ({ lbl: (document.querySelector('#orderDrawer [data-fold="ship"] .od-fold-s, #orderDrawer .od-fold[data-fold="ship"] .od-fs') || {}).textContent || document.querySelector('#orderDrawer').textContent.match(/✈ за кордон/) ? 'за кордон' : '',
  abroad: shipAbroad(orders.filter(x => x.orderId === '1000501')[0]) }));
ok(b1.abroad && /за кордон/.test(b1.lbl), 'B2B: записано, у згорнутій «Відправці» — «✈ за кордон»', JSON.stringify(b1));
await p.click('#orderDrawer [data-shf-abroad="0"]');
await p.waitForTimeout(400);
const b2 = await p.evaluate(() => { const o = orders.filter(x => x.orderId === '1000501')[0]; return { abroad: shipAbroad(o), make: !!document.querySelector('#orderDrawer [data-shf-make]'), kept: o.ship.abroadTo }; });
ok(!b2.abroad && b2.make && /Berlin/.test(b2.kept), '«← Відправка Новою поштою»: знову форма НП, за кордон вимкнено (текст не загублено)', JSON.stringify(b2));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'за кордон: одне поле замість ТТН, ланцюг іде далі');
process.exit(bad ? 1 : 0);
