/* Воронка показує два шляхи, а не один.

   На сайт заходять по-різному й по-різному лишають про себе знати: одні
   збирають виріб у конструкторі, інші просто лишають заявку. А воронка
   малювала лише перший шлях — заявка з форми в ній кроком не була: вона
   позначалась тим самим «checkout», що й оформлення кошика, і два різні
   шляхи злипались в один.

   Через це не можна було сказати ні скільки заявок дає форма, ні де
   насправді обривається конструктор. І будь-яка зміна конструктора читалась
   би як обвал, навіть коли заявок стало більше.

   Числа в тесті справжні — з реального звіту клієнта:
   699 зайшли → 287 конструктор → 200 лого → 98 розмір → 23 кошик →
   18 оформлення → 12 замовлень.

   Запуск:  node tests/funnel.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8797;
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

/* Денний підсумок кладемо на 10 днів тому: свіжі дні адмінка перечитує з
   сесій, а старі бере готовими з колекції an_days — саме такий документ і
   підставляємо. */
const AGG = { v:3, visits:699, engaged:400, newVis:538, ret:161, sec:9000, depth:5000,
  orders:12, actSum:0, actN:0, ttfb:0, lcp:0, perfN:0, abandN:75, abandSum:180000, pagesSum:1400,
  steps:{ visit:699, ctor:287, design:200, size:98, cart:23, checkout:18, order:12, lead:41 },
  ev:{ lead_submit:41 }, src:{}, first:{}, dev:{}, land:{}, exit:{}, pick:{},
  hour:{}, dow:{}, ch:{ direct:699 }, chFirst:{ direct:699 } };
const DAY = (n => { const x = new Date(); x.setDate(x.getDate() - n);
  return x.toISOString().slice(0, 10); })(10);

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__DAY=' + JSON.stringify(DAY) + '; window.__AGG=' + JSON.stringify(AGG) +
  ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  'Doc.prototype.get=function(){\n' +
  "    if(this.__col==='an_days' && this.__id===window.__DAY)\n" +
  '      return Promise.resolve(new Snap(this.__id,{ v:3, sites:{ main:window.__AGG } }));\n' +
  "    return Promise.resolve(new Snap('x', null)); };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1280, height:1100 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);
await p.click('[data-view="analytics"]');
await p.waitForTimeout(2500);
await p.click('#an-period [data-d="30"]');
await p.waitForTimeout(3500);

const F = await p.evaluate(() => {
  const box = document.getElementById('an-funnel');
  const кроки = {}, гілки = [];
  [...box.children].forEach(el => {
    if(el.classList.contains('an-fun-h')){ гілки.push(el.textContent.replace(/\s+/g, ' ').trim()); return; }
    const nm = (el.querySelector('.nm') || {}).textContent;
    if(!nm) return;
    кроки[nm.trim()] = (el.querySelector('.vv') || {}).textContent.replace(/\s+/g, ' ').trim();
  });
  return { кроки, гілки,
    тривога: (document.getElementById('an-alerts') || {}).textContent || '' };
});
console.log('═══ ВОРОНКА ═══');
F.гілки.forEach(g => console.log('  ▸ ' + g));
Object.keys(F.кроки).forEach(k => console.log('    ' + k.padEnd(26) + F.кроки[k]));
console.log('');

const has = n => Object.keys(F.кроки).some(k => k.replace(/\s+/g, ' ') === n);
ok(F.гілки.some(g => /конструктор/i.test(g)) && F.гілки.some(g => /форм/i.test(g)),
  'у воронці дві гілки: конструктор і форма заявки',
  'гілок не видно: ' + JSON.stringify(F.гілки));
ok(has('Залишили заявку'),
  'заявка з форми — окремий крок, а не частина ланцюга кошика',
  'кроку заявки немає: ' + JSON.stringify(Object.keys(F.кроки)));
/* Головне в цьому тесті. Відсоток усередині гілки має рахуватись від
   ПОЧАТКУ ГІЛКИ: «скільки з тих, хто відкрив конструктор, доніс лого» —
   200 з 287, тобто 69,7%. Якщо порахувати від усіх візитів, вийде 28,6% і
   гілка знову стане просто продовженням загального ланцюга. */
ok(/69[,.]7/.test(F.кроки['Додали лого/напис'] || ''),
  'відсотки в гілці рахуються від її початку: лого 200 з 287 = 69,7%',
  'лого рахується не від конструктора: ' + F.кроки['Додали лого/напис']);
ok(/287 · 100/.test(F.кроки['Відкрили конструктор'] || ''),
  'початок гілки — це її сто відсотків',
  'початок гілки: ' + F.кроки['Відкрили конструктор']);
/* Заявка рахується від УСІХ візитів: це окремий вхід, і питання тут — яку
   частку сайту він забирає. */
ok(/41 · 5[,.]9/.test(F.кроки['Залишили заявку'] || ''),
  'заявка рахується від усіх візитів: 41 з 699 = 5,9%',
  'заявка порахована не від візитів: ' + F.кроки['Залишили заявку']);
/* Воронка має закінчуватись грішми, а не створеною карткою: ми домовились,
   що картка ≠ гроші, і два звіти не можуть жити в різних реальностях. */
ok(has('Оплачено'),
  'воронка закінчується оплаченими, а не «залишив замовлення»',
  'останнього кроку про гроші немає');
ok(has('Заявок і замовлень'),
  'обидві гілки зводяться в один підсумок',
  'спільного підсумку немає');
/* Найбільша втрата має шукатись усередині конструктора. Якби в пошук
   потрапила форма, «втратою» вважались би всі, хто не лишив заявку, —
   тобто майже всі відвідувачі. */
ok(!/заявк/i.test(F.тривога) || /Найбільша втрата[^.]*конструктор|розмір|кошик|лого/i.test(F.тривога),
  'найбільша втрата шукається в гілці конструктора',
  'у пошук втрати потрапила форма: ' + F.тривога.slice(0, 160));

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'два шляхи видно окремо, і кожен рахується від свого початку');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
