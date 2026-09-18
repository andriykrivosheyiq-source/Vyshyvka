/* ДИЗАЙН-ВІДДІЛ — окремий контур роботи з макетом.

   Досі дизайн жив одним треком у Канбані. Для одного дизайнера цього
   вистачало; щойно зʼявляється відділ, трек перестає відповідати на
   питання, які й тримають роботу: чи повне ТЗ, хто відповідальний, чому
   саме повернули, яка версія погоджена, хто оцифрував, чи перевірили файл
   перед машиною.

   Перевіряємо не дошки — дошки це форма. Перевіряємо три речі, заради яких
   усе заводилось:

     1. ДИЗАЙНЕР НЕ ГОВОРИТЬ ІЗ КЛІЄНТОМ. Макет повз менеджера відділу не
        йде, і це має бути неможливо, а не «не прийнято».
     2. ПРИЧИНА ПОВЕРНЕННЯ — ДАНІ. Без причини не повертають узагалі:
        вільний текст у чаті нічого не важить, а список — важить.
     3. ВЕРСІЇ НЕ ЗНИКАЮТЬ, погоджена замикається. «Остаточний_фінал2»
        береться рівно з того, що стару версію колись прибрали.

   А також:
     — нове замовлення потрапляє до менеджера відділу, а не в роботу;
     — ТЗ перевіряється списком, а не «уважно»;
     — оцифрування заводиться на КОЖНЕ нанесення окремо й лише на вишивку;
     — оцифровувати до погодження клієнта не можна;
     — «готово» без файлу не натискається;
     — QA не пропускає з неповним чеклістом;
     — пакет не збирається, доки щось не пройшло;
     — dataset пишеться сам і несе причини, а не самі лише картинки;
     — Канбан бачить стан відділу, але ним не керує.

   Запуск:  node tests/design-dept.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8861;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
               '.png':'image/png', '.webp':'image/webp' };
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

/* Замовлення, як його бачить відділ: худі з вишивкою спереду й ззаду —
   це ДВА різні файли, — і футболки з друком, яких вишивка не стосується. */
const ORDER = {
  id:'d1', orderId:'1003100', type:'client', name:'Андрій', company:'ARMORIX',
  phone:'+380670003100', status:'kp', site:'main', payments:[], offerToken:'tokdz',
  createdAt:'2026-09-10T09:00:00.000Z', hist:[], offerDays:7,
  items:[
    { kind:'main', name:'Худі базове', garmentId:'hoodie', color:'Чорний', qty:20,
      sizes:'M × 20', print:'Вишивка', unitPrice:1200, price:24000,
      desc:{ method:'embro' },
      prints:[
        { side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:80, heightMm:45,
          mark:{ topMm:210, centerMm:0 }, file:'https://cdn.test/logo.png' },
        { side:'back',  sideLabel:'Спина', technique:'Вишивка', widthMm:240, heightMm:120,
          mark:{ topMm:180, centerMm:0 }, file:'https://cdn.test/logo.png' }
      ] },
    { kind:'main', name:'Футболка базова', garmentId:'tshirt', color:'Білий', qty:30,
      sizes:'M × 30', print:'Друк', unitPrice:400, price:12000,
      desc:{ method:'dtf' },
      prints:[ { side:'front', sideLabel:'Перед', technique:'DTF', widthMm:200, heightMm:260,
                 file:'https://cdn.test/logo.png' } ] },
    { kind:'reco', name:'Кепка', garmentId:'cap', qty:10, unitPrice:300, price:3000,
      prints:[ { side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:60, heightMm:40 } ] }
  ]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.__SAVED={};\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  'Doc.prototype.set=function(d){ if(this.__col==="designJobs")\n' +
  '    window.__SAVED[this.__id]=JSON.parse(JSON.stringify(d));\n' +
  '  return Promise.resolve(); };');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      var c = n==='kanbanOrders' ? new SeedCol() : new Col(); c.__n=n; return c; },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

console.log('═══ ЗАМОВЛЕННЯ ПОТРАПЛЯЄ ДО МЕНЕДЖЕРА ВІДДІЛУ ═══');
const start = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  return { state: job.state, gstate: job.graphic.status,
           missing: D.briefMissing(o).map(m => m.key),
           stitch: job.stitch.map(s => s.key + ' · ' + s.label + ' · ' + s.name) };
});
console.log('   стан: ' + start.state + ' · дизайнер: ' + start.gstate);
console.log('   нанесення на оцифрування: ' + JSON.stringify(start.stitch));
ok(start.state === 'new',
  'нове замовлення стоїть у черзі відділу, а не в роботі — спершу його дивиться менеджер',
  'нове замовлення одразу в роботі: ' + start.state);
ok(start.stitch.length === 2 && start.stitch.every(s => /Худі/.test(s)),
  'оцифрування заводиться на КОЖНЕ нанесення: перед і спина — два різні файли',
  'задачі оцифрування не ті: ' + JSON.stringify(start.stitch));
ok(!start.stitch.some(s => /Футболка/.test(s)),
  'друк у контур вишивки не потрапляє — там оцифровувати нема чого',
  'позиція з друком заїхала в оцифрування');
ok(!start.stitch.some(s => /Кепка/.test(s)),
  'рекомендована теж ні: клієнт її ще не додав',
  'рекомендована потрапила в оцифрування');

console.log('');
console.log('═══ ТЗ ПЕРЕВІРЯЄТЬСЯ СПИСКОМ, А НЕ «УВАЖНО» ═══');
const brief = await p.evaluate(() => {
  const D = window.LQDesign;
  const full = D.briefMissing(orders[0]).map(m => m.key);
  const thin = JSON.parse(JSON.stringify(orders[0]));
  thin.items.forEach(it => (it.prints || []).forEach(pr => { pr.widthMm = 0; pr.file = ''; }));
  delete thin.offerDays;
  return { full, thin: D.briefMissing(thin).map(m => m.key) };
});
console.log('   повне ТЗ → бракує: ' + (brief.full.join(', ') || 'нічого'));
console.log('   обрізане ТЗ → бракує: ' + brief.thin.join(', '));
ok(!brief.full.length,
  'у повного ТЗ список порожній',
  'у повному ТЗ щось «бракує»: ' + brief.full.join(', '));
ok(brief.thin.indexOf('place') >= 0 && brief.thin.indexOf('logo') >= 0 &&
   brief.thin.indexOf('due') >= 0,
  'у неповного видно, чого саме бракує — розміру, логотипа, дедлайну',
  'бракує не того: ' + brief.thin.join(', '));

console.log('');
console.log('═══ МАКЕТ ПОВЗ МЕНЕДЖЕРА НЕ ЙДЕ ═══');
const gate = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  D.assign(job, o, 'designer@loomiq', 'mgr@loomiq', '');
  D.designStart(job, 'designer@loomiq');
  D.verNew(o, job, 'designer@loomiq');
  D.toReview(job, o, 'designer@loomiq');
  const sneak = D.sendToClient(job, o, 'designer@loomiq');   // спроба обійти
  const noReason = D.revise(job, o, 'mgr@loomiq', [], 'не подобається');
  D.mgrApprove(job, o, 'mgr@loomiq');
  const after = D.sendToClient(job, o, 'mgr@loomiq');
  return { sneak: sneak === null, noReason: noReason === null,
           state: job.state, sentVersion: job.client.version };
});
ok(gate.sneak,
  'віддати клієнту непогоджений макет неможливо — не «не прийнято», а неможливо',
  'макет пішов клієнту повз менеджера відділу');
ok(gate.noReason,
  'повернути на правки без причини теж не можна: без причини це не дані',
  'повернення без причини пройшло');
ok(gate.state === 'client' && gate.sentVersion === 1,
  'після погодження менеджером макет іде клієнту з номером версії',
  'після погодження щось не так: ' + JSON.stringify(gate));

console.log('');
console.log('═══ ПРИЧИНИ Й ВЕРСІЇ ═══');
const cycle = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  D.assign(job, o, 'designer@loomiq', 'mgr@loomiq', '');
  D.designStart(job, 'designer@loomiq');
  D.verNew(o, job, 'designer@loomiq');
  D.toReview(job, o, 'designer@loomiq');
  D.revise(job, o, 'mgr@loomiq', ['place', 'size'], 'зсунути нижче');
  D.verNew(o, job, 'designer@loomiq');
  D.toReview(job, o, 'designer@loomiq');
  D.mgrApprove(job, o, 'mgr@loomiq');
  D.sendToClient(job, o, 'mgr@loomiq');
  D.clientChanges(job, 'mgr@loomiq', ['color'], 'логотип має бути білим');
  D.verNew(o, job, 'designer@loomiq');
  D.toReview(job, o, 'designer@loomiq');
  D.mgrApprove(job, o, 'mgr@loomiq');
  D.sendToClient(job, o, 'mgr@loomiq');
  D.clientApprove(job, o, 'mgr@loomiq', '');
  const v3 = D.verAt(o, 3), v1 = D.verAt(o, 1);
  return {
    versions: (o.art || []).map(v => v.n),
    approved: job.approvedVersion,
    locked3: D.verLocked(v3), locked1: D.verLocked(v1),
    events: job.graphic.events.map(e => e.kind + ':' + e.reasons.join('+')),
    state: job.state,
    mirror: D.mirror(job)
  };
});
console.log('   версії: ' + cycle.versions.join(', ') + ' · погоджена: v' + cycle.approved);
console.log('   повернення: ' + cycle.events.join(' | '));
ok(cycle.versions.join() === '1,2,3',
  'жодна версія не зникла — усі три лишились',
  'версії загубились: ' + cycle.versions.join(', '));
ok(cycle.approved === 3 && cycle.locked3,
  'погоджена версія замикається: переписати те, що бачив клієнт, не можна',
  'погоджену версію не замкнено');
ok(!cycle.locked1,
  'а непогоджені лишаються як були — це історія, а не архів',
  'замкнено зайве');
ok(cycle.events.join() === 'revision:place+size,client:color',
  'причини лежать кодами: і менеджерська, і клієнтська — з цього рахується аналітика',
  'причини записались не так: ' + cycle.events.join(' | '));
ok(cycle.state === 'approved' && cycle.mirror === 'ok',
  'Канбан бачить, що дизайн завершено',
  'дзеркало в Канбані показує ' + cycle.mirror);

console.log('');
console.log('═══ ОЦИФРУВАННЯ ТІЛЬКИ ПІСЛЯ КЛІЄНТА ═══');
const st = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const early = D.ensure(D.emptyJob(o.orderId), o);
  const tooSoon = D.stitchAssign(early, early.stitch[0].key, 'emb@loomiq', 'mgr@loomiq', '');

  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  D.verNew(o, job, 'd@l'); D.mgrApprove(job, o, 'm@l');
  D.sendToClient(job, o, 'm@l'); D.clientApprove(job, o, 'm@l', '');
  const key = job.stitch[0].key;
  D.stitchAssign(job, key, 'emb@loomiq', 'm@l', '');
  const noFile = D.stitchReady(job, key, 'emb@loomiq');
  D.stitchAt(job, key).files.push({ kind:'stitch', name:'front.dst', url:'https://cdn.test/f.dst' });
  D.stitchAt(job, key).stitches = 9400;
  D.stitchReady(job, key, 'emb@loomiq');
  return { tooSoon: tooSoon === null, noFile: noFile === null,
           status: D.stitchAt(job, key).status,
           outsourceOk: (function(){
             const j2 = D.ensure(D.emptyJob(o.orderId), o);
             j2.approvedVersion = 1;
             D.stitchAssign(j2, j2.stitch[0].key, '', 'm@l', 'Підрядник Петро');
             return D.stitchAt(j2, j2.stitch[0].key).outsource;
           })() };
});
ok(st.tooSoon,
  'оцифровувати до погодження клієнта не можна — саме там і згорала робота',
  'оцифрування почалось до погодження');
ok(st.noFile,
  '«готово» без файлу не натискається: це не готово, це обіцянка',
  '«готово» пройшло без файлу');
ok(st.status === 'qa',
  'із файлом задача йде на перевірку',
  'після здачі стан ' + st.status);
ok(st.outsourceOk === 'Підрядник Петро',
  'оцифрувати може і свій, і підрядник — задача при цьому одна',
  'підрядника не записано: ' + st.outsourceOk);

console.log('');
console.log('═══ QA НЕ ПРОПУСКАЄ З НЕПОВНИМ ЧЕКЛІСТОМ ═══');
const qa = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  job.approvedVersion = 1;
  const key = job.stitch[0].key;
  const s = D.stitchAt(job, key);
  s.files.push({ kind:'stitch', name:'f.dst', url:'u' });
  s.status = 'qa';
  const half = {}; D.QA_CHECKS.slice(0, 5).forEach(c => half[c.key] = true);
  const partial = D.qaPass(job, key, 'qa@loomiq', half);
  const noReason = D.qaBack(job, key, 'qa@loomiq', [], '');
  D.qaBack(job, key, 'qa@loomiq', ['density', 'small'], 'дрібний текст не вийде');
  const afterBack = D.stitchAt(job, key).status;
  const all = {}; D.QA_CHECKS.forEach(c => all[c.key] = true);
  D.qaPass(job, key, 'qa@loomiq', all);
  return { partial: !!(partial && partial.miss), missN: partial && partial.miss.length,
           noReason: noReason === null, afterBack,
           final: D.stitchAt(job, key).status,
           checks: D.QA_CHECKS.length };
});
console.log('   пунктів у чеклісті: ' + qa.checks + ' · не відмічено: ' + qa.missN);
ok(qa.partial,
  'з половиною галочок файл на машину не йде — і видно, чого бракує',
  'неповний чекліст пропустив файл');
ok(qa.noReason,
  'повернути без причини теж не можна: причини QA — це фізика, а не смак',
  'повернення QA без причини пройшло');
ok(qa.afterBack === 'revision' && qa.final === 'ok',
  'повернення веде на правки, повний чекліст — на «готово»',
  'маршрут QA не той: ' + qa.afterBack + ' → ' + qa.final);

console.log('');
console.log('═══ ПАКЕТ У ВИРОБНИЦТВО ═══');
const pack = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  const before = D.packReady(job, o);
  job.approvedVersion = 1;
  D.verNew(o, job, 'd@l');
  D.verCur(o).wilcom = 'https://cdn.test/mock.png';
  const half = D.packReady(job, o);
  job.stitch.forEach(s => {
    s.files.push({ kind:'stitch', name:s.side + '.dst', url:'https://cdn.test/' + s.side + '.dst' });
    s.stitches = 9400; s.colors = ['білий', 'чорний']; s.status = 'ok';
  });
  const r = D.packReady(job, o);
  const pk = D.pack(job, o);
  return { before: before.ok, beforeWhy: before.why,
           half: half.ok, halfWhy: half.why,
           ok: r.ok,
           items: pk.items.map(i => i.name + ' · нанесень ' + i.places.length),
           files: pk.items.reduce((a, i) => a + i.places.reduce((b, p) => b + p.files.length, 0), 0),
           stitches: pk.items.reduce((a, i) => a + i.places.reduce((b, p) => b + p.stitches, 0), 0),
           reco: pk.items.some(i => /Кепка/.test(i.name)),
           print: pk.items.filter(i => /Футболка/.test(i.name))
                    .reduce((a, i) => a.concat(i.places.map(p => p.method)), []) };
});
console.log('   без погодження: ' + pack.beforeWhy.join(' · '));
console.log('   без оцифрування: ' + pack.halfWhy.join(' · '));
console.log('   пакет: ' + pack.items.join(' | ') + ' · файлів ' + pack.files);
ok(!pack.before && /не погодив/.test(pack.beforeWhy.join(' ')),
  'без погодження клієнта пакет не збирається — і сказано чому',
  'пакет зібрався без погодження');
ok(!pack.half && /оцифрування/.test(pack.halfWhy.join(' ')),
  'і без перевіреного оцифрування теж',
  'пакет зібрався без файлів вишивки');
ok(pack.ok && pack.stitches === 18800,
  'зібраний пакет несе файли, розміри й стібки кожного нанесення',
  'у пакеті не те: ' + JSON.stringify(pack));
ok(!pack.reco,
  'рекомендована в завдання на виробництво не потрапляє — її ще ніхто не замовив',
  'рекомендована заїхала в пакет');
ok(pack.print.join() === 'print',
  'позиція з друком іде зі своїм файлом, а не порожньою: шити треба і її',
  'друк у пакеті без файлу: ' + JSON.stringify(pack.print));

/* Пакет має доїхати туди, де стоїть машина. Розділу дизайну у виробництва
   немає й не треба — отже пакет іде в саму картку замовлення. */
const toProd = await p.evaluate(() => {
  const o = orders[0];
  o.designPack = window.LQDesign.pack(
    (function(){ const j = window.LQDesign.ensure(window.LQDesign.emptyJob(o.orderId), o);
      j.approvedVersion = 1;
      j.stitch.forEach(s => { s.status = 'ok'; s.stitches = 9400;
        s.colors = ['білий'];
        s.files.push({ kind:'stitch', name:s.side + '.dst', url:'https://cdn.test/x.dst' }); });
      return j; })(), o);
  const html = prodPackHtml(o);
  const empty = prodPackHtml({ orderId:'x' });
  return { has: /Пакет із дизайн-відділу/.test(html),
           files: (html.match(/art-file/g) || []).length,
           mm: /80 × 45 мм/.test(html), stitches: /9400 стібків/.test(html),
           empty };
});
console.log('   у виробничій картці: файлів ' + toProd.files);
ok(toProd.has && toProd.files === 3 && toProd.mm && toProd.stitches,
  'зібраний пакет видно у виробничій картці: нанесення, розмір, стібки й файли',
  'пакет не доїхав до машини: ' + JSON.stringify(toProd));
ok(toProd.empty === '',
  'без пакета блоку немає зовсім — порожній заголовок лише питав би «а де він»',
  'порожній пакет усе одно малює блок');

console.log('');
console.log('═══ DATASET ПИШЕТЬСЯ САМ ═══');
const ds = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = orders[0];
  o.art = [];
  const job = D.ensure(D.emptyJob(o.orderId), o);
  D.assign(job, o, 'd@l', 'm@l', '');
  D.designStart(job, 'd@l');
  D.verNew(o, job, 'd@l', { ai:true });
  D.toReview(job, o, 'd@l');
  D.revise(job, o, 'm@l', ['viz'], 'візуалізація слабка');
  D.verNew(o, job, 'd@l');
  D.toReview(job, o, 'd@l');
  D.mgrApprove(job, o, 'm@l');
  D.sendToClient(job, o, 'm@l');
  D.clientChanges(job, 'm@l', ['size'], 'більше');
  D.verNew(o, job, 'd@l');
  D.mgrApprove(job, o, 'm@l');
  D.sendToClient(job, o, 'm@l');
  D.clientApprove(job, o, 'm@l', '');
  const key = job.stitch[0].key;
  D.stitchAssign(job, key, 'e@l', 'm@l', '');
  D.stitchAt(job, key).files.push({ kind:'stitch', name:'f.dst', url:'u' });
  D.stitchReady(job, key, 'e@l');
  D.qaBack(job, key, 'q@l', ['density'], '');
  const all = {}; D.QA_CHECKS.forEach(c => all[c.key] = true);
  D.qaPass(job, key, 'q@l', all);
  return { steps: job.ds.map(x => x.step),
           ai: job.ds.some(x => x.step === 'graphic-version' && x.ai),
           reasons: job.ds.filter(x => x.reasons).map(x => x.step + ':' + x.reasons.join('+')) };
});
console.log('   ланцюжок: ' + ds.steps.join(' → '));
console.log('   із причинами: ' + ds.reasons.join(' | '));
ok(ds.ai, 'видно, що версію зробила автоматика — саме з цього й починається навчання',
  'позначки AI в ланцюжку немає');
ok(ds.reasons.join() === 'manager-revision:viz,client-changes:size,qa-back:density',
  'правки менеджера, клієнта і QA лежать причинами — це й є цінність набору',
  'причини в ланцюжку не ті: ' + ds.reasons.join(' | '));
ok(['assigned','manager-approve','client-approve','stitch-ready','qa-pass']
     .every(s => ds.steps.indexOf(s) >= 0),
  'ланцюжок проходить усі чотири контури, від ТЗ до файлу на машину',
  'у ланцюжку не всі кроки: ' + ds.steps.join(' → '));

console.log('');
console.log('═══ РОЗДІЛ У ЛІВІЙ ПАНЕЛІ ═══');
const ui = await p.evaluate(async () => {
  const b = document.querySelector('.nav [data-view="design"]');
  if(!b) return { none:true };
  b.click();
  await new Promise(r => setTimeout(r, 900));
  const cols = [...document.querySelectorAll('#dzRoot .dz-col-h')].map(x =>
    x.textContent.replace(/\s+/g, ' ').trim());
  const tabs = [...document.querySelectorAll('#dzRoot .dz-tab')].map(x => x.textContent.trim());
  const cards = document.querySelectorAll('#dzRoot .dz-card').length;
  // відкриваємо картку — має зʼявитись панель із ТЗ
  const first = document.querySelector('#dzRoot .dz-card');
  if(first) first.click();
  await new Promise(r => setTimeout(r, 400));
  const panel = (document.getElementById('dzPanel') || {}).textContent || '';
  return { tabs, cols, cards,
           shown: document.getElementById('view-design').style.display,
           panel: panel.replace(/\s+/g, ' ').slice(0, 140),
           roles: Object.keys(window.ROLES || {}) };
});
if(ui.none){ console.log('  кнопки розділу немає'); bad++; }
else {
  console.log('   вкладки: ' + ui.tabs.join(' · '));
  console.log('   колонки черги: ' + ui.cols.join(' · '));
  console.log('   карток: ' + ui.cards);
  /* Дощок шість: пʼять відділових плюс «Доручення» — вона стоїть першою,
     бо людина відкриває відділ не щоб подивитись на дошку, а щоб дізнатись,
     що їй робити зараз. */
  /* Сім дощок. «Доручення» першою — людина відкриває відділ, щоб дізнатись,
     що їй робити зараз. Далі «Замовлення» — управлінський ланцюг на весь
     шлях; і вже за ними робочі дошки відділів зі своїми станами. */
  ok(ui.shown === 'block' && ui.tabs.length === 7 &&
     ui.tabs[0] === 'Доручення' && ui.tabs[1] === 'Замовлення',
    'розділ відкривається: спершу доручення, потім ланцюг замовлення',
    'розділ не зібрався: ' + JSON.stringify(ui.tabs));
  ok(ui.cols.length === 7 && /Перевірка ТЗ/.test(ui.cols.join(' ')),
    'черга відділу починається з перевірки ТЗ',
    'колонки черги не ті: ' + ui.cols.join(' · '));
  ok(ui.cards >= 1, 'замовлення видно на дошці', 'на дошці порожньо');
  ok(/Худі|ТЗ/.test(ui.panel),
    'картка відкриває панель із технічним завданням',
    'панель не відкрилась: «' + ui.panel + '»');
}
console.log('');
console.log('═══ ДОРУЧЕННЯ ЖИВЕ В РОЗДІЛІ, А НЕ В РОЗМОВІ ═══');
/* Наскрізний прохід кнопками: менеджер видає, виконавець бере й закриває,
   менеджер приймає. Саме цього шару бракувало — доти правку передавали
   словами, а дізнавались про її долю запитанням. */
const task = await p.evaluate(async () => {
  const D = window.LQDesign, U = D.ui;
  const о = orders[0];
  const job = designJobOf(о.orderId);
  const me = myEmail();
  // менеджер видає
  const t = D.taskAdd(job, о, me, { kind:'fix', to: me,
                                    text:'збільшити логотип', why:'client' });
  designSave(job);
  U.setTab('tasks');
  document.querySelector('#dzRoot') && U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 400));
  const колонки = [...document.querySelectorAll('#dzRoot .dz-col-h')].map(x =>
    x.textContent.replace(/\s+/g, ' ').trim());
  const картка = document.querySelector('#dzRoot .dz-card');
  if(картка) картка.click();
  await new Promise(r => setTimeout(r, 400));
  const панель = (document.getElementById('dzPanel') || {}).textContent || '';
  // виконавець бере й закриває
  const беру = document.querySelector('#dzPanel [data-do="task-start"]');
  if(беру) беру.click();
  await new Promise(r => setTimeout(r, 400));
  const поле = document.getElementById('dzClosed');
  if(поле) поле.value = 'V3';
  const готово = document.querySelector('#dzPanel [data-do="task-done"]');
  if(готово) готово.click();
  await new Promise(r => setTimeout(r, 400));
  const f = D.taskAt(designJobOf(о.orderId), t.n);
  return { колонки, панель: панель.replace(/\s+/g, ' ').slice(0, 120),
           стан: f && f.state, закрито: f && f.closedBy };
});
console.log('   колонки: ' + task.колонки.join(' · '));
console.log('   панель: ' + task.панель);
ok(task.колонки.length === 5 && /Видано/.test(task.колонки.join(' ')),
  'дошка доручень має свій шлях: видано → у роботі → виконано → прийнято',
  'колонки доручень не ті: ' + task.колонки.join(' · '));
ok(/збільшити логотип/.test(task.панель),
  'панель доручення показує, що саме треба зробити',
  'зміст доручення не видно: ' + task.панель);
ok(task.стан === 'done' && task.закрито === 'V3',
  'виконавець узяв у роботу й закрив доручення конкретною версією',
  'доручення не пройшло шлях: ' + JSON.stringify(task));

console.log('');
console.log('═══ ПЕРЕДАЧУ ВИДНО, НЕ ЗАХОДЯЧИ У ВІДДІЛ ═══');
/* Автоматичні листи тут зайві: усі сидять в адмінці цілий день. Потрібне
   інше — щоб людина побачила передачу з будь-якого екрана. Тому на кнопці
   розділу висить число: скільки доручень чекає саме на неї. */
const badge = await p.evaluate(async () => {
  const D = window.LQDesign;
  const о = orders[0];
  const job = designJobOf(о.orderId);
  const me = myEmail();
  const було = myTaskCount();
  const t = D.taskAdd(job, о, me, { kind:'digit', to: me, text:'оцифрувати' });
  await designSave(job);
  const стало = myTaskCount();
  const напис = (document.querySelector('.nav [data-view="design"] .nav-n') || {}).textContent || '';
  D.taskStart(job, t.n, me);
  D.taskDone(job, t.n, me, 'DST V1');
  D.taskAccept(job, t.n, me);
  await designSave(job);
  const післяПрийняття = myTaskCount();
  return { було, стало, напис, післяПрийняття };
});
console.log('   було ' + badge.було + ' → стало ' + badge.стало +
            ' (на кнопці «' + badge.напис + '») → після прийняття ' + badge.післяПрийняття);
ok(badge.стало === badge.було + 1 && badge.напис === String(badge.стало),
  'видали доручення — число на кнопці розділу зросло одразу',
  'число не зʼявилось: ' + JSON.stringify(badge));
ok(badge.післяПрийняття === badge.було,
  'прийняте доручення з числа зникає — історія не має щодня нагадувати про себе',
  'прийняте лишилось у лічильнику: ' + badge.післяПрийняття);

const roles = await p.evaluate(() => {
  const src = document.documentElement.innerHTML;
  return { mgr: /designmgr:'Акаунт-менеджер'/.test(src),
           emb: /embroidery:'Вишивальний дизайнер'/.test(src),
           qa:  /qa:'Контроль файлів'/.test(src),
           buy: /supply:'Закупівля'/.test(src),
           zone: /key:'design',\s*label:'Дизайн-відділ'/.test(src) };
});
/* Акаунт-менеджер веде замовлення від і до, тож роль так і зветься: раніше
   вона називалась «менеджер дизайну» й обмежувалась воротами відділу. Ключ
   лишився той самий — він записаний у вже заведених людей. */
ok(roles.mgr && roles.emb && roles.qa,
  'ролі відділу заведені: акаунт-менеджер, вишивальний дизайнер, контроль файлів',
  'ролей бракує: ' + JSON.stringify(roles));
/* Закупівля поки що робота, а не людина: її виконує менеджер. Роль заводимо
   наперед, щоб окремого закупника заводили одним рядком, а не переробкою
   доступів усім. */
ok(roles.buy,
  'і закупівля заведена окремою роллю — на той день, коли зʼявиться закупник',
  'ролі закупівлі немає');
ok(roles.zone,
  'і розділ є в списку зон доступу — його можна видати або забрати',
  'розділу немає в зонах доступу');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'дизайн має власний контур: ТЗ, версії, причини, вишивка, QA, пакет');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
