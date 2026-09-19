/* Ракурс «На моделі» живе у ЗБИРАННІ, а не в картці.

   ЩО БУЛО НЕ ТАК. Логотип на фото моделі ставила сама картка — за якорем
   із каталогу: «груди» на такому виробі взагалі, а не на цьому знімку.
   Виходило мимо: Андрій бачив, що майже на кожному кадрі нанесення з'їхало
   вправо й униз. Полагодити це в картці було нічим — правильного місця
   вона просто не знала, тож поруч зробили ще й редактор, яким людина
   руками виправляла вигадане машиною.

   ЯК МАЄ БУТИ. Одне джерело правди — конструктор. Там менеджер вибирає
   товар і ставить нанесення на перед, на спину і на модель; там же кладе
   його по формі тіла. Картка показує готовий знімок і нічого не рухає.

   Перевіряємо:
     — «На моделі» стоїть у перемикачі ракурсів, зі своїм фото;
     — логотип із переду переїжджає туди сам, на груди — не з нуля;
     — ціна від цього НЕ росте: вітрина — це не друге нанесення;
     — нахил по перспективі є саме тут: кути, перетворення, скидання.

   Запуск:  node tests/model-view.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8869;
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

/* Логотип для завантаження. Робимо файл на місці, щоб тест не залежав від
   картинок у репозиторії: вони змінюються з іншого приводу. */
const LOGO = path.join(ROOT, 'tests', '.tmp-logo.png');
(function(){
  const w = 120, h = 60, px = [232, 89, 12, 255];
  const raw = Buffer.concat(Array.from({ length: h }, () =>
    Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: w }, () => Buffer.from(px)))])));
  const chunk = (t, d) => {
    const body = Buffer.concat([Buffer.from(t), d]);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  function crc32(buf){
    let c = ~0;
    for(const b of buf){
      c ^= b;
      for(let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (~c) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(LOGO, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]));
})();

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1200);
await p.evaluate(() => window.__openProductModal('tee'));
await p.waitForTimeout(800);

console.log('');
console.log('═══ РАКУРС «НА МОДЕЛІ» У ЗБИРАННІ ═══');
await p.setInputFiles('#pmFileInput', LOGO);
await p.waitForTimeout(1800);

const state = () => p.evaluate(() => ({
  бік:   (document.getElementById('pmSideMarkName') || {}).textContent || '',
  шарів: document.querySelectorAll('#pmLogoLayers [data-layer-id]').length,
  сума:  (document.getElementById('pmAddBtnSum') || {}).textContent || '',
  фото:  ((document.getElementById('pmGarmentPhoto') || {}).currentSrc || '').split('/').pop()
}));
const крок = async () => { await p.click('#pmArrowRight'); await p.waitForTimeout(700); return state(); };

const перед = await state();
const ракурси = [перед.бік];
let модель = перед;
for(let i = 0; i < 6; i++){
  const ще = await p.evaluate(() => {
    const r = document.getElementById('pmArrowRight');
    return !!r && r.style.display !== 'none';
  });
  if(!ще) break;
  модель = await крок();
  ракурси.push(модель.бік);
}
console.log('   ракурси: ' + ракурси.join(' → '));
console.log('   на моделі: ' + модель.фото + ' · шарів ' + модель.шарів);
ok(ракурси.includes('На моделі'),
  'у збиранні зʼявився ракурс «На моделі» — поруч із передом і спиною',
  'ракурсу немає: ' + ракурси.join(' → '));
ok(/^model-/.test(модель.фото),
  'на ньому саме фото моделі, а не мокап виробу',
  'не те фото: ' + модель.фото);
ok(модель.шарів === 1,
  'логотип переїхав туди сам — ставити його вдруге з нуля не треба',
  'засіву не сталось, шарів: ' + модель.шарів);
ok(перед.сума === модель.сума,
  'ціна від вітрини не зрушила: це той самий логотип, а не друге нанесення',
  'ціна змінилась: «' + перед.сума + '» → «' + модель.сума + '»');

console.log('');
console.log('═══ ПЕРСПЕКТИВА — ТУТ ЖЕ, А НЕ В КАРТЦІ ═══');
/* Людина на фото стоїть під кутом, і плаский прямокутник на грудях
   виглядає наліпкою. Нахил робиться там само, де й саме розміщення. */
ok(await p.evaluate(() => !!document.querySelector('[data-handle="warp"]')),
  'у шара є ручка нахилу',
  'ручки нахилу немає');
const доВмик = await p.evaluate(() => document.querySelectorAll('[data-corner]').length);
await p.dispatchEvent('[data-handle="warp"]', 'mousedown');
await p.waitForTimeout(400);
const післяВмик = await p.evaluate(() => document.querySelectorAll('[data-corner]').length);
console.log('   кутів: до ' + доВмик + ' · після ' + післяВмик);
ok(доВмик === 0 && післяВмик === 4,
  'кути зʼявляються лише в режимі нахилу — інакше вони б сперечались за клік ' +
    'із перетягуванням самого шару',
  'кути поводяться не так: ' + доВмик + ' → ' + післяВмик);

const кут = await p.locator('[data-corner="0"]').boundingBox();
await p.mouse.move(кут.x + 8, кут.y + 8);
await p.mouse.down();
await p.mouse.move(кут.x + 44, кут.y + 20, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(400);
const tr = await p.evaluate(() => (document.querySelector('.pm-dl-img').style.transform || ''));
console.log('   перетворення: ' + (tr.slice(0, 34) || '(немає)'));
ok(/^matrix3d\(/.test(tr),
  'потягнули кут — нанесення лягло по формі, а не лишилось пласким',
  'нахилу не сталось: ' + (tr || '(порожньо)'));

await p.dispatchEvent('[data-handle="warp"]', 'mousedown');
await p.waitForTimeout(400);
const після = await p.evaluate(() => (document.querySelector('.pm-dl-img').style.transform || ''));
ok(!після,
  'повторне натискання повертає як було: окрема кнопка скидання читалась би ' +
    'як ще один режим',
  'нахил лишився: ' + після);

console.log('');
console.log('═══ КАРТКА НІЧОГО НЕ РОЗМІЩУЄ ═══');
/* Головне в цій зміні — не нова ручка, а те, що місць прийняття рішення
   стало одне. Картка більше не вміє ставити логотип, і саме тому він у ній
   більше нікуди не їде. */
const cards = fs.readFileSync(path.join(ROOT, 'loomiq-cards.js'), 'utf8');
ok(!/markQuad|drawWarp|MARK0/.test(cards),
  'у малювальнику карток не лишилось ані якоря, ані власної геометрії нанесення',
  'картка досі щось розміщує сама');
const editor = fs.readFileSync(path.join(ROOT, 'offer-edit.html'), 'utf8');
ok(!/markUi|cd-mark/.test(editor),
  'у вкладці «Картки» немає редактора розміщення — дивитись можна, рухати ні',
  'редактор розміщення досі у картці');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(LOGO); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'нанесення на модель ставлять у збиранні, картка лише показує');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
