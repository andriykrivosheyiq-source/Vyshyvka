/* ТОВАР З ЦИМ ЕСКІЗОМ (18.10).

   Андрій: «один ескіз — ми можемо просто додати товар з цією ж картинкою…
   щоб не робити ще раз картинку… розміщення для першого зображення, для
   другого… перевірка двох зображень, одразу відсилалось». Ціна другого —
   «готовий / повторний», дизайнерам за нього не платимо; вишивальний файл
   один і платиться один раз; клієнту — окремі аркуші одним надсиланням.

   Запуск:  node tests/link-art.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8977;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' }],
  b2c: {},
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
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
  const cv = document.createElement('canvas'); cv.width = 20; cv.height = 20;
  window.__png = cv.toDataURL('image/png');
  window.LQMock.card = async () => window.__png;
  window.LQMock.openWork = opt => { window.__ow = opt; };
  window.__sent = [];
  window.__j = designJobMake('2000301');
  __j.units = [Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1, note:'Сова на грудях' })];
  window.__o = orders.find(x => x.orderId === '2000301');
  openDesign();
  U.host.upload = async f => 'https://up.test/' + encodeURIComponent((f && f.name) || 'f');
  U.host.sides = () => [{ key:'front', label:'Перед', url:'https://f/front.png' }, { key:'back', label:'Спина', url:'https://f/back.png' }];
  U.host.tellPic = async (o, url, txt) => { window.__sent.push({ url, txt }); return true; };
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
})()`;
await p.evaluate(SETUP);
await p.waitForTimeout(500);
const wait = async (f, n) => { for(let k = 0; k < (n || 40); k++){ const r = await p.evaluate(f); if(r) return r; await p.waitForTimeout(150); } return null; };
const owDone = () => p.evaluate(() => {
  const ow = window.__ow; window.__ow = null;
  return ow.onDone({ works: ow.works.map(w => Object.assign({}, w)),
    sides: [{ side:'front', label:'Перед', png: window.__png, places:[{ work:0, x:.5, y:.3, w:.26, wCm:12, hCm:10, topCm:7, sideCm:0 }] }],
    size:'M', нанесень:1, робіт:1 });
});

console.log('═══ 1. «＋ ТОВАР З ЦИМ ЕСКІЗОМ» ═══');
const add = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelector('#dzRoot [data-open="2000301"]').click();
  await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('.dz-panel [data-do="u-link-add"]');
  if(!b) return { err: 'немає кнопки' };
  U.pickGarment = (cur, cb) => cb('tee');
  b.click();
  await new Promise(r => setTimeout(r, 600));
  const l = __j.units[1];
  l.color = 'Білий'; l.size = 'L';
  await U.act('noop', document.getElementById('dzRoot'), {});
  U.render(document.getElementById('dzRoot'));
  const html = U.unitsHtml(__j, { o: __o });
  const box = document.createElement('div'); box.innerHTML = html;
  const us = box.querySelectorAll('.dz-u');
  return { n: __j.units.length, link: D.linkOf(l) === __j.units[0].id, gid: l.gid,
           linkBlock: !!us[1].querySelector('.dz-ready.is-link'), kind: !!us[1].querySelector('[data-uf$="|artKind"]'),
           mainKind: !!us[0].querySelector('[data-uf$="|artKind"]'),
           note: (us[0].querySelector('.dz-link-note') || {}).textContent || '',
           noAdd: !us[1].querySelector('[data-do="u-link-add"]'),
           wait: /Розмістимо, щойно буде ескіз позиції 1/.test(us[1].textContent),
           hand: D.handMissing(__j, __o) };
});
console.log('  ' + JSON.stringify(add));
ok(add.n === 2 && add.link && add.gid === 'tee', 'кнопка під позицією: нова позиція звʼязана з ескізом позиції 1, одразу вибір виробу', JSON.stringify(add));
ok(add.linkBlock && !add.kind && add.mainKind && add.noAdd, 'у звʼязаної — блок «Ескіз позиції 1», без типу малюнка й без своєї кнопки', JSON.stringify(add));
ok(/Цей ескіз також на: 2 Футболка/.test(add.note) && add.wait, 'на головній — «Цей ескіз також на: 2 Футболка…»; у звʼязаної — «розмістимо, щойно буде ескіз»', JSON.stringify(add));

console.log('');
console.log('═══ 2. ЦІНА: «ГОТОВИЙ / ПОВТОРНИЙ», ДИЗАЙНЕРАМ — НІЧОГО ═══');
const ціна = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  __j.units[0].artKind = 'k'; __j.units[0].artKindName = 'Складний';
  const rows = U.sumRows(__j);
  const l = rows.filter(r => r.design === 'той самий ескіз')[0] || {};
  const m = rows.filter(r => r.design === 'індивідуальний')[0] || {};
  return { l: l.price, lc: l.cost, m: m.price, dz: rows.filter(r => r.dzCost).length, назва: l.name };
});
console.log('  ' + JSON.stringify(ціна));
ok(ціна.l === 450 && ціна.lc === 250 && ціна.m === 1200, 'другий товар — за ціною «готовий / повторний» (450), головна — індивідуальна (1200)', JSON.stringify(ціна));
ok(ціна.dz <= 2, 'рядків оплати дизайнерам не більше, ніж у головної (у звʼязаної їх немає)', JSON.stringify(ціна));

console.log('');
console.log('═══ 3. ДИЗАЙНЕР ЗДАВ ЕСКІЗ → РОЗМІЩЕННЯ НА ДРУГОМУ ТОВАРІ ═══');
const здача = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const main = __j.units[0], l = __j.units[1];
  const d = D.dzNew(); d.who = 'p@loomiq'; d.sentAt = '2026-10-18T09:30:00.000Z'; d.sentBy = 'test@loomiq';
  main.graphic = [d];
  D.dzVer(d, 'p@loomiq', [{ name:'мокап.png', url:'https://f/mock1.png', role:'mock' }, { name:'сова.png', url:'https://f/sova.png', hash:'h1', role:'work' }], '',
    { works:[{ name:'сова.png', url:'https://f/sova.png', hash:'h1', threads:['1801'] }], spots:[{ side:'front', x:.5, y:.32, w:.3, work:0, wCm:14 }] }, 'graphic');
  const stale = D.linkStale(__j, l), arts = D.linkArts(main);
  window.__ow = null;
  U.act('dz-tell', document.getElementById('dzRoot'), { dz: main.id + '|graphic|0', v: 1 });
  await new Promise(r => setTimeout(r, 300));
  const ow = window.__ow;
  return { stale, art: arts[0] && arts[0].url, thr: arts[0] && (arts[0].threads || []).join(), ow: !!ow,
           place: ow && ow.placeOnly, works: ow && ow.works.map(w => w.url), gid: ow && ow.gid, name: ow && ow.name,
           x: ow && ow.places[0] && ow.places[0].y };
});
console.log('  ' + JSON.stringify(здача));
ok(здача.stale && здача.art === 'https://f/sova.png' && здача.thr === '1801', 'ескіз головної — та сама робота (з нитками) для другого товару', JSON.stringify(здача));
ok(здача.ow && здача.place && здача.gid === 'tee' && здача.works.join() === 'https://f/sova.png' && здача.x === 0.32 && /ескіз позиції 1/.test(здача.name),
  '«Надіслати» на головній спершу відкриває розміщення на футболці — та сама картинка на тому самому місці', JSON.stringify(здача));
await owDone();
const вікно = await wait(() => { const w = document.querySelector('.dz-cf.is-many'); return w ? { imgs: w.querySelectorAll('.dz-cf-is img').length, h: w.querySelector('.dz-cf-h').textContent } : null; });
console.log('  ' + JSON.stringify(вікно));
ok(вікно && вікно.imgs === 2 && /1 товар з цим ескізом/.test(вікно.h), 'вікно перевірки — обидва аркуші разом', JSON.stringify(вікно));
await p.evaluate(() => document.querySelector('.dz-cf [data-cf="yes"]').click());
const пішло = await wait(() => (window.__sent.length >= 2) ? true : null);
const після = await p.evaluate(() => {
  const D = window.LQDesign;
  const l = __j.units[1], g = D.dzList(l, 'graphic').filter(x => x.readyMade)[0];
  return { sent: window.__sent.map(x => [x.url.slice(0, 30), !!x.txt]), lv: g && g.vers.length, lsent: !!(g && g.vers[0].sentToClient),
           byAcct: !!(g && g.vers[0].byAcct), who: g && g.who, stale: D.linkStale(__j, l), chain: D.chainAt(__j, __o),
           mainSent: !!D.dzList(__j.units[0], 'graphic')[0].vers[0].sentToClient };
});
console.log('  ' + JSON.stringify(після));
ok(пішло && після.sent.length === 2 && після.sent[0][1] && !після.sent[1][1], '«Надіслати» — два аркуші клієнту: перший із текстом, другий слідом', JSON.stringify(після));
ok(після.lsent && після.mainSent && після.byAcct && !після.who && !після.stale && після.chain === 'client',
  'обидва позначені надісланими, розміщення другого — без дизайнера (не в зарплату); картка «У клієнта на погодженні»', JSON.stringify(після));

console.log('');
console.log('═══ 4. ПОГОДЖЕННЯ ОДНЕ, ФІКСАЦІЯ ОБОХ ═══');
const пог = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const main = __j.units[0], l = __j.units[1];
  await U.act('dz-ok-pick', document.getElementById('dzRoot'), { dz: main.id + '|graphic|0' });
  await new Promise(r => setTimeout(r, 300));
  const g = D.dzList(l, 'graphic').filter(x => x.readyMade)[0];
  return { m: D.sketchOk(D.dzList(main, 'graphic')[0]), l: D.sketchOk(g), chain: D.chainAt(__j, __o) };
});
console.log('  ' + JSON.stringify(пог));
ok(пог.m && пог.l && пог.chain === 'sketchok', '«Клієнт погодив» на головній — узгоджено й на другому товарі', JSON.stringify(пог));
await p.evaluate(() => { window.LQDesign.ui.act('dz-ok-pick', document.getElementById('dzRoot'), { dz: __j.units[0].id + '|graphic|0' }); });
const fx1 = await wait(() => { const b = document.querySelector('.dz-cl [data-cl-go]'); if(!b || b.disabled) return null; const h = document.querySelector('.dz-cl .dz-cf-h').textContent; b.click(); return h; });
const fx2 = await wait(() => { const b = document.querySelector('.dz-cl [data-cl-go]'); if(!b || b.disabled) return null; const h = document.querySelector('.dz-cl .dz-cf-h').textContent; b.click(); return h; });
await p.waitForTimeout(600);
const фікс = await p.evaluate(() => {
  const D = window.LQDesign;
  const main = __j.units[0], l = __j.units[1];
  return { fx: [!!main.confirmed, !!l.confirmed], ms: D.dzList(main, 'stitch').length, msPool: !!(D.dzList(main, 'stitch')[0] || {}).pool,
           ls: D.dzList(l, 'stitch').length, lok: !!D.dzList(l, 'graphic').filter(x => x.readyMade)[0].ok, chain: D.chainAt(__j, __o) };
});
console.log('  ' + JSON.stringify({ fx1, fx2, фікс }));
ok(fx1 && fx2 && /той самий ескіз/.test(fx2) && фікс.fx.every(Boolean) && фікс.lok, 'фіксація: вікно одягу на головній, потім на товарі з тим самим ескізом', JSON.stringify({ fx1, fx2, фікс }));
ok(фікс.ms === 1 && фікс.ls === 0 && фікс.chain === 'stitchq', 'у черзі вишивки — лише головна; другий товар чекає її файл, а не другого вишивальника', JSON.stringify(фікс));

console.log('');
console.log('═══ 5. ВИШИВАЛЬНИЙ ФАЙЛ ОДИН — І ОПЛАТА ОДНА ═══');
const вишивка = await p.evaluate(() => {
  const D = window.LQDesign;
  const main = __j.units[0], l = __j.units[1];
  const st = D.dzList(main, 'stitch')[0];
  st.who = 'p@loomiq'; st.takenAt = '2026-10-18T11:00:00.000Z';
  D.dzVer(st, 'p@loomiq', [{ name:'сова.dst', url:'https://f/sova.dst', role:'machine' }, { name:'wilcom.png', url:'https://f/w.png', role:'shot' }], '', null, 'stitch');
  D.dzOk(st, 'p@loomiq', 'auto', 1);
  D.dzAutoQueue(__j, __o, 'test@loomiq');
  const ls = D.dzList(l, 'stitch')[0];
  const ym = new Date().toISOString().slice(0, 7);
  const W = teamWork(ym);
  const pw = W['p@loomiq'] || {};
  D.dzAutoQueue(__j, __o, 'test@loomiq');
  return { ls: !!ls, ready: ls && ls.readyMade, ok: !!(ls && ls.ok), who: ls && ls.who,
           machine: ls ? D.verParts(ls.vers[ls.vers.length - 1]).machine.map(f => f.url) : [],
           vers: ls && ls.vers.length, chain: D.chainAt(__j, __o),
           stitchPay: (pw.stitch || []).length, designPay: (pw.design || []).length };
});
console.log('  ' + JSON.stringify(вишивка));
ok(вишивка.ls && вишивка.ready && вишивка.ok && !вишивка.who && вишивка.machine.join() === 'https://f/sova.dst',
  'здав вишивальний головну — той самий DST одразу і в другому товарі, без вишивальника', JSON.stringify(вишивка));
ok(вишивка.vers === 1 && вишивка.chain === 'prod', 'повторне збереження не дублює файл; обидва товари у виробництві', JSON.stringify(вишивка));
ok(вишивка.stitchPay === 1 && вишивка.designPay === 1, 'у зарплату — одна оцифровка й один ескіз, а не два', JSON.stringify(вишивка));

console.log('');
console.log('═══ 6. ЕСКІЗ ОНОВИВСЯ / ВИДАЛЕННЯ ГОЛОВНОЇ ═══');
const del = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('[data-close]').forEach(x => x.click());
  const j = designJobMake('2000302'), o = orders.find(x => x.orderId === '2000302');
  const main = Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1, note:'х' });
  const a = U.unitNew(), b = U.unitNew();
  D.linkAttach(a, main); D.linkAttach(b, main);
  a.gid = 'tee'; b.gid = 'tee';
  j.units = [main, a, b];
  /* Ескіз оновився після розміщення — треба розмістити ще раз. */
  const d = D.dzNew(); d.who = 'p@loomiq'; d.sentAt = 'x'; main.graphic = [d];
  D.dzVer(d, 'p', [{ name:'1.png', url:'https://f/1.png', hash:'1', role:'work' }], '', null, 'graphic');
  const g = D.readyGraphic(a, 'm'); D.dzVer(g, 'm', [{ url:'m', role:'mock' }], '', null, 'acct'); g.vers[0].linkArts = D.linkUrls(D.linkArts(main));
  const до = D.linkStale(j, a);
  D.dzVer(d, 'p', [{ name:'2.png', url:'https://f/2.png', hash:'2', role:'work' }], '', null, 'graphic');
  const після = D.linkStale(j, a);
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000302"]').click();
  await new Promise(r => setTimeout(r, 400));
  let n = 0;
  window.confirm = () => (n++ === 1);       // «разом?» — ні; «окремими?» — так
  await U.act('u-del', document.getElementById('dzRoot'), { u: main.id });
  const окремо = { n: j.units.length, links: j.units.filter(x => D.linkOf(x)).length, ready: j.units.filter(x => x.ready).length };
  const j2 = designJobMake('2000302');
  const m2 = Object.assign(U.unitNew(), { gid:'hoodie' }), c = U.unitNew(); D.linkAttach(c, m2);
  j2.units = [m2, c, Object.assign(U.unitNew(), { gid:'tee' })];
  window.confirm = () => true;
  await U.act('u-del', document.getElementById('dzRoot'), { u: m2.id });
  return { до, після, окремо, разом: j2.units.length };
});
console.log('  ' + JSON.stringify(del));
ok(!del.до && del.після, 'дизайнер здав нову версію — товар з цим ескізом просить розмістити ще раз', JSON.stringify(del));
ok(del.окремо.n === 2 && del.окремо.links === 0 && del.окремо.ready === 0, 'прибрали головну, «окремими» — товари лишились, кожен індивідуальний', JSON.stringify(del));
ok(del.разом === 1, 'прибрали головну «разом» — пішли й товари з її ескізом, чужі лишились', JSON.stringify(del));

console.log('');
console.log('═══ 7. ГОТОВИЙ ДИЗАЙН + ТОВАР З НИМ ═══');
await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('[data-close]').forEach(x => x.click());
  window.__sent = [];
  const j = designJobMake('2000302');
  const main = Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1 });
  D.readyAttach(main, { id:'rd1', name:'Котик', pic:'https://f/cat.png', arts:[{ name:'кіт.png', url:'https://f/cat.png' }], files:[{ name:'кіт.dst', url:'https://f/cat.dst' }] });
  const l = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'S', qty:1 });
  D.linkAttach(l, main);
  j.units = [main, l];
  window.__j3 = j;
  openDesign();
  U.host.upload = async f => 'https://up.test/' + encodeURIComponent((f && f.name) || 'f');
  U.host.sides = () => [{ key:'front', label:'Перед', url:'https://f/front.png' }];
  U.host.tellPic = async (o, url, txt) => { window.__sent.push({ url, txt }); return true; };
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('#dzRoot [data-open="2000302"]').click();
  await new Promise(r => setTimeout(r, 400));
  window.__ow = null;
  U.act('u-ready-place', document.getElementById('dzRoot'), { u: main.id });
});
const ow1 = await wait(() => window.__ow ? window.__ow.name : null);
await owDone();
const ow2 = await wait(() => window.__ow ? { name: window.__ow.name, art: window.__ow.works[0].url } : null);
if(ow2) await owDone();
const w7 = await wait(() => { const w = document.querySelector('.dz-cf.is-many'); return w ? w.querySelectorAll('.dz-cf-is img').length : null; });
if(w7) await p.evaluate(() => document.querySelector('.dz-cf [data-cf="yes"]').click());
await wait(() => window.__sent.length >= 2 ? true : null);
const r7 = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const rows = U.sumRows(__j3);
  return { sent: window.__sent.length, chain: D.chainAt(__j3, orders.find(x => x.orderId === '2000302')),
           prices: rows.filter(r => r.design).map(r => r.design + ':' + r.price) };
});
console.log('  ' + JSON.stringify({ ow1, ow2, w7, r7 }));
ok(/Котик/.test(ow1 || '') && ow2 && ow2.art === 'https://f/cat.png' && /ескіз позиції 1/.test(ow2.name),
  'готовий дизайн: розмістили на худі — одразу розміщення того самого принта на футболці', JSON.stringify({ ow1, ow2 }));
ok(w7 === 2 && r7.sent === 2 && r7.chain === 'client', 'далі одне вікно перевірки з двома аркушами — і обидва пішли клієнту', JSON.stringify({ w7, r7 }));
ok(r7.prices.join() === 'готовий дизайн:950,той самий ескіз:450', 'ціни: готовий худі 950, футболка з тим самим — 450', JSON.stringify(r7.prices));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'той самий ескіз на кількох товарах: одна картинка, окремі розміщення, одна оплата');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
