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
console.log('═══ ЛАНЦЮГ: ДЕ ЗАМОВЛЕННЯ ЗАРАЗ ═══');
/* Колонка рахується, а не ставиться руками. Руками поставлений стан рано чи
   пізно розходиться з тим, що насправді зроблено, — і дошка починає брехати
   саме тоді, коли на неї найбільше дивляться. */
const chain = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = () => D.emptyJob('1842');
  const ord = t => ({ orderId:'1842', items:[], tracks:t || {} });
  const j0 = job();
  const j1 = job(); j1.state = 'design';
  const j2 = job(); j2.state = 'client';
  const j3 = job(); j3.approvedVersion = 2;
  j3.stitch = [{ key:'0:front', status:'digit' }];
  const j4 = job(); j4.approvedVersion = 2;
  j4.stitch = [{ key:'0:front', status:'ok' }];
  return {
    нове:      D.chainAt(j0, ord()),
    дизайн:    D.chainAt(j1, ord()),
    клієнт:    D.chainAt(j2, ord()),
    вишивка:   D.chainAt(j3, ord()),
    виробн:    D.chainAt(j4, ord()),
    контроль:  D.chainAt(j4, ord({ prod:'done' })),
    доВідпр:   D.chainAt(j4, ord({ prod:'done', qc:'ok' })),
    відпр:     D.chainAt(j4, ord({ prod:'done', qc:'ok', ship:'sent' })),
    брак:      D.chainAt(j4, ord({ prod:'done', qc:'bad' })),
    колонок:   D.CHAIN.length,
    господар:  D.CHAIN.every(c => !!D.CHAIN_WHO[c.key])
  };
});
console.log('   ' + ['нове','дизайн','клієнт','вишивка','виробн','контроль','доВідпр','відпр']
  .map(k => chain[k]).join(' → '));
ok(chain.нове === 'new' && chain.дизайн === 'design' && chain.клієнт === 'client',
  'до погодження клієнтом замовлення йде дизайнерськими колонками',
  'початок ланцюга не той: ' + JSON.stringify(chain));
ok(chain.вишивка === 'stitch' && chain.виробн === 'prod',
  'погоджена графіка з недоробленими файлами — це «вишивка», а не «виробництво»: ' +
    'саме тут найчастіше й губився час',
  'вишивка й виробництво переплутані');
ok(chain.контроль === 'qc' && chain.доВідпр === 'ready' && chain.відпр === 'shipped',
  'далі — контроль, до відправки й відправлено',
  'кінець ланцюга не той: ' + JSON.stringify(chain));
ok(chain.брак === 'qc',
  'бракована партія лишається в контролі, а не їде далі',
  'брак проскочив у: ' + chain.брак);
ok(chain.колонок === 8 && chain.господар,
  'вісім колонок, і в кожної написано, хто тримає замовлення',
  'колонки без господаря');

console.log('');
console.log('═══ ЦЕХ І ЗАКУПІВЛЯ: СВОЇ СТАНИ ═══');
/* Вісім станів цеху з ТЗ. Вони не заміняють треки в картці: трек каже, що
   зроблено, а дошка — що робити. «Очікуємо одяг» стоїть окремо навмисно:
   доти замовлення, яке чекає постачальника, виглядало як таке, за яке
   просто ще не взялись. */
const shop = await p.evaluate(() => {
  const D = window.LQDesign;
  const j = D.emptyJob('1842');
  const o = t => ({ orderId:'1842', items:[], tracks: t || {} });
  return {
    нове:    D.prodAt(j, o()),
    чекає:   D.prodAt(j, o({ supply:'sent' })),
    готово:  D.prodAt(j, o({ supply:'got', prod:'ready' })),
    станки:  D.prodAt(j, o({ supply:'got', prod:'work' })),
    контр:   D.prodAt(j, o({ prod:'done' })),
    погодж:  D.prodAt(j, o({ prod:'done', qc:'check' })),
    можна:   D.prodAt(j, o({ prod:'done', qc:'ok' })),
    пішло:   D.prodAt(j, o({ prod:'done', qc:'ok', ship:'sent' })),
    цех: D.PROD.length, закуп: D.SUPPLY.map(x => x.key).join(','),
    сУ: D.supplyAt(o({ supply:'part' })), сНема: D.supplyAt(o())
  };
});
console.log('   ' + ['нове','чекає','готово','станки','контр','погодж','можна','пішло']
  .map(k => shop[k]).join(' → '));
ok(shop.цех === 8 && shop.нове === 'new' && shop.чекає === 'wait' &&
   shop.станки === 'run' && shop.пішло === 'sent',
  'у цеху вісім станів, і замовлення проходить їх по порядку',
  'стани цеху не ті: ' + JSON.stringify(shop));
ok(shop.погодж === 'appr',
  'фото є, слова менеджера ще немає — окрема колонка, а не «контроль»: ' +
    'інакше цех вважає роботу зданою, а вона висить',
  'очікування погодження не виділилось: ' + shop.погодж);
ok(shop.закуп === 'todo,sent,part,got' && shop.сУ === 'part' && shop.сНема === 'todo',
  'у закупівлі свої чотири стани, і жодного зайвого',
  'дошка закупівлі не та: ' + shop.закуп);

console.log('');
console.log('═══ ДИЗАЙНЕР БЕРЕ САМ, АЛЕ НЕ БІЛЬШЕ ДЕСЯТИ ═══');
/* Доти роботу мусив роздати менеджер відділу: поки він не дійшов до черги,
   вільний дизайнер сидів без роботи, а замовлення стояло. Межа — не про
   людину, а про чергу: одинадцяте замовлення вже нікуди не поспішає, бо й
   попередні десять стоять. */
const take = await p.evaluate(() => {
  const D = window.LQDesign;
  const o = { orderId:'1842', items:[] };
  const вільне = D.emptyJob('1842');
  const взяв = !!D.takeSelf(вільне, o, 'anna@lq', []);
  const чуже = D.emptyJob('1843');
  чуже.graphic.assignee = 'petro@lq';
  const відмова = D.takeSelf(чуже, o, 'anna@lq', []);
  // десять уже в роботі
  const busy = [];
  for(let i = 0; i < D.TAKE_LIMIT; i++)
    busy.push({ graphic:{ assignee:'anna@lq', status:'work' } });
  const ще = D.takeSelf(D.emptyJob('1844'), o, 'anna@lq', busy);
  // зданий не рахується
  const done = busy.slice(0, D.TAKE_LIMIT - 1)
    .concat([{ graphic:{ assignee:'anna@lq', status:'done' } }]);
  const післяЗдачі = !!D.takeSelf(D.emptyJob('1845'), o, 'anna@lq', done);
  return { взяв, стан: вільне.graphic.status, шар: вільне.state,
           відмова: !!відмова, межа: D.TAKE_LIMIT,
           повний: !!(ще && ще.full), післяЗдачі,
           навантаження: D.loadOf(busy, 'ANNA@lq') };
});
console.log('   узяв: ' + take.взяв + ' · межа: ' + take.межа +
            ' · навантаження: ' + take.навантаження);
ok(take.взяв && take.стан === 'work' && take.шар === 'design',
  'дизайнер бере вільне замовлення сам — і воно одразу в роботі',
  'самостійне взяття не спрацювало: ' + JSON.stringify(take));
ok(!take.відмова, 'чуже замовлення взяти не можна', 'забрали чужу роботу');
ok(take.повний,
  'на одинадцятому система зупиняє: черга, якої не видно, нікому не допомагає',
  'межа не спрацювала');
ok(take.післяЗдачі,
  'здав котресь — місце звільнилось',
  'після здачі місце не звільнилось');
ok(take.навантаження === take.межа,
  'навантаження рахується по пошті, і регістр не заважає',
  'навантаження порахувалось як ' + take.навантаження);

console.log('');
console.log('═══ ТЗ І ВКЛАДЕННЯ ═══');
const brief = await p.evaluate(() => {
  const D = window.LQDesign;
  const job = D.emptyJob('1842');
  const o = { orderId:'1842', items:[] };
  D.briefSet(job, 'mgr@lq', 'Логотип у два кольори, приклад у вкладенні');
  D.briefPic(job, 'mgr@lq', { name:'ref.png', url:'u1' });
  D.briefPic(job, 'mgr@lq', { name:'ref2.png', url:'u2' });
  D.briefPicDel(job, 0);
  const t = D.taskAdd(job, o, 'mgr@lq', { kind:'fix', to:'anna@lq', text:'правка' });
  D.taskFile(job, t.n, 'mgr@lq', { name:'shot.png', url:'u9' });
  const порожнє = !!D.taskFile(job, t.n, 'mgr@lq', { name:'x' });
  return { текст: job.brief.text, картинок: job.brief.pics.length,
           лишилась: job.brief.pics[0] && job.brief.pics[0].name,
           вкладень: D.taskAt(job, t.n).files.length, порожнє };
});
console.log('   ТЗ: «' + brief.текст.slice(0, 40) + '…» · референсів: ' + brief.картинок);
ok(/два кольори/.test(brief.текст) && brief.картинок === 1 && brief.лишилась === 'ref2.png',
  'ТЗ живе в задачі текстом і референсами, зайвий референс прибирається',
  'ТЗ не зберігається: ' + JSON.stringify(brief));
ok(brief.вкладень === 1 && !brief.порожнє,
  'до доручення чіпляється скріншот, а порожнє вкладення не приймається',
  'вкладення не працюють: ' + JSON.stringify(brief));

console.log('');
ok(!errs.length, 'без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'робота передається дорученням: адресат, причина, результат, розмова');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
