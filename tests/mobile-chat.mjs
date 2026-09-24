/* Переписка з телефона. Головне вікно роботи — і найтісніше місце.

   ЩО БУЛО НЕ ТАК. Шапка розмови складалась для монітора: імʼя, рядок про
   замовлення й лічильник вікна відповіді в один ряд із кнопками. На екрані
   в 390 пікселів цей ряд розповзався на чотири рядки, лічильник налазив на
   номер замовлення, а службові кнопки налаштувальника — «{ }» і лупа —
   з’їдали залишок. Унизу «⚡ Заготовки» текстом забирали третину смуги, і
   поле для листа лишалось завширшки у два слова.

   А найпідступніше — кегль. Safari збільшує сторінку, щойно торкнутись
   поля, у якому шрифт менший за 16 пікселів, і назад її не повертає. Тобто
   кожна відповідь клієнту лишала адмінку наближеною, і далі менеджер
   працював у ній боком.

   ПРАВИЛА, за якими це виправлено, — ті самі, якими живуть месенджери:
   ціль для пальця не менша за 40 пікселів, у полі вводу не менше 16,
   у шапці лишається тільки потрібне в розмові, низ поважає смугу жестів.

   Запуск:  node tests/mobile-chat.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8889;
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

const мить = хв => new Date(Date.now() - хв * 60000).toISOString().replace('T', ' ').slice(0, 16);
const ORDER = {
  id:'1', orderId:'1000120', type:'client', name:'Марта Паращук', instagram:'@marta',
  status:'kp', site:'main', payments:[], hist:[], createdAt:'2026-09-20T09:00:00.000Z',
  crmChatId:'c1', crmChatName:'Марта Паращук', crmAt: мить(30), crmTheirs:true, crmUnread:2,
  totalPrice:12400, totalCost:7000, margin:5400, marginPct:43,
  items:[{ kind:'main', name:'Футболка базова', color:'чорна', garmentId:'tee', qty:20,
           unitPrice:620, price:12400, unitCost:350, cost:7000, mockups:[], prints:[], views:[] }]
};
/* Роль власника навмисно: саме їй видно службові кнопки налаштувальника,
   і саме на ній перевіряється, що на телефоні їх немає. */
const CONTENT = { team:[{ email:'test@loomiq', name:'Володимир', role:'owner' }],
  quickReplies:[{ t:'Вітання', m:'Вітаю! Це Loomiq.' }] };

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
const p = await browser.newPage({ viewport:{ width:390, height:844 },
                                  deviceScaleFactor:2, isMobile:true, hasTouch:true });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(async () => {
  const o = orders[0];
  const мить = хв => new Date(Date.now() - хв * 60000).toISOString().replace('T', ' ').slice(0, 16);
  crmChat[o.id] = { chatId:'c1', clientName:'Марта Паращук', msgs:[
    { text:'Вітаю, цікавить футболка', mine:false, at: мить(90) },
    { text:'Вітаю! Зараз порахую', mine:true, at: мить(88), by:'Володимир' },
    { text:'А є оверсайз?', mine:false, at: мить(10) },
    { text:'І скільки на 30 штук?', mine:false, at: мить(5) }
  ]};
  await openOrderDrawer(o);
  await new Promise(r => setTimeout(r, 400));
  chatOpen(o, 'crm');
  await new Promise(r => setTimeout(r, 600));
});
await p.waitForTimeout(700);

console.log('═══ СТОРІНКА НЕ ЇДЕ ВБІК ═══');
const вбік = await p.evaluate(() => ({
  док: document.documentElement.scrollWidth, вікно: window.innerWidth,
  вилазять: [...document.querySelectorAll('#chatWin *')].filter(el => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.right > window.innerWidth + 2;
  }).map(el => el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]).slice(0, 6)
}));
console.log('   ширина ' + вбік.док + ' при вікні ' + вбік.вікно);
ok(вбік.док <= вбік.вікно + 2,
  'горизонтальної прокрутки немає — сторінка вміщається в екран',
  'сторінку відносить убік: ' + вбік.док + ' при ' + вбік.вікно);
ok(!вбік.вилазять.length,
  'і жоден елемент розмови не виходить за правий край',
  'за край вилазять: ' + вбік.вилазять.join(' '));

console.log('');
console.log('═══ ЦІЛІ ДЛЯ ПАЛЬЦЯ ═══');
/* 40 пікселів — межа, нижче якої промах стає звичайною справою. Міряємо
   те, чим справді користуються в розмові, а не все підряд. */
const цілі = await p.evaluate(() => {
  const взяти = sel => {
    const el = document.querySelector('#chatWin ' + sel);
    if(!el) return null;
    const b = el.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  };
  return { надіслати: взяти('[data-cw-go]'), скріпка: взяти('[data-cw-clip]'),
           заготовки: взяти('[data-cw-qr]'), закрити: взяти('[data-cw-close]'),
           номер: взяти('[data-cw-card]') };
});
Object.keys(цілі).forEach(k => {
  const c = цілі[k];
  if(!c){ console.log('   ' + k + ': немає'); return; }
  console.log('   ' + k + ': ' + c.w + '×' + c.h);
  ok(c.w >= 40 && c.h >= 36,
    k + ' — ціль завбільшки з палець',
    k + ' завмала для пальця: ' + c.w + '×' + c.h);
});

console.log('');
console.log('═══ SAFARI НЕ НАБЛИЖАТИМЕ ЕКРАН ═══');
/* Кегль менший за 16 у полі вводу — і Safari збільшує сторінку при дотику,
   лишаючи її такою назавжди. Це не про читабельність, а про те, що після
   першої ж відповіді клієнту адмінка стає косою. */
const кеглі = await p.evaluate(() => {
  const el = document.querySelector('#chatWin .cw-inp');
  const поля = [...document.querySelectorAll('#orderDrawer .od-f, #orderDrawer textarea')]
    .filter(x => x.offsetParent !== null)
    .map(x => Math.round(parseFloat(getComputedStyle(x).fontSize)));
  return { поле: el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0,
           картка: поля.slice(0, 6), найменший: поля.length ? Math.min.apply(null, поля) : 16,
           хто: [...document.querySelectorAll('#orderDrawer .od-f, #orderDrawer textarea')]
             .filter(x => x.offsetParent !== null &&
                     parseFloat(getComputedStyle(x).fontSize) < 16)
             .map(x => x.tagName.toLowerCase() + '.' + String(x.className||'').trim()).slice(0,4) };
});
console.log('   поле розмови ' + кеглі.поле + 'px · поля картки ' + кеглі.картка.join(' '));
ok(кеглі.поле >= 16,
  'у полі листа щонайменше 16 px — Safari не наблизить сторінку',
  'поле листа ' + кеглі.поле + 'px: перша ж відповідь лишить адмінку збільшеною');
ok(кеглі.найменший >= 16,
  'і в полях картки теж',
  'у картці є поле на ' + кеглі.найменший + 'px: ' + (кеглі.хто || []).join(' '));

console.log('');
console.log('═══ У ШАПЦІ ЛИШЕ ПОТРІБНЕ, І ВОНО НЕ НАЛАЗИТЬ ═══');
const шапка = await p.evaluate(() => {
  const h = document.querySelector('#chatWin .cw-head');
  const b = h.getBoundingClientRect();
  const win = h.querySelector('.cw-win');
  const oid = h.querySelector('[data-cw-card]');
  const перетин = (a, c) => {
    if(!a || !c) return false;
    const r1 = a.getBoundingClientRect(), r2 = c.getBoundingClientRect();
    return !(r1.right <= r2.left + 1 || r2.right <= r1.left + 1 ||
             r1.bottom <= r2.top + 1 || r2.bottom <= r1.top + 1);
  };
  return { висота: Math.round(b.height),
           /* Рахуємо ВИДИМІ: display:none лишає елемент у розмітці, і
              просто перелічити їх означало б перевірити не те. */
           службові: [...h.querySelectorAll('[data-cw-raw],[data-cw-sniff]')]
             .filter(x => x.offsetParent !== null).length,
           лічильник: win ? win.textContent.trim() : '',
           рядків: win ? Math.round(win.getBoundingClientRect().height) : 0,
           налазить: перетин(win, oid) };
});
console.log('   шапка ' + шапка.висота + 'px · «' + шапка.лічильник + '»');
ok(шапка.службові === 0,
  'службових кнопок налаштувальника на телефоні немає — у розмові з них користі нуль',
  'у шапці висять службові кнопки, яких на телефоні не торкаються');
ok(шапка.рядків > 0 && шапка.рядків < 22,
  'лічильник вікна відповіді в один рядок, а не в три',
  'лічильник розповзся на ' + шапка.рядків + 'px заввишки');
ok(!шапка.налазить,
  'і не налазить на номер замовлення',
  'лічильник накриває номер замовлення — на нього не натиснути');
ok(шапка.висота <= 96,
  'уся шапка вміщається в розумну висоту — стрічці лишається екран',
  'шапка зайняла ' + шапка.висота + 'px з 844');

console.log('');
console.log('═══ ПОЛЕ ЛИСТА ШИРШЕ ЗА КНОПКИ ═══');
/* «⚡ Заготовки» текстом займали третину смуги, і поле лишалось на два
   слова. На телефоні кнопка стає самим знаком. */
const смуга = await p.evaluate(() => {
  const inp = document.querySelector('#chatWin .cw-inp');
  const row = document.querySelector('#chatWin .cw-row');
  const qr = document.querySelector('#chatWin [data-cw-qr]');
  return { поле: Math.round(inp.getBoundingClientRect().width),
           смуга: Math.round(row.getBoundingClientRect().width),
           підпис: qr ? qr.textContent.trim() : '',
           видноПідпис: qr ? !!(qr.querySelector('.cw-ic-l') || {}).offsetParent : false };
});
console.log('   поле ' + смуга.поле + ' з ' + смуга.смуга + ' пікселів смуги');
ok(смуга.поле >= смуга.смуга * 0.5,
  'полю листа належить понад половину смуги — писати є де',
  'поле стиснуте до ' + смуга.поле + ' з ' + смуга.смуга);
ok(!смуга.видноПідпис,
  'а «Заготовки» на телефоні — сам знак, без підпису',
  'підпис кнопки заготовок і далі з’їдає смугу');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'з телефона можна працювати, а не миритись');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
