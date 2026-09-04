/* Вкладка «Замовлення» на сторінці клієнта.

   До оплати за посиланням лежить КП — і на цьому все. Після оплати клієнт
   сліп: єдиний спосіб дізнатись, що відбувається, — написати менеджеру.
   Звідси й береться купа узгоджень у чатах: не тому, що клієнт настирливий,
   а тому, що ми не залишили йому іншого місця.

   Нового екрана для цього не треба. На тій самій сторінці, за тим самим
   посиланням, зʼявляється друга вкладка: етапи, фото тестового відшиву з
   кнопками «погоджую» / «потрібні правки» і номер накладної.

   Перевіряємо:
     — до оплати вкладки немає взагалі, сторінка така, якою була;
     — після оплати вона відкрита першою: по неї людина й повертається;
     — питання про відшив зʼявляється тільки тоді, коли ми самі вже
       подивились на фото;
     — відповідь пишеться в документ пропозиції — з версією макета, щоб
       «погоджую» не приліпилось до іншої версії;
     — «потрібні правки» несуть причину з фіксованого списку: за нею
       система сама вирішить, дизайнеру це чи на перешив.

   Запуск:  node tests/order-tab.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8807;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#E8EDF3"/></svg>');
const FP = Array.from({length:144},(_,i)=>(i*1)%5).join('');
const ITEM = { kind:'main', vgroup:'', name:'Футболка поло', color:'Чорна',
  print:'Вишивка логотипа', sizes:'M × 4', qty:4, unitPrice:1450, price:5800,
  basePrice:8500, baseUnitPrice:2125, mockups:[PH], prints:[],
  views:[{side:'front', label:'Перед', img:PH, show:true}],
  sides:[], techniques:[], tiers:[], specs:[], about:'',
  desc:{ method:'embro', units:4, base:300, coefPart:200, pieceFee:20, dtfCols:[],
         designs:[FP], designKinds:['img'], bare:false } };

const TRACK = {
  orderId:'1000401', dueAt:'2026-12-05',
  steps:[
    { key:'pay',  label:'Оплачено',          state:'done', at:'2026-09-01T10:00:00.000Z' },
    { key:'art',  label:'Макет погоджено',   state:'done', at:'2026-09-12T10:00:00.000Z' },
    { key:'test', label:'Тестовий відшив',   state:'ask',  at:'' },
    { key:'prod', label:'Тираж',             state:'wait' },
    { key:'ship', label:'Відправка',         state:'wait' }
  ],
  ask:{ n:3, photo:PH },
  reasons:[{ key:'big', label:'Завеликий / замалий' }, { key:'crook', label:'Криво вишито' },
           { key:'other', label:'Інше' }],
  ttn:''
};
const OFFER = extra => Object.assign({
  orderId:'1000401', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, payment:'50% для запуску', startWith:'',
          validUntil:'2026-12-02T12:00:00.000Z' },
  trust:[], faq:[], cases:[], reco:[], variants:[], items:[ITEM],
  state:'confirmed',
  manager:{ name:'Олег Панченко', role:'Ваш менеджер', phone:'+380671112233' },
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1}] } },
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] }
}, extra || {});

/* Стуб бази: сторінка бере документ за токеном і пише в нього відповідь.
   Записи складаємо в купку — саме вони й мають значення. */
function stubFor(doc){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  return s.replace('window.firebase={',
      'window.__DOC=' + JSON.stringify(doc) + ';\n  window.firebase={')
    .replace('Doc.prototype.get=function(){ return Promise.resolve(new Snap(\'x\', null)); };',
      'Doc.prototype.get=function(){ return Promise.resolve(new Snap(this.__id||"x", window.__DOC)); };')
    .replace('Doc.prototype.update=function(){ return Promise.resolve(); };',
      'Doc.prototype.update=function(d){ (window.__UPD=window.__UPD||[]).push(d); return Promise.resolve(); };')
    .replace('Col.prototype.doc=function(){ return new Doc(); };',
      'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; return d; };');
}
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
async function open(doc){
  const p = await browser.newPage({ viewport:{ width:430, height:1000 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
  const body = stubFor(doc);
  await p.route('**://**', r => { const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort(); });
  await p.goto(HOST + '/offer.html?o=tok123456', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(3500);
  return p;
}

console.log('═══ ДО ОПЛАТИ СТОРІНКА ТАКА, ЯКОЮ БУЛА ═══');
{
  const p = await open(OFFER());
  const t = await p.evaluate(() => ({
    tabs: document.querySelectorAll('.tab').length,
    ord:  document.querySelectorAll('.ord').length,
    kp:   !document.querySelector('.wrap').hasAttribute('hidden')
  }));
  ok(t.tabs === 0 && t.ord === 0 && t.kp,
    'без виробництва вкладок немає — КП відкривається як завжди',
    'на сторінці зʼявилось зайве: ' + JSON.stringify(t));
  await p.close();
}

console.log('');
console.log('═══ ПІСЛЯ ОПЛАТИ ВІДКРИТЕ ЗАМОВЛЕННЯ ═══');
const p = await open(OFFER({ track: TRACK }));
const view = await p.evaluate(() => ({
  tabs: [...document.querySelectorAll('.tab')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')),
  hiddenKp: document.querySelector('.wrap').hasAttribute('hidden'),
  head: (document.querySelector('.ord h2') || {}).textContent,
  due: (document.querySelector('.ord-due') || {}).textContent,
  steps: [...document.querySelectorAll('.ord-step')].map(s =>
    (s.querySelector('.ord-t').childNodes[0].textContent.trim()) + ' · ' +
    (s.className.replace('ord-step', '').trim() || 'wait')),
  photo: !!document.querySelector('.ord-ask img'),
  acts: [...document.querySelectorAll('[data-ord]')].map(b => b.dataset.ord)
}));
console.log('  ' + view.tabs.join(' | '));
view.steps.forEach(s => console.log('    ' + s));
ok(view.tabs.length === 2 && /Замовлення\*/.test(view.tabs[1]) && view.hiddenKp,
  'вкладка «Замовлення» відкрита першою — по неї людина й повертається',
  'відкрилась не та вкладка: ' + JSON.stringify(view));
ok(/1000401/.test(view.head || '') && /05\.12/.test(view.due || ''),
  'у шапці номер замовлення й дата здачі',
  'шапка замовлення не та: ' + view.head + ' / ' + view.due);
ok(view.steps.length === 5 && /Оплачено · is-done/.test(view.steps[0]) &&
   /Тестовий відшив · is-ask/.test(view.steps[2]),
  'етапи показані станами, а не однаковим списком',
  'етапи не ті: ' + JSON.stringify(view.steps));
ok(view.photo && view.acts.join() === 'ok,fix,send',
  'фото відшиву показане, і під ним рівно два рішення',
  'блок погодження не той: ' + JSON.stringify(view.acts));

console.log('');
console.log('═══ «ПОГОДЖУЮ» ЙДЕ В БАЗУ З ВЕРСІЄЮ ═══');
await p.click('[data-ord="ok"]');
await p.waitForTimeout(600);
const wrote = await p.evaluate(() => {
  const u = (window.__UPD || []).filter(x => x && x.clientApprovals).pop();
  return { test:u && u.clientApprovals.test, ev:(u && (u.events || []).slice(-1)[0] || {}).type,
           txt:(document.querySelector('.ord-done') || {}).textContent,
           acts:document.querySelectorAll('[data-ord]').length };
});
console.log('  ' + JSON.stringify(wrote.test) + ' · подія: ' + wrote.ev);
ok(wrote.test && +wrote.test.n === 3 && wrote.test.at,
  'погодження записане разом із версією макета — не «взагалі», а за v3',
  'погодження без версії: ' + JSON.stringify(wrote.test));
ok(wrote.ev === 'test_ok',
  'подія лягла в ту саму стрічку, що й решта дій клієнта',
  'події немає: ' + wrote.ev);
ok(/Дякуємо/.test(wrote.txt || '') && wrote.acts === 0,
  'після відповіді кнопок більше немає — двічі погодити не можна',
  'кнопки лишились: ' + JSON.stringify(wrote));
await p.close();

console.log('');
console.log('═══ «ПОТРІБНІ ПРАВКИ» НЕСУТЬ ПРИЧИНУ ═══');
{
  const p2 = await open(OFFER({ track: TRACK }));
  await p2.click('[data-ord="fix"]');
  await p2.waitForTimeout(300);
  const opened = await p2.evaluate(() =>
    document.getElementById('ordWhy').classList.contains('open'));
  ok(opened, 'спершу питаємо, що саме не так', 'список причин не відкрився');
  await p2.selectOption('#ordReason', 'crook');
  await p2.click('[data-ord="send"]');
  await p2.waitForTimeout(600);
  const back = await p2.evaluate(() => {
    const u = (window.__UPD || []).filter(x => x && x.clientApprovals).pop();
    return { b:u && u.clientApprovals.testBack,
             txt:(document.querySelector('.ord-done') || {}).textContent };
  });
  console.log('  ' + JSON.stringify(back.b));
  ok(back.b && back.b.reason === 'crook' && +back.b.n === 3,
    'причина зі списку їде разом із версією — за нею система обере маршрут',
    'причина не доїхала: ' + JSON.stringify(back.b));
  ok(/правки записані/i.test(back.txt || ''),
    'клієнту сказано, що його почули',
    'після правок сторінка мовчить: ' + back.txt);
  await p2.close();
}

console.log('');
console.log('═══ ВІДПОВІВ РАНІШЕ — ПИТАННЯ НЕ ПОВТОРЮЄТЬСЯ ═══');
{
  const p3 = await open(OFFER({ track: TRACK,
    clientApprovals:{ test:{ n:3, at:'2026-09-13T10:00:00.000Z' } } }));
  const st = await p3.evaluate(() => ({
    acts:document.querySelectorAll('[data-ord]').length,
    txt:(document.querySelector('.ord-done') || {}).textContent
  }));
  ok(st.acts === 0 && /Дякуємо/.test(st.txt || ''),
    'повернувся на сторінку — бачить свою відповідь, а не питання вдруге',
    'питання показане повторно: ' + JSON.stringify(st));
  await p3.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'кнопка, яка щось вирішує, живе на сторінці, а не в переписці');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
