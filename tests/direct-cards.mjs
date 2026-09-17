/* Картки для Direct — другий формат виводу тієї самої пропозиції.

   ЩО БУЛО НЕ ТАК. Половину клієнтів веде не посилання, а листування, і туди
   треба картинку. Робили її руками в сторонньому редакторі: заново шукали
   мокап, заново вписували ціну. Кожна правка в КП лишала в Direct старе
   число, і дізнавались про це вже від клієнта.

   ЯК МАЄ БУТИ. Картки збираються з тих самих позицій, що вже складені в
   пропозиції. Менеджер не заводить ні товару, ні ціни, ні мокапа — він
   керує тільки показом.

   Перевіряємо:
     — картки збираються самі: по одній на позицію, по одній на КОЖЕН
       варіант, одна спільна на рекомендовані;
     — у картки немає власних чисел: змінилась ціна в пропозиції —
       змінилась і картка;
     — полотно саме того розміру, який шлють у Direct, і воно віддає файл
       (чужий мокап не «бруднить» його — інакше вивантаження падає);
     — усі чотири шаблони малюються;
     — порядок, приховування, свій заголовок і опис працюють;
     — у робочому місці є вкладка, preview малюється, а кнопка вивантаження
       шле готові байти нагору;
     — адмінка приймає налаштування показу й не чіпає через них ціни.

   Запуск:  node tests/direct-cards.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8860;
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

// Мокап заглушкою: data-URL не потребує мережі й не бруднить полотно
const pic = fill => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700">' +
  '<rect width="600" height="700" fill="' + fill + '"/></svg>');

const item = (kind, name, extra) => Object.assign({
  kind, vgroup: kind === 'variant' ? 'Група 1' : '', name,
  color:'Чорний', print:'Вишивка', sizes:'M × 20', qty:20,
  unitPrice:900, price:18000, mockups:[pic('#D8DEE7'), pic('#C3CBD6')],
  views:[], sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:''
}, extra || {});

const OFFER = {
  token:'tokcards', orderId:'1002700',
  client:{ name:'Андрій', company:'ARMORIX' },
  clientLogo: pic('#E8590C'),
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'',
  items:[ item('main', 'Худі базове'), item('main', 'Світшот', { unitPrice:1100, price:22000 }) ],
  variants:[ item('variant', 'Футболка базова'), item('variant', 'Футболка оверсайз') ],
  reco:[ item('reco', 'Кепка', { qty:10, unitPrice:400, price:4000 }),
         item('reco', 'Шопер', { qty:10, unitPrice:300, price:3000 }) ]
};
/* Рекомендованих буває більше, ніж влізе на картку: тоді вибирає менеджер. */
const OFFER6 = JSON.parse(JSON.stringify(OFFER));
OFFER6.reco = ['Кепка','Шопер','Футболка','Бейсболка','Рюкзак','Бафф']
  .map((n, i) => item('reco', n, { qty:10, unitPrice:300 + i * 10, price:3000 }));

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const route = pg => pg.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

/* ══════════ СКЛАД КАРТОК І МАЛЮВАННЯ ══════════ */
const VH = path.join(ROOT, '_cards_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:1280px;height:900px}</style>
 <iframe id="f" src="offer-edit.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__put = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, offer:o, catalog:[] }, '*');
 </script>`);

const p = await browser.newPage({ viewport:{ width:1320, height:900 } });
p.on('pageerror', e => errs.push('робоче місце: ' + e.message.slice(0, 170)));
await route(p);
await p.goto(HOST + '/_cards_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
const fr = p.frames()[1];

console.log('═══ КАРТКИ ЗБИРАЮТЬСЯ САМІ ═══');
const built = await fr.evaluate(o => {
  if(!window.LQCards) return { none:true };
  return { list: window.LQCards.build(o, {}).map(c => ({ id:c.id, kind:c.kind, type:c.type,
             name:c.name, qty:c.qty, unit:c.unit, sum:c.sum, term:c.term, sizes:c.sizes,
             n:(c.items || []).length })) };
}, OFFER);
if(built.none){ console.log('  малювальник не підключений'); bad++; }
else {
  built.list.forEach(c => console.log('   ' + c.id + ' · ' + c.name +
    (c.type === 'set' ? ' · позицій ' + c.n : ' · ' + c.qty + ' шт · ' + c.unit + ' грн')));
  ok(built.list.length === 5,
    'п’ять карток: дві позиції, два варіанти окремо й одна добірка',
    'карток вийшло ' + built.list.length);
  ok(built.list.filter(c => c.kind === 'variant').length === 2,
    'кожен варіант іде своєю карткою — у Direct їх шлють по одній',
    'варіанти не рознесені по картках');
  ok(built.list.filter(c => c.type === 'set').length === 1 &&
     built.list.filter(c => c.type === 'set')[0].n === 2,
    'рекомендовані — однією карткою на всіх: питання «чим доповнити»',
    'добірка рекомендованих не зібралась');
  const sw = built.list.filter(c => c.name === 'Світшот')[0] || {};
  ok(sw.unit === 1100 && sw.qty === 20 && sw.term === 7,
    'числа беруться з пропозиції, своїх у картки немає',
    'числа картки розійшлись із пропозицією: ' + JSON.stringify(sw));
  ok(sw.sum === undefined && sw.sizes === undefined,
    'загальної суми й розмірного ряду на картці немає: сума застаріває від першого ' +
      '«а якщо пʼятдесят», а розміри в Direct не вирішують нічого',
    'на картці лишилось зайве: ' + JSON.stringify({ sum:sw.sum, sizes:sw.sizes }));
}

console.log('');
console.log('═══ СКІЛЬКИ НАНЕСЕНЬ — СТІЛЬКИ Й РАКУРСІВ ═══');
/* Клієнт платить за спину й рукав так само, як за перед. Доти картка
   показувала один-єдиний мокап, і решта сторін на картинку не потрапляла. */
const views = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = (sd, lb) => ({ side:sd, sideLabel:lb, technique:'Вишивка', widthMm:80, heightMm:45 });
  const mk = (n, prints, vs) => Object.assign({}, o.items[0], {
    name:n, prints, views: vs, mockups:['m0'] });
  const three = mk('Три', [P('front','Перед'), P('back','Спина'), P('left','Рукав')],
                   [V('front','A'), V('back','B'), V('left','C')]);
  const two = mk('Дві', [P('front','Перед'), P('back','Спина')],
                 [V('front','A'), V('back','B'), V('left','C')]);
  const none = mk('Без', [], []);
  const list = L.build({ items:[three, two, none], terms:{ deadlineDays:7 } }, {});
  return list.map(c => ({ name:c.name, shots:c.shots, sub:c.sub }));
}, [OFFER]);
views.forEach(v => console.log('   ' + v.name + ' → ' + JSON.stringify(v.shots)));
ok(views[0].shots.join() === 'A,B,C',
  'три сторони з нанесенням — три ракурси на одній картці',
  'ракурси не ті: ' + JSON.stringify(views[0].shots));
ok(views[1].shots.join() === 'A,B',
  'дві сторони — два ракурси, а не всі наявні знімки',
  'узято зайвий ракурс: ' + JSON.stringify(views[1].shots));
ok(views[2].shots.join() === 'm0',
  'позиція без нанесення падає на звичайний мокап, а не лишається порожньою',
  'без нанесення ракурсів немає: ' + JSON.stringify(views[2].shots));

console.log('');
console.log('═══ РОЗКЛАДКУ ВИБИРАЄ КІЛЬКІСТЬ РАКУРСІВ ═══');
/* Дивимось не в код, а в пікселі: кожен ракурс фарбуємо своїм кольором і
   шукаємо його на полотні. Три сторони — три кольори в горішній третині,
   кожен у своїй колонці. Один ракурс — виріб ліворуч, праворуч його немає.

   Доти три знімки втискались у ліву панель, розраховану на один виріб. */
const laid = await fr.evaluate(async ([o]) => {
  const col = (r, g, b) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">' +
    '<rect width="400" height="500" fill="rgb(' + r + ',' + g + ',' + b + ')"/></svg>');
  const C = [[220,20,20], [20,180,20], [20,20,220]];
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = sd => ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 });
  const sides = ['front', 'back', 'left'];
  const mk = n => Object.assign({}, o.items[0], {
    prints: sides.slice(0, n).map(P),
    views: sides.slice(0, n).map((sd, i) => V(sd, col.apply(null, C[i]))),
    mockups: [] });
  const near = (d, i, c) => Math.abs(d[i] - c[0]) < 24 && Math.abs(d[i+1] - c[1]) < 24 &&
                            Math.abs(d[i+2] - c[2]) < 24;
  const scan = async n => {
    const off = { items:[mk(n)], terms:{ deadlineDays:7 }, orderId:'1' };
    const cv = await window.LQCards.draw(window.LQCards.build(off, {})[0], off, { tpl:'minimal' });
    const x = cv.getContext('2d');
    const d = x.getImageData(0, 0, cv.width, cv.height).data;
    // у якій третині ширини трапився кожен колір і чи є він у верхній половині
    const seen = C.map(()=> ({ thirds:{}, top:false }));
    for(let py = 0; py < cv.height; py += 6){
      for(let px = 0; px < cv.width; px += 6){
        const i = (py * cv.width + px) * 4;
        for(let k = 0; k < C.length; k++){
          if(!near(d, i, C[k])) continue;
          seen[k].thirds[Math.floor(px / (cv.width / 3))] = 1;
          if(py < cv.height / 2) seen[k].top = true;
        }
      }
    }
    return seen.map(s => ({ thirds: Object.keys(s.thirds).map(Number).sort(), top: s.top }));
  };
  return { three: await scan(3), one: await scan(1) };
}, [OFFER]);
console.log('   три ракурси → колонки: ' + laid.three.map(s => s.thirds.join('+')).join(' | '));
console.log('   один ракурс → колонки: ' + laid.one.map(s => s.thirds.join('+') || '—').join(' | '));
ok(laid.three.every(s => s.thirds.length && s.top),
  'три ракурси стоять рядом угорі — кожен у своїй колонці',
  'три ракурси розкладені не так: ' + JSON.stringify(laid.three));
ok(laid.three[0].thirds[0] === 0 && laid.three[1].thirds[0] === 1 &&
   laid.three[2].thirds.indexOf(2) >= 0,
  'і в тому ж порядку, що сторони нанесення: перед, спина, рукав',
  'порядок ракурсів поїхав: ' + JSON.stringify(laid.three.map(s => s.thirds)));
ok(laid.one[0].thirds.length && laid.one[0].thirds.indexOf(2) < 0,
  'один ракурс лишився зліва, а праворуч — текст, як було до оновлення',
  'один ракурс розклався не так: ' + JSON.stringify(laid.one[0]));

console.log('');
console.log('═══ КІЛЬКІСТЬ НЕ ДУБЛЮЄТЬСЯ ═══');
console.log('   підзаголовок: «' + views[0].sub + '»');
ok(!/×\s*\d|\d+\s*шт/.test(views[0].sub),
  'у підзаголовку колір і нанесення — без кількості: вона стоїть числом нижче',
  'кількість у підзаголовку повторюється: «' + views[0].sub + '»');

/* Рахуємо тут, поки сторінка жива: нижче вона вже закрита. */
const about = await fr.evaluate(([o]) => {
  const two = JSON.parse(JSON.stringify(o));
  two.items[0].about = 'Щільність 320 г/м², петля без начосу';
  two.reco[0].recoNote = 'Пʼятипанельна, регульований ремінець';
  const c = window.LQCards.build(two, {})[0];
  const off = window.LQCards.build(two, { fields:{ warn:false, about:false } })[0];
  const set = window.LQCards.build(two, {}).filter(x => x.type === 'set')[0];
  return { about: c.about, still: off.about,
           recoNote: !!(set && set.items[0] && set.items[0].note) };
}, [OFFER]);

console.log('');
console.log('═══ ЗМІНИЛАСЬ ЦІНА В КП — ЗМІНИЛАСЬ КАРТКА ═══');
const follow = await fr.evaluate(o => {
  const changed = JSON.parse(JSON.stringify(o));
  changed.items[0].unitPrice = 1234;
  changed.items[0].price = 24680;
  const c = window.LQCards.build(changed, {})[0];
  return { unit: c.unit };
}, OFFER);
console.log('  було 900 грн → стало ' + follow.unit + ' грн');
ok(follow.unit === 1234,
  'картка не тримає власних чисел — вона їх просто показує',
  'картка лишилась зі старою ціною: ' + JSON.stringify(follow));

console.log('');
console.log('═══ ПОЛОТНО Й ФАЙЛ ═══');
const drew = await fr.evaluate(async o => {
  const out = {};
  for(const t of ['minimal', 'horeca', 'auto', 'medical', 'office']){
    const list = window.LQCards.build(o, { tpl:t });
    const cv = await window.LQCards.draw(list[0], o, { tpl:t, industry:'horeca' });
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    out[t] = { w: cv.width, h: cv.height, bytes: blob ? blob.size : 0 };
  }
  // добірка рекомендованих малюється своєю розкладкою
  const set = window.LQCards.build(o, {}).filter(c => c.type === 'set')[0];
  const cs = await window.LQCards.draw(set, o, { tpl:'minimal' });
  const sb = await new Promise(r => cs.toBlob(r, 'image/jpeg', 0.92));
  out.set = { w: cs.width, h: cs.height, bytes: sb ? sb.size : 0 };
  return out;
}, OFFER);
Object.keys(drew).forEach(k => console.log('   ' + k + ': ' + drew[k].w + '×' + drew[k].h +
  ' · ' + Math.round(drew[k].bytes / 1024) + ' КБ'));
ok(Object.keys(drew).every(k => drew[k].w === 1920 && drew[k].h === 1200),
  'формат горизонтальний — 1920×1200, як домовлялись',
  'розмір полотна не той: ' + JSON.stringify(drew));
ok(Object.keys(drew).every(k => drew[k].bytes > 4000),
  'полотно віддає файл — чужий мокап його не забруднив',
  'файл не зібрався: ' + JSON.stringify(drew));

console.log('');
console.log('═══ МЕНЕДЖЕР КЕРУЄ ПОКАЗОМ ═══');
const shown = await fr.evaluate(o => {
  const L = window.LQCards;
  const all = L.build(o, {}).map(c => c.id);
  const moved = L.build(o, { order: all.slice().reverse() }).map(c => c.id);
  const hid = L.build(o, { hidden: { 'main:0': true } });
  const own = L.build(o, { by: { 'main:0': { title:'Худі для команди', note:'Щільність 320' } } })[0];
  // позиція, доданої після того, як порядок склали, не має зникнути
  const partial = L.build(o, { order: ['reco', 'variant:1'] }).map(c => c.id);
  return { all, moved, hidden: hid.filter(c => c.hidden).map(c => c.id),
           title: own.name, note: own.about, partial };
}, OFFER);
console.log('   порядок: ' + shown.all.join(' → '));
console.log('   після перестановки: ' + shown.moved.join(' → '));
ok(shown.moved.join() === shown.all.slice().reverse().join(),
  'порядок карток слухається менеджера',
  'порядок не змінився: ' + shown.moved.join());
ok(shown.partial.length === shown.all.length &&
   shown.partial[0] === 'reco' && shown.partial[1] === 'variant:1',
  'картка, якої в збереженому порядку ще немає, стає в кінець, а не зникає',
  'при частковому порядку загубились картки: ' + shown.partial.join(' → '));
ok(shown.hidden.length === 1 && shown.hidden[0] === 'main:0',
  'приховану картку видно як приховану — її можна повернути',
  'приховування не спрацювало');
ok(shown.title === 'Худі для команди' && shown.note === 'Щільність 320',
  'свій заголовок і опис перебивають те, що взялось із позиції',
  'підписи менеджера не застосувались: ' + JSON.stringify(shown));

console.log('');
console.log('═══ РЕКОМЕНДОВАНИХ БІЛЬШЕ, НІЖ ВЛІЗЕ ═══');
const many = await fr.evaluate(o => {
  const L = window.LQCards;
  const auto = L.build(o, {}).filter(c => c.type === 'set')[0];
  const own = L.build(o, { by:{ reco:{ pick:[4, 1, 5] } } }).filter(c => c.type === 'set')[0];
  return { pool: auto.pool.length, shown: auto.items.map(x => x.name), max: auto.max,
           picked: own.items.map(x => x.name),
           marks: own.pool.filter(r => r.on).map(r => r.name) };
}, OFFER6);
console.log('   рекомендованих ' + many.pool + ', на картці: ' + many.shown.join(' · '));
console.log('   вибір менеджера: ' + many.picked.join(' · '));
ok(many.shown.length === 4 && many.max === 4,
  'за замовчуванням на картку йдуть перші чотири — межа, за якою плитки дрібнішають',
  'на картці позицій ' + many.shown.length);
ok(many.picked.join() === 'Шопер,Рюкзак,Бафф',
  'менеджер може обрати, які саме з них показати — і плитки стоять у порядку складу, ' +
    'а не в порядку його кліків',
  'вибір менеджера не застосувався або поїхав порядок: ' + many.picked.join(' · '));
ok(many.marks.join() === many.picked.join(),
  'і панель показує, з чого саме обирають та що вже обрано',
  'позначки в списку розійшлись із карткою');

console.log('');
console.log('═══ ВКЛАДКА В РОБОЧОМУ МІСЦІ ═══');
await p.evaluate(o => window.__put(o), OFFER);
await p.waitForTimeout(1200);
const tabbed = await fr.evaluate(async () => {
  const t = document.querySelector('[data-view="cards"]');
  if(!t) return { none:true };
  t.click();
  await new Promise(r => setTimeout(r, 2500));
  const cv = document.querySelector('#cdPrev canvas');
  return {
    strip: document.querySelectorAll('#cdStrip .cd-card').length,
    canvas: cv ? { w: cv.width, h: cv.height } : null,
    tpls: [...document.querySelectorAll('#cdBar [data-tpl]')].map(b => b.textContent),
    fields: document.querySelectorAll('#cdBar [data-fld]').length,
    dl: [...document.querySelectorAll('#cdBar [data-dl]')].map(b => b.textContent.trim()),
    head: (document.getElementById('cdPrevH') || {}).textContent || '',
    workHidden: document.getElementById('paneWork').classList.contains('hide')
  };
});
if(tabbed.none){ console.log('  вкладки немає'); bad++; }
else {
  console.log('   карток у стрічці: ' + tabbed.strip + ' · шаблони: ' + tabbed.tpls.join(', '));
  console.log('   preview: ' + (tabbed.canvas ? tabbed.canvas.w + '×' + tabbed.canvas.h : 'немає'));
  ok(!/Editorial|Corporate|Industry/.test(tabbed.tpls.join()),
    'абстрактних назв шаблонів більше немає — менеджер обирає, кому надсилає',
    'лишились абстрактні шаблони: ' + tabbed.tpls.join(', '));
  ok(tabbed.strip === 5, 'у стрічці всі картки пропозиції',
    'у стрічці ' + tabbed.strip + ' карток');
  ok(tabbed.canvas && tabbed.canvas.w === 1920,
    'preview — це те саме полотно, що збережеться у файл',
    'preview не намалювався');
  ok(tabbed.tpls.length === 5 && tabbed.fields === 6,
    'шаблони — мінімалістичний і чотири ніші, і шість перемикачів полів',
    'смуга налаштувань неповна: ' + JSON.stringify(tabbed));
  ok(tabbed.dl.length === 2, 'є «скачати цю» і «скачати всі»',
    'кнопок вивантаження немає');
  ok(/Як це побачить клієнт/.test(tabbed.head),
    'над preview сказано, що це вже готовий файл, а не ще одна панель редактора',
    'підпису над preview немає: «' + tabbed.head + '»');
  ok(tabbed.workHidden,
    'конструктор на час карток ховається — місце віддане preview',
    'робоче поле лишилось поверх карток');
}

console.log('');
console.log('═══ ВИВАНТАЖЕННЯ ЙДЕ НАГОРУ БАЙТАМИ ═══');
/* Завантажує файли адмінка: у неї вже є архів і переклад імені в латиницю.
   Кадр лише малює й віддає готові байти. */
await fr.evaluate(async () => {
  const b = [...document.querySelectorAll('#cdBar [data-dl]')].filter(x => x.dataset.dl === 'all')[0];
  if(b) b.click();
  await new Promise(r => setTimeout(r, 6000));
});
const sent = await p.evaluate(() => (window.__sent || [])
  .filter(m => m.act === 'cards' || m.act === 'cardsDownload')
  .map(m => m.act === 'cardsDownload'
    ? { act:m.act, n:(m.files || []).length,
        names:(m.files || []).map(f => f.name),
        bytes:(m.files || []).reduce((a, f) => a + (f.data ? f.data.length : 0), 0) }
    : { act:m.act, tpl:(m.cards || {}).tpl }));
sent.forEach(s => console.log('   ' + JSON.stringify(s).slice(0, 150)));
const dl = sent.filter(s => s.act === 'cardsDownload')[0];
ok(!!dl && dl.n === 5,
  'нагору пішли всі п’ять карток',
  'файли не полетіли: ' + JSON.stringify(dl || null));
ok(!!dl && dl.bytes > 20000,
  'і це справжні байти картинок, а не порожні місця',
  'файли порожні: ' + JSON.stringify(dl || null));
ok(!!dl && dl.names.every(n => /^kp-1002700-\d\d-/.test(n)),
  'імена файлів несуть номер КП і порядок — у теці вони ляжуть як у пропозиції',
  'імена файлів не ті: ' + JSON.stringify((dl || {}).names));
try{ fs.unlinkSync(VH); }catch(e){}
await p.close();

/* ══════════ АДМІНКА ══════════ */
console.log('');
console.log('═══ ПІДПИС, ЗАСТЕРЕЖЕННЯ Й ОПИС ═══');
/* Текст на полотні не прочитати — тож перевіряємо джерело: чим підписана
   картка, звідки береться застереження й чи доїхав опис виробу. */
const src = fs.readFileSync(path.join(ROOT, 'loomiq-cards.js'), 'utf8');
ok(!/loomiq\.net/.test(src),
  'на картці більше немає адреси сайту — підписуємось брендом',
  'у картці лишився loomiq.net');
ok(/brandName\(offer\)/.test(src) && /\(offer \|\| \{\}\)\.brand/.test(src),
  'підпис береться з бренду замовлення: від кого пішла пропозиція, від того й картка',
  'бренд у футер не потрапляє');
ok(/clientLogo/.test(src) && /x\.drawImage\(logo/.test(src),
  'логотип клієнта малюється на картці, а не лише дає колір',
  'логотип клієнта на картку не потрапляє');
ok(/Кольори на екрані передаються по-різному/.test(src),
  'застереження про кольори й розмір нанесення — те саме, що бачить клієнт у КП',
  'застереження на картці немає');
ok(about.about === 'Щільність 320 г/м², петля без начосу',
  'опис виробу доїжджає на картку з картки товару',
  'опису виробу немає: «' + about.about + '»');
ok(about.still === about.about,
  'вимкнене поле лишається в даних — його просто не малюють',
  'вимкнення поля стерло дані');
ok(/\u0414\u043e \u0446\u044c\u043e\u0433\u043e \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0431\u0435\u0440\u0443\u0442\u044c/.test(src) && about.recoNote,
  'у рекомендованих є короткий опис, а заголовок говорить про клієнта, а не про нас',
  'добірка лишилась без опису або зі старим заголовком');

console.log('');
console.log('═══ АДМІНКА ПРИЙМАЄ НАЛАШТУВАННЯ ПОКАЗУ ═══');
const ap = await browser.newPage({ viewport:{ width:1400, height:1000 } });
ap.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 170)));
await route(ap);
await ap.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await ap.waitForTimeout(5200);
const adm = await ap.evaluate(async () => {
  const o = { id:'c1', orderId:'1002700', name:'Андрій', items:[
    { kind:'main', name:'Худі', garmentId:'hoodie', qty:20, unitPrice:900, price:18000 } ] };
  orders.length = 0; orders.push(o);
  window.offerEdOrder = () => o;
  const wasPrice = o.items[0].unitPrice;
  await offerEdApply({ act:'cards', cards:{ tpl:'editorial', hidden:{ 'main:0':true } } });
  return { cards: o.cards, price: o.items[0].unitPrice, wasPrice };
});
console.log('   у замовленні: ' + JSON.stringify(adm.cards));
ok(adm.cards && adm.cards.tpl === 'editorial' && adm.cards.hidden['main:0'] === true,
  'налаштування показу лягли в замовлення — переживуть перезавантаження',
  'налаштування не збереглись: ' + JSON.stringify(adm.cards));
ok(adm.price === adm.wasPrice,
  'і ціни від зміни шаблону не зрушили — це показ, а не дані',
  'зміна шаблону зрушила ціну: ' + adm.wasPrice + ' → ' + adm.price);
const pushed = await ap.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return /doc\.cards\s*=\s*o\.cards/.test(src);
});
ok(pushed, 'налаштування їдуть у робоче місце тим самим шляхом, що й решта',
  'робоче місце не отримує налаштувань карток');

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'той самий склад пропозиції виводиться картинками для Direct');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
