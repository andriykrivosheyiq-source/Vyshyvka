/* ГРАФІЧНИЙ ДИЗАЙНЕР: СТРОКИ, ЛІМІТ І ЗАЙВА КАРТИНКА (Андрій, 09.10).

   «Ограніченія на правки 12 годин, виключити з таймера час ночі (00:00–08:00).
   4 години на замовлення — від моменту, коли дизайнер взяв роботу. Не беруть
   нові замовлення, поки в колонці правки, і в роботі не більше 5. Якщо здає
   замовлення і додає лишню картинку — її потрібно видаляти повністю в зоні з
   мокапом» (видалена лишалась і їхала клієнту).

   Запуск:  node tests/dz-rules.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8946;
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
  b2c: {}
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



console.log('═══ 1. НІЧ 00:00–08:00 НЕ РАХУЄТЬСЯ ═══');
const ніч = await p.evaluate(() => {
  const D = window.LQDesign;
  const t = (d, h, m) => new Date(2026, 9, d, h, m || 0).getTime();
  return {
    вечір: D.addWorkHours(t(9, 22), 4, '', D.NIGHT_TILL) === t(10, 10),
    вночі: D.addWorkHours(t(10, 3), 4, '', D.NIGHT_TILL) === t(10, 12),
    правки: D.addWorkHours(t(9, 20), 12, '', D.NIGHT_TILL) === t(10, 16),
    безНочі: D.addWorkHours(t(9, 22), 4, '') === t(10, 2),
    міжНіч: D.workMs(t(9, 22), t(10, 10), '', D.NIGHT_TILL) === 4 * 3600000
  };
});
console.log('  ' + JSON.stringify(ніч));
ok(ніч.вечір && ніч.вночі && ніч.правки, '4 год від 22:00 — до 10:00; узяв о 3:00 — до 12:00; правки з 20:00 — до 16:00',
  'ніч рахується: ' + JSON.stringify(ніч));
ok(ніч.безНочі && ніч.міжНіч, 'інші етапи (без ночі) — як доти; між 22:00 і 10:00 — рівно 4 робочі години',
  'зламався рівний годинник: ' + JSON.stringify(ніч));

console.log('');
console.log('═══ 2. 4 ГОДИНИ ВІД «БЕРУ», 12 — НА ПРАВКИ ═══');
const коло = await p.evaluate(() => {
  const D = window.LQDesign;
  const opt = { fix: 12, night: 0 };
  const d = D.dzNew(); D.dzAttach(d, 'test@loomiq', 'mgr@loomiq'); D.dzSend(d, 'mgr@loomiq');
  const доБеру = D.dzLeft(d, 4, opt);
  D.dzTake(d, 'test@loomiq');
  const взяв = D.dzLeft(d, 4, opt);
  D.dzVer(d, 'test@loomiq', [{ name:'a.png', url:'u', role:'work' }], '', null, 'graphic');
  d.status = 'review';
  const здав = D.dzLeft(d, 4, opt);
  D.dzSay(d, 'mgr@loomiq', 'Зробіть синім', null, 'acct');
  const правка = { л: D.dzLeft(d, 4, opt), стан: d.status, коло: D.dzRound(d).fix };
  return { доБеру, взяв, здав, правка };
});
console.log('  ' + JSON.stringify(коло));
ok(коло.доБеру === null, 'до «Беру» годинника немає', 'годинник іде до «Беру»: ' + коло.доБеру);
ok(коло.взяв >= 239 && коло.взяв <= 240, 'узяв — 4 години', 'після «Беру» не 4 год: ' + коло.взяв);
ok(коло.здав === null, 'здав — годинник стоїть', 'після здачі годинник іде: ' + коло.здав);
ok(коло.правка.стан === 'revision' && коло.правка.коло && коло.правка.л >= 719 && коло.правка.л <= 720,
  'повернули на правку — 12 годин', 'правка: ' + JSON.stringify(коло.правка));

console.log('');
console.log('═══ 3. ПОКИ Є ПРАВКИ — НОВЕ НЕ БЕРУТЬ; У РОБОТІ НЕ БІЛЬШЕ 5 ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const u = (x) => Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:1 }, x || {});
  const j1 = designJobMake('2000101'); j1.units = [u({ note:'Лого' })];
  const j2 = designJobMake('2000102'); j2.units = [u({ note:'Лого' })];
  const j3 = designJobMake('2000103'); j3.units = [u({ note:'Лого' })];
  /* У мене правка в першому; друге й третє — у черзі відділу. */
  const fx = D.dzNew(); D.dzAttach(fx, 'test@loomiq', 'mgr@loomiq'); D.dzSend(fx, 'mgr@loomiq');
  D.dzTake(fx, 'test@loomiq');
  D.dzVer(fx, 'test@loomiq', [{ name:'a.png', url:'u', role:'work' }], '', null, 'graphic');
  fx.status = 'review';
  D.dzSay(fx, 'mgr@loomiq', 'Правка', null, 'acct');
  D.dzList(j1.units[0], 'graphic').push(fx);
  [j2, j3].forEach(j => { const q = D.dzNew(); D.dzQueue(q, 'mgr@loomiq'); D.dzList(j.units[0], 'graphic').push(q); });
  window.__fx = fx; window.__j2 = j2; window.__j3 = j3;
  openDesign();
  U.setTab('graphic');
  U.render(document.getElementById('dzRoot'));
});
await p.waitForTimeout(500);
const open = async id => {
  await p.evaluate(id => {
    const c = document.querySelector('[data-open="' + id + '"]');
    if(!c) throw new Error('картки ' + id + ' немає');
    c.click();
  }, id);
  await p.waitForTimeout(500);
};
await open('2000102');
const правки = await p.evaluate(async () => {
  const D = window.LQDesign;
  const q = D.dzList(__j2.units[0], 'graphic')[0];
  const підказка = ((document.querySelector('.dz-take-no') || {}).textContent || '').trim();
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 600));
  return { хто: q.who, підказка };
});
console.log('  ' + JSON.stringify(правки));
ok(правки.хто === '' && /правки/i.test(правки.підказка), 'є правка — нове з черги не береться, і під «Беру» сказано чому',
  'взяв нове попри правку: ' + JSON.stringify(правки));

const ліміт = await p.evaluate(async () => {
  const D = window.LQDesign, U = window.LQDesign.ui;
  /* Правку здав — тепер руки вільні. */
  __fx.status = 'review';
  D.dzVer(__fx, 'test@loomiq', [{ name:'b.png', url:'u2', role:'work' }], '', null, 'graphic');
  const типово = U.host.dzLimit();
  contentData.b2c = Object.assign({}, contentData.b2c, { dzLimit: 1 });
  /* Одне вже в роботі — друге з лімітом 1 не взяти. */
  const w = D.dzNew(); D.dzAttach(w, 'test@loomiq', 'mgr@loomiq'); D.dzSend(w, 'mgr@loomiq'); D.dzTake(w, 'test@loomiq');
  D.dzList(__j3.units[0], 'graphic').push(w);
  U.render(document.getElementById('dzRoot'));
  document.querySelector('[data-open="2000102"]').click();
  await new Promise(r => setTimeout(r, 400));
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 600));
  const q = D.dzList(__j2.units[0], 'graphic')[0];
  const заЛіміту = q.who;
  contentData.b2c.dzLimit = 5;
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 600));
  return { типово, заЛіміту, вільно: q.who };
});
console.log('  ' + JSON.stringify(ліміт));
ok(ліміт.типово === 5, 'за замовчуванням у роботі можна тримати 5', 'типовий ліміт: ' + ліміт.типово);
ok(ліміт.заЛіміту === '' && ліміт.вільно === 'test@loomiq', 'понад ліміт не бере, у межах — бере',
  'ліміт: ' + JSON.stringify(ліміт));

console.log('');
console.log('═══ 4. ЗАЙВА КАРТИНКА — ГЕТЬ ЦІЛКОМ ═══');
const img = await p.evaluate(() => {
  const png = (w, h, c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); };
  return { base: png(400, 500, '#222'), a: png(100, 100, '#f00'), b: png(100, 100, '#00f') };
});
await p.evaluate(({ base, a, b }) => {
  window.LQMock.close();
  window.__DONE = null;
  let n = 0;
  window.LQMock.openWork({ gid:'tee', size:'M', name:'Футболка', color:'Чорний',
    sides:[{ key:'front', label:'Перед', url: base }],
    works: [], places: [],
    onUpload: async () => (++n === 1 ? { name:'не-та.png', url:a, hash:'ha' } : { name:'та.png', url:b, hash:'hb' }),
    onDone: res => { window.__DONE = res; } });
}, img);
await p.waitForTimeout(500);
const клік = async sel => { await p.click(sel); await p.waitForTimeout(350); };
/* Порожнє вікно саме просить файл — це «не та»; одразу лягла на виріб. */
await клік('[data-mko-up]');           // та
const доВидалення = await p.evaluate(() => ({ робіт: document.querySelectorAll('.mko-wk-w').length,
  нанесень: document.querySelectorAll('[data-mko-p]').length, хрестиків: document.querySelectorAll('[data-mko-wdel]').length }));
await клік('[data-mko-wdel="0"]');      // прибрати «не ту» цілком
const після = await p.evaluate(() => ({ робіт: document.querySelectorAll('.mko-wk-w').length,
  нанесень: document.querySelectorAll('[data-mko-p]').length,
  лежить: (window.LQMock.peek().places.front || []).map(x => x.work) }));
console.log('  ' + JSON.stringify({ доВидалення, після }));
ok(доВидалення.робіт === 2 && доВидалення.нанесень === 2 && доВидалення.хрестиків === 2,
  'дві картинки, обидві на виробі, у кожної ×', 'до видалення: ' + JSON.stringify(доВидалення));
ok(після.робіт === 1 && після.нанесень === 1 && після.лежить.join() === '0',
  '× на картинці прибрав її і зі списку, і з виробу', 'після видалення: ' + JSON.stringify(після));
await клік('[data-mko-save]');
await p.waitForTimeout(800);
const здача = await p.evaluate(() => { const r = window.__DONE; return r ? {
  роботи: r.works.map(w => w.name), місця: r.sides.map(s => s.places.map(pl => pl.work)) } : null; });
console.log('  ' + JSON.stringify(здача));
ok(здача && здача.роботи.join() === 'та.png' && здача.місця[0].join() === '0',
  'у здачу пішла лише та картинка, що лишилась', 'у здачі: ' + JSON.stringify(здача));

/* Знята з виробу (× на нанесенні) і забута в списку — у здачу не йде теж. */
await p.evaluate(({ base, a, b }) => {
  window.__DONE = null;
  window.LQMock.openWork({ gid:'tee', size:'M', name:'Футболка', color:'Чорний',
    sides:[{ key:'front', label:'Перед', url: base }],
    works: [{ name:'не-та.png', url:a, hash:'ha' }, { name:'та.png', url:b, hash:'hb' }],
    places: [{ side:'front', work:1, x:0.5, y:0.3, w:0.26 }],
    onDone: res => { window.__DONE = res; } });
}, img);
await p.waitForTimeout(500);
await клік('[data-mko-save]');
await p.waitForTimeout(800);
const забута = await p.evaluate(() => { const r = window.__DONE; return r ? {
  роботи: r.works.map(w => w.name), місця: r.sides.map(s => s.places.map(pl => pl.work)) } : null; });
console.log('  ' + JSON.stringify(забута));
ok(забута && забута.роботи.join() === 'та.png' && забута.місця[0].join() === '0',
  'картинка, що не лежить на виробі, у версію й аркуш не потрапляє', 'забута поїхала: ' + JSON.stringify(забута));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
