/* ІМʼЯ ФАЙЛУ ПРИ СКАЧУВАННІ — ЗА ЗАМОВЛЕННЯМ, А НЕ ЯК ЗАВАНТАЖИЛИ (20.10).

   Андрій: «коли викачка йде файлів — готові дизайни чи ні — воно повинно
   називатись номером цього замовлення… ми закачуємо з різними назвами,
   там також можуть бути якісь номери». Файл повторного дизайну
   «8669996.EMB» скачується як «2000301_1.emb», принт — «…_принт.png».
   Страховка в самому скачуванні: імʼя без номера замовлення — замінюємо.

   Запуск:  node tests/dl-names.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8981;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' }],
  b2c: {},
  readyDesigns: [{ id:'rd1', name:'Котик', pic:'https://f/cat.png', arts:[{ name:'кіт.png', url:'https://f/cat.png' }], files:[{ name:'кіт.dst', url:'https://f/cat.dst' }] }],
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





await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  window.__j = designJobMake('2000301');
  const u = Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1 });
  D.repeatAttach(u, { arts:[{ name:'8669996_S_світшот_рожевий_на_флісі_стандарт_25_см.png', url:'https://f/a1.png' }],
    files:[{ name:'8669996.EMB', url:'https://f/x/8669996.EMB' }, { name:'8669996_мала.EMB', url:'https://f/x/8669996_m.EMB' }],
    extras:[{ name:'8669996_(візуал)_.jpg', url:'https://f/v.jpg' }] });
  __j.units = [u];
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000301"]').click();
});
await p.waitForTimeout(500);
console.log('═══ 1. ПОВТОРНИЙ ДИЗАЙН: ФАЙЛИ В КАРТЦІ ═══');
/* Номер замовлення — той, що в шапці картки (job.no). */
const NO = await p.evaluate(() => String(__j.no));
const names = await p.evaluate(() => [...document.querySelectorAll('.dz-panel .dz-rep [data-do="dz-dl"]')].map(b => b.dataset.name));
console.log('  ' + JSON.stringify(names));
ok(names.join('|') === [NO + '_принт.png', NO + '_1.emb', NO + '_2.emb', NO + '_дод.jpg'].join('|'),
  'принт, два EMB і додаткове — за номером замовлення, розширення від оригіналу, чужий номер 8669996 зник', JSON.stringify(names));
const tip = await p.evaluate(() => (document.querySelector('.dz-panel .dz-rep [data-do="dz-dl"]') || {}).title || '');
ok(/завантажено як 8669996_S_світшот/.test(tip), 'як файл назвали при завантаженні — видно при наведенні', tip);

console.log('');
console.log('═══ 2. СТРАХОВКА В САМОМУ СКАЧУВАННІ ═══');
const saved = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  window.fetch = async () => new Response(new Blob(['x'], { type:'application/octet-stream' }), { status:200 });
  const got = [];
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ if(this.download) got.push(this.download); else orig.call(this); };
  await U.act('dz-dl', document.getElementById('dzRoot'), { url:'https://f/x/8669996.EMB', name:'8669996.EMB' });
  await U.act('dz-dl', document.getElementById('dzRoot'), { url:'https://f/x/a.dst', name: String(__j.no) + '_v2.dst' });
  HTMLAnchorElement.prototype.click = orig;
  return got;
});
console.log('  ' + JSON.stringify(saved));
ok(saved[0] === NO + '_файл.emb', 'файл із чужою назвою, хоч би звідки його скачували, — під номером замовлення', JSON.stringify(saved));
ok(saved[1] === NO + '_v2.dst', 'правильне імʼя лишається як є', JSON.stringify(saved));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'файли скачуються під номером замовлення');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
