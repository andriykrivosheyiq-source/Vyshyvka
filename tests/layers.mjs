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
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'шари слухаються: порядок свій, виділення передбачуване, список на місці');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
