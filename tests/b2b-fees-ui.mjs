/* Разові за дизайн — повний цикл очима менеджера.

   Андрій: «ціна скаче: перезайшов, нічого не змінював — інша ціна»;
   «на лівій панелі й у прорахунку різні цифри»; «поставив напис, оновив —
   і воно знову збилося»; «логотип у нових товарах білий, тут бежевий —
   та сама картинка».

   Проходимо рівно той шлях, яким іде менеджер:
     1. збирає в конструкторі два світшоти по 2 шт: спереду той самий логотип
        (на другому — перефарбований), ззаду в першого інший логотип, у
        другого — напис;
     2. зберігає — позиція йде через справжнє збереження адмінки
        (__adminSaveClientOrder), з тим самим відсіюванням полів, що в базу;
     3. «перезавантажує» — замовлення проходить через JSON, як через Firestore;
     4. відкриває кожну позицію знову й дивиться прорахунок;
     5. перемикає логотип на «не рахувати», потім на «напис», потім назад —
        і щоразу зберігає, перезавантажує, відкриває сусідню позицію.

   На кожному кроці збігатись мусить усе: ціна в конструкторі, ціна в лівій
   панелі (адмінка після перерахунку), рядки «Як склалась ціна», і ціна
   після повторного відкриття.

   Запуск:  node tests/b2b-fees-ui.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8893;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.jpg':'image/jpeg', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
                         'Access-Control-Allow-Origin':'*' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0, total = 0;
const ok = (c, g, w) => { total++; console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');

const PRICING = {
  methods:{ embro:{ orderFee:850, orderCost:300, sketchFee:350, sketchCost:150,
    pieceFee:0, pieceCost:0, pricePer1000mm2:30, costPer1000mm2:6, minPrice:300,
    text:{ orderFee:480, orderCost:200, sketchFee:250, sketchCost:150,
           pricePer1000mm2:20, costPer1000mm2:5, minPrice:200 } } },
  tiers:[{ from:1, coef:1 }], garmentTiers:[{ from:1, coef:1 }] };

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const route = pg => pg.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({ contentType:'application/json', body:'{"fields":{}}' });
  return r.abort();
});

// ── Адмінка: вона зберігає позицію й рахує ліву панель ──
const A = await browser.newPage({ viewport:{ width:1400, height:950 } });
A.on('pageerror', e => errs.push('АДМІНКА: ' + e.message.slice(0, 170)));
await route(A);
await A.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await A.waitForTimeout(4000);
await A.evaluate(pr => {
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  contentLoaded = true;
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = contentData.pricing = pr;
  /* Хмара: кожне завантаження дає НОВУ адресу — як справжня. Це найгірший
     випадок для зведення за файлом, і саме його треба витримати. */
  let n = 0;
  window.uploadCloudinary = async v => 'https://cdn.test/up/' + (++n) + '.png';
  window.marginCheck = () => '';           // запобіжник маржі тут не про це
  window.toast = () => {};
}, PRICING);

// ── Конструктор: ним менеджер збирає й відкриває позиції ──
const C = await browser.newPage({ viewport:{ width:1300, height:1000 } });
C.on('pageerror', e => errs.push('КОНСТРУКТОР: ' + e.message.slice(0, 170)));
await route(C);
await C.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await C.waitForTimeout(5000);
await C.evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  window.__lqInline = true;
}, PRICING);
const gid = await C.evaluate(() => {
  const el = document.querySelector('[data-garment]');
  return el ? el.getAttribute('data-garment') : null;
});

const L  = HOST + '/' + encodeURI('кітель.png');          // логотип
const L2 = HOST + '/' + encodeURI('фартух  бежевий.png'); // той самий, перефарбований (інші пікселі)
const X  = HOST + '/' + encodeURI('кітель 01.png');       // інший логотип
const lay = (id, extra) => Object.assign({ id, scale:1, frac:0.25, fx:0.3, fy:0.25, ar:1,
  fill:0.7, opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 }, extra);
const cfg = (qty, front, back) => ({ garmentId:gid, colorId:null, printId:null, qty:{ M:qty },
  logos:{ front, back, left:[], right:[] } });
const TEXT_URL = await C.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 60;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif';
  x.fillText('TEAM', 10, 45); return c.toDataURL('image/png');
});

const P1 = cfg(2, [lay('a1', { url:L, cleanUrl:L, origUrl:L })],
                  [lay('a2', { url:X, cleanUrl:X, origUrl:X })]);
const P2 = cfg(2, [lay('b1', { url:L2, cleanUrl:L2, origUrl:L2, recolorFrom:L, recolorTo:'#d8c3a5' })],
                  [lay('b2', { url:TEXT_URL, cleanUrl:TEXT_URL, origUrl:TEXT_URL,
                               text:{ t:'TEAM', font:'Montserrat', color:'#ffffff', bold:true, italic:false } })]);

async function build(c){
  await C.evaluate(c => { window.__lqEditOnly = null; window.__editProduct(c, null, []); }, c);
  await C.waitForTimeout(2500);
  await C.click('#pmAddToCartBtn');
  await C.waitForTimeout(1500);
}
const cartOf = () => C.evaluate(() => (window.__cartItems || []).map(it => ({
  unit: +it.unitPrice || 0, fee: +it.feeShare || 0, kinds: (it.desc || {}).designKinds || [] })));

console.log('═══ 1. ЗІБРАЛИ В КОНСТРУКТОРІ ═══');
await build(P1);
await build(P2);
const inCart = await cartOf();
console.log('  кошик: ' + JSON.stringify(inCart));
ok(inCart.length === 2, 'обидві позиції в кошику', 'у кошику ' + inCart.length);
ok(inCart.map(x => x.fee).join() === '388,338',
  'разові в конструкторі: 388 і 338 ₴/шт — логотип один на обидва, свій зад у кожного',
  'разові в конструкторі не ті: ' + inCart.map(x => x.fee).join(' · ') + ' (треба 388 · 338)');
ok(inCart[1].kinds.join() === 'img,txt', 'напис рахується написом', 'види: ' + inCart[1].kinds);

console.log('');
console.log('═══ 2. ЗБЕРЕГЛИ В АДМІНЦІ ═══');
const payload = await C.evaluate(() => JSON.parse(JSON.stringify(window.__cartItems)));
const saved = await A.evaluate(async items => {
  orders.length = 0;
  await window.__adminSaveClientOrder({ items, name:'Тест', instagram:'@t' });
  const o = orders[0];
  repriceOrder(o); recalcOrderTotals(o);
  return JSON.parse(JSON.stringify(o));
}, payload);
const left = o => o.items.map(x => +x.unitPrice || 0);
const fees = o => o.items.map(x => +x.feeShare || 0);
console.log('  ліва панель: ' + left(saved).join(' · ') + ' ₴/шт · разові ' + fees(saved).join(' · '));
ok(left(saved).join() === inCart.map(x => x.unit).join(),
  'ліва панель після збереження показує те саме, що конструктор',
  'ліва панель ' + left(saved).join(' · ') + ', а конструктор ' + inCart.map(x => x.unit).join(' · '));
const layers = saved.items.map(x => [].concat(x.config.logos.front || [], x.config.logos.back || []));
ok(layers.every(ls => ls.every(l => l.fp)),
  'відбиток кожного шару збережено — доти він відкидався, і рішення менеджера губились',
  'відбитків немає: ' + JSON.stringify(layers.map(ls => ls.map(l => !!l.fp))));
ok(layers[1][0].recolorFrom === L, 'перефарбований логотип памʼятає, з чого його фарбували',
  'recolorFrom загубився: ' + layers[1][0].recolorFrom);
ok(layers[1][1].text && layers[1][1].text.t === 'TEAM' && layers[1][1].text.bold === true,
  'напис збережено цілим — із жирністю', 'напис: ' + JSON.stringify(layers[1][1].text));
ok(!saved.items.some(x => (x.desc.designUrls || []).some(u => /^data:/.test(u))),
  'в описі позицій немає важких data-адрес — там адреси з хмари',
  'data-адреси в описі: ' + JSON.stringify(saved.items.map(x => x.desc.designUrls)));

// «Як склалась ціна» — рядки сходяться з ціною за штуку
const calc = await A.evaluate(() => {
  const d = document.createElement('div'); d.innerHTML = priceCalcHtml(orders[0]) || '';
  return [...d.querySelectorAll('.t-calc-item')].map(el => {
    const rows = [...el.querySelectorAll('.t-calc-row')].map(r => ({
      t: r.querySelector('span').textContent, v: +(r.querySelector('b').textContent.replace(/[^\d−-]/g, '').replace('−', '-')) || 0,
      sum: r.classList.contains('is-sum'), disc: r.classList.contains('is-disc') }));
    const parts = rows.filter(r => !r.sum).reduce((a, r) => a + r.v, 0);
    const unit = (rows.find(r => /Ціна за штуку/.test(r.t)) || {}).v;
    return { parts, unit, lines: rows.filter(r => /Підготовка|ескіз|Ескіз/.test(r.t)).map(r => r.t + ' = ' + r.v) };
  });
});
calc.forEach((c, i) => console.log('  позиція ' + (i + 1) + ': ' + c.lines.join(' · ')));
ok(calc.length === 2 && calc.every(c => Math.abs(c.parts - c.unit) <= 1),
  '«Як склалась ціна»: рядки в сумі дають ціну за штуку в обох позиціях',
  'рядки не сходяться: ' + JSON.stringify(calc.map(c => [c.parts, c.unit])));
ok(calc[1] && calc[1].lines.some(t => /Ескіз напису/.test(t)) && !calc[1].lines.some(t => /напис · 480/.test(t)),
  'напис поруч із логотипом — ескіз напису, а не друга підготовка',
  'напис рахується не так: ' + JSON.stringify(calc[1] && calc[1].lines));

/* Перезавантаження — замовлення проходить через базу. */
async function reload(){
  return A.evaluate(() => {
    const o = JSON.parse(JSON.stringify(orders[0]));
    orders.length = 0; orders.push(o);
    repriceOrder(o); recalcOrderTotals(o);
    return JSON.parse(JSON.stringify(o));
  });
}
/* Відкрити позицію в конструкторі так, як це робить робоче місце: кошик —
   увесь склад із бази, редагується одна позиція. */
async function reopen(o, idx){
  const cart = o.items.map(x => ({ kind:x.kind, vgroup:x.vgroup || '', name:x.name, qty:x.qty,
    unitPrice:x.unitPrice, price:x.price, desc:x.desc, config:x.config, prints:x.prints,
    designKindFix:x.designKindFix || null, garmentId:x.garmentId }));
  await C.evaluate(([cart, idx]) => {
    const c = window.__cartItems; c.length = 0; cart.forEach(x => c.push(x));
    window.__lqEditOnly = idx;
    window.__editProduct(JSON.parse(JSON.stringify(cart[idx].config)), idx, cart[idx].prints || []);
  }, [cart, idx]);
  await C.waitForTimeout(2600);
  return C.evaluate(() => {
    const s = window.__lqDraftShared();
    return { unit: s.unit, fee: s.parts ? s.parts.feeShare : -1,
             designs: s.desc.designs, kinds: s.desc.designKinds, urls: s.desc.designUrls,
             layerKinds: [].concat(...['front','back'].map(k => (window.__lqLayers.list(k) || []).map(() => 0))) };
  });
}
async function saveOpen(idx){
  const item = await C.evaluate(() => {
    document.getElementById('pmAddToCartBtn').click();
    return new Promise(r => setTimeout(() => {
      const i = window.__lqEditOnly;
      r(JSON.parse(JSON.stringify(window.__cartItems[i])));
    }, 1500));
  });
  return A.evaluate(async ([item, idx]) => {
    const o = orders[0];
    await window.__adminSaveClientOrder({ items:[item], targetId:o.id, replaceIndex:idx });
    repriceOrder(o); recalcOrderTotals(o);
    return JSON.parse(JSON.stringify(o));
  }, [item, idx]);
}

console.log('');
console.log('═══ 3. ПЕРЕЗАВАНТАЖИЛИ Й ВІДКРИЛИ ЗНОВУ — НІЧОГО НЕ МІНЯЛИ ═══');
const r1 = await reload();
ok(left(r1).join() === left(saved).join(),
  'після перезавантаження ліва панель та сама: ' + left(r1).join(' · '),
  'після перезавантаження ціни інші: ' + left(saved).join(' · ') + ' → ' + left(r1).join(' · '));
for(const idx of [0, 1]){
  const d = await reopen(r1, idx);
  ok(d.unit === left(r1)[idx],
    'позиція ' + (idx + 1) + ' відкрилась із тією самою ціною: ' + d.unit + ' ₴/шт',
    'позиція ' + (idx + 1) + ': у конструкторі ' + d.unit + ', у лівій панелі ' + left(r1)[idx]);
  ok(d.designs.join() === r1.items[idx].desc.designs.join() &&
     d.kinds.join() === r1.items[idx].desc.designKinds.join(),
    'позиція ' + (idx + 1) + ': дизайни й види ті самі, що збережені',
    'позиція ' + (idx + 1) + ': дизайни розійшлись ' + JSON.stringify({ було: r1.items[idx].desc.designs,
      стало: d.designs, види: [r1.items[idx].desc.designKinds, d.kinds] }));
}
/* І зберегли, нічого не міняючи, — ціни стоять. */
const s1 = await saveOpen(1);
ok(left(s1).join() === left(r1).join(),
  'зберегли без змін — ціни ті самі: ' + left(s1).join(' · '),
  'зберегли без змін — ціни поїхали: ' + left(r1).join(' · ') + ' → ' + left(s1).join(' · '));

/* Перемкнути вид логотипа спереду на відкритій позиції. */
async function flip(kind){
  await C.evaluate(k => {
    const s = [...document.querySelectorAll('#pmMgrCalc [data-mgr-kind]')]
      .find(x => +x.getAttribute('data-mgr-kind') === 0);
    if(!s) throw new Error('перемикача виду для логотипа немає: ' + JSON.stringify(
      [...document.querySelectorAll('#pmMgrCalc [data-mgr-kind]')].map(x => [x.getAttribute('data-mgr-kind'), x.value])) +
      ' · ' + ((document.getElementById('pmMgrCalc') || {}).innerText || '').slice(0, 3000) + ' · layers ' + JSON.stringify(['front','back'].map(k => window.__lqLayers.list(k))));
    s.value = k; s.dispatchEvent(new Event('change', { bubbles:true }));
  }, kind);
  await C.waitForTimeout(900);
}
async function cycle(kind, feesWant){
  console.log('');
  console.log('═══ 4. ЛОГОТИП → «' + ({ off:'не рахувати', txt:'напис', img:'картинка' })[kind] + '» ═══');
  const cur = await reload();
  await reopen(cur, 1);
  await C.evaluate(() => { window.__kf = [];
    window.__lqKindFix = (fp, url, k) => window.__kf.push([fp, url, k]); });
  await flip(kind);
  const after = await C.evaluate(() => window.__lqDraftShared().unit);
  /* Робоче місце передає рішення адмінці окремим повідомленням (kindFix) —
     рівно тим кодом і обробляємо. */
  const kf = await C.evaluate(() => window.__kf);
  ok(kf.length === 1 && kf[0][2] === kind, 'рішення пішло в адмінку одним повідомленням',
     'повідомлень: ' + JSON.stringify(kf.map(x => x[2])));
  await A.evaluate(kf => kf.forEach(([fp, url, k]) => kindFixApply(orders[0], fp, url, k)), kf);
  const s = await saveOpen(1);
  const r = await reload();
  console.log('  разові після збереження й перезавантаження: ' + fees(r).join(' · ') + ' ₴/шт');
  ok(fees(r).join() === feesWant.join(),
    'разові ' + feesWant.join(' · ') + ' — рішення лягло на обидві позиції з цим логотипом',
    'разові ' + fees(r).join(' · ') + ', а мало бути ' + feesWant.join(' · '));
  ok(after === left(r)[1], 'у конструкторі одразу те саме, що після збереження: ' + after,
    'конструктор показував ' + after + ', а після збереження ' + left(r)[1]);
  ok(r.items.every(x => x.desc.designKinds[0] === kind),
    'вид логотипа — «' + kind + '» в обох позиціях, і в описі, і після перезавантаження',
    'види логотипа: ' + JSON.stringify(r.items.map(x => x.desc.designKinds)));
  ok(r.items.every(x => ((x.config.logos.front || [])[0] || {}).kindFix === kind),
    'і на самих шарах — конструктор відкриє їх уже з цим вибором',
    'шари: ' + JSON.stringify(r.items.map(x => ((x.config.logos.front || [])[0] || {}).kindFix)));
  // Відкрили СУСІДНЮ позицію — вибір на місці й ціна та сама
  const d0 = await reopen(r, 0);
  ok(d0.kinds[0] === kind && d0.unit === left(r)[0],
    'сусідню позицію відкрили — там теж «' + kind + '», ціна ' + d0.unit + ' ₴/шт',
    'сусідня позиція: вид ' + d0.kinds[0] + ', ціна ' + d0.unit + ' проти ' + left(r)[0]);
  return r;
}
// «не рахувати»: логотип нічого не коштує. Підготовку несе логотип X ззаду
// першої позиції, напис другої — ескіз напису (логотип у способі є).
//   поз.1: X 850/2 = 425; поз.2: TEAM 250/2 = 125
await cycle('off', [425, 125]);
// «напис»: той самий малюнок тепер напис; логотипів лишився X — він несе підготовку.
//   поз.1: X 850/2 + напис-логотип 250/4 = 488 (487.5); поз.2: 62.5 + TEAM 250/2 = 188 (187.5)
await cycle('txt', [488, 188]);
// Назад на «картинку» — рівно як спочатку.
await cycle('img', [388, 338]);

console.log('');
console.log('═══ 5. ПОМІНЯЛИ ТЕКСТ НАПИСУ ═══');
{
  const cur = await reload();
  await reopen(cur, 1);
  await C.evaluate(() => {
    const t = window.__lqLayers.list('back').find(x => x.text);
    window.__lqLayers.text(t.id, 'CREW');
  });
  await C.waitForTimeout(1200);
  const d = await C.evaluate(() => window.__lqDraftShared());
  await saveOpen(1);
  const r = await reload();
  const back = ((r.items[1].config.logos.back || [])[0] || {});
  console.log('  напис: ' + (back.text || {}).t + ' · разові ' + fees(r).join(' · '));
  ok((back.text || {}).t === 'CREW', 'новий текст зберігся в позиції', 'у позиції лишилось: ' + (back.text || {}).t);
  ok(String(r.items[1].desc.designs[1]) !== String(cur.items[1].desc.designs[1]),
    'у напису новий відбиток — це інший текст', 'відбиток напису не змінився');
  ok(fees(r).join() === '388,338', 'разові ті самі: інший напис — так само один ескіз напису',
     'разові після правки напису: ' + fees(r).join(' · '));
  ok(d.unit === left(r)[1], 'конструктор до збереження показував ту саму ціну: ' + d.unit,
     'конструктор ' + d.unit + ', ліва панель ' + left(r)[1]);
  const d1 = await reopen(r, 1);
  ok(d1.unit === left(r)[1], 'відкрили знову — ціна та сама', 'після відкриття ' + d1.unit + ' проти ' + left(r)[1]);
}

console.log('');
console.log('═══ 6. ПРОДУБЛЮВАЛИ ПОЗИЦІЮ ═══');
{
  const r = await A.evaluate(() => {
    const o = orders[0];
    o.items.splice(1, 0, JSON.parse(JSON.stringify(o.items[0])));
    repriceOrder(o); recalcOrderTotals(o);
    return JSON.parse(JSON.stringify(o));
  });
  /* Логотип тепер на 6 шт (850/6), зад X — на 4 (350/4), напис — на 2 (250/2). */
  console.log('  разові: ' + fees(r).join(' · '));
  ok(fees(r).join() === '229,229,267', 'копія стала поруч, і поділ перерахувався на весь склад: 229 · 229 · 267',
     'після дубля разові ' + fees(r).join(' · ') + ' (треба 229 · 229 · 267)');
  await A.evaluate(() => { const o = orders[0]; o.items.splice(1, 1); repriceOrder(o); recalcOrderTotals(o); });
}

console.log('');
console.log('═══ 7. ГРУПА ВАРІАНТІВ: ТОЙ САМИЙ ЛОГОТИП І НОВИЙ ═══');
{
  const r = await A.evaluate(() => {
    const o = orders[0];
    const v1 = JSON.parse(JSON.stringify(o.items[1]));
    const v2 = JSON.parse(JSON.stringify(o.items[1]));
    v1.kind = v2.kind = 'variant'; v1.vgroup = v2.vgroup = 'Худі на вибір';
    v1.name = 'Худі оверсайз'; v2.name = 'Худі базове';
    // У другого варіанта ззаду інший логотип — новий дизайн
    const M = Array.from({ length:144 }, (_, i) => (i * 7 + 3) % 10).join('');
    v2.desc.designs = [v2.desc.designs[0], M];
    v2.desc.designKinds = ['img', 'img'];
    v2.desc.designUrls = [v2.desc.designUrls[0], 'https://cdn.test/M.png'];
    v2.config.logos.back = [Object.assign({}, v2.config.logos.back[0], { text:null, fp:M, url:'https://cdn.test/M.png' })];
    o.items.splice(2, 0, v1, v2);
    repriceOrder(o); recalcOrderTotals(o);
    return JSON.parse(JSON.stringify(o));
  });
  console.log('  разові: ' + r.items.map(x => x.name + ' ' + x.feeShare).join(' · '));
  /* Склад рахується з першим варіантом групи: позиція 1 + 2 + оверсайз.
     Логотип на 6 шт (142), X на 2 (175), напис на 4 (63). Базове худі
     рахується в складі, де групу представляє воно: логотип на 6, свій
     новий логотип M ззаду — ескіз на 2 (175). */
  ok(r.items[2].feeShare === 204 && r.items[3].feeShare === 317,
    'варіант із тим самим логотипом і написом — 204, з новим логотипом ззаду — ще й ескіз: 317',
    'варіанти: ' + r.items.slice(2).map(x => x.feeShare).join(' · ') + ' (треба 204 · 317)');
  ok(r.items[0].feeShare === 317 && r.items[1].feeShare === 204,
    'основні позиції рахуються разом із представником групи: 317 · 204',
    'основні: ' + r.items.slice(0, 2).map(x => x.feeShare).join(' · ') + ' (треба 317 · 204)');
}

console.log('');
console.log('═══ 8. ВАЖКЕ ЗАМОВЛЕННЯ — ПЕРЕВІРЯЛЬНИК ПРОРАХУНКУ ═══');
{
  const dump = await A.evaluate(() => {
    const o = orders[0];
    // Рекомендована з тим самим логотипом і рекомендована з новим, DTF-позиція і голий виріб
    const base = o.items[0];
    const reco1 = Object.assign(JSON.parse(JSON.stringify(base)), { kind:'reco', name:'Кепка' });
    const reco2 = JSON.parse(JSON.stringify(base));
    Object.assign(reco2, { kind:'reco', name:'Шопер' });
    const N = Array.from({ length:144 }, (_, i) => (i * 9 + 5) % 10).join('');
    reco2.desc.designs = [N]; reco2.desc.designKinds = ['img']; reco2.desc.designUrls = ['https://cdn.test/N.png'];
    reco2.desc.designMm2 = [3000];
    const dtf = JSON.parse(JSON.stringify(base));
    Object.assign(dtf, { name:'Футболка DTF', qty:5 });
    dtf.desc = Object.assign({}, dtf.desc, { method:'dtf', units:5, dtfCols:[0, 0] });
    const bare = JSON.parse(JSON.stringify(base));
    Object.assign(bare, { name:'Футболка без нанесення', qty:3 });
    bare.desc = Object.assign({}, bare.desc, { bare:true, units:3, designs:[], designKinds:[], designUrls:[], designMm2:[] });
    o.items.push(reco1, reco2, dtf, bare);
    window.SITE_CONTENT.pricing.methods.dtf = { orderFee:450, orderCost:120, sketchFee:150, sketchCost:30,
      tiers:[{ from:1, coef:1 }], qtyFrom:[1], price:[[200, 300]], cost:[[80, 120]] };
    repriceOrder(o); recalcOrderTotals(o);
    return calcDumpText(o);
  });
  const TMP = path.join(ROOT, 'tests', '.b2b-fees-dump.json');
  fs.writeFileSync(TMP, dump);
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync('node', [path.join(ROOT, 'tools', 'check-calc.mjs'), TMP], { encoding:'utf8' });
  try{ fs.unlinkSync(TMP); }catch(e){}
  const out = (run.stdout || '') + (run.stderr || '');
  out.split('\n').filter(l => /підготовка|ескіз|Усе сходиться|НЕ СХОДИТЬСЯ|✗/.test(l)).slice(0, 30)
    .forEach(l => console.log('  ' + l.trim()));
  ok(run.status === 0 && /Усе сходиться/.test(out),
    'перевіряльник: ціни в картці, рядки розкладу, разові й сума замовлення — усе сходиться',
    'перевіряльник знайшов розходження:\n' + out);
  const D = JSON.parse(dump);
  const reco = D.позиції.filter(x => x.рід === 'reco');
  ok(reco[0] && reco[0].розклад && reco[0].розклад.feeShare === 0,
    'рекомендована з тим самим логотипом за дизайн не платить', 'рекомендована 1: ' + JSON.stringify(reco[0] && reco[0].розклад && reco[0].розклад.feeShare));
  ok(reco[1] && reco[1].розклад && (reco[1].розклад.feeLines || []).length === 0 && (reco[1].розклад.sketches || []).length === 1,
    'рекомендована з новим логотипом платить ескіз, а не другу підготовку',
    'рекомендована 2: ' + JSON.stringify(reco[1] && reco[1].розклад && [reco[1].розклад.feeLines, reco[1].розклад.sketches]));
}

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad + ' з ' + total : 'усі ' + total + ' перевірок зійшлись');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
