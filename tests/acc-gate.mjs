/* ЗАСЛОНА ДОСТУПІВ (22.10).

   Андрій: «перші секунди відкривається все, а потім звужується… потрібно,
   щоб йому навіть не показувалось». Доти, поки документ команди не приїхав,
   усіх вважали власником — і виробничник бачив дошку B2B з клієнтами й
   сумами. Тепер до приходу доступів — лише «Завантажую доступи…»; приїхали
   — одразу розділ ролі; не приїхали за час очікування — «не вдалось» і
   «Спробувати ще раз», а не усе навстіж.

   Запуск:  node tests/acc-gate.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8961;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'production' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
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
  'Doc.prototype.onSnapshot=function(cb){ var d=null, self=this;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos'){\n" +
  "      if(window.__PHOTOS_NEVER) return function(){};\n" +
  "      setTimeout(function(){ var d=Object.assign({}, window.__CONTENT, window.__CONTENT_PATCH||{}); try{ cb(new Snap('photos', d)); }catch(e){ console.error(e); } }, window.__PHOTOS_DELAY || 0); return function(){}; }\n" +
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
async function page(init){
  const p = await browser.newPage({ viewport:{ width:1400, height:900 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  p.on('dialog', d => d.accept(''));
  await p.addInitScript(init);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  return p;
}
const стан = p => p.evaluate(() => {
  const vis = el => !!el && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const gate = document.getElementById('acc-gate');
  return { gate: !!gate && getComputedStyle(gate).display !== 'none', gateTxt: gate ? gate.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '',
    retry: !!(gate && gate.querySelector('[data-ag-retry]')),
    wait: document.body.classList.contains('acc-wait'), navVis: vis(document.querySelector('.nav')), mainVis: vis(document.querySelector('main')),
    navItems: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden && vis(b)).map(b => b.dataset.view),
    role: myRole(), nav: (myAcc() || {}).nav, loaded: contentLoaded,
    design: (document.getElementById('view-design') || {}).style ? document.getElementById('view-design').style.display : '',
    board: (document.getElementById('view-board') || {}).style ? document.getElementById('view-board').style.display : '',
    seat: (window.LQDesign && LQDesign.ui.tab) ? LQDesign.ui.tab() : '' };
});

console.log('═══ 1. ВИРОБНИЧНИК: ДОКУМЕНТ КОМАНДИ ЇДЕ 2,5 С ═══');
const p1 = await page(() => { window.__PHOTOS_DELAY = 2500; });
await p1.waitForTimeout(1200);
const s1 = await стан(p1);
console.log('   ' + JSON.stringify(s1));
ok(s1.gate && /Завантажую доступи/.test(s1.gateTxt) && s1.wait && !s1.navVis && !s1.mainVis && !s1.loaded,
  'перші секунди: лише «Завантажую доступи…», панель і дошка невидимі', JSON.stringify(s1));
ok(s1.role !== 'owner' && Array.isArray(s1.nav) && !s1.nav.length, 'до приходу команди ніхто не власник — доступів нуль', JSON.stringify({ role: s1.role, nav: s1.nav }));
await p1.waitForTimeout(3000);
const s2 = await стан(p1);
console.log('   ' + JSON.stringify(s2));
ok(!s2.gate && !s2.wait && s2.navVis && s2.loaded && s2.role === 'production', 'приїхала — заслона зникла, людина ввійшла', JSON.stringify(s2));
ok(s2.navItems.join() === 'design' && s2.design === 'block' && s2.board !== 'block' && s2.seat === 'prod',
  'і одразу на своєму: зліва лише «Замовлення B2C», відкрита дошка цеху, B2B-дошки не було й немає', JSON.stringify(s2));
await p1.close();

console.log('');
console.log('═══ 2. ВЛАСНИК БЕЗ КОМАНДИ — ЯК БУЛО, ПОВНИЙ ДОСТУП ПІСЛЯ ЗАВАНТАЖЕННЯ ═══');
const p2 = await page(() => { window.__PHOTOS_DELAY = 800; window.__CONTENT_PATCH = { team: [] }; });
await p2.waitForTimeout(300);
const s3 = await стан(p2);
ok(s3.gate && !s3.navVis, 'і в нього спершу заслона', JSON.stringify(s3));
await p2.waitForTimeout(1500);
const s4 = await стан(p2);
console.log('   ' + JSON.stringify({ role: s4.role, navItems: s4.navItems.length, gate: s4.gate }));
ok(!s4.gate && s4.role === 'owner' && s4.navItems.length > 5, 'команди в документі немає — повний доступ, як раніше', JSON.stringify(s4));
await p2.close();

console.log('');
console.log('═══ 3. ДОКУМЕНТ НЕ ПРИЙШОВ — «НЕ ВДАЛОСЬ», А НЕ ВСЕ НАВСТІЖ ═══');
const p3 = await page(() => { window.__PHOTOS_NEVER = true; window.LQ_ACC_WAIT_MS = 1500; });
await p3.waitForTimeout(3000);
const s5 = await стан(p3);
console.log('   ' + JSON.stringify(s5));
ok(s5.gate && /Не вдалось завантажити доступи/.test(s5.gateTxt) && s5.retry && !s5.navVis && !s5.mainVis && s5.role !== 'owner',
  'минув час очікування — «Не вдалось завантажити доступи» зі «Спробувати ще раз»; панель і дошка так і не показались', JSON.stringify(s5));
await p3.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'до приходу доступів — нічого; приїхали — одразу своє');
process.exit(bad ? 1 : 0);
