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
/* Та сама людина вже замовляла — інакше три цифри в шапці нічого не важать:
   «Замовлень 1 · за весь час стільки ж, скільки зараз» перевіряє тільки те,
   що ми вміємо переписати одне число двічі. */
const OLD_ORDER = {
  id:'2', orderId:'1000007', type:'client', name:'Оксана', phone:'+380670000042',
  company:'Кава Друзі', status:'done', site:'main', payments:[], items:[],
  createdAt:new Date(Date.now() - 90 * 864e5).toISOString(),
  hist:[{ s:'done', at:new Date(Date.now() - 80 * 864e5).toISOString() }],
  totalPrice:8000, totalCost:5000, margin:3000, marginPct:37.5
};
/* Що клієнт обрав у КП: 12 футболок, кепку теж 12 і ДРУГЕ худі — чорне.
   Клієнт нічого не натиснув (`state` немає) — підтверджує менеджер. */
const OFFER = { tok1:{ selection:{
  qty:{ 0:12 }, reco:[0], recoQty:{ 0:12 }, variant:{ g1:1 }, varQty:{ g1:12 } } } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER, OLD_ORDER]) + ';\n' +
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
await p.click('.ticket:has-text("1000042")');
await p.waitForTimeout(1500);

console.log('═══ ШАПКА ═══');
const head = await p.evaluate(() => {
  const t = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  const g = el => getComputedStyle(el);
  const st = document.querySelector('.od-head .od-pill-st');
  const mgr = document.querySelector('.od-head .od-pill-mgr');
  const box = el => el.getBoundingClientRect();
  const head = document.querySelector('.od-head');
  return {
    name: t(document.querySelector('.od-cl-nm')),
    chan: t(document.querySelector('.od-cl-ch')),
    stats: [...document.querySelectorAll('.od-stat')]
      .map(x => [t(x.querySelector('span')), t(x.querySelector('b'))]),
    oid: t(document.querySelector('.od-meta .od-oid-b')),
    meta: t(document.querySelector('.od-meta')),
    due: (document.querySelector('.od-head .od-due-inp') || {}).value,
    /* Етап — смугою на всю ширину шапки, і це єдине кольорове місце. */
    stWide: !!st && box(st).width > box(head).width - 46,
    stBg: st ? g(st).backgroundColor : null,
    mgrWide: !!mgr && Math.abs(box(mgr).width - box(st).width) < 2,
    /* Решта шапки тримає один фон: колір тут має рівно одне значення. */
    others: [...head.querySelectorAll('.od-stat, .od-meta, .od-cl-nm')]
      .map(x => g(x).backgroundColor)
  };
});
console.log('  ' + head.name + ' · ' + head.chan);
head.stats.forEach(x => console.log('  ' + x[0] + ': ' + x[1]));
console.log('  ' + head.meta);
ok(head.name === 'Оксана' && /Instagram/.test(head.chan || ''),
  'імʼя клієнта — заголовком картки, під ним канал',
  'шапка не каже, хто це: ' + JSON.stringify([head.name, head.chan]));
/* Три цифри — вага клієнта. Рахуються ВКЛЮЧНО з поточним замовленням: це вся
   історія людини, а не залишок після відрахування. 8 000 + 5 000. */
ok(head.stats.length === 3 &&
   /Замовлень/.test(head.stats[0][0]) && head.stats[0][1] === '2' &&
   /13\D?000/.test(head.stats[1][1]) && /5\D?000/.test(head.stats[2][1]),
  'три цифри: замовлень 2 · за весь час 13 000 ₴ · це замовлення 5 000 ₴',
  'цифри не ті: ' + JSON.stringify(head.stats));
ok(head.stWide && head.mgrWide,
  'етап і відповідальний — смугами на всю ширину шапки',
  'смуги не на всю ширину: ' + JSON.stringify([head.stWide, head.mgrWide]));
ok(head.others.every(c => c === head.others[0]) && head.stBg !== head.others[0],
  'кольорове місце в шапці рівно одне — етап',
  'кольору в шапці більше, ніж етап: ' + JSON.stringify(head.others));
ok(head.oid === '1000042' && /30\.08|\d\d\.\d\d/.test(head.meta || '') &&
   head.due === '2026-12-01',
   'номер, дата й термін — дрібним рядком з іконками',
   'рядок міток неповний: ' + JSON.stringify(head.meta));

/* Історія клієнта розгортається з шапки: доти вона лежала окремим блоком
   «Повторний клієнт» аж під складом замовлення. */
await p.click('[data-hist]');
await p.waitForTimeout(700);
const hist = await p.evaluate(() => [...document.querySelectorAll('.od-hist-l button')]
  .map(b => b.textContent.replace(/\s+/g, ' ').trim()));
console.log('  історія: ' + JSON.stringify(hist));
ok(hist.length === 1 && /1000007/.test(hist[0]) && /8\D?000/.test(hist[0]),
  'історія показує попереднє замовлення цього клієнта з сумою',
  'історії немає: ' + JSON.stringify(hist));

console.log('');
console.log('═══ ПОРЯДОК РОЗДІЛІВ ═══');
/* Порядок читається як порядок питань: що з цим далі → що памʼятати → і аж
   потім усе важке, розкладене по смугах. */
const order = await p.evaluate(() => ({
  top: [...document.querySelectorAll('.od-body > .od-sec')]
    .map(x => x.textContent.replace(/\s+/g, ' ').trim().split(' · ')[0]),
  folds: [...document.querySelectorAll('.od-folds .od-fold-t')].map(x => x.textContent.trim()),
  /* Смуги мають виглядати однаково: одна висота, один радіус, один фон.
     Різнобій тут читається як «ці розділи чимось різні», хоч вони не різні. */
  h: [...new Set([...document.querySelectorAll('.od-folds .od-fold-h')]
      .map(x => Math.round(x.getBoundingClientRect().height)))],
  r: [...new Set([...document.querySelectorAll('.od-folds .od-fold')]
      .map(x => getComputedStyle(x).borderRadius))],
  bg: [...new Set([...document.querySelectorAll('.od-folds .od-fold')]
      .map(x => getComputedStyle(x).backgroundColor))],
  shut: [...document.querySelectorAll('.od-folds .od-fold-b')].every(x => x.hasAttribute('hidden'))
}));
console.log('  зверху: ' + order.top.join(' → '));
console.log('  смуги: ' + order.folds.join(' · '));
/* Нагадування й нотатка лишаються відкритими: це щоденне, і сховане під
   смугу його просто не відкриють. */
ok(order.top.join('|') === 'Нагадування|Нотатка менеджера',
  'над смугами лишились тільки нагадування й нотатка — щоденне не ховаємо',
  'зверху не те: ' + JSON.stringify(order.top));
ok(order.folds.join('|') ===
   'Інформація про клієнта|Товари|Додаткові продажі|Оплата|Фінанси|Що відбувалось',
  'смуги йдуть у порядку питань до замовлення',
  'смуги не ті: ' + JSON.stringify(order.folds));
ok(order.h.length === 1 && order.r.length === 1 && order.bg.length === 1,
  'усі смуги однакові: висота ' + order.h[0] + ', радіус ' + order.r[0],
  'смуги різні: ' + JSON.stringify([order.h, order.r, order.bg]));
ok(order.shut,
  'усе згорнуте — картка відкривається як список питань, а не як стос коробок',
  'якась смуга відкрита одразу');
/* Кожна смуга каже підсумком, чи є в ній що читати: інакше їх доводиться
   відкривати по черзі, щоб це зʼясувати. */
const sums = await p.evaluate(() => [...document.querySelectorAll('.od-folds .od-fold')]
  .map(f => [(f.querySelector('.od-fold-t')||{}).textContent.trim(),
             (f.querySelector('.od-fold-n')||{textContent:''}).textContent.replace(/\s+/g,' ').trim()]));
sums.forEach(x => console.log('    ' + x[0].padEnd(24) + x[1]));
ok(sums.every(x => x[1]),
  'кожна смуга каже підсумком, що всередині',
  'є німа смуга: ' + JSON.stringify(sums.filter(x => !x[1])));
/* Найважливіший підсумок: «Товари» рахують ТІЛЬКИ склад замовлення, а
   рекомендації й варіанти живуть окремою смугою. */
ok(/1 позиц/.test((sums.find(x => x[0] === 'Товари') || [])[1] || '') &&
   /1 рекомендовано · 2 на вибір/.test((sums.find(x => x[0] === 'Додаткові продажі') || [])[1] || ''),
  'товари й додаткові продажі рахуються окремо: 1 позиція проти 1+2',
  'рахунок змішався: ' + JSON.stringify(sums.slice(1, 3)));

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
console.log('═══ ТОВАРИ Й РОЗМІРИ ═══');
await p.click('[data-fold="goods"]');
await p.waitForTimeout(900);
const sizes = await p.evaluate(() => {
  const sz = document.querySelector('.od-sz');
  const cells = sz ? [...sz.querySelectorAll('.od-sz-i')] : [];
  const box = el => el.getBoundingClientRect();
  return {
    open: !document.querySelector('[data-fold="goods"]').nextElementSibling.hasAttribute('hidden'),
    list: cells.map(c => c.querySelector('span').textContent.trim()),
    note: sz ? (sz.querySelector('.od-sz-h span') || {}).textContent.replace(/\s+/g, ' ').trim() : null,
    /* Колонка: підпис зверху, поле під ним. */
    stacked: cells.every(c => box(c.querySelector('span')).bottom <= box(c.querySelector('input')).top + 1),
    /* Усі колонки на одній лінії й однакової ширини — інакше ряд читається
       як список, а не як розмірна сітка. */
    tops: [...new Set(cells.map(c => Math.round(box(c).top)))].length,
    widths: [...new Set(cells.map(c => Math.round(box(c).width)))].length,
    /* У «Товарах» лежить тільки склад: рекомендацію й варіанти видно в
       сусідній смузі, і сплутати їх зі складом уже не можна. */
    names: [...document.querySelectorAll('[data-fold="goods"] ~ .od-fold-b .t-web-name')]
      .map(x => x.textContent.replace(/\s+/g, ' ').trim())
  };
});
console.log('  позиції: ' + JSON.stringify(sizes.names));
console.log('  розміри: ' + JSON.stringify(sizes.list) + ' · ' + JSON.stringify(sizes.note));
ok(sizes.open, 'смуга відкривається кліком', 'смуга не відкрилась');
ok(sizes.names.length === 1 && /Футболка/.test(sizes.names[0]),
  'у «Товарах» лише склад замовлення, без рекомендацій і варіантів',
  'у товари попала пропозиція: ' + JSON.stringify(sizes.names));
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
/* Порядок розмірів — з сітки, а не з порядку набору. */
ok(/S×2 · M×4 · L×4/.test(done.meta),
  'розкладка читається в порядку сітки: S×2 · M×4 · L×4',
  'порядок розмірів не той: ' + JSON.stringify(done.meta));

console.log('');
console.log('═══ ЩО ЙДЕ ПІДРЯДНИКУ ═══');
/* Закупівля живе у «Фінансах»: це наші гроші, і менеджер без прав на
   собівартість цієї смуги не бачить узагалі. */
await p.click('[data-fold="fin"]');
await p.waitForTimeout(900);
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
console.log('═══ ПОВІДОМЛЕННЯ КЛІЄНТУ ═══');
/* У шапці КП лишились тільки дії з посиланням. Готового повідомлення тут
   немає навмисно: його не надсилають із пропозиції — його надсилають у
   діалозі, і правлять теж там, у заготовках. */
const oe = await p.evaluate(() => ({
  copy: !!document.querySelector('#offerEd [data-oe="copy"]'),
  msg: !!document.querySelector('#offerEd [data-oe="copymsg"]'),
  pen: !!document.querySelector('#offerEd [data-oe="editmsg"]'),
  out: offerShareText(offerEdOrder()),
  link: offerUrl(offerEdOrder())
}));
ok(oe.copy && !oe.msg && !oe.pen,
  'у шапці КП лишились дії з посиланням, а тексту повідомлення там немає',
  'у КП лишилось редагування тексту: ' + JSON.stringify(oe));
ok(oe.out.indexOf(oe.link) >= 0,
  'кнопка «💬» на картці бере текст із заготовки, з живим посиланням',
  'посилання не підставилось: ' + JSON.stringify(oe.out.slice(0, 80)));

/* Правка заготовки — і той самий текст іде звідусіль. Раніше він був
   зашитий у код окремо від заготовки в чаті, і клієнт міг отримати два
   різні листи залежно від того, звідки менеджер натиснув. */
const edited = await p.evaluate(async () => {
  const list = quickReplies().map(q => ({ t:q.t, m:q.m }));
  const i = list.findIndex(q => String(q.m || '').indexOf('{кп}') >= 0);
  list[i] = { t:'Надсилаю КП', m:'Оксано, як домовлялись — ось пропозиція:\n{кп}' };
  await qrStore(list);
  return { out: offerShareText(offerEdOrder()), noOffer: offerShareText({}) };
});
console.log('  ' + JSON.stringify(edited.out));
ok(/як домовлялись/.test(edited.out) && edited.out.indexOf(oe.link) >= 0,
  'правлена заготовка стала тим текстом, що копіюється з картки',
  'текст не змінився: ' + JSON.stringify(edited.out));
/* Замовлення без КП не має давати листа «дивіться пропозицію», у якому
   нічого відкрити. */
ok(edited.noOffer === '',
  'без пропозиції повідомлення не збирається взагалі',
  'зібрали повідомлення без посилання: ' + JSON.stringify(edited.noOffer));

console.log('');
console.log('═══ ЩО ЗАПИСАЛОСЬ ПІСЛЯ ПІДТВЕРДЖЕННЯ ═══');

await p.click('#offerEd [data-oe="mgrok"]');
await p.waitForTimeout(2200);
await p.click('#offerEd [data-oe="done"]');
await p.waitForTimeout(1500);
const after = await p.evaluate(() => {
  const t = s2 => { const el = document.querySelector(s2);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  return {
    pick: t('.od-pick'),
    /* «Це замовлення» — третя цифра шапки. Після підтвердження вона має
       показати перерахований склад, а не те, що менеджер запропонував. */
    sum: t('.od-stat:nth-child(3) b'),
    life: t('.od-stat:nth-child(2) b'),
    stage: (document.querySelector('.od-stage') || {}).value,
    buy: [...document.querySelectorAll('.od-buy-li')].map(x => x.textContent.replace(/\s+/g, ' ').trim())
  };
});
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
/* І вага клієнта разом із нею: 8 000 старих + 18 600 нових. */
ok(/26\D?600/.test(after.life || ''),
  'за весь час теж перерахувалось: 26 600 ₴',
  'сума за весь час не оновилась: ' + after.life);
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
