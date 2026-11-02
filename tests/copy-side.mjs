/* КП: ТОЙ САМИЙ ДИЗАЙН НА ІНШИЙ БІК ОДНІЄЮ КНОПКОЮ (02.11).
   Вікторія: «як однаковий дизайн продублювати на спині в мобільній версії?
   чи другий раз витягувати через ШІ?». Доти мініатюра з іншого боку лише
   перемикала на нього, «Дублювати» клало копію на той самий бік.
   1. На переді в діях шару є «⇄ На спину»: копія (той самий файл, колір
      нитки, прибраний фон, відбиток) лягає в центр зони спини, розмір той
      самий, людина бачить спину; там кнопка каже «На перед».
   2. Ціна рахує друге нанесення; відбиток дизайну той самий.
   3. Телефон (390 px): кнопка є в тому ж ряду.
   Запуск:  node tests/copy-side.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9068;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const open = async (mobile) => {
  const ctx = await browser.newContext(mobile ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true } : { viewport:{ width:1300, height:1000 } });
  const C = await ctx.newPage();
  C.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  await C.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({ contentType:'application/json', body:'{"fields":{}}' });
    return r.abort();
  });
  await C.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
  await C.waitForTimeout(4500);
  await C.evaluate(() => { window.__lqInline = true; window.toast = () => {}; });
  const gid = await C.evaluate(() => { const el = document.querySelector('[data-garment]'); return el ? el.getAttribute('data-garment') : null; });
  const LOGO = await C.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d');
    x.fillStyle = '#c8102e'; x.beginPath(); x.arc(90, 110, 60, 0, Math.PI * 2); x.fill(); x.fillStyle = '#0b3d91'; x.fillRect(170, 50, 110, 120); return c.toDataURL('image/png'); });
  const lay = { id: 1, scale: 1, frac: 0.25, fx: 0.3, fy: 0.25, ar: 320 / 240, fill: 0.7, opaqueBox: { x0:0, y0:0, x1:1, y1:1 }, w: 60, h: 45,
    url: LOGO, cleanUrl: LOGO, origUrl: LOGO, removeBg: true, fp: 'fp-test-1', recolorMap: [{ from:'#c8102e', to:'#111111' }], recolorFrom: LOGO };
  await C.evaluate((cfg) => { window.__lqEditOnly = null; window.__editProduct(cfg, null, []); },
    { garmentId: gid, colorId: null, printId: null, qty: { M: 2 }, logos: { front: [lay], back: [], left: [], right: [] } });
  await C.waitForTimeout(1200);
  await C.evaluate(() => { const t = document.querySelector('#pmTabs .pm-tab[data-tab="design"]'); if(t) t.click(); });
  await C.waitForTimeout(500);
  return { C, gid };
};
const state = (C) => C.evaluate(() => ({ n: window.__lqLayerCount(), info: window.__lqLayerInfo(), geom: window.__lqGeomFrac(),
  btn: [...document.querySelectorAll('[data-copyto]')].map(b => b.textContent.trim() + '→' + b.dataset.side), lines: window.__lqCalcLines().map(l => (l.label || l.name || JSON.stringify(l)).slice(0, 40)) }));

console.log('═══ 1. «НА СПИНУ» — КОПІЯ НА СПИНІ, ЛЮДИНА БАЧИТЬ СПИНУ ═══');
const { C, gid } = await open(false);
ok(!!gid, 'конструктор КП відкрито, виріб ' + gid, 'виробу немає');
const s0 = await state(C);
ok(s0.n === 1 && s0.btn.join() === '⇄ На спину→back', 'на переді один шар, у діях «⇄ На спину»', JSON.stringify({ n: s0.n, btn: s0.btn }));
await C.evaluate(() => document.querySelector('[data-copyto]').click());
await C.waitForTimeout(900);
const s1 = await state(C);
console.log('  ' + JSON.stringify({ n: s1.n, btn: s1.btn, geom: s1.geom, lines: s1.lines }));
ok(s1.n === 2 && s1.btn.join() === '⇄ На перед→front', 'шарів два, показано спину (кнопка тепер «На перед»)', JSON.stringify({ n: s1.n, btn: s1.btn }));
ok(s1.info && s1.info.id !== s0.info.id && s1.info.url === s0.info.url && s1.info.fp === s0.info.fp && JSON.stringify(s1.info.recolorMap) === JSON.stringify(s0.info.recolorMap) && s1.info.recolored,
  'копія активна: той самий файл, відбиток і заміна кольору нитки', JSON.stringify({ was: s0.info, now: s1.info }));
ok(s1.geom && Math.abs(s1.geom.frac - s0.geom.frac) < 0.001 && Math.abs(s1.geom.fx) < 0.3 && Math.abs(s1.geom.fy) < 0.3,
  'розмір той самий, лежить біля центру зони спини', JSON.stringify({ was: s0.geom, now: s1.geom }));

console.log('═══ 2. ЦІНА — ДРУГЕ НАНЕСЕННЯ ═══');
ok(s1.lines.length === s0.lines.length + 1, 'у прорахунку на один рядок нанесення більше (' + s0.lines.length + ' → ' + s1.lines.length + ')', 'рядки: ' + JSON.stringify({ was: s0.lines, now: s1.lines }));
/* назад на перед — копія вже там є, тож зʼявиться другий знак на переді (як «Дублювати») */
await C.evaluate(() => document.querySelector('[data-copyto]').click());
await C.waitForTimeout(700);
const s2 = await state(C);
ok(s2.n === 3 && s2.btn.join() === '⇄ На спину→back', '«На перед» зі спини — третій шар на переді, показано перед', JSON.stringify({ n: s2.n, btn: s2.btn }));

console.log('═══ 3. ТЕЛЕФОН ═══');
const m = await open(true);
const sm = await state(m.C);
const vis = await m.C.evaluate(() => { const b = document.querySelector('[data-copyto]'); if(!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), inPage: r.right <= window.innerWidth + 1 }; });
ok(sm.btn.join() === '⇄ На спину→back' && vis && vis.w > 40 && vis.inPage, 'на телефоні кнопка «На спину» є і в екрані', JSON.stringify({ btn: sm.btn, vis }));
await m.C.evaluate(() => document.querySelector('[data-copyto]').click());
await m.C.waitForTimeout(900);
const sm1 = await state(m.C);
ok(sm1.n === 2 && sm1.btn.join() === '⇄ На перед→front', 'з телефона копія на спині, показано спину', JSON.stringify({ n: sm1.n, btn: sm1.btn }));

ok(errs.length === 0, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ copy-side: усі перевірки пройшли');
process.exit(bad ? 1 : 0);
