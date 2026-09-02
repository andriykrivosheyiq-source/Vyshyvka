/* Продажна воронка не дає загубити угоду.

   Колонка тут каже, ЧИЙ ЗАРАЗ ХІД. Це правило й не пускає у воронку
   колонку «Думає»: «думає» — не хід, а наша здогадка про чужу голову. Така
   колонка завжди стає кладовищем, куди їде все, що шкода визнати мертвим,
   — і картка в ній перестає муляти око, хоч саме цього від неї й треба.

   Тому «клієнт мовчить» живе не на дошці, а на КАРТЦІ, трьома способами:

     — скільки вона стоїть в етапі, з кольором: жовтіє, коли час нагадати,
       червоніє, коли її забули. Строки різні, бо й етапи різні: на
       звернення відповідають того ж дня, а КП клієнт має право думати
       тиждень;
     — наступна дія з датою (вона в адмінці вже була);
     — «нагадати пізніше» — для домовленості «повернемось у листопаді»:
       коментар (про що саме) плюс дата. Картка йде з дошки й повертається
       сама, на ТОЙ САМИЙ етап: етап не змінився, змінилась лише наша увага.
       Коментар обовʼязковий — картка з датою, але без причини повертається
       німою, і менеджер знову вигадує, навіщо він сюди зайшов.

   І причина відмови: без неї через півроку на питання «чому ми програємо»
   відповіді не буде.

   Запуск:  node tests/sales.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8796;
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

const D = n => { const x = new Date(); x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10) + 'T12:00:00.000Z'; };
const dayAhead = n => { const x = new Date(); x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10); };
const mk = (id, status, hist, extra) => Object.assign({
  id:String(id), orderId:'100000' + id, name:'Клієнт ' + id, phone:'+3806700000' + id,
  status, type:'client', createdAt:D(20), totalPrice:20000, totalCost:12000,
  margin:8000, marginPct:40, site:'main', items:[], payments:[],
  hist:[{ s:status, at:hist }] }, extra || {});
/* Строки: звернення 1 день, прорахунок 2, КП 7, чекаємо оплату 5.
   Жовтіє на строку, червоніє на подвійному. */
const SEED = [
  mk(1, 'lead', D(0)),                       // сьогодні — норма
  mk(2, 'lead', D(3)),                       // 3 дні при строку 1 — червоне
  mk(3, 'kp',   D(4)),                       // 4 дні при строку 7 — норма
  mk(4, 'kp',   D(9)),                       // 9 днів — жовте
  mk(5, 'new',  D(12)),                      // 12 днів при строку 5 — червоне
  mk(6, 'kp',   D(30), { snoozeUntil: dayAhead(20) })   // відкладена
];

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
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
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
await p.waitForTimeout(1500);

const cols = await p.evaluate(() =>
  [...document.querySelectorAll('[data-status]')].map(x => x.getAttribute('data-status')));
console.log('═══ ВОРОНКА ═══');
console.log('  ' + cols.join(' → '));
console.log('');
/* «Думає» серед колонок бути не має — це головне, що стереже тест. */
const labels = await p.evaluate(() =>
  [...document.querySelectorAll('[data-status]')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
ok(cols.indexOf('kp') > cols.indexOf('prorahunok') && cols.indexOf('kp') < cols.indexOf('new'),
  '«КП надіслано» стоїть між «Прорахунком» і «Чекаємо оплату»',
  'порядок етапів не той: ' + cols.join(' → '));
ok(!labels.some(l => /дума/i.test(l)),
  'колонки «Думає» у воронці немає — мовчання живе на картці, а не на дошці',
  'зʼявилась колонка про «думає»: ' + labels.join(' | '));
ok(labels.some(l => /Чекаємо оплату/i.test(l)) && !labels.some(l => /Нове замовлення/i.test(l)),
  '«Нове замовлення» перейменовано на «Чекаємо оплату» — колонка каже, чий хід',
  'назви колонок: ' + labels.join(' | '));

console.log('');
console.log('═══ СКІЛЬКИ СТОЇТЬ У ЕТАПІ ═══');
const age = await p.evaluate(() => {
  const out = {};
  document.querySelectorAll('.ticket').forEach(t => {
    const id = (t.querySelector('.t-oid') || {}).textContent || '?';
    const a = t.querySelector('.tc-age');
    out[id.trim()] = a
      ? { t:a.textContent.trim(), heat:(a.className.replace('tc-age', '').trim() || 'норма') }
      : null;
  });
  return out;
});
Object.keys(age).forEach(k => console.log('  ' + k + ': ' +
  (age[k] ? age[k].t + ' · ' + age[k].heat : '—')));
console.log('');
ok(age['1000001'] && age['1000001'].heat === 'норма',
  'свіжа картка мовчить', 'свіжа картка вже підсвічена: ' + JSON.stringify(age['1000001']));
ok(age['1000002'] && age['1000002'].heat === 'bad',
  'звернення без відповіді 3 дні — червоне (строк 1 день)',
  'звернення не підсвічено: ' + JSON.stringify(age['1000002']));
ok(age['1000003'] && age['1000003'].heat === 'норма',
  'КП чотири дні — це нормально, клієнт має право подумати',
  'КП підсвічено зарано: ' + JSON.stringify(age['1000003']));
ok(age['1000004'] && age['1000004'].heat === 'warn',
  'КП девʼять днів — жовте, час нагадати',
  'КП не пожовтіло: ' + JSON.stringify(age['1000004']));
ok(age['1000005'] && age['1000005'].heat === 'bad',
  'чекаємо оплату 12 днів — червоне',
  'не червоніє: ' + JSON.stringify(age['1000005']));
/* Строки різні для різних етапів — інакше або звернення висить добу без
   попередження, або КП червоніє на другий день і колір перестають помічати. */
ok(age['1000002'].heat === 'bad' && age['1000003'].heat === 'норма',
  'у кожного етапу свій строк: 3 дні для звернення гірше, ніж 4 дні для КП',
  'строк однаковий для всіх етапів — колір втрачає сенс');

console.log('');
console.log('═══ ВІДКЛАДЕНІ ═══');
const onBoard = () => p.evaluate(() => document.querySelectorAll('.ticket').length);
const n0 = await onBoard();
console.log('  карток на дошці: ' + n0 + ' із ' + SEED.length);
ok(n0 === SEED.length - 1,
  'відкладена картка з дошки зникла — у воронці лише те, з чим працюють',
  'відкладена картка лишилась на дошці: ' + n0 + ' із ' + SEED.length);

await p.click('.ticket');
await p.waitForTimeout(1200);
const deal = () => p.evaluate(() => {
  const el = document.querySelector('.od-deal');
  return el ? { t:el.textContent.replace(/\s+/g, ' ').trim(), cls:el.className } : null;
});
console.log('  картка: ' + JSON.stringify((await deal()).t.slice(0, 80)));
/* Відповіді на prompt заготовляємо чергою: у нагадування їх два підряд —
   спершу коментар, потім дата. */
let ANS = [];
p.on('dialog', d => d.accept(ANS.length ? ANS.shift() : ''));

/* Дата без коментаря — це загублена картка з відстрочкою: через місяць
   ніхто не згадає, про що була домовленість, і нагадування спрацює в
   порожнечу. Тому порожній коментар не приймається. */
ANS = [''];
await p.click('[data-remind]');
await p.waitForTimeout(1200);
ok((await onBoard()) === n0 && !/Відкладено до/.test((await deal()).t),
  'нагадування без коментаря не записується — дата без причини нічого не варта',
  'картку відклали з порожнім коментарем');

const TILL = dayAhead(9);
ANS = ['передзвонити після затвердження бюджету', TILL];
await p.click('[data-remind]');
await p.waitForTimeout(1500);
const n1 = await onBoard();
const d1 = await deal();
const next = await p.evaluate(() => {
  const el = document.querySelector('.od-next .on-text');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
});
console.log('  наступна дія: ' + JSON.stringify(next));
ok(n1 === n0 - 1 && /Відкладено до/.test(d1.t),
  'нагадали на дату — картка пішла з дошки до неї',
  'відкладення не спрацювало: карток ' + n1 + ', картка: ' + d1.t.slice(0, 80));
/* Коментар лягає в «наступну дію», а не тільки в дату відкладення: інакше
   картка повернеться німою — з датою, але без причини. */
ok(/бюджет/i.test(next),
  'коментар став наступною дією — картка повернеться з причиною, а не німою',
  'коментаря немає в наступній дії: ' + JSON.stringify(next));
await p.click('[data-snooze=""]');
await p.waitForTimeout(1300);
ok((await onBoard()) === n0,
  'повернули — картка на місці, на тому самому етапі',
  'картка не повернулась');

console.log('');
console.log('═══ ПРИЧИНА ВІДМОВИ ═══');
ANS = ['2'];                             // «знайшли дешевше»
await p.click('[data-lost]');
await p.waitForTimeout(1500);
const d2 = await deal();
console.log('  ' + d2.t.slice(0, 100));
ok(/Відмова/.test(d2.t) && /знайшли дешевше/.test(d2.t),
  'відмова записана разом із причиною',
  'причину не збережено: ' + d2.t.slice(0, 120));

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'воронка каже, чий хід, і жодна картка не може тихо загубитись');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
