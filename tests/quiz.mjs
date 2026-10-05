/* Квіз для B2B (05.10): loomiq.net/quiz.

   Андрій: «окремою сторінкою; у кінці прорахунок, як у КП; контакти — перед
   результатом; варіанти відрізняються розміщенням логотипа, колір обирають
   з палітри; заявка — замовлення в канбані».

   Перевіряємо весь шлях людини з реклами:
     — кроки: сфера → люди → одяг → колір → логотип → контакт → результат;
     — контакт іде в Telegram ОДРАЗУ, ще до мокапів (людина могла закрити вкладку);
     — варіанти: футболка — на серці / по центру / спина, кепка — один;
       «на серці» — праворуч на фото (ліва сторона того, хто вдягнув), ~9 см;
     — ціни — рушієм КП (LQ.priceOrder), разом = сума рядків;
     — заявка лягає в webOrders (Канбан) з мокапами, логотипом і нотаткою;
     — вибір іншого варіанту перераховує прорахунок; «Обираю» — ще одне
       повідомлення менеджеру;
     — на телефоні сторінка не їде вбік.

   Запуск:  node tests/quiz.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8871;
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
const leads = [], ups = [];
await p.route('**/*', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs\/.*app-compat/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
  if(/loomiq-lead/.test(u)){ leads.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
  if(/api\.cloudinary\.com/.test(u)){ ups.push(1); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/t/' + ups.length + '.png' }) }); }
  if(u.startsWith(HOST)) return r.continue();
  return r.fulfill({ status: 204, body: '' });
});
await p.goto(HOST + '/quiz/?staff=1');
await p.waitForTimeout(600);
const click = async sel => { await p.click(sel); await p.waitForTimeout(120); };
const next = () => click('#qNext');
const disabled = () => p.evaluate(() => document.getElementById('qNext').disabled);

console.log('═══ КРОКИ ═══');
ok(await disabled(), 'без відповіді «Далі» неактивна', '«Далі» активна без відповіді');
await click('[data-sp="cafe"]'); await p.fill('#qCo', 'Кава на розі'); await next();
await click('[data-pp="40"]'); await next();
const hint = await p.evaluate(() => [...document.querySelectorAll('.q-g')].filter(b => b.querySelector('.hint')).map(b => b.dataset.g));
ok(hint.includes('tee') && hint.includes('cap'), 'кавʼярні підказано «часто беруть»: ' + hint.join(', '), 'підказки: ' + hint);
await click('[data-g="tee"]'); await click('[data-g="cap"]'); await next();
const sw = await p.evaluate(() => document.querySelectorAll('[data-cg="tee"]').length);
ok(sw >= 5, 'колір — з палітри виробу (' + sw + ' кольорів у футболки)', 'палітра: ' + sw);
await click('[data-cg="tee"][data-cc="black"]');
await next();
console.log('');
console.log('═══ ЛОГОТИП ═══');
await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 200;
  const x = c.getContext('2d'); x.fillStyle = '#E4572E'; x.fillRect(40, 40, 320, 120);   // прозорі поля навколо
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
  const inp = document.getElementById('qFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
});
await p.waitForFunction(() => window.__quiz.state().logo, null, { timeout: 8000 });
const lg = await p.evaluate(() => window.__quiz.state().logo);
ok(Math.abs(lg.ar - 120 / 320) < 0.02 && lg.ink > 0.95, 'прозорі поля обрізано: пропорції ' + lg.ar.toFixed(3) + ', чорнило ' + lg.ink.toFixed(2), 'обрізка: ' + JSON.stringify({ ar: lg.ar, ink: lg.ink }));
await next();
console.log('');
console.log('═══ КОНТАКТ — ПЕРЕД РЕЗУЛЬТАТОМ ═══');
await p.fill('#qName', 'Олена'); await p.fill('#qPhone', '067 123 45 67'); await p.fill('#qTg', '@olena');
ok(!(await disabled()), 'імʼя й телефон є — можна показати варіанти', 'кнопка неактивна');
await next();
await p.waitForSelector('.r-v', { timeout: 8000 });
await p.waitForTimeout(800);
ok(leads.length >= 1 && leads[0].phone === '+380671234567' && /Квіз: нова заявка/.test(leads[0].context) && /Кава на розі/.test(leads[0].context),
  'контакт пішов у Telegram першим повідомленням (+380671234567, компанія)', 'перший лід: ' + JSON.stringify(leads[0] || null));

console.log('');
console.log('═══ ВАРІАНТИ РОЗМІЩЕННЯ ═══');
const vars = await p.evaluate(() => [...document.querySelectorAll('.r-v')].map(b => b.dataset.vg + ':' + b.dataset.vp));
ok(vars.join() === 'tee:left,tee:center,tee:back,cap:acc', 'футболка — на серці / по центру / спина; кепка — один варіант', 'варіанти: ' + vars);
const mk = await p.evaluate(() => { const m = window.__quiz.mocks();
  return Object.fromEntries(Object.entries(m.tee).map(([k, v]) => [k, { cx: v.p.cx, w: v.wCm, h: v.hCm, url: !!v.url, side: v.side }])); });
console.log('   ' + JSON.stringify(mk));
ok(mk.left.cx > 0.55 && Math.abs(mk.left.w - 9) < 0.01 && mk.left.url, '«на серці» — праворуч на фото, 9 см, мокап намальовано', 'на серці: ' + JSON.stringify(mk.left));
ok(Math.abs(mk.center.cx - 0.5) < 0.01 && mk.center.w > 15 && mk.center.w <= 24, 'по центру — посередині, ' + mk.center.w.toFixed(1) + ' см', 'центр: ' + JSON.stringify(mk.center));
ok(mk.back.side === 'back' && mk.back.w > mk.center.w, 'спина — на фото спини й більше за груди', 'спина: ' + JSON.stringify(mk.back));
if(process.env.LQ_SHOT) await p.screenshot({ path: process.env.LQ_SHOT + '/quiz-result.png', fullPage: true });
const imgs = await p.evaluate(() => [...document.querySelectorAll('.r-v .pic img')].filter(i => i.complete && i.naturalWidth > 0).length);
ok(imgs >= 4, 'усі 4 мокапи показано картинками', 'мокапів: ' + imgs);

console.log('');
console.log('═══ ПРОРАХУНОК — РУШІЄМ КП ═══');
const calc = await p.evaluate(() => {
  const pt = window.__quiz.priceTable();
  const tot = (document.querySelector('.r-tot b') || {}).textContent || '';
  return { pt, tot, rows: document.querySelectorAll('.r-row').length };
});
const sum = calc.pt.reduce((s, r) => s + r.sum, 0);
const num = s => +String(s).replace(/[^\d]/g, '');
ok(calc.rows === 2 && num(calc.tot) === Math.round(sum) && calc.pt[0].unit > 440, 'рядок на кожен виріб, «Разом» ' + calc.tot + ' = сума рядків; футболка ' + calc.pt[0].unit + ' ₴/шт (вища за голу 440)', 'прорахунок: ' + JSON.stringify(calc));
const before = calc.pt[0].unit;
await click('[data-vg="tee"][data-vp="back"]');
const after = await p.evaluate(() => window.__quiz.priceTable()[0].unit);
ok(after > before, 'обрали велике на спині — ціна футболки зросла (' + before + ' → ' + after + ')', 'ціна не змінилась: ' + before + ' → ' + after);
const tiers = await p.evaluate(() => (document.querySelector('.r-tiers') || {}).textContent || '');
ok(/При \d+ шт/.test(tiers), 'підказка «що більше — то дешевше»: ' + tiers.slice(0, 70), 'немає підказки тиражу');

console.log('');
console.log('═══ ЗАЯВКА В КАНБАН ═══');
await p.waitForFunction(() => (window.__ADDED || []).length > 0, null, { timeout: 8000 });
const ord = await p.evaluate(() => window.__ADDED[0]);
const o = ord.d;
ok(ord.col === 'webOrders' && o.imported === false && o.site === 'quiz' && o.phone === '+380671234567' && o.name === 'Олена',
  'замовлення лягло в webOrders (site: quiz) — адмінка забере його в «Нове»', 'замовлення: ' + JSON.stringify(o).slice(0, 200));
ok(o.items.length === 2 && o.items[0].config.garmentId === 'tee' && o.items[0].config.colorId === 'black' && o.items[0].qty === 40 &&
   o.items[0].mockups.length === 3 && /cloudinary/.test(o.items[0].mockups[0]) && o.items[0].prints[0].widthMm > 0 && /cloudinary/.test(o.items[0].prints[0].file),
  'позиції з мокапами всіх варіантів (у хмарі), розміром нанесення й файлом логотипа', 'позиції: ' + JSON.stringify(o.items[0]).slice(0, 300));
ok(/Кава на розі/.test(o.note) && /людей: 40/.test(o.note) && /@olena/.test(o.note) && JSON.stringify(o).length < 200000,
  'відповіді квізу — у нотатці картки; документ легкий (без base64)', 'нотатка: ' + o.note);
const second = leads.find(l => /мокапи й прорахунок/.test(l.context));
ok(second && second.files.some(f => f.kind === 'logo') && second.files.filter(f => f.kind === 'mockup').length === 2,
  'у Telegram — логотип і мокапи вибраних варіантів', 'другий лід: ' + JSON.stringify(second || null).slice(0, 200));

const kitA = await p.evaluate(() => (document.querySelector('a.r-kit') || {}).href || '');
ok(/\/k\/#d=/.test(kitA) && /каталог клієнта: http/.test(o.note), 'після заявки — кнопка «Відкрити мій каталог» (міні-сайт), посилання й у картці', 'каталог: ' + kitA);
await click('[data-choose]');
await p.waitForTimeout(200);
ok(leads.some(l => /клієнт обрав/.test(l.context) && /велике на спині/.test(l.context)) && await p.$('.r-ok'),
  '«Обираю ці варіанти» — менеджеру летить вибір (велике на спині), клієнту — «дякуємо»', 'вибір не надіслано');

console.log('');
console.log('═══ ТЕЛЕФОН І ПЕРЕЗАВАНТАЖЕННЯ ═══');
await p.setViewportSize({ width: 380, height: 800 });
await p.reload(); await p.waitForTimeout(1500);
const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, vars: document.querySelectorAll('.r-v').length,
  orders: (window.__ADDED || []).length }));
ok(m.over <= 0 && m.vars === 4, 'на телефоні без горизонтальної прокрутки; після перезавантаження варіанти на місці', 'телефон: ' + JSON.stringify(m));
ok(m.orders === 0, 'перезавантаження не шле заявку вдруге', 'повторна заявка');
if(process.env.LQ_SHOT) await p.screenshot({ path: process.env.LQ_SHOT + '/quiz-phone.png', fullPage: true });
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));

console.log('');
console.log('═══ НУМЕРОВАНІ МІСЦЯ З АДМІНКИ (№1 — на серці, №2 — спереду + спина) ═══');
const PH2 = JSON.parse(JSON.stringify(PHOTOS));
PH2.printAreas.tee.front.places = [{ n:1, x:0.12, y:0.27, w:0.125, h:0.125 }, { n:2, x:0, y:0.3, w:0.3, h:0.2 }];
PH2.printAreas.tee.back.places = [{ n:2, x:0, y:0.3, w:0.35, h:0.3 }];
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', e => errs.push(String(e)));
await p2.addInitScript(ph => { window.__PH = ph; }, PH2);
await p2.route('**/*', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs\/.*app-compat/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
  if(/loomiq-lead|cloudinary/.test(u)) return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  if(u.startsWith(HOST)) return r.continue();
  return r.fulfill({ status: 204, body: '' });
});
await p2.goto(HOST + '/quiz/?staff=1'); await p2.waitForTimeout(500);
const c2 = async sel => { await p2.click(sel); await p2.waitForTimeout(100); };
await c2('[data-sp="it"]'); await c2('#qNext'); await c2('[data-pp="20"]'); await c2('#qNext');
await c2('[data-g="tee"]'); await c2('#qNext'); await c2('#qNext');
await p2.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 200;
  const x = c.getContext('2d'); x.fillStyle = '#2E86E4'; x.fillRect(40, 40, 320, 120);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
  const inp = document.getElementById('qFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
});
await p2.waitForFunction(() => window.__quiz.state().logo, null, { timeout: 8000 });
await c2('#qNext'); await p2.fill('#qName', 'Ігор'); await p2.fill('#qPhone', '0501112233'); await c2('#qNext');
await p2.waitForSelector('.r-v', { timeout: 8000 }); await p2.waitForTimeout(600);
const v2 = await p2.evaluate(() => ({ keys: [...document.querySelectorAll('.r-v')].map(b => b.dataset.vp),
  names: [...document.querySelectorAll('.r-v b')].map(b => b.textContent), spans: [...document.querySelectorAll('.r-v span')].map(b => b.textContent),
  m: Object.fromEntries(Object.entries(window.__quiz.mocks().tee).map(([k, v]) => [k, { parts: v.parts, cx: v.p.cx, url: !!v.url }])) }));
console.log('   ' + JSON.stringify(v2.names) + ' ' + JSON.stringify(v2.spans));
ok(v2.keys.join() === 'n1,n2' && /Варіант 1/.test(v2.names[0]) && /спереду \+ на спині/.test(v2.spans[1]),
  'варіанти — з номерів адмінки: «Варіант 1» і «Варіант 2 · спереду + на спині»', 'варіанти: ' + JSON.stringify(v2));
const n1 = v2.m.n1.parts[0];
ok(Math.abs(n1.wCm - 9) < 0.05 && Math.abs(n1.hCm - 3.375) < 0.05 && v2.m.n1.cx > 0.55,
  'рамка 9×9 см: логотип вписано (9 × 3,4 см — не ширше й не вище рамки), стоїть там, де рамка', '№1: ' + JSON.stringify(v2.m.n1));
const tall = await p2.evaluate(() => { const fr = { H: 72, fx: x => x, fy: y => y, fw: w => w };
  return window.__quiz.placeBox({ x:0, y:0, w:0.125, h:0.05 }, fr, 1); });
ok(Math.abs(tall.hCm - 3.6) < 0.01 && Math.abs(tall.wCm - 3.6) < 0.01, 'низька рамка 9×3,6 см — квадратний логотип зменшено по висоті (3,6 × 3,6)', 'по висоті: ' + JSON.stringify(tall));
ok(v2.m.n2.parts.length === 2 && v2.m.n2.parts.map(q => q.side).join() === 'front,back' && v2.m.n2.url,
  '№2 — два нанесення (спереду й ззаду) на одній картинці', '№2: ' + JSON.stringify(v2.m.n2));
const pr2 = await p2.evaluate(() => [...document.querySelectorAll('.r-v em')].map(e => +e.textContent.replace(/[^\d]/g, '')));
ok(pr2[1] > pr2[0], 'два нанесення дорожчі за одне: ' + pr2.join(' → ') + ' ₴/шт', 'ціни: ' + pr2);
await ctx2.close();

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'квіз: від реклами до картки в Канбані з мокапами й прорахунком');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
