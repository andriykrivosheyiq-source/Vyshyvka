/* ЧЕРГА ГРАФІЧНОГО ВІДДІЛУ.

   Андрій: «ми їх перевели, щоб дизайнери самі могли брати ці замовлення…
   як тільки заповнили замовлення, воно на статусі нове, вони самі можуть
   взяти його… на автомат буде переноситися, як тільки дизайнер взяв».
   І далі: відмовитись дизайнер не може — забрати може тільки акаунт-
   менеджер; годинник зупиняється, коли здали на перевірку; в адмінці —
   скільки замовлень можна тримати одночасно.

   Запуск:  node tests/dz-queue.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8927;
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


const unit = (U, extra) => Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
  color:'Чорний', size:'M', qty:3 }, extra || {});
const SETUP = `(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const u = (x) => Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:3 }, x || {});
  const o1 = orders.find(x => x.orderId === '2000101');
  const j1 = designJobMake('2000101');
  j1.units = [u({ note:'Логотип на груди' }),       // заповнено — стане в чергу
              u({}),                                // без ТЗ — чекає менеджера
              u({ note:'Напис ззаду' })];           // менеджер обрав людину сам
  const own = D.dzNew(); D.dzAttach(own, 'p@loomiq', 'mgr@loomiq');
  D.dzList(j1.units[2], 'graphic').push(own);
  window.__j1 = j1; window.__o1 = o1;
  const j2 = designJobMake('2000102'); j2.units = [u({ note:'Лого' })];
  const j3 = designJobMake('2000103'); j3.units = [u({ note:'Лого' })];
  window.__j2 = j2; window.__j3 = j3;
  openDesign();
})()`;
await p.evaluate(SETUP);
await p.waitForTimeout(600);

console.log('═══ 1. ЗАПОВНИЛИ — САМО СТАЛО В ЧЕРГУ ═══');
const авто = await p.evaluate(() => {
  const D = window.LQDesign;
  const стан0 = D.chainAt(__j1, __o1);
  /* Збереження саме нічого не ставить — лише кнопка «Зберегти й передати». */
  const сам = D.dzAutoQueue(__j1, __o1, 'mgr@loomiq') + __j1.units.reduce((a, u) => a + D.dzList(u, 'graphic').filter(D.dzInQueue).length, 0);
  const ho = D.dzHandOver(__j1, __o1, 'mgr@loomiq'); const n = ho.sent;
  const l = __j1.units.map(u => D.dzList(u, 'graphic').map(d => ({ черга: D.dzInQueue(d), хто: d.who, стан: d.status })));
  const подія = (D.dzList(__j1.units[0], 'graphic')[0] || { thread:[] }).thread.map(m => m.text);
  const знову = D.dzHandOver(__j1, __o1, 'mgr@loomiq').sent;
  return { стан0, сам, пропущено: ho.skipped, n, l, подія, знову, стан1: D.chainAt(__j1, __o1),
           годинник: D.dzLeft(D.dzList(__j1.units[0], 'graphic')[0], 24) };
});
console.log('  ' + JSON.stringify(авто));
ok(авто.сам === 0, 'просто збереження нічого не передає — лише кнопка', 'передалось без кнопки: ' + авто.сам);
ok(авто.n === 1 && авто.l[0][0] && авто.l[0][0].черга && авто.пропущено.join() === '2',
  '«Зберегти й передати»: позиція з ТЗ — у черзі відділу, без ТЗ (позиція 2) названа й лишилась',
  'автоматична черга не спрацювала: ' + JSON.stringify(авто.l));
ok(!авто.l[1].length, 'позиція без ТЗ у чергу не пішла — дизайнер не схопить половину',
  'позиція без ТЗ опинилась у черзі');
ok(авто.l[2].length === 1 && авто.l[2][0].хто === 'p@loomiq' && !авто.l[2][0].черга,
  'де менеджер обрав людину сам — автоматика не перебиває його рішення',
  'рішення менеджера перебито: ' + JSON.stringify(авто.l[2]));
ok(/передав дизайнерам/.test(авто.подія.join()), 'у розмові подія: ' + авто.подія.join(), 'події немає');
ok(авто.знову === 0, 'повторний натиск не ставить удруге', 'поставило вдруге: ' + авто.знову);
ok(авто.стан0 === 'new' && авто.стан1 === 'new',
  'у воронці замовлення лишається «Новим», поки ніхто не взяв',
  'воронка: ' + авто.стан0 + ' → ' + авто.стан1);
ok(typeof авто.годинник === 'number' && авто.годинник > 0,
  'годинник уже йде — від миті, коли стало в чергу',
  'годинника немає: ' + авто.годинник);

console.log('');
console.log('═══ 2. ЧЕРГУ БАЧАТЬ ДИЗАЙНЕРИ ═══');
await p.evaluate(() => {
  const D = window.LQDesign, U = window.LQDesign.ui;
  D.dzHandOver(__j2, orders.find(x => x.orderId === '2000102'), 'mgr@loomiq');
  D.dzHandOver(__j3, orders.find(x => x.orderId === '2000103'), 'mgr@loomiq');
  U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
});
await p.waitForTimeout(500);
const дошка = await p.evaluate(() => [...document.querySelectorAll('.dz-col')].map(c => ({
  кол: ((c.querySelector('.dz-col-h') || {}).textContent || '').replace(/\d+$/, '').trim(),
  карток: c.querySelectorAll('.dz-card-w').length })));
console.log('  ' + дошка.map(x => x.кол + ':' + x.карток).join(' · '));
ok(дошка[0] && /Черга відділу/.test(дошка[0].кол) && дошка[0].карток === 3,
  'перша колонка — «Черга відділу», і в ній усі три замовлення',
  'черги на дошці немає: ' + JSON.stringify(дошка));

console.log('');
console.log('═══ 3. «БЕРУ» ═══');
const open = async id => {
  await p.evaluate(id => {
    const c = document.querySelector('[data-open="' + id + '"]');
    if(!c) throw new Error('картки ' + id + ' немає');
    c.click();
  }, id);
  await p.waitForTimeout(500);
};
await open('2000101');
const картка = await p.evaluate(() => ({
  підказка: ((document.querySelector('.dz-w-q') || {}).textContent || '').trim(),
  кнопки: [...document.querySelectorAll('.dz-w .dz-b')].map(b => b.textContent.trim()),
  відмова: !!document.querySelector('[data-do="dz-no"]') }));
console.log('  ' + JSON.stringify(картка));
ok(/черзі відділу/.test(картка.підказка) && картка.кнопки.join() === 'Беру в роботу' && !картка.відмова,
  'у картці сказано, що це черга, і одна дія — «Беру в роботу»; відмови немає',
  'картка черги не та: ' + JSON.stringify(картка));
await p.evaluate(() => document.querySelector('[data-do="dz-take"]').click());
await p.waitForTimeout(800);
const взяла = await p.evaluate(() => {
  const D = window.LQDesign;
  const d = D.dzList(__j1.units[0], 'graphic')[0];
  return { хто: d.who, стан: d.status, черга: D.dzInQueue(d),
           подія: (d.thread.filter(m => m.kind === 'take')[0] || {}).text || '',
           воронка: D.chainAt(__j1, __o1) };
});
console.log('  ' + JSON.stringify(взяла));
ok(взяла.хто === 'test@loomiq' && взяла.стан === 'work' && !взяла.черга,
  'хто натиснув — той виконавець, і робота одразу «В роботі»',
  'після «Беру»: ' + JSON.stringify(взяла));
ok(/черги/.test(взяла.подія), 'подія в розмові: ' + взяла.подія, 'події «взяв» немає');
ok(взяла.воронка === 'design', 'у менеджера картка сама переїхала «У графічного дизайнера»',
  'воронка: ' + взяла.воронка);

console.log('');
console.log('═══ 4. ХТОСЬ УСТИГ РАНІШЕ ═══');
await p.evaluate(() => { document.querySelector('[data-close]') && document.querySelector('[data-close]').click(); });
await p.waitForTimeout(300);
await open('2000102');
const раніше = await p.evaluate(async () => {
  const D = window.LQDesign;
  const d = D.dzList(__j2.units[0], 'graphic')[0];
  d.who = 'p@loomiq';                                  // Петро натиснув на секунду раніше
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 700));
  return { хто: d.who, тост: ((document.querySelector('.toast, #toast, .dz-toast') || {}).textContent || '') };
});
console.log('  ' + JSON.stringify(раніше));
ok(раніше.хто === 'p@loomiq', 'друге натискання не перебило перше — робота лишилась у Петра',
  'робота перейшла: ' + раніше.хто);

console.log('');
console.log('═══ 5. ЛІМІТ «ОДНОЧАСНО В РОБОТІ» ═══');
await p.evaluate(() => { contentData.b2c = Object.assign({}, contentData.b2c, { dzLimit: 1 });
  document.querySelector('[data-close]') && document.querySelector('[data-close]').click(); });
await p.waitForTimeout(300);
await open('2000103');
const ліміт = await p.evaluate(async () => {
  const D = window.LQDesign;
  const d = D.dzList(__j3.units[0], 'graphic')[0];
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 700));
  const після = d.who;
  contentData.b2c.dzLimit = 0;
  document.querySelector('[data-do="dz-take"]').click();
  await new Promise(r => setTimeout(r, 700));
  return { заЛіміту: після, безЛіміту: d.who };
});
console.log('  ' + JSON.stringify(ліміт));
ok(ліміт.заЛіміту === '', 'з лімітом 1 і одним замовленням у роботі нове взяти не дає',
  'ліміт не спрацював: ' + ліміт.заЛіміту);
ok(ліміт.безЛіміту === 'test@loomiq', 'ліміт прибрали — узяла', 'без ліміту не взялось: ' + ліміт.безЛіміту);

console.log('');
console.log('═══ 6. ЗАБРАТИ МОЖЕ ТІЛЬКИ МЕНЕДЖЕР ═══');
const забрав = await p.evaluate(() => {
  const D = window.LQDesign;
  const d = D.dzList(__j3.units[0], 'graphic')[0];
  D.dzRecall(d, 'mgr@loomiq', 'p@loomiq', 'Петро');
  const іншому = { хто: d.who, стан: d.status, черга: D.dzInQueue(d) };
  D.dzRecall(d, 'mgr@loomiq', '', 'Петро');
  const вЧергу = { хто: d.who, черга: D.dzInQueue(d),
    подія: d.thread[d.thread.length - 1].text };
  return { іншому, вЧергу };
});
console.log('  ' + JSON.stringify(забрав));
ok(забрав.іншому.хто === 'p@loomiq' && забрав.іншому.стан === 'sent' && !забрав.іншому.черга,
  'віддали іншому — він отримав її як передану, з «Беру в роботу»',
  'віддати іншому: ' + JSON.stringify(забрав.іншому));
ok(!забрав.вЧергу.хто && забрав.вЧергу.черга && /чергу/.test(забрав.вЧергу.подія),
  'повернули в чергу — з подією: ' + забрав.вЧергу.подія,
  'повернути в чергу: ' + JSON.stringify(забрав.вЧергу));
/* Зона менеджера: «Черга відділу» у списку і в шапці. */
const зона = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const h = U.unitsHtml(__j3, {});
  return { вШапці: /Черга відділу · чекає/.test(h), олівець: /data-do="dz-swap"/.test(h),
           уСписку: /value="@queue"/.test(U.unitsHtml(__j1, {})) };
});
console.log('  ' + JSON.stringify(зона));
ok(зона.вШапці && зона.олівець, 'у менеджера в шапці зони: «Черга відділу · чекає …» і ✎, щоб віддати комусь',
   'шапка зони: ' + JSON.stringify(зона));

console.log('');
console.log('═══ 7. НАЛАШТУВАННЯ ═══');
const нал = await p.evaluate(async () => {
  paintB2c();
  const el = document.getElementById('b2c-dzlimit');
  if(!el) return { є:false };
  el.value = '3';
  document.getElementById('b2c-save').click();
  await new Promise(r => setTimeout(r, 900));
  return { є:true, збережено: (contentData.b2c || {}).dzLimit, хук: window.LQDesign.ui.host.dzLimit() };
});
console.log('  ' + JSON.stringify(нал));
ok(нал.є && нал.збережено === 3 && нал.хук === 3,
  'поле «Одночасно в роботі» поруч зі строками, зберігається й доходить до відділу',
  'налаштування: ' + JSON.stringify(нал));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
