/* Кнопки вибору в КП: стоять там, де є що вирішувати, і кажуть, що роблять.

   ЩО БУЛО НЕ ТАК.

   1. Блок «кількість + додати» приглушувався до 55% прозорості в стані «ще
      не додано» — тобто рівно в тому, у якому від клієнта й чекають дії.
      Єдина кнопка, яку треба натиснути, була намальована напівпрозорою і
      читалась як неактивна: «ніби не робоча зона». А вже додана позиція, де
      робити більше нічого, навпаки світилась.

   2. Кнопка «+ Додати» стояла й на ОСНОВНІЙ позиції. Але основна позиція —
      це те, що менеджер уже поклав у пропозицію: якщо вона в цьому блоці,
      вона вже в замовленні. Кнопка казала протилежне — ніби це допродаж, —
      і клієнт бачив ціну зі знижкою під позицією, яка (за виглядом кнопки)
      у кошторис не входить.

   3. Підпис не казав, КУДИ додається. У кошик? В обране? У замовлення?

   Перевіряємо:
     — у звичайної основної позиції кнопки немає зовсім, лише кількість;
     — у позиції, яку менеджер позначив «варіант на вибір», кнопка є;
     — блок дій не приглушений у жодному зі станів;
     — підписи називають замовлення: «Додати до замовлення» / «У замовленні»,
       у групі варіантів — «Додати цей варіант»;
     — підпис міняється туди й назад, а не лишається від першого натиску.

   Запуск:  node tests/offer-cta.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8856;
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

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E8EDF3"/></svg>');
const item = (kind, name, extra) => Object.assign({
  kind, vgroup: kind === 'variant' ? 'Група 1' : '', name, color:'Чорний',
  print:'Вишивка', sizes:'M × 10', qty:10, unitPrice:900, price:9000,
  basePrice:12000, baseUnitPrice:1200, mockups:[PH], prints:[],
  views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:''
}, extra || {});

/* Одна пропозиція на всі перевірки: звичайна позиція, позиція «на вибір»,
   рекомендована і група варіантів — рівно ті чотири місця, де стоять кнопки. */
const OFFER = {
  orderId:'1002400', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'',
  items:[ item('main', 'Худі базове'),
          item('main', 'Світшот', { optional:true }) ],
  reco:[ item('reco', 'Кепка') ],
  variants:[ item('variant', 'Футболка базова'),
             item('variant', 'Футболка оверсайз') ]
};

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_cta_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:470px;height:2200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:500, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_cta_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1600);
const fr = p.frames()[1];

console.log('═══ КНОПКА СТОЇТЬ ТАМ, ДЕ Є ЩО ВИРІШУВАТИ ═══');
const rows = await fr.evaluate(() =>
  [...document.querySelectorAll('.pbuy-row')].map(r => {
    const b = r.querySelector('.pbuy');
    return { step: !!r.querySelector('.pstep'),
             btn: b ? b.textContent.trim() : null,
             opt: !!r.closest('.pcard') && r.closest('.pcard').classList.contains('is-opt') };
  }));
rows.forEach(r => console.log('   ' + (r.opt ? 'на вибір' : 'основна') +
  ' · лічильник ' + (r.step ? 'є' : 'немає') +
  ' · кнопка ' + (r.btn === null ? 'немає' : '«' + r.btn + '»')));
const plain = rows.filter(r => !r.opt), opt = rows.filter(r => r.opt);
ok(plain.length && plain.every(r => r.btn === null),
  'у звичайної основної позиції кнопки немає — вона вже в замовленні',
  'на основній позиції лишилась кнопка: ' + JSON.stringify(plain));
ok(plain.every(r => r.step),
  'але кількість лишилась: тираж клієнт уточнює сам',
  'разом із кнопкою зник і лічильник');
ok(opt.length && opt.every(r => r.btn && /Додати до замовлення/.test(r.btn)),
  'у позиції «варіант на вибір» кнопка є й каже, куди додає',
  'у позиції на вибір кнопка не та: ' + JSON.stringify(opt));

console.log('');
console.log('═══ БЛОК НЕ ПРИГЛУШЕНИЙ ═══');
/* Прозорість шукаємо по всьому ланцюжку предків: вона ховалась не на
   кнопці, а на обгортці .pqty. */
const dim = () => fr.evaluate(() => {
  let el = document.querySelector('.pbuy'), out = [];
  while(el && el !== document.documentElement){
    const cs = getComputedStyle(el);
    if(cs.opacity !== '1') out.push((el.className || el.tagName) + ' → ' + cs.opacity);
    el = el.parentElement;
  }
  return out;
});
const off = await dim();
const bg = await fr.evaluate(() => getComputedStyle(document.querySelector('.pbuy')).backgroundColor);
console.log('  «не додано» · тло ' + bg + ' · прозорі предки: ' + (off.length ? off.join(', ') : 'немає'));
ok(off.length === 0,
  'у стані «ще не додано» нічого не приглушено — це стан дії, а не вимкненості',
  'блок дій приглушений: ' + JSON.stringify(off));
ok(/rgb\(232, 89, 12\)/.test(bg),
  'кнопка лишається кольоровою й кличе натиснути',
  'кнопка втратила колір: ' + bg);

const afterOn = await fr.evaluate(async () => {
  document.querySelector('.pbuy').click();
  await new Promise(r => setTimeout(r, 700));
  let el = document.querySelector('.pbuy'), out = [];
  const txt = el.textContent.trim();
  while(el && el !== document.documentElement){
    const cs = getComputedStyle(el);
    if(cs.opacity !== '1') out.push((el.className || el.tagName) + ' → ' + cs.opacity);
    el = el.parentElement;
  }
  return { txt, dim: out };
});
console.log('  «' + afterOn.txt + '» · прозорі предки: ' +
            (afterOn.dim.length ? afterOn.dim.join(', ') : 'немає'));
ok(afterOn.dim.length === 0,
  'і в стані «у замовленні» теж — приглушення прибрано в обох станах',
  'у стані «додано» щось приглушено: ' + JSON.stringify(afterOn.dim));
ok(/У замовленні/.test(afterOn.txt),
  'обрана позиція каже, що вона вже в замовленні',
  'стан «додано» не називає себе: «' + afterOn.txt + '»');

console.log('');
console.log('═══ РЕКОМЕНДОВАНІ ═══');
const reco = await fr.evaluate(async () => {
  const b = document.querySelector('.rc-add');
  if(!b) return { none:true };
  const before = b.textContent.trim();
  b.click();
  await new Promise(r => setTimeout(r, 700));
  const after = (document.querySelector('.rc-add') || {}).textContent.trim();
  document.querySelector('.rc-add').click();
  await new Promise(r => setTimeout(r, 700));
  return { before, after, back: (document.querySelector('.rc-add') || {}).textContent.trim() };
});
if(reco.none){ console.log('  рекомендованих немає'); bad++; }
else {
  console.log('  «' + reco.before + '» → «' + reco.after + '» → «' + reco.back + '»');
  ok(/Додати до замовлення/.test(reco.before) && /У замовленні/.test(reco.after),
    'у рекомендованих сказано, куди саме додається — до замовлення',
    'підписи не ті: ' + JSON.stringify(reco));
  ok(reco.back === reco.before,
    'підпис повертається назад — кнопка лишається перемикачем',
    'після другого натиску підпис не повернувся: «' + reco.back + '»');
}

console.log('');
console.log('═══ ВАРІАНТ НА ВИБІР ═══');
const vb = await fr.evaluate(async () => {
  const b = document.querySelector('[data-vpick]');
  if(!b) return { none:true };
  const before = b.textContent.trim();
  b.click();
  await new Promise(r => setTimeout(r, 700));
  const on = document.querySelector('[data-vpick].on');
  return { before, after: on ? on.textContent.trim() : '' };
});
if(vb.none){ console.log('  кнопки варіанта немає'); bad++; }
else {
  console.log('  «' + vb.before + '» → «' + vb.after + '»');
  ok(/Додати цей варіант/.test(vb.before),
    'у групі варіантів кнопка каже, що робить: додає цей варіант',
    'підпис варіанта не той: «' + vb.before + '»');
  ok(/варіант у замовленні/i.test(vb.after),
    'а обраний варіант каже, що він уже в замовленні',
    'обраний варіант не називає себе: «' + vb.after + '»');
}
try{ fs.unlinkSync(VH); }catch(e){}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'кнопки там, де є вибір, і кажуть, що саме роблять');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
