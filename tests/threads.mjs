/* ПІД НИТКИ: АДАПТАЦІЯ РОБОТИ ДО ПАЛІТРИ НИТОК.

   Андрій: графічний дизайнер спершу адаптує роботу під нашу палітру
   ниток, і вже її кладе на мокап — саме вона лежить у файлах картки й іде
   далі. Оригінал зберігаємо поруч. Палітра — у Налаштуваннях B2C.

   Правила з README модуля перевіряємо прямо: у SVG — лише кольори обраних
   ниток (палітра прибита до трасувальника, нічого не перегруповано).

   Запуск:  node tests/threads.mjs      (з кореня репозиторію)  */
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


/* Логотип: червоне коло, синій прямокутник, жовта смуга на білому тлі. */
const LOGO = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 240);
  x.fillStyle = '#C8102E'; x.beginPath(); x.arc(90, 120, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#0B3D91'; x.fillRect(170, 60, 110, 120);
  x.fillStyle = '#FFD400'; x.fillRect(40, 200, 240, 18);
  return c.toDataURL('image/png');
});

console.log('═══ 1. ПОВНИЙ ШЛЯХ: ЗВЕСТИ ДО НИТОК → SVG З ПРИБИТОЮ ПАЛІТРОЮ ═══');
const шлях = await p.evaluate(async (LOGO) => {
  const blob = await (await fetch(LOGO)).blob();
  const r = await window.LQThreads.run(blob, 12);
  const fills = [...new Set((r.svg.match(/fill="rgb\([^)]+\)"/g) || []).map(s => s.slice(10, -2)))];
  const нитки = r.threads.map(t => t.rgb.join(','));
  return { коди: r.threads.map(t => t.code), fills, нитки, svg: r.svg.length,
           зайві: fills.filter(f => нитки.indexOf(f.replace(/\s/g, '')) < 0) };
}, LOGO);
console.log('  ' + JSON.stringify({ коди: шлях.коди, fills: шлях.fills }));
ok(шлях.коди.length >= 3 && шлях.коди.length <= 5, 'логотип з трьох кольорів — кілька ниток, не вісімнадцять: ' + шлях.коди.join(', '),
  'ниток не стільки: ' + шлях.коди.join(','));
ok(шлях.svg > 200 && шлях.fills.length && !шлях.зайві.length,
  'у SVG — рівно кольори обраних ниток, жодного дрейфу', 'зайві кольори в SVG: ' + JSON.stringify(шлях.зайві));

console.log('');
console.log('═══ 2. ПАЛІТРА З НАЛАШТУВАНЬ ═══');
const своя = await p.evaluate(async (LOGO) => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  const v = document.getElementById('view-b2c'); if(v) v.style.display = 'block';
  paintB2c();
  const всього = document.querySelectorAll('#b2c-threads [data-th]').length;
  /* Лишаємо три нитки: біла, червона, синя — і зберігаємо. */
  const keep = ['#F7F5F2', '#A5332F', '#163979'];
  document.querySelectorAll('#b2c-threads [data-th]').forEach(r => {
    if(keep.indexOf(r.querySelector('[data-thhex]').value.toUpperCase()) < 0) r.remove(); });
  document.getElementById('b2c-save').click();
  await new Promise(r => setTimeout(r, 900));
  const blob = await (await fetch(LOGO)).blob();
  const r = await window.LQThreads.run(blob, 12);
  return { всього, збережено: ((contentData.b2c || {}).threads || []).length,
           коди: r.threads.map(t => t.code), палітра: window.LQThreads.THREAD_PALETTE.length };
}, LOGO);
console.log('  ' + JSON.stringify(своя));
ok(своя.всього === 172 && своя.збережено === 3 && своя.палітра === 3 &&
   своя.коди.every(c => ['1121', '1135', '3351'].indexOf(c) >= 0),
  'у налаштуваннях 172 нитки; лишили три — підбір бере лише їх', 'палітра: ' + JSON.stringify(своя));
await p.evaluate(async () => { paintThreads(threadsDefault()); document.getElementById('b2c-save').click();
  await new Promise(r => setTimeout(r, 900)); });
ok(await p.evaluate(() => !(contentData.b2c || {}).threads && window.LQThreads.THREAD_PALETTE.length === 172),
  '«Повернути стандартні» — знову 172, у налаштуваннях нічого зайвого не лежить', 'стандартна палітра не повернулась');

console.log('');
console.log('═══ 3. ЗДАЧА: СПЕРШУ ПІД НИТКИ, ПОТІМ МОКАП ═══');
await p.evaluate((LOGO) => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000201');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'L', qty:2, note:'Лого' })];
  const d = D.dzNew(); D.dzList(j.units[0], 'graphic').push(d);
  D.dzAttach(d, 'test@loomiq', 'test@loomiq', 'Андрій'); D.dzSend(d, 'test@loomiq'); D.dzTake(d, 'test@loomiq');
  window.__j = j;
  openDesign();
  /* Завантаження віддає data-URL — так адаптація може його прочитати. */
  U.host.upload = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  U.host.sides = () => [{ key:'front', label:'Перед', url: LOGO }];
  window.LQMock.host.zone = () => ({ T:0.1, B:0.9, L:0.2, R:0.8, H:70 });
  U.setTab('graphic'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
}, LOGO);
await p.waitForTimeout(400);
const [fc] = await Promise.all([p.waitForEvent('filechooser'),
  p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-work"]').click())]);
await fc.setFiles({ name:'logo.png', mimeType:'image/png', buffer: Buffer.from(LOGO.split(',')[1], 'base64') });
await p.waitForSelector('.dz-th [data-thgo]:not([disabled])', { timeout: 30000 });
const вікно = await p.evaluate(() => ({
  картинок: document.querySelectorAll('.dz-th .dz-th-pair img').length,
  ниток: document.querySelectorAll('.dz-th .dz-thr').length,
  мокапНевідкритий: !document.querySelector('.mko-wrap .mko-stage .mko-art') }));
console.log('  ' + JSON.stringify(вікно));
ok(вікно.картинок === 2 && вікно.ниток >= 3, 'завантажив — спершу вікно «Під нитки»: оригінал, адаптоване й перелік ниток',
  'вікно адаптації не те: ' + JSON.stringify(вікно));
await p.evaluate(() => document.querySelector('.dz-th [data-thgo]').click());
await p.waitForSelector('.mko-wrap .mko-wk-t', { timeout: 20000 });
const наВиробі = await p.evaluate(() => ({ значок: (document.querySelector('.mko-wk-t') || {}).textContent || '',
  нанесень: document.querySelectorAll('.mko-wrap .mko-art').length,
  фон: !!document.querySelector('.mko-wrap .mko-bg') }));
console.log('  ' + JSON.stringify(наВиробі));
ok(/🧵\d+/.test(наВиробі.значок) && наВиробі.нанесень === 1 && !наВиробі.фон,
  'на виріб лягла адаптована робота (🧵), вибору фону для неї вже немає', 'на виробі: ' + JSON.stringify(наВиробі));
await p.evaluate(() => document.querySelector('.mko-wrap [data-mko-save]').click());
await p.waitForFunction(() => window.LQDesign.dzList(__j.units[0], 'graphic')[0].vers.length === 1, null, { timeout: 20000 });
const версія = await p.evaluate(() => { const v = window.LQDesign.dzList(__j.units[0], 'graphic')[0].vers[0];
  const f = r => v.files.filter(x => x.role === r);
  return { ролі: v.files.map(x => x.role).sort().join(','), нитки: (v.place.threads || []).length,
           інша: f('work')[0] && f('orig')[0] && f('work')[0].url !== f('orig')[0].url,
           svg: f('svg')[0] ? f('svg')[0].url.slice(0, 19) : '' }; });
console.log('  ' + JSON.stringify(версія));
ok(версія.ролі === 'mock,orig,svg,work' && версія.нитки >= 3 && версія.інша && /^data:image\/svg/.test(версія.svg),
  'у версії: адаптована робота, оригінал, SVG під нитки, мокап і перелік ниток', 'версія: ' + JSON.stringify(версія));
await p.evaluate(() => { const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot')); });
const плитки = await p.evaluate(() => [...document.querySelectorAll('.dz-panel .dz-ch-m.is-ver .dz-tile-l')].map(x => x.textContent));
ok(плитки.join() === 'мокап,оригінал',
  'у розмові лише мокап і оригінал — «робота» й SVG під нитки не показуються (13.10), хоч у версії лежать', 'плитки: ' + JSON.stringify(плитки));

console.log('');
console.log('═══ 4. БЕЗ АДАПТАЦІЇ НЕ ЗДАЄМО ═══');
await p.evaluate((LOGO) => {
  const d = window.LQDesign.dzList(__j.units[0], 'graphic')[0];
  d.draft = { works:[{ name:'стара.png', url: LOGO, hash:'x' }], places:[{ side:'front', work:0, x:0.5, y:0.3, w:0.25 }] };
  window.LQDesign.ui.render(document.getElementById('dzRoot'));
}, LOGO);
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-work"]').click());
await p.waitForTimeout(900);
const стара = await p.evaluate(async () => {
  const кнопка = !!document.querySelector('.mko-wrap [data-mko-adapt]');
  const червона = !!document.querySelector('.mko-wrap .mko-wk.need');
  document.querySelector('.mko-wrap [data-mko-save]').click();
  await new Promise(r => setTimeout(r, 700));
  return { кнопка, червона, версій: window.LQDesign.dzList(__j.units[0], 'graphic')[0].vers.length,
           відкрите: !!document.querySelector('.mko-wrap') };
});
console.log('  ' + JSON.stringify(стара));
ok(стара.кнопка && стара.червона && стара.версій === 1 && стара.відкрите,
  'робота без адаптації — червона з кнопкою «Під нитки», «Надіслати» не пускає', 'стара: ' + JSON.stringify(стара));
await p.evaluate(() => window.LQMock.close());

console.log('');
console.log('═══ 5. ВИШИВАЛЬНИК БАЧИТЬ НИТКИ ═══');
const бриф = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui, u = __j.units[0];
  const g = D.dzList(u, 'graphic')[0]; D.dzOk(g, 'test@loomiq', 'client', 1);
  D.clothConfirm(u, 'test@loomiq'); D.dzAutoQueue(__j, null, 'test@loomiq');
  const s = D.dzList(u, 'stitch')[0]; D.dzClaim(s, 'test@loomiq');
  U.setTab('stitch'); U.open('2000201'); U.render(document.getElementById('dzRoot'));
  return document.querySelectorAll('.dz-panel .dz-threads .dz-thr').length;
});
ok(бриф >= 3, 'у брифі вишивальника — перелік ниток з кодами: ' + бриф, 'ниток у брифі: ' + бриф);

console.log('');
console.log('═══ 6. НИТОК СТІЛЬКИ, СКІЛЬКИ Є; СПЕРШУ ФОН; КОЛІР НИТКОЮ (25.10) ═══');
/* Андрій: «спочатку видалити фон, потім адаптувати під нитки… оптимізовувало
   під кількість ниток, яка реально є». Чорний напис зі згладженими краями
   давав 11 ниток — тепер одна. */
const текст = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 520; c.height = 120;
  const x = c.getContext('2d'); x.fillStyle = '#111'; x.font = 'bold 56px sans-serif'; x.textBaseline = 'middle';
  x.fillText('Ти - моя сила', 16, 60);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const r = await window.LQThreads.run(blob, 12);
  return r.threads.map(t => t.code);
});
ok(текст.length === 1, 'чорний напис зі згладженими краями — 1 нитка, а не 11: ' + текст.join(', '), 'ниток: ' + текст.join(', '));
const лого3 = await p.evaluate(async (LOGO) => (await window.LQThreads.run(await (await fetch(LOGO)).blob(), 12)).threads.length, LOGO);
ok(лого3 >= 3 && лого3 <= 4, 'трикольоровий логотип — так само 3–4 нитки (справжні кольори не губляться): ' + лого3, 'ниток: ' + лого3);

/* PhotoRoom (підмінений): віддає те саме лого на прозорому. */
const ПРОЗОРЕ = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240;
  const x = c.getContext('2d');
  x.fillStyle = '#C8102E'; x.beginPath(); x.arc(90, 120, 60, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#0B3D91'; x.fillRect(170, 60, 110, 120);
  x.fillStyle = '#FFD400'; x.fillRect(40, 200, 240, 18);
  return c.toDataURL('image/png');
});
let prCalls = 0, prMode = 'ok', порядок = [];
await p.route('https://bg.test/**', r => { prCalls++; порядок.push('photoroom');
  if(prMode === '402') return r.fulfill({ status: 402, contentType:'application/json', body:'{}' });
  r.fulfill({ contentType:'image/png', body: Buffer.from(ПРОЗОРЕ.split(',')[1], 'base64') }); });
await p.evaluate(() => {
  window.LQMock.host = Object.assign({}, window.LQMock.host, { bgUrl: () => 'https://bg.test/x' });
  const run0 = window.LQThreads.run;
  window.__порядок = [];
  window.LQThreads.run = async function(){ window.__порядок.push('нитки'); return run0.apply(this, arguments); };
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000202');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'L', qty:1, note:'Лого' })];
  const d = D.dzNew(); D.dzList(j.units[0], 'graphic').push(d);
  D.dzAttach(d, 'test@loomiq', 'test@loomiq', 'Андрій'); D.dzSend(d, 'test@loomiq'); D.dzTake(d, 'test@loomiq');
  U.setTab('graphic'); U.open('2000202'); U.render(document.getElementById('dzRoot'));
});
await p.waitForTimeout(300);
const відкрий = async (src) => {
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'),
    p.evaluate(() => document.querySelector('.dz-panel [data-do="dz-work"]').click())]);
  await fc2.setFiles({ name:'logo.png', mimeType:'image/png', buffer: Buffer.from((src || LOGO).split(',')[1], 'base64') });
  await p.waitForSelector('.dz-th [data-thgo]:not([disabled])', { timeout: 30000 });
};
await відкрий();
const фон = await p.evaluate(() => ({ порядок: window.__порядок.slice(), підпис: [...document.querySelectorAll('.dz-th figcaption')].map(x => x.textContent).join(' | '),
  коди: [...document.querySelectorAll('.dz-th .dz-thr')].map(x => x.textContent), помилка: (document.querySelector('.dz-th .dz-th-bgerr') || {}).textContent || '' }));
console.log('  ' + JSON.stringify(фон) + ' · PhotoRoom: ' + prCalls);
ok(prCalls === 1 && фон.порядок[0] === 'нитки' && /фон прибрано/.test(фон.підпис) && !фон.помилка,
  'спершу PhotoRoom прибрав фон (один виклик), потім підбір ниток; підпис «фон прибрано»', JSON.stringify(фон));
ok(фон.коди.length === 3, 'білого фону серед ниток немає — 3 нитки: ' + фон.коди.join(', '), 'ниток: ' + фон.коди.join(', '));
/* Колір ниткою: обрали нитку — весь принт нею, 1 нитка; ще раз — без нового виклику PhotoRoom. */
const колір = await p.evaluate(async () => {
  const sw = [...document.querySelectorAll('.dz-th [data-thc]')].filter(b => b.dataset.thc)[5];
  const code = sw.dataset.thc;
  sw.click();
  await new Promise(r => { const t = setInterval(() => { const g = document.querySelector('.dz-th [data-thgo]'); if(g && !g.disabled){ clearInterval(t); r(); } }, 100); });
  return { code, коди: [...document.querySelectorAll('.dz-th .dz-thr')].map(x => x.textContent), повзунок: !!document.querySelector('.dz-th [data-thk]'),
           на: (document.querySelector('.dz-th .dz-th-cc') || {}).textContent || '' };
});
console.log('  ' + JSON.stringify(колір));
ok(колір.коди.length === 1 && колір.коди[0] === колір.code && /нитка/.test(колір.на) && !колір.повзунок && prCalls === 1,
  'обрали нитку ' + колір.code + ' — увесь принт нею, 1 нитка з цим кодом; PhotoRoom вдруге не кликали', JSON.stringify(колір) + ' · PhotoRoom ' + prCalls);
await p.evaluate(() => document.querySelector('.dz-th [data-thgo]').click());
await p.waitForSelector('.mko-wrap .mko-wk-t', { timeout: 20000 });
await p.evaluate(() => { const a = document.querySelector('.mko-wrap .mko-art'); if(a) a.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
await p.waitForTimeout(300);
const наВ = await p.evaluate(() => ({ кнопка: [...document.querySelectorAll('.mko-wrap .mko-clr [data-mko-adapt]')].map(b => b.textContent).join(),
  звичайні: document.querySelectorAll('.mko-wrap [data-mko-clr]').length, коди: ((document.querySelector('.mko-wrap .mko-clr .mko-bg-w') || {}).textContent || '') }));
console.log('  ' + JSON.stringify(наВ));
ok(/Змінити колір ниткою/.test(наВ.кнопка) && наВ.звичайні === 0 && new RegExp(колір.code).test(наВ.коди),
  'на виробі в адаптованої роботи — «🎨 Змінити колір ниткою» (через «Під нитки») і коди ниток; звичайного перефарбування немає', JSON.stringify(наВ));
await p.evaluate(() => window.LQMock.close());
/* PhotoRoom відмовив — причина червоним, нитки з оригіналу. */
prMode = '402';
/* Інший файл — для того самого PhotoRoom уже не кличемо (кеш на вкладку). */
const LOGO_B = await p.evaluate((LOGO) => new Promise(r => { const im = new Image(); im.onload = () => {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.fillStyle = '#0B3D91'; x.fillRect(10, 10, 30, 30); r(c.toDataURL('image/png')); }; im.src = LOGO; }), LOGO);
await p.evaluate(() => { window.__порядок = []; const U = window.LQDesign.ui; U.setTab('graphic'); U.open('2000202'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
await відкрий(LOGO_B);
const відмова = await p.evaluate(() => ({ помилка: (document.querySelector('.dz-th .dz-th-bgerr') || {}).textContent || '',
  ниток: document.querySelectorAll('.dz-th .dz-thr').length }));
console.log('  ' + JSON.stringify(відмова));
ok(/закінчились кредити \(не оплачено\)/.test(відмова.помилка) && /нитки підібрано з оригіналу/.test(відмова.помилка) && відмова.ниток >= 3,
  'PhotoRoom відмовив — червоним «закінчились кредити (не оплачено)… нитки підібрано з оригіналу», підбір є', JSON.stringify(відмова));
await p.evaluate(() => { const x = document.querySelector('.dz-th [data-thno]'); if(x) x.click(); });

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
