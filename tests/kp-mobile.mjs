/* Редактор КП на телефоні (08.10). Андрій: «щоб нічого не підрізалося, не висло
   саме в мобільній версії, бо я не можу нічого зробити тут». Перевіряємо на
   ширині iPhone: шапка не обрізана, склад на весь екран, тап по позиції —
   конструктор на весь екран, «← Склад КП» повертає; на компʼютері — як було.

   Запуск:  node tests/kp-mobile.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8972;
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
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const it = (kind, name, gid, qty, up, extra) => Object.assign({
  kind, name, garmentId:gid, qty,
  unitPrice:up, price:up * qty, unitCost:Math.round(up * 0.6), cost:Math.round(up * 0.6) * qty
}, extra || {});

/* У пропозиції вже є одна група — дві футболки на вибір. Худі поки лежить
   в основному складі: саме його менеджер і винесе в окрему групу. */
const ORDER = {
  id:'1', orderId:'1000042', type:'client', name:'Оксана', phone:'+380670000042',
  status:'kp', site:'main', payments:[], offerToken:'tok1',
  createdAt:new Date(Date.now() - 2 * 864e5).toISOString(),
  hist:[{ s:'kp', at:new Date(Date.now() - 864e5).toISOString() }],
  totalPrice:9000, totalCost:5400, margin:3600, marginPct:40,
  vqty:{ 'Футболки': 30 },
  items:[
    it('main',    'Худі базове',      'hoodie', 10, 900),
    it('variant', 'Футболка базова',  'tshirt', 30, 300, { vgroup:'Футболки' }),
    it('variant', 'Футболка оверсайз','tshirt', 30, 380, { vgroup:'Футболки' })
  ]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
/* Куди покласти варіант, питають власним вікном: у ньому перелічені групи,
   які вже є в цьому КП, і кнопка завести наступну. Назви більше не питають
   узагалі — менеджер просто каже «нова». */
const newGroup = async () => {
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const d = document.querySelector('#offerEd iframe').contentDocument;
    d.querySelector('[data-g-add]').click();
  });
};
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
const open = async (w, h) => {
  await p.setViewportSize({ width: w, height: h });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  await p.click('.ticket');
  await p.waitForTimeout(1200);
  await p.click('[data-act="offered"]');
  await p.waitForTimeout(3500);
};
const fr = f => p.evaluate(f => { const w = document.querySelector('#offerEd iframe').contentWindow; return (new w.Function('return (' + f + ')()'))(); }, f.toString());

console.log('═══ ТЕЛЕФОН 390 × 844 ═══');
await open(390, 844);
const шапка = await p.evaluate(() => {
  const r = s => { const e = document.querySelector('#offerEd ' + s); if(!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), h: Math.round(b.height) }; };
  const ow = document.querySelector('#offerEd .oe').getBoundingClientRect();
  return { x: r('.oe-btn--x'), title: r('.oe-title'), save: r('[data-oe="saveitem"]'), oe: { w: Math.round(ow.width), h: Math.round(ow.height) } };
});
console.log('  ' + JSON.stringify(шапка));
ok(!!шапка.x && шапка.x.r <= 390 && шапка.x.l >= 0 && шапка.title.r <= шапка.x.l && Math.abs(шапка.x.t - шапка.title.t) < 16,
  '✕ і номер КП — у першому рядку, в межах екрана', JSON.stringify(шапка));
ok(шапка.save && шапка.save.l >= 0 && шапка.save.r <= 390, '«Зберегти позицію» видно одразу, не за правим краєм', JSON.stringify(шапка.save));
ok(шапка.oe.w === 390 && шапка.oe.h === 844, 'редактор на весь екран, без смуг сторінки позаду', JSON.stringify(шапка.oe));
const склад = await fr(() => {
  const l = document.getElementById('paneList').getBoundingClientRect();
  return { h: Math.round(l.height), work: getComputedStyle(document.getElementById('paneWork')).display,
           ширше: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
});
ok(склад.h > 500 && склад.work === 'none' && !склад.ширше, 'склад КП — на весь екран, конструктор не накладається, вбік нічого не їде', JSON.stringify(склад));
await fr(() => { document.querySelector('#listBody .it').click(); });
await p.waitForTimeout(3000);
const робота = await fr(() => {
  const vis = id => { const e = document.getElementById(id); return !!e && e.getBoundingClientRect().height > 0; };
  return { m: document.body.classList.contains('m-work'), list: vis('paneList'), stage: Math.round(document.getElementById('stage').getBoundingClientRect().height),
           back: vis('mBack'), назва: (document.getElementById('mBackT') || {}).textContent || '' };
});
ok(робота.m && !робота.list && робота.stage > 500 && робота.back && /Худі/.test(робота.назва),
  'тап по позиції — конструктор на весь екран, зверху «← Склад КП · Худі базове»', JSON.stringify(робота));
await fr(() => { document.querySelector('[data-mback]').click(); });
await p.waitForTimeout(400);
const назад = await fr(() => ({ m: document.body.classList.contains('m-work'), list: document.getElementById('paneList').getBoundingClientRect().height }));
ok(!назад.m && назад.list > 500, '«← Склад КП» — назад до складу', JSON.stringify(назад));
await fr(() => { document.querySelector('[data-view="cards"]').click(); });
await p.waitForTimeout(800);
const картки = await fr(() => ({ list: Math.round(document.getElementById('paneList').getBoundingClientRect().height),
  cards: Math.round(document.getElementById('paneCards').getBoundingClientRect().height) }));
ok(картки.list < 120 && картки.cards > 400, '«Картки» — на весь екран, над ними лише вкладки', JSON.stringify(картки));

console.log('');
console.log('═══ КОМПʼЮТЕР — ЯК БУЛО ═══');
await open(1400, 1000);
const пк = await fr(() => ({ list: getComputedStyle(document.getElementById('paneList')).display,
  work: getComputedStyle(document.getElementById('paneWork')).display, back: getComputedStyle(document.getElementById('mBack')).display }));
ok(пк.list !== 'none' && пк.work !== 'none' && пк.back === 'none', 'на компʼютері склад і конструктор поруч, смуги «← Склад КП» немає', JSON.stringify(пк));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
