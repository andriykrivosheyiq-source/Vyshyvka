/* РОЗДІЛ РОЗМОВ НЕ КРУТИТЬСЯ САМ.

   Андрій: «мало того, що мені ще екран треба крутити, ще й сам діалог».
   У розмовах уже є дві власні прокрутки — список ліворуч і стрічка
   праворуч, — і третя, зовнішня, перетворює роботу на смикання: щоб
   дочитати повідомлення, доводилось крутити спершу сторінку, потім стрічку.

   Плюс діалог «обрізало»: вбудований у колонку, він успадковував висоту
   ПЛАВАЮЧОГО вікна — 100vh, — тобто був вищий за своє місце й ішов під
   нижній край.

   Перевіряємо не верстку, а три речі, які видно очима:
     1. вікно розділу не має зовнішньої прокрутки;
     2. діалог займає всю праву колонку по висоті, від верху до низу;
     3. крутиться саме стрічка, а список ліворуч — окремо.

   Тут же й пастка, на якій усе це стояло: розділи перемикаються інлайновим
   `style="display:…"`, а інлайн сильніший за стиль — тож ланцюг висоти
   мусить триматись без боротьби зі специфічністю.

   Запуск:  node tests/chat-layout.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8895;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }] };
/* Дві розмови різних напрямів: розкладка в розділів спільна, і поламати її
   легко рівно в одному з них. */
const мить = хв => new Date(Date.now() - хв * 60000).toISOString().replace('T', ' ').slice(0, 16);
const ORDERS = [
  { id:'1', orderId:'1000090', type:'client', name:'Марта', status:'prorahunok',
    site:'main', payments:[], hist:[], createdAt:'2026-09-24T09:00:00.000Z',
    crmChatId:'c90', crmChatName:'Марта Паращук', crmNick:'marta_p',
    crmUnread:1, crmTheirs:true, crmAt: мить(20), items:[] },
  { id:'2', orderId:'2000090', type:'client', dir:'b2c', name:'Асія', status:'prorahunok',
    site:'main', payments:[], hist:[], createdAt:'2026-09-24T10:00:00.000Z',
    crmChatId:'c91', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    crmUnread:1, crmTheirs:true, crmAt: мить(10), items:[] }
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
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
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

const міра = (dir) => p.evaluate(async (dir) => {
  const id = dir === 'b2c' ? 'view-chatsc' : 'view-chats';
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  document.querySelector('main').classList.add('is-chat');
  document.body.classList.add('chat-view');
  renderChats(dir);
  await new Promise(r => setTimeout(r, 300));
  const sec = document.getElementById(id);
  const row = sec.querySelector('.chl-row');
  if(row){ row.click(); await new Promise(r => setTimeout(r, 700)); }
  const main = document.querySelector('main');
  const ch2 = sec.querySelector('.ch2');
  const list = sec.querySelector('.ch2-list');
  const view = sec.querySelector('.ch2-view');
  const wrap = document.querySelector('.cw-wrap.cw-inline');
  const feed = wrap && wrap.querySelector('.cw-feed');
  const r = el => el ? el.getBoundingClientRect() : null;
  const v = r(view), w = r(wrap), c = r(ch2);
  return {
    сторінкаКрутиться: main.scrollHeight > main.clientHeight + 2,
    вікно: Math.round(main.clientHeight),
    ch2: c ? Math.round(c.height) : 0,
    колонка: v ? Math.round(v.height) : 0,
    діалог: w ? Math.round(w.height) : 0,
    зазорЗверху: (v && w) ? Math.round(w.top - v.top) : -1,
    зазорЗнизу: (v && w) ? Math.round(v.bottom - w.bottom) : -1,
    списокКрутиться: list ? getComputedStyle(list).overflowY : '—',
    стрічкаКрутиться: feed ? getComputedStyle(feed).overflowY : '—',
    відкрито: !!(wrap && wrap.classList.contains('open'))
  };
}, dir);

for(const [dir, назва] of [['b2b', 'Чати B2B'], ['b2c', 'Чати B2C']]){
  console.log('');
  console.log('═══ ' + назва.toUpperCase() + ' ═══');
  const m = await міра(dir);
  console.log('   вікно ' + m.вікно + ' · колонка ' + m.колонка + ' · діалог ' + m.діалог);
  ok(m.відкрито, 'розмова відкрилась у правій колонці',
     'розмова в колонці не відкрилась');
  /* ГОЛОВНЕ. Зовнішньої прокрутки бути не має: крутиться тільки те, що
     всередині, і кожне своє. */
  ok(!m.сторінкаКрутиться,
     'вікно розділу не прокручується — крутиться лише вміст',
     'сторінка й далі крутиться разом зі стрічкою');
  /* Діалог на всю колонку: доти він успадковував висоту плаваючого вікна й
     ішов під нижній край — це й було «обрізає». */
  ok(m.колонка > m.вікно * 0.7,
     'права колонка займає висоту вікна: ' + m.колонка + ' з ' + m.вікно,
     'колонка стиснулась до ' + m.колонка + ' з ' + m.вікно);
  ok(m.зазорЗверху >= 0 && m.зазорЗнизу >= 0 && m.зазорЗнизу < 8,
     'діалог стоїть від верху до низу колонки, без хвоста внизу',
     'діалог не збігається з колонкою: зверху ' + m.зазорЗверху +
       ', знизу ' + m.зазорЗнизу);
  ok(m.списокКрутиться === 'auto' || m.списокКрутиться === 'scroll',
     'список розмов крутиться окремо',
     'список не має власної прокрутки: ' + m.списокКрутиться);
  ok(m.стрічкаКрутиться === 'auto' || m.стрічкаКрутиться === 'scroll',
     'і стрічка повідомлень теж окремо',
     'стрічка не має власної прокрутки: ' + m.стрічкаКрутиться);
}

console.log('');
console.log('═══ КАРТКА ЗАМОВЛЕННЯ НАКРИВАЄ ДІАЛОГ, А НЕ ЕКРАН ═══');
/* Із розмови в картку заходять, щоб подивитись склад і повернутись назад у
   ту саму розмову. Тому вона стає на місце діалогу, а список розмов
   ліворуч лишається на видноті — інакше після закриття доводиться шукати,
   де ви були. */
const картка = await p.evaluate(async () => {
  const sec = document.getElementById('view-chatsc');
  const список = sec.querySelector('.ch2-list');
  const лівий = список ? Math.round(список.getBoundingClientRect().right) : 0;
  openOrderDrawer(orders.find(o => o.id === '2'));
  await new Promise(r => setTimeout(r, 400));
  const panel = document.querySelector('.od-wrap.open .od-panel');
  const r = panel ? panel.getBoundingClientRect() : null;
  return { є: !!panel, ліво: r ? Math.round(r.left) : 0,
           ширина: r ? Math.round(r.width) : 0, списокДо: лівий };
});
ok(картка.є, 'картка замовлення відкрилась', 'картка не відкрилась');
ok(картка.ширина > 520,
  'вона ширша за звичайну: ' + картка.ширина + ' px — у ній таблиця позицій',
  'картка лишилась вузькою: ' + картка.ширина);
ok(картка.ліво >= картка.списокДо - 4,
  'і не налазить на список розмов — після закриття видно, де ви були',
  'картка накрила список розмов: край ' + картка.ліво + ', список до ' + картка.списокДо);

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 2).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nрозмови стоять на місці, крутиться лише вміст');
process.exit(bad ? 1 : 0);
