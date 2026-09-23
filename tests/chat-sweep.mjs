/* Жоден діалог не губиться: фоновий обхід розмов Sitniks.

   ПРОБЛЕМА. Telegram сам штовхає повідомлення в базу — дошка бачить їх
   одразу, навіть якщо ніхто нічого не відкривав. Sitniks не штовхає нічого:
   адмінка питає ТІЛЬКИ ту розмову, яка зараз відкрита. Поки менеджер не
   відкрив діалог, для дошки його не існує: ні лічильника, ні підняття. А
   половина звернень приходить саме в Instagram.

   Тому один запит на хвилину на всю адмінку: Sitniks віддає список
   діалогів із останнім повідомленням у кожному, і цього досить, щоб знати,
   у кого щось нове й чиє там останнє слово.

   ПРАВИЛО: розмова неопрацьована, доки ОСТАННЄ СЛОВО ЗА КЛІЄНТОМ. Не «доки
   не прочитали» — прочитати й забути легко.

   Перевіряємо:
     — слово клієнта піднімає картку й нарощує лічильник;
     — наша ж відповідь не робить ні того, ні того;
     — старе повідомлення, яке ми вже бачили, нічого не міняє вдруге;
     — кружечок із числом стоїть на картці, вгорі праворуч;
     — відповіли — кружечок згас.

   Запуск:  node tests/chat-sweep.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8873;
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
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Оксана', phone:'+380670001001',
  status:'kp', site:'main', payments:[], crmChatId:'chat-77', crmChatName:'oksana.ua',
  createdAt:'2026-09-20T09:00:00.000Z', hist:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000, unitCost:350, cost:7000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
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

/* Sitniks підміняємо своїм: нас цікавить не він, а що адмінка робить із
   тим, що він віддає. Список діалогів і формою, і назвами полів той самий,
   яким його бачили в робочому акаунті. */
await p.evaluate(() => {
  window.__CHATS = [];
  window.crmBase = () => 'https://proxy.example';
  window.crmFetch = async (path) => {
    if(path === '/chats') return { items: window.__CHATS };
    throw new Error('не питали: ' + path);
  };
});

const обхід = async (rows) => p.evaluate(async (rows) => {
  window.__CHATS = rows;
  await crmSweepOnce();
  const o = orders[0];
  return { непрочитаних:+o.crmUnread || 0, чекає:!!o.crmTheirs,
           коли:o.crmAt || '', текст:o.crmLast || '',
           живість:orderActivityAt(o) };
}, rows);

console.log('═══ СЛОВО КЛІЄНТА ПІДНІМАЄ КАРТКУ ═══');
const один = await обхід([{ id:'chat-77', lastMessage:{
  text:'Доброго дня, а є розмір L?', createdAt:'2026-09-22T11:00:00.000Z' } }]);
console.log('   ' + JSON.stringify(один));
ok(один.непрочитаних === 1 && один.чекає,
  'повідомлення в Direct дошка бачить сама, не чекаючи, поки хтось відкриє розмову',
  'обхід нічого не помітив: ' + JSON.stringify(один));
ok(один.живість === '2026-09-22T11:00:00.000Z',
  'картка «ожила» цією миттю — отже піде вгору колонки, а не лишиться внизу',
  'свіже повідомлення не підняло картку: ' + JSON.stringify(один));

console.log('');
console.log('═══ ТЕ САМЕ ВДРУГЕ НІЧОГО НЕ МІНЯЄ ═══');
const вдруге = await обхід([{ id:'chat-77', lastMessage:{
  text:'Доброго дня, а є розмір L?', createdAt:'2026-09-22T11:00:00.000Z' } }]);
ok(вдруге.непрочитаних === 1,
  'уже побачене повідомлення не рахується вдруге — лічильник не накручується сам',
  'кожен такт додає одиницю: ' + JSON.stringify(вдруге));

console.log('');
console.log('═══ НАША ВІДПОВІДЬ НЕ Є ПОВІДОМЛЕННЯМ ДЛЯ НАС ═══');
/* Без цього система повідомляла б нам про нас самих: щойно менеджер
   відповів, картка стрибала б угору з кружечком «одне непрочитане». */
const наше = await обхід([{ id:'chat-77', lastMessage:{
  text:'Так, L у наявності', createdAt:'2026-09-22T11:05:00.000Z',
  isOutgoing:true } }]);
console.log('   ' + JSON.stringify(наше));
ok(наше.непрочитаних === 1 && !наше.чекає,
  'наша ж репліка не нарощує лічильник і знімає «клієнт чекає»',
  'адмінка повідомляє нам про нас самих: ' + JSON.stringify(наше));

console.log('');
console.log('═══ КРУЖЕЧОК НА КАРТЦІ ═══');
const кружечок = await p.evaluate(() => {
  const o = orders[0];
  o.crmUnread = 3; o.crmTheirs = true;
  renderBoard();
  const el = document.querySelector('.ticket .tc-un');
  if(!el) return { є:false };
  const r = el.getBoundingClientRect(), c = el.closest('.ticket').getBoundingClientRect();
  return { є:true, число:el.textContent.trim(),
           зверху:Math.round(r.top - c.top), справа:Math.round(c.right - r.right) };
});
console.log('   ' + JSON.stringify(кружечок));
ok(кружечок.є && кружечок.число === '3',
  'на картці видно, скільки клієнт написав і чекає',
  'кружечка з числом немає: ' + JSON.stringify(кружечок));
ok(кружечок.є && кружечок.зверху < 40 && кружечок.справа < 40,
  'він стоїть угорі праворуч — там, де його шукає око',
  'кружечок не в тому кутку: ' + JSON.stringify(кружечок));

const згас = await p.evaluate(() => {
  crmAnswered(orders[0]);
  renderBoard();
  return !document.querySelector('.ticket .tc-un');
});
ok(згас,
  'відповіли — кружечок згас; саме відповіли, а не відкрили',
  'кружечок лишається й після відповіді');

console.log('');
console.log('═══ У СПИСКУ ТІЛЬКИ ТЕ, ЩО МИ САМІ ЗАВЕЛИ ═══');
/* Канбан упорядкований ЗА ПРОЦЕСОМ, переписка живе ЗА ЧАСОМ. Це два різні
   порядки, і жоден не заміняє другого.

   А от звідки беруться самі рядки — питання окреме, і колись відповідь була
   неправильна. Обхід питає Sitniks про ВЕСЬ список розмов, і кожна, не
   привʼязана до замовлення, лягала в розділ — ще й в обидва напрями одразу.
   Задум був добрий: людина написала вперше, картки немає, отже на дошці її
   немає ніде. А вийшла копія Direct усередині CRM: кілька десятків чужих
   діалогів, у яких нічого не відбувається, і серед них ті кілька, з якими
   справді працюють.

   Тепер правило: розмова в розділі є тоді, коли її привʼязали до замовлення
   цього напряму. Хто написав уперше — живе в самому Instagram, доки з нього
   не зробили замовлення. */
const список = await p.evaluate(async () => {
  window.__CHATS = [
    { id:'chat-77', lastMessage:{ text:'А є розмір L?',
      createdAt:'2026-09-22T12:00:00.000Z' } },
    /* Чужа розмова, якої ніхто не привʼязував. Саме такі й заповнювали
       розділ десятками. */
    { id:'chat-99', username:'nova.people', lastMessage:{ text:'Скільки коштує худі?',
      createdAt:'2026-09-22T12:30:00.000Z' } }
  ];
  await crmSweepOnce();
  renderChats('b2b');
  const rows = [...document.querySelectorAll('#chatsRoot .chl-row')];
  return { рядків:rows.length,
           перший:rows[0] ? rows[0].querySelector('.chl-who').textContent : '',
           чекають:rows.filter(r => r.classList.contains('waits')).length,
           обхідБачив:(crmInbox || []).length };
});
console.log('   ' + JSON.stringify(список));
ok(список.обхідБачив === 1,
  'обхід і далі читає весь Direct і знає про непривʼязану розмову — просто не показує її',
  'обхід перестав читати список: ' + JSON.stringify(список));
ok(список.рядків === 1 && список.перший === 'Оксана',
  'у розділі лише привʼязана розмова — чужий Direct сюди не ллється',
  'у списку знову чужі діалоги: ' + JSON.stringify(список));
ok(список.чекають === 1,
  'видно, у кого останнє слово за клієнтом',
  'неопрацьовані не позначені: ' + JSON.stringify(список));

const лічильник = await p.evaluate(() => {
  paintChatBadges();
  const el = document.querySelector('[data-nav-n="chats"]');
  return { число:(el && el.textContent) || '', сховано:!!(el && el.hidden) };
});
console.log('   ' + JSON.stringify(лічильник));
ok(лічильник.число === '1' && !лічильник.сховано,
  'число в меню рахує саме свої розмови — видно, що є неотримана відповідь',
  'лічильник рахує не те: ' + JSON.stringify(лічильник));

console.log('');
console.log('═══ ЛІВОРУЧ СПИСОК, ПРАВОРУЧ ПЕРЕПИСКА ═══');
/* Доти клік по рядку вів в інше місце: відкривалась КАРТКА замовлення, а
   вікно переписки випливало поверх неї. Тобто розділ «Чати» насправді був
   списком посилань на дошку, і щоб відповісти двом людям поспіль,
   доводилось щоразу вертатись назад. */
const дві = await p.evaluate(async () => {
  renderChats('b2b');
  const було = { колонки:!!document.querySelector('#chatsRoot .ch2'),
                 підказка:!!document.querySelector('#chatsRoot .ch2-none') };
  document.querySelector('#chatsRoot .chl-row').click();
  await new Promise(r => setTimeout(r, 600));
  const cw = document.getElementById('chatWin');
  const view = document.getElementById('chatsView');
  return { було,
           усередині:!!(cw && view && view.contains(cw)),
           відкрито:!!(cw && cw.classList.contains('open')),
           інлайн:!!(cw && cw.classList.contains('cw-inline')),
           картка:!!document.querySelector('#orderDrawer .od-panel .od-head'),
           номер:!!document.querySelector('#chatWin [data-cw-card]'),
           обрана:!!document.querySelector('#chatsRoot .chl-row.is-on') };
});
console.log('   ' + JSON.stringify(дві));
ok(дві.було.колонки && дві.було.підказка,
  'дві колонки: ліворуч список, праворуч поки підказка, а не порожнеча',
  'розділ не поділений: ' + JSON.stringify(дві));
ok(дві.усередині && дві.відкрито && дві.інлайн,
  'натиснув рядок — переписка відкрилась тут же, у правій колонці',
  'розмова відкрилась не тут: ' + JSON.stringify(дві));
ok(!дві.картка,
  'картка замовлення при цьому не лізе поверх — у чатах відповідають, а не ведуть замовлення',
  'клік по розмові знову відкриває картку: ' + JSON.stringify(дві));
ok(дві.номер && дві.обрана,
  'номер замовлення в шапці веде в картку, а обраний рядок видно у списку',
  'до картки звідси не дістатись: ' + JSON.stringify(дві));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'дошка бачить розмови сама, а в розділі — тільки свої');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
