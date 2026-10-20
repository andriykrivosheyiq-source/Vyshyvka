/* ПРОБЛЕМНІ ЗАМОВЛЕННЯ (Андрій, 20.10).

   Будь-хто в картці тисне «!», пише, що не так; розділ «Проблемні
   замовлення» бачить і знімає лише власник. На клієнта й роботу не впливає.

   Запуск:  node tests/problems.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8996;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'designer' }, { email:'boss@loomiq', name:'Володимир', role:'owner' }], b2c:{} };
const ORDERS = [
  { id:'1', orderId:'2000701', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'2', orderId:'1000701', type:'client', name:'Б2Б', status:'new', site:'main', payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 1000, items:[] }
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

console.log('═══ 1. ДИЗАЙНЕР: «!» Є, РОЗДІЛУ НЕМАЄ ═══');
const r1 = await p.evaluate(async () => {
  applyRoleUi();
  const nav = document.querySelector('.nav [data-view="problems"]');
  const U = window.LQDesign.ui, D = window.LQDesign;
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const j = designJobMake('2000701');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка', color:'Чорний', size:'M', qty:1, note:'лого', artKind:'kids' })];
  const d = D.dzNew(); D.dzList(j.units[0], 'graphic').push(d); D.dzQueue(d, 'boss@loomiq');
  openDesign(); U.setTab('graphic'); U.render(document.getElementById('dzRoot'));
  const c = document.querySelector('#dzRoot [data-open="2000701"]'); if(c) c.click();
  await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('.dz-panel [data-do="problem-add"]');
  if(!b) return { err: 'немає «!»', nav: nav && !nav.hidden };
  b.click();
  await new Promise(r => setTimeout(r, 200));
  const ta = document.querySelector('.dz-fixw .dz-fix-t');
  ta.value = 'Не можу завантажити файл вишивки';
  document.querySelector('.dz-fixw [data-fix-go]').click();
  await new Promise(r => setTimeout(r, 600));
  return { nav: !!(nav && !nav.hidden), problems: problemsOf('2000701').map(p => ({ by: p.by, text: p.text, open: p.open })),
           знак: (document.querySelector('.dz-panel .dz-prob-n') || {}).textContent || '' };
});
console.log('  ' + JSON.stringify(r1));
ok(r1.nav === false, 'у дизайнера розділу «Проблемні замовлення» немає', JSON.stringify(r1));
ok(r1.problems && r1.problems.length === 1 && r1.problems[0].by === 'test@loomiq' && /файл вишивки/.test(r1.problems[0].text) && r1.problems[0].open,
  'дизайнер натиснув «!» і написав — проблема записана в замовлення', JSON.stringify(r1));
ok(r1.знак === 'позначено', 'дизайнеру видно лише «позначено», без списку й лічильника', JSON.stringify(r1));

console.log('═══ 2. B2B: «!» У КАРТЦІ ЗАМОВЛЕННЯ ═══');
const r2 = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '1000701');
  openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  const b = document.querySelector('.od-panel [data-act="problem"]');
  if(!b){ closeOrderDrawer(); return { n: 0, job: !!designJobs['1000701'], немає: true }; }
  b.click();
  await new Promise(r => setTimeout(r, 200));
  document.querySelector('.dz-fixw .dz-fix-t').value = 'Не бачу, куди вписати ТТН';
  document.querySelector('.dz-fixw [data-fix-go]').click();
  await new Promise(r => setTimeout(r, 600));
  closeOrderDrawer();
  return { n: problemsOf('1000701').length, job: !!designJobs['1000701'] };
});
ok(r2.немає && r2.n === 0 && !r2.job, 'у картці B2B «!» немає — лише B2C (20.10)', JSON.stringify(r2));

console.log('═══ 3. ВЛАСНИК: РОЗДІЛ, ЧИСЛО, «ЗНЯТИ» ═══');
const r3 = await p.evaluate(async () => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  applyRoleUi(); paintProblems();
  const nav = document.querySelector('.nav [data-view="problems"]');
  const n = (document.querySelector('[data-nav-n="problems"]') || {}).textContent || '';
  nav.click();
  await new Promise(r => setTimeout(r, 300));
  const rows = [...document.querySelectorAll('#problemsRoot .prob-row')].map(r => r.textContent.replace(/\s+/g, ' '));
  window.prompt = () => 'Показали, де кнопка';
  document.querySelector('#problemsRoot .prob-row [data-prob-close]').click();
  await new Promise(r => setTimeout(r, 500));
  const після = document.querySelectorAll('#problemsRoot .prob-row').length;
  const n2 = (document.querySelector('[data-nav-n="problems"]') || {}).textContent || '';
  const закрита = Object.values(problems).filter(p => !p.open)[0] || null;
  return { navOn: !nav.hidden, n, rows, після, n2, закрита: закрита && { by: закрита.closedBy, how: закрита.how } };
});
console.log('  ' + JSON.stringify(r3));
ok(r3.navOn && r3.n === '1', 'власник бачить розділ «Проблемні замовлення» з числом 1', JSON.stringify(r3));
ok(r3.rows.length === 1 && r3.rows.some(t => /2000701/.test(t) && /файл вишивки/.test(t) && /Оля/.test(t)),
  'у списку — номер, хто позначив і текст', JSON.stringify(r3.rows));
ok(r3.після === 0 && r3.n2 === '' && r3.закрита && r3.закрита.how === 'Показали, де кнопка',
  '«Зняти» — проблема зникла зі списку, числа немає, у замовленні лишився слід «як вирішили»', JSON.stringify(r3));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'проблеми працюють');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
