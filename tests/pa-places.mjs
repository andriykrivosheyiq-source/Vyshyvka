/* Місця логотипа з номерами в «Областях нанесення» (06.10).

   Андрій: «ставимо одиничку — логотип спереду; двійку — спереду й ззаду;
   нумерація місця там, де зона нанесення». Перевіряємо:
     — у вікні зони є «+ №1 / + №2…», рамка зʼявляється на фото з номером;
     — номер у рамки міняється, рамка тягнеться й прибирається;
     — розмір рамки — у сантиметрах (за висотою виробу);
     — №2 на спині — та сама «двійка», що й спереду;
     — збережене лягає в printAreas.<товар>.<сторона>.places, а зона й
       калібрування — як були.

   Запуск:  node tests/pa-places.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8984;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }],
  printAreas: { tee: { heightCm: 72, scaleSize: 'M',
    front: { base: { calibTop: 0.05, calibBottom: 0.95, calibCx: 0.5, symmetric: true, pts: [{x:0,y:0.2},{x:0.15,y:0.2},{x:0.15,y:0.6},{x:0,y:0.6}] }, colors: {} } } } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
/* Документи знають, хто вони: так видно, що саме записали у Фінанси й у
   постійні витрати, і що саме стерли. */
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
  "Doc.prototype.set=function(v){ (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)) }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.delete=function(){ return Promise.resolve(); };",
  "Doc.prototype.delete=function(){ (window.__DELS=window.__DELS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var s=(window.__SETS||[]).filter(function(x){ return x.col===this.__col && x.id===this.__id; }, this).pop();" +
  " return Promise.resolve(new Snap(this.__id||'x', s ? s.v : null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace("return Promise.resolve({ id:'stub' });",
  "return Promise.resolve({ id:'pay' + (window.__ADDED.length) });");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
/* prompt «скільки виплачено» — приймаємо запропоноване число; confirm — так. */
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });





/* Вікно живе в розділі «Товари»; для перевірки виносимо його на сторінку. */
await p.evaluate(() => { document.body.appendChild(document.getElementById('pa-modal')); window.__paOpen('tee'); });
await p.waitForTimeout(600);
console.log('═══ МІСЦЯ ЛОГОТИПА ═══');
const st = () => p.evaluate(() => ({
  list: [...document.querySelectorAll('#pa-places .pa-pl')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
  add: [...document.querySelectorAll('#pa-pl-add button')].map(b => b.textContent.trim()),
  rects: document.querySelectorAll('#pa-svg [data-pl]').length,
  labels: [...document.querySelectorAll('#pa-svg text')].map(t => t.textContent) }));
let s0 = await st();
ok(s0.rects === 0 && s0.add[0] === '+ №1', 'на початку місць немає, є «+ №1…»', 'старт: ' + JSON.stringify(s0));
await p.click('#pa-pl-add [data-pla="1"]'); await p.waitForTimeout(100);
await p.click('#pa-pl-add [data-pla="2"]'); await p.waitForTimeout(100);
let s1 = await st();
console.log('   ' + JSON.stringify(s1));
ok(s1.rects === 2 && s1.labels.join() === '1,2' && /9\.0 × 9\.0 см/.test(s1.list[0]), 'дві рамки на фото з номерами 1 і 2, ~9 × 9 см', 'рамки: ' + JSON.stringify(s1));
/* Тягнемо рамку №1 праворуч (на серце) і збільшуємо куточком. */
const box = await p.evaluate(() => { const r = document.querySelector('#pa-svg [data-pl="0"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 40, box.y, { steps: 4 }); await p.mouse.up();
const hd = await p.evaluate(() => { const r = document.querySelector('#pa-svg [data-plr="0"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await p.mouse.move(hd.x, hd.y); await p.mouse.down(); await p.mouse.move(hd.x + 10, hd.y + 10, { steps: 4 }); await p.mouse.up();
await p.waitForTimeout(100);
let s2 = await st();
if(process.env.LQ_SHOT) await p.screenshot({ path: process.env.LQ_SHOT + '/pa-places.png' });
ok(!/9\.0 × 9\.0/.test(s2.list[0]), 'рамку посунули й збільшили: ' + s2.list[0], 'не тягнеться: ' + s2.list[0]);
/* Номер другої рамки → №3, потім назад №2; спина — ще одна «двійка». */
await p.selectOption('#pa-places [data-pln="1"]', '3'); await p.waitForTimeout(80);
ok((await st()).labels.join() === '1,3', 'номер рамки міняється (2 → 3)', 'номер не змінився');
await p.selectOption('#pa-places [data-pln="1"]', '2'); await p.waitForTimeout(80);
await p.click('#pa-slots [data-side="back"]'); await p.waitForTimeout(300);
let s3 = await st();
ok(s3.rects === 0 && s3.add.some(t => /№1 ✓/.test(t)) && s3.add.some(t => /№2 ✓/.test(t)), 'на спині свої рамки; «✓» підказує, які номери вже є на виробі', 'спина: ' + JSON.stringify(s3));
await p.click('#pa-pl-add [data-pla="2"]'); await p.waitForTimeout(100);
ok(/25\.0 × 25\.0 см/.test((await st()).list[0]), 'на спині нова рамка більша — ~25 см', 'спина: ' + JSON.stringify(await st()));
await p.click('#pa-save'); await p.waitForTimeout(300);
const saved = await p.evaluate(() => (window.__SETS || []).filter(x => x.col === 'loomiq' && x.id === 'photos' && x.v.printAreas).pop());
const tee = saved && saved.v.printAreas.tee;
console.log('   ' + JSON.stringify(tee && { front: tee.front.places, back: tee.back.places }));
ok(tee && tee.front.places.length === 2 && tee.front.places[0].n === 1 && tee.front.places[0].x > 0.02 && tee.front.places[0].w > 0.125 &&
   tee.front.places[1].n === 2 && tee.back.places.length === 1 && tee.back.places[0].n === 2,
  'збережено: спереду №1 (зсунута праворуч, збільшена) і №2, на спині №2', 'збережено: ' + JSON.stringify(tee));
ok(tee && tee.front.base.pts.length === 4 && tee.front.base.calibTop === 0.05 && tee.heightCm === 72, 'зона й калібрування — як були', 'зона змінилась');
await p.click('#pa-slots [data-side="front"]'); await p.waitForTimeout(200);
await p.click('#pa-places [data-pld="1"]'); await p.waitForTimeout(80);
ok((await st()).rects === 1, 'рамку прибирає ✕', 'не прибралась');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'місця логотипа з номерами — у вікні зони нанесення');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
