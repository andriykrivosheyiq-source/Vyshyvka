/* ЗАКУПІВЛЯ Й ПЕРЕВІРКА ПОСИЛКИ ПО ШТУКАХ (25.10).

   Андрій: «замовитись M, дві штуки, а якщо немає — замовимо тільки одну…
   на перевірці і на закупці повинна бути кількість».
   1. «Треба замовити» M × 2: «замовляю 1 з 2» — у закупівлі 1 шт, друга
      лишається в «Треба замовити».
   2. Перевірка: «прийшло 2 з 3» → «Решта ще їде» — 2 шт прийнято окремим
      документом «Отримано», 1 шт лишається в цій закупівлі (позиція чекає).
   3. Доїхала не вся: «Не приїде — замовити знову» — нестача повертається в
      «Треба замовити» з позначкою, звідки не прийшла.
   4. Галочка — увесь рядок; «відмітити всі» — повні кількості.

   Запуск:  node tests/buy-units.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9149;
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


const r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign(); U.setTab('supply'); U.open(''); U.render(root);
  const h = U.host;
  const g = h.catalog().find(x => (x.colors || []).length && (x.sizes || []).length >= 2);
  const колір = g.colors[0].name || g.colors[0].id;
  const mk = (no, size, qty) => { const j = designJobMake(no);
    const u = Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: колір, size, qty, note:'Лого', confirmed: true });
    u.graphic = [Object.assign(D.dzNew(), { name:'ескіз', ok: { ver: 1, by:'t', at:'2026-10-24T10:00:00.000Z' } })];
    j.units = [u]; return { j, u }; };
  const A = mk('2000201', g.sizes[0], 2);
  const B = mk('2000202', g.sizes[1], 3);
  U.render(root); await t(200);
  const out = {};
  const need = () => D.buyNeed(U.pairsLive ? U.pairsLive() : [], h.buys()).map(x => x.orderId + ':' + x.qty).sort().join();
  out.need0 = need();
  /* 1. Замовити 1 з 2. */
  const cbA = [...document.querySelectorAll('[data-buys]')].find(x => x.dataset.buys.endsWith('|' + g.sizes[0]));
  cbA.checked = true; cbA.dispatchEvent(new Event('change')); await t(150);
  const qA = document.querySelector('[data-buyq="' + cbA.dataset.buys + '"]');
  out.qInput = qA ? qA.value + '/' + qA.max : 'немає';
  qA.value = 1; qA.dispatchEvent(new Event('change')); await t(150);
  document.querySelector('[data-do="buy-make"]').click(); await t(600);
  const bA = h.buys().filter(b => !b.stock && b.rows.some(x => x.uid === A.u.id));
  out.bA = bA.map(b => b.rows.filter(x => x.uid === A.u.id).map(x => x.qty).join()).join('|');
  out.need1 = need();
  out.stanA = D.buyStateOf(h.buys(), '2000201', A.u.id, 2).key;
  /* 2. B: замовили всі 3, прийшло 2 — «Решта ще їде». */
  U.render(root); await t(150);
  const cbB = [...document.querySelectorAll('[data-buys]')].find(x => x.dataset.buys.endsWith('|' + g.sizes[1]));
  cbB.checked = true; cbB.dispatchEvent(new Event('change')); await t(150);
  document.querySelector('[data-do="buy-make"]').click(); await t(600);
  const b0 = h.buys().find(b => !b.stock && b.rows.some(x => x.uid === B.u.id));
  document.querySelector('[data-do="buy-check"][data-id="' + b0.id + '"]').click(); await t(150);
  const q0 = document.querySelector('[data-bchq="' + b0.id + '|0"]');
  out.ckInput = q0 ? q0.value + '/' + q0.max : 'немає';
  q0.value = 2; q0.dispatchEvent(new Event('change')); await t(150);
  out.recvOff = !!document.querySelector('[data-do="buy-recv"][data-id="' + b0.id + '"][disabled]');
  out.partTxt = (document.querySelector('[data-do="buy-part"][data-id="' + b0.id + '"]') || {}).textContent || '';
  document.querySelector('[data-do="buy-part"][data-id="' + b0.id + '"]').click(); await t(700);
  const всіB = h.buys().filter(b => b.rows.some(x => x.uid === B.u.id) || b.id === b0.id || b.partOf === b0.id);
  out.docsB = всіB.map(b => b.status + ':' + b.rows.filter(x => x.uid === B.u.id).map(x => x.qty).join() + (b.partOf ? ':частина' : '')).sort().join('|');
  out.stanB = D.buyStateOf(h.buys(), '2000202', B.u.id, 3).key;
  out.needB = need();
  /* 3. Решта (1 шт) не приїде — замовити знову. */
  U.render(root); await t(150);
  const ckb = document.querySelector('[data-do="buy-check"][data-id="' + b0.id + '"]');
  if(ckb && !document.querySelector('[data-bchk="' + b0.id + '|0"]')) ckb.click();
  await t(150);
  out.missTxt = (document.querySelector('[data-do="buy-miss"][data-id="' + b0.id + '"]') || {}).textContent || '';
  document.querySelector('[data-do="buy-miss"][data-id="' + b0.id + '"]').click(); await t(700);
  const x0 = h.buys().find(b => b.id === b0.id);
  out.missB = { st: x0.status, rows: x0.rows.length, missing: (x0.missing || []).map(m => m.qty).join() };
  out.needB2 = need();
  out.мітка = [...document.querySelectorAll('.dz-buy-need .dz-buy-miss')].map(e => e.textContent).join(' | ');
  /* 4. «Відмітити всі» — повні кількості. */
  const bA1 = h.buys().find(b => !b.stock && b.status !== 'got' && b.rows.some(x => x.uid === A.u.id));
  U.render(root); await t(100);
  document.querySelector('[data-do="buy-check"][data-id="' + bA1.id + '"]').click(); await t(150);
  document.querySelector('[data-do="buy-ck-all"][data-id="' + bA1.id + '"]').click(); await t(150);
  out.allOn = !document.querySelector('[data-do="buy-recv"][data-id="' + bA1.id + '"][disabled]');
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(/2000201:2/.test(r.need0) && /2000202:3/.test(r.need0), 'у «Треба замовити»: M × 2 і L × 3', r.need0);
ok(r.qInput === '2/2' && r.bA === '1' && /2000201:1/.test(r.need1) && r.stanA === 'none',
  '«замовляю 1 з 2» — у закупівлі 1 шт, друга лишилась у «Треба замовити»', JSON.stringify({ q: r.qInput, bA: r.bA, need: r.need1, st: r.stanA }));
ok(r.ckInput === '0/3' && r.recvOff && /Решта ще їде · 1 шт/.test(r.partTxt),
  'перевірка: «прийшло 0 з 3» → 2; «Підтвердити» вимкнена, «Решта ще їде · 1 шт»', JSON.stringify({ c: r.ckInput, off: r.recvOff, t: r.partTxt }));
ok(r.docsB === 'got:2:частина|sent:1' && r.stanB === 'sent' && !/2000202/.test(r.needB),
  '«Решта ще їде»: 2 шт — окремим «Отримано», 1 шт їде далі в тій самій закупівлі; позиція чекає, у «Треба замовити» не повертається', JSON.stringify({ d: r.docsB, st: r.stanB, need: r.needB }));
ok(/Не приїде — замовити знову · 1 шт/.test(r.missTxt) && r.missB.st === 'got' && r.missB.missing === '1' && /2000202:1/.test(r.needB2) && /не прийшло з/.test(r.мітка),
  '«Не приїде — замовити знову»: 1 шт — у «Треба замовити» з позначкою «не прийшло з …»', JSON.stringify({ t: r.missTxt, m: r.missB, need: r.needB2, мітка: r.мітка }));
ok(r.allOn, '«відмітити всі» — повні кількості, «Підтвердити отримання» активна', String(r.allOn));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'закупівля й перевірка по штуках: частина — замовлено, решта чекає; нестача — ще їде або замовити знову');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
