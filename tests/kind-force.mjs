/* ВЛАСНИК ПЕРЕМИКАЄ ВИД ДИЗАЙНУ ПОПРИ РОБОТУ (19.10).

   Андрій: «створили нове, його вже поставили в чергу відділу, а мені треба
   перенести його в готовий дизайн — така можливість тільки в мене, як
   видалення карток». Власник перемикає з підтвердженням; задача в
   дизайнера зникає; слід — у журналі. Менеджер бачить перемикач
   заблокованим, як і доти.

   Запуск:  node tests/kind-force.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8980;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' }],
  b2c: {},
  readyDesigns: [{ id:'rd1', name:'Котик', pic:'https://f/cat.png', arts:[{ name:'кіт.png', url:'https://f/cat.png' }], files:[{ name:'кіт.dst', url:'https://f/cat.dst' }] }],
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'2', orderId:'2000302', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main', crmChatId:'c2',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] }
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




const SETUP = `(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const mk = () => { const u = Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Чорний', size:'M', qty:1, note:'Сова', artKind:'k1', artKindName:'Простий' });
    const d = D.dzNew(); d.who = 'p@loomiq'; d.sentAt = '2026-10-19T09:00:00.000Z'; d.sentBy = 'test@loomiq';
    D.dzVer(d, 'p@loomiq', [{ name:'сова.png', url:'https://f/sova.png', hash:'h1', role:'work' }], '', null, 'graphic');
    u.graphic = [d]; return u; };
  window.__j = designJobMake('2000301'); __j.units = [mk()];
  window.__o = orders.find(x => x.orderId === '2000301');
  openDesign();
  U.readyPickOpen = cb => cb(U.host.readyDesign('rd1'));
  window.LQMock.openWork = () => {};
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
})()`;
await p.evaluate(SETUP);
await p.waitForTimeout(500);
/* Дії живуть у відкритій картці — відкриваємо її. */
const openCard = async () => { await p.evaluate(() => { const c = document.querySelector('#dzRoot [data-open="2000301"]'); if(c) c.click(); }); await p.waitForTimeout(400); };
await openCard();
const kindState = () => p.evaluate(() => {
  const U = window.LQDesign.ui;
  const box = document.createElement('div'); box.innerHTML = U.unitsHtml(__j, { o: __o });
  const k = box.querySelector('.dz-kind');
  return { force: !!(k && k.classList.contains('is-force')),
           ready: !!(box.querySelector('[data-do="u-ready-pick"]') || {}).disabled,
           repeat: !!(box.querySelector('[data-do="u-repeat"]') || {}).disabled };
});

console.log('═══ 1. ВЛАСНИК: ПОЗИЦІЯ В ДИЗАЙНЕРА → ГОТОВИЙ ДИЗАЙН ═══');
const s1 = await kindState();
ok(s1.force && !s1.ready && !s1.repeat, 'позиція в дизайнера, а перемикач для власника живий (з підказкою й рамкою)', JSON.stringify(s1));
const r1 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  await U.act('u-ready-pick', document.getElementById('dzRoot'), { u: __j.units[0].id });
  await new Promise(r => setTimeout(r, 500));
  const u = __j.units[0];
  const ds = (__j.ds || []).filter(x => x.step === 'kind-force').pop();
  return { ready: u.ready && u.ready.name, graphic: D.dzList(u, 'graphic').filter(d => !d.readyMade).length, ds: ds && { by: ds.by, to: ds.to, dropped: ds.dropped, from: ds.from } };
});
console.log('  ' + JSON.stringify(r1));
ok(r1.ready === 'Котик' && r1.graphic === 0, 'після підтвердження — готовий дизайн «Котик», задача дизайнера знята', JSON.stringify(r1));
ok(r1.ds && r1.ds.by === 'test@loomiq' && r1.ds.to === 'ready' && r1.ds.dropped === 1 && /p@loomiq/.test(r1.ds.from), 'у журналі замовлення: хто, у що, скільки версій пропало, у кого забрали', JSON.stringify(r1.ds));

console.log('');
console.log('═══ 2. ВЛАСНИК: ПОГОДЖЕНИЙ ГОТОВИЙ → ІНДИВІДУАЛЬНИЙ ═══');
const r2 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const u = __j.units[0];
  const g = D.readyGraphic(u, 'test@loomiq');
  D.dzVer(g, 'test@loomiq', [{ url:'m', role:'mock' }], '', null, 'acct'); D.dzOk(g, 'test@loomiq', 'client', 1);
  const before = !D.readyDetach(u);
  await U.act('u-ready-off', document.getElementById('dzRoot'), { u: u.id });
  await new Promise(r => setTimeout(r, 400));
  return { locked: before, ready: !!u.ready, graphic: D.dzList(u, 'graphic').length, n: (__j.ds || []).filter(x => x.step === 'kind-force').length };
});
console.log('  ' + JSON.stringify(r2));
ok(r2.locked && !r2.ready && r2.graphic === 0 && r2.n === 2, 'погоджений готовий дизайн власник повертає на індивідуальний — з підтвердженням і слідом', JSON.stringify(r2));

console.log('');
console.log('═══ 3. МЕНЕДЖЕР: ЯК І ДОТИ — ЗАБЛОКОВАНО ═══');
await p.evaluate(() => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'manager' }) : x);
  const D = window.LQDesign;
  const d = D.dzNew(); d.who = 'p@loomiq'; d.sentAt = '2026-10-19T10:00:00.000Z'; d.sentBy = 'test@loomiq';
  __j.units[0].graphic = [d];
  openDesign(); D.ui.setTab('acct'); D.ui.render(document.getElementById('dzRoot'));
});
await openCard();
const s3 = await kindState();
const r3 = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  await U.act('u-ready-pick', document.getElementById('dzRoot'), { u: __j.units[0].id });
  await new Promise(r => setTimeout(r, 400));
  return { ready: !!__j.units[0].ready, graphic: D.dzList(__j.units[0], 'graphic').length };
});
console.log('  ' + JSON.stringify({ s3, r3 }));
ok(!s3.force && s3.ready && s3.repeat, 'у менеджера перемикач заблокований, як і доти', JSON.stringify(s3));
ok(!r3.ready && r3.graphic === 1, 'дія в обхід кнопки нічого не міняє — «лише власник»', JSON.stringify(r3));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'власник перемикає вид дизайну попри роботу; решта — ні');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
