/* КІЛЬКА ВЕРСІЙ ДИЗАЙНУ — ОДНИМ НАДСИЛАННЯМ (04.11, #2000337).

   Андрій: «декілька версій на вибір… обирати відразу декілька версій
   дизайну та відправляти їх разом».
   1. «Надіслати» при кількох версіях — вікно з галочками, «Надіслати обрані (N)».
   2. Одне підтвердження з усіма аркушами; клієнту — кожен аркуш окремою
      картинкою, текст (скрипт, {версія} → «v1, v3») — один раз; обрані — «Надіслано».
   3. Одна позначена — звичне надсилання.
   4. «Погоджено» — як доти, одна версія.
   5. «↩ Скасувати узгодження» (#2000172) — до фіксації, з історією.

   Запуск:  node tests/multi-send.mjs      (з кореня репозиторію)  */
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'managerb2c' },
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
const підготуй = () => p.evaluate(() => {
  window.confirm = () => true;
  const D = window.LQDesign, U = D.ui;
  const id = '2000921';
  let o = orders.find(x => x.orderId === id);
  if(!o){
    o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:'Ліна', status:'prorahunok', site:'main',
      payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[] };
    orders.push(o);
  }
  const j = designJobMake(id); j.no = id;
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
  j.units = [u];
  const d = D.dzNew(); D.dzAttach(d, 'p@loomiq', 'test@loomiq'); D.dzSend(d, 'test@loomiq'); D.dzTake(d, 'p@loomiq');
  [1, 2, 3].forEach(n => D.dzVer(d, 'p@loomiq', [{ name:'робота' + n + '.png', url:'https://x/w' + n + '.png', role:'work' },
    { name:'аркуш' + n + '.png', url:'https://x/sheet' + n + '.png', role:'sheet' }], 'варіант ' + n));
  D.dzList(u, 'graphic').push(d);
  designJobs[id] = j;
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
  /* Після входу в розділ — host уже свій; підмінюємо надсилання й скрипт. */
  window.__пішло = [];
  window.LQDesign.ui.host.tellPic = async (o2, url, txt) => { window.__пішло.push({ url, txt }); return true; };
  window.LQDesign.ui.host.script = (o2, key, vars) => 'Надсилаємо макет на погодження (v' + (vars && vars.v) + ').';
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await підготуй();
await ЖДИ(300);
const відкрий = () => p.evaluate(async () => {
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000921"]'); if(!c) return 'немає картки';
  c.click(); await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('.dz-panel [data-do="dz-tell-pick"]'); if(!b) return 'немає «Надіслати»';
  b.click(); await new Promise(r => setTimeout(r, 300));
  return document.querySelector('.dz-pick.is-multi') ? 'ok' : 'вікно не на кілька';
});

console.log('═══ 1. ВІКНО «ЯКІ ВЕРСІЇ НАДІСЛАТИ» — ПОЗНАЧИТИ КІЛЬКА ═══');
const в = await відкрий();
const в1 = await p.evaluate(() => {
  const w = document.querySelector('.dz-pick.is-multi');
  const go = w.querySelector('[data-pick-go]');
  const до = { disabled: go.disabled, txt: go.textContent };
  const cs = [...w.querySelectorAll('[data-pick]')];
  cs.filter(c => /v1|v3/.test(c.textContent)).forEach(c => c.click());
  return { до, карток: cs.length, on: [...w.querySelectorAll('[data-pick].is-on')].map(c => c.dataset.pick).join(), go: go.textContent, dis: go.disabled, відкрите: !!document.querySelector('.dz-pick.is-multi') };
});
console.log('   ' + JSON.stringify({ в, в1 }));
ok(в === 'ok' && в1.карток === 3 && в1.до.disabled, 'три версії, кнопка «Надіслати обрані» спершу неактивна', JSON.stringify({ в, в1 }));
ok(в1.on === '3,1' && в1.go === 'Надіслати обрані (2)' && !в1.dis && в1.відкрите, 'позначили v1 і v3 — вікно не закрилось, «Надіслати обрані (2)»', JSON.stringify(в1));

console.log('');
console.log('═══ 2. ОДНЕ ПІДТВЕРДЖЕННЯ З ДВОМА АРКУШАМИ, ДАЛІ ДВІ КАРТИНКИ ═══');
const п = await p.evaluate(async () => {
  document.querySelector('.dz-pick [data-pick-go]').click();
  await new Promise(r => setTimeout(r, 400));
  const cf = document.querySelector('.dz-cf');
  const r = { є: !!cf, img: cf ? [...cf.querySelectorAll('img.dz-cf-i')].map(i => i.getAttribute('src')) : [], h: cf ? cf.querySelector('.dz-cf-h').textContent : '',
    txt: cf && cf.querySelector('textarea') ? cf.querySelector('textarea').value : '' };
  if(cf) cf.querySelector('[data-cf="yes"]').click();
  await new Promise(r2 => setTimeout(r2, 900));
  const d = window.LQDesign.dzList(designJobs['2000921'].units[0], 'graphic')[0];
  r.пішло = window.__пішло; r.sent = d.vers.map(v => !!v.sentToClient);
  return r;
});
console.log('   ' + JSON.stringify(п));
ok(п.є && п.img.join() === 'https://x/sheet1.png,https://x/sheet3.png' && /версії v1, v3/.test(п.h), 'підтвердження: обидва аркуші, у шапці «версії v1, v3»', JSON.stringify(п));
ok(/\(v1, v3\)/.test(п.txt), 'текст скрипта з номерами «(v1, v3)»', п.txt);
ok(п.пішло.length === 2 && п.пішло[0].url === 'https://x/sheet1.png' && п.пішло[1].url === 'https://x/sheet3.png' && /v1, v3/.test(п.пішло[0].txt) && !п.пішло[1].txt,
  'клієнту — дві картинки, текст один раз, з першою', JSON.stringify(п.пішло));
ok(п.sent.join() === 'true,false,true', 'v1 і v3 позначені «Надіслано», v2 — ні', п.sent.join());
const хіст = await p.evaluate(() => window.LQDesign.ui.histHtml(designJobs['2000921'], orders.find(x => x.orderId === '2000921')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
ok((хіст.match(/надіслано клієнту/gi) || []).length >= 2, 'в історії — обидва надсилання', хіст.slice(0, 300));

console.log('');
console.log('═══ 3. ОДНА ПОЗНАЧЕНА — ЯК ДОТИ ═══');
await підготуй();
await ЖДИ(300);
await відкрий();
const о = await p.evaluate(async () => {
  const w = document.querySelector('.dz-pick.is-multi');
  [...w.querySelectorAll('[data-pick]')].filter(c => /v2/.test(c.textContent))[0].click();
  w.querySelector('[data-pick-go]').click();
  await new Promise(r => setTimeout(r, 400));
  const cf = document.querySelector('.dz-cf');
  const h = cf ? cf.querySelector('.dz-cf-h').textContent : '';
  if(cf) cf.querySelector('[data-cf="yes"]').click();
  await new Promise(r => setTimeout(r, 900));
  const d = window.LQDesign.dzList(designJobs['2000921'].units[0], 'graphic')[0];
  return { h, пішло: window.__пішло.map(x => x.url), sent: d.vers.map(v => !!v.sentToClient) };
});
console.log('   ' + JSON.stringify(о));
ok(/версія 2/.test(о.h) && о.пішло.join() === 'https://x/sheet2.png' && о.sent.join() === 'false,true,false', 'одна версія — звичне надсилання «версія 2»', JSON.stringify(о));

console.log('');
console.log('═══ 4. ПОГОДЖЕННЯ — ЯК ДОТИ, ОДНА ВЕРСІЯ ═══');
const пг = await p.evaluate(async () => {
  const b = [...document.querySelectorAll('.dz-panel .dz-b')].filter(x => /Погоджено/.test(x.textContent))[0];
  if(!b) return 'немає «Погоджено»';
  b.click(); await new Promise(r => setTimeout(r, 300));
  const w = document.querySelector('.dz-pick'); const r = w ? (w.classList.contains('is-multi') ? 'multi' : 'одна') : 'немає вікна';
  if(w) w.querySelector('[data-pick-x]').click();
  return r;
});
ok(пг === 'одна', '«Погоджено» питає одну версію, без галочок', пг);

console.log('');
console.log('═══ 5. «↩ СКАСУВАТИ УЗГОДЖЕННЯ» (#2000172) ═══');
const ск = await p.evaluate(async () => {
  const D = window.LQDesign;
  const d = D.dzList(designJobs['2000921'].units[0], 'graphic')[0];
  const кн = t => [...document.querySelectorAll('.dz-panel .dz-b')].filter(x => t.test(x.textContent))[0];
  кн(/Погоджено/).click(); await new Promise(r => setTimeout(r, 300));
  const w = document.querySelector('.dz-pick'); [...w.querySelectorAll('[data-pick]')].filter(c => /v2/.test(c.textContent))[0].click();
  await new Promise(r => setTimeout(r, 500));
  const після = { ok: d.sketchOk, фікс: !!кн(/Фіксація/), undo: !!document.querySelector('.dz-panel [data-do="dz-sketch-undo"]') };
  document.querySelector('.dz-panel [data-do="dz-sketch-undo"]').click();
  await new Promise(r => setTimeout(r, 500));
  const хіст = window.LQDesign.ui.histHtml(designJobs['2000921'], orders.find(x => x.orderId === '2000921')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { після, тепер: { ok: d.sketchOk || null, погод: !!кн(/Погоджено/), фікс: !!кн(/Фіксація/), undo: !!document.querySelector('.dz-panel [data-do="dz-sketch-undo"]'), слід: (d.sketchUndo || []).length },
    хіст: /узгодження ескізу скасовано/.test(хіст) };
});
console.log('   ' + JSON.stringify(ск));
ok(ск.після.ok === 2 && ск.після.фікс && ск.після.undo, '«Погоджено» v2 → «Ескіз узгоджено», поруч із «Фіксація» — «↩ Скасувати узгодження»', JSON.stringify(ск.після));
ok(!ск.тепер.ok && ск.тепер.погод && !ск.тепер.фікс && !ск.тепер.undo && ск.тепер.слід === 1 && ск.хіст,
  'скасовано: знову «✓ Погоджено», в історії «узгодження ескізу скасовано»', JSON.stringify(ск));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'кілька версій — одним надсиланням');
process.exit(bad ? 1 : 0);
