/* Вид дизайну: де перемикач стоїть, чи він переживає збереження і скільки
   макетів виходить із двох логотипів.

   Три речі ламались поспіль і кожна коштувала грошей у рахунку:
   1. перемикач стояв біля «Нанесення», яке рахується за квадратурою, — тобто
      не там, де вид справді міняє гроші;
   2. у картці варіанта прорахунку не було ЗОВСІМ: варіанти малює окрема
      функція, і виклик туди не дійшов, а сам пошук блоку шукав варіант серед
      основних позицій;
   3. вибір менеджера затирався, щойно конструктор перезбирав види з нуля.

   Запуск:  node tests/design-kind.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8791;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const HOST = 'http://127.0.0.1:' + PORT;
const VHOST = path.join(ROOT, '_dk_vhost.html');
fs.writeFileSync(VHOST,
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:1000px;height:1400px}</style>
   <iframe id="f" src="offer.html"></iframe><script>
   window.__prev = o => document.getElementById('f').contentWindow.postMessage(
     { lqEditInit:true, preview:true, offer:o }, '*');</script>`);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
let bad = 0;
const ok = (cond, good, wrong) => { console.log('  ' + (cond ? good + ' ✓' : wrong + ' ✗')); if(!cond) bad++; };
const route = p => p.route('**://**', r => { const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({ contentType:'application/json', body:'{"fields":{}}' });
  return r.abort(); });

// ── Адмінка: збираємо замовлення й формуємо документ так, як це робить редактор ──
const admin = await browser.newPage({ viewport:{ width:1400, height:950 } });
admin.on('pageerror', e => errs.push('АДМІНКА: ' + e.message.slice(0, 170)));
await route(admin);
await admin.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await admin.waitForTimeout(4000);
await admin.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

const SETUP = `
  contentLoaded = true; window.SITE_CONTENT = window.SITE_CONTENT || {};
  /* У написа своя разова, свій ескіз і своя ставка за площу — саме тому вид
     і важить, і саме тому перемикати його треба на рядках разових. */
  window.SITE_CONTENT.pricing = contentData.pricing = {
    methods:{ embro:{ orderFee:900, orderCost:350, sketchFee:390, sketchCost:150,
      pieceFee:20, pieceCost:8, pricePer1000mm2:50, costPer1000mm2:20, minPrice:400,
      text:{ orderFee:400, orderCost:150, sketchFee:150, sketchCost:60,
             pricePer1000mm2:20, costPer1000mm2:8, minPrice:150 } } },
    tiers:[{from:1,coef:1},{from:10,coef:.8}], garmentTiers:[{from:1,coef:1}] };
  window.__A = Array.from({length:144},(_,i)=>(i*1)%5).join('');
  window.__B = Array.from({length:144},(_,i)=>(i*3+1)%5).join('');
  window.__mk = (name, kind, vgroup, designs, mm2) => ({ kind, vgroup:vgroup||'', name,
    qty:10, unitPrice:0, price:0, unitCost:0, cost:0, config:{garmentId:'tee'},
    mockups:[], views:[], prints:[{side:'front',technique:'Вишивка'},{side:'back',technique:'Вишивка'}],
    calc:null, desc:{ method:'embro', units:10, base:630, coefPart:300, basePart:0,
      minPart:0, pieceFee:20, dtfCols:[], designs, designKinds:designs.map(()=>'img'),
      designMm2:mm2, bare:false } });
`;

const built = await admin.evaluate(s => window.eval(s), SETUP + `
  const o = { id:'x', orderId:'1000902', name:'ТОВ Ромашка', items:[
    __mk('Футболка базова','main','',   [__A, __B], [5000, 3000]),  // два РІЗНІ лого
    __mk('Футболка поло','variant','Верх',[__A, __A], [5000, 3000]),// одне й те саме двічі
    __mk('Худі','variant','Верх',        ['', ''],   [5000, 3000]), // відбитки не знялись
    __mk('Кепка','reco','',              [__A],      [2000]) ]};
  orders.length = 0; orders.push(o);
  repriceOrder(o); recalcOrderTotals(o);
  const doc = offerBuild(o);
  doc.mgr = offerMgrCalc(o);   // саме так робить редактор пропозиції
  JSON.stringify(doc);
`);
const offer = JSON.parse(built);

const rowsOf = x => (x && x.rows) || [];
const kindRows = x => rowsOf(x).filter(r => r[3] && r[3].act === 'kind').map(r => r[0]);
const dzRows = x => rowsOf(x).filter(r => /Дизайн №/.test(r[0])).map(r => r[0]);

console.log('═══ ДЕ СТОЇТЬ ПЕРЕМИКАЧ ═══');
[['основна', offer.mgr.items[0]], ['варіант', offer.mgr.vars[0]],
 ['рекомендований', offer.mgr.reco[0]]].forEach(([n, box]) => {
  const k = kindRows(box);
  ok(k.length > 0 && k.every(t => /Підготовка макета|Додатковий ескіз/.test(t)),
    n + ': ' + JSON.stringify(k.map(t => t.split(' —')[0])),
    n + ': перемикач не на разових — ' + JSON.stringify(k));
});
/* Нанесення рахується за квадратурою: вид там нічого не пояснює, і таблетка
   поруч читалась так, ніби вона міняє площу. */
ok(!rowsOf(offer.mgr.items[0]).some(r => /Дизайн №/.test(r[0]) && r[3]),
  'біля рядків «Дизайн №» перемикача немає — там квадратура, а не разові',
  'перемикач лишився біля нанесення');

console.log('');
console.log('═══ ДВА ЛОГОТИПИ — СКІЛЬКИ МАКЕТІВ ═══');
console.log('  два різні: ' + JSON.stringify(kindRows(offer.mgr.items[0]).map(t => t.split(' —')[0])));
dzRows(offer.mgr.vars[0]).forEach(t => console.log('  те саме двічі: ' + t));
dzRows(offer.mgr.vars[1]).forEach(t => console.log('  без відбитків: ' + t));
ok(kindRows(offer.mgr.items[0]).length === 2,
  'два РІЗНІ лого — підготовка макета плюс додатковий ескіз, у кожного свій перемикач',
  'на двох різних лого вийшло ' + kindRows(offer.mgr.items[0]).length + ' разових');
ok(kindRows(offer.mgr.vars[0]).length === 1 &&
   dzRows(offer.mgr.vars[0]).some(t => /той самий малюнок/.test(t)),
  'той самий файл спереду й ззаду — один макет, і рядок каже це словами',
  'однакове лого: ' + JSON.stringify(dzRows(offer.mgr.vars[0])));
ok(dzRows(offer.mgr.vars[1]).some(t => /відбиток не знявся/.test(t)),
  'відбиток не знявся — рядок попереджає, що групу склеєно не за пікселями',
  'про незнятий відбиток нічого не сказано: ' + JSON.stringify(dzRows(offer.mgr.vars[1])));

// ── Очима менеджера: блок має бути в КОЖНІЙ картці, варіанти теж ──
const page = await browser.newPage({ viewport:{ width:1100, height:1000 } });
page.on('pageerror', e => errs.push('ПРОПОЗИЦІЯ: ' + e.message.slice(0, 170)));
await route(page);
await page.goto(HOST + '/_dk_vhost.html', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(3500);
await page.evaluate(o => window.__prev(o), offer);
await page.waitForTimeout(2000);
const fr = page.frames()[1];
const seen = await fr.evaluate(() => {
  document.querySelectorAll('.cc-fold').forEach(f => f.open = true);
  // Рекомендовані малюються своєю карткою (.rc), а не .pcard
  return [...document.querySelectorAll('.pcard, .rc')].map(c => ({
    назва: ((c.querySelector('.pcard-name') || c.querySelector('.rc-n') ||
             c.querySelector('h3, h4') || {}).textContent || '').trim(),
    згорток: c.querySelectorAll('.cc-fold').length,
    перемикачів: c.querySelectorAll('select.cc-kind').length,
    де: [...c.querySelectorAll('select.cc-kind')].map(s =>
      s.closest('.cc-row').querySelector('span').textContent.split(' —')[0].trim())
  }));
});
console.log('');
console.log('═══ ОЧИМА МЕНЕДЖЕРА ═══');
seen.forEach(x => console.log('  ' + x.назва.padEnd(20) + 'згорток: ' + x.згорток +
  '   перемикачів: ' + x.перемикачів + '   ' + JSON.stringify(x.де)));
ok(seen.length >= 4 && seen.every(x => x.згорток === 1),
  'прорахунок є рівно один раз у кожній картці — основній, варіантах і рекомендованій',
  'згортки: ' + JSON.stringify(seen.map(x => [x.назва, x.згорток])));
ok((seen.filter(x => /поло/i.test(x.назва))[0] || {}).перемикачів > 0,
  'у картці варіанта перемикач є — доти прорахунку там не було зовсім',
  'у варіанта перемикача немає');
ok(seen.every(x => x.де.every(t => /Підготовка макета|Додатковий ескіз/.test(t))),
  'усі перемикачі на сторінці стоять на разових',
  'десь перемикач не на разовій: ' + JSON.stringify(seen.map(x => x.де)));

// ── Вибір менеджера має пережити те, що конструктор перезбирає види з нуля ──
console.log('');
console.log('═══ ВИБІР МЕНЕДЖЕРА ═══');
const life = JSON.parse(await admin.evaluate(s => window.eval(s), SETUP + `
  const o = { id:'y', orderId:'1000903', name:'к',
              items:[ __mk('Кепка','main','',[__A],[5000]) ] };
  orders.length = 0; orders.push(o);
  repriceOrder(o); recalcOrderTotals(o);
  const кроки = [];
  const знімок = t => кроки.push({ крок:t, вид:(o.items[0].desc.designKinds||[])[0],
                                   ціна:o.items[0].unitPrice });
  знімок('автоматично — файл-картинка');
  setItemKindFix(o.items[0], __A, 'txt');
  repriceOrder(o); recalcOrderTotals(o);
  знімок('менеджер обрав «напис»');
  o.items[0].desc.designKinds = ['img'];      // конструктор перезбирає види
  repriceOrder(o); recalcOrderTotals(o);
  знімок('позицію відкрили й зберегли наново');
  o.items[0].desc.designs = [__B];            // замінили сам файл дизайну
  o.items[0].desc.designKinds = ['img'];
  repriceOrder(o); recalcOrderTotals(o);
  знімок('замінили файл дизайну');
  JSON.stringify(кроки);
`));
life.forEach(x => console.log('  ' + x.крок.padEnd(34) + 'вид: ' +
  String(x.вид).padEnd(5) + ' ціна: ' + String(x.ціна).padStart(5)));
ok(life[0].вид === 'img', 'спершу автоматика каже «картинка»', 'вийшло ' + life[0].вид);
ok(life[1].вид === 'txt' && life[1].ціна !== life[0].ціна,
  'вибір менеджера перерахував ціну: ' + life[0].ціна + ' → ' + life[1].ціна,
  'ціна не змінилась: ' + life[1].ціна);
ok(life[2].вид === 'txt' && life[2].ціна === life[1].ціна,
  'вибір пережив перезбирання конструктором — саме тут він і губився',
  'після збереження вид повернувся на ' + life[2].вид);
ok(life[3].вид === 'img' && life[3].ціна === life[0].ціна,
  'замінили файл — вид повернувся до автоматичного',
  'після заміни файлу лишилось ' + life[3].вид);

console.log('');
console.log('помилки сторінок:', errs.length);
errs.slice(0, 5).forEach(e => console.log(' ', e));
if(errs.length) bad++;
console.log('');
console.log(bad ? 'є розходження: ' + bad : 'перемикач на місці й робить те, що обіцяє');
try{ fs.unlinkSync(VHOST); }catch(e){}
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
