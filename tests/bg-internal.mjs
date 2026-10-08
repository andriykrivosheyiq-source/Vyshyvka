/* Конструктор КП: фон спершу прибирає ВНУТРІШНІЙ, PhotoRoom — лише кнопкою «2»
   (Андрій, 07.10: «щоб економити на токенах»).

   Запуск:  node tests/bg-internal.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8894;
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
const LOGO = path.join(ROOT, 'tests', '.tmp-bg-logo.png');
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
let викликів = 0;
await p.route('https://bg.test/**', async r => {
  викликів++;
  r.fulfill({ contentType:'image/png', body: fs.readFileSync(LOGO) });
});
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(1200);
await p.addScriptTag({ url: HOST + '/loomiq-bg.js' });
await p.evaluate(() => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.bgApi = Object.assign({}, window.SITE_CONTENT.bgApi, { proxyUrl:'https://bg.test/x' });
});

console.log('═══ ЗАВАНТАЖЕННЯ: СПЕРШУ ВНУТРІШНІЙ ═══');
const внутр = await p.evaluate(async () => {
  let моделі = 0;
  window.LQBgPipeline = async s => { моделі++; return s; };
  await window.__openProductModal('tee');
  await new Promise(r => setTimeout(r, 600));
  const рівне = document.createElement('canvas'); рівне.width = 60; рівне.height = 60;
  let x = рівне.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 60, 60); x.fillStyle = '#000'; x.fillRect(20, 20, 20, 20);
  const r1 = await window.LQ_removeBg(рівне.toDataURL('image/png'));
  const після1 = моделі;
  const фото = document.createElement('canvas'); фото.width = 60; фото.height = 60;
  x = фото.getContext('2d');
  for(let i = 0; i < 60; i++) for(let j = 0; j < 60; j++){ x.fillStyle = 'rgb(' + (i * 4) + ',' + (j * 4) + ',' + ((i * j) % 255) + ')'; x.fillRect(i, j, 1, 1); }
  await window.LQ_removeBg(фото.toDataURL('image/png'));
  return { простий: /^data:image\/png/.test(r1) && після1 === 0, моделі };
});
console.log('  ' + JSON.stringify(внутр) + ' · PhotoRoom викликів: ' + викликів);
ok(внутр.простий && внутр.моделі === 1 && викликів === 0,
  'рівне тло — простий алгоритм, фото — нейромережа, PhotoRoom не викликався', JSON.stringify(внутр) + ' / ' + викликів);

console.log('');
console.log('═══ КНОПКА «2» — PHOTOROOM НА ВИМОГУ ═══');
await p.setInputFiles('#pmFileInput', LOGO);
await p.waitForTimeout(1500);
const доКнопки = викликів;
const кнопка = await p.evaluate(() => !!document.querySelector('[data-bgpro]'));
await p.evaluate(() => { const k = document.querySelector('[data-bgpro]'); if(k) k.click(); });
await p.waitForTimeout(1500);
const після = await p.evaluate(() => !!document.querySelector('[data-bgpro].on'));
console.log('  кнопка: ' + кнопка + ' · до: ' + доКнопки + ' · після: ' + викликів + ' · увімкнено: ' + після);
ok(кнопка && доКнопки === 0, 'завантаження логотипа PhotoRoom не чіпає; на логотипі є кнопка «2»', 'кнопка ' + кнопка + ', викликів ' + доКнопки);
ok(викликів === 1 && після, '«2» — один виклик PhotoRoom, фон замінено його результатом', 'викликів ' + викликів + ', on ' + після);

console.log('');
console.log('═══ МАКСИМУМ ВИШИВКИ ═══');
/* 08.10, Андрій: «максимальна висота 29 см, а ширина 44 см — це саме
   максимум, який ми можемо робити». Стеля стоїть поруч із розміром. */
const стеля = await p.evaluate(() => (document.getElementById('pmPrintSize') || {}).textContent || '');
console.log('  ' + стеля);
ok(/максимум 44 × 29 см/.test(стеля), 'поруч із розміром — «максимум 44 × 29 см»', 'рядок розміру: ' + стеля);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(LOGO); }catch(e){}
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
