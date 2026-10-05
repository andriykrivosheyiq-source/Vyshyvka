/* ПІСЛЯ ПОГОДЖЕННЯ ГРАФІКИ: ДАНІ, РОЗМІЩЕННЯ, ЗАКУПІВЛЯ, ЦЕХ.

   Андрій (01.10):
   • у вишивку (і закупнику) позиція не йде, поки не заповнено модель,
     колір, розмір і кількість; кількість не підставляється;
   • менеджер може поправити розміщення, поки позиція не пішла у вишивку;
   • вишивальний здає кілька DST/EMB і кілька скрінів;
   • усі файли скачуються з підписом: номер, v1, дизайн1 (якщо дизайнів
     кілька); мокап — ще й одяг, розмір, колір і ширина виробу;
   • закупник галочками оформлює замовлення закупівлі (№, дата), решта
     лишається; до закупівлі — ТТН і стан;
   • цех бачить біля одягу стан закупівлі й ТТН, файли й картку з
     відступами.

   Запуск:  node tests/b2c-buy.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8961;
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
  team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  b2c: { dzHours: 24 }
};
const ORDERS = [
  { id:'1', orderId:'2000201', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'2', orderId:'2000202', type:'client', dir:'b2c', name:'Богдан', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] }
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
const ctx = await browser.newContext({ viewport:{ width:1500, height:940 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('console', m => { if(/скачування/.test(m.text())) console.log('    [console] ' + m.text().slice(0, 300)); });
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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PNGURL = 'data:image/png;base64,' + PNG.toString('base64');
await p.evaluate((PNGURL) => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  /* Перше замовлення: дві позиції, у першої даних бракує. Друге — одна
     повна позиція (для закупівлі з двох замовлень). */
  const j = designJobMake('2000201');
  j.units = [
    Object.assign(U.unitNew(), { gid:'polo', name:'Поло', color:'', size:'', note:'Лого' }),
    Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'L', qty:3, note:'Лого' })];
  const j2 = designJobMake('2000202');
  j2.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:2, note:'Лого' })];
  window.__j = j; window.__o = orders.find(x => x.orderId === '2000201');
  window.__j2 = j2; window.__o2 = orders.find(x => x.orderId === '2000202');
  openDesign();
  U.host.upload = async f => 'https://cdn.test/' + encodeURIComponent(f.name || 'f');
  U.host.widthCm = () => 52;
  /* Футболки — у «Текстиль-Ко», поло — без підрядника. */
  U.host.supplier = gid => gid === 'tee' ? { id:'s1', name:'Текстиль-Ко' } : null;
  U.host.sides = () => [{ key:'front', label:'Перед', url: PNGURL }];
  window.LQMock.host.widthCm = () => 52;
  window.LQMock.host.cal = () => ({ x1:0.2, x2:0.8, y:0.15 });
  window.LQMock.host.calSave = () => {};
  /* Розмітка виробу з «Областей нанесення»: верх/низ і краї, висота 70 см. */
  window.LQMock.host.zone = () => ({ T:0.1, B:0.9, L:0.2, R:0.8, H:70 });
  U.host.zone = () => ({ T:0.1, B:0.9, L:0.2, R:0.8, H:70 });
  /* Графіка обох замовлень здана й погоджена — одним рухом. */
  const D = window.LQDesign;
  [j, j2].forEach(job => job.units.forEach((u, k) => {
    const d = D.dzNew(); D.dzList(u, 'graphic').push(d);
    D.dzAttach(d, 'test@loomiq', 'test@loomiq', 'Андрій'); D.dzSend(d, 'test@loomiq');
    D.dzVer(d, 'test@loomiq', [{ name:'Перед.png', url:'https://x/m' + k + '.png', role:'mock' },
      { name:'лого.png', url: PNGURL, role:'work', hash:'h' + k }], '',
      { works:[{ name:'лого.png', url: PNGURL, hash:'h' + k }],
        spots:[{ side:'front', label:'Перед', work:0, x:0.5, y:0.3, w:0.25,
                 wCm:21.7, hCm:21.7, topCm:12.1, sideCm:0 }],
        wCm:21.7, hCm:21.7, topCm:12.1, sideCm:0, size: u.size }, 'graphic');
  }));
}, PNGURL);

const стіч = () => p.evaluate(() => __j.units.map(u => window.LQDesign.dzList(u, 'stitch').length));

console.log('═══ 0. ГРАФІКА — БЕЗ ОДЯГУ ═══');
/* Андрій: «графічному показується любе замовлення, де є картинка або
   коментар. Одяг не обовʼязковий». */
const безОдягу = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  orders.unshift({ id:'3', orderId:'2000203', type:'client', dir:'b2c', name:'В', status:'prorahunok',
                   site:'main', payments:[], hist:[], createdAt:new Date().toISOString(), totalPrice:0, items:[] });
  const j = designJobMake('2000203');
  j.units = [Object.assign(U.unitNew(), { pics:[{ name:'ref.png', url:'https://x/ref.png' }] })];
  const o = orders.find(x => x.orderId === '2000203');
  window.__j3 = j; window.__o3 = o;
  D.dzAutoQueue(j, o, 'test@loomiq');
  const до = (D.dzList(j.units[0], 'graphic')[0] || null);
  U.setTab('acct'); U.open('2000203'); U.render(document.getElementById('dzRoot'));
  const кн = document.querySelector('.dz-panel [data-do="dz-hand-all"]');
  const живе = !!(кн && !кн.disabled);
  if(кн) кн.click();
  await new Promise(r => setTimeout(r, 400));
  const d = D.dzList(j.units[0], 'graphic')[0];
  return { самЗберіг: !!(до && D.dzInQueue(до)), живе, черга: !!(d && D.dzInQueue(d)),
           підпис: ((document.querySelector('.dz-panel .dz-hand-all i') || {}).textContent || '') };
});
ok(!безОдягу.самЗберіг, 'саме збереження в чергу не ставить', 'стало в чергу без кнопки');
ok(безОдягу.живе && безОдягу.черга && /Передано дизайнерам/.test(безОдягу.підпис),
  '«Зберегти й передати дизайнерам»: позиція лише з картинкою, без виробу — у черзі графічного відділу',
  'не стала в чергу: ' + JSON.stringify(безОдягу));
await p.evaluate(() => { const D = window.LQDesign; D.dzClaim(D.dzList(__j3.units[0], 'graphic')[0], 'test@loomiq');
  const U = D.ui; U.setTab('graphic'); U.open('2000203'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
const здача0 = await p.evaluate(() => ({
  кнопка: !!document.querySelector('.dz-panel [data-do="dz-art-only"]'),
  вікно: !!document.querySelector('.dz-panel [data-do="dz-work"]'),
  підказка: ((document.querySelector('.dz-panel .dz-w-send .dz-miss') || {}).textContent || '') }));
ok(здача0.кнопка && !здача0.вікно && /Виріб ще не обрано/.test(здача0.підказка),
  'дизайнер без виробу здає саму роботу — без вікна мокапу, і сказано чому', 'здача: ' + JSON.stringify(здача0));
/* Під нитки — обовʼязково й тут. Завантаження віддає data-URL, щоб
   адаптація могла прочитати картинку; ескіз — червоне коло на білому. */
const ЕСКІЗ = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 120;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 120, 120);
  x.fillStyle = '#C8102E'; x.beginPath(); x.arc(60, 60, 40, 0, 7); x.fill();
  window.__upBak = window.LQDesign.ui.host.upload;
  window.LQDesign.ui.host.upload = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  return c.toDataURL('image/png').split(',')[1]; });
const [fc0] = await Promise.all([p.waitForEvent('filechooser'),
  p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-art-only"]').click())]);
await fc0.setFiles({ name:'ескіз.png', mimeType:'image/png', buffer: Buffer.from(ЕСКІЗ, 'base64') });
await p.waitForSelector('.dz-th [data-thgo]:not([disabled])', { timeout: 30000 });
await p.evaluate(() => document.querySelector('.dz-th [data-thgo]').click());
await p.waitForFunction(() => window.LQDesign.dzList(__j3.units[0], 'graphic')[0].vers.length > 0, null, { timeout: 20000 });
const в0 = await p.evaluate(() => { const d = window.LQDesign.dzList(__j3.units[0], 'graphic')[0];
  window.LQDesign.ui.host.upload = window.__upBak;
  const v = d.vers[d.vers.length - 1] || {}; return { стан: d.status, файли: (v.files || []).map(f => f.role).sort(),
    нитки: ((v.place || {}).threads || []).length }; });
ok(в0.стан === 'review' && в0.файли.join() === 'orig,svg,work' && в0.нитки >= 1,
  'версія — сама робота (адаптована під нитки) + оригінал і SVG, на перевірці в менеджера', 'версія: ' + JSON.stringify(в0));
await p.evaluate(() => { __j3.units[0].gid = 'tee'; __j3.units[0].color = 'Чорний';
  const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(200);
ok(await p.evaluate(() => !!document.querySelector('.dz-panel [data-do="dz-work"]')),
  'виріб обрали — у дизайнера з’явилось вікно з мокапом', 'вікна мокапу немає після вибору виробу');

console.log('');
console.log('═══ 1. ПОГОДЖЕННЯ ЕСКІЗУ = ПІДТВЕРДЖЕННЯ ОДЯГУ ═══');
ok(await p.evaluate(() => window.LQDesign.ui.unitNew().qty) === '',
  'нова позиція — без кількості: нічого не підставляємо', 'кількість у новій позиції не порожня');
await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  U.setTab('acct'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
  for(let k = 0; k < 2; k++)
    await U.act('dz-ok', document.getElementById('dzRoot'), { dz: __j.units[k].id + '|graphic|0', v: 1, how:'client' });
});
await p.waitForTimeout(400);
ok(JSON.stringify(await стіч()) === '[0,0]',
  'ескізи погоджено, але одяг не підтверджено — у вишивку не пішло нічого', 'вишивка: ' + JSON.stringify(await стіч()));
ok(await p.evaluate(() => window.LQDesign.buyNeed(window.LQDesign.ui.pairs(), []).length) === 0,
  'і закупнику теж нічого, хоч у другій позиції дані вписані', 'закупівля бачить непідтверджене');
const червоне = await p.evaluate(() => {
  const U = window.LQDesign.ui; U.SIDE[__j.units[0].id] = 'stitch'; U.SIDE[__j.units[1].id] = 'stitch';
  U.render(document.getElementById('dzRoot'));
  const u0 = document.querySelectorAll('.dz-panel .dz-u')[0];
  return { блок: ((u0.querySelector('.dz-need') || {}).textContent || ''),
           поля: [...u0.querySelectorAll('.need')].length,
           кнопок: document.querySelectorAll('.dz-panel [data-do="u-cloth"]').length };
});
console.log('  ' + JSON.stringify(червоне));
ok(/підтвердіть одяг/.test(червоне.блок) && /колір, розмір, кількість/.test(червоне.блок) && червоне.поля === 3 && червоне.кнопок === 2,
  'у позиції — «підтвердіть одяг», чого бракує, порожні поля червоні, кнопка «Підтвердити одяг»', 'позиція: ' + JSON.stringify(червоне));
/* Друга позиція: дані є — вікно з підставленими, підтвердили. */
await p.evaluate(() => document.querySelectorAll('.dz-panel [data-do="u-cloth"]')[1].click());
await p.waitForTimeout(200);
const вікноОдягу = await p.evaluate(() => ({ поля: [...document.querySelectorAll('.dz-cl [data-cl]')].map(x => x.value),
  живе: !document.querySelector('.dz-cl [data-cl-go]').disabled }));
ok(вікноОдягу.поля.join() === 'tee,Чорний,L,3' && вікноОдягу.живе, 'вікно одягу: модель, колір, розмір, кількість — підставлені', 'вікно: ' + JSON.stringify(вікноОдягу));
await p.evaluate(() => document.querySelector('.dz-cl [data-cl-go]').click());
await p.waitForTimeout(400);
ok(JSON.stringify(await стіч()) === '[0,1]', 'підтвердили — позиція у вишивці', 'вишивка: ' + JSON.stringify(await стіч()));
/* Перша: бракує даних — «Підтвердити» не живе. */
await p.evaluate(() => document.querySelector('.dz-panel [data-do="u-cloth"]').click());
await p.waitForTimeout(200);
const мертва = await p.evaluate(() => { const b = document.querySelector('.dz-cl [data-cl-go]'); const r = !!(b && b.disabled);
  const x = document.querySelector('.dz-cl [data-cl-no]'); if(x) x.click(); return r; });
ok(мертва, 'чого бракує — «Підтвердити» неактивна', 'підтвердили з порожніми полями');
await p.evaluate(async () => {
  const u = __j.units[0]; u.color = 'Білий'; u.size = 'S'; u.qty = 1;
  window.LQDesign.clothConfirm(u, 'test@loomiq');
  await window.LQDesign.ui.save(__j, __o, '');
});
await p.waitForTimeout(300);
ok(JSON.stringify(await стіч()) === '[1,1]', 'заповнили й підтвердили — позиція сама стала в чергу вишивки', 'вишивка: ' + JSON.stringify(await стіч()));
/* Порожній рядок дизайну не тримає погодження, напис — про ескіз. */
const напис = await p.evaluate(() => { const D = window.LQDesign, U = D.ui;
  const u = U.unitNew(); u.graphic = [D.dzNew()];
  const a = D.graphicOk(u);
  const d1 = D.dzNew(); d1.who = 'x'; d1.ok = { ver:1 }; const d2 = D.dzNew(); d2.who = 'y';
  u.graphic = [d1, d2];
  return { порожній: a, ще: D.graphicOk(u) }; });
ok(напис.порожній === true && напис.ще === false, 'порожній рядок дизайну не тримає; не погоджений справжній — тримає', 'graphicOk: ' + JSON.stringify(напис));

console.log('');
console.log('═══ 2. ПІДПИСИ ФАЙЛІВ ═══');
const імена = await p.evaluate(() => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const a = U.dlNames(U.unitNo(__j, __j.units[1]), __j.units[1], 'graphic', 0, 2);
  const b = U.dlNames(U.unitNo(__j2, __j2.units[0]), __j2.units[0], 'graphic', 0, 1);
  /* Два дизайни на позиції — тоді й номер дизайну. */
  D.dzList(__j2.units[0], 'graphic').push(D.dzNew());
  const c = U.dlBase(U.unitNo(__j2, __j2.units[0]), __j2.units[0], 'graphic', 1, 3);
  D.dzList(__j2.units[0], 'graphic').pop();
  return { a, b, c };
});
console.log('  ' + JSON.stringify(імена));
const N1 = await p.evaluate(() => String(__j.no)), N2 = await p.evaluate(() => String(__j2.no));
ok(імена.a.base === N1 + '-2_v2', 'дві позиції: «' + N1 + '-2_v2»', 'основа: ' + імена.a.base);
ok(імена.b.base === N2 + '_v1', 'одна позиція: без номера позиції — «' + N2 + '_v1»', 'основа: ' + імена.b.base);
ok(імена.c === N2 + '_v3_дизайн2', 'кілька дизайнів: «…_v3_дизайн2»', 'основа: ' + імена.c);
ok(new RegExp('^' + N1 + '-2_v2_.+_L_Чорний_52см$').test(імена.a.mock), 'мокап: + одяг, розмір, колір, ширина виробу', 'мокап: ' + імена.a.mock);

console.log('');
console.log('═══ 3. МЕНЕДЖЕР ПРАВИТЬ РОЗМІЩЕННЯ — ДО ВИШИВКИ ═══');
/* Друге замовлення ще не у вишивці (немає даних? є) — знімаємо вишивку, щоб
   розміщення було відкрите, і правимо погоджений ескіз. */
await p.evaluate(() => {
  const D = window.LQDesign;
  __j2.units[0].qty = '';                     // без кількості — у вишивку не піде
  D.dzList(__j2.units[0], 'graphic')[0].ok = null;
  D.dzOk(D.dzList(__j2.units[0], 'graphic')[0], 'test@loomiq', 'client', 1);
  const U = D.ui; U.setTab('acct'); U.open('2000202'); U.SIDE[__j2.units[0].id] = 'graphic';
  U.render(document.getElementById('dzRoot'));
});
await p.waitForTimeout(300);
const кнопка = await p.evaluate(() => [...document.querySelectorAll('.dz-panel [data-do="dz-place"]')].length);
ok(кнопка === 1, 'у картці погодженого ескізу — «✎ Розміщення»', 'кнопок: ' + кнопка);
await p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-place"]').click());
await p.waitForTimeout(800);
const вікно = await p.evaluate(() => ({
  є: !!document.querySelector('.mko-wrap'),
  завантажити: !!document.querySelector('.mko-wrap [data-mko-up]'),
  фон: !!document.querySelector('.mko-wrap .mko-bg'),
  нанесень: document.querySelectorAll('.mko-wrap .mko-art').length,
  кнопка: ((document.querySelector('.mko-wrap [data-mko-save]') || {}).textContent || '') }));
console.log('  ' + JSON.stringify(вікно));
ok(вікно.є && !вікно.завантажити && !вікно.фон && вікно.нанесень === 1 && /розміщення/i.test(вікно.кнопка),
  'вікно розкладки: те саме нанесення на місці, без завантаження й фону', 'вікно: ' + JSON.stringify(вікно));
await p.evaluate(() => document.querySelector('.mko-wrap [data-mko-save]').click());
await p.waitForTimeout(1500);
const нова = await p.evaluate(() => { const d = window.LQDesign.dzList(__j2.units[0], 'graphic')[0];
  const v = d.vers[d.vers.length - 1];
  return { n: v.n, ак: !!v.byAcct, ок: d.ok && d.ok.ver, стан: d.status,
           місце: (v.place.spots || []).map(s => s.side + ':' + s.wCm + ':' + s.topCm) }; });
console.log('  ' + JSON.stringify(нова));
ok(нова.n === 2 && нова.ак && нова.ок === 2 && нова.стан === 'approved',
  'вийшла версія 2 від менеджера, погодження перейшло на неї', 'версія: ' + JSON.stringify(нова));
ok(нова.місце.length === 1 && /^front:\d/.test(нова.місце[0]) && !/:0$/.test(нова.місце[0]),
  'розміщення порахувалось у сантиметрах', 'місце: ' + JSON.stringify(нова.місце));
await p.evaluate(async () => { __j2.units[0].qty = 2; window.LQDesign.clothConfirm(__j2.units[0], 'test@loomiq');
  await window.LQDesign.ui.save(__j2, __o2, ''); });
await p.waitForTimeout(300);
const замок = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  U.render(document.getElementById('dzRoot'));
  return { stitch: window.LQDesign.dzList(__j2.units[0], 'stitch').length,
           кнопок: document.querySelectorAll('.dz-panel [data-do="dz-place"]').length };
});
ok(замок.stitch === 1 && замок.кнопок === 0, 'пішло у вишивку — розміщення більше не правиться', 'замок: ' + JSON.stringify(замок));

console.log('');
console.log('═══ 4. ВИШИВАЛЬНИЙ ЗДАЄ КІЛЬКА ФАЙЛІВ ═══');
await p.evaluate(() => { const D = window.LQDesign; const d = D.dzList(__j.units[1], 'stitch')[0];
  D.dzClaim(d, 'test@loomiq'); const U = D.ui; U.setTab('stitch'); U.open('2000201'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const бриф = await p.evaluate(() => [...document.querySelectorAll('.dz-panel .dz-spot')].map(x => x.textContent.replace(/\s+/g, ' ')));
console.log('  ' + JSON.stringify(бриф));
ok(бриф.length && бриф.every(t => /^Ширина вишивки\s?21,7 см$/.test(t)) && !бриф.some(t => /горловини|виробу|52/.test(t)),
  'у брифі вишивальника — лише ширина вишивки, без відступів і ширини виробу', 'бриф: ' + JSON.stringify(бриф));
await p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-stitch-up"][data-dz^="' + __j.units[1].id + '|"]').click());
await p.waitForTimeout(300);
const [fc1] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.querySelector('.dz-su [data-su="file"]').click())]);
await fc1.setFiles([{ name:'перед.DST', mimeType:'application/octet-stream', buffer: Buffer.from('1') },
                    { name:'спина.emb', mimeType:'application/octet-stream', buffer: Buffer.from('2') },
                    { name:'зайве.png', mimeType:'image/png', buffer: PNG }]);
await p.waitForTimeout(500);
const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.querySelector('.dz-su [data-su="shot"]').click())]);
await fc2.setFiles([{ name:'w1.png', mimeType:'image/png', buffer: PNG }, { name:'w2.png', mimeType:'image/png', buffer: PNG },
                    { name:'w3.png', mimeType:'image/png', buffer: PNG }]);
await p.waitForTimeout(500);
const вибрано = await p.evaluate(() => ({ файли: document.querySelectorAll('.dz-su .dz-su-ok').length,
                                          скріни: document.querySelectorAll('.dz-su .dz-su-p').length }));
ok(вибрано.файли === 2 && вибрано.скріни === 3, 'два файли для машини (PNG відсіяно) і три скріни', 'вибрано: ' + JSON.stringify(вибрано));
await p.evaluate(() => document.querySelectorAll('.dz-su [data-su="shot-x"]')[2].click());
await p.waitForTimeout(200);
await p.evaluate(() => document.querySelector('.dz-su [data-su="go"]').click());
await p.waitForTimeout(600);
const здано = await p.evaluate(() => { const d = window.LQDesign.dzList(__j.units[1], 'stitch')[0];
  return (d.vers[d.vers.length - 1].files || []).map(f => f.role + ':' + f.name); });
console.log('  ' + JSON.stringify(здано));
ok(здано.filter(x => /^machine:/.test(x)).length === 2 && здано.filter(x => /^shot:/.test(x)).length === 2,
  'у версії два файли для машини й два скріни (третій прибрали)', 'версія: ' + JSON.stringify(здано));
const плиткиВ = await p.evaluate(() => [...document.querySelectorAll('.dz-panel .dz-tile-f')].map(b => b.dataset.name));
console.log('  ' + JSON.stringify(плиткиВ));
ok(плиткиВ.indexOf(N1 + '-2_v1.dst') >= 0 && плиткиВ.indexOf(N1 + '-2_v1.emb') >= 0,
  'файли для машини скачуються з підписом замовлення', 'імена: ' + JSON.stringify(плиткиВ));
await p.evaluate(async () => {
  const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
  await U.act('dz-ok', document.getElementById('dzRoot'), { dz: __j.units[1].id + '|stitch|0', v: 1, how:'acct' });
});
await p.waitForTimeout(300);

console.log('');
console.log('═══ 5. ЗАКУПІВЛЯ: ГАЛОЧКАМИ — ОФОРМИТИ ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('supply'); U.open(''); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const треба = await p.evaluate(() => ({
  підрядники: [...document.querySelectorAll('.dz-buy-need .dz-buy-suph')].map(g => g.textContent.replace(/\s+/g, ' ').trim()),
  рядки: [...document.querySelectorAll('.dz-buy-need .dz-buy-g')].map(g => g.textContent.replace(/\s+/g, ' ').trim()),
  кнопка: !!document.querySelector('[data-do="buy-make"][disabled]'),
  дошка: document.querySelectorAll('.dz-col').length, склад: !!document.querySelector('[data-do="buy-tab"][data-k="stock"]') }));
console.log('  ' + JSON.stringify(треба));
ok(треба.підрядники.length === 2 && /Текстиль-Ко/.test(треба.підрядники[0]) && /5 шт/.test(треба.підрядники[0]) &&
   /Підрядник не вказаний/.test(треба.підрядники[1]),
  'потреба — за підрядниками; без підрядника — окремо, з підказкою', 'підрядники: ' + JSON.stringify(треба.підрядники));
ok(треба.рядки.some(t => /Чорний/.test(t) && /5 шт/.test(t) && /L/.test(t) && /M/.test(t)),
  'усередині — виріб · колір → розміри (чорні M і L з двох замовлень разом)', 'потреба: ' + JSON.stringify(треба.рядки));
ok(треба.кнопка && треба.дошка === 0 && треба.склад, 'нічого не позначено — «Оформити» неактивна; канбана немає, є вкладка «Склад»', 'екран: ' + JSON.stringify(треба));
/* Позначаємо лише чорні L: розгортаємо номери й ставимо одну галочку. */
await p.evaluate(() => {
  const s = [...document.querySelectorAll('.dz-buy-s')].find(x => /Чорний/.test(x.closest('.dz-buy-g').textContent) && /\bL\b/.test(x.textContent));
  s.querySelector('[data-do="buy-open"]').click();
});
await p.waitForTimeout(200);
const номери = await p.evaluate(() => [...document.querySelectorAll('.dz-buy-r label')].map(x => x.textContent.replace(/\s+/g, ' ')));
ok(номери.length === 1 && номери[0].indexOf('#' + N1 + '-2') >= 0, 'розгорнули — видно, під яке замовлення', 'номери: ' + JSON.stringify(номери));
await p.evaluate(() => { const c = document.querySelector('.dz-buy-r input'); c.checked = true; c.dispatchEvent(new Event('change')); });
await p.waitForTimeout(200);
const кн = await p.evaluate(() => (document.querySelector('[data-do="buy-make"]') || {}).textContent);
ok(/3 шт/.test(кн), 'на кнопці — скільки штук піде', 'кнопка: ' + кн);
await p.evaluate(() => document.querySelector('[data-do="buy-make"]').click());
await p.waitForTimeout(600);
const перша = await p.evaluate(() => ({ docs: Object.values(designBuys).map(b => ({ n: b.n, rows: b.rows.length, st: b.status })),
  груп: document.querySelectorAll('.dz-buy-need .dz-buy-g').length,
  історія: [...document.querySelectorAll('.dz-buy-o .dz-buy-oh b')].map(x => x.textContent),
  трек: (__o.tracks || {}).supply }));
console.log('  ' + JSON.stringify(перша));
ok(перша.docs.length === 1 && перша.docs[0].n === 1 && перша.docs[0].rows === 1 && перша.історія[0] && /^Закупівля №1 від \d\d\.\d\d$/.test(перша.історія[0]),
  'оформлено «Закупівля №1 від дд.мм» — рівно з позначеного', 'закупівля: ' + JSON.stringify(перша));
ok(перша.груп === 2, 'решта лишилась у списку до наступного разу', 'потреба після: ' + перша.груп);
ok(перша.трек === 'sent', 'трек «Закупки» замовлення — «Замовлено» (частина позицій замовлена)', 'трек: ' + перша.трек);
/* Склад: одне біле поло S уже лежить — беремо зі складу, не купуємо. */
await p.evaluate(async () => { await window.LQDesign.ui.host.stockSave([{ gid:'polo', name:'Поло', color:'Білий', size:'S', qty:1 }]);
  window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
/* 04.10: потреба ділиться сама — поло, що лежить на складі, ліворуч
   («Треба замовити») вже немає, воно праворуч («Можна взяти зі складу»). */
const склад = await p.evaluate(() => ({ є: ((document.querySelector('.dz-buy-take .dz-buy-have') || {}).textContent || ''),
  справа: ((document.querySelector('.dz-buy-take') || {}).textContent || '').replace(/\s+/g, ' '),
  зліва: [...document.querySelectorAll('.dz-buy-need .dz-buy-g')].map(g => g.textContent.replace(/\s+/g, ' ')) }));
ok(/на складі 1/.test(склад.є) && /Поло/.test(склад.справа) && !склад.зліва.some(t => /Поло/.test(t)),
  'поло зі складу — праворуч «Можна взяти зі складу» (на складі 1), ліворуч його немає', 'склад: ' + JSON.stringify(склад));
await p.evaluate(() => { const c = document.querySelector('[data-taker]'); c.checked = true; c.dispatchEvent(new Event('change')); });
await p.waitForTimeout(200);
await p.evaluate(() => document.querySelector('[data-do="take-make"]').click());
await p.waitForTimeout(600);
const зіСкладу = await p.evaluate(() => { const b = Object.values(designBuys).find(x => x.stock);
  return { є: !!b, st: b && b.status, лишок: window.LQDesign.ui.host.stock().length,
           в: [...document.querySelectorAll('.dz-buy-o .dz-buy-oh b')].map(x => x.textContent) }; });
ok(зіСкладу.є && зіСкладу.st === 'got' && зіСкладу.лишок === 0 && зіСкладу.в.some(t => /^Зі складу від/.test(t)),
  'позицію закрито зі складу — одразу «Отримано», склад зменшився', 'склад: ' + JSON.stringify(зіСкладу));
/* Друге оформлення того ж дня — усе, що лишилось, галочкою підрядника. */
await p.evaluate(() => document.querySelectorAll('[data-buyp]').forEach(c => { c.checked = true; c.dispatchEvent(new Event('change')); }));
await p.waitForTimeout(200);
await p.evaluate(() => document.querySelector('[data-do="buy-make"]').click());
await p.waitForTimeout(600);
const друга = await p.evaluate(() => ({ ns: Object.values(designBuys).filter(b => !b.stock).map(b => b.n).sort(),
  підрядник: (Object.values(designBuys).find(b => b.n === 2) || {}).sup,
  день: [...document.querySelectorAll('.dz-buy-day')].map(x => x.textContent),
  порожньо: !document.querySelector('.dz-buy-need .dz-buy-g') }));
ok(JSON.stringify(друга.ns) === '[1,2]' && друга.підрядник && друга.підрядник.name === 'Текстиль-Ко' && друга.порожньо &&
   друга.день.length === 1 && /^Замовлення за \d\d\.\d\d$/.test(друга.день[0]),
  'друге оформлення — №2 у «Текстиль-Ко», під «Замовлення за дд.мм», список порожній', 'закупівлі: ' + JSON.stringify(друга));
/* ТТН до №1 — стан сам стає «В дорозі». */
await p.evaluate(() => { const b = Object.values(designBuys).find(x => x.n === 1);
  const el = document.querySelector('[data-buyttn="' + b.id + '"]'); el.value = '2045 0012 3456 78'; el.dispatchEvent(new Event('change')); });
await p.waitForTimeout(500);
const ттн = await p.evaluate(() => { const b = Object.values(designBuys).find(x => x.n === 1);
  return { ttn: b.ttn, st: b.status, лінк: !!document.querySelector('.dz-buy-o a[href*="20450012345678"]') }; });
ok(ттн.ttn === '20450012345678' && ттн.st === 'way' && ттн.лінк, 'ТТН збережено, стан — «В дорозі», є посилання «Де посилка»', 'ТТН: ' + JSON.stringify(ттн));

console.log('');
console.log('═══ 6. ЦЕХ: ОДЯГ, ФАЙЛИ, КАРТКА ═══');
const рано = await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.open(''); U.render(document.getElementById('dzRoot'));
  return [...document.querySelectorAll('.dz-boards [data-open]')].map(x => x.dataset.open).sort(); });
ok(рано.length === 0,
  'поки вишивку здано не на всіх позиціях — у цеху замовлення немає', 'у цеху: ' + JSON.stringify(рано));
await p.evaluate(() => { const D = window.LQDesign; const d = D.dzList(__j.units[0], 'stitch')[0];
  D.dzClaim(d, 'test@loomiq'); D.dzVer(d, 'test@loomiq', [{ name:'a.dst', url:'https://x/a.dst', role:'machine' },
    { name:'w.png', url:'https://x/w.png', role:'shot' }], '', null, 'stitch'); D.dzOk(d, 'test@loomiq', 'acct', 1); });
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.open('2000201'); U.render(document.getElementById('dzRoot')); });
const цехДошка = await p.evaluate(() => [...document.querySelectorAll('.dz-boards [data-open]')].map(x => x.dataset.open).sort());
ok(цехДошка.join() === '2000201', 'здали вишивку на всіх позиціях — замовлення в цеху; інших немає', 'дошка цеху: ' + JSON.stringify(цехДошка));
const шапка = await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
  const t = ((document.querySelector('.dz-panel .dz-panel-id .dz-state') || {}).textContent || '');
  U.setTab('prod'); U.open('2000201'); U.render(document.getElementById('dzRoot')); return t; });
ok(/^Виробництво · (Нове|Очікуємо одяг)/.test(шапка.trim()), 'у шапці картки менеджера — статус цеху: «' + шапка.trim() + '»', 'шапка: ' + шапка);
await p.waitForTimeout(400);
const цех = await p.evaluate(() => ({
  одяг: [...document.querySelectorAll('.dz-panel .dz-cloth')].map(x => x.textContent.replace(/\s+/g, ' ')),
  мокап: (() => { const u = [...document.querySelectorAll('.dz-panel .dz-prod-u')][1];
    const t = u && [...u.querySelectorAll('.dz-tile')].find(x => /мокап/.test((x.querySelector('.dz-tile-l') || {}).textContent || ''));
    return t ? t.querySelector('[title="Скачати"]').dataset.name : ''; })(),
  машина: [...document.querySelectorAll('.dz-panel .dz-tile-f')].map(b => b.dataset.name),
  картка: document.querySelectorAll('.dz-panel [data-do="prod-card"]').length }));
console.log('  ' + JSON.stringify(цех));
/* ТЗ і переписка з клієнтом у картці цеху (05.10): «Що шиємо → ТЗ →
   переписка з менеджером»; ТЗ — кілька рядків і «розгорнути»; лише кнопки
   переписки з клієнтом, без шапки з контактами. */
const тз = await p.evaluate(async () => {
  const U = window.LQDesign.ui, o = __o, j = __j;
  j.brief = Object.assign({}, j.brief, { text: 'Вишивка товщою ниткою, як на фото клієнта.\nБез бирки на шиї.\nЛого строго по центру.\nПакувати кожну окремо.\nДо пʼятниці.\nКлієнт просив перевірити колір ниток.' });
  o.crmChatId = 'chat123'; o.tgChatId = 0;
  U.setTab('prod'); U.open(o.orderId); U.render(document.getElementById('dzRoot'));
  const зони = [...document.querySelectorAll('.dz-panel .dz-z-h b')].map(x => x.textContent);
  const t = document.querySelector('.dz-panel .dz-tz-t');
  const r = { зони, cut: !!(t && t.classList.contains('is-cut')), h: t ? t.getBoundingClientRect().height : 0,
    кнопки: [...document.querySelectorAll('.dz-panel .dz-tz-chat button')].map(b => b.textContent) };
  document.querySelector('.dz-panel [data-do="prod-tz"]').click();
  await new Promise(z => setTimeout(z, 100));
  const t2 = document.querySelector('.dz-panel .dz-tz-t');
  r.open = !t2.classList.contains('is-cut'); r.h2 = t2.getBoundingClientRect().height;
  return r;
});
console.log('  ' + JSON.stringify(тз));
ok(тз.зони.join('|') === 'Що шиємо|ТЗ|Переписка з менеджером', 'у цеху: Що шиємо → ТЗ → Переписка з менеджером', 'зони: ' + тз.зони.join('|'));
ok(тз.cut && тз.open && тз.h2 > тз.h, 'ТЗ — перші рядки, «розгорнути» показує все', 'ТЗ: ' + JSON.stringify(тз));
ok(тз.кнопки.join() === 'Instagram', 'під ТЗ — кнопка переписки з клієнтом (Instagram), без шапки з контактами', 'кнопки: ' + тз.кнопки);
ok(цех.одяг.length === 2 && /В дорозі · №1/.test(цех.одяг[1]) && /ТТН 20450012345678/.test(цех.одяг[1]) && /Отримано/.test(цех.одяг[0]),
  'біля кожного одягу — стан закупівлі, номер і ТТН', 'одяг: ' + JSON.stringify(цех.одяг));
ok(цех.машина.indexOf(N1 + '-2_v1.dst') >= 0, 'файли для машини — у цеху, з підписом', 'файли: ' + JSON.stringify(цех.машина));
ok(new RegExp('^' + N1 + '-2_v1_.+_L_Чорний_52см$').test(цех.мокап), 'мокап у цеху підписаний з одягом, розміром, кольором і шириною', 'мокап: ' + цех.мокап);
/* Безголовий Chromium тут підміняє кириличне імʼя файлу на «download» (у
   звичайному браузері такого немає), тож імʼя читаємо з самого посилання. */
await p.evaluate(() => { window.__dl = []; const o = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ if(this.download) window.__dl.push(this.download); return o.call(this); }; });
const [dl] = await Promise.all([
  p.waitForEvent('download', { timeout: 15000 }),
  p.evaluate(() => [...document.querySelectorAll('.dz-panel [data-do="prod-card"]')][1].click())]);
await p.waitForTimeout(300);
const імяКартки = await p.evaluate(() => window.__dl[window.__dl.length - 1] || '');
const байт = fs.statSync(await dl.path()).size;
console.log('  ' + імяКартки + ' · ' + байт + ' байт');
ok(імяКартки === N1 + '-2_v1_виробництво.png' && байт > 20000, 'виробнича карта зібралась і скачалась з підписом', 'картка: ' + імяКартки + ' ' + байт);
/* «Глазиком»: карту видно, нічого не качаючи; звідти ж її можна скачати. */
const кнПерегляд = await p.evaluate(() => document.querySelectorAll('.dz-panel [data-do="prod-view"]').length);
ok(кнПерегляд === цех.картка && кнПерегляд > 0, 'біля кожної «⤓ Виробнича карта» — «👁 Переглянути карту»', 'переглядів: ' + кнПерегляд + ' / карт: ' + цех.картка);
await p.evaluate(() => [...document.querySelectorAll('.dz-panel [data-do="prod-view"]')][1].click());
await p.waitForSelector('.dz-pv .dz-pv-c img', { timeout: 15000 });
await p.waitForTimeout(300);
const перегляд = await p.evaluate(async () => {
  const im = document.querySelector('.dz-pv .dz-pv-c img');
  await im.decode().catch(() => {});
  /* Колір виробу під роботою — праворуч угорі аркуша. */
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const px = Array.from(x.getImageData(c.width - 150, 290, 1, 1).data.slice(0, 3));
  return { карт: document.querySelectorAll('.dz-pv .dz-pv-c').length, w: im.naturalWidth, h: im.naturalHeight, px,
           скачати: !!document.querySelector('.dz-pv [data-pvdl]'), заголовок: document.querySelector('.dz-pv-h b').textContent };
});
console.log('  ' + JSON.stringify(перегляд));
ok(перегляд.карт >= 1 && перегляд.w === 2480 && перегляд.h === 1754,
  'вікно перегляду показує карту — аркуш A4 горизонтально', 'перегляд: ' + JSON.stringify(перегляд));
ok(/^Виробнича карта · /.test(перегляд.заголовок) && перегляд.скачати, 'у вікні — номер позиції й кнопка «Скачати»', 'перегляд: ' + JSON.stringify(перегляд));
const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }),
  p.evaluate(() => document.querySelector('.dz-pv [data-pvdl]').click())]);
await p.waitForTimeout(200);
ok(fs.statSync(await dl2.path()).size > 20000 && (await p.evaluate(() => window.__dl[window.__dl.length - 1])) === N1 + '-2_v1_виробництво.png',
  'скачати можна прямо з перегляду — той самий файл', 'з перегляду не скачалось');
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
ok(!(await p.evaluate(() => document.querySelector('.dz-pv'))), 'Escape закриває перегляд', 'перегляд не закрився');

console.log('');
console.log('═══ 6б. ЦЕХ ↔ МЕНЕДЖЕР: ПЕРЕПИСКА ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.open('2000201'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
const цехЕкран = await p.evaluate(() => ({
  ряд: [...document.querySelectorAll('.dz-panel .dz-prod-row')].map(r => [...r.querySelectorAll('.dz-tile-l')].map(x => x.textContent).join(',')),
  картка: [...document.querySelectorAll('.dz-panel .dz-tile-l')].some(x => x.textContent === 'картка'),
  чат: !!document.querySelector('.dz-panel [data-prodsay="prod"]') }));
console.log('  ' + JSON.stringify(цехЕкран));
ok(цехЕкран.ряд.length === 2 && /робота/.test(цехЕкран.ряд[1]) && /мокап/.test(цехЕкран.ряд[1]) &&
   /скрін Wilcom/.test(цехЕкран.ряд[1]) && /файл для машини/.test(цехЕкран.ряд[1]) && !цехЕкран.картка && цехЕкран.чат,
  'у цеху — файли одним рядком (робота, мокап, скрін Wilcom, файл для машини), без картки для клієнта, і переписка',
  'цех: ' + JSON.stringify(цехЕкран));
await p.evaluate(async () => { document.querySelector('[data-prodsay="prod"]').value = 'Нитки чорні є?';
  await window.LQDesign.ui.act('prod-say', document.getElementById('dzRoot'), { as:'prod' }); });
await p.waitForTimeout(300);
const уМенеджера = await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
  const z = [...document.querySelectorAll('.dz-panel .dz-z')].find(x => /Виробництво/.test(x.textContent)) || null;
  return { зона: !!z, текст: z ? z.textContent.replace(/\s+/g, ' ') : '', нових: window.LQDesign.prodUnseen(__j, 'test@loomiq', 'acct') }; });
ok(уМенеджера.зона && /Нитки чорні є\?/.test(уМенеджера.текст) && уМенеджера.нових === 1,
  'у менеджера — зона «Виробництво» з тим самим повідомленням, як непрочитане', 'менеджер: ' + JSON.stringify(уМенеджера));

console.log('');
console.log('═══ 6в. КАРТКА «МАКЕТ НА УЗГОДЖЕННЯ»: УСІ МОКАПИ Й ЕСКІЗИ ═══');
const картки = await p.evaluate(async (PNGURL) => {
  const h = async d => { const png = await window.LQMock.card(d); const im = new Image();
    await new Promise(r => { im.onload = r; im.src = png; }); return im.height; };
  const base = { title:'Макет на узгодження', no:'#1-1', nums:[['Модель','Футболка'],['Колір','Чорний']],
                 specs:[{ label:'Матеріал', value:'100% бавовна' }], note:'Колір на екрані може відрізнятись.' };
  return { один: await h(Object.assign({ mocks:[PNGURL], works:[PNGURL] }, base)),
           три: await h(Object.assign({ mocks:[PNGURL, PNGURL, PNGURL], works:[PNGURL, PNGURL, PNGURL] }, base)) };
}, PNGURL);
console.log('  ' + JSON.stringify(картки));
ok(картки.три <= картки.один + 10, 'три мокапи й три ескізи не видовжують картку: ' + картки.один + ' → ' + картки.три + ' px',
  'картка видовжилась: ' + JSON.stringify(картки));

console.log('');
console.log('═══ 6г. РОЗМІТКА З «ОБЛАСТЕЙ НАНЕСЕННЯ» ═══');
const зона = await p.evaluate(() => {
  contentData.printAreas = Object.assign({}, contentData.printAreas, { tee: { scaleSize:'M', heightCm:70,
    front: { base:{ calibTop:0.1, calibBottom:0.9, calibL:0.25, calibR:0.75, pts:[] }, colors:{} } } });
  return garmentZone('tee', 'front', 'Чорний', 'M');
});
ok(зона && зона.T === 0.1 && зона.B === 0.9 && зона.L === 0.25 && зона.R === 0.75 && зона.H > 0,
  'розмітка боку — верх, низ, краї й висота під розмір', 'зона: ' + JSON.stringify(зона));

console.log('');
console.log('═══ 7. СТАРА ЗДАЧА ВИШИВКИ (ДО «ЗДАВ = ГОТОВО») ═══');
const стара = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const d = D.dzList(__j3.units[0], 'stitch')[0] || (D.dzList(__j3.units[0], 'stitch').push(D.dzNew()), D.dzList(__j3.units[0], 'stitch')[0]);
  d.who = 'test@loomiq'; d.sentAt = new Date().toISOString();
  D.dzVer(d, 'test@loomiq', [{ name:'x.dst', url:'https://x/x.dst', role:'machine' }], '', null, 'stitch');
  d.status = 'review'; d.ok = null;                  // так лежать здані до правила
  U.setTab('acct'); U.open(''); U.render(document.getElementById('dzRoot'));
  return { стан: d.status, як: (d.ok || {}).how };
});
ok(стара.стан === 'approved' && стара.як === 'auto', 'стара здача вишивки сама стала «готово» — без натиску', 'стара: ' + JSON.stringify(стара));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
