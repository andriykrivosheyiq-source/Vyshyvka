/* ДРУК (DTF) У B2C (21.10).

   Андрій: «друк: графічний дизайн → DTF-дизайнер (нова роль) → закупка
   окремим блоком → окреме виробництво «Друк» (друкується → готово). Ціни
   друку — порожні поля, заповню сам».

   Запуск:  node tests/dtf.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8949;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
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




const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui;
  /* Два замовлення: 2000301 — друк, 2000302 — вишивка. */
  window.__j = designJobMake('2000301');
  __j.units = [Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1, note:'Лого на грудях', artKind:'k', artKindName:'Складний' })];
  window.__j2 = designJobMake('2000302');
  __j2.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Біла', size:'L', qty:1, note:'Сова', artKind:'k', artKindName:'Складний' })];
  window.__o = orders.find(x => x.orderId === '2000301'); window.__o2 = orders.find(x => x.orderId === '2000302');
  openDesign();
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await ЖДИ(500);

console.log('═══ 1. НАНЕСЕННЯ НА ПОЗИЦІЇ: ВИШИВКА / ДРУК ═══');
const t1 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  document.querySelector('#dzRoot [data-open="2000301"]').click();
  await new Promise(r => setTimeout(r, 400));
  const sel = document.querySelector('.dz-panel [data-uf$="|tech"]');
  if(!sel) return { err: 'немає вибору нанесення' };
  const opts = [...sel.options].map(o => o.textContent);
  sel.value = 'dtf'; sel.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 400));
  const u = __j.units[0];
  const rows = U.sumRows(__j);
  return { opts, tech: u.tech, techOf: D.techOf(u), jobTech: D.jobTech(__j), role: D.stitchRole(u),
           design: rows[0].design, price: rows[0].price, fb: rows[0].fallbackDtf,
           dzRow: (rows.filter(r => r.dzCost === 'stitch')[0] || {}).name,
           colName: (document.querySelector('.dz-panel .dz-u-col.is-none + * , .dz-panel [title*="Файл для друку"]') ? 1 : 0) };
});
console.log('   ' + JSON.stringify(t1));
ok(!t1.err && t1.opts.join() === 'Вишивка,Друк (DTF)' && t1.tech === 'dtf' && t1.jobTech === 'dtf' && t1.role === 'dtf',
  'вибір «Нанесення: Вишивка / Друк (DTF)» на позиції — обрали друк, другий етап веде роль DTF-дизайнера', JSON.stringify(t1));
ok(/друк/.test(t1.design) && t1.price === 1200 && t1.fb && /друку/.test(t1.dzRow),
  'ціни друку не вписано — взято ціну вишивки (1 200) з поясненням; рядок собівартості «файл для друку (DTF)»', JSON.stringify(t1));
const t1b = await p.evaluate(() => {
  contentData.products.retailDtf = { hoodie: 900 }; contentData.products.retailCostDtf = { hoodie: 400 };
  const r = window.LQDesign.ui.sumRows(__j)[0];
  return { price: r.price, cost: r.cost, fb: r.fallbackDtf };
});
ok(t1b.price === 900 && t1b.cost === 400 && !t1b.fb, 'вписали ціну друку — беруться ціна й собівартість друку (900 / 400)', JSON.stringify(t1b));

console.log('');
console.log('═══ 2. ФІКСАЦІЯ → ЧЕРГА ДРУКУ, ДОШКА DTF-ДИЗАЙНЕРА ═══');
const t2 = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const готує = (job) => { const u = job.units[0];
    const g = D.dzNew(); g.who = 'p@loomiq'; g.sentAt = new Date().toISOString(); g.status = 'review';
    g.vers.push({ n: 1, at: new Date().toISOString(), files: [{ url: 'https://x/v1.png', name: 'v1.png' }] });
    D.dzList(u, 'graphic').push(g); D.dzOk(g, 'test@loomiq', 'client', 1); D.clothConfirm(u, 'test@loomiq'); };
  готує(__j); готує(__j2);
  D.dzAutoStitch(__j, 'test@loomiq'); D.dzAutoStitch(__j2, 'test@loomiq');
  const s1 = D.dzList(__j.units[0], 'stitch')[0], s2 = D.dzList(__j2.units[0], 'stitch')[0];
  const cards = seat => { U.setTab(seat); U.render(document.getElementById('dzRoot'));
    return [...document.querySelectorAll('#dzRoot .dz-card')].map(c => c.dataset.open); };
  const dtf = cards('dtf'), stitch = cards('stitch');
  U.setTab('dtf'); U.open('2000301'); U.render(document.getElementById('dzRoot'));
  const chip = !!document.querySelector('#dzRoot [data-open="2000301"] .dz-c-tech');
  /* Акаунт обирає DTF-дизайнера у своїй картці, на боці другого етапу. */
  U.setTab('acct'); U.open('2000301'); U.SIDE[__j.units[0].id] = 'stitch'; U.SIDE_AT[__j.units[0].id] = Date.now() + 1e6; U.render(document.getElementById('dzRoot'));
  const who = [...document.querySelectorAll('.dz-panel [data-dzwho] option, .dz-panel [data-dzadd] option')].map(o => o.textContent);
  const colName = [...document.querySelectorAll('.dz-panel .dz-u-col')].map(x => x.textContent.slice(0, 40)).join('|');
  U.setTab('acct'); U.open(''); U.render(document.getElementById('dzRoot'));
  const tile = document.querySelector('#dzRoot [data-open="2000301"]');
  const tile2 = document.querySelector('#dzRoot [data-open="2000302"]');
  return { q1: D.dzInQueue(s1), q2: D.dzInQueue(s2), need2: D.dzUnassigned(s2), txt1: s1.thread[s1.thread.length - 1].text, txt2: s2.thread[s2.thread.length - 1].text,
           dtf, stitch, who, chip, colName, acctChip: !!(tile && tile.querySelector('.dz-c-tech')), acctChip2: !!(tile2 && tile2.querySelector('.dz-c-tech')),
           steps: tile ? tile.textContent.includes('Файл DTF') || tile.textContent.includes('Друк') : false };
});
console.log('   ' + JSON.stringify(t2));
const D_q2 = t2.q2 || !t2.need2;
ok(t2.q1 && /чергу друку/.test(t2.txt1) && /призначте вишивального/.test(t2.txt2) && !D_q2, 'після фіксації друк стає «в чергу друку (DTF)», вишивка — без черги, «призначте вишивального дизайнера» (29.10)', JSON.stringify(t2));
ok(t2.dtf.join() === '2000301' && t2.stitch.join() === '', 'дошка DTF-дизайнера бачить лише друк; вишивку без призначення вишивальна не бачить (29.10)', JSON.stringify({ dtf: t2.dtf, stitch: t2.stitch }));
ok(t2.who.some(x => /Данило/.test(x)) && !t2.who.some(x => /Віра/.test(x)), 'дизайнера для друку обирають серед DTF-дизайнерів (Данило), не вишивальних', JSON.stringify(t2.who));
ok(t2.chip && t2.acctChip && !t2.acctChip2, 'мітка «DTF» на плитці друку (у DTF-дизайнера й в акаунта), на вишивці її немає', JSON.stringify(t2));

console.log('');
console.log('═══ 3. ВИРОБНИЦТВО «ДРУК»: ДРУКУЄТЬСЯ → ГОТОВО ═══');
const t3 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  /* DTF-дизайнер здав файл, одяг є — у цех: трек виробництва «в роботі». */
  [__o, __o2].forEach(o => { o.tracks = Object.assign({}, o.tracks || {}, { prod: 'work' }); });
  const cards = seat => { U.setTab(seat); U.render(document.getElementById('dzRoot'));
    return [...document.querySelectorAll('#dzRoot .dz-card')].map(c => c.dataset.open + ':' + c.closest('.dz-col, [data-col]')?.dataset.col); };
  const print = cards('print'), prod = cards('prod');
  const cols = [...document.querySelectorAll('#dzRoot .dz-col-h, #dzRoot .dz-colh, #dzRoot .dz-col > h3, #dzRoot .dz-col-t')].map(x => x.textContent.trim());
  U.setTab('print'); U.render(document.getElementById('dzRoot'));
  const pcols = [...document.querySelectorAll('#dzRoot .dz-col-h, #dzRoot .dz-colh, #dzRoot .dz-col > h3, #dzRoot .dz-col-t')].map(x => x.textContent.replace(/\d+$/, '').trim());
  U.open('2000301'); U.render(document.getElementById('dzRoot'));
  const btn = document.querySelector('.dz-panel [data-do="prod-print-done"]');
  const photoBtn = !!document.querySelector('.dz-panel [data-do="prod-done"]');
  const before = D.prodAt(__j, __o);
  if(btn) btn.click();
  await new Promise(r => setTimeout(r, 500));
  return { print, prod, pcols, btn: !!btn, photoBtn, before, after: D.prodAt(__j, __o), chain: D.chainAt(__j, __o), qc: (__o.tracks || {}).qc };
});
console.log('   ' + JSON.stringify(t3));
ok(t3.print.length === 1 && /2000301/.test(t3.print[0]) && t3.prod.length === 1 && /2000302/.test(t3.prod[0]),
  'дошка «Друк» бачить лише друк, «Виробництво» — лише вишивку', JSON.stringify({ print: t3.print, prod: t3.prod }));
ok(t3.pcols.some(x => /Друкується/.test(x)) && !t3.pcols.some(x => /погодження/i.test(x)), 'колонки друку: «Друкується», без «Чекає погодження»', JSON.stringify(t3.pcols));
ok(t3.btn && !t3.photoBtn && t3.before === 'run' && t3.after === 'ship' && t3.qc === 'ok',
  '«✓ Надруковано — готово» без фото й погодження → «Можна відправляти»', JSON.stringify(t3));

console.log('');
console.log('═══ 4. ЗАКУПКА: ВИШИВКА Й ДРУК ОКРЕМИМИ БЛОКАМИ ═══');
const t4 = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  [__o, __o2].forEach(o => { o.tracks = {}; });
  U.setTab('supply'); U.render(document.getElementById('dzRoot'));
  const h = [...document.querySelectorAll('#dzRoot .dz-buy-techh')].map(x => x.textContent.trim());
  const blocks = [...document.querySelectorAll('#dzRoot .dz-buy-tech')].map(b => ({ h: b.querySelector('.dz-buy-techh').textContent.trim(), txt: b.textContent }));
  return { h, виш: (blocks[0] || {}).txt || '', друк: (blocks[1] || {}).txt || '' };
});
console.log('   ' + JSON.stringify(t4.h));
ok(t4.h.length === 2 && /Вишивка/.test(t4.h[0]) && /Друк/.test(t4.h[1]) && /Футболка/.test(t4.виш) && /Худі/.test(t4.друк) && !/Худі/.test(t4.виш),
  '«Треба замовити»: блок «Вишивка» (футболка) і блок «Друк (DTF)» (худі)', JSON.stringify(t4));

console.log('');
console.log('═══ 5. НАЛАШТУВАННЯ: РОЛІ, СТАВКИ, ЦІНИ ДРУКУ ═══');
const t5 = await p.evaluate(() => {
  const roles = roleDefs().map(r => r.key);
  paintB2cPrices();
  const box = document.getElementById('b2c-prices');
  paintDzRates();
  return { dtf: roles.indexOf('dtf') >= 0, print: roles.indexOf('print') >= 0, names: [ROLES.dtf, ROLES.print],
           dprice: !!(box && box.querySelector('[data-b2c-dprice]')), dcost: !!(box && box.querySelector('[data-b2c-dcost]')),
           head: /друк \(DTF\)/.test((document.querySelector('.b2c-pt-head') || {}).textContent || ''),
           rates: /DTF-дизайнери/.test((document.getElementById('dz-rates') || document.querySelector('[id*="rates"]') || document.body).textContent),
           seat: window.LQDesign.ui.roleSeat('dtf') + '/' + window.LQDesign.ui.roleSeat('print') };
});
console.log('   ' + JSON.stringify(t5));
ok(t5.dtf && t5.print && t5.names.join() === 'DTF-дизайнер,Друк', 'ролі «DTF-дизайнер» і «Друк» є в команді', JSON.stringify(t5));
ok(t5.dprice && t5.dcost && t5.head, 'Ціни виробів: порожні колонки «друк (DTF)» — ціна й собівартість', JSON.stringify(t5));
ok(t5.rates && t5.seat === 'dtf/print', 'ставки: рядок «DTF-дизайнери»; крісла ролей — дошки «DTF-дизайнер» і «Друк»', JSON.stringify(t5));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'друк: графіка → DTF-дизайнер → закупка окремо → «Друк»: друкується → готово');
process.exit(bad ? 1 : 0);
