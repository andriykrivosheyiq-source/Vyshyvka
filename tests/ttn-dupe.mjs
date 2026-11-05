/* ОДИН ОДЯГ — ОДНА НАКЛАДНА (05.11, #2000198).

   Володимир: «замовили 1 одяг, а створено 4 накладних» — у клієнта чотири
   «Чекаємо на посилку від відправника» і «Сплатити всі посилки». Корінь:
   Нова пошта відповідала довше, ніж адмінка чекала, накладна лягала, а
   людині казали «спробуйте ще раз». Перевіряємо:
     A. воркер (підставна НП): перед створенням шукає ту саму накладну
        (опис, отримувач, відділення, контроль оплати, ще не передана) — є,
        віддає її, другої не створює; інша — створює; пошук упав — створює;
        op 'find' лише з входом; скасування за номером знаходить Ref;
     B. адмінка: довга відповідь — «могла створитись, перевіряю», знайшли —
        привʼязали, одне створення; не знайшли — 2 хв лише перевірка, без
        другого створення; з ТТН у картці — «Створити» не створює;
        «Перестворити» — спершу скасувати стару, не скасувалась — нової
        немає; «Видалити» не знімає живу в НП накладну мовчки; зайві —
        у «Стан системи» зі «Скасувати в НП».

   Запуск:  node tests/ttn-dupe.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8851;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const now = new Date().toISOString();
const ORDER = {
  id:'1', orderId:'1001101', type:'client', name:'Оксана Лисенко', phone:'+380670001101',
  status:'paid', site:'main', createdAt:now, hist:[], prodAt:now, dueAt:'2026-12-01',
  offerToken:'tok1',
  tracks:{ design:'ok', supply:'got', test:'ok', prod:'done', qc:'ok', ship:'wait' },
  art:[{ n:2, at:now, by:'d@loomiq', files:[{ kind:'front', name:'f', url:'https://x/f.dst' }],
         wilcom:'https://x/w.png', photo:'https://x/t.jpg',
         approvals:{ art:{ by:'a@loomiq', at:now }, inner:{ by:'a@loomiq', at:now },
                     client:{ by:'a@loomiq', at:now } } }],
  payments:[{ at:now, sum:25000, kind:'prepay', by:'a@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:50,
           sizeQty:{ S:10, M:20, L:20 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }],
                  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'},{size:'L'}] } };

function stub(np){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  const c = Object.assign({}, CONTENT, np ? { bgApi:{ npUrl:'https://np.example/w' } } : {});
  s = s.replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
    '  window.__CONTENT=' + JSON.stringify(c) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace(
    "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(src){ this.__src=src; }\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
    '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
    '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
    '      var c=new Col(); c.__n=n; return c; },');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(np){
  const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  p.on('dialog', d => d.accept());
  const body = stub(np);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  return p;
}



console.log('═══ A. ВОРКЕР: ТА САМА НАКЛАДНА — ДРУГОЇ НЕМАЄ ═══');
const NPW = { list: [], track: {}, calls: [], listFail: '' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = b => new Response(JSON.stringify(b), { status: 200 });
  if(url.includes('identitytoolkit.googleapis.com')){
    const b = JSON.parse(opt.body);
    return b.idToken === 'good' ? res({ users: [{ localId: 'u1', email: 'test@loomiq' }] }) : new Response(JSON.stringify({ error: { message: 'INVALID_ID_TOKEN' } }), { status: 400 });
  }
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body); NPW.calls.push(b);
    const m = b.methodProperties || {};
    if(b.calledMethod === 'getCounterparties') return res({ success: true, data: [{ Ref: 'CP', Description: 'ФОП' }] });
    if(b.calledMethod === 'getCounterpartyContactPersons') return res({ success: true, data: [{ Ref: 'CT', Description: 'К', Phones: '380631112233' }] });
    if(b.calledMethod === 'save' && b.modelName === 'Counterparty') return res({ success: true, data: [{ Ref: 'RC', ContactPerson: { success: true, data: [{ Ref: 'RCP' }] } }] });
    if(b.calledMethod === 'getDocumentList') return NPW.listFail ? res({ success: false, errors: [NPW.listFail] }) : res({ success: true, data: NPW.list });
    if(b.calledMethod === 'getStatusDocuments') return res({ success: true, data: (m.Documents || []).map(d => NPW.track[d.DocumentNumber]).filter(Boolean) });
    if(b.calledMethod === 'save') return res({ success: true, data: [{ IntDocNumber: '20450000000999', Ref: 'NEW', CostOnSite: 80 }] });
    if(b.calledMethod === 'delete') return res({ success: true, data: [{ Ref: m.DocumentRefs }] });
    return res({ success: true, data: [] });
  }
  return realFetch(url, opt);
};
const W = (await import(path.join(ROOT, 'worker/novaposhta-proxy.js'))).default;
const wenv = { NP_KEY_yuk: 'KEY-Y', ALLOWED_ORIGINS: 'https://loomiq.net' };
const wcall = body => W.fetch(new Request('https://np.test/', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://loomiq.net' },
  body: JSON.stringify(body) }), wenv).then(async r => ({ status: r.status, ...(await r.json()) }));
const WO = { sender: { id: 'yuk', cityRef: 'C', warehouseRef: 'WS', phone: '380636855494' }, name: 'Мороз Євгенія', phone: '+380688323228', qty: 1,
  weightKg: 0.5, cost: 1200, cod: 700, cityRef: 'CK', warehouseRef: 'WH-K-1', description: '#2000198', payer: 'recipient' };
const saves = () => NPW.calls.filter(c => c.calledMethod === 'save' && c.modelName === 'InternetDocument').length;
const тр = (n, x) => Object.assign({ Number: n, StatusCode: '1', CargoDescriptionString: '#2000198', PhoneRecipient: '380688323228', WarehouseRecipientRef: 'WH-K-1', DateCreated: '05.11.2026 10:0' + n.slice(-1) }, x || {});
NPW.list = [{ IntDocNumber: '20450000000111', Ref: 'R111', CostOnSite: 70, AfterpaymentOnGoodsCost: '700' }, { IntDocNumber: '20450000000112', Ref: 'R112', AfterpaymentOnGoodsCost: '700' }];
NPW.track = { '20450000000111': тр('20450000000111'), '20450000000112': тр('20450000000112') };
let w1 = await wcall({ op: 'create', order: WO, idToken: 'good' });
ok(w1.ok && w1.ttn === '20450000000111' && w1.ref === 'R111' && w1.again && saves() === 0 && (w1.dupes || []).map(x => x.ttn).join() === '20450000000112',
  'та сама (опис, телефон, відділення, контроль 700) уже є — віддано найранішу, нової немає; ще одна така — у dupes', JSON.stringify(w1));
NPW.calls.length = 0;
let w2 = await wcall({ op: 'create', order: Object.assign({}, WO, { description: '#2000199' }), idToken: 'good' });
ok(w2.ok && w2.ttn === '20450000000999' && !w2.again && saves() === 1, 'інший номер замовлення — нова накладна', JSON.stringify(w2));
NPW.calls.length = 0;
NPW.track['20450000000111'] = тр('20450000000111', { StatusCode: '7' }); NPW.track['20450000000112'] = тр('20450000000112', { StatusCode: '102' });
let w3 = await wcall({ op: 'create', order: WO, idToken: 'good' });
ok(w3.ok && w3.ttn === '20450000000999' && saves() === 1, 'ті, що вже передані чи скасовані (стан не 1), не рахуються — нова', JSON.stringify(w3));
NPW.calls.length = 0;
NPW.track = { '20450000000111': тр('20450000000111', { WarehouseRecipientRef: 'WH-INSHE' }) };
NPW.list = [NPW.list[0]];
let w4 = await wcall({ op: 'create', order: WO, idToken: 'good' });
ok(w4.ok && w4.ttn === '20450000000999' && saves() === 1 && (w4.other || []).map(x => x.ttn).join() === '20450000000111',
  'відділення змінили — нова накладна, а стара з тим самим описом — в other (зайва)', JSON.stringify(w4));
NPW.calls.length = 0;
NPW.track = { '20450000000111': { Number: '20450000000111', StatusCode: '1' } };
let w5 = await wcall({ op: 'create', order: WO, idToken: 'good' });
ok(w5.ok && w5.ttn === '20450000000999' && saves() === 1, 'опису ніде немає — дублем не вважаємо, створюємо як доти', JSON.stringify(w5));
NPW.calls.length = 0; NPW.listFail = 'To many requests';
let w6 = await wcall({ op: 'create', order: WO, idToken: 'good' });
ok(w6.ok && w6.ttn === '20450000000999' && saves() === 1, 'пошук упав — накладна однаково створюється (відправку не зупиняємо)', JSON.stringify(w6));
NPW.listFail = '';
NPW.track = { '20450000000111': тр('20450000000111') };
const f0 = await wcall({ op: 'find', order: WO });
const f1 = await wcall({ op: 'find', order: WO, idToken: 'good' });
ok(f0.status === 401 && f1.ok && (f1.same || []).map(x => x.ttn).join() === '20450000000111' && f1.checked === 1 && Array.isArray(f1.fields),
  'op find — лише з входом; знаходить ту саму, каже, скільки переглянув і які поля віддала НП', JSON.stringify([f0.status, f1]));
NPW.calls.length = 0;
const d1 = await wcall({ op: 'ttnDelete', ttn: '20450000000111', sender: 'yuk', idToken: 'good' });
const del = NPW.calls.filter(c => c.calledMethod === 'delete')[0];
ok(d1.ok && del && del.methodProperties.DocumentRefs === 'R111', 'скасування лише за номером — воркер сам знаходить Ref', JSON.stringify([d1, del && del.methodProperties]));
const d2 = await wcall({ op: 'ttnDelete', ttn: '20450000000555', sender: 'yuk', idToken: 'good' });
ok(!d2.ok && /не знайдено/.test(d2.error), 'номера немає серед накладних відправника — словами, а не тиша', JSON.stringify(d2));
globalThis.fetch = realFetch;


console.log('');
console.log('═══ B. АДМІНКА ═══');
const p = await open(true);
await p.evaluate(() => {
  window.__CALLS = []; window.__NP = { create: 'ok', find: [], findOk: true, del: 'ok', made: 0 };
  NP_CREATE_MS = 400; TTN_FIND_WAIT = [80, 80];
  const real = window.fetch;
  window.fetch = async (u, o) => {
    if(String(u).indexOf('np.example') < 0) return real(u, o);
    const b = JSON.parse(o.body);
    window.__CALLS.push(b.op);
    const J = d => new Response(JSON.stringify(d), { headers:{ 'Content-Type':'application/json' } });
    if(b.op === 'cities') return J({ ok:true, list:[{ ref:'c1', name:'Львів, Львівська обл.' }] });
    if(b.op === 'warehouses') return J({ ok:true, list:[{ ref:'w1', name:'Відділення №12', number:'12' }] });
    if(b.op === 'create'){
      const N = window.__NP;
      if(N.create === 'slow') return new Promise((_, rej) => { o.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); });
      if(N.create === 'fail') return J({ ok:false, error:'Невірний поштомат' });
      N.made++;
      return J(Object.assign({ ok:true, ttn:'2045000000' + (1000 + N.made), ref:'ref' + N.made }, N.extra || {}));
    }
    if(b.op === 'find') return window.__NP.findOk ? J({ ok:true, same: window.__NP.find, other: [] }) : J({ ok:false, error:'Невідома операція: find' });
    if(b.op === 'ttnDelete') return window.__NP.del === 'ok' ? J({ ok:true, ref: b.ref || '' }) : J({ ok:false, error:'Документ уже в дорозі' });
    if(b.op === 'track') return J({ ok:true, status:'', code:'1' });
    return J({ ok:false, error:'?' });
  };
});
await p.click('#board .ticket');
await p.waitForTimeout(900);
await p.evaluate(() => { odFolds.ship = true; renderOrderDrawer(); });
await p.waitForTimeout(400);
await p.fill('[data-shf-city]', 'Льв'); await p.waitForTimeout(900); await p.click('.ship-o');
await p.fill('[data-shf-wh]', '12'); await p.waitForTimeout(900); await p.click('.ship-o');
await p.waitForTimeout(300);
const O = () => p.evaluate(() => { const o = orders.find(x => x.orderId === '1001101'); return { ttn: o.ttn || '', ref: o.ttnRef || '', hist: o.ttnHist || [] }; });
const calls = () => p.evaluate(() => window.__CALLS.slice());
const clr = () => p.evaluate(() => { window.__CALLS.length = 0; });

console.log('— 1. довга відповідь, накладна лягла — знайдено й привʼязано, одне створення');
await p.evaluate(() => { window.__NP.create = 'slow'; window.__NP.find = []; });
await clr();
const t1 = p.evaluate(() => { window.__t1 = setTimeout(() => { window.__NP.find = [{ ttn:'20450000777001', ref:'R777' }]; }, 520); });
await p.click('[data-shf-make]');
await p.waitForTimeout(1600);
const s1 = await O(), c1 = await calls();
console.log('   ' + JSON.stringify({ s1, c1 }));
ok(s1.ttn === '20450000777001' && s1.ref === 'R777' && c1.filter(x => x === 'create').length === 1 && c1.indexOf('find') > c1.indexOf('create'),
  'НП не дочекались — перевірили (find), накладну знайдено й привʼязано, створення одне', JSON.stringify({ s1, c1 }));

console.log('— 2. з ТТН у картці «Створити ТТН» нічого не створює');
await clr();
await p.evaluate(() => { const o = orders.find(x => x.orderId === '1001101'); const t = o.ttn; o.ttn = ''; renderOrderDrawer(); o.ttn = t; });
await p.waitForTimeout(300);
await p.click('[data-shf-make]'); await p.waitForTimeout(500);
const c2 = await calls();
ok(!c2.includes('create') && (await O()).ttn === '20450000777001', 'накладна вже є — запиту на створення немає (лише «✕ Видалити ТТН», тоді створити)', JSON.stringify(c2));

console.log('— 3. довга відповідь і накладної не видно — 2 хв лише перевірка, другої немає');
await p.evaluate(() => { const o = orders.find(x => x.orderId === '1001101'); o.ttn = ''; delete o.ttnRef; window.__NP.find = []; renderOrderDrawer(); });
await p.waitForTimeout(300);
await clr();
await p.click('[data-shf-make]'); await p.waitForTimeout(1500);
const s3 = await p.evaluate(() => { const f = document.querySelector('[data-ttn-fail]'), b = document.querySelector('[data-shf-make]');
  return { fail: f ? f.textContent.trim() : '', btn: b ? b.textContent.trim() : '' }; });
console.log('   ' + JSON.stringify(s3));
ok(/^НЕ ЯСНО, ЧИ СТВОРЕНО · \d\d:\d\d: Нова пошта довго відповідала — накладна могла створитись/.test(s3.fail) && !/спробуйте ще раз/.test(s3.fail) && s3.btn === 'Перевірити, чи накладна створилась',
  'не «спробуйте ще раз», а «могла створитись»; кнопка — «Перевірити, чи накладна створилась»', JSON.stringify(s3));
await p.evaluate(() => { window.__NP.create = 'ok'; });
await clr();
await p.click('[data-shf-make]'); await p.waitForTimeout(700);
const c3 = await calls(), s3b = await O();
ok(!c3.includes('create') && c3.includes('find') && !s3b.ttn, 'натиснули ще раз у межах 2 хв — лише перевірка, нового створення немає', JSON.stringify(c3));
await p.evaluate(() => { window.__NP.find = [{ ttn:'20450000777002', ref:'R778' }]; });
await clr();
await p.click('[data-shf-make]'); await p.waitForTimeout(700);
const c3c = await calls(), s3c = await O();
ok(s3c.ttn === '20450000777002' && !c3c.includes('create'), 'накладна зʼявилась у НП — наступне натискання привʼязало її, не створюючи', JSON.stringify({ c3c, s3c }));

console.log('— 4. через 2 хв і перевірити не можна (воркер старий) — лише після питання');
await p.evaluate(() => { const o = orders.find(x => x.orderId === '1001101'); o.ttn = ''; delete o.ttnRef;
  TTN_SLOW[ttnSlowKey(o, 1)] = Date.now() - 130000; window.__NP.findOk = false; window.__dlg = [];
  renderOrderDrawer(); });
p.removeAllListeners('dialog'); p.on('dialog', d => { p.evaluate(m => window.__dlg.push(m), d.message()).catch(() => {}); d.accept(); });
await p.waitForTimeout(300);
await clr();
await p.click('[data-shf-make]'); await p.waitForTimeout(900);
const c4 = await calls(), s4 = await O(), dl4 = await p.evaluate(() => window.__dlg.slice());
ok(c4.join() === 'find,create' && /^2045000000\d{4}$/.test(s4.ttn) && dl4.some(m => /Її там НЕМАЄ — створити нову\?/.test(m)),
  'перевірка неможлива — питаємо «у кабінеті НП її немає?», лише тоді створюємо', JSON.stringify({ c4, s4: s4.ttn, dl4 }));
await p.evaluate(() => { window.__NP.findOk = true; });

console.log('— 5. «Перестворити»: спершу скасувати; не скасувалась — нової немає');
await p.evaluate(() => { window.__NP.del = 'no'; });
await clr();
const r5 = await p.evaluate(async () => shipTtnRemake(orders.find(x => x.orderId === '1001101')));
const c5 = await calls(), s5 = await O();
ok(/^стару накладну 2045000000\d{4} не вдалось скасувати в Новій пошті .*Нову не створено/.test(r5) && !c5.includes('create') && s5.ttn === s4.ttn,
  'НП не скасувала стару — нової не створено, стара в картці, підказка «скасуйте… тоді ✕ Видалити ТТН і Створити ТТН»', JSON.stringify({ r5, c5 }));
await p.evaluate(() => { window.__NP.del = 'ok'; });
await clr();
const r5b = await p.evaluate(async () => shipTtnRemake(orders.find(x => x.orderId === '1001101')));
const c5b = await calls(), s5b = await O();
const h5 = s5b.hist.filter(x => x.ttn === s4.ttn).pop() || {};
ok(r5b === true && c5b.indexOf('ttnDelete') >= 0 && c5b.indexOf('ttnDelete') < c5b.indexOf('create') && s5b.ttn && s5b.ttn !== s4.ttn &&
   h5.replaced && h5.npDel === true && h5.newTtn === s5b.ttn,
  'скасувалась — тоді нова; стара в історії «замінена, скасована» з номером нової', JSON.stringify({ c5b, s5b: s5b.ttn, h5 }));

console.log('— 6. «Видалити ТТН»: жива в НП мовчки з картки не зникає; зайві — у «Стан системи»');
await p.evaluate(() => { window.__NP.del = 'no'; });
const r6 = await p.evaluate(async () => shipTtnDelete(orders.find(x => x.orderId === '1001101')));
const s6 = await O();
ok(!r6.ok && r6.force && /не скасувалась/.test(r6.why) && s6.ttn === s5b.ttn, 'НП не скасувала — {force}, накладна лишилась у картці', JSON.stringify(r6));
const r6b = await p.evaluate(async () => shipTtnDelete(orders.find(x => x.orderId === '1001101'), { force: true }));
const s6b = await O();
const ex6 = await p.evaluate(() => window.__lqTtnExtra());
ok(r6b.ok && !s6b.ttn && ex6.some(x => x.ttn === s5b.ttn && /не скасована/.test(x.why)), 'людина підтвердила — з картки знято, а в «Стан системи» — зайва', JSON.stringify(ex6));
/* Зайві з відповіді воркера (dupes/other) — теж в історію й у «Стан системи». */
await p.evaluate(() => { window.__NP.del = 'ok'; window.__NP.create = 'ok';
  window.__NP.extra = { again: true, ttn: '20450000888001', ref: 'R881', dupes: [{ ttn: '20450000888002', ref: 'R882' }], other: [{ ttn: '20450000888003', ref: 'R883' }] }; renderOrderDrawer(); });
await p.waitForTimeout(300);
await p.click('[data-shf-make]'); await p.waitForTimeout(900);
const s6c = await O(), ex6c = await p.evaluate(() => window.__lqTtnExtra());
ok(s6c.ttn === '20450000888001' && ['20450000888002', '20450000888003'].every(t => ex6c.some(x => x.ttn === t && /зайвою/.test(x.why))) &&
   s6c.hist.filter(x => x.extra).every(x => x.npDel === false),
  'воркер віддав ту саму й ще дві з тим самим описом — головна в картці, дві в ttnHist як зайві (гроші за ними знайдуть картку)', JSON.stringify({ t: s6c.ttn, ex6c }));
await p.evaluate(() => { finHealthRows(); renderFinHealth(); });
const h6 = await p.evaluate(() => { const b = document.getElementById('fin-health'); return b ? b.innerHTML : ''; });
ok(/зайва накладна Нової пошти/.test(h6) && /data-xt-cancel/.test(h6) && /20450000888002/.test(h6), '«Стан системи»: «зайва накладна Нової пошти» зі «Скасувати в НП»', h6.slice(0, 300));
await p.evaluate(() => { window.__dlg = []; });
await clr();
await p.evaluate(() => document.querySelector('[data-xt-cancel][data-ttn="20450000888002"]').click()); await p.waitForTimeout(1500);
const ex6d = await p.evaluate(() => window.__lqTtnExtra()), c6d = await calls();
ok(c6d.includes('ttnDelete') && !ex6d.some(x => x.ttn === '20450000888002') && ex6d.some(x => x.ttn === '20450000888003'),
  '«Скасувати в НП» — скасовано, рядок зник; решта лишилась', JSON.stringify({ c6d, ex6d }));
await p.evaluate(() => document.querySelector('[data-xt-done][data-ttn="20450000888003"]').click()); await p.waitForTimeout(1500);
const ex6e = await p.evaluate(() => window.__lqTtnExtra());
ok(!ex6e.some(x => x.ttn === '20450000888003'), '«Уже скасовано» (зробили в кабінеті НП) — рядок зник', JSON.stringify(ex6e));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ одна накладна на одне замовлення');
process.exit(bad ? 1 : 0);
