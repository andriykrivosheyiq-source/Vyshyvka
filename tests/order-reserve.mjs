/* БРОНЬ НОМЕРА В АДМІНЦІ (22.10) — зі стубом бази.

   1. Усі наявні номери власник бронює автоматично один раз.
   2. Нова картка: номер зайнятий у базі (чужа бронь) — картка бере
      наступний вільний, і саме він бронюється; картка записується з ним.
   3. Повторний запис тієї самої картки номер не міняє.

   Запуск:  node tests/order-reserve.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9027;
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
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace("runTransaction:function(f){ return Promise.resolve(); },",
  "runTransaction:function(f){ window.__TAKEN=window.__TAKEN||{}; window.__RES=window.__RES||[]; var t={ get:function(ref){ var no=ref.__id; var d=window.__TAKEN[no]; return Promise.resolve({ exists:!!d, data:function(){ return d; } }); }, set:function(ref,d){ window.__TAKEN[ref.__id]=d; window.__RES.push(ref.__id); } }; return Promise.resolve(f(t)); },")
  .replace("batch:function(){ return { set:function(){}, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },",
  "batch:function(){ return { set:function(ref,d){ window.__TAKEN=window.__TAKEN||{}; window.__TAKEN[ref.__id]=d; (window.__SEED=window.__SEED||[]).push(ref.__id); }, update:function(){}, delete:function(){}, commit:function(){ return Promise.resolve(); } }; },");
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
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
console.log('═══ 1. НАЯВНІ НОМЕРИ ЗАБРОНЬОВАНО ОДИН РАЗ ═══');
await p.evaluate(async () => { await orderNosSeedOnce(); });
await ЖДИ(300);
const сід = await p.evaluate(() => ({ seed: (window.__SEED || []).slice().sort(), flag: contentData.orderNosSeed, nos: orders.filter(o => !o.draft).map(o => o.orderId).sort() }));
console.log('   ' + JSON.stringify(сід));
ok(сід.seed.join() === сід.nos.join() && сід.flag === 1, 'кожен номер з дошки має бронь, позначка «зроблено»', JSON.stringify(сід));
const сід2 = await p.evaluate(async () => { window.__SEED = []; await orderNosSeedOnce(); return (window.__SEED || []).length; });
ok(сід2 === 0, 'вдруге не бронює', 'вдруге: ' + сід2);

console.log('');
console.log('═══ 2. НОМЕР ЗАЙНЯТИЙ ЧУЖОЮ БРОННЮ — КАРТКА БЕРЕ НАСТУПНИЙ ═══');
const нова = await p.evaluate(async () => {
  const no = makeOrderId('b2c');
  /* Хтось в іншій вкладці уже забронював цей номер і наступний. */
  window.__TAKEN[String(no)] = { id: 'chuzha-1' }; window.__TAKEN[String(+no + 1)] = { id: 'chuzha-2' };
  window.__RES = [];
  const o = { id: 'new-1', orderId: String(no), type: 'client', dir: 'b2c', name: 'Тест', status: 'prorahunok', site: 'main', items: [], hist: [], createdAt: new Date().toISOString() };
  orders.push(o);
  const failed = await saveOrders({ quiet: true });
  return { хотів: String(no), дали: o.orderId, res: window.__RES.slice(), failed: failed.length, taken: window.__TAKEN[o.orderId] && window.__TAKEN[o.orderId].id };
});
console.log('   ' + JSON.stringify(нова));
ok(+нова.дали === +нова.хотів + 2 && нова.res.join() === нова.дали && нова.taken === 'new-1' && !нова.failed,
  'хотів ' + нова.хотів + ', обидва зайняті — дали ' + нова.дали + ', і саме він заброньований за цією карткою', JSON.stringify(нова));
const знову = await p.evaluate(async () => { const o = orders.find(x => x.id === 'new-1'); o.name = 'Тест 2'; window.__RES = [];
  await saveOrders({ quiet: true }); return { no: o.orderId, res: window.__RES.length }; });
ok(знову.no === нова.дали && знову.res === 0, 'повторний запис тієї ж картки — номер той самий, нових броней немає', JSON.stringify(знову));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'номер бронюється в базі перед записом картки');
process.exit(bad ? 1 : 0);
