/* Груп варіантів може бути кілька.

   Група — це питання до клієнта, а позиції в ній — відповіді. Питань у
   пропозиції буває кілька: «які футболки?» і «які худі?». Клієнт відповідає
   на кожне окремо, бере по одному виробу з групи, і тираж у кожній свій.

   Сторінка клієнта це вміла завжди: групи малюються окремими блоками зі
   своїми назвами, а вибір і тираж живуть під ключем групи. Не вміла адмінка:
   будь-який новий варіант падав у ту саму «Варіанти на вибір» — кнопка
   «＋ Група варіантів» насправді додавала позицію в наявну групу, — а
   перенести варіант між групами не було чим. Тобто друга група не
   створювалась узагалі.

   Тест робить те саме, що менеджер: заводить другу групу, переносить у неї
   варіант і звіряє, що групи лишились двома, а тираж у кожній свій.

   Запуск:  node tests/variant-groups.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8805;
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

const it = (kind, name, gid, qty, up, extra) => Object.assign({
  kind, name, garmentId:gid, qty,
  unitPrice:up, price:up * qty, unitCost:Math.round(up * 0.6), cost:Math.round(up * 0.6) * qty
}, extra || {});

/* У пропозиції вже є одна група — дві футболки на вибір. Худі поки лежить
   в основному складі: саме його менеджер і винесе в окрему групу. */
const ORDER = {
  id:'1', orderId:'1000042', type:'client', name:'Оксана', phone:'+380670000042',
  status:'kp', site:'main', payments:[], offerToken:'tok1',
  createdAt:new Date(Date.now() - 2 * 864e5).toISOString(),
  hist:[{ s:'kp', at:new Date(Date.now() - 864e5).toISOString() }],
  totalPrice:9000, totalCost:5400, margin:3600, marginPct:40,
  vqty:{ 'Футболки': 30 },
  items:[
    it('main',    'Худі базове',      'hoodie', 10, 900),
    it('variant', 'Футболка базова',  'tshirt', 30, 300, { vgroup:'Футболки' }),
    it('variant', 'Футболка оверсайз','tshirt', 30, 380, { vgroup:'Футболки' })
  ]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
/* Назву нової групи питають власним вікном: спершу воно показує групи, які
   вже є в цьому КП, а поле для нової — другим кроком. Відповідаємо як
   менеджер, що заводить «Худі». */
const newGroup = async (name) => {
  await p.waitForTimeout(400);
  await p.evaluate(n => {
    const d = document.querySelector('#offerEd iframe').contentDocument;
    const inp = d.querySelector('#gNew');
    inp.value = n;
    d.querySelector('[data-g-add]').click();
  }, name);
};
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.click('.ticket');
await p.waitForTimeout(1200);
await p.click('[data-act="offered"]');
await p.waitForTimeout(3000);

const ed = () => p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  return {
    groups: [...d.querySelectorAll('.list-sec.is-var .vg-name')].map(x => x.textContent.trim()),
    qty: [...d.querySelectorAll('.list-sec.is-var [data-vqedit]')]
      .map(x => x.dataset.vqedit + ':' + x.textContent.trim()),
    items: [...d.querySelectorAll('#listBody .it')]
      .map(x => x.dataset.pick + ' ' + (x.querySelector('.it-n') || {}).textContent)
  };
});
const state = () => p.evaluate(() => (orders[0].items || [])
  .map(i => i.name + ':' + (i.kind || 'main') + (i.vgroup ? '/' + i.vgroup : '') + ':' + i.qty));

console.log('═══ ЯК БУЛО ═══');
const a0 = await ed();
console.log('  групи: ' + JSON.stringify(a0.groups) + ' · тиражі: ' + JSON.stringify(a0.qty));
ok(a0.groups.length === 1 && a0.groups[0] === 'Футболки',
  'у пропозиції одна група — «Футболки»',
  'групи не ті: ' + JSON.stringify(a0.groups));

console.log('');
console.log('═══ ХУДІ — В ОКРЕМУ ГРУПУ ═══');
/* Меню основної позиції має пропонувати і наявну групу, і нову: доти тут
   стояла одна кнопка, яка мовчки клала все в першу групу. */
await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  d.querySelector('[data-dots="main:0"]').click();
});
await p.waitForTimeout(400);
const menu = await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  return [...d.querySelectorAll('.menu button')].map(b => b.textContent.trim());
});
console.log('  меню: ' + JSON.stringify(menu));
ok(menu.some(t => /У групу «Футболки»/.test(t)) && menu.some(t => /У нову групу/.test(t)),
  'меню пропонує і наявну групу, і нову',
  'вибору групи в меню немає: ' + JSON.stringify(menu));

await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  [...d.querySelectorAll('.menu button')].filter(b => /У нову групу/.test(b.textContent))[0].click();
});
await newGroup('Худі');
await p.waitForTimeout(2500);
const a1 = await ed();
console.log('  групи: ' + JSON.stringify(a1.groups) + ' · тиражі: ' + JSON.stringify(a1.qty));
console.log('  ' + JSON.stringify(await state()));
ok(a1.groups.length === 2 && a1.groups.indexOf('Худі') >= 0 && a1.groups.indexOf('Футболки') >= 0,
  'груп стало дві: «Футболки» і «Худі»',
  'друга група не завелась: ' + JSON.stringify(a1.groups));
/* Тираж у групі один на всіх, але в РІЗНИХ групах він різний: 30 футболок
   і 10 худі — це два різні числа, і жодне не має підмінити інше. */
ok(a1.qty.join('|').indexOf('Футболки:30') >= 0 && a1.qty.join('|').indexOf('Худі:10') >= 0,
  'тираж у кожної групи свій: 30 футболок і 10 худі',
  'тиражі змішались: ' + JSON.stringify(a1.qty));

console.log('');
console.log('═══ ПЕРЕНЕСТИ МІЖ ГРУПАМИ ═══');
/* Варіант має вміти переїхати з групи в групу — і взяти тираж нової: два
   різні числа в одній групі означали б, що жодне з них не справжнє. */
await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  const rows = [...d.querySelectorAll('#listBody .it')]
    .filter(x => /Футболка оверсайз/.test(x.textContent));
  rows[0].querySelector('.it-dots').click();
});
await p.waitForTimeout(400);
const menu2 = await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  return [...d.querySelectorAll('.menu button')].map(b => b.textContent.trim());
});
console.log('  меню варіанта: ' + JSON.stringify(menu2));
/* Своєї ж групи в списку бути не має: «перенести туди, де вже стоїш» — це
   не дія, а привід засумніватись, що система розуміє, де позиція. */
ok(!menu2.some(t => /У групу «Футболки»/.test(t)) && menu2.some(t => /У групу «Худі»/.test(t)),
  'варіанту пропонують чужі групи, а свою — ні',
  'меню варіанта не те: ' + JSON.stringify(menu2));
await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  [...d.querySelectorAll('.menu button')].filter(b => /У групу «Худі»/.test(b.textContent))[0].click();
});
await p.waitForTimeout(2500);
const a2 = await ed();
console.log('  ' + JSON.stringify(await state()));
ok(a2.groups.length === 2,
  'груп так само дві — перенесення не злило їх в одну',
  'групи злились: ' + JSON.stringify(a2.groups));
ok((await state()).some(x => /Футболка оверсайз:variant\/Худі:10/.test(x)),
  'варіант переїхав у «Худі» і взяв тираж групи — 10, а не свої 30',
  'переїзд не спрацював: ' + JSON.stringify(await state()));

/* І головне — що з цього побачить клієнт. Документ, який лягає за
   посиланням, має нести обидві групи: сторінка малює кожну своїм блоком і
   тримає окремий вибір та окремий тираж під ключем групи. */
const doc = await p.evaluate(() => {
  const d = offerBuild(orders[0]);
  return { vgroups: (d.variants || []).map(v => v.name + ' → ' + v.vgroup),
           vqty: d.vqty || null };
});
console.log('  у документі: ' + JSON.stringify(doc.vgroups));
ok(doc.vgroups.some(x => /→ Футболки$/.test(x)) && doc.vgroups.some(x => /→ Худі$/.test(x)),
  'у пропозиції клієнта обидві групи — він відповідає на два питання, а не на одне',
  'групи не доїхали в документ: ' + JSON.stringify(doc.vgroups));

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'груп стільки, скільки питань до клієнта — і кожна зі своїм тиражем');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
