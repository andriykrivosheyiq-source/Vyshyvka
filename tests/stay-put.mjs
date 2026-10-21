/* СТОРОЖ РОЗДІЛІВ (21.10). Андрій: «вибиває із замовлення… щоб при заході
   будь-куди проводили великий тест, щоб нас ніде ні звідки не вибивало».

   Правило: ФОНОВЕ ОНОВЛЕННЯ НЕ РУХАЄ ЛЮДИНУ. Поки менеджер у розділі, у
   картці, у конструкторі чи в діалозі, жоден знімок бази (контент, картки,
   присутність), жоден лічильник і жодна чужа правка не мають права
   перемкнути розділ, закрити картку чи перезавантажити конструктор.

   Тест заходить у кожен розділ (менеджером B2B і власником), відкриває
   картку й конструктор, а тоді «трусить» сторінку всім, що відбувається у
   фоні, — і перевіряє, що все лишилось, як було. Запускається з
   pre-commit на кожну зміну адмінки.

   Запуск:  node tests/stay-put.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8992;
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

/* Менеджер B2B з доступами «після 20.10»: лише дошка й чати. Саме з таким
   набором «Прорахунок» не входив у nav, і фонове оновлення викидало з нього. */
const CONTENT = { team:[{ email:'test@loomiq', name:'Марія', role:'manager' }, { email:'own@loomiq', name:'Андрій', role:'owner' }],
  rolesSeed: 1, roles: [{ key:'manager', name:'Менеджер B2B', nav:['board','chats'], boards:'*', see:['client','chat'],
    can:['new','edit','stage','assign','pay','write','files','quick','bind','art'] }] };
const ORDERS = [{ id:'o148', orderId:'1000148', type:'client', name:'Aisha', instagram:'aisha', status:'prorahunok', site:'main',
  payments:[], hist:[], createdAt:'2026-10-20T20:32:00.000Z', items:[] },
  { id:'b1', orderId:'2000101', type:'client', dir:'b2c', name:'Оля', status:'prorahunok', site:'main', crmChatId:'c1',
    payments:[{ at:'2026-10-20T09:00:00.000Z', sum:300, kind:'prepay', by:'test' }], hist:[], createdAt:'2026-10-20T09:00:00.000Z', items:[] }];

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

/* Усе, що адмінка робить сама у фоні. Саме це й вибивало: знімок документа
   контенту → applyRoleUi; знімок карток → renderBoard / calcRestore /
   calcSoloReturn; присутність → renderOrderDrawer; доведення заготовок і
   ролей; перевірка збірки. Кілька разів поспіль — як у житті. */
const ТРУСИТИ = `(async () => {
  for(let i = 0; i < 3; i++){
    try{ applyRoleUi(); }catch(e){ console.error('applyRoleUi', e); }
    try{ renderBoard(); }catch(e){}
    try{ calcRestore(); }catch(e){}
    try{ await calcSoloReturn(); }catch(e){}
    try{ if(drawerOrderId) renderOrderDrawer(); }catch(e){}
    try{ paintCalcTarget(); }catch(e){}
    try{ await rolesSeedOnce(); }catch(e){}
    try{ await qrSeedOnce(); }catch(e){}
    try{ bgCountAdd('simple'); }catch(e){}
    try{ loadStatuses(); loadTracks(); }catch(e){}
    try{ navGrpSync(); }catch(e){}
    await new Promise(r => setTimeout(r, 120));
  }
})()`;
const ДЕ = `(() => ({
  view: (document.querySelector('.nav button[data-view].active') || {}).dataset ? document.querySelector('.nav button[data-view].active').dataset.view : '',
  drawer: !!document.querySelector('#orderDrawer.open'), drawerId: typeof drawerOrderId !== 'undefined' ? drawerOrderId : null,
  calc: typeof calcTarget !== 'undefined' ? calcTarget : null,
  frame: (document.getElementById('calc-only-frame') || {}).getAttribute ? (document.getElementById('calc-only-frame').getAttribute('src') || '') : '',
  chat: (typeof chatWin !== 'undefined' && chatWin) ? chatWin.id : null,
  dzOpen: (window.LQDesign && window.LQDesign.ui.tabOpen) ? window.LQDesign.ui.tabOpen() : ''
}))()`;
const same = (a, b, keys) => keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));

async function перевірити(назва, keys){
  const до = await p.evaluate(ДЕ);
  await p.evaluate(ТРУСИТИ);
  await p.waitForTimeout(400);
  const після = await p.evaluate(ДЕ);
  ok(same(до, після, keys), назва + ' — на місці (' + keys.map(k => k + ':' + JSON.stringify(після[k])).join(', ') + ')',
     назва + ' — ВИБИЛО: було ' + JSON.stringify(до) + ', стало ' + JSON.stringify(після));
}
const розділ = async v => { await p.evaluate(v => { const b = document.querySelector('.nav button[data-view="' + v + '"]'); if(b) b.click(); }, v); await p.waitForTimeout(500); };

console.log('═══ 1. МЕНЕДЖЕР B2B (доступи: дошка й чати) ═══');
const хто = await p.evaluate(() => ({ role: myRole(), nav: (myAcc() || {}).nav }));
console.log('  ' + JSON.stringify(хто));
ok(хто.role === 'manager' && Array.isArray(хто.nav) && хто.nav.indexOf('calc') < 0, 'тест іде менеджером з обмеженим меню (без «calc» у nav)', JSON.stringify(хто));

await розділ('board');
await перевірити('дошка B2B', ['view']);
await p.evaluate(() => openOrderDrawer(orders.find(o => o.id === 'o148'))); await p.waitForTimeout(600);
await перевірити('відкрита картка 1000148', ['view', 'drawer', 'drawerId']);
await p.evaluate(() => openCalcFor(orders.find(o => o.id === 'o148'))); await p.waitForTimeout(1500);
const уКонстр = await p.evaluate(ДЕ);
ok(уКонстр.view === 'calc' && /index\.html\?manager=1/.test(уКонстр.frame), 'конструктор відкрито з картки (розділ calc, iframe живий)', JSON.stringify(уКонстр));
await перевірити('конструктор КП (Gemini пише лічильник, хтось міняє картки…)', ['view', 'calc', 'frame']);
await розділ('chats');
await перевірити('чати B2B', ['view']);
await p.evaluate(() => { try{ chatOpen(orders.find(o => o.id === 'o148'), 'crm'); }catch(e){} }); await p.waitForTimeout(800);
await перевірити('відкритий діалог', ['view', 'chat']);

console.log('═══ 2. ВЛАСНИК: УСІ РОЗДІЛИ ═══');
await p.evaluate(() => { contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x); applyRoleUi(); });
await p.waitForTimeout(300);
for(const v of ['board', 'chats', 'design', 'chatsc', 'analytics', 'dash', 'fin', 'problems', 'settings']){
  await розділ(v);
  const є = await p.evaluate(v => (document.querySelector('.nav button[data-view="' + v + '"].active') || {}).dataset ? true : false, v);
  if(!є){ console.log('  (розділ ' + v + ' не відкрився — пропускаю)'); continue; }
  await перевірити('розділ ' + v, ['view']);
}
await розділ('design');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000101'); U.render(document.getElementById('dzRoot')); }); await p.waitForTimeout(500);
await перевірити('відкрита картка B2C у відділі', ['view', 'dzOpen']);
await розділ('board');
await p.evaluate(() => openCalcFor(orders.find(o => o.id === 'o148'))); await p.waitForTimeout(1500);
await перевірити('конструктор КП у власника', ['view', 'calc', 'frame']);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'нікуди не вибиває');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
