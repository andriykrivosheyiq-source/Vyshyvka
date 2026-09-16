/* Перенести колір разом із фото в інший товар.

   ЩО БУЛО НЕ ТАК. Знімок легко покласти не в той виріб: вантажать по черзі,
   вибір товару стоїть угорі й сам не міняється. У каталозі це спливає так,
   що під «Худі базове» стоять широкі моделі без шнурків — фото овера.

   Виправляти це перезавантаженням файлів довго й знову навпомацки: треба
   знайти оригінали, відкрити потрібний товар, не переплутати колір. Тому
   переносимо сам КОЛІР разом із його знімками — однією дією.

   Опис, розмірна сітка, ціни й область нанесення при цьому не їдуть: вони
   належать виробу, а не кольору. Саме цього й просили.

   Перевіряємо:
     — біля кожного кольору є кнопка переносу, і вона відкриває вибір товару;
     — знімки зʼявляються в новому товарі й зникають зі старого — інакше той
       самий файл лишився б у обох, і в каталозі було б видно дубль;
     — колір переїжджає в список кольорів нового товару й іде зі старого;
     — списки кольорів записуються ПОВНІСТЮ: доки в товару не було власного
       списку, він жив на стандартному з коду, і дописати в нього один колір
       неможливо;
     — опис, сітка й ціни лишаються на місці;
     — фото з репозиторію теж переносяться — посиланням, без копіювання файлу.

   Запуск:  node tests/color-move.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8857;
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

/* Саме та помилка, про яку йдеться: у «Худі базове» під кольором «Ванільний»
   лежить завантажене фото, і воно не від цього виробу. */
const WRONG = 'https://res.cloudinary.com/demo/image/upload/over-vanilla-front.webp';
const CONTENT = {
  team: [],
  map: { 'hoodie-vanilla-front': WRONG },
  names: {},
  descriptions: { hoodie: 'Опис базового худі' },
  products: { hidden: [], custom: [] },
  productColors: {},
  sides: {}, viewOrder: {}
};

function stub(){
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={',
    'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n' +
    '  window.__SET=[];\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  /* Без назви колекції документ не відрізнити від будь-якого іншого — і
     вміст просто не доїжджає до сторінки. */
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
  /* set() запамʼятовуємо: перевіряти треба саме те, що полетіло в базу. */
  s = s.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
    'Doc.prototype.set=function(d, o){ window.__SET.push(JSON.parse(JSON.stringify(d,\n' +
    '    function(k,v){ return (v && v.__delete) ? "__DELETE__" : v; }))); return Promise.resolve(); };');
  s = s.replace(
    "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    "Doc.prototype.onSnapshot=function(cb){ var d=null;\n" +
    "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
    "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  /* FieldValue.delete() у заглушці повертає null і в записі стає невидимим —
     а перевіряти треба саме те, що старий знімок прибрано. Робимо позначку
     впізнаваною. */
  s = s.replace('delete:function(){ return null; }',
                'delete:function(){ return { __delete:true }; }');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
p.on('dialog', d => d.accept());
const body = stub();
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);

/* Відкриваємо товар так само, як менеджер: Конструктор → Товари → картка. */
await p.evaluate(() => { openProduct('hoodie'); });
await p.waitForTimeout(700);

console.log('═══ КНОПКА ПЕРЕНОСУ Є Й ВІДКРИВАЄ ВИБІР ═══');
const opened = await p.evaluate(async () => {
  const b = document.querySelector('[data-pcolmove="vanilla"]');
  if(!b) return { none:true };
  b.click();
  await new Promise(r => setTimeout(r, 300));
  const box = document.getElementById('pcol-move');
  const sel = document.getElementById('pcol-move-to');
  return {
    box: !!box,
    text: box ? box.textContent.replace(/\s+/g, ' ').trim() : '',
    targets: sel ? [...sel.options].map(o => o.value) : []
  };
});
if(opened.none){ console.log('  кнопки немає'); bad++; }
else {
  console.log('  ' + opened.text.slice(0, 130));
  ok(opened.box && opened.targets.length > 3,
    'панель відкрилась і пропонує, куди саме переносити',
    'панелі переносу немає: ' + JSON.stringify(opened));
  ok(opened.targets.indexOf('hoodie') < 0,
    'сам виріб у списку не пропонується — переносити в себе немає сенсу',
    'у списку є той самий виріб');
  ok(/Опис, розмірна сітка, ціни/.test(opened.text),
    'сказано прямо, що опис і ціни не їдуть — саме це й питають першим',
    'не сказано, що саме переноситься: ' + opened.text.slice(0, 90));
}

console.log('');
console.log('═══ ПЕРЕНОСИМО ═══');
const moved = await p.evaluate(async () => {
  document.getElementById('pcol-move-to').value = 'hoodieover';
  document.getElementById('pcol-move-go').click();
  await new Promise(r => setTimeout(r, 900));
  const sent = window.__SET[window.__SET.length - 1] || {};
  return {
    sent,
    fromCols: (contentData.productColors.hoodie || []).map(c => c.id),
    toCols: (contentData.productColors.hoodieover || []).map(c => c.id),
    panel: !!document.getElementById('pcol-move')
  };
});
console.log('  у базу пішло: ' + JSON.stringify(moved.sent.map || {}).slice(0, 200));
const m = moved.sent.map || {};
ok(m['hoodieover-vanilla-front'] && /over-vanilla-front/.test(m['hoodieover-vanilla-front']),
  'знімок опинився в новому товарі — з тим самим посиланням',
  'знімок не переїхав: ' + JSON.stringify(m).slice(0, 160));
ok(m['hoodie-vanilla-front'] === '__DELETE__',
  'і зник зі старого — інакше той самий файл лишився б у обох виробах',
  'старий знімок не прибрано: ' + JSON.stringify(m['hoodie-vanilla-front']));
ok(m['hoodieover-vanilla-back'] === 'images/hoodie-vanilla-back.webp',
  'фото з репозиторію теж переноситься — посиланням, без копіювання файлу',
  'ракурс із репозиторію не переїхав: ' + JSON.stringify(m['hoodieover-vanilla-back']));

console.log('  кольори: худі базове → ' + moved.fromCols.length +
            ', овер → ' + moved.toCols.length);
ok(moved.fromCols.indexOf('vanilla') < 0,
  'зі старого товару колір пішов',
  'колір лишився у старому товарі');
ok(moved.toCols.indexOf('vanilla') >= 0,
  'а в новому зʼявився',
  'у новому товарі кольору немає');
ok(moved.fromCols.length > 3 && moved.toCols.length > 3,
  'списки кольорів записані повністю, а не одним перенесеним кольором',
  'список кольорів утратив решту: ' + JSON.stringify(moved));
ok(!moved.panel, 'панель закрилась — справу зроблено', 'панель лишилась відкритою');

console.log('');
console.log('═══ РЕШТА ТОВАРУ НЕ ЗАЧЕПЛЕНА ═══');
const rest = await p.evaluate(() => {
  const keys = Object.keys(window.__SET[window.__SET.length - 1] || {});
  return { keys, descr: (contentData.descriptions || {}).hoodie || '' };
});
console.log('  записано полів: ' + rest.keys.join(', '));
ok(rest.keys.length === 2 && rest.keys.indexOf('map') >= 0 &&
   rest.keys.indexOf('productColors') >= 0,
  'у базу пішли рівно знімки й кольори — більше нічого',
  'запис зачепив зайве: ' + rest.keys.join(', '));
ok(rest.descr === 'Опис базового худі',
  'опис товару лишився на місці',
  'опис поїхав разом із кольором: «' + rest.descr + '»');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'колір і його фото переносяться в інший товар однією дією');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
