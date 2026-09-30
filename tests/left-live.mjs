/* ЛІВА ПАНЕЛЬ = ПРОРАХУНОК, ОДИН В ОДИН.

   Андрій (знімок робочого місця): зліва «Світшот 2 × 1 725 грн», а в
   прорахунку «Ціна за штуку 1796 грн» — і незрозуміло, котра правда; до
   того ж ліва панель «підвантажується довго». Його рішення: «щоб воно
   просто тянуло з розрахунку в один в один, що є в розрахунку, то і
   тянуло».

   Причин розбіжності було дві, і перевіряємо обидві:
     1. Панель показувала ціну, збережену адмінкою, а прорахунок рахував
        наживо. Тепер панель бере ціни з того самого прогону рушія.
     2. Конструктор не знав рішень замовлення («той самий макет», вид
        дизайну) — і рахував позицію інакше, ніж адмінка. Тепер вони
        приходять разом зі складом.
   І правило Андрія: набраний напис картинкою не буває — у списку виду
   лише «напис» і «не рахувати».

   Запуск:  node tests/left-live.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8937;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg' };
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

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const PRICING = {
  methods:{ embro:{ orderFee:850, orderCost:300, sketchFee:350, sketchCost:150,
    pieceFee:0, pieceCost:0, pricePer1000mm2:30, costPer1000mm2:6, minPrice:300,
    text:{ orderFee:480, orderCost:200, sketchFee:250, sketchCost:150,
           pricePer1000mm2:20, costPer1000mm2:5, minPrice:200 } } },
  tiers:[{ from:1, coef:1 }], garmentTiers:[{ from:1, coef:1 }] };

const VH = path.join(ROOT, '_left_live.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:1400px;height:1000px}</style>
 <iframe id="f" src="offer-edit.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__put = m => document.getElementById('f').contentWindow.postMessage(Object.assign({ lqEditInit:true }, m), '*');
 </script>`);
const p = await browser.newPage({ viewport:{ width:1420, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_left_live.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
const fr = p.frames()[1];
await fr.evaluate(pr => { window.SITE_CONTENT = window.SITE_CONTENT || {}; window.SITE_CONTENT.pricing = pr; }, PRICING);

const L  = HOST + '/' + encodeURI('кітель.png');
const L2 = HOST + '/' + encodeURI('фартух  бежевий.png');   // той самий логотип окремим файлом
const X  = HOST + '/' + encodeURI('кітель 01.png');
const FP_L  = Array.from({ length:144 }, (_, i) => (i * 7 + 1) % 10).join('');
const FP_L2 = Array.from({ length:144 }, (_, i) => (i * 3 + 5) % 10).join('');
const FP_X  = Array.from({ length:144 }, (_, i) => (i * 9 + 2) % 10).join('');
const TXT = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 200; c.height = 60;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif';
  x.fillText('TEAM', 10, 45); return c.toDataURL('image/png');
});
const gid = await fr.evaluate(() => null);
const lay = (id, extra) => Object.assign({ id, scale:1, frac:0.25, fx:0.3, fy:0.25, ar:1,
  fill:0.7, opaqueBox:{ x0:0, y0:0, x1:1, y1:1 }, w:60, h:60 }, extra);
const desc = (units, designs, urls, kinds) => ({ method:'embro', units, gid:'tee', base:1050,
  coefPart:410, basePart:0, minPart:0, pieceFee:0, dtfCols:[], designs, designUrls:urls,
  designKinds:kinds, designMm2:designs.map(() => 3000), bare:false });
const cfg = (qty, front, back) => ({ garmentId:'tee', colorId:null, printId:null, qty:{ M:qty },
  logos:{ front, back, left:[], right:[] } });
/* Позиція 1: логотип L спереду, логотип X ззаду. Позиція 2: той самий логотип,
   але окремим файлом (L2 — інші пікселі й адреса), і напис ззаду. Менеджер
   сказав «це той самий макет» — у замовленні це лежить мапою відбиток → адреса,
   а на шарі позиції 2 позначки немає (збережена до виправлення). */
const CART = [
  { kind:'main', name:'Світшот', qty:2, unitPrice:1111, price:2222,
    desc: desc(2, [FP_L, FP_X], [L, X], ['img', 'img']),
    config: cfg(2, [lay('a1', { url:L, fp:FP_L })], [lay('a2', { url:X, fp:FP_X })]), prints:[] },
  { kind:'main', name:'Світшот', qty:2, unitPrice:1725, price:3450,
    desc: desc(2, [FP_L2, 'T'], [L, ''], ['img', 'txt']),
    config: cfg(2, [lay('b1', { url:L2, fp:FP_L2 })],
                   [lay('b2', { url:TXT, text:{ t:'TEAM', font:'Montserrat', color:'#ffffff', bold:true } })]),
    prints:[] }
];
const OFFER = { orderId:'1000091', client:{ name:'Тест' }, terms:{ deadlineDays:7 },
  items: CART.map(x => ({ kind:'main', name:x.name, qty:x.qty, unitPrice:x.unitPrice,
                          sum:x.price, mockups:[] })),
  reco:[], variants:[], sameFix:{ [FP_L2]: L }, kindFix:null };
await p.evaluate(m => window.__put(m), { offer: OFFER, catalog:[], cart: CART, cartIndex: 1 });
await p.waitForTimeout(800);

const row = i => fr.evaluate(i => {
  const r = document.querySelector('[data-pick="main:' + i + '"] .it-m');
  return r ? r.textContent.replace(/\s+/g, ' ').trim() : '';
}, i);
const before = await row(1);
console.log('  до відкриття: ' + before);
ok(/1 725/.test(before), 'поки конструктор не відкрито — панель показує збережену ціну', 'рядок: ' + before);

await fr.evaluate(() => document.querySelector('[data-pick="main:1"]').click());
await p.waitForTimeout(400);
/* Адмінка відповідає на «editInline» складом і номером позиції. */
await p.evaluate(m => window.__put(m), { editReady:true, seed:null, cart: CART, cartIndex: 1 });
await p.waitForTimeout(6000);
await fr.evaluate(pr => { window.SITE_CONTENT.pricing = pr; if(window.__lqSetQty) window.__lqSetQty({ M:2 }); }, PRICING);
await p.waitForTimeout(1200);

const стан = await fr.evaluate(() => {
  const calc = document.getElementById('pmMgrCalc');
  const t = calc ? calc.innerText : '';
  const ціна = ((t.match(/Ціна за штуку\s+(\d[\d\s]*)\s*грн/) || [])[1] || '').replace(/\s/g, '');
  const sel = [...document.querySelectorAll('#pmMgrCalc [data-mgr-kind]')].map(s => ({
    di: s.getAttribute('data-mgr-kind'), opts: [...s.options].map(o => o.value) }));
  return { ціна: +ціна, calc: t.slice(0, 1400), sel,
           live: window.__lqLivePrices ? window.__lqLivePrices() : null };
});
console.log('  прорахунок: ціна за штуку ' + стан.ціна);
const r1 = await row(1), r0 = await row(0);
console.log('  ліва панель: [1] ' + r1 + ' · [0] ' + r0);
const unit1 = +((r1.match(/×\s*([\d\s]+)\s*грн/) || [])[1] || '').replace(/\s/g, '');
ok(стан.ціна > 0 && unit1 === стан.ціна,
  'ліва панель показує рівно ту ціну, що в прорахунку: ' + unit1,
  'ліва панель ' + unit1 + ', прорахунок ' + стан.ціна);
const live0 = стан.live && стан.live.by && стан.live.by[0];
const unit0 = +((r0.match(/×\s*([\d\s]+)\s*грн/) || [])[1] || '').replace(/\s/g, '');
ok(live0 && unit0 === live0.unit && unit0 !== 1111,
  'і сусідня позиція — з того самого прогону, а не збережена: ' + unit0,
  'сусідня позиція: ' + unit0 + ' (живе ' + (live0 && live0.unit) + ')');
ok(/850 грн ÷ 4 шт/.test(стан.calc) && !/Додатковий ескіз/.test(стан.calc),
  'логотип з окремого файлу рахується тим самим макетом — рішення замовлення дійшло до конструктора',
  'логотип рахується окремо: ' + стан.calc.replace(/\n/g, ' | ').slice(0, 600));
const txtSel = стан.sel.find(x => x.di === '1');
ok(txtSel && txtSel.opts.indexOf('img') < 0 && txtSel.opts.indexOf('txt') >= 0 && txtSel.opts.indexOf('off') >= 0,
  'для набраного напису у виборі лише «напис» і «не рахувати»',
  'вибір для напису: ' + JSON.stringify(txtSel));
const imgSel = стан.sel.find(x => x.di === '0');
ok(imgSel && imgSel.opts.indexOf('img') >= 0 && imgSel.opts.indexOf('txt') >= 0,
  'а для картинки — усі три', 'вибір для картинки: ' + JSON.stringify(imgSel));
ok(/2 нанесення · 2 макети/.test(стан.calc),
  'під прорахунком чесно: 2 нанесення · 2 макети (логотип і напис — різні)',
  'підсумок макетів: ' + ((стан.calc.match(/\d+ нанесення[^\n]*/) || [''])[0]));

/* Міняємо тираж у конструкторі — панель за ним одразу, без збереження. */
await fr.evaluate(() => window.__lqSetQty({ M:5 }));
await p.waitForTimeout(700);
const після = await fr.evaluate(() => {
  const t = document.getElementById('pmMgrCalc').innerText;
  return +(((t.match(/Ціна за штуку\s+(\d[\d\s]*)\s*грн/) || [])[1] || '').replace(/\s/g, ''));
});
const r1b = await row(1);
console.log('  тираж 5: прорахунок ' + після + ' · панель ' + r1b);
ok(/^5 ×/.test(r1b) && +((r1b.match(/×\s*([\d\s]+)\s*грн/) || [])[1] || '').replace(/\s/g, '') === після,
  'змінили тираж — ліва панель одразу показує нове число й нову ціну, як прорахунок',
  'панель після зміни тиражу: ' + r1b + ' (прорахунок ' + після + ')');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad : 'усе зійшлось');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
