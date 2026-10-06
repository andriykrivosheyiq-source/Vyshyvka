/* Вся переписка з Sitniks, а не останні десять; час — за Києвом.

   Андрій (06.10): у CRM «10 повідомлень», а в Sitniks розмова довша — перше
   звернення й фото клієнтки до нас не дійшли; час у нас на дві-три години
   менший. Sitniks віддає лише останню сторінку, а час — у UTC.

   Запуск:  node tests/crm-pages.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8891;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
/* 25 повідомлень, Sitniks віддає найновіші першими по 10. Розмір сторінки
   він не міняє (limit ігнорує), а наступну дає за ?page=N — так ми й
   перевіряємо, що адмінка сама знайде гортання. */
const T0 = Date.parse('2026-10-06T07:00:00Z');
let MSGS = Array.from({ length:25 }, (_, i) => ({
  id:'m' + (i + 1), createdAt:new Date(T0 + i * 60000).toISOString(),
  text:'Повідомлення ' + (i + 1),
  ...(i % 2 ? { user:{ name:'Даша' } } : { client:{ clientName:'Diana Rudenko', userName:'diana' } })
}));
const asked = [];
let sent = [];
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    const json = (code, b) => { res.writeHead(code, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, {
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    if(/\/messages$/.test(u.pathname)){
      if(req.method === 'POST'){
        let body = ''; req.on('data', c => body += c);
        await new Promise(r => req.on('end', r));
        try{ sent.push(JSON.parse(body).text); }catch(e){}
        return json(200, { ok:true });
      }
      asked.push(u.search);
      const page = +(u.searchParams.get('page') || 1);
      const desc = MSGS.slice().reverse();
      return json(200, desc.slice((page - 1) * 10, page * 10));
    }
    if(/\/chats\/[0-9a-f]{8,}$/i.test(u.pathname))
      return json(200, { id:CHAT_ID, client:{ clientName:'Anastasia Dera', userName:'asia_dera' } });
    return json(200, []);
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, ''));
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

const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Diana Rudenko', instagram:'diana',
  ig:'diana', phone:'+380670001001', status:'kp', site:'main', payments:[],
  crmChatId:CHAT_ID, crmChatName:'Diana Rudenko',
  createdAt:new Date().toISOString(), hist:[], totalPrice:12000,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000 }]
};
const CONTENT = { team: [], bgApi: { sitniksUrl: HOST + '/crm' } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(async () => { await openOrderDrawer(orders[0]); chatOpen(orders[0], 'crm'); });
await p.waitForTimeout(2200);


const feed = () => p.evaluate(() => [...document.querySelectorAll('.cw-feed .od-crm-msg')].map(el => ({
  txt: ((el.querySelector('.od-crm-txt') || {}).textContent || '').trim(),
  at: ((el.querySelector('.od-crm-at') || {}).textContent || '').trim()
})));

console.log('═══ УСЯ РОЗМОВА ═══');
let rows = await feed();
console.log('  на екрані: ' + rows.length + ' · запити: ' + asked.join(' '));
ok(rows.length === 25, 'усі 25 повідомлень, а не останні 10', 'на екрані ' + rows.length);
ok(rows[0] && rows[0].txt === 'Повідомлення 1' && rows[24].txt === 'Повідомлення 25',
  'від першого до останнього, по порядку', 'порядок: ' + rows.map(r => r.txt.split(' ')[1]).join(','));
const way = await p.evaluate(() => JSON.parse(localStorage.getItem('crmPageWay') || 'null'));
ok(way && way.next === 'page', 'знайдено гортання ?page=N і запамʼятовано', 'спосіб: ' + JSON.stringify(way));

console.log('');
console.log('═══ ЧАС ЗА КИЄВОМ ═══');
console.log('  перше: ' + rows[0].at);
ok(/10:00/.test(rows[0].at), '07:00 UTC показано як 10:00 за Києвом', 'час: ' + rows[0].at);

console.log('');
console.log('═══ ОПИТУВАННЯ НЕ ОБРІЗАЄ СТРІЧКУ ═══');
MSGS.push({ id:'m26', createdAt:new Date(T0 + 25 * 60000).toISOString(), text:'Чекаю',
            client:{ clientName:'Diana Rudenko', userName:'diana' } });
asked.length = 0;
await p.evaluate(() => crmPollOnce(orders[0]));
await p.waitForTimeout(400);
rows = await feed();
ok(rows.length === 26 && rows[25].txt === 'Чекаю', 'нове дописалось, стара частина на місці (26)',
   'після опитування: ' + rows.length);
ok(asked.length === 1, 'опитування — один запит, без гортання', 'запитів: ' + asked.length);
/* Видалене у свіжій сторінці — червоним слідом */
MSGS = MSGS.filter(m => m.id !== 'm24');
await p.evaluate(() => crmPollOnce(orders[0]));
await p.waitForTimeout(400);
const gone = await p.evaluate(() => (crmChat[orders[0].id].msgs || []).filter(m => m.gone).map(m => m.text));
ok(gone.join() === 'Повідомлення 24', 'видалене з розмови лишилось слідом «видалено»', 'видалені: ' + JSON.stringify(gone));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
