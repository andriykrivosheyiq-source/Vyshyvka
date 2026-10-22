/* B2C НІКОЛИ НЕ ПОКАЗУЄ B2B-КАРТКУ (22.10).

   Андрій: «B2C і B2B повністю розділені… чому при B2C випадає карточка
   B2B? Зроби, щоб такого більше ніколи не було». Доти, коли картку відділу
   не вдавалось зібрати, шухляда мовчки малювала B2B-картку. Тепер:
     1. зламана зона картки показує лише себе — решта працює;
     2. картка відділу зовсім не зібралась — чесна панель з причиною й
        повтором, у журналі доступів є запис; B2B-картки немає;
     3. номер від 2 000 001 — це B2C, навіть без поля напряму.

   Запуск:  node tests/dept-only.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8959;
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
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'3', orderId:'2000390', type:'client', name:'Без напряму', status:'lead', site:'main', crmChatId:'c3', crmChatName:'Без напряму',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
  { id:'b', orderId:'1000390', type:'client', name:'Опт', status:'lead', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
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
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000301'); j.no = '2000301';
  const u = Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1, note:'Лого', artKind:'k' });
  j.units = [u];
  const g = D.dzNew(); D.dzList(u, 'graphic').push(g); g.who = 'p@loomiq'; g.sentAt = new Date().toISOString(); g.status = 'review';
  g.vers.push({ n:1, at:new Date().toISOString(), files:[{ url:'https://x/v1.png', name:'v1.png' }], sentToClient:new Date().toISOString() });
  window.__drawer = o => ({ dept: document.querySelector('#orderDrawer .od-panel').classList.contains('is-dept'),
    b2b: !document.querySelector('#orderDrawer .od-panel').classList.contains('is-dept') && !!document.querySelector('#orderDrawer .od-panel').innerHTML.trim(),
    fail: (document.querySelector('#orderDrawer .dz-dept-fail .dz-fail p') || {}).textContent || '',
    zoneFail: [...document.querySelectorAll('#orderDrawer .dz-zone-fail')].map(x => x.textContent),
    zones: [...document.querySelectorAll('#orderDrawer .dz-z > .dz-z-h b, #orderDrawer .dz-fold > .dz-fold-h b, #orderDrawer [data-fold]')].map(x => x.textContent.trim()).filter(Boolean),
    head: !!document.querySelector('#orderDrawer .dz-panel-h') });
});

console.log('═══ 1. ЗЛАМАНА ЗОНА — ЛИШЕ ВОНА ═══');
const z = await p.evaluate(async () => {
  const U = window.LQDesign.ui; const orig = U.unitsHtml;
  U.unitsHtml = () => { throw new Error('підставна поломка складу'); };
  await openOrderDrawer(orders.find(o => o.orderId === '2000301')); await new Promise(r => setTimeout(r, 300));
  const r = __drawer(); U.unitsHtml = orig; closeOrderDrawer(); return r;
});
console.log('   ' + JSON.stringify(z));
ok(z.dept && !z.b2b && z.zoneFail.length === 1 && /Склад і дизайн.*підставна поломка складу/.test(z.zoneFail[0]) && z.head && z.zones.some(t => /Гроші|Відправка|Історія/.test(t)),
  'зламалась зона складу — вона каже чому, шапка, гроші, відправка й історія на місці; B2B-картки немає', JSON.stringify(z));

console.log('');
console.log('═══ 2. КАРТКА ВІДДІЛУ НЕ ЗІБРАЛАСЬ — ПАНЕЛЬ З ПРИЧИНОЮ, НЕ B2B ═══');
const f = await p.evaluate(async () => {
  const U = window.LQDesign.ui; const orig = U.renderPanel;
  const було = accLogList().length;
  U.renderPanel = () => { throw new Error('підставна поломка картки'); };
  await openOrderDrawer(orders.find(o => o.orderId === '2000301')); await new Promise(r => setTimeout(r, 300));
  const r = __drawer();
  r.retry = !!document.querySelector('#orderDrawer [data-dept-retry]');
  r.log = accLogList().slice(було).map(x => (x.kind || '') + ':' + (x.text || '')).join(' | ');
  U.renderPanel = orig;
  document.querySelector('#orderDrawer [data-dept-retry]').click(); await new Promise(r => setTimeout(r, 400));
  r.after = __drawer(); closeOrderDrawer(); return r;
});
console.log('   ' + JSON.stringify({ fail: f.fail, b2b: f.b2b, retry: f.retry, log: f.log, after: { dept: f.after.dept, b2b: f.after.b2b, fail: f.after.fail } }));
ok(f.dept && !f.b2b && /підставна поломка картки/.test(f.fail) && f.retry, 'замість B2B-картки — панель «Картка відділу не відкрилась» з причиною й кнопкою повтору', JSON.stringify(f));
ok(/dept-fail/.test(f.log) && /2000301/.test(f.log) && /підставна/.test(f.log), 'причина записана в журнал доступів', f.log);
ok(f.after.dept && !f.after.fail && !f.after.b2b, '«Спробувати ще раз» після лагодження — звичайна картка відділу', JSON.stringify(f.after));

console.log('');
console.log('═══ 3. НОМЕР ВІД 2 000 001 — ЦЕ B2C, НАВІТЬ БЕЗ ПОЛЯ НАПРЯМУ ═══');
const n = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000390');
  const r = { dir: orderDir(o) };
  await openOrderDrawer(o); await new Promise(r => setTimeout(r, 300));
  Object.assign(r, __drawer()); closeOrderDrawer();
  const b = orders.find(x => x.orderId === '1000390');
  await openOrderDrawer(b); await new Promise(r => setTimeout(r, 300));
  r.b2bCard = __drawer(); r.b2bDir = orderDir(b); closeOrderDrawer();
  return r;
});
console.log('   ' + JSON.stringify({ dir: n.dir, dept: n.dept, b2b: n.b2b, fail: n.fail, b2bDir: n.b2bDir, b2bCard: { dept: n.b2bCard.dept, b2b: n.b2bCard.b2b } }));
ok(n.dir === 'b2c' && n.dept && !n.b2b && !n.fail, 'замовлення 2000390 без поля напряму — B2C, картка відділу', JSON.stringify(n));
ok(n.b2bDir === 'b2b' && n.b2bCard.b2b && !n.b2bCard.dept, 'а 1000390 — як був, B2B-картка', JSON.stringify(n.b2bCard));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'B2C ніколи не показує B2B-картку');
process.exit(bad ? 1 : 0);
