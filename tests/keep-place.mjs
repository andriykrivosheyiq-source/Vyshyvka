/* НІЩО НЕ ВІДКОЧУЄТЬСЯ НА ПОЧАТОК (22.10).

   Андрій: «кручу скрипти, і вони пригають — і в B2B, і в B2C» і «коли
   закриваємо картку клієнта, перекидає на самий початок воронок… кожен раз
   шукати, де зупинився».

   1. Панель скриптів у вікні розмови тримає прокрутку, хоч вікно
      перемальовується на кожному такті опитування.
   2. Дошка B2C після закриття картки стоїть там, де стояла до відкриття
      (убік і в колонці), — і на широкому екрані, і на планшеті. B2B теж.

   Запуск:  node tests/keep-place.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8955;
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

console.log('═══ 1. СКРИПТИ НЕ СТРИБАЮТЬ ═══');
await p.evaluate(() => {
  contentData.quickReplies = Array.from({ length: 30 }, (_, i) => ({ t: 'Скрипт ' + (i + 1), m: 'Текст заготовки ' + (i + 1), dir: i % 2 ? 'b2b' : 'b2c' }));
  const o = orders.find(x => x.orderId === '2000301');
  crmChat[o.id] = { chatId: 'c1', clientName: 'Асія', msgs: [] };
  chatOpen(o, 'crm');
});
await ЖДИ(300);
const qr = await p.evaluate(async () => {
  chatWin.qr = true; renderChatWin();
  const el = () => document.querySelector('#chatWin .cw-qr');
  const e0 = el(); if(!e0) return { err: 'немає панелі скриптів' };
  if(e0.scrollHeight <= e0.clientHeight + 5) return { err: 'панель не прокручується', h: e0.scrollHeight, c: e0.clientHeight };
  e0.scrollTop = 120;
  renderChatWin();             // такт опитування
  await new Promise(r => setTimeout(r, 50));
  renderChatWin(true);         // нове повідомлення, стрічка вниз
  return { top: el().scrollTop };
});
ok(!qr.err && Math.abs(qr.top - 120) <= 2, 'прокрутили скрипти — вікно перемалювалось двічі, а вони там само', JSON.stringify(qr));
await p.evaluate(() => { try{ chatClose(); }catch(e){} });

console.log('');
console.log('═══ 2. ЗАКРИВ КАРТКУ B2C — ДОШКА ТАМ, ДЕ БУЛА ═══');
for(const vp of [{ width:1500, height:900 }, { width:1180, height:820 }]){
  await p.setViewportSize(vp);
  const r = await p.evaluate(async () => {
    const U = window.LQDesign.ui;
    for(let i = 0; i < 12; i++){
      const id = String(2000400 + i);
      if(!orders.find(o => o.orderId === id)) orders.push({ id:'x' + i, orderId:id, type:'client', dir:'b2c', name:'К' + i, status:'prorahunok', site:'main',
        payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-1' + (i % 9) + 'T09:00:00.000Z', crmChatId:'c' + i, items:[] });
      if(!designJobs[id]){ const j = designJobMake(id); j.no = String(2000100 + i);
        j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'x' })];
        if(i % 3 === 1) j.queue = { at: new Date().toISOString() }; }
    }
    document.querySelector('.nav button[data-view="design"]').click();
    U.setTab('acct'); U.open(''); U.render(document.getElementById('dzRoot'));
    await new Promise(r => setTimeout(r, 150));
    const bd = document.querySelector('#dzRoot .dz-boards');
    bd.scrollLeft = 600;
    const було = bd.scrollLeft;
    const card = [...document.querySelectorAll('#dzRoot [data-open]')].find(c => c.getBoundingClientRect().left > 300) || document.querySelector('#dzRoot [data-open]');
    card.click();
    await new Promise(r => setTimeout(r, 400));
    const x = document.querySelector('#dzRoot .dz-panel .dz-x, #dzRoot .dz-panel [data-do="close"]');
    if(x) x.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape' }));
    await new Promise(r => setTimeout(r, 400));
    return { було, стало: document.querySelector('#dzRoot .dz-boards').scrollLeft, closed: !document.querySelector('#dzRoot .dz-panel:not(.hide)') };
  });
  ok(r.closed && r.було > 0 && Math.abs(r.стало - r.було) <= 2, vp.width + 'px: відкрив і закрив картку — дошка B2C на тому самому місці (' + r.було + ')', vp.width + 'px: ' + JSON.stringify(r));
}

console.log('');
console.log('═══ 3. B2B — ТЕЖ НА МІСЦІ ═══');
await p.setViewportSize({ width:1500, height:900 });
const b = await p.evaluate(async () => {
  for(let i = 0; i < 24; i++){
    const id = String(1000400 + i);
    const st = ['lead','prorahunok','kp','waitpay','paid','production','done'][i % 7];
    if(!orders.find(o => o.orderId === id)) orders.push({ id:'b' + i, orderId:id, type:'client', name:'Б' + i, status:st, site:'main', payments:[], hist:[],
      createdAt:'2026-10-1' + (i % 9) + 'T09:00:00.000Z', totalPrice:1000, items:[{ kind:'main', name:'Худі', qty:1 }] });
  }
  document.querySelector('.nav button[data-view="board"]').click();
  await new Promise(r => setTimeout(r, 300));
  renderBoard();
  const bd = document.getElementById('board'); bd.scrollLeft = 600; const було = bd.scrollLeft;
  const t = [...document.querySelectorAll('#board .ticket')].find(c => c.getBoundingClientRect().left > 300 && c.getBoundingClientRect().left < innerWidth - 100);
  t.click(); await new Promise(r => setTimeout(r, 500));
  closeOrderDrawer(); await new Promise(r => setTimeout(r, 500));
  return { було, стало: document.getElementById('board').scrollLeft };
});
ok(b.було > 0 && Math.abs(b.стало - b.було) <= 2, 'B2B: відкрив і закрив картку — дошка на тому самому місці', JSON.stringify(b));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'скрипти й дошки лишаються там, де людина їх лишила');
process.exit(bad ? 1 : 0);
