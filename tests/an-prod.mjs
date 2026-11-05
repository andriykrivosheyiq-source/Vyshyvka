/* «ПЕРЕДАНО У ВИРОБНИЦТВО» — Аналітика B2C (05.11).

   Андрій: «аналітика по кожному, хто подав на виробництво, в який день і
   скільки… рахуємо штуки одобреного одягу… перед і спина — одна одиниця…
   тільки B2C»; «днем, який натиснув» (фіксація акаунт-менеджера).
     — штуки (`u.qty`) за `u.confirmed {at, by}`, тій людині й того дня;
     — кожна позиція раз (перед і спина на одній речі — одна);
     — не рахуємо DTF, позиції без фіксації, відмови, чернетки, B2B, поза періодом;
     — «Усі»: дні × люди, разом; людина — лише її, номери кнопками в картку;
     — імена, не пошти (профіль головніший за Команду);
     — «Скопіювати таблицю» — текстом з табуляціями;
     — нічого не пише в базу.

   Запуск:  node tests/an-prod.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9072;
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
         { email:'a@loomiq',    name:'Аня',       role:'managerb2c' },
         { email:'b@loomiq',    name:'',          role:'managerb2c' },
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
await p.waitForTimeout(5500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });








const R = await p.evaluate(async () => {
  const day = n => { const d = new Date(Date.now() - n * 864e5); d.setUTCHours(10, 0, 0, 0); return d.toISOString(); };
  const mk = (id, no, extra) => Object.assign({ id: 'k' + id, orderId: id, no: no, type:'client', dir:'b2c', name:'Клієнт ' + no, status:'prorahunok',
    payments: [], hist: [], createdAt: day(20), items: [] }, extra || {});
  const unit = (id, qty, by, at, extra) => Object.assign({ id, gid:'tee', color:'Чорний', size:'M', qty,
    graphic: [], stitch: [], pics: [], confirmed: by ? { at, by } : null }, extra || {});
  orders.push(mk('5000101', '2000101'), mk('5000102', '2000102'), mk('5000103', '2000103', { status:'cancel' }),
    mk('5000104', '2000104'), mk('1000105', '1000105', { dir:'b2b', type:'b2b' }));
  designJobs['5000101'] = { orderId:'5000101', no:'2000101', units: [
    unit('u1', 3, 'a@loomiq', day(1), { graphic: [{ side:'front' }, { side:'back' }] }),
    unit('u2', 2, 'B@loomiq', day(1)),
    unit('u3', 5, 'a@loomiq', day(1), { tech:'dtf' }),
    unit('u4', 7, '', null) ] };
  designJobs['5000102'] = { orderId:'5000102', no:'2000102', units: [ unit('v1', 4, 'a@loomiq', day(2)), unit('v2', 1, 'a@loomiq', day(40)) ] };
  designJobs['5000103'] = { orderId:'5000103', no:'2000103', units: [ unit('w1', 9, 'a@loomiq', day(1)) ] };
  designJobs['5000104'] = { orderId:'5000104', no:'2000104', draft: true, units: [ unit('x1', 9, 'a@loomiq', day(1)) ] };
  designJobs['1000105'] = { orderId:'1000105', units: [ unit('y1', 9, 'a@loomiq', day(1)) ] };
  contentData.profiles = { [aclKeyOf('b@loomiq')]: { name:'Богдана Сам', email:'b@loomiq' } };
  let пише = 0;
  ['saveOrders', 'designSave', 'designPut', 'orderApply'].forEach(f => { const was = window[f];
    if(typeof was === 'function') window[f] = function(){ пише++; return was.apply(this, arguments); }; });
  const upd0 = (window.__UPDATES || []).length;
  document.querySelector('.nav button[data-view="analytics"]').click();
  await new Promise(r => setTimeout(r, 400));
  document.querySelector('#an-tabs [data-an-top="b2c"]').click();
  await new Promise(r => setTimeout(r, 300));
  const box = document.getElementById('an-prod');
  const tbl = () => [...box.querySelectorAll('table tr')].map(tr => [...tr.children].map(td => td.textContent.trim()));
  const r = { visible: !!(box && box.offsetParent), all: tbl(), chips: [...box.querySelectorAll('[data-anp-pick]')].map(b => b.textContent.trim()),
    opts: [...box.querySelectorAll('[data-anp-who] option')].map(o => o.textContent.trim()) };
  const sel = box.querySelector('[data-anp-who]'); sel.value = 'a@loomiq'; sel.dispatchEvent(new Event('change'));
  r.one = tbl();
  r.nos = [...box.querySelectorAll('[data-anp-no]')].map(b => b.textContent.trim());
  let opened = '';
  const was = window.openByNo; window.openByNo = id => { opened = id; return true; };
  box.querySelector('[data-anp-no]').click();
  window.openByNo = was;
  r.opened = opened;
  try{ navigator.clipboard.writeText = () => Promise.resolve(); }catch(e){}
  box.querySelector('[data-anp-copy]').click();
  r.copy1 = window.__anpCopied || '';
  box.querySelector('[data-anp-pick="a@loomiq"]').click();
  r.back = box.querySelector('[data-anp-who]').value;
  box.querySelector('[data-anp-copy]').click();
  r.copyAll = window.__anpCopied || '';
  r.writes = пише + (window.__UPDATES || []).length - upd0;
  /* Порожній період. */
  renderAnProd(['2020-01-01']);
  r.empty = box.textContent;
  return r;
});
console.log('   ' + JSON.stringify(R.all));
console.log('═══ 1. УСІ: ДНІ × ЛЮДИ ═══');
ok(R.visible, 'блок «Передано у виробництво» у вкладці «Аналітика B2C»', 'блоку не видно');
ok(JSON.stringify(R.all[0]) === JSON.stringify(['День','Аня','Богдана Сам','Разом','Позицій','Замовлення']),
  'колонки — імена (профіль головніший за Команду), не пошти', JSON.stringify(R.all[0]));
const d1 = R.all[1], d2 = R.all[2], tot = R.all[R.all.length - 1];
ok(d1 && d1[1] === '3' && d1[2] === '2' && d1[3] === '5' && d1[4] === '2' && d1[5] === '#2000101',
  'вчора: Аня 3 шт (перед і спина — одна позиція), Богдана 2; без DTF, без нефіксованої, без відмови й чернетки', JSON.stringify(d1));
ok(d2 && d2[1] === '4' && d2[3] === '4' && d2[5] === '#2000102', 'позавчора: Аня 4 шт; фіксація поза періодом не рахується', JSON.stringify(d2));
ok(R.all.length === 4 && tot[0] === 'Разом' && tot[1] === '7' && tot[2] === '2' && tot[3] === '9' && tot[4] === '3', 'разом: 7 + 2 = 9 шт, 3 позиції; B2B не рахується', JSON.stringify(tot));
ok(R.chips.length === 2 && /Аня7 шт2 поз/.test(R.chips[0]) && R.opts.join('|') === 'Усі|Аня · 7 шт|Богдана Сам · 2 шт', 'вибір працівника: «Усі» і кожна людина з підсумком', JSON.stringify([R.chips, R.opts]));

console.log('═══ 2. ОДНА ЛЮДИНА, НОМЕРИ — У КАРТКУ ═══');
ok(JSON.stringify(R.one[0]) === JSON.stringify(['День','Штук','Позицій','Замовлення']) && R.one[1][1] === '3' && R.one[2][1] === '4' && R.one[3][1] === '7',
  'обрали Аню — лише її штуки по днях і разом', JSON.stringify(R.one));
ok(R.nos.join() === '#2000101,#2000102' && R.opened === '5000101', 'номер замовлення — кнопка, відкриває картку', JSON.stringify([R.nos, R.opened]));
ok(/^Передано у виробництво · Аня · /.test(R.copy1) && R.copy1.split('\n')[1] === 'День\tШтук\tПозицій\tЗамовлення' && /\t3\t1\t#2000101$/m.test(R.copy1),
  '«Скопіювати таблицю» — рядки з табуляціями', JSON.stringify(R.copy1));
ok(R.back === '' && /Аня\tБогдана Сам\tРазом/.test(R.copyAll) && /^Разом\t7\t2\t9\t3\t$/m.test(R.copyAll), 'ще раз на ту саму людину — знову «Усі»; копія з усіма', JSON.stringify(R.copyAll));
ok(R.writes === 0, 'нічого не пише в базу', String(R.writes));
ok(/фіксацій немає/.test(R.empty), 'порожній період — словами', R.empty.slice(0, 200));

if(process.env.SHOT){
  await p.evaluate(() => { AN_PROD.who = ''; window.__anMoney(); });
  await p.waitForTimeout(200);
  await (await p.$('#an-prod')).screenshot({ path: process.env.SHOT });
}
ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
