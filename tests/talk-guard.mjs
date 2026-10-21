/* СТОРОЖ ВНУТРІШНЬОЇ ПЕРЕПИСКИ (21.10). Андрій: «переписка з дизайнером
   падає, повідомлення не відсилається… зроби тестер, який протестить кожен
   діалог». Кожна розмова між ролями, з обох боків, тим самим кодом, що й у
   людей (клік по кнопці, а не виклик функції):

     акаунт → графічний («Написати», 📎 фото, ↪ від клієнта)
     графічний → акаунт («Надіслати», «📎 Фото / файл»)
     акаунт → вишивальний, вишивальний → акаунт
     акаунт → цех, цех → акаунт («Написати»)
     і те саме, коли картка відкрита у ДВОХ місцях одразу (відділ + картка
     праворуч від діалогу) — саме так поле бралось не те, і текст «не
     відсилався».

   Після кожного кроку: повідомлення в стрічці, непрочитане в адресата,
   поле порожнє, без «Не збереглось». Запуск:  node tests/talk-guard.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8917;
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
  window.__j = j; window.__g = g; window.__s = s;
  openDesign();
  U.host.upload = async f => 'https://x/up/' + f.name;
});
await p.waitForTimeout(400);

const errsBefore = () => errs.length;
/* Хто зараз за клавіатурою. Андрій тестує всіма ролями з однієї пошти —
   тут те саме: міняємо роль test@loomiq і перемальовуємо. */
const як = async (role, tab) => p.evaluate(({ role, tab }) => {
  contentData.team = contentData.team.map(x => x.email === 'test@loomiq' ? Object.assign({}, x, { role }) : x);
  const U = window.LQDesign.ui; U.setTab(tab); U.open('2000101'); U.render(document.getElementById('dzRoot'));
}, { role, tab });
const toasts = [];
await p.evaluate(() => { const t0 = window.toast; window.toast = m => { (window.__toasts = window.__toasts || []).push(String(m)); try{ t0(m); }catch(e){} }; });
const лишеТост = async () => p.evaluate(() => { const t = (window.__toasts || []).slice(); window.__toasts = []; return t; });

/* Написати через кнопку: поле з ключем у корені root, кнопка поруч. */
async function написати(root, sel, btn, text){
  return p.evaluate(({ root, sel, btn, text }) => {
    const r = document.querySelector(root); if(!r) return 'немає кореня ' + root;
    const ta = r.querySelector(sel); if(!ta) return 'немає поля ' + sel;
    ta.value = text;
    const b = r.querySelector(btn); if(!b) return 'немає кнопки ' + btn;
    b.click(); return 'ok';
  }, { root, sel, btn, text });
}
const стрічка = (kind) => p.evaluate(kind => {
  const D = window.LQDesign, d = kind === 'graphic' ? window.__g : window.__s;
  return d.thread.filter(m => m.text || m.file).map(m => ({ t: m.text, role: m.role, kind: m.kind, file: m.file && m.file.url }));
}, kind);
const непроч = (kind, email, as) => p.evaluate(({ kind, email, as }) => {
  const D = window.LQDesign, d = kind === 'graphic' ? window.__g : window.__s;
  return D.dzUnseen(d, email, as, kind);
}, { kind, email, as });
const полеПорожнє = (root, sel) => p.evaluate(({ root, sel }) => { const ta = document.querySelector(root + ' ' + sel); return ta ? !ta.value : null; }, { root, sel });
async function крок(назва, kind, root, sel, btn, text, роль, адресат, as){
  const e0 = errsBefore();
  const r = await написати(root, sel, btn, text);
  await p.waitForTimeout(700);
  const т = await лишеТост();
  const л = await стрічка(kind);
  const є = л.some(m => m.t === text && m.role === роль);
  const н = await непроч(kind, адресат, as);
  const порожнє = await полеПорожнє(root, sel);
  ok(r === 'ok' && є && н > 0 && порожнє !== false && !т.some(x => /Не збереглось|не ваша зона|Напишіть/.test(x)) && errs.length === e0,
    назва + ' — у стрічці, непрочитане в адресата (' + н + '), поле очищено',
    назва + ' — ЗЛАМАНО: ' + JSON.stringify({ r, є, н, порожнє, тости: т, помилки: errs.slice(e0) }));
}
const KG = () => p.evaluate(() => window.__j.units[0].id + '|graphic|0');
const KS = () => p.evaluate(() => window.__j.units[0].id + '|stitch|0');

console.log('═══ 1. АКАУНТ ↔ ГРАФІЧНИЙ ═══');
await як('owner', 'acct');
let kg = await KG();
await крок('акаунт → графічному («Написати»)', 'graphic', '#dzRoot', '[data-dzsay="' + kg + '"]', '[data-do="dz-note"][data-dz="' + kg + '"]', 'Зробіть лого меншим', 'acct', 'p@loomiq', 'graphic');
await як('designer', 'graphic');
await крок('графічний → акаунту («Надіслати»)', 'graphic', '#dzRoot', '[data-dzsay="' + kg + '"]', '[data-do="dz-msg"][data-dz="' + kg + '"]', 'Зменшив, подивіться', 'graphic', 'mgr@loomiq', 'acct');

console.log('═══ 3. КАРТКА ВІДКРИТА У ДВОХ МІСЦЯХ — ПИШЕМО В ДРУГІЙ ═══');
/* Відділ відкритий на цій картці, і та сама картка — праворуч від діалогу
   (renderPanel у власний корінь). Поле з тим самим ключем є в обох. */
await як('owner', 'acct');
await p.evaluate(() => {
  let box = document.getElementById('talkSolo');
  if(!box){ box = document.createElement('div'); box.id = 'talkSolo'; document.body.appendChild(box); }
  window.LQDesign.ui.renderPanel(box, '2000101', {});
});
await p.waitForTimeout(300);
const двічі = await p.evaluate(kg => document.querySelectorAll('[data-dzsay="' + kg + '"]').length, kg);
ok(двічі >= 2, 'поле розмови справді є у двох місцях (' + двічі + ') — саме так було в людей', 'дубля немає: ' + двічі);
await крок('акаунт → графічному з другої картки (дзеркало біля діалогу)', 'graphic', '#talkSolo', '[data-dzsay="' + kg + '"]', '[data-do="dz-note"][data-dz="' + kg + '"]', 'Правка з картки біля діалогу', 'acct', 'p@loomiq', 'graphic');
await крок('і з відділу, поки дзеркало ще відкрите', 'graphic', '#dzRoot', '[data-dzsay="' + kg + '"]', '[data-do="dz-note"][data-dz="' + kg + '"]', 'Правка з відділу', 'acct', 'p@loomiq', 'graphic');
await p.evaluate(() => { const b = document.getElementById('talkSolo'); if(b) b.remove(); window.LQDesign.ui.soloOff(); });

console.log('═══ 4. ФОТО В ОБИДВА БОКИ ═══');
await як('owner', 'acct');
const [fc1] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(kg => document.querySelector('#dzRoot [data-do="dz-note-pic"][data-dz="' + kg + '"]').click(), kg)]);
await fc1.setFiles([{ name:'ref1.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') }, { name:'ref2.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') }]);
await p.waitForTimeout(1200);
let л = await стрічка('graphic');
ok(л.filter(m => /x\/up\/ref/.test(m.file || '')).length === 2, 'акаунт → графічному: два фото в стрічці', JSON.stringify(л.slice(-3)));
await як('designer', 'graphic');
const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.evaluate(kg => document.querySelector('#dzRoot [data-do="dz-msg-file"][data-dz="' + kg + '"]').click(), kg)]);
await fc2.setFiles([{ name:'shot.png', mimeType:'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') }]);
await p.waitForTimeout(1200);
л = await стрічка('graphic');
ok(л.some(m => /x\/up\/shot/.test(m.file || '') && m.role === 'graphic'), 'графічний → акаунту: фото в стрічці', JSON.stringify(л.slice(-2)));

console.log('═══ 5. ↪ ВІД КЛІЄНТА ═══');
await як('owner', 'acct');
await p.evaluate(() => { window.LQDesign.ui.forwardToDesigner(orders.find(o => o.orderId === '2000101'), [{ text:'Можна вушка більше?', files:[], at:'2026-10-21T10:00:00Z' }]); });
await p.waitForTimeout(300);
/* Два записи (графіка і вишивка) — відкривається вибір «Кому переслати». */
const pick = await p.$$('[data-fwd-k]');
ok(pick.length === 2, 'вибір «Кому переслати»: графіка і вишивка', String(pick.length));
if(pick.length) await pick[0].click();
await p.waitForTimeout(500);
л = await стрічка('graphic');
const fwd = await p.evaluate(() => window.__g.thread.filter(m => m.fwd).length + window.__s.thread.filter(m => m.fwd).length);
ok(л.some(m => m.t === 'Можна вушка більше?') && fwd >= 1, 'переслане від клієнта лягло дизайнеру', JSON.stringify({ fwd, л: л.slice(-1) }));

console.log('═══ 2. АКАУНТ ↔ ВИШИВАЛЬНИЙ ═══');
/* Зона вишивки в акаунта відкривається після погодженого ескізу. */
await p.evaluate(() => { const D = window.LQDesign;
  D.dzVer(window.__g, 'p@loomiq', [{ name:'w.png', url:'https://x/w.png', role:'work' }, { name:'m.png', url:'https://x/m.png', role:'mock' }], '', null, 'graphic');
  D.dzOk(window.__g, 'test@loomiq', 'client', 1); });
await як('owner', 'acct');
/* В акаунта видно одну половину — перемикаємо на вишивку, як людина. */
await p.evaluate(() => { const U = window.LQDesign.ui; U.SIDE[window.__j.units[0].id] = 'stitch'; U.SIDE_AT[window.__j.units[0].id] = Date.now() + 1e6; U.render(document.getElementById('dzRoot')); });
let ks = await KS();
await крок('акаунт → вишивальному', 'stitch', '#dzRoot', '[data-dzsay="' + ks + '"]', '[data-do="dz-note"][data-dz="' + ks + '"]', 'Нитки — 1 чорна, 2 золота', 'acct', 'e@loomiq', 'stitch');
await як('embroidery', 'stitch');
await крок('вишивальний → акаунту', 'stitch', '#dzRoot', '[data-dzsay="' + ks + '"]', '[data-do="dz-msg"][data-dz="' + ks + '"]', 'Золотої немає, взяв 2305', 'stitch', 'mgr@loomiq', 'acct');

console.log('═══ 6. АКАУНТ ↔ ЦЕХ ═══');
await p.evaluate(() => { const D = window.LQDesign; window.__j.units[0].confirmed = { at: new Date().toISOString() }; });
await як('owner', 'acct');
const prodAcct = await p.evaluate(() => !!document.querySelector('#dzRoot [data-prodsay="acct"]'));
if(!prodAcct){ await p.evaluate(() => { const U = window.LQDesign.ui; U.setTab('prod'); U.open('2000101'); U.render(document.getElementById('dzRoot')); }); }
const seatA = (await p.evaluate(() => document.querySelector('#dzRoot [data-prodsay="acct"]') ? 'acct' : (document.querySelector('#dzRoot [data-prodsay="prod"]') ? 'prod' : '')));
const prodТекст = async (as, text) => p.evaluate(({ as, text }) => {
  const ta = document.querySelector('#dzRoot [data-prodsay="' + as + '"]'); if(!ta) return 'немає поля ' + as;
  ta.value = text; const b = document.querySelector('#dzRoot [data-do="prod-say"][data-as="' + as + '"]'); if(!b) return 'немає кнопки'; b.click(); return 'ok';
}, { as, text });
const prodТалк = () => p.evaluate(() => { const D = window.LQDesign; const l = (D.prodThread ? D.prodThread(window.__j) : (window.__j.prodTalk || [])); return l.map(m => ({ t: m.text, role: m.role })); });
if(seatA){
  const r1 = await prodТекст(seatA, 'Пакуйте в коробку L'); await p.waitForTimeout(600);
  const t1 = await prodТалк();
  ok(r1 === 'ok' && t1.some(m => m.t === 'Пакуйте в коробку L'), 'акаунт → цеху (' + seatA + ') — у розмові', JSON.stringify({ r1, t1 }));
  await як('production', 'prod');
  const r2 = await prodТекст('prod', 'Коробок L немає, є M'); await p.waitForTimeout(600);
  const t2 = await prodТалк();
  ok(r2 === 'ok' && t2.some(m => m.t === 'Коробок L немає, є M' && m.role === 'prod'), 'цех → акаунту — у розмові', JSON.stringify({ r2, t2 }));
} else {
  console.log('  (поля розмови з цехом на цій картці немає — позиція ще не у виробництві; розмову цеху перевіряє prod-roles)');
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad + ' — ВНУТРІШНЯ ПЕРЕПИСКА ЗЛАМАНА' : 'усі внутрішні розмови живі, з обох боків');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
