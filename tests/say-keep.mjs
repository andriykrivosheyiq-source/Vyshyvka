/* ПОВІДОМЛЕННЯ ДИЗАЙНЕРУ НЕ ГУБИТЬСЯ; ПЛАШКИ — УГОРІ (05.11).

   Володимир: «пишеш повідомлення дизайнеру — воно стирається», «по 3–5, а
   інколи 10 разів вставляти, щоб збереглося»; «плашка закриває рядок, де
   набираємо». Доти поле чистилось ДО запису, а запис відкидався, щойно в
   той самий рядок у ту мить писав хтось іще.
     1. Дизайнер відповів саме в ту мить: база не пустила перший запис —
        повідомлення дописано у свіжу картку, лягли обидва, поле порожнє.
     2. База не пускає зовсім: текст лишився в полі, сказано чому.
     3. Набране повертається в поле після перемальовки цілком.
     4. Плашки (toast) — угорі екрана, не над полем набору.

   Запуск:  node tests/say-keep.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9074;
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
  { id:'b1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main', crmChatId:'c1', payments:[], hist:[], createdAt:'2026-10-20T10:00:00.000Z', touchedAt:'2026-10-21T10:00:00.000Z', totalPrice: 1000, items:[] },
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
const ID = '2000301';
await p.evaluate(id => {
  if(!window.LQDesign.ui.host.designFresh) designHostInit();
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = JSON.parse(JSON.stringify(window.__JOBS[id]));
  j.units = [Object.assign(U.unitNew(), { id:'uA', gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, pics:[], graphic:[], stitch:[] })];
  const d = D.dzNew(); D.dzAttach(d, 'test@loomiq', 'test@loomiq'); D.dzSend(d, 'test@loomiq'); d.status = 'work';
  j.units[0].graphic.push(d); j.rev = 3;
  window.__JOBS[id] = JSON.parse(JSON.stringify(j));
  designJobs[id] = j; designSeen[id] = j.updatedAt; designBase[id] = JSON.stringify(j);
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign(); U.setTab('acct'); U.open(id); U.render(document.getElementById('dzRoot'));
}, ID);
await p.waitForTimeout(500);
const KEY = 'uA|graphic|0';
const field = () => p.evaluate(k => { const f = [...document.querySelectorAll('[data-dzsay]')].filter(x => x.getAttribute('data-dzsay') === k)[0]; return f ? f.value : null; }, KEY);
const btn = () => p.evaluate(k => { const f = [...document.querySelectorAll('[data-dzsay]')].filter(x => x.getAttribute('data-dzsay') === k)[0];
  if(!f) return '';
  let a = f.parentNode; for(let i = 0; i < 6 && a; i++, a = a.parentNode){ const b = a.querySelector('[data-do="dz-note"],[data-do="dz-say"],[data-do="dz-reply"]'); if(b) return b.dataset.do; }
  return ''; }, KEY);
const typeIn = async t => { await p.evaluate(({ k, t }) => { const f = [...document.querySelectorAll('[data-dzsay]')].filter(x => x.getAttribute('data-dzsay') === k)[0]; f.focus(); f.value = t; f.dispatchEvent(new Event('input', { bubbles:true })); }, { k: KEY, t }); };
const press = async () => { const what = await btn(); await p.evaluate(({ k, what }) => { const f = [...document.querySelectorAll('[data-dzsay]')].filter(x => x.getAttribute('data-dzsay') === k)[0];
  let a = f.parentNode, b = null; for(let i = 0; i < 6 && a && !b; i++, a = a.parentNode) b = a.querySelector('[data-do="' + what + '"]'); b.click(); }, { k: KEY, what }); await p.waitForTimeout(1500); return what; };
const ok0 = await field();
ok(ok0 !== null, 'у картці акаунта є поле розмови рядка дизайну', 'поля немає');

console.log('═══ 1. ДИЗАЙНЕР ВІДПОВІВ САМЕ В ТУ МИТЬ — ЛЯГЛИ ОБИДВА ═══');
await p.evaluate(() => { window.__TOASTS = [];
  /* Перше читання картки після натиску — і одразу «дизайнер» дописує у той самий рядок (rev +1). */
  window.__ARM = 1; const g0 = Doc0get = null; });
await p.evaluate(id => {
  const proto = Object.getPrototypeOf(DESIGN_COL.doc(id));
  const get0 = proto.get;
  proto.get = function(){ const r = get0.apply(this, arguments);
    if(this.__col === 'designJobs' && window.__ARM && !window.__INUPD){ window.__ARM = 0;
      return r.then(s => { const db = window.__JOBS[id]; db.units[0].graphic[0].thread.push({ at: new Date().toISOString(), by:'p@loomiq', kind:'note', text:'Дизайнер: зараз гляну', seen:['p@loomiq'] });
        db.rev = (+db.rev || 0) + 1; db.updatedAt = new Date(Date.now() + 1000).toISOString(); return s; }); }
    return r; };
}, ID);
await typeIn('Зробіть лого на 2 см менше');
const what1 = await press();
const r1 = await p.evaluate(id => ({ thread: window.__JOBS[id].units[0].graphic[0].thread.map(x => x.text), toasts: window.__TOASTS.slice() }), ID);
const f1 = await field();
console.log('   ' + JSON.stringify({ what1, r1, f1 }));
ok(r1.thread.includes('Дизайнер: зараз гляну') && r1.thread.includes('Зробіть лого на 2 см менше'), 'у базі і відповідь дизайнера, і моє повідомлення', JSON.stringify(r1.thread));
ok(f1 === '' && !r1.toasts.some(t => /повторіть/.test(t)), 'поле порожнє лише тому, що лягло; без «повторіть правку»', JSON.stringify({ f1, t: r1.toasts }));
ok(r1.thread.filter(x => x === 'Зробіть лого на 2 см менше').length === 1, 'моє повідомлення — один раз, не двічі', JSON.stringify(r1.thread));

console.log('═══ 2. БАЗА НЕ ПУСКАЄ — ТЕКСТ ЛИШАЄТЬСЯ В ПОЛІ ═══');
await p.evaluate(() => { window.__TOASTS = []; window.__DENY = 1;
  const proto = Object.getPrototypeOf(DESIGN_COL.doc('x')); const set0 = proto.set;
  proto.set = function(v){ if(window.__DENY && this.__col === 'designJobs') return Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code:'permission-denied' })); return set0.apply(this, arguments); }; });
await typeIn('Колір нитки — бордо');
await press();
const f2 = await field();
const r2 = await p.evaluate(id => ({ thread: window.__JOBS[id].units[0].graphic[0].thread.map(x => x.text), toasts: window.__TOASTS.slice() }), ID);
console.log('   ' + JSON.stringify({ f2, r2 }));
ok(f2 === 'Колір нитки — бордо', 'не лягло — текст лишився в полі', JSON.stringify(f2));
ok(!r2.thread.includes('Колір нитки — бордо') && r2.toasts.some(t => /Текст лишився в полі/.test(t)), 'людині сказано: не надіслано, текст у полі', JSON.stringify(r2.toasts));
await p.evaluate(() => { window.__DENY = 0; });
await press();
const r2b = await p.evaluate(id => window.__JOBS[id].units[0].graphic[0].thread.map(x => x.text), ID);
ok(r2b.includes('Колір нитки — бордо') && (await field()) === '', 'натиснули ще раз — лягло, поле порожнє', JSON.stringify(r2b));

console.log('═══ 3. НАБРАНЕ ПОВЕРТАЄТЬСЯ ПІСЛЯ ПЕРЕМАЛЬОВКИ ЦІЛКОМ ═══');
await typeIn('Чернетка: шрифт жирніший');
await p.evaluate(() => { document.activeElement && document.activeElement.blur(); contentData.noMorph = 1; const r = document.getElementById('dzRoot'); r.innerHTML = ''; window.LQDesign.ui.render(r); delete contentData.noMorph; });
await p.waitForTimeout(200);
ok((await field()) === 'Чернетка: шрифт жирніший', 'картку перемалювали цілком — набране на місці', String(await field()));

console.log('═══ 4. ПЛАШКИ — УГОРІ ═══');
const t4 = await p.evaluate(() => { toast('перевірка'); const t = document.querySelector('.toast'); const cs = t && getComputedStyle(t); const r = t && t.getBoundingClientRect(); return { top: cs && cs.top, y: r && Math.round(r.top), h: innerHeight }; });
ok(t4.top === '16px' && t4.y < 120, 'плашка вгорі екрана, не над полем набору', JSON.stringify(t4));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
