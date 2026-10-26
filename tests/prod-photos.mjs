/* ФОТО ЦЕХУ ДОХОДЯТЬ ДО МЕНЕДЖЕРА; «ПОГОДЖЕНО МЕНЕДЖЕРОМ» БЕЗ ТТН (26.10).

   Андрій: «з виробництва відправляють фотки і не доходять до акаунтів…
   додати кнопку менеджером погоджено». Причина: запис картки відхилявся
   (її щойно змінили з іншого пристрою), у памʼять лягала свіжа версія без
   фото, а цех бачив «Надіслано». Тепер:
   1. Фото не завантажилось з першого разу — повтор сам; зовсім — фото
      лишається з «↻ ще раз», надіслати з ним не можна.
   2. Картку тим часом змінили — запис повторюється на свіжій версії, фото
      в базі, чуже теж ціле.
   3. Запис не ліг зовсім — вікно не закривається, фото в ньому, «ще раз».
   4. Менеджер: «✓ Погоджено менеджером» без ТТН → «Можна відправляти» з
      червоним «ТТН ще немає»; на плитці цеху — «⚠ ТТН ще немає».
   5. «Створити реєстр» картку без ТТН не бере й каже про неї.

   Запуск:  node tests/prod-photos.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9153;
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
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = {
  team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  b2c: { dzHours: 24 }
};
const ORDERS = [
  { id:'1', orderId:'2000201', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'2', orderId:'2000202', type:'client', dir:'b2c', name:'Богдан', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport:{ width:1500, height:940 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));

p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });


const r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign();
  const h = U.host;
  const g = h.catalog().find(x => (x.colors || []).length && (x.sizes || []).length);
  const o = orders.find(x => x.orderId === '2000201');
  const j = designJobMake('2000201');
  j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: (g.colors[0].name || g.colors[0].id), size: g.sizes[0], qty: 1, note:'Лого' })];
  o.tracks = { supply:'got', prod:'work' };
  o.touchedAt = '2026-10-20T10:00:00.000Z';
  await h.orderSave(o);
  const db = () => window.__ORDERS.find(x => x.id === o.id);
  const out = { до: D.prodAt(j, o) };
  /* Завантаження: перші два рази відмова, третій — є. «bad» — завжди відмова. */
  let спроб = 0;
  h.upload = async f => { if(/bad/.test(f.name)) throw new Error('мережа'); спроб++; if(спроб < 3) throw new Error('мережа'); return 'https://cdn.test/' + encodeURIComponent(f.name); };
  const png = await new Promise(res => { const c = document.createElement('canvas'); c.width = 40; c.height = 40; c.getContext('2d').fillRect(5, 5, 20, 20); c.toBlob(res, 'image/png'); });
  U.setTab('prod'); U.open('2000201'); U.render(root); await t(200);
  await U.act('prod-done', root);
  await t(100);
  const inp = document.querySelector('#dzProdModal [data-pm-file]');
  const dt = new DataTransfer(); dt.items.add(new File([png], 'ok.png', { type:'image/png' })); dt.items.add(new File([png], 'bad.png', { type:'image/png' }));
  inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  await t(10500);
  out.фото = [...document.querySelectorAll('#dzProdModal .dz-pic')].map(x => x.classList.contains('is-err') ? 'err' : (x.querySelector('img').src.startsWith('https://cdn.test/') ? 'ok' : 'wait'));
  out.спроб = спроб;
  out.ретрай = !!document.querySelector('#dzProdModal [data-pm-retry]');
  document.querySelector('#dzProdModal [data-pm-go]').click(); await t(200);
  out.небезЗбою = !!document.getElementById('dzProdModal') && !(o.prodQc);
  /* Прибрали невдале; поки збирались — картку змінили з іншого пристрою. */
  document.querySelector('#dzProdModal [data-pm-del="1"]').click(); await t(100);
  const d0 = db(); d0.touchedAt = '2099-01-01T00:00:00.000Z'; d0.tracks = Object.assign({}, d0.tracks, { supply:'part' }); d0.mgrEmail = 'kolega@loomiq';
  document.querySelector('#dzProdModal [data-pm-note]').value = 'Усе рівно';
  document.querySelector('#dzProdModal [data-pm-go]').click();
  await t(2500);
  const d1 = db();
  out.конфлікт = { вікно: !!document.getElementById('dzProdModal'), фото: ((d1.prodQc || {}).photos || []).length, qc: (d1.tracks || {}).qc, чуже: d1.mgrEmail,
                   стан: D.prodAt(j, orders.find(x => x.id === o.id)) };
  /* 3. Запис не лягає зовсім. */
  const o2 = orders.find(x => x.orderId === '2000202');
  const j2 = designJobMake('2000202');
  j2.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: (g.colors[0].name || g.colors[0].id), size: g.sizes[0], qty: 1, note:'Лого' })];
  o2.tracks = { supply:'got', prod:'work' }; await h.orderSave(o2);
  U.open('2000202'); U.render(root); await t(150);
  await U.act('prod-done', root); await t(100);
  const dt2 = new DataTransfer(); dt2.items.add(new File([png], 'ok2.png', { type:'image/png' }));
  const inp2 = document.querySelector('#dzProdModal [data-pm-file]'); inp2.files = dt2.files; inp2.dispatchEvent(new Event('change'));
  await t(400);
  const ап0 = h.orderApply; h.orderApply = async () => false;
  document.querySelector('#dzProdModal [data-pm-go]').click(); await t(400);
  out.збій = { вікно: !!document.getElementById('dzProdModal'), фото: document.querySelectorAll('#dzProdModal .dz-pic').length,
               кнопка: (document.querySelector('#dzProdModal [data-pm-go]') || {}).textContent || '', активна: !(document.querySelector('#dzProdModal [data-pm-go]') || {}).disabled };
  h.orderApply = ап0;
  document.querySelector('#dzProdModal [data-pm-x]').click();
  /* 4. Менеджер погоджує без ТТН. */
  const oo = orders.find(x => x.id === o.id);
  U.setTab('acct'); U.open('2000201'); U.render(root); await t(200);
  const кн = document.querySelector('#dzPanel [data-do="prod-ok"]') || document.querySelector('.dz-panel [data-do="prod-ok"]');
  out.кнопка = кн ? { t: кн.textContent, off: !!кн.disabled } : null;
  if(кн) кн.click();
  await t(800);
  const o1 = orders.find(x => x.id === o.id);
  out.погоджено = { стан: D.prodAt(j, o1), безТТН: !!(o1.prodQc && o1.prodQc.ok && o1.prodQc.ok.noTtn), вБазі: !!((db().prodQc || {}).ok) };
  U.render(root); await t(150);
  out.червоне = ((document.querySelector('.dz-panel .dz-no-ttn') || {}).textContent || '');
  U.setTab('prod'); U.open(''); U.render(root); await t(200);
  const w = document.querySelector('.dz-boards [data-open="2000201"]');
  out.плитка = w ? (w.closest('.dz-card-w').textContent || '').replace(/\s+/g, ' ') : '';
  /* 5. Реєстр без ТТН. */
  o1.shipCol = 'reg'; await h.orderSave(o1);
  h.npRegistry = async () => ({ ref:'R', number:'1', notFound:[], errors:[] });
  const toasts = []; const t0 = h.toast; h.toast = m => toasts.push(String(m));
  U.render(root); await t(150);
  const rb = document.querySelector('[data-do="reg-make"]'); if(rb) rb.click();
  await t(500); h.toast = t0;
  out.реєстр = { стан: D.prodAt(j, orders.find(x => x.id === o.id)), toast: toasts.slice(-1)[0] || '' };
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(r.до === 'run' && r.фото.join() === 'ok,err' && r.спроб >= 3 && r.ретрай,
  'фото: перші невдачі повторено само (лягло з 3-ї спроби); зовсім невдале лишилось з «↻ ще раз»', JSON.stringify({ ф: r.фото, с: r.спроб, р: r.ретрай }));
ok(r.небезЗбою, 'з невдалим фото «Надіслати» не пускає — нічого не загубилось', String(r.небезЗбою));
ok(!r.конфлікт.вікно && r.конфлікт.фото === 1 && r.конфлікт.qc === 'check' && r.конфлікт.чуже === 'kolega@loomiq' && r.конфлікт.стан === 'appr',
  'картку тим часом змінили — запис повторено на свіжій: фото в базі, «Чекає погодження», чуже ціле', JSON.stringify(r.конфлікт));
ok(r.збій.вікно && r.збій.фото === 1 && /Надіслати на погодження/.test(r.збій.кнопка) && r.збій.активна,
  'запис не ліг зовсім — вікно лишилось, фото в ньому, кнопка знову активна', JSON.stringify(r.збій));
ok(r.кнопка && /Погоджено менеджером/.test(r.кнопка.t) && !r.кнопка.off && r.погоджено.стан === 'ship' && r.погоджено.безТТН && r.погоджено.вБазі,
  '«✓ Погоджено менеджером» без ТТН активна → «Можна відправляти», записано в базу', JSON.stringify({ к: r.кнопка, п: r.погоджено }));
ok(/ТТН ще немає/.test(r.червоне) && /ТТН ще немає/.test(r.плитка), 'червоним «ТТН ще немає» — і в картці, і на плитці цеху', JSON.stringify({ ч: r.червоне, п: r.плитка.slice(0, 120) }));
ok(r.реєстр.стан === 'reg' && /без ТТН/.test(r.реєстр.toast), 'реєстр картку без ТТН не бере й каже про неї', JSON.stringify(r.реєстр));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'фото цеху доходять; погоджено менеджером — і без ТТН');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
