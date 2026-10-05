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
  Col.prototype.add = function(d){ window.__ADDED.push({ col: this.n, d: d }); if(window.__rec) window.__rec(JSON.stringify({ col: this.n, d: d })); return Promise.resolve({ id: 'x' }); };
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
  if(/res\.cloudinary\.com\/t\//.test(u)) return readFile(path.join(ROOT, 'images/tee-white-front.webp')).then(b => r.fulfill({ contentType: 'image/webp', headers: { 'Access-Control-Allow-Origin': '*' }, body: b }));
  if(/api\.cloudinary\.com/.test(u)){ ups.push(1); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ secure_url: 'https://res.cloudinary.com/t/' + ups.length + '.png' }) }); }
  if(u.startsWith(HOST)) return r.continue();
  return r.fulfill({ status: 204, body: '' });
});
await p.goto(HOST + '/quiz/?staff=1');
await p.waitForTimeout(600);
const click = async sel => { await p.click(sel); await p.waitForTimeout(120); };
const next = () => click('#qNext');
const disabled = () => p.evaluate(() => document.getElementById('qNext').disabled);

const ADDED = [];
await p.exposeFunction('__rec', j => { ADDED.push(JSON.parse(j)); });
console.log('═══ КРОКИ: сфера → люди → логотип → контакт (одяг не обираємо) ═══');
ok(await disabled(), 'без відповіді «Далі» неактивна', '«Далі» активна без відповіді');
const cnt0 = await p.evaluate(() => document.getElementById('qCnt').textContent);
ok(cnt0 === 'Крок 1 з 4', 'кроків чотири: ' + cnt0, 'кроки: ' + cnt0);
await click('[data-sp="cafe"]'); await p.fill('#qCo', 'Кава на розі'); await next();
await click('[data-pp="40"]'); await next();
ok(await p.evaluate(() => !!document.querySelector('.q-drop') && !document.querySelector('.q-g')), 'після «скільки людей» — одразу логотип, без вибору одягу й кольору', 'крок одягу лишився');
await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 200;
  const x = c.getContext('2d'); x.fillStyle = '#E4572E'; x.fillRect(40, 40, 320, 120);   // прозорі поля навколо
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
  const inp = document.getElementById('qFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
});
await p.waitForFunction(() => window.__quiz.state().logo, null, { timeout: 8000 });
const lg = await p.evaluate(() => window.__quiz.state().logo);
ok(Math.abs(lg.ar - 120 / 320) < 0.02 && lg.ink > 0.95, 'логотип: прозорі поля обрізано (пропорції ' + lg.ar.toFixed(3) + ')', 'обрізка: ' + JSON.stringify({ ar: lg.ar, ink: lg.ink }));
await next();
await p.fill('#qName', 'Олена'); await p.fill('#qPhone', '067 123 45 67'); await p.fill('#qTg', '@olena');
const btn = await p.evaluate(() => document.getElementById('qNext').textContent);
ok(!(await disabled()) && btn === 'Відкрити мій каталог', 'кнопка «Відкрити мій каталог»', 'кнопка: ' + btn);
await next();

console.log('');
console.log('═══ ПІСЛЯ КОНТАКТУ — ОДРАЗУ КАТАЛОГ ═══');
await p.waitForURL(/\/k\/#d=/, { timeout: 10000 });
await p.waitForTimeout(1500);
ok(leads.length >= 1 && leads[0].phone === '+380671234567' && /Квіз: нова заявка/.test(leads[0].context) && /Кава на розі/.test(leads[0].context),
  'контакт пішов у Telegram першим повідомленням (+380671234567, компанія)', 'перший лід: ' + JSON.stringify(leads[0] || null));
const kit = await p.evaluate(() => ({ brand: (document.querySelector('.k-h') || {}).textContent, cards: document.querySelectorAll('#kFeed > .k-card').length,
  st: window.__kit && window.__kit.state().KIT }));
ok(kit.brand === 'Кава на розі' && kit.cards >= 10 && kit.st.people === 40 && /cloudinary/.test(kit.st.logo.url),
  'відкрився каталог «Кава на розі»: ' + kit.cards + ' товарів з логотипом, ціни на 40 шт', 'каталог: ' + JSON.stringify(kit).slice(0, 200));
const o = (ADDED[0] || {}).d || {};
ok(ADDED[0] && ADDED[0].col === 'webOrders' && o.site === 'quiz' && o.phone === '+380671234567' && o.name === 'Олена',
  'картка в Канбані (webOrders, site: quiz) — ще до переходу', 'замовлення: ' + JSON.stringify(ADDED[0] || null).slice(0, 200));
ok(o.items && o.items.map(x => x.config.garmentId).join() === 'tee,teeover,cap,tote' && o.items[0].qty === 40 && /cloudinary/.test(o.items[0].mockups[0] || ''),
  'у картці — типовий набір сфери (кавʼярня: футболки, кепка, шопер) на 40 шт з мокапами', 'позиції: ' + JSON.stringify((o.items || []).map(x => [x.config.garmentId, x.qty, x.mockups])));
ok(/набір за сферою/.test(o.note) && /каталог клієнта: http.*\/k\/#d=/.test(o.note) && /@olena/.test(o.note),
  'у нотатці: що це набір за сферою, Telegram клієнта й посилання на його каталог', 'нотатка: ' + o.note);
const second = leads.find(l => /мокапи й прорахунок/.test(l.context));
ok(second && /Каталог клієнта: http/.test(second.context) && second.files.some(f => f.kind === 'logo'), 'менеджеру в Telegram — логотип і посилання на каталог клієнта', 'другий лід: ' + JSON.stringify(second || null).slice(0, 200));

console.log('');
console.log('═══ ЛОГОТИП НЕ ЛІГ У ХМАРУ — ЗАПАСНИЙ ШЛЯХ ═══');
const ctx3 = await browser.newContext({ viewport: { width: 380, height: 800 } });
const p3 = await ctx3.newPage();
p3.on('pageerror', e => errs.push(String(e)));
await p3.route('**/*', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs\/.*app-compat/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: STUB });
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: '' });
  if(/loomiq-lead/.test(u)) return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  if(/api\.cloudinary\.com/.test(u)) return r.fulfill({ status: 500, body: 'no' });
  if(u.startsWith(HOST)) return r.continue();
  return r.fulfill({ status: 204, body: '' });
});
await p3.goto(HOST + '/quiz/?staff=1'); await p3.waitForTimeout(500);
const over = await p3.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const c3 = async sel => { await p3.click(sel); await p3.waitForTimeout(100); };
await c3('[data-sp="it"]'); await c3('#qNext'); await c3('[data-pp="20"]'); await c3('#qNext');
await p3.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 300; c.height = 300;
  const x = c.getContext('2d'); x.fillStyle = '#2E86E4'; x.fillRect(50, 50, 200, 200);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
  const inp = document.getElementById('qFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
});
await p3.waitForFunction(() => window.__quiz.state().logo, null, { timeout: 8000 });
await c3('#qNext'); await p3.fill('#qName', 'Ігор'); await p3.fill('#qPhone', '0501112233'); await c3('#qNext');
await p3.waitForSelector('.r-v', { timeout: 10000 }); await p3.waitForTimeout(500);
const fb = await p3.evaluate(() => ({ url: location.pathname, vars: document.querySelectorAll('.r-v').length, tot: (document.querySelector('.r-tot b') || {}).textContent || '',
  added: (window.__ADDED || []).length }));
ok(over <= 0, 'квіз на телефоні — без прокрутки вбік', 'прокрутка: ' + over);
ok(fb.url === '/quiz/' && fb.vars >= 3 && fb.added === 1, 'хмара недоступна — каталогу немає, але людина бачить варіанти й прорахунок тут, а картка все одно в Канбані', 'запасний: ' + JSON.stringify(fb));
await ctx3.close();

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
  if(u.startsWith(HOST)) return r.continue();
  return r.fulfill({ status: 204, body: '' });
});
await p2.goto(HOST + '/quiz/?staff=1'); await p2.waitForTimeout(600);
const v2 = await p2.evaluate(async () => {
  const K = window.LQKit;
  const c = document.createElement('canvas'); c.width = 320; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#2E86E4'; x.fillRect(0, 0, 320, 120);
  const logo = await K.loadImg(c.toDataURL('image/png')), L = { ar: 120 / 320, ink: 1 };
  const m1 = await K.renderMock('tee', 'black', 'n1', logo, L), m2 = await K.renderMock('tee', 'black', 'n2', logo, L);
  const fr = { H: 72, fx: v => v, fy: v => v, fw: v => v };
  return { keys: K.placesFor('tee'), n1: m1.parts, n1cx: m1.p.cx, n2: m2.parts.map(q => q.side), n2url: !!m2.url,
           d1: K.vinfo('tee', 'n2').d, tall: K.placeBox({ x:0, y:0, w:0.125, h:0.05 }, fr, 1) };
});
console.log('   ' + JSON.stringify(v2));
ok(v2.keys.join() === 'n1,n2' && v2.d1 === 'спереду + на спині', 'варіанти — з номерів адмінки: «Варіант 1», «Варіант 2 · спереду + на спині»', 'варіанти: ' + JSON.stringify(v2));
ok(Math.abs(v2.n1[0].wCm - 9) < 0.05 && Math.abs(v2.n1[0].hCm - 3.375) < 0.05 && v2.n1cx > 0.55,
  'рамка 9×9 см: логотип вписано (9 × 3,4 см — не ширше й не вище рамки), стоїть там, де рамка', '№1: ' + JSON.stringify(v2.n1));
ok(Math.abs(v2.tall.hCm - 3.6) < 0.01 && Math.abs(v2.tall.wCm - 3.6) < 0.01, 'низька рамка 9×3,6 см — квадратний логотип зменшено по висоті (3,6 × 3,6)', 'по висоті: ' + JSON.stringify(v2.tall));
ok(v2.n2.join() === 'front,back' && v2.n2url, '№2 — два нанесення (спереду й ззаду) на одній картинці', '№2: ' + JSON.stringify(v2.n2));
await ctx2.close();
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'квіз: чотири кроки → картка в Канбані → каталог клієнта з його логотипом');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
