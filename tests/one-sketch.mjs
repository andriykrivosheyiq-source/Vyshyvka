/* ОДИН ЕСКІЗ НА КІЛЬКА ТОВАРІВ — ЗРОЗУМІЛО ЦЕХУ (09.11, #2000436).

   Андрій (скрін): графіт і світло-сірий з одним ескізом — у картці цеху
   друга футболка стояла порожнім блоком, і незрозуміло, що вишивка та сама.
   Перевіряємо: у «Що шиємо» один блок «Один ескіз на 2 товари» з рядком на
   кожен товар (свій одяг), файли й кнопки карти — раз; на плитці цеху —
   «1 ескіз · 2 товари»; у виробничій карті — обидва кольори й розміри;
   товар без привʼязки — окремим блоком, як доти.

   Запуск:  node tests/one-sketch.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9033;
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
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Віра',      role:'embroidery' },
         { email:'d@loomiq',    name:'Данило',    role:'dtf' },
         { email:'r@loomiq',    name:'Роман',     role:'print' }],
  b2c: {},
  rolesSeed: 2,
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[{ sum:300, at:'2026-10-18T10:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
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
await p.evaluate(() => {
  window.confirm = () => true;
  const D = window.LQDesign, U = D.ui;
  const now = new Date().toISOString();
  const заведи = (id, units) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:'Тетяна', status:'prorahunok', site:'main',
      payments:[{ sum:300, at:now, kind:'prepay' }], hist:[], createdAt:now, crmChatId:'c' + id, items:[] };
    orders.push(o);
    const j = designJobMake(id); j.no = id; j.units = units; designJobs[id] = j;
    units.forEach(u => {
      if(u.ready) return;
      const g = D.dzNew(); D.dzList(u, 'graphic').push(g);
      D.dzAssign(g, 'p@loomiq', 'test@loomiq');
      D.dzVer(g, 'p@loomiq', [{ name:'Перед.png', url:'https://x/m.png', role:'mock' }, { name:'o.png', url:'https://x/o.png', role:'orig' },
        { name:'w.png', url:'https://x/w.png', role:'work' }], '', null, 'graphic');
      D.dzOk(g, 'test@loomiq', 'acct', 1);
      const s = D.dzNew(); D.dzList(u, 'stitch').push(s);
      D.dzAssign(s, 'e@loomiq', 'test@loomiq');
      D.dzVer(s, 'e@loomiq', [{ name:'a.dst', url:'https://x/a.dst', role:'machine' }, { name:'shot.png', url:'https://x/s.png', role:'shot' }], '', null, 'stitch');
      D.dzOk(s, 'test@loomiq', 'acct', 1);
      u.confirmed = { at: now, by: 'test@loomiq' };
    });
    return j;
  };
  const u1 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка оверсайз', color:'Графіт', size:'M', qty:1, note:'ще ескіз на графіті, імʼя HINA', artKind:'k' });
  const u2 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка оверсайз', color:'Світло-сірий', size:'M', qty:1 });
  u2.ready = { link: u1.id };
  заведи('2000436', [u1, u2]);
  const s1 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'L', qty:2, note:'x', artKind:'k' });
  заведи('2000437', [s1]);
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const цех = await p.evaluate(async () => {
  const U = window.LQDesign.ui, D = window.LQDesign;
  U.setTab('prod'); U.open(''); U.render(document.getElementById('dzRoot'));
  const col = id => { const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]'); return c ? (c.closest('.dz-col[data-col]') || {}).dataset.col : ''; };
  const плитка = id => ((document.querySelector('#dzRoot .dz-card[data-open="' + id + '"] .dz-c-onesk') || {}).textContent || '');
  const out = { кол: col('2000436'), кол2: col('2000437'), плитка: плитка('2000436'), плитка2: плитка('2000437') };
  U.open('2000436'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  const блоки = [...document.querySelectorAll('.dz-panel .dz-prod-u')];
  out.блоків = блоки.length;
  out.група = блоки[0] ? (блоки[0].dataset.oneSketch || '') : '';
  out.шапка = ((блоки[0] && блоки[0].querySelector('.dz-prod-one')) || {}).textContent || '';
  out.рядки = блоки[0] ? [...блоки[0].querySelectorAll('.dz-prod-h')].map(x => x.textContent.replace(/\s+/g, ' ')) : [];
  out.одяг = блоки[0] ? блоки[0].querySelectorAll('.dz-cloth').length : 0;
  out.карт = document.querySelectorAll('.dz-panel [data-do="prod-card"]').length;
  out.мокапів = блоки[0] ? [...блоки[0].querySelectorAll('.dz-tile .dz-tile-l')].filter(x => /мокап/.test(x.textContent)).length : 0;
  /* Виробнича карта: обидва товари. */
  const real = window.LQMock.prodCard; let specs = null;
  window.LQMock.prodCard = async d => { specs = d.specs; return 'data:image/png;base64,AA=='; };
  try{ await U.act('prod-view', document.getElementById('dzRoot'), { u: designJobs['2000436'].units[0].id, g: '0' }); await new Promise(r => setTimeout(r, 300)); }
  finally { window.LQMock.prodCard = real; }
  out.specs = specs;
  document.querySelectorAll('.dz-pop, .dz-prodview, .dz-modal').forEach(x => x.remove());
  U.open('2000437'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  out.сам = { блоків: document.querySelectorAll('.dz-panel .dz-prod-u').length, група: !!document.querySelector('.dz-panel .dz-prod-one') };
  return out;
});
console.log('   ' + JSON.stringify(цех));
ok(цех.кол && цех.кол === цех.кол2, 'обидва замовлення в цеху', JSON.stringify({ кол: цех.кол, кол2: цех.кол2 }));
ok(цех.блоків === 1 && цех.група === '2' && /Один ескіз на 2 товари/.test(цех.шапка),
  'у «Що шиємо» — один блок «Один ескіз на 2 товари», а не порожній блок другої футболки', JSON.stringify({ б: цех.блоків, ш: цех.шапка }));
ok(цех.рядки.length === 2 && /2000436-1.*Графіт.*M.*1 шт/.test(цех.рядки[0]) && /2000436-2.*Світло-сірий.*M.*1 шт/.test(цех.рядки[1]) && цех.одяг === 2,
  'у блоці — рядок на кожен товар зі своїм кольором, розміром і станом одягу', JSON.stringify(цех.рядки));
ok(цех.карт === 1 && цех.мокапів === 1, 'файли й «Виробнича карта» — раз на ескіз', JSON.stringify({ карт: цех.карт, мокап: цех.мокапів }));
ok(/1 ескіз · 2 товари/.test(цех.плитка) && !цех.плитка2, 'на плитці цеху — «1 ескіз · 2 товари»; у звичайного замовлення помітки немає', JSON.stringify({ п: цех.плитка, п2: цех.плитка2 }));
const sp = Object.fromEntries((цех.specs || []).map(r => [r[0], r[1]]));
ok(sp['Колір'] === 'Графіт, Світло-сірий' && sp['Розмір'] === 'M, M' && sp['Штук'] === '2' && /×2/.test(sp['Товар'] || ''),
  'у виробничій карті — обидва кольори, розміри й штуки', JSON.stringify(цех.specs));
ok(цех.сам.блоків === 1 && !цех.сам.група, 'товар без привʼязки — окремим блоком без помітки, як доти', JSON.stringify(цех.сам));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '✗ ' + bad + ' перевірок не пройшло' : '✓ один ескіз на кілька товарів — зрозуміло цеху');
process.exit(bad ? 1 : 0);
