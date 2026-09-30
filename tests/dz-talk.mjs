/* ПРОПУЩЕНЕ, СТОРОНИ РОЗМОВИ, ПРАВКА-ПОВІДОМЛЕННЯ, ФОН, ТРИ ПЛИТКИ.

   Андрій: пропущене світиться там, звідки прийшло — від клієнта на
   Instagram, від дизайнерів на картці й біля їхньої зони; свої праворуч,
   чужі ліворуч — за роллю, бо він тестує всіма ролями з однієї пошти;
   будь-яке слово менеджера дизайнеру — правка, кнопка «Правка» не
   потрібна; у вікні здачі — вибір фону; версія — три картинки з 👁 і ⤓.

   Запуск:  node tests/dz-talk.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8931;
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



/* Андрій тестує всіма ролями з однієї пошти — рівно так і тут: test@loomiq
   пише і як акаунт-менеджер, і як графічний дизайнер. */
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000101');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний',
    size:'M', qty:3, note:'Лого на груди' })];
  const d = D.dzNew();
  D.dzAttach(d, 'test@loomiq', 'test@loomiq');
  D.dzSend(d, 'test@loomiq');
  d.status = 'work';
  D.dzList(j.units[0], 'graphic').push(d);
  window.__j = j; window.__d = d;
  openDesign();
  /* Клієнт написав тричі — число бере робоче місце (Sitniks/Telegram). */
  U.host.clientUnread = () => 3;
  U.host.hasChat = () => true;
});
await p.waitForTimeout(400);

console.log('═══ 1. БУДЬ-ЯКЕ СЛОВО МЕНЕДЖЕРА — ПРАВКА ═══');
const пр = await p.evaluate(() => {
  const D = window.LQDesign;
  const до = __d.status;
  D.dzSay(__d, 'test@loomiq', 'Зробіть лого менше', null, 'acct');
  const після = __d.status;
  return { до, після };
});
console.log('  ' + JSON.stringify(пр));
ok(пр.до === 'work' && пр.після === 'revision',
  'менеджер написав, поки дизайнер малює, — робота пішла в «Правки»',
  'стан: ' + JSON.stringify(пр));

console.log('');
console.log('═══ 2. ДИЗАЙНЕР ВІДПОВІВ І ЗДАВ ВЕРСІЮ ═══');
await p.evaluate(() => {
  const D = window.LQDesign;
  D.dzNote(__d, 'test@loomiq', 'Зменшив, дивіться', null, 'graphic');
  D.dzVer(__d, 'test@loomiq', [
    { name:'лого.png', url:'https://x/work.png', role:'work', hash:'h1' },
    { name:'Перед.png', url:'https://x/mock.png', role:'mock' },
    { name:'аркуш-v1.png', url:'https://x/sheet.png', role:'sheet' }], '', null, 'graphic');
});

/* ── очима акаунт-менеджера ── */
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const дошка = await p.evaluate(() => {
  const c = document.querySelector('[data-open="2000101"]');
  const w = c && c.closest('.dz-card-w');
  return { кут: ((w && w.querySelector('.dz-card-n')) || {}).textContent || '',
           іг: ((w && w.querySelector('.dz-ig-n')) || {}).textContent || '' };
});
console.log('  Канбан: ' + JSON.stringify(дошка));
ok(дошка.кут === '2', 'на картці Канбану в куті — 2 пропущених від дизайнера (слово + версія)',
   'кружечок на картці: «' + дошка.кут + '»');
ok(дошка.іг === '3', 'а на кнопці Instagram — 3 від клієнта', 'кружечок на Instagram: «' + дошка.іг + '»');

await p.evaluate(() => { document.querySelector('[data-open="2000101"]').click(); });
await p.waitForTimeout(500);
const картка = await p.evaluate(() => {
  const own = [...document.querySelectorAll('.dz-panel .dz-ch-m.own')].map(x => x.textContent);
  const their = [...document.querySelectorAll('.dz-panel .dz-ch-m:not(.own)')].map(x => x.textContent);
  const ver = document.querySelector('.dz-panel .dz-ch-m.is-ver');
  return {
    зона: ((document.querySelector('.dz-panel .dz-u-l .dz-unread') || {}).textContent || '').trim(),
    праворуч: own.some(t => /менше/.test(t) && /Зробіть/.test(t)),
    ліворуч: their.some(t => /Зменшив/.test(t)) && !!(ver && !ver.classList.contains('own')),
    плитки: ver ? [...ver.querySelectorAll('.dz-tile-l')].map(x => x.textContent) : [],
    очі: ver ? ver.querySelectorAll('.dz-tile-a [data-do="pic-open"]').length : 0,
    скач: ver ? ver.querySelectorAll('.dz-tile-a [data-do="dz-dl"]').length : 0,
    рядок: document.querySelectorAll('.dz-panel .dz-ch-f').length,
    сантиметри: /горловини|см ×/.test(ver ? ver.textContent : ''),
    іг: ((document.querySelector('.dz-write .dz-ig-n')) || {}).textContent || '',
    правка: [...document.querySelectorAll('.dz-panel .dz-chk-b .dz-b')].some(b => /^Правка$/.test(b.textContent.trim()))
  };
});
console.log('  картка: ' + JSON.stringify(картка));
ok(картка.зона === '2', 'у шапці зони «Графічний дизайн» — 2 пропущених', 'біля зони: «' + картка.зона + '»');
ok(картка.праворуч && картка.ліворуч,
  'хоч пошта та сама — свої слова менеджера праворуч, дизайнера ліворуч',
  'сторони переплутані: ' + JSON.stringify(картка));
ok(картка.плитки.join() === 'робота,мокап,картка',
  'версія — три плитки в ряд: робота, мокап, картка',
  'плитки: ' + JSON.stringify(картка.плитки));
ok(картка.очі === 3 && картка.скач === 3 && !картка.рядок && !картка.сантиметри,
  'на кожній 👁 і ⤓, без рядка скачувань і без сантиметрів',
  'плитки не ті: ' + JSON.stringify(картка));
ok(картка.іг === '3', 'внизу, у закріпленій смужці Instagram, — 3 від клієнта', 'смужка: «' + картка.іг + '»');
ok(!картка.правка, 'кнопки «Правка» немає — правка пишеться просто в розмові', 'кнопка «Правка» лишилась');

const око = await p.evaluate(() => !!document.querySelector('.dz-panel .dz-u-l .dz-eye'));
ok(око, 'поруч із лічильником у шапці зони — 👁, щоб позначити прочитаним', 'ока біля зони немає');
await p.evaluate(() => document.querySelector('.dz-panel .dz-u-l .dz-eye').click());
await p.waitForTimeout(600);
const прочит = await p.evaluate(() => ({
  зона: !!document.querySelector('.dz-panel .dz-u-l .dz-unread'),
  кут: !!(document.querySelector('[data-open="2000101"]').closest('.dz-card-w').querySelector('.dz-card-n')) }));
ok(!прочит.зона && !прочит.кут, 'натиснули 👁 — прочитано, і в зоні, і на картці Канбану',
   'не погасло: ' + JSON.stringify(прочит));

/* ── очима графічного дизайнера ── */
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('graphic'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const диз = await p.evaluate(() => {
  const c = document.querySelector('[data-open="2000101"]');
  const w = c && c.closest('.dz-card-w');
  const кут = ((w && w.querySelector('.dz-card-n')) || {}).textContent || '';
  c.click();
  return кут;
});
await p.waitForTimeout(500);
const дизК = await p.evaluate(() => ({
  бейдж: ((document.querySelector('.dz-panel .dz-w .dz-unread') || {}).textContent || '').trim(),
  праворуч: [...document.querySelectorAll('.dz-panel .dz-ch-m.own')].some(x => /Зменшив/.test(x.textContent)),
  ліворуч: [...document.querySelectorAll('.dz-panel .dz-ch-m:not(.own)')].some(x => /Зробіть/.test(x.textContent)) }));
console.log('  дизайнер: кут ' + диз + ' · ' + JSON.stringify(дизК));
ok(диз === '1' && дизК.бейдж === '1', 'у дизайнера — 1 пропущене від менеджера, і на картці дошки, і в картці',
   'у дизайнера: кут «' + диз + '», бейдж «' + дизК.бейдж + '»');
ok(дизК.праворуч && дизК.ліворуч, 'а в нього навпаки: свої праворуч, менеджера ліворуч',
   'сторони в дизайнера: ' + JSON.stringify(дизК));

console.log('');
console.log('═══ 3. РОЗМОВУ НЕ ПРИВʼЯЗАНО — СМУЖКА ВСЕ ОДНО Є ═══');
const без = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  U.host.hasChat = () => false;
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  document.querySelector('[data-open="2000101"]').click();
  return new Promise(r => setTimeout(() => r(((document.querySelector('.dz-write') || {}).textContent || '').trim()), 400));
});
ok(/не привʼязано/.test(без), 'смужка внизу стоїть і каже: ' + без, 'смужки немає: «' + без + '»');

console.log('');
console.log('═══ 4. ФАЙЛИ ВЕРСІЇ ЗА РОЛЛЮ ═══');
const ролі = await p.evaluate(() => {
  const D = window.LQDesign;
  const стара = D.verParts({ files:[{ url:'a' }, { url:'m' }, { url:'s', name:'аркуш-v1.png' }] });
  const двіСторони = D.verParts({ files:[{ url:'m1', name:'Перед.png' }, { url:'m2', name:'Спина.png' },
                                         { url:'w', name:'лого.png', hash:'h' }] });
  return { стара: [стара.work.length, стара.mock.length, !!стара.sheet],
           двіСторони: [двіСторони.work.length, двіСторони.mock.length, !!двіСторони.sheet] };
});
console.log('  ' + JSON.stringify(ролі));
ok(ролі.стара.join() === '1,1,true', 'стара версія (макет, мокап, аркуш) розпізнана', 'стара: ' + ролі.стара);
ok(ролі.двіСторони.join() === '1,2,false',
  'на виробі з переду й спини робота більше не вважається аркушем',
  'дві сторони: ' + ролі.двіСторони);

console.log('');
console.log('═══ 5. ФОН РОБОТИ ═══');
const фон = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 60; c.height = 60;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 60, 60);
  x.fillStyle = '#000'; x.fillRect(20, 20, 20, 20);
  const src = c.toDataURL('image/png');
  const out = await window.LQMock.removeBg(src, 'local');
  const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = out; });
  const c2 = document.createElement('canvas'); c2.width = 60; c2.height = 60;
  const y = c2.getContext('2d'); y.drawImage(im, 0, 0);
  const кут = y.getImageData(2, 2, 1, 1).data[3], центр = y.getImageData(30, 30, 1, 1).data[3];
  const той = await window.LQMock.removeBg(src, 'none');
  return { кут, центр, безЗмін: той === src, src };
});
console.log('  ' + JSON.stringify({ кут: фон.кут, центр: фон.центр, безЗмін: фон.безЗмін }));
ok(фон.кут === 0 && фон.центр === 255, 'вбудований прибрав біле тло, а лого лишив', 'прозорість: ' + JSON.stringify(фон));
ok(фон.безЗмін, '«Не прибирати» віддає файл як є', '«не прибирати» змінило файл');
/* PhotoRoom — через Worker-проксі; тут він підмінений відповіддю-картинкою. */
await p.route('https://bg.test/**', r => r.fulfill({ contentType:'image/png',
  body: Buffer.from(фон.src.split(',')[1], 'base64') }));
const фр = await p.evaluate(async src => {
  window.LQMock.host = Object.assign({}, window.LQMock.host, { bgUrl: () => 'https://bg.test/x' });
  try{ const r = await window.LQMock.removeBg(src, 'photoroom'); return /^data:image\//.test(r); }
  catch(e){ return 'збій: ' + e.message; }
}, фон.src);
ok(фр === true, 'PhotoRoom іде через Worker і повертає картинку', 'PhotoRoom: ' + фр);
/* Вікно здачі: вибір фону біля робіт, «Не прибирати» — за замовчуванням. */
const вікно = await p.evaluate(async src => {
  window.LQMock.openWork({ gid:'tee', size:'M', name:'Тест',
    sides:[{ key:'front', label:'Перед', url: src }], works:[{ name:'лого.png', url: src, hash:'h' }],
    places:[{ side:'front', work:0, x:.5, y:.3, w:.3 }], onUpload: async () => null, onDone: () => {} });
  await new Promise(r => setTimeout(r, 500));
  const кн = [...document.querySelectorAll('.mko-bg [data-mko-bg]')];
  const за = (кн.find(b => b.classList.contains('on')) || {}).textContent || '';
  const loc = кн.find(b => b.getAttribute('data-mko-bg') === 'local');
  if(loc) loc.click();
  await new Promise(r => setTimeout(r, 900));
  const після = (document.querySelector('.mko-bg .mko-bg-b.on') || {}).textContent || '';
  window.LQMock.close();
  return { кнопок: кн.length, за, після };
}, фон.src);
console.log('  ' + JSON.stringify(вікно));
ok(вікно.кнопок === 3 && /Не прибирати/.test(вікно.за),
  'у вікні здачі три варіанти фону, за замовчуванням — «Не прибирати»',
  'вибір фону: ' + JSON.stringify(вікно));
ok(/вбудований/.test(вікно.після), 'обрали вбудований — робота перемалювалась без тла', 'після вибору: ' + вікно.після);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
