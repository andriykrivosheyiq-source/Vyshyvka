/* Переписка — зона робочого місця, а не попап поверх усього.

   ЯК БУЛО. Розмова відкривалась модальним вікном: затемнення на весь екран,
   вікно по центру. Поки воно відкрите, не видно ні дошки, ні картки — а саме
   в картці лежить те, про що йдеться в розмові. Щоб звірити суму чи склад
   замовлення, доводилось закрити розмову, подивитись і відкрити знову.

   ЯК СТАЛО. Три зони одночасно: меню ліворуч, переписка посередині, картка
   праворуч. Дошку на цей час ховаємо — у просвіті між меню й карткою колонки
   все одно не читаються. Закривається зона хрестиком у своєму правому
   верхньому куті, на межі з карткою.

   Перевіряємо:
     — зона стоїть МІЖ меню й карткою й не налазить на жодне з них;
     — картка лишається видимою й робочою — заради цього все й робилось;
     — дошка схована, а після закриття розмови повертається;
     — хрестик стоїть угорі праворуч зони;
     — закрили розмову — картка лишилась; закрили картку — розмова закрилась;
     — розмова з дошки (картки немає) займає всю ширину;
     — на телефоні зон немає: розмова на весь екран, як і була.

   Запуск:  node tests/chat-zone.mjs      (з кореня репозиторію)  */
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
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const CONTENT = { quickReplies:[{ t:'КП готове', m:'Вітаю! Ось пропозиція: {кп}' }] };
const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Оксана', phone:'+380670001001',
  status:'kp', site:'main', offerToken:'tok123456', payments:[],
  tgChatId:'4242', tgWrote:true, tgLast:'Вітаю', tgAt:new Date().toISOString(),
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000, unitCost:350, cost:7000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
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
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

/* Геометрія зон очима, а не за класами: класи можна перейменувати, а от
   «переписка налізла на картку» видно тільки в координатах. */
const zones = () => p.evaluate(() => {
  const box = el => { if(!el) return null; const r = el.getBoundingClientRect();
    return { l:Math.round(r.left), r:Math.round(r.right), t:Math.round(r.top),
             w:Math.round(r.width), h:Math.round(r.height) }; };
  const cw = document.querySelector('.cw-wrap.open');
  const mainEl = document.querySelector('main');
  const panel = document.querySelector('#orderDrawer.open .od-panel');
  const x = cw && cw.querySelector('.cw-x');
  return {
    chat: box(cw),
    nav: box(document.querySelector('.sidebar')),
    card: box(panel),
    x: box(x),
    boardOn: !!(mainEl && mainEl.offsetParent !== null),
    drawerOn: !!document.querySelector('#orderDrawer.open')
  };
});

console.log('═══ ТРИ ЗОНИ ОДНОЧАСНО ═══');
await p.evaluate(async () => {
  await openOrderDrawer(orders[0]);
  chatOpen(orders[0], 'tg');
});
await p.waitForTimeout(900);
const z = await zones();
if(!z.chat){ console.log('  зони переписки немає'); bad++; }
else {
  console.log('  меню 0–' + z.nav.r + ' · переписка ' + z.chat.l + '–' + z.chat.r +
              ' · картка ' + z.card.l + '–' + z.card.r);
  ok(z.chat.l >= z.nav.r,
    'переписка починається праворуч від меню, а не поверх нього',
    'переписка налізла на меню: ' + z.chat.l + ' < ' + z.nav.r);
  ok(z.card && z.chat.r <= z.card.l,
    'і закінчується ліворуч від картки — зони не перекриваються',
    'переписка налізла на картку: ' + z.chat.r + ' > ' + (z.card || {}).l);
  ok(z.chat.w > 300,
    'на зону лишилось достатньо ширини, щоб читати розмову',
    'зона вийшла вузькою смугою: ' + z.chat.w + 'px');
  ok(!z.boardOn,
    'дошка схована — у просвіті її колонки все одно не читаються',
    'дошка лишилась під перепискою');
  /* Заради цього все й робилось: картку видно, не закриваючи розмову. */
  const card = await p.evaluate(() =>
    ((document.querySelector('.od-panel .od-cl-nm') || {}).textContent || '').trim());
  ok(card === 'Оксана',
    'картку клієнта видно й читати її можна, не закриваючи розмову',
    'картка не читається: «' + card + '»');
  ok(z.x && z.x.t < z.chat.t + 80 && z.x.r > z.chat.r - 80,
    'хрестик стоїть угорі праворуч зони — на межі з карткою',
    'хрестик не там, де його шукатимуть: ' + JSON.stringify(z.x));
}

console.log('');
console.log('═══ ЗАКРИЛИ РОЗМОВУ — КАРТКА ЛИШИЛАСЬ ═══');
await p.evaluate(() => { document.querySelector('.cw-x').click(); });
await p.waitForTimeout(600);
const afterChat = await zones();
ok(!afterChat.chat, 'розмова закрилась', 'розмова не закрилась');
ok(afterChat.drawerOn, 'картка лишилась відкритою — її ніхто не просив закривати',
   'разом із розмовою закрилась і картка');
ok(afterChat.boardOn, 'дошка повернулась', 'дошка так і лишилась схованою');

console.log('');
console.log('═══ ЗАКРИЛИ КАРТКУ — РОЗМОВА ЗАКРИЛАСЬ ═══');
/* Зворотне неправда: розмова живе в картці, і лишати її висіти над порожнім
   місцем немає сенсу. */
await p.evaluate(() => chatOpen(orders[0], 'tg'));
await p.waitForTimeout(600);
await p.evaluate(() => closeOrderDrawer());
await p.waitForTimeout(600);
const afterCard = await zones();
ok(!afterCard.chat && !afterCard.drawerOn,
   'закрили картку — закрилась і розмова',
   'розмова лишилась висіти без картки');
ok(afterCard.boardOn, 'дошка повернулась', 'дошка лишилась схованою');

console.log('');
console.log('═══ РОЗМОВА З ДОШКИ ВІДКРИВАЄ Й ЗАМОВЛЕННЯ ═══');
/* Доти з дошки відкривалась САМА розмова, на всю ширину. А говорять у ній
   рівно про замовлення: що взяли, на скільки, коли відправка, скільки
   сплачено. Усе це доводилось згадувати або закривати розмову й лізти в
   картку — і повертатись назад. Тепер картка відкривається поруч. */
await p.evaluate(() => chatOpen(orders[0], 'tg'));
await p.waitForTimeout(700);
const solo = await zones();
const vw = await p.evaluate(() => window.innerWidth);
console.log('  переписка ' + (solo.chat || {}).l + '–' + (solo.chat || {}).r + ' із ' + vw);
ok(solo.drawerOn,
   'розмова з дошки відкриває й картку замовлення: говорять саме про неї',
   'картка не відкрилась');
ok(solo.chat && solo.chat.r < vw - 100,
   'і зона переписки лишає їй місце справа, а не займає весь екран',
   'переписка накрила картку: ' +
     JSON.stringify(solo.chat) + ' при ширині ' + vw);
ok(solo.chat && solo.chat.l >= solo.nav.r,
   'і меню все одно не перекрито',
   'переписка налізла на меню');

console.log('');
console.log('═══ НА ТЕЛЕФОНІ — НА ВЕСЬ ЕКРАН ═══');
await p.setViewportSize({ width:390, height:844 });
await p.waitForTimeout(600);
const phone = await p.evaluate(() => {
  const cw = document.querySelector('.cw-wrap.open');
  if(!cw) return null;
  const r = cw.getBoundingClientRect();
  return { l:Math.round(r.left), t:Math.round(r.top),
           w:Math.round(r.width), h:Math.round(r.height),
           vw:window.innerWidth, vh:window.innerHeight };
});
if(!phone){ console.log('  розмова зникла на вузькому екрані'); bad++; }
else {
  console.log('  ' + phone.w + '×' + phone.h + ' при екрані ' + phone.vw + '×' + phone.vh);
  ok(phone.l === 0 && phone.t === 0 && phone.w === phone.vw && phone.h === phone.vh,
    'на телефоні зон немає: розмова займає весь екран, як і була',
    'на телефоні розмова стала смугою: ' + JSON.stringify(phone));
}

console.log('');
console.log('═══ НАША КАРТИНКА — ПРАВОРУЧ І З ПІДПИСОМ ═══');
/* Андрій надіслав картку в Direct, і вона стала ЛІВОРУЧ, як клієнтська, ще
   й без імені менеджера під нею.

   Sitniks повертає наші власні повідомлення без відправника — відрізнити їх
   нічим, тож ми памʼятаємо в картці, що самі відправили. Але памʼятали
   цілим текстом РАЗОМ з адресою картинки, а читаючи стрічку назад, адресу
   з тексту вирізаємо — інакше замість фото було б простирадло на двісті
   символів. Шукали ключ із адресою, маючи на руках текст уже без неї. А в
   картинки без підпису після вирізання не лишалось нічого, чим її впізнати
   взагалі. Імʼя менеджера губилось разом із боком: воно в тому ж записі. */
const своє = await p.evaluate(() => {
  const URL_ = 'https://res.cloudinary.com/kmdoab3e/image/upload/v1/kartka.png';
  const o = { id:'1', name:'Оксана', crmChatName:'Оксана' };
  /* Запис такий, яким його кладе відправка: ключем іде САМА АДРЕСА. */
  window.crmOutNote(o, URL_);
  const ключі = (o.crmOut || []).map(r => r.t);
  (o.crmOut || []).forEach(r => { r.by = 'Олеся'; });
  const голе = window.crmNormMsgs([{ text: URL_ }], o) || [];
  const з_підписом = window.crmNormMsgs([{ text: 'Ось прорахунок\n' + URL_ }], o) || [];
  return { ключі,
           голе: голе[0] ? { mine:голе[0].mine, by:голе[0].by, файлів:голе[0].files.length } : null,
           підпис: з_підписом[0] ? { mine:з_підписом[0].mine, by:з_підписом[0].by } : null };
});
console.log('   ключі памʼяті: ' + JSON.stringify(своє.ключі));
ok(своє.ключі.some(k => k.indexOf('cloudinary') >= 0),
  'надіслане памʼятаємо ще й за адресою картинки, а не лише за текстом',
  'адреси серед ключів немає: ' + JSON.stringify(своє.ключі));
ok(своє.голе && своє.голе.mine === true,
  'картинка без підпису впізнається як НАША — і стає праворуч',
  'картинка без підпису лишилась ліворуч: ' + JSON.stringify(своє.голе));
ok(своє.голе && своє.голе.файлів === 1,
  'адреса показується картинкою, а не рядком тексту',
  'вкладення не вийнялось: ' + JSON.stringify(своє.голе));
ok(своє.голе && своє.голе.by === 'Олеся',
  'під нею видно, який саме менеджер надсилав',
  'підпису менеджера немає: ' + JSON.stringify(своє.голе));
ok(своє.підпис && своє.підпис.mine === true && своє.підпис.by === 'Олеся',
  'картинка З підписом упізнається так само',
  'підписана картинка не впізналась: ' + JSON.stringify(своє.підпис));

console.log('');
console.log('═══ КАРТКА ЙДЕ ВГОРУ ВІД БУДЬ-ЯКОЇ ДІЇ ═══');
/* Andрій: «наслав картинку — картка в канбані не підстрибнула вгору, хоча
   повинна». Рядок, що піднімає картку, стояв лише в дорозі для ТЕКСТУ.
   Правило ширше: вгору підіймає все, що з замовленням сьогодні робили, —
   наш лист, наша картинка, слово клієнта і заповнене поле в самій картці. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const між = (a, b) => adm.slice(adm.indexOf(a), adm.indexOf(b, adm.indexOf(a)));
  const фото = між('async function chatPhoto', '\n}\n');
  ok(/touchOrder\(o\)/.test(фото),
    'надіслана картинка піднімає картку так само, як лист',
    'після картинки картка лишається на місці');
  const поле = між("panel.querySelectorAll('.od-f')", 'od-note');
  ok(/touchOrder\(o\)/.test(поле),
    'заповнене поле в картці теж піднімає її вгору колонки',
    'правки в картці не піднімають її');
  const тг = між("if(o.tgLast !== last || o.tgWrote !== wrote)", 'touched = true');
  ok(/touchOrder\(o\)/.test(тг) && /o\.tgWrote != null/.test(тг),
    'слово клієнта піднімає картку — але не всі одразу при завантаженні сторінки',
    'вхідне повідомлення не піднімає картку або підніме геть усі');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'переписка стала зоною робочого місця, а не попапом поверх усього');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
