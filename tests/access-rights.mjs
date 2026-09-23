/* Роздавання доступів: видалення, зрозумілі назви, запрошення поштою.

   ЩО БУЛО НЕ ТАК.

   1. Видалення не було правом узагалі. Кнопку «Видалити картку» бачив кожен,
      хто бачить дошку — дизайнер і виробництво теж, — а база пускала кожного,
      хто може міняти склад. Замовлення зникало назавжди після одного «ок» і
      не лишало сліду НІДЕ: стрічка подій зникала разом із карткою, а в
      журналі доступу писались лише експорти й зміни прав.

   2. Назви прав нічого не пояснювали. «Міняти етапи, треки й команду» — це
      наш жаргон, за яким ховається пʼятеро різних дверей. Роздавати права
      наосліп гірше, ніж не роздавати їх зовсім.

   3. Кого не завели в команду, той ставав МЕНЕДЖЕРОМ: бачив дошку, клієнтів і
      всі замовлення. Поки акаунти заводили руками в консолі, це не стріляло.
      З появою запрошень поштою вхід відкривається сам — і припущення стало
      прямою дірою.

   4. Акаунт заводили руками в консолі Firebase, пароль передавали в
      месенджері, а імʼя людини вписував за неї власник.

   Перевіряємо:
     — «Видаляти замовлення» є окремим правом, і кожне право має пояснення;
     — без права кнопок видалення немає взагалі, а не «вони не спрацюють»;
     — з правом видалення пишеться в журнал разом із номером і сумою;
     — чужа пошта бачить екран «вас не додали», а не чужі замовлення;
     — запрошення шлеться на пошту з тієї самої сторінки, і лише тому, хто
       вже збережений у команді;
     — підсумок доступів видно в рядку, не розгортаючи галочки;
     — своє імʼя людина міняє сама, і воно головніше за вписане власником.

   Запуск:  node tests/access-rights.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8840;
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

const ORDER = {
  id:'1', orderId:'1000801', type:'client', name:'Оксана', phone:'+380670000801',
  status:'paid', site:'main',
  tracks:{ design:'new', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000 }]
};
/* Менеджер зі складом і оплатою, але БЕЗ видалення — рівно той випадок, через
   який усе й затівалось: людина щодня працює із замовленнями й не має права
   стерти жодне. */
const TEAM = [
  { email:'owner@loomiq', name:'Андрій', role:'owner' },
  { email:'test@loomiq',  name:'Марія',  role:'manager',
    acc:{ ui:'manager', nav:['board','team'], boards:['sale','design'],
          see:['client','cost'], can:['edit','pay','setup'] } }
];

function stub(email, team, extra){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(Object.assign({ team }, extra || {})) + ';\n' +
    '  window.firebase={');
  s = s.replace(/email:'test@loomiq'/g, "email:'" + email + "'");
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
const errs = [];
async function open(email, team, extra){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(email + ': ' + e.message.slice(0, 170)));
  p.on('dialog', d => d.accept('ok'));
  const body = stub(email, team, extra);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}

console.log('═══ ПРАВА НАЗИВАЮТЬСЯ ЗРОЗУМІЛО ═══');
const p = await open('test@loomiq', TEAM);
const rights = await p.evaluate(() => ({
  can: ZONE_CAN.map(z => ({ k:z.key, l:z.label, h:(z.hint || '').length })),
  noHint: [].concat(ZONE_CAN, ZONE_SEE, ZONE_NAV).filter(z => !z.hint).map(z => z.key),
  jargon: JSON.stringify(ZONE_CAN).indexOf('трек') >= 0
}));
rights.can.forEach(r => console.log('  ' + r.k + ' → «' + r.l + '» (+' + r.h + ' знаків пояснення)'));
ok(rights.can.some(r => r.k === 'del'),
  '«Видаляти замовлення» стало окремим правом',
  'права на видалення немає: ' + rights.can.map(r => r.k).join(','));
ok(!rights.noHint.length,
  'кожна галочка має другий рядок із поясненням, що саме відчиняється',
  'без пояснення лишились: ' + rights.noHint.join(', '));
ok(!rights.jargon,
  'слова «треки» в назвах прав більше немає — це наш жаргон, не для списку',
  'жаргон лишився в назвах прав');

console.log('');
console.log('═══ БЕЗ ПРАВА КНОПОК ВИДАЛЕННЯ НЕМАЄ ═══');
const asManager = await p.evaluate(() => ({ del: canDelete(), edit: canEditItems() }));
ok(asManager.edit && !asManager.del,
  'менеджер міняє склад, але видаляти не може — це вже різні права',
  'права не розділились: ' + JSON.stringify(asManager));
const before = await p.evaluate(() => ({ orders: orders.length }));
await p.click('.ticket:has-text("1000801")');
await p.waitForTimeout(900);
const drawerNo = await p.evaluate(() =>
  document.querySelectorAll('#orderDrawer .od-del-lite').length);
console.log('  «Видалити картку» в панелі: ' + drawerNo);
ok(drawerNo === 0,
  'рядка видалення в панелі немає — кнопки немає, а не «не спрацює»',
  'кнопка видалення лишилась без права');
/* І сама дія теж замкнена: кнопку можна дописати з консолі, право — ні. */
const refused = await p.evaluate(async () => {
  await deleteOrderCard(orders[0]);
  return orders.length;
});
ok(refused === before.orders,
  'виклик видалення напряму теж нічого не стирає',
  'замовлення зникло попри відсутність права');

console.log('');
console.log('═══ ПІДСУМОК ДОСТУПІВ ВИДНО В РЯДКУ ═══');
await p.evaluate(() => { document.querySelector('.nav button[data-view="team"]').click(); });
await p.waitForTimeout(600);
const sums = await p.evaluate(() =>
  [...document.querySelectorAll('#team-list .tm-sum')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
sums.forEach(s => console.log('  ' + s.slice(0, 120)));
ok(sums.length === 2 && sums.every(s => /Заходить:/.test(s) && /Може:/.test(s)),
  'під кожною людиною видно результат, а не «розгорніть і порахуйте галочки»',
  'підсумку немає: ' + JSON.stringify(sums));
ok(sums.some(s => /Може: [^·]*Видаляти замовлення/.test(s)),
  'у власника в підсумку видно й право на видалення',
  'право видалення не потрапило в підсумок');

console.log('');
console.log('═══ РОЛЬ ПІДПИСАНА НАПРЯМОМ ═══');
/* У компанії два різні бізнеси, і ролі в них різні: менеджер B2B і менеджер
   B2C — різні люди з різними обовʼязками. Тому в списку вони стоять
   окремими рядками, а не роллю з галочкою десь поруч: так видно з першого
   погляду, кого куди заводять, і неможливо видати доступ трохи не туди. */
const ролі = await p.evaluate(() => {
  const sel = document.querySelector('#team-list .tm-role');
  const opts = [...(sel ? sel.options : [])].map(o => o.textContent.trim());
  return { рядків:opts.length, менеджери:opts.filter(t => /^Менеджер/.test(t)),
           власник:opts[0] };
});
console.log('   ' + JSON.stringify(ролі.менеджери));
ok(ролі.менеджери.join() === 'Менеджер B2B,Менеджер B2C,Менеджер · B2B і B2C',
  'у списку окремі рядки на кожен напрям, і окремий — для того, хто в обох',
  'ролі без напряму: ' + JSON.stringify(ролі));
ok(ролі.власник === 'Власник',
  'власникові напрям не підписують — у нього все й так',
  'власник теж розділений на напрями: ' + JSON.stringify(ролі));
/* Напрям закриває розділ надійніше за галочку: галочку можна забути зняти,
   і менеджер B2C побачив би Канбан із чужими замовленнями. */
const розділи = await p.evaluate(() => {
  const було = JSON.stringify(contentData.team || []);
  const тест = dirs => {
    contentData.team = [{ email:myEmail(), name:'Я', role:'manager', dirs:dirs,
      acc:{ ui:'manager', nav:['today','board','design'], boards:['sale'],
            see:['client'], can:['edit'] } }];
    teamDraft = null; applyRoleUi();
    return [...document.querySelectorAll('.nav button[data-view]')]
      .filter(b => !b.hidden).map(b => b.dataset.view);
  };
  const b2b = тест(['b2b']), b2c = тест(['b2c']);
  contentData.team = JSON.parse(було); teamDraft = null; applyRoleUi();
  return { b2b, b2c };
});
console.log('   ' + JSON.stringify(розділи));
/* Розділів, яких не існувало, коли людині роздавали доступи, у її
   збережених галочках немає — і без списку «нових зон» їх не побачив би
   ніхто з уже заведених. Саме тому чатів і не було видно в меню. */
ok(/ZONE_NEW = \['design', 'chats', 'chatsc'\]/.test(
     fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8')),
  'нові розділи доходять і до тих, кому доступи роздали раніше',
  'новий розділ не побачить ніхто з уже заведених');
ok(розділи.b2b.indexOf('board') >= 0 && розділи.b2b.indexOf('design') < 0,
  'менеджер B2B бачить Канбан і не бачить B2C — він навіть не знає, що той є',
  'менеджерові B2B видно чужий напрям: ' + JSON.stringify(розділи));
ok(розділи.b2c.indexOf('design') >= 0 && розділи.b2c.indexOf('board') < 0,
  'менеджер B2C бачить свій напрям і не бачить Канбану',
  'менеджерові B2C видно Канбан: ' + JSON.stringify(розділи));

console.log('');
console.log('═══ ДОСТУП НЕ ВТРАЧАЄТЬСЯ НІКОЛИ ═══');
/* Власник налаштовував ролі, зберіг список без себе — і замкнувся у
   власній системі: розділ доступів теж за табличкою «вас ще не додали в
   команду». Повернутись можна було лише через консоль бази. Так не має
   бути в жодній системі, де є доступи. */
const ключ = await p.evaluate(() => {
  const було = JSON.stringify(contentData.team || []);
  const mail = myEmail();
  /* Справжніх адрес засновників тут немає навмисно: у коді лежать самі
     підписи, і в перевірці їм теж не місце. Тому підписуємо тестову пошту
     й дивимось, як поводиться сам механізм. */
  ROOT_SIGS.push(mailSig(mail));
  const свій = isRootEmail(mail);
  const підписи = ROOT_SIGS.every(x => x.indexOf('@') < 0);
  // Список без засновника: збереження має дописати його назад.
  const list = [{ email:'hto@inshiy', name:'Хтось', role:'manager', dirs:['b2b'],
                  acc:{ ui:'manager', nav:['board'], boards:['sale'], see:[], can:[] } }];
  rootKeep(list);
  const повернувся = list.some(p => String(p.email).toLowerCase() === mail);
  // І сама табличка «вас не додали» засновнику не показується.
  contentData.team = list.filter(p => String(p.email).toLowerCase() !== mail);
  const замкнувся = !applyNoAccess();
  const роль = myRole();
  ROOT_SIGS.pop();
  contentData.team = JSON.parse(було); teamDraft = null; applyRoleUi();
  return { свій, підписи, повернувся, замкнувся, роль };
});
console.log('   ' + JSON.stringify(ключ));
ok(ключ.свій && ключ.підписи,
  'пошту засновника впізнають за підписом — самої адреси в коді немає',
  'засновника не впізнано, або адреса лежить у сторінці відкритим текстом');
ok(ключ.повернувся,
  'список, збережений без засновника, дописує його назад — втратити його неможливо',
  'засновник зник зі списку: ' + JSON.stringify(ключ));
ok(!ключ.замкнувся && ключ.роль === 'owner',
  'і навіть за відсутності в списку він заходить власником, а не впирається в «вас не додали»',
  'засновник замкнувся у власній системі: ' + JSON.stringify(ключ));
/* «Його не можна прибрати» лишається обіцянкою, якої не видно, доки рядка
   немає на екрані. Адресу засновника впізнають за підписом скрізь, де він
   хоч раз щось робив, — тож рядок ставимо самі. */
const рядок = await p.evaluate(async () => {
  const було = JSON.stringify(contentData.team || []);
  ROOT_SIGS.push(mailSig(myEmail()));
  contentData.team = [{ email:'hto@inshiy', name:'Хтось', role:'manager',
                        acc:{ ui:'manager', nav:['board'], boards:['sale'], see:[], can:[] } }];
  teamDraft = null;
  document.querySelector('.nav button[data-view="team"]').click();
  await new Promise(r => setTimeout(r, 300));
  const рядки = [...document.querySelectorAll('#team-list .tm-row')];
  const мій = рядки.find(r => (r.querySelector('.tm-mail') || {}).value === myEmail());
  const out = { зʼявився:!!мій, замок:!!(мій && мій.querySelector('.tm-lock')),
                кошик:!!(мій && мій.querySelector('.qr-del')) };
  ROOT_SIGS.pop();
  contentData.team = JSON.parse(було); teamDraft = null; renderTeamList();
  return out;
});
console.log('   ' + JSON.stringify(рядок));
ok(рядок.зʼявився,
  'рядок засновника стоїть у списку сам, навіть якщо в збереженому його немає',
  'засновника в списку не видно: ' + JSON.stringify(рядок));
ok(рядок.замок && !рядок.кошик,
  'і замість кошика в нього замок — прибрати нічим',
  'засновника можна прибрати кнопкою: ' + JSON.stringify(рядок));

console.log('');
console.log('═══ КОМАНДУ МОЖНА ЗІБРАТИ ЗІ СЛІДІВ ═══');
/* Список команди — єдиний запис, який ніде більше не дублюється: пропав, і
   відновлювати нема з чого. А пропасти він може буденно: правка в базі,
   збережений не той список, чиясь помилка.

   Але самі люди по системі розсипані всюди: кожне замовлення памʼятає свого
   відповідального, кожна оплата — хто її вніс, журнал прав — кого заводили.
   Цього досить, щоб зібрати список наново. */
const сліди = await p.evaluate(async () => {
  const було = JSON.stringify(contentData.team || []);
  orders.push({ id:'t1', orderId:'1000900', mgrEmail:'olesya@loomiq',
                hist:[{ s:'kp', by:'maryna@loomiq' }],
                payments:[{ sum:1, by:'ira@loomiq' }], items:[] });
  contentData.accessLog = [{ at:'', by:'vova@loomiq', kind:'rights',
                             text:'змінив права: nastya@loomiq (нов.)' }];
  contentData.team = [];
  teamDraft = null;
  document.querySelector('.nav button[data-view="team"]').click();
  await new Promise(r => setTimeout(r, 300));
  document.getElementById('team-find').click();
  await new Promise(r => setTimeout(r, 300));
  const пошти = teamList().map(x => x.email).sort();
  contentData.team = JSON.parse(було); teamDraft = null;
  orders.pop(); renderTeamList();
  return пошти;
});
console.log('   ' + JSON.stringify(сліди));
ok(сліди.indexOf('olesya@loomiq') >= 0 && сліди.indexOf('maryna@loomiq') >= 0 &&
   сліди.indexOf('ira@loomiq') >= 0,
  'людей збирає із замовлень: відповідальний, історія, оплати',
  'сліди в замовленнях не читаються: ' + JSON.stringify(сліди));
ok(сліди.indexOf('nastya@loomiq') >= 0 && сліди.indexOf('vova@loomiq') >= 0,
  'і з журналу прав — там видно, кого колись заводили і хто це робив',
  'журнал прав не переглядається: ' + JSON.stringify(сліди));

console.log('');
console.log('═══ ЗАПРОШЕННЯ ЙДЕ НА ПОШТУ ═══');
const inv = await p.evaluate(async () => {
  window.__AUTH = [];
  const btns = [...document.querySelectorAll('#team-list .tm-inv')];
  const offBefore = btns.map(b => b.disabled);
  btns[1].click();
  await new Promise(r => setTimeout(r, 400));
  return { offBefore, log: window.__AUTH.slice() };
});
console.log('  ' + JSON.stringify(inv.log));
ok(inv.log.length === 1 && inv.log[0].op === 'invite' && inv.log[0].mail === 'test@loomiq',
  'кнопка шле лист саме тій людині, біля якої стоїть',
  'запрошення не пішло або пішло не туди: ' + JSON.stringify(inv.log));
ok(inv.log.length === 1 && /invite=1/.test(String(inv.log[0].url || '')),
  'у листі адреса повернення веде на екран першого входу',
  'адреса повернення не та: ' + JSON.stringify(inv.log[0]));

const notSaved = await p.evaluate(async () => {
  window.__AUTH = [];
  teamList().push({ email:'new@loomiq', name:'Нова', role:'designer',
                    acc: accExpand(presetOf('designer')) });
  renderTeamList();
  const b = [...document.querySelectorAll('#team-list .tm-inv')].pop();
  const off = b.disabled;
  b.click();
  await new Promise(r => setTimeout(r, 300));
  return { off, sent: window.__AUTH.length };
});
ok(notSaved.off && notSaved.sent === 0,
  'незбереженій людині запрошення не надсилається — інакше вона зайде в нікуди',
  'лист пішов тому, кого ще немає в базі: ' + JSON.stringify(notSaved));

console.log('');
console.log('═══ СВОЄ ІМʼЯ ЛЮДИНА ПИШЕ САМА ═══');
const me = await p.evaluate(async () => {
  window.__AUTH = [];
  openMe();
  document.getElementById('me-first').value = 'Марія';
  document.getElementById('me-last').value = 'Коваленко';
  document.getElementById('me-form').dispatchEvent(new Event('submit', { cancelable:true }));
  await new Promise(r => setTimeout(r, 500));
  return { log: window.__AUTH.slice(), name: personName('test@loomiq'),
           shut: document.getElementById('me-modal').style.display };
});
console.log('  ' + me.name + ' · ' + JSON.stringify(me.log));
ok(me.log.some(x => x.op === 'name' && x.name === 'Марія Коваленко'),
  'імʼя й прізвище пішли в профіль',
  'профіль не оновився: ' + JSON.stringify(me.log));
ok(me.name === 'Марія Коваленко',
  'і далі система кличе людину так, як назвалась вона, а не як вписав власник',
  'імʼя лишилось чужим: ' + me.name);
ok(!me.log.some(x => x.op === 'pass'),
  'порожнє поле пароля пароль не міняє',
  'пароль змінився без запиту');
await p.close();

console.log('');
console.log('═══ ВЛАСНИК: ВИДАЛЕННЯ Є, І ВОНО ЛИШАЄ СЛІД ═══');
{
  const po = await open('owner@loomiq', TEAM);
  await po.click('.ticket:has-text("1000801")');
  await po.waitForTimeout(900);
  const has = await po.evaluate(() => ({
    del: canDelete(),
    btn: document.querySelectorAll('#orderDrawer .od-del-lite').length }));
  ok(has.del && has.btn === 1,
    'у власника рядок видалення в панелі є',
    'власник лишився без видалення: ' + JSON.stringify(has));
  const gone = await po.evaluate(async () => {
    const n = orders.length;
    await deleteOrderCard(orders[0]);
    const L = (contentData.accessLog || []).filter(r => r.kind === 'del');
    return { was:n, now:orders.length, log:L.map(r => r.text) };
  });
  console.log('  ' + gone.log.join(' | '));
  ok(gone.now === gone.was - 1, 'замовлення видаляється', 'видалення не спрацювало');
  ok(gone.log.length === 1 && /1000801/.test(gone.log[0]) && /25000/.test(gone.log[0]),
    'у журналі лишився запис із номером і сумою — після видалення взяти їх нізвідки',
    'журнал не зафіксував видалення: ' + JSON.stringify(gone.log));
  await po.close();
}

console.log('');
console.log('═══ ЧУЖА ПОШТА НЕ БАЧИТЬ НІЧОГО ═══');
{
  const ps = await open('stranger@loomiq', TEAM);
  const st = await ps.evaluate(() => ({
    screen: !!document.getElementById('no-access'),
    mail: (document.querySelector('#no-access .na-mail') || {}).textContent || '',
    nav: [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).length,
    cost: canSeeCost(), edit: canEditItems(), del: canDelete()
  }));
  console.log('  екран: ' + st.screen + ' · пошта на екрані: ' + st.mail);
  ok(st.screen && st.mail === 'stranger@loomiq',
    'чужому кажуть прямо, що його не додали, і під якою поштою він зайшов',
    'екрана «вас не додали» немає: ' + JSON.stringify(st));
  ok(!st.cost && !st.edit && !st.del,
    'жодного права: раніше чужа пошта отримувала повноцінного менеджера',
    'чужа пошта має права: ' + JSON.stringify(st));
  await ps.close();

  /* Порожній список і далі означає повний доступ: інакше перше ж збереження
     замкнуло б систему від самого власника. */
  const pe = await open('nobody@loomiq', []);
  const empty = await pe.evaluate(() => ({
    screen: !!document.getElementById('no-access'),
    del: canDelete(), setup: canSetup() }));
  ok(!empty.screen && empty.del && empty.setup,
    'порожній список команди — доступ повний, як і був',
    'порожній список щось замкнув: ' + JSON.stringify(empty));
  await pe.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'видалення — окреме право, назви зрозумілі, вхід видається поштою');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
