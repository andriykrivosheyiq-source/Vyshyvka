/* Макет із версіями і трьома погодженнями.

   Уся плутанина береться з одного: погодження живуть у чатах. У чаті немає
   версії, немає «хто саме сказав ок», немає «за яким фото». Три людини
   памʼятають три різні реальності, і жодна не помиляється.

   Тому макет живе в замовленні списком версій: версія не редагується, не
   сподобалось — зʼявляється наступна, а попередня лишається назавжди з
   причиною повернення.

   Погоджень три, і вони різні: макет дивимось ми на скріні з Wilcom; відшив
   спершу дивимось ми на фото; і лише потім його бачить клієнт. Друге доти
   не було записане ніде — а криве фото клієнту ніхто не шле, і саме на
   ньому найчастіше вертають назад.

   Перевіряємо:
     — погодження записується з автором, часом і (для клієнта) джерелом;
     — кожне погодження рухає трек, а не лишається записом у щоденнику;
     — причина повернення сама вирішує маршрут: дизайнеру чи на перешив;
     — стара версія стає тільки для читання — переписати історію не можна.

   Запуск:  node tests/artwork.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8806;
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
const ORDER = {
  id:'1', orderId:'1000301', type:'client', name:'Оксана', phone:'+380670000301',
  status:'paid', site:'main',
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'test@loomiq' }],
  createdAt:new Date(Date.now() - 2 * 864e5).toISOString(), hist:[],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt',
           qty:50, unitPrice:500, price:25000, unitCost:300, cost:15000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
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
/* Джерело погодження клієнта питають вікном — відповідаємо так, як
   відповів би менеджер. */
p.on('dialog', d => d.accept('переписка в Telegram'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.click('.ticket:has-text("1000301")');
await p.waitForTimeout(1000);
await p.click('#orderDrawer [data-fold="art"]');
await p.waitForTimeout(400);

console.log('═══ ПЕРША ВЕРСІЯ ═══');
const empty = await p.evaluate(() => ({
  txt: (document.querySelector('#orderDrawer [data-fold="art"] ~ .od-fold-b') || {}).textContent || '',
  vers: document.querySelectorAll('#orderDrawer .art-ver').length
}));
ok(empty.vers === 0 && /Версій ще немає/.test(empty.txt),
  'поки дизайнер нічого не надіслав — версій немає, і про це сказано словами',
  'у порожньому макеті щось намальовано: ' + empty.txt.slice(0, 120));

await p.click('#orderDrawer [data-art-new]');
await p.waitForTimeout(600);
await p.fill('#orderDrawer .art-url', 'https://files.example/1000301_front_v1.dst');
await p.click('#orderDrawer [data-art-add]');
await p.waitForTimeout(600);
const v1 = await p.evaluate(() => {
  const o = orders[0], v = (o.art || [])[0] || {};
  return { n:v.n, by:v.by, files:(v.files || []).map(f => f.kind + ':' + f.name),
           sum:(document.querySelector('#orderDrawer [data-fold="art"] .od-fold-n') || {}).textContent };
});
console.log('  v' + v1.n + ' · ' + v1.files.join(', ') + ' · смуга: ' + v1.sum);
ok(v1.n === 1 && v1.by === 'test@loomiq',
  'версія створена й підписана тим, хто її завів',
  'версія не та: ' + JSON.stringify(v1));
ok(v1.files.length === 1 && /^front:1000301_front_v1$/.test(v1.files[0]),
  'файл підписаний версією, а не «остаточний_фінал2»',
  'імʼя файла не те: ' + v1.files.join());
ok(/v1 · чекає нашого погодження/.test(v1.sum || ''),
  'смуга каже, чийого ходу чекає макет',
  'смуга макета мовчить: ' + v1.sum);

console.log('');
console.log('═══ ТРИ ПОГОДЖЕННЯ РУХАЮТЬ РОБОТУ ═══');
await p.click('#orderDrawer [data-art-ok="art"]');
await p.waitForTimeout(700);
const afterArt = await p.evaluate(() => {
  const o = orders[0];
  return { ap:Object.keys((o.art[0].approvals) || {}), design:(o.tracks || {}).design,
           row:(document.querySelector('#orderDrawer .art-ap.is-ok') || {}).textContent.replace(/\s+/g,' ').trim() };
});
console.log('  ' + afterArt.row);
ok(afterArt.ap.join() === 'art' && afterArt.design === 'ok',
  'погодили макет — трек дизайну закрився сам, без другого натискання',
  'макет погоджено, а трек стоїть: ' + JSON.stringify(afterArt));

await p.click('#orderDrawer [data-art-ok="inner"]');
await p.waitForTimeout(700);
const afterInner = await p.evaluate(() => ({
  test:(orders[0].tracks || {}).test,
  who:((orders[0].art[0].approvals || {}).inner || {}).by
}));
ok(afterInner.test === 'client' && afterInner.who === 'test@loomiq',
  'внутрішнє погодження відшиву записане й відправило тест клієнту',
  'внутрішнє погодження не спрацювало: ' + JSON.stringify(afterInner));

console.log('');
console.log('═══ ПРИЧИНА ВИЗНАЧАЄ МАРШРУТ ═══');
await p.selectOption('#orderDrawer .art-reason', 'crook');
await p.click('#orderDrawer [data-art-back]');
await p.waitForTimeout(700);
const sew = await p.evaluate(() => ({
  back:orders[0].art[0].back, test:(orders[0].tracks || {}).test,
  design:(orders[0].tracks || {}).design,
  txt:(document.querySelector('#orderDrawer .art-back') || {}).textContent
}));
console.log('  ' + String(sew.txt || '').trim());
ok(sew.back && sew.back.route === 'sew' && sew.test === 'work',
  '«криво вишито» — це перешив, і система веде туди сама',
  'маршрут повернення не той: ' + JSON.stringify(sew));
ok(sew.design === 'ok',
  'дизайн при перешиві не чіпаємо — макет тут ні до чого',
  'перешив зачепив трек дизайну: ' + sew.design);

await p.click('#orderDrawer [data-art-new]');
await p.waitForTimeout(700);
await p.selectOption('#orderDrawer .art-reason', 'big');
await p.click('#orderDrawer [data-art-back]');
await p.waitForTimeout(700);
const des = await p.evaluate(() => ({
  design:(orders[0].tracks || {}).design, n:orders[0].art.length,
  back:(orders[0].art[1] || {}).back
}));
ok(des.n === 2 && des.back && des.back.route === 'design' && des.design === 'fix',
  '«завеликий» — це до дизайнера, і трек дизайну знову відкрився',
  'повернення дизайнеру не спрацювало: ' + JSON.stringify(des));

console.log('');
console.log('═══ СТАРА ВЕРСІЯ НЕ ПЕРЕПИСУЄТЬСЯ ═══');
const vers = await p.evaluate(() => {
  const all = [...document.querySelectorAll('#orderDrawer .art-ver')];
  return all.map(v => ({
    head:(v.querySelector('.art-ver-h b') || {}).textContent,
    cur:v.classList.contains('is-cur'),
    btns:v.querySelectorAll('[data-art-ok]').length
  }));
});
console.log('  ' + vers.map(v => v.head + (v.cur ? ' (поточна)' : '') + ' · кнопок ' + v.btns).join(' | '));
ok(vers.length === 2 && vers[0].head === 'v2' && vers[0].cur,
  'нова версія стоїть зверху й вона поточна',
  'порядок версій не той: ' + JSON.stringify(vers));
ok(vers[1].btns === 0,
  'у старій версії погоджувати нічого — вона лишається такою, якою була',
  'стару версію можна переписати: кнопок ' + vers[1].btns);

console.log('');
console.log('═══ ПОГОДЖЕННЯ КЛІЄНТА ЗІ СЛІДОМ ═══');
await p.click('#orderDrawer [data-art-ok="client"]');
await p.waitForTimeout(700);
const cli = await p.evaluate(() => {
  const a = (orders[0].art[1].approvals || {}).client || {};
  return { note:a.note, by:a.by, test:(orders[0].tracks || {}).test };
});
console.log('  ' + JSON.stringify(cli));
ok(cli.note === 'переписка в Telegram' && cli.by === 'test@loomiq',
  'записано не «клієнт погодив», а звідки саме це відомо',
  'сліду погодження немає: ' + JSON.stringify(cli));
ok(cli.test === 'ok',
  'погодження клієнта закриває трек тесту',
  'трек тесту після погодження клієнта: ' + cli.test);

console.log('');
console.log('═══ УСЕ ЦЕ ВИДНО В СТРІЧЦІ ═══');
await p.click('#orderDrawer [data-fold="log"]');
await p.waitForTimeout(400);
const feed = await p.evaluate(() =>
  [...document.querySelectorAll('#orderDrawer .od-feed .od-fe')].map(x => x.textContent.replace(/\s+/g,' ').trim()));
feed.slice(0, 3).forEach(x => console.log('  │ ' + x));
ok(feed.some(x => /Тест: Тест погоджено/.test(x)) && feed.some(x => /Дизайн: Правки/.test(x)),
  'рухи, які зробили погодження, стоять у стрічці нарівні з рештою',
  'стрічка не бачить рухів від погоджень');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'у кожного «ок» є автор, час і версія');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
