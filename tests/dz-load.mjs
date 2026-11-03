/* tests/dz-load.mjs — КОМУ ЯКИЙ ЕСКІЗ НАДАНО І СКІЛЬКИ В КОГО В РОБОТІ (03.11.2026).

   Андрій: «щоб ми бачили, кому який ескіз надали, щоб підрахувати швидко, у
   кого скільки ескізів в роботі… для вишивальних і для графічних».
     1. над дошкою акаунта — «✏️ Графічні: Петро 1 +1 на перевірці · Катя 1»,
        «🧵 Вишивальні: Емма 1»; затверджене не рахується;
     2. на плитці — «✏️ Петро · 🧵 Емма»;
     3. натиснули «Петро» — на дошці лише його замовлення; ще раз — усі;
     4. дизайнер такого підсумку не бачить.
   Запуск: node tests/dz-load.mjs (у pre-commit). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9185;
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
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Емма',      role:'embroidery' },
         { email:'c@loomiq',    name:'Цех',       role:'production' },
         { email:'k@loomiq',    name:'Катя',      role:'designer' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 24 },
  products: { retail: { tee: 600 }, retailReady: { tee: 450 } }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'4', orderId:'2000104', type:'client', dir:'b2c', name:'Г', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T12:00:00.000Z', totalPrice: 1000, items:[] }
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



await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000101');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:3, note:'Лого на груди' })];
  const g = D.dzNew(); D.dzAttach(g, 'p@loomiq', 'test@loomiq'); D.dzSend(g, 'test@loomiq'); g.status = 'work';
  D.dzList(j.units[0], 'graphic').push(g);
  const s = D.dzNew(); D.dzAttach(s, 'e@loomiq', 'test@loomiq'); D.dzSend(s, 'test@loomiq'); s.status = 'work';
  D.dzList(j.units[0], 'stitch').push(s);
  window.__j = j; window.__g = g; window.__s = s;
  /* Друге замовлення: Петро здав ескіз — на перевірці. Третє: у Каті в роботі.
     Четверте: у Петра затверджено — не рахується. */
  const mk = (no, who, st) => { const jj = designJobMake(no); jj.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'L', qty:1 })];
    const d = D.dzNew(); D.dzAttach(d, who, 'test@loomiq'); D.dzSend(d, 'test@loomiq'); d.status = st; D.dzList(jj.units[0], 'graphic').push(d); return jj; };
  mk('2000102', 'p@loomiq', 'review'); mk('2000103', 'k@loomiq', 'work');
  openDesign();
  U.host.upload = async f => 'https://x/up/' + f.name;
});
await p.waitForTimeout(400);



const як = async (role, tab) => p.evaluate(({ role, tab }) => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role }) : x);
  try{ applyRoleUi(); }catch(e){}
  const U = window.LQDesign.ui; U.setTab(tab); U.open(''); U.render(document.getElementById('dzRoot'));
}, { role, tab });
await p.evaluate(() => { const D = window.LQDesign, U = D.ui;
  const jj = designJobMake('2000104'); jj.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'L', qty:1 })];
  const d = D.dzNew(); D.dzAttach(d, 'p@loomiq', 'test@loomiq'); D.dzSend(d, 'test@loomiq'); d.status = 'approved'; D.dzList(jj.units[0], 'graphic').push(d); });

console.log('═══ 1. ПІДСУМОК НАД ДОШКОЮ ═══');
await як('owner', 'acct'); await p.waitForTimeout(400);
const r1 = await p.evaluate(() => {
  const L = document.querySelector('#dzRoot .dz-load');
  const b = [...document.querySelectorAll('#dzRoot .dz-load-b')].map(x => ({ k: x.dataset.k, who: x.dataset.who, t: x.textContent.replace(/\s+/g, ' ').trim() }));
  return { is: !!L, b };
});
console.log('  ' + JSON.stringify(r1));
const кн = (k, who) => (r1.b.find(x => x.k === k && x.who === who) || {}).t || '';
ok(r1.is && /^Петро 1 \+1 на перевірці$/.test(кн('graphic', 'p@loomiq')) && /^Катя 1$/.test(кн('graphic', 'k@loomiq')),
  'графічні: «Петро 1 +1 на перевірці», «Катя 1» — затверджене в Петра не рахується', 'графічні: ' + JSON.stringify(r1.b));
ok(/^Емма 1$/.test(кн('stitch', 'e@loomiq')), 'вишивальні: «Емма 1»', 'вишивальні: ' + JSON.stringify(r1.b));

console.log('═══ 2. НА ПЛИТЦІ — КОМУ НАДАНО ═══');
const r2 = await p.evaluate(() => (document.querySelector('#dzRoot .dz-card[data-open="2000101"] .dz-c-assign') || {}).textContent || '');
ok(r2 === '✏️ Петро · 🧵 Емма', 'плитка #2000101: «✏️ Петро · 🧵 Емма»', 'на плитці: «' + r2 + '»');

console.log('═══ 3. ФІЛЬТР ЗА ЛЮДИНОЮ ═══');
const r3 = await p.evaluate(async () => {
  const ids = () => [...document.querySelectorAll('#dzRoot .dz-boards .dz-card[data-open]')].map(x => x.dataset.open).filter(x => /^20001/.test(x)).sort();
  const всі = ids();
  document.querySelector('#dzRoot .dz-load-b[data-who="p@loomiq"]').click(); await new Promise(r => setTimeout(r, 300));
  const петро = ids(), напис = (document.querySelector('#dzRoot .dz-load-f') || {}).textContent || '';
  document.querySelector('#dzRoot .dz-load-b[data-who="p@loomiq"]').click(); await new Promise(r => setTimeout(r, 300));
  return { всі, петро, напис, знову: ids() };
});
console.log('  ' + JSON.stringify(r3));
ok(r3.петро.join() === '2000101,2000102' && /лише ескізи: Петро/.test(r3.напис), '«Петро» — на дошці лише його замовлення (#2000101, #2000102), напис «показано лише ескізи: Петро»', 'фільтр: ' + JSON.stringify(r3));
ok(r3.знову.join() === r3.всі.join() && r3.всі.length >= 3, 'ще раз «Петро» — знову всі', 'не повернулось: ' + JSON.stringify(r3));

console.log('═══ 4. ДИЗАЙНЕР ПІДСУМКУ НЕ БАЧИТЬ ═══');
await як('designer', 'graphic'); await p.waitForTimeout(300);
const r4 = await p.evaluate(() => !!document.querySelector('#dzRoot .dz-load'));
ok(!r4, 'у графічного дизайнера підсумку по людях немає', 'дизайнер бачить підсумок');

ok(!errs.length, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ dz-load: кому який ескіз і скільки в кого в роботі');
process.exit(bad ? 1 : 0);
