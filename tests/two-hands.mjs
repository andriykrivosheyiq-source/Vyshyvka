/* Двоє менеджерів в одній CRM: чуже не має стирати мого.

   ЧОМУ ЦЕ НАЙНЕБЕЗПЕЧНІШЕ МІСЦЕ. Замовлення живе одним документом, і
   дошка слухає базу живим знімком. Знімок приходить від будь-якої зміни:
   сусід посунув ЧУЖУ картку, фоновий обхід записав лічильник реплік,
   спрацював автозапис. Обробник робив `orders = список` — заміняв увесь
   масив тим, що приїхало, — і все, що лежало в памʼяті незбереженим,
   зникало разом зі старим масивом: склад пропозиції, який щойно правили,
   повернутий логотип, вписаний тираж.

   Найгірше, що воно не падало. Правки просто відкочувались на екрані, і
   збоку це виглядало як «адмінка сама скидає, що я роблю».

   ЩО ТУТ ПЕРЕВІРЯЄТЬСЯ:
     • картку з незбереженими правками знімок не чіпає;
     • сусідні картки при цьому оновлюються, як і мають;
     • щойно створена картка, якої в базі ще немає, не зникає;
     • коли ту саму картку тим часом змінив хтось інший — про це кажуть
       вголос, бо наш запис піде цілим документом і чуже затре;
     • і присутність: «цю картку зараз править Оксана» видно до того, як
       почав, а не після.

   Запуск:  node tests/two-hands.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8888;
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

const замов = (id, num, name) => ({
  id, orderId:num, type:'client', name, status:'kp', site:'main', payments:[], hist:[],
  createdAt:'2026-09-2' + id + 'T09:00:00.000Z', totalPrice:1000, totalCost:500,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tee',
           qty:10, unitPrice:100, price:1000, unitCost:50, cost:500 }]
});
const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }] };
const ORDERS = [замов('1', '1000101', 'Марта'), замов('2', '1000102', 'Оксана')];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n' +
  '  window.__SNAP=null;\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
/* Колекція замовлень із КЕРОВАНИМ знімком: тест сам вирішує, коли база
   «озвалась» і що саме в ній лежить. Саме так і поводиться чужа вкладка.

   Знімок віддає КОПІЮ. Інакше додаток дістає ті самі обʼєкти, що лежать у
   нашому «сховищі», правит їх у себе — і сховище тихо переймає його
   правки. Виходить база, яка знає те, чого їй знати не належить, і будь-яка
   перевірка розходжень перетворюється на самообман. */
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){\n' +
  '    window.__SNAP=function(src){ var list=JSON.parse(JSON.stringify(src)); try{ cb({\n' +
  '      docs:list.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ list.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!list.length }); }catch(e){ console.error(e); } };\n' +
  '    window.__SNAP(window.__ORDERS);\n    return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ ЧУЖИЙ ЗНІМОК НЕ ЗНИЩУЄ НЕДОПИСАНОГО ═══');
const мої = await p.evaluate(async () => {
  /* Менеджер ТРИМАЄ першу картку відкритою й вписав тираж, ще не зберігши. */
  const своя = orders.find(x => x.id === '1');
  await openOrderDrawer(своя);
  await new Promise(r => setTimeout(r, 300));
  /* Знімок беремо ДО локальної правки: у житті база не знає, що менеджер
     щойно вписав, і зліпок із уже внесеною правкою вдавав би розходження,
     якого немає. */
  const база = JSON.parse(JSON.stringify(window.__ORDERS));
  база[1].name = 'Оксана Ковальчук';
  своя.items[0].qty = 44;
  своя.name = 'Марта Паращук';
  window.__SNAP(база);
  await new Promise(r => setTimeout(r, 120));
  const перша = orders.find(x => x.id === '1');
  const друга = orders.find(x => x.id === '2');
  return { тираж: перша && перша.items[0].qty, імʼя: перша && перша.name,
           сусід: друга && друга.name, той: перша === своя, скільки: orders.length };
});
console.log('   у своїй картці: ' + мої.тираж + ' шт · «' + мої.імʼя + '»' +
            '   у сусідній: «' + мої.сусід + '»');
ok(мої.тираж === 44 && мої.імʼя === 'Марта Паращук',
  'незбережені правки пережили чужий знімок — саме тут вони й зникали',
  'правки відкотились: ' + JSON.stringify(мої));
ok(мої.той,
  'і це той самий обʼєкт, а не його копія — посилання з редактора лишились живими',
  'картку підмінили копією: усе, що тримає на неї посилання, дивиться в порожнечу');
ok(мої.сусід === 'Оксана Ковальчук',
  'а сусідня картка оновилась, як і має: своє бережемо, чуже приймаємо',
  'чужа зміна не доїхала: «' + мої.сусід + '»');

console.log('');
console.log('═══ ЩОЙНО СТВОРЕНА КАРТКА НЕ ЗНИКАЄ ═══');
const нова = await p.evaluate(async () => {
  orders.push({ id:'9', orderId:'1000109', name:'Новий', status:'new', items:[],
                createdAt:'2026-09-29T09:00:00.000Z', payments:[], hist:[] });
  window.__SNAP(JSON.parse(JSON.stringify(window.__ORDERS)));   // у базі її ще немає
  await new Promise(r => setTimeout(r, 120));
  return { є: !!orders.find(x => x.id === '9') };
});
ok(нова.є,
  'картка, якої в базі ще немає, переживає знімок — інакше вона зникала б у мить створення',
  'щойно створена картка зникла з першим же знімком');

console.log('');
console.log('═══ ТУ САМУ КАРТКУ ЗМІНИЛИ ДВОЄ — ПРО ЦЕ КАЖУТЬ ═══');
const спір = await p.evaluate(async () => {
  const слова = [];
  const був = window.toast;
  window.toast = (t) => { слова.push(String(t || '')); };
  /* У нас незбережене в першій картці — і та сама картка змінилась у базі. */
  const база = JSON.parse(JSON.stringify(window.__ORDERS));
  база[0].status = 'prod';
  база[0].name = 'Марта (правив сусід)';
  window.__SNAP(база);
  await new Promise(r => setTimeout(r, 150));
  /* Другий такий самий знімок підряд не має повторювати попередження. */
  window.__SNAP(база);
  await new Promise(r => setTimeout(r, 150));
  window.toast = був;
  const перша = orders.find(x => x.id === '1');
  return { слова, тираж: перша && перша.items[0].qty,
         };
});
console.log('   сказали: ' + JSON.stringify(спір.слова));
ok(спір.слова.some(t => /1000101/.test(t)),
  'попередження називає саме ту картку, за яку сперечаються',
  'про розходження не сказали нічого: ' + JSON.stringify(спір.слова));
ok(спір.слова.filter(t => /1000101/.test(t)).length === 1,
  'і каже це один раз, а не на кожен знімок — попередження, від якого відмахуються, гірше за жодне',
  'попередження повторюється щознімка: ' + JSON.stringify(спір.слова));
ok(спір.тираж === 44,
  'а правки все одно лишились на екрані: рішення за людиною, не за нами',
  'правки таки зникли при розходженні');

console.log('');
console.log('═══ «ЦЮ КАРТКУ ЗАРАЗ ПРАВИТЬ ОКСАНА» ═══');
const разом = await p.evaluate(async () => {
  const o = orders.find(x => x.id === '2');
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const без = !!document.querySelector('.od-together');
  /* Чужа мітка, свіжа. */
  presenceMap = { '2': { by:'oksana@loomiq', t:new Date().toISOString() } };
  renderOrderDrawer();
  await new Promise(r => setTimeout(r, 150));
  const смуга = document.querySelector('.od-together');
  const зі = смуга ? смуга.textContent.replace(/\s+/g, ' ').trim() : '';
  /* Стара мітка — людина давно пішла. */
  presenceMap = { '2': { by:'oksana@loomiq', t:new Date(Date.now() - 5 * 60000).toISOString() } };
  renderOrderDrawer();
  await new Promise(r => setTimeout(r, 150));
  const стара = !!document.querySelector('.od-together');
  /* І власна мітка — сам себе попереджати безглуздо. */
  presenceMap = { '2': { by: myName(), t:new Date().toISOString() } };
  renderOrderDrawer();
  await new Promise(r => setTimeout(r, 150));
  const своя = !!document.querySelector('.od-together');
  presenceMap = {};
  return { без, зі, стара, своя };
});
console.log('   ' + спір.слова.length + ' попереджень · смуга: «' + разом.зі + '»');
ok(!разом.без && /oksana/i.test(разом.зі),
  'чужа свіжа мітка — і в шапці картки стоїть, хто саме в ній сидить',
  'присутності не видно: «' + разом.зі + '»');
ok(!разом.стара,
  'мітка пʼятихвилинної давності не рахується — людина давно пішла',
  'показуємо як присутнього того, кого вже немає');
ok(!разом.своя,
  'і сам себе система присутнім не оголошує',
  'попереджає менеджера про нього ж самого');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'двоє в одній CRM не стирають одне одного');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
