/* Привʼязка розмови Sitniks — за посиланням і тільки за ним.

   ПРОБЛЕМА, ЯК ЇЇ ВИДНО МЕНЕДЖЕРОВІ. Натискаєш «знайти» — і отримуєш десять
   рядків чужих людей: «Клієнт 12», «Клієнт 13», «чат 6aa81c02b81e7a16bf05bec4».
   Свого клієнта серед них немає ніколи, а обраний навмання привʼязує до картки
   чужу розмову.

   ЧОМУ ТАК БУЛО. Документація Sitniks закрита, ендпоінта пошуку в їхньому API
   не існує. Невідомий параметр (`?search=`, `?q=`) там просто ігнорують і чемно
   віддають ПОЧАТОК ЗАГАЛЬНОГО СПИСКУ діалогів. Помилки при цьому немає, тож код
   вважав, що знайшов. Ми обходили це читанням списку сторінками й відсіюванням
   у себе — але в робочому акаунті сотні роздрібних розмов за півдня: потрібна
   вже за день лежить на кількатисячній позиції.

   РІШЕННЯ. Менеджер у цю мить і так стоїть у відкритій розмові в Sitniks. Тож
   шлях лишився один: вставити адресу звідти. А імʼя, прізвище й нік читаємо з
   самої розмови — переписувати руками те, що вже написано в CRM, не потрібно.

   Перевіряємо:
     — списку чужих діалогів на екрані немає взагалі, і по нього не ходять;
     — зі сміття, яке не є посиланням, нічого не привʼязується;
     — розмова привʼязується за адресою, хоч би де вона лежала в списку;
     — імʼя й нік із розмови переїжджають у порожні поля картки;
     — уже вписане руками імʼя відповідь CRM не затирає;
     — коли в самому діалозі людини немає, читаємо її зі стрічки повідомлень.

   Запуск:  node tests/crm-seek.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8842;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

/* Уся стрічка діалогів акаунта. Потрібна розмова лежить глибоко — рівно там,
   де її ніколи не побачиш, гортаючи список. */
const ALL = Array.from({ length: 120 }, (_, i) => ({
  id: '6aa8' + String(i).padStart(3, '0') + 'b81e7a16bf05be' + (10 + i),
  createdAt: '2026-09-1' + (i % 5) + 'T10:' + String(i % 60).padStart(2, '0') + ':00Z',
  lastMessage: { text: 'Добрий день, підкажіть ціну ' + i },
  client: { userName: 'client_' + i, channel: 'instagram', clientName: 'Клієнт ' + i }
}));
/* Розмова нашого клієнта. Саме її адресу менеджер і вставляє. */
const MINE = {
  id: '6aa910231444b9f4123817a1',
  lastMessage: { text: 'Вітаю, цікавить 30 худі з вишивкою' },
  client: { userName: 'asia_dera', channel: 'instagram', clientName: 'Асія Дерещук' }
};
/* А ця розмова про співрозмовника мовчить — людина є лише в повідомленнях. */
const MUTE = { id: '6aa9ffff1444b9f41238ffff', lastMessage: { text: 'доброго дня' } };
const MUTE_MSGS = [
  { id:'m1', text:'доброго дня', client:{ clientName:'Орися Тиха', userName:'orysia_t' } },
  { id:'m2', text:'скільки коштує?' }
];
ALL.push(MINE, MUTE);

let hits = [];           // які шляхи в нас питали — це теж перевірка
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    hits.push(u.pathname + u.search);
    const json = (code, body) => {
      res.writeHead(code, { 'Content-Type':'application/json',
                            'Access-Control-Allow-Origin':'*' });
      res.end(JSON.stringify(body));
    };
    /* Стрічка повідомлень однієї розмови. */
    const msgs = /^\/crm\/chats\/([0-9a-f]{8,})\/messages$/i.exec(u.pathname);
    if(msgs) return json(200, msgs[1] === MUTE.id ? MUTE_MSGS : []);
    /* Одна розмова за ідентифікатором — саме так і перевіряється посилання. */
    const one = /^\/crm\/chats\/([0-9a-f]{8,})$/i.exec(u.pathname);
    if(one){
      const hit = ALL.find(c => c.id === one[1]);
      return json(hit ? 200 : 404, hit || { error:'not found' });
    }
    return json(200, []);
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, ''));
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

const mkOrder = (n, extra) => Object.assign({
  id:String(n), orderId:'100080' + n, type:'client', phone:'+38067000080' + n,
  status:'new', site:'main',
  tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  createdAt:new Date().toISOString(), hist:[], totalPrice:35140,
  items:[{ kind:'main', name:'Худі', color:'чорне', garmentId:'hoodie', qty:30,
           unitPrice:1171, price:35140 }]
}, extra);
/* Картка порожня — саме така й буває, коли людина щойно написала в Instagram. */
const ORDER = mkOrder(1, { name:'', instagram:'' });
/* А в цій імʼя й нік уже вписані руками — їх затирати не можна. */
const ORDER2 = mkOrder(2, { name:'Петро Вписаний', instagram:'ручний_нік' });
/* Третя — для розмови, що про співрозмовника мовчить. */
const ORDER3 = mkOrder(3, { name:'', instagram:'' });
const CONTENT = { team: [], bgApi: { sitniksUrl: HOST + '/crm' } };

function stub(){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER, ORDER2, ORDER3]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
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
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept('ok'));
const body = stub();
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

const openCard = async num => {
  // Панель попередньої картки перекриває дошку — спершу закриваємо її.
  await p.evaluate(() => { const b = document.querySelector('[data-od-close]'); if(b) b.click(); });
  await p.waitForTimeout(500);
  await p.click('.ticket:has-text("' + num + '")');
  await p.waitForTimeout(900);
};
/* Відкрити блок привʼязки тією ж кнопкою, що й менеджер. */
const openBind = async () => {
  await p.evaluate(() => { const b = document.querySelector('.od-ig-find'); if(b) b.click(); });
  await p.waitForTimeout(500);
};
/* Картки в `orders` лежать у порядку дошки, а не в тому, як ми їх подали —
   тож шукаємо свою за номером, а не за місцем у масиві. */
const ordOf = num => p.evaluate(n => {
  const o = orders.find(x => x.orderId === n) || {};
  return { id:o.crmChatId || '', who:o.crmChatName || '', name:o.name || '',
           ig:o.ig || '', instagram:o.instagram || '', seek:!!crmSeek[o.id] };
}, num);
const paste = url => p.evaluate(async u => {
  const inp = document.querySelector('.od-seek-url');
  if(!inp) return { err:'поля для посилання немає' };
  inp.value = u;
  document.querySelector('[data-seek-bind]').click();
  await new Promise(r => setTimeout(r, 1400));
  return {};
}, url);

await openCard('1000801');

console.log('═══ НА ЕКРАНІ ЛИШЕ ПОЛЕ ДЛЯ ПОСИЛАННЯ ═══');
/* Головне, заради чого все переробляли: купи чужих діалогів більше немає, і
   по список ми навіть не ходимо. */
hits = [];
await openBind();
const seen = await p.evaluate(() => {
  const box = document.querySelector('.od-seek');
  if(!box) return { err:'блоку привʼязки немає' };
  return { url: !!box.querySelector('.od-seek-url'),
           go: !!box.querySelector('[data-seek-bind]'),
           hint: (box.querySelector('.od-seek-hint') || {}).textContent || '',
           rows: box.querySelectorAll('.od-seek-r, [data-seek]').length,
           more: box.querySelectorAll('[data-seek-more], [data-seek-all], [data-seek-raw]').length,
           filter: box.querySelectorAll('.od-seek-in').length,
           focus: document.activeElement === box.querySelector('.od-seek-url') };
});
if(seen.err){ console.log('  ' + seen.err); bad++; }
else {
  ok(seen.url && seen.go, 'є поле для посилання й кнопка «Привʼязати»',
     'поля привʼязки немає');
  ok(!seen.rows, 'жодного чужого діалогу на екрані',
     'на екрані знову список чужих розмов: ' + seen.rows);
  ok(!seen.more && !seen.filter,
     'ні «Показати ще», ні фільтра, ні сирої відповіді — нічого другорядного',
     'лишились рештки пошуку по списку');
  ok(!hits.length,
     'у Sitniks по список діалогів навіть не ходили',
     'усе одно читали список: ' + hits.join(', '));
  ok(/скопіюйте адресу/i.test(seen.hint) && /Імʼя й нік/i.test(seen.hint),
     'підказка каже, що робити і що звідти підтягнеться',
     'підказка не пояснює дію: «' + seen.hint.trim().slice(0, 90) + '»');
  ok(seen.focus, 'курсор одразу в полі — можна вставляти без зайвого кліку',
     'у поле треба ще клікнути окремо');
}

console.log('');
console.log('═══ ЗІ СМІТТЯ НІЧОГО НЕ ПРИВʼЯЗУЄТЬСЯ ═══');
/* Помилково привʼязана чужа розмова гірша за жодну. */
await paste('просто текст');
const junk = await ordOf('1000801');
ok(!junk.id, 'із тексту, який не є посиланням, нічого не привʼязується',
   'привʼязали казна-що: ' + junk.id);

console.log('');
console.log('═══ ПОСИЛАННЯ ПРИВʼЯЗУЄ РОЗМОВУ Й ТЯГНЕ ЛЮДИНУ В КАРТКУ ═══');
await paste('https://web.sitniks.com/1503/chats/dialog/' + MINE.id);
const bound = await ordOf('1000801');
console.log('  привʼязано ' + bound.id + ' · імʼя «' + bound.name + '» · нік «' + bound.ig + '»');
ok(bound.id === MINE.id,
   'розмова привʼязалась за адресою — хоч би де вона лежала в списку',
   'привʼязка не спрацювала: ' + JSON.stringify(bound));
ok(bound.name === 'Асія Дерещук',
   'імʼя з розмови саме стало в картку — руками його не переписують',
   'імʼя не підтягнулось: «' + bound.name + '»');
ok(bound.ig === 'asia_dera' && bound.instagram === 'asia_dera',
   'нік із розмови теж переїхав у картку',
   'нік не підтягнувся: «' + bound.ig + '» / «' + bound.instagram + '»');
ok(bound.who === 'Асія Дерещук',
   'у шапці розмови видно, кого саме привʼязали',
   'розмова підписана не іменем: «' + bound.who + '»');
ok(!bound.seek,
   'блок привʼязки закрився — розмова знайдена, робити тут більше нічого',
   'блок привʼязки лишився відкритим');
console.log('');
console.log('═══ ПОМИЛКОВУ АДРЕСУ МОЖНА СКАСУВАТИ ═══');
/* Адреса береться з сусідньої вкладки, тож вставити не ту — звична помилка.
   Раніше кнопка привʼязки після цього зникала, а блок Sitniks у картці з
   привʼязаним чатом не показується взагалі: скасувати не було чим. */
await openBind();
const back = await p.evaluate(() => {
  const box = document.querySelector('.od-seek');
  if(!box) return { err:'блок не відкривається, коли розмова вже привʼязана' };
  return { who: ((box.querySelector('.od-seek-who') || {}).textContent || '').trim(),
           unlink: !!box.querySelector('.od-crm-unlink') };
});
if(back.err){ console.log('  ' + back.err); bad++; }
else {
  /* НІК ПОПЕРЕДУ ІМЕНІ. Саме за ніком людину й знаходять: імʼя профілю
     міняють, нік — майже ніколи. Доти в підписі стояло тільки імʼя, і
     знайти ту саму розмову через тиждень не виходило. */
  ok(/@asia_dera/.test(back.who) && /Асія Дерещук/.test(back.who) && back.unlink,
     'видно нік і імʼя привʼязаного, і поруч «Відвʼязати»: ' + back.who,
     'підпис привʼязаного неповний: ' + JSON.stringify(back));
  const off = await p.evaluate(async () => {
    document.querySelector('.od-crm-unlink').click();
    await new Promise(r => setTimeout(r, 600));
    return (orders.find(x => x.orderId === '1000801') || {}).crmChatId || '';
  });
  ok(!off, 'розмова відвʼязалась', 'розмова лишилась привʼязаною: ' + off);
  // Повертаємо її назад — далі перевіряємо вже інші картки.
  await paste('https://web.sitniks.com/1503/chats/dialog/' + MINE.id);
}

console.log('');
console.log('═══ ВПИСАНЕ РУКАМИ CRM НЕ ЗАТИРАЄ ═══');
await openCard('1000802');
await openBind();
await paste('https://web.sitniks.com/1503/chats/dialog/' + MINE.id);
const kept = await ordOf('1000802');
console.log('  імʼя «' + kept.name + '» · нік «' + kept.ig + '»');
ok(kept.id === MINE.id, 'розмова привʼязалась', 'розмова не привʼязалась');
ok(kept.name === 'Петро Вписаний' && kept.ig === 'ручний_нік',
   'вписане руками лишилось як було — правку менеджера відповідь CRM не затирає',
   'CRM затерла вписане руками: «' + kept.name + '» / «' + kept.ig + '»');
ok(kept.who === 'Асія Дерещук',
   'але видно, з ким насправді розмова — розбіжність помітна одразу',
   'співрозмовника не видно: «' + kept.who + '»');

console.log('');
console.log('═══ РОЗМОВА МОВЧИТЬ — ЧИТАЄМО ЛЮДИНУ З ПОВІДОМЛЕНЬ ═══');
/* У самому діалозі співрозмовника може не бути взагалі. Тоді картка лишалась
   підписаною шістнадцятковим номером — хоча імʼя стоїть під кожним
   повідомленням. */
await openCard('1000803');
await openBind();
await paste('https://web.sitniks.com/1503/chats/dialog/' + MUTE.id);
const deep = await ordOf('1000803');
console.log('  імʼя «' + deep.name + '» · нік «' + deep.ig + '»');
ok(deep.id === MUTE.id, 'розмова привʼязалась', 'розмова не привʼязалась');
ok(deep.name === 'Орися Тиха' && deep.ig === 'orysia_t',
   'людину дочитали зі стрічки повідомлень, коли діалог про неї мовчить',
   'картка лишилась без людини: «' + deep.name + '» / «' + deep.ig + '»');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'привʼязка за посиланням — єдиний шлях, і людина тягнеться з розмови');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
