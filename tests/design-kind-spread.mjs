/* Вид дизайну — рішення про МАЛЮНОК, а не про позицію.

   ЩО БУЛО НЕ ТАК. Менеджер збирає пропозицію: футболка, худі, шопер — і на
   всіх той самий напис, який клієнт надіслав картинкою. Він перемикає його
   на «напис» у поточній позиції, а решта кошика лишається з «картинкою».
   Далі все йде не туди одразу в трьох місцях:

     • разова за напис ділиться на одну позицію замість трьох;
     • те саме зображення рахується двічі — як напис і як логотип, тобто два
       макети замість одного;
     • ціна в кошику стає неправдивою, і найгірше — правдоподібною.

   ЯК МАЄ БУТИ. Той самий малюнок — той самий вид, скрізь, де він стоїть.
   Рівно так це вже працює в адмінці: `applyKindFix` розкладає мапу по всьому
   замовленню. Бракувало другої половини — самого кошика конструктора.

   ТРИ МІСЦЯ, БО ЧИТАЮТЬ ІЗ ТРЬОХ. Вибір мусить лягти на шар (він їде в
   config.logos і повертається з позицією), в опис для рушія (з нього
   рахується ціна) і в мапу designKindFix (її адмінка накладає поверх
   автоматики перед кожним перерахунком). Розійшовшись, вони й давали
   «перемкнув, а воно повернулось».

   «НЕ РАХУВАТИ» — це про підготовку, а не про сам малюнок. Дизайн лишається
   на виробі й далі вишивається; знімаються рівно разові — макет і ескіз.

   Запуск:  node tests/design-kind-spread.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8879;
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

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1300, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

/* Ставки різні навмисно: за ціною одразу видно, який вид рахується. */
await p.evaluate(() => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = {
    methods:{ embro:{ orderFee:900, orderCost:300, sketchFee:400, sketchCost:150,
      pieceFee:0, pieceCost:0, pricePer1000mm2:34, costPer1000mm2:7, minPrice:400,
      text:{ orderFee:300, orderCost:120, sketchFee:150, sketchCost:60,
             pricePer1000mm2:34, costPer1000mm2:7, minPrice:400 } } },
    tiers:[{ from:1, coef:1 }],
    garmentTiers:[{ from:1, coef:1 }] };
  window.__lqInline = true;              // зберігаємо в кошик без проміжного вікна
});

const gid = await p.evaluate(() => {
  const el = document.querySelector('[data-garment]');
  return el ? el.getAttribute('data-garment') : null;
});
const FP = Array.from({ length:64 }, (_, i) => (i * 3 + 1) % 5).join('');
const cfg = (qty) => ({ garmentId: gid, colorId:null, printId:null, qty:{ M: qty },
  logos:{ front:[{ id:'L1', url:'https://cdn.test/logo.png', fp:FP, scale:1, frac:0.32,
                   fx:0.3, fy:0.3, ar:1, fill:0.8, opaqueBox:{ x0:0, y0:0, x1:1, y1:1 },
                   w:60, h:60 }], back:[], left:[], right:[] } });

const flip = async value => {
  await p.evaluate(v => {
    const s = document.querySelector('#pmMgrCalc [data-mgr-kind]');
    if(!s) throw new Error('перемикача виду немає');
    s.value = v; s.dispatchEvent(new Event('change', { bubbles:true }));
  }, value);
  await p.waitForTimeout(800);
};
const cart = () => p.evaluate(fp => (window.__cartItems || []).map(it => ({
  назва: it.name, тираж: it.qty, ціна: +it.price || 0, заШтуку: +it.unitPrice || 0,
  види: (it.desc && it.desc.designKinds) || [],
  мапа: (it.designKindFix || {})[fp] || null,
  шар: (((it.config || {}).logos || {}).front || []).map(l => l.kindFix || '—').join(',')
})), FP);

// Перша позиція: п'ять футболок із логотипом — і в кошик.
await p.evaluate(c => window.__editProduct(c, null, []), cfg(5));
await p.waitForTimeout(1600);
await p.click('#pmAddToCartBtn');
await p.waitForTimeout(1800);
// Друга позиція: десять штук, ТОЙ САМИЙ малюнок — лишається чернеткою.
await p.evaluate(c => window.__editProduct(c, null, []), cfg(10));
await p.waitForTimeout(1600);

const було = await cart();
console.log('═══ У КОШИКУ ОДНА ПОЗИЦІЯ, ДРУГА В РОБОТІ ═══');
console.log('  ' + JSON.stringify(було));
ok(було.length === 1 && було[0].види.join() === 'img',
  'позиція в кошику рахується як картинка — так вирішила автоматика',
  'кошик зібрався не так: ' + JSON.stringify(було));

console.log('');
console.log('═══ ПЕРЕМКНУЛИ В ЧЕРНЕТЦІ — ЗМІНИЛОСЬ І В КОШИКУ ═══');
await flip('txt');
const стало = await cart();
console.log('  ' + JSON.stringify(стало));
ok(стало[0].види.join() === 'txt',
  'опис для рушія в сусідній позиції теж став написом — з нього й рахується ціна',
  'сусідня позиція лишилась картинкою: ' + JSON.stringify(стало[0].види));
ok(стало[0].мапа === 'txt',
  'і мапа за відбитком — її адмінка накладає поверх автоматики перед кожним рахунком',
  'мапи немає: ' + стало[0].мапа);
ok(стало[0].шар === 'txt',
  'і сам шар — він їде в config.logos і повертається разом із позицією',
  'шар лишився старим: ' + стало[0].шар);
console.log('  ціна позиції в кошику: ' + було[0].заШтуку + ' → ' + стало[0].заШтуку + ' ₴/шт');
ok(стало[0].заШтуку !== було[0].заШтуку,
  'ціна сусідньої позиції перерахувалась одразу — разова стала іншою',
  'ціна в кошику лишилась старою: ' + стало[0].заШтуку);

console.log('');
console.log('═══ ОДИН МАЛЮНОК — ОДИН МАКЕТ НА ОБИДВІ ПОЗИЦІЇ ═══');
const split = await p.evaluate(() => {
  const d = window.__lqDraftDesc();
  const rows = (window.__lqCalcLines() || []).map(r => (r.label || r[0] || '') + ' ' + (r.value || r[1] || ''));
  return { kinds: d.kinds, unit: d.unit, sketches: d.sketches, nos: d.designNos, rows };
});
console.log('  види: ' + split.kinds.join(',') + ' · ескізів: ' + split.sketches +
            ' · дизайни: ' + split.nos.join(' '));
ok(split.kinds.join() === 'txt' && split.sketches === 0,
  'той самий напис на двох позиціях — одна підготовка, і жодного ескізу',
  'малюнок роздвоївся: ' + JSON.stringify(split));

console.log('');
console.log('═══ «НЕ РАХУВАТИ» ЗНІМАЄ ПІДГОТОВКУ, А НЕ НАНЕСЕННЯ ═══');
const зНаписом = await p.evaluate(() => window.__lqDraftDesc().unit);
await flip('off');
const безМакета = await p.evaluate(() => window.__lqDraftDesc().unit);
const off = await cart();
console.log('  ціна за штуку: ' + зНаписом + ' → ' + безМакета + ' ₴');
ok(безМакета < зНаписом && безМакета > 0,
  'ціна впала рівно на разову — саме нанесення лишилось платним: тканину прошити все одно треба',
  'ціна поводиться не так: ' + зНаписом + ' → ' + безМакета);
ok(off[0].види.join() === 'off' && off[0].мапа === 'off' && off[0].шар === 'off',
  '«не рахувати» так само доїхало до сусідньої позиції',
  'сусідня позиція лишилась платною: ' + JSON.stringify(off[0]));

console.log('');
console.log('═══ ВИБІР ПЕРЕЖИВАЄ ПОВЕРНЕННЯ ПОЗИЦІЇ З КОШИКА ═══');
await flip('txt');
const back = await p.evaluate(async () => {
  const it = (window.__cartItems || [])[0];
  window.__editProduct(JSON.parse(JSON.stringify(it.config)), null, []);
  await new Promise(r => setTimeout(r, 1500));
  return window.__lqDraftDesc().kinds;
});
console.log('  після повернення з кошика: ' + back.join(','));
ok(back.join() === 'txt',
  'позицію відкрили заново — вид лишився тим, який поставив менеджер',
  'вибір злетів при поверненні: ' + back.join(','));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'вид дизайну належить малюнку, і кошик це знає');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
