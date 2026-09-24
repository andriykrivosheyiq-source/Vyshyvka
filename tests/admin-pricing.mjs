/* Адмінка мусить рахувати тим самим рушієм, що й сайт.

   ЩО БУЛО НЕ ТАК — І ЧОМУ ЦЬОГО НІХТО НЕ БАЧИВ.

   Рушій цін один на весь Loomiq і живе окремим файлом. Модель цін він бере
   з `window.SITE_CONTENT.pricing` — звідти, куди її кладе сторінка. Сайт,
   сторінка клієнта й кадр пропозиції це роблять. Адмінка не робила: вона
   тримала модель у своєму `contentData` і рушієві її не показувала.

   Наслідок був тихий і повний. У самій адмінці рушій не бачив цін узагалі й
   на будь-який прогін чесно повертав нулі. `repriceOrder` бачив нулі,
   вирішував, що модель не приїхала, і лишав збережені ціни як є. Ціни в
   картці стояли ті, що колись порахував конструктор, — на око все гаразд.

   А от `parts` не записувались ніде. Через це «Як склалась ціна» лишалась
   порожньою, і поділ разових не було звідки взяти: ні підготовки макета, ні
   ескізів, ні тиражів, на які вони діляться. Саме це й показав файл
   діагностики з живого замовлення: розклад `null` у кожної позиції, вихід
   рушія — самі нулі, модель цін для рушія — порожня.

   ЧОМУ ЦЕ НЕ ЛОВИЛИ ТЕСТИ. Вони ставили `window.SITE_CONTENT.pricing` самі,
   перед прогоном, — і тим самим лагодили поломку за адмінку. Тому цей тест
   не чіпає SITE_CONTENT ВЗАГАЛІ: модель приїжджає лише документом із бази,
   рівно як у житті.

   Запуск:  node tests/admin-pricing.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8883;
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

/* Модель цін лежить у документі сайту — там, де її й тримає база. */
const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }],
  garmentTiers: [{ from:1, coef:1 }],
  methods: {
    embro: { orderFee:850, orderCost:300, sketchFee:350, sketchCost:150,
             pieceFee:75, pieceCost:34, pricePer1000mm2:42, costPer1000mm2:7,
             minPrice:225, tiers:[{ from:1, coef:1 }],
             text:{ orderFee:480, orderCost:200, sketchFee:250, sketchCost:150,
                    pricePer1000mm2:35, costPer1000mm2:0.5, minPrice:150 } },
    dtf:   { orderFee:450, orderCost:120, sketchFee:150, sketchCost:30,
             tiers:[{ from:1, coef:1 }], qtyFrom:[1] }
  }
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
                  pricing: PRICING };

const FP = n => Array.from({ length:144 }, (_, i) => (i * (n + 3)) % 10).join('');
const desc = (gid, qty, kinds, fps) => ({ method:'embro', gid, units:qty,
  base:1430, coefPart:500, basePart:150, minPart:0, pieceFee:75, bare:false,
  designs:fps, designKinds:kinds, designMm2:fps.map(()=> 4000), dtfCols:[] });
const item = (name, gid, qty, kinds, fps) => ({
  kind:'main', name, garmentId:gid, color:'Чорний', print:'Вишивка',
  sizes:'M × ' + qty, qty, unitPrice:0, price:0, unitCost:0, cost:0,
  mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'],
  tiers:[], specs:[], about:'', desc: desc(gid, qty, kinds, fps) });

const ORDER = { id:'1', orderId:'1000900', type:'client', status:'kp', site:'main',
  payments:[], hist:[], createdAt:'2026-09-20T09:00:00.000Z', feeAdj:0, feeAdjC:0,
  items:[ item('Худі', 'hoodie', 10, ['img','txt'], [FP(1), FP(2)]),
          item('Футболка', 'tee', 5, ['txt'], [FP(2)]) ] };

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
/* ЖОДНОГО window.SITE_CONTENT ТУТ НЕМАЄ І БУТИ НЕ МАЄ. Модель приїхала
   документом — далі адмінка сама мусить дати її рушієві. */

console.log('═══ РУШІЙ БАЧИТЬ МОДЕЛЬ ЦІН ═══');
const видно = await p.evaluate(() => ({
  своя: !!(contentData && contentData.pricing && contentData.pricing.methods),
  рушію: !!(window.LQ && window.LQ.sitePricing && window.LQ.sitePricing()),
  ставка: ((((window.LQ.sitePricing() || {}).methods || {}).embro || {}).orderFee) || 0
}));
console.log('  у адмінці: ' + видно.своя + ' · рушієві видно: ' + видно.рушію +
            ' · разова: ' + видно.ставка + ' ₴');
ok(видно.своя && видно.рушію && видно.ставка === 850,
  'модель, що приїхала документом, дійшла до рушія — і це та сама модель',
  'рушій не бачить цін: ' + JSON.stringify(видно));

console.log('');
console.log('═══ ПЕРЕРАХУНОК ПРАЦЮЄ Й ПИШЕ РОЗКЛАД ═══');
const ціни = await p.evaluate(() => {
  const o = orders[0];
  const було = repriceOrder(o);
  return { перерахувало: було,
           ціни: o.items.map(x => +x.unitPrice || 0),
           розклад: o.items.map(x => !!x.parts),
           разові: (o.items[0].parts || {}).feeLines || null };
});
console.log('  ' + JSON.stringify(ціни.ціни) + ' ₴/шт · розклад: ' + JSON.stringify(ціни.розклад));
ok(ціни.перерахувало && ціни.ціни.every(x => x > 0),
  'адмінка перерахувала замовлення сама — доти вона мовчки лишала старі ціни',
  'перерахунок не відбувся: ' + JSON.stringify(ціни));
ok(ціни.розклад.every(Boolean),
  'і записала розклад кожній позиції — без нього поділ разових брати нізвідки',
  'розкладу немає: ' + JSON.stringify(ціни.розклад));
console.log('  разові на худі: ' +
  (ціни.разові || []).map(l => l.kind + ' ' + l.fee + '₴÷' + l.units).join(' · '));
ok((ціни.разові || []).length === 2,
  'на виробі з логотипом і написом — два рядки разових, кожен зі своїм тиражем',
  'разові злились в одне: ' + JSON.stringify(ціни.разові));
ok((ціни.разові || []).some(l => l.kind === 'img' && l.units === 10) &&
   (ціни.разові || []).some(l => l.kind === 'txt' && l.units === 15),
  'логотип ділиться на свої 10 виробів, напис — на всі 15',
  'поділ не той: ' + JSON.stringify(ціни.разові));

console.log('');
console.log('═══ «ЯК СКЛАЛАСЬ ЦІНА» БІЛЬШЕ НЕ ПОРОЖНЯ ═══');
const розклад = await p.evaluate(() => {
  const html = priceCalcHtml(orders[0]) || '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return { карток: d.querySelectorAll('.t-calc-item').length,
           рядки: [...d.querySelectorAll('.t-calc-row')]
                    .map(r => (r.querySelector('span') || {}).textContent || '')
                    .filter(t => /Підготовка макета/.test(t)) };
});
розклад.рядки.forEach(t => console.log('  ' + t));
ok(розклад.карток === 2,
  'розклад є в обох позицій',
  'карток у розкладі: ' + розклад.карток);
ok(розклад.рядки.length >= 2 && розклад.рядки.some(t => /картинка/.test(t)) &&
   розклад.рядки.some(t => /напис/.test(t)),
  'і в ньому видно підготовку макета окремо за картинку й за напис',
  'підготовки в розкладі немає: ' + JSON.stringify(розклад.рядки));

console.log('');
console.log('═══ ФАЙЛ ДІАГНОСТИКИ НЕ ПОРОЖНІЙ ═══');
const dump = JSON.parse(await p.evaluate(() => calcDumpText(orders[0])));
ok(!!(dump.модельЦін && dump.модельЦін.рушія && dump.модельЦін.рушія.methods),
  'у файл іде модель, за якою рахував рушій — доти там стояв null',
  'моделі рушія у файлі немає');
ok((dump.рушій.вихід || []).every(r => r && +r.unit > 0),
  'і вихід рушія з цінами, а не з нулями',
  'вихід рушія нульовий: ' + JSON.stringify(dump.рушій.вихід));
ok((dump.позиції || []).every(x => x.розклад),
  'у кожної позиції є розклад',
  'позиції без розкладу: ' +
    (dump.позиції || []).filter(x => !x.розклад).map(x => x.назва).join(', '));
ok((dump.розкладНаЕкрані || []).length === 2,
  'і розклад з екрана — той, який читає менеджер',
  'розкладу на екрані немає');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'адмінка рахує тим самим рушієм, що й сайт');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
