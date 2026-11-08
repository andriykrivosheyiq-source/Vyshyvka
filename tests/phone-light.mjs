/* ТЕЛЕФОН НЕ ПАДАЄ: КАРТИНКИ ЗМЕНШЕНІ, ФОТО МЕНШЕ, ОДНА КОЛОНКА, КАРТКА B2B (08.11).

   Відео менеджерів: Safari на iPhone «Повторення проблеми на loomiq.net»,
   вхід заново, «Оновлення…» — iOS вбивав сторінку за памʼять. Перевіряємо:
     1. <img> з Cloudinary — зменшені (плитка 320, картка 1000), посилання
        й data-url — оригінали; не-Cloudinary і вже перетворені — як є;
     2. фото з камери телефона (JPEG) — до 2400 px перед завантаженням;
        PNG і компʼютер — як є;
     3. телефон: дошка малює плитки лише видимої колонки; вкладка —
        плитки її колонки; компʼютер — усі колонки, як доти;
     4. картка B2B на телефоні прокручується вся: до низу картки можна
        доскролити, кнопки внизу на екрані; на компʼютері — як доти.
   Запуск:  node tests/phone-light.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9193;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
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

const N = 600;
const CLD = 'https://res.cloudinary.com/demo/image/upload/';
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }], b2c: {} };
const ORDERS = [];
for(let i = 0; i < N; i++){
  const no = String(2000001 + i);
  ORDERS.push({ id:'o' + i, orderId: no, type:'client', dir:'b2c', name:'Клієнт ' + i, phone:'+38067' + String(1000000 + i),
    status:'prorahunok', site:'main', payments:[], hist:[], createdAt:'2026-10-' + String(1 + (i % 28)).padStart(2, '0') + 'T09:00:00.000Z',
    crmChatId:'c' + i, crmNick:'nick_' + i, totalPrice: 1000 + i, items:[] });
}
ORDERS.push({ id:'b1', orderId:'1000341', type:'client', dir:'b2b', name:'demchenk0_igor', status:'prorahunok', site:'main', crmNick:'demchenk0_igor',
  payments:[], hist:[], createdAt:'2026-11-07T09:00:00.000Z', totalPrice: 6550, manager:'test@loomiq',
  items:[{ kind:'main', name:'Худі', color:'чорне', garmentId:'hoodie', qty:2, sizeQty:{}, prints:[{ side:'back', technique:'вишивка', widthMm:249, heightMm:251 }] }] });
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
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


const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function page(opt, phone){
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  p.on('dialog', d => d.accept(''));
  await p.addInitScript(ph => { window.LQ_PHONE = ph; }, phone ? 1 : 0);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  await p.evaluate(([N, CLD]) => {
    const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
    document.getElementById('view-design').style.display = 'block';
    const U = window.LQDesign.ui, D = window.LQDesign;
    for(let i = 0; i < N; i++){
      const j = designJobMake(String(2000001 + i));
      const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1 });
      j.units = [u];
      if(i % 2 === 0){ const gr = D.dzNew(); D.dzAttach(gr, 'test@loomiq', 'p@loomiq'); D.dzSend(gr, 'test@loomiq'); gr.status = 'work';
        D.dzVer(gr, 'p@loomiq', [{ name:'ескіз.png', url: CLD + 'v1/eskiz' + i + '.png', role:'work' }, { name:'мокап.png', url: CLD + 'v1/mock' + i + '.png', role:'mock' }], 'v1');
        D.dzList(u, 'graphic').push(gr); }
    }
    U.setTab('acct'); U.open(''); openDesign();
  }, [N, CLD]);
  await p.waitForTimeout(900);
  return p;
}

console.log('═══ 1. КАРТИНКИ: ЗМЕНШЕНІ НА ЕКРАНІ, ОРИГІНАЛ — У ПОСИЛАННЯХ ═══');
const pc = await page({ viewport:{ width:1500, height:940 } }, false);
const r1 = await pc.evaluate(async CLD => {
  const U = window.LQDesign.ui;
  const out = {};
  out.unit = [U.picLite(CLD + 'v1/a.png', 320), U.picLite(CLD + 'w_2000,h_2000,c_limit,f_jpg,q_85/v1/a.png', 320),
    U.picLite('https://res.cloudinary.com/demo/raw/upload/v1/a.dst', 320), U.picLite('/tests/fixtures/x.png', 320)];
  const root = document.getElementById('dzRoot');
  out.tiles = [...root.querySelectorAll('.dz-c-pic img')].map(i => i.getAttribute('src')).slice(0, 6);
  const card = root.querySelector('.dz-card[data-open="2000001"]'); if(card) card.click();
  await new Promise(r => setTimeout(r, 500));
  const pn = root.querySelector('.dz-panel');
  out.panelImgs = [...(pn ? pn.querySelectorAll('img') : [])].map(i => i.getAttribute('src')).filter(s => /cloudinary/.test(s));
  out.links = [...(pn ? pn.querySelectorAll('a[href*="cloudinary"], [data-url*="cloudinary"]') : [])].map(a => a.getAttribute('href') || a.getAttribute('data-url'));
  return out;
}, CLD);
console.log('   ' + JSON.stringify({ unit: r1.unit, tiles: r1.tiles.length, panel: r1.panelImgs.slice(0, 2), links: r1.links.slice(0, 2) }));
ok(r1.unit[0] === CLD + 'w_320,h_320,c_limit,f_auto,q_auto/v1/a.png' && r1.unit[1] === CLD + 'w_2000,h_2000,c_limit,f_jpg,q_85/v1/a.png' &&
   /raw\/upload\/v1\/a\.dst$/.test(r1.unit[2]) && r1.unit[3] === '/tests/fixtures/x.png',
  'адреса Cloudinary — зменшена; уже перетворена, файл (raw) і не-Cloudinary — як є', JSON.stringify(r1.unit));
const tCld = r1.tiles.filter(s => /cloudinary/.test(s)), tLoc = r1.tiles.filter(s => !/cloudinary/.test(s));
ok(r1.tiles.length > 0 && tCld.every(s => /\/upload\/w_320,h_320,c_limit,f_auto,q_auto\//.test(s)) && tLoc.every(s => !/w_\d/.test(s)),
  'мініатюри на плитках: з Cloudinary — 320 px, фото виробу з сайту — як є', JSON.stringify(r1.tiles));
const tile = await pc.evaluate(CLD => { const d = document.createElement('div'); d.innerHTML = window.LQDesign.ui.imgLite('<img src="' + CLD + 'v1/t.png" alt="">'); return d.querySelector('img').getAttribute('src'); }, CLD);
ok(tile === CLD + 'w_1000,h_1000,c_limit,f_auto,q_auto/v1/t.png', 'будь-яка картинка Cloudinary в розмітці відділу — 1000 px', tile);
ok(r1.panelImgs.length > 0 && r1.panelImgs.every(s => /\/upload\/w_\d+,h_\d+,c_limit,f_auto,q_auto\//.test(s)), 'картинки в картці — зменшені (' + r1.panelImgs.length + ')', JSON.stringify(r1.panelImgs));
ok(r1.links.length > 0 && r1.links.every(s => /\/upload\/v1\//.test(s)), 'посилання «відкрити/скачати» — оригінали', JSON.stringify(r1.links));
const off = await pc.evaluate(async CLD => { contentData.imgLite = 0; const s = window.LQDesign.ui.picLite(CLD + 'v1/a.png', 320); delete contentData.imgLite; return s; }, CLD);
ok(off === CLD + 'v1/a.png', 'вимикач imgLite = 0 — оригінали, як доти', off);

console.log('═══ 2. ФОТО З КАМЕРИ ТЕЛЕФОНА — МЕНШЕ ПЕРЕД ЗАВАНТАЖЕННЯМ ═══');
const shrink = async (p, phone) => p.evaluate(async phone => {
  window.LQ_PHONE = phone;
  const big = async (type, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const id = x.createImageData(w, h); for(let i = 0; i < id.data.length; i += 4){ id.data[i] = (i * 7) & 255; id.data[i + 1] = (i * 13) & 255; id.data[i + 2] = (i * 31) & 255; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0); return await new Promise(r => c.toBlob(b => r(new File([b], 'IMG_0001.' + (type === 'image/png' ? 'png' : 'jpg'), { type })), type, 0.95)); };
  const dims = async f => { const u = URL.createObjectURL(f), im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = u; }); return [im.naturalWidth, im.naturalHeight]; };
  const sent = [];
  const real = window.fetch;
  window.fetch = async (u, o) => { if(/api\.cloudinary\.com/.test(String(u))){ const f = o.body.get('file'); sent.push({ type: f.type, size: f.size, dims: await dims(f), name: f.name }); return new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg' })); } return real(u, o); };
  const j = await big('image/jpeg', 4000, 3000), pn = await big('image/png', 3000, 3000);
  await uploadCloudinaryAuto(j); await uploadCloudinaryAuto(pn);
  window.fetch = real;
  return { jSize: j.size, pnSize: pn.size, sent };
}, phone ? 1 : 0);
const r2 = await shrink(pc, true);
console.log('   ' + JSON.stringify(r2));
ok(r2.jSize > 600000 && r2.sent[0].type === 'image/jpeg' && Math.max(...r2.sent[0].dims) === 2400 && r2.sent[0].size < r2.jSize && /\.jpg$/.test(r2.sent[0].name),
  'телефон: фото JPEG 4000×3000 пішло 2400 px', JSON.stringify(r2.sent[0]));
ok(r2.sent[1].type === 'image/png' && r2.sent[1].size === r2.pnSize && Math.max(...r2.sent[1].dims) === 3000, 'телефон: PNG (робочий файл) — як є', JSON.stringify(r2.sent[1]));
const r2b = await shrink(pc, false);
ok(r2b.sent[0].size === r2b.jSize && Math.max(...r2b.sent[0].dims) === 4000, 'компʼютер: фото — як є', JSON.stringify(r2b.sent[0]));
await pc.evaluate(() => { window.LQ_PHONE = 0; });

console.log('═══ 3. ТЕЛЕФОН: ПЛИТКИ ЛИШЕ ВИДИМОЇ КОЛОНКИ ═══');
const deskCards = await pc.evaluate(() => { LQDesign.ui.open(''); LQDesign.ui.render(document.getElementById('dzRoot')); return { cards: document.querySelectorAll('#dzRoot .dz-card').length, nodes: document.querySelectorAll('#dzRoot *').length }; });
const pp = await page({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true }, true);
const r3 = await pp.evaluate(async () => {
  const root = document.getElementById('dzRoot');
  const cols = () => [...root.querySelectorAll('.dz-board > .dz-col')].map(c => ({ k: c.dataset.col, n: c.querySelectorAll('.dz-card').length, cur: c.classList.contains('is-mcur'), has: c.classList.contains('has-cards') }));
  const a = cols(), nodes = root.querySelectorAll('*').length;
  const tabs = [...root.querySelectorAll('.dz-ctab')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
  const other = a.find(c => !c.cur && c.has);
  let b = null;
  if(other){ root.querySelector('.dz-ctab[data-ctab="' + other.k + '"]').click(); await new Promise(r => setTimeout(r, 300)); b = cols(); }
  return { a, b, nodes, tabs, other: other && other.k };
});
const cur = r3.a.find(c => c.cur), others = r3.a.filter(c => !c.cur);
console.log('   ' + JSON.stringify({ desk: deskCards, phoneNodes: r3.nodes, cur, others: others.map(c => c.k + ':' + c.n + (c.has ? '+' : '')), tabs: r3.tabs.slice(0, 4) }));
ok(deskCards.cards === 600, 'компʼютер: усі 600 плиток, як доти', JSON.stringify(deskCards));
ok(cur && cur.n > 0 && others.every(c => c.n === 0) && others.some(c => c.has), 'телефон: плитки лише у видимій колонці; інші колонки знають, що мають картки', JSON.stringify(r3.a));
ok(r3.nodes < deskCards.nodes / 2, 'телефон: елементів дошки щонайменше вдвічі менше (' + r3.nodes + ' проти ' + deskCards.nodes + ')', r3.nodes + ' / ' + deskCards.nodes);
const curB = r3.b && r3.b.find(c => c.cur);
ok(curB && curB.k === r3.other && curB.n > 0 && r3.b.filter(c => !c.cur).every(c => c.n === 0), 'перемкнули вкладку — плитки тієї колонки', JSON.stringify(r3.b));

console.log('═══ 4. КАРТКА B2B НА ТЕЛЕФОНІ ПРОКРУЧУЄТЬСЯ ВСЯ ═══');
const drawer = async p => p.evaluate(async () => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = '');
  const o = orders.find(x => x.orderId === '1000341'); openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 600));
  const pn = document.querySelector('#orderDrawer .od-panel'), body = pn.querySelector('.od-body'), foot = pn.querySelector('.od-foot');
  const last = body.lastElementChild;
  pn.scrollTop = pn.scrollHeight; await new Promise(r => setTimeout(r, 150));
  const lr = last.getBoundingClientRect(), fr = foot.getBoundingClientRect();
  return { panelScroll: pn.scrollHeight > pn.clientHeight, panelOv: getComputedStyle(pn).overflowY, bodyOv: getComputedStyle(body).overflowY,
    bodyH: Math.round(body.getBoundingClientRect().height), lastBottom: Math.round(lr.bottom), footTop: Math.round(fr.top), footBottom: Math.round(fr.bottom), vh: innerHeight };
});
const pb = await page({ viewport:{ width:390, height:664 }, isMobile:true, hasTouch:true }, true);
const r4 = await drawer(pb);
console.log('   ' + JSON.stringify(r4));
ok(r4.panelOv === 'auto' && r4.bodyOv === 'visible' && r4.panelScroll && r4.bodyH > 300,
  'телефон: прокручується вся картка, товари/розміри/ТЗ на повну висоту (' + r4.bodyH + ' px, доти 69)', JSON.stringify(r4));
ok(r4.lastBottom <= r4.footTop + 2 && r4.footBottom <= r4.vh + 1, 'доскролили до низу — останнє поле над кнопками, кнопки на екрані', JSON.stringify(r4));
const r4d = await drawer(pc);
ok(r4d.panelOv !== 'auto' && r4d.bodyOv === 'auto', 'компʼютер: шапка стоїть, прокручується середина — як доти', JSON.stringify(r4d));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ телефон: картинки зменшені, фото менше, одна колонка, картка B2B прокручується');
process.exit(bad ? 1 : 0);
