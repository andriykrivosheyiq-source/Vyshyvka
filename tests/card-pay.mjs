/* ОПЛАТА НА КАРТУ З «!» (21.10).

   Андрій: «оплата була на карту… оплату на карту може вписувати будь-який
   менеджер (сума, карта, скрін обовʼязково). Підтвердили лише Андрій або
   Володимир. Замовлення йде по ланцюгу, а на ньому знак оклику, що платіж
   не перевірений; при цьому оплата враховується, наче внесена».

   Перевіряємо справжній код адмінки: менеджер вписує → рух у Фінансах
   (src card, не перевірено) привʼязаний до замовлення → «сплачено» в
   картці, «!» у картці, на плитці канбану, у B2C-картці й Звірці → власник
   «Підтверджено» / «Не дійшло».

   Запуск:  node tests/card-pay.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8943;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'manager' },
         { email:'boss@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Петро',     role:'designer' }],
  fin: { accounts: [{ id:'card1', name:'Карта Моно Юкальчук', bank:'mono' }, { id:'fop1', name:'ФОП Юкальчук', bank:'privat' }] },
  /* Роздрібна ціна саме цього виробу. Саме з неї має рахуватись сума
     замовлення — а не з `totalPrice`, якого в приватних замовленнях немає. */
  products: { retail: { tee: 700 } }
};
const ORDERS = [
  /* B2B: 3 худі, із 6 000 ₴ сплачено 2 900 — залишок 3 100 */
  { id:'b1', orderId:'1000501', type:'client', name:'Ромашка Ольга', phone:'+380671112233',
    status:'production', site:'main', hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    totalPrice:6000, payments:[{ sum:2900, at:'2026-09-26T10:00:00.000Z' }],
    items:[{ kind:'main', name:'Худі базове', garmentId:'hoodie', qty:3, price:6000 }] },
  /* B2C у відділі дизайну: контроль якості ще не пройдено */
  { id:'c1', orderId:'2000777', type:'client', dir:'b2c', name:'Мороз Євгенія', phone:'+380688323228',
    status:'production', site:'main', payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Мороз Євгенія', crmNick:'moroz', totalPrice:2080, items:[] }
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
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Дмитренко', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-28T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана Петренко', desc:'худі ромашка' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' },\n" +
  "    { id:'p5', at:'2026-09-27T08:30:00.000Z', amount:5000, acc:'mono1', tag:'own', counter:'Переказ між рахунками' },\n" +
  "    { id:'p6', at:'2026-09-25T18:05:00.000Z', amount:1250.5, acc:'mono2', counter:'Іван Коваль', desc:'вишиванка' },\n" +
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




const ЖДИ = ms => p.waitForTimeout(ms);
const SHOT = { name:'shot.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') };
await p.evaluate(() => { window.uploadCloudinaryAuto = async f => 'https://up.test/' + encodeURIComponent((f && f.name) || 'f'); });

console.log('═══ 1. МЕНЕДЖЕР ВПИСУЄ ОПЛАТУ НА КАРТУ (B2B) ═══');
const роль0 = await p.evaluate(() => ({ role: myRole(), pay: canPay(), chk: payCanCheck() }));
ok(роль0.role === 'manager' && роль0.pay && !роль0.chk, 'менеджер: може записувати оплату, підтверджувати — ні', JSON.stringify(роль0));
await p.evaluate(async () => { const o = orders.filter(x => x.orderId === '1000501')[0]; odFolds.pay = true; await openOrderDrawer(o); });
await ЖДИ(600);
await p.click('[data-pay-pick]');
await ЖДИ(300);
const форма = await p.evaluate(() => {
  const d = document.querySelector('.pp-card'); if(!d) return { err:'немає форми' };
  d.open = true;
  return { acc: [...d.querySelectorAll('[data-pc-acc] option')].map(x => x.textContent), shot: !!d.querySelector('[data-pc-shot]'),
           man: !!document.querySelector('.pp-man:not(.pp-card)') };
});
console.log('   ' + JSON.stringify(форма));
ok(!форма.err && форма.shot && форма.acc[0] === 'Карта Моно Юкальчук' && !форма.man,
  'у вікні платежу — «Клієнт переказав на карту»: сума, дата, карта (картки першими), скрін; «вписати вручну (власник)» менеджеру не видно', JSON.stringify(форма));
/* Без скріна — не записується. */
await p.fill('[data-pc-sum]', '500');
await p.click('[data-pc-go]');
await ЖДИ(300);
const безСкріна = await p.evaluate(() => ({ n: (payments || []).filter(x => x.src === 'card').length, open: !!document.querySelector('.pp-w') }));
ok(безСкріна.n === 0 && безСкріна.open, 'без скріна оплату не записано, вікно лишилось', JSON.stringify(безСкріна));
await p.setInputFiles('[data-pc-shot]', SHOT);
await p.click('[data-pc-go]');
await ЖДИ(900);
const зап = await p.evaluate(() => {
  const o = orders.filter(x => x.orderId === '1000501')[0];
  const c = (payments || []).filter(x => x.src === 'card')[0] || null;
  return { c: c && { amount: c.amount, acc: c.acc, by: c.by, shot: c.shot, state: c.check && c.check.state, orderId: c.orderId, tag: c.tag },
           paid: paidSum(o), due: dueSum(o), cod: LQMoney.codFor(o, payments), st: payState(o), copy: o.payments.some(x => x.payId === (c && c.id)),
           open: !!document.querySelector('.pp-w'),
           chk: !!document.querySelector('.od-money .pay-chk'), btn: !!document.querySelector('.od-money [data-pay-chk]'),
           row: [...document.querySelectorAll('.od-money .pay-row, .od-money .pay-chkrow')].slice(-2).map(x => x.textContent).join(' ') };
});
console.log('   ' + JSON.stringify(зап));
ok(зап.c && зап.c.amount === 500 && зап.c.acc === 'card1' && зап.c.by === 'test@loomiq' && /up\.test\/shot/.test(зап.c.shot) && зап.c.state === 'wait' && зап.c.orderId === '1000501',
  'рух у Фінансах: 500 ₴ на карту, хто вписав, скрін, «не перевірено», привʼязаний до замовлення', JSON.stringify(зап.c));
ok(зап.paid === 3400 && зап.due === 2600 && зап.cod === 2600 && зап.st === 'part' && зап.copy,
  'рахується як сплачено: 2 900 + 500 = 3 400, залишок і контроль оплати ТТН 2 600, копія в картці', JSON.stringify(зап));
ok(!зап.open && зап.chk && !зап.btn && /не підтверджено/.test(зап.row) && /скрін/.test(зап.row),
  'у картці рядок «на карту · ! не підтверджено · скрін», кнопок підтвердження в менеджера немає', зап.row);
await p.evaluate(() => renderBoard());
await ЖДИ(300);
const плитка = await p.evaluate(() => {
  const t = [...document.querySelectorAll('.tc-money')].filter(x => /оплата не перевірена/.test(x.textContent));
  return { n: t.length, cls: t[0] && t[0].querySelector('.p-chk') ? 1 : 0 };
});
ok(плитка.n === 1 && плитка.cls, 'на плитці канбану B2B — «! оплата не перевірена»', JSON.stringify(плитка));
const зв0 = await p.evaluate(() => moneyAudit().filter(x => /^card_/.test(x.kind)).map(x => x.kind + ':' + x.sev + ':' + x.orderId));
ok(зв0.join() === 'card_wait:amber:1000501', 'Звірка: «не підтверджена» жовтим із номером замовлення', зв0.join());

console.log('');
console.log('═══ 2. ВЛАСНИК ПІДТВЕРДЖУЄ ═══');
/* Менеджер не може підтвердити навіть напряму. */
const чуж = await p.evaluate(async () => { const c = (payments || []).filter(x => x.src === 'card')[0]; await payCheckSet(c.id, 'ok'); return c.check.state; });
ok(чуж === 'wait', 'менеджер не може підтвердити (стан лишився «не перевірено»)', 'стан: ' + чуж);
await p.evaluate(() => { contentData.team[0].role = 'owner'; renderOrderDrawer(); });
await ЖДИ(300);
const вл = await p.evaluate(() => ({ role: myRole(), btns: [...document.querySelectorAll('.od-money [data-pay-chk]')].map(b => b.textContent) }));
ok(вл.role === 'owner' && вл.btns.join() === 'Підтверджено,Не дійшло', 'власник бачить «Підтверджено» / «Не дійшло»', JSON.stringify(вл));
await p.click('.od-money [data-pay-chk$="|ok"]');
await ЖДИ(400);
const підтв = await p.evaluate(() => {
  const o = orders.filter(x => x.orderId === '1000501')[0];
  const c = (payments || []).filter(x => x.src === 'card')[0];
  renderBoard();
  return { state: c.check.state, by: c.check.by, paid: paidSum(o), chk: !!document.querySelector('.od-money .pay-chk'),
           row: [...document.querySelectorAll('.od-money .pay-row, .od-money .pay-chkrow')].slice(-2).map(x => x.textContent).join(' '),
           tile: document.querySelectorAll('.tc-money .p-chk').length, audit: moneyAudit().filter(x => /^card_/.test(x.kind)).length };
});
console.log('   ' + JSON.stringify(підтв));
ok(підтв.state === 'ok' && підтв.by === 'test@loomiq' && підтв.paid === 3400 && !підтв.chk && /підтверджено/.test(підтв.row) && !підтв.tile && !підтв.audit,
  '«Підтверджено»: «!» зник з картки й плитки, Звірка мовчить, сума та сама', JSON.stringify(підтв));
/* «Не дійшло» — не рахується. */
const ні = await p.evaluate(async () => {
  const o = orders.filter(x => x.orderId === '1000501')[0];
  const c = (payments || []).filter(x => x.src === 'card')[0];
  await payCheckSet(c.id, 'no');
  return { state: c.check.state, paid: paidSum(o), due: dueSum(o), audit: moneyAudit().filter(x => /^card_/.test(x.kind)).map(x => x.kind + ':' + x.sev).join(),
           row: [...document.querySelectorAll('.od-money .pay-row, .od-money .pay-chkrow')].slice(-2).map(x => x.textContent).join(' ') };
});
console.log('   ' + JSON.stringify(ні));
ok(ні.state === 'no' && ні.paid === 2900 && ні.due === 3100 && ні.audit === 'card_no:red' && /не дійшло/.test(ні.row),
  '«Не дійшло»: не рахується (знову 2 900 / залишок 3 100), Звірка червоним, у рядку «✕ не дійшло»', JSON.stringify(ні));

console.log('');
console.log('═══ 3. B2C: ТЕ САМЕ У КАРТЦІ ВІДДІЛУ ═══');
await p.evaluate(() => { contentData.team[0].role = 'managerb2c'; document.querySelectorAll('.od-drawer').forEach(x => x.classList.remove('open')); });
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const job = designJobMake('2000777');
  const U = window.LQDesign.ui;
  job.units = [ Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:2 }) ];
  openDesign();
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await ЖДИ(600);
await p.evaluate(() => { const o = orders.filter(x => x.orderId === '2000777')[0]; window.LQDesign.ui.host.payPick(o, () => {}); });
await ЖДИ(300);
await p.evaluate(() => { document.querySelector('.pp-card').open = true; });
await p.fill('[data-pc-sum]', '1000');
await p.setInputFiles('[data-pc-shot]', SHOT);
await p.click('[data-pc-go]');
await ЖДИ(900);
const b2c = await p.evaluate(() => {
  const U = window.LQDesign.ui; const o = orders.filter(x => x.orderId === '2000777')[0];
  U.render(document.getElementById('dzRoot'));
  const tile = [...document.querySelectorAll('#dzRoot [data-open="2000777"]')][0];
  U.open('2000777'); U.render(document.getElementById('dzRoot'));
  const f = document.querySelector('[data-fold="Гроші"]'); if(f && !f.closest('.on')) f.click();
  const row = [...document.querySelectorAll('.dz-pay-r')].filter(x => /1 000/.test(x.textContent))[0];
  return { paid: paidSum(o), role: myRole(), tileChk: !!(tile && tile.querySelector('.dz-c-chk')),
           row: row ? row.textContent.replace(/\s+/g, ' ') : '', rowChk: !!(row && row.querySelector('.dz-c-chk')), btn: !!(row && row.querySelector('[data-do="pay-check"]')) };
});
console.log('   ' + JSON.stringify(b2c));
ok(b2c.paid === 1000 && b2c.tileChk && b2c.rowChk && !b2c.btn && /не підтверджено/.test(b2c.row) && /Оля/.test(b2c.row),
  'B2C: менеджер вписав 1 000 ₴ на карту — «!» на плитці й у рядку платежу (хто вписав), кнопок у менеджера немає', JSON.stringify(b2c));
await p.evaluate(() => { contentData.team[0].role = 'owner'; window.LQDesign.ui.render(document.getElementById('dzRoot')); });
await ЖДИ(200);
const b2cOk = await p.evaluate(async () => {
  const b = [...document.querySelectorAll('[data-do="pay-check"][data-st="ok"]')][0];
  if(!b) return { err:'кнопки немає' };
  b.click();
  await new Promise(r => setTimeout(r, 500));
  const c = (payments || []).filter(x => x.src === 'card' && x.orderId === '2000777')[0];
  const row = [...document.querySelectorAll('.dz-pay-r')].filter(x => /1 000/.test(x.textContent))[0];
  return { state: c.check.state, chk: !!(row && row.querySelector('.dz-c-chk')), row: row ? row.textContent.replace(/\s+/g, ' ') : '' };
});
console.log('   ' + JSON.stringify(b2cOk));
ok(b2cOk.state === 'ok' && !b2cOk.chk && /підтверджено/.test(b2cOk.row), 'B2C: власник натиснув «Підтверджено» з картки відділу — «!» зник', JSON.stringify(b2cOk));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'оплата на карту: вписує менеджер, рахується одразу, «!» до підтвердження власника');
process.exit(bad ? 1 : 0);
