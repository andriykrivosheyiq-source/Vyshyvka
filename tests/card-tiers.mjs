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
const tiersFor = pr => [{ qty:10, unit:pr, sum:pr * 10, now:true }, { qty:20, unit:Math.round(pr * 0.91), sum:0 },
  { qty:30, unit:Math.round(pr * 0.88), sum:0 }, { qty:50, unit:Math.round(pr * 0.86), sum:0 }, { qty:100, unit:Math.round(pr * 0.8), sum:0 },
  { qty:200, unit:Math.round(pr * 0.77), sum:0 }, { qty:300, unit:Math.round(pr * 0.755), sum:0 }, { qty:500, unit:Math.round(pr * 0.73), sum:0 },
  { qty:1000, unit:Math.round(pr * 0.7), sum:0 }];
const it = (n, pr, kind, extra) => Object.assign({ kind: kind || 'variant', vgroup: kind ? '' : 'Група 1',
  name:n, color:'Чорний', print:'Вишивка', sizes:'M × 10', qty:10, unitPrice:pr, price:pr * 10, baseUnitPrice:3169,
  mockups:[], views:[V('front', mock('#141414'), 'Спереду'), V('back', mock('#141414'), 'Ззаду')],
  sides:[], techniques:['Вишивка'], tiers:tiersFor(pr), specs:[{ k:'Матеріал', v:'100% бавовна' }], about:'',
  prints:[{ side:'front', sideLabel:'Спереду', technique:'Вишивка', widthMm:80, heightMm:45 }] }, extra || {});
const OFFER = { token:'t', orderId:'1000057', client:{ name:'Андрій', company:'Stvory' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' }, trust:[], faq:[], cases:[], state:'',
  items:[ it('Худі оверсайз', 2780, 'main'), it('Футболка без порогів', 900, 'main', { tiers:[] }) ],
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

console.log('═══ 1. КАРТКА ПОЗИЦІЇ: СІМ ПЛИТОК, ЛИШЕ ВИЩІ ЗА ТИРАЖ, АРКУШ ВИЩИЙ ═══');
const a = await draw('main:0');
if(a.err) console.log('  ' + JSON.stringify(a));
ok(!a.err && (a.tiers || []).map(t => t.qty).join() === '1,20,30,50,100,200,300,500',
  'на картці «1 шт» за роздрібною й сім порогів: 20…500 (не 10 — це тираж ціни; не 1000 — восьмий)', JSON.stringify(a.tiers));
ok(!a.err && has(a, '1 шт') && has(a, '3 169 грн/шт') && has(a, 'від 20 шт') && has(a, '2 530 грн/шт') && has(a, '−20%') && has(a, 'від 500 шт') && has(a, '2 029 грн/шт') && has(a, '−36%') && !has(a, 'від 1000 шт'),
  'плитки намальовано: «1 шт · 3 169 грн/шт», «від 20 шт · 2 530 грн/шт · −20%» … «від 500 шт · 2 029 грн/шт · −36%»', 'слова: ' + (a.words || []).filter(w => /від|грн|%|шт/.test(w)).join(' | '));
const b = await draw('main:1');
ok(!b.err && b.h === 1000 && !has(b, 'від 20 шт'), 'позиція без порогів — звичайний аркуш 1000, плиток немає', JSON.stringify({ h: b.h }));
ok(!a.err && a.h === 1000 + 126, 'аркуш з плитками вищий рівно на рядок плиток (1126), галерея не меншає', 'висота: ' + a.h);

console.log('═══ 2. ПОЛЕ «ПОРОГИ ТИРАЖУ» ВИМКНЕНО — ЯК БУЛО ═══');
const c = await draw('main:0', { tiers:false });
ok(!c.err && c.h === 1000 && !has(c, 'від 20 шт') && has(c, '2 780 грн/шт'), 'вимкнули поле — аркуш 1000, ціна є, плиток немає', JSON.stringify({ h: c.h }));
const fld = await p.evaluate(() => (window.LQCards.FIELDS || []).map(f => f.id + ':' + f.name).join(', '));
ok(/tiers:Пороги тиражу/.test(fld), 'у «Показувати» є поле «Пороги тиражу»', fld);
const d = await draw('main:0', { unit:false });
ok(!d.err && d.h === 1000 && !has(d, 'від 20 шт'), 'без ціни за штуку порогів теж немає', JSON.stringify({ h: d.h }));

console.log('═══ 3. КАРТКА ПОРІВНЯННЯ: ПЛИТКИ ПІД «ЦІНА ВІД 10 ШТ» У КОЖНОГО, СМУГА РОСТЕ ═══');
const e = await draw('cmp');
if(e.err) console.log('  ' + JSON.stringify(e));
const n20 = (e.words || []).filter(w => w === 'від 20 шт').length;
const n1 = (e.words || []).filter(w => w === '1 шт').length;
const n50 = (e.words || []).filter(w => w === 'від 50 шт').length;
ok(!e.err && n1 === 2 && n20 === 2 && n50 === 2 && !has(e, 'від 100 шт') && has(e, '2 530') && has(e, '2 449'),
  'у двох варіантів по чотири плитки: «1 шт» і три найближчі пороги (20, 30, 50), зі своїми цінами (2 530 і 2 449 на 20 шт)', JSON.stringify({ n1, n20, n50, tiers: e.tiers }));
const f = await draw('cmp', { tiers:false });
/* Два ряди плиток (7 по 4 в рядок) вміщаються в кадр: смуга росте лише на
   залишок, що не вмістився (тут — нуль), а не на цілі рядки плиток. */
ok(!f.err && !has(f, 'від 20 шт') && e.h >= f.h && e.h - f.h <= 2 * 30,
  'вимкнули поле — у порівнянні плиток немає; з плитками аркуш не вищий за кадр (приріст лише на залишок)', JSON.stringify({ h: f.h, eh: e.h }));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ картки: пороги тиражу плитками');
