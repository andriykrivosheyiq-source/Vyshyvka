/* ВІДМОВА НП → ЗАМОВИТИ ПОВЕРНЕННЯ (09.11).

   Андрій: «є в нас відмова, і відмова НП повинна бути, щоб зрозуміти, по
   яких ТТН відмова пішла, і щоб ми могли ці ТТН, які нам потрібні,
   замовити назад, щоб нам їх повернули». Перевіряємо:
     A. воркер (підставна НП): повернення вже є — віддає його, другого не
        створює; немає — CheckPossibilityCreateReturn → причина «відмова» →
        save orderCargoReturn на адресу відправника; повернути не можна —
        словами; trackMany віддає накладну, створену на основі (back);
     B. адмінка: відмова НП — окрема колонка «Відмова НП» в акаунта (руками —
        «Відмова»), у цеху — «Відмова НП» на виду; на плитці — що з
        поверненням; «↩ Замовити повернення» → один запис через orderApply;
        повторно не замовляє; відмова НП — червоним у картці й у журналі;
        НП замовила, а картка не записалась — так і сказано; опитування
        підхоплює накладну повернення (і замовлену в кабінеті НП) та її
        статус; «✓ Отримали назад» закриває; дизайнер не замовляє.

   Запуск:  node tests/np-return.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9031;
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
  bgApi: { npUrl:'https://np.example/w' },
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


console.log('═══ A. ВОРКЕР ═══');
const W = await import(path.join(ROOT, 'worker/novaposhta-proxy.js'));
const realFetch = globalThis.fetch;
let NP = {}, CALLS = [];
globalThis.fetch = async (u, o) => {
  const b = JSON.parse(o.body);
  CALLS.push(b.modelName + '.' + b.calledMethod);
  const J = data => new Response(JSON.stringify({ success: true, data, errors: [], warnings: [] }));
  const F = msg => new Response(JSON.stringify({ success: false, data: [], errors: [msg], warnings: [] }));
  const m = b.calledMethod;
  if(m === 'getReturnOrdersList') return J(NP.list || []);
  if(m === 'CheckPossibilityCreateReturn') return NP.check === 'fail' ? F('Return for this document is impossible') : J(NP.check || []);
  if(m === 'getReturnReasons') return J([{ Ref:'r0', Description:'Інше' }, { Ref:'r1', Description:'Відмова отримувача' }]);
  if(m === 'getReturnReasonsSubtypes') return J([{ Ref:'s0', Description:'Не підійшов розмір' }, { Ref:'s1', Description:'Відмова від отримання' }]);
  if(m === 'save'){ NP.saved = b.methodProperties; return J([{ Number:'RO-77', Ref:'ret-ref-1' }]); }
  if(m === 'getStatusDocuments') return J([{ Number:'20450000000901', StatusCode:'103', Status:'Відмова одержувача',
    LastCreatedOnTheBasisNumber:'59000000000901', LastCreatedOnTheBasisDocumentType:'CargoReturn', LastCreatedOnTheBasisDateTime:'2026-11-09 10:00:00' }]);
  return J([]);
};
const ADDR = { Ref:'a1', NonCash:true, City:'Київ', Address:'Відділення №5', Counterparty:'c', ContactPerson:'p', Phone:'380' };
NP = { list: [], check: [ADDR] }; CALLS = [];
const нове = await W._pure.returnOrder({}, 'key', '20450000000901', {});
console.log('   ' + JSON.stringify({ нове, saved: NP.saved, CALLS }));
ok(нове.num === 'RO-77' && нове.ref === 'ret-ref-1' && NP.saved && NP.saved.OrderType === 'orderCargoReturn' &&
   NP.saved.IntDocNumber === '20450000000901' && NP.saved.Reason === 'r1' && NP.saved.SubtypeReason === 's1' &&
   NP.saved.ReturnAddressRef === 'a1' && NP.saved.PaymentMethod === 'NonCash',
  'немає повернення — замовляє: причина «відмова», адреса відправника, безготівка', JSON.stringify(NP.saved));
NP = { list: [{ DocumentNumber:'20450000000901', OrderNumber:'RO-1', OrderRef:'x1', ExpressWaybillNumber:'59000000000901', OrderStatus:'Прийнято' }], check: [ADDR] }; CALLS = [];
const було = await W._pure.returnOrder({}, 'key', '20450000000901', {});
ok(було.again && було.num === 'RO-1' && було.ttn === '59000000000901' && !CALLS.some(c => /save|CheckPossibility/.test(c)),
  'повернення вже є (повторний натиск, кабінет НП) — віддає його, другого не створює', JSON.stringify({ було, CALLS }));
NP = { list: [], check: 'fail' }; let помилка = '';
try{ await W._pure.returnOrder({}, 'key', '20450000000901', {}); }catch(e){ помилка = e.message; }
ok(/impossible/.test(помилка) && !NP.saved, 'Нова пошта не дає повернути — причина словами, нічого не замовлено', помилка);
const tr = await W.default.fetch(new Request('https://w/', { method:'POST', headers:{ Origin:'https://loomiq.net' },
  body: JSON.stringify({ op:'trackMany', ttns:[{ ttn:'20450000000901', phone:'' }] }) }), { NP_API_KEY:'k' });
const trj = await tr.json();
ok(trj.ok && trj.list[0].back === '59000000000901' && trj.list[0].backType === 'CargoReturn',
  'статуси віддають накладну, створену на основі (повернення)', JSON.stringify(trj));
const ro = await W.default.fetch(new Request('https://w/', { method:'POST', headers:{ Origin:'https://loomiq.net' },
  body: JSON.stringify({ op:'returnOrder', ttn:'20450000000901' }) }), { NP_API_KEY:'k' });
ok(!(await ro.json()).ok, 'returnOrder без входу — відмова', '');
globalThis.fetch = realFetch;

console.log('');
console.log('═══ B. АДМІНКА ═══');
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
  window.__CALLS = []; window.__NP = { ret: 'ok', track: {} };
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if(String(u).indexOf('np.example') < 0) return real(u, o);
    const b = JSON.parse(o.body);
    window.__CALLS.push(b.op + (b.ttn ? ':' + b.ttn : ''));
    const J = d => new Response(JSON.stringify(d), { headers:{ 'Content-Type':'application/json' } });
    if(b.op === 'returnOrder'){
      if(window.__NP.ret === 'fail') return J({ ok:false, error:'Return for this document is impossible' });
      window.__NP.n = (window.__NP.n || 0) + 1;
      return J({ ok:true, num:'RO-' + window.__NP.n, ref:'rr' + window.__NP.n, ttn:'', addr:'Київ, Відділення №5', pay:'NonCash' });
    }
    if(b.op === 'trackMany') return J({ ok:true, list: (b.ttns || []).map(t => window.__NP.track[t.ttn] || { ttn: t.ttn, code: '' }) });
    return J({ ok:false, error:'?' });
  };
  const D = window.LQDesign, U = D.ui;
  const днів = n => new Date(Date.now() - n * 864e5).toISOString();
  const заведи = (id, nick, np) => {
    const o = { id:'r' + id, orderId:id, type:'client', dir:'b2c', name:nick, phone:'+38067000' + id.slice(-4), status:'prorahunok', site:'main',
      payments:[{ sum:300, at:днів(20), kind:'prepay' }], hist:[{ s:'prorahunok', at:днів(20) }],
      createdAt:днів(20), crmChatId:'c' + id, items:[] };
    if(np){ o.tracks = { prod:'done', qc:'ok', ship:'ttn' }; o.ttn = '2045000000' + id.slice(-4); o.ttnAt = днів(8); o.ttnSender = 'fop1';
            o.prodQc = { photos:['x'], at:днів(9) }; o.npSt = np; }
    orders.push(o);
    const j = designJobMake(id); j.no = id;
    const u = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x', artKind:'k' });
    j.units = [u];
    const g = D.dzNew(); g.who = 'p@loomiq'; g.sentAt = днів(19); g.status = 'work'; D.dzList(u, 'graphic').push(g);
    j.approvedVersion = 1;
    designJobs[id] = j;
    return o;
  };
  заведи('2000901', 'Відмовилась', { code:'103', status:'Відмова одержувача', at:днів(2) });
  заведи('2000902', 'ВКабінеті', { code:'102', status:'Відмова від отримання (створено замовлення на повернення)', at:днів(2) });
  заведи('2000903', 'Лежить', { code:'7', status:'Прибув у відділення', at:днів(5), arrivedAt:днів(5) });
  const руками = заведи('2000904', 'Руками', null);
  руками.status = 'cancel'; руками.refusal = { reason:'pay', at:днів(1), by:'test@loomiq' };
  заведи('2000905', 'НеЛягло', { code:'108', status:'Відмова одержувача', at:днів(1) });
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
  U.setTab('acct');
});
await ЖДИ(300);
const колонка = id => p.evaluate(id => { const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]');
  const col = c && c.closest('.dz-col[data-col]'); return col ? col.dataset.col : ''; }, id);
const плитка = id => p.evaluate(id => { const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"] .dz-c-npret');
  return c ? c.textContent : ''; }, id);
const відкрий = id => p.evaluate(async id => { const U = window.LQDesign.ui; U.open(''); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="' + id + '"]'); if(c) c.click(); await new Promise(r => setTimeout(r, 300));
  const b = document.querySelector('.dz-panel [data-npret]');
  return { block: b ? b.textContent.replace(/\s+/g, ' ') : '', ret: !!document.querySelector('.dz-panel [data-do="np-ret"]'),
           got: !!document.querySelector('.dz-panel [data-do="np-ret-got"]'), fail: (document.querySelector('.dz-panel [data-npret-fail]') || {}).textContent || '' }; }, id);
const картка = id => p.evaluate(id => { const o = orders.find(x => x.orderId === id); return JSON.parse(JSON.stringify(o.npRet || null)); }, id);
const рендер = () => p.evaluate(() => { window.LQDesign.ui.render(document.getElementById('dzRoot')); });

console.log('— колонки —');
await рендер();
const к = { a: await колонка('2000901'), b: await колонка('2000902'), c: await колонка('2000903'), d: await колонка('2000904') };
const стовп = await p.evaluate(() => [...document.querySelectorAll('#dzRoot .dz-col[data-col]')].map(c => c.dataset.col).join());
console.log('   ' + JSON.stringify({ к, стовп }));
ok(к.a === 'npref' && к.b === 'npref' && к.d === 'refused' && к.c === 'shipped' && /refused,npref/.test(стовп),
  'акаунт: відмова НП — своя колонка «Відмова НП» після «Відмови» (руками — у «Відмові»)', JSON.stringify({ к, стовп }));
const п1 = await плитка('2000901'), п2 = await плитка('2000902');
ok(/повернення не замовлено/.test(п1) && /вже замовлено в Новій пошті/.test(п2), 'на плитці — що з поверненням', JSON.stringify({ п1, п2 }));
const цех = await p.evaluate(() => { const r = window.LQDesign.PROD.filter(x => x.key === 'refused')[0]; return { label: r.label, hide: !!r.hide }; });
ok(цех.label === 'Відмова НП' && !цех.hide, 'цех: колонка «Відмова НП» на виду, не за «Доставка ▸»', JSON.stringify(цех));

console.log('— замовити повернення —');
const до = await відкрий('2000901');
ok(до.ret && /повернення не замовлено/.test(до.block) && /20450000000901/.test(до.block), 'у картці — «↩ Замовити повернення» з номером ТТН', JSON.stringify(до));
await p.evaluate(async () => { document.querySelector('.dz-panel [data-do="np-ret"]').click(); await new Promise(r => setTimeout(r, 700)); });
const після = await картка('2000901');
const викл = await p.evaluate(() => window.__CALLS.slice());
console.log('   ' + JSON.stringify({ після, викл }));
ok(після && після.num === 'RO-1' && після.ref === 'rr1' && після.by === 'test@loomiq' && викл.filter(c => /^returnOrder/.test(c)).length === 1,
  'замовлено одним викликом, у картці npRet з номером замовлення', JSON.stringify({ після, викл }));
const після2 = await відкрий('2000901');
ok(!після2.ret && після2.got && /повернення замовлено · №RO-1/.test(після2.block), 'кнопки замовити вже немає, є «Отримали назад»', JSON.stringify(після2));
const вдруге = await p.evaluate(async () => { const r = await npReturnOrder(orders.find(x => x.orderId === '2000901'), 1);
  return { r, n: window.__CALLS.filter(c => /^returnOrder/.test(c)).length }; });
ok(!вдруге.r.ok && вдруге.n === 1, 'вдруге — не замовляє (без виклику НП)', JSON.stringify(вдруге));

console.log('— Нова пошта відмовила —');
await p.evaluate(() => { window.__NP.ret = 'fail'; });
await відкрий('2000903');
await p.evaluate(async () => { document.querySelector('.dz-panel [data-do="np-ret"]').click(); await new Promise(r => setTimeout(r, 700)); });
const збій = await відкрий('2000903');
const журнал = await p.evaluate(() => accLogList().filter(r => r.kind === 'ret-fail').length);
ok(/impossible/.test(збій.fail) && збій.ret && !(await картка('2000903')) && журнал >= 1,
  '«понад 3 дні» → НП відмовила: причина червоним у картці, кнопка лишається, рядок у журналі', JSON.stringify({ збій, журнал }));

console.log('— НП замовила, картка не записалась —');
await p.evaluate(() => { window.__NP.ret = 'ok'; });
const нелягло = await p.evaluate(async () => { const H = window.LQDesign.ui.host, real = H.orderApply; H.orderApply = async () => false;
  try{ return await npReturnOrder(orders.find(x => x.orderId === '2000905'), 1); } finally { H.orderApply = real; } });
ok(!нелягло.ok && /замовлено \(№RO-\d\), але в картку не записалось/.test(нелягло.why) && !(await картка('2000905')),
  'картка не записалась — так і сказано, з номером замовлення в НП', JSON.stringify(нелягло));

console.log('— опитування статусів —');
await p.evaluate(async () => {
  window.__NP.track = {
    '20450000000901': { ttn:'20450000000901', code:'103', status:'Відмова одержувача', back:'59000000000901', backType:'CargoReturn' },
    '20450000000902': { ttn:'20450000000902', code:'102', status:'Відмова від отримання', back:'59000000000902', backType:'CargoReturn', backAt:'2026-11-08 12:00:00' } };
  await prodNpPoll(true); await new Promise(r => setTimeout(r, 200));
});
const п901 = await картка('2000901'), п902 = await картка('2000902');
ok(п901 && п901.ttn === '59000000000901' && п901.num === 'RO-1' && п902 && п902.ttn === '59000000000902' && п902.outside,
  'опитування підхоплює накладну повернення (і замовлене в кабінеті НП)', JSON.stringify({ п901, п902 }));
await p.evaluate(async () => {
  window.__NP.track = { '59000000000901': { ttn:'59000000000901', code:'7', status:'Прибув у відділення' } };
  await prodNpPoll(true); await new Promise(r => setTimeout(r, 200));
});
await рендер();
const прибуло = await плитка('2000901');
ok(/повернення прибуло — заберіть на пошті · ТТН 59000000000901/.test(прибуло), 'статус накладної повернення — на плитці «прибуло, заберіть»', прибуло);

console.log('— отримали назад —');
await відкрий('2000901');
await p.evaluate(async () => { document.querySelector('.dz-panel [data-do="np-ret-got"]').click(); await new Promise(r => setTimeout(r, 600)); });
const got = await картка('2000901');
await рендер();
const плГот = await плитка('2000901');
ok(got && got.got && got.got.by === 'test@loomiq' && /повернення отримали/.test(плГот), '«✓ Отримали назад» закриває повернення', JSON.stringify({ got, плГот }));

console.log('— дизайнер не замовляє —');
const диз = await p.evaluate(async () => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'designer', roles:['designer'] }) : x);
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  const U = window.LQDesign.ui, n0 = window.__CALLS.length;
  U.open('2000905');
  await U.act('np-ret', document.getElementById('dzRoot'), { part: '1' });
  return { calls: window.__CALLS.length - n0, npRet: !!orders.find(x => x.orderId === '2000905').npRet };
});
ok(диз.calls === 0 && !диз.npRet, 'дизайнер — ні виклику, ні запису', JSON.stringify(диз));

console.log('— «Обсяг даних» у «Стан системи» (вимір для телефона) —');
const обсяг = await p.evaluate(() => {
  const r = window.__lqDataSize();
  const box = document.createElement('div'); document.body.appendChild(box); renderDataSize(box);
  const t = box.textContent; box.remove();
  return { групи: r.групи.map(g => g.name + ':' + g.count).join(), важкі: r.важкі.length, all: r.all, t: t.slice(0, 400), ord: orders.length };
});
console.log('   ' + JSON.stringify(обсяг));
ok(new RegExp('Картки замовлень:' + обсяг.ord).test(обсяг.групи) && /Картки відділу B2C/.test(обсяг.групи) && обсяг.важкі > 0 && обсяг.all > 0 &&
   /Обсяг даних у вкладці/.test(обсяг.t) && /Найважчі картки/.test(обсяг.t) && /Документ команди/.test(обсяг.t),
  'вимір: кількість і вага карток, платежів, КП, документа команди, 10 найважчих — текстом для копіювання', JSON.stringify(обсяг));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '✗ ' + bad + ' перевірок не пройшло' : '✓ відмова НП і повернення');
process.exit(bad ? 1 : 0);
