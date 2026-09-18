/* Каталог знімків: один на все, і в ньому справді все.

   ЩО БУЛО НЕ ТАК. Перша версія каталогу читала лише файли з репозиторію — і
   половини товарів у ній не було взагалі. Фліски, кітелі та інше, заведене
   менеджером через адмінку, живе в базі разом із посиланнями на знімки: у
   репозиторії цих файлів не існує. Дизайнер бачив каталог і робив висновок,
   що таких виробів у нас просто немає.

   Ще й ділився на два документи — мерч окремо, HoReCa окремо. Дизайнеру
   потрібен один: він шукає виріб, а не напрям.

   ЯК СТАЛО. Одна сторінка, відкрита за посиланням. Базовий перелік моделей і
   кольорів приїжджає з коду конструктора (catalog-base.js, збирається
   скриптом), решта — з бази, наживо. Знайшов виріб, обрав колір, забрав файл.

   Перевіряємо:
     — товар, заведений лише в адмінці, є в каталозі й має свої знімки;
     — знімок, завантажений в адмінку, перекриває файл із репозиторію —
       так само, як на самому сайті;
     — прихований в адмінці виріб у каталог не потрапляє;
     — кольори, дописані в адмінці, перекривають набір із коду;
     — пошук звужує список і за назвою виробу, і за кольором;
     — вибір кольору міняє знімки;
     — завантаження віддає файл із системним імʼям, а не відкриває вкладку;
     — база мовчить — сторінка все одно показує те, що знає, і каже про це.

   Запуск:  node tests/catalog.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8854;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
                         'Access-Control-Allow-Origin':'*' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const pic = (label, c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">' +
  '<rect width="400" height="500" fill="' + c + '"/>' +
  '<text x="200" y="260" font-size="30" fill="#fff" text-anchor="middle" ' +
  'font-family="sans-serif">' + label + '</text></svg>');

/* База така, якою її робить адмінка: власний виріб зі своїми знімками,
   прихований стандартний, дописаний колір і перекритий знімок. */
const DOC = {
  map: {
    'fleece1-navy-front': pic('фліска', '%231e2d4a'),
    'fleece1-navy-back':  pic('фліска зад', '%231e2d4a'),
    'fleece1-sand-front': pic('фліска', '%23c9b99a'),
    // перекриває файл із репозиторію
    'tee-black-front':    pic('новий', '%23111111'),
    // колір, дописаний в адмінці
    'cap-teal-front':     pic('кепка', '%230E7C5A')
  },
  names: { tee: 'Футболка базова' },
  products: {
    hidden: ['tote'],
    custom: [{ id:'fleece1', name:'Фліска базова', colors:[
      { id:'navy', name:'Синій', hex:'#1e2d4a' },
      { id:'sand', name:'Пісочний', hex:'#c9b99a' }
    ] }]
  },
  productColors: { cap: [{ id:'teal', name:'Смарагдовий', hex:'#0E7C5A' }] },
  sides: {}, viewOrder: {}
};

function stub(doc){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__DOC=' + JSON.stringify(doc) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; return d; };');
  s = s.replace(
    "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    "Doc.prototype.onSnapshot=function(cb, err){\n" +
    "    if(window.__DOC === null){ if(err) err(new Error('permission-denied')); return function(){}; }\n" +
    "    try{ cb(new Snap(this.__id||'x', this.__id==='photos' ? window.__DOC : null)); }\n" +
    "    catch(e){ console.error(e); } return function(){}; };");
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(doc){
  const p = await browser.newPage({ viewport:{ width:1360, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  const body = stub(doc);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/catalog.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2200);
  return p;
}

const p = await open(DOC);

console.log('═══ У КАТАЛОЗІ ВСЕ, А НЕ ПОЛОВИНА ═══');
/* Сторінка відкривається СІТКОЮ виробів: спершу обирають виріб, потім
   усередині — колір, і знімки того кольору стоять одразу під ним. */
const seen = await p.evaluate(() => ({
  rail: [...document.querySelectorAll('.p-t .nm')].map(x => x.textContent),
  count: document.getElementById('count').textContent,
  boot: document.getElementById('boot').hidden,
  prods: document.querySelectorAll('.prod').length
}));
console.log('  ' + seen.count);
console.log('  ' + seen.rail.join(' · '));
ok(seen.boot, 'сторінка піднялась', 'лишився екран завантаження');
ok(seen.prods === 0 && seen.rail.length > 1,
  'перший екран — сітка виробів, а не всі вироби з усіма кольорами простирадлом',
  'на першому екрані вже розгорнуті вироби: ' + seen.prods);
ok(/^(Футболка|Худі)/.test(seen.rail[0] || ''),
  'ходові вироби стоять першими: по знімок футболки чи худі приходять найчастіше',
  'першим стоїть «' + seen.rail[0] + '»');
ok(seen.rail.indexOf('Фліска базова') >= 0,
  'виріб, заведений лише в адмінці, є в каталозі — саме його й бракувало',
  'товарів з бази в каталозі немає: ' + seen.rail.join(', '));
ok(seen.rail.indexOf('Шопер') < 0,
  'прихований в адмінці виріб у каталог не потрапив',
  'показуємо те, що знято з продажу');

console.log('');
console.log('═══ ЗНІМКИ БЕРУТЬСЯ ЗВІДТИ, ЗВІДКИ Й НА САЙТІ ═══');
/* Заходимо у виріб і дивимось, звідки прийшов знімок. Виріб відкривається
   плиткою — тією самою дорогою, що й у людини. */
const openProd = async id => p.evaluate(async gid => {
  location.hash = '#' + gid;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise(r => setTimeout(r, 250));
  const s = document.querySelector('.sh img');
  return s ? s.getAttribute('src') : '';
}, id);
const src = { tee: await openProd('tee'), fleece: await openProd('fleece1'),
              sweat: await openProd('sweat') };
ok(/^data:/.test(src.tee),
  'завантажений в адмінку знімок перекриває файл із репозиторію',
  'показуємо старий файл замість нового: ' + src.tee.slice(0, 50));
ok(/^data:/.test(src.fleece),
  'у виробу з бази знімки свої',
  'знімок виробу з бази не знайшовся: ' + src.fleece.slice(0, 50));
ok(/^images\//.test(src.sweat),
  'а там, де адмінка нічого не міняла, лишається файл із репозиторію',
  'файл із репозиторію підмінено: ' + src.sweat.slice(0, 50));

const capCols = await p.evaluate(async () => {
  location.hash = '#cap';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise(r => setTimeout(r, 250));
  return [...document.querySelectorAll('.col-b')].map(b => b.textContent.trim());
});
console.log('  кольори кепки: ' + capCols.join(', '));
ok(capCols.length === 1 && /Смарагдовий/.test(capCols[0]),
  'кольори, дописані в адмінці, перекривають набір із коду',
  'набір кольорів не той: ' + JSON.stringify(capCols));

console.log('');
console.log('═══ ЗНАЙТИ, ОБРАТИ, ЗАБРАТИ ═══');
const found = await p.evaluate(async () => {
  location.hash = '#';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise(r => setTimeout(r, 200));
  const q = document.getElementById('q');
  q.value = 'фліс';
  q.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 200));
  return [...document.querySelectorAll('.p-t .nm')].map(x => x.textContent);
});
console.log('  «фліс» → ' + found.join(', '));
ok(found.length && found.every(n => /Фліс/i.test(n)),
  'пошук за назвою виробу звужує список',
  'пошук показав зайве: ' + JSON.stringify(found));

const byColor = await p.evaluate(async () => {
  const q = document.getElementById('q');
  q.value = 'пісочний';
  q.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 200));
  const names = [...document.querySelectorAll('.p-t .nm')].map(x => x.textContent);
  q.value = '';
  q.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 200));
  return names;
});
console.log('  «пісочний» → ' + byColor.length + ' виробів');
ok(byColor.length > 0 && byColor.length < 10,
  'і за кольором теж — дизайнер шукає «пісочний», а не ідентифікатор',
  'пошук за кольором не працює: ' + byColor.length);

const swapped = await p.evaluate(async () => {
  location.hash = '#fleece1';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise(r => setTimeout(r, 250));
  const before = document.querySelector('.sh img').getAttribute('src');
  const b = [...document.querySelectorAll('.col-b')]
    .filter(x => /Пісочний/.test(x.textContent))[0];
  b.click();
  await new Promise(r => setTimeout(r, 300));
  const after = document.querySelector('.sh img').getAttribute('src');
  const on = (document.querySelector('.col-b.on') || {}).textContent || '';
  return { changed: before !== after, on: on.trim(), hash: location.hash };
});
ok(swapped.changed && /Пісочний/.test(swapped.on),
  'вибір кольору міняє знімки',
  'колір обрався, а знімки лишились ті самі: ' + JSON.stringify(swapped));

console.log('');
console.log('═══ ФАЙЛ САМЕ ЗАВАНТАЖУЄТЬСЯ ═══');
/* Знімки з адмінки лежать на чужому домені, і там браузер ігнорує атрибут
   download: файл просто відкривався в сусідній вкладці. Тому качаємо через
   fetch і віддаємо блобом — перевіряємо, що саме так воно й відбувається. */
const dl = await p.evaluate(async () => {
  const got = [];
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = function(b){ got.push(b.size); return realCreate.call(URL, b); };
  const clicked = [];
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ clicked.push(this.download); };
  document.querySelector('#p-fleece1 .dl').click();
  await new Promise(r => setTimeout(r, 900));
  HTMLAnchorElement.prototype.click = realClick;
  URL.createObjectURL = realCreate;
  return { blobs: got.length, names: clicked };
});
console.log('  ' + JSON.stringify(dl));
ok(dl.blobs > 0 && dl.names.length === 1,
  'знімок іде файлом, а не відкривається вкладкою',
  'завантаження не спрацювало: ' + JSON.stringify(dl));
ok(/^fleece1-sand-(front|back)\./.test(dl.names[0] || ''),
  'імʼя файлу системне — сотню знімків розбирають за назвою, а не за порядком',
  'імʼя файлу не те: ' + dl.names[0]);
await p.close();

console.log('');
console.log('═══ БАЗА МОВЧИТЬ — КАТАЛОГ НЕ ПОРОЖНІЙ ═══');
/* Мовчазний порожній екран тут найгірший: дизайнер вирішить, що товарів
   немає. Показуємо те, що знаємо з коду, і кажемо, чому неповно. */
const p2 = await open(null);
const offline = await p2.evaluate(() => ({
  boot: document.getElementById('boot').hidden,
  rail: document.querySelectorAll('.p-t').length,
  toast: ((document.querySelector('.toast') || {}).textContent || '').trim()
}));
console.log('  виробів ' + offline.rail + ' · ' + offline.toast);
ok(offline.boot && offline.rail > 0,
  'без бази сторінка показує стандартні вироби, а не порожній екран',
  'при недоступній базі каталог порожній');
ok(/База не відповіла/.test(offline.toast),
  'і чесно каже, що перелік неповний',
  'мовчки показали половину: «' + offline.toast + '»');
await p2.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'каталог один, у ньому все, і файли забираються за два кліки');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
