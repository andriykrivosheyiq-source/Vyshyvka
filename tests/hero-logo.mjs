/* Логотип у шапці КП: береться сам, обирається зі своїх, розмір не крутять.

   ЩО БУЛО НЕ ТАК.

   1. Логотип шапки жив окремо від замовлення. Менеджер одягав логотипом
      вироби в конструкторі, а шапка КП лишалась порожньою — і той самий файл
      доводилось вантажити вдруге, вже в неї.

   2. Завантаження логотипа В ШАПКУ витирало список логотипів замовлення:
      рядок `o.logos = [url]` лишав у картці один цей файл. Лого, якими одягли
      вироби, з картки зникали, а з ними й можливість перемкнути шапку назад.

   3. Розмір підбирали руками, кнопками «−» і «+». Одна межа по висоті тут не
      працює: широка горизонтальна плашка при 44 px розтягується через пів
      шапки, а квадратний значок при тій самій висоті виглядає загубленим.

   Перевіряємо:
     — перший логотип замовлення стає логотипом шапки сам;
     — свідомий вибір менеджера головніший за цей автопідбір;
     — прибраний логотип не повертається сам;
     — усі логотипи замовлення доїжджають у документ, і в шапці їх можна
       перемкнути, не вантажачи файл удруге;
     — широкий і високий логотипи займають у шапці однакову вагу, і жоден не
       вилазить за колонку;
     — заданий руками розмір автопідбір не перебиває.

   Запуск:  node tests/hero-logo.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8843;
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

/* Два логотипи навмисно різної форми: широка плашка й високий значок. Саме на
   них і видно, що одна межа по висоті не працює. */
const svg = (w, h, c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
  '<rect width="' + w + '" height="' + h + '" fill="' + c + '"/></svg>');
const WIDE = svg(600, 90, '%23E8590C');     // 6.7 : 1
const TALL = svg(120, 300, '%2312B0A0');    // 1 : 2.5

const ORDER = {
  id:'1', orderId:'1000900', type:'client', name:'Оксана', company:'ARMORIX',
  phone:'+380670000900', status:'kp', site:'main', offerToken:'tok9',
  createdAt:new Date().toISOString(), hist:[], payments:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  /* Логотипи завантажені на вироби. Шапці нічого не призначали. */
  logos:[WIDE, TALL],
  items:[{ kind:'main', name:'Худі', color:'чорне', garmentId:'hoodie', qty:10,
           unitPrice:1200, price:12000, unitCost:700, cost:7000,
           prints:[{ side:'front', technique:'Вишивка', widthMm:100, heightMm:60, file:WIDE }] }]
};

function stub(order){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([order]) + ';\n  window.firebase={');
  s = s.replace(
    'var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(){}\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
    '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
    '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const body = stub(ORDER);
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ ШАПКА БЕРЕ ЛОГОТИП ЗАМОВЛЕННЯ САМА ═══');
const auto = await p.evaluate(() => {
  const o = orders[0];
  const d = offerBuild(o);
  return { logo: d.clientLogo, list: (d.clientLogoList || []).length,
           stored: o.clientLogo || '', size: d.clientLogoSize };
});
console.log('  у документі: ' + auto.logo.slice(0, 42) + '… · у списку ' + auto.list);
ok(auto.logo && auto.logo.indexOf('600') > 0,
  'шапка взяла перший логотип замовлення — той, яким одягли виріб',
  'шапка лишилась порожньою: ' + JSON.stringify(auto).slice(0, 120));
ok(!auto.stored,
  'і взяла саме як запасний варіант — у замовлення нічого не дописано',
  'автопідбір щось записав у замовлення: ' + auto.stored.slice(0, 40));
ok(auto.list === 2,
  'обидва логотипи замовлення доїхали в документ — є з чого обирати',
  'логотипів у документі ' + auto.list + ' замість двох');

console.log('');
console.log('═══ ВИБІР МЕНЕДЖЕРА ГОЛОВНІШИЙ ═══');
const picked = await p.evaluate(async TALL => {
  orders[0].clientLogo = TALL;
  const a = offerBuild(orders[0]).clientLogo;
  orders[0].clientLogoOff = true;
  const b = offerBuild(orders[0]).clientLogo;
  delete orders[0].clientLogoOff;
  orders[0].clientLogo = '';
  return { chosen: a === TALL, off: b };
}, TALL);
ok(picked.chosen,
  'обраний логотип лишається обраним, хоч у замовленні є й перший',
  'вибір менеджера перебило автопідбором');
ok(picked.off === '',
  'прибраний логотип не повертається сам — «прибрав» це не «ще не ставив»',
  'після видалення шапка знову щось показує: ' + String(picked.off).slice(0, 40));

console.log('');
console.log('═══ РОЗМІР ПІДБИРАЄТЬСЯ САМ ═══');
/* Дивимось на саму сторінку КП: широкий і високий логотипи мають зайняти
   однакову вагу, і жоден не має вилізти за колонку. */
const VH = path.join(ROOT, '_hl_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);
const c = await browser.newPage({ viewport:{ width:920, height:1000 } });
c.on('pageerror', e => errs.push('КП: ' + e.message.slice(0, 160)));
await c.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await c.goto(HOST + '/_hl_vhost.html', { waitUntil:'domcontentloaded' });
await c.waitForTimeout(4000);

const show = async (patch) => {
  const doc = await p.evaluate(x => {
    Object.assign(orders[0], x);
    return offerBuild(orders[0]);
  }, patch);
  await c.evaluate(o => window.__prev(o), doc);
  await c.waitForTimeout(900);
  return c.frames()[1].evaluate(() => {
    const im = document.querySelector('.hero-logo');
    const h = document.querySelector('.hero');
    if(!im) return null;
    const b = im.getBoundingClientRect(), hb = h.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height),
             fits: b.width <= hb.width, area: Math.round(b.width * b.height) };
  });
};
const wide = await show({ clientLogo: WIDE, clientLogoSize: 0 });
const tall = await show({ clientLogo: TALL, clientLogoSize: 0 });
console.log('  широкий: ' + wide.w + '×' + wide.h + ' · високий: ' + tall.w + '×' + tall.h);
ok(wide.fits && tall.fits,
  'обидва логотипи вміщаються в шапку',
  'логотип вилазить за шапку: ' + JSON.stringify({ wide, tall }));
ok(wide.h < 56 && wide.w <= 260,
  'широку плашку стримує ширина, а не висота — вона не тягнеться через пів шапки',
  'широкий логотип не обмежено: ' + JSON.stringify(wide));
ok(tall.h <= 60 && tall.h > 30,
  'високий значок стримує висота, і він не стає крихітним',
  'високий логотип не того розміру: ' + JSON.stringify(tall));
/* Однакова вага — не однакова висота. Порівнюємо площу: саме вона й читається
   оком як «великий чи маленький». */
const ratio = Math.max(wide.area, tall.area) / Math.max(1, Math.min(wide.area, tall.area));
console.log('  площі: ' + wide.area + ' і ' + tall.area + ' (різниця в ' + ratio.toFixed(1) + ' рази)');
/* Повної рівності не буде: межі по висоті не дають дуже витягнутому
   логотипу розрости площу. Але різниця має лишатись у межах розумного, а не
   в шістнадцять разів, як було при одній межі по висоті. */
ok(ratio < 3,
  'два логотипи різної форми важать на око приблизно однаково',
  'один логотип у ' + ratio.toFixed(1) + ' рази більший за другий');

const fixed = await show({ clientLogo: WIDE, clientLogoSize: 90 });
console.log('  заданий руками: ' + fixed.w + '×' + fixed.h);
ok(fixed.h === 90,
  'заданий руками розмір автопідбір не перебиває',
  'ручний розмір не спрацював: ' + JSON.stringify(fixed));
ok(fixed.fits,
  'і навіть заданий руками логотип не вилазить за шапку',
  'ручний розмір виштовхнув логотип за шапку: ' + JSON.stringify(fixed));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'логотип у шапці береться сам і не потребує підганяння');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
