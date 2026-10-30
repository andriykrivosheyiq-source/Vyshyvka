/* КП: КОЛІР НИТКИ — УВЕСЬ ЛОГОТИП АБО ЛИШЕ ОДИН КОЛІР (30.10).
   Андрій: «зміна нитки — це один колір на все, а я хочу мати можливість на
   часткову зміну». У панелі «🎨 Колір нитки» два режими: «Увесь логотип
   одним кольором» (як було) і «Лише один колір»: кольори самого логотипа
   рядком, обираєш який і на що — решта лишається. Кілька замін, усі від
   оригіналу; «↩ Повернути колір» знімає все; відбиток дизайну той самий.
   Запуск:  node tests/recolor-part.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9067;
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
const C = await browser.newPage({ viewport:{ width:1300, height:1000 } });
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
ok(!!gid, 'конструктор КП відкрито, є виріб ' + gid, 'виробу немає');

/* Логотип із трьох кольорів на прозорому: червоне коло, синій прямокутник, жовта смуга. */
const LOGO = await C.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d');
  x.fillStyle = '#c8102e'; x.beginPath(); x.arc(90, 110, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#0b3d91'; x.fillRect(170, 50, 110, 120);
  x.fillStyle = '#ffd400'; x.fillRect(40, 200, 240, 22);
  return c.toDataURL('image/png');
});
const lay = (id, extra) => Object.assign({ id, scale:1, frac:0.25, fx:0.3, fy:0.25, ar:320/240, fill:0.7,
  opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:45 }, extra);
await C.evaluate((cfg) => { window.__lqEditOnly = null; window.__editProduct(cfg, null, []); },
  { garmentId: gid, colorId: null, printId: null, qty: { M: 2 }, logos: { front: [lay(1, { url: LOGO, cleanUrl: LOGO, origUrl: LOGO })], back: [], left: [], right: [] } });
await C.waitForTimeout(1200);
await C.evaluate(() => { const t = document.querySelector('#pmTabs .pm-tab[data-tab="design"]'); if(t) t.click(); });
await C.waitForTimeout(500);
const px = async (url, x, y) => C.evaluate(([u, x, y]) => new Promise(r => { const i = new Image(); i.onload = () => {
  const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
  const d = g.getImageData(x, y, 1, 1).data; r('#' + [...d].slice(0, 3).map(v => ('0' + v.toString(16)).slice(-2)).join('') + (d[3] ? '' : ' прозоре')); };
  i.onerror = () => r(null); i.src = u; }), [url, x, y]);
const info = () => C.evaluate(() => window.__lqLayerInfo());

console.log('═══ 1. КОЛЬОРИ ЛОГОТИПА В ПАНЕЛІ ═══');
await C.evaluate(() => { const b = document.querySelector('[data-recolor]'); if(b) b.click(); });
await C.waitForTimeout(300);
const режими = await C.evaluate(() => [...document.querySelectorAll('[data-rc-mode]')].map(b => b.dataset.rcMode + (b.classList.contains('on') ? '*' : '')));
ok(режими.join() === 'all*,part', 'у панелі «Колір нитки» два режими, типово «увесь логотип»: ' + режими.join(', '), 'режими: ' + режими.join(', '));
await C.evaluate(() => document.querySelector('[data-rc-mode="part"]').click());
await C.waitForSelector('[data-rc-src]', { timeout: 8000 });
const кольори = await C.evaluate(() => [...document.querySelectorAll('[data-rc-src]')].map(b => b.dataset.rcSrc));
console.log('  ' + JSON.stringify(кольори));
ok(кольори.length === 3 && ['#c8102e', '#0b3d91', '#ffd400'].every(h => кольори.some(c => Math.abs(parseInt(c.slice(1), 16) - parseInt(h.slice(1), 16)) < 0x101010)),
  'знайдено рівно три кольори логотипа (червоний, синій, жовтий), прозоре не рахується', JSON.stringify(кольори));
const безДжерела = await C.evaluate(() => ({ зразки: document.querySelectorAll('[data-sw]').length, напис: (document.querySelector('.pm-mgr-recolor .pm-ts-warn') || {}).textContent || '' }));
ok(безДжерела.зразки === 0 && /Оберіть колір логотипа/.test(безДжерела.напис), 'поки колір не обрано — зразків «на який» немає, є підказка', JSON.stringify(безДжерела));

console.log('═══ 2. ЧЕРВОНЕ → ЗЕЛЕНЕ, РЕШТА ЯК Є ═══');
const червоний = кольори.find(c => parseInt(c.slice(1, 3), 16) > 150);
await C.evaluate(h => document.querySelector('[data-rc-src="' + h + '"]').click(), червоний);
await C.waitForTimeout(300);
await C.evaluate(() => document.querySelector('[data-sw="#1b7a43"]').click());
await C.waitForTimeout(1500);
const i1 = await info();
const p1 = { коло: await px(i1.url, 90, 110), прямокутник: await px(i1.url, 225, 110), смуга: await px(i1.url, 160, 211), поза: await px(i1.url, 5, 5) };
console.log('  ' + JSON.stringify({ map: i1.recolorMap, p1 }));
ok(p1.коло === '#1b7a43' && p1.прямокутник === '#0b3d91' && p1.смуга === '#ffd400' && /прозоре/.test(p1.поза),
  'червоне коло стало зеленим, синій і жовтий лишились, прозоре прозоре', JSON.stringify(p1));
ok(i1.recolored && !i1.recolorTo && i1.recolorMap && i1.recolorMap.length === 1 && i1.recolorMap[0].to === '#1b7a43',
  'на шарі карта замін з одним записом, «увесь одним» не стоїть', JSON.stringify({ map: i1.recolorMap, to: i1.recolorTo }));
const позначка = await C.evaluate(() => [...document.querySelectorAll('[data-rc-src]')].map(b => b.textContent.trim()).join(''));
ok(позначка === '✓', 'замінений колір у рядку логотипа позначено галочкою', 'позначки: ' + позначка);

console.log('═══ 3. ДРУГА ЗАМІНА ДОДАЄТЬСЯ, ВІДБИТОК ТОЙ САМИЙ, ПОВЕРНЕННЯ ЗНІМАЄ ВСЕ ═══');
const fp0 = i1.fp;
const синій = кольори.find(c => parseInt(c.slice(5, 7), 16) > 100 && parseInt(c.slice(1, 3), 16) < 60);
await C.evaluate(h => document.querySelector('[data-rc-src="' + h + '"]').click(), синій);
await C.waitForTimeout(300);
await C.evaluate(() => document.querySelector('[data-sw="#ffffff"]').click());
await C.waitForTimeout(1500);
const i2 = await info();
const p2 = { коло: await px(i2.url, 90, 110), прямокутник: await px(i2.url, 225, 110), смуга: await px(i2.url, 160, 211) };
console.log('  ' + JSON.stringify({ map: i2.recolorMap, p2, fp: i2.fp === fp0 }));
ok(p2.коло === '#1b7a43' && p2.прямокутник === '#ffffff' && p2.смуга === '#ffd400' && i2.recolorMap.length === 2,
  'друга заміна (синій → білий) додалась до першої, жовтий як був', JSON.stringify(p2));
ok(i2.fp === fp0 && !!fp0, 'відбиток дизайну не змінився — для рахунку це той самий ескіз', JSON.stringify({ fp0, fp: i2.fp }));
await C.evaluate(() => document.querySelector('[data-recolor-reset]').click());
await C.waitForTimeout(800);
const i3 = await info();
ok(i3.url === LOGO && !i3.recolored && !i3.recolorMap, '«↩ Повернути колір» — оригінал, карти замін немає', JSON.stringify({ same: i3.url === LOGO, map: i3.recolorMap }));

console.log('═══ 4. «УВЕСЬ ЛОГОТИП ОДНИМ» ПРАЦЮЄ, ЯК І БУЛО ═══');
await C.evaluate(() => { const b = document.querySelector('[data-recolor]'); if(b && !document.querySelector('.pm-mgr-recolor')) b.click(); });
await C.waitForTimeout(300);
await C.evaluate(() => document.querySelector('[data-rc-mode="all"]').click());
await C.waitForTimeout(300);
await C.evaluate(() => document.querySelector('[data-sw="#111111"]').click());
await C.waitForTimeout(1500);
const i4 = await info();
const p4 = { коло: await px(i4.url, 90, 110), прямокутник: await px(i4.url, 225, 110), смуга: await px(i4.url, 160, 211) };
ok(p4.коло === '#111111' && p4.прямокутник === '#111111' && p4.смуга === '#111111' && i4.recolorTo === '#111111' && !i4.recolorMap,
  'увесь логотип чорним, карти часткових замін немає', JSON.stringify({ p4, to: i4.recolorTo, map: i4.recolorMap }));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
if(bad){ console.log('\n✗ не пройшло: ' + bad); process.exit(1); }
console.log('\n✓ колір нитки: увесь або лише один');
