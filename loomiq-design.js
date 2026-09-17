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
      brief: { missing: [], note: '', returnedAt: '', returnedBy: '' },
      /* Версій тут немає навмисно: вони живуть у замовленні. Тут — стан,
         відповідальний, строк і причини повернень. */
      graphic: { status:'new', assignee:'', due:'', events: [] },
      client: { sentAt:'', sentBy:'', decidedAt:'', decision:'', reasons:[], note:'', version:0 },
      approvedVersion: 0,
      stitch: [],
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
  function stitchReady(job, key, by){
    var s = stitchAt(job, key); if(!s) return null;
    if(!(s.files || []).length) return null;     // «готово» без файлу — не готово
    s.status = 'qa';
    s.qa.status = '';
    ds(job, 'stitch-ready', { key:key, by:by, stitches: s.stitches || undefined });
    return job;
  }
  function qaPass(job, key, by, checks){
    var s = stitchAt(job, key); if(!s) return null;
    var miss = QA_CHECKS.filter(function(c){ return !(checks || {})[c.key]; });
    if(miss.length) return { miss: miss };        // чекліст неповний — не пропускаємо
    s.qa = { status:'ok', by: by || '', at: nowIso(), checks: checks, reasons: [], note:'' };
    s.status = 'ok';
    ds(job, 'qa-pass', { key:key, by:by });
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
    emptyJob: emptyJob, ensure: ensure, stitchKeys: stitchKeys,
    needsStitch: needsStitch, briefMissing: briefMissing,
    ds: ds, verNew: verNew, verCur: verCur, verAt: verAt, verLocked: verLocked,
    assign: assign, backToSales: backToSales, designStart: designStart,
    toReview: toReview, revise: revise, mgrApprove: mgrApprove,
    sendToClient: sendToClient, clientApprove: clientApprove,
    clientChanges: clientChanges,
    stitchAt: stitchAt, stitchOpen: stitchOpen, stitchAssign: stitchAssign,
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

  var TABS = [
    { key:'queue',   label:'Черга',    role:'designmgr' },
    { key:'graphic', label:'Макети',   role:'designer'  },
    { key:'stitch',  label:'Вишивка',  role:'embroidery'},
    { key:'qa',      label:'QA',       role:'qa'        },
    { key:'pack',    label:'Пакети',   role:'production'}
  ];
  var tab = 'queue', openKey = '';

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
  function briefHtml(o, job){
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
      rows + '</div>';
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

  function teamPick(id, role, cur){
    var list = (host.team ? host.team() : []).filter(function(m){
      return !role || m.role === role || m.role === 'owner';
    });
    return '<select id="' + id + '"><option value="">— оберіть —</option>' +
      list.map(function(m){
        return '<option value="' + esc(m.email) + '"' +
               (m.email === cur ? ' selected' : '') + '>' + esc(m.name || m.email) + '</option>';
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
    teamPick: teamPick, TABS: TABS
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
  function queueCards(){
    return U.pairs().map(function(p){
      var g = p.job.graphic || {};
      return { id: p.o.orderId, step: p.job.state,
        title: '#' + p.o.orderId,
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
        title: '#' + p.o.orderId,
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
          title: '#' + p.o.orderId + ' · ' + (s.label || ''),
          sub: (s.name || '') + (s.color ? ' · ' + s.color : ''),
          foot: (s.mm ? s.mm.w + '×' + s.mm.h + ' мм' : '') +
                (s.assignee ? ' · ' + nameOf(s.assignee) : '') +
                (s.outsource ? ' · ' + s.outsource : '') });
      });
    });
    return out;
  }

  /* ── Панель: черга відділу ─────────────────────────────────────────── */
  function queuePanel(p){
    var job = p.job, o = p.o, g = job.graphic;
    var v = D.verCur(o);
    var acts = [];
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
    return '<div class="dz-panel-h">#' + esc(o.orderId) +
        '<span class="dz-state">' + esc(D.stateLine(job)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.briefHtml(o, job) +
        (acts.length ? '<div class="dz-acts">' + acts.join('') + '</div>' : '') +
        '<div class="dz-h">Версії</div>' + U.versionsHtml(job, o) +
      '</div>';
  }

  /* ── Панель: робота дизайнера ──────────────────────────────────────── */
  function graphicPanel(p){
    var job = p.job, o = p.o, g = job.graphic, v = D.verCur(o);
    var locked = D.verLocked(v);
    var acts = '<div class="dz-act">' +
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
    return '<div class="dz-panel-h">#' + esc(o.orderId) +
        '<span class="dz-state">' + esc(D.stepLabel(D.GRAPHIC, g.status)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
        U.briefHtml(o, job) +
        '<div class="dz-acts">' + acts + '</div>' +
        '<div class="dz-h">Версії</div>' + U.versionsHtml(job, o) +
      '</div>';
  }

  /* ── Панель: оцифрування ───────────────────────────────────────────── */
  function stitchPanel(p, s){
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
    return '<div class="dz-panel-h">#' + esc(o.orderId) + ' · ' + esc(s.label) +
        '<span class="dz-state">' + esc(D.stepLabel(D.STITCH, s.status)) + '</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
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
        '<div class="dz-acts">' + body + '</div>' +
      '</div>';
  }

  /* ── Панель: QA вишивального файлу ─────────────────────────────────── */
  function qaPanel(p, s){
    var o = p.o;
    var checks = (s.qa && s.qa.checks) || {};
    return '<div class="dz-panel-h">#' + esc(o.orderId) + ' · ' + esc(s.label) +
        '<span class="dz-state">перевірка файлу</span>' +
        '<button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
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
    return '<div class="dz-panel-h">#' + esc(o.orderId) +
        '<span class="dz-state">' + (pk ? 'пакет зібрано' : (r.ok ? 'готово збирати' : 'не готово')) +
        '</span><button class="dz-x" data-close>×</button></div>' +
      '<div class="dz-panel-b">' +
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
  function render(root){
    if(!root) return;
    var tab = U.tab();
    var cards, steps, panel = '';
    if(tab === 'graphic'){ steps = D.GRAPHIC; cards = graphicCards(); }
    else if(tab === 'stitch'){ steps = D.STITCH; cards = stitchCards(''); }
    else if(tab === 'qa'){ steps = D.STITCH.filter(function(s){
        return s.key === 'qa' || s.key === 'revision' || s.key === 'ok'; });
      cards = stitchCards('').filter(function(c){
        return c.step === 'qa' || c.step === 'revision' || c.step === 'ok'; }); }
    else if(tab === 'pack'){
      steps = [{ key:'wait', label:'Ще не готові', color:'gray' },
               { key:'ready', label:'Готові збирати', color:'cyan' },
               { key:'done', label:'Передано', color:'green', done:true }];
      cards = U.pairs().map(function(p){
        var r = D.packReady(p.job, p.o);
        return { id: p.o.orderId, step: p.job.pack ? 'done' : (r.ok ? 'ready' : 'wait'),
          title: '#' + p.o.orderId,
          sub: (p.o.items || []).filter(function(i){ return (i.kind||'main') !== 'reco'; })
                 .map(function(i){ return i.name; }).filter(Boolean).slice(0, 2).join(' · '),
          foot: r.ok ? 'усе на місці' : r.why[0] || '' };
      });
    }
    else { steps = D.QUEUE; cards = queueCards(); }

    var openId = U.tabOpen ? U.tabOpen() : '';
    root.innerHTML =
      '<div class="dz-tabs">' + U.TABS.map(function(t){
        return '<button class="dz-tab' + (t.key === tab ? ' on' : '') +
               '" data-tab="' + t.key + '">' + esc(t.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="dz-wrap">' +
        '<div class="dz-boards">' + U.boardHtml(steps, cards) + '</div>' +
        '<aside class="dz-panel' + (openId ? '' : ' hide') + '" id="dzPanel">' +
          (openId ? panelFor(tab, openId) : '') + '</aside>' +
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
  function panelFor(tab, id){
    if(tab === 'stitch' || tab === 'qa'){
      var parts = String(id).split('|');
      var p = U.pairOf(parts[0]);
      if(!p) return '';
      var s = D.stitchAt(p.job, parts[1]);
      if(!s) return '';
      return tab === 'qa' ? qaPanel(p, s) : stitchPanel(p, s);
    }
    var pr = U.pairOf(id);
    if(!pr) return '';
    if(tab === 'graphic') return graphicPanel(pr);
    if(tab === 'pack') return packPanel(pr);
    return queuePanel(pr);
  }

  window.LQDesign.ui.render = render;
  window.LQDesign.ui.panelFor = panelFor;
  window.LQDesign.ui.save = save;
  window.LQDesign.ui.can = can;
  window.LQDesign.ui.wireHook = function(f){ wireExtra = f; };
  var wireExtra = null;

  function wire(root){
    root.querySelectorAll('[data-tab]').forEach(function(b){
      b.onclick = function(){ U.setTab(b.dataset.tab); render(root); };
    });
    root.querySelectorAll('[data-open]').forEach(function(b){
      b.onclick = function(){ U.open(b.dataset.open); render(root); };
    });
    var x = root.querySelector('[data-close]');
    if(x) x.onclick = function(){ U.open(''); render(root); };
    root.querySelectorAll('[data-do]').forEach(function(b){
      b.onclick = function(){ act(b.dataset.do, root); };
    });
    if(wireExtra) wireExtra(root);
  }

  /* ══════════ ДІЇ ══════════ */
  function ctx(){
    var id = U.tabOpen ? U.tabOpen() : '';
    var parts = String(id).split('|');
    var p = U.pairOf(parts[0]);
    if(!p) return null;
    var s = parts[1] ? D.stitchAt(p.job, parts[1]) : null;
    return { p:p, o:p.o, job:p.job, s:s };
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

  async function act(what, root){
    var c = ctx();
    if(!c) return;
    var job = c.job, o = c.o, s = c.s, m = (host().me && host().me()) || '';

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
      D.ds(job, 'package', { by:m, items:(job.pack.items || []).length });
      return save(job, o, 'Пакет зібрано');
    }
  }
})();
