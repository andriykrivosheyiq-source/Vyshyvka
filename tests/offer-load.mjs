/* Сторінка пропозиції не здається з першої невдачі.

   Клієнт бачив «Не вдалося відкрити пропозицію · Код: unavailable». Це не
   «немає такої пропозиції» й не «закрито доступ»: це «до бази не
   достукались». Firestore тримає постійне зʼєднання, і на частині мобільних
   мереж, у корпоративних Wi-Fi та за деякими VPN воно просто не
   встановлюється — інтернет при цьому є.

   Паралельні сесії тут ні до чого: той самий документ можуть читати скільки
   завгодно людей одночасно.

   Тому сторінка тепер:
     — пробує тричі з паузами, а не один раз;
     — має запасний шлях звичайним HTTPS-запитом, який проходить там, де не
       проходить постійне зʼєднання бібліотеки;
     — а якщо все одно не вийшло, показує кнопку «Спробувати ще раз» і
       повторює спробу сама, коли звʼязок повернувся.

   Заборону й відсутність документа це не чіпає: там пробувати нема сенсу, і
   людині кажуть правду одразу.

   Запуск:  node tests/offer-load.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8816;
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
const OFFER = {
  orderId:'1001300', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'',
  items:[{ kind:'main', vgroup:'', name:'Худі', color:'Чорний', print:'Вишивка',
    sizes:'M × 10', qty:10, unitPrice:1200, price:12000, basePrice:24000, baseUnitPrice:2400,
    mockups:[PH], prints:[], views:[{side:'front',label:'Перед',img:PH,show:true}],
    sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:'',
    desc:{ method:'embro', units:10, base:300, coefPart:200, pieceFee:20, dtfCols:[],
           designs:[FP], designKinds:['img'], bare:false } }],
  manager:{ name:'Олег', role:'Менеджер', phone:'+380671112233' },
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1}] } },
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] }
};

/* `mode` каже стубу, як поводитись:
     'flaky' — перші дві спроби падають з unavailable, третя віддає документ;
     'dead'  — бібліотека не працює завжди (тоді має врятувати HTTPS-запит);
     'denied'— заборона доступу: пробувати ще раз нема сенсу. */
function stub(mode){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  return s.replace('window.firebase={',
      'window.__DOC=' + JSON.stringify(OFFER) + ';\n' +
      '  window.__MODE=' + JSON.stringify(mode) + ';\n' +
      '  window.__TRIES=0;\n  window.firebase={')
    .replace('Doc.prototype.get=function(){ return Promise.resolve(new Snap(\'x\', null)); };',
      'Doc.prototype.get=function(){\n' +
      '    window.__TRIES++;\n' +
      "    if(window.__MODE==='denied'){ var e=new Error('Missing or insufficient permissions'); e.code='permission-denied'; return Promise.reject(e); }\n" +
      "    if(window.__MODE==='dead' || (window.__MODE==='flaky' && window.__TRIES<3)){\n" +
      "      var u=new Error('The service is currently unavailable'); u.code='unavailable'; return Promise.reject(u); }\n" +
      '    return Promise.resolve(new Snap(this.__id||"x", window.__DOC)); };')
    .replace('Col.prototype.doc=function(){ return new Doc(); };',
      'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; return d; };');
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
/* Запасний шлях — звичайний HTTPS-запит до Firestore. У тесті відповідаємо
   на нього самі, у тому самому форматі, що й справжній Firestore. */
function restBody(){
  const wrap = v => {
    if(v === null || v === undefined) return { nullValue:null };
    if(typeof v === 'string') return { stringValue:v };
    if(typeof v === 'boolean') return { booleanValue:v };
    if(typeof v === 'number') return Number.isInteger(v)
      ? { integerValue:String(v) } : { doubleValue:v };
    if(Array.isArray(v)) return { arrayValue:{ values:v.map(wrap) } };
    const f = {}; Object.keys(v).forEach(k => { f[k] = wrap(v[k]); });
    return { mapValue:{ fields:f } };
  };
  const fields = {}; Object.keys(OFFER).forEach(k => { fields[k] = wrap(OFFER[k]); });
  return JSON.stringify({ name:'projects/loomiq-admin/documents/offers/tok123456', fields });
}
async function open(mode, opts){
  const p = await browser.newPage({ viewport:{ width:430, height:900 } });
  p.on('pageerror', e => errs.push(mode + ': ' + e.message.slice(0, 160)));
  const body = stub(mode);
  let restHits = 0;
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
    if(/firestore\.googleapis\.com/.test(u)){
      /* Сторінка ходить у Firestore ще й по одне налаштування аналітики —
         рахуємо тільки запити саме за пропозицією. */
      if(/documents\/offers\//.test(u)) restHits++;
      if(opts && opts.restDown) return r.fulfill({ status:503, body:'no' });
      return r.fulfill({ contentType:'application/json', body:restBody() });
    }
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/offer.html?o=tok123456', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4500);
  return { p, rest:() => restHits };
}

console.log('═══ МЕРЕЖА МОРГНУЛА — СТОРІНКА ДОЧЕКАЛАСЬ ═══');
{
  const { p } = await open('flaky');
  const st = await p.evaluate(() => ({
    hero: !!document.querySelector('.hero'),
    tries: window.__TRIES,
    err: (document.querySelector('.state h1') || {}).textContent || ''
  }));
  console.log('  спроб: ' + st.tries + ' · екран помилки: ' + (st.err || 'немає'));
  ok(st.hero && !st.err,
    'дві невдалі спроби поспіль — і пропозиція все одно відкрилась',
    'сторінка здалась: ' + JSON.stringify(st));
  ok(st.tries >= 3, 'спроб було кілька, а не одна', 'спроба лишилась одна: ' + st.tries);
  await p.close();
}

console.log('');
console.log('═══ ЗʼЄДНАННЯ БІБЛІОТЕКИ НЕ ПРОХОДИТЬ — ВИРУЧАЄ ЗВИЧАЙНИЙ ЗАПИТ ═══');
{
  const { p, rest } = await open('dead');
  const st = await p.evaluate(() => ({
    hero: !!document.querySelector('.hero'),
    name: (document.querySelector('.hero h1') || {}).textContent || ''
  }));
  console.log('  запитів запасним шляхом: ' + rest() + ' · шапка: ' + st.name.trim());
  ok(st.hero && /ARMORIX/.test(st.name),
    'сторінка відкрилась запасним шляхом, і це та сама пропозиція',
    'запасний шлях не спрацював: ' + JSON.stringify(st));
  ok(rest() > 0, 'звичайний HTTPS-запит справді був', 'запасним шляхом не ходили');
  await p.close();
}

console.log('');
console.log('═══ КОЛИ НЕ ВИЙШЛО ЗОВСІМ ═══');
{
  const { p } = await open('dead', { restDown:true });
  const st = await p.evaluate(() => ({
    err: (document.querySelector('.state h1') || {}).textContent || '',
    btn: !!document.getElementById('failRetry'),
    txt: (document.querySelector('.state p') || {}).textContent || ''
  }));
  console.log('  ' + st.err + ' · кнопка: ' + st.btn);
  ok(/Не вдалося відкрити/.test(st.err) && st.btn,
    'на екрані помилки є кнопка «Спробувати ще раз»',
    'кнопки повтору немає: ' + JSON.stringify(st));
  ok(/звʼязок/i.test(st.txt),
    'причину названо звʼязком, а не таємничим кодом',
    'пояснення не те: ' + st.txt);
  /* Мережа повернулась — сторінка пробує сама, без перезавантаження. */
  await p.unroute('**://**');
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub('dead') });
    if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({ contentType:'application/json', body:restBody() });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => !!document.querySelector('.hero'));
  ok(after,
    'звʼязок повернувся — сторінка відкрилась сама, без перезавантаження',
    'після повернення звʼязку сторінка лишилась з помилкою');
  await p.close();
}

console.log('');
console.log('═══ ЗАБОРОНУ НЕ ПЕРЕПИТУЄМО ═══');
{
  const { p, rest } = await open('denied');
  const st = await p.evaluate(() => ({
    tries: window.__TRIES,
    txt: (document.querySelector('.state p') || {}).textContent || '',
    btn: !!document.getElementById('failRetry')
  }));
  console.log('  спроб: ' + st.tries + ' · ' + st.txt.slice(0, 60));
  ok(st.tries === 1 && rest() === 0,
    'заборона — це не «мережа моргнула»: пробувати ще раз нема сенсу',
    'заборону перепитували: спроб ' + st.tries + ', запасних ' + rest());
  ok(/Доступ до пропозиції закритий/.test(st.txt) && !st.btn,
    'людині кажуть правду одразу, без кнопки «спробувати ще»',
    'заборону подали як збій звʼязку');
  await p.close();
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad
  ? 'розходжень: ' + bad
  : 'одна невдала спроба більше не закриває пропозицію');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
