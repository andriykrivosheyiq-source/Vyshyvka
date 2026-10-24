/* ЗАГОТОВКИ B2C (Андрій, 20.10).

   Нові тексти по блоках; старі B2C — геть, «обом» стають B2B; одне
   підставлення на ⚡ і «До картинок» (з картки, «Грошей» і налаштувань);
   перший показ (і готового дизайну) — один текст; правки й варіанти — свої;
   довгих тире немає.

   Запуск:  node tests/scripts-b2c.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9126;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }],
  products: { retail: { tee: 2570, sweat: 2970, hoodie: 3370, cap: 2370, tote: 2170 }, retailReady: { tee: 1790, sweat: 2190, hoodie: 2590, cap: 1590, tote: 1390 } },
  b2c: { extras: [{ id:'a', name:'Збільшення розміру 13 см', price:290 }, { id:'b', name:'Збільшення розміру 18 см', price:660 },
                  { id:'c', name:'Збільшення розміру 23 см', price:1100 }, { id:'d', name:'Додатковий надпис', price:190 }] },
  quickReplies: [
    { t:'Вітання', m:'Вітаю! Це {бренд}.' },
    { t:'Оплата', m:'Працюємо за передоплатою 50%.' },
    { t:'Макет готовий · B2C', dir:'b2c', m:'{макет} Старий текст' },
    { t:'Готовий дизайн · B2C', dir:'b2c', m:'{готовий} Старий готовий' },
    { t:'Макет на погодження · B2B', dir:'b2b', m:'{макет} Надсилаємо макет на погодження ({версія}).' }
  ], qrSeed: 4 };
const ORDERS = [
  { id:'1', orderId:'2000801', type:'client', dir:'b2c', name:'Асія Дерещук', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 2000, items:[] }
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

console.log('═══ 1. СТАРІ ЗАГОТОВКИ → НОВІ (ОДИН РАЗ) ═══');
const r1 = await p.evaluate(async () => {
  contentLoaded = true;
  await qrSeedOnce();
  const l = contentData.quickReplies;
  return { n: l.length, seed: contentData.qrSeed,
           b2cOld: l.some(q => /Старий/.test(q.m)), обом: l.filter(q => !q.dir).length,
           b2b: l.filter(q => q.dir === 'b2b').map(q => q.t), b2c: l.filter(q => q.dir === 'b2c').length,
           групи: [...new Set(l.filter(q => q.dir === 'b2c').map(q => q.g))] };
});
console.log('  ' + JSON.stringify(r1));
ok(r1.seed === 6 && !r1.b2cOld && r1.обом === 0 && r1.b2b.includes('Вітання') && r1.b2b.includes('Оплата') && r1.b2b.includes('Макет на погодження · B2B'),
  'старі B2C прибрано, «обом» стали B2B, B2B лишились', JSON.stringify(r1));
ok(r1.b2c >= 20 && ['pic','order','pay','size','edit','ship','after','problem'].every(g => r1.групи.includes(g)),
  'нові B2C — по блоках: до картинок, замовлення, оплата, розмір, правки, доставка, після, проблемні', JSON.stringify(r1));

/* Шосте доведення (20.10): у кого вже був набір 5 — стара «Фіксую» з
   {вишивка} стає новою; переписану менеджером (без {вишивка}) не чіпаємо. */
const r1b = await p.evaluate(async () => {
  contentData.qrSeed = 5;
  contentData.quickReplies = [
    { t:'Фіксую замовлення', m:'Фіксую ваше замовлення:\nОдяг: {одяг}\nРозмір вишивки: {вишивка}', dir:'b2c', g:'order' },
    { t:'Своя фіксація', m:'Моя фіксація {одяг}', dir:'b2c', g:'order' }
  ].concat(contentData.quickReplies.filter(x => x.t !== 'Фіксую замовлення'));
  await qrSeedOnce();
  const l = contentData.quickReplies;
  return { seed: contentData.qrSeed, нова: /\{фіксація\}/.test((l.find(x => x.t === 'Фіксую замовлення') || {}).m || ''),
           своя: (l.find(x => x.t === 'Своя фіксація') || {}).m, стараЗникла: !l.some(x => /\{вишивка\}/.test(x.m)) };
});
console.log('  ' + JSON.stringify(r1b));
ok(r1b.seed === 6 && r1b.нова && r1b.своя === 'Моя фіксація {одяг}' && r1b.стараЗникла,
  'набір 5 → 6: стара «Фіксую» замінена новою, своя заготовка менеджера на місці', JSON.stringify(r1b));

console.log('═══ 2. ТЕКСТИ «ДО КАРТИНОК» ═══');
const r2 = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000801');
  return { перший: scriptFor(o, 'design1', { v:1 }, 'b2c'), готовий: scriptFor(o, 'ready', { v:1 }, 'b2c'),
           правки: scriptFor(o, 'design2', { v:2 }, 'b2c'),
           варіанти: scriptFor(o, 'vars', { list:[{ n:1, label:'Футболка базова · Білий' }, { n:2, label:'Футболка базова · Чорний' }] }, 'b2c'),
           картка: scriptCard(o, 'b2c') };
});
console.log('  ' + JSON.stringify(r2));
ok(r2.перший === 'Добрий день! Подивіться, як гарно вийшло 😊 Вам подобається?' && r2.готовий === r2.перший,
  'перший показ — «Подивіться, як гарно вийшло», і для готового дизайну той самий', JSON.stringify(r2));
ok(r2.правки === 'Добрий день! Внесли правки 😊 Вам подобається?', 'після правок — «Внесли правки 😊 Вам подобається?»', r2.правки);
ok(/варіанти на вибір/.test(r2.варіанти) && /1\. Футболка базова, Білий\n2\. Футболка базова, Чорний/.test(r2.варіанти),
  'варіанти — свій текст і список номерів', r2.варіанти);
ok(r2.картка.title === 'Варіанти на вибір' && /номер варіанта/.test(r2.картка.note), 'напис на картці варіантів — із заготовок', JSON.stringify(r2.картка));

console.log('═══ 3. ПІДСТАВЛЕННЯ З КАРТКИ, «ГРОШЕЙ» І НАЛАШТУВАНЬ ═══');
const r3 = await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const o = orders.find(x => x.orderId === '2000801');
  const j = designJobMake('2000801');
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Білий', size:'L', qty:1, note:'лого', artKind:'kids' });
  j.units = [u];
  const d = D.dzNew(); u.graphic = [d];
  D.dzVer(d, 'p@loomiq', [{ name:'w.png', url:'w', role:'work' }], '', { size:'L', spots:[{ side:'front', label:'Перед', wCm:13.7, hCm:10.8, topCm:8 }] }, 'graphic');
  const q = n => contentData.quickReplies.filter(x => x.t === n)[0].m;
  const фікс = qrFill(q('Фіксую замовлення'), o);
  u.size = ''; const фіксБезРозміру = qrFill(q('Фіксую замовлення'), o); u.size = 'L';
  return { фікс, фіксБезРозміру, qrParts: null, залишок: qrFill(q('Залишок за тими ж реквізитами'), o),
           ціни: qrFill(q('Ціни на вироби'), o), збільш: qrFill(q('Збільшення вишивки'), o), риси: qrFill(q('Риси обличчя: збільшити або обрізати'), o),
           довгі: contentData.quickReplies.filter(x => x.dir === 'b2c' && /—/.test(x.m)).map(x => x.t) };
});
console.log('  ' + JSON.stringify(r3).slice(0, 900));
ok(/^Я рада, що вам подобається/.test(r3.фікс) && /\n---\nМодель: Футболка базова\nКолір: Білий\nРозмір: L\nНанесення: вишивка спереду\n---\nПеревірте/.test(r3.фікс) &&
   !/Вид:|Кількість|шт|вишивки|13,7/.test(r3.фікс),
  '«Фіксую» (23.10): привітання --- модель, колір, розмір, нанесення стовпчиком, без кількості й сантиметрів --- перевірте', r3.фікс);
const частини = await p.evaluate(t => qrParts(t), r3.фікс);
ok(частини.length === 3 && /^Модель:/.test(частини[1]), '«---» ділить на три окремі повідомлення', JSON.stringify(частини));
ok(/Розмір: —/.test(r3.фіксБезРозміру) && !/Розмір: M/.test(r3.фіксБезРозміру), 'розмір не вказано — прочерк, не M', r3.фіксБезРозміру);
ok(/1 700 грн/.test(r3.залишок), 'залишок — з «Грошей» (2000 − 300 = 1 700)', r3.залишок);
ok(/футболка з вишивкою, 1 790 грн/.test(r3.ціни) && /худі з вишивкою \(кофта з капюшоном\), 2 590 грн/.test(r3.ціни) && /розробка дизайну по вашому фото для вишивки, 780 грн/.test(r3.ціни),
  'ціни — з налаштувань B2C (готовий дизайн; розробка = індивідуальний − готовий)', r3.ціни);
ok(/• 13 см, 290 грн/.test(r3.збільш) && /• 23 см, 1 100 грн/.test(r3.збільш) && !/надпис/i.test(r3.збільш), 'збільшення — з «Додаткових послуг»', r3.збільш);
ok(/18 см, 660 грн/.test(r3.риси), 'риси обличчя — доплата з налаштувань', r3.риси);
ok(!r3.довгі.length, 'у заготовках B2C немає довгих тире', JSON.stringify(r3.довгі));

console.log('═══ 4. ПАНЕЛЬ ⚡ — ПО БЛОКАХ ═══');
const r4 = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000801');
  const box = document.createElement('div'); box.innerHTML = qrPanelHtml(o);
  return { блоки: [...box.querySelectorAll('.cw-qr-grp')].map(x => x.textContent.split(' · ')[0]),
           b2b: /Працюємо за передоплатою/.test(box.textContent), олівців: box.querySelectorAll('[data-qr-edit]').length };
});
console.log('  ' + JSON.stringify(r4));
ok(r4.блоки[0] === 'До картинок' && r4.блоки.includes('Оплата й ціни') && r4.блоки.includes('Проблемні ситуації') && !r4.b2b,
  'у чаті B2C — блоки, першим «До картинок»; B2B-заготовок немає', JSON.stringify(r4));
ok(r4.олівців >= 20, 'у кожної заготовки ✎', JSON.stringify(r4));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'заготовки B2C — як домовились');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
