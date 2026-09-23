/* Два напрями: B2B і B2C.

   У компанії два різні бізнеси. B2B — компанії, тиражі, КП. B2C — приватні
   люди, принти, фото. Різні менеджери, різні етапи, різні ролі, і плутати
   їх не можна.

   НАПРЯМ ВИДНО ПО САМОМУ НОМЕРУ, і це найнадійніше з усього, що можна
   зробити: номер живе не лише в адмінці, а в КП, у переписці, у платіжці,
   на скріншоті. Хто б куди його не переслав, з першої цифри зрозуміло, про
   що мова.

   Ряди ведуться окремо. Спільний лічильник був би пасткою: щойно зʼявилось
   перше замовлення з пʼятірки, наступне B2B отримало б номер за пʼять
   мільйонів — і нумерація Канбану, яка йде з 2024 року, обірвалась би
   стрибком.

   Перевіряємо:
     — B2B бере номер зі своєї тисячі, B2C — зі своїх пʼяти мільйонів;
     — замовлення B2C не зрушує лічильник B2B, і навпаки;
     — старе замовлення без поля напряму лишається B2B;
     — напрям читається з самого номера;
     — розділ у меню зветься B2C.

   Запуск:  node tests/two-dirs.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8874;
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

/* Замовлення Канбану, заведене до появи напрямів: поля `dir` у нього немає
   зовсім, і воно має лишитись B2B — усе, що заведено до цього дня, це B2B. */
const ORDER = {
  id:'1', orderId:'1000042', type:'client', name:'Оксана', status:'kp', site:'main',
  payments:[], createdAt:'2026-09-20T09:00:00.000Z', hist:[],
  totalPrice:12000, totalCost:7000, margin:5000, marginPct:41,
  items:[{ kind:'main', name:'Футболка', qty:20, unitPrice:600, price:12000 }]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={');
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
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('═══ ДВА РЯДИ НОМЕРІВ ═══');
const ряди = await p.evaluate(() => {
  try{ localStorage.removeItem('lq.orderSeq'); localStorage.removeItem('lq.orderSeqC'); }catch(e){}
  contentData.orderSeq = 0; contentData.orderSeqC = 0;
  const b1 = makeOrderId();            // як його кликали завжди — це B2B
  const c1 = makeOrderId('b2c');
  const c2 = makeOrderId('b2c');
  const b2 = makeOrderId();
  return { b1, c1, c2, b2 };
});
console.log('   ' + JSON.stringify(ряди));
ok(/^10000/.test(ряди.b1) && /^10000/.test(ряди.b2),
  'B2B бере номер зі своєї тисячі — нумерація Канбану не обірвалась',
  'номер B2B не з того ряду: ' + JSON.stringify(ряди));
ok(/^50000/.test(ряди.c1) && /^50000/.test(ряди.c2),
  'B2C бере номер зі своїх пʼяти мільйонів — напрям видно з першої цифри',
  'номер B2C не з того ряду: ' + JSON.stringify(ряди));
ok(+ряди.b2 === +ряди.b1 + 1,
  'два замовлення B2C між ними не зрушили лічильник B2B ні на крок',
  'спільний лічильник: B2B стрибнув через ряд B2C — ' + JSON.stringify(ряди));
ok(+ряди.c2 === +ряди.c1 + 1,
  'і сам ряд B2C іде підряд, без дірок від чужого напряму',
  'ряд B2C розірваний: ' + JSON.stringify(ряди));

console.log('');
console.log('═══ НАПРЯМ ЧИТАЄТЬСЯ І З ПОЛЯ, І З НОМЕРА ═══');
const напрям = await p.evaluate(() => ({
  старе: orderDir(orders[0]),
  зПоля: orderDir({ dir:'b2c', orderId:'5000001' }),
  зНомераB: numDir('1000042'),
  зНомераC: numDir('5000001')
}));
console.log('   ' + JSON.stringify(напрям));
ok(напрям.старе === 'b2b',
  'замовлення, заведене до появи напрямів, лишається B2B — і поля йому не треба',
  'старе замовлення змінило напрям: ' + JSON.stringify(напрям));
ok(напрям.зПоля === 'b2c',
  'напрям бере поле замовлення: воно й є правдою',
  'поле напряму не читається: ' + JSON.stringify(напрям));
ok(напрям.зНомераB === 'b2b' && напрям.зНомераC === 'b2c',
  'а сам номер каже напрям навіть там, де картки під рукою немає — у листі чи на скріншоті',
  'з номера напрям не читається: ' + JSON.stringify(напрям));

console.log('');
console.log('═══ РОЗДІЛ ЗВЕТЬСЯ «ЗАМОВЛЕННЯ B2C» ═══');
const меню = await p.evaluate(() => {
  const b = document.querySelector('.nav button[data-view="design"]');
  return { підпис:((b && b.textContent) || '').trim(),
           відділ:/Дизайн-відділ/.test(document.body.innerText) };
});
console.log('   ' + JSON.stringify(меню));
/* Саме «замовлення», а не «B2C»: у меню поруч стоїть така сама пара для
   B2B, і напрям без слова «замовлення» читався як окрема сутність. */
ok(меню.підпис === 'Замовлення B2C',
  'у меню стоять замовлення напряму, а не відділ: дизайн — це одна з його дошок, а не він сам',
  'розділ досі зветься відділом: ' + JSON.stringify(меню));

console.log('');
console.log('═══ НАПРЯМ ВИДНО ДО ТОГО, ЯК ЩОСЬ ПРОЧИТАЮТЬ ═══');
/* Розділи двох напрямів схожі як дві краплі, і людина, яка працює в обох,
   легко почне робити роботу не там. Смуга й підпис знімають це питання
   раніше, ніж воно виникне. */
const очі = await p.evaluate(() => {
  const sec = document.getElementById('view-design');
  return { смуга: !!(sec && sec.classList.contains('is-b2c')),
           підпис: ((sec && sec.querySelector('.dir-tag')) || {}).textContent || '' };
});
console.log('   ' + JSON.stringify(очі));
ok(очі.смуга && /номери з 5/.test(очі.підпис),
  'напрям підписаний просто в шапці розділу — і смугою, яку видно краєм зору',
  'розділ нічим не відрізняється від сусіднього: ' + JSON.stringify(очі));

console.log('');
console.log('═══ ГРОШІ РАХУЮТЬСЯ ОКРЕМО ═══');
/* Підсумок, зліплений із двох різних бізнесів, не означає нічого: середній
   чек B2B і B2C відрізняється в десять разів, і разом вони дають число,
   якого немає в природі. */
const гроші = await p.evaluate(() => {
  orders.push({ id:'x', orderId:'5000099', dir:'b2c', status:'b2c-new',
                createdAt:new Date().toISOString(), items:[], totalPrice:999 });
  return { усього: orders.length, ваналітиці: anOrders().length,
           чужих: anOrders().filter(o => o.dir === 'b2c').length };
});
console.log('   ' + JSON.stringify(гроші));
ok(гроші.чужих === 0 && гроші.ваналітиці < гроші.усього,
  'аналітика рахує свій напрям — чужі суми в підсумок не потрапляють',
  'у підсумку змішані два бізнеси: ' + JSON.stringify(гроші));

console.log('');
console.log('═══ ОДИН ЛОГОТИП НА КІЛЬКА ПОЗИЦІЙ ═══');
/* У пропозиції може бути світшот, футболка й кепка з одним і тим самим
   логотипом. Фізично це один друк і один файл, а в адмінці кожна позиція
   носить свою копію: змінили логотип на світшоті — на футболці лишився
   старий. Клієнт отримує КП, де той самий логотип виглядає по-різному на
   сусідніх картках, і першим це помічає саме він. */
const луна = await p.evaluate(() => {
  const o = { id:'echo', orderId:'1000777', dir:'b2b', hist:[], items:[
    { name:'Світшот', prints:[{ file:'https://cdn/logo-old.png' }] },
    { name:'Футболка', prints:[{ file:'https://cdn/logo-old.png' }] },
    { name:'Кепка',   prints:[{ file:'https://cdn/inshiy.png' }] }
  ]};
  const свіжа = { name:'Світшот', prints:[{ file:'https://cdn/logo-new.png' }] };
  const був = o.items[0];
  o.items.splice(0, 1, свіжа);
  window.__T = [];
  const realToast = window.toast;
  window.toast = m => window.__T.push(String(m));
  logoEchoWarn(o, був, [свіжа]);
  window.toast = realToast;
  const сказано = window.__T.join(' | ');
  // Той самий логотип не міняли — нічого й не кажемо.
  window.__T = [];
  window.toast = m => window.__T.push(String(m));
  logoEchoWarn(o, свіжа, [свіжа]);
  window.toast = realToast;
  return { сказано, мовчить: !window.__T.length,
           слід: (o.hist || []).filter(h => h.s === 'logo-echo').length };
});
console.log('   ' + JSON.stringify(луна));
ok(/Футболка/.test(луна.сказано) && !/Кепка/.test(луна.сказано),
  'кажемо вголос, які саме позиції тепер розходяться — і не чіпаємо чужий логотип',
  'попередження не те: ' + JSON.stringify(луна));
ok(луна.мовчить,
  'логотип не міняли — нічого й не кажемо: зайве попередження перестають читати',
  'попередження зʼявляється там, де нічого не змінилось');
ok(луна.слід === 1,
  'слід лишається в історії замовлення — через тиждень буде видно, чому логотипи розійшлись',
  'сліду в історії немає');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'напрями розділені: свої номери, своє поле, своя назва');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
