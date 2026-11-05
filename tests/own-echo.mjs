/* СВІЙ ЗАПИС — НЕ «ХТОСЬ ІЩЕ» (05.11, відео КП #1000329 о 14:28).

   Після кожного «Зберегти позицію» в КП вискакувало «Картку щойно змінив хтось
   іще… правки збережено не було», хоч ніхто не змінював і все збереглось:
   база одразу повертає наш власний запис знімком (hasPendingWrites), раніше,
   ніж вкладка запамʼятала його як збережений.
     1. Знімок із нашим ще не підтвердженим записом — без попередження.
     2. Справжня чужа зміна відкритої картки з правками — попередження є.

   Запуск:  node tests/own-echo.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9076;
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
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
  rolesSeed: 2,
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
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
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ window.__OCB=cb; try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
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







const r = await p.evaluate(async () => {
  const T = []; const t0 = window.toast; window.toast = m => { T.push(String(m)); try{ t0(m); }catch(e){} };
  const o = orders.find(x => x.id === '1');
  drawerOrderId = '1';                               // картку відкрито (тримаємо правки)
  o.note = 'мої правки';                             // і правимо
  const знімок = (data, pending) => ({
    docs: [{ id:'1', data: () => JSON.parse(JSON.stringify(data)), metadata: { hasPendingWrites: pending } }],
    forEach(f){ this.docs.forEach(f); }, docChanges(){ return [{ doc: { id:'1' } }]; }, metadata: { fromCache: false, hasPendingWrites: pending }, empty: false });
  /* 1. Наш запис повертається знімком, ще не підтверджений базою. */
  window.__OCB(знімок(Object.assign({}, o, { note:'мої правки', rev: 9 }), true));
  await new Promise(z => setTimeout(z, 100));
  const own = T.filter(t => /щойно змінив хтось іще/.test(t)).length;
  /* 2. Інший пристрій справді змінив цю картку. */
  o.note = 'ще мої правки';
  window.__OCB(знімок(Object.assign({}, o, { note:'чужа нотатка', name:'Інша', rev: 10 }), false));
  await new Promise(z => setTimeout(z, 100));
  const foreign = T.filter(t => /щойно змінив хтось іще/.test(t)).length;
  window.toast = t0;
  return { own, foreign, mem: orders.find(x => x.id === '1').note };
});
console.log('  ' + JSON.stringify(r));
ok(r.own === 0, 'свій запис повернувся знімком — без «щойно змінив хтось іще»', 'хибне попередження: ' + JSON.stringify(r));
ok(r.foreign === 1 && r.mem === 'ще мої правки', 'справжня чужа зміна — попередження є, свої правки на екрані', JSON.stringify(r));
ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
