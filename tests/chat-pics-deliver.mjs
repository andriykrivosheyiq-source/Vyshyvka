/* КАРТИНКИ В INSTAGRAM: ПО ОДНІЙ, СТИСНУТІ, З ЧЕСНИМИ ПОЗНАЧКАМИ (02.11).

   Андрій: «картинка показує, що надіслано, а по факту не доходить… після
   КП тиснемо скрипт із картками — і не завжди вона надсилалась». Причини:
   картки й макети летіли повнорозмірними PNG (Instagram такі відкидає
   мовчки), усі картки — одним повідомленням зі списком адрес (Instagram
   бере одну на повідомлення), а ✓✓ ставилась, щойно Sitniks дав номер.

   1. Скрипт «{картки}» після КП: кожна картка — своє повідомлення з однією
      картинкою; усе, що йде в хмару, — JPEG не більше 2000 px.
   2. ✓ — Sitniks прийняв; ✓✓ — лише коли картка повернулась у переписку з
      картинкою; та, що не повернулась за дві хвилини, — жовта «перевірте у
      клієнта» з «Повторити», і «Повторити» шле її знову.
   3. Адреса з хмари без файлу (картка дизайну → «Надіслати клієнту») теж
      стискається — перетворенням Cloudinary в адресі.
   4. Sitniks відмовив по одній картці — вона червона з «Повторити», решта
      пішла.

   Запуск:  node tests/chat-pics-deliver.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9314;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
const CHAT_ID = '6aa910231444b9f4123817a1';
let MSGS = [
  { id:'m1', createdAt:new Date(Date.now() - 600000).toISOString(), text:'Добрий день, хочу худі', client:{ clientName:'Diana Rudenko', userName:'diana' } },
  { id:'m2', createdAt:new Date(Date.now() - 500000).toISOString(), text:'Вітаю! Зараз надішлю прорахунок', user:{ name:'Даша' } }];
let posted = [], NEXT_ID = 1, FAIL_SUB = '';
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    const json = (code, b) => { res.writeHead(code, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    if(/\/messages$/.test(u.pathname)){
      if(req.method === 'POST'){
        let body = ''; req.on('data', c => body += c); await new Promise(r => req.on('end', r));
        let j = null; try{ j = JSON.parse(body); }catch(e){}
        const n = posted.length + 1;
        posted.push({ n, j, at: new Date().toISOString(), id: 'out' + (NEXT_ID) });
        if(FAIL_SUB && j && Array.isArray(j.attachments) && String(j.attachments[0] || '').indexOf(FAIL_SUB) >= 0){ posted[posted.length - 1].fail = true; return json(400, ['each_attachment_must_be_a_valid_url']); }
        return json(200, { id: 'out' + (NEXT_ID++) });
      }
      return json(200, MSGS.slice().reverse());
    }
    if(/\/chats\/[0-9a-f]{8,}$/i.test(u.pathname)) return json(200, { id:CHAT_ID, client:{ clientName:'Diana Rudenko', userName:'diana' } });
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
const ORDER = { id:'1', orderId:'1001001', type:'client', name:'Diana Rudenko', instagram:'diana', ig:'diana', phone:'+380670001001', status:'kp', site:'main', payments:[],
  crmChatId:CHAT_ID, crmChatName:'Diana Rudenko', createdAt:new Date().toISOString(), hist:[], totalPrice:24000,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:20, unitPrice:600, price:12000 },
         { kind:'main', name:'Худі', color:'біле', garmentId:'hoodie', qty:10, unitPrice:1200, price:12000 }] };
const CONTENT = { team: [], bgApi: { sitniksUrl: HOST + '/crm' } };
let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };', 'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT; try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n  SeedCol.prototype=Object.create(Col.prototype);\n  SeedCol.prototype.onSnapshot=function(cb){ try{ var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }), forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); }, empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  "  var fs=function(){ return { collection:function(n){ if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; }); var c=new Col(); c.__n=n; return c; },");
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
const PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  if(/res\.cloudinary\.com|cdninstagram\.com/.test(u)) return r.fulfill({ contentType:'image/png', body: PX });
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(async () => {
  window.__UP = []; let n = 0;
  /* хмара: запамʼятовуємо, що саме пішло (тип, розмір, вага) */
  window.uploadCloudinary = async (b) => { const m = { type: b.type, bytes: b.size, w: 0, h: 0 }; try{ const bm = await createImageBitmap(b); m.w = bm.width; m.h = bm.height; }catch(e){} window.__UP.push(m); return 'https://res.cloudinary.com/demo/image/upload/v1/c' + (++n) + '.jpg'; };
  await openOrderDrawer(orders[0]); chatOpen(orders[0], 'crm');
});
await p.waitForTimeout(1500);
const feed = () => p.evaluate(() => [...document.querySelectorAll('.cw-feed .od-crm-msg')].map(el => ({
  mine: el.classList.contains('mine'), pending: el.classList.contains('pending'), failed: el.classList.contains('ob-failed'),
  imgs: [...el.querySelectorAll('img')].map(i => i.getAttribute('src')), txt: ((el.querySelector('.od-crm-txt') || {}).textContent || '').trim(),
  at: ((el.querySelector('.od-crm-at') || {}).textContent || '').replace(/\s+/g, ' ').trim(), late: !!el.querySelector('.od-crm-at.ob-late'),
  retry: !!el.querySelector('[data-ob-retry]') })));
const pics = rows => rows.filter(r => r.mine && r.imgs.length);
const poll = () => p.evaluate(async () => { await crmPollOnce(orders[0]); });

console.log('═══ 1. СКРИПТ «{КАРТКИ}» ПІСЛЯ КП — ПО ОДНІЙ, JPEG ≤ 2000 px ═══');
const deck = await p.evaluate(async () => {
  const o = orders[0];
  chatWin.cards = { kind:'kp', pick:null, deck:null, err:'' };
  await cardsLoad(o);
  for(let i = 0; i < 60 && !(chatWin.pics || []).length; i++) await new Promise(r => setTimeout(r, 250));
  for(let i = 0; i < 40; i++){ const n = (chatWin.pics || []).length; await new Promise(r => setTimeout(r, 250)); if(n && n === (chatWin.pics || []).length) break; }
  return { err: chatWin.cards.err, cards: (chatWin.cards.deck ? chatWin.cards.deck.list.length : 0), pics: (chatWin.pics || []).length, big: (chatWin.pics || []).map(x => x.blob.size) };
});
console.log('  ' + JSON.stringify(deck));
ok(!deck.err && deck.pics >= 2, 'скрипт зібрав картки КП у смужку: ' + deck.pics + ' шт', 'картки не зібрались: ' + JSON.stringify(deck));
const N = deck.pics;
await p.evaluate(() => { window.__sendDone = false; chatSendPics(orders[0], chatPics(), 'Ось прорахунок 🙂').then(() => { window.__sendDone = true; }); });
await p.waitForTimeout(300);
let r = await feed();
/* До хмари — одна бульбашка з усіма картками; після хмари (стуб миттєвий) — уже по одній. */
ok(pics(r).reduce((a, x) => a + x.imgs.length, 0) === N && pics(r).some(x => x.pending || /✓/.test(x.at)),
  'у стрічці одразу всі ' + N + ' карток (спершу «надсилаю…», далі по одній)', JSON.stringify(pics(r)));
await p.waitForFunction(() => window.__sendDone, null, { timeout: 90000 });
await p.waitForTimeout(400);
const up = await p.evaluate(() => window.__UP);
console.log('  у хмару: ' + JSON.stringify(up));
ok(up.length === N && up.every(m => m.type === 'image/jpeg' && Math.max(m.w, m.h) <= 2000 && Math.max(m.w, m.h) > 0), 'у хмару пішли JPEG не більше 2000 px', JSON.stringify(up));
const picPosts = posted.filter(x => x.j && Array.isArray(x.j.attachments));
const txtPosts = posted.filter(x => x.j && x.j.text && !x.j.attachments);
ok(picPosts.length === N && picPosts.every(x => x.j.attachments.length === 1) && txtPosts.length === 1 && posted.indexOf(txtPosts[0]) === posted.length - 1,
  'у Sitniks: ' + N + ' повідомлень по одній картинці, потім текст', JSON.stringify(posted.map(x => x.j)));
r = await feed();
ok(pics(r).length === N && pics(r).every(x => !x.pending && /✓/.test(x.at) && !/✓✓/.test(x.at)), 'усі картки з однією ✓ («Sitniks прийняв»), ✓✓ ще немає', JSON.stringify(pics(r).map(x => x.at)));

console.log('═══ 2. ПОВЕРНУЛАСЬ У ПЕРЕПИСКУ — ✓✓; НЕ ПОВЕРНУЛАСЬ — ЖОВТЕ З «ПОВТОРИТИ» ═══');
picPosts.slice(0, N - 1).forEach((x, i) => MSGS.push({ id: x.id, createdAt: x.at, text:'', attachments:[{ mediaType:'image', mediaUrl:'https://scontent.cdninstagram.com/v/k' + i + '.jpg' }], user:{ name:'Loomiq' } }));
await poll(); await p.waitForTimeout(400);
r = await feed();
const srvPics = pics(r).filter(x => /cdninstagram/.test(x.imgs[0]));
ok(srvPics.length === N - 1 && srvPics.every(x => /✓✓/.test(x.at)) && pics(r).length === N, (N - 1) + ' повернулись — ✓✓, без дублів; остання ще з ✓', JSON.stringify(pics(r).map(x => x.at)));
await p.evaluate(() => { window.LQ_PICS_LATE_MS = 1; crmPicsShow(orders[0]); });
await p.waitForTimeout(300);
r = await feed();
const late = pics(r).filter(x => x.late);
ok(late.length === 1 && /перевірте у клієнта/.test(late[0].at) && late[0].retry && !/✓✓/.test(late[0].at), 'та, що не повернулась за «2 хвилини», — жовта «перевірте у клієнта» з «Повторити»', JSON.stringify(pics(r).map(x => ({ at: x.at, late: x.late }))));
const before = posted.length;
await p.evaluate(() => { window.LQ_PICS_LATE_MS = 0; document.querySelector('.od-crm-at.ob-late [data-ob-retry]').click(); });
await p.waitForTimeout(1500);
r = await feed();
const again = posted.slice(before);
ok(again.length === 1 && again[0].j.attachments.length === 1 && pics(r).length === N && pics(r).filter(x => x.late).length === 0 && pics(r).some(x => /✓/.test(x.at) && !/✓✓/.test(x.at)),
  '«Повторити» надіслало ту саму картинку новим повідомленням — знову ✓', JSON.stringify({ again: again.map(x => x.j), pics: pics(r).map(x => x.at) }));

console.log('═══ 3. АДРЕСА З ХМАРИ БЕЗ ФАЙЛУ — СТИСКАЄ CLOUDINARY ═══');
const b3 = posted.length;
await p.evaluate(async () => { await crmSendPic(orders[0], ['https://res.cloudinary.com/demo/image/upload/v1/sketch.png'], [], null); });
const u3 = (posted[b3] || {}).j;
ok(posted.length === b3 + 1 && u3 && u3.attachments.length === 1 && /\/upload\/w_2000,h_2000,c_limit,f_jpg,q_85\/v1\/sketch\.png$/.test(u3.attachments[0]),
  'адреса пішла з перетворенням w_2000,h_2000,c_limit,f_jpg,q_85', JSON.stringify(u3));
ok(/\/upload\/w_2000,h_2000,c_limit,f_jpg,q_85\/v1\/sketch\.png$/.test(await p.evaluate(() => crmPicUrlIg(crmPicUrlIg('https://res.cloudinary.com/demo/image/upload/v1/sketch.png')))), 'перетворення не дублюється', 'дублюється');

console.log('═══ 4. SITNIKS ВІДМОВИВ ПО ОДНІЙ — ЧЕРВОНА З «ПОВТОРИТИ», РЕШТА ПІШЛА ═══');
FAIL_SUB = '/c4.jpg';      // друга з трьох нових (у хмару підуть c3, c4, c5)
const b4 = posted.length;
const before4 = (await feed()).filter(x => x.mine && x.imgs.length).length;
await p.evaluate(async () => {
  const mk = i => { const c = document.createElement('canvas'); c.width = 30 + i; c.height = 30; c.getContext('2d').fillRect(0, 0, 10 + i, 10); return new Promise(r => c.toBlob(b => r({ blob: b, url: URL.createObjectURL(b) }), 'image/png')); };
  const pics = [await mk(1), await mk(2), await mk(3)];
  chatWin.pics = pics.slice(); window.__sendDone = false;
  chatSendPics(orders[0], pics, '').then(() => { window.__sendDone = true; });
});
await p.waitForFunction(() => window.__sendDone, null, { timeout: 60000 });
await p.waitForTimeout(400);
r = await feed();
const fresh = pics(r).slice(before4);
const sent4 = posted.slice(b4);
ok(sent4.filter(x => x.fail).length >= 3 && sent4.filter(x => !x.fail).length === 2 && fresh.length === 3 && fresh.filter(x => x.failed).length === 1 && fresh.filter(x => !x.failed && /✓/.test(x.at)).length === 2 && fresh.find(x => x.failed).retry,
  'друга — Sitniks відмовив усіма трьома формами — червона «не надіслано» з «Повторити»; перша і третя — ✓', JSON.stringify({ sent: sent4.map(x => !!x.fail), fresh: fresh.map(x => ({ failed: x.failed, at: x.at })) }));
FAIL_SUB = '';
const b5 = posted.length;
await p.evaluate(() => { document.querySelector('.od-crm-msg.ob-failed [data-ob-retry]').click(); });
await p.waitForTimeout(1500);
r = await feed();
ok(posted.length === b5 + 1 && pics(r).filter(x => x.failed).length === 0, '«Повторити» на червоній — пішла, червоного немає', JSON.stringify(pics(r).slice(before4).map(x => ({ failed: x.failed, at: x.at }))));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ chat-pics-deliver: усі перевірки пройшли');
process.exit(bad ? 1 : 0);
