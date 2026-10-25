/* ПОЗИЦІЯ З ТЕЛЕФОНА — ЗАПИС ОДНІЄЮ КАРТКОЮ, НЕ ЧЕКАЮЧИ ВСІХ (25.10).

   Андрій: «товар не зберігся… провантажується по 5 хвилин». Доти адмінка
   записувала передачу лише після повного завантаження всіх замовлень і лише
   з ?calcSave=1 у адресі. Тепер: передача забирається при будь-якому
   відкритті, картка тягнеться з бази одна, запис іде за секунди; картки в
   базі немає — банер «Прибрати». Тут усі замовлення «приїжджають» за 4 с.

   Запуск:  node tests/calc-early.mjs  */
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9133;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
const ORDERS = [{ id:'o148', orderId:'1000148', type:'client', name:'Aisha', instagram:'aisha', status:'prorahunok', site:'main',
  payments:[], hist:[], createdAt:'2026-10-20T20:32:00.000Z', items:[] }];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + '; window.__ORDERS_DELAY=4000;\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n' +
  '  window.__SETS=[]; var set0=Doc.prototype.set; Doc.prototype.set=function(v){ window.__SETS.push({ col:this.__col, id:this.__id, v:v, t:Date.now() }); if(this.__col==="kanbanOrders"){ var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(v)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); } return set0.apply(this, arguments); };\n' +
  '  SeedCol.prototype.get=function(){ return new Promise(function(res){ setTimeout(function(){ res({ docs:window.__ORDERS.map(function(o){ return new Snap(o.id, JSON.parse(JSON.stringify(o))); }), forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id, JSON.parse(JSON.stringify(o)))); }); }, empty:!window.__ORDERS.length }); }, window.__ORDERS_DELAY||0); }); };\n' +
  '  var get0=Doc.prototype.get; Doc.prototype.get=function(){ var id=this.__id; if(this.__col==="kanbanOrders"){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); } return get0.apply(this, arguments); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ setTimeout(function(){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } }, window.__ORDERS_DELAY||0); return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => { if(/назавжди/.test(d.message())) d.accept(); else { errs.push('alert: ' + d.message().slice(0, 120)); d.dismiss(); } });
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

const PAYLOAD = { instagram:'aisha', name:'', company:'', phone:'', dueAt:'', targetId:'o148',
  items:[{ kind:'main', name:'Худі базове', color:'Білий', qty:10, unitPrice:550, price:5500, unitCost:300, cost:3000, sizes:'M:10', mockups:[], prints:[] }] };
const putPayload = (pl) => p.evaluate(pl => new Promise(res => { const r = indexedDB.open('lq_handoff', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(pl, 'calc'); tx.oncomplete = () => res(true); }; }), pl);
const left = () => p.evaluate(() => new Promise(res => { const q = indexedDB.open('lq_handoff', 1);
  q.onupgradeneeded = () => q.result.createObjectStore('kv');
  q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('calc'); g.onsuccess = () => res(!!g.result); }; q.onerror = () => res('err'); }));

console.log('═══ 1. ВІДКРИЛИ АДМІНКУ БЕЗ ?calcSave — ПЕРЕДАЧА ЗАПИСАНА ЗА СЕКУНДИ, ДО ВСІХ КАРТОК ═══');
await p.goto(HOST + '/t.html').catch(() => {});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
await putPayload(PAYLOAD);
const t0 = Date.now();
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForFunction(() => (window.__SETS || []).some(s => s.col === 'kanbanOrders' && s.id === 'o148'), null, { timeout: 8000 }).catch(() => {});
const r1 = await p.evaluate(() => { const s = (window.__SETS || []).filter(s => s.col === 'kanbanOrders' && s.id === 'o148')[0];
  return { set: !!s, items: s ? (s.v.items || []).map(i => i.name + '×' + i.qty) : [], усі: (orders || []).length, since: s ? s.t - performance.timeOrigin : null }; });
const мс = Date.now() - t0;
console.log('  ' + JSON.stringify(r1) + ' · ' + мс + ' мс від відкриття');
ok(r1.set && r1.items.join() === 'Худі базове×10', 'позиція записана в картку 1000148 — без ?calcSave у адресі', JSON.stringify(r1));
ok(r1.усі <= 1 && мс < 3800, 'записано ДО того, як приїхали всі замовлення (вони їдуть 4 с) — за ' + мс + ' мс', JSON.stringify(r1));
await p.waitForTimeout(5000);
const r2 = await p.evaluate(async () => ({ усі: (orders || []).length, url: location.search, картка: !!document.querySelector('#orderDrawer.open'),
  items: ((orders || []).find(x => x.id === 'o148') || {}).items }));
ok(r2.усі === 1 && !/calcSave/.test(r2.url) && (await left()) === false, 'далі старт звичайний: картки приїхали, передача прибрана, адреса чиста', JSON.stringify(r2));
ok(r2.картка, 'відкрито картку, куди лягла позиція', JSON.stringify(r2));

console.log('═══ 2. КАРТКИ В БАЗІ НЕМАЄ — БАНЕР, ПОЗИЦІЯ НЕ ГУБИТЬСЯ ═══');
await putPayload(Object.assign({}, PAYLOAD, { targetId:'o-gone' }));
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForSelector('#calc-pending', { timeout: 9000 }).catch(() => {});
const r3 = await p.evaluate(() => ({ банер: (document.querySelector('#calc-pending') || {}).textContent || '' }));
ok(/незбережена позиція з телефона/.test(r3.банер) && (await left()) === true, 'банер «Є незбережена позиція з телефона… картки немає»; передача в телефоні', JSON.stringify(r3));
await p.click('#calc-pending [data-cp-drop]');
await p.waitForTimeout(400);
ok((await left()) === false && !(await p.$('#calc-pending')), '«Прибрати» — передачу знято, банер зник', 'не знялось');

ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'позиція з телефона записується одразу, не чекаючи всіх карток');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
