/* КАРТКА ПРИВАТНОГО ЗАМОВЛЕННЯ: ЗОНИ, ПЕРЕДАЧА, ГРОШІ, ДАТА.

   Андрій, після місяця роботи в цій картці:

     «Перше їх розділити якось потрібно гарно, щоб воно гарно сприймалося,
      основні зони… коли ми графічний дизайнер пишемо, ми просто повинні
      тут назначити дизайнера спочатку. Не потрібно оце: дістати правку,
      файл, версія, клієнт погодив, погодив аккаунт менеджер. Поки цього не
      потрібно, бо ми ще ж не передали нікому… І якось там загорається, тобто
      ця зона зелененьким. Або цей перший одиничка загорається — жовтеньким,
      передано графічному дизайнеру, зелененьким, коли вже передамо
      вишивальному… Гроші підтягуються з того, що ми там назначили, який
      продукт, тянеться з адмінки ціни… Є передоплата — не писати суму, а
      вибрати з списку, який в нас в фінансах… В дату ставимо тільки 08-09,
      не потрібно рік писати.»

   Кожне з цих речень — окрема поломка, і кожну легко зламати назад однією
   правкою верстки. Тому перевіряємо не вигляд, а рівно те, що видно очима:

     1. картка розділена на зони, у кожної свій колір і підпис;
     2. до передачі в рядку дизайну є ЛИШЕ вибір дизайнера;
     3. після передачі зʼявляється все інше, а колонка й номер загораються;
     4. сума рахується з роздрібного прайсу, рядок за рядком;
     5. передоплату обирають платежем, а не пишуть числом;
     6. дата — кнопкою з календарем, без року.

   Запуск:  node tests/b2c-card.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8917;
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
  /* Роздрібна ціна саме цього виробу. Саме з неї має рахуватись сума
     замовлення — а не з `totalPrice`, якого в приватних замовленнях немає. */
  products: { retail: { tee: 700 } }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія Дерещук',
    status:'prorahunok', site:'main', payments:[], hist:[],
    createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    /* Поле прорахунку стоїть і навмисно розходиться з прайсом: перевіряємо,
       що виграє склад, а не давнє число з іншого місця. */
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
/* Надходження у Фінансах. Два вільні, один уже привʼязаний до цього
   замовлення: саме з цього списку картка й має брати передоплату. */
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'window.__PAYS=[\n' +
  "    { id:'p1', at:'2026-09-26T10:12:00.000Z', amount:1500, acc:'mono1', counter:'Асія Д.', desc:'за футболки' },\n" +
  "    { id:'p2', at:'2026-09-27T14:40:00.000Z', amount:2400, acc:'privat1', counter:'Оксана П.' },\n" +
  "    { id:'p3', at:'2026-09-24T09:05:00.000Z', amount:900, acc:'mono2', orderId:'2000101', tag:'prepay', counter:'Асія' },\n" +
  "    { id:'p4', at:'2026-09-23T09:05:00.000Z', amount:-320, acc:'mono1', counter:'Нова пошта' }\n" +
  '  ];\n' +
  '  function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  function PayCol(){}\n' +
  '  PayCol.prototype=Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where=function(){ return this; };\n' +
  '  PayCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__PAYS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__PAYS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  PayCol.prototype.doc=function(id){ return { set:function(v){\n' +
  '    var p=window.__PAYS.filter(function(x){ return x.id===id; })[0];\n' +
  '    if(p) Object.keys(v).forEach(function(k){ p[k]=v[k]; });\n' +
  '    return Promise.resolve(); } }; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  "      if(n==='payments') return new PayCol();\n" +
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

/* Заводимо картку так, як її заводить менеджер: два вироби, дизайн на
   першому. Через `openDesign()`, а не підстановкою `display` — інакше
   `U.host` не вмикається, і панель малюється порожньою. */
await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const job = designJobMake('2000101');
  job.due = '2026-10-14';
  const U = window.LQDesign.ui;
  job.units = [
    Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний',
                                 size:'M', qty:3, note:'Лого менше' }),
    Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі базове', color:'Сірий',
                                 size:'L', qty:1 })
  ];
  window.LQDesign.dzList(job.units[0], 'graphic').push(window.LQDesign.dzNew());
  openDesign();
});
await p.waitForTimeout(800);
await p.evaluate(() => { const c = document.querySelector('[data-open]'); if(c) c.click(); });
await p.waitForTimeout(700);

console.log('\n═══ КАРТКА РОЗДІЛЕНА НА ЗОНИ ═══');
/* Доти все йшло одним потоком, розділеним однаковими сірими підписами:
   очима місце в ньому не знаходилось, картку читали підряд щоразу. */
const зони = await p.evaluate(() => [...document.querySelectorAll('.dz-panel-b .dz-z')].map(z => ({
  колір: (z.className.match(/\bz-([a-z]+)\b/) || [])[1] || '',
  назва: ((z.querySelector('.dz-z-h b') || {}).textContent || '').trim(),
  підпис: ((z.querySelector('.dz-z-s') || {}).textContent || '').trim(),
  фон: getComputedStyle(z.querySelector('.dz-z-h')).backgroundColor,
  висота: Math.round(z.getBoundingClientRect().height)
})));
console.log('  ' + зони.map(z => z.назва + ' (' + z.колір + ')').join(' · '));
ok(зони.length >= 4, 'картка складається із зон, а не з суцільного потоку: ' + зони.length,
   'зон у картці немає: ' + зони.length);
ok(зони.map(z => z.назва).join('|') === 'Клієнт|Склад і дизайн|Гроші|Відправка',
  'порядок робочий: хто → що робимо → скільки грошей → куди їде',
  'порядок зон не той: ' + зони.map(z => z.назва).join(' → '));
ok(new Set(зони.map(z => z.колір)).size === зони.length,
  'у кожної зони свій колір — місце знаходиться кольором, а не читанням',
  'кольори зон повторюються: ' + зони.map(z => z.колір).join(', '));
ok(зони.every(z => z.фон && z.фон !== 'rgba(0, 0, 0, 0)'),
  'колір справді намальований, а не лише названий класом',
  'шапка зони без фону: ' + JSON.stringify(зони.map(z => z.фон)));
/* Підпис зони відповідає на питання, не змушуючи зону читати. */
ok(/позиц/.test((зони.filter(z => z.назва === 'Склад і дизайн')[0] || {}).підпис || ''),
  'склад підписаний тим, що в ньому: ' +
    (зони.filter(z => z.назва === 'Склад і дизайн')[0] || {}).підпис,
  'у складу немає підпису');
/* ГОЛОВНЕ ПРО ЗОНИ: вони НЕ згорнуті. Андрій: «хай вона буде повністю
   розгорнута, так буде легше сприймати». Складена зона ховає рівно те,
   через що замовлення й стоїть. */
const складені = await p.evaluate(() =>
  document.querySelectorAll('.dz-panel-b details:not([open])').length);
ok(!складені, 'жодна зона не згорнута — стан замовлення видно цілком',
   'згорнутих блоків у картці: ' + складені);
/* І кожна зона показана на весь свій зріст. Зони лежать у гнучкій колонці,
   а її елементи за замовчуванням стискаються — саме так зона складу колись
   ужалась до чужого зросту й відрізала половину виробу. */
const вужча = await p.evaluate(() => {
  const z = [...document.querySelectorAll('.dz-panel-b .dz-z')];
  return z.filter(x => x.scrollHeight > x.clientHeight + 2).map(x =>
    ((x.querySelector('.dz-z-h b') || {}).textContent || '').trim());
});
ok(!вужча.length, 'жодна зона не стиснута — вміст не обрізано',
   'зони обрізають вміст: ' + вужча.join(', '));

console.log('\n═══ ДО ПЕРЕДАЧІ — ЛИШЕ ВИБІР ДИЗАЙНЕРА ═══');
/* «Не потрібно оце: дістати правку, файл, версія, клієнт погодив, погодив
   аккаунт менеджер. Поки цього не потрібно, бо ми ще ж не передали
   нікому.» Половина цих кнопок у такий момент або нічого не робить, або
   робить неправду: затвердити можна версію, а версій нуль. */
await p.evaluate(() => { const b = document.querySelector('[data-do="dz-open"]'); if(b) b.click(); });
await p.waitForTimeout(500);
const до = await p.evaluate(() => {
  const b = document.querySelector('.dz-dz.open .dz-dz-b');
  if(!b) return null;
  return { кнопки: [...b.querySelectorAll('button')].map(x => x.textContent.trim()),
           списків: b.querySelectorAll('select').length,
           полів: b.querySelectorAll('textarea').length };
});
console.log('  ' + JSON.stringify(до));
ok(до && до.списків === 1,
  'є рівно один список — кого призначаємо',
  'вибору дизайнера немає або він не один: ' + JSON.stringify(до));
ok(до && !до.кнопки.length && !до.полів,
  'і більше нічого: ні версій, ні правок, ні погоджень',
  'до передачі показано зайве: ' + JSON.stringify(до && до.кнопки));

console.log('\n═══ ПРИЗНАЧИЛИ → ЗʼЯВИЛАСЬ ПЕРЕДАЧА ═══');
await p.evaluate(() => {
  const s = document.querySelector('.dz-dz.open [data-dzwho]');
  s.value = 'art@loomiq';
  s.dispatchEvent(new Event('change'));
});
await p.waitForTimeout(700);
await p.evaluate(() => {
  if(!document.querySelector('.dz-dz.open')){
    const b = document.querySelector('[data-do="dz-open"]'); if(b) b.click();
  }
});
await p.waitForTimeout(300);
const передати = await p.evaluate(() =>
  [...document.querySelectorAll('[data-do="dz-send"]')].map(b => b.textContent.trim()));
console.log('  ' + JSON.stringify(передати));
ok(передати.length === 1 && /Передати замовлення/.test(передати[0]),
  'кнопка передачі зʼявилась і названа людиною: ' + передати[0],
  'кнопки передачі немає: ' + JSON.stringify(передати));
/* Досі це були дві дії й одна назва: «прикріпити» й «відправити»
   виглядали однаково, і половина замовлень зависала між ними. */
const щеНеВидно = await p.evaluate(() =>
  document.querySelectorAll('.dz-dz.open [data-do="dz-ok"]').length);
ok(!щеНеВидно, 'погоджень і далі немає — дизайнер ще навіть не знає про замовлення',
   'погодження показані до передачі: ' + щеНеВидно);

console.log('\n═══ ПЕРЕДАЛИ → ЗАГОРІЛОСЬ ЖОВТИМ ═══');
await p.evaluate(() => { const b = document.querySelector('[data-do="dz-send"]'); if(b) b.click(); });
await p.waitForTimeout(800);
const після = await p.evaluate(() => {
  const col = document.querySelector('.dz-u-col');
  const n = document.querySelector('.dz-u-n');
  return { колонка: col.className, номер: n.className,
           фонКолонки: getComputedStyle(col).backgroundColor,
           слово: ((col.querySelector('.dz-u-l i') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(після));
ok(/is-sent/.test(після.колонка) && /is-sent/.test(після.номер),
  'колонка й номер позиції загорілись: передано графічному дизайнеру',
  'після передачі нічого не загорілось: ' + JSON.stringify(після));
ok(після.слово === 'передано',
  'і сказано словом, а не лише кольором — колір сам нічого не пояснює',
  'слова про передачу немає: «' + після.слово + '»');
/* ЖОВТИЙ, А НЕ ЗЕЛЕНИЙ. Зелений у графіки означає не «намалювали», а
   «пішло далі» — вишивальному вже передали. Доти нічого не закінчено. */
ok(!/is-done/.test(після.колонка),
  'але не зеленим: вишивальному ще нічого не передавали',
  'графіка позеленіла зарано');

console.log('\n═══ ПЕРЕДАЛИ ВИШИВАЛЬНОМУ → ЗЕЛЕНИМ ═══');
const зелень = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobs['2000101'];
  const u = job.units[0];
  const d = D.dzNew();
  D.dzAttach(d, 'art@loomiq', 'test@loomiq');
  D.dzSend(d, 'test@loomiq');
  D.dzList(u, 'stitch').push(d);
  U.open('2000101');
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 300));
  const col = document.querySelector('.dz-u-col');
  return { колонка: col.className, номер: (document.querySelector('.dz-u-n') || {}).className,
           слово: ((col.querySelector('.dz-u-l i') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(зелень));
ok(/is-done/.test(зелень.колонка) && /is-done/.test(зелень.номер),
  'графіка позеленіла: робота пішла далі, до вишивального',
  'зеленого не сталось: ' + JSON.stringify(зелень));

console.log('\n═══ СУМА — З ПРАЙСУ, А НЕ З ГОЛОВИ ═══');
/* Доти сума бралась із `totalPrice` — поля, якого в приватних замовленнях
   немає: вони заводяться прямо у відділі, без прорахунку. Тобто в картці
   стояв нуль, а справжню суму менеджер тримав у голові. */
const гроші = await p.evaluate(() => {
  const z = [...document.querySelectorAll('.dz-z')]
    .filter(x => /Гроші/.test(x.textContent))[0];
  return {
    підпис: ((z.querySelector('.dz-z-s') || {}).textContent || '').trim(),
    рядки: [...z.querySelectorAll('.dz-sum-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    числа: [...z.querySelectorAll('.dz-money-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim())
  };
});
console.log('  ' + JSON.stringify(гроші.рядки));
console.log('  ' + JSON.stringify(гроші.числа));
/* 3 футболки по 700 (роздрібна з налаштувань) + худі по базовій ціні.
   Головне — що це рахунок зі складу, а не число 4850 з іншого місця. */
ok(гроші.рядки.length === 2 && /3 × 700/.test(гроші.рядки[0].replace(/ |\s/g, ' ')),
  'сума розкладена по позиціях складу: ' + гроші.рядки[0],
  'рядків суми немає: ' + JSON.stringify(гроші.рядки));
ok(!/4 ?850/.test(гроші.підпис),
  'і бере ціну з прайсу, а не давнє число з прорахунку',
  'сума й досі з totalPrice: ' + гроші.підпис);
ok(/Разом/.test(гроші.числа.join(' ')) && /Залишок/.test(гроші.числа.join(' ')),
  'разом і залишок до оплати стоять готовими — їх питають у мить відправки',
  'підсумків немає: ' + JSON.stringify(гроші.числа));

console.log('\n═══ ПЕРЕДОПЛАТУ ОБИРАЮТЬ, А НЕ ПИШУТЬ ═══');
/* Вписана рукою передоплата — це слово менеджера проти виписки. Вона
   сходиться, поки її пишуть уважно, і розходиться саме тоді, коли треба
   відповісти «а скільки вже прийшло». */
const пла = await p.evaluate(() => {
  const z = [...document.querySelectorAll('.dz-z')].filter(x => /Гроші/.test(x.textContent))[0];
  return {
    полеСуми: z.querySelectorAll('input[data-of="prepaid"]').length,
    привʼязані: [...z.querySelectorAll('.dz-pay-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    підписи: [...z.querySelectorAll('.dz-pay-r select option')].map(o => o.textContent),
    кнопка: ((z.querySelector('[data-do="pay-pick"]') || {}).textContent || '').trim()
  };
});
console.log('  ' + JSON.stringify(пла.привʼязані));
ok(!пла.полеСуми,
  'поля «впишіть передоплату» більше немає — суму не вигадують',
  'передоплату все ще можна вписати числом');
ok(пла.привʼязані.length === 1 && /900/.test(пла.привʼязані[0]),
  'привʼязаний платіж видно сумою й датою: ' + пла.привʼязані[0],
  'привʼязаних платежів не видно: ' + JSON.stringify(пла.привʼязані));
ok(['Передоплата','Оплата','Доплата','Наложка'].every(t => пла.підписи.indexOf(t) >= 0),
  'і кожен підписується: передоплата, оплата, доплата, наложка',
  'підписів платежу немає: ' + JSON.stringify(пла.підписи));
ok(/Привʼязати платіж/.test(пла.кнопка) && /2/.test(пла.кнопка),
  'вільні надходження полічені просто на кнопці: ' + пла.кнопка,
  'кнопки вибору платежу немає: ' + пла.кнопка);

/* Вибір платежу — списком із Фінансів. Витрата в нього не потрапляє:
   привʼязати мінус до замовлення означало б зменшити внесене. */
await p.evaluate(() => { document.querySelector('[data-do="pay-pick"]').click(); });
await p.waitForTimeout(400);
const вибір = await p.evaluate(() => [...document.querySelectorAll('.dz-pick-c.is-pay')]
  .map(c => c.textContent.replace(/\s+/g, ' ').trim()));
console.log('  ' + JSON.stringify(вибір));
ok(вибір.length === 2, 'у виборі рівно вільні надходження: ' + вибір.length,
   'у виборі не ті платежі: ' + JSON.stringify(вибір));
ok(!вибір.some(t => /−|-3ic20/.test(t) || /−\s?320/.test(t)),
  'витрата в список не потрапила — мінус у передоплату не привʼязують',
  'у виборі є витрата: ' + JSON.stringify(вибір));
await p.evaluate(() => { document.querySelectorAll('.dz-pick-c.is-pay')[0].click(); });
await p.waitForTimeout(900);
const після2 = await p.evaluate(() => {
  const z = [...document.querySelectorAll('.dz-z')].filter(x => /Гроші/.test(x.textContent))[0];
  return { привʼязано: z.querySelectorAll('.dz-pay-r').length,
           підпис: ((z.querySelector('.dz-z-s') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(після2));
ok(після2.привʼязано === 2,
  'обраний платіж став у картку — сума внесеного росте з виписки, а не з памʼяті',
  'платіж не привʼязався: ' + JSON.stringify(після2));

console.log('\n═══ ДАТА — КНОПКОЮ Й КАЛЕНДАРЕМ, БЕЗ РОКУ ═══');
/* «В дату ставимо тільки 08-09, не потрібно рік писати… можливо, одразу
   там якийсь випадаючий календар, щоб було зручно вибирати.» */
const дата = await p.evaluate(() => {
  const b = document.querySelector('[data-cal]');
  return { є: !!b, текст: b ? b.querySelector('b').textContent.trim() : '',
           поліДат: document.querySelectorAll('.dz-panel input[type="date"]').length };
});
console.log('  ' + JSON.stringify(дата));
ok(дата.є && /^\d{2}\.\d{2}$/.test(дата.текст),
  'дата стоїть коротко, без року: ' + дата.текст,
  'дата не в тому вигляді: ' + JSON.stringify(дата));
ok(!дата.поліДат,
  'і набирати її з клавіатури більше нема де — тільки календарем',
  'поле для набору дати лишилось: ' + дата.поліДат);
await p.evaluate(() => { document.querySelector('[data-cal]').click(); });
await p.waitForTimeout(350);
const кал = await p.evaluate(() => {
  const c = document.querySelector('.dz-cal');
  if(!c) return null;
  const r = c.getBoundingClientRect();
  return { днів: c.querySelectorAll('[data-cal-d]').length,
           обране: ((c.querySelector('.dz-cal-d.on') || {}).textContent || '').trim(),
           швидкі: [...c.querySelectorAll('[data-cal-plus]')].map(b => b.textContent.trim()),
           уВікні: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
});
console.log('  ' + JSON.stringify(кал));
ok(кал && кал.днів >= 28, 'календар відкрився місяцем: днів ' + (кал && кал.днів),
   'календар не відкрився');
ok(кал && кал.обране === '14',
  'і стоїть на вже обраній даті, а не на сьогодні',
  'обрана дата в календарі не позначена: ' + (кал && кал.обране));
ok(кал && кал.швидкі.length >= 2,
  'найчастіші відповіді готові: ' + (кал && кал.швидкі.join(', ')),
  'швидких відповідей немає');
ok(кал && кал.уВікні,
  'і він не виїжджає за край екрана',
  'календар вийшов за екран');
/* Обрали число — воно й стало. */
await p.evaluate(() => {
  const d = [...document.querySelectorAll('.dz-cal [data-cal-d]')]
    .filter(x => x.textContent.trim() === '21')[0];
  if(d) d.click();
});
await p.waitForTimeout(800);
const нова = await p.evaluate(() => ({
  кнопка: (document.querySelector('[data-cal] b') || {}).textContent.trim(),
  вЗадачі: (designJobs['2000101'] || {}).due
}));
console.log('  ' + JSON.stringify(нова));
ok(нова.кнопка === '21.10' && нова.вЗадачі === '2026-10-21',
  'обране число стало датою здачі й записалось: ' + нова.вЗадачі,
  'дата не змінилась: ' + JSON.stringify(нова));

console.log('\n═══ INSTAGRAM НА КАРТЦІ ДОШКИ ═══');
/* «Кнопочка горить ярко, гарно.» Доти вона була рожевим по майже білому —
   Андрій казав «не бачу я Instagram», і мав рацію. */
const іг = await p.evaluate(() => {
  const b = document.querySelector('.dz-card-ig');
  if(!b) return null;
  const s = getComputedStyle(b);
  return { фон: s.backgroundImage, колір: s.color, вага: s.fontWeight,
           всередині: !!b.closest('.dz-card-w') };
});
console.log('  ' + JSON.stringify(іг));
ok(іг && /gradient/.test(іг.фон),
  'кнопка розмови горить кольорами каналу, а не блідим рожевим',
  'кнопка Instagram і досі бліда: ' + JSON.stringify(іг));
ok(іг && /255, 255, 255/.test(іг.колір),
  'напис на ній білий — читається з першого погляду',
  'напис не білий: ' + (іг && іг.колір));
ok(іг && іг.всередині,
  'і лежить усередині картки, а не окремим шматком під нею',
  'кнопка виїхала з картки');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad
                : '\nкартка читається зонами, передача світиться, гроші йдуть із прайсу');
process.exit(bad ? 1 : 0);
