/* СКАЧУВАНІ КАРТКИ КП: ПОРОГИ ТИРАЖУ ТАБЛЕТКАМИ ПІД УСІМ (30.10).
   Андрій: «щоб на картці було видно, що при більшій кількості ще будуть
   знижки… маленькими таблетками під всім». Під нижньою смугою картки
   позиції — рядок таблеток «від N шт · ціна/шт · −%», до трьох порогів,
   лише вищих за тираж ціни, з тих `tiers`, що адмінка поклала в документ;
   аркуш росте під них, галерея ні. У колонці порівняння — під «ціна від N
   шт». Поле «Пороги тиражу» вимкнене — таблеток і зайвої висоти немає.
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
  { qty:50, unit:Math.round(pr * 0.86), sum:0 }, { qty:100, unit:Math.round(pr * 0.8), sum:0 }, { qty:300, unit:Math.round(pr * 0.755), sum:0 }];
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

console.log('═══ 1. КАРТКА ПОЗИЦІЇ: ТРИ ТАБЛЕТКИ, ЛИШЕ ВИЩІ ЗА ТИРАЖ, АРКУШ ВИЩИЙ ═══');
const a = await draw('main:0');
if(a.err) console.log('  ' + JSON.stringify(a));
ok(!a.err && JSON.stringify(a.tiers) === JSON.stringify([{ qty:20, unit:2530 }, { qty:50, unit:2391 }, { qty:100, unit:2224 }]),
  'на картці три пороги: 20, 50, 100 (не 10 — це тираж ціни; не 300 — четвертий)', JSON.stringify(a.tiers));
ok(!a.err && has(a, 'від 20 шт') && has(a, '2 530 грн/шт') && has(a, '−20%') && has(a, 'від 100 шт') && has(a, '2 224 грн/шт') && has(a, '−30%'),
  'таблетки намальовано: «від 20 шт · 2 530 грн/шт · −20%» … «від 100 шт · 2 224 грн/шт · −30%»', 'слова: ' + (a.words || []).filter(w => /від|грн|%/.test(w)).join(' | '));
const b = await draw('main:1');
ok(!b.err && b.h === 1000 && !has(b, 'від 20 шт'), 'позиція без порогів — звичайний аркуш 1000, таблеток немає', JSON.stringify({ h: b.h }));
ok(!a.err && a.h === 1000 + 56, 'аркуш з таблетками вищий рівно на рядок таблеток (1056), галерея не меншає', 'висота: ' + a.h);

console.log('═══ 2. ПОЛЕ «ПОРОГИ ТИРАЖУ» ВИМКНЕНО — ЯК БУЛО ═══');
const c = await draw('main:0', { tiers:false });
ok(!c.err && c.h === 1000 && !has(c, 'від 20 шт') && has(c, '2 780 грн/шт'), 'вимкнули поле — аркуш 1000, ціна є, таблеток немає', JSON.stringify({ h: c.h }));
const fld = await p.evaluate(() => (window.LQCards.FIELDS || []).map(f => f.id + ':' + f.name).join(', '));
ok(/tiers:Пороги тиражу/.test(fld), 'у «Показувати» є поле «Пороги тиражу»', fld);
const d = await draw('main:0', { unit:false });
ok(!d.err && d.h === 1000 && !has(d, 'від 20 шт'), 'без ціни за штуку порогів теж немає', JSON.stringify({ h: d.h }));

console.log('═══ 3. КАРТКА ПОРІВНЯННЯ: ТАБЛЕТКИ ПІД «ЦІНА ВІД 10 ШТ» У КОЖНОГО ═══');
const e = await draw('cmp');
if(e.err) console.log('  ' + JSON.stringify(e));
const n20 = (e.words || []).filter(w => w === 'від 20 шт').length;
ok(!e.err && n20 === 2 && has(e, '2 530 грн/шт') && has(e, '2 449 грн/шт'),
  'у двох варіантів по рядку таблеток зі своїми цінами (2 530 і 2 449 на 20 шт)', JSON.stringify({ n20, tiers: e.tiers }));
const f = await draw('cmp', { tiers:false });
ok(!f.err && !has(f, 'від 20 шт') && f.h === e.h, 'вимкнули поле — у порівнянні таблеток немає, висота та сама', JSON.stringify({ h: f.h, eh: e.h }));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ картки: пороги тиражу таблетками');
