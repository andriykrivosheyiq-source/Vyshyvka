/* Журнал доступу, режим «Дивитись як» і права на запис.

   Стрічка подій у картці каже, ЩО зробили із замовленням. Цього мало.
   Потрібне друге: хто що дивився, змінював і вивантажував. Три записи
   обовʼязкові — експорти (єдиний спосіб дізнатись, звідки пішла база),
   зміни прав і вхід у режим «дивитись як».

   «ДИВИТИСЬ ЯК» потрібен щодня: коли налаштовуєш ролі й коли людина каже
   «у мене цього немає». Але це ПЕРЕГЛЯД, а не перевтілення: права
   звужуються, ніколи не розширюються, інакше режим став би дірою, через яку
   менеджер дивиться очима власника.

   ПРАВА НА ЗАПИС. Приховати поле в інтерфейсі — не те саме, що закрити
   доступ. Правила бази читають карту `acl`, і вона має збиратись із тих
   самих галочок, що й інтерфейс, — інакше через місяць вони розійдуться.

   Запуск:  node tests/access-log.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8832;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const now = new Date().toISOString();
const CONTENT = {
  team:[{ email:'test@loomiq', name:'Андрій', role:'owner' },
        { email:'ira@loomiq',  name:'Ірина',  role:'manager' }],
  suppliers:[{ id:'tex', name:'Текстиль-Юг', days:7 }],
  products:{ supplier:{ tshirt:'tex' } },
  sizecharts:{ tshirt:[{size:'Розмір'},{size:'S'},{size:'M'}] }
};
const O = {
  id:'1', orderId:'1001301', type:'client', name:'Оксана', phone:'+380670001301',
  status:'paid', site:'main', createdAt:now, hist:[], prodAt:now, dueAt:'2026-12-01',
  tracks:{ design:'ok', supply:'todo', test:'wait', prod:'lock', qc:'wait', ship:'wait' },
  payments:[{ at:now, sum:5000, kind:'prepay', by:'test@loomiq' }],
  totalPrice:20000, totalCost:12000, margin:8000, marginPct:40,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt', qty:20,
           sizeQty:{ S:8, M:12 },
           prints:[{ side:'front', technique:'вишивка', widthMm:80, heightMm:45 }] }]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([O]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
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
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

console.log('═══ ДИВИТИСЬ ЯК: ПРАВА ТІЛЬКИ ЗВУЖУЮТЬСЯ ═══');
const seeAs = await p.evaluate(() => {
  const before = { role:myRole(), cost:canSeeCost(), setup:canSetup(),
                   nav:(myAcc().nav === '*' ? 'усі' : myAcc().nav.length) };
  seeAsSet('designer');
  const during = { cost:canSeeCost(), setup:canSetup(), ui:myUi(),
                   bar: !!document.getElementById('seeAsBar'),
                   barText:(document.getElementById('seeAsBar') || {}).textContent || '',
                   nav:(myAcc().nav === '*' ? 'усі' : myAcc().nav.length) };
  seeAsSet('');
  const after = { cost:canSeeCost(), setup:canSetup(), bar: !!document.getElementById('seeAsBar') };
  return { before, during, after };
});
console.log('  свої очі: собівартість ' + seeAs.before.cost + ', налаштування ' + seeAs.before.setup);
console.log('  очима дизайнера: собівартість ' + seeAs.during.cost + ', налаштування ' + seeAs.during.setup);
ok(seeAs.before.cost && !seeAs.during.cost && !seeAs.during.setup,
  'у чужому вигляді власник перестає бачити те, чого не бачить дизайнер',
  'права не звузились: ' + JSON.stringify(seeAs.during));
ok(seeAs.during.ui === 'designer',
  'і картка малюється дизайнерським форматом',
  'формат не той: ' + seeAs.during.ui);
ok(seeAs.during.bar && /дивитесь очима/i.test(seeAs.during.barText),
  'вихід із режиму завжди на видноті — непомічений режим гірший за його відсутність',
  'смуги режиму немає');
ok(seeAs.after.cost && seeAs.after.setup && !seeAs.after.bar,
  'вихід повертає власні права цілком',
  'права не повернулись: ' + JSON.stringify(seeAs.after));

/* Головне: режим не має ПІДВИЩУВАТИ права. Менеджер, який дивиться «як
   власник», мусить лишитись менеджером. */
const noLift = await p.evaluate(() => {
  const real = window.myRole;
  window.__fakeManager = true;
  const acc = accIntersect(presetOf('manager'), presetOf('owner'));
  return { cost: acc.see.indexOf('cost') >= 0, setup: acc.can.indexOf('setup') >= 0 };
});
ok(!noLift.cost && !noLift.setup,
  'менеджер «очима власника» не отримує ні собівартості, ні налаштувань',
  'режим підвищив права: ' + JSON.stringify(noLift));

console.log('');
console.log('═══ ЖУРНАЛ: ТРИ ОБОВʼЯЗКОВІ ЗАПИСИ ═══');
const log = await p.evaluate(async () => {
  await accLog('export', 'клієнти, 214 рядків');
  await accLog('rights', 'змінив права: ira@loomiq');
  const L = accLogList();
  return { kinds:L.map(r => r.kind), last:L[L.length - 1],
           hasBy: L.every(r => !!r.role) };
});
console.log('  ' + log.kinds.join(' · '));
ok(log.kinds.indexOf('seeas') >= 0,
  'вхід у режим перегляду записався сам, без окремої кнопки',
  'входу в режим у журналі немає: ' + log.kinds.join(','));
ok(log.kinds.indexOf('export') >= 0 && log.kinds.indexOf('rights') >= 0,
  'експорт і зміна прав теж у журналі',
  'бракує записів: ' + log.kinds.join(','));
ok(log.hasBy && log.last.by === 'test@loomiq',
  'у кожному рядку видно, хто це зробив і в якій ролі',
  'автора не видно: ' + JSON.stringify(log.last));

const shown = await p.evaluate(() => {
  document.querySelector('.nav button[data-view="team"]').click();
  renderAccLog();
  const box = document.getElementById('acc-log');
  return { rows: box.querySelectorAll('.al-row').length,
           txt: box.textContent.replace(/\s+/g, ' ').slice(0, 120) };
});
console.log('  у журналі ' + shown.rows + ' рядків');
ok(shown.rows >= 3, 'журнал видно в розділі доступів', 'журнал порожній: ' + shown.txt);

const hidden = await p.evaluate(() => {
  seeAsSet('manager');                        // менеджеру журнал не належить
  renderAccLog();
  const t = document.getElementById('acc-log').textContent;
  seeAsSet('');
  return t;
});
ok(/тільки той, хто налаштовує/i.test(hidden),
  'журнал бачить лише той, хто налаштовує систему',
  'журнал видно не тому: ' + hidden.slice(0, 80));

console.log('');
console.log('═══ ЕКСПОРТ ЗАВЖДИ ЛИШАЄ СЛІД ═══');
const exp = await p.evaluate(async () => {
  const before = accLogList().filter(r => r.kind === 'export').length;
  const o = orders.find(x => x.orderId === '1001301');
  o.prodAt = new Date().toISOString();
  document.querySelector('.nav button[data-view="suppliers"]').click();
  document.getElementById('buy-csv').click();
  await new Promise(r => setTimeout(r, 600));
  const L = accLogList().filter(r => r.kind === 'export');
  return { before, after:L.length, text:(L[L.length - 1] || {}).text || '' };
});
console.log('  ' + exp.text);
ok(exp.after > exp.before && /рядк/i.test(exp.text),
  'вивантаження записалось із числом рядків — «хтось колись викачав» не відповідь',
  'експорт не записався: ' + JSON.stringify(exp));

console.log('');
console.log('═══ КАРТА ПРАВ ДЛЯ ПРАВИЛ БАЗИ ═══');
const acl = await p.evaluate(() => {
  const list = teamList().map(p => ({ email:p.email, acc:p.acc }));
  return { map: aclFromTeam(list), key: aclKeyOf('Ira@Loomiq.NET') };
});
console.log('  ' + JSON.stringify(acl.map));
ok(acl.key === 'ira_loomiq_net',
  'ключ карти зібраний так само, як його читають правила',
  'ключ не той: ' + acl.key);
ok(acl.map.test_loomiq && acl.map.test_loomiq.setup === true &&
   acl.map.ira_loomiq && acl.map.ira_loomiq.cost === false,
  'карта зібралась із тих самих галочок, що й інтерфейс',
  'карта не збігається з правами: ' + JSON.stringify(acl.map));

/* Правила мають читати саме те, що адмінка пише, — і саме там, де болить. */
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
ok(/function\s+may\(/.test(rules) && /aclMap\(\)\.get\(aclKey\(\)/.test(rules),
  'правила бази читають ту саму карту прав',
  'у правилах немає читання карти');
ok(/kanbanOrders[\s\S]{0,600}totalPrice[\s\S]{0,200}status/.test(rules),
  'ціна й етап продажу закриті на ЗАПИС, а не лише сховані в інтерфейсі',
  'запис ціни й етапу не обмежений');
ok(/accessLog\.size\(\)\s*>=\s*resource\.data\.accessLog\.size\(\)/.test(rules),
  'із журналу не можна вирізати рядок — саме вирізання й приховує сліди',
  'журнал можна скоротити');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'видно, хто що дивився й міняв, і чужими очима не стати сильнішим');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
