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
console.log('═══ ВІДПРАВКУ ВИДНО, І НАДІСЛАТИ ДВІЧІ НЕМОЖЛИВО ═══');
/* Андрій: «коли відправляємо повідомлення, щоб одразу показали, що воно
   відправилось, і можливо грузить, щоб не відправляли декілька разів, бо
   буває таке з картинками, що відправляєш, воно потім висне».

   Ловимо повільний сервер: тримаємо відповідь дві секунди й дивимось, що
   діється на екрані весь цей час. Доти не діялось нічого — і саме це
   читається як «застрягло». */
const відправка = await p.evaluate(async (відп) => {
  const o = orders[0];
  crmChat[o.id] = { chatId:'c83', clientName:'Марта Паращук' };
  o.crmOut = []; o.crmGone = [];
  crmChat[o.id].msgs = crmNormMsgs(відп, o);
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 400));
  /* Повільний Sitniks: відповідає лише коли ми його відпустимо. */
  let пустити = null, викликів = 0;
  const був = window.crmFetch;
  window.crmFetch = function(url, opts){
    if(!opts || opts.method !== 'POST') return був.apply(this, arguments);
    викликів++;
    return new Promise(r => { пустити = () => r({ id:'new1' }); });
  };
  window.crmPollOnce = async () => {};
  const inp = document.querySelector('#chatWin .cw-inp');
  inp.value = 'Порахували, надсилаю за годину';
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 250));
  const під = {
    бульбашка: !!document.querySelector('#chatWin .od-crm-msg.pending'),
    напис: ((document.querySelector('#chatWin .od-crm-msg.pending .od-crm-at') || {})
             .textContent || '').trim(),
    кнопка: !!(document.querySelector('[data-cw-go]') || {}).disabled,
    крутилка: !!document.querySelector('[data-cw-go] .cw-spin')
  };
  /* Другий і третій натиск, поки перший ще летить. */
  document.querySelector('[data-cw-go]').click();
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 150));
  пустити();
  await new Promise(r => setTimeout(r, 600));
  const після = {
    кнопка: !!(document.querySelector('[data-cw-go]') || {}).disabled,
    ще: !!document.querySelector('#chatWin .od-crm-msg.pending')
  };
  window.crmFetch = був;
  return { під, після, викликів };
}, ВІДПОВІДЬ);
console.log('   поки летить: бульбашка ' + (відправка.під.бульбашка ? 'є' : 'немає') +
            ' · «' + відправка.під.напис + '» · кнопка ' +
            (відправка.під.кнопка ? 'заблокована' : 'активна'));
ok(відправка.під.бульбашка && /надсилаю/.test(відправка.під.напис),
  'репліка стоїть у стрічці одразу, з позначкою «надсилаю…» — як у будь-якому месенджері',
  'поки лист летить, на екрані не діється нічого — саме це й читається як «застрягло»');
ok(відправка.під.кнопка && відправка.під.крутилка,
  'кнопка гасне й крутиться — видно, що система зайнята',
  'кнопка лишилась активною, вигляд той самий, що й до натиску');
ok(відправка.викликів === 1,
  'три натиски поспіль дали РІВНО ОДНУ відправку',
  'клієнт отримав ' + відправка.викликів + ' однакових повідомлення');
ok(!відправка.після.кнопка && !відправка.після.ще,
  'сервер відповів — позначка знялась, кнопка ожила',
  'після відповіді сервера кнопка або позначка лишились висіти');

console.log('');
console.log('═══ НЕ НАДІСЛАЛОСЬ — ТЕКСТ ПОВЕРТАЄТЬСЯ В ПОЛЕ ═══');
/* Лист на три абзаци, який зник разом із відмовою сервера, не відновити
   нізвідки: поле чистилось одразу при натиску. */
const збій = await p.evaluate(async (відп) => {
  const o = orders[0];
  crmChat[o.id] = { chatId:'c83', clientName:'Марта Паращук' };
  o.crmOut = []; o.crmGone = [];
  crmChat[o.id].msgs = crmNormMsgs(відп, o);
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 400));
  const був = window.crmFetch;
  window.crmFetch = function(url, opts){
    if(!opts || opts.method !== 'POST') return був.apply(this, arguments);
    return Promise.reject(new Error('канал закритий'));
  };
  window.crmPollOnce = async () => {};
  const текст = 'Перший абзац.\nДругий абзац.\nТретій абзац.';
  const inp = document.querySelector('#chatWin .cw-inp');
  inp.value = текст;
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 700));
  const res = {
    уПолі: (document.querySelector('#chatWin .cw-inp') || {}).value || '',
    привид: !!document.querySelector('#chatWin .od-crm-msg.pending'),
    кнопка: !!(document.querySelector('[data-cw-go]') || {}).disabled
  };
  window.crmFetch = був;
  return res;
}, ВІДПОВІДЬ);
console.log('   у полі: «' + збій.уПолі.replace(/\n/g, ' ⏎ ') + '»');
ok(збій.уПолі.indexOf('Третій абзац') >= 0,
  'написане повернулось у поле цілим — правити є що',
  'лист зник разом із відмовою сервера: «' + збій.уПолі + '»');
ok(!збій.привид,
  'і привида «надсилаю…» у стрічці не лишилось — дві відповіді на одне питання зайві',
  'у стрічці висить бульбашка, якої немає в клієнта');
ok(!збій.кнопка,
  'кнопка ожила — можна спробувати ще раз',
  'кнопка лишилась заблокованою після збою: надіслати вже нічим');

console.log('');
console.log('═══ ВІКНО ВІДПОВІДІ INSTAGRAM — СІМ ДІБ ═══');
/* Андрій: «Instagram і Sitniks дають 7 днів, потрібно це показувати, щоб
   менеджер розумів, що коли відправляєш пізніше, то воно не буде
   доходити». Найгірше в цьому обмеженні те, як воно виглядає збоку:
   Sitniks лист приймає, у нашій стрічці він стоїть, а до людини не
   доходить — і дізнаєшся про це через день-два. */
const вікно = await p.evaluate(async () => {
  const o = orders[0];
  const мить = (год) => new Date(Date.now() - год * 3600 * 1000)
    .toISOString().replace('T', ' ').slice(0, 16);
  const стан = (год) => {
    crmChat[o.id] = { chatId:'c83', clientName:'Марта', msgs:[
      { text:'Вітаю', mine:false, at: мить(год) },
      { text:'Порахували', mine:true, at: мить(год - 0.5) }
    ]};
    const w = crmWindow(o);
    chatOpen(o, 'crm');
    const шапка = document.querySelector('#chatWin .cw-win');
    return { лишилось: w && Math.round(w.left / 3600000),
             закрите: !!(w && w.closed), скоро: !!(w && w.soon),
             напис: шапка ? шапка.textContent.trim().replace(/\s+/g, ' ') : '',
             клас: шапка ? шапка.className : '',
             смуга: !!document.querySelector('#chatWin .cw-dead') };
  };
  return { свіже: стан(2), майже: стан(6 * 24 + 6), мертве: стан(9 * 24) };
});
console.log('   щойно писав: ' + вікно.свіже.напис);
console.log('   шостий день: ' + вікно.майже.напис);
console.log('   девʼятий день: ' + вікно.мертве.напис);
ok(вікно.свіже.лишилось > 160 && !вікно.свіже.закрите && !вікно.свіже.скоро,
  'клієнт щойно писав — лишилось майже сім діб, рядок спокійний',
  'свіже вікно пораховано не так: ' + JSON.stringify(вікно.свіже));
ok(вікно.майже.скоро && /is-soon/.test(вікно.майже.клас),
  'під кінець шостої доби рядок стає бурштиновим — ще можна встигнути',
  'попередження під кінець не зʼявилось: ' + JSON.stringify(вікно.майже));
ok(вікно.мертве.закрите && /is-out/.test(вікно.мертве.клас) &&
   /закрите/i.test(вікно.мертве.напис),
  'після семи діб рядок червоний і каже прямо: вікно закрите',
  'закрите вікно не позначене: ' + JSON.stringify(вікно.мертве));
ok(вікно.мертве.смуга && !вікно.свіже.смуга,
  'і над полем зʼявляється смуга з поясненням — саме там, де вирішують писати',
  'смуги над полем немає або вона висить постійно');

console.log('');
console.log('═══ ЗАКРИТЕ ВІКНО ПИТАЄ ПЕРЕД ВІДПРАВКОЮ ═══');
/* Не забороняємо: Sitniks буває має інший канал, та й менеджер може знати
   про клієнта більше за нас. Але надіслати НАОСЛІП він не повинен. */
const питання = await p.evaluate(async () => {
  const o = orders[0];
  const давно = new Date(Date.now() - 9 * 24 * 3600 * 1000)
    .toISOString().replace('T', ' ').slice(0, 16);
  crmChat[o.id] = { chatId:'c83', clientName:'Марта',
    msgs:[{ text:'Вітаю', mine:false, at: давно }] };
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 300));
  let питали = '', відповідь = false;
  const був = window.confirm, бувF = window.crmFetch;
  let постів = 0;
  window.confirm = (t) => { питали = String(t || ''); return відповідь; };
  window.crmFetch = function(url, opts){
    if(opts && opts.method === 'POST'){ постів++; return Promise.resolve({ id:'x' }); }
    return бувF.apply(this, arguments);
  };
  window.crmPollOnce = async () => {};
  const inp = document.querySelector('#chatWin .cw-inp');
  inp.value = 'Ще актуально?'; inp.dispatchEvent(new Event('input', { bubbles:true }));
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 300));
  const післяВідмови = { постів, уПолі:(document.querySelector('#chatWin .cw-inp')||{}).value||'' };
  /* А тепер менеджер сказав «усе одно надіслати». */
  відповідь = true;
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 400));
  const результат = { питали, післяВідмови, постів };
  window.confirm = був; window.crmFetch = бувF;
  return результат;
});
console.log('   спитали: «' + питання.питали.split('\n')[0] + '»');
ok(/закрит/i.test(питання.питали),
  'перед відправкою в закрите вікно система питає прямо',
  'надсилає наосліп, нічого не питаючи: «' + питання.питали + '»');
/* Число в питанні — скільки МИНУЛО від репліки клієнта, а не якась похідна
   від залишку. Спокуса вивести його з «лишилось» коштувала чотирьох діб:
   мінус дві плюс сім дає пʼять, а минуло девʼять. */
ok(/9 днів/.test(питання.питали),
  'і каже правильне число: клієнт не писав девʼять діб',
  'у питанні хибний строк: «' + питання.питали.split('\n')[0] + '»');
ok(питання.післяВідмови.постів === 0 && питання.післяВідмови.уПолі.indexOf('актуально') >= 0,
  'сказав «ні» — нічого не пішло, текст лишився в полі',
  'відмова нічого не спинила: ' + JSON.stringify(питання.післяВідмови));
ok(питання.постів === 1,
  'сказав «усе одно» — лист пішов: заборони тут немає, є попередження',
  'після згоди лист не пішов, відправок: ' + питання.постів);

console.log('');
console.log('═══ ВІДКРИВ РОЗМОВУ — ВИДНО, ЗВІДКИ НЕПРОЧИТАНЕ ═══');
/* Андрій: «одразу заходиш в діалог, одразу бачиш непрочитане
   повідомлення». Доти розмова відкривалась просто в кінці: клієнт написав
   пʼять разів — менеджер бачив пʼяте й гортав угору, вгадуючи, звідки
   читати. */
const межа = await p.evaluate(async () => {
  const o = orders[0];
  const мить = (хв) => new Date(Date.now() - хв * 60000)
    .toISOString().replace('T', ' ').slice(0, 16);
  /* Розмова навмисно довга: на короткій стрічці гортати нема чого, і
     перевірка «стали на межі, а не в кінці» нічого б не доводила. */
  const давні = [];
  for(let k = 0; k < 24; k++)
    давні.push({ text:'Рядок розмови номер ' + (k + 1), mine: k % 2 === 1,
                 at: мить(900 - k * 20), by: k % 2 === 1 ? 'Володимир' : '' });
  /* І непрочитаного теж багато: коли хвіст коротший за висоту вікна, «на
     межі» й «у кінці» — та сама точка, і перевіряти нема чого. */
  const нові = [{ text:'А є оверсайз?', mine:false, at: мить(40) }];
  for(let k = 0; k < 14; k++)
    нові.push({ text:'І ще питання номер ' + (k + 1), mine:false, at: мить(39 - k) });
  crmChat[o.id] = { chatId:'c83', clientName:'Марта', msgs: давні.concat(
    [{ text:'Порахували, надсилаю', mine:true, at: мить(390), by:'Володимир' }],
    нові) };
  chatClose();
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 500));
  const feed = document.querySelector('#chatWin .cw-feed');
  const мітка = feed && feed.querySelector('[data-crm-new]');
  const рядки = [...feed.querySelectorAll('.od-crm-msg')];
  /* Що саме стоїть одразу під міткою — має бути перша з непрочитаних. */
  let перший = '';
  if(мітка){
    let n = мітка.nextElementSibling;
    while(n && !n.classList.contains('od-crm-msg')) n = n.nextElementSibling;
    перший = n ? n.textContent.trim().slice(0, 14) : '';
  }
  return { є:!!мітка, напис: мітка ? мітка.textContent.trim() : '',
           перший,
           /* Прокрутка стала на мітці, а не в самому кінці стрічки. */
           стоїмоНаМітці: !!(мітка && Math.abs(feed.scrollTop - Math.max(0, мітка.offsetTop - 46)) < 4),
           вКінці: feed.scrollHeight - feed.scrollTop - feed.clientHeight < 4,
           рядків: рядки.length };
});
console.log('   мітка: «' + межа.напис + '» · під нею: «' + межа.перший + '»');
ok(межа.є && /15/.test(межа.напис),
  'над першим непрочитаним стоїть риска з числом — видно, скільки клієнт устиг написати',
  'межі непрочитаного немає: ' + JSON.stringify(межа));
ok(межа.перший.indexOf('А є оверсайз') === 0,
  'і вона рівно там, де скінчилась наша остання відповідь',
  'риска стоїть не на тому місці, під нею: «' + межа.перший + '»');
ok(межа.стоїмоНаМітці && !межа.вКінці,
  'розмова відкрилась НА МЕЖІ, а не в кінці — гортати вгору не треба',
  'відкрились у кінці стрічки, як і раніше');

const безМежі = await p.evaluate(async () => {
  const o = orders[0];
  const мить = (хв) => new Date(Date.now() - хв * 60000)
    .toISOString().replace('T', ' ').slice(0, 16);
  /* Усе прочитано: останнє слово за нами. Риски бути не повинно. */
  crmChat[o.id] = { chatId:'c83', clientName:'Марта', msgs:[
    { text:'А є оверсайз?', mine:false, at: мить(40) },
    { text:'Є, надсилаю', mine:true, at: мить(30), by:'Володимир' }
  ]};
  chatClose(); chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 400));
  const feed = document.querySelector('#chatWin .cw-feed');
  return { мітка: !!feed.querySelector('[data-crm-new]'),
           вКінці: feed.scrollHeight - feed.scrollTop - feed.clientHeight < 4 };
});
ok(!безМежі.мітка && безМежі.вКінці,
  'коли останнє слово за нами — риски немає, і розмова відкривається в кінці',
  'риска висить там, де все прочитано');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'розмова стоїть спокійно й нічого не ховає');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
