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
  ok(sw.unit === 1100 && sw.qty === 20,
    'числа беруться з пропозиції, своїх у картки немає',
    'числа картки розійшлись із пропозицією: ' + JSON.stringify(sw));
  ok(sw.sum === undefined && sw.sizes === undefined && sw.term === undefined,
    'ні суми, ні розмірного ряду, ні терміну: сума застаріває від першого «а якщо ' +
      'пʼятдесят», розміри в Direct не вирішують нічого, а термін, названий у ' +
      'листуванні, стає обіцянкою, яку картка пережила',
    'на картці лишилось зайве: ' + JSON.stringify({ sum:sw.sum, sizes:sw.sizes, term:sw.term }));
}

console.log('');
console.log('═══ ПЕРЕД І ЗАД — ЗАВЖДИ ═══');
/* Клієнт дивиться на виріб, а не на наш перелік сторін. Картка з одним
   логотипом на грудях показувала один знімок — і перше питання у відповідь
   було рівно одне: «а ззаду що?». */
const views = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = sd => ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 });
  const all = [V('front','A'), V('back','B'), V('left','C')];
  const mk = (n, sides) => Object.assign({}, o.items[0], {
    name:n, prints: sides.map(P), views: all, mockups:['m0'] });
  const bare = Object.assign({}, o.items[0], { name:'Без', prints:[], views:[], mockups:['m0'] });
  const list = L.build({ items:[
    mk('Тільки перед', ['front']),
    mk('Перед і спина', ['front','back']),
    mk('Із рукавом', ['front','back','left']),
    mk('Тільки спина', ['back']),
    bare
  ], terms:{ deadlineDays:7 } }, {});
  return list.map(c => ({ name:c.name, shots:c.shots.map(sh => sh.url),
                          labels:c.shots.map(sh => sh.label), sub:c.sub }));
}, [OFFER]);
views.forEach(v => console.log('   ' + v.name + ' → ' + JSON.stringify(v.shots)));
ok(views[0].shots.join() === 'A,B',
  'нанесення тільки спереду — на картці все одно перед і зад',
  'показано не те: ' + JSON.stringify(views[0].shots));
ok(views[3].shots.join() === 'A,B',
  'нанесення тільки ззаду — так само перед і зад, і в тому ж порядку',
  'показано не те: ' + JSON.stringify(views[3].shots));
ok(views[1].shots.join() === 'A,B',
  'перед і спина — два ракурси',
  'показано не те: ' + JSON.stringify(views[1].shots));
ok(views[2].shots.join() === 'A,B,C',
  'зʼявився рукав — додається третім, а не заміняє собою зад',
  'показано не те: ' + JSON.stringify(views[2].shots));
ok(views[4].shots.join() === 'm0',
  'коли ракурсів немає зовсім, лишається звичайний мокап',
  'без ракурсів картка порожня: ' + JSON.stringify(views[4].shots));

console.log('');
console.log('═══ РОЗКЛАДКА: ЗНІМКИ ВГОРІ, ЧИСЛА СМУГОЮ ВНИЗУ ═══');
/* Дивимось не в код, а в пікселі: кожен ракурс фарбуємо своїм кольором і
   шукаємо його на полотні. */
const laid = await fr.evaluate(async ([o]) => {
  const col = (r, g, b) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">' +
    '<rect width="400" height="500" fill="rgb(' + r + ',' + g + ',' + b + ')"/></svg>');
  const C = [[220,20,20], [20,180,20], [20,20,220]];
  const sides = ['front', 'back', 'left'];
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = sd => ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 });
  const near = (d, i, c) => Math.abs(d[i] - c[0]) < 24 && Math.abs(d[i+1] - c[1]) < 24 &&
                            Math.abs(d[i+2] - c[2]) < 24;
  const scan = async n => {
    const it = Object.assign({}, o.items[0], {
      prints: sides.slice(0, n).map(P),
      views: sides.map((sd, i) => V(sd, col.apply(null, C[i]))),
      mockups: [] });
    const off = { items:[it], terms:{ deadlineDays:7 }, orderId:'1' };
    const cv = await window.LQCards.draw(window.LQCards.build(off, {})[0], off, { tpl:'minimal' });
    const x = cv.getContext('2d');
    const d = x.getImageData(0, 0, cv.width, cv.height).data;
    const seen = C.map(()=> ({ x0: 1e9, x1: -1, y0: 1e9, y1: -1 }));
    for(let py = 0; py < cv.height; py += 6){
      for(let px = 0; px < cv.width; px += 6){
        const i = (py * cv.width + px) * 4;
        for(let k = 0; k < C.length; k++){
          if(!near(d, i, C[k])) continue;
          const s = seen[k];
          if(px < s.x0) s.x0 = px;
          if(px > s.x1) s.x1 = px;
          if(py < s.y0) s.y0 = py;
          if(py > s.y1) s.y1 = py;
        }
      }
    }
    return { seen, h: cv.height, w: cv.width };
  };
  return { three: await scan(3), one: await scan(1) };
}, [OFFER]);
const drawn = s => s.seen.filter(v => v.x1 >= 0);
console.log('   три нанесення → ракурсів на полотні: ' + drawn(laid.three).length);
console.log('   одне нанесення → ракурсів на полотні: ' + drawn(laid.one).length);
ok(drawn(laid.three).length === 3,
  'три сторони — три знімки рядом угорі',
  'знімків на полотні: ' + drawn(laid.three).length);
ok(laid.three.seen[0].x1 < laid.three.seen[1].x0 &&
   laid.three.seen[1].x1 < laid.three.seen[2].x0,
  'і в тому ж порядку, що сторони: перед, спина, рукав — без накладань',
  'знімки налазять один на одного: ' + JSON.stringify(laid.three.seen));
ok(drawn(laid.one).length === 2,
  'одне нанесення — на полотні все одно два знімки: перед і зад',
  'знімків на полотні: ' + drawn(laid.one).length);
/* Ракурси рівноправні: три знімки — три однакові колонки, і колонки ті
   однакові не приблизно, а до пікселя. Саме на цьому тримається вся
   розкладка — «головного» фото більше немає. */
const widths = drawn(laid.three).map(v => v.x1 - v.x0);
console.log('   ширини знімків: ' + widths.join(' · '));
ok(widths.every(w => Math.abs(w - widths[0]) <= 12),
  'колонки рівні між собою — жоден ракурс не «головний»',
  'колонки різної ширини: ' + widths.join(' · '));
/* Три сталі смуги: шапка — хто й що, галерея — виріб, низ — числа. Смуги
   сталі навмисно: дві картки поруч у стрічці Direct мають вирівнюватись
   між собою, а не кожна по-своєму. */
ok(drawn(laid.three).every(v => v.y0 > laid.three.h * 0.14),
  'знімки починаються під шапкою — верх віддано логотипу, назві й номеру КП',
  'знімок заліз у шапку: ' + JSON.stringify(drawn(laid.three).map(v => v.y0)));
ok(drawn(laid.three).every(v => v.y1 < laid.three.h * 0.82),
  'і не залазять у смугу чисел унизу',
  'знімок заліз у числа: ' + JSON.stringify(drawn(laid.three).map(v => v.y1)));
ok(drawn(laid.three).some(v => v.y1 > laid.three.h * 0.70),
  'виріб заповнює колонку, а не плаває в ній: порожні поля мокапа обрізаються',
  'виріб не дістає низу колонки: ' + JSON.stringify(drawn(laid.three).map(v => v.y1)));

console.log('');
console.log('═══ ЛИСТ ШИРШАЄ ВІД КІЛЬКОСТІ ФОТО ═══');
/* Порожніх зон на картці не буває — не тому, що їх ретельно заповнили, а
   тому, що їх нема звідки взятись: ширина рахується з кількості колонок. */
console.log('   три ракурси: ' + laid.three.w + '×' + laid.three.h +
            ' · два: ' + laid.one.w + '×' + laid.one.h);
ok(laid.three.h === 1000 && laid.one.h === 1000,
  'висота стала — 1000 пікселів на будь-якій картці',
  'висота попливла: ' + laid.three.h + ' / ' + laid.one.h);
ok(laid.one.w === 1400 && laid.three.w === 2040,
  'а ширина росте: два фото — 1400, три — 2040',
  'ширина не та: ' + laid.one.w + ' / ' + laid.three.w);

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
  /* Характеристики мають бути ПОПЕРЕДУ опису: опис — це речення, написане
     людиною, і буває яким завгодно, а характеристики заповнені фактами. */
  const three = JSON.parse(JSON.stringify(two));
  three.items[0].specs = [{ label:'Матеріал', value:'футер тринитка' },
                          { label:'Щільність', value:'330 г/м²' }];
  const sp = window.LQCards.build(three, {})[0];
  return { about: c.about, still: off.about, specs: sp.about,
           recoNote: !!(set && set.items[0] && set.items[0].note) };
}, [OFFER]);

console.log('');
console.log('═══ СТАРА ЦІНА Й ЗНИЖКА ═══');
/* Своєї «старої ціни» картка не вигадує: бере базову ціну позиції за тим
   самим правилом, що й сторінка пропозиції — показує, лише якщо вона
   більша за поточну. Інакше картка й КП рано чи пізно розійшлися б у тому,
   скільки саме клієнт економить. */
const cut = await fr.evaluate(async o => {
  const L = window.LQCards;
  const hi = JSON.parse(JSON.stringify(o)); hi.items[0].baseUnitPrice = 1200;
  const lo = JSON.parse(JSON.stringify(o)); lo.items[0].baseUnitPrice = 700;
  const draw = async (off, fields) =>
    (await L.draw(L.build(off, {})[0], off, { tpl:'minimal', fields })).toDataURL('image/png');
  return { base: L.build(hi, {})[0].base,
           withCut: await draw(hi), noCut: await draw(lo), hidden: await draw(hi, { old:false }) };
}, OFFER);
console.log('   базова ціна на картці: ' + cut.base + ' грн (поточна 900)');
ok(cut.base === 1200,
  'стара ціна береться з базової ціни позиції — своїх чисел у картки немає',
  'базова ціна не доїхала: ' + cut.base);
ok(cut.withCut !== cut.noCut,
  'перекреслену ціну й «−25 %» показуємо, лише коли базова більша за поточну',
  'картка зі знижкою й без неї малюються однаково');
ok(cut.hidden === cut.noCut,
  'вимкнене поле «Стара ціна» прибирає і перекреслене число, і бейдж',
  'вимкнене поле однаково щось малює');

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
ok(Object.keys(drew).every(k => drew[k].w === 1400 && drew[k].h === 1000),
  'формат горизонтальний: дві колонки — 1400×1000 на всіх шаблонах',
  'розмір полотна не той: ' + JSON.stringify(drew));
ok(Object.keys(drew).every(k => drew[k].bytes > 4000),
  'полотно віддає файл — чужий мокап його не забруднив',
  'файл не зібрався: ' + JSON.stringify(drew));

console.log('');
console.log('═══ БЛИЗНЮКІВ У ГАЛЕРЕЇ НЕ БУВАЄ ═══');
/* Той самий перед приїздить із ракурсів і з мокапів РІЗНИМИ файлами — це
   два рендери одного кадру. У галереї вони ставали близнюками, між якими
   клієнт шукає різницю, якої немає. */
const twins = await fr.evaluate(o => {
  const L = window.LQCards;
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = sd => ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 });
  const it = Object.assign({}, o.items[0], {
    name:'Худі', views:[V('front','FRONT'), V('back','BACK')], prints:[P('front')],
    /* Мокапи — інші файли того самого переду й заду: так їх і складає
       конструктор, окремим рендером. */
    mockups:['MOCK-FRONT', 'MOCK-BACK'] });
  const shots = cfg => L.build({ items:[it], terms:{} }, cfg)[0].shots.map(s => s.url);
  return {
    plain: shots({}),
    /* Менеджер тицьнув у мокап переду — він має ЗАМІНИТИ перед, а не стати
       ще одним кадром поруч із ним. */
    picked: shots({ by:{ 'main:0': { pic:'MOCK-FRONT' } } }),
    badge: L.build({ items:[it], variants:[Object.assign({}, it, { kind:'variant' })],
                     terms:{} }, {}).map(c => c.badge)
  };
}, OFFER);
console.log('   без вибору: ' + twins.plain.join(' · '));
console.log('   з обраним мокапом: ' + twins.picked.join(' · '));
ok(twins.plain.length === 2 && new Set(twins.plain).size === 2,
  'без вибору — два кадри, перед і зад, кожен один раз',
  'уже без вибору дублі: ' + twins.plain.join(' · '));
ok(twins.picked.length === 2 && twins.picked[0] === 'MOCK-FRONT' &&
   twins.picked.indexOf('FRONT') < 0,
  'обраний мокап ЗАМІНЯЄ кадр, а не додається: «який мокап узяти» — це вибір, а не ще один кадр',
  'обраний мокап породив близнюка: ' + twins.picked.join(' · '));
ok(twins.badge.length === 2 && twins.badge[0] === 'позиція' && twins.badge[1] === 'варіант',
  'варіант у стрічці підписаний варіантом: він часто зветься так само, як головна позиція',
  'варіант не відрізнити від позиції: ' + JSON.stringify(twins.badge));

console.log('');
console.log('═══ ФОТО МОДЕЛІ ПЕРШИМ КАДРОМ ═══');
/* Мокап показує виріб, але не показує, що це одяг: людина дивиться на
   розкладений силует і мусить уявити його на комусь. Фото моделі знімає цю
   роботу з неї — і тоді задній вид стає необовʼязковим: два кадри на
   картці потрібні завжди, але порожня спина заради симетрії — це віддати
   колонку нічому. */
const model = await fr.evaluate(([o, host]) => {
  const L = window.LQCards;
  const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
  const P = sd => ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 });
  const all = [V('front','A'), V('back','B'), V('left','C')];
  const mk = sides => Object.assign({}, o.items[0], {
    name:'Худі', garmentId:'hoodie', prints: sides.map(P), views: all, mockups:['m0'],
    config:{ garmentId:'hoodie', logos:{ front:[{ url:'ART' }] } } });
  const models = { hoodie: [{ url: host + '/images/model-hoodie-man.webp', cx:50, cy:45, sw:32 }] };
  const shots = (sides, mm) => L.build({ items:[mk(sides)], terms:{} }, { models: mm })[0].shots;
  return {
    /* Тільки перед: фото моделі + перед. Спини немає — на ній нічого немає. */
    one: shots(['front'], models).map(s => (s.model ? 'модель' : s.side)),
    /* Спина з нанесенням — приїздить окремою колонкою. */
    back: shots(['front','back'], models).map(s => (s.model ? 'модель' : s.side)),
    /* Без фото моделі все як було: перед і зад завжди. */
    none: shots(['front'], {}).map(s => (s.model ? 'модель' : s.side)),
    mark: (shots(['front'], models)[0] || {}).mark,
    art: L.build({ items:[mk(['front'])], terms:{} }, { models })[0].art,
    /* Свій логотип нанесення перебиває той, що приїхав із конструктора, —
       і перебиває його на ВСІХ картках пропозиції одразу. */
    own: L.build({ items:[mk(['front']), mk(['front'])], terms:{} },
                 { models, art:'OWN' }).map(c => c.art)
  };
}, [OFFER, HOST]);
console.log('   тільки перед: ' + model.one.join(' · '));
console.log('   з нанесенням на спині: ' + model.back.join(' · '));
console.log('   без фото моделі: ' + model.none.join(' · '));
/* ОБОВʼЯЗКОВІ ДВА КАДРИ: фото на моделі й мокап спереду. Далі — рівно ті
   сторони, на яких СПРАВДІ Є НАНЕСЕННЯ. Чиста спина клієнту нічого не
   каже, а колонку займає; сторона з нанесенням, навпаки, мусить бути, і
   аркуш під неї розширюється. */
ok(model.one.length === 2 && model.one[0] === 'модель' && model.one[1] === 'front',
  'обовʼязкові два кадри: на моделі й спереду — чистої спини серед них немає',
  'склад кадрів не той: ' + model.one.join(' · '));
ok(model.back.length === 3 && model.back[2] === 'back',
  'є нанесення на спині — зʼявляється третій кадр',
  'спина з нанесенням загубилась: ' + model.back.join(' · '));
ok(model.none.length === 2 && model.none[0] === 'front' && model.none[1] === 'back',
  'немає фото моделі — перед і зад, як було: два кадри на картці потрібні завжди',
  'без фото моделі склад зламався: ' + model.none.join(' · '));
/* Фото моделі приходить ракурсом — тим самим списком, що перед і спина.
   Так його видно там, де збирають пропозицію, і ховається воно тією ж
   галочкою, що й решта. */
const asView = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const it = JSON.parse(JSON.stringify(o.items[0]));
  it.views = [
    { id:'vmodel', side:'model', label:'На моделі', img:'MODEL.webp', show:true,
      model:true, mark:{ cx:0.42, cy:0.38, w:0.26 } },
    { id:'vf', side:'front', label:'Перед', img:'F.webp', show:true },
    { id:'vb', side:'back',  label:'Спина', img:'B.webp', show:true }
  ];
  /* Нанесення на спині ставимо навмисно: перевіряємо ПОРЯДОК кадрів, а
     спина потрапляє в ряд лише тоді, коли на ній справді щось є. Без
     нанесення тут перевірявся б уже інший факт. */
  it.prints = [{ side:'front' }, { side:'back' }];
  const c = L.build({ items:[it], terms:{} }, {})[0];
  const hid = JSON.parse(JSON.stringify(it));
  hid.views[0].show = false;
  const c2 = L.build({ items:[hid], terms:{} }, {})[0];
  return { кадри: c.shots.map(s => (s.model ? 'модель' : s.side)),
           якір: c.shots[0] && c.shots[0].mark,
           безМоделі: c2.shots.map(s => (s.model ? 'модель' : s.side)) };
}, [OFFER]);
console.log('   ракурсом: ' + asView.кадри.join(' · ') +
            ' · схований: ' + asView.безМоделі.join(' · '));
ok(asView.кадри.join() === 'модель,front,back',
  'фото моделі приходить ракурсом і стає першим кадром, перед і спина за ним',
  'ракурс моделі не підхопився: ' + asView.кадри.join(' · '));
ok(asView.якір && Math.abs(asView.якір.cx - 0.42) < 0.01,
  'разом із ним їде розміщення нанесення — його не ловлять заново в картці',
  'розміщення з ракурсу не доїхало: ' + JSON.stringify(asView.якір));
ok(asView.безМоделі.join() === 'front,back',
  'сховали ракурс — фото моделі зникає з картки тією ж галочкою, що й решта',
  'схований ракурс усе одно намалювався: ' + asView.безМоделі.join(' · '));
ok(model.mark && Math.abs(model.mark.cx - 0.5) < 0.01 && Math.abs(model.mark.w - 0.32) < 0.01,
  'якір із каталогу каже, де на цьому фото груди — менеджер не ловить місце з нуля',
  'якір не доїхав: ' + JSON.stringify(model.mark));
ok(model.art === 'ART',
  'графіка нанесення береться з того самого шару, що ліг на мокап',
  'нанесення не знайшлось: ' + model.art);
ok(model.own.length === 2 && model.own.every(a => a === 'OWN'),
  'замінений логотип підхоплюють УСІ картки пропозиції: різні його версії ' +
    'на сусідніх картках — не варіативність, а неуважність',
  'заміна логотипа не розійшлась по картках: ' + JSON.stringify(model.own));

console.log('');
console.log('═══ УМОВА ЦІНИ, ТЕРМІН ДІЇ Й ПІДПИС ═══');
const sale = await fr.evaluate(async o => {
  const L = window.LQCards;
  const off = JSON.parse(JSON.stringify(o));
  off.brand = { name:'Створи', ig:'stvory.ua' };
  off.terms = { validUntil:'2026-09-23T10:00:00.000Z', holdDays:5 };
  const draw = async f => {
    const cv = await L.draw(L.build(off, {})[0], off, { tpl:'minimal', fields:f });
    return cv.toDataURL('image/png');
  };
  return { all: await draw({}), noValid: await draw({ valid:false }),
           on: await draw({ valid:true }), qty: L.build(off, {})[0].qty };
}, OFFER);
ok(sale.qty === 20,
  'тираж лишився в даних — але як УМОВА ціни, «від 20 шт», а не окремим числом: ' +
    'окреме число застаріває від першого «а якщо пʼятдесят»',
  'тираж загубився: ' + sale.qty);
/* Термін дії ціни вимкнений за замовчуванням: рядок «Ціна дійсна до 25
   вересня» читається як тиск, а не як умова. Полем його вмикають. */
ok(sale.all === sale.noValid && sale.on !== sale.all,
  'термін дії ціни за замовчуванням не малюється, але вмикається полем',
  'поле «Термін дії ціни» поводиться не так');

console.log('');
console.log('═══ ФОТО ТОВАРУ ЗАПОВНЮЄ ПЛИТКУ ═══');
/* Мокапи приходять зі своїм тлом — у базового худі воно, наприклад, не
   біле, а тепле бежеве. Доти ми те тло вирізали й ставили виріб на свою
   білу панель: по краю плитки виходив кантик, а на місці бежевого фону —
   білий прямокутник. Тепер кадр іде як є й перекриває плитку до країв. */
const fill = await fr.evaluate(async o => {
  const L = window.LQCards;
  /* Мокап із ТЕПЛИМ фоном і виробом посередині — рівно те, на що скаржився
     Андрій: фон не білий, а система робила його білим. */
  const warm = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">' +
    '<rect width="400" height="500" fill="#E8DCC8"/>' +
    '<rect x="80" y="90" width="240" height="320" fill="#7A1F2B"/></svg>');
  const one = u => ({ items:[Object.assign({}, o.items[0],
                       { mockups: u ? [u] : [], views:[], prints:[] })],
                      terms:{ deadlineDays:7 }, orderId:'1', clientLogo:o.clientLogo });
  const shot = async (u, cfg) => {
    const off = one(u);
    const cv = await L.draw(L.build(off, {})[0], off, Object.assign({ tpl:'minimal' }, cfg));
    const x = cv.getContext('2d');
    return { png: cv.toDataURL('image/png'), w: cv.width,
             at: (px, py) => Array.from(x.getImageData(px, py, 1, 1).data).slice(0, 3) };
  };
  const plain = await shot(warm, {});
  const small = await shot(warm, { logo:0.5 });
  const big   = await shot(warm, { logo:1.8 });
  const GREEN = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">' +
    '<rect width="40" height="40" fill="#1E9E4A"/></svg>');
  const none  = await shot('', { bg:GREEN });
  return {
    /* Точка біля самого краю плитки: там має бути рідний фон мокапа, а не
       біла панель під ним. */
    edge: plain.at(412, 400),
    /* І точка на виробі — щоб не вийшло, що ми просто залили все тлом. */
    body: plain.at(Math.round(plain.w / 2), 400),
    smallPng: small.png, bigPng: big.png,
    nonePix: none.at(412, 400), sheet: none.at(20, 400)
  };
}, OFFER);
console.log('   край плитки: ' + fill.edge.join(',') + ' · виріб: ' + fill.body.join(','));
ok(fill.edge[0] > 200 && fill.edge[2] < fill.edge[0] - 15,
  'по краю плитки стоїть рідний фон мокапа, а не біла панель — кантика немає',
  'край плитки не фон мокапа: ' + fill.edge.join(','));
ok(fill.body[0] > 90 && fill.body[1] < 80,
  'і сам виріб на місці — плитку заповнив кадр, а не суцільна заливка',
  'виробу на плитці не видно: ' + fill.body.join(','));
ok(fill.smallPng !== fill.bigPng,
  'масштаб логотипа справді міняє картку',
  'повзунок лого ні на що не впливає');
/* Немає фото — немає й плитки. Доти на її місці стояв напис «Макет буде
   додано», тобто половина галереї повідомляла клієнтові, що ми ще не
   готові. Краще одна картка з одним фото, ніж дві, з яких одна порожня. */
console.log('   плитка без фото: ' + fill.nonePix.join(','));
ok(fill.nonePix.join(',') === fill.sheet.join(','),
  'фото немає — плитки теж немає, аркуш лишається чистим',
  'на місці відсутнього фото щось намальовано: ' + fill.nonePix.join(','));

console.log('');
console.log('═══ ГАРНІТУРА ═══');
/* Шрифт картка тягне сама, з власного модуля: полотно бере гарнітуру на
   момент малювання, тож про неї має дбати той, хто малює, а не сторінка,
   яка його підключила. А мережі може й не бути — саме цей прогін іде з
   заблокованим зовнішнім світом, і всі картки вище намалювались запасним
   стеком, не розсипавшись. */
const font = await fr.evaluate(() =>
  ((document.querySelector('link[data-lq-font]') || {}).href || ''));
ok(/Manrope/.test(font) && /wght@400;600;800/.test(font),
  'картка тягне свою гарнітуру сама — Manrope, три ваги, одна сімʼя на весь аркуш',
  'гарнітура не підключається: ' + font);

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
console.log('═══ ПЕРЕД І СПИНА ОДНАКОВОГО РОЗМІРУ ═══');
/* Андрій побачив це одразу: на картці перед великий, а спина вдвічі
   менша. Причина не в оформленні. Знімки сторін робляться різного
   розміру — сторона з нанесенням на 1600 пікселів, без нанесення на
   900, — а картка застосовувала до всіх кадрів один множник.

   Перевіряємо по самому виробу: беремо два кадри з ОДНАКОВИМ виробом, але
   різною кількістю пікселів, і дивимось, якого розміру він виходить у
   плитці. Числа мають зійтись. */
const розмір = await fr.evaluate(async () => {
  const L = window.LQCards;
  /* Два кадри одного виробу: чорний прямокутник на сірому тлі. Другий
     утричі дрібніший у пікселях — рівно те, що робить знімок сторони без
     нанесення. */
  const кадр = (side, k) => {
    const c = document.createElement('canvas');
    c.width = 300 * k; c.height = 300 * k;
    const x = c.getContext('2d');
    x.fillStyle = '#E9E6E7'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#101010';
    x.fillRect(75 * k, 60 * k, 150 * k, 180 * k);     // «виріб» — половина кадру
    return c.toDataURL('image/png');
  };
  const it = { kind:'main', name:'Худі', garmentId:'hoodie', qty:20, unitPrice:900,
    views:[ { id:'vf', side:'front', img: кадр('front', 3), show:true },
            { id:'vb', side:'back',  img: кадр('back', 1),  show:true } ],
    prints:[{ side:'front' }, { side:'back' }], mockups:[] };
  const c = L.build({ items:[it], terms:{} }, {})[0];
  const cv = await L.draw(c, { items:[it], terms:{} }, {});
  /* Міряємо темні плями на полотні: скільки пікселів заввишки кожна. */
  const x = cv.getContext('2d');
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  const кол = {};
  for(let yy = 0; yy < cv.height; yy++) for(let xx = 0; xx < cv.width; xx++){
    const i = (yy * cv.width + xx) * 4;
    if(d[i] < 40 && d[i+1] < 40 && d[i+2] < 40){
      const пів = xx < cv.width / 2 ? 'л' : 'п';
      const b = кол[пів] = кол[пів] || { y0: 1e9, y1: -1 };
      if(yy < b.y0) b.y0 = yy; if(yy > b.y1) b.y1 = yy;
    }
  }
  const h = k => (кол[k] && кол[k].y1 >= 0) ? (кол[k].y1 - кол[k].y0 + 1) : 0;
  return { ліворуч: h('л'), праворуч: h('п') };
});
console.log('   висота виробу: ліворуч ' + розмір.ліворуч + ' px · праворуч ' + розмір.праворуч + ' px');
ok(розмір.ліворуч > 0 && розмір.праворуч > 0 &&
   Math.abs(розмір.ліворуч - розмір.праворуч) / розмір.ліворуч < 0.05,
  'перед і спина одного розміру, хоч знімки й різної роздільності',
  'кадри різного розміру: ' + розмір.ліворуч + ' проти ' + розмір.праворуч);

console.log('');
console.log('═══ ПРО ТОВАР: ФАКТИЧНЕ НАНЕСЕННЯ, ДВІ КОЛОНКИ ═══');
/* У картці товару рядок «Нанесення» описує, ЩО МИ ВМІЄМО — «DTF друк та
   вишивка». На картці конкретного замовлення має стояти те, що справді
   буде на цих футболках: клієнт читає її як опис СВОГО замовлення, і
   «друк та вишивка» на вишитій партії — просто неправда. */
const проТовар = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const specs = [{ label:'Матеріал', value:'100% бавовна' },
                 { label:'Нанесення', value:'DTF друк та вишивка' }];
  const мк = extra => L.build({ items:[{ ...o.items[0], specs, ...extra }], terms:{} }, {})[0];
  const вишивка = мк({ techniques:['Вишивка'], prints:[{ side:'front', technique:'Вишивка' }] });
  const обидва  = мк({ techniques:['Вишивка', 'DTF принт'] });
  const мовчки  = мк({ techniques:[], prints:[], print:'' });
  const рядок = c => (c.specs || []).map(s => s.label + ' ' + s.value).join(' · ');
  return { вишивка: рядок(вишивка), обидва: рядок(обидва), мовчки: рядок(мовчки) };
}, [OFFER]);
console.log('   тільки вишивка: ' + проТовар.вишивка);
console.log('   два способи:    ' + проТовар.обидва);
ok(/Нанесення Вишивка$/.test(проТовар.вишивка),
  'на вишитій партії в характеристиках стоїть вишивка, а не «друк та вишивка»',
  'нанесення не фактичне: ' + проТовар.вишивка);
ok(/Нанесення Вишивка \+ DTF принт/.test(проТовар.обидва),
  'на переді друк, на спині вишивка — так і пишемо, обома словами',
  'два способи не склались: ' + проТовар.обидва);
ok(/Нанесення DTF друк та вишивка/.test(проТовар.мовчки),
  'нічим підказати — лишаємо те, що стоїть у картці товару, а не порожнє місце',
  'без способу характеристика зникла: ' + проТовар.мовчки);
/* Суцільний рядок через крапки читається як дрібний абзац, і клієнт його
   гортає. Пари стовпчиком читаються поглядом: ліворуч про що, праворуч
   скільки. */
const src0 = fs.readFileSync(path.join(ROOT, 'loomiq-cards.js'), 'utf8');
ok(/function specRows/.test(src0) && /eyebrow\(x, 'Про товар'/.test(src0),
  'характеристики йдуть однією колонкою, рядок за рядком, під заголовком «Про товар»',
  'колонки немає або заголовок старий');
/* Логотип клієнта й назва виробу — два різні голоси: ліворуч чий це
   бренд, праворуч що за виріб. Без розділювача назва читається як
   продовження логотипа. */
ok(/Риска між знаком і назвою/.test(src0),
  'між логотипом і назвою стоїть риска — вони не зливаються в одне',
  'розділювача в шапці немає');

console.log('');
console.log('═══ НАНЕСЕННЯ ЗВУТЬСЯ ПО-РІЗНОМУ, А КАДР ОДИН ═══');
/* Тут і жила поломка, через яку спина не доїжджала на картку.

   У картці замовлення сторони з нанесенням лежать у `prints`. А в
   ПРОПОЗИЦІЇ те саме робоче місце кладе в `sides` — і картка, яка читала
   тільки `prints`, у справжніх даних завжди бачила порожньо. Зникали всі
   кадри, крім переду й моделі: спина з логотипом є, а на картці її немає.

   Перевіряємо обидва імені: позиція з тим самим складом має дати той
   самий ряд кадрів, хоч як називається поле. */
const імена = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const mv = { id:'vmodel', side:'model', label:'На моделі', img:'M.webp',
               show:true, model:true };
  const views = [mv, { id:'vf', side:'front', img:'F.webp', show:true },
                     { id:'vb', side:'back',  img:'B.webp', show:true }];
  const сторони = [{ side:'front' }, { side:'back' }];
  const кадри = it => (L.build({ items:[it], terms:{} }, {})[0].shots || [])
    .map(s => s.model ? 'модель' : (s.side || '—'));
  const base = { ...o.items[0], views, mockups:[] };
  return { картка:  кадри({ ...base, prints: сторони, sides: undefined }),
           пропоз:  кадри({ ...base, prints: undefined, sides: сторони }) };
}, [OFFER]);
console.log('   з полем prints: ' + імена.картка.join(' · '));
console.log('   з полем sides:  ' + імена.пропоз.join(' · '));
ok(імена.пропоз.join() === 'модель,front,back',
  'нанесення з пропозиції теж дають свої кадри — спина не зникає',
  'у пропозиції спина губиться: ' + імена.пропоз.join(' · '));
ok(імена.картка.join() === імена.пропоз.join(),
  'обидва імені поля дають однаковий ряд: назва поля — не привід втратити кадр',
  'ряди розійшлись: ' + імена.картка.join(' · ') + ' проти ' + імена.пропоз.join(' · '));

console.log('');
console.log('═══ СТОРОНА З НАНЕСЕННЯМ НЕ ЗНИКАЄ ═══');
/* Андрій бачив замовлення, де нанесення на спині є, а кадру немає. Способів
   загубити його виявилось кілька, і кожен мовчазний: ракурс без картинки,
   ракурс із тією ж адресою, що й перед, і нанесення без указаної сторони. */
const lost = await fr.evaluate(([o]) => {
  const L = window.LQCards;
  const mv = { id:'vmodel', side:'model', label:'На моделі', img:'M.webp',
               show:true, model:true };
  const mk = (views, prints) => ({ ...o.items[0], views, prints, mockups:[] });
  const shots = c => (c.shots || []).map(s => s.model ? 'модель' : (s.side || '—'));
  const ok3 = L.build({ items:[mk(
    [mv, { id:'vf', side:'front', img:'F.webp', show:true },
          { id:'vb', side:'back', img:'B.webp', show:true }],
    [{ side:'front' }, { side:'back' }])], terms:{} }, {})[0];
  const noSide = L.build({ items:[mk(
    [mv, { id:'vf', side:'front', img:'F.webp', show:true },
          { id:'vb', side:'back', img:'B.webp', show:true }],
    [{ widthMm:90 }, { widthMm:200 }])], terms:{} }, {})[0];
  const sleeve = L.build({ items:[mk(
    [mv, { id:'vf', side:'front', img:'F.webp', show:true },
          { id:'vs', side:'sleeve', img:'S.webp', show:true }],
    [{ side:'front' }, { side:'sleeve' }])], terms:{} }, {})[0];
  const gone = L.build({ items:[mk(
    [mv, { id:'vf', side:'front', img:'F.webp', show:true }],
    [{ side:'front' }, { side:'back' }])], terms:{} }, {})[0];
  return { ok3: shots(ok3), noSide: shots(noSide), sleeve: shots(sleeve),
           gone: shots(gone), втрачено: gone.lost,
           ш2: L.sheetW(2), ш3: L.sheetW(3), ш4: L.sheetW(4) };
}, [OFFER]);
console.log('   зі спиною: ' + lost.ok3.join(' · ') + ' · з рукавом: ' + lost.sleeve.join(' · '));
console.log('   аркуш: 2 кадри ' + lost.ш2 + ' · 3 ' + lost.ш3 + ' · 4 ' + lost.ш4);
ok(lost.ok3.join() === 'модель,front,back',
  'нанесення на спині — і спина на картці',
  'спина не додалась: ' + lost.ok3.join(' · '));
ok(lost.sleeve.join() === 'модель,front,sleeve',
  'це не про спину: будь-яка сторона з нанесенням отримує свій кадр',
  'рукав не додався: ' + lost.sleeve.join(' · '));
ok(lost.noSide.length === 3,
  'нанесення без указаної сторони — стара позиція — теж не губиться',
  'стара позиція втратила кадр: ' + lost.noSide.join(' · '));
ok(lost.ш3 > lost.ш2 && lost.ш4 > lost.ш3,
  'аркуш розширюється вбік під кожен додатковий кадр',
  'ширина не росте: ' + [lost.ш2, lost.ш3, lost.ш4].join(' · '));
ok(lost.втрачено && /ззад/i.test(lost.втрачено.join(' ')),
  'а якщо фото для сторони немає взагалі — картка каже про це словами, ' +
    'бо мовчки клієнт не побачить половини роботи',
  'втрату не назвали: ' + JSON.stringify(lost.втрачено));

console.log('');
console.log('═══ КАРТКА НЕ РОЗМІЩУЄ НАНЕСЕННЯ ═══');
/* Перспектива й саме розміщення поїхали у ЗБИРАННЯ — там, де менеджер
   ставить логотип на виріб. Тут лишилась перевірка межі: картка малює
   кадр як є і своєї геометрії нанесення не має. Через неї логотип і
   з'їжджав: власного місця картка не знала й брала якір «груди взагалі».
   Сам нахил перевіряє tests/model-view.mjs, у конструкторі. */
const плаский = await fr.evaluate(() => {
  const L = window.LQCards;
  return { є: Object.keys(L), мітка: 'MARK0' in L };
});
ok(!плаский.мітка && плаский.є.indexOf('homography') < 0,
  'малювальник карток більше не знає ні якоря нанесення, ні перетворень: ' +
    'рішення про місце ухвалюється в одному місці, і це не тут',
  'у картці лишилась власна геометрія: ' + плаский.є.join(', '));

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
    workHidden: document.getElementById('paneWork').classList.contains('hide'),
    logo: !!document.getElementById('cdLogo'),
    cut: !!document.getElementById('cdCut'),
    shades: [...document.querySelectorAll('#cdBar [data-shade]')].map(b => b.textContent),
    cutBulk: !!document.getElementById('cut-all'),
    bgUp: !!document.getElementById('cdBgF'),
    artUp: !!document.getElementById('cdArtF'),
    warnBox: !!document.getElementById('cdWarn'),
    more: !!document.getElementById('cdMore'),
    advHidden: !!(document.querySelector('.cd-adv') || {}).classList &&
               document.querySelector('.cd-adv').classList.contains('hide')
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
  ok(tabbed.canvas && tabbed.canvas.w === 1400 && tabbed.canvas.h === 1000,
    'preview — це те саме полотно, що збережеться у файл',
    'preview не намалювався');
  ok(tabbed.tpls.length === 5 && tabbed.fields === 6,
    'шаблони — мінімалістичний і чотири ніші, і шість перемикачів полів',
    'смуга налаштувань неповна: ' + JSON.stringify(tabbed));
  ok(tabbed.dl.length === 2, 'є «скачати цю» і «скачати всі»',
    'кнопок вивантаження немає');
  console.log('   лого ' + (tabbed.logo ? 'є' : 'немає') +
              ' · фон ' + (tabbed.bgUp ? 'є' : 'немає') +
              ' · зняття фону ' + (tabbed.cut ? 'є' : 'немає'));
  ok(tabbed.logo && tabbed.bgUp && tabbed.artUp,
    'у смузі є все, чим керують показом: масштаб лого, свій логотип нанесення, свій фон',
    'смуга стилю неповна: ' + JSON.stringify(tabbed));
  /* Зняття фону прибрано зовсім. Фото товару йде на картку як є: рівного
     тла в мокапах не буває, і будь-яке вирізання лишало по контуру обідок,
     а на місці бежевого фону — білий прямокутник. */
  ok(!tabbed.cut && !tabbed.shades.length,
    'ні галочки «прибрати фон», ні тіні в смузі більше немає',
    'керування зняттям фону лишилось у смузі');
  ok(tabbed.warnBox,
    'і є місце під рядок про те, що з мокапом не вийшло — просто під кадром, а не тостом',
    'рядка про невдачу немає');
  ok(tabbed.more && tabbed.advHidden,
    'налаштування «раз на пропозицію» згорнуті під однією кнопкою: на видноті ' +
      'лишається те, чим користуються щоразу — розмір лого, формат і вивантаження',
    'смуга розгорнута повністю: ' + JSON.stringify({ more:tabbed.more, hidden:tabbed.advHidden }));
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
const opened = await fr.evaluate(async () => {
  document.getElementById('cdMore').click();
  await new Promise(r => setTimeout(r, 300));
  return !document.querySelector('.cd-adv').classList.contains('hide');
});
ok(opened, 'натиснув — налаштування розгорнулись другим рядом',
  'кнопка налаштувань нічого не розкриває');

console.log('');
console.log('═══ СТИЛЬ ДОЇЖДЖАЄ В ЗАМОВЛЕННЯ ═══');
/* Налаштування показу живуть у самому замовленні — інакше менеджер
   налаштував би картку, закрив вкладку й почав спочатку. */
const styleSent = await fr.evaluate(async () => {
  const before = window.parent.__sent.length;
  const rng = document.getElementById('cdLogo');
  rng.value = '150';
  rng.dispatchEvent(new Event('input'));
  rng.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 1200));
  const msgs = window.parent.__sent.slice(before).filter(m => m.act === 'cards');
  return msgs.length ? msgs[msgs.length - 1].cards : null;
});
console.log('   у замовлення пішло: ' + JSON.stringify(styleSent && { logo:styleSent.logo }));
ok(styleSent && Math.abs(styleSent.logo - 1.5) < 0.01,
  'масштаб лого лягає в замовлення — переживе перезавантаження',
  'стиль не доїхав: ' + JSON.stringify(styleSent));

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
ok(/clientLogo/.test(src) && /function drawLogo/.test(src),
  'логотип клієнта малюється на картці, а не лише дає колір',
  'логотип клієнта на картку не потрапляє');
/* Відступ між знаком і назвою рахувався від краю ФАЙЛУ разом із його
   прозорими полями — а вони бувають у півлоготипа завширшки. Виходила
   дірка на пів шапки, і назва з'їжджала до центру картки. */
ok(/function inkBox/.test(src) && /var LOGO_GAP/.test(src),
  'відступ до назви міряється по самій літері, а не по краю файлу',
  'логотип і далі відміряється разом із прозорими полями');
ok(/function monoLogo/.test(src),
  'логотип можна перефарбувати: білий знак на білій картці не видно взагалі',
  'кольору логотипа немає');
ok(/Кольори на екрані передаються по-різному/.test(src),
  'застереження про кольори й розмір нанесення — те саме, що бачить клієнт у КП',
  'застереження на картці немає');
ok(about.about === 'Щільність 320 г/м², петля без начосу',
  'опис виробу доїжджає на картку з картки товару',
  'опису виробу немає: «' + about.about + '»');
ok(about.specs === 'Матеріал футер тринитка · Щільність 330 г/м²',
  'а є характеристики — на картку йдуть саме вони: опис буває яким завгодно, ' +
    'характеристики заповнені фактами',
  'характеристики не переважили опис: «' + about.specs + '»');
ok(about.still === about.about,
  'вимкнене поле лишається в даних — його просто не малюють',
  'вимкнення поля стерло дані');
ok(/\u0414\u043e \u0446\u044c\u043e\u0433\u043e \u0437\u0430\u0437\u0432\u0438\u0447\u0430\u0439 \u0431\u0435\u0440\u0443\u0442\u044c/.test(src) && about.recoNote,
  'у рекомендованих є короткий опис, а заголовок говорить про клієнта, а не про нас',
  'добірка лишилась без опису або зі старим заголовком');

console.log('');
console.log('═══ ШАПКА, ЦІНА Й ФОТО ═══');
/* Шапка: «КП» перед номером нічого не додавало — людина й так тримає в
   руках картку пропозиції; нік пишемо латиницею, як його й пишуть. */
ok(/'Inst: @' \+ ig/.test(src) && !/КП № /.test(src),
  'у підписі стоїть «Inst: @нік» і номер без слова «КП»',
  'підпис лишився старим');
ok(/'№' \+ offer\.orderId/.test(src),
  'номер пропозиції — просто «№12345»',
  'номер пишеться не так');
/* Стара ціна стоїть поруч із новою, і без «/шт» читалась як сума за все
   замовлення. */
ok(/money\(base\) \+ '\/шт'/.test(src),
  'перекреслена ціна теж у грн/шт — обидва числа в одних одиницях',
  'стара ціна лишилась без «/шт»');
/* Колір і спосіб нанесення більше не підставляються замість опису. */
ok(!/show\('sub'\) && card\.sub/.test(src),
  'замість опису більше не підставляється «Чорний · Вишивка» — опис тільки з адмінки',
  'колір і нанесення досі підміняють опис виробу');
/* Фото товару йде як є й заповнює плитку: ні вирізання, ні тіні, ні полів
   навколо, через які й було видно кантик. */
ok(!/cutOf|__lqCut|SHADE|shadowBlur/.test(src),
  'зняття фону й тінь із малювальника прибрані',
  'у малювальнику лишилось вирізання або тінь');
ok(/x\.drawImage\(im, X \+ bw \/ 2 - cx \* k/.test(src),
  'кадр малюється цілим і заповнює плитку до країв — кантика по краю немає',
  'знімок і далі вписується з полями');
/* Виріб має бути цілий: кадри приходять різних пропорцій, і «заповнити
   плитку» на високому мокапі означало б зрізати худі рукави й низ.

   Спільна на ряд тепер ПОКАЗАНА ШИРИНА КАДРУ, а не множник: інакше кадр
   на 900 пікселів виходив удвічі дрібнішим за сусідній на 1600. Ширину
   беремо найменшу з тих, які витримує кожен кадр, — щойно вона більша,
   чийсь виріб вилазить за плитку. */
ok(/function rowZoom/.test(src) && /Math\.min\(z, bw \* im\.width \/ tr\.w/.test(src),
  'спільний розмір ряду береться так, щоб жоден виріб не виліз за плитку',
  'масштаб і далі може зрізати виріб');
ok(/function tintOf/.test(src) && /__lqTint/.test(src),
  'плитка береться кольором фону самого мокапа — межі не видно',
  'колір плитки не залежить від мокапа');

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
/* Фото моделей читаються з файлу конструктора. Колись увесь конструктор
   лежав усередині index.html, потім виїхав в окремий файл — а адмінка й далі
   шукала таблицю за старою адресою. Мовчки: список виходив порожній, у
   картці товару стояло «додайте свої», а в картку для Direct фото моделі не
   приїжджало взагалі. */
const models = await ap.evaluate(async () => {
  const std = await loadStandardModels();
  const forCards = await cardModelsMap();
  return {
    виробів: Object.keys(std).length,
    футболка: (std.tee || []).map(m => m.src),
    якір: !!((std.tee || [])[0] || {}).cx,
    вКартки: Object.keys(forCards).length,
    урл: ((forCards.tee || [])[0] || {}).url || ''
  };
});
console.log('   стандартних фото моделей: ' + models.виробів + ' виробів · футболка: ' +
            models.футболка.join(', '));
ok(models.виробів >= 4 && models.футболка.length >= 3,
  'стандартні фото моделей знаходяться — по кілька на виріб',
  'фото моделей не розібрались: ' + JSON.stringify(models));
ok(models.якір,
  'разом із якорем логотипа — де на цьому фото груди',
  'якір нанесення не дочитався');
ok(models.вКартки >= 4 && /model-tee/.test(models.урл),
  'і йдуть у картки для Direct першим кадром',
  'у картки фото моделей не потрапляють: ' + models.урл);

/* Характеристики їдуть у пропозицію ТІ САМІ, що показує сторінка товару.

   Своїх характеристик у базі в більшості товарів немає — і не тому, що їх
   не заповнили: збіг зі стандартними туди просто не пишеться. Порожнеча в
   базі означає «стоять стандартні», а не «нема жодних». Сприйняти її
   буквально ми вже пробували: на сайті у «Футболки базової» характеристики
   є, менеджер їх бачить, а в пропозицію не доїжджало нічого — і клієнт
   читав саму назву.

   Опис — інша річ: стандартного опису не існує, його або написали, або ні. */
const noSpecs = await ap.evaluate(() => {
  const before = JSON.stringify(contentData.specs || {});
  contentData.specs = {};
  contentData.descriptions = {};
  const out = { specs: itemSpecs({ garmentId:'tee' }), about: itemAbout({ garmentId:'tee' }) };
  contentData.specs = JSON.parse(before);
  return out;
});
console.log('   без власних: ' + noSpecs.specs.map(s => s.label).join(' · '));
ok(noSpecs.specs.length === 5 && noSpecs.specs.some(s => /матеріал/i.test(s.label)),
  'власних характеристик немає — беруться стандартні, рівно ті, що на сторінці товару',
  'характеристики не доїхали: ' + JSON.stringify(noSpecs.specs));
ok(!noSpecs.about,
  'а опис не вигадується: стандартного опису не існує, його або написали, або ні',
  'звідкись узявся опис: ' + noSpecs.about);

const pushed = await ap.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return /doc\.cards\s*=\s*o\.cards/.test(src);
});
ok(pushed, 'налаштування їдуть у робоче місце тим самим шляхом, що й решта',
  'робоче місце не отримує налаштувань карток');
/* Пакетне вирізання фону в картці товару теж прибране — разом зі словником
   вирізаних мокапів і платними викликами сервісу. */
const noCut = await ap.evaluate(() => ({
  btn: !!document.getElementById('cut-all'),
  dict: typeof window.cutMany !== 'undefined' || /CUT_DOC/.test(document.documentElement.innerHTML)
}));
ok(!noCut.btn && !noCut.dict,
  'в адмінці більше немає ні кнопки «вирізати фон», ні словника вирізаних мокапів',
  'зняття фону лишилось в адмінці: ' + JSON.stringify(noCut));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'той самий склад пропозиції виводиться картинками для Direct');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
