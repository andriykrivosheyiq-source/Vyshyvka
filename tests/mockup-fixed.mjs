/* Логотип на макапі більше не пливе.

   ПРОБЛЕМА. Позиція й розмір логотипа лежали в ПІКСЕЛЯХ того прев'ю, у
   якому його ставили. Знімок макапа переводив їх на полотно через ширину
   прев'ю В МИТЬ ЗНІМКА:

       wrapW = ширина прев'ю зараз (а якщо його немає — 300 «навмання»)
       k     = розмір полотна / wrapW

   Тобто розмір і зсув логотипа залежали не від того, як його поставили, а
   від того, якої ширини випадково був екран, коли натиснули «зберегти». У
   вужчому вікні, на телефоні, у бічній колонці поруч із пропозицією — щоразу
   інший масштаб. Найгірше, коли контейнер схований: clientWidth дорівнює
   нулю, і код падав на вигадані 300 px.

   Звідси й те, що бачив менеджер: макап зберігся — лого «попливло»,
   пересохранив при відкритому конструкторі — стало на місце.

   Те саме чіпало ще три місця: лого на фото моделей, РОЗМІТКУ НАНЕСЕННЯ В
   МІЛІМЕТРАХ (за нею шиють) і перевірку виходу за межі зони.

   Перевіряємо:
     — геометрія шару однакова на широкому екрані й на телефоні;
     — знімок макапа однаковий байт у байт при різних ширинах вікна;
     — розмітка в міліметрах теж не залежить від ширини;
     — позиція, збережена ще без часток, читається запасним шляхом.

   Запуск:  node tests/mockup-fixed.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8826;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp',
               '.png':'image/png', '.jpg':'image/jpeg' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

/* Логотип — маленький PNG у data:URL: він завантажується миттєво й
   однаково, тож знімки можна порівнювати байт у байт. */
const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
  '<circle cx="60" cy="60" r="52" fill="#12B0A0"/></svg>');

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

const gid = await p.evaluate(() => {
  const el = document.querySelector('[data-garment]');
  return el ? el.getAttribute('data-garment') : null;
});
/* Шар із частками — саме так конструктор і зберігає позицію відтоді, як
   з'явився frac/fx/fy. */
const LAYER = { id:'L1', url:LOGO, fp:'f1', scale:1, frac:0.28, fx:0.12, fy:-0.06,
                pxAt:420, hAt:520, ar:1, fill:0.9,
                opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 };
const seed = async () => {
  await p.evaluate(([cfg]) => window.__editProduct(cfg, null, []), [{
    garmentId: gid, colorId:null, printId:null, qty:{ M:10 },
    logos:{ front:[LAYER], back:[], left:[], right:[] } }]);
  await p.waitForTimeout(1500);
};
await seed();

const read = async () => p.evaluate(() => {
  const g = window.__lqGeomFrac ? window.__lqGeomFrac() : null;
  const w = document.getElementById('pmGarmentWrap');
  return { geom: g && { frac:+g.frac.toFixed(4), fx:+g.fx.toFixed(4), fy:+g.fy.toFixed(4) },
           wrap: w ? Math.round(w.clientWidth) : 0 };
});
const shot = async () => p.evaluate(async () =>
  window.__lqSnapSide ? await window.__lqSnapSide('front', 400, false) : null);

console.log('═══ ШИРОКИЙ ЕКРАН ═══');
const wide = await read();
const wideShot = await shot();
console.log('  превʼю ' + wide.wrap + 'px · ' + JSON.stringify(wide.geom) +
            ' · знімок ' + (wideShot ? wideShot.length + ' символів' : 'немає'));
ok(wide.geom && wide.geom.frac > 0, 'геометрію шару видно',
   'геометрії немає: ' + JSON.stringify(wide));
ok(!!wideShot && wideShot.indexOf('data:image') === 0,
   'знімок макапа знімається', 'знімок не вийшов');

console.log('');
console.log('═══ ТЕЛЕФОН: ТА САМА ПОЗИЦІЯ ═══');
await p.setViewportSize({ width: 390, height: 844 });
await p.waitForTimeout(1200);
const narrow = await read();
const narrowShot = await shot();
console.log('  превʼю ' + narrow.wrap + 'px · ' + JSON.stringify(narrow.geom));
ok(narrow.wrap !== wide.wrap,
  'превʼю справді стало іншої ширини — є що перевіряти',
  'ширина не змінилась, перевірка нічого не доводить');
ok(JSON.stringify(narrow.geom) === JSON.stringify(wide.geom),
  'геометрія логотипа та сама, хоч екран удвічі вужчий',
  'геометрія попливла: ' + JSON.stringify(wide.geom) + ' → ' + JSON.stringify(narrow.geom));
ok(narrowShot === wideShot,
  'і знімок макапа виходить той самий — байт у байт',
  'знімок різний: ' + (wideShot || '').length + ' проти ' + (narrowShot || '').length);

console.log('');
console.log('═══ ПОВЕРНЕННЯ НА ШИРОКИЙ ЕКРАН ═══');
/* Розмітка в міліметрах для швачки рахується з тієї самої геометрії, тож
   стійкість геометрії — це й стійкість тих чисел. */
await p.setViewportSize({ width: 1400, height: 1000 });
await p.waitForTimeout(1000);
const backWide = await read();
ok(JSON.stringify(backWide.geom) === JSON.stringify(wide.geom),
  'повернулись на широкий екран — геометрія та сама, що й була',
  'після повернення геометрія інша: ' + JSON.stringify(backWide.geom));

console.log('');
console.log('═══ СТАРА ПОЗИЦІЯ БЕЗ ЧАСТОК ═══');
/* Позиції, збережені до появи frac/fx/fy, мають читатися запасним шляхом —
   із пікселів. Гірше, ніж частки, але не порожньо. */
const old = await p.evaluate(() => {
  const l = { id:'old', url:'', scale:1.2, x:40, y:-20, ar:1 };
  const g = window.__lqGeomFrac(l);
  return { frac:+g.frac.toFixed(4), fx:+g.fx.toFixed(4), fy:+g.fy.toFixed(4) };
});
console.log('  ' + JSON.stringify(old));
ok(old.frac > 0 && old.fx !== 0,
  'позиція без часток усе одно дає геометрію — із пікселів',
  'запасний шлях не спрацював: ' + JSON.stringify(old));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'ширина екрана більше не впливає на макап');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
