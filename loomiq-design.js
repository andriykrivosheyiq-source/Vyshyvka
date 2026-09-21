/* ══════════════════════════════════════════════════════════════════════
   ДИЗАЙН-ВІДДІЛ — окремий контур роботи з макетом

   Досі дизайн жив одним треком у Канбані: «в роботі → на перевірці →
   правки → погоджено». Для одного дизайнера цього вистачало. Щойно
   зʼявляється відділ, трек перестає відповідати на питання, які й тримають
   роботу: чи повне ТЗ, хто відповідальний, чому саме повернули, яка версія
   погоджена, хто оцифрував, чи перевірили файл перед машиною.

   Тому дизайн отримує власний контур із чотирьох частин:

       Графіка → Погодження клієнта → Оцифрування → Передача у виробництво

   Три речі тут головні, і саме вони, а не дошки, є суттю:

   1. ДИЗАЙНЕР НЕ ГОВОРИТЬ ІЗ КЛІЄНТОМ. Між ними завжди менеджер відділу:
      він перевіряє повноту ТЗ на вході й макет на виході. Нове замовлення
      потрапляє спершу до нього, а не в роботу.

   2. ПРИЧИНА ПОВЕРНЕННЯ — ДАНІ, А НЕ ТЕКСТ У ЧАТІ. З вільного поля не
      порахувати нічого. Зі списку причин видно, на чому відділ спотикається
      щотижня, — і саме це потім учить автоматику.

   3. ВЕРСІЇ НЕ ЗНИКАЮТЬ. Погоджена замикається. Історія правок із причинами
      і є той набір даних, заради якого все це заводиться: не «картинка →
      файл вишивки», а ЛЮДСЬКІ РІШЕННЯ — що було не так і що з цим зробили.

   Де лежить: окрема колекція designJobs/{orderId}. Не в картці замовлення:
   там ліміт 1 МБ на документ, і версії з історією його зʼїдять. Картка
   возить лише стан, щоб продажник бачив, де замовлення, не заходячи сюди.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── Черга відділу. Її веде менеджер дизайну ────────────────────────── */
  var QUEUE = [
    { key:'new',      label:'Нові',              color:'gray'   },
    { key:'check',    label:'Перевірка ТЗ',      color:'violet' },
    { key:'assigned', label:'Призначено',        color:'cyan'   },
    { key:'design',   label:'У роботі',          color:'blue'   },
    { key:'review',   label:'На перевірці',      color:'amber'  },
    { key:'client',   label:'У клієнта',         color:'amber'  },
    { key:'approved', label:'Погоджено',         color:'green', done:true }
  ];

  /* ── Дошка графічного дизайнера ─────────────────────────────────────── */
  var GRAPHIC = [
    { key:'new',      label:'Нові',              color:'gray'   },
    { key:'work',     label:'В роботі',          color:'blue'   },
    { key:'review',   label:'На перевірці',      color:'violet' },
    { key:'revision', label:'Правки',            color:'amber'  },
    { key:'done',     label:'Готово',            color:'green', done:true }
  ];

  /* ── Дошка оцифрування. Одна картка = одне нанесення ────────────────── */
  var STITCH = [
    { key:'wait',     label:'Очікує',            color:'gray'   },
    { key:'digit',    label:'Оцифрування',       color:'blue'   },
    { key:'qa',       label:'На перевірці',      color:'violet' },
    { key:'revision', label:'Правки',            color:'amber'  },
    { key:'ok',       label:'Готово',            color:'green', done:true }
  ];

  /* ── Причини повернення ──────────────────────────────────────────────
     Це не ввічливість, а вимірювання. Поки причина живе в чаті, питання
     «на чому ми найчастіше спотикаємось» не має відповіді взагалі. */
  var MGR_REASONS = [
    { key:'place', label:'Не те розташування' },
    { key:'size',  label:'Не той розмір' },
    { key:'logo',  label:'Проблема з логотипом' },
    { key:'color', label:'Не ті кольори' },
    { key:'viz',   label:'Слабка візуалізація' },
    { key:'tech',  label:'Технічна проблема' },
    { key:'brief', label:'Не враховано вимогу клієнта' }
  ];
  var CLIENT_REASONS = [
    { key:'size',    label:'Змінити розмір' },
    { key:'place',   label:'Змінити розташування' },
    { key:'color',   label:'Змінити колір' },
    { key:'design',  label:'Змінити дизайн' },
    { key:'garment', label:'Змінити виріб' },
    { key:'other',   label:'Інше' }
  ];
  /* Причини QA — окремі: там повертають не за смаком, а за фізикою. */
  var QA_REASONS = [
    { key:'density',  label:'Щільність' },
    { key:'compens',  label:'Компенсація' },
    { key:'small',    label:'Дрібні елементи не вийдуть' },
    { key:'text',     label:'Текст не читається' },
    { key:'order',    label:'Порядок вишивки' },
    { key:'size',     label:'Розмір не сходиться' },
    { key:'colors',   label:'Кольори ниток' },
    { key:'other',    label:'Інше' }
  ];

  /* ── Чекліст QA вишивального файлу ───────────────────────────────────
     Це НЕ той контроль, що перевіряє готову партію, — той у нас уже є в
     треку «Контроль». Тут перевіряють ФАЙЛ до того, як він потрапить на
     машину: після машини виправляти нема чого, тканина вже прошита.

     Порахувати це автоматично ми не можемо — стібки читає інша програма.
     Тому чекліст заповнює людина, але заповнює структуровано й назавжди. */
  var QA_CHECKS = [
    { key:'size',    label:'Розміри сходяться з ТЗ' },
    { key:'outline', label:'Контури чисті' },
    { key:'order',   label:'Порядок вишивки правильний' },
    { key:'satin',   label:'Сатин там, де треба' },
    { key:'tatami',  label:'Татамі там, де треба' },
    { key:'running', label:'Running доречний' },
    { key:'density', label:'Щільність у нормі' },
    { key:'compens', label:'Компенсацію враховано' },
    { key:'small',   label:'Дрібні елементи виходять' },
    { key:'text',    label:'Текст читається' },
    { key:'colors',  label:'Кольори ниток задані' },
    { key:'able',    label:'Фізично вишивається на нашій машині' }
  ];

  /* ── Що має бути в ТЗ, щоб задачу можна було віддати в роботу ────────
     Менеджер відділу не «дивиться уважно» — він бачить список того, чого
     бракує. Саме тут зупиняється половина переробок: дизайнер малює за
     неповним ТЗ, а потім усе переробляється через розмір, якого ніхто не
     назвав. */
  var BRIEF = [
    { key:'garment', label:'Виріб і колір',        has: function(o){
        return (o.items || []).some(function(it){ return it.name; }); } },
    { key:'qty',     label:'Кількість',            has: function(o){
        return (o.items || []).some(function(it){ return (+it.qty || 0) > 0; }); } },
    { key:'place',   label:'Розміщення й розмір нанесення', has: function(o){
        return (o.items || []).some(function(it){
          return (it.prints || []).some(function(p){ return (+p.widthMm || 0) > 0; }); }); } },
    { key:'method',  label:'Тип нанесення',        has: function(o){
        return (o.items || []).some(function(it){
          return (it.prints || []).some(function(p){ return p.technique; }) || it.print; }); } },
    { key:'logo',    label:'Логотип або референс', has: function(o){
        return (o.items || []).some(function(it){
          return (it.prints || []).some(function(p){ return p.file; }); }); } },
    { key:'due',     label:'Дедлайн',              has: function(o){
        return !!(o.dueAt || o.deadlineDays || o.offerDays); } }
  ];

  /* Скільки замовлень дизайнер тримає одночасно. Десять — не красиве
     число, а межа, за якою черга перестає бути видимою: одинадцяте вже
     нікуди не поспішає, бо й попередні десять стоять.

     Зупиняє це саме систему, а не людину: узяти більше просто не вийде,
     доки не здасть. Інакше «я візьму, встигну» перетворюється на десять
     замовлень, жодне з яких не рухається. */
  var TAKE_LIMIT = 10;
  function loadOf(jobs, email){
    var e = String(email || '').trim().toLowerCase();
    if(!e) return 0;
    var n = 0;
    (jobs || []).forEach(function(j){
      var g = (j && j.graphic) || {};
      if(String(g.assignee || '').trim().toLowerCase() !== e) return;
      if(g.status === 'done') return;
      n++;
    });
    return n;
  }
  /* Дизайнер бере замовлення сам. Доти його мусив призначити менеджер
     відділу — тобто робота стояла, поки він не дійшов до черги. */
  function takeSelf(job, o, who, jobs){
    if(!job || !who) return null;
    var g = job.graphic || (job.graphic = { status:'new', assignee:'', due:'', events:[] });
    if(g.assignee) return null;                       // вже чиєсь
    if(loadOf(jobs, who) >= TAKE_LIMIT) return { full: true };
    g.assignee = who;
    g.status = 'work';
    if(job.state === 'new' || job.state === 'check' || job.state === 'assigned')
      job.state = 'design';
    ds(job, 'take-self', { by: who });
    return job;
  }

  /* ══════════ УПРАВЛІНСЬКА ДОШКА ══════════
     Дошка акаунт-менеджера на ВЕСЬ ланцюг: від «щойно завели» до
     «відправлено». Вона не замінює робочі дошки відділів — ті лишаються з
     власними станами, бо всередині кожного етапу своя кухня. Тут інше
     питання: де замовлення ЗАРАЗ і хто його тримає.

     Колонка рахується, а не ставиться руками. Руками поставлений стан
     рано чи пізно розходиться з тим, що насправді зроблено, — і дошка
     починає брехати саме тоді, коли на неї найбільше дивляться.

     Порядок перевірок зворотний — від кінця до початку. Так замовлення
     завжди стоїть у найдальшій колонці, якої воно справді досягло: інакше
     воно застрягало б у першій, де щось лишилось незакритим. */
  /* Виробнича дошка — вісім станів із ТЗ, рівно в тому порядку, у якому
     цех їх і проживає. Вони не заміняють треки в картці: трек каже, що
     зроблено, а дошка — що робити. Стан тут теж рахується з фактів.

     «Очікуємо одяг» стоїть раніше за «готово до виробництва» навмисно:
     доти обидва стани були одним, і замовлення, яке чекає постачальника,
     виглядало як таке, за яке просто ще не взялись. */
  var PROD = [
    { key:'new',    label:'Нове',                color:'gray'   },
    { key:'wait',   label:'Очікуємо одяг',       color:'amber'  },
    { key:'ready',  label:'Готово до роботи',    color:'cyan'   },
    { key:'run',    label:'На станках',          color:'blue'   },
    { key:'qc',     label:'Контроль якості',     color:'violet' },
    { key:'appr',   label:'Чекає погодження',    color:'amber'  },
    { key:'ship',   label:'Можна відправляти',   color:'cyan'   },
    { key:'sent',   label:'Відправлено',         color:'green', done:true }
  ];
  function prodAt(job, o){
    if(trk(o, 'ship') === 'sent') return 'sent';
    if(trk(o, 'qc') === 'ok') return 'ship';
    /* Фото є, слова менеджера ще немає — окрема колонка, а не «контроль».
       Інакше цех вважає роботу зданою, а вона висить. */
    if(trk(o, 'qc') === 'check') return 'appr';
    if(trk(o, 'qc') === 'bad') return 'qc';
    if(trk(o, 'prod') === 'done') return 'qc';
    if(trk(o, 'prod') === 'work') return 'run';
    if(trk(o, 'prod') === 'ready') return 'ready';
    var sup = trk(o, 'supply');
    if(sup && sup !== 'got') return 'wait';
    return 'new';
  }
  /* Дошка закупівлі. Чотири стани з ТЗ і жодного зайвого: закупникові не
     потрібні ні макети, ні виробництво — йому потрібно знати, що замовити
     й чи приїхало. */
  var SUPPLY = [
    { key:'todo',   label:'Треба замовити',      color:'gray'   },
    { key:'sent',   label:'Замовлено',           color:'blue'   },
    { key:'part',   label:'У дорозі',            color:'amber'  },
    { key:'got',    label:'Отримано',            color:'green', done:true }
  ];
  function supplyAt(o){
    var v = trk(o, 'supply');
    for(var i = 0; i < SUPPLY.length; i++) if(SUPPLY[i].key === v) return v;
    return 'todo';
  }

  var CHAIN = [
    { key:'new',     label:'Нове',           color:'gray'   },
    { key:'design',  label:'Дизайн',         color:'blue'   },
    { key:'client',  label:'У клієнта',      color:'amber'  },
    { key:'stitch',  label:'Вишивка',        color:'violet' },
    { key:'prod',    label:'Виробництво',    color:'cyan'   },
    { key:'qc',      label:'Контроль',       color:'blue'   },
    { key:'ready',   label:'До відправки',   color:'amber'  },
    { key:'shipped', label:'Відправлено',    color:'green', done:true }
  ];
  function trk(o, key){ return String(((o || {}).tracks || {})[key] || ''); }
  function chainAt(job, o){
    if(trk(o, 'ship') === 'sent' || (o && o.ttn && trk(o, 'ship') === 'ttn')) return 'shipped';
    if(trk(o, 'qc') === 'ok') return 'ready';
    if(trk(o, 'qc') === 'check' || trk(o, 'qc') === 'bad' || trk(o, 'prod') === 'done') return 'qc';
    if(trk(o, 'prod') === 'work' || trk(o, 'prod') === 'ready') return 'prod';
    /* Вишивка — це коли графіку вже погодив клієнт, а файли ще не всі
       готові. Саме тут найчастіше й губився час: макет є, на машину нічого
       не пішло, і зовні виглядає, ніби все гаразд. */
    if(job && job.approvedVersion){
      var need = (job.stitch || []).filter(function(x){ return !x.gone; });
      if(need.length && !need.every(function(x){ return x.status === 'ok'; })) return 'stitch';
      return 'prod';
    }
    if(job && job.state === 'client') return 'client';
    if(job && job.state === 'new') return 'new';
    return 'design';
  }
  /* Хто зараз тримає замовлення. Питання «а чиє це» має мати відповідь у
     кожній колонці — інакше воно щодня ставиться вголос. */
  var CHAIN_WHO = {
    new:'акаунт-менеджер', design:'графічний дизайнер', client:'клієнт',
    stitch:'вишивальний дизайнер', prod:'виробництво', qc:'акаунт-менеджер',
    ready:'виробництво', shipped:'—'
  };

  /* ══════════ ДОРУЧЕННЯ ══════════
     Доступами процес не описати. Доступ відповідає на питання «що я бачу»,
     а тут хтось комусь ДАЄ РОБОТУ: у неї є адресат, строк, результат і
     розмова навколо неї.

     Замовлення лишається одне — це факт: клієнт, товар, розміри, історія.
     Доручення — це робота всередині нього, і саме вона лежить на дошках
     виконавців. Дизайнер бачить не «замовлення №1842», а «правку №3» у
     ньому; замовлення під нею — контекст, не задача.

     Найважливіше поле — `closedBy`: чим саме доручення закрили. Не «десь
     зʼявився V3», а «V3 закрив правку №3». Через рік видно не лише що
     робили, а й навіщо.

     Час між станами не рахуємо окремо: він уже є в самих позначках. */
  var TASK_KINDS = [
    { key:'draw',   label:'Намалювати макет',      to:'graphic' },
    { key:'fix',    label:'Правка макета',          to:'graphic' },
    { key:'digit',  label:'Оцифрувати',             to:'stitch'  },
    { key:'refix',  label:'Правка вишивального файлу', to:'stitch' },
    { key:'buy',    label:'Закупити одяг',          to:'supply'  },
    { key:'make',   label:'Пошити тираж',           to:'prod'    },
    { key:'photo',  label:'Фото готової партії',    to:'prod'    }
  ];
  /* Причина повернення — це вимірювання, а не ввічливість. Поки вона живе
     в чаті, питання «де ми найчастіше втрачаємо час» не має відповіді. */
  var TASK_WHY = [
    { key:'client',   label:'Клієнтська правка' },
    { key:'designer', label:'Помилка дизайнера' },
    { key:'tech',     label:'Технічна проблема' },
    { key:'prod',     label:'Помилка виробництва' },
    { key:'brief',    label:'Неповне ТЗ' },
    { key:'other',    label:'Інше' }
  ];
  var TASK_FLOW = [
    { key:'new',      label:'Видано',    color:'gray'   },
    { key:'work',     label:'У роботі',  color:'blue'   },
    { key:'done',     label:'Виконано',  color:'violet' },
    { key:'accepted', label:'Прийнято',  color:'green', done:true },
    { key:'returned', label:'Повернуто', color:'amber'  }
  ];

  /* ТЗ від акаунт-менеджера: текст і референси. Половина переробок
     народжується саме тут — дизайнер малює за неповним ТЗ, а потім усе
     переробляється через розмір або приклад, якого ніхто не показав. */
  function briefSet(job, by, text){
    if(!job) return null;
    if(!job.brief) job.brief = { missing: [], note: '', returnedAt: '', returnedBy: '' };
    job.brief.text = String(text || '').slice(0, 4000);
    ds(job, 'brief-text', { by: by });
    return job;
  }
  function briefPic(job, by, pic){
    if(!job || !pic || !pic.url) return null;
    if(!job.brief) job.brief = {};
    if(!Array.isArray(job.brief.pics)) job.brief.pics = [];
    if(job.brief.pics.length >= 12) return null;     // дюжини прикладів вистачить будь-кому
    job.brief.pics.push({ name: String(pic.name || ''), url: String(pic.url) });
    ds(job, 'brief-pic', { by: by });
    return job;
  }
  function briefPicDel(job, i){
    if(!job || !job.brief || !Array.isArray(job.brief.pics)) return null;
    job.brief.pics.splice(i, 1);
    return job;
  }

  function taskList(job){
    if(!job) return [];
    if(!Array.isArray(job.tasks)) job.tasks = [];
    return job.tasks;
  }
  function taskAt(job, n){
    var list = taskList(job);
    for(var i = 0; i < list.length; i++) if(list[i].n === +n) return list[i];
    return null;
  }
  function taskKind(key){
    for(var i = 0; i < TASK_KINDS.length; i++) if(TASK_KINDS[i].key === key) return TASK_KINDS[i];
    return null;
  }
  /* Видати доручення. Без адресата не видаємо: «відділ» — не людина, і
     питати з відділу нема з кого. Без тексту теж: доручення, зміст якого
     треба вгадувати, повернеться правкою. */
  function taskAdd(job, o, by, opts){
    opts = opts || {};
    var kind = taskKind(opts.kind);
    if(!kind) return null;
    if(!opts.to) return null;
    var txt = String(opts.text || '').trim();
    if(!txt && kind.key !== 'digit' && kind.key !== 'buy' && kind.key !== 'make') return null;
    var list = taskList(job);
    var n = 0;
    list.forEach(function(t){ if(t.n > n) n = t.n; });
    var t = {
      n: n + 1, kind: kind.key, role: kind.to,
      to: String(opts.to || ''), by: String(by || ''),
      at: nowIso(), due: String(opts.due || ''),
      why: String(opts.why || ''),
      text: txt, files: (opts.files || []).slice(0, 8),
      ver: +opts.ver || 0,
      state: 'new', thread: [],
      startedAt: '', doneAt: '', closedAt: '', closedBy: ''
    };
    list.push(t);
    ds(job, 'task-add', { n: t.n, kind: t.kind, to: t.to, by: by, why: t.why || undefined });
    return t;
  }
  /* Узяв у роботу. Окремий стан, а не дрібниця: різниця між «лежить у
     черзі» і «людина сидить над цим» — це вся відповідь на питання, чому
     замовлення стоїть. */
  function taskStart(job, n, by){
    var t = taskAt(job, n);
    if(!t || (t.state !== 'new' && t.state !== 'returned')) return null;
    t.state = 'work';
    if(!t.startedAt) t.startedAt = nowIso();
    ds(job, 'task-start', { n: t.n, by: by });
    return t;
  }
  /* Виконав. `closedBy` — те, чим закрили: версія макета, файл, фото.
     Без нього доручення закривається словом «готово», яке ні до чого не
     привʼязане. */
  function taskDone(job, n, by, closedBy){
    var t = taskAt(job, n);
    if(!t || (t.state !== 'work' && t.state !== 'new' && t.state !== 'returned')) return null;
    t.state = 'done';
    t.doneAt = nowIso();
    t.closedBy = String(closedBy || '');
    ds(job, 'task-done', { n: t.n, by: by, closedBy: t.closedBy || undefined });
    return t;
  }
  function taskAccept(job, n, by){
    var t = taskAt(job, n);
    if(!t || t.state !== 'done') return null;
    t.state = 'accepted';
    t.closedAt = nowIso();
    ds(job, 'task-accept', { n: t.n, by: by });
    return t;
  }
  /* Повернути. Причина обовʼязкова — інакше повернення не відрізнити від
     «просто не сподобалось», і в аналітиці такий запис нічого не важить. */
  function taskReturn(job, n, by, why, note){
    var t = taskAt(job, n);
    if(!t || t.state !== 'done') return null;
    if(!why) return null;
    t.state = 'returned';
    t.why = String(why);
    t.doneAt = '';
    taskSay(job, n, by, String(note || ''), true);
    ds(job, 'task-return', { n: t.n, by: by, why: t.why });
    return t;
  }
  /* Розмова всередині доручення. Саме тут виконавець перепитує — і саме
     через це доручення перестає бути листом без відповіді. */
  /* Вкладення до доручення. Скріншот пояснює правку краще за абзац тексту,
     і саме через його відсутність половина правок поверталась уточненням. */
  function taskFile(job, n, by, file){
    var t = taskAt(job, n);
    if(!t || !file || !file.url) return null;
    if(!Array.isArray(t.files)) t.files = [];
    if(t.files.length >= 8) return null;
    t.files.push({ name: String(file.name || ''), url: String(file.url) });
    ds(job, 'task-file', { n: t.n, by: by });
    return t;
  }
  function taskSay(job, n, by, text, quiet){
    var t = taskAt(job, n);
    if(!t) return null;
    var txt = String(text || '').trim();
    if(!txt) return null;
    if(!Array.isArray(t.thread)) t.thread = [];
    t.thread.push({ by: String(by || ''), at: nowIso(), t: txt });
    if(t.thread.length > 200) t.thread = t.thread.slice(-200);
    if(!quiet) ds(job, 'task-say', { n: t.n, by: by });
    return t;
  }
  /* Скільки доручення лежить у виконавця. Це і є SLA: рахувати окремо
     нема чого, позначки вже стоять. */
  function taskAge(t, now){
    if(!t) return 0;
    var from = t.startedAt || t.at;
    var to = t.closedAt || t.doneAt || now || nowIso();
    var a = Date.parse(from), b = Date.parse(to);
    return (isFinite(a) && isFinite(b) && b > a) ? Math.round((b - a) / 60000) : 0;
  }
  function taskOpen(job){
    return taskList(job).filter(function(t){ return t.state !== 'accepted'; });
  }
  /* Доручення однієї людини. Пошта, а не роль: питають із людини. */
  function tasksOf(job, email){
    var e = String(email || '').trim().toLowerCase();
    if(!e) return [];
    return taskList(job).filter(function(t){
      return String(t.to || '').trim().toLowerCase() === e;
    });
  }

  function stepLabel(list, key){
    for(var i = 0; i < list.length; i++) if(list[i].key === key) return list[i].label;
    return key || '';
  }
  function reasonLabel(list, key){
    for(var i = 0; i < list.length; i++) if(list[i].key === key) return list[i].label;
    return key || '';
  }
  function nowIso(){ return new Date().toISOString(); }

  /* ══════════ ЗАДАЧА ══════════ */
  function emptyJob(orderId){
    return {
      orderId: String(orderId || ''),
      createdAt: nowIso(), updatedAt: nowIso(),
      state: 'new',
      /* ТЗ живе тут, а не в картці замовлення: у картці лежить те, що
         ПРОДАЛИ, а тут — те, що треба НАМАЛЮВАТИ. Це різні речі, і
         зливати їх в одне поле означає щоразу вгадувати, котре з них
         правильне. Картинки — посиланнями, самі файли в хмарі. */
      brief: { missing: [], note: '', returnedAt: '', returnedBy: '',
               text: '', pics: [] },
      /* Версій тут немає навмисно: вони живуть у замовленні. Тут — стан,
         відповідальний, строк і причини повернень. */
      graphic: { status:'new', assignee:'', due:'', events: [] },
      client: { sentAt:'', sentBy:'', decidedAt:'', decision:'', reasons:[], note:'', version:0 },
      approvedVersion: 0,
      stitch: [],
      /* Доручення — робота всередині замовлення. Див. блок ДОРУЧЕННЯ. */
      tasks: [],
      pack: null,
      ds: []
    };
  }

  /* Які нанесення треба оцифрувати. Найдрібніша одиниця — ОДНЕ НАНЕСЕННЯ:
     виріб плюс сторона. Перед і спина — це два різні файли, два різні
     stitch count і два різні розміри, і QA перевіряє їх окремо. Робити
     задачу «на позицію» означало б вести всередині неї список файлів
     руками — тобто повернути ту саму плутанину, від якої йдемо. */
  function stitchKeys(order){
    var out = [];
    (order && order.items || []).forEach(function(it, i){
      var kind = it.kind || 'main';
      if(kind === 'reco') return;               // клієнт іще не додав
      (it.prints || []).forEach(function(p, k){
        if(!isEmbro(it, p)) return;
        out.push({
          key: i + ':' + (p.side || ('p' + k)),
          itemIdx: i, side: p.side || '', k: k,
          label: (p.sideLabel || p.side || 'Нанесення'),
          name: it.name || '', color: it.color || '',
          garment: it.garmentId || '',
          qty: +it.qty || 0,
          mm: { w: Math.round(+p.widthMm || 0), h: Math.round(+p.heightMm || 0) },
          mark: p.mark || null,
          file: p.file || ''
        });
      });
    });
    return out;
  }
  /* Вишивка це чи друк. Дивимось спершу в саме нанесення, потім у розклад
     позиції: у старих позицій техніки на нанесенні немає, а метод у
     розкладі є завжди. */
  function isEmbro(it, p){
    var t = String((p && p.technique) || '');
    if(t) return /ишив|embro/i.test(t);
    var m = (it && it.desc && it.desc.method) || (it && it.calc && it.calc.method) || '';
    if(m) return m === 'embro';
    return /ишив/i.test(String((it && it.print) || ''));
  }
  function needsStitch(order){ return stitchKeys(order).length > 0; }

  /* Добудувати задачу під поточний склад замовлення. Склад живий: менеджер
     додає позицію, міняє сторону нанесення, прибирає виріб. Задачі
     оцифрування мусять іти за ним — але вже зроблену роботу чіпати не
     можна, тож наявні картки лишаються, а зниклі позначаються, а не
     видаляються: файл, за який заплатили, не має зникати з історії. */
  function ensure(job, order){
    if(!job) job = emptyJob(order && order.orderId);
    /* Задача, заведена до появи доручень, приходить без цього поля. Краще
       дописати його тут, ніж класти `job.tasks || []` у двадцяти місцях. */
    if(!Array.isArray(job.tasks)) job.tasks = [];
    /* Склад замовлення відділу. Заводиться руками й живе ТУТ, а не в
       картці Канбану: у Канбані лежить те, що ПРОДАЛИ, а тут те, що треба
       ЗРОБИТИ, і це різні списки. Клієнт купив двадцять худі — а зробити
       треба десять чорних із вишивкою спереду й десять бежевих із друком
       на спині; розкласти це в картці продажу нема куди. */
    if(!Array.isArray(job.units)) job.units = [];
    var want = stitchKeys(order), by = {};
    (job.stitch || []).forEach(function(s){ by[s.key] = s; });
    var out = [];
    want.forEach(function(w){
      var s = by[w.key];
      if(!s){
        s = { key:w.key, status:'wait', assignee:'', outsource:'',
              files:[], preview:'', stitches:0, colors:[], notes:'',
              versions:[], gone:false,
              qa:{ status:'', by:'', at:'', checks:{}, reasons:[], note:'' } };
      }
      s.gone = false;
      s.itemIdx = w.itemIdx; s.side = w.side; s.label = w.label;
      s.name = w.name; s.color = w.color; s.garment = w.garment;
      s.qty = w.qty; s.mm = w.mm; s.mark = w.mark; s.srcFile = w.file;
      out.push(s);
      delete by[w.key];
    });
    // те, чого в складі більше немає, але робота по ньому вже була
    Object.keys(by).forEach(function(k){
      var s = by[k];
      if((s.files || []).length || s.status !== 'wait'){ s.gone = true; out.push(s); }
    });
    job.stitch = out;
    return job;
  }

  /* Чого бракує в ТЗ. Список, а не «так/ні»: менеджер має бачити, що саме
     дописати, інакше повернення до продажника перетворюється на листування
     «а що не так». */
  function briefMissing(order){
    return BRIEF.filter(function(b){
      try{ return !b.has(order || {}); }catch(e){ return false; }
    }).map(function(b){ return { key:b.key, label:b.label }; });
  }

  /* ══════════ DATASET ══════════
     Пишеться сам, на кожному кроці. Цінність не в «PNG → DST», а в тому,
     ЩО САМЕ виправила людина й ЧОМУ: вхідні дані, результат автоматики,
     правка дизайнера з причиною, правка менеджера з причиною, правка
     клієнта з причиною, погоджена графіка, файл вишивки, правки QA і те,
     що врешті пішло на машину.

     Лишається списком у задачі: він короткий (рядок на подію) і читається
     як історія. Файли тут посиланнями — самі файли живуть у хмарі. */
  function ds(job, step, data){
    if(!job) return job;
    if(!Array.isArray(job.ds)) job.ds = [];
    var rec = { at: nowIso(), step: String(step || '') };
    Object.keys(data || {}).forEach(function(k){
      var v = data[k];
      if(v === undefined || v === null || v === '') return;
      if(Array.isArray(v) && !v.length) return;
      rec[k] = v;
    });
    job.ds.push(rec);
    if(job.ds.length > 400) job.ds = job.ds.slice(-400);
    job.updatedAt = rec.at;
    return job;
  }

  /* ══════════ ВЕРСІЇ ══════════
     Версія не редагується. Не сподобалось — зʼявляється наступна, а
     попередня лишається назавжди з причиною, через яку її повернули.
     Погоджена замикається: після «клієнт погодив» переписати той файл,
     який він бачив, не можна ніяк.

     ЖИВУТЬ ВОНИ В ЗАМОВЛЕННІ (`order.art`), а не в задачі відділу. Спокуса
     була покласти їх сюди — задача ж про макет. Але список версій уже є в
     картці замовлення, його бачить і виробництво, і сторінка клієнта. Дві
     копії того самого списку рано чи пізно розійдуться, і питання «яку
     версію погодили» знову матиме дві відповіді.

     Тому поділ такий: версії — у замовленні, СТАН і ПРИЧИНИ — у задачі.
     Кожне з двох місць відповідає рівно за те, чого немає в іншому. */
  function artOf(o){
    if(!o) return [];
    if(!Array.isArray(o.art)) o.art = [];
    return o.art;
  }
  function verNew(o, job, by, opts){
    opts = opts || {};
    var l = artOf(o);
    var n = l.length ? (+l[l.length - 1].n || l.length) + 1 : 1;
    /* Форма та сама, що в картці замовлення, — інакше старий блок перестав
       би розуміти власні дані. Нове поле тут одне: чи зробила версію
       автоматика. Саме воно потім і відділяє «що запропонував AI» від
       «що з цього лишила людина». */
    var v = { n:n, at: nowIso(), by: by || '', files: [], wilcom:'', photo:'',
              approvals: {}, ai: !!opts.ai, note: String(opts.note || '') };
    l.push(v);
    ds(job, 'graphic-version', { n:n, by:by, ai: opts.ai ? true : undefined });
    return v;
  }
  function verCur(o){
    var l = artOf(o);
    return l.length ? l[l.length - 1] : null;
  }
  function verAt(o, n){
    var l = artOf(o);
    for(var i = 0; i < l.length; i++) if(+l[i].n === +n) return l[i];
    return null;
  }
  // Погоджену клієнтом версію більше не переписати — саме на цьому й
  // трималась уся плутанина з «остаточний_фінал2»
  function verLocked(v){ return !!(v && v.approvals && v.approvals.client); }

  /* ══════════ ПЕРЕХОДИ ══════════
     Кожен перехід — в одному місці. Розкидані по кнопках, вони рано чи
     пізно розходяться: одна кнопка рухає трек, друга забуває, і стан
     замовлення залежить від того, звідки натиснули. */

  // Менеджер відділу перевірив ТЗ і віддав у роботу
  function assign(job, order, who, by, due){
    job.brief.missing = briefMissing(order);
    job.graphic.assignee = who || '';
    job.graphic.due = due || '';
    job.graphic.status = 'new';
    job.state = 'assigned';
    ds(job, 'assigned', { by:by, to:who, missing: job.brief.missing.map(function(m){ return m.key; }) });
    return job;
  }
  // Повернути продажникові: ТЗ неповне
  function backToSales(job, order, by, note){
    job.brief.missing = briefMissing(order);
    job.brief.note = String(note || '');
    job.brief.returnedAt = nowIso();
    job.brief.returnedBy = by || '';
    job.state = 'check';
    ds(job, 'brief-back', { by:by, note:note,
        missing: job.brief.missing.map(function(m){ return m.key; }) });
    return job;
  }
  function designStart(job, by){
    job.graphic.status = 'work';
    job.state = 'design';
    ds(job, 'design-start', { by:by });
    return job;
  }
  // Дизайнер віддає на перевірку — НЕ клієнту
  function toReview(job, o, by){
    job.graphic.status = 'review';
    job.state = 'review';
    ds(job, 'to-review', { by:by, n: (verCur(o) || {}).n });
    return job;
  }
  /* Менеджер повертає на правки. Причина обовʼязкова: без неї повернення
     не відрізнити від «просто не сподобалось», і в аналітиці такий запис
     нічого не важить. */
  function revise(job, o, by, reasons, note, forDesign){
    if(!reasons || !reasons.length) return null;
    job.graphic.status = 'revision';
    job.state = 'design';
    var ev = { kind:'revision', by:by || '', at: nowIso(),
               reasons: reasons.slice(), note: String(note || ''),
               n: (verCur(o) || {}).n || 0,
               design: String(forDesign || '') };
    (job.graphic.events || (job.graphic.events = [])).push(ev);
    ds(job, 'manager-revision', { by:by, reasons: reasons.slice(), note:note,
        n: ev.n, design: ev.design || undefined });
    return job;
  }
  // Менеджер погодив — тільки тепер макет можна показувати клієнту
  function mgrApprove(job, o, by){
    var v = verCur(o);
    if(!v) return null;
    job.graphic.status = 'done';
    job.state = 'review';
    /* Позначка лягає в ту саму мапу погоджень, що й раніше: картку
       замовлення ніхто не переписував, і вона має показувати те саме. */
    if(!v.approvals || typeof v.approvals !== 'object') v.approvals = {};
    v.approvals.art = { by: by || '', at: nowIso(), note:'' };
    ds(job, 'manager-approve', { by:by, n:v.n });
    return job;
  }
  function sendToClient(job, o, by){
    var v = verCur(o);
    if(!v || !(v.approvals && v.approvals.art)) return null;   // повз менеджера не йде
    job.state = 'client';
    job.client.sentAt = nowIso();
    job.client.sentBy = by || '';
    job.client.version = v.n;
    job.client.decision = '';
    job.client.reasons = [];
    ds(job, 'to-client', { by:by, n:v.n });
    return job;
  }
  function clientApprove(job, o, by, note){
    var n = job.client.version || (verCur(o) || {}).n || 0;
    var v = verAt(o, n);
    if(!v) return null;
    if(!v.approvals || typeof v.approvals !== 'object') v.approvals = {};
    // Цією ж позначкою версія й замикається: verLocked дивиться саме на неї
    v.approvals.client = { by: by || '', at: nowIso(), note: String(note || '') };
    job.approvedVersion = n;
    job.client.decision = 'approved';
    job.client.decidedAt = nowIso();
    job.client.note = String(note || '');
    job.state = 'approved';
    job.graphic.status = 'done';
    ds(job, 'client-approve', { by:by, n:n, note:note });
    return job;
  }
  function clientChanges(job, by, reasons, note){
    if(!reasons || !reasons.length) return null;
    job.client.decision = 'changes';
    job.client.decidedAt = nowIso();
    job.client.reasons = reasons.slice();
    job.client.note = String(note || '');
    job.graphic.status = 'revision';
    job.state = 'design';
    (job.graphic.events || (job.graphic.events = [])).push({
      kind:'client', by: by || '', at: nowIso(),
      reasons: reasons.slice(), note: String(note || ''),
      n: job.client.version || 0 });
    ds(job, 'client-changes', { by:by, reasons: reasons.slice(), note:note,
        n: job.client.version || 0 });
    return job;
  }

  /* ── Оцифрування ──────────────────────────────────────────────────── */
  function stitchAt(job, key){
    var l = (job && job.stitch) || [];
    for(var i = 0; i < l.length; i++) if(l[i].key === key) return l[i];
    return null;
  }
  /* Оцифрування починається тільки з погодженої графіки. Інакше вишивають
     макет, який клієнт іще не бачив, — і переоцифровують після першої ж
     правки. Саме це й треба було припинити. */
  function stitchOpen(job){ return !!job && job.approvedVersion > 0; }
  function stitchAssign(job, key, who, by, outsource){
    var s = stitchAt(job, key); if(!s) return null;
    if(!stitchOpen(job)) return null;
    s.assignee = who || '';
    s.outsource = String(outsource || '');
    s.status = 'digit';
    ds(job, 'stitch-assign', { key:key, by:by, to:who, outsource: outsource || undefined });
    return job;
  }
  /* Кожна здача файлу — ВЕРСІЯ, і попередня нікуди не дівається.

     Доти вишивальний файл був один: правка перезаписувала його, і питання
     «а що саме змінили після повернення» лишалось без відповіді. У макета
     версії є з самого початку, і саме вони закривають половину суперечок;
     у стібках вони потрібні ще більше, бо там правку видно не оком, а
     машиною.

     Версію робимо саме на здачі, а не на завантаженні файлу: поки людина
     довантажує другий формат, це та сама робота, а не нова. */
  function stitchReady(job, key, by){
    var s = stitchAt(job, key); if(!s) return null;
    if(!(s.files || []).length) return null;     // «готово» без файлу — не готово
    if(!Array.isArray(s.versions)) s.versions = [];
    var back = (s.qa && s.qa.status === 'back') ? (s.qa.reasons || []).slice() : [];
    s.versions.push({
      n: s.versions.length + 1, at: nowIso(), by: by || '',
      files: (s.files || []).map(function(f){ return { name:f.name || '', url:f.url || '' }; }),
      preview: s.preview || '', stitches: +s.stitches || 0,
      /* Чому зʼявилась саме ця версія — тобто за що повернули попередню.
         Без цього список версій каже, ЩО робили, і мовчить про навіщо. */
      why: back, ok: false
    });
    s.ver = s.versions.length;
    s.status = 'qa';
    s.qa.status = '';
    ds(job, 'stitch-ready', { key:key, by:by, n: s.ver,
                              stitches: s.stitches || undefined });
    return job;
  }
  function stitchVers(job, key){
    var s = stitchAt(job, key);
    return (s && Array.isArray(s.versions)) ? s.versions : [];
  }
  function qaPass(job, key, by, checks){
    var s = stitchAt(job, key); if(!s) return null;
    var miss = QA_CHECKS.filter(function(c){ return !(checks || {})[c.key]; });
    if(miss.length) return { miss: miss };        // чекліст неповний — не пропускаємо
    s.qa = { status:'ok', by: by || '', at: nowIso(), checks: checks, reasons: [], note:'' };
    s.status = 'ok';
    /* Погоджена версія позначається назавжди: наступна правка заведе нову,
       а цю вже ніхто не перепише мовчки. */
    var vs = s.versions || [];
    if(vs.length) vs[vs.length - 1].ok = true;
    ds(job, 'qa-pass', { key:key, by:by, n: vs.length || undefined });
    return job;
  }
  function qaBack(job, key, by, reasons, note){
    var s = stitchAt(job, key); if(!s) return null;
    if(!reasons || !reasons.length) return null;
    s.qa = { status:'back', by: by || '', at: nowIso(), checks: s.qa && s.qa.checks || {},
             reasons: reasons.slice(), note: String(note || '') };
    s.status = 'revision';
    ds(job, 'qa-back', { key:key, by:by, reasons: reasons.slice(), note:note });
    return job;
  }

  /* ══════════ ПАКЕТ У ВИРОБНИЦТВО ══════════
     Збирається сам із того, що вже погоджене. Нічого не вигадує: якщо
     чогось бракує, воно чесно перелічене, а не підставлене мовчки. */
  function packReady(job, order){
    var why = [];
    if(!job || !job.approvedVersion) why.push('клієнт іще не погодив макет');
    var need = (job && job.stitch || []).filter(function(s){ return !s.gone; });
    var bad = need.filter(function(s){ return s.status !== 'ok'; });
    if(bad.length) why.push('оцифрування не пройшло перевірку: ' +
      bad.map(function(s){ return s.name + ' · ' + s.label; }).join(', '));
    return { ok: !why.length, why: why };
  }
  function pack(job, order){
    var v = verAt(order, job.approvedVersion);
    return {
      orderId: (order && order.orderId) || job.orderId,
      at: nowIso(),
      mockup: v ? (v.preview || '') : '',
      version: job.approvedVersion,
      /* Рекомендовані в пакет не йдуть: клієнт їх іще не додав, і шити їх
         ніхто не збирається. Побачити їх у завданні на виробництво — це
         рівно та помилка, через яку шиють зайве. */
      items: (order && order.items || []).filter(function(it){
        return (it.kind || 'main') !== 'reco';
      }).map(function(it){
        var i = (order.items || []).indexOf(it);
        /* Нанесення вишивки беремо з задач оцифрування — там файл, стібки й
           кольори ниток. А друк звідти не візьмеш: його не оцифровують, у
           нього просто є файл. Без цього рядка виробництво отримувало
           позицію з друком порожньою — «шийте, а що ставити, здогадайтесь». */
        var emb = (job.stitch || []).filter(function(s){
          return s.itemIdx === i && !s.gone;
        }).map(function(s){
          return { side: s.side, label: s.label, method:'embro', mm: s.mm,
                   mark: s.mark || null,
                   files: (s.files || []).slice(), preview: s.preview || '',
                   stitches: +s.stitches || 0, colors: (s.colors || []).slice(),
                   notes: s.notes || '' };
        });
        var print = (it.prints || []).filter(function(p){ return !isEmbro(it, p); })
          .map(function(p){
            return { side: p.side || '', label: p.sideLabel || p.side || 'Нанесення',
                     method:'print',
                     mm: { w: Math.round(+p.widthMm || 0), h: Math.round(+p.heightMm || 0) },
                     mark: p.mark || null,
                     files: p.file ? [{ kind:'print', name:'друк', url:p.file }] : [],
                     preview:'', stitches:0, colors: [], notes:'' };
          });
        return {
          idx: i, name: it.name || '', color: it.color || '',
          garment: it.garmentId || '', sizes: it.sizes || '', qty: +it.qty || 0,
          places: emb.concat(print)
        };
      }).filter(function(x){ return x.qty > 0 || x.places.length; })
    };
  }

  /* ── Дзеркало в Канбані ──────────────────────────────────────────────
     Продажник має бачити, де замовлення, не заходячи у відділ. Але КЕРУЄ
     станом відділ: трек лише відображає. Два місця, де стан правлять, —
     це рано чи пізно два різні стани. */
  var MIRROR = {
    new:'new', check:'new', assigned:'new',
    design:'work', review:'check', client:'check', approved:'ok'
  };
  function mirror(job){
    if(!job) return '';
    if(job.graphic && job.graphic.status === 'revision') return 'fix';
    return MIRROR[job.state] || 'new';
  }

  /* Короткий рядок стану для картки замовлення: де саме зараз дизайн. */
  function stateLine(job){
    if(!job) return '';
    var s = stepLabel(QUEUE, job.state);
    if(job.state === 'approved'){
      var n = (job.stitch || []).filter(function(x){ return !x.gone; });
      if(n.length){
        var ok = n.filter(function(x){ return x.status === 'ok'; }).length;
        return ok === n.length ? 'Готово до виробництва'
                               : ('Оцифрування ' + ok + ' з ' + n.length);
      }
    }
    return s;
  }

  window.LQDesign = {
    QUEUE: QUEUE, GRAPHIC: GRAPHIC, STITCH: STITCH,
    MGR_REASONS: MGR_REASONS, CLIENT_REASONS: CLIENT_REASONS,
    QA_REASONS: QA_REASONS, QA_CHECKS: QA_CHECKS, BRIEF: BRIEF,
    TAKE_LIMIT: TAKE_LIMIT, loadOf: loadOf, takeSelf: takeSelf,
    CHAIN: CHAIN, CHAIN_WHO: CHAIN_WHO, chainAt: chainAt,
    PROD: PROD, prodAt: prodAt, SUPPLY: SUPPLY, supplyAt: supplyAt,
    TASK_KINDS: TASK_KINDS, TASK_WHY: TASK_WHY, TASK_FLOW: TASK_FLOW,
    taskList: taskList, taskAt: taskAt, taskAdd: taskAdd, taskStart: taskStart,
    taskDone: taskDone, taskAccept: taskAccept, taskReturn: taskReturn,
    taskSay: taskSay, taskAge: taskAge, taskOpen: taskOpen, tasksOf: tasksOf,
    taskFile: taskFile,
    briefSet: briefSet, briefPic: briefPic, briefPicDel: briefPicDel,
    emptyJob: emptyJob, ensure: ensure, stitchKeys: stitchKeys,
    needsStitch: needsStitch, briefMissing: briefMissing,
    ds: ds, verNew: verNew, verCur: verCur, verAt: verAt, verLocked: verLocked,
    assign: assign, backToSales: backToSales, designStart: designStart,
    toReview: toReview, revise: revise, mgrApprove: mgrApprove,
    sendToClient: sendToClient, clientApprove: clientApprove,
    clientChanges: clientChanges,
    stitchAt: stitchAt, stitchOpen: stitchOpen, stitchAssign: stitchAssign,
    stitchVers: stitchVers,
    stitchReady: stitchReady, qaPass: qaPass, qaBack: qaBack,
    packReady: packReady, pack: pack,
    mirror: mirror, stateLine: stateLine,
    stepLabel: stepLabel, reasonLabel: reasonLabel
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   ЕКРАНИ ДИЗАЙН-ВІДДІЛУ

   П'ять дощок, і кожна відповідає одній людині на одне питання «що мені
   робити зараз». Менеджер відділу бачить чергу, дизайнер — свої макети,
   оцифрувальник — свої нанесення, QA — файли на перевірку, виробництво —
   зібрані пакети.

   Дані беруться з моделі вище, збереження — через host: сам модуль нічого
   не знає ні про Firestore, ні про адмінку. Так його можна перевірити без
   бази й показати з будь-якої сторінки.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var D = window.LQDesign;
  var host = {};
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function me(){ return (host.me && host.me()) || ''; }
  /* Що показувати як картинку версії. Скрін із Wilcom — головний: саме його
     дизайнер і надсилає. Фото відшиву запасне: воно зʼявляється пізніше. */
  function verPic(v){ return (v && (v.wilcom || v.photo)) || ''; }
  function nameOf(e){ return (host.name && host.name(e)) || e || '—'; }
  function say(m){ if(host.toast) host.toast(m); }
  function dt(s){
    if(!s) return '';
    var d = new Date(s);
    if(isNaN(d)) return '';
    return d.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit' });
  }

  /* ══════════ П'ЯТЬ РОЛЕЙ, П'ЯТЬ ДОШОК ══════════
     Відділ — це не набір екранів, між якими людина обирає. Це п'ять місць
     роботи, і в кожного своя дошка з його етапами. Людина заходить одразу
     на свою: обирати їй нема з чого й не треба.

     Вкладок «Доручення», «Замовлення», «Черга», «Макети» більше немає.
     Розкладати ту саму роботу на кілька екранів означало щоразу питати
     себе, у якому з них дивитись, — а відповідь одна: у своєму.

     Доручення нікуди не поділись, вони переїхали ВСЕРЕДИНУ КАРТКИ. На
     дошці стоїть замовлення, а що з ним робити — написано в ньому.

     Контролю окремою роллю немає навмисно: перевіряє акаунт-менеджер, це
     колонка на його дошці. Він же вирішує, віддавати клієнту чи повертати
     на правку, — на клієнта відправку ми не передаємо. */
  var ROLES = [
    { key:'acct',    label:'Акаунт-менеджер',      role:'designmgr'  },
    { key:'graphic', label:'Графічний дизайнер',   role:'designer'   },
    { key:'stitch',  label:'Вишивальний дизайнер', role:'embroidery' },
    { key:'prod',    label:'Виробництво',          role:'production' },
    { key:'supply',  label:'Закупівля',            role:'supply'     }
  ];
  /* Чия це роль з точки зору прав. Власник і керівник бачать усе й
     перемикаються вручну; решта прив'язана до своєї. */
  function roleSeat(r){
    for(var i = 0; i < ROLES.length; i++) if(ROLES[i].role === r) return ROLES[i].key;
    return '';
  }
  function isBoss(r){ return !r || r === 'owner' || r === 'manager' || r === 'designmgr'; }
  var tab = 'acct', openKey = '';

  /* Пари «задача + замовлення». Замовлення лишається джерелом складу, задача
     — джерелом стану: ані те, ані те окремо не відповідає на питання, що з
     цим замовленням робити. */
  function pairs(){
    var out = [];
    (host.orders ? host.orders() : []).forEach(function(o){
      if(!o || !o.orderId) return;
      var job = host.job ? host.job(o.orderId) : null;
      if(!job) return;
      out.push({ o:o, job:job });
    });
    return out;
  }
  function pairOf(orderId){
    var l = pairs();
    for(var i = 0; i < l.length; i++) if(l[i].o.orderId === orderId) return l[i];
    return null;
  }

  /* Доручення на дошку. Виконавцю — тільки свої: чужа робота на власній
     дошці означає щоденне «а це не моє». Менеджеру відділу — усі, бо його
     робота саме в тому, щоб бачити, де що стоїть. */
  function taskCards(all){
    var mine = String(me() || '').trim().toLowerCase();
    var out = [];
    pairs().forEach(function(pr){
      D.taskList(pr.job).forEach(function(t){
        if(!all && String(t.to || '').trim().toLowerCase() !== mine) return;
        var k = D.TASK_KINDS.filter(function(x){ return x.key === t.kind; })[0];
        var age = D.taskAge(t);
        out.push({
          id: pr.o.orderId + '|t' + t.n,
          step: t.state,
          title: (k ? k.label : t.kind) + ' №' + t.n,
          sub: jobNo(pr.job) + (t.due ? ' · до ' + t.due : ''),
          foot: (all ? nameOf(t.to) : '') +
                (age ? (all ? ' · ' : '') + hm(age) : '')
        });
      });
    });
    return out;
  }
  function hm(min){
    if(min < 60) return min + ' хв';
    var h = Math.floor(min / 60), m2 = min % 60;
    if(h < 24) return h + ' год' + (m2 ? ' ' + m2 + ' хв' : '');
    return Math.floor(h / 24) + ' дн ' + (h % 24) + ' год';
  }

  /* ── Дошка ─────────────────────────────────────────────────────────── */
  function boardHtml(steps, cards){
    return '<div class="dz-board">' + steps.map(function(s){
      var mine = cards.filter(function(c){ return c.step === s.key; });
      return '<div class="dz-col" data-col="' + esc(s.key) + '">' +
        '<div class="dz-col-h"><span class="dz-dot is-' + esc(s.color) + '"></span>' +
          esc(s.label) + '<i>' + mine.length + '</i></div>' +
        '<div class="dz-col-b">' +
          (mine.length ? mine.map(function(c){
            return '<button class="dz-card' + (c.id === openKey ? ' on' : '') +
                   '" data-open="' + esc(c.id) + '">' +
              '<b>' + esc(c.title) + '</b>' +
              (c.sub ? '<span>' + esc(c.sub) + '</span>' : '') +
              (c.foot ? '<i>' + esc(c.foot) + '</i>' : '') +
            '</button>';
          }).join('') : '<div class="dz-empty">порожньо</div>') +
        '</div></div>';
    }).join('') + '</div>';
  }

  /* ── Вхідні дані задачі: те, що дизайнер має бачити, і нічого зайвого ── */
  /* Номер, під яким замовлення живе У ВІДДІЛІ. Номер замовлення сюди не
     потрапляє взагалі: там свій рахунок — продаж, КП, платіжка, — а тут
     свій, про макет. Показувати перший там, де живе другий, означає щодня
     питати, про що саме зараз мова.

     Поки номера немає (стара задача, заведена до цього правила), не
     вигадуємо його на льоту й не підставляємо чужий: пишемо риску. Номер
     видасть робоче місце, один раз і назавжди. */
  function jobNo(job){
    var n = job && job.no;
    return n ? ('#' + n) : '#—';
  }

  /* ── Клієнт і строк: перше, що має бути в картці ────────────────────
     Доти цього в картці не було зовсім: замовлення позначалось номером, а
     кому воно й до якого числа — питали в менеджера. Номер не відповідає
     ні на те, ні на те. */
  /* Клієнт у шапці картки.

     Поля беремо З ОБОХ МІСЦЬ. Тут стояло тільки `o.client.name`, а в
     картці Канбану імʼя, телефон і компанія лежать прямо в замовленні —
     `o.name`, `o.phone`, `o.company`. Через це блок мовчки не малювався
     ніколи: відділ показував номер і стан, а чиє це замовлення, треба
     було йти дивитись у Канбан. Саме тому картка й виглядала голою. */
  function clientHtml(o, job){
    o = o || {};
    var c = o.client || {};
    var name = c.name || o.name || '';
    var comp = c.company || o.company || '';
    var tel  = c.phone || o.phone || '';
    var who = [name, comp].filter(Boolean).join(' · ');
    var bits = [];
    if(who) bits.push('<b>' + esc(who) + '</b>');
    if(tel) bits.push('<a href="tel:' + esc(String(tel).replace(/\s+/g, '')) + '">' +
                      esc(tel) + '</a>');
    var due = (job && job.due) || o.dueAt || o.dueDate || ((o.terms || {}).deadline) || '';
    if(due) bits.push('до ' + esc(due));
    if(!bits.length) return '';
    return '<div class="dz-who">' + bits.join('<span class="dz-sep">·</span>') + '</div>';
  }
  /* ── Що зробити мені ────────────────────────────────────────────────
     Доручення жили окремою дошкою, і виконавець мусив тримати в голові
     два екрани: що робити — там, чим робити — тут. Тепер завдання лежить
     у самій картці замовлення, поруч із усім іншим.

     Показуємо ОДНЕ, поточне. Андрій: «якщо дві правки, одне замовлення —
     просто та правка ховається в історію, і з'являється нова». Так і
     зроблено: попередні складені під рядок, який їх розгортає. */
  var SEAT_TASK = { graphic:'graphic', stitch:'stitch', prod:'prod', supply:'supply' };

  /* ══════════ СКЛАД ЗАМОВЛЕННЯ: ОДЯГ І ДИЗАЙНИ ══════════════════════════
     Що тут лежить і чому саме тут.

     У картці Канбану лежить те, що ПРОДАЛИ: двадцять худі за такою ціною.
     Виробництву цього замало — йому треба знати, що саме шити: десять
     чорних M із вишивкою спереду, десять бежевих L із друком на спині.
     Розкласти це в картці продажу нема куди, і доти воно жило в голові
     менеджера й у листуванні.

     Одиниця — це ОДИН РЯДОК ЗАМОВЛЕННЯ: виріб, колір, розмір, кількість.
     Дублювання тут не примха: найчастіша дія — «те саме, але беж» і «те
     саме, але L», і набирати все заново означає шанс помилитись у тому,
     що мало лишитись однаковим.

     Дизайни лежать УСЕРЕДИНІ одиниці, двома окремими списками. Графіка й
     вишивка — не два стани одного, а дві різні роботи, які роблять різні
     люди з різними доступами: графічний дизайнер малює, вишивальний
     оцифровує. Звести їх в один список означало б показувати кожному
     половину чужої роботи. */
  function unitNew(){
    return { id: 'u' + Date.now() + Math.random().toString(36).slice(2, 6),
             gid:'', name:'', color:'', size:'', qty:1,
             graphic: [], stitch: [], note:'' };
  }
  function unitsOf(job){ return Array.isArray(job && job.units) ? job.units : []; }
  function unitAt(job, id){
    return unitsOf(job).filter(function(u){ return u.id === id; })[0] || null;
  }
  function catalog(){
    try{ return (host().catalog && host().catalog()) || []; }catch(e){ return []; }
  }
  function catItem(gid){
    return catalog().filter(function(g){ return g.id === gid; })[0] || null;
  }
  function optsHtml(list, cur, ph){
    return '<option value="">' + esc(ph || '—') + '</option>' +
      list.map(function(v){
        var val = (v && v.id != null) ? v.id : v;
        var lab = (v && v.name != null) ? v.name : v;
        return '<option value="' + esc(val) + '"' +
               (String(val) === String(cur) ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('');
  }
  /* Один дизайн у списку. Стан тут навмисно простий: зроблено чи ні.
     Докладний контур — версії, причини повернень, оцифрування — уже є
     нижче, і дублювати його в кожному рядку означало б мати два місця з
     різними відповідями на те саме питання. */
  function designRowHtml(u, kind, d, i){
    return '<div class="dz-dz">' +
      '<input class="dz-dz-n" data-dz="' + esc(u.id) + '|' + kind + '|' + i + '" ' +
        'value="' + esc(d.name || '') + '" placeholder="Назва нанесення">' +
      '<select class="dz-dz-s" data-dzs="' + esc(u.id) + '|' + kind + '|' + i + '">' +
        optsHtml([{ id:'front', name:'Перед' }, { id:'back', name:'Спина' },
                  { id:'sleeve', name:'Рукав' }, { id:'other', name:'Інше' }],
                 d.side, 'Де') +
      '</select>' +
      /* Розмір вишивки приходить із мокапу — його ставить дизайнер, і
         міряти його руками означає мати два числа про один шов. Поки
         мокапу немає, поле порожнє й чесно про це каже. */
      '<span class="dz-dz-mm">' + (d.mm && d.mm.w
        ? (d.mm.w + '×' + d.mm.h + ' мм')
        : '<i>розмір із мокапу</i>') + '</span>' +
      '<button class="dz-dz-x" data-do="dz-del" data-dz="' + esc(u.id) + '|' + kind + '|' + i +
        '" title="Прибрати">×</button>' +
    '</div>';
  }
  function unitHtml(job, u, n){
    var g = catItem(u.gid);
    var cols = g ? g.colors : [];
    var sizes = g ? g.sizes : [];
    var head = (u.name || 'Одиниця ' + n) +
      (u.color ? ' · ' + u.color : '') + (u.size ? ' · ' + u.size : '') +
      ' · ' + (+u.qty || 0) + ' шт';
    return '<div class="dz-u">' +
      '<div class="dz-u-h"><b>' + esc(head) + '</b>' +
        '<span class="dz-u-acts">' +
          '<button class="dz-b" data-do="u-dup" data-u="' + esc(u.id) + '" ' +
            'title="Те саме ще раз — далі міняєте колір чи розмір">⧉ Дублювати</button>' +
          '<button class="dz-b" data-do="u-del" data-u="' + esc(u.id) + '">Прибрати</button>' +
        '</span></div>' +
      '<div class="dz-u-f">' +
        '<label><span>Виріб</span><select data-uf="' + esc(u.id) + '|gid">' +
          optsHtml(catalog(), u.gid, 'Оберіть виріб') + '</select></label>' +
        '<label><span>Колір</span><select data-uf="' + esc(u.id) + '|color">' +
          optsHtml(cols.map(function(c){ return { id:c.name, name:c.name }; }), u.color, 'Колір') +
        '</select></label>' +
        '<label><span>Розмір</span><select data-uf="' + esc(u.id) + '|size">' +
          optsHtml(sizes, u.size, 'Розмір') + '</select></label>' +
        '<label><span>Кількість</span><input type="number" min="1" ' +
          'data-uf="' + esc(u.id) + '|qty" value="' + (+u.qty || 1) + '"></label>' +
      '</div>' +
      /* Два списки, відбиті один від одного. Це не оформлення: графіку й
         вишивку роблять різні люди, і кожен має з першого погляду бачити
         свою половину, а не шукати її серед чужої. */
      '<div class="dz-u-dz">' +
        '<div class="dz-u-col"><div class="dz-u-l">Графічний дизайн</div>' +
          (u.graphic || []).map(function(d, i){ return designRowHtml(u, 'graphic', d, i); }).join('') +
          '<button class="dz-b" data-do="dz-add" data-dz="' + esc(u.id) + '|graphic">+ Нанесення</button>' +
        '</div>' +
        '<div class="dz-u-col"><div class="dz-u-l">Вишивальний дизайн</div>' +
          (u.stitch || []).map(function(d, i){ return designRowHtml(u, 'stitch', d, i); }).join('') +
          '<button class="dz-b" data-do="dz-add" data-dz="' + esc(u.id) + '|stitch">+ Нанесення</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function unitsHtml(job){
    var list = unitsOf(job);
    return '<div class="dz-h">Склад замовлення</div>' +
      (list.length
        ? list.map(function(u, i){ return unitHtml(job, u, i + 1); }).join('')
        : '<div class="dz-miss">Складу ще немає. Додайте одяг — саме з нього ' +
          'відділ і дізнається, що шити: виріб, колір, розмір, кількість.</div>') +
      '<button class="dz-b pri" data-do="u-add">+ Додати одяг</button>';
  }


  /* ══════════ ВІДПРАВКА ══════════
     Останній блок картки, і навмисно ТОНКИЙ. Накладна створюється в картці
     замовлення — там уже є і Нова пошта, і поле для номера, вписаного
     руками. Зробити другу таку кнопку тут означало б мати два місця, з
     яких на одну посилку виїжджають дві накладні.

     Тому відділ показує СТАН і веде туди, де це роблять: скільки всього
     штук їде, чи номер уже є, і кнопка. */
  function shipHtml(p){
    var o = p.o || {}, job = p.job;
    var q = unitsOf(job).reduce(function(a, u){ return a + (+u.qty || 0); }, 0);
    if(!q) (o.items || []).forEach(function(it){
      if((it.kind || 'main') !== 'reco') q += (+it.qty || 0); });
    var ttn = String(o.ttn || '').trim();
    return '<div class="dz-h">Відправка</div>' +
      '<div class="dz-ship">' +
        '<div class="dz-ship-l">' +
          '<b>' + (q ? q + ' шт' : 'кількість ще не вказана') + '</b>' +
          (ttn ? '<span class="dz-ship-ttn">Накладна ' + esc(ttn) + '</span>'
               : '<span class="dz-ship-no">накладної ще немає</span>') +
        '</div>' +
        '<button class="dz-b" data-do="ship">' +
          (ttn ? 'Відкрити відправку' : 'Створити накладну') + '</button>' +
      '</div>';
  }

  function taskBlockHtml(pr, seat){
    var want = SEAT_TASK[seat] || '';
    var all = D.taskList(pr.job).filter(function(t){
      var k = D.TASK_KINDS.filter(function(x){ return x.key === t.kind; })[0];
      return !want || (k && k.to === want);
    });
    if(!all.length) return '';
    var live = all.filter(function(t){ return t.state !== 'accepted'; });
    var cur = live[live.length - 1] || null;
    var past = all.filter(function(t){ return t !== cur; });
    var one = function(t, old){
      var k = D.TASK_KINDS.filter(function(x){ return x.key === t.kind; })[0];
      var st = D.TASK_FLOW.filter(function(x){ return x.key === t.state; })[0] || {};
      var why = D.TASK_WHY.filter(function(x){ return x.key === t.why; })[0];
      var mine = String(t.to || '').trim().toLowerCase() ===
                 String(me()).trim().toLowerCase();
      /* Кнопки — рівно ті, що доречні зараз. Показувати всі й гасити
         частину означає щоразу читати, яка з них жива. */
      var acts = '';
      if(!old && mine && t.state === 'new')
        acts = '<button class="dz-b pri" data-do="task-start" data-t="' + t.n + '">Беру в роботу</button>';
      else if(!old && mine && t.state === 'work')
        acts = '<input id="dzClosed" placeholder="Чим закрили: версія, файл, фото">' +
               '<button class="dz-b pri" data-do="task-done" data-t="' + t.n + '">Готово</button>';
      else if(!old && t.state === 'done' && (host.can ? host.can('designmgr') : true))
        acts = '<button class="dz-b pri" data-do="task-accept" data-t="' + t.n + '">Прийняти</button>' +
               reasonsHtml('dzWhy', D.TASK_WHY) +
               '<button class="dz-b" data-do="task-return" data-t="' + t.n + '">Повернути</button>';
      return '<div class="dz-task' + (old ? ' old' : '') + '" data-task="' + esc(t.id) + '">' +
        '<b>' + esc((k ? k.label : t.kind) + ' №' + t.n) + '</b>' +
        '<span class="dz-state">' + esc(st.label || t.state) + '</span>' +
        (why ? '<i>' + esc(why.label) + '</i>' : '') +
        (t.text ? '<div class="dz-note">' + esc(t.text).replace(/\n/g, '<br>') + '</div>' : '') +
        (t.closedBy ? '<i>закрито: ' + esc(t.closedBy) + '</i>' : '') +
        (acts ? '<div class="dz-act">' + acts + '</div>' : '') +
      '</div>';
    };
    return '<div class="dz-h">Що зробити</div>' +
      (cur ? one(cur, false) : '<div class="dz-miss">Відкритих доручень немає.</div>') +
      (past.length
        ? '<details class="dz-old"><summary>Попередні правки · ' + past.length + '</summary>' +
          past.map(function(t){ return one(t, true); }).join('') + '</details>'
        : '');
  }
  function briefHtml(o, job){
    /* Слова замовника — перше, що має прочитати дизайнер. Склад і
       міліметри нижче: вони кажуть, що шиємо, а це — що малюємо. */
    var br = (job && job.brief) || {};
    var head = '';
    if(br.text) head += '<div class="dz-note">' + esc(br.text).replace(/\n/g, '<br>') + '</div>';
    if((br.pics || []).length){
      head += '<div class="dz-pics">' + br.pics.map(function(pp){
        return '<a class="dz-thumb" href="' + esc(pp.url) + '" target="_blank" rel="noopener">' +
               '<img src="' + esc(pp.url) + '" alt=""></a>';
      }).join('') + '</div>';
    }
    var rows = (o.items || []).filter(function(it){ return (it.kind || 'main') !== 'reco'; })
      .map(function(it){
        var pl = (it.prints || []).map(function(p){
          var mk = p.mark;
          return '<div class="dz-pl">' +
            '<b>' + esc(p.sideLabel || p.side || 'Нанесення') + '</b>' +
            (p.technique ? ' · ' + esc(p.technique) : '') +
            ' · ' + (+p.widthMm || 0) + ' × ' + (+p.heightMm || 0) + ' мм' +
            (mk ? '<i>від плечей ' + (+mk.topMm || 0) + ' мм · ' +
                  (Math.abs(+mk.centerMm || 0) <= 3 ? 'по центру'
                    : (Math.abs(+mk.centerMm) + ' мм ' +
                       ((+mk.centerMm) > 0 ? 'праворуч' : 'ліворуч'))) + '</i>' : '') +
            (p.file ? '<a href="' + esc(p.file) + '" target="_blank" rel="noopener">файл</a>' : '') +
          '</div>';
        }).join('');
        return '<div class="dz-item">' +
          '<div class="dz-item-h">' + esc(it.name || 'Позиція') +
            (it.color ? ' · ' + esc(it.color) : '') +
            ((+it.qty || 0) ? ' · ' + (+it.qty) + ' шт' : '') + '</div>' +
          (it.sizes ? '<div class="dz-item-s">' + esc(it.sizes) + '</div>' : '') +
          (pl || '<div class="dz-pl is-none">нанесення не вказано</div>') +
        '</div>';
      }).join('');
    var miss = D.briefMissing(o);
    return '<div class="dz-brief">' +
      (miss.length
        ? '<div class="dz-miss"><b>У ТЗ бракує:</b> ' +
          miss.map(function(m){ return esc(m.label); }).join(' · ') + '</div>'
        : '<div class="dz-ok">ТЗ повне</div>') +
      (o.why ? '<div class="dz-why">' + esc(o.why) + '</div>' : '') +
      head + rows + '</div>';
  }

  /* ── Версії макета ─────────────────────────────────────────────────── */
  function versionsHtml(job, o){
    var l = (o && o.art) || [];
    if(!l.length) return '<div class="dz-empty">версій ще немає</div>';
    var ev = job.graphic.events || [];
    return '<div class="dz-vers">' + l.slice().reverse().map(function(v){
      var back = ev.filter(function(e){ return +e.n === +v.n; });
      return '<div class="dz-ver' + (+job.approvedVersion === +v.n ? ' is-ok' : '') + '">' +
        '<div class="dz-ver-h">v' + v.n +
          (v.ai ? '<span class="dz-tag">AI</span>' : '') +
          (+job.approvedVersion === +v.n ? '<span class="dz-tag is-ok">погоджено клієнтом</span>' : '') +
          (D.verLocked(v) ? '<span class="dz-tag">замкнено</span>' : '') +
          '<i>' + esc(dt(v.at)) + ' · ' + esc(nameOf(v.by)) + '</i></div>' +
        (verPic(v) ? '<a class="dz-thumb" href="' + esc(verPic(v)) + '" target="_blank" rel="noopener">' +
                     '<img src="' + esc(verPic(v)) + '" alt=""></a>' : '') +
        ((v.files || []).length
          ? '<div class="dz-files">' + v.files.map(function(f){
              return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
                     esc(f.name || f.kind || 'файл') + '</a>';
            }).join('') + '</div>' : '') +
        ((v.approvals || {}).art
          ? '<div class="dz-note">Менеджер погодив · ' + esc(dt(v.approvals.art.at)) + '</div>' : '') +
        back.map(function(e){
          return '<div class="dz-back' + (e.kind === 'client' ? ' is-client' : '') + '">' +
            (e.kind === 'client' ? 'Клієнт просить зміни' : 'Повернуто менеджером') + ': ' +
            e.reasons.map(function(k){
              return esc(D.reasonLabel(e.kind === 'client' ? D.CLIENT_REASONS : D.MGR_REASONS, k));
            }).join(' · ') +
            (e.note ? ' — ' + esc(e.note) : '') + '</div>';
        }).join('') +
      '</div>';
    }).join('') + '</div>';
  }

  /* Набір галочок причин. Причина обовʼязкова скрізь, де щось повертають:
     повернення без причини нічим не відрізняється від «не сподобалось». */
  function reasonsHtml(id, list){
    return '<div class="dz-reasons" id="' + id + '">' + list.map(function(r){
      return '<label><input type="checkbox" value="' + esc(r.key) + '">' +
             esc(r.label) + '</label>';
    }).join('') + '</div>';
  }
  function pickedReasons(id){
    var box = document.getElementById(id);
    if(!box) return [];
    return [].slice.call(box.querySelectorAll('input:checked')).map(function(x){ return x.value; });
  }
  function noteOf(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  /* Хто скільки тримає — просто в списку вибору. Питання «кому віддати»
     без цього числа вирішується навмання: менеджер памʼятає двох останніх,
     а третій стоїть вільний. */
  function teamPick(id, role, cur){
    var list = (host.team ? host.team() : []).filter(function(m){
      return !role || m.role === role || m.role === 'owner';
    });
    var jobs = pairs().map(function(p){ return p.job; });
    return '<select id="' + id + '"><option value="">— оберіть —</option>' +
      list.map(function(m){
        var n = D.loadOf(jobs, m.email);
        var full = n >= D.TAKE_LIMIT;
        return '<option value="' + esc(m.email) + '"' +
               (m.email === cur ? ' selected' : '') + (full ? ' disabled' : '') + '>' +
               esc(m.name || m.email) +
               (n ? ' · ' + n + (full ? ' — повний' : '') : ' · вільний') + '</option>';
      }).join('') + '</select>';
  }

  window.LQDesign.ui = {
    set host(h){ host = h || {}; },
    get host(){ return host; },
    setTab: function(t){ tab = t; openKey = ''; },
    tab: function(){ return tab; },
    open: function(k){ openKey = k; },
    tabOpen: function(){ return openKey; },
    esc: esc, dt: dt, nameOf: nameOf, say: say, verPic: verPic,
    pairs: pairs, pairOf: pairOf,
    boardHtml: boardHtml, briefHtml: briefHtml, versionsHtml: versionsHtml,
    reasonsHtml: reasonsHtml, pickedReasons: pickedReasons, noteOf: noteOf,
    teamPick: teamPick, ROLES: ROLES, roleSeat: roleSeat, isBoss: isBoss,
    jobNo: jobNo,
    clientHtml: clientHtml, taskBlockHtml: taskBlockHtml,
    unitsHtml: unitsHtml, unitsOf: unitsOf, unitAt: unitAt, shipHtml: shipHtml,
    unitNew: unitNew, catItem: catItem,
    taskCards: taskCards, hm: hm,
    /* `can` живе в панелі дій нижче, а картки доручень потрібні вже тут.
       Заглушка на випадок, коли модуль піднімають без адмінки. */
    can: function(){ return true; }
  };
})();

/* ══════════════════════════════════════════════════════════════════════
   ПАНЕЛЬ ЗАДАЧІ Й ДІЇ

   Кнопки тут не «змінюють поле» — вони роблять крок роботи, і кожен крок
   веде себе однаково: пише стан, пише причину, пише слід у dataset і
   зберігає. Тому всі вони проходять через одну дорогу нижче: інакше одна
   кнопка рухала б трек, а сусідня забувала, і стан замовлення залежав би
   від того, звідки натиснули.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var D = window.LQDesign, U = D.ui;
  var esc = U.esc, dt = U.dt, nameOf = U.nameOf, say = U.say;

  function host(){ return U.host; }
  function save(job, o, msg){
    job.updatedAt = new Date().toISOString();
    var p = host().save ? host().save(job, o) : Promise.resolve();
    return Promise.resolve(p).then(function(){
      if(msg) say(msg);
      render(document.getElementById('dzRoot'));
    }, function(e){
      console.error(e); say('Не збереглось');
    });
  }
  function can(k){ return host().can ? !!host().can(k) : true; }

  /* ── Картки дощок ──────────────────────────────────────────────────── */
  /* Картка ланцюга каже три речі: що це, де воно й хто його тримає. Більше
     в колонку не влізе, а менше не відповість на жодне питання. */
  function chainCards(){
    return U.pairs().map(function(p){
      var col = D.chainAt(p.job, p.o);
      var open = D.taskOpen(p.job).length;
      return { id: p.o.orderId, step: col,
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
        foot: (D.CHAIN_WHO[col] || '') + (open ? ' · доручень ' + open : '') };
    });
  }
  function queueCards(){
    return U.pairs().map(function(p){
      var g = p.job.graphic || {};
      return { id: p.o.orderId, step: p.job.state,
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
        foot: (g.assignee ? nameOf(g.assignee) : 'без дизайнера') +
              (g.due ? ' · до ' + esc(g.due) : '') };
    });
  }
  function graphicCards(){
    var only = host().onlyMine && host().onlyMine();
    var m = (host().me && host().me()) || '';
    return U.pairs().filter(function(p){
      return !only || !p.job.graphic.assignee || p.job.graphic.assignee === m;
    }).map(function(p){
      var v = D.verCur(p.job);
      return { id: p.o.orderId, step: p.job.graphic.status || 'new',
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
        foot: v ? ('v' + v.n + ' · ' + dt(v.at)) : 'версій немає' };
    });
  }
  function stitchCards(filterStatus){
    var out = [];
    U.pairs().forEach(function(p){
      (p.job.stitch || []).forEach(function(s){
        if(s.gone) return;
        if(filterStatus && s.status !== filterStatus) return;
        out.push({ id: p.o.orderId + '|' + s.key, step: s.status || 'wait',
          title: U.jobNo(p.job) + ' · ' + (s.label || ''),
          sub: (s.name || '') + (s.color ? ' · ' + s.color : ''),
          foot: (s.mm ? s.mm.w + '×' + s.mm.h + ' мм' : '') +
                (s.assignee ? ' · ' + nameOf(s.assignee) : '') +
                (s.outsource ? ' · ' + s.outsource : '') });
      });
    });
    return out;
  }

  /* ── Панель: черга відділу ─────────────────────────────────────────── */
  /* Видати доручення. Стоїть у черзі, бо це робота менеджера відділу: він
     єдиний бачить усе замовлення й може сказати, що саме треба зробити. */
  /* Редактор ТЗ — у менеджера відділу. Він єдиний бачить і замовлення, і
     переписку з клієнтом, тобто може перекласти одне в інше. */
  function briefEditHtml(job){
    var br = (job && job.brief) || {};
    return '<div class="dz-act">' +
      '<span class="dz-l">Технічне завдання</span>' +
      '<textarea id="dzBrief" rows="3" placeholder="Що саме малюємо: побажання ' +
        'клієнта, приклади, обмеження">' + esc(br.text || '') + '</textarea>' +
      ((br.pics || []).length
        ? '<div class="dz-pics">' + br.pics.map(function(pp, i){
            return '<span class="dz-pic"><a class="dz-thumb" href="' + esc(pp.url) +
              '" target="_blank" rel="noopener"><img src="' + esc(pp.url) + '" alt=""></a>' +
              '<button class="dz-pic-x" data-do="brief-pic-del" data-i="' + i + '">×</button></span>';
          }).join('') + '</div>'
        : '') +
      '<button class="dz-b" data-do="brief-pic">⤒ Референс</button>' +
      '<button class="dz-b pri" data-do="brief-save">Зберегти ТЗ</button>' +
    '</div>';
  }
  function taskNewHtml(job){
    var open = D.taskOpen(job);
    return '<div class="dz-act">' +
      '<span class="dz-l">Видати доручення' +
        (open.length ? ' <i>(відкритих: ' + open.length + ')</i>' : '') + '</span>' +
      '<select id="dzTKind"><option value="">— що зробити —</option>' +
      D.TASK_KINDS.map(function(k){
        return '<option value="' + esc(k.key) + '">' + esc(k.label) + '</option>'; }).join('') +
      '</select>' +
      U.teamPick('dzTTo', '', '') +
      '<textarea id="dzTText" rows="2" placeholder="що саме зробити"></textarea>' +
      '<select id="dzTWhy"><option value="">— причина (для правок) —</option>' +
      D.TASK_WHY.map(function(w){
        return '<option value="' + esc(w.key) + '">' + esc(w.label) + '</option>'; }).join('') +
      '</select>' +
      '<input type="date" id="dzTDue">' +
      '<button class="dz-b pri" data-do="task-add">Видати</button>' +
    '</div>';
  }

  function queuePanel(p){
    var job = p.job, o = p.o, g = job.graphic;
    var v = D.verCur(o);
    var acts = [];
    if(can('designmgr')) acts.push(briefEditHtml(job));
    if(can('designmgr')) acts.push(taskNewHtml(job));
    if(job.state === 'new' || job.state === 'check'){
      acts.push('<div class="dz-act">' +
        '<span class="dz-l">Призначити дизайнера</span>' +
        U.teamPick('dzWho', 'designer', g.assignee) +
        '<input type="date" id="dzDue" value="' + esc(g.due || '') + '">' +
        '<button class="dz-b pri" data-do="assign">Віддати в роботу</button>' +
      '</div>' +
      '<div class="dz-act">' +
        '<span class="dz-l">Повернути продажнику</span>' +
        '<textarea id="dzBriefNote" rows="2" placeholder="Чого саме бракує"></textarea>' +
        '<button class="dz-b" data-do="brief-back">Повернути</button>' +
      '</div>');
    }
    if(job.state === 'review' && g.status === 'review'){
      acts.push('<div class="dz-act">' +
        '<span class="dz-l">Перевірка макета v' + (v ? v.n : '—') + '</span>' +
        '<button class="dz-b pri" data-do="mgr-ok">Погодити</button>' +
      '</div>' +
      '<div class="dz-act">' +
        '<span class="dz-l">Повернути на правки — вкажіть причину</span>' +
        U.reasonsHtml('dzMgrR', D.MGR_REASONS) +
        '<textarea id="dzMgrNote" rows="2" placeholder="Коментар"></textarea>' +
        '<button class="dz-b" data-do="revise">На правки</button>' +
      '</div>');
    }
    if(v && (v.approvals || {}).art && job.state !== 'client' && job.state !== 'approved'){
      acts.push('<div class="dz-act">' +
        '<span class="dz-l">Показати клієнту</span>' +
        '<button class="dz-b pri" data-do="to-client">Надіслати клієнту</button>' +
      '</div>');
    }
    if(job.state === 'client'){
      acts.push('<div class="dz-act">' +
        '<span class="dz-l">Відповідь клієнта на v' + (job.client.version || '—') + '</span>' +
        '<button class="dz-b pri" data-do="cl-ok">Клієнт погодив</button>' +
      '</div>' +
      '<div class="dz-act">' +
        '<span class="dz-l">Клієнт просить зміни — вкажіть що саме</span>' +
        U.reasonsHtml('dzClR', D.CLIENT_REASONS) +
        '<textarea id="dzClNote" rows="2" placeholder="Слова клієнта"></textarea>' +
        '<button class="dz-b" data-do="cl-changes">Записати правки</button>' +
      '</div>');
    }
    return '<div class="dz-panel-h">' + U.jobNo(p.job) +
        '<span class="dz-state">' + esc(D.stateLine(job)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.clientHtml(o, job) + U.taskBlockHtml(p, 'acct') +
        /* Склад — одразу під клієнтом і дорученнями: це перше, що питають
           про замовлення, і перше, що заповнюють, коли його заводять. */
        U.unitsHtml(job) +
        U.briefHtml(o, job) +
        (acts.length ? '<div class="dz-acts">' + acts.join('') + '</div>' : '') +
        '<div class="dz-h">Версії</div>' + U.versionsHtml(job, o) +
        U.shipHtml(p) +
      '</div>';
  }

  /* ── Панель: робота дизайнера ──────────────────────────────────────── */
  /* «Беру сам» — на панелі дизайнера, і тільки поки замовлення нічиє.
     Доти роботу мусив роздати менеджер відділу: поки він не дійшов до
     черги, вільний дизайнер сидів без роботи, а замовлення стояло. */
  function takeHtml(pr){
    var g2 = pr.job.graphic || {};
    if(g2.assignee) return '';
    var m2 = (U.host.me && U.host.me()) || '';
    if(!m2) return '';
    var jobs = U.pairs().map(function(x){ return x.job; });
    var n = D.loadOf(jobs, m2);
    if(n >= D.TAKE_LIMIT)
      return '<div class="dz-miss">У роботі вже ' + n + ' замовлень. Нове береться ' +
             'після того, як здасте котресь із цих — черга, якої не видно, ' +
             'нікому не допомагає.</div>';
    return '<div class="dz-act"><span class="dz-l">Замовлення вільне</span>' +
      '<button class="dz-b pri" data-do="take">Беру собі' +
      (n ? ' · у роботі ' + n : '') + '</button></div>';
  }
  function graphicPanel(p){
    var job = p.job, o = p.o, g = job.graphic, v = D.verCur(o);
    var locked = D.verLocked(v);
    var acts = takeHtml(p) + '<div class="dz-act">' +
      '<span class="dz-l">Версія макета</span>' +
      '<button class="dz-b" data-do="ver-new">+ Нова версія</button>' +
      (v && !locked
        ? '<button class="dz-b" data-do="ver-file">Додати файл</button>' +
          '<button class="dz-b" data-do="ver-prev">Візуалізація</button>'
        : '') +
      (v && !locked && g.status !== 'review'
        ? '<button class="dz-b pri" data-do="to-review">Віддати на перевірку</button>' : '') +
    '</div>';
    if(g.status === 'new' || g.status === 'revision')
      acts = '<div class="dz-act"><span class="dz-l">Почати</span>' +
        '<button class="dz-b pri" data-do="start">Взяти в роботу</button></div>' + acts;
    return '<div class="dz-panel-h">' + U.jobNo(p.job) +
        '<span class="dz-state">' + esc(D.stepLabel(D.GRAPHIC, g.status)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.clientHtml(o, job) + U.taskBlockHtml(p, 'graphic') +
        U.briefHtml(o, job) +
        '<div class="dz-acts">' + acts + '</div>' +
        '<div class="dz-h">Версії</div>' + U.versionsHtml(job, o) +
      '</div>';
  }

  /* ── Панель: оцифрування ───────────────────────────────────────────── */
  /* Версії вишивального файлу. Показуємо не «останній файл», а шлях: що
     здали, за що повернули, що вийшло. Саме цей список і відповідає на
     питання «ми ж виправили» — номером, а не словом. */
  function stitchVersHtml(job, s){
    var vs = D.stitchVers(job, s.key);
    if(!vs.length) return '';
    return '<div class="dz-sub">Версії файлу</div><div class="dz-vers">' +
      vs.slice().reverse().map(function(v){
        var why = (v.why || []).map(function(k){
          return D.reasonLabel(D.QA_REASONS, k); }).filter(Boolean).join(' · ');
        return '<div class="dz-ver' + (v.ok ? ' is-ok' : '') + '">' +
          '<b>V' + v.n + '</b>' +
          '<span>' + esc((v.files || []).map(function(f){ return f.name; })
                          .filter(Boolean).join(', ') || 'файл') +
            (v.stitches ? ' · ' + v.stitches + ' ст.' : '') + '</span>' +
          '<i>' + esc(dt(v.at)) + (v.ok ? ' · погоджено' : '') +
            (why ? ' · через: ' + esc(why) : '') + '</i>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* `more` — це вже другий і далі файл того самого замовлення: клієнта й
     доручення в них не повторюємо, інакше панель перетворюється на три
     копії однієї шапки. */
  function stitchPanel(p, s, more){
    var job = p.job, o = p.o;
    var v = D.verAt(o, job.approvedVersion);
    var open = D.stitchOpen(job);
    var body = '';
    if(!open){
      body = '<div class="dz-miss">Графіку ще не погодив клієнт — оцифровувати зарано. ' +
             'Саме на цьому й губилась робота: файл робили під макет, який потім змінювали.</div>';
    } else {
      body = '<div class="dz-act">' +
          '<span class="dz-l">Виконавець</span>' +
          U.teamPick('dzSWho', 'embroidery', s.assignee) +
          '<input type="text" id="dzSOut" placeholder="або підрядник" value="' +
            esc(s.outsource || '') + '">' +
          '<button class="dz-b pri" data-do="s-assign">Призначити</button>' +
        '</div>' +
        '<div class="dz-act">' +
          '<span class="dz-l">Файли</span>' +
          '<button class="dz-b" data-do="s-file">Додати DST/PES</button>' +
          '<button class="dz-b" data-do="s-prev">Preview з Wilcom</button>' +
        '</div>' +
        '<div class="dz-act">' +
          '<span class="dz-l">Параметри</span>' +
          '<input type="number" id="dzStitches" placeholder="стібків" value="' +
            (+s.stitches || '') + '">' +
          '<input type="text" id="dzColors" placeholder="кольори ниток через кому" value="' +
            esc((s.colors || []).join(', ')) + '">' +
          '<textarea id="dzSNotes" rows="2" placeholder="Нотатки для виробництва">' +
            esc(s.notes || '') + '</textarea>' +
          '<button class="dz-b" data-do="s-save">Зберегти</button>' +
        '</div>' +
        ((s.files || []).length && s.status !== 'qa' && s.status !== 'ok'
          ? '<div class="dz-act"><span class="dz-l">Здати на перевірку</span>' +
            '<button class="dz-b pri" data-do="s-ready">Готово для QA</button></div>'
          : '');
    }
    return (more ? '' :
        '<div class="dz-panel-h">' + U.jobNo(job) + ' · ' + esc(s.label) +
        '<span class="dz-state">' + esc(D.stepLabel(D.STITCH, s.status)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>') +
      '<div class="dz-panel-b">' +
        (more ? '' : U.clientHtml(o, job) + U.taskBlockHtml(p, 'stitch')) +
        '<div class="dz-item"><div class="dz-item-h">' + esc(s.name) +
          (s.color ? ' · ' + esc(s.color) : '') + ' · ' + (+s.qty || 0) + ' шт</div>' +
          '<div class="dz-pl"><b>' + esc(s.label) + '</b> · ' +
            (s.mm ? s.mm.w + ' × ' + s.mm.h + ' мм' : 'розмір не вказано') +
            (s.mark ? '<i>від плечей ' + (+s.mark.topMm || 0) + ' мм</i>' : '') + '</div>' +
        '</div>' +
        (v && verPic(v)
          ? '<div class="dz-h">Погоджений макет v' + v.n + '</div>' +
            '<a class="dz-thumb" href="' + esc(verPic(v)) + '" target="_blank" rel="noopener">' +
            '<img src="' + esc(verPic(v)) + '" alt=""></a>' : '') +
        ((s.files || []).length
          ? '<div class="dz-h">Файли вишивки</div><div class="dz-files">' +
            s.files.map(function(f){
              return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
                     esc(f.name || 'файл') + '</a>'; }).join('') + '</div>' : '') +
        (s.preview ? '<a class="dz-thumb" href="' + esc(s.preview) +
                     '" target="_blank" rel="noopener"><img src="' + esc(s.preview) +
                     '" alt=""></a>' : '') +
        (s.qa && s.qa.status === 'back'
          ? '<div class="dz-back">QA повернув: ' + s.qa.reasons.map(function(k){
              return esc(D.reasonLabel(D.QA_REASONS, k)); }).join(' · ') +
            (s.qa.note ? ' — ' + esc(s.qa.note) : '') + '</div>' : '') +
        stitchVersHtml(job, s) +
        '<div class="dz-acts">' + body + '</div>' +
      '</div>';
  }

  /* ── Панель: QA вишивального файлу ─────────────────────────────────── */
  function qaPanel(p, s){
    var o = p.o;
    var checks = (s.qa && s.qa.checks) || {};
    return '<div class="dz-panel-h">' + U.jobNo(p.job) + ' · ' + esc(s.label) +
        '<span class="dz-state">перевірка файлу</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.clientHtml(o, p.job) + U.taskBlockHtml(p, 'stitch') +
        '<div class="dz-item"><div class="dz-item-h">' + esc(s.name) + ' · ' +
          esc(s.label) + ' · ' + (s.mm ? s.mm.w + '×' + s.mm.h + ' мм' : '—') + '</div>' +
          '<div class="dz-item-s">' + (+s.stitches || 0) + ' стібків' +
          ((s.colors || []).length ? ' · ' + esc(s.colors.join(', ')) : '') + '</div></div>' +
        ((s.files || []).length
          ? '<div class="dz-files">' + s.files.map(function(f){
              return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
                     esc(f.name || 'файл') + '</a>'; }).join('') + '</div>' : '') +
        (s.preview ? '<a class="dz-thumb" href="' + esc(s.preview) +
                     '" target="_blank" rel="noopener"><img src="' + esc(s.preview) +
                     '" alt=""></a>' : '') +
        '<div class="dz-h">Чекліст — відмічається все, інакше не пропускаємо</div>' +
        '<div class="dz-checks" id="dzQaC">' + D.QA_CHECKS.map(function(c){
          return '<label><input type="checkbox" value="' + esc(c.key) + '"' +
                 (checks[c.key] ? ' checked' : '') + '>' + esc(c.label) + '</label>';
        }).join('') + '</div>' +
        '<div class="dz-acts">' +
          '<div class="dz-act"><span class="dz-l">Файл можна на машину</span>' +
            '<button class="dz-b pri" data-do="qa-ok">Пройдено</button></div>' +
          '<div class="dz-act"><span class="dz-l">Повернути — вкажіть причину</span>' +
            U.reasonsHtml('dzQaR', D.QA_REASONS) +
            '<textarea id="dzQaNote" rows="2" placeholder="Що саме не так"></textarea>' +
            '<button class="dz-b" data-do="qa-back">Повернути</button></div>' +
        '</div>' +
      '</div>';
  }

  /* ── Панель: пакет у виробництво ───────────────────────────────────── */
  function packPanel(p){
    var job = p.job, o = p.o;
    var r = D.packReady(job, o);
    var pk = job.pack;
    return '<div class="dz-panel-h">' + U.jobNo(p.job) +
        '<span class="dz-state">' + (pk ? 'пакет зібрано' : (r.ok ? 'готово збирати' : 'не готово')) +
        '</span><button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.clientHtml(o, job) + U.taskBlockHtml(p, 'prod') +
        (r.ok ? '<div class="dz-ok">Усе на місці</div>'
              : '<div class="dz-miss"><b>Бракує:</b> ' + r.why.map(esc).join(' · ') + '</div>') +
        (pk ? packHtml(pk) : '') +
        (r.ok ? '<div class="dz-acts"><div class="dz-act">' +
            '<span class="dz-l">Передати у виробництво</span>' +
            '<button class="dz-b pri" data-do="pack">' +
            (pk ? 'Зібрати заново' : 'Зібрати пакет') + '</button></div></div>' : '') +
      '</div>';
  }
  function packHtml(pk){
    return '<div class="dz-h">Пакет від ' + esc(dt(pk.at)) + '</div>' +
      '<div class="dz-pack">' + (pk.items || []).map(function(it){
        return '<div class="dz-item"><div class="dz-item-h">' + esc(it.name) +
          (it.color ? ' · ' + esc(it.color) : '') + ' · ' + it.qty + ' шт' +
          (it.sizes ? ' · ' + esc(it.sizes) : '') + '</div>' +
          (it.places || []).map(function(pl){
            return '<div class="dz-pl"><b>' + esc(pl.label) + '</b> · ' +
              pl.mm.w + '×' + pl.mm.h + ' мм · ' + (pl.stitches || 0) + ' стібків' +
              ((pl.colors || []).length ? ' · ' + esc(pl.colors.join(', ')) : '') +
              (pl.files || []).map(function(f){
                return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
                       esc(f.name || 'файл') + '</a>'; }).join('') +
              (pl.notes ? '<i>' + esc(pl.notes) + '</i>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('') + '</div>';
  }

  /* ══════════ ЗБИРАННЯ ЕКРАНА ══════════ */
  /* Дошка вишивальника — ПО ЗАМОВЛЕННЯХ, а не по файлах. Файлів на одне
     замовлення буває кілька, і доти кожен стояв окремою карткою: одне
     замовлення розповзалось по дошці на три-чотири місця, і зібрати його
     назад можна було тільки в голові. Тепер картка одна, а файли — у ній.

     Колонка рахується за найменш готовим файлом: поки хоч один не зданий,
     замовлення не здане. */
  function stitchOrderCards(){
    var out = [];
    U.pairs().forEach(function(p){
      var list = (p.job.stitch || []).filter(function(s){ return !s.gone; });
      if(!list.length) return;
      var order = D.STITCH.map(function(x){ return x.key; });
      var worst = list.reduce(function(acc, s){
        var i = order.indexOf(s.status || 'wait');
        return (i >= 0 && i < acc) ? i : acc;
      }, order.length - 1);
      var done = list.filter(function(s){ return s.status === 'ok'; }).length;
      out.push({ id: p.o.orderId, step: order[worst] || 'wait',
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
        foot: 'файлів ' + list.length + ' · готово ' + done });
    });
    return out;
  }
  function prodCards(){
    return U.pairs().map(function(p){
      var r = D.packReady(p.job, p.o);
      return { id: p.o.orderId, step: D.prodAt(p.job, p.o),
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
        foot: r.ok ? (p.job.pack ? 'пакет зібрано' : 'усе на місці') : (r.why[0] || '') };
    });
  }
  function supplyCards(){
    return U.pairs().map(function(p){
      var q = 0;
      (p.o.items || []).forEach(function(it){
        if((it.kind || 'main') !== 'reco') q += (+it.qty || 0); });
      return { id: p.o.orderId, step: D.supplyAt(p.o),
        title: U.jobNo(p.job),
        sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
               .map(function(i){ return [i.name, i.color].filter(Boolean).join(' · '); })[0] || '',
        foot: q ? q + ' шт' : '' };
    });
  }
  /* Дошка ролі: етапи і картки. Одне місце, де це вирішується, — інакше
     дошка й панель почнуть розходитись у тому, що вважати колонкою. */
  function boardOf(seat){
    if(seat === 'graphic') return { steps: D.GRAPHIC, cards: graphicCards() };
    if(seat === 'stitch')  return { steps: D.STITCH,  cards: stitchOrderCards() };
    if(seat === 'prod')    return { steps: D.PROD,    cards: prodCards() };
    if(seat === 'supply')  return { steps: D.SUPPLY,  cards: supplyCards() };
    return { steps: D.CHAIN, cards: chainCards() };     // акаунт-менеджер
  }

  /* ══════════ ЗБИРАННЯ ЕКРАНА ══════════ */
  function render(root){
    if(!root) return;
    var role = (U.host.role && U.host.role()) || '';
    var boss = U.isBoss(role);
    /* Перемикач ролей — тільки у власника. Співробітник заходить одразу у
       свою дошку: дай йому вибір — колись перемкнеться й пів дня
       працюватиме не на своєму екрані. */
    var seat = boss ? U.tab() : (U.roleSeat(role) || U.tab());
    if(!U.ROLES.some(function(r){ return r.key === seat; })) seat = boss ? 'acct' : 'graphic';
    if(seat !== U.tab()) U.setTab(seat);
    var b = boardOf(seat);
    var openId = U.tabOpen ? U.tabOpen() : '';
    var cur = U.ROLES.filter(function(r){ return r.key === seat; })[0] || U.ROLES[0];
    var headHtml = boss
      ? '<label class="dz-as"><span>Дивлюсь як</span>' +
          '<select class="dz-as-sel" data-seat>' + U.ROLES.map(function(r){
            return '<option value="' + r.key + '"' + (r.key === seat ? ' selected' : '') + '>' +
                   esc(r.label) + '</option>';
          }).join('') + '</select></label>' +
        '<button class="dz-b pri dz-new" data-do="order-new">+ Нове замовлення</button>'
      : '<div class="dz-as"><span>Моя дошка</span><b>' + esc(cur.label) + '</b></div>';
    root.innerHTML =
      '<div class="dz-top">' + headHtml + '</div>' +
      '<div class="dz-wrap">' +
        '<div class="dz-boards">' + U.boardHtml(b.steps, b.cards) + '</div>' +
        '<aside class="dz-panel' + (openId ? '' : ' hide') + '" id="dzPanel">' +
          (openId ? panelFor(seat, openId) : '') + '</aside>' +
      '</div>';
    wire(root);
    /* Дошка ширша за екран, коли поруч відкрита панель, — і активна картка
       опиняється за кадром. Виглядає це так, ніби вона зникла. Підкручуємо
       до неї: людина щойно її натиснула, вона має лишатись на видноті. */
    var on = root.querySelector('.dz-card.on');
    if(on && on.scrollIntoView){
      try{ on.scrollIntoView({ block:'nearest', inline:'center' }); }catch(e){}
    }
  }
  /* Панель доручення. Усе потрібне для роботи лежить ТУТ: що зробити, від
     кого, до якого числа, чим закрити й де перепитати. Саме тому виконавцю
     не треба відкривати картку замовлення — і не треба роздавати доступ до
     її блоків. */
  function taskPanel(pr, t){
    var k = D.TASK_KINDS.filter(function(x){ return x.key === t.kind; })[0];
    var st = D.TASK_FLOW.filter(function(x){ return x.key === t.state; })[0] || {};
    var mine = String(t.to || '').trim().toLowerCase() === String((U.host.me && U.host.me()) || '').trim().toLowerCase();
    var boss = can('designmgr');
    var why = D.TASK_WHY.filter(function(x){ return x.key === t.why; })[0];
    var age = D.taskAge(t);
    var h = '<div class="dz-panel-h"><b>' + esc((k ? k.label : t.kind) + ' №' + t.n) + '</b>' +
      '<button class="dz-x" data-close>✕</button></div>' +
      '<div class="dz-panel-b">' +
      '<div class="dz-chips">' +
        '<span class="dz-chip is-' + esc(st.color || 'gray') + '">' + esc(st.label || t.state) + '</span>' +
        (why ? '<span class="dz-chip">' + esc(why.label) + '</span>' : '') +
        (t.due ? '<span class="dz-chip">до ' + esc(t.due) + '</span>' : '') +
        (age ? '<span class="dz-chip">' + esc(U.hm(age)) + '</span>' : '') +
      '</div>' +
      '<div class="dz-row"><span>Замовлення</span><b>#' + esc(pr.o.orderId) + '</b></div>' +
      '<div class="dz-row"><span>Кому</span><b>' + esc(nameOf(t.to)) + '</b></div>' +
      '<div class="dz-row"><span>Видав</span><b>' + esc(nameOf(t.by)) + '</b></div>' +
      (t.closedBy ? '<div class="dz-row"><span>Закрито</span><b>' + esc(t.closedBy) + '</b></div>' : '') +
      (t.text ? '<div class="dz-note">' + esc(t.text) + '</div>' : '') +
      /* Скріншот пояснює правку краще за абзац тексту — саме через його
         відсутність половина правок поверталась уточненням. */
      ((t.files || []).length
        ? '<div class="dz-pics">' + t.files.map(function(f){
            return '<a class="dz-thumb" href="' + esc(f.url) + '" target="_blank" ' +
              'rel="noopener"><img src="' + esc(f.url) + '" alt=""></a>';
          }).join('') + '</div>'
        : '');

    /* Розмова. Без неї доручення — лист без відповіді: виконавець не може
       перепитати, не виходячи з роботи. */
    h += '<div class="dz-sub">Обговорення</div><div class="dz-talk">' +
      ((t.thread || []).length
        ? t.thread.map(function(m2){
            return '<div class="dz-msg"><b>' + esc(nameOf(m2.by)) + '</b>' +
              '<i>' + esc(dt(m2.at)) + '</i><span>' + esc(m2.t) + '</span></div>';
          }).join('')
        : '<div class="dz-empty">поки тихо</div>') +
      '</div>' +
      '<div class="dz-say"><input id="dzSay" placeholder="написати…" maxlength="600">' +
      '<button class="dz-b" data-do="task-say">Сказати</button>' +
      '<button class="dz-b" data-do="task-file" title="Додати скріншот або файл">⤒</button></div>';

    /* Кнопки — рівно ті, що доречні зараз і саме цій людині. Кнопка, яка
       нічого не робить, гірша за її відсутність. */
    if(mine && (t.state === 'new' || t.state === 'returned'))
      h += '<button class="dz-b pri" data-do="task-start">Беру в роботу</button>';
    if(mine && t.state === 'work')
      h += '<div class="dz-fld"><label>Чим закрили</label>' +
           '<input id="dzClosed" placeholder="V3 · файл · фото" maxlength="60"></div>' +
           '<button class="dz-b pri" data-do="task-done">Виконано</button>';
    if(boss && t.state === 'done'){
      h += '<div class="dz-fld"><label>Причина повернення</label><select id="dzWhy">' +
        '<option value="">— оберіть —</option>' +
        D.TASK_WHY.map(function(x){
          return '<option value="' + esc(x.key) + '">' + esc(x.label) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="dz-fld"><input id="dzBack" placeholder="що саме не так" maxlength="300"></div>' +
        '<div class="dz-acts">' +
        '<button class="dz-b pri" data-do="task-accept">Прийняти</button>' +
        '<button class="dz-b" data-do="task-return">Повернути</button></div>';
    }
    return h + '</div>';
  }

  /* Панель закупівлі. Рівно те, що замовляють: що, якого кольору, скільки
     й до якого числа. Ні макетів, ні цін продажу, ні клієнта — закупникові
     вони не потрібні, а зайве поле на екрані колись переплутають. */
  function supplyPanel(p){
    var o = p.o;
    var rows = (o.items || []).filter(function(it){ return (it.kind || 'main') !== 'reco'; });
    return '<div class="dz-panel-h">' + U.jobNo(p.job) +
        '<span class="dz-state">закупівля</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.clientHtml(o, p.job) + U.taskBlockHtml(p, 'supply') +
        (o.dueAt ? '<div class="dz-row"><span>Потрібно до</span><b>' +
                   esc(String(o.dueAt).slice(0, 10)) + '</b></div>' : '') +
        rows.map(function(it){
          return '<div class="dz-row"><span>' + esc(it.name || 'Виріб') + '</span><b>' +
            esc([it.color, (+it.qty || 0) + ' шт'].filter(Boolean).join(' · ')) + '</b></div>' +
            (it.sizes ? '<div class="dz-row"><span>розміри</span><b>' +
                        esc(it.sizes) + '</b></div>' : '');
        }).join('') +
        '<div class="dz-note">Стан закупівлі ведеться в картці замовлення — ' +
        'тут видно, що саме замовляти.</div>' +
      '</div>';
  }

  /* Панель — завжди по ЗАМОВЛЕННЮ. Роль вирішує лише, який робочий блок у
     ній відкритий: дизайнеру — версії макета, вишивальнику — файли,
     закупівлі — що замовити. Клієнт, побажання й доручення однакові в
     усіх: це одна картка, показана з різних місць роботи. */
  function panelFor(seat, id){
    var pr = U.pairOf(String(id).split('|')[0]);
    if(!pr) return '';
    if(seat === 'graphic') return graphicPanel(pr);
    if(seat === 'supply')  return supplyPanel(pr);
    if(seat === 'prod')    return packPanel(pr);
    if(seat === 'stitch'){
      /* Файлів на замовлення буває кілька — показуємо всі підряд, у
         порядку роботи. Окремими картками на дошці вони більше не стоять:
         одне замовлення розповзалось по ній на три місця. */
      var list = (pr.job.stitch || []).filter(function(x){ return !x.gone; });
      if(!list.length) return stitchPanel(pr, { key:'', label:'', status:'wait' });
      return list.map(function(x, i){ return stitchPanel(pr, x, i > 0); }).join('');
    }
    return queuePanel(pr);           // акаунт-менеджер
  }

  window.LQDesign.ui.render = render;
  window.LQDesign.ui.panelFor = panelFor;
  window.LQDesign.ui.save = save;
  window.LQDesign.ui.can = can;
  window.LQDesign.ui.wireHook = function(f){ wireExtra = f; };
  var wireExtra = null;

  function wire(root){
    /* Перемикач ролі. Він НЕ дає прав: дії й далі виконуються від імені
       того, хто зайшов, і в історію пишеться саме він. Це погляд, а не
       перевтілення. */
    var seatSel = root.querySelector('[data-seat]');
    if(seatSel) seatSel.onchange = function(){ U.setTab(seatSel.value); render(root); };
    root.querySelectorAll('[data-open]').forEach(function(b){
      b.onclick = function(){ U.open(b.dataset.open); render(root); };
    });
    var x = root.querySelector('[data-close]');
    if(x) x.onclick = function(){ U.open(''); render(root); };
    root.querySelectorAll('[data-do]').forEach(function(b){
      b.onclick = function(){ act(b.dataset.do, root, b.dataset); };
    });
    /* Поля складу пишуться на «change», а не на кожну літеру: кожен натиск
       клавіші летів би в базу й перемальовував панель під руками. */
    root.querySelectorAll('[data-uf]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var pp = String(el.dataset.uf).split('|');
        var u = U.unitAt(c.job, pp[0]); if(!u) return;
        var f = pp[1];
        if(f === 'qty') u.qty = Math.max(1, Math.round(+el.value || 1));
        else u[f] = el.value;
        /* Змінили виріб — колір і розмір від старого тут ні до чого:
           у нового вони свої, і лишити чужі означає везти у виробництво
           колір, якого в цього виробу немає. Назву підставляємо з
           каталогу, щоб у картці стояло людське слово, а не код. */
        if(f === 'gid'){
          var g = U.catItem(u.gid);
          u.name = g ? g.name : '';
          u.color = ''; u.size = '';
        }
        save(c.job, c.o, '');
      };
    });
    root.querySelectorAll('[data-dz]').forEach(function(el){
      if(el.tagName !== 'INPUT') return;
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var pp = String(el.dataset.dz).split('|');
        var u = U.unitAt(c.job, pp[0]); if(!u) return;
        var arr = u[pp[1] === 'stitch' ? 'stitch' : 'graphic'] || [];
        if(!arr[+pp[2]]) return;
        arr[+pp[2]].name = el.value;
        save(c.job, c.o, '');
      };
    });
    root.querySelectorAll('[data-dzs]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var pp = String(el.dataset.dzs).split('|');
        var u = U.unitAt(c.job, pp[0]); if(!u) return;
        var arr = u[pp[1] === 'stitch' ? 'stitch' : 'graphic'] || [];
        if(!arr[+pp[2]]) return;
        arr[+pp[2]].side = el.value;
        save(c.job, c.o, '');
      };
    });
    if(wireExtra) wireExtra(root);
  }

  /* ══════════ ДІЇ ══════════ */
  function ctx(){
    var id = U.tabOpen ? U.tabOpen() : '';
    var parts = String(id).split('|');
    var p = U.pairOf(parts[0]);
    if(!p) return null;
    /* Ключ доручення виглядає як `1842|t3`. Літера тут не прикраса: без неї
       номер доручення не відрізнити від ключа нанесення, і панель відкрила
       б не те. */
    var t = (parts[1] && /^t\d+$/.test(parts[1]))
      ? D.taskAt(p.job, parts[1].slice(1)) : null;
    var s = (parts[1] && !t) ? D.stitchAt(p.job, parts[1]) : null;
    return { p:p, o:p.o, job:p.job, s:s, t:t };
  }
  function val(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  async function pickFile(accept){
    return new Promise(function(res){
      var inp = document.createElement('input');
      inp.type = 'file';
      if(accept) inp.accept = accept;
      inp.onchange = function(){ res(inp.files && inp.files[0]); };
      inp.click();
    });
  }
  async function upload(accept){
    var f = await pickFile(accept);
    if(!f) return null;
    say('Завантажую…');
    try{
      var url = await host().upload(f);
      return { url: url, name: f.name };
    }catch(e){
      console.error(e); say('Файл не прийнявся');
      return null;
    }
  }

  async function act(what, root, data){
    /* Нове замовлення заводять, коли на екрані ще нічого не відкрито, —
       тому воно йде ДО перевірки контексту. Створює його робоче місце: у
       відділу немає ні форми клієнта, ні нумерації, і заводити їх удруге
       означало б мати два різні «нові замовлення». */
    if(what === 'order-new'){
      if(host().newOrder) return host().newOrder();
      return say('Створення замовлення доступне з робочого місця');
    }
    var c = ctx();
    if(!c) return;
    var job = c.job, o = c.o, s = c.s, m = (host().me && host().me()) || '';

    /* ── Склад замовлення ── */
    if(what === 'ship'){
      if(host().ship) return host().ship(o);
      return say('Відправка доступна з картки замовлення');
    }
    if(what === 'u-add'){
      job.units = U.unitsOf(job).concat([U.unitNew()]);
      return save(job, o, 'Додано одиницю');
    }
    if(what === 'u-dup'){
      var src = U.unitAt(job, data && data.u);
      if(!src) return;
      /* Копія з усім: кольором, розміром, кількістю й обома списками
         дизайнів. Найчастіша дія — «те саме, але беж», і набирати все
         заново означає шанс розійтися в тому, що мало лишитись однаковим. */
      var cp = JSON.parse(JSON.stringify(src));
      cp.id = U.unitNew().id;
      var at = U.unitsOf(job).indexOf(src);
      job.units = U.unitsOf(job).slice(0, at + 1).concat([cp], U.unitsOf(job).slice(at + 1));
      return save(job, o, 'Дубль — тепер змініть, що треба');
    }
    if(what === 'u-del'){
      var del = U.unitAt(job, data && data.u);
      if(!del) return;
      job.units = U.unitsOf(job).filter(function(x){ return x !== del; });
      return save(job, o, 'Прибрано');
    }
    if(what === 'dz-add' || what === 'dz-del'){
      var pp = String((data && data.dz) || '').split('|');
      var un = U.unitAt(job, pp[0]);
      var kk = pp[1] === 'stitch' ? 'stitch' : 'graphic';
      if(!un) return;
      if(!Array.isArray(un[kk])) un[kk] = [];
      if(what === 'dz-add') un[kk].push({ name:'', side:'', mm:null, files:[] });
      else un[kk].splice(+pp[2], 1);
      return save(job, o, what === 'dz-add' ? 'Нанесення додано' : 'Прибрано');
    }
    /* Доручення тепер живе ВСЕРЕДИНІ картки замовлення, а не окремою
       карткою на дошці. Тому номер приходить не з ключа панелі, а з самої
       кнопки: на одному замовленні доручень буває кілька. */
    if(data && data.t && !c.t) c.t = D.taskAt(job, data.t);

    if(what === 'take'){
      var jl = U.pairs().map(function(x){ return x.job; });
      var r = D.takeSelf(job, o, m, jl);
      if(!r) return say('Замовлення вже комусь належить');
      if(r.full) return say('У роботі вже ' + D.TAKE_LIMIT + ' — спершу здайте котресь');
      return save(job, o, 'Узяли собі');
    }
    if(what === 'brief-save'){
      D.briefSet(job, m, val('dzBrief'));
      return save(job, o, 'ТЗ збережено');
    }
    if(what === 'brief-pic-del'){
      D.briefPicDel(job, +(data && data.i) || 0);
      return save(job, o, 'Референс прибрано');
    }
    if(what === 'brief-pic'){
      var bf = await upload('image/*');
      if(!bf) return;
      if(!D.briefPic(job, m, bf)) return say('Референсів уже досить');
      return save(job, o, 'Референс додано');
    }
    if(what === 'task-file'){
      if(!c.t) return;
      var tf = await upload('');
      if(!tf) return;
      if(!D.taskFile(job, c.t.n, m, tf)) return say('Вкладень уже досить');
      return save(job, o, 'Вкладення додано');
    }
    if(what === 'task-start'){
      if(!c.t || !D.taskStart(job, c.t.n, m)) return;
      return save(job, o, 'Взяли в роботу');
    }
    if(what === 'task-done'){
      if(!c.t) return;
      var by = val('dzClosed');
      /* Чим закрили — питаємо саме тут, а не «потім у коментарі». Доручення,
         закрите словом «готово», через рік не скаже, що ж вийшло. */
      if(!by) return say('Напишіть, чим закрили: версія, файл або фото');
      if(!D.taskDone(job, c.t.n, m, by)) return;
      return save(job, o, 'Виконано');
    }
    if(what === 'task-accept'){
      if(!c.t || !D.taskAccept(job, c.t.n, m)) return;
      return save(job, o, 'Прийнято');
    }
    if(what === 'task-return'){
      if(!c.t) return;
      var w = val('dzWhy');
      if(!w) return say('Оберіть причину — без неї повернення нічого не важить');
      if(!D.taskReturn(job, c.t.n, m, w, val('dzBack'))) return;
      return save(job, o, 'Повернуто на доопрацювання');
    }
    if(what === 'task-say'){
      if(!c.t) return;
      var txt = val('dzSay');
      if(!txt) return;
      D.taskSay(job, c.t.n, m, txt);
      return save(job, o, '');
    }
    if(what === 'task-add'){
      var kind = val('dzTKind'), to = val('dzTTo');
      if(!kind) return say('Оберіть, що доручаєте');
      if(!to) return say('Оберіть, кому: питати з відділу нема з кого');
      var t2 = D.taskAdd(job, o, m, { kind: kind, to: to, text: val('dzTText'),
                                      due: val('dzTDue'), why: val('dzTWhy') });
      if(!t2) return say('Напишіть, що саме зробити');
      return save(job, o, 'Доручення №' + t2.n + ' видано');
    }
    if(what === 'assign'){
      var who = val('dzWho');
      if(!who) return say('Оберіть дизайнера');
      D.assign(job, o, who, m, val('dzDue'));
      return save(job, o, 'Віддано в роботу');
    }
    if(what === 'brief-back'){
      D.backToSales(job, o, m, val('dzBriefNote'));
      return save(job, o, 'Повернуто продажнику');
    }
    if(what === 'start'){ D.designStart(job, m); return save(job, o, 'В роботі'); }
    if(what === 'ver-new'){ D.verNew(o, job, m); return save(job, o, 'Нова версія'); }
    if(what === 'ver-file' || what === 'ver-prev'){
      var v = D.verCur(o);
      if(!v) return say('Спершу створіть версію');
      if(D.verLocked(v)) return say('Ця версія погоджена — створіть нову');
      var f = await upload(what === 'ver-prev' ? 'image/*' : '');
      if(!f) return;
      if(what === 'ver-prev') v.wilcom = f.url;
      else (v.files || (v.files = [])).push({ kind:'art', name:f.name, url:f.url });
      D.ds(job, 'graphic-file', { n:v.n, by:m, kind: what === 'ver-prev' ? 'preview' : 'file' });
      return save(job, o, 'Додано');
    }
    if(what === 'to-review'){
      if(!D.verCur(o)) return say('Немає версії');
      D.toReview(job, o, m);
      return save(job, o, 'Віддано на перевірку');
    }
    if(what === 'mgr-ok'){
      if(!D.mgrApprove(job, o, m)) return say('Немає версії');
      return save(job, o, 'Погоджено — можна показувати клієнту');
    }
    if(what === 'revise'){
      var rs = U.pickedReasons('dzMgrR');
      if(!rs.length) return say('Оберіть причину — без неї повернення нічого не важить');
      D.revise(job, o, m, rs, U.noteOf('dzMgrNote'));
      return save(job, o, 'Повернуто на правки');
    }
    if(what === 'to-client'){
      if(!D.sendToClient(job, o, m)) return say('Спершу має погодити менеджер відділу');
      /* Не лише позначка стану: відправляємо саме те, що клієнт має
         побачити. Доти «Надіслано клієнту» означало «менеджер тепер має
         піти й надіслати» — і половину разів це «потім» тривало день. */
      var vc = D.verCur(o), pic = U.verPic(vc);
      var txt = 'Макет за замовленням №' + (o.orderId || '') +
                (vc ? ' (версія ' + vc.n + ')' : '') + '.' +
                (pic ? '\n' + pic : '') +
                '\nПодивіться, будь ласка: якщо все добре — запускаємо, ' +
                'якщо треба щось змінити, напишіть що саме.';
      if(U.host.tell) U.host.tell(o, txt);
      return save(job, o, 'Надіслано клієнту');
    }
    if(what === 'cl-ok'){
      if(!D.clientApprove(job, o, m, '')) return say('Немає версії');
      D.ensure(job, o);
      return save(job, o, 'Клієнт погодив — версію замкнено');
    }
    if(what === 'cl-changes'){
      var cr = U.pickedReasons('dzClR');
      if(!cr.length) return say('Оберіть, що саме змінити');
      D.clientChanges(job, m, cr, U.noteOf('dzClNote'));
      return save(job, o, 'Правки записано');
    }
    if(what === 's-assign'){
      if(!D.stitchAssign(job, s.key, val('dzSWho'), m, val('dzSOut')))
        return say('Спершу клієнт має погодити макет');
      return save(job, o, 'Призначено');
    }
    if(what === 's-file' || what === 's-prev'){
      var sf = await upload(what === 's-prev' ? 'image/*' : '');
      if(!sf) return;
      if(what === 's-prev') s.preview = sf.url;
      else (s.files || (s.files = [])).push({ kind:'stitch', name:sf.name, url:sf.url });
      D.ds(job, 'stitch-file', { key:s.key, by:m,
        kind: what === 's-prev' ? 'preview' : 'file' });
      return save(job, o, 'Додано');
    }
    if(what === 's-save'){
      s.stitches = Math.max(0, Math.round(+val('dzStitches') || 0));
      s.colors = val('dzColors').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
      s.notes = val('dzSNotes');
      D.ds(job, 'stitch-params', { key:s.key, by:m, stitches:s.stitches });
      return save(job, o, 'Збережено');
    }
    if(what === 's-ready'){
      if(!D.stitchReady(job, s.key, m)) return say('Спершу додайте файл — «готово» без файлу не готово');
      return save(job, o, 'На перевірці');
    }
    if(what === 'qa-ok'){
      var box = document.getElementById('dzQaC');
      var checks = {};
      if(box) box.querySelectorAll('input:checked').forEach(function(x){ checks[x.value] = true; });
      var r = D.qaPass(job, s.key, m, checks);
      if(r && r.miss) return say('Не відмічено: ' + r.miss.map(function(x){ return x.label; }).join(', '));
      return save(job, o, 'Файл пройшов перевірку');
    }
    if(what === 'qa-back'){
      var qr = U.pickedReasons('dzQaR');
      if(!qr.length) return say('Оберіть причину');
      D.qaBack(job, s.key, m, qr, U.noteOf('dzQaNote'));
      return save(job, o, 'Повернуто на правки');
    }
    if(what === 'pack'){
      var pr = D.packReady(job, o);
      if(!pr.ok) return say('Ще не готово: ' + pr.why.join('; '));
      job.pack = D.pack(job, o);
      /* Пакет їде в саме замовлення — туди, де його побачить виробництво.
         Розділу дизайну в них немає й не треба: біля машини має бути
         картка замовлення, а не ще одне вікно. */
      o.designPack = job.pack;
      D.ds(job, 'package', { by:m, items:(job.pack.items || []).length });
      /* Передача у виробництво — це ДВІ речі одночасно: цех отримує пакет,
         закупівля отримує потребу. Доти друга половина трималась на
         памʼяті менеджера, і одяг починали шукати тоді, коли цех уже стояв.

         Доручення видаємо тільки якщо одяг ще не на складі й такого
         доручення ще немає: нагадувати про зроблене — швидкий спосіб
         привчити людей не читати нагадувань. */
      var supDone = String(((o.tracks || {}).supply) || '') === 'got';
      var supHas = D.taskList(job).some(function(t){
        return t.kind === 'buy' && t.state !== 'accepted'; });
      if(!supDone && !supHas){
        var need = (o.items || []).filter(function(it){
          return (it.kind || 'main') !== 'reco'; });
        var txt = need.map(function(it){
          return [it.name, it.color, ((+it.qty || 0) + ' шт'), it.sizes]
            .filter(Boolean).join(' · '); }).join('\n');
        var buyer = (U.host.buyer && U.host.buyer()) || '';
        if(buyer && txt){
          D.taskAdd(job, o, m, { kind:'buy', to: buyer, text: txt,
                                 due: String(o.dueAt || '').slice(0, 10) });
        }
      }
      return save(job, o, 'Пакет зібрано — цех бачить, закупівлю попереджено');
    }
  }
})();
