/* ВІДМОВА В B2C (22.10).

   Андрій: «статус відмова… основні пункти відмови… потім аналітикою»;
   «відмову ставить лише акаунт і власник; повернути — ті самі; окремий
   статус в кінці акаунтів, колонка з відмовами всіма».

   1. Акаунт: сіра «Відмова» в кінці рядка етапів → причина (перша — за
      етапом) → підтвердження → колонка «Відмова», червона з причиною,
      запис в історії картки; причина окремими полями для аналітики.
   2. Відмовленого немає на дошках дизайнера, цеху, закупівлі.
   3. «Інше» — лише зі словами.
   4. Повернути в роботу — назад на свій етап, запис в історії.
   5. Дизайнер і цех кнопки не бачать і поставити не можуть.
   6. Посилку не забрали — сама в «Відмові», «Не забрав з пошти».

   Запуск:  node tests/refuse.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9015;
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
await p.evaluate(() => {
  window.__confirmYes = true; window.confirm = () => window.__confirmYes;
  const D = window.LQDesign, U = D.ui;
  const заведи = (id, nick) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:nick, status:'prorahunok', site:'main',
      payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[{ s:'prorahunok', at:'2026-10-18T09:00:00.000Z' }],
      createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[] };
    orders.push(o);
    const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u];
    const g = D.dzNew(); g.who = 'p@loomiq'; g.sentAt = new Date().toISOString(); g.status = 'work'; D.dzList(u, 'graphic').push(g);
    designJobs[id] = j;
    return o;
  };
  заведи('2000801', 'Ліна'); заведи('2000802', 'Марко');
  /* Посилку не забрали: цех здав, ТТН, Нова пошта — «відмова одержувача». */
  const o3 = заведи('2000803', 'Ян');
  o3.tracks = { prod:'done', qc:'ok', ship:'ttn' }; o3.ttn = '20450000000001'; o3.ttnAt = '2026-10-20T10:00:00.000Z';
  o3.prodQc = { photos:['x'], at:'2026-10-20T09:00:00.000Z' }; o3.npSt = { code: 102, at:'2026-10-21T10:00:00.000Z' };
  designJobs['2000803'].approvedVersion = 1;
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const колонка = id => p.evaluate(id => { const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]');
  const col = c && c.closest('.dz-col[data-col]'); return col ? col.dataset.col : ''; }, id);
const відкрий = id => p.evaluate(async id => { const U = window.LQDesign.ui; U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]'); if(c) c.click(); await new Promise(r => setTimeout(r, 300));
  const ch = document.querySelector('.dz-panel .dz-c-chain.in-panel');
  const b = ch && ch.querySelector('[data-do="refuse"], [data-do="refuse-back"]');
  return { chain: ch ? ch.textContent.replace(/\s+/g, ' ') : '', btn: b ? { do: b.dataset.do, t: b.textContent.trim() } : null }; }, id);

console.log('═══ 1. АКАУНТ СТАВИТЬ ВІДМОВУ ═══');
const до = await відкрий('2000801');
console.log('   ' + JSON.stringify(до));
ok(до.btn && до.btn.do === 'refuse' && до.btn.t === 'Відмова', 'у кінці рядка етапів — сіра кнопка «Відмова»', JSON.stringify(до));
const вікно = await p.evaluate(async () => {
  document.querySelector('.dz-panel [data-do="refuse"]').click();
  await new Promise(r => setTimeout(r, 200));
  const w = document.querySelector('.dz-refw');
  const opts = w ? [...w.querySelectorAll('input[name="dz-ref"]')].map(x => x.value + (x.checked ? '*' : '')) : [];
  const pay = w && w.querySelector('input[value="pay"]'); if(pay){ pay.checked = true; pay.dispatchEvent(new Event('change', { bubbles:true })); }
  w && w.querySelector('[data-ref-go]').click();
  await new Promise(r => setTimeout(r, 500));
  const o = orders.find(x => x.orderId === '2000801');
  return { opts, gone: !document.querySelector('.dz-refw'), status: o.status, refusal: o.refusal, hist: (o.refuseHist || []).length, lost: o.lostReason };
});
console.log('   ' + JSON.stringify(вікно));
ok(вікно.opts.join() === 'pay,graphic*,stitch,prod,photo,post,other', 'сім причин; першою обрано «графічний дизайн» — там замовлення зараз', JSON.stringify(вікно.opts));
ok(вікно.gone && вікно.status === 'cancel' && вікно.refusal && вікно.refusal.reason === 'pay' && вікно.refusal.stage === 'design' &&
   вікно.refusal.by === 'test@loomiq' && вікно.refusal.at && вікно.hist === 1 && вікно.lost === 'На етапі оплати',
  'обрав «на етапі оплати» й підтвердив — відмова з причиною, етапом, хто й коли (для аналітики)', JSON.stringify(вікно));
const після = await відкрий('2000801');
const кол1 = await колонка('2000801');
const історія = await p.evaluate(() => { const D = window.LQDesign; const o = orders.find(x => x.orderId === '2000801');
  return D.ui.histHtml(designJobs['2000801'], o).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); });
console.log('   ' + JSON.stringify({ після, кол1 }));
ok(кол1 === 'refused', 'картка в колонці «Відмова» в кінці дошки акаунта', кол1);
ok(після.btn && після.btn.do === 'refuse-back' && /Відмова · На етапі оплати/.test(після.btn.t), 'у рядку етапів — червона «Відмова · На етапі оплати»', JSON.stringify(після));
const шапка = await p.evaluate(() => (document.querySelector('.dz-panel .dz-panel-l1 .dz-state') || {}).textContent || '');
ok(/^Відмова$/.test(шапка.trim()), 'під номером картки — статус «Відмова», а не етап, де стояла', шапка);
ok(/відмова/.test(історія) && /На етапі оплати/.test(історія), 'в історії картки — «відмова · На етапі оплати»', історія.slice(0, 200));

console.log('');
console.log('═══ 2. НА ІНШИХ ДОШКАХ ВІДМОВИ НЕМАЄ ═══');
const дошки = await p.evaluate(() => {
  const U = window.LQDesign.ui, out = {};
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  applyRoleUi();
  for(const seat of ['graphic', 'prod', 'supply']){
    U.setTab(seat); U.render(document.getElementById('dzRoot'));
    out[seat] = { refused: !!document.querySelector('#dzRoot .dz-card[data-open="2000801"]'), live: !!document.querySelector('#dzRoot .dz-card[data-open="2000802"]') };
  }
  U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  return out;
});
console.log('   ' + JSON.stringify(дошки));
ok(!дошки.graphic.refused && дошки.graphic.live, 'графічний дизайнер відмовленого не бачить (живе — бачить)', JSON.stringify(дошки.graphic));
ok(!дошки.prod.refused && !дошки.supply.refused, 'цех і закупівля — теж ні', JSON.stringify(дошки));

console.log('');
console.log('═══ 3. «ІНШЕ» — ЛИШЕ ЗІ СЛОВАМИ ═══');
await відкрий('2000802');
const інше = await p.evaluate(async () => {
  document.querySelector('.dz-panel [data-do="refuse"]').click();
  await new Promise(r => setTimeout(r, 200));
  const w = document.querySelector('.dz-refw');
  const o = w.querySelector('input[value="other"]'); o.checked = true; o.dispatchEvent(new Event('change', { bubbles:true }));
  w.querySelector('[data-ref-go]').click();
  await new Promise(r => setTimeout(r, 200));
  const без = { open: !!document.querySelector('.dz-refw'), status: orders.find(x => x.orderId === '2000802').status };
  w.querySelector('.dz-ref-t').value = 'Переїхав за кордон';
  w.querySelector('[data-ref-go]').click();
  await new Promise(r => setTimeout(r, 500));
  const x = orders.find(x => x.orderId === '2000802');
  return { без, status: x.status, refusal: x.refusal, lost: x.lostReason };
});
console.log('   ' + JSON.stringify(інше));
ok(інше.без.open && інше.без.status !== 'cancel', 'без слів «Інше» не приймається — вікно лишається', JSON.stringify(інше.без));
ok(інше.status === 'cancel' && інше.refusal.reason === 'other' && інше.refusal.text === 'Переїхав за кордон' && інше.lost === 'Переїхав за кордон',
  'зі словами — відмова «Інше» з текстом', JSON.stringify(інше));

console.log('');
console.log('═══ 4. ПОВЕРНУТИ В РОБОТУ ═══');
await відкрий('2000801');
const назад = await p.evaluate(async () => {
  document.querySelector('.dz-panel [data-do="refuse-back"]').click();
  await new Promise(r => setTimeout(r, 500));
  const o = orders.find(x => x.orderId === '2000801');
  return { status: o.status, refusal: o.refusal || null, hist: (o.refuseHist || []).map(h => h.back ? 'back' : h.reason).join() };
});
const кол2 = await колонка('2000801');
const іст2 = await p.evaluate(() => window.LQDesign.ui.histHtml(designJobs['2000801'], orders.find(x => x.orderId === '2000801')).replace(/<[^>]+>/g, ' '));
console.log('   ' + JSON.stringify({ назад, кол2 }));
ok(назад.status === 'prorahunok' && !назад.refusal && назад.hist === 'pay,back' && кол2 === 'design',
  'повернув — статус як до відмови, знову «У графічного дизайнера»', JSON.stringify({ назад, кол2 }));
ok(/повернуто в роботу/.test(іст2), 'в історії — «повернуто в роботу з відмови»', іст2.slice(0, 200));

console.log('');
console.log('═══ 5. ДИЗАЙНЕР І ЦЕХ ВІДМОВУ НЕ СТАВЛЯТЬ ═══');
const чужі = {};
for(const role of ['designer', 'production', 'managerb2c']){
  чужі[role] = await p.evaluate(async role => {
    contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role, roles:[role] }) : x);
    try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
    applyRoleUi(); await new Promise(r => setTimeout(r, 60));
    const U = window.LQDesign.ui;
    const ch = U.chainHtml([{ st:'next', t:'Відмова', act:'refuse', id:'2000801' }], 'in-panel');
    await U.act('refuse', document.getElementById('dzRoot'), { id:'2000801' });
    await new Promise(r => setTimeout(r, 150));
    const w = !!document.querySelector('.dz-refw'); const x = document.querySelector('.dz-refw'); if(x) x.remove();
    return { btn: /data-do="refuse"/.test(ch), dialog: w };
  }, role);
}
console.log('   ' + JSON.stringify(чужі));
ok(!чужі.designer.btn && !чужі.designer.dialog && !чужі.production.btn && !чужі.production.dialog, 'дизайнер і цех кнопки не бачать і поставити не можуть', JSON.stringify(чужі));
ok(чужі.managerb2c.btn && чужі.managerb2c.dialog, 'акаунт B2C — може', JSON.stringify(чужі.managerb2c));

console.log('');
console.log('═══ 6. ПОСИЛКУ НЕ ЗАБРАЛИ — САМА У «ВІДМОВІ» ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); });
const пошта = await відкрий('2000803');
const кол3 = await колонка('2000803');
const пр = await p.evaluate(() => { const D = window.LQDesign; const o = orders.find(x => x.orderId === '2000803'); return D.refusalOf(designJobs['2000803'], o); });
console.log('   ' + JSON.stringify({ пошта, кол3, пр }));
ok(кол3 === 'refused' && пр && пр.auto && пр.reason === 'post', 'Нова пошта повернула — картка в «Відмові», причина «Не забрав з пошти»', JSON.stringify({ кол3, пр }));
ok(/Відмова · Не забрав з пошти/.test(пошта.chain) && !пошта.btn, 'у рядку етапів — червона «Відмова · Не забрав з пошти», без кнопки (це факт пошти)', JSON.stringify(пошта));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'відмова з причиною: ставить акаунт, колонка в кінці, повернення, аналітика');
process.exit(bad ? 1 : 0);
