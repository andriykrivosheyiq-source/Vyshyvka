/* АНАЛІТИКА НЕ ВИСНЕ НА ВЕЛИКИХ ДАНИХ — І ЦИФРИ ТІ САМІ (04.11.2026).

   Андрій: «аналітика глючить… не можу навіть зайти». «Загальна»
   (renderAnAll) для кожного замовлення перебирала ВСІ платежі, а anDayOf
   щоразу будувала календар ICU (toLocaleDateString з часовим поясом):
   300 B2C / 100 B2B / 1 200 платежів — 111 с, 1 500 / 500 / 6 000 — клік не
   проходив. Тепер один форматувальник з памʼяттю дат і платежі розкладено
   по замовленнях один раз. Перевіряємо не секундами, а викликами:
   1. anDayOf дає те саме, що стара (еталон tests/an-heavy-old.js, коміт
      9d6a236), на тисячах моментів: рядки, числа, межі доби за Києвом,
      переходи літнього часу, порожнє й биті дати.
   2. Ті самі цифри: стара renderAnAll і нова на однакових даних
      (B2C з платежами, B2B з оплатами в картці й без, не привʼязані,
      витрати, зарплати, перекази між своїми, відмови) — #an-all однаковий
      до символу. Раз — повністю стара на малих даних, раз — стара з
      перевіреним новим anDayOf на великих.
   3. 1 500 B2C / 500 B2B / 6 000 платежів: «Аналітика» відкривається,
      «На рахунках» на екрані; за прохід renderAnAll форматувань дат не
      більше, ніж різних дат, toLocaleDateString — жодного, викликів
      anDayOf — лінійно (не замовлення × платежі).

   Запуск:  node tests/an-heavy.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9172;
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
const OLD = fs.readFileSync(path.join(ROOT, 'tests/an-heavy-old.js'), 'utf8');
await p.addScriptTag({ content: OLD });
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; archLoad = async () => 1; });

/* Дані: детерміновані, з усіма видами руху, що бачить «Загальна». */
const fill = (N_B2C, N_B2B, N_PAY) => p.evaluate(({ N_B2C, N_B2B, N_PAY }) => {
  payWatching = true; payLoaded = true;
  contentData.fin = Object.assign({}, contentData.fin, { accounts:[{ id:'a1', name:'Моно', bank:'mono', start: 5000 },
    { id:'a2', name:'Приват', bank:'privat', start: 1000 }, { id:'np1', name:'НП', bank:'np' }] });
  orders.length = 0; payments.length = 0;
  const T0 = Date.now();
  /* Частина моментів — біля півночі за Києвом (21:00–21:59 UTC), щоб день
     за Києвом і за UTC розходились. */
  const day = i => new Date(T0 - (i % 75) * 864e5 - (i % 2 ? 0 : (T0 % 864e5) - 21.5 * 36e5) - (i * 7919 % 86400) * 1000).toISOString();
  for(let i = 0; i < N_B2C; i++){
    const id = String(5000001 + i), at = day(i * 3);
    orders.push({ id:'c' + i, orderId:id, dir:'b2c', status: i % 9 ? 'b2c-new' : 'cancel', source: ['B2C', 'Telegram', 'сайт', ''][i % 4],
      crmChatId: i % 4 === 3 ? '' : 'c' + i, createdAt: at, touchedAt: at,
      totalPrice: 1500 + (i % 7) * 300, ttn: i % 3 ? '2045' + String(1000000000 + i) : '', ttnCod: 800,
      items:[{ name:'Худі', qty:1 + i % 3, unitPrice:900, price:900 * (1 + i % 3), cost:500 }] });
  }
  for(let i = 0; i < N_B2B; i++){
    const at = day(i * 5 + 1);
    orders.push({ id:'b' + i, orderId:String(1000001 + i), status: ['paid','prod','done','kp','lead','cancel'][i % 6], source: i % 2 ? 'сайт' : 'Instagram', createdAt: at, touchedAt: at,
      totalPrice: 10000 + i * 10, totalCost: 6000, items:[{ name:'Футболка', qty:50, unitPrice:200, price:10000, cost:6000 }],
      payments: i % 3 ? [{ at, sum: 4000, kind:'prepay' }, { at: day(i * 5 + 9), sum: 1500, kind:'final' }] : [] });
  }
  for(let i = 0; i < N_PAY; i++){
    const at = day(i);
    let orderId = '';
    if(i % 3 === 0) orderId = String(5000001 + (i * 7) % N_B2C);
    else if(i % 3 === 1 && i % 5) orderId = String(1000001 + (i % N_B2B));
    const amount = i % 11 === 0 ? -300 - (i % 5) * 100 : 500 + (i % 9) * 100;
    payments.push({ id:'p' + i, at, amount: orderId ? Math.abs(amount) : amount, acc: ['a1', 'a2', 'np1'][i % 3], src: i % 37 === 0 ? 'salary' : ['mono', 'privat', 'np'][i % 3],
      orderId, tag: orderId ? (i % 2 ? 'prepay' : 'cod') : (i % 13 === 0 ? 'own' : ''), ttn: i % 4 ? '' : '2045' + String(1000000000 + i), counter:'Клієнт ' + i });
  }
  /* Пара «між своїми»: −2000 з Моно і +2000 на Приват за 5 хв. */
  payments.push({ id:'own1', at: day(2), amount: -2000, acc:'a1', src:'mono' },
                { id:'own2', at: new Date(Date.parse(day(2)) + 3e5).toISOString(), amount: 2000, acc:'a2', src:'privat' });
  return orders.length + '/' + payments.length;
}, { N_B2C, N_B2B, N_PAY });
const DAYS = () => p.evaluate(() => { const r = []; for(let i = 59; i >= 0; i--) r.push(anDayOf(new Date(Date.now() - i * 864e5).toISOString())); return [...new Set(r)]; });

console.log('═══ 1. anDayOf — ТОЙ САМИЙ ДЕНЬ, ЩО Й ДОТИ ═══');
const d1 = await p.evaluate(() => {
  const xs = ['', null, undefined, 0, 'не дата', '2026-13-45', '2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z', '2026-10-25T00:59:59Z',
    '2026-10-25T01:00:00Z', '2026-10-24T20:59:59Z', '2026-10-24T21:00:00Z', '2026-07-31T20:59:59.999Z', '2026-07-31T21:00:00Z',
    '2026-11-04', '2026-11-04T10:00:00+02:00', 1762300800000, '1762300800000'];
  const T0 = Date.parse('2025-01-01T00:00:00Z');
  for(let i = 0; i < 4000; i++){ const t = T0 + i * 3 * 3600e3 + (i * 7919 % 3600) * 1000; xs.push(i % 2 ? new Date(t).toISOString() : t); }
  const bad = [];
  xs.forEach(x => { const a = anDayOf(x), b = anDayOf_old(x), a2 = anDayOf(x); if(a !== b || a2 !== a) bad.push([x, a, b]); });
  return { n: xs.length, bad: bad.slice(0, 5), nb: bad.length };
});
ok(!d1.nb, d1.n + ' моментів (межі доби за Києвом, літній час, рядки, числа, биті) — день той самий',
  'розходиться ' + d1.nb + ' з ' + d1.n + ': ' + JSON.stringify(d1.bad));

const same = async label => {
  const days = await DAYS();
  const r = await p.evaluate(days => {
    const spend = 777;
    renderAnAll_old(days, '', spend); const a = document.getElementById('an-all').innerHTML;
    document.getElementById('an-all').innerHTML = '';
    renderAnAll(days, '', spend); const b = document.getElementById('an-all').innerHTML;
    let k = 0; while(k < a.length && a[k] === b[k]) k++;
    const txt = document.getElementById('an-all').textContent.replace(/\s+/g, ' ');
    return { eq: a === b, len: a.length, at: k, a: a.slice(Math.max(0, k - 60), k + 80), b: b.slice(Math.max(0, k - 60), k + 80),
      txt: txt.slice(0, 160), dayRows: (b.match(/<tr><td>\d{4}-\d\d-\d\d/g) || []).length };
  }, days);
  ok(r.eq && r.len > 2000 && r.dayRows > 10, label + ': #an-all однаковий до символу (' + r.len + ' знаків, днів з рухом ' + r.dayRows + ')',
    label + ': розходиться з символу ' + r.at + '\n     було:  ' + r.a + '\n     стало: ' + r.b);
  return r;
};

console.log('═══ 2. ТІ САМІ ЦИФРИ, ЩО Й ДОТИ ═══');
console.log('   дані ' + await fill(60, 30, 400));
await same('стара повністю (60 B2C / 30 B2B / 400 платежів)');
/* Пункт 1 довів, що anDayOf = anDayOf_old; на великих даних стара бере
   новий день — інакше вона сама рахувала б хвилини. */
await p.evaluate(() => { window.__anDayOfOld = anDayOf_old; anDayOf_old = anDayOf; });
console.log('   дані ' + await fill(400, 150, 2000));
const r2 = await same('стара з новим днем (400 / 150 / 2 000)');
console.log('   ' + r2.txt);

console.log('═══ 3. 1 500 B2C / 500 B2B / 6 000 ПЛАТЕЖІВ — ВІДКРИВАЄТЬСЯ, ВИКЛИКІВ ЛІНІЙНО ═══');
console.log('   дані ' + await fill(1500, 500, 6000));
await p.evaluate(() => {
  const C = window.__C = { fmt: 0, tlds: 0, day: 0, render: 0, dates: new Set(), fmtIn: 0, dayIn: 0, tldsIn: 0 };
  const F = Intl.DateTimeFormat.prototype, fmt0 = Object.getOwnPropertyDescriptor(F, 'format').get;
  Object.defineProperty(F, 'format', { configurable: true, get(){ const f = fmt0.call(this); return d => { C.fmt++; return f(d); }; } });
  const tl0 = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function(){ C.tlds++; return tl0.apply(this, arguments); };
  const day0 = anDayOf;
  anDayOf = function(t){ C.day++; if(t) C.dates.add(String(t)); return day0(t); };
  const r0 = renderAnAll;
  renderAnAll = function(){ C.render++; const f = C.fmt, d = C.day, t = C.tlds; ANDAY_M.clear();
    try{ return r0.apply(this, arguments); } finally { C.fmtIn = Math.max(C.fmtIn, C.fmt - f); C.dayIn = Math.max(C.dayIn, C.day - d); C.tldsIn = Math.max(C.tldsIn, C.tlds - t); } };
});
const t0 = Date.now();
await p.click('[data-view="analytics"]', { timeout: 60000 });
await p.waitForFunction(() => /На рахунках/.test((document.getElementById('an-all') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
const dt = Date.now() - t0;
const c = await p.evaluate(() => { const C = window.__C, n = orders.length + payments.length + orders.reduce((a, o) => a + ((o.payments || []).length), 0);
  return { render: C.render, fmtIn: C.fmtIn, dayIn: C.dayIn, tldsIn: C.tldsIn, dates: C.dates.size, n,
    shown: /На рахунках/.test((document.getElementById('an-all') || {}).textContent || '') }; });
console.log('   ' + dt + ' мс · ' + JSON.stringify(c));
ok(c.shown && c.render >= 1, '«Аналітика» відкрилась, «На рахунках» на екрані', 'не відкрилась: ' + JSON.stringify(c));
ok(c.fmtIn <= c.dates + 1, 'форматувань дат за прохід ' + c.fmtIn + ' — не більше, ніж різних дат (' + c.dates + ')', 'форматувань ' + c.fmtIn + ' при ' + c.dates + ' різних датах');
ok(c.tldsIn === 0, 'toLocaleDateString у «Загальній» — жодного', 'toLocaleDateString: ' + c.tldsIn);
ok(c.dayIn <= 4 * c.n, 'викликів anDayOf ' + c.dayIn + ' — лінійно (≤ 4 × ' + c.n + ' замовлень і платежів), не замовлення × платежі',
  'викликів anDayOf ' + c.dayIn + ' при ' + c.n + ' — знову вкладений прохід');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'аналітика: великі дані відкриваються, цифри ті самі');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
