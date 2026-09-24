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

/* ── ДВІ КАРТИНКИ МАЮТЬ РАХУВАТИСЬ ЯК ДВІ ───────────────────────────────
   Відбиток знімається з пікселів, а пікселі того самого логотипа на різних
   виробах різні: інший розмір виробу, інший ракурс, інший рендер. Худі й
   світшот із одним логотипом давали два несхожі відбитки — і рушій чесно
   рахував два макети. У замовленні дві картинки, у рахунку три. */
console.log('');
console.log('═══ ОДИН ФАЙЛ НА ДВОХ ВИРОБАХ — ОДИН МАКЕТ ═══');
const рахунок = await p.evaluate(() => {
  const ЛОГО = 'https://cdn.test/logo-a.png';
  const ДРУГЕ = 'https://cdn.test/logo-b.png';
  const шар = (fp, url) => ({ id:'L' + fp.slice(0, 4), url, fp, scale:1, frac:.3,
                              fx:.3, fy:.3, ar:1, fill:.8, w:60, h:60 });
  const fpA1 = Array.from({ length:144 }, (_, i) => (i * 7) % 10).join('');
  /* Той самий файл, але знятий з іншого виробу — відбиток інший. */
  const fpA2 = Array.from({ length:144 }, (_, i) => (i * 5 + 3) % 10).join('');
  const fpB  = Array.from({ length:144 }, (_, i) => (i * 3 + 1) % 10).join('');
  const o = orders[0];
  o.items = [
    { kind:'main', name:'Худі', garmentId:'hoodie', qty:10, unitPrice:0, price:0,
      config:{ logos:{ front:[шар(fpA1, ЛОГО)], back:[шар(fpB, ДРУГЕ)] } },
      desc:{ method:'embro', gid:'hoodie', units:10, base:1430, coefPart:500,
             basePart:150, minPart:0, pieceFee:75, bare:false,
             designs:[fpA1, fpB], designKinds:['img','img'],
             designMm2:[4000, 4000], dtfCols:[] } },
    { kind:'main', name:'Світшот', garmentId:'sweat', qty:5, unitPrice:0, price:0,
      config:{ logos:{ front:[шар(fpA2, ЛОГО)] } },
      desc:{ method:'embro', gid:'sweat', units:5, base:1050, coefPart:500,
             basePart:150, minPart:0, pieceFee:75, bare:false,
             designs:[fpA2], designKinds:['img'], designMm2:[4000], dtfCols:[] } }
  ];
  repriceOrder(o);
  const b = o.items[0].parts || {};
  return { груп: (b.designNos || []).map(d => d.no),
           ескізів: (b.sketches || []).length,
           адреси: o.items.map(x => (x.desc.designUrls || []).map(u => u.slice(-10))),
           світшотГрупа: ((o.items[1].parts || {}).designNos || []).map(d => d.no) };
});
console.log('  адреси відновлені: ' + JSON.stringify(рахунок.адреси));
console.log('  групи на худі: ' + рахунок.груп.join(', ') +
            ' · на світшоті: ' + рахунок.світшотГрупа.join(', '));
ok(JSON.stringify(рахунок.адреси) === JSON.stringify([['logo-a.png','logo-b.png'],['logo-a.png']]),
  'адреси файлів відновились із самого замовлення — старі пропозиції теж лікуються',
  'адреси не відновились: ' + JSON.stringify(рахунок.адреси));
ok(рахунок.груп.join() === '1,2' && рахунок.світшотГрупа.join() === '1',
  'дві картинки — дві групи, і логотип зі світшота потрапив у ту саму, що на худі',
  'груп вийшло не стільки: худі ' + рахунок.груп.join(',') +
    ' · світшот ' + рахунок.світшотГрупа.join(','));
ok(рахунок.ескізів === 1,
  'і ескіз рівно один — за другу картинку, а не за третю неіснуючу',
  'ескізів: ' + рахунок.ескізів);

/* ── ПЛАТИТЬ ТОЙ, НА КОМУ ЦЕЙ МАЛЮНОК СТОЇТЬ ────────────────────────────
   Підготовка макета — це робота над КОНКРЕТНИМ малюнком. Доти вона ділилась
   на всі вироби способу й лягала на кожну позицію, байдуже, чи є на ній той
   самий малюнок: кепка зі своїм власним логотипом платила частку за
   підготовку чужого макета плюс ескіз за свій — два макети в рахунку там, де
   на виробі один. Тепер обидві разові рахуються за самим макетом і діляться
   рівно на ті вироби, де цей малюнок є. */
console.log('');
console.log('═══ ЧУЖИЙ МАКЕТ НЕ ОПЛАЧУЄТЬСЯ ═══');
const чужий = await p.evaluate(() => {
  const A = Array.from({ length:144 }, (_, i) => (i * 7) % 10).join('');
  const B = Array.from({ length:144 }, (_, i) => (i * 3 + 1) % 10).join('');
  const шар = (fp, url) => ({ id:'L' + fp.slice(0, 3), url, fp, scale:1, frac:.3,
                              fx:.3, fy:.3, ar:1, fill:.8, w:60, h:60 });
  const o = orders[0];
  o.items = [
    { kind:'main', name:'Худі', garmentId:'hoodie', qty:10, unitPrice:0, price:0,
      config:{ logos:{ front:[шар(A, 'https://cdn.test/a.png')] } },
      desc:{ method:'embro', gid:'hoodie', units:10, base:1430, coefPart:500,
             basePart:150, minPart:0, pieceFee:75, bare:false,
             designs:[A], designKinds:['img'], designMm2:[4000], dtfCols:[] } },
    { kind:'main', name:'Кепка', garmentId:'cap', qty:3, unitPrice:0, price:0,
      config:{ logos:{ front:[шар(B, 'https://cdn.test/b.png')] } },
      desc:{ method:'embro', gid:'cap', units:3, base:360, coefPart:225,
             basePart:100, minPart:0, pieceFee:75, bare:false,
             designs:[B], designKinds:['img'], designMm2:[300], dtfCols:[] } }
  ];
  repriceOrder(o);
  const рядки = x => [].concat((x.parts.feeLines || []).map(l => 'підготовка ' + l.fee + '÷' + l.units),
                               (x.parts.sketches || []).map(k => 'ескіз ' + k.fee + '÷' + k.units));
  return { худі: рядки(o.items[0]), кепка: рядки(o.items[1]),
           разові: o.items.map(x => x.parts.feeShare) };
});
console.log('  худі:  ' + чужий.худі.join(' · '));
console.log('  кепка: ' + чужий.кепка.join(' · '));
ok(чужий.худі.join() === 'підготовка 850÷10',
  'худі платить підготовку СВОГО макета, поділену на свої 10 виробів',
  'на худі не те: ' + JSON.stringify(чужий.худі));
ok(чужий.кепка.join() === 'ескіз 350÷3',
  'кепка платить рівно за свій малюнок — і нічого за чужу підготовку',
  'кепка везе чужий макет: ' + JSON.stringify(чужий.кепка));
ok(чужий.разові[1] === 117,
  'разові на кепці — 117 ₴/шт, а не 117 плюс частка чужих 850',
  'разові на кепці: ' + чужий.разові[1] + ' ₴/шт');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'адмінка рахує тим самим рушієм, що й сайт');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
