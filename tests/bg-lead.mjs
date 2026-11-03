/* tests/bg-lead.mjs — ЕСТАФЕТА ФОНУ: У КАРТКИ ПИШЕ ОДНА ВКЛАДКА НА КОМАНДУ (03.11.2026).

   Буря 02–03.11 (Firestore: 3,5 млн читань і 228 тис. записів за день;
   журнал: rollback 686, save-retry 773): обхід чатів, фонова сума й статуси
   НП ішли з кожної вкладки кожної людини — ті самі поля тих самих карток,
   відмови бази за лічильником, повтори, рядки журналу в спільний документ.
   Стенд на дві вкладки (компʼютер і телефон) на спільній базі, з правилом
   лічильника, як у firestore.rules, і живими розмовами Sitniks:
     1. естафету тримає одна вкладка — компʼютер (`loomiq/bglead`);
     2. обхід розмов: відмов бази за лічильником немає, у картки пише лише
        тримач, у спільний документ (журнал) — майже нічого;
     3. нове повідомлення клієнта видно й у другій вкладці — знімком із бази;
     4. тримач зник (вкладку закрили) — естафету бере інша.
   Запуск: node tests/bg-lead.mjs (у pre-commit). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9187;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
let TICK = 0;
const N = 30;
const srv = createServer(async (req, res) => {
  if(req.url.indexOf('/crm/') === 0){
    const json = (b) => { res.writeHead(200, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    if(/\/messages/.test(req.url)) return json([]);
    const rows = [];
    for(let i = 0; i < N; i++){ const hot = i % 3 === 0;
      rows.push({ id: 'c' + i, chatId: 'c' + i, client: { clientName: 'Клієнт ' + i, userName: 'nick_' + i },
        lastMessage: { id: 'm' + i + '_' + (hot ? TICK : 0), text: 'Повідомлення ' + (hot ? TICK : 0),
          createdAt: new Date(Date.now() - (hot ? 1000 : 864e5)).toISOString(), sentBy: 'client' + i } }); }
    return json(rows);
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const b = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
const iso = d => new Date(Date.now() - d * 864e5).toISOString();
const ORDERS = Array.from({ length: N }, (_, i) => ({ id: '51' + String(10000 + i), orderId: String(2000100 + i), type:'client', dir:'b2c',
  name:'Клієнт ' + i, phone:'', status:'design', site:'main', createdAt: iso(3), touchedAt: iso(1), rev: 5, totalPrice: 1000,
  crmChatId: 'c' + i, crmChatName: 'Клієнт ' + i, crmNick: 'nick_' + i, ig: 'nick_' + i, tgUser: '', crmAt: iso(2), crmLast: 'старе', crmUnread: 0,
  items: [], hist: [], trackHist: [], payments: [], arch: false }));
const CONTENT = { bgApi: { sitniksUrl: HOST + '/crm' },
  team: [{ email:'owner@loomiq', name:'Андрій', role:'owner' }, { email:'prod@loomiq', name:'Паша', role:'owner' }], b2c: {}, ship: { senders: [] }, accessLog: [] };
const DB = new Map();
ORDERS.forEach(o => DB.set('kanbanOrders/' + o.id, JSON.parse(JSON.stringify(o))));
DB.set('loomiq/photos', JSON.parse(JSON.stringify(CONTENT)));
const W = {}, pages = [], errs = [];
const cnt = (k) => { W[k] = (W[k] || 0) + 1; };
const stubFor = (email) => {
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8').split('test@loomiq').join(email);
  s = s.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };', 'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace("Doc.prototype.collection=function(){ return new Col(); };", "Doc.prototype.collection=function(n){ var c=new Col(); c.__n=(this.__col||'?')+'/'+(this.__id||'?')+'/'+n; return c; };");
  s = s.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos'){ d=window.__CONTENT; (window.__PH_CB=window.__PH_CB||[]).push(cb); } else if(this.__col==='loomiq'){ var kk='loomiq/'+this.__id; (window.__DOC_CB=window.__DOC_CB||{})[kk]=(window.__DOC_CB[kk]||[]).concat([cb]); } try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'function mkSnap(list, changed){ var docs=list.map(function(o){ return new Snap(o.id,o); }); var ch=changed||list; return { docs:docs, size:docs.length, forEach:function(f){ docs.forEach(f); }, empty:!docs.length, metadata:{ fromCache:false, hasPendingWrites:false }, docChanges:function(){ return ch.map(function(o){ return { type: changed ? "modified" : "added", doc:new Snap(o.id,o) }; }); } }; }\n  window.__mkSnap=mkSnap;\n' +
    '  function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.__n="kanbanOrders";\n  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n  SeedCol.prototype.onSnapshot=function(cb){ window.__ORD_CB=cb; try{ cb(mkSnap(window.__ORDERS)); }catch(e){ console.error(e); } return function(){}; };\n' +
    "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(); var c=new Col(); c.__n=n; return c; },");
  s += `\n;(function(){ var f = window.firebase.firestore(); var DP = Object.getPrototypeOf(f.collection('x').doc('y'));
    var key = function(d){ return (d.__col || '?') + '/' + (d.__id || '?'); };
    DP.get = function(){ var k = key(this), id = this.__id; return window.__dbGet(k).then(function(v){ return { id: id, exists: !!v, data: function(){ return v ? JSON.parse(JSON.stringify(v)) : undefined; }, metadata: { fromCache: false } }; }); };
    DP.set = function(d, opt){ return window.__dbSet(key(this), JSON.parse(JSON.stringify(d || {})), !!(opt && opt.merge)); };
    DP.delete = function(){ return window.__dbSet(key(this), null, false); };
  })();\n`;
  return s;
};
let BC_PENDING = 0;
const broadcast = async (k, v) => { BC_PENDING++; try{ await broadcast0(k, v); } finally { BC_PENDING--; } };
const broadcast0 = async (k, v) => {
  const col = k.split('/')[0], id = k.split('/').slice(1).join('/');
  for(const pg of pages){
    if(pg.isClosed()) continue;
    await pg.evaluate(({ col, id, v }) => {
      try{
        if(col === 'kanbanOrders'){ const i = window.__ORDERS.findIndex(x => x.id === id); if(v){ if(i >= 0) window.__ORDERS[i] = v; else window.__ORDERS.push(v); if(window.__ORD_CB) window.__ORD_CB(window.__mkSnap(window.__ORDERS, [v])); } }
        else if(col === 'loomiq' && id === 'photos'){ window.__CONTENT = v; (window.__PH_CB || []).forEach(cb => { try{ cb({ id:'photos', exists:true, data:() => JSON.parse(JSON.stringify(v)), metadata:{ fromCache:false } }); }catch(e){} }); }
        else if(col === 'loomiq'){ ((window.__DOC_CB || {})['loomiq/' + id] || []).forEach(cb => { try{ cb({ id, exists: !!v, data:() => v ? JSON.parse(JSON.stringify(v)) : undefined, metadata:{ fromCache:false } }); }catch(e){} }); }
      }catch(e){ console.error('bc', e); }
    }, { col, id, v }).catch(() => {});
  }
};
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for(const [email, mob] of [['owner@loomiq', false], ['prod@loomiq', true]]){
  const ctx = await browser.newContext(mob ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' } : { viewport:{ width:1400, height:900 } });
  const p = await ctx.newPage();
  p.__who = email.split('@')[0];
  p.on('pageerror', e => errs.push(p.__who + ': ' + e.message.slice(0, 140)));
  p.on('console', m => { if(m.type() === 'error' && /bc|snapshot|знімок/i.test(m.text())) errs.push(p.__who + ' console: ' + m.text().slice(0, 200)); });
  p.on('dialog', d => d.accept(''));
  await p.addInitScript(() => { window.LQ_BG_TTL = 4000; window.LQ_BG_EVERY = 1500; });
  await p.exposeFunction('__dbGet', k => DB.get(k) || null);
  await p.exposeFunction('__dbSet', (k, v, merge) => {
    const cur = DB.get(k);
    const колонка = k.split('/').length > 2 ? 'hist' : k.split('/')[0] + (k.startsWith('loomiq/') ? '/' + k.split('/')[1] : '');
    if(v && /^kanbanOrders\/[^/]+$/.test(k) && cur && cur.rev != null && !(v.rev > cur.rev)){ cnt(p.__who + ' ВІДМОВА'); throw new Error('Missing or insufficient permissions. permission-denied'); }
    cnt(p.__who + ' ' + колонка);
    if(v === null) DB.delete(k); else DB.set(k, merge ? Object.assign({}, cur || {}, v) : v);
    setTimeout(() => broadcast(k, DB.get(k) || null), 60);
    return null;
  });
  const stub = stubFor(email);
  await p.route('**://**', r => { const u = r.request().url(); if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: stub }); if(u.startsWith(HOST)) return r.continue(); return r.abort(); });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  pages.push(p);
}
for(const p of pages) await p.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded, null, { timeout: 90000 });
for(const p of pages) await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; try{ clearInterval(crmSweepTimer); }catch(e){} });
await new Promise(r => setTimeout(r, 6000));
const lead = () => Promise.all(pages.filter(p => !p.isClosed()).map(p => p.evaluate(() => bgLead())));

console.log('═══ 1. ЕСТАФЕТА — ОДНА, У КОМПʼЮТЕРА ═══');
const l1 = await lead();
console.log('  ' + JSON.stringify({ компʼютер: l1[0], телефон: l1[1] }));
ok(l1[0] === true && l1[1] === false, 'естафету тримає компʼютер, телефон лише читає', 'естафета: ' + JSON.stringify(l1));

console.log('═══ 2. ОБХІД РОЗМОВ: БЕЗ ВІДМОВ, ПИШЕ ЛИШЕ ТРИМАЧ ═══');
Object.keys(W).forEach(k => delete W[k]);
for(let i = 0; i < 6; i++){
  TICK++;
  await Promise.all(pages.map(p => p.evaluate(() => crmSweepOnce()).catch(() => {})));
  await new Promise(r => setTimeout(r, 1200));
}
await new Promise(r => setTimeout(r, 1500));
console.log('  ' + JSON.stringify(W));
const відмов = (W['owner ВІДМОВА'] || 0) + (W['prod ВІДМОВА'] || 0);
ok(відмов === 0, 'шість обходів у двох вкладках — жодної відмови бази за лічильником', 'відмов: ' + відмов);
ok((W['owner kanbanOrders'] || 0) > 0 && !(W['prod kanbanOrders'] || 0), 'у картки пише лише тримач естафети', 'записи: ' + JSON.stringify(W));
ok(((W['owner loomiq/photos'] || 0) + (W['prod loomiq/photos'] || 0)) <= 2, 'у спільний документ (журнал) — не більше двох записів', 'записи журналу: ' + JSON.stringify(W));

console.log('═══ 3. НОВЕ ПОВІДОМЛЕННЯ ВИДНО Й У ДРУГІЙ ВКЛАДЦІ ═══');
for(let i = 0; i < 60 && BC_PENDING > 0; i++) await new Promise(r => setTimeout(r, 500));   // стенд дорозсилає знімки (до 30 с)
let u = [];
for(let i = 0; i < 20; i++){   // і ще до 10 с, доки зійдеться
  u = await Promise.all(pages.map(p => p.evaluate(() => { const o = orders.find(x => x.crmChatId === 'c0'); return { last: o.crmLast, at: o.crmAt }; })));
  if(u[1].last === u[0].last && u[1].at === u[0].at) break;
  await new Promise(r => setTimeout(r, 500));
}
if(u[1].last !== u[0].last) console.log('PENDING', BC_PENDING);
if(u[1].last !== u[0].last) console.log('DBG', JSON.stringify(await pages[1].evaluate(() => { const o = orders.find(x => x.crmChatId === 'c0'); const a = JSON.parse(ordersSaved.get(o.id) || '{}'); const d = []; new Set(Object.keys(a).concat(Object.keys(o))).forEach(k => { if(JSON.stringify(a[k]) !== JSON.stringify(o[k])) d.push(k + ':' + String(JSON.stringify(a[k])).slice(0, 40) + '→' + String(JSON.stringify(o[k])).slice(0, 40)); }); return { d, savedLast: a.crmLast, rev: o.rev, savedRev: a.rev, arr: (window.__ORDERS.find(x => x.crmChatId === 'c0') || {}).crmLast, arrRev: (window.__ORDERS.find(x => x.crmChatId === 'c0') || {}).rev, lead: bgLead(), lease: JSON.stringify(bgLease).slice(0, 120) }; })));
ok(u[1].last === 'Повідомлення ' + TICK && u[1].at === u[0].at, 'телефон бачить останнє повідомлення клієнта так само, як компʼютер, — знімком із бази, сам не пише', JSON.stringify(u));

console.log('═══ 4. ТРИМАЧ ЗНИК — ЕСТАФЕТУ БЕРЕ ІНША ═══');
await pages[0].close();
await new Promise(r => setTimeout(r, 10000));
const l2 = await pages[1].evaluate(() => bgLead());
ok(l2 === true, 'компʼютер закрили — за кілька секунд естафету взяв телефон', 'телефон не взяв естафету');

ok(!errs.length, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ bg-lead: фон пише одна вкладка, без відмов і без бурі журналу');
process.exit(bad ? 1 : 0);
