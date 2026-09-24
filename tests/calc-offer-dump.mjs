/* Прорахунок на екрані ЗБИРАННЯ ПРОПОЗИЦІЇ — його теж треба вміти перевірити.

   ЧОМУ ОКРЕМО ВІД КАРТКИ. Картка замовлення показує основні позиції. А на
   екрані збирання їх може не бути взагалі: пропозиція складається з
   рекомендованих товарів і груп варіантів, з яких клієнт візьме по одному.
   Через це сума там не число, а вилка «від — до», і жодне з цих чисел у
   картці не видно. Перевіряти доводиться саме їх — вони й стоять перед
   очима, коли щось не сходиться.

   ЩО ТУТ ЗВІРЯЄМО:
     • у файл потрапляє ВЕСЬ склад — основні, варіанти, рекомендовані —
       з розкладом по кожній позиції, а не лише те, що є в картці;
     • рекомендована рахується як «склад + вона», і в неї є свій розклад:
       доти навпроти неї не було жодного рядка, і перевірити її ціну було
       нічим;
     • варіанти однієї групи рахуються від того самого тиражу;
     • вилка «від — до» складається з найдешевшого й найдорожчого вибору в
       кожній групі, а не з усіх варіантів підряд;
     • кнопка на самому екрані збирання доводить це до адмінки — у кадру
       пропозиції немає ні моделі цін, ні замовлення;
     • і все це перевіряється однією командою, а не очима.

   Запуск:  node tests/calc-offer-dump.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8880;
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

/* Без знижок за тираж: тоді від складу міняється рівно поділ разових, і в
   числах не треба відділяти одне від іншого. */
const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }],
  garmentTiers: [{ from:1, coef:1 }],
  methods: {
    embro: { orderFee:850, orderCost:200, sketchFee:350, sketchCost:100,
             pieceFee:0, ratePerMm2:0, tiers:[{ from:1, coef:1 }],
             text:{ orderFee:400, orderCost:120, sketchFee:200, sketchCost:60 } },
    dtf:   { orderFee:900, orderCost:200, sketchFee:300, sketchCost:80,
             tiers:[{ from:1, coef:1 }], qtyFrom:[1] }
  }
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
const FP = Array.from({ length:144 }, (_, i) => (i * 7) % 10).join('');

/* Рівно те, що на екрані в менеджера: основних позицій немає, три
   рекомендовані та дві групи по два варіанти. */
const item = (kind, name, gid, qty, extra) => Object.assign({
  kind, name, garmentId:gid, color:'Чорний', print:'Вишивка', sizes:'M × ' + qty,
  qty, unitPrice:0, price:0, unitCost:0, cost:0,
  mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'],
  tiers:[], specs:[], about:'',
  desc:{ method:'embro', gid, units:qty, base:600, coefPart:200,
         basePart:0, minPart:0, pieceFee:0, bare:false,
         designs:[FP], designKinds:['img'], designMm2:[1200], dtfCols:[] }
}, extra || {});
const ORDER = {
  id:'1', orderId:'1000057', type:'client', status:'kp', site:'main',
  offerToken:'tok57', payments:[], hist:[], createdAt:'2026-09-10T09:00:00.000Z',
  feeAdj:0, feeAdjC:0,
  vqty:{ 'Група 1':2, 'Група 2':3 },
  items:[
    item('reco',    'Футболка базова',   'tee',        3),
    item('reco',    'Кепка',             'cap',        3),
    item('reco',    'Світшот',           'sweat',      3),
    item('variant', 'Худі оверсайз',     'hoodieover', 2, { vgroup:'Група 1' }),
    item('variant', 'Худі базове',       'hoodie',     2, { vgroup:'Група 1' }),
    item('variant', 'Поло базове',       'polo',       3, { vgroup:'Група 2' }),
    item('variant', 'Поло оверсайз',     'poloover',   3, { vgroup:'Група 2' })
  ]
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
  contentData.pricing = pr;
  repriceOrder(orders[0]);
  recalcOrderTotals(orders[0]);
}, PRICING);

const dump = JSON.parse(await p.evaluate(() => calcDumpText(orders[0])));

console.log('═══ У ФАЙЛ ІДЕ ВЕСЬ СКЛАД, А НЕ ЛИШЕ КАРТКА ═══');
const проп = dump.розкладПропозиції || {};
const n = x => Object.keys(x || {}).length;
console.log('  основних: ' + n(проп.items) + ' · варіантів: ' + n(проп.vars) +
            ' · рекомендованих: ' + n(проп.reco));
ok(n(проп.items) === 0 && n(проп.vars) === 4 && n(проп.reco) === 3,
  'у файлі всі сім позицій — чотири варіанти й три рекомендовані',
  'склад у файл потрапив не весь: ' + JSON.stringify([n(проп.items), n(проп.vars), n(проп.reco)]));
const рекРядки = ((проп.reco || {})['0'] || {}).rows || [];
ok(рекРядки.length > 2 && рекРядки.some(r => /Виріб/.test(r[0])) &&
   рекРядки.some(r => /Підготовка макета/.test(r[0])),
  'у рекомендованої є свій розклад — доти навпроти неї не було жодного рядка',
  'рекомендована прийшла без розкладу: ' + JSON.stringify(рекРядки.map(r => r[0])));

console.log('');
console.log('═══ ВИЛКА СКЛАДАЄТЬСЯ З ВИБОРУ В КОЖНІЙ ГРУПІ ═══');
const в = dump.вилка || {};
Object.keys(в.групи || {}).forEach(g => console.log('  ' + g + ': ' +
  в.групи[g].map(x => x.назва + ' ' + x.сума + ' ₴').join(' · ')));
console.log('  разом ' + в.від + ' – ' + в.до + ' ₴ · ' +
            (в.штукОсновних + в.штукУГрупах) + ' шт · ' +
            Object.keys(в.групи || {}).length + ' групи на вибір');
const свої = Object.keys(в.групи).map(g => в.групи[g].map(x => x.сума));
const чекВід = свої.reduce((a, s) => a + Math.min.apply(null, s), в.основні);
const чекДо  = свої.reduce((a, s) => a + Math.max.apply(null, s), в.основні);
ok(в.від === чекВід && в.до === чекДо,
  'вилка — найдешевший вибір і найдорожчий, а не сума всіх варіантів',
  'вилка порахована не так: ' + в.від + '–' + в.до + ' проти ' + чекВід + '–' + чекДо);
ok(в.штукУГрупах === 5,
  'у замовленні буде пʼять виробів: по одному вибору з кожної групи',
  'штук у групах: ' + в.штукУГрупах);

console.log('');
console.log('═══ КНОПКА З ЕКРАНА ЗБИРАННЯ ДОХОДИТЬ ДО АДМІНКИ ═══');
const через = await p.evaluate(async () => {
  offerEd = { id: orders[0].id };
  let copied = '';
  const cp = navigator.clipboard.writeText;
  navigator.clipboard.writeText = t => { copied = t; return Promise.resolve(); };
  await offerEdApply({ lqEdit:true, act:'calcDump', how:'copy' });
  await new Promise(r => setTimeout(r, 120));
  navigator.clipboard.writeText = cp;
  offerEd = null;
  return copied.slice(0, 40);
});
console.log('  прийшло: ' + через);
ok(/^\{\s*"що"/.test(через),
  'кадр пропозиції просить — адмінка збирає файл: у кадру немає ні цін, ні замовлення',
  'із екрана збирання файл не збирається: ' + через);
const кадр = fs.readFileSync(path.join(ROOT, 'offer-edit.html'), 'utf8');
ok(/data-dg="file"/.test(кадр) && /data-dg="copy"/.test(кадр) &&
   /act:\s*'calcDump'/.test(кадр),
  'і кнопки стоять на самому екрані збирання, під сумою',
  'кнопок на екрані збирання немає');

console.log('');
console.log('═══ ПЕРЕВІРЯЄТЬСЯ ОДНІЄЮ КОМАНДОЮ ═══');
const TMP = path.join(ROOT, 'tests', '.calc-offer-tmp.json');
fs.writeFileSync(TMP, JSON.stringify(dump, null, 2));
const run = f => new Promise(res => {
  const c = spawn('node', [path.join(ROOT, 'tools', 'check-calc.mjs'), f]);
  let out = '';
  c.stdout.on('data', d => out += d);
  c.stderr.on('data', d => out += d);
  c.on('close', code => res({ code, out }));
});
const good = await run(TMP);
good.out.split('\n').filter(l => /варіант ·|рекомендована ·|Група|разом |Усе сходиться|НЕ СХОДИТЬСЯ/.test(l))
  .slice(0, 14).forEach(l => console.log('  ' + l.replace(/^\s+/, '')));
ok(good.code === 0 && /Усе сходиться/.test(good.out),
  'на здоровій пропозиції перевіряльник каже «сходиться»',
  'знайшов розходження там, де його немає:\n' + good.out);
ok(/рекомендована · Світшот/.test(good.out) && /Група 1/.test(good.out),
  'і називає кожну позицію та кожну групу поіменно',
  'у звіті немає складу пропозиції');

const зламане = JSON.parse(JSON.stringify(dump));
зламане.вилка.до += 500;
const BAD = path.join(ROOT, 'tests', '.calc-offer-bad.json');
fs.writeFileSync(BAD, JSON.stringify(зламане));
const badRun = await run(BAD);
ok(badRun.code === 1 && /НЕ СХОДИТЬСЯ/.test(badRun.out) && /вилка/.test(badRun.out),
  'а підроблену вилку знаходить і називає',
  'підроблену вилку пропустив:\n' + badRun.out);
try{ fs.unlinkSync(TMP); fs.unlinkSync(BAD); }catch(e){}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'числа з екрана збирання перевіряються так само, як із картки');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
