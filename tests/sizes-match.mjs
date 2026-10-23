/* РОЗМІРИ В КАРТЦІ B2C — ТІ САМІ, ЩО В КОНСТРУКТОРІ (23.10).

   Андрій: «в конструкторі є 3XL, у картці немає». Картка бере розміри тим
   самим шляхом, що конструктор і сайт: власна сітка товару → стандартна
   сітка цього товару → загальна; без обрізання.

   Запуск:  node tests/sizes-match.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9041;
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
console.log('═══ РОЗМІРИ КАРТКИ = РОЗМІРИ КОНСТРУКТОРА ═══');
const r = await p.evaluate(() => {
  const D = window.LQDesign;
  const катал = () => (D.ui.host.catalog ? D.ui.host.catalog() : []);
  const sizesIn = id => (катал().find(g => g.id === id) || {}).sizes || [];
  const ctor = id => { photoGarmentId = id; return currentScRows().map(x => String(x.size)); };   // те, що показує конструктор
  const out = { def: {}, same: true, miss: [] };
  /* 1) без власних сіток: кожен товар — як у конструкторі */
  contentData.sizecharts = {};
  катал().forEach(g => { const a = sizesIn(g.id).join(), b = ctor(g.id).join(); out.def[g.id] = a; if(a !== b){ out.same = false; out.miss.push(g.id + ': ' + a + ' ≠ ' + b); } });
  out.hoodie3xl = sizesIn('hoodie').includes('XXXL') || sizesIn('hoodie').includes('3XL');
  out.tee5xl = sizesIn('tee').includes('5XL');
  /* 2) власна сітка з 3XL для худі — у картці є 3XL */
  contentData.sizecharts = { hoodie: [{ size:'S', A:67, B:51 }, { size:'M', A:70, B:56 }, { size:'L', A:73, B:61 }, { size:'XL', A:76, B:65 }, { size:'XXL', A:79, B:69 }, { size:'3XL', A:82, B:73 }, { size:'4XL', A:85, B:77 }] };
  out.own = sizesIn('hoodie').join(); out.ownCtor = ctor('hoodie').join();
  /* 3) «загальна» сітка (та сама, що зашита) — не вважається власною, беремо стандартну товару */
  contentData.sizecharts = { tee: [{size:'XS',A:64,B:47},{size:'S',A:66,B:50},{size:'M',A:68,B:53},{size:'L',A:72,B:56},{size:'XL',A:74,B:60},{size:'XXL',A:77,B:62}] };
  out.gen = sizesIn('tee').join(); out.genCtor = ctor('tee').join();
  /* 4) 16 рядків — не обрізається до 12 */
  contentData.sizecharts = { tee: Array.from({ length: 16 }, (_, i) => ({ size: 'R' + (i + 1), A: 60 + i, B: 40 + i })) };
  out.long = sizesIn('tee').length;
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(r.same, 'без власних сіток кожен товар у картці має рівно ті розміри, що показує конструктор', r.miss.join(' | '));
ok(r.hoodie3xl && r.tee5xl, 'худі — до XXXL, футболка — до 5XL (стандартні сітки виробника)', JSON.stringify({ h: r.def.hoodie, t: r.def.tee }));
ok(r.own === r.ownCtor && /3XL/.test(r.own) && /4XL/.test(r.own), 'власна сітка худі з 3XL і 4XL — у картці ті самі', r.own + ' / ' + r.ownCtor);
ok(r.gen === r.genCtor && /5XL/.test(r.gen), '«загальна» сітка не ховає стандартну сітку товару (футболка знову до 5XL)', r.gen + ' / ' + r.genCtor);
ok(r.long === 16, 'довга сітка не обрізається до 12', 'розмірів: ' + r.long);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'розміри в картці ті самі, що в конструкторі');
process.exit(bad ? 1 : 0);
