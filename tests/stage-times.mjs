/* Скільки часу де стоїть: етапи, люди, підрядники.

   Ставити строк «макет — 3 години» з голови не можна: половина замовлень
   червонітиме з першого дня, до червоного звикнуть і перестануть дивитись.
   Поріг має братись із власної статистики — і рахувати її нема чого
   заводити: кожен рух треку вже пишеться з часом і автором від самого
   початку.

   Головна величина не «скільки працювали», а СКІЛЬКИ ЧЕКАЛИ: простій між
   діями подовжує строк, не додаючи якості.

   ПО ЛЮДЯХ свідомо не міряємо швидкість. Якщо міряти швидкістю, її почнуть
   підганяти за рахунок якості — тест «готовий» без нормального фото,
   чекліст відмічений не дивлячись. Міряємо те, що людина справді
   контролює: повернення з правкою і позначений брак.

   Запуск:  node tests/stage-times.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8834;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const H = h => new Date(Date.now() - h * 36e5).toISOString();
const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' },
        { email:'des@loomiq',  name:'Дана',   role:'designer' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', days:7 },
             { id:'slow', name:'Повільний', days:3 }],
  products:{ supplier:{ tshirt:'tex', hoodie:'slow' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}],
               hoodie:[{size:'Розмір'},{size:'M'},{size:'L'}] }
};
/* Замовлення з відомою історією: 10 год на макет, 48 год у клієнта,
   потім тираж. Числа підібрані так, щоб їх можна було впізнати. */
const O1 = {
  id:'1', orderId:'1001501', name:'Оксана', phone:'+380670001501', status:'paid',
  createdAt:H(200), hist:[], prodAt:H(120), dueAt:'2026-12-01',
  payments:[{ at:H(120), sum:10000, kind:'prepay', by:'test@loomiq' }],
  totalPrice:30000, totalCost:18000,
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'work', qc:'wait', ship:'wait' },
  trackHist:[
    { t:'design', s:'work',   at:H(118), by:'des@loomiq' },   // 10 год у роботі
    { t:'design', s:'check',  at:H(108), by:'des@loomiq' },
    { t:'design', s:'fix',    at:H(106), by:'test@loomiq' },  // повернули з правкою
    { t:'design', s:'ok',     at:H(100), by:'test@loomiq' },
    { t:'test',   s:'client', at:H(96),  by:'test@loomiq' },  // 48 год у клієнта
    { t:'test',   s:'ok',     at:H(48),  by:'test@loomiq' },
    { t:'supply', s:'sent',   at:H(110), by:'test@loomiq' },
    { t:'supply', s:'got',    at:H(38),  by:'test@loomiq' },  // 3 дні від замовлення
    { t:'prod',   s:'ready',  at:H(36),  by:'' },
    { t:'prod',   s:'work',   at:H(30),  by:'test@loomiq' }
  ],
  blockHist:[{ why:'чекаємо логотип', at:H(119), until:H(115), hours:4 }],
  buy:{ lines:{ '0|S':{ ord:6, got:6 }, '0|M':{ ord:16, got:16 } }, orderedAt:H(110) },
  defects:[{ id:'d1', at:H(20), by:'test@loomiq', qty:2, sz:'M', reason:'crook',
             label:'Криво вишито', blame:'ours', route:'resew', fixed:false }],
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:20,
           unitPrice:500, sizeQty:{ S:5, M:15 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};
/* Друге замовлення в іншого підрядника: обіцяв 3 дні, віз 8. */
const O2 = {
  id:'2', orderId:'1001502', name:'Ігор', phone:'+380670001502', status:'paid',
  createdAt:H(400), hist:[], prodAt:H(300), dueAt:'2026-12-01',
  payments:[{ at:H(300), sum:5000, kind:'prepay', by:'test@loomiq' }],
  totalPrice:20000, totalCost:12000,
  tracks:{ design:'ok', supply:'got', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  trackHist:[
    { t:'supply', s:'sent', at:H(290), by:'test@loomiq' },
    { t:'supply', s:'got',  at:H(98),  by:'test@loomiq' }     // 8 діб
  ],
  buy:{ lines:{ '0|M':{ ord:11, got:11 }, '0|L':{ ord:11, got:9 } }, orderedAt:H(290) },
  items:[{ kind:'main', name:'Худі', color:'сіре', garmentId:'hoodie', qty:20,
           unitPrice:900, sizeQty:{ M:10, L:10 },
           prints:[{ side:'front', technique:'DTF', widthMm:200, heightMm:120 }] }]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([O1, O2]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ ЧАС РАХУЄТЬСЯ З ТОГО, ЩО ВЖЕ ЗАПИСАНО ═══');
const seg = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001501');
  return stageSegments(o).map(s => s.track + ':' + s.step + ' = ' + Math.round(s.hours) +
    ' год' + (s.wait ? ' [чекаємо]' : '')).sort();
});
seg.forEach(x => console.log('  ' + x));
ok(seg.some(x => /design:work = 10 год/.test(x)),
  'десять годин у роботі дизайнера пораховані з рухів треку',
  'відрізок макета не той: ' + seg.join(' | '));
ok(seg.some(x => /test:client = 48 год \[чекаємо\]/.test(x)),
  'дві доби в клієнта пораховані й позначені як чекання, а не робота',
  'відрізок тесту не той: ' + seg.join(' | '));

const t = await p.evaluate(() => orderTimes(orders.find(x => x.orderId === '1001501')));
console.log('  замовлення: у роботі ' + t.work + ' год, у чеканні ' + t.wait +
            ' год (з них заблоковано ' + t.blocked + '), разом ' + t.total);
/* Треки йдуть паралельно, тож сума по них може перевищити цикл. Міряти
   треба по календарю: година, у яку ми чекали двох одразу, це одна година. */
ok(t.work + t.wait === t.total,
  'робота й чекання складаються рівно в цикл — рахуємо по календарю, а не сумою треків',
  'числа не сходяться: ' + JSON.stringify(t));
ok(t.wait > 0 && t.work > 0,
  'видно і те, і те — інакше немає що порівнювати',
  'одне з двох порожнє: ' + JSON.stringify(t));
ok(t.blocked >= 4,
  'години блокування пораховані окремо — це чекання когось зовні',
  'блокування не враховане: ' + t.blocked);

console.log('');
console.log('═══ ЗВЕДЕННЯ ПО ЕТАПАХ ═══');
const d = await p.evaluate(() => {
  const s = deptStats();
  return { n:s.n, work:Math.round(s.work), wait:Math.round(s.wait),
           top:s.steps.slice(0, 3).map(x => x.key + ':' + Math.round(x.avg)) };
});
console.log('  замовлень ' + d.n + ' · середнє: робота ' + d.work + ' год, чекання ' + d.wait + ' год');
console.log('  найдовші етапи: ' + d.top.join(' · '));
ok(d.n === 2 && d.top.length === 3,
  'зведення збирається по всіх запущених замовленнях',
  'зведення порожнє: ' + JSON.stringify(d));
ok(/supply:sent/.test(d.top[0]),
  'найдовший етап — очікування одягу, і він угорі списку',
  'порядок етапів не той: ' + d.top.join(' · '));

console.log('');
console.log('═══ ПО ЛЮДЯХ — НЕ ШВИДКІСТЬ ═══');
const ppl = await p.evaluate(() => {
  const P = deptStats().people;
  return Object.keys(P).map(k => k + ': рухів ' + P[k].moves +
    ', повернень ' + P[k].returns + ', браку ' + P[k].defects);
});
ppl.forEach(x => console.log('  ' + x));
ok(ppl.some(x => /test@loomiq/.test(x) && /повернень 1/.test(x)),
  'повернення з правкою пораховане — це те, що людина справді контролює',
  'повернень не видно: ' + ppl.join(' | '));
ok(ppl.some(x => /браку 2/.test(x)),
  'позначений брак теж рахується по людині',
  'браку по людині не видно: ' + ppl.join(' | '));

console.log('');
console.log('═══ ПІДРЯДНИК: ОБІЦЯВ І ПРИВІЗ ═══');
const sup = await p.evaluate(() => {
  const s = supStats();
  return Object.keys(s).map(k => ({ k, name:s[k].name, promised:s[k].promised,
    fact: s[k].fact == null ? null : Math.round(s[k].fact * 10) / 10,
    late: s[k].late == null ? null : Math.round(s[k].late * 10) / 10,
    short: s[k].short }));
});
sup.forEach(s => console.log('  ' + s.name + ': обіцяв ' + s.promised +
  ' дн, віз ' + s.fact + ' дн, різниця ' + s.late + ', недовіз ' + s.short));
const slow = sup.filter(s => s.k === 'slow')[0];
const fast = sup.filter(s => s.k === 'tex')[0];
ok(slow && slow.late > 4,
  'підрядник, який обіцяв 3 дні, а віз 8, видно числом, а не відчуттям',
  'запізнення не пораховане: ' + JSON.stringify(slow));
ok(fast && fast.late != null && fast.late < 1,
  'той, хто вклався, теж видно — інакше порівнювати нема з чим',
  'швидкий підрядник не порахований: ' + JSON.stringify(fast));
/* Прислали 11 M замість 10 і 9 L замість 10 — у сумі рівно двадцять, а
   недовіз є. Саме так він і ховався від нас досі. */
ok(slow && slow.short === 1,
  'недовіз рахується по рядках, а не підсумком — інакше він ховається',
  'недовіз не порахований: ' + JSON.stringify(slow));

console.log('');
console.log('═══ ЧИСЛА ВИДНО В АНАЛІТИЦІ ═══');
await p.click('.nav button[data-view="analytics"]');
await p.waitForTimeout(2500);
const shown = await p.evaluate(() => {
  const b = document.querySelector('#an-block button[data-b="sales"]');
  if(b) b.click();
  return new Promise(r => setTimeout(() => r({
    stages: (document.getElementById('an-stages') || {}).textContent || '',
    people: (document.getElementById('an-people') || {}).textContent || ''
  }), 900));
});
ok(/чекан/i.test(shown.stages) && /цикл замовлення/i.test(shown.stages),
  'у звіті видно цикл і скільки з нього — чекання',
  'блок часу порожній: ' + shown.stages.slice(0, 80));
ok(/Повільний/.test(shown.people) && /Дана|Андрій/.test(shown.people),
  'люди й підрядники теж у звіті',
  'блок людей порожній: ' + shown.people.slice(0, 80));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'видно, де згорає час — і це виміряно, а не вигадано');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
