/* КП ЛИШЕ КАРТКАМИ; НА ТЕЛЕФОНІ — ОДРАЗУ В ГАЛЕРЕЮ (04.11).

   Андрій: «зона, де посилання, взагалі не потрібна… головне, щоб не
   поламались карточки… щоб зручно скачувати, одразу в галерею й розсилати
   в інші месенджери». Сторінка КП лишилась (з неї картки беруть обкладинку,
   старі посилання працюють) — прибрано вкладку «Сайт» і кнопки посилання.
   На телефоні «Скачати» → вікно: картки, «Зберегти в галерею / поділитися»
   (navigator.share з файлами), «Скачати по одній»; компʼютер — як доти.

   Запуск:  node tests/kp-cards-phone.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9051;
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
  team: [{ email:'test@loomiq', name:'Оля',       role:'managerb2c' },
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
console.log('═══ 1. РЕДАКТОР КП: «СБИРАННЯ» І «КАРТКИ» Є, «САЙТУ» НЕМАЄ ═══');
const oe = fs.readFileSync(path.join(ROOT, 'offer-edit.html'), 'utf8');
ok(/<button class="tab on" data-view="build">Збирання<\/button>/.test(oe) && /<button class="tab" data-view="cards">Картки<\/button>/.test(oe)
   && !/^\s*<button class="tab" data-view="client">/m.test(oe), 'вкладки: «Збирання» і «Картки», без «Сайту»', 'вкладки не ті');
const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
const гілка = adm.slice(adm.indexOf("if(act === 'cardsDownload'){"), adm.indexOf("if(act === 'pick'){"));
ok(/cardsPhone\(\)\) return cardsPhoneSheet\(files, o\)/.test(гілка) && /zipBlob\(files\)/.test(гілка), 'телефон — вікно карток; компʼютер — як доти (файл чи архів)', 'гілка скачування не та');

console.log('');
console.log('═══ 2. ТЕЛЕФОН: КАРТКИ, «ЗБЕРЕГТИ В ГАЛЕРЕЮ», «ПО ОДНІЙ» ═══');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const r = await p.evaluate(async (png) => {
  const bin = atob(png), u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const files = [{ name: 'kartka-1.png', data: u8 }, { name: 'kartka-2.png', data: u8 }, { name: 'kartka-3.png', data: u8 }];
  let поділились = null, скачано = [];
  navigator.canShare = x => !!(x && x.files && x.files.length);
  navigator.share = async x => { поділились = x.files.map(f => f.name + ':' + f.type); };
  const dd = docDownload; window.docDownload = (h, n) => скачано.push(n);
  docDownload = (h, n) => скачано.push(n);
  window.LQ_CARDS_PHONE = 1;
  cardsPhoneSheet(files, { orderId: '1000042' });
  const s = document.getElementById('cards-sheet');
  const out = { є: !!s, img: s ? s.querySelectorAll('.cards-sheet-l img').length : 0, share: !!(s && s.querySelector('[data-cs="share"]')),
                each: !!(s && s.querySelector('[data-cs="each"]')), phone: cardsPhone() };
  s.querySelector('[data-cs="share"]').click(); await new Promise(r2 => setTimeout(r2, 100));
  s.querySelector('[data-cs="each"]').click(); await new Promise(r2 => setTimeout(r2, 1200));
  out.поділились = поділились; out.скачано = скачано;
  s.querySelector('[data-cs="x"]').click();
  out.закрито = !document.getElementById('cards-sheet');
  /* Телефон без меню «Поділитися» — лише «по одній» і підказка. */
  navigator.canShare = () => false;
  cardsPhoneSheet(files.slice(0, 1), { orderId: '1000042' });
  const s2 = document.getElementById('cards-sheet');
  out.безShare = !!(s2 && !s2.querySelector('[data-cs="share"]') && s2.querySelector('[data-cs="each"]') && /утримуйте/.test(s2.textContent));
  s2.remove();
  docDownload = dd; delete window.LQ_CARDS_PHONE;
  return out;
}, png);
console.log('   ' + JSON.stringify(r));
ok(r.є && r.img === 3 && r.share && r.each && r.phone, 'вікно: три картки, «Зберегти в галерею / поділитися» і «Скачати по одній»', JSON.stringify(r));
ok(r.поділились && r.поділились.length === 3 && r.поділились.every(x => /image\/png$/.test(x)), 'меню телефона отримує всі три картки картинками (PNG)', JSON.stringify(r.поділились));
ok(r.скачано.join() === 'kartka-1.png,kartka-2.png,kartka-3.png', '«По одній» — три окремі файли, не архів', JSON.stringify(r.скачано));
ok(r.закрито && r.безShare, 'закривається; без меню «Поділитися» — «по одній» і підказка «утримуйте»', JSON.stringify(r));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'КП лише картками; на телефоні — одразу в галерею');
process.exit(bad ? 1 : 0);
