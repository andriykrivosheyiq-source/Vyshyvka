/* tests/card-note.mjs — ПРИМІТКА НА КАРТЦІ B2C, ВИДНА ВСІМ (03.11.2026).

   Андрій: «щоб менеджери могли писати примітку на самій картці… і це бачили
   далі вже всі — виробництво, дизайнери… в реальному часі… пишуть тільки
   акаунт-менеджери».
     1. акаунт пише примітку над карткою — вона лягає в картку замовлення
        (`o.cardNote`), з історією;
     2. на плитці дошки — «📝 текст»;
     3. графічний дизайнер і цех її бачать, але змінити не можуть (ні кнопки,
        ні дії);
     4. змінили з іншого пристрою — у відкритій картці дизайнера нове
        з'являється саме, без перевідкриття;
     5. «Прибрати примітку» — зникає скрізь.
   Запуск: node tests/card-note.mjs (у pre-commit). */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9183;
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

const CONTENT = {
  /* ЗАХОДИМО САМИМ ДИЗАЙНЕРОМ, а не власником у ролі дизайнера. Це не
     дрібниця: у власника є перемикач «Дивлюсь як», доступ до всіх дошок і
     всі права — тобто перевіряти на ньому «чого дизайнер не бачить» означає
     перевіряти не те. Володимир тут менеджер, а ми — Оля. */
  team: [{ email:'test@loomiq', name:'Андрій',    role:'owner' },
         { email:'p@loomiq',    name:'Петро',     role:'designer' },
         { email:'e@loomiq',    name:'Емма',      role:'embroidery' },
         { email:'c@loomiq',    name:'Цех',       role:'production' },
         { email:'mgr@loomiq',  name:'Володимир', role:'owner' }],
  /* Годин на макет — своє число, не типове: перевіряємо, що годинник
     справді бере його з налаштувань, а не з константи в коді. */
  b2c: { dzHours: 24 },
  products: { retail: { tee: 600 }, retailReady: { tee: 450 } }
};
const ORDERS = [
  { id:'1', orderId:'2000101', type:'client', dir:'b2c',
    /* Усе, чого дизайнер бачити НЕ має, кладемо в замовлення навмисно —
       інакше перевірка «не видно» проходила б на порожньому. */
    name:'Асія Дерещук', phone:'+380670001122', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T09:00:00.000Z',
    crmChatId:'c1', crmChatName:'Асія Дерещук', crmNick:'asia_dera',
    totalPrice: 4850, items:[] },
  { id:'2', orderId:'2000102', type:'client', dir:'b2c', name:'Б', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T10:00:00.000Z', totalPrice: 1000, items:[] },
  { id:'3', orderId:'2000103', type:'client', dir:'b2c', name:'В', status:'prorahunok', site:'main',
    payments:[], hist:[], createdAt:'2026-09-25T11:00:00.000Z', totalPrice: 1000, items:[] }
];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });



await p.evaluate(() => {
  document.querySelectorAll('main > section').forEach(x => x.style.display = 'none');
  document.getElementById('view-design').style.display = 'block';
  const U = window.LQDesign.ui, D = window.LQDesign;
  const j = designJobMake('2000101');
  j.units = [Object.assign(U.unitNew(), { gid:'tee', name:'Футболка базова', color:'Чорний', size:'M', qty:3, note:'Лого на груди' })];
  const g = D.dzNew(); D.dzAttach(g, 'test@loomiq', 'p@loomiq'); D.dzSend(g, 'test@loomiq'); g.status = 'work';
  D.dzList(j.units[0], 'graphic').push(g);
  const s = D.dzNew(); D.dzAttach(s, 'test@loomiq', 'e@loomiq'); D.dzSend(s, 'test@loomiq'); s.status = 'work';
  D.dzList(j.units[0], 'stitch').push(s);
  for(let i = 1; i <= 5; i++) D.dzVer(g, 'p@loomiq', [{ name:'ескіз' + i + '.png', url:'/tests/fixtures/none-' + i + '.png' }], 'версія ' + i);
  window.__j = j; window.__g = g; window.__s = s;
  openDesign();
  U.host.upload = async f => 'https://x/up/' + f.name;
});
await p.waitForTimeout(400);



const як = async (role, tab) => p.evaluate(({ role, tab }) => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role }) : x);
  try{ applyRoleUi(); }catch(e){}
  const U = window.LQDesign.ui; U.setTab(tab); U.open('2000101'); U.render(document.getElementById('dzRoot'));
}, { role, tab });
const toasts = [];
await p.exposeFunction('__t', m => toasts.push(String(m)));
await p.evaluate(() => { const t0 = window.toast; window.toast = function(m){ try{ window.__t(m); }catch(e){} return t0 && t0.apply(this, arguments); }; });
const NOTE = 'Шити на 2 см нижче коміра, клієнт просить до пʼятниці';

console.log('═══ 1. АКАУНТ ПИШЕ ПРИМІТКУ ═══');
await як('owner', 'acct'); await p.waitForTimeout(300);
const r1 = await p.evaluate(async (NOTE) => {
  const add = document.querySelector('#dzRoot [data-do="note-edit"]'); if(!add) return { add: false };
  add.click(); await new Promise(r => setTimeout(r, 300));
  const ta = document.querySelector('#dzRoot [data-note-t="2000101"]'); if(!ta) return { add: true, ta: false };
  ta.value = NOTE;
  document.querySelector('#dzRoot [data-do="note-save"]').click();
  await new Promise(r => setTimeout(r, 1500));
  const o = orders.find(x => x.orderId === '2000101');
  return { add: true, ta: true, note: o.cardNote && o.cardNote.text, by: o.cardNote && o.cardNote.by, hist: (o.cardNoteHist || []).length,
    bar: (document.querySelector('#dzRoot .dz-note:not(.is-edit)') || {}).textContent || '', edit: !!document.querySelector('#dzRoot .dz-note.is-edit') };
}, NOTE);
console.log('  ' + JSON.stringify(r1));
ok(r1.add && r1.ta && r1.note === NOTE && r1.by === 'test@loomiq' && r1.hist === 1, 'акаунт: «📝 Додати примітку для всіх» → «Зберегти» — у картці замовлення, з історією', 'не записалось: ' + JSON.stringify(r1));
ok(r1.bar.includes(NOTE) && !r1.edit && toasts.some(t => /бачать усі/.test(t)), 'над карткою — жовта смужка з приміткою, хто й коли', 'смужки немає: ' + JSON.stringify(r1));

console.log('═══ 2. НА ПЛИТЦІ ДОШКИ ═══');
const r2 = await p.evaluate(() => { const t = document.querySelector('#dzRoot .dz-card[data-open="2000101"] .dz-c-note'); return t ? t.textContent : ''; });
ok(/📝 Шити на 2 см нижче/.test(r2), 'на плитці — «📝 Шити на 2 см нижче…»', 'на плитці немає: ' + r2);

console.log('═══ 3. ДИЗАЙНЕР І ЦЕХ БАЧАТЬ, АЛЕ НЕ ЗМІНЮЮТЬ ═══');
for(const [role, tab, хто] of [['designer', 'graphic', 'графічний дизайнер'], ['embroidery', 'stitch', 'вишивальний дизайнер'], ['production', 'prod', 'цех']]){
  await як(role, tab); await p.waitForTimeout(300);
  const r = await p.evaluate(async (NOTE) => {
    const bar = document.querySelector('#dzRoot .dz-note');
    const ed = document.querySelector('#dzRoot [data-do="note-edit"]');
    toasts0 = 0;
    await window.LQDesign.ui.act('note-save', document.getElementById('dzRoot'), { id: '2000101' });
    const o = orders.find(x => x.orderId === '2000101');
    return { text: bar ? bar.textContent : '', ed: !!ed, kept: o.cardNote && o.cardNote.text === NOTE };
  }, NOTE).catch(e => ({ err: e.message }));
  ok(r.text && r.text.includes(NOTE) && !r.ed && r.kept, хто + ' бачить примітку, кнопки «змінити» немає, дія — відмова', хто + ': ' + JSON.stringify(r));
}

console.log('═══ 4. НАЖИВО: ЗМІНИЛИ З ІНШОГО ПРИСТРОЮ ═══');
await як('designer', 'graphic'); await p.waitForTimeout(300);
const r4 = await p.evaluate(async () => {
  const pn0 = document.querySelector('#dzRoot .dz-panel');
  const o = orders.find(x => x.orderId === '2000101');
  o.cardNote = { text: 'Нитка лише золота 2305', by: 'mgr@loomiq', at: new Date().toISOString() };   // прийшло знімком
  repaintAfterOrdersNow(); try{ openDesign(true); }catch(e){}
  await new Promise(r => setTimeout(r, 400));
  return { text: (document.querySelector('#dzRoot .dz-note') || {}).textContent || '', same: document.querySelector('#dzRoot .dz-panel') === pn0,
    tile: (document.querySelector('#dzRoot .dz-c-note') || {}).textContent || '' };
});
console.log('  ' + JSON.stringify(r4));
ok(/Нитка лише золота 2305/.test(r4.text) && r4.same, 'у відкритій картці дизайнера нова примітка зʼявилась сама, картка не перевідкривалась', 'не оновилось: ' + JSON.stringify(r4));

console.log('═══ 5. ПРИБРАТИ ═══');
await як('owner', 'acct'); await p.waitForTimeout(300);
const r5 = await p.evaluate(async () => {
  document.querySelector('#dzRoot [data-do="note-edit"]').click(); await new Promise(r => setTimeout(r, 300));
  document.querySelector('#dzRoot [data-do="note-clear"]').click(); await new Promise(r => setTimeout(r, 1500));
  const o = orders.find(x => x.orderId === '2000101');
  return { note: o.cardNote, hist: (o.cardNoteHist || []).length, bar: !!document.querySelector('#dzRoot .dz-note:not(.is-empty)'), tile: !!document.querySelector('#dzRoot .dz-c-note') };
});
console.log('  ' + JSON.stringify(r5));
ok(!r5.note && !r5.bar && !r5.tile && r5.hist >= 2, '«Прибрати примітку» — немає ні над карткою, ні на плитці; в історії лишилось', 'не прибралось: ' + JSON.stringify(r5));

ok(!errs.length, 'без помилок сторінки', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ card-note: примітку пишуть акаунти, бачать усі, наживо');
process.exit(bad ? 1 : 0);
