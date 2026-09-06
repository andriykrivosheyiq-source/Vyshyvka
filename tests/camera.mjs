/* Камера з рамкою.

   ПРОБЛЕМА. Виробництво знімало тест телефоном у галерею й пересилало
   месенджером. Кадр щоразу інший: то з кутка, то темний, то знятий учора.
   Потім клієнт каже «на фото було не так», і довести нічого — фото ні до
   чого не прив'язане, крім чиєїсь пам'яті.

   Тому знімок робиться в самій картці: рамка тримає кадр, живі підказки
   ловлять темряву й нахил ДО натиску, а після знімка стоять два питання, на
   які інакше ніхто не дивиться. Прив'язка до версії макета — не дія людини,
   а наслідок того, звідки відкрили камеру.

   Перевіряємо:
     — камера відкривається з тієї самої кнопки «Зняти тест»;
     — у кадрі є рамка й жива підказка;
     — темний кадр камера називає темним, а не мовчить;
     — «Готово» не натискається, поки не відповіли на обидва питання;
     — знімок лягає у ПОТОЧНУ версію макета, а не кудись;
     — камери немає — це вибір файлу, а не глухий кут.

   Запуск:  node tests/camera.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8827;
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

const TEAM = [{ email:'test@loomiq', name:'Ірина', role:'production' }];
const CONTENT = { team:TEAM };
const O = {
  id:'1', orderId:'1000801', type:'client', name:'Оксана', phone:'+380670000801',
  status:'paid', site:'main', createdAt:new Date().toISOString(), hist:[], dueAt:'2026-12-01',
  tracks:{ design:'ok', supply:'got', test:'work', prod:'lock', qc:'wait', ship:'wait' },
  art:[{ n:2, at:new Date().toISOString(), by:'des@loomiq', files:[], wilcom:'', photo:'',
         approvals:{ art:{ by:'owner@loomiq', at:new Date().toISOString(), note:'' } } }],
  payments:[{ at:new Date().toISOString(), sum:5000, kind:'prepay', by:'owner@loomiq' }],
  totalPrice:25000, totalCost:15000, margin:10000, marginPct:40,
  items:[{ kind:'main', name:'Футболка BASIC', color:'чорна', garmentId:'tshirt', qty:50,
           unitPrice:500, price:25000, unitCost:300, cost:15000, sizeQty:{ S:10, M:20, L:20 },
           prints:[{ side:'front', sideLabel:'Перед', technique:'вишивка',
                     widthMm:80, heightMm:45 }] }]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([O]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace(
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

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-fake-ui-for-media-stream'] });
const p = await browser.newPage({ viewport:{ width:1200, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

/* Підроблена камера. Справжню в тесті не візьмеш, тож віддаємо потік із
   полотна — і в ньому можна свідомо зробити темний кадр, щоб перевірити
   саме підказку, а не її наявність у коді. */
await p.addInitScript(() => {
  window.__CAM_LUM = 20;                      // темний кадр за замовчуванням
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 480;
  const ctx = cv.getContext('2d');
  setInterval(() => {
    const v = window.__CAM_LUM;
    ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    ctx.fillRect(0, 0, 640, 480);
  }, 100);
  const stream = cv.captureStream(12);
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = () => Promise.resolve(stream);
  /* Завантаження в Cloudinary в тесті не робимо — але й не мовчимо: підміна
     видима, і саме її адресу потім шукаємо у версії макета. */
  window.__UPLOADED = 0;
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(() => {
  window.uploadCloudinaryAuto = async b => { window.__UPLOADED = b.size || 1; return 'https://files.example/shot.jpg'; };
});

console.log('═══ КАМЕРА ВІДКРИВАЄТЬСЯ З КАРТКИ ═══');
await p.click('#board .ticket');
await p.waitForTimeout(900);
await p.click('[data-art-pick="photo"]');
await p.waitForTimeout(1600);
const open1 = await p.evaluate(() => {
  const d = document.getElementById('camWrap');
  return { on: !!d && d.classList.contains('open'),
           frame: !!d.querySelector('.cam-frame'),
           video: !!d.querySelector('video'),
           live: !!(d.querySelector('video') || {}).srcObject,
           hint: (d.querySelector('[data-cam-hint]') || {}).textContent || '',
           qs: d.querySelectorAll('[data-cam-q]').length,
           title: (d.querySelector('.ao-head b') || {}).textContent || '' };
});
console.log('  «' + open1.title + '» · підказка: «' + open1.hint.trim() + '»');
ok(open1.on && open1.frame && open1.video,
  'камера відкрилась, у кадрі рамка',
  'камери немає: ' + JSON.stringify(open1));
ok(open1.live, 'потік із камери справді підключений', 'відео без потоку');
ok(/темн/i.test(open1.hint),
  'темний кадр камера називає темним, а не мовчить',
  'підказка про світло не з’явилась: «' + open1.hint + '»');
ok(open1.qs === 2, 'два питання після знімка вже заведені', 'питань не два: ' + open1.qs);

console.log('');
console.log('═══ СВІТЛА СТАЛО ДОСИТЬ ═══');
await p.evaluate(() => { window.__CAM_LUM = 150; });
await p.waitForTimeout(1600);
const hint2 = await p.evaluate(() =>
  (document.querySelector('[data-cam-hint]') || {}).textContent || '');
console.log('  підказка: «' + hint2.trim() + '»');
ok(/годиться|знімайте/i.test(hint2),
  'коли кадр нормальний — камера так і каже',
  'підказка не змінилась: «' + hint2 + '»');
/* Ноутбук датчика нахилу не має, і браузер шле подію з порожніми числами.
   Прийняти їх за нуль — значить вічно просити «тримайте рівніше» там, де
   тримати нема чого. */
const flat = await p.evaluate(async () => {
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',
    { alpha:null, beta:null, gamma:null }));
  await new Promise(r => setTimeout(r, 900));
  return (document.querySelector('[data-cam-hint]') || {}).textContent || '';
});
ok(!/рівніше/i.test(flat),
  'без датчика нахилу камера не вигадує нахил',
  'порожні дані датчика прийняті за нахил: «' + flat + '»');
const tilted = await p.evaluate(async () => {
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',
    { alpha:0, beta:80, gamma:34 }));
  await new Promise(r => setTimeout(r, 900));
  return (document.querySelector('[data-cam-hint]') || {}).textContent || '';
});
ok(/рівніше/i.test(tilted),
  'а справжній нахил бачить',
  'нахил у 34° лишився непоміченим: «' + tilted + '»');
await p.evaluate(async () => {
  window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',
    { alpha:0, beta:80, gamma:2 }));
  await new Promise(r => setTimeout(r, 900));
});

console.log('');
console.log('═══ ДВА ПИТАННЯ ПЕРЕД «ГОТОВО» ═══');
await p.click('[data-cam-go]');
await p.waitForTimeout(900);
const shot = await p.evaluate(() => {
  const d = document.getElementById('camWrap');
  return { preview: !((d.querySelector('.cam-shot') || {}).hidden),
           qsOn: !(d.querySelector('.cam-qs') || {}).hidden,
           go: (d.querySelector('[data-cam-go]') || {}).textContent.trim(),
           blocked: !!(d.querySelector('[data-cam-go]') || {}).disabled,
           retake: (d.querySelector('[data-cam-file]') || {}).textContent.trim() };
});
console.log('  знімок показано · кнопка «' + shot.go + '» · заблокована: ' + shot.blocked);
ok(shot.preview && shot.qsOn,
  'після знімка видно кадр і два питання',
  'знімок не показався: ' + JSON.stringify(shot));
ok(shot.blocked && shot.go === 'Готово',
  '«Готово» не натискається, поки не відповіли',
  'кнопка активна без відповідей: ' + JSON.stringify(shot));
ok(shot.retake === 'Перезняти',
  'поруч — «Перезняти», а не «Із галереї»',
  'перезняти нічим: ' + shot.retake);

const half = await p.evaluate(() => {
  const cb = [...document.querySelectorAll('[data-cam-q]')];
  cb[0].checked = true; cb[0].dispatchEvent(new Event('change', { bubbles:true }));
  return !!document.querySelector('[data-cam-go]').disabled;
});
ok(half, 'однієї відповіді мало', 'кнопка відкрилась після однієї відповіді');

console.log('');
console.log('═══ ЗНІМОК ЛЯГАЄ В ПОТОЧНУ ВЕРСІЮ ═══');
await p.evaluate(() => {
  const cb = [...document.querySelectorAll('[data-cam-q]')];
  cb[1].checked = true; cb[1].dispatchEvent(new Event('change', { bubbles:true }));
});
await p.click('[data-cam-go]');
await p.waitForTimeout(1200);
const saved = await p.evaluate(() => {
  const o = orders.find(x => x.orderId === '1000801');
  const v = (o.art || [])[o.art.length - 1] || {};
  return { photo: v.photo || '', n: v.n,
           closed: !document.getElementById('camWrap').classList.contains('open'),
           uploaded: window.__UPLOADED };
});
console.log('  версія v' + saved.n + ' · фото ' + (saved.photo || '—') +
            ' · розмір знімка ' + saved.uploaded + ' б');
ok(saved.uploaded > 0, 'знімок справді знятий, а не порожній', 'знімка немає');
ok(saved.photo === 'https://files.example/shot.jpg' && saved.n === 2,
  'фото прив’язалось до поточної версії макета — без жодного вибору',
  'фото не потрапило у версію: ' + JSON.stringify(saved));
ok(saved.closed, 'камера закрилась сама', 'камера лишилась відкритою');

console.log('');
console.log('═══ КАМЕРИ НЕМАЄ — НЕ ГЛУХИЙ КУТ ═══');
const noCam = await p.evaluate(async () => {
  const real = navigator.mediaDevices.getUserMedia;
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('denied'));
  openCam('batch', async () => {});
  await new Promise(r => setTimeout(r, 500));
  const d = document.getElementById('camWrap');
  const out = { hint:(d.querySelector('[data-cam-hint]') || {}).textContent || '',
                go:(d.querySelector('[data-cam-go]') || {}).textContent.trim(),
                file: d.querySelectorAll('[data-cam-file]').length };
  closeCam();
  navigator.mediaDevices.getUserMedia = real;
  return out;
});
console.log('  «' + noCam.hint.trim() + '» · кнопка «' + noCam.go + '»');
ok(/файл/i.test(noCam.hint) && /файл/i.test(noCam.go) && noCam.file === 1,
  'відмовили в камері — лишається вибір файлу, і про це сказано',
  'без камери порожньо: ' + JSON.stringify(noCam));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'знімок робиться в системі й сам знає, до якої версії належить');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
