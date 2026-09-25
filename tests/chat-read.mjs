/* ПРОЧИТАВ — ЛІЧИЛЬНИК ГАСНЕ ТІЄЇ Ж МИТІ.

   Число біля розділу «Чати B2C» зависало. Розмову відкрито, прочитано, а
   в лівій панелі так і стоїть «1» — і стоїть далі, поки не мине такт
   опитування. Андрій: «я захожу, читаю, і воно все рівно зависає».

   Причин було дві, і обидві відкладали одне й те саме:
     1. відкривання розмови взагалі не рахувалось прочитанням — позначка
        ставилась лише від відповіді або від натиску на око;
     2. число біля розділу перемальовувалось тільки поки ви стоїте на
        вкладці чатів — тобто саме тоді, коли на нього вже не дивляться.

   Число, яке бреше про стан, гірше за його відсутність: на нього
   перестають дивитись, і далі воно не значить нічого.

   Перевіряємо, що обидві дороги до «прочитано» роблять одне й те саме й
   роблять це одразу: відкривання розмови та кнопка-око.

   Запуск:  node tests/chat-read.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8894;
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

const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }] };
/* Приватне замовлення з привʼязаною розмовою, у якій клієнт написав і
   чекає. Саме такий стан і показує число біля «Чати B2C». */
const ORDER = {
  id:'1', orderId:'2000011', type:'client', dir:'b2c', name:'Асія',
  status:'prorahunok', site:'main', payments:[], hist:[],
  createdAt:'2026-09-24T09:00:00.000Z',
  crmChatId:'c11', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
  crmUnread:2, crmTheirs:true, crmIn:2,
  crmAt:'2026-09-25 10:20',
  items:[]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
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
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
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

const badge = () => p.evaluate(() => {
  const el = document.querySelector('[data-nav-n="chatsc"]');
  return el ? String(el.textContent || '') : '—';
});

console.log('');
console.log('═══ ЧИСЛО БІЛЯ РОЗДІЛУ ГАСНЕ ВІД ПРОЧИТАННЯ ═══');
await p.evaluate(() => { try{ paintChatBadges(); }catch(e){} });
ok((await badge()) === '1',
  'клієнт чекає — біля «Чати B2C» стоїть число',
  'число не зʼявилось узагалі: ' + (await badge()));

/* Прочитання — та сама дія, що й око. Перевіряємо саме її, а не кнопку:
   відкривання розмови має робити рівно те, що робить око, інакше правило
   «коли число зникає» неможливо пояснити. */
const після = await p.evaluate(async () => {
  const o = (orders || [])[0];
  chatMarkRead(o, 'crm');
  const el = document.querySelector('[data-nav-n="chatsc"]');
  return { badge: el ? String(el.textContent || '') : '—',
           unread: +o.crmUnread || 0, theirs: !!o.crmTheirs, seen: !!o.crmSeen };
});
ok(після.badge === '',
  'прочитали — число зникло тієї ж миті, не чекаючи такту опитування',
  'число лишилось після прочитання: «' + після.badge + '»');
ok(!після.unread && !після.theirs && після.seen,
  'і сама картка більше не рахується непрочитаною',
  'картка лишилась непрочитаною: ' + JSON.stringify(після));

/* Позначка тримається. Без межі наступний такт перерахував би хвіст
   клієнтських реплік і повернув число — тобто прочитання працювало б
   рівно до наступної секунди. */
const тримається = await p.evaluate(() => {
  const o = (orders || [])[0];
  try{ crmNormMsgs(o, [
    { at:'2026-09-25 10:19', text:'Добрий день', mine:false },
    { at:'2026-09-25 10:20', text:'Коли буде готово?', mine:false }
  ]); }catch(e){ return { err:String(e && e.message) }; }
  return { unread:+o.crmUnread || 0, theirs:!!o.crmTheirs };
});
ok(!тримається.err && !тримається.unread && !тримається.theirs,
  'наступний такт опитування число назад не повертає',
  'позначка не втрималась: ' + JSON.stringify(тримається));

console.log('');
console.log('═══ ОКО РОБИТЬ РІВНО ТЕ САМЕ ═══');
const око = await p.evaluate(() => {
  const o = (orders || [])[0];
  /* Повертаємо картку в непрочитані тим самим перемикачем — і знімаємо
     знову. Обидва напрямки мають одразу відбиватись на числі. */
  chatSeenToggle(o, 'crm');
  const було = (document.querySelector('[data-nav-n="chatsc"]') || {}).textContent || '';
  chatSeenToggle(o, 'crm');
  const стало = (document.querySelector('[data-nav-n="chatsc"]') || {}).textContent || '';
  return { було: String(було), стало: String(стало) };
});
ok(око.було !== '',
  'повернули в непрочитані — число повернулось одразу: «' + око.було + '»',
  'повернення в непрочитані числа не показало');
ok(око.стало === '',
  'натиснули око — число згасло одразу, без такту опитування',
  'після ока число лишилось: «' + око.стало + '»');

console.log('');
console.log('═══ ПРИВʼЯЗАНИЙ КЛІЄНТ ПІДПИСАНИЙ НІКОМ ═══');
const підпис = await p.evaluate(() => {
  const o = (orders || [])[0];
  return { мітка: crmWhoLabel(o), канал: chanFallback(o, 'ig'), є: chanFilled(o, 'ig') };
});
ok(/@asia_dera/.test(підпис.мітка) && /Асія Дерещук/.test(підпис.мітка),
  'нік попереду імені: ' + підпис.мітка,
  'підпис без ніка: ' + JSON.stringify(підпис));
/* За ніком людину й знаходять, тож він має доїхати й туди, де картку
   підписують каналом, — інакше в одному місці нік є, а в іншому «чат 17293…». */
ok(/@asia_dera/.test(підпис.канал),
  'той самий підпис і там, де картку підписують каналом',
  'канал підписаний без ніка: ' + підпис.канал);
ok(підпис.є,
  'кнопка розмови на картці є, бо розмову привʼязано',
  'кнопки розмови на картці немає, хоч розмова привʼязана');

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.slice(0, 2).join(' | '));
await browser.close();
srv.close();
console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nпрочитане перестає світитись одразу');
process.exit(bad ? 1 : 0);
