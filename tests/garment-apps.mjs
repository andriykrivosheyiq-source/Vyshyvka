/* Які способи нанесення дозволені на виробі.

   ПРОБЛЕМА. На флісі DTF тримається погано: ворс не дає плівці рівно
   прилягти, і через кілька прань краї відходять. Але в конструкторі й у
   прорахунку обидва способи стояли поруч на будь-якому виробі — і рано чи
   пізно хтось порахував би клієнту те, чого ми не зробимо. «Менеджер
   памʼятає, що на фліс не можна» перестає працювати з появою другого
   менеджера.

   Рішення — правило в картці товару, а не в коді: завтра зʼявиться ще один
   фліс, і вимикати спосіб має бути галочкою. Запасний шлях за назвою
   потрібен для того, що вже заведено: усі фліси, яким нічого не задавали,
   одразу без DTF. Явна галочка старша за назву — інакше не було б як
   зробити виняток.

   Перевіряємо:
     — фліс за назвою лишається без DTF, звичайні вироби — з обома;
     — явна галочка перекриває правило за назвою в обидві сторони;
     — конструктор не показує й не дає обрати знятий спосіб;
     — зміна виробу перемикає спосіб, а не лишає недоступний;
     — прорахунок менеджера теж не пропонує знятого способу;
     — зняти обидва не можна: виріб, на який нічого не нанести, не буває.

   Запуск:  node tests/garment-apps.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8835;
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

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html?manager=1', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('═══ ПРАВИЛО: ФЛІС БЕЗ DTF ═══');
const rule = await p.evaluate(() => {
  const A = (gid, name, src) => LQ.garmentApps(gid, name, src).join(',');
  return {
    fleeceById:   A('hoodieoverfleece', 'Худі оверсайз з флісом'),
    fleeceByName: A('custom1', 'Світшот на флісі'),
    fleeceLatin:  A('custom2', 'Fleece hoodie'),
    plain:        A('tee', 'Футболка базова'),
    hoodie:       A('hoodie', 'Худі базове')
  };
});
Object.keys(rule).forEach(k => console.log('  ' + k + ': ' + rule[k]));
ok(rule.fleeceById === 'embro' && rule.fleeceByName === 'embro' && rule.fleeceLatin === 'embro',
  'усі фліси — тільки вишивка, хоч за ключем, хоч за назвою',
  'фліс лишився з DTF: ' + JSON.stringify(rule));
ok(rule.plain === 'embro,dtf' && rule.hoodie === 'embro,dtf',
  'на звичайних виробах обидва способи, як і були',
  'звичайний виріб втратив спосіб: ' + rule.plain);

console.log('');
console.log('═══ ГАЛОЧКА СТАРША ЗА НАЗВУ ═══');
const own = await p.evaluate(() => {
  /* Виняток в обидві сторони: фліс, на якому DTF таки дозволили, і звичайне
     худі, на якому його зняли. */
  const src = { apps:{ hoodieoverfleece:['embro', 'dtf'], hoodie:['embro'] } };
  return {
    fleeceOn: LQ.garmentApps('hoodieoverfleece', 'Худі оверсайз з флісом', src).join(','),
    hoodieOff: LQ.garmentApps('hoodie', 'Худі базове', src).join(','),
    allows: LQ.garmentAllows('hoodie', 'dtf', 'Худі базове', src)
  };
});
console.log('  фліс із дозволом: ' + own.fleeceOn + ' · худі із забороною: ' + own.hoodieOff);
ok(own.fleeceOn === 'embro,dtf',
  'заданий вручну дозвіл перекриває правило за назвою',
  'галочка не подіяла: ' + own.fleeceOn);
ok(own.hoodieOff === 'embro' && own.allows === false,
  'і заборона теж — правило працює на будь-якому виробі, не лише на флісі',
  'заборону не застосували: ' + own.hoodieOff);

console.log('');
console.log('═══ КОНСТРУКТОР НЕ ПОКАЗУЄ ЗНЯТОГО ═══');
const ctor = await p.evaluate(async () => {
  const has = () => [...document.querySelectorAll('[data-print]')].map(b => b.dataset.print);
  /* Відкриваємо звичайне худі з логотипом — перемикач має бути з двох. */
  window.__editProduct({ garmentId:'hoodie', colorId:null, printId:null, qty:{ M:10 },
    logos:{ front:[{ id:'L1', url:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
                     fp:'f1', scale:1, frac:.2, fx:0, fy:0, ar:1 }], back:[], left:[], right:[] } }, null, []);
  await new Promise(r => setTimeout(r, 1400));
  const both = has();
  /* Той самий логотип, але на флісі. */
  window.__editProduct({ garmentId:'hoodieoverfleece', colorId:null, printId:'dtf', qty:{ M:10 },
    logos:{ front:[{ id:'L1', url:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
                     fp:'f1', scale:1, frac:.2, fx:0, fy:0, ar:1 }], back:[], left:[], right:[] } }, null, []);
  await new Promise(r => setTimeout(r, 1400));
  return { both, fleece:has() };
});
console.log('  худі: ' + ctor.both.join(', ') + ' · фліс: ' + (ctor.fleece.join(', ') || '—'));
ok(ctor.both.length === 2 && ctor.both.indexOf('dtf') >= 0,
  'на звичайному худі перемикач із двох способів',
  'перемикач не той: ' + ctor.both.join(','));
ok(ctor.fleece.length === 1 && ctor.fleece[0] === 'embro',
  'на флісі DTF немає навіть у списку — його не можна обрати',
  'DTF лишився на флісі: ' + ctor.fleece.join(','));

/* Найважливіше: обраний DTF не має мовчки лишитись, коли перейшли на фліс —
   інакше ціна порахується за тим, чого ми не зробимо. */
const kept = await p.evaluate(() => {
  /* Дивимось на те, що бачить людина: яка кнопка підсвічена. Стан
     конструктора назовні не виставлений, та й перевіряти треба саме
     видиме — воно й визначає, за яким способом порахується ціна. */
  const on = document.querySelector('[data-print].on');
  return { on: on ? on.dataset.print : null,
           all: [...document.querySelectorAll('[data-print]')].map(b => b.dataset.print) };
});
console.log('  на флісі підсвічено: ' + kept.on);
ok(kept.on === 'embro',
  'обраний DTF сам змінився на дозволений спосіб',
  'на флісі лишився обраний DTF: ' + JSON.stringify(kept));

console.log('');
console.log('═══ ПРОРАХУНОК МЕНЕДЖЕРА Й КАРТКА ТОВАРУ ═══');
const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
ok(/function calcAllows\(/.test(adm) && /calcAllows\('print'\)/.test(adm),
  'прорахунок питає те саме правило, а не має власної думки',
  'у прорахунку правила немає');
ok(/if\(!calcAllows\(a\.technique\)\)/.test(adm),
  'уже обраний знятий спосіб у прорахунку теж не лишається',
  'знятий спосіб у прорахунку лишається обраним');
ok(/id="pc-app-dtf"/.test(adm) && /upd\.products\.apps\[id\] = apps/.test(adm),
  'у картці товару є галочки, і вони зберігаються',
  'у картці товару немає налаштування способів');
ok(/Хоч один спосіб нанесення має лишитись/.test(adm),
  'зняти обидва не дають: виробу, на який нічого не нанести, не буває',
  'можна зберегти товар без жодного способу');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'на флісі DTF більше не запропонують — ні клієнту, ні менеджеру');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
