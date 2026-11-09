/* ГОТОВІ ДИЗАЙНИ: ОКО; НАЗВИ В СТАРИХ НЕ МІНЯЮТЬСЯ; ДОПЛАТА ЗА ПРАВКИ (10.11).

   Андрій: «готові дизайни оком показувати або не показувати — у старих
   замовленнях лишились, у нових сховати, щоб не можна було додати»;
   «перейменувати товар — у старих як записаний, у нових по-новому»;
   «Готовий з правками — вписати суму доплати до звичайного готового, тільки
   в нових». Перевіряємо:
     1. око: закрите — у вікні вибору нових замовлень дизайну немає, у
        списку налаштувань він під «Показати сховані»; позиція старого
        замовлення з цим дизайном — з назвою, картинкою й файлами;
     2. назва: перейменування товару не змінює стару позицію (картка,
        сума), нова позиція бере нову назву;
     3. доплата: «Готовий з правками» фіксує суму з налаштувань у позиції,
        у сумі замовлення — окремим рядком; зміна налаштувань стару позицію
        не чіпає; стара «з правками» без суми — без доплати.

   Запуск:  node tests/ready-extras.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9034;
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
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: { baseExtra: 150 },
  readyDesigns: [ { id:'rd1', name:'HINA шпіц', pic:'https://x/hina.png', arts:[{ name:'p.png', url:'https://x/p.png' }], files:[{ name:'h.dst', url:'https://x/h.dst' }] },
                  { id:'rd2', name:'Старий котик', pic:'https://x/cat.png', arts:[{ name:'c.png', url:'https://x/c.png' }], files:[{ name:'c.dst', url:'https://x/c.dst' }] } ],
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
const r = await p.evaluate(async () => {
  window.confirm = () => true;
  applyRoleUi(); document.querySelector('.nav button[data-view="design"]').click();
  await new Promise(r => setTimeout(r, 300));
  const D = window.LQDesign, U = D.ui, out = {};
  const now = new Date().toISOString();
  const заведи = (id, units) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:'К' + id, status:'prorahunok', site:'main',
      payments:[{ sum:300, at:now, kind:'prepay' }], hist:[], createdAt:now, crmChatId:'c' + id, items:[] };
    orders.push(o);
    const j = designJobMake(id); j.no = id; j.units = units; designJobs[id] = j;
    return { o, j };
  };
  /* — 1. Око — */
  const стара = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:1 });
  D.readyAttach(стара, contentData.readyDesigns[1]);
  заведи('2000501', [стара]);
  /* ховаємо «Старий котик» оком у налаштуваннях */
  paintReadyDesigns();
  const eye = document.querySelector('#rd-list [data-rd-eye="rd2"]');
  out.eyeBefore = eye ? eye.textContent.trim() : '';
  eye && eye.click();
  await new Promise(r => setTimeout(r, 300));
  out.offSaved = !!(contentData.readyDesigns.find(x => x.id === 'rd2') || {}).off;
  out.listAfter = [...document.querySelectorAll('#rd-list .rd-c b')].map(x => x.textContent);
  out.offsBtn = ((document.querySelector('#rd-list [data-rd-offs]') || {}).textContent || '').trim();
  document.querySelector('#rd-list [data-rd-offs]').click();
  out.listAll = [...document.querySelectorAll('#rd-list .rd-c b')].map(x => x.textContent);
  out.pick = (U.host.readyDesigns() || []).map(d => d.name);
  /* стара позиція — у картці зі своєю назвою, картинкою, файлами */
  out.oldReady = { name: стара.ready && стара.ready.name, files: (стара.ready && стара.ready.files || []).length, pic: стара.ready && стара.ready.pic };
  U.setTab('acct'); U.open('2000501'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  out.oldCard = /Старий котик/.test((document.querySelector('.dz-panel') || {}).textContent || '');
  /* — 2. Назва — */
  const u2 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'L', qty:2 });
  заведи('2000502', [u2]);
  contentData.names = Object.assign({}, contentData.names, { tee:'Футболка преміум' });
  U.open('2000502'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  const panel = (document.querySelector('.dz-panel') || {}).textContent || '';
  out.oldName = { card: /Футболка базова/.test(panel), newInCard: /Футболка преміум/.test(panel),
                  sum: (D.ui.sumRows(designJobs['2000502'])[0] || {}).name };
  out.newPickName = (U.catItem('tee') || {}).name;
  contentData.names = {};
  /* — 3. Доплата за правки — */
  const u3 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Графіт', size:'M', qty:2 });
  заведи('2000503', [u3]);
  D.baseAttach(u3, contentData.readyDesigns[0], 'замість HINA — BONYA', null);
  const рядки = D.ui.sumRows(designJobs['2000503']);
  out.extra = { lock: u3.base.extra, row: рядки.filter(x => x.baseExtra).map(x => x.name + ':' + x.sum).join(),
                total: D.ui.orderSum(orders.find(x => x.orderId === '2000503'), designJobs['2000503']),
                main: (рядки[0] || {}).sum, cost: D.ui.orderCost(designJobs['2000503']).sum };
  contentData.b2c = Object.assign({}, contentData.b2c, { baseExtra: 400 });
  D.baseAttach(u3, contentData.readyDesigns[0], 'інша основа', null);
  out.extraKept = u3.base.extra;
  const u4 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Графіт', size:'M', qty:1 });
  u4.base = { id:'rd1', name:'HINA шпіц', pic:'', art:null, arts:[], files:[], extras:[], note:'старе', at:'2026-10-25T10:00:00.000Z' };
  заведи('2000504', [u4]);
  out.oldBase = D.ui.sumRows(designJobs['2000504']).filter(x => x.baseExtra).length;
  U.open('2000503'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  const гроші = document.querySelector('.dz-panel [data-fold="Гроші"]'); if(гроші) гроші.click();
  await new Promise(r => setTimeout(r, 200));
  out.extraShown = ((document.querySelector('.dz-panel [data-base-extra]') || {}).textContent || '').replace(/\s+/g, ' ');
  /* поле в налаштуваннях */
  paintB2c();
  out.field = (document.getElementById('b2c-base-extra') || {}).value;
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(/показується/.test(r.eyeBefore) && r.offSaved, 'око: закрили — дизайн позначено схованим', JSON.stringify({ e: r.eyeBefore, off: r.offSaved }));
ok(r.listAfter.join() === 'HINA шпіц' && /Показати сховані \(1\)/.test(r.offsBtn) && r.listAll.length === 2,
  'у налаштуваннях сховане не мішає — під «Показати сховані (1)»', JSON.stringify({ a: r.listAfter, b: r.offsBtn, all: r.listAll }));
ok(r.pick.join() === 'HINA шпіц', 'у вікні вибору нових замовлень схованого немає', JSON.stringify(r.pick));
ok(r.oldReady.name === 'Старий котик' && r.oldReady.files === 1 && r.oldReady.pic && r.oldCard,
  'у старому замовленні схований дизайн лишився: назва, картинка, файли, видно в картці', JSON.stringify(r.oldReady));
ok(r.oldName.card && !r.oldName.newInCard && r.oldName.sum === 'Футболка базова' && r.newPickName === 'Футболка преміум',
  'перейменування: стара позиція — «Футболка базова» (картка й сума), новий вибір — «Футболка преміум»', JSON.stringify({ o: r.oldName, n: r.newPickName }));
ok(r.extra.lock === 150 && r.extra.row === '↳ правки до готового дизайну:150' && r.extra.total === r.extra.main + 150,
  '«Готовий з правками»: доплата 150 з налаштувань — у позиції й окремим рядком у сумі', JSON.stringify(r.extra));
ok(r.extraKept === 150, 'змінили суму в налаштуваннях (400) і основу — зафіксована доплата позиції та сама (150)', JSON.stringify(r.extraKept));
ok(r.oldBase === 0, 'стара позиція «з правками» без зафіксованої суми — без доплати', String(r.oldBase));
ok(/правки до готового дизайну/.test(r.extraShown) && /150/.test(r.extraShown), 'у картці — рядок доплати', r.extraShown);
ok(r.field === '400', 'поле «Доплата за «Готовий з правками»» у Налаштуваннях B2C показує суму', String(r.field));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '✗ ' + bad + ' перевірок не пройшло' : '✓ готові дизайни: око, назви, доплата за правки');
process.exit(bad ? 1 : 0);
