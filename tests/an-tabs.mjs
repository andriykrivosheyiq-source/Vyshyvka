/* АНАЛІТИКА: ЧОТИРИ ВКЛАДКИ, ФІНАНСИ — РАХУНКИ Й КОМАНДА.

   Андрій (02.10): «в фінансах — рахунки і команда»; аналітика окремо:
   загальна (гроші за період, гроші зараз, по сайту / Telegram /
   Instagram), B2B, B2C і сайт; один перемикач періоду — дні або місяць.

   Запуск:  node tests/an-tabs.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8979;
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

/* «Я» — власник: бачу і Фінанси, і всю аналітику. */
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }] };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
/* Документи знають, хто вони: так видно, що саме записали у Фінанси й у
   постійні витрати, і що саме стерли. */
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
  "Doc.prototype.set=function(v){ (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)) }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.delete=function(){ return Promise.resolve(); };",
  "Doc.prototype.delete=function(){ (window.__DELS=window.__DELS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var s=(window.__SETS||[]).filter(function(x){ return x.col===this.__col && x.id===this.__id; }, this).pop();" +
  " return Promise.resolve(new Snap(this.__id||'x', s ? s.v : null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace("return Promise.resolve({ id:'stub' });",
  "return Promise.resolve({ id:'pay' + (window.__ADDED.length) });");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
/* prompt «скільки виплачено» — приймаємо запропоноване число; confirm — так. */
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });



/* ── Гроші й замовлення за період ── */
await p.evaluate(() => {
  const now = new Date().toISOString();
  payWatching = true;                 // підписку не вмикаємо — платежі кладемо самі
  payLoaded = true;                   // …і вони «прийшли з бази»: грошове ядро рахує з них
  contentData.fin = Object.assign({}, contentData.fin, { accounts:[{ id:'a1', name:'Моно', bank:'mono', start: 5000 }, { id:'a2', name:'Картка Катерини', bank:'mono' }] });
  orders.length = 0;
  orders.push(
    { id:'b1', orderId:'1000001', status:'paid', source:'сайт', createdAt: now, totalPrice: 10000, items:[],
      payments:[{ at: now, sum: 4000, kind:'prepay' }] },
    { id:'b2', orderId:'1000002', status:'new', source:'вручну', createdAt: now, totalPrice: 3000, items:[] },
    { id:'b3', orderId:'1000003', status:'lead', source:'сайт', createdAt: now, totalPrice: 9999, items:[] },
    { id:'c1', orderId:'5000001', dir:'b2c', status:'b2c-new', source:'B2C', crmChatId:'c1', createdAt: now, totalPrice: 1500, items:[] },
    { id:'c2', orderId:'5000002', dir:'b2c', status:'b2c-new', source:'Telegram', createdAt: now, totalPrice: 800, items:[] });
  payments.length = 0;
  payments.push(
    { id:'p1', at: now, amount: 1000, acc:'a1', orderId:'5000001', tag:'prepay' },
    { id:'p2', at: now, amount: 800,  acc:'a1', orderId:'5000002', tag:'pay' },
    { id:'p3', at: now, amount: 700,  acc:'a1' },                               // без привʼязки
    { id:'p4', at: now, amount: -2000, acc:'a1', src:'salary', desc:'Зарплата' },
    { id:'p5', at: now, amount: -500, acc:'a1', desc:'Нитки' },
    /* Переказ з ФОПа на картку Катерини — гроші просто переїхали. */
    { id:'p6', at: now, amount: -3000, acc:'a1', desc:'Переказ на картку' },
    { id:'p7', at: new Date(Date.now() + 60000).toISOString(), amount: 3000, acc:'a2', desc:'З рахунку ФОП' });
});

console.log('\n═══ ФІНАНСИ — РАХУНКИ Й КОМАНДА ═══');
await p.click('[data-view="fin"]');
await p.waitForTimeout(300);
const фін = await p.evaluate(() => [...document.querySelectorAll('[data-fin-tab]')].map(b => b.textContent.trim()));
ok(фін.join('|') === 'Рахунки|Команда', 'у Фінансах лише «Рахунки» й «Команда»', 'вкладки Фінансів: ' + фін.join('|'));

console.log('\n═══ АНАЛІТИКА — ЧОТИРИ ВКЛАДКИ ═══');
await p.click('[data-view="analytics"]');
await p.waitForTimeout(2500);
const вид = () => p.evaluate(() => {
  const vis = el => !!el && el.offsetParent !== null;
  return { вкладки: [...document.querySelectorAll('#an-tabs [data-an-top]')].map(b => b.textContent.trim()),
           on: (document.querySelector('#an-tabs .on') || {}).textContent,
           блоки: [...document.querySelectorAll('#an-block button')].filter(vis).map(b => b.textContent.trim()),
           сайти: vis(document.getElementById('an-site')),
           панелі: ['all','b2c','main','traffic','behav','ads','sales','money'].filter(k => vis(document.getElementById('an-pane-' + k))) };
});
let v = await вид();
console.log('  ' + JSON.stringify(v));
ok(v.вкладки.join('|') === 'Загальна|Аналітика B2B|Аналітика B2C|Аналітика сайту' && v.on === 'Загальна' &&
   v.панелі.join() === 'all' && !v.блоки.length && !v.сайти,
  'чотири вкладки; відкривається «Загальна» — без блоків і без фільтра сайтів', 'вигляд: ' + JSON.stringify(v));
await p.click('#an-tabs [data-an-top="b2b"]'); await p.waitForTimeout(150);
v = await вид();
ok(v.блоки.join('|') === 'Продажі|Прибуток і гроші' && v.панелі.join() === 'sales' && v.сайти,
  'B2B: «Продажі» і «Прибуток і гроші», фільтр сайтів є', 'B2B: ' + JSON.stringify(v));
await p.click('#an-tabs [data-an-top="site"]'); await p.waitForTimeout(150);
v = await вид();
ok(v.блоки.join('|') === 'Головне|Трафік|Поведінка|Реклама' && v.панелі.join() === 'main',
  'сайт: «Головне», «Трафік», «Поведінка», «Реклама»', 'сайт: ' + JSON.stringify(v));
await p.click('#an-tabs [data-an-top="b2c"]'); await p.waitForTimeout(150);
v = await вид();
ok(v.панелі.join() === 'b2c', 'B2C — аналітика, що доти жила у Фінансах', 'B2C: ' + JSON.stringify(v));
const b2cN = await p.evaluate(() => { const c = [...document.querySelectorAll('#fin-an .an-c')].slice(0, 3).map(x => x.querySelector('b').textContent.replace(/\s/g, '')); return c; });
ok(b2cN[0] === '2' && b2cN[1] === '2300₴' && b2cN[2] === '1800₴', 'B2C за період: 2 замовлення на 2 300 ₴, надійшло 1 800 ₴', 'B2C: ' + JSON.stringify(b2cN));

console.log('\n═══ ЗАГАЛЬНА: ГРОШІ ЗАРАЗ, ЗА ПЕРІОД І ЗВІДКИ ═══');
await p.click('#an-tabs [data-an-top="all"]'); await p.waitForTimeout(150);
/* Поточний місяць — тим самим перемикачем, що й дні. */
const M = await p.evaluate(() => finMonths(1)[0]);
await p.selectOption('#an-month', M);
await p.waitForTimeout(2500);
const зага = await p.evaluate(() => {
  const c = {};
  document.querySelectorAll('#an-all .an-c').forEach(x => { c[x.querySelector('span').textContent] = x.querySelector('b').textContent.replace(/\s/g, ''); });
  const рядки = {};
  document.querySelectorAll('#an-all .an-src-t tbody tr').forEach(r => { const t = [...r.children].map(x => x.textContent.replace(/\s/g, '')); рядки[r.children[0].textContent] = t.slice(1); });
  return { c, рядки, період: [...document.querySelectorAll('#an-all .an-h')].map(x => x.textContent)[1],
           активна: !!document.querySelector('#an-period button.active') };
});
console.log('  ' + JSON.stringify(зага));
ok(зага.c['На рахунках'] === '5000₴' && зага.c['Клієнти винні · B2B'] === '9000₴' && зага.c['Клієнти винні · B2C'] === '500₴',
  'гроші зараз: на рахунках 5 000 (залишок 5 000 + рухи по рахунку), клієнти винні B2B 9 000 (звернення не рахуємо) і B2C 500', 'зараз: ' + JSON.stringify(зага.c));
ok(зага.c['Надійшло'] === '6500₴' && зага.c['Кешфлоу'] === '4000₴' && Object.keys(зага.c).some(k => /зарплати 2\s?000/.test(k)),
  'за період: надійшло 6 500, витрачено 2 500 (з них зарплати 2 000), кешфлоу 4 000', 'період: ' + JSON.stringify(зага.c));
const R = зага.рядки;
ok(R['Сайт'] && R['Сайт'][0] === '1' && R['Сайт'][1] === '10000₴' && R['Сайт'][2] === '4000₴' &&
   R['Instagram'][3] === '1000₴' && R['Telegram'][3] === '800₴' && R['Вручну / інше'][1] === '3000₴' &&
   R['Не привʼязано до замовлення'][4].indexOf('700₴') === 0,
  'звідки: сайт 1 замовлення на 10 000 і 4 000 надійшло; Instagram 1 000; Telegram 800; вручну 3 000; без привʼязки 700',
  'джерела: ' + JSON.stringify(R));
const свої = await p.evaluate(() => ({ hint: [...document.querySelectorAll('#an-all .tm-hint')].map(x => x.textContent).join(' '),
  set: Object.keys(finOwnSet()).sort() }));
ok(JSON.stringify(свої.set) === '["p6","p7"]' && /між своїми рахунками за період: 3\s?000/.test(свої.hint),
  'переказ ФОП → картка впізнано «між своїми»: не надходження й не витрата (надійшло так і 6 500, витрачено 2 500)',
  'перекази: ' + JSON.stringify(свої));
/* Помилилась пара — позначаємо руками «не між своїми», і рух рахується. */
const вручну = await p.evaluate(() => { payments.find(x => x.id === 'p7').tag = 'notown'; const o = finOwnSet(); payments.find(x => x.id === 'p7').tag = null; return Object.keys(o); });
ok(!вручну.length, 'позначка «ні, не між своїми» знімає пару з переказів', 'ручна позначка не спрацювала: ' + JSON.stringify(вручну));
await p.click('[data-view="fin"]'); await p.waitForTimeout(300);
const список = await p.evaluate(() => ({ sum: (document.getElementById('fin-sum') || {}).textContent || '',
  чипи: [...document.querySelectorAll('#fin-list .fin-chip.is-own')].length }));
ok(/Надійшло: \+?2\s?500/.test(список.sum.replace(/\u00a0/g, ' ')) && /Між своїми рахунками: 3\s?000/.test(список.sum.replace(/\u00a0/g, ' ')) && список.чипи === 1,
  'у Фінансах (лише рухи по рахунках): надійшло 2 500 без переказу, окремо «між своїми рахунками 3 000», переказ — одним рядком (05.10)', 'Фінанси: ' + JSON.stringify(список));
await p.click('[data-view="analytics"]'); await p.waitForTimeout(500);
ok(/За період · /.test(зага.період) && !зага.активна, 'обраний місяць — заголовок періоду, кнопки днів зняті', 'період: ' + JSON.stringify(зага));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 3).join(' | '));
console.log('\n' + (bad ? '✗ провалів: ' + bad : '✓ усе гаразд'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
