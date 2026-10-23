/* ШПИЛЬКА ВЛАСНИКА (23.10) — зі стубом бази.

   1. Власник тягне картку в будь-яку колонку: вона стає туди і стоїть
      (chainAt), на плитці 📌, у картці «вручну · хто» і «зняти».
   2. «Зняти» — картка знову стоїть за роботою; обидві події в історії.
   3. Менеджер B2C: тягнути можна лише дозволені переходи, шпильки немає.

   Запуск:  node tests/owner-pin.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9037;
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
  window.confirm = () => true;
  const D = window.LQDesign, U = D.ui;
  const заведи = (id, nick) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:nick, status:'prorahunok', site:'main',
      payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[{ s:'prorahunok', at:'2026-10-18T09:00:00.000Z' }],
      createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[] };
    orders.push(o);
    const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u];
    const g = D.dzNew(); g.who = 'p@loomiq'; g.sentAt = new Date().toISOString(); g.status = 'work'; D.dzList(u, 'graphic').push(g);
    designJobs[id] = j;
    return o;
  };
  заведи('2000901', 'Ліна');
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const колонка = id => p.evaluate(id => { const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]');
  const col = c && c.closest('.dz-col[data-col]'); return col ? col.dataset.col : ''; }, id);
/* Перетягування: dragstart на обгортці картки → drop на колонку. */
const тягни = (id, to) => p.evaluate(({ id, to }) => {
  const root = document.getElementById('dzRoot');
  const c = root.querySelector('.dz-card[data-open="' + id + '"]'); if(!c) return { err: 'немає картки' };
  const w = c.closest('.dz-card-w') || c;
  if(!w.ondragstart) return { draggable: false };
  w.ondragstart({ dataTransfer: { setData(){}, effectAllowed: '' } });
  const canDrop = [...root.querySelectorAll('.dz-col.can-drop')].map(k => k.dataset.col);
  const k = root.querySelector('.dz-col[data-col="' + to + '"]');
  if(!k || !k.ondrop) return { draggable: true, canDrop, err: 'немає колонки' };
  k.ondrop({ preventDefault(){}, clientY: 0 });
  return { draggable: true, canDrop };
}, { id, to });

console.log('═══ 1. МЕНЕДЖЕР B2C: ЛИШЕ ДОЗВОЛЕНІ ПЕРЕХОДИ ═══');
const м0 = await колонка('2000901');
const м = await тягни('2000901', 'ready');
await ЖДИ(300);
const м1 = await p.evaluate(() => ({ col: window.LQDesign.chainAt(designJobs['2000901'], orders.find(x => x.orderId === '2000901')), pin: !!designJobs['2000901'].pin }));
console.log('   ' + JSON.stringify({ м0, м, м1 }));
ok(м0 === 'design' && !м.draggable && м1.col === 'design' && !м1.pin,
  'менеджер: картка в «Дизайн» мишкою не тягнеться (лише ескізи між своїми колонками), шпильки немає', JSON.stringify({ м0, м, м1 }));

console.log('');
console.log('═══ 2. ВЛАСНИК СТАВИТЬ КАРТКУ КУДИ ХОЧЕ ═══');
await p.evaluate(() => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  applyRoleUi();
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await ЖДИ(300);
const в = await тягни('2000901', 'ready');
await ЖДИ(400);
const в1 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  U.render(document.getElementById('dzRoot'));
  const o = orders.find(x => x.orderId === '2000901'), j = designJobs['2000901'];
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000901"]');
  const col = c && c.closest('.dz-col[data-col]');
  c.click(); await new Promise(r => setTimeout(r, 300));
  const pinEl = document.querySelector('.dz-panel .dz-pin');
  return { col: col ? col.dataset.col : '', chain: D.chainAt(j, o), pin: j.pin && { to: j.pin.to, by: j.pin.by }, tile: !!(c && c.querySelector('.dz-c-pin')),
    panel: pinEl ? pinEl.textContent.replace(/\s+/g, ' ').trim() : '', off: !!document.querySelector('.dz-panel [data-do="pin-off"]'),
    hist: U.histHtml(j, o).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
});
console.log('   ' + JSON.stringify(в1));
ok(в.draggable && в.canDrop.includes('ready') && в.canDrop.includes('prod') && !в.canDrop.includes('refused'),
  'власник тягне: приймають усі колонки, крім «Відмова»', JSON.stringify(в));
ok(в1.col === 'ready' && в1.chain === 'ready' && в1.pin && в1.pin.to === 'ready' && в1.pin.by === 'test@loomiq' && в1.tile && /вручну · test/.test(в1.panel) && в1.off,
  'картка в «До відправки», 📌 на плитці, у картці «вручну · test» і «зняти»', JSON.stringify(в1));
ok(/поставлено вручну: «До відправки»/.test(в1.hist), 'в історії — «поставлено вручну: «До відправки» 📌»', в1.hist.slice(0, 200));

console.log('');
console.log('═══ 3. «ЗНЯТИ» — КАРТКА ЗНОВУ ЗА РОБОТОЮ ═══');
const з = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelector('.dz-panel [data-do="pin-off"]').click();
  await new Promise(r => setTimeout(r, 400));
  const o = orders.find(x => x.orderId === '2000901'), j = designJobs['2000901'];
  U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000901"]');
  const col = c && c.closest('.dz-col[data-col]');
  return { pin: !!j.pin, chain: D.chainAt(j, o), col: col ? col.dataset.col : '', tile: !!(c && c.querySelector('.dz-c-pin')),
    hist: U.histHtml(j, o).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
});
console.log('   ' + JSON.stringify({ pin: з.pin, chain: з.chain, col: з.col, tile: з.tile }));
ok(!з.pin && з.chain === 'design' && з.col === 'design' && !з.tile && /шпильку знято/.test(з.hist),
  'шпильку знято: картка знову в «Дизайн» за роботою, без 📌, в історії «шпильку знято»', JSON.stringify(з));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'власник ставить картку куди хоче — шпилька тримає');
process.exit(bad ? 1 : 0);
