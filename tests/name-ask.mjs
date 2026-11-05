/* «ЯК ВАС ЗВАТИ?» (04.11).

   Андрій: «щоб ще було по працівникам імена, вони вписують свої імена, не
   тільки пошти». Хто не вписав імені ні сам (профіль), ні в Команді, — після
   входу невелика картка в кутку (не вікно, роботу не перекриває):
     — «Вписати» відкриває «Мій профіль» з порожнім імʼям (не пошта);
     — збереглось — картка зникла, імʼя в profiles;
     — імʼя вже є (профіль чи Команда) — картки немає;
     — «×» — до кінця сеансу не зʼявляється;
     — «Дивитись як» — картки немає.

   Запуск:  node tests/name-ask.mjs      (з кореня репозиторію)  */
/* (шапка стенду — як у role-switch.mjs)

   Андрій: «краще не обʼєднувати, а перемикати». У людини з двома чи
   трьома ролями зліва перемикач «Зараз»; активна рівно одна роль, і все
   рахується лише з неї: пункти зліва, дошка у відділі, права в картці.
   «Дивитись як людина» показує її стартову роль і той самий перемикач.
   Зняли активну роль — перша з решти; додали — перемикач зʼявляється
   сам; одна роль — перемикача немає. Вибір памʼятає браузер.

   Запуск:  node tests/role-switch.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9071;
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
  team: [{ email:'test@loomiq', name:'',          role:'owner' },
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
await p.waitForTimeout(5500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });







console.log('═══ 1. ІМЕНІ НЕМАЄ — КАРТКА В КУТКУ ═══');
const a = await p.evaluate(() => {
  const d = document.getElementById('name-ask');
  const r = d ? d.getBoundingClientRect() : null;
  return { is: !!d, txt: d ? d.textContent : '', r: r ? { w: r.width, h: r.height, l: r.left, b: innerHeight - r.bottom } : null,
    pos: d ? getComputedStyle(d).position : '' };
});
console.log('   ' + JSON.stringify(a));
ok(a.is && /Як вас звати/.test(a.txt), 'після входу без імені — «Як вас звати?»', JSON.stringify(a));
ok(a.r && a.pos === 'fixed' && a.r.w <= 340 && a.r.h < 200 && a.r.l < 40, 'невелика картка внизу зліва, не вікно на весь екран', JSON.stringify(a.r));

console.log('');
console.log('═══ 2. «ВПИСАТИ» → МІЙ ПРОФІЛЬ → ЗБЕРЕГТИ ═══');
await p.click('#name-ask [data-na="go"]');
await p.waitForTimeout(150);
const b = await p.evaluate(() => ({ open: document.getElementById('me-modal').style.display === 'flex',
  first: document.getElementById('me-first').value, last: document.getElementById('me-last').value }));
ok(b.open && b.first === '' && b.last === '', 'відкрився «Мій профіль», поле імені порожнє (не пошта)', JSON.stringify(b));
await p.fill('#me-first', 'Оля');
await p.fill('#me-last', 'Коваль');
await p.click('#me-save');
await p.waitForTimeout(300);
const c = await p.evaluate(() => ({ card: !!document.getElementById('name-ask'), modal: document.getElementById('me-modal').style.display,
  prof: (contentData.profiles || {})[aclKeyOf('test@loomiq')], who: personName('test@loomiq'), missing: myNameMissing() }));
console.log('   ' + JSON.stringify(c));
ok(!c.card && c.modal === 'none', 'зберегли — вікно закрилось, картки немає', JSON.stringify(c));
ok(c.prof && c.prof.name === 'Оля Коваль' && c.who === 'Оля Коваль' && !c.missing, 'імʼя лягло в профіль, колеги бачать імʼя', JSON.stringify(c));

console.log('');
console.log('═══ 3. ІМʼЯ Є — КАРТКИ НЕМАЄ ═══');
const d = await p.evaluate(() => {
  const r = {};
  nameAskDone = false; nameAskShow(); r.profile = !!document.getElementById('name-ask');
  contentData.profiles = {};
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { name:'Оля' }) : x);
  nameAskDone = false; nameAskShow(); r.team = !!document.getElementById('name-ask');
  return r;
});
ok(!d.profile && !d.team, 'імʼя в профілі чи в Команді — картки немає', JSON.stringify(d));

console.log('');
console.log('═══ 4. «×» — ДО КІНЦЯ СЕАНСУ; «ДИВИТИСЬ ЯК» — НІ ═══');
const e = await p.evaluate(async () => {
  const r = {};
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { name:'' }) : x);
  contentData.team.push({ email:'n@loomiq', name:'Ніна', role:'designer' });
  applyRoleUi();
  seeAsSet('@n@loomiq'); await new Promise(z => setTimeout(z, 80));
  nameAskDone = false; nameAskShow(); r.seeAs = !!document.getElementById('name-ask');
  seeAsSet(''); await new Promise(z => setTimeout(z, 80));
  nameAskDone = false; nameAskShow(); r.again = !!document.getElementById('name-ask');
  const x = document.querySelector('#name-ask [data-na="x"]'); if(x) x.click();
  r.closed = !document.getElementById('name-ask');
  r.skip = sessionStorage.getItem('lq_name_skip');
  nameAskDone = false; nameAskShow(); r.after = !!document.getElementById('name-ask');
  return r;
});
console.log('   ' + JSON.stringify(e));
ok(!e.seeAs, 'власник «дивиться як» людина — картки немає', JSON.stringify(e));
ok(e.again && e.closed && e.skip === '1' && !e.after, '«×» закрила картку, до кінця сеансу вона не повертається', JSON.stringify(e));

ok(!errs.length, 'без помилок на сторінці', JSON.stringify(errs));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
