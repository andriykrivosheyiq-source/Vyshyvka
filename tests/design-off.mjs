/* Третій вид дизайну: «не рахувати».

   У прорахунку кожен дизайн має вид: картинка або напис. Від нього залежать
   разові — підготовка макета й додатковий ескіз. Але дизайн буває такий, за
   який брати нема за що: клієнт приніс готовий файл саме під цей виріб, або
   те саме нанесення вже підготували в попередньому замовленні.

   Вибору не було. Менеджер писав про це в коментарі, а рахунок усе одно
   приходив зі зайвим макетом — або доводилось правити ставки способу
   нанесення, а вони спільні на весь сайт.

   Перевіряємо:
     — «не рахувати» знімає разову підготовку й ескіз саме цього дизайну;
     — собівартість цього дизайну теж нуль: роботи не було;
     — САМЕ НАНЕСЕННЯ рахується як звичайно — тканину прошити все одно
       треба, і за площу ми беремо;
     — сусідній дизайн у тій самій позиції платить своє, як і раніше;
     — вимкнений дизайн лишається в прорахунку окремим рядком — інакше
       повернути його в оплату не було б звідки.

   Запуск:  node tests/design-off.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8825;
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
const errs = [];

const PRICING = {
  methods: { embro: { orderFee:900, orderCost:400, sketchFee:300, sketchCost:150,
                      ratePerMm2:0, tiers:[{from:1,coef:1}] } },
  tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}]
};
const A = Array.from({length:144},(_,i)=>(i*1)%5).join('');
const B = Array.from({length:144},(_,i)=>(i*3)%7).join('');

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_off_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><iframe id="f" src="offer.html" style="width:900px;height:1200px;border:0"></iframe>`);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:920, height:900 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_off_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
const fr = p.frames()[1];

console.log('═══ «НЕ РАХУВАТИ» ЗНІМАЄ РАЗОВІ, А НЕ НАНЕСЕННЯ ═══');
const r = await fr.evaluate(([pricing, A, B]) => {
  window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = pricing;
  /* Позиція з двома дизайнами: перший платить разову підготовку, другий —
     додатковий ескіз. Далі другий вимикаємо. */
  const item = kinds => ({ method:'embro', units:10, base:300, coefPart:200, pieceFee:0,
    gid:'tee', designs:[A, B], designKinds:kinds, bare:false });
  const pick = res => ({
    unit: res[0].unit, fee: res[0].feeShare,
    cost: Math.round((res[0].parts && +res[0].parts.costShare) || 0),
    app: (res[0].parts || {}).app,
    garment: (res[0].parts || {}).garment,
    off: (res[0].parts || {}).offDesigns,
    nos: ((res[0].parts || {}).designNos || []).map(d => d.kind)
  });
  return {
    both: pick(window.LQ.priceOrder([item(['img','img'])])),
    one:  pick(window.LQ.priceOrder([item(['img','off'])])),
    none: pick(window.LQ.priceOrder([item(['off','off'])]))
  };
}, [PRICING, A, B]);
console.log('  обидва платні: ' + JSON.stringify(r.both));
console.log('  другий вимкнено: ' + JSON.stringify(r.one));
console.log('  обидва вимкнено: ' + JSON.stringify(r.none));

ok(r.both.fee > r.one.fee && r.one.fee > 0,
  'вимкнення одного дизайну знімає саме його разові, а не всі',
  'разові не змінились як слід: ' + r.both.fee + ' → ' + r.one.fee);
ok(r.none.fee === 0 && r.none.cost === 0,
  'коли не рахуємо жоден дизайн — ні в ціні, ні в собівартості разових немає',
  'разові лишились: ' + JSON.stringify(r.none));
ok(r.none.app === r.both.app && r.none.garment === r.both.garment,
  'саме нанесення й виріб коштують стільки ж — тканину прошити все одно треба',
  'зрушилось нанесення: ' + r.none.app + ' проти ' + r.both.app);
ok(r.none.unit === r.both.unit - r.both.fee,
  'ціна впала рівно на частку разових',
  'ціна впала не на ту суму: ' + JSON.stringify([r.none.unit, r.both.unit, r.both.fee]));

console.log('');
console.log('═══ ВИМКНЕНИЙ ДИЗАЙН ЛИШАЄТЬСЯ НА ВИДНОТІ ═══');
console.log('  види в прорахунку: ' + JSON.stringify(r.one.nos));
ok(r.one.off === 1 && r.one.nos.indexOf('off') >= 0,
  'вимкнений дизайн лишається в списку — його видно й можна повернути',
  'дизайн зник із прорахунку: ' + JSON.stringify(r.one));

console.log('');
console.log('═══ ВИБІР У ПРОРАХУНКУ КП ═══');
const opts = await fr.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return { html: /value="off"[^>]*>Не рахувати/.test(src) ||
                 /Не рахувати<\/option>/.test(src) };
});
/* Список видів малюється в прорахунку менеджера — перевіряємо саме розмітку
   сторінки, бо блок з’являється лише коли адмінка надішле свій прорахунок. */
const src = fs.readFileSync(path.join(ROOT, 'offer.html'), 'utf8');
ok(/value="off"[\s\S]{0,80}Не рахувати/.test(src),
  'у списку видів дизайну є третій пункт «Не рахувати»',
  'третього пункту в списку немає');
const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
ok(/msg\.to === 'off'/.test(adm) && /kind === 'off'/.test(adm),
  'адмінка приймає цей вид і записує його в позицію',
  'адмінка не знає про вид «не рахувати»');

console.log('');
console.log('═══ ТАБЛЕТКУ ВИДНО ЦІЛКОМ ═══');
/* Таблетка виду стояла в рядку прорахунку поруч із довгою назвою — і рядок
   стискав її до однієї літери «К». Побачити, який вид обрано, було
   неможливо, а «Не рахувати» не вміщалось узагалі. */
const pill = await fr.evaluate(() => {
  const box = document.createElement('div');
  box.className = 'cc';
  box.style.width = '320px';                 // вузька колонка, як у картці
  box.innerHTML =
    '<div class="cc-row"><span>Підготовка макета · вишивка, картинка' +
      '<span class="cc-kind-wrap"><select class="cc-kind" data-native>' +
        '<option value="img" selected>Картинка</option>' +
        '<option value="txt">Напис</option>' +
        '<option value="off">Не рахувати</option>' +
      '</select></span></span><b>900 грн</b></div>';
  document.body.appendChild(box);
  const sel = box.querySelector('.cc-kind');
  const w = Math.round(sel.getBoundingClientRect().width);
  const dressed = !!sel.__lqBox;
  const opts = [...sel.options].map(o => o.textContent);
  box.remove();
  return { w, dressed, opts };
});
console.log('  ширина таблетки ' + pill.w + 'px · пункти: ' + pill.opts.join(', '));
ok(pill.w >= 100,
  'таблетка не стискається — видно, який вид обрано',
  'таблетку стиснуло до ' + pill.w + 'px — саме там і лишалась одна літера');
ok(!pill.dressed,
  'маленька таблетка не одягається спільним убранням, розрахованим на велике поле',
  'таблетку одягнули — вона знову стане 44 пікселі заввишки');
ok(pill.opts.length === 3 && /Не рахувати/.test(pill.opts[2]),
  'усі три пункти на місці, зокрема «Не рахувати»',
  'пунктів не три: ' + pill.opts.join(', '));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'дизайн, за який не беремо, більше не потрапляє в рахунок');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
