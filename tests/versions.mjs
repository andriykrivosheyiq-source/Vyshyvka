/* ВЕРСІЇ КАРТОК У CRM (23.10) — зі стубом бази.

   1. Запис картки відділу лишає попередню копію в hist (раз на 10 хв з
      вкладки); запис картки замовлення — так само.
   2. Список версій і «Повернути цю версію»: картка стає як у версії,
      теперішній стан теж лягає версією («перед поверненням»).
   3. Правила ще не пускають hist — картка все одно пишеться, версії
      тихо вимикаються.
   4. У картці B2C власник бачить згортку «Версії».

   Запуск:  node tests/versions.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9035;
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
  { id:'1', orderId:'5000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T09:00:00.000Z', touchedAt:'2026-10-20T10:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'5000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', touchedAt:'2026-10-20T10:00:00.000Z', totalPrice: 0, items:[] }
];
const JOBS = [ { orderId:'5000301', no:'2000301', state:'design', updatedAt:'2026-10-20T10:00:00.000Z', createdAt:'2026-10-18T09:00:00.000Z', units:[{ id:'u0', name:'Худі', qty:1, pics:[], graphic:[] }], tasks:[], stitch:[], brief:{ text:'', pics:[] }, graphic:{ status:'work' }, client:{}, ds:[] } ];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__JOBS=' + JSON.stringify(JOBS) + ';\n  window.LQ_DB_RETRY_MS=300;\n  window.__DB={kanbanOrders:{},designJobs:{}};\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ window.__TAKEN=window.__TAKEN||{}; window.__RES=window.__RES||[]; var t={ get:function(ref){ var no=ref.__id; var d=window.__TAKEN[no]; return Promise.resolve({ exists:!!d, data:function(){ return d; } }); }, set:function(ref,d){ window.__TAKEN[ref.__id]=d; window.__RES.push(ref.__id); } }; return Promise.resolve(f(t)); },")
  .replace("batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },",
  "batch:function(){ return { set:function(ref,d){ window.__TAKEN=window.__TAKEN||{}; window.__TAKEN[ref.__id]=d; (window.__SEED=window.__SEED||[]).push(ref.__id); }, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };')
  .replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var c=this.__col, id=this.__id; var d=(window.__DB[c]||{})[id]||null; return Promise.resolve(new Snap(id, d ? JSON.parse(JSON.stringify(d)) : null)); };")
  .replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(/\\/hist$/.test(this.__col||'')){ if(window.__HIST_DENY) return Promise.reject(Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'})); (window.__HIST=window.__HIST||{}); (window.__HIST[this.__col]=window.__HIST[this.__col]||[]).push({ id:this.__id, d:JSON.parse(JSON.stringify(d)) }); return Promise.resolve(); } if(this.__col==='kanbanOrders'||this.__col==='designJobs') (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };")
  .replace('Doc.prototype.collection=function(){ return new Col(); };',
  "Doc.prototype.collection=function(n){ var c=new Col(); c.__n=(this.__col||'?')+'/'+this.__id+'/'+n; return c; };")
  .replace("Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };",
  "Col.prototype.get=function(){ var l=((window.__HIST||{})[this.__n]||[]); return Promise.resolve({ docs:l.map(function(x){ return new Snap(x.id, x.d); }), forEach:function(f){ l.forEach(function(x){ f(new Snap(x.id, JSON.parse(JSON.stringify(x.d)))); }); }, empty:!l.length }); };")
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
  '  SeedCol.prototype.onSnapshot=function(cb, err){ window.__ORD={ cb:cb, err:err, n:((window.__ORD||{}).n||0)+1 }; try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); },\n' +
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









const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => { try{ watchDesign(); }catch(e){} });
await ЖДИ(300);

console.log('═══ 1. ЗАПИС ЛИШАЄ ПОПЕРЕДНЮ КОПІЮ ═══');
const зап = await p.evaluate(async () => {
  window.__HIST = {}; window.__SETS = [];
  const j = designJobs['5000301'];
  j.state = 'sketch'; j.updatedAt = new Date().toISOString();
  await designSave(j, orders.find(x => x.id === '1'));
  const h = window.__HIST['designJobs/5000301/hist'] || [];
  j.state = 'client'; j.updatedAt = new Date().toISOString();
  await designSave(j, orders.find(x => x.id === '1'));
  const h2 = window.__HIST['designJobs/5000301/hist'] || [];
  const o = orders.find(x => x.id === '1'); o.name = 'Асія-2';
  await saveOrders({ quiet: true });
  const ho = window.__HIST['kanbanOrders/1/hist'] || [];
  return { n1: h.length, prevState: h[0] && h[0].d.state, why: h[0] && h[0].d._v.why, by: h[0] && h[0].d._v.by, n2: h2.length, sets: window.__SETS.filter(x => x.col === 'designJobs').length,
    no: ho.length, prevName: ho[0] && ho[0].d.name, off: histOff };
});
console.log('   ' + JSON.stringify(зап));
ok(зап.n1 === 1 && зап.prevState === 'design' && зап.why === 'save' && зап.by === 'test@loomiq' && зап.n2 === 1 && зап.sets === 2 && !зап.off,
  'картка відділу: перед записом лягла копія «design» (попередня), другий запис за 10 хв версії не множить, сама картка записана двічі', JSON.stringify(зап));
ok(зап.no === 1 && зап.prevName === 'Асія', 'картка замовлення: перед записом лягла копія з попереднім імʼям «Асія»', JSON.stringify(зап));

console.log('');
console.log('═══ 2. СПИСОК ВЕРСІЙ І «ПОВЕРНУТИ ЦЮ ВЕРСІЮ» ═══');
const верн = await p.evaluate(async () => {
  const j = designJobs['5000301'];
  const l = await versionsLoad(j);
  const html = versionsHtml(j, orders.find(x => x.id === '1'));
  await versionRestore(j, l[0].__id);
  const h = window.__HIST['designJobs/5000301/hist'] || [];
  const now = designJobs['5000301'];
  return { n: l.length, html: /Повернути цю версію/.test(html) && /етап design/.test(html), state: now.state, from: now.restoredFrom && now.restoredFrom.had && now.restoredFrom.had.state,
    hist: h.length, last: h[h.length - 1].d._v.why, lastState: h[h.length - 1].d.state, log: accLogList().slice(-1)[0].text.slice(0, 50), seen: designSeen['5000301'] === now.updatedAt };
});
console.log('   ' + JSON.stringify(верн));
ok(верн.n === 1 && верн.html && верн.state === 'design' && верн.from === 'client' && верн.hist === 2 && верн.last === 'restore' && верн.lastState === 'client' && /повернуто версію картки відділу #2000301/.test(верн.log) && верн.seen,
  'повернуто версію «design»; теперішня «client» лягла версією «перед поверненням»; слід у журналі', JSON.stringify(верн));

console.log('');
console.log('═══ 3. ПРАВИЛА ЩЕ НЕ ПУСКАЮТЬ hist — КАРТКА ПИШЕТЬСЯ, ВЕРСІЇ ТИХО ВИМКНЕНО ═══');
const відм = await p.evaluate(async () => {
  window.__HIST_DENY = true; window.__SETS = []; histOff = false; histAt['j:5000301'] = 0;
  const j = designJobs['5000301']; j.state = 'sketch'; j.updatedAt = new Date().toISOString();
  let err = '';
  try{ await designSave(j, orders.find(x => x.id === '1')); }catch(e){ err = String(e && e.message || e); }
  window.__HIST_DENY = false;
  return { err, sets: window.__SETS.filter(x => x.col === 'designJobs').length, off: histOff, toast: document.getElementById('toast').textContent };
});
console.log('   ' + JSON.stringify(відм));
ok(!відм.err && відм.sets === 1 && відм.off && /Версії карток ще не ввімкнені в базі/.test(відм.toast),
  'відмова правил на hist: картка записана, версії вимкнено, власнику плашка «опублікуйте правила»', JSON.stringify(відм));

console.log('');
console.log('═══ 4. У КАРТЦІ B2C ВЛАСНИК БАЧИТЬ «ВЕРСІЇ» ═══');
const згортка = await p.evaluate(async () => {
  histOff = false;
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="5000301"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 300));
  const h = [...document.querySelectorAll('.dz-panel .dz-z-h')].find(x => /Версії/.test(x.textContent));
  if(h) h.click();                                             // згортка закрита — відкриваємо
  await new Promise(r => setTimeout(r, 300));
  const btn = document.querySelector('.dz-panel [data-do="vers-load"]');
  if(btn) btn.click();
  await new Promise(r => setTimeout(r, 400));
  const back = document.querySelector('.dz-panel [data-do="vers-back"]');
  return { card: !!c, fold: !!h, load: !!btn, back: !!back, rows: document.querySelectorAll('.dz-panel .dz-vers-r').length };
});
console.log('   ' + JSON.stringify(згортка));
ok(згортка.card && згортка.fold && згортка.load && згортка.back && згортка.rows === 2,
  'згортка «Версії» з кнопкою, після «Показати» — дві версії з «Повернути цю версію»', JSON.stringify(згортка));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'версії карток лишаються в базі й повертаються кнопкою');
process.exit(bad ? 1 : 0);
