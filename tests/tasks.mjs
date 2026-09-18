/* Доручення: хто кому дав роботу, що вийшло і скільки це зайняло.

   ЩО БУЛО НЕ ТАК. Процес намагались описати доступами. Але доступ
   відповідає на питання «що я бачу», а тут хтось комусь ДАЄ РОБОТУ: у неї є
   адресат, строк, результат і розмова навколо неї. Поки цього шару немає,
   єдиний спосіб передати правку — сказати словами, а єдиний спосіб дізнатись
   її долю — спитати.

   ЯК МАЄ БУТИ. Замовлення лишається одне — це факт. Доручення живе
   всередині нього, і саме воно лежить на дошці виконавця: дизайнер бачить
   не «замовлення №1842», а «правку №3» у ньому.

   Перевіряємо не форму, а те, заради чого все заводилось:

     1. ДОРУЧЕННЯ ЗАВЖДИ МАЄ АДРЕСАТА. «Відділ» — не людина, питати з
        відділу нема з кого.
     2. ПОВЕРНЕННЯ БЕЗ ПРИЧИНИ НЕМОЖЛИВЕ. Не тому, що незручно, а тому, що
        без причини запис нічого не важить в аналітиці.
     3. ЗАКРИВАЄ ДОРУЧЕННЯ КОНКРЕТНА РІЧ. Не «готово», а «V3» — інакше через
        рік видно, що робили, але не видно навіщо.
     4. РОЗМОВА ЖИВЕ В ДОРУЧЕННІ, а не в чаті поруч.
     5. ЧАС РАХУЄТЬСЯ САМ — позначки вже стоять.

   Запуск:  node tests/tasks.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8868;
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'text/html' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.goto(HOST + '/tests/blank.html', { waitUntil:'domcontentloaded' }).catch(() => {});
await p.setContent('<!doctype html><meta charset="utf-8"><body></body>');
await p.addScriptTag({ url: HOST + '/loomiq-design.js' });
await p.waitForTimeout(300);

console.log('═══ ДОРУЧЕННЯ МАЄ АДРЕСАТА Й ЗМІСТ ═══');
const add = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  const o = { orderId:'1842', items:[] };
  return {
    безАдресата: !!D.taskAdd(job, o, 'mgr@lq', { kind:'fix', text:'збільшити логотип' }),
    безЗмісту:   !!D.taskAdd(job, o, 'mgr@lq', { kind:'fix', to:'anna@lq' }),
    чужийТип:    !!D.taskAdd(job, o, 'mgr@lq', { kind:'вигадка', to:'anna@lq', text:'щось' }),
    норм:        !!D.taskAdd(job, o, 'mgr@lq', { kind:'fix', to:'anna@lq',
                    text:'збільшити логотип і підняти на 2 см', why:'client', due:'14:00' }),
    штук: D.taskList(job).length
  };
});
console.log('   без адресата: ' + add.безАдресата + ' · без змісту: ' + add.безЗмісту +
            ' · чужий тип: ' + add.чужийТип + ' · нормальне: ' + add.норм);
ok(!add.безАдресата, 'без адресата доручення не видається — питати з відділу нема з кого',
  'доручення пішло в нікуди');
ok(!add.безЗмісту, 'і без змісту теж: доручення, яке треба вгадувати, повернеться правкою',
  'порожнє доручення видалось');
ok(!add.чужийТип, 'тип доручення — зі списку, а не будь-яке слово', 'вигаданий тип пройшов');
ok(add.норм && add.штук === 1, 'нормальне доручення видається й отримує номер',
  'доручень у задачі: ' + add.штук);

console.log('');
console.log('═══ ШЛЯХ ДОРУЧЕННЯ ═══');
const flow = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  const o = { orderId:'1842', items:[] };
  const t = D.taskAdd(job, o, 'mgr@lq', { kind:'fix', to:'anna@lq', text:'правка', why:'client' });
  const кроки = [];
  кроки.push(t.state);
  D.taskStart(job, t.n, 'anna@lq');            кроки.push(D.taskAt(job, t.n).state);
  D.taskDone(job, t.n, 'anna@lq', 'V3');       кроки.push(D.taskAt(job, t.n).state);
  const безПричини = !!D.taskReturn(job, t.n, 'mgr@lq', '', 'та ну');
  D.taskReturn(job, t.n, 'mgr@lq', 'designer', 'логотип поїхав');
  кроки.push(D.taskAt(job, t.n).state);
  D.taskDone(job, t.n, 'anna@lq', 'V4');
  D.taskAccept(job, t.n, 'mgr@lq');            кроки.push(D.taskAt(job, t.n).state);
  const знову = !!D.taskAccept(job, t.n, 'mgr@lq');
  const f = D.taskAt(job, t.n);
  return { кроки, безПричини, знову, closedBy: f.closedBy, why: f.why,
           гілка: (f.thread || []).length,
           історія: job.ds.map(x => x.step) };
});
console.log('   ' + flow.кроки.join(' → '));
ok(flow.кроки.join('>') === 'new>work>done>returned>accepted',
  'видано → у роботі → виконано → повернуто → прийнято',
  'шлях не той: ' + flow.кроки.join(' → '));
ok(!flow.безПричини,
  'повернути без причини неможливо — інакше запис нічого не важить в аналітиці',
  'повернення без причини пройшло');
ok(flow.why === 'designer', 'причина повернення лягла в доручення',
  'причини немає: ' + flow.why);
ok(flow.closedBy === 'V4',
  'доручення закрила конкретна річ — не «готово», а V4',
  'чим закрили, не записано: «' + flow.closedBy + '»');
ok(!flow.знову, 'прийняте вдруге не приймається — стан не крутиться по колу',
  'прийняли двічі');
ok(flow.гілка >= 1, 'коментар при поверненні ліг у саме доручення',
  'коментаря немає');
console.log('   історія: ' + flow.історія.join(' · '));
ok(flow.історія.indexOf('task-return') >= 0 && flow.історія.indexOf('task-accept') >= 0,
  'кожен крок лишився в історії задачі — з автором і часом',
  'історія неповна');

console.log('');
console.log('═══ РОЗМОВА Й ЧАС ═══');
const talk = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  const o = { orderId:'1842', items:[] };
  const t = D.taskAdd(job, o, 'mgr@lq', { kind:'fix', to:'anna@lq', text:'правка' });
  D.taskSay(job, t.n, 'anna@lq', 'На 2 см вище — чи до шва?');
  D.taskSay(job, t.n, 'mgr@lq', 'Рівно 2 см.');
  D.taskSay(job, t.n, 'anna@lq', '   ');
  const f = D.taskAt(job, t.n);
  f.startedAt = '2026-01-01T10:00:00.000Z';
  f.doneAt    = '2026-01-01T11:12:00.000Z';
  return { реплік: f.thread.length, хв: D.taskAge(f),
           мої: D.tasksOf(job, 'ANNA@lq').length,
           чужі: D.tasksOf(job, 'petro@lq').length,
           відкритих: D.taskOpen(job).length };
});
console.log('   реплік: ' + talk.реплік + ' · тривало: ' + talk.хв + ' хв');
ok(talk.реплік === 2, 'порожня репліка не додається — у гілці лише сказане',
  'реплік вийшло ' + talk.реплік);
ok(talk.хв === 72, 'час рахується сам із позначок — окремого таймера не треба',
  'час порахувався як ' + talk.хв + ' хв');
ok(talk.мої === 1 && talk.чужі === 0,
  'доручення знаходиться за поштою виконавця, і регістр не заважає',
  'адресація не працює: мої ' + talk.мої + ', чужі ' + talk.чужі);
ok(talk.відкритих === 1, 'неприйняте доручення лишається відкритим',
  'відкритих ' + talk.відкритих);

console.log('');
console.log('═══ СТАРА ЗАДАЧА НЕ ЛАМАЄТЬСЯ ═══');
/* Задачі, заведені до появи доручень, приходять без поля — і мають
   продовжити працювати, а не впасти на першому ж читанні. */
const old = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  delete job.tasks;
  D.ensure(job, { orderId:'1842', items:[] });
  return { є: Array.isArray(job.tasks), штук: D.taskList(job).length };
});
ok(old.є && old.штук === 0, 'задача без поля доручень добудовується сама',
  'стара задача не піднялась: ' + JSON.stringify(old));

console.log('');
console.log('═══ ВИШИВАЛЬНИЙ ФАЙЛ ТЕЖ МАЄ ВЕРСІЇ ═══');
/* У макета версії є з самого початку, і саме вони закривають половину
   суперечок. У стібках вони потрібні ще більше: там правку видно не оком, а
   машиною, і «ми ж виправили» без номера версії нічого не означає. */
const vers = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  const o = { orderId:'1842', items:[{ kind:'main', name:'Худі', qty:50, print:'Вишивка',
    prints:[{ side:'front', technique:'embro', widthMm:90, heightMm:42 }] }] };
  D.ensure(job, o);
  const key = (D.stitchKeys(o)[0] || {}).key;
  const s = D.stitchAt(job, key);
  if(!s) return { none:true };
  // перша здача
  s.files = [{ name:'v1.dst', url:'u1' }]; s.stitches = 8000;
  const безФайлу = (() => { const t = D.stitchAt(job, key); const was = t.files;
    t.files = []; const r = !!D.stitchReady(job, key, 'tar@lq'); t.files = was; return r; })();
  D.stitchReady(job, key, 'tar@lq');
  // QA повертає
  D.qaBack(job, key, 'qa@lq', ['density'], 'щільність завелика');
  // друга здача
  s.files = [{ name:'v2.dst', url:'u2' }]; s.stitches = 7600;
  D.stitchReady(job, key, 'tar@lq');
  const checks = {}; D.QA_CHECKS.forEach(c => checks[c.key] = true);
  D.qaPass(job, key, 'qa@lq', checks);
  const v = D.stitchVers(job, key);
  return { безФайлу, штук: v.length,
           перша: v[0] && v[0].files[0].name, друга: v[1] && v[1].files[0].name,
           чому: (v[1] && v[1].why) || [], ok: v.map(x => !!x.ok) };
});
if(vers.none){ console.log('  нанесення не зібралось'); bad++; }
else {
  console.log('   версій: ' + vers.штук + ' · ' + vers.перша + ' → ' + vers.друга +
              ' · через: ' + vers.чому.join(', '));
  ok(!vers.безФайлу, '«готово» без файлу не приймається — це не готово',
    'здали порожнє нанесення');
  ok(vers.штук === 2 && vers.перша === 'v1.dst' && vers.друга === 'v2.dst',
    'кожна здача лишає версію, і попередня нікуди не дівається',
    'версій вийшло: ' + vers.штук);
  ok(vers.чому.join() === 'density',
    'у версії записано, за що повернули попередню — інакше список каже, ' +
      'що робили, і мовчить про навіщо',
    'причина не привʼязалась: ' + JSON.stringify(vers.чому));
  ok(vers.ok.join() === 'false,true',
    'погоджена версія позначена назавжди, а не переписується мовчки',
    'позначки погодження не ті: ' + vers.ok.join(', '));
}

console.log('');
ok(!errs.length, 'без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'робота передається дорученням: адресат, причина, результат, розмова');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
