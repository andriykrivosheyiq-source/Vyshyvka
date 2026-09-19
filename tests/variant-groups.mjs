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
const PORT = 8870;
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
/* Куди покласти варіант, питають власним вікном: у ньому перелічені групи,
   які вже є в цьому КП, і кнопка завести наступну. Назви більше не питають
   узагалі — менеджер просто каже «нова». */
const newGroup = async () => {
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const d = document.querySelector('#offerEd iframe').contentDocument;
    d.querySelector('[data-g-add]').click();
  });
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
ok(a0.groups.length === 1 && a0.groups[0] === 'Група 1',
  'група одна, і вона підписана номером, а не вигаданою назвою',
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
ok(menu.some(t => /^У групу 1$/.test(t)) && menu.some(t => /У нову групу/.test(t)),
  'меню пропонує і наявну групу за номером, і нову',
  'вибору групи в меню немає: ' + JSON.stringify(menu));

await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  [...d.querySelectorAll('.menu button')].filter(b => /У нову групу/.test(b.textContent))[0].click();
});
await newGroup();
await p.waitForTimeout(2500);
const a1 = await ed();
console.log('  групи: ' + JSON.stringify(a1.groups) + ' · тиражі: ' + JSON.stringify(a1.qty));
console.log('  ' + JSON.stringify(await state()));
ok(a1.groups.join() === 'Група 1,Група 2',
  'груп стало дві, і підписані вони номерами по порядку',
  'друга група не завелась: ' + JSON.stringify(a1.groups));
/* Тираж у групі один на всіх, але в РІЗНИХ групах він різний: 30 футболок
   і 10 худі — це два різні числа, і жодне не має підмінити інше. */
ok(a1.qty.join('|').indexOf('Футболки:30') >= 0 && a1.qty.join('|').indexOf(':10') >= 0,
  'тираж у кожної групи свій: 30 в одній і 10 в другій',
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
ok(!menu2.some(t => /^У групу 1$/.test(t)) && menu2.some(t => /^У групу 2$/.test(t)),
  'варіанту пропонують чужі групи, а свою — ні',
  'меню варіанта не те: ' + JSON.stringify(menu2));
await p.evaluate(() => {
  const d = document.querySelector('#offerEd iframe').contentDocument;
  [...d.querySelectorAll('.menu button')].filter(b => /^У групу 2$/.test(b.textContent.trim()))[0].click();
});
await p.waitForTimeout(2500);
const a2 = await ed();
console.log('  ' + JSON.stringify(await state()));
ok(a2.groups.length === 2,
  'груп так само дві — перенесення не злило їх в одну',
  'групи злились: ' + JSON.stringify(a2.groups));
ok((await state()).some(x => /Футболка оверсайз:variant\/Група 2:10/.test(x)),
  'варіант переїхав у другу групу і взяв її тираж — 10, а не свої 30',
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
ok(doc.vgroups.some(x => /→ Футболки$/.test(x)) && doc.vgroups.some(x => /→ Група 2$/.test(x)),
  'у пропозиції клієнта обидві групи — він відповідає на два питання, а не на одне',
  'групи не доїхали в документ: ' + JSON.stringify(doc.vgroups));

console.log('');
console.log('═══ КЛІЄНТ НАЗВ ГРУП НЕ БАЧИТЬ ═══');
/* Назви груп — наш внутрішній спосіб розкласти варіанти на кілька окремих
   виборів. Вигадані менеджером «Футболки» чи «Який верх?» їхали в документ і
   читались клієнтом як наші робочі позначки. Тепер над групою стоїть не
   назва, а правило: з кожної беруть один варіант. */
{
  const VH = path.join(ROOT, '_vg_vhost.html');
  fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1400px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);
  const c = await browser.newPage({ viewport:{ width:920, height:1000 } });
  c.on('pageerror', e => errs.push('клієнт: ' + e.message.slice(0, 160)));
  await c.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await c.goto(HOST + '/_vg_vhost.html', { waitUntil:'domcontentloaded' });
  await c.waitForTimeout(4000);
  const built = await p.evaluate(() => offerBuild(orders[0]));
  await c.evaluate(o => window.__prev(o), built);
  await c.waitForTimeout(1500);
  const seen = await c.frames()[1].evaluate(() => {
    const gs = [...document.querySelectorAll('#variants .vgroup')];
    return { blocks: gs.length,
             heads: gs.map(g => ((g.querySelector('.vgroup-h') || {}).textContent || '').trim()),
             text: (document.getElementById('variants') || {}).innerText || '' };
  });
  console.log('  блоків: ' + seen.blocks + ' · підписи: ' + JSON.stringify(seen.heads));
  ok(seen.blocks === 2, 'клієнт бачить два окремі блоки варіантів',
    'блоків не два: ' + seen.blocks);
  ok(!/Футболки|Група 2|Варіанти на вибір/.test(seen.heads.join(' ')),
    'жодної внутрішньої назви групи над картками немає',
    'назва групи виїхала до клієнта: ' + JSON.stringify(seen.heads));
  ok(seen.heads.every(h => /Оберіть один варіант/.test(h)),
    'замість назви — правило: з кожної групи беруть один варіант',
    'правила над групами немає: ' + JSON.stringify(seen.heads));
  ok(!/Футболки|Група 2/.test(seen.text),
    'і в тексті блоку внутрішніх назв теж немає',
    'назва групи лишилась у тексті блоку');
  await c.close();
  try{ fs.unlinkSync(VH); }catch(e){}
}

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'груп стільки, скільки питань до клієнта — і кожна зі своїм тиражем');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
