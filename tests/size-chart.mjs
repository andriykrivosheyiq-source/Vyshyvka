/* Розмірна сітка в пропозиції — з цифрами, а не порожня.

   У картці позиції є рядок «Розміри»; він розгортався — і під ним стояла
   таблиця без жодного числа. Причина: у базі сітка лежить рядками-обʼєктами
   ({size:'M', A:71, B:53}), а в пропозицію її збирали так, ніби це масив
   масивів. Кожен рядок перетворювався на порожній, шапка колонок ставала
   «[object Object]», і клієнт отримував порожню рамку замість відповіді на
   найчастіше своє питання.

   Перевіряємо:
     — адмінка збирає сітку з мірок ТОГО САМОГО товару: розмір, довжина,
       ширина, з підписами колонок;
     — товар без власної сітки не лишається без розмірного ряду — береться
       сітка виробника, та сама, що на сайті;
     — сторінка клієнта малює таблицю з числами й підказками «як міряти»;
     — у згорнутому рядку стоїть розмах розмірів, а не слово «Розмір»;
     — фото сітки, якщо його завантажили, заміняє таблицю.

   Запуск:  node tests/size-chart.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8820;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };
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

/* Своя сітка з правленими колонками — рівно так, як її зберігає вкладка
   «Розміри» в картці товару. */
const CONTENT = {
  sizecharts: { hoodie: [
    { size:'S', A:67, B:51 }, { size:'M', A:70, B:56 }, { size:'L', A:73.5, B:61 }
  ] },
  sizechartCols: { hoodie: [
    { key:'A', label:'Довжина', hint:'Від найвищої точки на плечі до низу' },
    { key:'B', label:'Ширина',  hint:'Від шва під рукавом до іншого' }
  ] },
  sizechartPhotos: { tote:'https://example.test/sc.png' }
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

console.log('═══ АДМІНКА ЗБИРАЄ СІТКУ З МІРОК ТОВАРУ ═══');
const ap = await browser.newPage({ viewport:{ width:1400, height:1000 } });
ap.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
await ap.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await ap.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await ap.waitForTimeout(5000);

const built = await ap.evaluate(() => ({
  own: itemSizeChart({ garmentId:'hoodie' }),
  none: itemSizeChart({ garmentId:'tee' }),
  photo: itemSizeChart({ garmentId:'tote' })
}));
console.log('  колонки: ' + JSON.stringify(built.own.cols));
console.log('  рядок M: ' + JSON.stringify(built.own.rows[1].c));
ok(built.own.cols.join(' | ') === 'Розмір | Довжина, см | Ширина, см',
  'шапка називає мірки словами менеджера, а не ключами A і B',
  'шапка не та: ' + JSON.stringify(built.own.cols));
ok(built.own.rows.length === 3 && built.own.rows[1].c.join() === 'M,70,56',
  'у рядку стоять розмір і його обміри, а не порожні клітинки',
  'рядки порожні: ' + JSON.stringify(built.own.rows));
ok(built.own.rows[2].c.join() === 'L,73,5,61',
  'дробові сантиметри пишемо через кому, як в Україні',
  'дробове число не те: ' + JSON.stringify(built.own.rows[2].c));
ok((built.own.hints || []).length === 2 && /плечі/.test(built.own.hints[0]),
  'разом із таблицею їде «як міряти» — тими самими словами, що в картці',
  'підказок немає: ' + JSON.stringify(built.own.hints));
console.log('  без своєї сітки: ' + (built.none ? built.none.rows.map(r => r.c[0]).join(' ') : 'нічого'));
ok(built.none && built.none.rows.length > 3,
  'товар без власної сітки бере сітку виробника — розмірний ряд є завжди',
  'товар лишився без сітки: ' + JSON.stringify(built.none));
ok(built.photo && built.photo.photo === 'https://example.test/sc.png',
  'завантажене фото сітки їде в пропозицію',
  'фото сітки не приїхало: ' + JSON.stringify(built.photo && built.photo.photo));
await ap.close();

console.log('');
console.log('═══ КЛІЄНТ БАЧИТЬ ТАБЛИЦЮ, А НЕ ПОРОЖНЮ РАМКУ ═══');
const VH = path.join(ROOT, '_sc_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);
const p = await browser.newPage({ viewport:{ width:920, height:1000 } });
p.on('pageerror', e => errs.push('КП: ' + e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_sc_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);

const item = chart => ({ kind:'main', vgroup:'', name:'Худі', color:'Чорний', print:'Вишивка',
  sizes:'M × 10', qty:10, unitPrice:1200, price:12000, basePrice:12000, baseUnitPrice:1200,
  mockups:[], prints:[], views:[], sides:[], techniques:['Вишивка'], tiers:[],
  specs:[], about:'', sizechart: chart });
const OFFER = {
  orderId:'1001500', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'',
  items:[ item(built.own) ]
};
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1500);
const fr = p.frames()[1];
const shown = await fr.evaluate(() => {
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  const t = document.querySelector('.pchart');
  return {
    head: t ? [...t.querySelectorAll('th')].map(x => x.textContent.trim()) : null,
    cells: t ? [...t.querySelectorAll('tbody td')].map(x => x.textContent.trim()) : null,
    hints: [...document.querySelectorAll('.pchart-hint li')].map(x => x.textContent.trim()),
    range: [...document.querySelectorAll('.sl-fold .sl-v')].map(x => x.textContent.trim()),
    note: (document.querySelector('.pnote') || {}).textContent || ''
  };
});
console.log('  шапка: ' + (shown.head || []).join(' | '));
console.log('  клітинки: ' + (shown.cells || []).join(' · '));
ok(shown.cells && shown.cells.indexOf('70') >= 0 && shown.cells.indexOf('56') >= 0,
  'у таблиці стоять справжні обміри',
  'таблиця порожня: ' + JSON.stringify(shown.cells));
ok((shown.head || []).join(' ').indexOf('object') < 0 &&
   (shown.head || []).join(' | ') === 'Розмір | Довжина, см | Ширина, см',
  'шапка читається словами',
  'шапка не та: ' + JSON.stringify(shown.head));
ok(shown.hints.length === 2,
  'під таблицею написано, як міряти',
  'підказок немає: ' + JSON.stringify(shown.hints));
console.log('  у згорнутому рядку: ' + shown.range.join(', '));
ok(shown.range.indexOf('S–L') >= 0,
  'не розгортаючи таблицю, видно розмах розмірів',
  'розмаху немає: ' + JSON.stringify(shown.range));
ok(/1–2 см/.test(shown.note) && /пропорц/i.test(shown.note),
  'примітка чесно каже про різницю пропорцій між розмірами',
  'примітка не та: ' + shown.note.slice(0, 160));

/* Фото сітки заміняє таблицю — так само, як на сайті. */
await p.evaluate(o => window.__prev(o),
  Object.assign({}, OFFER, { items:[ item(built.photo) ] }));
await p.waitForTimeout(1200);
const withPhoto = await fr.evaluate(() => {
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  return { img: !!document.querySelector('.pchart-img img'),
           table: !!document.querySelector('.pchart') };
});
ok(withPhoto.img && !withPhoto.table,
  'де є фото сітки, показуємо його, а не перемальовану таблицю',
  'фото не показано: ' + JSON.stringify(withPhoto));

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'розмірна сітка в КП відповідає на питання «а який це розмір»');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
