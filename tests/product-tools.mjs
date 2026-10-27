/* КОНСТРУКТОР ↔ КАРТКА B2C; ПЕРЕЙМЕНУВАТИ КОЛІР; ДУБЛЮВАТИ ТОВАР (23.10).

   1. Кожен товар: кольори в картці B2C (id, назва, відтінок, фото) і
      розміри — ті самі, що в конструкторі.
   2. ✎ на кольорі: назва міняється й зберігається одразу, id і фото ті
      самі, картка B2C показує нову назву.
   3. «Дублювати товар»: окремий власний товар з усім наповненням (назва,
      опис, кольори з тими самими фото, сітка, ціни сайту й B2C, базова
      ціна, область нанесення, мокап); джерело не змінилось; копія одразу в
      картці B2C з тими самими кольорами й розмірами.

   Запуск:  node tests/product-tools.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9043;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner', roles:['owner'] },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'3', orderId:'2000390', type:'client', name:'Без напряму', status:'lead', site:'main', crmChatId:'c3', crmChatName:'Без напряму',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
  { id:'b', orderId:'1000390', type:'client', name:'Опт', status:'lead', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  "Doc.prototype.set=function(d){ if(this.__col==='loomiq' && (this.__id==='photos' || this.__id==='private')) (window.__PW=window.__PW||[]).push(JSON.parse(JSON.stringify(d, function(k,v){ return (v && v._methodName) ? '__DEL__' : v; }))); return Promise.resolve(); };");
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
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
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
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });







const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => { window.__PROMPT = null; window.prompt = (q, d) => (window.__PROMPT != null ? window.__PROMPT : d); window.confirm = () => true;
  try{ openDesign(); }catch(e){} });     // картка B2C бере каталог через host відділу — він заводиться тут
await ЖДИ(300);

console.log('═══ 1. КОЖЕН ТОВАР: КОЛЬОРИ Й РОЗМІРИ В КАРТЦІ = КОНСТРУКТОР ═══');
const збіг = await p.evaluate(() => {
  const cat = () => (window.LQDesign.ui.host.catalog ? window.LQDesign.ui.host.catalog() : []);
  const miss = [];
  cat().forEach(g => {
    const ctorC = effectiveColors(g.id).map(c => c.id + ':' + c.name + ':' + (c.hex || '') + ':' + photoUrlFor(g.id, c.id, 'front')).join('|');
    const cardC = (g.colors || []).map(c => c.id + ':' + c.name + ':' + (c.hex || '') + ':' + c.pic).join('|');
    photoGarmentId = g.id;
    const ctorS = currentScRows().map(r => String(r.size)).join(), cardS = (g.sizes || []).join();
    if(ctorC !== cardC) miss.push(g.id + ' кольори');
    if(ctorS !== cardS) miss.push(g.id + ' розміри: ' + cardS + ' ≠ ' + ctorS);
  });
  return { n: cat().length, miss };
});
console.log('   ' + JSON.stringify(збіг));
ok(збіг.n >= 9 && !збіг.miss.length, 'усі ' + збіг.n + ' товарів: кольори (назва, відтінок, фото) і розміри в картці — як у конструкторі', збіг.miss.join(' | '));

console.log('');
console.log('═══ 2. ✎ ПЕРЕЙМЕНУВАТИ КОЛІР ═══');
const ren = await p.evaluate(async () => {
  document.querySelector('.nav button[data-view="photos"]') && document.querySelector('.nav button[data-view="photos"]').click();
  openProduct('hoodie');
  await new Promise(r => setTimeout(r, 200));
  const before = effectiveColors('hoodie')[0];
  window.__PW = []; window.__PROMPT = 'Пісочний';
  const btn = document.querySelector('#pcol-current [data-pcolren="0"]');
  if(btn) btn.click();
  await new Promise(r => setTimeout(r, 300));
  const after = effectiveColors('hoodie')[0];
  const card = (window.LQDesign.ui.host.catalog().find(g => g.id === 'hoodie') || {}).colors[0];
  const w = window.__PW.find(x => x.productColors && x.productColors.hoodie);
  return { btn: !!btn, beforeId: before.id, afterId: after.id, afterName: after.name, cardName: card.name, cardPic: card.pic, pic: photoUrlFor('hoodie', before.id, 'front'),
    wrote: !!w && w.productColors.hoodie[0].name === 'Пісочний', others: effectiveColors('hoodie').length === (w ? w.productColors.hoodie.length : -1), chip: document.getElementById('pcol-current').textContent.includes('Пісочний') };
});
console.log('   ' + JSON.stringify(ren));
ok(ren.btn && ren.afterId === ren.beforeId && ren.afterName === 'Пісочний' && ren.wrote && ren.others && ren.chip,
  '✎ на кольорі: назва «Пісочний» записана одразу, id той самий, решта кольорів на місці', JSON.stringify(ren));
ok(ren.cardName === 'Пісочний' && ren.cardPic === ren.pic, 'картка B2C показує нову назву, фото те саме', JSON.stringify(ren));

console.log('');
console.log('═══ 3. ДУБЛЮВАТИ ТОВАР ═══');
const dup = await p.evaluate(async () => {
  /* Наповнення джерела: світшот з власною сіткою, описом, цінами, областю, мокапом і одним завантаженим фото. */
  contentData.names = Object.assign({}, contentData.names, { sweat: 'Світшот класичний' });
  contentData.descriptions = Object.assign({}, contentData.descriptions, { sweat: 'Щільний футер 320 г' });
  contentData.sizecharts = Object.assign({}, contentData.sizecharts, { sweat: [{ size:'S', A:66, B:52 }, { size:'M', A:68, B:55 }, { size:'L', A:70, B:58 }, { size:'XL', A:72, B:61 }, { size:'3XL', A:76, B:67 }] });
  contentData.printAreas = Object.assign({}, contentData.printAreas, { sweat: { front: { x: 10, y: 20, w: 30, h: 40 }, scaleSize: 'M' } });
  contentData.mockcal = Object.assign({}, contentData.mockcal, { sweat: { x1: 1, x2: 2, y: 3 }, 'sweat-back': { x1: 4, x2: 5, y: 6 } });
  contentData.products = Object.assign({}, contentData.products, { retail: Object.assign({}, (contentData.products || {}).retail, { sweat: 1490 }), cost: { sweat: 410 }, order: ['tee', 'sweat', 'hoodie'] });
  contentData.pricing = Object.assign({}, contentData.pricing, { garmentTiersBy: { sweat: [{ from: 10, coef: 0.9 }] } });
  photosMap = Object.assign({}, photosMap, { 'sweat-black-front': 'https://res.cloudinary.com/x/sweat-black-front.jpg' });
  const src0 = JSON.stringify({ n: contentData.names.sweat, sc: contentData.sizecharts.sweat, r: contentData.products.retail.sweat });
  openProduct('sweat');
  window.__PW = []; window.__PROMPT = 'Світшот оверсайз';
  const btn = document.getElementById('prod-dup');
  btn.click();
  await new Promise(r => setTimeout(r, 400));
  const c = ((contentData.products || {}).custom || []).find(x => x.from === 'sweat');
  const id = c && c.id;
  const cat = window.LQDesign.ui.host.catalog();
  const s = cat.find(g => g.id === 'sweat'), d = cat.find(g => g.id === id);
  photoGarmentId = id; const ctorS = currentScRows().map(r => String(r.size)).join();
  return { btn: !!btn, id, name: c && c.name, open: prodDetailId === id, title: (document.getElementById('prod-detail-title') || {}).textContent,
    desc: (contentData.descriptions || {})[id], sizes: d && d.sizes.join(), ctorS, srcSizes: s && s.sizes.join(),
    colors: d && d.colors.map(x => x.id + ':' + x.name).join(), srcColors: s && s.colors.map(x => x.id + ':' + x.name).join(),
    pic0: d && d.colors[0].pic, picBlack: photoUrlFor(id, 'black', 'front'), picWhite: photoUrlFor(id, 'white', 'front'),
    retail: ((contentData.products || {}).retail || {})[id], cost: ((contentData.products || {}).cost || {})[id],
    base: ((contentData.pricing || {}).basePrices || {})[id], tiers: JSON.stringify(((contentData.pricing || {}).garmentTiersBy || {})[id]),
    pa: JSON.stringify((contentData.printAreas || {})[id]), mc: Object.keys(contentData.mockcal || {}).filter(k => k.indexOf(id) === 0).sort().join(),
    order: (contentData.products.order || []).join(), writes: window.__PW.filter(x => !x.accessLog).length, logged: window.__PW.some(x => x.accessLog && JSON.stringify(x.accessLog).includes('дубль товару')),
    srcSame: src0 === JSON.stringify({ n: contentData.names.sweat, sc: contentData.sizecharts.sweat, r: contentData.products.retail.sweat }) };
});
console.log('   ' + JSON.stringify(dup));
ok(dup.btn && dup.id && /^cp/.test(dup.id) && dup.name === 'Світшот оверсайз' && dup.open && dup.title === 'Світшот оверсайз' && dup.writes === 1 && dup.logged,
  'кнопка «Дублювати товар»: новий власний товар «Світшот оверсайз», одразу відкритий, одним записом у базу, слід у журналі', JSON.stringify(dup));
ok(dup.desc === 'Щільний футер 320 г' && dup.sizes === 'S,M,L,XL,3XL' && dup.sizes === dup.ctorS && dup.colors === dup.srcColors,
  'опис, розмірна сітка (S…3XL) і кольори — ті самі; у картці B2C розміри = конструктор', JSON.stringify(dup));
ok(dup.pic0 === 'https://res.cloudinary.com/x/sweat-black-front.jpg' && dup.picBlack === dup.pic0 && /images\/sweat-white-front\.webp$/.test(dup.picWhite),
  'фото ті самі файли: завантажене — те саме посилання, стандартне — файл світшота', JSON.stringify({ a: dup.pic0, w: dup.picWhite }));
ok(dup.retail === 1490 && dup.cost === 410 && dup.base === 740 && dup.tiers === '[{"from":10,"coef":0.9}]' && /"w":30/.test(dup.pa) && dup.mc === dup.id + ',' + dup.id + '-back',
  'ціни сайту й B2C, собівартість, базова ціна, своя шкала знижок, область нанесення, мокап — скопійовано', JSON.stringify(dup));
ok(dup.order === 'tee,sweat,' + dup.id + ',hoodie' && dup.srcSame, 'копія стоїть одразу за світшотом; сам світшот не змінився', JSON.stringify({ o: dup.order, s: dup.srcSame }));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'конструктор і картка B2C збігаються; колір перейменовується, товар дублюється з усім наповненням');
process.exit(bad ? 1 : 0);
