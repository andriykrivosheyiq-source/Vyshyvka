/* У «РЕЄСТР» ПЕРЕНОСЯТЬ ЗАВЖДИ; НЕГОДЯЩА ТТН ГОРИТЬ ТАМ; ПЕРЕСТВОРИТИ ТТН НЕ МОВЧИТЬ (02.11).

   Відео цеху: тягнуть #2000198 у «Реєстр» — у відповідь «картку вже рушили —
   показано свіжу», хоч її ніхто не рушив (стара ТТН до переробки мовчки
   відкидала хід); «Перестворити ТТН» — 25 с тиші з одним написом, потім
   «signal is aborted without reason». Андрій: «головне, щоб можна було
   пересунути в реєстр, бо він так сортує їх, а потім воно горіло, і він
   буде переходити по них; спливне питання [«Перестворити?»] повинно бути».

   1. Стара ТТН (до переробки): у «Можна відправляти» словами, що стара й що
      робити; «Перенести в реєстр» є і переносить; у «Реєстрі» плитка й
      картка горять «ТТН стара, до переробки — перестворіть»; «Створити
      реєстр» її не бере й каже чому. Без ТТН — так само, «ТТН ще немає».
   2. «↻ Перестворити ТТН» — питання «Перестворити накладну?» є, далі кнопка
      рахує секунди; нова ТТН — червоне в «Реєстрі» гасне.
   3. Нова пошта мовчить — людські слова «могла створитись», без «спробуйте ще раз»;
      картку в цей час можна закрити.
   4. Телефон: «Перенести в реєстр» у нижній панелі картки цеху.

   Запуск:  node tests/prod-reg.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9189;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const npLog = [];
const srv = createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if(u === '/np'){
    let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
    let j = {}; try{ j = JSON.parse(body); }catch(e){}
    npLog.push(j.op);
    /* #2000433 — Нова пошта мовчить */
    if(j.op === 'create' && j.order && String(j.order.phone || '').replace(/\D/g, '') === '380670000433') return;
    res.writeHead(200, { 'Content-Type':'application/json' });
    if(j.op === 'create') return res.end(JSON.stringify({ ok:true, ttn:'20451599999999', ref:'ref-new', cost: 80 }));
    return res.end(JSON.stringify({ ok:true }));
  }
  const f = path.join(ROOT, u.replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [], dialogs = [];
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();
const CONTENT = { team: [{ email:'test@loomiq', name:'Паша', role:'production' }, { email:'owner@loomiq', name:'Андрій', role:'owner' }], b2c: {}, bgApi: { npUrl: HOST + '/np' }, ship: { senders: [] } };
const OLD = '20451573586187';
const ship = { name:'Іван Петренко', phone:'+380671112233', cityRef:'city-ref', cityName:'Київ', whRef:'wh-ref', whName:'Відділення 1', whNumber:'1' };
const card = (id, no, extra) => Object.assign({ id, orderId: no, type:'client', dir:'b2c', name:'Клієнт', phone:'+380671112233', status:'prod', site:'main', createdAt: iso(20), touchedAt: iso(0.1), rev: 9,
  totalPrice: 2000, items:[], ship: Object.assign({}, ship), tracks: { supply:'got', prod:'done', qc:'ok', ship:'sent' }, prodQc: { photos:[], ok:{ at: iso(0.05), by:'m@loomiq' } },
  hist:[], trackHist:[], payments:[], arch:false }, extra);
const ORDERS = [
  card('5100198', '2000198', { ttn: OLD, ttnAt: iso(4), ttnRef:'ref-old', ttnCod: 2000, shipOld: OLD,
    reprints: [{ at: iso(2), by:'p@loomiq', blame:'operator', note:'перешити', from:'after', open:false, closedAt: iso(1) }] }),
  card('5100433', '2000433', { ttn:'20451500000433', ttnAt: iso(0.5), ttnRef:'r433', ttnCod: 2000, ship: Object.assign({}, ship, { phone:'+380670000433' }) }),
  card('5100361', '2000361', { ttn:'20451500000361', ttnAt: iso(0.5), ttnRef:'r361', ttnCod: 2000 }),
  card('5100500', '2000500', { ttn:'', ttnCod: 0 })
];
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };', 'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT; try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
/* читання картки з бази — жива копія з памʼяті вкладки (як справжня база після запису) */
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var self=this; var o=(self.__col==='kanbanOrders') ? ((window.orders||[]).filter(function(x){ return x.id===self.__id; })[0]||null) : null; return Promise.resolve(new Snap(self.__id||'x', o ? JSON.parse(JSON.stringify(o)) : null)); };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function mkSnap(list){ var docs=list.map(function(o){ return new Snap(o.id,o); }); return { docs:docs, forEach:function(f){ docs.forEach(f); }, empty:!docs.length, metadata:{ fromCache:false }, docChanges:function(){ return list.map(function(o){ return { type:"added", doc:new Snap(o.id,o) }; }); } }; }\n' +
  '  function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.onSnapshot=function(cb){ try{ cb(mkSnap(window.__ORDERS)); }catch(e){ console.error(e); } return function(){}; };\n' +
  "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(); var c=new Col(); c.__n=n; return c; },");
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = async (mobile) => {
  const ctx = await browser.newContext(mobile ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true } : { viewport:{ width:1500, height:940 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  p.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message().slice(0, 60)); d.accept(''); });
  await p.route('**://**', r => { const u = r.request().url(); if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub }); if(u.startsWith(HOST)) return r.continue(); return r.abort(); });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded, null, { timeout: 60000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
    const t = document.getElementById('toast'); window.__TOASTS = [];
    new MutationObserver(() => { if(t.textContent) window.__TOASTS.push(t.textContent); }).observe(t, { childList:true, characterData:true, subtree:true });
    const U = window.LQDesign.ui; (orders || []).forEach(o => { const j = designJobMake(o.orderId); j.units = [Object.assign(U.unitNew(), { gid:'hoodie', name:'Худі', color:'Білий', size:'M', qty:1, fixedAt: new Date().toISOString() })]; });
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none'); document.getElementById('view-design').style.display = 'block'; openDesign(); });
  return p;
};
const colOf = (p, no) => p.evaluate(no => { const el = document.querySelector('#dzRoot [data-open="' + no + '"]'); return el ? el.closest('.dz-col').dataset.col : 'нема'; }, no);
const openCard = async (p, no) => { await p.evaluate(no => document.querySelector('#dzRoot [data-open="' + no + '"]').click(), no); await p.waitForTimeout(600); };
const cardInfo = (p) => p.evaluate(() => { const r = document.getElementById('dzRoot'); return {
  ttn: ((r.querySelector('.dz-ttn') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  miss: [...r.querySelectorAll('.dz-miss')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
  reg: ((r.querySelector('.dz-panel [data-do="prod-move"][data-to="reg"], .dz-prod-acts [data-do="prod-move"][data-to="reg"]') || {}).textContent || '').trim(),
  bad: [...r.querySelectorAll('.dz-panel .dz-c-ttnbad, .dz-ttn .dz-c-ttnbad')].map(x => x.textContent.trim()),
  mbar: [...r.querySelectorAll('.dz-mbar button')].map(b => b.textContent.trim()) }; });
const tileBad = (p, no) => p.evaluate(no => { const el = document.querySelector('#dzRoot [data-open="' + no + '"]'); const w = el && (el.closest('.dz-card-w') || el); const b = w && w.querySelector('.dz-c-ttnbad'); return b ? b.textContent.trim() : ''; }, no);

const p = await page(false);
console.log('═══ 1. СТАРА ТТН: ПЕРЕНЕСТИ МОЖНА, У «РЕЄСТРІ» ГОРИТЬ, РЕЄСТР НЕ БЕРЕ ═══');
ok(await colOf(p, '2000198') === 'ship', '#2000198 у «Можна відправляти»', 'колонка: ' + await colOf(p, '2000198'));
await openCard(p, '2000198');
let c = await cardInfo(p);
ok(c.miss.some(m => /ТТН 20451573586187 стара, до переробки/.test(m) && /Перестворити ТТН/.test(m)), 'у картці: «ТТН … стара, до переробки — натисніть «Перестворити ТТН»»', 'написи: ' + JSON.stringify(c.miss));
ok(c.reg === 'Перенести в реєстр', 'кнопка «Перенести в реєстр» є і зі старою ТТН', 'кнопка: «' + c.reg + '»');
dialogs.length = 0;
await p.evaluate(() => { window.__TOASTS = []; document.querySelector('[data-do="prod-move"][data-to="reg"]').click(); });
await p.waitForTimeout(1200);
let r = await p.evaluate(() => window.__TOASTS.slice());
ok(await colOf(p, '2000198') === 'reg' && r.some(t => /Перенесено/.test(t)) && !r.some(t => /вже рушили|не можна/.test(t)) && dialogs.length === 0, 'перенесено в «Реєстр» без питань: ' + (r[0] || ''), 'колонка=' + await colOf(p, '2000198') + ' toasts=' + JSON.stringify(r) + ' діалоги=' + dialogs.length);
const tb = await tileBad(p, '2000198');
ok(/ТТН стара, до переробки — перестворіть/.test(tb), 'на плитці в «Реєстрі» горить: «' + tb + '»', 'на плитці: «' + tb + '»');
c = await cardInfo(p);
ok(c.bad.some(x => /стара, до переробки/.test(x)), 'у картці в «Реєстрі» теж горить', 'у картці: ' + JSON.stringify(c.bad));
/* без ТТН — так само */
await p.evaluate(() => { const x = document.querySelector('[data-close]'); if(x) x.click(); });
await p.waitForTimeout(300);
await openCard(p, '2000500');
await p.evaluate(() => { document.querySelector('[data-do="prod-move"][data-to="reg"]').click(); });
await p.waitForTimeout(1200);
ok(await colOf(p, '2000500') === 'reg' && /ТТН ще немає/.test(await tileBad(p, '2000500')), 'без ТТН теж переноситься, горить «ТТН ще немає»', 'колонка=' + await colOf(p, '2000500') + ' плитка=«' + await tileBad(p, '2000500') + '»');
/* «Створити реєстр» — не бере, каже чому */
dialogs.length = 0;
r = await p.evaluate(async () => { window.__TOASTS = []; await window.LQDesign.ui.act('reg-make', document.getElementById('dzRoot'), {}); return window.__TOASTS.slice(); });
ok(r.some(t => /без ТТН або зі старою/.test(t) && /стара, до переробки/.test(t) && /ТТН ще немає/.test(t)) && dialogs.length === 0 && npLog.indexOf('registry') < 0,
  '«Створити реєстр»: не бере обидві й каже чому', 'toasts=' + JSON.stringify(r) + ' діалоги=' + dialogs.length + ' ops=' + npLog.join(','));
ok(await colOf(p, '2000198') === 'reg' && await colOf(p, '2000500') === 'reg', 'обидві лишились у «Реєстрі»', 'колонки: ' + await colOf(p, '2000198') + ' ' + await colOf(p, '2000500'));

console.log('═══ 2. ПЕРЕСТВОРИТИ ТТН — З ПИТАННЯМ, ІЗ СЕКУНДАМИ; ЧЕРВОНЕ ГАСНЕ ═══');
await p.evaluate(() => { const x = document.querySelector('[data-close]'); if(x) x.click(); });
await p.waitForTimeout(300);
await openCard(p, '2000198');
dialogs.length = 0;
/* 05.11 (#2000198): спершу стара скасовується, далі нова; накладна — не «спробуйте
   ще раз», а «могла створитись» (чекаємо NP_CREATE_MS, тут скорочено до 4 с). */
await p.evaluate(() => { NP_CREATE_MS = 4000; TTN_FIND_WAIT = [100, 100]; window.__TOASTS = []; document.querySelector('[data-do="ttn-remake"]').click(); });
await p.waitForTimeout(150);
const busy = await p.evaluate(() => ((document.querySelector('[data-do="ttn-remake"]') || {}).textContent || '').trim());
const busyToast = await p.evaluate(() => window.__TOASTS.join(' | '));
await p.waitForTimeout(2500);
let end = await p.evaluate(() => ({ ttn: (orders.find(o => o.orderId === '2000198') || {}).ttn, toasts: window.__TOASTS.slice(), btn: ((document.querySelector('[data-do="ttn-remake"]') || {}).textContent || '').trim() }));
ok(dialogs.length === 1 && /^confirm: Перестворити накладну 20451573586187/.test(dialogs[0]), 'питання «Перестворити накладну …?» є', 'діалоги: ' + dialogs.join(' | '));
ok(/^Створюю… \d+ с$/.test(busy) || /Накладну перестворено/.test(busyToast), 'кнопка під час роботи: «' + busy + '»' + (busy === '↻ Перестворити ТТН' ? ' (стуб відповів миттєво)' : ''), 'кнопка під час роботи: «' + busy + '»');
ok(end.ttn === '20451599999999' && end.toasts.some(t => /Накладну перестворено/.test(t)), 'нова ТТН у картці, напис «Накладну перестворено»', 'ttn=' + end.ttn + ' toasts=' + JSON.stringify(end.toasts));
ok(end.btn === '↻ Перестворити ТТН', 'кнопка повернулась', 'кнопка: ' + end.btn);
c = await cardInfo(p);
ok(!c.bad.length && !(await tileBad(p, '2000198')) && await colOf(p, '2000198') === 'reg', 'червоне в «Реєстрі» згасло, картка там же', 'bad=' + JSON.stringify(c.bad) + ' плитка=«' + await tileBad(p, '2000198') + '» колонка=' + await colOf(p, '2000198'));

console.log('═══ 3. НОВА ПОШТА МОВЧИТЬ — «МОГЛА СТВОРИТИСЬ», БЕЗ «СПРОБУЙТЕ ЩЕ РАЗ», КАРТКА ЗАКРИВАЄТЬСЯ ═══');
await p.evaluate(() => { const x = document.querySelector('[data-close]'); if(x) x.click(); });
await p.waitForTimeout(400);
await openCard(p, '2000433');
/* 05.11 (#2000198): спершу стара скасовується, далі нова; накладна — не «спробуйте
   ще раз», а «могла створитись» (чекаємо NP_CREATE_MS, тут скорочено до 4 с). */
await p.evaluate(() => { NP_CREATE_MS = 4000; TTN_FIND_WAIT = [100, 100]; window.__TOASTS = []; document.querySelector('[data-do="ttn-remake"]').click(); });
await p.waitForTimeout(3000);
const mid = await p.evaluate(() => ((document.querySelector('[data-do="ttn-remake"]') || {}).textContent || '').trim());
ok(/^Створюю… [23] с$/.test(mid), 'через 3 с кнопка каже «' + mid + '»', 'через 3 с кнопка: «' + mid + '»');
const closed = await p.evaluate(() => { const x = document.querySelector('[data-close]'); if(!x) return 'хрестика немає'; x.click(); return document.querySelector('[data-close]') ? 'не закрилась' : 'закрилась'; });
ok(closed === 'закрилась', 'картку можна закрити, поки чекаємо Нову пошту', 'закрити: ' + closed);
await p.waitForTimeout(4000);
end = await p.evaluate(() => { const o = orders.find(o => o.orderId === '2000433') || {}; return { ttn: o.ttn, toasts: window.__TOASTS.slice(),
  h: (o.ttnHist || []).filter(x => x.ttn === '20451500000433').pop() || null }; });
ok(end.toasts.some(t => /не перестворено: стару накладну 20451500000433 скасовано, а нова не створилась: Нова пошта довго відповідала — накладна могла створитись/.test(t)) &&
   !end.toasts.some(t => /спробуйте ще раз за хвилину/.test(t)),
  'НП мовчить: «стару скасовано, нова… могла створитись» — без «спробуйте ще раз»', 'напису немає: ' + JSON.stringify(end.toasts));
ok(!end.ttn && end.h && end.h.replaced && end.h.npDel === true, 'скасована стара в картці не висить — в історії «замінена, скасована»', 'ttn=' + end.ttn + ' h=' + JSON.stringify(end.h));

console.log('═══ 4. ТЕЛЕФОН: «ПЕРЕНЕСТИ В РЕЄСТР» У НИЖНІЙ ПАНЕЛІ ═══');
const m = await page(true);
await openCard(m, '2000361');
c = await cardInfo(m);
ok(c.mbar.indexOf('Перенести в реєстр') >= 0 && c.reg === 'Перенести в реєстр', 'на телефоні внизу картки «Перенести в реєстр»', 'mbar=' + JSON.stringify(c.mbar) + ' reg=«' + c.reg + '»');
await m.evaluate(() => document.querySelector('.dz-mbar [data-do="prod-move"][data-to="reg"]').click());
await m.waitForTimeout(1200);
ok(await m.evaluate(() => (orders.find(o => o.orderId === '2000361') || {}).shipCol === 'reg'), 'з телефона картка пішла в «Реєстр»', 'shipCol не reg');

ok(errs.length === 0, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ prod-reg: усі перевірки пройшли');
process.exit(bad ? 1 : 0);
