/* Логотип із телефона не валить CRM (13.10).

   «Глючить ця срм, декілька разів пробувала додати логотип на одяг, а потім
   одразу вибиває» — Safari на iPhone закривав сторінку («Повторення
   проблеми»): фото з камери (12–48 Мп) оброблялось у повному розмірі
   кількома копіями, а «1 · Внутрішній» ще й вантажив нейромережу ~100 МБ.
   Тепер картинка зменшується до 2400 px по довшій стороні одразу при
   завантаженні, а на телефоні нейромережа не запускається.

   Запуск:  node tests/phone-logo.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8899;
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


const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function відкрити(ua, viewport){
  const ctx = await b.newContext(ua ? { userAgent: ua, viewport, isMobile: true, hasTouch: true } : { viewport });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.route('**://**', r => r.request().url().startsWith(HOST) ? r.continue() : r.abort());
  await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { p, ctx };
}
/* «Фото з камери» 6000 × 4000 — JPEG із шумом, як справжній знімок. */
async function камера(p){
  return p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 6000; c.height = 4000;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 6000, 4000); g.addColorStop(0, '#d9d2c3'); g.addColorStop(1, '#8c8577');
    x.fillStyle = g; x.fillRect(0, 0, 6000, 4000);
    x.fillStyle = '#1F6F3A'; x.beginPath(); x.arc(3000, 2000, 1200, 0, 7); x.fill();
    return c.toDataURL('image/jpeg', 0.9);
  });
}
const розмір = (p, d) => p.evaluate(d => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r(null); i.src = d; }), d);

console.log('═══ 1. IPHONE ═══');
{
  const { p, ctx } = await відкрити(IPHONE, { width:390, height:844 });
  const фото = await камера(p);
  const стан = await p.evaluate(async d => {
    await window.__openProductModal('tee');
    await new Promise(r => setTimeout(r, 600));
    const менше = await window.__lqShrinkUpload(d);
    return { low: window.__lqLowMem(), менше, jpeg: /^data:image\/jpeg/.test(менше), модельЄ: !!window.LQBg };
  }, фото);
  const дим = await розмір(p, стан.менше);
  console.log('  ' + JSON.stringify({ low: стан.low, дим, jpeg: стан.jpeg, модельЄ: стан.модельЄ }));
  ok(стан.low, 'iPhone розпізнано як телефон', 'не розпізнано');
  ok(дим && Math.max(...дим) === 2400 && Math.abs(дим[0] / дим[1] - 1.5) < 0.01 && стан.jpeg,
    'фото 6000 × 4000 одразу стає 2400 × 1600, пропорції ті самі, JPEG', 'розмір: ' + JSON.stringify(дим));
  ok(!стан.модельЄ, 'нейромережі для фону на сторінці немає взагалі (25.10: лише PhotoRoom)', 'LQBg є');
  /* Як Ганна: менеджер, файл із галереї телефона → вікно фону → «Не прибирати». */
  const файл = Buffer.from(фото.split(',')[1], 'base64');
  await p.evaluate(() => { window.__lqInline = true; });
  await p.setInputFiles('#pmFileInput', { name:'IMG_0001.jpg', mimeType:'image/jpeg', buffer: файл });
  await p.waitForTimeout(1500);
  const вікно = await p.evaluate(() => [...document.querySelectorAll('#pmBgAsk [data-bg]')].map(b => b.dataset.bg).join());
  ok(вікно === 'x,pro,no', 'у вікні фону на телефоні — лише «Прибрати фон» (PhotoRoom) і «Не прибирати»', 'кнопки: ' + вікно);
  await p.evaluate(() => document.querySelector('#pmBgAsk [data-bg="no"]').click());
  await p.waitForTimeout(2500);
  const шар = await p.evaluate(() => { const im = [...document.querySelectorAll('[data-layer-id] img')].slice(-1)[0]; return im ? im.src : null; });
  const дC = шар && await розмір(p, шар);
  console.log('  логотип на виробі: ' + JSON.stringify(дC));
  ok(дC && Math.max(...дC) <= 2400, 'логотип ліг на виріб уже зменшеним (≤ 2400 px), сторінка жива', 'шар: ' + JSON.stringify(дC));
  await ctx.close();
}

console.log('');
console.log('═══ 1б. КЛІЄНТ НА IPHONE (30.10: «після прикріплення файлу висне») ═══');
{
  const { p, ctx } = await відкрити(IPHONE, { width:390, height:844 });
  const фото = await камера(p);
  await p.evaluate(async () => { await window.__openProductModal('tee'); await new Promise(r => setTimeout(r, 600)); });
  const файл = Buffer.from(фото.split(',')[1], 'base64');
  const t0 = Date.now();
  /* Без режиму менеджера: вікна фону немає, PhotoRoom (адреси воркера в тесті немає) — картинка як є. */
  const нотатка = p.waitForSelector('#pmUpNote', { timeout: 4000 }).then(() => true, () => false);
  await p.setInputFiles('#pmFileInput', { name:'IMG_0002.jpg', mimeType:'image/jpeg', buffer: файл });
  const булаНотатка = await нотатка;
  await p.waitForTimeout(2500);
  const стан = await p.evaluate(() => ({ вікно: !!document.querySelector('#pmBgAsk'), нотатка: !!document.getElementById('pmUpNote'),
    шар: (() => { const im = [...document.querySelectorAll('[data-layer-id] img')].slice(-1)[0]; return im ? im.src : null; })() }));
  const дК = стан.шар && await розмір(p, стан.шар);
  console.log('  ' + JSON.stringify({ булаНотатка, вікно: стан.вікно, нотаткаЛишилась: стан.нотатка, дК, мс: Date.now() - t0 }));
  ok(!стан.вікно && дК && Math.max(...дК) <= 2400, 'клієнт: без вікна фону, фото 6000 × 4000 на виробі вже ≤ 2400 px — квадрата без картинки немає', 'шар: ' + JSON.stringify(дК));
  ok(булаНотатка && !стан.нотатка, 'поки прибирався фон — напис «Прибираємо фон…», після — зник', JSON.stringify({ булаНотатка, лишилась: стан.нотатка }));
  await ctx.close();
}

console.log('');
console.log('═══ 2. КОМПʼЮТЕР ═══');
{
  const { p, ctx } = await відкрити('', { width:1400, height:1000 });
  const фото = await камера(p);
  const стан = await p.evaluate(async d => {
    const малий = document.createElement('canvas'); малий.width = 300; малий.height = 200;
    const m = малий.getContext('2d'); m.fillStyle = '#f00'; m.fillRect(50, 50, 100, 100);
    const png = малий.toDataURL('image/png');
    const svg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="5000"/>');
    return { low: window.__lqLowMem(), менше: await window.__lqShrinkUpload(d),
             малийТой: (await window.__lqShrinkUpload(png)) === png, svgТой: (await window.__lqShrinkUpload(svg)) === svg };
  }, фото);
  const дим = await розмір(p, стан.менше);
  ok(!стан.low, 'компʼютер — не телефон', 'компʼютер вважається телефоном');
  ok(дим && Math.max(...дим) === 2400, 'велике фото й тут зменшується до 2400 px', JSON.stringify(дим));
  ok(стан.малийТой && стан.svgТой, 'маленька картинка й SVG лишаються як є', JSON.stringify(стан));
  await ctx.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
