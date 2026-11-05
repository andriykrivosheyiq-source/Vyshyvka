/* ЕТАП ВРУЧНУ З КАРТКИ; ФІКСАЦІЯ — НА ВИБІР УСЕ, ЩО МОЖНА ПОГОДИТИ (05.11).

   Андрій: «ручне переведення в новий статус через карточку — там є
   статуси, і в них можливість пересувати» (акаунт і власник).
     1. Акаунт: етапи в картці — кнопки; «Погодження» → картка в цеху там,
        «Графіка» → на дошці акаунта там (шпилька), позначка одна за раз.
     2. «Доставлено» — вікно грошей, як у власника; «Виконано вручну».
     3. Дизайнер — етапи не кнопки.
   #2000205: «при фіксації дає 3 варіанти, усі без рис, а погодили з рисами».
     4. Вікно фіксації: першою погоджена версія, далі решта версій, далі
        варіанти; обрали версію — дизайн як є, нової версії немає.

   Запуск:  node tests/stage-set.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9075;
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
  window.confirm = () => true;
  const D = window.LQDesign, U = D.ui;
  const заведи = (id, nick) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:nick, status:'prorahunok', site:'main',
      payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[{ s:'prorahunok', at:'2026-10-18T09:00:00.000Z' }],
      createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c' + id, items:[], totalPrice: 1000,
      tracks: { prod: 'work' } };
    orders.push(o);
    const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u]; j.approvedVersion = 1;
    designJobs[id] = j;
    return o;
  };
  заведи('2000911', 'Ліна'); заведи('2000912', 'Марта'); заведи('2000913', 'Ніна');
  /* Накладка за ТТН, якої в CRM немає, уже прийшла — лежить неприв'язана. */
  payments.push({ id:'npc_20451234567890', src:'np', ttn:'20451234567890', amount:700, at: new Date().toISOString(), acc:'np' });
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const тягни = (id, to) => p.evaluate(({ id, to }) => {
  const root = document.getElementById('dzRoot');
  const c = root.querySelector('.dz-card[data-open="' + id + '"]'); if(!c) return { err: 'немає картки' };
  const w = c.closest('.dz-card-w') || c;
  if(!w.ondragstart) return { draggable: false };
  w.ondragstart({ dataTransfer: { setData(){}, effectAllowed: '' } });
  const canDrop = [...root.querySelectorAll('.dz-col.can-drop')].map(k => k.dataset.col);
  const k = root.querySelector('.dz-col[data-col="' + to + '"]');
  if(!k || !k.ondrop) return { draggable: true, canDrop, err: 'немає колонки ' + to };
  k.ondrop({ preventDefault(){}, clientY: 0 });
  return { draggable: true, canDrop };
}, { id, to });
const дошка = async tab => { await p.evaluate(tab => { const U = window.LQDesign.ui; U.setTab(tab); U.render(document.getElementById('dzRoot')); }, tab);
  /* Цех: колонки доставки («Виконано», «Відмова») сховані за «Доставка ▸» — розгортаємо. */
  if(tab === 'prod'){ await p.evaluate(() => { const b = document.querySelector("#dzRoot .dz-deliv-open"); if(b) b.click(); }); await ЖДИ(300); } };
const стан = id => p.evaluate(id => {
  const D = window.LQDesign, o = orders.find(x => x.orderId === id), j = designJobs[id];
  const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]'); const col = c && c.closest('.dz-col[data-col]');
  return { col: col ? col.dataset.col : '', chain: D.chainAt(j, o), prod: D.prodAt(j, o), od: o.ownerDone || null, pin: o.prodPin || null,
    ttn: o.ttn || '', due: dueSum(o), status: o.status, pays: (o.payments || []).length,
    audit: LQMoney.audit([o], payPays(), { now: Date.now(), np: {}, accs: [] }).map(x => x.kind) };
}, id);


const відкрий = id => p.evaluate(id => { const U = window.LQDesign.ui; U.setTab('acct'); U.open(id); U.render(document.getElementById('dzRoot')); }, id);
const кнопки = () => p.evaluate(() => [...document.querySelectorAll('#dzRoot [data-do="stage-set"]')].map(b => b.dataset.to + '=' + b.textContent.trim()));
const тисни = to => p.evaluate(to => { const b = document.querySelector('#dzRoot [data-do="stage-set"][data-to="' + to + '"]'); if(!b) return false; b.click(); return true; }, to);

console.log('═══ 1. АКАУНТ: ЕТАП З КАРТКИ ═══');
await відкрий('2000911'); await ЖДИ(300);
const к1 = await кнопки();
console.log('   ' + JSON.stringify(к1));
ok(!к1.some(x => /^prod:run=/.test(x)) && к1.some(x => /^acct:design=/.test(x)) && к1.some(x => /^prod:appr=/.test(x)) && к1.some(x => /^prod:done=/.test(x)),
  'у картці етапи — кнопки (Графіка, Погодження, Доставлено…); теперішній («На станках») — ні', JSON.stringify(к1));
ok(await тисни('prod:appr'), 'натиснули «Погодження»', 'кнопки немає');
await ЖДИ(1200);
const с1 = await стан('2000911');
ok(с1.prod === 'appr' && с1.pin && с1.pin.to === 'appr', 'картка в цеху «Чекає погодження», позначка «вручну» з тим, хто поставив', JSON.stringify(с1));
await відкрий('2000911'); await ЖДИ(200);
ok(await тисни('acct:design'), 'натиснули «Графіка»', 'кнопки немає');
await ЖДИ(1200);
const с2 = await p.evaluate(() => { const D = window.LQDesign, o = orders.find(x => x.orderId === '2000911'), j = designJobs['2000911'];
  return { chain: D.chainAt(j, o), pin: j.pin && j.pin.to, prodPin: o.prodPin || null, hist: (j.pinHist || []).length }; });
ok(с2.chain === 'design' && с2.pin === 'design' && !с2.prodPin, 'на дошці акаунта — «У графічного», позначка цеху знята (одна за раз)', JSON.stringify(с2));

console.log('═══ 2. «ДОСТАВЛЕНО» — ВІКНО ГРОШЕЙ ═══');
await відкрий('2000912'); await ЖДИ(200);
await тисни('prod:done'); await ЖДИ(300);
const вікно = await p.evaluate(() => { const w = document.querySelector('.dz-odw'); return w ? w.textContent.replace(/\s+/g, ' ') : ''; });
ok(/Борг лишається/.test(вікно), 'вікно грошей, як у власника', вікно.slice(0, 160));
await p.evaluate(() => { const w = document.querySelector('.dz-odw'); const r = w && w.querySelector('[data-od-how="debt"], input[value="debt"]'); if(r) r.click(); const g = w && w.querySelector('[data-od-go]'); if(g) g.click(); });
await ЖДИ(1200);
const с3 = await стан('2000912');
ok(с3.od && с3.prod === 'done', 'акаунт поставив «Виконано вручну»', JSON.stringify(с3));

console.log('═══ 3. ДИЗАЙНЕР — ЕТАПИ НЕ КНОПКИ ═══');
const кД = await p.evaluate(async () => { const U = window.LQDesign.ui; const r0 = U.host.refuseOk; U.host.refuseOk = () => false;
  U.setTab('acct'); U.open('2000913'); U.render(document.getElementById('dzRoot'));
  const n = document.querySelectorAll('#dzRoot [data-do="stage-set"]').length; U.host.refuseOk = r0; return n; });
ok(кД === 0, 'без права акаунта кнопок етапів немає', String(кД));

console.log('═══ 4. ФІКСАЦІЯ: ПОГОДЖЕНА ВЕРСІЯ, РЕШТА ВЕРСІЙ, ВАРІАНТИ ═══');
const ф = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const o = { id:'r2000914', orderId:'2000914', type:'client', dir:'b2c', name:'Рис', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c914', items:[], totalPrice: 1000 };
  orders.push(o);
  const j = designJobMake('2000914'); j.no = '2000914';
  const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1 });
  j.units = [u];
  const d = D.dzNew(); D.dzAttach(d, 'test@loomiq', 'test@loomiq'); D.dzSend(d, 'test@loomiq');
  u.graphic.push(d);
  D.dzVer(d, 'p@loomiq', [{ name:'v1.png', url:'https://x/v1.png' }], 'без рис', null, 'graphic');
  D.dzVer(d, 'p@loomiq', [{ name:'v2.png', url:'https://x/v2.png' }], 'з рисами', null, 'graphic');
  d.status = 'review'; D.sketchOkMark(d, 2, 'test@loomiq');
  u.variants = { list: [ { n:1, gid:'tee', name:'Футболка', color:'Білий', mock:'https://x/a.png', files:[{ name:'a.png', url:'https://x/a.png' }] },
                         { n:2, gid:'hoodie', name:'Худі', color:'Чорний', mock:'https://x/b.png', files:[{ name:'b.png', url:'https://x/b.png' }] } ] };
  designJobs['2000914'] = j;
  U.setTab('acct'); U.open('2000914'); U.render(document.getElementById('dzRoot'));
  const b = document.querySelector('#dzRoot [data-do="dz-ok-pick"]');
  if(!b) return { err: 'немає «Фіксація»' };
  b.click(); await new Promise(r => setTimeout(r, 300));
  const opts = [...document.querySelectorAll('[data-pick]')].map(x => x.dataset.pick + '=' + x.textContent.replace(/\s+/g, ' ').trim());
  const v2 = document.querySelector('[data-pick="v2"]'); if(v2) v2.click();
  await new Promise(r => setTimeout(r, 300));
  const go = document.querySelector('[data-cl-go]'); const cloth = !!go; if(go) go.click();
  await new Promise(r => setTimeout(r, 1200));
  const jj = designJobs['2000914'], dd = jj.units[0].graphic[0];
  return { opts, cloth, vers: dd.vers.length, ok: dd.ok && dd.ok.ver, sketchOk: dd.sketchOk, pickVer: (jj.units[0].variants || {}).pickVer, pick: (jj.units[0].variants || {}).pick || null, gid: jj.units[0].gid };
});
console.log('   ' + JSON.stringify(ф));
ok(ф.opts && /^v2=.*Погоджена/.test(ф.opts[0]) && ф.opts.some(x => /^v1=/.test(x)) && ф.opts.some(x => /^x1=.*Варіант/.test(x)) && ф.opts.some(x => /^x2=/.test(x)),
  'у вікні: першою погоджена v2, далі v1, далі варіанти 1 і 2', JSON.stringify(ф.opts));
ok(ф.cloth && ф.vers === 2 && ф.sketchOk === 2 && ф.pickVer === 2 && !ф.pick && ф.gid === 'tee', 'обрали v2 — нової версії немає, погоджена лишилась v2, виріб не підмінено', JSON.stringify(ф));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
