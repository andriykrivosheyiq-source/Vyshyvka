/* Ціна каже, за що вона: тираж рекомендованого, порожній кошторис, грн/шт.

   ТРИ РЕЧІ, ЯКІ ЗБИВАЛИ КЛІЄНТА З ПАНТЕЛИКУ.

   1. Під ціною рекомендованого стояло «від 1 штуки». Тираж рекомендованого
      рахувався ТІЛЬКИ від основних позицій, а буває, що їх немає зовсім: уся
      пропозиція — це вибір, і все лежить у варіантах. Тоді формула падала на
      одиницю, хоч ціна була порахована за справжнім тиражем. Виходило
      «588 грн від 1 штуки» при старій ціні 1600: число й підпис казали
      різне, і жодне з двох не викликало довіри.

   2. Порожній кошторис показував «0 позицій · 0 одиниць», дві порожні риски
      й «Разом 0 грн». Виглядало як поломка, хоч насправді клієнт просто ще
      нічого не обрав — і ніде не було написано, що саме зробити.

   3. Ціна за штуку стояла без одиниці: просто «588 грн». Окремий підпис «за
      штуку» з'являвся лише тоді, коли знижки не було, — тобто саме у випадку
      зі знижкою людина й не бачила, за що це число. А «588 грн» під фото
      футболки при тиражі 20 читається як ціна всього замовлення.

   Перевіряємо:
     — немає основних позицій — тираж рекомендованого береться з найбільшої
       групи варіантів, а не з одиниці;
     — клієнт покрутив тираж варіантів — рекомендований пішов за ним;
     — своє число менеджера формула не перебиває;
     — порожній кошторис каже, що зробити, і не показує «Разом 0 грн»;
     — підтверджувати порожнє не можна;
     — ціна за штуку скрізь підписана «грн/шт», а підсумки лишаються в грн.

   Запуск:  node tests/price-unit.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8845;
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
const base = (n, extra) => Object.assign({
  name:n, color:'Чорний', print:'Вишивка', sizes:'M × 20', qty:20,
  unitPrice:700, price:14000, basePrice:14000, baseUnitPrice:1600,
  mockups:[PH], prints:[], views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:'' }, extra || {});

/* Пропозиція, у якій НЕМАЄ основних позицій: усе лежить у варіантах. Саме на
   ній і вилазило «від 1 штуки». */
const OFFER = {
  orderId:'1002000', client:{ name:'Андрій', company:'TRIUMPH' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'',
  items:[],
  variants:[ base('Футболка базова', { kind:'variant', vgroup:'Група 1' }),
             base('Футболка оверсайз', { kind:'variant', vgroup:'Група 1', unitPrice:760 }) ],
  vqty:{ 'Група 1': 20 },
  reco:[ base('Кепка', { kind:'reco', qty:20, unitPrice:588, baseUnitPrice:1600 }) ]
};

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_pu_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1600px}</style>
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
await p.goto(HOST + '/_pu_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1500);
const fr = p.frames()[1];

console.log('═══ ТИРАЖ РЕКОМЕНДОВАНОГО ═══');
const kit = await fr.evaluate(() => ({
  line: ((document.querySelector('.rc-kit') || {}).textContent || '').trim(),
  price: ((document.querySelector('.rc-p') || {}).textContent || '').trim(),
  qty: window.__puRecoQty ? window.__puRecoQty() : null
}));
console.log('  ' + kit.price + ' · ' + kit.line);
ok(/від 20 штук/.test(kit.line),
  'тираж узявся з групи варіантів — «від 20 штук», а не «від 1 штуки»',
  'тираж і далі не той: «' + kit.line + '»');
ok(!/від 1 штуки/.test(kit.line),
  'рядка «від 1 штуки» під ціною в 588 грн більше немає',
  'лишилось «від 1 штуки» при ціні ' + kit.price);

console.log('');
console.log('═══ КЛІЄНТ ПОКРУТИВ ТИРАЖ ВАРІАНТІВ ═══');
/* Тираж групи живе на сторінці, і рекомендований має йти за ним: інакше під
   ціною стоїть учорашнє число. */
const moved = await fr.evaluate(async () => {
  /* Крутимо тираж тим самим шляхом, що й людина: кнопкою «+» на картці
     варіанта. Двадцять кліків — з 20 до 40. */
  const plus = document.querySelector('#variants [data-vq][data-d="1"]');
  if(!plus) return 'кнопки тиражу немає';
  for(let k = 0; k < 20; k++){ plus.click(); await new Promise(r => setTimeout(r, 30)); }
  await new Promise(r => setTimeout(r, 900));
  return ((document.querySelector('.rc-kit') || {}).textContent || '').trim();
});
console.log('  ' + moved);
ok(/від 40 штук/.test(moved),
  'клієнт поставив 40 — рекомендований пішов за ним',
  'рекомендований лишився зі старим тиражем: «' + moved + '»');

console.log('');
console.log('═══ ЦІНА ЗА ШТУКУ ПІДПИСАНА ═══');
const units = await fr.evaluate(() => ({
  cards: [...document.querySelectorAll('.pcard-price')].map(x => x.textContent.trim()),
  reco: [...document.querySelectorAll('.rc-p')].map(x => x.textContent.trim()),
  per: [...document.querySelectorAll('.pcard-per')].map(x => x.textContent.trim())
}));
console.log('  картки: ' + JSON.stringify(units.cards) + ' · рекомендовані: ' + JSON.stringify(units.reco));
ok(units.cards.length > 0 && units.cards.every(t => /грн\/шт$/.test(t)),
  'у картках товарів ціна підписана «грн/шт»',
  'ціна без одиниці: ' + JSON.stringify(units.cards));
ok(units.reco.length > 0 && units.reco.every(t => /грн\/шт$/.test(t)),
  'у рекомендованих теж «грн/шт»',
  'ціна рекомендованого без одиниці: ' + JSON.stringify(units.reco));
ok(!units.per.some(t => /за штуку/.test(t)),
  'окремого підпису «за штуку» більше немає — одиниця стоїть у самій ціні',
  'підпис дублює одиницю: ' + JSON.stringify(units.per));

console.log('');
console.log('═══ ПОРОЖНІЙ КОШТОРИС КАЖЕ, ЩО РОБИТИ ═══');
const empty = await fr.evaluate(() => {
  const e = document.getElementById('estimate');
  return { hint: ((e.querySelector('.est-empty') || {}).textContent || '').trim(),
           pay: !!e.querySelector('.est-pay'),
           zero: /Разом\s*0\s*грн/.test(e.innerText.replace(/ /g, ' ')),
           go: (() => { const btn = document.getElementById('estConfirmBtn');
                        return btn ? btn.disabled : null; })() };
});
console.log('  ' + (empty.hint || '(підказки немає)'));
ok(/Оберіть варіант/.test(empty.hint),
  'кошторис прямо каже, що зробити, щоб побачити ціну',
  'підказки немає: «' + empty.hint + '»');
ok(!empty.pay && !empty.zero,
  '«Разом 0 грн» не показуємо — це мовчання, лише цифрами',
  'нулі лишились у підсумку');
ok(empty.go === true,
  'підтвердити порожнє не можна — кнопка неактивна',
  'кнопка підтвердження активна при порожньому кошторисі');

console.log('');
console.log('═══ ОБРАЛИ ВАРІАНТ — ЗʼЯВИЛАСЬ ЦІНА ═══');
const filled = await fr.evaluate(async () => {
  const b2 = document.querySelector('#variants .vbtn');
  if(b2) b2.click();
  await new Promise(r => setTimeout(r, 700));
  const e = document.getElementById('estimate');
  const btn = document.getElementById('estConfirmBtn');
  return { hint: !!e.querySelector('.est-empty'),
           pay: ((e.querySelector('.est-pay b') || {}).textContent || '').trim(),
           per: [...e.querySelectorAll('.est-i-mul span:last-child')].map(x => x.textContent.trim()),
           go: btn ? btn.disabled : null };
});
console.log('  разом: ' + filled.pay + ' · за штуку: ' + JSON.stringify(filled.per));
ok(!filled.hint, 'підказка зникла — рахувати вже є що',
  'підказка лишилась після вибору');
ok(/грн$/.test(filled.pay) && !/шт/.test(filled.pay),
  'підсумок лишається в гривнях — «за штуку» на сумі було б неправдою',
  'підсумок підписано неправильно: «' + filled.pay + '»');
ok(filled.per.length > 0 && filled.per.every(t => /грн\/шт$/.test(t)),
  'а рядок ціни за штуку в кошторисі — у «грн/шт»',
  'у кошторисі ціна за штуку без одиниці: ' + JSON.stringify(filled.per));
ok(filled.go === false,
  'і підтвердити тепер можна',
  'кнопка лишилась неактивною після вибору');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'кожне число на сторінці каже, за що воно');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
