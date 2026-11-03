/* tests/chat-who.mjs — НІК І ІМʼЯ КЛІЄНТА ПІДТЯГУЮТЬСЯ, ПРОФІЛЬ — ОДНИМ КЛІКОМ (03.11.2026).

   B2B #1000306: на картці й у прорахунку «чат 68ee4bc0…» замість ніка,
   «діалог не веде на переписку». Причини: імʼя питалось у Sitniks один раз
   і без повтору, заглушка «чат <номер>» лягала в імʼя й у поле Instagram і
   ніщо її вже не міняло; Sitniks, що не знає розмови, давав лише «код 404».
     1. обхід розмов кладе імʼя й нік поверх заглушки;
     2. у шапці B2B і в B2C — «@нік ↗» на сторінку клієнта в Instagram;
     3. заглушка в полі Instagram не стає посиланням;
     4. кнопка «Instagram» у B2B відкриває переписку;
     5. Sitniks не знає розмови — у вікні словами, що робити, а не «код 404»;
     6. привʼязка B2C без імені не пише «чат <номер>».
   Запуск: node tests/chat-who.mjs (у pre-commit з LQ_CHAT=1). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9171;
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
  if(u.pathname.indexOf('/crm/') === 0){ if(u.pathname.includes(MISSING)){ res.writeHead(404,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); return res.end(JSON.stringify({message:'Chat not found'})); }
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
      return json(200, [{ id: CHAT_ID, chatId: CHAT_ID, client:{ clientName:'Тея Веланс', userName:'teyera_velansis' }, lastMessage: MSGS[MSGS.length - 1] }]);
    if(/\/chats\/[0-9a-f]{8,}$/i.test(u.pathname))
      return json(200, { id: CHAT_ID, client:{ clientName:'Тея Веланс', userName:'teyera_velansis' } });
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

const ORDER = { id:'1', orderId:'1000306', type:'client', name:'чат '+CHAT_ID, ig:'чат '+CHAT_ID, status:'lead', site:'main',
  payments:[], crmChatId:CHAT_ID, crmChatName:'чат '+CHAT_ID, createdAt:'2026-10-20T09:00:00.000Z', hist:[], totalPrice:2680, items:[] };
const MISSING = '68ee4bc0f8552075ed013575';
const ORDER3 = { id:'3', orderId:'1000307', type:'client', name:'чат '+MISSING, ig:'чат '+MISSING, status:'lead', site:'main',
  payments:[], crmChatId:MISSING, crmChatName:'чат '+MISSING, createdAt:'2026-10-20T09:00:00.000Z', hist:[], totalPrice:0, items:[] };
const ORDER2 = { id:'2', orderId:'2000300', type:'client', dir:'b2c', name:'Інший', ig:'inshyi', crmNick:'inshyi', status:'prorahunok', site:'main',
  payments:[], crmChatId:'6aa910231444b9f4123817a2', crmChatName:'Інший', createdAt:'2026-10-20T09:00:00.000Z', hist:[], totalPrice:1000, items:[],
  crmUnread: 3, crmTheirs: true, crmAt:'2026-10-26T10:00:00.000Z', crmLast:'Привіт' };
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }], bgApi: { sitniksUrl: HOST + '/crm' } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER, ORDER2, ORDER3]) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
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


const toasts = [];
await p.exposeFunction('__toastSeen', t => toasts.push(String(t)));
await p.evaluate(() => { const t0 = window.toast; window.toast = function(m){ try{ window.__toastSeen(m); }catch(e){} return t0 && t0.apply(this, arguments); }; });

console.log('═══ 1. ОБХІД РОЗМОВ КЛАДЕ ІМʼЯ Й НІК ПОВЕРХ ЗАГЛУШКИ «чат …» ═══');
await p.evaluate(() => crmSweepOnce());
await p.waitForTimeout(1500);
const r1 = await p.evaluate(() => { const o = orders.find(x => x.orderId === '1000306'); return { name:o.name, chat:o.crmChatName, nick:o.crmNick, ig:o.ig, db:(window.__ORDERS.find(x => x.id === '1') || {}).name }; });
console.log('  ' + JSON.stringify(r1));
ok(r1.name === 'Тея Веланс' && r1.chat === 'Тея Веланс' && r1.nick === 'teyera_velansis' && r1.ig === 'teyera_velansis',
  'картка #1000306: імʼя «Тея Веланс», нік teyera_velansis — замість «чат 6aa9…»', 'заглушка лишилась: ' + JSON.stringify(r1));
ok(r1.db === 'Тея Веланс', 'і записано в базу', 'у базі: ' + r1.db);

console.log('═══ 2. «@нік ↗» — СТОРІНКА КЛІЄНТА В INSTAGRAM (B2B і B2C) ═══');
await p.evaluate(async () => { await openOrderDrawer(orders.find(x => x.orderId === '1000306')); });
await p.waitForTimeout(800);
const r2 = await p.evaluate(() => { const a = document.querySelector('#order-drawer .od-ig-who a.od-crm-ig, .od-ig-who a.od-crm-ig');
  const o2 = orders.find(x => x.orderId === '2000300');
  return { href: a && a.getAttribute('href'), txt: a && a.textContent, b2c: crmWhoHtml(o2) }; });
console.log('  ' + JSON.stringify(r2));
ok(r2.href === 'https://instagram.com/teyera_velansis' && /@teyera_velansis ↗/.test(r2.txt || ''), 'шапка B2B: «@teyera_velansis ↗» веде на профіль', 'у шапці немає посилання: ' + JSON.stringify(r2));
ok(/href="https:\/\/instagram\.com\/inshyi"/.test(r2.b2c) && /↗/.test(r2.b2c), 'B2C: підпис клієнта — теж посилання на профіль', 'B2C без посилання: ' + r2.b2c);

console.log('═══ 3. ЗАГЛУШКА В ПОЛІ INSTAGRAM НЕ СТАЄ ПОСИЛАННЯМ ═══');
const r3 = await p.evaluate(() => { const o = orders.find(x => x.orderId === '1000307'); return { html: crmWhoHtml(o), label: crmWhoLabel(o), kp: calcTargetWho(o) }; });
console.log('  ' + JSON.stringify(r3));
ok(!/instagram\.com/.test(r3.html) && !/чат 68ee/.test(r3.html) && /ще не підтягнулось/.test(r3.html), 'без ніка — «імʼя з Sitniks ще не підтягнулось», не instagram.com/чат…', 'заглушка стала посиланням: ' + r3.html);
ok(!/чат 68ee/.test(r3.kp), 'прорахунок «Збираємо пропозицію для …» — без «чат 68ee…»', 'прорахунок: ' + r3.kp);

console.log('═══ 4. КНОПКА «INSTAGRAM» У B2B ВІДКРИВАЄ ПЕРЕПИСКУ ═══');
const b = await p.$('.od-foot [data-ch="ig"]');
if(b) await b.click();
await p.waitForTimeout(3000);
const r4 = await p.evaluate(() => ({ win: window.chatWin ? chatWin.kind : null, txt: (document.querySelector('.cw') || document.body).innerText.slice(0, 2000) }));
ok(r4.win === 'crm' && /Доброго дня, цікавлять худі/.test(r4.txt), 'вікно розмови відкрилось, переписка на місці', 'переписки немає: ' + JSON.stringify(r4).slice(0, 300));
await p.evaluate(() => { try{ chatClose(); }catch(e){} });

console.log('═══ 5. SITNIKS НЕ ЗНАЄ РОЗМОВИ — СЛОВАМИ, ЩО РОБИТИ ═══');
await p.evaluate(async () => { const o = orders.find(x => x.orderId === '1000307'); await openOrderDrawer(o); chatOpen(o, 'crm'); });
await p.waitForTimeout(3000);
const r5 = await p.evaluate(() => (document.querySelector('.cw-load') || {}).textContent || '');
console.log('  ' + r5.slice(0, 200));
ok(/не знайшов цю розмову/.test(r5) && /chats\/dialog/.test(r5) && /🔗/.test(r5), 'вікно каже: Sitniks не знайшов розмову — привʼяжіть заново посиланням на діалог', 'у вікні: ' + r5);
await p.evaluate(() => { try{ chatClose(); }catch(e){} });
toasts.length = 0;
await p.evaluate(async () => { const o = orders.find(x => x.orderId === '1000307'); await crmBindUrl(o, 'https://web.sitniks.com/1503/chats/dialog/' + '68ee4bc0f8552075ed013575'); });
await p.waitForTimeout(2500);
const r5b = await p.evaluate(() => ({ url: orders.find(x => x.orderId === '1000307').crmUrl, name: orders.find(x => x.orderId === '1000307').name }));
ok(toasts.some(t => /не знайшов цю розмову \(404\)/.test(t)), 'привʼязали посилання, якого Sitniks не знає, — одразу кажемо', 'мовчки: ' + JSON.stringify(toasts));
ok(/\/chats\/dialog\/68ee/.test(r5b.url || ''), 'адреса діалогу памʼятається в картці', 'адреси немає: ' + JSON.stringify(r5b));
const r5c = await p.evaluate(() => crmWhoHtml(orders.find(x => x.orderId === '1000307')));
ok(/href="https:\/\/web\.sitniks\.com\/1503\/chats\/dialog\/68ee[^"]*"[^>]*>Sitniks ↗/.test(r5c), 'ніка немає — «Sitniks ↗» відкриває саму розмову', 'без посилання на Sitniks: ' + r5c);

console.log('═══ 6. ПРИВʼЯЗКА В B2C БЕЗ ІМЕНІ НЕ ПИШЕ «чат <номер>» ═══');
const r6 = await p.evaluate(async () => {
  const o = orders.find(x => x.orderId === '2000300'); o.name = ''; o.crmChatName = ''; delete o.crmNick; o.ig = '';
  await designBindChat(o, 'https://web.sitniks.com/1503/chats/dialog/68ee4bc0f8552075ed013575');
  await new Promise(r => setTimeout(r, 2500));
  return { name: o.name, chat: o.crmChatName, ig: o.ig };
});
console.log('  ' + JSON.stringify(r6));
ok(!/чат /.test(r6.name + r6.chat + r6.ig), 'імені немає — у картці порожньо, а не «чат 68ee…»', 'заглушка: ' + JSON.stringify(r6));

ok(!errs.length, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ chat-who: нік і імʼя підтягуються, профіль — одним кліком');
process.exit(bad ? 1 : 0);
