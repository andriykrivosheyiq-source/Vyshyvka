/* Узяти шар на виробі — той, у який цілились.

   ЩО БУЛО НЕ ТАК. Шар живе прямокутником: 120×120 на масштаб, далі за
   пропорцією картинки. Слухач кліку висів на всьому прямокутнику, а в
   логотипа непрозорим буває від силу третина: решта — прозорі поля й
   просвіти всередині самого знака. Прямокутники сусідніх шарів
   перекривались, і клік діставався тому, чий опинився зверху, а не тому,
   на що людина дивилась.

   ЯК МАЄ БУТИ. Береться той шар, під яким у цій точці справді щось
   намальовано. Дірка в кільці належить тому, хто лежить під ним. У напису
   рамка навмисно лишається суцільною: між двома літерами порожньо, але
   взяти напис за проміжок людина має право — так у будь-якому редакторі.

   Запуск:  node tests/layer-grab.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8864;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
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

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

const opened = await p.evaluate(async () => {
  if(!window.__openProductModal) return 'конструктор не піднявся';
  window.__openProductModal('tee');
  await new Promise(r => setTimeout(r, 1800));
  const m = document.getElementById('productModal');
  if(!m || !m.classList.contains('open')) return 'модалка товару не відкрилась';
  const tab = document.querySelector('[data-tab="photo"]');
  if(!tab) return 'вкладки дизайну немає';
  tab.click();
  await new Promise(r => setTimeout(r, 1200));
  return '';
});
if(opened){ console.log('  ' + opened); bad++; }

console.log('═══ МАСКА ФОРМИ ЗНІМАЄТЬСЯ З ПІКСЕЛІВ ═══');
/* Спершу переконуємось, що сам рушій віддає форму, а не лише межі: на ній
   тримається все інше в цьому файлі. */
const shape = await p.evaluate(() => new Promise(res => {
  const u = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">' +
    '<rect x="40" y="40" width="120" height="120" fill="#333"/></svg>');
  const im = new Image();
  im.onload = () => {
    try{
      const m = window.LQ.measureShape(im);
      const busy = m && m.mask ? Array.from(m.mask.data).filter(Boolean).length : 0;
      res({ є:!!(m && m.mask), клітинок: m && m.mask ? m.mask.w * m.mask.h : 0, зайнято: busy });
    }catch(e){ res({ помилка:String(e).slice(0, 90) }); }
  };
  im.onerror = () => res({ помилка:'картинка не відкрилась' });
  im.src = u;
}));
console.log('   клітинок ' + shape.клітинок + ', зайнято ' + shape.зайнято);
ok(shape.є, 'рушій віддає маску форми, а не лише прямокутник меж',
  'маски немає: ' + JSON.stringify(shape));
/* Квадрат займає 120×120 із 200×200 — трохи більше третини полотна. Маска
   огрублює в бік «є», тож трохи більше, але не вдвічі. */
ok(shape.зайнято > shape.клітинок * 0.3 && shape.зайнято < shape.клітинок * 0.45,
  'зайнято рівно стільки, скільки займає сам малюнок',
  'маска рахує не те: ' + shape.зайнято + ' із ' + shape.клітинок);

console.log('');
console.log('═══ ДІРКА В КІЛЬЦІ НЕ НАЛЕЖИТЬ КІЛЬЦЮ ═══');
const ring = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
  '<circle cx="200" cy="200" r="180" fill="none" stroke="#E8590C" stroke-width="44"/></svg>');
await p.evaluate(async u => {
  window.LQ_addLogoFromStart({ url:u });
  await new Promise(r => setTimeout(r, 2500));
}, ring);

const at = () => p.evaluate(() => {
  const box = document.querySelector('.pm-draggable-layer');
  if(!box) return null;
  const r = box.getBoundingClientRect();
  return { x:r.left, y:r.top, cx:r.left + r.width / 2, cy:r.top + r.height / 2, h:r.height };
});
async function drag(from, dx, dy){
  await p.mouse.move(from.cx, from.cy);
  await p.mouse.down();
  await p.waitForTimeout(120);
  await p.mouse.move(from.cx + dx, from.cy + dy, { steps:12 });
  await p.waitForTimeout(120);
  await p.mouse.up();
  await p.waitForTimeout(500);
}
const start = await at();
if(!start){ console.log('  логотип не став на виріб'); bad++; }
else {
  await drag(start, 60, 60);                       // просто в дірку кільця
  const afterHole = await at();
  const moveHole = Math.round(Math.abs(afterHole.x - start.x) + Math.abs(afterHole.y - start.y));
  const band = await at();
  await drag({ cx:band.cx, cy:band.cy - band.h * 0.44 }, 60, 60);   // по самому обручу
  const afterBand = await at();
  const moveBand = Math.round(Math.abs(afterBand.x - afterHole.x) + Math.abs(afterBand.y - afterHole.y));
  console.log('   зсув із дірки: ' + moveHole + ' px · зсув з обруча: ' + moveBand + ' px');
  ok(moveHole === 0,
    'у просвіті кільця братись нема за що — там порожньо, і клік туди нічий',
    'дірка всередині знака досі тягне сам знак (' + moveHole + ' px)');
  ok(moveBand > 20,
    'а за сам обруч логотип береться й переноситься',
    'логотип не взявся за власний малюнок (' + moveBand + ' px)');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'шар береться за те, що на ньому намальовано');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
