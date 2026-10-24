/* ПІДПИС НА КАРТИНЦІ ТЗ (24.10).

   Андрій (#2000251): «скидають різні картинки, і з кожної треба щось
   взяти… на самій картинці підпис, щоб дати коментар по ньому». Менеджер
   підписує кожну картинку позиції («дракон», «напис BASGIATH»); номер і
   підпис бачать дизайнер і цех; прибрали картинку — зник і її підпис.

   Запуск:  node tests/pic-notes.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9057;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }], b2c:{} };
const ORDERS = [
  { id:'1', orderId:'2000901', type:'client', dir:'b2c', name:'Асія', phone:'', status:'prorahunok', site:'main', crmChatId:'c1',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 2000, items:[] }
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


await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const job = designJobMake('2000901');
  job.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Світшот з флісом', color:'Бордовий', size:'M', qty:1,
    note:'Дракон як на першій, напис як на другій',
    pics:[{ name:'дракон.png', url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
          { name:'напис.png',  url:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }] })];
  const d = D.dzNew();
  D.dzAttach(d, 'test@loomiq', 'mgr@loomiq');
  D.dzSend(d, 'mgr@loomiq');
  D.dzList(job.units[0], 'graphic').push(d);
  openDesign(); U.setTab('acct'); U.render(document.getElementById('dzRoot'));
});
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#dzRoot [data-open="2000901"]').click());
await p.waitForTimeout(600);

console.log('═══ 1. МЕНЕДЖЕР ПІДПИСУЄ КОЖНУ КАРТИНКУ ═══');
const m0 = await p.evaluate(() => ({ поля: document.querySelectorAll('.dz-panel [data-pic-note]').length,
  номери: [...document.querySelectorAll('.dz-panel .dz-u-pics .dz-pic-no')].map(x => x.textContent).join(',') }));
ok(m0.поля === 2 && m0.номери === '1,2', 'під кожною картинкою — поле «що взяти», на картинках номери 1 і 2', JSON.stringify(m0));
await p.click('.dz-panel [data-pic-note$="|0"]');
const ширина = await p.evaluate(() => document.querySelector('.dz-panel [data-pic-note$="|0"]').getBoundingClientRect().width);
await p.keyboard.type('дракон, без рукава');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
await p.fill('.dz-panel [data-pic-note$="|1"]', 'напис: зверху BASGIATH, знизу War College');
await p.dispatchEvent('.dz-panel [data-pic-note$="|1"]', 'change');
await p.waitForTimeout(400);
const m1 = await p.evaluate(() => designJobs['2000901'].units[0].pics.map(x => x.note || ''));
ok(ширина >= 200, 'поле під час набору розгортається (≥200 px), ряд картинок не стрибає', 'ширина ' + ширина);
ok(m1[0] === 'дракон, без рукава' && m1[1] === 'напис: зверху BASGIATH, знизу War College',
  'підписи лягли в самі картинки (Enter — зберегти)', JSON.stringify(m1));

console.log('═══ 2. ДИЗАЙНЕР БАЧИТЬ НОМЕР І ПІДПИС ПІД КОЖНОЮ ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('graphic'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(400);
await p.evaluate(() => { const c = document.querySelector('#dzRoot [data-open="2000901"]'); if(c) c.click(); });
await p.waitForTimeout(600);
const d1 = await p.evaluate(() => ({ підписи: [...document.querySelectorAll('.dz-panel .dz-pic-cap')].map(x => x.textContent),
  номери: [...document.querySelectorAll('.dz-panel .dz-pic-no')].map(x => x.textContent).join(','),
  поля: document.querySelectorAll('.dz-panel [data-pic-note]').length }));
console.log('  ' + JSON.stringify(d1));
ok(d1.підписи.indexOf('дракон, без рукава') >= 0 && d1.підписи.some(t => /BASGIATH/.test(t)) && /1,2/.test(d1.номери) && !d1.поля,
  'у дизайнера: «1 · дракон, без рукава», «2 · напис…» — лише читати', JSON.stringify(d1));

console.log('═══ 3. ПРИБРАЛИ КАРТИНКУ — ЇЇ ПІДПИС ПІШОВ РАЗОМ З НЕЮ ═══');
await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('acct'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(300);
await p.evaluate(() => { const c = document.querySelector('#dzRoot [data-open="2000901"]'); if(c && !document.querySelector('.dz-panel [data-pic-note]')) c.click(); });
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('.dz-panel .dz-pic-x[data-i="0"]').click());
await p.waitForTimeout(500);
const m3 = await p.evaluate(() => ({ pics: designJobs['2000901'].units[0].pics.map(x => x.note || ''),
  номери: document.querySelectorAll('.dz-panel .dz-u-pics .dz-pic-no').length,
  поле: (document.querySelector('.dz-panel [data-pic-note]') || {}).value }));
ok(m3.pics.length === 1 && /BASGIATH/.test(m3.pics[0]) && m3.номери === 0 && /BASGIATH/.test(m3.поле),
  'лишилась одна картинка зі своїм підписом; номер не потрібен', JSON.stringify(m3));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'підписи на картинках ТЗ — на місці');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
