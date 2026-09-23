/* Вивантаження прорахунку з картки замовлення.

   ЧОГО БРАКУВАЛО. «Разова за дизайн ділиться якось дивно» — і далі півгодини
   переказу по скріншотах: скільки штук, який спосіб, скільки макетів, що
   менеджер перемкнув руками. Переказ завжди неповний, а поламане сидить
   якраз у тому, що переказати забули. Числа в розкладі при цьому виглядають
   правдоподібно — саме тому їх і не перевіряли.

   ЩО РОБИТЬ КНОПКА. Складає в один файл усе, з чого рушій робить ціну, і
   все, що він повернув: описи позицій (це буквально його вхід), умови
   замовлення, модель цін, результат і ті самі рядки, які менеджер бачить у
   «Як склалась ціна». Цього досить, щоб повторити рахунок деінде й побачити,
   де саме число розійшлось — у вході, у рушії чи вже в розкладі.

   Клієнта у файлі немає навмисно: ні імені, ні телефону, ні ніка. Для
   розбору поломки вони не потрібні, а файл ходитиме по руках.

   СКЛАД ПЕРЕВІРКИ — той самий випадок, на якому число й розійшлось: на
   худі і логотип, і напис. Разова за логотип ділиться на свої 10 виробів,
   разова за напис — на всі 15, бо напис стоїть ще й на футболці. Одним
   числом це не показати, і саме тому розклад мусить мати два рядки.

   Запуск:  node tests/calc-dump.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8877;
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

/* Знижок за тираж немає: тоді від складу міняється рівно одне — поділ
   разових, і в числах не треба відділяти одне від іншого. Напис має власну
   ставку, інакше два види разових не відрізнити. */
const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }],
  garmentTiers: [{ from:1, coef:1 }],
  methods: {
    embro: { orderFee:700, orderCost:200, sketchFee:350, sketchCost:100,
             pieceFee:0, ratePerMm2:0, tiers:[{ from:1, coef:1 }],
             text:{ orderFee:400, orderCost:120, sketchFee:200, sketchCost:60 } },
    dtf:   { orderFee:900, orderCost:200, sketchFee:300, sketchCost:80,
             tiers:[{ from:1, coef:1 }], qtyFrom:[1] }
  }
};
const fp = n => Array.from({ length:144 }, (_, i) => (i * (n + 3)) % 10).join('');
const FP_LOGO = fp(1), FP_TEXT = fp(2);

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };

/* Худі: логотип + напис. Футболка: тільки напис. */
const item = (name, gid, qty, designs, kinds) => ({
  kind:'main', name, garmentId:gid, color:'Чорний', print:'Вишивка',
  sizes:'M × ' + qty, qty, unitPrice:0, price:0, unitCost:0, cost:0,
  mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'],
  tiers:[], specs:[], about:'',
  desc:{ method:'embro', gid, units:qty, base:600, coefPart:200,
         basePart:0, minPart:0, pieceFee:0, bare:false,
         designs, designKinds:kinds, designMm2:designs.map(()=>1200), dtfCols:[] }
});
const ORDER = {
  id:'1', orderId:'1000057', type:'client', name:'Оксана', company:'ARMORIX',
  phone:'+380670000057', instagram:'@oksana_test', email:'oksana@example.com',
  status:'kp', site:'main', payments:[], createdAt:'2026-09-10T09:00:00.000Z', hist:[],
  items:[ item('Худі', 'hoodie', 10, [FP_LOGO, FP_TEXT], ['img','txt']),
          item('Футболка', 'tee', 5, [FP_TEXT], ['txt']) ]
};

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

await p.evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  repriceOrder(orders[0]);
}, PRICING);

console.log('═══ РАЗОВА ЗА ДИЗАЙН ДІЛИТЬСЯ ПО ВИДАХ ═══');
const split = await p.evaluate(() => {
  const b = orders[0].items[0].parts;
  return { feeShare: b.feeShare,
           lines: (b.feeLines || []).map(l => l.kind + ':' + l.fee + '/' + l.units),
           sketches: (b.sketches || []).map(s => s.kind + ':' + s.fee + '/' + s.units) };
});
console.log('  разові: ' + split.lines.join(' · ') + '   на одиницю: ' + split.feeShare + ' ₴');
ok(split.lines.join(' · ') === 'img:700/10 · txt:400/15',
  'логотип ділиться на свої 10 виробів, напис — на всі 15: він стоїть і на футболці',
  'разові поділені не так: ' + JSON.stringify(split));

console.log('');
console.log('═══ РОЗКЛАД КАЖЕ ТЕ САМЕ, ЩО Й ЦІНА ═══');
const rows = await p.evaluate(() => calcDump(orders[0]).розкладНаЕкрані);
const худі = rows.find(r => /ХУДІ/i.test(r.позиція)) || { рядки:[] };
худі.рядки.forEach(r => console.log('  ' + r));
const fee = худі.рядки.filter(r => /Підготовка макета/.test(r));
const сума = fee.reduce((a, r) => a + (+(r.split('=').pop().replace(/[^\d-]/g, '')) || 0), 0);
ok(fee.length === 2 && /картинка/.test(fee[0]) && /напис/.test(fee[1]),
  'у розкладі два рядки — картинка й напис, кожен зі своїм тиражем',
  'розклад склав разові в одне число: ' + JSON.stringify(fee));
ok(сума === split.feeShare,
  'сума рядків сходиться з разовою в ціні за штуку: ' + сума + ' ₴',
  'рядки й ціна кажуть різне: ' + сума + ' ₴ проти ' + split.feeShare + ' ₴');

console.log('');
console.log('═══ У ФАЙЛІ Є ВСЕ, ЩОБ ПОВТОРИТИ РАХУНОК ═══');
const dump = JSON.parse(await p.evaluate(() => calcDumpText(orders[0])));
console.log('  розділи: ' + Object.keys(dump).join(', '));
ok(Array.isArray(dump.рушій.вхід) && dump.рушій.вхід.length === 2 &&
   dump.рушій.вхід[0].designs.length === 2,
  'у файлі лежить вхід рушія — описи позицій рівно такі, якими він їх бачить',
  'входу рушія немає: ' + JSON.stringify(dump.рушій && dump.рушій.вхід));
ok(Array.isArray(dump.рушій.вихід) && dump.рушій.вихід[0].parts &&
   dump.рушій.вихід[0].parts.feeShare === split.feeShare,
  'і вихід — той самий, який ліг у картку',
  'виходу рушія немає або він інший: ' + JSON.stringify(dump.рушій && dump.рушій.вихід));
ok(dump.модельЦін && dump.модельЦін.рушія &&
   dump.модельЦін.рушія.methods.embro.orderFee === 700 && !!dump.модельЦін.адмінки,
  'і обидві моделі цін — та, за якою рахував рушій, і та, яку показує адмінка',
  'моделі цін у файлі немає: ' + JSON.stringify(dump.модельЦін && Object.keys(dump.модельЦін)));
ok(dump.позиції.length === 2 && dump.позиції[0].уПрогоні === true &&
   dump.позиції[0].розклад && dump.позиції[0].нанесення,
  'по кожній позиції видно, чи пішла вона в спільний прогін і з чим',
  'позиції описані неповно: ' + JSON.stringify(dump.позиції.map(x => x.уПрогоні)));
ok(dump.видДизайну && ('словоМенеджера' in dump.видДизайну),
  'і чи перемикав менеджер вид дизайну руками — інакше цього не відтворити',
  'вибору менеджера у файлі немає');

console.log('');
console.log('═══ КЛІЄНТА У ФАЙЛІ НЕМАЄ ═══');
const txt = await p.evaluate(() => calcDumpText(orders[0]));
const leaks = ['Оксана', '380670000057', 'oksana_test', 'oksana@example.com']
  .filter(x => txt.indexOf(x) >= 0);
ok(!leaks.length,
  'ні імені, ні телефону, ні ніка, ні пошти — файл ходитиме по руках',
  'у файл потрапив клієнт: ' + leaks.join(', '));
ok(txt.indexOf('1000057') >= 0,
  'а номер замовлення є — без нього файл ні про що',
  'номера замовлення у файлі немає');

console.log('');
console.log('═══ КНОПКИ СТОЯТЬ У САМОМУ РОЗКЛАДІ ═══');
const ui = await p.evaluate(async () => {
  await openOrderDrawer(orders[0]);
  const box = document.querySelector('#orderDrawer .t-calc-dg');
  let saved = '';
  const orig = window.toast;
  window.toast = t => { saved = t; };
  const cp = navigator.clipboard && navigator.clipboard.writeText;
  let copied = '';
  if(cp) navigator.clipboard.writeText = t => { copied = t; return Promise.resolve(); };
  const b = box && box.querySelector('[data-calc-dg="copy"]');
  if(b) b.click();
  await new Promise(r => setTimeout(r, 100));
  window.toast = orig;
  if(cp) navigator.clipboard.writeText = cp;
  return { there: !!box, kinds: box ? [...box.querySelectorAll('button')].map(x => x.dataset.calcDg) : [],
           copied: copied.slice(0, 40), said: saved,
           seeCost: (typeof canSeeCost === 'function') ? canSeeCost() : null };
});
console.log('  кнопки: ' + ui.kinds.join(', ') + ' · сказала: ' + ui.said);
ok(ui.there && ui.kinds.join() === 'file,copy',
  'кнопки живуть усередині «Як склалась ціна» — там, де людина й помітила розбіжність',
  'кнопок у розкладі немає: ' + JSON.stringify(ui));
ok(/^\{\s*"що"/.test(ui.copied) && /Прорахунок скопійовано/.test(ui.said),
  'кнопка справді кладе файл у буфер і каже про це',
  'у буфер нічого не лягло: ' + JSON.stringify(ui));
ok(ui.seeCost === true,
  'і живе під правом бачити гроші — разом з усім фінансовим згортком',
  'розклад показали тому, кому гроші не видно');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'поломку в поділі разових більше не треба переказувати словами');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
