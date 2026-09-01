/* Низ пропозиції: заклик одразу за сумою, під ним — рівно те, що знімає
   останній сумнів, і аж тоді згортки.

   Це не лендинг: людина прийшла з переписки й за десять секунд має побачити
   свій бренд, свій товар, ціну й дату. Усе інше лише допомагає зважитись і
   не має стояти на дорозі до кнопки. Тест стереже саме цей порядок:
   кошторис → заклик → чотири гарантії з одним відгуком → згортки →
   менеджер → коротка кнопка в кінці.

   Запуск:  node tests/offer-bottom.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8795;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_bottom_vhost.html');
fs.writeFileSync(VH,
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:430px;height:1400px}</style>
   <iframe id="f" src="offer.html?demo=1"></iframe><script>
   var q = new URLSearchParams(location.search), f = document.getElementById('f');
   if(q.get('w')) f.style.width = parseInt(q.get('w'),10) + 'px';
   window.__push = (o, prev) => f.contentWindow.postMessage(
     { lqEditInit:true, preview:!!prev, offer:o }, '*');
   </script>`);

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = []; let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#E8EDF3"/></svg>');
const FP = Array.from({length:144},(_,i)=>(i*1)%5).join('');
const item = { kind:'main', vgroup:'', name:'Футболка поло', color:'Чорна',
  print:'Вишивка логотипа', sizes:'M × 4', qty:4, unitPrice:1450, price:5800,
  basePrice:8500, baseUnitPrice:2125, mockups:[PH], prints:[],
  views:[{side:'front', label:'Перед', img:PH, show:true}],
  sides:[], techniques:[], tiers:[], specs:[], about:'',
  desc:{ method:'embro', units:4, base:300, coefPart:200, pieceFee:20, dtfCols:[],
         designs:[FP], designKinds:['img'], bare:false } };
const OFFER = extra => Object.assign({
  orderId:'1000941', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, payment:'50% для запуску, решта після готовності партії',
          startWith:'', validUntil:'2026-09-02T12:00:00.000Z' },
  trust:['Працюємо з ФОП та ТОВ, надаємо всі необхідні документи'],
  faq:[['Чи можна змінити тираж?','Так, до запуску у виробництво.'],
       ['Скільки коштує доставка?','Новою поштою за тарифами перевізника.']],
  cases:[{ name:'ТОВ Ромашка', qty:'120 виробів', note:'Вишивка на поло', photo:PH }],
  state:'', reco:[], variants:[], state_pick:{}, items:[ item ],
  manager:{ name:'Олег Панченко', role:'Ваш менеджер', phone:'+380671112233' },
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1},{from:10,coef:.6}] } },
    tiers:[{from:1,coef:1},{from:10,coef:.6}], garmentTiers:[{from:1,coef:1}] }
}, extra || {});

const open = async (w, offer, preview) => {
  const p = await browser.newPage({ viewport:{ width:w + 20, height:1000 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
  await p.route('**://**', r => { const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort(); });
  await p.goto(HOST + '/_bottom_vhost.html?w=' + w, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  await p.evaluate(d => window.__push(d.o, d.prev), { o:offer, prev:!!preview });
  await p.waitForTimeout(2500);
  return p;
};
const read = fr => fr.evaluate(() => {
  const tx = s => { const e = document.querySelector(s);
    return e ? e.textContent.replace(/\s+/g,' ').trim() : ''; };
  const секції = [...document.querySelectorAll('section')].map(s => s.className || '—');
  /* Рядки бувають двох видів: розкривні (details) і ті, що ведуть на сайт
     (a.fr-link) — відгуки. Виглядають однаково, тож і читаємо однаково. */
  const рядки = [...document.querySelectorAll('.fold .fr')].map(d => ({
    назва: ((d.querySelector('summary') || d.querySelector('.fr-t') ||
             {}).textContent || '').trim(),
    посилання: d.tagName === 'A' ? d.getAttribute('href') : '',
    відкрито: !!d.open,
    висота: Math.round(d.getBoundingClientRect().height) }));
  const y = s => { const e = document.querySelector(s);
    return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; };
  return {
    секції: секції,
    гарантій: document.querySelectorAll('.fold .tru-l li').length,
    смужкаФото: document.querySelectorAll('.rev-strip i').length,
    оцінка: tx('.fr-a'),
    карток: document.querySelectorAll('.cond-c').length,
    рядки: рядки,
    менеджерВидно: !!document.querySelector('.mgr'),
    менеджерУСписку: !!document.querySelector('.fold .mgr'),
    заголовокСписку: (document.querySelector('.fold-h') || {}).textContent || '',
    заголовківУнизу: [...document.querySelectorAll('.fold .fr h2')].length,
    /* Рядок, а не картка: рамки навколо кожного пункту робили зі списку
       шість окремих обʼєктів замість однієї таблиці змісту. */
    рамокУРядка: (function(){ const r = document.querySelector('.fold .fr');
      if(!r) return -1; const c = getComputedStyle(r);
      return ['Top','Left','Right'].filter(k => parseFloat(c['border'+k+'Width']) > 0).length; })(),
    шеврон: (function(){ const r = document.querySelector('.fold .fr>summary');
      if(!r) return ''; const c = getComputedStyle(r, '::after');
      return c.borderRightWidth + '/' + c.borderBottomWidth; })(),
    порядок: { кошторис:y('.est'), список:y('.fold'),
               менеджер:y('.mgr'), останній:y('.cta-last') },
    закликів: document.querySelectorAll('.cta-wrap').length,
    висотаХвоста: (function(){
      const e = document.querySelector('.est'), c = document.querySelector('.fold');
      if(!e || !c) return -1;
      return Math.round(c.getBoundingClientRect().top - e.getBoundingClientRect().bottom);
    })()
  };
});

console.log('═══ НИЗ ПРОПОЗИЦІЇ · КОМПʼЮТЕР ═══');
let p = await open(1000, OFFER());
let d = await read(p.frames()[1]);
console.log('  секції: ' + d.секції.join(' → '));
console.log('  галочок у рядку довіри: ' + d.гарантій + ' · оцінка: ' + d.оцінка +
            ' · фото в смужці: ' + d.смужкаФото + ' · закликів: ' + d.закликів);
d.рядки.forEach(x => console.log('   ' + (x.відкрито ? '▾ ' : '▸ ') + x.назва));
console.log('  від кошторису до кнопки: ' + d.висотаХвоста + ' px');
console.log('');
ok(d.гарантій === 4,
  'чотири конкретні гарантії — у своєму рядку списку, а не окремим блоком',
  'галочок: ' + d.гарантій);
/* Рядок «Відгуки · 5,0 ★★★★★», а під ним смужка фото робіт — точно як у
   картці товару на сайті. Фото видно без розкриття: воно і є доказ. */
ok(/★/.test(d.оцінка) && /4,9/.test(d.оцінка) && d.смужкаФото > 0,
  'відгуки рядком з оцінкою (' + d.оцінка + ') і смужкою з ' + d.смужкаФото + ' фото',
  'оцінка: ' + d.оцінка + ', фото: ' + d.смужкаФото);
/* Відгуки живуть на сайті: там їх видно всі, зі своїм блоком. Розкривати
   стрічку карток у самій пропозиції означало б зробити з неї лендинг. */
const rev = d.рядки.filter(x => /^Відгуки/.test(x.назва))[0];
ok(rev && /reviews/.test(rev.посилання || ''),
  'рядок відгуків веде на сторінку сайту: ' + (rev && rev.посилання),
  'відгуки не ведуть на сайт: ' + JSON.stringify(rev));
/* Заголовка над списком немає навмисно: «Що ще варто знати» нічого не
   додавало до того, що й так видно з назв пунктів, зате робило зі змісту
   ще один розділ — саме там, де людина вже дочитала суму. */
ok(!d.заголовокСписку,
  'над списком немає зайвого заголовка — одразу пункти',
  'заголовок повернувся: ' + d.заголовокСписку);
ok(d.закликів === 1,
  'заклик один — у кінці: другий одразу за кошторисом повторював кнопку в ньому',
  'закликів на сторінці: ' + d.закликів);
ok(d.порядок.кошторис < d.порядок.список && d.порядок.список < d.порядок.менеджер &&
   d.порядок.менеджер < d.порядок.останній,
  'порядок: кошторис → згортки → менеджер → заклик',
  'порядок збився: ' + JSON.stringify(d.порядок));
const names = d.рядки.map(x => x.назва);
ok(names[0] === 'Як проходитиме замовлення' &&
   names[1] === 'Замовлення без зайвих ризиків' &&
   names[2] === 'Умови замовлення' && names[3] === 'Реалізовані проєкти' &&
   /^Відгуки/.test(names[4]),
  'у згортках усе: процес, гарантії, умови, проєкти й відгуки',
  'список не той: ' + JSON.stringify(names));
ok(names.length === 7 && /тираж/.test(names[5]) && /доставка/i.test(names[6]),
  'питання — рядками того ж списку, без гармошки в гармошці',
  'питання не в списку: ' + JSON.stringify(names));
/* Тепер згорнуті ВСІ: над списком уже стоять гарантії й відгук, тож
   службовим хвостом він не читається, а кожен відкритий рядок — це ще
   екран між клієнтом і кнопкою. */
ok(d.рядки.every(x => !x.відкрито),
  'усі рядки згорнуті — над ними вже є те, що переконує',
  'стан рядків: ' + JSON.stringify(d.рядки.map(x => x.відкрито)));
ok(d.менеджерВидно && !d.менеджерУСписку,
  'картка менеджера лишилась на видноті: телефон у згортці не шукають',
  'менеджер: видно ' + d.менеджерВидно + ', у списку ' + d.менеджерУСписку);
ok(d.рамокУРядка === 0 && /2px\/2px/.test(d.шеврон),
  'рядки в стилі переходу: волосяна лінія знизу й шеврон, без рамок',
  'рядок не той: рамок ' + d.рамокУРядка + ', шеврон ' + d.шеврон);
ok(d.заголовківУнизу === 0,
  'усередині рядків немає других заголовків — назву несе сам рядок',
  'заголовків усередині: ' + d.заголовківУнизу);
await p.close();

// Скільки насправді виграли: те саме без згортання було б у рази довшим
console.log('═══ ДОВЖИНА ХВОСТА ═══');
p = await open(390, OFFER());
let m = await read(p.frames()[1]);
console.log('  телефон: від кошторису до кнопки ' + m.висотаХвоста + ' px');
/* Одразу за кошторисом іде список — жодних відкритих екранів між ними. */
ok(m.висотаХвоста >= 0 && m.висотаХвоста < 200,
  'список одразу за кошторисом: ' + m.висотаХвоста + ' px між ними',
  'між кошторисом і списком щось виросло: ' + m.висотаХвоста + ' px');
ok(m.менеджерВидно, 'менеджер видно й на телефоні', 'менеджера немає на телефоні');
await p.close();

// Нема даних — нема й рядків: порожні заголовки гірші за їх відсутність
console.log('');
console.log('═══ ДАНИХ НЕМАЄ ═══');
p = await open(1000, OFFER({ faq:[], cases:[], manager:{ name:'' } }));
let e = await read(p.frames()[1]);
console.log('  рядки: ' + JSON.stringify(e.рядки.map(x => x.назва)));
console.log('  менеджер видно: ' + e.менеджерВидно);
ok(e.рядки.map(x => x.назва).indexOf('Реалізовані проєкти') < 0,
  'проєктів немає — рядка теж немає', 'порожній рядок проєктів лишився');
ok(e.рядки.length === 4 && /^Відгуки/.test(e.рядки[3].назва),
  'лишились процес, гарантії, умови й відгуки — вони не залежать від цієї пропозиції',
  'рядків: ' + JSON.stringify(e.рядки.map(x => x.назва)));
ok(!e.менеджерВидно,
  'менеджера не заповнили — блоку немає, вигаданого імені не показуємо',
  'зʼявився менеджер без імені');

// ── Картка: один ракурс великим, решта мініатюрами ──────────────────────
/* Два фото поруч ділили увагу навпіл і робили картку вдвічі вищою, хоча
   друга сторона зазвичай той самий виріб ззаду. Головним стає ракурс із
   НАНЕСЕННЯМ: «перед» за замовчуванням показував порожній виріб, коли лого
   лише на спині. */
console.log('');
console.log('═══ РАКУРСИ В КАРТЦІ ═══');
const withViews = OFFER({ items:[ Object.assign({}, item, {
  /* Один ракурс прихований від клієнта: саме на ньому набір знімків
     розходився з набором підписів, і галерея лишалась без назв. */
  views:[{side:'front', label:'Перед', img:PH, show:true},
         {side:'right', label:'Правий бік', img:PH, show:false},
         {side:'back',  label:'Спина', img:PH, show:true},
         {side:'left',  label:'Бік',   img:PH, show:true}],
  sides:[{ side:'back', sideLabel:'Спина', technique:'Вишивка', widthMm:80, heightMm:80 }],
  sizechart:{ cols:['Розмір','Груди'], rows:[{c:['S','92 см']},{c:['M','98 см']}] } }) ] });
/* Дивимось очима КЛІЄНТА: у режимі менеджера приховані ракурси показані
   всі, і розходження між набором знімків і набором підписів там не виникає
   в принципі — саме тому воно й проскочило. */
p = await open(430, withViews, true);
const g = await p.frames()[1].evaluate(()=>{
  const gal = document.querySelector('.pgal');
  const main = gal && gal.querySelector('.pgal-i.is-main img');
  const th = gal ? [...gal.querySelectorAll('.pgal-i.is-thumb')] : [];
  const box = gal ? gal.getBoundingClientRect() : null;
  return { головне: main ? main.alt : '(немає)',
    мініатюр: th.length,
    підписи: th.map(x=>(x.querySelector('img')||{}).alt||''),
    мініатюриПоверх: th.length
      ? getComputedStyle(th[0].parentNode).position === 'absolute' : false,
    сітка: (document.querySelector('.sl-fold .sl-k')||{}).textContent||'',
    стрілок: gal ? gal.querySelectorAll('.pgal-ar').length : -1,
    плашкаКількості: !!(gal && gal.querySelector('.pgal-n')),
    пропорція: (function(){ const m2 = gal && gal.querySelector('.pgal-i.is-main');
      if(!m2) return 0; const r = m2.getBoundingClientRect();
      return r.width ? r.height / r.width : 0; })(),
    пропорціяФото: (function(){ const im = gal && gal.querySelector('.pgal-i.is-main img');
      return im && im.naturalWidth ? im.naturalHeight / im.naturalWidth : 0; })(),
    шириноюВКартку: (function(){ const m2 = gal && gal.querySelector('.pgal-i.is-main');
      const pc = gal && gal.closest('.pcard');
      if(!m2 || !pc) return -1;
      return Math.round(pc.getBoundingClientRect().width - m2.getBoundingClientRect().width); })(),
    висотаГалереї: box ? Math.round(box.height) : -1 };
});
console.log('  ' + JSON.stringify(g));
ok(g.головне === 'Спина',
  'великим показано ракурс із нанесенням, а не «перед» за звичкою',
  'великим стоїть: ' + g.головне);
ok(g.мініатюр === 2 && g.мініатюриПоверх,
  'решта ракурсів — мініатюрами поверх фото: висоти не забирають, а видно, що там',
  'мініатюр: ' + g.мініатюр + ', поверх: ' + g.мініатюриПоверх);
/* Ні стрілок, ні плашки «3 фото». Мініатюра в кутку показує, ЩО там буде,
   і цього досить; стрілка казала те саме словом «далі» й стояла просто на
   виробі. Гортати на весь екран є чим — там стрілки лишились. */
ok(g.стрілок === 0 && !g.плашкаКількості,
  'на фото немає ні стрілок, ні плашки з кількістю — самі мініатюри',
  'стрілок: ' + g.стрілок + ', плашка: ' + g.плашкаКількості);
/* Кадр повторює пропорцію знімка: object-fit:cover у кадрі іншої форми
   дорізав макап із боків — вузькій футболці це минало, а худі відрізало
   рукави. І жодного max-height у vh: на айфоні при прокрутці ховається
   адресний рядок, vh змінюється — кадр стрибав від самого скролу. */
/* Рамка рахується один раз на картку — за найвищим із ракурсів — і далі не
   міняється. Доти вона бралася з поточного знімка, і при перемиканні
   перед↔спина картка то виростала, то сідала просто від дотику. */
ok(Math.abs(g.пропорція - g.пропорціяФото) < 0.03,
  'кадр однакової форми зі знімком, коли всі ракурси одного розміру (' +
    g.пропорція.toFixed(2) + ')',
  'кадр ' + g.пропорція.toFixed(2) + ', а знімок ' + g.пропорціяФото.toFixed(2));
ok(g.шириноюВКартку === 0,
  'кадр на всю ширину картки — праворуч не лишається смуги',
  'кадр вужчий за картку на ' + g.шириноюВКартку + 'px');
/* Галерея на весь екран підписує ракурси — і вгорі, і під мініатюрами.
   Доти підписи бралися з окремого атрибута, зібраного за іншим набором
   ракурсів: варто менеджеру сховати один — і замість «Перед · 1 з 2»
   лишалось голе «1 з 2», а внизу два однакові білі квадрати. */
/* Головне: рамка не рухається. Перемикаємо ракурс мініатюрою й міряємо. */
const h0 = await p.frames()[1].evaluate(() =>
  Math.round(document.querySelector('.pgal-i.is-main').getBoundingClientRect().height));
await p.frames()[1].click('.pgal-i.is-thumb');
await p.waitForTimeout(500);
const h1 = await p.frames()[1].evaluate(() =>
  Math.round(document.querySelector('.pgal-i.is-main').getBoundingClientRect().height));
ok(h0 === h1,
  'кадр не змінює висоту при перемиканні ракурсу (' + h0 + 'px)',
  'кадр стрибнув: ' + h0 + ' → ' + h1 + 'px');

await p.frames()[1].click('.pgal-i.is-main img');
await p.waitForTimeout(500);
const z = await p.frames()[1].evaluate(() => ({
  заголовок: (document.getElementById('zoomCount')||{}).textContent||'',
  мініатюр: document.querySelectorAll('#zoomThumbs button').length,
  підМініатюрами: [...document.querySelectorAll('#zoomThumbs button i')].map(x => x.textContent)
}));
console.log('  ' + JSON.stringify(z));
ok(/^\S.* · 1 з 3$/.test(z.заголовок),
  'угорі галереї — назва ракурсу й число ПОКАЗАНИХ клієнту (' + z.заголовок + ')',
  'угорі галереї: «' + z.заголовок + '» — або без назви, або з прихованим ракурсом');
ok(z.мініатюр === 3 && z.підМініатюрами.length === 3 && z.підМініатюрами.every(Boolean),
  'кожна мініатюра в галереї підписана: видно, де перед, а де спина',
  'мініатюр ' + z.мініатюр + ', підписів ' + JSON.stringify(z.підМініатюрами));
await p.frames()[1].evaluate(() => { const x = document.getElementById('zoomX'); if(x) x.click(); });

/* Розмірна сітка — такий самий рядок списку, як решта характеристик,
   тільки він розкривається: у значенні стоїть розмах «S–XXL», а таблиця
   обмірів чекає під ним. */
ok(g.сітка === 'Розміри',
  'розміри — рядком у списку характеристик, із таблицею під ним',
  'рядка розмірів немає: ' + g.сітка);
await p.close();
await p.close();

console.log('');
console.log('помилки сторінок:', errs.length);
errs.slice(0, 4).forEach(x => console.log(' ', x));
if(errs.length) bad++;
console.log(bad ? 'розходжень: ' + bad : 'між сумою й кнопкою один екран, а не шість');
try{ fs.unlinkSync(VH); }catch(x){}
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
