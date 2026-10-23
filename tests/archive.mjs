/* АРХІВ КАРТОК — ЖИВІ ЗАМІСТЬ УСІЄЇ БАЗИ (23.10) — зі стубом бази.

   1. Власник раз розмічає всі картки arch:false (archSeedOnce).
   2. Щоденний прохід: в архів іде завершена картка без руху 30 днів, без
      боргу й непрочитаного; в роботі, свіжа чи з непрочитаним — ні.
   3. Старт тягне лише живі; дошки й чати архівних не показують.
   4. Аналітика/дашборди довантажують архів; змінена архівна картка
      повертається в живі; картка з архіву відкривається за номером з бази.
   5. Розділ «Архів»: список, пошук, відкрити.

   Запуск:  node tests/archive.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9039;
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
const СТАРО = '2026-09-01T10:00:00.000Z', СВІЖО = '2026-10-21T10:00:00.000Z';
const ORDERS = [
  { id:'1', orderId:'1000001', type:'client', dir:'b2b', name:'Завершене давно', status:'done', site:'main', payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 0, items:[] },
  { id:'2', orderId:'1000002', type:'client', dir:'b2b', name:'У роботі давно', status:'kp', site:'main', payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 0, items:[] },
  { id:'3', orderId:'5000301', type:'client', dir:'b2c', name:'Відмова B2C давно', status:'cancel', site:'main', payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 0, items:[] },
  { id:'7', orderId:'5000307', type:'client', dir:'b2c', name:'Відмова B2C з діалогом', status:'cancel', site:'main', crmChatId:'c7', payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 0, items:[] },
  { id:'4', orderId:'1000004', type:'client', dir:'b2b', name:'Завершене свіже', status:'done', site:'main', payments:[], hist:[], createdAt:СТАРО, touchedAt:СВІЖО, totalPrice: 0, items:[] },
  { id:'5', orderId:'1000005', type:'client', dir:'b2b', name:'Завершене, клієнт пише', status:'done', site:'main', crmChatId:'c5', crmUnread: 2, payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 0, items:[] },
  { id:'6', orderId:'1000006', type:'client', dir:'b2b', name:'Завершене, борг', status:'done', site:'main', payments:[], hist:[], createdAt:СТАРО, touchedAt:СТАРО, totalPrice: 500, items:[] }
];
const JOBS = [ { orderId:'5000301', no:'2000301', state:'new', updatedAt:СТАРО, createdAt:СТАРО, units:[], tasks:[], stitch:[], brief:{ text:'', pics:[] }, graphic:{ status:'new' }, client:{}, ds:[] } ];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__JOBS=' + JSON.stringify(JOBS) + ';\n  window.LQ_DB_RETRY_MS=300;\n  window.__DB={kanbanOrders:{},designJobs:{}};\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.LQ_ARCH_QUERY=1;\n  window.firebase={');
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ window.__TAKEN=window.__TAKEN||{}; window.__RES=window.__RES||[]; var t={ get:function(ref){ var no=ref.__id; var d=window.__TAKEN[no]; return Promise.resolve({ exists:!!d, data:function(){ return d; } }); }, set:function(ref,d){ window.__TAKEN[ref.__id]=d; window.__RES.push(ref.__id); } }; return Promise.resolve(f(t)); },")
  .replace("batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },",
  "batch:function(){ return { set:function(ref,d,opt){ (window.__BATCH=window.__BATCH||[]).push({ col:ref.__col, id:ref.__id, d:d }); var src=ref.__col==='kanbanOrders'?window.__ORDERS:ref.__col==='designJobs'?window.__JOBS:null; if(src){ var x=src.filter(function(o){ return (o.id||o.orderId)===ref.__id||o.orderId===ref.__id; })[0]; if(x) Object.assign(x, d); } }, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };')
  .replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var c=this.__col, id=this.__id; var d=(window.__DB[c]||{})[id]||null; return Promise.resolve(new Snap(id, d ? JSON.parse(JSON.stringify(d)) : null)); };")
  .replace("Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };",
  "Col.prototype.get=function(){ var w=this.__w; var src=this.__n==='designJobs'?window.__JOBS:[]; var l=src.filter(function(o){ return !w || o[w[0]]===w[2]; }); return Promise.resolve({ docs:l.map(function(x){ return new Snap(x.orderId||x.id, JSON.parse(JSON.stringify(x))); }), forEach:function(f){ l.forEach(function(x){ f(new Snap(x.orderId||x.id, JSON.parse(JSON.stringify(x)))); }); }, empty:!l.length }); };")
  .replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d,opt){ if(this.__col==='kanbanOrders'||this.__col==='designJobs') (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, d:JSON.parse(JSON.stringify(d)) }); if(this.__col==='loomiq'){ window.__DOCS=window.__DOCS||{}; var k=this.__id; if(!(opt&&opt.merge)){ window.__DOCS[k]=JSON.parse(JSON.stringify(d)); return Promise.resolve(); } window.__DOCS[k]=window.__DOCS[k]||{}; var cur=window.__DOCS[k]; Object.keys(d).forEach(function(f){ if(d[f]&&typeof d[f]==='object'&&!Array.isArray(d[f])&&cur[f]&&typeof cur[f]==='object') Object.assign(cur[f], d[f]); else cur[f]=d[f]; }); } return Promise.resolve(); };")
  .replace("Col.prototype.onSnapshot=function(cb){ try{ cb({ docs:[], forEach:function(){}, empty:true }); }catch(e){} return function(){}; };",
  "Col.prototype.onSnapshot=function(cb, err){ if(this.__n==='designJobs'){ window.__DES={ cb:cb, err:err, n:((window.__DES||{}).n||0)+1 }; try{ cb({ docs:[], forEach:function(f){ window.__JOBS.forEach(function(j){ f(new Snap(j.orderId, JSON.parse(JSON.stringify(j)))); }); }, empty:false }); }catch(e){ console.error(e); } return function(){}; } try{ cb({ docs:[], forEach:function(){}, empty:true }); }catch(e){} return function(){}; };");
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n' +
  '  SeedCol.prototype.pick=function(){ var w=this.__w; return window.__ORDERS.filter(function(o){ return !w || o[w[0]]===w[2]; }); };\n' +
  '  SeedCol.prototype.get=function(){ var l=this.pick(); return Promise.resolve({ docs:l.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }), forEach:function(f){ l.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); }, empty:!l.length }); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb, err){ window.__ORD={ cb:cb, err:err, n:((window.__ORD||{}).n||0)+1 }; var l=this.pick(); try{ cb({\n' +
  '    docs:l.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }),\n' +
  '    forEach:function(f){ l.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

fbstub = fbstub.replace("Col.prototype.where=function(){ return this; };",
  "Col.prototype.where=function(f,op,v){ var c=Object.create(this); c.__w=[f,op,v]; return c; };");
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









const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => { try{ watchDesign(); }catch(e){} });
await ЖДИ(200);

console.log('═══ 1. ВЛАСНИК РАЗ РОЗМІЧАЄ БАЗУ ═══');
const розм = await p.evaluate(async () => {
  const було = archReady();
  await new Promise(r => setTimeout(r, 300));      // archSeedOnce стартує зі знімка замовлень
  return { було, ready: archReady(), seed: contentData.archSeed, всі: window.__ORDERS.every(o => o.arch === false), job: window.__JOBS[0].arch,
    пам: orders.every(o => o.arch === false), n: orders.length };
});
console.log('   ' + JSON.stringify(розм));
ok(розм.ready && розм.seed === 1 && розм.всі && розм.job === false && розм.пам && розм.n === 7,
  'усі картки й картки відділу розмічено arch:false, позначка в документі команди, в памʼяті всі 7', JSON.stringify(розм));

console.log('');
console.log('═══ 2. ЩОДЕННИЙ ПРОХІД: ЩО ДОЗРІЛО — В АРХІВ ═══');
const прох = await p.evaluate(async () => {
  payLoaded = true; payments = [];
  const now = Date.parse('2026-10-23T12:00:00.000Z');
  const pick = {}; orders.forEach(o => { pick[o.orderId] = archPick(o, now); });
  const n = await archSweep(true);                 // лише з force: автоматичний прохід вимкнено
  const auto = await archSweep();
  return { pick, n, auto, db: window.__ORDERS.map(o => o.orderId + ':' + o.arch).join(), job: window.__JOBS[0].arch,
    ids: Object.keys((window.__DOCS['arch'] || {}).ids || {}).sort().join(), archAt: contentData.archAt,
    board: boardPass(orders.find(o => o.orderId === '1000001')), b2c: designOrders().some(o => o.orderId === '5000301'),
    chats: chatsOrders('b2b').some(o => o.orderId === '1000001'), log: accLogList().slice(-1)[0].text };
});
console.log('   ' + JSON.stringify(прох));
ok(прох.pick['1000001'] && прох.pick['5000301'] && !прох.pick['5000307'] && !прох.pick['1000002'] && !прох.pick['1000004'] && !прох.pick['1000005'] && !прох.pick['1000006'],
  'дозріли лише завершене давнє B2B і відмова B2C без діалогу; з діалогом / у роботі / свіже / з непрочитаним / з боргом — ні', JSON.stringify(прох.pick));
ok(прох.n === 2 && /1000001:true/.test(прох.db) && /5000301:true/.test(прох.db) && /1000002:false/.test(прох.db) && прох.job === true &&
   прох.ids === '1000001,5000301' && /^\d{4}-\d{2}-\d{2}$/.test(прох.archAt) && /в архів: 2/.test(прох.log),
  'в архів 2 картки (і картка відділу B2C), номери в loomiq/arch, позначка дня, слід у журналі', JSON.stringify(прох));
ok(!прох.board && !прох.b2c && !прох.chats, 'архівних немає ні на дошці B2B, ні у відділі B2C, ні в чатах', JSON.stringify(прох));
ok(прох.auto === 0, 'без явного archAuto автоматичний прохід нічого не робить', 'auto: ' + прох.auto);

console.log('');
console.log('═══ 3. СТАРТ ТЯГНЕ ЛИШЕ ЖИВІ ═══');
const старт = await p.evaluate(async () => {
  const l = await loadOrders();
  return { n: l.length, nos: l.map(o => o.orderId).sort().join() };
});
console.log('   ' + JSON.stringify(старт));
ok(старт.n === 5 && старт.nos === '1000002,1000004,1000005,1000006,5000307', 'з бази приїхали лише 5 живих карток (з діалогом — жива)', JSON.stringify(старт));

console.log('');
console.log('═══ 4. АНАЛІТИКА ДОВАНТАЖУЄ АРХІВ; ЗМІНЕНА АРХІВНА — ЗНОВУ ЖИВА; З АРХІВУ ЗА НОМЕРОМ ═══');
const дов = await p.evaluate(async () => {
  orders = await loadOrders(); ordersSaved = new Map(orders.map(o => [o.id, JSON.stringify(o)]));
  delete designJobs['5000301']; archLoaded = false;
  const n = await archLoad();
  const r = { n, всі: orders.length, an: anOrders().some(o => o.orderId === '1000001'), job: !!designJobs['5000301'], board: boardPass(orders.find(o => o.orderId === '1000001')) };
  /* змінили архівну — жива */
  window.__SETS = [];
  const a = orders.find(o => o.orderId === '1000001'); a.name = 'Завершене давно (правка)';
  await saveOrders({ quiet: true });
  r.set = (window.__SETS.find(x => x.id === '1') || {}).d; r.arch = a.arch; r.log = accLogList().slice(-1)[0].text;
  /* картки немає в памʼяті — за номером з бази */
  orders = orders.filter(o => o.orderId !== '5000301'); ordersSaved.delete('3'); delete designJobs['5000301'];
  window.__DB.designJobs['5000301'] = window.__JOBS[0];
  const ok1 = await archFetch('5000301');
  r.fetched = ok1 && orders.some(o => o.orderId === '5000301') && !!designJobs['5000301'];
  return r;
});
console.log('   ' + JSON.stringify({ n: дов.n, всі: дов.всі, an: дов.an, job: дов.job, board: дов.board, arch: дов.arch, setArch: дов.set && дов.set.arch, fetched: дов.fetched }));
ok(дов.n === 2 && дов.всі === 7 && дов.an && дов.job && !дов.board, 'архів довантажено: 7 карток у памʼяті, аналітика бачить архівну, дошка — ні', JSON.stringify(дов));
ok(дов.set && дов.set.arch === false && дов.arch === false && /повернулась з архіву/.test(дов.log), 'змінена архівна картка записана живою (arch:false), слід у журналі', JSON.stringify(дов.set && дов.set.arch));
ok(дов.fetched, 'картка, якої немає в памʼяті, береться з бази за номером разом із карткою відділу', JSON.stringify(дов.fetched));

console.log('');
console.log('═══ 5. РОЗДІЛ «АРХІВ» ═══');
const ui = await p.evaluate(async () => {
  await archOpen('b2c');                       // у B2B архів щойно спорожнів (картку змінили → жива)
  const box = document.getElementById('arch-pop');
  const rows0 = box.querySelectorAll('[data-arch-open]').length;
  const q = box.querySelector('[data-arch-q]'); q.value = 'давно'; q.dispatchEvent(new Event('input', { bubbles: true }));
  const rows1 = [...box.querySelectorAll('[data-arch-open]')].map(b => b.dataset.archOpen).join();
  box.querySelector('[data-arch-open]').click();
  await new Promise(r => setTimeout(r, 300));
  return { rows0, rows1, closed: !document.getElementById('arch-pop'), b2bBtn: !!document.getElementById('board-arch'), txt: box.textContent.slice(0, 60) };
});
console.log('   ' + JSON.stringify(ui));
ok(ui.rows0 === 1 && ui.rows1 === '5000301', 'список архіву B2C показує архівну картку, пошук «давно» її знаходить', JSON.stringify(ui));
ok(ui.closed && ui.b2bBtn, 'клік по картці закриває архів і відкриває картку; кнопка «Архів» на дошці B2B є', JSON.stringify(ui));

console.log('');
console.log('═══ 6. РАЗОВЕ ПОВЕРНЕННЯ З АРХІВУ (ПЕРШИЙ ПРОХІД СХОВАВ ДІАЛОГИ) ═══');
const undo = await p.evaluate(async () => {
  delete contentData.archUndo1;
  window.__ORDERS.forEach(o => { if(o.orderId === '5000307' || o.orderId === '5000301') o.arch = true; });
  window.__JOBS[0].arch = true;
  window.__DOCS['arch'] = { ids: { '5000307': 'x', '5000301': 'x' } };
  await archUndoOnce();
  return { all: window.__ORDERS.every(o => o.arch === false), job: window.__JOBS[0].arch, ids: Object.keys(window.__DOCS['arch'].ids || {}).length, flag: contentData.archUndo1, log: accLogList().slice(-1)[0].text };
});
console.log('   ' + JSON.stringify(undo));
ok(undo.all && undo.job === false && undo.ids === 0 && undo.flag === 1 && /повернуто з архіву все/.test(undo.log), 'усе повернуто в живі, список архівних номерів порожній, позначка — щоб не повторювати', JSON.stringify(undo));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'архів: на старті лише живі, архівне — на вимогу, нічого не губиться');
process.exit(bad ? 1 : 0);
