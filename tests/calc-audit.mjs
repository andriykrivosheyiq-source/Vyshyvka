/* Звірка розкладу з ціною: чи справді все додається.

   ЧОГО БРАКУВАЛО. «Як склалась ціна» — це пояснення, і люди йому вірять
   більше, ніж підсумку: підсумок просто число, а розклад показує, звідки
   воно. Але ніхто ніколи не перевіряв, що рядки розкладу справді додаються
   в ту саму ціну за штуку, яку рушій поклав у картку. Поки склад простий,
   вони й не розходяться. Розходяться вони на знижці за тираж, на кількох
   видах дизайну, на варіантах і рекомендованих — тобто рівно там, де
   менеджер і починає сумніватись у числі.

   ЩО ПЕРЕВІРЯЄМО, І ЧОМУ САМЕ ЦЕ:
     1. Рядки позиції (крім підсумкових) додаються в «Ціну за штуку».
        Розклад, який не сходиться сам із собою, — це не пояснення, а друга
        версія ціни.
     2. «Ціна за штуку» в розкладі — та сама, що в позиції.
     3. Ціна за штуку × тираж = сума позиції.
     4. Сума основних позицій + ручна поправка = сума замовлення.
        Рекомендовані сюди не входять: клієнт їх ще не обрав.
     5. Разова за дизайн (`feeShare`) = сума часток за видами плюс ескізи.
        Це те саме число, яке потім ділиться на одиниці, і саме воно
        викликало «дуже дивно рахує».

   Прогін іде по багатьох складах одразу: вишивка й DTF, один вид дизайну і
   два, знижка за тираж і без неї, старт і мінімалка нанесення, обробка
   виробу, «за дизайн не беремо», варіанти, рекомендовані, допродаж. Кожен
   склад — окреме замовлення, пораховане тим самим шляхом, що й у картці.

   Запуск:  node tests/calc-audit.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8878;
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

/* Знижка за тираж тут СПРАВЖНЯ — від неї й ламається складання: виріб і
   нанесення множаться на коефіцієнт окремо, а в ціні округлюються разом. */
const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }, { from:10, coef:0.93 }, { from:30, coef:0.87 }],
  garmentTiers: [{ from:1, coef:1 }, { from:10, coef:0.95 }, { from:30, coef:0.9 }],
  methods: {
    embro: { orderFee:700, orderCost:200, sketchFee:350, sketchCost:100,
             pieceFee:0, ratePerMm2:0,
             tiers:[{ from:1, coef:1 }, { from:10, coef:0.93 }, { from:30, coef:0.87 }],
             text:{ orderFee:400, orderCost:120, sketchFee:200, sketchCost:60 } },
    dtf:   { orderFee:900, orderCost:200, sketchFee:300, sketchCost:80,
             tiers:[{ from:1, coef:1 }, { from:10, coef:0.93 }], qtyFrom:[1] }
  }
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

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

const report = await p.evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  contentData.pricing = pr;

  const fp = n => Array.from({ length:144 }, (_, i) => (i * (n + 3)) % 10).join('');
  const FP = [fp(1), fp(2), fp(3)];

  /* Позиція так, як її записує конструктор: опис для рушія + поля картки. */
  const item = (o) => ({
    kind: o.kind || 'main', name: o.name, garmentId: o.gid, color:'Чорний',
    print: o.method === 'dtf' ? 'DTF' : 'Вишивка', sizes:'M × ' + o.qty,
    qty: o.qty, unitPrice:0, price:0, unitCost:0, cost:0,
    mockups:[], prints:[], views:[], sides:[], techniques:[], tiers:[], specs:[], about:'',
    vgroup: o.vgroup || undefined,
    desc: { method: o.method, gid: o.gid, units: o.qty,
            base: o.base, coefPart: o.coefPart,
            basePart: o.basePart || 0, minPart: o.minPart || 0,
            pieceFee: o.pieceFee || 0, bare: !!o.bare, upsell: !!o.upsell,
            designs: (o.kinds || []).map((k, i) => FP[i]),
            designKinds: o.kinds || [],
            designMm2: (o.kinds || []).map(()=> 1200), dtfCols: [] }
  });

  /* Склади підібрані так, щоб кожен вмикав щось своє: коефіцієнт, два види
     разових, ескіз, старт і мінімалку, обробку, варіанти, рекомендовану,
     допродаж, «за дизайн не беремо». */
  const CASES = [
    { n:'один виріб, один логотип', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:1, base:600, coefPart:200, kinds:['img'] }] },
    { n:'знижка за тираж', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:37, base:611, coefPart:207, kinds:['img'] }] },
    { n:'знижка на межі', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:10, base:613, coefPart:203, kinds:['img'] }] },
    { n:'логотип і напис', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:10, base:600, coefPart:200, kinds:['img','txt'] },
      { name:'Футболка', gid:'tee', method:'embro', qty:5, base:400, coefPart:150, kinds:['txt'] }] },
    { n:'два різні логотипи — ескіз', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:12, base:607, coefPart:211, kinds:['img','img'] }] },
    { n:'логотип, напис і вимкнений', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:13, base:609, coefPart:217, kinds:['img','txt','off'] }] },
    { n:'старт і мінімалка нанесення', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:11, base:603, coefPart:209,
        basePart:120, minPart:40, kinds:['img'] }] },
    { n:'обробка виробу', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:14, base:601, coefPart:202,
        pieceFee:45, kinds:['img'] }] },
    { n:'DTF', it:[
      { name:'Футболка', gid:'tee', method:'dtf', qty:31, base:402, coefPart:151, kinds:['img'] }] },
    { n:'DTF і вишивка разом', it:[
      { name:'Футболка', gid:'tee', method:'dtf', qty:21, base:403, coefPart:153, kinds:['img'] },
      { name:'Худі', gid:'hoodie', method:'embro', qty:9, base:606, coefPart:204, kinds:['img'] }] },
    { n:'голий одяг поруч', it:[
      { name:'Кепка', gid:'cap', method:'embro', qty:7, base:300, coefPart:0, bare:true, kinds:[] },
      { name:'Худі', gid:'hoodie', method:'embro', qty:19, base:612, coefPart:206, kinds:['img'] }] },
    { n:'варіанти на вибір', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:10, base:602, coefPart:201, kinds:['img'] },
      { kind:'variant', vgroup:'Г1', name:'Футболка базова', gid:'tee', method:'embro',
        qty:5, base:401, coefPart:152, kinds:['img'] },
      { kind:'variant', vgroup:'Г1', name:'Футболка оверсайз', gid:'teeover', method:'embro',
        qty:5, base:441, coefPart:152, kinds:['img'] }] },
    { n:'рекомендована поруч', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:16, base:604, coefPart:208, kinds:['img'] },
      { kind:'reco', name:'Шопер', gid:'bag', method:'embro', qty:16, base:250, coefPart:140,
        kinds:['img'] }] },
    { n:'допродаж', it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:17, base:605, coefPart:212, kinds:['img'] },
      { name:'Кепка', gid:'cap', method:'embro', qty:4, base:260, coefPart:130,
        upsell:true, kinds:['img'] }] },
    { n:'за дизайн не беремо', noFee:true, it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:23, base:608, coefPart:214, kinds:['img','txt'] }] },
    { n:'ручна поправка до суми', adj:1500, it:[
      { name:'Худі', gid:'hoodie', method:'embro', qty:18, base:610, coefPart:205, kinds:['img'] }] }
  ];

  /* Число з рядка розкладу. Мінус тут типографський («−»), а не дефіс. */
  const num = t => {
    const m = String(t).replace(/−/g, '-').match(/-?\d+/);
    return m ? +m[0] : 0;
  };
  const out = [];
  CASES.forEach((c, ci) => {
    const o = { id:'a' + ci, orderId:'900' + (100 + ci), type:'client', status:'kp',
                site:'main', payments:[], hist:[], createdAt:'2026-09-10T09:00:00.000Z',
                noDesignFee: !!c.noFee, feeAdj: c.adj || 0, feeAdjC: 0,
                items: c.it.map(item) };
    repriceOrder(o);
    recalcOrderTotals(o);

    const box = document.createElement('div');
    box.innerHTML = priceCalcHtml(o) || '';
    const cards = [...box.querySelectorAll('.t-calc-item')];
    const mains = o.items.filter(x => itemKind(x) === 'main' && x.parts);
    const bugs = [];

    if(cards.length !== mains.length)
      bugs.push('карток у розкладі ' + cards.length + ', а позицій ' + mains.length);

    mains.forEach((it, k) => {
      const card = cards[k];
      if(!card) return;
      const rows = [...card.querySelectorAll('.t-calc-row')];
      const parts = rows.filter(r => !r.classList.contains('is-sum') &&
                                     !r.classList.contains('is-note'));
      const sums = rows.filter(r => r.classList.contains('is-sum'));
      const add = parts.reduce((a, r) => a + num(r.querySelector('b').textContent), 0);
      const shown = sums[0] ? num(sums[0].querySelector('b').textContent) : null;
      const shownSum = sums[1] ? num(sums[1].querySelector('b').textContent) : null;
      const name = it.name;
      if(add !== shown)
        bugs.push(name + ': рядки дають ' + add + ' ₴, а «ціна за штуку» ' + shown + ' ₴');
      if(shown !== (+it.unitPrice || 0))
        bugs.push(name + ': у розкладі ' + shown + ' ₴ за штуку, у позиції ' + it.unitPrice + ' ₴');
      if(shownSum !== (+it.price || 0))
        bugs.push(name + ': у розкладі ' + shownSum + ' ₴ за тираж, у позиції ' + it.price + ' ₴');
      if((+it.unitPrice || 0) * (+it.qty || 0) !== (+it.price || 0))
        bugs.push(name + ': ' + it.unitPrice + ' × ' + it.qty + ' ≠ ' + it.price);

      const b = it.parts;
      const fee = (b.feeLines || []).reduce((a, l) => a + l.fee / (l.units || 1), 0) +
                  (b.sketches || []).reduce((a, s) => a + s.fee / (s.units || 1), 0);
      if(Math.round(fee) !== (+b.feeShare || 0))
        bugs.push(name + ': разова за дизайн ' + b.feeShare + ' ₴, а по видах виходить ' +
                  Math.round(fee) + ' ₴');
    });

    const mainSum = mains.reduce((a, x) => a + (+x.price || 0), 0);
    if(mainSum + (+o.feeAdj || 0) !== (+o.totalPrice || 0))
      bugs.push('сума замовлення ' + o.totalPrice + ' ₴, а позиції дають ' +
                mainSum + ' + ' + (+o.feeAdj || 0));

    out.push({ n: c.n, bugs,
               ціни: mains.map(x => x.name + ' ' + x.unitPrice + '×' + x.qty) });
  });
  return out;
}, PRICING);

console.log('═══ РОЗКЛАД ДОДАЄТЬСЯ В ЦІНУ ═══');
report.forEach(r => {
  console.log('  ' + (r.bugs.length ? '✗ ' : '· ') + r.n + '   ' + r.ціни.join(' · '));
  r.bugs.forEach(b => console.log('      → ' + b));
});
const broken = report.filter(r => r.bugs.length);
console.log('');
ok(!broken.length,
  'усі ' + report.length + ' складів сходяться: рядки → ціна за штуку → сума позиції → сума замовлення',
  'не сходиться у складах: ' + broken.map(r => r.n).join(' · '));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'розклад — це пояснення ціни, а не друга її версія');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
