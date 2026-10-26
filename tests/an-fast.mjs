/* АНАЛІТИКА НЕ ВИСНЕ: ГРОШІ — ОДРАЗУ З ПАМʼЯТІ (26.10).

   Андрій: «проаналізуй, чому так довго грузить… аналітика зависає, і потім
   не розвисає». Доти один клік на «Аналітика» тягнув усі КП за весь час,
   відвідування сайту за період і попередній період день за днем по черзі
   (до 60 запитів), Telegram з окремим запитом на кожен діалог, увесь
   архів — і після архіву запускав усе ще раз. Гроші при цьому рахуються з
   того, що вже в памʼяті. Перевіряємо:
   1. Відкрили «Аналітика» (вкладка «Загальна») — гроші на екрані одразу;
      жодного запиту за відвідуваннями (an_sessions / an_days), за КП
      (offers) і за Telegram (an_tg) не було.
   2. «Аналітика B2C» — так само з памʼяті, без запитів.
   3. Відкрили «Аналітика сайту» — відвідування тягнуться (тепер пачками),
      і лише тоді.
   4. Повернулись на «Загальна» й знову на «Сайт» — той самий період не
      перераховується вдруге.
   5. Архів приїхав — гроші перемальовано, повного проходу вдруге немає.

   Запуск:  node tests/an-fast.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9163;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.__Q=[];\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
/* Кожен запит до колекції — у журнал: що саме тягнула сторінка. */
fbstub = fbstub.replace("Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };",
  "Col.prototype.get=function(){ window.__Q.push(this.__n + ':get'); return new Promise(function(r){ setTimeout(function(){ r({ docs:[], forEach:function(){}, empty:true, size:0 }); }, 30); }); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ window.__Q.push(this.__col + '/' + this.__id + ':get'); return Promise.resolve(new Snap(this.__id||'x', null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => {
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  const now = new Date().toISOString();
  payWatching = true; payLoaded = true;
  contentData.fin = Object.assign({}, contentData.fin, { accounts:[{ id:'a1', name:'Моно', bank:'mono', start: 5000 }] });
  orders.length = 0;
  orders.push(
    { id:'b1', orderId:'1000001', status:'paid', source:'сайт', createdAt: now, totalPrice: 10000, items:[], payments:[{ at: now, sum: 4000, kind:'prepay' }] },
    { id:'c1', orderId:'5000001', dir:'b2c', status:'b2c-new', source:'B2C', crmChatId:'c1', createdAt: now, totalPrice: 1500, items:[] });
  payments.length = 0;
  payments.push({ id:'p1', at: now, amount: 1000, acc:'a1', orderId:'5000001', tag:'prepay' },
                { id:'p2', at: now, amount: 4000, acc:'a1', orderId:'1000001', tag:'prepay' });
  /* Архів «довантажується» повільно — щоб було видно, що гроші не чекають на нього. */
  window.__archN = 0;
  archLoad = async () => { await new Promise(r => setTimeout(r, 600)); window.__archN++; return 1; };
  window.__Q = [];
});

const Q = () => p.evaluate(() => window.__Q.slice());
const heavy = q => q.filter(x => /^(an_sessions|an_days|offers|an_tg)/.test(x));
const money = () => p.evaluate(() => ({
  all: (document.getElementById('an-all') || {}).textContent || '', b2c: (document.getElementById('fin-an') || {}).textContent || '' }));

console.log('═══ 1. «ЗАГАЛЬНА»: ГРОШІ ОДРАЗУ, БЕЗ ВАЖКИХ ЗАПИТІВ ═══');
const t0 = Date.now();
await p.click('[data-view="analytics"]');
await p.waitForFunction(() => /На рахунках/.test((document.getElementById('an-all') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
const dt = Date.now() - t0;
let m = await money(); let q = await Q();
console.log('   за ' + dt + ' мс · запити: ' + JSON.stringify(q.slice(0, 12)));
const n = s => String(s).replace(/[\s\u00a0\u202f]/g, '');
ok(/На рахунках/.test(m.all) && /10000₴/.test(n(m.all)), 'гроші на екрані («На рахунках 10 000 ₴») за ' + dt + ' мс', 'гроші не зʼявились: ' + m.all.slice(0, 120));
ok(dt < 1500, 'швидше за 1,5 с (архів іще не приїхав)', 'довго: ' + dt + ' мс');
ok(!heavy(q).length, 'жодного запиту за відвідуваннями, КП чи Telegram', 'важкі запити: ' + JSON.stringify(heavy(q)));
await p.waitForTimeout(900);
q = await Q();
const archN = await p.evaluate(() => window.__archN);
ok(archN === 1 && !heavy(q).length, 'архів приїхав — гроші перемальовано, повного проходу вдруге немає', JSON.stringify({ archN, heavy: heavy(q) }));

console.log('═══ 2. «АНАЛІТИКА B2C» — З ПАМʼЯТІ ═══');
await p.evaluate(() => { window.__Q = []; });
await p.click('#an-tabs [data-an-top="b2c"]'); await p.waitForTimeout(300);
m = await money(); q = await Q();
ok(/Надійшло/.test(m.b2c) && /Надійшло1000₴/.test(n(m.b2c)) && !heavy(q).length, 'B2C: «Надійшло 1 000 ₴» без запитів', JSON.stringify({ t: m.b2c.slice(0, 100), q }));

console.log('═══ 3. «АНАЛІТИКА САЙТУ» — ВІДВІДУВАННЯ ТЯГНУТЬСЯ ЛИШЕ ТУТ ═══');
await p.evaluate(() => { window.__Q = []; });
await p.click('#an-tabs [data-an-top="site"]'); await p.waitForTimeout(1500);
q = await Q();
const сесій = q.filter(x => /^an_(sessions|days)/.test(x)).length;
ok(сесій >= 7, 'відвідування за період і попередній тягнуться (' + сесій + ' запитів)', 'запитів: ' + JSON.stringify(q.slice(0, 10)));

console.log('═══ 4. НАЗАД І ЗНОВУ — ТОЙ САМИЙ ПЕРІОД НЕ ПЕРЕРАХОВУЄТЬСЯ ═══');
await p.click('#an-tabs [data-an-top="all"]'); await p.waitForTimeout(200);
await p.evaluate(() => { window.__Q = []; });
await p.click('#an-tabs [data-an-top="site"]'); await p.waitForTimeout(600);
q = await Q();
ok(!heavy(q).length, 'повернення на «Сайт» без нових запитів', 'запити: ' + JSON.stringify(q.slice(0, 8)));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'аналітика: гроші одразу, важке — лише на своїх вкладках');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
