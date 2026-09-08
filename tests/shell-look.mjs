/* Оболонка, згорнуте меню й випадаючі списки.

   Три речі, які видно щодня.

   МЕНЮ НЕ РОЗГОРТАЛОСЬ. Кнопка згортання в згорнутому стані їхала під низ
   логотипа й опинялась за краєм панелі: меню зменшувалось, а повернути його
   назад було нічим.

   РОБОЧЕ МІСЦЕ БУЛО СТОРІНКОЮ від краю до краю. Край екрана читався як край
   інтерфейсу, а бічне меню — як ще одна колонка з даними.

   СПИСКИ МАЛЮВАЛА ОПЕРАЦІЙНА СИСТЕМА. У Windows це сірий список 1995 року з
   квадратними кутами; поруч із рештою інтерфейсу він виглядав як шматок
   чужої програми.

   Запуск:  node tests/shell-look.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8824;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const D = n => new Date(Date.now() - n * 3600e3).toISOString();
const ORDERS = [
  { id:'1', orderId:'1009201', type:'client', name:'Оксана', phone:'+380670009201',
    status:'kp', site:'main', createdAt:D(30), hist:[], payments:[],
    totalPrice:42300, totalCost:24000, margin:18300, marginPct:43,
    items:[{ kind:'main', name:'Худі', garmentId:'hoodie', qty:50,
             unitPrice:846, price:42300, unitCost:480, cost:24000 }] }
];
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ var L=window.__ORDERS;\n' +
  '    cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ РОБОЧЕ МІСЦЕ — ПАНЕЛЬ У КОРПУСІ ═══');
const shell = await p.evaluate(() => {
  const m = document.querySelector('main');
  const cs = getComputedStyle(m);
  const body = getComputedStyle(document.body);
  const lum = s => { const n = (String(s).match(/\d+/g) || []).map(Number);
    return n.length >= 3 ? (n[0] + n[1] + n[2]) / 3 : 255; };
  return { radius: parseFloat(cs.borderRadius) || 0,
           margin: parseFloat(cs.marginLeft) || 0,
           panel: lum(cs.backgroundColor), frame: lum(body.backgroundColor) };
});
console.log('  радіус панелі ' + shell.radius + 'px · поле ' + shell.margin +
            'px · панель ' + Math.round(shell.panel) + ' на корпусі ' + Math.round(shell.frame));
ok(shell.radius >= 16,
  'панель контенту має велике округлення',
  'панель майже без округлення: ' + shell.radius);
ok(shell.frame < 80 && shell.panel > 200,
  'світла панель лежить усередині темного корпусу',
  'корпус і панель не розрізняються: ' + JSON.stringify(shell));

console.log('');
console.log('═══ ВОРОНКА: КОЛІР У ШАПЦІ, БІЛІ КАРТКИ ═══');
/* Колір етапу спершу заливав усю колонку. Шість кольорових полотнищ поруч
   роблять дошку строкатою, і білі картки на них перестають читатись як
   головне. Тепер кольорова тільки верхня плашка. */
const cols = await p.evaluate(() => {
  const c = document.querySelector('.col');
  const h = c && c.querySelector('.col-head');
  const t = document.querySelector('.ticket');
  const solid = s => !/rgba\([^)]*,\s*0\)|transparent/.test(String(s));
  return { col: c ? getComputedStyle(c).backgroundColor : '',
           colSolid: c ? solid(getComputedStyle(c).backgroundColor) : true,
           head: h ? getComputedStyle(h).backgroundColor : '',
           headSolid: h ? solid(getComputedStyle(h).backgroundColor) : false,
           headRadius: h ? parseFloat(getComputedStyle(h).borderRadius) || 0 : 0,
           tint: c ? c.style.getPropertyValue('--st-bg') : '',
           card: t ? getComputedStyle(t).backgroundColor : '' };
});
console.log('  колонка ' + cols.col + ' · шапка ' + cols.head + ' · картка ' + cols.card);
ok(!cols.colSolid,
  'під картками фону немає — робоча область спокійна',
  'колір досі залитий на всю колонку: ' + cols.col);
ok(cols.headSolid && cols.headRadius >= 10 && /^#|^rgb/.test(cols.tint),
  'колір етапу видно у шапці колонки',
  'шапка без кольору етапу: ' + JSON.stringify(cols));
ok(/255,\s*255,\s*255/.test(cols.card),
  'картки лишаються білими',
  'картка не біла: ' + cols.card);

console.log('');
console.log('═══ ЗГОРНУТЕ МЕНЮ РОЗГОРТАЄТЬСЯ НАЗАД ═══');
await p.click('#side-fold');
await p.waitForTimeout(500);
const folded = await p.evaluate(() => {
  const s = document.getElementById('sidebar');
  const b = document.getElementById('side-fold');
  const r = b.getBoundingClientRect();
  const sr = s.getBoundingClientRect();
  return { on: s.classList.contains('is-folded'),
           inside: r.top >= sr.top && r.bottom <= sr.bottom && r.left >= sr.left - 1,
           size: Math.round(r.width) + '×' + Math.round(r.height),
           w: Math.round(sr.width) };
});
console.log('  меню ' + folded.w + 'px · кнопка ' + folded.size +
            ' · у межах панелі: ' + folded.inside);
ok(folded.on && folded.inside,
  'у згорнутому меню кнопка розгортання лишається на видноті',
  'кнопку не видно: ' + JSON.stringify(folded));

await p.click('#side-fold');
await p.waitForTimeout(500);
const back = await p.evaluate(() =>
  !document.getElementById('sidebar').classList.contains('is-folded'));
ok(back, 'натиск повертає меню назад', 'меню не розгорнулось');

console.log('');
console.log('═══ ВИПАДАЮЧІ СПИСКИ — СВОГО ВИГЛЯДУ ═══');
const dressed = await p.evaluate(() => {
  const all = [...document.querySelectorAll('select')].filter(s => !s.multiple && s.offsetParent !== null || true);
  const boxes = document.querySelectorAll('.lq-sel');
  const one = document.querySelector('#board-track');
  return { selects: all.length, boxes: boxes.length,
           /* Нативний лишається живим: не display:none, інакше він зникає
              для програм читання з екрана й для будь-якої перевірки. */
           hidden: one ? getComputedStyle(one).display : '',
           radius: boxes[0] ? parseFloat(getComputedStyle(boxes[0]).borderRadius) || 0 : 0 };
});
console.log('  списків ' + dressed.selects + ' · одягнених ' + dressed.boxes +
            ' · радіус ' + dressed.radius + 'px');
ok(dressed.boxes > 0 && dressed.boxes >= Math.min(dressed.selects, 5),
  'списки одягнені у власний вигляд',
  'списки лишились нативними: ' + JSON.stringify(dressed));
ok(dressed.radius >= 10,
  'у них округлення того самого роду, що й у решти інтерфейсу',
  'кут списку не той: ' + dressed.radius);
ok(dressed.hidden !== 'none',
  'нативний список лишається в розмітці, а не ховається display:none',
  'нативний список сховано зовсім');

/* Найголовніше: вибір із власного списку справді міняє значення й шле
   change — інакше це просто гарна картинка. */
const picked = await p.evaluate(async () => {
  const sel = document.getElementById('board-track');
  const box = sel && sel.__lqBox;
  if(!box) return { err:'кнопки немає' };
  let fired = 0;
  sel.addEventListener('change', () => { fired++; }, { once:true });
  box.click();
  await new Promise(r => setTimeout(r, 200));
  const menu = document.querySelector('.lq-menu');
  const opts = menu ? [...menu.querySelectorAll('.lq-o')] : [];
  const want = opts.find(o => +o.dataset.i !== sel.selectedIndex);
  const label = want ? want.textContent.trim() : '';
  if(want) want.click();
  await new Promise(r => setTimeout(r, 200));
  return { fired, value: sel.value, label,
           shown: (box.querySelector('.lq-sel-v') || {}).textContent || '',
           closed: !document.querySelector('.lq-menu') };
});
console.log('  обрали «' + picked.label + '» → значення ' + picked.value +
            ' · на кнопці «' + (picked.shown || '').trim() + '»');
ok(picked.fired === 1 && picked.value && picked.closed,
  'вибір міняє значення, шле change і закриває меню',
  'вибір не спрацював: ' + JSON.stringify(picked));
ok((picked.shown || '').trim() === picked.label,
  'кнопка показує те, що обрали',
  'підпис кнопки розійшовся з вибором: ' + JSON.stringify(picked));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'оболонка, меню й списки виглядають як один продукт');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
