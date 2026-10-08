/* КОНТУР: ГРАФІКА → ВИШИВКА → ВИРОБНИЦТВО.

   Андрій: вишивальні — так само, як графічні, і налагодити перехід між
   ними. Заповнили позицію — черга графіки; взяли, здали, клієнт погодив
   ескіз — позиція сама стає в чергу вишивки (окремий статус «Черга
   вишивки»); вишивальний бере, здає DST або EMB і скрін з Wilcom; вишивку
   погоджує лише менеджер; коли погоджено всі вишивальні дизайни —
   виробництво. Ліміт «одночасно в роботі» у вишивальних свій.

   Запуск:  node tests/dz-contour.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8947;
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
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 24 }
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




const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  const j = designJobMake('2000101');
  j.units = [
    Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:2, note:'Лого на груди' }),
    Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'L', qty:1, note:'Лого на груди' })];
  window.__j = j; window.__o = orders.find(x => x.orderId === '2000101');
  openDesign();
  U.host.upload = async f => 'https://cdn.test/' + encodeURIComponent(f.name || 'f');
  U.host.hasChat = () => true;
});
const стан = () => p.evaluate(() => window.LQDesign.chainAt(__j, __o));
const saveJob = () => p.evaluate(() => { window.LQDesign.dzHandOver(__j, __o, 'test@loomiq'); });

console.log('═══ 1. ЗАПОВНИЛИ → ЧЕРГА ГРАФІКИ ═══');
await saveJob();
ok(await стан() === 'new', 'у Канбані менеджера — «Нове», поки ніхто не взяв', 'стан: ' + await стан());

console.log('');
console.log('═══ 2. ГРАФІКА: ВЗЯЛИ, ЗДАЛИ, КЛІЄНТ ПОГОДИВ ═══');
await p.evaluate(() => {
  const D = window.LQDesign;
  __j.units.forEach((u, k) => {
    const d = D.dzList(u, 'graphic')[0];
    D.dzClaim(d, 'test@loomiq');
    D.dzVer(d, 'test@loomiq', [{ name:'лого.png', url:'https://x/w' + k + '.png', role:'work', hash:'h' + k },
      { name:'Перед.png', url:'https://x/m' + k + '.png', role:'mock' },
      { name:'аркуш-v1.png', url:'https://x/s' + k + '.png', role:'sheet' }], '', null, 'graphic');
  });
});
/* 08.10: здали — це ще не «у клієнта». Клієнт бачить лише те, що йому надіслали. */
ok(await стан() === 'sketch', 'версії здані — «Готовий граф. ескіз» (клієнту ще не надсилали)', 'стан: ' + await стан());
const назад = await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'new', 'test@loomiq'));
const вручну = await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'client', 'test@loomiq'));
ok(!назад && вручну === 'client' && await стан() === 'client', 'менеджер перетягнув — «У клієнта на погодженні»; в інші колонки руками не можна', 'стан: ' + await стан());
/* 08.10: «Ескіз узгоджено» — клієнт погодив ескіз (ще не «Погоджено» з даними). */
const узгоджено = await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'sketchok', 'test@loomiq'));
ok(узгоджено === 'sketchok' && await стан() === 'sketchok' && !(await p.evaluate(() => __j.approvedVersion)),
  'з «У клієнта» — у «Ескіз узгоджено»; це лише позначка, «Погоджено» ще не натиснуто', 'стан: ' + await стан());
const історія = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = window.LQDesign.ui.histHtml(__j, __o); return d.textContent; });
ok(/замовлення створено/.test(історія) && /Ескіз узгоджено/.test(історія) && /здача версії · поз\. 1 · графіка · Версія 1/.test(історія),
  'історія детальна: створення, ручні переходи, номер версії', історія.slice(0, 300));
await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'client', 'test@loomiq'));
const повернув = await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'sketch', 'test@loomiq'));
ok(повернув === 'sketch' && await стан() === 'sketch', 'передумав — назад у «Готовий граф. ескіз»', 'стан: ' + await стан());
await p.evaluate(() => { __j.units.forEach(u => { const d = window.LQDesign.dzList(u, 'graphic')[0]; d.vers[d.vers.length - 1].sentToClient = new Date().toISOString(); }); });
const заборона = await p.evaluate(() => window.LQDesign.acctMove(__j, __o, 'sketch', 'test@loomiq'));
ok(await стан() === 'client' && !заборона, 'надіслали «Надіслати клієнту» — «У клієнта на погодженні», назад уже не перетягнеш', 'стан: ' + await стан());
/* Менеджер погоджує через картку — справжньою дією, як кнопкою. */
await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  U.setTab('acct'); U.open('2000101'); U.render(document.getElementById('dzRoot'));
  for(let k = 0; k < 2; k++){
    /* Одяг підтверджують при погодженні ескізу (вікно); тут — напряму. */
    window.LQDesign.clothConfirm(__j.units[k], 'test@loomiq');
    await U.act('dz-ok', document.getElementById('dzRoot'), { dz: __j.units[k].id + '|graphic|0', v: 1, how:'client' });
  }
});
await p.waitForTimeout(500);
const після = await p.evaluate(() => {
  const D = window.LQDesign;
  return __j.units.map(u => { const d = D.dzList(u, 'stitch')[0];
    return d ? { черга: D.dzInQueue(d), подія: d.thread[d.thread.length - 1].text, звідки: JSON.stringify(d.from) } : null; });
});
console.log('  ' + JSON.stringify(після));
ok(після.every(x => x && x.черга && /черг/.test(x.подія)),
  'ескіз погоджено — обидві позиції самі стали в чергу вишивки',
  'вишивка не стала в чергу: ' + JSON.stringify(після));
ok(після.every(x => /"ver":1/.test(x.звідки)), 'і тягнуть посилання на погоджену версію (v1)', 'звідки: ' + JSON.stringify(після));
ok(await стан() === 'stitchq', 'у Канбані менеджера — окремий статус «Черга вишивки»', 'стан: ' + await стан());

console.log('');
console.log('═══ 3. ВИШИВАЛЬНИЙ: ЧЕРГА → БЕРУ ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('stitch'); U.open(''); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
const дошка = await p.evaluate(() => [...document.querySelectorAll('.dz-col')].map(c => ({
  кол: ((c.querySelector('.dz-col-h') || {}).textContent || '').replace(/\d+$/, '').trim(),
  карток: c.querySelectorAll('.dz-card-w').length })));
console.log('  ' + дошка.map(x => x.кол + ':' + x.карток).join(' · '));
ok(/Черга відділу/.test(дошка[0].кол) && дошка[0].карток === 1,
  'у вишивальних перша колонка — «Черга відділу», замовлення там',
  'дошка вишивальних: ' + JSON.stringify(дошка));
await p.evaluate(() => document.querySelector('[data-open="2000101"]').click());
await p.waitForTimeout(400);
const картка = await p.evaluate(() => ({
  тз: [...document.querySelectorAll('.dz-panel .dz-w .dz-tile-l')].map(x => x.textContent).slice(0, 3),
  беру: document.querySelectorAll('.dz-panel [data-do="dz-take"]').length,
  відмова: !!document.querySelector('.dz-panel [data-do="dz-no"]') }));
console.log('  ' + JSON.stringify(картка));
ok(картка.тз.join() === 'робота,мокап,картка', 'у ТЗ — погоджений ескіз: робота, мокап, картка', 'ТЗ: ' + JSON.stringify(картка.тз));
ok(картка.беру === 2 && !картка.відмова, 'на кожній позиції «Беру в роботу», відмовитись не можна', 'кнопки: ' + JSON.stringify(картка));
/* Ліміт вишивальних — окремий: 1 одночасно. */
await p.evaluate(() => { contentData.b2c = Object.assign({}, contentData.b2c, { stitchLimit: 1, dzLimit: 0 }); });
await p.evaluate(() => document.querySelectorAll('.dz-panel [data-do="dz-take"]')[0].click());
await p.waitForTimeout(500);
await p.evaluate(() => { const b = document.querySelector('.dz-panel [data-do="dz-take"]'); if(b) b.click(); });
await p.waitForTimeout(500);
const взяв = await p.evaluate(() => __j.units.map(u => window.LQDesign.dzList(u, 'stitch')[0].who));
console.log('  ' + JSON.stringify(взяв));
ok(взяв[0] === 'test@loomiq' && взяв[1] === '', 'з лімітом вишивальних 1 друге замовлення... тут та сама картка — друга позиція лишилась у черзі',
   'ліміт: ' + JSON.stringify(взяв));
await p.evaluate(() => { contentData.b2c.stitchLimit = 0; });
await p.evaluate(() => { const b = document.querySelector('.dz-panel [data-do="dz-take"]'); if(b) b.click(); });
await p.waitForTimeout(500);
ok(await стан() === 'stitch', 'взяли — у Канбані «У вишивального дизайнера»', 'стан: ' + await стан());

console.log('');
console.log('═══ 4. ЗДАТИ ВИШИВКУ: DST/EMB + СКРІН WILCOM ═══');
const здати = async (k, fname) => {
  await p.evaluate(k => document.querySelector('.dz-panel [data-do="dz-stitch-up"][data-dz^="' + __j.units[k].id + '|"]').click(), k);
  await p.waitForTimeout(300);
  const [fc1] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.querySelector('.dz-su [data-su="file"]').click())]);
  await fc1.setFiles({ name: fname, mimeType:'application/octet-stream', buffer: Buffer.from('dst') });
  await p.waitForTimeout(400);
  const гол = await p.evaluate(() => !!document.querySelector('.dz-su [data-su="go"]:not([disabled])'));
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(() => document.querySelector('.dz-su [data-su="shot"]').click())]);
  await fc2.setFiles({ name:'wilcom.png', mimeType:'image/png', buffer: PNG });
  await p.waitForTimeout(400);
  const можна = await p.evaluate(() => !!document.querySelector('.dz-su [data-su="go"]:not([disabled])'));
  return { гол, можна };
};
const r1 = await здати(0, 'logo.png');
const відхилено = await p.evaluate(() => ((document.querySelector('.dz-su .dz-su-ok') || {}).textContent || ''));
ok(!відхилено, 'не DST/EMB — файл не приймається', 'прийняло чужий файл: ' + відхилено);
await p.evaluate(() => { const w = document.querySelector('.dz-su'); if(w) w.remove(); });
const r2 = await здати(0, 'logo.DST');
ok(!r2.гол && r2.можна, '«Надіслати» живе лише коли є обидва: DST/EMB і скрін', 'кнопка: ' + JSON.stringify(r2));
await p.evaluate(() => document.querySelector('.dz-su [data-su="go"]').click());
await p.waitForTimeout(600);
const післяПершої = await стан();
ok(післяПершої === 'stitch', 'здали одну позицію з двох — ще «У вишивального»', 'стан: ' + післяПершої);
const r3 = await здати(1, 'logo2.emb');
await p.evaluate(() => document.querySelector('.dz-su [data-su="go"]').click());
await p.waitForTimeout(600);
const здано = await p.evaluate(() => __j.units.map(u => { const d = window.LQDesign.dzList(u, 'stitch')[0];
  const v = d.vers[d.vers.length - 1] || {}; return { стан: d.status, як: (d.ok || {}).how,
    файли: (v.files || []).map(f => f.role + ':' + f.name) }; }));
console.log('  ' + JSON.stringify(здано));
/* Андрій: «як тільки вишивальник зробив роботу, одразу ці файли йдуть на
   виробництво. Перевірки поки немає в B2C». */
ok(здано.every(x => x.стан === 'approved' && x.як === 'auto' && x.файли.join().indexOf('machine:') >= 0 && x.файли.join().indexOf('shot:') >= 0),
  'здали — без перевірки менеджера одразу готово: файл для машини й скрін у версії', 'здано: ' + JSON.stringify(здано));
ok(await стан() === 'prod', 'здано всі вишивальні — замовлення у «Виробництві» в менеджера', 'стан: ' + await стан());

console.log('');
console.log('═══ 5. МЕНЕДЖЕР БАЧИТЬ ФАЙЛИ, ПОГОДЖУВАТИ НЕ ТРЕБА ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000101');
  U.SIDE[__j.units[0].id] = 'stitch'; U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const зона = await p.evaluate(() => {
  const chk = document.querySelector('.dz-panel .dz-chk');
  return { кнопки: chk ? [...chk.querySelectorAll('.dz-chk-b .dz-b')].map(b => b.textContent.trim()) : [],
           плитки: chk ? [...chk.querySelectorAll('.dz-tile-l')].map(x => x.textContent) : [] };
});
console.log('  ' + JSON.stringify(зона));
ok(!зона.кнопки.some(t => /Погоджено/.test(t)) && !зона.кнопки.some(t => /^Надіслати$/.test(t)),
  'у зоні вишивки немає ні «Погоджено», ні «Надіслати» — уже пішло в цех', 'кнопки: ' + JSON.stringify(зона.кнопки));
ok(зона.плитки.indexOf('файл для машини') >= 0 && зона.плитки.indexOf('скрін Wilcom') >= 0,
  'у версії видно файл для машини й скрін Wilcom', 'плитки: ' + JSON.stringify(зона.плитки));
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.open(''); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
ok(await p.evaluate(() => !!document.querySelector('.dz-boards [data-open="2000101"]')),
  'і у виробництві замовлення є', 'у цеху замовлення немає');

console.log('');
console.log('═══ 6. НАЛАШТУВАННЯ: ОКРЕМИЙ ЛІМІТ ВИШИВАЛЬНИХ ═══');
const нал = await p.evaluate(async () => {
  paintB2c();
  const el = document.getElementById('b2c-stitchlimit');
  if(!el) return null;
  el.value = '2';
  document.getElementById('b2c-save').click();
  await new Promise(r => setTimeout(r, 900));
  return { збережено: (contentData.b2c || {}).stitchLimit, хук: window.LQDesign.ui.host.stitchLimit() };
});
ok(нал && нал.збережено === 2 && нал.хук === 2, 'поле «Одночасно в роботі · вишивальний» зберігається й доходить до відділу', 'налаштування: ' + JSON.stringify(нал));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
