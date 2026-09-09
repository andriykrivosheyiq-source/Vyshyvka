/* Макет качається з самої картинки — і порожній, і з логотипом.

   НАВІЩО. Кнопка «Скачати макап» лежала внизу правої колонки, під ціною, і
   її там не бачили. А ще вона віддавала лише один варіант — з нанесенням.
   Коли на виробництво чи клієнтові треба показати сам виріб без друку,
   макет доводилось робити руками: зняти логотип, зберегти, повернути назад.

   Тепер значок скачування стоїть у правому верхньому куті самої сцени й дає
   на вибір два файли. Пустий макет робить та сама функція, що й повний, —
   просто без шарів логотипа. Саме тому виріб на обох файлах стоїть однаково
   й вони лягають поруч.

   Перевіряємо:
     — значок є в куті картинки й саме в правому верхньому;
     — на сайті клієнт його не бачить;
     — меню відкривається, дає два пункти й закривається кліком повз нього;
     — «пустий» знімок відрізняється від повного — логотипа на ньому справді
       немає;
     — і збігається зі знімком виробу, з якого логотип прибрали зовсім, —
       тобто це той самий виріб, а не інша картинка;
     — імена файлів різні, щоб два макети не затирали один одного.

   Запуск:  node tests/mock-download.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8839;
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

const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
  '<circle cx="60" cy="60" r="52" fill="#12B0A0"/></svg>');
const LAYER = { id:'L1', url:LOGO, fp:'f1', scale:1, frac:0.34, fx:0, fy:-0.04,
                pxAt:420, hAt:520, ar:1, fill:0.9,
                opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 };

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
const seed = async layers => {
  await p.evaluate(([cfg]) => window.__editProduct(cfg, null, []), [{
    garmentId: gid, colorId:null, printId:null, qty:{ M:10 },
    logos:{ front: layers, back:[], left:[], right:[] } }]);
  await p.waitForTimeout(1500);
};
await seed([LAYER]);

console.log('═══ ЗНАЧОК СТОЇТЬ НА КАРТИНЦІ ═══');
const place = await p.evaluate(() => {
  const box = document.getElementById('pmDl');
  const stage = document.getElementById('pmStage');
  if(!box || !stage) return { err:'значка або сцени немає' };
  const b = box.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { hidden: box.hidden, vis: getComputedStyle(box).display !== 'none',
           fromRight: Math.round(s.right - b.right), fromTop: Math.round(b.top - s.top),
           inside: b.left > s.left && b.right <= s.right + 1 };
});
if(place.err){ console.log('  ' + place.err); bad++; }
else {
  console.log('  від правого краю сцени ' + place.fromRight + 'px, від верхнього ' + place.fromTop + 'px');
  ok(!place.hidden && place.vis, 'менеджер бачить значок скачування', 'значка не видно');
  ok(place.inside && place.fromRight < 40 && place.fromTop < 40,
    'значок саме в правому верхньому куті картинки',
    'значок не в куті: ' + place.fromRight + 'px справа, ' + place.fromTop + 'px згори');
}

console.log('');
console.log('═══ МЕНЮ: ДВА ВАРІАНТИ ═══');
await p.click('#pmDlBtn');
await p.waitForTimeout(200);
const menu = await p.evaluate(() => {
  const box = document.getElementById('pmDl');
  const m = document.getElementById('pmDlMenu');
  return { open: box.classList.contains('open'),
           shown: getComputedStyle(m).display !== 'none',
           opts: [...m.querySelectorAll('[data-dl]')].map(b => ({
             k: b.getAttribute('data-dl'), t: b.textContent.trim() })) };
});
console.log('  ' + menu.opts.map(o => o.k + ' → «' + o.t + '»').join(' · '));
ok(menu.open && menu.shown, 'меню відкрилось', 'меню не відкрилось');
ok(menu.opts.length === 2 && menu.opts.some(o => o.k === 'full') && menu.opts.some(o => o.k === 'bare'),
  'у меню рівно два варіанти: з логотипом і пустий',
  'варіанти не ті: ' + JSON.stringify(menu.opts));

await p.mouse.click(700, 900);
await p.waitForTimeout(200);
ok(!(await p.evaluate(() => document.getElementById('pmDl').classList.contains('open'))),
  'клік повз меню його закриває', 'меню лишилось відкритим');

console.log('');
console.log('═══ ПУСТИЙ МАКЕТ — ТОЙ САМИЙ ВИРІБ БЕЗ ДРУКУ ═══');
const shots = await p.evaluate(async () => ({
  full: await window.__lqSnapSide('front', 400, false, false),
  bare: await window.__lqSnapSide('front', 400, false, true) }));
ok(!!shots.full && !!shots.bare && shots.bare.indexOf('data:image') === 0,
  'обидва знімки знімаються', 'знімок не вийшов');
ok(shots.full !== shots.bare,
  'пустий макет відрізняється від повного — логотипа на ньому немає',
  'обидва файли однакові: логотип не прибрався');

/* Головна перевірка: «пустий» має збігатися зі знімком виробу, з якого
   логотип прибрали по-справжньому. Інакше це була б просто інша картинка. */
await seed([]);
const clean = await p.evaluate(async () => window.__lqSnapSide('front', 400, false, false));
ok(clean === shots.bare,
  'пустий макет байт у байт збігається з виробом без логотипа',
  'пустий макет не такий, як виріб без логотипа: ' +
    (clean || '').length + ' проти ' + (shots.bare || '').length + ' символів');
await seed([LAYER]);

console.log('');
console.log('═══ ІМЕНА ФАЙЛІВ ═══');
/* Клік по пункту меню має завершитись збереженням файла. Саме завантаження
   в перевірці не потрібне — важливо, з яким іменем його віддають. */
await p.evaluate(() => {
  window.__dl = [];
  const real = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if(this.download){ window.__dl.push({ name:this.download, kind:String(this.href).slice(0, 15) }); return; }
    return real.apply(this, arguments);
  };
});
for(const k of ['full', 'bare']){
  await p.click('#pmDlBtn');
  await p.waitForTimeout(150);
  await p.click('[data-dl="' + k + '"]');
  await p.waitForTimeout(1800);
}
const dl = await p.evaluate(() => window.__dl);
dl.forEach(d => console.log('  ' + d.name + '  (' + d.kind + '…)'));
ok(dl.length === 2, 'обидва пункти віддали файл', 'файлів ' + dl.length + ' замість двох');
ok(dl.every(d => d.kind.indexOf('data:image/png') === 0),
  'віддається саме картинка PNG', 'віддали не картинку: ' + JSON.stringify(dl));
ok(dl.length === 2 && dl[0].name !== dl[1].name && /-blank\.png$/.test(dl[1].name),
  'імена різні, у пустого — позначка blank, файли не затруть один одного',
  'імена не розрізняються: ' + dl.map(d => d.name).join(' / '));

console.log('');
console.log('═══ КЛІЄНТ НА САЙТІ ЗНАЧКА НЕ БАЧИТЬ ═══');
const c = await browser.newPage({ viewport:{ width:1400, height:1000 } });
c.on('pageerror', e => errs.push('PAGEERROR(сайт): ' + e.message.slice(0, 170)));
await c.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await c.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await c.waitForTimeout(5000);
const asClient = await c.evaluate(() => {
  const box = document.getElementById('pmDl');
  return box ? { hidden: box.hidden, vis: getComputedStyle(box).display !== 'none' } : null;
});
console.log('  ' + JSON.stringify(asClient));
ok(asClient && asClient.hidden && !asClient.vis,
  'на сайті значка скачування немає — це інструмент менеджера',
  'клієнт бачить значок: ' + JSON.stringify(asClient));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'макет качається просто з картинки — і повний, і пустий');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
