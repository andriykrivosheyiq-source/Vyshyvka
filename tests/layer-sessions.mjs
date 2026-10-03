/* Логотип береться в будь-якій сесії, а не лише в тій, де його поставили.

   ЩО БУЛО НЕ ТАК (03.10, docs/BUGS.md). З 28.09 шар береться «за те, що на
   ньому намальовано» — за маскою форми. Маска живе лише в памʼяті вкладки,
   у позицію вона не пишеться. Менеджер, який відкривав збережену позицію
   (другий менеджер, друге відкриття КП), маски не мав, і натиск по логотипу
   провалювався на фото виробу: ні перенести, ні збільшити.

   ЯК МАЄ БУТИ. Кожна сесія — нова вкладка з чистою памʼяттю, як у іншого
   менеджера. У кожній: п'ять перенесень кожного логотипа, збільшення,
   зменшення, збереження. Наступна сесія відкриває збережене й бачить
   логотипи там само й того самого розміру, і знову може все те саме.
   Окремо: картинка з чужого сайту без CORS (маску з неї не зняти) береться
   рамкою; дірка в кільці після зняття маски лишається діркою.

   Запуск:  node tests/layer-sessions.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8873, PORT_FOREIGN = 8874;
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
async function session(name, viewport){
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
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

/* ═══ СЕСІЯ 1: перший менеджер ставить логотипи ═══ */
console.log('═══ СЕСІЯ 1 · перший менеджер ставить два логотипи ═══');
let cfg;
{
  const { p, ctx } = await session('сесія 1', { width:1280, height:1000 });
  await p.evaluate(async () => {
    window.__openProductModal('tee');
    await new Promise(r => setTimeout(r, 1800));
  });
  await toPhoto(p);
  await p.evaluate(async (u) => {
    window.LQ_addLogoFromStart({ url: u.sq });
    await new Promise(r => setTimeout(r, 1500));
    window.LQ_addLogoFromStart({ url: u.data });
    await new Promise(r => setTimeout(r, 1500));
  }, { sq: HOST + '/_logo_sq.svg', data: LOGO_DATA });
  const ids = await layerIds(p);
  ok(ids.length === 2, 'на виробі два логотипи', 'логотипів ' + ids.length);
  /* Розвести, щоб не лежали один на одному */
  if(ids.length === 2){
    const a = await one(p, ids[0]);
    await drag(p, a.cx, a.cy, -70, -40);
    const b = await one(p, ids[1]);
    await drag(p, b.cx, b.cy, 70, 60);
    await work(p, ids[0], 'квадрат', false);
    await work(p, ids[1], 'трикутник', false);
  }
  const end = await ordered(p);
  cfg = await save(p);
  ok(cfg && cfg.logos && (cfg.logos.front || []).length === 2,
     'позицію збережено з двома логотипами', 'не зберіглось: ' + JSON.stringify(cfg && cfg.logos && Object.keys(cfg.logos)));
  cfg.__end = end;
  await ctx.close();
}

/* ═══ СЕСІЇ 2–4: інші менеджери відкривають збережене ═══ */
const plan = [
  { name:'СЕСІЯ 2 · другий менеджер, те саме вікно', vp:{ width:1280, height:1000 } },
  { name:'СЕСІЯ 3 · третій раз, додає логотип із чужого сайту без CORS', vp:{ width:1280, height:1000 }, foreign:true },
  { name:'СЕСІЯ 4 · вузьке вікно ноутбука', vp:{ width:1024, height:760 } },
  { name:'СЕСІЯ 5 · знову широке', vp:{ width:1440, height:960 } }
];
for(const s of plan){
  console.log('');
  console.log('═══ ' + s.name + ' ═══');
  const { p, ctx } = await session(s.name, s.vp);
  const prevEnd = cfg.__end, prevVp = cfg.__vp;
  delete cfg.__end; delete cfg.__vp;
  await reopen(p, cfg);
  await toPhoto(p);
  const start = await ordered(p);
  /* Розмір вікна інший — порівнювати можна лише частки й лише з тим самим
     вікном; у вужчому вікні рамка інша, і частки рахуються від неї ж. */
  if(!prevVp || (prevVp.width === s.vp.width && prevVp.height === s.vp.height))
    same(prevEnd, start, 'відкрито як збережено');
  else
    ok(start.length === prevEnd.length, 'відкрились усі ' + start.length + ' логотипи',
       'відкрилось ' + start.length + ' з ' + prevEnd.length);

  /* Перший натиск — одразу після відкриття, без жодного кліку перед ним */
  const ids = await layerIds(p);
  {
    const a = await one(p, ids[0]);
    /* Ні за що взятись — це і є поломка 03.10: натиск провалювався на фото.
       Тоді тягнемо просто за середину, як людина, і дивимось, що буде. */
    const g0 = (await gripOf(p, ids[0], false)) || { x: a.cx, y: a.cy };
    await drag(p, g0.x, g0.y, 25, 15);
    const b = await one(p, ids[0]);
    ok(Math.abs(b.cx - a.cx - 25) <= 4 && Math.abs(b.cy - a.cy - 15) <= 4,
       'перший же натиск після відкриття бере логотип',
       'перший натиск не взяв логотип: зсув ' + Math.round(b.cx - a.cx) + ',' + Math.round(b.cy - a.cy));
  }

  if(s.foreign){
    await p.evaluate(async (u) => {
      window.LQ_addLogoFromStart({ url: u });
      await new Promise(r => setTimeout(r, 2000));
    }, FOREIGN + '/_logo_ring.svg');
    const now = await layerIds(p);
    ok(now.length === ids.length + 1, 'логотип із чужого сайту став на виріб',
       'не став: шарів ' + now.length);
    if(now.length === ids.length + 1){
      const fid = now[now.length - 1];
      const f = await one(p, fid);
      await drag(p, f.cx, f.cy, 0, 110);       // відвести від інших
      await work(p, fid, 'кільце без CORS', true);
    }
  }

  /* Розвести логотипи по різних місцях — від верхнього до нижнього: верхній
     береться завжди, а щойно його відвели, відкривається наступний. */
  const all = await layerIds(p);
  const SLOTS = [[0.30, 0.36], [0.70, 0.36], [0.50, 0.66], [0.30, 0.66]];
  for(let k = all.length - 1; k >= 0; k--){
    const id = all[k];
    const g = await gripOf(p, id, false);
    if(!g){ ok(false, '', 'шар ' + (k + 1) + ': не взяти навіть щоб відвести'); continue; }
    const w = await p.evaluate(() => { const r = document.getElementById('pmGarmentWrap').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    const a = await one(p, id);
    const [sx, sy] = SLOTS[k];
    await drag(p, g.x, g.y, Math.round(w.l + sx * w.w - a.cx), Math.round(w.t + sy * w.h - a.cy));
  }
  for(const id of all){
    const lbl = 'шар ' + (all.indexOf(id) + 1);
    await work(p, id, lbl, false);
  }
  const end = await ordered(p);
  cfg = await save(p);
  ok(cfg && (cfg.logos.front || []).length === all.length,
     'збережено ' + all.length + ' логотипи', 'збережено не все: ' + JSON.stringify(cfg && cfg.logos.front && cfg.logos.front.length));
  cfg.__end = end; cfg.__vp = s.vp;
  await ctx.close();
}

/* ═══ ТОЧНІСТЬ НЕ ВТРАЧЕНО: дірка в кільці після відкриття ═══ */
console.log('');
console.log('═══ КІЛЬЦЕ ЗІ СХОВИЩА: ДІРКА ЛИШАЄТЬСЯ ДІРКОЮ ═══');
{
  const { p, ctx } = await session('кільце', { width:1280, height:1000 });
  const ring = { garmentId:'tee', colorId:null, printId:null, qty:{ M:4 },
    logos:{ front:[{ id:1, url: HOST + '/_logo_ring.svg', origUrl: HOST + '/_logo_ring.svg',
      cleanUrl: HOST + '/_logo_ring.svg', x:0, y:0, scale:1.4, rot:0, ar:1,
      fp:'p:ring', opaqueBox:{ x0:0.07, y0:0.07, x1:0.93, y1:0.93 }, fill:0.5 }], back:[] } };
  await reopen(p, ring);
  await toPhoto(p);
  await p.waitForTimeout(800);                 // маска встигла знятись
  const id = (await layerIds(p))[0];
  const a = await one(p, id);
  await drag(p, a.cx, a.cy, 50, 50);          // просто в дірку
  const b = await one(p, id);
  ok(Math.round(Math.abs(b.cx - a.cx) + Math.abs(b.cy - a.cy)) === 0,
     'у просвіті кільця, відкритого наново, братись нема за що — маска знялась',
     'дірка тягне кільце: маска так і не знялась');
  const g = grip(b, true);
  await drag(p, g.x, g.y, 40, 30);
  const c = await one(p, id);
  ok(Math.abs(c.cx - b.cx - 40) <= 4 && Math.abs(c.cy - b.cy - 30) <= 4,
     'а за обруч — береться й переноситься', 'обруч не взявся');
  await ctx.close();
}

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'логотип береться в кожній сесії, скільки б разів позицію не відкривали');
await browser.close(); srv.close(); foreign.close();
process.exit(bad ? 1 : 0);
