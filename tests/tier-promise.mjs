/* Обіцянка про наступний поріг тиражу мусить збігатися з реальністю.

   «Від 10 шт — 761 грн/шт» бралось із it.tiers — знімка, який адмінка
   зробила під час збереження. Склад пропозиції відтоді міг змінитись:
   клієнт додав рекомендований товар, обрав інший варіант, покрутив
   кількості. Разова підготовка макета ділиться на весь тираж способу, тож
   будь-яка з цих дій міняє ціну КОЖНОЇ позиції — а знімок лишався старим.

   Через це клієнт набирав обіцяні 10 штук і бачив 874 грн замість 761. А
   подекуди поріг виходив ДОРОЖЧИМ за поточну ціну, тобто «бери більше —
   плати більше».

   Тест робить рівно те, що робить клієнт: читає обіцянку, набирає ту саму
   кількість і звіряє ціну.

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
    sizes:'M × 30', qty:30, unitPrice:1180, price:35400,
    basePrice:41700, baseUnitPrice:1390, mockups:[PH], prints:[],
    views:[{ side:'front', label:'Перед', img:PH, show:true }],
    sides:[], techniques:[], specs:[], about:'',
    tiers:[{ qty:50, unit:9999 }],
    desc:{ method:'embro', units:30, base:600, coefPart:300, pieceFee:20, dtfCols:[],
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

const read = () => fr().evaluate(() => {
  const c = document.querySelectorAll('.pcard')[0];
  return { кількість: +(c.querySelector('.pstep-v b') || {}).textContent,
           ціна: (c.querySelector('.pcard-price') || {}).textContent,
           обіцянка: (c.querySelector('.pqty-n') || {}).textContent || '' };
});
/* Лічильник слухає pointerdown/pointerup, а не click — інакше жодного
   натиску він не бачить. */
const bump = async n => {
  for(let i = 0; i < n; i++){
    await fr().evaluate(() => {
      const b = document.querySelector('[data-q="0"][data-d="1"]');
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, button:0 }));
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, button:0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, button:0 }));
    });
    await p.waitForTimeout(80);
  }
  await p.waitForTimeout(700);
};

console.log('═══ ОБІЦЯНКА ПРО ТИРАЖ ═══');
console.log('  у позиції записано: за 50 шт по 9 999 грн (застарілий знімок)');
const start = await read();
console.log('  сторінка показує:   ' + JSON.stringify(start));
const m = /Від (\d+) шт — ([\d\s ]+)/.exec(start.обіцянка);
ok(!!m, 'рядок про наступний поріг є', 'порогу не запропоновано зовсім');

if(m){
  const target = +m[1], promised = num(m[2]);
  ok(promised < num(start.ціна),
    'на порозі ДЕШЕВШЕ, ніж зараз: ' + promised + ' проти ' + num(start.ціна),
    'поріг не дешевший: ' + promised + ' проти ' + num(start.ціна) + ' — «бери більше, плати більше»');
  await bump(target - start.кількість);
  const after = await read();
  console.log('  набрали ' + target + ' шт:    ' + JSON.stringify(after));
  ok(after.кількість === target,
    'кількість набралась', 'кількість не набралась: ' + after.кількість);
  ok(num(after.ціна) === promised,
    'ціна збіглася з обіцяною: ' + promised + ' грн',
    'обіцяли ' + promised + ', вийшло ' + num(after.ціна));
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
