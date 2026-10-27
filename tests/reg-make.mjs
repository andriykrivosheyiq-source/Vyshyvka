/* РЕЄСТР НОВОЇ ПОШТИ → «ПЕРЕДАНО КУРʼЄРУ» (25.10).

   Андрій: «передивись, що вона реально створюється і переноситься далі по
   статусу». Кнопка «Створити реєстр» у колонці «Реєстр» дошки цеху:
   1. Усі накладні прийняті — реєстр створено, усі картки «Передано курʼєру»,
      у списку «Реєстри» — номер і кількість.
   2. Нова пошта якусь накладну не знайшла (старий воркер: notFound) — ця
      картка лишається в «Реєстр» з причиною, решта — «Передано курʼєру».
   3. Новий воркер (success / errors) — переносимо лише прийняті.
   4. Нова пошта відмовила зовсім — нічого не переноситься, причина словами.

   Запуск:  node tests/reg-make.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9147;
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


const seed = async (n0, з) => p.evaluate(async ([n0, з]) => {
  const D = window.LQDesign, U = D.ui;
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign();
  const g = U.host.catalog().find(x => (x.colors || []).length && (x.sizes || []).length);
  const ids = [];
  for(let k = 0; k < 3; k++){
    const no = String(n0 + k);
    if(!orders.find(o => o.orderId === no)) orders.push({ id: 'r' + no, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + k, status:'prorahunok', site:'main', payments:[], hist:[], createdAt:'2026-10-20T10:00:00.000Z', totalPrice: 1000, items:[] });
    const o = orders.find(x => x.orderId === no);
    const j = designJobMake(no);
    j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: (g.colors[0].name || g.colors[0].id), size: g.sizes[0], qty: 1, note:'Лого' })];
    o.tracks = { qc:'ok' }; o.prodQc = { at:'2026-10-24T10:00:00.000Z' }; o.shipCol = 'reg';
    o.ttn = '2045000000' + з + k; o.ttnRef = 'ref-' + з + k; o.ttnSender = 'yuk';
    delete o.reg;
    ids.push(no);
  }
  return ids;
}, [n0, з]);
const стан = ids => p.evaluate(ids => ids.map(id => { const pr = window.LQDesign.ui.pairOf(id); return window.LQDesign.prodAt(pr.job, pr.o); }), ids);
const тиснути = async () => p.evaluate(async () => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  U.setTab('prod'); U.open(''); U.render(root);
  await new Promise(r => setTimeout(r, 200));
  const b = document.querySelector('[data-do="reg-make"]');
  const є = !!b;
  window.__toasts = [];
  const t0 = U.host.toast; U.host.toast = m => { window.__toasts.push(String(m)); try{ t0 && t0(m); }catch(e){} };
  if(b) b.click();
  await new Promise(r => setTimeout(r, 900));
  U.host.toast = t0;
  return { є, toast: window.__toasts.slice(-1)[0] || '' };
});

console.log('═══ 1. УСІ ПРИЙНЯТІ ═══');
const a = await seed(2000301, '1');
await p.evaluate(() => { window.__calls = []; window.LQDesign.ui.host.npRegistry = async (k, docs) => { window.__calls.push({ k, docs }); return { ref:'R1', number:'105-0001', notFound:[], errors:[] }; }; });
const до = await стан(a);
const r1 = await тиснути();
const після = await стан(a);
const calls = await p.evaluate(() => window.__calls.map(c => c.k + ':' + c.docs.length));
console.log('   ' + JSON.stringify({ до, після, r1, calls }));
ok(до.every(x => x === 'reg') && r1.є, 'три посилки в колонці «Реєстр», є кнопка «Створити реєстр»', JSON.stringify({ до, r1 }));
ok(calls.join() === 'yuk:3' && після.every(x => x === 'courier') && /Реєстр №105-0001 створено · 3 посилок → «Передано курʼєру»/.test(r1.toast),
  'реєстр створено одним викликом на відправника — усі три «Передано курʼєру»', JSON.stringify({ після, r1, calls }));
const список = await p.evaluate(async () => {
  document.querySelector('[data-do="reg-list"]').click();
  await new Promise(r => setTimeout(r, 200));
  const t = (document.getElementById('dzRegPop') || {}).textContent || '';
  const x = document.getElementById('dzRegPop'); if(x) x.remove();
  return t.replace(/\s+/g, ' ');
});
ok(/№105-0001/.test(список) && /3 посил/.test(список), 'у «Реєстри» — №105-0001 · 3 посилки, з PDF', список.slice(0, 160));

console.log('═══ 2. СТАРИЙ ВОРКЕР: ОДНУ НАКЛАДНУ НЕ ЗНАЙДЕНО ═══');
const b = await seed(2000311, '2');
await p.evaluate(() => { window.LQDesign.ui.host.npRegistry = async (k, docs) => ({ ref:'R2', number:'105-0002', notFound:['204500000022'], errors:[] }); });
const r2 = await тиснути();
const s2 = await стан(b);
console.log('   ' + JSON.stringify({ s2, r2 }));
ok(s2.join() === 'courier,courier,reg' && /не увійшли й лишились у «Реєстр»: .*не знайшла накладну/.test(r2.toast),
  'ненайдена накладна лишилась у «Реєстр» з причиною, дві інші — «Передано курʼєру»', JSON.stringify({ s2, r2 }));

console.log('═══ 3. НОВИЙ ВОРКЕР: ПРИЙНЯТІ Й ВІДХИЛЕНІ ═══');
const c = await seed(2000321, '3');
await p.evaluate(() => { window.LQDesign.ui.host.npRegistry = async (k, docs) => ({ ref:'R3', number:'105-0003', notFound:[],
  success:[{ Ref:'ref-30', Number:'204500000030' }], errors:[{ Ref:'ref-31', Number:'204500000031', Error:'Документ уже в іншому реєстрі' }] }); });
const r3 = await тиснути();
const s3 = await стан(c);
console.log('   ' + JSON.stringify({ s3, r3 }));
ok(s3.join() === 'courier,reg,reg' && /Документ уже в іншому реєстрі/.test(r3.toast) && /1 посилок/.test(r3.toast),
  'переносимо лише прийняту; відхилену — з причиною Нової пошти, і ту, якої немає в прийнятих', JSON.stringify({ s3, r3 }));

console.log('═══ 4. НОВА ПОШТА ВІДМОВИЛА ЗОВСІМ ═══');
const d = await seed(2000331, '4');
await p.evaluate(() => { window.LQDesign.ui.host.npRegistry = async () => ({ error:'Немає секрета NP_KEY_yuk — ключ API Нової пошти цього відправника' }); });
const r4 = await тиснути();
const s4 = await стан(d);
console.log('   ' + JSON.stringify({ s4, r4 }));
ok(s4.every(x => x === 'reg') && /Реєстр не створено/.test(r4.toast) && /NP_KEY_yuk/.test(r4.toast),
  'відмова Нової пошти — нічого не перенесено, сказано чому', JSON.stringify({ s4, r4 }));

console.log('═══ 5. ЗАПИС У КАРТКУ НЕ ЛІГ — КАРТКА В «РЕЄСТР», СКАЗАНО КОМУ НАТИСНУТИ ═══');
/* 26.10, Володимир: реєстр роздрукований, а картка злетіла з «Передано
   курʼєру» — запис у картку відхилився мовчки. */
const e5 = await seed(2000341, '5');
await p.evaluate(() => { window.LQDesign.ui.host.npRegistry = async () => ({ ref:'R5', number:'105-0005', notFound:[], errors:[] });
  window.__ap0 = window.LQDesign.ui.host.orderApply;
  window.LQDesign.ui.host.orderApply = async (id, fn, okFn) => { if(id === 'r2000342') return false; return window.__ap0(id, fn, okFn); }; });
const r5 = await тиснути();
const s5 = await стан(e5);
await p.evaluate(() => { window.LQDesign.ui.host.orderApply = window.__ap0; });
console.log('   ' + JSON.stringify({ s5, r5 }));
ok(s5.join() === 'courier,reg,courier' && /УВАГА: реєстр №105-0005 створено, але в картки #\d+ не записався/.test(r5.toast) && /Уже в реєстрі/.test(r5.toast),
  'запис однієї картки не ліг — вона лишилась у «Реєстр», сказано натиснути «Уже в реєстрі»; решта — «Передано курʼєру»', JSON.stringify({ s5, r5 }));

console.log('═══ 6. «УЖЕ В РЕЄСТРІ → ПЕРЕДАНО КУРʼЄРУ» ═══');
const r6 = await p.evaluate(async () => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  U.setTab('prod'); U.open('2000342'); U.render(root);
  await new Promise(r => setTimeout(r, 200));
  const b = root.querySelector('.dz-panel:not(.hide) [data-do="reg-manual"]');
  const out = { кнопка: !!b, текст: b ? b.textContent : '' };
  window.__toasts = []; const t0 = U.host.toast; U.host.toast = m => { window.__toasts.push(String(m)); };
  const p0 = window.prompt; window.prompt = () => '105-0005';
  if(b) b.click();
  await new Promise(r => setTimeout(r, 900));
  window.prompt = p0; U.host.toast = t0;
  const pr = U.pairOf('2000342');
  out.стан = window.LQDesign.prodAt(pr.job, pr.o);
  out.reg = pr.o.reg && { no: pr.o.reg.no, manual: pr.o.reg.manual, by: pr.o.reg.by };
  out.вБазі = (() => { try{ return JSON.parse(ordersSaved.get(pr.o.id)).reg.manual; }catch(e){ return false; } })();
  out.toast = window.__toasts.slice(-1)[0] || '';
  out.кнопкаПісля = !!root.querySelector('.dz-panel:not(.hide) [data-do="reg-manual"]');
  U.setTab('acct'); U.open('2000342'); U.render(root); await new Promise(r => setTimeout(r, 200));
  out.історія = U.histHtml(pr.job, pr.o).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  U.setTab('prod'); U.open(''); U.render(root); await new Promise(r => setTimeout(r, 200));
  document.querySelector('[data-do="reg-list"]').click();
  await new Promise(r => setTimeout(r, 200));
  out.список = ((document.getElementById('dzRegPop') || {}).textContent || '').replace(/\s+/g, ' ');
  const x = document.getElementById('dzRegPop'); if(x) x.remove();
  return out;
});
console.log('   ' + JSON.stringify(r6).slice(0, 600));
ok(r6.кнопка && /Уже в реєстрі/.test(r6.текст), 'у картці в «Реєстр» є кнопка «Уже в реєстрі → Передано курʼєру»', JSON.stringify({ к: r6.кнопка, т: r6.текст }));
ok(r6.стан === 'courier' && r6.reg && r6.reg.manual && r6.reg.no === '105-0005' && r6.вБазі && /Передано курʼєру/.test(r6.toast) && !r6.кнопкаПісля,
  'натиснули → «Передано курʼєру», реєстр записано в базу з номером і «вручну»', JSON.stringify({ с: r6.стан, r: r6.reg, б: r6.вБазі, t: r6.toast }));
ok(/вписано вручну/.test(r6.історія || '') && /105-0005/.test(r6.список) && /вписано вручну/.test(r6.список),
  'в історії картки й у списку реєстрів — «вписано вручну»', JSON.stringify({ і: (r6.історія || '').slice(-300), с: r6.список.slice(0, 200) }));

console.log('═══ 7. «ЗЕБРА»: З ПЛИТКИ, З КАРТКИ, НА ВЕСЬ РЕЄСТР (27.10) ═══');
/* Андрій: «по відкритій ТТН прямо на картці — зебра… і скачати PDF зебри
   на реєстр». Посилки з §1 — у «Передано курʼєру», реєстр R1. */
const r7 = await p.evaluate(async (ids) => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  window.__zb = [];
  U.host.npZebra = async (ttns, sender) => { window.__zb.push({ ttns: ttns.slice(), sender }); return true; };
  U.setTab('prod'); U.open(''); U.render(root);
  await new Promise(r => setTimeout(r, 200));
  const tile = root.querySelector('.dz-boards [data-open="' + ids[0] + '"]');
  const btn = tile && tile.querySelector('[data-do="zebra"]');
  const o = orders.find(x => x.orderId === ids[0]);
  const out = { плитка: !!btn, ttnНаПлитці: btn ? btn.dataset.ttn : '', ttn: o.ttn, sender: btn ? btn.dataset.sender : '', відкрито: '' };
  if(btn){ btn.click(); await new Promise(r => setTimeout(r, 150)); }
  out.відкрито = U.tabOpen ? U.tabOpen() : '';                          // клік по зебрі картку не відкриває
  out.зПлитки = window.__zb.slice();
  /* У картці — кнопка в блоці відправки. */
  U.open(ids[0]); U.render(root);
  await new Promise(r => setTimeout(r, 200));
  const inCard = root.querySelector('.dz-panel [data-ship-zebra], .dz-panel .dz-ttn [data-do="zebra"]');
  out.уКартці = !!inCard;
  window.__zb = [];
  if(inCard){ inCard.click(); await new Promise(r => setTimeout(r, 150)); }
  out.зКартки = window.__zb.slice();
  /* Список реєстрів — «PDF зебри» на всі накладні реєстру. */
  U.open(''); U.render(root);
  document.querySelector('[data-do="reg-list"]').click();
  await new Promise(r => setTimeout(r, 200));
  const pop = document.getElementById('dzRegPop');
  const rz = pop && pop.querySelector('[data-do="reg-zebra"][data-ref="R1"]');
  out.уРеєстрі = !!rz;
  window.__zb = [];
  if(rz){ rz.click(); await new Promise(r => setTimeout(r, 150)); }
  out.зРеєстру = window.__zb.slice();
  if(pop) pop.remove();
  return out;
}, a);
console.log('   ' + JSON.stringify(r7));
ok(r7.плитка && r7.ttnНаПлитці === r7.ttn && r7.sender === 'yuk' && r7.зПлитки.length === 1 && r7.зПлитки[0].ttns.join() === r7.ttn && r7.зПлитки[0].sender === 'yuk' && !r7.відкрито,
  'на плитці в «Передано курʼєру» є «Зебра»: один клік — PDF цієї ТТН ключем її відправника, картка не відкривається', JSON.stringify(r7));
ok(r7.уКартці && r7.зКартки.length === 1 && r7.зКартки[0].ttns.join() === r7.ttn, 'у картці в блоці відправки — така сама кнопка', JSON.stringify({ к: r7.уКартці, з: r7.зКартки }));
ok(r7.уРеєстрі && r7.зРеєстру.length === 1 && r7.зРеєстру[0].ttns.length === 3 && r7.зРеєстру[0].sender === 'yuk', 'у списку реєстрів — «PDF зебри» на всі 3 накладні реєстру', JSON.stringify(r7.зРеєстру));
/* 7б. PDF відкривається в НОВІЙ ВКЛАДЦІ одразу з кліку (Андрій: «щоб одразу
   друкувати»), а не скачується; воркер відповів не PDF — вкладка закривається. */
await p.route('https://np.test/**', r => {
  let b = {}; try{ b = JSON.parse(r.request().postData() || '{}'); }catch(e){}
  if(b.op === 'markingPdf' && (b.ttns || []).length) return r.fulfill({ contentType:'application/pdf', body: Buffer.from('%PDF-1.4 zebra ' + b.ttns.join(',')) });
  return r.fulfill({ status: 400, contentType:'application/json', body: JSON.stringify({ ok:false, error:'Немає номера накладної' }) });
});
const r7b = await p.evaluate(async (ids) => {
  const U = window.LQDesign.ui;
  U.host.npZebra = (ttns, sender) => npZebra(ttns, sender);
  contentData.bgApi = Object.assign({}, contentData.bgApi || {}, { npUrl: 'https://np.test/' });
  fbAuth.currentUser = Object.assign({}, fbAuth.currentUser || {}, { getIdToken: async () => 'tok' });   // лишаємо пошту — роль власника далі потрібна
  window.__tabs = []; const open0 = window.open;
  window.open = (u, t) => { const w = { closed:false, document:{ title:'' }, location:{ href:'' }, close(){ this.closed = true; } }; window.__tabs.push({ u, t, w }); return w; };
  const o = orders.find(x => x.orderId === ids[0]);
  const r1 = await npZebra([o.ttn], 'yuk');
  await new Promise(r => setTimeout(r, 50));
  const r2 = await npZebra(['1'], 'yuk');                                   // короткий номер — воркер відмовить
  window.open = open0;
  return { r1, r2, tabs: window.__tabs.map(x => ({ t: x.t, href: String(x.w.location.href).slice(0, 5), closed: x.w.closed })) };
}, a);
console.log('   ' + JSON.stringify(r7b));
ok(r7b.r1 === true && r7b.tabs.length === 1 && r7b.tabs[0].t === '_blank' && r7b.tabs[0].href === 'blob:' && !r7b.tabs[0].closed, 'PDF відкрився в новій вкладці (blob:), не скачався', JSON.stringify(r7b));
ok(r7b.r2 !== true && r7b.tabs.length === 1, 'без номера — помилка словами, зайвої вкладки немає', JSON.stringify(r7b));

console.log('═══ 8. НП НЕ ВЗЯЛА В РЕЄСТР: ПРИЧИНА НА ПЛИТЦІ, «ТТН УЖЕ N ДНІ», ОДНЕ ПОВІДОМЛЕННЯ, «ПЕРЕСТВОРИТИ ТТН» (27.10) ═══');
/* Андрій (відео): 15 накладних, «It's forbidden to add to the register: the
   document is older than 3 days and printed» ×15 у повідомленні, що зникає. */
const g8 = await seed(2000331, '4');
await p.evaluate(ids => {
  const давно = new Date(Date.now() - 5 * 864e5).toISOString();
  ids.forEach(id => { const o = orders.find(x => x.orderId === id); o.ttnAt = давно; o.touchedAt = '2026-10-20T10:00:00.000Z';
    o.ship = { name:'Тест Тестовий', phone:'+380501234567', cityRef:'c1', cityName:'Київ', whRef:'w1', whName:'Відділення №1' }; });
  window.LQDesign.ui.host.npRegistry = async (k, docs) => ({ ref:'', number:'', notFound:[],
    errors: docs.map(d => ({ Ref: d.ref, Number: d.ttn, Error:"It's forbidden to add to the register: the document is older than 3 days and printed" })),
    success:[], error:"It's forbidden to add to the register: the document is older than 3 days and printed" });
}, g8);
const nos8 = await p.evaluate(ids => ids.map(id => window.LQDesign.ui.jobNo(window.LQDesign.ui.pairOf(id).job)), g8);   // номери відділу (#…), не ключі
const r8 = await тиснути();
const s8 = await стан(g8);
const t8 = await p.evaluate(ids => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  U.setTab('prod'); U.open(''); U.render(root);
  const w = root.querySelector('.dz-boards [data-open="' + ids[0] + '"]');
  const o = orders.find(x => x.orderId === ids[0]);
  return { regFail: o.regFail && o.regFail.why, ttn: o.regFail && o.regFail.ttn, old: ((w && w.querySelector('.dz-c-ttnold')) || {}).textContent || '',
           why: ((w && w.querySelector('.dz-c-regfail')) || {}).textContent || '' };
}, g8);
console.log('   ' + JSON.stringify({ s8, r8: r8.toast, t8 }));
ok(s8.every(x => x === 'reg') && r8.toast.indexOf('3 посилки — накладній понад 3 дні і вона вже роздрукована: ' + nos8.join(', ')) >= 0 && (r8.toast.match(/понад 3 дні/g) || []).length === 1,
  'усі три лишились у «Реєстр»; повідомлення одне на всіх: «3 посилки — накладній понад 3 дні…: #…»', JSON.stringify({ s8, r8 }));
ok(/older than 3 days/.test(t8.regFail || '') && t8.ttn === '204500000040' && /ТТН уже 5 днів/.test(t8.old) && /НП не взяла в реєстр: накладній понад 3 дні/.test(t8.why),
  'причина записана в картку (o.regFail з ТТН); на плитці «ТТН уже 5 днів» і «НП не взяла в реєстр: …»', JSON.stringify(t8));
/* ↻ Перестворити ТТН — лише в картці, з підтвердженням: нова з тими самими
   даними, стара в історію як замінена, скасування в НП; опис = номер картки. */
const r8b = await p.evaluate(async ids => {
  const U = window.LQDesign.ui, root = document.getElementById('dzRoot');
  window.__NPC = [];
  const u0 = npUrl, c0 = npCall;
  npUrl = () => 'https://np.test';
  npCall = async (op, extra) => { window.__NPC.push({ op, extra });
    if(op === 'create') return { ok:true, ttn:'20450000000999', ref:'ref-999', est:'' };
    if(op === 'ttnDelete') return { ok:true };
    throw new Error('не та операція: ' + op); };
  const out = {};
  try{
    U.setTab('acct'); U.open(ids[0]); U.render(root);
    await new Promise(r => setTimeout(r, 250));
    const tile = root.querySelector('.dz-boards [data-open="' + ids[0] + '"]');
    out.наПлитці = !!(tile && tile.querySelector('[data-ship-ttn-re]'));
    /* Блок «Відправка» складений — розгортаємо, як людина. */
    const fold = root.querySelector('.dz-panel [data-fold="Відправка"]');
    if(fold){ fold.click(); await new Promise(r => setTimeout(r, 250)); }
    const b = root.querySelector('.dz-panel [data-ship-ttn-re]');
    out.кнопка = !!b;
    out.позначки = { old: ((root.querySelector('.dz-panel .dz-ship-l .dz-c-ttnold') || {}).textContent || ''), why: ((root.querySelector('.dz-panel .dz-regfail-s') || {}).textContent || '') };
    if(b){ b.click(); await new Promise(r => setTimeout(r, 900)); }
    const o = orders.find(x => x.orderId === ids[0]);
    const pr = U.pairOf(ids[0]);
    const h = (o.ttnHist || []).slice(-1)[0] || {};
    out.ttn = o.ttn; out.ref = o.ttnRef; out.hist = { ttn: h.ttn, replaced: !!h.replaced, newTtn: h.newTtn, npDel: h.npDel };
    out.стан = window.LQDesign.prodAt(pr.job, o); out.shipCol = o.shipCol; out.regFail = !!o.regFail; out.npSt = !!o.npSt;
    out.ops = window.__NPC.map(c => c.op); out.опис = ((window.__NPC.find(c => c.op === 'create') || {}).extra || {}).order && window.__NPC.find(c => c.op === 'create').extra.order.description;
    out.delRef = ((window.__NPC.find(c => c.op === 'ttnDelete') || {}).extra || {}).ref;
    out.днів = window.LQDesign.ttnDays(o);
  } finally { npUrl = u0; npCall = c0; }
  return out;
}, g8);
console.log('   ' + JSON.stringify(r8b));
ok(!r8b.наПлитці && r8b.кнопка && /ТТН уже 5 днів/.test(r8b.позначки.old) && /накладній понад 3 дні/.test(r8b.позначки.why),
  'кнопки «Перестворити» на плитці немає; у картці біля ТТН — є, поруч «ТТН уже 5 днів» і причина відмови', JSON.stringify({ п: r8b.наПлитці, к: r8b.кнопка, з: r8b.позначки }));
ok(r8b.ttn === '20450000000999' && r8b.ref === 'ref-999' && r8b.hist.ttn === '204500000040' && r8b.hist.replaced && r8b.hist.newTtn === '20450000000999' && r8b.hist.npDel === true,
  'нова накладна стала головною; стара — в історії як замінена, скасована в НП', JSON.stringify({ t: r8b.ttn, h: r8b.hist }));
ok(r8b.ops.join() === 'create,ttnDelete' && r8b.опис === nos8[0] && r8b.delRef === 'ref-40',
  'воркеру: create з описом «' + nos8[0] + '» (номер картки, не ключ), потім ttnDelete старої за її Ref', JSON.stringify({ ops: r8b.ops, о: r8b.опис, d: r8b.delRef }));
ok(r8b.стан === 'reg' && r8b.shipCol === 'reg' && !r8b.regFail && !r8b.npSt && r8b.днів === 0,
  'картка лишилась у «Реєстр»; причина відмови й статус старої накладної зняті; накладній 0 днів', JSON.stringify({ с: r8b.стан, sc: r8b.shipCol, rf: r8b.regFail, np: r8b.npSt, д: r8b.днів }));

console.log('═══ 9. ЗВЕДЕННЯ ПО НАКЛАДНИХ У ФІНАНСАХ (27.10) ═══');
/* Андрій: «по цим ТТН — де наложені платежі є, де немає, яка сума». */
const r9 = await p.evaluate(ids => {
  const o = orders.find(x => x.orderId === ids[1]);
  o.ttnCod = 1500; o.ttnPayer = 'recipient'; o.reg = { ref:'R9', no:'105-0009', at: new Date().toISOString() };
  payLoaded = true; payments = [{ id:'np1', src:'np', ttn: o.ttn, amount: 1500, at:'2026-10-26T10:00:00.000Z', orderId: o.orderId, tag:'cod', acc:'np' }];
  const o0 = orders.find(x => x.orderId === ids[0]);
  const rows = ttnSumRows([o.ttn, o0.ttn, '204500000040', '20459999999999'].join('\n'));
  tsum.rows = rows; tsum.text = 'x';
  document.getElementById('view-fin') && (document.getElementById('view-fin').style.display = 'block');
  renderTtnSum();
  const box = document.getElementById('fin-ttnsum');
  return { n: rows.length, r0: { no: rows[0].no, cod: rows[0].cod, got: rows[0].прийшло, reg: rows[0].reg, payer: rows[0].payer },
           r1: { no: rows[1].no, cod: rows[1].cod, got: rows[1].прийшло, regFail: rows[1].regFail },
           r2: { no: rows[2].no, замінена: rows[2].замінена, новаТтн: rows[2].новаТтн }, r3: { картки: !!rows[3].o },
           html: box ? box.textContent.replace(/\s+/g, ' ').slice(0, 400) : '', hidden: box ? box.hidden : null };
}, g8);
console.log('   ' + JSON.stringify(r9));
ok(r9.n === 4 && '#' + r9.r0.no === nos8[1] && r9.r0.cod === 1500 && r9.r0.got === 1500 && r9.r0.reg === '105-0009' && r9.r0.payer === 'recipient',
  'рядок накладної: картка, реєстр, контроль оплати 1 500 ₴, прийшло 1 500 ₴ (з руху Фінансів за цією ТТН)', JSON.stringify(r9.r0));
ok('#' + r9.r1.no === nos8[0] && r9.r1.got === 0 && !r9.r1.regFail && '#' + r9.r2.no === nos8[0] && r9.r2.замінена && r9.r2.новаТтн === '20450000000999' && !r9.r3.картки,
  'нова накладна без грошей; стара знайдена через історію як замінена; чужий номер — «картки немає»', JSON.stringify({ r1: r9.r1, r2: r9.r2, r3: r9.r3 }));
ok(r9.hidden === false && /Зведення по накладних/.test(r9.html) && /Накладних: 4/.test(r9.html) && /1 500 ₴/.test(r9.html),
  'блок у Фінансах: заголовок, підсумок «Накладних: 4», суми', r9.html.slice(0, 200));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'реєстр: створюється, у «Передано курʼєру» — лише прийняте Новою поштою; зебра з плитки, картки й реєстру');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
