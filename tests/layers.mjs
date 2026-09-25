/* Шари: номер, порядок, виділення, список, замок і видимість.

   Андрій: «дві картинки між собою міняю місцями, хочу наложити один на
   один, не налажується… один натискаю, другий не коригується, третій
   пригає… куча різних траблів, які трапляються і не виправляються».

   Причин було пʼять, і жодна не «десь щось глючить»:

   1. НОМЕР ШАРУ був показанням годинника. Два шари в одну мілісекунду
      діставали однаковий, а виділення зберігає номер і бере ПЕРШИЙ із
      таким. Клікаєш один — правиться інший.
   2. ПОРЯДКУ ШАРІВ не існувало: усі стояли з z-index 1, обраний з 10.
      Накласти було нічим, а «стрибок» — це обраний вискакував наверх і
      падав назад.
   3. НОВИЙ ШАР лягав сходами по 24 px, і зсув ніколи не скидався.
   4. СПИСКУ ШАРІВ не було ніде: до шару, накритого сусідом, не дістатись.
   5. СМУГА ОФОРМЛЕННЯ тексту підміняла всю панель — тому вона «то є, то
      пропадає».

   Правила взяті з Figma, Canva, Printful і Printify — див. PLANS.md §11.

   Запуск:  node tests/layers.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8875;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg' };
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

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1280, height:1050 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
await p.evaluate(async () => {
  window.__openProductModal('tee');
  await new Promise(r => setTimeout(r, 1800));
  document.querySelector('[data-tab="photo"]').click();
  await new Promise(r => setTimeout(r, 900));
});

/* Кільце: усередині дірка, і саме вона доводить, що виділення питає
   ПІКСЕЛЬ, а не прямокутник рамки. */
const ring = (n, col) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
  '<circle cx="200" cy="200" r="' + (80 + n * 40) + '" fill="none" stroke="' + col +
  '" stroke-width="40"/></svg>');
await p.evaluate(async us => {
  for(const u of us){ window.LQ_addLogoFromStart({ url:u }); await new Promise(r => setTimeout(r, 1700)); }
}, [ring(0, '#c8102e'), ring(1, '#0b3d91')]);

console.log('═══ НОМЕР ШАРУ ВИДАЄТЬСЯ РАЗ І НЕ ПОВТОРЮЄТЬСЯ ═══');
/* Годинник тут ні до чого: два шари можуть народитись в одну мілісекунду —
   при дублюванні, при дзеркаленні, при швидкому додаванні написів. */
const номери = await p.evaluate(() => {
  const L = window.__lqLayers;
  const було = L.list().length;
  /* Дублюємо той самий шар кілька разів ПОСПІЛЬ, в один такт — саме так
     номери й збігались: годинник за цей час не встигає зрушити. */
  const first = L.list()[0].id;
  for(let i = 0; i < 5; i++) L.dup(first);
  const ids = L.list().map(x => x.id);
  return { було, стало:ids.length, унікальних:new Set(ids).size };
});
console.log('   ' + JSON.stringify(номери));
ok(номери.унікальних === номери.стало,
  'скільки шарів, стільки й різних номерів — однакових не буває',
  'номери збіглись: ' + JSON.stringify(номери));

/* Видавати нові номери правильно — цього мало. Позиції, зібрані раніше, уже
   лежать у замовленнях, і в них номери від годинника. Відкриваєш таку
   позицію — і бачиш рівно те, від чого тікали. Андрій: «нажимаю на маленьку
   картинку, она не нажимается и не двигается, нажимаю на большую — и
   выбираются две и двигаются две». */
const старі = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const list = L.list();
  const a = list[0].id, b = list[1].id;
  L.set(b, 'id', a);                    // рівно так виглядає збережена позиція
  L.active(a);
  L.draw();
  await new Promise(r => setTimeout(r, 300));
  const after = L.list();
  return { однакових:after.length - new Set(after.map(x => x.id)).size,
           маркерів:document.querySelectorAll('.pm-draggable-layer [data-handle="scale"]').length,
           шарів:after.length };
});
console.log('   ' + JSON.stringify(старі));
ok(старі.однакових === 0,
  'позиція, збережена зі старими номерами, лагодиться при відкритті',
  'однакові номери доїхали з бази: ' + JSON.stringify(старі));
ok(старі.маркерів <= 1,
  'маркери показує рівно один шар — не два одночасно на одну рамку',
  'два набори маркерів водночас: ' + JSON.stringify(старі));

console.log('');
console.log('═══ ПОРЯДОК — ЦЕ МІСЦЕ В СПИСКУ, І ВИДІЛЕННЯ ЙОГО НЕ ЧІПАЄ ═══');
const порядок = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const z = () => [...document.querySelectorAll('.pm-draggable-layer')]
    .map(e => +e.style.zIndex);
  const до = z();
  /* Беремо НИЖНІЙ шар — саме він раніше вискакував наверх. */
  L.active(L.list()[0].id);
  L.draw();
  await new Promise(r => setTimeout(r, 200));
  return { до, після:z(), однакові:JSON.stringify(до) === JSON.stringify(z()) };
});
console.log('   ' + JSON.stringify(порядок));
ok(порядок.до.join() === порядок.до.slice().sort((a, b) => a - b).join(),
  'перший у списку найнижчий, останній найвищий — порядок читається з самого списку',
  'порядок не збігається зі списком: ' + JSON.stringify(порядок.до));
ok(порядок.однакові,
  'обраний шар лишається на своєму місці — рамка й маркери, а не нове місце',
  'обраний знову вискакує наверх: ' + JSON.stringify(порядок));

const рух = await p.evaluate(() => {
  const L = window.__lqLayers;
  const ids = () => L.list().map(x => x.id);
  const був = ids();
  L.move(був[0], 'up');    const після = ids();
  L.move(був[0], 'top');   const зверху = ids();
  L.move(був[0], 'bottom');
  return { піднявся:після[1] === був[0], наверх:зверху[зверху.length - 1] === був[0],
           вниз:ids()[0] === був[0] };
});
console.log('   ' + JSON.stringify(рух));
ok(рух.піднявся && рух.наверх && рух.вниз,
  'шар піднімається на щабель, на самий верх і на самий низ — місцями міняти є чим',
  'порядок не рухається: ' + JSON.stringify(рух));

console.log('');
console.log('═══ КЛІК БЕРЕ ВЕРХНІЙ ШАР, А НЕ ОБРАНИЙ ═══');
/* Тут потрібні СУЦІЛЬНІ плями, а не кільця: у кільця середина прозора, і
   точка в ній чесно нічия. Кільце доводить інше правило — що дірка
   лишається діркою, — і це перевіряє tests/layer-grab.mjs. */
const plate = col => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
  '<rect x="60" y="60" width="280" height="280" rx="24" fill="' + col + '"/></svg>');
await p.evaluate(async us => {
  for(const u of us){ window.LQ_addLogoFromStart({ url:u }); await new Promise(r => setTimeout(r, 1700)); }
}, [plate('#1b7a43'), plate('#6a3da8')]);
/* Раніше обраний перевіряли першим — і взятий шар забирав собі всі кліки в
   межах своєї рамки, а сусід під ним ставав недосяжним. */
const вибір = await p.evaluate(() => {
  const L = window.__lqLayers;
  const list = L.list();
  const низ = list[0], верх = list[list.length - 1];
  const c = L.stack();        // усі в одну точку — щоб перетин був напевно
  L.active(низ.id);           // обраний — НИЖНІЙ
  window.__c = c;
  return { обраний:низ.id, взявся:L.at(c.x, c.y), верх:верх.id };
});
console.log('   ' + JSON.stringify(вибір));
ok(вибір.взявся === вибір.верх,
  'клік узяв верхній шар, хоча обраний був нижній — правило без винятків',
  'обраний знову має перевагу: ' + JSON.stringify(вибір));

const глибше = await p.evaluate(() => {
  const L = window.__lqLayers, c = window.__c;
  return { перший:L.at(c.x, c.y), другий:L.at(c.x, c.y),   // та сама точка вдруге
           далеко:L.at(c.x + 400, c.y + 400),              // далеко — це вже новий клік
           знову:L.at(c.x, c.y) };
});
console.log('   ' + JSON.stringify(глибше));
ok(глибше.перший && глибше.другий && глибше.перший !== глибше.другий,
  'повторний клік у ту саму точку йде глибше — так дістають нижній шар без клавіатури',
  'другий клік бере той самий шар: ' + JSON.stringify(глибше));

console.log('');
console.log('═══ ДРІБНИЙ ШАР НЕ НАКРИТИЙ ВЛАСНИМИ МАРКЕРАМИ ═══');
/* Маркер — 24 px, і на кутах їх чотири. Поки шар більший за них, усе
   гаразд. А на шарі завбільшки з сам маркер вони сходяться над ним і
   накривають його цілком: «натискаю на маленьку картинку, а вона не
   натискається». */
const дрібний = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const id = L.list()[L.list().length - 1].id;
  L.set(id, 'scale', 0.16); L.active(id); L.draw();
  await new Promise(r => setTimeout(r, 500));
  const el = document.querySelector('[data-layer-id="' + id + '"]');
  const r = el.getBoundingClientRect();
  const c = { x:r.left + r.width / 2, y:r.top + r.height / 2 };
  const накрито = [...el.querySelectorAll('.pm-dl-handle')].some(h => {
    const q = h.getBoundingClientRect();
    return c.x > q.left && c.x < q.right && c.y > q.top && c.y < q.bottom;
  });
  /* Спершу питаємо про далеку точку: попередні перевірки лишили за собою
     памʼять про «ту саму точку», і без цього клік пішов би глибше замість
     того, щоб узяти верхній. */
  L.at(c.x + 500, c.y + 500);
  return { бік:Math.round(r.width), накрито, береться:L.at(c.x, c.y) === id };
});
console.log('   ' + JSON.stringify(дрібний));
/* Андрій: «в маленького легко нажимать дополнительные кнопки, а у большого
   сложно». Відсув задумувався для дрібних, а дістався всім: розмір шару
   брався з `offsetWidth`, а вузол міряють у мить, коли розмітка ще не
   перерахувалась — нуль замість ширини робив «дрібним» будь-який шар, і
   маркери великого логотипа відлітали в порожнє місце біля коміра. */
const великий = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const id = L.list()[0].id;
  L.set(id, 'scale', 1); L.active(id); L.draw();
  await new Promise(r => setTimeout(r, 500));
  const el = document.querySelector('[data-layer-id="' + id + '"]');
  const out = el.querySelector('.pm-dl-outline').getBoundingClientRect();
  const far = [...el.querySelectorAll('.pm-dl-handle')].map(h => {
    const q = h.getBoundingClientRect();
    return Math.round(Math.max(out.left - q.right, q.left - out.right,
                               out.top - q.bottom, q.top - out.bottom));
  });
  return { контур:Math.round(out.width), найдальший:Math.max.apply(null, far) };
});
console.log('   ' + JSON.stringify(великий));
ok(великий.контур > 60 && великий.найдальший <= 10,
  'у великого шару маркери тримаються самої рамки, а не відлітають від неї',
  'маркери великого шару стоять задалеко: ' + JSON.stringify(великий));
ok(дрібний.бік < 40,
  'шар справді дрібний — саме на таких маркери й сходились над ним',
  'шар не дрібний, перевірка ні про що: ' + JSON.stringify(дрібний));
ok(!дрібний.накрито,
  'жоден маркер не накриває середину дрібного шару — за нього є чим узятись',
  'маркери лягли просто на шар: ' + JSON.stringify(дрібний));
ok(дрібний.береться,
  'і клік у його середину бере саме його',
  'дрібний шар не береться: ' + JSON.stringify(дрібний));

console.log('');
console.log('═══ КНОПКИ ОБРАНОГО ШАРУ НАТИСКАЮТЬСЯ, ХОЧ БИ ХТО ЛЕЖАВ ЗВЕРХУ ═══');
/* Андрій: «кнопки у великого просто не натискаються, зображення добре
   рухається». Доти обраний шар піднімався над рештою — і його маркери були
   зверху заодно. Коли підйом прибрали (він і давав стрибок), маркери
   лишились на своєму поверсі: прямокутник шару, що лежить вище, накриває їх
   і зʼїдає клік. Зображення при цьому рухається, бо перенос питає, хто під
   точкою, і сам знаходить потрібний шар. */
const кнопки = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const list = L.list();
  const низ = list[0].id, верх = list[list.length - 1].id;
  /* Верхній шар робимо великим і кладемо в ту саму точку — так він накриває
     маркери нижнього, як воно й буває на виробі. */
  L.set(верх, 'scale', 1.6);
  L.stack();
  L.active(низ);                 // обраний — НИЖНІЙ
  L.draw();
  await new Promise(r => setTimeout(r, 400));
  const el = document.querySelector('[data-layer-id="' + низ + '"]');
  const h = el && el.querySelector('[data-handle="scale"]');
  if(!h) return { помилка:'маркера немає' };
  const q = h.getBoundingClientRect();
  const x = Math.round(q.left + q.width / 2), y = Math.round(q.top + q.height / 2);
  const під = document.elementFromPoint(x, y);
  /* Під точкою може стояти сам значок усередині маркера — тому питаємо не
     клас вузла, а чи належить він маркеру взагалі. */
  return { маркер:!!(під && під.closest && під.closest('.pm-dl-handle')),
           чий:!!(під && під.closest && під.closest('[data-layer-id]'))
                 ? під.closest('[data-layer-id]').dataset.layerId : '' };
});
console.log('   ' + JSON.stringify(кнопки));
ok(кнопки.маркер,
  'у точці маркера лежить сам маркер, а не прямокутник сусіднього шару',
  'маркер накритий чужим шаром і клік до нього не доходить: ' + JSON.stringify(кнопки));

console.log('');
console.log('═══ ЗАМОК І ВИДИМІСТЬ ═══');
const замок = await p.evaluate(() => {
  const L = window.__lqLayers;
  const list = L.list();
  const верх = list[list.length - 1].id;
  const c = window.__c;
  L.set(верх, 'locked', true);
  const крізь = L.at(c.x, c.y);
  L.set(верх, 'locked', false);
  L.set(верх, 'hidden', true);
  const схований = L.at(c.x, c.y);
  L.draw();
  const намальовано = document.querySelectorAll('.pm-draggable-layer').length;
  const уСписку = document.querySelectorAll('.pm-ll-row').length;
  L.set(верх, 'hidden', false); L.draw();
  return { верх, крізь, схований, намальовано, всього:list.length, уСписку };
});
console.log('   ' + JSON.stringify(замок));
ok(замок.крізь !== замок.верх,
  'замкнений шар пропускає кліки далі — на те він і замок',
  'замкнений досі хапає кліки: ' + JSON.stringify(замок));
ok(замок.схований !== замок.верх && замок.намальовано === замок.всього - 1,
  'схований не малюється й не береться',
  'схований поводиться як звичайний: ' + JSON.stringify(замок));
ok(замок.уСписку === замок.всього,
  'але в списку схований лишається — інакше він забувся б назавжди',
  'схований зник і зі списку: ' + JSON.stringify(замок));

console.log('');
console.log('═══ СПИСОК ШАРІВ Є ЗАВЖДИ ═══');
const список = await p.evaluate(async () => {
  const до = { рядків:document.querySelectorAll('.pm-ll-row').length,
               плиток:document.querySelectorAll('.pm-photo-thumb').length };
  const t = document.getElementById('pmTextOpen') || document.getElementById('pmTextOpenTile');
  if(t) t.click();
  await new Promise(r => setTimeout(r, 1500));
  return { до, рядків:document.querySelectorAll('.pm-ll-row').length,
           плиток:document.querySelectorAll('.pm-photo-thumb').length,
           смуга:!!document.querySelector('.pm-text-strip'),
           назви:[...document.querySelectorAll('.pm-ll-nm')].map(e => e.textContent) };
});
console.log('   ' + JSON.stringify(список));
ok(список.до.рядків === список.до.плиток && список.до.рядків > 1,
  'у списку рівно стільки рядків, скільки шарів на цій стороні',
  'список не збігається з шарами: ' + JSON.stringify(список));
ok(список.смуга && список.рядків > 0 && список.плиток > 0,
  'обрали напис — смуга оформлення поруч зі списком, а не замість усієї панелі',
  'смуга знову підмінила панель: ' + JSON.stringify(список));
ok(!список.назви.some(t => /^data:|svg\+xml/.test(t)),
  'рядок підписаний по-людськи, а не початком кодування картинки',
  'у списку кодування замість назви: ' + JSON.stringify(список.назви));

console.log('');
console.log('═══ НОВИЙ ШАР ЛЯГАЄ В ЦЕНТР, А НЕ СХОДАМИ ═══');
/* Зсув рахувався як «24 × скільки вже є» і ніколи не скидався: три написи
   розходились на 72 пікселі по діагоналі, десять картинок — на 216. */
const сходи = await p.evaluate(() => {
  const L = window.__lqLayers;
  const xs = [...document.querySelectorAll('.pm-draggable-layer')].map(e => {
    const r = e.getBoundingClientRect(); return Math.round(r.left + r.width / 2);
  });
  const ys = [...document.querySelectorAll('.pm-draggable-layer')].map(e => {
    const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2);
  });
  return { шарів:L.list().length, розкидX:Math.max.apply(null, xs) - Math.min.apply(null, xs),
           розкидY:Math.max.apply(null, ys) - Math.min.apply(null, ys) };
});
console.log('   ' + JSON.stringify(сходи));
/* Перевірка робиться після того, як шари вже склали в одну точку, — тому
   міряємо не їх, а саме ПРАВИЛО: у коді більше немає множення на
   кількість. */
const джерело = await readFile(path.join(ROOT, 'loomiq-constructor.js'), 'utf8');
ok(!/length \* 24/.test(джерело),
  'зсув більше не рахується від кількості шарів — купа не зʼїжджає з виробу',
  'новий шар знову лягає сходами від кількості');

console.log('');
console.log('═══ КОЛІР ОБИРАЮТЬ, А НЕ НАМАЦУЮТЬ ═══');
/* Квадрат «насиченість × яскравість» терпимий на миші й неможливий пальцем:
   у нього треба цілитись, а палець закриває те місце, куди цілиться. */
const палітра = await p.evaluate(async () => {
  const b = document.querySelector('[data-tsnav="colors"]');
  if(b) b.click();
  await new Promise(r => setTimeout(r, 600));
  const sw = [...document.querySelectorAll('.pm-cg-b')];
  const h = sw.length ? sw[0].getBoundingClientRect().height : 0;
  return { зразків:sw.length, рядів:document.querySelectorAll('.pm-cg-row').length,
           висота:Math.round(h), спіраль:!!document.getElementById('pmTsSv') };
});
console.log('   ' + JSON.stringify(палітра));
ok(палітра.зразків >= 36 && палітра.рядів >= 6,
  'кольори стоять рядами: ряд — колір, у ряду його відтінки',
  'палітри немає: ' + JSON.stringify(палітра));
ok(!палітра.спіраль,
  'квадрата, у який треба цілитись пальцем, більше немає',
  'намацування кольору лишилось');
ok(палітра.висота >= 40,
  'зразок під палець, а не під курсор — інакше «натискаю один, натискається інший»',
  'зразок замалий: ' + палітра.висота + ' px');

console.log('');
console.log('═══ ІНТЕРВАЛ І РОЗРІДЖЕННЯ ═══');
/* Це властивості ВСЬОГО напису, а не окремого шматка: рядок не може стояти
   щільніше наполовину. Потрібні постійно: у два рядки напис лягає то надто
   тісно, то з дірою, а короткі слова великими літерами без розрідження
   виглядають злиплими — і саме так їх найчастіше й вишивають. */
const інтервали = await p.evaluate(async () => {
  /* Повертаємось із палітри на саму смугу — звідти й відкривають інтервали. */
  const back = document.querySelector('[data-tsnav="main"]');
  if(back) back.click();
  await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('[data-tsnav="space"]');
  if(!b) return { кнопки:false };
  b.click();
  await new Promise(r => setTimeout(r, 500));
  const sl = [...document.querySelectorAll('.pm-sp-sl')].map(e => e.dataset.spr);
  /* Напис має справді стати ШИРШИМ — інакше повзунок є, а нічого не робить.
     Міряємо пропорцію самого малюнка, а не вузол на екрані: у вузла рамка
     стала, і його ширина нічого не доводить. */
  const L = window.__lqLayers;
  const arOf = () => (L.list().filter(x => x.text)[0] || {}).ar;
  const w0 = arOf();
  const ls = document.querySelector('[data-spr="ls"]');
  if(ls){ ls.value = '0.3'; ls.dispatchEvent(new Event('input', { bubbles:true })); }
  await new Promise(r => setTimeout(r, 900));
  const w1 = arOf();
  const el = () => document.querySelector('.pm-draggable-layer .pm-dl-text');
  const крок = document.querySelector('[data-sp="lh"][data-d="1"]');
  const lh0 = el() ? parseFloat(getComputedStyle(el()).lineHeight) : 0;
  if(крок) крок.click();
  await new Promise(r => setTimeout(r, 600));
  const lh1 = el() ? parseFloat(getComputedStyle(el()).lineHeight) : 0;
  return { кнопки:true, повзунки:sl, розрідження:{ було:w0, стало:w1 },
           рядок:{ було:Math.round(lh0), стало:Math.round(lh1) } };
});
console.log('   ' + JSON.stringify(інтервали));
ok(інтервали.кнопки && (інтервали.повзунки || []).join() === 'lh,ls',
  'міжрядковий і розрідження стоять в одному вікні з рештою оформлення',
  'екрана інтервалів немає: ' + JSON.stringify(інтервали));
ok(інтервали.розрідження && інтервали.розрідження.стало > інтервали.розрідження.було,
  'розрідження справді розсуває літери — напис стає ширшим, а не лише їде повзунок',
  'напис не змінився: ' + JSON.stringify(інтервали.розрідження));
ok(інтервали.рядок && інтервали.рядок.стало > інтервали.рядок.було,
  'міжрядковий справді розсуває рядки',
  'рядки не розсунулись: ' + JSON.stringify(інтервали.рядок));

console.log('');
console.log('═══ НАПИС БЕЗ ЛІТЕР НЕ ІСНУЄ ═══');
/* Доти напис, із якого стерли все, лишався невидимим шаром: на екрані
   нічого, а в прорахунку окремий дизайн зі своєю разовою підготовкою
   макета. Знайти його було ніде — саме тому, що його не видно. */
const стерли = await p.evaluate(async () => {
  const L = window.__lqLayers;
  const txt = L.list().filter(x => x.text)[0];
  if(!txt) return { помилка:'напису в стосі немає' };
  L.active(txt.id);
  L.text(txt.id, '');                   // стерли дочиста — саме так це й роблять
  const до = L.list().length;
  L.leave();                            // і вийшли з напису
  return { до, після:L.list().length, лишився:L.list().some(x => x.id === txt.id) };
});
console.log('   ' + JSON.stringify(стерли));
ok(!стерли.лишився && стерли.після === стерли.до - 1,
  'напис, із якого стерли все, зникає разом із виходом із нього',
  'порожній напис лишився невидимим шаром: ' + JSON.stringify(стерли));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'шари слухаються: порядок свій, виділення передбачуване, список на місці');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
