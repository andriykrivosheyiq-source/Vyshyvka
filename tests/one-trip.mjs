/* ОДНА ПОЇЗДКА В БАЗУ (05.11, Андрій: «роби перше, друге, третє не роби»).

   1. Дія (jobApply → designFresh) прочитала картку відділу — designPut
      береться за те саме читання, вдруге не читає.
   2. Копія у «Версії» і сама картка — одним пакетом.
   Безпека та сама:
     — хтось записав між читанням і записом: база не пускає (rev), запис іде
       ще раз звичайним шляхом — інші поля зливаються, те саме поле —
       «повторіть правку»; нічого не губиться;
     — старе читання (понад 20 с), читання, після якого прийшов знімок, чи
       вдруге те саме — звичайним шляхом, з читанням;
     — запис без дії (designSave з поля) — як доти, з читанням;
     — вимикач contentData.oneTrip = 0 — усе як доти.
   Стуб бази тримає правило лічильника rev для designJobs.

   Запуск:  node tests/one-trip.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9073;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
const ORDERS = [
  { id:'o1', orderId:'1000148', type:'client', name:'Aisha', status:'prorahunok', site:'main', note:'перша',
    payments:[], hist:[], createdAt:'2026-10-20T20:32:00.000Z', touchedAt:'2026-10-21T10:00:00.000Z', items:[] },
  { id:'o2', orderId:'1000149', type:'client', name:'Борис', status:'prorahunok', site:'main', note:'друга', extra:'зайве',
    payments:[], hist:[], createdAt:'2026-10-20T20:32:00.000Z', touchedAt:'2026-10-21T10:00:00.000Z', items:[] }
];
const JOBS = { '2000301': { orderId:'2000301', no:'2000301', state:'design', updatedAt:'2026-10-20T10:00:00.000Z', createdAt:'2026-10-18T09:00:00.000Z',
  units:[{ id:'u0', name:'Худі', qty:1, pics:[], graphic:[] }], tasks:[], stitch:[], brief:{ text:'', pics:[] }, graphic:{ status:'work' }, client:{}, ds:[] } };

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + '; window.__JOBS=' + JSON.stringify(JOBS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace('Col.prototype.where=function(){ return this; };',
  'Col.prototype.where=function(){ (window.__WHERE=window.__WHERE||[]).push([this.__n].concat([].slice.call(arguments))); return this; };');
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
  '  var upd9=Doc.prototype.update; Doc.prototype.update=function(){ window.__INUPD=1; try{ return upd9.apply(this, arguments); } finally { window.__INUPD=0; } };\n' +
  '  window.__SETS=[]; var set0=Doc.prototype.set; Doc.prototype.set=function(v){ window.__SETS.push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)), via:this.__via||"set" });\n' +
  '    if(this.__col==="kanbanOrders"){ var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(v)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); }\n' +
  '    if(this.__col==="designJobs"){ var was=window.__JOBS[this.__id]; if(was && was.rev!=null && !(+v.rev > +was.rev)) return Promise.reject(Object.assign(new Error("Missing or insufficient permissions."),{code:"permission-denied"})); window.__JOBS[this.__id]=JSON.parse(JSON.stringify(v)); }\n' +
  '    if(!this.__col && v && v._v){ (window.__HIST=window.__HIST||[]).push(JSON.parse(JSON.stringify(v))); }\n' +
  '    return set0.apply(this, arguments); };\n' +
  '  var get0=Doc.prototype.get; Doc.prototype.get=function(){ var id=this.__id;\n' +
  '    if(this.__col==="kanbanOrders"){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); }\n' +
  '    if(this.__col==="designJobs"){ if(!window.__INUPD) window.__JGETS=(window.__JGETS||0)+1; var j=window.__JOBS[id]; return Promise.resolve(new Snap(id, j?JSON.parse(JSON.stringify(j)):null)); }\n' +
  '    return get0.apply(this, arguments); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ setTimeout(function(){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } }, 50); return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => { errs.push('alert: ' + d.message().slice(0, 120)); d.dismiss(); });
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.addInitScript(() => { window.LQ_NO_CACHE = 1; });
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded && typeof contentLoaded !== 'undefined' && contentLoaded, null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => { window.__TOASTS = []; const t0 = toast; toast = m => { window.__TOASTS.push(String(m)); try{ t0(m); }catch(e){} }; });
const H = () => window.LQDesign.ui.host;
const reset = () => p.evaluate(() => { window.__SETS = []; window.__UPDATES = []; window.__TOASTS = []; window.__JGETS = 0; window.__BATCHES = []; window.__HIST = [];
  Object.keys(histAt).forEach(k => delete histAt[k]); delete contentData.oneTrip; });
const ID = '2000301';
await p.evaluate(() => { if(!window.LQDesign.ui.host.designFresh) designHostInit(); });
const prep = () => p.evaluate(id => {
  const j = JSON.parse(JSON.stringify(window.__JOBS[id]));
  j.rev = 7; window.__JOBS[id].rev = 7; window.__JOBS[id].updatedAt = j.updatedAt = '2026-11-01T10:00:00.000Z';
  designJobs[id] = j; designSeen[id] = j.updatedAt; designBase[id] = JSON.stringify(j);
}, ID);
const stat = () => p.evaluate(id => ({ gets: window.__JGETS, batches: window.__BATCHES.slice(), hist: window.__HIST.length,
  db: window.__JOBS[id], toasts: window.__TOASTS.slice(), jUpd: (window.__UPDATES || []).filter(u => u.col === 'designJobs').length }), ID);

console.log('═══ 1. ДІЯ: ОДНЕ ЧИТАННЯ, ОДИН ПАКЕТ ═══');
await reset(); await prep();
let r = await p.evaluate(async id => {
  const j = await window.LQDesign.ui.host.designFresh(id);
  j.brief.text = 'одна поїздка'; j.updatedAt = new Date().toISOString();
  return await designPut(j);
}, ID);
let s = await stat();
console.log('   ' + JSON.stringify({ r, gets: s.gets, batches: s.batches, hist: s.hist, rev: s.db.rev }));
ok(r === true && s.gets === 1, 'картку прочитано один раз (доти — двічі)', 'читань: ' + s.gets);
ok(s.batches.length === 1 && s.batches[0] === 2 && s.hist === 1, 'копія у «Версії» і картка — одним пакетом', JSON.stringify(s.batches) + ' версій ' + s.hist);
ok(s.db.brief.text === 'одна поїздка' && s.db.rev === 8, 'у базі правка, лічильник 7 → 8', JSON.stringify({ b: s.db.brief, rev: s.db.rev }));

console.log('═══ 2. ДРУГА ДІЯ ЗА 10 ХВ — ВЕРСІЇ НЕ ТРЕБА, ОДНЕ ЧИТАННЯ ═══');
await p.evaluate(() => { window.__JGETS = 0; window.__BATCHES = []; window.__HIST = []; });
r = await p.evaluate(async id => {
  const j = await window.LQDesign.ui.host.designFresh(id);
  j.brief.text = 'друга дія'; j.updatedAt = new Date().toISOString();
  return await designPut(j);
}, ID);
s = await stat();
ok(r === true && s.gets === 1 && !s.batches.length && s.hist === 0 && s.jUpd >= 1 && s.db.brief.text === 'друга дія', 'одне читання, звичайний запис полями', JSON.stringify({ gets: s.gets, b: s.batches, hist: s.hist }));

console.log('═══ 3. ХТОСЬ ЗАПИСАВ МІЖ ЧИТАННЯМ І ЗАПИСОМ — ІНШЕ ПОЛЕ: ЗЛИТО, НІЧОГО НЕ ВТРАЧЕНО ═══');
await reset(); await prep();
r = await p.evaluate(async id => {
  const j = await window.LQDesign.ui.host.designFresh(id);
  const db = window.__JOBS[id]; db.tasks = [{ id:'t9', text:'доручення колеги' }]; db.rev = 8; db.updatedAt = '2099-01-01T00:00:00.000Z';   // колега встиг
  j.brief.text = 'моя правка'; j.updatedAt = new Date().toISOString();
  return await designPut(j);
}, ID);
s = await stat();
console.log('   ' + JSON.stringify({ r, gets: s.gets, rev: s.db.rev, tasks: s.db.tasks, brief: s.db.brief, toasts: s.toasts }));
ok(r === true && s.db.brief.text === 'моя правка' && (s.db.tasks || []).length === 1 && s.db.rev > 8, 'база не пустила застарілий запис, далі прочитали й злили: у базі і моя правка, і доручення колеги', JSON.stringify(s.db));
ok(s.gets === 2 && !s.toasts.some(t => /повторіть/.test(t)), 'лише тоді — друге читання; без «повторіть»', JSON.stringify({ gets: s.gets, t: s.toasts }));

console.log('═══ 4. ТЕ САМЕ ПОЛЕ — ЧУЖЕ ЛИШАЄТЬСЯ, ЛЮДИНІ СКАЗАНО ═══');
await reset(); await prep();
r = await p.evaluate(async id => {
  const j = await window.LQDesign.ui.host.designFresh(id);
  const db = window.__JOBS[id]; db.brief = { text:'ТЗ колеги', pics:[] }; db.rev = 8; db.updatedAt = '2099-01-01T00:00:00.000Z';
  j.brief.text = 'моє ТЗ'; j.updatedAt = new Date().toISOString();
  return await designPut(j);
}, ID);
s = await stat();
ok(r === false && s.db.brief.text === 'ТЗ колеги' && s.toasts.some(t => /повторіть правку/.test(t)), 'чуже ТЗ ціле в базі, «повторіть правку», як доти', JSON.stringify({ r, b: s.db.brief, t: s.toasts }));

console.log('═══ 5. СТАРЕ ЧИ ЧУЖЕ ЧИТАННЯ — ЧИТАЄМО ЗНОВУ ═══');
const mode = async (tweak) => { await reset(); await prep(); return p.evaluate(async ({ id, tweak }) => {
  const j = await window.LQDesign.ui.host.designFresh(id);
  if(tweak === 'old') designPre[id].t -= 30000;
  if(tweak === 'snap'){ const v = JSON.parse(designBase[id]); v.note2 = 'зі знімка'; designBase[id] = JSON.stringify(v); }
  if(tweak === 'off') contentData.oneTrip = 0;
  if(tweak === 'twice'){ j.brief.text = 'раз'; j.updatedAt = new Date().toISOString(); await designPut(j); window.__JGETS = 0; }
  j.brief.text = 'правка ' + tweak; j.updatedAt = new Date().toISOString();
  const okk = await designPut(j);
  return { okk, gets: window.__JGETS, batches: window.__BATCHES.slice(), hist: window.__HIST.length, b: window.__JOBS[id].brief.text };
}, { id: ID, tweak }); };
const old = await mode('old'), snap = await mode('snap'), off = await mode('off'), twice = await mode('twice');
console.log('   ' + JSON.stringify({ old, snap, off, twice }));
ok(old.okk && old.gets === 2 && old.b === 'правка old', 'читання старіше 20 с — читаємо знову', JSON.stringify(old));
ok(snap.okk === true && snap.gets === 2, 'після читання прийшов знімок з іншою версією — читаємо знову', JSON.stringify(snap));
ok(twice.okk && twice.gets === 1 && twice.b === 'правка twice', 'те саме читання вдруге не береться — другий запис читає сам', JSON.stringify(twice));
ok(off.okk && off.gets === 2 && !off.batches.length && off.hist === 1 && off.b === 'правка off', 'вимикач oneTrip = 0 — усе як доти: два читання, версія окремим записом', JSON.stringify(off));

console.log('═══ 6. ЗАПИС БЕЗ ДІЇ — ЯК ДОТИ ═══');
await reset(); await prep();
r = await p.evaluate(async id => { const j = designJobs[id]; j.brief.text = 'з поля'; j.updatedAt = new Date().toISOString(); return await designPut(j); }, ID);
s = await stat();
ok(r === true && s.gets === 1 && s.db.brief.text === 'з поля', 'одне читання — своє (звірка), записано', JSON.stringify({ r, gets: s.gets }));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
