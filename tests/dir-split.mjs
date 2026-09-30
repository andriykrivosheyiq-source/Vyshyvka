/* ДВА НАПРЯМИ — ДВІ КАРТКИ, І СІМ РОБОЧИХ ДНІВ ЗА ЗАМОВЧУВАННЯМ.

   Андрій:

     «Головне, в B2C і B2B в цих діалогових картах розділи їх максимально
      якісно, щоб не було ніяких проблем… тут КП немає, так що не потрібно
      робити КП… Головне, щоб там нічого не поламалося і в B2B в тому
      числі. Дивись, дні на замовчування, щоб я зараз не заходив в адмінку,
      постав 7 робочих днів, щоб вона рахувала. А там, щоб можна було здати
      до такого-то числа, це щоб можна було вручну настроїти… Повинна бути
      якась кнопочка, типу, відкрити всі повідомлення… дату ми можемо
      писати якимись маленькими під там, Володимир… щоб у нас основне
      повідомлення не закривалось, бо от я відправляю правку, і тут
      половину правки, яку я відправляю, я сам не можу її прочитати.»

   Перевіряємо рівно це:

     1. дата готовності стоїть сама, без походу в налаштування, і рахується
        робочими днями — вихідні не рахуються;
     2. руками поставлена дата лишається;
     3. у роздрібній картці немає КП, воріт тиражу й першої одиниці;
     4. у корпоративній вони на місці — нічого не зламалось;
     5. стрічка не ріже текст, дата стоїть під імʼям, а «Усі повідомлення»
        розкриває решту;
     6. версія без аркуша каже про це прямо й дає його зібрати.

   Запуск:  node tests/dir-split.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8931;
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
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Оля',       role:'designer' }]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', items:[] },
  { id:'2', orderId:'1000090', type:'client', name:'ТОВ Армор',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', items:[] }
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

console.log('\n═══ ДЕВʼЯТЬ ДНІВ — САМІ, БЕЗ НАЛАШТУВАНЬ ═══');
/* Порожні налаштування — найчастіший випадок, і доти саме він вимагав
   найбільше рухів: дати готовності не було взагалі, поки хтось не зайде в
   налаштування й не впише число.

   Дні звичайні, не робочі. Андрій: «сім робочих — це по факту девʼять
   днів; давай будемо ставити не в робочих, а в звичайних». З клієнтом
   розмова йде в днях, і число, яке треба подумки переводити в інше число,
   рано чи пізно переведуть неправильно — причому саме той, хто обіцяв. */
const строк = await p.evaluate(() => {
  /* Відділ спершу відкриваємо: заготовку строку панель бере в адмінки, і
     до першого відкриття вона про неї просто не знає. */
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign();
  const U = window.LQDesign.ui;
  /* 25.09.2026 плюс девʼять днів — 04.10. Жодних пропусків вихідних:
     вони враховані наперед самим числом. */
  const заготовка = U.readyFrom({ createdAt:'2026-09-25T09:00:00.000Z' });
  const свій = U.readyFrom({ createdAt:'2026-09-25T09:00:00.000Z', days:2 });
  /* Рахунок в обидва боки: зі строку дата й із дати строк. Інакше два
     числа в шапці рано чи пізно почнуть говорити різне. */
  const назад = U.daysBetween('2026-09-25', '2026-10-20');
  return { заготовка, свій, назад, днів: (window.b2cCfg || (()=>({})))().days };
});
console.log('  ' + JSON.stringify(строк));
ok(строк.днів === 9,
  'за замовчуванням девʼять днів — у налаштування заходити не треба',
  'заготовка не девʼять днів: ' + строк.днів);
ok(строк.заготовка === '2026-10-04',
  'від 25.09 девʼять днів — це 04.10, звичайним календарем',
  'порахувало не по календарю: ' + строк.заготовка);
ok(строк.свій === '2026-09-27',
  'свій строк перебиває заготовку: 2 дні від 25.09 — це 27.09',
  'свій строк порахувався не так: ' + строк.свій);
ok(строк.назад === 25,
  'і той самий рахунок назад — від дати до числа днів: 25',
  'зворотний рахунок не зійшовся: ' + строк.назад);

console.log('\n═══ СКІЛЬКИ ЛИШИЛОСЬ, А НЕ ДО ЯКОГО ЧИСЛА ═══');
/* «До 08.10» треба щоразу віднімати від сьогодні, і робить це кожен, хто
   дивиться на картку. Двадцять плиток на дошці — двадцять віднімань
   подумки, і саме те, у якому помилились, і горить. */
const лишок = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const день = 86400000;
  const iso = t => new Date(t).toISOString().slice(0, 10);
  return {
    шість: U.leftTxt(iso(Date.now() + день * 6)),
    один: U.leftTxt(iso(Date.now() + день)),
    сьогодні: U.leftTxt(iso(Date.now())),
    прострочено: U.leftTxt(iso(Date.now() - день * 2)),
    шапка: U.dueHtml({ createdAt:'2026-09-25T09:00:00.000Z',
                       due: iso(Date.now() + день * 6), dueSet:true })
  };
});
console.log('  ' + JSON.stringify([лишок.шість, лишок.один, лишок.сьогодні, лишок.прострочено]));
ok(лишок.шість.txt === 'лишилось 6 днів' && лишок.один.txt === 'лишилось 1 день',
  'дата через шість днів — «лишилось 6 днів», через один — «1 день»: ' +
    лишок.шість.txt + ' / ' + лишок.один.txt,
  'дні порахувались не так: ' + лишок.шість.txt + ' / ' + лишок.один.txt);
ok(/год/.test(лишок.сьогодні.txt) && лишок.сьогодні.soon,
  'в останню добу — годинами, бо «лишилось 0 днів» не каже нічого: ' +
    лишок.сьогодні.txt,
  'останній день показано днями: ' + лишок.сьогодні.txt);
ok(лишок.прострочено.late && /прострочено 2 дні/.test(лишок.прострочено.txt),
  'а прострочене — окремим станом, не меншим числом: ' + лишок.прострочено.txt,
  'прострочення не видно: ' + JSON.stringify(лишок.прострочено));
ok(/лишилось 6 днів/.test(лишок.шапка) && /dz-duo-l/.test(лишок.шапка),
  'і це стоїть у шапці картки поруч із датою',
  'у шапці лічильника немає');

console.log('\n═══ ДАТА, ПОСТАВЛЕНА РУКАМИ, ЛИШАЄТЬСЯ ═══');
/* Обіцянка — рішення менеджера, а не наслідок формули: поставив календарем
   інше число — воно й лишається, і саме його побачить дошка. */
const рука = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const job = { createdAt:'2026-09-25T09:00:00.000Z', due:'2026-10-20', dueSet:true };
  const html = U.dueHtml(job);
  return { є: /20\.10/.test(html), кнопка: /data-cal="due"/.test(html),
           безДати: /обрати/.test(U.dueHtml({ createdAt:'2026-09-25T09:00:00.000Z' })) };
});
console.log('  ' + JSON.stringify(рука));
ok(рука.є, 'вписана руками дата стоїть у шапці: 20.10',
  'руку перетерло формулою');
ok(рука.кнопка, 'і міняється календарем, а не набором трьох чисел',
  'календаря немає');
ok(!рука.безДати,
  'а картка без своєї дати вже не порожня — заготовка порахувалась сама',
  'картка стоїть без дати готовності');

console.log('\n═══ У РОЗДРІБНІЙ КАРТЦІ КП НЕМАЄ ═══');
/* КП — це документ на тираж. У роздрібі його не збирають, а кнопка «Зібрати
   КП» стояла внизу найпомітнішою — тобто найбільше місця займала дія, якої
   в цій роботі не існує. */
const b2c = await p.evaluate(async () => {
  const o = orders.filter(x => x.dir === 'b2c')[0];
  /* Роздрібне замовлення заводиться разом із карткою у відділі — інакше
     вікна в неї не буде чим наповнити. */
  designJobMake(o.orderId);
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('orderDrawer');
  const зони = [...d.querySelectorAll('.od-fold-t')].map(x => x.textContent.trim());
  return { зони,
    кп: !!d.querySelector('[data-act="offered"]'),
    доВідділу: !!d.querySelector('.od-foot [data-art-dept]'),
    дата: ((d.querySelector('.od-meta') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    /* Дивимось не лише на те, що намалювалось (половина зон ховається сама,
       поки замовлення не оплачене), а й на сам список блоків напряму. */
    блоки: cardBlocksFor('manager', 'b2c').map(b => b.key) };
});
console.log('  ' + JSON.stringify(b2c.зони) + ' | КП:' + b2c.кп);
ok(!b2c.кп, 'кнопки «Зібрати КП» в роздрібній картці немає',
  'КП лишилось у B2C');
ok(b2c.доВідділу,
  'а на її місці — дорога до макета: саме її тут тиснуть щодня',
  'у роздрібній картці немає дороги до макета');
ok(!b2c.блоки.some(k => ['gate', 'fp', 'fact', 'extra', 'buy', 'rep', 'art'].indexOf(k) >= 0),
  'і чужої машини теж немає: ні воріт тиражу, ні першої одиниці, ні факту проти плану',
  'у роздрібну картку залізли зони тиражу: ' + b2c.блоки.join(', '));
ok(b2c.зони.some(z => /^Макет$/.test(z)),
  'зате є «Макет» — вікно у відділ, де цю роботу й ведуть',
  'у роздрібній картці немає блоку макета');
ok(/25\.09/.test(b2c.дата),
  'і дата, коли замовлення прийшло, стоїть у шапці: ' + b2c.дата,
  'дата з шапки зникла: ' + b2c.дата);

console.log('\n═══ А В КОРПОРАТИВНІЙ НІЧОГО НЕ ЗЛАМАЛОСЬ ═══');
const b2b = await p.evaluate(async () => {
  const o = orders.filter(x => x.dir !== 'b2c')[0];
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('orderDrawer');
  return { зони: [...d.querySelectorAll('.od-fold-t')].map(x => x.textContent.trim()),
           кп: ((d.querySelector('[data-act="offered"]') || {}).textContent || '').trim(),
           макетB2C: !!d.querySelector('.od-dz-l'),
           блоки: cardBlocksFor('manager', 'b2b').map(b => b.key) };
});
console.log('  ' + JSON.stringify(b2b.зони) + ' | КП:' + b2b.кп);
ok(/КП/.test(b2b.кп), 'КП у корпоративній картці на місці: ' + b2b.кп,
  'КП зникло й з B2B — зламали те, що працювало');
ok(b2b.зони.some(z => /товари/i.test(z)),
  'і склад замовлення теж',
  'у корпоративній картці зник склад');
ok(!b2b.макетB2C && b2b.блоки.indexOf('dz') < 0,
  'а роздрібного блоку макета в ній немає — це різні машини',
  'у B2B заліз роздрібний блок макета');
ok(['gate', 'fp', 'fact', 'extra', 'buy', 'rep', 'art'].every(k => b2b.блоки.indexOf(k) >= 0),
  'і вся тиражна машина лишилась при B2B: ' + b2b.блоки.join(', '),
  'з корпоративної картки щось зникло: ' + b2b.блоки.join(', '));

console.log('\n═══ ПЕРЕПИСКА: ОДИН ПОТІК НА ДВОХ ═══');
/* Хвоста з трьох рядків і кнопки «всі повідомлення» більше немає, і це
   свідома зміна рішення. Розмова одна на двох; коли в дизайнера вона
   повна, а в менеджера обрізана, вони говорять про різне — менеджер
   відповідає на те, що бачить, а не на те, що написали. */
const ДОВГА = 'Лого зробіть менше приблизно на третину, підніміть вище до горловини ' +
              'сантиметри на два, і колір хай буде молочний, а не чисто білий';
const стрічка = await p.evaluate(async ([довга]) => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobMake('2000101');
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:1 })];
  const d = D.dzNew();
  D.dzAttach(d, 'art@loomiq', 'test@loomiq', 'Оля');
  D.dzSend(d, 'test@loomiq');
  D.dzTake(d, 'art@loomiq');
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:'https://x/a.png' },
                            { name:'мокап.png', url:'https://x/m.png' }], 'перша');
  [довга, 'ще трохи менше', 'і вище'].forEach(t => D.dzSay(d, 'test@loomiq', t, null));
  D.dzList(job.units[0], 'graphic').push(d);
  U.DZ_OPEN[job.units[0].id + '|graphic|0'] = 1;
  openDesign();
  U.setTab('acct'); U.open('2000101');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 500));
  const бульб = [...document.querySelectorAll('.dz-chk .dz-ch-m')];
  const свій = бульб.filter(x => x.classList.contains('own'));
  const текст = свій.map(x => (x.querySelector('.dz-ch-t') || {}).textContent || '');
  return {
    бульбашок: бульб.length,
    подій: document.querySelectorAll('.dz-chk .dz-ch-e').length,
    /* Призначення теж подія: доти воно ніде не лишало сліду, і через
       тиждень не можна було сказати, чи передавали взагалі. */
    призначення: [...document.querySelectorAll('.dz-chk .dz-ch-e span')]
      .some(x => /Виконавець/.test(x.textContent)),
    своїх: свій.length,
    повна: текст.some(t => t.trim() === довга.trim()),
    /* Текст не ріжеться: у правці вся суть після коми. */
    перенос: (() => { const x = document.querySelector('.dz-chk .dz-ch-t');
      return x ? getComputedStyle(x).whiteSpace : ''; })(),
    плиток: document.querySelectorAll('.dz-chk .dz-tile').length,
    поле: !!document.querySelector('.dz-chk-say textarea')
  };
}, [ДОВГА]);
console.log('  ' + JSON.stringify(стрічка));
ok(стрічка.бульбашок >= 4 && стрічка.своїх >= 3,
  'у менеджера повна стрічка, свої репліки праворуч: ' + стрічка.своїх,
  'стрічки в менеджера немає: ' + JSON.stringify(стрічка));
ok(стрічка.подій >= 2 && стрічка.призначення,
  'події — окремим рядком, і призначення серед них',
  'події не відокремлені або призначення не лишає сліду: ' + JSON.stringify(стрічка));
ok(стрічка.повна && стрічка.перенос === 'pre-wrap',
  'довга правка стоїть повністю й переноситься, а не ріжеться',
  'текст обрізало: ' + стрічка.перенос);
ok(стрічка.плиток >= 1,
  'картинки версії — плитками, натиском відкриваються',
  'плиток картинок у стрічці немає');
ok(стрічка.поле,
  'і поле відповіді тут же, під стрічкою',
  'менеджеру нема куди писати');

/* Розмова відкривається з миті ПЕРЕДАЧІ, а не з першої версії. Доти, поки
   макета не було, тут стояв сірий рядок «Передали дизайнеру · очікуємо
   макет» — і писати дизайнеру було нічим. А саме в цей час і питають «ти
   взяв?», «коли буде?». Плюс той рядок казав те саме, що подія в стрічці:
   два написи про одне, з яких один нікуди не веде. */
const доВерсії = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobs['2000101'];
  const u = job.units[0];
  const d = D.dzNew();
  D.dzAttach(d, 'art@loomiq', 'test@loomiq', 'Оля');
  D.dzSend(d, 'test@loomiq');
  D.dzList(u, 'graphic').length = 0;
  D.dzList(u, 'graphic').push(d);
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 400));
  return { стара: !!document.querySelector('.dz-wait'),
           подій: document.querySelectorAll('.dz-ch-e').length,
           поле: !!document.querySelector('.dz-chk-say textarea') };
});
console.log('  ' + JSON.stringify(доВерсії));
ok(!доВерсії.стара,
  'рядка «очікуємо макет» немає — про це вже сказала подія в стрічці',
  'два написи про одне: рядок і подія');
ok(доВерсії.подій >= 2 && доВерсії.поле,
  'а розмова вже відкрита: є події й є чим написати ще до першої версії',
  'до першої версії менеджеру нема де писати: ' + JSON.stringify(доВерсії));

console.log('\n═══ ОДИН НОМЕР — З ДВІЙКИ ═══');
/* Роздрібне замовлення мало два номери: свій у відділі (з двійки) і свій у
   картці замовлення (з пʼятірки). Та сама робота з двома іменами, і
   людина, яка переходить з одного місця в друге, бачила чуже число.
   Андрій: «номер повинен починатися з двоєчки». */
const номер = await p.evaluate(async () => {
  const o = orders.filter(x => x.dir === 'b2c')[0];
  const job = designJobMake(o.orderId);
  job.no = '2000043';
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const d = document.getElementById('orderDrawer');
  const b2b = orders.filter(x => x.dir !== 'b2c')[0];
  return { показ: showNo(o), сховане: o.orderId,
           уШапці: ((d.querySelector('.od-oid-b') || {}).textContent || '').trim(),
           b2bНеЗачепило: showNo(b2b) === b2b.orderId };
});
console.log('  ' + JSON.stringify(номер));
ok(номер.показ === '2000043' && номер.сховане !== '2000043',
  'на очах номер відділу, а ключ у базі лишився свій: ' +
    номер.показ + ' (у базі ' + номер.сховане + ')',
  'номер не підмінився: ' + JSON.stringify(номер));
ok(номер.уШапці === '2000043',
  'і саме він стоїть у шапці картки замовлення',
  'у шапці чужий номер: ' + номер.уШапці);
ok(номер.b2bНеЗачепило,
  'а B2B лишився як був — там номер один і завжди був один',
  'B2B номер підмінили');

console.log('\n═══ ДАТА — ОДНА, І З КАЛЕНДАРЕМ ═══');
/* Андрій: «дата йде тільки в ту картку, звідки приходить». У роздрібі строк
   живе у відділі, а картка замовлення показувала своє порожнє «Здати до
   дд.мм.гггг» — два поля про одне й те саме, і жодне не правда. */
const дата = await p.evaluate(async () => {
  const o = orders.filter(x => x.dir === 'b2c')[0];
  const job = designJobs[o.orderId];
  job.due = '2026-10-20'; job.dueSet = true;
  renderOrderDrawer();
  await new Promise(r => setTimeout(r, 300));
  /* Вузол картки ОДИН на всю адмінку: відкрили друге замовлення — у ньому
     вже друге. Тому знімаємо показники B2C до переходу, а не після. */
  const d = document.getElementById('orderDrawer');
  const було = {
    b2c: ((d.querySelector('.od-due-b') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    лишок: ((d.querySelector('.od-due-c .od-pill-age') || {}).textContent || '').trim(),
    старePоле: !!d.querySelector('[data-f="dueAt"]')
  };
  const b2b = orders.filter(x => x.dir !== 'b2c')[0];
  await openOrderDrawer(b2b);
  await new Promise(r => setTimeout(r, 300));
  було.b2bПоле = !!document.getElementById('orderDrawer').querySelector('[data-f="dueAt"]');
  return було;
});
console.log('  ' + JSON.stringify(дата));
ok(/20\.10/.test(дата.b2c),
  'у роздрібній картці стоїть дата з відділу: ' + дата.b2c,
  'дата у картці замовлення не з відділу: ' + дата.b2c);
ok(/лишилось/.test(дата.лишок),
  'і лишок днів поруч: ' + дата.лишок,
  'лишку немає: ' + дата.лишок);
ok(!дата.старePоле,
  'а порожнього «Здати до дд.мм.гггг» більше немає — двох дат про одне не буває',
  'друге поле дати лишилось у роздрібній картці');
ok(дата.b2bПоле,
  'у B2B поле лишилось як було — там воно єдине',
  'у B2B зламали поле дати');

console.log('\n═══ ОДНА РОЗМОВА, ДВА ЗАМОВЛЕННЯ ═══');
/* Клієнт замовив футболки на компанію, а через місяць худі собі. Розмова
   одна, замовлень два — і система мовчки брала одне з них. */
const дві = await p.evaluate(async () => {
  const b2c = orders.filter(x => x.dir === 'b2c')[0];
  const b2b = orders.filter(x => x.dir !== 'b2c')[0];
  b2c.crmChatId = 'same-chat'; b2b.crmChatId = 'same-chat';
  chatOpen(b2c, 'crm');
  await new Promise(r => setTimeout(r, 500));
  const кн = [...document.querySelectorAll('.cw-oid')];
  return { скільки: ordersOfChat(b2c).length,
           кнопок: кн.length,
           підписи: кн.map(x => x.textContent.replace(/\s+/g, ' ').trim()),
           відкрите: кн.filter(x => x.classList.contains('is-on')).length };
});
console.log('  ' + JSON.stringify(дві));
ok(дві.скільки === 2 && дві.кнопок === 2,
  'обидва замовлення розмови показані: ' + дві.підписи.join(' · '),
  'замовлення розмови не показані: ' + JSON.stringify(дві));
ok(дві.підписи.some(x => /B2C/.test(x)) && дві.підписи.some(x => /B2B/.test(x)),
  'і підписані напрямом — числа на око не відрізнити, а B2B і B2C відрізняються',
  'напрям не підписано: ' + JSON.stringify(дві.підписи));
ok(дві.відкрите === 1,
  'відкрите підсвічене — видно, на яке саме дивишся',
  'незрозуміло, яке замовлення відкрите');

console.log('\n═══ СКРИПТ ПОКАЗУ МАКЕТА — СВІЙ ДЛЯ B2C ═══');
const скрипт = await p.evaluate(() => {
  const b2c = orders.filter(x => x.dir === 'b2c')[0];
  const b2b = orders.filter(x => x.dir !== 'b2c')[0];
  return { c1: scriptFor(b2c, 'design1', { v:1 }),
           c2: scriptFor(b2c, 'design2', { v:2 }),
           b1: scriptFor(b2b, 'design1', { v:1 }) };
});
console.log('  ' + JSON.stringify([скрипт.c1.slice(0, 44), скрипт.c2.slice(0, 44)]));
ok(/^Добрий день/.test(скрипт.c1) && /макет/i.test(скрипт.c1),
  'перший показ у B2C вітається: ' + скрипт.c1.slice(0, 40) + '…',
  'перший скрипт B2C без привітання: ' + скрипт.c1.slice(0, 60));
ok(/^Добрий день/.test(скрипт.c2) && /правки/i.test(скрипт.c2),
  'а після правок — свій текст: ' + скрипт.c2.slice(0, 40) + '…',
  'другий скрипт B2C не той: ' + скрипт.c2.slice(0, 60));
ok(скрипт.b1 !== скрипт.c1,
  'у B2B текст інший — компанії й приватній людині пишуть різними словами',
  'B2B і B2C шлють однаковий текст');

console.log('\n═══ ХРЕСТИК ВИДНО ЗАВЖДИ, А ДАТИ З 1929 НЕ БУВАЄ ═══');
/* У картці стояло «ГОТОВО 04.12.29 · прострочено 35364 дні», і цей рядок
   виштовхував за край кнопку «закрити» — картку не було чим закрити. */
const шапкa = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  /* Попередні перевірки ходили в картку замовлення й у чати — повертаємо
     відділ на екран, інакше вимірювати нічого: у схованої секції всі
     прямокутники нульові. */
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  closeOrderDrawer();
  const job = designJobs['2000101'];
  job.due = '1929-12-04'; job.dueSet = true;   // рівно те, що було в базі
  U.setTab('acct'); U.open('2000101');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 400));
  const h = document.querySelector('.dz-panel-h');
  const x = document.querySelector('.dz-panel-h .dz-x');
  const hb = h ? h.getBoundingClientRect() : null;
  const xb = x ? x.getBoundingClientRect() : null;
  return {
    текст: h ? h.textContent.replace(/\s+/g, ' ').trim() : '',
    /* Геометрія, а не наявність у розмітці: кнопка може бути в DOM і
       водночас лежати за краєм вікна. */
    хрестикВидно: !!(xb && hb && xb.width > 0 && xb.right <= hb.right + 1 &&
                     xb.left >= hb.left),
    рамки: { h: hb && [Math.round(hb.left), Math.round(hb.right)],
              x: xb && [Math.round(xb.left), Math.round(xb.right), Math.round(xb.width)] },
    биту: U.dueTxt('1929-12-04'),
    живу: U.dueTxt('2026-10-20')
  };
});
console.log('  ' + JSON.stringify(шапкa));
ok(шапкa.хрестикВидно,
  'хрестик у шапці на місці, у межах вікна',
  'хрестик виїхав за край — картку немає чим закрити');
ok(!/35364|1929|04\.12\.29/.test(шапкa.текст),
  'а дати з 1929 в шапці немає: ' + шапкa.текст.slice(0, 60),
  'у шапці досі сміття: ' + шапкa.текст);
ok(!шапкa.биту && шапкa.живу,
  'дата поза робочим діапазоном не читається як дата, робоча читається',
  'битa дата й далі вважається датою: ' + JSON.stringify(шапкa));

console.log('\n═══ РОЗДРІБНА СУМА СТАЄ СУМОЮ ЗАМОВЛЕННЯ ═══');
/* Відділ рахував суму правильно, але лишав її в себе: показував у смузі
   «Гроші» й нікуди не записував. Звідси «Це замовлення 0 ₴» у картці
   клієнта поруч із «За весь час 14 768 ₴». */
const сума = await p.evaluate(async () => {
  contentData.products = contentData.products || {};
  contentData.products.retail = { tee: 900 };
  contentData.products.retailCost = { tee: 340 };
  const o = orders.filter(x => x.dir === 'b2c')[0];
  const job = designJobMake(o.orderId);
  const U = window.LQDesign.ui;
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', qty:3 })];
  o.totalPrice = 0; o.totalCost = 0; o.margin = 0;
  b2cSumWrite(job, o);
  const повна = { сума:o.totalPrice, соб:o.totalCost, марж:o.margin, пц:o.marginPct };
  /* Виріб без вписаної собівартості: прибуток не рахуємо зовсім — нуль
     означав би, що він дістався безкоштовно. */
  job.units.push(Object.assign(U.unitNew(), { gid:'cap', name:'Шапка', qty:1 }));
  contentData.products.retail.cap = 500;
  b2cSumWrite(job, o);
  const часткова = { сума:o.totalPrice, соб:o.totalCost, марж:o.margin };
  /* А B2B формула не чіпає взагалі: там сума приходить із прорахунку. */
  const b2b = orders.filter(x => x.dir !== 'b2c')[0];
  b2b.totalPrice = 12345;
  b2cSumWrite(job, b2b);
  return { повна, часткова, b2b: b2b.totalPrice };
});
console.log('  ' + JSON.stringify(сума));
ok(сума.повна.сума === 2700 && сума.повна.соб === 1020 && сума.повна.марж === 1680,
  '900 × 3 = 2700, собівартість 1020, прибуток 1680',
  'сума порахувалась не так: ' + JSON.stringify(сума.повна));
ok(сума.повна.пц === 62.2,
  'і частка прибутку порахована: ' + сума.повна.пц + '%',
  'частка прибутку не та: ' + сума.повна.пц);
ok(сума.часткова.сума === 3200 && сума.часткова.соб === 0 && сума.часткова.марж === 0,
  'виріб без собівартості — сума є, а прибутку немає: часткова відповідь гірша за мовчання',
  'прибуток порахувався з дірявої собівартості: ' + JSON.stringify(сума.часткова));
ok(сума.b2b === 12345,
  'а B2B формула не чіпає — там сума приходить із прорахунку',
  'роздрібна формула перебила суму B2B: ' + сума.b2b);

console.log('\n═══ АНАЛІТИКА: ОКРЕМО ПО НАПРЯМАХ, І ПРИБУТОК ЧЕСНИЙ ═══');
/* Рухи по рахунках кажуть «звідки взялось». Аналітика — «скільки продали
   й чи заробили». Напрями розділені: у B2B ціна з прорахунку зі шкалами за
   тиражем, у B2C з прайсу, і скласти їх в одне число означає сховати
   збитковий роздріб за вигідним тиражем. */
const ан = await p.evaluate(() => {
  const мс = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString(); };
  const м = () => { const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const зроби = (id, dir, price, cost) => ({ id:'x' + id, orderId:id, dir, type:'client',
    status:'prorahunok', site:'main', totalPrice:price, totalCost:cost,
    createdAt:мс(0), hist:[], items:[] });
  orders.length = 0;
  orders.push(зроби('2000101', 'b2c', 2700, 1020), зроби('2000102', 'b2c', 1800, 680),
              зроби('1000090', 'b2b', 24000, 9000));
  payments.length = 0;
  payments.push({ id:'p1', orderId:'2000101', amount:1350, tag:'prepay', at:мс(0) },
                { id:'p2', orderId:'2000101', amount:1350, tag:'final',  at:мс(0) },
                { id:'p3', orderId:'2000102', amount:1800, tag:'cod',    at:мс(0) },
                { id:'p4', orderId:'1000090', amount:12000, tag:'prepay', at:мс(0) });
  contentData.ads = { [м()]: { b2c:1500 } };
  const c = finStats(м(), 'b2c');
  const b = finStats(м(), 'b2b');
  /* Одне замовлення без собівартості — і прибутку немає зовсім. */
  orders.push(зроби('2000103', 'b2c', 900, 0));
  const діряве = finStats(м(), 'b2c');
  return { c, b, діряве:{ сума:діряве.сума, чистий:діряве.чистий, безСоб:діряве.безСоб } };
});
console.log('  B2C ' + JSON.stringify([ан.c.замовлень, ан.c.сума, ан.c.надійшло,
  ан.c.валовий, ан.c.чистий]) + ' | B2B ' + JSON.stringify([ан.b.замовлень, ан.b.сума]));
ok(ан.c.замовлень === 2 && ан.c.сума === 4500 && ан.b.замовлень === 1 && ан.b.сума === 24000,
  'напрями рахуються окремо: B2C 2 замовлення на 4 500 ₴, B2B 1 на 24 000 ₴',
  'напрями змішались: ' + JSON.stringify(ан));
ok(ан.c.надійшло === 4500 && ан.c.лишилось === 0,
  'надходження беруться лише по своїх замовленнях: 4 500 ₴, лишилось 0',
  'надійшло порахувалось не так: ' + ан.c.надійшло);
ok(ан.c.теги.prepay === 1350 && ан.c.теги.cod === 1800 && ан.c.теги.final === 1350,
  'і розкладені за підписами: передоплата 1350, доплата 1350, наложка 1800',
  'підписи не розклались: ' + JSON.stringify(ан.c.теги));
ok(ан.c.валовий === 2800 && ан.c.чистий === 1300,
  'валовий 4500−1700=2800, чистий після реклами 1500 — це 1300',
  'прибуток порахувався не так: ' + JSON.stringify([ан.c.валовий, ан.c.чистий]));
ok(ан.діряве.чистий === null && ан.діряве.безСоб === 1,
  'а одне замовлення без собівартості знімає прибуток зовсім і каже, скількох бракує',
  'прибуток порахувався з дірявої собівартості: ' + JSON.stringify(ан.діряве));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ не зійшлось: ' + bad : '\nнапрями розділені, строк рахується робочими днями');
process.exit(bad ? 1 : 0);
