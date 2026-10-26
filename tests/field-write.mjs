/* ЗАПИС ПОЛЯМИ Й ТРИСТОРОННЄ ЗЛИТТЯ (25.10, крок 3) — зі стубом бази.

   Доти картка писалась цілим документом і затирала чужі поля (або запис
   відхилявся — «повторіть правку», і позицію робили ще раз). Тепер:
   1. Правка наявної картки йде update()-ом лише зі зміненими полями.
   2. У базі новіша версія, але змінені ІНШІ поля — зливаємо: чуже в
      памʼять, своє в базу, без «повторіть правку».
   3. Ті самі поля — відхиляємо, як і доти: свіжа в памʼять, людині кажуть.
   4. Нова картка пишеться цілком (set), як і доти.
   5. Вилучене поле прибирається з бази (FieldValue.delete).
   6. Картка відділу (designPut): те саме злиття полями.
   7. На старті пропозиції й Telegram слухаються з вікном за датою.
   8. Сторінка без помилок.

   Запуск:  node tests/field-write.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9143;
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
  '  window.__SETS=[]; var set0=Doc.prototype.set; Doc.prototype.set=function(v){ window.__SETS.push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)), via:this.__via||"set" });\n' +
  '    if(this.__col==="kanbanOrders"){ var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(v)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); }\n' +
  '    if(this.__col==="designJobs"){ window.__JOBS[this.__id]=JSON.parse(JSON.stringify(v)); }\n' +
  '    return set0.apply(this, arguments); };\n' +
  '  var get0=Doc.prototype.get; Doc.prototype.get=function(){ var id=this.__id;\n' +
  '    if(this.__col==="kanbanOrders"){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); }\n' +
  '    if(this.__col==="designJobs"){ var j=window.__JOBS[id]; return Promise.resolve(new Snap(id, j?JSON.parse(JSON.stringify(j)):null)); }\n' +
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
const writes = (id) => p.evaluate(id => (window.__SETS || []).filter(s => s.col === 'kanbanOrders' && s.id === id).map(s => ({ via: s.via, keys: Object.keys(s.v) })), id);
const updates = (id) => p.evaluate(id => (window.__UPDATES || []).filter(u => u.id === id).map(u => u.keys), id);
const reset = () => p.evaluate(() => { window.__SETS = []; window.__UPDATES = []; window.__TOASTS = []; });

console.log('1. Правка наявної картки — лише змінені поля');
await reset();
let r = await p.evaluate(async () => { const o = orders.find(x => x.id === 'o1'); o.note = 'нова нотатка'; touchOrder(o); const f = await saveOrders(); return { failed: (f || []).length, db: window.__ORDERS.find(x => x.id === 'o1') }; });
let up = await updates('o1'), w = await writes('o1');
ok(up.length === 1 && up[0].includes('note') && up[0].includes('touchedAt') && !up[0].includes('name') && !up[0].includes('items'),
   'update лише з полями ' + (up[0] || []).join(', '), 'update: ' + JSON.stringify(up));
ok(!w.some(x => x.via === 'set') && !r.failed, 'цілим документом не писали', 'set: ' + JSON.stringify(w) + ' failed=' + r.failed);
ok(r.db.note === 'нова нотатка' && r.db.name === 'Aisha', 'у базі нова нотатка, решта на місці', 'база: ' + JSON.stringify(r.db));

console.log('2. У базі новіша версія в ІНШИХ полях — злиття без «повторіть правку»');
await reset();
r = await p.evaluate(async () => {
  const db = window.__ORDERS.find(x => x.id === 'o1'); db.mgrEmail = 'kolega@loomiq'; db.touchedAt = '2099-01-01T00:00:00.000Z';   // хтось призначив відповідального
  const o = orders.find(x => x.id === 'o1'); o.note = 'ще новіша'; touchOrder(o);
  const f = await saveOrders();
  return { failed: (f || []).length, mem: { note: o.note, mgr: o.mgrEmail, t: o.touchedAt }, db: window.__ORDERS.find(x => x.id === 'o1'), toasts: window.__TOASTS };
});
up = await updates('o1');
ok(!r.toasts.some(t => /повторіть правку/.test(t)) && !r.failed, 'без «повторіть правку»', 'тости: ' + JSON.stringify(r.toasts) + ' failed=' + r.failed);
ok(up.length === 1 && up[0].includes('note') && !up[0].includes('mgrEmail'), 'у базу пішла лише нотатка: ' + (up[0] || []).join(', '), 'update: ' + JSON.stringify(up));
ok(r.mem.mgr === 'kolega@loomiq' && r.mem.note === 'ще новіша', 'у памʼяті і чужий відповідальний, і своя нотатка', 'памʼять: ' + JSON.stringify(r.mem));
ok(r.db.note === 'ще новіша' && r.db.mgrEmail === 'kolega@loomiq' && r.db.touchedAt > '2099-01-01T00:00:00.000Z', 'у базі обидві зміни, touchedAt новіший за чужий', 'база: ' + JSON.stringify({ note: r.db.note, mgr: r.db.mgrEmail, t: r.db.touchedAt }));

console.log('3. У базі новіша версія в ТОМУ САМОМУ полі — відхилено, як і доти');
await reset();
r = await p.evaluate(async () => {
  const db = window.__ORDERS.find(x => x.id === 'o1'); db.note = 'чужа нотатка'; db.touchedAt = '2099-02-01T00:00:00.000Z';
  const o = orders.find(x => x.id === 'o1'); o.note = 'моя нотатка'; touchOrder(o);
  await saveOrders();
  return { mem: orders.find(x => x.id === 'o1').note, db: window.__ORDERS.find(x => x.id === 'o1').note, toasts: window.__TOASTS };
});
up = await updates('o1');
ok(!up.length && r.db === 'чужа нотатка', 'у базу нічого не пішло, чужа нотатка ціла', 'update: ' + JSON.stringify(up) + ' база: ' + r.db);
ok(r.mem === 'чужа нотатка' && r.toasts.some(t => /повторіть правку/.test(t)), 'у памʼяті свіжа, людині сказано', 'памʼять: ' + r.mem + ' тости: ' + JSON.stringify(r.toasts));

console.log('4. Нова картка — цілим документом, як і доти');
await reset();
r = await p.evaluate(async () => { orders.push({ id:'o9', orderId:'1000150', type:'client', name:'Нова', status:'prorahunok', site:'main', payments:[], hist:[], items:[], createdAt:new Date().toISOString(), touchedAt:new Date().toISOString() }); const f = await saveOrders(); return (f || []).length; });
w = await writes('o9'); up = await updates('o9');
ok(w.length === 1 && w[0].via === 'set' && !up.length && !r, 'set цілком, без update', 'set: ' + JSON.stringify(w) + ' update: ' + JSON.stringify(up) + ' failed=' + r);

console.log('5. Вилучене поле прибирається з бази');
await reset();
r = await p.evaluate(async () => { const o = orders.find(x => x.id === 'o2'); delete o.extra; touchOrder(o); await saveOrders(); return window.__ORDERS.find(x => x.id === 'o2'); });
up = await updates('o2');
ok(up.length === 1 && up[0].includes('extra') && !('extra' in r) && r.note === 'друга', 'extra вилучено, решта ціла', 'update: ' + JSON.stringify(up) + ' база: ' + JSON.stringify(r));

console.log('6. Картка відділу: злиття полями');
await reset();
r = await p.evaluate(async () => {
  const id = '2000301';
  const j = JSON.parse(JSON.stringify(window.__JOBS[id]));
  designJobs[id] = j; designSeen[id] = j.updatedAt; designBase[id] = JSON.stringify(j);
  window.__JOBS[id].tasks = [{ id:'t1', text:'доручення колеги' }]; window.__JOBS[id].updatedAt = '2099-01-01T00:00:00.000Z';   // колега видав доручення
  j.brief.text = 'мій ТЗ'; j.updatedAt = new Date().toISOString();
  const okk = await designPut(j);
  return { okk, mem: { brief: j.brief.text, tasks: (j.tasks || []).length }, db: window.__JOBS[id], toasts: window.__TOASTS };
});
let ju = await p.evaluate(() => (window.__UPDATES || []).filter(u => u.col === 'designJobs').map(u => u.keys));
ok(r.okk === true && !r.toasts.some(t => /повторіть правку/.test(t)), 'записано без «повторіть правку»', 'okk=' + r.okk + ' тости: ' + JSON.stringify(r.toasts));
ok(ju.length === 1 && ju[0].includes('brief') && !ju[0].includes('tasks'), 'у базу лише brief: ' + (ju[0] || []).join(', '), 'update: ' + JSON.stringify(ju));
ok(r.mem.tasks === 1 && r.db.brief.text === 'мій ТЗ' && (r.db.tasks || []).length === 1, 'у памʼяті чуже доручення, у базі обидві зміни', 'памʼять: ' + JSON.stringify(r.mem) + ' база: ' + JSON.stringify({ b: r.db.brief, t: r.db.tasks }));

console.log('6б. Позиції: фіксація з однієї вкладки й «Підтвердити одяг» з іншої — злиття, не «повторіть»');
/* 26.10, відео Паші: «натискав три рази». Обидві вкладки пишуть у `units`,
   але в різні поля однієї позиції. */
await reset();
r = await p.evaluate(async () => {
  const id = '2000301';
  const j = designJobs[id];
  const db = window.__JOBS[id];
  db.units[0].graphic = [{ id:'g1', thread:[{ at:'2026-10-26T18:33:00.000Z', by:'olia@loomiq', text:'Давайте зафіксуємо ваше замовлення' }] }];
  db.updatedAt = '2099-02-01T00:00:00.000Z';
  j.units[0].color = 'Рожевий'; j.units[0].size = 'M'; j.units[0].clothOk = { at:'2026-10-26T18:40:00.000Z', by:'pasha@loomiq' }; j.updatedAt = new Date().toISOString();
  const okk = await designPut(j);
  const d2 = window.__JOBS[id];
  return { okk, toasts: window.__TOASTS, mem: { color: j.units[0].color, thread: ((j.units[0].graphic || [])[0] || {}).thread },
           db: { color: d2.units[0].color, size: d2.units[0].size, clothOk: !!d2.units[0].clothOk, thread: ((d2.units[0].graphic || [])[0] || {}).thread } };
});
ok(r.okk === true && !r.toasts.some(t => /повторіть правку/.test(t)), 'одяг підтверджено з першого разу — без «повторіть правку»', 'okk=' + r.okk + ' тости: ' + JSON.stringify(r.toasts));
ok(r.db.color === 'Рожевий' && r.db.size === 'M' && r.db.clothOk && (r.db.thread || []).length === 1 && (r.mem.thread || []).length === 1,
  'у базі і підтверджений одяг, і повідомлення фіксації; у памʼяті чуже повідомлення теж', JSON.stringify(r));

console.log('6в. Те саме поле позиції з двох вкладок — відхилено, як і доти');
await reset();
r = await p.evaluate(async () => {
  const id = '2000301';
  const j = designJobs[id];
  const db = window.__JOBS[id]; db.units[0].color = 'Синій'; db.updatedAt = '2099-03-01T00:00:00.000Z';
  j.units[0].color = 'Білий'; j.updatedAt = new Date().toISOString();
  const okk = await designPut(j);
  return { okk, toasts: window.__TOASTS, mem: designJobs[id].units[0].color, db: window.__JOBS[id].units[0].color };
});
ok(r.okk === false && r.db === 'Синій' && r.mem === 'Синій' && r.toasts.some(t => /повторіть правку/.test(t)), 'колір з обох вкладок — чуже лишилось, людині сказано', JSON.stringify(r));

console.log('6г. Колега додав позицію, я правив свою — обидві на місці');
await reset();
r = await p.evaluate(async () => {
  const id = '2000301';
  const j = designJobs[id];
  const db = window.__JOBS[id]; db.units.push({ id:'u1', name:'Футболка', qty:2, pics:[], graphic:[] }); db.updatedAt = '2099-04-01T00:00:00.000Z';
  j.units[0].qty = 3; j.updatedAt = new Date().toISOString();
  const okk = await designPut(j);
  const d2 = window.__JOBS[id];
  return { okk, toasts: window.__TOASTS, mem: j.units.map(u => u.id + ':' + u.qty), db: d2.units.map(u => u.id + ':' + u.qty) };
});
ok(r.okk === true && r.db.join() === 'u0:3,u1:2' && r.mem.join() === 'u0:3,u1:2' && !r.toasts.some(t => /повторіть/.test(t)), 'обидві позиції в базі й у памʼяті', JSON.stringify(r));

console.log('7. На старті пропозиції й Telegram — лише з вікном за датою');
r = await p.evaluate(() => (window.__WHERE || []).filter(w => w[0] === 'offers' || w[0] === 'an_tg').map(w => w[0] + ':' + w[1] + w[2]));
ok(r.includes('offers:updatedAt>=') && r.includes('offers:clientAt>=') && r.includes('an_tg:lastAt>='), 'offers (updatedAt, clientAt) і an_tg (lastAt) з вікном', 'where: ' + JSON.stringify(r));

console.log('8. Сторінка без помилок');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));

await browser.close();
srv.close();
console.log(bad ? ('✗ не пройшло: ' + bad) : 'запис полями: чуже не затирається, своє не губиться');
process.exit(bad ? 1 : 0);
