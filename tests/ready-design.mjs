/* ГОТОВИЙ ДИЗАЙН У B2C (13.10).

   Андрій: «базове нанесення — котик, булка, Гаррі Поттер у 10 варіантах… по
   заставці подивитися, чи це той принт… вибираєш дизайн — він одразу підтягує
   всі файли… менеджер розміщає, підтвердити — і воно одразу йде клієнту на
   погодження… після фіксації пропускає чергу вишивки і йде у виробництво.
   Якщо є індивідуальний — чекаємо, поки індивідуальні узгодять, і переносимо
   разом». Плюс: дві ціни (індивідуальний / готовий ескіз), перемикач «у B2C»,
   заставка плитки — картинка з ТЗ, скрипт «Ми зробили макет, підкажіть, чи вам
   подобається?)».

   Запуск:  node tests/ready-design.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8951;
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
await p.waitForTimeout(600);

console.log('═══ 1. ТОВАРИ B2C: ДВІ ЦІНИ Й «У B2C» ═══');
const ціни = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const н = U.host.retail('tee'), г = U.host.retail('tee', 'ready'), с = U.host.cost('tee', 'ready');
  const off = (U.host.catalog().filter(g => g.id === 'cap')[0] || {}).off;
  const tee = (U.host.catalog().filter(g => g.id === 'tee')[0] || {}).off;
  return { н, г, с, off, tee };
});
console.log('  ' + JSON.stringify(ціни));
ok(ціни.н === 600 && ціни.г === 450 && ціни.с === 250, 'індивідуальний ескіз — 600, готовий — 450 (собівартість 250)', JSON.stringify(ціни));
ok(ціни.off === true && ціни.tee === false, 'кепку вимкнено для B2C, футболка — ні', JSON.stringify(ціни));
const вибір = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  U.pickGarment('', () => {});
  await new Promise(r => setTimeout(r, 200));
  const ids = [...document.querySelectorAll('.dz-pick [data-pick]')].map(b => b.dataset.pick);
  document.querySelectorAll('.dz-pick').forEach(x => x.remove());
  return { кепка: ids.indexOf('cap') >= 0, футболка: ids.indexOf('tee') >= 0 };
});
ok(!вибір.кепка && вибір.футболка, 'у виборі одягу B2C вимкненого товару немає', JSON.stringify(вибір));
const налашт = await p.evaluate(() => {
  paintB2c();
  return { on: document.querySelectorAll('#b2c-prices [data-b2c-on]').length, rp: document.querySelectorAll('#b2c-prices [data-b2c-rprice]').length,
           rd: document.querySelectorAll('#rd-list .rd-c').length, add: !!document.getElementById('rd-add'),
           опис: (document.querySelector('#rd-list .rd-c i') || {}).textContent || '',
           apronOff: !(document.querySelector('[data-b2c-on="cap"]') || {}).checked };
});
console.log('  ' + JSON.stringify(налашт));
ok(налашт.on > 3 && налашт.rp === налашт.on && налашт.rd === 3 && налашт.add && налашт.apronOff,
  'налаштування: біля кожного товару «у B2C» і ціна готового ескізу; бібліотека — 3 дизайни, кнопка «+ Готовий дизайн»', JSON.stringify(налашт));
const ред = await p.evaluate(async () => {
  document.querySelector('[data-rd-ed="rd1"]').click();
  await new Promise(r => setTimeout(r, 100));
  const слоти = [...document.querySelectorAll('#rd-edit .rd-slot b')].map(b => b.textContent);
  const к = k => document.querySelectorAll('#rd-edit [data-rd-fdel^="' + k + ':"]').length;
  const до = { arts: к('arts'), files: к('files'), extras: к('extras') };
  document.querySelector('#rd-edit [data-rd-fdel="extras:1"]').click();
  await new Promise(r => setTimeout(r, 100));
  const після = к('extras');
  document.querySelector('#rd-edit [data-rd-cancel]').click();
  /* Старий запис з одним `art` читається як один принт. */
  const старий = rdArts({ art: { name:'a.png', url:'u' } }).length;
  return { слоти, до, після, старий };
});
console.log('  ' + JSON.stringify(ред));
ok(/Принти/.test(ред.слоти.join()) && /Додатково для виробництва/.test(ред.слоти.join()) &&
   ред.до.arts === 2 && ред.до.files === 2 && ред.до.extras === 2 && ред.після === 1 && ред.старий === 1,
  'у редакторі дизайну — кілька принтів, кілька вишивальних і «Додатково для виробництва» (палітра…), кожен прибирається окремо',
  JSON.stringify(ред));
ok(/принтів: 2/.test(налашт.опис) && /додатково: 2/.test(налашт.опис), 'у списку видно, скільки чого прикріплено: ' + налашт.опис, налашт.опис);

console.log('');
console.log('═══ 2. ВИБІР ГОТОВОГО ДИЗАЙНУ ═══');
const перемикач = await p.evaluate(() => {
  const h = window.LQDesign.ui.unitsHtml(__j1, { o: __o1 });
  return { інд: /data-do="u-ready-off"/.test(h), гот: /data-do="u-ready-pick"/.test(h) };
});
ok(перемикач.інд && перемикач.гот, 'у позиції — «Індивідуальний / Готовий дизайн»', JSON.stringify(перемикач));
const вікно = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  let обрано = null;
  U.readyPickOpen(d => { обрано = d; });
  await new Promise(r => setTimeout(r, 150));
  const всі = document.querySelectorAll('.dz-rdp [data-rdp-look]').length;
  const q = document.querySelector('.dz-rdp-q');
  q.value = 'гаррі'; q.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 100));
  const знайдено = [...document.querySelectorAll('.dz-rdp [data-rdp-look] b')].map(b => b.textContent);
  document.querySelector('.dz-rdp [data-rdp-look]').click();
  await new Promise(r => setTimeout(r, 100));
  const великим = !!document.querySelector('.dz-rdp-look img');
  document.querySelector('.dz-rdp [data-rdp-ok]').click();
  await new Promise(r => setTimeout(r, 100));
  return { всі, знайдено, великим, обрано: обрано && обрано.id, закрито: !document.querySelector('.dz-rdp') };
});
console.log('  ' + JSON.stringify(вікно));
ok(вікно.всі === 2, 'у вікні — лише показувані дизайни (2 з 3)', 'показано ' + вікно.всі);
ok(вікно.знайдено.length === 1 && /Букля/.test(вікно.знайдено[0]), 'пошук «гаррі» знаходить «Гаррі Поттер · Букля»', JSON.stringify(вікно.знайдено));
ok(вікно.великим && вікно.обрано === 'rd1' && вікно.закрито, 'натиск на заставку — великим; «Обрати цей дизайн» — обрано', JSON.stringify(вікно));

const клік = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  window.__ow = null;
  window.LQMock.openWork = opt => { window.__ow = opt; };
  const j = designJobMake('2000103');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:1 })];
  /* Акаунт-менеджером: дошку акаунта дизайнер не бачить. */
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  openDesign();
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const card = document.querySelector('#dzRoot [data-open="2000103"]');
  if(!card) return { err: 'немає картки', є: [...document.querySelectorAll('#dzRoot [data-open]')].map(x => x.dataset.open), tab: document.querySelector('#dzRoot .dz-col-h') && document.querySelector('#dzRoot .dz-col-h').textContent };
  card.click();
  await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('.dz-panel [data-do="u-ready-pick"]');
  if(!b) return { err: 'немає кнопки' };
  b.click();
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('.dz-rdp [data-rdp-look="rd2"]').click();
  await new Promise(r => setTimeout(r, 100));
  document.querySelector('.dz-rdp [data-rdp-ok]').click();
  await new Promise(r => setTimeout(r, 900));
  const ow = window.__ow;
  return { ready: j.units[0].ready && j.units[0].ready.name, place: !!(ow && ow.placeOnly),
           art: ow && ow.works && ow.works[0] && ow.works[0].name, на: ow && ow.places && ow.places.length,
           кнопка: !!document.querySelector('.dz-panel [data-do="u-ready-place"]') };
});
console.log('  ' + JSON.stringify(клік));
ok(клік.ready === 'Котик' && клік.place && клік.art === 'кіт.png' && клік.на === 1,
  'у картці: «Готовий дизайн» → вікно → «Обрати» — дизайн у позиції й одразу відкрилось розміщення з принтом на одязі', JSON.stringify(клік));
ok(клік.кнопка, 'якщо вікно розміщення закрили — у позиції кнопка «Розмістити на одязі»', JSON.stringify(клік));
/* Друга половина: «Зберегти» у вікні розміщення → вікно перевірки → «Надіслати». */
const надіслано = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  U.host.upload = async f => 'https://up.test/' + encodeURIComponent((f && f.name) || 'f');
  let пішло = null;
  U.host.tellPic = async (o, url, txt) => { пішло = { url, txt }; return true; };
  const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20;
  const png = cv.toDataURL('image/png');
  window.__ow.onDone({ works: [{ name:'кіт.png', url:'https://f/кіт.png', hash:'ready:rd2' }],
    sides: [{ side:'front', label:'Перед', png, places:[{ work:0, x:.5, y:.3, w:.26, wCm:10, hCm:8, topCm:7, sideCm:0 }] }],
    size:'M', нанесень:1, робіт:1 });
  let вікно = null;
  for(let k = 0; k < 40 && !вікно; k++){ await new Promise(r => setTimeout(r, 150)); вікно = document.querySelector('.dz-cf-t'); }
  const текст = вікно ? вікно.value : '';
  const кн = document.querySelector('[data-cf="yes"]');
  if(кн) кн.click();
  await new Promise(r => setTimeout(r, 900));
  const j = designJobMake('2000103');
  const o = orders.find(x => x.orderId === '2000103');
  const d = D.dzList(j.units[0], 'graphic').filter(x => x.readyMade)[0];
  return { текст, пішло: !!пішло, sent: !!(d && d.vers[0] && d.vers[0].sentToClient), byAcct: !!(d && d.vers[0].byAcct), стан: D.chainAt(j, o) };
});
console.log('  ' + JSON.stringify(надіслано));
ok(/Подивіться, як гарно вийшло 😊 Вам подобається\?/.test(надіслано.текст),
  'після «Зберегти» — вікно перевірки з текстом першого показу «Подивіться, як гарно вийшло 😊 Вам подобається?» (20.10)', 'текст: ' + надіслано.текст);
ok(надіслано.пішло && надіслано.sent && надіслано.byAcct && надіслано.стан === 'client',
  '«Надіслати» — мокап пішов клієнту, картка «У клієнта на погодженні»; версія не йде в зарплату дизайнеру', JSON.stringify(надіслано));
await p.evaluate(() => {
  document.querySelectorAll('[data-close]').forEach(x => x.click());
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'designer' }) : x);
  openDesign();
});

console.log('');
console.log('═══ 3. ШЛЯХ: РОЗМІЩЕННЯ → КЛІЄНТ → УЗГОДЖЕНО → ВИРОБНИЦТВО ═══');
const шлях = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const u = __j1.units[0];
  const rd = U.host.readyDesign('rd1');
  D.readyAttach(u, rd);
  const стани = [D.chainAt(__j1, __o1)];
  const ціна = U.sumRows ? null : null;
  const d = D.readyGraphic(u, 'mgr@loomiq');
  D.dzVer(d, 'mgr@loomiq', [{ name:'кіт.png', url:'w', role:'work' }, { name:'мокап.png', url:'m', role:'mock' }], 'Готовий', null, 'acct');
  d.vers[0].byAcct = true;
  стани.push(D.chainAt(__j1, __o1));
  d.vers[0].sentToClient = new Date().toISOString();
  стани.push(D.chainAt(__j1, __o1));
  D.acctMove(__j1, __o1, 'sketchok', 'mgr@loomiq');
  стани.push(D.chainAt(__j1, __o1));
  D.dzOk(d, 'mgr@loomiq', 'client', 1);
  D.clothConfirm(u, 'mgr@loomiq');
  D.dzAutoStitch(__j1, 'mgr@loomiq');
  стани.push(D.chainAt(__j1, __o1));
  const st = D.dzList(u, 'stitch')[0];
  const html = U.unitsHtml(__j1, { o: __o1 });
  const цех = U.verTilesHtml(st.vers[0], 'x', { only: ['shot', 'machine', 'extra'] });
  return { стани, st: st && { ready: st.readyMade, ok: !!st.ok, machine: D.verParts(st.vers[0]).machine.map(f => f.name), who: st.who,
             extra: D.verParts(st.vers[0]).extra.map(f => f.name),
             цехПринт: (цех.match(/dz-tile-l">принт без фону/g) || []).length, цехДод: (цех.match(/dz-tile-l">для виробництва/g) || []).length },
           принти: (u.ready.arts || []).length, дод: (u.ready.extras || []).length,
           ready: !!u.ready && u.ready.files.length, розмова: /data-dzsay=/.test(html), без: /без графічного й вишивального/.test(html) };
});
console.log('  ' + JSON.stringify(шлях));
ok(шлях.ready === 2, 'обраний дизайн підтягнув у позицію обидва вишивальні файли', JSON.stringify(шлях));
ok(шлях.стани.join() === 'new,sketch,client,sketchok,prod',
  'Нове → (розмістили) Готовий ескіз → (надіслали) У клієнта → Ескіз узгоджено → (фіксація) одразу Виробництво', шлях.стани.join(' → '));
ok(шлях.st && шлях.st.ready && шлях.st.ok && шлях.st.machine.join() === 'букля.dst,букля-мала.dst' && !шлях.st.who,
  'вишивка — без вишивального: погоджена версія з файлами бібліотеки', JSON.stringify(шлях.st));
ok(шлях.принти === 2 && шлях.дод === 2 && шлях.st.extra.join() === 'букля.png,букля-мала.png,палітра.png,схема.pdf',
  'кілька принтів без фону й додаткове (палітра, схема) — разом із вишивальними у версії для цеху', JSON.stringify(шлях));
ok(шлях.st.цехПринт === 2 && шлях.st.цехДод === 2,
  'у цеху — плитки «принт без фону» ×2 і «для виробництва» ×2 зі скачуванням', JSON.stringify(шлях.st));
ok(!шлях.розмова && шлях.без, 'у картці готового дизайну немає розмови з дизайнером', JSON.stringify(шлях));
const сума = await p.evaluate(() => window.LQDesign.ui.orderSum(__o1, __j1));
ok(сума === 900, 'ціна позиції — за готовим ескізом: 2 × 450 = 900', 'сума ' + сума);

console.log('');
console.log('═══ 4. ЗМІШАНЕ ЗАМОВЛЕННЯ — ГОТОВИЙ ЧЕКАЄ ІНДИВІДУАЛЬНИЙ ═══');
const мікс = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const [інд, гот] = __j2.units;
  const стани = [];
  /* Індивідуальний — у графічного. */
  const di = D.dzNew(); D.dzAttach(di, 'test@loomiq', 'mgr@loomiq'); D.dzSend(di, 'mgr@loomiq'); D.dzTake(di, 'test@loomiq');
  D.dzList(інд, 'graphic').push(di);
  D.readyAttach(гот, U.host.readyDesign('rd2'));
  const dg = D.readyGraphic(гот, 'mgr@loomiq');
  D.dzVer(dg, 'mgr@loomiq', [{ name:'кіт.png', url:'w', role:'work' }], '', null, 'acct');
  dg.vers[0].sentToClient = new Date().toISOString();
  стани.push(D.chainAt(__j2, __o2));
  /* Дизайнер здав, клієнт погодив обидва, одяг підтверджено. */
  D.dzVer(di, 'test@loomiq', [{ name:'лого.png', url:'l', role:'work' }], '', null, 'graphic');
  di.vers[0].sentToClient = new Date().toISOString();
  D.dzOk(di, 'mgr@loomiq', 'client', 1); D.dzOk(dg, 'mgr@loomiq', 'client', 1);
  D.clothConfirm(інд, 'mgr@loomiq'); D.clothConfirm(гот, 'mgr@loomiq');
  D.dzAutoStitch(__j2, 'mgr@loomiq');
  стани.push(D.chainAt(__j2, __o2));
  const si = D.dzList(інд, 'stitch')[0];
  D.dzClaim(si, 'emb@loomiq');
  D.dzVer(si, 'emb@loomiq', [{ name:'лого.dst', url:'d', role:'machine' }], '', null, 'stitch');
  D.dzOk(si, 'emb@loomiq', 'auto', 1);
  стани.push(D.chainAt(__j2, __o2));
  return стани;
});
console.log('  ' + мікс.join(' → '));
ok(мікс.join() === 'design,stitchq,prod',
  'поки індивідуальний у графічного — картка там; далі черга вишивки індивідуального; здав — уся картка у виробництво разом', мікс.join(' → '));

console.log('');
console.log('═══ 5. ДИЗАЙНЕРИ ГОТОВОГО НЕ БАЧАТЬ ═══');
const дошка = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
  const g = [...document.querySelectorAll('#dzRoot [data-open]')].map(x => x.dataset.open);
  U.setTab('stitch'); U.render(document.getElementById('dzRoot'));
  const s = [...document.querySelectorAll('#dzRoot [data-open]')].map(x => x.dataset.open);
  return { g, s };
});
console.log('  ' + JSON.stringify(дошка));
ok(дошка.g.indexOf('2000101') < 0 && дошка.s.indexOf('2000101') < 0, 'замовлення лише з готовим дизайном немає ні в графічного, ні у вишивального', JSON.stringify(дошка));
ok(дошка.g.indexOf('2000102') >= 0, 'змішане — у графічного є (за індивідуальною позицією)', JSON.stringify(дошка));

console.log('');
console.log('═══ 6. СКРИПТ І ЗАСТАВКА ═══');
const скрипт = await p.evaluate(() => scriptFor(__o1, 'ready', { v: 1 }));
ok(скрипт === 'Добрий день! Подивіться, як гарно вийшло 😊 Вам подобається?', 'готовий дизайн — той самий текст першого показу (20.10)', скрипт);
const плитка = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot [data-open="2000102"] img');
  return c ? c.getAttribute('src') : '';
});
ok(/AIAAAP/.test(плитка) || /^l$/.test(плитка), 'плитка індивідуальної позиції — картинка з ТЗ (а після ескізу — ескіз), не фото одягу', плитка.slice(0, 60));

console.log('');
console.log('═══ 7. БАЗОВИЙ ДИЗАЙН З ПРАВКАМИ (20.10) ═══');
const баз = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobs['2000103'], o = orders.find(x => x.orderId === '2000103');
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'L', qty:1 });
  j.units.push(u);
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const крт = document.querySelector('#dzRoot [data-open="2000103"]');
  if(!крт) return { err: 'немає картки', є: [...document.querySelectorAll('#dzRoot [data-open]')].map(x => x.dataset.open), роль: (contentData.team || []).map(x => x.role) };
  крт.click();
  await new Promise(r => setTimeout(r, 400));
  const кн = document.querySelector('.dz-panel [data-do="u-base-pick"][data-u="' + u.id + '"]');
  if(!кн) return { err: 'немає кнопки «Готовий з правками»' };
  const назваКн = кн.textContent;
  кн.click();
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('.dz-rdp [data-rdp-look="rd2"]').click();
  await new Promise(r => setTimeout(r, 100));
  document.querySelector('.dz-rdp [data-rdp-ok]').click();
  await new Promise(r => setTimeout(r, 300));
  const ta = document.querySelector('.dz-fixw .dz-fix-t');
  if(!ta) return { err: 'немає поля «що змінити»', назваКн };
  ta.value = 'Додати напис «Олена 2025» під котиком';
  document.querySelector('.dz-fixw [data-fix-go]').click();
  await new Promise(r => setTimeout(r, 800));
  const рядок = U.sumRows(j).filter(x => x.design === 'готовий з правками')[0] || null;
  const html = U.unitsHtml(j, { o });
  const handable = D.dzHandable(j, o);
  D.dzHandOver(j, o, 'test@loomiq');
  const черга = D.dzList(u, 'graphic').some(d => D.dzInQueue(d));
  U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
  const уГраф = !!document.querySelector('#dzRoot [data-open="2000103"]');
  if(уГраф){ document.querySelector('#dzRoot [data-open="2000103"]').click(); await new Promise(r => setTimeout(r, 400)); }
  const панель = (document.querySelector('.dz-panel') || {}).textContent || '';
  const дизБачить = /Основа · Котик/.test(панель) && /Олена 2025/.test(панель);
  return { назваКн, base: u.base && u.base.name, note: u.base && u.base.note, ready: !!u.ready,
           dst: u.base && u.base.files.length, ціна: рядок && рядок.price, kind: u.priceKind,
           основа: /Основа · Котик/.test(html) && /Олена 2025/.test(html), handable, черга, уГраф, дизБачить };
});
console.log('  ' + JSON.stringify(баз));
ok(/Готовий з правками/.test(баз.назваКн || ''), 'у перемикачі — кнопка «Готовий з правками»', JSON.stringify(баз));
ok(баз.base === 'Котик' && /Олена 2025/.test(баз.note || '') && !баз.ready && баз.dst === 1,
  'обрали «Котик» з бібліотеки, вписали правку — основа з DST у позиції, позиція не «готова»', JSON.stringify(баз));
ok(баз.ціна === 450 && баз.kind === 'ready', 'ціна клієнту — як у готового дизайну (450, не 600)', JSON.stringify(баз));
ok(баз.основа, 'у картці — «Основа · Котик» і текст правки', JSON.stringify(баз));
ok(баз.handable > 0 && баз.черга && баз.уГраф, 'без «типу малюнка» йде графічному дизайнеру в чергу, як індивідуальний', JSON.stringify(баз));
ok(баз.дизБачить, 'дизайнер у своїй картці бачить основу «Котик» і що змінити — шукати нічого не треба', JSON.stringify(баз));

console.log('');
console.log('═══ 8. РОЗМІР ВИРОБУ — РОЗМІРИ ВИШИВКИ (20.10) ═══');
const розм = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  /* Розмірна сітка адмінки: довжина M — 70, 5XL — 84 см. */
  contentData.sizecharts = Object.assign({}, contentData.sizecharts, { tee: [{ size:'M', A:'70', B:'52' }, { size:'5XL', A:'84', B:'66' }] });
  const H = U.host.heightCm;
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'M', qty:1 });
  const d = D.readyGraphic(u, 'mgr@loomiq');
  D.dzVer(d, 'mgr@loomiq', [{ name:'кіт.png', url:'w', role:'work' }, { name:'мокап.png', url:'m', role:'mock' }, { name:'аркуш-v1.png', url:'s', role:'sheet' }],
    'Готовий', { size:'M', wCm:20, hCm:10, spots:[{ side:'front', label:'Перед', x:0.5, y:0.3, w:0.3, wCm:20, hCm:10, topCm:8, sideCm:0 }] }, 'acct');
  const n = D.sizeRescale(u, '5XL', H);
  const v = d.vers[0], sp = v.place.spots[0];
  const великий = { place: { size:'XL', spots:[{ label:'Спина', wCm:46, hCm:30, topCm:5 }] } };
  const html = U.verTilesHtml ? '' : '';
  return { hM: H('tee', 'M'), h5: H('tee', '5XL'), n, w: sp.wCm, h: sp.hCm, top: sp.topCm, size: v.place.size, from: v.place.sizeFrom,
           аркуш: v.files.some(f => f.role === 'sheet'), warn: window.LQMock.bigEmb(46, 30), ok: !window.LQMock.bigEmb(44, 29) };
});
console.log('  ' + JSON.stringify(розм));
ok(розм.hM === 70 && розм.h5 === 84, 'довжина виробу — з розмірної сітки адмінки (M 70, 5XL 84 см)', JSON.stringify(розм));
ok(розм.n === 1 && розм.w === 24 && розм.h === 12 && розм.top === 9.6 && розм.size === '5XL' && розм.from === 'M',
  'розмір M → 5XL: вишивка 20 × 10 стала 24 × 12 (× 84/70), відступ теж; позначено «з M»', JSON.stringify(розм));
ok(!розм.аркуш, 'старий аркуш зі старими цифрами прибрано — збереться заново', JSON.stringify(розм));
ok(розм.warn && розм.ok, 'попередження лише понад 44 × 29 см', JSON.stringify(розм));

const службове = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'M', qty:1 });
  D.readyAttach(u, { id:'rdx', name:'Кіт', pic:'p', arts:[{ name:'a.png', url:'a' }], files:[{ name:'a.dst', url:'d' }] });
  const st0 = D.dzNew(); D.dzList(u, 'stitch').push(st0); D.readyStitch(st0, u, 'boss@loomiq');
  D.readySync(u, { id:'rdx', name:'Кіт', pic:'p', arts:[{ name:'a.png', url:'a' }], files:[{ name:'b.dst', url:'d2' }] }, 'boss@loomiq');
  const n = ['graphic', 'stitch'].reduce((a, k) => a + D.dzList(u, k).reduce((b, d) => b + D.dzUnseen(d, 'mgr@loomiq', 'acct', k), 0), 0);
  return { n, подій: D.dzList(u, 'stitch').reduce((a, d) => a + (d.thread || []).length, 0) };
});
console.log('  ' + JSON.stringify(службове));
ok(службове.n === 0, 'службові події готового дизайну («оновлено в бібліотеці») не дають червоного «1» на картці', JSON.stringify(службове));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
