/* ФОН ПРИБИРАЄ ЛИШЕ PHOTOROOM (25.10).

   Андрій: «везде фоторум, щоб у нас не було внутрішнього, бо він погано
   працює… якщо не відповідає, то щоб писало, що неоплачений токен».
   1. Сайт (клієнт): лого на білому — PhotoRoom; уже прозоре — без виклику.
   2. PhotoRoom відмовив (402) — фон не прибрано, причина словами.
   3. КП (менеджер): вікно — лише «Прибрати фон» і «Не прибирати».
   4. «Прибрати фон» — один виклик PhotoRoom, лого на виробі.
   5. 402 у вікні — червоним «закінчились кредити (не оплачено)… Скажіть
      власнику», кнопки живі; «Не прибирати» — лого як є.
   6. Перемикач фону на лого без прибраного фону — PhotoRoom; відмова —
      словами; кнопки «2» більше немає.
   7. Нейромережі (loomiq-bg.js) на сторінці немає взагалі.

   Запуск:  node tests/bg-photoroom.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fs_exists_bg = fs.existsSync(path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), 'loomiq-bg.js'));
const PORT = 8894;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
let bgJsAsked = 0;
const srv = createServer(async (req, res) => {
  if(/loomiq-bg\.js/.test(req.url)) bgJsAsked++;
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

/* PNG без бібліотек: opaque — помаранчева пляма на БІЛОМУ (фон є, PhotoRoom
   потрібен); clear — та сама пляма на прозорому (прибирати нема чого). */
function png(file, opaque){
  const W = 120, H = 60, rows = [];
  for(let y = 0; y < H; y++){
    const row = [0];
    for(let x = 0; x < W; x++){
      const inside = x >= 20 && x < 100 && y >= 10 && y < 50;
      row.push(...(inside ? [232, 89, 12, 255] : (opaque ? [255, 255, 255, 255] : [0, 0, 0, 0])));
    }
    rows.push(Buffer.from(row));
  }
  const chunk = (t, d) => {
    const body = Buffer.concat([Buffer.from(t), d]);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]));
  return file;
}
const WHITE = png(path.join(ROOT, 'tests', '.tmp-bg-white.png'), true);
const CLEAR = png(path.join(ROOT, 'tests', '.tmp-bg-clear.png'), false);

const b = await chromium.launch();
const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
const alerts = [];
p.on('dialog', d => { alerts.push(d.message()); d.dismiss(); });
let викликів = 0, відповідь = 'ok';
await p.route('https://bg.test/**', async r => {
  викликів++;
  if(відповідь === '402') return r.fulfill({ status: 402, contentType:'application/json', body:'{"error":"credits"}' });
  r.fulfill({ contentType:'image/png', body: fs.readFileSync(CLEAR) });
});
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1200);
await p.evaluate(() => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.bgApi = Object.assign({}, window.SITE_CONTENT.bgApi, { proxyUrl:'https://bg.test/x' });
});
await p.evaluate(async () => { await window.__openProductModal('tee'); await new Promise(r => setTimeout(r, 600)); });
const asData = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

console.log('═══ 1. САЙТ: ЛОГО НА БІЛОМУ — PHOTOROOM; ПРОЗОРЕ — БЕЗ ВИКЛИКУ ═══');
викликів = 0;
let r = await p.evaluate(async d => { const o = await window.LQ_removeBg(d); return /^data:image\//.test(o); }, asData(WHITE));
ok(r && викликів === 1, 'лого на білому тлі — один виклик PhotoRoom (простого алгоритму більше немає)', 'викликів ' + викликів + ', результат ' + r);
викликів = 0;
r = await p.evaluate(async d => (await window.LQ_removeBg(d)) === d, asData(CLEAR));
ok(r && викликів === 0, 'уже прозоре лого — PhotoRoom не кличемо (кредити)', 'викликів ' + викликів);

console.log('═══ 2. PHOTOROOM ВІДМОВИВ (402) — ПРИЧИНА СЛОВАМИ ═══');
відповідь = '402';
r = await p.evaluate(async d => { try{ await window.LQ_removeBg(d); return 'прибрало'; }catch(e){ return window.__lqBgWhy(e); } }, asData(WHITE));
console.log('  ' + r);
ok(/закінчились кредити \(не оплачено\)/.test(r) && /фон не прибрано/.test(r), 'фон не прибрано; сказано: «закінчились кредити (не оплачено)»', r);
/* Клієнт на сайті: лого лягає як є, про кредити йому не кажемо. */
const шарів = () => p.evaluate(() => document.querySelectorAll('#pmTabPanel [data-bgtoggle]').length);
const к0 = await шарів(), a0 = alerts.length;
await p.setInputFiles('#pmFileInput', WHITE);
await p.waitForTimeout(1500);
ok((await шарів()) === к0 + 1 && alerts.length === a0, 'клієнт: лого лягло як є, вікон про кредити немає', 'шарів ' + к0 + '→' + (await шарів()) + ', вікон ' + (alerts.length - a0));
відповідь = 'ok';

console.log('═══ 3–4. КП: ДВІ КНОПКИ, «ПРИБРАТИ ФОН» — PHOTOROOM ═══');
await p.evaluate(() => { window.__lqInline = true; });
const ш0 = await шарів();
викликів = 0;
await p.setInputFiles('#pmFileInput', WHITE);
await p.waitForTimeout(500);
const вікно = await p.evaluate(() => {
  const d = document.getElementById('pmBgAsk');
  return d ? { к: [...d.querySelectorAll('[data-bg]')].map(b => b.dataset.bg).join(), т: d.textContent.replace(/\s+/g, ' ') } : null;
});
console.log('  ' + JSON.stringify(вікно));
ok(вікно && вікно.к === 'x,pro,no' && !/Внутрішній|Простий/.test(вікно.т) && (await шарів()) === ш0,
  'вікно: лише «Прибрати фон · PhotoRoom» і «Не прибирати», фото ще не на виробі', JSON.stringify(вікно));
await p.click('#pmBgAsk [data-bg="pro"]');
await p.waitForTimeout(1500);
ok(!(await p.evaluate(() => !!document.getElementById('pmBgAsk'))) && викликів === 1 && (await шарів()) === ш0 + 1,
  '«Прибрати фон» — один виклик PhotoRoom, лого на виробі', 'викликів ' + викликів + ', шарів ' + (await шарів()));

console.log('═══ 5. КП: 402 У ВІКНІ — СЛОВАМИ, КНОПКИ ЖИВІ ═══');
відповідь = '402'; викликів = 0;
await p.setInputFiles('#pmFileInput', WHITE);
await p.waitForTimeout(400);
await p.click('#pmBgAsk [data-bg="pro"]');
await p.waitForTimeout(1200);
const відм = await p.evaluate(() => { const d = document.getElementById('pmBgAsk'); if(!d) return null;
  const n = d.querySelector('.pm-bgask-n');
  return { є: true, err: n.classList.contains('is-err'), txt: n.textContent, живі: [...d.querySelectorAll('[data-bg="pro"],[data-bg="no"]')].every(b => !b.disabled) }; });
console.log('  ' + JSON.stringify(відм));
ok(відм && відм.err && /закінчились кредити \(не оплачено\)/.test(відм.txt) && /Скажіть власнику/.test(відм.txt) && відм.живі && (await шарів()) === ш0 + 1,
  'вікно лишилось: червоним «закінчились кредити (не оплачено)… Скажіть власнику», кнопки живі, лого не додано', JSON.stringify(відм));
await p.click('#pmBgAsk [data-bg="no"]');
await p.waitForTimeout(800);
ok(викликів === 1 && (await шарів()) === ш0 + 2, '«Не прибирати» — лого як є, без нових викликів', 'викликів ' + викликів + ', шарів ' + (await шарів()));

console.log('═══ 6. ПЕРЕМИКАЧ ФОНУ НА ЛОГО БЕЗ ПРИБРАНОГО ФОНУ ═══');
const a1 = alerts.length;
await p.evaluate(() => { const l = [...document.querySelectorAll('#pmTabPanel [data-bgtoggle]')]; l[l.length - 1].click(); });
await p.waitForTimeout(1200);
const сказано = alerts.slice(a1).join(' | ');
ok(викликів === 2 && /закінчились кредити \(не оплачено\)/.test(сказано), 'відмова на перемикачі — теж словами: ' + сказано.slice(0, 90), 'викликів ' + викликів + ', вікна: ' + сказано);
відповідь = 'ok';
await p.evaluate(() => { const l = [...document.querySelectorAll('#pmTabPanel [data-bgtoggle]')]; l[l.length - 1].click(); });
await p.waitForTimeout(1500);
const on = await p.evaluate(() => { const l = [...document.querySelectorAll('#pmTabPanel [data-bgtoggle]')]; return l[l.length - 1].classList.contains('on'); });
ok(викликів === 3 && on, 'PhotoRoom відповів — фон прибрано, перемикач увімкнений', 'викликів ' + викликів + ', on ' + on);
const два = await p.evaluate(() => document.querySelectorAll('[data-bgpro]').length);
ok(два === 0, 'окремої кнопки «2» немає — прибирає лише PhotoRoom', 'кнопок «2»: ' + два);
await p.evaluate(() => { window.__lqInline = false; });

console.log('═══ 7. НЕЙРОМЕРЕЖІ НЕМАЄ ═══');
const модель = await p.evaluate(() => !!window.LQBg);
ok(!модель && bgJsAsked === 0 && !fs_exists_bg, 'loomiq-bg.js не вантажиться й не лежить у репозиторії, LQBg немає', 'LQBg ' + модель + ', запитів ' + bgJsAsked);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(WHITE); fs.unlinkSync(CLEAR); }catch(e){}
await b.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'фон прибирає лише PhotoRoom');
process.exit(bad ? 1 : 0);
