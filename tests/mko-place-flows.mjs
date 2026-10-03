/* «✎ РОЗМІЩЕННЯ» — ЖИТТЄВІ СЦЕНАРІЇ: ХТО СТВОРИВ, КОЛИ ПРАВИЛИ, ЯКІ ДАНІ.

   Баг 03.10 (docs/BUGS.md). Андрій: «дівчата створили… я зайшов
   підредагувати, картинку ніяк не можу рухати… не зʼявляється інтерфейс,
   коли я натискаю… не двігати, не збільшувати, не зменшувати».

   Причина була не у вікні, а в даних: у збережених версіях траплялись
   положення без координат і положення за межами фото (старе вікно встигло
   їх зберегти, коли логотип «падав крізь ногу»). Нове вікно ставило таку
   картинку чесно — під край кадру, де її не видно й не схопити.

   Тому тут не «відкрили — посунули», а життя:
     1. роботу здав інший (дизайнер), правку робить менеджер;
     2. роботу здали ми, а правимо через тиждень — після того, як картка
        полежала в базі (усе пройшло через JSON, як через Firestore);
     3. биті дані: без координат, null, рядки, за кожним краєм кадру,
        ширина 0 і понад 100%, невідома сторона, неіснуючий номер роботи,
        старий формат розміщення без положення;
     4. «натиснув — зняв — прибрав — повернув — перемкнув сторону — ще раз»,
        Escape без збереження, «↺ У центр», стрілки;
   і все це — двічі: від імені власника й від імені акаунт-менеджера.

   Після КОЖНОГО відкриття перевіряємо: кожна робота видима й ціла в межах
   фото; натиск її обирає (зʼявляється кут масштабу); тягання її рухає;
   кут збільшує й зменшує; збереження дає нову версію з тими ж положеннями,
   і всі вони — числа в межах кадру.

   Запуск:  node tests/mko-place-flows.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8985;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json',
               '.svg':'image/svg+xml', '.png':'image/png' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const ORDERS = [{ id:'1', orderId:'2000201', type:'client', dir:'b2c', name:'Асія', status:'prorahunok', site:'main',
  payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z', totalPrice: 1000, items:[] }];
function stubFor(role){
  const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role }], b2c: { dzHours: 24 } };
  let s = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  s = s.replace('window.firebase={', 'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
  s = s.replace('Col.prototype.doc=function(){ return new Doc(); };',
    'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
  s = s.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
    "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
    " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
  s = s.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
    'function SeedCol(){}\n  SeedCol.prototype=Object.create(Col.prototype);\n' +
    '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({ docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
    '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); }, empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
    '  var fs=function(){ return { collection:function(n){ if(n===\'kanbanOrders\') return new SeedCol(); var c=new Col(); c.__n=n; return c; },');
  return s;
}

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function прогін(role, назва){
  console.log('\n████████ ' + назва + ' ████████');
  const errs = [];
  const p = await browser.newPage({ viewport:{ width:1440, height:860 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
  p.on('dialog', d => d.accept(d.defaultValue() || ''));
  const stub = stubFor(role);
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: stub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none';
    /* Що вікно каже людині — щоб у разі провалу було видно причину. */
    window.__SAID = []; const t0 = window.toast; window.toast = m => { window.__SAID.push(String(m)); try{ t0(m); }catch(e){} };
    window.LQDesign.ui.host.toast = window.toast; window.LQMock.host.toast = window.toast; });

  /* ── Позиція: футболка, фото перед і спина, робота адаптована під нитки ── */
  await p.evaluate(() => {
    const png = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c.toDataURL('image/png'); };
    window.__IMG = {
      front: png(1000, 1400, (x, w, h) => { x.fillStyle = '#eee'; x.fillRect(0,0,w,h); x.fillStyle = '#222'; x.fillRect(w*.2, h*.08, w*.6, h*.86); }),
      back:  png(1000, 1400, (x, w, h) => { x.fillStyle = '#e6e6e6'; x.fillRect(0,0,w,h); x.fillStyle = '#333'; x.fillRect(w*.2, h*.08, w*.6, h*.86); }),
      logo:  png(400, 200, (x, w, h) => { x.fillStyle = '#E4572E'; x.fillRect(0,0,w,h); }),
      tall:  png(200, 420, (x, w, h) => { x.fillStyle = '#2E90FA'; x.fillRect(0,0,w,h); })
    };
    document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
    document.getElementById('view-design').style.display = 'block';
    const U = window.LQDesign.ui, D = window.LQDesign;
    const j = designJobMake('2000201');
    j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'L', qty:3, note:'Лого' })];
    openDesign();
    /* Сховище віддає справжній файл: його можна відкрити й намалювати в мокап. */
    U.host.upload = async f => URL.createObjectURL(f);
    U.host.sides = () => [{ key:'front', label:'Перед', url: window.__IMG.front }, { key:'back', label:'Спина', url: window.__IMG.back }];
    U.host.zone = () => ({ T:0.08, B:0.94, L:0.2, R:0.8, H:72 });
    window.LQMock.host.zone = () => ({ T:0.08, B:0.94, L:0.2, R:0.8, H:72 });
    const d = D.dzNew(); D.dzList(j.units[0], 'graphic').push(d);
    D.dzAttach(d, 'designer@loomiq', 'test@loomiq', 'Оля'); D.dzSend(d, 'test@loomiq'); D.dzTake(d, 'designer@loomiq');
    window.__j = j;
    /* Картку щоразу беремо з бази заново: після збереження там уже новий обʼєкт. */
    window.J = () => designJobs['2000201'];
  });
  const W = () => p.evaluate(() => {
    const d = window.LQDesign.dzList(J().units[0], 'graphic')[0];
    return { n: d.vers.length, last: d.vers[d.vers.length - 1] || null };
  });
  const панель = async seat => { await p.evaluate(s => { const U = window.LQDesign.ui; U.setTab(s); U.open('2000201'); U.render(document.getElementById('dzRoot')); }, seat); await p.waitForTimeout(300); };
  /* Що на екрані: рамка-фото й роботи, і що під центром кожної. */
  const екран = () => p.evaluate(() => {
    const fr = document.querySelector('.mko-wrap [data-mko-frame]');
    if(!fr) return null;
    const r = fr.getBoundingClientRect();
    return { fr:{ l:r.left, t:r.top, w:r.width, h:r.height }, side: window.LQMock.peek().side, peek: window.LQMock.peek(),
      arts:[...fr.querySelectorAll('[data-mko-p]')].map(n => { const b = n.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { i:+n.dataset.mkoP, on:n.classList.contains('on'), l:b.left, t:b.top, w:b.width, h:b.height,
                 видно: !!top && !!top.closest && top.closest('[data-mko-p]') === n }; }) };
  });
  const відкрито = () => p.evaluate(() => !!document.querySelector('.mko-wrap [data-mko-frame]'));
  /* Перевірка після відкриття: кожна видима, ціла в кадрі, хапається, тягнеться, масштабується. */
  async function живі(мітка){
    const біди = [];
    const e = await екран();
    if(!e){ ok(false, '', мітка + ': вікно не відкрилось'); return; }
    for(const a of e.arts){
      if(a.w < 8 || a.h < 4) біди.push('робота ' + a.i + ' замала: ' + Math.round(a.w) + '×' + Math.round(a.h));
      if(a.l < e.fr.l - 1 || a.t < e.fr.t - 1 || a.l + a.w > e.fr.l + e.fr.w + 1 || a.t + a.h > e.fr.t + e.fr.h + 1)
        біди.push('робота ' + a.i + ' за межами фото');
      if(!a.видно) біди.push('робота ' + a.i + ' чимось перекрита');
    }
    for(const a0 of e.arts){
      const e1 = await екран();
      const a = e1.arts.find(x => x.i === a0.i);
      /* Клік — обрана, видно кут. */
      await p.mouse.click(a.l + a.w * 0.3, a.t + a.h * 0.5);
      await p.waitForTimeout(40);
      const sel = await p.evaluate(() => ({ sel: window.LQMock.peek().sel,
        кут: !!document.querySelector('.mko-art.on [data-mko-grip]') && getComputedStyle(document.querySelector('.mko-art.on [data-mko-grip]')).display !== 'none',
        центр: !document.querySelector('[data-mko-center]').hidden }));
      if(sel.sel !== a.i || !sel.кут) { біди.push('натиск не обрав роботу ' + a.i + ' (' + JSON.stringify(sel) + ')'); continue; }
      if(!sel.центр) біди.push('немає кнопки «У центр» для обраної');
      /* Тягнемо до центру фото: хай звідки — має поїхати. */
      const b0 = (await p.evaluate(() => window.LQMock.peek())).places[e1.side][a.i].box;
      const fx = e1.fr.l + e1.fr.w * 0.5, fy = e1.fr.t + e1.fr.h * 0.45;
      const sx = a.l + a.w * 0.3, sy = a.t + a.h * 0.5;
      await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(fx, fy, { steps: 6 }); await p.mouse.up();
      await p.waitForTimeout(40);
      const b1 = (await p.evaluate(() => window.LQMock.peek())).places[e1.side][a.i].box;
      if(Math.abs(b1.x - b0.x) + Math.abs(b1.y - b0.y) < 0.01 && Math.abs(sx - fx) + Math.abs(sy - fy) > 20)
        біди.push('тягання не посунуло роботу ' + a.i);
      /* Кут: більше, потім менше. */
      const g = await p.evaluate(() => { const n = document.querySelector('.mko-art.on [data-mko-grip]'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await p.mouse.move(g[0], g[1]); await p.mouse.down(); await p.mouse.move(g[0] + 40, g[1] + 20, { steps: 5 }); await p.mouse.up();
      const w1 = (await p.evaluate(() => window.LQMock.peek())).places[e1.side][a.i].box.w;
      const g2 = await p.evaluate(() => { const n = document.querySelector('.mko-art.on [data-mko-grip]'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await p.mouse.move(g2[0], g2[1]); await p.mouse.down(); await p.mouse.move(g2[0] - 50, g2[1] - 25, { steps: 5 }); await p.mouse.up();
      const w2 = (await p.evaluate(() => window.LQMock.peek())).places[e1.side][a.i].box.w;
      /* Збільшувати є куди, лише коли робота ще не уперлась у правий чи нижній край. */
      const pk = await p.evaluate(() => window.LQMock.peek());
      const ar = pk.ar[a.i] || 1, низ = b1.y + b1.w * ar / (pk.asp || 1.4);
      const місце = (b1.x + b1.w / 2) < 0.97 && низ < 0.97;
      if(місце && !(w1 > b1.w + 0.005)) біди.push('кут не збільшив роботу ' + a.i + ' (' + b1.w.toFixed(3) + '→' + w1.toFixed(3) + ')');
      if(!місце && w1 < b1.w - 0.001) біди.push('кут зменшив роботу, що впирається в край');
      if(!(w2 < w1 - 0.005)) біди.push('кут не зменшив роботу ' + a.i + ' (' + w1.toFixed(3) + '→' + w2.toFixed(3) + ')');
    }
    const e2 = await екран();
    for(const a of e2.arts)
      if(a.l < e2.fr.l - 1 || a.t < e2.fr.t - 1 || a.l + a.w > e2.fr.l + e2.fr.w + 1 || a.t + a.h > e2.fr.t + e2.fr.h + 1)
        біди.push('після рухів робота ' + a.i + ' вилізла за фото');
    ok(!біди.length, мітка + ': кожна робота видима в межах фото, обирається, тягнеться, кут більшає й меншає (' + e.arts.length + ' шт.)',
      мітка + ': ' + біди.join(' | '));
  }
  /* Обидві сторони. */
  async function обидві(мітка){
    await живі(мітка + ' · перед');
    await p.click('.mko-wrap [data-mko-side="back"]'); await p.waitForTimeout(400);
    await живі(мітка + ' · спина');
    await p.click('.mko-wrap [data-mko-side="front"]'); await p.waitForTimeout(300);
  }
  /* Зберегти й перевірити: нова версія, положення — ті самі, що на екрані, і всі в кадрі. */
  async function зберегти(мітка){
    const до = await W();
    const peek = await p.evaluate(() => window.LQMock.peek());
    await p.evaluate(() => { window.__SAID = []; });
    await p.click('.mko-wrap [data-mko-save]');
    for(let k = 0; k < 100 && (await W()).n === до.n; k++) await p.waitForTimeout(100);
    const сказано = await p.evaluate(() => window.__SAID.slice(-3));
    const після = await W();
    const spots = ((після.last && після.last.place && після.last.place.spots) || []);
    const свої = [];
    Object.keys(peek.places).forEach(s => peek.places[s].forEach(q => свої.push(s + ':' + q.box.x.toFixed(4) + ':' + q.box.y.toFixed(4) + ':' + q.box.w.toFixed(4))));
    const у = spots.map(sp => sp.side + ':' + (+sp.x).toFixed(4) + ':' + (+sp.y).toFixed(4) + ':' + (+sp.w).toFixed(4));
    const всіЧисла = spots.every(sp => [sp.x, sp.y, sp.w].every(v => isFinite(+v)) && +sp.w > 0 && +sp.x >= 0 && +sp.x <= 1 && +sp.y >= 0 && +sp.y <= 1);
    ok(після.n === до.n + 1 && JSON.stringify(свої.sort()) === JSON.stringify(у.sort()) && всіЧисла,
      мітка + ': збереглась нова версія ' + після.n + ', положення — рівно ті, що були на екрані, усі в межах кадру',
      мітка + ': версія не та: ' + JSON.stringify({ до: до.n, після: після.n, свої, у, всіЧисла, сказано }));
    return після;
  }
  const розміщення = async () => {
    await p.evaluate(() => document.querySelector('[data-do="dz-place"]').click());
    for(let k = 0; k < 30 && !(await відкрито()); k++) await p.waitForTimeout(100);
    await p.waitForTimeout(500);
  };

  console.log('\n═══ 1. ЗДАВ ДИЗАЙНЕР — ПРАВИТЬ МЕНЕДЖЕР ═══');
  await p.evaluate(() => { const d = window.LQDesign.dzList(J().units[0], 'graphic')[0];
    d.draft = { works:[{ name:'лого-нитки.png', url: __IMG.logo, hash:'h1', threads:[{ code:'1133', hex:'#E4572E' }] }],
                places:[{ side:'front', work:0, x:0.5, y:0.3, w:0.26 }, { side:'back', work:0, x:0.5, y:0.2, w:0.4 }] }; });
  await панель('graphic');
  await p.evaluate(() => document.querySelector('[data-do="dz-work"]').click());
  for(let k = 0; k < 30 && !(await відкрито()); k++) await p.waitForTimeout(100);
  await p.waitForTimeout(500);
  await обидві('вікно дизайнера');
  await зберегти('дизайнер здав');
  await панель('acct');
  ok(await p.evaluate(() => !!document.querySelector('[data-do="dz-place"]')), 'у менеджера є «✎ Розміщення»', 'кнопки «✎ Розміщення» немає');
  await розміщення();
  /* Відкрилось рівно там, де здав дизайнер. */
  const e1 = await екран();
  const v1 = (await W()).last;
  const біля = e1.arts.every(a => { const sp = v1.place.spots.filter(s => s.side === e1.side)[a.i]; if(!sp) return false;
    return Math.abs((a.l - e1.fr.l) / e1.fr.w - (sp.x - sp.w / 2)) < 0.01 && Math.abs((a.t - e1.fr.t) / e1.fr.h - sp.y) < 0.01; });
  ok(біля, 'вікно менеджера відкрилось рівно з тим положенням, що в здачі дизайнера', 'положення при відкритті не те: ' + JSON.stringify(e1.arts));
  await обидві('правка менеджера');
  await зберегти('менеджер поправив');
  /* І вдруге — з тим, що поставив менеджер. */
  await розміщення();
  const e2 = await екран(), v2 = (await W()).last;
  const тамСамо = e2.arts.every(a => { const sp = v2.place.spots.filter(s => s.side === e2.side)[a.i];
    return sp && Math.abs((a.t - e2.fr.t) / e2.fr.h - sp.y) < 0.01; });
  ok(тамСамо, 'відкрили ще раз — стоїть там, де поставив менеджер', 'повторне відкриття не з того положення');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  console.log('\n═══ 2. ЗДАЛИ МИ — ПРАВИМО ЧЕРЕЗ ТИЖДЕНЬ (ЧЕРЕЗ БАЗУ) ═══');
  await p.evaluate(() => {
    /* Тиждень у базі: усе пройшло через JSON (NaN → null, дати — рядки). */
    const тиждень = 7 * 864e5;
    const j = JSON.parse(JSON.stringify(designJobs['2000201']));
    j.units.forEach(u => (u.graphic || []).forEach(d => (d.vers || []).forEach(v => { v.at = new Date(Date.parse(v.at) - тиждень).toISOString(); })));
    designJobs['2000201'] = j; window.__j = j;
  });
  await панель('acct');
  await розміщення();
  await обидві('через тиждень');
  await зберегти('через тиждень');

  console.log('\n═══ 3. БИТІ ДАНІ У ВЕРСІЯХ ═══');
  const ВИПАДКИ = [
    ['без координат', [{ side:'front', work:0, w:0.26 }]],
    ['координати null', [{ side:'front', work:0, x:null, y:null, w:0.3 }]],
    ['координати рядками', [{ side:'front', work:0, x:'0.4', y:'0.35', w:'0.3' }]],
    ['за нижнім краєм (упала крізь ногу)', [{ side:'front', work:0, x:0.5, y:1.2, w:0.26 }]],
    ['на нижньому краї (y = 1)', [{ side:'front', work:0, x:0.5, y:1, w:0.26 }]],
    ['за верхнім краєм', [{ side:'front', work:0, x:0.5, y:-0.4, w:0.26 }]],
    ['за лівим краєм', [{ side:'front', work:0, x:-0.3, y:0.3, w:0.26 }]],
    ['за правим краєм', [{ side:'front', work:0, x:1.4, y:0.3, w:0.26 }]],
    ['ширина 0', [{ side:'front', work:0, x:0.5, y:0.3, w:0 }]],
    ['ширина 200%', [{ side:'front', work:0, x:0.5, y:0.3, w:2 }]],
    ['висока робота на всю висоту', [{ side:'front', work:1, x:0.5, y:0.1, w:0.9 }]],
    ['без сторони', [{ side:'', work:0, x:0.5, y:0.3, w:0.26 }]],
    ['невідома сторона', [{ side:'left', work:0, x:0.5, y:0.3, w:0.26 }]],
    ['номер роботи поза списком', [{ side:'front', work:7, x:0.5, y:0.3, w:0.26 }]],
    ['дві биті на обох сторонах', [{ side:'front', work:0, y:1.5, w:0.3 }, { side:'back', work:1, x:-1, y:null, w:5 }]],
    ['старий формат без положення', null]
  ];
  for(const [мітка, spots] of ВИПАДКИ){
    await p.evaluate(spots => {
      const D = window.LQDesign, d = D.dzList(J().units[0], 'graphic')[0];
      const works = [{ name:'лого.png', url: __IMG.logo, hash:'h1' }, { name:'стрічка.png', url: __IMG.tall, hash:'h2' }];
      const place = spots ? { works, spots } : { wCm: 21.7, hCm: 10.8, topCm: 12, sideCm: 0 };
      D.dzVer(d, 'designer@loomiq', [{ name:'лого.png', url: __IMG.logo, role:'work' }, { name:'Перед.png', url: __IMG.front, role:'mock' }], '', place, 'graphic');
      /* І так, як воно лежить у базі. */
      const j = JSON.parse(JSON.stringify(designJobs['2000201'])); designJobs['2000201'] = j; window.__j = j;
    }, spots);
    await панель('acct');
    await розміщення();
    const e = await екран();
    const n = e ? Object.keys(e.peek.places).reduce((a, s) => a + e.peek.places[s].length, 0) : 0;
    ok(e && n >= 1, мітка + ': вікно відкрилось, робота на виробі (' + n + ')', мітка + ': робіт на виробі немає');
    await обидві(мітка);
    await зберегти(мітка);
  }

  console.log('\n═══ 4. НАТИСНУВ — ЗНЯВ — ПРИБРАВ — ПОВЕРНУВ — ЕСКЕЙП ═══');
  await панель('acct');
  await розміщення();
  let e = await екран();
  const a = e.arts[0];
  await p.mouse.click(a.l + a.w / 2, a.t + a.h / 2);
  ok((await p.evaluate(() => window.LQMock.peek().sel)) === 0, 'натиснув — обрана', 'не обралась');
  await p.mouse.click(e.fr.l + 6, e.fr.t + 6);
  ok((await p.evaluate(() => window.LQMock.peek().sel)) === -1, 'натиснув повз — вибір знято', 'вибір не знявся');
  await p.mouse.click(a.l + a.w / 2, a.t + a.h / 2);
  await p.click('.mko-art.on [data-mko-rm]'); await p.waitForTimeout(80);
  e = await екран();
  ok(e.arts.length === 0, '× прибрав роботу з виробу', 'робота лишилась після ×');
  await p.click('.mko-wrap [data-mko-w="0"]'); await p.waitForTimeout(120);
  await живі('повернув плиткою');
  await p.click('.mko-wrap [data-mko-side="back"]'); await p.waitForTimeout(300);
  await p.click('.mko-wrap [data-mko-side="front"]'); await p.waitForTimeout(300);
  await живі('після перемикання сторін');
  /* «↺ У центр» і стрілки. */
  e = await екран();
  await p.mouse.click(e.arts[0].l + e.arts[0].w / 2, e.arts[0].t + e.arts[0].h / 2);
  await p.click('.mko-wrap [data-mko-center]'); await p.waitForTimeout(60);
  let b = (await p.evaluate(() => window.LQMock.peek())).places.front[0].box;
  ok(Math.abs(b.x - 0.5) < 1e-9 && Math.abs(b.y - 0.3) < 1e-9, '«↺ У центр» ставить обрану на груди по центру', 'у центр не стала: ' + JSON.stringify(b));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Shift+ArrowDown');
  const b2 = (await p.evaluate(() => window.LQMock.peek())).places.front[0].box;
  ok(b2.x > b.x && b2.y > b.y + 0.015, 'стрілки посувають обрану (Shift — більшим кроком)', 'стрілки не рухають: ' + JSON.stringify(b2));
  const перед = (await W()).n;
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(!(await відкрито()) && (await W()).n === перед, 'Escape закриває без збереження — нової версії немає', 'Escape щось зберіг або не закрив');
  await розміщення();
  await p.click('.mko-wrap .mko-b[data-mko-x]'); await p.waitForTimeout(200);
  ok(!(await відкрито()) && (await W()).n === перед, '«Скасувати» — так само', '«Скасувати» не спрацювало');

  ok(!errs.length, назва + ': сторінка без помилок', назва + ': помилки: ' + errs.slice(0, 3).join(' | '));
  await p.close();
}

await прогін('owner', 'ВЛАСНИК');
await прогін('designmgr', 'АКАУНТ-МЕНЕДЖЕР');

console.log('\n' + (bad ? '✗ провалів: ' + bad : '✓ усе гаразд'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
