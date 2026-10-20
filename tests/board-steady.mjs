/* КАНБАН НЕ СТРИБАЄ (Андрій, 20.10: «пригає туди-сюди»).

   Фонові оновлення (обхід розмов, платежі, знімки бази) перебудовують
   дошку цілком. Перевіряємо: прокрутка сторінки й дошки вбік лишається
   там, де її залишили; відкрита картка не смикає дошку до себе на кожному
   оновленні — лише коли її щойно відкрили.

   Запуск:  node tests/board-steady.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8993;
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
const ORDERS = [];
for(let i = 0; i < 40; i++) ORDERS.push({ id:'b' + i, orderId:String(1000300 + i), type:'client', name:'Клієнт ' + i,
  status: ['new','prorahunok','dogovir'][i % 3] || 'new', site:'main', payments:[], hist:[], createdAt: new Date(Date.now() - i * 36e5).toISOString(), totalPrice: 1000, items:[] });
for(let i = 0; i < 40; i++) ORDERS.push({ id:'c' + i, orderId:String(2000300 + i), type:'client', dir:'b2c', name:'Покупець ' + i,
  status:'prorahunok', site:'main', payments:[{ sum:300, at:new Date().toISOString(), kind:'prepay' }], hist:[], createdAt: new Date(Date.now() - i * 36e5).toISOString(), totalPrice: 1000, items:[] });

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

console.log('═══ 1. КАНБАН B2B: ФОНОВЕ ОНОВЛЕННЯ НЕ СКИДАЄ ПРОКРУТКУ ═══');
const b2b = await p.evaluate(async () => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  const v = document.getElementById('view-board') || document.getElementById('board').closest('section');
  v.style.display = 'block';
  renderBoard();
  await new Promise(r => setTimeout(r, 200));
  const main = document.querySelector('main'), board = document.getElementById('board');
  main.scrollTop = 600; board.scrollLeft = 120;
  const до = { m: main.scrollTop, b: board.scrollLeft };
  for(let i = 0; i < 3; i++){ renderBoard(); await new Promise(r => setTimeout(r, 50)); }
  return { до, після: { m: main.scrollTop, b: board.scrollLeft }, можна: main.scrollHeight > main.clientHeight + 600 };
});
console.log('  ' + JSON.stringify(b2b));
ok(b2b.до.m > 0 && Math.abs(b2b.після.m - b2b.до.m) < 2 && Math.abs(b2b.після.b - b2b.до.b) < 2,
  'сторінка й дошка лишились на місці після трьох оновлень', 'стрибнуло: ' + JSON.stringify(b2b));

console.log('═══ 2. ДОШКА B2C: ПРОКРУТКА Й ВІДКРИТА КАРТКА ═══');
const b2c = await p.evaluate(async () => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  orders.filter(o => o.dir === 'b2c').forEach(o => { const j = designJobMake(o.orderId);
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'лого' })]; });
  try{ openDesign(); }catch(e){}
  U.setTab('acct');
  const root = document.getElementById('dzRoot');
  U.render(root);
  await new Promise(r => setTimeout(r, 300));
  const main = document.querySelector('main');
  const bd = () => root.querySelector('.dz-boards');
  main.scrollTop = 500; if(bd()) bd().scrollLeft = 200;
  const до = { m: main.scrollTop, b: bd() ? bd().scrollLeft : 0 };
  for(let i = 0; i < 3; i++){ U.render(root); await new Promise(r => setTimeout(r, 50)); }
  const після = { m: main.scrollTop, b: bd() ? bd().scrollLeft : 0 };
  /* Відкрили картку — дошка до неї підкрутилась (це правильно). Потім людина
     прокрутила дошку вбік — фонове оновлення не має тягнути назад до картки. */
  const card = root.querySelector('[data-open]');
  if(card) card.click();
  await new Promise(r => setTimeout(r, 400));
  if(bd()) bd().scrollLeft = 400;
  const ручна = bd() ? bd().scrollLeft : 0;
  for(let i = 0; i < 3; i++){ U.render(root); await new Promise(r => setTimeout(r, 50)); }
  const післяКартки = bd() ? bd().scrollLeft : 0;
  /* Закрили картку хрестиком (20.10, Андрій: «коли закриваю карточку, мене
     одразу пригоняє в канбан») — дошка й сторінка лишаються, де були. */
  main.scrollTop = 450;
  const доЗакр = { m: main.scrollTop, b: bd() ? bd().scrollLeft : 0 };
  const x = root.querySelector('.dz-panel [data-close]');
  if(x) x.click();
  await new Promise(r => setTimeout(r, 400));
  const закр = { m: main.scrollTop, b: bd() ? bd().scrollLeft : 0, панель: !!root.querySelector('.dz-panel:not(.hide)'), x: !!x };
  return { до, після, ручна, післяКартки, доЗакр, закр, широка: bd() ? bd().scrollWidth > bd().clientWidth : false };
});
console.log('  ' + JSON.stringify(b2c));
ok(Math.abs(b2c.після.m - b2c.до.m) < 2 && Math.abs(b2c.після.b - b2c.до.b) < 2,
  'дошка B2C: сторінка й дошка вбік — на місці після оновлень', 'стрибнуло: ' + JSON.stringify(b2c));
ok(Math.abs(b2c.післяКартки - b2c.ручна) < 2, 'відкрита картка не тягне дошку до себе на кожному оновленні', 'смикнуло: ' + JSON.stringify(b2c));
ok(b2c.закр.x && !b2c.закр.панель && Math.abs(b2c.закр.m - b2c.доЗакр.m) < 2 && Math.abs(b2c.закр.b - b2c.доЗакр.b) < 2,
  'закрили картку — сторінка й дошка на тому ж місці', 'після закриття: ' + JSON.stringify({ до: b2c.доЗакр, після: b2c.закр }));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'канбан стоїть на місці');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
