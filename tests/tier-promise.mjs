/* Обіцянка про наступний поріг тиражу мусить збігатися з реальністю.

   Спершу вона стояла в кожній картці рядком «Від 10 шт — 761 грн/шт» і
   бралась із it.tiers — знімка, який адмінка зробила під час збереження.
   Склад пропозиції відтоді міг змінитись: клієнт додав рекомендований
   товар, обрав інший варіант, покрутив кількості. Разова підготовка макета
   ділиться на весь тираж способу, тож будь-яка з цих дій міняє ціну КОЖНОЇ
   позиції — а знімок лишався старим. Клієнт набирав обіцяні 10 штук і бачив
   874 грн замість 761; подекуди поріг виходив ДОРОЖЧИМ за поточну ціну.

   Тепер обіцянка одна на всю сторінку й стоїть під сумою: поріг рахується
   від ЗАГАЛЬНОЇ кількості по способу нанесення, тож у картці окремої
   позиції він і не мав як бути зрозумілим. Названо в ній те саме, на що
   клієнт дивиться, — скільки стане замовлення разом.

   Тест робить рівно те, що робить клієнт: читає обіцянку, набирає названу
   кількість і звіряє підсумок.

   Запуск:  node tests/tier-promise.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8796;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const num = s => s ? +String(s).replace(/[^\d]/g, '') : null;

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:390, height:900 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
/* Кадр із пропозицією: сторінка приймає дані тільки від батьківського
   вікна, тож підкладаємо їх через iframe — так само, як це робить
   адмінка. */
const VH = path.join(ROOT, '_tier_vhost.html');
fs.writeFileSync(VH,
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:390px;height:1600px}</style>
   <iframe id="f" src="offer.html?demo=1"></iframe><script>
   window.__push = o => document.getElementById('f').contentWindow.postMessage(
     { lqEditInit:true, preview:true, offer:o }, '*');</script>`);

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#EEE"/></svg>');
const FP = Array.from({ length:144 }, (_, i) => (i * 1) % 5).join('');
/* Пороги записані ЗАВІДОМО НЕПРАВИЛЬНО — так, як це виходить у житті, коли
   склад пропозиції змінився після збереження. За 50 шт нібито дорожче, ніж
   зараз за 30: рівно те «бери більше — плати більше», на яке скаржився
   менеджер. Сторінка мусить порахувати сама, а не повірити знімку. */
const OFFER = {
  orderId:'T-1', client:{ name:'Андрій', company:'THE DREAMERS' },
  terms:{ deadlineDays:7, payment:'50%', startWith:'', validUntil:'2026-12-01T12:00:00.000Z' },
  trust:[], faq:[], cases:[], state:'', reco:[], variants:[], state_pick:{},
  manager:{ name:'Марія', role:'Ваш менеджер', phone:'+380671112233' },
  items:[{ kind:'main', vgroup:'', name:'Футболка поло', color:'Біла', print:'Вишивка',
    sizes:'M × 45', qty:45, unitPrice:1180, price:53100,
    basePrice:62550, baseUnitPrice:1390, mockups:[PH], prints:[],
    views:[{ side:'front', label:'Перед', img:PH, show:true }],
    sides:[], techniques:[], specs:[], about:'',
    tiers:[{ qty:50, unit:9999 }],
    desc:{ method:'embro', units:45, base:600, coefPart:300, pieceFee:20, dtfCols:[],
           designs:[FP], designKinds:['img'], bare:false } }],
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1},{from:50,coef:.85}] } },
    tiers:[{from:1,coef:1},{from:50,coef:.85}], garmentTiers:[{from:1,coef:1}] }
};

await p.goto(HOST + '/_tier_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__push(o), OFFER);
await p.waitForTimeout(2500);
const fr = () => p.frames()[1];
/* Модель цін сторінка тягне з Firestore; у тесті мережі немає, тож кладемо
   її просто в кадр — інакше живий рушій мовчки вимкнений, і перевіряти
   нічого. */
await fr().evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  document.dispatchEvent(new Event('lq-content'));
  if(window.__lqRefresh) window.__lqRefresh();
}, OFFER.pricing);
await p.waitForTimeout(1200);

const read = () => fr().evaluate(() => ({
  кількість: +(document.querySelector('.est-q-v') || {}).textContent,
  разом: (document.querySelector('.est-pay b') || {}).textContent || '',
  обіцянка: ((document.querySelector('.est-more') || {}).textContent || '')
    .replace(/\s+/g, ' ').trim(),
  вКартках: document.querySelectorAll('.pqty-n').length
}));
/* Лічильник у кошторисі — звичайний click. */
const bump = async n => {
  for(let i = 0; i < n; i++){
    await fr().click('.est-q-b[data-d="1"]');
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(800);
};

console.log('═══ ОБІЦЯНКА ПРО ТИРАЖ ═══');
console.log('  у позиції записано: за 50 шт по 9 999 грн (застарілий знімок)');
const start = await read();
console.log('  сторінка показує:   ' + JSON.stringify(start));
/* У картках порогу немає зовсім: він рахується від загальної кількості по
   способу нанесення, а картка знає лише про себе. */
ok(start.вКартках === 0,
  'у картках порогу немає — там він однаково не був би зрозумілим',
  'у картках лишилось рядків про поріг: ' + start.вКартках);
/* Підказка називає три числа: скільки додати, скільки за це буде знижки на
   все замовлення і скільки стане разом. Тут поріг близький настільки, що
   підсумок ще й падає, — про це сказано окремим хвостом. */
const m = /Додайте ще (\d+)\D+знижку ([\d\s ]+) грн\D*?тираж: ([\d\s ]+) грн — на ([\d\s ]+) грн менше/
  .exec(start.обіцянка);
ok(!!m, 'під сумою є підказка про найближчий поріг: «' + start.обіцянка + '»',
  'порогу не запропоновано зовсім: «' + start.обіцянка + '»');

if(m){
  const need = +m[1], extra = num(m[2]), sum = num(m[3]), less = num(m[4]);
  const was = num(start.разом);
  await bump(need);
  const after = await read();
  console.log('  набрали +' + need + ' шт:   ' + JSON.stringify(after));
  ok(after.кількість === start.кількість + need,
    'кількість набралась просто в кошторисі: ' + after.кількість,
    'кількість не набралась: ' + after.кількість);
  /* Головне: кожне обіцяне число має збігтися з тим, що клієнт побачить,
     а не бути малюнком вигоди. */
  ok(num(after.разом) === sum,
    'підсумок збігся з обіцяним: ' + sum + ' грн',
    'обіцяли разом ' + sum + ', вийшло ' + num(after.разом));
  ok(was - num(after.разом) === less,
    'сума впала рівно на названі ' + less + ' грн',
    'обіцяли мінус ' + less + ', вийшло мінус ' + (was - num(after.разом)));
  /* Знижка — це різниця між тим, скільки той самий більший тираж коштував би
     за старою ціною за штуку, і тим, скільки він коштує тепер. */
  const asIs = (start.кількість + need) * Math.round(was / start.кількість);
  ok(Math.abs(asIs - num(after.разом) - extra) <= 2,
    'знижка на все замовлення порахована з нової кількості: ' + extra + ' грн',
    'обіцяли знижку ' + extra + ', а виходить ' + (asIs - num(after.разом)));
}

/* ── Маленьке замовлення ──────────────────────────────────────────────
   Шість одиниць, поріг за чотири кроки. Додані вироби коштують більше, ніж
   дає знижка, — підсумок росте. Спершу такий випадок ми ховали зовсім, і на
   реальному КП клієнта під сумою не було нічого: підказка не спрацьовувала
   саме там, де вона найпотрібніша.

   Тепер вона є й називає обидва числа — нову ціну за штуку і новий
   підсумок. Тест набирає названу кількість і звіряє обидва. */
console.log('');
console.log('═══ ТЕ САМЕ НА МАЛЕНЬКОМУ ЗАМОВЛЕННІ ═══');
const mk = (name, qty, unit) => ({ kind:'main', vgroup:'', name, color:'Біла', print:'Вишивка',
  sizes:'M × ' + qty, qty, unitPrice:unit, price:unit*qty,
  basePrice:Math.round(unit*qty*1.9), baseUnitPrice:Math.round(unit*1.9),
  mockups:[PH], prints:[], views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:[], specs:[], about:'', tiers:[],
  desc:{ method:'embro', units:qty, base:600, coefPart:300, pieceFee:20, dtfCols:[],
         designs:[FP], designKinds:['img'], bare:false } });
const SMALL = Object.assign({}, OFFER, {
  items:[ mk('Футболка поло', 1, 1360), mk('Футболка базова', 5, 1048) ],
  pricing:{ methods:{ embro:{ orderFee:900,
      tiers:[{from:1,coef:1},{from:10,coef:.8},{from:30,coef:.65}] } },
    tiers:[{from:1,coef:1},{from:10,coef:.8},{from:30,coef:.65}],
    garmentTiers:[{from:1,coef:1}] }
});
/* Сторінка приймає дані один раз, під час ініціалізації кадру, — тож для
   другого випадку відкриваємо її заново. */
await p.goto(HOST + '/_tier_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__push(o), SMALL);
await p.waitForTimeout(2500);
await fr().evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  document.dispatchEvent(new Event('lq-content'));
  if(window.__lqRefresh) window.__lqRefresh();
}, SMALL.pricing);
await p.waitForTimeout(1200);

const s2 = await read();
console.log('  шість одиниць:      ' + JSON.stringify(s2));
const m2 = /Додайте ще (\d+)\D+знижку ([\d\s ]+) грн\D*?тираж: ([\d\s ]+) грн/
  .exec(s2.обіцянка);
ok(!!m2,
  'на маленькому замовленні підказка теж є: «' + s2.обіцянка + '»',
  'під сумою порожньо — підказки немає там, де вона найпотрібніша: «' +
    s2.обіцянка + '»');
/* Тут сума зросте, бо виробів більше, — і хвоста «на стільки менше, ніж
   зараз» бути НЕ повинно: це була б обіцянка, якої в «Разом» не видно. */
ok(!/менше, ніж зараз/.test(s2.обіцянка),
  'про здешевлення підсумку не сказано — його тут і немає',
  'обіцяно менший підсумок там, де він росте: «' + s2.обіцянка + '»');
if(m2){
  const need = +m2[1], extra = num(m2[2]), sum = num(m2[3]);
  const wasU = num((/× ([\d\s ]+) грн/.exec(
    await fr().evaluate(() => (document.querySelector('.est-i-mul') || {}).textContent || ''))
    || [0, '0'])[1]);
  await bump(need);
  const a2 = await fr().evaluate(() => ({
    разом: (document.querySelector('.est-pay b') || {}).textContent || '',
    кількості: [...document.querySelectorAll('.est-q-v')].map(x => +x.textContent)
  }));
  console.log('  набрали +' + need + ' шт:   ' + JSON.stringify(a2));
  ok(num(a2.разом) === sum,
    'підсумок збігся з обіцяним: ' + sum + ' грн',
    'обіцяли разом ' + sum + ', вийшло ' + num(a2.разом));
  const units = a2.кількості.reduce((a, x) => a + x, 0);
  ok(Math.abs(units * wasU - num(a2.разом) - extra) <= 2,
    'знижка на все замовлення порахована з нової кількості: ' + extra + ' грн',
    'обіцяли знижку ' + extra + ', а виходить ' + (units * wasU - num(a2.разом)));
}
try{ fs.unlinkSync(VH); }catch(e){}

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 3).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'обіцянка про тираж збігається з тим, що клієнт побачить');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
