/* Наші фото в переписці — одразу (08.10).

   Андрій: «фото надсилаються, а в діалозі не показуються, або через хвилин
   5». Текст ставав у стрічку одразу, фото — ні: стрічку беремо з Sitniks, а
   власні вкладення він віддає із запізненням або не віддає зовсім.

   Сценарії, як поводиться справжній Sitniks:
     А. фото не повертає зовсім;
     Б. повертає за кілька хвилин — своєю адресою (CDN Instagram) і з тим
        номером, що віддав у відповідь на надсилання;
     В. повертає без номера — впізнаємо за часом і кількістю фото;
     Г. відмовляє — бульбашка зникає, фото повертаються в смужку;
     Д. перезавантаження — надіслане лишається.

   Запуск:  node tests/crm-pics.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8893;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
/* 25 повідомлень, найновіші першими по 10. Гортання — лише ?limit&offset,
   ліміт понад 30 — помилка 400: адмінка мусить знайти це сама. */
const T0 = Date.parse('2026-10-06T07:00:00Z');
let MSGS = [
  { id:'m1', createdAt:new Date(Date.now() - 600000).toISOString(), text:'Добрий день, хочу худі', client:{ clientName:'Diana Rudenko', userName:'diana' } },
  { id:'m2', createdAt:new Date(Date.now() - 500000).toISOString(), text:'Вітаю! Надішлю макет', user:{ name:'Даша' } }];
const asked = [];
let sent = [], posted = [], POST_DELAY = 1500, POST_FAIL = false, NEXT_ID = 1;
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    const json = (code, b) => { res.writeHead(code, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, {
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    /* Будь-яка відправка (і /messages/file теж) — однаково: відмова чи номер. */
    if(req.method === 'POST' && POST_FAIL){
      req.resume(); await new Promise(r => req.on('end', r));
      return json(500, { message:'internal' });
    }
    if(/\/messages$/.test(u.pathname)){
      if(req.method === 'POST'){
        let body = ''; req.on('data', c => body += c);
        await new Promise(r => req.on('end', r));
        let j = null; try{ j = JSON.parse(body); }catch(e){}
        await new Promise(r => setTimeout(r, POST_DELAY));
        if(POST_FAIL) return json(500, { message:'internal' });
        const id = 'out' + (NEXT_ID++);
        posted.push({ id, j, at: new Date().toISOString() });
        return json(200, { id });
      }
      asked.push(u.search);
      /* Як може повестись справжній Sitniks: завеликий ліміт — 400, page
         ігнорує, гортає лише зсувом разом із лімітом. */
      return json(200, MSGS.slice().reverse());
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
  /* Картинки з хмари й з CDN Instagram — справжні, інакше браузер замінить
     їх посиланням (crmMediaFallback), і тест мірятиме не те. */
  if(/res\.cloudinary\.com|cdninstagram\.com/.test(u))
    return r.fulfill({ contentType:'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
  return r.abort();
});
const boot = async () => {
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(5500);
  await p.evaluate(async () => {
    let n = 0;
    window.uploadCloudinary = async () => 'https://res.cloudinary.com/demo/image/upload/ph' + (++n) + '.jpg';
    await openOrderDrawer(orders[0]); chatOpen(orders[0], 'crm');
  });
  await p.waitForTimeout(2000);
};
await boot();
const send = (n) => p.evaluate(n => {
  const pics = [];
  for(let i = 0; i < n; i++){
    const c = document.createElement('canvas'); c.width = 20; c.height = 20;
    c.getContext('2d').fillRect(0, 0, 10 + i, 10);
    const bin = atob(c.toDataURL('image/jpeg').split(',')[1]); const a = new Uint8Array(bin.length);
    for(let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
    const blob = new Blob([a], { type:'image/jpeg' });
    pics.push({ blob, url: URL.createObjectURL(blob) });
  }
  chatWin.pics = pics.slice();
  window.__sendDone = false;
  chatSendPics(orders[0], pics, '').then(() => { window.__sendDone = true; });
}, n);
const feed = () => p.evaluate(() => [...document.querySelectorAll('.cw-feed .od-crm-msg')].map(el => ({
  mine: el.classList.contains('mine'), pending: el.classList.contains('pending'), gone: el.classList.contains('gone'),
  imgs: [...el.querySelectorAll('img')].map(i => i.getAttribute('src')),
  txt: ((el.querySelector('.od-crm-txt') || {}).textContent || '').trim(),
  at: ((el.querySelector('.od-crm-at') || {}).textContent || '').trim() })));
const pics = rows => rows.filter(r => r.mine && r.imgs.length);
const poll = () => p.evaluate(() => crmPollOnce(orders[0]));

console.log('═══ А. ОДРАЗУ ПІСЛЯ НАТИСКУ ═══');
await send(1);
await p.waitForTimeout(300);
let r = await feed();
console.log('  ' + JSON.stringify(pics(r)));
ok(pics(r).length === 1 && pics(r)[0].pending, 'фото вже в стрічці праворуч, з позначкою «надсилаю…» — ще до відповіді Sitniks', JSON.stringify(r));
await p.waitForFunction(() => window.__sendDone, null, { timeout: 15000 });
await p.waitForTimeout(300);
r = await feed();
ok(pics(r).length === 1 && !pics(r)[0].pending && /res\.cloudinary\.com/.test(pics(r)[0].imgs[0]),
  'Sitniks прийняв — позначка «надсилаю…» знялась, фото стоїть', JSON.stringify(pics(r)));
await poll(); await p.waitForTimeout(300);
await poll(); await p.waitForTimeout(300);
r = await feed();
ok(pics(r).length === 1 && !r.some(x => x.gone), 'Sitniks фото не повернув — наше не зникає після перечитування стрічки й не стає «видаленим»', JSON.stringify(r));

console.log('');
console.log('═══ Б. SITNIKS ПОВЕРНУВ ЗА КІЛЬКА ХВИЛИН — ЗІ СВОЇМ НОМЕРОМ ═══');
const перший = posted[posted.length - 1];
/* Зʼявилось у стрічці пізніше, але час у нього — мить надсилання. */
MSGS.push({ id: перший.id, createdAt: перший.at, text:'',
  attachments:[{ mediaType:'image', mediaUrl:'https://scontent.cdninstagram.com/v/abc1.jpg' }],
  attachmentUrl:'https://scontent.cdninstagram.com/v/abc1.jpg', user:{ name:'Loomiq' } });
await poll(); await p.waitForTimeout(400);
r = await feed();
console.log('  ' + JSON.stringify(pics(r)));
ok(pics(r).length === 1 && /cdninstagram/.test(pics(r)[0].imgs[0]) && !r.some(x => x.gone),
  'повернуте Sitniks заступило наше — без дубля, без «видалено»', JSON.stringify(pics(r)));

console.log('');
console.log('═══ В. ТРИ ФОТО, SITNIKS ПОВЕРТАЄ БЕЗ НОМЕРА ═══');
await send(3);
await p.waitForTimeout(300);
r = await feed();
ok(pics(r).length === 2 && pics(r)[1].imgs.length === 3 && pics(r)[1].pending, 'три фото — одразу однією бульбашкою «надсилаю…»', JSON.stringify(pics(r)));
await p.waitForFunction(() => window.__sendDone, null, { timeout: 15000 });
MSGS.push({ id:'srv-x', createdAt: posted[posted.length - 1].at, text:'',
  attachments:['a','b','c'].map(x => ({ mediaType:'image', mediaUrl:'https://scontent.cdninstagram.com/v/' + x + '.jpg' })) });
await poll(); await p.waitForTimeout(400);
r = await feed();
ok(pics(r).length === 2 && /cdninstagram/.test(pics(r)[1].imgs[0]) && pics(r)[1].imgs.length === 3,
  'повернуте без номера впізнано за часом і кількістю — одна бульбашка, не дві', JSON.stringify(pics(r)));

console.log('');
console.log('═══ Г. SITNIKS ВІДМОВИВ ═══');
POST_FAIL = true; POST_DELAY = 50;
await p.evaluate(() => { window.__toasts = []; const t = window.toast; window.toast = function(m){ window.__toasts.push(m); return t.apply(this, arguments); }; });
await send(1);
await p.waitForTimeout(150);
const мить = await feed();
await p.waitForFunction(() => window.__sendDone, null, { timeout: 60000 });
await p.waitForTimeout(300);
r = await feed();
const смужка = await p.evaluate(() => (chatWin.pics || []).length);
ok(pics(мить).length === 3 && pics(r).length === 2 && смужка === 1,
  'не прийняв — бульбашка зникла, фото повернулось у смужку для повтору', JSON.stringify({ мить: pics(мить).length, після: pics(r).length, смужка }));
POST_FAIL = false; POST_DELAY = 300;
await p.evaluate(() => { chatWin.pics = []; renderChatWin(); });

console.log('');
console.log('═══ Д. ПЕРЕЗАВАНТАЖЕННЯ ═══');
MSGS = MSGS.filter(m => !/^out|^srv/.test(m.id));      // Sitniks «забув» наші фото
await send(1);
await p.waitForFunction(() => window.__sendDone, null, { timeout: 15000 });
r = await feed();
ok(pics(r).length === 3 && pics(r)[2].imgs.length === 1 && /cloudinary/.test(pics(r)[2].imgs[0]),
  'нове фото через хвилину після попереднього — окремою бульбашкою, не «злипається» з уже показаним', JSON.stringify(pics(r).map(x => x.imgs.length)));
const збережено = await p.evaluate(() => JSON.parse(JSON.stringify(orders[0].crmPicsOut || [])));
const o2 = Object.assign({}, ORDER, { crmPicsOut: збережено });
fbstub = fbstub.replace(/window\.__ORDERS=[^;]*;/, 'window.__ORDERS=' + JSON.stringify([o2]) + ';');
await boot();
r = await feed();
ok(збережено.length >= 1 && збережено.every(e => /^https:/.test(e.urls[0])) && pics(r).length >= 1,
  'після перезавантаження надіслані фото на місці (у картці — адреси хмари, не тимчасові blob:)', JSON.stringify({ збережено: збережено.length, на_екрані: pics(r).length }));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'наші фото — у стрічці одразу й назавжди');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
