/* КАРТКА ГРАФІЧНОГО ДИЗАЙНЕРА: БЕЗ КЛІЄНТА, ЗІ СВОЇМ ГОДИННИКОМ.

   Андрій, дивлячись на те, що бачить дизайнер:

     «В карточці графічного дизайнера у нього не повинна бути звʼязка з
      клієнтом. Він інстаграма не бачить. Карточки він бачить на назву
      клієнта — також він не бачить. Він бачить, до якої дати йому потрібно
      здати… йому дається доба на реалізацію, то таймер іде на добу.
      Коментар бачить, бачить картинку, на картинці повинна бути можливість
      скачки, щоб йому зручно було скачати, швидко… Якщо дизайнер не хоче
      брати це замовлення, то каже не брати… Коли натисну підтвердити
      замовлення, воно перетягується в роботі… Може прикріпити файл і
      надіслати, і зʼявляється v1. Якщо є якась правка, в нього знову горить
      червоним… Чому він тут бачить, що це є — графічний дизайнер він.»

   Тут кожне речення — окреме право доступу або окрема поломка робочого
   дня. Перевіряємо саме їх:

     1. у картці дизайнера немає ні імені клієнта, ні ніка, ні Instagram,
        ні суми — ні в панелі, ні на картці дошки;
     2. строк — свій годинник від передачі, а не дата замовлення;
     3. передане чекає в «Нових», поки він не скаже «беру»;
     4. «не братиму» повертає роботу менеджеру;
     5. картинки скачуються просто з мініатюри;
     6. файл і коментар здаються однією дією й стають v1;
     7. правка менеджера повертає картку в «Правки» й горить червоним.

   Запуск:  node tests/designer-card.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8919;
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
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Оля',       role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 8 }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] }
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
p.on('dialog', d => d.accept(''));
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

const ЗАВЕСТИ = `(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobMake('2000101');
  job.due = '2026-10-14';
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова',
    color:'Чорний', size:'M', qty:3,
    note:'Логотип менше, по центру грудей',
    pics:[{ name:'лого.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }] })];
  const d = D.dzNew();
  D.dzAttach(d, 'test@loomiq', 'mgr@loomiq');
  D.dzSend(d, 'mgr@loomiq');
  D.dzList(job.units[0], 'graphic').push(d);
  openDesign();
  U.setTab('graphic');
  U.render(document.getElementById('dzRoot'));
})()`;
await p.evaluate(ЗАВЕСТИ);
await p.waitForTimeout(700);

console.log('\n═══ ПЕРЕДАНЕ ЧЕКАЄ В «НОВИХ» ═══');
/* Доти передача одразу ставила «в роботі», і дошка брехала: картка
   виглядала взятою, хоч людина її ще не бачила. Різниця важлива рівно
   тоді, коли строк горить. */
const дошка = await p.evaluate(() => {
  const к = document.querySelector('.dz-card-w');
  const кол = к && к.closest('.dz-col');
  return { є: !!к, текст: к ? к.textContent.replace(/\s+/g, ' ').trim() : '',
           стовпчик: кол ? (кол.querySelector('.dz-col-h') || {}).textContent.replace(/\d+$/, '').trim() : '' };
});
console.log('  ' + дошка.стовпчик + ' · ' + дошка.текст);
ok(дошка.є, 'передане замовлення зʼявилось у дизайнера', 'картки в дизайнера немає');
ok(/Нові/.test(дошка.стовпчик),
  'і чекає в «Нових», поки він не скаже «беру»: передали — ще не взяли',
  'картка одразу в чужій колонці: ' + дошка.стовпчик);

console.log('\n═══ КЛІЄНТА НЕ ВИДНО НІДЕ ═══');
/* Дизайнеру вони не потрібні для роботи, а бачити їх означає мати доступ
   до чужого контакту без жодної причини — і рано чи пізно написати
   клієнту повз менеджера. */
const чужe = await p.evaluate(() => {
  const t = document.getElementById('dzRoot').textContent;
  return { імʼя:/Асія/.test(t), нік:/asia_dera/.test(t), телефон:/380670001122/.test(t),
           сума:/4 ?850/.test(t.replace(/ /g, ' ')),
           інстаграм: document.querySelectorAll('#dzRoot .dz-ig, #dzRoot .dz-card-ig').length,
           роль:/Графічний дизайнер/.test(t),
           перемикач: document.querySelectorAll('#dzRoot [data-seat]').length };
});
console.log('  ' + JSON.stringify(чужe));
ok(!чужe.імʼя && !чужe.нік && !чужe.телефон,
  'ні імені клієнта, ні ніка, ні телефону — дизайнер малює, а не листується',
  'клієнт видно дизайнеру: ' + JSON.stringify(чужe));
ok(!чужe.інстаграм,
  'і кнопки «Написати в Instagram» немає — писати клієнту не його робота',
  'кнопка розмови з клієнтом доступна дизайнеру');
ok(!чужe.сума,
  'суми замовлення теж немає: за скільки продали, дизайнера не стосується',
  'дизайнер бачить суму замовлення');
/* «Чому він тут бачить, що це є — графічний дизайнер він.» Підпис ролі
   повторював те, що людина про себе знає, і робив це кілька разів. */
ok(!чужe.роль && !чужe.перемикач,
  'і йому не пишуть, хто він: дошка в нього одна, зайти на чужу він не може',
  'підпис «Графічний дизайнер» і далі стоїть у нього на екрані: ' + JSON.stringify(чужe));

console.log('\n═══ СВІЙ ГОДИННИК, А НЕ ДАТА ЗАМОВЛЕННЯ ═══');
/* «До 14 жовтня» сьогодні не рухає нікого. «Лишилось 5 год» рухає. */
const строк = await p.evaluate(() => {
  const к = document.querySelector('.dz-card-w');
  /* Годинник етапу має свій клас: обіцянка клієнту й внутрішній строк —
     різні речі, і однаковими на вигляд вони читались як один. */
  const т = (к.querySelector('.dz-c-stk') || {}).textContent || '';
  return { напис: т.trim(), датаЗамовлення: /14\.10/.test(к.textContent) };
});
console.log('  ' + JSON.stringify(строк));
ok(/лишилось/.test(строк.напис),
  'на картці стоїть годинник: ' + строк.напис,
  'годинника на картці немає: ' + строк.напис);
/* Годин узято з налаштувань (8), а не з константи 24: доба — домовленість,
   а не закон природи. */
ok(/8 год/.test(строк.напис) || /7 год/.test(строк.напис),
  'і рахує з налаштувань — 8 годин, а не зашиті добу',
  'годинник не взяв число з налаштувань: ' + строк.напис);
ok(!строк.датаЗамовлення,
  'дата замовлення на картку дизайнера не лізе — вона обіцяна клієнту, не йому',
  'на картці дизайнера стоїть дата замовлення');

console.log('\n═══ КАРТИНКУ СКАЧУЮТЬ ІЗ САМОЇ МІНІАТЮРИ ═══');
await p.evaluate(() => { document.querySelector('[data-open]').click(); });
await p.waitForTimeout(600);
const кар = await p.evaluate(() => {
  const a = document.querySelector('.dz-panel .dz-pic-dl');
  /* Скачування зроблене ДІЄЮ, а не атрибутом `download`: він працює лише на
     своєму домені, а картинки лежать у Cloudinary — і посилання мовчки
     відкривало б їх у вкладці замість того, щоб зберегти. */
  return { є: !!a, скачує: !!(a && a.dataset && a.dataset.url),
           коментар: /Логотип менше/.test(document.querySelector('.dz-panel').textContent),
           мокап: !!document.querySelector('.dz-w-mock'),
           дата: /14\.10/.test(document.querySelector('.dz-panel').textContent) };
});
console.log('  ' + JSON.stringify(кар));
ok(кар.є && кар.скачує,
  'на мініатюрі є кнопка скачування — не «відкрити, правою кнопкою, зберегти як»',
  'скачати картинку з мініатюри не можна');
ok(кар.коментар,
  'коментар менеджера видно: це і є ТЗ',
  'коментаря в картці дизайнера немає');
/* А ФОТО ВИРОБУ ЗВІДСИ ПІШЛО, і це свідома зміна рішення.

   Спершу ми поклали його в ТЗ із кнопкою «скачати»: клієнту в Директ іде
   не сам макет, а макет НА ВИРОБІ, і знімок лежить у нас у каталозі.
   На практиці виявилось, що дизайнер його не качає й не обирає — мокап
   бере його сам, у тому кольорі, що стоїть у складі. Андрій: «фото
   виробу для мокапу не потрібно писати в ТЗшки». Блок пропонував дію,
   якої не роблять, і займав місце рівно між тим, що треба прочитати, і
   тим, що треба зробити. */
ok(!кар.мокап,
  'а фото виробу в ТЗ немає — мокап бере його сам, качати його нема потреби',
  'фото виробу знову лежить у ТЗ');
/* А от дата замовлення звідси ПІШЛА, і це свідома зміна рішення.

   Спершу ми лишили її тихим рядком: «здам завтра» звучить інакше, коли
   відправка сьогодні. На практиці вийшло навпаки — Андрій: «у адмінці
   самого дизайнера не потрібно писати замовлення обіцяно до такого-то
   числа, у них просто повинен бути строк, коли їм потрібно здати».

   Дві дати поруч не доповнюють одна одну, а сперечаються: чужа, дальня,
   щоразу читається як запас часу, якого немає. */
ok(!кар.дата,
  'а чужої дати в картці немає — у дизайнера свій годинник',
  'дата замовлення й далі стоїть у дизайнера');

console.log('\n═══ «БЕРУ» — І НІЯКОГО «НЕ БРАТИМУ» ═══');
const до = await p.evaluate(() => [...document.querySelectorAll('.dz-w .dz-b')]
  .map(b => b.textContent.trim()));
console.log('  ' + JSON.stringify(до));
/* Андрій: відмовитись дизайнер не може — забрати роботу може тільки
   акаунт-менеджер. */
ok(до.some(t => /Беру/.test(t)) && !до.some(t => /Не братиму/.test(t)),
  'одна відповідь на передачу — «Беру в роботу»; відмовитись дизайнер не може',
  'кнопки не ті: ' + JSON.stringify(до));
ok(!до.some(t => /надіслати/i.test(t)),
  'а здавати ще нема чого: роботу не починали',
  'здача показана до того, як роботу взяли');
await p.evaluate(() => { document.querySelector('[data-do="dz-take"]').click(); });
await p.waitForTimeout(800);
const взяв = await p.evaluate(() => ({
  стан: ((document.querySelector('.dz-panel-h .dz-state') || {}).textContent || '').trim(),
  кнопки: [...document.querySelectorAll('.dz-w .dz-b')].map(b => b.textContent.trim()),
  колонка: (() => { const c = document.querySelector('.dz-card-w');
    const k = c && c.closest('.dz-col');
    return k ? (k.querySelector('.dz-col-h') || {}).textContent.replace(/\d+$/, '').trim() : ''; })()
}));
console.log('  ' + JSON.stringify(взяв));
ok(/В роботі/.test(взяв.колонка),
  'натиснув «беру» — картка переїхала в «В роботі»',
  'після «беру» картка лишилась на місці: ' + взяв.колонка);
ok(взяв.кнопки.some(t => /Завантажити роботу/.test(t)) &&
   !взяв.кнопки.some(t => /Беру/.test(t)),
  'і зʼявилась здача — однією кнопкою',
  'здачі після «беру» немає: ' + JSON.stringify(взяв.кнопки));
/* КРОКІВ БІЛЬШЕ НЕМАЄ, і це свідома зміна рішення.

   Спершу здача йшла трьома кроками: макет → мокап → надіслати. Задум був
   правильний — показати весь шлях, щоб людина не натикалась на заборону
   в кінці. На ділі кроки описували не роботу, а порядок натискань, і саме
   тому бентежили. Андрій: «ці кроки мене смущають… його потрібно робити
   максимально просто».

   Тепер одна кнопка й одне вікно: у ньому і вантажать, і розкладають по
   сторонах, і віддають. Порядок дій дизайнер тримає в руках, а не читає
   з екрана. Докладно вікно перевіряє tests/mockup.mjs. */
const шлях = await p.evaluate(() => ({
  кроків: document.querySelectorAll('.dz-step').length,
  старі: document.querySelectorAll('[data-do="dz-art"],[data-do="dz-hand"]').length
}));
console.log('  ' + JSON.stringify(шлях));
ok(!шлях.кроків && !шлях.старі,
  'кроків і залишків старого шляху немає',
  'кроки здачі лишились: ' + JSON.stringify(шлях));

console.log('\n═══ ЗДАВ → V1 ═══');
/* Здачу робимо ядром: діалог вибору файлу в браузері не автоматизується, а
   перевірити треба саме наслідок — номер версії й переїзд картки. */
const здав = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobs['2000101'];
  const d = D.dzList(job.units[0], 'graphic')[0];
  D.dzVer(d, 'test@loomiq', [{ name:'макет.png', url:'https://x/1.png' },
                            { name:'мокап.png', url:'https://x/2.png' }], 'Готово');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  const c = document.querySelector('.dz-card-w');
  const k = c && c.closest('.dz-col');
  return { версій: d.vers.length, файлів: d.vers[0].files.length, стан: d.status,
           колонка: k ? (k.querySelector('.dz-col-h') || {}).textContent.replace(/\d+$/, '').trim() : '',
           напис: c ? c.textContent.replace(/\s+/g, ' ').trim() : '' };
});
console.log('  ' + JSON.stringify(здав));
ok(здав.версій === 1 && здав.стан === 'review',
  'здане стало версією 1 і пішло на перевірку',
  'здача не стала версією: ' + JSON.stringify(здав));
/* Макет і мокап — одна здача, а не дві версії: номер, який ми називаємо
   клієнту, не має рости вдвічі швидше за роботу. */
ok(здав.файлів === 2,
  'макет і мокап поїхали однією версією, а не двома',
  'файли розʼїхались по версіях: ' + здав.файлів);
ok(/На перевірці/.test(здав.колонка) && /v1/.test(здав.напис),
  'картка переїхала на перевірку й показує номер версії: ' + здав.напис,
  'картка не переїхала: ' + JSON.stringify(здав));

console.log('\n═══ ПРАВКА МЕНЕДЖЕРА → ЧЕРВОНИМ ═══');
/* Правка — найгучніше, що буває на цій дошці: робота вже зроблена, і її
   просять переробити. Побачити це наступного дня коштує дня. */
const правка = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobs['2000101'];
  const d = D.dzList(job.units[0], 'graphic')[0];
  D.dzSay(d, 'mgr@loomiq', 'Клієнт просить лого ще менше', null);
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  const c = document.querySelector('.dz-card-w');
  const k = c && c.closest('.dz-col');
  return { стан: d.status,
           колонка: k ? (k.querySelector('.dz-col-h') || {}).textContent.replace(/\d+$/, '').trim() : '',
           червона: c ? c.className : '',
           позначка: !!document.querySelector('.dz-m-fix'),
           /* Пропущене — кружечком у куті картки. */
           нових: ((document.querySelector('.dz-card-n') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(правка));
ok(/Правки/.test(правка.колонка),
  'правка повернула картку в «Правки»',
  'картка після правки лишилась на місці: ' + правка.колонка);
ok(/is-fix/.test(правка.червона) && правка.позначка,
  'і горить: за неї сідають першою',
  'правка нічим не позначена: ' + JSON.stringify(правка));
ok(/\d/.test(правка.нових),
  'непрочитане полічене: ' + правка.нових,
  'лічильника непрочитаного немає');
/* Годинник перезапустився: те, що прийшло після здачі, — нова робота, а не
   прострочена. Інакше дизайнер отримував би картку, вже червону від
   народження. */
const наново = await p.evaluate(() => {
  const c = document.querySelector('.dz-card-w .dz-c-stk');
  return (c ? c.textContent : '').trim();
});
console.log('  ' + наново);
ok(/лишилось/.test(наново) && !/прострочено/.test(наново),
  'і строк пішов наново: правка — це нова робота, а не прострочена стара',
  'після правки строк лишився старим: ' + наново);

console.log('\n═══ ВІДМОВИТИСЬ НЕ МОЖНА ═══');
/* Андрій: «відмовитись дизайнер не може, тільки може акаунт-менеджер в
   нього забрати замовлення». */
await p.evaluate(ЗАВЕСТИ);
await p.waitForTimeout(600);
await p.evaluate(() => { document.querySelector('[data-open]').click(); });
await p.waitForTimeout(500);
const відмова = await p.evaluate(() => ({
  кнопка: !!document.querySelector('[data-do="dz-no"]'),
  беру: !!document.querySelector('[data-do="dz-take"]') }));
console.log('  ' + JSON.stringify(відмова));
ok(!відмова.кнопка && відмова.беру,
  'у переданої роботи лише «Беру в роботу» — кнопки відмови немає',
  'кнопки: ' + JSON.stringify(відмова));

console.log('\n═══ СКАЧУВАННЯ СПРАВДІ СКАЧУЄ ═══');
/* ТИХА ПОЛОМКА, ЯКУ ЛЕГКО НЕ ПОМІТИТИ.

   Посилання з атрибутом `download` скачує ТІЛЬКИ СВІЙ ДОМЕН. Наші фото й
   макети лежать у Cloudinary, тобто на чужому, — і браузер атрибут мовчки
   ігнорує й просто відкриває картинку у вкладці. Ніякої помилки, ніякого
   повідомлення: людина тисне «Скачати», бачить картинку й не розуміє, чому
   файлу немає. Андрій: «тут справа є можливість качати, але вона чомусь не
   качається».

   Тому перевіряємо не вигляд кнопки, а механізм: жодне скачування в картці
   не має покладатись на `download` у посиланні. */
/* Заводимо картку наново: попередня перевірка закінчилась відмовою, і
   роботи в дизайнера більше немає — качати нічого. */
await p.evaluate(ЗАВЕСТИ);
await p.waitForTimeout(600);
await p.evaluate(() => { document.querySelector('[data-open]').click(); });
await p.waitForTimeout(500);
await p.evaluate(() => { document.querySelector('[data-do="dz-take"]').click(); });
await p.waitForTimeout(700);
const качання = await p.evaluate(() => {
  const кнопки = [...document.querySelectorAll('.dz-panel [data-do="dz-dl"]')];
  return {
    кнопок: кнопки.length,
    посилання: [...document.querySelectorAll('.dz-panel a[download]')].map(a => a.getAttribute('href')),
    адреси: кнопки.map(b => b.dataset.url).filter(Boolean).length
  };
});
console.log('  ' + JSON.stringify(качання));
/* Раніше кнопок було дві: референс і фото виробу. Фото виробу з ТЗ пішло
   (мокап бере його сам), тож лишилась одна — і цього досить, щоб довести
   головне: скачування зроблене ДІЄЮ, а не атрибутом `download`, який на
   чужому домені мовчки відкриває вкладку замість того, щоб зберегти. */
ok(качання.кнопок >= 1,
  'скачування зроблене дією, а не посиланням: кнопок ' + качання.кнопок,
  'кнопок скачування не знайдено');
ok(!качання.посилання.length,
  'і жодного `download` на посиланні — на чужому домені він не працює',
  'лишились посилання з download, і на Cloudinary вони мовчки не спрацюють: ' +
    JSON.stringify(качання.посилання));
ok(качання.адреси === качання.кнопок,
  'у кожної кнопки є адреса файлу',
  'є кнопки скачування без адреси');
/* І сама дія бере файл, а не покладається на браузер: перевіряємо на
   чужому домені, який у цьому наборі просто не відповідає, — кнопка мусить
   сказати це вголос, а не мовчати. */
const спроба = await p.evaluate(async () => {
  window.__SAID = [];
  const t = window.toast;
  window.toast = m => { window.__SAID.push(String(m)); try{ t(m); }catch(e){} };
  window.__OPEN = 0;
  window.open = () => { window.__OPEN++; return null; };
  const b = document.querySelector('.dz-panel [data-do="dz-dl"]');
  b.dataset.url = 'https://res.cloudinary.com/x/недосяжне.png';
  b.click();
  await new Promise(r => setTimeout(r, 1200));
  return { сказано: window.__SAID.join(' | '), відкрито: window.__OPEN };
});
console.log('  ' + JSON.stringify(спроба));
ok(/не віддався|Збережено/.test(спроба.сказано),
  'а коли файл не віддався — сказано словами, а не мовчазна порожнеча: ' +
    спроба.сказано,
  'кнопка мовчить, коли нічого не сталось: ' + спроба.сказано);

/* І головне: на файлі, який ВІДДАЄТЬСЯ, воно справді зберігає. Попередня
   перевірка показала лише, що ми не мовчимо на відмову; ця — що робота
   робиться. Ловимо саме збереження, підмінивши створення посилання. */
const збереглось = await p.evaluate(async () => {
  window.__DL = [];
  const був = document.createElement.bind(document);
  document.createElement = tag => {
    const el = був(tag);
    if(String(tag).toLowerCase() === 'a'){
      const клік = el.click.bind(el);
      el.click = () => { if(el.download) window.__DL.push({ name: el.download,
        blob: String(el.href).indexOf('blob:') === 0 }); клік(); };
    }
    return el;
  };
  const b = document.querySelector('.dz-panel [data-do="dz-dl"]');
  /* Однопіксельний PNG у самій адресі: він завжди доступний і не залежить
     ні від мережі, ні від чужого домену. */
  b.dataset.url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  b.dataset.name = 'референс';
  b.click();
  await new Promise(r => setTimeout(r, 900));
  document.createElement = був;
  return { збережено: window.__DL };
});
console.log('  ' + JSON.stringify(збереглось));
ok(збереглось.збережено.length === 1 && збереглось.збережено[0].blob,
  'а доступний файл справді зберігається — і саме файлом, а не адресою',
  'файл не зберігся: ' + JSON.stringify(збереглось));
/* Розширення дописується: без нього Windows не знає, чим відкривати, і
   файл лягає «без типу». */
ok(/\.png$/.test((збереглось.збережено[0] || {}).name || ''),
  'з розширенням за типом файлу: ' + (збереглось.збережено[0] || {}).name,
  'файл зберігся без розширення: ' + JSON.stringify(збереглось.збережено));

console.log('\n═══ КАРТКА РОЗДІЛЕНА: ЩО ПРИЙШЛО / ЩО ВІДПОВІДАЮ ═══');
/* Андрій: «повинна бути розділена тезешка — те, що в них прийшло, і потім
   уже зона, де ми надсилаємо файли». Доти це йшло одним потоком, і зона
   відповіді губилась між картинками: догортували до кінця й не бачили, що
   писати можна тут. */
await p.evaluate(ЗАВЕСТИ);
await p.waitForTimeout(600);
await p.evaluate(() => { document.querySelector('[data-open]').click(); });
await p.waitForTimeout(500);
await p.evaluate(() => { document.querySelector('[data-do="dz-take"]').click(); });
await p.waitForTimeout(800);
const половини = await p.evaluate(() => ({
  /* Три ЗОНИ, а не три підписи. Підпису з волосяною лінією виявилось мало:
     на картку дивились і поділу не бачили. Зони тут різні за суттю —
     перша тільки читається, друга тільки робиться, третя тільки
     говориться, — тож і виглядають як три окремі блоки зі своїм кольором,
     як у картці менеджера, де це працює. */
  підписи: [...document.querySelectorAll('.dz-w .dz-z-h b')].map(x => x.textContent.trim()),
  /* Геометрія, а не порядок у тексті: поле для листа має стояти нижче за
     блок здачі на екрані. */
  розмоваНижче: (() => {
    const s = document.querySelector('.dz-w-send'), t = document.querySelector('.dz-w-say');
    if(!s || !t) return false;
    return t.getBoundingClientRect().top > s.getBoundingClientRect().top;
  })(),
  чужаДата: /обіцяне клієнту|14\.10/.test(document.querySelector('.dz-panel').textContent),
  свійСтрок: /лишилось|прострочено/.test(document.querySelector('.dz-panel').textContent)
}));
console.log('  ' + JSON.stringify(половини));
/* ТРИ частини, а не дві: ТЗ · (здача) · розмова. Поле «написати
   менеджеру» переїхало вниз, до самої стрічки. Доти воно стояло рівно
   між ТЗ і завантаженням файлу: дизайнер відкривав картку, щоб віддати
   роботу, і першим натикався на порожнє поле для листа. Андрій: «щоб
   воно не відволікало від ТЗшки і від завантаження». */
ok(половини.підписи.join('|') === 'ТЗ|Здати роботу|Переписка',
  'три зони: ' + половини.підписи.join(' / '),
  'картку не розділено: ' + JSON.stringify(половини.підписи));
ok(половини.розмоваНижче,
  'і переписка стоїть НИЖЧЕ за здачу роботи, а не між ТЗ і нею',
  'поле для листа знову перехоплює дорогу до завантаження');
/* Дата, обіцяна клієнту, звідси пішла: у дизайнера свій годинник, і дві
   дати поруч не доповнюють одна одну, а сперечаються — чужа щоразу
   виглядає як запас часу, якого немає. */
ok(!половини.чужаДата && половини.свійСтрок,
  'чужої дати немає — лишився свій строк',
  'дата замовлення й далі стоїть у дизайнера: ' + JSON.stringify(половини));

console.log('\n═══ МОЖНА ПРОСТО НАПИСАТИ, БЕЗ МОКАПУ ═══');
/* Питання «логотип білий чи молочний?» — це не здача роботи. Доти єдина
   кнопка вимагала мокапу, і щоб спитати, дизайнер мусив або зробити мокап
   нізащо, або писати менеджеру в Телеграм — звідки відповідь не
   повертається в замовлення й губиться назавжди. */
const репліка = await p.evaluate(async () => {
  const D = window.LQDesign;
  const u = designJobs['2000101'].units[0];
  const d = D.dzList(u, 'graphic')[0];
  const булоСтан = d.status, було = d.thread.length;
  const ta = document.querySelector('[data-dzsay]');
  ta.value = 'Логотип білий чи молочний?';
  [...document.querySelectorAll('.dz-w-row .dz-b')]
    .filter(b => b.textContent.trim() === 'Надіслати')[0].click();
  await new Promise(r => setTimeout(r, 900));
  return { додано: d.thread.length - було,
           останнє: (d.thread[d.thread.length - 1] || {}).text || '',
           стан: d.status, булоСтан,
           поле: (document.querySelector('[data-dzsay]') || {}).value };
});
console.log('  ' + JSON.stringify(репліка));
ok(репліка.додано === 1 && /молочний/.test(репліка.останнє),
  'репліка пішла менеджеру без файлу й без мокапу',
  'просте повідомлення не надсилається: ' + JSON.stringify(репліка));
/* І стан НЕ міняється: своє слово — не повернення роботи. Саме на цьому
   воно й плуталось: питання дизайнера кидало дизайн у «правки», і в
   історії виходило, що роботу повернули. */
ok(репліка.стан === репліка.булоСтан,
  'і стан роботи від цього не змінився: питання — не повернення роботи',
  'репліка зрушила стан: ' + репліка.булоСтан + ' → ' + репліка.стан);
ok(!репліка.поле,
  'а поле очистилось — інакше наступна репліка піде з хвостом попередньої',
  'поле лишилось заповненим');

console.log('\n═══ ЗДАЧА ВИДНА В ПЕРЕПИСЦІ, А НЕ ОКРЕМИМ СПИСКОМ ═══');
/* Андрій: «історія тут не повинна була бути взагалі саме у дизайнера. Він
   щось написав — і в форматі переписки воно тут виглядало. Надіслали
   менеджеру — можна по праву сторону; коли тобі менеджер пише — по ліву».

   Доти про одну розмову було три різні списки: перелік версій, стрічка
   повідомлень і журнал подій. Щоб зрозуміти, на чому зупинились, їх
   доводилось складати в голові за часом. */
const віддано = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const job = designJobs['2000101'];
  const u = job.units[0];
  const d = D.dzList(u, 'graphic')[0];
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:'https://x/a.png' },
                            { name:'мокап.png', url:'https://x/m.png' }], 'готово');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 400));
  const бульб = [...document.querySelectorAll('.dz-panel .dz-ch-m')];
  const версія = document.querySelector('.dz-panel .dz-ch-m.is-ver');
  const здача = document.querySelector('.dz-panel .dz-w-send');
  return {
    бульбашок: бульб.length,
    версій: document.querySelectorAll('.dz-panel .dz-ch-vn').length,
    /* Дублікату немає: подія «Версія 1» і сама версія — один рядок. */
    дублів: бульб.filter(b => /^\s*\S+ · [\d.: ]+Версія 1\s*$/.test(
      b.textContent.replace(/\s+/g, ' '))).length,
    /* Свої репліки праворуч. Тут ми зайшли дизайнером, тож його — власні. */
    своїПраворуч: бульб.filter(b => b.classList.contains('own')).length,
    /* Переписка нижча за здачу: туди дивляться після натискання. */
    нижчеЗдачі: !!(версія && здача &&
      версія.getBoundingClientRect().top > здача.getBoundingClientRect().top),
    /* Скачування — просто на плитках картинок (⤓ у куті), без окремого рядка. */
    файлів: document.querySelectorAll('.dz-panel .dz-tile-a [data-do="dz-dl"]').length,
    рядокФайлів: document.querySelectorAll('.dz-panel .dz-ch-f').length
  };
});
console.log('  ' + JSON.stringify(віддано));
ok(віддано.версій >= 1 && !віддано.дублів,
  'здача лягла в переписку одним повідомленням, без дубля',
  'версія в переписці задвоїлась: ' + JSON.stringify(віддано));
ok(віддано.своїПраворуч >= 1,
  'свої репліки стоять праворуч — як у будь-якому месенджері',
  'усі повідомлення з одного боку: вчитуватись доведеться в підписи');
ok(віддано.нижчеЗдачі,
  'переписка під здачею — там, куди дивишся одразу після натискання',
  'переписка знову над кнопкою, яку щойно натиснули');
ok(віддано.файлів >= 2 && !віддано.рядокФайлів,
  'і файли версії качаються просто з плиток — окремого рядка скачувань немає',
  'скачування у версії не ті: ' + JSON.stringify(віддано));

console.log('\n═══ ЗДАЧА — ОДНА КНОПКА Й ОДНЕ ВІКНО ═══');
const здача = await p.evaluate(() => {
  const h = document.querySelector('.dz-w-send');
  return { є: !!h,
    кнопки: [...(h ? h.querySelectorAll('.dz-b') : [])].map(b => b.textContent.trim()),
    /* Вікно відкривається лише тоді, коли є на що класти роботу. Порожня
       кнопка, яка нічого не відкриє, гірша за чесне пояснення. */
    пояснення: (h ? (h.querySelector('.dz-miss') || {}).textContent || '' : '').trim() };
});
console.log('  ' + JSON.stringify(здача));
ok(здача.є && здача.кнопки.some(t => /Завантажити роботу/.test(t)),
  'здача стоїть окремим блоком з однією кнопкою',
  'блоку здачі немає: ' + JSON.stringify(здача));
ok(!здача.кнопки.some(t => /Здати/.test(t)),
  'і здати поки не можна: макета ще немає',
  'здача доступна з порожніми руками: ' + JSON.stringify(здача.кнопки));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nдизайнер бачить роботу й годинник — і нічого чужого');
process.exit(bad ? 1 : 0);
