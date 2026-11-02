/* СКАЧУВАНІ КАРТКИ КП: ПОРОГИ ТИРАЖУ КВАДРАТНИМИ ПЛИТКАМИ ПІД УСІМ (30.10).
   Андрій: «щоб на картці було видно, що при більшій кількості ще будуть
   знижки… маленькими… саме плитками квадратними і шт 7». Під нижньою
   смугою картки позиції — рядок квадратних плиток «від N шт / ціна /
   грн/шт / −%», до семи порогів, лише вищих за тираж ціни, з тих `tiers`,
   що адмінка поклала в документ; аркуш росте під них, галерея ні. У колонці
   порівняння — під «ціна від N шт», смуга виробу росте. Поле «Пороги
   тиражу» вимкнене — плиток і зайвої висоти немає.
   Запуск:  node tests/card-tiers.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8896;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const mock = b => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#EFEFEC"/>' +
  '<rect x="360" y="400" width="480" height="750" fill="' + b + '"/></svg>');
const V = (sd, u, l) => ({ id:sd, side:sd, label:l, img:u, show:true });
/* Пороги — як кладе адмінка: поточний тираж з now, далі вищі; ціна від виробу. */
/* Ряд порогів з-під ціни в конструкторі — один в один, як він його кладе
   на позицію: діапазони, ціна, відсоток від ціни за 1 шт, поточний. */
const rowFor = pr => [[1,1,1,0],[2,3,.91,9],[4,9,.86,14],[10,19,.80,20],[20,49,.74,26],[50,99,.69,31],[100,299,.63,37],[300,499,.59,41],[500,null,.55,45]]
  .map(([a,b,k,pct]) => ({ from:a, to:b, label:a + (b == null ? '+' : '-' + b) + ' шт', price:Math.round(pr * 1.25 * k), pct, now:a === 10 }));
const tiersFor = pr => [{ qty:10, unit:pr, sum:pr * 10, now:true }, { qty:20, unit:Math.round(pr * 0.91), sum:0 },
  { qty:30, unit:Math.round(pr * 0.88), sum:0 }, { qty:50, unit:Math.round(pr * 0.86), sum:0 }, { qty:100, unit:Math.round(pr * 0.8), sum:0 },
  { qty:200, unit:Math.round(pr * 0.77), sum:0 }, { qty:300, unit:Math.round(pr * 0.755), sum:0 }, { qty:500, unit:Math.round(pr * 0.73), sum:0 },
  { qty:1000, unit:Math.round(pr * 0.7), sum:0 }];
const it = (n, pr, kind, extra) => Object.assign({ kind: kind || 'variant', vgroup: kind ? '' : 'Група 1',
  name:n, color:'Чорний', print:'Вишивка', sizes:'M × 10', qty:10, unitPrice:pr, price:pr * 10, baseUnitPrice:3169,
  mockups:[], views:[V('front', mock('#141414'), 'Спереду'), V('back', mock('#141414'), 'Ззаду')],
  sides:[], techniques:['Вишивка'], tiers:tiersFor(pr), tierRow:rowFor(pr), specs:[{ k:'Матеріал', v:'100% бавовна' }], about:'',
  prints:[{ side:'front', sideLabel:'Спереду', technique:'Вишивка', widthMm:80, heightMm:45 }] }, extra || {});
const OFFER = { token:'t', orderId:'1000057', client:{ name:'Андрій', company:'Stvory' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' }, trust:[], faq:[], cases:[], state:'',
  items:[ it('Худі оверсайз', 2780, 'main'), it('Футболка без порогів', 900, 'main', { tiers:[], tierRow:null }),
          it('Стара позиція без ряду', 2780, 'main', { tierRow:null }) ],
  variants:[ it('Худі оверсайз', 2780), it('Худі базове', 2691) ] };

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1200, height:800 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => { const u = r.request().url(); if(u.startsWith(HOST)) return r.continue(); return r.abort(); });
await p.goto(HOST + '/offer-edit.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1500);
/* Малюємо напряму через LQCards: текст, який лягає на полотно, перехоплюємо. */
const draw = (which, fields) => p.evaluate(async ([which, fields, OFFER]) => {
  const words = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(s){ words.push(String(s)); return orig.apply(this, arguments); };
  try{
    const cards = window.LQCards.build(OFFER, { fields });
    const c = cards.find(x => which === 'cmp' ? x.type === 'cmp' : x.id === which);
    if(!c) return { err: 'немає картки ' + which, ids: cards.map(x => x.id + ':' + x.type) };
    const cv = await window.LQCards.draw(c, OFFER, { fields });
    return { h: cv.height / 2, w: cv.width / 2, words, tiers: c.tiers || (c.cols || []).map(x => x.tiers) };
  } finally { CanvasRenderingContext2D.prototype.fillText = orig; }
}, [which, fields || {}, OFFER]);
const has = (r, s) => r.words.some(w => w.indexOf(s) >= 0);

console.log('═══ 1. КАРТКА ПОЗИЦІЇ: РЯД ПОРОГІВ ОДИН В ОДИН З КОНСТРУКТОРА, АРКУШ ВИЩИЙ ═══');
const a = await draw('main:0');
if(a.err) console.log('  ' + JSON.stringify(a));
ok(!a.err && (a.tiers || []).map(t => t.label).join() === '1 шт,2–3 шт,4–9 шт,10–19 шт,20–49 шт,50–99 шт,100–299 шт,300–499 шт,500+ шт',
  'на картці всі девʼять плиток ряду з конструктора: «1 шт», «2–3 шт» … «500+ шт»', JSON.stringify((a.tiers || []).map(t => t.label)));
ok(!a.err && (a.tiers || []).filter(t => t.now).map(t => t.label).join() === '10–19 шт' && (a.tiers || [])[0].one && !(a.tiers || [])[0].pct,
  'поточний тираж — «10–19 шт» (темна рамка), «1 шт» без відсотка', JSON.stringify((a.tiers || []).map(t => [t.label, t.now, t.pct])));
ok(!a.err && has(a, '1 шт') && has(a, '3 475 грн') && has(a, '2–3 шт') && has(a, '3 162 грн') && has(a, '−9%') && has(a, '500+ шт') && has(a, '1 911 грн') && has(a, '−45%') && !has(a, '−0%'),
  'плитки намальовано з числами ряду: «1 шт · 3 475 грн», «2–3 шт · 3 162 грн · −9%» … «500+ шт · 1 911 грн · −45%»', 'слова: ' + (a.words || []).filter(w => /шт|грн|%/.test(w)).join(' | '));
const b = await draw('main:1');
ok(!b.err && b.h === 1000 && !has(b, '2–3 шт'), 'позиція без порогів — звичайний аркуш 1000, плиток немає', JSON.stringify({ h: b.h }));
ok(!a.err && a.h === 1000 + 134, 'аркуш з плитками вищий рівно на рядок плиток (1134), галерея не меншає', 'висота: ' + a.h);
const old = await draw('main:2');
ok(!old.err && (old.tiers || []).map(t => t.qty).join() === '1,20,30,50,100,200,300,500' && has(old, 'від 20 шт') && has(old, '2 530 грн'),
  'стара позиція без ряду — пороги з документа, як доти: «1 шт» і до семи вищих', JSON.stringify(old.tiers));

console.log('═══ 2. ПОЛЕ «ПОРОГИ ТИРАЖУ» ВИМКНЕНО — ЯК БУЛО ═══');
const c = await draw('main:0', { tiers:false });
ok(!c.err && c.h === 1000 && !has(c, '2–3 шт') && has(c, '2 780 грн/шт'), 'вимкнули поле — аркуш 1000, ціна є, плиток немає', JSON.stringify({ h: c.h }));
const fld = await p.evaluate(() => (window.LQCards.FIELDS || []).map(f => f.id + ':' + f.name).join(', '));
ok(/tiers:Пороги тиражу/.test(fld), 'у «Показувати» є поле «Пороги тиражу»', fld);
const d = await draw('main:0', { unit:false });
ok(!d.err && d.h === 1000 && !has(d, '2–3 шт'), 'без ціни за штуку порогів теж немає', JSON.stringify({ h: d.h }));

console.log('═══ 3. КАРТКА ПОРІВНЯННЯ: ПЛИТКИ ПІД «ЦІНА ВІД 10 ШТ» У КОЖНОГО, СМУГА РОСТЕ ═══');
const e = await draw('cmp');
if(e.err) console.log('  ' + JSON.stringify(e));
const cnt = s => (e.words || []).filter(w => w === s).length;
ok(!e.err && cnt('1 шт') === 2 && cnt('10–19 шт') === 2 && cnt('20–49 шт') === 2 && cnt('50–99 шт') === 2 && cnt('2–3 шт') === 0 && cnt('100–299 шт') === 0 && has(e, '2 780 грн') && has(e, '2 691 грн'),
  'у двох варіантів по чотири плитки: «1 шт», поточний «10–19 шт» і два наступні, зі своїми цінами', JSON.stringify({ tiers: (e.tiers || []).map(l => l.map(t => t.label)) }));
const f = await draw('cmp', { tiers:false });
/* Два ряди плиток (7 по 4 в рядок) вміщаються в кадр: смуга росте лише на
   залишок, що не вмістився (тут — нуль), а не на цілі рядки плиток. */
ok(!f.err && !has(f, '10–19 шт') && e.h >= f.h && e.h - f.h <= 2 * 30,
  'вимкнули поле — у порівнянні плиток немає; з плитками аркуш не вищий за кадр (приріст лише на залишок)', JSON.stringify({ h: f.h, eh: e.h }));

console.log('═══ 4. КОНСТРУКТОР КЛАДЕ РЯД ПОРОГІВ НА ПОЗИЦІЮ — ТІ САМІ ЧИСЛА, ЩО ПІД ЦІНОЮ ═══');
/* Ряд під ціною в конструкторі («1-1 шт 1613 грн −36%» …) їде з позицією в
   замовлення як `tierRow`: діапазони, ціна, відсоток, поточний. Саме його
   адмінка кладе в КП, а картка малює. */
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const PRICING = {
  methods:{ embro:{ orderFee:850, orderCost:300, sketchFee:350, sketchCost:150, pieceFee:0, pieceCost:0,
    pricePer1000mm2:30, costPer1000mm2:6, minPrice:300 } },
  basePrices:{ tee:440 },
  tiers:[{ from:1, to:1, coef:1 }, { from:2, to:3, coef:0.9 }, { from:4, to:9, coef:0.85 }, { from:10, to:19, coef:0.8 }, { from:20, to:null, coef:0.7 }],
  garmentTiers:[{ from:1, coef:1 }] };
const K = await browser.newPage({ viewport:{ width:1300, height:1000 } });
K.on('pageerror', e => errs.push('КОНСТРУКТОР: ' + e.message.slice(0, 170)));
await K.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({ contentType:'application/json', body:'{"fields":{}}' });
  return r.abort();
});
await K.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await K.waitForTimeout(4500);
await K.evaluate(pr => { window.SITE_CONTENT = window.SITE_CONTENT || {}; window.SITE_CONTENT.pricing = pr; window.__lqInline = true; window.toast = () => {}; }, PRICING);
const gid = await K.evaluate(() => { const el = document.querySelector('[data-garment]'); return el ? el.getAttribute('data-garment') : null; });
await K.evaluate(g => { window.__lqEditOnly = null; window.__editProduct({ garmentId: g, colorId: null, printId: null, qty: { M: 2 }, logos: { front: [], back: [], left: [], right: [] } }, null, []); }, gid);
await K.waitForTimeout(2000);
const rows = await K.evaluate(() => window.__lqTierRows());
const domRows = await K.evaluate(() => [...document.querySelectorAll('.pm-tier-item')].map(el => ({
  label: (el.querySelector('.pm-tier-label') || {}).textContent, price: (el.querySelector('.pm-tier-price') || {}).textContent,
  badge: (el.querySelector('.pm-tier-badge') || {}).textContent || null, on: el.classList.contains('active') })));
console.log('  ' + JSON.stringify(domRows));
ok(Array.isArray(rows) && rows.length === 5 && rows.map(r => r.label).join() === '1-1 шт,2-3 шт,4-9 шт,10-19 шт,20+ шт',
  'ряд порогів як дані: пʼять діапазонів з налаштувань цін', JSON.stringify(rows));
ok(rows && rows.every((r, i) => domRows[i] && domRows[i].label === r.label && domRows[i].price === r.price + ' грн' && (domRows[i].badge || null) === (r.badge || null) && domRows[i].on === r.isActive),
  'ті самі числа й відсотки, що в плитках під ціною; поточний — той самий', JSON.stringify({ rows, domRows }));
await K.click('#pmAddToCartBtn');
await K.waitForTimeout(1500);
const cart = await K.evaluate(() => JSON.parse(JSON.stringify((window.__cartItems || [])[0] || null)));
ok(cart && Array.isArray(cart.tierRow) && cart.tierRow.length === 5 && cart.tierRow[1].from === 2 && cart.tierRow[1].to === 3 && cart.tierRow[1].now === true &&
   cart.tierRow[4].to === null && cart.tierRow.every((r, i) => r.price === rows[i].price && r.pct === (rows[i].pct || 0) && r.label === rows[i].label),
  'у позиції кошика лежить tierRow: діапазони, ціна, відсоток, поточний «2-3 шт» (тираж 2)', JSON.stringify(cart && cart.tierRow));
await K.close();

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ картки: пороги тиражу плитками');
