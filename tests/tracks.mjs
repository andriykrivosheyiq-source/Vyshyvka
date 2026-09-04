/* Треки: кілька станів замовлення замість одного.

   Досі в картки був один статус — колонка дошки продажів. Але одна колонка
   не вміє сказати «макет готовий, але тканина ще їде», а це стан кожного
   другого замовлення. Через це після оплати картка застрягала в «Оплачено»
   й відповідь на «а що з ним зараз» жила в трьох чатах.

   Тепер поруч із продажем ідуть шість треків: дизайн, одяг, тест, тираж,
   контроль, відправка. Вони рухаються незалежно — дизайнер малює, поки одяг
   їде. Замовлення при цьому нікуди не переїжджає: картка одна, номер один,
   історія одна; міняється не місце, а стан.

   Перевіряємо те, від чого залежить довіра до дошки:
     — смуга стану зʼявляється тоді, коли їй є що сказати, а не на кожній
       свіжій заявці шістьма порожніми плашками;
     — рух треку зберігається в картку й одразу видно на дошці;
     — кожен рух лягає в стрічку подій — з ким і коли, як і етапи продажу;
     — кроки треків налаштовуються тим самим редактором, що й етапи
       продажу, і зберігаються окремо від них.

   Запуск:  node tests/tracks.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8805;
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

const CONTENT = { sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };

/* Оплачене замовлення — воно вже живе виробничим життям. */
const PAID = {
  id:'1', orderId:'1000201', type:'client', name:'Оксана', phone:'+380670000201',
  company:'Кава Друзі', status:'paid', site:'main', offerToken:'tok1',
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'test@loomiq' }],
  createdAt:new Date(Date.now() - 3 * 864e5).toISOString(),
  hist:[{ s:'paid', at:new Date(Date.now() - 864e5).toISOString() }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000 }]
};
/* Свіже звернення — грошей не було, виробництва теж. */
const FRESH = {
  id:'2', orderId:'1000202', type:'client', name:'Ігор', phone:'+380670000202',
  status:'kp', site:'main', payments:[], items:[],
  createdAt:new Date().toISOString(), hist:[],
  totalPrice:0, totalCost:0, margin:0, marginPct:0
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([PAID, FRESH]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
/* Записи в документ сайту складаємо в купку: саме ними зберігаються
   налаштовані кроки, і перевірити треба саме те, що пішло в базу. */
fbstub = fbstub.replace(
  'Doc.prototype.set=function(){ return Promise.resolve(); };',
  'Doc.prototype.set=function(d){ (window.__SET=window.__SET||[]).push(d); return Promise.resolve(); };');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ СМУГА ЗʼЯВЛЯЄТЬСЯ ТАМ, ДЕ ЇЙ Є ЩО СКАЗАТИ ═══');
await p.click('.ticket:has-text("1000202")');
await p.waitForTimeout(900);
const fresh = await p.evaluate(() => ({
  tracks: document.querySelectorAll('#orderDrawer .od-tracks').length,
  strip:  document.querySelectorAll('.ticket:has(.t-oid) .tc-tracks').length
}));
ok(fresh.tracks === 0,
  'у свіжому зверненні виробничих треків немає — шість порожніх плашок нічого не кажуть',
  'треки показані там, де виробництва ще не було');

await p.click('#orderDrawer [data-od-close2]');
await p.waitForTimeout(400);
await p.click('.ticket:has-text("1000201")');
await p.waitForTimeout(900);
const paid = await p.evaluate(() => {
  const box = document.querySelector('#orderDrawer .od-tracks');
  return {
    has: !!box,
    labels: box ? [...box.querySelectorAll('.od-trk i')].map(x => x.textContent.trim()) : [],
    sels: box ? [...box.querySelectorAll('select')].map(s => s.dataset.track) : []
  };
});
console.log('  ' + paid.labels.join(' · '));
ok(paid.has && paid.sels.length === 6,
  'в оплаченому замовленні шість треків, кожен зі своїм вибором',
  'треків не шість: ' + paid.sels.join(','));
ok(paid.labels.join(',') === 'Дизайн,Одяг,Тест,Тираж,Контроль,Відправка',
  'треки названі так, як про них говорять уголос',
  'назви треків інші: ' + paid.labels.join(','));

console.log('');
console.log('═══ РУХ ТРЕКУ ═══');
await p.selectOption('#orderDrawer [data-track="design"]', 'check');
await p.waitForTimeout(700);
const moved = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000201');
  const tick = [...document.querySelectorAll('.ticket')]
    .find(t => (t.textContent || '').indexOf('1000201') >= 0);
  return {
    saved: (o.tracks || {}).design,
    hist: (o.trackHist || []).map(h => h.t + ':' + h.s + (h.by ? '/' + h.by : '')),
    chips: tick ? [...tick.querySelectorAll('.tc-trk')].map(x => x.textContent.trim()) : []
  };
});
console.log('  у картці: ' + moved.saved + ' · на дошці: ' + moved.chips.join(' | '));
ok(moved.saved === 'check',
  'вибраний крок збережений у картку',
  'крок не зберігся: ' + moved.saved);
ok(moved.hist.length === 1 && /^design:check\//.test(moved.hist[0]),
  'рух записаний в історію разом із тим, хто його зробив',
  'історія треків не та: ' + JSON.stringify(moved.hist));
ok(moved.chips.length === 1 && /Дизайн · На перевірці/.test(moved.chips[0]),
  'на дошці видно рівно те, що зрушило: «Дизайн · На перевірці»',
  'смуга на дошці не та: ' + JSON.stringify(moved.chips));

/* Інші треки мовчать — і правильно роблять: «Контроль очікує» на кожній
   картці не інформація, а шум. */
ok(moved.chips.length === 1,
  'треки, які ще не рухались, на дошці мовчать',
  'на дошку виліз увесь список: ' + JSON.stringify(moved.chips));

console.log('');
console.log('═══ ФІНІШ ТРЕКУ ═══');
await p.selectOption('#orderDrawer [data-track="design"]', 'ok');
await p.waitForTimeout(700);
const done = await p.evaluate(() => {
  const tick = [...document.querySelectorAll('.ticket')]
    .find(t => (t.textContent || '').indexOf('1000201') >= 0);
  return {
    chip: tick ? (tick.querySelector('.tc-trk') || {}).textContent : '',
    tick: !!document.querySelector('#orderDrawer .od-trk-ok')
  };
});
console.log('  ' + String(done.chip).trim());
ok(/Дизайн ✓/.test(done.chip || '') && done.tick,
  'закритий трек показаний галочкою, а не довгою назвою кроку',
  'фініш треку не позначений: ' + done.chip);

console.log('');
console.log('═══ СТРІЧКА ПОДІЙ ═══');
await p.click('#orderDrawer [data-fold="log"]');
await p.waitForTimeout(400);
const feed = await p.evaluate(() =>
  [...document.querySelectorAll('#orderDrawer .od-feed .od-fe')].map(x => x.textContent.replace(/\s+/g,' ').trim()));
feed.slice(0, 4).forEach(x => console.log('  │ ' + x));
ok(feed.some(x => /Дизайн: Макет погоджено/.test(x)) &&
   feed.some(x => /Дизайн: На перевірці/.test(x)),
  'обидва рухи треку стоять у стрічці — як і етапи продажу',
  'рухів треку в стрічці немає');

console.log('');
console.log('═══ НАЛАШТУВАННЯ КРОКІВ ═══');
await p.click('[data-od-close2]');
await p.waitForTimeout(300);
await p.click('#st-toggle');
await p.waitForTimeout(400);
const tabs = await p.evaluate(() =>
  [...document.querySelectorAll('#st-tabs .st-tab')].map(b => b.textContent.trim()));
console.log('  ' + tabs.join(' · '));
ok(tabs.length === 7 && tabs[0] === 'Продажі',
  'редактор один на всі воронки: продаж і шість треків',
  'вкладок не сім: ' + tabs.join(','));

await p.click('#st-tabs [data-tab="design"]');
await p.waitForTimeout(300);
const rows = await p.evaluate(() => ({
  n: document.querySelectorAll('#st-list .st-row').length,
  done: document.querySelectorAll('#st-list [data-done]').length,
  first: (document.querySelector('#st-list input[type=text]') || {}).value
}));
ok(rows.n === 5 && rows.first === 'Нові',
  'кроки дизайну відкрились для редагування',
  'у треку дизайну не ті кроки: ' + JSON.stringify(rows));
ok(rows.done === 5,
  'у треків є позначка «фініш» — саме на неї потім дивитимуться ворота',
  'позначки «фініш» немає');

await p.fill('#st-list input[type=text]', 'Черга дизайнера');
await p.click('#st-save');
await p.waitForTimeout(600);
const wrote = await p.evaluate(() => {
  const s = (window.__SET || []).filter(x => x && x.trackStatuses).pop();
  return s ? { keys:Object.keys(s.trackStatuses),
               first:s.trackStatuses.design[0],
               n:s.trackStatuses.design.length,
               sale:!!s.kanbanStatuses } : null;
});
console.log('  ' + JSON.stringify(wrote));
ok(wrote && wrote.keys.join() === 'design' && wrote.first.label === 'Черга дизайнера',
  'перейменований крок пішов у базу під своїм треком',
  'у базу пішло не те: ' + JSON.stringify(wrote));
ok(wrote && wrote.first.key === 'new' && wrote.first.done === false,
  'ключ кроку при перейменуванні не змінився — до нього прив\'язані картки',
  'ключ кроку поїхав разом із назвою: ' + JSON.stringify(wrote && wrote.first));
ok(wrote && !wrote.sale,
  'етапи продажу цим збереженням не зачеплені — вони живуть окремо',
  'збереження треку переписало етапи продажу');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'замовлення має стільки станів, скільки процесів іде одночасно');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
