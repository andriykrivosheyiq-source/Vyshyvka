/* Картка для Direct не має різати виріб.

   ЩО БУЛО НЕ ТАК. На картці светр стояв обрізаним знизу: видно горловину й
   рукави, а низу немає. Причина не в масштабі — його якраз підбирають так,
   щоб виріб уліз у плитку цілком, — а в тому, ЯК кадр ставили.

   Стояло правило «верх кадру недоторканний»: якщо кадр вищий за плитку,
   притискаємо його до верху, зайве лишаємо знизу. Для фото МОДЕЛІ воно
   правильне — обрізана голова псує картку, обрізані ноги ніхто не помічає.
   Але на пласкому мокапі кадр вищий за плитку майже завжди, тож правило
   щоразу скасовувало центрування по виробу. Куди поїде сам виріб, після
   цього вирішували поля мокапа, а вони несиметричні: зверху більше, ніж
   знизу. Виріб з'їжджав донизу — і плитка відрізала йому низ.

   ЯК МАЄ БУТИ. Виріб стоїть по центру плитки й лишається в її межах
   цілком. Повзунок «Рівень кадру» рухає його у вільному місці, але за край
   не виводить ніколи.

   ЯК ПЕРЕВІРЯЄМО. Мокап — прозорий кадр із кольоровим прямокутником замість
   виробу, і поля навмисно криві: зверху великі, знизу майже немає. Малюємо
   картку, знаходимо цей колір на полотні й міряємо його. Якщо виріб різало,
   у знайденого прямокутника не збігаються пропорції: ширина ціла, висота
   менша.

   Запуск:  node tests/card-crop.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8882;
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

/* Кадр 600×900. «Виріб» — прямокутник 400×380 унизу: зверху 500 порожнього,
   знизу 20. Саме такі поля й бувають у мокапів, і саме на них ламалось. */
const G = { x:100, y:500, w:400, h:380 };
/* Другий кадр — широкий і низький: по ширині він упреться в плитку, а по
   висоті лишиться вільне місце. Саме в ньому й має працювати повзунок. */
const W = { x:20, y:560, w:560, h:200 };
const shot = (r, g, b, box) => {
  const B = box || G;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">' +
    '<rect x="' + B.x + '" y="' + B.y + '" width="' + B.w + '" height="' + B.h +
    '" fill="rgb(' + r + ',' + g + ',' + b + ')"/></svg>');
};

const C = [[220, 30, 30], [30, 30, 220]];
const V = (sd, u) => ({ id:sd, side:sd, label:sd, img:u, show:true });
const item = {
  kind:'main', name:'Світшот', color:'Рожевий', print:'Вишивка', sizes:'M × 5', qty:5,
  unitPrice:1310, price:6550, mockups:[],
  views:[V('front', shot.apply(null, C[0])), V('back', shot.apply(null, C[1]))],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[], about:'',
  prints:[{ side:'front', sideLabel:'Спереду', technique:'Вишивка', widthMm:80, heightMm:45 }]
};
const OFFER = { token:'tokcrop', orderId:'1000071',
  client:{ name:'Андрій', company:'Le Sem' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'', items:[item] };

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1320, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
const VH = path.join(ROOT, '_crop_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:1280px;height:900px}</style>
 <iframe id="f" src="offer-edit.html"></iframe>`);
await p.goto(HOST + '/_crop_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4200);
const fr = p.frames()[1];

/* Міряємо кожен колір на полотні: де він починається й де закінчується. */
const міра = async (tpl, picY, offer) => fr.evaluate(async a => {
  const [off, C, tpl, picY] = a;
  const card = window.LQCards.build(off, {})[0];
  /* «Рівень кадру» — налаштування КОЖНОЇ картки, тож і кладемо його туди,
     куди його кладе сама панель: у налаштування за номером картки. */
  const cfg = Object.assign({ tpl },
    picY == null ? {} : { by: { [card.id]: { picY } } });
  const cv = await window.LQCards.draw(card, off, cfg);
  const x = cv.getContext('2d');
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  const near = (i, c) => Math.abs(d[i] - c[0]) < 26 && Math.abs(d[i+1] - c[1]) < 26 &&
                         Math.abs(d[i+2] - c[2]) < 26;
  const box = C.map(()=> ({ x0:1e9, x1:-1, y0:1e9, y1:-1 }));
  for(let py = 0; py < cv.height; py += 2){
    for(let px = 0; px < cv.width; px += 2){
      const i = (py * cv.width + px) * 4;
      for(let k = 0; k < C.length; k++){
        if(!near(i, C[k])) continue;
        const b = box[k];
        if(px < b.x0) b.x0 = px; if(px > b.x1) b.x1 = px;
        if(py < b.y0) b.y0 = py; if(py > b.y1) b.y1 = py;
      }
    }
  }
  return box.map(b => b.x1 < 0 ? null
    : { w: b.x1 - b.x0, h: b.y1 - b.y0, y0: b.y0, y1: b.y1, x0: b.x0 });
}, [offer || OFFER, C, tpl, picY]);

const ЧАСТКА = G.h / G.w;      // 0.95 — саме стільки має лишитись від виробу

console.log('═══ ВИРІБ НА КАРТЦІ ЦІЛИЙ ═══');
const m = await міра('minimal');
m.forEach((b, i) => console.log('  бік ' + (i + 1) + ': ' +
  (b ? b.w + '×' + b.h + ' (частка ' + (b.h / b.w).toFixed(2) + ', очікуємо ' +
       ЧАСТКА.toFixed(2) + ')' : 'не знайшли')));
ok(m[0] && m[1], 'обидва боки намальовані', 'на картці немає боків: ' + JSON.stringify(m));
m.forEach((b, i) => ok(b && Math.abs(b.h / b.w - ЧАСТКА) < 0.04,
  'бік ' + (i + 1) + ': виріб цілий — пропорції ті самі, що у файлі',
  'бік ' + (i + 1) + ': виріб обрізано — ' + (b ? (b.h / b.w).toFixed(2) : '—') +
    ' замість ' + ЧАСТКА.toFixed(2)));
ok(m[0] && m[1] && Math.abs(m[0].h - m[1].h) <= 3 && Math.abs(m[0].w - m[1].w) <= 3,
  'і обидва боки одного розміру — масштаб у ряді спільний',
  'боки різного розміру: ' + JSON.stringify(m.map(b => b && (b.w + '×' + b.h))));

console.log('');
console.log('═══ «РІВЕНЬ КАДРУ» РУХАЄ, АЛЕ НЕ РІЖЕ ═══');
/* Широкий виріб лишає вільне місце по висоті — тільки в ньому повзунку і є
   що рухати. У вузького запасу немає, і це не поломка: рухати нікуди. */
const ШИР = W.h / W.w;
const wide = JSON.parse(JSON.stringify(OFFER));
wide.items[0].views = [V('front', shot(C[0][0], C[0][1], C[0][2], W)),
                       V('back',  shot(C[1][0], C[1][1], C[1][2], W))];
const низ = await міра('minimal', 100, wide);
const верх = await міра('minimal', 0, wide);
console.log('  верх: y0=' + (верх[0] && верх[0].y0) + ' · низ: y0=' + (низ[0] && низ[0].y0));
ok(низ[0] && верх[0] && низ[0].y0 > верх[0].y0,
  'повзунок справді опускає кадр — інакше він нічого не робить',
  'повзунок не рухає кадр: ' + JSON.stringify([верх[0], низ[0]]));
[['верх', верх], ['низ', низ]].forEach(([n, mm]) =>
  ok(mm[0] && Math.abs(mm[0].h / mm[0].w - ШИР) < 0.04,
    n + ' кадру: виріб і там лишається цілим',
    n + ' кадру: виріб обрізало — ' + (mm[0] ? (mm[0].h / mm[0].w).toFixed(2) : '—')));

console.log('');
console.log('═══ ТЕ САМЕ В ІНШИХ ШАБЛОНАХ ═══');
for(const tpl of ['editorial', 'table']){
  const t = await міра(tpl);
  const b = t[0];
  console.log('  ' + tpl + ': ' + (b ? b.w + '×' + b.h + ' · частка ' + (b.h / b.w).toFixed(2) : '—'));
  ok(b && Math.abs(b.h / b.w - ЧАСТКА) < 0.04,
    tpl + ': виріб цілий',
    tpl + ': виріб обрізано — ' + (b ? (b.h / b.w).toFixed(2) : 'не знайшли'));
}

/* ── ФОН МОКАПА НЕ БІЛИЙ ────────────────────────────────────────────────
   Головна причина всієї історії. Межі виробу шукались так: фон — це прозоре
   або «майже біле». А мокапи знімають на світло-сірому, беручому, теплому
   папері, і жоден такий фон під це не підпадав. Тоді меж виробу не було
   зовсім, за виріб бралася вся картинка з полями — і масштаб ряду
   підбирався під КАДР, а не під виріб. Виправлення розкладки цього не
   лікували: вони працювали з межами, яких не існувало. */
console.log('');
console.log('═══ ВИРІБ ЗНАХОДИТЬСЯ Й НА СІРОМУ ФОНІ ═══');
const сірий = (r, g, b, box) => {
  const B = box || G;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">' +
    '<rect width="600" height="900" fill="#EFEFEC"/>' +
    '<rect x="' + B.x + '" y="' + B.y + '" width="' + B.w + '" height="' + B.h +
    '" fill="rgb(' + r + ',' + g + ',' + b + ')"/></svg>');
};
const наСірому = JSON.parse(JSON.stringify(OFFER));
наСірому.items[0].views = [V('front', сірий(C[0][0], C[0][1], C[0][2])),
                           V('back',  сірий(C[1][0], C[1][1], C[1][2]))];
const g2 = await міра('minimal', null, наСірому);
g2.forEach((b, i) => console.log('  бік ' + (i + 1) + ': ' +
  (b ? b.w + '×' + b.h + ' · частка ' + (b.h / b.w).toFixed(2) : 'не знайшли')));
ok(g2[0] && g2[1],
  'обидва боки намальовані', 'на сірому фоні боків немає: ' + JSON.stringify(g2));
g2.forEach((b, i) => ok(b && Math.abs(b.h / b.w - ЧАСТКА) < 0.04,
  'бік ' + (i + 1) + ': виріб цілий і на сірому фоні',
  'бік ' + (i + 1) + ': обрізало — ' + (b ? (b.h / b.w).toFixed(2) : '—') +
    ' замість ' + ЧАСТКА.toFixed(2)));
/* І головне: виріб має ЗАПОВНИТИ плитку, а не бовтатись у ній крихіткою.
   Саме так виглядала поломка — «проблема з масштабом». Порівнюємо з тим,
   що дає прозорий фон: розмір має бути той самий. */
console.log('  на прозорому: ' + m[0].w + '×' + m[0].h +
            ' · на сірому: ' + g2[0].w + '×' + g2[0].h);
ok(Math.abs(g2[0].h - m[0].h) <= 4 && Math.abs(g2[0].w - m[0].w) <= 4,
  'і того самого розміру, що на прозорому — фон не міняє масштабу виробу',
  'на сірому фоні виріб іншого розміру: ' + g2[0].w + '×' + g2[0].h +
    ' проти ' + m[0].w + '×' + m[0].h);

/* ── СІТКА: МАСШТАБ СПІЛЬНИЙ, ОТЖЕ Й ОБМЕЖЕННЯ СПІЛЬНЕ ─────────────────
   У сітці 2×2 масштаб один на всі чотири кадри, а рахувався він лише за
   двома першими. Виріб, який у третьому кадрі займає більшу частку свого
   кадру, у плитку не вміщався — і його різало. */
console.log('');
console.log('═══ СІТКА 2×2: РІЖЕ НЕ ПЕРШІ ДВА, А ТРЕТІЙ ═══');
const ВЕЛ = { x:40, y:120, w:520, h:700 };   // виріб майже на весь кадр
const сітка = JSON.parse(JSON.stringify(OFFER));
сітка.items[0].views = [
  V('front', shot(C[0][0], C[0][1], C[0][2])),
  V('back',  shot(C[1][0], C[1][1], C[1][2])),
  V('left',  shot(20, 160, 20, ВЕЛ)),
  V('right', shot(160, 20, 160, ВЕЛ))];
сітка.items[0].prints = ['front','back','left','right'].map(sd =>
  ({ side:sd, sideLabel:sd, technique:'Вишивка', widthMm:80, heightMm:45 }));
const g4 = await fr.evaluate(async a => {
  const [off, C2] = a;
  const cv = await window.LQCards.draw(window.LQCards.build(off, {})[0], off,
    { tpl:'minimal', lay:'grid' });
  const x = cv.getContext('2d');
  const d = x.getImageData(0, 0, cv.width, cv.height).data;
  const near = (i, c) => Math.abs(d[i] - c[0]) < 26 && Math.abs(d[i+1] - c[1]) < 26 &&
                         Math.abs(d[i+2] - c[2]) < 26;
  const box = C2.map(()=> ({ x0:1e9, x1:-1, y0:1e9, y1:-1 }));
  for(let py = 0; py < cv.height; py += 2)
    for(let px = 0; px < cv.width; px += 2){
      const i = (py * cv.width + px) * 4;
      for(let k = 0; k < C2.length; k++){
        if(!near(i, C2[k])) continue;
        const b = box[k];
        if(px < b.x0) b.x0 = px; if(px > b.x1) b.x1 = px;
        if(py < b.y0) b.y0 = py; if(py > b.y1) b.y1 = py;
      }
    }
  return box.map(b => b.x1 < 0 ? null : { w:b.x1 - b.x0, h:b.y1 - b.y0 });
}, [сітка, [[20,160,20], [160,20,160]]]);
const ЧАСТКА4 = ВЕЛ.h / ВЕЛ.w;
g4.forEach((b, i) => console.log('  кадр ' + (i + 3) + ': ' +
  (b ? b.w + '×' + b.h + ' · частка ' + (b.h / b.w).toFixed(2) +
       ' (очікуємо ' + ЧАСТКА4.toFixed(2) + ')' : 'не знайшли')));
g4.forEach((b, i) => ok(b && Math.abs(b.h / b.w - ЧАСТКА4) < 0.05,
  'кадр ' + (i + 3) + ' у сітці: виріб цілий',
  'кадр ' + (i + 3) + ': обрізано — ' + (b ? (b.h / b.w).toFixed(2) : 'не знайшли')));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'клієнт бачить виріб цілим, а не по горловину');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
