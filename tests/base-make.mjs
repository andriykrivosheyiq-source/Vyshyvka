/* З ПОЗИЦІЇ — У БАЗОВІ (22.10).

   Андрій: «ескізи, які роблять наші дизайнери… люди хочуть такі самі
   повторяти. Їх потрібно додати в базові… тільки власник… підтягується
   картинка, яку погодив клієнт, файли DST, EMB… я дозаповнюю і зберігаю».

   1. Власник бачить «★ Зробити базовим» у позиції з погодженим ескізом і
      вишивальними файлами; без файлів — сіра з причиною; інші — не бачать.
   2. Натиск — вікно поверх картки, заповнене: назва, заставка = мокап,
      який погодив клієнт, принт = робочий PNG, файли = DST/EMB, додатково
      = скрін; картка лишається відкритою.
   3. Зберіг — дизайн у бібліотеці (з позначкою, звідки), кнопка стає
      «✓ У базових» і відкриває його, а не робить дубль.

   Запуск:  node tests/base-make.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9019;
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
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });







const ЖДИ = ms => p.waitForTimeout(ms);
await p.evaluate(() => {
  const D = window.LQDesign, U = D.ui;
  const o = { id:'b2000901', orderId:'2000901', type:'client', dir:'b2c', name:'Ніна', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c901', items:[] };
  orders.push(o);
  const j = designJobMake('2000901'); j.no = '2000901';
  const u1 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'кіт', artKind:'k' });
  const u2 = Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Білий', size:'L', qty:1, note:'пес', artKind:'k' });
  j.units = [u1, u2];
  [u1, u2].forEach((u, i) => {
    const g = D.dzNew(); g.who = 'p@loomiq'; g.sentAt = '2026-10-18T10:00:00.000Z'; D.dzList(u, 'graphic').push(g);
    D.dzVer(g, 'p@loomiq', [{ name:'мокап' + i + '.png', url:'https://f/mock' + i + '.png', role:'mock' },
                            { name:'кіт' + i + '.png', url:'https://f/work' + i + '.png', hash:'h' + i, role:'work' }], '', null, 'graphic');
    D.dzOk(g, 'test@loomiq', 'client', 1);
  });
  /* Вишивка — лише в першої позиції. */
  const s = D.dzNew(); s.who = 'e@loomiq'; s.sentAt = '2026-10-19T10:00:00.000Z'; D.dzList(u1, 'stitch').push(s);
  D.dzVer(s, 'e@loomiq', [{ name:'кіт.dst', url:'https://f/kit.dst', role:'machine' }, { name:'кіт.emb', url:'https://f/kit.emb', role:'machine' },
                          { name:'wilcom.png', url:'https://f/shot.png', role:'shot' }], '', null, 'stitch');
  designJobs['2000901'] = j;
  window.__u1 = u1.id; window.__u2 = u2.id;
  applyRoleUi();
  document.querySelector('.nav button[data-view="design"]').click();
});
await ЖДИ(300);
const кнопки = () => p.evaluate(async () => {
  const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot .dz-card[data-open="2000901"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 300));
  const b = id => { const x = document.querySelector('.dz-panel [data-do="u-base-make"][data-u="' + id + '"]');
    return x ? { t: x.textContent.trim(), off: x.disabled, why: (x.parentNode.querySelector('.dz-base-why') || {}).textContent || '' } : null; };
  return { u1: b(window.__u1), u2: b(window.__u2) };
});

console.log('═══ 1. ХТО БАЧИТЬ КНОПКУ ═══');
const вл = await кнопки();
console.log('   ' + JSON.stringify(вл));
ok(вл.u1 && вл.u1.t === '★ Зробити базовим' && !вл.u1.off, 'власник: у позиції з погодженим ескізом і DST/EMB — «★ Зробити базовим»', JSON.stringify(вл.u1));
ok(вл.u2 && вл.u2.off && /немає вишивальних файлів/.test(вл.u2.why), 'без вишивальних файлів — сіра, з причиною', JSON.stringify(вл.u2));
const мен = await p.evaluate(async () => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'managerb2c', roles:['managerb2c'] }) : x);
  try{ localStorage.removeItem('lq_role_test@loomiq'); }catch(e){}
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
  return true;
});
const менК = await кнопки();
ok(!менК.u1 && !менК.u2, 'акаунт B2C кнопки не бачить', JSON.stringify(менК));
await p.evaluate(async () => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner', roles:['owner'] }) : x);
  applyRoleUi(); await new Promise(r => setTimeout(r, 60));
});

console.log('');
console.log('═══ 2. НАТИСК — ВІКНО ПОВЕРХ КАРТКИ, ЗАПОВНЕНЕ ═══');
await кнопки();
const вікно = await p.evaluate(async () => {
  document.querySelector('.dz-panel [data-do="u-base-make"][data-u="' + window.__u1 + '"]').click();
  await new Promise(r => setTimeout(r, 300));
  const pop = document.getElementById('rd-pop');
  const imgs = pop ? [...pop.querySelectorAll('.rd-slot')].map(s => ({ b: (s.querySelector('b') || {}).textContent, n: [...s.querySelectorAll('.rd-fn')].map(x => x.textContent), img: (s.querySelector(':scope > img') || {}).src || '' })) : [];
  return { pop: !!pop, name: (document.getElementById('rd-name') || {}).value || '', slots: imgs,
           card: !!document.querySelector('.dz-panel:not(.hide)'), ed: rdEditing && { pic: rdEditing.pic, arts: rdEditing.arts.map(f => f.url), files: rdEditing.files.map(f => f.name), extras: rdEditing.extras.map(f => f.name), from: rdEditing.from } };
});
console.log('   ' + JSON.stringify(вікно));
ok(вікно.pop && вікно.card, 'відкрилось вікно поверх картки, картка лишилась', JSON.stringify({ pop: вікно.pop, card: вікно.card }));
ok(вікно.name === 'Ескіз #2000901', 'назва — «Ескіз #2000901», можна переписати', вікно.name);
ok(вікно.ed && вікно.ed.pic === 'https://f/mock0.png', 'заставка — мокап, який погодив клієнт', JSON.stringify(вікно.ed));
ok(вікно.ed && вікно.ed.arts.join() === 'https://f/work0.png', 'принт — робочий PNG графічного дизайнера', JSON.stringify(вікно.ed));
ok(вікно.ed && вікно.ed.files.join() === 'кіт.dst,кіт.emb' && вікно.ed.extras.join() === 'wilcom.png', 'вишивальні файли — DST і EMB, додатково — скрін Wilcom', JSON.stringify(вікно.ed));
ok(вікно.ed && вікно.ed.from && вікно.ed.from.orderId === '2000901', 'дизайн памʼятає, з якого замовлення й позиції', JSON.stringify(вікно.ed));

console.log('');
console.log('═══ 3. ЗБЕРІГ — У БІБЛІОТЕЦІ; ДРУГИЙ РАЗ — НЕ ДУБЛЬ ═══');
const зб = await p.evaluate(async () => {
  document.getElementById('rd-name').value = 'Кіт у капелюсі';
  document.getElementById('rd-tags').value = 'кіт, капелюх';
  document.querySelector('#rd-pop [data-rd-save]').click();
  await new Promise(r => setTimeout(r, 500));
  const l = readyDesigns();
  return { n: l.length, d: l[0] && { name: l[0].name, tags: l[0].tags, from: l[0].from, files: (l[0].files || []).length }, pop: !!document.getElementById('rd-pop'),
           list: (document.getElementById('rd-list') || {}).textContent || '' };
});
console.log('   ' + JSON.stringify(зб));
ok(зб.n === 1 && зб.d.name === 'Кіт у капелюсі' && зб.d.tags === 'кіт, капелюх' && зб.d.files === 2 && !зб.pop,
  'зберіг — готовий дизайн з дописаною назвою й тегами, вікно закрилось', JSON.stringify(зб));
ok(/Кіт у капелюсі/.test(зб.list), 'і в Налаштуваннях B2C → Готові дизайни він є', зб.list.slice(0, 120));
const після = await кнопки();
ok(після.u1 && після.u1.t === '✓ У базових', 'у позиції тепер «✓ У базових»', JSON.stringify(після.u1));
const вдруге = await p.evaluate(async () => {
  document.querySelector('.dz-panel [data-do="u-base-make"][data-u="' + window.__u1 + '"]').click();
  await new Promise(r => setTimeout(r, 300));
  const r = { pop: !!document.getElementById('rd-pop'), name: (document.getElementById('rd-name') || {}).value || '' };
  document.querySelector('#rd-pop [data-rd-cancel]').click();
  await new Promise(r => setTimeout(r, 200));
  return Object.assign(r, { closed: !document.getElementById('rd-pop'), n: readyDesigns().length });
});
ok(вдруге.pop && вдруге.name === 'Кіт у капелюсі' && вдруге.closed && вдруге.n === 1, 'натиснув ще раз — відкрився той самий, без дубля; «×» закрив', JSON.stringify(вдруге));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'з позиції — у базові: лише власник, файли самі, без дублів');
process.exit(bad ? 1 : 0);
