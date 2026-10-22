/* РОЛІ ВИРОБНИЦТВА — ЛИШЕ B2C (22.10).

   Андрій: «прибрати задачі й дашборди, доступ тільки до B2C. Виробництво,
   оператори, контроль — цех; закупівля — лише дошка закупівлі; друк — своя
   дошка; DTF-дизайнер — дошка DTF. Листування — лише читати, і лише цеху;
   закупівлі, друку й DTF про клієнта нічого».

   Запуск:  node tests/prod-roles.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8953;
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
  rolesSeed: 1,
  roles: [{ key:'owner', name:'Власник', ui:'manager', nav:'*', boards:'*', see:['client','chat','cost'], can:'*' },
          { key:'designer', name:'Дизайнер', ui:'designer', nav:['design'], boards:['design'], see:[], can:['art','stage'] },
          { key:'embroidery', name:'Вишивальний дизайнер', ui:'designer', nav:['design'], boards:['embro'], see:[], can:['stitch'] },
          { key:'designmgr', name:'Акаунт-менеджер', ui:'manager', nav:['design','chatsc','board','chats'], boards:'*', see:['client','chat'], can:['new','edit','stage','assign','pay','write','files','quick','bind','art','approve','pack'] },
          { key:'managerb2c', name:'Менеджер B2C', ui:'manager', nav:['design','chatsc'], boards:['acct'], see:['client','chat'], can:['new','edit','stage','assign','pay','write','files','quick','bind','art','approve','pack'] },
          { key:'production', name:'Виробництво', ui:'production', nav:['today','dash','board'], navAll:['today','dash','board'],
            boards:['prod'], see:['chat','client'], can:['stage','files'] },
          { key:'supply', name:'Закупівля', ui:'production', nav:['today','dash','board'], navAll:['today','dash','board'],
            boards:['supply'], see:['chat'], can:['stage','export'] }],
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

console.log('═══ 1. РАЗОВЕ ДОВЕДЕННЯ ЗБЕРЕЖЕНИХ РОЛЕЙ ═══');
const m = await p.evaluate(async () => {
  contentData.rolesSeed = 1;
  await rolesSeedOnce();
  const r = k => (contentData.roles || []).find(x => x.key === k) || {};
  return { seed: contentData.rolesSeed, prod: r('production'), sup: r('supply'),
           keys: (contentData.roles || []).map(x => x.key) };
});
console.log('   ' + JSON.stringify({ seed: m.seed, prod: { nav: m.prod.nav, see: m.prod.see, can: m.prod.can }, sup: { nav: m.sup.nav, see: m.sup.see } }));
ok(m.seed === 2 && m.prod.nav.join() === 'design' && m.prod.see.join() === 'chat' && m.prod.can.join() === 'stage,files',
  'Виробництво: розділ лише «Замовлення B2C», бачить лише листування; галочки «може», поставлені руками, не зачеплено', JSON.stringify(m.prod));
ok(m.sup.nav.join() === 'design' && !m.sup.see.length, 'Закупівля: лише «Замовлення B2C», про клієнта нічого (листування теж)', JSON.stringify(m.sup));
const всі = await p.evaluate(() => roleDefs().filter(r => ['operator','qcprod','print','dtf'].indexOf(r.key) >= 0).map(r => r.key + ':' + [].concat(r.nav).join('|')));
ok(всі.length === 4 && всі.every(x => /:design$/.test(x)), 'відсутні вбудовані (оператори, контроль, друк, DTF) підставляються з пресету — уже лише з «Замовлення B2C»', JSON.stringify(всі));
ok(m.keys.indexOf('operator') < 0, 'прибрані чи незаведені ролі в збережений список не дописуємо', JSON.stringify(m.keys));
/* Без canAll система сама дописала б права з нових розділу й «бачить»:
   погоджувати, пакувати, писати клієнту. Доведення їх фіксує як є. */
const пр = await p.evaluate(() => { const r = (contentData.roles || []).find(x => x.key === 'production');
  const f = roleFill(JSON.parse(JSON.stringify(r))); return f.can; });
ok(пр.join() === 'stage,files', 'після доведення права Виробництва ті самі: жодних «погоджувати / пакувати / писати клієнту» з нового розділу', JSON.stringify(пр));

console.log('');
console.log('═══ 2. КОЖНА РОЛЬ: РОЗДІЛ ЗЛІВА, СВОЯ ДОШКА, ЩО БАЧИТЬ ═══');
const ЧЕКАЮ = {
  production: { seat:'prod',   chat:true  },
  operator:   { seat:'prod',   chat:true,  cols:['Передрук','Нове','Очікуємо одяг','Готово до роботи','На станках'] },
  qcprod:     { seat:'prod',   chat:true,  cols:['На станках','Чекає погодження','Можна відправляти'] },
  supply:     { seat:'supply', chat:false },
  print:      { seat:'print',  chat:false },
  dtf:        { seat:'dtf',    chat:false }
};
for(const [role, w] of Object.entries(ЧЕКАЮ)){
  const r = await p.evaluate(async role => {
    contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role }) : x);
    applyRoleUi();
    await new Promise(r => setTimeout(r, 50));
    const nav = [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden && b.offsetParent !== null).map(b => b.dataset.view);
    const b = document.querySelector('.nav button[data-view="design"]'); if(b) b.click();
    const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot'));
    const cols = [...document.querySelectorAll('#dzRoot .dz-col-h, #dzRoot .dz-colh, #dzRoot .dz-col > h3, #dzRoot .dz-col-t')]
      .map(x => x.textContent.replace(/\d+$/, '').trim()).filter(Boolean);
    return { nav, seat: U.tab(), chat: canSeeChat(), client: canSeeClient(), cost: canSeeCost(),
             write: may('can', 'write'), pay: canPay(), as: !!document.querySelector('#dzRoot [data-seat]'), cols };
  }, role);
  const navOk = r.nav.length === 1 && r.nav[0] === 'design';
  ok(navOk, role + ': зліва лише «Замовлення B2C»', role + ' розділи: ' + JSON.stringify(r.nav));
  ok(r.seat === w.seat && !r.as, role + ': одразу на своїй дошці («' + w.seat + '»), перемикача чужих дошок немає', role + ': ' + JSON.stringify({ seat: r.seat, as: r.as }));
  ok(r.chat === w.chat && !r.client && !r.cost && !r.write,
    role + ': ' + (w.chat ? 'листування лише читати' : 'про клієнта нічого') + ', без контактів, собівартості й «писати клієнту»',
    role + ': ' + JSON.stringify(r));
  if(w.cols) ok(w.cols.every(c => r.cols.some(x => x.indexOf(c) === 0)) && r.cols.length <= w.cols.length + 1,
    role + ': колонки — ' + w.cols.join(', '), role + ' колонки: ' + JSON.stringify(r.cols));
}

console.log('');
console.log('═══ 3. ВЛАСНИК «ДИВИТЬСЯ ЯК» РОЛЬ — ЗЛІВА, СПРАВА, СКРІЗЬ ═══');
const наРоль = async role => p.evaluate(async role => {
  seeAsSet(role);
  await new Promise(r => setTimeout(r, 80));
  const nav = [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden && b.offsetParent !== null).map(b => b.dataset.view);
  const b = document.querySelector('.nav button[data-view="design"]'); if(b) b.click();
  const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot'));
  const cols = [...document.querySelectorAll('#dzRoot .dz-col-h, #dzRoot .dz-colh, #dzRoot .dz-col > h3, #dzRoot .dz-col-t')]
    .map(x => x.textContent.replace(/\d+$/, '').trim()).filter(Boolean);
  return { nav, seat: U.tab(), as: !!document.querySelector('#dzRoot [data-seat]'), chat: canSeeChat(), cols,
           bar: !!document.getElementById('seeAsBar') };
}, role);
await p.evaluate(() => { contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x); applyRoleUi(); });
const вОп = await наРоль('operator');
console.log('   ' + JSON.stringify(вОп));
ok(вОп.bar && вОп.nav.join() === 'design' && вОп.seat === 'prod' && !вОп.as &&
   ['Передрук','На станках'].every(c => вОп.cols.some(x => x.indexOf(c) === 0)) && !вОп.cols.some(x => /погодження/i.test(x)),
  'очима Операторів: зліва лише «Замовлення B2C», їхня дошка цеху з їхніми колонками, без перемикача', JSON.stringify(вОп));
const вЗак = await наРоль('supply');
ok(вЗак.nav.join() === 'design' && вЗак.seat === 'supply' && !вЗак.as && !вЗак.chat, 'очима Закупівлі: лише закупівля, листування не видно', JSON.stringify(вЗак));
const вДр = await наРоль('print');
ok(вДр.seat === 'print' && !вДр.as && вДр.cols.some(x => /Друкується/.test(x)), 'очима Друку: дошка «Друк»', JSON.stringify(вДр));
const назад = await наРоль('');
ok(!назад.bar && назад.as && назад.nav.length > 1, 'вийшов з перегляду — свої розділи й перемикач «Дивлюсь як» на місці', JSON.stringify({ bar: назад.bar, as: назад.as, nav: назад.nav.length }));

console.log('');
console.log('═══ 4. МЕНЕДЖЕРИ БЕЗ ПЕРЕМИКАЧА; ДИЗАЙНЕР — ЛИШЕ СВОЄ Й ЧЕРГА ═══');
const мен = await p.evaluate(async () => {
  seeAsSet('');
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'designmgr' }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  document.querySelector('.nav button[data-view="design"]').click();
  const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot'));
  const нове = () => !!document.querySelector('#dzRoot [data-do="order-new"]');
  const a = { seat: U.tab(), as: !!document.querySelector('#dzRoot [data-seat]'), new: нове() };
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'managerb2c' }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  U.render(document.getElementById('dzRoot'));
  const b = { seat: U.tab(), as: !!document.querySelector('#dzRoot [data-seat]'), new: нове() };
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  U.render(document.getElementById('dzRoot'));
  const c = { as: !!document.querySelector('#dzRoot [data-seat]'), new: нове() };
  return { a, b, c };
});
ok(мен.a.seat === 'acct' && !мен.a.as && мен.b.seat === 'acct' && !мен.b.as && мен.c.as,
  'акаунт-менеджер і менеджер B2C — дошка акаунта без перемикача; перемикач лише у власника', JSON.stringify(мен));
ok(мен.a.new && мен.b.new && мен.c.new, '«+ Нове замовлення» є в акаунт-менеджера, менеджера B2C і власника (22.10: зникало разом із перемикачем)', JSON.stringify(мен));
/* Три замовлення: графіка в p@ (Петро), у d@ (інший дизайнер), і в черзі відділу. */
const дз = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const заведи = (id, who, queue) => {
    if(!orders.find(o => o.orderId === id)) orders.push({ id:'g' + id, orderId:id, type:'client', dir:'b2c', name:'Г' + id, status:'prorahunok', site:'main',
      payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[] });
    const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u];
    const g = D.dzNew(); D.dzList(u, 'graphic').push(g);
    if(queue) D.dzQueue(g, 'test@loomiq'); else { g.who = who; g.sentAt = new Date().toISOString(); g.status = 'work'; }
  };
  заведи('2000501', 'p@loomiq', false); заведи('2000502', 'd@loomiq', false); заведи('2000503', '', true);
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  const бачить = () => [...document.querySelectorAll('#dzRoot .dz-card')].map(c => c.dataset.open).filter(x => /^20005/.test(x)).sort().join();
  /* Власник очима Петра (людина, не роль). */
  seeAsSet('@p@loomiq'); await new Promise(r => setTimeout(r, 80));
  document.querySelector('.nav button[data-view="design"]').click();
  U.render(document.getElementById('dzRoot'));
  const очимаПетра = { seat: U.tab(), cards: бачить() };
  seeAsSet(''); await new Promise(r => setTimeout(r, 60));
  /* Сам Петро (справжній вхід під його роллю). */
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'designer' }) : x);
  contentData.team.find(x => x.email === 'p@loomiq').email = 'p2@loomiq';
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  D.dzList(designJobs['2000501'].units[0], 'graphic')[0].who = 'test@loomiq';
  openDesign(); U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
  const сам = { seat: U.tab(), cards: бачить(), mine: U.host.onlyMine() };
  return { очимаПетра, сам };
});
console.log('   ' + JSON.stringify(дз));
ok(дз.очимаПетра.seat === 'graphic' && дз.очимаПетра.cards === '2000501,2000503',
  'очима Петра: лише його дизайн і спільна черга, чужий (Данила) не видно', JSON.stringify(дз.очимаПетра));
ok(дз.сам.mine && дз.сам.cards === '2000501,2000503',
  'сам дизайнер: лише свої й черга відділу', JSON.stringify(дз.сам));

console.log('');
console.log('═══ 5. ДВІ РОЛІ — ОДНА ЗА РАЗ, ПЕРЕМИКАЧ ЗЛІВА (22.10) ═══');
const дві = await p.evaluate(async () => {
  seeAsSet('');
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'supply', roles:['supply','production'] }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  document.querySelector('.nav button[data-view="design"]').click();
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const sw = () => { const s = document.querySelector('#roleSwitch select'); return s ? { opts:[...s.options].map(o => o.value), cur:s.value } : null; };
  const a = { seat: U.tab(), board: !!document.querySelector('#dzRoot [data-seat]'), sw: sw(), can: myAcc().can.join() };
  roleSwitchTo('production'); await new Promise(r => setTimeout(r, 100));
  const b = { seat: U.tab(), cols: document.querySelectorAll('#dzRoot .dz-col').length, sw: sw(), can: myAcc().can.join(),
              nav: [...document.querySelectorAll('.nav button[data-view]')].filter(x => !x.hidden).map(x => x.dataset.view).join() };
  /* Очима цієї ж людини з «Команди» — той самий перемикач між двома. */
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  contentData.team.push({ email:'two@loomiq', name:'Двоє', role:'supply', roles:['supply','production'] });
  applyRoleUi(); seeAsSet('@two@loomiq'); await new Promise(r => setTimeout(r, 80));
  document.querySelector('.nav button[data-view="design"]').click(); U.render(document.getElementById('dzRoot'));
  const c = { seat: U.tab(), sw: sw(), board: !!document.querySelector('#dzRoot [data-seat]') };
  seeAsSet('');
  return { a, b, c, sup: presetOf('supply').can.join(), prod: presetOf('production').can.join() };
});
console.log('   ' + JSON.stringify(дві));
ok(дві.a.seat === 'supply' && !дві.a.board && дві.a.sw && дві.a.sw.opts.join() === 'supply,production' && дві.a.sw.cur === 'supply' && дві.a.can === дві.sup,
  'закупівля + виробництво: одразу закупівля, права лише закупівлі; перемикач «Зараз» зліва, на дошці перемикача немає', JSON.stringify(дві.a));
ok(дві.b.seat === 'prod' && дві.b.cols > 0 && дві.b.sw && дві.b.sw.cur === 'production' && дві.b.can === дві.prod && дві.b.nav === 'design',
  'перемкнувся на цех — дошка цеху, права лише виробництва, зліва те саме «Замовлення B2C»', JSON.stringify(дві.b));
ok(дві.c.sw && дві.c.sw.opts.join() === 'supply,production' && дві.c.sw.cur === 'supply' && дві.c.seat === 'supply' && !дві.c.board,
  'очима такої людини з «Команди» — той самий перемикач, стартова роль перша', JSON.stringify(дві.c));

console.log('═══ 6. «! ПРОБЛЕМА» — АКАУНТИ Й ВИРОБНИЦТВО, НЕ ДИЗАЙНЕРИ (22.10) ═══');
const оклик = await p.evaluate(async () => {
  seeAsSet('');
  const D = window.LQDesign, U = D.ui;
  const id = '2000301';
  if(!designJobs[id]){ const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u]; const g = D.dzNew(); g.who = 'test@loomiq'; g.sentAt = new Date().toISOString(); g.status = 'work'; D.dzList(u, 'graphic').push(g); }
  const out = {};
  for(const role of ['managerb2c', 'designer', 'embroidery', 'dtf', 'production', 'supply', 'owner']){
    try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
    contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role, roles:[role] }) : x);
    applyRoleUi(); await new Promise(r => setTimeout(r, 40));
    document.querySelector('.nav button[data-view="design"]').click();
    U.render(document.getElementById('dzRoot'));
    U.openCard ? U.openCard(id) : null;
    const box = document.createElement('div');
    box.innerHTML = U.probBarHtml ? U.probBarHtml(id) : '';
    out[role] = !!box.querySelector('[data-do="problem-add"]');
  }
  return out;
});
console.log('   ' + JSON.stringify(оклик));
ok(оклик.managerb2c && оклик.production && оклик.supply && оклик.owner, 'у акаунта, виробництва, закупівлі й власника «! Проблема» є', JSON.stringify(оклик));
ok(!оклик.designer && !оклик.embroidery && !оклик.dtf, 'у графічного, вишивального й DTF-дизайнера — немає', JSON.stringify(оклик));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'виробничі ролі — лише B2C, кожна на своїй дошці');
process.exit(bad ? 1 : 0);
