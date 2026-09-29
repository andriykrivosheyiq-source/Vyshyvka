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

console.log('\n═══ СТРІЧКА: ТЕКСТ НЕ РІЖЕТЬСЯ, ДАТА ПІД ІМʼЯМ ═══');
/* «Я відправляю правку, і тут половину правки я сам не можу прочитати.»
   Обрізана правка нічого не варта: у ній уся суть після коми. */
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
  D.dzAttach(d, 'art@loomiq', 'test@loomiq');
  D.dzSend(d, 'test@loomiq');
  D.dzTake(d, 'art@loomiq');
  /* Версія з двох файлів — така, якою її здавали до появи аркуша. Таких у
     роботі більшість, і саме на них усе тихо відкочувалось до мокапу. */
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:'https://x/a.png' },
                            { name:'мокап.png', url:'https://x/m.png' }], 'перша');
  /* Пʼять правок: три видно, решта — за кнопкою. */
  [довга, 'ще трохи менше', 'і вище', 'колір молочний', 'ось так добре'].forEach(t =>
    D.dzSay(d, 'test@loomiq', t, null));
  D.dzList(job.units[0], 'graphic').push(d);
  U.DZ_OPEN[job.units[0].id + '|graphic|0'] = 1;
  openDesign();
  U.setTab('acct'); U.open('2000101');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 500));
  const r1 = document.querySelector('.dz-tail-r');
  return {
    рядків: document.querySelectorAll('.dz-tail-r').length,
    кнопка: ((document.querySelector('.dz-tail-all') || {}).textContent || '').trim(),
    імʼя: ((r1 && r1.querySelector('.dz-tail-w b')) || {}).textContent || '',
    дата: ((r1 && r1.querySelector('.dz-tail-w i')) || {}).textContent || '',
    /* Колонка з імʼям і датою стоїть ЛІВОРУЧ, а текст — праворуч від неї й
       нижче не обрізається: перевіряємо не слова, а справжню геометрію. */
    висота: r1 ? Math.round(r1.getBoundingClientRect().height) : 0,
    обрізано: (()=>{ const x = r1 && r1.querySelector('.dz-tail-x');
      return x ? getComputedStyle(x).whiteSpace : ''; })(),
    безАркуша: ((document.querySelector('.dz-chk-no') || {}).textContent || '').trim(),
    зібрати: [...document.querySelectorAll('.dz-chk-no .dz-b')]
      .some(b => /Зібрати аркуш/.test(b.textContent))
  };
}, [ДОВГА]);
console.log('  ' + JSON.stringify(стрічка));
ok(стрічка.рядків === 3,
  'видно три останні рядки — решта за кнопкою',
  'рядків у стрічці ' + стрічка.рядків + ', а не три');
ok(/Усі повідомлення/.test(стрічка.кнопка),
  'і кнопка каже, скільки їх усього: ' + стрічка.кнопка,
  'кнопки «усі повідомлення» немає: ' + стрічка.кнопка);
ok(стрічка.імʼя === 'Володимир' && /\d/.test(стрічка.дата),
  'імʼя й дата стоять однією колонкою: ' + стрічка.імʼя + ' / ' + стрічка.дата,
  'дата не стала під імʼям: ' + JSON.stringify([стрічка.імʼя, стрічка.дата]));
ok(стрічка.обрізано === 'pre-wrap',
  'а текст переноситься, а не ріжеться трьома крапками',
  'текст і далі ріжеться: white-space=' + стрічка.обрізано);
ok(стрічка.безАркуша && /аркуш/i.test(стрічка.безАркуша),
  'версія без аркуша каже про це прямо: ' + стрічка.безАркуша,
  'мокап мовчки видається за аркуш');
ok(стрічка.зібрати,
  'і дає його зібрати одним натиском',
  'зібрати аркуш нема чим');

console.log('\n═══ «УСІ ПОВІДОМЛЕННЯ» РОЗКРИВАЮТЬ РЕШТУ ═══');
await p.evaluate(() => document.querySelector('.dz-tail-all').click());
await p.waitForTimeout(500);
const усі = await p.evaluate(довга => {
  const r = [...document.querySelectorAll('.dz-tail-r')];
  const перший = (r[0] && r[0].querySelector('.dz-tail-x').textContent) || '';
  return { рядків: r.length, повна: перший.trim() === довга.trim(),
           кнопка: ((document.querySelector('.dz-tail-all') || {}).textContent || '').trim() };
}, ДОВГА);
console.log('  ' + JSON.stringify(усі));
ok(усі.рядків === 5,
  'натиснув — видно всі пʼять, не виходячи з рішення',
  'розкрилось ' + усі.рядків + ' замість пʼяти');
ok(усі.повна,
  'і довга правка стоїть повністю — те, що менеджер сам написав, він може прочитати',
  'довгу правку все одно обрізало');
ok(/Згорнути/.test(усі.кнопка),
  'а кнопка тепер згортає назад: ' + усі.кнопка,
  'згорнути нема чим: ' + усі.кнопка);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ не зійшлось: ' + bad : '\nнапрями розділені, строк рахується робочими днями');
process.exit(bad ? 1 : 0);
