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
/* «Не братиму» питає причину: без неї менеджер лишається з тим самим
   питанням «а кому тепер». */
p.on('dialog', d => d.accept('зайнятий іншим замовленням'));
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
  const т = (к.querySelector('.dz-card-due') || {}).textContent || '';
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
  return { є: !!a, скачує: a ? a.hasAttribute('download') : false,
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
/* Фото виробу — основа мокапу: клієнту в Директ іде не сам макет, а макет
   НА ВИРОБІ, і знімок цього виробу лежить у нас у каталозі. */
ok(кар.мокап,
  'і фото виробу для мокапу поруч, у тому кольорі, що у складі',
  'фото виробу для мокапу в картці немає');
/* А от дату замовлення в ПАНЕЛІ показуємо: «здам завтра» звучить інакше,
   коли відправка сьогодні. На картці дошки її немає, у картці — є. */
ok(кар.дата,
  'у самій картці видно, до якого числа замовлення обіцяне клієнту',
  'дати замовлення немає й у картці');

console.log('\n═══ «БЕРУ» І «НЕ БРАТИМУ» ═══');
const до = await p.evaluate(() => [...document.querySelectorAll('.dz-w .dz-b')]
  .map(b => b.textContent.trim()));
console.log('  ' + JSON.stringify(до));
ok(до.some(t => /Беру/.test(t)) && до.some(t => /Не братиму/.test(t)),
  'обидві відповіді на передачу поруч і однаково доступні',
  'кнопок «беру» / «не братиму» немає: ' + JSON.stringify(до));
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
ok(взяв.кнопки.some(t => /надіслати/i.test(t)) && !взяв.кнопки.some(t => /Беру/.test(t)),
  'і зʼявилась здача: файл із коментарем однією дією',
  'здачі після «беру» немає: ' + JSON.stringify(взяв.кнопки));
/* Одна дія, а не дві. Доти «Додати файл» і «Віддати на перевірку» були
   різними кнопками, і половина макетів висіла прикріпленою, але не зданою:
   дизайнер вважав, що віддав, менеджер не бачив нічого. */
ok(взяв.кнопки.filter(t => /файл/i.test(t)).length === 1,
  'здача одна, а не «додати файл» окремо й «віддати» окремо',
  'кнопок про файли кілька: ' + JSON.stringify(взяв.кнопки));

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
           нових: ((document.querySelector('.dz-m-new') || {}).textContent || '').trim() };
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
  const c = document.querySelector('.dz-card-w .dz-card-due');
  return (c ? c.textContent : '').trim();
});
console.log('  ' + наново);
ok(/лишилось/.test(наново) && !/прострочено/.test(наново),
  'і строк пішов наново: правка — це нова робота, а не прострочена стара',
  'після правки строк лишився старим: ' + наново);

console.log('\n═══ «НЕ БРАТИМУ» ПОВЕРТАЄ РОБОТУ ═══');
/* Завантажений або хворий дизайнер мусить повернути роботу ЗАРАЗ, а не за
   добу, коли строк уже вийшов і ніхто нічого не малював. */
await p.evaluate(ЗАВЕСТИ);
await p.waitForTimeout(600);
await p.evaluate(() => { document.querySelector('[data-open]').click(); });
await p.waitForTimeout(500);
await p.evaluate(() => { document.querySelector('[data-do="dz-no"]').click(); });
await p.waitForTimeout(900);
const відмова = await p.evaluate(() => {
  const d = window.LQDesign.dzList(designJobs['2000101'].units[0], 'graphic')[0];
  return { хто: d.who, передано: d.sentAt, стан: d.status,
           причина: (d.thread.filter(m => m.kind === 'no')[0] || {}).text || '',
           карток: document.querySelectorAll('.dz-card-w').length };
});
console.log('  ' + JSON.stringify(відмова));
ok(!відмова.хто && !відмова.передано && відмова.стан === 'new',
  'дизайнера знято, передачу скасовано — рядок знову порожній у менеджера',
  'після відмови рядок лишився переданим: ' + JSON.stringify(відмова));
ok(/зайнятий/.test(відмова.причина),
  'причина записана в розмову: ' + відмова.причина,
  'причини відмови ніде немає');
ok(!відмова.карток,
  'і з дошки дизайнера картка зникла — робота не його',
  'картка лишилась у дизайнера після відмови');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nдизайнер бачить роботу й годинник — і нічого чужого');
process.exit(bad ? 1 : 0);
