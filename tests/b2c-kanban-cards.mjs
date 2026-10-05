/* Картки канбану B2C — кожна роль бачить своє, з ескізом (04.10).

   Андрій: картки «важкувато сприймаються». Доти — стовпчик тексту без
   картинки; щоб зрозуміти, що за замовлення, картку відкривали.

   Перевіряємо на пʼяти замовленнях різних етапів:
     — менеджер: ескіз, вироби з кольором і штуками, сума з «оплачено %»,
       смужка етапів, хто зараз працює, «до відправки N днів», канал клієнта
       внизу; правки клієнта — червоним; контроль якості не зникає з дошки;
       стан у цеху — «у цеху», а не «ще не передано»;
     — дизайнер: ескіз, виріб із кружечком кольору тканини, нанесення з
       розмірами в см, версія; без суми й без клієнта;
     — цех: ескіз вишивки, вироби з розмірами, три значки готовності;
     — нічого не вилазить за край картки.

   Запуск:  node tests/b2c-kanban-cards.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8933;
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
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Оля',       role:'designer' },
         { email:'st@loomiq',  name:'Ігор',       role:'embroidery' }],
  /* Роздрібна ціна саме цього виробу. Саме з неї має рахуватись сума
     замовлення — а не з `totalPrice`, якого в приватних замовленнях немає. */
  products: { retail: { tee: 700 } }
};
const ORDERS_X = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія Дерещук',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    /* Поле прорахунку стоїть і навмисно розходиться з прайсом: перевіряємо,
       що виграє склад, а не давнє число з іншого місця. */
    totalPrice: 4850, items:[] }
];

const mk = (id, no, nick, sum, extra) => Object.assign({ id, orderId:no, type:'client', dir:'b2c', name:nick,
  status:'new', site:'main', payments:[], hist:[], createdAt:'2026-10-01T09:00:00.000Z',
  crmChatId:'c'+id, crmChatName:nick, crmNick:nick, totalPrice:sum, items:[] }, extra || {});
const ORDERS = [ mk('1','2000101','asia_dera',4850), mk('2','2000102','oksana.p',12600),
  mk('3','2000103','coffee_lviv',28400), mk('4','2000104','marta_k',3200, { tracks:{ prod:'work' } }),
  mk('5','2000105','ivan_sport',9100, { tracks:{ prod:'done', qc:'check' } }) ];
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
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Д.', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-27T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана П.' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p5', at:'2026-09-24T09:05:00.000Z', amount:6300, acc:'mono2', orderId:'2000102', tag:'prepay', counter:'Оксана' },\n" +
  "    { id:'p6', at:'2026-09-24T09:05:00.000Z', amount:3200, acc:'mono2', orderId:'2000104', tag:'pay', counter:'Марта' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' }\n" +
  '  ];\n' +
  '  function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  function PayCol(){}\n' +
  '  PayCol.prototype=Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where=function(){ return this; };\n' +
  '  PayCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__PAYS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__PAYS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  PayCol.prototype.doc=function(id){ return { set:function(v){\n' +
  '    var p=window.__PAYS.filter(function(x){ return x.id===id; })[0];\n' +
  '    if(p) Object.keys(v).forEach(function(k){ p[k]=v[k]; });\n' +
  '    return Promise.resolve(); } }; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  "      if(n==='payments') return new PayCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
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
  const pic = (bg, fg, txt) => { const c = document.createElement('canvas'); c.width = 240; c.height = 240;
    const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0,0,240,240); x.fillStyle = fg;
    x.fillRect(60,40,120,170); x.fillStyle = '#1F6F3A'; x.font = 'bold 28px sans-serif'; x.fillText(txt, 78, 110); return c.toDataURL(); };
  const now = new Date().toISOString();
  /* Строки — від сьогодні, інакше за тиждень тест читав би «прострочено». */
  const inDays = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
  const ver = (url, extra) => Object.assign({ at: now, by:'art@loomiq', files:[{ name:'мокап.png', url, role:'mock' }] }, extra || {});
  const unit = (gid, name, color, hex, size, qty) => Object.assign(U.unitNew(), { gid, name, color, colorHex:hex, size, qty });
  // 1: нове, без дизайну
  let j = designJobMake('2000101'); j.due = inDays(10);
  j.units = [unit('tee','Футболка базова','Чорний','#1d1d1f','M',3), unit('hoodie','Худі базове','Сірий','#9aa0a6','L',1)];
  // 2: у графічного, версія з мокапом
  j = designJobMake('2000102'); j.due = inDays(5);
  j.units = [unit('hoodie','Худі базове','Білий','#f4f4f4','L',4)];
  let d = D.dzNew(); Object.assign(d, { name:'Груди', side:'front', mm:{ w:100, h:60 }, who:'art@loomiq', sentAt: now, status:'work' });
  d.vers.push(ver(pic('#EEE', '#fff', 'v1'))); j.units[0].graphic.push(d);
  let d2 = D.dzNew(); Object.assign(d2, { name:'Спина', side:'back', mm:{ w:250, h:300 }, who:'art@loomiq', sentAt: now, status:'work' });
  j.units[0].graphic.push(d2);
  // 3: правка клієнта
  j = designJobMake('2000103'); j.due = inDays(2);
  j.units = [unit('tee','Футболка оверсайз','Бежевий','#d9c7a7','S',20), unit('tote','Шопер','Натуральний','#e8dcc3','',10)];
  d = D.dzNew(); Object.assign(d, { name:'Груди', side:'front', mm:{ w:90, h:90 }, who:'art@loomiq', sentAt: now, status:'revision' });
  d.vers.push(ver(pic('#EFE7DA', '#d9c7a7', 'v2'))); d.vers.push(ver(pic('#EFE7DA', '#d9c7a7', 'v3'))); j.units[0].graphic.push(d);
  // 4: виробництво
  j = designJobMake('2000104'); j.due = inDays(4);
  j.units = [unit('hoodie','Худі базове','Чорний','#1d1d1f','M',2)];
  d = D.dzNew(); Object.assign(d, { name:'Груди', side:'front', mm:{ w:100, h:60 }, who:'art@loomiq', sentAt: now, status:'approved', ok: now });
  d.vers.push(ver(pic('#222', '#111', 'OK'))); j.units[0].graphic.push(d);
  d = D.dzNew(); Object.assign(d, { name:'Груди', side:'front', mm:{ w:100, h:60 }, who:'st@loomiq', sentAt: now, status:'approved', ok: now });
  d.vers.push({ at: now, by:'st@loomiq', files:[{ name:'вишивка.png', url: pic('#222','#111','EMB'), role:'shot' }, { name:'2000104.dst', url:'data:,x', role:'machine' }] });
  j.units[0].stitch.push(d);
  // 5: контроль якості
  j = designJobMake('2000105'); j.due = inDays(3);
  j.units = [unit('tee','Футболка базова','Білий','#f4f4f4','XL',12)];
  d = D.dzNew(); Object.assign(d, { name:'Спина', side:'back', mm:{ w:200, h:200 }, who:'art@loomiq', sentAt: now, status:'approved', ok: now });
  d.vers.push(ver(pic('#EEE', '#fff', 'QC'))); j.units[0].graphic.push(d);
  openDesign();
});
await p.waitForTimeout(900);
const board = seat => p.evaluate(s => { window.LQDesign.ui.setTab(s); openDesign();
  return new Promise(r => setTimeout(() => r([...document.querySelectorAll('.dz-board .dz-col')].map(col => ({
    col: col.dataset.col,
    cards: [...col.querySelectorAll('.dz-card-w')].map(w => ({
      no: (w.querySelector('.dz-c-main > b') || {}).textContent || '',
      v2: w.classList.contains('is-v2'), fix: w.classList.contains('is-fix'), go: w.classList.contains('is-go'),
      img: !!w.querySelector('.dz-c-pic img'),
      what: (w.querySelector('.dz-c-what') || {}).textContent || '',
      sw: !!w.querySelector('.dz-c-what .dz-sw'),
      state: (w.querySelector('.dz-c-state') || {}).textContent || '',
      sum: (w.querySelector('.dz-card-sum') || {}).textContent || '',
      paid: (w.querySelector('.dz-c-paid') || {}).textContent || '',
      paidColor: (() => { const e = w.querySelector('.dz-c-paid'); return e ? getComputedStyle(e).color + '|' + getComputedStyle(e).backgroundColor : ''; })(),
      chain: [...w.querySelectorAll('.dz-c-chain b')].map(b => b.className + ':' + b.textContent.trim()),
      nick: !!w.querySelector('.dz-card-nick'),
      steps: w.querySelectorAll('.dz-c-steps i').length,
      stepsDone: w.querySelectorAll('.dz-c-steps i.done').length,
      who: (() => { const e = w.querySelector('.dz-c-who'); return e ? Math.round(e.getBoundingClientRect().width) : 0; })(),
      due: (w.querySelector('.dz-c-bot .dz-card-due') || {}).textContent || '',
      chip: [...w.querySelectorAll('.dz-card-m b')].map(b => b.textContent),
      ready: [...w.querySelectorAll('.dz-c-ready b')].map(b => b.className + ':' + b.textContent.trim()),
      ig: !!w.querySelector('.dz-card-ig'),
      igLast: (w.lastElementChild || {}).className === 'dz-card-ig',
      over: [...w.querySelectorAll('.dz-card *')].filter(e => {
        const r = e.getBoundingClientRect(), c = w.getBoundingClientRect();
        return r.width && (r.right > c.right + 1 || r.left < c.left - 1); }).length
    }))
  }))), 600)); }, seat);
const find = (cols, no) => { for(const c of cols) for(const k of c.cards) if(k.no.indexOf(no) >= 0) return Object.assign({ col: c.col }, k); return null; };

console.log('═══ МЕНЕДЖЕР ═══');
const A = await board('acct');
const a1 = find(A, '2000001'), a2 = find(A, '2000002'), a3 = find(A, '2000003'), a4 = find(A, '2000004'), a5 = find(A, '2000005');
console.log('   ' + JSON.stringify(a2));
ok(A.every(c => c.cards.every(k => k.v2)), 'усі картки менеджера — нового вигляду', 'є старі картки');
ok(a1 && a1.img && a2 && a2.img && a4.img, 'на картці ескіз (або картинка з ТЗ, поки ескізу немає)', 'картинки немає');
/* 05.10: без назви товару й ніка — це видно в самій картці. */
ok(!a1.what && !a1.nick && !a2.what, 'на плитці немає назви товару й ніка', 'товар/нік на плитці: ' + a1.what);
/* 05.10: гроші — текстом, без червоного. */
ok(/12 600/.test(a2.sum) && a2.paid === 'не оплачено 6 300 ₴' && a4.paid === 'оплачено' &&
   !/176, 58, 26|253, 236, 234/.test(a2.paidColor + a3.paidColor),
  'гроші текстом: «не оплачено 6 300 ₴» / «оплачено» — без червоного', 'оплата: ' + [a2.paid, a3.paid, a4.paid, a2.paidColor].join(' / '));
/* 05.10: замість рисочок — етапи галочками по порядку. */
console.log('   ланцюжок 2000002: ' + a2.chain.join(' | '));
console.log('   ланцюжок 2000004: ' + a4.chain.join(' | '));
ok(a2.steps === 0 && a2.chain.length === 5 && a2.chain[0] === 'now:Графіка · Оля' && a2.chain.slice(1).every(x => /^next:/.test(x)),
  'графіка в роботі: «Графіка · Оля», далі сірим — Вишивка, Одяг, Виробництво, Відправка', 'ланцюжок: ' + a2.chain.join(' | '));
ok(a4.chain.join(' | ') === 'ok:✓ Графіка | ok:✓ Вишивка | now:Одяг не замовлено | now:У виробництві | next:Відправка',
  'у цеху: ✓ Графіка · ✓ Вишивка · Одяг не замовлено · У виробництві · Відправка', 'ланцюжок: ' + a4.chain.join(' | '));
ok(a2.who === 0 && a4.who === 0, 'кружечка з людиною немає — у кого етап, написано словами', 'кружечок лишився');
ok(/^до відправки \d+ (день|дні|днів)$/.test(a2.due), 'унизу — «до відправки N днів»: ' + a2.due, 'строк не той: ' + a2.due);
ok(a2.ig && a2.igLast, 'канал клієнта (Instagram) — внизу картки', 'кнопки каналу внизу немає');
ok(a3.fix && a3.chip.indexOf('правки клієнта') >= 0, 'правки клієнта — червоним', 'правки не видно');
ok(a5 && a5.col === 'prod' && /контролі якості/.test(a5.state), 'контроль якості не зникає: картка в «Виробництві», стан «на контролі якості»',
  'контроль якості: ' + JSON.stringify(a5 && { col: a5.col, state: a5.state }));
ok(/^у цеху/.test(a4.state), 'у цеху — «у цеху · …», а не «ще не передано»: ' + a4.state, 'стан у цеху: ' + a4.state);

console.log('');
if(process.env.LQ_SHOT){ await board('acct'); await p.screenshot({ path: process.env.LQ_SHOT, fullPage: false }); }
console.log('═══ ДИЗАЙНЕР ═══');
const G = await board('graphic');
const g2 = find(G, '2000002'), g3 = find(G, '2000003');
console.log('   ' + JSON.stringify(g2));
ok(g2 && g2.img && !g2.what && g2.chain.length === 5, 'ескіз і етапи галочками; назви товару немає', 'дизайнер: ' + JSON.stringify(g2));
ok(/груди 10 × 6 см, спина 25 × 30 см/.test(g2.state) && /^v1/.test(g2.state), 'нанесення з розмірами в см і версія: ' + g2.state, 'нанесення: ' + g2.state);
ok(!g2.sum && !g2.ig && !g2.paid, 'без суми й без клієнта', 'дизайнер бачить гроші чи клієнта');
ok(g3 && g3.fix && g3.chip.indexOf('правка') >= 0, 'правка дизайнеру — червоним', 'правки не видно');

console.log('');
console.log('═══ ВИШИВАЛЬНИК ═══');
const T = await board('stitch');
const t4 = find(T, '2000004');
ok(t4 && t4.img && /груди 10 × 6 см/.test(t4.state) && t4.chain.length === 5, 'основний мокап, нанесення з розміром, етапи галочками', 'вишивальник: ' + JSON.stringify(t4));

console.log('');
console.log('═══ ЦЕХ ═══');
const P = await board('prod');
const p4 = find(P, '2000004');
console.log('   ' + JSON.stringify(p4));
ok(p4 && p4.img && !p4.what, 'основний мокап; назви товару на плитці немає', 'цех: ' + JSON.stringify(p4));
ok(p4.chain.join(' | ') === 'ok:✓ Графіка | ok:✓ Вишивка | now:Одяг не замовлено | now:У виробництві | next:Відправка' && !p4.go,
  'етапи галочками; одягу немає — без зеленого краю', 'цех: ' + p4.chain.join(' | '));
ok(/^одяг:/.test(p4.state), 'під виробами — лише де одяг (вишивку видно значком)', 'стан цеху: ' + p4.state);

console.log('');
const всі = [A, G, T, P].flat().flatMap(c => c.cards);
ok(всі.every(k => !k.over), 'ніщо не вилазить за край картки', 'вилазить: ' + всі.filter(k => k.over).map(k => k.no).join(', '));
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'картки канбану читаються з одного погляду');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
