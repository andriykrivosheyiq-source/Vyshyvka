/* ПРОРАХУНОК З ТЕЛЕФОНА — ОКРЕМОЮ СТОРІНКОЮ (21.10). Андрій: «менеджери B2B
   часто роблять КП з телефона… щоб нічого не плило, кнопки нажимались».
   Картка → конструктор (?solo=1, без адмінки під ним) → «Додати» → назад у
   картку, позиція записана. Запуск:  node tests/calc-phone.mjs

   (Основа — calc-restore.mjs. Андрій: «глючить СРМ по
   опту, не можу зробити прорахунок» — на телефоні Safari після вибору фото
   перезавантажував сторінку, і менеджер опинявся на дошці.

   Запуск:  node tests/calc-restore.mjs

   (Основа — nav.mjs: ліве меню: порядок розділів і група «Налаштування».

   ЧОГО БРАКУВАЛО. Дванадцять пунктів поспіль, однаковим кеглем, без жодної
   групи. Щоденне — замовлення й чати — лежало впереміш із тим, куди
   заходять раз на тиждень: ставки, розмірні сітки, підрядники, доступи.
   Око щоразу перечитувало весь список, щоб знайти той самий Канбан.

   ЯК ТЕПЕР. Два напрями стоять парами — «Замовлення B2B + Чати B2B», далі
   «Замовлення B2C + Чати B2C», — бо це те саме замовлення, лише інший
   клієнт. «Канбан» і «B2C» перестали бути назвами: у меню написано, що це
   замовлення, і якого саме напряму. Рідкісне складено в одну кнопку
   «Налаштування» в самому низу.

   ПРОРАХУНОК. Розділ лишився, пунктом меню бути перестав: у конструктор
   заходять із картки замовлення, а не зі списку зліва. Кнопка жива — саме
   вона й перемикає вид, — просто її не показують.

   Запуск:  node tests/nav.mjs      (з кореня репозиторію)  */
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8994;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
const ORDERS = [{ id:'o148', orderId:'1000148', type:'client', name:'Aisha', instagram:'aisha', status:'prorahunok', site:'main',
  payments:[], hist:[], createdAt:'2026-10-20T20:32:00.000Z', items:[] }];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ 1. ТЕЛЕФОН: «ЗІБРАТИ КП» ВІДКРИВАЄ КОНСТРУКТОР ОКРЕМОЮ СТОРІНКОЮ ═══');
await p.evaluate(() => { openCalcFor(orders.find(o => o.id === 'o148')); });
await p.waitForURL(/index\.html\?.*solo=1/, { timeout: 15000 });
await p.waitForTimeout(3000);
const r1 = await p.evaluate(() => ({ url: location.search, iframe: !!document.getElementById('calc-only-frame'),
  host: !!(window.__lqAdminHost && window.__lqAdminHost()), target: (window.__adminOfferTarget || {}).id,
  шапка: ((document.querySelector('#catalogModal .catalog-modal-topbar .logo') || {}).textContent || '').trim() }));
console.log('  ' + JSON.stringify(r1));
ok(/solo=1/.test(r1.url) && /cart=new/.test(r1.url) && !r1.iframe, 'конструктор — окрема сторінка (без адмінки й iframe)', JSON.stringify(r1));
ok(r1.host && r1.target === 'o148', 'привʼязка до картки 1000148 на місці — «Додати» знає, куди', JSON.stringify(r1));
ok(/КП · aisha/.test(r1.шапка), 'у шапці — «КП · aisha» замість «Loomiq»', r1.шапка);

console.log('═══ 2. SAFARI ПЕРЕЗАВАНТАЖИВ КОНСТРУКТОР — КОШИК НЕ ЧИСТИТЬСЯ ═══');
await p.reload({ waitUntil:'domcontentloaded' });
await p.waitForTimeout(2500);
const r2 = await p.evaluate(() => location.search);
ok(!/cart=new/.test(r2) && /solo=1/.test(r2), 'після перезавантаження адреса без cart=new — зібране лишається', r2);

console.log('═══ 3. «ДОДАТИ ДО ЗАМОВЛЕННЯ» → НАЗАД У КАРТКУ, ПОЗИЦІЯ ЗАПИСАНА ═══');
await p.evaluate(() => { window.__adminSaveClientOrder({ instagram:'aisha', name:'', company:'', phone:'', dueAt:'', targetId:'o148',
  items:[{ kind:'main', name:'Худі базове', color:'Білий', qty:10, unitPrice:550, price:5500, unitCost:300, cost:3000, sizes:'M:10', mockups:[], prints:[] }] }); });
await p.waitForURL(/loomiqadmin\.html/, { timeout: 15000 });
await p.waitForTimeout(6000);
const r3 = await p.evaluate(async () => {
  const o = orders.find(x => x.id === 'o148');
  const left = await new Promise(res => { const q = indexedDB.open('lq_handoff', 1); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('calc'); g.onsuccess = () => res(!!g.result); }; q.onerror = () => res('err'); });
  return { items: (o.items || []).map(i => i.name + '×' + i.qty), url: location.search, left,
           картка: !!document.querySelector('#orderDrawer.open') };
});
console.log('  ' + JSON.stringify(r3));
ok(r3.items.join() === 'Худі базове×10', 'позиція лягла в картку 1000148 (записує адмінка, як завжди)', JSON.stringify(r3));
ok(r3.left === false && !/calcSave/.test(r3.url), 'передача прибрана, адреса чиста — оновлення сторінки не запише вдруге', JSON.stringify(r3));
ok(r3.картка, 'відкрито картку, куди лягла позиція', JSON.stringify(r3));

console.log('═══ 4. «←» У КОНСТРУКТОРІ — НАЗАД У КАРТКУ БЕЗ ЗАПИСУ ═══');
await p.evaluate(() => { openCalcFor(orders.find(o => o.id === 'o148')); });
await p.waitForURL(/solo=1/, { timeout: 15000 });
await p.waitForTimeout(2500);
await p.evaluate(() => document.getElementById('catalogUnifiedBack').click());
await p.waitForURL(/loomiqadmin\.html/, { timeout: 15000 });
await p.waitForTimeout(6000);
/* У заглушці бази записи не переживають перезавантаження — тож «нічого не
   дописано» перевіряємо самою передачею: її не має бути. */
const r4 = await p.evaluate(async () => ({ картка: !!document.querySelector('#orderDrawer.open'), url: location.search,
  передача: await new Promise(res => { const q = indexedDB.open('lq_handoff', 1); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('calc'); g.onsuccess = () => res(!!g.result); }; q.onerror = () => res('err'); }) }));
console.log('  ' + JSON.stringify(r4));
ok(r4.картка && !/calcBack/.test(r4.url) && r4.передача === false, '«←» повертає в ту саму картку, нічого не дописано', JSON.stringify(r4));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'КП з телефона: окрема сторінка, назад у картку');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
