/* ЧЕРГА В B2C (19.10).

   Андрій: перший платіж до 300 ₴ (бронь) — питаємо «це черга?»: так — у
   колонку «Черга» перед «Нове»; ні — звичайне, більше не питаємо. Більше
   300 — без питань. Кнопка «⏳ У чергу» для будь-якої суми. З черги
   виводить «Передати дизайнеру».

   Запуск:  node tests/b2c-queue.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8978;
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
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' }],
  products: { retail: { tee: 700 } }
};
const ORDERS = [
  { id:'q1', orderId:'2000401', type:'client', dir:'b2c', name:'Черга Ірина', status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-10-19T09:00:00.000Z', crmChatId:'cq1', crmChatName:'Ірина', totalPrice:0, items:[] },
  { id:'q2', orderId:'2000402', type:'client', dir:'b2c', name:'Звичайний Олег', status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-10-19T10:00:00.000Z', crmChatId:'cq2', crmChatName:'Олег', totalPrice:0, items:[] },
  { id:'q3', orderId:'2000403', type:'client', dir:'b2c', name:'Велика Ганна', status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-10-19T11:00:00.000Z', crmChatId:'cq3', crmChatName:'Ганна', totalPrice:0, items:[] }
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
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'a1', at:'2026-10-19T08:10:00.000Z', amount:250, acc:'mono1', counter:'Ірина', desc:'бронь' },\n" +
  "    { id:'a2', at:'2026-10-19T08:20:00.000Z', amount:300, acc:'mono1', counter:'Олег', desc:'передоплата' },\n" +
  "    { id:'a3', at:'2026-10-19T08:30:00.000Z', amount:800, acc:'mono1', counter:'Ганна', desc:'передоплата' },\n" +
  "    { id:'a4', at:'2026-10-19T08:40:00.000Z', amount:150, acc:'mono1', counter:'Олег', desc:'доплата' },\n" +
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




const rows = () => p.evaluate(() => [...document.querySelectorAll('.pp-list .pp-row')].map(r => r.dataset.pp));
const setup = async () => p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  ['2000401', '2000402', '2000403'].forEach(id => { const j = designJobMake(id); j.state = 'new';
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'Сова', artKind:'k1', artKindName:'Простий' })]; });
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await setup();
await p.waitForTimeout(500);
const linkPay = async (orderId, pid) => {
  await p.evaluate(id => { document.querySelectorAll('[data-close]').forEach(x => x.click());
    const c = document.querySelector('#dzRoot [data-open="' + id + '"]'); if(c) c.click(); }, orderId);
  await p.waitForTimeout(500);
  await p.evaluate(() => { const b = document.querySelector('[data-fold="Гроші"]'); if(b && !document.querySelector('.dz-panel [data-do="pay-pick"]')) b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('[data-do="pay-pick"]')].pop().click());
  await p.waitForTimeout(300);
  await p.click('.pp-row[data-pp="' + pid + '"]');
  await p.click('[data-pp-go]');
  await p.waitForTimeout(700);
};
const col = id => p.evaluate(id => { const D = window.LQDesign; return D.chainAt(designJobMake(id), orders.find(x => x.orderId === id)); }, id);

console.log('═══ 1. КОЛОНКА «ЧЕРГА» ПЕРЕД «НОВЕ» ═══');
const кол = await p.evaluate(() => window.LQDesign.CHAIN.map(x => x.label).slice(0, 2).join(' → '));
const наДошці = await p.evaluate(() => [...document.querySelectorAll('#dzRoot .dz-col-h')].map(x => x.textContent.trim()).slice(0, 2));
ok(кол === 'Черга → Нове' && /Черга/.test(наДошці[0] || ''), 'на дошці акаунта: «Черга», потім «Нове»', кол + ' / ' + JSON.stringify(наДошці));

console.log('');
console.log('═══ 2. ПЕРШИЙ ПЛАТІЖ 250 ₴ → «ЦЕ ЧЕРГА?» → ТАК ═══');
await linkPay('2000401', 'a1');
const пит = await p.evaluate(() => { const w = document.querySelector('.dz-qa'); return w ? w.querySelector('.dz-cf-h').textContent : null; });
ok(/Перший платіж 250\s*₴ — це черга\?/.test(пит || ''), 'привʼязали перший платіж 250 ₴ — питання «це черга?»', 'питання: ' + пит);
await p.click('.dz-qa [data-qa="yes"]');
await p.waitForTimeout(600);
const q1 = await p.evaluate(() => { const j = designJobMake('2000401');
  const card = document.querySelector('#dzRoot [data-open="2000401"]');
  const колонка = card && card.closest('[data-col]') ? card.closest('[data-col]').dataset.col : '';
  return { q: !!j.queue, sum: j.queue && j.queue.sum, колонка, badge: (document.querySelector('.dz-panel .dz-q-on') || {}).textContent || '',
           стан: card ? card.textContent : '' }; });
console.log('  ' + JSON.stringify(q1));
ok(q1.q && q1.sum === 250 && (await col('2000401')) === 'queue', '«Так, у чергу» — замовлення в колонці «Черга»', JSON.stringify(q1));
ok(/У черзі/.test(q1.badge) && /⏳ сьогодні/.test(q1.стан), 'у картці «⏳ У черзі», на дошці — скільки днів у черзі', JSON.stringify(q1));
const dz = await p.evaluate(() => { const D = window.LQDesign; const j = designJobMake('2000401');
  return D.dzList(j.units[0], 'graphic').filter(d => d.sentAt || d.pool).length; });
ok(dz === 0, 'у черзі дизайнерам нічого не пішло', 'передано: ' + dz);

console.log('');
console.log('═══ 3. «ПЕРЕДАТИ ДИЗАЙНЕРУ» ВИВОДИТЬ З ЧЕРГИ ═══');
const hand = await p.evaluate(async () => {
  const b = document.querySelector('.dz-panel [data-do="dz-hand-all"]');
  if(!b) return { err:'немає кнопки' };
  const dis = b.disabled;
  b.click();
  await new Promise(r => setTimeout(r, 700));
  const D = window.LQDesign, j = designJobMake('2000401');
  return { dis, q: !!j.queue, hist: (j.queueHist || []).length, why: ((j.queueHist || [])[0] || {}).why,
           sent: D.dzList(j.units[0], 'graphic').some(d => d.sentAt || d.pool) };
});
console.log('  ' + JSON.stringify(hand));
ok(!hand.dis && hand.sent && !hand.q && hand.why === 'передали дизайнеру' && (await col('2000401')) !== 'queue',
  'клієнт готовий — «Передати дизайнеру»: робота в дизайнера, з черги вийшло само', JSON.stringify(hand));

console.log('');
console.log('═══ 4. «НІ, ЗВИЧАЙНЕ» — І БІЛЬШЕ НЕ ПИТАЄМО ═══');
await linkPay('2000402', 'a2');
const пит2 = await p.evaluate(() => !!document.querySelector('.dz-qa'));
ok(пит2, 'рівно 300 ₴ — теж питаємо (включно)', 'питання на 300: ' + пит2);
await p.click('.dz-qa [data-qa="no"]');
await p.waitForTimeout(500);
const n2 = await col('2000402');
await linkPay('2000402', 'a4');
const пит3 = await p.evaluate(() => !!document.querySelector('.dz-qa'));
const ask2 = await p.evaluate(() => (designJobMake('2000402').queueAsk || {}).ans);
ok(n2 === 'new' && ask2 === 'no' && !пит3, '«Ні, звичайне» — лишається «Нове»; доплата 150 ₴ уже нічого не питає', JSON.stringify({ n2, ask2, пит3 }));

console.log('');
console.log('═══ 5. ПЕРШИЙ БІЛЬШЕ 300 — БЕЗ ПИТАНЬ; КНОПКА «⏳ У ЧЕРГУ» ═══');
await linkPay('2000403', 'a3');
const пит4 = await p.evaluate(() => !!document.querySelector('.dz-qa'));
ok(!пит4 && (await col('2000403')) === 'new', 'перший платіж 800 ₴ — без питань, звичайне', 'питання на 800: ' + пит4);
const btnQ = await p.evaluate(async () => {
  const b = document.querySelector('.dz-panel [data-do="queue-in"]');
  if(!b) return null;
  b.click(); await new Promise(r => setTimeout(r, 500));
  return { q: !!designJobMake('2000403').queue, again: !!document.querySelector('.dz-panel [data-do="queue-in"]') };
});
ok(btnQ && btnQ.q && !btnQ.again && (await col('2000403')) === 'queue', 'кнопка «⏳ У чергу» — будь-яку суму в чергу; у черзі кнопки вже немає', JSON.stringify(btnQ));

console.log('');
console.log('═══ 6. ПЕРЕТЯГУВАННЯ «ЧЕРГА» ↔ «НОВЕ» ═══');
const drag = await p.evaluate(() => {
  const D = window.LQDesign, j = designJobMake('2000403'), o = orders.find(x => x.orderId === '2000403');
  const a = D.acctMove(j, o, 'new', 'test@loomiq');
  const b = D.acctMove(j, o, 'queue', 'test@loomiq');
  const j2 = designJobMake('2000401'), o2 = orders.find(x => x.orderId === '2000401');
  const c = D.acctMove(j2, o2, 'queue', 'test@loomiq');
  return { a, b, c };
});
ok(drag.a === 'new' && drag.b === 'queue' && drag.c === null, 'з черги в «Нове» і назад — руками; те, що вже в дизайнера, у чергу не тягнеться', JSON.stringify(drag));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'черга: бронь до 300 ₴ — питаємо, у черзі дизайнерам нічого, «Передати дизайнеру» — у роботу');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
