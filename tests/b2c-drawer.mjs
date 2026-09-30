/* B2C-ЗАМОВЛЕННЯ В ПРАВІЙ ПАНЕЛІ — ТІЄЮ САМОЮ КАРТКОЮ ВІДДІЛУ.

   Андрій: у розмові праворуч відкривалась стара B2B-картка, а в Канбані
   відділу — інша. «Тут повинна бути тільки ця картка, яка у нас насправді
   є». Кнопку Instagram лишаємо.

   Запуск:  node tests/b2c-drawer.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8941;
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
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 24 }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'9', orderId:'1000077', type:'client', dir:'b2b', name:'ТОВ Ромашка', status:'new', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T12:00:00.000Z', totalPrice: 9000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] }
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
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  const U = window.LQDesign.ui;
  const j = designJobMake('2000101');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'XL', qty:1, note:'Лого' })];
  openDesign();
  U.host.hasChat = () => true;
  U.host.clientUnread = () => 0;
});
await p.waitForTimeout(300);

console.log('═══ B2C У ПРАВІЙ ПАНЕЛІ — КАРТКА ВІДДІЛУ ═══');
const b2c = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000101');
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('orderDrawer');
  const t = d ? d.innerText : '';
  return { відкрита: !!(d && d.classList.contains('open')),
           зони: [...d.querySelectorAll('.dz-z-h b')].map(x => x.textContent.trim()),
           стара: /Наступна дія|Нагадування|Нотатка менеджера|Макет у відділі/i.test(t),
           інстаграм: !!d.querySelector('.dz-write'),
           номер: ((d.querySelector('.dz-panel-id b') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(b2c));
ok(b2c.відкрита && b2c.зони.indexOf('Клієнт') >= 0 && b2c.зони.indexOf('Склад і дизайн') >= 0,
  'праворуч — картка відділу: ' + b2c.зони.join(' · '),
  'картки відділу в панелі немає: ' + JSON.stringify(b2c));
ok(!b2c.стара, 'старих B2B-блоків («Наступна дія», «Нагадування», «Макет у відділі») немає',
   'у панелі лишились блоки старої картки');
ok(b2c.інстаграм, 'кнопка Instagram унизу на місці', 'смужки Instagram немає');
ok(/^#2\d+/.test(b2c.номер), 'номер — відділу: ' + b2c.номер, 'номер: ' + b2c.номер);

/* Дія в картці перемальовує саме цю панель, а не дошку відділу. */
const дія = await p.evaluate(async () => {
  const d = document.getElementById('orderDrawer');
  const f = d.querySelector('[data-fold="Гроші"]');
  const was = !!d.querySelector('.dz-z.is-fold.open');
  if(f) f.click();
  await new Promise(r => setTimeout(r, 400));
  return { є: !!f, було: was, стало: !!d.querySelector('.dz-z.is-fold.open'),
           уПанелі: !!d.querySelector('.dz-solo') };
});
console.log('  ' + JSON.stringify(дія));
ok(дія.є && дія.стало !== дія.було && дія.уПанелі,
  'дії працюють просто в панелі: зону «Гроші» розгорнули, картка лишилась на місці',
  'дія в панелі: ' + JSON.stringify(дія));

const закрити = await p.evaluate(async () => {
  const d = document.getElementById('orderDrawer');
  const x = d.querySelector('.dz-solo [data-close]');
  if(x) x.click();
  await new Promise(r => setTimeout(r, 300));
  return { хрестик: !!x, відкрита: d.classList.contains('open') };
});
ok(закрити.хрестик && !закрити.відкрита, '× закриває панель', 'закриття: ' + JSON.stringify(закрити));

console.log('');
console.log('═══ B2B — СВОЯ КАРТКА, ЯК І БУЛА ═══');
const b2b = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000077');
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('orderDrawer');
  return { відділ: !!d.querySelector('.dz-solo'), od: !!d.querySelector('.od-body') };
});
ok(!b2b.відділ && b2b.od, 'B2B-замовлення відкривається своєю карткою', 'B2B: ' + JSON.stringify(b2b));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
