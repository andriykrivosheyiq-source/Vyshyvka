/* Розмітка нанесення — щоб дизайнер не робив «на око».

   Досі позиція везла лише розмір нанесення: 80 × 45 мм. Де саме воно лежить
   на виробі, не знав ніхто: дизайнер вигадував, швачка ставила п'яльці за
   окоміром, а потім виявлялось, що завелике або з'їхало вбік — і день
   згорів на переробку.

   Тепер конструктор рахує ще два числа, поки в нього є масштаб зони:
   зміщення від осі виробу і відступ від лінії плечей (тієї самої точки, від
   якої міряється довжина виробу в розмірній сітці — щоб число сходилось із
   рулеткою). Картка складає з них технічну розмітку: числа, креслення в
   масштабі й кнопку «копіювати для дизайнера».

   Перевіряємо саме те, від чого залежить робота:
     — числа показані ті, що приїхали, і в тих самих одиницях;
     — «по центру» і «зміщення 25 мм праворуч» — різні речі, і плутати їх не
       можна: нанесення на грудях зліва й по центру шиються по-різному;
     — креслення справді масштабне: нанесення нижче лінії плечей і зсунуте
       туди ж, куди каже число;
     — стара позиція без розмітки не вигадує чисел, а каже про це вголос;
     — текст для дизайнера містить усе, що є на екрані.

   Запуск:  node tests/placement-mark.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8804;
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

/* Зона нанесення — прямокутник 260 × 340 мм, симетричний осі, від 60 мм під
   лінією плечей. Полігон їде плоским списком: у Firestore масив у масиві не
   кладеться. */
const ZONE = { top:60, left:-130, w:260, h:340,
               poly:[-130,60, 130,60, 130,400, -130,400] };

const CONTENT = { sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };

const ORDER = {
  id:'1', orderId:'1000101', type:'client', name:'Оксана', phone:'+380670000101',
  company:'Кава Друзі', status:'kp', site:'main', offerToken:'tok1', payments:[],
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:5000, totalCost:3000, margin:2000, marginPct:40,
  items:[{
    kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt', qty:50,
    unitPrice:500, price:25000, unitCost:300, cost:15000,
    prints:[
      /* Перед: рівно по центру, 85 мм від лінії плечей. */
      { side:'front', sideLabel:'Перед', technique:'вишивка',
        widthMm:80, heightMm:45,
        mark:{ topMm:85, centerMm:0, rotDeg:0, zone:ZONE } },
      /* Спина: зсунуте праворуч — саме те, що окоміром не повторити. */
      { side:'back', sideLabel:'Спина', technique:'вишивка',
        widthMm:240, heightMm:60,
        mark:{ topMm:120, centerMm:25, rotDeg:0, zone:ZONE } }
    ]
  },{
    /* Стара позиція: розмір нанесення є, розмітки немає — її тоді не рахували. */
    kind:'main', name:'Кепка', color:'біла', garmentId:'cap', qty:10,
    unitPrice:200, price:2000, unitCost:120, cost:1200,
    prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка',
              widthMm:60, heightMm:30 }]
  }]
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
await p.click('.ticket:has-text("1000101")');
await p.waitForTimeout(1200);
await p.click('[data-fold="goods"]');
await p.waitForTimeout(400);

console.log('═══ КНОПКА В ПОЗИЦІЇ ═══');
const btns = await p.$$('[data-mark-i]');
ok(btns.length === 2,
  'кнопка «Розмітка» стоїть у кожної позиції з нанесенням',
  'кнопок не стільки, скільки позицій: ' + btns.length);

await btns[0].click();
await p.waitForTimeout(400);

console.log('');
console.log('═══ ЧИСЛА ═══');
const card = await p.evaluate(() => {
  const wrap = document.getElementById('markWrap');
  const t = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  return {
    open: !!wrap && wrap.classList.contains('open'),
    sides: [...wrap.querySelectorAll('.mk-side-h')].map(t),
    rows: [...wrap.querySelectorAll('.mk-side')].map(s =>
      [...s.querySelectorAll('.mk-row')].map(r =>
        t(r.querySelector('span')) + ': ' + t(r.querySelector('b')))),
    draws: wrap.querySelectorAll('.mk-draw').length
  };
});
console.log('  ' + card.sides.join(' | '));
card.rows.forEach(r => r.forEach(x => console.log('    ' + x)));
ok(card.open, 'розмітка відкривається з позиції', 'вікно розмітки не відкрилось');
ok(card.rows[0].some(r => /розмір нанесення: 80 × 45 мм/.test(r)),
  'розмір нанесення показаний той, що приїхав: 80 × 45 мм',
  'розмір нанесення не той: ' + card.rows[0].join(' / '));
ok(card.rows[0].some(r => /по горизонталі: по центру$/.test(r)),
  'нульове зміщення сказане словом «по центру», а не «0 мм»',
  'центр названий не так: ' + card.rows[0].join(' / '));
ok(card.rows[0].some(r => /по вертикалі: 85 мм від лінії плечей/.test(r)),
  'відступ рахується від лінії плечей — звідки міряють довжину виробу',
  'відступ по вертикалі не той: ' + card.rows[0].join(' / '));
ok(card.rows[0].some(r => /зона нанесення: 260 × 340 мм/.test(r)),
  'габарит зони нанесення показаний: 260 × 340 мм',
  'зона нанесення не показана: ' + card.rows[0].join(' / '));
ok(/зміщення 25 мм праворуч/.test(card.rows[1].join(' ')),
  'зсунуте нанесення названо зсунутим: 25 мм праворуч',
  'зміщення спини загубилось: ' + card.rows[1].join(' / '));
ok(card.draws === 2,
  'у кожної сторони своє креслення',
  'креслень не стільки, скільки сторін: ' + card.draws);

console.log('');
console.log('═══ КРЕСЛЕННЯ В МАСШТАБІ ═══');
/* Креслення — не картинка «щось прямокутне»: viewBox у міліметрах, тож
   прямокутник нанесення має стояти рівно там, куди показують числа. */
const geo = await p.evaluate(() => {
  const svgs = [...document.querySelectorAll('#markWrap .mk-draw')];
  return svgs.map(s => {
    const r = s.querySelector('rect');
    return { x:+r.getAttribute('x'), y:+r.getAttribute('y'),
             w:+r.getAttribute('width'), h:+r.getAttribute('height'),
             box:s.getAttribute('viewBox') };
  });
});
console.log('  перед: x ' + geo[0].x + ' y ' + geo[0].y + ' · ' + geo[0].w + '×' + geo[0].h);
console.log('  спина: x ' + geo[1].x + ' y ' + geo[1].y + ' · ' + geo[1].w + '×' + geo[1].h);
ok(geo[0].x === -40 && geo[0].y === 85 && geo[0].w === 80 && geo[0].h === 45,
  'перед намальовано за числами: 80 мм завширшки, по центру, 85 мм від верху',
  'прямокутник переду стоїть не там: ' + JSON.stringify(geo[0]));
ok(geo[1].x === -95 && geo[1].y === 120,
  'спина зсунута праворуч рівно на ті самі 25 мм (центр −120+25)',
  'зміщення спини на кресленні не збіглось: ' + JSON.stringify(geo[1]));

console.log('');
console.log('═══ ТЕКСТ ДЛЯ ДИЗАЙНЕРА ═══');
const txt = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000101');
  return markTextOf(o, o.items[0]);
});
console.log(txt.split('\n').map(l => '  │ ' + l).join('\n'));
ok(/#1000101/.test(txt) && /Футболка BASIC · чорна · 50 шт/.test(txt),
  'у тексті є номер замовлення, товар, колір і тираж',
  'шапка тексту неповна');
ok(/ПЕРЕД · вишивка/.test(txt) && /СПИНА · вишивка/.test(txt),
  'обидві сторони названі так, як їх називає картка',
  'сторони в тексті названі інакше');
ok(/85 мм від лінії плечей/.test(txt) && /зміщення 25 мм праворуч/.test(txt),
  'усі числа з екрана є і в тексті — переписувати руками нічого',
  'у тексті загубились числа');

console.log('');
console.log('═══ СТАРА ПОЗИЦІЯ НЕ ВИГАДУЄ ЧИСЕЛ ═══');
await p.click('#markWrap [data-mk-close]');
await p.waitForTimeout(250);
await (await p.$$('[data-mark-i]'))[1].click();
await p.waitForTimeout(400);
const oldCard = await p.evaluate(() => {
  const w = document.getElementById('markWrap');
  return { txt:w.textContent.replace(/\s+/g, ' ').trim(),
           draws:w.querySelectorAll('.mk-draw').length,
           note:!!w.querySelector('.mk-old') };
});
ok(oldCard.note && /розмітки немає/i.test(oldCard.txt),
  'без розмітки картка каже про це прямо, а не мовчить',
  'стара позиція нічого не пояснює: ' + oldCard.txt.slice(0, 160));
ok(!/від лінії плечей/.test(oldCard.txt) && oldCard.draws === 0,
  'жодного вигаданого числа й жодного креслення з повітря',
  'намалювали розмітку, якої немає: ' + oldCard.txt.slice(0, 160));
ok(/60 × 30 мм/.test(oldCard.txt),
  'розмір нанесення лишається на місці — він у позиції був і раніше',
  'загубили розмір нанесення старої позиції');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'дизайнер отримує числа, а не «зроби гарно»');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
