/* ДОШКА ВІДДІЛУ НЕ ВИСНЕ (30.10).
   Андрій: «дуже висне пошук і перелистання між замовленнями… поки появиться
   в пошуку, поки вона знайде, дуже довго». Причина: на кожну букву дошка
   будувалась цілком (усі плитки всіх колонок), пошук для кожної плитки
   перебирав усі замовлення, а картка відділу за номером шукалась перебором.
   Тепер: картка за номером — одразу; дошка під пошук будується раз на сеанс
   набору й лише фільтрується з паузою між буквами; відкриття картки малює
   лише картку, дошка лишається. Перевіряємо на 600 картках за ЛІЧИЛЬНИКАМИ
   викликів (не за секундами — вони плавають під навантаженням).
   Запуск:  node tests/board-fast.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9063;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const N = 600;
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }], b2c: {} };
const ORDERS = [];
for(let i = 0; i < N; i++){
  const no = String(2000001 + i);
  ORDERS.push({ id:'o' + i, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + i, phone:'+38067' + String(1000000 + i),
    status:'prorahunok', site:'main', payments:[], hist:[], createdAt:'2026-10-' + String(1 + (i % 28)).padStart(2, '0') + 'T09:00:00.000Z',
    crmChatId:'c' + i, crmNick:'nick_' + i, totalPrice: 1000 + i, items:[] });
}
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
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
await p.waitForTimeout(4000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

/* 600 карток відділу з однією позицією; лічильник викликів «картка за номером». */
await p.evaluate(N => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  for(let i = 0; i < N; i++){
    const j = designJobMake(String(2000001 + i));
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1 })];
  }
  openDesign();
  const job0 = U.host.job;
  window.__JOBCALLS = 0;
  U.host.job = function(id){ window.__JOBCALLS++; return job0(id); };
}, N);
await p.waitForTimeout(800);
const cards = await p.evaluate(() => document.querySelectorAll('#dzRoot .dz-card').length);
ok(cards === N, 'на дошці акаунта ' + N + ' карток', 'карток: ' + cards);

console.log('═══ 1. ПОШУК: ПАУЗА МІЖ БУКВАМИ, ДОШКА РАЗ, БЕЗ ПЕРЕБОРУ ═══');
const s1 = await p.evaluate(async N => {
  window.__JOBCALLS = 0;
  const el = document.querySelector('#dzRoot [data-seek]');
  const t0 = performance.now();
  for(const ch of ['2', '0', '0', '0', '1', '2', '3']){ el.value += ch; el.oninput(); }
  await new Promise(r => setTimeout(r, 600));
  const t = performance.now() - t0;
  return { calls: window.__JOBCALLS, ms: Math.round(t), shown: document.querySelectorAll('#dzRoot .dz-card').length,
           seek: window.LQDesign.ui.seek(), focus: document.activeElement === document.querySelector('#dzRoot [data-seek]') };
}, N);
console.log('  ' + JSON.stringify(s1));
ok(s1.seek === '2000123' && s1.shown === 1, 'сім букв поспіль — знайдено одну картку #2000123', JSON.stringify(s1));
ok(s1.calls <= 5 * N, 'сім букв — кілька проходів по картках, а не 7×600×600 (пауза між буквами, дошка раз): ' + s1.calls + ' викликів', 'викликів: ' + s1.calls);
/* Друга буква за кілька секунд — дошка з кешу: лише фільтр. */
const s2 = await p.evaluate(async () => {
  window.__JOBCALLS = 0;
  const el = document.querySelector('#dzRoot [data-seek]');
  el.value = '20001'; el.oninput();
  await new Promise(r => setTimeout(r, 400));
  return { calls: window.__JOBCALLS, shown: document.querySelectorAll('#dzRoot .dz-card').length };
});
ok(s2.shown === 100 && s2.calls <= 1.5 * N, 'наступна буква в тому ж сеансі — лише фільтр готових плиток, один прохід (' + s2.calls + ' викликів)', JSON.stringify(s2));

console.log('═══ 2. ВІДКРИТИ КАРТКУ — ЛИШЕ КАРТКА, ДОШКА СТОЇТЬ ═══');
const o1 = await p.evaluate(async () => {
  const el = document.querySelector('#dzRoot [data-seek]'); el.value = ''; el.oninput();
  await new Promise(r => setTimeout(r, 400));
  const bd = document.querySelector('#dzRoot .dz-boards');
  window.__JOBCALLS = 0;
  const t0 = performance.now();
  document.querySelector('#dzRoot [data-open="2000050"]').click();
  const t = performance.now() - t0;
  return { same: document.querySelector('#dzRoot .dz-boards') === bd, calls: window.__JOBCALLS, ms: Math.round(t),
           panel: !!document.querySelector('#dzRoot #dzPanel:not(.hide) .dz-panel-id, #dzRoot #dzPanel:not(.hide)'),
           open: window.LQDesign.ui.tabOpen(), on: (document.querySelector('#dzRoot .dz-card.on') || {}).dataset ? document.querySelector('#dzRoot .dz-card.on').dataset.open : '' };
});
console.log('  ' + JSON.stringify(o1));
ok(o1.same && o1.panel && o1.open === '2000050' && o1.on === '2000050', 'відкрили #2000050: дошка той самий елемент, панель відкрита, плитка позначена', JSON.stringify(o1));
ok(o1.calls <= 2 * N && o1.ms < 500, 'відкриття не перебудовує всі плитки: один прохід, ' + o1.ms + ' мс', JSON.stringify(o1));
/* Перелистати на іншу — так само швидко. */
const o2 = await p.evaluate(async () => {
  window.__JOBCALLS = 0;
  document.querySelector('#dzRoot [data-open="2000051"]').click();
  return { calls: window.__JOBCALLS, open: window.LQDesign.ui.tabOpen(), on: document.querySelectorAll('#dzRoot .dz-card.on').length };
});
ok(o2.open === '2000051' && o2.on === 1 && o2.calls <= 2 * N, 'перелистали на #2000051 — лише картка, одна позначена плитка', JSON.stringify(o2));
/* Картка за номером — без перебору замовлень. */
const j1 = await p.evaluate(() => { const t0 = performance.now(); for(let i = 0; i < 2000; i++) designJobOf('2000300'); return Math.round(performance.now() - t0); });
ok(j1 < 200, '2 000 пошуків картки відділу за номером — миттєво (' + j1 + ' мс)', 'мс: ' + j1);

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ дошка не висне');
