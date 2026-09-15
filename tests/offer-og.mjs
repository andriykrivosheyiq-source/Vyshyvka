/* Заставка посилання — обкладинка саме цієї пропозиції, а не спільна картинка.

   ЯК БУЛО. Менеджер копіює посилання й вставляє в Instagram чи Telegram.
   Месенджер читає теги <meta og:…> ДО того, як у сторінці виконається бодай
   рядок коду, тож зібрати картинку зі сторінки він не може — і брав ту, що
   прописана в самому файлі: спільну на всіх, з кепкою, худі й свитшотом.
   Клієнт отримував посилання, схоже на рекламу, а не на лист саме йому.

   ЯК СТАЛО. Кадр 1200×630 адмінка готує сама й кладе поруч із пропозицією;
   воркер підставляє його в теги. У кадрі — логотип клієнта, заголовок його
   пропозиції, склад і дата фіксації ціни.

   ВМІСТ БЕРЕТЬСЯ ЗІ САМОЇ СТОРІНКИ. Пропозиція відкривається в невидимому
   кадрі з ?shot=1 — у цьому режимі від сторінки лишається сама обкладинка,
   розкладена рівно в 1200×630, — і з неї читаються готові рядки. Так склад і
   заголовок рахуються ОДИН раз, на сторінці, і в заставці не може опинитись
   інше число, ніж побачить клієнт.

   Перевіряємо:
     — ?shot=1 лишає від сторінки саму обкладинку, рівно 1200×630;
     — службові кнопки й заклик до дії в кадр не потрапляють;
     — сторінка каже вголос, коли її можна знімати, і робить це без помилок;
     — кадр малюється, має правильний розмір і не порожній;
     — без логотипа кадр усе одно робиться — з іменем клієнта;
     — довгий заголовок переноситься, а не вилазить за кадр.

   Запуск:  node tests/offer-og.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8851;
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

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const route = pg => pg.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

console.log('═══ СТОРІНКА ЛИШАЄ ВІД СЕБЕ САМУ ОБКЛАДИНКУ ═══');
/* Демонстраційна пропозиція — щоб перевірка не залежала ні від бази, ні від
   того, які саме дані лежать у конкретній картці. */
const sp = await browser.newPage({ viewport:{ width:1200, height:630 } });
sp.on('pageerror', e => errs.push('сторінка: ' + e.message.slice(0, 160)));
await route(sp);
await sp.goto(HOST + '/offer.html?demo=1&shot=1', { waitUntil:'domcontentloaded' });
for(let i = 0; i < 100 && !(await sp.evaluate(() => !!window.__shotReady)); i++)
  await sp.waitForTimeout(200);
const cover = await sp.evaluate(() => {
  const host = document.querySelector('.shot-host');
  const h = document.querySelector('.shot-host .hero');
  const r = h ? h.getBoundingClientRect() : null;
  const vis = sel => { const e = document.querySelector(sel);
    return !!e && getComputedStyle(e).display !== 'none'; };
  return {
    ready: !!window.__shotReady,
    host: !!host,
    size: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    title: ((document.querySelector('.shot-host .hero h1') || {}).textContent || '').trim(),
    made: ((document.querySelector('.shot-host .hero-made') || {}).textContent || '').trim(),
    logo: !!document.querySelector('.shot-host .hero-logo'),
    cta: vis('.shot-host .hero .btn'),
    // решта сторінки має лишитись на місці, але не показуватись
    page: !!document.getElementById('ovZoom'),
    pageShown: (()=>{ const e = document.getElementById('ovZoom');
      return !!e && getComputedStyle(e).display !== 'none'; })()
  };
});
console.log('  ' + JSON.stringify(cover.size) + ' · ' + cover.title.slice(0, 48));
ok(cover.ready, 'сторінка сказала, що її вже можна знімати',
   'сторінка так і не повідомила про готовність');
ok(cover.size && cover.size.w === 1200 && cover.size.h === 630,
   'обкладинка розкладена рівно в 1200×630 — розмір, який просить месенджер',
   'кадр не того розміру: ' + JSON.stringify(cover.size));
ok(cover.title && cover.logo,
   'у кадрі є і заголовок пропозиції, і логотип клієнта',
   'у кадрі немає головного: ' + JSON.stringify({ t:cover.title, l:cover.logo }));
ok(!cover.cta,
   'кнопки в кадрі немає — натиснути її в месенджері однаково не можна',
   'у заставку потрапила кнопка, яка нікуди не веде');
ok(cover.page && !cover.pageShown,
   'решта сторінки лишилась на місці, просто схована',
   'сторінку викинуто — код, що дописується після відмальовування, на цьому падає');
await sp.close();

console.log('');
console.log('═══ КАДР МАЛЮЄТЬСЯ ═══');
const p = await browser.newPage({ viewport:{ width:1400, height:900 } });
p.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
await route(p);
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);

const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="140">' +
  '<rect width="600" height="140" fill="#E8590C"/></svg>');
const draw = (txt) => p.evaluate(async t => {
  t.pic = t.logo ? await loadPic(t.logo).catch(()=>null) : null;
  const blob = await offerOgDraw(t);
  if(!blob) return { err:'порожньо' };
  const url = URL.createObjectURL(blob);
  const im = await new Promise(r => { const i = new Image(); i.onload = ()=> r(i); i.src = url; });
  /* Дивимось у сам кадр: скільки в ньому НЕ фонових пікселів. Порожній
     темний прямокутник — теж «картинка», і за розміром його не відрізнити. */
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0);
  const d = c.getContext('2d').getImageData(0, 0, im.width, im.height).data;
  let light = 0;
  for(let i = 0; i < d.length; i += 4 * 97) if(d[i] > 150 && d[i+1] > 150) light++;
  URL.revokeObjectURL(url);
  return { w: im.width, h: im.height, bytes: blob.size, light };
}, txt);

const full = await draw({ title:'Комерційна пропозиція для ARMORIX',
  made:'30 худі · 60 футболок · 7 робочих днів на виготовлення',
  till:'Ціна зафіксована до 22 вересня', logo:LOGO, logoBg:'' });
console.log('  ' + full.w + '×' + full.h + ' · ' + full.bytes + ' Б · світлих точок ' + full.light);
ok(full.w === 1200 && full.h === 630,
   'кадр саме 1200×630',
   'кадр не того розміру: ' + JSON.stringify(full));
ok(full.bytes > 4000 && full.light > 30,
   'кадр не порожній — у ньому є світлий текст на темному тлі',
   'кадр вийшов порожнім прямокутником: ' + JSON.stringify(full));

console.log('');
console.log('═══ БЕЗ ЛОГОТИПА Й З ДОВГИМ ЗАГОЛОВКОМ ═══');
/* Логотип є не в кожного клієнта, а заголовок буває і «для ІТ», і на пів
   рядка тексту. Ні перше, ні друге не має ламати кадр. */
const nologo = await draw({ title:'Комерційна пропозиція для Міністерства цифрової трансформації України',
  made:'120 футболок', till:'', logo:'', logoBg:'' });
console.log('  ' + nologo.w + '×' + nologo.h + ' · світлих точок ' + nologo.light);
ok(nologo.w === 1200 && nologo.h === 630 && nologo.light > 30,
   'кадр робиться й без логотипа — з іменем клієнта в ньому',
   'без логотипа кадр зламався: ' + JSON.stringify(nologo));

const wrapped = await p.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '700 54px sans-serif';
  return {
    long: ogWrap(c, 'Комерційна пропозиція для Міністерства цифрової трансформації України', 1000, 3).length,
    short: ogWrap(c, 'Комерційна пропозиція для ІТ', 1000, 3).length,
    cut: ogWrap(c, Array(60).fill('дуже').join(' '), 1000, 3)
  };
});
console.log('  рядків: довгий ' + wrapped.long + ', короткий ' + wrapped.short);
ok(wrapped.long > 1 && wrapped.short === 1,
   'довгий заголовок переноситься, короткий лишається одним рядком',
   'перенесення працює не так: ' + JSON.stringify(wrapped).slice(0, 120));
ok(wrapped.cut.length === 3 && /…$/.test(wrapped.cut[2]),
   'а нескінченний обрізається трьома крапками, а не лізе за кадр',
   'задовгий текст не обрізано: ' + JSON.stringify(wrapped.cut).slice(0, 120));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'у заставці — обкладинка цієї пропозиції, а не спільна картинка');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
