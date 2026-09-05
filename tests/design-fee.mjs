/* Пропозиція без оплати за дизайн.

   Макет буває вже готовий: клієнт присилає свій файл, або ми робили цей
   самий макет минулого разу. Брати за роботу, якої не буде, нема за що — а
   єдиним способом прибрати її з рахунку було правити ставки способу
   нанесення. Ставки спільні на весь сайт, тож одне таке КП змінювало ціни
   всім замовленням одразу.

   Тепер це рішення про одне замовлення: менеджер ставить «Не брати за
   дизайн» у прорахунку пропозиції, і разові — і підготовка макета, і
   додаткові ескізи — рахуються по нулях. Решта ціни не змінюється: виріб,
   нанесення й знижка за тираж лишаються тими самими.

   Перевіряємо:
     — рушій цін із цією ознакою не бере ні разової, ні ескізу;
     — виріб і нанесення від цього не дешевшають і не дорожчають;
     — собівартість теж не тягне за собою витрат на макет;
     — у прорахунку менеджера є сам перемикач, і він летить в адмінку.

   Запуск:  node tests/design-fee.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8819;
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

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const PRICING = {
  methods: { embro: { orderFee:900, orderCost:400, sketchFee:300, sketchCost:150,
                      ratePerMm2:0, tiers:[{from:1,coef:1}] } },
  tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}]
};
/* Два вироби з РІЗНИМИ дизайнами: один платить разову підготовку, другий —
   ще й додатковий ескіз. Саме ці два рядки й має прибрати ознака. */
const A = Array.from({length:144},(_,i)=>(i*1)%5).join('');
const B = Array.from({length:144},(_,i)=>(i*3)%7).join('');
const LIST = [
  { method:'embro', units:10, base:300, coefPart:200, pieceFee:0, gid:'tee',
    designs:[A], designKinds:['img'], bare:false },
  { method:'embro', units:10, base:300, coefPart:200, pieceFee:0, gid:'tee',
    designs:[B], designKinds:['img'], bare:false }
];

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_fee_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__edit = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, offer:o }, '*');
 </script>`);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:920, height:1000 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_fee_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
const fr = p.frames()[1];

console.log('═══ РУШІЙ ЦІН НЕ БЕРЕ ЗА ДИЗАЙН ═══');
const r = await fr.evaluate(([pricing, list]) => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pricing;
  const pick = res => res.map(x => ({
    unit: x.unit, fee: x.feeShare,
    cost: Math.round((x.parts && +x.parts.costShare) || 0),
    garment: (x.parts || {}).garment, app: (x.parts || {}).app
  }));
  return { on: pick(window.LQ.priceOrder(list, { noDesignFee:true })),
           off: pick(window.LQ.priceOrder(list)) };
}, [PRICING, LIST]);
console.log('  як було: ' + JSON.stringify(r.off));
console.log('  без дизайну: ' + JSON.stringify(r.on));
ok(r.off.some(x => x.fee > 0),
  'зі звичайним рахунком підготовка макета в ціні є',
  'у звичайному рахунку разових немає — перевіряти нема чого');
ok(r.on.every(x => x.fee === 0),
  'з ознакою «не брати за дизайн» разових у ціні немає жодної',
  'разові лишились: ' + JSON.stringify(r.on.map(x => x.fee)));
ok(r.on.every(x => x.cost === 0) && r.off.some(x => x.cost > 0),
  'і в собівартість макет теж не потрапляє — роботи не було',
  'собівартість макета лишилась: ' + JSON.stringify(r.on.map(x => x.cost)));
ok(r.on.every((x, i) => x.garment === r.off[i].garment && x.app === r.off[i].app),
  'виріб і нанесення коштують стільки ж — прибрали саме дизайн',
  'зрушилось не те: ' + JSON.stringify([r.on, r.off]));
ok(r.on.every((x, i) => x.unit === r.off[i].unit - r.off[i].fee),
  'ціна впала рівно на частку разових, ні на копійку більше',
  'ціна впала не на ту суму: ' + JSON.stringify([r.on, r.off]));

console.log('');
console.log('═══ ПЕРЕМИКАЧ ТАМ, ДЕ ВИДНО ЦИФРИ ═══');
const OFFER = {
  orderId:'1001400', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'',
  items:[{ kind:'main', vgroup:'', name:'Худі', color:'Чорний', print:'Вишивка',
    sizes:'M × 10', qty:10, unitPrice:1200, price:12000, basePrice:24000, baseUnitPrice:2400,
    mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'], tiers:[],
    specs:[], about:'', desc:LIST[0] }],
  noDesignFee:false,
  mgr:{ sum:{ qty:20, price:24000, cost:14000, margin:10000, pct:41.6 },
        items:{ 0:{ name:'Худі', rows:[['Виріб','300 грн','']], cost:7000,
                    margin:5000, pct:41 } },
        reco:{}, vars:{}, groups:[] },
  pricing: PRICING
};
await p.evaluate(o => window.__edit(o), OFFER);
await p.waitForTimeout(1500);
const ui = await fr.evaluate(() => {
  const box = document.querySelector('.cc-fold-all');
  if(box) box.open = true;
  const inp = document.getElementById('ccNoFee');
  return { has: !!inp, checked: inp ? inp.checked : null,
           label: (document.querySelector('.cc-nofee') || {}).textContent || '' };
});
console.log('  ' + (ui.label || '(перемикача немає)').trim());
ok(ui.has && ui.checked === false,
  'у прорахунку пропозиції стоїть перемикач «Не брати за дизайн»',
  'перемикача немає: ' + JSON.stringify(ui));

await fr.evaluate(() => {
  const i = document.getElementById('ccNoFee');
  i.checked = true;
  i.dispatchEvent(new Event('change', { bubbles:true }));
});
await p.waitForTimeout(600);
const sent = await p.evaluate(() => (window.__sent || []).slice(-1)[0] || null);
console.log('  надіслано: ' + JSON.stringify(sent));
ok(sent && sent.act === 'nofee' && sent.v === true,
  'рішення летить в адмінку — там воно записується в замовлення',
  'в адмінку пішло не те: ' + JSON.stringify(sent));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'готовий макет більше не оплачують удруге');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
