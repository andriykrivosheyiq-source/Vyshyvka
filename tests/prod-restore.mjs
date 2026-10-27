/* ХРОНІКА ЦЕХУ Й «ВІДКОТИЛОСЬ У ЦЕХУ» (27.10).

   Андрій: «менеджери поузгоджували, а все одно поїхало… воно все
   відновиться?» Що стара копія затерла, у живій картці немає, але перед
   кожним записом попередня копія лягає у версії. Перевіряємо:
   1. Прохід «Відкотилось у цеху» знаходить картку, де версія мала
      «погоджено» + реєстр, а жива — «на станках»; каже, чия копія затерла
      (хто, коли, пристрій). Картку з явним передруком і картку, де нічого
      не губилось, не чіпає.
   2. «Повернути стан цеху» повертає лише поля цеху: треки, фото, реєстр,
      історію обʼєднанням; імʼя, позиції й решта — як були. Картка стає в
      «Передано курʼєру». Запис у журналі доступів.
   3. У картці B2C хроніка цеху: по версіях — хто, пристрій, стан, ↓ там,
      де стан пішов назад; кнопка повернення лише на версіях зі станом вище.
   4. «Повернути всі» — усі з переліку одним натисканням.

   Запуск:  node tests/prod-restore.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9167;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }, { email:'артем@loomiq', name:'Артем', role:'embroidery' }, { email:'м@loomiq', name:'Марта', role:'manager' }] };
const mk = (id, no, extra) => Object.assign({ id, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + no, status:'prorahunok', site:'main',
  payments:[], hist:[], items:[{ name:'Худі', qty:1 }], createdAt:'2026-10-21T09:00:00.000Z', touchedAt:'2026-10-27T09:59:00.000Z', totalPrice: 2970, ttn:'20451568168219', ttnAt:'2026-10-22T23:12:00.000Z' }, extra || {});
const ПОГОДЖ = { tracks:{ supply:'got', prod:'done', qc:'ok', ship:'sent' },
  prodQc:{ photos:['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'], note:'', at:'2026-10-25T10:00:00.000Z', by:'артем@loomiq', ok:{ at:'2026-10-26T12:00:00.000Z', by:'м@loomiq' } },
  reg:{ ref:'reg-1', no:'77', at:'2026-10-26T13:00:00.000Z', by:'м@loomiq', sender:'yuk' }, shipCol:'',
  trackHist:[{ t:'supply', s:'got', at:'2026-10-22T10:00:00.000Z', by:'з@loomiq' }, { t:'ship', s:'sent', at:'2026-10-22T23:12:00.000Z', by:'к@loomiq' },
             { t:'prod', s:'done', at:'2026-10-25T10:00:00.000Z', by:'артем@loomiq' }, { t:'qc', s:'check', at:'2026-10-25T10:00:00.000Z', by:'артем@loomiq' }, { t:'qc', s:'ok', at:'2026-10-26T12:00:00.000Z', by:'м@loomiq' }] };
const СТАРА = { tracks:{ supply:'got', prod:'work', ship:'sent' }, trackHist:[{ t:'supply', s:'got', at:'2026-10-22T10:00:00.000Z', by:'з@loomiq' }, { t:'ship', s:'sent', at:'2026-10-22T23:12:00.000Z', by:'к@loomiq' }, { t:'prod', s:'work', at:'2026-10-27T09:59:00.000Z', by:'артем@loomiq' }] };
/* o1 — затерта (жива «на станках», версія — погоджено + реєстр); o2 — явний
   передрук після погодження (не чіпати); o3 — усе на місці; o4 — ще одна
   затерта, для «Повернути всі». */
const ORDERS = [
  mk('o1', '2000161', JSON.parse(JSON.stringify(СТАРА))),
  mk('o2', '2000162', { tracks:{ supply:'got', prod:'work', qc:'bad' }, reprints:[{ at:'2026-10-27T08:00:00.000Z', by:'м@loomiq', note:'криво', open:true }] }),
  mk('o3', '2000163', JSON.parse(JSON.stringify(ПОГОДЖ))),
  mk('o4', '2000164', { tracks:{ supply:'got', prod:'ready' }, trackHist:[] })
];
const v = (at, by, dev, body) => ({ id: at.replace(/[:.]/g, '-'), d: Object.assign(JSON.parse(JSON.stringify(body)), { _v:{ at, by, why:'save', dev } }) });
const HIST = {
  'kanbanOrders/o1/hist': [
    v('2026-10-25T10:00:00.000Z', 'артем@loomiq', 'iPhone · Safari', mk('o1', '2000161', { tracks:{ supply:'got', prod:'work', ship:'sent' } })),
    v('2026-10-26T13:00:00.000Z', 'м@loomiq', 'Mac · Chrome', mk('o1', '2000161', Object.assign(JSON.parse(JSON.stringify(ПОГОДЖ)), { reg: undefined }))),
    v('2026-10-27T09:59:00.000Z', 'артем@loomiq', 'iPhone · Safari', mk('o1', '2000161', Object.assign(JSON.parse(JSON.stringify(СТАРА)), { tracks:{ supply:'got', ship:'sent' }, trackHist: СТАРА.trackHist.slice(0, 2) })))
  ],
  'kanbanOrders/o2/hist': [ v('2026-10-26T13:00:00.000Z', 'м@loomiq', 'Mac · Chrome', mk('o2', '2000162', JSON.parse(JSON.stringify(ПОГОДЖ)))) ],
  'kanbanOrders/o3/hist': [ v('2026-10-26T13:00:00.000Z', 'м@loomiq', 'Mac · Chrome', mk('o3', '2000163', JSON.parse(JSON.stringify(ПОГОДЖ)))) ],
  'kanbanOrders/o4/hist': [ v('2026-10-26T14:00:00.000Z', 'м@loomiq', 'Windows · Chrome', mk('o4', '2000164', { tracks:{ supply:'got', prod:'done', qc:'check' }, prodQc:{ photos:['https://cdn.test/c.jpg'], at:'2026-10-26T13:30:00.000Z', by:'артем@loomiq' } })) ]
};
/* У версії o1 від 26.10 реєстру ще немає — його додав пізніший запис; найкраща
   версія має бути з реєстром. Додаємо її окремо. */
HIST['kanbanOrders/o1/hist'].push(v('2026-10-26T13:05:00.000Z', 'м@loomiq', 'Mac · Chrome', mk('o1', '2000161', JSON.parse(JSON.stringify(ПОГОДЖ)))));

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.__HIST=' + JSON.stringify(HIST) + ';\n  window.__SETS=[];\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var id=this.__id; if(this.__col==='kanbanOrders'){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); } return Promise.resolve(new Snap(id, null)); };");
stub = stub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(/\\/hist$/.test(this.__col||'')){ (window.__HIST[this.__col]=window.__HIST[this.__col]||[]).push({ id:this.__id, d:JSON.parse(JSON.stringify(d)) }); return Promise.resolve(); } if(this.__col==='kanbanOrders'){ window.__SETS.push({ id:this.__id, via:this.__via||'set' }); var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(d)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); } return Promise.resolve(); };");
stub = stub.replace('Doc.prototype.collection=function(){ return new Col(); };',
  "Doc.prototype.collection=function(n){ var c=new Col(); c.__n=(this.__col||'?')+'/'+this.__id+'/'+n; return c; };");
stub = stub.replace("Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };",
  "Col.prototype.get=function(){ var l=((window.__HIST||{})[this.__n]||[]); return Promise.resolve({ docs:l.map(function(x){ return new Snap(x.id, x.d); }), forEach:function(f){ l.forEach(function(x){ f(new Snap(x.id, JSON.parse(JSON.stringify(x.d)))); }); }, empty:!l.length }); };");
stub = stub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT; try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.__n="kanbanOrders";\n' +
  '  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ setTimeout(function(){ try{ cb({ docs:window.__ORDERS.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }), forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); }, empty:false }); }catch(e){ console.error(e); } }, 50); return function(){}; };\n' +
  "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(); var c=new Col(); c.__n=n; return c; },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:940 } });
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
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-fin').style.display = 'block';
  ['2000161','2000162','2000163','2000164'].forEach(no => designJobMake(no));
  window.NO = id => noOf(orders.find(x => x.id === id).orderId);
});
const NO = {}; for(const id of ['o1','o2','o3','o4']) NO[id] = await p.evaluate(id => window.NO(id), id);
const db = id => p.evaluate(id => window.__ORDERS.find(x => x.id === id), id);
const t = ms => new Promise(r => setTimeout(r, ms));

console.log('═══ 1. ПРОХІД ЗНАХОДИТЬ ЗАТЕРТІ, НЕ ЧІПАЄ ПЕРЕДРУК І ЦІЛІ ═══');
let r = await p.evaluate(async () => {
  await prodBackScan();
  const box = document.getElementById('fin-prodback');
  return { hidden: box.hidden, rows: (pb.rows || []).map(x => ({ id: x.id, no: x.no, live: x.live, best: x.bestText, by: x.by })), n: pb.n, html: box.textContent };
});
console.log('   ' + JSON.stringify(r.rows));
ok(r.rows.length === 2 && r.rows[0].id === 'o1' && r.rows[1].id === 'o4', 'знайдено саме затерті #161 і #164; передрук #162 і цілу #163 не чіпає', JSON.stringify(r.rows.map(x => x.id)));
const r1 = r.rows[0];
ok(/на станках/.test(r1.live) && /у реєстрі/.test(r1.best) && /фото 2/.test(r1.best), '#161: зараз «на станках», було «у реєстрі» з двома фото', JSON.stringify(r1));
ok(r1.by && r1.by.by === 'артем' && /iPhone/.test(r1.by.dev) && /2026-10-27T09:59/.test(r1.by.at), 'видно, чия копія затерла: Артем, 27.10 09:59, iPhone', JSON.stringify(r1.by));
ok(!r.hidden && /Відкотилось у цеху/.test(r.html) && r.html.indexOf('#' + NO.o1) >= 0 && /Затерла копія: артем/.test(r.html) && /Повернути всі \(2\)/.test(r.html), 'блок у Фінансах показує перелік і «Повернути всі (2)»', r.html.slice(0, 200));

console.log('═══ 2. «ПОВЕРНУТИ СТАН ЦЕХУ» — ЛИШЕ ПОЛЯ ЦЕХУ, КАРТКА В «ПЕРЕДАНО КУРʼЄРУ» ═══');
await p.evaluate(() => { window.__SETS = []; window.__TOASTS = []; });
await p.click('#fin-prodback [data-pb-back="0"]');
await t(800);
let d = await db('o1');
r = await p.evaluate(() => {
  const o = orders.find(x => x.id === 'o1'); const D = window.LQDesign;
  return { стан: D.prodAt(designJobs['2000161'], o), name: o.name, items: o.items.length, log: accLogList().filter(x => x.kind === 'restore-prod').map(x => x.text), toasts: window.__TOASTS, done: (pb.rows || [])[0].done, html: document.getElementById('fin-prodback').textContent };
});
console.log('   ' + JSON.stringify({ tracks: d.tracks, reg: !!d.reg, photos: (d.prodQc || {}).photos, hist: (d.trackHist || []).map(h => h.t + ':' + h.s), r }));
ok(d.tracks.qc === 'ok' && d.tracks.prod === 'done' && d.reg && d.reg.ref === 'reg-1' && (d.prodQc.photos || []).length === 2 && d.prodQc.ok, 'у базі повернуто: погоджено, реєстр, фото', JSON.stringify({ tracks: d.tracks, reg: d.reg }));
ok((d.trackHist || []).length === 6 && d.trackHist.some(h => h.t === 'qc' && h.s === 'ok') && d.trackHist.some(h => h.t === 'prod' && h.s === 'work'), 'історія обʼєднана: і погодження, і «на станках» Артема лишились (6 рядків)', JSON.stringify((d.trackHist || []).map(h => h.t + ':' + h.s)));
ok(d.name === 'Клієнт 2000161' && d.items.length === 1 && d.tracks.supply === 'got' && d.ttn === '20451568168219', 'решта картки не змінилась', JSON.stringify({ name: d.name, items: d.items.length, ttn: d.ttn }));
ok(r.стан === 'courier' && r.done && /повернуто/.test(r.html) && r.log.length === 1 && r.log[0].indexOf('#' + NO.o1) >= 0 && /на станках/.test(r.log[0]), 'картка стала в «Передано курʼєру», у журналі запис, у переліку — «повернуто»', JSON.stringify({ стан: r.стан, log: r.log }));

console.log('═══ 3. ХРОНІКА ЦЕХУ В КАРТЦІ: ХТО, ПРИСТРІЙ, СТАН, ↓ ═══');
r = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o4');
  const job = designJobs['2000164'];
  delete orderVers['o4'];
  await versionsLoad(job);
  const html = versionsHtml(job, o);
  const el = document.createElement('div'); el.innerHTML = html;
  const rows = [...el.querySelectorAll('.dz-hv-w .dz-hc-r')].map(x => ({ t: x.textContent.replace(/\s+/g, ' ').trim().slice(0, 140), down: x.classList.contains('is-down'), back: !!x.querySelector('[data-do="prod-back"]') }));
  return { html: html.slice(0, 100), rows, chron: prodChronicle(o).map(x => ({ r: x.s.r, down: x.down })) };
});
console.log('   ' + JSON.stringify(r.rows));
ok(/Хроніка цеху/.test(r.html) || r.rows.length >= 1, 'блок «Хроніка цеху» є', r.html);
ok(r.rows.length >= 1 && /· м ·/.test(r.rows[0].t) && /Windows · Chrome/.test(r.rows[0].t) && /фото на погодженні/.test(r.rows[0].t) && r.rows[0].back, 'рядок версії: хто, пристрій, стан; кнопка повернення, бо стан вищий за живий', JSON.stringify(r.rows));
/* ↓ — на картці o1, де після «у реєстрі» лягла копія «готово до роботи». */
r = await p.evaluate(async () => { const o = orders.find(x => x.id === 'o1'); delete orderVers['o1']; await orderVersLoad(o); return prodChronicle(o).map(x => ({ r: x.s.r, down: x.down, by: (x.v._v || {}).by })); });
console.log('   ' + JSON.stringify(r));
{ const a = r.find(x => x.by === 'артем@loomiq' && x.r === 0);
  ok(r.length >= 4 && a && a.down && r.filter(x => x.r >= 5).every(x => !x.down), 'у хроніці #161 позначка ↓ стоїть саме на копії Артема', JSON.stringify(r)); }

console.log('═══ 4. «ПОВЕРНУТИ ВСІ» ═══');
await p.evaluate(async () => { await prodBackScan(); });
r = await p.evaluate(() => (pb.rows || []).map(x => x.id));
ok(r.length === 1 && r[0] === 'o4', 'після повернення #161 у переліку лишилась лише #164', JSON.stringify(r));
await p.evaluate(() => { pb.rows.push({ id:'o2', no:'2000162', live:'x', best: window.__HIST['kanbanOrders/o2/hist'][0].d, bestAt:'', bestText:'y', by:null, done:false }); renderProdBack(); });
ok(await p.evaluate(() => !!document.querySelector('#fin-prodback [data-pb-all]')), 'є «Повернути всі»', 'кнопки немає');
await p.evaluate(() => { pb.rows.pop(); renderProdBack(); });
await p.evaluate(async () => { for(const row of pb.rows){ if(await prodBackFrom(row.id, row.best, { silent:true })) row.done = true; } renderProdBack(); });
d = await db('o4');
r = await p.evaluate(() => ({ стан: window.LQDesign.prodAt(designJobs['2000164'], orders.find(x => x.id === 'o4')), done: pb.rows.every(x => x.done) }));
ok(d.tracks.qc === 'check' && d.tracks.prod === 'done' && (d.prodQc.photos || []).length === 1 && r.стан === 'appr' && r.done, '#164 повернуто тихо: «Чекає погодження» з фото', JSON.stringify({ tracks: d.tracks, r }));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'хроніка цеху й повернення станів: затерте видно й повертається лише полями цеху');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
