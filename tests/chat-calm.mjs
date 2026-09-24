/* Переписка має стояти спокійно й нічого не ховати.

   ТРИ РЕЧІ, І ВСІ ТРИ ВІД АНДРІЯ.

   1. «Вліво пригає знову наше повідомлення». Саме пригає: репліка спершу
      стоїть праворуч, а за секунду, коли стрічку перечитано з Sitniks,
      перестрибує ліворуч і без підпису. Бік визначається ланцюжком із
      чотирьох здогадів — прямого поля «вихідне» в акаунті немає, підпис
      приходить клієнтський, памʼять про відправлене живе у вкладці. Латати
      ланцюжок марно; твердо ми знаємо інше: якщо повідомлення вже стояло
      праворуч, воно наше, і перечитування цього не скасовує.

   2. «Пригає діалог постійно». Вікно перемальовується щочотири секунди, і
      разом із ним народжується вся стрічка заново. Для тексту непомітно, а
      кожна картинка стає НОВИМ елементом: висоту до завантаження браузер не
      знає, стрічка на мить складається й розправляється. Що більше в
      розмові карток, то сильніше трясе.

   3. «Якщо клієнт або ми видалили повідомлення — щоб воно горіло червоним».
      Мовчазне зникнення — найгірше, що може статись із перепискою: клієнт
      написав вимогу й прибрав, менеджер пообіцяв термін і стер. Розмова
      виглядає бездоганно, а домовленість була.

   Запуск:  node tests/chat-calm.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8887;
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
const errs = [];

const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }] };
const ORDER = {
  id:'1', orderId:'1000083', type:'client', name:'Марта Паращук', instagram:'@marta',
  status:'prorahunok', site:'main', payments:[], hist:[],
  createdAt:'2026-09-20T09:00:00.000Z',
  crmChatId:'c83', crmChatName:'Марта Паращук',
  totalPrice:9030, totalCost:5000, margin:4030, marginPct:44,
  items:[{ kind:'main', name:'Футболка', color:'біла', garmentId:'tee',
           qty:10, unitPrice:903, price:9030, unitCost:500, cost:5000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
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

/* Відповідь Sitniks у тому вигляді, у якому вона й приходить: ані поля
   «вихідне», ані підпису менеджера. Саме на такій відповіді бік і
   губився. */
const ВІДПОВІДЬ = [
  { id:'m1', text:'Вітаю! Цікавить футболка з логотипом', createdAt:'2026-09-23T16:50:00Z' },
  { id:'m2', text:'Підготувала для вас прорахунок 👌\nЯка модель вам більше подобається?)',
    createdAt:'2026-09-23T17:01:00Z' },
  { id:'m3', text:'Дякую, дивлюсь', createdAt:'2026-09-23T17:03:00Z' }
];

console.log('═══ НАШЕ ПОВІДОМЛЕННЯ НЕ ПЕРЕСТРИБУЄ ВЛІВО ═══');
const бік = await p.evaluate(async (відп) => {
  const o = orders[0];
  /* Перший прохід: ми щойно надіслали цю репліку, тож памʼять вкладки про
     неї є — повідомлення стає нашим. */
  crmChat[o.id] = { chatId:'c83', clientName:'Марта Паращук' };
  crmOutNote(o, відп[1].text);
  const п1 = crmNormMsgs(відп, o);
  crmChat[o.id].msgs = п1;
  /* Другий прохід — рівно те, що робить опитування за секунду. Але тепер
     памʼяті про відправлене НЕМАЄ: сторінку перезавантажили, картка
     приїхала з бази без сліду, як воно й буває назавтра. */
  o.crmOut = [];
  const п2 = crmNormMsgs(відп, o);
  const бік = l => l.map(m => (m.mine ? '→' : '←')).join('');
  return { перший: бік(п1), другий: бік(п2),
           підпис: (п2.filter(m => m.mine)[0] || {}).by || '' };
}, ВІДПОВІДЬ);
console.log('   спершу: ' + бік.перший + '   після перечитування: ' + бік.другий);
ok(бік.перший === '←→←',
  'наша репліка стоїть праворуч, клієнтські ліворуч',
  'бік визначено не так із самого початку: ' + бік.перший);
ok(бік.другий === бік.перший,
  'перечитування стрічки бік не міняє — раз показане нашим нашим і лишається',
  'наше повідомлення перестрибнуло: було ' + бік.перший + ', стало ' + бік.другий);
ok(!!бік.підпис,
  'і підпис менеджера разом із ним нікуди не дівається',
  'підпис загубився при перечитуванні');

console.log('');
console.log('═══ ВИДАЛЕНЕ ГОРИТЬ ЧЕРВОНИМ, А НЕ ЗНИКАЄ ═══');
const зник = await p.evaluate(async (відп) => {
  const o = orders[0];
  crmChat[o.id] = { chatId:'c83', clientName:'Марта Паращук' };
  o.crmOut = []; o.crmGone = [];
  crmOutNote(o, відп[1].text);
  crmChat[o.id].msgs = crmNormMsgs(відп, o);
  /* Клієнт стер свою першу репліку — Sitniks більше її не віддає. */
  const без = відп.filter(m => m.id !== 'm1');
  const п = crmNormMsgs(без, o);
  crmChat[o.id].msgs = п;
  const рядки = chatRowsHtml(chatMsgs(o, 'crm'));
  /* І ще одна перевірка: воно не має множитись від кожного такту. */
  const п2 = crmNormMsgs(без, o);
  return { тексти: п.map(m => (m.gone ? '✗' : '·') + (m.text || '').slice(0, 14)),
           скільки: (o.crmGone || []).length,
           вдруге: п2.filter(m => m.gone).length,
           червоне: /od-crm-msg[^"]*\bgone\b/.test(рядки),
           напис: /Видалено клієнтом/.test(рядки) };
}, ВІДПОВІДЬ);
console.log('   стрічка: ' + зник.тексти.join(' | '));
ok(зник.тексти.length === 3 && /^✗/.test(зник.тексти[0]),
  'видалена репліка лишилась у стрічці на своєму місці, позначена',
  'видалене зникло безслідно: ' + JSON.stringify(зник.тексти));
ok(зник.червоне && зник.напис,
  'і малюється червоним, із прямою вказівкою, хто саме її прибрав',
  'червоної позначки в розмітці немає');
ok(зник.скільки === 1 && зник.вдруге === 1,
  'слід один, і від кожного такту опитування він не множиться',
  'слідів видаленого: ' + зник.скільки + ', після другого такту: ' + зник.вдруге);

console.log('');
console.log('═══ СТРІЧКА НЕ ПЕРЕБИРАЄТЬСЯ ДАРМА ═══');
/* Головне тут — САМ ВУЗОЛ стрічки. Коли нічого не змінилось, він має
   лишитись тим самим елементом: тоді картинки в ньому вже завантажені,
   прокрутка ціла, і нічого не смикається. */
const спокій = await p.evaluate(async (відп) => {
  const o = orders[0];
  crmChat[o.id] = { chatId:'c83', clientName:'Марта Паращук', msgs:null };
  o.crmOut = []; o.crmGone = [];
  crmChat[o.id].msgs = crmNormMsgs(відп, o);
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 300));
  const узяти = () => document.querySelector('#chatWin .cw-feed');
  const перший = узяти();
  if(!перший) return { є:false };
  перший.__мітка = 'той самий';
  renderChatWin();
  const другий = узяти();
  const тойСамий = !!(другий && другий.__мітка === 'той самий');
  /* А тепер стрічка справді змінилась — вузол мусить оновитись. */
  crmChat[o.id].msgs = crmNormMsgs(відп.concat(
    [{ id:'m4', text:'Ще питання', createdAt:'2026-09-23T17:20:00Z' }]), o);
  renderChatWin();
  const третій = узяти();
  const оновився = !!(третій && третій.textContent.indexOf('Ще питання') >= 0);
  return { є:true, тойСамий, оновився,
           рядків: document.querySelectorAll('#chatWin .od-crm-msg').length };
}, ВІДПОВІДЬ);
ok(спокій.є, 'вікно розмови відкрилось', 'вікна розмови немає');
if(спокій.є){
  console.log('   у стрічці рядків: ' + спокій.рядків);
  ok(спокій.тойСамий,
    'нічого не змінилось — стрічка лишається тим самим вузлом, картинки не перезавантажуються',
    'стрічку перебрано заново без потреби — саме це й смикає екран');
  ok(спокій.оновився,
    'а коли прийшло нове повідомлення — стрічка оновилась',
    'нове повідомлення в стрічці не зʼявилось');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'розмова стоїть спокійно й нічого не ховає');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
