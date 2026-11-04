import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const PORT = 9171;
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

const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.__Q=[];\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
/* Кожен запит до колекції — у журнал: що саме тягнула сторінка. */
fbstub = fbstub.replace("Col.prototype.get=function(){ return Promise.resolve({ docs:[], forEach:function(){}, empty:true }); };",
  "Col.prototype.get=function(){ window.__Q.push(this.__n + ':get'); return new Promise(function(r){ setTimeout(function(){ r({ docs:[], forEach:function(){}, empty:true, size:0 }); }, 30); }); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ window.__Q.push(this.__col + '/' + this.__id + ':get'); return Promise.resolve(new Snap(this.__id||'x', null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);

const N_B2C = +(process.env.NB2C || 1200), N_B2B = +(process.env.NB2B || 400), N_PAY = +(process.env.NPAY || 5000);
await p.evaluate(({ N_B2C, N_B2B, N_PAY }) => {
  const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
  payWatching = true; payLoaded = true;
  contentData.fin = Object.assign({}, contentData.fin, { accounts:[{ id:'a1', name:'Моно', bank:'mono', start: 5000 }, { id:'np1', name:'НП', bank:'np' }] });
  orders.length = 0; payments.length = 0;
  const day = i => new Date(Date.now() - (i % 120) * 864e5 - i * 1000).toISOString();
  for(let i = 0; i < N_B2C; i++){
    const id = String(5000001 + i), at = day(i);
    orders.push({ id:'c' + i, orderId:id, dir:'b2c', status: i % 9 ? 'b2c-new' : 'cancel', source:'B2C', crmChatId:'c' + i, createdAt: at, touchedAt: at,
      totalPrice: 1500 + (i % 7) * 300, ttn: i % 3 ? '2045' + String(1000000000 + i) : '', ttnCod: 800,
      items:[{ name:'Худі', qty:1 + i % 3, unitPrice:900, price:900 * (1 + i % 3), cost:500 }], payments:[{ at, sum: 500, kind:'prepay', payId:'p' + i }] });
    designJobs[id] = { orderId:id, units:[{ id:'u' + i, gid:'hoodie', name:'Худі', qty:1 + i % 3, graphic:[], stitch:[] }], updatedAt: at };
  }
  for(let i = 0; i < N_B2B; i++){
    const at = day(i * 3);
    orders.push({ id:'b' + i, orderId:String(1000001 + i), status: ['paid','prod','done','kp','lead'][i % 5], source:'сайт', createdAt: at, touchedAt: at,
      totalPrice: 10000 + i * 10, totalCost: 6000, items:[{ name:'Футболка', qty:50, unitPrice:200, price:10000, cost:6000 }], payments:[{ at, sum: 4000, kind:'prepay' }] });
  }
  for(let i = 0; i < N_PAY; i++){
    const at = day(i);
    payments.push({ id:'p' + i, at, amount: i % 11 ? 500 + (i % 9) * 100 : -300, acc: i % 4 ? 'a1' : 'np1', src: i % 4 ? 'mono' : 'np',
      orderId: i < N_B2C ? String(5000001 + i) : (i % 5 ? '' : String(1000001 + (i % N_B2B))), tag: i % 2 ? 'prepay' : 'cod',
      ttn: i % 4 ? '' : '2045' + String(1000000000 + i), counter:'Клієнт ' + i });
  }
  archLoad = async () => 1;
}, { N_B2C, N_B2B, N_PAY });

await p.waitForTimeout(800);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
for(const [sel, label] of [['[data-view="analytics"]', 'Аналітика'], ['#an-tabs [data-an-top="b2c"]', 'B2C']]){
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await p.evaluate(sel => new Promise(r => { document.querySelector(sel).click(); setTimeout(r, 0); }), sel);
  await p.evaluate(() => new Promise(r => setTimeout(r, 50)));
  const dt = Date.now() - t0;
  const { profile } = await cdp.send('Profiler.stop');
  const self = {}; const byId = {}; profile.nodes.forEach(n => byId[n.id] = n);
  const dts = profile.timeDeltas; const cnt = {};
  profile.samples.forEach((id, k) => { cnt[id] = (cnt[id] || 0) + (dts[k] || 0); });
  Object.keys(cnt).forEach(id => { const n = byId[id]; const f = n.callFrame; const key = (f.functionName || '(anon)') + ' :' + (f.lineNumber + 1) + ' ' + String(f.url).split('/').pop().split('?')[0]; self[key] = (self[key] || 0) + cnt[id]; });
  console.log('== ' + label + ': ' + dt + ' мс');
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log('   ' + String(Math.round(v / 1000)).padStart(6) + ' мс  ' + k));
}
console.log('помилки:', JSON.stringify(errs.slice(0, 5)));
await browser.close(); srv.close();
