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
   «Мій розрахунок». Посади за замовчуванням — з ролі доступу. */
const CONTENT = { team: [
  { email:'sales@loomiq', name:'Марта', role:'manager' },
  { email:'mgr@loomiq',   name:'Оля',   role:'designmgr' },
  { email:'comm@loomiq',  name:'Таня',  role:'designmgr' },
  { email:'test@loomiq',  name:'Іра',   role:'designer' },
  { email:'emb@loomiq',   name:'Петро', role:'embroidery' },
  { email:'prod@loomiq',  name:'Цех',   role:'production' },
  { email:'buy@loomiq',   name:'Зоя',   role:'supply' }] };

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
    /* B2C: вишивку здано цього місяця — замовлення пішло у виробництво; цех
       поставив «Готово»; Таня відповідала клієнту двічі (30 і 90 хв). */
    b2c('5000001', { mgrEmail:'mgr@loomiq', commEmail:'comm@loomiq',
      trackHist:[{ t:'prod', s:'done', at: now, by:'prod@loomiq' }],
      resp:[{ at: now, by:'comm@loomiq', min: 30, ch:'tg' }, { at: now, by:'comm@loomiq', min: 90, ch:'ig' }] }),
    /* Старе B2C без відповідального, вишивки ще немає — у виробництво не пішло. */
    b2c('5000002', {}),
    b2c('5000003', { mgrEmail:'mgr@loomiq', status:'cancel' }),
    b2c('5000004', { mgrEmail:'mgr@loomiq', createdAt: before }),
    /* B2B: продала Марта, процес вела Оля (рух треку акаунт-менеджера), пішло
       у виробництво й готове; макет погоджено (робила Іра). */
    { id:'b1', orderId:'1000001', status:'paid', createdAt: now, mgrEmail:'sales@loomiq',
      hist:[{ s:'lead', at: now }, { s:'new', at: now }, { s:'paid', at: now }],
      totalPrice: 10000, totalCost: 6000, items:[{ name:'Футболка', qty: 20, price: 10000, cost: 6000 }],
      art:[{ n:1, at: now, by:'test@loomiq', approvals:{ client:{ at: now } } }],
      trackHist:[{ t:'acct', s:'brief', at: now, by:'mgr@loomiq' },
                 { t:'prod', s:'work', at: now, by:'prod@loomiq' }, { t:'prod', s:'done', at: now, by:'prod@loomiq' },
                 { t:'prod', s:'work', at: now, by:'prod@loomiq' }, { t:'prod', s:'done', at: now, by:'prod@loomiq' }] },
    { id:'b2', orderId:'1000002', status:'lead', createdAt: now, mgrEmail:'sales@loomiq', totalPrice: 5000, items:[] },
    /* Звернення минулого місяця, яке стало замовленням цього: продаж — у цей. */
    { id:'b3', orderId:'1000003', status:'new', createdAt: before, mgrEmail:'sales@loomiq',
      hist:[{ s:'lead', at: before }, { s:'new', at: now }], totalPrice: 4000, items:[{ qty: 5, price: 4000 }] });
  designJobs['5000001'] = { orderId:'5000001', units:[{ id:'u1', qty: 3,
    graphic:[{ id:'g1', who:'test@loomiq', takenAt: now, sentAt: now, attachedBy:'mgr@loomiq', attachedAt: now,
      vers:[{ n:1, at: now, by:'test@loomiq', files:[] }, { n:2, at: now, by:'test@loomiq', files:[] }],
      ok:{ ver: 2, how:'client', at: now } }],
    stitch:[{ id:'s1', who:'emb@loomiq', sentAt: now, takenAt: now,
      vers:[{ n:1, at: now, by:'emb@loomiq', files:[{ role:'machine' }] }], ok:{ ver: 1, how:'auto', at: now } }] }] };
  designJobs['5000002'] = { orderId:'5000002', units:[{ id:'u2', qty: 1,
    graphic:[{ id:'g2', who:'test@loomiq', attachedBy:'mgr@loomiq', attachedAt: now, sentBy:'mgr@loomiq', sentAt: now,
      vers:[{ n:1, at: now, by:'test@loomiq', files:[] }] }] }] };
  designJobs['5000004'] = { orderId:'5000004', units:[{ id:'u4', qty: 1,
    graphic:[{ id:'g4', who:'test@loomiq', vers:[{ n:1, at: before, by:'test@loomiq' }], ok:{ ver:1, how:'client', at: before } }] }] };
  designBuys['buy1'] = { id:'buy1', kind:'buy', n:1, by:'buy@loomiq', at: now, rows:[], status:'sent' };
  contentData.team = window.__CONTENT.team;
  return finMonths(12)[0];
});

console.log('\n═══ ХТО ЩО ЗРОБИВ ЗА МІСЯЦЬ ═══');
const W = await p.evaluate(m => {
  const W = teamWork(m);
  const s = e => { const w = W[e] || payWorkEmpty(); return { sales: w.sales.map(o => o.id).sort(), leads: w.leads,
    proc: w.proc.map(o => o.id + ':' + o.dir + ':' + o.pieces + ':' + o.designs).sort(), comm: w.comm.map(o => o.id),
    design: w.design.map(d => d.id + ':' + d.dir).sort(), stitch: w.stitch.map(d => d.id), resp: w.resp.map(r => r.min), buys: w.buys }; };
  return { sales: s('sales@loomiq'), mgr: s('mgr@loomiq'), comm: s('comm@loomiq'), des: s('test@loomiq'),
           emb: s('emb@loomiq'), buy: s('buy@loomiq'), shop: { b2b: W['*shop'].b2b, b2c: W['*shop'].b2c } };
}, M);
console.log('  ' + JSON.stringify(W));
ok(JSON.stringify(W.sales.sales) === '["1000001","1000003"]' && W.sales.leads === 2,
  'продажі B2B: два замовлення — зокрема звернення минулого місяця, яке стало замовленням цього; звернень 2',
  'продажі: ' + JSON.stringify(W.sales));
ok(JSON.stringify(W.mgr.proc) === JSON.stringify(['1000001:b2b:20:1', '5000001:b2c:3:1']),
  'процес-менеджеру — два замовлення, що пішли у виробництво: B2B 20 шт і B2C 3 шт, по дизайну в кожному',
  'процес: ' + JSON.stringify(W.mgr.proc));
ok(JSON.stringify(W.comm.comm) === '["5000001"]' && JSON.stringify(W.comm.resp) === '[30,90]',
  'комунікейшн-менеджеру — замовлення, де вона відповідала, і дві відповіді (30 і 90 хв)', 'комунікейшн: ' + JSON.stringify(W.comm));
ok(JSON.stringify(W.des.design) === JSON.stringify(['1000001:b2b', '5000001:b2c']),
  'графічному — дизайн B2B і дизайн B2C; непогоджений і минуломісячний не зараховано', 'дизайни: ' + JSON.stringify(W.des.design));
ok(JSON.stringify(W.emb.stitch) === '["5000001"]' && W.buy.buys === 1, 'вишивальному — одна оцифровка; закупівлі — одна закупівля',
  'інше: ' + JSON.stringify([W.emb, W.buy]));
ok(W.shop.b2b === 20 && W.shop.b2c === 3, 'цех за місяць: 20 виробів B2B і 3 B2C; повторне «Готово» не подвоює', 'цех: ' + JSON.stringify(W.shop));

console.log('\n═══ ВКЛАДКА «КОМАНДА»: ПОСАДИ Й ЛЮДИ БЕЗ ВХОДУ ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-fin').style.display = 'block';
  finAn.tab = 'team'; renderFin();
});
await p.waitForTimeout(200);
const вписати = async (sel, v) => { await p.evaluate(({ sel, v }) => { const el = document.querySelector(sel);
  if(!el) throw new Error('немає ' + sel);
  el.value = v; el.dispatchEvent(new Event('change', { bubbles:true })); }, { sel, v }); await p.waitForTimeout(60); };
const додати = async (name, pos) => { await p.evaluate(({ name, pos }) => {
  document.getElementById('tm-new-name').value = name; document.getElementById('tm-new-pos').value = pos;
  document.getElementById('tm-new-go').click(); }, { name, pos }); await p.waitForTimeout(150); };
/* Таня — комунікейшн-менеджер: міняємо посаду в її рядку. */
await p.evaluate(() => document.querySelector('#fin-team [data-tm-open="comm@loomiq"]').click());
await p.waitForTimeout(80);
await вписати('[data-tm-pos="comm@loomiq"]', 'comm');
/* Пакувальник і агенція — без пошти й без входу в CRM. */
await додати('Ігор', 'pack');
await додати('Агенція «Таргет»', 'agency');
const групи = await p.evaluate(() => ({
  відділи: [...document.querySelectorAll('#fin-team .tm-g td:first-child')].map(x => x.textContent),
  людей: document.querySelectorAll('#fin-team .tm-r').length,
  посади: [...document.querySelectorAll('#fin-team .tm-r')].map(r => r.querySelector('i').textContent.split(' · ')[0]) }));
console.log('  ' + JSON.stringify(групи));
ok(групи.людей === 9 && групи.відділи.join('|') === 'Продажі B2B|Акаунт-менеджери|Графічний дизайн|Вишивальний дизайн|Виробництво|Контент і маркетинг',
  'рядки згруповано по відділах; девʼятеро людей, двоє з них — без входу в CRM', 'групи: ' + JSON.stringify(групи));
ok(['Менеджер з продажу', 'Процес-менеджер', 'Комунікейшн-менеджер', 'Пакувальник', 'Агенція / підрядник'].every(x => групи.посади.indexOf(x) >= 0),
  'посади стоять: менеджер з продажу, процес- і комунікейшн-менеджер, пакувальник, агенція', 'посади: ' + JSON.stringify(групи.посади));

console.log('\n═══ СТАВКИ ЗА ПОСАДАМИ: B2B І B2C ОКРЕМО ═══');
await p.evaluate(() => { document.querySelector('#fin-team .tm-rates').open = true; });
const R1 = [['sales','base','8000'], ['sales','pct','5'], ['sales','order_b2b','100'],
  ['proc','base','10000'], ['proc','piece_b2b','5'], ['proc','piece_b2c','20'], ['proc','design_b2c','50'], ['proc','order_b2c','30'],
  ['comm','base','9000'], ['comm','piece_b2c','10'],
  ['gd','design_b2b','300'], ['gd','design_b2c','400'], ['sd','stitch_b2c','250'],
  ['oper','piece_b2b','2'], ['oper','piece_b2c','4'], ['pack','piece_b2b','1'], ['pack','piece_b2c','1'],
  ['buy','buy','50'], ['agency','base','15000'], ['agency','unit','500']];
for(const [pk, f, v] of R1) await вписати('[data-tm-posk="' + pk + '"][data-tm-r="' + f + '"]', v);
/* Агенція за місяць зробила 4 одиниці — вписуємо руками. */
const агенція = await p.evaluate(() => (contentData.payroll.staff.find(x => /Таргет/.test(x.name)) || {}).id);
await p.evaluate(k => { payView.open = k; renderTeam(); }, 'x:' + агенція);
await вписати('[data-tm-units="x:' + агенція + '"]', '4');
const рядки = () => p.evaluate(m => {
  const W = teamWork(m), o = {};
  payPeople(m, W).forEach(x => { const r = payRow(x, m, W); o[x.name] = r.total; });
  return o;
}, M);
const R = await рядки();
console.log('  ' + JSON.stringify(R));
ok(R['Марта'] === 8000 + 700 + 200, 'менеджер з продажу: 8 000 + 5% від 14 000 + 2 × 100 = 8 900', 'Марта: ' + R['Марта']);
ok(R['Оля'] === 10000 + 100 + 60 + 50 + 30,
  'процес-менеджер: 10 000 + 20 шт B2B × 5 + 3 шт B2C × 20 + дизайн B2C 50 + замовлення B2C 30 = 10 240', 'Оля: ' + R['Оля']);
ok(R['Таня'] === 9030, 'комунікейшн-менеджер: 9 000 + 3 шт B2C × 10 = 9 030', 'Таня: ' + R['Таня']);
ok(R['Іра'] === 700, 'графічний: дизайн B2B 300 + дизайн B2C 400 — різні ставки', 'Іра: ' + R['Іра']);
ok(R['Петро'] === 250 && R['Зоя'] === 50, 'вишивальний 250; закупівля без ставки — 50 за закупівлю', 'інші: ' + JSON.stringify(R));
ok(R['Цех'] === 20 * 2 + 3 * 4 && R['Ігор'] === 23,
  'цеху — усі вироби цеху за місяць за своєю ціною: оператор 52, пакувальник 23', 'цех: ' + JSON.stringify([R['Цех'], R['Ігор']]));
ok(R['Агенція «Таргет»'] === 17000, 'агенція: 15 000 щомісяця + 4 одиниці × 500 = 17 000', 'агенція: ' + R['Агенція «Таргет»']);

console.log('\n═══ «ВИПЛАЧЕНО» ═══');
await p.evaluate(() => { window.__ADDED = []; window.__SETS = []; window.__DELS = []; });
await p.evaluate(() => document.querySelector('#fin-team [data-tm-paid="sales@loomiq"]').click());
await p.waitForTimeout(400);
const виплата = await p.evaluate(m => ({
  витрата: (window.__ADDED || []).filter(x => x.src === 'salary').map(x => ({ amount: x.amount, desc: x.desc, counter: x.counter })),
  paid: ((contentData.payroll.months[m] || {})['sales@loomiq'] || {}).paid,
  постійні: (window.__SETS || []).filter(x => x.col === 'loomiq' && x.id === 'fixedcosts').map(x => x.v.months[m]).pop() }), M);
console.log('  ' + JSON.stringify(виплата));
ok(виплата.витрата.length === 1 && виплата.витрата[0].amount === -8900 && /^Зарплата · /.test(виплата.витрата[0].desc) && виплата.витрата[0].counter === 'Марта',
  'у Фінанси записано витрату −8 900 «Зарплата · місяць»', 'витрата: ' + JSON.stringify(виплата.витрата));
ok(виплата.paid && виплата.paid.sum === 8900 && виплата.постійні && виплата.постійні.salary === 8900,
  'виплату запамʼятовано, «Зарплати» в постійних витратах — сумою виплаченого', 'виплата: ' + JSON.stringify(виплата));
await p.evaluate(() => document.querySelector('#fin-team [data-tm-unpaid="sales@loomiq"]').click());
await p.waitForTimeout(400);
const скасовано = await p.evaluate(m => ({ стерто: (window.__DELS || []).filter(x => x.col === 'payments').length,
  paid: ((contentData.payroll.months[m] || {})['sales@loomiq'] || {}).paid }), M);
ok(скасовано.стерто === 1 && !скасовано.paid, '↺ скасовує виплату разом із витратою', 'скасування: ' + JSON.stringify(скасовано));

console.log('\n═══ МІЙ РОЗРАХУНОК ═══');
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-today').style.display = 'block';
  renderToday();
  document.querySelector('#td-pay details').open = true;
});
await p.waitForTimeout(150);
const мій = await p.evaluate(() => (document.querySelector('#td-pay') || {}).textContent || '');
console.log('  ' + мій.replace(/\s+/g, ' ').slice(0, 220));
ok(/Мій розрахунок/.test(мій) && /— 700/.test(мій) && /За дизайн B2B: 1 × 300/.test(мій) && /За дизайн B2C: 1 × 400/.test(мій) && /#5000001/.test(мій),
  'у «Задачах» — свій розрахунок: 700, окремо дизайн B2B і B2C, номери замовлень', 'мій: ' + мій.slice(0, 300));
ok(!/Марта|8\s?900/.test(мій), 'і тільки свій', 'у моєму розрахунку чужі дані');

console.log('\n═══ ДАШБОРДИ ═══');
const дашборд = () => p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-dash').style.display = 'block';
  renderDash();
  return { вкладки: [...document.querySelectorAll('#dash-tabs [data-dash-d]')].map(b => b.textContent),
           on: (document.querySelector('#dash-tabs .on') || {}).textContent,
           kpi: [...document.querySelectorAll('#dashRoot .an-c')].map(c => c.querySelector('span').textContent + '=' + c.querySelector('b').textContent),
           люди: [...document.querySelectorAll('#dashRoot .dash-t tbody tr')].map(r => r.querySelector('b').textContent) };
});
let д = await дашборд();
console.log('  ' + JSON.stringify(д));
ok(д.вкладки.length === 1 && д.on === 'Графічний дизайн' && д.люди.join() === 'Іра' && д.kpi.indexOf('Погоджено дизайнів=2') >= 0,
  'дизайнер без доступу до аналітики бачить лише дашборд свого відділу', 'дашборд: ' + JSON.stringify(д));
await p.evaluate(() => { window.__myAcc = myAcc; myAcc = () => ({ nav:'*' }); dashView.d = 'acct'; });
д = await дашборд();
console.log('  ' + JSON.stringify(д));
ok(д.вкладки.length === 6 && д.on === 'Акаунт-менеджери' && JSON.stringify(д.люди) === '["Оля","Таня"]' &&
   д.kpi.indexOf('Передано у виробництво=2') >= 0 && д.kpi.indexOf('Сер. час відповіді=1 год') >= 0,
  'з доступом до аналітики — усі шість відділів; акаунт-менеджери: 2 у виробництво, середня відповідь 1 год',
  'дашборд: ' + JSON.stringify(д));
await p.evaluate(() => { dashView.d = 'prod'; });
д = await дашборд();
ok(д.kpi.indexOf('Виробів B2B=20') >= 0 && д.kpi.indexOf('Виробів B2C=3') >= 0 && д.люди.indexOf('Ігор') >= 0,
  'виробництво: 20 B2B і 3 B2C, у таблиці й люди без входу', 'дашборд цеху: ' + JSON.stringify(д));
await p.evaluate(() => { myAcc = window.__myAcc; });

console.log('\n═══ ВІДПОВІДЬ ІЗ CRM ЗАПИСУЄ, ХТО Й ЯК ШВИДКО ═══');
const відповідь = await p.evaluate(async () => {
  const t = new Date(Date.now() - 45 * 60000);
  const pad = n => String(n).padStart(2, '0');
  const o = { id:'oc', orderId:'5000009', dir:'b2c', status:'b2c-new', createdAt: new Date().toISOString(), items:[], hist:[],
    crmChatId:'c9', crmTheirs: true, crmUnread: 1,
    crmInAt: t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) };
  orders.push(o);
  crmFetch = async () => ({ id: 77 });
  await crmSend(o, 'Добрий день!');
  return { comm: o.commEmail, resp: o.resp };
});
console.log('  ' + JSON.stringify(відповідь));
ok(відповідь.comm === 'test@loomiq' && відповідь.resp && відповідь.resp.length === 1 &&
   відповідь.resp[0].by === 'test@loomiq' && відповідь.resp[0].min >= 44 && відповідь.resp[0].min <= 47 && відповідь.resp[0].ch === 'ig',
  'відповів з CRM — я комунікейшн-менеджер цього замовлення, і записано: клієнт чекав ~45 хв', 'відповідь: ' + JSON.stringify(відповідь));

console.log('\n═══ НОВЕ B2C ЗАПИСУЄ ВІДПОВІДАЛЬНОГО ═══');
const нове = await p.evaluate(async () => { const r = await designJobNew(); return r.order.mgrEmail; });
ok(нове === 'test@loomiq', 'хто завів B2C-замовлення — той його й веде', 'mgrEmail: ' + нове);
ok(await p.evaluate(() => !roleDef('qa') && !/Контроль файлів/.test(JSON.stringify(roleDefs()))),
  'ролі «Контроль файлів» більше немає', 'роль контролю файлів лишилась');

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
console.log('\n' + (bad ? '✗ провалів: ' + bad : '✓ усе гаразд'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
