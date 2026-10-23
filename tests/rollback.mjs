/* ВІДКАТ КАРТКИ НА СТАН У МИНУЛОМУ (23.10) — зі стубом бази і підробленим
   REST Firestore (batchGet з readTime).

   1. База віддає стан на дату: поруч «зараз» і «тоді», кнопка «Повернути
      картку відділу» пише той стан у базу.
   2. База відмовляє (PITR не ввімкнено): чесний текст, без здогадів, і
      сліди поза базою — надіслані клієнту ескізи посиланнями.
   3. Невідомий номер — так і сказано.

   Запуск:  node tests/rollback.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9031;
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
    payments:[], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[],
    crmPicsOut:[{ k:'lp1', at:'2026-10-19 12:10', urls:['https://res.cloudinary.com/x/sent1.jpg'], by:'Петро', state:'sent' }] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ window.__TAKEN=window.__TAKEN||{}; window.__RES=window.__RES||[]; var t={ get:function(ref){ var no=ref.__id; var d=window.__TAKEN[no]; return Promise.resolve({ exists:!!d, data:function(){ return d; } }); }, set:function(ref,d){ window.__TAKEN[ref.__id]=d; window.__RES.push(ref.__id); } }; return Promise.resolve(f(t)); },")
  .replace("batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },",
  "batch:function(){ return { set:function(ref,d){ window.__TAKEN=window.__TAKEN||{}; window.__TAKEN[ref.__id]=d; (window.__SEED=window.__SEED||[]).push(ref.__id); }, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },");
fbstub = fbstub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(this.__col==='designJobs') (window.__DSETS=window.__DSETS||[]).push({ id:this.__id, d:d }); return Promise.resolve(); };");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };')
  .replace('Doc.prototype.delete=function(){ return Promise.resolve(); };',
  "Doc.prototype.delete=function(){ if(this.__col==='orderNos'){ window.__TAKEN=window.__TAKEN||{}; delete window.__TAKEN[this.__id]; (window.__FREED=window.__FREED||[]).push(this.__id); } return Promise.resolve(); };")
  .replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(this.__col==='orderNos'){ window.__TAKEN=window.__TAKEN||{}; if(window.__TAKEN[this.__id]) return Promise.reject(Object.assign(new Error('already exists'),{code:'already-exists'})); window.__TAKEN[this.__id]=d; (window.__RES=window.__RES||[]).push(this.__id); } return Promise.resolve(); };");
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
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
let MODE = 'ok';
const S = v => ({ stringValue: String(v) });
const ARR = l => ({ arrayValue: { values: l } });
const MAP = o => ({ mapValue: { fields: o } });
const JOB_THEN = { name: 'projects/loomiq-admin/databases/(default)/documents/designJobs/5000301', fields: {
  orderId: S('5000301'), no: S('2000301'), state: S('approved'), updatedAt: S('2026-10-20T10:00:00.000Z'), approvedVersion: { integerValue: '2' },
  brief: MAP({ text: S('худі з вишивкою'), pics: ARR([]) }),
  units: ARR([ MAP({ id: S('u1'), name: S('Худі'), qty: { integerValue: '1' }, pics: ARR([MAP({ url: S('https://res.cloudinary.com/x/a.jpg'), name: S('a') })]), graphic: ARR([MAP({ n: { integerValue: '1' }, url: S('https://res.cloudinary.com/x/v1.png') })]) }),
               MAP({ id: S('u2'), name: S('Футболка'), qty: { integerValue: '2' }, pics: ARR([MAP({ url: S('https://res.cloudinary.com/x/b.jpg'), name: S('b') })]), graphic: ARR([MAP({ n: { integerValue: '1' }, url: S('https://res.cloudinary.com/x/v2.png') })]) }) ]) } };
const ORD_THEN = { name: 'projects/loomiq-admin/databases/(default)/documents/kanbanOrders/1', fields: {
  id: S('1'), orderId: S('5000301'), dir: S('b2c'), name: S('Асія'), status: S('prorahunok'), touchedAt: S('2026-10-20T10:00:00.000Z'), items: ARR([]) } };
await p.route('**://**', r => {
  const u = r.request().url();
  if(/firestore\.googleapis\.com\/.*documents:batchGet/.test(u)){
    const body = JSON.parse(r.request().postData() || '{}');
    if(MODE === 'err') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Read time is too far in the past. Point-in-time recovery is not enabled for this database.' } }) });
    const out = (body.documents || []).map(n => /designJobs\/5000301$/.test(n) ? { found: JOB_THEN, readTime: body.readTime } : /kanbanOrders\/1$/.test(n) ? { found: ORD_THEN, readTime: body.readTime } : { missing: n });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  }
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });








console.log('═══ 1. БАЗА ВІДДАЄ СТАН НА ДАТУ — «ЗАРАЗ» І «ТОДІ», «ПОВЕРНУТИ» ═══');
const тоді = await p.evaluate(async () => {
  const D = window.LQDesign;
  /* Зараз картка відділу порожня — «впала в нове» */
  const j = D.emptyJob('5000301'); j.no = '2000301'; j.updatedAt = '2026-10-23T08:00:00.000Z'; designJobs['5000301'] = j;
  rb.nos = '2000301\n7777777'; rb.at = '2026-10-20T09:00';
  await rbLook();
  const box = document.getElementById('fin-rollback');
  const cols = [...box.querySelectorAll('.rb-c')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
  return { hidden: box.hidden, err: rb.err, rows: rb.rows.length, cols, back: [...box.querySelectorAll('[data-rb-back]')].map(b => b.textContent),
    unknown: /7777777[^]*не знайдено/.test(box.textContent), pics: [...box.querySelectorAll('.rb-tr a')].map(a => a.href) };
});
console.log('   ' + JSON.stringify(тоді));
ok(!тоді.hidden && !тоді.err && тоді.rows === 2 && /Зараз.*етап new · позицій 0 · картинок 0/.test(тоді.cols[0]) &&
   /На 20\.10 09:00.*етап approved · позицій 2 · картинок 2 · версій макета 2 · погоджена версія 2 · змінено 20\.10/.test(тоді.cols[1]) && /Асія · статус prorahunok · без діалогу/.test(тоді.cols[1]) && /діалог привʼязано/.test(тоді.cols[0]),
  'поруч «Зараз: new, 0 позицій» і «На 20.10 09:00: approved, 2 позиції, 2 картинки, 2 версії, погоджена 2»', JSON.stringify(тоді.cols));
ok(тоді.back.length === 2 && /Повернути картку відділу/.test(тоді.back[0]) && /Повернути й картку замовлення/.test(тоді.back[1]) && тоді.unknown && тоді.pics.join().indexOf('sent1.jpg') >= 0,
  'є «Повернути картку відділу» і «Повернути й картку замовлення»; невідомий 7777777 — «не знайдено»; надісланий ескіз посиланням', JSON.stringify(тоді));
const верн = await p.evaluate(async () => {
  window.__DSETS = [];
  document.querySelector('[data-rb-back="0"][data-rb-what="job"]').click();
  await new Promise(r => setTimeout(r, 400));
  const j = designJobs['5000301'];
  const U = window.LQDesign.ui;
  return { sets: window.__DSETS.map(x => x.id), units: U.unitsOf(j).length, names: U.unitsOf(j).map(u => u.name).join(), state: j.state, appr: j.approvedVersion,
    pic: U.unitsOf(j)[0].pics[0].url, from: j.restoredFrom && j.restoredFrom.had && j.restoredFrom.had.units, log: accLogList().slice(-1)[0].text.slice(0, 60),
    now: document.querySelector('.rb-c').textContent.replace(/\s+/g, ' ') };
});
console.log('   ' + JSON.stringify(верн));
ok(верн.sets.join() === '5000301' && верн.units === 2 && верн.names === 'Худі,Футболка' && верн.state === 'approved' && верн.appr === 2 && /a\.jpg$/.test(верн.pic) && верн.from === 0 && /відкат картки відділу #2000301/.test(верн.log) && /позицій 2 · картинок 2/.test(верн.now),
  '«Повернути»: картка відділу записана в базу станом «тоді» — 2 позиції з картинками, approved, погоджена 2; слід у журналі; «Зараз» оновилось', JSON.stringify(верн));

console.log('');
console.log('═══ 2. PITR НЕ ВВІМКНЕНО — ЧЕСНА ВІДМОВА І СЛІДИ ПОЗА БАЗОЮ ═══');
MODE = 'err';
const відм = await p.evaluate(async () => {
  rb.nos = '2000301'; rb.at = '2026-10-20T09:00';
  await rbLook();
  const box = document.getElementById('fin-rollback');
  return { err: rb.err, back: box.querySelectorAll('[data-rb-back]').length, pics: box.querySelectorAll('.rb-tr a').length, txt: box.textContent.replace(/\s+/g, ' ').slice(0, 400) };
});
console.log('   ' + JSON.stringify(відм));
ok(/не ввімкнено point-in-time recovery, історії в базі немає/.test(відм.err) && /Point-in-time recovery is not enabled/.test(відм.err) && відм.back === 0 && відм.pics === 1,
  'каже прямо: «не ввімкнено point-in-time recovery, історії в базі немає» + відповідь бази; кнопок повернути немає; ескіз посиланням є', JSON.stringify(відм));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'відкат картки читає стан з бази і повертає його');
process.exit(bad ? 1 : 0);
