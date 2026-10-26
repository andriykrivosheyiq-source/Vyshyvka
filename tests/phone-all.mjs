/* ТЕЛЕФОН: УСІ РОЗДІЛИ ЗРУЧНІ, НІЩО НЕ ВИЛАЗИТЬ ЗА ЕКРАН (26.10).

   Андрій: «можна зробити всі інші версії максимально зручні… фінанси,
   B2B, створення КПшок, воронка… вони також з телефона працюють». На
   екрані телефона (390×844):
   1. Жоден розділ меню не ширший за екран (Аналітика була 716 px — таблиця
      джерел; Налаштування B2C і Команда — рядки, що не переносились).
   2. Закрите меню не кидає тінь на лівий край кожного екрана.
   3. Картка B2B: вибір етапу й менеджера — усередині своєї плашки.
   4. Чати: відкрита розмова — на весь екран, ✕ повертає до списку.
   5. Фінанси: вікно руху на весь екран, клавіатура сама не вискакує;
      добір по два в рядок.
   6. Компʼютер — як був: розмова поруч зі списком, вікно руху посередині.

   Запуск:  node tests/phone-all.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9157;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
/* Відповідь, схожа на справжню: поля «вихідне» немає взагалі, є лише
   відправник. Саме на такій розмова й ставала вся ліворуч. */
const MSGS = [
  { id:'m1', createdAt:'2026-09-15T11:50:00Z', text:'Доброго дня, цікавлять футболки',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m2', createdAt:'2026-09-15T11:52:00Z', text:'Який одяг потрібен?)',
    user:{ name:'Катерина Шевчук' } },
  { id:'m3', createdAt:'2026-09-15T15:18:00Z', text:'Футболки',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m4', createdAt:'2026-09-15T15:24:00Z', text:'Яка кількість має бути?',
    user:{ name:'Катерина Шевчук' } },
  { id:'m5', createdAt:'2026-09-15T15:30:00Z', text:'Від 20 шт',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m6', createdAt:'2026-09-15T15:35:00Z', text:'Дякую за інформацію, передаю на розрахунок',
    user:{ name:'Олег Марченко' } },
  /* Пряма ознака від Sitniks, і вона суперечить підпису: у записі стоїть сам
     клієнт, але сказано «вхідне = ні». Слову маємо вірити більше. */
  { id:'m7', createdAt:'2026-09-15T15:40:00Z', text:'Надсилаю пропозицію',
    isIncoming:false, client:{ clientName:'Anastasia Dera' } },
  /* Лист на кілька абзаців із посиланням усередині. Саме такий і виходив
     кашею: адресу ми виймали, а разом із нею збивали всі переноси. */
  { id:'m8', createdAt:'2026-09-15T15:45:00Z',
    text:'Вітаю! Підготувала пропозицію за вашим запитом.\n' +
         'Тут є візуалізації з вашим брендингом.\n\n' +
         'Переглянути пропозицію →\nhttps://loomiq.net/offer.html?o=wk4wuvidrxnc\n\n' +
         'Якщо виникнуть питання — відповім)',
    user:{ name:'Катерина Шевчук' } }
];

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
      return json(200, MSGS);
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



const now = new Date().toISOString();
const mk = (i, st) => ({
  id:String(i), orderId:'100170' + i, type:'client', name:'Клієнт ' + i,
  phone:'+38067000170' + i, status:st, site:'main', createdAt:now, hist:[], payments:[],
  totalPrice:10000 * i, totalCost:6000 * i, margin:4000 * i, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:10 * i,
           unitPrice:1000, price:10000 * i, unitCost:600, cost:6000 * i }]
});
const ORDERS = [Object.assign(mk(1, 'kp'), { name:'Anastasia Dera', instagram:'asia_dera', ig:'asia_dera',
    crmChatId:CHAT_ID, crmChatName:'Anastasia Dera' }), mk(2, 'lead'), mk(3, 'paid'),
  { id:'b1', orderId:'2000201', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:now, totalPrice:1000, items:[] }];
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }], bgApi:{ sitniksUrl: HOST + '/crm' },
                  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] } };
const PAYS = [
  { id:'p1', at:'2026-09-25T10:00:00.000Z', amount:4850, acc:'mono1', counter:'Дерещук Асія', desc:'оплата замовлення 1001701' },
  { id:'p2', at:'2026-09-24T18:00:00.000Z', amount:-3200, acc:'mono2', counter:'Нитки', desc:'закупівля' }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__PAYS=' + JSON.stringify(PAYS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  function PayCol(){}\n' +
  '  PayCol.prototype=Object.create(Col.prototype);\n' +
  '  PayCol.prototype.where=function(){ return this; };\n' +
  '  PayCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '      forEach:function(f){ (window.__PAYS||[]).forEach(function(x){ f(new Snap(x.id,x)); }); } });\n' +
  '    }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  "      if(n==='payments') return new PayCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function page(opt){
  const ctx = await browser.newContext(opt);
  const p = await ctx.newPage();
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
  await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });
  return p;
}
const go = (p, v) => p.evaluate(async v => {
  const b = document.querySelector('.nav button[data-view="' + v + '"]'); if(b){ b.hidden = false; b.click(); }
  await new Promise(r => setTimeout(r, 1100));
  return document.documentElement.scrollWidth;
}, v);

/* ── Телефон ── */
const p = await page({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
const VIEWS = ['board','chats','design','chatsc','analytics','dash','fin','problems','b2c','settings','photos','reviews','suppliers','team','today'];
const ширші = [];
for(const v of VIEWS){ const sw = await go(p, v); if(sw > 391) ширші.push(v + ' ' + sw); }
ok(!ширші.length, 'жоден розділ меню не ширший за екран телефона (' + VIEWS.length + ' розділів)', 'ширші за екран: ' + ширші.join(', '));

const меню = await p.evaluate(async () => {
  const s = document.getElementById('sidebar');
  const закрите = getComputedStyle(s).boxShadow;
  document.getElementById('hamburger').click(); await new Promise(r => setTimeout(r, 400));
  const відкрите = getComputedStyle(s).boxShadow;
  document.getElementById('hamburger').click(); await new Promise(r => setTimeout(r, 400));
  return { закрите, відкрите };
});
ok(меню.закрите === 'none' && меню.відкрите !== 'none', 'закрите меню без тіні на лівому краї; відкрите — з тінню', JSON.stringify(меню));

await go(p, 'board');
await p.click('#board .ticket'); await p.waitForTimeout(1000);
const плашки = await p.evaluate(() => [...document.querySelectorAll('#orderDrawer .od-head .od-pill .lq-sel')].filter(e => e.getClientRects().length).map(e => {
  const r = e.getBoundingClientRect(), q = e.closest('.od-pill').getBoundingClientRect();
  return r.left >= q.left - 1 && r.right <= q.right + 1 && r.top >= q.top - 1 && r.bottom <= q.bottom + 1; }));
ok(плашки.length === 2 && плашки.every(Boolean), 'картка B2B: етап і «Хто веде?» — усередині своїх плашок', JSON.stringify(плашки));
await p.evaluate(() => closeOrderDrawer()); await p.waitForTimeout(400);

await go(p, 'chats'); await p.waitForTimeout(1500);
await p.click('#view-chats .chl-row'); await p.waitForTimeout(2200);
const розмова = await p.evaluate(() => { const v = document.getElementById('chatsView'); const r = v.getBoundingClientRect();
  const inp = document.querySelector('#chatsView .cw-inp'); const ir = inp ? inp.getBoundingClientRect() : null;
  return { r: [r.x, r.y, r.width, r.height].map(Math.round), поле: !!ir && ir.bottom <= innerHeight && ir.top > innerHeight - 160,
    повідомлень: document.querySelectorAll('#chatsView .od-crm-msg').length }; });
ok(розмова.r.join() === '0,0,390,844' && розмова.поле && розмова.повідомлень > 3, 'Чати: відкрита розмова — на весь екран, поле листа внизу', JSON.stringify(розмова));
const назад = await p.evaluate(async () => { document.querySelector('#chatsView [data-cw-close]').click(); await new Promise(r => setTimeout(r, 500));
  const l = document.querySelector('#view-chats .chl-row'); return !!l && l.getClientRects().length > 0 && document.elementFromPoint(100, 250) !== null &&
    !document.querySelector('#chatsView .cw-inline.open'); });
ok(назад, '✕ розмови повертає до списку', String(назад));

await go(p, 'fin');
const фін = await p.evaluate(async () => {
  const bar = document.querySelector('.fin-bar'); const k = document.getElementById('fin-kind');
  const kb = (k.previousElementSibling && k.previousElementSibling.classList.contains('lq-sel') ? k.previousElementSibling : k).getBoundingClientRect();
  const out = { колонок: getComputedStyle(bar).gridTemplateColumns.split(' ').length, добір: Math.round(kb.width) };
  document.querySelector('[data-fin-open="p1"]').click(); await new Promise(r => setTimeout(r, 500));
  const w = document.querySelector('.fin-modal .fin-w').getBoundingClientRect();
  out.вікно = [w.x, w.y, w.width, w.height].map(Math.round);
  out.фокус = document.activeElement && document.activeElement.tagName;
  return out; });
ok(фін.колонок === 2 && фін.добір < 200, 'Фінанси: добір по два в рядок', JSON.stringify(фін));
ok(фін.вікно.join() === '0,0,390,844' && фін.фокус !== 'INPUT', 'Фінанси: вікно руху на весь екран, клавіатура сама не вискакує', JSON.stringify(фін));

/* ── Компʼютер: як було ── */
const pc = await page({ viewport:{ width:1400, height:900 } });
await go(pc, 'chats'); await pc.waitForTimeout(1500);
await pc.click('#view-chats .chl-row'); await pc.waitForTimeout(2200);
const пк = await pc.evaluate(async () => {
  const v = document.getElementById('chatsView').getBoundingClientRect();
  const l = document.querySelector('#view-chats .ch2-list').getBoundingClientRect();
  const out = { поруч: v.left > l.right - 1 && l.width > 200, вид: getComputedStyle(document.getElementById('chatsView')).position,
    тінь: getComputedStyle(document.getElementById('sidebar')).boxShadow };
  document.querySelector('.nav button[data-view="fin"]').click(); await new Promise(r => setTimeout(r, 900));
  document.querySelector('[data-fin-open="p1"]').click(); await new Promise(r => setTimeout(r, 500));
  const w = document.querySelector('.fin-modal .fin-w').getBoundingClientRect();
  out.вікно = Math.round(w.width); out.фокус = document.activeElement && document.activeElement.tagName;
  return out; });
ok(пк.поруч && пк.вид !== 'fixed' && пк.вікно <= 560 && пк.фокус === 'INPUT', 'компʼютер: розмова поруч зі списком, вікно руху посередині з пошуком у фокусі — як було', JSON.stringify(пк));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'з телефона зручно в усіх розділах; компʼютер як був');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
