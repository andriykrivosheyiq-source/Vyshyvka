/* ВАРІАНТИ НА КІЛЬКОХ ВИРОБАХ (16.10, Андрій).

   Той самий дизайн на кількох виробах і кольорах (до 6), картка-сітка 1–6
   клієнту, обовʼязковий вибір «Який варіант обрав клієнт?» при фіксації —
   обраний стає виробом, кольором і версією дизайну позиції.

   Запуск:  node tests/variants.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8963;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
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




await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const D = window.LQDesign, U = D.ui;
  window.__j = designJobMake('2000101');
  __j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:1 })];
  window.__o = orders.find(x => x.orderId === '2000101');
  D.readyAttach(__j.units[0], U.host ? null : null);
  openDesign();
});
await p.waitForTimeout(500);

console.log('═══ 1. КНОПКА І ДОДАВАННЯ ВАРІАНТІВ ═══');
const крок1 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const u = __j.units[0];
  D.readyAttach(u, U.host.readyDesign('rd2'));                 // готовий «Котик»
  U.host.sides = () => [{ key:'front', label:'Перед', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }];
  U.host.upload = async f => 'https://up.test/' + encodeURIComponent((f && f.name) || 'f');
  window.LQMock.openWork = opt => { window.__ow = opt; };
  const cs = (U.catItem('tee') || {}).colors || [];
  window.__cs = cs.slice(0, 3).map(c => c.name || c.id);
  let ki = 0;
  U.pickGarment = (cur, cb) => cb('tee');
  U.pickColor = (gid, cb) => cb((cs[ki++] || {}).id);
  U.setTab('acct'); U.open('2000101'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  const кнопка = !!document.querySelector('.dz-panel [data-do="u-var-add"]');
  const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20;
  const png = cv.toDataURL('image/png');
  const додай = async (x, y) => {
    window.__ow = null;
    document.querySelector('.dz-panel [data-do="u-var-add"]').click();
    for(let k = 0; k < 30 && !window.__ow; k++) await new Promise(r => setTimeout(r, 100));
    const ow = window.__ow;
    const art = ow && ow.works[0].name;
    await ow.onDone({ works: [{ name:'кіт.png', url:'https://f/кіт.png', hash:'x' }],
      sides: [{ side:'front', label:'Перед', png, places:[{ work:0, x, y, w:.26, wCm:10, hCm:8, topCm:7, sideCm:0 }] }],
      size:'M', нанесень:1, робіт:1 });
    await new Promise(r => setTimeout(r, 300));
    return art;
  };
  const a1 = await додай(.5, .3);   // по центру
  const a2 = await додай(.35, .25); // на грудях
  const l = U.varsOf(u);
  return { кнопка, a1, a2, n: l.length, кольори: l.map(v => v.color), cs: window.__cs, мок: l.every(v => !!v.mock),
           місця: l.map(v => v.places[0].x), плиток: document.querySelectorAll('.dz-panel .dz-var-t').length,
           номери: [...document.querySelectorAll('.dz-panel .dz-var-t .dz-var-n')].map(x => x.textContent).join() };
});
console.log('  ' + JSON.stringify(крок1));
ok(крок1.кнопка, 'у позиції — кнопка «Варіанти на кількох виробах»', 'кнопки немає');
ok(крок1.n === 2 && крок1.кольори.join() === крок1.cs.slice(0, 2).join() && крок1.кольори[0] && крок1.a1 === 'кіт.png' && крок1.a2 === 'кіт.png',
  'додали два варіанти (' + крок1.кольори.join(' / ') + ') — на обох та сама картинка готового дизайну', JSON.stringify(крок1));
ok(крок1.мок && крок1.місця.join() === '0.5,0.35' && крок1.плиток === 2 && крок1.номери === '1,2',
  'розміщення в кожного своє (по центру / на грудях), плитки з номерами 1, 2', JSON.stringify(крок1));

if(process.env.SHOT){
  await p.evaluate(() => { const v = document.querySelector('.dz-panel .dz-var'); if(v) v.scrollIntoView(); });
  await p.screenshot({ path: process.env.SHOT });
  const png = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 330; const x = c.getContext('2d');
    const im = (col) => { x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 300, 330); x.fillStyle = col; x.fillRect(60, 40, 180, 260); x.fillStyle = '#e44'; x.beginPath(); x.arc(150, 120, 30, 0, 7); x.fill(); return c.toDataURL(); };
    return window.LQMock.variantsCard({ title:'Варіанти на вибір', no:'#2000001-1', note:'Напишіть номер варіанта, який подобається більше',
      items:[{ n:1, img: im('#111'), label:'Футболка базова · Чорний' }, { n:2, img: im('#fff'), label:'Футболка базова · Білий' },
             { n:3, img: im('#d8c6a8'), label:'Худі · Бежевий' }] });
  });
  fs.writeFileSync(process.env.SHOT.replace('.png', '-card.png'), Buffer.from(png.split(',')[1], 'base64'));
}
console.log('');
console.log('═══ 2. КАРТКА 1–N КЛІЄНТУ ═══');
const крок2 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  let пішло = null;
  U.host.tellPic = async (o, url, txt) => { пішло = { url, txt }; return true; };
  const png = await window.LQMock.variantsCard({ title:'Варіанти на вибір', no:'#1',
    items:[{ n:1, img:'data:image/gif;base64,R0lGODlhAQABAAAAACw=', label:'Футболка · Чорний' }, { n:2, img:'data:image/gif;base64,R0lGODlhAQABAAAAACw=', label:'Футболка · Білий' }] });
  document.querySelector('.dz-panel [data-do="u-var-send"]').click();
  for(let k = 0; k < 40 && !пішло; k++) await new Promise(r => setTimeout(r, 150));
  return { png: /^data:image\/png/.test(png || ''), пішло, sheet: !!__j.units[0].variants.sheet };
});
console.log('  ' + JSON.stringify(крок2).slice(0, 300));
ok(крок2.png && крок2.пішло && /варіанти на вибір/.test(крок2.пішло.txt) && /\n1\. Футболка.*, \S/.test(крок2.пішло.txt) && /\n2\. Футболка.*, \S/.test(крок2.пішло.txt) && крок2.sheet,
  'одна картка-сітка з номерами пішла клієнту з текстом заготовки «Варіанти на вибір» і списком «1. …, 2. …» (20.10)', JSON.stringify(крок2).slice(0, 300));

console.log('');
console.log('═══ 3. ФІКСАЦІЯ: БЕЗ ВИБОРУ ВАРІАНТА ДАЛІ НЕ ЙДЕ ═══');
const крок3 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const u = __j.units[0];
  const d = D.readyGraphic(u, 'test@loomiq');
  D.dzVer(d, 'test@loomiq', [{ name:'кіт.png', url:'w', role:'work' }, { name:'мокап.png', url:'m', role:'mock' }], 'Готовий', null, 'acct');
  d.vers[0].sentToClient = new Date().toISOString();
  D.sketchOkMark(d, 1, 'test@loomiq');
  const i = D.dzList(u, 'graphic').indexOf(d);
  const root = document.getElementById('dzRoot');
  U.render(root);
  await U.act('dz-ok-pick', root, { dz: u.id + '|graphic|' + i });
  await new Promise(r => setTimeout(r, 300));
  const вікно = { є: !!document.querySelector('.dz-pick .dz-var-c'), карток: document.querySelectorAll('.dz-pick .dz-var-c').length,
                  одяг: !!document.querySelector('.dz-cl') };
  /* Закрили без вибору — нічого не сталось. */
  document.querySelector('.dz-pick [data-pick-x]').click();
  await new Promise(r => setTimeout(r, 200));
  const закрили = { одяг: !!document.querySelector('.dz-cl'), ok: !!d.ok, pick: u.variants.pick || 0 };
  /* Знову — і обираємо № 2. */
  await U.act('dz-ok-pick', root, { dz: u.id + '|graphic|' + i });
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('.dz-pick .dz-var-c[data-pick="2"]').click();
  await new Promise(r => setTimeout(r, 400));
  const одяг = document.querySelector('.dz-cl');
  const після = { одяг: !!одяг, назва: одяг ? (одяг.querySelector('.dz-cf-h') || {}).textContent : '', колір: u.color, pick: u.variants.pick,
                  треба: u.variants.list[1].color, версій: d.vers.length, ост: d.vers[d.vers.length - 1].variant, sketchOk: d.sketchOk,
                  мок: (D.verParts(d.vers[d.vers.length - 1]).mock[0] || {}).url === u.variants.list[1].mock };
  const go = document.querySelector('.dz-cl [data-cl-go]');
  if(go && !go.disabled) go.click();
  await new Promise(r => setTimeout(r, 500));
  return { вікно, закрили, після, ok: d.ok && d.ok.ver };
});
console.log('  ' + JSON.stringify(крок3));
ok(крок3.вікно.є && крок3.вікно.карток === 2 && !крок3.вікно.одяг,
  'фіксація спершу питає «Який варіант обрав клієнт?» — 2 картки, одяг ще не питаємо', JSON.stringify(крок3.вікно));
ok(!крок3.закрили.одяг && !крок3.закрили.ok && !крок3.закрили.pick,
  'закрили вікно без вибору — далі не пішло', JSON.stringify(крок3.закрили));
ok(крок3.після.pick === 2 && крок3.після.колір && крок3.після.колір === крок3.після.треба && крок3.після.версій === 2 && крок3.після.ост === 2 &&
   +крок3.після.sketchOk === 2 && крок3.після.мок && крок3.після.одяг && /v2/.test(крок3.після.назва),
  'обрали № 2 — виріб і колір позиції стали кольором варіанта 2, розміщення й мокап варіанта — новою версією v2, далі фіксація саме v2',
  JSON.stringify(крок3.після));
ok(крок3.ok === 2, 'фіксація погодила саме v2 — далі в роботу йде обраний варіант', 'ok.ver: ' + крок3.ok);

console.log('');
console.log('═══ 4. ПЕРЕТЯГУВАННЯ «ЕСКІЗ УЗГОДЖЕНО» → ДАЛІ — ТЕЖ ПИТАЄ ВАРІАНТ ═══');
const крок4 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('.dz-cl, .dz-pick').forEach(x => x.remove());
  const j = designJobMake('2000102'); const o = orders.find(x => x.orderId === '2000102');
  const cs = (U.catItem('tee') || {}).colors || [];
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color: cs[0].name || cs[0].id, size:'L', qty:1 });
  j.units = [u];
  D.readyAttach(u, U.host.readyDesign('rd2'));
  const f = n => [{ name:'кіт.png', url:'https://f/кіт.png', role:'work' }, { name:'Перед.png', url:'https://m/' + n + '.png', role:'mock' }];
  u.variants = { art:{ url:'https://f/кіт.png' }, list: [
    { n:1, gid:'tee', name:'Футболка базова', color: cs[0].name || cs[0].id, mock:'https://m/1.png', files: f(1), place:{ spots:[] } },
    { n:2, gid:'tee', name:'Футболка базова', color: cs[1].name || cs[1].id, mock:'https://m/2.png', files: f(2), place:{ spots:[] } },
    { n:3, gid:'tee', name:'Футболка базова', color: cs[2].name || cs[2].id, mock:'https://m/3.png', files: f(3), place:{ spots:[] } }] };
  const d = D.readyGraphic(u, 'test@loomiq');
  D.dzVer(d, 'test@loomiq', f(0), 'Готовий', null, 'acct');
  d.vers[0].sentToClient = new Date().toISOString();
  D.sketchOkMark(d, 1, 'test@loomiq');
  const root = document.getElementById('dzRoot');
  U.setTab('acct'); U.open(''); U.render(root);
  await new Promise(r => setTimeout(r, 300));
  const card = root.querySelector('[data-open="2000102"]');
  const w = card && (card.closest('[draggable]') || card);
  const col = root.querySelector('.dz-board .dz-col[data-col="stitchq"]');
  if(!w || !col) return { err: 'немає картки чи колонки', col: [...root.querySelectorAll('.dz-col')].map(x => x.dataset.col).join() };
  const dt = new DataTransfer();
  w.dispatchEvent(new DragEvent('dragstart', { bubbles:true, dataTransfer: dt }));
  col.dispatchEvent(new DragEvent('drop', { bubbles:true, dataTransfer: dt, clientY: 200 }));
  await new Promise(r => setTimeout(r, 300));
  const вікно = { карток: document.querySelectorAll('.dz-pick .dz-var-c').length };
  const c3 = document.querySelector('.dz-pick .dz-var-c[data-pick="3"]');
  if(c3) c3.click();
  await new Promise(r => setTimeout(r, 400));
  const go = document.querySelector('.dz-cl [data-cl-go]');
  const одяг = !!go;
  if(go && !go.disabled) go.click();
  await new Promise(r => setTimeout(r, 600));
  return { вікно, одяг, pick: u.variants.pick, колір: u.color, треба: u.variants.list[2].color, ok: d.ok && d.ok.ver,
           мок: (D.verParts(d.vers[d.vers.length - 1]).mock[0] || {}).url };
});
console.log('  ' + JSON.stringify(крок4));
ok(крок4.вікно && крок4.вікно.карток === 3 && крок4.одяг && крок4.pick === 3 && крок4.колір === крок4.треба &&
   крок4.ok === 2 && крок4.мок === 'https://m/3.png',
  'готовий дизайн: перетягнули далі — спершу «Який варіант?» (3), обрали № 3 → його колір і мокап, погоджено v2',
  JSON.stringify(крок4));

console.log('');
console.log('═══ 5. ІНДИВІДУАЛЬНИЙ: ВАРІАНТИ РОБИТЬ ГРАФІЧНИЙ ДИЗАЙНЕР ═══');
const крок5 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('.dz-cl, .dz-pick').forEach(x => x.remove());
  const j = designJobMake('2000103');
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'', size:'M', qty:1, note:'лого', artKind:'kids' });
  j.units = [u];
  const d = D.dzNew(); d.who = 'test@loomiq'; d.sentAt = new Date().toISOString(); d.status = 'work';
  u.graphic = [d];
  D.dzVer(d, 'test@loomiq', [{ name:'робота.png', url:'https://f/робота.png', role:'work' }, { name:'Перед.png', url:'https://m/0.png', role:'mock' }], '', null, 'graphic');
  const root = document.getElementById('dzRoot');
  U.setTab('graphic'); U.open('2000103'); U.render(root);
  await new Promise(r => setTimeout(r, 300));
  const зона = !!document.querySelector('.dz-panel .dz-var [data-do="u-var-add"]');
  window.__ow = null;
  U.pickGarment = (cur, cb) => cb('tee');
  const cs = (U.catItem('tee') || {}).colors || [];
  U.pickColor = (gid, cb) => cb(cs[0].id);
  if(зона) document.querySelector('.dz-panel .dz-var [data-do="u-var-add"]').click();
  for(let k = 0; k < 30 && !window.__ow; k++) await new Promise(r => setTimeout(r, 100));
  return { зона, art: window.__ow && window.__ow.works[0].url };
});
console.log('  ' + JSON.stringify(крок5));
ok(крок5.зона && крок5.art === 'https://f/робота.png',
  'у панелі графічного дизайнера — «Варіанти на кількох виробах»; на варіант іде його робота з останньої версії',
  JSON.stringify(крок5));

console.log('═══ 6. ДИЗАЙНЕР ЗДАЄ ВАРІАНТИ МЕНЕДЖЕРУ, КЛІЄНТУ — ЛИШЕ МЕНЕДЖЕР (20.10) ═══');
const крок6 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('.dz-cl, .dz-pick, .mko-wrap').forEach(x => x.remove());
  const j = designJobs['2000103'], u = j.units[0];
  const d = D.dzList(u, 'graphic')[0];
  /* Два розміщені варіанти. */
  u.variants = { list: [{ n:1, gid:'tee', name:'Футболка', color:'Білий', mock:'https://m/v1.png' }, { n:2, gid:'tee', name:'Футболка', color:'Чорний', mock:'https://m/v2.png' }] };
  const root = document.getElementById('dzRoot');
  U.setTab('graphic'); U.open('2000103'); U.render(root);
  await new Promise(r => setTimeout(r, 300));
  const кнопки = { клієнту: !!document.querySelector('.dz-panel [data-do="u-var-send"]'),
                   менеджеру: !!document.querySelector('.dz-panel [data-do="u-var-hand"]'),
                   обрав: !!document.querySelector('.dz-panel [data-do="u-var-pick"]') };
  if(!кнопки.менеджеру) return { кнопки, html: ((document.querySelector('.dz-panel .dz-var') || {}).outerHTML || 'немає .dz-var').slice(0, 600), d: { st: d.status, v: d.vers.length, pend: !!d.pend } };
  window.LQMock.variantsCard = async () => 'data:image/png;base64,iVBORw0KGgo=';
  U.host.upload = async () => 'https://res/варіанти.png';
  let клієнту = 0; U.host.tellPic = async () => { клієнту++; return true; };
  const вер0 = d.vers.length;
  document.querySelector('.dz-panel [data-do="u-var-hand"]').click();
  for(let k = 0; k < 30 && d.vers.length === вер0; k++) await new Promise(r => setTimeout(r, 100));
  const lv = d.vers[d.vers.length - 1];
  U.render(root); await new Promise(r => setTimeout(r, 200));
  const після = { нова: d.vers.length === вер0 + 1, стан: d.status, vars: !!(D.verParts(lv).vars), ескіз: D.verParts(lv).work.length,
                  клієнту, закрито: !document.querySelector('.dz-panel [data-do="u-var-hand"]') && /Здано менеджеру/.test((document.querySelector('.dz-panel .dz-var') || {}).textContent || '') };
  /* Менеджер: «Надіслати клієнту» — аркуш ескіза, потім картка варіантів, одним надсиланням. */
  const пішло = [];
  U.host.tellPic = async (o, url, txt) => { пішло.push({ url, txt }); return true; };
  lv.files.push({ name:'аркуш-v' + lv.n + '.png', url:'https://res/аркуш.png', role:'sheet', v: 99 });
  contentData.team = (contentData.team || []).map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  U.setTab('acct'); U.open('2000103'); U.render(root);
  const сказано = []; const s0 = U.say; U.say = t => { сказано.push(t); try{ return s0 && s0(t); }catch(e){} };
  let fin = 'чекає';
  const go = U.act('dz-tell', root, { dz: u.id + '|graphic|0', v: lv.n }).then(() => { fin = 'завершилось'; }, e => { fin = 'помилка ' + e.message; });
  for(let k = 0; k < 30 && !document.querySelector('.dz-cf [data-cf="yes"]'); k++) await new Promise(r => setTimeout(r, 100));
  if(!document.querySelector('.dz-cf [data-cf="yes"]')) return { кнопки, після, err: 'вікно не відкрилось', fin, сказано, toast: (document.querySelector('#toast, .toast') || {}).textContent || '' };
  const вікно = [...document.querySelectorAll('.dz-cf .dz-cf-i')].map(i => i.getAttribute('src'));
  const текст = (document.querySelector('.dz-cf .dz-cf-t') || {}).value || '';
  document.querySelector('.dz-cf [data-cf="yes"]').click();
  await go;
  return { кнопки, після, вікно: вікно.map(decodeURIComponent), текст, пішло: пішло.map(x => decodeURIComponent(x.url)) };
});
console.log('  ' + JSON.stringify(крок6));
if(!крок6.після){ bad++; console.log('  ✗ немає кнопки здачі'); }
else {
ok(!крок6.кнопки.клієнту && крок6.кнопки.менеджеру && !крок6.кнопки.обрав,
  'у дизайнера — лише «Здати менеджеру», ні «Надіслати клієнту», ні «Клієнт обрав»', JSON.stringify(крок6.кнопки));
ok(крок6.після.нова && крок6.після.стан === 'review' && крок6.після.vars && крок6.після.ескіз > 0 && крок6.після.клієнту === 0 && крок6.після.закрито,
  'здав — нова версія (ескіз + картка варіантів) на перевірці, клієнту нічого, зона закрита', JSON.stringify(крок6.після));
ok(крок6.вікно.length === 2 && /аркуш/.test(крок6.вікно[0]) && /варіанти/.test(крок6.вікно[1]) && /варіанти на вибір/.test(крок6.текст) && /більше подобається/.test(крок6.текст),
  'менеджер: у вікні першим — аркуш ескіза, другим — варіанти; текст — заготовка «Варіанти на вибір»', JSON.stringify(крок6));
ok(крок6.пішло.length === 2 && /аркуш/.test(крок6.пішло[0]) && /варіанти/.test(крок6.пішло[1]),
  'клієнту пішло: ескіз, потім варіанти', JSON.stringify(крок6.пішло));
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nваріанти на кількох виробах — як домовились');
process.exit(bad ? 1 : 0);
