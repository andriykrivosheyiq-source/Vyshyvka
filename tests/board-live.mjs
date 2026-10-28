/* ДОШКА B2C ОНОВЛЮЄТЬСЯ САМА (22.10).

   Андрій: «статуси не паралельні: в одного оновилось, у другого ще
   лишилось на старому. Вони ж повинні бути всі паралельні». Колонка цеху
   рахується з треків ЗАМОВЛЕННЯ (o.tracks.prod/qc/supply), а вони лежать у
   kanbanOrders. Оператор посунув картку — решті приїжджав лише знімок
   замовлень, а він перемальовував тільки дошку B2B: дошка відділу стояла
   на старому, поки хтось не клацне.

   Запуск:  node tests/board-live.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9001;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'production' },
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
  '  SeedCol.prototype.onSnapshot=function(cb){ var fire=function(){ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }; window.__ORDERS_FIRE=fire; try{ fire(); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');


const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

const де = () => p.evaluate(() => {
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000601"]');
  const col = c && c.closest('.dz-col[data-col]');
  return { col: col ? col.dataset.col : '', seat: LQDesign.ui.tab(),
    view: document.getElementById('view-design').style.display, cards: document.querySelectorAll('#dzRoot .dz-card').length };
});

console.log('═══ 1. ВИРОБНИЧНИК БАЧИТЬ КАРТКУ В «НОВЕ» ═══');
await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const o = { id:'g2000601', orderId:'2000601', type:'client', dir:'b2c', name:'Гліб', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c601', items:[] };
  window.__ORDERS.push(o); orders.push(o);
  const j = designJobMake('2000601'); j.no = '2000601';
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
  j.units = [u];
  j.approvedVersion = 1;                        // графіку погоджено, вишивки немає → цех
  designJobs['2000601'] = j;
  window.__ORDERS_FIRE();                       // знімок замовлень приносить картку
  document.querySelector('.nav button[data-view="design"]').click();
});
await p.waitForTimeout(900);
const s1 = await де();
console.log('   ' + JSON.stringify(s1));
ok(s1.seat === 'prod' && s1.col === 'new', 'дошка цеху, картка 2000601 у «Нове»', JSON.stringify(s1));

console.log('');
console.log('═══ 2. ХТОСЬ ІНШИЙ ПОСУНУВ НА СТАНКИ — У НАС ТЕЖ, БЕЗ ЖОДНОГО КЛІКУ ═══');
await p.evaluate(() => {
  const o = window.__ORDERS.find(x => x.orderId === '2000601');
  o.tracks = { prod:'work' };
  o.trackHist = [{ t:'prod', s:'work', at:new Date().toISOString(), by:'op@loomiq' }];
  window.__ORDERS_FIRE();                       // лише знімок kanbanOrders, designJobs мовчить
});
await p.waitForTimeout(900);
const s2 = await де();
console.log('   ' + JSON.stringify(s2));
ok(s2.col === 'run', 'картка сама перейшла в «На станках»', JSON.stringify(s2));
ok(s2.view === 'block' && s2.seat === 'prod', 'людину нікуди не перекинуло: той самий розділ, та сама дошка', JSON.stringify(s2));

console.log('');
console.log('═══ 3. І НАЗАД: «ГОТОВО ДО РОБОТИ» — ТЕЖ ОДРАЗУ ═══');
await p.evaluate(() => {
  const o = window.__ORDERS.find(x => x.orderId === '2000601');
  o.tracks = { prod:'ready' };
  window.__ORDERS_FIRE();
});
await p.waitForTimeout(900);
const s3 = await де();
ok(s3.col === 'ready', 'картка в «Готово до роботи»', JSON.stringify(s3));

console.log('═══ 4. ЗВІРКА ГРОШЕЙ ПЕРЕМАЛЬОВУЄТЬСЯ ЗІ ЗНІМКОМ (28.10) ═══');
/* Андрій: «опять пропали… частина «платіж привʼязаний до замовлення, якого
   немає»» — після оновлення сторінки картки відділу доїжджали пізніше, а
   Звірка не перемальовувалась. */
const зв = await p.evaluate(async () => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  const v = document.getElementById('view-fin'); v.style.display = 'block';
  window.__FA = 0; const f0 = renderFinAudit; renderFinAudit = function(){ window.__FA++; return f0.apply(this, arguments); };
  repaintAfterOrdersNow();
  const a = window.__FA;
  finAuditRefresh(); await new Promise(r => setTimeout(r, 700));
  const b = window.__FA;
  v.style.display = 'none'; finAuditRefresh(); await new Promise(r => setTimeout(r, 700));
  renderFinAudit = f0;
  return { a, b, c: window.__FA };
});
ok(зв.a === 1 && зв.b === 2 && зв.c === 2, 'знімок замовлень і знімок карток відділу перемальовують Звірку, коли відкриті Фінанси; закриті — ні', JSON.stringify(зв));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'дошка B2C у всіх однакова — знімок замовлень перемальовує і її; Звірка теж');
process.exit(bad ? 1 : 0);
