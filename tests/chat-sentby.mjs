/* БІК ПОВІДОМЛЕННЯ — З ПОЛЯ SITNIKS `sentBy`; ПАМʼЯТЬ НЕ ГУБИТЬСЯ (26.10).

   Володимир: «наші й клієнта — зі сторони клієнта… працює, потім ламається…
   20–30 непрочитаних, а вони давно опрацьовані». Зразок «{ }» з живого
   акаунта: у нашому повідомленні `sentBy` = наша Instagram-сторінка (і, коли
   писали з Sitniks руками, `managerName`), у клієнтському `sentBy` = клієнт.
   Надіслане з Loomiq через API `managerName` не має — доти трималось лише
   на памʼяті про відправлене, яка губилась (ліміт 60, відхилений запис).

   ЕТАЛОН — справжні записи Sitniks (нижче, слово в слово). Нова форма
   запису, яку побачимо, — сюди ж. Перевіряємо:
   1. Запис із `managerName` — наше; наша сторінка вивчена й лежить у
      документі команди (спільно для всіх вкладок).
   2. Наше з Loomiq (без `managerName`, без памʼяті) — праворуч за `sentBy`.
   3. Клієнтське — ліворуч; після нашої відповіді непрочитаного нуль.
   4. Памʼять «це наше» на двох пристроях зливається обʼєднанням.

   Запуск:  node tests/chat-sentby.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9161;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
const OUR_PAGE = '5187381528019612', CLIENT = '1984991775918108';
/* Справжні записи Sitniks (26.10, «{ }» у розмові teyera_velansis). */
const REAL_OURS = { id:'6ada6772d82b698416d7168f', attachmentUrl:'', managerName:'Катерина', attachments:[], messageType:'text',
  messageScope:'standard', sentBy: OUR_PAGE, text:'Добре 😊', isViewedByUser:true,
  createdAt:'2026-10-22T19:43:46.112Z', updatedAt:'2026-10-22T19:44:05.167Z' };
const REAL_CLIENT = { id:'6adf37f51e0195e8bb1aff4f', attachmentUrl:'', storyLink:'', isStoryMention:false, attachments:[], messageType:'text',
  messageScope:'standard', sentBy: CLIENT, text:'12/13', isViewedByUser:true,
  createdAt:'2026-10-26T11:22:29.939Z', updatedAt:'2026-10-26T11:22:29.939Z' };
/* Наше з Loomiq через API: та сама форма, без managerName. */
const API_OURS = (id, text, at) => ({ id, attachmentUrl:'', attachments:[], messageType:'text', messageScope:'standard',
  sentBy: OUR_PAGE, text, isViewedByUser:true, createdAt: at, updatedAt: at });
const CLIENT_MSG = (id, text, at) => Object.assign({}, REAL_CLIENT, { id, text, createdAt: at, updatedAt: at });

let MSGS = [
  CLIENT_MSG('c1', 'Доброго дня, цікавлять худі', '2026-10-22T19:40:00.000Z'),
  REAL_OURS,
  CLIENT_MSG('c2', 'Да, всё верно', '2026-10-25T21:02:00.000Z'),
  API_OURS('a1', 'Підкажіть, як вам зручніше оплатити залишок по замовленню, 2 680 грн', '2026-10-26T07:52:00.000Z'),
  CLIENT_MSG('c3', 'Оплата при получении', '2026-10-26T09:35:00.000Z'),
  API_OURS('a2', 'Передаю ваше замовлення на виробництво, очікуйте на відправку 🤗', '2026-10-26T09:57:00.000Z'),
  REAL_CLIENT
];
let sent = [];
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    const json = (code, b) => { res.writeHead(code, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    if(/\/messages$/.test(u.pathname)){
      if(req.method === 'POST'){
        let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
        let t = ''; try{ t = JSON.parse(body).text; }catch(e){}
        const m = API_OURS('s' + (sent.length + 1), t, new Date().toISOString());
        sent.push(t); MSGS.push(m);
        return json(200, m);
      }
      return json(200, MSGS);
    }
    if(/\/chats$/.test(u.pathname) || /\/chats\?/.test(req.url))
      return json(200, [{ id: CHAT_ID, chatId: CHAT_ID, client:{ clientName:'teyera_velansis', userName:'teyera_velansis' }, lastMessage: MSGS[MSGS.length - 1] }]);
    if(/\/chats\/[0-9a-f]{8,}$/i.test(u.pathname))
      return json(200, { id: CHAT_ID, client:{ clientName:'teyera_velansis', userName:'teyera_velansis' } });
    return json(200, []);
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const ORDER = { id:'1', orderId:'2000299', type:'client', dir:'b2c', name:'teyera_velansis', ig:'teyera_velansis', status:'prorahunok', site:'main',
  payments:[], crmChatId:CHAT_ID, crmChatName:'teyera_velansis', createdAt:'2026-10-20T09:00:00.000Z', hist:[], totalPrice:2680, items:[] };
const ORDER2 = { id:'2', orderId:'2000300', type:'client', dir:'b2c', name:'Інший', ig:'inshyi', status:'prorahunok', site:'main',
  payments:[], crmChatId:'6aa910231444b9f4123817a2', crmChatName:'Інший', createdAt:'2026-10-20T09:00:00.000Z', hist:[], totalPrice:1000, items:[],
  crmUnread: 3, crmTheirs: true, crmAt:'2026-10-26T10:00:00.000Z', crmLast:'Привіт' };
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }], bgApi: { sitniksUrl: HOST + '/crm' } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER, ORDER2]) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.__n="kanbanOrders";\n' +
  '  SeedCol.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col="kanbanOrders"; return d; };\n' +
  '  var set0=Doc.prototype.set; Doc.prototype.set=function(v, opt){\n' +
  '    if(this.__col==="loomiq" && this.__id==="photos" && opt && opt.merge){ Object.assign(window.__CONTENT, JSON.parse(JSON.stringify(v))); }\n' +
  '    if(this.__col==="kanbanOrders"){ var i=window.__ORDERS.findIndex(function(x){ return x.id===this.__id; }.bind(this)); var c=JSON.parse(JSON.stringify(v)); if(i>=0) window.__ORDERS[i]=c; else window.__ORDERS.push(c); }\n' +
  '    return set0.apply(this, arguments); };\n' +
  '  var get0=Doc.prototype.get; Doc.prototype.get=function(){ var id=this.__id;\n' +
  '    if(this.__col==="kanbanOrders"){ var o=window.__ORDERS.filter(function(x){ return x.id===id; })[0]; return Promise.resolve(new Snap(id, o?JSON.parse(JSON.stringify(o)):null)); }\n' +
  '    return get0.apply(this, arguments); };\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ setTimeout(function(){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,JSON.parse(JSON.stringify(o))); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,JSON.parse(JSON.stringify(o)))); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } }, 50); return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.addInitScript(() => { window.LQ_NO_CACHE = 1; });
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });
await p.evaluate(async () => { await openOrderDrawer(orders[0]); chatOpen(orders[0], 'crm'); });
await p.waitForTimeout(2500);

const feed = () => p.evaluate(() => [...document.querySelectorAll('.cw-feed .od-crm-msg')].map(el => ({
  txt: ((el.querySelector('.od-crm-txt') || {}).textContent || '').trim(), mine: el.classList.contains('mine') })));

console.log('═══ 1–2. БОКИ ЗА sentBy: СПРАВЖНІ ЗАПИСИ SITNIKS, БЕЗ ПАМʼЯТІ ═══');
let rows = await feed();
rows.forEach(r => console.log('   ' + (r.mine ? '→ ' : '← ') + r.txt.slice(0, 60)));
const side = t => (rows.find(r => r.txt.indexOf(t) === 0) || {}).mine;
ok(rows.length === MSGS.length, 'усі ' + MSGS.length + ' повідомлень на місці', 'повідомлень ' + rows.length);
ok(side('Добре') === true, 'запис із managerName («Добре 😊», Катерина) — праворуч', 'managerName не впізнано');
ok(side('Підкажіть') === true && side('Передаю') === true, 'наше з Loomiq (без managerName і без памʼяті) — праворуч за sentBy', JSON.stringify(rows.filter(r => /Підкажіть|Передаю/.test(r.txt))));
ok(side('Доброго дня') === false && side('Да, всё') === false && side('Оплата при') === false && side('12/13') === false,
  'клієнт — ліворуч', JSON.stringify(rows.filter(r => !/Підкажіть|Передаю|Добре/.test(r.txt))));
const self = await p.evaluate(() => ({ тут: [...crmSelfIds()], база: (window.__CONTENT || {}).crmSelfIds || [] }));
ok(self.тут.indexOf(OUR_PAGE) >= 0 && self.база.indexOf(OUR_PAGE) >= 0, 'наша сторінка ' + OUR_PAGE + ' вивчена й записана в документ команди', JSON.stringify(self));

console.log('═══ 3. КЛІЄНТ ПИСАВ ОСТАННІМ → НЕПРОЧИТАНЕ; ВІДПОВІЛИ → НУЛЬ, І ОБХІД НЕ ПОВЕРТАЄ ═══');
let u = await p.evaluate(async () => { const o = orders[0]; await crmSweepOnce(); return { unread: +o.crmUnread || 0, theirs: !!o.crmTheirs }; });
ok(u.unread >= 1 || u.theirs, 'останнє від клієнта («12/13») — розмова чекає на відповідь', JSON.stringify(u));
u = await p.evaluate(async () => {
  const o = orders[0];
  await crmSend(o, 'Дякуємо, відправимо завтра');
  await new Promise(r => setTimeout(r, 1500));
  const після = { unread: +o.crmUnread || 0, theirs: !!o.crmTheirs };
  await crmSweepOnce();
  await new Promise(r => setTimeout(r, 300));
  return { після, обхід: { unread: +o.crmUnread || 0, theirs: !!o.crmTheirs } };
});
rows = await feed();
ok(u.після.unread === 0 && !u.після.theirs && u.обхід.unread === 0 && !u.обхід.theirs,
  'відповіли — непрочитаного нуль, і обхід списку (наше останнє, за sentBy) його не повертає', JSON.stringify(u));
ok(side('Дякуємо, відправимо') === true, 'щойно надіслане — праворуч', JSON.stringify(rows.slice(-1)));

console.log('═══ 4. ПАМʼЯТЬ «ЦЕ НАШЕ» З ДВОХ ПРИСТРОЇВ — ОБʼЄДНАННЯ, НЕ ВІДМОВА ═══');
u = await p.evaluate(async () => {
  const o = orders[0];
  const db = window.__ORDERS.find(x => x.id === o.id);
  /* Другий пристрій записав свою відправку (новіша версія в базі). */
  db.crmOut = (db.crmOut || []).concat([{ t:'з іншого пристрою', by:'Олег' }]); db.touchedAt = '2099-01-01T00:00:00.000Z'; db.rev = (+db.rev || 0) + 5;
  crmOutNote(o, 'моя відправка з цього пристрою');
  touchOrder(o); const f = await saveOrders();
  const d2 = window.__ORDERS.find(x => x.id === o.id);
  return { failed: (f || []).length, база: (d2.crmOut || []).map(r => r.t), памʼять: (orders[0].crmOut || []).map(r => r.t) };
});
ok(!u.failed && u.база.indexOf('з іншого пристрою') >= 0 && u.база.indexOf('моя відправка з цього пристрою') >= 0 && u.памʼять.indexOf('з іншого пристрою') >= 0,
  'у базі й у памʼяті обидві відправки — нічиє не загубилось', JSON.stringify(u));

console.log('═══ 5. КЛІЄНТСЬКИЙ sentBy ПОТРАПИВ У «СВОЇ» — РОЗМОВА ЛІКУЄ СПИСОК; ЗБІГ ТЕКСТУ СТОРІНКУ НЕ ВЧИТЬ (28.10) ═══');
/* Відео Андрія (Львівська гуцулочка): уся переписка клієнта праворуч — його
   sentBy лежав у crmSelfIds, бо клієнт написав «Так», а такий текст ми
   колись слали з цієї картки. */
MSGS.push(CLIENT_MSG('c9', 'Дякуємо, відправимо завтра', '2026-10-27T12:02:24.923Z'));   // клієнт повторив наш текст слово в слово
u = await p.evaluate(async ([CLIENT, OUR]) => {
  const o = orders[0];
  /* Отруєний список: і наша сторінка, і клієнт — «свої». */
  contentData.crmSelfIds = [OUR, CLIENT]; window.__CONTENT.crmSelfIds = [OUR, CLIENT];
  crmSelfHere.clear();
  await crmLoadChat(o);                 // перечитати розмову, як при відкритті
  if(chatWin && chatWin.id === o.id) renderChatWin();
  await new Promise(r => setTimeout(r, 1200));
  return { тут: [...crmSelfIds()], база: (window.__CONTENT || {}).crmSelfIds || [] };
}, [CLIENT, OUR_PAGE]);
rows = await feed();
ok(side('Доброго дня') === false && side('12/13') === false && side('Оплата при') === false,
  'клієнт знову ліворуч — його sentBy знято зі «своїх» за розмовою', JSON.stringify(rows.map(r => (r.mine ? '→' : '←') + r.txt.slice(0, 14))));
ok(u.тут.indexOf(OUR_PAGE) >= 0 && u.тут.indexOf(CLIENT) < 0 && u.база.indexOf(CLIENT) < 0 && u.база.indexOf(OUR_PAGE) >= 0,
  'у документі команди лишилась лише наша сторінка (вивчена з managerName / з номера відправки)', JSON.stringify(u));
ok(side('Дякуємо, відправимо') !== undefined && rows.filter(r => r.txt.indexOf('Дякуємо, відправимо') === 0).some(r => r.mine === false),
  'клієнт повторив наш текст слово в слово — його повідомлення ліворуч, сторінка з нього не вчиться', JSON.stringify(rows.filter(r => /Дякуємо/.test(r.txt))));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'бік — за sentBy Sitniks; після відповіді нуль; памʼять не губиться');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
