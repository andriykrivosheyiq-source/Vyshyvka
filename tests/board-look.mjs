/* Три речі, які видно щодня й які були зроблені не так.

   ФОН ВОРОНКИ. Колір етапу заливав УСЮ колонку, від шапки до низу — під
   картками теж. Шість кольорових полотнищ поруч роблять дошку строкатою, і
   білі картки на них перестають читатись як головне. Колір має жити у
   шапці колонки: етап видно з відстані, робоча область лишається спокійною.

   ПЕРЕМИКАЧ ДОШОК. Одягнений список копіював ширину ОДИН раз, коли створював
   кнопку, і більше не перераховував. Але пункти в список кладуть уже після
   того — замороженої ширини переставало вистачати, і від «Продажі»
   лишалась одна літера. На екрані було видно тільки підпис «ДОШКА».

   ТРЕТІЙ ВИД ДИЗАЙНУ. «Без дизайну» був лише в прорахунку на сторінці
   пропозиції. У прорахунку менеджера лишались дві кнопки — картинка й
   текст, — хоча дизайн буває готовий: клієнт приніс файл саме під цей
   виріб, або те саме нанесення підготували минулого разу.

   Запуск:  node tests/board-look.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8837;
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
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] }
};
const ORDERS = [{
  id:'1', orderId:'1001601', type:'client', name:'Оксана', phone:'+380670001601',
  status:'kp', site:'main', createdAt:now, hist:[], payments:[],
  totalPrice:20000, totalCost:12000, margin:8000, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:20,
           unitPrice:1000, price:20000, unitCost:600, cost:12000 }]
}];

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
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ КОЛІР ЕТАПУ — У ШАПЦІ, А НЕ ПІД КАРТКАМИ ═══');
const col = await p.evaluate(() => {
  const c = document.querySelector('#board .col');
  const h = c && c.querySelector('.col-head');
  const t = document.querySelector('#board .ticket');
  const solid = s => !/rgba\([^)]*,\s*0\)|transparent/.test(String(s));
  return { colBg: c ? getComputedStyle(c).backgroundColor : '',
           colSolid: c ? solid(getComputedStyle(c).backgroundColor) : true,
           headBg: h ? getComputedStyle(h).backgroundColor : '',
           headSolid: h ? solid(getComputedStyle(h).backgroundColor) : false,
           headRadius: h ? parseFloat(getComputedStyle(h).borderRadius) || 0 : 0,
           card: t ? getComputedStyle(t).backgroundColor : '' };
});
console.log('  колонка: ' + col.colBg + ' · шапка: ' + col.headBg);
ok(!col.colSolid,
  'під картками фону немає — дошка не рябить',
  'колір досі залитий на всю колонку: ' + col.colBg);
ok(col.headSolid && col.headRadius >= 10,
  'колір етапу живе в шапці колонки — окремою плашкою',
  'шапка без кольору: ' + col.headBg);
ok(/255,\s*255,\s*255/.test(col.card),
  'картки лишаються білими',
  'картка не біла: ' + col.card);

console.log('');
console.log('═══ ПЕРЕМИКАЧ ДОШОК ПОКАЗУЄ НАЗВУ ═══');
const sw = await p.evaluate(() => {
  const sel = document.getElementById('board-track');
  const box = sel && sel.__lqBox;
  const v = box && box.querySelector('.lq-sel-v');
  return { opts: sel ? [...sel.options].map(o => o.textContent.trim()) : [],
           shown: v ? v.textContent.trim() : '',
           w: box ? Math.round(box.getBoundingClientRect().width) : 0,
           /* Ширина має бути НЕ зафіксована назавжди: інакше довший пункт
              обріжеться одразу після вибору. */
           fixed: box ? !!box.style.width : false,
           label: (document.querySelector('.bt-board>span') || {}).textContent || '' };
});
console.log('  підпис «' + sw.label.trim() + '» · на кнопці «' + sw.shown +
            '» · ширина ' + sw.w + 'px');
console.log('  дошки: ' + sw.opts.join(' | '));
ok(sw.opts.length > 1 && /Продажі/.test(sw.opts[0]),
  'у списку всі дошки, з назвами',
  'список дошок не той: ' + sw.opts.join(','));
ok(sw.shown && sw.shown === sw.opts[0],
  'на кнопці видно назву поточної дошки, а не саме лише слово «Дошка»',
  'назви дошки не видно: «' + sw.shown + '»');
ok(!sw.fixed,
  'ширина не заморожена — довша назва не обріжеться після вибору',
  'ширину зафіксовано назавжди');

const longer = await p.evaluate(async () => {
  const sel = document.getElementById('board-track');
  const box = sel.__lqBox;
  const w0 = Math.round(box.getBoundingClientRect().width);
  /* Обираємо найдовшу назву й дивимось, чи вона вміщається. */
  let iLong = 0, len = 0;
  [...sel.options].forEach((o, i) => { if(o.textContent.length > len){ len = o.textContent.length; iLong = i; } });
  sel.selectedIndex = iLong;
  sel.dispatchEvent(new Event('change', { bubbles:true }));
  await new Promise(r => setTimeout(r, 300));
  const v = box.querySelector('.lq-sel-v');
  return { w0, w1: Math.round(box.getBoundingClientRect().width),
           text: v.textContent.trim(),
           cut: v.scrollWidth > v.clientWidth + 1 };
});
console.log('  обрали «' + longer.text + '» · ширина ' + longer.w0 + ' → ' + longer.w1 + 'px');
ok(!longer.cut,
  'найдовша назва вміщається цілком — жодних обрізаних слів',
  'назву обрізало: «' + longer.text + '»');

console.log('');
console.log('═══ ТРЕТІЙ ВИД ДИЗАЙНУ В ПРОРАХУНКУ ═══');
await p.click('.nav button[data-view="calc"]');
await p.waitForTimeout(600);
const kinds = await p.evaluate(() => ({
  list: (typeof APP_KINDS !== 'undefined') ? APP_KINDS.map(k => k.k + ':' + k.label) : [],
  /* Старі позиції зберігали булеве isText — читати його треба далі. */
  old:  appKind({ isText:true }) + '/' + appKind({ isText:false }),
  now:  appKind({ kind:'off' })
}));
console.log('  ' + kinds.list.join(' · '));
ok(kinds.list.length === 3 && /off:Без дизайну/.test(kinds.list.join(' ')),
  'у прорахунку менеджера три види, і третій — «Без дизайну»',
  'третього виду немає: ' + kinds.list.join(','));
ok(kinds.old === 'txt/img' && kinds.now === 'off',
  'старі позиції з булевим полем читаються далі — вони не стали «картинками»',
  'сумісність зі старим полем зламана: ' + kinds.old);

/* Головне: «без дизайну» знімає РАЗОВУ, але не саме нанесення. */
const money = await p.evaluate(() => {
  const feesWith = orderFees(['print'], 10);
  const feesNone = orderFees([], 10);
  const area = appCalc('print', 10, 10, 10, 0, false);
  return { withFee: feesWith.orderP, noFee: feesNone.orderP, area: area.price };
});
console.log('  разова з дизайном ' + money.withFee + ' грн · без дизайну ' + money.noFee +
            ' грн · саме нанесення ' + money.area + ' грн');
ok(money.withFee > 0 && money.noFee === 0,
  '«без дизайну» знімає разову підготовку макета',
  'разова не знялась: ' + JSON.stringify(money));
ok(money.area > 0,
  'а саме нанесення рахується як звичайно — тканину прошити все одно треба',
  'нанесення теж обнулилось');

const seg = await p.evaluate(() => {
  const s = document.querySelector('.app-card .seg:nth-of-type(2)') ||
            [...document.querySelectorAll('.app-card .seg')][1];
  if(!s) return null;
  return [...s.querySelectorAll('button')].map(b => ({
    t: b.textContent.trim(),
    cut: b.scrollWidth > b.clientWidth + 1
  }));
});
if(seg){
  console.log('  кнопки: ' + seg.map(x => x.t).join(' | '));
  ok(seg.length === 3 && !seg.some(x => x.cut),
    'усі три підписи видно цілком — жодної обрізаної «К»',
    'підпис обрізало: ' + JSON.stringify(seg));
} else {
  console.log('  (картки нанесення ще немає — перевірили саму розмітку)');
  const src = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  ok(/white-space:nowrap;\}/.test(src.slice(src.indexOf('.seg button{'), src.indexOf('.seg button{') + 260)),
    'підписи в перемикачі не переносяться й не ріжуться',
    'кнопки перемикача можуть обрізатись');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'дошка спокійна, назви видно, третій вид на місці');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
