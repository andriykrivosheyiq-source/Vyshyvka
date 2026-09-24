/* Група варіантів дає в замовлення ОДНУ позицію — і рахується як одна.

   ЩО БУЛО НЕ ТАК. У пропозиції дві групи по п'ять штук: «яка футболка» і
   «яке худі». Клієнт відповість на кожне питання один раз — отже в
   замовленні десять виробів. Так їх і рахує ліва панель робочого місця:
   «10 шт · 2 групи на вибір».

   А підготовка макета ділилась на п'ятнадцять. Конструктор брав із ЧУЖОЇ
   групи всі її картки: свої п'ять плюс дві чужі по п'ять. На екрані стояло
   «850 грн ÷ 15 шт» — тираж, якого в замовленні немає й не буде.

   Гірше, що кожне місце рахувало по-своєму:
     • конструктор — усі картки чужих груп (÷15);
     • адмінка — жодної чужої групи взагалі (÷5), і саме її число лягало
       в документ;
     • сторінка клієнта — тільки вже обрані групи (÷5, а після вибору ÷10).

   Тому ціна, зафіксована в конструкторі, після збереження ставала іншою, а
   у клієнта — третьою, і вона ще й стрибала від першого ж вибору в сусідній
   групі.

   ЯК МАЄ БУТИ. Склад один: усі основні позиції плюс по ОДНОМУ варіанту з
   кожної групи. Поки вибору немає, групу представляє її перший варіант —
   той самий, за яким рахує ліва панель і склад словами в шапці.

   Перевіряємо:
     — адмінка бере в склад рівно по одному варіанту з групи;
     — підготовка макета ділиться на 10, а не на 5 і не на 15;
     — усі чотири варіанти рахуються від того самого тиражу;
     — рекомендована за ГОТОВИЙ макет не платить: він той самий, що в
       складі, і склад уже оплатив його повністю;
     — «у цьому тиражі» називає саме тих, хто в ньому справді є;
     — конструктор будує той самий склад, що й адмінка;
     — у клієнта ціна варіанта збігається з тією, що записала адмінка, і не
       міняється від вибору в сусідній групі.

   Запуск:  node tests/variant-fee.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8859;
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

/* Знижок за тираж немає навмисно: тоді єдине, що міняється від складу, —
   поділ разових. Саме його й перевіряємо, і в числах не треба відділяти
   одне від іншого. */
const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }],
  garmentTiers: [{ from:1, coef:1 }],
  methods: {
    embro: { orderFee:850, orderCost:200, sketchFee:350, sketchCost:100,
             pieceFee:0, ratePerMm2:0, tiers:[{ from:1, coef:1 }] },
    dtf:   { orderFee:900, orderCost:200, sketchFee:300, sketchCost:80,
             tiers:[{ from:1, coef:1 }], qtyFrom:[1] }
  }
};
// Один і той самий малюнок на всіх виробах — отже один макет на все замовлення
const FP = Array.from({ length:144 }, (_, i) => (i * 7) % 10).join('');
const desc = gid => ({ method:'embro', gid, units:5, base:600, coefPart:200,
                       basePart:0, minPart:0, pieceFee:0, bare:false,
                       designs:[FP], designKinds:['img'], designMm2:[1200], dtfCols:[] });
const row = (kind, name, gid, extra) => Object.assign({
  kind, name, garmentId:gid, color:'Чорний', print:'Вишивка', sizes:'M × 5',
  qty:5, unitPrice:0, price:0, unitCost:0, cost:0,
  mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'],
  tiers:[], specs:[], about:'', desc: desc(gid)
}, extra || {});

/* Рівно те, що на екрані в менеджера: рекомендований світшот і дві групи
   по два варіанти. Основних позицій немає — у цій пропозиції їх і не було. */
const ORDER = {
  id:'1', orderId:'1000056', type:'client', name:'Андрій', company:'ARMORIX',
  phone:'+380670000056', status:'kp', site:'main', offerToken:'tokvar', payments:[],
  createdAt:'2026-09-10T09:00:00.000Z', hist:[],
  vqty:{ 'Група 1':5, 'Група 2':5 },
  items:[
    row('reco',    'Світшот',           'sweat'),
    row('variant', 'Футболка базова',   'tee',       { vgroup:'Група 1' }),
    row('variant', 'Футболка оверсайз', 'teeover',   { vgroup:'Група 1' }),
    row('variant', 'Худі базове',       'hoodie',    { vgroup:'Група 2' }),
    row('variant', 'Худі оверсайз',     'hoodieover',{ vgroup:'Група 2' })
  ]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const route = pg => pg.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

/* ══════════════ АДМІНКА ══════════════ */
console.log('═══ СКЛАД: ПО ОДНОМУ ВАРІАНТУ З ГРУПИ ═══');
const ap = await browser.newPage({ viewport:{ width:1400, height:1000 } });
ap.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
await route(ap);
await ap.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await ap.waitForTimeout(5200);

const adm = await ap.evaluate(pricing => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pricing;
  const o = JSON.parse(JSON.stringify(window.__ORDERS[0]));
  const base = orderDescriptors(o);
  repriceOrder(o);
  const feeOf = i => ((o.items[i] || {}).parts || {}).feeUnits || 0;
  return {
    baseNames: base.idx.map(i => o.items[i].name),
    fee: o.items.map((x, i) => feeOf(i)),
    unit: o.items.map(x => +x.unitPrice || 0),
    sharers: feeSharers(o, o.items[3])
  };
}, PRICING);

console.log('  у складі: ' + adm.baseNames.join(' · '));
console.log('  ділиться на: ' + adm.fee.join(' / ') + ' шт');
console.log('  ціна за штуку: ' + adm.unit.join(' / ') + ' грн');
ok(adm.baseNames.length === 2 &&
   adm.baseNames[0] === 'Футболка базова' && adm.baseNames[1] === 'Худі базове',
  'у складі рівно по одному варіанту з кожної групи — її перша картка',
  'склад зібрано не так: ' + JSON.stringify(adm.baseNames));
ok(adm.fee[1] === 10 && adm.fee[2] === 10 && adm.fee[3] === 10 && adm.fee[4] === 10,
  'підготовка макета ділиться на 10 шт — стільки й буде в замовленні',
  'поділ не той: ' + JSON.stringify(adm.fee.slice(1)));
/* Малюнок на рекомендованій той самий, що на варіантах, і склад за нього
   вже заплатив. Брати вдруге за ту саму роботу нема за що — тому разових у
   неї немає зовсім, а не «поділених на 15». */
ok(adm.fee[0] === 0,
  'рекомендована за готовий макет не платить — склад уже оплатив його',
  'рекомендована знову платить за готовий макет: ділить на ' + adm.fee[0] + ' шт');
ok(adm.unit[1] > 0 && adm.unit[1] === adm.unit[2] && adm.unit[3] === adm.unit[4],
  'варіанти однієї групи рахуються від того самого тиражу',
  'варіанти однієї групи розійшлись: ' + JSON.stringify(adm.unit));
console.log('  у цьому тиражі: ' + adm.sharers);
ok(/Футболка базова/.test(adm.sharers) && /Худі базове/.test(adm.sharers) &&
   !/Футболка оверсайз/.test(adm.sharers) && !/Світшот/.test(adm.sharers),
  'рядок «у цьому тиражі» називає саме тих, хто в ньому справді є',
  'склад тиражу названо неправильно: «' + adm.sharers + '»');

/* ══════════════ КОНСТРУКТОР ══════════════ */
console.log('');
console.log('═══ КОНСТРУКТОР БУДУЄ ТОЙ САМИЙ СКЛАД ═══');
/* Те саме місце, що на знімку менеджера: відкрита картка товару й рядок
   «Підготовка макета (850 грн ÷ N шт)» у прорахунку. */
const CART = ORDER.items.map(x => ({ kind:x.kind, vgroup:x.vgroup || '',
                                     name:x.name, qty:x.qty, desc:x.desc }));
const cp = await browser.newPage({ viewport:{ width:1300, height:1000 } });
cp.on('pageerror', e => errs.push('конструктор: ' + e.message.slice(0, 160)));
await route(cp);
await cp.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await cp.waitForTimeout(5200);
const gid = await cp.evaluate(([pricing, cart]) => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pricing;
  window.cartItems = cart;
  const el = document.querySelector('[data-garment]');
  return el ? el.getAttribute('data-garment') : null;
}, [PRICING, CART]);
const openAs = async i => {
  await cp.evaluate(([g, at, fp]) => {
    /* Правимо саме цю позицію кошика — так її відкриває редактор пропозиції. */
    window.__lqEditOnly = at;
    window.__editProduct({ garmentId:g, colorId:null, printId:null, qty:{ M:5 },
      logos:{ front:[{ id:'L1', url:'https://cdn.test/L1.png', fp:fp, scale:1,
                       frac:0.32, fx:0.3, fy:0.3, ar:1, fill:0.8,
                       opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 }],
               back:[], left:[], right:[] } }, null, []);
  }, [gid, i, FP]);
  await cp.waitForTimeout(1700);
  return cp.evaluate(() => {
    const box = document.getElementById('pmMgrCalc');
    if(!box) return { none:true };
    const rows = [...box.querySelectorAll('tr')].map(t => t.innerText.replace(/\s+/g, ' ').trim());
    const fee = rows.filter(x => /Підготовка макета/.test(x))[0] || '';
    const m = /÷ (\d+) шт/.exec(fee);
    return { fee, div: m ? +m[1] : 0,
             sharedList: (typeof window.__lqCartDescriptors === 'function')
               ? window.__lqCartDescriptors().map(d => d.gid) : null };
  });
};
const cOver = await openAs(4);        // Худі оверсайз — друга картка другої групи
const cBase = await openAs(3);        // Худі базове — перша картка тієї ж групи
console.log('  «Худі оверсайз»: ' + cOver.fee);
console.log('  поруч у складі: ' + JSON.stringify(cOver.sharedList));
ok(cOver.div === 10,
  'підготовка макета ділиться на 10 шт — рівно стільки й замовлять',
  'у конструкторі поділ на ' + cOver.div + ' шт: «' + cOver.fee + '»');
ok(cBase.div === 10,
  'і байдуже, яку саме картку групи правлять — число те саме',
  'від вибору картки поділ поїхав: ' + cBase.div);
ok(Array.isArray(cOver.sharedList) && cOver.sharedList.length === 1 &&
   cOver.sharedList[0] === 'tee',
  'поруч стоїть один представник чужої групи, а не обидві її картки',
  'склад конструктора не той: ' + JSON.stringify(cOver.sharedList));
ok(Array.isArray(cOver.sharedList) && cOver.sharedList.indexOf('sweat') < 0,
  'рекомендована в спільний тираж не входить — її ще не обрали',
  'рекомендована потрапила в тираж');

/* ══════════════ СТОРІНКА КЛІЄНТА ══════════════ */
console.log('');
console.log('═══ У КЛІЄНТА ТА САМА ЦІНА ═══');
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E8EDF3"/></svg>');
const vcard = (name, gid, g) => ({
  kind:'variant', vgroup:g, name, color:'Чорний', print:'Вишивка', sizes:'M × 5',
  qty:5, unitPrice:0, price:0, basePrice:0, baseUnitPrice:0,
  mockups:[PH], prints:[], views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:'', desc: desc(gid)
});
const OFFER = {
  token:'tokvar', orderId:'1000056', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'', items:[], reco:[],
  variants:[ vcard('Футболка базова','tee','Група 1'),
             vcard('Футболка оверсайз','teeover','Група 1'),
             vcard('Худі базове','hoodie','Група 2'),
             vcard('Худі оверсайз','hoodieover','Група 2') ]
};
const CVH = path.join(ROOT, '_vfee_cvhost.html');
fs.writeFileSync(CVH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:470px;height:2000px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);
const vp = await browser.newPage({ viewport:{ width:500, height:1000 } });
vp.on('pageerror', e => errs.push('клієнт: ' + e.message.slice(0, 160)));
await route(vp);
await vp.goto(HOST + '/_vfee_cvhost.html', { waitUntil:'domcontentloaded' });
await vp.waitForTimeout(3500);
const vf = vp.frames()[1];
await vf.evaluate(pricing => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pricing;
}, PRICING);
await vp.evaluate(o => window.__prev(o), OFFER);
await vp.waitForTimeout(1800);
/* Читаємо те саме, що читає клієнт: число на картці варіанта. */
const prices = () => vf.evaluate(() =>
  [...document.querySelectorAll('.pcard.is-var .pcard-price')]
    .map(e => +String(e.textContent).replace(/[^\d]/g, '') || 0));
const before = await prices();
// клієнт визначився з футболкою — на ціні худі це відбитись не повинно
await vf.evaluate(() => {
  const b = document.querySelectorAll('[data-vpick]')[1];
  if(b) b.click();
});
await vp.waitForTimeout(1200);
const after = await prices();
try{ fs.unlinkSync(CVH); }catch(e){}

console.log('  до вибору:    ' + before.join(' · ') + ' грн');
console.log('  після вибору: ' + after.join(' · ') + ' грн');
ok(before.length === 4 && before.every(x => x > 0),
  'усі чотири картки показують живу ціну',
  'картки не порахувались: ' + JSON.stringify(before));
ok(before[2] === after[2] && before[3] === after[3],
  'ціна худі не стрибає від того, що клієнт визначився з футболкою',
  'ціна стрибнула: ' + JSON.stringify([before, after]));
ok(before[2] === adm.unit[3] && before[0] === adm.unit[1],
  'і це рівно ті ціни, які записала адмінка — розходження більше немає',
  'клієнт бачить ' + JSON.stringify([before[0], before[2]]) +
  ', у документі ' + JSON.stringify([adm.unit[1], adm.unit[3]]));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'група рахується як одна позиція — і скрізь однаково');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
