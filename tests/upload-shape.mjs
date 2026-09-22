/* Вивантаження у хмару приймає і файл, і адресу рядком.

   ПРОБЛЕМА. Картинки йдуть у хмару двома різними способами, і це не
   випадковість. Фото зі скріпки — справжній файл. А макети й логотипи з
   конструктора приїжджають ТЕКСТОВИМ РЯДКОМ (`data:image/png;base64,…`):
   вони там і народжуються, на полотні, файлом ніколи не були. Хмара такий
   рядок приймає навмисно.

   Одного дня до вивантаження додали імʼя файлу з розширенням — щоб адреса
   не лишалась без `.jpg`. Для файлів це правильно. Але додати імʼя до
   РЯДКА браузер не дозволяє й кидає помилку одразу, ще до звернення до
   мережі. Через неї збереження позиції обривалось на першому ж
   зображенні, а напис «Зберігаємо…» лишався назавжди: до рядка, який його
   міняє, справа не доходила. Відредагувати вже надіслане клієнту КП стало
   неможливо.

   Сімдесят перевірок були при цьому зелені: нову поведінку перевірили,
   стару, яку зачепили, — ні.

   Перевіряємо:
     — адреса рядком вивантажується й не падає;
     — справжній файл вивантажується й отримує імʼя з розширенням;
     — картинка без власного імені теж його дістає.

   Запуск:  node tests/upload-shape.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8872;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };
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

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:900 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('═══ І ФАЙЛ, І АДРЕСА РЯДКОМ ═══');
/* Хмару підміняємо своєю: нас цікавить не вона, а те, ЩО саме до неї
   поїде. Помилка, яку ловимо, трапляється ще до мережі — на складанні
   форми, — тож справжній запит тут тільки заважав би. */
const res = await p.evaluate(async () => {
  const seen = [];
  const real = window.fetch;
  window.fetch = async (u, opt) => {
    if(!/api\.cloudinary\.com/.test(String(u))) return real(u, opt);
    const f = (opt && opt.body && opt.body.get) ? opt.body.get('file') : null;
    seen.push({ рядок: typeof f === 'string',
                імя: (f && f.name) || '' });
    return { json: async () => ({ secure_url:'https://files.example/ok.jpg' }) };
  };
  const out = { адреса:'', файл:'', безімені:'' };
  const кадр = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
               'AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  try{ await uploadCloudinary(кадр); }catch(e){ out.адреса = String((e && e.message) || e); }
  const bin = Uint8Array.from(atob(кадр.split(',')[1]), c => c.charCodeAt(0));
  try{ await uploadCloudinary(new File([bin], 'logo.png', { type:'image/png' })); }
  catch(e){ out.файл = String((e && e.message) || e); }
  try{ await uploadCloudinary(new Blob([bin], { type:'image/png' })); }
  catch(e){ out.безімені = String((e && e.message) || e); }
  window.fetch = real;
  return { out, seen };
});
console.log('   ' + JSON.stringify(res));

ok(!res.out.адреса,
  'макет, який приїхав адресою-рядком, вивантажується й не падає',
  'адреса рядком валить вивантаження: ' + res.out.адреса);
ok(res.seen[0] && res.seen[0].рядок,
  'і їде саме рядком — хмара приймає його навмисно',
  'рядок дорогою перетворився на щось інше');
ok(!res.out.файл && res.seen[1] && res.seen[1].імя === 'logo.png',
  'справжній файл їде зі своїм імʼям',
  'файл утратив імʼя або не вивантажився: ' + JSON.stringify(res));
ok(!res.out.безімені && /\.png$/.test((res.seen[2] || {}).імя || ''),
  'картинка без власного імені дістає його за своїм типом — адреса не лишиться без розширення',
  'імені немає, адреса може лишитись без розширення: ' + JSON.stringify(res));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'у хмару їде і файл, і адреса — кожне своїм способом');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
