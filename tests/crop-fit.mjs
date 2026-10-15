/* ВІКНО «ОБРІЖТЕ ЗОБРАЖЕННЯ» — ЦІЛКОМ НА ЕКРАНІ (15.10).

   Андрій (КП 1000119): «натисну підрізати — нижня частина взагалі
   втратилась, і не зрозуміло, як зберегти». У редакторі КП конструктор
   живе в панелі, і «fixed» рахувався від неї, а не від екрана: вікно
   виходило вище за видиму частину, кнопки «Обрізати / Скасувати» — за
   краєм. Тут імітуємо саме це: вікно лежить у панелі з transform і висотою
   3000 px, — і перевіряємо, що картинка, рамка й кнопки видно повністю.

   Запуск:  node tests/crop-fit.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8995;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8', '.css':'text/css',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const b = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for(const vp of [{ width:1440, height:800 }, { width:390, height:740 }]){
  const p = await browser.newPage({ viewport: vp });
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: fbstub });
    if(u.startsWith(HOST) || u.startsWith('data:')) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2000);
  console.log('═══ ' + vp.width + '×' + vp.height + ' ═══');
  const r = await p.evaluate(async () => {
    /* Панель КП: transform і висота більша за екран — «fixed» усередині неї
       ламається саме так, як у редакторі. */
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:120px;left:40px;right:40px;height:3000px;transform:translateZ(0);overflow:auto;';
    document.body.appendChild(panel);
    panel.appendChild(document.getElementById('pmCropModal'));
    /* Широка світла картинка з написом — як «Комплектуємо простір під ключ». */
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1000;
    const x = c.getContext('2d'); x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, 1600, 1000);
    x.fillStyle = '#888'; x.font = '120px sans-serif'; x.fillText('Комплектуємо', 200, 600);
    const url = c.toDataURL('image/png');
    if(!window.__pmCrop) return { err: 'немає __pmCrop' };
    window.__crop = window.__pmCrop(url);
    await new Promise(r => setTimeout(r, 600));
    const ov = document.getElementById('pmCropModal');
    const box = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; };
    return { уBody: ov.parentNode === document.body, ov: box('pmCropModal'), img: box('pmCropImg'), ok: box('pmCropOk'), cancel: box('pmCropCancel'), H: innerHeight };
  });
  console.log('  ' + JSON.stringify(r));
  ok(r.уBody && Math.round(r.ov.top) === 0 && Math.round(r.ov.h) === r.H, 'вікно — рівно на весь екран, а не на висоту панелі', JSON.stringify(r.ov));
  ok(r.img.top >= 0 && r.img.bottom <= r.ok.top, 'картинку видно цілком, над кнопками', JSON.stringify(r.img));
  ok(r.ok.bottom <= r.H && r.cancel.bottom <= r.H, 'кнопки «Обрізати» й «Скасувати» — на екрані', JSON.stringify(r.ok));
  /* «Обрізати» справді обрізає. */
  await p.click('#pmCropOk');
  const res = await p.evaluate(async () => { const x = await window.__crop; return !!(x && x.url); });
  ok(res, '«Обрізати» віддає обрізану картинку', 'обрізання нічого не повернуло');
  await p.close();
}
console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nвікно обрізання завжди цілком на екрані');
process.exit(bad ? 1 : 0);
