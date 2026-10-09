/* НАНЕСЕННЯ ПО РОЗМІРАХ У КП (Андрій, 09.10).

   «Вишивка повинна бути різних розмірів на кожному розмірі… ми рахуємо тільки
   висоту виробу… відсоток ділиться і збільшується сама вишивка», плюс відступ
   від горловини й від центру. Макет — на базовому розмірі з «Областей
   нанесення» (M); у вікні під прорахунком КП — таблиця по кожному розміру.
   І в «Областях нанесення» — поле ширини виробу поруч із висотою.

   Запуск:  node tests/kp-sizes.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8974;
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


const ORDER = {
  id:'1', orderId:'1000042', type:'client', name:'Оксана', phone:'+380670000042',
  status:'kp', site:'main', payments:[], offerToken:'tok1',
  createdAt:new Date(Date.now() - 2 * 864e5).toISOString(),
  hist:[{ s:'kp', at:new Date(Date.now() - 864e5).toISOString() }],
  totalPrice:9000, totalCost:5400, margin:3600, marginPct:40,
  items:[{ kind:'main', name:'Худі базове', garmentId:'hoodie', qty:8, unitPrice:900, price:7200,
    unitCost:500, cost:4000, sizes:'S×2, M×5, 2XL×1',
    config:{ garmentId:'hoodie', colorId:'black', qty:{ S:2, M:5, '2XL':1 }, logos:{} },
    prints:[
      { side:'front', sideLabel:'Груди', technique:'Вишивка', widthMm:100, heightMm:60, mark:{ topMm:80, centerMm:-40 } },
      { side:'back',  sideLabel:'Спина', technique:'Вишивка', widthMm:420, heightMm:280, mark:{ topMm:100, centerMm:0 } }
    ] }]
};
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");


const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.click('.ticket');
await p.waitForTimeout(1200);
await p.click('[data-act="offered"]');
await p.waitForTimeout(3500);
const fr = f => p.evaluate(f => { const w = document.querySelector('#offerEd iframe').contentWindow; return (new w.Function('return (' + f + ')()'))(); }, f.toString());

console.log('═══ 1. РОЗРАХУНОК ═══');
/* Сітка: висота виробу S 66, M 70, L 73,5, 2XL 77 см; база — M, 70 см. */
const чисто = await fr(() => {
  const sc = { baseSize:'M', baseH:70, rows:[{ size:'S', hCm:66 }, { size:'M', hCm:70 }, { size:'L', hCm:73.5 }, { size:'2XL', hCm:77 }] };
  const t = window.__lqSizeTable({ name:'Худі', qty:{ S:2, M:5, '2XL':1 }, prints:[
    { sideLabel:'Груди', technique:'Вишивка', widthMm:100, heightMm:60, mark:{ topMm:80, centerMm:-40 } },
    { sideLabel:'Спина', technique:'Вишивка', widthMm:420, heightMm:280, mark:{ topMm:100, centerMm:0 } }] }, sc);
  return t.prints.map(pr => pr.rows.map(r => [r.size, r.wCm, r.hCmP, r.topCm, r.centerCm, r.base, r.qty, r.over]));
});
console.log('  ' + JSON.stringify(чисто));
const груди = Object.fromEntries(чисто[0].map(r => [r[0], r]));
const спина = Object.fromEntries(чисто[1].map(r => [r[0], r]));
ok(груди.M[1] === 10 && груди.M[2] === 6 && груди.M[3] === 8 && груди.M[4] === -4 && груди.M[5],
  'M — база: 10 × 6 см, 8 від горловини, −4 від центру', JSON.stringify(груди.M));
ok(груди['2XL'][1] === 11 && груди['2XL'][2] === 6.5 && груди['2XL'][3] === 9 && груди['2XL'][4] === -4.5,
  '2XL (+10 % висоти): 11 × 6,5 см, 9 від горловини, −4,5 від центру — усе пропорційно', JSON.stringify(груди['2XL']));
ok(груди.S[1] === 9.5 && груди.S[2] === 5.5 && груди.S[3] === 7.5,
  'S (−5,7 %): 9,5 × 5,5 см, 7,5 від горловини', JSON.stringify(груди.S));
ok(груди.S[6] === 2 && груди.M[6] === 5 && груди.L[6] === 0, 'кількість по розмірах — із замовлення', JSON.stringify(чисто[0].map(r => r[6])));
ok(!спина.M[7] && спина.L[7] && спина['2XL'][7], 'спина 42 × 28 на M у межах, а на L і 2XL — понад 44 × 29, позначено',
  JSON.stringify(чисто[1].map(r => [r[0], r[1], r[2], r[7]])));

console.log('');
console.log('═══ 2. ВІКНО ПІД ПРОРАХУНКОМ ═══');
await fr(() => { document.querySelector('#listBody .it').click(); });
await p.waitForTimeout(3500);
await fr(() => {
  window.SITE_CONTENT.sizecharts = Object.assign({}, window.SITE_CONTENT.sizecharts, { hoodie:[
    { size:'S', A:66, B:50 }, { size:'M', A:70, B:54 }, { size:'L', A:73.5, B:57 }, { size:'2XL', A:77, B:62 }] });
  window.SITE_CONTENT.printAreas = Object.assign({}, window.SITE_CONTENT.printAreas, { hoodie:{ scaleSize:'M', heightCm:70 } });
  document.getElementById('szOpen').click();
});
await p.waitForTimeout(400);
const вікно = await fr(() => {
  const b = document.querySelector('.sz-wrap');
  if(!b) return null;
  const rows = [...b.querySelectorAll('.sz-t')].map(t => [...t.querySelectorAll('tbody tr')].map(tr =>
    ({ cls: tr.className, td: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()), over: !!tr.querySelector('.is-over') })));
  return { текст: b.textContent.replace(/\s+/g, ' ').slice(0, 300), rows };
});
console.log('  ' + JSON.stringify(вікно && вікно.rows[0]));
ok(вікно && вікно.rows.length === 2, 'кнопка «📐 Нанесення по розмірах» відкриває вікно: по таблиці на груди й спину', JSON.stringify(вікно));
const рXXL = вікно && вікно.rows[0].find(r => r.td[0] === '2XL');
const рM = вікно && вікно.rows[0].find(r => r.td[0] === 'M');
ok(рXXL && /11 × 6,5 см/.test(рXXL.td[3]) && /\+10 %/.test(рXXL.td[2]) && /^9 см/.test(рXXL.td[4]) && /−4,5/.test(рXXL.td[5]) && /is-ord/.test(рXXL.cls),
  '2XL: +10 %, 11 × 6,5 см, 9 см від горловини, −4,5 від центру; розмір із замовлення виділено', JSON.stringify(рXXL));
ok(рM && /is-base/.test(рM.cls) && /база/.test(рM.td[2]), 'M позначено базою', JSON.stringify(рM));
ok(вікно && вікно.rows[1].some(r => r.over), 'на спині великі розміри — червоним (понад 44 × 29)', '');
const копія = await fr(() => new Promise(res => {
  let t = '';
  try{ navigator.clipboard.writeText = x => { t = x; return Promise.resolve(); }; }catch(e){}
  document.querySelector('[data-sz="copy"]').click();
  setTimeout(() => res(t), 200);
}));
ok(/Худі базове/.test(копія) && /2XL\t77\t\+10 %\t11 × 6,5/.test(копія), '«Скопіювати» — та сама таблиця текстом', копія.slice(0, 200));
if(process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
await fr(() => { document.querySelector('[data-sz="x"]').click(); });

console.log('');
console.log('═══ 3. «ОБЛАСТІ НАНЕСЕННЯ»: ШИРИНА ВИРОБУ ═══');
const поле = await p.evaluate(() => {
  const w = document.getElementById('pa-width'), h = document.getElementById('pa-height');
  return { є: !!w, поруч: !!(w && h && h.parentNode === w.parentNode) };
});
ok(поле.є && поле.поруч, 'поле «Реальна ширина виробу, см» стоїть поруч із висотою', JSON.stringify(поле));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
