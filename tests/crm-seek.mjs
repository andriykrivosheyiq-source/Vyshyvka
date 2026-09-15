/* Пошук діалогу в Sitniks: не видавати список за знайдене.

   ПРОБЛЕМА, ЯК ЇЇ ВИДНО МЕНЕДЖЕРОВІ. Шукаєш нік — і отримуєш десять рядків
   «чат 6aa81c02b81e7a16bf05bec4», «чат 6aa8199b1444b9f412421772» і так далі.
   Стільки діалогів із цією людиною не існує, обрати з них неможливо, а
   обраний навмання привʼязує до картки чужу розмову.

   ЩО НАСПРАВДІ ВІДБУВАЛОСЬ. Документація Sitniks закрита, назву параметра
   пошуку ми не знаємо і підставляємо навгад (`?search=`). Невідомий параметр
   Sitniks просто ігнорує й чемно віддає ПОЧАТОК ЗАГАЛЬНОГО СПИСКУ діалогів.
   Помилки при цьому немає, тож код вважав, що знайшов. Видно це навіть оком:
   усі номери йдуть підряд, бо створювались один за одним.

   А підпис «чат 6aa8…» зʼявлявся тому, що імені у відповіді немає в жодному
   з полів, які ми вміємо читати, — і замість назви лишався службовий номер.

   Перевіряємо:
     — контрольний запит вигаданим словом викриває, що пошуку немає, і про це
       сказано прямо, а не мовчки показано десять чужих діалогів;
     — те, що Sitniks не відсіяв, відсіваємо самі — по всьому тексту запису,
       включно з вкладеними полями, де нік зазвичай і лежить;
     — рядок читається очима: перше повідомлення й дата, а номер чату — лише
       дрібним хвостиком і лише коли назвати розмову більше нічим;
     — видно, що саме прислав Sitniks, — без цього назви полів не дізнатись;
     — коли CRM справді шукає, жодних попереджень немає й рядки звичайні.

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

/* Десять діалогів із номерами підряд — рівно те, що Sitniks віддає на будь-яке
   слово. Імені вгорі запису немає ніде: воно лежить у вкладеному `client`,
   і саме тому підпис і вироджувався в номер. */
const CHATS = Array.from({ length: 10 }, (_, i) => ({
  id: '6aa81' + String(i).padStart(2, '0') + 'b81e7a16bf05be' + (10 + i),
  createdAt: '2026-09-1' + (i % 5) + 'T10:0' + i + ':00Z',
  lastMessage: { text: i === 3 ? 'Вітаю, цікавить 30 худі з вишивкою'
                               : 'Добрий день, підкажіть ціну ' + i },
  client: { userName: i === 3 ? 'asia_dera' : 'client_' + i, channel: 'instagram',
            clientName: i === 3 ? 'Асія Дерещук' : 'Клієнт ' + i }
}));

/* Друга сторінка списку — щоб було що підвантажувати кнопкою «Показати ще». */
const PAGE2 = Array.from({ length: 5 }, (_, i) => ({
  id: '6aa82' + String(i).padStart(2, '0') + 'b81e7a16bf05be' + (30 + i),
  createdAt: '2026-09-0' + (i % 5) + 'T09:0' + i + ':00Z',
  lastMessage: { text: i === 2 ? 'Доброго дня, хочу худі з вишивкою' : 'Питання по ціні ' + i },
  client: { userName: 'old_' + i, channel: 'instagram',
            clientName: i === 2 ? 'Асія Дерещук' : 'Клієнт ' + i }
}));
let mode = 'nofilter';   // 'nofilter' — Sitniks ігнорує параметр; 'real' — шукає
let asked = [];          // які параметри в нас питали — це й перевіряємо
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    [...u.searchParams.keys()].forEach(k => { if(asked.indexOf(k) < 0) asked.push(k); });
    const page = +(u.searchParams.get('page') || 1);
    let out = page > 1 ? (page === 2 ? PAGE2 : []) : CHATS;
    if(mode === 'real'){
      /* Справжній пошук живе під іменем «q» — навмисно НЕ під тим, що ми
         підставляли навмання. Система має знайти його сама. */
      const q = (u.searchParams.get('q') || '').toLowerCase();
      out = (q ? CHATS.filter(c => JSON.stringify(c).toLowerCase().indexOf(q) >= 0) : CHATS)
              .map(c => Object.assign({ clientName: 'Асія Дерещук' }, c));
    }
    res.writeHead(200, { 'Content-Type':'application/json',
                         'Access-Control-Allow-Origin':'*' });
    res.end(JSON.stringify(out));
    return;
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

const ORDER = {
  id:'1', orderId:'1000801', type:'client', name:'Асія', instagram:'asia_dera',
  phone:'+380670000801', status:'new', site:'main',
  tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  createdAt:new Date().toISOString(), hist:[], totalPrice:35140,
  items:[{ kind:'main', name:'Худі', color:'чорне', garmentId:'hoodie', qty:30,
           unitPrice:1171, price:35140 }]
};
const CONTENT = { team: [], bgApi: { sitniksUrl: HOST + '/crm' } };

function stub(){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
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
await p.click('.ticket:has-text("1000801")');
await p.waitForTimeout(900);

const read = () => p.evaluate(() => {
  const box = document.querySelector('.od-seek');
  if(!box) return { err:'блоку пошуку немає' };
  return {
    note: (((box.querySelector('.od-crm-note') || {}).textContent) || '').replace(/\s+/g, ' ').trim(),
    filter: (box.querySelector('.od-seek-in') || {}).value,
    cnt: ((box.querySelector('.od-seek-cnt') || {}).textContent || '').trim(),
    more: !!box.querySelector('[data-seek-more]'),
    rows: [...box.querySelectorAll('.od-seek-r')].map(r => ({
      nm: (r.querySelector('.od-seek-nm') || {}).textContent.trim(),
      p: ((r.querySelector('.od-seek-p') || {}).textContent || '').trim(),
      id: ((r.querySelector('.od-seek-id') || {}).textContent || '').trim(),
      ch: ((r.querySelector('.od-seek-ch') || {}).textContent || '').trim() }))
  };
});
const seek = async () => {
  await p.evaluate(() => { const b = document.querySelector('.od-ig-find'); if(b) b.click(); });
  await p.waitForTimeout(2200);
  return read();
};

console.log('═══ SITNIKS НЕ ШУКАЄ — І ПРО ЦЕ СКАЗАНО ═══');
const r1 = await seek();
if(r1.err){ console.log('  ' + r1.err); bad++; }
else {
  console.log('  ' + r1.note.slice(0, 150));
  console.log('  показано: ' + r1.cnt + ' · фільтр: «' + r1.filter + '»');
  r1.rows.slice(0, 3).forEach(r => console.log('    • ' + r.nm + (r.p ? ' — ' + r.p : '')));
  ok(/не вміє шукати/i.test(r1.note),
    'сказано прямо: це не результат пошуку, а список діалогів',
    'мовчки показали чужі діалоги як знайдене: ' + r1.note.slice(0, 80));
  ok(!/номером замовлення/i.test(r1.note),
    'поради про номер замовлення немає — на цьому етапі його ще не існує',
    'лишилась непридатна порада про номер замовлення');
  ok(/Впишіть імʼя клієнта/i.test(r1.note),
    'замість глухого кута — що саме зробити',
    'підказки, що робити, немає: ' + r1.note.slice(0, 80));
  ok(r1.filter === 'Асія',
    'у полі фільтра вже стоїть імʼя клієнта з картки, а не нік',
    'у фільтрі не те: «' + r1.filter + '»');
  ok(!r1.rows.some(r => /^чат [0-9a-f]{12,}/.test(r.nm)),
    'жоден рядок не підписаний шістнадцятковим номером',
    'рядок називається номером чату');
}

console.log('');
console.log('═══ ФІЛЬТР ЗВУЖУЄ СПИСОК ═══');
/* Імʼя в даних є, нікнейма може не бути зовсім — саме тому фільтруємо по
   імені. Друкуємо, як людина, і дивимось, що лишилось. */
const typed = await p.evaluate(async () => {
  const inp = document.querySelector('.od-seek-in');
  inp.value = 'Дерещук';
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 400));
  const box = document.querySelector('.od-seek');
  return { rows: box.querySelectorAll('.od-seek-r').length,
           cnt: (box.querySelector('.od-seek-cnt') || {}).textContent.trim(),
           focus: document.activeElement === document.querySelector('.od-seek-in') };
});
console.log('  ' + typed.cnt + ' · рядків ' + typed.rows);
ok(typed.rows === 1,
  'за імʼям лишився один діалог із десяти',
  'фільтр не звузив список: ' + typed.rows + ' рядків');
ok(typed.focus,
  'поле не губить фокус після перемальовування — можна друкувати далі',
  'після першої літери фокус зник, друкувати нікуди');

console.log('');
console.log('═══ «ПОКАЗАТИ ЩЕ» ДОТЯГУЄ НАСТУПНІ ═══');
const more = await p.evaluate(async () => {
  const inp = document.querySelector('.od-seek-in');
  inp.value = '';
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 300));
  const b = document.querySelector('[data-seek-more]');
  if(!b) return { err:'кнопки немає' };
  b.click();
  await new Promise(r => setTimeout(r, 1800));
  const box = document.querySelector('.od-seek');
  return { rows: box.querySelectorAll('.od-seek-r').length };
});
console.log('  рядків після підвантаження: ' + (more.rows || more.err));
ok(more.rows === 15,
  'наступна сторінка дотягнулась і стала в той самий список',
  'підвантаження не спрацювало: ' + JSON.stringify(more));
/* І головне: у дотягнутій сторінці знаходиться той, кого не було в першій. */
const deep = await p.evaluate(async () => {
  const inp = document.querySelector('.od-seek-in');
  inp.value = 'Дерещук';
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  await new Promise(r => setTimeout(r, 400));
  return [...document.querySelectorAll('.od-seek-r .od-seek-nm')].map(x => x.textContent.trim());
});
console.log('  ' + JSON.stringify(deep));
ok(deep.length === 2,
  'давніша розмова знайшлась саме тому, що список дотягнули',
  'у дотягнутому списку її не видно: ' + JSON.stringify(deep));

console.log('');
console.log('═══ ВІДПОВІДЬ CRM ВИДНО ═══');
const raw = await p.evaluate(async () => {
  const b = document.querySelector('[data-seek-raw]'); if(b) b.click();
  await new Promise(r => setTimeout(r, 300));
  const el = document.querySelector('.od-seek-raw');
  return el ? el.textContent.slice(0, 200) : '';
});
ok(/lastMessage/.test(raw) && /userName/.test(raw),
  'видно справжню відповідь CRM — саме з неї й дізнаються назви полів',
  'відповідь CRM не показується');

console.log('');
console.log('═══ СПРАВЖНІЙ ПАРАМЕТР ЗНАХОДИТЬСЯ САМ ═══');
/* На сервері пошук живе під іменем «q», а ми починали з «search». Система має
   перебрати звичні назви й знайти робочу, не питаючи нікого. */
mode = 'real'; asked = [];
await p.evaluate(() => {
  for(const k in crmSeek) delete crmSeek[k];
  crmParamFound = null; crmPageFound = null;
});
const r2 = await seek();
console.log('  питали параметри: ' + asked.join(', '));
console.log('  ' + (r2.note ? r2.note.slice(0, 90) : '(попереджень немає)'));
r2.rows.forEach(r => console.log('    • ' + r.nm + '  [' + r.id + ']'));
ok(asked.indexOf('q') >= 0,
  'система сама дійшла до робочої назви параметра',
  'робочий параметр не пробували: ' + asked.join(', '));
ok(!r2.note,
  'коли пошук працює, ніяких пояснень не потрібно — вони б лише заважали',
  'зайве попередження при робочому пошуку: ' + r2.note.slice(0, 80));
ok(r2.rows.length === 1 && r2.rows[0].nm === 'Асія Дерещук',
  'рядок підписаний іменем клієнта',
  'рядок названий не іменем: ' + JSON.stringify(r2.rows));
ok(r2.rows.length === 1 && /Instagram/.test(r2.rows[0].ch),
  'і видно канал, з якого прийшла розмова',
  'канал не визначився: ' + JSON.stringify(r2.rows[0]));
ok(!r2.more,
  'кнопки підвантаження немає — коли CRM шукає, гортати весь список ні до чого',
  'кнопка підвантаження лишилась при робочому пошуку');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'пошук більше не видає початок списку за знайдене');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
