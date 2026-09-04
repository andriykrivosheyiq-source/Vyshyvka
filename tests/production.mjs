/* Виробнича картка: швачка не має вгадувати.

   На екрані біля машини рівно те, що потрібно: який виріб і скільки якого
   розміру, які файли ставити, де саме лягає нанесення — у міліметрах, — і
   фото тесту. Ні клієнта, ні цін: зайве поле на екрані колись переплутають
   із потрібним.

   І один запобіжник, який прибирає половину «а де фото?»: «тест готовий»
   без знімка не натискається. Фізично.

   Запуск:  node tests/production.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8810;
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
  { email:'test@loomiq',   name:'Ірина',  role:'production' }
];
const CONTENT = { team:TEAM, sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] } };

const PAID = {
  id:'1', orderId:'1000701', type:'client', name:'Оксана', phone:'+380670000701',
  company:'Кава Друзі', status:'paid', site:'main',
  prodAt:new Date().toISOString(),
  tracks:{ design:'ok', supply:'got', test:'work', prod:'lock', qc:'wait', ship:'wait' },
  art:[{ n:3, at:new Date().toISOString(), by:'des@loomiq',
         files:[{ kind:'front', name:'1000701_front_v3', url:'https://files.example/f.dst' },
                { kind:'back',  name:'1000701_back_v3',  url:'https://files.example/b.dst' }],
         wilcom:'https://files.example/w.png', photo:'',
         approvals:{ art:{ by:'owner@loomiq', at:new Date().toISOString(), note:'' } } }],
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'owner@loomiq' }],
  createdAt:new Date(Date.now() - 864e5).toISOString(), hist:[], dueAt:'2026-12-01',
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000,
           sizeQty:{ S:10, M:20, L:20 },
           prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка',
                     widthMm:80, heightMm:45, file:'https://files.example/logo.png',
                     mark:{ topMm:85, centerMm:0, rotDeg:0,
                            zone:{ top:60, left:-130, w:260, h:340,
                                   poly:[-130,60, 130,60, 130,400, -130,400] } } }] }]
};
/* Це замовлення ще продають — на дошці дизайну його бути не має. */
const FRESH = {
  id:'2', orderId:'1000702', type:'client', name:'Ігор', phone:'+380670000702',
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


console.log('═══ ДОШКА ВИРОБНИЦТВА ═══');
const p = await open('test@loomiq');
const board = await p.evaluate(() => ({
  role: myRole(),
  cols: [...document.querySelectorAll('#board .col .col-head h3')].map(h => h.textContent.trim()),
  sw: [...document.querySelectorAll('#board-track option')].map(o => o.textContent.trim()),
  nav: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).map(b => b.dataset.view),
  tickets: [...document.querySelectorAll('#board .ticket')].map(t => t.textContent.replace(/\s+/g, ' ').trim())
}));
console.log('  роль: ' + board.role + ' · дошки: ' + board.sw.join(' | '));
console.log('  колонки: ' + board.cols.join(' · '));
ok(board.role === 'production', 'роль береться зі списку команди', 'роль не та: ' + board.role);
ok(board.sw.length === 3 && /Тест/.test(board.sw[0]),
  'у виробництва три свої дошки — тест, тираж, контроль',
  'дошки не ті: ' + board.sw.join(' | '));
ok(board.cols.join() === 'Очікує,У роботі,На внутрішній перевірці,У клієнта,Тест погоджено',
  'перша дошка — тест, і колонки її',
  'колонки не ті: ' + board.cols.join(' · '));
ok(board.nav.join() === 'board',
  'у меню одна дошка',
  'виробництво бачить зайві розділи: ' + board.nav.join(','));
ok(board.tickets.length === 1 && !/Оксана|380670000701|25 000/.test(board.tickets[0]),
  'на картці ні клієнта, ні телефону, ні суми',
  'на картку виробництва потрапило зайве: ' + board.tickets[0]);
ok(/S 10 · M 20 · L 20|S 10, M 20, L 20/.test(board.tickets[0]) || /10/.test(board.tickets[0]),
  'зате видно розмірний ряд — те, що шиють',
  'розмірного ряду на картці немає: ' + board.tickets[0]);

console.log('');
console.log('═══ ФАЙЛИ НА МАШИНУ ═══');
await p.click('#board .ticket');
await p.waitForTimeout(900);
const card = await p.evaluate(() => {
  const d = document.getElementById('orderDrawer');
  return {
    txt: d.textContent.replace(/\s+/g, ' ').trim(),
    files: [...d.querySelectorAll('.art-file')].map(a => a.textContent.trim()),
    marks: d.querySelectorAll('[data-mark-i]').length,
    tracks: [...d.querySelectorAll('.od-trk-sel')].map(s => s.dataset.track),
    shoot: d.querySelectorAll('[data-art-pick="photo"]').length,
    sizes: d.querySelectorAll('[data-sz-item]').length
  };
});
console.log('  файли: ' + card.files.join(' · '));
ok(card.files.length === 2 && /front_v3/.test(card.files[0]),
  'на екрані файли поточної версії, підписані версією',
  'файлів не видно: ' + JSON.stringify(card.files));
ok(card.tracks.join() === 'test,prod,qc',
  'три треки виробництва — і жодного чужого',
  'треки не ті: ' + card.tracks.join(','));
ok(card.marks === 1 && card.sizes >= 3,
  'розмітка й розмірний ряд — на місці',
  'робочих даних немає: розмітка ' + card.marks + ', розміри ' + card.sizes);
ok(card.shoot === 1,
  'кнопка «Зняти тест» стоїть там, де її шукають — біля файлів',
  'кнопки знімка немає');
ok(!/Оксана|Собівартість|Маржа/.test(card.txt),
  'у панелі теж ні клієнта, ні цін',
  'у виробничу картку потрапило зайве');

console.log('');
console.log('═══ «ТЕСТ ГОТОВИЙ» БЕЗ ФОТО НЕ НАТИСКАЄТЬСЯ ═══');
const blocked = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000701');
  await setTrack(o, 'test', 'inner');
  return { step:(o.tracks || {}).test,
           toast:(document.querySelector('.toast') || {}).textContent || '' };
});
console.log('  ' + blocked.toast.trim());
ok(blocked.step === 'work',
  'без знімка трек лишився там, де був',
  'тест поїхав далі без фото: ' + blocked.step);
ok(/фото відшиву/i.test(blocked.toast),
  'і сказано, чого саме бракує',
  'причину не назвали: ' + blocked.toast);

const passed = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000701');
  o.art[0].photo = 'https://files.example/test.jpg';
  await setTrack(o, 'test', 'inner');
  return (o.tracks || {}).test;
});
ok(passed === 'inner',
  'зняли фото — і той самий крок проходить',
  'із фото трек усе одно не пішов: ' + passed);
await p.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'біля машини видно рівно те, що потрібно біля машини');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
