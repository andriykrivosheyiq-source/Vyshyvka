/* СТАН ЦЕХУ НЕ ВІДКОЧУЄТЬСЯ (26.10).

   Володимир: «разів 7 ось ці замовлення фоткав… після оновлень його
   переміщало назад, хоча менеджери давали згоду». Три дороги назад:
   1. Повтор дії на старій картині: на телефоні цеху ще «На станках», а
      менеджер уже погодив — «Готово — фото» перезаписувало «погоджено» на
      «чекає погодження». Тепер дія застосовується лише з того стану, з
      якого її тиснули; інакше — «картку вже рушили далі», показано свіжу.
   2. Годинник пристрою відстає: стара копія проходила перевірку свіжості
      й затирала «погоджено». Тепер свіжість — ще й лічильником записів
      (`rev`), а захищені стани (фото на погодженні, погоджено, у реєстрі,
      фото цеху) жоден запис не знімає, крім явної дії (передрук); спроба
      — у журнал доступів з пристроєм.
   3. Одяг і погодження в одному полі `tracks`: закупівля й менеджер
      відхиляли записи одне одного. Тепер злиття по підключах.

   Запуск:  node tests/prod-state.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9159;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }], accessLog: [] };
const T0 = '2026-10-21T10:00:00.000Z';
const mk = (id, no) => ({ id, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + no, status:'prorahunok', site:'main',
  payments:[], hist:[], items:[], createdAt:'2026-10-20T09:00:00.000Z', touchedAt: T0, tracks:{ supply:'got', prod:'work' }, totalPrice: 1000 });
const ORDERS = [mk('o1', '2000401'), mk('o2', '2000402'), mk('o3', '2000403'), mk('o4', '2000404'), mk('o5', '2000405')];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.__n="kanbanOrders";\n' +
  '  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n' +
  '  var set0=Doc.prototype.set; Doc.prototype.set=function(v){\n' +
  '    if(this.__col==="kanbanOrders"){ var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(v)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); }\n' +
  '    return set0.apply(this, arguments); };\n' +
  '  var get0=Doc.prototype.get; Doc.prototype.get=function(){ var id=this.__id;\n' +
  '    if(this.__col==="kanbanOrders" && window.__GET_FAIL){ window.__GET_FAILS=(window.__GET_FAILS||0)+1; return Promise.reject(new Error("Failed to get document because the client is offline.")); }\n' +
  '    if(this.__col==="kanbanOrders"){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); }\n' +
  '    return get0.apply(this, arguments); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ setTimeout(function(){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } }, 50); return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport:{ width:1400, height:940 } });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.addInitScript(() => { window.LQ_NO_CACHE = 1; });
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded && typeof contentLoaded !== 'undefined' && contentLoaded, null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => {
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  window.__TOASTS = []; const t0 = toast; toast = m => { window.__TOASTS.push(String(m)); try{ t0(m); }catch(e){} };
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign();
  const cat = U.host.catalog().find(x => (x.colors || []).length && (x.sizes || []).length);
  ['2000401','2000402','2000403','2000404','2000405'].forEach(no => {
    const j = designJobMake(no);
    j.units = [Object.assign(U.unitNew(), { gid: cat.id, name: cat.name, color: (cat.colors[0].name || cat.colors[0].id), size: cat.sizes[0], qty: 1, note:'Лого' })];
  });
  U.host.upload = async f => 'https://cdn.test/' + encodeURIComponent(f.name);
  const s0 = U.host.toast; U.host.toast = m => { window.__TOASTS.push(String(m)); try{ s0 && s0(m); }catch(e){} };
});
/* Що лежить у базі й що бачила вкладка: ставимо прямо, щоб відтворити
   «стару картину» на пристрої. */
const db = id => p.evaluate(id => window.__ORDERS.find(x => x.id === id), id);
const setDb = (id, patch) => p.evaluate(([id, patch]) => { const d = window.__ORDERS.find(x => x.id === id); Object.assign(d, patch); return d; }, [id, patch]);
const mem = id => p.evaluate(id => orders.find(x => x.id === id), id);
const toasts = () => p.evaluate(() => { const t = window.__TOASTS.slice(); window.__TOASTS = []; return t; });
const t = ms => new Promise(r => setTimeout(r, ms));
const ПОГОДЖ = { tracks:{ supply:'got', prod:'done', qc:'ok' }, prodQc:{ photos:['https://cdn.test/a.jpg'], note:'', at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq', ok:{ at:'2026-10-21T12:00:00.000Z', by:'менеджер@loomiq' } } };

console.log('═══ 1. ПОВТОР «ГОТОВО — ФОТО» НА ВЖЕ ПОГОДЖЕНІЙ — НЕ ЗНІМАЄ ПОГОДЖЕННЯ ═══');
/* У базі менеджер уже погодив (новіша версія); на телефоні цеху — ще «На станках». */
await setDb('o1', Object.assign({ touchedAt:'2026-10-21T12:00:00.000Z' }, JSON.parse(JSON.stringify(ПОГОДЖ))));
let r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  U.setTab('prod'); U.open('2000401'); U.render(root); await t(200);
  const o = orders.find(x => x.id === 'o1');
  const out = { до: D.prodAt(U.pairOf('2000401').job, o) };
  await U.act('prod-done', root); await t(100);
  const png = await new Promise(res => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(5, 5, 20, 20); c.toBlob(res, 'image/png'); });
  const inp = document.querySelector('#dzProdModal [data-pm-file]:not([data-pm-cam])');
  const dt = new DataTransfer(); dt.items.add(new File([png], 'ok.png', { type:'image/png' }));
  inp.files = dt.files; inp.dispatchEvent(new Event('change')); await t(600);
  document.querySelector('#dzProdModal [data-pm-go]').click(); await t(1500);
  out.вікно = !!document.getElementById('dzProdModal');
  const pr = U.pairOf('2000401');
  out.після = D.prodAt(pr.job, pr.o);
  return out;
});
let d = await db('o1'); let ts = await toasts();
console.log('   ' + JSON.stringify({ r, db: { qc: d.tracks.qc, ok: !!(d.prodQc && d.prodQc.ok), фото: d.prodQc.photos }, ts }));
ok(r.до === 'run' && d.tracks.qc === 'ok' && d.prodQc.ok && d.prodQc.photos[0] === 'https://cdn.test/a.jpg',
  'у базі лишилось «погоджено» з фото менеджера — повтор нічого не перезаписав', JSON.stringify({ qc: d.tracks.qc, ok: !!d.prodQc.ok }));
ok(!r.вікно && r.після === 'ship' && ts.some(x => /вже/.test(x) && /Можна відправляти/.test(x)),
  'цеху сказано «картку вже рушили далі: Можна відправляти», вікно закрито, показано свіжу', JSON.stringify({ в: r.вікно, п: r.після, ts }));

console.log('═══ 2. «ПОГОДЖЕНО» НА ВЖЕ ПЕРЕДРУКОВАНІЙ — НЕ ПОВЕРТАЄ У «МОЖНА ВІДПРАВЛЯТИ» ═══');
await setDb('o2', { touchedAt:'2026-10-21T12:00:00.000Z', tracks:{ supply:'got', prod:'done', qc:'bad' },
  prodQc:{ photos:['https://cdn.test/b.jpg'], at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq' },
  reprints:[{ at:'2026-10-21T12:00:00.000Z', by:'менеджер2@loomiq', blame:'operator', note:'криво', photos:[], qty:{}, n:1, from:'appr', open:true }] });
await p.evaluate(() => { const o = orders.find(x => x.id === 'o2'); o.tracks = { supply:'got', prod:'done', qc:'check' }; o.prodQc = { photos:['https://cdn.test/b.jpg'], at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq' }; ordersSaved.set('o2', JSON.stringify(o)); });
r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  U.setTab('acct'); U.open('2000402'); U.render(root); await t(200);
  const out = { до: D.prodAt(U.pairOf('2000402').job, orders.find(x => x.id === 'o2')) };
  await U.act('prod-ok', root); await t(1200);
  const pr = U.pairOf('2000402'); out.після = D.prodAt(pr.job, pr.o);
  return out;
});
d = await db('o2'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, qc: d.tracks.qc, ok: !!(d.prodQc && d.prodQc.ok), ts }));
ok(r.до === 'appr' && d.tracks.qc === 'bad' && !(d.prodQc && d.prodQc.ok) && r.після === 'redo' && ts.some(x => /вже/.test(x) && /Передрук/.test(x)),
  'у базі лишився передрук другого менеджера; першому сказано «вже рушили далі: Передрук», показано свіжу', JSON.stringify({ r, qc: d.tracks.qc, ts }));

console.log('═══ 3. ГОДИННИК ПРИСТРОЮ ВІДСТАЄ — СТАРА КОПІЯ НЕ ЗНІМАЄ «ПОГОДЖЕНО» ═══');
/* У базі погоджено, але touchedAt СТАРІШИЙ за той, що бачила вкладка (у
   менеджера годинник відстає), а лічильника записів немає (його стерла
   стара вкладка, що пише цілим документом). Закупник на старій картині
   ставить одяг — перевірка свіжості цього не ловить, ловить захист станів. */
await setDb('o3', Object.assign({ touchedAt:'2026-10-21T09:50:00.000Z' }, JSON.parse(JSON.stringify(ПОГОДЖ)), { tracks:{ supply:'part', prod:'done', qc:'ok' } }));
await p.evaluate(() => { delete window.__ORDERS.find(x => x.id === 'o3').rev; });
r = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o3');
  o.tracks = { supply:'part', prod:'work' }; o.touchedAt = '2026-10-21T10:00:00.000Z'; delete o.prodQc; o.rev = 7;
  ordersSaved.set('o3', JSON.stringify(o));
  o.tracks.supply = 'got'; o.trackHist = [{ t:'supply', s:'got', at:'2026-10-21T10:05:00.000Z', by:'закупник@loomiq' }];
  touchOrder(o); await saveOrders();
  return { mem: { tracks: orders.find(x => x.id === 'o3').tracks, ok: !!(orders.find(x => x.id === 'o3').prodQc || {}).ok },
           журнал: accLogList().filter(x => x.kind === 'rollback').map(x => x.text) };
});
d = await db('o3'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, db: { tracks: d.tracks, ok: !!(d.prodQc && d.prodQc.ok), rev: d.rev }, ts }));
ok(d.tracks.qc === 'ok' && d.tracks.prod === 'done' && d.prodQc && d.prodQc.ok && d.tracks.supply === 'got',
  'у базі «погоджено» ціле, одяг закупника записано', JSON.stringify(d.tracks));
ok(r.mem.tracks.qc === 'ok' && r.mem.ok, 'у памʼяті закупника теж уже «погоджено»', JSON.stringify(r.mem));
ok(r.журнал.length === 1 && /#2000003/.test(r.журнал[0]) && /погоджено/.test(r.журнал[0]) && /(Chrome|Safari|iPhone|Android|Windows|Mac|Linux|HeadlessChrome)/.test(r.журнал[0]),
  'спроба відкату — у журналі доступів: номер, що хотіли зняти, пристрій', JSON.stringify(r.журнал));
ok(+d.rev === 8 && !ts.some(x => /повторіть правку/.test(x)), 'лічильник записів виріс до 8, без «повторіть правку»', JSON.stringify({ rev: d.rev, ts }));

console.log('═══ 3б. ЛІЧИЛЬНИК ЗАПИСІВ ЛОВИТЬ НОВІШЕ, ХАЙ БИ ЩО КАЗАВ ГОДИННИК ═══');
/* У базі rev більший (хтось записав), touchedAt — старіший: свіжість
   видно по лічильнику, чуже береться в памʼять, своє зливається. */
await setDb('o3', { touchedAt:'2026-10-21T09:00:00.000Z', rev: 20, note:'від менеджера' });
r = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o3');
  o.mgrEmail = 'з@loomiq'; touchOrder(o); const f = await saveOrders();
  const m = orders.find(x => x.id === 'o3'); return { failed: (f || []).length, note: m.note, mgr: m.mgrEmail, rev: m.rev };
});
d = await db('o3'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, db: { note: d.note, mgr: d.mgrEmail, rev: d.rev }, ts }));
ok(!r.failed && d.note === 'від менеджера' && d.mgrEmail === 'з@loomiq' && +d.rev === 21 && r.note === 'від менеджера' && !ts.some(x => /повторіть/.test(x)),
  'rev 20 у базі → новіше помічено по лічильнику: чужа нотатка в памʼяті, своє записано, rev 21', JSON.stringify({ r, db: { note: d.note, rev: d.rev } }));

console.log('═══ 4. ОДЯГ І ПОГОДЖЕННЯ ОДНОЧАСНО — ЗЛИВАЮТЬСЯ, НЕ ВІДХИЛЯЮТЬСЯ ═══');
/* У базі менеджер щойно погодив (новіша); закупник на картині «на
   погодженні» ставить одяг. Обидва пишуть у `tracks`. */
await setDb('o4', { touchedAt:'2026-10-21T12:00:00.000Z', tracks:{ supply:'part', prod:'done', qc:'ok' },
  prodQc:{ photos:['https://cdn.test/c.jpg'], at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq', ok:{ at:'2026-10-21T12:00:00.000Z', by:'м@loomiq' } },
  trackHist:[{ t:'qc', s:'ok', at:'2026-10-21T12:00:00.000Z', by:'м@loomiq' }] });
r = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o4');
  o.tracks = { supply:'part', prod:'done', qc:'check' }; o.touchedAt = '2026-10-21T11:00:00.000Z';
  o.prodQc = { photos:['https://cdn.test/c.jpg'], at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq' }; o.trackHist = [];
  ordersSaved.set('o4', JSON.stringify(o));
  o.tracks.supply = 'got'; o.trackHist = [{ t:'supply', s:'got', at:'2026-10-21T12:01:00.000Z', by:'закупник@loomiq' }];
  touchOrder(o); const f = await saveOrders();
  const m = orders.find(x => x.id === 'o4');
  return { failed: (f || []).length, mem: { tracks: m.tracks, ok: !!(m.prodQc || {}).ok, hist: (m.trackHist || []).map(h => h.t + ':' + h.s) } };
});
d = await db('o4'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, db: { tracks: d.tracks, hist: (d.trackHist || []).map(h => h.t + ':' + h.s) }, ts }));
ok(!r.failed && !ts.some(x => /повторіть правку/.test(x)), 'без «повторіть правку»', JSON.stringify(ts));
ok(d.tracks.qc === 'ok' && d.tracks.supply === 'got' && d.tracks.prod === 'done' && d.prodQc.ok,
  'у базі і «погоджено» менеджера, і «одяг отримано» закупника', JSON.stringify(d.tracks));
ok((d.trackHist || []).map(h => h.t + ':' + h.s).sort().join() === 'qc:ok,supply:got' && r.mem.tracks.qc === 'ok' && r.mem.ok,
  'історія треків злита (обидва записи), у памʼяті закупника — свіже', JSON.stringify({ h: (d.trackHist || []).map(h => h.t + ':' + h.s), mem: r.mem }));

console.log('═══ 5. ЯВНИЙ ПЕРЕДРУК ЗНІМАЄ «ПОГОДЖЕНО» — ЗАХИСТ НЕ ЗАВАЖАЄ ═══');
await setDb('o5', Object.assign({ touchedAt:'2026-10-21T12:00:00.000Z' }, JSON.parse(JSON.stringify(ПОГОДЖ))));
r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const o = orders.find(x => x.id === 'o5');
  Object.assign(o, JSON.parse(JSON.stringify({ tracks:{ supply:'got', prod:'done', qc:'ok' }, prodQc:{ photos:['https://cdn.test/a.jpg'], note:'', at:'2026-10-21T11:00:00.000Z', by:'цех@loomiq', ok:{ at:'2026-10-21T12:00:00.000Z', by:'менеджер@loomiq' } }, touchedAt:'2026-10-21T12:00:00.000Z' })));
  ordersSaved.set('o5', JSON.stringify(o));
  const pr = U.pairOf('2000405');
  D.prodReprint(pr.job, o, 'м@loomiq', { blame:'operator', note:'клієнт не погодив — криво', from:'appr' });
  touchOrder(o); const f = await saveOrders();
  return { failed: (f || []).length, стан: D.prodAt(pr.job, orders.find(x => x.id === 'o5')), журнал: accLogList().filter(x => x.kind === 'rollback').length };
});
d = await db('o5'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, qc: d.tracks.qc, ts }));
ok(!r.failed && d.tracks.qc === 'bad' && r.стан === 'redo' && r.журнал === 1, 'передрук записано — «погоджено» знято явною дією, у журналі нічого нового', JSON.stringify({ r, qc: d.tracks.qc }));

console.log('═══ 6. БАЗУ НЕ ПРОЧИТАЛИ — НЕ ПИШЕМО; ПОВТОР САМ, КОЛИ ЗВʼЯЗОК Є (27.10, #2000161) ═══');
/* Телефон цеху зі старою картиною (22.10: «готово до роботи») на мить без
   звʼязку: читання перед записом падає. Доти це означало «новішої немає» —
   і стара копія лягала поверх погодженої, стираючи «погоджено» й історію. */
await setDb('o1', Object.assign({ touchedAt:'2026-10-26T12:00:00.000Z', rev: 7, trackHist:[{ t:'prod', s:'done', at:'2026-10-25T10:00:00.000Z', by:'цех@loomiq' }, { t:'qc', s:'ok', at:'2026-10-26T12:00:00.000Z', by:'м@loomiq' }], reg:{ ref:'r1', at:'2026-10-26T13:00:00.000Z', by:'м@loomiq' } }, JSON.parse(JSON.stringify(ПОГОДЖ))));
r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const o = orders.find(x => x.id === 'o1');
  /* Стара картина на цьому пристрої: ні фото, ні погодження, ні реєстру. */
  o.tracks = { supply:'got' }; delete o.prodQc; delete o.reg; o.trackHist = [{ t:'supply', s:'got', at:'2026-10-22T10:00:00.000Z', by:'з@loomiq' }]; o.touchedAt = '2026-10-22T10:00:00.000Z'; delete o.rev;
  ordersSaved.set('o1', JSON.stringify(o));
  window.__SETS = []; window.__UPDATES = []; window.__GET_FAIL = 1; window.__GET_FAILS = 0;
  const pr = U.pairOf('2000401');
  D.prodMove(pr.job, o, 'run', 'артем@loomiq');          // «На станках» зі старої картини
  touchOrder(o); const f = await saveOrders();
  return { failed: (f || []).length, fails: window.__GET_FAILS, writes: window.__SETS.filter(s => s.id === 'o1').length + window.__UPDATES.filter(u => u.id === 'o1').length, timer: !!saveDeferT };
});
d = await db('o1'); ts = await toasts();
console.log('   ' + JSON.stringify({ r, qc: d.tracks.qc, hist: (d.trackHist || []).length, ts }));
ok(r.fails >= 1 && r.writes === 0 && d.tracks.qc === 'ok' && d.reg && (d.trackHist || []).length === 2, 'читання впало — у базу нічого не пішло: «погоджено», реєстр і історія цілі', JSON.stringify({ r, qc: d.tracks.qc, reg: !!d.reg, hist: (d.trackHist || []).length }));
ok(ts.some(x => /Немає звʼязку з базою/.test(x) && /#2000001/.test(x)) && r.timer, 'людині сказано, що не записано; повтор поставлено', JSON.stringify({ ts, timer: r.timer }));
/* Звʼязок повернувся — повтор записує, але вже проти свіжої версії: трек
   «на станках» суперечить «погоджено» в базі → відхилено, у памʼять свіжа. */
r = await p.evaluate(async () => {
  window.__GET_FAIL = 0; clearTimeout(saveDeferT);
  const f = await saveOrders({ quiet:true });
  const o = orders.find(x => x.id === 'o1');
  return { failed: (f || []).length, qc: (o.tracks || {}).qc, hist: (o.trackHist || []).length, стан: window.LQDesign.prodAt(window.LQDesign.ui.pairOf('2000401').job, o) };
});
d = await db('o1');
console.log('   ' + JSON.stringify({ r, dbQc: d.tracks.qc, dbHist: (d.trackHist || []).length }));
ok(d.tracks.qc === 'ok' && (d.trackHist || []).length === 2 && r.qc === 'ok' && r.стан === 'courier', 'після повернення звʼязку стара картина відхилена, на екрані — свіжа «Передано курʼєру»', JSON.stringify({ r, dbQc: d.tracks.qc }));

console.log('═══ 7. СТАНИ ЦЕХУ — ПО ПІДКЛЮЧУ, ІСТОРІЯ — ЛИШЕ ДОПИСОМ (27.10) ═══');
await setDb('o2', Object.assign({ touchedAt:'2026-10-26T12:00:00.000Z', rev: 3, trackHist:[{ t:'prod', s:'done', at:'2026-10-25T10:00:00.000Z', by:'цех@loomiq' }, { t:'qc', s:'ok', at:'2026-10-26T12:00:00.000Z', by:'м@loomiq' }] }, JSON.parse(JSON.stringify(ПОГОДЖ))));
r = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o2');
  Object.assign(o, JSON.parse(JSON.stringify(window.__ORDERS.find(x => x.id === 'o2'))));
  ordersSaved.set('o2', JSON.stringify(o));
  window.__SETS = []; window.__UPDATES = [];
  /* Одяг змінився й історія дописалась; старий рядок історії з памʼяті «загубився». */
  o.tracks.supply = 'part';
  o.trackHist = o.trackHist.slice(1).concat([{ t:'supply', s:'part', at:'2026-10-27T09:00:00.000Z', by:'з@loomiq' }]);
  touchOrder(o); const f = await saveOrders();
  const u = window.__UPDATES.filter(x => x.id === 'o2').map(x => x.keys);
  return { failed: (f || []).length, keys: u.length ? u[u.length - 1] : [], sets: window.__SETS.filter(s => s.id === 'o2' && !s.via).length };
});
d = await db('o2');
console.log('   ' + JSON.stringify({ r, tracks: d.tracks, hist: (d.trackHist || []).map(h => h.t + ':' + h.s) }));
ok(r.keys.indexOf('tracks.supply') >= 0 && r.keys.indexOf('tracks') < 0, 'одяг пішов у базу шляхом «tracks.supply», не цілою картою', JSON.stringify(r.keys));
ok(d.tracks.qc === 'ok' && d.tracks.prod === 'done' && d.tracks.supply === 'part', 'у базі «погоджено» й «готово» лишились, одяг оновлено', JSON.stringify(d.tracks));
ok((d.trackHist || []).length === 3 && d.trackHist[0].t === 'prod', 'історія лише дописалась: старий рядок, якого вкладка не мала, не стерто', JSON.stringify((d.trackHist || []).map(h => h.t + ':' + h.s)));

console.log('═══ 8. СТАТУС НОВОЇ ПОШТИ ГОЛОВНІШИЙ ЗА ГАЛОЧКИ ЦЕХУ; ОПИТУЮТЬСЯ ВСІ КАРТКИ З ТТН (27.10) ═══');
/* Андрій: «в дорозі, прибуло, понад 3 дні у відділенні, виконано, відмова —
   усе по статусу Нової пошти». Погодження затерли — посилка все одно їде. */
r = await p.evaluate(() => {
  const D = window.LQDesign, j = designJobs['2000403'];
  const o = orders.find(x => x.id === 'o3');
  const st = x => D.prodAt(j, Object.assign({}, o, { tracks:{ supply:'got', prod:'work' }, prodQc:null, reg:null, shipCol:'' }, x));
  const now = new Date().toISOString(), давно = new Date(Date.now() - 4 * 864e5).toISOString();
  return { створено: st({ npSt:{ code:'1' } }), дорога: st({ npSt:{ code:'5' } }), прибула: st({ npSt:{ code:'7', arrivedAt: now } }),
    лежить: st({ npSt:{ code:'7', arrivedAt: давно } }), виконано: st({ npSt:{ code:'9' } }), відмова: st({ npSt:{ code:'103' } }),
    передрук: st({ tracks:{ supply:'got', prod:'work', qc:'bad' }, npSt:{ code:'5' } }) };
});
console.log('   ' + JSON.stringify(r));
ok(r.створено === 'run' && r.дорога === 'way' && r.прибула === 'arrived' && r.лежить === 'stuck' && r.виконано === 'done' && r.відмова === 'refused',
  'без «погоджено» й реєстру: ТТН лише створено — «На станках»; далі НП веде: в дорозі → прибуло → понад 3 дні → виконано → відмова', JSON.stringify(r));
ok(r.передрук === 'redo', 'явний передрук лишається передруком', r.передрук);
/* Опитування бере всі картки з ТТН, не лише з реєстром. */
r = await p.evaluate(async () => {
  const o4 = orders.find(x => x.id === 'o4'), o5 = orders.find(x => x.id === 'o5'), o2 = orders.find(x => x.id === 'o2');
  o4.ttn = '20450000000111'; o4.ttnAt = new Date().toISOString(); o4.reg = null; o4.npSt = null; o4.tracks = { supply:'got', prod:'work' }; o4.prodQc = null;
  o5.ttn = '20450000000222'; o5.reg = { ref:'r5', at: new Date().toISOString() }; o5.npSt = null; o5.tracks = { supply:'got', prod:'done', qc:'ok' }; o5.reprints = [];
  o2.ttn = ''; o2.npSt = null;
  ['o2','o4','o5'].forEach(id => { const o = orders.find(x => x.id === id); ordersSaved.set(id, JSON.stringify(o)); const d = window.__ORDERS.find(x => x.id === id); Object.assign(d, JSON.parse(JSON.stringify(o))); });
  window.__NPQ = [];
  const u0 = npUrl, c0 = npCall;
  npUrl = () => 'https://np.test'; npCall = async (op, extra) => { window.__NPQ = (extra.ttns || []).map(t => t.ttn); return { list: (extra.ttns || []).map(t => ({ ttn: t.ttn, code:'5', status:'Відправлення прямує до міста' })) }; };
  npPollAt = 0;
  try{ await prodNpPoll(true); } finally { npUrl = u0; npCall = c0; }
  const D = window.LQDesign;
  return { q: window.__NPQ.slice().sort(), st4: (o4.npSt || {}).code, кол4: D.prodAt(designJobs['2000404'], o4), кол5: D.prodAt(designJobs['2000405'], o5), db4: ((window.__ORDERS.find(x => x.id === 'o4') || {}).npSt || {}).code };
});
console.log('   ' + JSON.stringify(r));
ok(r.q.join() === '20450000000111,20450000000222' && r.st4 === '5' && r.кол4 === 'way' && r.кол5 === 'way' && r.db4 === '5',
  'опитано і картку з реєстром, і без нього; обидві стали «В дорозі», статус записано в базу', JSON.stringify(r));
/* Воркер відмовив (немає ключа) — не в консоль, а над дошкою цеху; «⟳ Статуси
   НП» питає знову (27.10, Андрій: «вчора поїхали, а не в дорозі»). */
r = await p.evaluate(async () => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  const u0 = npUrl, c0 = npCall;
  npUrl = () => 'https://np.test';
  npCall = async () => { throw new Error('Немає ключа API Нової пошти (NP_KEY_<код> або NP_API_KEY)'); };
  const out = {};
  try{
    window.__TOASTS = [];
    await prodNpPoll(true);
    out.err = npPoll.err; out.toast = window.__TOASTS.slice(-1)[0] || '';
    U.setTab('prod'); U.open(''); U.render(root);
    out.напис = ((root.querySelector('.dz-top .dz-np-err') || {}).textContent || '');
    out.кнопка = !!root.querySelector('.dz-top [data-do="np-poll"]');
    /* Ключ зʼявився — кнопка з дошки опитує знову, напис зникає. */
    npCall = async (op, extra) => ({ list: (extra.ttns || []).map(t => ({ ttn: t.ttn, code:'5', status:'Відправлення прямує до міста' })) });
    window.__TOASTS = [];
    root.querySelector('.dz-top [data-do="np-poll"]').click();
    await new Promise(z => setTimeout(z, 600));
    out.після = { err: npPoll.err, okAt: !!npPoll.okAt, напис: ((root.querySelector('.dz-top .dz-np-err') || {}).textContent || ''), toast: window.__TOASTS.slice(-1)[0] || '' };
  } finally { npUrl = u0; npCall = c0; }
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(/Немає ключа API/.test(r.err) && /Статуси Нової пошти не оновились/.test(r.toast) && /не оновлюються: Немає ключа API/.test(r.напис) && r.кнопка,
  'воркер відмовив — над дошкою цеху червоним «статуси НП не оновлюються: …» і кнопка «⟳ Статуси НП»', JSON.stringify(r));
ok(!r.після.err && r.після.okAt && !r.після.напис && /оновлено/.test(r.після.toast),
  '«⟳ Статуси НП» опитує знову — напис зник, «оновлено: опитано …»', JSON.stringify(r.після));

console.log('═══ 9. ЗА КОРДОН: КОЛОНКУ СТАВИТЬ ЦЕХ РУКАМИ, ТАБЛЕТКА, ФІЛЬТР «УКРАЇНА / ЗА КОРДОН» (27.10) ═══');
/* Андрій: «за кордон… вручну перетягнути в будь-який далі статус, бо вони ж
   не оновлюються; статус відмінено також можна». */
r = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const j = designJobs['2000402'], o = orders.find(x => x.id === 'o2');
  o.ttn = ''; o.npSt = null; o.reg = null; o.shipCol = ''; o.tracks = { supply:'got', prod:'done', qc:'ok' }; o.prodQc = { photos:[], at:'2026-10-24T10:00:00.000Z', ok:{ at:'2026-10-24T11:00:00.000Z', by:'m' } };
  o.ship = { abroad: true, abroadTo: 'Польща, Варшава, вул. Тестова 1' };
  const o4 = orders.find(x => x.id === 'o4');                                  // українська з ТТН, у «В дорозі» з §8
  const o3 = orders.find(x => x.id === 'o3');                                  // українська без ТТН, «На станках» — видима колонка
  const out = { старт: D.prodAt(j, o) };
  out.можна = { courier: D.prodCanMove('ship', 'courier', o), refused: D.prodCanMove('ship', 'refused', o), done: D.prodCanMove('ship', 'done', o),
                reg: D.prodCanMove('ship', 'reg', o), назадУРоботу: D.prodCanMove('ship', 'run', o), українська: D.prodCanMove('ship', 'courier', o4) };
  out.кроки = [];
  out.кроки.push(D.prodMove(j, o, 'courier', 'цех'));
  out.кроки.push(D.prodMove(j, o, 'way', 'цех'));
  out.кроки.push(D.prodMove(j, o, 'refused', 'цех'));
  out.кроки.push(D.prodMove(j, o, 'done', 'цех'));
  out.sentAt = !!o.ship.abroadSentAt;
  out.кроки.push(D.prodMove(j, o, 'ship', 'цех'));
  out.sentAt2 = !!o.ship.abroadSentAt;
  out.col = o.ship.abroadCol;
  D.prodMove(j, o, 'courier', 'цех');
  /* Плитка й фільтри на дошці цеху. */
  U.setTab('prod'); U.open(''); U.render(root);
  const tile = () => root.querySelector('.dz-boards [data-open="2000402"]');
  const tile4 = () => root.querySelector('.dz-boards [data-open="2000403"]');
  out.таблетка = ((tile() && tile().querySelector('.dz-c-ab')) || {}).textContent || '';
  out.колонка = tile() ? tile().closest('.dz-col').dataset.col : '';
  const btn = k => root.querySelector('[data-do="prod-geo"][data-geo="' + k + '"]');
  out.фільтри = !!(btn('ua') && btn('ab'));
  btn('ua').click();
  out.лишеУкраїна = { своя: !!tile(), українська: !!tile4(), on: btn('ua').classList.contains('on'), напис: ((root.querySelector('.dz-geo-note') || {}).textContent || '') };
  btn('ab').click();
  out.обидва = { своя: !!tile(), українська: !!tile4() };
  btn('ua').click();
  out.лишеКордон = { своя: !!tile(), українська: !!tile4() };
  root.querySelector('[data-do="prod-geo-off"]').click();
  out.знову = { своя: !!tile(), українська: !!tile4(), напис: !!root.querySelector('.dz-geo-note'), збережено: localStorage.getItem('dzProdGeo') };
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(r.старт === 'ship' && r.можна.courier && r.можна.refused && r.можна.done && r.можна.reg && !r.можна.назадУРоботу && !r.можна.українська,
  'закордонна в «Можна відправляти»; тягнути можна в будь-яку наступну колонку й у «Відмова», назад у роботу — ні; українську з ТТН — як і доти, ні', JSON.stringify({ с: r.старт, м: r.можна }));
ok(r.кроки.join() === 'courier,way,refused,done,ship' && r.sentAt && !r.sentAt2 && r.col === '',
  'стоїть там, куди поставили: курʼєр → в дорозі → відмова → виконано (відправлено) → назад у «Можна відправляти» (відправку знято)', JSON.stringify({ к: r.кроки, s: r.sentAt, s2: r.sentAt2, c: r.col }));
ok(/за кордон/.test(r.таблетка) && r.колонка === 'courier' && r.фільтри,
  'на плитці «✈ за кордон», картка в «Передано курʼєру»; над дошкою фільтри «Україна» / «За кордон»', JSON.stringify({ т: r.таблетка, к: r.колонка, ф: r.фільтри }));
ok(!r.лишеУкраїна.своя && r.лишеУкраїна.українська && r.лишеУкраїна.on && /показано лише «Україна»/.test(r.лишеУкраїна.напис) && r.обидва.своя && r.обидва.українська && r.лишеКордон.своя && !r.лишеКордон.українська && r.знову.своя && r.знову.українська && !r.знову.напис && !r.знову.збережено,
  '«Україна» — лише українські, з написом «показано лише…»; обидва — усі; лише «За кордон» — лише закордонні; «показати всі» — усі; браузер фільтр не памʼятає', JSON.stringify({ u: r.лишеУкраїна, o: r.обидва, k: r.лишеКордон, z: r.знову }));

console.log('═══ 10. РУХ ЦЕХУ ЗІ СТАРОЇ КОПІЇ — НА СВІЖІЙ КАРТЦІ, НЕ ЗЛІТАЄ НАЗАД (28.10) ═══');
/* Оператори: «перетягнув з «Готово до роботи» на «На станках» — злітає
   назад». Картку хвилину тому правив менеджер з іншого пристрою (у базі
   новіша), а вкладка цеху тримає стару копію. */
await setDb('o3', { touchedAt:'2026-10-27T12:00:00.000Z', rev: 3, tracks:{ supply:'got', prod:'ready' }, mgrEmail:'менеджер@loomiq', prodQc: null, npSt: null, reg: null, shipCol:'' });
r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const o = orders.find(x => x.id === 'o3');
  /* Стара копія у вкладці: без правки менеджера, старіший touchedAt. */
  o.tracks = { supply:'got', prod:'ready' }; delete o.mgrEmail; o.touchedAt = '2026-10-21T10:00:00.000Z'; delete o.rev; o.prodQc = null; o.npSt = null; o.reg = null; o.shipCol = '';
  ordersSaved.set('o3', JSON.stringify(o));
  window.__TOASTS = [];
  U.setTab('prod'); U.open('2000403'); U.render(root);
  await new Promise(z => setTimeout(z, 150));
  const out = { до: D.prodAt(designJobs['2000403'], o) };
  await U.act('prod-move', root, { to:'run' });
  await new Promise(z => setTimeout(z, 300));
  const o2 = orders.find(x => x.id === 'o3');
  out.після = D.prodAt(designJobs['2000403'], o2); out.mgr = o2.mgrEmail; out.toast = window.__TOASTS.slice(-1)[0] || '';
  /* Тим часом з іншого пристрою картку вже погодили — хід «на станки» запізнився. */
  const d = window.__ORDERS.find(x => x.id === 'o3');
  d.tracks = { supply:'got', prod:'done', qc:'check' }; d.prodQc = { photos:['x'], at:'2026-10-28T09:00:00.000Z' }; d.touchedAt = '2026-10-28T09:00:00.000Z'; d.rev = 9;
  window.__TOASTS = [];
  await U.act('prod-move', root, { to:'ready' });
  await new Promise(z => setTimeout(z, 300));
  const o3 = orders.find(x => x.id === 'o3');
  out.запізнився = { стан: D.prodAt(designJobs['2000403'], o3), toast: window.__TOASTS.slice(-1)[0] || '' };
  return out;
});
d = await db('o3');
console.log('   ' + JSON.stringify({ r, db: { prod: (d.tracks || {}).prod, mgr: d.mgrEmail, qc: (d.tracks || {}).qc } }));
ok(r.до === 'ready' && r.після === 'run' && r.mgr === 'менеджер@loomiq' && /На станках/.test(r.toast),
  'зі старої копії перетягнули на «На станках» — хід ліг на свіжу картку, правка менеджера ціла, картка не злетіла назад', JSON.stringify({ r: { до: r.до, після: r.після, mgr: r.mgr, toast: r.toast } }));
ok(r.запізнився.стан === 'appr' && /вже рушили/.test(r.запізнився.toast) && d.tracks.qc === 'check',
  'картку тим часом погодили — хід не застосовано, показано свіжу «Чекає погодження»', JSON.stringify({ з: r.запізнився, dbQc: d.tracks.qc }));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'стан цеху не відкочується: повтор, годинник, одночасні записи, збій читання, НП веде колонку');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
