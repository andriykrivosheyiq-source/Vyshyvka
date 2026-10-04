/* Ціна не скаче, коли нічого не міняли.

   ЩО БУЛО НЕ ТАК (04.10). Андрій: «перемикаюсь між дизайнами — ціна
   постійно скаче; не міняю розмір вишивки, а ціна інша». Мм вишивки
   рахувались масштабом зони того фото, ЯКЕ ЗАРАЗ НА ЕКРАНІ: відкрили спину —
   лого на переді рахувалось масштабом спини; поки фото вантажилось — запасною
   формулою (більші мм, більша площа); у мить зміни фото — з чужого фото.

   ЯК МАЄ БУТИ. Масштаб — за стороною шару й розмірами саме її фото. Гортання
   ракурсів не міняє ні площі, ні ціни; збережена позиція, відкрита з чистої
   вкладки на повільному інтернеті, ні на мить не показує іншу ціну.

   Запуск:  node tests/price-stable.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8885, PORT_FOREIGN = 8886;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const serve = (cors) => createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  /* Логотипи «зі сховища»: квадрат і кільце, віддані звичайним файлом. */
  if(u === '/_logo_sq.svg' || u === '/_logo_ring.svg'){
    const body = u === '/_logo_sq.svg'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect x="10" y="10" width="280" height="180" fill="#1F6F3A"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="170" fill="none" stroke="#E8590C" stroke-width="50"/></svg>';
    const h = { 'Content-Type':'image/svg+xml' };
    if(cors) h['Access-Control-Allow-Origin'] = '*';
    res.writeHead(200, h); res.end(body); return;
  }
  const f = path.join(ROOT, u.replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
const srv = serve(true), foreign = serve(false);
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
await new Promise(r => foreign.listen(PORT_FOREIGN, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
/* Інше походження (localhost ≠ 127.0.0.1) і без заголовка CORS: картинка
   показується, а пікселі з неї не прочитати — як файл зі сховища без CORS. */
const FOREIGN = 'http://localhost:' + PORT_FOREIGN;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const LOGO_DATA = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><path d="M20 220 L120 20 L220 220 Z" fill="#2B4CC8"/></svg>');

/* Нова вкладка в новому контексті: ні памʼяті, ні кошика від минулої сесії. */
async function session(name, viewport, slow){
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  /* Повільні фото виробу — як на мобільному інтернеті: саме тоді ціна й
     скакала, поки фото сторони ще не приїхало. */
  if(slow) await p.route(/\/images\/.*\.webp/, async r => { await new Promise(z => setTimeout(z, slow)); r.continue(); });
  p.on('pageerror', e => errs.push(name + ': ' + e.message.slice(0, 160)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u))
      return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST) || u.startsWith(FOREIGN)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4500);
  return { p, ctx };
}
const toPhoto = p => p.evaluate(async () => {
  document.querySelector('[data-tab="photo"]')?.click();
  await new Promise(r => setTimeout(r, 900));
});
/* Де шар на екрані — у частках рамки виробу, щоб порівнювати між сесіями й
   між різними розмірами вікна. */
const geom = p => p.evaluate(() => {
  const w = document.getElementById('pmGarmentWrap').getBoundingClientRect();
  return Array.from(document.querySelectorAll('[data-layer-id]')).map(el => {
    const r = el.getBoundingClientRect();
    return { id: +el.dataset.layerId,
             cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height,
             fx: (r.left + r.width / 2 - w.left) / w.width,
             fy: (r.top + r.height / 2 - w.top) / w.height,
             fw: r.width / w.width };
  });
});
const one = async (p, id) => (await geom(p)).find(g => g.id === id);
async function drag(p, x, y, dx, dy){
  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.waitForTimeout(60);
  await p.mouse.move(x + dx, y + dy, { steps:10 });
  await p.waitForTimeout(60);
  await p.mouse.up();
  await p.waitForTimeout(250);
}
/* Точка, де в шарі точно є малюнок: у кільця — сам обруч, не середина. */
const grip = (g, ring) => ring ? { x: g.cx, y: g.cy - g.h * 0.40 } : { x: g.cx, y: g.cy };
/* Видима частина саме цього шару. Логотипи в тесті ходять і росте — бува,
   один накриває інший, і тоді натиск по ньому чесно бере ВЕРХНІЙ. Людина
   в такому разі бере нижній за ту частину, що видно, — так само й тест. Після
   проб «хто тут» скидаємо памʼять «той самий клік → глибше», натиснувши
   в порожнечу, — інакше справжній натиск пішов би на шар нижче. */
async function gripOf(p, id, ring){
  const g = await one(p, id);
  const pt = await p.evaluate(([id, g, ring]) => {
    const pts = [];
    if(ring) pts.push([g.cx, g.cy - g.h * 0.40], [g.cx, g.cy + g.h * 0.40],
                      [g.cx - g.w * 0.40, g.cy], [g.cx + g.w * 0.40, g.cy]);
    else for(let i = 0; i <= 6; i++) for(let j = 0; j <= 6; j++)
      pts.push([g.cx + (i / 6 - 0.5) * g.w * 0.7, g.cy + (j / 6 - 0.5) * g.h * 0.7]);
    pts.sort((a, b) => Math.hypot(a[0] - g.cx, a[1] - g.cy) - Math.hypot(b[0] - g.cx, b[1] - g.cy));
    let got = null;
    /* Шар ловиться з запасом у кілька пікселів навколо малюнка, тож точка
       біля краю сусіда зверху чесно віддається сусідові. Беремо лише ту,
       навколо якої на 8 px ніхто інший не претендує. */
    const mine = (x, y) => {
      const r = window.__lqLayers.at(x, y) === id;
      window.__lqLayers.at(-9999, -9999);
      return r;
    };
    for(let [x, y] of pts){
      x = Math.round(x); y = Math.round(y);
      const el = document.elementFromPoint(x, y);
      if(!el || !el.closest('#pmGarmentWrap')) continue;      // під панеллю — не видно
      if(el.closest('.pm-dl-handle')) continue;                // там кнопка обраного шару
      if([[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]].every(([a, b]) => mine(x + a, y + b))){
        got = { x, y }; break;
      }
    }
    window.__lqLayers.at(-9999, -9999);
    return got;
  }, [id, g, ring]);
  return pt;
}
/* Маркер видно? Логотип біля низу ховає кут під нижньою панеллю вкладок —
   людина спершу підніме логотип, тест так само. */
async function handleVisible(p, id){
  return p.evaluate(id => {
    const el = document.querySelector('[data-layer-id="' + id + '"] [data-handle="scale"]');
    if(!el) return false;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(top && el.contains(top) || top === el);
  }, id);
}

/* П'ять перенесень, збільшення, зменшення. Повертає кількість невдалих. */
async function work(p, id, label, ring){
  const moves = [[50, 30], [-35, 25], [-30, -40], [45, -10], [-30, -5]];
  let miss = 0;
  for(const [dx, dy] of moves){
    const a = await one(p, id);
    const g = await gripOf(p, id, ring);
    if(!g){ miss++; console.log('     ' + label + ': немає видимого місця, за яке взятись'); continue; }
    await drag(p, g.x, g.y, dx, dy);
    const b = await one(p, id);
    const mx = b.cx - a.cx, my = b.cy - a.cy;
    if(Math.abs(mx - dx) > 4 || Math.abs(my - dy) > 4){
      miss++;

      console.log('     ' + label + ': тягнули на ' + dx + ',' + dy + ' — поїхав на ' +
                  Math.round(mx) + ',' + Math.round(my));
    }
  }
  ok(!miss, label + ': п\'ять перенесень поспіль — кожне рівно туди, куди тягнули',
     label + ': ' + miss + ' з 5 перенесень не вдались');

  /* Маркер масштабу є лише в обраного: обраний той, кого щойно тягнули. */
  const scaleBy = async (d) => {
    const before = await one(p, id);
    const h = await p.evaluate(id => {
      const el = document.querySelector('[data-layer-id="' + id + '"] [data-handle="scale"]');
      if(!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, id);
    if(!h) return { before, after: before, нема: true };
    if(!(await handleVisible(p, id))){
      const g = await gripOf(p, id, ring);
      if(g) await drag(p, g.x, g.y, 0, -120);
      return scaleBy(d);
    }
    await drag(p, h.x, h.y, d, d);
    return { before, after: await one(p, id) };
  };
  const up = await scaleBy(30);
  ok(!up.нема && up.after.w > up.before.w + 8,
     label + ': тягне за кут — більшає (' + Math.round(up.before.w) + ' → ' + Math.round(up.after.w) + ' px)',
     label + ': не збільшився' + (up.нема ? ' — маркера немає, шар не обраний' :
       ' (' + Math.round(up.before.w) + ' → ' + Math.round(up.after.w) + ')'));
  const down = await scaleBy(-40);
  ok(!down.нема && down.after.w < down.before.w - 8,
     label + ': і назад — меншає (' + Math.round(down.before.w) + ' → ' + Math.round(down.after.w) + ' px)',
     label + ': не зменшився (' + Math.round(down.before.w) + ' → ' + Math.round(down.after.w) + ')');
}

/* Зберегти позицію так само, як кнопкою, і забрати її config. */
const save = p => p.evaluate(async () => {
  window.__lqSetQty && window.__lqSetQty({ M: 10 });
  document.getElementById('pmMockupConfirmBtn').click();
  await new Promise(r => setTimeout(r, 1500));
  const it = cartItems[cartItems.length - 1];
  return it ? JSON.parse(JSON.stringify(it.config)) : null;
});
/* Відкрити збережене — як адмінка відкриває позицію КП. */
const reopen = (p, cfg) => p.evaluate(async cfg => {
  window.__editProduct(cfg, 0, []);
  await new Promise(r => setTimeout(r, 400));
}, cfg);
const layerIds = p => p.evaluate(() => window.__lqLayers.list().map(l => l.id));
function same(a, b, what){
  const far = [];
  a.forEach((x, i) => {
    const y = b[i];
    if(!y || Math.abs(x.fx - y.fx) > 0.006 || Math.abs(x.fy - y.fy) > 0.006 || Math.abs(x.fw - y.fw) > 0.006)
      far.push(i + 1);
  });
  ok(a.length === b.length && !far.length,
     what + ': логотипи там само й того самого розміру',
     what + ': розʼїхались ' + JSON.stringify({ було: a.length, стало: b.length, шари: far }));
}
const ordered = async p => { const ids = await layerIds(p); const g = await geom(p);
  return ids.map(id => g.find(x => x.id === id)).filter(Boolean); };


const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect x="20" y="20" width="260" height="260" fill="#1F6F3A"/></svg>');
/* Зони з різним калібруванням на переді й спині — так і в житті: фото
   сторін зняті по-різному, і масштаб у них різний. */
const ZONES = { hoodie: { heightCm:72,
  front: { base:{ calibTop:0.06, calibBottom:0.96, pts:[[0,0],[0.25,0],[0.25,0.45],[0,0.45]] }, colors:{} },
  back:  { base:{ calibTop:0.14, calibBottom:0.86, pts:[[0,0],[0.3,0],[0.3,0.55],[0,0.55]] }, colors:{} } } };
/* Ціни — за площею, як в адмінці: ставка за 1000 мм², мінімум нанесення
   невеликий, щоб різниця площі була видна в ціні. */
const PRICING = { minMarginPct:0, tiers:[{ from:1, coef:1 }], garmentTiers:[{ from:1, coef:1 }],
  methods:{ embro:{ orderFee:0, sketchFee:0, pieceFee:0, pricePer1000mm2:42, minPrice:10, tiers:[{ from:1, coef:1 }] },
            dtf:{ orderFee:0, sketchFee:0, tiers:[{ from:1, coef:1 }], qtyFrom:[1] } } };
const setup = p => p.evaluate(async ([Z, P]) => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.printAreas = Z;
  window.SITE_CONTENT.pricing = P;
  document.dispatchEvent(new Event('lq-content'));
  await new Promise(r => setTimeout(r, 300));
}, [ZONES, PRICING]);
/* Ціна, як її бачить менеджер (рядок ціни), і площа саме логотипа на переді. */
const read = p => p.evaluate(() => {
  const front = (window.__lqLayers.list('front') || [])[0];
  const was = window.__lqLayers.active();
  if(front) window.__lqLayers.active(front.id);
  const i = window.__lqLayerInfo ? window.__lqLayerInfo() : {};
  window.__lqLayers.active(was);
  const t = ((document.getElementById('pmPriceText') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  const n = (t.match(/^(\d[\d\s]*)/) || [])[1];
  return { unit: n ? +n.replace(/\s/g, '') : null, mm2: i && i.mm2, w: i && i.wMm, h: i && i.hMm, text: t };
});

console.log('═══ ГОРТАЄМО РАКУРСИ — ЦІНА ТА САМА ═══');
let cfg, база;
{
  const { p, ctx } = await session('ракурси', { width:1280, height:1000 });
  await setup(p);
  await p.evaluate(async () => { window.__openProductModal('hoodie'); await new Promise(r => setTimeout(r, 1800)); });
  await setup(p);
  await p.evaluate(() => window.__lqSetQty && window.__lqSetQty({ M: 10 }));
  await toPhoto(p);
  await p.evaluate(async u => { window.LQ_addLogoFromStart({ url:u }); await new Promise(r => setTimeout(r, 2000)); }, LOGO);
  база = await read(p);
  console.log('   на переді: ' + JSON.stringify(база));
  const seen = [база];
  for(let k = 0; k < 4; k++){
    await p.evaluate(() => document.getElementById('pmArrowRight').click());
    await p.waitForTimeout(900);
    seen.push(await read(p));
  }
  console.log('   після гортання: ' + seen.map(s => s.unit + ' грн · ' + s.mm2 + ' мм²').join(' | '));
  ok(база.unit > 0 && seen.every(s => s.unit === база.unit && s.mm2 === база.mm2),
    'гортаю ракурси (спина, рукави, модель) — площа й ціна логотипа на переді не міняються',
    'ціна скаче від ракурсу: ' + seen.map(s => s.unit + '/' + s.mm2).join(', '));
  cfg = await save(p);
  await ctx.close();
}

console.log('');
console.log('═══ ВІДКРИТИ ЗБЕРЕЖЕНЕ НА ПОВІЛЬНОМУ ІНТЕРНЕТІ — ЖОДНОГО ПРОМІЖНОГО ЧИСЛА ═══');
{
  const { p, ctx } = await session('повільно', { width:1280, height:1000 }, 1500);
  await setup(p);
  const числа = await p.evaluate(async cfg => {
    const out = [];
    window.__editProduct(cfg, 0, []);
    window.__lqSetQty && window.__lqSetQty({ M: 10 });
    const t0 = Date.now();
    while(Date.now() - t0 < 4000){
      const t = ((document.getElementById('pmPriceText') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      const d = window.__lqDraftDesc ? window.__lqDraftDesc() : {};
      out.push({ t, unit: d.unit, wait: window.__lqPricePending ? window.__lqPricePending() : null });
      await new Promise(r => setTimeout(r, 40));
    }
    return out;
  }, cfg);
  const показано = [...new Set(числа.map(x => (x.t.match(/^(\d[\d\s]*)/) || [])[1]).filter(Boolean).map(v => v.replace(/\s/g, '')))];
  console.log('   показані ціни: ' + показано.join(', ') + ' · база ' + база.unit);
  ok(показано.length === 1 && +показано[0] === база.unit,
    'поки фото їде, ціна або «рахуємо…», або остаточна — і вона та сама, що при збереженні',
    'ціна скакала: ' + показано.join(' → '));
  const after = await read(p);
  ok(after.mm2 === база.mm2, 'площа вишивки та сама, що при збереженні (' + after.mm2 + ' мм²)',
    'площа інша: ' + after.mm2 + ' замість ' + база.mm2);
  await ctx.close();
}

console.log('');
console.log('═══ НЕВИМІРЯНИЙ МАЛЮНОК НЕ КОШТУЄ ЯК ЗАЛИВКА ═══');
{
  const { p, ctx } = await session('обводка', { width:1280, height:1000 });
  await setup(p);
  await p.evaluate(async () => { window.__openProductModal('hoodie'); await new Promise(r => setTimeout(r, 1500)); });
  await setup(p);
  await p.evaluate(() => window.__lqSetQty && window.__lqSetQty({ M: 10 }));
  await toPhoto(p);
  const RING = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect x="20" y="20" width="260" height="260" fill="none" stroke="#1F6F3A" stroke-width="12"/></svg>');
  const r = await p.evaluate(async u => {
    const out = [];
    window.LQ_addLogoFromStart({ url:u });
    const t0 = Date.now();
    while(Date.now() - t0 < 2500){
      out.push(((document.getElementById('pmPriceText') || {}).textContent || '').replace(/\s+/g, ' ').trim());
      await new Promise(z => setTimeout(z, 25));
    }
    return out;
  }, RING);
  const числа2 = [...new Set(r.map(t => (t.match(/^(\d[\d\s]*)/) || [])[1]).filter(Boolean).map(v => v.replace(/\s/g, '')))];
  console.log('   показані ціни після додавання обводки: ' + числа2.join(', '));
  ok(числа2.length === 1, 'обводка одразу з ціною обводки — без першої миті «як заливка»',
    'ціна стрибнула: ' + числа2.join(' → '));
  await ctx.close();
}

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'ціна стоїть, поки нічого не міняли');
await browser.close(); srv.close(); foreign.close();
process.exit(bad ? 1 : 0);
