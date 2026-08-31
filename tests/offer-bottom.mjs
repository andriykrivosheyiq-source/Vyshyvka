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
   window.__push = o => f.contentWindow.postMessage({ lqEditInit:true, offer:o }, '*');
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

const open = async (w, offer) => {
  const p = await browser.newPage({ viewport:{ width:w + 20, height:1000 } });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
  await p.route('**://**', r => { const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort(); });
  await p.goto(HOST + '/_bottom_vhost.html?w=' + w, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  await p.evaluate(d => window.__push(d), offer);
  await p.waitForTimeout(2500);
  return p;
};
const read = fr => fr.evaluate(() => {
  const tx = s => { const e = document.querySelector(s);
    return e ? e.textContent.replace(/\s+/g,' ').trim() : ''; };
  const секції = [...document.querySelectorAll('section')].map(s => s.className || '—');
  const рядки = [...document.querySelectorAll('.fold .fq')].map(d => ({
    назва: (d.querySelector('summary') || {}).textContent.trim(),
    відкрито: d.open,
    висота: Math.round(d.getBoundingClientRect().height) }));
  const y = s => { const e = document.querySelector(s);
    return e ? Math.round(e.getBoundingClientRect().top + scrollY) : -1; };
  return {
    секції: секції,
    ризики: tx('.risk .sec-title'),
    гарантій: document.querySelectorAll('.risk .tru-l li').length,
    відгукМіні: !!document.querySelector('.rev-mini'),
    відгуківКарток: document.querySelectorAll('.review-card').length,
    оцінка: tx('.rev-mini-h'),
    карток: document.querySelectorAll('.cond-c').length,
    рядки: рядки,
    менеджерВидно: !!document.querySelector('.mgr'),
    менеджерУСписку: !!document.querySelector('.fold .mgr'),
    заголовківУнизу: [...document.querySelectorAll('.fold h2')].length,
    порядок: { кошторис:y('.est'), заклик:y('.cta-wrap'), ризики:y('.risk'),
               список:y('.fold'), менеджер:y('.mgr'), останній:y('.cta-last') },
    висотаХвоста: (function(){
      const e = document.querySelector('.est'), c = document.querySelector('.cta-wrap');
      if(!e || !c) return -1;
      return Math.round(c.getBoundingClientRect().top - e.getBoundingClientRect().bottom);
    })()
  };
});

console.log('═══ НИЗ ПРОПОЗИЦІЇ · КОМПʼЮТЕР ═══');
let p = await open(1000, OFFER());
let d = await read(p.frames()[1]);
console.log('  секції: ' + d.секції.join(' → '));
console.log('  «' + d.ризики + '», галочок: ' + d.гарантій + ', оцінка: ' + d.оцінка);
d.рядки.forEach(x => console.log('   ' + (x.відкрито ? '▾ ' : '▸ ') + x.назва));
console.log('  від кошторису до кнопки: ' + d.висотаХвоста + ' px');
console.log('');
ok(d.ризики === 'Замовлення без зайвих ризиків' && d.гарантій === 4,
  'під закликом — чотири конкретні гарантії, а не пʼять із самопрезентацією',
  'блок довіри не той: ' + d.ризики + ' / ' + d.гарантій);
ok(d.відгукМіні && d.відгуківКарток === 0,
  'відгук один і стислий: ' + d.оцінка,
  'відгуки стрічкою карток: ' + d.відгуківКарток);
ok(d.порядок.кошторис < d.порядок.заклик && d.порядок.заклик < d.порядок.ризики &&
   d.порядок.ризики < d.порядок.список && d.порядок.список < d.порядок.менеджер &&
   d.порядок.менеджер < d.порядок.останній,
  'порядок: кошторис → заклик → гарантії → згортки → менеджер → коротка кнопка',
  'порядок збився: ' + JSON.stringify(d.порядок));
const names = d.рядки.map(x => x.назва);
ok(names[0] === 'Як проходитиме замовлення' && names[1] === 'Умови замовлення' &&
   names[2] === 'Реалізовані проєкти',
  'у згортках процес, умови й проєкти: ' + JSON.stringify(names.slice(0, 3)),
  'список не той: ' + JSON.stringify(names));
ok(names.length === 5 && /тираж/.test(names[3]) && /доставка/i.test(names[4]),
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
ok(d.заголовківУнизу === 0,
  'усередині рядків немає других заголовків — назву несе сам рядок',
  'заголовків усередині: ' + d.заголовківУнизу);
await p.close();

// Скільки насправді виграли: те саме без згортання було б у рази довшим
console.log('═══ ДОВЖИНА ХВОСТА ═══');
p = await open(390, OFFER());
let m = await read(p.frames()[1]);
console.log('  телефон: від кошторису до кнопки ' + m.висотаХвоста + ' px');
/* Кнопка стоїть ОДРАЗУ за сумою — між ними лише відступ секції. Доти між
   ними було шість екранів, і саме це й треба стерегти. */
ok(m.висотаХвоста >= 0 && m.висотаХвоста < 200,
  'кнопка одразу за сумою: ' + m.висотаХвоста + ' px між ними',
  'між сумою й кнопкою знову щось виросло: ' + m.висотаХвоста + ' px');
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
ok(e.рядки.length === 2 && e.рядки.map(x => x.назва).join('|') ===
   'Як проходитиме замовлення|Умови замовлення',
  'лишились процес і умови', 'рядків: ' + JSON.stringify(e.рядки.map(x => x.назва)));
ok(!e.менеджерВидно,
  'менеджера не заповнили — блоку немає, вигаданого імені не показуємо',
  'зʼявився менеджер без імені');
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
