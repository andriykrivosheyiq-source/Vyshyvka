/* Склад B2C: «Замовити одяг» і «Склад», собівартість і журнал (04.10).

   Андрій: «ліворуч — треба замовити, праворуч — можна взяти зі складу;
   кнопка заповнити склад»; списувати одразу; склад — модель, колір, розмір;
   править власник; «вести собівартість, щоб розуміти, яка ціна в нас на
   складі в грошах».

   Запуск:  node tests/stock.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8967;
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

p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

console.log('═══ 1. ЛОГІКА СКЛАДУ ═══');
const core = await p.evaluate(() => {
  const D = window.LQDesign;
  const out = {};
  let st = { items: [], moves: [] };
  let r = D.stockApply(st, { kind:'in', gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:10, cost:200, by:'a' }); st = r.st;
  r = D.stockApply(st, { kind:'in', gid:'tee', color:'чорний ', size:'M', qty:10, cost:260, by:'a' }); st = r.st;
  out.avg = D.stockFind(st.items, 'tee', 'Чорний', 'M');
  out.value1 = D.stockValue(st.items);
  r = D.stockApply(st, { kind:'out', gid:'tee', color:'Чорний', size:'M', qty:25 });
  out.tooMuch = r.err;
  r = D.stockApply(st, { kind:'out', gid:'tee', color:'Чорний', size:'M', qty:5, orderId:'2000201' }); st = r.st;
  out.outMove = r.move;
  r = D.stockApply(st, { kind:'adj', gid:'tee', color:'Чорний', size:'M', qty:14, note:'перерахунок' }); st = r.st;
  out.adj = { qty: D.stockQty(st.items, 'tee', 'Чорний', 'M'), move: r.move.qty, was: r.move.was };
  out.moves = st.moves.map(m => m.kind + ':' + m.qty);
  out.value2 = D.stockValue(st.items);
  const rows = [{ key:'A|1', gid:'tee', color:'Чорний', size:'M', qty:10 }, { key:'B|1', gid:'tee', color:'Чорний', size:'M', qty:5 },
                { key:'C|1', gid:'tee', color:'Білий', size:'S', qty:2 }];
  const sp = D.stockSplit(rows, st.items);
  out.split = { take: sp.take.map(x => x.key + ':' + x.qty), buy: sp.buy.map(x => x.key + ':' + x.qty) };
  const buys = [{ kind:'buy', status:'got', stock:true, rows:[{ orderId:'A', uid:'1', qty:2 }] }];
  out.part = D.buyStateOf(buys, 'A', '1', 5);
  out.full = D.buyStateOf(buys.concat([{ kind:'buy', status:'way', rows:[{ orderId:'A', uid:'1', qty:3 }] }]), 'A', '1', 5);
  out.cov = D.buyCovered(buys, 'A', '1');
  return out;
});
console.log('   ' + JSON.stringify(core));
ok(core.avg.qty === 20 && core.avg.cost === 230 && core.value1 === 4600,
  'два приходи: 10 × 200 + 10 × 260 → 20 шт за середньою 230 ₴, склад на 4 600 ₴ (колір без різниці в регістрі)', 'середня: ' + JSON.stringify(core.avg));
ok(/лише 20/.test(core.tooMuch || ''), 'списати більше, ніж є, не можна: «' + core.tooMuch + '»', 'списали понад залишок');
ok(core.outMove.qty === -5 && core.outMove.cost === 230 && core.outMove.orderId === '2000201',
  'списання під замовлення — за середньою ціною, з номером замовлення в журналі', 'списання: ' + JSON.stringify(core.outMove));
ok(core.adj.qty === 14 && core.adj.move === -1 && core.adj.was === 15 && core.value2 === 3220,
  'інвентаризація: було 15, насправді 14 — рух −1 у журналі, склад на 3 220 ₴', 'інвентаризація: ' + JSON.stringify(core.adj));
ok(core.moves.join() === 'in:10,in:10,out:-5,adj:-1', 'журнал — кожен рух, і невдале списання туди не потрапило', 'журнал: ' + core.moves);
ok(core.split.take.join() === 'A|1:10,B|1:4' && core.split.buy.join() === 'B|1:1,C|1:2',
  'потреба ділиться: є 14 — 10 + 4 зі складу, 1 і білі S — замовити', 'поділ: ' + JSON.stringify(core.split));
ok(core.cov === 2 && core.part.key === 'none' && /2 з 5/.test(core.part.label) && core.full.key === 'way',
  'позиція, закрита частково (2 з 5), — «не замовлено»; закрита повністю двома документами — стан повільнішого', 'стан: ' + JSON.stringify([core.part, core.full]));

console.log('');
console.log('═══ 2. ВКЛАДКИ Й «+ ЗАПОВНИТИ СКЛАД» ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block'; openDesign(); U.setTab('supply'); U.open(''); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
const tabs = await p.evaluate(() => [...document.querySelectorAll('.dz-buy-tab')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
ok(tabs.length === 2 && /Замовити одяг/.test(tabs[0]) && /Склад/.test(tabs[1]), 'дві вкладки: ' + tabs.join(' | '), 'вкладки: ' + JSON.stringify(tabs));
const cols = await p.evaluate(() => [...document.querySelectorAll('.dz-buy > div .dz-buy-h b')].map(b => b.textContent));
ok(cols.join('|') === 'Треба замовити|Можна взяти зі складу', 'ліворуч «Треба замовити», праворуч «Можна взяти зі складу»', 'колонки: ' + cols);
await p.evaluate(() => document.querySelector('[data-do="buy-tab"][data-k="stock"]').click());
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-do="stock-form"]').click());
await p.waitForTimeout(300);
const gid = await p.evaluate(() => { const s = document.querySelector('[data-stkf="gid"]');
  const g = window.LQDesign.ui.host.catalog().find(x => (x.colors || []).length && (x.sizes || []).length >= 3);
  s.value = g.id; s.dispatchEvent(new Event('change')); return g.id; });
await p.waitForTimeout(300);
const форма = await p.evaluate(() => {
  const c = document.querySelector('[data-stkf="color"]'); c.value = c.options[1].value; c.dispatchEvent(new Event('change'));
  const sizes = [...document.querySelectorAll('[data-sfq]')].map(x => x.dataset.sfq);
  const set = (z, v) => { const i = document.querySelector('[data-sfq="' + z + '"]'); i.value = v; i.dispatchEvent(new Event('input')); };
  set(sizes[0], 3); set(sizes[1], 5);
  const cost = document.querySelector('[data-stkf="cost"]'); cost.value = '180.5'; cost.dispatchEvent(new Event('change'));
  return { sizes, color: c.value };
});
console.log('   ' + JSON.stringify(форма));
ok(форма.sizes.length >= 3, 'обрали модель — одразу вся сітка розмірів: ' + форма.sizes.join(' '), 'сітки немає');
await p.evaluate(() => document.querySelector('[data-do="stock-in"]').click());
await p.waitForTimeout(500);
const after = await p.evaluate(() => ({ st: window.LQDesign.ui.host.stockState(),
  head: (document.querySelector('.dz-stk .dz-buy-h span') || {}).textContent || '',
  tab: (document.querySelectorAll('.dz-buy-tab')[1] || {}).textContent || '',
  log: [...document.querySelectorAll('.dz-stk-m')].map(x => x.textContent.replace(/\s+/g, ' ').trim()) }));
console.log('   ' + after.head + ' · ' + after.log.join(' / '));
ok(after.st.items.length === 2 && after.st.items.every(x => x.cost === 180.5) && after.st.moves.length === 2,
  'на склад лягли два розміри одним натиском, кожен з ціною 180,5 ₴, і два рухи в журналі', 'склад: ' + JSON.stringify(after.st));
ok(/8 шт · на 1 444 ₴/.test(after.head) && /8 шт/.test(after.tab), 'вартість складу видно: 8 шт на 1 444 ₴ (і на вкладці)', 'шапка: ' + after.head + ' / ' + after.tab);
ok(after.log.length === 2 && after.log.every(t => /\+\d/.test(t) && /Прихід/.test(t) && /180,50 ₴\/шт/.test(t)), 'журнал: «+3 · Прихід · 180,50 ₴/шт»', 'журнал: ' + JSON.stringify(after.log));

console.log('');
console.log('═══ 3. ІНВЕНТАРИЗАЦІЯ ═══');
await p.evaluate(() => document.querySelector('[data-do="stock-edit"]').click());
await p.waitForTimeout(300);
await p.evaluate(() => { const i = document.querySelector('[data-adj]'); i.value = '2';
  document.querySelector('[data-adjnote]').value = 'брак'; document.querySelector('[data-do="stock-adj"]').click(); });
await p.waitForTimeout(500);
const adj = await p.evaluate(() => { const st = window.LQDesign.ui.host.stockState(); const m = st.moves[st.moves.length - 1];
  return { qty: st.items.reduce((a, x) => a + x.qty, 0), m: m.kind + ':' + m.qty + ':' + m.note }; });
ok(adj.qty === 7 && adj.m === 'adj:-1:брак', 'перерахунок: 3 → 2, у журналі «−1 · Інвентаризація · брак»', 'інвентаризація: ' + JSON.stringify(adj));

console.log('');
console.log('═══ 4. НЕ ВЛАСНИК — ЛИШЕ ДИВИТЬСЯ ═══');
const ro = await p.evaluate(() => { const U = window.LQDesign.ui; const old = U.host.role; U.host.role = () => 'buyer';
  U.render(document.getElementById('dzRoot'));
  const r = { add: !!document.querySelector('[data-do="stock-form"]'), edit: !!document.querySelector('[data-do="stock-edit"]'),
              hint: /править власник/.test(document.querySelector('.dz-stk').textContent) };
  U.host.role = old; U.render(document.getElementById('dzRoot')); return r; });
ok(!ro.add && !ro.edit && ro.hint, 'закупник бачить склад і ціни, але заповнити й перерахувати може лише власник', 'не власник: ' + JSON.stringify(ro));

console.log('');
console.log('═══ 5. ПОВЕРНУТИ НА СКЛАД ═══');
const back = await p.evaluate(async () => {
  const U = window.LQDesign.ui, h = U.host;
  const it = h.stockState().items.find(x => x.size === 'S');
  const було = it.qty;
  await h.buySave({ kind:'buy', id:'buy-test-stock', stock:true, status:'got', n:0, at: new Date().toISOString(), by:'test@loomiq',
    sup:{ id:'', name:'Склад' }, rows:[{ orderId:'2000201', uid:'u1', no:'#2000201-1', gid: it.gid, name: it.name, color: it.color, size:'S', qty:2, cost: 150 }] });
  U.act('buy-tab', document.getElementById('dzRoot'), { k:'order' });
  await new Promise(r => setTimeout(r, 200));
  const кнопка = !!document.querySelector('[data-do="stock-back"][data-id="buy-test-stock"]');
  await U.act('stock-back', document.getElementById('dzRoot'), { id:'buy-test-stock' });
  await new Promise(r => setTimeout(r, 300));
  const st = h.stockState(), x = st.items.find(y => y.size === 'S'), m = st.moves[st.moves.length - 1];
  const b = Object.values(designBuys).find(y => y.id === 'buy-test-stock');
  return { кнопка, було, стало: x.qty, cost: x.cost, m: m.kind + ':' + m.qty, rows: b.rows.length, returned: !!b.returned,
           мітка: /Повернуто на склад/.test(document.querySelector('.dz-buy-hist').textContent) };
});
console.log('   ' + JSON.stringify(back));
ok(back.кнопка && back.стало === back.було + 2 && back.m === 'back:2' && back.rows === 0 && back.returned && back.мітка,
  'взяте зі складу повертається одним натиском: +2 на склад, рух «Повернення», документ позначено', 'повернення: ' + JSON.stringify(back));
ok(back.cost === Math.round((back.було * 180.5 + 2 * 150) / (back.було + 2) * 100) / 100,
  'повернули за ціною, за якою списали, — середня ціна перерахувалась', 'ціна після повернення: ' + back.cost);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'склад: дві вкладки, сітка розмірів, собівартість, журнал, правка лише власником');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
