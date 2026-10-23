/* ВІКНО РОЗМІЩЕННЯ: ПОВЕРНУТИ, ПЕРЕФАРБУВАТИ, ПЕРЕД І СПИНА, PHOTOROOM (23.10).

   Андрій: «де є розміщення — щоб він перефарбував цей файл, як розмістив,
   перефарбував, повернув і поїхав»; «дві картинки — спереду і ззаду»;
   «видалення фону для дизайнерів — платною підпискою».
   1. Поворот і колір є й у вікні дизайнера (не лише «✎ Розміщення»).
   2. Поворот міняє сам файл (сторони міняються місцями), колір після
      повороту поворот не скасовує, «↩ Без повороту» — назад, колір лишається.
   3. Збереження несе rot і чистий оригінал.
   4. Відкрили версію з поворотом — кут той самий, крутиться від оригіналу;
      без оригіналу — кут від нуля (без подвійного повороту).
   5. Дві роботи без розміщення: перша — перед, друга — спина.
   6. Фон: першим — PhotoRoom; не відповів — так і пишемо, тихо простим не прибираємо.
   7. Завантажили роботу — PhotoRoom прибирає фон сам (прозорий файл — не кличемо).

   Запуск:  node tests/place-tools.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9049;
let prCalls = 0;
const srv = createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  /* Підставний воркер PhotoRoom: повертає прозорий PNG 4×4 і рахує виклики. */
  if(u === '/pr'){ prCalls++; res.writeHead(200, { 'Content-Type':'image/png' });
    return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR42mNgGAWjYBSMAggAAAQQAAGFP6pyAAAAAElFTkSuQmCC', 'base64')); }
  if(u === '/t.html'){ res.writeHead(200, { 'Content-Type':'text/html' });
    return res.end('<!doctype html><meta charset="utf-8"><body><script src="/loomiq-mock.js"></script></body>'); }
  try{ const body = await readFile(path.join(ROOT, decodeURIComponent(u).replace(/^\/+/, '')));
    res.writeHead(200, { 'Content-Type': u.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1300, height:860 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
await p.goto('http://127.0.0.1:' + PORT + '/t.html');

await p.evaluate(() => {
  const png = (w, h, fill) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); fill(x); return c.toDataURL('image/png'); };
  window.__png = png;
  window.__фото = png(400, 500, x => { x.fillStyle = '#334'; x.fillRect(0, 0, 400, 500); });
  window.__спина = png(400, 500, x => { x.fillStyle = '#433'; x.fillRect(0, 0, 400, 500); });
  /* Білий принт 100×60 з прозорим полем. */
  window.__білий = png(100, 60, x => { x.fillStyle = '#fff'; x.fillRect(20, 10, 60, 40); });
  window.__друга = png(80, 80, x => { x.fillStyle = '#fff'; x.fillRect(10, 10, 60, 60); });
  window.__dim = url => new Promise(r => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    r({ w: im.width, h: im.height, mid: Array.from(x.getImageData(im.width >> 1, im.height >> 1, 1, 1).data) }); }; im.src = url; });
  window.LQMock.host = { bgUrl: () => '' };   // PhotoRoom не налаштований — має підхопити простий
});
const wkImg = () => p.evaluate(async () => __dim(document.querySelector('.mko-wk img').src));

console.log('═══ 1. ВІКНО ДИЗАЙНЕРА: Є ПОВОРОТ І КОЛІР ═══');
await p.evaluate(() => {
  window.__res = null;
  window.LQMock.openWork({ gid: 'hoodie', size: 'M', color: 'чорний', name: 'дизайнер',
    sides: [{ key: 'front', label: 'Перед', url: __фото }, { key: 'back', label: 'Спина', url: __спина }],
    works: [{ name: 'принт.png', url: __білий, hash: 'h1' }],
    places: [{ side: 'front', work: 0, x: 0.5, y: 0.3, w: 0.2 }],
    onDone: res => { window.__res = res; } });
});
await p.waitForTimeout(600);
const кн = await p.evaluate(() => ({ rot: document.querySelectorAll('[data-mko-rot]').length, clr: !!document.querySelector('[data-mko-clr]'),
  фон: [...document.querySelectorAll('[data-mko-bg]')].map(b => b.getAttribute('data-mko-bg')) }));
console.log('  ' + JSON.stringify(кн));
ok(кн.rot >= 4 && кн.clr, 'у вікні дизайнера є «↺ 90° / −15° / +15° / ↻ 90°» і «🎨 Змінити колір»', JSON.stringify(кн));
ok(кн.фон.join() === 'none,photoroom,local', 'фон: першим — PhotoRoom, простий — запасний', кн.фон.join());

console.log('═══ 2. ПОВОРОТ МІНЯЄ ФАЙЛ, КОЛІР ЙОГО НЕ СКАСОВУЄ ═══');
await p.click('[data-mko-rot="90"]');
await p.waitForTimeout(500);
const r1 = await wkImg();
ok(r1.w === 60 && r1.h === 100, 'після «↻ 90°» принт 60×100 (був 100×60)', JSON.stringify(r1));
ok(await p.evaluate(() => /90°/.test(document.querySelector('.mko-clr').textContent) && !!document.querySelector('[data-mko-rot="0"]')),
  'видно кут 90° і «↩ Без повороту»', 'кута немає');
await p.click('[data-mko-clr]'); await p.waitForTimeout(120);
await p.click('[data-mko-sw="#111111"]'); await p.waitForTimeout(500);
const r2 = await wkImg();
ok(r2.w === 60 && r2.h === 100 && r2.mid.slice(0, 3).join() === '17,17,17', 'перефарбували — чорний і досі повернутий', JSON.stringify(r2));
await p.click('[data-mko-rot="0"]'); await p.waitForTimeout(500);
const r3 = await wkImg();
ok(r3.w === 100 && r3.h === 60 && r3.mid.slice(0, 3).join() === '17,17,17', '«↩ Без повороту» — знову 100×60, колір лишився', JSON.stringify(r3));
await p.click('[data-mko-rot="15"]'); await p.waitForTimeout(500);
const r4 = await wkImg();
ok(r4.w > 100 && r4.h > 60, '+15° — рамка файлу розширилась під нахил, нічого не обрізано', JSON.stringify(r4));
await p.click('[data-mko-rot="-15"]'); await p.waitForTimeout(500);
await p.click('[data-mko-rot="90"]'); await p.waitForTimeout(500);

console.log('═══ 3. ЗБЕРЕГТИ — ФАЙЛ ПОВЕРНУТИЙ, КУТ І ОРИГІНАЛ ПОРУЧ ═══');
await p.click('[data-mko-save]');
await p.waitForTimeout(1500);
const res = await p.evaluate(async () => { const w = window.__res && window.__res.works[0]; if(!w) return null;
  return { rot: w.rot, color: w.color && w.color.name, dim: await __dim(w.url), orig: w.clrOrig === __білий }; });
console.log('  ' + JSON.stringify(res));
ok(res && res.rot === 90 && res.color === 'Чорний' && res.dim.w === 60 && res.orig,
  'у збереженні — чорний повернутий файл, кут 90 і чистий оригінал', JSON.stringify(res));

console.log('═══ 4. ВІДКРИЛИ ВЕРСІЮ З ПОВОРОТОМ ═══');
await p.evaluate(async () => {
  const k = document.createElement('canvas'); k.width = 60; k.height = 100;
  const x = k.getContext('2d'); x.translate(30, 50); x.rotate(Math.PI / 2);
  const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = __білий; });
  x.drawImage(im, -50, -30);
  window.__повернутий = k.toDataURL('image/png');
  window.LQMock.openWork({ placeOnly: true, gid: 'hoodie', size: 'M', color: 'чорний', name: 'v2',
    sides: [{ key: 'front', label: 'Перед', url: __фото }],
    works: [{ name: 'принт.png', url: __повернутий, hash: 'h1', rot: 90, xfFrom: __білий }],
    places: [{ side: 'front', work: 0, x: 0.5, y: 0.3, w: 0.2 }], onDone: () => {} });
});
await p.waitForTimeout(600);
ok(await p.evaluate(() => /90°/.test((document.querySelector('.mko-clr') || {}).textContent || '')), 'відкрилось з кутом 90°', 'кут загубився');
await p.click('[data-mko-rot="90"]'); await p.waitForTimeout(500);
const v4 = await wkImg();
ok(v4.w === 100 && v4.h === 60, 'ще «↻ 90°» — 180° від оригіналу (100×60), а не поворот поверх повороту', JSON.stringify(v4));
await p.evaluate(() => {
  window.LQMock.openWork({ placeOnly: true, gid: 'hoodie', size: 'M', color: 'чорний', name: 'v3',
    sides: [{ key: 'front', label: 'Перед', url: __фото }],
    works: [{ name: 'принт.png', url: __повернутий, hash: 'h1', rot: 90 }],
    places: [{ side: 'front', work: 0, x: 0.5, y: 0.3, w: 0.2 }], onDone: () => {} });
});
await p.waitForTimeout(600);
ok(await p.evaluate(() => !!document.querySelector('[data-mko-rot="90"]') && !document.querySelector('[data-mko-rot="0"]')),
  'без оригіналу поворот уже у файлі — кут від нуля, подвійного повороту немає', 'кут 90 без оригіналу');

console.log('═══ 5. ДВІ КАРТИНКИ — ПЕРЕД І СПИНА ═══');
await p.evaluate(() => {
  window.__res = null;
  window.LQMock.openWork({ gid: 'hoodie', size: 'M', color: 'чорний', name: 'дві',
    sides: [{ key: 'front', label: 'Перед', url: __фото }, { key: 'back', label: 'Спина', url: __спина }],
    works: [{ name: 'груди.png', url: __білий, hash: 'a' }, { name: 'спина.png', url: __друга, hash: 'b' }],
    onDone: res => { window.__res = res; } });
});
await p.waitForTimeout(600);
const таби = await p.evaluate(() => [...document.querySelectorAll('.mko-tab')].map(b => b.textContent));
ok(таби.length === 2 && /Перед1/.test(таби[0]) && /Спина1/.test(таби[1]), 'перша — на перед, друга — на спину', таби.join(' | '));
await p.click('[data-mko-save]');
await p.waitForTimeout(1800);
const м = await p.evaluate(() => { const r = window.__res; if(!r) return null;
  const s = JSON.stringify(Object.keys(r)); return { keys: s, sides: (r.mocks || r.sides || []).map(x => x.side || x.key) }; });
console.log('  ' + JSON.stringify(м));
ok(м && м.sides.indexOf('front') >= 0 && м.sides.indexOf('back') >= 0, 'мокап зібрано на обидва боки', JSON.stringify(м));

console.log('═══ 6. ФОН: PHOTOROOM НЕ ВІДПОВІДАЄ — ТАК І ПИШЕМО, ФОН НЕ ЧІПАЄМО ═══');
await p.evaluate(() => {
  const зФоном = __png(120, 120, x => { x.fillStyle = '#fff'; x.fillRect(0, 0, 120, 120); x.fillStyle = '#c00'; x.fillRect(30, 30, 60, 60); });
  window.__зФоном = зФоном;
  window.LQMock.openWork({ gid: 'hoodie', size: 'M', color: 'чорний', name: 'фон',
    sides: [{ key: 'front', label: 'Перед', url: __фото }],
    works: [{ name: 'фото.png', url: зФоном, hash: 'f' }],
    places: [{ side: 'front', work: 0, x: 0.5, y: 0.3, w: 0.2 }], onDone: () => {} });
});
await p.waitForTimeout(600);
await p.click('[data-mko-bg="photoroom"]');
await p.waitForFunction(() => !document.querySelector('[data-mko-bg][disabled]'), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(400);
const ф = await p.evaluate(async () => { const d = await new Promise(r => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    r({ кут: x.getImageData(2, 2, 1, 1).data[3] }); }; im.src = document.querySelector('.mko-wk img').src; });
  return Object.assign(d, { note: (document.querySelector('[data-mko-bgbox] .is-err') || {}).textContent || '',
    on: (document.querySelector('[data-mko-bg].on') || {}).getAttribute ? document.querySelector('[data-mko-bg].on').getAttribute('data-mko-bg') : '' }); });
console.log('  ' + JSON.stringify(ф));
ok(ф.кут === 255 && ф.on === 'none', 'фон не чіпали тихо простим способом — робота як була', JSON.stringify(ф));
ok(/PhotoRoom не відповідає/.test(ф.note) && /адреса воркера/.test(ф.note), 'червоним: «PhotoRoom не відповідає: … адреса воркера …»', ф.note);

console.log('═══ 7. ЗАВАНТАЖИЛИ — PHOTOROOM ПРИБИРАЄ ФОН САМ ═══');
await p.evaluate(h => {
  window.LQMock.host = { bgUrl: () => h + '/pr' };
  window.LQMock.openWork({ gid: 'hoodie', size: 'M', color: 'чорний', name: 'авто',
    sides: [{ key: 'front', label: 'Перед', url: __фото }], works: [], places: [],
    onUpload: async () => ({ name: 'лого.png', url: __зФоном, hash: 'u1' }), onDone: () => {} });
}, 'http://127.0.0.1:' + PORT);
await p.waitForTimeout(500);
prCalls = 0;
await p.click('[data-mko-up]');
await p.waitForFunction(() => document.querySelector('[data-mko-bg="photoroom"].on'), null, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(300);
const ав = await p.evaluate(() => ({ on: (document.querySelector('[data-mko-bg].on') || { getAttribute: () => '' }).getAttribute('data-mko-bg'),
  err: (document.querySelector('[data-mko-bgbox] .is-err') || {}).textContent || '' }));
ok(prCalls === 1 && ав.on === 'photoroom' && !ав.err, 'після завантаження — один виклик PhotoRoom, фон прибрано без натискань', JSON.stringify(ав) + ' викликів ' + prCalls);
await p.evaluate(() => { window.LQMock.close && window.LQMock.close(); });
await p.evaluate(() => {
  window.LQMock.openWork({ gid: 'hoodie', size: 'M', color: 'чорний', name: 'прозора',
    sides: [{ key: 'front', label: 'Перед', url: __фото }], works: [], places: [],
    onUpload: async () => ({ name: 'прозоре.png', url: __білий, hash: 'u2' }), onDone: () => {} });
});
await p.waitForTimeout(500);
prCalls = 0;
await p.click('[data-mko-up]');
await p.waitForTimeout(1200);
ok(prCalls === 0, 'файл уже з прозорим фоном — PhotoRoom не кличемо (кредити)', 'викликів ' + prCalls);

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'поворот, колір, перед і спина, PhotoRoom — на місці');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
