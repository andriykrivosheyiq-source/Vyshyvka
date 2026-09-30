/* ВІДКРИТА ОДНА ПОЛОВИНА, ДРУГА — СМУЖКОЮ.

   Андрій:

     «Можна зробити, знаєш, як в Телеграмі, в компʼютерній версії… коли ми
      одобрюємо графічний дизайн, у нас скривається зона вишивального
      дизайну. Її можна відкрити і передивитися — графічний, вишивальний,
      як ми хочемо… Як тільки ми узгодили ескіз, відкривається вже зона
      більша, таким чином ми економимо місце в цій карточці і більш
      зрозуміло становиться. Якщо ми захочемо, ми можемо відкрити ту зону,
      передивитися, як там було. Якщо ні, то дивимося ту зону, з якою
      працюємо. Щоб там було видно якісь іконочки маленькі.»

   Доти обидві колонки стояли поруч по півширини незалежно від того, у якій
   іде робота: до погодження половину екрана займала порожня вишивка з
   написом «чекає», після погодження — готова графіка. А картці на
   перевірку півширини мало.

   Перевіряємо:

     1. до погодження відкрита графіка, вишивка — смужкою;
     2. смужка нічого не ховає: іконка, колір стану, лічильник;
     3. натиснув смужку — половини помінялись місцями;
     4. погодили ескіз — вишивка відкривається сама;
     5. відкрита половина справді ширша, а не просто інакше названа;
     6. дизайнеру, якому показують одну половину, смужки немає.

   Запуск:  node tests/dz-side.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8932;
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
         { email:'art@loomiq',  name:'Оля',       role:'designer' }]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z', crmNick:'asia_dera', items:[] }
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
    color:'Чорний', size:'M', qty:3 })];
  const d = D.dzNew();
  D.dzAttach(d, 'art@loomiq', 'test@loomiq');
  D.dzSend(d, 'test@loomiq');
  D.dzTake(d, 'art@loomiq');
  D.dzVer(d, 'art@loomiq', [{ name:'макет.png', url:мок }, { name:'мокап.png', url:мок },
    { name:'аркуш-v1.png', url:мок }], 'Зробила як просили',
    { wCm:23.7, hCm:9.5, topCm:14.9, sideCm:0, size:'M' });
  D.dzSay(d, 'art@loomiq', 'Логотип білий чи молочний?', null);
  D.dzList(job.units[0], 'graphic').push(d);
  window.__U = job.units[0]; window.__D = d;
  U.DZ_OPEN[job.units[0].id + '|graphic|0'] = 1;
  openDesign();
  U.setTab('acct'); U.open('2000101');
  U.render(document.getElementById('dzRoot'));
}, МОК);
await p.waitForTimeout(800);

/* Одна мірка на весь тест: що відкрито, що смужкою і якої вони ширини. */
const стан = () => p.evaluate(() => {
  const dz = document.querySelector('.dz-u-dz');
  const rail = document.querySelector('.dz-u-rail');
  const col = document.querySelector('.dz-u-col');
  return {
    клас: dz ? dz.className : '',
    смужок: document.querySelectorAll('.dz-u-rail').length,
    колонок: document.querySelectorAll('.dz-u-col').length,
    смужка: rail ? rail.textContent.replace(/\s+/g, ' ').trim() : '',
    смужкаБік: rail ? rail.dataset.side : '',
    станСмужки: rail ? rail.className.replace('dz-u-rail', '').trim() : '',
    лічильник: ((document.querySelector('.dz-u-rail-n') || {}).textContent || '').trim(),
    шСмужки: rail ? Math.round(rail.getBoundingClientRect().width) : 0,
    шКолонки: col ? Math.round(col.getBoundingClientRect().width) : 0,
    відкрито: ((document.querySelector('.dz-u-col .dz-u-l') || {}).textContent || '')
      .replace(/\s+/g, ' ').trim()
  };
});

console.log('\n═══ ДО ПОГОДЖЕННЯ ВІДКРИТА ГРАФІКА ═══');
/* Поки ескіз не погоджений, робота йде в графіці — і саме їй місце. */
const до = await стан();
console.log('  ' + JSON.stringify(до));
ok(/is-g/.test(до.клас) && до.колонок === 1 && до.смужок === 1,
  'відкрита одна половина, друга — смужкою',
  'половини стоять не так: ' + до.клас + ', колонок ' + до.колонок);
ok(/ГРАФІЧНИЙ/i.test(до.відкрито),
  'і відкрита саме графіка — у ній зараз робота: ' + до.відкрито,
  'відкрилась не та половина: ' + до.відкрито);
ok(до.смужкаБік === 'stitch' && /Вишивка/i.test(до.смужка),
  'а вишивка згорнута у смужку з підписом: ' + до.смужка,
  'смужка не про вишивку: ' + JSON.stringify([до.смужкаБік, до.смужка]));
ok(до.шКолонки > до.шСмужки * 4,
  'відкрита половина справді ширша, а не просто інакше названа: ' +
    до.шКолонки + ' проти ' + до.шСмужки + ' px',
  'ширини однакові: ' + до.шКолонки + ' / ' + до.шСмужки);

console.log('\n═══ СМУЖКА НІЧОГО НЕ ХОВАЄ ═══');
/* Половина, у яку повідомлення падають безслідно, гірша за дві тісні
   колонки: про неї просто забувають. */
const світло = await p.evaluate(() => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  /* Вишивку передали — смужка має загорітись бурштиновим, а непрочитане
     дизайнерове слово — стати числом на ній. */
  const s = D.dzNew();
  D.dzAttach(s, 'art@loomiq', 'test@loomiq');
  D.dzSend(s, 'test@loomiq');
  D.dzSay(s, 'art@loomiq', 'Оцифрую до вечора', null);
  D.dzList(window.__U, 'stitch').push(s);
  U.render(document.getElementById('dzRoot'));
  const r = document.querySelector('.dz-u-rail');
  return { клас: r ? r.className : '', іконка: !!document.querySelector('.dz-u-rail-i'),
           лічильник: ((document.querySelector('.dz-u-rail-n') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(світло));
ok(/is-sent/.test(світло.клас),
  'згорнута половина світиться станом — видно, що передали',
  'смужка не показує стану: ' + світло.клас);
ok(світло.іконка, 'на ній є іконка, як і просили', 'іконки на смужці немає');
ok(світло.лічильник === '1',
  'і лічильник непрочитаного: ' + світло.лічильник,
  'непрочитане в згорнутій половині зникло: ' + світло.лічильник);

console.log('\n═══ НАТИСНУВ — ПОЛОВИНИ ПОМІНЯЛИСЬ ═══');
await p.evaluate(() => document.querySelector('.dz-u-rail').click());
await p.waitForTimeout(400);
const після = await стан();
console.log('  ' + JSON.stringify(після));
ok(/is-s/.test(після.клас) && /ВИШИВАЛЬНИЙ/i.test(після.відкрито),
  'відкрилась вишивка: ' + після.відкрито,
  'натиск нічого не змінив: ' + після.клас + ' / ' + після.відкрито);
ok(після.смужкаБік === 'graphic',
  'а графіка згорнулась — дивимось на одну половину за раз',
  'згорнулась не та: ' + після.смужкаБік);

console.log('\n═══ ПОГОДИЛИ ЕСКІЗ — ВИШИВКА ВІДКРИВАЄТЬСЯ САМА ═══');
/* Вибір руками діє до кінця сеансу, але сам собою розподіл іде за
   роботою: погодження ескіза — рівно та мить, коли вона переходить. */
const сама = await p.evaluate(() => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  delete U.SIDE[window.__U.id];              // забули ручний вибір
  const доПогодження = U.sideOf(window.__U);
  D.dzOk(window.__D, 'test@loomiq', 'client', 1);
  U.render(document.getElementById('dzRoot'));
  return { доПогодження, після: U.sideOf(window.__U),
    клас: (document.querySelector('.dz-u-dz') || {}).className || '' };
});
console.log('  ' + JSON.stringify(сама));
ok(сама.доПогодження === 'graphic',
  'до погодження сама відкривається графіка',
  'до погодження відкрилась ' + сама.доПогодження);
ok(сама.після === 'stitch' && /is-s/.test(сама.клас),
  'а після «✓ Погоджено» — вишивка: робота перейшла туди, і місце за нею',
  'після погодження лишилась ' + сама.після);

console.log('\n═══ ПОЗИЦІЯ РОЗДІЛЕНА НА ДВІ НАЗВАНІ ЧАСТИНИ ═══');
/* Андрій: «по факту, яке замовлення, і потім вже починається графічний
   дизайн, щоб воно легше сприймалося… бо поки якось воно важко
   сприймається». Доти позиція текла одним потоком, і межу між замовленням
   і роботою над ним око не знаходило. */
const частини = await p.evaluate(() => {
  const cap = [...document.querySelectorAll('.dz-u-cap span')].map(x => x.textContent.trim());
  const spec = document.querySelector('.dz-u-spec');
  const dz = document.querySelector('.dz-u-dz');
  return { cap,
    /* Поля, коментар і референси — у першій частині; колонки дизайну — поза
       нею. Перевіряємо саме вкладеність, а не порядок у тексті. */
    поляВСпеці: !!(spec && spec.querySelector('.dz-u-f, .dz-u-ro')),
    картинкиВСпеці: !!(spec && spec.querySelector('.dz-u-pics')),
    дизайнПоза: !!(spec && dz && !spec.contains(dz)),
    /* Пунктирна риска зникла: її роботу робить підпис із лінією, і дві
       межі поспіль читались би як дві різні. */
    пунктир: dz ? getComputedStyle(dz).borderTopStyle : '' };
});
console.log('  ' + JSON.stringify(частини));
ok(частини.cap.length === 2 && /Що шиємо/i.test(частини.cap[0]) && /Дизайн/i.test(частини.cap[1]),
  'дві названі частини: ' + частини.cap.join(' · '),
  'підписів не два: ' + JSON.stringify(частини.cap));
ok(частини.поляВСпеці && частини.картинкиВСпеці && частини.дизайнПоза,
  'виріб, коментар і референси — у «що шиємо», дизайн — окремо',
  'частини поділені не так: ' + JSON.stringify(частини));
ok(частини.пунктир === 'none',
  'а стара пунктирна риска зникла — дві межі поспіль читались би як дві різні',
  'риска лишилась разом із підписом: ' + частини.пунктир);

console.log('\n═══ НА ПЛИТЦІ ДОШКИ — СКІЛЬКИ ЛИШИЛОСЬ ═══');
/* «До 08.10» треба віднімати від сьогодні, і робить це кожен, хто дивиться
   на дошку. Двадцять плиток — двадцять віднімань подумки. */
const плитка = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const job = designJobs['2000101'];
  job.due = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);
  U.setTab('queue');
  U.render(document.getElementById('dzRoot'));
  const e = document.querySelector('.dz-card-due');
  return { текст: e ? e.textContent.trim() : '',
           підказка: e ? (e.getAttribute('title') || '') : '' };
});
console.log('  ' + JSON.stringify(плитка));
ok(/лишилось 4 дні/.test(плитка.текст),
  'на плитці стоїть лишок, а не число календаря: ' + плитка.текст,
  'на плитці й далі дата: ' + плитка.текст);
ok(/Здати до/.test(плитка.підказка),
  'а сама дата лишилась підказкою — вона потрібна рідше, ніж лишок',
  'дата зникла зовсім: ' + плитка.підказка);

console.log('\n═══ ДИЗАЙНЕРУ СМУЖКИ НЕМАЄ ═══');
/* Йому показують саме його половину, і пропонувати «розгорнути сусідню» —
   це пропонувати те, чого він не побачить. */
const дизайнер = await p.evaluate(() => {
  const U = window.LQDesign.ui;
  const job = designJobs['2000101'];
  const html = U.unitsHtml(job, { ro:true, only:'graphic' });
  return { смужка: /dz-u-rail/.test(html), одна: /dz-u-dz one/.test(html),
           вишивка: /ВИШИВАЛЬНИЙ/i.test(html) };
});
console.log('  ' + JSON.stringify(дизайнер));
ok(!дизайнер.смужка && дизайнер.одна,
  'дизайнеру — одна половина на всю ширину, без смужки',
  'дизайнеру підсунули смужку: ' + JSON.stringify(дизайнер));
ok(!дизайнер.вишивка,
  'і чужої половини він не бачить узагалі',
  'графічному дизайнеру видно вишивальну половину');

console.log('\n═══ ШАПКА ВІДДІЛУ Й ПОШУК ═══');
/* Андрій: «додати нове замовлення присунути вліво… дивлюсь як
   акаунт-менеджер — правий верх, оце ж тільки для мене. І ще пошук додати,
   щоб можна було шукати по номеру чи по контакту, чи ще по імені». */
const шапка = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  U.setTab('acct'); U.open('');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 400));
  const діти = [...document.querySelectorAll('.dz-top > *')];
  const л = діти.map(x => x.className);
  const нове = document.querySelector('.dz-new');
  const роль = document.querySelector('.dz-as');
  return { порядок: л,
    /* Геометрія, а не порядок у розмітці: «нове замовлення» має стояти
       ЛІВІШЕ за перемикач ролі. */
    новеЛівіше: !!(нове && роль &&
      нове.getBoundingClientRect().left < роль.getBoundingClientRect().left),
    пошук: !!document.querySelector('[data-seek]'),
    карток: document.querySelectorAll('.dz-card').length };
});
console.log('  ' + JSON.stringify(шапка));
ok(шапка.новеЛівіше,
  '«+ Нове замовлення» ліворуч, «Дивлюсь як» праворуч',
  'порядок у шапці не той: ' + JSON.stringify(шапка.порядок));
ok(шапка.пошук, 'і пошук на місці', 'пошуку в шапці немає');

const знайшов = await p.evaluate(async () => {
  const крок = async v => {
    const i = document.querySelector('[data-seek]');
    i.value = v; i.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 300));
    return { карток: document.querySelectorAll('.dz-card').length,
             фокус: document.activeElement === document.querySelector('[data-seek]') };
  };
  const пусто = await крок('замовлення-якого-немає');
  const заНомером = await крок('2000101');
  const заНіком = await крок('asia');
  /* Хрестик прибирає фільтр — інакше вийти з нього можна лише стиранням
     руками, а забутий фільтр виглядає як порожня дошка. */
  document.querySelector('[data-do="seek-off"]').click();
  await new Promise(r => setTimeout(r, 300));
  return { пусто, заНомером, заНіком,
           після: document.querySelectorAll('.dz-card').length };
});
console.log('  ' + JSON.stringify(знайшов));
ok(!знайшов.пусто.карток && знайшов.заНомером.карток === 1,
  'пошук по номеру знаходить саме її, а чуже ховає',
  'пошук по номеру не спрацював: ' + JSON.stringify(знайшов));
ok(знайшов.заНіком.карток === 1,
  'і по ніку клієнта теж — за ним її й називають у розмові',
  'по ніку не знайшлось: ' + JSON.stringify(знайшов.заНіком));
ok(знайшов.заНомером.фокус,
  'а курсор лишається в полі: дошка перемальовується, друкувати можна далі',
  'фокус злітає з поля, і друга літера йде в порожнечу');
ok(знайшов.після === 1,
  'хрестик повертає всі картки',
  'фільтр не скидається: карток ' + знайшов.після);

console.log('\n═══ ГОДИННИК СТОЇТЬ У ВИХІДНІ ДИЗАЙНЕРА ═══');
/* Строк у добу, виданий у пʼятницю ввечері, у понеділок уранці вже
   прострочений — хоча ніхто нічого не порушив. Годинник, який кричить на
   того, хто ні в чому не винен, перестають читати взагалі. */
const годинник = await p.evaluate(() => {
  const D = window.LQDesign;
  /* Пʼятниця 02.10.2026, 17:00. Субота й неділя — вихідні. */
  const пт = new Date(2026, 9, 2, 17, 0, 0).getTime();
  const вих = { '2026-10-03':1, '2026-10-04':1 };
  const було = D.addWorkHours(пт, 24, 'art@loomiq');
  D.setDayOff((who, iso) => who === 'art@loomiq' && !!вих[iso]);
  const стало = D.addWorkHours(пт, 24, 'art@loomiq');
  const чужий = D.addWorkHours(пт, 24, 'inshyi@loomiq');
  /* Робочий час між пʼятницею 17:00 і понеділком 17:00 — рівно доба. */
  const між = D.workMs(пт, new Date(2026, 9, 5, 17, 0, 0).getTime(), 'art@loomiq');
  D.setDayOff(null);
  const iso = t => new Date(t).toISOString().slice(0, 16);
  return { без: iso(було), з: iso(стало), чужий: iso(чужий),
           годин: Math.round(між / 3600000) };
});
console.log('  ' + JSON.stringify(годинник));
ok(/2026-10-03/.test(годинник.без),
  'без графіка доба від пʼятниці 17:00 кінчається в суботу — як і доти',
  'базовий рахунок змінився: ' + годинник.без);
ok(/2026-10-05/.test(годинник.з),
  'а з двома вихідними — у понеділок 17:00: ' + годинник.з,
  'вихідні не пропустились: ' + годинник.з);
ok(/2026-10-03/.test(годинник.чужий),
  'і тільки в того, чий це графік — у сусіда строк свій',
  'чужий графік поїхав на іншу людину: ' + годинник.чужий);
ok(годинник.годин === 24,
  'робочого часу між пʼятницею 17:00 і понеділком 17:00 — рівно доба',
  'робочий час порахувався не так: ' + годинник.годин + ' год');

console.log('\n═══ ГРАФІК ВІДКРИВАЄТЬСЯ Й ПЕРЕМИКАЄ ДЕНЬ ═══');
const графік = await p.evaluate(async () => {
  const U = window.LQDesign.ui;
  const сховище = {};
  /* Робоче місце відповідає на два питання: чи день вихідний і як його
     перемкнути. Відділ про команду не знає нічого й знати не мусить. */
  U.host.dayOff = (who, iso) => !!сховище[who + '|' + iso];
  U.host.shiftSet = (who, iso, off) => { сховище[who + '|' + iso] = off; };
  U.host.designers = () => [{ email:'art@loomiq', name:'Оля' }];
  /* Кнопка графіка є ТІЛЬКИ на дизайнерських дошках. На дошці акаунта її
     немає й бути не повинно: строки акаунта, закупівлі й виробництва
     вихідних не мають, і графік там нічого не міняє. */
  const наАкаунті = !document.querySelector('[data-do="shift"]');
  U.setTab('graphic');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('[data-do="shift"]').click();
  await new Promise(r => setTimeout(r, 300));
  const днів = document.querySelectorAll('.dz-sh-d').length;
  const перший = document.querySelector('.dz-sh-d');
  const iso = перший.dataset.shD;
  перший.click();
  await new Promise(r => setTimeout(r, 300));
  const став = document.querySelector('[data-sh-d="' + iso + '"]');
  return { днів, iso, наАкаунті,
           /* Вікно має бути справжньою накладкою: без класу `dz-pick` воно
              ставало звичайним блоком у кінці сторінки — відкривалось, але
              побачити його можна було лише догорнувши донизу. Зовні це
              виглядало як «кнопка не натискається». */
           накладка: !!document.querySelector('.dz-pick .dz-sh-w'),
           вихідний: !!(став && став.classList.contains('off')),
           уСховищі: !!сховище['art@loomiq|' + iso] };
});
console.log('  ' + JSON.stringify(графік));
ok(графік.днів >= 28 && графік.днів <= 31,
  'графік відкрився сіткою місяця: днів ' + графік.днів,
  'сітки місяця немає: ' + графік.днів);
ok(графік.вихідний && графік.уСховищі,
  'натиск робить день вихідним, і це лягає в робоче місце',
  'день не перемкнувся: ' + JSON.stringify(графік));
ok(графік.наАкаунті,
  'а на дошці акаунт-менеджера кнопки графіка немає — там вихідних не буває',
  'графік виліз на чужу дошку');
ok(графік.накладка,
  'вікно графіка — справжня накладка поверх екрана, а не блок унизу сторінки',
  'вікно відкривається туди, де його не видно');

console.log('\n═══ СТРОК Є В КОЖНОГО ЕТАПУ ═══');
/* Доти годинник був один — у дизайнера. Решта ланцюга жила без строку, і
   замовлення могло лежати в закупника тиждень непоміченим. */
const етапи = await p.evaluate(() => {
  const D = window.LQDesign;
  const год = t => Math.round(t / 60);
  const тому = h => new Date(Date.now() - h * 3600000).toISOString();
  /* Акаунт: рахується від приходу замовлення. */
  const acct = D.stageLeft({ createdAt: тому(12) }, { tracks:{} }, 'acct', 48);
  /* І зупиняється, щойно пакет пішов у виробництво: далі це не його час. */
  const acctГотово = D.stageLeft({ createdAt: тому(12), pack:{ at: тому(1) } },
                                 { tracks:{} }, 'acct', 48);
  /* Закупівля: від першого руху свого треку, а не від заведення картки. */
  const supply = D.stageLeft({}, { tracks:{ supply:'sent' },
    trackHist:[{ t:'prod', s:'work', at: тому(50) }, { t:'supply', s:'sent', at: тому(10) }] },
    'supply', 48);
  /* Виробництво: від зібраного пакета. */
  const prod = D.stageLeft({ pack:{ at: тому(80) } }, { tracks:{} }, 'prod', 72);
  /* Немає мітки — немає годинника: рахувати невідомо від чого гірше, ніж
     не рахувати. */
  const безМітки = D.stageLeft({}, { tracks:{} }, 'supply', 48);
  const безСтроку = D.stageLeft({ createdAt: тому(12) }, { tracks:{} }, 'acct', 0);
  return { acct: год(acct), acctГотово, supply: год(supply), prod: год(prod),
           безМітки, безСтроку };
});
console.log('  ' + JSON.stringify(етапи));
ok(етапи.acct === 36,
  'акаунт: 48 год строку, 12 минуло — лишилось 36',
  'строк акаунта порахувався не так: ' + етапи.acct);
ok(етапи.acctГотово === null,
  'а щойно пакет пішов у виробництво — годинник акаунта зник: це вже не його час',
  'годинник акаунта тікає й після передачі');
ok(етапи.supply === 38,
  'закупівля рахується від свого треку, а не від чужого: лишилось 38',
  'строк закупівлі взяв не ту мітку: ' + етапи.supply);
ok(етапи.prod === -8,
  'виробництво від пакета: 72 год строку, 80 минуло — прострочено на 8',
  'строк виробництва порахувався не так: ' + етапи.prod);
ok(етапи.безМітки === null && етапи.безСтроку === null,
  'без мітки початку або без строку годинника немає зовсім',
  'годинник рахує невідомо від чого: ' + JSON.stringify(етапи));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ не зійшлось: ' + bad : '\nвідкрита одна половина, друга смужкою');
process.exit(bad ? 1 : 0);
