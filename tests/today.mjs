/* Вікно «Сьогодні», статус «Заблоковано» і перша одиниця партії.

   ГОЛОВНЕ, ЧОГО БРАКУВАЛО. Менеджер відкривав картку й сам розбирався в
   історії: що тут уже зроблено, чого чекають, чия черга. Тепер система каже
   одним рядком, що робити далі, — з даних, які вже є, нічого не питаючи. І
   каже це в одному вікні на всі замовлення, замість обходу карток.

   ЗАБЛОКОВАНО. Замовлення не має просто висіти в «Дизайні»: воно або
   працюється, або чекає, і це різні речі. Без цієї різниці неможливо
   побачити, де насправді згорає час.

   ПЕРША ОДИНИЦЯ. Не чекати, поки вишиють 50 худі. Одна одиниця → звірка з
   еталоном → і аж тоді решта. Помилка коштує одну штуку, а не партію.
   Вимагаємо не завжди: правило просте й пояснюване — дорого, багато або
   складно. Оцінку, яку ніхто не може пояснити, за тиждень перестають читати.

   Запуск:  node tests/today.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8833;
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
const ago = h => new Date(Date.now() - h * 36e5).toISOString();
const day = n => { const d = new Date(); d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', days:7 }],
  products:{ supplier:{ tshirt:'tex' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] }
};
const item = (q, price, prints) => ({ kind:'main', name:'Худі', color:'чорне',
  garmentId:'tshirt', qty:q, unitPrice:price, price:q * price, unitCost:price * 0.6,
  cost:q * price * 0.6, sizeQty:{ S:Math.round(q/3), M:Math.round(q/3), L:q - 2*Math.round(q/3) },
  prints:prints || [{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] });

/* Шість замовлень, кожне на своєму кроці — щоб побачити всі роди наступної дії. */
const ORDERS = [
  /* 1. Дизайнер надіслав макет — чекає нас. */
  { id:'1', orderId:'1001401', name:'Оксана', phone:'+380670001401', status:'paid',
    createdAt:now, hist:[], prodAt:now, dueAt:day(20), totalPrice:40000, totalCost:24000,
    payments:[{ at:now, sum:10000, kind:'prepay', by:'test@loomiq' }],
    tracks:{ design:'check', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
    art:[{ n:1, at:now, files:[], wilcom:'https://x/w.png', photo:'', approvals:{} }],
    items:[item(40, 1000)] },
  /* 2. Тест у клієнта вже третю добу. */
  { id:'2', orderId:'1001402', name:'Ігор', phone:'+380670001402', status:'paid',
    createdAt:now, hist:[], prodAt:now, dueAt:day(15), totalPrice:20000, totalCost:12000,
    payments:[{ at:now, sum:5000, kind:'prepay', by:'test@loomiq' }],
    tracks:{ design:'ok', supply:'todo', test:'client', prod:'lock', qc:'wait', ship:'wait' },
    trackHist:[{ t:'test', s:'client', at:ago(72), by:'test@loomiq' }],
    art:[{ n:1, at:now, files:[{ kind:'front', name:'f', url:'https://x/f.dst' }],
           wilcom:'https://x/w.png', photo:'https://x/t.jpg',
           approvals:{ art:{ by:'a', at:now }, inner:{ by:'a', at:now } } }],
    items:[item(20, 500)] },
  /* 3. Горить: здавати післязавтра, тираж не почато. */
  { id:'3', orderId:'1001403', name:'Марта', phone:'+380670001403', status:'paid',
    createdAt:now, hist:[], prodAt:now, dueAt:day(2), totalPrice:60000, totalCost:36000,
    payments:[{ at:now, sum:30000, kind:'prepay', by:'test@loomiq' }],
    tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
    items:[item(50, 1200)] },
  /* 4. Заблоковано: чекаємо логотип. */
  { id:'4', orderId:'1001404', name:'Тарас', phone:'+380670001404', status:'paid',
    createdAt:now, hist:[], prodAt:now, dueAt:day(25), totalPrice:15000, totalCost:9000,
    payments:[{ at:now, sum:5000, kind:'prepay', by:'test@loomiq' }],
    blocked:{ why:'чекаємо логотип від клієнта', at:ago(30), by:'test@loomiq' },
    tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
    items:[item(15, 1000)] },
  /* 5. Ще продаж, із нагадуванням на сьогодні. */
  { id:'5', orderId:'1001405', name:'Ліза', phone:'+380670001405', status:'kp',
    createdAt:now, hist:[], totalPrice:0, totalCost:0, payments:[], items:[],
    tasks:[{ id:'t1', text:'Передзвонити щодо пропозиції', due:day(0), done:false,
             at:now, by:'test@loomiq', for:'test@loomiq' }] },
  /* 6. Закрите — у списку його бути не має. */
  { id:'6', orderId:'1001406', name:'Богдан', phone:'+380670001406', status:'done',
    createdAt:now, hist:[], prodAt:now, ttn:'20450000000009', totalPrice:10000, totalCost:6000,
    payments:[{ at:now, sum:10000, kind:'final', by:'test@loomiq' }],
    tracks:{ design:'ok', supply:'got', test:'ok', prod:'done', qc:'ok', ship:'sent' },
    items:[item(10, 1000)] }
];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
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
p.on('dialog', d => d.accept('чекаємо логотип від клієнта'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ СИСТЕМА САМА КАЖЕ, ЩО РОБИТИ ═══');
const acts = await p.evaluate(() => {
  const out = {};
  orders.forEach(o => { const a = nextAction(o);
    out[o.orderId] = a ? (a.key + ' · ' + a.text + (a.wait ? ' [чекаємо ' + a.who + ']' : '')) : null; });
  return out;
});
Object.keys(acts).forEach(k => console.log('  ' + k + ': ' + acts[k]));
ok(/^d_check/.test(acts['1001401'] || ''),
  'дизайнер надіслав макет — наступна дія наша: подивитись',
  'дія не та: ' + acts['1001401']);
ok(/^ap_cl/.test(acts['1001402'] || '') && /чекаємо клієнт/.test(acts['1001402']),
  'тест у клієнта — мʼяч не в нас, і це сказано',
  'дія не та: ' + acts['1001402']);
ok(/^block/.test(acts['1001404'] || '') && /логотип/.test(acts['1001404']),
  'заблоковане замовлення каже, чого саме чекає',
  'блокування не показане: ' + acts['1001404']);
ok(/^task/.test(acts['1001405'] || ''),
  'до оплати наступна дія — поставлене нагадування',
  'дія не та: ' + acts['1001405']);
ok(acts['1001406'] === null,
  'у закритому замовленні наступної дії немає',
  'у закритого зʼявилась дія: ' + acts['1001406']);

console.log('');
console.log('═══ ОДНЕ ВІКНО ЗАМІСТЬ ОБХОДУ КАРТОК ═══');
await p.click('.nav button[data-view="today"]');
await p.waitForTimeout(700);
const win = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.td-r')];
  return { n: rows.length,
           first: rows[0] ? rows[0].textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
           heat: rows.map(r => r.className.match(/td-(hot|warn|ok)/)[1]),
           ids: rows.map(r => (r.querySelector('.td-m b') || {}).textContent || ''),
           kpis: [...document.querySelectorAll('.td-k b')].map(b => b.textContent.trim()) };
});
console.log('  рядків ' + win.n + ' · порядок гарячості: ' + win.heat.join(' '));
console.log('  перший: ' + win.first);
console.log('  числа вгорі: ' + win.kpis.join(' | '));
ok(win.n >= 5, 'у вікні всі активні замовлення', 'рядків замало: ' + win.n);
ok(win.ids.indexOf('1001406') < 0,
  'закрите й відправлене у список не потрапляє',
  'закрите замовлення в списку');
ok(win.heat[0] === 'hot' && win.heat[win.heat.length - 1] !== 'hot',
  'спершу те, що горить, — саме в такому порядку до цього й повертаються',
  'сортування не те: ' + win.heat.join(' '));
ok(win.heat.indexOf('warn') > win.heat.indexOf('hot'),
  'ризик затримки — після гарячого, але перед спокійним',
  'ризик не на місці: ' + win.heat.join(' '));
ok(win.kpis.length >= 3,
  'угорі числа дня: активні, потребує рішення, ризик',
  'чисел немає: ' + JSON.stringify(win.kpis));

console.log('');
console.log('═══ «БЕРУ» І «ЗРОБИВ» ═══');
const take = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001401');
  await todoState(o, 'd_check', 'doing');
  const doing = { mark:(o.todo || {}).d_check, rows:document.querySelectorAll('.td-r.is-doing').length };
  await todoState(o, 'd_check', 'done');
  const gone = { rows:[...document.querySelectorAll('.td-m b')].map(b => b.textContent) };
  return { doing, gone };
});
console.log('  «беру» → підсвічених рядків ' + take.doing.rows);
ok(take.doing.mark && take.doing.mark.s === 'doing' && take.doing.rows === 1,
  '«беру» видно всім — щоб двоє не бралися за те саме',
  'позначка не спрацювала: ' + JSON.stringify(take.doing));
ok(take.gone.rows.indexOf('1001401') < 0,
  '«зробив» прибирає рядок з очей, поки система не побачить наслідок',
  'рядок лишився після «зробив»');

console.log('');
console.log('═══ ФІЛЬТР «ЧЕКАЄМО ІНШИХ» ═══');
await p.click('#td-filter button[data-f="wait"]');
await p.waitForTimeout(400);
const waitOnly = await p.evaluate(() =>
  [...document.querySelectorAll('.td-r')].map(r => (r.querySelector('.td-m b') || {}).textContent));
console.log('  ' + waitOnly.join(' · '));
ok(waitOnly.indexOf('1001402') >= 0 && waitOnly.indexOf('1001403') < 0,
  'окремо видно те, де мʼяч не в нас',
  'фільтр не працює: ' + waitOnly.join(','));
await p.click('#td-filter button[data-f="all"]');

console.log('');
console.log('═══ ЗАБЛОКОВАНО: ЧЕКАННЯ РАХУЄТЬСЯ ═══');
const blk = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001404');
  const hoursWait = blockedHours(o);
  await blockSet(o, '');                       // розблокували
  return { hoursWait, after: blockOf(o), hist:(o.blockHist || [])[0],
           total: blockedHours(o), act:(nextAction(o) || {}).key };
});
console.log('  чекали ' + blk.hoursWait + ' год · у журналі ' + JSON.stringify(blk.hist));
ok(blk.hoursWait >= 29 && blk.hoursWait <= 31,
  'час у блокуванні рахується, поки воно триває',
  'час не порахувався: ' + blk.hoursWait);
ok(!blk.after && blk.hist && blk.hist.hours >= 29,
  'розблокували — скільки простояло, записалось назавжди',
  'історія блокування не записалась: ' + JSON.stringify(blk.hist));
ok(blk.act === 'd_new',
  'після розблокування зʼявилась справжня наступна дія',
  'дія після розблокування: ' + blk.act);

console.log('');
console.log('═══ ПЕРША ОДИНИЦЯ: ДОРОГО, БАГАТО АБО СКЛАДНО ═══');
const fp = await p.evaluate(() => ({
  big:   firstPieceNeeded(orders.find(x => x.orderId === '1001403')),
  small: firstPieceNeeded(orders.find(x => x.orderId === '1001406')),
  mid:   firstPieceNeeded(orders.find(x => x.orderId === '1001402'))
}));
console.log('  50 шт по 1200: ' + JSON.stringify(fp.big));
console.log('  10 шт по 1000: ' + JSON.stringify(fp.small));
console.log('  20 шт по 500:  ' + JSON.stringify(fp.mid));
ok(fp.big.length >= 2,
  'на великому дорогому тиражі перша одиниця потрібна, і причини названі',
  'причин не назвали: ' + JSON.stringify(fp.big));
ok(!fp.mid.length,
  'на 20 футболках із простим написом окрема зупинка — зайва церемонія',
  'вимагають першу одиницю там, де не треба: ' + JSON.stringify(fp.mid));
ok(fp.small.some(x => /дорог/.test(x)) && fp.small.length === 1,
  'дорогий виріб сам по собі — теж причина, навіть на десяти штуках',
  'ціна не врахована: ' + JSON.stringify(fp.small));

const guard = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1001403');
  o.tracks.prod = 'work';
  await setTrack(o, 'prod', 'done');
  const noShot = { step:o.tracks.prod, toast:(document.querySelector('.toast') || {}).textContent || '' };
  o.qc = { first:{ photo:'https://x/fp.jpg', at:new Date().toISOString(), ok:false } };
  await setTrack(o, 'prod', 'done');
  const noOk = { step:o.tracks.prod, toast:(document.querySelector('.toast') || {}).textContent || '' };
  o.qc.first.ok = true;
  await setTrack(o, 'prod', 'done');
  return { noShot, noOk, done:o.tracks.prod };
});
console.log('  ' + guard.noShot.toast.trim());
console.log('  ' + guard.noOk.toast.trim());
ok(guard.noShot.step === 'work' && /першу одиницю/i.test(guard.noShot.toast),
  'тираж не закривається, поки першу одиницю не зняли',
  'тираж закрився без першої одиниці: ' + JSON.stringify(guard.noShot));
ok(guard.noOk.step === 'work' && /не звірена/i.test(guard.noOk.toast),
  'знятої мало — її треба звірити з еталоном',
  'закрився без звірки: ' + JSON.stringify(guard.noOk));
ok(guard.done === 'done',
  'звірили — тираж закривається',
  'не закрився й після звірки: ' + guard.done);

console.log('');
console.log('═══ ЕТАЛОН — ЦЕ ПОГОДЖЕНЕ КЛІЄНТОМ ФОТО ═══');
const gold = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1001402');
  const before = goldenSample(o);
  o.art[0].approvals.client = { by:'a', at:new Date().toISOString() };
  const after = goldenSample(o);
  return { before: !!before, after: after && after.photo };
});
ok(!gold.before && gold.after === 'https://x/t.jpg',
  'еталоном стає саме те фото, яке погодив клієнт, — і лише після погодження',
  'еталон не той: ' + JSON.stringify(gold));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'людина не вирішує, що робити далі — вона це бачить');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
