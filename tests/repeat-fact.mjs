/* Повтор замовлення й факт проти плану.

   ПОВТОР. Найдешевші гроші, які ми не беремо. Клієнт повертається через
   півроку за тими самими футболками — і проходить весь цикл заново:
   дизайнер, тест, погодження, три дні. А макет уже погоджено: версія лежить
   у першому замовленні з файлами й фото. Тому нова картка успадковує її, і
   ворота тиражу не вимагають ні дизайну, ні тесту.

   Але виняток має бути ВИДИМИЙ: змінився виріб — потрібен новий тест.
   Мовчазний пропуск етапів рано чи пізно означає 50 худі за макетом від
   футболки.

   ФАКТ. Планову собівартість ми знаємо ще в КП, фактичну — не знали ніколи.
   Факт має збиратись сам із того, що вже й так відбувається: закупівля,
   брак, версії макета, накладна. Таблиця, яку треба заповнювати руками, не
   заповнюється ніколи.

   Запуск:  node tests/repeat-fact.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8831;
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

const now = new Date().toISOString();
const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', days:7 }],
  products:{ supplier:{ tshirt:'tex' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] },
  orderSeq:1001200
};
/* Замовлення закрите, макет погоджений клієнтом — з такого й повторюють. */
const DONE = {
  id:'1', orderId:'1001201', type:'client', name:'Оксана', phone:'+380670001201',
  company:'Grand Cafe', status:'done', site:'main', createdAt:now, hist:[], prodAt:now,
  dueAt:'2026-10-01', ttn:'20450000000001',
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'done', qc:'ok', ship:'sent' },
  art:[
    { n:1, at:now, by:'d@loomiq', files:[], wilcom:'', photo:'', approvals:{},
      back:{ reason:'big', label:'Завеликий', route:'design', at:now } },
    { n:2, at:now, by:'d@loomiq',
      files:[{ kind:'front', name:'1001201_front_v2', url:'https://x/f.dst' }],
      wilcom:'https://x/w.png', photo:'https://x/t.jpg',
      approvals:{ art:{ by:'a@loomiq', at:now }, inner:{ by:'a@loomiq', at:now },
                  client:{ by:'a@loomiq', at:now, note:'переписка в Telegram' } } }],
  payments:[{ at:now, sum:25000, kind:'prepay', by:'a@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  buy:{ lines:{ '0|S':{ ord:6, got:6 }, '0|M':{ ord:16, got:16 }, '0|L':{ ord:21, got:21 } },
        orderedAt:now, extra:{ '0|L':4 } },
  defects:[{ id:'d1', at:now, by:'test@loomiq', qty:3, sz:'M', reason:'crook',
             label:'Криво вишито', blame:'ours', route:'resew', fixed:true }],
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt', qty:50,
           unitPrice:500, price:25000, unitCost:300, cost:15000, sizeQty:{ S:5, M:15, L:30 },
           prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка',
                     widthMm:80, heightMm:45 }] }]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([DONE]) + ';\n' +
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

console.log('═══ ПОВТОР ЗАБИРАЄ ПОГОДЖЕНУ ВЕРСІЮ ═══');
const rep = await p.evaluate(async () => {
  const src = orders.find(x => x.orderId === '1001201');
  const canBefore = canRepeat(src);
  await repeatOrder(src);
  const n = orders.find(x => x.repeatOf === '1001201');
  const v = n && artCur(n);
  return { canBefore, id:n && n.orderId, name:n && n.name, phone:n && n.phone,
           items:(n && n.items || []).length,
           price:n && n.totalPrice, verN:v && v.n, from:v && v.from,
           files:((v && v.files) || []).length, photo:!!(v && v.photo),
           client:!!((v && v.approvals || {}).client),
           vers:(n && n.art || []).length };
});
console.log('  нова картка ' + rep.id + ' · версія v' + rep.verN +
            ' з ' + JSON.stringify(rep.from));
ok(rep.canBefore, 'повторювати можна: у джерела є погоджена клієнтом версія',
  'повтор не запропонували');
ok(rep.id && rep.id !== '1001201' && rep.name === 'Оксана' && rep.phone === '+380670001201',
  'нова картка зі своїм номером і тим самим клієнтом',
  'картка не та: ' + JSON.stringify(rep));
ok(rep.vers === 1 && rep.verN === 1 && rep.files === 1 && rep.photo && rep.client,
  'успадкована рівно одна версія — погоджена, з файлами й фото',
  'версія не успадкувалась: ' + JSON.stringify(rep));
ok(rep.from && rep.from.orderId === '1001201' && rep.from.n === 2,
  'і вона підписана, звідки взялась — через рік це перше питання',
  'підпису походження немає: ' + JSON.stringify(rep.from));
ok(rep.price === 0,
  'стара сума не перенеслась — вона застаріла й вводила б в оману',
  'перенеслась стара ціна: ' + rep.price);

console.log('');
console.log('═══ ВОРОТА НЕ ВИМАГАЮТЬ НІ ДИЗАЙНУ, НІ ТЕСТУ ═══');
const gates = await p.evaluate(async () => {
  const n = orders.find(x => x.repeatOf === '1001201');
  n.payments = [{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'a@loomiq' }];
  n.prodAt = new Date().toISOString();
  n.buy = { lines:{ '0|S':{ ord:6, got:5 }, '0|M':{ ord:16, got:15 }, '0|L':{ ord:31, got:30 } } };
  return prodGates(n).map(x => (x.ok ? '✓ ' : '○ ') + x.label + ' — ' + x.note);
});
gates.forEach(x => console.log('  ' + x));
ok(gates.filter(x => x[0] === '✓').length === 5,
  'усі пʼять умов закриті одразу: лишалось закупити одяг і пошити',
  'ворота не відчинились: ' + gates.join(' | '));
ok(gates.some(x => /успадковано з 1001201/.test(x)),
  'і сказано, що тест успадкований, а не проходився заново',
  'походження погодження не показане');

console.log('');
console.log('═══ ЗМІНИВСЯ ВИРІБ — ПОТРІБЕН НОВИЙ ТЕСТ ═══');
const stale = await p.evaluate(() => {
  const n = orders.find(x => x.repeatOf === '1001201');
  n.items[0].color = 'біла';               // інший колір — інша вишивка на око
  const g = prodGates(n).filter(x => x.key === 'test')[0];
  return { stale: repeatStale(n), ok:g.ok, note:g.note, open: prodGateOpen(n) };
});
console.log('  ' + JSON.stringify(stale));
ok(stale.stale && !stale.ok && !stale.open,
  'змінили колір — успадковане погодження перестало діяти',
  'погодження лишилось чинним після зміни виробу');
ok(/змінився виріб/i.test(stale.note),
  'і причина названа словами, а не мовчазним нулем',
  'причину не назвали: ' + stale.note);
await p.evaluate(() => {
  const n = orders.find(x => x.repeatOf === '1001201');
  n.items[0].color = 'чорна';              // повертаємо як було
});

console.log('');
console.log('═══ ФАКТ ЗБИРАЄТЬСЯ САМ ═══');
const f = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001201');
  const r = factRows(o);
  return { plan:r.plan, cost:r.cost, over:r.over,
           rows:r.rows.map(x => x.k + ':' + x.fact + (x.note ? ' (' + x.note + ')' : '')),
           marginPlan:r.marginPlan, marginFact:r.marginFact };
});
f.rows.forEach(x => console.log('  ' + x));
console.log('  собівартість ' + f.plan + ' → ' + f.cost +
            ' · маржа ' + f.marginPlan + ' → ' + f.marginFact);
ok(f.rows.some(x => /^buy:/.test(x)) && f.rows.some(x => /^resew:/.test(x)),
  'докупівля й перешив стали рядками самі — з закупівлі й браку',
  'факт не зібрався: ' + JSON.stringify(f.rows));
ok(f.rows.some(x => /^art:/.test(x) && /1 верс/.test(x)),
  'друга версія макета порахувалась як робота понад норму',
  'версії макета не пораховані: ' + JSON.stringify(f.rows));
ok(f.cost > f.plan && f.marginFact < f.marginPlan,
  'факт вищий за план, і маржа впала — саме те, чого не було видно раніше',
  'факт не відрізняється від плану: ' + JSON.stringify(f));

const hand = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001201');
  await factSave(o, 'Таксі за тканиною', 450);
  const r = factRows(o);
  return { has: r.rows.some(x => x.k === 'hand'), cost:r.cost };
});
ok(hand.has, 'те, чого система не бачить, вноситься руками окремим рядком',
  'ручний рядок не зʼявився');

console.log('');
console.log('═══ БЕЗ ПОГОДЖЕННЯ ПОВТОРЮВАТИ НЕМА З ЧОГО ═══');
const no = await p.evaluate(() => {
  const o = { id:'z', orderId:'1001299', items:[], art:[{ n:1, approvals:{ art:{} } }] };
  return { can: canRepeat(o), fold: repeatFold(o) };
});
ok(!no.can && !no.fold,
  'коли клієнт нічого не погоджував, кнопки повтору немає',
  'повтор запропонували без погодження');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'повтор бере погоджене, а факт рахується сам');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
