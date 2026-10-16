/* КАРТКА B2C: КЛІЄНТ, ПОЗИЦІЯ, ГРОШІ (15.10).

   Андрій: без другого «Клієнт», «Відвʼязати» праворуч; без «Що шиємо»;
   кількість 1 за замовчуванням і не менше 1; у «Гроші» — вид дизайну в рядку,
   ціна повторного як у готового; знижка гривнями або відсотком → «До оплати»;
   кілька платежів: перший — передоплата, далі — доплата, підпис міняється.

   Запуск:  node tests/b2c-money.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8997;
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

const CONTENT = {
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Оля',       role:'designer' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: {},
  products: { retail: { tee: 600 }, retailReady: { tee: 450 }, retailCost: { tee: 300 }, retailCostReady: { tee: 250 },
              b2cOff: { cap: true } },
  readyDesigns: [
    { id:'rd1', name:'Гаррі Поттер · Букля', tags:'гаррі сова', pic:'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      art:{ name:'букля.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
      arts:[{ name:'букля.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, { name:'букля-мала.png', url:'https://f/b2.png' }],
      extras:[{ name:'палітра.png', url:'https://f/pal.png' }, { name:'схема.pdf', url:'https://f/s.pdf' }],
      files:[{ name:'букля.dst', url:'https://f/1.dst' }, { name:'букля-мала.dst', url:'https://f/2.dst' }] },
    { id:'rd2', name:'Котик', tags:'кіт', pic:'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
      art:{ name:'кіт.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, files:[{ name:'кіт.dst', url:'https://f/3.dst' }] },
    { id:'rd3', name:'Сховане', off:true, art:{ url:'x' }, files:[{ url:'y' }] }
  ]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });



const SETUP = `(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  const u = (x) => Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:2 }, x || {});
  window.__j1 = designJobMake('2000101'); __j1.units = [u()];
  window.__j2 = designJobMake('2000102'); __j2.units = [u({ note:'Лого клієнта', pics:[{ name:'собака.jpg', url:'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACw=' }] }), u()];
  window.__o1 = orders.find(x => x.orderId === '2000101');
  window.__o2 = orders.find(x => x.orderId === '2000102');
  openDesign();
})()`;
await p.evaluate(SETUP);
await p.waitForTimeout(400);
const r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  /* Позиція — повторний дизайн; ціни «готовий ескіз» для tee вписано (450). */
  D.repeatAttach(__j1.units[0], { arts:[{ name:'a.png', url:'https://f/a.png' }], files:[{ name:'a.dst', url:'https://f/a.dst' }] });
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000101"]').click();
  await new Promise(r => setTimeout(r, 300));
  const fold = name => { const h = document.querySelector('#dzRoot [data-fold="' + name + '"]'); if(h && !h.closest('.open')) h.click(); };
  fold('Гроші');
  await new Promise(r => setTimeout(r, 200));
  const panel = () => document.querySelector('#dzRoot .dz-panel');
  const who = panel().querySelector('.dz-own-who');
  const вигляд = { другийКлієнт: !!(who && who.querySelector('span')), вРяд: !!(who && who.classList.contains('is-row')),
                   щоШиємо: /Що шиємо/i.test([...panel().querySelectorAll('.dz-u-cap')].map(x => x.textContent).join()),
                   qty: (panel().querySelector('.dz-qty') || {}).value,
                   полів: panel().querySelectorAll('.dz-qty').length };
  /* 0 у кількість — стає 1. */
  const q = panel().querySelector('.dz-qty'); q.value = '0'; q.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 300));
  const qty0 = __j1.units[0].qty;
  /* 16.10: у B2C поля кількості немає — лише в старої позиції з 2+ шт. */
  const полів = { до: вигляд.полів, після: panel().querySelectorAll('.dz-qty').length,
                  позицій: __j1.units.length, з2: __j1.units.filter(u => (+u.qty || 0) > 1).length };
  fold('Гроші');
  await new Promise(r => setTimeout(r, 200));
  const рядок = (panel().querySelector('.dz-sum-r span') || {}).textContent;
  /* Ціна повторного = «готовий ескіз» 450, запасу-попередження немає. */
  const до = { total: __o1.totalPrice, попер: /не вписано ціни «готовий ескіз»/.test(panel().textContent) };
  /* Знижка 100 ₴. */
  const di = panel().querySelector('[data-disc]'); di.value = '100'; di.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  fold('Гроші'); await new Promise(r => setTimeout(r, 200));
  const грн = { total: __o1.totalPrice, gross: __o1.grossPrice, disc: __o1.discountSum, доОпл: /До оплати/.test(panel().textContent) };
  /* Знижка 10 %. */
  const dk = panel().querySelector('[data-disc-k]'); dk.value = 'pct';
  const di2 = panel().querySelector('[data-disc]'); di2.value = '10'; dk.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  const pct = { total: __o1.totalPrice, disc: __o1.discountSum };
  /* Без ціни «готовий ескіз» — попередження. */
  delete contentData.products.retailReady.tee;
  fold('Гроші'); U.render(document.getElementById('dzRoot')); fold('Гроші');
  await new Promise(r => setTimeout(r, 300));
  const запас = /не вписано ціни «готовий ескіз»/.test(panel().textContent);
  contentData.products.retailReady.tee = 450;
  /* Платежі: перший — передоплата, другий — доплата. */
  const тег = () => (window.payNextTag ? payNextTag(__o1) : '');
  const t1 = тег();
  payments.push({ id:'pX', amount: 300, orderId: '2000101', tag: 'prepay', at: '2026-10-15' });
  const t2 = тег();
  return { вигляд, qty0, полів, рядок, до, грн, pct, запас, t1, t2 };
});
console.log('  ' + JSON.stringify(r));
ok(!r.вигляд.другийКлієнт && r.вигляд.вРяд, 'без другого «Клієнт»; нік і «Відвʼязати» — одним рядком', JSON.stringify(r.вигляд));
ok(!r.вигляд.щоШиємо, '«Що шиємо» прибрано', JSON.stringify(r.вигляд));
ok(r.вигляд.qty === '2' || r.вигляд.qty === '1', 'кількість стоїть числом (за замовчуванням 1)', JSON.stringify(r.вигляд));
ok(r.qty0 === 1, '0 у кількість — стає 1', 'кількість: ' + r.qty0);
ok(r.полів.після === r.полів.з2 && r.полів.після < r.полів.до,
  'B2C: позиція на 1 шт — без поля кількості; поле лишається лише в старої позиції з 2+ шт',
  'поля кількості: ' + JSON.stringify(r.полів));
ok(/Футболка базова/.test(r.рядок) && /повторний/.test(r.рядок), 'у «Гроші» — «Футболка базова · … · повторний»', r.рядок);
ok(r.до.total === 450 && !r.до.попер, 'ціна повторного — «готовий ескіз» (450), не індивідуальна', JSON.stringify(r.до));
ok(r.грн.gross === 450 && r.грн.disc === 100 && r.грн.total === 350 && r.грн.доОпл, 'знижка 100 ₴ → до оплати 350 (і totalPrice — 350 для грошового ядра)', JSON.stringify(r.грн));
ok(r.pct.disc === 45 && r.pct.total === 405, 'знижка 10 % → 45 ₴, до оплати 405', JSON.stringify(r.pct));
ok(r.запас, 'ціни «готовий ескіз» для виробу немає — сказано, що взято індивідуальну', 'попередження немає');
ok(r.t1 === 'prepay' && r.t2 === 'final', 'перший платіж — передоплата, наступні — доплата', JSON.stringify([r.t1, r.t2]));

console.log('\n═══ ЦІНА ФІКСУЄТЬСЯ В КАРТЦІ ═══');
const фікс = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const pr = contentData.products;
  pr.retail.tee = 600; pr.retailReady.tee = 450; pr.retailCost.tee = 300;
  /* Стара картка без зафіксованої ціни — фіксує поточну одразу. */
  const j = __j2; j.units.forEach(u => { delete u.priceAt; });
  await priceLockAll();
  const заф = j.units.map(u => u.price + '/' + u.cost).join();
  const сума0 = U.orderSum(__o2, j);
  /* Прайс подорожчав — стара картка не змінилась. */
  pr.retail.tee = 700; pr.retailCost.tee = 350;
  const сума1 = U.orderSum(__o2, j);
  const підказка = U.sumRows(j)[0].nowPrice;
  /* Нова позиція в старій картці — за новим прайсом. */
  const nu = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'M', qty:1 });
  j.units.push(nu); U.priceLockJob(j);
  const нова = nu.price;
  /* Перемкнули на готовий — фіксується за готовим. */
  D.repeatAttach(nu, {}); U.priceLockJob(j);
  const готова = nu.price;
  /* Кількість ціни не міняє. */
  j.units[0].qty = 5; U.priceLockJob(j);
  const кількість = j.units[0].price;
  /* «Оновити до поточного прайсу». */
  U.priceLockJob(j, true);
  const оновили = j.units[0].price;
  pr.retail.tee = 600; pr.retailCost.tee = 300;
  return { заф, сума0, сума1, підказка, нова, готова, кількість, оновили };
});
console.log('  ' + JSON.stringify(фікс));
ok(/600\/300/.test(фікс.заф), 'наявні картки зафіксували поточні ціну й собівартість', фікс.заф);
ok(фікс.сума0 === фікс.сума1 && фікс.підказка === 700, 'прайс змінили — стара картка за старою ціною, поруч «зараз у прайсі 700»', JSON.stringify(фікс));
ok(фікс.нова === 700 && фікс.готова === 450, 'нова позиція — за новим прайсом; перемкнули вид — зафіксовано заново', JSON.stringify(фікс));
ok(фікс.кількість === 600 && фікс.оновили === 700, 'кількість ціни не міняє; «Оновити до поточного прайсу» — перераховує', JSON.stringify(фікс));

console.log('\n═══ КАРТКА НА ДОШЦІ = ЗОНА «ГРОШІ» ═══');
const дошка = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  __o1.totalPrice = 2570;            // застаріле, як у #2000058
  const гроші = U.netSum(__o1, __j1);
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const картка = (document.querySelector('#dzRoot [data-open="2000101"]').closest('.dz-card-w') || document.querySelector('#dzRoot [data-open="2000101"]')).textContent;
  await priceLockAll();
  return { гроші, картка, total: __o1.totalPrice };
});
console.log('  ' + JSON.stringify(дошка));
const грн = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
ok(дошка.картка.indexOf(грн(дошка.гроші)) >= 0 && дошка.картка.indexOf('2 570') < 0,
  'картка на дошці показує ту саму суму, що зона «Гроші»', JSON.stringify(дошка));
ok(дошка.total === дошка.гроші, 'і в замовлення (грошове ядро) записано ту саму суму', JSON.stringify(дошка));

console.log('\n═══ ДОДАТКОВІ ПОСЛУГИ ПОЗИЦІЇ ═══');
const пос = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  contentData.b2c = Object.assign({}, contentData.b2c || {}, { extras: [{ id:'sv1', name:'Збільшення до 18 см', price: 200, cost: 50 }] });
  delete __o1.discount;          // знижка з попереднього розділу рахувалась би й від послуги
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000101"]').click();
  await new Promise(r => setTimeout(r, 300));
  const u = __j1.units[0];
  const до = U.netSum(__o1, __j1), собДо = U.orderCost(__j1).sum;
  const додай = async () => { await U.act('u-svc-add', document.getElementById('dzRoot'), { u: u.id });
    await new Promise(r => setTimeout(r, 150)); document.querySelector('.dz-pick [data-pick="0"]').click(); await new Promise(r => setTimeout(r, 300)); };
  await додай();
  const раз = { n: (u.services || []).length, сума: U.netSum(__o1, __j1), total: __o1.totalPrice, соб: U.orderCost(__j1).sum };
  /* Прайс послуги змінили — у картці лишається 200. */
  contentData.b2c.extras[0].price = 300;
  await додай();
  const два = { ціни: u.services.map(x => x.price).join(), сума: U.netSum(__o1, __j1) };
  const рядки = U.sumRows(__j1).filter(r => r.service).map(r => r.name + ':' + r.sum);
  await U.act('u-svc-del', document.getElementById('dzRoot'), { u: u.id, i: 1 });
  const після = { n: u.services.length, сума: U.netSum(__o1, __j1), total: __o1.totalPrice };
  /* Дизайнер бачить назву, але не ціну. */
  const ro = U.unitsHtml(__j1, { ro: true });
  return { до, собДо, раз, два, рядки, після, roНазва: /Збільшення до 18 см/.test(ro), roЦіна: /200\s*₴/.test(ro) };
});
console.log('  ' + JSON.stringify(пос));
ok(пос.раз.n === 1 && пос.раз.сума === пос.до + 200 && пос.раз.total === пос.раз.сума && пос.раз.соб === пос.собДо + 50,
  '«+ Послуга» — +200 ₴ до суми (і в замовлення для грошового ядра), +50 ₴ собівартості', JSON.stringify(пос.раз));
ok(пос.два.ціни === '200,300' && пос.два.сума === пос.до + 500, 'ціна фіксується в мить додавання; двічі — додали двічі', JSON.stringify(пос.два));
ok(пос.рядки.length === 2 && /\+ Збільшення до 18 см/.test(пос.рядки[0]), 'у «Гроші» — рядком під позицією', JSON.stringify(пос.рядки));
ok(пос.після.n === 1 && пос.після.сума === пос.до + 200 && пос.після.total === пос.після.сума, '«×» прибирає послугу — сума повертається', JSON.stringify(пос.після));
ok(пос.roНазва && !пос.roЦіна, 'дизайнер бачить послугу в позиції, без ціни', JSON.stringify(пос));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nкартка B2C і гроші — як домовились');
process.exit(bad ? 1 : 0);
