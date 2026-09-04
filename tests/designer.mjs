/* Роль дизайнера й дошка дизайну.

   Перша реальна перевірка, чи модель жива: та сама картка, той самий
   документ — але людина бачить своє вікно в нього. Дизайнеру потрібні
   чотири речі: що шиємо, де саме на виробі, який файл прислав клієнт і на
   якій версії ми стоїмо. Клієнт, телефон, ціни й листування сюди не
   приходять — не тому, що таємниця, а тому, що зайве поле на екрані колись
   переплутають із потрібним.

   Перевіряємо:
     — дошка дизайнера складена з кроків треку дизайну, а не з етапів
       продажу;
     — на ній лише оплачені замовлення: у тих, що ще продають, дизайнеру
       робити нічого;
     — на картці й у панелі немає ні клієнта, ні телефону, ні сум;
     — перетягування між колонками рухає трек, а не етап продажу;
     — у бічному меню в дизайнера одна дошка;
     — власник ті самі картки бачить у своєму вікні — з клієнтом і сумами.

   Запуск:  node tests/designer.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8809;
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

/* Команда заведена: сама наявність списку й вмикає ролі. */
const TEAM = [
  { email:'owner@loomiq',  name:'Андрій', role:'owner' },
  { email:'test@loomiq',   name:'Ірина',  role:'designer' }
];
const CONTENT = { team:TEAM, sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };

const PAID = {
  id:'1', orderId:'1000601', type:'client', name:'Оксана', phone:'+380670000601',
  company:'Кава Друзі', status:'paid', site:'main',
  prodAt:new Date().toISOString(),
  tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'owner@loomiq' }],
  createdAt:new Date(Date.now() - 864e5).toISOString(), hist:[], dueAt:'2026-12-01',
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000,
           prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка',
                     widthMm:80, heightMm:45, file:'https://files.example/logo.png',
                     mark:{ topMm:85, centerMm:0, rotDeg:0,
                            zone:{ top:60, left:-130, w:260, h:340,
                                   poly:[-130,60, 130,60, 130,400, -130,400] } } }] }]
};
/* Це замовлення ще продають — на дошці дизайну його бути не має. */
const FRESH = {
  id:'2', orderId:'1000602', type:'client', name:'Ігор', phone:'+380670000602',
  status:'kp', site:'main', payments:[], items:[],
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:0, totalCost:0, margin:0, marginPct:0
};

function stub(email){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([PAID, FRESH]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
  s = s.replace(/email:'test@loomiq'/g, "email:'" + email + "'");
  s = s.replace(
    'Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace(
    'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
    'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace(
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
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
async function open(email){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(email + ': ' + e.message.slice(0, 170)));
  p.on('dialog', d => d.accept('ok'));
  const body = stub(email);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}

console.log('═══ ДОШКА ДИЗАЙНЕРА ═══');
const p = await open('test@loomiq');
const board = await p.evaluate(() => ({
  role: myRole(),
  cols: [...document.querySelectorAll('#board .col .col-head h3')].map(h => h.textContent.trim()),
  tickets: [...document.querySelectorAll('#board .ticket')].map(t => (t.querySelector('.t-oid') || {}).textContent),
  nav: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).map(b => b.dataset.view),
  swHidden: document.getElementById('board-track').hidden,
  addHidden: document.getElementById('board-add').hidden
}));
console.log('  роль: ' + board.role);
console.log('  колонки: ' + board.cols.join(' · '));
ok(board.role === 'designer', 'роль береться зі списку команди', 'роль не та: ' + board.role);
ok(board.cols.join() === 'Нові,В роботі,На перевірці,Правки,Макет погоджено',
  'колонки — кроки треку дизайну, а не етапи продажу',
  'колонки не ті: ' + board.cols.join(' · '));
ok(board.tickets.length === 1 && board.tickets[0] === '1000601',
  'на дошці лише оплачене — у тому, що ще продають, дизайнеру робити нічого',
  'на дошці не те: ' + JSON.stringify(board.tickets));
ok(board.nav.join() === 'board',
  'у меню одна дошка — ніяких вкладок, у які нема чого відкривати',
  'дизайнер бачить зайві розділи: ' + board.nav.join(','));
ok(board.swHidden && board.addHidden,
  'перемикача дощок і «нової картки» в дизайнера немає',
  'дизайнеру показали чужі кнопки');

console.log('');
console.log('═══ НІ КЛІЄНТА, НІ ГРОШЕЙ ═══');
const card = await p.evaluate(() => {
  const t = document.querySelector('#board .ticket');
  return { txt:t.textContent.replace(/\s+/g, ' ').trim() };
});
console.log('  картка: ' + card.txt);
ok(!/Оксана|380670000601|25 000|Кава/.test(card.txt),
  'на картці немає ні імені, ні телефону, ні суми',
  'на картку дизайнера потрапило зайве: ' + card.txt);
ok(/1000601/.test(card.txt) && /80×45/.test(card.txt),
  'зате є номер і розмір нанесення — те, з чим працюють',
  'на картці немає робочих даних: ' + card.txt);

await p.click('#board .ticket');
await p.waitForTimeout(900);
const drawer = await p.evaluate(() => {
  const d = document.getElementById('orderDrawer');
  return { txt:d.textContent.replace(/\s+/g, ' ').trim(),
           mark:d.querySelectorAll('[data-mark-i]').length,
           art:d.querySelectorAll('[data-fold="art"]').length,
           folds:[...d.querySelectorAll('.od-fold-t')].map(x => x.textContent.trim()),
           file:d.querySelectorAll('.t-web-file').length };
});
console.log('  смуги: ' + drawer.folds.join(' · '));
ok(!/Оксана|380670000601|Собівартість|Маржа|25 000/.test(drawer.txt),
  'у панелі теж немає ні клієнта, ні цін',
  'у панель дизайнера потрапило зайве');
ok(drawer.folds.join() === 'Макет' && drawer.art === 1,
  'єдина смуга — «Макет»: усе інше дизайнеру не потрібне',
  'смуги не ті: ' + drawer.folds.join(','));
ok(drawer.mark === 1 && drawer.file === 1,
  'розмітка й файл клієнта — на місці',
  'робочих кнопок немає: розмітка ' + drawer.mark + ', файл ' + drawer.file);

console.log('');
console.log('═══ РУХ ПО ДОШЦІ РУХАЄ ТРЕК ═══');
await p.evaluate(() => { closeOrderDrawer(); });
await p.waitForTimeout(300);
await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000601');
  await setTrack(o, 'design', 'check');
});
await p.waitForTimeout(700);
const moved = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000601');
  const cols = [...document.querySelectorAll('#board .col')];
  const where = cols.findIndex(c => c.querySelector('.ticket'));
  return { track:(o.tracks || {}).design, status:o.status,
           col:(cols[where].querySelector('.col-head h3') || {}).textContent.trim() };
});
console.log('  картка тепер у колонці «' + moved.col + '»');
ok(moved.track === 'check' && moved.col === 'На перевірці',
  'картка переїхала колонкою треку',
  'трек і колонка розійшлись: ' + JSON.stringify(moved));
ok(moved.status === 'paid',
  'етап продажу при цьому не зрушив — це різні речі',
  'дизайнер посунув продаж: ' + moved.status);
await p.close();

console.log('');
console.log('═══ ВЛАСНИК БАЧИТЬ ТЕ САМЕ СВОЇМ ВІКНОМ ═══');
{
  const p2 = await open('owner@loomiq');
  const own = await p2.evaluate(() => ({
    role: myRole(),
    cols: [...document.querySelectorAll('#board .col .col-head h3')].map(h => h.textContent.trim()),
    nav: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).length,
    sw: !document.getElementById('board-track').hidden,
    txt: [...document.querySelectorAll('#board .ticket')].map(t => t.textContent).join(' ')
  }));
  ok(own.role === 'owner' && own.nav > 1 && own.sw,
    'у власника всі розділи й перемикач дощок',
    'власника обмежили: ' + JSON.stringify(own));
  ok(own.cols.indexOf('Оплачено') >= 0,
    'його дошка за замовчуванням — продажі',
    'дошка власника не та: ' + own.cols.join(' · '));
  ok(/Оксана/.test(own.txt),
    'і клієнта він бачить — картка одна, вікна різні',
    'власник не бачить клієнта');
  /* Те саме замовлення, те саме вікно дизайнера — власник може подивитись. */
  await p2.selectOption('#board-track', 'design');
  await p2.waitForTimeout(600);
  const asDesign = await p2.evaluate(() => ({
    cols: [...document.querySelectorAll('#board .col .col-head h3')].map(h => h.textContent.trim()),
    txt: (document.querySelector('#board .ticket') || {}).textContent || ''
  }));
  ok(asDesign.cols.join() === 'Нові,В роботі,На перевірці,Правки,Макет погоджено',
    'перемикач відкриває власнику дошку дизайну',
    'перемикач не спрацював: ' + asDesign.cols.join(' · '));
  ok(/Оксана/.test(asDesign.txt),
    'але картку він і там бачить свою, повну — вікно не міняє прав',
    'вікно підмінило права власника');
  await p2.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'одна картка, різні вікна — і кожен бачить своє');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
