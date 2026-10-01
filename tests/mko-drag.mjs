/* ВІКНО ЗДАЧІ: ПЕРЕТЯГУВАННЯ, ДУБЛІ, МАСШТАБ — СПРАВЖНЬОЮ МИШЕЮ.

   Андрій: «я роблю дублі, потім я попадаю сквозь дизайн і потім воно
   взагалі не дає редагувати… переключаю на задню сторону, наперед, знову
   зʼявляється… потім промахуюся, знову не можу назад натиснути на
   зображення». І далі: «знову створив карточку, тільки додав логотип,
   зразу мені попав скрізь ногу і вона пропала».

   Що було насправді:
     · рамкою для положення була вся сіра сцена, а не фото. На
       вертикальному знімку футболки фото — половина сцени, тож логотип на
       екрані був удвічі більший, ніж ляже в мокап, і його можна було
       витягти за футболку в сіре поле або під нижній край — і він зникав;
     · вибір іншої роботи перебудовував усе вікно прямо під час натиску:
       сцена на мить міняла розмір, і наступний натиск ішов «крізь»;
     · відпустити мишу за вікном посеред тягання — закривало вікно;
     · на стороні без старої розмітки поверх робіт лягали лінії
       калібрування й перехоплювали натиски.

   Тому тут не «натиснули раз — посунулось», а все, що робить людина:
   дублі, промахи, кут, вихід за вікно, перемикання сторін, зміна розміру
   вікна, повільне фото, загублене відпускання кнопки — і довгий
   випадковий прогін. Після КОЖНОЇ дії перевіряємо одне й те саме:
     1. картинка на екрані стоїть рівно там, де її положення (те, що
        ляже в мокап), — до пікселя;
     2. вона ціла в межах фото;
     3. обрано рівно те, що під курсором (обрана — першою, далі верхня);
     4. тягання посунуло саме її і рівно на стільки, на скільки миша;
     5. після відпускання кнопки ніщо «не висить» на курсорі;
     6. вікно не закрилось само.
   І в кінці — що збережений мокап намальований там, де стояло на екрані.

   Запуск:  node tests/mko-drag.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8971;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };
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
/* Посунути будь-яку роботу, в якої є видима точка. */
async function посунутиБудь(dx, dy){
  const n = (await peek()).places[(await peek()).side].length;
  for(let i = 0; i < n; i++){ const r = await посунути(i, dx, dy); if(r !== 'skip') return r; }
  return 'жодної роботи не схопити';
}
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__CONTENT=' + JSON.stringify({ team: [{ email:'test@loomiq', name:'Оля', role:'designer' }] }) +
  ';\n  window.firebase={');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:800 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));

/* Фото виробів і логотипи малюємо в самому браузері — справжні PNG
   різних пропорцій, як у каталозі: вертикальний знімок, горизонтальний і
   маленький. «Повільне» фото віддаємо із затримкою: так буває з першим
   відкриттям знімка зі сховища. */
const ПОВІЛЬНІ = {};
await p.route('**://**', async r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  const m = u.match(/\/slow\/(\w+)\.png/);
  if(m && ПОВІЛЬНІ[m[1]]){
    await new Promise(res => setTimeout(res, 1500));
    return r.fulfill({ contentType:'image/png', body: ПОВІЛЬНІ[m[1]],
      headers:{ 'Access-Control-Allow-Origin':'*' } });
  }
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

const IMG = await p.evaluate(() => {
  const png = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h); return c.toDataURL('image/png'); };
  const виріб = (bg, fg) => (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.fillRect(w * 0.2, h * 0.08, w * 0.6, h * 0.86); };
  return {
    tall:  png(1000, 1400, виріб('#eeeeee', '#333333')),
    back:  png(1000, 1400, виріб('#e6e6e6', '#2a2a2a')),
    wide:  png(1600, 1000, виріб('#eeeeee', '#333333')),
    small: png(500, 600,   виріб('#eeeeee', '#333333')),
    /* Логотип — суцільна пляма свого кольору: так у мокапі видно, де він. */
    logo:  png(400, 200, (x, w, h) => { x.fillStyle = '#E4572E'; x.fillRect(0, 0, w, h); }),
    tallLogo: png(200, 420, (x, w, h) => { x.fillStyle = '#2E90FA'; x.fillRect(0, 0, w, h); })
  };
});
ПОВІЛЬНІ.tall = Buffer.from(IMG.tall.split(',')[1], 'base64');

/* ── Відкрити вікно здачі ── */
async function відкрити({ front = IMG.tall, back = IMG.back, works = [], places = [], upload = true } = {}){
  await p.evaluate(({ front, back, works, places, upload, logo }) => {
    window.LQMock.close();
    window.__DONE = null;
    window.LQMock.host.zone = () => ({ T:0.08, B:0.94, L:0.2, R:0.8, H:70 });
    window.LQMock.openWork({ gid:'tee', size:'M', name:'Футболка базова', color:'Чорний',
      sides:[{ key:'front', label:'Перед', url:front }, { key:'back', label:'Спина', url:back }],
      works, places, needThreads:true,
      /* Завантаження — вже адаптована під нитки робота, як після вікна «Під нитки». */
      onUpload: upload ? async () => ({ name:'лого-нитки.png', url: logo, hash:'h1',
        threads:[{ code:'1133', hex:'#E4572E' }] }) : null,
      onDone: res => { window.__DONE = res; } });
  }, { front, back, works, places, upload, logo: IMG.logo });
  await p.waitForTimeout(500);
}
const ВІДКРИТЕ = () => p.evaluate(() => !!document.querySelector('.mko-wrap [data-mko-frame]'));
const peek = () => p.evaluate(() => window.LQMock.peek());

/* Що на екрані: рамка-фото й кожна робота в пікселях. */
const екран = () => p.evaluate(() => {
  const fr = document.querySelector('[data-mko-frame]');
  if(!fr) return null;
  const r = fr.getBoundingClientRect();
  const st = document.querySelector('[data-mko-stage]').getBoundingClientRect();
  return { fr:{ l:r.left, t:r.top, w:r.width, h:r.height },
           st:{ l:st.left, t:st.top, w:st.width, h:st.height },
           arts:[...fr.querySelectorAll('[data-mko-p]')].map(n => { const b = n.getBoundingClientRect();
             return { i:+n.dataset.mkoP, on:n.classList.contains('on'), l:b.left, t:b.top, w:b.width, h:b.height }; }) };
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Та сама «межа кадру», що й у вікні: робота ціла в межах фото. */
function втиснути(b, ar, a){
  b = { ...b };
  b.w = clamp(b.w, 0.06, 1);
  if(a > 0){ if(b.w * ar / a > 1) b.w = a / ar; b.y = clamp(b.y, 0, 1 - b.w * ar / a); }
  b.x = clamp(b.x, b.w / 2, 1 - b.w / 2);
  return b;
}

/* ── ПЕРЕВІРКА ПІСЛЯ КОЖНОЇ ДІЇ ── */
const ПРОВАЛИ = [];
async function інваріанти(крок){
  const біда = m => { ПРОВАЛИ.push(крок + ': ' + m); };
  if(!(await ВІДКРИТЕ())) return біда('вікно закрилось само');
  const s = await peek(), e = await екран();
  const pl = s.places[s.side] || [];
  if(s.dragging) біда('після відпускання кнопки тягання «висить»');
  if(e.arts.length !== pl.length) біда('на екрані ' + e.arts.length + ' робіт, а лежить ' + pl.length);
  const on = e.arts.filter(a => a.on);
  if(s.sel >= 0 ? (on.length !== 1 || on[0].i !== s.sel) : on.length) біда('обране на екрані не те: ' + JSON.stringify(on.map(a => a.i)) + ' / ' + s.sel);
  if(Math.abs(e.fr.h / e.fr.w - s.asp) > 0.01) біда('рамка не під фото: ' + (e.fr.h / e.fr.w).toFixed(3) + ' проти ' + s.asp.toFixed(3));
  pl.forEach((q, i) => {
    const a = e.arts.find(x => x.i === i); if(!a) return;
    const b = q.box, ar = s.ar[i];
    const має = { l: e.fr.l + (b.x - b.w / 2) * e.fr.w, t: e.fr.t + b.y * e.fr.h, w: b.w * e.fr.w, h: b.w * e.fr.w * ar };
    const d = Math.max(Math.abs(a.l - має.l), Math.abs(a.t - має.t), Math.abs(a.w - має.w), Math.abs(a.h - має.h));
    if(d > 1.6) біда('робота ' + i + ' на екрані не там, де ляже в мокап (на ' + d.toFixed(1) + ' px)');
    if(a.l < e.fr.l - 1 || a.t < e.fr.t - 1 || a.l + a.w > e.fr.l + e.fr.w + 1 || a.t + a.h > e.fr.t + e.fr.h + 1)
      біда('робота ' + i + ' вилізла за фото');
  });
}

/* Кого має схопити натиск у точці — за тим, що видно: обрана першою
   (вона й лежить зверху), далі верхня. */
function хтоПід(e, sel, x, y){
  const в = (a, pad) => x >= a.l - pad && x <= a.l + a.w + pad && y >= a.t - pad && y <= a.t + a.h + pad;
  const s = e.arts.find(a => a.i === sel);
  if(s && в(s, 2)) return sel;
  for(let k = e.arts.length - 1; k >= 0; k--) if(в(e.arts[k], 0)) return e.arts[k].i;
  return -1;
}
/* Видима точка роботи i: не під іншою, не на × і не на куті обраної. */
function точкаНа(e, sel, i, rnd = Math.random){
  const a = e.arts.find(x => x.i === i); if(!a) return null;
  const s = e.arts.find(x => x.i === sel);
  const кути = s ? [[s.l, s.t], [s.l + s.w, s.t + s.h]] : [];
  const ок = [];
  for(let gx = 1; gx <= 7; gx++) for(let gy = 1; gy <= 7; gy++){
    const x = Math.round(a.l + a.w * gx / 8), y = Math.round(a.t + a.h * gy / 8);
    if(x < e.fr.l + 1 || y < e.fr.t + 1 || x > e.fr.l + e.fr.w - 2 || y > e.fr.t + e.fr.h - 2) continue;
    if(кути.some(([cx, cy]) => Math.abs(x - cx) < 14 && Math.abs(y - cy) < 14)) continue;
    if(хтоПід(e, sel, x, y) === i) ок.push([x, y]);
  }
  return ок.length ? ок[Math.floor(rnd() * ок.length)] : null;
}
function порожнеМісце(e, rnd = Math.random){
  for(let k = 0; k < 400; k++){
    const x = Math.round(e.fr.l + 4 + rnd() * (e.fr.w - 8)), y = Math.round(e.fr.t + 4 + rnd() * (e.fr.h - 8));
    if(e.arts.every(a => x < a.l - 16 || x > a.l + a.w + 16 || y < a.t - 16 || y > a.t + a.h + 16)) return [x, y];
  }
  return null;
}
async function тягнути(x0, y0, x1, y1, steps = 7){
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for(let k = 1; k <= steps; k++) await p.mouse.move(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps);
  await p.mouse.up();
  await p.waitForTimeout(20);
}

/* Схопити роботу i у видимій точці й посунути на (dx, dy). Повертає
   опис провалу або '' — і сама перевіряє, що посунулось саме воно. */
async function посунути(i, dx, dy, rnd){
  const s0 = await peek(), e0 = await екран();
  const pt = точкаНа(e0, s0.sel, i, rnd);
  if(!pt) return 'skip';
  const ждем = хтоПід(e0, s0.sel, pt[0], pt[1]);
  await тягнути(pt[0], pt[1], pt[0] + dx, pt[1] + dy);
  const s1 = await peek();
  if(s1.sel !== ждем) return 'натиск на роботу ' + ждем + ' обрав ' + s1.sel;
  const pl0 = s0.places[s0.side], pl1 = s1.places[s1.side];
  const має = втиснути({ x: pl0[i].box.x + dx / e0.fr.w, y: pl0[i].box.y + dy / e0.fr.h, w: pl0[i].box.w }, s0.ar[i], s0.asp);
  const b = pl1[i].box;
  if(Math.abs(b.x - має.x) > 0.003 || Math.abs(b.y - має.y) > 0.003 || Math.abs(b.w - має.w) > 0.001)
    return 'робота ' + i + ' посунулась не так: ' + JSON.stringify(b) + ' замість ' + JSON.stringify(має);
  for(let k = 0; k < pl0.length; k++) if(k !== i && JSON.stringify(pl0[k].box) !== JSON.stringify(pl1[k].box))
    return 'разом із ' + i + ' посунулась і ' + k;
  return '';
}
/* Потягнути за кут обраної. */
async function масштаб(dx, dy){
  const s0 = await peek(), e0 = await екран();
  if(s0.sel < 0) return 'skip';
  const g = await p.evaluate(() => { const n = document.querySelector('.mko-art.on [data-mko-grip]');
    if(!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if(!g) return 'у обраної немає кута';
  const i = s0.sel, b0 = s0.places[s0.side][i].box, ar = s0.ar[i], a = s0.asp;
  await тягнути(g[0], g[1], g[0] + dx, g[1] + dy);
  const s1 = await peek(), b = s1.places[s1.side][i].box;
  const left = b0.x - b0.w / 2, top = b0.y;
  const fx = (g[0] + dx - e0.fr.l) / e0.fr.w, fy = (g[1] + dy - e0.fr.t) / e0.fr.h;
  let w = Math.max(fx - left, (fy - top) * a / ar);
  w = clamp(w, 0.06, Math.max(0.06, Math.min(1 - left, (1 - top) * a / ar)));
  if(Math.abs(b.w - w) > 0.004) return 'кут дав ширину ' + b.w.toFixed(3) + ' замість ' + w.toFixed(3);
  if(Math.abs((b.x - b.w / 2) - left) > 0.002 || Math.abs(b.y - top) > 0.002) return 'при масштабі зʼїхав верхній лівий кут';
  if(s1.sel !== i) return 'кут зняв вибір';
  return '';
}

/* ══════════════════════════════════════════════════════════════════ */
console.log('\n═══ ОДИН ЛОГОТИП: ЛЯГАЄ НА ФУТБОЛКУ, А НЕ «КРІЗЬ НОГУ» ═══');
/* Рівно те, що зробив Андрій: нова картка, завантажив логотип. Він має
   лягти на груди й бути розміром із мокап — чверть ширини фото, — а не
   половину футболки, як доти на вертикальному знімку. */
await відкрити();
await p.waitForTimeout(300);
let s = await peek(), e = await екран();
console.log('  ' + JSON.stringify({ рамка: [Math.round(e.fr.w), Math.round(e.fr.h)], сцена: [Math.round(e.st.w), Math.round(e.st.h)], box: s.places.front[0] && s.places.front[0].box }));
ok(s.places.front.length === 1 && s.sel === 0, 'логотип одразу ліг на перед і обраний', 'логотип не ліг: ' + JSON.stringify(s));
ok(Math.abs(e.fr.h / e.fr.w - 1.4) < 0.01 && e.fr.w < e.st.w - 50,
  'рамка — саме фото (вертикальний знімок вужчий за сцену), а не вся сіра сцена',
  'рамка не збігається з фото: ' + JSON.stringify(e.fr));
const a0 = e.arts[0];
ok(Math.abs(a0.w / e.fr.w - 0.26) < 0.01,
  'логотип на екрані — 26% ширини ФОТО, як і ляже в мокап (доти — 26% сцени, удвічі більший)',
  'розмір логотипа на екрані не з фото: ' + (a0.w / e.fr.w).toFixed(3));
await інваріанти('один логотип');
/* Тягнемо вниз, далеко за футболку — до «ноги» й за вікно. Логотип має
   зупинитись на нижньому краї фото, а не зникнути під ним. */
let r = await посунути(0, 40, 2000);
ok(!r, 'тягнути вниз за край: логотип упирається в низ фото й лишається видимим', r);
await інваріанти('униз за край');
r = await посунути(0, -3000, -3000);
ok(!r, 'і в лівий верхній кут — так само впирається, не зникає', r);
await інваріанти('угору за край');
r = await посунути(0, 180, 220);
ok(!r, 'і назад на груди — хапається з першого разу', r);
ok(ПРОВАЛИ.length === 0, 'після кожного руху — на екрані рівно те, що ляже в мокап', ПРОВАЛИ.slice(0, 3).join(' | '));

console.log('\n═══ ДУБЛІ: НАТИСК НЕ ЙДЕ «КРІЗЬ» ═══');
await відкрити({ works:[{ name:'лого.png', url: IMG.logo, threads:[{ code:'1133', hex:'#E4572E' }] }], upload:false });
for(let k = 0; k < 3; k++){ await p.click('[data-mko-w="0"]'); await p.waitForTimeout(40); }
s = await peek();
const дубліРазом = s.places.front.some((q, i) => s.places.front.some((z, j) => j > i &&
  Math.abs(q.box.x - z.box.x) < 0.02 && Math.abs(q.box.y - z.box.y) < 0.02));
ok(s.places.front.length === 3 && !дубліРазом,
  'три дублі лягли поруч зі зсувом, а не точно один в одному',
  'дублі лягли один в одному: ' + JSON.stringify(s.places.front.map(q => q.box)));
await інваріанти('три дублі');
const кроки = [];
кроки.push(await посунути(2, 120, 60));      // верхній
кроки.push(await посунути(0, -90, 80));      // нижній — після верхнього
кроки.push(await посунути(1, 30, -70));      // середній
/* Промах: натиск на голу футболку знімає вибір і нічого не тягне. */
e = await екран(); s = await peek();
const пусто = порожнеМісце(e);
const доПромаху = JSON.stringify(s.places);
await тягнути(пусто[0], пусто[1], пусто[0] + 60, пусто[1] + 40);
let s2 = await peek();
ok(s2.sel === -1 && JSON.stringify(s2.places) === доПромаху,
  'промах по футболці (з протягуванням): вибір знято, жодна робота не зрушила',
  'промах щось зробив: ' + JSON.stringify({ sel: s2.sel }));
/* І одразу після промаху — знову хапається кожна. */
кроки.push(await посунути(0, 50, 50));
кроки.push(await посунути(2, -40, 30));
кроки.push(await посунути(1, 20, 20));
ok(кроки.every(x => !x), 'після дублів і промаху кожна робота хапається й їде рівно за мишею', кроки.filter(Boolean).join(' | '));
/* Сторони: спина й назад — і все ще працює. */
await p.click('[data-mko-side="back"]'); await p.waitForTimeout(150);
await p.click('[data-mko-w="0"]'); await p.waitForTimeout(80);
r = await посунути(0, 70, 90);
ok(!r, 'на спині: ліг і тягнеться (жодних ліній калібрування поверх)', r);
ok(!(await p.evaluate(() => document.querySelector('.mko-wrap [data-mko-cal], .mko-wrap .mko-cal'))),
  'старих ліній розмітки у вікні немає — вона одна, в «Областях нанесення»', 'лінії калібрування досі у вікні');
await p.click('[data-mko-side="front"]'); await p.waitForTimeout(150);
r = await посунути(1, -30, 40);
ok(!r, 'повернулись на перед — хапається одразу, без «перемкни, щоб ожило»', r);
await інваріанти('після сторін');

console.log('\n═══ КУТ: БІЛЬШЕ, МЕНШЕ, ЗА КРАЙ ═══');
e = await екран(); s = await peek();
let pt = точкаНа(e, s.sel, 0);
await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(30);
const мас = [await масштаб(60, 20), await масштаб(-90, -10), await масштаб(-400, -400), await масштаб(2000, 2000), await масштаб(-120, -50)];
ok(мас.every(x => !x), 'кут: збільшує, зменшує, пропорції файлу тримаються, за фото не вилазить', мас.filter(Boolean).join(' | '));
await інваріанти('кут');

console.log('\n═══ ВІДПУСТИЛИ МИШУ ЗА ВІКНОМ ═══');
/* Посеред тягання вивели курсор на темне тло за вікном і відпустили:
   доти це закривало вікно разом з усією розкладкою. */
e = await екран(); s = await peek();
pt = точкаНа(e, s.sel, 1);
await тягнути(pt[0], pt[1], 6, 6, 10);
ok(await ВІДКРИТЕ(), 'вікно лишилось відкритим, розкладка ціла', 'вікно закрилось від відпускання за ним');
s2 = await peek();
ok(!s2.dragging, 'і нічого не «висить» на курсорі', 'тягання лишилось після відпускання');
await інваріанти('відпустили за вікном');
r = await посунути(1, 100, 100);
ok(!r, 'та сама робота одразу хапається знову', r);

console.log('\n═══ БРАУЗЕР НЕ ТЯГНЕ КАРТИНКИ ЯК ФАЙЛИ ═══');
/* Промах по фото раніше починав «перетягування фотографії» браузером —
   прозора копія, а миша на час ніби зникає з вікна. */
const тягне = await p.evaluate(() => [...document.querySelectorAll('.mko-wrap img')].map(im => {
  const ev = new DragEvent('dragstart', { bubbles:true, cancelable:true });
  im.dispatchEvent(ev);
  return { draggable: im.draggable, заборонено: ev.defaultPrevented };
}));
ok(тягне.length && тягне.every(t => t.заборонено && t.draggable === false),
  'жодну картинку у вікні не можна потягнути як файл (' + тягне.length + ' шт.)',
  'браузер може тягнути картинки: ' + JSON.stringify(тягне));

console.log('\n═══ ЗАГУБЛЕНЕ ВІДПУСКАННЯ КНОПКИ ═══');
/* Буває, що відпускання не доходить (перемкнули вікно, тачпад, сповіщення
   ОС). Тоді робота не має «прилипати» до курсора назавжди. */
e = await екран(); s = await peek();
pt = точкаНа(e, s.sel, 0);
await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] + 20, pt[1] + 10);
ok((await peek()).dragging, 'натиснули й тягнемо — тягання йде', 'тягання не почалось');
await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointermove',
  { bubbles:true, pointerType:'mouse', pointerId:1, buttons:0, clientX:10, clientY:10 })));
ok(!(await peek()).dragging, 'перший же рух без натиснутої кнопки сам закінчує тягання', 'робота «прилипла» до курсора');
await p.mouse.up();
await p.mouse.move(pt[0] + 20, pt[1] + 10); await p.mouse.down(); await p.mouse.move(pt[0] + 40, pt[1] + 20);
await p.evaluate(() => window.dispatchEvent(new Event('blur')));
ok(!(await peek()).dragging, 'перемкнули вікно посеред тягання — тягання скінчилось', 'після переходу у інше вікно тягання висить');
await p.mouse.up();
await інваріанти('загублене відпускання');

console.log('\n═══ ЗМІНИЛИ РОЗМІР ВІКНА ═══');
await p.setViewportSize({ width:1280, height:650 }); await p.waitForTimeout(250);
await інваріанти('1280×650');
r = await посунутиБудь(40, -30);
ok(!r, 'на меншому екрані роботи їдуть разом із фото й хапаються', r);
await p.setViewportSize({ width:1440, height:800 }); await p.waitForTimeout(250);
await інваріанти('1440×800');
ok(ПРОВАЛИ.length === 0, 'жодна дія вище не розвела екран і мокап', ПРОВАЛИ.slice(0, 4).join(' | '));

console.log('\n═══ ПОВІЛЬНЕ ФОТО ═══');
/* Фото ще вантажиться, а розкладка вже є (чернетка). Роботи не мають
   «вибити» — коли фото доїде, вони стоять рівно на своїх місцях. */
await відкрити({ front: HOST + '/slow/tall.png',
  works:[{ name:'лого.png', url: IMG.logo, threads:[{ code:'1133', hex:'#E4572E' }] }],
  places:[{ side:'front', work:0, x:0.5, y:0.3, w:0.3 }, { side:'front', work:0, x:0.4, y:0.6, w:0.2 }], upload:false });
await p.waitForTimeout(1800);
await інваріанти('повільне фото');
r = await посунути(1, 60, -40);
ok(!r && !ПРОВАЛИ.length, 'фото доїхало пізніше — роботи на своїх місцях і хапаються', r || ПРОВАЛИ.slice(0, 2).join(' | '));

/* ── ВИПАДКОВИЙ ПРОГІН ── */
function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function прогін(назва, фото, seed, дій){
  await відкрити({ front: фото, works:[
    { name:'лого.png', url: IMG.logo, threads:[{ code:'1133', hex:'#E4572E' }] },
    { name:'стрічка.png', url: IMG.tallLogo, threads:[{ code:'1011', hex:'#2E90FA' }] }], upload:false });
  const rnd = rng(seed);
  const pick = n => Math.floor(rnd() * n);
  const біди = [];
  const лік = {};
  let розмір = 0;
  for(let k = 0; k < дій; k++){
    const s = await peek(), e = await екран();
    const n = (s.places[s.side] || []).length;
    const x = rnd();
    let дія, res = '';
    if(n === 0 || (x < 0.1 && n < 6)){
      дія = 'дубль';
      await p.click('[data-mko-w="' + pick(2) + '"]');
      const s1 = await peek();
      if(s1.places[s1.side].length !== n + 1 || s1.sel !== n) res = 'дубль не ліг або не обрався';
    } else if(x < 0.45){
      дія = 'тягнути';
      res = await посунути(pick(n), Math.round((rnd() - 0.5) * 500), Math.round((rnd() - 0.5) * 500), rnd);
    } else if(x < 0.55){
      дія = 'кут';
      if(s.sel < 0){ const pt = точкаНа(e, s.sel, pick(n), rnd); if(pt) await p.mouse.click(pt[0], pt[1]); }
      res = await масштаб(Math.round((rnd() - 0.4) * 240), Math.round((rnd() - 0.4) * 160));
    } else if(x < 0.65){
      дія = 'промах';
      const pt = порожнеМісце(e, rnd);
      if(!pt) res = 'skip';
      else {
        const до = JSON.stringify(s.places);
        await тягнути(pt[0], pt[1], pt[0] + Math.round((rnd() - 0.5) * 120), pt[1] + Math.round((rnd() - 0.5) * 120), 4);
        const s1 = await peek();
        if(s1.sel !== -1) res = 'промах не зняв вибір';
        else if(JSON.stringify(s1.places) !== до) res = 'промах зрушив роботу';
      }
    } else if(x < 0.72){
      дія = 'клік';
      const i = pick(n), pt = точкаНа(e, s.sel, i, rnd);
      if(!pt) res = 'skip';
      else {
        const ждем = хтоПід(e, s.sel, pt[0], pt[1]);
        await p.mouse.click(pt[0], pt[1]);
        if((await peek()).sel !== ждем) res = 'клік по роботі ' + ждем + ' її не обрав';
      }
    } else if(x < 0.78){
      дія = 'за вікно';
      const i = pick(n), pt = точкаНа(e, s.sel, i, rnd);
      if(!pt) res = 'skip';
      else { await тягнути(pt[0], pt[1], pick(2) ? 4 : 1436, 4 + pick(790), 6);
        if(!(await ВІДКРИТЕ())) res = 'вікно закрилось'; }
    } else if(x < 0.84){
      дія = 'сторона';
      await p.click('[data-mko-side="' + (s.side === 'front' ? 'back' : 'front') + '"]');
      await p.waitForTimeout(60);
    } else if(x < 0.89 && s.sel >= 0){
      дія = '×';
      await p.click('.mko-art.on [data-mko-rm]');
      if((await peek()).places[s.side].length !== n - 1) res = '× не прибрав';
    } else if(x < 0.93){
      дія = 'вікно';
      розмір = (розмір + 1) % 3;
      await p.setViewportSize([{ width:1440, height:800 }, { width:1280, height:650 }, { width:1600, height:920 }][розмір]);
      await p.waitForTimeout(120);
    } else {
      дія = 'загублене відпускання';
      const pt = точкаНа(e, s.sel, pick(n), rnd);
      if(!pt) res = 'skip';
      else {
        await p.mouse.move(pt[0], pt[1]); await p.mouse.down(); await p.mouse.move(pt[0] + 15, pt[1] + 15);
        await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointermove',
          { bubbles:true, pointerType:'mouse', pointerId:1, buttons:0, clientX:5, clientY:5 })));
        await p.mouse.up();
      }
    }
    лік[дія] = (лік[дія] || 0) + (res === 'skip' ? 0 : 1);
    if(res && res !== 'skip') біди.push('#' + k + ' ' + дія + ': ' + res);
    const було = ПРОВАЛИ.length;
    await інваріанти('#' + k + ' ' + дія);
    if(ПРОВАЛИ.length > було) біди.push(...ПРОВАЛИ.splice(було));
    if(біди.length > 6) break;
  }
  await p.setViewportSize({ width:1440, height:800 }); await p.waitForTimeout(100);
  console.log('  ' + назва + ': ' + JSON.stringify(лік));
  ok(!біди.length, назва + ' — ' + дій + ' випадкових дій, жодного збою', назва + ': ' + біди.slice(0, 4).join(' | '));
}

console.log('\n═══ ВИПАДКОВИЙ ПРОГІН: ВЕРТИКАЛЬНЕ, ГОРИЗОНТАЛЬНЕ, МАЛЕНЬКЕ ФОТО ═══');
await прогін('вертикальне фото', IMG.tall, 7, 160);
await прогін('горизонтальне фото', IMG.wide, 11, 120);
await прогін('маленьке фото', IMG.small, 23, 120);

console.log('\n═══ МОКАП — ТАМ, ДЕ СТОЯЛО НА ЕКРАНІ ═══');
/* Головна обіцянка вікна: що бачиш, те й ляже. Зберігаємо й дивимось у
   сам мокап: у центрі кожної роботи — її колір, а поруч, де роботи нема,
   — футболка. */
await відкрити({ works:[{ name:'лого.png', url: IMG.logo, threads:[{ code:'1133', hex:'#E4572E' }] }], upload:false });
await p.click('[data-mko-w="0"]'); await p.click('[data-mko-w="0"]');
await посунути(1, 90, 160);
await масштаб(-40, 0);
const доЗбереження = await peek();
await p.click('[data-mko-save]');
for(let k = 0; k < 40 && !(await p.evaluate(() => !!window.__DONE)); k++) await p.waitForTimeout(100);
const мокап = await p.evaluate(async () => {
  const res = window.__DONE; if(!res) return null;
  const side = res.sides.find(x => x.side === 'front');
  const im = new Image(); im.src = side.png; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const px = (fx, fy) => Array.from(x.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data.slice(0, 3));
  return side.places.map(q => ({ box:{ x:q.x, y:q.y, w:q.w }, центр: px(q.x, q.y + q.w * q.ar * c.width / c.height / 2),
    поруч: px(Math.min(0.99, q.x + q.w / 2 + 0.03), q.y + q.w * q.ar * c.width / c.height / 2) }));
});
console.log('  ' + JSON.stringify(мокап));
ok(мокап && мокап.length === 2 &&
   мокап.every((q, i) => Math.abs(q.box.x - доЗбереження.places.front[i].box.x) < 1e-9 &&
                         Math.abs(q.box.y - доЗбереження.places.front[i].box.y) < 1e-9),
  'у мокап пішли рівно ті положення, що були на екрані', 'положення в мокапі інші');
const лого = c => Math.abs(c[0] - 0xE4) < 12 && Math.abs(c[1] - 0x57) < 12 && Math.abs(c[2] - 0x2E) < 12;
ok(мокап && мокап.every(q => лого(q.центр) && !лого(q.поруч)),
  'і намальовані там само: у центрі кожної — логотип, поруч — футболка',
  'мокап намальовано не там: ' + JSON.stringify(мокап && мокап.map(q => [q.центр, q.поруч])));

console.log('\n═══ ВИРОБНИЧА КАРТА ВИШИВКИ ═══');
/* Аркуш A4 горизонтально: праворуч угорі робота на кольорі виробу,
   праворуч унизу — квадрати ниток їхніх кольорів. */
const карта = await p.evaluate(async ({ logo }) => {
  const mock = (() => { const c = document.createElement('canvas'); c.width = 1000; c.height = 1400;
    const x = c.getContext('2d'); x.fillStyle = '#eee'; x.fillRect(0, 0, 1000, 1400); x.fillStyle = '#1b1b1b'; x.fillRect(200, 112, 600, 1200);
    return c.toDataURL('image/png'); })();
  const png = await window.LQMock.prodCard({ no:'#2000201-1', mock, work: logo, garmentHex:'#1B1B1B',
    zone:{ T:0.08, B:0.94, L:0.2, R:0.8, H:72 }, spot:{ side:'front', label:'Перед', work:0, x:0.5, y:0.27, w:0.24, ar:0.5 },
    threads:[{ code:'1801', hex:'#FFFFFF' }, { code:'1133', hex:'#E4572E' }],
    specs:[['Товар', 'Футболка базова'], ['Колір', 'Чорний'], ['Розмір', 'L']] });
  const im = new Image(); im.src = png; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const px = (a, b) => Array.from(x.getImageData(a, b, 1, 1).data.slice(0, 3));
  /* Шукаємо квадрати ниток у нижньому правому блоці за кольором. */
  let помаранч = false;
  for(let yy = 1150; yy < 1450; yy += 6) for(let xx = 1420; xx < 2300; xx += 6){
    const q = px(xx, yy);
    if(Math.abs(q[0] - 0xE4) < 6 && Math.abs(q[1] - 0x57) < 6 && Math.abs(q[2] - 0x2E) < 6) помаранч = true;
  }
  return { w: c.width, h: c.height, фон: px(c.width - 150, 290), помаранч };
}, { logo: IMG.logo });
console.log('  ' + JSON.stringify(карта));
ok(карта.w === 2480 && карта.h === 1754, 'карта — A4 горизонтально (2480×1754)', 'розмір карти: ' + карта.w + '×' + карта.h);
ok(карта.фон.join() === '27,27,27', 'превʼю роботи — на кольорі виробу', 'фон превʼю: ' + карта.фон);
ok(карта.помаранч, 'нитки — квадратами своїх кольорів', 'квадратів ниток не видно');

ok(!errs.length, 'жодної помилки в консолі сторінки', 'помилки: ' + errs.slice(0, 3).join(' | '));
console.log('\n' + (bad ? '✗ провалів: ' + bad : '✓ усе гаразд'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
