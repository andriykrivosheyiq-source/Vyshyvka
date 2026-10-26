/* ТЕЛЕФОН: ЦЕХ ЗНІМАЄ Й НАДСИЛАЄ ФОТО З ТЕЛЕФОНА (26.10).

   Андрій: «дуже просять мобільну версію для виробництва… момент
   фотографування і надсилання… щоб зручно відкривалась камера».
   Доти дошка B2C розпирала сторінку в ~3000 px, телефон зменшував усе
   до дрібного «компʼютерного» вигляду, а вікно «Готово — фото» стояло
   поза екраном. На екрані телефона (390×844):
   1. Сторінка не ширша за екран; зверху вкладки колонок з числами, видно
      одну колонку; на плитці — що шиємо.
   2. Вкладку перемикає лише людина: фонове оновлення колонку не міняє.
   3. Картка — на весь екран, «📷 Готово — фото» закріплене внизу.
   4. Вікно фото — на весь екран: «📷 Зняти» відкриває задню камеру
      (`capture`), «🖼 З галереї» — кілька; фото з ✓ і «готово N»;
      «Надіслати» → фото в базі, картка «Чекає погодження».
   5. На компʼютері все як було: вкладок, закріпленої дії й камери немає,
      колонки поруч.

   Запуск:  node tests/prod-mobile.mjs (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9155;
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

async function page(opt){
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  p.on('dialog', d => d.accept(''));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  await p.evaluate(async () => {
    const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
    const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
    document.getElementById('view-design').style.display = 'block';
    openDesign();
    const h = U.host;
    const cat = h.catalog().find(x => (x.colors || []).length && (x.sizes || []).length);
    for(const no of ['2000201', '2000202']){
      const o = orders.find(x => x.orderId === no);
      const j = designJobMake(no);
      j.units = [Object.assign(U.unitNew(), { gid: cat.id, name: cat.name, color: (cat.colors[0].name || cat.colors[0].id), size: cat.sizes[0], qty: 2, note:'Лого' })];
      o.tracks = { supply:'got', prod:'work' };
      o.touchedAt = '2026-10-20T10:00:00.000Z';
      await h.orderSave(o);
    }
    h.upload = async f => { await new Promise(r => setTimeout(r, 150)); return 'https://cdn.test/' + encodeURIComponent(f.name); };
    window.__CAT = cat.name;
    U.setTab('prod'); U.open(''); U.render(root);
    await new Promise(r => setTimeout(r, 300));
  });
  return p;
}
const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

/* ── Телефон ── */
const p = await page({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
const r = await p.evaluate(async () => {
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const t = ms => new Promise(z => setTimeout(z, ms));
  const U = LQDesign.ui, root = document.getElementById('dzRoot');
  const out = {};
  const cols = [...root.querySelectorAll('.dz-board > .dz-col')];
  out.дошка = { ширина: document.documentElement.scrollWidth, екран: innerWidth,
    вкладки: [...root.querySelectorAll('.dz-ctab')].filter(vis).map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    видно: cols.filter(vis).map(c => c.dataset.col),
    плитка: ((root.querySelector('.dz-col.is-mcur .dz-card-w .dz-c-what') || {}).textContent || '') };
  out.дошка.щоШиємо = vis(root.querySelector('.dz-col.is-mcur .dz-c-what'));
  /* 2. Вкладка — лише людина. */
  const інша = [...root.querySelectorAll('.dz-ctab')].find(b => !b.classList.contains('on') && b.dataset.ctab === 'ready');
  інша.click(); await t(150);
  const після = (root.querySelector('.dz-ctab.on') || {}).dataset;
  U.renderSoft ? U.renderSoft(root) : U.render(root); await t(100);
  repaintAfterOrders && repaintAfterOrders(); await t(200);
  out.вкладка = { клік: після && після.ctab, фон: (root.querySelector('.dz-ctab.on') || {}).dataset.ctab,
    видно: [...root.querySelectorAll('.dz-board > .dz-col')].filter(vis).map(c => c.dataset.col) };
  root.querySelector('.dz-ctab[data-ctab="run"]').click(); await t(150);
  /* 3. Картка. */
  root.querySelector('.dz-col.is-mcur [data-open="2000201"]').click(); await t(300);
  const bar = root.querySelector('.dz-panel:not(.hide) .dz-mbar');
  const br = bar ? bar.getBoundingClientRect() : null;
  out.картка = { ширина: document.documentElement.scrollWidth, панель: Math.round(root.querySelector('.dz-panel:not(.hide)').getBoundingClientRect().width),
    бар: vis(bar), барНизом: !!br && br.bottom <= innerHeight + 1 && br.bottom > innerHeight - 120,
    барТекст: bar ? bar.textContent : '',
    дубль: [...root.querySelectorAll('.dz-panel:not(.hide) .dz-prod-acts .dz-mb-dup')].some(vis) };
  /* 4. Вікно фото. */
  bar.querySelector('[data-do="prod-done"]').click(); await t(300);
  const m = document.getElementById('dzProdModal');
  const w = m && m.querySelector('.dz-pm-w').getBoundingClientRect();
  const cam = m.querySelector('[data-pm-cam]'), gal = m.querySelector('[data-pm-file]:not([data-pm-cam])');
  const go = m.querySelector('[data-pm-go]').getBoundingClientRect();
  out.вікно = { рамка: w && [Math.round(w.x), Math.round(w.y), Math.round(w.width), Math.round(w.height)],
    камера: vis(cam.closest('label')) && cam.getAttribute('capture') === 'environment' && /image/.test(cam.accept),
    галерея: vis(gal.closest('label')) && gal.multiple && /галереї/.test(gal.closest('label').innerText),
    надіслатиНизом: go.bottom <= innerHeight + 1 && go.bottom > innerHeight - 110,
    підказка: m.querySelector('.dz-pm-l').innerText };
  const png = await new Promise(res => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; c.getContext('2d').fillRect(5, 5, 20, 20); c.toBlob(res, 'image/png'); });
  const dt = new DataTransfer(); dt.items.add(new File([png], 'cam.png', { type:'image/png' }));
  cam.files = dt.files; cam.dispatchEvent(new Event('change'));
  await t(900);
  out.фото = { ок: m.querySelectorAll('.dz-pic .dz-pm-ok').length, стан: m.querySelector('[data-pm-st]').textContent,
    кнопка: m.querySelector('[data-pm-camt]').textContent };
  m.querySelector('[data-pm-go]').click();
  await t(1500);
  const o = window.__ORDERS.find(x => x.orderId === '2000201');
  out.надіслано = { вікно: !!document.getElementById('dzProdModal'), фото: ((o.prodQc || {}).photos || []).length,
    стан: LQDesign.prodAt(designJobs.find ? designJobs.find(j => j.orderId === '2000201') || {} : {}, orders.find(x => x.orderId === '2000201')) };
  return out;
}).catch(e => ({ err: String(e) }));
console.log('   ' + JSON.stringify(r));
const d = r.дошка || {};
ok(d.ширина <= d.екран + 1, 'телефон: сторінка не ширша за екран (було ~3000 px)', 'ширина ' + d.ширина + ' > ' + d.екран);
ok((d.вкладки || []).length >= 3 && (d.видно || []).length === 1 && /На станках\s*2/.test((d.вкладки || []).join('|')),
  'зверху вкладки колонок з числами, видно одну колонку', JSON.stringify({ в: d.вкладки, в2: d.видно }));
ok(d.щоШиємо && /шт/.test(d.плитка), 'на плитці — що шиємо (модель, розмір, штуки)', JSON.stringify(d.плитка));
const v = r.вкладка || {};
ok(v.клік === 'ready' && v.фон === 'ready' && (v.видно || []).join() === 'ready', 'вкладку перемикає людина; фонове оновлення її не міняє', JSON.stringify(v));
const k = r.картка || {};
ok(k.ширина <= 391 && k.панель >= 389 && k.бар && k.барНизом && /Готово — фото/.test(k.барТекст) && /Передрук/.test(k.барТекст) && !k.дубль,
  'картка на весь екран; «📷 Готово — фото» і «Передрук» закріплені внизу, без дублів', JSON.stringify(k));
const w = r.вікно || {};
ok(w.рамка && w.рамка[0] === 0 && w.рамка[1] === 0 && w.рамка[2] === 390 && w.рамка[3] >= 840 && w.надіслатиНизом,
  'вікно фото — на весь екран, «Надіслати» внизу', JSON.stringify(w));
ok(w.камера && w.галерея && !/Ctrl/.test(w.підказка || ''), '«📷 Зняти» відкриває задню камеру; «🖼 З галереї» — кілька фото', JSON.stringify(w));
const f = r.фото || {};
ok(f.ок === 1 && /готово 1/.test(f.стан || '') && /Ще фото/.test(f.кнопка || ''), 'знято → ✓ на фото, «готово 1», кнопка «📷 Ще фото»', JSON.stringify(f));
const n = r.надіслано || {};
ok(!n.вікно && n.фото === 1 && n.стан === 'appr', '«Надіслати на погодження» з телефона → фото в базі, «Чекає погодження»', JSON.stringify(n));

/* ── Компʼютер: як було ── */
const pc = await page({ viewport:{ width:1500, height:940 } });
const rp = await pc.evaluate(async () => {
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const root = document.getElementById('dzRoot'), U = LQDesign.ui;
  const out = { вкладки: [...root.querySelectorAll('.dz-ctab')].some(vis),
    колонок: [...root.querySelectorAll('.dz-board > .dz-col')].filter(vis).length,
    щоШиємо: [...root.querySelectorAll('.dz-on-phone')].some(vis) };
  U.open('2000202'); U.render(root); await new Promise(z => setTimeout(z, 300));
  out.бар = [...root.querySelectorAll('.dz-mbar')].some(vis);
  out.кнопки = [...root.querySelectorAll('.dz-panel:not(.hide) .dz-prod-acts .dz-b')].filter(vis).map(b => b.textContent.trim());
  await U.act('prod-done', root); await new Promise(z => setTimeout(z, 200));
  const m = document.getElementById('dzProdModal');
  out.камера = vis(m.querySelector('[data-pm-cam]').closest('label'));
  out.фото = (m.querySelector('.dz-pm-add') || {}).innerText || '';
  out.підказка = m.querySelector('.dz-pm-l').innerText;
  return out;
});
console.log('   ' + JSON.stringify(rp));
ok(!rp.вкладки && rp.колонок >= 4 && !rp.щоШиємо && !rp.бар && !rp.камера && /＋ Фото/.test(rp.фото) && /Ctrl\+V/.test(rp.підказка) &&
   rp.кнопки.some(x => /Готово — фото/.test(x)),
  'компʼютер: колонки поруч, без вкладок, закріпленої дії й камери — як було', JSON.stringify(rp));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'цех знімає й надсилає фото з телефона; компʼютер як був');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
