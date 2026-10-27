/* ЗАСЛОНА «ВИЙШЛО ОНОВЛЕННЯ» (27.10).

   Андрій: «на весь екран усе заблюрюється і висить кнопка «Оновити», щоб
   ніхто не міг працювати в старій версії». Стара вкладка, що живе днями,
   пише картки старим кодом і затирає чужу роботу (#2000161). Перевіряємо:
   1. build.json з новішою збіркою (інший номер, пізніший час) — за кілька
      секунд заслона на весь екран, запис карток і картки відділу
      зупинено, кнопка «Оновити» перезавантажує повз кеш.
   2. build.json зі СТАРІШОЮ збіркою (кешований) — заслони немає; а в базі
      мітка старіша — вкладка кладе свою.
   3. Мітка новішої збірки приїхала з бази (loomiq/photos.build) — заслона
      миттєво, без опитування.

   Запуск:  node tests/upd-gate.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9165;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const html = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
const VER = (html.match(/LQ_VER = '([^']*)'/) || [])[1] || '';
const VER_AT = (html.match(/LQ_VER_AT = '([^']*)'/) || [])[1] || '';
ok(VER && VER !== 'dev' && /^\d{4}-/.test(VER_AT), 'сторінка знає номер і час збірки: ' + VER + ' · ' + VER_AT, 'збірку не проганяли: ' + JSON.stringify({ VER, VER_AT }));
const день = 864e5;
const пізніше = new Date(Date.parse(VER_AT) + день).toISOString().replace(/\.\d{3}Z$/, 'Z');
const раніше = new Date(Date.parse(VER_AT) - день).toISOString().replace(/\.\d{3}Z$/, 'Z');

const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
function stubWith(content){
  let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(content) + ';\n  window.__SETS=[];\n  window.firebase={');
  fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
    "Doc.prototype.set=function(d){ window.__SETS.push({ col:this.__col, id:this.__id, keys:Object.keys(d||{}), d: JSON.parse(JSON.stringify(d||{})) }); return Promise.resolve(); };");
  fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
    " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
  return fbstub;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function open(content, buildJson){
  const p = await browser.newPage({ viewport:{ width:1200, height:800 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  p.on('dialog', d => d.accept(''));
  const stub = stubWith(content);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: stub });
    if(/\/build\.json/.test(u)) return r.fulfill({ contentType:'application/json', body: JSON.stringify(buildJson) });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForFunction(() => typeof contentLoaded !== 'undefined' && contentLoaded, null, { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
    window.__TOASTS = []; const t0 = toast; toast = m => { window.__TOASTS.push(String(m)); try{ t0(m); }catch(e){} }; });
  return p;
}
const gate = p => p.evaluate(() => { const g = document.getElementById('upd-gate');
  return { on: !!g, shown: !!g && g.getBoundingClientRect().width > 0, full: !!g && g.getBoundingClientRect().width >= innerWidth - 2 && g.getBoundingClientRect().height >= innerHeight - 2,
    wait: document.body.classList.contains('upd-wait'), stale: window.LQ_UPD_STALE || '', btn: !!(g && g.querySelector('button')), txt: (g || {}).textContent || '' }; });

console.log('═══ 1. НОВІША ЗБІРКА В build.json — ЗАСЛОНА, ЗАПИС ЗУПИНЕНО, «ОНОВИТИ» ═══');
let p = await open(CONTENT, { v:'newer01', at: пізніше });
await p.waitForFunction(() => !!document.getElementById('upd-gate'), null, { timeout: 9000 }).catch(() => {});
let g = await gate(p);
ok(g.on && g.shown && g.full && g.wait && g.stale === 'newer01' && g.btn && /Вийшло оновлення/.test(g.txt), 'заслона на весь екран, лише «Оновити»', JSON.stringify(g));
let r = await p.evaluate(async () => {
  window.__SETS = [];
  orders.push({ id:'n1', orderId:'2000901', dir:'b2c', type:'client', name:'Тест', status:'prorahunok', site:'main', payments:[], hist:[], items:[], createdAt: new Date().toISOString(), touchedAt: new Date().toISOString(), totalPrice: 0 });
  const f = await saveOrders();
  let dz = '';
  try{ await designPut({ orderId:'2000901', updatedAt: new Date().toISOString() }); }catch(e){ dz = String(e.message || e); }
  return { f: (f || []).map(x => x.id), sets: window.__SETS.filter(s => s.col === 'kanbanOrders' || s.col === 'designJobs').length, toasts: window.__TOASTS.slice(), dz };
});
ok(r.sets === 0 && r.f.length === 1 && r.toasts.some(x => /Вийшло оновлення/.test(x)) && /оновлення/.test(r.dz), 'картка й картка відділу в базу не пишуться, людині сказано чому', JSON.stringify(r));
await Promise.all([p.waitForNavigation({ timeout: 8000 }).catch(() => {}), p.click('#upd-gate button')]);
ok(/v=newer01/.test(p.url()), '«Оновити» перезавантажує повз кеш: ' + p.url().replace(HOST, ''), 'не перезавантажило: ' + p.url());
await p.close();

console.log('═══ 2. СТАРІШИЙ build.json (КЕШ) — ЗАСЛОНИ НЕМАЄ; СВОЯ МІТКА ЙДЕ В БАЗУ ═══');
p = await open(Object.assign({}, CONTENT, { build:{ v:'older00', at: раніше } }), { v:'older00', at: раніше });
await p.waitForTimeout(6000);
g = await gate(p);
const stamp = await p.evaluate(() => (window.__SETS || []).filter(s => s.col === 'loomiq' && s.id === 'photos' && s.keys.indexOf('build') >= 0).map(s => s.d.build));
ok(!g.on && !g.stale, 'старіша збірка в build.json і в базі — свіжу вкладку не замикає', JSON.stringify(g));
ok(stamp.length === 1 && stamp[0].v === VER && stamp[0].at === VER_AT, 'свіжа вкладка поклала свою мітку в базу один раз', JSON.stringify(stamp));
await p.close();

console.log('═══ 3. МІТКА НОВІШОЇ ЗБІРКИ З БАЗИ — ЗАСЛОНА МИТТЄВО ═══');
p = await open(CONTENT, { v: VER, at: VER_AT });
await p.waitForTimeout(500);
g = await gate(p);
ok(!g.on, 'та сама збірка — заслони немає', JSON.stringify(g));
await p.evaluate(([v, at]) => { contentData.build = { v, at }; buildStampSync(); }, ['newer02', пізніше]);
g = await gate(p);
ok(g.on && g.shown && g.stale === 'newer02', 'мітка з бази опустила заслону одразу', JSON.stringify(g));
await p.close();

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'заслона оновлення: стара вкладка стоїть і не пише, свіжу не замикає');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
