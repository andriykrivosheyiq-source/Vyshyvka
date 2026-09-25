/* ФІНАНСИ: ПЛАТЕЖІ ПРИВʼЯЗУЮТЬСЯ ДО ЗАМОВЛЕНЬ.

   Гроші лежать у пʼяти банках: один ФОП на Приваті й чотири на Моно.
   Питання щодня одне — «клієнт заплатив?», — і доти на нього відповідали
   пʼятьма вкладками банку й памʼяттю.

   Перевіряємо не банки (їх тут немає), а те, заради чого розділ і
   заводився:
     1. усі рухи одним списком, з добором за рахунком, видом і привʼязкою;
     2. система САМА пропонує, до якого замовлення платіж належить, і
        каже чому — номер у призначенні, збіг суми, імʼя;
     3. привʼязана сума одразу зменшує залишок у картці замовлення.

   Третє найважливіше: без нього привʼязка — просто позначка, а питання
   «скільки клієнт ще винен» лишається без відповіді.

   Запуск:  node tests/finance.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8896;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }] };
const ORDERS = [
  { id:'1', orderId:'2000200', type:'client', dir:'b2c', name:'Асія Дерещук',
    status:'prorahunok', site:'main', payments:[], hist:[], items:[],
    crmNick:'asia_dera', totalPrice:4850, createdAt:'2026-09-24T09:00:00.000Z' },
  { id:'2', orderId:'2000201', type:'client', dir:'b2c', name:'Петро Іваненко',
    status:'prorahunok', site:'main', payments:[], hist:[], items:[],
    totalPrice:1200, createdAt:'2026-09-24T10:00:00.000Z' }
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
/* Колекція платежів у заглушці жива: на неї підписуються з `where`, і саме
   через цей шлях розділ і наповнюється. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  function PayCol(){}\n' +
  '  PayCol.prototype=Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where=function(){ return this; };\n' +
  '  PayCol.prototype.onSnapshot=function(cb){\n' +
  '    window.__payPush=function(){ try{ cb({\n' +
  '      forEach:function(f){ (window.__PAYS||[]).forEach(function(x){ f(new Snap(x.id,x)); }); }\n' +
  '    }); }catch(e){ console.error(e); } };\n' +
  '    window.__payPush(); return function(){}; };\n' +
  '  PayCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__pay=1; return d; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  "      if(n==='payments') return new PayCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');
/* Запис у платіж має відбиватись у тому ж масиві — інакше перевірка
   «залишок зменшився» нічого не побачить. */
fbstub = fbstub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  'Doc.prototype.set=function(v){ if(this.__pay){ (window.__PAYS||[]).forEach(function(x){\n' +
  '    if(x.id===this.__id) Object.assign(x, v||{}); }, this); if(window.__payPush) window.__payPush(); }\n' +
  '  return Promise.resolve(); };');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.addInitScript(() => {
  /* Пʼять рухів: два надходження, які мають до чогось належати, витрата й
     платіж, схожий одразу на двох — саме на ньому й видно, що підказка
     ранжує, а не вгадує. */
  window.__PAYS = [
    { id:'p1', at:'2026-09-25T10:00:00.000Z', amount:4850, acc:'mono1',
      counter:'Дерещук Асія', desc:'оплата замовлення 2000200' },
    { id:'p2', at:'2026-09-25T09:00:00.000Z', amount:1200, acc:'privat1',
      counter:'Іваненко П.', desc:'за футболку' },
    { id:'p3', at:'2026-09-24T18:00:00.000Z', amount:-3200, acc:'mono2',
      counter:'Нитки', desc:'закупівля' },
    { id:'p4', at:'2026-09-24T12:00:00.000Z', amount:500, acc:'mono3',
      counter:'Невідомо', desc:'' }
  ];
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });
await p.evaluate(() => { document.querySelector('.nav button[data-view="fin"]').click(); });
await p.waitForTimeout(700);

console.log('');
console.log('═══ УСІ РУХИ ОДНИМ СПИСКОМ ═══');
const списком = await p.evaluate(() => ({
  видно: (document.getElementById('view-fin') || {}).style.display,
  рядків: document.querySelectorAll('#fin-list .fin-row').length,
  рахунків: document.querySelectorAll('[data-fin-acc]').length,
  підсумок: (document.getElementById('fin-sum') || {}).textContent || ''
}));
ok(списком.видно === 'block', 'розділ «Фінанси» відкривається', 'розділ не відкрився');
ok(списком.рядків === 4, 'усі чотири рухи в списку — і надходження, і витрата',
  'рухів у списку ' + списком.рядків + ' замість 4');
/* Пʼять рахунків плюс «усі»: один Приват ФОП і чотири Моно. */
ok(списком.рахунків === 6, 'рахунки добираються окремо: пʼять плюс «усі»',
  'рахунків у доборі ' + списком.рахунків);
ok(/Надійшло/.test(списком.підсумок) && /Витрачено/.test(списком.підсумок),
  'зверху видно, скільки надійшло й скільки витрачено',
  'підсумку немає: ' + списком.підсумок);

console.log('');
console.log('═══ ДОБІР ═══');
const добір = await p.evaluate(async () => {
  const one = async (fn) => { fn(); await new Promise(r => setTimeout(r, 200));
    return document.querySelectorAll('#fin-list .fin-row').length; };
  const надходжень = await one(()=>{ const s = document.getElementById('fin-kind');
    s.value = 'in'; s.dispatchEvent(new Event('change')); });
  const наРахунку = await one(()=>{ document.querySelector('[data-fin-acc="mono1"]').click(); });
  const усе = await one(()=>{ document.querySelector('[data-fin-acc=""]').click();
    const s = document.getElementById('fin-kind'); s.value = ''; s.dispatchEvent(new Event('change')); });
  const пошук = await one(()=>{ const q = document.getElementById('fin-q');
    q.value = 'нитки'; q.dispatchEvent(new Event('input')); });
  document.getElementById('fin-q').value = '';
  document.getElementById('fin-q').dispatchEvent(new Event('input'));
  return { надходжень, наРахунку, усе, пошук };
});
ok(добір.надходжень === 3, 'за видом: лишились три надходження',
  'добір за видом дав ' + добір.надходжень);
ok(добір.наРахунку === 1, 'за рахунком: один рух на цьому ФОПі',
  'добір за рахунком дав ' + добір.наРахунку);
ok(добір.пошук === 1, 'пошук за призначенням знаходить потрібне',
  'пошук дав ' + добір.пошук);
ok(добір.усе === 4, 'скинули добір — знову всі',
  'після скидання лишилось ' + добір.усе);

console.log('');
console.log('═══ СИСТЕМА САМА КАЖЕ, ДО ЧОГО ЦЕ ═══');
const підказка = await p.evaluate(async () => {
  document.querySelector('[data-fin-open="p1"]').click();
  await new Promise(r => setTimeout(r, 300));
  const g = [...document.querySelectorAll('.fin-g[data-fin-pick]')];
  return { є: g.length, перше: (g[0] || {}).dataset && g[0].dataset.finPick,
           чому: (g[0] || {}).textContent ? g[0].textContent.replace(/\s+/g, ' ').trim() : '' };
});
ok(підказка.є > 0, 'підказка пропонує замовлення', 'підказок немає зовсім');
/* Номер у призначенні важить більше за збіг суми: однакова сума буває в
   десятьох замовленнях, а номер — в одному. */
ok(підказка.перше === '2000200',
  'першим стоїть те, де номер у призначенні: ' + підказка.чому,
  'зверху не те замовлення: ' + підказка.перше);
ok(/номер у призначенні/.test(підказка.чому),
  'і сказано, ЧОМУ саме воно — здогад без причини нічим не перевірити',
  'причину не названо: ' + підказка.чому);

console.log('');
console.log('═══ ПРИВʼЯЗАНА СУМА ЗМЕНШУЄ ЗАЛИШОК ═══');
const гроші = await p.evaluate(async () => {
  const доПривʼязки = payPaid('2000200');
  document.querySelector('.fin-g[data-fin-pick="2000200"]').click();
  await new Promise(r => setTimeout(r, 400));
  const o = (orders || []).filter(x => x.orderId === '2000200')[0];
  return { доПривʼязки, після: payPaid('2000200'),
           всього: Math.round(+o.totalPrice || 0),
           модальне: !!document.querySelector('.fin-modal') };
});
ok(гроші.доПривʼязки === 0, 'до привʼязки за замовленням не значилось нічого',
  'щось уже значилось: ' + гроші.доПривʼязки);
ok(гроші.після === 4850,
  'після привʼязки за замовленням значиться 4 850 ₴',
  'привʼязка не порахувалась: ' + гроші.після);
/* Саме заради цього все й робилось: питання «скільки клієнт ще винен» має
   мати відповідь, а не вимагати походу у вкладку банку. */
ok(гроші.всього - гроші.після === 0,
  'залишок до оплати став нулем — замовлення оплачене',
  'залишок не зійшовся: ' + (гроші.всього - гроші.після));
ok(!гроші.модальне, 'вікно привʼязки закрилось саме', 'вікно лишилось відкритим');

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 2).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nплатежі видно й вони знають своє замовлення');
process.exit(bad ? 1 : 0);
