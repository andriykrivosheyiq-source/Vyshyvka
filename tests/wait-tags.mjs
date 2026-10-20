/* «ЧЕКАЄМО ДОПЛАТУ / ДАНІ» І «ТТН НЕ СТВОРЕНА» (Андрій, 20.10, лише B2C).

   У шапці картки — список «Доплата / Дані / Доплата і дані»; на картці
   канбану — тег біля Instagram; знімається сам, щойно доплату чи дані
   внесли. «ТТН не створена» — сама, від «Ескіз узгоджено» до відправки.

   Запуск:  node tests/wait-tags.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8998;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }], b2c:{} };
const ORDERS = [
  { id:'1', orderId:'2000901', type:'client', dir:'b2c', name:'Асія', phone:'', status:'prorahunok', site:'main', crmChatId:'c1',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 2000, items:[] }
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

const r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const o = orders.find(x => x.orderId === '2000901');
  const j = designJobMake('2000901');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'M', qty:1, note:'лого', artKind:'kids' })];
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const картка = () => (document.querySelector('#dzRoot [data-open="2000901"]') || {}).textContent || '';
  const out = { ttnДо: /ТТН не створена/.test(картка()) };
  document.querySelector('#dzRoot [data-open="2000901"]').click();
  await new Promise(r2 => setTimeout(r2, 400));
  const sel = document.querySelector('.dz-panel [data-jwait]');
  if(!sel) return { err: 'немає списку' };
  out.опції = [...sel.options].map(x => x.textContent);
  sel.value = 'both'; sel.onchange();
  await new Promise(r2 => setTimeout(r2, 300));
  out.обидва = { tag: U.waitOf(j, o), card: /Чекаємо доплату і дані/.test(картка()) };
  o.payments.push({ sum:1700, at:'2026-10-20T09:00:00.000Z', kind:'final' });
  U.render(document.getElementById('dzRoot'));
  out.післяОплати = { tag: U.waitOf(j, o), card: /Чекаємо дані/.test(картка()) && !/доплату/.test(картка()) };
  o.phone = '+380671112233'; o.ship = { cityRef:'c', cityName:'Київ', whRef:'w', whName:'Відділення 1' };
  U.render(document.getElementById('dzRoot'));
  out.післяДаних = { tag: U.waitOf(j, o), card: !/Чекаємо/.test(картка()) };
  /* «ТТН не створена» — з «Ескіз узгоджено». */
  const u = j.units[0];
  D.readyAttach(u, { id:'rd1', name:'Котик', pic:'p', arts:[{ name:'a.png', url:'a' }], files:[{ name:'a.dst', url:'d' }] });
  const d = D.readyGraphic(u, 'test@loomiq');
  D.dzVer(d, 'test@loomiq', [{ name:'a.png', url:'w', role:'work' }, { name:'m.png', url:'m', role:'mock' }], '', null, 'acct');
  d.vers[0].byAcct = true; d.vers[0].sentToClient = new Date().toISOString();
  D.acctMove(j, o, 'sketchok', 'test@loomiq');
  U.render(document.getElementById('dzRoot'));
  out.етап = D.chainAt(j, o);
  out.ttnПісля = /ТТН не створена/.test(картка());
  o.ttn = '20450000000000';
  U.render(document.getElementById('dzRoot'));
  out.ttnЗТтн = /ТТН не створена/.test(картка());
  return out;
});
console.log('  ' + JSON.stringify(r));
ok(r.опції && r.опції.join('|') === '—|Доплата|Дані|Доплата і дані', 'у шапці картки — список: Доплата, Дані, Доплата і дані', JSON.stringify(r.опції));
ok(r.обидва && r.обидва.tag === 'both' && r.обидва.card, 'обрали «Доплата і дані» — на картці «Чекаємо доплату і дані»', JSON.stringify(r.обидва));
ok(r.післяОплати && r.післяОплати.tag === 'data' && r.післяОплати.card, 'доплату внесли — лишилось «Чекаємо дані»', JSON.stringify(r.післяОплати));
ok(r.післяДаних && r.післяДаних.tag === '' && r.післяДаних.card, 'дані внесли — тег зник сам', JSON.stringify(r.післяДаних));
ok(r.ttnДо === false, 'до узгодження «ТТН не створена» немає', JSON.stringify(r));
ok(r.етап === 'sketchok' && r.ttnПісля === true && r.ttnЗТтн === false, 'з «Ескіз узгоджено» — «ТТН не створена»; створили ТТН — зникла', JSON.stringify(r));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'теги працюють');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
