/* ДЕТАЛІ НАКЛАДНОЇ В КАРТЦІ B2C (22.10).

   Андрій: «накладна створена… деталі платежу, які потім нам прийдуть
   усередині накладної, тут не пишуться — повинно писатись».

   1. Накладна з адмінки: отримувач, відправник, контроль оплати на рахунок
      НП ФОПа, «гроші ще не прийшли», хто платить доставку, оголошена
      вартість, коли доставлять.
   2. Прийшли гроші за цією ТТН (рядок грошового ядра) — «прийшли · сума».
   3. Накладна руками — підказка; «Оновити статус» підтягує з НП контроль
      оплати й платника; контроль оплати лягає в картку (Звірка його бачить).

   Запуск:  node tests/ttn-info.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9023;
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
  bgApi: { npUrl: 'https://np.example/w' },
  ship: { senders: [{ id:'fop1', name:'ФОП Юкальчук', phone:'380671112233', def:true }] },
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
  const D = window.LQDesign, U = D.ui;
  window.__CALLS = [];
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if(String(u).indexOf('np.example') < 0) return real(u, o);
    const b = JSON.parse(o.body); window.__CALLS.push(b);
    const J = d => new Response(JSON.stringify(d), { headers:{ 'Content-Type':'application/json' } });
    if(b.op === 'track') return J({ ok:true, status:'Прибув у відділення', code:'7', est:'2026-10-26 00:00:00', city:'Київ', wh:'Відділення №5',
                                    cod: 1500, payer:'Sender', decl: 1500, cost: 95, name:'Іван Петренко', phone:'380501234567' });
    return J({ ok:false, error:'?' });
  };
  const заведи = (id, extra) => {
    const o = Object.assign({ id:'t' + id, orderId:id, type:'client', dir:'b2c', name:'К' + id, status:'done', site:'main',
      payments:[{ sum:200, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[],
      tracks:{ prod:'done', qc:'ok', ship:'ttn' }, prodQc:{ photos:['x'], at:'2026-10-20T09:00:00.000Z' } }, extra);
    orders.push(o);
    const j = designJobMake(id); j.no = id; j.approvedVersion = 1;
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' })];
    designJobs[id] = j;
    return o;
  };
  заведи('2001001', { ttn:'20450111222333', ttnRef:'r1', ttnAt:'2026-10-21T10:00:00.000Z', ttnCity:'Львів', ttnWh:'Відділення №12',
    ttnSender:'fop1', ttnCod:2370, ttnPayer:'recipient', ttnDecl:2570, ttnName:'Олена Коваль', ttnPhone:'380671234567', ttnEst:'2026-10-24' });
  заведи('2001002', { ttn:'20450444555666', ttnAt:'2026-10-21T10:00:00.000Z' });
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const деталі = id => p.evaluate(async id => {
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 300));
  const f = document.querySelector('.dz-panel [data-fold="Відправка"]');
  if(f && !f.closest('.dz-z').classList.contains('open')){ f.click(); await new Promise(r => setTimeout(r, 200)); }
  const box = document.querySelector('.dz-panel .dz-ttnd');
  return box ? [...box.querySelectorAll('.dz-ttnd-r')].map(r => [...r.children].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim() || r.textContent.trim()) : null;
}, id);

console.log('═══ 1. НАКЛАДНА З АДМІНКИ — УСЕ, ЩО В НЕЇ ПІШЛО ═══');
const д1 = await деталі('2001001');
console.log('   ' + JSON.stringify(д1));
const є = (l, re) => !!(l || []).find(x => re.test(x));
ok(є(д1, /Отримувач Олена Коваль · 380671234567/), 'отримувач з телефоном', JSON.stringify(д1));
ok(є(д1, /Відправник ФОП Юкальчук/), 'відправник — ФОП', JSON.stringify(д1));
ok(є(д1, /Контроль оплати 2\s?370 ₴ на рахунок НП ФОП Юкальчук/), 'контроль оплати: сума й на чий рахунок НП прийде', JSON.stringify(д1));
ok(є(д1, /Гроші за накладною ще не прийшли/), 'гроші ще не прийшли', JSON.stringify(д1));
ok(є(д1, /Доставку платить отримувач/) && є(д1, /Оголошена вартість 2\s?570 ₴/) && є(д1, /Орієнтовно доставлять 24\.10/),
  'хто платить доставку, оголошена вартість, коли доставлять', JSON.stringify(д1));

console.log('');
console.log('═══ 2. ГРОШІ ЗА ЦІЄЮ ТТН ПРИЙШЛИ ═══');
await p.evaluate(() => {
  payments.push({ id:'npc_20450111222333', src:'np', amount:2370, at:'2026-10-25T12:00:00.000Z', ttn:'20450111222333', orderId:'2001001', tag:'cod' });
});
const д2 = await деталі('2001001');
console.log('   ' + JSON.stringify(д2));
ok(є(д2, /Гроші за накладною прийшли 25\.10 · 2\s?370 ₴/), 'прийшли — з датою й сумою (рядок грошового ядра)', JSON.stringify(д2));

console.log('');
console.log('═══ 3. НАКЛАДНА РУКАМИ — ПІДТЯГУЄМО З НОВОЇ ПОШТИ ═══');
const д3 = await деталі('2001002');
console.log('   ' + JSON.stringify(д3));
ok(є(д3, /вписали руками/), 'спершу — підказка натиснути «Оновити статус»', JSON.stringify(д3));
await p.evaluate(async () => { document.querySelector('.dz-panel [data-ship-track]').click(); await new Promise(r => setTimeout(r, 600)); });
const д4 = await деталі('2001002');
const o2 = await p.evaluate(() => { const o = orders.find(x => x.orderId === '2001002');
  return { cod: o.ttnCod, payer: o.ttnPayer, phone: (window.__CALLS.filter(c => c.op === 'track').pop() || {}).phone }; });
console.log('   ' + JSON.stringify({ д4, o2 }));
ok(є(д4, /Контроль оплати 1\s?500 ₴/) && є(д4, /Доставку платить ми \(відправник\)/) && є(д4, /Вартість доставки 95 ₴/) && є(д4, /Отримувач Іван Петренко/),
  'після «Оновити статус» — контроль оплати, хто платить, вартість доставки й отримувач з Нової пошти', JSON.stringify(д4));
ok(o2.cod === 1500 && !є(д4, /вписали руками/), 'контроль оплати лягає в картку — Звірка тепер перевірить і цю посилку; підказка зникла', JSON.stringify(o2));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'деталі накладної видно в картці: гроші, хто платить, отримувач');
process.exit(bad ? 1 : 0);
