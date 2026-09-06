/* Контроль якості: чекліст, фото партії і брак як маршрут.

   «Перевір уважно» — не інструкція. Це список, який читається з екрана й
   відмічається пальцем, і кожен пункт узятий із того, що вже колись поїхало
   не так. Питання про пʼяльці не ставимо там, де вишивки не було: так
   привчають відмічати не дивлячись.

   БРАК. Сам по собі стан «брак» нічого не вирішує — замовлення зависає.
   Тому беремо три речі: скільки, чому і чия провина, — і далі маршрут
   вибирає система. Три наслідки мають стати видимі одразу: строк, гроші й
   кількість.

   Перевіряємо:
     — чекліст підлаштовується під спосіб нанесення;
     — «QC пройдено» без фото партії не натискається;
     — і з невідміченим пунктом теж — це причина, а не помилка;
     — дефект самого виробу заводить докупівлю й претензію постачальнику;
     — наша робота йде в перешив із запасу;
     — файл клієнта повертає дизайнеру;
     — дата здачі посувається, а не зсувається мовчки;
     — відсоток браку рахується сам.

   Запуск:  node tests/qc-defect.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8829;
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

const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', days:7 }],
  products:{ supplier:{ tshirt:'tex' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] }
};
const now = new Date().toISOString();
const base = o => Object.assign({
  type:'client', status:'paid', site:'main', createdAt:now, hist:[], prodAt:now,
  dueAt:'2026-12-01', payments:[{ at:now, sum:5000, kind:'prepay', by:'test@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'work', qc:'check', ship:'wait' },
  art:[{ n:2, at:now, by:'d@loomiq', files:[{ kind:'front', name:'f', url:'https://x/f.dst' }],
         wilcom:'https://x/w.png', photo:'https://x/t.jpg',
         approvals:{ art:{ by:'test@loomiq', at:now, note:'' },
                     inner:{ by:'test@loomiq', at:now, note:'' },
                     client:{ by:'test@loomiq', at:now, note:'' } } }],
  buy:{ lines:{ '0|S':{ ord:6, got:6 }, '0|M':{ ord:16, got:16 }, '0|L':{ ord:21, got:21 } },
        orderedAt:now }
}, o);
/* Вишивка — тут мають бути питання про нитки й пʼяльці. */
const EMBRO = base({ id:'1', orderId:'1001001', name:'Оксана',
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:50,
           sizeQty:{ S:5, M:15, L:30 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }] });
/* Друк — питань про пʼяльці бути не повинно. */
const PRINT = base({ id:'2', orderId:'1001002', name:'Ігор',
  items:[{ kind:'main', name:'Худі', color:'сіре', garmentId:'tshirt', qty:20,
           sizeQty:{ M:10, L:10 },
           prints:[{ side:'front', technique:'DTF', widthMm:200, heightMm:120 }] }] });

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([EMBRO, PRINT]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace(
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

console.log('═══ ЧЕКЛІСТ ЗНАЄ, ЩО ШИЛИ ═══');
const lists = await p.evaluate(() => ({
  embro: qcChecks(orders.find(o => o.orderId === '1001001')).map(x => x.key),
  print: qcChecks(orders.find(o => o.orderId === '1001002')).map(x => x.key)
}));
console.log('  вишивка: ' + lists.embro.join(', '));
console.log('  друк:    ' + lists.print.join(', '));
ok(lists.embro.indexOf('pull') >= 0 && lists.embro.indexOf('ink') < 0,
  'у вишивки питають про пʼяльці й не питають про друк',
  'чекліст вишивки не той: ' + lists.embro.join(','));
ok(lists.print.indexOf('ink') >= 0 && lists.print.indexOf('pull') < 0,
  'у друку навпаки — і жодного зайвого питання',
  'чекліст друку не той: ' + lists.print.join(','));
ok(lists.embro.indexOf('model') >= 0 && lists.print.indexOf('model') >= 0,
  'спільні питання лишаються в обох',
  'спільних питань немає');

console.log('');
console.log('═══ «QC ПРОЙДЕНО» БЕЗ ФОТО Й БЕЗ ГАЛОЧОК ═══');
const gate = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001001');
  await qcPass(o);
  const noPhoto = { qc:(o.tracks || {}).qc, toast:(document.querySelector('.toast') || {}).textContent || '' };
  o.qc = { photo:'https://x/batch.jpg' };
  await qcPass(o);
  const noMarks = { qc:(o.tracks || {}).qc, toast:(document.querySelector('.toast') || {}).textContent || '' };
  qcChecks(o).forEach(c => { o.qc.checks = o.qc.checks || {}; o.qc.checks[c.key] = true; });
  const ready = qcReady(o);
  return { noPhoto, noMarks, ready };
});
console.log('  без фото: ' + gate.noPhoto.toast.trim());
console.log('  без галочок: ' + gate.noMarks.toast.trim());
ok(gate.noPhoto.qc === 'check' && /фото партії/i.test(gate.noPhoto.toast),
  'без фото партії контроль не закривається — і сказано чому',
  'пройшло без фото: ' + JSON.stringify(gate.noPhoto));
ok(gate.noMarks.qc === 'check' && /не відмічено/i.test(gate.noMarks.toast),
  'невідмічений пункт теж тримає — і його називають',
  'пройшло з пропуском: ' + JSON.stringify(gate.noMarks));
ok(gate.ready, 'усе відмічено й знято — кнопка відкрилась', 'кнопка так і не відкрилась');

console.log('');
console.log('═══ БРАК: ДЕФЕКТ ВИРОБУ → ДОКУПІВЛЯ Й ПРЕТЕНЗІЯ ═══');
const sup = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001001');
  const dueWas = o.dueAt, needWas = buySum(o).need;
  await defectAdd(o, 3, 'L', 'garment', 'sup');
  return { dueWas, dueNow:o.dueAt, needWas, needNow:buySum(o).need,
           claims:(o.claims || []).length, claimQty:((o.claims || [])[0] || {}).qty,
           qc:(o.tracks || {}).qc, supply:(o.tracks || {}).supply,
           short: defectShort(o) };
});
console.log('  потреба ' + sup.needWas + ' → ' + sup.needNow +
            ' · строк ' + sup.dueWas + ' → ' + sup.dueNow);
ok(sup.needNow === sup.needWas + 3,
  'докупівля лягла в ту саму таблицю закупівлі, а не в окремий список',
  'потреба не зросла: ' + sup.needWas + ' → ' + sup.needNow);
ok(sup.claims === 1 && sup.claimQty === 3,
  'претензія постачальнику записана — інакше вона забудеться до кінця місяця',
  'претензії немає: ' + JSON.stringify(sup));
ok(sup.dueNow > sup.dueWas,
  'дата здачі посунулась, а не поїхала мовчки',
  'строк не змінився: ' + sup.dueWas + ' → ' + sup.dueNow);
ok(sup.qc === 'bad' && sup.short === 3,
  'контроль став «брак», і видно, скількох одиниць бракує',
  'стан не той: ' + JSON.stringify(sup));

console.log('');
console.log('═══ БРАК: НАША РОБОТА → ПЕРЕШИВ ═══');
const ours = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001002');
  o.qc = { photo:'https://x/b.jpg', checks:{} };
  await defectAdd(o, 2, 'M', 'crook', 'ours');
  const d = (o.defects || [])[0];
  return { route:d.route, blame:d.blame, prod:(o.tracks || {}).prod,
           toast:(document.querySelector('.toast') || {}).textContent || '',
           short: defectShort(o) };
});
console.log('  ' + ours.toast.trim());
ok(ours.route === 'resew' && ours.prod === 'work',
  'наша робота — перешив, тираж повернувся в роботу',
  'маршрут не той: ' + JSON.stringify(ours));
ok(/запас/i.test(ours.toast),
  'сказано, звідки беруться вироби на перешив',
  'про запас не сказано: ' + ours.toast);

const closed = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001002');
  await defectFix(o, o.defects[0].id);
  return { short: defectShort(o), qc:(o.tracks || {}).qc };
});
ok(closed.short === 0 && closed.qc === 'check',
  'перешили — недостача зникла, замовлення повернулось на перевірку',
  'після перешиву стан не повернувся: ' + JSON.stringify(closed));

console.log('');
console.log('═══ БРАК: ФАЙЛ КЛІЄНТА → ДИЗАЙНЕРУ ═══');
const client = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001002');
  await defectAdd(o, 1, 'L', 'crook', 'client');
  return { design:(o.tracks || {}).design,
           route:(o.defects[o.defects.length - 1] || {}).route };
});
ok(client.route === 'design' && client.design === 'fix',
  'провина файлу — повертається дизайнеру, а не в перешив',
  'маршрут не той: ' + JSON.stringify(client));

console.log('');
console.log('═══ ВІДСОТОК БРАКУ ═══');
const st = await p.evaluate(() => defectStats());
console.log('  ' + st.bad + ' із ' + st.units + ' шт — ' +
            (Math.round(st.pct * 10) / 10) + '% · замовлень із браком ' + st.withBad);
ok(st.units === 70 && st.bad === 6,
  'рахуються всі одиниці й увесь брак',
  'числа не ті: ' + JSON.stringify({ units:st.units, bad:st.bad }));
ok(st.pct > 0 && Object.keys(st.byReason).length >= 2,
  'відсоток і розбивка по причинах є — інакше загальне число нічого не пояснює',
  'розбивки немає: ' + JSON.stringify(st.byReason));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'брак веде до наступного кроку, а не в тупик');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
