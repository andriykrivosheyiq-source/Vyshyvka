/* ПЕРЕТЯГУВАННЯ ВЛАСНИКА: «ВИКОНАНО», «ВІДМОВА», БУДЬ-ЯКА КОЛОНКА (04.11).

   Андрій: «перетягнув від правила — щоб воно там і було, і в менеджерів, і
   в цеху… якщо там накладка — рахується як накладка».
   1. Менеджер так не може.
   2. Власник → «Відправлено» (акаунт): вікно грошей, накладка за ТТН — ТТН
      стає ТТН картки, гроші, що вже прийшли, привʼязуються самі; у цеху
      «Виконано», у шапці «✓ виконано вручну · хто» і «зняти».
   3. Цех: з «Виконано» на станки — «Виконано вручну» знято, шпилька цеху
      (o.prodPin) видна й акаунту; історія; «зняти».
   4. «Оплачено поза системою» — борг 0, у Звірці owner_off.
   5. «Борг лишається» — виконано, борг видно.
   6. «Відмова» перетягуванням — з причиною.

   Запуск:  node tests/owner-move.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9041;
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

console.log('═══ 1. МЕНЕДЖЕР: «ВИКОНАНО» Й «ВІДМОВА» НЕ ПЕРЕТЯГУЮТЬСЯ ═══');
await дошка('acct');
const м = await тягни('2000911', 'shipped');
await ЖДИ(300);
const м1 = await стан('2000911');
ok(!м.draggable && !м1.od, 'менеджер: картку виробництва не тягне, «Виконано вручну» немає', JSON.stringify({ м, м1 }));

console.log('');
console.log('═══ 2. ВЛАСНИК → «ВІДПРАВЛЕНО» НА ДОШЦІ АКАУНТА: НАКЛАДКА ЗА ТТН ═══');
await p.evaluate(() => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  applyRoleUi();
});
await дошка('acct');
const в = await тягни('2000911', 'shipped');
await ЖДИ(200);
const вікно = await p.evaluate(() => { const w = document.querySelector('.dz-odw'); return w ? w.textContent.replace(/\s+/g, ' ') : ''; });
ok(в.canDrop.includes('shipped') && в.canDrop.includes('refused') && в.canDrop.includes('ready'),
  'власник: приймають усі колонки, разом із «Відправлено» й «Відмова»', JSON.stringify(в));
ok(/Лишилось сплатити: 700/.test(вікно) && /Накладка/.test(вікно) && /поза системою/.test(вікно) && /Борг лишається/.test(вікно),
  'вікно: залишок 700 ₴ і три варіанти', вікно.slice(0, 200));
await p.evaluate(() => { const w = document.querySelector('.dz-odw'); w.querySelector('[data-od-ttn]').value = '20451234567890'; w.querySelector('[data-od-go]').click(); });
await ЖДИ(900);
const в1 = await стан('2000911');
const лінк = await p.evaluate(() => (payments.find(x => x.id === 'npc_20451234567890') || {}).orderId || '');
console.log('   ' + JSON.stringify({ в1, лінк }));
ok(в1.od && в1.od.how === 'ttn' && в1.od.by === 'test@loomiq' && в1.ttn === '20451234567890',
  'виконано вручну: накладка, ТТН стала ТТН картки', JSON.stringify(в1));
ok(в1.chain === 'shipped' && в1.prod === 'done' && в1.col === 'shipped', 'у менеджера «Відправлено», у цеху «Виконано»', JSON.stringify(в1));
ok(лінк === '2000911', 'накладка, що вже прийшла, привʼязалась до замовлення за ТТН сама', лінк);
await дошка('prod');
const ц = await стан('2000911');
const шапка = await p.evaluate(async () => {
  document.querySelector('#dzRoot .dz-card[data-open="2000911"]').click(); await new Promise(r => setTimeout(r, 300));
  const e = document.querySelector('.dz-panel .dz-pin.is-done'); return e ? e.textContent.replace(/\s+/g, ' ') : ''; });
ok(ц.col === 'done', 'дошка цеху: картка в «Виконано»', JSON.stringify(ц));
ok(/виконано вручну · test/.test(шапка) && /зняти/.test(шапка), 'у картці «✓ виконано вручну · test» і «зняти»', шапка);

console.log('');
console.log('═══ 3. ВЛАСНИК У ЦЕХУ: З «ВИКОНАНО» НА СТАНКИ — ШПИЛЬКА, ВИДНО ВСІМ ═══');
await p.evaluate(() => { const x = document.querySelector('.dz-panel [data-close]'); if(x) x.click(); });
await дошка('prod');
const тр = await тягни('2000911', 'run');
console.log('   ' + JSON.stringify(тр));
await ЖДИ(900);
const ц1 = await стан('2000911');
ok(!ц1.od && ц1.pin && ц1.pin.to === 'run' && ц1.prod === 'run' && ц1.chain === 'prod',
  '«Виконано вручну» знято, картка «На станках» з 📌 (o.prodPin), в акаунта — «Виробництво»', JSON.stringify(ц1));
await дошка('prod');
await тягни('2000911', 'appr');
await ЖДИ(900);
const ц2 = await стан('2000911');
ok(ц2.pin && ц2.pin.to === 'appr' && ц2.prod === 'appr' && ц2.chain === 'appr', 'перетягнув у «Чекає погодження» — там і стоїть (і в акаунта)', JSON.stringify(ц2));
const хіст = await p.evaluate(() => window.LQDesign.ui.histHtml(designJobs['2000911'], orders.find(x => x.orderId === '2000911')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
ok(/виконано вручну \(власник\)/.test(хіст) && /«Виконано вручну» знято/.test(хіст) && /цех: поставлено вручну «Чекає погодження»/.test(хіст),
  'в історії: виконано вручну, знято, поставлено вручну в цеху', хіст.slice(0, 300));
await дошка('prod');
const зн = await p.evaluate(async () => { const c = document.querySelector('#dzRoot .dz-card[data-open="2000911"]'); if(!c) return 'немає картки'; c.click(); await new Promise(r => setTimeout(r, 300));
  const b = document.querySelector('.dz-panel [data-do="prod-pin-off"]'); if(!b) return 'немає «зняти»: ' + (document.querySelector('.dz-panel-h') || {}).textContent; b.click(); return 'ok'; });
console.log('   ' + зн);
await ЖДИ(900);
const ц3 = await стан('2000911');
ok(!ц3.pin && ц3.prod === 'run', '«зняти» — шпильку цеху знято, картка знову за роботою («На станках»)', JSON.stringify(ц3));

console.log('');
console.log('═══ 4. «ОПЛАЧЕНО ПОЗА СИСТЕМОЮ» — БОРГ НУЛЬ, У ЗВІРЦІ ОКРЕМИЙ ПУНКТ ═══');
await дошка('prod');
await тягни('2000912', 'done');
await ЖДИ(200);
const пз = await p.evaluate(() => { const w = document.querySelector('.dz-odw'); if(!w) return 'немає вікна';
  w.querySelector('input[value="off"]').click(); w.dispatchEvent(new Event('change'));
  w.querySelector('[data-od-sum]').value = '700'; w.querySelector('[data-od-note]').value = 'готівка в офісі';
  w.querySelector('[data-od-go]').click(); return 'ok'; });
await ЖДИ(900);
const п1 = await стан('2000912');
ok(пз === 'ok' && п1.od && п1.od.how === 'off' && п1.od.sum === 700 && п1.due === 0 && п1.pays === 2 && п1.prod === 'done',
  'оплату 700 ₴ записано поза системою: борг 0, картка «Виконано»', JSON.stringify(п1));
ok(п1.audit.includes('owner_off'), 'Звірка: пункт «виконано вручну — оплата поза системою»', JSON.stringify(п1.audit));

console.log('');
console.log('═══ 5. «БОРГ ЛИШАЄТЬСЯ» — ВИКОНАНО, А БОРГ ВИДНО ═══');
await дошка('acct');
await тягни('2000913', 'shipped');
await ЖДИ(200);
await p.evaluate(() => { const w = document.querySelector('.dz-odw'); w.querySelector('input[value="debt"]').click(); w.querySelector('[data-od-go]').click(); });
await ЖДИ(900);
const б1 = await стан('2000913');
ok(б1.od && б1.od.how === 'debt' && б1.due === 700 && б1.chain === 'shipped' && б1.pays === 1, 'виконано, борг 700 ₴ лишився, оплат не додано', JSON.stringify(б1));

console.log('');
console.log('═══ 6. ВЛАСНИК → «ВІДМОВА» ПЕРЕТЯГУВАННЯМ — З ПРИЧИНОЮ ═══');
await дошка('acct');
await тягни('2000913', 'refused');
await ЖДИ(200);
await p.evaluate(() => { const w = document.querySelector('.dz-refw:not(.dz-odw)'); w.querySelector('input[value="pay"]').click(); w.querySelector('[data-ref-go]').click(); });
await ЖДИ(900);
const р1 = await стан('2000913');
await дошка('acct');
const р2 = await стан('2000913');
ok(р1.status === 'cancel' && !р1.od && р2.col === 'refused', 'відмова з причиною: статус cancel, «Виконано вручну» знято, картка в «Відмова»', JSON.stringify(р2));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'власник ставить картку куди хоче — однаково в усіх, гроші чесно');
process.exit(bad ? 1 : 0);
