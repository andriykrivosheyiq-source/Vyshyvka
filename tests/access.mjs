/* Доступи по зонах: галочки стоять у РОЛІ, а не в людині.

   Спершу роль лише ЗАПОВНЮВАЛА галочки, а далі кожному вмикали своє.
   Звучало гнучко, а виходило навпаки: у пʼяти менеджерів пʼять різних
   наборів, і на питання «що бачить менеджер» чесної відповіді немає. Через
   півроку ніхто не памʼятає, чому в однієї є собівартість, а в другої ні.

   Тому роль тепер — окремий запис зі своїм набором прав, а людині її просто
   призначають. Треба комусь інакше — заводять НОВУ РОЛЬ: тоді і назва є, і
   наступного разу її дадуть другому такому ж. Формат картки всередині ролі:
   це не право, а вигляд.

   Перевіряємо:
     — людина бачить у меню тільки розділи своєї ролі, і її не лишає на
       закритому;
     — дошки в перемикачі — тільки її;
     — «бачить» і «може» справді щось міняють у картці, а не малюють
       галочку в налаштуваннях;
     — двом людям з однією роллю видно те саме, а старі індивідуальні
       набори вже нічого не означають;
     — кожна галочка «може робити» — справжній замок: немає права, немає й
       кнопки, а не «кнопка є, але не спрацює»;
     — роль, збережена до появи нового права, не втрачає того, що могла:
       хто бачив листування, той і пише далі;
     — кого немає в списку — не бачить нічого, а порожній список означає
       повний доступ (інакше перше збереження замкнуло б систему).

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

/* Окрема роль під окрему роботу — саме те, заради чого все це й робиться.
   «Продажі з собівартістю» це не менеджер із домальованою галочкою, а роль
   із назвою: її видно в списку, і наступного разу її дадуть другому
   такому ж. */
/* `navAll` і `canAll` — перелік розділів і прав, які існували в мить
   збереження. Саме так виглядає роль, збережена сьогодні: її беруть
   буквально, нічого не добираючи. Роль без цих міток — стара, і для неї є
   окрема перевірка нижче. */
const ALL_NAV = ['today','board','chats','chatsc','design','calc','settings',
                 'photos','reviews','suppliers','analytics','team'];
const ALL_CAN = ['new','edit','stage','assign','pay','del','export',
                 'write','files','quick','bind',
                 'art','approve','stitch','qc','pack',
                 'pricing','catalog','reviews','suppliers','setup'];
const повна = r => Object.assign({ navAll:ALL_NAV, canAll:ALL_CAN }, r);
const ROLE_DEFS = [
  повна({ key:'owner', name:'Власник', ui:'manager', nav:'*', boards:'*',
    see:['client','chat','cost'], can:ALL_CAN.slice() }),
  повна({ key:'sales', name:'Продажі з собівартістю', ui:'manager',
    nav:['board','analytics'], boards:['sale','design'],
    see:['client','cost'], can:[] }),
  повна({ key:'designer', name:'Дизайнер', ui:'designer',
    nav:['today','board','design'], boards:['design'], see:[], can:[] })
];
const TEAM = [
  { email:'owner@loomiq', name:'Андрій', role:'owner' },
  { email:'test@loomiq',  name:'Марія',  role:'sales' }
];

function stub(email, team){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify({ team, roles: ROLE_DEFS }) + ';\n  window.firebase={');
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
  'у меню лише ті розділи, які відкриває її роль',
  'розділи не ті: ' + view.nav.join(','));
ok(view.boards.join() === 'sale,design',
  'у перемикачі лише її дошки',
  'дошки не ті: ' + view.boards.join(','));
ok(view.cost === true,
  'роль із собівартістю її показує — і це видно з назви ролі, а не з галочки в людині',
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
console.log('═══ ОДНА РОЛЬ — ОДНА ВІДПОВІДЬ ═══');
const однаково = await p.evaluate(() => {
  const а = accOf({ email:'a@b', role:'sales' });
  /* Старий індивідуальний набір галочок. Такі лишились у записах від часів,
     коли права роздавали поштучно, — і саме вони робили роль приблизною.
     Запис нікуди не дівся, але вже нічого не означає. */
  const б = accOf({ email:'c@d', role:'sales',
    acc:{ ui:'manager', nav:'*', boards:'*', see:['client','chat','cost'],
          can:['edit','pay','del','setup'] } });
  const д = accOf({ email:'e@f', role:'designer' });
  return { однакові: JSON.stringify(а) === JSON.stringify(б),
           зайве: б.can.filter(k => ['setup','del','edit','pay'].indexOf(k) >= 0),
           інша: { ui:д.ui, boards:д.boards.join() } };
});
console.log('  дві людини однієї ролі: ' + JSON.stringify(однаково));
ok(однаково.однакові && !однаково.зайве.length,
  'двом людям з однією роллю видно те саме — старі власні галочки вже нічого не значать',
  'роль досі приблизна: ' + JSON.stringify(однаково));
ok(однаково.інша.ui === 'designer' && однаково.інша.boards === 'design',
  'а інша роль відкриває інше — і це записано в ній, а не в людях',
  'роль нічого не вирішує: ' + JSON.stringify(однаково));

console.log('');
console.log('═══ КОЖНА ГАЛОЧКА — СПРАВЖНІЙ ЗАМОК ═══');
/* Доти «що там робити» не описувалось майже ніяк: розділ чатів або
   відкритий повністю, або закритий. Відкрив — і людина вже й пише клієнту, і
   править спільні заготовки, і відвʼязує розмову від замовлення. Те саме з
   цінами, каталогом і макетами.

   Тепер у кожної дії власне право. Правило одне: НЕМАЄ ПРАВА — НЕМАЄ Й
   КНОПКИ. Кнопка, яка є й не працює, гірша за відсутню: людина вважає, що
   зламалась система, і йде питати, замість того щоб працювати. */
const замки = await p.evaluate(async () => {
  const було = JSON.stringify(contentData.roles || []);
  /* Роль, якій відкрито геть усе, крім однієї дії. Так видно рівно те, що
     відрізає САМА дія, а не сусідні галочки. */
  const крім = k => {
    contentData.roles = [{ key:'sales', name:'Проба', ui:'manager', nav:'*', boards:'*',
      see:['client','chat','cost'],
      can: ZONE_CAN.map(z => z.key).filter(x => x !== k),
      canAll: ZONE_CAN.map(z => z.key) }];
    contentData.team = [{ email:myEmail(), name:'Я', role:'sales', dirs:['b2b','b2c'] }];
    teamDraft = null; applyRoleUi();
  };
  const out = {};
  крім('new');    out.new    = { є:!document.getElementById('board-add').hidden };
  крім('');       out.newOn  = { є:!document.getElementById('board-add').hidden };
  крім('stage');  renderBoard();
  out.stage = { тягнеться:[...document.querySelectorAll('.ticket')].some(t => t.draggable) };
  крім('');       renderBoard();
  out.stageOn = { тягнеться:[...document.querySelectorAll('.ticket')].some(t => t.draggable) };
  /* Картка замовлення: етап, відповідальний, привʼязка розмови. */
  const карта = () => { renderOrderDrawer(); const d = document.getElementById('orderDrawer');
    return { етап:!!(d.querySelector('.od-stage') || {}).disabled,
             хтоВеде:!!(d.querySelector('.od-mgr-sel') || {}).disabled }; };
  await openOrderDrawer(orders[0]);
  крім('stage');  Object.assign(out, { етапЗамкнено: карта().етап });
  крім('assign'); Object.assign(out, { вестиЗамкнено: карта().хтоВеде });
  крім('');       Object.assign(out, { обидваВільні: !карта().етап && !карта().хтоВеде });
  closeOrderDrawer();
  contentData.roles = JSON.parse(було); teamDraft = null; applyRoleUi();
  return out;
});
console.log('   ' + JSON.stringify(замки));
ok(!замки.new.є && замки.newOn.є,
  'без права «створювати замовлення» кнопки «Нова картка» немає зовсім',
  'кнопка заведення лишилась: ' + JSON.stringify(замки));
ok(!замки.stage.тягнеться && замки.stageOn.тягнеться,
  'без права «двигати далі» картку не перетягнути — вона просто не береться',
  'картку тягають без права: ' + JSON.stringify(замки));
ok(замки.етапЗамкнено && замки.вестиЗамкнено && замки.обидваВільні,
  'етап і відповідальний у картці міняються лише з відповідним правом',
  'поля картки не звіряються з правами: ' + JSON.stringify(замки));

console.log('');
console.log('═══ СТАРА РОЛЬ НЕ ВТРАЧАЄ ТОГО, ЩО МОГЛА ═══');
/* Роль зберігається СПИСКОМ дозволеного. Щойно зʼявляється нове право,
   кожна вже збережена роль його не має — і менеджер, який учора писав
   клієнтам, зранку не може написати нікому. Тому для нових прав дивимось,
   що людина могла раніше, і видаємо рівно стільки ж. */
const старе = await p.evaluate(() => {
  const було = JSON.stringify(contentData.roles || []);
  /* Рівно так роль і виглядала до появи нових прав: дві дії й жодного
     `canAll` — переліку прав, які тоді взагалі існували. */
  contentData.roles = [{ key:'old', name:'Давня', ui:'manager',
    nav:['board','chats','settings'], boards:'*',
    see:['client','chat','cost'], can:['edit','pay'] }];
  const a = presetOf('old');
  contentData.roles = JSON.parse(було); teamDraft = null;
  return { can:a.can.slice().sort() };
});
console.log('   ' + JSON.stringify(старе.can));
ok(старе.can.indexOf('write') >= 0 && старе.can.indexOf('stage') >= 0 &&
   старе.can.indexOf('pricing') >= 0 && старе.can.indexOf('del') < 0,
  'хто бачив листування — той і пише; хто міняв склад — той і двигає; а чого не мав, того й не отримав',
  'стара роль поїхала: ' + JSON.stringify(старе));

await p.close();
console.log('');
console.log('═══ ЗАПОБІЖНИКИ ═══');
{
  /* Кого немає в списку — НЕ БАЧИТЬ НІЧОГО. Раніше тут стояв менеджер:
     чужий акаунт отримував дошку, клієнтів і всі замовлення. Поки вхід
     заводили руками в консолі, це не стріляло; з появою запрошень поштою
     він відкривається сам. Детальніше — tests/access-rights.mjs.
     Порожній список і далі означає повний доступ: інакше перше ж
     збереження замкнуло б систему від самого власника. */
  const p2 = await open('stranger@loomiq', TEAM);
  const st = await p2.evaluate(() => ({ cost:canSeeCost(), edit:canEditItems(),
    screen: !!document.getElementById('no-access'),
    nav:[...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).length }));
  ok(st.screen && !st.cost && !st.edit,
    'кого немає в списку — не бачить нічого й читає про це на екрані',
    'чужа пошта отримала не те: ' + JSON.stringify(st));
  await p2.close();

  const p3 = await open('nobody@loomiq', []);
  /* Рахуємо не магічне число, а частку: видно МАЄ БУТИ все меню, скільки б
     розділів у ньому не завели далі. Прибите число падало щоразу, коли в
     системі зʼявлявся новий розділ, — і виглядало це як зламані права. */
  const empty = await p3.evaluate(() => {
    const all = [...document.querySelectorAll('.nav button[data-view]')];
    return { cost:canSeeCost(), setup:canSetup(),
             nav: all.filter(b => !b.hidden).length, all: all.length };
  });
  ok(empty.cost && empty.setup && empty.nav === empty.all && empty.all > 5,
    'порожній список — доступ повний, як і було: видно всі ' + empty.all + ' розділи',
    'порожній список щось замкнув: ' + JSON.stringify(empty));
  await p3.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'кожному видно рівно те, що відкриває його роль');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
