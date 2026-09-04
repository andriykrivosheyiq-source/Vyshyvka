/* Оплата запускає виробництво.

   Доти після оплати не відбувалось нічого: менеджер сам згадував, що треба
   передати макет дизайнеру, сам рухав картку в «Оплачено», сам відкривав
   клієнту сторінку. Кожен із цих кроків можна забути — і забували, а
   помічали через три дні, коли клієнт питав «ну як там».

   Тепер гроші вмикають роботу. Одна дія менеджера — «записати оплату» — і
   картка стає в «Оплачено», заводяться треки, у списку «наступна дія»
   зʼявляється задача дизайнеру, а на сторінці клієнта відкривається вкладка
   «Замовлення».

   Перевіряємо:
     — запускає ПЕРША оплата, а не повна: передоплата і є те, з чого
       починають;
     — треки заводяться мовчки, без шести однакових рядків у стрічці;
     — задача дизайнеру складається з реального складу замовлення;
     — друга оплата нічого не запускає вдруге;
     — до оплати нічого з цього немає.

   Запуск:  node tests/pay-start.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8808;
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

const CONTENT = { sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };
/* Картка стоїть у «Чекаємо оплату» — саме там, де її й застає передоплата. */
const ORDER = {
  id:'1', orderId:'1000501', type:'client', name:'Оксана', phone:'+380670000501',
  status:'new', site:'main', payments:[], tasks:[],
  createdAt:new Date(Date.now() - 864e5).toISOString(), hist:[],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000 },
         { kind:'reco', name:'Кепка', color:'біла', garmentId:'cap',
           qty:10, unitPrice:200, price:2000, unitCost:120, cost:1200 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
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

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.click('.ticket:has-text("1000501")');
await p.waitForTimeout(1000);

console.log('═══ ДО ОПЛАТИ ═══');
const before = await p.evaluate(() => ({
  tracks: document.querySelectorAll('#orderDrawer .od-tracks').length,
  keys: Object.keys(orders[0].tracks || {}).length,
  tasks: (orders[0].tasks || []).length,
  status: orders[0].status
}));
ok(before.tracks === 0 && before.keys === 0 && before.tasks === 0,
  'поки грошей немає — немає ні треків, ні задач: працює продаж, не виробництво',
  'виробництво почалось без оплати: ' + JSON.stringify(before));

console.log('');
console.log('═══ ПЕРША ОПЛАТА ═══');
await p.click('#orderDrawer [data-fold="pay"]');
await p.waitForTimeout(400);
await p.fill('#orderDrawer .pay-in', '10000');
await p.selectOption('#orderDrawer .pay-kind', 'prepay');
await p.click('#orderDrawer .pay-go');
await p.waitForTimeout(900);
const after = await p.evaluate(() => {
  const o = orders[0];
  return {
    prodAt: !!o.prodAt,
    status: o.status,
    tracks: Object.assign({}, o.tracks),
    hist: (o.trackHist || []).length,
    task: (o.tasks || []).map(t => t.text + ' | ' + (t.due || '')),
    strip: document.querySelectorAll('#orderDrawer .od-tracks .od-trk').length,
    pay: (o.payments || []).length
  };
});
console.log('  статус: ' + after.status + ' · треки: ' + JSON.stringify(after.tracks));
console.log('  задача: ' + after.task.join(' / '));
ok(after.prodAt && after.pay === 1,
  'передоплата записана — і саме вона запустила виробництво',
  'виробництво не запустилось: ' + JSON.stringify(after));
ok(after.status === 'paid',
  'картка сама стала в «Оплачено» — руками її більше не тягнуть',
  'картка лишилась у ' + after.status);
ok(Object.keys(after.tracks).join() === 'design,supply,test,prod,qc,ship' &&
   after.tracks.design === 'new' && after.tracks.prod === 'lock',
  'усі шість треків заведені на своїх перших кроках',
  'треки заведені не так: ' + JSON.stringify(after.tracks));
ok(after.hist === 0,
  'у стрічку це не сиплеться шістьма однаковими рядками — подія одна',
  'треки нашуміли в історії: ' + after.hist + ' записів');
ok(after.strip === 6,
  'смуга стану зʼявилась у картці',
  'смуги стану немає: ' + after.strip);
ok(after.task.length === 1 && /^Передати макет дизайнеру: Футболка BASIC · чорна × 50/.test(after.task[0]),
  'задача дизайнеру складена з реального складу — не «зроби щось»',
  'задача не та: ' + JSON.stringify(after.task));
ok(!/Кепка/.test(after.task[0] || ''),
  'у задачі те, що виробляємо, а не рекомендації з КП',
  'у задачу потрапила рекомендація: ' + after.task[0]);

console.log('');
console.log('═══ У СТРІЧЦІ ОДИН РЯДОК ═══');
await p.click('#orderDrawer [data-fold="log"]');
await p.waitForTimeout(400);
const feed = await p.evaluate(() =>
  [...document.querySelectorAll('#orderDrawer .od-feed .od-fe')].map(x => x.textContent.replace(/\s+/g,' ').trim()));
feed.slice(0, 3).forEach(x => console.log('  │ ' + x));
ok(feed.filter(x => /Виробництво запущено/.test(x)).length === 1,
  'у стрічці рівно один рядок про запуск виробництва',
  'запуск виробництва в стрічці: ' + feed.filter(x => /Виробництво/.test(x)).length + ' разів');

console.log('');
console.log('═══ ДРУГА ОПЛАТА НІЧОГО НЕ ПОВТОРЮЄ ═══');
const wasAt = await p.evaluate(() => orders[0].prodAt);
await p.fill('#orderDrawer .pay-in', '15000');
await p.click('#orderDrawer .pay-go');
await p.waitForTimeout(900);
const twice = await p.evaluate(() => ({
  prodAt: orders[0].prodAt, tasks:(orders[0].tasks || []).length,
  pays:(orders[0].payments || []).length
}));
ok(twice.pays === 2 && twice.tasks === 1 && twice.prodAt === wasAt,
  'доплата — це просто гроші: задача дизайнеру не дублюється',
  'друга оплата запустила все вдруге: ' + JSON.stringify(twice));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'гроші вмикають роботу, а не чиюсь памʼять');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
