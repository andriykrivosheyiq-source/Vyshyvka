/* Доступи по зонах: роль — це пресет, а не вирок.

   Люди не діляться на чотири види. Буває менеджер, якому треба бачити
   собівартість, і дизайнер, який заодно веде конструктор сайту. Тому роль
   лише заповнює галочки, а далі кожному вмикається рівно те, що потрібно:
   розділи меню, дошки, що видно в картці, що можна міняти. Формат картки —
   окремо: це не право, а вигляд.

   Перевіряємо:
     — людина бачить у меню тільки свої розділи, і її не лишає на закритому;
     — дошки в перемикачі — тільки її;
     — «бачить» і «може» справді щось міняють у картці, а не малюють
       галочку в налаштуваннях;
     — роль перезаписує галочки пресетом, а власні галочки живуть далі;
     — кого немає в списку — менеджер, а порожній список означає повний
       доступ (інакше перше збереження замкнуло б систему).

   Запуск:  node tests/access.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8811;
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
  id:'1', orderId:'1000801', type:'client', name:'Оксана', phone:'+380670000801',
  status:'paid', site:'main', prodAt:new Date().toISOString(),
  tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'owner@loomiq' }],
  createdAt:new Date().toISOString(), hist:[], tgChatId:'42', tgWrote:true, tgLast:'Вітаю',
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000 }]
};

/* Двоє людей із однаковою роллю «менеджер», але різними галочками — саме те,
   заради чого все це й робиться. */
const TEAM = [
  { email:'owner@loomiq', name:'Андрій', role:'owner' },
  { email:'test@loomiq',  name:'Марія',  role:'manager',
    acc:{ ui:'manager', nav:['board','analytics'], boards:['sale','design'],
          see:['client','cost'], can:[] } }
];

function stub(email, team){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify({ team }) + ';\n  window.firebase={');
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
async function open(email, team){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(email + ': ' + e.message.slice(0, 170)));
  p.on('dialog', d => d.accept('ok'));
  const body = stub(email, team);
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

console.log('═══ СВОЇ ЗОНИ, А НЕ ЧУЖА РОЛЬ ═══');
const p = await open('test@loomiq', TEAM);
const view = await p.evaluate(() => ({
  role: myRole(), ui: myUi(),
  nav: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).map(b => b.dataset.view),
  boards: [...document.querySelectorAll('#board-track option')].map(o => o.value),
  cost: canSeeCost(), chat: canSeeChat(), edit: canEditItems(), pay: canPay(), setup: canSetup(),
  stHidden: document.getElementById('st-toggle').hidden,
  addHidden: document.getElementById('board-add').hidden
}));
console.log('  роль ' + view.role + ' · інтерфейс ' + view.ui);
console.log('  розділи: ' + view.nav.join(', ') + ' · дошки: ' + view.boards.join(', '));
ok(view.nav.join() === 'board,analytics',
  'у меню лише ті розділи, які їй увімкнули — не за роллю, а за галочками',
  'розділи не ті: ' + view.nav.join(','));
ok(view.boards.join() === 'sale,design',
  'у перемикачі лише її дошки',
  'дошки не ті: ' + view.boards.join(','));
ok(view.cost === true,
  'менеджер із галочкою «собівартість» її бачить — роль тут ні до чого',
  'галочка собівартості не спрацювала');
ok(view.chat === false && view.edit === false && view.pay === false && view.setup === false,
  'а те, чого не вмикали, вимкнене — включно з листуванням і оплатою',
  'зайві права: ' + JSON.stringify(view));
ok(view.stHidden && view.addHidden,
  '«налаштувати етапи» й «нова картка» зникли разом із правами',
  'кнопки лишились попри відсутність прав');

console.log('');
console.log('═══ ГАЛОЧКИ МІНЯЮТЬ КАРТКУ, А НЕ ТІЛЬКИ НАЛАШТУВАННЯ ═══');
await p.click('.ticket:has-text("1000801")');
await p.waitForTimeout(900);
const card = await p.evaluate(() => {
  const d = document.getElementById('orderDrawer');
  return {
    folds: [...d.querySelectorAll('.od-fold-t')].map(x => x.textContent.trim()),
    chat: d.querySelectorAll('[data-chat]').length,
    qty: d.querySelectorAll('.od-qty').length,
    del: d.querySelectorAll('[data-del-i]').length,
    fin: [...d.querySelectorAll('.od-fold-t')].some(x => /Фінанси/.test(x.textContent))
  };
});
console.log('  смуги: ' + card.folds.join(' · '));
ok(!card.folds.some(f => /Оплата/.test(f)),
  'без права на оплату смуги «Оплата» немає',
  'смуга оплати лишилась: ' + card.folds.join(','));
ok(card.fin,
  'зате «Фінанси» на місці — собівартість їй видно',
  'фінанси зникли, хоч право є');
ok(card.chat === 0,
  'кнопок розмови немає — листування не її зона',
  'кнопки розмови лишились: ' + card.chat);
ok(card.qty === 0 && card.del === 0,
  'кількість і видалення позиції не редагуються',
  'склад можна міняти без права: ' + JSON.stringify(card));

console.log('');
console.log('═══ РОЛЬ — ПРЕСЕТ, А НЕ ВИРОК ═══');
const preset = await p.evaluate(() => {
  const a = accOf({ role:'designer' });
  const b = accOf({ role:'manager', acc:{ ui:'manager', nav:['board'], boards:['sale'],
                                          see:['cost'], can:['pay'] } });
  return { d:{ ui:a.ui, nav:a.nav, boards:a.boards }, m:{ see:b.see, can:b.can, nav:b.nav } };
});
console.log('  дизайнер за пресетом: ' + JSON.stringify(preset.d));
ok(preset.d.ui === 'designer' && preset.d.boards.join() === 'design',
  'людина без власних галочок працює за пресетом ролі',
  'пресет ролі не спрацював: ' + JSON.stringify(preset.d));
ok(preset.m.see.join() === 'cost' && preset.m.can.join() === 'pay',
  'а власні галочки головніші за пресет',
  'власні галочки загубились: ' + JSON.stringify(preset.m));
await p.close();

console.log('');
console.log('═══ ЗАПОБІЖНИКИ ═══');
{
  /* Кого немає в списку — менеджер. Порожній список — повний доступ:
     інакше перше ж збереження замкнуло б систему від самого власника. */
  const p2 = await open('stranger@loomiq', TEAM);
  const st = await p2.evaluate(() => ({ role:myRole(), cost:canSeeCost(),
    nav:[...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).length }));
  ok(st.role === 'manager' && st.cost === false && st.nav > 1,
    'кого немає в списку — менеджер: працює, але без цифр',
    'чужа пошта отримала не те: ' + JSON.stringify(st));
  await p2.close();

  const p3 = await open('nobody@loomiq', []);
  const empty = await p3.evaluate(() => ({ cost:canSeeCost(), setup:canSetup(),
    nav:[...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).length }));
  ok(empty.cost && empty.setup && empty.nav === 7,
    'порожній список — доступ повний, як і було',
    'порожній список щось замкнув: ' + JSON.stringify(empty));
  await p3.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'кожному видно рівно те, що йому вмикали');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
