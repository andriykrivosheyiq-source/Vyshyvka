/* «Що відбувалось» показує, що саме клієнт підтвердив і на який чек.

   ЯК БУЛО. У стрічці картки стояло «Клієнт підтвердив» — тип події й час.
   Що саме він підтвердив і на яку суму, менеджер мав шукати окремо: лізти в
   кошторис і звіряти, чи це та сама версія. А вона до того часу могла вже
   змінитись — тоді подія посилалась на те, чого в ту мить не існувало.

   ЯК СТАЛО. Сторінка пропозиції записує в кожну подію суму, кількість і склад
   НА МИТЬ ПОДІЇ, тим самим рядком, який стоїть у клієнта в шапці. Картка їх
   показує: «Клієнт підтвердив · 30 худі + 60 футболок · 42 300 ₴».

   Перевіряємо:
     — подія несе суму й склад, а не самий лише тип;
     — рядок підтвердження називає склад і чек;
     — склад скорочується до двох позицій і «+ще N» — рядок читають з погляду;
     — старі КП без суми в події беруть її з останньої дії клієнта;
     — видно, скільки людина читала й доки догорнула;
     — ЖОДЕН тип події не лишається сирим: «Клієнт pack» замість слів;
     — видно «переслав КП далі» й «закрив сторінку» — і в цих рядках немає
       ні суми, ні складу: вони там ні до чого;
     — повторне відкриття не мішається з першим;
     — дії клієнта не вилітають зі стрічки через межу в 14 рядків.

   Запуск:  node tests/client-log.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8852;
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

const ORDER = {
  id:'1', orderId:'1002200', type:'client', name:'Андрій', company:'ARMORIX',
  phone:'+380670002200', status:'kp', site:'main', offerToken:'tokLOG', payments:[],
  createdAt:'2026-09-10T09:00:00.000Z', hist:[],
  totalPrice:42300,
  items:[{ kind:'main', name:'Худі', color:'чорне', garmentId:'hoodie', qty:30,
           unitPrice:1410, price:42300 }]
};

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8')
  .replace('window.firebase={',
    'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.firebase={')
  .replace(
    'var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(){}\n' +
    '  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
    '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
    '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
    '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){\n' +
    "      return n==='kanbanOrders' ? new SeedCol() : new Col(); },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);

/* Пропозиція така, якою її пише сама сторінка: подія з сумою, кількістю й
   рядком складу — тим самим, що стоїть у клієнта в шапці. */
const OFFER = {
  createdAt:'2026-09-10T10:00:00.000Z',
  clientAt:'2026-09-11T12:40:00.000Z',
  behaviour:{ depthPct:72, firstActionSec:31, totalSec:245 },
  clientAction:{ kind:'confirm', total:42300, count:90 },
  events:[
    { type:'opened',    at:'2026-09-11T12:30:00.000Z', sum:35400, qty:30, what:'30 худі' },
    { type:'qty',       at:'2026-09-11T12:34:00.000Z', sum:39900, qty:40, what:'40 худі' },
    { type:'reco-add',  at:'2026-09-11T12:36:00.000Z', sum:41100, qty:70,
      what:'40 худі · 30 футболок' },
    { type:'confirmed', at:'2026-09-11T12:40:00.000Z', sum:42300, qty:90,
      what:'30 худі · 60 футболок · 12 кепок · 8 шоперів' }
  ]
};

console.log('═══ РЯДКИ ІСТОРІЇ ═══');
const feed = await p.evaluate(off => {
  offersByToken['tokLOG'] = off;
  return activityFeed(orders[0]).map(x => x.text);
}, OFFER);
feed.forEach(t => console.log('   ' + t));

const line = re => feed.find(t => re.test(t)) || '';
const conf = line(/підтвердив/);
ok(/42\s?300/.test(conf) && /₴/.test(conf),
  'у рядку підтвердження стоїть чек — його більше не треба шукати в кошторисі',
  'підтвердження без суми: «' + conf + '»');
ok(/30 худі \+ 60 футболок/.test(conf),
  'і склад: що саме людина підтвердила',
  'складу в рядку немає: «' + conf + '»');
ok(/\+ще 2/.test(conf),
  'довгий склад скорочено до двох позицій і «+ще N» — рядок читається з погляду',
  'склад не скорочено: «' + conf + '»');
const qty = line(/змінив кількість/);
ok(/39\s?900/.test(qty) && /40 худі/.test(qty),
  'зміна кількості теж із сумою — видно, куди вела кожна правка клієнта',
  'зміна кількості без числа: «' + qty + '»');
ok(/відкрив КП/.test(feed.join('|')),
  'видно, коли клієнт відкрив пропозицію',
  'події відкриття в стрічці немає');
const read = line(/читав/);
console.log('  ' + read);
ok(/4 хв/.test(read) && /72%/.test(read),
  'і скільки він її читав та доки догорнув',
  'про читання нічого не сказано: «' + read + '»');

console.log('');
console.log('═══ ЖОДНОЇ СИРОЇ НАЗВИ ПОДІЇ ═══');
/* Сторінка вміє записати більше типів, ніж картка вміла назвати: вибір
   пакета, варіанта, зняття позиції. Невідомий тип показувався як є —
   «Клієнт pack», і менеджер мав здогадуватись, що це. */
const kinds = await p.evaluate(() => {
  const types = ['opened','reopened','qty','pick','variant','pack',
                 'reco-add','reco-remove','share','left','changes','confirmed'];
  offersByToken['tokLOG'] = {
    createdAt:'2026-09-10T10:00:00.000Z',
    behaviour:{ depthPct:64, totalSec:200 },
    events: types.map((t, i) => ({ type:t, at:'2026-09-1' + (i % 9) + 'T10:00:00.000Z',
                                   sum:1000, qty:5, what:'5 худі' }))
  };
  return { known: types.map(t => offerEventLine({ type:t, sum:1000, qty:5, what:'5 худі' },
                                                offersByToken['tokLOG'])) };
});
kinds.known.forEach(t => console.log('   ' + t));
ok(!kinds.known.some(t => /Клієнт (pack|pick|variant|left|share|reopened)\b/.test(t)),
  'кожен тип події названо словами',
  'є сирі назви: ' + kinds.known.filter(t => /Клієнт [a-z-]+\b/.test(t)).join(' | '));
const shareLine = kinds.known.find(t => /переслав/.test(t)) || '';
const leftLine = kinds.known.find(t => /закрив/.test(t)) || '';
ok(/переслав КП далі/.test(shareLine) && !/₴/.test(shareLine),
  'пересилання видно окремим рядком, і суми в ньому немає',
  'рядок про пересилання не той: «' + shareLine + '»');
ok(/закрив сторінку/.test(leftLine) && /читав/.test(leftLine) && !/₴/.test(leftLine),
  'закриття сторінки каже, скільки людина читала, а не скільки коштує',
  'рядок про закриття не той: «' + leftLine + '»');
ok(kinds.known.some(t => /відкрив КП ще раз/.test(t)),
  'повторне відкриття не мішається з першим — людина повернулась подумати',
  'повторне відкриття називається так само, як перше');

console.log('');
console.log('═══ СТАРІ КП БЕЗ СУМИ В ПОДІЇ ═══');
/* КП, надіслані до цієї правки, мають подію без суми. Голий рядок «клієнт
   підтвердив» у них лишатись не повинен: число лежить поруч, у clientAction. */
const oldFeed = await p.evaluate(() => {
  offersByToken['tokLOG'] = {
    createdAt:'2026-09-10T10:00:00.000Z',
    clientAction:{ kind:'confirm', total:42300, count:90 },
    events:[{ type:'confirmed', at:'2026-09-11T12:40:00.000Z' }]
  };
  return activityFeed(orders[0]).map(x => x.text);
});
const oldConf = oldFeed.find(t => /підтвердив/.test(t)) || '';
console.log('  ' + oldConf);
ok(/42\s?300/.test(oldConf),
  'у старому КП суму беремо з останньої дії клієнта — рядок не лишається голим',
  'старе підтвердження без суми: «' + oldConf + '»');

console.log('');
console.log('═══ ДІЇ КЛІЄНТА НЕ ВИЛІТАЮТЬ ЗІ СТРІЧКИ ═══');
/* Межа в 14 рядків обрізала стрічку рівно там, де починались дії клієнта:
   етапи й треки займали її всю. */
const kept = await p.evaluate(off => {
  const o = orders[0];
  o.trackHist = [];
  for(let i = 0; i < 18; i++)
    o.trackHist.push({ t:'design', s:'new', at:'2026-09-12T0' + (i % 10) + ':00:00.000Z' });
  offersByToken['tokLOG'] = off;
  const f = activityFeed(o);
  o.trackHist = [];
  return { n: f.length, client: f.filter(x => x.kind === 'client').length };
}, OFFER);
console.log('  рядків ' + kept.n + ', із них клієнтських ' + kept.client);
ok(kept.client >= 4,
  'дії клієнта лишаються в стрічці, навіть коли треків більше за неї',
  'дії клієнта витіснено службовими рядками: ' + JSON.stringify(kept));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'в історії видно, що саме клієнт підтвердив і на який чек');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
