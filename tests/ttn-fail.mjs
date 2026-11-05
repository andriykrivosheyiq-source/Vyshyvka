/* НАКЛАДНА НЕ СТВОРИЛАСЬ — ПРИЧИНА В КАРТЦІ Й У ЖУРНАЛІ (05.11).

   Менеджери: «чомусь не можу створити ТТН, дані всі вказані» (#2000517,
   #2000477 — друга посилка, #2000263). Відмова Нової пошти чи воркера була
   лише спливним написом на кілька секунд. Тепер:
     — червоний рядок «НЕ СТВОРЕНО · час: причина» під кнопкою, кнопка
       «Створити ТТН ще раз»;
     — рядок ttn-fail у журналі з номером картки → «Стан системи»;
     — вдалося — рядок зникає;
     — те саме для посилки 2 і для «Перестворити ТТН».

   Запуск:  node tests/ttn-fail.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8846;
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

const now = new Date().toISOString();
const ORDER = {
  id:'1', orderId:'1001101', type:'client', name:'Оксана Лисенко', phone:'+380670001101',
  status:'paid', site:'main', createdAt:now, hist:[], prodAt:now, dueAt:'2026-12-01',
  offerToken:'tok1',
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'done', qc:'ok', ship:'wait' },
  art:[{ n:2, at:now, by:'d@loomiq', files:[{ kind:'front', name:'f', url:'https://x/f.dst' }],
         wilcom:'https://x/w.png', photo:'https://x/t.jpg',
         approvals:{ art:{ by:'a@loomiq', at:now }, inner:{ by:'a@loomiq', at:now },
                     client:{ by:'a@loomiq', at:now } } }],
  payments:[{ at:now, sum:25000, kind:'prepay', by:'a@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:50,
           sizeQty:{ S:10, M:20, L:20 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
                  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] } };

function stub(np){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  const c = Object.assign({}, CONTENT, np ? { bgApi:{ npUrl:'https://np.example/w' } } : {});
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(c) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace(
    "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(src){ this.__src=src; }\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
    '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
    '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
    '      var c=new Col(); c.__n=n; return c; },');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(np){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  p.on('dialog', d => d.accept());
  const body = stub(np);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}


const p = await open(true);
await p.evaluate(() => {
  window.__CALLS = []; window.__NP_FAIL = 'Вкажіть прізвище й імʼя отримувача';
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if(String(u).indexOf('np.example') < 0) return real(u, o);
    const b = JSON.parse(o.body);
    window.__CALLS.push(b);
    const J = d => new Response(JSON.stringify(d), { headers:{ 'Content-Type':'application/json' } });
    if(b.op === 'cities') return J({ ok:true, list:[{ ref:'c1', name:'Львів, Львівська обл.' }] });
    if(b.op === 'warehouses') return J({ ok:true, list:[{ ref:'w1', name:'Відділення №12', number:'12' }] });
    if(b.op === 'create') return window.__NP_FAIL ? J({ ok:false, error: window.__NP_FAIL }) : J({ ok:true, ttn:'20450999888777', ref:'r1' });
    if(b.op === 'track') return J({ ok:true, status:'Прямує до відділення', code:'5' });
    return J({ ok:false, error:'?' });
  };
});
await p.click('#board .ticket');
await p.waitForTimeout(900);
await p.evaluate(() => { odFolds.ship = true; renderOrderDrawer(); });
await p.waitForTimeout(400);
await p.fill('[data-shf-city]', 'Льв'); await p.waitForTimeout(900); await p.click('.ship-o');
await p.fill('[data-shf-wh]', '12'); await p.waitForTimeout(900); await p.click('.ship-o');
await p.waitForTimeout(300);

console.log('═══ 1. НОВА ПОШТА ВІДМОВИЛА — ПРИЧИНА ЛИШАЄТЬСЯ ═══');
await p.click('[data-shf-make]');
await p.waitForTimeout(1500);
const f1 = await p.evaluate(() => {
  const f = document.querySelector('[data-ttn-fail]'), b = document.querySelector('[data-shf-make]');
  const log = accLogList().filter(r => r.kind === 'ttn-fail');
  return { fail: f ? f.textContent.trim() : '', btn: b ? b.textContent.trim() : '', err: !!(b && b.classList.contains('is-err')), dis: !!(b && b.disabled),
    log: log.map(r => r.text), health: (finHealthRows().by['ttn-fail'] || []).length, ttn: orders.find(x => x.orderId === '1001101').ttn || '' };
});
console.log('   ' + JSON.stringify(f1));
if(process.env.SHOT){ const el = await p.$('[data-shipform]'); if(el) await el.screenshot({ path: process.env.SHOT }); }
ok(/^НЕ СТВОРЕНО · \d\d:\d\d: Вкажіть прізвище й імʼя отримувача$/.test(f1.fail), 'під кнопкою червоним: «НЕ СТВОРЕНО · час: причина від Нової пошти»', f1.fail);
ok(f1.btn === 'Створити ТТН ще раз' && f1.err && !f1.dis, 'кнопка «Створити ТТН ще раз», червона, натискається', JSON.stringify(f1));
ok(f1.log.length === 1 && /#1001101: Вкажіть прізвище/.test(f1.log[0]) && f1.health === 1, 'у журналі ttn-fail з номером картки, видно в «Стан системи»', JSON.stringify(f1.log));
ok(!f1.ttn, 'накладної в картці немає — нічого не вигадано', f1.ttn);

console.log('═══ 2. ВДРУГЕ ТА САМА ПРИЧИНА — ОДИН РЯДОК ЖУРНАЛУ; ВДАЛОСЬ — РЯДОК ЗНИК ═══');
await p.click('[data-shf-make]'); await p.waitForTimeout(1200);
const n2 = await p.evaluate(() => accLogList().filter(r => r.kind === 'ttn-fail').length);
ok(n2 === 1, 'та сама відмова вдруге журнал не засмічує', String(n2));
await p.evaluate(() => { window.__NP_FAIL = ''; });
await p.click('[data-shf-make]'); await p.waitForTimeout(1500);
const f3 = await p.evaluate(() => ({ fail: !!document.querySelector('[data-ttn-fail]'), ttn: orders.find(x => x.orderId === '1001101').ttn,
  mem: !!ttnFailOf(orders.find(x => x.orderId === '1001101'), 1) }));
ok(f3.ttn === '20450999888777' && !f3.fail && !f3.mem, 'накладна створилась — червоного рядка немає', JSON.stringify(f3));

console.log('═══ 3. ПОСИЛКА 2 І «ПЕРЕСТВОРИТИ ТТН» ═══');
const f4 = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001101');
  window.__NP_FAIL = 'Невірний поштомат для цієї ваги';
  const r = await shipTtnRemake(o);
  const log = accLogList().filter(x => x.kind === 'ttn-fail').map(x => x.text);
  o.ship2 = { on: true, units: [] };
  ttnFailSet(o, 2, 'Отримувача не заведено в Новій пошті');
  const h2 = shipForm2Html(o);
  return { r, log, two: /data-ttn-fail/.test(h2) && /Отримувача не заведено/.test(h2) && /Створити ТТН ще раз · посилка 2/.test(h2),
    twoLog: log.concat(accLogList().filter(x => x.kind === 'ttn-fail').map(x => x.text)).some(t => /посилка 2/.test(t)), ttn: o.ttn };
});
console.log('   ' + JSON.stringify(f4));
ok(f4.r === 'Невірний поштомат для цієї ваги' && f4.log.some(t => /перестворити: Невірний поштомат/.test(t)) && f4.ttn === '20450999888777',
  '«Перестворити» не вдалось — причина людині й у журнал, стара накладна на місці', JSON.stringify(f4));
ok(f4.two && f4.twoLog, 'посилка 2: причина під її кнопкою, «Створити ТТН ще раз · посилка 2», у журналі «посилка 2»', JSON.stringify(f4));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
