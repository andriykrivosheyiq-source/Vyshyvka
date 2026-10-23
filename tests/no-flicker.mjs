/* КАРТКА B2C НЕ БЛИМАЄ (23.10) — зі стубом бази.

   Андрій (відео): «підвисає, блимає». Знімок бази щосекунди перебудовував
   відкриту картку цілком. Тепер фонове оновлення (renderSoft):
   1. вигляд не змінився — сторінку не чіпає (ті самі вузли);
   2. людина пише в полі картки — не перебудовує; вийшла з поля — оновлює;
   3. вміст змінився — оновлює;
   4. дія самої людини (render) малює завжди, як доти.

   Запуск:  node tests/no-flicker.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9045;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'managerb2c' },
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
await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const o = { id:'r1', orderId:'2000901', type:'client', dir:'b2c', name:'Ліна', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', items:[] };
  orders.push(o);
  const j = designJobMake('2000901'); j.no = '2000901';
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x' })];
  designJobs['2000901'] = j;
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
await p.evaluate(async () => {
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000901"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 300));
  window.__panel = () => document.querySelector('#dzRoot .dz-panel');
  window.__p0 = window.__panel();
});

console.log('═══ 1. ЗНІМОК БЕЗ ЗМІН — КАРТКУ НЕ ЧІПАЄМО ═══');
const r1 = await p.evaluate(async () => {
  for(let i = 0; i < 5; i++){ repaintAfterOrdersNow(); openDesign(true); }
  return { same: window.__panel() === window.__p0, open: !!window.__p0 && !window.__p0.classList.contains('hide') };
});
console.log('   ' + JSON.stringify(r1));
ok(r1.open && r1.same, 'п’ять фонових оновлень без змін — відкрита картка та сама (не перебудована, не блимає)', JSON.stringify(r1));

console.log('');
console.log('═══ 2. ЛЮДИНА ПИШЕ В ПОЛІ — НЕ ПЕРЕБУДОВУЄМО ═══');
const r2 = await p.evaluate(async () => {
  const f = window.__panel().querySelector('textarea, input[type="text"], input:not([type])');
  if(!f) return { field: false };
  f.focus();
  designJobs['2000901'].units[0].size = 'L';      // чужа правка, видна в картці, приїхала знімком
  repaintAfterOrdersNow();
  const kept = window.__panel() === window.__p0 && document.activeElement === f;
  f.blur();
  await new Promise(r => setTimeout(r, 2800));
  const pn = window.__panel(); return { field: true, kept, after: pn !== window.__p0 && /\bL\b/.test(pn.textContent) };
});
console.log('   ' + JSON.stringify(r2));
ok(r2.field && r2.kept, 'фокус у полі: чужа зміна не перебудувала картку, курсор лишився в полі', JSON.stringify(r2));
ok(r2.after, 'людина вийшла з поля — за мить картка оновилась сама (розмір L)', JSON.stringify(r2));

console.log('');
console.log('═══ 3. ВМІСТ ЗМІНИВСЯ — ОНОВЛЮЄМО; ДІЯ ЛЮДИНИ — МАЛЮЄ ЗАВЖДИ ═══');
const r3 = await p.evaluate(async () => {
  const p1 = window.__panel();
  designJobs['2000901'].units[0].size = 'XL';
  repaintAfterOrdersNow();
  const changed = window.__panel() !== p1 && /XL/.test(window.__panel().textContent);
  const p2 = window.__panel();
  window.LQDesign.ui.render(document.getElementById('dzRoot'));
  return { changed, forced: window.__panel() !== p2 };
});
console.log('   ' + JSON.stringify(r3));
ok(r3.changed, 'розмір змінився — фонове оновлення показало XL', JSON.stringify(r3));
ok(r3.forced, 'звичайне перемальовування (дія людини) малює завжди', JSON.stringify(r3));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'картка B2C не блимає від фонових оновлень');
process.exit(bad ? 1 : 0);
