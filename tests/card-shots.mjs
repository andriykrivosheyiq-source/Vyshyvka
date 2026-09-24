/* Кадри картки: що показуємо самі й що менеджер додає руками.

   ДВА ПИТАННЯ, І ОБИДВА ВІД АНДРІЯ.

   Перше. «Головне, щоб було завжди дві картинки. За базу це по дефолту
   перед і зад». Був період, коли спина вважалась необовʼязковою: є фото
   моделі — і досить. На ділі людина, яка дивиться на футболку спереду,
   наступним питанням питає, що ззаду, — байдуже, нанесено там щось чи ні.
   А в частини виробів заднього ракурсу немає взагалі («футболка оверсайз
   не має задньої сторони»), і тоді другий кадр доводиться добирати з того,
   що є, — але він мусить бути.

   Друге, і воно важливіше. «Я додав задню сторону, зберіг, переходжу в
   діалог, щоб відправити, — а воно сюди не збереглося». Вибір кадрів
   роблять в одному місці (вкладка «Картки» в робочому місці), а надсилають
   з іншого (панель карток у діалозі), і між ними лежить запис у
   замовлення. Поки цей шлях не перевірено наскрізь, «зберіг» — це слово, а
   не факт: налаштування може лягти в кадр, у памʼять вкладки, у документ
   пропозиції — і нікуди звідти не доїхати.

   Тому тут саме наскрізний шлях: тицяємо галочку в кадрі робочого місця,
   чекаємо на запис, і питаємо колоду діалогу — ту саму, з якої картки
   йдуть клієнту.

   Запуск:  node tests/card-shots.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8885;
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

const PRICING = {
  minMarginPct: 0,
  tiers: [{ from:1, coef:1 }],
  garmentTiers: [{ from:1, coef:1 }],
  methods: {
    embro: { orderFee:850, orderCost:200, sketchFee:350, sketchCost:100,
             pieceFee:0, ratePerMm2:0, tiers:[{ from:1, coef:1 }] },
    dtf:   { orderFee:900, orderCost:200, sketchFee:300, sketchCost:80,
             tiers:[{ from:1, coef:1 }], qtyFrom:[1] }
  }
};
const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };
const FP = Array.from({ length:144 }, (_, i) => (i * 7) % 10).join('');

/* Знімки робимо власними: файл із мережі тест не тягне, а картці досить
   будь-якої картинки потрібного розміру. */
const pic = c => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100">' +
  '<rect width="900" height="1100" fill="#EFEFEC"/>' +
  '<rect x="220" y="230" width="460" height="640" rx="40" fill="' + c + '"/></svg>');
const V = (side, label, c) => ({ id:side, side, label, img:pic(c), show:true });

/* Позиція з трьома ракурсами: перед, зад і рукав. Нанесення — лише на
   переді: саме на такій позиції й видно правило «перед і зад завжди», бо
   зад сюди потрапляє не через нанесення. */
const item = (name, gid, views) => ({
  kind:'main', name, garmentId:gid, color:'Чорний', print:'Вишивка',
  sizes:'M × 4', qty:4, unitPrice:0, price:0, unitCost:0, cost:0,
  mockups:[pic('#2B2F36')], views,
  prints:[{ side:'front', sideLabel:'Спереду', technique:'Вишивка',
            widthMm:80, heightMm:45 }],
  config:{ garmentId:gid },
  desc:{ method:'embro', gid, units:4, base:600, coefPart:200, basePart:0,
         minPart:0, pieceFee:0, bare:false, designs:[FP], designKinds:['img'],
         designMm2:[1200], dtfCols:[] }
});
const ORDER = {
  id:'1', orderId:'1000081', type:'client', status:'kp', site:'main',
  offerToken:'tok81', payments:[], hist:[], createdAt:'2026-09-10T09:00:00.000Z',
  feeAdj:0, feeAdjC:0,
  items:[
    item('Футболка базова', 'tee',
         [V('front','Перед','#141414'), V('back','Спина','#141414'),
          V('left','Рукав','#141414')]),
    /* А цей виріб заднього ракурсу не має взагалі — рівно той випадок, про
       який казав Андрій. */
    item('Футболка оверсайз', 'teeover', [V('front','Перед','#2B2F36')])
  ]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(pr => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pr;
  contentData.pricing = pr;
  repriceOrder(orders[0]);
  recalcOrderTotals(orders[0]);
}, PRICING);

console.log('═══ ПЕРЕД І ЗАД — ЗАВЖДИ ═══');
const склад = await p.evaluate(async () => {
  const deck = await cardDeckFor(orders[0]);
  const кадри = c => (c.shots || []).map(s => (s.model ? 'модель' : (s.side || 'мокап')));
  const список = c => (c.allShots || []).map(s => (s.model ? 'модель' : (s.side || 'мокап')));
  const базова = deck.list.filter(c => /базова/.test(c.name))[0];
  const оверсайз = deck.list.filter(c => /оверсайз/.test(c.name))[0];
  return { базоваРяд: кадри(базова), базоваСписок: список(базова),
           оверРяд: кадри(оверсайз) };
});
console.log('   футболка базова: ' + склад.базоваРяд.join(' · ') +
            '   (у списку: ' + склад.базоваСписок.join(' · ') + ')');
console.log('   футболка оверсайз: ' + склад.оверРяд.join(' · '));
ok(склад.базоваРяд.join() === 'front,back',
  'перед і зад стоять на картці самі — нанесення на спині для цього не потрібне',
  'склад кадрів не той: ' + склад.базоваРяд.join(' · '));
ok(склад.оверРяд.length >= 2,
  'у виробі без заднього ракурсу другий кадр добирається — картка не лишається з однією картинкою',
  'картка з однією картинкою: ' + склад.оверРяд.join(' · '));
ok(склад.базоваСписок.indexOf('left') >= 0,
  'рукав без нанесення чекає в списку — його можна поставити руками',
  'рукава немає в списку: ' + склад.базоваСписок.join(' · '));

console.log('');
console.log('═══ ГАЛОЧКА В РОБОЧОМУ МІСЦІ ДОЇЖДЖАЄ В ДІАЛОГ ═══');
/* Наскрізний шлях: відкриваємо робоче місце, вкладку «Картки», ставимо
   галочку на рукаві — і питаємо колоду діалогу. Між ними запис у
   замовлення, і саме він тут перевіряється. */
await p.evaluate(async () => {
  await openOfferEditor(orders[0]);
  await new Promise(r => setTimeout(r, 1500));
});
await p.waitForTimeout(2500);
const кадр = p.frames().filter(f => /offer-edit/.test(f.url()))[0];
ok(!!кадр, 'робоче місце пропозиції відкрилось', 'кадру пропозиції немає');
if(кадр){
  await кадр.evaluate(() => {
    const b = [...document.querySelectorAll('.tab')].find(x => /Картки/.test(x.textContent));
    if(b) b.click();
  });
  await p.waitForTimeout(3000);
  /* Обираємо в стрічці саме базову футболку: у неї є рукав, який треба
     поставити. */
  await кадр.evaluate(() => {
    const t = [...document.querySelectorAll('.cd-card')]
      .find(x => /базова/.test(x.textContent || ''));
    if(t) t.click();
  });
  await p.waitForTimeout(2000);
  /* Шукаємо рукав ЗА САМИМ ЗНІМКОМ, а не за підписом: підписи ракурсів
     складаються не тут, і звʼязувати тест із їхнім написанням означало б
     ловити чужу зміну як свою поломку. */
  const рукавURL = await p.evaluate(async () => {
    const deck = await cardDeckFor(orders[0]);
    const базова = deck.list.filter(c => /базова/.test(c.name))[0] || {};
    const sh = (базова.allShots || []).filter(s => s.side === 'left')[0];
    return (sh && (sh.key || sh.url)) || '';
  });
  const тик = await кадр.evaluate((url) => {
    const все = [...document.querySelectorAll('[data-shot]')];
    const ch = все.filter(x => !x.checked);
    if(!ch.length) return { є:false, було: все.length };
    const рукав = ch.filter(x => x.dataset.shot === url)[0] || ch[0];
    рукав.checked = true;
    рукав.dispatchEvent(new Event('change', { bubbles:true }));
    return { є:true, ключ: рукав.dataset.shot, той: рукав.dataset.shot === url,
             картка: ((document.querySelector('.cd-card.on') || {}).textContent || '').trim(),
             усі: все.map(x => (((x.closest('label') || {}).textContent) || '').trim() +
                               (x.checked ? '✓' : '·')),
             підпис: ((рукав.closest('label') || {}).textContent || '').trim() };
  }, рукавURL);
if(!тик.той) console.log('   у списку кадру: ' + (тик.усі || []).join(' | ') +
                         '   · картка: ' + тик.картка);
  console.log('   поставили галочку: ' + (тик.підпис || '—'));
  ok(тик.є && тик.той, 'у списку кадрів є рукав — знятий ракурс видно й ставиться',
    тик.є ? 'рукава в списку немає, ставили інший кадр: ' + тик.підпис
          : 'у списку немає жодного знятого кадру (усього ' + тик.було + ')');
  /* Запис іде через кадр у адмінку й далі в замовлення — даємо час. */
  await p.waitForTimeout(2500);
  const доїхало = await p.evaluate(async (k) => {
    const o = orders[0];
    const by = ((o.cards || {}).by) || {};
    const ключі = Object.keys(by).map(id => ({ id, off: by[id].off || {} }));
    const deck = await cardDeckFor(o);
    const базова = deck.list.filter(c => /базова/.test(c.name))[0];
    return { уЗамовленні: ключі.some(x => x.off[k] === 0),
             всьогоКарток: Object.keys(by).length,
             уКолоді: (базова.shots || []).map(s => (s.model ? 'модель' : (s.side || 'мокап'))) };
  }, тик.ключ);
  console.log('   у колоді діалогу: ' + доїхало.уКолоді.join(' · '));
  ok(доїхало.уЗамовленні,
    'галочка записалась у саме замовлення — переживе перезавантаження й видна з іншого компʼютера',
    'у замовленні налаштувань карток немає (карток у записі: ' + доїхало.всьогоКарток + ')');
  ok(доїхало.уКолоді.indexOf('left') >= 0,
    'і колода діалогу бере той самий ракурс — менеджер надсилає те, що склав',
    'у діалог поїхала стара картка: ' + доїхало.уКолоді.join(' · '));
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'що склали в картках — те й піде клієнту');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
