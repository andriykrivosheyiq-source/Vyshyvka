/* Номер замовлення видається раз і назавжди.

   Доти наступний номер брався від найбільшого НАЯВНОГО на дошці. Видалили
   останню картку — і її номер діставався наступній: у двох різних
   замовлень виявлявся один номер.

   А номер живе не тільки в нас. Він у КП, у переписці, у платіжці, у
   розмові з клієнтом і в пам'яті менеджера. Два замовлення з одним номером
   — це рано чи пізно не той рахунок і не та відправка.

   Тепер лічильник зберігається окремо й тільки росте. Видалили картку — її
   номер зник разом із нею. Дірка в нумерації нормальна: вона чесно каже, що
   замовлення було.

   Перевіряємо:
     — номери йдуть підряд, поки нічого не видаляють;
     — видалення НЕ звільняє номер: наступна картка бере наступний, а не
       той, що звільнився;
     — лічильник записується в базу одразу, а не разом із карткою;
     — лічильник із бази головніший за те, що видно на дошці: навіть коли
       всі картки видалені, нумерація не починається спочатку.

   Запуск:  node tests/order-id.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8812;
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
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const order = (id, oid) => ({
  id, orderId:oid, type:'client', status:'kp', site:'main', payments:[], items:[],
  name:'Клієнт ' + id, phone:'+38067000' + oid.slice(-4),
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:1000, totalCost:600, margin:400, marginPct:40
});

function stub(orders, content){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify(orders) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(content) + ';\n  window.firebase={');
  /* Записи в документ сайту складаємо в купку — саме туди лягає лічильник. */
  s = s.replace(
    'Doc.prototype.set=function(){ return Promise.resolve(); };',
    'Doc.prototype.set=function(d){ (window.__SET=window.__SET||[]).push(d); return Promise.resolve(); };');
  s = s.replace(
    'Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace(
    'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
    'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace(
    'var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(src){ this.__src=src; }\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
    '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
    '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
    '      var c=new Col(); c.__n=n; return c; },');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
async function open(orders, content){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  p.on('dialog', d => d.accept('ok'));
  const body = stub(orders, content || {});
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}

console.log('═══ ПІДРЯД, ПОКИ НІЧОГО НЕ ВИДАЛЯЮТЬ ═══');
const p = await open([order('1', '1000041'), order('2', '1000042')], { orderSeq: 1000042 });
const row = await p.evaluate(() => [makeOrderId(), makeOrderId(), makeOrderId()]);
console.log('  ' + row.join(' → '));
ok(row.join() === '1000043,1000044,1000045',
  'номери йдуть підряд від останнього виданого',
  'нумерація не та: ' + row.join(','));

console.log('');
console.log('═══ ВИДАЛЕНИЙ НОМЕР НЕ ПОВЕРТАЄТЬСЯ ═══');
/* Найважливіше. Викидаємо з дошки всі картки, включно з найбільшим номером,
   — рівно так, як це виглядає після видалення останнього замовлення. */
const after = await p.evaluate(() => {
  orders.length = 0;                    // усі картки прибрані з дошки
  return { seq: contentData.orderSeq, next: makeOrderId() };
});
console.log('  лічильник у базі: ' + after.seq + ' · наступний номер: ' + after.next);
ok(after.next === '1000046',
  'номер видаленої картки нікому не дістається — беремо наступний',
  'номер поїхав назад: ' + after.next);

const wrote = await p.evaluate(() =>
  (window.__SET || []).filter(x => x && x.orderSeq).map(x => x.orderSeq));
console.log('  записи лічильника: ' + wrote.join(', '));
ok(wrote.length >= 4 && wrote[wrote.length - 1] === 1000046,
  'кожен виданий номер одразу записується в базу, а не разом із карткою',
  'лічильник у базу не пішов: ' + JSON.stringify(wrote));
await p.close();

console.log('');
console.log('═══ ПОРОЖНЯ ДОШКА НЕ ПОЧИНАЄ СПОЧАТКУ ═══');
{
  /* Нова вкладка, карток немає взагалі — але лічильник у базі є. */
  const p2 = await open([], { orderSeq: 1000200 });
  const n = await p2.evaluate(() => makeOrderId());
  console.log('  ' + n);
  ok(n === '1000201',
    'лічильник із бази головніший за порожню дошку',
    'нумерація почалась спочатку: ' + n);
  await p2.close();
}

console.log('');
console.log('═══ СТАРА БАЗА БЕЗ ЛІЧИЛЬНИКА ═══');
{
  /* Лічильника ще немає — тоді запобіжником лишаються самі картки, інакше
     перша ж нова картка отримала б номер, який уже зайнятий. */
  const p3 = await open([order('1', '1000300')], {});
  const n = await p3.evaluate(() => makeOrderId());
  console.log('  ' + n);
  ok(n === '1000301',
    'без лічильника беремо від найбільшого наявного — і одразу його зберігаємо',
    'стара база отримала чужий номер: ' + n);
  await p3.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'номер видається раз і назавжди');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
