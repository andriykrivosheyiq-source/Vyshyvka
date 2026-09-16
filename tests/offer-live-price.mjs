/* Ціна в КП рахується тим самим рушієм, що й у конструкторі.

   ЯК ЦЕ ВИГЛЯДАЛО. Клієнт крутить кількість — ціна за штуку стоїть. 10, 11,
   12, 15, 19 — 906 грн. На двадцятій раптом 805. Схоже на те, що поле не
   працює.

   ЩО НАСПРАВДІ. Позиція була позначена «варіант на вибір» і ще не додана в
   замовлення. А `livePrices()` брав у прогін тільки ДОДАНІ позиції — і для
   недоданої повертав нічого. Картка через це падала на запасний шлях:
   заморожені пороги з документа (10/20/50/100/300), які міняють ціну
   сходинками.

   Тобто до натискання «Додати» і після нього працювали ДВА РІЗНІ
   калькулятори. Щойно клієнт додавав позицію, число ще й стрибало: 805 →
   779 на тих самих двадцяти.

   ЯК МАЄ БУТИ. Рушій ділить підготовку макета на всі вироби, тому кожна
   одиниця міняє ціну: 10 → 906, 11 → 895, 12 → 886. Рівно так рахує
   конструктор, і КП має рахувати так само.

   ЯК ВИПРАВЛЕНО. Недодана позиція рахується окремим прогоном «склад + ЦЯ
   позиція» — так само, як варіанти. У спільний прогін вона не входить: інакше
   здешевила б решту замовлення тиражем, якого ніхто не замовляв.

   Перевіряємо:
     — у недоданої позиції ціна міняється з КОЖНОЮ одиницею, а не сходинками;
     — після «Додати до замовлення» число не стрибає;
     — додана й недодана позиції рахуються однаково;
     — недодана позиція не здешевлює решту замовлення.

   Запуск:  node tests/offer-live-price.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8858;
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

/* Модель цін — та сама за структурою, що в бойовій базі: знижка за виріб
   смугами, підготовка макета ділиться на тираж. Саме друге й робить так, що
   кожна одиниця міняє ціну. */
const PRICING = {
  minMarginPct: 0,
  basePrices: { tee: 440 },
  garmentTiers: [
    { from:1, to:null, coef:1 }, { from:10, to:19, coef:0.9 },
    { from:20, to:49, coef:0.85 }, { from:50, to:99, coef:0.8 }
  ],
  tiers: [{ from:1, to:null, coef:1 }],
  methods: {
    embro: { orderFee: 1500, orderCost: 300, sketchFee: 600, sketchCost: 100,
             pieceFee: 75, tiers: [{ from:1, to:null, coef:1 }] },
    dtf:   { orderFee: 900, orderCost: 200, sketchFee: 300, sketchCost: 80,
             pieceFee: 40, tiers: [{ from:1, to:null, coef:1 }], qtyFrom: [1,10,20,50] }
  }
};
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E8EDF3"/></svg>');
const desc = () => ({ method:'embro', gid:'tee', units:10, base:440, basePart:150,
                      coefPart:370, minPart:23, pieceFee:75, bare:false,
                      designKinds:['img'], designMm2:[1352], designs:['4444'], dtfCols:[] });
const item = (name, extra) => Object.assign({
  kind:'main', name, color:'Чорний', print:'Вишивка', sizes:'M × 10',
  qty:10, unitPrice:906, price:9060, basePrice:11300, baseUnitPrice:1130,
  mockups:[PH], prints:[], views:[{ side:'front', label:'Перед', img:PH, show:true }],
  sides:[], techniques:['Вишивка'], specs:[], about:'',
  /* Пороги в документі — саме той запасний шлях, на який падала картка.
     Вони навмисно інші за живу ціну: якби сторінка знову взяла їх, це буде
     видно одразу. */
  tiers:[{ qty:10, unit:906, sum:9060, now:true }, { qty:20, unit:805, sum:16100 },
         { qty:50, unit:736, sum:36800 }],
  desc: desc()
}, extra || {});

const OFFER = {
  token:'toklive123', orderId:'1002600', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%',
          validUntil:new Date(Date.now() + 6 * 864e5).toISOString() },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'created',
  totals:{ qty:10, base:11300, save:2240, total:9060 },
  /* Перша позиція — «варіант на вибір»: саме на такій і спливла помилка. */
  items:[ item('Футболка базова', { optional:true }) ]
};

function toFs(v){
  if(v === null || v === undefined) return { nullValue:null };
  if(typeof v === 'string') return { stringValue:v };
  if(typeof v === 'boolean') return { booleanValue:v };
  if(typeof v === 'number')
    return Number.isInteger(v) ? { integerValue:String(v) } : { doubleValue:v };
  if(Array.isArray(v)) return { arrayValue:{ values:v.map(toFs) } };
  const f = {};
  Object.keys(v).forEach(k => { f[k] = toFs(v[k]); });
  return { mapValue:{ fields:f } };
}

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__OFFER=' + JSON.stringify(OFFER) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
/* Сторінка читає пропозицію і підпискою, і разовим запитом (запасний шлях
   на випадок, коли підписка не долетіла). Заглушка має вміти обидва. */
fbstub = fbstub.replace(
  "Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ return Promise.resolve(new Snap(this.__id||'x',\n" +
  "    this.__col==='offers' ? window.__OFFER : null)); };");
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null;\n" +
  "    if(this.__col==='offers') d=window.__OFFER;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:470, height:1100 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(/firestore\.googleapis\.com/.test(u)){
    if(/offers/.test(u))
      return r.fulfill({ contentType:'application/json',
                         body:JSON.stringify({ fields: toFs(OFFER).mapValue.fields }) });
    return r.fulfill({ contentType:'application/json',
                       body:JSON.stringify({ fields:{ pricing: toFs(PRICING) } }) });
  }
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/offer.html?o=toklive123', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);

const unitNow = () => p.evaluate(() => {
  const t = (document.querySelector('.pcard-price') || {}).textContent || '';
  return +String(t).replace(/[^\d]/g, '') || 0;
});
const qtyNow = () => p.evaluate(() =>
  +((document.querySelector('.pstep-v b') || {}).textContent || 0));
async function plus(n){
  for(let k = 0; k < n; k++){
    const h = await p.$('.pstep-b.plus');
    await h.scrollIntoViewIfNeeded();
    await h.click();
    await p.waitForTimeout(260);
  }
  await p.waitForTimeout(500);
}

const boot = await p.evaluate(() => ({
  steps: document.querySelectorAll('.pstep-b.plus').length,
  cards: document.querySelectorAll('.pcard-price').length,
  err: ((document.querySelector('.fail, .err') || {}).textContent || '').slice(0, 120),
  body: document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 160)
}));
if(!boot.steps){ console.log('  сторінка не зібралась: ' + JSON.stringify(boot)); bad++; }

console.log('═══ КОЖНА ОДИНИЦЯ МІНЯЄ ЦІНУ ═══');
if(!boot.steps){
  console.log('  пропускаємо — нема чого крутити');
} else {
const seq = [];
seq.push({ q: await qtyNow(), u: await unitNow() });
for(let k = 0; k < 4; k++){ await plus(1); seq.push({ q: await qtyNow(), u: await unitNow() }); }
seq.forEach(x => console.log('  ' + x.q + ' шт → ' + x.u + ' грн/шт'));
const uniq = [...new Set(seq.map(x => x.u))];
ok(uniq.length === seq.length,
  'ціна змінилась на кожному кроці — підготовка макета ділиться на тираж',
  'ціна стоїть на місці: ' + JSON.stringify(seq.map(x => x.u)));
ok(seq.every((x, i) => i === 0 || x.u < seq[i - 1].u),
  'і саме дешевшає, а не стрибає туди-сюди',
  'ціна поводиться дивно: ' + JSON.stringify(seq.map(x => x.u)));
ok(!seq.slice(1).some(x => x.u === 906),
  'це вже не заморожені пороги з документа — вони дали б 906 аж до двадцяти',
  'картка знову рахує за порогами документа');

}

console.log('');
console.log('═══ ПІСЛЯ «ДОДАТИ» ЧИСЛО НЕ СТРИБАЄ ═══');
if(boot.steps){
/* Головне, заради чого все й робилось: до натискання й після нього має
   працювати ОДИН калькулятор, а не два. */
const before = await unitNow();
await p.evaluate(() => { const b = document.querySelector('.pbuy'); if(b) b.click(); });
await p.waitForTimeout(900);
const after = await unitNow();
console.log('  до: ' + before + ' → після: ' + after);
ok(before === after,
  'ціна до додавання й після — одна й та сама',
  'при додаванні число стрибнуло: ' + before + ' → ' + after);

}

console.log('');
console.log('═══ НЕДОДАНА ПОЗИЦІЯ НЕ ЗДЕШЕВЛЮЄ ЗАМОВЛЕННЯ ═══');
if(boot.steps){
/* Порахувати її в спільному прогоні означало б дати знижку за тираж, якого
   ніхто не замовляв, — і решта позицій подешевшала б без причини. */
const total = await p.evaluate(() => {
  const el = [...document.querySelectorAll('.est-line, .est-total')]
    .map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ');
  return el;
});
console.log('  ' + total.slice(0, 120));
ok(await qtyNow() > 10,
  'кількість збереглась після додавання',
  'кількість скинулась при додаванні');

}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'КП рахує ціну тим самим рушієм, що й конструктор');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
