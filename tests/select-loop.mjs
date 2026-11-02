/* ВИПАДАЙКИ НЕ КРУТЯТЬ КОЛО (02.11, швидкість, крок 1).

   Андрій: «жалуються на швидкість по мобільній версії… підвисає».
   Вимір 02.11: у простої адмінка робила ~2000 змін DOM за 10 с, усі —
   запис підпису випадайки (.lq-sel-v). Коло: спостерігач змін → обхід →
   dress переписує той самий підпис → спостерігач → … кожні 60 мс, у кожній
   вкладці, назавжди. Тепер dress пише лише те, що змінилось, а власний
   запис підпису обходу не планує.

   1. У простої — жодної зміни DOM від модуля.
   2. Поведінка та сама: новий список одягається сам; вибір, перебудова
      опцій, програмне значення, disabled/hidden — підпис і вигляд
      оновлюються, як і доти.
   3. Справжня адмінка: у простої після завантаження підписи не
      переписуються.

   Запуск:  node tests/select-loop.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9188;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const PAGE = `<!doctype html><meta charset="utf-8"><body>
<div id="a"><select id="s1"><option value="x">Ікс</option><option value="y" selected>Ігрек</option><option value="z">Зет дуже довгий пункт</option></select></div>
<div id="b"><select id="s2" style="width:200px"><option value="">—</option><option value="1">Один</option></select></div>
<div id="c"></div>
<script src="/loomiq-select.js"></script>
<script>
  window.__M = [];
  new MutationObserver(function(l){ l.forEach(function(r){
    var t = r.target; var k = (t.nodeType === 1 && t.className) || t.nodeName;
    window.__M.push(String(k).slice(0, 30) + ':' + r.type); }); })
    .observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true });
</script></body>`;
const srv = createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if(u === '/page.html'){ res.writeHead(200, { 'Content-Type':'text/html' }); return res.end(PAGE); }
  const f = path.join(ROOT, u.replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1200, height:800 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
await p.goto(HOST + '/page.html', { waitUntil:'load' });
await p.waitForTimeout(300);

console.log('═══ 1. У ПРОСТОЇ — ЖОДНОЇ ЗМІНИ DOM ═══');
const selfMuts = async (ms) => p.evaluate(async (ms) => {
  window.__M = [];
  await new Promise(r => setTimeout(r, ms));
  return window.__M.filter(x => /lq-sel/.test(x));
}, ms);
const idle = await selfMuts(1500);
ok(idle.length === 0, 'за 1,5 с простою модуль нічого не переписав', 'у простої модуль пише в DOM: ' + idle.slice(0, 5).join(', ') + ' (усього ' + idle.length + ')');
const lab = await p.evaluate(() => [...document.querySelectorAll('.lq-sel-v')].map(x => x.textContent));
ok(lab[0] === 'Ігрек' && lab[1] === '—', 'обидва списки одягнуті, підписи правильні', 'підписи: ' + JSON.stringify(lab));

console.log('═══ 2. ПОВЕДІНКА ТА САМА ═══');
/* новий список у розмітці — одягається сам */
await p.evaluate(() => { document.getElementById('c').innerHTML = '<select id="s3"><option>Перший</option><option selected>Другий</option></select>'; });
await p.waitForTimeout(200);
let t = await p.evaluate(() => { const s = document.getElementById('s3'); return s.__lqBox ? s.__lqBox.querySelector('.lq-sel-v').textContent : null; });
ok(t === 'Другий', 'новий список одягнувся сам: «Другий»', 'новий список не одягнувся: ' + t);
/* вибір з меню — значення, change, підпис */
let changed = await p.evaluate(async () => {
  const s = document.getElementById('s1'); let n = 0; s.addEventListener('change', () => n++);
  s.__lqBox.click(); await new Promise(r => setTimeout(r, 50));
  const o = [...document.querySelectorAll('.lq-menu .lq-o')].find(x => /Зет/.test(x.textContent)); o.click();
  await new Promise(r => setTimeout(r, 50));
  return { v: s.value, n, t: s.__lqBox.querySelector('.lq-sel-v').textContent, menu: !!document.querySelector('.lq-menu') };
});
ok(changed.v === 'z' && changed.n === 1 && /Зет/.test(changed.t) && !changed.menu, 'вибір з меню: value=z, change ×1, підпис оновлено, меню закрито', 'вибір з меню: ' + JSON.stringify(changed));
/* опції перебудували (innerHTML) — підпис за новим selected */
await p.evaluate(() => { document.getElementById('s1').innerHTML = '<option value="q">Ку</option><option value="w" selected>Ве</option>'; });
await p.waitForTimeout(200);
t = await p.evaluate(() => document.getElementById('s1').__lqBox.querySelector('.lq-sel-v').textContent);
ok(t === 'Ве', 'опції перебудовано — підпис «Ве»', 'після перебудови опцій підпис: ' + t);
const longest = await p.evaluate(() => document.getElementById('s1').__lqBox.querySelector('.lq-sel-v').getAttribute('data-longest'));
ok(longest === 'Ку' || longest === 'Ве', 'найдовший пункт перераховано', 'data-longest: ' + longest);
/* програмне значення + будь-яка зміна сторінки поруч (як і доти — обхід після зміни) */
await p.evaluate(() => { document.getElementById('s2').value = '1'; document.getElementById('c').appendChild(document.createElement('i')); });
await p.waitForTimeout(200);
t = await p.evaluate(() => document.getElementById('s2').__lqBox.querySelector('.lq-sel-v').textContent);
ok(t === 'Один', 'програмне значення підхоплено наступним обходом: «Один»', 'програмне значення: ' + t);
/* change без кліку (код сторінки) — одразу */
await p.evaluate(() => { const s = document.getElementById('s2'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles:true })); });
t = await p.evaluate(() => document.getElementById('s2').__lqBox.querySelector('.lq-sel-v').textContent);
ok(t === '—', 'change від коду — підпис одразу «—»', 'після change підпис: ' + t);
/* disabled / hidden */
await p.evaluate(() => { document.getElementById('s2').disabled = true; document.getElementById('s3').hidden = true; document.getElementById('c').appendChild(document.createElement('i')); });
await p.waitForTimeout(200);
const st = await p.evaluate(() => ({ off: document.getElementById('s2').__lqBox.classList.contains('is-off'), hid: document.getElementById('s3').__lqBox.hidden }));
ok(st.off && st.hid, 'disabled → is-off, hidden → кнопка схована', 'disabled/hidden: ' + JSON.stringify(st));
/* після всього — знову тиша */
const idle2 = await selfMuts(1000);
ok(idle2.length === 0, 'після дій знову тиша', 'після дій модуль далі пише: ' + idle2.slice(0, 5).join(', '));
/* data-native не чіпаємо */
await p.evaluate(() => { document.getElementById('c').innerHTML += '<select data-native id="s4"><option>А</option></select>'; });
await p.waitForTimeout(200);
ok(await p.evaluate(() => !document.getElementById('s4').__lqBox), 'data-native лишається нативним', 'data-native одягнули');

console.log('═══ 3. СПРАВЖНЯ АДМІНКА: У ПРОСТОЇ ПІДПИСИ НЕ ПЕРЕПИСУЮТЬСЯ ═══');
const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }], b2c:{} };
const ORDERS = [
  { id:'1', orderId:'2000901', type:'client', dir:'b2c', name:'Асія', phone:'', status:'prorahunok', site:'main', crmChatId:'c1',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 2000, items:[] },
  { id:'2', orderId:'1000901', type:'client', dir:'b2b', name:'ТОВ Ромашка', phone:'', status:'design', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 5000, items:[] }
];
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };', 'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT; try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function mkSnap(list){ var docs=list.map(function(o){ return new Snap(o.id,o); }); return { docs:docs, forEach:function(f){ docs.forEach(f); }, empty:!docs.length, metadata:{ fromCache:false }, docChanges:function(){ return list.map(function(o){ return { type:"added", doc:new Snap(o.id,o) }; }); } }; }\n' +
  '  function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.onSnapshot=function(cb){ try{ cb(mkSnap(window.__ORDERS)); }catch(e){ console.error(e); } return function(){}; };\n' +
  "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(); var c=new Col(); c.__n=n; return c; },");
const a = await browser.newPage({ viewport:{ width:1500, height:940 } });
a.on('pageerror', e => errs.push(e.message.slice(0, 180)));
a.on('dialog', d => d.accept(''));
await a.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await a.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await a.waitForFunction(() => typeof ordersLoaded !== 'undefined' && ordersLoaded, null, { timeout: 60000 });
await a.waitForTimeout(3000);
const adm = await a.evaluate(async () => {
  const who = {}; let total = 0;
  const mo = new MutationObserver(l => l.forEach(r => { total++; const t = r.target; const k = (t.nodeType === 1 && t.className) || t.nodeName; const kk = String(k).slice(0, 30) + ':' + r.type; who[kk] = (who[kk] || 0) + 1; }));
  mo.observe(document.body, { childList:true, subtree:true });
  await new Promise(r => setTimeout(r, 3000));
  mo.disconnect();
  const sel = Object.entries(who).filter(([k]) => /lq-sel/.test(k)).reduce((s, [, v]) => s + v, 0);
  return { total, sel, selects: document.querySelectorAll('select:not([data-native])').length, dressed: document.querySelectorAll('.lq-sel').length, top: Object.entries(who).sort((x, y) => y[1] - x[1]).slice(0, 4) };
});
ok(adm.sel === 0, 'адмінка, 3 с простою: випадайки нічого не переписали (усіх змін DOM: ' + adm.total + ')', 'адмінка в простої переписує випадайки: ' + adm.sel + ' за 3 с; ' + JSON.stringify(adm.top));
ok(adm.dressed >= adm.selects && adm.selects > 0, 'усі ' + adm.selects + ' списків адмінки одягнуті', 'списків ' + adm.selects + ', одягнуто ' + adm.dressed);
ok(adm.total < 50, 'адмінка в простої майже не рухає DOM (' + adm.total + ' змін за 3 с)', 'адмінка в простої рухає DOM: ' + adm.total + ' змін за 3 с; ' + JSON.stringify(adm.top));

ok(errs.length === 0, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ select-loop: усі перевірки пройшли');
process.exit(bad ? 1 : 0);
