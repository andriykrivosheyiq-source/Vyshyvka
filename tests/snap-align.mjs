/* Знімок збігається зі сценою: те саме місце, той самий розмір.

   ЩО БУЛО НЕ ТАК. Андрій казав це кілька разів підряд: «поставив логотип
   рівно по центру в збиранні, відкриваю картку — а там він поїхав вправо й
   униз, і розмір інший». Причина не в картці: картка малює знімок як є.
   Причина в самому знімку.

   Геометрія шару зберігається в частках КВАДРАТНОГО КОНТЕЙНЕРА сцени, куди
   фото виробу вписане з полями. А знімок брав ці частки як свої власні —
   так, ніби фото займає весь контейнер. На мокапі фото майже квадратне,
   поля вузькі, розбіжність непомітна. На фото моделі воно високе, поля
   обабіч широкі — і логотип з'їжджав рівно на їхню ширину й дрібнішав на
   стільки ж.

   ЯК ПЕРЕВІРЯЄМО. Ставимо логотип, дивимось, де він на СЦЕНІ — у частках
   самого фото, — і де він на ЗНІМКУ. Числа мають зійтись. І окремо: на
   мокапі й на фото моделі, бо саме між ними розбіжність і жила.

   Запуск:  node tests/snap-align.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8871;
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

/* Логотип із ПРОЗОРИМИ полями. Суцільний прямокутник тут не годиться:
   конструктор прибирає фон, бачить один колір від краю до краю й стирає
   картинку повністю — перевіряти стає нічого. Помаранчева пляма займає
   рівно дві третини ширини файлу, і це співвідношення нам ще знадобиться. */
const W = 120, H = 60, INK_X0 = 20, INK_X1 = 100, INK_FRAC = (INK_X1 - INK_X0) / W;
const LOGO = path.join(ROOT, 'tests', '.tmp-align-logo.png');
(function(){
  const rows = [];
  for(let y = 0; y < H; y++){
    const row = [0];
    for(let x = 0; x < W; x++){
      const inside = x >= INK_X0 && x < INK_X1 && y >= 10 && y < 50;
      row.push(...(inside ? [232, 89, 12, 255] : [0, 0, 0, 0]));
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
  fs.writeFileSync(LOGO, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]));
})();

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1200);
await p.evaluate(() => window.__openProductModal('tee'));
await p.waitForTimeout(800);
await p.setInputFiles('#pmFileInput', LOGO);
await p.waitForTimeout(1800);

/* Де логотип на сцені — у частках самого фото, а не контейнера. Саме це
   бачить менеджер, коли ставить нанесення. */
const наСцені = () => p.evaluate(() => {
  const photo = document.getElementById('pmGarmentPhoto');
  const el = document.querySelector('#pmLogoLayers [data-layer-id]');
  if(!photo || !el) return null;
  /* object-fit:contain — рамка елемента НЕ дорівнює намальованому фото.
     Прямокутник фото рахуємо самі, з природних розмірів. */
  const eb = photo.getBoundingClientRect();
  const ar = photo.naturalWidth / photo.naturalHeight;
  let pw = eb.width, ph = eb.height;
  if(eb.width / eb.height > ar) pw = eb.height * ar; else ph = eb.width / ar;
  const px = eb.left + (eb.width - pw) / 2, py = eb.top + (eb.height - ph) / 2;
  const lb = el.getBoundingClientRect();
  return { u:(lb.left + lb.width / 2 - px) / pw,
           v:(lb.top + lb.height / 2 - py) / ph,
           w: lb.width / pw };
});
/* Де він на знімку — по самих помаранчевих пікселях. */
const наЗнімку = side => p.evaluate(async (side) => {
  const url = await window.__lqSnapSide(side, 800, false);
  const im = new Image();
  await new Promise(r => { im.onload = r; im.src = url; });
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for(let yy = 0; yy < c.height; yy++) for(let xx = 0; xx < c.width; xx++){
    const i = (yy * c.width + xx) * 4;
    if(d[i] > 190 && d[i+1] > 55 && d[i+1] < 130 && d[i+2] < 70){
      if(xx < x0) x0 = xx; if(xx > x1) x1 = xx;
      if(yy < y0) y0 = yy; if(yy > y1) y1 = yy;
    }
  }
  if(x1 < 0) return null;
  return { u:((x0 + x1) / 2) / c.width, v:((y0 + y1) / 2) / c.height,
           w:(x1 - x0 + 1) / c.width };
}, side);

const проба = async (side, підпис) => {
  const s = await наСцені(), z = await наЗнімку(side);
  const f = n => (n * 100).toFixed(1) + '%';
  if(!s || !z){ console.log('   ' + підпис + ': не зміряти'); return null; }
  console.log('   ' + підпис + ': сцена ' + f(s.u) + '/' + f(s.v) +
              ' · знімок ' + f(z.u) + '/' + f(z.v) +
              ' · масштаб ' + (z.w / s.w).toFixed(3));
  return { s, z, dx: Math.abs(s.u - z.u) * 100, dy: Math.abs(s.v - z.v) * 100,
           k: z.w / s.w };
};

console.log('');
console.log('═══ ЗНІМОК ЗБІГАЄТЬСЯ ЗІ СЦЕНОЮ ═══');
const перед = await проба('front', 'мокап спереду');
// на фото моделі: два кроки праворуч
await p.click('#pmArrowRight'); await p.waitForTimeout(400);
await p.click('#pmArrowRight'); await p.waitForTimeout(900);
const модель = await проба('model', 'фото на моделі');

ok(перед && перед.dx < 1 && перед.dy < 1,
  'на мокапі логотип у знімку стоїть там само, де на сцені',
  'мокап розʼїхався: ' + JSON.stringify(перед && { dx:перед.dx, dy:перед.dy }));
/* Головне число цього тесту. Фото моделі високе, і саме тут знімок раніше
   зсував логотип на всю ширину бічних полів. */
ok(модель && модель.dx < 1 && модель.dy < 1,
  'і на фото моделі теж — а це той самий кадр, де він з\'їжджав вправо й униз',
  'фото моделі розʼїхалось: ' + JSON.stringify(модель && { dx:модель.dx, dy:модель.dy }));
/* Масштаб — це відношення «плями на знімку» до «рамки шару на сцені». Воно
   складається з однієї сталої (пляма займає дві третини файлу) і має бути
   ОДНАКОВИМ на обох ракурсах. Розбіжність тут означає, що знімок міняє
   розмір нанесення залежно від пропорції фото, — саме це й було. */
ok(перед && модель && Math.abs(перед.k - модель.k) < 0.02,
  'і розмір однаковий на обох: знімок не роздуває нанесення на високому фото',
  'розмір залежить від пропорції фото: ' +
    (перед && перед.k.toFixed(3)) + ' проти ' + (модель && модель.k.toFixed(3)));
ok(перед && Math.abs(перед.k - INK_FRAC) < 0.03,
  'і він саме такий, як має бути — без запасу «приблизно збіглось»',
  'масштаб не той: ' + (перед && перед.k.toFixed(3)) + ' замість ' + INK_FRAC);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(LOGO); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'що поставили у збиранні, те й на знімку — місце й розмір');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
