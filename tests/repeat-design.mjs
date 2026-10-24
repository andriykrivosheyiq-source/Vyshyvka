/* ПОВТОРНИЙ ДИЗАЙН (15.10).

   Андрій: «індивідуальний, готовий дизайн і ще повторний… одразу
   завантажуємо DST-шки, прозорі принти, розміщення, одобрення, якщо
   одобрилось — одразу на виробництво… ціну рахуємо як у готовому… закупка —
   з фіксації… підвантажувати з минулого завершеного замовлення: цей клієнт
   або загалом по всіх, і шукати по всіх».

   Запуск:  node tests/repeat-design.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9125;
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
    payments:[{ at:'2026-09-20T09:00:00.000Z', sum:300, kind:'prepay', by:'test' }], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', crmChatId:'c-gate', name:'Б', status:'prorahunok', site:'main',
    payments:[{ at:'2026-09-20T09:00:00.000Z', sum:300, kind:'prepay', by:'test' }], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', crmChatId:'c-gate', name:'В', status:'prorahunok', site:'main',
    payments:[{ at:'2026-09-20T09:00:00.000Z', sum:300, kind:'prepay', by:'test' }], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] }
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
await p.waitForTimeout(500);
/* Минулі ЗАВЕРШЕНІ замовлення: 2000102 — того самого клієнта (та сама
   розмова), 2000103 — чуже. Обидва дійшли до виробництва: графіка й вишивка
   погоджені, DST є. */
await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui, m = 'emb@loomiq';
  const мин = (id, dst, png) => {
    const j = id === '2000102' ? __j2 : designJobMake(id);
    if(id !== '2000102') j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'L', qty:1 })];
    const u = j.units[0];
    const g = D.dzNew(); D.dzAttach(g, 'test@loomiq', 'mgr@loomiq'); D.dzSend(g, 'mgr@loomiq'); D.dzTake(g, 'test@loomiq');
    D.dzVer(g, 'test@loomiq', [{ name: png, url:'https://f/' + png, role:'orig' }, { name:'мокап.png', url:'https://f/m-' + png, role:'mock' }], '');
    D.dzList(u, 'graphic').push(g); D.dzOk(g, 'mgr@loomiq', 'client', 1); D.clothConfirm(u, 'mgr@loomiq');
    const s = D.dzNew(); D.dzAttach(s, m, 'mgr@loomiq'); D.dzSend(s, 'mgr@loomiq'); D.dzTake(s, m);
    D.dzVer(s, m, [{ name: dst, url:'https://f/' + dst, role:'machine' }, { name:'wilcom.png', url:'https://f/w-' + dst, role:'shot' }], '', null, 'stitch');
    D.dzList(u, 'stitch').push(s); D.dzOk(s, 'mgr@loomiq', 'acct', 1);
    if(id === '2000102') j.units = [u];
    return j;
  };
  orders.find(x => x.orderId === '2000102').crmChatId = 'c1';
  мин('2000102', 'кіт.dst', 'кіт.png');
  мин('2000103', 'булка.dst', 'булка.png');
  window.__стан = ['2000102', '2000103'].map(id => D.chainAt(designJobs[id], orders.find(x => x.orderId === id)));
});

console.log('═══ 1. ТРИ ВИДИ ДИЗАЙНУ, «ПОВТОРНИЙ» — ЗІ СВОЇМИ ФАЙЛАМИ ═══');
const вид = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const h0 = U.unitsHtml(__j1, { o: __o1 });
  const кнопки = (h0.match(/data-do="u-(ready-off|ready-pick|repeat)"/g) || []).length;
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000101"]').click();
  await new Promise(r => setTimeout(r, 300));
  await U.act('u-repeat', document.getElementById('dzRoot'), { u: __j1.units[0].id });
  await new Promise(r => setTimeout(r, 300));
  const u = __j1.units[0];
  const h1 = U.unitsHtml(__j1, { o: __o1 });
  return { кнопки, повт: !!(u.ready && u.ready.repeat), списки: (h1.match(/class="dz-rep-t[ "]/g) || []).length,
           минуле: /data-do="u-rep-past"/.test(h1), розмістити: /data-do="u-ready-place"/.test(h1), бракує: /хоч один принт і один DST/.test(h1),
           стан: window.__стан };
});
console.log('  ' + JSON.stringify(вид));
ok(вид.кнопки === 3, 'у позиції — «Індивідуальний / Готовий дизайн / Повторний»', JSON.stringify(вид));
ok(вид.повт && вид.списки === 3 && вид.минуле, '«Повторний» — три списки (принти, DST, додаткове) і «⤓ З минулого замовлення»', JSON.stringify(вид));
ok(!вид.розмістити && вид.бракує, 'без принта й DST розміщати не можна — і сказано, чого бракує', JSON.stringify(вид));
ok(вид.стан.join() === 'prod,prod', 'минулі замовлення для перевірки — завершені (у виробництві)', JSON.stringify(вид.стан));

console.log('\n═══ 2. «З МИНУЛОГО ЗАМОВЛЕННЯ»: ЦЕЙ КЛІЄНТ / УСІ, ПОШУК ═══');
const мин = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  await U.act('u-rep-past', document.getElementById('dzRoot'), { u: __j1.units[0].id });
  await new Promise(r => setTimeout(r, 200));
  const w = () => document.querySelector('.dz-past');
  const номери = () => [...w().querySelectorAll('.dz-past-oh b')].map(b => b.textContent);
  const свій = { режим: (w().querySelector('[data-past-m].on') || {}).textContent, номери: номери() };
  w().querySelector('[data-past-m="all"]').click();
  const усі = номери();
  const q = w().querySelector('.dz-past-q'); q.value = 'булка'; q.dispatchEvent(new Event('input'));
  const пошукБулка = номери();
  const q2 = w().querySelector('.dz-past-q'); q2.value = '2000102'; q2.dispatchEvent(new Event('input'));
  const пошукНомер = номери();
  const опис = (w().querySelector('.dz-past-u i') || {}).textContent;
  w().querySelector('.dz-past-u').click();
  await new Promise(r => setTimeout(r, 400));
  const r = __j1.units[0].ready;
  return { свій, усі, пошукБулка, пошукНомер, опис, закрито: !w(),
           arts: D.readyArts(r).map(f => f.name), files: r.files.map(f => f.name), extras: r.extras.map(f => f.name),
           з: r.from && r.from.no, h: U.unitsHtml(__j1, { o: __o1 }).indexOf('data-do="u-ready-place"') >= 0 };
});
console.log('  ' + JSON.stringify(мин));
ok(мин.свій.режим === 'Цей клієнт' && мин.свій.номери.length === 1, 'спершу — «Цей клієнт»: лише його завершене замовлення', JSON.stringify(мин.свій));
ok(мин.усі.length === 2, '«Усі замовлення» — усі завершені', JSON.stringify(мин.усі));
ok(мин.пошукБулка.length === 0 && мин.пошукНомер.length === 1, 'пошук — за номером, імʼям, ніком, телефоном', JSON.stringify([мин.пошукБулка, мин.пошукНомер]));
ok(/1 DST · 1 принт/.test(мин.опис || ''), 'біля позиції видно, скільки файлів', мин.опис);
ok(мин.закрито && мин.files.join() === 'кіт.dst' && мин.arts.join() === 'кіт.png' && мин.extras.join() === 'wilcom.png' && мин.з,
  'обрали — DST, принт і додаткове перейшли в позицію, видно звідки', JSON.stringify(мин));
ok(мин.h, 'файли є — «Розмістити на одязі» зʼявилась', JSON.stringify(мин));

console.log('\n═══ 3. ФАЙЛИ РУКАМИ: «×» ПРИБИРАЄ ═══');
const руки = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const r = __j1.units[0].ready;
  r.extras.push({ name:'палітра.png', url:'https://f/pal.png' });
  await U.act('u-rep-del', document.getElementById('dzRoot'), { u: __j1.units[0].id, k: 'extras', i: 0 });
  return { extras: __j1.units[0].ready.extras.map(f => f.name) };
});
ok(руки.extras.join() === 'палітра.png', '«×» прибирає саме той файл', JSON.stringify(руки));

console.log('\n═══ 4. ШЛЯХ: РОЗМІЩЕННЯ → КЛІЄНТ → ФІКСАЦІЯ → ВИРОБНИЦТВО, ЗАКУПІВЛЯ З ФІКСАЦІЇ ═══');
const шлях = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui, m = 'mgr@loomiq';
  const u = __j1.units[0];
  const стани = [D.chainAt(__j1, __o1)];
  const d = D.readyGraphic(u, m);
  D.dzVer(d, m, [{ name:'кіт.png', url:'https://f/кіт.png', role:'work' }, { name:'мокап.png', url:'m', role:'mock' }], 'Повторний', null, 'acct');
  d.vers[0].byAcct = true;
  стани.push(D.chainAt(__j1, __o1));
  d.vers[0].sentToClient = new Date().toISOString();
  стани.push(D.chainAt(__j1, __o1));
  D.sketchOkMark(d, 1, m);
  стани.push(D.chainAt(__j1, __o1));
  const мій = p => p.o.orderId === '2000101';
  const купити0 = D.buyNeed(U.pairs().filter(мій), []).length;
  D.dzOk(d, m, 'client', 1); D.clothConfirm(u, m); D.dzAutoStitch(__j1, m);
  стани.push(D.chainAt(__j1, __o1));
  const купити1 = D.buyNeed(U.pairs().filter(мій), []).length;
  const st = D.dzList(u, 'stitch')[0];
  const pr = st && D.verParts(st.vers[0]);
  return { стани, купити0, купити1, вишивка: st && { ok: !!st.ok, who: st.who, dst: pr.machine.map(f => f.name), дод: pr.extra.map(f => f.name) },
           сума: U.orderSum(__o1, __j1) };
});
console.log('  ' + JSON.stringify(шлях));
ok(шлях.стани.join() === 'new,sketch,client,sketchok,prod',
  'Нове → (розмістили) Готовий ескіз → (надіслали) У клієнта → Ескіз узгоджено → (фіксація) Виробництво', шлях.стани.join(' → '));
ok(шлях.вишивка && шлях.вишивка.ok && !шлях.вишивка.who && шлях.вишивка.dst.join() === 'кіт.dst',
  'вишивка — без вишивального, з DST повторного', JSON.stringify(шлях.вишивка));
ok(шлях.вишивка && /кіт\.png/.test(шлях.вишивка.дод.join()) && /палітра\.png/.test(шлях.вишивка.дод.join()),
  'цех бачить і принт без фону, і додаткові файли', JSON.stringify(шлях.вишивка));
ok(шлях.купити0 === 0 && шлях.купити1 > 0, 'закупівля — лише з фіксації: до неї закупнику нічого, після — є', JSON.stringify(шлях));
ok(шлях.сума === 900, 'ціна — як у готового дизайну: 2 × 450 = 900', 'сума ' + шлях.сума);

console.log('\n═══ 4б. БЕЗ РОЗМІРУ — РОЗМІЩУЄМО ПІД M ═══');
const розм = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const j = designJobMake('2000102');
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'', qty:1 });
  D.repeatAttach(u, { arts:[{ name:'a.png', url:'https://f/a.png' }], files:[{ name:'a.dst', url:'https://f/a.dst' }] });
  j.units = [u];
  let opt = null; const було = window.LQMock.openWork;
  window.LQMock.openWork = o => { opt = o; };
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot [data-open="2000102"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 300));
  await U.act('u-ready-place', document.getElementById('dzRoot'), { u: u.id });
  await new Promise(r => setTimeout(r, 300));
  window.LQMock.openWork = було;
  return opt ? { size: opt.size, assumed: opt.sizeAssumed } : null;
});
console.log('  ' + JSON.stringify(розм));
ok(розм && розм.size === 'M' && розм.assumed, 'розмір у позиції не вказано — вікно розміщення рахує під M і каже про це', JSON.stringify(розм));

console.log('\n═══ 5. ДИЗАЙНЕРИ ПОВТОРНОГО НЕ БАЧАТЬ ═══');
const диз = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'designer' }) : x);
  U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
  const g = [...document.querySelectorAll('#dzRoot [data-open]')].map(x => x.dataset.open.split('|')[0]);
  return { g };
});
ok(диз.g.indexOf('2000101') < 0, 'графічний дизайнер повторної позиції не бачить', JSON.stringify(диз));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nповторний дизайн працює');
process.exit(bad ? 1 : 0);
