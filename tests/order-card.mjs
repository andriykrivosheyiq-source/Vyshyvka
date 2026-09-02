/* Картка замовлення — робоче місце менеджера, а не звіт про замовлення.

   Раніше вона була складена за логікою даних: спершу все про товар, десь
   посередині — «Відповідальний», сума окремою плашкою вгорі, склад із
   розрахунком розгорнутий на пів екрана. Щоб відповісти на щоденні питання
   «хто це, на скільки, хто веде і що далі», доводилось прокручувати.

   Тепер порядок такий, як питання виникають:

     — у шапці номер, коли прийшло, етап і термін, а праворуч — хто веде;
     — клієнт і сума замовлення поруч: «хто це і на скільки» — одне питання;
     — склад із розрахунком згорнутий: його відкривають, коли працюють саме
       з ним;
     — у складі — розкладка по розмірах, і розбіжність із кількістю позиції
       сказана вголос, а не виправлена мовчки;
     — у замовлення, розрахунок і закупівлю йде ТІЛЬКИ підтверджене.

   Останнє тут головне. Рекомендації й варіанти на вибір лежать у тій самій
   картці: запропонували футболку, кепку й два худі — а клієнт узяв футболку,
   кепку й одне худі. Доти підрядникові летіли всі чотири позиції.

   Запуск:  node tests/order-card.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8798;
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
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

/* Довідники сайту: розмірна сітка (звідки картка бере розміри) і підрядники
   (до кого йде закупівля). Команду навмисно не заводимо — тоді роль
   «власник», і собівартість із закупівлею видно. */
const CONTENT = {
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'},{size:'XL'}] },
  suppliers:[{ id:'texug', name:'Текстиль-Юг' }, { id:'capmaster', name:'Кепка-Майстер' }]
};

const it = (kind, name, gid, sup, qty, up, uc, extra) => Object.assign({
  kind, name, garmentId:gid, sup, qty,
  unitPrice:up, price:up * qty, unitCost:uc, cost:uc * qty
}, extra || {});

/* Позиція основна одна, решта — пропозиція: кепка «на додачу» і двоє худі
   на вибір. */
const ORDER = {
  id:'1', orderId:'1000042', type:'client', name:'Оксана', phone:'+380670000042',
  company:'Кава Друзі', status:'kp', site:'main', dueAt:'2026-12-01',
  createdAt:new Date(Date.now() - 3 * 864e5).toISOString(),
  hist:[{ s:'kp', at:new Date(Date.now() - 2 * 864e5).toISOString() }],
  offerToken:'tok1', payments:[],
  totalPrice:5000, totalCost:3000, margin:2000, marginPct:40,
  items:[
    it('main',    'Футболка',   'tshirt', 'texug',     10, 500, 300, { sizeQty:{ S:2, M:4 } }),
    it('reco',    'Кепка',      'cap',    'capmaster', 10, 200, 120),
    it('variant', 'Худі синє',  'hoodie', 'texug',     10, 800, 480, { vgroup:'g1' }),
    it('variant', 'Худі чорне', 'hoodie', 'texug',     10, 850, 500, { vgroup:'g1' })
  ]
};
/* Що клієнт обрав у КП: 12 футболок, кепку теж 12 і ДРУГЕ худі — чорне.
   Клієнт нічого не натиснув (`state` немає) — підтверджує менеджер. */
const OFFER = { tok1:{ selection:{
  qty:{ 0:12 }, reco:[0], recoQty:{ 0:12 }, variant:{ g1:1 }, varQty:{ g1:12 } } } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__OFFERS=' + JSON.stringify(OFFER) + ';\n' +
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
  "      if(n==='offers') return new SeedCol(function(){\n" +
  '        return Object.keys(window.__OFFERS).map(function(k){\n' +
  '          var v=window.__OFFERS[k]; v.id=k; return v; }); });\n' +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.click('.ticket');
await p.waitForTimeout(1500);

console.log('═══ ШАПКА ═══');
const head = await p.evaluate(() => {
  const pills = [...document.querySelectorAll('.od-head-top .od-pill')];
  const g = el => getComputedStyle(el);
  const box = el => el.getBoundingClientRect();
  const oid = document.querySelector('.od-pill-oid');
  const mgr = document.querySelector('.od-pill-mgr');
  const st = document.querySelector('.od-pill-st');
  const due = document.querySelector('.od-head .od-due-inp');
  return {
    n: pills.length,
    txt: pills.map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 24)),
    /* Уніфікація — це не «схоже», а «однаково»: одна висота, один радіус,
       один кегль. Різниця в пікселі читається як недбалість. */
    h: [...new Set(pills.map(x => Math.round(box(x).height)))],
    r: [...new Set(pills.map(x => g(x).borderRadius))],
    fs: [...new Set(pills.map(x => g(x).fontSize))],
    /* Кольором виділяємо тільки те, що потребує акценту. Нейтральні фони
       беремо з самих таблеток — і вимагаємо, щоб з них вибивалась рівно
       одна, зі статусом. */
    bg: pills.map(x => g(x).backgroundColor),
    stBg: st ? g(st).backgroundColor : null,
    age: (document.querySelector('.od-pill-st .od-pill-age') || {}).textContent || '',
    /* Пʼять таблеток у вузькій панелі в один ряд не стають — і не мусять.
       Важливо інше: відповідальний тримається правого краю шапки, а не
       губиться десь посеред ряду. */
    mgrInHead: !!(mgr && document.querySelector('.od-head-top').contains(mgr)),
    mgrRight: !!mgr && pills.every(x => x === mgr || box(x).right <= box(mgr).right + 1),
    mgrLast: !!(mgr && oid) && box(mgr).top >= box(oid).top,
    due: due ? due.value : null,
    mgrTwice: document.querySelectorAll('.od-mgr-sel').length
  };
});
console.log('  ' + head.txt.join(' | '));
console.log('  висота ' + head.h.join('/') + ' · радіус ' + head.r.join('/') +
            ' · кегль ' + head.fs.join('/'));
ok(head.h.length === 1 && head.r.length === 1 && head.fs.length === 1,
  'усі таблетки шапки однакові: висота ' + head.h[0] + ', радіус ' + head.r[0] +
    ', кегль ' + head.fs[0],
  'таблетки різні: висоти ' + head.h.join('/') + ', радіуси ' + head.r.join('/') +
    ', кеглі ' + head.fs.join('/'));
ok(head.bg.filter(c => c !== head.stBg).length === head.n - 1 &&
   new Set(head.bg.filter(c => c !== head.stBg)).size === 1,
  'кольорова в шапці рівно одна таблетка — етап; решта тримає один нейтральний фон',
  'кольорових таблеток більше однієї: ' + JSON.stringify(head.bg));
ok(head.mgrInHead && head.mgrRight && head.mgrLast,
  'відповідальний — у шапці, притиснутий до правого краю',
  'відповідального в шапці немає або він не праворуч: ' + JSON.stringify(head));
ok(head.mgrTwice === 1,
  'вибір відповідального в картці один',
  'вибір відповідального дублюється: ' + head.mgrTwice);
ok(/1000042/.test(head.txt.join(' ')) && head.txt.some(t => /\d\d\.\d\d/.test(t)) &&
   head.due === '2026-12-01',
  'у шапці номер, дата звернення і термін здачі',
  'шапка неповна: ' + JSON.stringify(head.txt));
/* Скільки картка стоїть в етапі — тут же, у таблетці статусу. Раніше цей
   сигнал вимагав окремого блоку під шапкою. */
ok(/дн|сьогодні/.test(head.age),
  'скільки стоїть в етапі — усередині таблетки статусу: «' + head.age.trim() + '»',
  'строку в таблетці статусу немає');

console.log('');
console.log('═══ КЛІЄНТ І СУМА ═══');
const cli = await p.evaluate(() => {
  const box = document.querySelector('.od-cli');
  const sum = document.querySelector('.od-cli-sum');
  return {
    fields: box ? [...box.querySelectorAll('.od-fields .od-f')].map(i => i.getAttribute('data-f')) : null,
    sum: sum ? sum.textContent.replace(/\s+/g, ' ').trim() : null,
    right: !!(box && sum) && sum.getBoundingClientRect().left >
           box.querySelector('.od-fields').getBoundingClientRect().left,
    old: !!document.querySelector('.od-sum')
  };
});
console.log('  поля: ' + JSON.stringify(cli.fields) + ' · сума: ' + JSON.stringify(cli.sum));
ok((cli.fields || []).join(',') === 'name,phone,company',
  'поля клієнта лишились ті самі — ми нічого в них не міняли',
  'поля клієнта змінились: ' + JSON.stringify(cli.fields));
ok(/5\D?000/.test(cli.sum || '') && cli.right,
  'сума замовлення стоїть праворуч від клієнта: «хто це і на скільки» — одне питання',
  'суми біля клієнта немає: ' + JSON.stringify(cli));
ok(!cli.old,
  'окремої плашки з сумою більше немає — одна сума в одному місці',
  'стара плашка суми лишилась');

console.log('');
console.log('═══ ПОРЯДОК БЛОКІВ ═══');
/* Порядок читається як порядок питань: хто це і на скільки → що з цим далі
   → що памʼятати → і аж потім склад із розрахунком. */
const order = await p.evaluate(() => [...document.querySelectorAll('.od-body > .od-sec, .od-body > .od-fold')]
  .map(x => x.classList.contains('od-fold')
    ? (x.querySelector('.od-fold-t') || {}).textContent.trim()
    : x.textContent.replace(/\s+/g, ' ').trim().split(' · ')[0]));
console.log('  ' + order.slice(0, 5).join(' → '));
ok(order.slice(0, 4).join('|') === 'Клієнт|Нагадування|Нотатка менеджера|Замовлення та розрахунок',
  'блоки йдуть у порядку питань: клієнт → нагадування → нотатка → склад',
  'порядок не той: ' + order.slice(0, 5).join(' → '));
/* Порожній блок нагадувань — це один рядок, а не картка в рамці: доти на
   його місці стояли дві («Наступна дія» і «Задачі») незалежно від того, чи
   є там що читати. */
const rem = await p.evaluate(() => {
  const b = document.querySelector('.od-rem');
  const note = document.querySelector('.od-note');
  return { h: b ? Math.round(b.getBoundingClientRect().height) : null,
    rows: document.querySelectorAll('.rem-row').length,
    noteRows: note ? +note.getAttribute('rows') : null,
    old: !!document.querySelector('.od-deal') || !!document.querySelector('.od-next') };
});
console.log('  порожні нагадування: ' + rem.h + 'px · нотатка: ' + rem.noteRows + ' рядки');
ok(!rem.old,
  'блоків «Стан угоди» і «Наступна дія» в картці немає',
  'старі блоки лишились');
/* Дві старі картки — «Наступна дія» й «Задачі» — займали під 260 px
   незалежно від того, чи є в них що читати. */
ok(rem.rows === 0 && rem.h > 0 && rem.h < 120,
  'порожній блок нагадувань — коментар і рядок «коли» (' + rem.h + 'px)',
  'порожній блок нагадувань завеликий: ' + rem.h + 'px');
ok(rem.noteRows === 2,
  'нотатка починається з двох рядків і росте під текст',
  'нотатка одразу займає ' + rem.noteRows + ' рядків');

await p.fill('.rem-in', 'передзвонити щодо розмірного ряду');
await p.fill('.rem-tm', '14:00');
await p.click('.rem-go');
await p.waitForTimeout(1300);
const remRow = await p.evaluate(() => {
  const r = document.querySelector('.rem-row');
  return r ? r.textContent.replace(/\s+/g, ' ').trim() : '';
});
console.log('  ' + remRow);
ok(/розмірного ряду/.test(remRow) && /14:00/.test(remRow),
  'нагадування — коментар, дата й час одним рядком',
  'нагадування не записалось: ' + JSON.stringify(remRow));

console.log('');
console.log('═══ СКЛАД І РОЗРАХУНОК ═══');
const foldShut = await p.evaluate(() => {
  const b = document.querySelector('.od-fold-b');
  return { hidden: !b || b.hasAttribute('hidden'),
    head: (document.querySelector('.od-fold-h') || {}).textContent.replace(/\s+/g, ' ').trim() };
});
console.log('  ' + JSON.stringify(foldShut.head));
ok(foldShut.hidden,
  'склад із розрахунком згорнутий — щодня з картки потрібні клієнт, стан і наступна дія',
  'склад розгорнутий і відсуває все інше вниз');
/* Згорнутий блок мусить сам сказати, що в ньому: інакше його не відкриють. */
ok(/4 позиц/i.test(foldShut.head) && /5\D?000/.test(foldShut.head),
  'згорнутий блок каже, скільки позицій і на яку суму',
  'заголовок згорнутого блоку мовчить: ' + JSON.stringify(foldShut.head));

await p.click('[data-goods-toggle]');
await p.waitForTimeout(900);
const sizes = await p.evaluate(() => {
  const b = document.querySelector('.od-fold-b');
  const sz = document.querySelector('.od-sz');
  const cells = sz ? [...sz.querySelectorAll('.od-sz-i')] : [];
  const box = el => el.getBoundingClientRect();
  return {
    open: b && !b.hasAttribute('hidden'),
    list: cells.map(c => c.querySelector('span').textContent.trim()),
    note: sz ? (sz.querySelector('.od-sz-h span') || {}).textContent.replace(/\s+/g, ' ').trim() : null,
    boxes: document.querySelectorAll('[data-sz-item]').length,
    /* Колонка: підпис зверху, поле під ним. */
    stacked: cells.every(c => box(c.querySelector('span')).bottom <= box(c.querySelector('input')).top + 1),
    /* Усі колонки на одній лінії й однакової ширини — інакше ряд читається
       як список, а не як розмірна сітка. */
    tops: [...new Set(cells.map(c => Math.round(box(c).top)))].length,
    widths: [...new Set(cells.map(c => Math.round(box(c).width)))].length
  };
});
console.log('  розміри: ' + JSON.stringify(sizes.list) + ' · ' + JSON.stringify(sizes.note));
ok(sizes.open, 'блок відкривається кліком', 'блок не відкрився');
ok((sizes.list || []).join(',') === 'S,M,L,XL',
  'розміри взяті з розмірної сітки товару — того самого джерела, що й на сайті',
  'розмірів немає або вони не з сітки: ' + JSON.stringify(sizes.list));
/* Так само, як розмірний ряд на самому сайті: назва зверху, кількість під
   нею. Горизонтальними парами «S 2 · M 4 · L 0» ряд читався суцільним
   рядком цифр, і потрібний розмір доводилось шукати пальцем. */
ok(sizes.stacked && sizes.tops === 1 && sizes.widths === 1,
  'розміри стоять колонками в один ряд: назва зверху, кількість під нею',
  'розміри не колонками: ' + JSON.stringify({ stacked:sizes.stacked,
    рядків:sizes.tops, ширин:sizes.widths }));
/* Менеджер знає «50 футболок» раніше, ніж клієнт пришле розмірний ряд.
   Тому розбіжність не виправляємо мовчки — кажемо її вголос. */
ok(/6\D+10/.test(sizes.note || '') && /лишилось 4/.test(sizes.note || ''),
  'розбіжність розмірів і кількості сказана вголос: розписано 6 із 10, лишилось 4',
  'про розбіжність мовчимо: ' + JSON.stringify(sizes.note));

/* Дописуємо розмір — рахунок має зійтись і сказати про це. */
await p.fill('[data-sz-item="0"][data-sz="L"]', '4');
await p.locator('[data-sz-item="0"][data-sz="L"]').blur();
await p.waitForTimeout(1200);
const done = await p.evaluate(() => ({
  note: (document.querySelector('.od-sz-h span') || {}).textContent.replace(/\s+/g, ' ').trim(),
  cls: ((document.querySelector('.od-sz-h span') || {}).className || ''),
  meta: (document.querySelector('.t-web-meta') || {}).textContent.replace(/\s+/g, ' ').trim()
}));
console.log('  дописали L×4: ' + JSON.stringify(done.note) + ' · ' + JSON.stringify(done.meta));
ok(/розписано 10 із 10/.test(done.note) && done.cls === 'ok',
  'розписали всі 10 — розбіжність зникла',
  'рахунок не зійшовся: ' + JSON.stringify(done));
/* Порядок розмірів — з сітки, а не з порядку набору: «S · M · L», а не
   «S · M» і десь у кінці L. */
ok(/S×2 · M×4 · L×4/.test(done.meta),
  'розкладка читається в порядку сітки: S×2 · M×4 · L×4',
  'порядок розмірів не той: ' + JSON.stringify(done.meta));

console.log('');
console.log('═══ ЩО ЙДЕ ПІДРЯДНИКУ ═══');
const buy = () => p.evaluate(() => [...document.querySelectorAll('.od-buy-li')]
  .map(x => x.textContent.replace(/\s+/g, ' ').trim()));
const b0 = await buy();
b0.forEach(l => console.log('  ' + l));
ok(b0.length === 1 && /Футболка/.test(b0[0]),
  'до підтвердження в закупівлю йде лише основна позиція, а не вся пропозиція',
  'у закупівлю попала пропозиція: ' + JSON.stringify(b0));

console.log('');
console.log('═══ ПІДТВЕРДИВ МЕНЕДЖЕР ═══');
/* Кнопки на картці більше немає: підтверджують, дивлячись на саме КП, а не
   наосліп із картки. Тому спершу відкриваємо пропозицію. */
ok(await p.evaluate(() => !document.querySelector('[data-mgr-confirm]')),
  'на картці кнопки «Підтвердити за клієнта» немає — вона живе в самому КП',
  'кнопка лишилась на картці');
await p.click('[data-act="offered"]');
await p.waitForTimeout(2500);
ok(await p.evaluate(() => !!document.querySelector('#offerEd [data-oe="mgrok"]')),
  'у шапці КП є «Підтвердити за клієнта»',
  'у КП кнопки підтвердження немає');

console.log('');
console.log('═══ ТЕКСТ ПОВІДОМЛЕННЯ ═══');
/* Олівець біля «Повідомлення клієнту»: текст правиться там, де його й
   надсилають. Доти він був один на всі КП і правився вже в месенджері,
   після вставки, — тобто щоразу заново. */
await p.click('#offerEd [data-oe="editmsg"]');
await p.waitForTimeout(700);
const msg0 = await p.evaluate(() => {
  const t = document.querySelector('#offerEd .oe-msg-t');
  return { txt: t ? t.value : null, link: offerUrl(offerEdOrder()) };
});
ok(!!msg0.txt && msg0.link && msg0.txt.indexOf(msg0.link) >= 0,
  'у полі стоїть готовий текст із живим посиланням — видно рівно те, що піде клієнту',
  'у полі не текст повідомлення: ' + JSON.stringify((msg0.txt || '').slice(0, 60)));
/* Повідомлення без посилання — це лист «дивіться пропозицію», у якому
   нічого відкрити. Помітив би це першим клієнт, тож не зберігаємо. */
await p.fill('#offerEd .oe-msg-t', 'Оксано, дивіться пропозицію');
await p.click('#offerEd [data-msg="save"]');
await p.waitForTimeout(900);
ok(await p.evaluate(() => !!document.querySelector('#offerEd .oe-msg') &&
                          !(offerEdOrder() || {}).shareMsg),
  'текст без посилання не зберігається — клієнту не було б що відкрити',
  'зберегли повідомлення без посилання');

await p.fill('#offerEd .oe-msg-t', 'Оксано, як домовлялись — ось пропозиція:\n' + msg0.link);
await p.click('#offerEd [data-msg="save"]');
await p.waitForTimeout(1200);
const msg1 = await p.evaluate(() => {
  const o = offerEdOrder();
  return { saved: o.shareMsg || '', out: offerShareText(o),
    open: !!document.querySelector('#offerEd .oe-msg'),
    head: (document.querySelector('#offerEd .oe-head') || {}).textContent || '' };
});
console.log('  збережено: ' + JSON.stringify(msg1.saved));
console.log('  піде клієнту: ' + JSON.stringify(msg1.out));
ok(!msg1.open && /як домовлялись/.test(msg1.out),
  'правлений текст збережено — саме він і копіюється',
  'текст не зберігся: ' + JSON.stringify(msg1.out.slice(0, 80)));
/* Посилання лягає назад підстановкою, а не застигає текстом: інакше воно
   колись перестане відповідати документу, і ніхто цього не помітить. */
ok(msg1.saved.indexOf('{кп}') >= 0 && msg1.saved.indexOf(msg0.link) < 0,
  'у замовленні лежить підстановка {кп}, а не застигла адреса',
  'адреса застигла в тексті: ' + JSON.stringify(msg1.saved));
ok(msg1.out.indexOf(msg0.link) >= 0,
  'а клієнту йде текст із живим посиланням',
  'посилання не підставилось: ' + JSON.stringify(msg1.out));
await p.click('#offerEd [data-oe="mgrok"]');
await p.waitForTimeout(2200);
await p.click('#offerEd [data-oe="done"]');
await p.waitForTimeout(1500);
const after = await p.evaluate(() => ({
  pick: (document.querySelector('.od-pick') || {}).textContent.replace(/\s+/g, ' ').trim() || '',
  sum: (document.querySelector('.od-cli-sum b') || {}).textContent.replace(/\s+/g, ' ').trim(),
  stage: (document.querySelector('.od-stage') || {}).value,
  buy: [...document.querySelectorAll('.od-buy-li')].map(x => x.textContent.replace(/\s+/g, ' ').trim())
}));
after.buy.forEach(l => console.log('  ' + l));
console.log('  сума: ' + after.sum + ' · етап: ' + after.stage);
ok(after.stage === 'new',
  'підтверджене замовлення само перейшло в «Чекаємо оплату»',
  'етап не змінився: ' + after.stage);
/* 12 футболок + 12 кепок + 12 худі ЧОРНИХ. Синє худі клієнт не брав — і в
   закупівлю воно йти не має, хоч і лишається в картці. */
ok(after.buy.length === 3 && after.buy.some(l => /Худі чорне/.test(l)) &&
   !after.buy.some(l => /Худі синє/.test(l)),
  'підрядникові йде рівно те, що взяв клієнт: обране худі є, друге — ні',
  'у закупівлю попало не те: ' + JSON.stringify(after.buy));
ok(after.buy.every(l => /12 шт/.test(l)),
  'кількості теж із КП: клієнт узяв по 12, а не по 10',
  'кількості лишились старими: ' + JSON.stringify(after.buy));
/* 12×500 + 12×200 + 12×850 = 18 600 */
ok(/18\D?600/.test(after.sum || ''),
  'сума замовлення перерахована по підтвердженому складу: 18 600 ₴',
  'сума не перерахувалась: ' + after.sum);
/* Підпис «хто і коли зафіксував склад» стоїть під самим складом, а не за
   два екрани від нього. */
ok(/Склад підтверджено/.test(after.pick),
  'у блоці складу видно, що його підтверджено і ким',
  'про підтвердження не сказано: ' + after.pick.slice(0, 120));

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'картка відповідає на щоденні питання згори вниз, а підряднику йде тільки підтверджене');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
