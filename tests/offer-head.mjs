/* Шапка пропозиції: повна назва документа й одна головна дія.

   Заголовок за замовчуванням звався «Пропозиція для…». Так документ не
   називають ніде: у листуванні, у бухгалтерії й усередині компанії клієнта
   це «комерційна пропозиція», і саме під цією назвою його пересилають
   керівнику. Коротке слово читалось як лист від знайомого.

   Поруч стояла кнопка «Подивитись пропозицію ↓». Склад починається одразу
   під шапкою — його видно, варто прокрутити на палець, — а кнопка забирала
   увагу й робила вигляд, ніби рішень на сторінці два. Головна дія одна:
   «Підтвердити пропозицію».

   І ще одне слово: сторона виробу зветься «Спина». «Зад» лишався в назвах
   ракурсів адмінки, звідки їхав у підписи фото й у документи на виробництво.

   Запуск:  node tests/offer-head.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8821;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E8EDF3"/></svg>');
/* Позиція зі СТАРИМ підписом сторони: такі КП уже надіслані, і клієнт не
   має читати «Зад» у документі, який ми йому щойно оновили. */
const OFFER = {
  orderId:'1001600', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'',
  items:[{ kind:'main', vgroup:'', name:'Худі', color:'Чорний', print:'Вишивка',
    sizes:'M × 10', qty:10, unitPrice:1200, price:12000, basePrice:12000, baseUnitPrice:1200,
    mockups:[PH], prints:[],
    views:[{ side:'front', label:'Перед', img:PH, show:true },
           { side:'back', label:'Зад', img:PH, show:true }],
    sides:[{ side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:100, heightMm:60 },
           { side:'back', sideLabel:'Зад', technique:'Вишивка', widthMm:250, heightMm:180 }],
    techniques:['Вишивка'], tiers:[], specs:[], about:'' }]
};

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_head_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:920, height:1000 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_head_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1500);
const fr = p.frames()[1];

console.log('═══ ДОКУМЕНТ НАЗИВАЄ СЕБЕ ПОВНІСТЮ ═══');
const head = await fr.evaluate(() => ({
  h1: (document.querySelector('.hero h1') || {}).textContent || '',
  go: !!document.getElementById('goOffer'),
  heroBtns: [...document.querySelectorAll('.hero button')]
              .map(x => x.textContent.trim()).filter(Boolean),
  confirm: !!document.getElementById('estConfirmBtn')
}));
console.log('  ' + head.h1.trim());
ok(/^Комерційна пропозиція для ARMORIX$/.test(head.h1.trim()),
  'типовий заголовок — «Комерційна пропозиція для <компанія>»',
  'заголовок не той: ' + head.h1);

console.log('');
console.log('═══ ОБКЛАДИНКА ВІД КРАЮ ДО КРАЮ ═══');
/* Шапка впиралась у ту саму колонку 760 px, що й текст, і на широкому екрані
   темний блок висів прямокутником із білими полями обабіч — читався як ще
   одна картка, а не як шапка документа. Тепер фон іде до країв вікна, а сам
   текст лишається в колонці: інакше заголовок розповзався б на весь монітор. */
const bleed = await fr.evaluate(() => {
  const h = document.querySelector('.hero');
  const w = document.querySelector('.wrap') || document.body;
  if(!h) return null;
  const hb = h.getBoundingClientRect(), wb = w.getBoundingClientRect();
  const t = h.querySelector('h1');
  const tb = t ? t.getBoundingClientRect() : null;
  return { hero: Math.round(hb.width), win: document.documentElement.clientWidth,
           left: Math.round(hb.left), wrap: Math.round(wb.width),
           text: tb ? Math.round(tb.width) : 0,
           scroll: document.documentElement.scrollWidth,
           radius: getComputedStyle(h).borderTopLeftRadius };
});
if(!bleed){ console.log('  обкладинки немає'); bad++; }
else {
  console.log('  вікно ' + bleed.win + ' · обкладинка ' + bleed.hero +
              ' (від ' + bleed.left + ') · колонка ' + bleed.wrap + ' · заголовок ' + bleed.text);
  ok(bleed.left <= 1 && bleed.hero >= bleed.win - 1,
    'обкладинка займає всю ширину вікна, а не колонку тексту',
    'обкладинка вужча за вікно: ' + bleed.hero + ' проти ' + bleed.win);
  ok(bleed.text > 0 && bleed.text <= bleed.wrap,
    'сам заголовок лишився в колонці — не розповзся на весь екран',
    'текст виїхав за колонку: ' + bleed.text + ' при колонці ' + bleed.wrap);
  ok(bleed.scroll <= bleed.win + 1,
    'горизонтальної прокрутки від цього не зʼявилось',
    'сторінка поїхала вбік: прокрутка ' + bleed.scroll + ' при вікні ' + bleed.win);
  ok(parseFloat(bleed.radius) === 0,
    'кутів у шапки немає — вона частина сторінки, а не картка на ній',
    'у шапки лишилось заокруглення: ' + bleed.radius);
}

console.log('');
console.log('═══ ГОЛОВНА ДІЯ ОДНА ═══');
console.log('  кнопки в шапці: ' + (head.heroBtns.join(' · ') || 'немає'));
ok(!head.go, 'кнопки «Подивитись пропозицію» в шапці більше немає',
  'кнопка лишилась у шапці');
ok(head.confirm,
  'єдина головна дія — «Підтвердити пропозицію» в кошторисі',
  'кнопки підтвердження немає');

console.log('');
console.log('═══ УСЯ ПРОПОЗИЦІЯ — ЦЕ ВИБІР ═══');
/* Буває, що основних позицій немає зовсім: усе лежить у варіантах. Доти
   розділ «Ваша пропозиція» малювався однаково, порожній він чи ні, — і клієнт
   бачив заголовок, підзаголовок, риску і одразу другий заголовок «Оберіть
   варіант». Два заголовки впритул, а між ними нічого. */
const V = { kind:'variant', name:'Футболка оверсайз', color:'Чорний', print:'Вишивка',
  sizes:'M × 20', qty:20, unitPrice:700, price:14000, basePrice:14000, baseUnitPrice:700,
  mockups:[PH], prints:[], views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:'', vgroup:'Група 1' };
await p.evaluate(o => window.__prev(o), Object.assign({}, OFFER, {
  items: [], variants: [V], vqty:{ 'Група 1': 20 } }));
await p.waitForTimeout(1200);
const solo = await fr.evaluate(() => ({
  titles: [...document.querySelectorAll('section .sec-title')].map(x => x.textContent.trim()),
  start: !!document.getElementById('offerStart'),
  variants: !!document.getElementById('variants')
}));
console.log('  заголовки: ' + JSON.stringify(solo.titles));
ok(!solo.start,
  'порожній розділ основних позицій не малюється зовсім',
  'порожній розділ лишився на сторінці');
ok(solo.variants && solo.titles[0] === 'Ваша пропозиція',
  'назву документа бере на себе блок варіантів — заголовок один',
  'перший заголовок не той: ' + JSON.stringify(solo.titles));
ok(solo.titles.filter(t => /Ваша пропозиція|Оберіть варіант/.test(t)).length === 1,
  'двох заголовків поспіль більше немає',
  'заголовки досі дублюються: ' + JSON.stringify(solo.titles));

/* А коли основні позиції є, обидва заголовки лишаються: між ними стоять
   картки товарів, і другий читається як новий крок, а не як дубль. */
await p.evaluate(o => window.__prev(o), Object.assign({}, OFFER, {
  variants: [V], vqty:{ 'Група 1': 20 } }));
await p.waitForTimeout(1200);
const both = await fr.evaluate(() =>
  [...document.querySelectorAll('section .sec-title')].map(x => x.textContent.trim()));
console.log('  зі складом: ' + JSON.stringify(both));
ok(both.indexOf('Ваша пропозиція') >= 0 && both.indexOf('Оберіть варіант') >= 0,
  'зі складом обидва заголовки на місці — між ними товари',
  'заголовки зникли при повному складі: ' + JSON.stringify(both));

/* Повертаємо вихідний документ: далі перевіряють слова на сторінці. */
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1200);

console.log('');
console.log('═══ СТОРОНА ЗВЕТЬСЯ СПИНОЮ ═══');
const words = await fr.evaluate(() => {
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  const t = document.body.innerText;
  return {
    zad: /(^|[^а-яіїєґ])зад([^а-яіїєґ]|$)/i.test(t),
    spina: /спина/i.test(t),
    tabs: [...document.querySelectorAll('.pgal-cap, .sl-k')].map(x => x.textContent.trim())
  };
});
console.log('  згадки «спина»: ' + words.spina + ' · «зад»: ' + words.zad);
ok(!words.zad, 'слова «зад» на сторінці немає ніде',
  'десь лишилось «зад»');
ok(words.spina,
  'стара позиція з підписом «Зад» показується як «Спина»',
  'підпис сторони не виправився');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'шапка називає документ повністю й веде до однієї дії');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
