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
  /* ── Воронка B2C ──────────────────────────────────────────────────────

     Колонки названі тим, що в них насправді відбувається, і кожна
     міняється РУКОЮ МЕНЕДЖЕРА, а не сама. Доти замовлення зʼявлялось у
     дизайнера ще до того, як його встигли зібрати: картинки не докладені,
     коментаря немає, а картка вже «у роботі».

     Правки клієнта — окрема колонка навмисно. Вони губились найчастіше:
     клієнт щось написав, менеджер переказав дизайнеру словом, і зовні
     замовлення так і стояло «у клієнта», хоч клієнт давно відповів. */
  var QUEUE = [
    { key:'new',      label:'Нові',                        color:'gray'   },
    { key:'graphic',  label:'У графічного дизайнера',      color:'blue'   },
    { key:'client',   label:'У клієнта на погодженні',     color:'amber'  },
    { key:'fixes',    label:'Правки клієнта',              color:'red'    },
    { key:'stitch',   label:'У вишивального дизайнера',    color:'violet' },
    { key:'done',     label:'Погоджено',                   color:'green', done:true }
  ];
  /* У ЯКІЙ КОЛОНЦІ СТОЇТЬ ЗАМОВЛЕННЯ.

     Виводимо з того, що справді сталось, а не з окремого поля «стан».
     Поле легко розходиться з дійсністю: його ставлять в одному місці, а
     роботу роблять у десяти. Тут навпаки — колонка не може збрехати, бо
     вона і є переказ роботи. */
  function queueAt(job){
    if(!job) return 'new';
    var units = jobUnits(job);
    var графіка = [], вишивка = [];
    units.forEach(function(u){
      dzList(u, 'graphic').forEach(function(d){ графіка.push(d); });
      dzList(u, 'stitch').forEach(function(d){ вишивка.push(d); });
    });
    /* Клієнт написав правки — це найважливіше, що зараз є на замовленні,
       хай би де воно стояло доти. */
    var правки = графіка.concat(вишивка).some(function(d){
      return d.sentAt && d.status === 'revision'; });
    if(правки) return 'fixes';
    if(вишивка.some(function(d){ return d.sentAt && d.status !== 'approved'; }))
      return 'stitch';
    var передані = графіка.filter(function(d){ return d.sentAt; });
    if(!передані.length) return 'new';
    /* Версія в клієнта — це момент, коли ми показали макет і чекаємо. */
    if(передані.some(function(d){ return d.status === 'review'; })) return 'client';
    if(передані.every(function(d){ return d.status === 'approved'; }))
      return вишивка.length ? 'stitch' : 'done';
    return 'graphic';
  }

  /* ── Дошка графічного дизайнера ─────────────────────────────────────── */
  var GRAPHIC = [
    /* Передано відділу, а не людині: висить у всіх, бере перший. */
    { key:'queue',    label:'Черга відділу',     color:'cyan'   },
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
  /* ── СТРОК ЕТАПУ ─────────────────────────────────────────────────────

     Годинник дизайнера показував, скільки лишилось, — і саме тому роботу
     там віддавали вчасно. Решта ланцюга жила без строку: замовлення могло
     лежати в закупника тиждень, і ніде це не світилось, бо ніде не було
     записано, скільки воно там має лежати.

     Мітки початку не заводимо нові — вони вже є. Кожен рух треку лягає в
     `trackHist` разом із часом, а пакет у виробництво має власну мітку.
     Заводити другий запис про те саме означало б колись побачити дві різні
     відповіді на питання «коли це почалось».

     Готовий етап годинника не має: строк стосується роботи, яка триває, а
     не тієї, що вже комусь віддана. */
  function trackFrom(o, key){
    var h = (o && o.trackHist) || [];
    for(var i = 0; i < h.length; i++)
      if(h[i] && h[i].t === key && h[i].at) return h[i].at;
    return '';
  }
  var STAGE = {
    /* Акаунт-менеджер веде замовлення від приходу до передачі у
       виробництво: далі воно вже не в нього. */
    acct: {
      from: function(job, o){ return (job && job.createdAt) || (o && o.createdAt) || ''; },
      done: function(job, o){
        return !!(job && job.pack) || !!trk(o, 'prod') || trk(o, 'ship') === 'sent'; }
    },
    supply: {
      from: function(job, o){ return trackFrom(o, 'supply'); },
      done: function(job, o){ return trk(o, 'supply') === 'got'; }
    },
    /* Виробництво рахуємо від зібраного пакета — це і є мить, коли робота
       туди потрапила. Пакета немає (старе замовлення) — від першого руху
       свого треку. */
    prod: {
      from: function(job, o){
        return (job && job.pack && job.pack.at) || trackFrom(o, 'prod'); },
      done: function(job, o){
        return trk(o, 'qc') === 'ok' || trk(o, 'ship') === 'sent'; }
    }
  };
  function stageLeft(job, o, kind, hours){
    var st = STAGE[kind];
    if(!st || !(+hours > 0)) return null;
    if(st.done(job, o)) return null;
    var f = st.from(job, o);
    if(!f) return null;
    var t = new Date(f).getTime();
    if(isNaN(t)) return null;
    /* Графік є тільки в дизайнерів — тут вихідних немає, і годинник іде
       рівно. Саме тому й передаємо порожнього виконавця. */
    return Math.round((addWorkHours(t, hours, '') - Date.now()) / 60000);
  }
  function supplyAt(o){
    var v = trk(o, 'supply');
    for(var i = 0; i < SUPPLY.length; i++) if(SUPPLY[i].key === v) return v;
    return 'todo';
  }

  /* ── Воронка приватного замовлення ────────────────────────────────────

     Колонки названі тим, що в них насправді відбувається, і кожна
     міняється рукою менеджера, а не сама. «Дизайн» не казав, у кого саме
     замовлення лежить; «У клієнта» не відрізняло «чекаємо відповіді» від
     «клієнт уже відповів і просить зміни» — а це різні за терміновістю
     речі, і саме правки губились найчастіше. */
  var CHAIN = [
    { key:'new',     label:'Нове',                      color:'gray'   },
    { key:'design',  label:'У графічного дизайнера',    color:'blue'   },
    { key:'client',  label:'У клієнта на погодженні',   color:'amber'  },
    { key:'fixes',   label:'Правки клієнта',            color:'red'    },
    { key:'stitch',  label:'У вишивального дизайнера',  color:'violet' },
    { key:'prod',    label:'Виробництво',               color:'cyan'   },
    { key:'ready',   label:'До відправки',              color:'amber'  },
    { key:'shipped', label:'Відправлено',               color:'green', done:true }
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
    /* ДАЛІ — ЗА ТИМ, ЩО СПРАВДІ СТАЛОСЬ ІЗ ДИЗАЙНАМИ, а не за окремим
       полем «стан». Поле ставлять в одному місці, а роботу роблять у
       десяти, і рано чи пізно вони розходяться — тоді дошка починає
       брехати. Тут вона не може: колонка і є переказ роботи. */
    var d = designStage(job);
    if(d) return d;
    /* Дизайнів ще немає зовсім — рішення лишається за станом задачі, як
       було доти. Інакше щойно заведене замовлення одразу опинялось би «у
       графічного дизайнера», хоч йому ще нічого не передавали. */
    if(job && job.state === 'client') return 'client';
    if(job && job.state === 'new') return 'new';
    return 'design';
  }
  /* У якій із дизайнерських колонок стоїть замовлення. Порожньо — значить
     дизайнів ще немає зовсім, і рішення лишається за старим полем. */
  function designStage(job){
    var графіка = [], вишивка = [];
    jobUnits(job).forEach(function(u){
      dzList(u, 'graphic').forEach(function(x){ графіка.push(x); });
      dzList(u, 'stitch').forEach(function(x){ вишивка.push(x); });
    });
    if(!графіка.length && !вишивка.length) return '';
    /* Клієнт написав правки — це найважливіше, що зараз є на замовленні,
       хай би де воно стояло доти. */
    if(графіка.concat(вишивка).some(function(x){
      return x.sentAt && x.status === 'revision'; })) return 'fixes';
    if(вишивка.some(function(x){ return x.sentAt && x.status !== 'approved'; }))
      return 'stitch';
    /* У черзі відділу ще ніхто не працює — замовлення лишається «Новим»,
       а в «У графічного дизайнера» переходить само, щойно хтось узяв. */
    var передані = графіка.filter(function(x){ return x.sentAt && !dzInQueue(x); });
    if(!передані.length) return 'new';
    if(передані.some(function(x){ return x.status === 'review'; })) return 'client';
    if(передані.every(function(x){ return x.status === 'approved'; }))
      return вишивка.length ? 'stitch' : 'prod';
    return 'design';
  }
  /* Хто зараз тримає замовлення. Питання «а чиє це» має мати відповідь у
     кожній колонці — інакше воно щодня ставиться вголос. */
  var CHAIN_WHO = {
    new:'акаунт-менеджер', design:'графічний дизайнер', client:'клієнт',
    fixes:'графічний дизайнер', stitch:'вишивальний дизайнер',
    prod:'виробництво', qc:'акаунт-менеджер', ready:'виробництво', shipped:'—'
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
  /* Картинки до одного типу одягу. Правило те саме, що й для замовлення:
     дюжини вистачить, далі це вже не референс, а звалище. */
  function unitPic(u, pic){
    if(!u || !pic || !pic.url) return null;
    if(!Array.isArray(u.pics)) u.pics = [];
    if(u.pics.length >= 12) return null;
    u.pics.push({ name: String(pic.name || ''), url: String(pic.url) });
    return u;
  }
  function unitPicDel(u, i){
    if(!u || !Array.isArray(u.pics)) return null;
    u.pics.splice(i, 1);
    return u;
  }
  /* ══════════ ОДИН ДИЗАЙН — ОДНА РОЗМОВА Й СВОЇ ВЕРСІЇ ══════════

     Найдрібніша одиниця роботи тут — ОДНЕ НАНЕСЕННЯ: логотип на груди,
     напис на спину. Саме про нього менеджер пише правку, саме його малює
     дизайнер і саме його показують клієнту.

     Доти розмова й версії жили на всьому замовленні. На замовленні з
     двома-трьома нанесеннями це відразу ламалось: «переробіть, завеликий» —
     а що завелике? «Версія 2» — чого версія? Дизайнер мусив вгадувати, і
     вгадував не завжди. Тому і правка, і версія тепер належать конкретному
     дизайну, а не купі.

     Версії є і в графічних, і у вишивальних: оцифрування теж повертають на
     переробку, і теж треба знати, котрий файл останній. */
  /* Склад замовлення — те саме, що бачить панель. Свій доступ тут навмисно:
     ядро не має залежати від шару, який його ж і малює. */
  function jobUnits(job){ return Array.isArray(job && job.units) ? job.units : []; }
  function dzId(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function dzNew(){
    return { id: dzId(), name:'', side:'', mm:null, files:[],
             who:'', sentAt:'', sentBy:'', status:'new',
             vers:[], thread:[], ok:null };
  }
  function dzList(u, kind){
    var k = kind === 'stitch' ? 'stitch' : 'graphic';
    if(!u) return [];
    if(!Array.isArray(u[k])) u[k] = [];
    /* Дизайни, заведені до появи розмов, приходять без цих полів. Краще
       дописати їх тут, ніж класти `d.vers || []` у двадцяти місцях. */
    u[k].forEach(function(d){
      if(!d.id) d.id = dzId();
      if(!Array.isArray(d.vers)) d.vers = [];
      if(!Array.isArray(d.thread)) d.thread = [];
      if(!Array.isArray(d.files)) d.files = [];
      if(!d.status) d.status = d.who ? 'work' : 'new';
    });
    return u[k];
  }
  function dzAt(u, kind, i){ return dzList(u, kind)[+i] || null; }
  function dzName(d, i){
    return String((d && d.name) || '').trim() || ('Нанесення ' + ((+i || 0) + 1));
  }
  /* ПРИКРІПИТИ ДИЗАЙНЕРА — ЩЕ НЕ ПЕРЕДАТИ.

     Це дві різні дії, і плутати їх не можна. Прикріпили — людина має доступ
     і бачить, що на неї щось збирають; передали — ТЗ поїхало, робота
     почалась, картка зрушила на дошці.

     Доти цього поділу не було, і замовлення зʼявлялось у дизайнера ще до
     того, як менеджер устиг зібрати ТЗ: картинки не докладені, коментаря
     немає, а робота вже «в роботі». Тепер поки не натиснуто «Відправити
     дизайнеру» — у нього нічого не рухається. */
  function dzAttach(d, who, by, name){
    if(!d || !who) return null;
    var був = d.who;
    d.who = String(who);
    d.attachedBy = String(by || '');
    d.attachedAt = nowIso();
    /* Призначення — теж подія розмови, а не тихе поле. Доти воно ніде не
       лишало сліду: дизайнер відкривав картку й бачив роботу, не знаючи, коли
       і від кого вона взялась, а менеджер через тиждень не міг сказати, чи
       передавав узагалі. */
    /* Кладемо пошту, а не готовий напис: імена в команді міняються, а
       пошта ні. Підпис збирається при показі — тоді він завжди свіжий. */
    if(був !== d.who)
      d.thread.push({ at: d.attachedAt, by: String(by || ''), kind:'who',
                      who: d.who, text: 'Виконавець — ' + String(name || who),
                      seen: [String(by || '')] });
    return d;
  }
  /* Передати. Імʼя тут важить: «передали дизайнерам» — це нікому, і роботу
     піднімає той, хто першим помітив. */
  function dzSend(d, by){
    if(!d || !d.who) return null;
    d.sentBy = String(by || '');
    d.sentAt = nowIso();
    /* ПЕРЕДАЛИ — ЩЕ НЕ «В РОБОТІ».

       Доти передача одразу ставила «в роботі», і дошка дизайнера брехала:
       картка виглядала взятою, хоч людина її ще не бачила. Різниця важлива
       рівно тоді, коли строк горить: «передали годину тому й тиша» і
       «робить уже годину» — це два різні дзвінки.

       Тепер передане чекає в «Нових», поки дизайнер не скаже «беру». */
    if(d.status === 'new' || d.status === 'revision') d.status = 'sent';
    d.thread.push({ at: d.sentAt, by: String(by || ''), kind:'sent',
                    text: 'Передано в роботу', seen: [String(by || '')] });
    return d;
  }
  /* ── СТРОК ДИЗАЙНЕРА ────────────────────────────────────────────────────

     Це НЕ той строк, що стоїть у шапці замовлення. Клієнту ми обіцяємо
     готову посилку через два тижні; дизайнеру на макет дається доба — і
     саме її він має бачити, бо на «до 14 жовтня» сьогодні не реагує ніхто.

     Рахуємо від ПЕРЕДАЧІ, а не від підтвердження. Інакше годинник вмикає
     сам виконавець: не натиснув «беру» — і строк не йде, хоч робота вже
     лежить. Правки починають свій відлік наново: повернули о шостій —
     доба йде з шостої, а не з позавчора.

     Скільки саме годин — число з налаштувань. Доба це домовленість, а не
     закон природи, і міняти її не має означати правку коду. */
  var DZ_HOURS = 24;
  function dzFrom(d){
    if(!d || !d.sentAt) return '';
    /* Остання правка від когось іншого перезапускає годинник: те, що
       прийшло після здачі версії, — це нова робота, а не прострочена. */
    var from = d.sentAt;
    (d.thread || []).forEach(function(m){
      /* Годинник перезапускає лише правка МЕНЕДЖЕРА: своє слово дизайнера
         (питання, уточнення) його строку не подовжує. */
      if((m.kind === 'fix' && msgRole(m, d) === 'acct') || m.kind === 'sent' || m.kind === 'queue')
        from = m.at || from;
    });
    return from;
  }
  /* ── ГРАФІК ДИЗАЙНЕРА ────────────────────────────────────────────────

     Строк у добу, виданий у пʼятницю ввечері, у понеділок уранці вже
     прострочений — хоча ніхто нічого не порушив: людина не працює у
     вихідні, і ми про це знаємо. Годинник, який кричить на того, хто ні в
     чому не винен, перестають читати взагалі, і тоді він не працює й тоді,
     коли справді треба.

     Тому в дизайнера є графік: він сам відмічає, які дні працює. У
     невідмічені дні годинник СТОЇТЬ — не «прощає» заднім числом, а саме
     не тікає. Видали в пʼятницю о 17:00 з добою — здати треба до
     понеділка 17:00.

     Графік питаємо в робочого місця: відділ не знає нічого про команду й
     знати не мусить. Немає графіка — вихідних немає, усе як доти. */
  /* Ядро не знає ні команди, ні налаштувань — і знати не мусить. Графік
     воно питає гачком, який ставить робоче місце; гачка немає — вихідних
     немає, і все працює рівно як доти. */
  var DAY_OFF = null;
  function setDayOff(fn){ DAY_OFF = (typeof fn === 'function') ? fn : null; }
  function offDay(who, d){
    if(!DAY_OFF) return false;
    try{ return !!DAY_OFF(String(who || ''), calISO(d)); }
    catch(e){ return false; }
  }
  function calISO(d){
    return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) +
      '-' + (d.getDate() < 10 ? '0' : '') + d.getDate();
  }
  function dayStart(t){
    var d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  /* Додати `hours` РОБОЧИХ годин від мітки, пропускаючи вихідні цілком.
     Ідемо по днях, а не по хвилинах: днів тут щонайбільше кілька десятків,
     а хвилин — десятки тисяч, і різниця в тому, чи встигне сторінка
     намалюватись. Стелю ставимо навмисно: графік, у якому відмічено все
     підряд вихідними, не має підвішувати браузер назавжди. */
  var OFF_MAX = 400;
  function addWorkHours(from, hours, who){
    var лишилось = Math.max(1, +hours || DZ_HOURS) * 3600000;
    var t = new Date(from);
    var кроків = 0;
    while(лишилось > 0 && кроків++ < OFF_MAX){
      if(offDay(who, t)){
        t = dayStart(t.getTime() + 86400000);
        continue;
      }
      var кінець = dayStart(t).getTime() + 86400000;
      var вільно = кінець - t.getTime();
      if(вільно >= лишилось) return t.getTime() + лишилось;
      лишилось -= вільно;
      t = new Date(кінець);
    }
    return t.getTime();
  }
  /* Скільки РОБОЧОГО часу між двома мітками. Вихідні не рахуються: у них
     годинник стоїть, а не тікає повільніше. */
  function workMs(from, to, who){
    if(to <= from) return to - from;
    var сума = 0;
    var t = new Date(from);
    var кроків = 0;
    while(t.getTime() < to && кроків++ < OFF_MAX){
      var кінець = Math.min(dayStart(t).getTime() + 86400000, to);
      if(!offDay(who, t)) сума += кінець - t.getTime();
      t = new Date(кінець);
    }
    return сума;
  }
  function dzDue(d, hours){
    var f = dzFrom(d);
    if(!f) return 0;
    var t = new Date(f).getTime();
    if(isNaN(t)) return 0;
    return addWorkHours(t, hours, d && d.who);
  }
  /* Скільки лишилось — у хвилинах. Відʼємне означає «прострочено на».
     Затверджене й здане більше не тікає: строк стосується роботи, яка
     триває, а не тієї, що вже в менеджера. */
  function dzLeft(d, hours){
    if(!d || !d.sentAt) return null;
    if(d.status === 'approved' || d.status === 'review') return null;
    var due = dzDue(d, hours);
    if(!due) return null;
    /* У вихідний лічильник стоїть на місці: між «зараз» і строком
       рахуємо тільки робочий час. Прострочення ж — реальне: якщо строк
       уже позаду, глибину його ховати нема за чим. */
    var зараз = Date.now();
    if(due <= зараз) return Math.round((due - зараз) / 60000);
    return Math.round(workMs(зараз, due, d && d.who) / 60000);
  }
  /* ── ВЗЯВ / НЕ БЕРУ ─────────────────────────────────────────────────────

     Дизайнер не мовчазний приймач роботи. Він може бути завантажений,
     хворий або просто не робити цей тип нанесення — і тоді замовлення
     мусить повернутись менеджеру ЗАРАЗ, а не за добу, коли строк уже
     вийшов і ніхто нічого не малював.

     Тому дві кнопки, і обидві однаково законні. «Беру» вмикає роботу;
     «Не братиму» знімає дизайнера й повертає рядок менеджеру порожнім —
     із причиною в розмові, щоб наступного разу віддали комусь іншому. */
  function dzTake(d, by){
    if(!d || !d.sentAt) return null;
    if(d.status !== 'sent' && d.status !== 'revision') return d;
    d.status = 'work';
    d.takenAt = nowIso();
    d.thread.push({ at: d.takenAt, by: String(by || ''), kind:'take',
                    text: 'Взяв у роботу', seen: [String(by || '')] });
    return d;
  }
  /* ══════════ ЧЕРГА ВІДДІЛУ ══════════

     Андрій: «ми їх перевели, щоб дизайнери самі могли брати ці
     замовлення… воно висить в них, що вони можуть взяти це замовлення».

     Передати можна не людині, а ВІДДІЛУ: виконавця немає, робота висить у
     черзі в усіх графічних дизайнерів, і перший, хто натиснув «Беру»,
     стає виконавцем. Годинник іде з миті передачі у відділ — черга не
     місце, де замовлення лежить непомітно, — і зупиняється, коли роботу
     здали на перевірку, як і в переданої людині.

     Відмовитись від взятого дизайнер не може. Забрати роботу — тільки
     акаунт-менеджер: повернути в чергу або віддати іншому. */
  function dzInQueue(d){ return !!(d && d.pool && !d.who && d.sentAt); }
  function dzQueue(d, by){
    if(!d) return null;
    d.who = ''; d.pool = true;
    d.sentBy = String(by || '');
    d.sentAt = nowIso();
    if(d.status === 'new' || d.status === 'revision' || d.status === 'work' || !d.status) d.status = 'sent';
    d.thread.push({ at: d.sentAt, by: String(by || ''), kind:'queue',
                    text: 'Передано у відділ — чекає, хто візьме', seen: [String(by || '')] });
    return d;
  }
  /* «Беру» з черги. Хтось устиг раніше — повертаємо його, і нічого не
     чіпаємо: друге натискання не має перебивати перше. */
  function dzClaim(d, by){
    if(!d || !by) return null;
    if(d.who && d.who !== String(by)) return { taken: d.who };
    if(!dzInQueue(d)) return d.who === String(by) ? d : null;
    d.who = String(by); d.pool = false;
    d.status = 'work';
    d.takenAt = nowIso();
    d.thread.push({ at: d.takenAt, by: String(by), kind:'take',
                    text: 'Взяв у роботу з черги', seen: [String(by)] });
    return d;
  }
  /* Акаунт-менеджер забирає роботу в дизайнера. Версії лишаються при
     дизайні — це історія роботи, а не власність людини. Годинник
     починається наново: наступному виконавцю доба від його старту, а не
     від чужого. */
  function dzRecall(d, by, toWho, name){
    if(!d) return null;
    var був = d.who;
    if(!toWho){
      d.who = ''; d.pool = true;
      d.sentBy = String(by || ''); d.sentAt = nowIso();
      if(d.status !== 'approved') d.status = 'sent';
      d.thread.push({ at: d.sentAt, by: String(by || ''), kind:'queue',
                      text: (був ? 'Забрано в ' + String(name || був) + ' · ' : '') +
                            'повернуто в чергу відділу', seen: [String(by || '')] });
      return d;
    }
    if(toWho === був) return d;
    d.pool = false;
    dzAttach(d, toWho, by, name);
    d.sentBy = String(by || ''); d.sentAt = nowIso();
    if(d.status !== 'approved') d.status = 'sent';
    d.thread.push({ at: d.sentAt, by: String(by || ''), kind:'sent',
                    text: 'Передано в роботу', seen: [String(by || '')] });
    return d;
  }
  /* ЗАПОВНИЛИ — І ВОНО ПІШЛО. Андрій: «як тільки заповнили замовлення…
     вони самі можуть взяти його». Позиція стає в чергу сама, щойно в ній
     є що малювати: обрано виріб і є ТЗ — слова або хоча б картинка (своя
     чи загальна до замовлення). Без ТЗ не ставимо: інакше дизайнер
     схопить половину, поки менеджер ще пише.

     Тільки поки замовлення ще «Нове» і в позиції немає жодного рішення
     менеджера: обрав людину чи вже поставив у чергу — це його слово, і
     автоматика його не перебиває. Старі замовлення, що давно поїхали
     далі, теж не чіпаємо. */
  function unitFilled(job, u){
    if(!u || !u.gid) return false;
    var b = (job && job.brief) || {};
    return !!(String(u.note || '').trim() || (u.pics || []).length ||
              String(b.text || '').trim() || (b.pics || []).length);
  }
  function dzAutoQueue(job, o, by){
    if(!job || chainAt(job, o) !== 'new') return 0;
    var n = 0;
    jobUnits(job).forEach(function(u){
      if(!unitFilled(job, u)) return;
      var l = dzList(u, 'graphic');
      if(l.length) return;
      var d = dzNew();
      l.push(d);
      dzQueue(d, by);
      d.auto = true;
      d.thread[d.thread.length - 1].text = 'Замовлення заповнене — стало в чергу відділу';
      n++;
    });
    return n;
  }
  function dzDecline(d, by, why){
    if(!d) return null;
    var хто = d.who;
    d.thread.push({ at: nowIso(), by: String(by || ''), kind:'no',
                    text: 'Не братиму' + (why ? ': ' + String(why) : ''),
                    seen: [String(by || '')] });
    /* Знімаємо і виконавця, і передачу: інакше рядок лишається «переданим»
       нікому, і менеджер бачить роботу в дорозі, якої ніхто не везе. */
    d.who = ''; d.sentAt = ''; d.sentBy = '';
    d.status = 'new';
    d.declinedBy = String(хто || '');
    return d;
  }
  /* Чи це замовлення вже пішло в роботу — хоч одним дизайном свого виду.
     Саме за цим дошка дизайнера й вирішує, показувати картку чи ні. */
  function sentAny(job, kind){
    return jobUnits(job).some(function(u){
      return dzList(u, kind).some(function(d){ return !!d.sentAt; });
    });
  }
  /* ЧИ ЧЕКАЄ ХТОСЬ НА ВІДПОВІДЬ.

     Дизайнер питає в розмові по дизайну й лишається без відповіді — робота
     стоїть, а з дошки цього не видно зовсім: картка так і висить «у
     роботі». Тому питаємо дані: останнє слово не наше, відповіді на нього
     не було, і минуло більш як півдня. */
  var WAIT_MS = 12 * 3600 * 1000;
  function waiting(job, forEmail){
    var out = 0;
    jobUnits(job).forEach(function(u){
      ['graphic','stitch'].forEach(function(k){
        dzList(u, k).forEach(function(d){
          var last = (d.thread || [])[d.thread.length - 1];
          if(!last || !last.at) return;
          if(forEmail && String(last.by || '') === String(forEmail)) return;
          if(last.kind === 'ok') return;          // погодження відповіді не чекає
          if(Date.now() - new Date(last.at).getTime() < WAIT_MS) return;
          out++;
        });
      });
    });
    return out;
  }
  /* Нова версія. Номер послідовний і НЕ переривається: клієнт каже «беремо
     другу», і другою має лишитись саме та, яку він бачив. */
  /* Файлів у версії буває кілька: сам макет і мокап на виріб. Приймаємо і
     один, і список — інакше дизайнер здавав би їх двома версіями, і номер,
     який ми називаємо клієнту, зростав би вдвічі швидше за роботу. */
  function dzVer(d, by, file, note, place, role){
    if(!d) return null;
    var n = d.vers.length + 1;
    var список = (Array.isArray(file) ? file : (file ? [file] : []))
      .filter(function(f){ return f && f.url; })
      .map(function(f){
        var x = { name:String(f.name || ''), url:String(f.url) };
        if(f.role) x.role = String(f.role);
        if(f.hash) x.hash = String(f.hash);
        return x; });
    d.vers.push({ n: n, at: nowIso(), by: String(by || ''),
                  files: список,
                  /* Розміщення їде РАЗОМ із версією, а не окремо збоку.
                     Версій буває чотири, і в кожної своє розташування; одне
                     число «на дизайн» означало б, що виробництво шиє за
                     міркою від макета, який уже переробили. */
                  place: place || null,
                  note: String(note || '') });
    d.status = 'review';
    d.thread.push({ at: nowIso(), by: String(by || ''), kind:'ver',
                    text: 'Версія ' + n, seen: [String(by || '')],
                    role: role ? String(role) : undefined });
    return d;
  }
  /* ФАЙЛИ ВЕРСІЇ — ЗА РОЛЛЮ, А НЕ ЗА НОМЕРОМ.

     Доти «третій файл» вважався аркушем, другий — мокапом, перший —
     макетом. Так клала файли стара здача. Нова кладе інакше: спершу мокапи
     кожної сторони, потім самі роботи, — і на виробі з переду й спини
     «третім» ставала робота: картка показувала її замість аркуша, а
     клієнту їхав голий файл. Тепер кожен файл знає, що він такое (`role`),
     а старі версії розпізнаються за тим, як їх клала своя здача. */
  function verParts(v){
    var fs = (v && v.files) || [];
    var хеш = fs.some(function(f){ return f && f.hash; });
    var out = { work: [], mock: [], sheet: null };
    fs.forEach(function(f, i){
      if(!f || !f.url) return;
      var r = f.role ||
        (/^аркуш/i.test(String(f.name || '')) ? 'sheet'
          : хеш ? (f.hash ? 'work' : 'mock')
          : (i === 0 ? 'work' : i === 1 ? 'mock' : 'sheet'));
      if(r === 'sheet'){ if(!out.sheet) out.sheet = f; }
      else if(r === 'work') out.work.push(f);
      else out.mock.push(f);
    });
    return out;
  }
  /* ХТО СКАЗАВ — РОЛЬ, А НЕ ЛЮДИНА.

     Андрій тестує всіма ролями з однієї пошти, і «моє» за поштою ставило
     праворуч усе: не видно, хто що пише. Та й у житті це правильніше:
     менеджер, що підміняє колегу, — все одно «наш бік». Нові повідомлення
     несуть роль; старі розпізнаємо так: написав виконавець цього дизайну
     або це версія — дизайнер, інакше — акаунт-менеджер. */
  function msgRole(m, d, kind){
    if(m && m.role) return String(m.role);
    var k = kind === 'stitch' ? 'stitch' : 'graphic';
    if(m && m.kind === 'ver') return k;
    if(m && d && m.by && String(m.by) === String(d.who || '')) return k;
    return 'acct';
  }
  /* Що рахується пропущеним: слова, файли й здані версії. Події («передано»,
     «взяв», «погоджено») — не повідомлення, і світитись від них нема чого. */
  var TALK = ['fix', 'file', 'note', 'ver', 'msg'];
  function dzVerFile(d, n, file){
    var v = d && d.vers.filter(function(x){ return x.n === +n; })[0];
    if(!v || !file || !file.url) return null;
    v.files.push({ name:String(file.name || ''), url:String(file.url) });
    return d;
  }
  /* Правка або просто слово. Менеджер копіює сюди те, що написав клієнт, —
     і воно лежить при тому дизайні, якого стосується. */
  function dzSay(d, by, text, file, role){
    if(!d || (!text && !file)) return null;
    d.thread.push({ at: nowIso(), by: String(by || ''), kind: text ? 'fix' : 'file',
                    text: String(text || ''),
                    file: file ? { name:String(file.name || ''), url:String(file.url) } : null,
                    seen: [String(by || '')], role: role ? String(role) : undefined });
    /* Правка повертає дизайн у роботу: інакше він лишається «на перевірці»,
       хоч перевірка вже сказала своє. Андрій: будь-яке слово менеджера
       дизайнеру — це правка («або правку, або сказав щось скинути»), тож і
       роботу, яка ще йде, воно ставить у «Правки» з новим відліком. */
    if(d.status === 'review' || (role === 'acct' && d.status === 'work')) d.status = 'revision';
    return d;
  }
  /* Затвердження. Його дає або клієнт, або акаунт-менеджер — вони обидва
     читають ту саму переписку, і чекати саме клієнтського «так» у месенджері
     означало б зупиняти роботу через формальність. */
  function dzOk(d, by, how, ver){
    if(!d) return null;
    var n = +ver || (d.vers.length ? d.vers[d.vers.length - 1].n : 0);
    d.ok = { at: nowIso(), by: String(by || ''),
             how: how === 'client' ? 'client' : 'acct', ver: n };
    d.status = 'approved';
    d.thread.push({ at: d.ok.at, by: String(by || ''), kind:'ok',
                    text: (how === 'client' ? 'Клієнт погодив' : 'Погодив акаунт-менеджер') +
                          (n ? ' · версія ' + n : ''), seen: [String(by || '')] });
    return d;
  }
  /* ПРОСТО СЛОВО, А НЕ ПОВЕРНЕННЯ РОБОТИ.

     `dzSay` означає «поверніть і переробіть»: вона кидає дизайн у «правки»
     й рухає картку на дошці. Але менеджер пише й інше — «клієнт поїхав,
     відповість завтра», «зроби спершу спину». Якщо кожне таке слово
     повертає роботу, дизайнер щоразу кидає те, що робить, а дошка бреше
     про стан. */
  function dzNote(d, by, text, file, role){
    if(!d) return null;
    var t = String(text || '').trim();
    if(!t && !(file && file.url)) return d;
    d.thread.push({ at: nowIso(), by: String(by || ''), kind:'note',
                    text: t, file: (file && file.url) ? file : null,
                    seen: [String(by || '')], role: role ? String(role) : undefined });
    return d;
  }
  /* ПОКАЗАЛИ КЛІЄНТУ — ЦЕ ОКРЕМА ПОДІЯ, А НЕ ПРАВКА.

     Доти вона писалась через `dzSay`, тобто тією самою позначкою, що й
     «поверніть і переробіть». У розмові різниці не видно, а в історії
     виходило, що кожен показ клієнту — це повернення роботи: два покази
     давали «дві правки», і за цим числом судили про дизайнера. */
  function dzTold(d, by, n){
    if(!d) return null;
    d.thread.push({ at: nowIso(), by: String(by || ''), kind:'tell',
                    text: 'Надіслано клієнту · версія ' + (+n || d.vers.length),
                    seen: [String(by || '')] });
    return d;
  }
  function dzUnok(d){
    if(!d) return null;
    d.ok = null;
    if(d.status === 'approved') d.status = d.vers.length ? 'review' : 'work';
    return d;
  }
  /* Скільки в цій розмові непрочитаного для конкретної людини. Саме за цим
     числом картка дизайнера піднімається вгору й позначається. */
  /* З роллю — пропущене для людини В ЦІЙ РОЛІ: те, що написала інша роль,
     і що в цій ролі ще не відкривали. Прочитане позначається й поштою, й
     «пошта|роль»: один і той самий тестувальник у двох ролях бачить своє
     непрочитане в кожній окремо, а звичайна людина — як і доти. */
  function dzUnseen(d, email, role, kind){
    var me = String(email || '');
    if(!me || !d) return 0;
    var tok = role ? me + '|' + role : '';
    return (d.thread || []).filter(function(m){
      if(!role) return String(m.by || '') !== me && (m.seen || []).indexOf(me) < 0;
      if(TALK.indexOf(m.kind) < 0) return false;
      if(msgRole(m, d, kind) === role) return false;
      var seen = m.seen || [];
      if(seen.indexOf(tok) >= 0) return false;
      if(String(m.by || '') !== me && seen.indexOf(me) >= 0) return false;
      return true;
    }).length;
  }
  function dzSeen(d, email, role){
    var me = String(email || '');
    if(!me || !d) return null;
    var tok = role ? me + '|' + role : '';
    (d.thread || []).forEach(function(m){
      if(!Array.isArray(m.seen)) m.seen = [];
      if(m.seen.indexOf(me) < 0 && String(m.by || '') !== me) m.seen.push(me);
      if(tok && m.seen.indexOf(tok) < 0) m.seen.push(tok);
    });
    return d;
  }
  /* Чи готова графіка цієї одиниці. Вишивальному передавати нема чого, поки
     графіку не затвердили: оцифровувати доведеться те, що ще поміняють, і
     вся робота піде в кошик. Якщо графічних дизайнів на виробі немає зовсім
     — чекати нема на що. */
  function graphicOk(u){
    var g = dzList(u, 'graphic');
    if(!g.length) return true;
    return g.every(function(d){ return !!d.ok; });
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
      /* Коментар менеджера до всього замовлення й термін, до якого його
         чекають. Це не ТЗ: ТЗ каже, ЩО малювати, а ці двоє — те, що має
         йти разом із замовленням далі по ланцюгу й бути видно з першого
         погляду, не розгортаючи нічого. */
      note: '', due: '',
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
    QUEUE: QUEUE, GRAPHIC: GRAPHIC, STITCH: STITCH, queueAt: queueAt,
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
    unitPic: unitPic, unitPicDel: unitPicDel,
    dzNew: dzNew, dzList: dzList, dzAt: dzAt, dzName: dzName,
    dzAttach: dzAttach, dzSend: dzSend, sentAny: sentAny, waiting: waiting,
    /* Строк дизайнера й дві його відповіді на передачу. */
    dzTake: dzTake, dzDecline: dzDecline,
    dzInQueue: dzInQueue, dzQueue: dzQueue, dzClaim: dzClaim, dzRecall: dzRecall,
    verParts: verParts, msgRole: msgRole,
    dzAutoQueue: dzAutoQueue, unitFilled: unitFilled, dzDue: dzDue, dzLeft: dzLeft, dzTold: dzTold,
    DZ_HOURS: DZ_HOURS,
    dzVer: dzVer, dzVerFile: dzVerFile, dzSay: dzSay, dzOk: dzOk, dzUnok: dzUnok,
    dzUnseen: dzUnseen, dzSeen: dzSeen, graphicOk: graphicOk, dzNote: dzNote,
    offDay: offDay, setDayOff: setDayOff,
    stageLeft: stageLeft, trackFrom: trackFrom, STAGE: STAGE,
    addWorkHours: addWorkHours, workMs: workMs,
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
  function can(k){ return host.can ? !!host.can(k) : true; }
  /* ЧАС — КИЇВСЬКИЙ, А НЕ ТОЙ, ЩО НА ПРИСТРОЇ.

     Андрій: «CRM щоб працювала по київському часу, всі діалоги і т. д.».

     Без цього те саме повідомлення в Києві підписане 14:30, а в дизайнера,
     який поїхав до Польщі, — 13:30. Люди починають звірятись між собою й
     виходить, що «о котрій ти написав» немає однієї відповіді. А строки
     рахуються від міток, і зсув на годину в кінці доби — це вже інший день.

     Тому всюди одна зона. Не «за замовчуванням», а завжди: ноутбук у
     відпустці не має міняти час у замовленні. */
  var TZ = 'Europe/Kyiv';
  function dt(s){
    if(!s) return '';
    var d = new Date(s);
    if(isNaN(d)) return '';
    return d.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', timeZone:TZ }) + ' ' +
           d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit', timeZone:TZ });
  }

  /* Тільки година й хвилина. На кнопці «Надіслано» повний штамп із датою
     не вміщається й не потрібен: показують макет у той самий день, коли
     здали, а точну дату завжди видно в підказці й у стрічці. */
  function hhmm(s){
    if(!s) return '';
    var d = new Date(s);
    if(isNaN(d)) return '';
    return d.toLocaleTimeString('uk-UA', { hour:'2-digit', minute:'2-digit', timeZone:TZ });
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
  /* ── ПОШУК ПО ДОШЦІ ──────────────────────────────────────────────────

     Двадцять карток у пʼяти колонках, і потрібну шукають очима по всіх
     одразу. А знають про неї рівно те, чим її назвав клієнт у розмові:
     номер, нік, імʼя або телефон. Тому шукаємо по всьому цьому разом і
     ховаємо решту — не підсвічуємо: підсвітка серед двадцяти карток це та
     сама робота очима, тільки з натяком.

     Живе в памʼяті вкладки: це те, що людина шукає ЗАРАЗ. Записане в базу,
     воно означало б, що сусідній менеджер відкриє відділ із чужим
     фільтром і побачить порожню дошку. */
  var SEEK = '';
  function seek(){ return SEEK; }
  function seekSet(v){ SEEK = String(v == null ? '' : v).trim(); }
  function seekHit(c){
    if(!SEEK) return true;
    var q = SEEK.toLowerCase();
    var p = pairOf(c && c.id);
    var o = (p && p.o) || {};
    var job = (p && p.job) || {};
    return [c && c.title, c && c.nick, o.orderId, o.name, o.company, o.phone,
            o.crmNick, o.ig, o.crmChatName, job.no]
      .some(function(x){
        return String(x == null ? '' : x).toLowerCase().indexOf(q) >= 0;
      });
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
    /* «1 дн 0 год» — сміття: нуль тут не додає нічого, крім довжини. */
    var г = h % 24;
    return Math.floor(h / 24) + ' дн' + (г ? ' ' + г + ' год' : '');
  }

  /* ── Дошка ─────────────────────────────────────────────────────────── */
  /* Дата коротко: «14.10». Рік на дошці не потрібен — усе, що далі за рік,
     там і не стоїть. */
  function dueShort(v){
    var d = new Date(String(v || '') + 'T00:00:00');
    if(isNaN(d)) return String(v || '');
    return d.toLocaleDateString('uk-UA', { timeZone:'Europe/Kyiv', day:'2-digit', month:'2-digit' });
  }
  function boardHtml(steps, cards){
    return '<div class="dz-board">' + steps.map(function(s){
      var mine = cards.filter(function(c){ return c.step === s.key; });
      return '<div class="dz-col" data-col="' + esc(s.key) + '">' +
        '<div class="dz-col-h"><span class="dz-dot is-' + esc(s.color) + '"></span>' +
          esc(s.label) + '<i>' + mine.length + '</i></div>' +
        '<div class="dz-col-b">' +
          (mine.length ? mine.map(function(c){
            /* Строк, розмова, непрочитане й «чекають на відповідь» — на
               самій картці. Це саме ті питання, які задають дошці: що
               горить, де стоїть і кому писати. Відповідати на них
               відкриванням кожної картки означає не відповідати зовсім. */
            /* НА ПЛИТЦІ — СКІЛЬКИ ЛИШИЛОСЬ, А НЕ ДО ЯКОГО ЧИСЛА.

               Андрій: «щоб писалося не дата до такого-то числа, а скільки
               днів залишилось». Двадцять плиток на дошці — це двадцять
               віднімань подумки, і саме те, у якому помилились, і горить. */
            var лишок = c.due ? leftTxt(c.due) : null;
            /* СТРОК ДИЗАЙНЕРА — ГОДИННИК, А НЕ ДАТА.

               «До 14 жовтня» сьогодні не означає нічого й не рухає нікого.
               «Лишилось 5 год» рухає — і саме тому в дизайнера стоїть воно,
               а дата лишається менеджеру, який обіцяє її клієнту. */
            /* Годинник етапу й обіцянка клієнту — різні речі, і класи в них
               різні. Доти обидва були `dz-card-due`, і «лишилось 5 год»
               стояло поруч із «лишилось 4 дні» однаковим на вигляд: два
               різні строки, які читаються як один. */
            var годинник = (c.left === null || c.left === undefined) ? '' :
              '<em class="dz-card-h' + (c.left < 0 ? ' late' : c.left < 180 ? ' soon' : '') +
              '">' + esc(c.left < 0 ? ('прострочено ' + hm(-c.left)) : ('лишилось ' + hm(c.left))) +
              '</em>';
            return '<div class="dz-card-w' + (c.fix ? ' is-fix' : '') + (c.unseen ? ' has-n' : '') + '">' +
              '<button class="dz-card' + (c.id === openKey ? ' on' : '') +
                   '" data-open="' + esc(c.id) + '">' +
              '<b>' + esc(c.title) + годинник +
                (лишок ? '<em class="dz-card-due' + (лишок.late ? ' late'
                          : лишок.soon ? ' soon' : '') + '" title="Здати до ' +
                         esc(dueShort(c.due)) + '">' + esc(лишок.txt) + '</em>' : '') + '</b>' +
              /* Нік — одразу під номером: за ним клієнта й упізнають. */
              (c.nick ? '<span class="dz-card-nick">' + esc(c.nick) + '</span>' : '') +
              /* Сума — великим. Між двадцятьма картками обирають за нею, і
                 чим більше замовлення, тим помітнішим воно має бути. */
              (c.sum ? '<span class="dz-card-sum' + (c.sum >= 20000 ? ' big' : '') + '">' +
                       esc(c.sumTxt || c.sum) + '</span>' : '') +
              (c.foot ? '<i>' + esc(c.foot) + '</i>' : '') +
              /* Пропущене з розмов усередині картки — кружечком у куті
                 самої картки. Андрій: не підписувати, від кого, — зайшли й
                 побачили біля потрібної зони. */
              (c.unseen ? '<span class="dz-card-n" title="Пропущених повідомлень: ' + c.unseen + '">' +
                          c.unseen + '</span>' : '') +
              ((c.wait || c.fix)
                ? '<span class="dz-card-m">' +
                    /* Правка від менеджера — найгучніше, що буває на цій
                       дошці: робота вже зроблена, і її просять переробити.
                       Побачити це наступного дня коштує дня. */
                    (c.fix ? '<b class="dz-m-fix">правка</b>' : '') +
                    /* «Чекають на відповідь» — найтихіша поломка відділу:
                       дизайнер спитав і стоїть, а картка виглядає робочою. */
                    (c.wait ? '<b class="dz-m-wait">чекають відповіді</b>' : '') +
                  '</span>'
                : '') +
            '</button>' +
            /* Розмова з клієнтом — просто з картки. Доти менеджер мусив
               вийти з відділу, знайти діалог і повернутись; на кожному з
               цих кроків щось губилось.

               Кнопка стоїть УСЕРЕДИНІ картки, а не під нею: окремий елемент
               поруч читався як чужий і з'їжджав з її краю. */
            (c.chat ? '<button class="dz-card-ig" data-do="chat" data-id="' + esc(c.id) +
                      '" title="Відкрити розмову з клієнтом">Instagram' +
                      (c.igN ? '<span class="dz-ig-n" title="Клієнт написав, не прочитано">' + c.igN + '</span>' : '') +
                      '</button>' : '') +
            '</div>';
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
  /* ПІДПИС ПОЗИЦІЇ: НОМЕР, А ЗА ПОТРЕБИ — Й ЇЇ МІСЦЕ В ЗАМОВЛЕННІ.

     Одна позиція — досить номера: «#2000001». Дві й більше — без номера
     позиції не зрозуміти, про який саме виріб мова: «#2000001-1» і
     «#2000001-2». Саме так їх і називають уголос, і саме так має бути
     підписаний файл, що поїде в цех.

     Правило одне на все: картка перевірки, назва аркуша, імʼя файлу,
     історія. Три різні підписи про ту саму роботу вже коштували нам
     розмови «а це взагалі про що». */
  function unitNo(job, u){
    var list = unitsOf(job);
    var n = jobNo(job);
    if(list.length < 2) return n;
    var i = list.indexOf(u);
    return n + '-' + (i >= 0 ? i + 1 : '?');
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
  /* Як підписана привʼязана розмова. Робоче місце знає це краще за відділ —
     воно й читає Sitniks; тут лише питаємо. */
  function whoLabel(o){
    try{ if(host.whoLabel) return String(host.whoLabel(o) || ''); }catch(e){}
    return String((o && o.crmChatName) || '');
  }
  /* Кнопка розмови внизу блока. Немає привʼязаної розмови — немає й
     кнопки: обіцяти дію, яка нічого не відкриє, гірше за її відсутність. */
  /* СМУЖКА INSTAGRAM ЗАКРІПЛЕНА ЗАВЖДИ. Андрій: «внизу інстаграма
     закріплене повідомлення має бути». Доти вона зникала, щойно розмову не
     привʼязано, — і виглядало так, ніби її прибрали. Тепер вона стоїть
     завжди: є розмова — кнопка й кружечок пропущених від клієнта; немає —
     так і сказано. */
  function writeHtml(o){
    var є = false, n = 0;
    try{ є = !!(host.hasChat && host.hasChat(o)); }catch(e){}
    try{ n = +((host.clientUnread && host.clientUnread(o)) || 0) || 0; }catch(e){}
    if(!o) return '';
    return '<div class="dz-write' + (є ? '' : ' is-off') + '">' +
      (є ? '<button class="dz-ig" data-do="chat">Написати в Instagram' +
             (n ? '<span class="dz-ig-n" title="Клієнт написав, не прочитано">' + n + '</span>' : '') +
           '</button>'
         : '<span class="dz-write-off">Розмову з клієнтом не привʼязано</span>') +
    '</div>';
  }
  function clientHtml(o, job){
    o = o || {};
    /* ВЛАСНЕ ЗАМОВЛЕННЯ ВІДДІЛУ. У нього немає картки в Канбані, звідки
       взялись би імʼя й телефон, — і саме тому воно й заводиться тут:
       відділ живе окремо. Тож клієнта вписують прямо в картці. */
    if(o.dir === 'b2c'){
      /* Клієнт тут — нік і привʼязана розмова, а не анкета. Імʼя, вписане
         руками, за тиждень розходиться з тим, як людина підписана в
         Direct, і знайти її за ним уже не виходить. Привʼязана розмова
         дає і нік, і канал, і саму переписку — усе таким, як воно є.

         Поля тут ТІ САМІ, що в картці Канбану: замовлення B2C — звичайне
         замовлення, просто іншого напряму. Своїх полів у нього немає. */
      /* Привʼязали — і по тому. Поля для адреси тут більше немає: розмова
         зафіксована, а форма для її введення на місці зафіксованого
         виглядає так, ніби нічого не зафіксовано.

         Підписуємо ніком: саме за ним людину й знаходять. Імʼя профілю
         міняють, нік — майже ніколи, тож «чат 17293…» замість нього це
         втрачений контакт. */
      /* Привʼязали — і по тому. Тут лишається лише те, КИМ є клієнт: імʼя
         й нік. Дія «написати» стоїть унизу блока замовлення, як у B2B, —
         угорі вона плуталась із прибиранням привʼязки, а потрібна саме
         тоді, коли замовлення вже прочитане. */
      if(o.crmChatId)
        return '<div class="dz-own is-on">' +
          '<div class="dz-own-who"><span>Клієнт</span><b>' +
            esc(whoLabel(o) || ('чат ' + o.crmChatId)) + '</b></div>' +
        '</div>';
      return '<div class="dz-own">' +
        '<label class="dz-own-f"><span>Розмова в Sitniks</span>' +
          '<input data-bind placeholder="вставте адресу відкритої розмови"></label>' +
        '<div class="dz-own-hint">Відкрийте розмову в Sitniks і скопіюйте адресу ' +
          'з рядка браузера. Нік підтягнеться з неї сам.</div></div>';
    }
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
             /* Картинки до САМОГО ТИПУ ОДЯГУ, окремо від картинок
                замовлення. У замовленні буває два різні стилі, і референси
                до них різні: спільна купа зверху змушує дизайнера гадати,
                що з неї стосується його виробу. */
             pics: [],
             graphic: [], stitch: [], note:'' };
  }
  /* ПОЗИЦІЇ ЗІ СТАРОЇ БАЗИ ПРИХОДЯТЬ НЕПОВНИМИ, І ЦЕ НЕ ВИНЯТОК.

     Замовлення, заведені до появи картинок при виробі, лежать без поля
     `pics` зовсім. Один `.map` по ньому — і весь розділ падає з «Cannot read
     properties of undefined», хоч дані цілком справні: просто вони старші
     за код.

     Дописувати бракуючі поля в кожному місці, де їх читають, — це двадцять
     місць і дев'ятнадцять шансів забути. Тому дописуємо їх ТУТ, там, де
     позиції беруть, — так само, як `dzList` уже робить для дизайнів. */
  function unitsOf(job){
    var l = Array.isArray(job && job.units) ? job.units : [];
    l.forEach(function(u){
      if(!u) return;
      if(!Array.isArray(u.pics)) u.pics = [];
      if(!Array.isArray(u.graphic)) u.graphic = [];
      if(!Array.isArray(u.stitch)) u.stitch = [];
    });
    return l;
  }
  function unitAt(job, id){
    return unitsOf(job).filter(function(u){ return u.id === id; })[0] || null;
  }
  function catalog(){
    /* `host` тут ОБʼЄКТ, а не функція: у цьому модулі його кладе робоче
       місце через `LQDesign.ui.host = {...}`. Виклик `host()` кидав виняток,
       виняток мовчки ковтався — і каталог виробів завжди приходив порожнім.
       Тобто вибір одягу у відділі не працював узагалі, і зовні це виглядало
       як «список порожній», а не як поломка. */
    try{ return (host.catalog && host.catalog()) || []; }catch(e){ return []; }
  }
  /* Знімок саме цього виробу саме цього кольору — із каталогу. Кольору
     може ще не бути; тоді лишається загальне фото виробу, і це чесніше за
     чужий колір. */
  function unitPhoto(u){
    var g = catItem(u && u.gid);
    if(!g) return '';
    var c = (g.colors || []).filter(function(x){
      return String(x.name || x.id) === String(u.color || ''); })[0];
    return (c && c.pic) || g.pic || '';
  }
  function catItem(gid){
    return catalog().filter(function(g){ return g.id === gid; })[0] || null;
  }
  /* ── ВИБІР ІЗ КАТАЛОГУ ВІКНОМ ─────────────────────────────────────────

     Виріб, колір і розмір стояли випадними списками. Список назв — погана
     відповідь на питання «який саме одяг»: «худі базове» від «худі
     оверсайз» у ньому не відрізнити, а кольори взагалі читаються як слова,
     хоч це кольори. Тому відкривається той самий каталог, що й у всіх:
     знімок виробу, плашка кольору, ряд розмірів.

     Колір і розмір НЕ обовʼязкові навмисно: на цьому етапі їх часто ще
     немає, вони зʼявляються під кінець. Порожнє тут — це «ще не знаємо», а
     не «забули заповнити», і вікно так і каже. */
  var PICK = null;
  function pickClose(){
    if(PICK && PICK.el && PICK.el.parentNode) PICK.el.parentNode.removeChild(PICK.el);
    PICK = null;
  }
  function pickOpen(title, hint, cardsHtml, onPick){
    pickClose();
    var el = document.createElement('div');
    el.className = 'dz-pick';
    el.innerHTML = '<div class="dz-pick-w">' +
      '<div class="dz-pick-h"><b>' + esc(title) + '</b>' +
        (hint ? '<i>' + esc(hint) + '</i>' : '') +
        '<button class="dz-x" data-pick-x>×</button></div>' +
      '<div class="dz-pick-b">' + cardsHtml + '</div>' +
    '</div>';
    el.addEventListener('click', function(e){
      if(e.target === el || e.target.hasAttribute('data-pick-x')) return pickClose();
      var card = e.target.closest ? e.target.closest('[data-pick]') : null;
      if(!card) return;
      var v = card.getAttribute('data-pick');
      pickClose();
      onPick(v);
    });
    /* Escape закриває — вікно поверх панелі, і мишею до хрестика тягнутись
       доводиться через увесь екран. */
    var esk = function(ev){
      if(ev.key !== 'Escape') return;
      document.removeEventListener('keydown', esk, true);
      pickClose();
    };
    document.addEventListener('keydown', esk, true);
    document.body.appendChild(el);
    PICK = { el: el };
  }
  /* ══════════ ВІКНО ПРАВКИ ══════════

     Правку пишуть, дивлячись на макет. Поле для неї в кінці списку
     повідомлень означає «догортайте вниз, а тоді згадайте, що саме хотіли
     сказати» — і половина правок виходила з двох слів, бо поки гортав,
     думка розгубилась.

     Вікно лягає поверх картки, приймає текст і, якщо треба, файл — клієнти
     часто присилають «ось так має бути» картинкою, і переказувати її
     словами означає переказати не так. */
  function fixOpen(onSend){
    pickClose();
    var el = document.createElement('div');
    el.className = 'dz-pick dz-fixw';
    el.innerHTML = '<div class="dz-fix-w">' +
      '<div class="dz-fix-h"><b>Що поміняти</b>' +
        '<button class="dz-x" data-fix-x>×</button></div>' +
      '<textarea class="dz-fix-t" rows="4" placeholder="Словами клієнта — так, ' +
        'як він написав. Переказ своїми словами дизайнер зрозуміє інакше."></textarea>' +
      '<div class="dz-fix-f"><span data-fix-name></span></div>' +
      '<div class="dz-fix-b">' +
        '<button class="dz-b" data-fix-file>⤒ Файл</button>' +
        '<button class="dz-b pri" data-fix-go>Надіслати правку</button>' +
      '</div>' +
    '</div>';
    var файл = null;
    var ta = el.querySelector('.dz-fix-t');
    var закрити = function(){
      document.removeEventListener('keydown', esk, true);
      if(el.parentNode) el.parentNode.removeChild(el);
      PICK = null;
    };
    var esk = function(ev){ if(ev.key === 'Escape') закрити(); };
    el.addEventListener('click', async function(ev){
      if(ev.target === el || (ev.target.closest && ev.target.closest('[data-fix-x]')))
        return закрити();
      if(ev.target.closest && ev.target.closest('[data-fix-file]')){
        var f = await (D.ui.upload ? D.ui.upload('') : null);
        if(f){ файл = f; el.querySelector('[data-fix-name]').textContent = f.name || 'файл'; }
        return;
      }
      if(ev.target.closest && ev.target.closest('[data-fix-go]')){
        var txt = String(ta.value || '').trim();
        if(!txt && !файл) return say('Напишіть, що саме поміняти');
        закрити();
        onSend(txt, файл);
      }
    });
    document.addEventListener('keydown', esk, true);
    document.body.appendChild(el);
    PICK = { el: el };
    setTimeout(function(){ try{ ta.focus(); }catch(e){} }, 30);
  }
  /* ══════════ ІСТОРІЯ ЗАМОВЛЕННЯ ══════════

     Сухі події, і тільки вони: кому передали, коли взяв, коли здав, коли
     повернули, коли надіслали клієнту. Це не другий чат — слова лежать у
     розмові при дизайні, куди їх і писали.

     Навіщо взагалі: питання «а коли ми це віддали?» задають рівно тоді,
     коли щось пішло не так, — і відповідь має бути одним поглядом, а не
     розкопуванням чотирьох згорнутих рядків. Стоїть у самому низу картки:
     її читають не щодня, але коли читають — читають усю. */
  /* ІСТОРІЯ — ЩОБ БУЛО ВИДНО, ХТО ЦЕ ЗРОБИВ.

     Андрій: «максимально детальну історію… якщо там видали, замінили
     дизайнера — теж показуємо, хто це зробив, коли забрав… щоб є якась
     проблема, то ми ще бачили, хто це все зробив».

     Тому тут не «що сталось», а «хто що зробив і коли». Різниця важлива
     рівно в ту мить, коли щось пішло не так: «макет здали о 16:17» не
     відповідає ні на що, а «Оля здала v1 о 16:17, Володимир надіслав
     клієнту о 16:21» відповідає на все одразу. */
  /* Дії названі іменниками, а не дієсловами минулого часу. Не заради стилю:
     «здав» і «здала» — різні слова, а ми не знаємо статі людини й не маємо
     її вгадувати з імені. «Оля · здача версії» читається однаково правильно
     для будь-кого, і рядок від цього не стає довшим. */
  var HIST_UA = { sent:'передача роботи', take:'у роботі', ver:'здача версії',
                  fix:'повернення на правку', ok:'затвердження',
                  no:'відмова', file:'файл',
                  tell:'надсилання клієнту', swap:'заміна дизайнера',
                  ask:'повідомлення' };
  /* Де слова людини щось додають, а де лише переказують назву події.
     «передача роботи · Передано в роботу» — це двічі те саме в одному
     рядку; а «повернення на правку · лого ще менше» — це причина, без якої
     запис ні про що. */
  var HIST_TXT = { fix:1, ask:1, no:1, swap:1 };
  /* Підпис складеної зони: скільки подій і коли остання. Інакше довелось
     би розгортати, щоб дізнатись, чи там узагалі щось є. */
  function histSub(job){
    var n = 0, last = '';
    unitsOf(job).forEach(function(u){
      ['graphic','stitch'].forEach(function(k){
        dzList(u, k).forEach(function(d){
          (d.thread || []).forEach(function(m){
            if(!HIST_UA[m.kind]) return;
            n++; if(String(m.at) > last) last = String(m.at);
          });
        });
      });
    });
    return n ? (n + ' ' + (n === 1 ? 'подія' : n < 5 ? 'події' : 'подій') +
                (last ? ' · остання ' + dt(last) : '')) : '';
  }
  function histHtml(job){
    var out = [];
    unitsOf(job).forEach(function(u, ui){
      ['graphic','stitch'].forEach(function(k){
        dzList(u, k).forEach(function(d){
          (d.thread || []).forEach(function(m){
            var що = HIST_UA[m.kind];
            if(!що) return;                 // звичайні репліки лишаються в розмові
            /* «Повернуто на правку» — це слово МЕНЕДЖЕРА. Та сама позначка
               стоїть і на відповіді дизайнера («логотип білий чи
               молочний?»), бо в розмові вони однакові, — але в історії
               його питання не є поверненням роботи, і писати так означало б
               рахувати правки, яких не було. */
            /* «Повернув на правку» — це слово МЕНЕДЖЕРА. Та сама позначка
               стоїть і на словах дизайнера, бо в розмові вони однакові, — а
               в історії його питання не є поверненням роботи. Показуємо
               його як «написав»: воно там доречне, просто зветься інакше. */
            if(m.kind === 'fix' && String(m.by || '') === String(d.who || ''))
              що = HIST_UA.ask;
            out.push({ at: m.at, by: m.by, kind: m.kind,
                       що: що, де: (ui + 1) + ' · ' + (k === 'stitch' ? 'вишивка' : 'графіка'),
                       /* Слова лишаємо: питання дизайнера, причина
                          відмови, текст правки — саме вони й пояснюють,
                          чому далі сталося те, що сталося. */
                       текст: HIST_TXT[m.kind === 'fix' && String(m.by || '') ===
                                String(d.who || '') ? 'ask' : m.kind]
                                ? String(m.text || '').slice(0, 90) : '' });
          });
        });
      });
    });
    if(!out.length) return '';
    out.sort(function(a, b){ return String(b.at).localeCompare(String(a.at)); });
    return '<div class="dz-hist">' + out.slice(0, 60).map(function(e){
      /* Речення читається як речення: КОЛИ · ХТО · ЩО ЗРОБИВ · де. Доти
         першим стояло «здано», і щоб дізнатись ким, треба було дочитати
         рядок до кінця — а питають саме про «ким». */
      return '<div class="dz-hist-r k-' + esc(e.kind) + '">' +
        '<i>' + esc(dt(e.at)) + '</i>' +
        '<b>' + esc(nameOf(e.by)) + '</b>' +
        '<span>' + esc(e.що) + ' · поз. ' + esc(e.де) +
          (e.текст ? ' · ' + esc(e.текст) : '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }
  /* Перегляд однієї картинки. Те саме вікно, що й каталог: одна поведінка
     на обидва випадки — клацнув повз, натиснув Escape, і воно закрилось. */
  function picOpen(url){
    if(!url) return;
    pickClose();
    var el = document.createElement('div');
    el.className = 'dz-pick dz-lightbox';
    el.innerHTML = '<img src="' + esc(url) + '" alt="">';
    el.addEventListener('click', function(){ pickClose(); });
    var esk = function(ev){
      if(ev.key !== 'Escape') return;
      document.removeEventListener('keydown', esk, true);
      pickClose();
    };
    document.addEventListener('keydown', esk, true);
    document.body.appendChild(el);
    PICK = { el: el };
  }
  function pickCard(v, name, pic, swatch){
    return '<button type="button" class="dz-pick-c" data-pick="' + esc(v) + '">' +
      (pic ? '<span class="dz-pick-i"><img src="' + esc(pic) + '" alt="" ' +
             'onerror="this.style.opacity=0"></span>' : '') +
      (swatch ? '<span class="dz-pick-s" style="background:' + esc(swatch) + '"></span>' : '') +
      '<span class="dz-pick-n">' + esc(name) + '</span></button>';
  }
  function pickGarment(cur, done){
    var list = catalog();
    if(!list.length) return say('Каталог порожній — додайте товари в налаштуваннях');
    pickOpen('Який це одяг', 'Натисніть виріб — колір і розмір оберете далі',
      list.map(function(g){ return pickCard(g.id, g.name, g.pic, ''); }).join(''), done);
  }
  function pickColor(gid, done){
    var g = catItem(gid);
    if(!g) return say('Спершу оберіть виріб');
    var cols = g.colors || [];
    if(!cols.length) return say('У цього виробу кольорів не задано');
    pickOpen('Колір · ' + g.name, 'Можна не обирати — колір часто відомий пізніше',
      pickCard('', 'Ще не знаємо', '', '') +
      cols.map(function(c){ return pickCard(c.id, c.name, c.pic, c.hex); }).join(''), done);
  }
  function pickSize(gid, done){
    var g = catItem(gid);
    if(!g) return say('Спершу оберіть виріб');
    var sizes = g.sizes || [];
    if(!sizes.length) return say('У цього виробу розмірів не задано');
    pickOpen('Розмір · ' + g.name, 'Можна не обирати — розмір часто відомий пізніше',
      '<div class="dz-pick-row">' + pickCard('', 'Ще не знаємо', '', '') +
      sizes.map(function(z){
        var v = (z && z.id != null) ? z.id : z, n = (z && z.name != null) ? z.name : z;
        return pickCard(v, n, '', '');
      }).join('') + '</div>', done);
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
  /* Які дизайни зараз розгорнуті. Живе на час сеансу: це погляд, а не
     рішення про замовлення, і зберігати його в базі означало б
     нав’язати сусідньому менеджеру свій порядок читання. */
  var DZ_OPEN = {};
  /* ── ОДИН ДИЗАЙН ─────────────────────────────────────────────────────

     Блок згортається: у замовленні їх буває з десяток, і розгорнуті всі
     одразу вони перетворюють панель на стрічку, де нічого не знайти.
     Згорнутий рядок каже головне — назву, де, стан і чи є непрочитане; все
     інше відкривається натиском саме на тому дизайні, який зараз потрібен. */
  function whoName(email){
    var m = (host.team ? host.team() : []).filter(function(x){ return x.email === email; })[0];
    return (m && (m.name || m.email)) || email || '';
  }
  var DZ_STATE = { new:'не передано', sent:'передано, чекає', work:'у роботі',
                   review:'на перевірці', revision:'на правках',
                   approved:'затверджено' };
  var SIDE_UA = { front:'Перед', back:'Спина', sleeve:'Рукав', other:'Інше' };
  function dzNameOf(d, i){ return D.dzName(d, i); }
  /* Розміщення одним рядком — і тими самими словами, що у вікні мокапу:
     різні формулювання того самого числа читаються як різні числа. */
  function placeLine(pl){
    if(!pl || !pl.wCm) return '';
    var см = function(n){
      return (Math.round((+n || 0) * 10) / 10).toString().replace('.', ',') + ' см'; };
    return см(pl.wCm) + ' × ' + см(pl.hCm) + ' · від горловини ' + см(pl.topCm) +
      (pl.sideCm ? ' · від центру ' + (pl.sideCm > 0 ? '+' : '−') + см(Math.abs(pl.sideCm)) : '') +
      (pl.size ? ' · на ' + pl.size : '');
  }
  function dzVersHtml(u, kind, d, i, ro){
    if(!d.vers.length) return '';
    var key = esc(u.id) + '|' + kind + '|' + i;
    return '<div class="dz-dv">' + d.vers.slice().reverse().map(function(v){
      var обрана = d.ok && d.ok.ver === v.n;
      return '<div class="dz-dv-i' + (обрана ? ' on' : '') + '">' +
        /* «Надіслано» — ПЕРШИМ СЛОВОМ, а не десь усередині.

           Дизайнер натискає «Передати менеджеру» й дивиться сюди: чи
           пішло. Доти тут стояло «Версія 1 · Оля · 29.09 18:40» — рядок,
           який однаково виглядає і до передачі, і після, — і виходило,
           ніби натиск нічого не зробив. Андрій: «ми надіслали, і тут не
           показується, що ми надіслали». */
        '<b>' + (v.sentToClient ? '✓ ' : '') + 'Версія ' + v.n + '</b>' +
        '<span>' + esc('надіслано ' + dt(v.at)) + ' · ' + esc(whoName(v.by)) +
          (v.sentToClient ? ' · клієнту ' + esc(dt(v.sentToClient)) : '') + '</span>' +
        /* Файл версії — зі скачуванням. Його відкривають не подивитись, а
           забрати: менеджер шле його клієнту, дизайнер бере назад у роботу. */
        (v.files || []).map(function(f){
          return '<button type="button" class="dz-dl" data-do="dz-dl" data-url="' +
                 esc(f.url) + '" data-name="' + esc(f.name || 'макет') + '">⤓ ' +
                 esc(f.name || 'файл') + '</button>';
        }).join('') +
        /* Розміщення — просто при версії, а не в чужому файлі. Питання «а
           скільки сантиметрів» задають саме тут, дивлячись на версію. */
        (v.place && v.place.wCm
          ? '<i class="dz-dv-p">' + esc(placeLine(v.place)) + '</i>' : '') +
        /* ОДИН АРКУШ ДЛЯ ВСІХ. Його пересилають — у Директ, підряднику, в
           цех, — скрізь, де відкрити нашу адмінку не можна, а знати, що і
           як шити, треба. Три файли й усний переказ на цьому шляху
           губляться, аркуш — ні. */
        ((v.files || []).length >= 2
          ? '<button class="dz-b dz-quiet" data-do="dz-card" data-dz="' + key +
            '" data-v="' + v.n + '">⤓ Картка</button>' : '') +
        (обрана ? '<i class="dz-dv-ok">обрана</i>'
                : ro ? ''
                : '<button class="dz-b" data-do="dz-ok" data-dz="' + key +
                  '" data-v="' + v.n + '">Ця затверджена</button>') +
      '</div>';
    }).join('') + '</div>';
  }
  /* Розмова по дизайну. Правка, скопійована з переписки з клієнтом, лежить
     рівно при тому нанесенні, якого стосується, — дизайнеру не треба
     здогадуватись, що саме «завелике». */
  /* ── ПЕРЕПИСКА ЗАМІСТЬ ЖУРНАЛУ ───────────────────────────────────────

     Андрій: «історія тут не повинна була бути взагалі саме у дизайнера. Він
     щось написав — і в форматі переписки воно тут виглядало. Надіслали
     менеджеру — можна по праву сторону; коли тобі менеджер пише — по ліву.
     Тоді буде максимально зручне спілкування».

     Доти в дизайнера було три різні списки про одну розмову: перелік
     версій, стрічка повідомлень і журнал подій. Щоб зрозуміти, на чому
     зупинились, доводилось читати всі три й складати їх у голові за часом.

     Тепер один потік. Здача версії — теж повідомлення, з превʼю й файлами:
     вона і є те, що дизайнер «сказав». Свої репліки праворуч, чужі ліворуч
     — так виглядає будь-який месенджер, і вчитися тут нема чому. */
  /* Плитка файлу: клік по картинці — подивитись, праворуч зверху 👁 і ⤓.
     Скачування стоїть просто на картинці: окремий рядок кнопок під нею
     повторював те саме, тільки іменами файлів, які нічого не кажуть. */
  function tileHtml(f, name, label){
    if(!f || !f.url) return '';
    var dl = name || f.name || 'файл';
    return '<span class="dz-tile">' +
      '<button type="button" class="dz-tile-i" data-do="pic-open" data-url="' + esc(f.url) +
        '" title="' + esc(label || 'Подивитись') + '">' +
        '<img src="' + esc(f.url) + '" alt="" loading="lazy" onerror="this.style.opacity=0"></button>' +
      '<span class="dz-tile-a">' +
        '<button type="button" data-do="pic-open" data-url="' + esc(f.url) + '" title="Подивитись">👁</button>' +
        '<button type="button" data-do="dz-dl" data-url="' + esc(f.url) + '" data-name="' + esc(dl) +
          '" title="Скачати">⤓</button>' +
      '</span>' +
      (label ? '<i class="dz-tile-l">' + esc(label) + '</i>' : '') +
    '</span>';
  }
  /* ВЕРСІЯ — ТРИ КАРТИНКИ В РЯД: з чого зробили, мокап, картка.

     Андрій: «підряд три картинки… з якого ми зробили дизайн, потім мокап і
     потім оцю карточку. І підписуємо версія така-то». Сантиметрів і
     відстаней від горловини тут більше немає: вони на самій картці, і
     повторені рядком під нею лише розтягували повідомлення. */
  function verTilesHtml(v, base){
    var p = D.verParts(v);
    var t = [];
    p.work.forEach(function(f, k){
      t.push(tileHtml(f, base + '-робота' + (p.work.length > 1 ? '-' + (k + 1) : ''), 'робота')); });
    p.mock.forEach(function(f, k){
      t.push(tileHtml(f, base + '-мокап' + (p.mock.length > 1 ? '-' + (k + 1) : ''), 'мокап')); });
    if(p.sheet) t.push(tileHtml(p.sheet, base + '-картка', 'картка'));
    return '<span class="dz-tiles">' + t.join('') + '</span>';
  }
  /* Хто дивиться. У картці менеджера — акаунт-менеджер, на дошці
     дизайнера — його роль. Праворуч стоїть саме ця роль. */
  function dzChatHtml(u, kind, d, i, opt){
    var key = esc(u.id) + '|' + kind + '|' + i;
    var me = (host.me && host.me()) || '';
    var ro = !!(opt && opt.ro);
    var as = (opt && opt.as) || 'acct';
    var tok = me + '|' + as;
    var потік = [];
    (d.thread || []).forEach(function(m){
      /* Здача версії лежить у стрічці двічі: подією `ver` і самою версією.
         В одному потоці це два однакові рядки підряд, тож короткий
         пропускаємо: версія каже все те саме й показує роботу. Але її
         позначки прочитаного — у події, звідти й беремо. */
      if(m.kind === 'ver') return;
      потік.push({ at: m.at, by: m.by, kind: m.kind, text: m.text, file: m.file,
                   who: m.who, seen: m.seen, role: D.msgRole(m, d, kind) });
    });
    (d.vers || []).forEach(function(v){
      var ev = (d.thread || []).filter(function(m){
        return m.kind === 'ver' && m.text === 'Версія ' + v.n; })[0] || {};
      потік.push({ at: v.at, by: v.by, ver: v, text: v.note || '', seen: ev.seen || [],
                   role: ev.role || (kind === 'stitch' ? 'stitch' : 'graphic') });
    });
    потік.sort(function(a, b){
      return String(a.at || '').localeCompare(String(b.at || '')); });
    var номер = String((opt && opt.no) || '').replace('#', '');
    return '<div class="dz-ch' + (ro ? ' is-ro' : '') + '">' +
      (потік.length
        ? '<div class="dz-ch-l">' + потік.slice(-40).map(function(m){
            var свій = m.role === as;
            var sn = m.seen || [];
            var нове = !свій && sn.indexOf(tok) < 0 &&
                       !(String(m.by || '') !== me && sn.indexOf(me) >= 0);
            var v = m.ver;
            /* Подія — не репліка. «Передано в роботу» ніхто не «казав», це
               сталось; і поставлене бульбашкою поруч зі словами воно
               змушує щоразу розрізняти, де людина, а де система. */
            var подія = !v && ['sent','take','no','ok','tell','who','queue'].indexOf(m.kind) >= 0;
            if(подія)
              return '<div class="dz-ch-e"><span>' +
                esc(m.kind === 'who' && m.who
                    ? ('Виконавець — ' + whoName(m.who))
                    : (m.text || '')) + '</span>' +
                '<i>' + esc(whoName(m.by)) + ' · ' + esc(dt(m.at)) + '</i></div>';
            return '<div class="dz-ch-m' + (свій ? ' own' : '') +
              (нове ? ' new' : '') + (v ? ' is-ver' : '') + '">' +
              '<span class="dz-ch-w">' + esc(whoName(m.by)) + ' · ' + esc(dt(m.at)) +
                (v && v.sentToClient ? ' · клієнту ' + esc(dt(v.sentToClient)) : '') +
              '</span>' +
              (v
                ? '<b class="dz-ch-vn">Версія ' + v.n + '</b>' +
                  verTilesHtml(v, (номер ? номер + '-' : '') + 'v' + v.n)
                : '') +
              (m.text ? '<span class="dz-ch-t">' + esc(m.text) + '</span>' : '') +
              (m.file && !v
                ? (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(m.file.url))
                    ? '<span class="dz-tiles">' + tileHtml(m.file, m.file.name, '') + '</span>'
                    : '<button type="button" class="dz-dl" data-do="dz-dl" data-url="' +
                      esc(m.file.url) + '" data-name="' + esc(m.file.name || 'файл') + '">⤓ ' +
                      esc(m.file.name || 'файл') + '</button>')
                : '') +
            '</div>';
          }).join('') + '</div>'
        : '<div class="dz-miss is-calm">Тут буде розмова з ' +
          (as === 'acct' ? 'дизайнером' : 'менеджером') + '.</div>') +
    '</div>';
  }
  function dzThreadHtml(u, kind, d, i, opt){
    var key = esc(u.id) + '|' + kind + '|' + i;
    var me = (host.me && host.me()) || '';
    /* У дизайнера розмова тільки читається: відповідає він роботою —
       файлом і коментарем при ньому, — а не третьою кнопкою «Файл», яка
       нічого нікуди не рухає. */
    var ro = !!(opt && opt.ro);
    return '<div class="dz-dt' + (ro ? ' is-ro' : '') + '">' +
      (d.thread.length
        ? '<div class="dz-dt-l">' + d.thread.slice(-30).map(function(m){
            var нове = String(m.by || '') !== me && (m.seen || []).indexOf(me) < 0;
            return '<div class="dz-dt-m' + (нове ? ' new' : '') + ' k-' + esc(m.kind || '') + '">' +
              '<span class="dz-dt-h">' + esc(whoName(m.by)) + ' · ' + esc(dt(m.at)) + '</span>' +
              (m.text ? '<span class="dz-dt-t">' + esc(m.text) + '</span>' : '') +
              (m.file ? '<a href="' + esc(m.file.url) + '" target="_blank" rel="noopener">' +
                        esc(m.file.name || 'файл') + '</a>' : '') +
            '</div>';
          }).join('') + '</div>'
        : '<div class="dz-miss is-calm">Правок і повідомлень ще немає.</div>') +
      (ro ? '' :
        '<textarea rows="2" data-dzsay="' + key + '" placeholder="Правка — словами клієнта, ' +
          'скопійованими з переписки"></textarea>' +
        '<div class="dz-dt-b">' +
          '<button class="dz-b pri" data-do="dz-say" data-dz="' + key + '">Надіслати правку</button>' +
          '<button class="dz-b" data-do="dz-file" data-dz="' + key + '">⤒ Файл</button>' +
          '<button class="dz-b" data-do="dz-ver" data-dz="' + key + '">+ Версія</button>' +
        '</div>') +
    '</div>';
  }
  /* ПРИКРІПИТИ Й ВІДПРАВИТИ — ДВІ РІЗНІ ДІЇ, І ЦЕ НАВМИСНО.

     Прикріпили дизайнера — він має доступ і бачить, що на нього збирають
     замовлення. Відправили — ТЗ поїхало, робота почалась, картка зрушила на
     дошці. Доти цього поділу не було, і замовлення зʼявлялось у дизайнера
     ще до того, як менеджер устиг докласти картинки.

     Кнопка «Відправити» зʼявляється лише тоді, коли є що відправляти: без
     виробу ТЗ не ТЗ, а порожній бланк. Про це кажемо рядком, а не сірою
     кнопкою, — інакше виглядає як поломка. */
  function dzSendHtml(u, kind, d, i, job){
    var key = esc(u.id) + '|' + kind + '|' + i;
    /* Вишивальному передавати нема чого, поки графіку не затвердили:
       оцифровувати доведеться те, що ще поміняють. */
    if(kind === 'stitch' && !D.graphicOk(u))
      return '<div class="dz-miss">Спершу треба затвердити графіку цього виробу — ' +
             'інакше оцифруємо те, що ще поміняється.</div>';
    var role = kind === 'stitch' ? 'embroidery' : 'designer';
    var готово = !!u.gid;
    /* ЗАМІНИТИ ДИЗАЙНЕРА — ТИМ САМИМ СПИСКОМ. Обрав іншого, і він на місці
       попереднього: окрема дія «замінити» нічого б не додала, крім ще
       одного натискання й ще одного питання «а де вона». */
    return '<div class="dz-ds">' +
        '<span class="dz-l">Дизайнер</span>' +
        '<select data-dzwho="' + key + '">' +
          '<option value="">— оберіть —</option>' + teamOpts(role, d.who || '') +
        '</select>' +
      '</div>' +
      (d.sentAt
        ? '<div class="dz-sent">ТЗ відправлено ' + esc(dt(d.sentAt)) +
          ' · ' + esc(whoName(d.who)) +
          '<button class="dz-b" data-do="dz-send" data-dz="' + key + '">Надіслати ще раз</button>' +
          '</div>'
        : d.who
        ? (готово
            ? '<button class="dz-b pri wide" data-do="dz-send" data-dz="' + key + '">' +
              'Передати замовлення ' + esc(whoName(d.who)) + '</button>'
            : '<div class="dz-miss">Оберіть виріб — без нього ТЗ порожнє, ' +
              'і відправляти нема чого.</div>')
        : '');
  }
  /* ДОДАТИ ДИЗАЙНЕРА — ОДНИМ КРОКОМ.

     Доти це було двома: кнопка заводила порожній рядок, і лише всередині
     нього обирали людину. Порожній рядок ні про що не каже, а другий крок
     забувають — і на виробі висить «нанесення» без нікого.

     Тепер вибір і є дією: обрав зі списку — дизайнера прикріплено. */
  function dzAddHtml(u, kind){
    var role = kind === 'stitch' ? 'embroidery' : 'designer';
    return '<select class="dz-addwho" data-dzadd="' + esc(u.id) + '|' + kind + '">' +
      '<option value="">+ Додати дизайнера</option>' + teamOpts(role, '') +
    '</select>';
  }
  /* Списки дизайнів веде ядро — воно ж і дописує полям, яких у старих
     задачах немає. Малювати їх треба тим самим списком, інакше панель
     побачить сирі дані без `vers`/`thread` і розсиплеться на першому ж
     зверненні до них. */
  function dzList(u, kind){ return D.dzList(u, kind); }
  /* ══════════ КОЛІР КАЖЕ, ЧИ ПЕРЕДАЛИ ══════════

     Андрій: «щоб якось там загоралось — жовтеньким, коли передано
     графічному, зелененьким, коли вже передали вишивальному».

     Це не оформлення. У картці з чотирьох позицій питання «а це вже
     передали?» задають на кожну, і відповідь доти лежала всередині
     згорнутого рядка дизайну — тобто її не бачили, поки не відкриють усі
     чотири. Колір відповідає на неї зразу, і саме він же відрізняє «ще не
     віддали нікому» від «віддали й чекаємо».

     Зелений у графіки означає НЕ «графіку затвердили», а «робота пішла
     далі»: вишивальному вже передали те, що вона намалювала. Доти
     бурштиновий — замовлення в роботі, і це ще не кінець. */
  function dzSentAny(u, kind){
    return dzList(u, kind).some(function(d){ return !!d.sentAt; });
  }
  function dzColState(u, kind){
    if(kind === 'graphic')
      return dzSentAny(u, 'stitch') ? 'done' : dzSentAny(u, 'graphic') ? 'sent' : '';
    var list = dzList(u, 'stitch');
    if(list.length && list.every(function(d){ return !!d.ok; })) return 'done';
    return dzSentAny(u, 'stitch') ? 'sent' : '';
  }
  /* ══════════ ВІДКРИТА ОДНА ПОЛОВИНА, ДРУГА — СМУЖКОЮ ══════════

     Андрій: «як тільки ми узгодили ескіз, відкривається вже зона більша…
     таким чином ми економимо місце в самому, в цій карточці і більш
     зрозуміло становиться. Якщо ми захочемо, ми можемо відкрити ту зону,
     передивитися, як там було. Якщо ні, то дивимося ту зону, з якою
     працюємо».

     Доти обидві колонки стояли поруч по півширини незалежно від того, у
     якій іде робота. Половина екрана щоразу була зайнята тим, що зараз не
     роблять: до погодження — порожньою вишивкою з написом «чекає», після
     погодження — графікою, яка вже готова. А картці на перевірку півширини
     мало: вона перетворюється на стовпчик із двох слів у рядок.

     Тепер як бокова панель у Телеграмі: відкрита одна, друга згорнута у
     смужку з іконкою, кольором стану й лічильником непрочитаного. Нічого
     не ховається зовсім — видно, що друга половина існує і в якому вона
     стані; натиснув — вона розкрилась, а сусідня згорнулась.

     Яка відкрита — вирішує РОБОТА, а не памʼять: поки ескіз не погоджено,
     відкрита графіка; погодили — сама відкривається вишивка, бо саме з
     цієї миті робота туди й переходить. Натиснули руками — ваш вибір діє
     до кінця сеансу. У базі цього немає навмисно: це спосіб читання, а не
     факт про замовлення, і навʼязувати його сусідньому менеджеру нема за
     що. */
  var SIDE = {};
  function sideAuto(u){
    var g = dzList(u, 'graphic');
    return (g.length && D.graphicOk(u)) ? 'stitch' : 'graphic';
  }
  function sideOf(u){
    var s = SIDE[(u || {}).id];
    return (s === 'graphic' || s === 'stitch') ? s : sideAuto(u);
  }
  /* Скільки непрочитаного в половині. Лічильник на смужці — єдине, що
     змушує туди зазирнути, і без нього згорнута половина була б місцем,
     куди повідомлення падають безслідно. */
  function dzUnseenCol(u, kind){
    var me = (host.me && host.me()) || '';
    if(!me) return 0;
    return dzList(u, kind).reduce(function(a, d){ return a + D.dzUnseen(d, me, 'acct', kind); }, 0);
  }
  var SIDE_ICO = { graphic:'\u270E', stitch:'\u2726' };
  var SIDE_NM = { graphic:'Графіка', stitch:'Вишивка' };
  function railHtml(u, kind){
    var st = dzColState(u, kind);
    var n = dzUnseenCol(u, kind);
    return '<button type="button" class="dz-u-rail' + (st ? ' is-' + st : '') +
      '" data-do="u-side" data-u="' + esc(u.id) + '" data-side="' + kind +
      '" title="' + (kind === 'stitch' ? 'Вишивальний дизайн' : 'Графічний дизайн') +
      ' — розгорнути">' +
      '<span class="dz-u-rail-i">' + SIDE_ICO[kind] + '</span>' +
      (n ? '<span class="dz-u-rail-n">' + n + '</span>' : '') +
      '<span class="dz-u-rail-t">' + SIDE_NM[kind] + '</span>' +
    '</button>';
  }
  /* У ШАПЦІ ЗОНИ — ХТО РОБИТЬ, А НЕ СЛОВО ПРО СТАН.

     Доти там висіла капсула «ПЕРЕДАНО», а імʼя дизайнера стояло рядком
     нижче — тобто два написи поспіль про одну річ, і жоден не відповідав
     на питання, з якого все починається: кому це віддати. Стан же й так
     видно кольором самої зони, і писати його словом означає казати те
     саме двічі.

     Тепер у шапці стоїть сам вибір: нікого не призначено — випадний
     список; призначено — імʼя з олівцем. Одне місце, одна дія. */
  function dzColHtml(u, kind, ro){
    var st = dzColState(u, kind);
    var назва = kind === 'stitch' ? 'Вишивальний дизайн' : 'Графічний дизайн';
    var d = dzList(u, kind)[0];
    var роль = kind === 'stitch' ? 'embroidery' : 'designer';
    var key = esc(u.id) + '|' + kind + '|0';
    var хто;
    /* Черга відділу — лише в графіки. Вишивальників переведемо на нову
       схему окремо, тоді й у них зʼявиться своя черга. */
    var черга = kind === 'graphic'
      ? '<option value="@queue">Черга відділу — бере перший</option>' : '';
    if(d && !ro && SWAP[key] && (d.who || d.pool)){
      хто = '<select class="dz-u-sel" data-dzwho="' + key + '">' +
          '<option value="">— кому віддати —</option>' + черга +
          teamOpts(роль, d.who || '') +
        '</select>' +
        '<button type="button" class="dz-ib" data-do="dz-swap" data-dz="' + key +
          '" title="Не міняти">×</button>';
    } else if(d && d.who){
      хто = '<b class="dz-u-who">' + esc(whoName(d.who)) + '</b>' +
        (ro ? '' : '<button type="button" class="dz-ib" data-do="dz-swap" ' +
          'data-dz="' + key + '" title="Забрати або віддати іншому">\u270E</button>');
    } else if(d && d.pool){
      хто = '<b class="dz-u-who is-q">Черга відділу' +
          (d.sentAt ? ' · чекає ' + esc(hm(Math.max(0, Math.round((Date.now() - new Date(d.sentAt).getTime()) / 60000)))) : '') +
        '</b>' +
        (ro ? '' : '<button type="button" class="dz-ib" data-do="dz-swap" ' +
          'data-dz="' + key + '" title="Віддати конкретному дизайнеру">\u270E</button>');
    } else if(ro){
      хто = '<i class="dz-u-no">дизайнера не обрано</i>';
    } else {
      /* Списку немає, поки вишивку не відкрито: обирати людину на роботу,
         якої ще не можна почати, означає передати її й забути. */
      хто = (kind === 'stitch' && !D.graphicOk(u))
        ? '<i class="dz-u-no">чекає погодження графіки</i>'
        : '<select class="dz-u-sel" data-dzwho="' + key + '">' +
            '<option value="">— оберіть дизайнера —</option>' + черга +
            teamOpts(роль, '') +
          '</select>';
    }
    /* ПРОПУЩЕНЕ — ТАМ, ЗВІДКИ ВОНО ПРИЙШЛО. Андрій: «від графічного
       дизайнера — біля графічного дизайнера висить стільки то пропущених,
       біля вишивки — біля вишивки». Натиснув — прочитав, число гасне. */
    var нових = ro ? 0 : dzUnseenCol(u, kind);
    return '<div class="dz-u-l' + (st ? ' is-' + st : '') + '">' +
      '<span class="dz-u-lt">' + назва + '</span>' +
      (нових ? '<button type="button" class="dz-unread" data-do="dz-seen" data-u="' + esc(u.id) +
        '" data-side="' + kind + '" title="Позначити прочитаним">' + нових + '</button>' +
        /* Око — як у розмовах: подивився й позначив прочитаним одним дотиком. */
        '<button type="button" class="dz-eye" data-do="dz-seen" data-u="' + esc(u.id) +
        '" data-side="' + kind + '" title="Позначити прочитаним" aria-label="Позначити прочитаним">\uD83D\uDC41</button>' : '') +
      хто + '</div>';
  }
  /* ══════════ РЯДОК ДИЗАЙНУ В МЕНЕДЖЕРА — МІНІМУМ ══════════

     Андрій: «коли ми вибираємо дизайнера, ми вибираємо тільки дизайнера…
     тут не треба дублювати, бо він не зверху — Володимир такий-то в роботі».

     Він має рацію, і це не про смак. У рядку стояло імʼя дизайнера,
     всередині — той самий список із тим самим імʼям, поруч стан словом і
     стан кольором колонки. Чотири способи сказати одне; читати доводилось
     усі чотири, щоб переконатись, що вони не розходяться.

     Лишилось те, що менеджер тут справді робить: обирає, кому це малювати,
     і бачить, чи є що прочитати. Решта — усередині, і відкривається натиском. */
  /* ══════════════════════════════════════════════════════════════════════
     КОЛОНКА ДИЗАЙНУ В МЕНЕДЖЕРА — ЧОТИРИ СТАНИ, І ЖОДНОГО ЗАЙВОГО

     Андрій: «просто тут не додати дизайнера, ще щось… Файл, версія,
     надіслати правку — тут не повинно бути… Передано в роботу в який час,
     саме всередині вже графічного дизайну, тут не повинно бути».

     Причина проста. Менеджер відкриває цю колонку двічі за замовлення: щоб
     призначити людину й щоб перевірити роботу. Усе інше — файли, окремі
     версії, часи передач — це історія, і їй місце в історії, а не в тому
     самому місці, де приймають рішення. Доти тут лежало все одразу, і
     кожне з двох рішень доводилось шукати серед чужих рядків.

     Стани йдуть строго один за одним, і кожен показує рівно одну дію:

       ① нікого не обрано → тільки список. Кнопки передачі НЕМАЄ: передавати
         нікому, і сіра кнопка тут гірша за її відсутність.
       ② обрали → імʼя та «Передати дизайнеру».
       ③ передали → «Очікуємо макет». Кнопка зникла: передавати вдруге
         нічого.
       ③′ дизайнер написав → його слова тут же, з полем відповіді. Не чат:
         одне питання й одна відповідь, бо саме так це й відбувається.
       ④ прийшов макет → картка роботи й дві дії.

     І головне про ④: кнопки «Правка» й «Надіслати клієнту» зʼявляються
     ТІЛЬКИ разом із картинкою. Правку не дають на порожнє місце, а слати
     клієнту нема чого — обидві до того або нічого не роблять, або роблять
     неправду.
     ══════════════════════════════════════════════════════════════════════ */
  function designRowHtml(u, kind, d, i, ro, job, o, всього){
    var key = esc(u.id) + '|' + kind + '|' + i;
    var me = (host.me && host.me()) || '';
    var роль = kind === 'stitch' ? 'embroidery' : 'designer';
    /* Дизайнер може і здати роботу, і просто спитати. Беремо його останнє
       слово, якщо воно НЕ прочитане: прочитане вже відпрацювали, і тримати
       його на видноті означає щодня перечитувати вчорашнє. */
    var питання = null;
    (d.thread || []).forEach(function(m){
      if(m.kind !== 'fix' && m.kind !== 'file') return;
      if(String(m.by || '') !== String(d.who || '')) return;
      if((m.seen || []).indexOf(me) >= 0) return;
      питання = m;
    });
    /* ПІДПИС ДИЗАЙНУ — КОЛИ ЇХ КІЛЬКА.

       Андрій: «графічний дизайнер має можливість відправити один дизайн і
       другий дизайн, окремо підписати — дизайн 1, дизайн 2, щоб потім ми
       розрахували, скільки повинні розрахувати з дизайнером».

       Один дизайн підпису не потребує: про нього й так ясно, про що мова.
       Два — потребують обовʼязково, інакше «зроби менше» стосується
       невідомо якого з них, а в кінці місяця нема з чого порахувати, за
       скільки робіт платити. */
    return '<div class="dz-dz' + (питання ? ' has-new' : '') + '">' +
      ((+всього || 0) > 1
        ? '<div class="dz-dz-no">Дизайн ' + (i + 1) + '</div>' : '') +
      /* Хто робить — у шапці зони, а не тут: доти капсула «ПЕРЕДАНО» й
         імʼя стояли двома рядками поспіль про одну річ. */
      /* ② → ③ → ③′ → ④ */
      ((!d.who && !d.pool) ? ''
        : !d.sentAt
        ? (ro ? '' : (u.gid
            ? '<button class="dz-b pri wide" data-do="dz-send" data-dz="' + key +
              '">' + (d.pool && !d.who ? 'Передати у відділ' : 'Передати дизайнеру') + '</button>'
            : '<div class="dz-miss">Оберіть виріб — без нього ТЗ порожнє.</div>'))
        /* Окремого блока «питання дизайнера» більше немає: воно стоїть у
           самій стрічці, і непрочитане там позначене. Доти те саме
           повідомлення було видно двічі — і відповідали на нього теж
           двічі, бо зверху воно не гасло. */
        : dzCardHtml(u, kind, d, i, job, o, key, ro)) +
    '</div>';
  }
  /* Питання дизайнера — не чат, а один рядок і поле відповіді. Андрій:
     «або приходить вже готовий макет, або його питання, де ми можемо також
     відповісти — воно все в цій зоні».

     Чат тут був би зайвим: розмова по одному нанесенню — це два-три рядки
     за все замовлення, а решта листування живе в історії. */
  function dzAskHtml(m, key){
    return '<div class="dz-ask">' +
      '<div class="dz-ask-h">' + esc(whoName(m.by)) + ' · ' + esc(dt(m.at)) + '</div>' +
      (m.text ? '<div class="dz-ask-t">' + esc(m.text) + '</div>' : '') +
      (m.file ? '<button type="button" class="dz-dl" data-do="dz-dl" data-url="' +
        esc(m.file.url) + '" data-name="' + esc(m.file.name || 'файл') + '">⤓ ' +
        esc(m.file.name || 'файл') + '</button>' : '') +
      '<textarea rows="1" data-grow data-dzsay="' + key + '" ' +
        'placeholder="Відповісти дизайнеру"></textarea>' +
      '<button class="dz-b" data-do="dz-reply" data-dz="' + key + '">Відповісти</button>' +
    '</div>';
  }
  /* ══════════ ЩО ПРИЙШЛО ВІД ДИЗАЙНЕРА ══════════

     Список файлів тут не працює: «макет.png, мокап.png» не дає перевірити
     нічого — щоб побачити роботу, доводилось відкривати обидва в нових
     вкладках і тримати в голові, який із них який. А перевіряють її щодня
     й по десять разів.

     Тому показуємо саме те, що поїде клієнту: мокап квадратиком (такий
     самий, як референси — щоб ряд не розʼїжджався), підпис «номер · v1»,
     розміщення в сантиметрах і слова дизайнера, якщо вони є. */
  /* Розмова з дизайнером — той самий вигляд, що й у нього самого: ті самі
     бульбашки, ті самі центровані статуси. Не «схожа», а та сама, бо це
     буквально один потік на двох. */
  function dzTalkHtml(u, kind, d, i, key, ro, job){
    if(ro) return '';
    return dzChatHtml(u, kind, d, i, { as:'acct', no: job ? unitNo(job, u) : '' }) +
      '<div class="dz-chk-say">' +
        '<textarea rows="1" data-grow data-dzsay="' + key + '" ' +
          'placeholder="Написати дизайнеру"></textarea>' +
        /* «Написати», а не «Надіслати»: на цій самій картці «Надіслати»
           вже означає «показати клієнту». Два однакові слова на дві різні
           дії в одному місці — це помилка, яку зробить кожен, і не раз. */
        /* Будь-яке слово менеджера дизайнеру — правка: робота йде в
           «Правки», строк дизайнера починається заново. */
        '<button class="dz-b" data-do="dz-note" data-dz="' + key +
          '" title="Дизайнер отримає це як правку">Написати</button>' +
      '</div>';
  }
  function dzCardHtml(u, kind, d, i, job, o, key, ro){
    var v = d.vers[d.vers.length - 1];
    /* ВЕРСІЇ ЩЕ НЕМАЄ — АЛЕ РОЗМОВА ВЖЕ Є.

       Доти тут стояв сірий рядок «Передали дизайнеру · очікуємо макет», і
       він казав те саме, що подія в стрічці: «Передано в роботу». Два
       написи про одне, з яких один нікуди не веде.

       Головне ж інше: поки макета немає, менеджеру нема чим написати
       дизайнеру — а саме в цей час і питають «ти взяв?», «коли буде?».
       Тому розмова відкривається з миті передачі, а не з першої версії. */
    if(!v) return dzTalkHtml(u, kind, d, i, key, ro, job);
    /* У ПРЕВʼЮ — САМ АРКУШ, А НЕ ПРОСТО МОКАП.

       Андрій: «ми не бачимо тільки футболку з лого, ми бачимо одразу і саму
       карточку». Він має рацію: клієнту йде аркуш, і перевіряти треба саме
       те, що поїде, — разом із примітками й розмірами. Доти побачити його
       можна було тільки скачавши, тобто перевірка починалась із
       завантаження файлу.

       Аркуш малюється при здачі версії й лежить у ній третім файлом; немає
       його (стара версія) — показуємо мокап, як і доти. */
    var частини = D.verParts(v);
    var аркуш = частини.sheet;
    var мокап = аркуш || частини.mock[0] || частини.work[0] || {};
    /* Версія без аркуша — це версія, здана до того, як аркуш зʼявився.
       Доти тут стояла смужка з кнопкою «Зібрати аркуш». Андрій: формат
       дизайну має бути вже тут, а не за натиском, — і він має рацію:
       кнопка просила людину зробити те, що система вміє зробити сама.

       Тепер картка збирає його тихо, щойно на неї глянули (`sheetAuto`
       після малювання), а поки він збирається — просто показує мокап.
       Жодної дії від менеджера. */
    var надіслано = !!v.sentToClient;
    var погоджено = !!d.ok;
    return '<div class="dz-chk' + (погоджено ? ' is-ok' : '') + '">' +
      '<div class="dz-chk-top">' +
        (мокап.url
          ? '<button type="button" class="dz-chk-i" data-do="pic-open" data-url="' +
            esc(мокап.url) + '" title="Подивитись на весь екран">' +
            '<img src="' + esc(мокап.url) + '" alt="" loading="lazy"></button>'
          : '') +
        '<div class="dz-chk-t">' +
          /* Номер ТОЙ САМИЙ, що в шапці, плюс місце позиції, коли їх кілька:
             «#2000001-2 · v1». Так їх і називають уголос. */
          '<b>' + esc(unitNo(job, u) + ' · v' + v.n) + '</b>' +
          (ro ? '' : '<button class="dz-ib dz-chk-dl" data-do="dz-card" data-dz="' + key +
            '" data-v="' + v.n + '" title="Скачати аркуш для цеху">⤓</button>') +
          /* Слова дизайнера про саме цю версію — тут, а не в стрічці:
             вони пояснюють роботу, на яку дивишся, а не розмову навколо неї. */
          (v.note ? '<i class="dz-chk-n">' + esc(v.note) + '</i>' : '') +
          (погоджено
            ? '<i class="dz-chk-ok">погоджено · v' + ((d.ok && d.ok.ver) || v.n) + '</i>'
            : '') +
        '</div>' +
      '</div>' +

      /* ── Коротка стрічка: що сказали й що відповіли ──
         Три останні рядки, і жодного чату: решта лежить в Історії. Без них
         картка мовчала — правку відправили, а слідів її в тому місці, де
         приймають рішення, не лишалось. */
      /* ПЕРЕПИСКА, А НЕ ТРИ ОСТАННІ РЯДКИ.

         Доти тут стояв хвіст: три повідомлення й кнопка «всі». Розмова ж
         одна на двох, і коли в дизайнера вона повна, а в менеджера —
         обрізана, вони говорять про різне: він відповідає на те, що бачить,
         а не на те, що написали. Тепер обидва дивляться в один потік,
         дзеркально: своє праворуч, чуже ліворуч. */
      dzTalkHtml(u, kind, d, i, key, ro, job) +
      (ro ? '' :
      /* Три дії, компактно, в один рядок: погодити, повернути, показати.
         Це вибір, а не послідовність кроків, і поставлені стовпчиком вони
         читались би саме як кроки. */
      '<div class="dz-chk-b">' +
        (погоджено
          ? '<button class="dz-b" data-do="dz-unok" data-dz="' + key + '">Зняти</button>'
          : '<button class="dz-b ok" data-do="dz-ok-pick" data-dz="' + key +
            '" title="Клієнт сказав «беремо» — робота йде далі й відкривається вишивка">' +
            '✓ Погоджено</button>') +
        /* Кнопки «Правка» більше немає: будь-яке повідомлення менеджера
           дизайнеру вже й є правкою — написав у розмові, і робота
           повернулась. Лишились дві дії: погодити й показати клієнту. */
        /* ОДНА ВЕРСІЯ — ОДНЕ НАДСИЛАННЯ.

           Доти поруч стояли напис «Надіслано» І жива кнопка «Надіслати» —
           і виходило, що система каже «вже зробив», але водночас пропонує
           зробити ще раз. Андрій натиснув тричі, і в стрічці лягли три
           однакові рядки «Надіслано клієнту · версія 1», а клієнт тричі
           отримав ту саму картинку.

           Тепер кнопка одна й на тому самому місці. Надіслали — вона
           гасне й каже, коли це було. Прийшла нова версія — оживає сама,
           бо це вже інший ескіз, і його справді треба показати. */
        (надіслано
          ? '<span class="dz-b is-sent" title="Цю версію вже показали клієнту ' +
            esc(dt(v.sentToClient)) + '">Надіслано ' + esc(hhmm(v.sentToClient)) + '</span>'
          : '<button class="dz-b pri" data-do="dz-tell-pick" data-dz="' + key +
            '">Надіслати</button>') +
      '</div>') +
    '</div>';
  }
  /* Останні слова по цьому дизайну — три рядки. Не чат: він увесь в
     Історії. Тут рівно стільки, щоб побачити, на чому зупинились, не
     виходячи з рішення. */
  /* Хто розгорнув стрічку цілком. Як і DZ_OPEN — у памʼяті вкладки, не в
     базі: це спосіб читання, а не факт про замовлення. */
  var TAIL_ALL = {};
  /* Відкритий список «кому віддати» біля імені виконавця — стан показу, не подія. */
  var SWAP = {};
  function dzTailHtml(d, key){
    var all = (d.thread || []).filter(function(m){
      return m.kind === 'fix' || m.kind === 'file' || m.kind === 'tell';
    });
    if(!all.length) return '';
    /* ТЕКСТ НЕ РІЖЕМО.

       Доти рядок був один: імʼя, повідомлення в одну стрічку з трьома
       крапками, дата праворуч. І правка, яку менеджер щойно написав сам,
       обрізалась на половині — прочитати те, що відправив, він не міг.
       А обрізаний текст правки нічого не вартий: у ньому вся суть після
       коми.

       Тому імʼя й дата стали лівою колонкою одне під одним (дата дрібним
       під імʼям), а текст займає всю ширину й переноситься. Плюс кнопка
       «всі повідомлення»: три останні — це для ока, а коли треба
       відновити, про що домовлялись, потрібні всі, і ходити за ними в
       Історію означає вийти з рішення, яке саме зараз приймаєш. */
    var усі = !!TAIL_ALL[key];
    var видно = усі ? all : all.slice(-3);
    return '<div class="dz-tail">' +
      (all.length > 3
        ? '<button class="dz-tail-all" data-do="dz-tail" data-dz="' + esc(key) + '">' +
          (усі ? 'Згорнути' : 'Усі повідомлення · ' + all.length) + '</button>'
        : '') +
      видно.map(function(m){
        return '<div class="dz-tail-r' + (m.kind === 'tell' ? ' is-tell' : '') + '">' +
          '<span class="dz-tail-w"><b>' + esc(whoName(m.by)) + '</b>' +
            '<i>' + esc(dt(m.at)) + '</i></span>' +
          '<span class="dz-tail-x">' +
            esc(m.text || (m.file && m.file.name) || 'файл') + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }



  /* ТЗ ДИЗАЙНЕРА — ТЕ САМЕ, АЛЕ БЕЗ КЕРМА.

     Дизайнеру потрібні рівно: картинки, тип одягу, колір, розмір, кількість,
     номер замовлення й коментар. Решта — робота менеджера, і показувати її
     означає дати змогу її зіпсувати: одне випадкове натискання «Прибрати», і
     склад замовлення поїхав. Тому той самий блок, але поля читаються, а
     кнопок складу немає.

     Розмова й версії лишаються повними — це його робота, і саме тут він
     відповідає. Чужий вид дизайну не показуємо зовсім: графічному нема чого
     робити у вишивальних файлах, і навпаки. */
  /* ПІДПИС-РОЗДІЛЮВАЧ УСЕРЕДИНІ ПОЗИЦІЇ.

     Андрій: «нам потрібно цей склад і дизайн якось візуально розділити…
     по факту, яке замовлення, і потім вже починається графічний дизайн,
     щоб воно легше сприймалося… бо поки якось воно важко сприймається».

     Позиція доти текла одним потоком: поля, коментар, картинки — і одразу
     колонки дизайну, відбиті самою тільки пунктирною рискою без підпису.
     Оку не було за що зачепитись, і щоб зрозуміти, де закінчується «що
     шиємо» й починається «хто малює», картку доводилось перечитувати
     згори щоразу.

     Тепер дві названі частини: підпис каже, що нижче, лінія показує, де
     це починається. Дві дрібні речі — але саме їх бракувало, щоб позиція
     читалась одним поглядом. */
  function capHtml(t){
    return '<div class="dz-u-cap"><span>' + esc(t) + '</span></div>';
  }
  function unitHtml(job, u, n, opt){
    opt = opt || {};
    var ro = !!opt.ro, only = opt.only || '';
    var g = catItem(u.gid);
    /* Заголовка з назвою тут більше немає. Він переказував рівно те, що
       стоїть рядком нижче в самій вибірці — «Футболка базова · Чорний · M ·
       2 шт» над кнопками, які це й показують. Два підписи того самого
       нічого не додають, а місце й увагу забирають обидва. */
    return '<div class="dz-u">' +
      /* ── ЩО ШИЄМО: виріб, коментар, референси ── */
      '<div class="dz-u-spec">' + capHtml('Що шиємо') +
      /* Шапка позиції: номер, назва й дії — усе в один рядок. Праворуч від
         номера стояла порожнеча на пів картки, а назва виробу читалась лише
         з кнопки вибору нижче. Тепер вона тут, де її й шукають. */
      /* Окремої шапки з назвою більше немає, і це не спрощення заради
         спрощення. Там стояло «Футболка базова · Чорний · M · 3 шт» — тобто
         рівно те, що рядком нижче написано на самих полях. Два підписи того
         самого не додають нічого, крім рядка висоти й питання «а котрий із
         них правда, якщо вони розійдуться».

         Тепер номер стоїть У ТОМУ САМОМУ рядку, що й поля: [1] [Футболка]
         [Чорний] [M] [3] — один погляд, одна відповідь. */
      /* Три кнопки замість трьох списків: кожна відкриває каталог. Порожня
         кнопка каже «оберіть», а не показує порожній рядок, — бо колір і
         розмір тут законно бувають ще невідомі, і мовчазний прочерк не
         відрізнити від недогляду. */
      (ro
        ? '<div class="dz-u-ro">' +
            '<span><i>Виріб</i>' + esc((g && g.name) || u.name || '—') + '</span>' +
            '<span><i>Колір</i>' +
              (u.colorHex ? '<b class="dz-sw" style="background:' + esc(u.colorHex) + '"></b>' : '') +
              esc(u.color || 'ще не знаємо') + '</span>' +
            '<span><i>Розмір</i>' + esc(u.size || 'ще не знаємо') + '</span>' +
            '<span><i>Кількість</i>' + (+u.qty || 0) + ' шт</span>' +
          '</div>'
        /* Підписи живуть УСЕРЕДИНІ полів. Ряд «ВИРІБ · КОЛІР · РОЗМІР ·
           КІЛЬКІСТЬ» над кнопками займав рядок і не додавав нічого: кнопка
           з назвою виробу і так каже, що це виріб, а порожня чесно просить
           обрати. */
        : '<div class="dz-u-f">' +
        '<i class="dz-u-n is-' + (dzColState(u, 'graphic') || 'none') + '" title="' +
          (dzColState(u, 'graphic') === 'done' ? 'передано вишивальному дизайнеру'
            : dzColState(u, 'graphic') === 'sent' ? 'передано графічному дизайнеру'
            : 'ще нікому не передано') + '">' + n + '</i>' +
        '<button type="button" class="dz-pickb' + (u.gid ? ' on' : '') +
          '" data-do="u-pick-gid" data-u="' + esc(u.id) + '">' +
          esc((g && g.name) || u.name || 'Обрати виріб') + '</button>' +
        '<button type="button" class="dz-pickb' + (u.color ? ' on' : '') +
          '" data-do="u-pick-color" data-u="' + esc(u.id) + '"' +
          (u.gid ? '' : ' disabled') + '>' +
          (u.colorHex ? '<i class="dz-sw" style="background:' + esc(u.colorHex) + '"></i>' : '') +
          esc(u.color || 'Колір') + '</button>' +
        '<button type="button" class="dz-pickb' + (u.size ? ' on' : '') +
          '" data-do="u-pick-size" data-u="' + esc(u.id) + '"' +
          (u.gid ? '' : ' disabled') + '>' +
          esc(u.size || 'Розмір') + '</button>' +
        '<input class="dz-qty" type="number" min="1" title="Кількість" ' +
          'data-uf="' + esc(u.id) + '|qty" value="' + (+u.qty || 1) + '">' +
        /* Дії — у кінці того самого рядка. Значками, а не словами: вони
           дрібні, повторювані й самі себе пояснюють. */
        '<span class="dz-u-acts">' +
          '<button class="dz-ib" data-do="u-dup" data-u="' + esc(u.id) + '" ' +
            'title="Те саме ще раз — далі міняєте колір чи розмір">⧉</button>' +
          '<button class="dz-ib dz-ib-x" data-do="u-del" data-u="' + esc(u.id) + '" ' +
            'title="Прибрати цей одяг">🗑</button>' +
        '</span>' +
      '</div>') +
      /* Коментар іде ПЕРЕД картинками: спершу словами, що треба, потім
         показ. Підпису над полем немає навмисно — слово «Коментар» уже
         стоїть усередині, і другий раз його писати нема чого. */
      (ro
        ? (u.note ? '<div class="dz-u-ronote"><i>Коментар менеджера</i>' +
                    esc(u.note) + '</div>' : '')
        /* ОДИН РЯДОК, ЯКИЙ РОСТЕ.

           Дві порожні строчки в кожній позиції — це шість зайвих рядків у
           картці на три вироби, і всі вони мовчать. Коментар здебільшого
           короткий: «лого менше». Поле починається з одного рядка й
           росте саме тоді, коли є що вмістити. */
        : '<label class="dz-u-note">' +
        '<textarea rows="1" data-grow data-uf="' + esc(u.id) + '|note" ' +
          'placeholder="Коментар — словами клієнта">' + esc(u.note || '') +
        '</textarea></label>') +
      /* Картинки саме до цього типу одягу. У замовленні буває два різні
         стилі, і референси до них різні: спільна купа зверху змушує
         дизайнера гадати, що з неї стосується його виробу. */
      /* Кнопка «додати» — такий самий квадратик, як самі картинки, і стоїть
         у їхньому ряду. Окрема кнопка збоку читалась як чужа річ, а не як
         «ще одна плитка»; та й ряд картинок вона розривала. */
      '<div class="dz-u-pics">' +
        /* Квадратиками, а не полотнами. Референсів буває пʼять, і кожен на
           пів картки означає, що склад замовлення доводиться шукати
           прокруткою. Квадратик каже «вона тут є», а роздивитись її можна
           натиском — і саме тоді, коли треба. */
        /* `u.pics || []` — не перестраховка. Позиції, заведені до появи
           картинок, приходять із бази БЕЗ цього поля зовсім, і `.map` на
           ньому валив увесь розділ: «Cannot read properties of undefined».
           Нові дані такої дірки не мають, старі — мають, і живуть вони в
           одній базі. */
        '<div class="dz-pics">' +
          (u.pics || []).map(function(pp, i){
              return '<span class="dz-pic">' +
                '<button type="button" class="dz-pic-b" data-do="pic-open" ' +
                  'data-url="' + esc(pp.url) + '" title="' + esc(pp.name || 'Подивитись') + '">' +
                  '<img src="' + esc(pp.url) + '" alt="" loading="lazy">' +
                '</button>' +
                (ro ? '' : '<button class="dz-pic-x" data-do="u-pic-del" data-u="' + esc(u.id) +
                '" data-i="' + i + '">×</button>') + '</span>';
          }).join('') +
          (ro ? '' : '<button type="button" class="dz-pic-add" data-do="u-pic" data-u="' +
            esc(u.id) + '" title="Додати картинку">＋</button>') +
        '</div>' +
      '</div>' +
      /* Правка до типу одягу. Менеджер копіює сюди слова клієнта з
         переписки — і вони їдуть разом із виробом, а не лишаються в чаті,
         куди дизайнер не має доступу. */
      /* Два списки, відбиті один від одного. Це не оформлення: графіку й
         вишивку роблять різні люди, і кожен має з першого погляду бачити
         свою половину, а не шукати її серед чужої. */
      /* Дві колонки, відбиті одна від одної: графіку й вишивку роблять різні
         люди. Дизайнеру показуємо тільки його половину — у графічного нема
         чого робити у вишивальних файлах, і навпаки. */
      /* Дві колонки поруч: ліворуч графіка, праворуч вишивка. Це не
         оформлення — графіку й вишивку роблять різні люди, і менеджер має
         бачити обидві половини одночасно, а не гортати між ними. Складати
         їх в одну колонку більше не треба: рядки дизайну тепер короткі, у
         них немає ні розмови, ні списку версій. */
      '</div>' +
      /* ── ДИЗАЙН: хто малює й що вже намальовано ── */
      capHtml('Дизайн') +
      /* Яку половину тримаємо відкритою. Дизайнеру показують лише його
         половину (`only`) — там вибору немає й смужки теж. */
      (function(бік){ return '<div class="dz-u-dz' + (only ? ' one'
        : (бік === 'stitch' ? ' is-s' : ' is-g')) + '">' +
        (only === 'stitch' ? '' :
         (!only && бік !== 'graphic') ? railHtml(u, 'graphic') :
          '<div class="dz-u-col is-' + (dzColState(u, 'graphic') || 'none') + '">' +
          dzColHtml(u, 'graphic', ro) +
          /* Рядок заводиться САМ. Доти його треба було створити кнопкою, і
             лише тоді зʼявлявся вибір людини: два кроки там, де діло одне.
             Тепер колонка одразу пропонує обрати дизайнера. */
          (dzList(u, 'graphic').length
            ? dzList(u, 'graphic').map(function(d, i){
                return designRowHtml(u, 'graphic', d, i, ro, job, opt.o,
                                     dzList(u, 'graphic').length); }).join('')
            : (ro ? '<div class="dz-miss is-calm">Графіку не замовляли.</div>'
                  : designRowHtml(u, 'graphic', D.dzNew(), 0, ro, job, opt.o, 1))) +
          /* «+ ЩЕ ДИЗАЙН» ЗВІДСИ ПІШЛО.

             Менеджер передає позицію ОДИН раз, а скільки в ній нанесень —
             вирішує дизайнер, коли розкладає роботу на виробі. Андрій:
             «це буде один дизайн робити, розміщувати на одязі». Кнопка
             пропонувала менеджеру рішення, якого він не ухвалює, і другий
             рядок заводили випадково. */
          /* «+ Додати дизайнера» звідси пішло. Другий графічний дизайнер на
             одному виробі — випадок на сто замовлень, а кнопка стояла в
             кожному й щоразу пропонувала зробити те, чого не роблять. */
        '</div>') +
        (only === 'graphic' ? '' :
         (!only && бік !== 'stitch') ? railHtml(u, 'stitch') :
          '<div class="dz-u-col is-' + (dzColState(u, 'stitch') || 'none') + '">' +
          dzColHtml(u, 'stitch', ro) +
          (dzList(u, 'stitch').length
            ? dzList(u, 'stitch').map(function(d, i){
                return designRowHtml(u, 'stitch', d, i, ro, job, opt.o,
                                     dzList(u, 'stitch').length); }).join('')
            : (ro ? '<div class="dz-miss is-calm">Вишивку не замовляли.</div>'
                  : D.graphicOk(u)
                  ? designRowHtml(u, 'stitch', D.dzNew(), 0, ro, job, opt.o)
                  /* Оцифровувати нема чого, поки графіку не затвердили: файл
                     робили б під макет, який ще поміняють. */
                  : '<div class="dz-miss is-calm">Чекає: графіку ще не погодили.</div>')) +

        '</div>') +
      '</div>'; })(only || sideOf(u)) +
    '</div>';
  }
  /* ── КОМЕНТАР МЕНЕДЖЕРА Й ТЕРМІНОВІСТЬ ───────────────────────────────

     Стоїть НАД складом і над картинками, бо це рамка всього замовлення:
     дизайнер має прочитати її перш, ніж дивитись на вироби. Коментар — це
     не ТЗ: ТЗ каже, що малювати, а тут те, що менеджер знає про саме це
     замовлення й що має йти далі по ланцюгу разом із ним.

     Термін — датою, а не словом «терміново». «Терміново» через тиждень
     нічого не означає; 14.10 означає рівно те саме й через місяць. */
  /* ТЕРМІН І ДАТА ГОТОВНОСТІ.

     Термін — скільки днів іде замовлення; дата — коли ми його обіцяємо.
     Друге рахується з першого від дня, коли картку завели, але лишається
     редагованим: обіцянка — це рішення менеджера, а не наслідок формули.
     Змінили строк — дата перерахувалась; змінили дату руками — вона й
     лишиться, і саме її побачить дошка. */
  function daysDefault(){
    try{ return (host.b2cDays && host.b2cDays()) || 0; }catch(e){ return 0; }
  }
  /* ══════════ ВИБІР ДАТИ ══════════

     Дату здачі ставлять у кожній картці, і доти це було полем `type=date`:
     три числа через точку, з роком, які треба набрати з клавіатури або
     догребтись до них стрілками. Рік у ньому найгірший — усе, що ми
     обіцяємо, стоїть у цьому році або в наступному місяці, і писати його
     щоразу означає набирати чотири цифри, які й так відомі.

     Тепер кнопка показує «08.09» і відкриває місяць сіткою: око знаходить
     потрібне число, а палець його натискає. Плюс дві найчастіші відповіді
     готовими — «через тиждень» і «через два», бо саме так менеджер і
     думає про строк.

     Рік у самій кнопці зʼявляється тільки тоді, коли дата НЕ цьогорічна, —
     інакше «08.09» через півроку читалось би як минуле. */
  var CAL = null;
  var CAL_M = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
               'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function calIso(d){
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /* ДАТА, ЯКОЇ НЕ БУВАЄ, — ЦЕ НЕ ДАТА.

     У картці стояло «ГОТОВО 04.12.29 · прострочено 35364 дні». Тридцять
     пʼять тисяч днів — це 1929 рік: у базу колись потрапило поле з
     двозначним роком, і браузер чесно зрозумів його як минуле століття.
     Само по собі зіпсоване значення не страшне; страшно те, що система
     показувала його як обіцянку клієнту й рахувала від нього прострочення.
     Число, яке очевидно неправда, гірше за порожнє місце: порожнє просить
     заповнити, а неправда виглядає заповненою.

     Тому все, що поза робочим діапазоном, тут не існує: картка покаже
     «обрати дату», і менеджер поставить справжню. Межі широкі навмисно —
     ми не вгадуємо, у якому році працюємо, лише відсікаємо те, що
     замовленням бути не може. */
  var CAL_MIN = 2015, CAL_MAX = 2100;
  function calParse(v){
    var d = new Date(String(v || '') + 'T00:00:00');
    if(isNaN(d)) return null;
    var y = d.getFullYear();
    if(y < CAL_MIN || y > CAL_MAX) return null;
    return d;
  }
  function calClose(){
    if(CAL && CAL.parentNode) CAL.parentNode.removeChild(CAL);
    CAL = null;
  }
  /* Сітка місяця. Тиждень починається з понеділка — так пишуть усі
     календарі, з якими людина має справу поза цим екраном. */
  function calGrid(рік, міс, обрано){
    var перше = new Date(рік, міс, 1);
    var зсув = (перше.getDay() + 6) % 7;
    var днів = new Date(рік, міс + 1, 0).getDate();
    var сьогодні = calIso(new Date());
    var out = '';
    var i;
    for(i = 0; i < зсув; i++) out += '<span class="dz-cal-e"></span>';
    for(i = 1; i <= днів; i++){
      var v = рік + '-' + pad2(міс + 1) + '-' + pad2(i);
      var вих = ((зсув + i - 1) % 7) >= 5;
      out += '<button type="button" class="dz-cal-d' +
        (v === обрано ? ' on' : '') + (v === сьогодні ? ' today' : '') +
        (вих ? ' off' : '') + '" data-cal-d="' + v + '">' + i + '</button>';
    }
    return out;
  }
  function calPaint(){
    if(!CAL) return;
    var обрано = CAL.__v || '';
    CAL.innerHTML = '<div class="dz-cal-h">' +
        '<button type="button" class="dz-cal-a" data-cal-m="-1">‹</button>' +
        '<b>' + CAL_M[CAL.__m] + ' ' + CAL.__y + '</b>' +
        '<button type="button" class="dz-cal-a" data-cal-m="1">›</button>' +
      '</div>' +
      '<div class="dz-cal-w"><i>пн</i><i>вт</i><i>ср</i><i>чт</i><i>пт</i>' +
        '<i class="off">сб</i><i class="off">нд</i></div>' +
      '<div class="dz-cal-g">' + calGrid(CAL.__y, CAL.__m, обрано) + '</div>' +
      /* ЩО САМЕ ВИ ЩОЙНО ПООБІЦЯЛИ.

         Обрали число — і тут же видно, скільки це днів від сьогодні.
         Доти дізнатись про це можна було, тільки закривши календар і
         подивившись на картку, тобто вже пообіцявши. */
      (function(){
        var л = обрано ? leftTxt(обрано) : null;
        return л ? '<div class="dz-cal-l' + (л.late ? ' late' : л.soon ? ' soon' : '') +
          '">' + esc(dueTxt(обрано)) + ' · ' + esc(л.txt) + '</div>' : '';
      })() +
      /* Найчастіші дві відповіді готовими: строк називають тижнями, а не
         числами, і переводити «через два тижні» в дату — зайва арифметика,
         у якій і помиляються. */
      '<div class="dz-cal-f">' +
        '<button type="button" class="dz-cal-q" data-cal-plus="7">+ тиждень</button>' +
        '<button type="button" class="dz-cal-q" data-cal-plus="14">+ два</button>' +
        (обрано ? '<button type="button" class="dz-cal-q is-x" data-cal-clear>прибрати</button>' : '') +
      '</div>';
  }
  function calOpen(btn, value, onPick){
    calClose();
    var d = calParse(value) || new Date();
    var el = document.createElement('div');
    el.className = 'dz-cal';
    el.__y = d.getFullYear(); el.__m = d.getMonth();
    el.__v = calParse(value) ? calIso(d) : '';
    CAL = el;
    calPaint();
    document.body.appendChild(el);
    /* Ставимо під кнопкою, але не за краєм екрана: картка стоїть праворуч,
       і календар, вирівняний по лівому краю кнопки, наполовину виїжджав би
       за вікно. */
    var r = btn.getBoundingClientRect();
    var ш = el.offsetWidth || 250, в = el.offsetHeight || 280;
    var лів = Math.min(r.left, window.innerWidth - ш - 10);
    var вер = r.bottom + 6;
    if(вер + в > window.innerHeight - 8) вер = Math.max(8, r.top - в - 6);
    el.style.left = Math.max(8, лів) + 'px';
    el.style.top = вер + 'px';
    el.addEventListener('click', function(e){
      var t = e.target.closest ? e.target : null;
      var крок = t && t.closest('[data-cal-m]');
      if(крок){
        var к = +крок.getAttribute('data-cal-m');
        var n = new Date(el.__y, el.__m + к, 1);
        el.__y = n.getFullYear(); el.__m = n.getMonth();
        return calPaint();
      }
      var плюс = t && t.closest('[data-cal-plus]');
      if(плюс){
        var від = new Date();
        від.setDate(від.getDate() + (+плюс.getAttribute('data-cal-plus') || 0));
        calClose();
        return onPick(calIso(від));
      }
      if(t && t.closest('[data-cal-clear]')){ calClose(); return onPick(''); }
      var день = t && t.closest('[data-cal-d]');
      if(!день) return;
      calClose();
      onPick(день.getAttribute('data-cal-d'));
      return;
    });
    /* Клацнули повз — закрилось. Разом із Escape це два звичні способи
       вийти, і жоден із них не змінює дату. */
    var повз = function(ev){
      if(el.contains(ev.target) || btn.contains(ev.target)) return;
      document.removeEventListener('mousedown', повз, true);
      calClose();
    };
    var esk = function(ev){
      if(ev.key !== 'Escape') return;
      ev.stopPropagation();
      document.removeEventListener('keydown', esk, true);
      document.removeEventListener('mousedown', повз, true);
      calClose();
    };
    setTimeout(function(){ document.addEventListener('mousedown', повз, true); }, 0);
    document.addEventListener('keydown', esk, true);
  }
  /* ЗВИЧАЙНІ ДНІ, А НЕ РОБОЧІ.

     Спершу тут були робочі: здавалось чеснішим, бо в суботу ніхто не
     шиє. На ділі вийшло навпаки. Андрій: «постав 7 робочих днів, це по
     факту 9 днів… давай будемо ставити не в робочих днях, а в звичайних
     днях». І він має рацію — з клієнтом розмова йде в днях. «Сім
     робочих» той не рахує ніколи: він чує «сім днів» і чекає через
     сім. Число, яке треба подумки переводити в інше число, — це число,
     у якому рано чи пізно помиляться, і помилиться саме той, хто
     обіцяв.

     Тому рахунок найпростіший із можливих: день, коли завели картку,
     плюс стільки днів, скільки стоїть у полі. Вихідні всередині нього
     враховані наперед самим числом — девʼять замість семи. */
  function plusDays(від, d){
    var t = new Date(від.getTime());
    t.setDate(t.getDate() + d);
    return t;
  }
  function readyFrom(job){
    var d = +((job || {}).days) || daysDefault();
    if(!d) return '';
    var від = new Date(String((job || {}).createdAt || '') || Date.now());
    /* Битий `createdAt` дав би биту обіцянку, і саме так у картці й
       зʼявився 1929 рік. Не знаємо, коли завели, — рахуємо від сьогодні:
       це може бути неточно, але не може бути абсурдом. */
    if(isNaN(від) || від.getFullYear() < CAL_MIN || від.getFullYear() > CAL_MAX)
      від = new Date();
    return calIso(plusDays(від, d));
  }
  /* Скільки днів між двома датами. Потрібне в обидва боки: порахувати
     дату зі строку й порахувати строк із обраної дати. Рахуємо по
     календарних добах, а не по мілісекундах: переведення годинника
     навесні коротше на годину, і різниця в 9 діб виходила б 8,96 —
     тобто вісім після заокруглення вниз. */
  function daysBetween(a, b){
    var x = calParse(typeof a === 'string' ? a : calIso(a));
    var y = calParse(typeof b === 'string' ? b : calIso(b));
    if(!x || !y) return 0;
    return Math.round((y.getTime() - x.getTime()) / 86400000);
  }
  function termHtml(job){
    var d = +((job || {}).days) || '';
    return '<label class="dz-term" title="Скільки днів іде замовлення від дня, ' +
      'коли завели картку"><span>Днів</span>' +
      '<input type="number" min="1" max="120" value="' + (d || '') + '" ' +
      'placeholder="' + (daysDefault() || '—') + '" data-jf="days"></label>';
  }
  /* ══════════ СКІЛЬКИ ЛИШИЛОСЬ ══════════

     Андрій: «щоб писалося не дата до такого-то числа, а скільки днів
     залишилось до того, що ми здали».

     «До 08.10» — це число, яке щоразу треба віднімати від сьогодні, і
     робить це кожен, хто дивиться на картку: менеджер, дизайнер, той, хто
     заглянув через тиждень. Двадцять карток на дошці — двадцять відніманнь
     подумки, і рівно в одному з них помиляються. «Лишилось 6 днів» не
     треба рахувати взагалі.

     Останню добу показуємо годинами: у день здачі «лишилось 0 днів» не
     каже нічого, а «лишилось 7 год» каже все. Прострочене — окремо й
     червоним: це не менша кількість, це інший стан. */
  function leftTxt(v){
    var d = calParse(v);
    if(!d) return null;
    /* Рахуємо ДОБАМИ КАЛЕНДАРЯ, а не годинами між двома мітками. Різниця
       не умоглядна: «девʼять днів» від сьогодні має читатись як девʼять
       і о девʼятій ранку, і о шостій вечора. Рахуючи годинами, ми о
       шостій показали б вісім — і завели картку, яка сама себе
       скоротила. */
    var дн = daysBetween(calIso(new Date()), v);
    if(дн < 0)
      return { late: true, txt: 'прострочено ' + (-дн) + ' ' + dayWord(-дн) };
    /* Останню добу — годинами: у день здачі «лишилось 0 днів» не каже
       нічого, а «лишилось 7 год» каже все. Строк кінчається в кінці дня, а
       не о півночі перед ним: обіцяли «до восьмого» — восьме ще наше. */
    if(дн === 0){
      var кінець = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      var год = Math.max(1, Math.round((кінець.getTime() - Date.now()) / 3600000));
      return { soon: true, txt: 'лишилось ' + год + ' год' };
    }
    return { soon: дн <= 2, txt: 'лишилось ' + дн + ' ' + dayWord(дн) };
  }
  /* «1 день», «2 дні», «6 днів» — правило української, а не англійський
     хвіст «s». Написане неправильно, число читається як чужий текст. */
  function dayWord(n){
    var a = Math.abs(n) % 100, b = a % 10;
    if(a > 10 && a < 20) return 'днів';
    if(b === 1) return 'день';
    if(b >= 2 && b <= 4) return 'дні';
    return 'днів';
  }
  /* Дата коротко: «08.09». Рік дописуємо тільки тоді, коли він не цей, —
     інакше через півроку те саме «08.09» читалось би як давно минуле. */
  function dueTxt(v){
    var d = calParse(v);
    if(!d) return '';
    var свій = d.getFullYear() === new Date().getFullYear();
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) +
      (свій ? '' : '.' + String(d.getFullYear()).slice(2));
  }
  function dueHtml(job){
    /* Збережена дата проходить ту саму перевірку, що й будь-яка інша:
       зіпсовану не показуємо, а рахуємо строк наново від заготовки. */
    var своя = (job && job.due && calParse(job.due)) ? job.due : '';
    var v = своя || readyFrom(job);
    var late = false;
    if(v){
      var d0 = new Date(v + 'T23:59:59');
      late = !isNaN(d0) && d0.getTime() < Date.now();
    }
    /* Кнопка, а не поле. Поле `type=date` просило набрати три числа з
       роком; тут око бачить «08.09», а натиск відкриває місяць сіткою. */
    var л = v ? leftTxt(v) : null;
    /* ПОЛЕ «ДНІВ» ЗВІДСИ ПІШЛО.

       Андрій: «це по факту дублювання функціоналу. Ми його і так впишемо в
       адмінці, якщо це термін. Або якщо потрібно до конкретного замовлення,
       ми просто зайдемо в дату… і його змінимо».

       Він має рацію. Заготовка строку живе в налаштуваннях і діє на всі
       замовлення; окреме замовлення міняють датою, а не числом днів. Поле
       давало другий спосіб зробити те саме — і другий спосіб завжди рано
       чи пізно розходиться з першим. Саме число нікуди не зникло: воно й
       далі рахується всередині, просто його більше не треба вводити. */
    return '<button type="button" class="dz-duo' + (late ? ' late' : '') +
        (v ? '' : ' none') + '" data-cal="due" title="Коли обіцяємо — ' +
        'рахується від строку, але міняється натиском: відкриється календар">' +
        /* ЗНАЧОК КАЛЕНДАРЯ. Андрій: «тут календарик повинен бути, щоб
           зрозуміло, що на нього натискати треба і вибирати дату». Доти
           кнопка виглядала як напис: дата й слово «Готово», і те, що вона
           взагалі натискається, доводилось вгадувати. */
        '<i class="dz-duo-c">\uD83D\uDCC5</i>' +
        '<span>Готово</span><b>' + esc(v ? dueTxt(v) : 'обрати дату') + '</b>' +
        (л ? '<i class="dz-duo-l' + (л.late ? ' late' : л.soon ? ' soon' : '') + '">' +
             esc(л.txt) + '</i>' : '') +
      '</button>';
  }
  function unitsHtml(job, opt){
    var list = unitsOf(job);
    /* Заголовок пропускаємо, коли склад стоїть у зоні: зона вже підписана,
       і другий підпис того самого — це рядок, який нічого не додає. */
    return ((opt && opt.bare) ? '' : '<div class="dz-h">Склад замовлення</div>') +
      (list.length
        ? list.map(function(u, i){ return unitHtml(job, u, i + 1, opt); }).join('')
        : '<div class="dz-miss">Складу ще немає. Додайте одяг — саме з нього ' +
          'відділ і дізнається, що шити: виріб, колір, розмір, кількість.</div>') +
      ((opt && opt.ro) ? '' : '<button class="dz-b pri" data-do="u-add">+ Додати одяг</button>');
  }


  /* ══════════ ВІДПРАВКА ══════════
     Останній блок картки, і навмисно ТОНКИЙ. Накладна створюється в картці
     замовлення — там уже є і Нова пошта, і поле для номера, вписаного
     руками. Зробити другу таку кнопку тут означало б мати два місця, з
     яких на одну посилку виїжджають дві накладні.

     Тому відділ показує СТАН і веде туди, де це роблять: скільки всього
     штук їде, чи номер уже є, і кнопка. */
  /* ══════════ ГРОШІ ЗАМОВЛЕННЯ ══════════

     Три числа й одна дія. Сума — те, що клієнт має заплатити; передоплата —
     те, що вже прийшло; залишок — різниця, і саме його питають, коли
     пакують посилку («накладений платіж скільки?»).

     Порахувати залишок у голові можна, але саме там його й помиляються:
     сума лежить в одному місці, передоплата в іншому, а відповідь потрібна
     в мить відправки. Тому число стоїть готовим.

     Прив’язати саму оплату — окремою дією, яку ми ще налаштуємо. Поки
     передоплату вписують рукою: це чесно відповідає на питання «скільки
     лишилось» і нічого не вдає. */
  /* ══════════ ЗОНИ КАРТКИ ══════════

     Картка приватного замовлення — це пʼять різних розмов в одному вікні:
     хто клієнт, що шиємо й хто це малює, скільки грошей, куди їде. Доти
     вони йшли одним потоком, розділені однаковими сірими підписами, і очима
     в ньому місце не знаходилось — картку доводилось читати підряд, згори
     до низу, щоразу.

     Тепер у кожної зони свій колір і свій значок, і колір той самий, що у
     воронці: синій — клієнт, фіолетовий — склад і дизайн, зелений — гроші,
     бурштиновий — відправка. Знайти потрібне стало питанням кольору, а не
     читання.

     Зони НЕ ЗГОРТАЮТЬСЯ, і це рішення, а не недоробка. Складена зона
     ховає рівно те, через що замовлення й стоїть: незаповнену адресу,
     непризначеного дизайнера, невнесену передоплату. Картку відкривають,
     щоб побачити стан цілком, — а кожен зайвий натиск на шляху до нього
     означає, що його не побачать. Гроші й Відправка доти були складеними
     саме так і саме тому розгорнуті тут.

     Підпис у шапці зони — не окраса: він каже головне, не змушуючи читати
     зону. «3 позиції · 12 шт», «5 400 ₴ · лишилось 2 400», «є дані, ТТН
     немає». */
  /* Та сама зона, але складена. Відкривається натиском і памʼятає, що її
     відкрили: якщо вона щоразу згорталась назад, за нею перестали б
     заходити зовсім. */
  var FOLD = {};
  function foldHtml(колір, значок, назва, підпис, вміст){
    if(!вміст) return '';
    var від = !!FOLD[назва];
    return '<section class="dz-z z-' + колір + ' is-fold' + (від ? ' open' : '') + '">' +
      '<button type="button" class="dz-z-h" data-fold="' + esc(назва) + '">' +
        '<i class="dz-z-i">' + значок + '</i>' +
        '<b>' + esc(назва) + '</b>' +
        (підпис ? '<span class="dz-z-s">' + esc(підпис) + '</span>' : '') +
        '<i class="dz-z-a">' + (від ? '▴' : '▾') + '</i>' +
      '</button>' +
      (від ? '<div class="dz-z-b">' + вміст + '</div>' : '') +
    '</section>';
  }
  function zoneHtml(колір, значок, назва, підпис, вміст){
    if(!вміст) return '';
    return '<section class="dz-z z-' + колір + '">' +
      '<div class="dz-z-h"><i class="dz-z-i">' + значок + '</i>' +
        '<b>' + esc(назва) + '</b>' +
        (підпис ? '<span class="dz-z-s">' + esc(підпис) + '</span>' : '') +
      '</div>' +
      '<div class="dz-z-b">' + вміст + '</div>' +
    '</section>';
  }
  /* ══════════ СКІЛЬКИ КОШТУЄ — З ПРАЙСУ, А НЕ З ГОЛОВИ ══════════

     Доти сума приватного замовлення бралась із `totalPrice` — поля, яке в
     таких замовленнях ніхто не заповнює: вони заводяться прямо у відділі,
     без прорахунку. Тобто в картці стояв нуль, а справжню суму менеджер
     тримав у голові й переказував клієнту наново щоразу.

     Тепер вона рахується з того, що вже стоїть у складі: виріб × кількість
     за роздрібною ціною з налаштувань B2C. Ціну дає робоче місце — довідник
     товарів один, і заводити у відділі свій означало б розійтися з ним за
     тиждень.

     Рядок за рядком, а не одним числом: коли сума виглядає не так, питання
     завжди «а за що саме», і відповідь мусить бути тут же. */
  function retailOf(gid){
    try{ return Math.max(0, Math.round((host.retail && host.retail(gid)) || 0)); }
    catch(e){ return 0; }
  }
  function costOf(gid){
    try{ return Math.max(0, Math.round((host.cost && host.cost(gid)) || 0)); }
    catch(e){ return 0; }
  }
  function sumRows(job){
    return unitsOf(job).map(function(u){
      var g = catItem(u.gid);
      var ціна = retailOf(u.gid);
      var соб = costOf(u.gid);
      var к = Math.max(0, Math.round(+u.qty || 0));
      return { name: (g && g.name) || u.name || 'без виробу',
               color: u.color || '', qty: к, price: ціна, sum: ціна * к,
               cost: соб, costSum: соб * к,
               нема: !!u.gid && !ціна };
    });
  }
  /* Собівартість замовлення. Порожня собівартість виробу — це «невідомо», а
     не нуль: нуль означав би, що виріб дістався безкоштовно, і прибуток
     вийшов би завищеним рівно на вартість тканини. Тому разом із сумою
     віддаємо й те, чи вона повна: аналітика мусить знати, коли мовчати. */
  function orderCost(job){
    var rows = sumRows(job);
    var сума = 0, повна = true;
    rows.forEach(function(r){
      if(!r.qty) return;
      if(!r.cost){ повна = false; return; }
      сума += r.costSum;
    });
    return { sum: сума, full: повна && rows.some(function(r){ return r.qty; }) };
  }
  function orderSum(o, job){
    var з = sumRows(job).reduce(function(a, r){ return a + r.sum; }, 0);
    if(з) return з;
    /* Складу ще немає або ціни не заповнені — лишається те, що порахував
       прорахунок. Нуль показуємо як нуль: вигадана сума гірша за її
       відсутність. */
    var зХоста = 0;
    try{ зХоста = (host.orderSum && host.orderSum(o)) || 0; }catch(e){}
    return зХоста || +((o || {}).totalPrice) || 0;
  }
  function paidOf(o){
    try{ return Math.max(0, Math.round((host.paid && host.paid(o)) || 0)); }
    catch(e){ return 0; }
  }
  function moneySub(o, job){
    var сума = orderSum(o, job);
    if(!сума) return 'суми ще немає';
    var пре = paidOf(o) || Math.max(0, Math.round(+((o || {}).prepaid) || 0));
    var лишок = Math.max(0, сума - пре);
    return грн(сума) + (пре ? ' · лишилось ' + грн(лишок) : '');
  }
  /* ══════════ ПЕРЕДОПЛАТА — ПЛАТЕЖЕМ, А НЕ ЧИСЛОМ ══════════

     Вписана руками передоплата — це слово менеджера проти виписки. Вона
     сходиться, поки її пишуть уважно, і розходиться саме тоді, коли треба
     відповісти «а скільки вже прийшло»: число в картці є, а рух у банку
     невідомо який.

     Тому суму тут не пишуть. Її ОБИРАЮТЬ зі списку надходжень, які вже
     лежать у Фінансах: платіж прив'язується до замовлення, і сума в картці
     стає наслідком того, що справді прийшло на рахунок. Кожен платіж
     підписується — передоплата, оплата, доплата, наложка, — бо 3000 ₴ за
     новим замовленням і 3000 ₴ доплати за старим це різні речі. */
  var PAY_TAG = { prepay:'Передоплата', pay:'Оплата', final:'Доплата', cod:'Наложка' };
  function payWrap(o){
    try{ return (host.payments && host.payments(o)) || null; }catch(e){ return null; }
  }
  function payRowsHtml(o){
    var w = payWrap(o);
    if(!w) return '';
    var свої = w.linked || [], вільні = w.free || [];
    return '<div class="dz-pay">' +
      (свої.length
        ? свої.map(function(p){
            return '<div class="dz-pay-r">' +
              '<b>' + esc(грн(p.amount)) + '</b>' +
              '<span>' + esc(p.at || '') + (p.acc ? ' · ' + esc(p.acc) : '') + '</span>' +
              '<select data-payt="' + esc(p.id) + '" title="Чим це є">' +
                Object.keys(PAY_TAG).map(function(k){
                  return '<option value="' + k + '"' + (p.tag === k ? ' selected' : '') +
                    '>' + esc(PAY_TAG[k]) + '</option>'; }).join('') +
              '</select>' +
              '<button class="dz-ib dz-ib-x" data-do="pay-off" data-p="' + esc(p.id) +
                '" title="Відвʼязати платіж">🗑</button>' +
            '</div>';
          }).join('')
        : '<div class="dz-miss">Платежів до цього замовлення ще не привʼязано.</div>') +
      (вільні.length
        ? '<button class="dz-b pri" data-do="pay-pick">+ Привʼязати платіж' +
          ' <i>· вільних ' + вільні.length + '</i></button>'
        : '<div class="dz-miss">Непривʼязаних надходжень у Фінансах немає. ' +
          'Платіж зʼявиться там сам, коли підключимо банк, — або його можна ' +
          'записати руками в розділі Фінанси.</div>') +
    '</div>';
  }
  function moneyBody(o, job){
    var rows = sumRows(job);
    var сума = orderSum(o, job);
    var пре = paidOf(o);
    /* Вписана руками передоплата лишається читаною, поки банки не
       підключені й у старих картках: викидати її означало б мовчки
       занизити внесене. Але нового поля для неї немає — нове вводять
       платежем. */
    var рукою = Math.max(0, Math.round(+((o || {}).prepaid) || 0));
    var внесено = пре + (пре ? 0 : рукою);
    var лишок = Math.max(0, сума - внесено);
    return '<div class="dz-money">' +
      (rows.length
        ? '<div class="dz-sum">' + rows.map(function(r){
            return '<div class="dz-sum-r' + (r.нема ? ' no' : '') + '">' +
              '<span>' + esc(r.name) + (r.color ? ' · ' + esc(r.color) : '') + '</span>' +
              '<i>' + r.qty + ' × ' + esc(грн(r.price)) + '</i>' +
              '<b>' + esc(грн(r.sum)) + '</b>' +
            '</div>';
          }).join('') +
          (rows.some(function(r){ return r.нема; })
            ? '<div class="dz-miss">Для виділених виробів роздрібної ціни ще ' +
              'немає. Заповніть її в Налаштуваннях B2C — і сума порахується сама.</div>'
            : '') +
        '</div>'
        : '') +
      '<div class="dz-money-r"><span>Разом за замовлення</span><b>' +
        esc(грн(сума)) + '</b></div>' +
      (рукою && !пре
        ? '<div class="dz-money-r"><span>Внесено (вписано руками)</span><b>' +
          esc(грн(рукою)) + '</b></div>'
        : '<div class="dz-money-r"><span>Надійшло за платежами</span><b>' +
          esc(грн(пре)) + '</b></div>') +
      '<div class="dz-money-r is-left"><span>Залишок до оплати</span><b>' +
        esc(грн(лишок)) + '</b></div>' +
      payRowsHtml(o) +
    '</div>';
  }
  function грн(n){
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
  }
  function shipHtml(p){
    var o = p.o || {}, job = p.job;
    var q = unitsOf(job).reduce(function(a, u){ return a + (+u.qty || 0); }, 0);
    if(!q) (o.items || []).forEach(function(it){
      if((it.kind || 'main') !== 'reco') q += (+it.qty || 0); });
    var ttn = String(o.ttn || '').trim();
    /* У власного замовлення відділу немає картки в Канбані, а отже й
       кнопки «створити накладну»: накладні робить робоче місце продажу.
       Тут номер просто записують — цього досить, щоб знати, чим поїхало. */
    /* Відправка цікавить рівно двічі за все замовлення, а місце займає
       щоразу. Тому вона згорнута й підписана тим, що в ній насправді
       шукають, — номером накладної. Коли номер уже є, він видно й
       згорнутою: інакше довелось би розгортати, щоб дізнатись, чи він є. */
    /* ВІДПРАВКА — ЦЕ ДАНІ ДЛЯ НАКЛАДНОЇ, А НЕ НОМЕР.

       Приватне замовлення їде посилкою, і номер накладної не вводять
       руками — його видає Нова пошта за тим, що ми їй скажемо: місто,
       відділення або адреса, телефон, імʼя. Тому тут лежить саме це, а
       номер зʼявляється як результат.

       Блок згорнутий: за все замовлення в нього заходять двічі, а місце
       він займав би весь час. Головне видно й згорнутим — номер, якщо він
       уже є, і чого бракує, якщо ще ні. */
    var пош = o.ship || {};
    var поле = function(k, підпис, ph, тип){
      return '<label class="dz-own-f"><span>' + esc(підпис) + '</span>' +
        '<input type="' + (тип || 'text') + '" data-sf="' + k + '" value="' +
        esc(пош[k] || '') + '" placeholder="' + esc(ph) + '"></label>';
    };
    var бракує = ['city','office','phone','name'].filter(function(k){ return !пош[k]; }).length;
    /* Розгорнуто, а не складено. Складений блок ховав рівно те, через що
       посилка й не їде: незаповнену адресу. Підпис зони каже стан, а поля
       стоять відкритими — заповнити їх можна, не відкриваючи нічого. */
    if(o.dir === 'b2c')
      return '<div class="dz-ship-f">' +
          поле('name', 'Імʼя та прізвище', 'на кого оформити') +
          поле('phone', 'Телефон', '+380…', 'tel') +
          поле('city', 'Місто', 'куди їде') +
          поле('office', 'Відділення або адреса', '№ відділення чи вулиця') +
        '</div>' +
        '<div class="dz-ship">' +
          '<div class="dz-ship-l"><b>' +
            (q ? q + ' шт' : 'кількість ще не вказана') + '</b></div>' +
          '<label class="dz-own-f"><span>Накладна</span>' +
            '<input data-of="ttn" value="' + esc(ttn) + '" placeholder="номер ТТН"></label>' +
        '</div>';
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
  /* Те саме без власного заголовка — коли блок стоїть у підписаній зоні. */
  function shipBody(p){
    return shipHtml(p).replace('<div class="dz-h">Відправка</div>', '');
  }
  /* Підписи зон. Кажуть головне, не змушуючи зону читати: «4 позиції ·
     12 шт», «ТТН 2045…», «даних бракує: 2». Порожній підпис нічого не
     означає — його просто немає. */
  function shipSub(o){
    var ttn = String((o || {}).ttn || '').trim();
    if(ttn) return 'ТТН ' + ttn;
    var пош = (o || {}).ship || {};
    var бракує = ['city','office','phone','name'].filter(function(k){ return !пош[k]; }).length;
    return бракує ? ('даних бракує: ' + бракує) : 'дані є, накладної ще немає';
  }
  function unitsSub(job){
    var list = unitsOf(job);
    if(!list.length) return '';
    var шт = list.reduce(function(a, u){ return a + (Math.max(0, +u.qty || 0)); }, 0);
    return list.length + ' ' + (list.length === 1 ? 'позиція' : 'позиції') +
      (шт ? ' · ' + шт + ' шт' : '');
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
  /* КОГО МОЖНА ПОСТАВИТИ НА ЦЮ РОБОТУ.

     Список фільтрується за роллю навмисно: віддати вишивку графічному
     легко, а помічають це через день, коли файл уже не той. Але сам себе
     менеджер поставити не міг ніяк — а без цього неможливо пройти шлях
     замовлення й побачити, що бачить дизайнер.

     Тому себе показуємо ОКРЕМИМ рядком угорі й підписуємо чесно: це для
     перевірки, а не для щоденної роботи. Коли зʼявляться живі дизайнери,
     міняти нічого не доведеться — рядок просто перестане бути потрібним. */
  function teamOpts(role, cur){
    var all = (host.team ? host.team() : []);
    var list = all.filter(function(m){
      return !role || m.role === role || m.role === 'owner';
    });
    var jobs = pairs().map(function(p){ return p.job; });
    var me = (host.me && host.me()) || '';
    var опт = function(m, мітка){
      var n = D.loadOf(jobs, m.email);
      var full = n >= D.TAKE_LIMIT;
      return '<option value="' + esc(m.email) + '"' +
             (m.email === cur ? ' selected' : '') + (full ? ' disabled' : '') + '>' +
             esc(мітка || m.name || m.email) +
             (n ? ' · ' + n + (full ? ' — повний' : '') : ' · вільний') + '</option>';
    };
    var out = '';
    var я = all.filter(function(m){ return m.email === me; })[0];
    if(я && !list.some(function(m){ return m.email === me; }))
      out += опт(я, 'Я · для перевірки');
    return out + list.map(function(m){ return опт(m); }).join('');
  }
  function teamPick(id, role, cur){
    return '<select id="' + id + '"><option value="">— оберіть —</option>' +
      teamOpts(role, cur) + '</select>';
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
    teamPick: teamPick, teamOpts: teamOpts, ROLES: ROLES, roleSeat: roleSeat, isBoss: isBoss,
    jobNo: jobNo, unitNo: unitNo, SIDE: SIDE, sideOf: sideOf,
    seek: seek, seekSet: seekSet, seekHit: seekHit,
    clientHtml: clientHtml, taskBlockHtml: taskBlockHtml,
    unitsHtml: unitsHtml, dueHtml: dueHtml, readyFrom: readyFrom, writeHtml: writeHtml,
    unitsOf: unitsOf, unitAt: unitAt,
    shipHtml: shipHtml, shipBody: shipBody,
    /* Зони картки, їхні підписи й сам підрахунок суми. Панелі складають
       картку з них, а не малюють кожна свій варіант того самого. */
    zoneHtml: zoneHtml, foldHtml: foldHtml, FOLD: FOLD,
    unitsSub: unitsSub, shipSub: shipSub,
    moneyBody: moneyBody, moneySub: moneySub, orderSum: orderSum,
    /* Календар і коротка дата: тією ж кнопкою, звідки б її не показували. */
    calOpen: calOpen, dueTxt: dueTxt, PAY_TAG: PAY_TAG, CAL_M: CAL_M,
    orderCost: orderCost, sumRows: sumRows,
    daysBetween: daysBetween, calIso: calIso, leftTxt: leftTxt, pad2: pad2,
    unitNew: unitNew, catItem: catItem,
    pickGarment: pickGarment, pickColor: pickColor, pickSize: pickSize,
    pickOpen: pickOpen, fixOpen: fixOpen, histHtml: histHtml, histSub: histSub,
    picOpen: picOpen,
    DZ_OPEN: DZ_OPEN, TAIL_ALL: TAIL_ALL, SWAP: SWAP, whoName: whoName,
    /* Версії й розмова по одному дизайну — панель дизайнера малює їх тими
       самими функціями, що й менеджер: різні мали б розійтись за тиждень. */
    dzVersHtml: dzVersHtml, dzThreadHtml: dzThreadHtml, dzChatHtml: dzChatHtml,
    DZ_STATE: DZ_STATE,
    unitPhoto: unitPhoto,
    taskCards: taskCards, hm: hm,
    /* Одна відповідь на всі модулі: права питає робоче місце, а не кожен
       модуль сам. Без адмінки (модуль піднятий окремо) дозволено все. */
    can: can
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
  /* Вікно «Надіслати клієнту?»: картка, що поїде, і текст повідомлення.
     Повертає текст (можливо, поправлений) або null, якщо передумали. */
  function tellConfirm(url, text, title){
    return new Promise(function(res){
      var w = document.createElement('div');
      w.className = 'dz-pick dz-cf';
      w.innerHTML = '<div class="dz-cf-b" role="dialog" aria-label="Надіслати клієнту">' +
        '<div class="dz-cf-h">Надіслати клієнту' + (title ? ' · ' + U.esc(title) : '') + '</div>' +
        '<img class="dz-cf-i" src="' + U.esc(url) + '" alt="">' +
        '<textarea class="dz-cf-t" rows="4">' + U.esc(text || '') + '</textarea>' +
        '<div class="dz-cf-f">' +
          '<button type="button" class="dz-b" data-cf="no">Скасувати</button>' +
          '<button type="button" class="dz-b pri" data-cf="yes">Надіслати</button>' +
        '</div></div>';
      var done = function(v){ if(w.parentNode) w.parentNode.removeChild(w); res(v); };
      w.addEventListener('click', function(e){
        var b = e.target.closest('[data-cf]');
        if(b) return done(b.dataset.cf === 'yes' ? String(w.querySelector('.dz-cf-t').value || '') : null);
        if(e.target === w) done(null);
      });
      document.body.appendChild(w);
      var y = w.querySelector('[data-cf="yes"]'); if(y) y.focus();
    });
  }
  /* У якій ролі зараз дивляться: на дошці графічного — графічний
     дизайнер, вишивального — вишивальний, решта — акаунт-менеджер. Від
     цього залежить, що стоїть праворуч і що рахується пропущеним. */
  function asRole(){
    var t = U.tab();
    return t === 'graphic' ? 'graphic' : t === 'stitch' ? 'stitch' : 'acct';
  }
  function save(job, o, msg){
    job.updatedAt = new Date().toISOString();
    try{ D.dzAutoQueue(job, o, (host().me && host().me()) || ''); }
    catch(e){ console.warn('черга відділу', e); }
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
  /* ДОШКА АКАУНТ-МЕНЕДЖЕРА — САМЕ ТА, ЯКУ ВІН І ДИВИТЬСЯ.
     (Була ще одна, queueCards, яку не викликав ніхто: усе, що туди клали,
     ніхто ніколи не бачив. Її більше немає.)

     На картці рівно те, за чим обирають, чим зайнятись:
       • номер і НІК — за ніком людину впізнають, за номером шукають;
       • СУМА — велика: між двадцятьма картками обирають за нею;
       • ДАТА, коли здаємо, — питання «що горить» задають саме дошці;
       • де воно зараз — у кого на руках і чого чекає;
       • непрочитане, «чекають відповіді» й кнопка написати клієнту.

     Назв одягу тут немає навмисно: вони довгі, однакові в половині карток
     і на питання «за що братись» не відповідають. Підпису «акаунт-менеджер»
     теж — це був той самий текст на всіх картках колонки, тобто нічого. */
  function chainCards(){
    var m = (host().me && host().me()) || '';
    return U.pairs().map(function(p){
      var col = D.chainAt(p.job, p.o);
      var open = D.taskOpen(p.job).length;
      var mk = cardMarks(p.job, m);
      return { id: p.o.orderId, step: col,
        title: U.jobNo(p.job),
        /* Свій годинник — від приходу замовлення до передачі у
           виробництво. Доти тут не світилось нічого, і замовлення могло
           простояти в акаунта тиждень непоміченим. */
        left: D.stageLeft(p.job, p.o, 'acct', termHours('acct')),
        nick: cardNick(p.o),
        /* Число й готовий напис разом: рахує його шар панелі, а малює шар
           дошки — і лізти одному в помічники іншого означає рано чи пізно
           отримати «money is not defined» рівно там, де його не видно. */
        sum: jobSum(p.o), sumTxt: money(jobSum(p.o)),
        due: p.job.due || p.job.readyAt || '',
        chat: hasChat(p.o),
        /* Пропущене від клієнта — кружечком на кнопці Instagram, від
           дизайнерів — кружечком на самій картці. */
        igN: clientUnread(p.o),
        wait: mk.wait, unseen: mk.unseen,
        foot: jobWhere(p.job) + (open ? ' · доручень ' + open : '') };
    });
  }
  /* Нік клієнта коротко. Імʼя лишається в картці; на дошці важить саме нік —
     за ним людину впізнають з одного погляду. */
  function cardNick(o){
    var n = String((o && o.crmNick) || '').trim();
    if(n) return '@' + n;
    var ig = String((o && o.ig) || '').trim();
    return ig ? (ig.charAt(0) === '@' ? ig : '@' + ig) : '';
  }
  /* Що показати на картці, крім назви. Три речі, які й тримають роботу:
     хто нею зайнятий, чи хтось чекає на відповідь і чи є непрочитане. */
  function cardMarks(job, me){
    var чекає = D.waiting(job, me);
    var нових = 0;
    U.unitsOf(job).forEach(function(u){
      ['graphic','stitch'].forEach(function(k){
        D.dzList(u, k).forEach(function(d){ нових += D.dzUnseen(d, me, 'acct', k); });
      });
    });
    return { wait: чекає, unseen: нових };
  }
  /* Чи є привʼязана розмова. Поля її зберігання належать робочому місцю, а
     не відділу: відділ питає одне — чи можна натиснути й написати. */
  function hasChat(o){
    try{ return !!(host().hasChat && host().hasChat(o)); }catch(e){ return false; }
  }
  function clientUnread(o){
    try{ return +((host().clientUnread && host().clientUnread(o)) || 0) || 0; }catch(e){ return 0; }
  }
  function unitNames(job, o){
    var з = U.unitsOf(job).map(function(u){ return u.name; }).filter(Boolean);
    if(з.length) return з.slice(0, 2).join(' · ');
    return (o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
      .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · ');
  }
  /* СКІЛЬКИ ГРОШЕЙ У ЗАМОВЛЕННІ.

     Не заради звіту: на дошці стоїть двадцять карток, і між ними треба
     обирати, за яку братись першою. Назви одягу цього питання не
     вирішують — «футболка» стоїть і в замовленні на дві штуки, і в
     замовленні на двісті. Сума вирішує з одного погляду, тому вона й
     велика: чим більша, тим помітніша. */
  function jobSum(o){
    var s = +((o || {}).totalPrice) || 0;
    if(!s) s = ((o || {}).items || []).reduce(function(a, it){
      return a + (Math.round(+it.price || 0) || 0); }, 0);
    return s;
  }
  function money(n){
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴';
  }
  /* Сантиметри одним записом на весь модуль: різні способи написати те саме
     число читаються як різні числа. */
  function мсм(n){
    return (Math.round((+n || 0) * 10) / 10).toString().replace('.', ',') + ' см';
  }
  /* ДЕ ЗАМОВЛЕННЯ ЗАРАЗ — словами, а не роллю.

     Доти тут писалось «акаунт-менеджер»: підпис колонки, той самий на всіх
     картках колонки. Він не казав нічого — колонка й так підписана. Питання
     інше: у кого воно на руках і чого чекає. */
  function jobWhere(job){
    var передані = [], чекають = [];
    U.unitsOf(job).forEach(function(u){
      ['graphic','stitch'].forEach(function(k){
        D.dzList(u, k).forEach(function(d){
          if(!d.sentAt) return;
          if(d.status === 'approved') return;
          (d.status === 'review' ? чекають : передані).push(d.who);
        });
      });
    });
    if(чекають.length) return 'чекає погодження · ' + nameOf(чекають[0]);
    if(передані.length) return 'у роботі · ' + nameOf(передані[0]);
    return 'ще не передано';
  }
  /* ДОШКА ДИЗАЙНЕРА ПОКАЗУЄ ЛИШЕ ПЕРЕДАНЕ.

     Доти сюди потрапляли всі замовлення відділу — і те, яке менеджер ще
     навіть не зібрав. Дизайнер бачив роботу, якої йому не давали, а
     менеджер не мав чим позначити «ось тепер бери». Тепер картка
     зʼявляється рівно від натискання «Відправити дизайнеру». */
  /* СКІЛЬКИ ГОДИН ДАЄМО НА МАКЕТ. Число з налаштувань; доба — домовленість,
     а не закон природи, і міняти її не має означати правку коду. */
  /* Строки етапів беремо в робочого місця — там вони й налаштовуються.
     Немає відповіді (стара збірка) — лишаємось без годинника, а не з
     вигаданим числом: годинник, який рахує невідомо від чого, гірший за
     його відсутність. */
  /* Той самий годинник, що на картці, але в шапці відкритої панелі. Один
     збирач на всі етапи: п'ять однакових шматків розмітки колись
     розійшлися б у дрібницях, і тоді «лишилось 5 год» у двох місцях
     означало б різне. */
  function clockHtml(min){
    if(min === null || min === undefined) return '';
    return '<span class="dz-duo dz-duo-t' +
      (min < 0 ? ' late' : min < 180 ? ' soon' : '') + '"><span>Строк</span><b>' +
      esc(min < 0 ? ('−' + U.hm(-min)) : U.hm(min)) + '</b></span>';
  }
  function termHours(kind){
    try{
      var t = (host().terms && host().terms()) || {};
      return +t[kind] || 0;
    }catch(e){ return 0; }
  }
  function dzHours(){
    try{ return (host().dzHours && host().dzHours()) || D.DZ_HOURS; }
    catch(e){ return D.DZ_HOURS; }
  }
  /* Скільки замовлень дизайнер зараз тримає в роботі: передані йому, ще
     не здані на перевірку й не затверджені. За цим числом і працює ліміт
     «одночасно в роботі» з налаштувань. */
  function busyOrders(m){
    if(!m) return 0;
    return U.pairs().filter(function(p){
      return U.unitsOf(p.job).some(function(u){
        return D.dzList(u, 'graphic').some(function(d){
          return d.who === m && d.sentAt &&
            (d.status === 'sent' || d.status === 'work' || d.status === 'revision');
        });
      });
    }).length;
  }
  /* Мої дизайни в цьому замовленні — рівно ті, що передані мені. */
  function myDz(job, kind, m){
    var out = [];
    U.unitsOf(job).forEach(function(u){
      D.dzList(u, kind).forEach(function(d){
        if(!d.sentAt) return;
        if(m && d.who && d.who !== m) return;
        out.push({ u: u, d: d });
      });
    });
    return out;
  }
  /* У ЯКІЙ КОЛОНЦІ СТОЇТЬ ЗАМОВЛЕННЯ В ДИЗАЙНЕРА.

     Раніше колонку давав `job.graphic.status` — один стан на все
     замовлення, який ніхто не рухав відколи робота пішла по дизайнах. Через
     це картка вічно висіла в «Нових», хоч версії вже здавались.

     Тепер колонку каже сама робота, і в найгіршому стані: якщо хоч десь
     лежить правка — це «Правки», бо саме за неї сідають першою. */
  var DZ_STEP = ['revision', 'queue', 'sent', 'work', 'review', 'approved'];
  function dzStep(list){
    var є = {};
    list.forEach(function(x){ є[D.dzInQueue(x.d) ? 'queue' : (x.d.status || 'sent')] = 1; });
    for(var i = 0; i < DZ_STEP.length; i++) if(є[DZ_STEP[i]]) return DZ_STEP[i];
    return 'sent';
  }
  var DZ_COL = { queue:'queue', sent:'new', work:'work', review:'review',
                 revision:'revision', approved:'done', 'new':'new' };
  function graphicCards(){
    var only = host().onlyMine && host().onlyMine();
    var m = (host().me && host().me()) || '';
    var год = dzHours();
    return U.pairs().map(function(p){
      var mine = myDz(p.job, 'graphic', only ? m : '');
      if(!mine.length) return null;
      var st = dzStep(mine);
      /* Строк — найгостріший із моїх: коли їх два, працюють по тому, що
         горить, а не по середньому. */
      var лишок = null;
      mine.forEach(function(x){
        var l = D.dzLeft(x.d, год);
        if(l === null) return;
        if(лишок === null || l < лишок) лишок = l;
      });
      var нових = mine.reduce(function(a, x){ return a + D.dzUnseen(x.d, m, 'graphic', 'graphic'); }, 0);
      var верс = mine.reduce(function(a, x){ return Math.max(a, x.d.vers.length); }, 0);
      return { id: p.o.orderId, step: DZ_COL[st] || 'new',
        title: U.jobNo(p.job),
        /* НІ ІМЕНІ КЛІЄНТА, НІ СУМИ, НІ РОЗМОВИ. Дизайнеру вони не
           потрібні для роботи, а бачити їх означає мати доступ до чужих
           грошей і чужого контакту без жодної на те причини. */
        sub: unitNames(p.job, p.o),
        left: лишок, unseen: нових,
        /* Правка — найгучніша позначка на дошці: за неї сідають першою. */
        fix: st === 'revision',
        foot: (верс ? 'v' + верс : 'версій ще немає') +
              (mine.length > 1 ? ' · нанесень ' + mine.length : '') };
    }).filter(Boolean);
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
    /* Окремого «Технічного завдання» тут більше немає. Воно писалось двічі:
       у власному блоці «що саме малюємо» і в коментарі до конкретного
       одягу. Два місця для того самого — це щоразу питання, котре з них
       правда; коментар лишається один і стоїть при виробі, якого
       стосується.

       «Повернути продажнику» пішло звідти ж: замовлення веде той самий
       менеджер, який його й зібрав, і повертати його нема кому. */
    /* «Видати доручення» звідси пішло. Робота приватного замовлення вже
       має адресата: дизайнер прикріплений на самому дизайні, і доручення
       поруч із ним було другим способом сказати те саме — з власним
       списком, власними причинами й власним строком. Два способи давати
       роботу означають, що половина її дається повз обидва. */
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
    /* Строк — у шапці, поруч із номером. Це рамка всього замовлення, і
       читати її треба до складу, а не після нього. */
    /* ══════════ КАРТКА ЗОНАМИ ══════════

       Доти все це йшло одним потоком: клієнт, склад, кнопки, версії,
       відправка, гроші — розділені однаковими сірими підписами. Читати
       таке можна тільки підряд, а питання до картки завжди точкові: «куди
       їде?», «скільки лишилось доплатити?», «кому передали спину?».

       Тепер це чотири зони свого кольору, і колір той самий, що у воронці.
       Порядок — робочий, а не формальний: спершу кому це (клієнт), потім
       що робимо (склад і дизайн), потім чи погоджено, далі гроші й
       наостанок куди їде. Саме в такому порядку картку й заповнюють. */
    /* СТАН — ТОЙ САМИЙ, ЩО Й КОЛОНКА ДОШКИ.

       У шапці стояло «Нові», хоча картка лежала в колонці «У вишивального
       дизайнера». Два різні слова про одне становище: одне рахувалось із
       внутрішнього стану задачі, друге — з воронки. Андрій: «статус
       повинен бути такий, як по факту у нас в назвах в канбані… ми
       повторяємо ці статуси».

       Тепер підпис береться звідти ж, звідки колонка, і стоїть ПІД
       номером: це не мітка збоку, а відповідь на питання «де воно зараз»,
       і читається вона разом із номером, а не між ним і строком. */
    var кол = D.chainAt(job, o);
    var крок = (D.CHAIN || []).filter(function(x){ return x.key === кол; })[0] || {};
    return '<div class="dz-panel-h">' +
        '<span class="dz-panel-id"><b>' + U.jobNo(p.job) + '</b>' +
          '<span class="dz-state"><i class="dz-dot is-' + esc(крок.color || 'gray') +
          '"></i>' + esc(крок.label || D.stateLine(job)) + '</span></span>' +
        clockHtml(D.stageLeft(job, o, 'acct', termHours('acct'))) +
        U.dueHtml(job) +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b is-zones">' +
        U.zoneHtml('blue', '👤', 'Клієнт', '',
          U.clientHtml(o, job) + U.taskBlockHtml(p, 'acct')) +
        /* Склад — одразу під клієнтом: це перше, що питають про
           замовлення, і перше, що заповнюють, коли його заводять. */
        U.zoneHtml('violet', '👕', 'Склад і дизайн', U.unitsSub(job),
          U.unitsHtml(job, { bare:true, o:o })) +
        /* ЗОНИ «ПОГОДЖЕННЯ» БІЛЬШЕ НЕМАЄ.

           Вона показувала старі версії `o.art` із позначками «погоджено
           клієнтом» — залишок B2B-течії, де макет жив окремо від нанесення.
           У приватному замовленні вона майже завжди порожня, а коли не
           порожня — переказує те, що тепер стоїть у колонці дизайну. Дві
           правди про одне погодження гірші за одну.

           Дії, які там жили (погодити версію, повернути на правку, показати
           клієнту), нікуди не поділись: вони при самій роботі, у колонці. */
        /* ГРОШІ Й ВІДПРАВКА — СКЛАДЕНІ.

           Розгортали їх заради того, щоб не ховати незаповнену адресу. Але
           за день у картку заходять по десять разів, і щоразу проминають
           два блоки, у яких сьогодні нічого не змінилось: гроші дивляться
           раз, коли прийшла оплата, адресу — раз, коли пакують. Підпис зони
           каже головне й складеною: скільки лишилось доплатити й чого
           бракує для накладної. */
        U.foldHtml('green', '₴', 'Гроші', U.moneySub(o, job), U.moneyBody(o, job)) +
        U.foldHtml('amber', '📦', 'Відправка', U.shipSub(o), U.shipBody(p)) +
        /* Історія — в самому низу. Її читають не щодня, але коли читають —
           читають усю, і місце їй саме там, де вона нікому не заважає. */
        U.foldHtml('gray', '🕘', 'Історія', U.histSub(job), U.histHtml(job)) +
      '</div>' +
      /* Написати клієнту — у ЗАФІКСОВАНІЙ нижній смужці, а не в потоці.
         У картці десяток блоків, і кнопка в кінці означає «догортайте до
         неї»; а потрібна вона рівно тоді, коли щось прочитали й хочуть
         відповісти — тобто будь-коли. */
      U.writeHtml(o);
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
  /* ══════════════════════════════════════════════════════════════════════
     ПАНЕЛЬ ДИЗАЙНЕРА

     Тут працює людина, яка малює, — і більше нічого про це замовлення не
     робить. Отже, у картці має лишитись рівно те, з чого малюють: що за
     виріб, якого кольору, скільки штук, що просив клієнт словами й
     картинками. І скільки часу лишилось.

     Чого тут НЕМАЄ і чому:

       • Клієнта. Ні імені, ні телефону, ні ніка, ні кнопки «Написати в
         Instagram». Дизайнеру вони не потрібні для роботи, а бачити їх
         означає мати доступ до чужого контакту без жодної причини — і
         рано чи пізно написати клієнту повз менеджера.

       • Суми. Те саме: за скільки продали, дизайнера не стосується, а
         велике число в картці непомітно міняє ставлення до роботи.

       • Дати здачі замовлення. Вона стоїть у менеджера, бо він її й
         обіцяє. Дизайнер бачить СВІЙ строк — годинник на добу, — бо «до
         14 жовтня» сьогодні не рухає нікого.

     Дві відповіді на передачу: «Беру» й «Не братиму». Друга однаково
     законна: завантажений або хворий дизайнер мусить повернути роботу
     ЗАРАЗ, а не за добу, коли строк уже вийшов і ніхто нічого не малював.
     ══════════════════════════════════════════════════════════════════════ */
  function dzLeftTxt(d){
    var l = D.dzLeft(d, dzHours());
    if(l === null) return '';
    return l < 0 ? ('прострочено на ' + U.hm(-l)) : ('лишилось ' + U.hm(l));
  }
  /* ══════════ ЗДАЧА: МАКЕТ → МОКАП → НАДІСЛАТИ ══════════

     Три кроки, і другий не можна пропустити. Андрій: «ми без мокапу не
     можемо відправити».

     Причина не в порядку заради порядку. Клієнту в Директ іде мокап, а не
     файл із логотипом на прозорому тлі: за самим файлом не видно ні
     розміру, ні місця, ні того, як воно виглядає на чорному. Доти мокап
     робили «якщо згадали», і половина макетів ішла клієнту голим файлом —
     після чого починалось листування замість погодження.

     Тому кнопка «Надіслати» зʼявляється тільки третьою. Перші дві не
     сховані й не сірі: людина бачить увесь шлях і те, на якому вона кроці. */
  /* ПРОСТО НАПИСАТИ МЕНЕДЖЕРУ — ОКРЕМО ВІД ЗДАЧІ Й У САМОМУ НИЗУ.

     Здати роботу й спитати «логотип білий чи молочний?» — не одне й те
     саме, і кнопка доти була одна, ще й вимагала мокапу: щоб поставити
     питання, дизайнер мусив або зробити мокап нізащо, або писати
     менеджеру повз систему — у Телеграм, звідки відповідь не
     повертається в замовлення й губиться назавжди.

     Поле лишилось, але переїхало вниз, до самої розмови. Доти воно
     стояло рівно між ТЗ і завантаженням файлу: дизайнер відкривав
     картку, щоб віддати роботу, і першим натикався на порожнє поле для
     листа. Андрій: «щоб воно не відволікало від ТЗшки і від
     завантаження». */
  function sayHtml(key){
    return '<div class="dz-w-say">' +
      '<textarea rows="2" data-dzsay="' + key + '" ' +
        'placeholder="Написати менеджеру — питання, уточнення, що завгодно"></textarea>' +
      '<div class="dz-w-row">' +
        '<button class="dz-b" data-do="dz-msg" data-dz="' + key + '">Надіслати</button>' +
        '<button class="dz-b dz-quiet" data-do="dz-msg-file" data-dz="' + key +
          '" title="Просто файл, без здачі версії">⤒ Файл</button>' +
      '</div>' +
    '</div>';
  }
  function handHtml(u, d, key){
    /* ОДНА КНОПКА ЗАМІСТЬ ТРЬОХ КРОКІВ.

       Андрій: «одна кнопка завантажити роботу у дизайнера, він завантажує
       роботу і вже в попапі це все він налаштовує».

       Кроки описували не роботу, а порядок натискань — і саме тому
       бентежили. Тепер натиск відкриває вікно, у якому й вантажать, і
       розкладають по сторонах, і віддають. */
    var сторін = 0;
    try{ сторін = ((host().sides && host().sides(u.gid, u.color)) || []).length; }catch(e){}
    return '<div class="dz-w-send">' +
      (сторін
        ? '<button class="dz-b pri wide" data-do="dz-work" data-dz="' + key + '">' +
          '⤒ Завантажити роботу</button>' +
          '<div class="dz-miss is-calm">Вікно відкриється одразу: там і файли, і ' +
          'розміщення на виробі, і сторони. Одна кнопка «Надіслати» на все.</div>'
        : '<div class="dz-miss">У цього виробу немає фото в каталозі — покласти ' +
          'роботу нема на що. Скажіть менеджеру: фото додають у каталог товарів.</div>') +
    '</div>';
  }
  function handHtmlOld(u, d, key){
    var чер = d.draft || {};
    var крок = !чер.art ? 1 : !чер.mock ? 2 : 3;
    var фото = U.unitPhoto(u);
    return '<div class="dz-w-send">' +
      /* ── Здача версії — окремим блоком, зі своїми трьома кроками ── */
      '<div class="dz-hand">' +
        /* Другого заголовка тут більше немає: зона вже підписана згори, і
           «Здати роботу» двічі підряд читається як два різні блоки. */
        '<div class="dz-steps">' +
          ['Макет', 'Мокап', 'Надіслати'].map(function(t, i){
            return '<i class="dz-step' + (крок > i + 1 ? ' done' : крок === i + 1 ? ' on' : '') +
              '">' + (i + 1) + '. ' + t + '</i>';
          }).join('') +
        '</div>' +
        (чер.art
          ? '<div class="dz-draft">' +
              '<img src="' + esc(чер.art.url) + '" alt="">' +
              (чер.mock ? '<img src="' + esc(чер.mock.png) + '" alt="">' : '') +
              '<div class="dz-draft-t">' +
                '<b>' + esc(чер.art.name || 'макет') + '</b>' +
                (чер.mock
                  ? '<span>' + esc(placeTxt(чер.mock)) + '</span>'
                  : '<span>мокапу ще немає</span>') +
              '</div>' +
              '<button class="dz-ib dz-ib-x" data-do="dz-art-del" data-dz="' + key +
                '" title="Прибрати й завантажити інший">🗑</button>' +
            '</div>'
          : '') +
        (крок === 1
          ? '<button class="dz-b pri wide" data-do="dz-art" data-dz="' + key + '">' +
            '⤒ Завантажити макет</button>'
          : крок === 2
          ? (фото
              ? '<button class="dz-b pri wide" data-do="dz-mock" data-dz="' + key + '">' +
                '◱ Створити мокап</button>'
              : '<div class="dz-miss">У цього виробу немає фото в каталозі — покласти ' +
                'макет нема на що. Скажіть менеджеру: фото додають у каталог товарів.</div>')
          : '<div class="dz-w-row">' +
              '<button class="dz-b" data-do="dz-mock" data-dz="' + key + '">◱ Переробити мокап</button>' +
              /* «Передати менеджеру · v2» — так цю дію й називають уголос.
                 «Здати · буде v2» описувало наслідок, а не дію, і слово
                 «буде» лишало сумнів, чи вже. */
              '<button class="dz-b pri" data-do="dz-hand" data-dz="' + key + '">' +
              'Передати менеджеру · v' + (d.vers.length + 1) + '</button>' +
            '</div>') +
        (крок < 3
          /* Пояснення коротке. Довге стояло тут з тих часів, коли здача без
             мокапу була звичною й треба було пояснити, чому її більше
             немає. Тепер кроки підписані самі, і чотири рядки сірого тексту
             під ними лише розганяють зону. */
          ? '<div class="dz-miss is-calm">Без мокапу здача не проходить: ' +
            'клієнту йде макет на виробі. Просто написати менеджеру можна ' +
            'нижче, у переписці.</div>'
          : '') +
      '</div>';
  }

  /* Розміщення одним рядком. Нулі означають, що виріб на фото не розмічений
     або в товару немає сітки, — і тоді краще сказати це, ніж показати
     «0 см», яке виглядає як виміряне. */
  function placeTxt(m){
    if(!m || !m.wCm) return 'розміщення не порахувалось';
    return 'ширина ' + мсм(m.wCm) + ' · від горловини ' + мсм(m.topCm) +
      (m.sideCm ? ' · від центру ' + (m.sideCm > 0 ? '+' : '−') + мсм(Math.abs(m.sideCm)) : '') +
      (m.size ? ' · на ' + m.size : '');
  }
  function dzWorkHtml(x, i){
    var u = x.u, d = x.d;
    var key = esc(u.id) + '|graphic|' + D.dzList(u, 'graphic').indexOf(d);
    var g = U.catItem(u.gid);
    var l = D.dzLeft(d, dzHours());
    var м = (host().me && host().me()) || '';
    var нових = D.dzUnseen(d, м, 'graphic', 'graphic');
    return '<div class="dz-w' + (d.status === 'revision' ? ' is-fix' : '') + '">' +
      '<div class="dz-w-h">' +
        '<b>' + esc((g && g.name) || u.name || 'Виріб') + '</b>' +
        (u.color ? '<span class="dz-w-c">' +
          (u.colorHex ? '<i class="dz-sw" style="background:' + esc(u.colorHex) + '"></i>' : '') +
          esc(u.color) + '</span>' : '') +
        (u.size ? '<span class="dz-w-c">' + esc(u.size) + '</span>' : '') +
        '<span class="dz-w-c">' + (+u.qty || 0) + ' шт</span>' +
        (нових ? '<button type="button" class="dz-unread" data-do="dz-seen" data-u="' + esc(u.id) +
          '" data-side="graphic" title="Пропущене від менеджера — позначити прочитаним">' + нових + '</button>' +
          '<button type="button" class="dz-eye" data-do="dz-seen" data-u="' + esc(u.id) +
          '" data-side="graphic" title="Позначити прочитаним" aria-label="Позначити прочитаним">\uD83D\uDC41</button>' : '') +
        (l === null ? '' : '<em class="dz-w-t' + (l < 0 ? ' late' : l < 180 ? ' soon' : '') +
          '">' + esc(dzLeftTxt(d)) + '</em>') +
      '</div>' +
      /* Правка стоїть НАД роботою, а не в кінці розмови: її й треба
         прочитати перш, ніж відкривати файл. */
      (d.status === 'revision'
        ? '<div class="dz-w-fix">Повернули на правку' +
          (нових ? ' · нового ' + нових : '') + '</div>' : '') +
      /* ТРИ НАЗВАНІ ЧАСТИНИ: ТЗ · ЗДАТИ РОБОТУ · РОЗМОВА.

         Андрій: «можна якось їх розділити, щоб ТЗшка була розділена з
         вікном спілкування з менеджером… і це вікно спілкування перенести
         в самий низ, щоб воно не відволікало від ТЗшки і від
         завантаження».

         Доти картка текла одним потоком, і поле «написати менеджеру»
         стояло рівно між тим, що треба прочитати, і тим, що треба
         зробити. Дизайнер відкривав картку, щоб завантажити файл, і
         першим натикався на порожнє поле для листа. */
      /* ТРИ ЗОНИ, А НЕ ТРИ ПІДПИСИ.

         Підпису з волосяною лінією виявилось мало: Андрій дивився на картку
         й не бачив поділу взагалі. І це не про смак — зони тут різні за
         суттю: перша тільки читається, друга тільки робиться, третя тільки
         говориться. Тому вони й виглядають як три окремі блоки зі своїм
         кольором — так само, як зони в картці менеджера, де це працює. */
      U.zoneHtml('blue', '\uD83D\uDCCB', 'ТЗ', '',
        (u.note ? '<div class="dz-w-note"><i>Що просить клієнт</i>' +
                  esc(u.note) + '</div>' : '') +
      /* Картинки зі СКАЧУВАННЯМ просто з мініатюри. Дизайнеру потрібен не
         перегляд, а файл у себе на машині: доти шлях до нього був
         «відкрити — правою кнопкою — зберегти як», тричі за кожен
         референс. */
      ((u.pics || []).length
        ? '<div class="dz-pics">' + u.pics.map(function(pp, k){
            return '<span class="dz-pic">' +
              '<button type="button" class="dz-pic-b" data-do="pic-open" ' +
                'data-url="' + esc(pp.url) + '" title="' + esc(pp.name || 'Подивитись') + '">' +
                '<img src="' + esc(pp.url) + '" alt="" loading="lazy">' +
              '</button>' +
              '<button type="button" class="dz-pic-dl" data-do="dz-dl" data-url="' +
                esc(pp.url) + '" data-name="' + esc(pp.name || ('референс-' + (k + 1))) +
                '" title="Скачати">⤓</button>' +
            '</span>';
          }).join('') + '</div>'
        : '<div class="dz-miss is-calm">Картинок до цього виробу не додали.</div>')) +
      /* ФОТО ВИРОБУ ЗВІДСИ ПІШЛО.

         Андрій: «фото виробу для мокапу не потрібно писати в ТЗшки».
         Він має рацію: дизайнер його не обирає й не качає — мокап бере
         знімок із каталогу сам, у тому кольорі, що стоїть у складі. Блок
         із кнопкою «скачати» пропонував зробити те, чого робити не
         треба, і займав місце рівно між ТЗ і роботою. Попередження «у
         цього виробу немає фото в каталозі» лишається там, де воно
         потрібне, — на кроці «Мокап». */
      /* ── ЗДАТИ РОБОТУ ── */
      U.zoneHtml('violet', '\u21E7', 'Здати роботу', '',
        (d.status === 'approved'
          ? '<div class="dz-ok">Затверджено · версія ' + ((d.ok && d.ok.ver) || '—') + '</div>'
          /* «Не братиму» звідси пішло: Андрій вирішив, що відмовитись від
             роботи дизайнер не може — забрати її в нього може тільки
             акаунт-менеджер. Лишилась одна дія. */
          : D.dzInQueue(d)
          ? '<div class="dz-w-take is-q">' +
              '<span class="dz-w-q">У черзі відділу — бере той, хто перший натисне</span>' +
              '<button class="dz-b pri" data-do="dz-take" data-dz="' + key + '">Беру в роботу</button>' +
            '</div>'
          : d.status === 'sent'
          ? '<div class="dz-w-take">' +
              '<button class="dz-b pri" data-do="dz-take" data-dz="' + key + '">Беру в роботу</button>' +
            '</div>'
          : handHtml(u, d, key))) +
      /* НАДІСЛАНІ ВЕРСІЇ — ОДРАЗУ ПІД ЗДАЧЕЮ.

         Андрій: «воно надіслалося, але воно повинно показуватись тут, у
         нього ця версія, яка була надіслана… бо ми надіслали, і тут не
         показується, що ми надіслали».

         Список версій був і доти, але стояв ВИЩЕ за здачу — тобто над
         кнопкою, яку щойно натиснули, — і не казав головного: що роботу
         віддано. Тепер він стоїть там, куди дивишся після натискання, і
         кожен рядок починається зі слова «надіслано» й часу. */
      /* ── ПЕРЕПИСКА — ОДИН ПОТІК І В САМОМУ НИЗУ ──

         Окремого списку версій тут більше немає. Здача — теж повідомлення,
         з превʼю й файлами: доти про одну розмову було три різні списки, і
         щоб зрозуміти, на чому зупинились, їх доводилось складати в голові
         за часом. */
      U.zoneHtml('green', '\uD83D\uDCAC', 'Переписка', '',
        U.dzChatHtml(u, 'graphic', d, D.dzList(u, 'graphic').indexOf(d), { ro:true, as:'graphic' }) +
        (d.status === 'approved' || d.status === 'sent' ? '' : sayHtml(key))) +
    '</div>';
  }
  function graphicPanel(p){
    var job = p.job, o = p.o;
    var only = host().onlyMine && host().onlyMine();
    var m = (host().me && host().me()) || '';
    var mine = myDz(job, 'graphic', only ? m : '');
    var st = dzStep(mine);
    var лишок = null;
    mine.forEach(function(x){
      var l = D.dzLeft(x.d, dzHours());
      if(l === null) return;
      if(лишок === null || l < лишок) лишок = l;
    });
    return '<div class="dz-panel-h">' + U.jobNo(job) +
        '<span class="dz-state">' + esc(D.stepLabel(D.GRAPHIC, DZ_COL[st] || 'new')) + '</span>' +
        (лишок === null ? '' :
          '<span class="dz-duo dz-duo-t' + (лишок < 0 ? ' late' : лишок < 180 ? ' soon' : '') +
          '"><span>Строк</span><b>' +
          esc(лишок < 0 ? ('−' + U.hm(-лишок)) : U.hm(лишок)) + '</b></span>') +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b is-zones">' +
        /* Дата, обіцяна клієнту, звідси пішла. Андрій: «у адмінці самого
           дизайнера не потрібно писати замовлення обіцяно до такого-то
           числа — у них просто повинен бути строк, коли їм потрібно здати».

           Він має рацію: у дизайнера свій годинник, і дві дати поруч —
           «здати за 8 годин» і «посилка 14 жовтня» — не доповнюють одна
           одну, а сперечаються. Друга щоразу виглядає як запас часу,
           якого немає. */
        U.taskBlockHtml(p, 'graphic') +
        (mine.length
          ? mine.map(dzWorkHtml).join('')
          : '<div class="dz-miss is-calm">Це замовлення вам не передавали.</div>') +
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
        (more ? '' : U.clientHtml(o, job) + U.taskBlockHtml(p, 'stitch') +
          /* Вишивальному — та сама рамка й той самий склад, що й графічному,
             тільки його половина дизайнів. Без цього він не бачив ні
             коментаря менеджера, ні картинок, ні терміну — і питав це
             голосом у того ж менеджера. */
          U.unitsHtml(job, { ro:true, only:'stitch' })) +
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
        '</span>' + clockHtml(D.stageLeft(job, o, 'prod', termHours('prod'))) +
        '<button class="dz-x" data-close>×</button></div>' +
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

  /* ПОШУК ПО ДОШЦІ. Номер, імʼя, нік або телефон — усе, чим замовлення
     називають уголос. Живе в памʼяті вкладки, не в базі: це те, що людина
     шукає зараз, а не властивість відділу. */
  function seekHtml(v){
    return '<label class="dz-seek"><i>⌕</i>' +
      '<input type="search" data-seek placeholder="Номер, імʼя, нік або телефон" ' +
        'value="' + esc(v || '') + '">' +
      (v ? '<button type="button" class="dz-seek-x" data-do="seek-off" ' +
           'title="Показати всі">×</button>' : '') +
    '</label>';
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
        left: D.stageLeft(p.job, p.o, 'prod', termHours('prod')),
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
        left: D.stageLeft(p.job, p.o, 'supply', termHours('supply')),
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

  /* ── АРКУШ ЗБИРАЄТЬСЯ САМ ────────────────────────────────────────────

     Версії, здані до появи аркуша, мають лише макет і мокап. Доти на них
     стояла кнопка «Зібрати аркуш» — тобто система бачила, чого бракує, і
     просила людину натиснути. Тепер збирає сама, щойно картку відкрили.

     Одна спроба на версію за сеанс: аркуш може не зібратись із поважної
     причини (немає фото виробу в каталозі), і тоді нескінченне
     перемальовування з новою спробою зʼїло б і мережу, і сторінку. Не
     вийшло — лишається мокап, як і доти, а причина видно в консолі. */
  var SHEET_TRY = {};
  function sheetAuto(root){
    var c = ctx();
    if(!c || !c.job) return;
    var треба = [];
    U.unitsOf(c.job).forEach(function(u){
      ['graphic', 'stitch'].forEach(function(kind){
        D.dzList(u, kind).forEach(function(d){
          var v = (d.vers || [])[(d.vers || []).length - 1];
          var vp = v && D.verParts(v);
          if(!v || vp.sheet) return;
          if(!vp.work.length || !vp.mock.length) return;
          var k = c.o.orderId + '|' + u.id + '|' + kind + '|' + v.n;
          if(SHEET_TRY[k]) return;
          SHEET_TRY[k] = 1;
          треба.push({ key: u.id + '|' + kind + '|' + D.dzList(u, kind).indexOf(d), v: v });
        });
      });
    });
    if(!треба.length) return;
    /* Збирач аркуша живе всередині `act` — разом із усім, що вміє писати в
       замовлення. Тож не тягнемо його сюди, а просимо ту саму дію, тільки
       мовчки: одна дорога до аркуша, а не дві, які колись розійдуться. */
    (async function(){
      for(var i = 0; i < треба.length; i++)
        await act('dz-sheet', root, { dz: треба[i].key, v: треба[i].v.n, quiet: 1 });
    })();
  }
  /* ── ГРАФІК ДИЗАЙНЕРА: МІСЯЦЬ ГАЛОЧКАМИ ──────────────────────────────

     Андрій: «нехай там стоїть графік… вони просто вставлять графік роботи
     свій, і на кожен місяць вони виставляли галочками, які вони працюють,
     і тоді в них не будуть рахувати ці дні».

     Сітка місяця, у якій день або робочий, або ні. Натиск перемикає.
     Зберігаємо ДНІ, ЯКІ НЕ ПРАЦЮЄМО: їх менше, і порожній графік чесно
     означає «працюю щодня», а не «не працюю ніколи».

     Дизайнер бачить свій; той, хто призначає роботу, — будь-чий, бо
     питання «кому віддати сьогодні» без цього не має відповіді. */
  var SHIFT = null;
  function shiftClose(){
    if(SHIFT && SHIFT.parentNode) SHIFT.parentNode.removeChild(SHIFT);
    SHIFT = null;
  }
  function shiftOff(who, iso){
    try{ return !!(host().dayOff && host().dayOff(who, iso)); }catch(e){ return false; }
  }
  function shiftPaint(root){
    if(!SHIFT) return;
    var y = SHIFT.__y, m = SHIFT.__m, who = SHIFT.__who;
    var перше = new Date(y, m, 1);
    var зсув = (перше.getDay() + 6) % 7;
    var днів = new Date(y, m + 1, 0).getDate();
    var сьогодні = U.calIso(new Date());
    var люди = [];
    try{ люди = (host().designers && host().designers()) || []; }catch(e){}
    var сітка = '';
    var i;
    for(i = 0; i < зсув; i++) сітка += '<span class="dz-sh-e"></span>';
    for(i = 1; i <= днів; i++){
      var iso = y + '-' + U.pad2(m + 1) + '-' + U.pad2(i);
      var off = shiftOff(who, iso);
      сітка += '<button type="button" class="dz-sh-d' + (off ? ' off' : '') +
        (iso === сьогодні ? ' today' : '') + '" data-sh-d="' + iso + '">' + i + '</button>';
    }
    SHIFT.innerHTML =
      '<div class="dz-sh-w">' +
        '<div class="dz-sh-h"><b>Графік роботи</b>' +
          '<button type="button" class="dz-x" data-sh-x>×</button></div>' +
        (люди.length > 1
          ? '<label class="dz-sh-who"><span>Чий</span><select data-sh-who>' +
            люди.map(function(p){
              return '<option value="' + esc(p.email) + '"' +
                (p.email === who ? ' selected' : '') + '>' + esc(p.name) + '</option>';
            }).join('') + '</select></label>'
          : '') +
        '<div class="dz-sh-nav">' +
          '<button type="button" class="dz-cal-a" data-sh-m="-1">‹</button>' +
          '<b>' + (U.CAL_M ? U.CAL_M[m] : (m + 1)) + ' ' + y + '</b>' +
          '<button type="button" class="dz-cal-a" data-sh-m="1">›</button>' +
        '</div>' +
        '<div class="dz-cal-w"><i>пн</i><i>вт</i><i>ср</i><i>чт</i><i>пт</i>' +
          '<i class="off">сб</i><i class="off">нд</i></div>' +
        '<div class="dz-sh-g">' + сітка + '</div>' +
        '<div class="dz-sh-n">Сірий день — вихідний: у нього годинник стоїть, ' +
          'і строк на макет не тікає. Натисніть, щоб перемкнути.</div>' +
      '</div>';
  }
  function shiftOpen(root, who){
    shiftClose();
    var el = document.createElement('div');
    /* `dz-pick` — це й є накладка: затемнення, фіксоване положення й
       центрування. Без неї вікно ставало звичайним блоком у кінці
       сторінки: воно відкривалось, але побачити його можна було лише
       догорнувши донизу. Зовні це виглядало як «кнопка не натискається». */
    el.className = 'dz-pick dz-fixw';
    var t = new Date();
    el.__y = t.getFullYear(); el.__m = t.getMonth(); el.__who = who;
    SHIFT = el;
    shiftPaint(root);
    document.body.appendChild(el);
    el.addEventListener('click', async function(e){
      var t2 = e.target.closest ? e.target : null;
      if(!t2) return;
      if(t2.closest('[data-sh-x]') || t2 === el) return shiftClose();
      var крок = t2.closest('[data-sh-m]');
      if(крок){
        var n = new Date(el.__y, el.__m + (+крок.getAttribute('data-sh-m') || 0), 1);
        el.__y = n.getFullYear(); el.__m = n.getMonth();
        return shiftPaint(root);
      }
      var день = t2.closest('[data-sh-d]');
      if(!день) return;
      var iso = день.getAttribute('data-sh-d');
      var було = shiftOff(el.__who, iso);
      try{ if(host().shiftSet) await host().shiftSet(el.__who, iso, !було); }
      catch(e2){ console.error('графік', e2); }
      shiftPaint(root);
      render(root);
    });
    el.addEventListener('change', function(e){
      var sel = e.target.closest ? e.target.closest('[data-sh-who]') : null;
      if(!sel) return;
      el.__who = sel.value;
      shiftPaint(root);
    });
  }
  /* ══════════ ЗБИРАННЯ ЕКРАНА ══════════ */
  function render(root){
    if(!root) return;
    /* ПРОКРУТКА ЛИШАЄТЬСЯ НА МІСЦІ.

       Андрій: «я натиснув гроші, оце що підкрилось — воно підпригнуло саме
       вверх, і мені треба скролити».

       Причина не у верстці. Будь-яка дія перемальовує панель цілком, а
       нова панель починається згори — і людину, яка щойно натиснула щось
       унизу картки, викидає на початок. Виглядає це так, ніби картка
       закрилась і відкрилась наново.

       Тому запамʼятовуємо, де стояли, і повертаємо туди ж. Саме панель, а
       не вікно: дошка ліворуч має свою прокрутку й своє життя. */
    var _p = root.querySelector('.dz-panel-b');
    var _top = _p ? _p.scrollTop : 0;
    var role = (U.host.role && U.host.role()) || '';
    var boss = U.isBoss(role);
    /* Перемикач ролей — тільки у власника. Співробітник заходить одразу у
       свою дошку: дай йому вибір — колись перемкнеться й пів дня
       працюватиме не на своєму екрані. */
    var seat = boss ? U.tab() : (U.roleSeat(role) || U.tab());
    if(!U.ROLES.some(function(r){ return r.key === seat; })) seat = boss ? 'acct' : 'graphic';
    if(seat !== U.tab()) U.setTab(seat);
    var b = boardOf(seat);
    /* Фільтр накладаємо тут, на готові картки: колонки лишаються на місці
       разом із лічильниками, просто в них видно те, що шукали. Прибирати
       порожні колонки не можна — дошка перестала б бути тією самою. */
    if(U.seek && U.seek()) b = { steps: b.steps, cards: b.cards.filter(U.seekHit) };
    var openId = U.tabOpen ? U.tabOpen() : '';
    var cur = U.ROLES.filter(function(r){ return r.key === seat; })[0] || U.ROLES[0];
    /* ШАПКА ВІДДІЛУ: дія ліворуч, пошук посередині, роль праворуч.

       Андрій: «додати нове замовлення присунути вліво… дивлюсь як
       акаунт-менеджер — правий верх, оце ж тільки для мене». Так воно й
       читається: ліворуч те, що тиснуть щодня, праворуч — перемикач, який
       узагалі є тільки у власника.

       Пошук між ними. Двадцять карток на дошці — і потрібну шукають очима
       по всіх колонках; а знають про неї рівно одне: номер, нік або імʼя,
       яким її назвав клієнт у розмові. */
    var шук = U.seek ? U.seek() : '';
    /* Графік показуємо ТІЛЬКИ на дизайнерських дошках — графічній і
       вишивальній. Андрій: «кнопка графік повинна бути тільки в графічного
       і вишивального дизайнера, всіх інших немає графіка».

       Власник теж його бачить — але тоді, коли дивиться їхньою дошкою, і
       там усередині обирає, чий саме графік. На своїй дошці кнопка йому ні
       до чого: строки акаунта, закупівлі й виробництва вихідних не мають,
       і графік там нічого не міняє. */
    var графік = (seat === 'graphic' || seat === 'stitch')
      ? '<button class="dz-b dz-shift" data-do="shift" title="Які дні працюємо — ' +
        'у вихідні годинник стоїть">🗓 Графік</button>' : '';
    var headHtml = boss
      ? '<button class="dz-b pri dz-new" data-do="order-new">+ Нове замовлення</button>' +
        seekHtml(шук) + графік +
        '<label class="dz-as"><span>Дивлюсь як</span>' +
          '<select class="dz-as-sel" data-seat>' + U.ROLES.map(function(r){
            return '<option value="' + r.key + '"' + (r.key === seat ? ' selected' : '') + '>' +
                   esc(r.label) + '</option>';
          }).join('') + '</select></label>'
      /* Співробітнику не пишемо, хто він. Дошка в нього одна, зайти на чужу
         він не може — і підпис «Моя дошка · Графічний дизайнер» просто
         повторював те, що він і так про себе знає. Андрій: «чому він тут
         бачить, що це є — графічний дизайнер він».

         А пошук йому потрібен так само: своїх карток теж буває багато. */
      : (seekHtml(шук) + графік);
    root.innerHTML =
      '<div class="dz-top">' + headHtml + '</div>' +
      '<div class="dz-wrap">' +
        '<div class="dz-boards">' + U.boardHtml(b.steps, b.cards) + '</div>' +
        '<aside class="dz-panel' + (openId ? '' : ' hide') + '" id="dzPanel">' +
          (openId ? panelFor(seat, openId) : '') + '</aside>' +
      '</div>';
    wire(root);
    /* Аркуш добирається сам, уже після того, як екран намальовано: спершу
       людина бачить картку, а збирання йде тихо позаду. */
    try{ sheetAuto(root); }catch(e){ console.warn('аркуш', e); }
    /* Дошка ширша за екран, коли поруч відкрита панель, — і активна картка
       опиняється за кадром. Виглядає це так, ніби вона зникла. Підкручуємо
       до неї: людина щойно її натиснула, вона має лишатись на видноті. */
    if(_top){
      var _p2 = root.querySelector('.dz-panel-b');
      if(_p2) _p2.scrollTop = _top;
    }
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
        clockHtml(D.stageLeft(p.job, o, 'supply', termHours('supply'))) +
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
  /* Дії назовні — щоб їх можна було перевірити повз інтерфейс. Половина
     заборон тут саме в дії, а не в кнопці: сховати кнопку легко, і тоді
     перевірка «без мокапу не відправимо» перевіряла б верстку, а не
     заборону. */
  window.LQDesign.ui.act = act;
  /* Завантаження файлу — і вікну правки теж: воно приймає картинку «ось так
     має бути», яку клієнт прислав у Директ. */
  window.LQDesign.ui.upload = upload;
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
    /* ПОШУК — НА КОЖНУ ЛІТЕРУ, І З КУРСОРОМ НА МІСЦІ.

       Дошка перемальовується цілком, а разом із нею й саме поле пошуку —
       тобто фокус із нього злітає, і друга літера йде в порожнечу.
       Повертаємо фокус і ставимо курсор у кінець: людина просто друкує
       далі й не помічає, що між літерами екран перебудувався. */
    var seekEl = root.querySelector('[data-seek]');
    if(seekEl){
      seekEl.oninput = function(){
        U.seekSet(seekEl.value);
        render(root);
        var n = root.querySelector('[data-seek]');
        if(n){ n.focus(); try{ n.setSelectionRange(n.value.length, n.value.length); }catch(e){} }
      };
    }
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
    root.querySelectorAll('[data-bind]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var v = String(el.value || '').trim();
        if(!v) return;
        el.disabled = true;
        Promise.resolve(host().bind ? host().bind(c.o, v) : false)
          .then(function(){ render(document.getElementById('dzRoot')); })
          .catch(function(e){ console.error(e); el.disabled = false; });
      };
    });
    root.querySelectorAll('[data-of]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c || !c.o) return;
        // Пишемо в САМЕ замовлення: своїх полів у напряму немає.
        c.o[el.dataset.of] = String(el.value || '').trim();
        save(c.job, c.o, '');
      };
    });
    /* Дані для накладної лежать разом, окремим полем замовлення: їх
       чотири, вони завжди потрібні гуртом, і розкладати їх по картці
       поштучно означало б збирати адресу по крихтах у мить відправки. */
    root.querySelectorAll('[data-sf]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c || !c.o) return;
        if(!c.o.ship || typeof c.o.ship !== 'object') c.o.ship = {};
        c.o.ship[el.dataset.sf] = String(el.value || '').trim();
        save(c.job, c.o, '');
      };
    });
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
    /* Поля самого замовлення — термін і коментар. Пишуться на задачу, а не
       на одиницю: вони про все замовлення разом. */
    /* Вибір дизайнера — і є дія. Окремої кнопки «прикріпити» немає
       навмисно: другий крок забувають, і на виробі лишається рядок без
       нікого. Цей самий список і замінює дизайнера: обрав іншого — він на
       місці попереднього. */
    root.querySelectorAll('[data-dzadd]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var who = String(el.value || '');
        if(!who) return;
        var pp = String(el.dataset.dzadd).split('|');
        var u = U.unitAt(c.job, pp[0]);
        var k = pp[1] === 'stitch' ? 'stitch' : 'graphic';
        if(!u) return;
        var d = D.dzNew();
        D.dzAttach(d, who, (host().me && host().me()) || '', U.whoName(who));
        D.dzList(u, k).push(d);
        /* Щойно доданий дизайн одразу розгорнутий: наступна дія — або
           дописати назву, або відправити ТЗ, і обидві всередині. */
        U.DZ_OPEN[pp[0] + '|' + k + '|' + (D.dzList(u, k).length - 1)] = 1;
        save(c.job, c.o, U.whoName(who) + ' · тепер можна відправити ТЗ');
      };
    });
    root.querySelectorAll('[data-dzwho]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var pp = String(el.dataset.dzwho).split('|');
        var u = U.unitAt(c.job, pp[0]);
        var k = pp[1] === 'stitch' ? 'stitch' : 'graphic';
        var d = u && D.dzAt(u, k, pp[2]);
        /* Рядок зʼявляється з ВИБОРУ, а не до нього. Колонка малює порожній
           рядок наперед, щоб було що заповнювати; у даних його ще немає — і
           заводимо ми його рівно тоді, коли людину обрали. Інакше в кожному
           виробі висіли б порожні дизайни, яких ніхто не замовляв. */
        if(!d && u && String(el.value || '')){
          d = D.dzNew();
          D.dzList(u, k).push(d);
        }
        if(!d) return;
        var who = String(el.value || '');
        var хтоЯ = (host().me && host().me()) || '';
        delete U.SWAP[String(el.dataset.dzwho)];
        /* Робота вже передана — це «забрати або віддати іншому»: з подією
           в розмові й новим відліком строку. */
        if(d.sentAt && who){
          var доЧерги = who === '@queue';
          if(!доЧерги && who === d.who) return render(root);
          D.dzRecall(d, хтоЯ, доЧерги ? '' : who, доЧерги ? U.whoName(d.who) : U.whoName(who));
          return save(c.job, c.o, доЧерги ? 'Повернуто в чергу відділу' : 'Передано · ' + U.whoName(who));
        }
        if(who === '@queue'){
          d.who = ''; d.pool = true;
          return save(c.job, c.o, 'Черга відділу');
        }
        if(!who){ d.who = ''; d.pool = false; return save(c.job, c.o, 'Дизайнера знято'); }
        d.pool = false;
        D.dzAttach(d, who, хтоЯ, U.whoName(who));
        save(c.job, c.o, U.whoName(who));
      };
    });
    root.querySelectorAll('[data-jf]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c) return;
        var f = el.dataset.jf;
        if(f !== 'due' && f !== 'note' && f !== 'days') return;
        if(f === 'days'){
          c.job.days = Math.max(0, Math.round(+el.value || 0)) || null;
          /* Змінили строк — дата обіцянки перерахувалась. Руками виправлену
             дату не чіпаємо: обіцянка належить менеджеру, а не формулі. */
          if(!c.job.dueSet) c.job.due = U.readyFrom(c.job);
        } else {
          c.job[f] = String(el.value || '').trim();
          if(f === 'due') c.job.dueSet = !!c.job.due;
        }
        save(c.job, c.o, '');
      };
    });
    /* Дата здачі — календарем. Кнопка сама відкриває місяць сіткою, і
       відповідь приходить назад одним значенням: жодного розбору тексту,
       жодних «31.02». */
    /* ПОЛЕ РОСТЕ ПІД ТЕКСТ.

       Коментар здебільшого короткий — «лого менше», — і два порожні рядки в
       кожній позиції це шість зайвих рядків у картці на три вироби. Але
       буває й абзац, і тоді поле на один рядок змушує читати текст у
       щілину. Хай росте: висота стає такою, скільки в ньому є. */
    root.querySelectorAll('[data-grow]').forEach(function(el){
      var рости = function(){
        el.style.height = 'auto';
        el.style.height = Math.min(220, el.scrollHeight) + 'px';
      };
      el.addEventListener('input', рости);
      рости();
    });
    root.querySelectorAll('[data-fold]').forEach(function(b){
      b.onclick = function(){
        var k = b.dataset.fold;
        if(U.FOLD[k]) delete U.FOLD[k]; else U.FOLD[k] = 1;
        render(root);
      };
    });
    root.querySelectorAll('[data-cal]').forEach(function(b){
      b.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        var c = ctx(); if(!c) return;
        U.calOpen(b, c.job.due || U.readyFrom(c.job), function(v){
          c.job.due = v || '';
          c.job.dueSet = !!v;
          /* ОБРАНА ДАТА ПЕРЕПИСУЄ ЧИСЛО ДНІВ.

             Доти в шапці лишалась заготовка: поле казало «9», кнопка —
             «20.10», і між ними було двадцять один день. Два числа поруч,
             які говорять різне, — це два числа, на які перестають
             дивитись; а перестають дивитись саме тоді, коли одне з них
             стає важливим.

             Тепер обрана дата — правда, а поле показує, у скільки днів
             вона вилилась. Прибрали дату (у календарі є «прибрати») —
             заготовка вмикається знову й рахує від неї. */
          if(v){
            var н = U.daysBetween(String(c.job.createdAt || '').slice(0, 10) ||
                                  U.calIso(new Date()), v);
            c.job.days = н > 0 ? н : null;
          } else c.job.days = null;
          save(c.job, c.o, v ? ('Готово ' + U.dueTxt(v)) : 'Дату прибрано');
        });
      };
    });
    /* Чим є цей платіж. Підпис — половина сенсу привʼязки: 3000 ₴ за новим
       замовленням і 3000 ₴ доплати за старим це різні речі, і без підпису
       сума лягає в картку без значення. */
    root.querySelectorAll('[data-payt]').forEach(function(el){
      el.onchange = function(){
        var c = ctx(); if(!c || !host().payTag) return;
        Promise.resolve(host().payTag(el.dataset.payt, el.value))
          .then(function(){ render(document.getElementById('dzRoot')); })
          .catch(function(e){ console.error(e); });
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
  async function pickFile(accept, many){
    return new Promise(function(res){
      var inp = document.createElement('input');
      inp.type = 'file';
      if(accept) inp.accept = accept;
      /* Картинок до замовлення кладуть жменю за раз: клієнт присилає п’ять
         референсів одним повідомленням. Вибирати їх по одному — це пʼять
         однакових діалогів і пʼять записів у базу замість одного. */
      if(many) inp.multiple = true;
      inp.onchange = function(){
        var l = Array.prototype.slice.call(inp.files || []);
        res(many ? l : l[0]);
      };
      inp.click();
    });
  }
  /* Кілька файлів у хмару підряд. Один не прийнявся — решта їде далі: у
     жмені референсів один зіпсований файл не привід загубити чотири. */
  async function uploadMany(accept){
    var list = await pickFile(accept, true);
    if(!list || !list.length) return [];
    say(list.length > 1 ? ('Завантажую ' + list.length + '…') : 'Завантажую…');
    var out = [];
    for(var i = 0; i < list.length; i++){
      try{
        var url = await host().upload(list[i]);
        if(url) out.push({ url: url, name: list[i].name });
      }catch(e){ console.warn('файл не прийнявся', e); }
    }
    if(out.length < list.length) say('Прийнялось ' + out.length + ' із ' + list.length);
    return out;
  }
  /* МОКАП ПРИХОДИТЬ КАРТИНКОЮ В ПАМʼЯТІ, А НЕ ФАЙЛОМ З ДИСКА.

     Класти його в картку як `data:` не можна: картка їде в базу, де на
     документ є ліміт, і один мокап зʼїв би його цілком. Тому переводимо в
     звичайний файл і кладемо в сховище тим самим шляхом, що й усе інше. */
  /* Відбиток вмісту файлу. За ним ми відрізняємо «намалював удруге» від
     «переклав готове»: той самий логотип приходить під трьома іменами, а
     байти в нього ті самі. Не вийшло порахувати (старий браузер, файл не
     прочитався) — повертаємо порожньо, і тоді робота вважається новою:
     переплатити чесніше, ніж недоплатити за здогадом. */
  async function fileHash(url){
    try{
      if(!window.crypto || !crypto.subtle) return '';
      var buf = await (await fetch(url)).arrayBuffer();
      var h = await crypto.subtle.digest('SHA-256', buf);
      return Array.prototype.map.call(new Uint8Array(h), function(b){
        return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 32);
    }catch(e){ console.warn('відбиток', e); return ''; }
  }
  async function uploadDataUrl(dataUrl, name){
    try{
      var blob = await (await fetch(dataUrl)).blob();
      try{ blob.name = name; }catch(e){}
      var f = (typeof File === 'function')
        ? new File([blob], name || 'file.png', { type: blob.type || 'image/png' })
        : blob;
      var url = await host().upload(f);
      return url ? { url: url, name: name || 'мокап.png' } : null;
    }catch(e){ console.error(e); return null; }
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

  /* ── ЩО ЦІЙ РОЛІ ДОЗВОЛЕНО ────────────────────────────────────────────
     Відділ довго був «або весь відкритий, або весь закритий»: хто бачить
     розділ, той і вантажить макети, і погоджує їх за клієнта, і збирає
     пакет у виробництво. Тепер кожна з цих робіт має власне право, а тут —
     єдине місце, де вони звіряються. Замок стоїть на самій дії, а не лише
     на кнопці: кнопку можна сховати, дію — ні. */
  var ACT_CAN = {
    'order-new':'new',
    'take':'art', 'start':'art', 'ver-new':'art', 'ver-file':'art',
    'ver-prev':'art', 'to-review':'art', 'u-add':'art', 'u-dup':'art',
    'u-del':'art', 'dz-add':'art', 'dz-del':'art',
    'brief-save':'art', 'brief-pic':'art', 'brief-pic-del':'art',
    'u-pick-gid':'art', 'u-pick-color':'art', 'u-pick-size':'art',
    'u-pic':'art', 'u-pic-del':'art', 'pic-open':'', 'dz-dl':'',
    /* Розмову по дизайну ведуть обидві сторони: менеджер пише правку,
       дизайнер відповідає й кладе версію. Тому тут не зона складу, а
       просто «хто у відділі» — інакше дизайнер не зміг би відповісти. */
    'dz-open':'', 'dz-say':'', 'dz-file':'', 'dz-ver':'',
    /* Взяти, відмовитись і здати роботу — дії ВИКОНАВЦЯ, не складу. Якби
       вони лежали під зоною «art», дизайнер не зміг би ні взяти те, що
       йому дали, ні повернути те, чого не потягне. */
    'dz-take':'', 'dz-no':'', 'dz-hand':'', 'dz-art':'', 'dz-art-del':'', 'dz-mock':'',
    'dz-msg':'', 'dz-msg-file':'', 'dz-swap':'', 'dz-reply':'art',
    'dz-tell-pick':'art', 'dz-ok-pick':'art',
    'dz-send':'art', 'dz-ok':'art', 'dz-unok':'art',
    'mgr-ok':'approve', 'revise':'approve', 'to-client':'approve',
    'cl-ok':'approve', 'cl-changes':'approve', 'brief-back':'approve',
    'assign':'approve', 'task-add':'approve',
    's-assign':'stitch', 's-file':'stitch', 's-prev':'stitch',
    's-save':'stitch', 's-test':'stitch', 's-done':'stitch',
    'qa-ok':'qc', 'qa-no':'qc', 'qa-save':'qc',
    'pack':'pack', 'ship':'pack',
    'unbind':'bind', 'bind':'bind'
  };
  var CAN_SAY = {
    art:'Вантажити макети', approve:'Погоджувати макет',
    stitch:'Оцифровувати вишивку', qc:'Закривати контроль файлів',
    pack:'Збирати пакет у виробництво', bind:'Привʼязувати розмови',
    new:'Створювати замовлення'
  };
  async function act(what, root, data){
    var need = ACT_CAN[what];
    if(need && !can(need))
      return say(CAN_SAY[need] + ' — не ваша зона');
    /* Нове замовлення заводять, коли на екрані ще нічого не відкрито, —
       тому воно йде ДО перевірки контексту. Створює його робоче місце: у
       відділу немає ні форми клієнта, ні нумерації, і заводити їх удруге
       означало б мати два різні «нові замовлення». */
    if(what === 'order-new'){
      if(host().newOrder) return host().newOrder();
      return say('Створення замовлення доступне з робочого місця');
    }
    /* Скидання пошуку теж іде ДО перевірки контексту: його тиснуть саме
       тоді, коли на дошці нічого не знайшлось, тобто коли відкривати нічого
       й не було. Поставлений нижче, він мовчки нічого не робив — і вийти з
       фільтра можна було лише стерши його руками. */
    /* Графік відкривається з дошки, де жодна картка ще не обрана, — тож
       іде ДО перевірки контексту, як і створення замовлення. */
    if(what === 'shift'){
      var хто = (host().me && host().me()) || '';
      if(U.isBoss((host().role && host().role()) || '')){
        var л = [];
        try{ л = (host().designers && host().designers()) || []; }catch(e){}
        if(л.length) хто = (л.filter(function(p){ return p.email === хто; })[0] || л[0]).email;
      }
      if(!хто) return say('Спершу зайдіть під своєю поштою');
      return shiftOpen(root, хто);
    }
    if(what === 'seek-off'){
      U.seekSet('');
      return render(root);
    }
    /* Розмова відкривається й з дошки, де картка ще не відкрита, — тож
       вона йде ДО перевірки контексту, як і створення замовлення. */
    if(what === 'chat' && data && data.id){
      var cp0 = U.pairs().filter(function(x){ return x.o.orderId === data.id; })[0];
      if(cp0 && host().chat) return host().chat(cp0.o);
      return say('Переписка недоступна');
    }
    var c = ctx();
    if(!c) return;
    var job = c.job, o = c.o, s = c.s, m = (host().me && host().me()) || '';

    /* ── Склад замовлення ── */
    if(what === 'ship'){
      if(host().ship) return host().ship(o);
      return say('Відправка доступна з картки замовлення');
    }
    if(what === 'chat'){
      /* Кнопка стоїть і на картці дошки, і в панелі. З дошки картка ще не
         відкрита, тож замовлення шукаємо за номером із самої кнопки. */
      var co = o;
      if(data && data.id){
        var cp = U.pairs().filter(function(x){ return x.o.orderId === data.id; })[0];
        if(cp) co = cp.o;
      }
      if(host().chat) return host().chat(co);
      return say('Переписка недоступна');
    }
    if(what === 'unbind'){
      if(host().unbind) host().unbind(o);
      return render(document.getElementById('dzRoot'));
    }
    /* ПЕРЕДОПЛАТУ ОБИРАЮТЬ, А НЕ ПИШУТЬ.

       Список — це надходження, які вже лежать у Фінансах і ще нікуди не
       привʼязані. Менеджер бачить суму, дату, рахунок і призначення платежу
       й обирає своє; сума в картці стає наслідком того, що справді прийшло
       на рахунок, а не того, що згадали. */
    if(what === 'pay-pick'){
      var w = host().payments && host().payments(o);
      var вільні = (w && w.free) || [];
      if(!вільні.length)
        return say('Непривʼязаних надходжень немає — подивіться в Фінансах');
      return U.pickOpen('Який платіж за цим замовленням',
        'Тільки ті надходження, що ще нікуди не привʼязані',
        вільні.map(function(p){
          return '<button type="button" class="dz-pick-c is-pay" data-pick="' +
            esc(p.id) + '">' +
            '<span class="dz-pick-n"><b>' + esc(money(p.amount)) + '</b>' +
              '<i>' + esc(p.at || '') + (p.acc ? ' · ' + esc(p.acc) : '') + '</i>' +
              (p.desc ? '<i>' + esc(p.desc) + '</i>' : '') +
            '</span></button>';
        }).join(''),
        function(id){
          if(!host().payLink) return say('Привʼязка платежів недоступна');
          Promise.resolve(host().payLink(o, id))
            .then(function(){ render(document.getElementById('dzRoot')); })
            .catch(function(e){ console.error(e); say('Привʼязати не вдалось'); });
        });
    }
    if(what === 'pay-off'){
      if(!host().payUnlink) return say('Відвʼязка платежів недоступна');
      return Promise.resolve(host().payUnlink((data && data.p) || ''))
        .then(function(){ render(document.getElementById('dzRoot')); })
        .catch(function(e){ console.error(e); say('Відвʼязати не вдалось'); });
    }
    /* Перемкнути половину: відкрита стає смужкою, смужка — відкритою.
       Нічого не зберігаємо — це спосіб читання, а не подія в замовленні. */
    /* Прочитали пропущене в зоні: гасимо рівно те, на що натиснули. */
    if(what === 'dz-seen'){
      var ру = asRole(), зміни = 0;
      var cu = data && data.u ? U.unitAt(job, data.u) : null;
      var ks = data && data.side ? [data.side === 'stitch' ? 'stitch' : 'graphic'] : ['graphic', 'stitch'];
      (cu ? [cu] : U.unitsOf(job)).forEach(function(uu){
        ks.forEach(function(k){
          D.dzList(uu, k).forEach(function(d){
            if(ру !== 'acct' && d.who && d.who !== m) return;
            if(D.dzUnseen(d, m, ру, k)){ D.dzSeen(d, m, ру); зміни++; }
          });
        });
      });
      return зміни ? save(job, o, '') : render(root);
    }
    if(what === 'u-side'){
      var su = String((data && data.u) || '');
      if(!su) return;
      U.SIDE[su] = (data && data.side) === 'stitch' ? 'stitch' : 'graphic';
      return render(root);
    }
    if(what === 'u-add'){
      job.units = U.unitsOf(job).concat([U.unitNew()]);
      return save(job, o, 'Додано одиницю');
    }
    if(what === 'u-dup'){
      var src = U.unitAt(job, data && data.u);
      if(!src) return;
      /* Копія бере ВИРІБ, а не роботу. Доти вона тягла й списки дизайнів —
         і в новій позиції вже стояв призначений дизайнер, якого туди ніхто
         не призначав, ще й без можливості обрати іншого. Андрій: «два рази
         дизайнер вставився… я не призначав який саме».

         Дизайн — не властивість виробу. Це окреме призначення, окрема
         передача й окрема історія версій; копіювати його означає віддати
         новій позиції чужу зроблену роботу. Найчастіша дія тут — «те саме,
         але беж», і саме «те саме» — це виріб, колір, розмір, кількість,
         коментар і картинки. */
      var cp = JSON.parse(JSON.stringify(src));
      cp.id = U.unitNew().id;
      cp.graphic = []; cp.stitch = [];
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
    /* Вибір із каталогу. Вікно відкриває модуль, а записуємо ми вже
       відповідь — тому дія не зберігає нічого сама, а чекає на вибір. */
    if(what === 'u-pick-gid' || what === 'u-pick-color' || what === 'u-pick-size'){
      var pu = U.unitAt(job, data && data.u);
      if(!pu) return;
      if(what === 'u-pick-gid') return U.pickGarment(pu.gid, function(gid){
        if(pu.gid === gid) return;
        pu.gid = gid;
        var pg = U.catItem(gid);
        pu.name = pg ? pg.name : '';
        /* Виріб інший — колір і розмір від старого тут ні до чого: у нового
           вони свої, і лишити чужі означає везти у виробництво колір, якого
           в цього виробу немає. */
        pu.color = ''; pu.colorHex = ''; pu.size = '';
        save(job, o, pu.name || 'Виріб обрано');
      });
      if(what === 'u-pick-color') return U.pickColor(pu.gid, function(cid){
        var pg = U.catItem(pu.gid);
        var c0 = ((pg && pg.colors) || []).filter(function(c){ return c.id === cid; })[0];
        pu.color = c0 ? (c0.name || c0.id) : '';
        pu.colorHex = c0 ? (c0.hex || '') : '';
        save(job, o, pu.color || 'Колір знімемо, коли буде відомий');
      });
      return U.pickSize(pu.gid, function(sz){
        pu.size = String(sz || '');
        save(job, o, pu.size || 'Розмір знімемо, коли буде відомий');
      });
    }
    /* ══════════ СКАЧАТИ ФАЙЛ ══════════

       Тут була тиха поломка, яку легко не помітити: посилання з атрибутом
       `download` СКАЧУЄ ТІЛЬКИ СВІЙ ДОМЕН. Наші фото й макети лежать у
       Cloudinary, тобто на чужому, — і браузер атрибут мовчки ігнорує й
       просто відкриває картинку у вкладці. Ніякої помилки, ніякого
       повідомлення: людина тисне «Скачати», бачить картинку й не розуміє,
       чому файлу немає. Андрій: «тут справа є можливість качати, але вона
       чомусь не качається».

       Тому забираємо файл самі й віддаємо його вже як свій. Cloudinary
       дозволяє це читати (CORS відкритий), і саме так адмінка вже збирає
       архів макетів — інакше ця сама стіна впиралась би і там.

       Не вийшло — кажемо ЧОМУ і відкриваємо у вкладці: краще ручне
       «зберегти як», ніж кнопка, що мовчки нічого не робить. */
    if(what === 'dz-dl'){
      var dlUrl = String((data && data.url) || '');
      if(!dlUrl) return say('Файлу немає');
      say('Завантажую…');
      try{
        var r = await fetch(dlUrl, { mode:'cors', credentials:'omit' });
        if(!r.ok) throw new Error('HTTP ' + r.status);
        var blob = await r.blob();
        /* Розширення беремо з адреси: без нього Windows не знає, чим
           відкривати, і файл лягає «без типу». */
        var ext = (/\.(png|jpe?g|webp|svg|pdf|ai|eps|zip|dst|pes)(?:$|[?#])/i.exec(dlUrl) || [])[1];
        /* Адреса не завжди має розширення: Cloudinary віддає перетворені
           картинки без нього взагалі. Тоді питаємо сам файл — він знає
           свій тип, і це надійніше за здогад з адреси. */
        if(!ext){
          var mt = String(blob.type || '').split(';')[0];
          ext = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp',
                  'image/svg+xml':'svg', 'application/pdf':'pdf',
                  'application/zip':'zip' }[mt] || '';
        }
        var nm = String((data && data.name) || 'файл').replace(/[\\/:*?"<>|]+/g, '-');
        if(ext && nm.toLowerCase().indexOf('.' + ext.toLowerCase()) < 0) nm += '.' + ext.toLowerCase();
        var ou = URL.createObjectURL(blob);
        var la = document.createElement('a');
        la.href = ou; la.download = nm;
        document.body.appendChild(la); la.click(); la.remove();
        /* Відкликаємо не одразу: Safari встигає почати завантаження не
           раніше наступного такту, і миттєве звільнення ламало його. */
        setTimeout(function(){ URL.revokeObjectURL(ou); }, 4000);
        return say('Збережено · ' + nm);
      }catch(e){
        console.error('скачування', e);
        try{ window.open(dlUrl, '_blank', 'noopener'); }catch(e2){}
        return say('Файл не віддався напряму — відкрив у вкладці, збережіть звідти');
      }
    }
    /* Подивитись картинку на весь екран. Вікно, а не нова вкладка: людина
       лишається в картці, і закриття повертає її рівно туди, де була. */
    if(what === 'pic-open'){
      U.picOpen(data && data.url);
      return;
    }
    if(what === 'u-pic'){
      var upu = U.unitAt(job, data && data.u);
      if(!upu) return;
      var upl = await uploadMany('image/*');
      if(!upl.length) return;
      var взято = 0;
      upl.forEach(function(f){ if(D.unitPic(upu, f)) взято++; });
      if(!взято) return say('Картинок уже досить');
      return save(job, o, взято > 1 ? ('Додано ' + взято) : 'Картинку додано');
    }
    if(what === 'u-pic-del'){
      var dpu = U.unitAt(job, data && data.u);
      if(!dpu) return;
      D.unitPicDel(dpu, +(data && data.i) || 0);
      return save(job, o, 'Картинку прибрано');
    }
    if(what === 'dz-add' || what === 'dz-del'){
      var pp = String((data && data.dz) || '').split('|');
      var un = U.unitAt(job, pp[0]);
      var kk = pp[1] === 'stitch' ? 'stitch' : 'graphic';
      if(!un) return;
      if(!Array.isArray(un[kk])) un[kk] = [];
      if(what === 'dz-add') un[kk].push(D.dzNew());
      else un[kk].splice(+pp[2], 1);
      return save(job, o, what === 'dz-add' ? 'Нанесення додано' : 'Прибрано');
    }
    /* ── Один дизайн: розмова, версії, передача ── */
    if(what === 'dz-open' || what === 'dz-send' || what === 'dz-ver' ||
       what === 'dz-file' || what === 'dz-say' || what === 'dz-ok' || what === 'dz-unok' ||
       what === 'dz-take' || what === 'dz-no' || what === 'dz-hand' ||
       what === 'dz-art' || what === 'dz-art-del' || what === 'dz-mock' ||
       what === 'dz-card' || what === 'dz-tell' || what === 'dz-fix' ||
       what === 'dz-sheet' || what === 'dz-tail' || what === 'dz-note' ||
       what === 'dz-work' ||
       what === 'dz-msg' || what === 'dz-msg-file' ||
       what === 'dz-swap' || what === 'dz-reply' ||
       what === 'dz-tell-pick' || what === 'dz-ok-pick'){
      var dp = String((data && data.dz) || '').split('|');
      var du = U.unitAt(job, dp[0]);
      var dk = dp[1] === 'stitch' ? 'stitch' : 'graphic';
      var dd = du && D.dzAt(du, dk, dp[2]);
      if(!dd) return;
      var dkey = dp[0] + '|' + dk + '|' + dp[2];
      /* Розгорнути стрічку цілком. Нічого не зберігаємо: це спосіб
         читання, а не подія в замовленні. */
      if(what === 'dz-tail'){
        if(U.TAIL_ALL[dkey]) delete U.TAIL_ALL[dkey];
        else U.TAIL_ALL[dkey] = 1;
        return render(root);
      }
      if(what === 'dz-open'){
        /* Розгорнули — отже прочитали: тримати непрочитане після того, як
           людина дивиться просто на нього, означає брехати лічильником. */
        if(U.DZ_OPEN[dkey]){ delete U.DZ_OPEN[dkey]; return render(root); }
        U.DZ_OPEN[dkey] = 1;
        if(D.dzUnseen(dd, m, asRole(), dk)){ D.dzSeen(dd, m, asRole()); return save(job, o, ''); }
        return render(root);
      }
      if(what === 'dz-send' && dd.pool && !dd.who){
        if(!du.gid) return say('Оберіть виріб — без нього ТЗ порожнє');
        D.dzQueue(dd, m);
        return save(job, o, 'Передано у відділ — чекає, хто візьме');
      }
      if(what === 'dz-send'){
        if(!dd.who) return say('Спершу прикріпіть дизайнера');
        if(!du.gid) return say('Оберіть виріб — без нього ТЗ порожнє');
        if(dk === 'stitch' && !D.graphicOk(du))
          return say('Спершу затвердіть графіку цього виробу');
        D.dzSend(dd, m);
        return save(job, o, 'ТЗ відправлено · ' + U.whoName(dd.who));
      }
      /* ПРОСТО НАПИСАТИ — БЕЗ ФАЙЛУ Й БЕЗ МОКАПУ.

         Питання «логотип білий чи молочний?» — це не здача роботи. Доти
         єдина кнопка вимагала мокапу, і щоб спитати, дизайнер мусив або
         зробити мокап нізащо, або писати менеджеру в Телеграм — звідки
         відповідь не повертається в замовлення й губиться назавжди.

         Репліка дизайнера НЕ кидає дизайн у «правки»: це його слово, а не
         повернення роботи. Саме на цьому воно й плуталось. */
      if(what === 'dz-msg' || what === 'dz-msg-file'){
        var mEl = document.querySelector('[data-dzsay="' + dkey + '"]');
        var mTxt = mEl ? String(mEl.value || '').trim() : '';
        var mF = null;
        if(what === 'dz-msg-file'){
          mF = await upload('');
          if(!mF) return;
        }
        if(!mTxt && !mF) return say('Напишіть щось або прикріпіть файл');
        /* Слово дизайнера — не правка: стан роботи й строк воно не міняє. */
        D.dzNote(dd, m, mTxt, mF, dk);
        D.dzSeen(dd, m, dk);
        if(mEl) mEl.value = '';
        return save(job, o, 'Надіслано');
      }
      /* ЗАМІНА ДИЗАЙНЕРА — ПОКИ ЗАГЛУШКА, І СКАЗАНО ЧЕСНО.

         Зняти людину з роботи, яку вона вже почала, — не перемикання поля:
         треба вирішити, що робити з її версіями, чи писати їй, чи лічити це
         відмовою. Поки цього рішення немає, кнопка стоїть на місці (щоб
         потім не переставляти) і чесно каже, що функції немає. Мовчазна
         кнопка була б гіршою за її відсутність. */
      /* ЗАБРАТИ АБО ВІДДАТИ ІНШОМУ — ТІЛЬКИ АКАУНТ-МЕНЕДЖЕР.

         ✎ біля імені відкриває той самий список, що й при першому виборі,
         з «Чергою відділу» зверху. Обрав — і робота вже в іншого (або
         знову в черзі), з подією в розмові. */
      if(what === 'dz-swap'){
        if(U.SWAP[dkey]) delete U.SWAP[dkey]; else U.SWAP[dkey] = 1;
        return render(root);
      }
      /* Відповідь менеджера на питання дизайнера. Стан роботи від неї не
         міняється: це слово, а не повернення на правку. */
      if(what === 'dz-reply'){
        var rEl = document.querySelector('[data-dzsay="' + dkey + '"]');
        var rTxt = rEl ? String(rEl.value || '').trim() : '';
        if(!rTxt) return say('Напишіть відповідь');
        D.dzSay(dd, m, rTxt, null, 'acct');
        /* Питання відпрацьоване — знімаємо з нього «непрочитане», інакше
           воно висітиме в колонці й після відповіді. */
        D.dzSeen(dd, m, 'acct');
        if(rEl) rEl.value = '';
        return save(job, o, 'Відповідь надіслано');
      }
      /* ── Дві відповіді дизайнера на передачу ──
         «Беру» вмикає роботу; «Не братиму» повертає рядок менеджеру
         порожнім, із причиною в розмові. Друга однаково законна: людина
         буває завантажена або хвора, і мовчазне «висить добу» коштує
         дорожче за чесне «віддайте іншому». */
      if(what === 'dz-take'){
        if(D.dzInQueue(dd) || (dd.pool && dd.who && dd.who !== m)){
          var ліміт = +((host().dzLimit && host().dzLimit()) || 0);
          var тримаю = busyOrders(m);
          if(ліміт > 0 && тримаю >= ліміт && D.dzInQueue(dd))
            return say('У вас уже ' + тримаю + ' в роботі (можна ' + ліміт +
                       ') — здайте щось на перевірку, щоб узяти нове');
          var взяв = D.dzClaim(dd, m);
          if(взяв && взяв.taken){ render(root); return say('Уже взяв(ла) ' + U.whoName(взяв.taken)); }
          if(!взяв) return;
          return save(job, o, 'Взяли з черги в роботу');
        }
        D.dzTake(dd, m);
        return save(job, o, 'Взяли в роботу');
      }
      if(what === 'dz-no'){
        var чому = '';
        try{ чому = window.prompt('Чому не берете? Менеджеру треба знати, ' +
              'кому віддати замість вас.') || ''; }catch(e){}
        /* Порожня причина — це відмова без відповіді, і менеджер лишається
           з тим самим питанням. Тому питаємо один раз і чекаємо слова. */
        if(!String(чому).trim()) return say('Без причини не повертаємо — напишіть рядок');
        D.dzDecline(dd, m, String(чому).trim());
        return save(job, o, 'Повернули менеджеру');
      }
      /* ЗДАТИ РОБОТУ — ОДНІЄЮ ДІЄЮ.

         Доти це були дві кнопки: «Додати файл» і «Віддати на перевірку», —
         і половина макетів висіла прикріпленою, але не зданою: дизайнер
         вважав, що віддав, менеджер не бачив нічого. Тепер файл і є
         здача, а коментар їде разом із ним. */
      /* ── Здача: макет → мокап → надіслати ── */
      if(what === 'dz-art'){
        var af = await upload('image/*');
        if(!af) return;
        dd.draft = { art: { name:String(af.name || ''), url:String(af.url) } };
        return save(job, o, 'Макет завантажено — тепер мокап');
      }
      if(what === 'dz-art-del'){
        dd.draft = null;
        return save(job, o, 'Прибрано');
      }
      /* ЗДАЧА ОДНИМ ВІКНОМ.

         Вантажимо файл одразу у сховище — вікно тримає посилання, а не
         байти: закрили випадково, повернулись — роботи на місці. Відбиток
         вмісту рахуємо тут же: за ним ми потім відрізняємо «намалював
         удруге» від «переклав готове», а за назвою це не відрізнити —
         «logo.png» називається так у половини клієнтів. */
      if(what === 'dz-work'){
        if(!window.LQMock || !window.LQMock.openWork)
          return say('Вікно здачі не завантажилось');
        var сторони = [];
        try{ сторони = (host().sides && host().sides(du.gid, du.color)) || []; }catch(e){}
        if(!сторони.length) return say('У цього виробу немає фото в каталозі');
        var чер3 = dd.draft || {};
        return window.LQMock.openWork({
          gid: du.gid, size: du.size || '', color: du.color || '',
          name: [(U.catItem(du.gid) || {}).name || du.name, du.color, du.size]
                  .filter(Boolean).join(' · '),
          sides: сторони,
          works: чер3.works || [],
          places: чер3.places || [],
          onUpload: async function(){
            var f = await upload('image/*');
            if(!f) return null;
            f.hash = await fileHash(f.url);
            return f;
          },
          onDone: async function(res){
            say('Збираю мокапи…');
            /* Мокапи зібрались у браузері як data:URL. Класти їх у картку
               такими не можна: картка їде в базу, а там ліміт на документ. */
            var файли = [];
            var місця = [];
            for(var i = 0; i < res.sides.length; i++){
              var s = res.sides[i];
              var up = await uploadDataUrl(s.png, 'мокап-' + s.side + '.png');
              if(!up || !up.url) return say('Мокап не зберігся у сховищі');
              файли.push({ name: s.label + '.png', url: up.url, role:'mock' });
              s.places.forEach(function(p){
                місця.push({ side:s.side, label:s.label, name:p.name,
                             wCm:p.wCm, hCm:p.hCm, topCm:p.topCm, sideCm:p.sideCm }); });
            }
            /* Робота з прибраним фоном зібралась у браузері як data-URL —
               кладемо в сховище, як і мокапи. Особа роботи (хеш) лишається
               від вихідного файлу: це той самий дизайн, лише без тла. */
            for(var wi = 0; wi < (res.works || []).length; wi++){
              var ww = res.works[wi];
              if(!/^data:/i.test(String(ww.url || ''))) continue;
              var wu = await uploadDataUrl(ww.url, (ww.name || 'робота').replace(/\.\w+$/, '') + '-без-фону.png');
              if(!wu || !wu.url) return say('Робота без фону не зберіглась у сховищі');
              ww.url = wu.url;
            }
            /* Самі роботи теж кладемо у версію: вишивальному дизайнеру
               потрібні вони, а не мокап, і клієнту йде аркуш. */
            (res.works || []).forEach(function(w){
              файли.push({ name: w.name || 'робота', url: w.url, hash: w.hash || '', role:'work' }); });
            var hEl2 = document.querySelector('[data-dzsay="' + dkey + '"]');
            var hTxt2 = hEl2 ? String(hEl2.value || '').trim() : '';
            D.dzVer(dd, m, файли, hTxt2, {
              works: (res.works || []).map(function(w){
                return { name:w.name || '', url:w.url, hash:w.hash || '' }; }),
              spots: місця, нанесень: res.нанесень, робіт: res.робіт,
              size: res.size || du.size || '',
              /* Перше нанесення — те, що показують у рядку під версією:
                 одне число «на дизайн» тут неможливе, бо їх кілька. */
              wCm: (місця[0] || {}).wCm || 0, hCm: (місця[0] || {}).hCm || 0,
              topCm: (місця[0] || {}).topCm || 0, sideCm: (місця[0] || {}).sideCm || 0
            }, dk);
            dd.status = 'review';
            dd.draft = null;
            if(hEl2) hEl2.value = '';
            await save(job, o, 'Надіслано · ' + res.нанесень + ' нанесень');
          }
        });
      }
      if(what === 'dz-mock'){
        if(!window.LQMock) return say('Вікно мокапу не завантажилось');
        var чер = dd.draft || {};
        if(!чер.art) return say('Спершу завантажте макет');
        var фото = U.unitPhoto(du);
        if(!фото) return say('У цього виробу немає фото в каталозі');
        var g0 = U.catItem(du.gid);
        return window.LQMock.open({
          base: фото, art: чер.art.url, gid: du.gid, size: du.size || '',
          name: [(g0 && g0.name) || du.name, du.color, du.size].filter(Boolean).join(' · '),
          box: (чер.mock && чер.mock.box) || null,
          onDone: async function(res){
            /* Мокап зібрався в браузері як data:URL. Класти його в картку
               таким не можна: картка їде в базу, а там ліміт на документ, і
               один мокап зʼїв би його цілком. Тому — у сховище, як усі
               інші файли. */
            var up = await uploadDataUrl(res.png, 'мокап.png');
            if(!up || !up.url) return say('Мокап не зберігся у сховищі');
            dd.draft = dd.draft || {};
            dd.draft.mock = { png: up.url, box: res.box, size: res.size,
                              wCm: res.wCm, hCm: res.hCm,
                              topCm: res.topCm, sideCm: res.sideCm };
            save(job, o, 'Мокап готовий' +
              (res.wCm ? ' · ширина ' + res.wCm + ' см' : ''));
          }
        });
      }
      if(what === 'dz-hand'){
        var чер2 = dd.draft || {};
        if(!чер2.art) return say('Спершу завантажте макет');
        /* Аркуш збирається ТУТ, у мить здачі, і лягає у версію третім
           файлом. Доти його малювали лише на вимогу, при скачуванні, — і
           побачити те, що поїде клієнту, можна було тільки завантаживши
           файл. Тобто перевірка починалась із походу в теку «Завантаження».

           Малюємо його від імені дизайнера, бо саме його робота в ньому й
           зафіксована; менеджер потім качає вже готовий. */
        /* БЕЗ МОКАПУ НЕ НАДСИЛАЄМО. Це не формальність: клієнту йде макет на
           виробі, а не файл на прозорому тлі — за ним не видно ні розміру,
           ні місця, і замість погодження починається листування. */
        if(!чер2.mock) return say('Без мокапу не надсилаємо — зробіть його');
        var hEl = document.querySelector('[data-dzsay="' + dkey + '"]');
        var hTxt = hEl ? String(hEl.value || '').trim() : '';
        var файли = [Object.assign({}, чер2.art, { role:'work' }),
                     { name:'мокап.png', url: чер2.mock.png, role:'mock' }];
        say('Збираю аркуш…');
        var аркушФайл = await sheetFile(job, o, du, чер2, dd.vers.length + 1);
        /* АРКУШ НЕ ЗІБРАВСЯ — ПРО ЦЕ ТРЕБА СКАЗАТИ.
           Доти збій тут мовчав: версія лягала з двома файлами замість трьох,
           у картці менеджер бачив мокап і вважав, що це і є аркуш, а клієнту
           їхав мокап без контактів і без примітки про колір. Мовчазна
           підміна гірша за відмову: її помічають уже з боку клієнта. */
        if(аркушФайл) файли.push(Object.assign({}, аркушФайл, { role:'sheet' }));
        else say('Аркуш не зібрався — версія піде без нього, зберіть кнопкою в картці');
        D.dzVer(dd, m, файли, hTxt,
          { wCm: чер2.mock.wCm, hCm: чер2.mock.hCm, topCm: чер2.mock.topCm,
            sideCm: чер2.mock.sideCm, size: чер2.mock.size }, dk);
        if(hTxt) D.dzNote(dd, m, hTxt, null, dk);
        if(hEl) hEl.value = '';
        /* `dzSay` після версії відкотив би стан у «на правках»: вона для
           слів менеджера, а не для супровідного коментаря до здачі. */
        dd.status = 'review';
        dd.draft = null;
        return save(job, o, 'Надіслано · версія ' + dd.vers.length);
      }
      /* ЗІБРАТИ АРКУШ. Один збирач на два випадки — здачу версії й скачування
     на вимогу: два різні означали б, що аркуш у картці й аркуш у теці
     колись розійдуться, і ніхто не помітить котрий із них правда. */
  async function sheetPng(job, o, u, ver, place, note){
    if(!window.LQMock) return null;
    var g = U.catItem(u.gid), pl = place || {};
    var vp = D.verParts(ver);
    return await window.LQMock.card({
      art: (vp.work[0] || {}).url, mock: (vp.mock[0] || {}).url,
      title: U.unitNo(job, u) + ' · версія ' + (ver ? ver.n : 1),
      nums: [
        ['Виріб', (g && g.name) || u.name || '—'],
        ['Колір', u.color || '—'],
        ['Розмір', u.size || '—'],
        ['Кількість', (+u.qty || 0) + ' шт'],
        ['Нанесення', pl.wCm ? (мсм(pl.wCm) + ' × ' + мсм(pl.hCm)) : '—']
      ],
      wideCm: window.LQMock.widthCm(u.gid, pl.size || u.size),
      artCm: pl.wCm || 0, sideCm: pl.sideCm || 0,
      contacts: (function(){
        try{ return (host().contacts && host().contacts()) || []; }catch(e){ return []; }
      })(),
      note: note || (function(){
        try{ return (host().cardNote && host().cardNote()) || ''; }catch(e){ return ''; }
      })()
    });
  }
  /* Той самий аркуш, але одразу файлом у сховищі — щоб лягти у версію. */
  async function sheetFile(job, o, u, чер, n){
    try{
      var png = await sheetPng(job, o, u,
        { n: n, files: [чер.art, { url: чер.mock.png }] }, чер.mock, null);
      if(!png) return null;
      return await uploadDataUrl(png, 'аркуш-v' + n + '.png');
    }catch(e){ console.error('аркуш', e); return null; }
  }
  /* ДІСТАТИ АРКУШ ВЕРСІЇ, А ЯКЩО ЙОГО НЕМАЄ — ЗІБРАТИ Й ПОКЛАСТИ.

     Версії, здані до того, як аркуш зʼявився, мають лише два файли, і їх у
     роботі більшість. Доти на них усе тихо відкочувалось до мокапу: у
     картці менеджер бачив футболку з лого замість документа, і клієнту
     їхало те саме. Тому тут одне місце, через яке проходять і показ, і
     скачування, і надсилання: немає аркуша — збираємо один раз і лишаємо
     у версії, далі всі троє беруть уже готовий. Другого разу не буде, і
     різних аркушів на одну версію теж. */
  async function sheetGet(job, o, u, ver){
    var vp = D.verParts(ver);
    if(vp.sheet) return vp.sheet;
    var fs = (ver && ver.files) || [];
    if(!vp.work.length || !vp.mock.length) return null;
    try{
      var png = await sheetPng(job, o, u, ver, ver.place, null);
      if(!png) return null;
      var up = await uploadDataUrl(png, 'аркуш-v' + (ver.n || 1) + '.png');
      if(!up || !up.url) return null;
      /* Аркуш ДОПИСУЄМО з позначкою ролі, а не кладемо на третє місце:
         на виробі з переду й спини там стояла робота, і її затирало. */
      ver.files = fs.slice();
      ver.files.push({ name: up.name || ('аркуш-v' + (ver.n || 1) + '.png'), url: up.url, role:'sheet' });
      return ver.files[ver.files.length - 1];
    }catch(e){ console.error('аркуш', e); return null; }
  }
  /* ══════════ АРКУШ ДЛЯ МЕНЕДЖЕРА ══════════

         Горизонтальна картка: ліворуч макет, праворуч мокап, під ними
         розміщення великими числами, а внизу склад і примітка. Одна
         картинка замість трьох файлів і усного переказу.

         Качається одразу файлом, а не відкривається вкладкою: її беруть,
         щоб переслати, і зайвий крок «зберегти як» на цьому шляху означає,
         що перешлють посилання на адмінку, куди в клієнта доступу немає. */
      /* ЗІБРАТИ АРКУШ РУКАМИ. Для версій, зданих до того, як аркуш узагалі
         зʼявився: їх у роботі більшість, і чекати, поки дизайнер здасть
         нову, тільки щоб побачити документ, немає сенсу. Збирається з тих
         самих файлів і того самого розміщення, що лежать у версії. */

      /* Зібрати аркуш версії, у якій його немає. Кнопки на це немає й не
         буде: картка кличе цю дію сама, коли бачить, чого бракує. Мовчки —
         людина не просила нічого збирати, вона просто відкрила картку. */
      if(what === 'dz-sheet'){
        var тихо = !!(data && data.quiet);
        var sv = (dd.vers || []).filter(function(x){ return +x.n === +(data && data.v); })[0]
                 || dd.vers[dd.vers.length - 1];
        if(!sv) return;
        var sf = await sheetGet(job, o, du, sv);
        if(!sf){
          if(!тихо) say('Аркуш не зібрався — перевірте фото виробу в каталозі');
          return;
        }
        return save(job, o, тихо ? '' : ('Аркуш зібрано · v' + sv.n));
      }
      if(what === 'dz-card'){
        var cv2 = (dd.vers || []).filter(function(x){ return +x.n === +(data && data.v); })[0]
                  || dd.vers[dd.vers.length - 1];
        if(!cv2) return say('Версії ще немає');
        /* Качаємо ТОЙ САМИЙ аркуш, що лежить у версії й що видно в картці.
           Немає його (стара версія) — `sheetGet` збере й покладе, і далі
           картка, скачування й лист клієнту будуть про один документ.
           Намальований щоразу наново міг би розійтися з тим, що менеджер
           бачив на екрані, — і ніхто б не сказав, котрий із двох правда. */
        var готовий = D.verParts(cv2).sheet;
        if(!готовий || !готовий.url){
          say('Збираю аркуш…');
          готовий = await sheetGet(job, o, du, cv2);
          if(!готовий) return say('Аркуш не зібрався — перевірте фото виробу в каталозі');
          await save(job, o, '');
        }
        return act('dz-dl', root, { url: готовий.url,
          name: 'Макет-' + U.unitNo(job, du).replace('#', '') + '-v' + cv2.n });
      }
      /* ══════════ ЯКУ САМЕ ВЕРСІЮ ══════════

         І надсилання, і погодження питають версію. Доти обидва мовчки
         брали останню — і це неправда рівно тоді, коли версій кілька:
         клієнт часто каже «беремо другу», подивившись третю, і «остання»
         тут означає не те, про що домовились.

         Одна версія — питати нема про що, і вікна немає: зайве натискання
         там, де вибору не існує, дратує більше за його відсутність. */
      if(what === 'dz-tell-pick' || what === 'dz-ok-pick'){
        var дія = what === 'dz-ok-pick' ? 'dz-ok' : 'dz-tell';
        var vs = (dd.vers || []).slice();
        if(!vs.length) return say('Версії ще немає');
        if(vs.length === 1)
          return act(дія, root, { dz: dkey, v: vs[0].n, how: 'client' });
        return U.pickOpen(
          дія === 'dz-ok' ? 'Яку версію погодив клієнт' : 'Яку версію надіслати',
          'Версій ' + vs.length + ' — оберіть ту, про яку домовились',
          vs.slice().reverse().map(function(v){
            var vpp = D.verParts(v);
            var f = vpp.sheet || vpp.mock[0] || vpp.work[0] || {};
            return '<button type="button" class="dz-pick-c" data-pick="' + v.n + '">' +
              (f.url ? '<span class="dz-pick-i"><img src="' + esc(f.url) +
                '" alt="" onerror="this.style.opacity=0"></span>' : '') +
              '<span class="dz-pick-n">v' + v.n + '<i>' + esc(dt(v.at)) +
                (v.sentToClient ? ' · надіслано' : '') + '</i></span>' +
            '</button>';
          }).join(''),
          function(n){ act(дія, root, { dz: dkey, v: n, how: 'client' }); });
      }
      /* ══════════ НАДІСЛАТИ КЛІЄНТУ ══════════

         Одним натиском і БЕЗ відкривання розмови. Андрій: «коли натиснув,
         без відкривання чата воно надсилається, пишеться що надіслано, і
         все — можна закривати й іти далі по перевірці».

         Різниця не в кліках. Перевіряють макети пачкою: десять карток
         підряд. Кожне «відкрий розмову — знайди місце — встав картинку —
         напиши текст — повернись» це пів хвилини й шанс повернутись не
         туди. Тепер це одне натискання, після якого кнопка гасне й каже,
         що вже надіслано.

         Текст береться зі скрипта — свого для першої версії і свого для
         наступних: «подивіться, як вийшло» і «внесли правки» це різні
         повідомлення, і слати перше вдруге виглядає так, ніби ми забули,
         про що йшлося. */
      if(what === 'dz-tell'){
        var tv = (dd.vers || []).filter(function(x){ return +x.n === +(data && data.v); })[0]
                 || dd.vers[dd.vers.length - 1];
        if(!tv) return say('Версії ще немає');
        if(!host().tellPic) return say('Надсилання картинок недоступне');
        /* Клієнту йде АРКУШ, а не голий мокап: на ньому наші контакти,
           розміри й примітка про колір. Немає аркуша (стара версія) —
           збираємо тут і кладемо у версію, а не підмінюємо мокапом: мокап
           без примітки про колір — це саме той лист, після якого клієнт
           каже «а в мене інший відтінок». */
        var мок = D.verParts(tv).sheet;
        if(!мок || !мок.url){
          say('Збираю аркуш…');
          мок = await sheetGet(job, o, du, tv);
          if(!мок) return say('Аркуш не зібрався — нема чого слати клієнту');
          await save(job, o, '');
        }
        /* Перша версія чи наступна — різні слова. Номер версії тут же, щоб
           клієнт бачив, про яку саме мова. */
        var перша = !(dd.vers || []).some(function(x){ return x.sentToClient; });
        var txt = '';
        try{ txt = (host().script && host().script(o, перша ? 'design1' : 'design2', {
          v: tv.n })) || ''; }catch(e){}
        /* ПІДТВЕРДЖЕННЯ: ЩО САМЕ ПІДЕ КЛІЄНТУ. Андрій: «повинно бути
           підтвердження, що саме ми надсилаємо… картинка і текст. Якщо все
           правильно — надсилаємо». Текст можна поправити тут же. */
        var остаточно = await tellConfirm(мок.url, txt, U.unitNo(job, du) + ' · версія ' + tv.n);
        if(остаточно === null) return;
        txt = остаточно;
        say('Надсилаю…');
        var вийшло = false;
        try{ вийшло = await host().tellPic(o, мок.url, txt); }
        catch(e){ console.error(e); }
        if(!вийшло) return say('Не надіслалось — перевірте привʼязку розмови');
        /* `nowIso` живе в ядрі, не тут. Виняток ковтався й виглядав як
           «надіслалось, але кнопка не згасла» — тобто менеджер тиснув удруге. */
        tv.sentToClient = new Date().toISOString();
        /* Своя подія, не `dzSay`: та позначає правку, і показ клієнту
           рахувався б у історії поверненням роботи. */
        D.dzTold(dd, m, tv.n);
        return save(job, o, 'Надіслано клієнту');
      }
      /* ══════════ ПРАВКА — МАЛЕНЬКИМ ВІКНОМ ══════════

         Правку пишуть, дивлячись на макет, і поле для неї має бути там
         само, де макет, а не в кінці списку повідомлень. Вікно лягає
         поверх, приймає текст і файл, і лишається в історії — саме за нею
         потім і відновлюють, чому третя версія відрізняється від другої. */
      /* Слово менеджера, яке НЕ повертає роботу. Для повернення є «Правка»
         — окрема кнопка з окремим вікном, і саме вона рухає картку. */
      if(what === 'dz-note'){
        var nEl = document.querySelector('[data-dzsay="' + dkey + '"]');
        var nTxt = nEl ? String(nEl.value || '').trim() : '';
        if(!nTxt) return say('Напишіть щось');
        D.dzSay(dd, m, nTxt, null, 'acct');
        D.dzSeen(dd, m, 'acct');
        if(nEl) nEl.value = '';
        return save(job, o, 'Правку надіслано дизайнеру');
      }
      if(what === 'dz-fix'){
        return U.fixOpen(async function(txt, file){
          if(!txt && !file) return;
          D.dzSay(dd, m, txt, file, 'acct');
          await save(job, o, 'Правку надіслано');
        });
      }
      if(what === 'dz-ver'){
        var vf = await upload('');
        if(!vf) return;
        D.dzVer(dd, m, vf, '', null, dk);
        return save(job, o, 'Версія ' + dd.vers.length);
      }
      if(what === 'dz-file'){
        var df = await upload('');
        if(!df) return;
        D.dzSay(dd, m, '', df, 'acct');
        return save(job, o, 'Файл додано');
      }
      if(what === 'dz-say'){
        var sEl = document.querySelector('[data-dzsay="' + dkey + '"]');
        var txt = sEl ? String(sEl.value || '').trim() : '';
        if(!txt) return say('Напишіть, що саме поміняти');
        D.dzSay(dd, m, txt, null, 'acct');
        if(sEl) sEl.value = '';
        return save(job, o, 'Правку надіслано');
      }
      if(what === 'dz-ok'){
        /* «Ескіз погоджений» — це слово КЛІЄНТА, після якого робота йде
           далі: саме з цієї миті відкривається вишивка, і оцифровують
           рівно ту версію, про яку домовились. Тому в історію лягає і хто
           натиснув, і яку версію погодили. */
        D.dzOk(dd, m, (data && data.how) || 'client', data && data.v);
        /* ПОГОДЖЕННЯ СИЛЬНІШЕ ЗА ПОПЕРЕДНІЙ ПОГЛЯД.

           Половину дизайну можна відкрити руками, і цей вибір тримається
           до кінця сеансу. Але погодження ескіза — не погляд, а перехід
           роботи: з цієї миті малює вишивальний. Андрій: «як тільки ми
           натиснули підтверджене замовлення, одразу відкривається зона
           вишивка», — а в нього не відкривалась саме тому, що він раніше
           зазирнув у графіку й система чесно тримала його вибір.

           Тому скидаємо ручний вибір: далі вирішує робота. */
        try{ delete U.SIDE[du.id]; }catch(e){}
        return save(job, o, 'Ескіз погоджений · v' +
          ((dd.ok && dd.ok.ver) || dd.vers.length));
      }
      D.dzUnok(dd);
      return save(job, o, 'Затвердження знято');
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
