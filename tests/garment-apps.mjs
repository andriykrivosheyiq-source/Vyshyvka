/* Які способи нанесення дозволені на виробі.

   ПРОБЛЕМА. На флісі DTF тримається погано: ворс не дає плівці рівно
   прилягти, і через кілька прань краї відходять. Але в конструкторі й у
   прорахунку обидва способи стояли поруч на будь-якому виробі — і рано чи
   пізно хтось порахував би клієнту те, чого ми не зробимо. «Менеджер
   памʼятає, що на фліс не можна» перестає працювати з появою другого
   менеджера.

   Рішення — правило в картці товару, а не в коді: завтра зʼявиться ще одна
   фліска, і вимикати спосіб має бути галочкою. Запасний шлях за назвою
   потрібен для того, що вже заведено: фліски, яким нічого не задавали,
   одразу без DTF. Явна галочка старша за назву — інакше не було б як
   зробити виняток.

   МЕЖА ПРАВИЛА. Слово «фліс» у назві саме по собі нічого не означає: худі з
   флісовою підкладкою — це звичайне ХУДІ, і DTF на ньому тримається. Ворс,
   через який плівка відходить, має фліска — сам виріб із флісу. Тому
   правило шукає назву виробу, а не згадку матеріалу.

   Перевіряємо:
     — фліска за назвою без DTF, а худі з флісом і звичайні вироби — з обома;
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
  const A = name => LQ.garmentApps('x', name).join(',');
  return {
    /* Фліска — сам виріб із флісу. Ось у неї ворс, через який плівка відходить. */
    fleece:     A('Фліска'),
    fleeceCase: A('Фліски чоловічі'),
    fleeceWord: A('Куртка фліска'),
    fleeceEn:   A('Fleece jacket'),
    /* А це худі. Фліс у них усередині, верх звичайний — DTF тримається. */
    hoodieFl:   A('Худі оверсайз з флісом'),
    hoodieLine: A('Худі з флісовою підкладкою'),
    sweatFl:    A('Світшот на флісі'),
    hoodie:     A('Худі базове'),
    plain:      A('Футболка базова')
  };
});
Object.keys(rule).forEach(k => console.log('  ' + k + ': ' + rule[k]));
ok(rule.fleece === 'embro' && rule.fleeceCase === 'embro' &&
   rule.fleeceWord === 'embro' && rule.fleeceEn === 'embro',
  'фліски — тільки вишивка, у будь-якому відмінку',
  'фліска лишилась із DTF: ' + JSON.stringify(rule));
ok(rule.hoodieFl === 'embro,dtf' && rule.hoodieLine === 'embro,dtf' &&
   rule.sweatFl === 'embro,dtf',
  'худі з флісом усередині правила НЕ стосується — це звичайне худі',
  'у худі з флісовою підкладкою забрали DTF: ' + JSON.stringify(rule));
ok(rule.plain === 'embro,dtf' && rule.hoodie === 'embro,dtf',
  'на звичайних виробах обидва способи, як і були',
  'звичайний виріб втратив спосіб: ' + rule.plain);

console.log('');
console.log('═══ ГАЛОЧКА СТАРША ЗА НАЗВУ ═══');
const own = await p.evaluate(() => {
  /* Виняток в обидві сторони: фліс, на якому DTF таки дозволили, і звичайне
     худі, на якому його зняли. */
  const src = { apps:{ fl:['embro', 'dtf'], hoodie:['embro'] } };
  return {
    fleeceOn: LQ.garmentApps('fl', 'Фліска', src).join(','),
    hoodieOff: LQ.garmentApps('hoodie', 'Худі базове', src).join(','),
    allows: LQ.garmentAllows('hoodie', 'dtf', 'Худі базове', src)
  };
});
console.log('  фліска з дозволом: ' + own.fleeceOn + ' · худі із забороною: ' + own.hoodieOff);
ok(own.fleeceOn === 'embro,dtf',
  'заданий вручну дозвіл перекриває правило за назвою',
  'галочка не подіяла: ' + own.fleeceOn);
ok(own.hoodieOff === 'embro' && own.allows === false,
  'і заборона теж — галочкою спосіб можна зняти з будь-якого виробу',
  'заборону не застосували: ' + own.hoodieOff);

console.log('');
console.log('═══ КОНСТРУКТОР НЕ ПОКАЗУЄ ЗНЯТОГО ═══');
const ctor = await p.evaluate(async () => {
  const has = () => [...document.querySelectorAll('[data-print]')].map(b => b.dataset.print);
  const LOGO = { id:'L1', fp:'f1', scale:1, frac:.2, fx:0, fy:0, ar:1,
    url:'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' };
  const open = (gid, printId) => window.__editProduct({ garmentId:gid, colorId:null,
    printId, qty:{ M:10 }, logos:{ front:[LOGO], back:[], left:[], right:[] } }, null, []);
  open('hoodie', null);
  await new Promise(r => setTimeout(r, 1400));
  const both = has();
  /* Знімаємо DTF на цьому виробі так, як це зробить менеджер галочкою. */
  window.SITE_CONTENT.products = Object.assign({}, window.SITE_CONTENT.products,
    { apps:{ hoodie:['embro'] } });
  open('hoodie', 'dtf');
  await new Promise(r => setTimeout(r, 1400));
  const off = has();
  return { both, off };
});
console.log('  до: ' + ctor.both.join(', ') + ' · після зняття: ' + (ctor.off.join(', ') || '—'));
ok(ctor.both.length === 2 && ctor.both.indexOf('dtf') >= 0,
  'поки спосіб дозволений — перемикач із двох',
  'перемикач не той: ' + ctor.both.join(','));
ok(ctor.off.length === 1 && ctor.off[0] === 'embro',
  'знятий спосіб зникає зі списку — його не можна обрати',
  'знятий спосіб лишився: ' + ctor.off.join(','));

/* Найважливіше: обраний DTF не має мовчки лишитись, коли спосіб зняли —
   інакше ціна порахується за тим, чого ми не зробимо. */
const kept = await p.evaluate(() => {
  /* Дивимось на те, що бачить людина: яка кнопка підсвічена. Стан
     конструктора назовні не виставлений, та й перевіряти треба саме
     видиме — воно й визначає, за яким способом порахується ціна. */
  const on = document.querySelector('[data-print].on');
  return { on: on ? on.dataset.print : null,
           all: [...document.querySelectorAll('[data-print]')].map(b => b.dataset.print) };
});
console.log('  підсвічено: ' + kept.on);
ok(kept.on === 'embro',
  'обраний DTF сам змінився на дозволений спосіб',
  'лишився обраний DTF: ' + JSON.stringify(kept));

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
                : 'на фліску DTF більше не запропонують — ні клієнту, ні менеджеру');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
