/* НЕ ЧИТАЛИ — НЕ ПИШЕМО (23.10) — зі стубом бази.

   1. Підписка на замовлення обірвалась: запис карток вимкнено, червона
      плашка, перепідписка сама; підписка ожила — плашка зникла, запис іде.
   2. У базі картка замовлення новіша за нашу копію: запис відхилено, у
      памʼять узято свіжу, людині сказано повторити.
   3. Те саме для картки відділу (designSave → designPut).
   4. Картки відділу в памʼяті немає, а в базі є: заведення не затирає її.
   5. Обрив підписки відділу — так само плашка й перепідписка.

   Запуск:  node tests/db-link.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9033;
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
  "Doc.prototype.set=function(d){ if(this.__col==='kanbanOrders'||this.__col==='designJobs') (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };")
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

console.log('═══ 1. ПІДПИСКА НА ЗАМОВЛЕННЯ ОБІРВАЛАСЬ — ЗАПИС ВИМКНЕНО, ПЛАШКА, ПЕРЕПІДПИСКА ═══');
const обрив = await p.evaluate(async () => {
  window.__SETS = [];
  const n0 = window.__ORD.n;
  window.__ORD.err(Object.assign(new Error('Quota exceeded.'), { code: 'resource-exhausted' }));
  const o = orders.find(x => x.id === '1'); o.name = 'Асія-правка';
  const failed = await saveOrders({ quiet: false });
  const bar = document.getElementById('db-lost');
  const r = { lost: dbLink.orders.lost, bar: !!bar, barTxt: bar ? bar.textContent.slice(0, 60) : '', failed: failed.length && !!failed[0].link, sets: window.__SETS.length, n0 };
  await new Promise(res => setTimeout(res, 700));           // перепідписка через 300 мс (LQ_DB_RETRY_MS)
  r.n1 = window.__ORD.n; r.lostAfter = dbLink.orders.lost; r.barAfter = !!document.getElementById('db-lost');
  window.__SETS = [];
  const o2 = orders.find(x => x.id === '1'); o2.name = 'Асія-правка-2';
  const failed2 = await saveOrders({ quiet: true });
  r.failed2 = failed2.length; r.sets2 = window.__SETS.map(x => x.col + '/' + x.id).join();
  return r;
});
console.log('   ' + JSON.stringify(обрив));
ok(обрив.lost && обрив.bar && /Звʼязок з базою втрачено/.test(обрив.barTxt) && обрив.failed && обрив.sets === 0,
  'обрив: запис не пішов, червона плашка «Звʼязок з базою втрачено»', JSON.stringify(обрив));
ok(обрив.n1 === обрив.n0 + 1 && !обрив.lostAfter && !обрив.barAfter && обрив.failed2 === 0 && обрив.sets2 === 'kanbanOrders/1',
  'перепідписалась сама, плашка зникла, запис знову йде', JSON.stringify(обрив));

console.log('');
console.log('═══ 2. У БАЗІ КАРТКА НОВІША — ЗАПИС ВІДХИЛЕНО, ВЗЯТО СВІЖУ ═══');
const стара = await p.evaluate(async () => {
  window.__SETS = [];
  const o = orders.find(x => x.id === '1');
  window.__DB.kanbanOrders['1'] = Object.assign(JSON.parse(ordersSaved.get('1')), { name: 'Асія (з телефона)', touchedAt: '2026-10-23T12:00:00.000Z', items: [{ name: 'Худі' }] });
  o.name = 'Асія (стара вкладка)';
  const failed = await saveOrders({ quiet: false });
  const now = orders.find(x => x.id === '1');
  return { failed: failed.length, sets: window.__SETS.length, name: now.name, items: (now.items || []).length, toast: document.getElementById('toast').textContent };
});
console.log('   ' + JSON.stringify(стара));
ok(стара.failed === 0 && стара.sets === 0 && стара.name === 'Асія (з телефона)' && стара.items === 1 && /#2000301 уже змінили з іншого пристрою/.test(стара.toast),
  'стара копія не затерла новішу: нічого не записано, у памʼяті свіжа «Асія (з телефона)», сказано повторити правку', JSON.stringify(стара));

console.log('');
console.log('═══ 3. КАРТКА ВІДДІЛУ В БАЗІ НОВІША — designSave ВІДХИЛЯЄ ═══');
const старJ = await p.evaluate(async () => {
  window.__SETS = [];
  const U = window.LQDesign.ui;
  const j = designJobs['5000301'];
  window.__DB.designJobs['5000301'] = Object.assign(JSON.parse(JSON.stringify(j)), { updatedAt: '2026-10-23T12:00:00.000Z', state: 'approved',
    units: U.unitsOf(j).concat([{ id: 'u9', name: 'Футболка', qty: 2, pics: [], graphic: [] }]) });
  j.state = 'new'; j.units = []; j.updatedAt = '2026-10-23T12:30:00.000Z';   // стара вкладка «щось торкнула»
  let err = '';
  try{ await designSave(j, orders.find(x => x.id === '1')); }catch(e){ err = String(e && e.message || e); }
  const now = designJobs['5000301'];
  return { err, sets: window.__SETS.length, state: now.state, units: U.unitsOf(now).length, dirty: !!designDirty['5000301'], toast: document.getElementById('toast').textContent };
});
console.log('   ' + JSON.stringify(старJ));
ok(/новіша/.test(старJ.err) && старJ.sets === 0 && старJ.state === 'approved' && старJ.units === 2 && !старJ.dirty && /#2000301 уже змінили з іншого пристрою/.test(старJ.toast),
  'картку відділу не затерто: у памʼяті свіжа (approved, 2 позиції), запис відхилено з поясненням', JSON.stringify(старJ));

console.log('');
console.log('═══ 4. КАРТКИ ВІДДІЛУ В ПАМʼЯТІ НЕМАЄ, А В БАЗІ Є — ЗАВЕДЕННЯ НЕ ЗАТИРАЄ ═══');
const невід = await p.evaluate(async () => {
  window.__SETS = [];
  const U = window.LQDesign.ui;
  window.__DB.designJobs['5000302'] = { orderId: '5000302', no: '2000302', state: 'approved', updatedAt: '2026-10-22T12:00:00.000Z', createdAt: '2026-10-18T10:00:00.000Z',
    units: [{ id: 'a', name: 'Худі', qty: 1, pics: [], graphic: [] }, { id: 'b', name: 'Кепка', qty: 1, pics: [], graphic: [] }], tasks: [], stitch: [], brief: { text: 'ТЗ', pics: [] }, graphic: { status: 'done' }, client: {}, ds: [] };
  delete designJobs['5000302'];
  const j = designJobMake('5000302');
  await new Promise(r => setTimeout(r, 400));
  const now = designJobs['5000302'];
  return { ret: !!j, sets: window.__SETS.filter(x => x.id === '5000302').length, units: U.unitsOf(now).length, state: now.state, no: now.no };
});
console.log('   ' + JSON.stringify(невід));
ok(невід.ret && невід.sets === 0 && невід.units === 2 && невід.state === 'approved' && невід.no === '2000302',
  'порожня картка не записалась поверх справжньої: у памʼяті справжня (approved, 2 позиції, №2000302)', JSON.stringify(невід));

console.log('');
console.log('═══ 5. ОБРИВ ПІДПИСКИ ВІДДІЛУ — ПЛАШКА Й ПЕРЕПІДПИСКА ═══');
const обривD = await p.evaluate(async () => {
  const n0 = window.__DES.n;
  window.__DES.err(Object.assign(new Error('Quota exceeded.'), { code: 'resource-exhausted' }));
  const r = { lost: dbLink.design.lost, bar: !!document.getElementById('db-lost') };
  let err = '';
  try{ await designSave(designJobs['5000301'], orders.find(x => x.id === '1')); }catch(e){ err = String(e && e.message || e); }
  r.err = err;
  await new Promise(res => setTimeout(res, 700));
  r.n1 = window.__DES.n; r.lostAfter = dbLink.design.lost; r.barAfter = !!document.getElementById('db-lost'); r.n0 = n0;
  return r;
});
console.log('   ' + JSON.stringify(обривD));
ok(обривD.lost && обривD.bar && /звʼязок з базою втрачено/i.test(обривD.err) && обривD.n1 === обривD.n0 + 1 && !обривD.lostAfter && !обривD.barAfter,
  'обрив підписки відділу: запис відхилено, плашка; перепідписка сама, плашка зникла', JSON.stringify(обривD));

console.log('═══ 6. ВКЛАДКА В НЕРОБОЧОМУ СТАНІ (failed-precondition) — ЗАПИС ВИМКНЕНО ДО ОНОВЛЕННЯ (27.10) ═══');
/* Менеджерка з iPhone: «НЕ ЗБЕРЕЖЕНО: failed-precondition» — кеш кількох
   вкладок втратив «головну» вкладку. Лікує лише перезавантаження: запис
   вимкнено, плашка каже прямо, не «скриншот розробнику». */
const стан = await p.evaluate(async () => {
  window.__SETS = []; window.__ALERTS = []; const a0 = window.alert; window.alert = m => window.__ALERTS.push(String(m));
  const P = Object.getPrototypeOf(ORDERS_COL.doc('1'));
  const upd0 = P.update, set0 = P.set;
  P.update = function(){ return Promise.reject(Object.assign(new Error('The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.'), { code: 'failed-precondition' })); };
  P.set = function(){ return Promise.reject(Object.assign(new Error('The current tab is not in the required state'), { code: 'failed-precondition' })); };
  const o = orders.find(x => x.id === '1'); o.name = 'Асія-правка-3';
  const f1 = await saveOrders({ quiet: false });
  const bar = document.getElementById('db-lost');
  const r = { dead: dbLinkDead(), stale: dbLink.stale, bar: bar ? bar.textContent : '', alert: window.__ALERTS.join(' | '), f1: f1.length };
  P.update = upd0; P.set = set0; window.__SETS = [];
  const o2 = orders.find(x => x.id === '1'); o2.name = 'Асія-правка-4';
  const f2 = await saveOrders({ quiet: true });
  r.f2link = !!(f2.length && f2[0].link); r.sets2 = window.__SETS.length;
  let dz = ''; try{ await designPut({ orderId:'5000301', updatedAt: new Date().toISOString() }); }catch(e){ dz = String(e.message || e); }
  r.dz = dz; r.log = accLogList().filter(x => x.kind === 'dblost').length;
  window.alert = a0;
  return r;
});
console.log('   ' + JSON.stringify(стан));
ok(стан.dead && стан.stale && /втратила звʼязок із базою/.test(стан.bar) && /Оновіть сторінку/.test(стан.bar), 'запис вимкнено, плашка «Оновіть сторінку»', JSON.stringify(стан));
ok(/НЕ ЗБЕРЕЖЕНО: ця вкладка втратила/.test(стан.alert) && !/скриншот/.test(стан.alert), 'людині сказано, що робити, а не «скриншот розробнику»', стан.alert);
ok(стан.f2link && стан.sets2 === 0 && /оновіть сторінку/.test(стан.dz) && стан.log === 1, 'далі ні картка, ні картка відділу в базу не йдуть до оновлення; запис у журналі', JSON.stringify(стан));

console.log('═══ 7. КЕШ БАЗИ: ЗА ЗАМОВЧУВАННЯМ НЕМАЄ; ЛИШЕ ?cache=1 — І БЕЗ СИНХРОНІЗАЦІЇ ВКЛАДОК (27.10) ═══');
{
  const stubP = fbstub.replace("enablePersistence:function(){ return Promise.resolve(); },", "enablePersistence:function(o){ (window.__PERSIST=window.__PERSIST||[]).push(o||{}); return Promise.resolve(); },");
  const open = async (ua, q) => {
    const ctx = await browser.newContext(Object.assign({ viewport:{ width:1200, height:800 } }, ua ? { userAgent: ua } : {}));
    const pg = await ctx.newPage();
    await pg.route('**://**', r => { const u = r.request().url();
      if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: stubP });
      if(u.startsWith(HOST)) return r.continue(); return r.abort(); });
    await pg.goto(HOST + '/loomiqadmin.html' + (q || ''), { waitUntil:'domcontentloaded' });
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(() => window.__PERSIST || []);
    await ctx.close(); return r;
  };
  const комп = await open('');
  const явно = await open('', '?cache=1');
  const тел = await open('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  console.log('   ' + JSON.stringify({ комп, явно, тел }));
  ok(комп.length === 0 && тел.length === 0, 'без ?cache=1 кеш бази не вмикається ні на компʼютері, ні на телефоні', JSON.stringify({ комп, тел }));
  ok(явно.length === 1 && явно[0].synchronizeTabs === false, '?cache=1 — кеш лише в одній вкладці, без синхронізації', JSON.stringify(явно));
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'не читали — не пишемо: стара вкладка нічого не затирає');
process.exit(bad ? 1 : 0);
