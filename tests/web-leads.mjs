/* Заявка з сайту не задвоюється (08.10).

   Андрій: «заявка з сайту задвоїлась» — дві картки 1000111. Адмінка,
   відкрита на телефоні й на компʼютері, бачила нову заявку одночасно, і
   кожна заводила свою картку з випадковим id. Тепер id картки — від заявки
   ('web-' + id заявки), і дві адмінки пишуть в один документ. Дублі, що вже
   завелись, прибираються самі — якщо зайву ніхто не чіпав.

   Запуск:  node tests/web-leads.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8895;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
/* 25 повідомлень, найновіші першими по 10. Гортання — лише ?limit&offset,
   ліміт понад 30 — помилка 400: адмінка мусить знайти це сама. */
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
      /* Як може повестись справжній Sitniks: завеликий ліміт — 400, page
         ігнорує, гортає лише зсувом разом із лімітом. */
      const lim = u.searchParams.get('limit'), off = u.searchParams.get('offset');
      if(lim != null && +lim > 30) return json(400, { message:'limit must not be greater than 30' });
      const desc = MSGS.slice().reverse();
      const per = lim != null ? +lim : 10;
      const from = (off != null && lim != null) ? +off : 0;
      return json(200, desc.slice(from, from + per));
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

const ORDER0 = {
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
  'window.__ORDERS=' + JSON.stringify([ORDER0]) + ';\n' +
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
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('═══ ДВІ АДМІНКИ ЗАБИРАЮТЬ ОДНУ ЗАЯВКУ ═══');
/* Дві «вкладки»: кожна бачить заявку L1, кожна заводить картку зі свого
   порожнього списку. Записи — в одну спільну «базу» (за id документа). */
const два = await p.evaluate(async () => {
  const база = {};
  const lead = { id:'L1', ref:{ update: async () => {} }, data:{ name:'Анна', phone:'+380739380068', site:'main', createdAt:new Date().toISOString() } };
  const імпорт = async () => {
    window.webLeadsWatching = false;
    orders.length = 0;
    const was = fbDb.collection;
    fbDb.collection = n => n === 'webLeads'
      ? { where: () => ({ onSnapshot: (cb) => { setTimeout(() => cb({ forEach: f => f({ ref: lead.ref, id: lead.id, data: () => lead.data }) }), 0); return () => {}; } }) }
      : was.call(fbDb, n);
    const ss = window.storeSet;
    window.storeSet = async (k, v) => { if(k === 'orders') v.forEach(o => { база[o.id] = JSON.parse(JSON.stringify(o)); }); return []; };
    webLeadsWatching = false;
    watchWebLeads();
    await new Promise(r => setTimeout(r, 200));
    fbDb.collection = was; window.storeSet = ss;
  };
  await імпорт();
  await імпорт();
  return { документів: Object.keys(база).length, ids: Object.keys(база), номери: Object.values(база).map(o => o.orderId) };
});
console.log('  ' + JSON.stringify(два));
ok(два.документів === 1 && два.ids[0] === 'web-L1', 'дві адмінки, одна заявка — один документ «web-L1», не два', JSON.stringify(два));

console.log('');
console.log('═══ ДУБЛІ, ЩО ВЖЕ ЗАВЕЛИСЬ ═══');
const дублі = await p.evaluate(() => {
  const base = { webId:'L9', type:'lead', status: firstStatusKey(), orderId:'1000111', name:'Анна', items:[], payments:[],
                 createdAt:'2026-10-08T18:39:00.000Z', hist:[{ s:'new', at:'2026-10-08T18:39:00.000Z' }] };
  orders.length = 0;
  orders.push(Object.assign({}, base, { id:'aaa' }), Object.assign({}, base, { id:'bbb' }));
  /* А ще пара, де менеджер уже працював з обома — їх не чіпаємо. */
  const t = Object.assign({}, base, { webId:'L8', orderId:'1000112', hist:[{ s:'new' }, { s:'kp' }] });
  orders.push(Object.assign({}, t, { id:'ccc' }), Object.assign({}, t, { id:'ddd', items:[{ name:'Худі' }] }));
  window.storeSet = async () => [];
  webDupesFix();
  return orders.map(o => o.id).sort().join();
});
ok(/^(aaa|bbb),ccc,ddd$/.test(дублі), 'дубль, якого ніхто не чіпав, прибрано; ті, з якими працювали, — лишились обидва', дублі);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'одна заявка — одна картка');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
