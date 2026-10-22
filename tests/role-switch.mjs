/* ОДНА РОЛЬ ЗА РАЗ (22.10).

   Андрій: «краще не обʼєднувати, а перемикати». У людини з двома чи
   трьома ролями зліва перемикач «Зараз»; активна рівно одна роль, і все
   рахується лише з неї: пункти зліва, дошка у відділі, права в картці.
   «Дивитись як людина» показує її стартову роль і той самий перемикач.
   Зняли активну роль — перша з решти; додали — перемикач зʼявляється
   сам; одна роль — перемикача немає. Вибір памʼятає браузер.

   Запуск:  node tests/role-switch.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9005;
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
/* Що бачить людина з таким набором ролей (і активною roleKey, якщо задано). */
const бачу = (roles, choose) => p.evaluate(async ({ roles, choose }) => {
  seeAsSet('');
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role: roles[0], roles }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  if(choose){ roleSwitchTo(choose); await new Promise(r => setTimeout(r, 100)); }
  const U = window.LQDesign.ui;
  const dz = document.querySelector('.nav button[data-view="design"]');
  if(dz && !dz.hidden){ dz.click(); U.render(document.getElementById('dzRoot')); }
  const s = document.querySelector('#roleSwitch select');
  const acc = myAcc();
  return { role: myRole(), nav: [...document.querySelectorAll('.nav button[data-view]')].filter(x => !x.hidden).map(x => x.dataset.view).join(),
    seat: (dz && !dz.hidden) ? U.tab() : '-', boardSw: !!document.querySelector('#dzRoot [data-seat]'),
    sw: s ? { opts:[...s.options].map(o => o.value).join(), cur:s.value } : null,
    can: acc.can === '*' ? '*' : acc.can.slice().sort().join(), see: (acc.see || []).slice().sort().join(), onlyMine: !!U.host.onlyMine(),
    active: (document.querySelector('.nav button[data-view].active') || {}).dataset ? document.querySelector('.nav button[data-view].active').dataset.view : '',
    drawer: !!drawerOrderId, saved: (function(){ try{ return localStorage.getItem('lq_role_test@loomiq') || ''; }catch(e){ return ''; } })() };
}, { roles, choose });
const одне = (a, b) => ['nav', 'seat', 'can', 'see', 'onlyMine'].every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));

console.log('═══ 1. ДВІ РОЛІ: АКТИВНА ОДНА, ВСЕ З НЕЇ ═══');
const лишеЗак = await бачу(['supply']);
const лишеВир = await бачу(['production']);
const обидві = await бачу(['supply','production']);
console.log('   ' + JSON.stringify(обидві));
ok(обидві.sw && обидві.sw.opts === 'supply,production' && обидві.sw.cur === 'supply', 'зліва перемикач «Зараз» з двома ролями, активна перша', JSON.stringify(обидві.sw));
ok(одне(обидві, лишеЗак) && !обидві.boardSw, 'з активною закупівлею видно рівно те, що бачить людина з однією роллю «Закупівля»; на дошці перемикача немає', JSON.stringify({ обидві, лишеЗак }));
const наВир = await бачу(['supply','production'], 'production');
console.log('   ' + JSON.stringify(наВир));
ok(одне(наВир, лишеВир) && наВир.sw.cur === 'production' && наВир.saved === 'production',
  'перемкнув на виробництво — рівно як одна роль «Виробництво»; вибір запамʼятовано в браузері', JSON.stringify({ наВир, лишеВир }));
ok(лишеЗак.sw === null && лишеВир.sw === null, 'з однією роллю перемикача немає', JSON.stringify([лишеЗак.sw, лишеВир.sw]));

console.log('');
console.log('═══ 2. МЕНЕДЖЕР B2B + ДИЗАЙНЕР: НЕ СУМА, А ОДНЕ З ДВОХ ═══');
const лишеМен = await бачу(['manager']);
const лишеДиз = await бачу(['designer']);
const мд = await бачу(['manager','designer']);
const мдДиз = await бачу(['manager','designer'], 'designer');
console.log('   ' + JSON.stringify({ мд, мдДиз }));
ok(одне(мд, лишеМен) && мд.nav.indexOf('design') < 0, 'як менеджер: лише B2B-розділи, відділу немає', JSON.stringify({ мд, лишеМен }));
ok(одне(мдДиз, лишеДиз) && мдДиз.nav === 'design' && мдДиз.onlyMine && мдДиз.active === 'design',
  'перемкнув на дизайнера: лише «Замовлення B2C», лише свої дизайни, і людина вже там', JSON.stringify({ мдДиз, лишеДиз }));
const дм = await бачу(['designer','manager']);
ok(одне(дм, лишеДиз), 'порядок галочок більше нічого не змінює: дизайнер+менеджер = спершу дизайнер, і рівно як одна роль', JSON.stringify(дм));

console.log('');
console.log('═══ 3. ТРИ РОЛІ, ЗНЯЛИ АКТИВНУ, ДОДАЛИ НОВУ ═══');
const три = await бачу(['managerb2c','dtf','print'], 'print');
console.log('   ' + JSON.stringify(три));
ok(три.sw && три.sw.opts === 'managerb2c,dtf,print' && три.sw.cur === 'print' && три.seat === 'print', 'три ролі — три пункти; обрав «Друк» — дошка друку', JSON.stringify(три));
const зняли = await p.evaluate(async () => {
  /* Людина працювала як «Друк» (вибір у браузері), а власник зняв цю роль. */
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'managerb2c', roles:['managerb2c','dtf'] }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  const s = document.querySelector('#roleSwitch select');
  const a = { role: myRole(), sw: s ? { opts:[...s.options].map(o => o.value).join(), cur:s.value } : null };
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'dtf', roles:['dtf'] }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  const b = { role: myRole(), sw: !!document.querySelector('#roleSwitch') };
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'dtf', roles:['dtf','production'] }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  const s2 = document.querySelector('#roleSwitch select');
  const c = { role: myRole(), sw: s2 ? { opts:[...s2.options].map(o => o.value).join(), cur:s2.value } : null };
  return { a, b, c };
});
console.log('   ' + JSON.stringify(зняли));
ok(зняли.a.role === 'managerb2c' && зняли.a.sw && зняли.a.sw.opts === 'managerb2c,dtf', 'зняли активну роль — перша з тих, що лишились', JSON.stringify(зняли.a));
ok(зняли.b.role === 'dtf' && !зняли.b.sw, 'лишилась одна — перемикач зник', JSON.stringify(зняли.b));
ok(зняли.c.role === 'dtf' && зняли.c.sw && зняли.c.sw.opts === 'dtf,production', 'додали роль — перемикач зʼявився без перезаходу', JSON.stringify(зняли.c));

console.log('');
console.log('═══ 4. ВЛАСНИК «ДИВИТЬСЯ ЯК» ЛЮДИНУ З ДВОМА РОЛЯМИ ═══');
const очима = await p.evaluate(async () => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  contentData.team.push({ email:'two@loomiq', name:'Двоє', role:'supply', roles:['supply','production'] });
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  const U = window.LQDesign.ui;
  const знімок = () => { const s = document.querySelector('#roleSwitch select');
    document.querySelector('.nav button[data-view="design"]').click(); U.render(document.getElementById('dzRoot'));
    return { role: viewRole(), nav: [...document.querySelectorAll('.nav button[data-view]')].filter(x => !x.hidden).map(x => x.dataset.view).join(),
      seat: U.tab(), can: myAcc().can === '*' ? '*' : myAcc().can.slice().sort().join(), sw: s ? { opts:[...s.options].map(o => o.value).join(), cur:s.value } : null,
      boardSw: !!document.querySelector('#dzRoot [data-seat]') }; };
  const свої = знімок();
  seeAsSet('@two@loomiq'); await new Promise(r => setTimeout(r, 80));
  const як1 = знімок();
  roleSwitchTo('production'); await new Promise(r => setTimeout(r, 100));
  const як2 = знімок();
  seeAsSet(''); await new Promise(r => setTimeout(r, 60));
  const назад = знімок();
  return { свої, як1, як2, назад, sup: presetOf('supply').can.slice().sort().join(), prod: presetOf('production').can.slice().sort().join() };
});
console.log('   ' + JSON.stringify(очима));
ok(очима.свої.sw === null && очима.свої.role === 'owner' && очима.свої.boardSw, 'власник: перемикача ролей немає, на дошці свій «Дивлюсь як»', JSON.stringify(очима.свої));
ok(очима.як1.sw && очима.як1.sw.opts === 'supply,production' && очима.як1.sw.cur === 'supply' && очима.як1.seat === 'supply' && очима.як1.can === очима.sup && очима.як1.nav === 'design' && !очима.як1.boardSw,
  'очима людини: її стартова роль, той самий перемикач, права лише закупівлі, на дошці перемикача немає', JSON.stringify(очима.як1));
ok(очима.як2.sw.cur === 'production' && очима.як2.seat === 'prod' && очима.як2.can === очима.prod, 'перемкнув у режимі перегляду — дошка цеху, права виробництва', JSON.stringify(очима.як2));
ok(очима.назад.sw === null && очима.назад.role === 'owner', 'вийшов з режиму — знову свої очі, перемикача немає', JSON.stringify(очима.назад));

console.log('');
console.log('═══ 5. ПЕРЕЗАВАНТАЖИВ — ЛИШИЛАСЬ ОБРАНА РОЛЬ ═══');
const p2 = await browser.newPage({ viewport:{ width:1500, height:940 } });
p2.on('pageerror', e => errs.push(e.message.slice(0, 180)));
await p2.addInitScript(() => { try{ localStorage.setItem('lq_role_test@loomiq', 'production'); }catch(e){} });
await p2.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub.replace('"role":"owner"}', '"role":"supply","roles":["supply","production"]}') });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p2.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p2.waitForTimeout(3500);
const знову = await p2.evaluate(() => { const s = document.querySelector('#roleSwitch select');
  return { role: myRole(), cur: s ? s.value : null, seat: LQDesign.ui.tab() }; });
console.log('   ' + JSON.stringify(знову));
ok(знову.role === 'production' && знову.cur === 'production', 'після перезавантаження — та роль, яку обрав', JSON.stringify(знову));
await p2.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'одна роль за раз: перемикач зліва, все з активної ролі');
process.exit(bad ? 1 : 0);
