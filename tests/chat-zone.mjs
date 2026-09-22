/* Переписка — зона робочого місця, а не попап поверх усього.

   ЯК БУЛО. Розмова відкривалась модальним вікном: затемнення на весь екран,
   вікно по центру. Поки воно відкрите, не видно ні дошки, ні картки — а саме
   в картці лежить те, про що йдеться в розмові. Щоб звірити суму чи склад
   замовлення, доводилось закрити розмову, подивитись і відкрити знову.

   ЯК СТАЛО. Три зони одночасно: меню ліворуч, переписка посередині, картка
   праворуч. Дошку на цей час ховаємо — у просвіті між меню й карткою колонки
   все одно не читаються. Закривається зона хрестиком у своєму правому
   верхньому куті, на межі з карткою.

   Перевіряємо:
     — зона стоїть МІЖ меню й карткою й не налазить на жодне з них;
     — картка лишається видимою й робочою — заради цього все й робилось;
     — дошка схована, а після закриття розмови повертається;
     — хрестик стоїть угорі праворуч зони;
     — закрили розмову — картка лишилась; закрили картку — розмова закрилась;
     — розмова з дошки (картки немає) займає всю ширину;
     — на телефоні зон немає: розмова на весь екран, як і була.

   Запуск:  node tests/chat-zone.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8846;
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

const CONTENT = { quickReplies:[
  { t:'КП готове', m:'Вітаю! Ось пропозиція: {кп}' },
  { t:'Надсилаю прорахунок', m:'Ось прорахунок 👌\n{картки}' }
] };
const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Оксана', phone:'+380670001001',
  status:'kp', site:'main', offerToken:'tok123456', payments:[],
  tgChatId:'4242', tgWrote:true, tgLast:'Вітаю', tgAt:new Date().toISOString(),
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000, unitCost:350, cost:7000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
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

/* Геометрія зон очима, а не за класами: класи можна перейменувати, а от
   «переписка налізла на картку» видно тільки в координатах. */
const zones = () => p.evaluate(() => {
  const box = el => { if(!el) return null; const r = el.getBoundingClientRect();
    return { l:Math.round(r.left), r:Math.round(r.right), t:Math.round(r.top),
             w:Math.round(r.width), h:Math.round(r.height) }; };
  const cw = document.querySelector('.cw-wrap.open');
  const mainEl = document.querySelector('main');
  const panel = document.querySelector('#orderDrawer.open .od-panel');
  const x = cw && cw.querySelector('.cw-x');
  return {
    chat: box(cw),
    nav: box(document.querySelector('.sidebar')),
    card: box(panel),
    x: box(x),
    boardOn: !!(mainEl && mainEl.offsetParent !== null),
    drawerOn: !!document.querySelector('#orderDrawer.open')
  };
});

console.log('═══ ТРИ ЗОНИ ОДНОЧАСНО ═══');
await p.evaluate(async () => {
  await openOrderDrawer(orders[0]);
  chatOpen(orders[0], 'tg');
});
await p.waitForTimeout(900);
const z = await zones();
if(!z.chat){ console.log('  зони переписки немає'); bad++; }
else {
  console.log('  меню 0–' + z.nav.r + ' · переписка ' + z.chat.l + '–' + z.chat.r +
              ' · картка ' + z.card.l + '–' + z.card.r);
  ok(z.chat.l >= z.nav.r,
    'переписка починається праворуч від меню, а не поверх нього',
    'переписка налізла на меню: ' + z.chat.l + ' < ' + z.nav.r);
  ok(z.card && z.chat.r <= z.card.l,
    'і закінчується ліворуч від картки — зони не перекриваються',
    'переписка налізла на картку: ' + z.chat.r + ' > ' + (z.card || {}).l);
  ok(z.chat.w > 300,
    'на зону лишилось достатньо ширини, щоб читати розмову',
    'зона вийшла вузькою смугою: ' + z.chat.w + 'px');
  ok(!z.boardOn,
    'дошка схована — у просвіті її колонки все одно не читаються',
    'дошка лишилась під перепискою');
  /* Заради цього все й робилось: картку видно, не закриваючи розмову. */
  const card = await p.evaluate(() =>
    ((document.querySelector('.od-panel .od-cl-nm') || {}).textContent || '').trim());
  ok(card === 'Оксана',
    'картку клієнта видно й читати її можна, не закриваючи розмову',
    'картка не читається: «' + card + '»');
  ok(z.x && z.x.t < z.chat.t + 80 && z.x.r > z.chat.r - 80,
    'хрестик стоїть угорі праворуч зони — на межі з карткою',
    'хрестик не там, де його шукатимуть: ' + JSON.stringify(z.x));
}

console.log('');
console.log('═══ ЗАКРИЛИ РОЗМОВУ — КАРТКА ЛИШИЛАСЬ ═══');
await p.evaluate(() => { document.querySelector('.cw-x').click(); });
await p.waitForTimeout(600);
const afterChat = await zones();
ok(!afterChat.chat, 'розмова закрилась', 'розмова не закрилась');
ok(afterChat.drawerOn, 'картка лишилась відкритою — її ніхто не просив закривати',
   'разом із розмовою закрилась і картка');
ok(afterChat.boardOn, 'дошка повернулась', 'дошка так і лишилась схованою');

console.log('');
console.log('═══ ЗАКРИЛИ КАРТКУ — РОЗМОВА ЗАКРИЛАСЬ ═══');
/* Зворотне неправда: розмова живе в картці, і лишати її висіти над порожнім
   місцем немає сенсу. */
await p.evaluate(() => chatOpen(orders[0], 'tg'));
await p.waitForTimeout(600);
await p.evaluate(() => closeOrderDrawer());
await p.waitForTimeout(600);
const afterCard = await zones();
ok(!afterCard.chat && !afterCard.drawerOn,
   'закрили картку — закрилась і розмова',
   'розмова лишилась висіти без картки');
ok(afterCard.boardOn, 'дошка повернулась', 'дошка лишилась схованою');

console.log('');
console.log('═══ РОЗМОВА З ДОШКИ ВІДКРИВАЄ Й ЗАМОВЛЕННЯ ═══');
/* Доти з дошки відкривалась САМА розмова, на всю ширину. А говорять у ній
   рівно про замовлення: що взяли, на скільки, коли відправка, скільки
   сплачено. Усе це доводилось згадувати або закривати розмову й лізти в
   картку — і повертатись назад. Тепер картка відкривається поруч. */
await p.evaluate(() => chatOpen(orders[0], 'tg'));
await p.waitForTimeout(700);
const solo = await zones();
const vw = await p.evaluate(() => window.innerWidth);
console.log('  переписка ' + (solo.chat || {}).l + '–' + (solo.chat || {}).r + ' із ' + vw);
ok(solo.drawerOn,
   'розмова з дошки відкриває й картку замовлення: говорять саме про неї',
   'картка не відкрилась');
ok(solo.chat && solo.chat.r < vw - 100,
   'і зона переписки лишає їй місце справа, а не займає весь екран',
   'переписка накрила картку: ' +
     JSON.stringify(solo.chat) + ' при ширині ' + vw);
ok(solo.chat && solo.chat.l >= solo.nav.r,
   'і меню все одно не перекрито',
   'переписка налізла на меню');

console.log('');
console.log('═══ НА ТЕЛЕФОНІ — НА ВЕСЬ ЕКРАН ═══');
await p.setViewportSize({ width:390, height:844 });
await p.waitForTimeout(600);
const phone = await p.evaluate(() => {
  const cw = document.querySelector('.cw-wrap.open');
  if(!cw) return null;
  const r = cw.getBoundingClientRect();
  return { l:Math.round(r.left), t:Math.round(r.top),
           w:Math.round(r.width), h:Math.round(r.height),
           vw:window.innerWidth, vh:window.innerHeight };
});
if(!phone){ console.log('  розмова зникла на вузькому екрані'); bad++; }
else {
  console.log('  ' + phone.w + '×' + phone.h + ' при екрані ' + phone.vw + '×' + phone.vh);
  ok(phone.l === 0 && phone.t === 0 && phone.w === phone.vw && phone.h === phone.vh,
    'на телефоні зон немає: розмова займає весь екран, як і була',
    'на телефоні розмова стала смугою: ' + JSON.stringify(phone));
}

console.log('');
console.log('═══ НАША КАРТИНКА — ПРАВОРУЧ І З ПІДПИСОМ ═══');
/* Андрій надіслав картку в Direct, і вона стала ЛІВОРУЧ, як клієнтська, ще
   й без імені менеджера під нею.

   Sitniks повертає наші власні повідомлення без відправника — відрізнити їх
   нічим, тож ми памʼятаємо в картці, що самі відправили. Але памʼятали
   цілим текстом РАЗОМ з адресою картинки, а читаючи стрічку назад, адресу
   з тексту вирізаємо — інакше замість фото було б простирадло на двісті
   символів. Шукали ключ із адресою, маючи на руках текст уже без неї. А в
   картинки без підпису після вирізання не лишалось нічого, чим її впізнати
   взагалі. Імʼя менеджера губилось разом із боком: воно в тому ж записі. */
const своє = await p.evaluate(() => {
  const URL_ = 'https://res.cloudinary.com/kmdoab3e/image/upload/v1/kartka.png';
  const o = { id:'1', name:'Оксана', crmChatName:'Оксана' };
  /* Запис такий, яким його кладе відправка: ключем іде САМА АДРЕСА. */
  window.crmOutNote(o, URL_);
  const ключі = (o.crmOut || []).map(r => r.t);
  (o.crmOut || []).forEach(r => { r.by = 'Олеся'; });
  const голе = window.crmNormMsgs([{ text: URL_ }], o) || [];
  const з_підписом = window.crmNormMsgs([{ text: 'Ось прорахунок\n' + URL_ }], o) || [];
  return { ключі,
           голе: голе[0] ? { mine:голе[0].mine, by:голе[0].by, файлів:голе[0].files.length } : null,
           підпис: з_підписом[0] ? { mine:з_підписом[0].mine, by:з_підписом[0].by } : null };
});
console.log('   ключі памʼяті: ' + JSON.stringify(своє.ключі));
ok(своє.ключі.some(k => k.indexOf('cloudinary') >= 0),
  'надіслане памʼятаємо ще й за адресою картинки, а не лише за текстом',
  'адреси серед ключів немає: ' + JSON.stringify(своє.ключі));
ok(своє.голе && своє.голе.mine === true,
  'картинка без підпису впізнається як НАША — і стає праворуч',
  'картинка без підпису лишилась ліворуч: ' + JSON.stringify(своє.голе));
ok(своє.голе && своє.голе.файлів === 1,
  'адреса показується картинкою, а не рядком тексту',
  'вкладення не вийнялось: ' + JSON.stringify(своє.голе));
ok(своє.голе && своє.голе.by === 'Олеся',
  'під нею видно, який саме менеджер надсилав',
  'підпису менеджера немає: ' + JSON.stringify(своє.голе));
ok(своє.підпис && своє.підпис.mine === true && своє.підпис.by === 'Олеся',
  'картинка З підписом упізнається так само',
  'підписана картинка не впізналась: ' + JSON.stringify(своє.підпис));

console.log('');
console.log('═══ КАРТКИ НАДСИЛАЮТЬ ІЗ САМОЇ РОЗМОВИ ═══');
/* Картки малювались у вікні пропозиції, і далі їх треба було завантажити
   собі на диск, знайти в теці й перетягнути в месенджер. Половина цієї
   дороги — робота, якої ніхто не замовляв.

   Скрипт відкриває не поле вводу, а САМІ КАРТКИ: видно, що піде клієнту, і
   можна зняти зайве. Скриптів два, бо це дві різні розмови в різний час:
   прорахунок сьогодні, «до цього зазвичай беруть» — через тиждень. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const типові = adm.slice(adm.indexOf('const QR_DEFAULT = ['),
                           adm.indexOf('function quickReplies'));
  const скрипти = await p.evaluate(txt => ({
    прорахунок: window.cardScriptOf('Ось прорахунок\n{картки}'),
    допродаж:   window.cardScriptOf('Беруть ще\n{допродаж}'),
    звичайна:   window.cardScriptOf('Вітаю! Підкажіть тираж')
  }), типові);
  console.log('   ' + JSON.stringify(скрипти));
  ok(скрипти.прорахунок === 'kp' && скрипти.допродаж === 'up' && !скрипти.звичайна,
    'скрипт із картками впізнається за позначкою, а звичайна заготовка лишається текстом',
    'впізнавання не працює: ' + JSON.stringify(скрипти));
  ok(/\{картки\}/.test(типові) && /\{допродаж\}/.test(типові),
    'у типовому наборі є обидва скрипти — прорахунок і допродаж, а не один спільний',
    'у наборі заготовок немає двох скриптів');
  /* Позначка — команда, а не текст. Якщо вона доїде до клієнта, він
     прочитає в листі «{картки}» і вирішить, що ми щось зламали. */
  const чисто = await p.evaluate(() =>
    window.qrNoMarks('Ось прорахунок 👌\n{картки}'));
  ok(!/\{|\}/.test(чисто),
    'позначка зникає з листа — клієнт бачить текст, а не команду',
    'позначка лишилась у тексті: ' + JSON.stringify(чисто));
  /* Галочки за замовчуванням: прорахунок бере основні позиції й групи
     варіантів, допродаж — тільки рекомендовані. Злиті в один список, вони
     перетворюються на десять картинок поспіль. */
  /* І та сама дорога живцем: відкрили розмову, натиснули скрипт — і замість
     тексту в полі маємо самі картки, намальовані зі складу замовлення. */
  await p.evaluate(() => chatOpen(orders[0], 'tg'));
  await p.waitForTimeout(400);
  await p.click('[data-cw-qr]');
  await p.waitForTimeout(300);
  const індекс = await p.evaluate(() => {
    const b = [...document.querySelectorAll('[data-qr]')]
      .find(x => /прорахунок/i.test(x.textContent));
    return b ? +b.dataset.qr : -1;
  });
  if(індекс < 0) console.log('  (скрипта в наборі немає — пропускаємо живу перевірку)');
  else {
    await p.click('[data-qr="' + індекс + '"]');
    await p.waitForTimeout(5000);
    const панель = await p.evaluate(() => {
      const w = document.querySelector('.cw-cards');
      if(!w) return null;
      return {
        плиток: w.querySelectorAll('.cw-cd').length,
        зкадром: w.querySelectorAll('.cw-cd-pic img').length,
        позначених: w.querySelectorAll('.cw-cd input:checked').length,
        кнопка: (w.querySelector('[data-cd-go]') || {}).textContent.trim(),
        поле: (document.querySelector('.cw-inp') || {}).value || ''
      };
    });
    console.log('   ' + JSON.stringify(панель));
    ok(панель && панель.плиток > 0,
      'скрипт відкриває самі картки, а не вставляє текст у поле',
      'панелі карток немає: ' + JSON.stringify(панель));
    ok(панель && !панель.поле,
      'поле вводу лишається порожнім — текст піде разом із картками, правити його тут не треба',
      'скрипт усе одно вставив текст у поле: ' + JSON.stringify(панель && панель.поле));
    ok(панель && панель.зкадром === панель.плиток,
      'на кожній плитці — сама картка, зменшена: перевіряють оком, а не за назвою',
      'кадри намалювались не для всіх плиток: ' + JSON.stringify(панель));
    ok(панель && панель.позначених > 0 && /Надіслати/.test(панель.кнопка || ''),
      'потрібні картки вже позначені, і видно, скільки саме піде',
      'нічого не позначено або кнопка мовчить: ' + JSON.stringify(панель));
  }

  const наб = adm.slice(adm.indexOf('const CARD_SCRIPTS = {'),
                        adm.indexOf('function cardScriptOf'));
  console.log('   ' + наб.replace(/\s+/g, ' ').slice(0, 130));
  ok(/kp:.*pick: c => c\.kind !== 'reco'/.test(наб),
    'прорахунок позначає основні позиції й групи, а рекомендовані лишає на потім',
    'у скрипта прорахунку не той набір за замовчуванням');
  ok(/up:.*pick: c => c\.kind === 'reco'/.test(наб),
    'допродаж позначає тільки рекомендовані',
    'у скрипта допродажу не той набір за замовчуванням');
  /* Те, що вже надсилали, не позначаємо — надіслати те саме вдруге це не
     турбота, а неуважність, і клієнт її бачить. Але й не ховаємо: видно,
     що саме він уже отримав і коли. */
  const пам = adm.slice(adm.indexOf('deck.list.forEach(c => {'),
                        adm.indexOf('deck.list.forEach(c => {') + 220);
  ok(/&& !sent\[c\.id\]/.test(пам),
    'уже надіслані картки не позначаються — але лишаються видимими, з датою',
    'памʼяті про надіслане немає');
  ok(/cardsSentLabel/.test(adm) && /cw-cd\.was/.test(adm),
    'на такій картці видно, коли й хто її надсилав',
    'позначки «надіслано» на картці немає');
  /* Друга галочка на кнопці КП тримається саме на цій миті: клієнт озвався
     ПІСЛЯ карток — значить розмова пішла. */
  const go = adm.slice(adm.indexOf('async function cardsGo'),
                       adm.indexOf('function cardsDownload'));
  ok(/o\.cardsAt = /.test(go) && /o\.cardsWrote = cardsWroteNow\(o\)/.test(go),
    'відправка лишає слід, з якого росте друга галочка на кнопці КП',
    'мить відправки не запамʼятовується — ✓✓ не зʼявиться ніколи');
  ok(/await chatSend\(o, st\.text\)/.test(go) && go.indexOf('await chatSend') < go.indexOf('for(let i'),
    'текст скрипта йде ПЕРЕД картками, окремим повідомленням — так і пишуть у Direct',
    'текст не відділений від карток');
  ok(/crmOutNote\(o, p\.url\)/.test(go),
    'надіслана картка впізнається як наша — стане праворуч і з іменем менеджера',
    'власна картка знову стане ліворуч, як клієнтська');
}

console.log('');
console.log('═══ ПІДПИС ПІД КОЖНИМ НАШИМ ПОВІДОМЛЕННЯМ ═══');
/* Доти підряд надіслані репліки підписувались один раз, унизу групи.
   Економія на повторі виглядала розумною, поки менеджер був один. А в
   розмові, де відповідали двоє, читалось так: «три повідомлення, внизу
   імʼя — чиє воно, останнього чи всіх трьох?». Питання «хто це писав»
   виникає до кожного рядка окремо. */
const підписи = await p.evaluate(() => {
  const html = window.chatRowsHtml([
    { text:'Перше',  mine:true,  by:'Олеся', at:'2026-09-21 10:00' },
    { text:'Друге',  mine:true,  by:'Олеся', at:'2026-09-21 10:01' },
    { text:'Третє',  mine:true,  by:'Олеся', at:'2026-09-21 10:02' },
    { text:'Дякую',  mine:false, by:'',      at:'2026-09-21 10:05' }
  ]);
  const d = document.createElement('div');
  d.innerHTML = html;
  return Array.from(d.querySelectorAll('.od-crm-msg')).map(m => {
    const at = m.querySelector('.od-crm-at');
    return at ? at.textContent.trim() : '';
  });
});
console.log('   ' + JSON.stringify(підписи));
ok(підписи.slice(0, 3).every(s => /Олеся/.test(s)),
  'імʼя менеджера стоїть під КОЖНИМ його повідомленням, а не лише під останнім',
  'підписані не всі: ' + JSON.stringify(підписи));
ok(!/Олеся/.test(підписи[3] || ''),
  'а під клієнтським — ні: це не наше повідомлення',
  'клієнтське повідомлення підписано нашим менеджером');

console.log('');
console.log('═══ КАРТИНКА В SITNIKS — ВКЛАДЕННЯМ, А НЕ ПОСИЛАННЯМ ═══');
/* Картка, надіслана клієнту, приходила в Instagram синім посиланням:
   натиснути, дочекатись, роздивитись у браузері — і більшість не
   натискає. Заради того, щоб картку ПОБАЧИЛИ в стрічці, її й малюють.

   У коді стояв коментар «Sitniks приймає від нас лише текст» — це був не
   перевірений факт, а здогад: у README три перевірені в бою ендпоінти, і
   відправка вкладень серед них навіть не пробувалась. Власний застосунок
   Sitniks картинки надсилає, отже спосіб існує; назву поля з закритої
   документації не вгадати, тому код пробує способи сам. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const блок = adm.slice(adm.indexOf('const CRM_PIC_WAYS = ['),
                         adm.indexOf('];', adm.indexOf('const CRM_PIC_WAYS = [')));
  const ways = (блок.match(/id:'([^']+)'/g) || []).map(s => s.slice(4, -1));
  console.log('   способів: ' + ways.length + ' · ' + ways.slice(0, 4).join(', ') + '…');
  ok(ways.length >= 8 && ways.some(id => /^form:/.test(id)),
    'способів кілька — і адресою, і самим файлом: назву поля з закритої документації не вгадати',
    'перебору способів немає: ' + JSON.stringify(ways));
  /* Перша спроба — вже не здогадка. Sitniks сам назвав і поле, і його
     форму, відмовивши нам помилкою:

       HTTP 400 ["each_attachment_must_be_a_valid_url"]

     Поле зветься `attachments`, і в ньому АДРЕСИ РЯДКАМИ. Ми ж клали туди
     обʼєкти {mediaType, mediaUrl} — рівно в тій формі, у якій він віддає
     вкладення нам. Читання й запис у нього різні, і саме на цьому
     припущенні ми й помилялись. */
  ok(ways[0] === 'attach-url' && /attachments:u\b/.test(блок) && !/mediaUrl:/.test(блок),
    'перебір починається з attachments масивом адрес — це сам Sitniks сказав помилкою 400',
    'перебір досі починається з обʼєктів, які Sitniks уже відхилив');
  /* В Instagram кілька фото в одному повідомленні — це пачка, один блок,
     який гортають. Поле тому й масив. Слати картки по одній означало
     робити з однієї пачки чергу окремих сповіщень. */
  ok(/many:true/.test(блок) && /many:false/.test(блок),
    'способи розмічені на ті, що беруть пачку адрес, і ті, що беруть лише одну',
    'пачку ніде не враховано: способи з одним полем мовчки загубили б решту карток');
  /* Ту саму адресу Sitniks кладе двічі — і в attachmentUrl, і в
     attachments[].mediaUrl. Без злиття кожне фото двоїлось у стрічці. */
  const фото = await p.evaluate(() => {
    const u = 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=29179664';
    const list = window.crmNormMsgs([{
      id:'x', attachmentUrl:u, attachments:[{ mediaType:'image', mediaUrl:u }],
      messageType:'image', text:'', createdAt:'2026-09-21T16:23:30.866Z'
    }], { id:'1', name:'Оксана' }) || [];
    const m = list[0] || {};
    return { файлів:(m.files || []).length, текст:m.text, вид:(m.files || [])[0] &&
             (m.files || [])[0].kind };
  });
  console.log('   ' + JSON.stringify(фото));
  ok(фото.файлів === 1,
    'та сама адреса з двох полів — одне вкладення, а не два однакові фото поспіль',
    'фото двоїться: ' + JSON.stringify(фото));
  ok(фото.текст === '',
    'адреса вкладення не стає «текстом» повідомлення',
    'адреса потрапила в текст: ' + JSON.stringify(фото));
  /* Відповідь 200 нічого не доводить: сервер міг мовчки проковтнути
     невідоме поле й надіслати порожнє повідомлення. Тому після спроби
     перечитуємо стрічку й дивимось, чи побільшало вкладень. */
  const pic = adm.slice(adm.indexOf('async function crmSendPic'),
                        adm.indexOf('async function crmSend(o, text)'));
  ok(/crmPicCount\(o\)/.test(pic) && /after > before/.test(pic),
    'спосіб вважається знайденим лише коли вкладення СПРАВДІ зʼявилось у стрічці',
    'успіх визначається самою відповіддю сервера — а 200 тут нічого не доводить');
  ok(/contentData\.crmPicWay = w\.id/.test(pic),
    'знайдений спосіб памʼятається — наступного разу йдемо одразу ним',
    'перебір повторювався б на кожну картинку');
  /* Перебір бив у Sitniks чергою запитів без пауз, і після пʼятої спроби
     він відповідав 429: чотирнадцять способів із девʼятнадцяти тоді
     взагалі не перевірились, а в журналі це виглядало як «жоден не
     працює». Пауза між спробами, а на 429 — довше чекання й повтор ТОГО
     САМОГО способу. */
  ok(/CRM_PIC_GAP/.test(pic) && /status === 429/.test(pic) && /CRM_PIC_COOL/.test(pic),
    'між спробами пауза, а на обмеження частоти — чекаємо й повторюємо той самий спосіб',
    'перебір досі йде чергою без пауз — і половина способів не перевіриться');
  ok(/w\.many \|\| urls\.length === 1/.test(pic),
    'на пачці пробуємо лише ті способи, що беруть кілька адрес',
    'спосіб з одним полем надіслав би першу картку й мовчки загубив решту');
  /* Пачка складається ДО відправки: спершу всі картки у сховище, потім
     один запит. Інакше вона склеювалась би по дорозі й розсипалась на
     окремі повідомлення. */
  const go = adm.slice(adm.indexOf('async function cardsGo(o)'),
                       adm.indexOf('async function cardsGo(o)') + 2600);
  ok(/crmSendPic\(o, pack\.map\(p => p\.url\), pack\.map\(p => p\.blob\)\)/.test(go),
    'усі вибрані картки їдуть у Sitniks одним повідомленням — пачкою, як пише людина',
    'картки досі йдуть по одній: клієнту прилітає черга окремих сповіщень');
  /* Файл їде формою, і заголовок їй ставить сам браузер: у ньому межа
     частин, якої ми не знаємо. Свій application/json стер би її. */
  const fetchFn = adm.slice(adm.indexOf('async function crmFetch'),
                            adm.indexOf('async function crmFetch') + 900);
  ok(/instanceof FormData/.test(fetchFn) && /if\(!isForm\)/.test(fetchFn),
    'формі не нав’язуємо свій Content-Type — інакше вкладення приїхало б кашею',
    'crmFetch досі ставить application/json на будь-яке тіло');
  const wk = fs.readFileSync(path.join(ROOT, 'worker/sitniks-proxy.js'), 'utf8');
  ok(/arrayBuffer\(\)/.test(wk) && /const ctype = request\.headers\.get\('Content-Type'\)/.test(wk),
    'і проксі возить тіло байтами з рідним заголовком, а не текстом',
    'проксі досі читає тіло як текст і завжди називає його JSON');
}

console.log('');
console.log('═══ СМУЖКА: СПЕРШУ ПОКАЗАТИ, ПОТІМ НАДІСЛАТИ ═══');
/* Андрій: «коли я вибрав її, воно автоматично вибирається і відправляється,
   хоча я дуже спочатку її побачити, можливо, якісь повідомлення під ним ще
   написати і тільки потім відправити. Можливо, я хочу ще три картинки».

   Скріпка надсилала картинку тієї ж миті, як її вибрали: подивитись,
   докласти другу чи передумати було ніде, а підпис доводилось писати вже
   після — дочекавшись, поки фото долетить, і набираючи текст заново. */
{
  await p.evaluate(async () => { await openOrderDrawer(orders[0]); chatOpen(orders[0], 'tg'); });
  await p.waitForTimeout(700);
  const тр = await p.evaluate(async () => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const f = n => new File([arr], n, { type:'image/png' });
    await chatTake([f('a.png'), f('b.png'), f('c.png')]);
    return { плиток: document.querySelectorAll('.cw-tray .cw-tr').length,
             додати: !!document.querySelector('.cw-tray [data-cw-clip]'),
             хрестик: !!document.querySelector('.cw-tray [data-cw-unpic]'),
             збільшити: !!document.querySelector('.cw-tray [data-cw-big]') };
  });
  console.log('   ' + JSON.stringify(тр));
  ok(тр.плиток === 3,
    'вибране лежить у смужці й чекає — три картинки разом, а не три окремі відправки',
    'смужки немає або картинки в ній не збираються: ' + JSON.stringify(тр));
  ok(тр.додати && тр.хрестик && тр.збільшити,
    'до зібраного можна додати ще, зайве прибрати, а мініатюру збільшити',
    'смужка без керування: ' + JSON.stringify(тр));
  const після = await p.evaluate(() => {
    document.querySelector('.cw-tray [data-cw-unpic]').click();
    return document.querySelectorAll('.cw-tray .cw-tr').length;
  });
  ok(після === 2, 'зайва картинка прибирається до відправки, а не після неї',
    'хрестик не прибирає: лишилось ' + після);
  /* Порядок Андрій назвав прямо: «фотки спочатку відправляються окремим
     повідомленням, і потім внизу ще окремим повідомленням підпис». */
  const adm0 = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const пік = adm0.slice(adm0.indexOf('async function chatSendPics'),
                         adm0.indexOf('function picWord'));
  ok(пік.indexOf('crmSendPic(o, urls') < пік.indexOf('if(text)') &&
     /await chatSend\(o, text\)/.test(пік),
    'спершу картинки пачкою, під ними підпис — окремим повідомленням',
    'підпис іде не після картинок або не окремо');
  ok(/chatWin\.pics = pics/.test(пік),
    'не надіслалось — зібране повертається у смужку, а не зникає разом із роботою',
    'при збої картинки губляться');
  await p.evaluate(() => { chatWin.pics.forEach(chatDropPic); chatWin.pics = []; renderChatWin(); });
}

console.log('');
console.log('═══ НАША КАРТИНКА — ПРАВОРУЧ ═══');
/* Sitniks не переказує клієнту нашу адресу: він забирає картинку до себе й
   у стрічці віддає її вже своєю, на CDN Instagram. Памʼять за адресою на
   картинках тому не спрацьовує ніколи, і власне фото ставало ліворуч, як
   клієнтське. Прикмета — номер повідомлення з відповіді на нашу відправку. */
{
  const бік = await p.evaluate(() => {
    const o = { id:'1', name:'Оксана' };
    crmOutSent(o, { id:'m-77' });
    const наше = (crmNormMsgs([{ id:'m-77', attachments:['https://lookaside.fbsbx.com/x'],
      createdAt:'2026-09-22T10:00:00.000Z' }], o) || [])[0] || {};
    const чуже = (crmNormMsgs([{ id:'m-88', attachments:['https://lookaside.fbsbx.com/y'],
      createdAt:'2026-09-22T10:00:00.000Z' }], o) || [])[0] || {};
    return { наше:!!наше.mine, підпис:наше.by || '', чуже:!!чуже.mine };
  });
  console.log('   ' + JSON.stringify(бік));
  ok(бік.наше,
    'картинку від нас упізнаємо за номером повідомлення — вона стане праворуч',
    'власна картинка знову ліворуч: ' + JSON.stringify(бік));
  ok(!!бік.підпис,
    'і підписана менеджером, який її надіслав',
    'підпису під власною картинкою немає');
  ok(!бік.чуже,
    'а чужа лишається ліворуч — номер її не збігається з жодною нашою',
    'клієнтська картинка помилково стала нашою');
}

console.log('');
console.log('═══ КАРТКА ЙДЕ ВГОРУ ВІД БУДЬ-ЯКОЇ ДІЇ ═══');
/* Andрій: «наслав картинку — картка в канбані не підстрибнула вгору, хоча
   повинна». Рядок, що піднімає картку, стояв лише в дорозі для ТЕКСТУ.
   Правило ширше: вгору підіймає все, що з замовленням сьогодні робили, —
   наш лист, наша картинка, слово клієнта і заповнене поле в самій картці. */
{
  const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
  const між = (a, b) => adm.slice(adm.indexOf(a), adm.indexOf(b, adm.indexOf(a)));
  const фото = між('async function chatSendPics', '\nfunction picWord');
  ok(/touchOrder\(o\)/.test(фото),
    'надіслана картинка піднімає картку так само, як лист',
    'після картинки картка лишається на місці');
  const поле = між("panel.querySelectorAll('.od-f')", 'od-note');
  ok(/touchOrder\(o\)/.test(поле),
    'заповнене поле в картці теж піднімає її вгору колонки',
    'правки в картці не піднімають її');
  const тг = між("if(o.tgLast !== last || o.tgWrote !== wrote)", 'touched = true');
  ok(/touchOrder\(o\)/.test(тг) && /o\.tgWrote != null/.test(тг),
    'слово клієнта піднімає картку — але не всі одразу при завантаженні сторінки',
    'вхідне повідомлення не піднімає картку або підніме геть усі');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'переписка стала зоною робочого місця, а не попапом поверх усього');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
