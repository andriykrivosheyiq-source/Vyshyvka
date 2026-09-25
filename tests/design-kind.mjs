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
console.log('═══ ОДИН ДИЗАЙН — ОДНЕ РІШЕННЯ НА ВСЕ ЗАМОВЛЕННЯ ═══');
/* Склад із життя: чотири позиції, спільний зад, два різні переди, а на
   передах той самий напис двічі. Разова підготовка макета належить
   ДИЗАЙНУ — вона одна на малюнок, скільки б виробів його не несли.

   Доти рішення «як рахувати» жило на позиції, і це давало два баги, які на
   око виглядали як «числа стрибають самі по собі»:

     — вимикаєш зад на одній позиції, а решта ТРИ дорожчають: разова
       лишається в рахунку, але ділиться вже не на сорок штук, а на
       тридцять;
     — вимикаєш один із двох однакових написів, а ціна не рухається зовсім:
       друга копія платить повну разову. */
const many = JSON.parse(await admin.evaluate(s => window.eval(s), SETUP + `
  window.__C = Array.from({length:144},(_,i)=>(i*7+2)%5).join('');
  const o = { id:'z', orderId:'1000057', name:'к', items:[
    __mk('Худі оверсайз','main','',    [__A, __A, __C], [5000,5000,4000]),
    __mk('Худі базове','main','',      [__A, __A, __C], [5000,5000,4000]),
    __mk('Худі оверсайз 2','main','',  [__A, __A, __B, __C], [5000,5000,3000,4000]),
    __mk('Худі базове 2','main','',    [__A, __A, __B, __C], [5000,5000,3000,4000]) ]};
  orders.length = 0; orders.push(o);
  repriceOrder(o); recalcOrderTotals(o);
  const ціни = () => o.items.map(x => x.unitPrice);
  const види = () => o.items.map(x => (x.desc.designKinds||[]).join(','));
  const було = ціни();
  // менеджер ставить «не рахувати» на ЗАД — у першій позиції
  setItemKindFix(o.items[0], __C, 'off', o);
  repriceOrder(o); recalcOrderTotals(o);
  const післяЗаду = ціни(), видиЗаду = види();
  // і окремо — на напис, який стоїть двічі
  setItemKindFix(o.items[0], __C, null, o);
  setItemKindFix(o.items[0], __A, 'off', o);
  repriceOrder(o); recalcOrderTotals(o);
  JSON.stringify({ було, післяЗаду, видиЗаду, післяНапису: ціни(), видиНапису: види() });
`));
console.log('   як є:             ' + many.було.join(' · '));
console.log('   зад → не рахувати: ' + many.післяЗаду.join(' · '));
console.log('   напис → не рахувати: ' + many.післяНапису.join(' · '));
ok(many.післяЗаду.every((v, i) => v <= many.було[i]),
  'вимкнули дизайн — жодна позиція не подорожчала: малюнок один, роботу зробили один раз',
  'сусідні позиції подорожчали: ' + many.було.join(' · ') + ' → ' + many.післяЗаду.join(' · '));
ok(many.видиЗаду.every(v => v.split(',').pop() === 'off'),
  'рішення розійшлось по ВСІХ позиціях, де стоїть цей самий зад',
  'вид лишився різним по позиціях: ' + JSON.stringify(many.видиЗаду));
ok(many.післяНапису[0] < many.було[0],
  'вимкнули напис, що стоїть двічі, — ціна змінилась: доти клік не робив нічого, ' +
    'бо друга копія платила повну разову',
  'ціна не зрушила: ' + many.було[0] + ' → ' + many.післяНапису[0]);
ok(many.видиНапису.every(v => { const a = v.split(','); return a[0] === 'off' && a[1] === 'off'; }),
  'обидві копії того самого напису вимкнулись разом — це один дизайн, а не два',
  'друга копія лишилась платною: ' + JSON.stringify(many.видиНапису));

// ── Прорахунок у самій картці товару (конструктор) ──────────────────────
/* Це ІНШИЙ блок, ніж вище: менеджер найчастіше сидить саме тут, у відкритій
   картці, а не в пропозиції. Доти перемикача тут не було зовсім, і рядок
   «Підготовка макета» нічим не пояснював, чому два логотипи дали один макет. */
console.log('');
console.log('═══ ПРОРАХУНОК У КАРТЦІ ТОВАРУ ═══');
const ctor = await browser.newPage({ viewport:{ width:1300, height:1000 } });
ctor.on('pageerror', e => errs.push('КОНСТРУКТОР: ' + e.message.slice(0, 170)));
await route(ctor);
await ctor.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await ctor.waitForTimeout(5000);
await ctor.evaluate(() => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = {
    methods:{ embro:{ orderFee:800, orderCost:300, sketchFee:390, sketchCost:150,
      pieceFee:75, pieceCost:34, pricePer1000mm2:34, costPer1000mm2:7, minPrice:400,
      text:{ orderFee:400, orderCost:150, sketchFee:150, sketchCost:60,
             pricePer1000mm2:20, costPer1000mm2:5, minPrice:150 } } },
    tiers:[{from:1,coef:1},{from:4,coef:.94},{from:10,coef:.8}],
    garmentTiers:[{from:1,coef:1}] };
});
const gid = await ctor.evaluate(() => {
  const el = document.querySelector('[data-garment]');
  return el ? el.getAttribute('data-garment') : null;
});
const FP_A = Array.from({length:64},(_,i)=>(i*1)%5).join('');
const FP_B = Array.from({length:64},(_,i)=>(i*3+1)%5).join('');
const layer = (id, fp) => ({ id, url:'https://cdn.test/' + id + '.png', fp,
  scale:1, frac:0.32, fx:0.3, fy:0.3, ar:1, fill:0.8,
  opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 });
// Той самий шлях, яким позицію відкриває редактор пропозиції
const seed = async (fpFront, fpBack) => {
  await ctor.evaluate(cfg => window.__editProduct(cfg, null, []), {
    garmentId: gid, colorId:null, printId:null, qty:{ M:4 },
    logos:{ front:[layer('L1', fpFront)], back:[layer('L2', fpBack)], left:[], right:[] } });
  await ctor.waitForTimeout(1600);
};
const panel = () => ctor.evaluate(() => {
  const box = document.getElementById('pmMgrCalc');
  if(!box) return { рядки:['(панелі немає)'], перемикачів:0, ціна:'' };
  return {
    рядки: [...box.querySelectorAll('tr')].map(t => t.innerText.replace(/\s+/g,' ').trim()),
    перемикачів: box.querySelectorAll('[data-mgr-kind]').length,
    ціна: (document.querySelector('.pm-num') || {}).textContent || '' };
});

await seed(FP_A, FP_B);                     // два РІЗНІ логотипи
let c = await panel();
c.рядки.filter(x => /макет|ескіз|нанесення ·/.test(x)).forEach(x => console.log('  ' + x));
ok(c.рядки.some(x => /Підготовка макета/.test(x)) && c.рядки.some(x => /Додатковий ескіз/.test(x)),
  'два різні лого — підготовка макета плюс додатковий ескіз',
  'на двох різних лого ескізу немає');
ok(c.перемикачів === 2, 'перемикач стоїть на обох разових рядках',
  'перемикачів у картці: ' + c.перемикачів);

await seed(FP_A, FP_A);                     // ОДИН і той самий файл спереду й ззаду
c = await panel();
console.log('');
c.рядки.filter(x => /макет|ескіз|нанесення ·/.test(x)).forEach(x => console.log('  ' + x));
const цінаКартинка = c.ціна;
ok(!c.рядки.some(x => /Додатковий ескіз/.test(x)),
  'той самий файл спереду й ззаду — один макет, ескізу немає',
  'на однаковому файлі зʼявився ескіз');
ok(c.рядки.some(x => /2 нанесення · 1 макет/.test(x)),
  'рядок каже причину вголос, а не лишає здогадуватись',
  'пояснення «2 нанесення · 1 макет» немає');

// Обидва дизайни — написом: разова має стати дешевшою, а не подвоїтись
/* По одному: панель перемальовується після кожної зміни, тож посилання на
   решту перемикачів стають несправжніми — саме так помилився б і менеджер,
   який клікає швидко, якби ми оновлювали таблицю мовчки. */
for(let n = 0; n < 4; n++){
  const left = await ctor.evaluate(() => {
    const s = [...document.querySelectorAll('#pmMgrCalc [data-mgr-kind]')]
      .filter(x => x.value !== 'txt')[0];
    if(!s) return 0;
    s.value = 'txt'; s.dispatchEvent(new Event('change', { bubbles:true }));
    return 1;
  });
  await ctor.waitForTimeout(700);
  if(!left) break;
}
c = await panel();
console.log('');
c.рядки.filter(x => /макет|ескіз/.test(x)).forEach(x => console.log('  ' + x));
console.log('  ціна: ' + цінаКартинка + ' → ' + c.ціна);
ok(c.рядки.some(x => /400 грн ÷/.test(x)) && !c.рядки.some(x => /800 грн ÷/.test(x)),
  'обидва написом — разова за ставкою напису, а не картинки',
  'разова лишилась картинчаною: ' + JSON.stringify(c.рядки.filter(x => /Підготовка/.test(x))));
ok(+c.ціна < +цінаКартинка,
  'ціна впала: ' + цінаКартинка + ' → ' + c.ціна,
  'ціна не впала: ' + цінаКартинка + ' → ' + c.ціна);
// Вибір лежить на шарі, тож переживе збереження позиції разом із config.logos
const наШарі = await ctor.evaluate(() => {
  const s = document.querySelector('#pmMgrCalc [data-mgr-kind]');
  return s ? s.value : '(немає)';
});
ok(наШарі === 'txt', 'перемикач лишився на «напис» після перерахунку',
  'перемикач зіскочив на ' + наШарі);

// ── Позиція без відбитків: два файли мусять лишитись двома макетами ──────
/* Найдорожча тиха помилка: у позиції, збереженої до появи відбитків (або поки
   картинка не домалювалась), designs порожні. Рушій вважає такий дизайн
   невідомим і чіпляє до першої групи — на екрані два логотипи, а разова одна,
   і замовлення недорахувало ескіз. */
console.log('');
console.log('═══ ПОЗИЦІЯ БЕЗ ВІДБИТКІВ ═══');
await seed('', '');            // жодного відбитка, але файли РІЗНІ
c = await panel();
c.рядки.filter(x => /макет|ескіз|нанесення ·/.test(x)).forEach(x => console.log('  ' + x));
ok(c.рядки.some(x => /Додатковий ескіз/.test(x)),
  'два різні файли без відбитків усе одно дають два макети',
  'без відбитків два файли злиплись в один макет');
// той самий файл двічі — і тоді макет справді один
await ctor.evaluate(cfg => window.__editProduct(cfg, null, []), {
  garmentId: gid, colorId:null, printId:null, qty:{ M:4 },
  logos:{ front:[{ id:'S1', url:'https://cdn.test/same.png', scale:1, frac:0.32,
                   fx:0.3, fy:0.3, ar:1, fill:0.8, opaqueBox:{x0:0,y0:0,x1:1,y1:1} }],
          back: [{ id:'S2', url:'https://cdn.test/same.png', scale:1, frac:0.32,
                   fx:0.3, fy:0.3, ar:1, fill:0.8, opaqueBox:{x0:0,y0:0,x1:1,y1:1} }],
          left:[], right:[] } });
await ctor.waitForTimeout(1600);
c = await panel();
console.log('');
c.рядки.filter(x => /макет|ескіз|нанесення ·/.test(x)).forEach(x => console.log('  ' + x));
ok(!c.рядки.some(x => /Додатковий ескіз/.test(x)),
  'той самий файл двічі — макет один, як і має бути',
  'на однаковому файлі зʼявився зайвий ескіз');

// ── Те саме з боку адмінки: старе замовлення лікується без жодної кнопки ──
console.log('');
console.log('═══ СТАРЕ ЗАМОВЛЕННЯ В АДМІНЦІ ═══');
const heal = JSON.parse(await admin.evaluate(s2 => window.eval(s2), SETUP + `
  const mk2 = (designs, files) => ({ kind:'main', name:'Футболка', qty:4,
    unitPrice:0, price:0, unitCost:0, cost:0, config:{garmentId:'tee'},
    mockups:[], views:[], calc:null,
    prints: files.map(f => ({ side:'front', technique:'Вишивка', file:f })),
    desc:{ method:'embro', units:4, base:630, coefPart:300, basePart:0, minPart:0,
           pieceFee:20, dtfCols:[], designs, designKinds:designs.map(()=>'img'),
           designMm2:[5000, 3000], bare:false } });
  const роб = (designs, files) => {
    const o = { id:'h', orderId:'1', name:'к', items:[ mk2(designs, files) ] };
    orders.length = 0; orders.push(o);
    repriceOrder(o); recalcOrderTotals(o);
    const c2 = offerMgrCalc(o).items[0];
    return { ескізів: (c2.rows||[]).filter(r=>/Додатковий ескіз/.test(r[0])).length,
             ціна: o.items[0].unitPrice };
  };
  JSON.stringify({
    різніФайли: роб(['',''], ['https://cdn.test/a.png','https://cdn.test/b.png']),
    тойСамийФайл: роб(['',''], ['https://cdn.test/a.png','https://cdn.test/a.png']),
    файлівНемає: роб(['',''], [{}, {}].map(()=>null)) });
`));
console.log('  різні файли:      ' + JSON.stringify(heal.різніФайли));
console.log('  той самий файл:   ' + JSON.stringify(heal.тойСамийФайл));
console.log('  файлів немає:     ' + JSON.stringify(heal.файлівНемає));
ok(heal.різніФайли.ескізів === 1,
  'старе замовлення з двома різними файлами саме отримало другий макет',
  'ескізів: ' + heal.різніФайли.ескізів);
ok(heal.тойСамийФайл.ескізів === 0,
  'той самий файл двічі — жодного зайвого ескізу',
  'зайвий ескіз на однаковому файлі');
ok(heal.файлівНемає.ескізів === 0,
  'коли й файлів немає — нічого не вигадуємо',
  'вигадали ескіз там, де немає навіть файлу');
ok(heal.різніФайли.ціна > heal.тойСамийФайл.ціна,
  'другий макет справді додає грошей: ' + heal.тойСамийФайл.ціна + ' → ' + heal.різніФайли.ціна,
  'ціна не змінилась: ' + JSON.stringify(heal));

console.log('');
console.log('═══ ВІДМОВА ГОВОРИТЬ УГОЛОС ═══');
/* Андрій: у рекомендованих перемикаю вид дизайну, зберігаю — «воно заново
   обновляється, і ціна залишається та сама». Жодного повідомлення при
   цьому не було.

   Половина виходів із обробника була мовчазна: екран перемальовувався зі
   старого стану, і виглядало це як «зберіг, а воно повернулось». Причина
   може бути різна — позиція без розкладу, дизайн не знайшовся, запобіжник
   маржі відкотив збереження, — але мовчання не відповідь на жодну з них. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const h = adm.slice(adm.indexOf("if(act === 'designKind')"),
                      adm.indexOf("const WORD = { txt:'НАПИС'"));
  const німі = (h.match(/^\s*(?:if\([^)]*\)\s*)?return;\s*$/gm) || []).length;
  const голосні = (h.match(/toast\(/g) || []).length;
  console.log('   мовчазних виходів: ' + німі + ' · пояснень: ' + голосні);
  ok(голосні >= 4,
    'кожна причина відмови названа словами — менеджер не гадає, чому перемикач «не працює»',
    'відмови досі мовчазні: пояснень ' + голосні);
  ok(/Вид дизайну не зберігся/.test(h),
    'навіть невдале збереження каже про себе — а воно буває буденним, від запобіжника маржі',
    'невдале збереження мовчить');
}

console.log('');
console.log('═══ У РЯДКУ ВИДНО, ПРО ЯКИЙ ДИЗАЙН ІДЕТЬСЯ ═══');
/* На позиції дизайнів буває два, і обирати між «картинкою» й «написом»
   доводилось, тримаючи в голові, котрий із них перший. Саме тут і
   плуталось: напис клієнта позначали картинкою, бо не бачили, що це напис. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const off = fs.readFileSync(path.join(ROOT, 'offer.html'), 'utf8');
  ok(/function designPic\(o, fp\)/.test(adm) && /pic: designPic\(o,/.test(adm),
    'у рядок прорахунку їде сам малюнок — за відбитком дизайну',
    'малюнок у рядок не потрапляє');
  /* Шукаємо по всьому замовленню: той самий дизайн стоїть на кількох
     виробах, і в тій позиції, де рядок малюється, шару може вже й не бути. */
  const fn = adm.slice(adm.indexOf('function designPic'), adm.indexOf('function setItemKindFix'));
  ok(/\(o && o\.items\) \|\| \[\]/.test(fn),
    'шукаємо його по всьому замовленню, а не в одній позиції',
    'малюнок шукається лише в своїй позиції');
  ok(/cc-kind-pic/.test(off) && /\.cc-kind-pic\{/.test(off),
    'і малюється маленьким квадратом поруч із перемикачем',
    'на сторінці пропозиції малюнка в рядку немає');
}

console.log('');
console.log('помилки сторінок:', errs.length);
errs.slice(0, 5).forEach(e => console.log(' ', e));
if(errs.length) bad++;
console.log('');
console.log('═══ РАЗОВА КАРТИНКИ Й РАЗОВА НАПИСУ — ОКРЕМІ РЯДКИ ═══');
/* Андрій: «як формується оплата за дизайни в кожній одиниці, дуже дивно і
   щось поломалось».

   У розкладі стояв ОДИН рядок: «Підготовка макета · feeTotal ₴ на feeUnits
   шт». `feeTotal` складав разові ВСІХ видів — і картинки, і напису, — а
   `feeUnits` при цьому не складався, а ПЕРЕЗАПИСУВАВСЯ останнім видом.

   Поки на позиції один вид, різниці немає. А щойно на виробі й логотип, і
   напис — число ставало вигаданим: «1100 ₴ на 5 шт», хоч 1100 ÷ 5 = 220, а
   в рядку стояло 150. Ціна рахувалась чесно, по кожному виду окремо; брехав
   саме підпис — і не сходився сам із собою. */
{
  const розклад = await admin.evaluate(s => window.eval(s), SETUP + `
    const mk = (name, units, designs, kinds, mm2) => Object.assign(
      __mk(name, 'main', '', designs, mm2),
      { qty:units, desc: Object.assign(__mk(name,'main','',designs,mm2).desc,
        { units, designs, designKinds:kinds, designMm2:mm2 }) });
    /* Позиція A несе і логотип, і напис; позиція B — тільки логотип.
       Отже разова картинки ділиться на 10 шт, разова напису — на 5. */
    const o = { id:'f', orderId:'1000057', name:'Проба', items:[
      mk('Футболка', 5, ['LOGO','TEXT'], ['img','txt'], [4000, 2000]),
      mk('Худі',     5, ['LOGO'],        ['img'],        [4000]) ]};
    orders.length = 0; orders.push(o);
    repriceOrder(o); recalcOrderTotals(o);
    const html = priceCalcHtml(o);
    const b = o.items[0].parts || {};
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const it0 = doc.querySelector('.t-calc-item');
    const rows = it0 ? [...it0.querySelectorAll('.t-calc-row')] : [];
    JSON.stringify({
      feeTotal:b.feeTotal, feeUnits:b.feeUnits, feeShare:b.feeShare,
      разові:(b.feeLines || []).map(f => f.kind + ':' + f.fee + '/' + f.units),
      рядки:rows.filter(r => /Підготовка макета/.test(r.querySelector('span').textContent))
                .map(r => r.querySelector('span').textContent + ' → ' + r.querySelector('b').textContent)
    });
  `).then(JSON.parse);
  console.log('   ' + JSON.stringify(розклад.разові) + ' · feeTotal ' + розклад.feeTotal +
              ' на ' + розклад.feeUnits + ' шт, а насправді ' + розклад.feeShare + ' ₴/шт');
  розклад.рядки.forEach(r => console.log('   ' + r));
  ok(розклад.разові.length === 2,
    'рушій рахує разову кожного виду окремо — своя ставка й свій тираж',
    'разові злиплись в одну: ' + JSON.stringify(розклад.разові));
  ok(розклад.рядки.length === 2,
    'і в розкладі їх теж дві — стільки рядків, скільки видів',
    'у розкладі одне число на обидва види: ' + JSON.stringify(розклад.рядки));
  /* Головне: підпис і значення в кожному рядку мають сходитись між собою. */
  const збіг = розклад.рядки.every(t => {
    const m = t.match(/(\d+)\s*₴ на (\d+) шт → (\d+)/);
    return m && Math.abs(Math.round(+m[1] / +m[2]) - +m[3]) <= 1;
  });
  ok(збіг,
    'у кожному рядку підпис ділиться рівно в те число, що стоїть поруч',
    'підпис і значення розходяться: ' + JSON.stringify(розклад.рядки));
  const сума = розклад.рядки.reduce((a, t) => a + (+(t.match(/→ (\d+)/) || [0,0])[1]), 0);
  ok(сума === розклад.feeShare,
    'а разом вони дають рівно ту частку разових, що сидить у ціні за штуку',
    'рядки не сходяться з ціною: ' + сума + ' проти ' + розклад.feeShare);
}

console.log('');
console.log('═══ ПЕРЕМАГАЄ ОСТАННЯ ЗМІНА, А НЕ ПЕРША ═══');
/* Андрій, двічі: «я змінюю на надпис, потім зберігаю і воно наче
   збереглось, перезаходжу, а воно не збереглось» і «воно мені дає змінити,
   ділиться правильно, я зберігаю, і потім знову воно відкатується назад».

   Причина виявилась протилежна тій, від якої лікували. Колись вважалось, що
   конструктор про рішення менеджера не знає й щоразу присилає «картинка», —
   тому вид брали зі СТАРОЇ збереженої версії й накладали поверх нової.
   Конструктор давно везе рішення сам, а захист лишився: старе затирало
   нове. Кожна наступна зміна відкочувалась, і лише перша жила вічно. Гірше:
   переносились тільки «напис» і «не рахувати», тож поставивши раз «напис»,
   повернути «картинку» не можна було вже ніколи. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const блок = adm.slice(adm.indexOf('const fresh = nu.designKindFix;') - 200,
                         adm.indexOf('const fresh = nu.designKindFix;') + 400);
  ok(/setItemKindFix\(null, fp, fresh\[fp\], target\)/.test(блок),
    'при збереженні позиції вирішує те, що менеджер щойно поставив',
    'рішення береться не з нової версії — стара знову затре нову');
  ok(!/wasD\.designs\.forEach/.test(adm.slice(adm.indexOf('const ri = payload.replaceIndex;'),
                                              adm.indexOf('target.items.splice(ri, 1'))),
    'зі старої версії вид більше не тягнеться — саме він і відкочував зміни',
    'старе значення досі накладається поверх нового');

  const туди = await admin.evaluate(() => {
    const o = { id:'k', items:[
      { name:'Світшот', desc:{ designs:['fp-A'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-A', url:'https://cdn/eva.png' }] } } } ]};
    /* Менеджер поставив «напис», а потім передумав і повернув «картинку». */
    setItemKindFix(null, 'fp-A', 'txt', o); applyKindFix(o);
    const був = o.items[0].desc.designKinds[0];
    setItemKindFix(null, 'fp-A', 'img', o); applyKindFix(o);
    const став = o.items[0].desc.designKinds[0];
    setItemKindFix(null, 'fp-A', 'off', o); applyKindFix(o);
    return { був, став, потім:o.items[0].desc.designKinds[0],
             шар:o.items[0].config.logos.front[0].kindFix };
  });
  console.log('   ' + JSON.stringify(туди));
  ok(туди.був === 'txt' && туди.став === 'img' && туди.потім === 'off',
    'вид міняється в будь-який бік скільки завгодно разів — «картинка» повертається так само вільно',
    'вид застряг на першому рішенні: ' + JSON.stringify(туди));
  ok(туди.шар === 'off',
    'і шар щоразу їде за рішенням — конструктор читає вид саме звідти',
    'шар лишився зі старим видом: ' + JSON.stringify(туди));
}

console.log('');
console.log('═══ РІШЕННЯ ПІДВАНТАЖУЄТЬСЯ, А НЕ ТІЛЬКИ ЗБЕРІГАЄТЬСЯ ═══');
/* Андрій: «воно бачить, що це той самий логотип… просто воно його не
   зберігає і не підгружає».

   Мапа за відбитком лежить у ЗАМОВЛЕННІ, а конструктор читає вид із
   `config.logos` позиції. Позиція, збережена до того, як вид поставили,
   свого `kindFix` не має — і відкривши її, менеджер бачив «картинка» там,
   де сам щойно поставив «напис» на сусідній. Рішення було, просто до цієї
   позиції воно не доїжджало — і перше ж «Зберегти позицію» повертало макет
   у ціну. */
{
  const назад = await admin.evaluate(() => {
    /* Рішення в замовленні вже є, а шари про нього не знають: рівно так
       виглядає позиція, збережена раніше за рішення. */
    const o = { id:'k', designKindFix:{ 'fp-A':'txt' }, items:[
      { name:'Світшот', desc:{ designs:['fp-A'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-A', url:'https://cdn/eva.png' }] } } },
      { name:'Футболка', kind:'reco', desc:{ designs:['fp-A'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-A', url:'https://cdn/eva.png' }] } } } ]};
    applyKindFix(o);
    return { види:o.items.map(x => x.desc.designKinds[0]).join(','),
             шари:o.items.map(x => x.config.logos.front[0].kindFix || '—').join(',') };
  });
  console.log('   ' + JSON.stringify(назад));
  ok(назад.види === 'txt,txt',
    'збережене рішення діє в кожній позиції, яка несе цей малюнок',
    'рішення не доїхало до позицій: ' + JSON.stringify(назад));
  ok(назад.шари === 'txt,txt',
    'і лягає на шари — тому конструктор відкриває позицію вже з «написом», а не з «картинкою»',
    'конструктор знову покаже «картинка» й поверне макет у ціну: ' + JSON.stringify(назад));
}

console.log('');
console.log('═══ ОДИН МАЛЮНОК — ОДНЕ РІШЕННЯ, НАВІТЬ ПРИ РІЗНИХ ВІДБИТКАХ ═══');
/* Андрій: «я напис вибрав в основному товарі, в рекомендованих, по ідеї,
   той ж самий надпис… не підтягується, що це надпис».

   Відбиток знімається з пікселів, але коли їх прочитати не вдалось, шар
   дістає запасний — хеш власної адреси. Той самий логотип, доданий до
   рекомендованої позиції окремо, лежить у сховищі під іншою адресою: два
   різні відбитки на один малюнок, і рішення до сусідньої позиції не
   доходило. */
{
  const луна = await admin.evaluate(() => {
    const url = 'https://cdn/eva.png';
    const o = { id:'k', orderId:'1000071', items:[
      { name:'Світшот', desc:{ designs:['fp-A'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-A', url:url }] } } },
      { name:'Футболка', kind:'reco', desc:{ designs:['fp-B'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-B', url:url }] } } },
      { name:'Кепка', desc:{ designs:['fp-C'], designKinds:['img'] },
        config:{ logos:{ front:[{ fp:'fp-C', url:'https://cdn/inshiy.png' }] } } }
    ]};
    setItemKindFix(o.items[0], 'fp-A', 'txt', o);
    applyKindFix(o);
    return { мапа:Object.keys(o.designKindFix || {}).sort().join(','),
             види:o.items.map(x => x.desc.designKinds[0]).join(','),
             шари:o.items.map(x => (x.config.logos.front[0].kindFix || '—')).join(',') };
  });
  console.log('   ' + JSON.stringify(луна));
  ok(луна.види === 'txt,txt,img',
    'вибір на основному товарі підтягнувся в рекомендований — малюнок той самий',
    'рекомендована лишилась «картинкою»: ' + JSON.stringify(луна));
  ok(!/fp-C/.test(луна.мапа) && луна.шари.split(',')[2] === '—',
    'а чужий малюнок не зачепило — рішення про цей, а не про всі підряд',
    'рішення розповзлось на інший логотип: ' + JSON.stringify(луна));
  ok(луна.шари.split(',')[1] === 'txt',
    'і сам шар рекомендованої памʼятає вид — конструктор читає саме звідти',
    'конструктор наступного разу знову покаже «картинка»: ' + JSON.stringify(луна));
}

console.log('');
console.log(bad ? 'є розходження: ' + bad : 'перемикач на місці й робить те, що обіцяє');
try{ fs.unlinkSync(VHOST); }catch(e){}
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
