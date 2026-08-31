/* Кошторис: жодне число не повторюється, знижка названа один раз.

   Було: сума тричі, відсоток тричі, вигода двічі, плюс перекреслена ціна в
   позиції — людина мусила сама вирішувати, яка з цифр головна, і блок
   читався як банер про знижку, а не як рахунок. Цей тест не дає повернутись:
   він рахує входження кожного числа й падає, щойно на блоці зʼявиться друга
   згадка того самого відсотка або зайве перекреслення.

   Запуск:  node tests/estimate.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8792;
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
const VHOST = path.join(ROOT, '_est_vhost.html');
fs.writeFileSync(VHOST,
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:430px;height:1400px}</style>
   <iframe id="f" src="offer.html?demo=1"></iframe><script>
   var q = new URLSearchParams(location.search), f = document.getElementById('f');
   if(q.get('w')) f.style.width  = parseInt(q.get('w'),10) + 'px';
   if(q.get('h')) f.style.height = parseInt(q.get('h'),10) + 'px';
   window.__push = o => f.contentWindow.postMessage({ lqEditInit:true, offer:o }, '*');
   </script>`);
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#EEF1F5"/></svg>');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs=[]; let bad=0;
const ok=(c,g,w)=>{ console.log('  ' + (c ? g+' ✓' : w+' ✗')); if(!c) bad++; };
const FP = Array.from({length:144},(_,i)=>(i*1)%5).join('');
const mk = (name, print, qty, unit, baseUnit) => ({
  kind:'main', vgroup:'', name, color:'Чорна', print, sizes:'M × '+qty, qty,
  unitPrice:unit, price:unit*qty, basePrice:baseUnit*qty, baseUnitPrice:baseUnit,
  mockups:[PH], prints:[], views:[{side:'front', label:'Перед', img:PH, show:true}],
  sides:[], techniques:[], tiers:[], specs:[], about:'',
  desc:{ method:'embro', units:qty, base:300, coefPart:200, pieceFee:20, dtfCols:[],
         designs:[FP], designKinds:['img'], bare:false } });
const OF = items => ({
  orderId:'1000941', client:{ name:'Андрій', company:'ТОВ Ромашка' },
  terms:{ deadlineDays:7, payment:'50% для запуску', startWith:'', validUntil:'' },
  trust:[], faq:[], state:'', reco:[], variants:[], state_pick:{}, items,
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1}] } },
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] } });

const open = async (w, offer, h) => {
  const p = await b.newPage({ viewport:{width:w+20, height:(h || 900) + 20} });
  p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,170)));
  await p.route('**://**', r=>{ const u=r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
    if(u.startsWith(HOST)) return r.continue();
    return r.abort(); });
  await p.goto(HOST + '/_est_vhost.html?w=' + w + (h ? '&h=' + h : ''),
    {waitUntil:'domcontentloaded'});
  await p.waitForTimeout(4000);
  await p.evaluate(d=>window.__push(d), offer);
  await p.waitForTimeout(2500);
  return p;
};
const read = fr => fr.evaluate(()=>{
  const tx = s => { const e = document.querySelector(s);
    return e ? e.textContent.replace(/\s+/g,' ').trim() : ''; };
  const est = document.querySelector('.est');
  const txt = est ? est.innerText.replace(/ /g,' ') : '';
  const nums = (txt.match(/[\d][\d  ]*\s*грн/g) || []).map(x=>x.replace(/\s+/g,' ').trim());
  const tally = {}; nums.forEach(n=>{ tally[n] = (tally[n]||0) + 1; });
  return {
    фон: est ? getComputedStyle(est).backgroundColor : '',
    шапка: tx('.est-h'), підпис: tx('.est-meta'),
    позиції: [...document.querySelectorAll('.est-i')].map(c=>({
      назва: (c.querySelector('.est-i-nm')||{}).textContent||'',
      підпис: (c.querySelector('.est-i-sub')||{}).textContent||'',
      множення: ((c.querySelector('.est-i-mul')||{}).textContent||'').replace(/\s+/g,' ').trim(),
      сума: ((c.querySelector('.est-i-sum')||{}).textContent||'').replace(/\s+/g,' ').trim(),
      закреслень: c.querySelectorAll('s, del, .est-i-was').length,
      значків: c.querySelectorAll('.est-i-badge, .est-chip').length })),
    рядки: [...document.querySelectorAll('.est-line')].map(l=>l.textContent.replace(/\s+/g,' ').trim()),
    разом: tx('.est-pay'),
    плашок: document.querySelectorAll('.est .est-chip, .est .est-i-badge').length,
    закреслень: est ? est.querySelectorAll('s, del').length : -1,
    зелених: est ? [...est.querySelectorAll('*')].filter(e=>{
      const c = getComputedStyle(e).color;
      return /rgb\(14, 159, 110\)|rgb\(74, 222, 128\)/.test(c) && e.children.length === 0; }).length : -1,
    відсотків: (txt.match(/\d+\s*%/g) || []),
    повторені: Object.keys(tally).filter(k=>tally[k] > 1).map(k=>k + ' ×' + tally[k]),
    входить: tx('.est-inc'),
    кнопки: [...document.querySelectorAll('.est-cta .btn')].map(x=>({
      текст: x.textContent.trim(), видно: getComputedStyle(x).display !== 'none' })),
    вилазить: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  };
});

console.log('═══ КОШТОРИС · ОДНА ПОЗИЦІЯ · КОМПʼЮТЕР ═══');
let p = await open(1000, OF([ mk('Футболка поло','Вишивка логотипа',4, 1450, 2125) ]));
let d = await read(p.frames()[1]);
console.log('  фон:', d.фон, '·', d.шапка, '·', d.підпис);
d.позиції.forEach(x=>console.log('   • ' + JSON.stringify(x)));
console.log('  ' + JSON.stringify(d.рядки) + ' → ' + d.разом);
console.log('  відсотки на блоці:', JSON.stringify(d.відсотків),
            '· повторені суми:', JSON.stringify(d.повторені));
console.log('  ' + d.входить);
console.log('  кнопки:', JSON.stringify(d.кнопки));
console.log('');
ok(/255, 255, 255/.test(d.фон), 'кошторис на світлому тлі, як рахунок', 'фон: ' + d.фон);
ok(d.шапка === 'Кошторис' && d.підпис === '4 одиниці',
  'шапка нічого не рахує: «Кошторис · 4 одиниці»', 'шапка: ' + d.шапка + ' / ' + d.підпис);
ok(d.позиції.length === 1 && /^4 × 1 450 грн$/.test(d.позиції[0].множення),
  'позиція одним рядком: 4 × 1 450 грн', 'множення: ' + JSON.stringify(d.позиції.map(x=>x.множення)));
ok(d.позиції[0].підпис === 'Вишивка логотипа',
  'спосіб нанесення — підписом до назви, а не фінансовим рядком',
  'підпис: ' + d.позиції[0].підпис);
ok(d.позиції.every(x=>x.закреслень === 0 && x.значків === 0),
  'у позиціях немає ні перекресленої ціни, ні значка відсотка',
  'у позиції лишились: ' + JSON.stringify(d.позиції));
ok(d.закреслень === 0, 'на всьому блоці жодного перекреслення', 'перекреслень: ' + d.закреслень);
ok(d.плашок === 0, 'жодної зеленої плашки', 'плашок: ' + d.плашок);
ok(d.відсотків.length === 1, 'відсоток названий рівно один раз: ' + JSON.stringify(d.відсотків),
  'відсотків: ' + JSON.stringify(d.відсотків));
ok(d.зелених <= 1, 'зелений колір рівно в одному місці — на цифрі знижки',
  'зелених елементів: ' + d.зелених);
ok(d.рядки.length === 2 && /^Разом без знижки/.test(d.рядки[0]) &&
   /^Знижка за тираж \d+%/.test(d.рядки[1]) && /^Разом/.test(d.разом),
  'підсумок трьома рядками: без знижки → знижка → разом',
  'підсумок: ' + JSON.stringify(d.рядки) + ' / ' + d.разом);
/* Коли позиція одна, сума позиції дорівнює підсумку — це сама арифметика, а
   не повтор. Було тричі плюс перекреслена ціна; лишилось рівно два входження
   й жодного зайвого числа. */
ok(d.повторені.length === 1 && /×2$/.test(d.повторені[0]),
  'жодне число не повторюється більше двох разів: ' + JSON.stringify(d.повторені),
  'повторені: ' + JSON.stringify(d.повторені));
ok(/У вартість включено: одяг, нанесення, підготовка макета та контроль якості/.test(d.входить),
  'що входить — одним спокійним рядком', 'рядок: ' + d.входить);
ok(d.кнопки.length === 2 && d.кнопки.every(x=>x.видно) &&
   d.кнопки[0].текст === 'Завантажити PDF',
  'дві кнопки, обидві видимі: ' + JSON.stringify(d.кнопки.map(x=>x.текст)),
  'кнопки: ' + JSON.stringify(d.кнопки));
ok(!d.вилазить, 'сторінка не їде вбік', 'зʼявився горизонтальний скрол');
await p.close();

console.log('');
console.log('═══ ТЕЛЕФОН 390px ═══');
p = await open(390, OF([ mk('Футболка поло','Вишивка логотипа',4, 1450, 2125) ]), 780);
let m = await read(p.frames()[1]);
console.log('  кнопки:', JSON.stringify(m.кнопки.map(x=>[x.текст, x.видно])));
ok(m.кнопки.every(x=>x.видно), 'на телефоні видно обидві кнопки — головну більше не ховаємо',
  'на телефоні щось сховано: ' + JSON.stringify(m.кнопки));
ok(m.відсотків.length === 1 && m.закреслень === 0 && m.плашок === 0,
  'на телефоні так само чисто', 'на телефоні лишились повтори');
// липка панель має мовчати, поки головна кнопка на екрані
const fr = p.frames()[1];
const bar = async () => fr.evaluate(()=>{
  const b2 = document.getElementById('bar');
  const cta = document.getElementById('estConfirmBtn');
  const r = cta ? cta.getBoundingClientRect() : null;
  const fin = document.getElementById('confirmBtn');
  const rf = fin ? fin.getBoundingClientRect() : null;
  const on = e => !!(e && e.top < innerHeight - 40 && e.bottom > 0);
  const anch = document.getElementById('offerStart');
  return { панель: !!(b2 && b2.classList.contains('show')),
           панельЄ: !!b2,
           scrollY: Math.round(scrollY),
           поріг: anch ? Math.round(anch.getBoundingClientRect().top + scrollY - 80) : null,
           кнопкаНаЕкрані: on(r), фінальнаНаЕкрані: on(rf) };
});
await fr.evaluate(()=>{
  document.getElementById('estConfirmBtn').scrollIntoView({ block:'center' });
  window.dispatchEvent(new Event('scroll'));
});
await p.waitForTimeout(600);
const b1 = await bar();
/* Їдемо ВНИЗ, у смугу між кошторисом і фінальним закликом: там на екрані
   немає жодної справжньої кнопки — саме там панель і має зʼявитись. */
await fr.evaluate(()=>{
  const est = document.getElementById('estConfirmBtn').getBoundingClientRect();
  window.scrollBy(0, est.bottom + 500);
  window.dispatchEvent(new Event('scroll'));
});
await p.waitForTimeout(600);
const b2 = await bar();
console.log('  кнопка кошторису на екрані:', JSON.stringify(b1));
console.log('  прокрутили геть:          ', JSON.stringify(b2));
ok(b1.кнопкаНаЕкрані && !b1.панель,
  'поки головна кнопка на екрані — липкої панелі немає',
  'панель дублює кнопку: ' + JSON.stringify(b1));
ok(!b2.кнопкаНаЕкрані && b2.панель,
  'кнопка поїхала за екран — панель зʼявилась',
  'панель не зʼявилась після прокрутки: ' + JSON.stringify(b2));
await p.close();

console.log('');
console.log('═══ ЗНИЖКИ НЕМАЄ ═══');
p = await open(1000, OF([ mk('Футболка поло','Вишивка логотипа',4, 1450, 1450) ]));
let f = await read(p.frames()[1]);
console.log('  рядки підсумку:', JSON.stringify(f.рядки), '→', f.разом);
console.log('  відсотки:', JSON.stringify(f.відсотків));
ok(f.рядки.length === 0 && /Разом/.test(f.разом),
  'без знижки лишається сам «Разом», без порожньої арифметики',
  'рядки: ' + JSON.stringify(f.рядки));
ok(f.відсотків.length === 0 && f.зелених === 0,
  'без знижки на блоці немає ні відсотка, ні зеленого',
  'лишилось: ' + JSON.stringify(f.відсотків) + ' зелених ' + f.зелених);
await p.close();

console.log('');
console.log('помилки:', errs.length); errs.slice(0,4).forEach(e=>console.log(' ', e));
if(errs.length) bad++;
console.log(bad ? 'розходжень: ' + bad : 'кошторис читається за три секунди');
try{ fs.unlinkSync(VHOST); }catch(e){}
await b.close();
srv.close();
process.exit(bad ? 1 : 0);
