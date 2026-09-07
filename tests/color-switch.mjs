/* Колір виробу при перемиканні не «заливає».

   ПРОБЛЕМА. Фон сцени знімається з самого фото виробу — щоб студійний фон
   картинки й фон блоку були одного кольору, без видимої рамки. Але колір
   зчитувався ОДРАЗУ після зміни адреси картинки, а браузер міняє зображення
   лише коли нове завантажилось. Тобто в елементі <img> у ту мить лежало
   ПОПЕРЕДНЄ фото — і колір знімався з нього.

   Наслідок видно оком: перемикаєш чорне на біле, і сцена на частку секунди
   заливається темним, а тоді стрибає на світле. Двічі змінюється те, що мало
   змінитись один раз.

   Перевіряємо:
     — поки фото вантажиться, фон не міняється взагалі;
     — коли завантажилось — міняється рівно один раз;
     — фон збігається з тим, що на самому фото, а не з попереднім кольором;
     — фото не завантажилось — повертаємось до нейтрального, а не лишаємо
       чужий колір без пояснення.

   Запуск:  node tests/color-switch.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8836;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp',
               '.png':'image/png', '.jpg':'image/jpeg' };

/* Два «фото» виробу, кожне суцільного кольору: темне й світле. Саме на них і
   видно підміну — колір фону має збігтися з кольором того фото, яке зараз на
   екрані, і ні з чим іншим. Віддаємо їх ПОВІЛЬНО: без затримки браузер
   встигає підмінити картинку до того, як ми встигаємо щось поміряти, і
   помилка не відтворюється. */
const PNG = hex => {
  const [r, g, b] = [hex.slice(0,2), hex.slice(2,4), hex.slice(4,6)].map(x => parseInt(x, 16));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
    '<rect width="80" height="80" fill="rgb(' + r + ',' + g + ',' + b + ')"/></svg>';
  return Buffer.from(svg);
};
const SLOW = 700;
const srv = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const m = /^\/fake-(dark|light)\.svg$/.exec(url);
  if(m){
    await new Promise(r => setTimeout(r, SLOW));
    res.writeHead(200, { 'Content-Type':'image/svg+xml' });
    res.end(PNG(m[1] === 'dark' ? '1a1a1a' : 'eeebe4'));
    return;
  }
  const f = path.join(ROOT, url.replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('═══ ФОН БЕРЕТЬСЯ З ФОТО, ЯКЕ ВЖЕ НА ЕКРАНІ ═══');
const run = await p.evaluate(async () => {
  const img = document.getElementById('pmGarmentPhoto');
  const stage = document.getElementById('pmStage');
  if(!img || !stage) return { err:'сцени немає' };

  const bg = () => getComputedStyle(stage).backgroundColor;
  const seen = [];
  const watch = new MutationObserver(() => {
    const v = bg();
    if(!seen.length || seen[seen.length - 1] !== v) seen.push(v);
  });

  /* Ставимо темне фото й чекаємо, поки воно справді стане на місце. */
  img.style.display = '';
  img.setAttribute('src', '/fake-dark.svg');
  await new Promise(r => img.addEventListener('load', r, { once:true }));
  __lqStageBg();
  const dark = bg();

  seen.push(dark);
  watch.observe(stage, { attributes:true, attributeFilter:['style'] });

  /* Тепер міняємо колір — так само, як це робить renderGarment: адресу
     міняємо й одразу просимо підігнати фон. Саме тут і крилась помилка. */
  img.setAttribute('src', '/fake-light.svg');
  __lqStageBg();
  await new Promise(r => setTimeout(r, 250));
  const midway = bg();                     // фото ще НЕ завантажилось

  await new Promise(r => img.addEventListener('load', r, { once:true }));
  __lqStageBg();
  await new Promise(r => setTimeout(r, 120));
  const after = bg();
  watch.disconnect();

  const lum = s => { const n = (String(s).match(/\d+/g) || []).map(Number);
    return n.length >= 3 ? (n[0] + n[1] + n[2]) / 3 : -1; };
  return { dark, midway, after, seen,
           lumDark: lum(dark), lumMid: lum(midway), lumAfter: lum(after) };
});
if(run.err){ console.log('  ' + run.err); bad++; }
else {
  console.log('  темне фото: ' + run.dark + ' (яскравість ' + Math.round(run.lumDark) + ')');
  console.log('  поки світле вантажиться: ' + run.midway);
  console.log('  після завантаження: ' + run.after + ' (яскравість ' + Math.round(run.lumAfter) + ')');
  console.log('  усіх змін фону за перемикання: ' + (run.seen.length - 1));

  ok(run.lumDark < 90,
    'на темному фото фон сцени темний — колір справді знімається з картинки',
    'фон не збігся з темним фото: ' + run.dark);
  ok(run.midway === run.dark,
    'поки нове фото вантажиться, фон не міняється — старе зображення не читаємо',
    'фон смикнувся до завантаження: ' + run.dark + ' → ' + run.midway);
  ok(run.lumAfter > 180,
    'коли світле фото стало на місце — фон світлий',
    'фон не підхопив нове фото: ' + run.after);
  ok(run.seen.length === 2,
    'фон змінився рівно один раз, а не двічі — стрибка немає',
    'фон мінявся ' + (run.seen.length - 1) + ' раз(и): ' + run.seen.join(' → '));
}

console.log('');
console.log('═══ ФОТО НЕ ЗАВАНТАЖИЛОСЬ ═══');
const fail = await p.evaluate(async () => {
  const img = document.getElementById('pmGarmentPhoto');
  const stage = document.getElementById('pmStage');
  img.setAttribute('src', '/fake-missing.svg');
  await new Promise(r => setTimeout(r, 900));
  return getComputedStyle(stage).backgroundColor;
});
const lumFail = (String(fail).match(/\d+/g) || []).map(Number).reduce((a, b) => a + b, 0) / 3;
console.log('  ' + fail);
ok(lumFail > 180,
  'фото не прийшло — фон нейтральний, а не чужого кольору',
  'лишився колір від попереднього фото: ' + fail);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'колір міняється один раз і саме на той, що на екрані');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
