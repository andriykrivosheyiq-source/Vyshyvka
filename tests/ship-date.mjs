/* ДАТА ВІДПРАВКИ: МЕНЕДЖЕР СТАВИТЬ, ЦЕХ БАЧИТЬ ЗА 3 РОБОЧІ ДНІ (25.10).

   Андрій: «менеджер ставить «відправити такого-то числа», підправити… за 2–3
   робочі дні, щоб побачити, що потрібно виготовити і відправити».
   1. Робочі дні: вихідні не рахуються.
   2. До дати ≤ 3 робочі дні — на плитці цеху й у шапці картки «виготовити й
      відправити до DD.MM» (жовтим); далі — «відправити до DD.MM»; минула —
      «прострочено відправку» (червоним).
   3. Уже в реєстрі / передано курʼєру — позначки немає.
   4. У менеджера в «Чекає погодження» — «Відправити до» з календарем (та
      сама дата, що й «📅 Відправити» в шапці).

   Запуск:  node tests/ship-date.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9151;
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
  team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  b2c: { dzHours: 24 }
};
const ORDERS = [
  { id:'1', orderId:'2000201', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'2', orderId:'2000202', type:'client', dir:'b2c', name:'Богдан', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] }
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
const ctx = await browser.newContext({ viewport:{ width:1500, height:940 }, acceptDownloads: true });
const p = await ctx.newPage();
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
await p.waitForTimeout(4000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });


const r = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui, root = document.getElementById('dzRoot');
  const t = ms => new Promise(z => setTimeout(z, ms));
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  openDesign();
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* Дата через N робочих днів від сьогодні. */
  const через = n => { const d = new Date(); d.setHours(12, 0, 0, 0); let k = 0; while(k < n){ d.setDate(d.getDate() + 1); if(d.getDay() !== 0 && d.getDay() !== 6) k++; } return iso(d); };
  const out = {};
  out.wd = [U.workDays(через(2)), U.workDays(через(5)), U.workDays(iso(new Date()))];
  const g = U.host.catalog().find(x => (x.colors || []).length && (x.sizes || []).length);
  const mk = (no, due, tracks, extra) => {
    if(!orders.find(o => o.orderId === no)) orders.push({ id: 's' + no, orderId: no, type:'client', dir:'b2c', name:'К', status:'prorahunok', site:'main', payments:[], hist:[], createdAt:'2026-10-20T10:00:00.000Z', totalPrice: 1000, items:[] });
    const o = orders.find(x => x.orderId === no);
    const j = designJobMake(no);
    j.units = [Object.assign(U.unitNew(), { gid: g.id, name: g.name, color: (g.colors[0].name || g.colors[0].id), size: g.sizes[0], qty: 1, note:'Лого' })];
    j.due = due; j.dueSet = true;
    o.tracks = Object.assign({}, tracks); Object.assign(o, extra || {});
    return { j, o };
  };
  const скоро = mk('2000401', через(2), { prod:'work' });
  const далеко = mk('2000402', через(8), { prod:'work' });
  const минула = mk('2000403', iso(new Date(Date.now() - 3 * 864e5)), { prod:'work' });
  const відпр = mk('2000404', через(1), { qc:'ok' }, { prodQc:{ at:'2026-10-24T10:00:00.000Z' }, reg:{ ref:'R', no:'1' } });
  const погодж = mk('2000405', через(4), { qc:'check' }, { prodQc:{ at:'2026-10-24T10:00:00.000Z', photos:['https://x/p.jpg'], note:'' } });
  out.info = [скоро, далеко, минула, відпр].map(x => { const s = U.shipInfo(x.j, D.prodAt(x.j, x.o)); return s ? (s.late ? 'late' : s.soon ? 'soon' : 'calm') + ':' + s.txt : 'немає'; });
  /* Плитка дошки цеху. */
  U.setTab('prod'); U.open(''); U.render(root); await t(300);
  const tile = no => { const b = document.querySelector('.dz-boards [data-open="' + no + '"]'); const w = b && b.closest('.dz-card-w');
    const e = w && w.querySelector('.dz-c-stk'); return e ? (e.classList.contains('late') ? 'late' : e.classList.contains('soon') ? 'soon' : 'calm') + ':' + e.textContent : 'немає'; };
  out.tiles = ['2000401', '2000402', '2000403'].map(tile);
  /* Шапка картки цеху. */
  U.open('2000401'); U.render(root); await t(200);
  const sh = document.querySelector('.dz-panel .dz-ship-due');
  out.head = sh ? (sh.classList.contains('soon') ? 'soon:' : '') + sh.textContent : 'немає';
  /* Менеджер у «Чекає погодження». */
  U.setTab('acct'); U.open('2000405'); U.render(root); await t(300);
  const set = document.querySelector('.dz-panel .dz-ship-set');
  out.acct = set ? set.textContent.replace(/\s+/g, ' ').trim() : 'немає';
  out.acctBtn = !!(set && set.querySelector('[data-cal="due"]'));
  out.hdr = ((document.querySelector('.dz-panel [data-cal="due"] span') || {}).textContent || '');
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(r.wd.join() === '2,5,0', 'робочі дні рахуються без вихідних: ' + r.wd.join(', '), 'робочі дні: ' + r.wd.join(','));
ok(/^soon:виготовити й відправити до /.test(r.info[0]) && /^calm:відправити до /.test(r.info[1]) && /^late:прострочено відправку/.test(r.info[2]) && r.info[3] === 'немає',
  '≤ 3 робочі дні — «виготовити й відправити до …»; далі — «відправити до …»; минула — прострочено; у реєстрі — нічого', JSON.stringify(r.info));
ok(/^soon:виготовити й відправити до /.test(r.tiles[0]) && /^calm:відправити до /.test(r.tiles[1]) && /^late:прострочено відправку/.test(r.tiles[2]),
  'на плитках дошки цеху — те саме (жовтим / спокійно / червоним)', JSON.stringify(r.tiles));
ok(/^soon:📦 виготовити й відправити до /.test(r.head), 'у шапці картки цеху — «📦 виготовити й відправити до …»', r.head);
ok(/Відправити/.test(r.acct) && /цех побачить/.test(r.acct) && r.acctBtn && /Відправити/.test(r.hdr),
  'у менеджера в «Чекає погодження» — «📅 Відправити» з календарем; у шапці — «📅 Відправити»', JSON.stringify({ a: r.acct, b: r.acctBtn, h: r.hdr }));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'дата відправки: менеджер ставить, цех бачить за 3 робочі дні');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
