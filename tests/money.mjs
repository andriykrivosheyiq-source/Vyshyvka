/* Гроші в аналітиці — це гроші, а не сподівання.

   Доти виручкою вважалась ціна ВСІХ карток, створених за період: разом із
   прорахунками, на які ніхто не відповів, і навіть із відмовами. Оплати на
   сайті немає — клієнт платить після розмови з менеджером, — тож більшість
   тих карток ніколи не ставала грішми. Власник дивився на число, якого не
   існувало.

   Тепер правило одне: гроші рахуються від дня, коли картку перенесли в
   «Оплачено». Відмова після оплати йде мінусом на день відмови, а не заднім
   числом: місяць, який уже комусь показали, мінятись не має.

   Тест підкладає сім карток у всіх станах, які бувають у житті, і звіряє
   кожне число звіту з порахованим на папері.

   Запуск:  node tests/money.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8798;
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
const num = s => s ? +String(s).replace(/[^\d-]/g, '') : 0;

/* Дні відлічуємо від сьогодні: звіт бере останні 30 діб, і фіксовані дати
   через місяць випали б із періоду разом із тестом. */
const D = n => { const x = new Date(); x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10) + 'T12:00:00.000Z'; };
const mk = (id, status, price, cost, extra) => Object.assign({
  id:String(id), name:'Клієнт ' + id, phone:'+3806700000' + id, status,
  createdAt:D(5), totalPrice:price, totalCost:cost, margin:price - cost,
  site:'main', items:[], hist:[], payments:[] }, extra || {});
/* Сім станів, які бувають у житті. Числа підібрані так, щоб кожну помилку
   було видно: сума не зійдеться рівно на ту картку, яку порахували не так. */
const SEED = [
  mk(1, 'prorahunok', 50000, 30000),                       // порахували, тиша
  mk(2, 'new',        40000, 25000),                       // підтвердив КП, не заплатив
  mk(3, 'paid',       30000, 18000, { hist:[{s:'paid', at:D(3)}],
    payments:[{ sum:15000, at:D(3) }, { sum:15000, at:D(2) }] }),   // оплачене повністю
  mk(4, 'production', 20000, 12000, { hist:[{s:'paid', at:D(4)}] }),// оплачене, платіж не внесли
  mk(5, 'done',       60000, 35000, { hist:[{s:'paid', at:D(1)}],
    payments:[{ sum:30000, at:D(1) }] }),                  // передоплата 50%
  mk(6, 'cancel',     10000,  6000, { hist:[{s:'paid', at:D(6)}, {s:'cancel', at:D(2)}] }),
  mk(7, 'cancel',     90000, 50000)                        // відмова без оплати
];
/* Порахуємо на папері, щоб було з чим звіряти:
     виручка = 30 000 + 20 000 + 60 000 − 10 000 (відмова після оплати) = 100 000
     собівартість = 18 000 + 12 000 + 35 000 − 6 000 = 59 000
     гроші = 15 000 + 15 000 + 30 000 = 60 000
     винні = 20 000 (#4) + 30 000 (#5) = 50 000
     потенційні = 50 000 (#1) + 40 000 (#2) = 90 000                       */
const WANT = { revenue:100000, cost:59000, margin:41000, cash:60000,
               due:50000, pot:90000, paidN:3, orders:7 };

/* Замовлення кладемо туди, звідки адмінка їх і читає, — у колекцію
   kanbanOrders. Так вони проходять увесь звичайний шлях, а не підставляються
   в обхід коду. */
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__SEED=' + JSON.stringify(SEED) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__SEED.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__SEED.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  '      return n===\'kanbanOrders\' ? new SeedCol() : new Col(); },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1280, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
await p.click('[data-view="analytics"]');
await p.waitForTimeout(2500);
await p.click('#an-period [data-d="30"]');
await p.waitForTimeout(2500);
await p.click('#an-block [data-b="money"]');
await p.waitForTimeout(1200);

const read = () => p.evaluate(() => {
  const k = {};
  document.querySelectorAll('#an-pnl .an-kpi').forEach(el => {
    const t = (el.querySelector('.k') || {}).textContent || '';
    const v = (el.querySelector('.v') || {}).textContent || '';
    k[t.trim()] = v.trim();
  });
  return { kpi:k,
    тривога: (document.getElementById('an-money-alerts') || {}).textContent || '',
    рядків: document.querySelectorAll('#an-cash-list tbody tr').length };
});
const M = await read();
console.log('═══ ПРИБУТОК І ГРОШІ ═══');
Object.keys(M.kpi).forEach(k => console.log('  ' + k + ': ' + M.kpi[k]));
console.log('');

ok(num(M.kpi['Виручка']) === WANT.revenue,
  'виручка тільки з оплачених: ' + WANT.revenue + ' грн',
  'виручка ' + num(M.kpi['Виручка']) + ' замість ' + WANT.revenue +
    ' — у неї потрапили прорахунки або відмови');
ok(num(M.kpi['Собівартість']) === WANT.cost,
  'собівартість за тими самими замовленнями: ' + WANT.cost + ' грн',
  'собівартість ' + num(M.kpi['Собівартість']) + ' замість ' + WANT.cost);
ok(num(M.kpi['Валова маржа']) === WANT.margin,
  'маржа: ' + WANT.margin + ' грн', 'маржа ' + num(M.kpi['Валова маржа']));
ok(num(M.kpi['Гроші за період']) === WANT.cash,
  'гроші — рівно те, що зайшло за журналом оплат: ' + WANT.cash + ' грн',
  'гроші ' + num(M.kpi['Гроші за період']) + ' замість ' + WANT.cash);
ok(num(M.kpi['Вам винні']) === WANT.due,
  'борг клієнтів: ' + WANT.due + ' грн', 'борг ' + num(M.kpi['Вам винні']));
ok(num(M.kpi['Потенційні']) === WANT.pot,
  'потенційні стоять окремо й у гроші не входять: ' + WANT.pot + ' грн',
  'потенційні ' + num(M.kpi['Потенційні']) + ' замість ' + WANT.pot);
/* Найважливіша перевірка: відмова після оплати мусить бути ВІДНЯТА, а не
   просто пропущена. Пропустити її означало б лишити гроші, яких повернули. */
ok(num(M.kpi['Виручка']) < 110000,
  'відмова після оплати віднята з виручки на день відмови',
  'відмова не віднята: виручка ' + num(M.kpi['Виручка']) + ' — це 110 000 без мінуса');
/* Звірка: картку перенесли в «Оплачено», платіж не внесли. Звіт має сам про
   це сказати, інакше його доводиться перевіряти вручну. */
ok(/без жодного запису про оплату/.test(M.тривога) && /20\s*000/.test(M.тривога),
  'звіт сам показує картку в «Оплачено» без внесеного платежу',
  'звірки немає: ' + JSON.stringify(M.тривога.slice(0, 120)));

console.log('');
console.log('═══ ГОЛОВНЕ ═══');
await p.click('#an-block [data-b="main"]');
await p.waitForTimeout(900);
const G = await p.evaluate(() => {
  const k = {};
  document.querySelectorAll('#an-kpis .an-kpi').forEach(el => {
    const t = (el.querySelector('.k') || {}).textContent || '';
    const v = (el.querySelector('.v') || {}).textContent || '';
    k[t.trim()] = v.trim();
  });
  return k;
});
['Замовлення','Оплачено','Виручка','Гроші за період','Середній чек','Потенційні']
  .forEach(k => console.log('  ' + k + ': ' + (G[k] || '—')));
console.log('');
/* Лічильник замовлень лишається за ВСІМА створеними: це воронка, і
   конверсія «візит → замовлення» без нього не має сенсу. А гроші поруч —
   уже тільки оплачені. */
ok(num(G['Замовлення']) === WANT.orders,
  'замовлення рахуються всі — це воронка, а не гроші: ' + WANT.orders,
  'замовлень ' + num(G['Замовлення']) + ' замість ' + WANT.orders);
ok(num(G['Оплачено']) === WANT.paidN,
  'з них оплачено: ' + WANT.paidN, 'оплачених ' + num(G['Оплачено']));
ok(num(G['Виручка']) === WANT.revenue,
  'виручка в «Головному» така сама, як у звіті про прибуток',
  'дві сторінки звіту показують різну виручку: ' + num(G['Виручка']) +
    ' проти ' + WANT.revenue);
ok(num(G['Середній чек']) === Math.round(WANT.revenue / WANT.paidN),
  'середній чек рахується по оплачених: ' + Math.round(WANT.revenue / WANT.paidN) + ' грн',
  'середній чек ' + num(G['Середній чек']));

console.log('');
console.log('═══ КАНАЛИ ═══');
const ch = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('#an-channels tr')];
  const tot = rows.filter(r => /Разом/.test(r.textContent))[0];
  return tot ? [...tot.children].map(c => c.textContent.trim()) : [];
});
console.log('  ' + JSON.stringify(ch));
/* Таблиця каналів рахує гроші за тим самим правилом. Доти вона брала
   замовлення, створені за період, і показувала іншу виручку — дві таблиці
   в одному звіті не сходились. */
ok(ch.some(c => num(c) === WANT.revenue),
  'канали дають ту саму виручку, що й звіт: ' + WANT.revenue + ' грн',
  'канали рахують інакше: ' + JSON.stringify(ch));

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'у виручці тільки оплачені замовлення, і всі таблиці звіту сходяться');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
