/* МОКАП: МАКЕТ НА ВИРОБІ, І САНТИМЕТРИ ПІД НИМ.

   Андрій: «ми без мокапа не можемо відправити… завантажуєш фотку,
   зʼявляється кнопка створити мокап, натискається — і автоматично ця ж сама
   фотографія закидується на цей самий мокап. Там він пересуває… потім
   менеджеру дається викачка в гарному файлі, в горизонтальному форматі:
   перша — картинка, яку ми намалювали, друга — мокап, внизу склад і
   примітка і розміщення… ширина виробу відносно того, який ми обрали:
   взяли Ельку — рахуємо як на Ельки, взяли Еску — як на Есці. Також
   розміщення від горловини і з боку.»

   Найцінніше тут не картинка, а ЦИФРИ. Мокап «на око» ми й доти вміли — у
   чужій програмі, у вільному масштабі; чого не вміли, так це відповісти
   виробництву, скільки сантиметрів. Тому перевіряємо саме арифметику:

     1. без мокапу здати не можна — кнопка не працює й каже чому;
     2. сантиметри рахуються з розмірної сітки товару;
     3. той самий файл на S і на XL дає РІЗНУ ширину в сантиметрах;
     4. немає сітки — немає й чисел, і про це сказано вголос;
     5. розміщення їде разом із версією, а не збоку;
     6. картка для менеджера збирається горизонтальним аркушем.

   Запуск:  node tests/mockup.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8923;
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
  team: [{ email:'test@loomiq', name:'Оля', role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Розмірна сітка — джерело всіх сантиметрів. Колонки стандартні:
     A — довжина, B — ширина (від шва під рукавом до шва), тобто рівно
     видима ширина виробу на фронтальному знімку. */
  sizecharts: { tee: [['S', 68, 46], ['M', 70, 51], ['L', 72, 56], ['XL', 74, 61]] }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', crmChatId:'c1', crmNick:'asia_dera',
    items:[] }
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
const каже = [];
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
/* Ловимо все, що адмінка каже людині: половина цієї роботи — саме слова,
   якими вона пояснює, чому чогось не можна. */
await p.evaluate(() => {
  window.__SAID = [];
  const був = window.toast;
  window.toast = m => { window.__SAID.push(String(m)); try{ був(m); }catch(e){} };
});

const АРТ = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">' +
  '<rect width="120" height="60" fill="#E4572E"/></svg>').toString('base64');
const ЗАВЕСТИ = size => `(() => {
  const АРТ = ${JSON.stringify(АРТ)};
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobMake('2000101');
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'${size}', qty:2, note:'Лого по центру' })];
  const d = D.dzNew();
  D.dzAttach(d, 'test@loomiq', 'mgr@loomiq');
  D.dzSend(d, 'mgr@loomiq');
  D.dzTake(d, 'test@loomiq');
  /* Чернетка здачі: робота вже завантажена й покладена на перед. Так воно
     й буває після першого ж кроку у вікні — інакше вікно відкривається
     порожнім і питати в нього нема про що. */
  d.draft = { works: [{ name:'лого.png', url: АРТ }],
              places: [{ side:'front', work:0, x:0.5, y:0.34, w:0.26 }] };
  D.dzList(job.units[0], 'graphic').push(d);
  openDesign();
  U.setTab('graphic');
  U.open('2000101');
  U.render(document.getElementById('dzRoot'));
})()`;
await p.evaluate(ЗАВЕСТИ('M'));
await p.waitForTimeout(800);

console.log('\n═══ ОДНА КНОПКА ЗАМІСТЬ ТРЬОХ КРОКІВ ═══');
/* Кроків «Макет → Мокап → Надіслати» більше немає, і це свідома зміна
   рішення. Вони описували не роботу, а порядок натискань — і саме тому
   бентежили. Андрій: «одна кнопка завантажити роботу у дизайнера, він
   завантажує роботу і вже в попапі це все він налаштовує».

   Тепер натиск відкриває вікно, у якому й вантажать, і розкладають по
   сторонах, і віддають. Порядок дій дизайнер тримає в руках, а не читає
   з екрана. */
const здача = await p.evaluate(() => ({
  кроків: document.querySelectorAll('.dz-step').length,
  кнопка: ((document.querySelector('[data-do="dz-work"]') || {}).textContent || '').trim(),
  старі: [...document.querySelectorAll('[data-do="dz-art"],[data-do="dz-hand"]')].length
}));
console.log('  ' + JSON.stringify(здача));
ok(!здача.кроків,
  'кроків більше немає — порядок дій не треба читати з екрана',
  'кроки здачі лишились: ' + здача.кроків);
ok(/Завантажити роботу/.test(здача.кнопка),
  'замість них одна кнопка: ' + здача.кнопка,
  'кнопки здачі немає: ' + здача.кнопка);
ok(!здача.старі,
  'і жодного залишку старого шляху',
  'старі кнопки здачі лишились: ' + здача.старі);

console.log('\n═══ САНТИМЕТРИ — З РОЗМІРНОЇ СІТКИ ═══');
/* Фото виробу не знає свого масштабу. Виріб на ньому розмічають один раз:
   смуга по ширині — це «Ширина» з сітки, у сантиметрах. */
const міра = await p.evaluate(() => {
  const M = window.LQMock;
  return { S: M.widthCm('tee', 'S'), M: M.widthCm('tee', 'M'),
           L: M.widthCm('tee', 'L'), XL: M.widthCm('tee', 'XL'),
           немає: M.widthCm('tee', 'XXXL'), чужий: M.widthCm('hoodie', 'M') };
});
console.log('  ' + JSON.stringify(міра));
ok(міра.S === 46 && міра.M === 51 && міра.L === 56 && міра.XL === 61,
  'ширина виробу читається з сітки товару для кожного розміру',
  'ширини з сітки не читаються: ' + JSON.stringify(міра));
/* ГОЛОВНЕ ПРО РОЗМІРИ. Логотип 22 см на S і на XL — це два різні логотипи,
   хоч файл один. Андрій: «взяли Ельку — рахуємо як на Ельки». */
ok(міра.L > міра.S,
  'і вони РІЗНІ: той самий файл на S і на L — різні пропорції',
  'розміри дають ту саму ширину — перерахунку немає');
/* Немає сітки — немає й чисел. Вигадане число тут гірше за його
   відсутність: за ним шиють. */
ok(!міра.немає && !міра.чужий,
  'а чого в сітці немає — те й не вигадуємо: нуль, а не приблизно',
  'ширину вигадано там, де її немає: ' + JSON.stringify(міра));

console.log('\n═══ ТОЙ САМИЙ ФАЙЛ НА РІЗНИХ РОЗМІРАХ ═══');
/* Рахуємо те саме розміщення (та сама частка кадру) під S і під XL — і
   переконуємось, що сантиметри розійшлись. Це і є «рахуємо як на Ельки». */
const порівняння = await p.evaluate(() => {
  const M = window.LQMock;
  /* Смуга розмітки — 56% кадру завширшки; макет — 26% кадру. Отже макет
     займає 26/56 ширини виробу, хай якого розміру. */
  const частка = 0.26 / 0.56;
  return { S: Math.round(частка * M.widthCm('tee', 'S') * 10) / 10,
           XL: Math.round(частка * M.widthCm('tee', 'XL') * 10) / 10 };
});
console.log('  S: ' + порівняння.S + ' см · XL: ' + порівняння.XL + ' см');
ok(порівняння.XL > порівняння.S + 5,
  'та сама частка виробу — різні сантиметри: ' +
    порівняння.S + ' на S проти ' + порівняння.XL + ' на XL',
  'сантиметри не залежать від розміру: ' + JSON.stringify(порівняння));

console.log('\n═══ ВІКНО ЗДАЧІ ВІДКРИВАЄТЬСЯ Й РАХУЄ ═══');
const вікно = await p.evaluate(async () => {
  document.querySelector('[data-do="dz-work"]').click();
  await new Promise(r => setTimeout(r, 1400));
  const w = document.querySelector('.mko-wrap');
  if(!w) return { є:false, чому: (window.__SAID || []).join(' | ') };
  return { є:true,
    числа: [...w.querySelectorAll('.mko-n')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
    нота: (w.querySelector('.mko-note') || {}).textContent.replace(/\s+/g, ' ').trim(),
    розмітка: w.querySelectorAll('[data-mko-cal-h]').length,
    макетНаСцені: !!w.querySelector('.mko-art img') };
});
console.log('  ' + JSON.stringify(вікно.числа || вікно));
console.log('  ' + (вікно.нота || ''));
ok(вікно.є && вікно.макетНаСцені,
  'вікно відкрилось, і той самий завантажений файл уже лежить на виробі',
  'вікно мокапу не відкрилось або макета в ньому немає');
ok(вікно.розмітка === 3,
  'виріб розмічають трьома лініями: дві по ширині, одна по горловині',
  'ліній розмітки не три: ' + вікно.розмітка);
ok((вікно.числа || []).some(t => /Ширина нанесення/.test(t)) &&
   (вікно.числа || []).some(t => /Від горловини/.test(t)) &&
   (вікно.числа || []).some(t => /Від центру/.test(t)),
  'і числа рахуються одразу: ширина, висота, від горловини, від центру',
  'чисел у вікні немає: ' + JSON.stringify(вікно.числа));
ok(/розмір M/.test(вікно.нота) && /51/.test(вікно.нота),
  'сказано вголос, під який розмір рахує: ' + вікно.нота,
  'не сказано, під який розмір рахунок: ' + вікно.нота);

console.log('\n═══ НЕМАЄ СІТКИ — НЕМАЄ Й ЧИСЕЛ, І ЦЕ СКАЗАНО ═══');
const мовчки = await p.evaluate(async () => {
  window.LQMock.close();
  const U = window.LQDesign.ui;
  designJobs['2000101'].units[0].size = 'XXXL';   // такого рядка в сітці немає
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 250));
  document.querySelector('[data-do="dz-work"]').click();
  await new Promise(r => setTimeout(r, 1400));
  const w = document.querySelector('.mko-wrap');
  return { числа: w ? w.querySelectorAll('.mko-n').length : -1,
           нота: w ? (w.querySelector('.mko-note') || {}).textContent.replace(/\s+/g, ' ').trim() : '' };
});
console.log('  ' + JSON.stringify(мовчки));
ok(мовчки.числа === 0,
  'чисел немає — бо їх нема з чого порахувати',
  'числа зʼявились без сітки: ' + мовчки.числа);
ok(/розмірної сітки/.test(мовчки.нота) && /вигадувати/.test(мовчки.нота),
  'і сказано словами, чому: ' + мовчки.нота,
  'мовчазний прочерк замість пояснення: ' + мовчки.нота);

console.log('\n═══ РОЗМІЩЕННЯ ЇДЕ РАЗОМ ІЗ ВЕРСІЄЮ ═══');
/* Версій буває чотири, і в кожної своє розташування. Одне число «на дизайн»
   означало б, що виробництво шиє за міркою від макета, який переробили. */
const версія = await p.evaluate(async () => {
  window.LQMock.close();
  const D = window.LQDesign, U = D.ui;
  const d = D.dzList(designJobs['2000101'].units[0], 'graphic')[0];
  D.dzVer(d, 'test@loomiq',
    [{ name:'макет.png', url:'https://x/1.png' }, { name:'мокап.png', url:'https://x/2.png' }],
    'готово', { wCm:23.7, hCm:11.8, topCm:14.9, sideCm:0, size:'M' });
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 250));
  return { при: (d.vers[0].place || {}).wCm,
           /* Окремого списку версій у дизайнера більше немає: здача лягає в
              переписку повідомленням, і розміщення стоїть у ньому ж. */
           /* Андрій: сантиметрів і відстаней під версією не пишемо — вони
              на самій картці. У розмові лише «Версія N» і плитки. */
           видно: ((document.querySelector('.dz-ch-m.is-ver') || {}).textContent || '').trim(),
           плиток: document.querySelectorAll('.dz-ch-m.is-ver .dz-tile').length };
});
console.log('  ' + JSON.stringify(версія));
ok(версія.при === 23.7,
  'розміщення записане в саму версію, а не збоку від дизайну',
  'розміщення не при версії: ' + версія.при);
ok(/Версія 1/.test(версія.видно) && !/горловини/.test(версія.видно),
  'у розмові — «Версія 1» без сантиметрів: розміри на самій картці',
  'версія в розмові не та: ' + версія.видно);
ok(версія.плиток === 2,
  'робота й мокап — двома плитками з переглядом і скачуванням',
  'плиток при версії: ' + версія.плиток);

console.log('\n═══ КАРТКА ДЛЯ МЕНЕДЖЕРА ═══');
/* Її пересилають: у Директ, підряднику, в цех — скрізь, де відкрити нашу
   адмінку не можна, а знати, що і як шити, треба. Тому один аркуш, а не
   три файли й усний переказ. */
const аркуш = await p.evaluate(async () => {
  const мала = 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40">' +
    '<rect width="80" height="40" fill="#E4572E"/></svg>');
  const png = await window.LQMock.card({
    art: мала, mock: мала, title:'#2000001 · версія 1',
    nums: [['Виріб','Футболка базова'], ['Колір','Чорний'], ['Розмір','M'],
           ['Кількість','2 шт'], ['Нанесення','23,7 см × 9,5 см']],
    wideCm: 51, artCm: 23.7, sideCm: 0,
    contacts: ['+380 67 000 31 00', 'hello@loomiq.net', 'loomiq.net'],
    note: 'Колір виробу на екрані може відрізнятись від тканини.'
  });
  if(!png) return { є:false };
  const im = new Image();
  await new Promise(r => { im.onload = r; im.onerror = r; im.src = png; });
  return { є:true, w:im.width, h:im.height, байтів: png.length };
});
console.log('  ' + JSON.stringify(аркуш));
ok(аркуш.є && аркуш.w > 0,
  'аркуш зібрався картинкою: ' + аркуш.w + '×' + аркуш.h,
  'аркуш не зібрався');
/* Ширина — та сама, що в картці комерційної пропозиції. Обидва аркуші
   виходять від нас до клієнта й до цеху, часто в одному листуванні, і
   різний розмір читався б як різні компанії. */
ok(аркуш.w === 1240,
  'і тієї самої ширини, що картка КП — 1240, а не схожої',
  'ширина аркуша розійшлась із КП: ' + аркуш.w);
ok(аркуш.w > аркуш.h * 0.9,
  'дві картинки стоять поруч, а не одна під одною',
  'аркуш витягнувся вгору: ' + аркуш.w + '×' + аркуш.h);

console.log('\n═══ КАРТКА БЕЗ ШАПКИ: ЗАГОЛОВОК, НОМЕР, ПІДПИСИ НАД РАМКАМИ ═══');
/* Андрій: шапки немає — ні «Loomiq · виробництво мерчу», ні контактів;
   зверху заголовок, справа лише номер; над рамками «Макет» і «Макет на
   виробі»; фото підрізаються, як у картках B2B; унизу опис і примітка.
   Перевіряємо, що в картинці справді немає контактів (порівнюємо з
   картинкою без них — пікселі мусять збігтись), і що заголовок береться
   з налаштувань. */
const безШапки = await p.evaluate(async () => {
  const мала = 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#EEE8E1"/>' +
    '<rect x="90" y="120" width="120" height="160" fill="#111"/></svg>');
  const base = { art: мала, mock: мала, title:'Макет на узгодження', no:'#2000043-1',
    nums: [['Модель','Футболка базова'], ['Колір','Чорний'], ['Розмір','XL'],
           ['Кількість','1 шт'], ['Нанесення','Вишивка'], ['Розмір нанесення','10 см × 8 см']] };
  const a = await window.LQMock.card(base);
  const b2 = await window.LQMock.card(Object.assign({}, base, { contacts:['+380 67 000 31 00', 'hello@loomiq.net'] }));
  /* Рамка заповнена кадром до країв: кут рамки — тло кадру, а не сіра підкладка. */
  const im = new Image();
  await new Promise(r => { im.onload = r; im.src = a; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const px = x.getImageData(64 + 30, 56 + 44 + 28 + 30 + 30, 1, 1).data;
  return { контактиІгноруються: a === b2, кутРамки: [px[0], px[1], px[2]],
           заголовок: (function(){ try{ return window.LQDesign.ui.host.cardTitle(); }catch(e){ return ''; } })() };
});
console.log('  ' + JSON.stringify(безШапки));
ok(безШапки.контактиІгноруються, 'контактів і «Loomiq · виробництво мерчу» на картці немає', 'контакти й далі малюються');
ok(Math.abs(безШапки.кутРамки[0] - 0xEE) < 6 && Math.abs(безШапки.кутРамки[2] - 0xE1) < 6,
  'кадр заповнює рамку до країв — у куті рамки тло самого фото', 'кут рамки: ' + безШапки.кутРамки);
ok(безШапки.заголовок === 'Макет на узгодження', 'заголовок за замовчуванням — «Макет на узгодження» (міняється в налаштуваннях)',
   'заголовок: ' + безШапки.заголовок);

console.log('\n═══ НА КАРТЦІ — ПРИМІТКА ═══');
/* Дві речі, яких аркушу бракувало.

   ПРИМІТКА. Те, що доти писали руками в кожному повідомленні: колір на
   екрані відрізняється від тканини. Писати це щоразу заново означає одного
   разу не написати — і саме тоді почути «а в мене інший відтінок».

   ПРОПОРЦІЯ. «23,7 см» саме по собі нічого не каже: багато це чи мало,
   залежить від того, на чому воно лежить. Тому смуга виробу, а в ній —
   смуга нанесення. */
const проПримітку = await p.evaluate(async () => {
  const мала = 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40">' +
    '<rect width="80" height="40" fill="#E4572E"/></svg>');
  const дані = { art: мала, mock: мала, title:'#2000001 · версія 1',
    nums: [['Виріб','Футболка базова'], ['Колір','Чорний'], ['Розмір','M']],
    contacts: ['+380 67 000 31 00', 'loomiq.net'] };
  const зміряти = async d => {
    const png = await window.LQMock.card(d);
    const im = new Image();
    await new Promise(r => { im.onload = r; im.onerror = r; im.src = png; });
    return im.height;
  };
  return {
    гола: await зміряти(дані),
    зНотою: await зміряти(Object.assign({}, дані, {
      note:'Колір виробу на екрані може відрізнятись від тканини: монітори ' +
           'передають відтінки по-різному. Розміри нанесення вказані з точністю ' +
           'до сантиметра.' })),
    зіСмугою: await зміряти(Object.assign({}, дані, { wideCm:51, artCm:23.7, sideCm:0 })),
    /* Примітка з налаштувань доїжджає до картки тим самим шляхом, що й усе
       інше, — через робоче місце, а не зашита в малювальнику. */
    зНалаштувань: (function(){
      try{ return window.LQDesign.ui.host.cardNote(); }catch(e){ return ''; }
    })()
  };
});
console.log('  ' + JSON.stringify(проПримітку));
ok(проПримітку.зНотою > проПримітку.гола + 40,
  'примітка справді лягає на аркуш, а не зникає за його краєм: ' +
    проПримітку.гола + ' → ' + проПримітку.зНотою + ' px',
  'примітка нічого не змінила: аркуш лишився ' + проПримітку.зНотою);
/* Смугу «ширина виробу проти нанесення» Андрій прибрав: розмір нанесення
   стоїть в описі, а смуга лише займала місце. */
ok(проПримітку.зіСмугою === проПримітку.гола,
  'смуги «ширина виробу» на картці більше немає — розмір нанесення в описі',
  'смуга й далі малюється: ' + проПримітку.гола + ' → ' + проПримітку.зіСмугою);
ok(/колір/i.test(проПримітку.зНалаштувань || ''),
  'а текст примітки береться з налаштувань: ' +
    String(проПримітку.зНалаштувань).slice(0, 60) + '…',
  'примітка не приходить із налаштувань: ' + проПримітку.зНалаштувань);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nмокап робиться тут, і сантиметри під ним справжні');
process.exit(bad ? 1 : 0);
