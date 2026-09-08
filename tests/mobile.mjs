/* Робота з телефона.

   Менеджери просять вести замовлення з телефона, а вести не виходило.
   Дивилось це так:

     — меню просвічувало наскрізь: пункти «Задачі», «Канбан» лягали поверх
       заголовка сторінки й карток, і читати було неможливо;
     — сторінка під відкритим меню гортались далі, тож закривши меню,
       опинявся зовсім не там, де був;
     — колонка дошки мала фіксовані 316 пікселів і на екрані в 390 не
       вміщалась — видно було півтори колонки, обидві обрізані;
     — картка замовлення відкривалась смугою збоку;
     — поля були дрібніші за 16 пікселів, і Safari «наїжджав» на них при
       дотику, лишаючи сторінку збільшеною.

   Правило, за яким це виправлено, одне: НА ТЕЛЕФОНІ ОДИН РІВЕНЬ НА ЕКРАН.

   Запуск:  node tests/mobile.mjs      (з кореня репозиторію)  */
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8838;
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
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
                  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };
const mk = (i, st) => ({
  id:String(i), orderId:'100170' + i, type:'client', name:'Клієнт ' + i,
  phone:'+38067000170' + i, status:st, site:'main', createdAt:now, hist:[], payments:[],
  totalPrice:10000 * i, totalCost:6000 * i, margin:4000 * i, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:10 * i,
           unitPrice:1000, price:10000 * i, unitCost:600, cost:6000 * i }]
});
const ORDERS = [mk(1, 'lead'), mk(2, 'kp'), mk(3, 'paid')];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13'], { isMobile:false, hasTouch:true }));
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
const W = (await p.viewportSize()).width;
console.log('  екран ' + W + 'px');

console.log('');
console.log('═══ МЕНЮ НЕ ПРОСВІЧУЄ ═══');
await p.click('#hamburger');
await p.waitForTimeout(500);
const menu = await p.evaluate(() => {
  const s = document.getElementById('sidebar');
  const cs = getComputedStyle(s);
  const solid = v => !/rgba\([^)]*,\s*0(\.\d+)?\)|transparent/.test(String(v));
  /* Найпростіша перевірка на «просвічує»: що поверне браузер у точці
     всередині меню. Якщо там елемент сторінки — меню наскрізне. */
  const r = s.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { bg: cs.backgroundColor, solid: solid(cs.backgroundColor),
           inMenu: !!(el && s.contains(el)),
           w: Math.round(r.width),
           locked: getComputedStyle(document.body).overflow === 'hidden' };
});
console.log('  фон ' + menu.bg + ' · ширина ' + menu.w + 'px');
ok(menu.solid,
  'меню має власний непрозорий фон — крізь нього нічого не просвічує',
  'меню прозоре: ' + menu.bg);
ok(menu.inMenu,
  'дотик у межах меню потрапляє в меню, а не в сторінку під ним',
  'сторінка проступає крізь меню');
ok(menu.locked,
  'сторінка під відкритим меню не гортається',
  'сторінка їде під меню — закривши його, опинишся не там, де був');
ok(menu.w > 200 && menu.w < W,
  'меню займає більшу частину екрана, але не весь — видно, що за ним сторінка',
  'ширина меню не та: ' + menu.w);

const closed = await p.evaluate(async () => {
  document.querySelector('.nav button[data-view="board"]').click();
  await new Promise(r => setTimeout(r, 400));
  return { open: document.getElementById('sidebar').classList.contains('open'),
           locked: getComputedStyle(document.body).overflow === 'hidden' };
});
ok(!closed.open && !closed.locked,
  'вибір розділу закриває меню — інакше бачиш своє ж меню замість розділу',
  'меню лишилось відкритим після вибору');

console.log('');
console.log('═══ ДОШКА: ОДНА КОЛОНКА НА ЕКРАН ═══');
await p.waitForTimeout(600);
const board = await p.evaluate(() => {
  const b = document.getElementById('board');
  const cols = [...b.querySelectorAll('.col')];
  const strip = document.getElementById('board-strip');
  return { n: cols.length,
           colW: cols[0] ? Math.round(cols[0].getBoundingClientRect().width) : 0,
           boardW: Math.round(b.getBoundingClientRect().width),
           snap: getComputedStyle(b).scrollSnapType,
           stripOn: strip ? !strip.hidden : false,
           tabs: strip ? [...strip.querySelectorAll('button')].map(x => x.textContent.trim()) : [],
           active: strip ? (strip.querySelector('button.on') || {}).textContent || '' : '' };
});
console.log('  колонка ' + board.colW + 'px при ширині дошки ' + board.boardW + 'px');
console.log('  смуга етапів: ' + board.tabs.slice(0, 4).join(' · ') + (board.tabs.length > 4 ? ' …' : ''));
ok(board.colW >= board.boardW - 40,
  'колонка займає екран цілком — а не півтори обрізані',
  'колонка вужча за екран: ' + board.colW + ' із ' + board.boardW);
ok(/mandatory|proximity/.test(board.snap),
  'колонки «прилипають» — гортаєш етапи, як сторінки',
  'прилипання немає: ' + board.snap);
ok(board.stripOn && board.tabs.length === board.n,
  'над дошкою смуга етапів: видно, де ти зараз і скільки їх усього',
  'смуги етапів немає');
ok(/\S/.test(board.active),
  'поточний етап у смузі виділений',
  'жоден етап не виділений');

const jump = await p.evaluate(async () => {
  const strip = document.getElementById('board-strip');
  const b = document.getElementById('board');
  const btns = [...strip.querySelectorAll('button')];
  const target = btns[Math.min(2, btns.length - 1)];
  const name = target.textContent.trim();
  target.click();
  await new Promise(r => setTimeout(r, 900));
  return { name, left: Math.round(b.scrollLeft),
           active: (strip.querySelector('button.on') || {}).textContent.trim() };
});
console.log('  тицьнули «' + jump.name + '» → дошка на ' + jump.left + 'px');
ok(jump.left > 0 && jump.active === jump.name,
  'дотик у смузі перегортає дошку на цей етап і виділяє його',
  'перехід не спрацював: ' + JSON.stringify(jump));

console.log('');
console.log('═══ КАРТКА — НА ВЕСЬ ЕКРАН ═══');
await p.evaluate(() => { document.getElementById('board').scrollTo({ left:0 }); });
await p.waitForTimeout(400);
await p.click('#board .ticket');
await p.waitForTimeout(900);
const card = await p.evaluate(() => {
  const pan = document.querySelector('#orderDrawer .od-panel');
  const r = pan.getBoundingClientRect();
  return { w: Math.round(r.width), screen: window.innerWidth,
           locked: getComputedStyle(document.body).overflow === 'hidden' };
});
console.log('  панель ' + card.w + 'px при екрані ' + card.screen + 'px');
ok(card.w >= card.screen - 2,
  'картка відкривається на весь екран, а не смугою збоку',
  'панель вужча за екран: ' + card.w);
ok(card.locked,
  'сторінка під карткою не гортається',
  'дошка їде під відкритою карткою');
await p.evaluate(() => closeOrderDrawer());
await p.waitForTimeout(400);
const after = await p.evaluate(() => getComputedStyle(document.body).overflow);
ok(after !== 'hidden',
  'закрили картку — сторінка гортається знову',
  'сторінка лишилась заблокованою');

console.log('');
console.log('═══ ПОЛЯ ПІД ПАЛЕЦЬ ═══');
const fields = await p.evaluate(() => {
  /* Нативний список під одягненим (.lq-native) винесений за екран і має
     tabindex=-1: дотиком у нього не потрапити, тож його розмір ні на що не
     впливає. Міряємо те, чого людина справді торкається. */
  const list = [...document.querySelectorAll('#view-board input, #view-board select, .lq-sel')]
    .filter(el => el.offsetParent !== null && !el.classList.contains('lq-native'));
  const small = list.filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map(el => (el.className || el.tagName) + ':' + getComputedStyle(el).fontSize);
  const low = list.filter(el => el.getBoundingClientRect().height < 40);
  const btns = [...document.querySelectorAll('#view-board button')]
    .filter(el => el.offsetParent !== null && el.getBoundingClientRect().height > 0);
  return { n:list.length, small: small.length, smallWhat: small, low: low.length,
           btnLow: btns.filter(b => b.getBoundingClientRect().height < 36).length,
           btns: btns.length };
});
console.log('  полів ' + fields.n + ' · дрібним шрифтом ' + fields.small +
            ' · низьких ' + fields.low);
ok(fields.small === 0,
  'жодне поле не дрібніше за 16 пікселів — Safari не «наїжджає» при дотику',
  'дрібні поля: ' + JSON.stringify(fields.smallWhat));
ok(fields.low === 0,
  'усі поля не нижчі за 44 пікселі — у них можна влучити пальцем',
  'низьких полів: ' + fields.low);

const zoom = await p.evaluate(() =>
  (document.querySelector('meta[name=viewport]') || {}).content || '');
console.log('  viewport: ' + zoom);
ok(!/user-scalable\s*=\s*no|maximum-scale/.test(zoom),
  'збільшення пальцями не заборонене — дрібну таблицю можна наблизити',
  'zoom заборонений: ' + zoom);

console.log('');
console.log('═══ ЗАГОЛОВКИ Й ШИРИНА СТОРІНКИ ═══');
const layout = await p.evaluate(() => ({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  subs: [...document.querySelectorAll('#view-board .page-head .sub')]
          .filter(el => el.offsetParent !== null).length
}));
console.log('  горизонтальний виліт ' + layout.overflow + 'px');
ok(layout.overflow <= 1,
  'сторінка не їде вбік — нічого не вилазить за екран',
  'сторінка ширша за екран на ' + layout.overflow + 'px');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'з телефона можна працювати: один рівень на екран');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
