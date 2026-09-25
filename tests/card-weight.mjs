/* КАРТКА НЕ МАЄ ВПИРАТИСЬ У ЛІМІТ БАЗИ.

   Firestore не приймає документ більший за 1 МБ і каже про це словом
   `invalid-argument` — тобто нічого не каже. Менеджер бачив «НЕ ЗБЕРЕЖЕНО
   замовлення: invalid-argument · Розмір картки: 1716 КБ» і не знав ні чому,
   ні що робити; робота при цьому вже зроблена й лежить тільки на екрані.

   Роздуває картку майже завжди одне: картинка, що лишилась текстом
   (`data:image/png;base64,…`) замість посилання на хмару. Так буває, коли
   хмара не відповіла під час збереження позиції. Один такий макет — сотні
   кілобайт, три вже за лімітом.

   Доти це чистилось рівно один раз, під час переїзду сховища. А важчає
   картка поступово й ламається раптом — тобто чекати наступного переїзду
   означає чекати вічно.

   Перевіряємо три речі:
     1. картка сама розвантажується перед записом, без питань і вікон;
     2. якщо хмара не відповіла — макет НЕ втрачається, лишається як був;
     3. коли зберегти все одно не вийшло, повідомлення каже, ЩО САМЕ важке,
        а не саме лише число кілобайт.

   Запуск:  node tests/card-weight.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8893;
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
const errs = [];

const stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:950 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);

console.log('');
console.log('═══ ВАЖКА КАРТКА РОЗВАНТАЖУЄТЬСЯ САМА ═══');
const res = await p.evaluate(async () => {
  /* Макет, який лишився в картці текстом. Довжина тут не випадкова: саме
     так виглядає збережений PNG — сотні кілобайт одним рядком. */
  const важкий = 'data:image/png;base64,' + 'A'.repeat(400 * 1024);
  const замовлення = () => ({
    id:'1', orderId:'1000084',
    items:[{ name:'Бомбер', mockups:[важкий, 'https://cdn/ok.png'],
             prints:[{ side:'front', file: важкий }],
             config:{ garmentId:'hoodie', logos:{ front:[{ url: важкий }] } } }],
    art:[{ n:1, url: важкий, files:[{ name:'v1', url: важкий }] }]
  });

  const до = window.jsonBytes(замовлення());

  /* Хмара відповідає — усе, що текстом, має поїхати туди. */
  const було = window.uploadCloudinary;
  let скільки = 0;
  window.uploadCloudinary = async () => { скільки++; return 'https://cdn/перенесено.png'; };
  const o1 = замовлення();
  const перенесено = await window.slimOrderNow(o1);
  const після = window.jsonBytes(o1);
  const лишилось = JSON.stringify(o1).indexOf('data:image') >= 0;

  /* Хмара мовчить — макет має лишитись на місці. Втратити його гірше, ніж
     мати важку картку: наступний запис спробує ще раз. */
  window.uploadCloudinary = async () => { throw new Error('хмара мовчить'); };
  const o2 = замовлення();
  await window.slimOrderNow(o2);
  const цілий = String(o2.items[0].mockups[0] || '').indexOf('data:image') === 0;

  window.uploadCloudinary = було;

  /* Розклад ваги: без нього «1716 КБ» не каже нічого — чистити наосліп нема
     сенсу, а питати менеджера, що він клав, тим більше. */
  const ваги = window.orderWeigh(замовлення());

  return { до, після, перенесено, скільки, лишилось, цілий,
           ваги: ваги.map(x => x.name), важче: ваги[0] && ваги[0].name };
});

ok(res.до > 1024 * 1024,
  'картка з трьома макетами в тексті справді за лімітом: ' + Math.round(res.до / 1024) + ' КБ',
  'перевірка зібрала легку картку — вона нічого не доводить');
ok(res.перенесено >= 4 && !res.лишилось,
  'усе, що лежало текстом, поїхало в хмару (' + res.перенесено + ' файлів)',
  'у картці лишились картинки текстом: перенесено ' + res.перенесено);
ok(res.після < 100 * 1024,
  'картка схудла до ' + Math.round(res.після / 1024) + ' КБ — база її прийме',
  'картка лишилась важкою: ' + Math.round(res.після / 1024) + ' КБ');
ok(res.цілий,
  'хмара мовчить — макет лишається в картці, а не зникає',
  'при недоступній хмарі макет загубився — це гірше за важку картку');
/* Найважче тут — версії макета (той самий рядок лежить у них двічі), а далі
   йдуть частини позиції. Важливо не котра саме перша, а що кожна названа
   людським словом і з номером позиції: саме за цим менеджер і знайде, що
   відкрити й перезберегти. */
ok(res.ваги.length >= 3 && res.ваги.some(n => /Бомбер/.test(n)) &&
   res.ваги.some(n => /версії макета/.test(n)),
  'розклад ваги називає винуватців поіменно: «' + res.ваги.slice(0, 2).join('», «') + '»',
  'розклад ваги нічого не називає: ' + JSON.stringify(res.ваги));

console.log('');
console.log('═══ ЗБЕРЕЖЕННЯ ЧИСТИТЬ ДО ЗАПИСУ, А НЕ ПІСЛЯ ВІДМОВИ ═══');
const код = await p.evaluate(() => String(window.saveOrders));
ok(/ORDER_SOFT/.test(код) && /slimOrderNow/.test(код),
  'запис сам розвантажує картку, щойно вона підійшла до межі',
  'збереження й далі пише як є — поломка повернеться на наступному макеті');
ok(/orderWeigh/.test(код),
  'і, якщо все одно не вийшло, збирає розклад ваги для повідомлення',
  'при відмові знову буде саме лише «invalid-argument»');
const текст = await p.evaluate(() => String(window.saveOrders));
ok(/лишився в картці текстом/.test(текст),
  'повідомлення каже менеджеру, що робити, а не «покажіть розробнику»',
  'повідомлення й далі відправляє менеджера до розробника');

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 2).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nкартка більше не впирається в ліміт мовчки');
process.exit(bad ? 1 : 0);
