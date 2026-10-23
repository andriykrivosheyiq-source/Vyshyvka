/* ОТРИМУВАЧ НОВОЇ ПОШТИ — З ПЕРЕПИСКИ, НЕ НІК (23.10).

   1. Даних у переписці немає — поле отримувача порожнє (нік не йде).
   2. Клієнт написав «Прізвище Імʼя + телефон» — підставляється звідти.
   3. Імʼя й телефон окремими повідомленнями — теж знаходиться.
   4. Наш власний текст з прикладом не береться; вписане руками — старше.
   5. B2B — імʼя з картки, нік розмови — ні.

   Запуск:  node tests/ship-recipient.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9047;
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
  products: { retail: { tee: 600, hoodie: 1200 }, retailReady: { tee: 450, hoodie: 950 },
              retailCost: { tee: 300, hoodie: 600 }, retailCostReady: { tee: 250, hoodie: 520 } }
};
const ORDERS = [
  { id:'1', orderId:'2000301', type:'client', dir:'b2c', name:'Асія', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[{ sum:300, at:'2026-10-18T09:00:00.000Z', kind:'prepay' }], hist:[], createdAt:'2026-10-18T09:00:00.000Z', crmChatId:'c1', crmChatName:'Асія', totalPrice: 0, items:[] },
  { id:'3', orderId:'2000390', type:'client', name:'Без напряму', status:'lead', site:'main', crmChatId:'c3', crmChatName:'Без напряму',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
  { id:'b', orderId:'1000390', type:'client', name:'Опт', status:'lead', site:'main',
    payments:[], hist:[], createdAt:'2026-10-18T10:00:00.000Z', totalPrice: 0, items:[] },
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
const r = await p.evaluate(() => {
  const o = { id:'s1', orderId:'2000950', dir:'b2c', type:'client', name:'Діана-косметолог', crmChatName:'diana_kosmetolog', crmChatId:'c9', phone:'', items:[], payments:[], hist:[] };
  const out = {};
  crmChat[o.id] = { chatId:'c9', msgs: [] };
  out.empty = shipVals(o).name;
  crmChat[o.id].msgs = [
    { mine:true,  text:'Напишіть, будь ласка, ваші дані для Нової пошти: Прізвище Імʼя, телефон, місто й відділення', at:'1' },
    { mine:false, text:'Петренко Діана\n067 123 45 67\nКиїв, відділення 25', at:'2' } ];
  const v1 = shipVals(o); out.one = { n: v1.name, p: v1.phone, f: v1.fromChat };
  crmChat[o.id].msgs = [
    { mine:false, text:'Добрий день, хочу худі', at:'1' },
    { mine:false, text:'Олена Коваль', at:'2' },
    { mine:false, text:'+38 (050) 987-65-43', at:'3' } ];
  const v2 = shipVals(o); out.split = { n: v2.name, p: v2.phone };
  crmChat[o.id].msgs = [ { mine:true, text:'Наприклад: Петренко Іван 0671112233', at:'1' } ];
  out.ours = shipVals(o).name + '|' + shipVals(o).phone;
  crmChat[o.id].msgs = [ { mine:false, text:'Петренко Діана 0671234567', at:'1' } ];
  o.ship = { name:'Коваленко Марія', phone:'+380631112233' };
  const v3 = shipVals(o); out.manual = { n: v3.name, p: v3.phone, f: v3.fromChat };
  const b = { id:'b1', orderId:'1000950', dir:'b2b', type:'client', name:'Іван Іваненко', crmChatName:'ivan_shop', crmChatId:'c10', phone:'+380671000000', items:[], payments:[], hist:[] };
  crmChat[b.id] = { chatId:'c10', msgs: [] };
  out.b2b = shipVals(b).name;
  return out;
});
console.log('   ' + JSON.stringify(r));
ok(r.empty === '', 'у переписці даних немає — отримувач порожній, ніку там немає', JSON.stringify(r.empty));
ok(r.one.n === 'Петренко Діана' && r.one.p === '+380671234567' && r.one.f, 'клієнт написав «Петренко Діана / 067 123 45 67» — підставлено звідти, з позначкою «з переписки»', JSON.stringify(r.one));
ok(r.split.n === 'Олена Коваль' && r.split.p === '+380509876543', 'імʼя й телефон окремими повідомленнями — знайдено обидва', JSON.stringify(r.split));
ok(r.ours === '|', 'наш текст з прикладом не береться', r.ours);
ok(r.manual.n === 'Коваленко Марія' && r.manual.p === '+380631112233' && !r.manual.f, 'вписане руками — старше за переписку', JSON.stringify(r.manual));
ok(r.b2b === 'Іван Іваненко', 'B2B: імʼя з картки, нік розмови не підставляється', r.b2b);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? 'розходжень: ' + bad : 'отримувач — з переписки, ніколи не нік');
process.exit(bad ? 1 : 0);
