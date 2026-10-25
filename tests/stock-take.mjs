/* ВЗЯТИ ЗІ СКЛАДУ — У САМІЙ КАРТЦІ ЦЕХУ (25.10).

   Андрій: «всередині самого замовлення, де виробництво бере… якщо цей
   одяг є на складі й співпадає — кнопка «Взяти зі складу»… а наступна
   посилка поїде не в це замовлення, а в склад».
   1. Одяг позиції замовлено (в дорозі), а на складі є такий самий — у
      рядку «Одяг» картки цеху кнопка «Взяти зі складу · N шт».
   2. Немає на складі такого (інший колір) — кнопки немає.
   3. Тиснуть — склад −N (журнал «під замовлення»), позиція «Отримано»,
      замовлення далі; у закупівлі, що їде, ці N шт — «склад · замість №».
   4. Частково: на складі менше, ніж треба, — беруть скільки є, решта їде
      в замовлення, позиція чекає.
   5. Посилку перевірили — переадресоване лягає приходом на склад, решта —
      у замовлення.
   6. «Нове» (одяг ще не замовлено): взяли зі складу — картка сама
      «Готово до роботи».
   7. Немає на складі — кнопка сіра, неактивна; без доступу до виробництва
      кнопки немає; доступ — лише ролі з дошкою «Виробництво».

   Запуск:  node tests/stock-take.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9145;
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

console.log('═══ 1–3. ВЗЯТИ ЗІ СКЛАДУ, ПОСИЛКА — НА СКЛАД ═══');
const рз = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign(); U.setTab('supply'); U.open(''); U.render(root);
  const h = U.host;
  const g = h.catalog().find(x => (x.colors || []).length >= 2 && (x.sizes || []).length >= 2);
  const колір = g.colors[0].name || g.colors[0].id, інший = g.colors[1].name || g.colors[1].id, розм = g.sizes[0];
  const j = designJobMake('2000201');
  j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: колір, size: розм, qty: 3, note:'Лого' }),
             Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: інший, size: розм, qty: 1, note:'Лого' })];
  const [u1, u2] = j.units;
  /* На складі — 5 шт того самого (модель, колір, розмір). */
  let st = h.stockState();
  st = D.stockApply(st, { kind:'in', gid: g.id, name: g.name, color: колір, size: розм, qty: 5, cost: 200, by:'t' }).st;
  await h.stockPut(st);
  /* Закупівля №7, в дорозі: обидві позиції замовлення. */
  await h.buySave({ kind:'buy', id:'buy-way', n: 7, status:'part', at:'2026-10-24T10:00:00.000Z', by:'t', ttn:'20450000000777', sup:{ id:'s1', name:'Текстиль-Ко' },
    rows:[{ orderId:'2000201', uid: u1.id, no:'#2000201-1', gid: g.id, name: g.name, color: колір, size: розм, qty: 3 },
          { orderId:'2000201', uid: u2.id, no:'#2000201-2', gid: g.id, name: g.name, color: інший, size: розм, qty: 1 }] });
  U.setTab('prod'); U.open('2000201'); U.render(root); await t(300);
  const кнопки = [...document.querySelectorAll('.dz-panel [data-do="u-stock-take"]')].map(b => ({ u: b.dataset.u, t: b.textContent, d: b.disabled }));
  const до = D.buyOrderState(j, '2000201', h.buys());
  const btn = document.querySelector('.dz-panel [data-do="u-stock-take"][data-u="' + u1.id + '"]');
  if(btn) btn.click();
  await t(800);
  const st2 = h.stockState();
  const x = D.stockFind(st2.items, g.id, колір, розм);
  const m = st2.moves[st2.moves.length - 1];
  const way = h.buys().find(b => b.id === 'buy-way');
  const зі = h.buys().find(b => b.stock && b.rows.some(r => r.uid === u1.id));
  const після = { u1: D.buyStateOf(h.buys(), '2000201', u1.id, 3).key, u2: D.buyStateOf(h.buys(), '2000201', u2.id, 1).key };
  const рядки = way.rows.map(r => (r.toStock ? 'склад:' : (r.uid === u1.id ? 'u1:' : 'u2:')) + r.qty + (r.toStock ? ':' + r.no : ''));
  const кнопкаПісля = !!document.querySelector('.dz-panel [data-do="u-stock-take"][data-u="' + u1.id + '"]');
  /* 5. Посилку перевірили. */
  U.setTab('supply'); U.open(''); U.render(root); await t(200);
  const stB = h.stockState(), шт0 = D.stockQty(stB.items, g.id, колір, розм), шт0b = D.stockQty(stB.items, g.id, інший, розм);
  document.querySelector('[data-do="buy-check"][data-id="buy-way"]').click(); await t(200);
  document.querySelector('[data-do="buy-ck-all"][data-id="buy-way"]').click(); await t(200);
  document.querySelector('[data-do="buy-recv"][data-id="buy-way"]').click(); await t(800);
  const stC = h.stockState();
  const прихід = { тойСамий: D.stockQty(stC.items, g.id, колір, розм) - шт0, інший: D.stockQty(stC.items, g.id, інший, розм) - шт0b,
    рух: (stC.moves[stC.moves.length - 1] || {}).note || '', u2: D.buyStateOf(h.buys(), '2000201', u2.id, 1).key,
    статус: h.buys().find(b => b.id === 'buy-way').status };
  return { кнопки, u1: u1.id, u2: u2.id, до, x: x && x.qty, m: m.kind + ':' + m.qty + ':' + m.orderId + ':' + (m.note || ''), зі: !!зі && зі.status,
           після, рядки, кнопкаПісля, прихід, колір, розм };
});
console.log('   ' + JSON.stringify(рз));
ok(рз.кнопки.length === 2 && рз.кнопки[0].u === рз.u1 && /Взяти зі складу · 3 шт/.test(рз.кнопки[0].t) && !рз.кнопки[0].d &&
   рз.кнопки[1].u === рз.u2 && рз.кнопки[1].d && /немає на складі/.test(рз.кнопки[1].t),
  'у рядку «Одяг»: є на складі — «Взяти зі складу · 3 шт» (активна); іншого кольору немає — сіра «немає на складі»', JSON.stringify(рз.кнопки));
ok(рз.x === 2 && /^out:-3:2000201:під замовлення/.test(рз.m) && рз.зі === 'got',
  'склад −3 (лишилось 2), у журналі «під замовлення», позиція закрита документом «Зі складу»', 'склад ' + рз.x + ' · ' + рз.m);
ok(рз.після.u1 === 'got' && !рз.кнопкаПісля, 'позиція — «Отримано», кнопки більше немає', JSON.stringify(рз.після));
ok(/^u2:1,склад:3:склад · замість #\d+-1$/.test(рз.рядки.join()),
  'у закупівлі, що їде: 3 шт цієї позиції — «склад · замість #…-1», друга позиція — як була', рз.рядки.join());
ok(рз.прихід.тойСамий === 3 && рз.прихід.інший === 0 && /закупівля №7 · склад · замість/.test(рз.прихід.рух) && рз.прихід.u2 === 'got' && рз.прихід.статус === 'got',
  'посилку перевірили: 3 шт лягли приходом на склад, друга позиція — у замовлення («Отримано»)', JSON.stringify(рз.прихід));

console.log('');
console.log('═══ 4. ЧАСТКОВО: НА СКЛАДІ МЕНШЕ, НІЖ ТРЕБА ═══');
const ч = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, h = U.host, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  const g = h.catalog().find(x => (x.colors || []).length >= 2 && (x.sizes || []).length >= 2);
  const колір = g.colors[0].name || g.colors[0].id, розм = g.sizes[1];
  const j = designJobMake('2000202');
  j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: колір, size: розм, qty: 4, note:'Лого' })];
  const u = j.units[0];
  let st = h.stockState();
  st = D.stockApply(st, { kind:'in', gid: g.id, name: g.name, color: колір, size: розм, qty: 1, cost: 200, by:'t' }).st;
  await h.stockPut(st);
  await h.buySave({ kind:'buy', id:'buy-way2', n: 8, status:'sent', at:'2026-10-24T11:00:00.000Z', by:'t', sup:{ id:'s1', name:'Текстиль-Ко' },
    rows:[{ orderId:'2000202', uid: u.id, no:'#2000202-1', gid: g.id, name: g.name, color: колір, size: розм, qty: 4 }] });
  U.setTab('prod'); U.open('2000202'); U.render(root); await t(300);
  const b = document.querySelector('.dz-panel [data-do="u-stock-take"]');
  const текст = b ? b.textContent : '';
  if(b) b.click();
  await t(800);
  const way = h.buys().find(x => x.id === 'buy-way2');
  return { текст, склад: D.stockQty(h.stockState().items, g.id, колір, розм),
           рядки: way.rows.map(r => (r.toStock ? 'склад:' : 'u:') + r.qty).join(), стан: D.buyStateOf(h.buys(), '2000202', u.id, 4).key,
           кнопка: (() => { const x = document.querySelector('.dz-panel [data-do="u-stock-take"]'); return x ? (x.disabled ? 'сіра' : 'активна') : 'немає'; })() };
});
console.log('   ' + JSON.stringify(ч));
ok(/Взяти зі складу · 1 шт/.test(ч.текст) && ч.склад === 0 && ч.рядки === 'u:3,склад:1' && ч.стан === 'sent' && ч.кнопка === 'сіра',
  'на складі 1 з 4: взяли 1, у посилці 1 шт — на склад, 3 — у замовлення; позиція чекає решту, кнопка сіра', JSON.stringify(ч));

console.log('');
console.log('═══ 6–7. «НОВЕ» → «ГОТОВО ДО РОБОТИ»; СІРА КНОПКА; ДОСТУП ═══');
const н = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, h = U.host, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  const g = h.catalog().find(x => (x.colors || []).length >= 2 && (x.sizes || []).length >= 2);
  const колір = g.colors[0].name || g.colors[0].id, інший = g.colors[1].name || g.colors[1].id, розм = g.sizes[0];
  orders.push({ id:'3', orderId:'2000203', type:'client', dir:'b2c', name:'Віра', status:'prorahunok', site:'main', payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] });
  const j = designJobMake('2000203');
  j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: колір, size: розм, qty: 1, note:'Лого' })];
  const o = orders.find(x => x.orderId === '2000203');
  const до = D.prodAt(j, o);
  U.setTab('prod'); U.open('2000203'); U.render(root); await t(300);
  const b = document.querySelector('.dz-panel [data-do="u-stock-take"]');
  const активна = !!b && !b.disabled;
  if(b) b.click();
  await t(800);
  const після = D.prodAt(j, o);
  /* Сіра: на складі немає (інший колір, нічого не лежить). */
  j.units.push(Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: інший, size: g.sizes[1], qty: 2, note:'Лого' }));
  U.render(root); await t(300);
  const сіра = [...document.querySelectorAll('.dz-panel [data-do="u-stock-take"]')].map(x => ({ d: x.disabled, t: x.textContent }));
  /* Без доступу до виробництва — кнопки немає. */
  const can0 = h.can; h.can = k => k === 'prod' ? false : (can0 ? can0(k) : true);
  U.render(root); await t(200);
  const безДоступу = document.querySelectorAll('.dz-panel [data-do="u-stock-take"]').length;
  h.can = can0; U.render(root);
  const доступ = ['production', 'operator', 'qcprod', 'print', 'supply', 'designer'].map(r => r + ':' + (((presetOf(r) || {}).boards || []).indexOf('prod') >= 0 ? 1 : 0)).join();
  return { до, активна, після, сіра, безДоступу, доступ };
});
console.log('   ' + JSON.stringify(н));
ok(н.до === 'new' && н.активна && н.після === 'ready', '«Нове»: на складі є — кнопка активна; взяли — картка сама «Готово до роботи»', JSON.stringify(н));
ok(н.сіра.length === 1 && н.сіра[0].d && /немає на складі/.test(н.сіра[0].t), 'такого немає на складі — «Взяти зі складу · немає на складі», сіра й неактивна', JSON.stringify(н.сіра));
ok(н.безДоступу === 0 && /production:1,operator:1,qcprod:1,print:1,supply:0,designer:0/.test(н.доступ),
  'без доступу до виробництва кнопки немає; доступ — у ролей із дошкою «Виробництво»', н.безДоступу + ' · ' + н.доступ);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'взяти зі складу в картці цеху: склад −, посилка — на склад, частково — решта їде');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
