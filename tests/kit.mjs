/* Міні-сайт клієнта (06.10): loomiq.net/k/#d=…

   Андрій: «після квізу — індивідуальний сайт під них: заходять, пробують,
   дивляться різні формати під їхній одяг; можна через кошик».

   Перевіряємо:
     — посилання з квізу (компанія, логотип у хмарі, одяг, кольори, тираж)
       відкриває вітрину «Мерч для …» з логотипом клієнта;
     — банер-комплект і сітка всіх виробів з мокапами його логотипа й цінами
       на його тираж; вибране в квізі — першим і з позначкою;
     — вкладки (Футболки / Худі / …) фільтрують;
     — у товарі: колір, варіанти розміщення, кількість, ціна; «в кошик»;
     — кошик: увесь склад рахується разом (рушій КП), «Разом» = сума рядків;
     — оформлення: замовлення в Канбан (webOrders, site: kit) з мокапами й
       логотипом + Telegram; кошик очищено;
     — неповне посилання — зрозуміле повідомлення й шлях у квіз;
     — на телефоні без горизонтальної прокрутки.

   Запуск:  node tests/kit.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8872;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if(f.endsWith('/')) f += 'index.html';
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const PHOTOS = {
  pricing: {
    basePrices: { tee: 440, cap: 380 },
    garmentTiers: [{ from:1, coef:1 }, { from:50, coef:0.85 }, { from:100, coef:0.8 }],
    tiers: [{ from:1, coef:1 }],
    methods: {
      embro: { orderFee: 1500, sketchFee: 600, pieceFee: 75, pricePer1000mm2: 40, basePrices:[150], minPrices:[250],
               tiers: [{ from:1, coef:1 }, { from:50, coef:0.9 }, { from:100, coef:0.85 }] },
      dtf: { orderFee: 900, pieceFee: 40, tiers: [{ from:1, coef:1 }] }
    }
  },
  printAreas: {
    tee: { heightCm: 72,
      front: { base: { calibTop: 0.05, calibBottom: 0.95, calibCx: 0.5, pts: [[0, 0.2], [0.15, 0.2], [0.15, 0.6], [0, 0.6]] } },
      back:  { base: { calibTop: 0.05, calibBottom: 0.95, calibCx: 0.5, pts: [[0, 0.15], [0.17, 0.15], [0.17, 0.7], [0, 0.7]] } } }
  }
};
const STUB = `(function(){
  window.__ADDED = [];
  function Snap(d){ this._d = d; this.exists = !!d; } Snap.prototype.data = function(){ return this._d; };
  function Doc(){} Doc.prototype.get = function(){ return Promise.resolve(new Snap(window.__PH || ${JSON.stringify(PHOTOS)})); };
  function Col(n){ this.n = n; } Col.prototype.doc = function(){ return new Doc(); };
  Col.prototype.add = function(d){ window.__ADDED.push({ col: this.n, d: d }); return Promise.resolve({ id: 'x' }); };
  var fs = function(){ return { collection: function(n){ return new Col(n); } }; };
  window.firebase = { initializeApp: function(){ return {}; }, apps: [], firestore: fs };
})();`;


const LOGO = 'https://res.cloudinary.com/t/logo.svg';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120"><rect width="320" height="120" rx="20" fill="#E4572E"/></svg>';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const errs = [], leads = [];
const BAN = 'https://res.cloudinary.com/t/ban1.webp';
const PH3 = JSON.parse(JSON.stringify(PHOTOS));
PH3.kitBanners = [
  { id:'b1', url: BAN, title:'Літо для команди', sub:'футболки з вашим логотипом', tab:'all', ar: 1, places: [{ x:0.5, y:0.4, w:0.3, h:0.2, rot:0 }] },
  { id:'b2', url: BAN, title:'Худі на осінь', sub:'', tab:'hoodie', ar: 1, places: [{ x:0.5, y:0.45, w:0.25, h:0.25, rot:12 }] } ];
const BANIMG = await readFile(path.join(ROOT, 'images/tee-white-front.webp'));
async function page(w, h){
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.addInitScript(ph => { window.__PH = ph; }, PH3);
  p.on('pageerror', e => errs.push(String(e)));
  await p.route('**/*', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs\/.*app-compat/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
    if(u === BAN) return r.fulfill({ contentType: 'image/webp', headers: { 'Access-Control-Allow-Origin': '*' }, body: BANIMG });
    if(u === LOGO) return r.fulfill({ contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: SVG });
    if(/loomiq-lead/.test(u)){ leads.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
    if(/api\.cloudinary\.com/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/t/m' + Math.random().toString(36).slice(2, 7) + '.jpg' }) });
    if(u.startsWith(HOST)) return r.continue();
    return r.fulfill({ status: 204, body: '' });
  });
  return p;
}
const p = await page(1280, 900);
await p.goto(HOST + '/k/'); await p.waitForTimeout(400);
const empty = await p.evaluate(() => document.querySelector('.k-empty') && document.querySelector('.k-empty a').getAttribute('href'));
ok(empty === '/quiz/', 'неповне посилання — «Посилання неповне» і кнопка в квіз', 'порожня сторінка: ' + empty);
const link = await p.evaluate(l => window.LQKit.kitLink({ company: 'Кава на розі', sphere: 'cafe', people: 30, logo: l, ar: 120 / 320, ink: 1,
  garments: ['tee', 'cap'], colors: { tee: 'white', cap: 'black' } }), LOGO);
ok(/\/k\/#d=[A-Za-z0-9_-]+$/.test(link) && link.length < 400, 'посилання коротке й без бази: ' + link.length + ' символів', 'посилання: ' + link);
await p.goto(link); await p.waitForTimeout(2500);

console.log('');
console.log('═══ ВІТРИНА ═══');
const v = await p.evaluate(() => ({
  ttl: document.getElementById('kTtl').textContent, logo: !!document.querySelector('#kLogo img'),
  tabs: [...document.querySelectorAll('.k-seg button')].map(b => b.textContent),
  hero: [...document.querySelectorAll('.k-hero img')].length,
  cards: [...document.querySelectorAll('.k-card')].map(c => c.dataset.open),
  mine: [...document.querySelectorAll('.k-card .tag')].map(t => t.closest('.k-card').dataset.open),
  imgs: [...document.querySelectorAll('.k-card .pic img')].filter(i => i.complete && i.naturalWidth).length,
  prices: [...document.querySelectorAll('.k-card .pr')].map(x => x.textContent) }));
console.log('   ' + JSON.stringify(v).slice(0, 400));
ok(v.ttl === 'Мерч для Кава на розі' && v.logo, 'шапка «Мерч для Кава на розі» з логотипом клієнта', 'шапка: ' + v.ttl);
ok(v.tabs.join() === 'Усі,Футболки,Худі,Світшоти,Аксесуари', 'вкладки: ' + v.tabs.join(' / '), 'вкладки: ' + v.tabs);
ok(v.hero >= 4, 'банер-комплект з мокапами (' + v.hero + ')', 'банер: ' + v.hero);
ok(v.cards.length === 9 && v.cards[0] === 'tee' && v.cards[1] === 'cap' && v.mine.join() === 'tee,cap', 'усі 9 виробів; вибране в квізі — першим, з позначкою «ваш вибір»', 'картки: ' + v.cards + ' / ' + v.mine);
ok(v.imgs === 9 && v.prices.filter(x => /₴ \/ шт/.test(x)).length === 2 && v.prices.filter(x => /ціну скаже менеджер/.test(x)).length === 7,
  'на кожній картці мокап з логотипом; ціна — лише де відома ціна виробу (футболка, кепка), решта — «ціну скаже менеджер»', 'мокапи/ціни: ' + v.imgs + ' ' + v.prices);
const teeCol = await p.evaluate(() => window.__kit.mock('tee', 'white', 'center').then(m => m && m.url && m.parts[0].side));
ok(teeCol === 'front', 'колір із квізу (біла футболка) — у мокапі', 'колір: ' + teeCol);
await p.click('.k-seg [data-tab="hoodie"]'); await p.waitForTimeout(200);
const hood = await p.evaluate(() => [...document.querySelectorAll('.k-card')].map(c => c.dataset.open));
ok(hood.length && hood.every(g => /^hoodie/.test(g)), 'вкладка «Худі» — лише худі: ' + hood.join(', '), 'фільтр: ' + hood);
await p.click('.k-seg [data-tab="all"]'); await p.waitForTimeout(300);

console.log('');
console.log('═══ БАНЕРИ З ЛОГОТИПОМ ═══');
const bn = await p.evaluate(() => [...document.querySelectorAll('.k-ban')].map(b => ({ t: b.textContent, img: !!b.querySelector('img'), inGrid: !!b.closest('.k-grid') })));
ok(bn.length === 2 && /Літо для команди/.test(bn[0].t) && bn[0].img && !bn[0].inGrid && /Худі на осінь/.test(bn[1].t) && bn[1].inGrid,
  'банери з адмінки: перший — угорі, другий — між товарами (після 4-го)', 'банери: ' + JSON.stringify(bn));
const px = await p.evaluate(async () => {
  const b = window.LQKit.banners('all')[0], logo = await window.LQKit.loadImg(document.querySelector('#kLogo img').src);
  const u = await window.LQKit.renderBanner(b, logo, { ar: 120 / 320 });
  const im = await window.LQKit.loadImg(u), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const at = (fx, fy) => [...x.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data].slice(0, 3);
  return { mid: at(0.5, 0.4), out: at(0.5, 0.4 + 0.3 * 120 / 320 / 2 + 0.03), edge: at(0.5 - 0.15 + 0.01, 0.4) };
});
ok(px.mid[0] > 200 && px.mid[1] < 120 && px.edge[0] > 200 && !(px.out[0] > 200 && px.out[1] < 120),
  'логотип клієнта вписано в рамку банера: на всю ширину рамки, не вище її', 'пікселі: ' + JSON.stringify(px));
await p.click('.k-seg [data-tab="hoodie"]'); await p.waitForTimeout(300);
const hb = await p.evaluate(() => [...document.querySelectorAll('.k-ban b')].map(b => b.textContent));
ok(hb.join() === 'Літо для команди,Худі на осінь', 'у вкладці «Худі» — банер для худі (і загальні)', 'вкладка: ' + hb);
await p.click('.k-seg [data-tab="all"]'); await p.waitForTimeout(300);

console.log('');
console.log('═══ ТОВАР І КОШИК ═══');
await p.click('.k-card[data-open="tee"]'); await p.waitForTimeout(700);
const sh = await p.evaluate(() => ({ vs: [...document.querySelectorAll('.k-v')].map(b => b.dataset.k), on: (document.querySelector('.k-v.on') || {}).dataset?.k,
  big: !!document.querySelector('#kBig img'), unit: document.getElementById('kUnit').textContent, sw: document.querySelectorAll('.k-sw button').length }));
ok(sh.vs.join() === 'left,center,back' && sh.on === 'center' && sh.big && /30 шт ×/.test(sh.unit) && sh.sw > 5,
  'у товарі: кольори, 3 варіанти розміщення (обрано «по центру»), 30 шт — ціна', 'вікно: ' + JSON.stringify(sh));
await p.click('.k-v[data-k="back"]'); await p.waitForTimeout(300);
await p.click('.k-sw [data-c="black"]'); await p.waitForTimeout(300);
await p.fill('#kQty', '40'); await p.waitForTimeout(300);
const unit = await p.evaluate(() => document.getElementById('kUnit').textContent);
ok(/40 шт ×/.test(unit), 'кількість 40 — ціна перерахувалась: ' + unit, 'кількість: ' + unit);
await p.click('[data-add]'); await p.waitForTimeout(300);
await p.click('.k-card[data-open="cap"]'); await p.waitForTimeout(600);
await p.click('[data-add]'); await p.waitForTimeout(600);
const barTxt = await p.evaluate(() => document.getElementById('kBarInfo').textContent + ' | ' + document.getElementById('kCartBtn').textContent);
ok(/₴/.test(barTxt) && /2 поз\. · 70 шт/.test(barTxt) && /Кошик · 2/.test(barTxt), 'панель кошика: ' + barTxt, 'панель: ' + barTxt);
await p.click('#kCartBtn'); await p.waitForTimeout(800);
const cart = await p.evaluate(() => ({ lines: [...document.querySelectorAll('.k-line')].map(l => l.textContent.replace(/\s+/g, ' ').trim()),
  tot: document.getElementById('kCartTot').textContent }));
console.log('   ' + JSON.stringify(cart));
const num = s => +String(s).replace(/[^\d]/g, '');
const sums = cart.lines.map(l => num((/(\d[\d ]*) ₴$/.exec(l) || [])[1]));
ok(cart.lines.length === 2 && /Чорний · велике на спині/.test(cart.lines[0]) && /40 шт/.test(cart.lines[0]) && num(cart.tot) === sums[0] + sums[1],
  'кошик: 2 позиції (футболка чорна, велике на спині, 40 шт), «Разом» = сума рядків', 'кошик: ' + JSON.stringify(cart));
await p.fill('#kfName', 'Олена'); await p.fill('#kfPhone', '067 123 45 67');
await p.click('[data-go]');
await p.waitForSelector('.k-ok', { timeout: 8000 }); await p.waitForTimeout(300);
const ord = await p.evaluate(() => (window.__ADDED || [])[0]);
ok(ord && ord.col === 'webOrders' && ord.d.site === 'kit' && ord.d.phone === '+380671234567' && ord.d.items.length === 2 &&
   ord.d.items[0].config.colorId === 'black' && ord.d.items[0].qty === 40 && /cloudinary/.test(ord.d.items[0].mockups[0]) && ord.d.items[0].prints[0].side === 'back' &&
   /каталог: http/.test(ord.d.note) && Math.abs(ord.d.totalPrice - num(cart.tot)) <= 1,
  'оформлено: замовлення в Канбан (site: kit) з мокапами, розміщенням, логотипом і посиланням на каталог', 'замовлення: ' + JSON.stringify(ord).slice(0, 300));
ok(leads.length >= 2 && /Каталог клієнта: замовлення/.test(leads[0].context) && leads[1].files.some(f => f.kind === 'logo'),
  'Telegram: одразу контакт і склад, потім мокапи й логотип', 'ліди: ' + JSON.stringify(leads).slice(0, 200));
const after = await p.evaluate(() => document.getElementById('kCartBtn').textContent);
ok(after === 'Кошик', 'після оформлення кошик порожній', 'кошик: ' + after);

console.log('');
console.log('═══ ТЕЛЕФОН ═══');
const m = await page(380, 800);
await m.goto(link); await m.waitForTimeout(2500);
const mv = await m.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle(document.querySelector('.k-grid')).gridTemplateColumns.split(' ').length }));
if(process.env.LQ_SHOT){ await m.screenshot({ path: process.env.LQ_SHOT + '/kit-phone.png', fullPage: false }); await p.goto(link); await p.waitForTimeout(2500); await p.screenshot({ path: process.env.LQ_SHOT + '/kit-desk.png', fullPage: true }); }
ok(mv.over <= 0 && mv.cols === 2, 'на телефоні — дві колонки, як у магазині, без прокрутки вбік', 'телефон: ' + JSON.stringify(mv));
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'міні-сайт клієнта: вітрина з його логотипом, кошик і замовлення в Канбан');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
