/* Заготовлені повідомлення правляться там, де ними користуються.

   Список готових повідомлень жив у діалозі за іконкою-блискавкою без
   підпису. Редагування в ньому було, але про нього ніхто не знав: людина
   бачила список і не здогадувалась, що текст можна змінити й зберегти.

   Тепер панель називає себе вголос, кнопка виклику підписана словом, а
   олівець стоїть біля кожного рядка — правку роблять там, де заготовку й
   читають.

   Перевіряємо:
     — панель відкривається підписаною кнопкою й пояснює, що з нею робити;
     — біля кожної заготовки є олівець;
     — правка тексту зберігається в базу й одразу видно в списку;
     — можна завести нову заготовку;
     — вставка підставляє свіже посилання на КП, а не текст із {кп}.

   Запуск:  node tests/quick-replies.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8813;
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

const CONTENT = {
  quickReplies:[
    { t:'КП готове', m:'Вітаю, {імʼя}! Ось пропозиція: {кп}' },
    { t:'Нагадування', m:'Доброго дня! Чи встигли подивитись пропозицію?' }
  ]
};
/* Замовлення з розмовою в Telegram — інакше вікна діалогу немає. */
const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Оксана', phone:'+380670001001',
  status:'kp', site:'main', offerToken:'tok123456', payments:[],
  tgChatId:'4242', tgWrote:true, tgLast:'Вітаю', tgAt:new Date().toISOString(),
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000, unitCost:350, cost:7000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Doc.prototype.set=function(){ return Promise.resolve(); };',
  'Doc.prototype.set=function(d){ (window.__SET=window.__SET||[]).push(d); return Promise.resolve(); };');
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
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ ПАНЕЛЬ НАЗИВАЄ СЕБЕ ВГОЛОС ═══');
await p.evaluate(() => chatOpen(orders[0], 'tg'));
await p.waitForTimeout(800);
const btn = await p.evaluate(() => {
  const b = document.querySelector('[data-cw-qr]');
  return { txt:(b && b.textContent || '').trim(), has:!!b };
});
console.log('  кнопка: ' + btn.txt);
ok(btn.has && /Заготовки/.test(btn.txt),
  'кнопка виклику підписана словом, а не самою іконкою',
  'кнопка мовчить: ' + JSON.stringify(btn));

await p.click('[data-cw-qr]');
await p.waitForTimeout(500);
const panel = await p.evaluate(() => {
  const box = document.querySelector('.cw-qr');
  return {
    head:(box.querySelector('.cw-qr-head') || {}).textContent.replace(/\s+/g,' ').trim(),
    rows:box.querySelectorAll('.cw-qr-row').length,
    pens:box.querySelectorAll('[data-qr-edit]:not(.cw-qr-add)').length,
    add:!!box.querySelector('.cw-qr-add')
  };
});
console.log('  ' + panel.head);
ok(/Заготовлені повідомлення/.test(panel.head) && /змінити текст/.test(panel.head),
  'панель пояснює, що з нею робити',
  'панель нічого не пояснює: ' + panel.head);
ok(panel.rows === 2 && panel.pens === 2 && panel.add,
  'біля кожної заготовки олівець, унизу — «нова»',
  'список не той: ' + JSON.stringify(panel));

console.log('');
console.log('═══ ПРАВКА ЗБЕРІГАЄТЬСЯ ═══');
await p.click('[data-qr-edit="1"]');
await p.waitForTimeout(400);
await p.fill('.cw-qr-in-t', 'Нагадування 2');
await p.fill('.cw-qr-in-m', 'Доброго дня! Пропозиція ще актуальна: {кп}');
await p.click('[data-qr-save]');
await p.waitForTimeout(800);
const saved = await p.evaluate(() => {
  const w = (window.__SET || []).filter(x => x && x.quickReplies).pop();
  return { wrote:w ? w.quickReplies : null,
           list:quickReplies().map(q => q.t),
           shown:[...document.querySelectorAll('.cw-qr-t')].map(x => x.textContent.trim()) };
});
console.log('  у базі: ' + JSON.stringify((saved.wrote || []).map(q => q.t)));
ok(saved.wrote && saved.wrote.length === 2 && saved.wrote[1].t === 'Нагадування 2' &&
   /ще актуальна/.test(saved.wrote[1].m),
  'відредагований текст пішов у базу',
  'правка не збереглась: ' + JSON.stringify(saved.wrote));
ok(saved.shown.join() === 'КП готове,Нагадування 2',
  'і одразу видно в списку — без перезаходу',
  'список не оновився: ' + saved.shown.join(','));

console.log('');
console.log('═══ НОВА ЗАГОТОВКА ═══');
await p.click('.cw-qr-add');
await p.waitForTimeout(400);
await p.fill('.cw-qr-in-t', 'Оплата');
await p.fill('.cw-qr-in-m', 'Реквізити для оплати: …');
await p.click('[data-qr-save]');
await p.waitForTimeout(800);
const added = await p.evaluate(() => quickReplies().map(q => q.t));
console.log('  ' + added.join(' · '));
ok(added.length === 3 && added[2] === 'Оплата',
  'нова заготовка стає в кінець списку',
  'нову заготовку не додано: ' + added.join(','));

console.log('');
console.log('═══ ВСТАВКА ПІДСТАВЛЯЄ СВІЖЕ ПОСИЛАННЯ ═══');
await p.click('[data-qr="0"]');
await p.waitForTimeout(500);
const draft = await p.evaluate(() => (document.querySelector('.cw-inp') || {}).value || '');
console.log('  ' + draft);
ok(/Оксана/.test(draft) && /tok123456/.test(draft) && !/\{кп\}/.test(draft),
  'у полі готовий текст із іменем і посиланням, а не {кп}',
  'підстановка не спрацювала: ' + draft);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'заготовки правляться там, де ними користуються');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
