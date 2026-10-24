/* ЧАТИ: СМАЙЛИКИ Й ФІЛЬТР «НЕПРОЧИТАНІ» (24.10).

   Андрій: «додати смайлики; фільтр „непрочитані“ — всі перед очима всі
   замовлення, які потребують уваги». Фільтр лишає розмови, що чекають на
   відповідь (той самий підрахунок, що й кружечок), памʼятає браузер;
   😊 вставляє смайлик туди, де курсор, нещодавні — першими.

   Запуск:  node tests/chat-extras.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9061;
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
  team: [{ email:'test@loomiq', name:'Оля', role:'owner' }],
  b2c: {},
  qrSeed: 5,   /* набір уже після переходу 20.10 — тут перевіряємо сам фільтр напрямів */
  quickReplies: [
    { t:'Макет · B2B', m:'{макет} Підготували макет {версія} для компанії.' },
    { t:'Макет · B2C', m:'{макет} Привіт! Ось макет {версія} 🙌' },
    { t:'Подяка', m:'Дякуємо!' }
  ]
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera', crmAt:'2026-09-25 10:00', totalPrice: 1000, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[],
    crmChatId:'c2', crmChatName:'Богдана', crmAt:'2026-09-26 10:00', crmUnread: 2, crmTheirs: true },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'4', orderId:'2000104', type:'client', dir:'b2c', name:'Г', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T12:00:00.000Z', totalPrice: 1000, items:[] }
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




console.log('═══ 1. ФІЛЬТР «НЕПРОЧИТАНІ» ═══');
const ф = await p.evaluate(async () => {
  const t = ms => new Promise(r => setTimeout(r, ms));
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-chatsc').style.display = 'block';
  try{ localStorage.removeItem('lq_chats_unr_b2c'); }catch(e){}
  chatsUnr.b2c = false;
  renderChats('b2c'); await t(200);
  const рядки = () => [...document.querySelectorAll('#chatscRoot .chl-row .chl-ch')].map(x => x.textContent);
  const кн = () => (document.querySelector('#chatscRoot [data-chl-unr]') || {}).textContent || '';
  const r = { всі: рядки(), кнопка: кн() };
  document.querySelector('#chatscRoot [data-chl-unr]').click(); await t(200);
  r.фільтр = рядки(); r.памʼять = localStorage.getItem('lq_chats_unr_b2c');
  r.on = document.querySelector('#chatscRoot [data-chl-unr]').classList.contains('on');
  const o2 = orders.find(x => x.orderId === '2000102');
  o2.crmUnread = 0; o2.crmTheirs = false;
  renderChats('b2c'); await t(200);
  r.порожньо = (document.querySelector('#chatscRoot .chl-empty') || {}).textContent || '';
  r.кнопка2 = кн();
  document.querySelector('#chatscRoot [data-chl-unr]').click(); await t(200);
  r.знову = рядки().length; r.памʼять2 = localStorage.getItem('lq_chats_unr_b2c');
  return r;
});
console.log('  ' + JSON.stringify(ф));
ok(ф.всі.length >= 2 && /Непрочитані · 1/.test(ф.кнопка), 'біля пошуку — «Непрочитані · 1»', JSON.stringify(ф));
ok(ф.фільтр.length === 1 && /2000102/.test(ф.фільтр[0]) && ф.on && ф.памʼять === '1', 'увімкнули — лишилась лише розмова, що чекає відповіді; браузер памʼятає', JSON.stringify(ф.фільтр));
ok(/Непрочитаних немає/.test(ф.порожньо) && !/·/.test(ф.кнопка2), 'відповіли — розмова сама вийшла з фільтра: «Непрочитаних немає»', ф.порожньо);
ok(ф.знову === ф.всі.length && ф.памʼять2 === '0', 'вимкнули — знову всі розмови', JSON.stringify(ф));

console.log('═══ 2. СМАЙЛИКИ ═══');
await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '2000101');
  window.crmFetch = async () => ({ data: [] });
  crmChat[o.id] = { chatId:'c1', msgs: [] };
  try{ localStorage.removeItem('lq_emo_recent'); }catch(e){}
  chatOpen(o, 'crm', { noDrawer: true, dir: 'b2c' });
});
await p.waitForTimeout(400);
await p.click('#chatWin .cw-inp');
await p.keyboard.type('Дякую ');
await p.click('#chatWin [data-cw-emo]');
await p.waitForTimeout(200);
const панель = await p.evaluate(() => ({ є: !!document.querySelector('#chatWin .cw-emo'), n: document.querySelectorAll('#chatWin .cw-emo [data-emo]').length,
  нещ: /Нещодавні/.test((document.querySelector('#chatWin .cw-emo') || {}).textContent || '') }));
ok(панель.є && панель.n >= 40 && !панель.нещ, '😊 відкрив панель — ~40 смайликів', JSON.stringify(панель));
await p.click('#chatWin .cw-inp');
await p.keyboard.press('End');
await p.click('#chatWin .cw-emo [data-emo="🙏"]');
await p.waitForTimeout(200);
const вст = await p.evaluate(() => ({ v: document.querySelector('#chatWin .cw-inp').value, d: chatWin.draft,
  фокус: document.activeElement === document.querySelector('#chatWin .cw-inp'), нещ: JSON.parse(localStorage.getItem('lq_emo_recent') || '[]') }));
ok(вст.v === 'Дякую 🙏' && вст.d === 'Дякую 🙏' && вст.фокус, 'клік по 🙏 — вставлено туди, де курсор, поле не втратило фокус, чернетка ціла', JSON.stringify(вст));
await p.click('#chatWin [data-cw-emo]'); await p.waitForTimeout(150);
await p.click('#chatWin [data-cw-emo]'); await p.waitForTimeout(150);
const нещ = await p.evaluate(() => { const e = document.querySelector('#chatWin .cw-emo'); return { є: /Нещодавні/.test(e.textContent),
  перший: (e.querySelector('[data-emo]') || {}).dataset.emo, текст: document.querySelector('#chatWin .cw-inp').value }; });
ok(нещ.є && нещ.перший === '🙏' && нещ.текст === 'Дякую 🙏', 'нещодавні — першими; закрили-відкрили панель — текст у полі на місці', JSON.stringify(нещ));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'смайлики й «Непрочитані» — на місці');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
