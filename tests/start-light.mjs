/* СТАРТ ЛЕГШИЙ (25.10, крок 2 швидкості).

   1. Замовлення завантажуються ОДИН раз — першим знімком підписки, без
      окремого get() усієї колекції.
   2. Поки картки їдуть, дошка каже «Завантажую картки…», а не стоїть порожня.
   3. Кеш бази на пристрої ввімкнено (enablePersistence; з 27.10 — БЕЗ
      synchronizeTabs і лише на компʼютері, див. tests/db-link.mjs §7);
      ?nocache=1 вимикає й памʼятає; перший знімок із кешу показує картки
      одразу, свіжий — слідом (perf: cache, orders).
   4. Документ команди (заслона) передплачується ДО документа налаштувань.

   Запуск:  node tests/start-light.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9139;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }], b2c:{} };
const ORDERS = [
  { id:'1', orderId:'2000901', type:'client', dir:'b2c', name:'Асія', phone:'', status:'prorahunok', site:'main', crmChatId:'c1',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 2000, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ (window.__LOG=window.__LOG||[]).push('get:' + this.__col + '/' + this.__id); return Promise.resolve(new Snap('x', null)); };")
  .replace("enablePersistence:function(){ return Promise.resolve(); },",
  "enablePersistence:function(o){ (window.__LOG=window.__LOG||[]).push('persist:' + JSON.stringify(o||{})); return Promise.resolve(); },");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null; (window.__LOG=window.__LOG||[]).push("snap:" + this.__col + "/" + this.__id);\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.where=function(){ var c=Object.create(this); c.__filtered=true; return c; };\n' +
  '  SeedCol.prototype.get=function(){ if(!this.__filtered){ window.__GETS=(window.__GETS||0)+1; (window.__LOG=window.__LOG||[]).push("getall:" + (new Error().stack||"").split("\\n").slice(2,4).join("|")); } return Col.prototype.get.apply(this, arguments); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ window.__SNAPS=(window.__SNAPS||0)+1; var mk=function(fc){ return { metadata:{ fromCache: fc },\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }; };\n' +
  '    setTimeout(function(){ try{ if(window.__CACHE_FIRST) cb(mk(true)); }catch(e){ console.error(e); } }, 300);\n' +
  '    setTimeout(function(){ try{ cb(mk(false)); }catch(e){ console.error(e); } }, window.__ORDERS_DELAY||0); return function(){}; };\n' +
  '  SeedCol.prototype.onSnapshotOld=function(cb){ try{ cb({\n' +
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


const ctx = await browser.newContext({ viewport:{ width:1300, height:860 } });
const page = async (init) => {
  const q = await ctx.newPage();
  q.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  await q.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  if(init) await q.addInitScript(init);
  return q;
};

console.log('═══ 1. ОДНЕ ЗАВАНТАЖЕННЯ; «ЗАВАНТАЖУЮ КАРТКИ…» ПОКИ ЇДУТЬ ═══');
const q1 = await page(() => { window.__ORDERS_DELAY = 3000; });
await q1.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await q1.waitForTimeout(1800);
await q1.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });
const s1 = await q1.evaluate(() => ({ load: /Завантажую картки/.test((document.querySelector('#view-board') || {}).textContent || ''),
  state: (document.getElementById('web-orders-state') || {}).textContent || '', gets: window.__GETS || 0, snaps: window.__SNAPS || 0, n: (orders || []).length }));
console.log('  ' + JSON.stringify(s1));
ok(s1.load && s1.n === 0, 'до першого знімка — «Завантажую картки…» на дошці, а не порожня колонка', JSON.stringify(s1));
await q1.waitForTimeout(3000);
const s2 = await q1.evaluate(() => ({ load: /Завантажую картки/.test((document.querySelector('#view-board') || {}).textContent || ''),
  gets: window.__GETS || 0, snaps: window.__SNAPS || 0, n: (orders || []).length, loaded: ordersLoaded,
  log: (window.__LOG || []).filter(x => /photos|state|getall/.test(x)) }));
console.log('  ' + JSON.stringify(s2));
ok(s2.n >= 1 && s2.loaded && !s2.load, 'картки приїхали — напис зник', JSON.stringify(s2));
ok(s2.gets === 0 && s2.snaps === 1, 'замовлення завантажено ОДИН раз (підпискою), без get() усієї колекції', 'get: ' + s2.gets + ', підписок: ' + s2.snaps);
const iPhotos = s2.log.findIndex(x => /snap:loomiq\/photos/.test(x)), iState = s2.log.findIndex(x => /get:loomiq\/state/.test(x));
ok(iPhotos >= 0 && iState >= 0 && iPhotos < iState, 'документ команди передплачено ДО документа налаштувань', JSON.stringify(s2.log));
ok((await q1.evaluate(() => (window.__LOG || []).filter(x => /^persist:/.test(x)))).length === 0, 'кеш бази за замовчуванням ВИМКНЕНО (27.10, вечір: двічі ламав запис)', 'persist викликано без ?cache=1');
await q1.close();

console.log('═══ 2. З КЕШУ — ОДРАЗУ, СВІЖЕ — СЛІДОМ ═══');
const q2 = await page(() => { window.__ORDERS_DELAY = 3000; window.__CACHE_FIRST = true; });
await q2.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await q2.waitForTimeout(1800);
const c1 = await q2.evaluate(() => ({ n: (orders || []).length, loaded: ordersLoaded, cache: perfMark.cache, orders: perfMark.orders }));
ok(c1.n >= 1 && c1.loaded && c1.cache > 0 && !c1.orders, 'картки з кешу показались одразу (perf: cache), свіжих ще немає', JSON.stringify(c1));
await q2.waitForTimeout(3000);
const c2 = await q2.evaluate(() => ({ cache: perfMark.cache, orders: perfMark.orders, snaps: window.__SNAPS }));
ok(c2.orders > c2.cache && c2.snaps === 1, 'свіжі приїхали тією самою підпискою (perf: orders після cache)', JSON.stringify(c2));
await q2.close();

console.log('═══ 3. ?cache=1 — КЕШ УВІМКНЕНО Й ЗАПАМʼЯТОВАНО (ОДНА ВКЛАДКА); ?nocache=1 — ВИМКНЕНО ═══');
const q3 = await page();
await q3.goto(HOST + '/loomiqadmin.html?cache=1', { waitUntil:'domcontentloaded' });
await q3.waitForTimeout(1200);
const n1 = await q3.evaluate(() => ({ persist: (window.__LOG || []).filter(x => /^persist:/.test(x)).join(), ls: localStorage.getItem('lq_cache') }));
await q3.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await q3.waitForTimeout(1200);
const n2 = await q3.evaluate(() => (window.__LOG || []).some(x => /^persist:/.test(x)));
await q3.goto(HOST + '/loomiqadmin.html?nocache=1', { waitUntil:'domcontentloaded' });
await q3.waitForTimeout(1200);
const n3 = await q3.evaluate(() => ({ persist: (window.__LOG || []).some(x => /^persist:/.test(x)), ls: localStorage.getItem('lq_cache') }));
ok(n1.persist === 'persist:{"synchronizeTabs":false}' && n1.ls === '1' && n2 && !n3.persist && !n3.ls, '?cache=1 вмикає кеш (без синхронізації вкладок) і памʼятає; ?nocache=1 вимикає', JSON.stringify({ n1, n2, n3 }));
await q3.close();

ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'старт легший: одне завантаження, кеш, команда першою');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
