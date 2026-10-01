/* КОМАНДА У ФІНАНСАХ: ЩО ЗРОБИВ КОЖЕН І СКІЛЬКИ ЙОМУ НАРАХОВАНО.

   Андрій: «аналітика для кожної ролі… розрахунок зп зі ставкою». Домовились:
     · бонус — фіксована сума за одиницю роботи: менеджеру за замовлення,
       графічному — за погоджений дизайн, вишивальному — за оцифровку,
       цеху — за виріб; закупівля — лише ставка;
     · ставка — за місяць або за відпрацьований день;
     · бонус іде в місяць, коли роботу ЗРОБЛЕНО;
     · кожен бачить свій розрахунок і може звірити;
     · кнопка «Виплачено» пише витрату у Фінанси;
     · усе це — вкладка «Команда» у Фінансах.

   Тут заводимо команду й місяць роботи і перевіряємо кожне число: що
   зараховано, кому, за який місяць, і що не зараховано нікому зайвого.

   Запуск:  node tests/team-pay.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8975;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

/* Команда: «я» (test@loomiq) — графічний дизайнер, щоб перевірити й
   «Мій розрахунок». */
const CONTENT = { team: [
  { email:'mgr@loomiq',  name:'Оля',   role:'designmgr' },
  { email:'test@loomiq', name:'Іра',   role:'designer' },
  { email:'emb@loomiq',  name:'Петро', role:'embroidery' },
  { email:'prod@loomiq', name:'Цех',   role:'production' },
  { email:'buy@loomiq',  name:'Зоя',   role:'supply' }] };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
/* Документи знають, хто вони: так видно, що саме записали у Фінанси й у
   постійні витрати, і що саме стерли. */
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
  "Doc.prototype.set=function(v){ (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)) }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.delete=function(){ return Promise.resolve(); };",
  "Doc.prototype.delete=function(){ (window.__DELS=window.__DELS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var s=(window.__SETS||[]).filter(function(x){ return x.col===this.__col && x.id===this.__id; }, this).pop();" +
  " return Promise.resolve(new Snap(this.__id||'x', s ? s.v : null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace("return Promise.resolve({ id:'stub' });",
  "return Promise.resolve({ id:'pay' + (window.__ADDED.length) });");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
/* prompt «скільки виплачено» — приймаємо запропоноване число; confirm — так. */
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

/* ── Місяць роботи ── */
const M = await p.evaluate(() => {
  const now = new Date().toISOString();
  const ago = new Date(); ago.setMonth(ago.getMonth() - 1, 10);
  const before = ago.toISOString();
  const b2c = (id, extra) => Object.assign({ id: 'o' + id, orderId: id, dir:'b2c', status:'b2c-new', createdAt: now,
    totalPrice: 1500, items: [], hist: [] }, extra);
  orders.length = 0;
  orders.push(
    b2c('5000001', { mgrEmail:'mgr@loomiq', trackHist:[{ t:'prod', s:'done', at: now, by:'prod@loomiq' }] }),
    /* Старе B2C без відповідального: менеджер — той, хто передав дизайн. */
    b2c('5000002', {}),
    b2c('5000003', { mgrEmail:'mgr@loomiq', status:'cancel' }),                 // відмова — не рахуємо
    b2c('5000004', { mgrEmail:'mgr@loomiq', createdAt: before }),               // минулий місяць
    { id:'b1', orderId:'1000001', status:'paid', createdAt: now, mgrEmail:'mgr@loomiq',
      totalPrice: 10000, totalCost: 6000, items:[{ name:'Футболка', qty: 20, price: 10000, cost: 6000 }],
      trackHist:[{ t:'prod', s:'work', at: now, by:'prod@loomiq' }, { t:'prod', s:'done', at: now, by:'prod@loomiq' },
                 { t:'prod', s:'work', at: now, by:'prod@loomiq' }, { t:'prod', s:'done', at: now, by:'prod@loomiq' }] },
    { id:'b2', orderId:'1000002', status:'lead', createdAt: now, mgrEmail:'mgr@loomiq', totalPrice: 5000, items:[] });
  /* Дизайн 5000001: дві версії, погоджена друга; оцифровка здана. */
  designJobs['5000001'] = { orderId:'5000001', units:[{ id:'u1', qty: 3,
    graphic:[{ id:'g1', who:'test@loomiq', takenAt: now, sentAt: now, attachedBy:'mgr@loomiq', attachedAt: now,
      vers:[{ n:1, at: now, by:'test@loomiq', files:[] }, { n:2, at: now, by:'test@loomiq', files:[] }],
      ok:{ ver: 2, how:'client', at: now } }],
    stitch:[{ id:'s1', who:'emb@loomiq', sentAt: now, takenAt: now,
      vers:[{ n:1, at: now, by:'emb@loomiq', files:[{ role:'machine' }] }], ok:{ ver: 1, how:'auto', at: now } }] }] };
  designJobs['5000002'] = { orderId:'5000002', units:[{ id:'u2', qty: 1,
    graphic:[{ id:'g2', who:'test@loomiq', attachedBy:'mgr@loomiq', attachedAt: now, sentBy:'mgr@loomiq', sentAt: now,
      vers:[{ n:1, at: now, by:'test@loomiq', files:[] }] }] }] };       // ще не погоджено
  /* Дизайн, погоджений минулого місяця, — не в цей. */
  designJobs['5000004'] = { orderId:'5000004', units:[{ id:'u4', qty: 1,
    graphic:[{ id:'g4', who:'test@loomiq', vers:[{ n:1, at: before, by:'test@loomiq' }], ok:{ ver:1, how:'client', at: before } }] }] };
  designBuys['buy1'] = { id:'buy1', kind:'buy', n:1, by:'buy@loomiq', at: now, rows:[], status:'sent' };
  contentData.team = window.__CONTENT.team;
  return finMonths(12)[0];
});

console.log('\n═══ ХТО ЩО ЗРОБИВ ЗА МІСЯЦЬ ═══');
const W = await p.evaluate(m => {
  const W = teamWork(m);
  const s = e => { const w = W[e] || {}; return { order:(w.order || []).map(o => o.id).sort(), leads: w.leads || 0,
    design:(w.design || []).map(d => d.id), revisions:(w.design || []).map(d => d.revisions), vers: w.vers || 0,
    stitch:(w.stitch || []).map(d => d.id), piece:(w.piece || []).map(q => q.id + ':' + q.qty).sort(), buys: w.buys || 0 }; };
  return { mgr: s('mgr@loomiq'), des: s('test@loomiq'), emb: s('emb@loomiq'), prod: s('prod@loomiq'), buy: s('buy@loomiq') };
}, M);
console.log('  ' + JSON.stringify(W));
ok(JSON.stringify(W.mgr.order) === JSON.stringify(['1000001', '5000001', '5000002']),
  'менеджеру — три зроблені замовлення: B2B «Оплачено», нове B2C і старе B2C (за тим, хто передав дизайн)',
  'замовлення менеджера: ' + JSON.stringify(W.mgr.order));
ok(W.mgr.leads === 5, 'звернення без оплати й відмова в бонус не йдуть, але в конверсії видно (5 звернень)', 'звернень: ' + W.mgr.leads);
ok(W.des.design.length === 1 && W.des.design[0] === '5000001' && W.des.revisions[0] === 1 && W.des.vers === 3,
  'графічному — один погоджений дизайн (одна правка); непогоджений і минуломісячний не зараховано',
  'дизайни: ' + JSON.stringify(W.des));
ok(JSON.stringify(W.emb.stitch) === '["5000001"]', 'вишивальному — одна здана оцифровка', 'оцифровки: ' + JSON.stringify(W.emb.stitch));
ok(JSON.stringify(W.prod.piece) === JSON.stringify(['1000001:20', '5000001:3']),
  'цеху — вироби: 20 шт B2B і 3 шт B2C; повторне «Готово» не подвоює', 'вироби: ' + JSON.stringify(W.prod.piece));
ok(W.buy.buys === 1, 'закупівлі — одна закупівля', 'закупівлі: ' + W.buy.buys);

console.log('\n═══ ВКЛАДКА «КОМАНДА» У ФІНАНСАХ ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-fin').style.display = 'block';
  finAn.tab = 'team'; renderFin();
});
await p.waitForTimeout(200);
const вкладка = await p.evaluate(() => ({
  кнопка: !!document.querySelector('[data-fin-tab="team"]'),
  видно: !document.getElementById('fin-pane-team').hidden,
  людей: document.querySelectorAll('#fin-team .tm-r').length }));
ok(вкладка.кнопка && вкладка.видно && вкладка.людей === 5, 'у Фінансах є вкладка «Команда» — пʼятеро людей', 'вкладка: ' + JSON.stringify(вкладка));

/* Ставки й бонуси — у таблиці ролей, як їх і вписуватиме власник. */
const вписати = async (sel, v) => { await p.evaluate(({ sel, v }) => { const el = document.querySelector(sel);
  el.value = v; el.dispatchEvent(new Event('change', { bubbles:true })); }, { sel, v }); await p.waitForTimeout(80); };
await p.evaluate(() => { document.querySelector('#fin-team .tm-rates').open = true; });
await вписати('[data-tm-role="designmgr"][data-tm-r="base"]', '10000');
await вписати('[data-tm-role="designmgr"][data-tm-r="order"]', '150');
await вписати('[data-tm-role="designer"][data-tm-r="base"]', '800');
await вписати('[data-tm-role="designer"][data-tm-r="mode"]', 'day');
await вписати('[data-tm-role="designer"][data-tm-r="design"]', '400');
await вписати('[data-tm-role="embroidery"][data-tm-r="stitch"]', '250');
await вписати('[data-tm-role="production"][data-tm-r="piece"]', '12');
await вписати('[data-tm-role="supply"][data-tm-r="base"]', '9000');
const рядки = () => p.evaluate(m => {
  const W = teamWork(m);
  const o = {};
  payPeople(m, W).forEach(x => { const r = payRow(x, m, W); o[x.email] = { base: r.base, bonus: r.bonus, adj: r.adj, total: r.total, days: r.days }; });
  return o;
}, M);
let R = await рядки();
const днів = await p.evaluate(m => payWorkDays('test@loomiq', m), M);
console.log('  ' + JSON.stringify(R));
ok(R['mgr@loomiq'].total === 10450, 'акаунт-менеджер: 10 000 ставка + 3 × 150 = 10 450', 'менеджер: ' + JSON.stringify(R['mgr@loomiq']));
ok(R['test@loomiq'].base === 800 * днів && R['test@loomiq'].bonus === 400,
  'дизайнер за днями: 800 × ' + днів + ' робочих днів + 400 за дизайн', 'дизайнер: ' + JSON.stringify(R['test@loomiq']));
ok(R['emb@loomiq'].total === 250 && R['prod@loomiq'].total === 23 * 12 && R['buy@loomiq'].total === 9000,
  'вишивальний 250; цех 23 шт × 12 = 276; закупівля — лише ставка 9 000', 'інші: ' + JSON.stringify(R));
ok(await p.evaluate(() => (contentData.payroll.roles.designmgr || {}).order === 150),
  'ставки збережено в налаштуваннях', 'ставки не збереглись');

/* Розгорнули людину: аналітика, розшифровка, поля місяця. */
await p.evaluate(() => document.querySelector('#fin-team [data-tm-open="test@loomiq"]').click());
await p.waitForTimeout(100);
await вписати('[data-tm-days="test@loomiq"]', '10');
await p.evaluate(() => document.querySelector('#fin-team [data-tm-open="prod@loomiq"]').click());
await p.waitForTimeout(100);
await вписати('[data-tm-adj="prod@loomiq"]', '500');
await вписати('[data-tm-adjnote="prod@loomiq"]', 'терміновий тираж');
/* Особисті умови: менеджерці — 200 за замовлення замість 150 ролі. */
await p.evaluate(() => document.querySelector('#fin-team [data-tm-open="mgr@loomiq"]').click());
await p.waitForTimeout(100);
await вписати('[data-tm-p="order"][data-tm-e="mgr@loomiq"]', '200');
R = await рядки();
const деталь = await p.evaluate(() => (document.querySelector('#fin-team .tm-d') || {}).textContent || '');
ok(R['test@loomiq'].total === 8400, 'відпрацьовано 10 днів — 8 000 + 400 = 8 400', 'дизайнер: ' + JSON.stringify(R['test@loomiq']));
ok(R['prod@loomiq'].total === 776, 'коригування +500 — цех 776', 'цех: ' + JSON.stringify(R['prod@loomiq']));
ok(R['mgr@loomiq'].total === 10600, 'особисті умови сильніші за роль: 10 000 + 3 × 200 = 10 600', 'менеджер: ' + JSON.stringify(R['mgr@loomiq']));
ok(/Замовлень3 з 5 звернень/.test(деталь) && /Конверсія60%/.test(деталь) && /#1000001/.test(деталь) && /#5000002/.test(деталь),
  'у розгорнутому рядку — аналітика (3 з 5, конверсія 60%) і номери замовлень, з яких склався бонус',
  'деталь: ' + деталь.slice(0, 300));

console.log('\n═══ «ВИПЛАЧЕНО» ═══');
await p.evaluate(() => { window.__ADDED = []; window.__SETS = []; window.__DELS = []; });
await p.evaluate(() => document.querySelector('#fin-team [data-tm-paid="mgr@loomiq"]').click());
await p.waitForTimeout(400);
const виплата = await p.evaluate(m => ({
  витрата: (window.__ADDED || []).filter(x => x.src === 'salary').map(x => ({ amount: x.amount, desc: x.desc, counter: x.counter })),
  paid: ((contentData.payroll.months[m] || {})['mgr@loomiq'] || {}).paid,
  постійні: (window.__SETS || []).filter(x => x.col === 'loomiq' && x.id === 'fixedcosts').map(x => x.v.months[m]).pop(),
  рядок: (document.querySelector('#fin-team [data-tm-open="mgr@loomiq"] .tm-act') || {}).textContent }), M);
console.log('  ' + JSON.stringify(виплата));
ok(виплата.витрата.length === 1 && виплата.витрата[0].amount === -10600 && /^Зарплата · /.test(виплата.витрата[0].desc) && виплата.витрата[0].counter === 'Оля',
  'у Фінанси записано витрату −10 600 «Зарплата · місяць» на Олю', 'витрата: ' + JSON.stringify(виплата.витрата));
ok(виплата.paid && виплата.paid.sum === 10600 && /10\s?600/.test(виплата.рядок || ''),
  'у рядку — «✓ 10 600», виплату запамʼятовано', 'виплата: ' + JSON.stringify(виплата));
ok(виплата.постійні && виплата.постійні.salary === 10600 && виплата.постійні.salaryAuto,
  '«Зарплати» в постійних витратах аналітики — сумою виплаченого', 'постійні: ' + JSON.stringify(виплата.постійні));
await p.evaluate(() => document.querySelector('#fin-team [data-tm-unpaid="mgr@loomiq"]').click());
await p.waitForTimeout(400);
const скасовано = await p.evaluate(m => ({
  стерто: (window.__DELS || []).filter(x => x.col === 'payments').map(x => x.id),
  paid: ((contentData.payroll.months[m] || {})['mgr@loomiq'] || {}).paid,
  постійні: (window.__SETS || []).filter(x => x.col === 'loomiq' && x.id === 'fixedcosts').map(x => x.v.months[m]).pop() }), M);
ok(скасовано.стерто.length === 1 && !скасовано.paid && скасовано.постійні && !скасовано.постійні.salary,
  '↺ скасовує виплату: витрату стерто, «Зарплати» прибрано', 'скасування: ' + JSON.stringify(скасовано));

console.log('\n═══ МІЙ РОЗРАХУНОК — У КОЖНОГО ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-today').style.display = 'block';
  renderToday();
  document.querySelector('#td-pay details').open = true;
});
await p.waitForTimeout(150);
const мій = await p.evaluate(() => (document.querySelector('#td-pay') || {}).textContent || '');
console.log('  ' + мій.replace(/\s+/g, ' ').slice(0, 260));
ok(/Мій розрахунок/.test(мій) && /8\s?400/.test(мій) && /Погоджені дизайни: 1 × 400/.test(мій) && /#5000001/.test(мій),
  'у «Задачах» людина бачить свій розрахунок: 8 400, «Погоджені дизайни: 1 × 400», номер замовлення',
  'мій розрахунок: ' + мій.slice(0, 300));
ok(!/Оля|10\s?600/.test(мій), 'і тільки свій — чужих сум там немає', 'у моєму розрахунку чужі дані');

console.log('\n═══ НОВЕ B2C ЗАПИСУЄ ВІДПОВІДАЛЬНОГО ═══');
const нове = await p.evaluate(async () => { const r = await designJobNew(); return r.order.mgrEmail; });
ok(нове === 'test@loomiq', 'хто завів B2C-замовлення — той його й веде (від цього бонус)', 'mgrEmail: ' + нове);

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
console.log('\n' + (bad ? '✗ провалів: ' + bad : '✓ усе гаразд'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
