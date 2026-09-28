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
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:мок }, { name:'мокап.png', url:мок }],
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

console.log('\n═══ У РЯДКУ ДИЗАЙНУ — ТІЛЬКИ ВИБІР ЛЮДИНИ ═══');
/* Доти тут стояло імʼя дизайнера, всередині той самий список із тим самим
   імʼям, поруч стан словом і стан кольором колонки. Чотири способи сказати
   одне; читати доводилось усі чотири, щоб переконатись, що вони збігаються. */
const рядок = await p.evaluate(() => {
  const t = document.querySelector('.dz-dz-t');
  return { списків: t.querySelectorAll('select').length,
           текст: t.textContent.replace(/\s+/g, ' ').trim(),
           лічильник: ((t.querySelector('.dz-dz-new') || {}).textContent || '').trim(),
           обрано: (t.querySelector('select') || {}).value || '' };
});
console.log('  ' + JSON.stringify(рядок));
ok(рядок.списків === 1 && рядок.обрано === 'art@loomiq',
  'вибір дизайнера і є весь рядок, і в ньому стоїть обраний',
  'вибору дизайнера в рядку немає: ' + JSON.stringify(рядок));
ok(!/у роботі|не передано|на перевірці/.test(рядок.текст),
  'стан словом звідси пішов — його вже каже колір колонки',
  'стан і далі дублюється словом: ' + рядок.текст);
/* Три: узяв у роботу, здав версію, поставив питання. Усе це зробив
   дизайнер, і все це менеджер ще не бачив. */
ok(рядок.лічильник === '3',
  'а праворуч — непрочитане, як пропущені: ' + рядок.лічильник,
  'лічильник непрочитаного не той: ' + рядок.лічильник);

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
ok(картка && картка.мокап && /Версія 1/.test(картка.версія),
  'видно саме те, що піде клієнту: мокап і номер версії',
  'картки на перевірку немає: ' + JSON.stringify(картка));
ok(/23,7 см/.test(картка.розміщення) && /горловини/.test(картка.розміщення),
  'і розміщення тут же: ' + картка.розміщення,
  'розміщення при картці немає: ' + картка.розміщення);
ok(картка.дії.some(t => /Надіслати клієнту/.test(t)) &&
   картка.дії.some(t => /Правка/.test(t)),
  'а дій рівно дві: погодити або повернути',
  'дій на картці не ті: ' + JSON.stringify(картка.дії));

console.log('\n═══ НАДСИЛАЄМО БЕЗ ВІДКРИВАННЯ РОЗМОВИ ═══');
/* Перевіряють макети пачкою: десять карток підряд. Кожне «відкрий розмову —
   встав картинку — напиши текст — повернись» це пів хвилини й шанс
   повернутись не туди. */
await p.evaluate(() => {
  [...document.querySelectorAll('.dz-chk .dz-b')]
    .filter(b => /Надіслати клієнту/.test(b.textContent))[0].click();
});
await p.waitForTimeout(900);
const пішло = await p.evaluate(() => ({
  надіслано: window.__SENT,
  відкрито: window.__OPENED,
  кнопка: ((document.querySelector('.dz-chk-sent') || {}).textContent || '').trim(),
  ще: [...document.querySelectorAll('.dz-chk .dz-b')]
        .some(b => /Надіслати клієнту/.test(b.textContent))
}));
console.log('  ' + JSON.stringify(пішло));
ok(пішло.надіслано.length === 1 && пішло.надіслано[0].url,
  'картинка пішла клієнту одним натиском',
  'нічого не надіслалось: ' + JSON.stringify(пішло.надіслано));
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
ok(пішло.кнопка && !пішло.ще,
  'кнопка згасла й каже, що надіслано: ' + пішло.кнопка,
  'кнопка лишилась активною — натиснуть удруге');

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
ok(підписи.length === 2 && підписи.every(Boolean),
  'і кожна підписана тим, що в ній: ' + підписи.join(' · '),
  'складені зони нічого про себе не кажуть');
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
ok(іст.рядки.some(t => /передано/.test(t)) && іст.рядки.some(t => /взяв у роботу/.test(t)) &&
   іст.рядки.some(t => /здано/.test(t)),
  'і показує шлях роботи: передано → взяв → здав',
  'подій у історії бракує: ' + JSON.stringify(іст.рядки));
/* ГОЛОВНЕ. Питання дизайнера в розмові має ту саму позначку, що й правка
   менеджера. Якби історія рахувала його поверненням роботи, у ній стояли б
   правки, яких не було, — і за цим числом судили б про дизайнера. */
ok(!іст.рядки.some(t => /молочний|білий чи/.test(t)),
  'а реплік із розмови в ній немає — це не другий чат',
  'у історію потрапило листування: ' + JSON.stringify(іст.рядки));
const скількиПравок = іст.рядки.filter(t => /повернуто на правку/.test(t)).length;
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

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nменеджер перевіряє картку й шле її одним натиском');
process.exit(bad ? 1 : 0);
