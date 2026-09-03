/* ЗАМОК ЗНИЖОК.
   Фіксоване замовлення з фіксованою моделлю цін і ТОЧНІ очікувані числа.
   Будь-яка правка, що зрушить хоч одну ціну, «було» чи відсоток, валить цей
   тест — і зрушення видно одразу, а не через тиждень у чужому КП.
   Якщо число змінилось НАВМИСНО — міняємо еталон тут, свідомо. */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
/* Шлях до playwright і до браузера — через змінні оточення, щоб тест не був
   прибитий до однієї машини. Запуск:  node tests/discount-lock.mjs  */
const { chromium } = await import(
  process.env.LQ_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const SP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SP, '..');
const fbstub = fs.readFileSync(SP + '/fbstub.js', 'utf8');

/* Свій сервер на вільному порту: тест має запускатись однією командою, без
   «спершу підніми сервер» — інакше він не запускається саме тоді, коли
   найпотрібніший. */
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
               '.css':'text/css; charset=utf-8', '.json':'application/json' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(String(req.url).split('?')[0]).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel || 'index.html');
  if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const PORT = srv.address().port;

// ── ЕТАЛОН ─────────────────────────────────────────────────────────────
// виріб + нанесення + за штуку + повна разова = «було»
//   Футболка базова : 540 + 260 + 20 + 900 = 1720
//   Поло (варіант)  : 690 + 260 + 20 + 900 = 1870
//   Оверсайз        : 620 + 260 + 20 + 900 = 1800
//   Кепка (реко)    : 630 + 200 + 20 + 900 = 1750
/* Еталон переписаний свідомо: виріб більше не дисконтується шкалою способу
   нанесення, він іде за СВОЄЮ шкалою (`garmentTiers`, а якщо в товару є
   власна — то за нею). У цій моделі шкала виробу дає знижку лише від 10 шт,
   а в замовленні їх 5 — отже, сам одяг тут не дисконтується взагалі.

   На прикладі базової футболки:
     було : round(540×0.85 + 260×0.85) + 20 + 900/5 = 459+221 → 680 + 20 + 180 = 880
     стало: round(540×1.00 + 260×0.85) + 20 + 900/5 = 540+221 → 761 + 20 + 180 = 961

   Це і є вся суть зміни: перемикання DTF↔вишивка більше не міняє ціну самої
   футболки, бо футболка куплена за ті самі гроші. */
const ЕТАЛОН = [
  { назва:'Футболка базова', сегмент:'склад',    ціна:961, було:1720, знижка:44 },
  /* Варіант і рекомендована рахуються як «склад + ЦЕЙ», тож у них тираж 10 і
     коефіцієнт нанесення 0.81, а макет ділиться на 10. Базова йде в складі
     сама — тираж 5, коефіцієнт 0.85, макет на 5. Виріб у всіх іде за своєю
     шкалою, тож дорожчий виріб більше не «з'їдається» знижкою способу — і
     поло з базовою перестали випадково збігатись. */
  { назва:'Футболка поло',   сегмент:'варіант',  ціна:1011, було:1870, знижка:46 },
  { назва:'Футболка оверсайз', сегмент:'варіант',ціна:941, було:1800, знижка:48 },
  { назва:'Кепка',           сегмент:'реко',     ціна:902, було:1750, знижка:48 }
];

const b = await chromium.launch({ executablePath: process.env.LQ_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:1400,height:950} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,150)));
await p.route('**://**', r=>{ const u=r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
  if(u.startsWith('http://127.0.0.1')) return r.continue();
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({contentType:'application/json', body:'{"fields":{}}'});
  return r.abort(); });
await p.goto('http://127.0.0.1:' + PORT + '/loomiqadmin.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
await p.evaluate(()=>{ const g=document.getElementById('auth-gate'); if(g) g.style.display='none'; });

const out = await p.evaluate(()=>window.eval(`
  contentLoaded = true; window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = contentData.pricing = {
    methods:{ embro:{ orderFee:900, orderCost:350, sketchFee:390, sketchCost:150,
                      pieceFee:20, pieceCost:8 } },
    tiers:[ {from:1,coef:1},{from:3,coef:0.85},{from:10,coef:0.81},{from:30,coef:0.78} ],
    garmentTiers:[ {from:1,coef:1},{from:10,coef:0.92} ] };
  const FP = Array.from({length:144},(_,i)=>(i*1)%5).join('');
  const mk = (name, kind, vgroup, base, app) => ({ kind, vgroup:vgroup||'', name, qty:5,
    unitPrice:0, price:0, unitCost:0, cost:0, config:{garmentId:'tee'},
    mockups:[], views:[], prints:[{side:'front',technique:'Вишивка'}], calc:null,
    desc:{ method:'embro', units:5, base:base, coefPart:app, pieceFee:20, dtfCols:[],
           designs:[FP], designKinds:['img'], bare:false } });
  const o = { id:'lock', orderId:'1000200', name:'клієнт', items:[
    mk('Футболка базова','main','',540,260),
    mk('Футболка поло','variant','Верх',690,260),
    mk('Футболка оверсайз','variant','Верх',620,260),
    mk('Кепка','reco','',630,200) ]};
  orders.length = 0; orders.push(o);
  repriceOrder(o); recalcOrderTotals(o);
  const off = offerBuild(o);
  const seg = x => x.kind === 'variant' ? 'варіант' : (x.kind === 'reco' ? 'реко' : 'склад');
  const rows = [].concat(off.items, off.variants, off.reco).map(x => ({
    назва:x.name, сегмент:seg(x), ціна:x.unitPrice, було:x.baseUnitPrice,
    знижка: x.basePrice > x.price ? Math.round((1 - x.price/x.basePrice)*100) : 0 }));
  // друге читання БЕЗ перерахунку: «було» має лишитись тим самим числом
  const again = [].concat(offerBuild(o).items, offerBuild(o).variants, offerBuild(o).reco)
    .map(x => x.baseUnitPrice);
  // і з викинутим розкладом теж — бо число записане в позиції
  o.items.forEach(function(it){ it.desc = null; it.parts = null; });
  const без = [].concat(offerBuild(o).items, offerBuild(o).variants, offerBuild(o).reco)
    .map(x => x.baseUnitPrice);
  JSON.stringify({ rows: rows, again: again, без: без });
`));
const r = JSON.parse(out);
const pad=(s,n)=>String(s).padEnd(n), num=(s,n)=>String(s).padStart(n);
console.log('═══ ЗАМОК ЗНИЖОК ═══');
console.log(pad('позиція',20) + pad('сегмент',10) + num('ціна',6) + num('було',7) +
            num('знижка',8) + '   еталон');
let bad = 0;
ЕТАЛОН.forEach(e=>{
  const a = r.rows.filter(x=>x.назва === e.назва)[0];
  const same = a && a.ціна === e.ціна && a.було === e.було && a.знижка === e.знижка;
  if(!same) bad++;
  console.log(pad(e.назва,20) + pad(e.сегмент,10) +
    num(a ? a.ціна : '—',6) + num(a ? a.було : '—',7) + num((a ? a.знижка : '—')+'%',8) +
    '   ' + (same ? 'збіг ✓' : ('чекали ' + e.ціна + ' / ' + e.було + ' / ' + e.знижка + '% ✗')));
});
console.log('');
const ok=(c,g,b2)=>{ console.log(c ? g+' ✓' : b2+' ✗'); if(!c) bad++; };
ok(r.rows.length === ЕТАЛОН.length, 'позицій рівно ' + ЕТАЛОН.length,
   'позицій ' + r.rows.length + ', а не ' + ЕТАЛОН.length);
ok(JSON.stringify(r.again) === JSON.stringify(r.rows.map(x=>x.було)),
   'повторне складання пропозиції дає ТІ САМІ числа', 'числа поїхали між складаннями');
ok(JSON.stringify(r.без) === JSON.stringify(r.rows.map(x=>x.було)),
   'початкова ціна пережила втрату розкладу — вона записана в позиції',
   'без розкладу «було» змінилось: ' + JSON.stringify(r.без));
console.log('');
console.log(bad ? ('ЗАМОК ЗЛАМАНО: розбіжностей ' + bad) : 'замок цілий — усі числа на місці');
console.log('помилки:', errs.length); errs.slice(0,4).forEach(e=>console.log(' ', e));
await b.close();
srv.close();
process.exit(bad ? 1 : 0);
