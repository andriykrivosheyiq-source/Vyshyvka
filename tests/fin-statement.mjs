/* Фінанси: залишок від банку й виписка рахунку.

   ЩО БУЛО НЕ ТАК (03.10). Залишок на картці рахунку рахувала адмінка сама:
   початковий залишок плюс рухи, кожен округлений до гривні. Із банком це не
   сходилось: копійки губились на кожному русі, рухи, що пройшли повз
   вебхук, у суму не потрапляли. Натиск на картку відкривав налаштування, а
   подивитись історію рахунку можна було лише в загальному списку за пів року.

   ЯК МАЄ БУТИ.
     — банк назвав залишок (loomiq/bankBal) — на картці саме він, з копійками
       й позначкою «банк · коли»; не назвав — розрахунок, без втрати копійок;
     — натиск на картку розгортає виписку: усі рухи рахунку за весь час
       (і старші за пів року), нові зверху, сума й залишок після руху;
       Монобанк сам каже залишок після руху — тоді стоїть його число;
     — періоди, «показати ще», згорнути тим самим натиском або ×;
     — ⚙ на картці відкриває налаштування, а не виписку;
     — на телефоні сторінка не їде вбік.

   Запуск:  node tests/fin-statement.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8877;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

/* ── Дані ─────────────────────────────────────────────────────────────── */
const D = (days, h) => new Date(Date.now() - days * 864e5 - (h || 0) * 36e5).toISOString();
const PAY = [];
/* Моно ФОП: банк каже залишок після кожного руху. */
PAY.push({ id:'mono_a', acc:'mono1', at:D(1),  amount: 1500.55, counter:'ТОВ Ромашка', desc:'Оплата за худі #1000123', balAfter: 52572.35, src:'mono' });
PAY.push({ id:'mono_b', acc:'mono1', at:D(2),  amount: -320.20, counter:'Нова пошта', desc:'Доставка', balAfter: 51071.80, src:'mono' });
PAY.push({ id:'mono_c', acc:'mono1', at:D(5),  amount: 2000,    counter:'Іван', desc:'Передоплата', src:'mono' });
/* Старий рух — 200 днів тому: у живий список (пів року) не потрапляє,
   а у виписці «Уся історія» має бути. */
PAY.push({ id:'mono_old', acc:'mono1', at:D(200), amount: 777.77, counter:'Давній клієнт', desc:'Стара оплата', src:'mono' });
/* Приват: банк назвав лише підсумковий залишок. */
PAY.push({ id:'privat_1', acc:'mono3', at:D(1), amount: 300,  counter:'Клієнт П', desc:'Оплата', src:'privat' });
PAY.push({ id:'privat_2', acc:'mono3', at:D(3), amount: -200, counter:'Постачальник', desc:'Тканина', src:'privat' });
/* Рахунок без банку: початковий залишок плюс рухи — з копійками. */
PAY.push({ id:'man_1', acc:'cash', at:D(1), amount: 100.55, counter:'Готівка', desc:'', src:'manual' });
PAY.push({ id:'man_2', acc:'cash', at:D(2), amount: -50.10, counter:'Кава', desc:'', src:'manual' });
/* Багато рухів — для «показати ще». */
for(let i = 0; i < 150; i++)
  PAY.push({ id:'many_' + i, acc:'mono4', at:D(i % 25, i % 24), amount: (i % 2 ? 10 : -5), counter:'Рух ' + i, desc:'', src:'mono' });

const ACCS = [
  { id:'mono1', name:'Моно ФОП Малєєва', bank:'mono', linked:true, start: 0 },
  { id:'mono3', name:'Приват ФОП Зелена', bank:'privat', linked:true },
  { id:'cash',  name:'Каса', bank:'other', start: 1000 },
  { id:'mono4', name:'Моно ФОП 4', bank:'mono', start: 0 }
];
const BANKBAL = {
  mono1: { bal: 52572.35, at: D(1), src:'mono', got: D(1) },
  mono3: { bal: 5000,     at: D(0, 1), src:'privat', got: D(0, 1) }
};

/* Заглушка Firestore: payments — з фільтрами where, loomiq/bankBal — з даними. */
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__PAY=' + JSON.stringify(PAY) + '; window.__BB=' + JSON.stringify(BANKBAL) + '; window.__GETS=0;\n' +
  '  function PayCol(f){ this.f = f || []; }\n' +
  '  PayCol.prototype = Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where = function(k, op, v){ return new PayCol(this.f.concat([[k, op, v]])); };\n' +
  '  PayCol.prototype._l = function(){ var f = this.f; return window.__PAY.filter(function(p){\n' +
  '    return f.every(function(w){ var x = p[w[0]]; return w[1] === "==" ? x === w[2] : w[1] === ">=" ? String(x) >= String(w[2]) : true; }); }); };\n' +
  '  PayCol.prototype._s = function(){ var l = this._l(); return { docs: l.map(function(o){ return new Snap(o.id, o); }),\n' +
  '    forEach: function(cb){ l.forEach(function(o){ cb(new Snap(o.id, JSON.parse(JSON.stringify(o)))); }); }, empty: !l.length }; };\n' +
  '  PayCol.prototype.onSnapshot = function(cb){ var s = this._s(); setTimeout(function(){ cb(s); }, 0); return function(){}; };\n' +
  '  PayCol.prototype.get = function(){ window.__GETS++; var s = this._s(); return new Promise(function(r){ setTimeout(function(){ r(s); }, 150); }); };\n' +
  '  function LqCol(){}\n' +
  '  LqCol.prototype = Object.create(Col.prototype);\n' +
  '  LqCol.prototype.doc = function(n){ var d = new Doc(); if(n === "bankBal") d.onSnapshot = function(cb){\n' +
  '    setTimeout(function(){ cb(new Snap("bankBal", window.__BB)); }, 0); return function(){}; }; return d; };\n' +
  '  window.firebase={');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){\n' +
  '      return n === "payments" ? new PayCol() : n === "loomiq" ? new LqCol() : new Col(); },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(viewport){
  const p = await browser.newPage({ viewport });
  p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5000);
  await p.evaluate(a => { contentData.fin = Object.assign({}, contentData.fin || {}, { accounts: a }); }, ACCS);
  /* На телефоні меню сховане за кнопкою — натискаємо пункт кодом. */
  await p.evaluate(() => document.querySelector('[data-view="fin"]').click());
  await p.waitForTimeout(1200);
  return p;
}
const p = await open({ width:1400, height:1000 });

console.log('═══ ЗАЛИШОК НА КАРТЦІ ═══');
const cards = await p.evaluate(() => Array.from(document.querySelectorAll('#fin-cards .fin-c')).map(c => ({
  id: c.dataset.finAccOpen || 'all',
  s: (c.querySelector('.fin-c-s') || {}).textContent || '',
  at: (c.querySelector('.fin-c-at') || {}).textContent || '' })));
const card = id => cards.find(c => c.id === id) || {};
console.log('   ' + cards.map(c => c.id + ': ' + c.s + ' (' + c.at + ')').join(' · '));
ok(card('mono1').s === '52 572,35 ₴' && /^банк · /.test(card('mono1').at),
  'Моно: залишок, який назвав банк, — з копійками й позначкою «банк»',
  'Моно показує не банківський залишок: ' + JSON.stringify(card('mono1')));
ok(card('mono3').s === '5 000 ₴' && /^банк/.test(card('mono3').at),
  'Приват: так само банківський залишок, а не сума рухів',
  'Приват: ' + JSON.stringify(card('mono3')));
ok(card('cash').s === '1 050,45 ₴' && card('cash').at === 'розрахунок',
  'рахунок без банку — початковий + рухи, копійки не губляться (1000 + 100,55 − 50,10)',
  'розрахунок неточний: ' + JSON.stringify(card('cash')));
ok(card('all').s === '58 997,80 ₴',
  '«Разом» — сума карток (52 572,35 + 5 000 + 1 050,45 + 375)',
  '«Разом» не сходиться: ' + card('all').s);

console.log('');
console.log('═══ ВИПИСКА РОЗГОРТАЄТЬСЯ НАТИСКОМ НА КАРТКУ ═══');
await p.click('#fin-cards [data-fin-acc-open="mono1"] .fin-c-n');
await p.waitForTimeout(600);
const h1 = await p.evaluate(() => {
  const b = document.getElementById('fin-hist');
  return { shown: !b.hidden, title: (b.querySelector('.fin-hist-h b') || {}).textContent || '',
    on: !!document.querySelector('#fin-cards .fin-c.on[data-fin-acc-open="mono1"]'),
    modal: !!document.querySelector('.fin-modal'),
    rows: Array.from(b.querySelectorAll('.fin-hrow')).map(r => ({
      who: r.querySelector('.fin-who b').textContent, amt: r.querySelector('.fin-amt').textContent,
      bal: r.querySelector('.fin-bal').textContent, calc: r.querySelector('.fin-bal').classList.contains('is-calc') })),
    sum: (b.querySelector('.fin-sum') || {}).textContent || '' };
});
console.log('   ' + h1.title + ' · ' + h1.sum);
h1.rows.forEach(r => console.log('     ' + r.who + '  ' + r.amt + '  → ' + r.bal + (r.calc ? ' (пораховано)' : ' (банк)')));
ok(h1.shown && h1.on && !h1.modal, 'натиск розгорнув виписку під картками, картка підсвічена, налаштування не відкрились',
  'виписка не розгорнулась: ' + JSON.stringify({ shown: h1.shown, on: h1.on, modal: h1.modal }));
ok(/Моно ФОП Малєєва/.test(h1.title), 'у заголовку — назва рахунку', 'заголовок: ' + h1.title);
ok(h1.rows.length === 3 && h1.rows[0].who === 'ТОВ Ромашка' && h1.rows[2].who === 'Іван',
  'за 30 днів — три рухи, нові зверху', 'рядки: ' + h1.rows.map(r => r.who).join(', '));
ok(h1.rows[0].amt === '+1 500,55 ₴' && h1.rows[1].amt === '−320,20 ₴',
  'суми з копійками й знаком', 'суми: ' + h1.rows.map(r => r.amt).join(', '));
ok(h1.rows[0].bal === '52 572,35 ₴' && !h1.rows[0].calc && h1.rows[1].bal === '51 071,80 ₴' && !h1.rows[1].calc,
  'залишок після руху — той, що сказав Монобанк', 'залишки: ' + h1.rows.map(r => r.bal).join(', '));
ok(h1.rows[2].bal === '51 392 ₴' && h1.rows[2].calc,
  'де банк не сказав — пораховано від попереднього (51 071,80 + 320,20)', 'пораховано: ' + h1.rows[2].bal);
ok(/Прийшло: \+3 500,55 ₴/.test(h1.sum) && /Пішло: −320,20 ₴/.test(h1.sum),
  'зверху — скільки прийшло й пішло за період', 'підсумок: ' + h1.sum);

console.log('');
console.log('═══ УСЯ ІСТОРІЯ — І СТАРША ЗА ПІВ РОКУ ═══');
await p.click('#fin-hist [data-fin-hist-days="0"]');
await p.waitForTimeout(300);
const all = await p.evaluate(() => Array.from(document.querySelectorAll('#fin-hist .fin-hrow .fin-who b')).map(b => b.textContent));
ok(all.length === 4 && all[3] === 'Давній клієнт',
  'рух 200-денної давнини видно — виписка тягне всю історію рахунку',
  'старого руху немає: ' + all.join(', '));
await p.click('#fin-hist [data-fin-hist-days="7"]');
await p.waitForTimeout(200);
const w7 = await p.evaluate(() => document.querySelectorAll('#fin-hist .fin-hrow').length);
ok(w7 === 3, 'за 7 днів — три рухи', '7 днів: ' + w7);
/* Привʼязати старий рух — вікно привʼязки відкривається й для нього */
await p.click('#fin-hist [data-fin-hist-days="0"]');
await p.waitForTimeout(200);
await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#fin-hist .fin-hrow')).pop(); b.querySelector('[data-fin-open]').click(); });
await p.waitForTimeout(300);
const m = await p.evaluate(() => { const d = document.querySelector('.fin-modal'); const t = d ? d.textContent : ''; if(d) d.remove(); return t; });
ok(/777,?77|778/.test(m) && /Давній клієнт/.test(m), 'старий рух можна привʼязати до замовлення з виписки',
  'вікно привʼязки для старого руху не відкрилось');

console.log('');
console.log('═══ ПРИВАТ: ЗАЛИШОК ПІСЛЯ РУХУ — ВІД БАНКІВСЬКОГО ═══');
await p.click('#fin-cards [data-fin-acc-open="mono3"]');
await p.waitForTimeout(500);
const h3 = await p.evaluate(() => ({
  title: document.querySelector('#fin-hist .fin-hist-h b').textContent,
  bal: Array.from(document.querySelectorAll('#fin-hist .fin-hrow .fin-bal')).map(b => b.textContent),
  on: Array.from(document.querySelectorAll('#fin-cards .fin-c.on')).map(c => c.dataset.finAccOpen) }));
ok(/Приват/.test(h3.title) && h3.on.join() === 'mono3', 'натиск на іншу картку перемикає виписку на неї',
  'не перемкнулось: ' + JSON.stringify(h3));
ok(h3.bal.join(' | ') === '5 000 ₴ | 4 700 ₴', 'залишки після рухів: 5 000 → 4 700',
  'залишки: ' + h3.bal.join(' | '));
await p.click('#fin-cards [data-fin-acc-open="mono3"]');
await p.waitForTimeout(200);
ok(await p.evaluate(() => document.getElementById('fin-hist').hidden), 'повторний натиск згортає виписку', 'не згорнулась');

console.log('');
console.log('═══ БАГАТО РУХІВ: «ПОКАЗАТИ ЩЕ» ═══');
await p.click('#fin-cards [data-fin-acc-open="mono4"]');
await p.waitForTimeout(500);
const n1 = await p.evaluate(() => ({ rows: document.querySelectorAll('#fin-hist .fin-hrow').length,
  more: (document.querySelector('[data-fin-hist-more]') || {}).textContent || '' }));
await p.click('[data-fin-hist-more]');
await p.waitForTimeout(200);
const n2 = await p.evaluate(() => ({ rows: document.querySelectorAll('#fin-hist .fin-hrow').length,
  more: !!document.querySelector('[data-fin-hist-more]') }));
ok(n1.rows === 100 && /Показати ще \(50\)/.test(n1.more) && n2.rows === 150 && !n2.more,
  'спершу 100 рухів, «Показати ще» — решта 50', 'сторінки: ' + JSON.stringify({ n1, n2 }));
await p.click('[data-fin-hist-x]');
await p.waitForTimeout(200);
ok(await p.evaluate(() => document.getElementById('fin-hist').hidden && !document.querySelector('#fin-cards .fin-c.on')),
  '× згортає виписку', '× не згорнув');

console.log('');
console.log('═══ ⚙ — НАЛАШТУВАННЯ, А НЕ ВИПИСКА ═══');
await p.click('#fin-cards [data-fin-acc-edit="mono1"]');
await p.waitForTimeout(300);
const st = await p.evaluate(() => ({ modal: !!document.querySelector('.fin-modal'), hist: !document.getElementById('fin-hist').hidden }));
ok(st.modal && !st.hist, '⚙ відкриває налаштування рахунку й не розгортає виписку', 'вийшло: ' + JSON.stringify(st));
await p.evaluate(() => { const d = document.querySelector('.fin-modal'); if(d) d.remove(); });
/* Клавіатура: Enter на картці теж розгортає */
await p.focus('#fin-cards [data-fin-acc-open="cash"]');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
ok(await p.evaluate(() => /Каса/.test((document.querySelector('#fin-hist .fin-hist-h b') || {}).textContent || '')),
  'Enter на картці теж розгортає виписку', 'клавіатурою не відкрилось');
await p.close();

console.log('');
console.log('═══ ТЕЛЕФОН ═══');
const ph = await open({ width:390, height:800 });
await ph.click('#fin-cards [data-fin-acc-open="mono1"]');
await ph.waitForTimeout(600);
const ov = await ph.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth,
  rows: document.querySelectorAll('#fin-hist .fin-hrow').length }));
ok(ov.rows === 3 && ov.sw <= ov.w + 1, 'на телефоні виписка вміщається, сторінка не їде вбік',
  'на телефоні: ' + JSON.stringify(ov));
await ph.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'залишок — від банку, виписка — на натиск');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
