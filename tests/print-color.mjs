/* КОЛІР ПРИНТА ГОТОВОГО ДИЗАЙНУ (Андрій, 20.10).

   «Готовий дизайн, худі базова, етикетка — принт білий, треба замінити на
   чорний, як у зоні КП». У вікні «Поправити розміщення» обрана картинка
   зводиться в один колір (лише вона), «↩ Повернути колір» — назад; колір
   іде в розміщення як нитка (вишивальник і цех бачать «Чорний»).

   Запуск:  node tests/print-color.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8987;
const srv = createServer(async (req, res) => {
  const u = req.url.split('?')[0];
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
  const фото = png(400, 500, x => { x.fillStyle = '#334'; x.fillRect(0, 0, 400, 500); });
  /* Білий принт з прозорим полем навколо. */
  const білий = png(100, 60, x => { x.fillStyle = '#fff'; x.fillRect(20, 10, 60, 40); });
  const другий = png(80, 80, x => { x.fillStyle = '#fff'; x.fillRect(10, 10, 60, 60); });
  window.__pix = url => new Promise(r => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    r({ in: Array.from(x.getImageData(50, 30, 1, 1).data), out: Array.from(x.getImageData(2, 2, 1, 1).data) }); }; im.src = url; });
  window.LQMock.openWork({ placeOnly: true, recolor: true, gid: 'hoodie', size: 'M', color: 'чорний', name: 'Готовий дизайн «Етикетка»',
    sides: [{ key: 'front', label: 'Перед', url: фото }],
    works: [{ name: 'етикетка.png', url: білий, hash: 'ready:rd1' }, { name: 'груди.png', url: другий, hash: 'ready:rd1:1' }],
    places: [{ side: 'front', work: 0, x: 0.5, y: 0.3, w: 0.2 }, { side: 'front', work: 1, x: 0.5, y: 0.6, w: 0.2 }],
    onDone: res => { window.__res = res; } });
});
await p.waitForTimeout(700);

console.log('═══ 1. КНОПКА Й ЗРАЗКИ ═══');
const кн = await p.evaluate(() => ({ є: !!document.querySelector('[data-mko-clr]'), зразків: document.querySelectorAll('[data-mko-sw]').length }));
ok(кн.є && кн.зразків === 0, 'у вікні є «🎨 Змінити колір», зразки — лише після натиску', JSON.stringify(кн));
await p.click('[data-mko-clr]');
await p.waitForTimeout(150);
ok(await p.evaluate(() => document.querySelectorAll('[data-mko-sw]').length >= 10 && !!document.querySelector('[data-mko-clr-pick]')),
  'зразки ниток і точний відтінок зʼявились', 'зразків немає');

console.log('═══ 2. БІЛИЙ → ЧОРНИЙ, ЛИШЕ ОБРАНА КАРТИНКА ═══');
await p.click('[data-mko-sw="#111111"]');
await p.waitForTimeout(600);
const ст = await p.evaluate(async () => {
  const im = [...document.querySelectorAll('.mko-wk img')].map(i => i.src);
  return { a: await __pix(im[0]), b: await __pix(im[1]),
           напис: (document.querySelector('[data-mko-clr]') || {}).textContent || '', назад: !!document.querySelector('[data-mko-clr-x]') };
});
console.log('  ' + JSON.stringify(ст));
ok(ст.a.in.slice(0, 3).join() === '17,17,17' && ст.a.in[3] === 255 && ст.a.out[3] === 0,
  'етикетка стала чорною, прозоре поле лишилось прозорим', 'етикетка: ' + JSON.stringify(ст.a));
ok(ст.b.in.slice(0, 3).join() === '255,255,255', 'друга картинка лишилась білою', 'друга: ' + JSON.stringify(ст.b));
ok(/Чорний/.test(ст.напис) && ст.назад, 'на кнопці — «Чорний», є «↩ Повернути колір»', ст.напис);

console.log('═══ 3. ПОВЕРНУТИ Й ЗНОВУ ═══');
await p.click('[data-mko-clr-x]');
await p.waitForTimeout(500);
const back = await p.evaluate(async () => __pix(document.querySelector('.mko-wk img').src));
ok(back.in.slice(0, 3).join() === '255,255,255', '«↩ Повернути колір» — знову білий', JSON.stringify(back));
await p.click('[data-mko-clr]').catch(() => {});
await p.waitForTimeout(100);
if(!await p.$('[data-mko-sw]')){ await p.click('[data-mko-clr]'); await p.waitForTimeout(100); }
await p.click('[data-mko-sw="#c8102e"]');
await p.waitForTimeout(500);

console.log('═══ 4. ЗБЕРЕГТИ — КОЛІР У РОЗМІЩЕННІ ═══');
await p.click('[data-mko-save]');
await p.waitForTimeout(1500);
const res = await p.evaluate(() => window.__res && window.__res.works.map(w => ({ name: w.name, color: w.color || null, data: /^data:/.test(w.url) })));
console.log('  ' + JSON.stringify(res));
ok(res && res.length === 2 && res[0].color && res[0].color.name === 'Червоний' && res[0].data && !res[1].color,
  'у збереженні — перефарбована етикетка з кольором «Червоний», друга без кольору', 'збережено: ' + JSON.stringify(res));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
