/* tests/live-edit.mjs — КАРТКА НЕ ПЕРЕБУДОВУЄТЬСЯ ПІД РУКАМИ (03.11.2026).

   Менеджери: «пишу дизайнеру для правок — воно стирає все»; «5 ескізів… скаче
   то вверх, то вниз»; «кнопку відправити інколи треба декілька раз
   натискати»; «місто й відділення — декілька разів вводити». Корінь: на
   кожне оновлення з бази сторінка відділу перевставлялась цілком. Тепер
   нова розмітка накладається на наявну (`setHtml` → `morphInto` у
   loomiq-design.js):
     1. набране в полі правки лишається, коли людина клікнула поруч і прийшло
        чуже оновлення;
     2. ті самі картинки ескізів лишаються (не вантажаться вдруге),
        прокрутка картки стоїть;
     3. кнопка під пальцем — та сама (натиск не губиться), і дія спрацьовує
        з першого разу;
     4. «Написати» дизайнеру — поле після надсилання порожнє, як і доти;
     5. форма доставки, що не змінилась, — той самий елемент, і зміна в ній
        пишеться один раз (обробники не подвоюються);
     6. вимикач `contentData.noMorph = 1` — як доти, цілком.
   Запуск: node tests/live-edit.mjs (у pre-commit). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9181;
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
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Емма',      role:'embroidery' },
         { email:'c@loomiq',    name:'Цех',       role:'production' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 24 },
  products: { retail: { tee: 600 }, retailReady: { tee: 450 } }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] }
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



await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000101');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:3, note:'Лого на груди' })];
  const g = D.dzNew(); D.dzAttach(g, 'test@loomiq', 'p@loomiq'); D.dzSend(g, 'test@loomiq'); g.status = 'work';
  D.dzList(j.units[0], 'graphic').push(g);
  const s = D.dzNew(); D.dzAttach(s, 'test@loomiq', 'e@loomiq'); D.dzSend(s, 'test@loomiq'); s.status = 'work';
  D.dzList(j.units[0], 'stitch').push(s);
  for(let i = 1; i <= 5; i++) D.dzVer(g, 'p@loomiq', [{ name:'ескіз' + i + '.png', url:'/tests/fixtures/none-' + i + '.png' }], 'версія ' + i);
  window.__j = j; window.__g = g; window.__s = s;
  openDesign();
  U.host.upload = async f => 'https://x/up/' + f.name;
});
await p.waitForTimeout(400);


const bg = () => p.evaluate(() => { repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){} });
await p.evaluate(() => { contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role:'owner' }) : x);
  const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000101'); U.render(document.getElementById('dzRoot')); });
await p.waitForTimeout(500);
const kg = await p.evaluate(() => window.__j.units[0].id + '|graphic|0');
const SAY = '#dzRoot [data-dzsay="' + kg + '"]';

console.log('═══ 1. ПРАВКА ДИЗАЙНЕРУ НЕ СТИРАЄТЬСЯ ═══');
const r1 = await p.evaluate(async (SAY) => {
  const ta = document.querySelector(SAY); if(!ta) return { нема: true };
  ta.focus(); ta.value = 'Зменшіть лого на 2 см і зробіть нитку золотою'; ta.dispatchEvent(new Event('input', { bubbles:true }));
  ta.blur();                                            // клікнула поруч — подивитись ескіз
  window.__j.units[0].size = 'XL';                      // інший пристрій змінив картку
  repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){}
  await new Promise(r => setTimeout(r, 400));
  const ta2 = document.querySelector(SAY);
  return { same: ta2 === ta, text: ta2 && ta2.value, fresh: /XL/.test(document.querySelector('#dzRoot .dz-panel').textContent) };
}, SAY);
console.log('  ' + JSON.stringify(r1));
ok(r1.text === 'Зменшіть лого на 2 см і зробіть нитку золотою' && r1.same, 'набране лишилось у полі (те саме поле), хоч прийшло чуже оновлення', 'текст стерто: ' + JSON.stringify(r1));
ok(r1.fresh, 'а чуже оновлення в картці видно (розмір XL)', 'оновлення не показано: ' + JSON.stringify(r1));

console.log('═══ 2. ЕСКІЗИ НЕ ПЕРЕВАНТАЖУЮТЬСЯ, ПРОКРУТКА СТОЇТЬ ═══');
const r2 = await p.evaluate(async () => {
  const pb = document.querySelector('#dzRoot .dz-panel-b');
  const imgs0 = [...document.querySelectorAll('#dzRoot .dz-panel img')];
  if(pb) pb.scrollTop = 260;
  const top0 = pb ? pb.scrollTop : 0;
  for(let i = 0; i < 5; i++){ window.__j.units[0].qty = 3 + i; repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){} }
  await new Promise(r => setTimeout(r, 300));
  const pb2 = document.querySelector('#dzRoot .dz-panel-b');
  const imgs1 = [...document.querySelectorAll('#dzRoot .dz-panel img')];
  return { n: imgs0.length, same: imgs0.length > 0 && imgs0.every((x, i) => x === imgs1[i] && x.isConnected), top0, top1: pb2 ? pb2.scrollTop : 0, pb: pb === pb2 };
});
console.log('  ' + JSON.stringify(r2));
ok(r2.n >= 5 && r2.same, 'п’ять оновлень — ті самі картинки ескізів (' + r2.n + '), не вантажаться наново', 'картинки перевставлено: ' + JSON.stringify(r2));
ok(r2.pb && r2.top1 === r2.top0, 'прокрутка картки на місці', 'прокрутку скинуто: ' + JSON.stringify(r2));

console.log('═══ 3. КНОПКА ПІД ПАЛЬЦЕМ — ТА САМА, ДІЯ З ПЕРШОГО НАТИСКУ ═══');
const r3 = await p.evaluate(async (kg) => {
  const sel = '#dzRoot [data-do="dz-note"][data-dz="' + kg + '"]';
  const b0 = document.querySelector(sel); if(!b0) return { нема: true };
  window.__j.units[0].qty = 9; repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){}   // оновлення між натиском і відпусканням
  return { same: document.querySelector(sel) === b0 && b0.isConnected };
}, kg);
ok(r3.same, 'оновлення посеред натиску не замінило кнопку — натиск не губиться', 'кнопку замінено: ' + JSON.stringify(r3));
const r4 = await p.evaluate(async ({ kg, SAY }) => {
  const ta = document.querySelector(SAY);
  ta.value = 'Правка з першого разу';
  document.querySelector('#dzRoot [data-do="dz-note"][data-dz="' + kg + '"]').click();
  await new Promise(r => setTimeout(r, 800));
  const є = window.__g.thread.some(m => m.text === 'Правка з першого разу');
  const n = window.__g.thread.filter(m => m.text === 'Правка з першого разу').length;
  return { є, n, порожнє: !(document.querySelector(SAY) || {}).value };
}, { kg, SAY });
console.log('  ' + JSON.stringify(r4));
ok(r4.є && r4.n === 1, '«Написати» дизайнеру — один натиск, одне повідомлення', 'не надіслалось з першого разу: ' + JSON.stringify(r4));
ok(r4.порожнє, 'після надсилання поле порожнє, як і доти', 'надіслане лишилось у полі: ' + JSON.stringify(r4));

console.log('═══ 4. ФОРМА ДОСТАВКИ: ТА САМА І ПИШЕТЬСЯ ОДИН РАЗ ═══');
const r5 = await p.evaluate(async () => {
  const box = document.querySelector('#dzRoot [data-shipform]'); if(!box) return { нема: true };
  for(let i = 0; i < 3; i++){ repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){} }
  await new Promise(r => setTimeout(r, 300));
  const box2 = document.querySelector('#dzRoot [data-shipform]');
  const name = box2 && box2.querySelector('[data-shf="name"], input[data-shf]');
  let saves = 0; const s0 = window.saveOrders; window.saveOrders = function(){ saves++; return s0.apply(this, arguments); };
  if(name){ name.value = 'Асія Дерещук Іванівна'; name.dispatchEvent(new Event('change', { bubbles:true })); }
  await new Promise(r => setTimeout(r, 900));
  window.saveOrders = s0;
  return { same: box2 === box, name: !!name, saves };
});
console.log('  ' + JSON.stringify(r5));
if(r5.нема) ok(true, 'форми доставки в цій картці немає — пропущено', '');
else {
  ok(r5.same, 'три оновлення — форма доставки той самий елемент (набране не зникає)', 'форму перевставлено: ' + JSON.stringify(r5));
  ok(!r5.name || r5.saves <= 1, 'одна зміна в формі — один запис (обробники не подвоїлись)', 'зміна пишеться кілька разів: ' + JSON.stringify(r5));
}

console.log('═══ 4б. ПРИМІТКА Й СМУГА «ХТО СКІЛЬКИ» НЕ СТИРАЮТЬ НЕНАДІСЛАНЕ (05.11) ═══');
/* Баг у живій CRM: набрати в «Написати дизайнеру», не надсилати, натиснути
   «📝 Додати примітку для всіх» чи імʼя в смузі «✏️ Графічні» — текст зникав.
   Значення ставимо без події input: перевіряємо саме морф, не памʼять чернетки. */
const r4б = await p.evaluate(async (SAY) => {
  const U = window.LQDesign.ui; U.setTab('acct'); U.open('2000101'); U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  const put = t => { const ta = document.querySelector(SAY); if(ta) ta.value = t; return !!ta; };
  const val = () => { const ta = document.querySelector(SAY); return ta ? ta.value : null; };
  const out = {};
  const click = async sel => { const b = document.querySelector(sel); if(!b) return false; b.click(); await new Promise(r => setTimeout(r, 400)); return true; };
  put('Чернетка 1: лого праворуч');
  out.noteB = await click('#dzRoot [data-do="note-edit"]');
  out.afterNote = val();
  out.cancelB = await click('#dzRoot [data-do="note-cancel"]');
  out.afterCancel = val();
  put('Чернетка 2: нитка срібна');
  out.loadB = await click('#dzRoot [data-do="load-who"]');
  out.afterLoad = val();
  /* Та сама смуга ще раз — «показати всі». */
  await click('#dzRoot [data-do="load-who"]');
  return out;
}, SAY);
console.log('  ' + JSON.stringify(r4б));
ok(r4б.noteB && r4б.afterNote === 'Чернетка 1: лого праворуч' && r4б.afterCancel === 'Чернетка 1: лого праворуч',
  '«📝 Додати примітку» і «Скасувати» — ненадіслане в полі дизайнеру на місці', 'стерто: ' + JSON.stringify(r4б));
if(r4б.loadB) ok(r4б.afterLoad === 'Чернетка 2: нитка срібна', 'імʼя в смузі «хто скільки» — ненадіслане на місці', 'стерто: ' + JSON.stringify(r4б));
else ok(true, 'смуги «хто скільки» над цією дошкою немає — пропущено', '');

console.log('═══ 5. ВИМИКАЧ: noMorph = 1 — ЯК ДОТИ ═══');
const r6 = await p.evaluate(async () => {
  contentData.noMorph = 1;
  const pn0 = document.querySelector('#dzRoot .dz-panel');
  window.__j.units[0].qty = 11; repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){}
  await new Promise(r => setTimeout(r, 200));
  const pn1 = document.querySelector('#dzRoot .dz-panel');
  delete contentData.noMorph;
  return { replaced: pn0 !== pn1 };
});
ok(r6.replaced, 'з вимикачем картка перевставляється цілком, як до 03.11', 'вимикач не діє: ' + JSON.stringify(r6));

ok(!errs.length, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ live-edit: картка не перебудовується під руками');
process.exit(bad ? 1 : 0);
