/* ПРОРАХУНОК ПЕРЕЖИВАЄ ПЕРЕЗАВАНТАЖЕННЯ (21.10). Андрій: «глючить СРМ по
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
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8999;
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
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
/* Так, ніби Safari щойно перезавантажив сторінку посеред прорахунку. */
await p.addInitScript(() => { try{ sessionStorage.setItem('lq_calc', JSON.stringify({ id:'o148', idx:null, at: Date.now() - 60000 })); }catch(e){} });
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

/* Видно — це «займає місце на екрані», а не «є в розмітці». Саме цю
   різницю ми й перевіряємо: пункти групи в DOM стоять завжди. */
const SEEN = `(el => !!el && !!el.offsetParent && el.getBoundingClientRect().height > 0)`;

console.log('═══ ПІСЛЯ ПЕРЕЗАВАНТАЖЕННЯ — ЗНОВУ В КОНСТРУКТОРІ ТІЄЇ Ж КАРТКИ ═══');
const r = await p.evaluate(() => {
  const vc = document.getElementById('view-calc'), vb = document.getElementById('view-board');
  const fr = document.getElementById('calc-only-frame');
  return { calc: vc && vc.style.display !== 'none', board: vb && vb.style.display === 'none', target: calcTarget,
           src: (fr && fr.getAttribute('src')) || '', напис: ((document.querySelector('.calc-target-t') || {}).textContent || '').trim() };
});
console.log('  ' + JSON.stringify(r));
ok(r.calc && r.board && r.target === 'o148', 'відкрито розділ прорахунку для картки 1000148, не дошка', JSON.stringify(r));
ok(/manager=1/.test(r.src) && !/cart=new/.test(r.src), 'кошик конструктора не чиститься — те, що вже вибрали, лишається', r.src);
ok(/1000148|aisha|Aisha/i.test(r.напис), 'над конструктором — «Збираємо пропозицію для …»', r.напис);

/* Відвʼязали — після наступного перезавантаження вже не відкриємо. */
const after = await p.evaluate(() => { document.getElementById('calc-target-off').click(); return sessionStorage.getItem('lq_calc'); });
ok(after === null, '«Відвʼязати» забуває картку — наступне перезавантаження не поверне в конструктор', 'лишилось: ' + after);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'прорахунок переживає перезавантаження');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
