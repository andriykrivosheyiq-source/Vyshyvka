/* ФОНОВІ ЗАПИСИ НЕ ВОЮЮТЬ МІЖ ВКЛАДКАМИ (02.11).

   Скарги 30.10–02.11: «НЕ ЗБЕРЕЖЕНО замовлення: permission-denied» одразу
   після «Замовлення створено»; «програма підвисає при створенні, дуже
   повільно грузить». Причина: priceLockAll після КОЖНОГО знімка бази в
   КОЖНІЙ вкладці доводив суми й собівартість УСІХ карток і писав їх (і всі
   картки разом, і дошку B2B наново). Середня ставка дизайнера в різних
   вкладках різна — вкладки переписували одна одній щойно створену картку,
   база відкидала зайві записи за лічильником, а менеджерка бачила відмову.

   1. Чужа картка (прийшла знімком, ця вкладка її не міняла) — фон її НЕ пише,
      навіть коли сума в ній «не та».
   2. Своя картка (змінили в цій вкладці) — фон доводить суму й пише лише
      цю картку, решту не чіпає.
   3. База відкинула запис за лічильником (хтось записав між читанням і
      записом) — один повтор на свіжій версії, без вікна «НЕ ЗБЕРЕЖЕНО».
      Відкинула й удруге — тоді вже кажемо.
   4. Автоматичний запис без складу не стирає склад картки відділу (#2000452);
      людина руками — видаляє, як і доти.
   5. Накладна на B2C-картку без жодної позиції не створюється.
   6. Невдачі й захисти — у журнал (не частіше разу на 10 хв на картку) і в
      блок «Стан системи» у Фінансах.

   Запуск:  node tests/bg-writes.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9191;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [], dialogs = [];
const iso = d => new Date(Date.now() - d * 864e5).toISOString();
const CONTENT = { team: [{ email:'test@loomiq', name:'Юлія', role:'owner' }], b2c: {} };
const card = (id, no, extra) => Object.assign({ id, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + no, phone:'', status:'design', site:'main',
  createdAt: iso(1), touchedAt: iso(0.5), rev: 4, totalPrice: 1, items:[], hist:[], trackHist:[], payments:[], arch:false }, extra);
const ORDERS = [ card('5100001', '5100001'), card('5100002', '5100002'), card('5100003', '5100003') ];
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n' +
  '  window.__DB={}; window.__ORDERS.forEach(function(o){ window.__DB["kanbanOrders/"+o.id]=JSON.parse(JSON.stringify(o)); });\n' +
  '  window.__W={}; window.__DENY={};\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };', 'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
/* сховище: get віддає збережене, set кладе і рахує записи; __DENY — відмова за лічильником N разів */
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var k=this.__col+'/'+this.__id, v=window.__DB[k]; return Promise.resolve(new Snap(this.__id||'x', v ? JSON.parse(JSON.stringify(v)) : null)); };");
fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
  "Doc.prototype.set=function(d){ var k=this.__col+'/'+this.__id; if(window.__DENY[k] > 0){ window.__DENY[k]--; var e=new Error('Missing or insufficient permissions.'); e.code='permission-denied'; return Promise.reject(e); } window.__W[k]=(window.__W[k]||0)+1; window.__DB[k]=JSON.parse(JSON.stringify(d)); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT; try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function mkSnap(list, ch){ var docs=list.map(function(o){ return new Snap(o.id,o); }); var c=ch||list; return { docs:docs, forEach:function(f){ docs.forEach(f); }, empty:!docs.length, metadata:{ fromCache:false }, docChanges:function(){ return c.map(function(o){ return { type: ch ? "modified" : "added", doc:new Snap(o.id,o) }; }); } }; }\n  window.__mkSnap=mkSnap;\n' +
  '  function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.onSnapshot=function(cb){ window.__ORD_CB=cb; try{ cb(mkSnap(window.__ORDERS)); }catch(e){ console.error(e); } return function(){}; };\n' +
  "  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col='kanbanOrders'; return d; };\n" +
  "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(); var c=new Col(); c.__n=n; return c; },");
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
p.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message().slice(0, 120)); d.accept(''); });
await p.route('**://**', r => { const u = r.request().url(); if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub }); if(u.startsWith(HOST)) return r.continue(); return r.abort(); });
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded, null, { timeout: 60000 });
await p.waitForTimeout(2500);
/* картки відділу: позиції з зафіксованою ціною 500 × 2 — сума 1000, а в картці замовлення 1 */
await p.evaluate(() => {
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  const at = new Date().toISOString();
  ['5100001', '5100002', '5100003'].forEach(no => { const j = designJobMake(no); j.no = '20' + no.slice(-5);
    j.units = [{ id:'u' + no, gid:'tshirt', name:'Футболка', qty:2, price:500, cost:200, priceGid:'tshirt', priceKind:'', priceAt: at, color:'Чорний', size:'M' }]; });
  window.__W = {};
});
const writes = no => p.evaluate(no => window.__W['kanbanOrders/' + no] || 0, no);

console.log('═══ 1. ЧУЖА КАРТКА — ФОН НЕ ПИШЕ ═══');
await p.evaluate(() => priceLockAll());
await p.waitForTimeout(1500);
const w1 = await p.evaluate(() => Object.assign({}, window.__W));
ok(!w1['kanbanOrders/5100001'] && !w1['kanbanOrders/5100002'] && !w1['kanbanOrders/5100003'], 'фон не записав жодної чужої картки, хоч суми «не ті»', 'фон пише чужі картки: ' + JSON.stringify(w1));
/* знімок: картку змінили на іншому пристрої — і знову нічого */
await p.evaluate(() => { const o = window.__ORDERS[0]; o.rev = 5; o.touchedAt = new Date().toISOString(); window.__DB['kanbanOrders/' + o.id] = JSON.parse(JSON.stringify(o)); window.__ORD_CB(window.__mkSnap(window.__ORDERS, [o])); });
await p.waitForTimeout(2500);
ok(!(await writes('5100001')), 'після чужої зміни (знімок бази) фон картку не переписує', 'після чужого знімка фон переписав картку: ' + await writes('5100001'));

console.log('═══ 2. СВОЯ КАРТКА — ДОВОДИТЬ І ПИШЕ ЛИШЕ ЇЇ ═══');
/* людина щойно натиснула в цій вкладці — і змінила картку */
await p.mouse.click(5, 5);
await p.evaluate(async () => { const o = orders.find(x => x.orderId === '5100002'); touchOrder(o); await priceLockAll(); });
await p.waitForTimeout(1200);
const w2 = await p.evaluate(() => ({ w: Object.assign({}, window.__W), sum: (orders.find(x => x.orderId === '5100002') || {}).totalPrice, db: (window.__DB['kanbanOrders/5100002'] || {}).totalPrice }));
console.log('  ' + JSON.stringify(w2));
ok(w2.sum === 1000 && w2.db === 1000 && w2.w['kanbanOrders/5100002'] === 1, 'своя картка: сума 1000 доведена й записана один раз', 'своя картка: ' + JSON.stringify(w2));
ok(!w2.w['kanbanOrders/5100001'] && !w2.w['kanbanOrders/5100003'], 'решту карток не записано', 'записано зайве: ' + JSON.stringify(w2.w));

console.log('═══ 3. ВІДМОВА ЗА ЛІЧИЛЬНИКОМ — ОДИН ПОВТОР, БЕЗ ВІКНА ═══');
dialogs.length = 0;
const r3 = await p.evaluate(async () => {
  window.__W = {};
  const o = orders.find(x => x.orderId === '5100003');
  /* між нашим читанням і записом хтось записав — база відкидає перший запис */
  window.__DENY['kanbanOrders/5100003'] = 1;
  o.name = 'Нове імʼя'; touchOrder(o);
  const f = await saveOrders();
  return { failed: (f || []).length, w: window.__W['kanbanOrders/5100003'] || 0, name: (window.__DB['kanbanOrders/5100003'] || {}).name, rev: (window.__DB['kanbanOrders/5100003'] || {}).rev };
});
console.log('  ' + JSON.stringify(r3));
ok(r3.failed === 0 && r3.w === 1 && r3.name === 'Нове імʼя' && dialogs.length === 0, 'перший запис відкинуто — повтор ліг, вікна «НЕ ЗБЕРЕЖЕНО» немає', JSON.stringify({ r3, dialogs }));
const r4 = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '5100003');
  window.__DENY['kanbanOrders/5100003'] = 2;
  o.name = 'Ще раз'; touchOrder(o);
  const f = await saveOrders();
  return { failed: (f || []).length };
});
ok(r4.failed === 1 && dialogs.some(d => /НЕ ЗБЕРЕЖЕНО/.test(d)), 'відкинуто й удруге — тоді вже кажемо (одне вікно)', JSON.stringify({ r4, dialogs }));

console.log('═══ 4. СКЛАД КАРТКИ ВІДДІЛУ НЕ СТИРАЄТЬСЯ САМ (#2000452) ═══');
await p.waitForTimeout(4500);                     // людина вже давно нічого не натискала
const r5 = await p.evaluate(async () => {
  const id = '5100001', j = designJobs[id];
  const вБазі0 = ((window.__DB['designJobs/' + id] || {}).units || []).length;
  j.units = [];                                   // стара/автоматична копія без складу
  try{ await designPut(j); }catch(e){ return { err: String(e && e.message || e) }; }
  return { вБазі0, вБазі1: ((window.__DB['designJobs/' + id] || {}).units || []).length, памʼять: (designJobs[id].units || []).length };
});
console.log('  ' + JSON.stringify(r5));
ok(r5.вБазі0 === 1 && r5.вБазі1 === 1 && r5.памʼять === 1, 'автоматичний запис без складу — склад узято з бази, позиція на місці', JSON.stringify(r5));
await p.mouse.click(5, 5);                        // людина сама видаляє останню позицію
const r6 = await p.evaluate(async () => { const id = '5100001', j = designJobs[id]; j.units = []; await designPut(j);
  return { вБазі: ((window.__DB['designJobs/' + id] || {}).units || []).length }; });
ok(r6.вБазі === 0, 'людина видалила останню позицію руками — видаляється, як і доти', JSON.stringify(r6));

console.log('═══ 5. НАКЛАДНА НА B2C-КАРТКУ БЕЗ ОДЯГУ — НІ ═══');
const r7 = await p.evaluate(() => { const o = orders.find(x => x.orderId === '5100001'); const o2 = orders.find(x => x.orderId === '5100002');
  return { без: shipMissing(shipVals(o)), з: shipMissing(shipVals(o2)) }; });
ok(r7.без.some(x => /одяг у замовленні/.test(x)) && !r7.з.some(x => /одяг у замовленні/.test(x)), 'без жодної позиції — «бракує: одяг у замовленні»; з позицією — такого немає', JSON.stringify(r7));

console.log('═══ 6. «СТАН СИСТЕМИ» У ФІНАНСАХ: НЕВДАЧІ Й ПОВТОРИ ЗА ДОБУ ═══');
const r8 = await p.evaluate(() => {
  const kinds = accLogList().map(r => r.kind);
  renderFinHealth();
  const box = document.getElementById('fin-health');
  return { kinds, txt: box ? box.textContent.replace(/\s+/g, ' ') : '' };
});
console.log('  ' + JSON.stringify({ kinds: r8.kinds, txt: r8.txt.slice(0, 200) }));
ok(r8.kinds.indexOf('save-retry') >= 0 && r8.kinds.indexOf('save-fail') >= 0 && r8.kinds.indexOf('units-keep') >= 0,
  'у журналі: повтор запису, невдалий запис, спроба стерти склад', JSON.stringify(r8.kinds));
ok(/Стан системи/.test(r8.txt) && /картка замовлення не записалась · 1 за добу/.test(r8.txt) && /запис відкинула база — повтор/.test(r8.txt) && /стара копія хотіла стерти склад/.test(r8.txt),
  'блок «Стан системи» показує їх власнику', r8.txt.slice(0, 300));

ok(errs.length === 0, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ bg-writes: усі перевірки пройшли');
process.exit(bad ? 1 : 0);
