/* ПРИВʼЯЗКА РОЗМОВИ ЗА ПОСИЛАННЯМ — ОДРАЗУ, ІМʼЯ — У ФОНІ (24.10).

   «Трішки висне, коли вставляєш посилання на діалог»: поле чекало один-два
   запити до Sitniks (буває й 20 с), запис і повне перемальовування. Тепер
   картка привʼязується в ту ж мить (номер — у самому посиланні), а імʼя й
   нік доїжджають у фоні. Sitniks тут навмисно відповідає за 2,5 с.

   Запуск:  node tests/bind-fast.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9131;
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


if(typeof ok === 'undefined'){}
await p.evaluate(() => {
  window.__slow = 0;
  window.crmFetch = (path) => new Promise(r => { window.__slow++; setTimeout(() => r(/\/messages$/.test(path) ? { items: [] }
    : { id:'abcdef0123456789', client:{ name:'Олена Коваль', username:'olena_k' }, channel:'Instagram' }), 2500); });
});

console.log('═══ 1. B2C: ВСТАВИЛИ ПОСИЛАННЯ В КАРТКУ — ПРИВʼЯЗАНО ОДРАЗУ ═══');
const c1 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const o = orders.find(x => x.orderId === '2000901');
  delete o.crmChatId; o.crmChatName = ''; delete o.crmNick; o.name = ''; o.ig = '';
  designJobMake('2000901');
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000901"]').click();
  await new Promise(r => setTimeout(r, 400));
  const el = document.querySelector('.dz-panel [data-bind]');
  if(!el) return { err: 'немає поля' };
  const t0 = performance.now();
  el.value = 'https://app.sitniks.com/dialog/abcdef0123456789';
  el.dispatchEvent(new Event('change'));
  await new Promise(r => { const k = setInterval(() => { if(o.crmChatId){ clearInterval(k); r(); } }, 20); setTimeout(() => { clearInterval(k); r(); }, 3000); });
  const мс = Math.round(performance.now() - t0);
  await new Promise(r => setTimeout(r, 150));
  return { мс, chat: o.crmChatId, label: crmWhoLabel(o), disabled: el.isConnected ? el.disabled : false };
});
console.log('  ' + JSON.stringify(c1));
ok(c1.chat === 'abcdef0123456789' && c1.мс < 600, 'картку привʼязано за ' + c1.мс + ' мс — без очікування Sitniks (він відповідає за 2,5 с)', JSON.stringify(c1));
ok(/підтягую імʼя з Sitniks/.test(c1.label) && !c1.disabled, 'поки Sitniks думає — «підтягую імʼя з Sitniks…», поле не заблоковане', JSON.stringify(c1));
await p.waitForTimeout(3200);
const c2 = await p.evaluate(() => { const o = orders.find(x => x.orderId === '2000901');
  return { label: crmWhoLabel(o), nick: o.crmNick, name: o.name, ig: o.ig, panel: /olena_k/.test((document.querySelector('.dz-panel') || {}).textContent || '') }; });
console.log('  ' + JSON.stringify(c2));
ok(/@olena_k · Олена Коваль/.test(c2.label) && c2.name === 'Олена Коваль' && /olena_k/.test(c2.ig || '') && c2.panel,
  'Sitniks відповів — імʼя й нік самі лягли в картку (і в Instagram), картка оновилась', JSON.stringify(c2));

console.log('═══ 2. B2B: ТЕ САМЕ В КАРТЦІ КАНБАНУ ═══');
const b1 = await p.evaluate(async () => {
  const o = { id:'b9', orderId:'1000901', type:'client', dir:'b2b', name:'', status:'prorahunok', site:'main', payments:[], hist:[],
              createdAt:'2026-10-20T09:00:00.000Z', items:[] };
  orders.push(o);
  const t0 = performance.now();
  await crmBindUrl(o, 'https://app.sitniks.com/dialog/abcdef0123456789');
  return { мс: Math.round(performance.now() - t0), chat: o.crmChatId };
});
ok(b1.chat === 'abcdef0123456789' && b1.мс < 1500, 'B2B: привʼязано за ' + b1.мс + ' мс, не чекаючи Sitniks', JSON.stringify(b1));
await p.waitForTimeout(3200);
const b2 = await p.evaluate(() => { const o = orders.find(x => x.id === 'b9'); return { nick: o.crmNick, chatName: o.crmChatName, name: o.name }; });
ok(b2.nick === 'olena_k' && b2.chatName === 'Олена Коваль' && b2.name === 'Олена Коваль', 'B2B: імʼя й нік доїхали у фоні', JSON.stringify(b2));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'привʼязка за посиланням — миттєва, імʼя доїжджає саме');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
