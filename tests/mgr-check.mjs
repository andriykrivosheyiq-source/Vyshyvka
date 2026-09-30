/* КАРТКА МЕНЕДЖЕРА: ПЕРЕВІРИТИ Й НАДІСЛАТИ ОДНИМ НАТИСКОМ.

   Андрій, дивлячись на колонку дизайну:

     «Коли ми вибираємо дизайнера, ми вибираємо тільки дизайнера… тут не
      треба дублювати, бо він не зверху — Володимир такий-то в роботі… Ми
      бачимо не файли, а от цю карточку, яку ми розробили: перевіряємо
      карточку, все добре — кнопка надіслати клієнту, там підписується v1.
      Або правка, і пишемо правку… коли натиснув, без відкривання чата воно
      надсилається, пишеться що надіслано, і все, можна закривати й іти далі
      по перевірці… B2B одні скрипти, B2C інші… Оцю всю аналітику можна
      перенести саме на низ карточки… Зону грошей і відправку зробити
      скритими.»

   Перевіряємо саме те, що з цього видно очима й коштує часу:

     1. у рядку дизайну — тільки вибір людини й лічильник непрочитаного;
     2. замість списку файлів — картка того, що піде клієнту;
     3. «Надіслати клієнту» шле сам, без відкривання розмови, і гасне;
     4. правка пишеться вікном і лягає в розмову;
     5. гроші й відправка складені, але розкриваються;
     6. історія внизу — сухі події, без реплік дизайнера;
     7. заготовки різні для B2B і B2C.

   Запуск:  node tests/mgr-check.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8929;
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

const CONTENT = {
  team: [{ email:'test@loomiq', name:'Володимир', role:'owner' },
         { email:'art@loomiq',  name:'Оля',       role:'designer' }],
  /* Заготовки обох напрямів і одна спільна: перевіряємо, що менеджер бачить
     свої й спільну, а чужу — ні. */
  quickReplies: [
    { t:'Вітання', m:'Вітаю! Чим допоможемо?' },
    { t:'Рахунок на ФОП', dir:'b2b', m:'Виставимо рахунок на ФОП, передоплата 50%.' },
    { t:'Макет · B2C', dir:'b2c', m:'{макет} Зробили макет — подивіться 🙌' },
    { t:'Макет · B2B', dir:'b2b', m:'{макет} Надсилаємо макет на погодження {версія}.' },
    { t:'Правки · B2C', dir:'b2c', m:'{правки} Виправили — ось оновлений макет {версія}.' }
  ]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', crmChatId:'c1',
    crmChatName:'Асія Дерещук', crmNick:'asia_dera', items:[] },
  { id:'2', orderId:'1000090', type:'client', name:'ТОВ Армор',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', crmChatId:'c2',
    crmChatName:'Армор', items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
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

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

const МОК = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100">' +
  '<rect width="80" height="100" fill="#1a1a1a"/></svg>').toString('base64');

await p.evaluate(мок => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobMake('2000101');
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:3, note:'Лого по центру' })];
  const d = D.dzNew();
  D.dzAttach(d, 'art@loomiq', 'test@loomiq');
  D.dzSend(d, 'test@loomiq');
  D.dzTake(d, 'art@loomiq');
  /* Три файли, як їх і кладе справжня здача: макет, мокап і АРКУШ. Аркуш
     третім — саме він і є документ, який менеджер бачить у картці, качає
     й надсилає клієнту. Сіяти два означало б перевіряти версію, якої в
     роботі не буває. */
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:мок }, { name:'мокап.png', url:мок },
      { name:'аркуш-v1.png', url:'https://x/аркуш-v1.png' }],
    'Зробила як просили', { wCm:23.7, hCm:9.5, topCm:14.9, sideCm:0, size:'M' });
  /* Репліка дизайнера: у розмові вона та сама, що й правка менеджера, — і
     саме тому історія не має рахувати її поверненням роботи. */
  D.dzSay(d, 'art@loomiq', 'Логотип білий чи молочний?', null);
  D.dzList(job.units[0], 'graphic').push(d);
  U.DZ_OPEN[job.units[0].id + '|graphic|0'] = 1;
  openDesign();
  U.setTab('acct'); U.open('2000101');
  U.render(document.getElementById('dzRoot'));
}, МОК);
await p.waitForTimeout(800);

/* Перехоплюємо надсилання: справжній Sitniks тут недосяжний, а перевірити
   треба саме те, ЩО і КУДИ пішло б — і що розмова при цьому не відкрилась.

   Підміну робимо ПІСЛЯ `openDesign()`: він складає `host` наново, і все,
   покладене туди раніше, зникає разом зі старим обʼєктом. */
await p.evaluate(() => {
  window.__SENT = [];
  window.__OPENED = 0;
  window.LQDesign.ui.host.tellPic = async (o, url, text) => {
    window.__SENT.push({ order:o.orderId, url, text });
    return true;
  };
  const був = window.LQDesign.ui.host.chat;
  window.LQDesign.ui.host.chat = o => { window.__OPENED++; return був(o); };
  window.__SAID = [];
  const t = window.toast;
  window.toast = m => { window.__SAID.push(String(m)); try{ t(m); }catch(e){} };
});

console.log('\n═══ НІК КЛІЄНТА НЕ ГУБИТЬСЯ ═══');
/* ПОЛОМКА, ЯКА ВИГЛЯДАЛА ЯК «НЕ ПІДТЯГУЄТЬСЯ».

   Привʼязка розмови клала в картку ОДНЕ значення — нік, якщо він був,
   інакше імʼя, — і все це лягало в `crmChatName`. Поле `crmNick` не
   заповнювалось ніколи, а підпис клієнта будується саме з нього. Через це
   ніків у картках не було видно взагалі; Sitniks їх чесно віддавав, а ми
   самі викидали рядком нижче.

   Нік важить більше за імʼя: імʼя профілю міняють, нік — майже ніколи, і
   саме за ним людину знаходять у Direct. */
const нік = await p.evaluate(async () => {
  const o = orders.filter(x => x.orderId === '2000101')[0];
  const було = { nick:o.crmNick, name:o.crmChatName };
  /* Проходимо привʼязку так, як вона йде насправді: Sitniks недосяжний,
     тож підміняємо саме його відповідь, а не наш код. */
  window.crmFetch = async () => ([{ chatId:'c9', username:'nova_klientka',
                                    clientName:'Олена Ковальчук' }]);
  /* Адреса саме того вигляду, який Sitniks дає в рядку браузера: розбір
     чекає на /dialog/<шістнадцяткові>. */
  await designBindChat(o, 'https://crm.sitniks.com/dialog/a1b2c3d4e5f6a7b8');
  return { було, nick:o.crmNick, name:o.crmChatName,
           підпис: crmWhoLabel(o), ig:o.ig || '' };
});
console.log('  ' + JSON.stringify(нік));
ok(нік.nick === 'nova_klientka',
  'нік із розмови лягає у своє поле, а не злипається з іменем',
  'нік не зберігся: ' + JSON.stringify(нік));
ok(нік.name === 'Олена Ковальчук',
  'а імʼя — у своє',
  'імʼя не зберіглось: ' + нік.name);
ok(/@nova_klientka/.test(нік.підпис) && /Олена/.test(нік.підпис),
  'і підпис клієнта показує обидва: ' + нік.підпис,
  'підпис клієнта без ніка: ' + нік.підпис);
/* І в канал Instagram теж: за ніком людину шукають і з картки Канбану, не
   лише у відділі. */
ok(нік.ig === 'nova_klientka',
  'нік доїхав і в канал — його видно з картки замовлення',
  'у каналі ніка немає: ' + нік.ig);

console.log('\n═══ У КОЛОНЦІ ДИЗАЙНУ — ТІЛЬКИ ПОТРІБНЕ ═══');
/* Доти тут стояло імʼя дизайнера, той самий список під ним, стан словом,
   стан кольором, уся розмова з часами й ще три кнопки про файли. Менеджер
   відкриває цю колонку двічі за замовлення — призначити людину й перевірити
   роботу; усе інше доводилось обходити очима щоразу. */
const рядок = await p.evaluate(() => {
  const r = document.querySelector('.dz-u-col');
  /* Хто робить — у шапці зони, а не рядком під нею: доти капсула
     «ПЕРЕДАНО» й імʼя стояли двома написами поспіль про одну річ. */
  return { хто: ((r.querySelector('.dz-u-l .dz-u-who') || {}).textContent || '').trim(),
           списків: r.querySelectorAll('.dz-u-l select').length,
           олівець: !!r.querySelector('.dz-u-l [data-do="dz-swap"]'),
           текст: r.textContent.replace(/\s+/g, ' ').trim(),
           часів: (r.textContent.match(/Передано в роботу|Взяв у роботу/g) || []).length,
           кнопки: [...r.querySelectorAll('.dz-b')].map(b => b.textContent.trim()) };
});
console.log('  ' + JSON.stringify(рядок));
ok(рядок.хто === 'Оля' && !рядок.списків,
  'обрана людина стоїть імʼям, а не списком, який і далі пропонує обирати',
  'хто робить — не видно: ' + JSON.stringify(рядок));
ok(рядок.олівець,
  'поруч олівець — щоб замінити',
  'олівця заміни немає');
ok(!/у роботі|не передано|на перевірці/.test(рядок.текст),
  'стан словом звідси пішов — його вже каже колір колонки',
  'стан і далі дублюється словом: ' + рядок.текст);
/* А ОСЬ РОЗМОВА СЮДИ ПОВЕРНУЛАСЬ, і це свідома зміна рішення.

   Спершу ми винесли її в Історію: колонка мала показувати рішення, а не
   стрічку подій. На ділі вийшло, що розмова одна на двох, і коли в
   дизайнера вона повна, а в менеджера обрізана до трьох рядків, вони
   говорять про різне: менеджер відповідає на те, що бачить, а не на те,
   що написали. Тепер обидва дивляться в один потік, дзеркально — своє
   праворуч, чуже ліворуч, — а події йдуть окремим рядком посередині, не
   бульбашкою: «Передано в роботу» ніхто не казав, це сталось. */
ok(рядок.часів >= 1,
  'розмова з подіями стоїть тут же: обидва дивляться в один потік',
  'у менеджера розмови немає — він відповідатиме на те, чого не бачить');
ok(!рядок.кнопки.some(t => /Файл|Версія|Додати дизайнера/.test(t)),
  'а кнопок про файли й версії тут немає зовсім',
  'у колонці лишились зайві кнопки: ' + JSON.stringify(рядок.кнопки));

console.log('\n═══ НЕ СПИСОК ФАЙЛІВ, А КАРТКА ═══');
/* «макет.png, мокап.png» не дає перевірити нічого: щоб побачити роботу,
   доводилось відкривати обидва в нових вкладках і тримати в голові, який
   із них який. А перевіряють її щодня й по десять разів. */
const картка = await p.evaluate(() => {
  const c = document.querySelector('.dz-chk');
  if(!c) return null;
  return { версія: ((c.querySelector('.dz-chk-t b') || {}).textContent || '').trim(),
           мокап: !!c.querySelector('.dz-chk-i img'),
           розміщення: [...c.querySelectorAll('.dz-chk-t i')]
             .map(i => i.textContent.trim()).join(' | '),
           дії: [...c.querySelectorAll('.dz-b')].map(b => b.textContent.trim()) };
});
console.log('  ' + JSON.stringify(картка));
/* Підпис — номер замовлення й версія: саме так його називають уголос
   («скинь 2000101, першу») і саме так підписаний файл, що поїде клієнту. */
/* Номер ТОЙ САМИЙ, що в шапці картки. Доти підпис версії брав номер
   ЗАМОВЛЕННЯ, а шапка — номер відділу: у картці стояло «#2000001» вгорі й
   «5001 · v1» посередині, і два різні числа про ту саму роботу
   перетворювали кожну розмову на зʼясування, про що мова. */
/* Номер із шапки беремо рівно перше слово — далі там стан, строк і хрестик,
   і вони злипаються в один текстовий вузол. */
const уШапці = await p.evaluate(() =>
  (((document.querySelector('.dz-panel-h') || {}).textContent || '')
     .match(/^#\d+/) || [''])[0]);
ok(картка && картка.мокап && картка.версія.indexOf(уШапці) === 0,
  'видно те, що піде клієнту, і номер той самий, що в шапці: ' + картка.версія,
  'номер на картці розходиться з шапкою: «' + (картка || {}).версія +
    '» проти «' + уШапці + '»');
/* А от РОЗМІРІВ тут немає, і це рішення. «23,7 см × 9,5 см · від горловини
   14,9 · на M» — виробнича мірка: вона потрібна цеху й уже стоїть в аркуші,
   який качають. Менеджер у цю мить вирішує одне — показувати клієнту чи
   повертати на правку, — і чотири числа між ним і цим рішенням лише
   забирають місце. Андрій: «це більше виробниче, і так зрозуміло, це не
   потрібно нам дублювати». */
ok(!/23,7 см|горловини/.test(картка.розміщення),
  'а виробничих розмірів тут немає — вони в аркуші, для цеху',
  'розміри дублюються в картці перевірки: ' + картка.розміщення);
ok(/Зробила як просили/.test(картка.розміщення),
  'зате слова дизайнера лишились: вони пояснюють саме цю версію',
  'коментаря дизайнера немає: ' + картка.розміщення);
/* Три дії в один рядок: погодити, повернути, показати. Це вибір, а не
   послідовність кроків. «Погоджено» — зелена й з галочкою, бо саме після
   неї робота йде далі, і плутати її з «Правкою» дорого. */
ok(картка.дії.some(t => /Надіслати/.test(t)) &&
   картка.дії.some(t => /Правка/.test(t)) &&
   картка.дії.some(t => /Погоджено/.test(t)),
  'дій три: погодити, повернути, показати — ' + картка.дії.join(' · '),
  'дій на картці не ті: ' + JSON.stringify(картка.дії));

/* «Очікуємо макет» зникає, щойно макет прийшов: воно стояло замість
   кнопки передачі, щоб було видно, що ми вже відправили. Коли робота є,
   це й так зрозуміло з самої роботи. */
const очікування = await p.evaluate(() =>
  !!document.querySelector('.dz-wait'));
ok(!очікування,
  'і «очікуємо макет» зникло — макет уже тут',
  'у колонці й далі висить «очікуємо», хоч робота прийшла');

console.log('\n═══ ПІДПИС: НОМЕР І МІСЦЕ ПОЗИЦІЇ ═══');
/* Одна позиція — досить номера. Дві й більше — без номера позиції не
   зрозуміти, про який саме виріб мова; саме так їх і називають уголос, і
   саме так має бути підписаний файл, що поїде в цех. */
const підписи2 = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  const job = designJobs['2000101'];
  const одна = U.unitNo(job, job.units[0]);
  job.units.push(Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', qty:1 }));
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  const дві = [U.unitNo(job, job.units[0]), U.unitNo(job, job.units[1])];
  const уКартці = ((document.querySelector('.dz-chk-t b') || {}).textContent || '').trim();
  job.units.length = 1;
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  return { одна, дві, уКартці };
});
console.log('  ' + JSON.stringify(підписи2));
ok(підписи2.одна === '#2000001',
  'одна позиція — просто номер: ' + підписи2.одна,
  'зайвий хвіст при одній позиції: ' + підписи2.одна);
ok(підписи2.дві.join('|') === '#2000001-1|#2000001-2',
  'дві — номер із місцем позиції: ' + підписи2.дві.join(' · '),
  'позиції не нумеруються: ' + JSON.stringify(підписи2.дві));
ok(/#2000001-1 · v1/.test(підписи2.уКартці),
  'і той самий підпис стоїть на картці перевірки: ' + підписи2.уКартці,
  'на картці інший підпис: ' + підписи2.уКартці);

console.log('\n═══ ДУБЛЬ НЕ ЗАБИРАЄ СОБІ ЧУЖУ РОБОТУ ═══');
/* Доти кнопка ⧉ копіювала позицію цілком, разом зі списками дизайнів — і
   в новій позиції вже стояв дизайнер, якого туди ніхто не призначав, ще й
   без можливості обрати іншого. Дизайн не властивість виробу: це окреме
   призначення, окрема передача й окрема історія версій. */
const дубль = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobs['2000101'];
  await U.act('u-dup', document.getElementById('dzRoot'), { u: job.units[0].id });
  await new Promise(r => setTimeout(r, 600));
  const нова = job.units[1] || {};
  const out = { позицій: job.units.length,
                виріб: нова.gid, колір: нова.color, коментар: нова.note,
                дизайнів: D.dzList(нова, 'graphic').length,
                списків: document.querySelectorAll('.dz-u')[1]
                  ? document.querySelectorAll('.dz-u')[1].querySelectorAll('select').length : 0 };
  job.units.length = 1;
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  return out;
});
console.log('  ' + JSON.stringify(дубль));
ok(дубль.позицій === 2 && дубль.виріб === 'tee' && /Лого/.test(дубль.коментар || ''),
  'копія бере виріб, колір і коментар — те, що справді «те саме»',
  'копія не скопіювала виріб: ' + JSON.stringify(дубль));
ok(!дубль.дизайнів,
  'а дизайнів не бере: у копії нікого не призначено',
  'копія забрала собі чужу роботу: дизайнів ' + дубль.дизайнів);
ok(дубль.списків >= 1,
  'і в ній є з чого обрати дизайнера — випадний список на місці',
  'у копії немає вибору дизайнера');

console.log('\n═══ НАДСИЛАЄМО БЕЗ ВІДКРИВАННЯ РОЗМОВИ ═══');
/* Перевіряють макети пачкою: десять карток підряд. Кожне «відкрий розмову —
   встав картинку — напиши текст — повернись» це пів хвилини й шанс
   повернутись не туди. */
await p.evaluate(() => {
  [...document.querySelectorAll('.dz-chk .dz-b')]
    .filter(b => /^Надіслати$/.test(b.textContent.trim()))[0].click();
});
await p.waitForTimeout(900);
const пішло = await p.evaluate(() => ({
  надіслано: window.__SENT,
  відкрито: window.__OPENED,
  /* Окремого напису «Надіслано» більше немає: тепер це сама кнопка, яка
     згасла. Доти напис і жива кнопка стояли поруч — система казала «вже
     зробив» і водночас пропонувала зробити ще раз. */
  кнопка: ((document.querySelector('.dz-chk .dz-b.is-sent') || {}).textContent || '').trim(),
  щеМожна: [...document.querySelectorAll('.dz-chk [data-do="dz-tell-pick"]')].length,
  ще: [...document.querySelectorAll('.dz-chk .dz-b')]
        .some(b => /^Надіслати$/.test(b.textContent.trim()))
}));
console.log('  ' + JSON.stringify(пішло));
ok(пішло.надіслано.length === 1 && пішло.надіслано[0].url,
  'картинка пішла клієнту одним натиском',
  'нічого не надіслалось: ' + JSON.stringify(пішло.надіслано));
/* І пішов саме АРКУШ, а не мокап. Це не дрібниця: на аркуші наші контакти,
   розміри й застереження про колір, а на мокапі — сама футболка з лого.
   Доти, коли аркуш не збирався, підставлявся мокап — мовчки, і помічали це
   вже з боку клієнта: «а в мене інший відтінок». */
ok(/аркуш/.test(пішло.надіслано[0].url || ''),
  'і пішов саме аркуш, а не голий мокап: ' + пішло.надіслано[0].url,
  'клієнту поїхав не аркуш: ' + пішло.надіслано[0].url);
ok(!пішло.відкрито,
  'і розмова при цьому НЕ відкрилась — можна йти до наступної картки',
  'розмова все одно відкрилась ' + пішло.відкрито + ' раз');
/* Текст береться зі скрипта свого напряму: B2C-заготовка, а не B2B. */
ok(/подивіться/i.test(пішло.надіслано[0].text || ''),
  'разом із нею пішов текст зі скрипта: ' +
    String(пішло.надіслано[0].text).slice(0, 50) + '…',
  'текст не підставився: ' + пішло.надіслано[0].text);
ok(!/ФОП|рахунок/i.test(пішло.надіслано[0].text || ''),
  'і саме B2C-скрипт — приватній людині не пишуть про рахунок на ФОП',
  'пішов чужий скрипт: ' + пішло.надіслано[0].text);
/* Кнопка стала позначкою. Нову версію показати можна буде знову — вона
   оживає сама, бо це вже інший ескіз; а ту саму вдруге не пошлеш. */
ok(/Надіслано/.test(пішло.кнопка),
  'кнопка стала позначкою «надіслано»: ' + пішло.кнопка,
  'не видно, що надіслали: ' + пішло.кнопка);
ok(!пішло.щеМожна,
  'і надіслати цю саму версію вдруге вже нема чим — одна версія, одне надсилання',
  'кнопка «Надіслати» лишилась живою, і ту саму версію пошлють ще раз');

console.log('\n═══ ПРАВКА — ВІКНОМ ═══');
/* Правку пишуть, дивлячись на макет. Поле в кінці списку повідомлень
   означає «догортайте вниз, а тоді згадайте, що саме хотіли сказати». */
await p.evaluate(() => {
  [...document.querySelectorAll('.dz-chk .dz-b')]
    .filter(b => /Правка/.test(b.textContent))[0].click();
});
await p.waitForTimeout(400);
const вікно = await p.evaluate(() => {
  const w = document.querySelector('.dz-fixw');
  return { є: !!w, поле: !!(w && w.querySelector('.dz-fix-t')),
           файл: !!(w && w.querySelector('[data-fix-file]')) };
});
console.log('  ' + JSON.stringify(вікно));
ok(вікно.є && вікно.поле,
  'вікно правки відкрилось просто над карткою',
  'вікна правки немає');
ok(вікно.файл,
  'і приймає файл: клієнт часто присилає «ось так має бути» картинкою',
  'у вікні правки не можна прикріпити файл');
const правка = await p.evaluate(async () => {
  const w = document.querySelector('.dz-fixw');
  w.querySelector('.dz-fix-t').value = 'Клієнт просить лого ще менше';
  w.querySelector('[data-fix-go]').click();
  await new Promise(r => setTimeout(r, 900));
  const d = window.LQDesign.dzList(designJobs['2000101'].units[0], 'graphic')[0];
  return { стан: d.status,
           останнє: (d.thread[d.thread.length - 1] || {}).text || '',
           вікно: !!document.querySelector('.dz-fixw') };
});
console.log('  ' + JSON.stringify(правка));
ok(/ще менше/.test(правка.останнє) && !правка.вікно,
  'написали — вікно закрилось, а правка лягла в розмову',
  'правка не записалась: ' + JSON.stringify(правка));
ok(правка.стан === 'revision',
  'і дизайн повернувся на правки',
  'стан після правки не той: ' + правка.стан);

console.log('\n═══ ГРОШІ Й ВІДПРАВКА СКЛАДЕНІ ═══');
/* За день у картку заходять по десять разів, і щоразу проминають два блоки,
   у яких сьогодні нічого не змінилось: гроші дивляться раз, коли прийшла
   оплата, адресу — раз, коли пакують. */
const зони = await p.evaluate(() => [...document.querySelectorAll('.dz-panel-b .dz-z')].map(z => ({
  назва: ((z.querySelector('.dz-z-h b') || {}).textContent || '').trim(),
  складена: z.classList.contains('is-fold'),
  відкрита: z.classList.contains('open'),
  тіло: !!z.querySelector('.dz-z-b')
})));
console.log('  ' + зони.map(z => z.назва + (z.складена ? (z.відкрита ? ' [відкрита]' : ' [складена]') : '')).join(' · '));
const гроші = зони.filter(z => z.назва === 'Гроші')[0] || {};
const відпр = зони.filter(z => z.назва === 'Відправка')[0] || {};
ok(гроші.складена && !гроші.тіло && відпр.складена && !відпр.тіло,
  'обидві складені — і вміст справді не малюється, а не просто схований',
  'гроші або відправка не складені: ' + JSON.stringify([гроші, відпр]));
ok((зони.filter(z => z.назва === 'Склад і дизайн')[0] || {}).тіло,
  'а склад лишається відкритим: із ним працюють щодня',
  'склад теж склали — саме з ним і працюють');
/* Підпис має казати головне й складеною: інакше довелось би розгортати,
   щоб дізнатись, чи там узагалі щось є. */
const підписи = await p.evaluate(() => [...document.querySelectorAll('.dz-z.is-fold .dz-z-s')]
  .map(s => s.textContent.trim()));
console.log('  ' + JSON.stringify(підписи));
/* Складених зон три: гроші, відправка й історія. Кожна підписана тим, що в
   ній, — інакше довелось би розгортати, щоб дізнатись, чи там щось є. */
ok(підписи.length === 3 && підписи.every(Boolean),
  'і кожна підписана тим, що в ній: ' + підписи.join(' · '),
  'складені зони нічого про себе не кажуть: ' + JSON.stringify(підписи));
/* Натиснув — розкрилась. */
const розкрили = await p.evaluate(async () => {
  [...document.querySelectorAll('[data-fold]')]
    .filter(b => /Гроші/.test(b.textContent))[0].click();
  await new Promise(r => setTimeout(r, 400));
  const z = [...document.querySelectorAll('.dz-z')].filter(x => /Гроші/.test(x.textContent))[0];
  return { відкрита: z.classList.contains('open'), тіло: !!z.querySelector('.dz-z-b') };
});
ok(розкрили.відкрита && розкрили.тіло,
  'натиснув — розкрилась',
  'складена зона не розкривається: ' + JSON.stringify(розкрили));

console.log('\n═══ ІСТОРІЯ — СУХІ ПОДІЇ ═══');
/* Питання «а коли ми це віддали?» задають рівно тоді, коли щось пішло не
   так, — і відповідь має бути одним поглядом. Але це не другий чат: слова
   лежать у розмові при дизайні, куди їх і писали. */
/* Історія теж складена: її читають не щодня, але коли читають — читають
   усю. Розкриваємо так само, як це робить людина. */
await p.evaluate(async () => {
  const b = [...document.querySelectorAll('[data-fold]')].filter(x => /Історія/.test(x.textContent))[0];
  if(b) b.click();
  await new Promise(r => setTimeout(r, 400));
});
await p.waitForTimeout(500);
const іст = await p.evaluate(() => {
  const z = [...document.querySelectorAll('.dz-z')].filter(x => /Історія/.test(x.textContent))[0];
  return { є: !!z,
    останній: !!z && z === document.querySelectorAll('.dz-panel-b .dz-z')[
      document.querySelectorAll('.dz-panel-b .dz-z').length - 1],
    рядки: [...(z ? z.querySelectorAll('.dz-hist-r') : [])]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim()) };
});
console.log('  ' + JSON.stringify(іст.рядки));
ok(іст.є && іст.останній,
  'історія стоїть у самому низу картки',
  'історії немає або вона не внизу');
/* Речення читається як речення: КОЛИ · ХТО · ЩО ЗРОБИВ. Доти першим стояло
   «здано», і щоб дізнатись ким, треба було дочитати рядок до кінця — а
   питають саме про «ким». */
ok(іст.рядки.some(t => /Володимир.*передача роботи/.test(t)) &&
   іст.рядки.some(t => /Оля.*у роботі/.test(t)) &&
   іст.рядки.some(t => /Оля.*здача версії/.test(t)),
  'і показує, ХТО що зробив: передача → у роботі → здача',
  'подій у історії бракує: ' + JSON.stringify(іст.рядки));
/* ГОЛОВНЕ. Питання дизайнера в розмові має ту саму позначку, що й правка
   менеджера. Якби історія рахувала його поверненням роботи, у ній стояли б
   правки, яких не було, — і за цим числом судили б про дизайнера. */
/* Питання дизайнера тут Є — але як «написав», а не як «повернув на
   правку». Та сама позначка стоїть і на словах менеджера, і на словах
   дизайнера, бо в розмові вони однакові; в історії ж його питання не є
   поверненням роботи, і рахувати його так означало б рахувати правки,
   яких не було, — а за цим числом судять про дизайнера. */
ok(іст.рядки.some(t => /Оля.*повідомлення/.test(t)),
  'питання дизайнера в історії є — як повідомлення, не як правка',
  'питання дизайнера з історії зникло: ' + JSON.stringify(іст.рядки));
const скількиПравок = іст.рядки.filter(t => /повернення на правку/.test(t)).length;
ok(скількиПравок === 1,
  'і повернень рівно стільки, скільки їх було: ' + скількиПравок,
  'повернень нарахувало ' + скількиПравок + ' — питання дизайнера рахується як правка');

console.log('\n═══ ЗАГОТОВКИ РІЗНІ ДЛЯ НАПРЯМІВ ═══');
/* Компанії пишуть «виставимо рахунок на ФОП»; приватній людині в Директ
   таке слати нема сенсу, і навпаки. */
const заг = await p.evaluate(() => {
  const б2ц = orders.filter(o => o.orderId === '2000101')[0];
  const б2б = orders.filter(o => o.orderId === '1000090')[0];
  const назви = o => quickRepliesFor(o).map(q => q.t);
  return { b2c: назви(б2ц), b2b: назви(б2б),
           скриптB2C: scriptFor(б2ц, 'design1', { v:1 }),
           скриптB2B: scriptFor(б2б, 'design1', { v:1 }) };
});
console.log('  B2C: ' + заг.b2c.join(', '));
console.log('  B2B: ' + заг.b2b.join(', '));
ok(заг.b2c.includes('Макет · B2C') && !заг.b2c.includes('Макет · B2B'),
  'у B2C свої заготовки, чужих немає',
  'B2C бачить чужі заготовки: ' + заг.b2c.join(', '));
ok(заг.b2b.includes('Рахунок на ФОП') && !заг.b2b.includes('Макет · B2C'),
  'у B2B — свої',
  'B2B бачить чужі заготовки: ' + заг.b2b.join(', '));
ok(заг.b2c.includes('Вітання') && заг.b2b.includes('Вітання'),
  'а спільна лишається в обох: не все ж різне',
  'спільна заготовка зникла з одного з напрямів');
ok(заг.скриптB2C !== заг.скриптB2B && !/\{макет\}/.test(заг.скриптB2C),
  'і скрипт показу макета в кожного свій, без службової позначки',
  'скрипти однакові або з позначкою: ' + JSON.stringify(заг));
/* Номер версії підставляється: клієнт має бачити, про яку саме мова. */
const зВерсією = await p.evaluate(() =>
  scriptFor(orders.filter(o => o.orderId === '1000090')[0], 'design1', { v:3 }));
ok(/v3/.test(зВерсією),
  'номер версії підставляється в текст: ' + зВерсією,
  'номер версії не підставився: ' + зВерсією);

console.log('\n═══ СТАРА ПОЗИЦІЯ, БЕЗ ПОЛІВ, НЕ ВАЛИТЬ РОЗДІЛ ═══');
/* ПОЛОМКА, ЯКУ НАБІР ПРОПУСТИВ, БО ВСІ ЙОГО ДАНІ БУЛИ НОВІ.

   Замовлення, заведені до появи картинок при виробі, лежать у базі БЕЗ поля
   `pics` зовсім. Один `.map` по ньому — і весь розділ падає з «Cannot read
   properties of undefined», хоч дані цілком справні: вони просто старші за
   код. На екрані це виглядає як біла сторінка з червоною смугою, а не як
   «одна картка не намалювалась».

   Тому заводимо позицію САМЕ ТАКОЮ, якою вона приходить зі старої бази:
   без pics, без graphic, без stitch. Синтетичні дані, у яких усі поля на
   місці, цю дірку не бачать — і не бачили. */
const стара = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  const job = designJobs['2000101'];
  /* Не `unitNew()`: він дописує всі поля. Саме сирий обʼєкт, як у базі. */
  job.units = [{ id:'u-old', gid:'tee', name:'Футболка базова',
                 color:'Чорний', size:'M', qty:2, note:'зі старої бази' }];
  const були = [];
  const бувОн = window.onerror;
  window.onerror = (m) => { були.push(String(m)); return false; };
  try{ U.render(document.getElementById('dzRoot')); }
  catch(e){ були.push('render: ' + e.message); }
  await new Promise(r => setTimeout(r, 400));
  window.onerror = бувОн;
  return { помилки: були,
           намалювалось: !!document.querySelector('.dz-u'),
           поля: !!document.querySelector('.dz-u-f'),
           /* Половин дві, але відкрита одна, а друга — смужкою: рахуємо
              обидві разом, бо перевіряємо, що позиція намалювалась цілком,
              а не яка з них зараз ширша. */
           колонки: document.querySelectorAll('.dz-u-col').length +
                    document.querySelectorAll('.dz-u-rail').length,
           /* І поля дописались — щоб наступний дотик до них теж не впав. */
           pics: Array.isArray(job.units[0].pics) };
});
console.log('  ' + JSON.stringify(стара));
ok(!стара.помилки.length,
  'позиція без полів малюється без жодної помилки',
  'стара позиція валить розділ: ' + стара.помилки.join(' | '));
ok(стара.намалювалось && стара.поля && стара.колонки === 2,
  'і малюється цілком: поля, обидві колонки дизайну',
  'стара позиція намалювалась неповно: ' + JSON.stringify(стара));
ok(стара.pics,
  'а бракуючі поля дописались один раз — там, де позиції беруть',
  'поля не дописались, і наступний дотик до них знову впаде');

console.log('\n═══ ВЕРСІЮ ОБИРАЮТЬ, А НЕ БЕРУТЬ ОСТАННЮ ═══');
/* Клієнт часто каже «беремо другу», подивившись третю. «Остання» тут
   означає не те, про що домовились, — і мовчки взята остання версія це
   макет у машину повз погодження. */
const вибір = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  /* Попередня перевірка лишила позицію зі старої бази — без дизайнів.
     Заводимо роботу наново, щоб було що погоджувати. */
  const job = designJobs['2000101'];
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:3 })];
  const d0 = D.dzNew();
  D.dzAttach(d0, 'art@loomiq', 'test@loomiq');
  D.dzSend(d0, 'test@loomiq'); D.dzTake(d0, 'art@loomiq');
  D.dzVer(d0, 'art@loomiq', [{ name:'макет.png', url:'https://x/1.png' }], 'перша');
  D.dzList(job.units[0], 'graphic').push(d0);
  const d = D.dzList(job.units[0], 'graphic')[0];
  D.dzVer(d, 'art@loomiq', [{ name:'макет2.png', url:'https://x/2.png' }], 'друга');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  [...document.querySelectorAll('.dz-chk-b .dz-b')]
    .filter(b => /Погоджено/.test(b.textContent))[0].click();
  await new Promise(r => setTimeout(r, 400));
  const карток = [...document.querySelectorAll('.dz-pick-c')].map(c =>
    c.textContent.replace(/\s+/g, ' ').trim());
  /* Обираємо ПЕРШУ — тобто v1, не останню: саме це й перевіряємо. */
  const v1 = [...document.querySelectorAll('.dz-pick-c')].filter(c => /v1/.test(c.textContent))[0];
  if(v1) v1.click();
  await new Promise(r => setTimeout(r, 700));
  return { варіанти: карток, погоджено: (d.ok || {}).ver, як: (d.ok || {}).how,
           стан: d.status };
});
console.log('  ' + JSON.stringify(вибір));
ok(вибір.варіанти.length === 2,
  'перед погодженням показані всі версії: ' + вибір.варіанти.join(' · '),
  'вибору версії немає: ' + JSON.stringify(вибір.варіанти));
ok(вибір.погоджено === 1,
  'погоджена саме та, яку обрали, а не остання: v' + вибір.погоджено,
  'погодилась не та версія: v' + вибір.погоджено);
/* «Ескіз погоджений» — це слово КЛІЄНТА, після якого робота йде далі. */
ok(вибір.як === 'client' && вибір.стан === 'approved',
  'і записано як рішення клієнта, після якого робота йде далі',
  'погодження записано не так: ' + JSON.stringify(вибір));

console.log('\n═══ ПОГОДИЛИ → ВІДКРИЛАСЬ ВИШИВКА ═══');
/* Оцифровувати нема чого, поки графіку не погодили: файл робили б під
   макет, який ще поміняють. А погодили — відкривається, і передати можна
   саме ту версію, про яку домовились. */
const вишивка = await p.evaluate(() => {
  /* Після погодження відкрита половина рівно одна — вишивальна: робота
     перейшла туди, і місце пішло за нею. Графіка згорнулась у смужку. */
  const кол = document.querySelector('.dz-u-col');
  return { текст: кол.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
           вибір: кол.querySelectorAll('select').length,
           смужка: (document.querySelector('.dz-u-rail') || {}).dataset
             ? document.querySelector('.dz-u-rail').dataset.side : '' };
});
console.log('  ' + JSON.stringify(вишивка));
ok(вишивка.вибір === 1 && !/ще не погодили/.test(вишивка.текст),
  'вишивальна колонка відкрилась і просить обрати дизайнера',
  'вишивка й далі закрита: ' + вишивка.текст);
ok(/ВИШИВАЛЬНИЙ/i.test(вишивка.текст) && вишивка.смужка === 'graphic',
  'і місце пішло за роботою: вишивка розгорнута, готова графіка — смужкою',
  'половини не помінялись: ' + JSON.stringify(вишивка));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nменеджер перевіряє картку й шле її одним натиском');
process.exit(bad ? 1 : 0);
