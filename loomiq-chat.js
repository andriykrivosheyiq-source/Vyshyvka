/* ══════════════════════════════════════════════════════════════════════
   LOOMIQ — ДІАЛОГ (Telegram + Instagram/Sitniks). Окремий файл (19.10).

   Андрій: «постійні проблеми з діалогом, коли я зміни вношу… повинно
   воно окремо працювати». Тут живе все, що стосується переписки з
   клієнтом: розмова Telegram у картці, Sitniks (привʼязка, читання
   стрічки, надсилання тексту й фото, обхід розмов, кружечки), розділи
   «Чати B2B/B2C», вікно діалогу, заготовки й картки для Direct.

   Правила:
   - Цей файл підключається ДО основного скрипта адмінки і НЕ виконує
     нічого з адмінки при завантаженні — лише оголошує функції й стан.
     Адмінка кличе його функції (chatOpen, renderChats, crmSweepStart…),
     а він — її (orders, toast, escapeHtml, renderBoard…) уже під час
     роботи, коли все оголошено.
   - Зміна тут або в адмінці — сторож tests/chat-guard.mjs (pre-commit і
     GitHub Action): історія, помилки вголос, текст, повтор, нове, фото.
   - Код картки замовлення, грошей, дошок сюди не кладемо; код переписки
     в адмінку не повертаємо.
   ══════════════════════════════════════════════════════════════════════ */
/* ============================================================
   TELEGRAM — діалог просто в картці Канбану

   Звернення з бота вже ставали картками, але всередині картки не було
   найголовнішого — самої розмови. Менеджер відкривав картку, бачив «Звернення
   з Telegram · 4 повідомл.» і йшов читати їх в іншому застосунку; половина
   сенсу картки на цьому губилась.

   Тепер повідомлення пише той самий воркер вебхука (worker/telegram-webhook.js)
   в an_tg/{чат}/msgs, а звідси вони читаються живою підпискою — без опитувань
   і без затримки. Відповідь іде назад через /send того ж воркера: токен бота
   в браузер не потрапляє ніколи, а право написати підтверджується входом
   у Firebase.

   Чого тут НЕ буде, і це важливо розуміти: повідомлень, які бот або менеджер
   надіслали повз нас — із SendPulse чи з самого Telegram. Через вебхук
   проходить лише те, що пише КЛІЄНТ, і те, що надсилаємо ми звідси.
   ============================================================ */
function tgBase(){
  const u = ((contentData || {}).bgApi || {}).tgUrl || '';
  return String(u).replace(/\/+$/, '');
}
// Картка звернення з Telegram зберігає ідентифікатор чату у webId («tg:123»).
function tgChatOf(o){
  const w = String((o && o.webId) || '');
  return w.slice(0, 3) === 'tg:' ? w.slice(3) : '';
}
let tgChat = {};      // orderId → { msgs, draft, err, loading }
let tgUnsub = null;   // жива підписка активної картки

const TG_KIND_UA = { photo:'📷 фото', voice:'🎤 голосове', video:'🎬 відео',
  doc:'📎 файл', sticker:'стікер', contact:'📇 контакт', location:'📍 локація' };

/* Жива підписка на розмову відкритої картки. Рівно одна: закрили картку —
   відписались, інакше кожне відкриття лишало б за собою ще один канал. */
function tgWatch(o){
  tgUnwatch();
  const chat = tgChatOf(o);
  if(!chat || typeof fbDb === 'undefined') return;
  if(!tgChat[o.id]) tgChat[o.id] = { loading: true };
  tgUnsub = fbDb.collection('an_tg').doc(chat).collection('msgs').orderBy('at')
    .limit(300).onSnapshot(function(snap){
      const msgs = [];
      snap.forEach(d=>{ const v = d.data() || {}; msgs.push({
        at: v.at || '', text: v.text || '', kind: v.kind || 'text',
        // file зʼявляється, коли воркер зміг перекласти фото в Cloudinary.
        // Старі повідомлення його не мають — там лишиться сама помітка.
        file: v.file || '', mine: !!v.mine, by: v.by || '' }); });
      const st = tgChat[o.id] || {};
      st.msgs = msgs; st.loading = false; st.err = null;
      tgChat[o.id] = st;
      if(drawerOrderId === o.id || (chatWin && chatWin.id === o.id)) renderOrderDrawer();
    }, function(e){
      tgChat[o.id] = Object.assign(tgChat[o.id] || {}, { loading:false,
        err: 'Не читається переписка: ' + (e && (e.code || e.message) || '') +
             '. Найчастіше це неопубліковані правила бази.' });
      if(drawerOrderId === o.id || (chatWin && chatWin.id === o.id)) renderOrderDrawer();
    });
}
function tgUnwatch(){ if(tgUnsub){ try{ tgUnsub(); }catch(e){} tgUnsub = null; } }

/* Помилки воркера людською мовою. Кожен рядок — не діагноз, а дія: без
   цього менеджер бачив «not-configured» і йшов питати розробника. */
const TG_ERR_UA = {
  'not-configured': 'у воркері немає змінної FIREBASE_API_KEY. Cloudflare → loomiq-tg → Settings → Variables → Add → Text',
  'no-bot-token': 'у воркері немає TELEGRAM_BOT_TOKEN',
  'no-auth': 'сесія адмінки застаріла — вийдіть і зайдіть знову',
  'auth-failed': 'сесія адмінки застаріла — вийдіть і зайдіть знову',
  'auth-unreachable': 'воркер не достукався до Google. Спробуйте ще раз',
  'telegram-unreachable': 'воркер не достукався до Telegram. Спробуйте ще раз',
  'bad-chat': 'у картці немає ідентифікатора чату',
  'bad-photo': 'фото не завантажилось — спробуйте ще раз',
  'bad-json': 'воркер не зрозумів запит — напевно, стара версія воркера',
  'method': 'стара версія воркера: перевикладіть telegram-webhook.js',
  'empty': 'порожнє повідомлення'
};
function tgErrUa(j, status){
  if(!j || !j.error) return 'код ' + status;
  // Відмову самого Telegram показуємо як є: «bot was blocked by the user»
  // пояснює ситуацію краще за будь-який наш переказ.
  if(j.error === 'telegram') return j.detail || 'Telegram відмовив';
  return TG_ERR_UA[j.error] || (j.error + (j.detail ? ' · ' + j.detail : ''));
}
async function tgSend(o, text, photo, again){
  const chat = tgChatOf(o), body = scriptMarksOff(text).trim();
  const pic = String(photo || '').trim();
  if(!chat || (!body && !pic)) return false;
  const base = tgBase();
  if(!base){ toast('Спершу вкажіть адресу воркера Telegram'); return false; }
  /* Текст — у чергу відправленого (14.10): доти при збої він просто
     губився, бо поле вже очистили. Фото показує своя черга картинок. */
  const x = body && !pic ? (again || obAdd(o, 'tg', { text: body })) : null;
  if(x){ x.state = 'pending'; x.err = ''; obPaint(o); }
  const невдача = msg => { if(x){ x.state = 'failed'; x.err = msg; obPaint(o); } toast('Не надіслалось: ' + msg); return false; };
  let idToken = '';
  try{ idToken = await fbAuth.currentUser.getIdToken(); }
  catch(e){ return невдача('сесія застаріла — увійдіть ще раз'); }
  try{
    const r = await fetch(base + '/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat, text: body, photo: pic, idToken })
    });
    const j = await r.json().catch(()=>({}));
    /* Старий воркер про фото не знає: поле photo він просто проігнорує, а
       порожній текст поверне як «empty». Тоді надсилаємо картинку
       посиланням — клієнт усе одно її отримає, а не лишиться ні з чим. */
    if(pic && !j.ok && (j.error === 'empty' || j.error === 'bad-json' || j.error === 'method')){
      return tgSend(o, (body ? body + '\n' : '') + pic);
    }
    // Причину показуємо словами. Код на кшталт «not-configured» чесний, але
    // менеджеру не каже нічого — а тут кожна причина має конкретну дію.
    if(!r.ok || !j.ok) return невдача(tgErrUa(j, r.status));
    if(x){ x.state = 'sent'; x.sentAt = new Date().toISOString(); obPaint(o); }
    /* Відповіли — пропущене гасне само (15.10). */
    if(tgUnread(o)){ o.tgSeen = o.tgAt; o.tgSeenWrote = +o.tgWrote || 0; try{ chatsRepaint(); }catch(e){} }
    // Стрічку не чіпаємо: воркер записав повідомлення в базу, і підписка
    // принесе його сама — інакше воно з'явилося б двічі.
    /* Хто відповів і скільки клієнт чекав — для дашборду й комунікейшн-менеджера. */
    try{ chatReplied(o, 'tg', waitingMin(o)); saveOrderMeta(o).catch(e => console.warn(e)); }catch(e){ console.warn(e); }
    return true;
  }catch(e){
    return невдача((e && e.message) || 'немає звʼязку з воркером');
  }
}

function wireTgBlock(panel, o){
  if(!tgChatOf(o)) return;
  const feedEl = panel.querySelector('.od-crm-feed');
  if(feedEl) feedEl.scrollTop = feedEl.scrollHeight;
  const go = panel.querySelector('.od-tg-go');
  const inp = panel.querySelector('.od-tg-inp');
  if(go && inp){
    inp.addEventListener('input', ()=>{ if(tgChat[o.id]) tgChat[o.id].draft = inp.value; });
    const send = ()=>{ const t = inp.value; inp.value = '';
      if(tgChat[o.id]) tgChat[o.id].draft = ''; tgSend(o, t); };
    go.addEventListener('click', send);
    inp.addEventListener('keydown', e=>{ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
  }
}

/* ============================================================
   SITNIKS CRM — переписка з клієнтом усередині картки

   Менеджер весь час стрибав між двома вікнами: тут прорахунок і макети,
   там розмова. Половина домовленостей губилась саме на цьому переході.

   Ключ Sitniks у браузер не потрапляє: усі запити йдуть через воркер-проксі
   (worker/sitniks-proxy.js), його адреса зберігається в налаштуваннях сайту.

   Документація Sitniks закрита, і достеменно відомо лише три ендпоінти.
   Чи існує читання історії — невідомо, тому код пробує його і чесно каже,
   якщо сервер відповів «немає такого». Гадати за користувача тут не можна:
   порожня стрічка й «історія недоступна» — різні речі.
   ============================================================ */
let crmChat = {};   // orderId → { chatId, clientName, msgs, err, loading, raw }

function crmBase(){
  const u = ((contentData || {}).bgApi || {}).sitniksUrl || '';
  return String(u).replace(/\/+$/, '');
}
/* ПАУЗА ПІСЛЯ 429 (19.10). Sitniks рахує запити, і коли ми його
   перевантажуємо (жива розмова що 4 с + обхід що 30 с), він відмовляє всім
   підряд — і відкритий діалог теж лишається порожнім. Тож після відмови
   ФОНОВІ запити (обхід, опитування) мовчать, поки пауза не мине, а
   відкритий діалог каже про це словами й повторює сам. */
let crmCoolUntil = 0, crmCoolWhy = '';
function crmCooling(){ return crmCoolUntil > Date.now() ? crmCoolUntil - Date.now() : 0; }
function crmCool(ms, why){ crmCoolUntil = Math.max(crmCoolUntil, Date.now() + ms); crmCoolWhy = why || ''; }
async function crmFetch(path, options){
  const base = crmBase();
  if(!base) throw new Error('Адресу воркера Sitniks не задано (Конструктор сайту → Sitniks CRM)');
  const opt = Object.assign({}, options || {});
  /* Файл їде формою, і заголовок їй ставить САМ браузер: у ньому межа
     частин (`boundary=...`), якої ми не знаємо. Написавши тут свій
     `application/json`, ми б цю межу стерли — і вкладення перетворилось
     би на кашу, якої приймач не розбирає. */
  const isForm = (typeof FormData !== 'undefined') && (opt.body instanceof FormData);
  if(!isForm) opt.headers = Object.assign({ 'Content-Type': 'application/json' }, opt.headers || {});
  /* ЛІМІТ ОЧІКУВАННЯ (14.10). Доти запит міг висіти без кінця, а кнопка —
     разом із ним: «вони довго виснуть». 20 с — і чесне «не відповідає». */
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  /* Читання — 20 с; відправка — 45 с: Sitniks на POST відповідає довше. */
  const мс = +opt.timeoutMs > 0 ? +opt.timeoutMs : (opt.method && opt.method !== 'GET' ? 45000 : 20000);
  delete opt.timeoutMs;
  if(ctrl) opt.signal = ctrl.signal;
  const таймер = ctrl ? setTimeout(() => ctrl.abort(), мс) : null;
  let res;
  try{ res = await fetch(base + path, opt); }
  catch(e){
    if(e && e.name === 'AbortError'){ const er = new Error('Sitniks не відповідає ' + Math.round(мс / 1000) + ' с'); er.status = 0; if(!opt.method || opt.method === 'GET') crmCool(10000, er.message); throw er; }
    throw e;
  }finally{ if(таймер) clearTimeout(таймер); }
  const text = await res.text().catch(()=> '');
  if(!res.ok){
    // Текст помилки від Sitniks — єдине, що пояснює 400. Витягуємо його з
    // будь-якого поля, у якому він може приїхати, і не ховаємо за «Помилка».
    let detail = '';
    try{
      const j = JSON.parse(text);
      detail = j.message || j.error || j.title ||
               (j.errors && (typeof j.errors === 'string' ? j.errors : JSON.stringify(j.errors))) || '';
    }catch(e){ detail = text.slice(0, 200); }
    const err = new Error(detail ? ('HTTP ' + res.status + ': ' + detail) : ('HTTP ' + res.status));
    err.status = res.status;
    /* 429 — пауза всім (Retry-After воркер не пропускає, тож хвилина);
       збій читання (5xx) — коротка пауза лише читанню. Невдале НАДСИЛАННЯ
       читання не зупиняє: стрічка має й далі оновлюватись. */
    if(res.status === 429){
      const ra = parseFloat(res.headers.get('Retry-After'));
      crmCool((ra > 0 && ra < 600 ? ra : 60) * 1000, 'Sitniks обмежив запити (429)');
    } else if(res.status >= 500 && (!opt.method || opt.method === 'GET')) crmCool(10000, 'Sitniks: ' + err.message);
    throw err;
  }
  try{ return JSON.parse(text); }catch(e){ return {}; }
}

/* ── Привʼязка розмови Sitniks ────────────────────────────────────────────
   Половина звернень приходить не в Telegram, а в Instagram — там номера
   замовлення ще немає, тільки розмова. Менеджер ішов шукати людину в Sitniks
   руками, і саме на цьому переході губився контекст картки.

   Пошуку по API в Sitniks немає — документація закрита, і жодна зі звичних
   назв параметра не працює: невідомий параметр там просто ігнорують і чемно
   віддають ПОЧАТОК ЗАГАЛЬНОГО СПИСКУ діалогів. Ми довго обходили це читанням
   списку сторінками й відсіюванням у себе, але в робочому акаунті це сотні
   роздрібних розмов за півдня: потрібна вже за день лежить на кількатисячній
   позиції, а на екрані щоразу купа чужих діалогів, серед яких легко привʼязати
   не ту людину.

   Тож лишився один шлях — і саме тому він тут єдиний. Менеджер у цю мить і
   так стоїть у відкритій розмові в Sitniks: беремо адресу звідти, а імʼя,
   прізвище й нік читаємо з самої розмови. Переписувати руками те, що вже
   написано в CRM, не потрібно нікому. */
let crmSeek = {};   // orderId → { binding, bindErr } — стан поля привʼязки

/* Блок зʼявляється лише тоді, коли розмову вже знайдено. Порожня форма
   «впишіть номер замовлення» стояла в кожній картці й нічого не давала:
   вхід у Sitniks тепер один — кнопка біля ніка вгорі. Поле з номером
   лишається тільки в тих картках, де його колись уже заповнили. */
function crmShow(o){
  return !!(o.crmChatId || o.crmOrder);
}
/* Кнопка лишається й тоді, коли розмову вже привʼязано. Раніше вона зникала —
   і скасувати помилкову адресу не було чим: блок Sitniks у картці з привʼязаним
   чатом не показується взагалі. А вставити не ту адресу легко: вона береться з
   сусідньої вкладки. */
/* INSTAGRAM У B2B — ЛИШЕ ПОСИЛАННЯМ НА РОЗМОВУ В SITNIKS (04.10).
   Андрій: «не по ніку, а чисто по посиланню до Sitniks… щоб не було цього
   просто ніка, бо він все одно веде на сторінку Instagram і це безтолково».
   Тож на вкладці Instagram картки B2B поля «нік» немає: одне поле — вставити
   адресу розмови з Sitniks; нік і імʼя клієнта підтягуються з розмови самі
   (crmBindUrl → crmPickChat). Привʼязано — замість поля підпис «@нік · імʼя»
   і 💬, що відкриває саму розмову. Без адреси воркера Sitniks — як доти. */
function igLinkMode(o){
  return !!crmBase() && orderDir(o) !== 'b2c' && !tgChatOf(o);
}
function igLinkHtml(o){
  if(o.crmChatId){
    return `<div class="od-f od-chan-h od-ig-who" title="Розмова в Sitniks">${
        escapeHtml(crmWhoLabel(o) || ('чат ' + o.crmChatId))}</div>
      <button class="od-who-go" data-chan-go title="Відкрити розмову">💬</button>`;
  }
  const було = String(o.ig || '').replace(/^@/, '').trim();
  return `<input class="od-f od-chan-h od-ig-link" type="text" ${canBindChat() ? '' : 'disabled'}
      placeholder="${escapeHtml(canBindChat()
        ? 'Вставте посилання на розмову в Sitniks' + (було ? ' (було @' + було + ')' : '')
        : 'Розмову в Sitniks ще не привʼязано')}" value="">`;
}
function crmSeekBtnHtml(o){
  if(tgChatOf(o) || !crmBase() || !canBindChat()) return '';
  /* Без привʼязки поле посилання вже стоїть у самій шапці — друга кнопка
     для того самого ні до чого. */
  if(igLinkMode(o) && !o.crmChatId) return '';
  return `<button class="od-ig-find" title="${o.crmChatId
    ? 'Змінити або відвʼязати розмову Sitniks'
    : 'Привʼязати розмову з Sitniks за посиланням'}">🔗</button>`;
}
function crmSeekHtml(o){
  const s = crmSeek[o.id];
  if(!s) return '';
  /* Привʼязуємо з поля в шапці — тут лише стан: читаємо чи що пішло не так. */
  if(igLinkMode(o) && !o.crmChatId){
    if(s.binding) return '<div class="od-seek-hint">Читаємо розмову в Sitniks…</div>';
    return s.bindErr ? `<div class="od-crm-err">${escapeHtml(s.bindErr)}</div>` : '';
  }
  /* Коли розмова вже є, сюди повертаються здебільшого через помилку — тож
     спершу видно, хто привʼязаний, і одразу поруч спосіб це скасувати. */
  const now = o.crmChatId
    ? `<div class="od-seek-now">
         <span class="od-seek-who">${crmWhoHtml(o)}</span>
         ${crmCanUnlink() ? '<button class="od-crm-unlink">Відвʼязати</button>' : ''}
       </div>`
    : '';
  return `<div class="od-seek">
    <div class="od-seek-h">Розмова в Sitniks</div>
    ${now}
    <div class="od-seek-bind">
      <input type="text" class="od-seek-url" placeholder="${o.crmChatId
        ? 'Вставте іншу адресу, щоб замінити' : 'Вставте посилання на розмову'}"
        value="" ${s.binding ? 'disabled' : ''}>
      <button class="od-seek-go" data-seek-bind ${s.binding ? 'disabled' : ''}>${
        s.binding ? 'Читаємо…' : (o.crmChatId ? 'Замінити' : 'Привʼязати')}</button>
    </div>
    <div class="od-seek-hint">Відкрийте розмову в Sitniks і скопіюйте адресу з рядка
      браузера. Імʼя й нік підтягнуться з розмови самі.</div>
    ${s.bindErr ? `<div class="od-crm-err">${escapeHtml(s.bindErr)}</div>` : ''}
  </div>`;
}
/* Кнопка відкриває поле, друге натискання — закриває. Жодних запитів на
   цьому кроці немає: питати в Sitniks нема чого, поки немає адреси. */
function crmSeekOpen(o){
  if(crmSeek[o.id]) delete crmSeek[o.id];
  else crmSeek[o.id] = {};
  renderOrderDrawer();
}
function crmChannelOf(r){
  /* Канал у Sitniks лежить то вгорі запису, то у вкладеному клієнті, то в
     останньому повідомленні — залежно від того, який це список. Дивимось у
     всі три місця: інакше значок каналу зникав саме там, де він потрібен. */
  const box = [r, r.chat, r.client, r.contact, r.lastMessage].filter(x => x && typeof x === 'object');
  const raw = box.reduce((a, x) => a.concat(
    [x.channel, x.source, x.messenger, x.type, x.channelType, x.channelName]), [])
    .filter(v => typeof v === 'string').join(' ').toLowerCase();
  if(/insta/.test(raw)) return 'Instagram';
  if(/telegram|tg/.test(raw)) return 'Telegram';
  if(/viber/.test(raw)) return 'Viber';
  if(/whats/.test(raw)) return 'WhatsApp';
  if(/facebook|messenger|fb/.test(raw)) return 'Facebook';
  return '';
}
function crmListOf(data){
  const arr = Array.isArray(data) ? data
    : (data && (data.items || data.data || data.results || data.chats ||
                data.clients || data.contacts || data.list)) || [];
  return Array.isArray(arr) ? arr : [];
}
/* Хто по той бік розмови. Людина в відповіді Sitniks лежить то вгорі запису,
   то у вкладеному `client`/`contact` — залежно від того, який це ендпоінт.
   Тому дивимось в обидва місця: інакше імʼя в відповіді є, але не читається,
   і картка лишається підписаною шістнадцятковим номером чату. */
function crmWho(r){
  return [r, r && r.client, r && r.contact, r && r.chat]
    .filter(x => x && typeof x === 'object');
}
function crmNick(r){
  for(const b of crmWho(r)){
    const v = [b.username, b.userName, b.login, b.nickname, b.nick,
               b.instagram, b.clientUsername].find(x => typeof x === 'string' && x.trim());
    if(v) return String(v).trim().replace(/^@/, '');
  }
  return '';
}
function crmName(r){
  for(const b of crmWho(r)){
    const v = [b.clientName, b.name, b.fullName, b.title]
      .find(x => typeof x === 'string' && x.trim());
    if(v) return String(v).trim();
  }
  return '';
}
/* Запис Sitniks → те, що ми з нього вміємо прочитати: розмова, імʼя, нік,
   канал. Більше з нього нічого й не потрібно — саме це й переїжджає в
   картку після привʼязки. */
function crmNormFound(data, isChats){
  return crmListOf(data).slice(0, 50).map(r => ({
    // id як ідентифікатор чату беремо лише зі списку чатів: у довіднику
    // людей це id людини, і розмова за ним не відкриється.
    chatId: String(r.chatId || r.chat_id || (r.chat && (r.chat.id || r.chat.chatId)) ||
                   (isChats ? (r.id || '') : '') || ''),
    name: crmName(r), nick: crmNick(r), channel: crmChannelOf(r)
  })).filter(r => r.chatId || r.name || r.nick);
}

/* ── Привʼязка за посиланням на розмову ──────────────────────────────────
   Пошуку в Sitniks по API немає, і обійти це читанням списку не виходить: у
   робочому акаунті сотні діалогів за півдня, тож потрібна розмова вже через
   день лежить на кількатисячній позиції. Прочитати стільки — це десятки
   запитів на кожен пошук.

   Але менеджер у цю мить і так стоїть у відкритій розмові в Sitniks. Тож
   беремо адресу звідти:

       https://web.sitniks.com/1503/chats/dialog/6aa910231444b9f4123817a1
                                                 └─ ідентифікатор розмови

   Це працює завжди, незалежно від того, що вміє їхнє API, і не залежить від
   того, скільки в акаунті діалогів. */
function crmChatIdFromUrl(text){
  const t = String(text || '').trim();
  if(!t) return '';
  const d = /\/dialog\/([0-9a-f]{8,})/i.exec(t);
  if(d) return d[1];
  /* Могли скопіювати сам ідентифікатор, без адреси. */
  const bare = /^[0-9a-f]{16,}$/i.exec(t);
  if(bare) return t;
  const any = /([0-9a-f]{24})/i.exec(t);
  return any ? any[1] : '';
}
async function crmBindUrl(o, text){
  const id = crmChatIdFromUrl(text);
  if(!id){
    toast('Не схоже на посилання з Sitniks — скопіюйте адресу відкритої розмови');
    return;
  }
  const st = crmSeek[o.id] || (crmSeek[o.id] = {});
  st.binding = true; st.bindErr = '';
  renderOrderDrawer();
  /* Перевіряємо одним запитом, що така розмова справді є, і заразом читаємо з
     неї співрозмовника: імʼя, нік, канал. Саме заради цього привʼязка й
     робиться посиланням — менеджер не має переписувати руками те, що вже
     написано в Sitniks.

     Дивимось два шляхи: у самому діалозі людина є не завжди, а в стрічці
     повідомлень вона підписана під кожним. Якщо обидва закриті — привʼязуємо
     однаково: ідентифікатор узятий з їхньої ж адреси, вигадати його нізвідки. */
  let who = null;
  for(const path of ['/chats/' + encodeURIComponent(id),
                     '/chats/' + encodeURIComponent(id) + '/messages']){
    try{
      const data = await crmFetch(path);
      const list = crmNormFound(Array.isArray(data) ? data : [data], true);
      const one = list.find(r => r.name || r.nick);
      if(one){ who = one; break; }
      // Відповів, але назвати людину нічим — шукаємо в наступному місці.
    }catch(e){
      if(e.status && e.status !== 404 && e.status !== 405){
        st.binding = false;
        st.bindErr = e.message || 'не вдалось перевірити';
        renderOrderDrawer();
        return;
      }
    }
  }
  st.binding = false;
  await crmPickChat(o, { chatId:id, name:(who && who.name) || '',
                         nick:(who && who.nick) || '', channel:(who && who.channel) || '' });
}
/* Привʼязати розмову до картки — і перенести в неї те, що в розмові вже
   відоме. Порожні поля картки заповнюємо, заповнені не чіпаємо: людина могла
   виправити імʼя руками, і затирати правку відповіддю CRM не можна. */
async function crmPickChat(o, r){
  if(!canBindChat()){ toast('Привʼязувати розмови — не ваша зона'); return; }
  o.crmChatId = String(r.chatId);
  o.crmChatName = r.name || r.nick || '';
  /* НІК ЗБЕРІГАЄМО ОКРЕМО, А НЕ ЛИШЕ В ПОЛІ INSTAGRAM.

     У полі Instagram він опиняється тільки тоді, коли розмова справді
     звідти, — і це правильно, бо в Telegram чи Viber він там був би
     неправдою. Але знайти людину за ніком треба однаково, хай би з якого
     каналу вона писала: імʼя профілю міняють, нік — майже ніколи.

     Тому кладемо його своїм полем. Воно ні з чим не конкурує й нічого не
     затирає: це просто те, чим підписана розмова. */
  if(r.nick) o.crmNick = String(r.nick).replace(/^@/, '');
  if(r.name && !String(o.name || '').trim()) o.name = r.name;
  /* Нік кладемо в поле Instagram лише тоді, коли розмова справді звідти. Якщо
     Sitniks каже «Viber» чи «Facebook», нік у цьому полі був би неправдою —
     тоді досить імені співрозмовника, яке підставить chanFill. */
  if(r.nick && !String(o.ig || '').trim() && !/^(Telegram|Viber|WhatsApp|Facebook)$/.test(r.channel || ''))
    chanSet(o, 'ig', r.nick);
  chanFill(o);                       // ніка немає зовсім — лишиться імʼя з розмови
  delete crmSeek[o.id];
  try{ await saveOrderMeta(o); }catch(e){ console.warn(e); }
  crmLoadChat(o);
}
async function crmUnlink(o){
  delete o.crmChatId; delete o.crmChatName; delete o.crmNick;
  crmForget(o);
  try{ await saveOrderMeta(o); }catch(e){ console.warn(e); }
  renderOrderDrawer();
}
/* Читання стрічки привʼязаного чату — без пошуку замовлення за номером:
   у діалогу з Instagram номера ще немає. */
async function crmLoadChat(o){
  const chatId = o.crmChatId;
  if(!chatId) return;
  crmChat[o.id] = { chatId, clientName: o.crmChatName || '', loading: true };
  renderOrderDrawer();
  if(chatWin && chatWin.id === o.id) renderChatWin();
  const st = { chatId, clientName: o.crmChatName || '' };
  try{
    const r = await crmFetchMsgs(chatId);
    st.rawMsgs = r.first; st.rawAll = r.arr; st.pageInfo = r.info;
    const msgs = crmNormMsgs(r.arr || r.first, o);
    if(msgs) st.msgs = msgs;
    else st.noHistory = 'відповідь без списку повідомлень';
  }catch(e){
    st.noHistory = (e.status === 404 || e.status === 405)
      ? ('код ' + e.status) : (e.message || 'не вдалось');
  }
  crmChat[o.id] = st;
  renderOrderDrawer();
  if(chatWin && chatWin.id === o.id) renderChatWin();
}

function crmBlockHtml(o){
  const st = crmChat[o.id] || {};
  const num = o.crmOrder || '';
  // Чат привʼязали пошуком за інстаграмом — номер замовлення тут уже ні до
  // чого, показуємо самого співрозмовника і спосіб відчепити його від картки.
  const head = o.crmChatId
    ? `<div class="od-crm-linked">
         <span class="od-crm-who">${crmWhoHtml(o)}</span>
         <button class="od-crm-load">Оновити</button>
         ${crmCanUnlink() ? '<button class="od-crm-unlink">Відвʼязати</button>' : ''}
       </div>`
    : `<div class="od-crm-top">
         <input class="od-f od-crm-num" data-f="crmOrder" type="text" inputmode="numeric"
                placeholder="номер замовлення в Sitniks" value="${escapeHtml(num)}">
         <button class="od-crm-load">${st.chatId ? 'Оновити' : 'Підтягнути'}</button>
       </div>`;
  const wrap = (inner) => `<div class="od-crm">${inner}</div>`;

  if(!crmBase()){
    return wrap(head + `<div class="od-empty">Спершу вкажіть адресу воркера Sitniks:
      Конструктор сайту → «Sitniks CRM».</div>`);
  }
  if(!num && !o.crmChatId) return '';
  if(st.loading) return wrap(head + `<div class="od-empty">Завантажуємо…</div>`);
  if(st.err) return wrap(head + `<div class="od-crm-err">${escapeHtml(st.err)}</div>`);
  if(!st.chatId) return wrap(head + `<div class="od-empty">Натисніть «Підтягнути».</div>`);

  const who = st.clientName ? `<div class="od-crm-who">${escapeHtml(st.clientName)}</div>` : '';
  let feed;
  if(st.noHistory){
    // Найчастіший і найнеприємніший випадок: писати можна, читати — ні.
    feed = `<div class="od-crm-note">Sitniks не віддає історію листування (${escapeHtml(st.noHistory)}).
      Написати клієнту звідси можна, а прочитати попередні повідомлення — лише в самому Sitniks.</div>`;
  } else if(!(st.msgs || []).length){
    // Порожньо з двох різних причин, і плутати їх не можна: або чат справді
    // порожній, або повідомлення прийшли, але текст лежить у полі, якого ми
    // не знаємо. У другому випадку одразу показуємо, які там поля.
    const n = (st.msgs && st.msgs.rawCount) || 0;
    feed = n
      ? `<div class="od-crm-note">Sitniks повернув ${n} ${n===1?'повідомлення':'повідомлень'},
           але текст лежить у незнайомому полі. Поля запису:
           <b>${escapeHtml(((st.msgs.rawKeys)||[]).join(', ') || '—')}</b>.
           Надішліть цей рядок розробнику — і стрічка запрацює.</div>`
      : `<div class="od-empty">Повідомлень поки немає.</div>`;
  } else {
    // Найновіше внизу — як у будь-якому месенджері. Дату показуємо смужкою
    // між днями, а не біля кожного рядка: інакше вона з'їдає саму розмову.
    feed = `<div class="od-crm-feed">${chatRowsHtml(chatMsgs(o, 'crm'))}</div>`;
  }

  return wrap(head + `<div class="od-crm-bar">${who || '<span></span>'}` +
    `<button class="od-open-chat" data-chat="crm">Відкрити діалог</button></div>` + feed + `
    <div class="od-crm-send">
      <textarea class="od-crm-inp" rows="2" placeholder="Написати клієнту…">${escapeHtml(st.draft || '')}</textarea>
      <button class="od-crm-go" title="Ctrl+Enter">Надіслати</button>
    </div>`);
}

function crmFilesHtml(files){
  if(!files || !files.length) return '';
  return files.map(f => {
    const u = escapeHtml(f.url);
    if(f.kind === 'audio')
      return `<audio controls preload="none" class="od-crm-audio" src="${u}"></audio>`;
    if(f.kind === 'video')
      return `<video controls preload="metadata" class="od-crm-img" src="${u}"></video>`;
    // Розширення відоме — картинка або нічого. Тип невідомий («media») —
    // пробуємо картинкою, далі аудіо: голосові з Instagram приходять саме так.
    if(f.kind === 'img' || f.kind === 'media')
      return `<img class="od-crm-img" src="${u}" loading="lazy" alt="вкладення"
                   onclick="window.open(this.src,'_blank')"
                   onerror="window.crmMediaFallback(this, this.src, '${f.kind === 'media' ? 'audio' : 'link'}')">`;
    return `<a class="od-crm-link" href="${u}" target="_blank" rel="noopener">
              ${f.kind === 'file' ? 'Файл' : 'Посилання'} — відкрити ↗</a>`;
  }).join('');
}

/* «Сьогодні» й «вчора» читаються швидше за дату — саме їх менеджер шукає очима. */
/* ══ ВСЯ ПЕРЕПИСКА, А НЕ ОСТАННІ ДЕСЯТЬ (06.10) ══

   Андрій: «частину даних Sitniks не перегрузили». `/chats/{id}/messages`
   віддає лише ОСТАННЮ сторінку — десять повідомлень, — і все, що раніше
   (перше звернення, фото клієнта), до CRM не доходило зовсім. Тому й
   видалене не було з чим показати: його ми ніколи не бачили.

   Документація Sitniks закрита, тож параметр гортання шукаємо один раз
   перебором: спершу — чи можна попросити більшу сторінку, далі — як
   попросити наступну. Знайдений спосіб памʼятаємо (у вкладці й у браузері)
   і далі гортаємо ним одразу. Невідомий параметр Sitniks просто ігнорує й
   віддає ту саму першу сторінку, тож «спрацювало» = прийшли повідомлення,
   яких у нас ще не було. */
const CRM_PAGE_MAX = 40;               // запас: 40 сторінок — тисячі повідомлень
/* Розмір сторінки: невідомий параметр Sitniks ігнорує, а завеликий може
   відхилити (400) — тому кілька значень. */
const CRM_SIZE_TRY = ['limit=50', 'limit=100', 'limit=20', 'perPage=50', 'pageSize=50',
                      'per_page=50', 'take=50', 'size=50', 'count=50'];
/* Як попросити наступну сторінку. id:/at: — «старші за найстаріше, яке
   вже маємо» (за номером повідомлення або за датою). */
const CRM_NEXT_TRY = ['offset', 'skip', 'page', 'page0', 'pageNumber',
                      'id:before', 'id:beforeId', 'id:lastId', 'id:lastMessageId', 'id:fromId', 'id:cursor',
                      'at:before', 'at:beforeDate', 'at:dateTo', 'at:to', 'at:until', 'at:olderThan', 'cursor'];
let crmPageWay = null;
try{ crmPageWay = JSON.parse(localStorage.getItem('crmPageWay2') || 'null'); }catch(e){}
function crmMsgArr(d){
  return Array.isArray(d) ? d
    : (Array.isArray(d && d.items) ? d.items
    : (Array.isArray(d && d.data) ? d.data
    : (Array.isArray(d && d.messages) ? d.messages
    : (Array.isArray(d && d.results) ? d.results : null))));
}
function crmRawId(m){
  if(!m || typeof m !== 'object') return String(m || '');
  const id = m.id || m._id || m.messageId || m.message_id || m.mid || m.externalId;
  return id ? 'i:' + id : 'k:' + String(crmPick(m, CRM_AT_KEYS) || '') + '|' +
    String(crmPick(m, CRM_TXT_KEYS) || m.attachmentUrl || '').slice(0, 120);
}
function crmRawAt(m){ return (m && typeof m === 'object') ? crmTime(crmPick(m, CRM_AT_KEYS)) : 0; }
function crmCursorOf(d){
  if(!d || typeof d !== 'object' || Array.isArray(d)) return '';
  const meta = d.meta || d.pagination || d.paging || d;
  return String(meta.nextCursor || meta.next_cursor || meta.cursor || meta.next || '');
}
/* Запит n-ї сторінки (n ≥ 2). got — скільки вже маємо, old — найстаріше. */
function crmWayQuery(way, n, got, old, cursor){
  const q = [];
  if(way.size) q.push(way.size);
  const per = way.per || 10;
  const nx = way.next || '';
  if(nx === 'offset' || nx === 'skip'){ q.push(nx + '=' + got); if(!way.size) q.push('limit=' + per); }
  else if(nx === 'page') q.push('page=' + n);
  else if(nx === 'page0') q.push('page=' + (n - 1));
  else if(nx === 'pageNumber') q.push('pageNumber=' + n);
  else if(nx.indexOf('id:') === 0){ if(!old.id) return null; q.push(nx.slice(3) + '=' + encodeURIComponent(old.id)); }
  else if(nx.indexOf('at:') === 0){ if(!old.at) return null; q.push(nx.slice(3) + '=' + encodeURIComponent(old.at)); }
  else if(nx === 'cursor'){ if(!cursor) return null; q.push('cursor=' + encodeURIComponent(cursor)); }
  return q.join('&');
}
async function crmFetchMsgs(chatId){
  const base = '/chats/' + encodeURIComponent(chatId) + '/messages';
  const first = await crmFetch(base);
  const arr0 = crmMsgArr(first);
  if(!arr0) return { first, arr: null, info: '' };
  const all = arr0.slice(), seen = {};
  all.forEach(m => { seen[crmRawId(m)] = 1; });
  const add = list => {
    let n = 0;
    (list || []).forEach(m => { const k = crmRawId(m); if(seen[k]) return; seen[k] = 1; all.push(m); n++; });
    return n;
  };
  const oldest = () => {
    let best = null, bt = Infinity;
    all.forEach(m => { const t = crmRawAt(m); if(m && typeof m === 'object' && t && t < bt){ bt = t; best = m; } });
    const m = best || all[all.length - 1];
    if(!m || typeof m !== 'object') return {};
    return { id: String(m.id || m._id || m.messageId || ''), at: String(crmPick(m, CRM_AT_KEYS) || '') };
  };
  /* Журнал спроб — що відповів Sitniks на кожен параметр. Видно в «{ }»:
     коли гортання не знайдеться, саме тут стоятиме причина (напр. «400:
     limit must be ≤ 30»), і вгадувати вдруге не доведеться. */
  const log = [];
  const ask = async (q, label) => {
    try{
      const d = await crmFetch(base + (q ? '?' + q : ''));
      const list = crmMsgArr(d);
      const n = add(list);
      log.push((label || q) + ' → ' + (list ? list.length : 'не список') + ', нових ' + n);
      return { d, n };
    }catch(e){
      log.push((label || q) + ' → ' + String(e.message || e).slice(0, 90));
      return { d: null, n: 0, err: e };
    }
  };
  let info = 'сторінка 1: ' + arr0.length;
  if(!arr0.length) return { first, arr: all, info };
  let way = crmPageWay, cursor = crmCursorOf(first), n = 0;
  if(way){
    if(way.size){ const r = await ask(way.size + (way.next === 'page0' ? '&page=0' : '')); if(r.d) cursor = crmCursorOf(r.d) || cursor; }
    n = way.next ? 2 : 0;
  } else {
    // Неповна перша сторінка — уся розмова вже тут
    if(arr0.length < 10 && !cursor) return { first, arr: all, info };
    let size = '', per = arr0.length;
    for(const sz of CRM_SIZE_TRY){
      const r = await ask(sz);
      if(r.n){ size = sz; per = (crmMsgArr(r.d) || []).length || per; cursor = crmCursorOf(r.d) || cursor; break; }
    }
    for(const sz of (size ? [size] : ['', 'limit=' + per])){
      for(const next of CRM_NEXT_TRY){
        const w = { size: sz, next, per };
        const q = crmWayQuery(w, 2, all.length, oldest(), cursor);
        if(q == null) continue;
        const r = await ask(q);
        if(r.n){ way = w; if(r.d) cursor = crmCursorOf(r.d) || cursor; break; }
      }
      if(way) break;
    }
    if(!way && size) way = { size, next: '', per };
    if(!way){
      info += ' · гортання Sitniks не знайдено\n' + log.join('\n');
      console.warn('Sitniks: гортання не знайдено', log);
      return { first, arr: all, info };
    }
    crmPageWay = way;
    try{ localStorage.setItem('crmPageWay2', JSON.stringify(way)); }catch(e){}
    n = way.next ? 3 : 0;
  }
  info += ' · спосіб: ' + [way.size, way.next].filter(Boolean).join(' + ');
  // Гортаємо, доки приходить нове
  if(n) for(; n <= CRM_PAGE_MAX; n++){
    const q = crmWayQuery(way, n, all.length, oldest(), cursor);
    if(q == null) break;
    const r = await ask(q);
    if(!r.d) break;
    cursor = crmCursorOf(r.d);
    if(!r.n) break;
  }
  /* Найновіше першим — так, як Sitniks віддає одну сторінку. Стрічку далі
     розвертає crmNormMsgs за першим і останнім, тож порядок мусить бути
     суцільним по всіх сторінках. */
  if(all.every(m => crmRawAt(m))) all.sort((a, b) => crmRawAt(b) - crmRawAt(a));
  info += ' · усього: ' + all.length;
  return { first, arr: all, info };
}

function crmDayLabel(day){
  const d = new Date(day + 'T00:00:00');
  if(isNaN(d)) return day;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if(diff === 0) return 'сьогодні';
  if(diff === 1) return 'вчора';
  return d.toLocaleDateString('uk-UA', { timeZone:'Europe/Kyiv', day:'2-digit', month:'long' });
}
/* Повна позначка часу — для підказки на наведення. «Сьогодні» й «вчора»
   зручні, поки розмова свіжа; коли до неї повертаються через місяць, потрібні
   рівно дата, година, хвилина й секунда. */
/* ЧАС ПЕРЕПИСКИ — ЗА КИЄВОМ (06.10).

   І Sitniks, і наш Telegram-воркер дають час у UTC. Стрічка ж показувала
   його як є: «Яка у вас якість?» стояло о 08:13 там, де клієнтка писала о
   11:13 за Києвом. Усередині час лишається UTC (на ньому рахується вікно
   відповіді й межа прочитаного), а на екран іде київський. */
function crmKyiv(at){
  const t = crmTime(at);
  if(!t) return '';
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Kyiv', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(t))
    .forEach(x => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute;
}
function crmFullStamp(at){
  if(!at) return '';
  const d = new Date(crmTime(at) || at);
  if(isNaN(d)) return String(at);
  return d.toLocaleString('uk-UA', { timeZone:'Europe/Kyiv', day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

/* Форма повідомлення в Sitniks достеменно не відома — документація закрита.
   Тому спершу пробуємо звичні назви полів, а якщо жодна не підійшла, беремо
   найдовший рядок в обʼєкті: у повідомленні це майже завжди сам текст.

   Повертаємо і список, і сирі елементи. Без сирих не можна пояснити випадок
   «прийшло десять повідомлень, а на екрані порожньо» — а саме він найгірший:
   виглядає як зламане, хоча дані є. */
const CRM_TXT_KEYS = ['text','message','body','content','messageText','msg','value','caption'];
const CRM_AT_KEYS  = ['createdAt','created_at','date','time','sentAt','dateCreated','timestamp'];

function crmPick(o, keys){
  for(const k of keys){
    const v = o && o[k];
    if(typeof v === 'string' && v.trim()) return v;
    if(typeof v === 'number' && v) return String(v);
  }
  return '';
}
function crmLongestString(o){
  let best = '';
  Object.keys(o || {}).forEach(k => {
    const v = o[k];
    if(typeof v === 'string' && v.trim().length > best.length) best = v;
  });
  return best.length >= 2 ? best : '';
}
/* Хто підписав повідомлення. Відправник у відповіді Sitniks лежить то вгорі
   запису, то у вкладеному обʼєкті — так само, як людина в самій розмові.
   Порядок навмисний: обʼєкт менеджера йде ПЕРЕД клієнтським, бо в наших
   повідомленнях часто присутні обидва, і клієнт там лише як адресат. */
function crmMsgWho(m){
  const box = [m, m.sender, m.from, m.author, m.user, m.manager,
               m.employee, m.operator, m.client, m.contact]
    .filter(x => x && typeof x === 'object');
  const pick = keys => {
    for(const b of box){
      const v = keys.map(k => b[k]).find(x => typeof x === 'string' && x.trim());
      if(v) return String(v).trim();
    }
    return '';
  };
  return {
    name: pick(['senderName','authorName','managerName','employeeName',
                'clientName','fullName','name','title']),
    nick: pick(['username','userName','login','nickname','nick']).replace(/^@/, '')
  };
}
function crmKeyOf(v){ return String(v || '').trim().toLowerCase().replace(/^@/, ''); }
/* Повідомлення так, як їх прислав Sitniks. Потрібне рівно для одного:
   побачити справжні назви полів у цьому акаунті. Беремо перше й останнє —
   у стрічці вони майже завжди з різних боків, і поле, яким Sitniks їх
   розрізняє, видно з порівняння одразу. */
function crmRawSample(o){
  const d = (crmChat[o.id] || {}).rawMsgs;
  const arr = Array.isArray(d) ? d
    : ((d && (d.items || d.data || d.messages || d.results)) || (d ? [d] : []));
  const list = Array.isArray(arr) ? arr : [arr];
  if(!list.length) return 'Sitniks не прислав жодного повідомлення.';
  const pick = list.length > 1 ? [list[0], list[list.length - 1]] : list;
  const pi = (crmChat[o.id] || {}).pageInfo;
  return (pi ? 'Гортання: ' + pi + '\n— — —\n' : '') + pick.map(x => JSON.stringify(x, null, 1)).join('\n— — —\n').slice(0, 4000);
}
/* Підписи співрозмовника — усе, чим цю людину може бути названо в Sitniks.
   Саме за ними ми й відрізняємо її повідомлення від наших. */
function crmPeerKeys(o){
  return [o && o.crmChatName, o && o.name, o && o.ig, o && o.instagram]
    .map(crmKeyOf).filter(x => x.length >= 2)
    .filter((x, i, a) => a.indexOf(x) === i);
}
/* Памʼять про власні надіслані. Sitniks не позначає повідомлення, які пішли
   через API: у відповіді вони приходять без відправника й зовні нічим не
   відрізняються від клієнтських. Через це лист, який менеджер щойно написав
   з Loomiq, ставав ЛІВОРУЧ — і розмова знову читалась неправильно.

   Тримаємо памʼять у самій картці, а не на час сеансу: до перезавантаження
   адмінки вона жила, після — зникала разом із вкладкою, і вчорашні власні
   листи знову опинялись не з того боку. Заразом памʼятаємо, ХТО писав. */
const CRM_OUT_KEEP = 60;
function crmOutKey(t){ return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 160); }
/* Кожне надіслане запамʼятовуємо КІЛЬКОМА ключами: цілим текстом і окремо
   кожною адресою, яка в ньому була.

   Без адрес картинка від нас ставала ліворуч, як клієнтська. Відправляли ми
   «підпис\nhttps://…», а читаючи стрічку назад, адресу з тексту вирізаємо —
   інакше повідомлення було б простирадлом на двісті символів замість фото.
   Виходило, що шукаємо ключ із адресою, маючи на руках текст уже без неї.
   А в картинки без підпису після вирізання не лишалось узагалі нічого, чим
   її впізнати. Разом із боком губилось і імʼя менеджера: воно лежить у
   цьому ж записі.

   Тому ключів кілька, і достатньо збігу за будь-яким. */
function crmOutKeys(text){
  const whole = crmOutKey(text);
  const urls = String(text || '').match(CRM_URL_RE) || [];
  const rest = crmOutKey(urls.reduce((s, u) => s.replace(u, ''), String(text || '')));
  return [whole, rest].concat(urls.map(crmOutKey)).filter((k, i, a) => k && a.indexOf(k) === i);
}
/* ТА САМА ПАМʼЯТЬ, АЛЕ ЩЕ Й НА ЧАС ВКЛАДКИ.

   Запис у картці потрібен на завтра — щоб і після перезавантаження було
   видно, хто що писав. Але сама картка між тим ЗАМІНЮЄТЬСЯ: знімок бази
   приходить за секунду після відправки й привозить ще ту версію, у якій
   нашого запису немає. Доки збереження долетить назад, власне
   повідомлення встигає стати ліворуч і без підпису — саме це й було
   видно в робочій адмінці.

   Тому та сама прикмета лежить ще й тут, у вкладці. Вона переживає будь-
   яку підміну картки, а в базу пишеться своєю чергою. */
const crmOutHere = {};
/* ЖИВА КАРТКА, А НЕ ТА КОПІЯ, ЩО ПІД РУКОЮ (19.10).

   Аркуш із дошки дизайну, картку з КП, лист із будь-якого місця поза
   відкритим вікном діалогу шлють із ТІЄЇ копії замовлення, яку те місце
   тримало на час малювання. А масив замовлень тим часом підміняється
   знімком бази — від обходу розмов, від чужої правки, від автозапису.
   Запис «це наше» лягав у копію, якої вже ніхто не збереже, і після
   перезавантаження (чи на іншому компʼютері) наш текст і наші аркуші
   ставали ліворуч, як клієнтські. Андрій: «це все плутає менеджера».

   Тому кожен запис памʼяті йде у ЖИВУ картку за номером, картка на час
   відправки тримається від підміни знімком (crmHold → ordersHeld), а
   збереження в базу ставиться в чергу тут же, не покладаючись на того,
   хто кликав. */
function crmLive(o){
  if(!o || !o.id) return o;
  try{ return (orders || []).find(x => x && x.id === o.id) || o; }catch(e){ return o; }
}
const crmHold = {};
function crmHeldIds(){ const now = Date.now(); return Object.keys(crmHold).filter(k => crmHold[k] > now); }
const crmSaveT = {};
function crmKeep(o){
  const id = o && o.id; if(!id) return;
  crmHold[id] = Date.now() + 30000;
  clearTimeout(crmSaveT[id]);
  crmSaveT[id] = setTimeout(() => {
    try{ if(typeof saveOrders === 'function') saveOrders({ quiet:true }).catch(e => console.warn('памʼять розмови', e)); }
    catch(e){ console.warn('памʼять розмови', e); }
  }, 400);
}
function crmOutList(o){
  const own = Array.isArray(o && o.crmOut) ? o.crmOut : [];
  const here = (o && crmOutHere[o.id]) || [];
  if(!here.length) return own;
  /* Картка й памʼять вкладки тримають ті самі записи — без дублів (20.10). */
  const було = {};
  return own.concat(here).filter(r => r && !було[r.t] && (було[r.t] = 1));
}
function crmOutPush(o, rec){
  if(!o || !rec || !rec.t) return;
  const live = crmLive(o);
  [o, live].filter((x, i, a) => a.indexOf(x) === i).forEach(x => {
    const list = Array.isArray(x.crmOut) ? x.crmOut : (x.crmOut = []);
    if(!list.some(r => r && r.t === rec.t)) list.push(rec);
    if(list.length > CRM_OUT_KEEP) x.crmOut = list.slice(-CRM_OUT_KEEP);
  });
  crmKeep(o);
  const here = crmOutHere[o.id] || (crmOutHere[o.id] = []);
  if(!here.some(r => r && r.t === rec.t)) here.push(rec);
  if(here.length > CRM_OUT_KEEP) crmOutHere[o.id] = here.slice(-CRM_OUT_KEEP);
}
function crmOutNote(o, text){
  if(!o) return;
  const by = myName();
  crmOutKeys(text).forEach(k => crmOutPush(o, { t: k, by: by }));
}
/* КАРТИНКА ВІД НАС — ПРАВОРУЧ.

   Памʼять за адресою на картинках не спрацьовує ніколи, і це не недогляд,
   а влаштування Sitniks: нашу адресу він клієнту не переказує, а ЗАБИРАЄ
   картинку до себе й у стрічці віддає її вже своєю, на CDN Instagram. Ми
   ж звіряли ту, що надсилали, — рядки різні завжди, збігу не було жодного
   разу, і власне фото ставало ліворуч, як клієнтське.

   Тому беремо прикмети, які від адрес не залежать:

     — НОМЕР повідомлення з відповіді Sitniks на нашу ж відправку. Точна
       прикмета: збіг за нею — це знання, а не здогад;
     — МИТЬ відправки — лише якщо номера у відповіді не виявилось. Тоді
       наше те повідомлення з вкладенням, що зʼявилось у стрічці поруч із
       нашою відправкою. Здогад, і він може помилитись на клієнтському
       фото, надісланому тієї ж хвилини, — тому це запасний шлях, і
       вмикається він сам, тільки коли номера немає. */
const CRM_OUT_WIN = 120000;
function crmOutId(res){
  if(!res || typeof res !== 'object') return '';
  const d = res.data || res.message || res.result || res;
  const v = d && (d.id || d.messageId || d.message_id || d.uuid);
  return (v == null || v === '') ? '' : String(v);
}
/* `pic` — це відправка КАРТИНКИ (20.10). Без номера від Sitniks лише така
   відправка має право забрати собі вкладення зі стрічки за часом. Текст,
   надісланий без номера, вкладень не забирає: доти він забирав, і фото
   клієнта, що прийшло в ту саму хвилину, ставало «нашим». */
function crmOutSent(o, res, pic){
  if(!o) return '';
  const id = crmOutId(res);
  const rec = { t: id ? ('#' + id) : ('@' + Date.now()), by: myName() };
  if(pic && !id) rec.f = 1;
  crmOutPush(o, rec);
  return id;
}
function crmOutOwn(o, m, files, заЧасом){
  const list = crmOutList(o);
  if(!list.length || !m || typeof m !== 'object') return null;
  const id = m.id || m.messageId || m.message_id || m.uuid;
  if(id != null && id !== ''){
    for(let i = list.length - 1; i >= 0; i--)
      if(list[i] && list[i].t === '#' + id) return list[i];
  }
  // За часом — лише вкладення: текст ми впізнаємо самим текстом, точно.
  if(!(files && files.length)) return null;
  return (заЧасом && заЧасом.get(m)) || null;
}
/* ЗА ЧАСОМ — ОДНА ВІДПРАВКА, ОДНЕ ФОТО (20.10). Андрій: «цю фотку надіслав
   клієнт, а вона показується з нашого боку». Доти кожне вкладення в межах
   двох хвилин від нашої відправки ставало нашим — і скріншот, яким клієнт
   відповів на ескіз через хвилину, ставав праворуч. Тепер кожна наша
   відправка без номера забирає рівно одне повідомлення з вкладенням —
   найближче за часом, — і не те, під яким стоїть підпис самого клієнта. */
function crmOutTimePick(o, arr){
  const out = new Map();
  /* Одна відправка може лежати в памʼяті двічі (копія картки й жива) —
     рахуємо її один раз, інакше вона «забирала» б два фото. */
  const було = {};
  const list = crmOutList(o).filter(r => r && r.f && String(r.t).charAt(0) === '@' && !було[r.t] && (було[r.t] = 1));
  if(!list.length || !Array.isArray(arr)) return out;
  const peer = crmPeerKeys(o);
  const ids = {};
  crmOutList(o).forEach(r => { if(r && String(r.t).charAt(0) === '#') ids[String(r.t).slice(1)] = 1; });
  const кандидати = arr.filter(m => {
    if(!m || typeof m !== 'object') return false;
    const id = m.id || m.messageId || m.message_id || m.uuid;
    if(id != null && ids[String(id)]) return false;
    const є = (Array.isArray(m.attachments) && m.attachments.length) ||
              (typeof m.attachmentUrl === 'string' && /^https?:/.test(m.attachmentUrl));
    if(!є || !Date.parse(crmPick(m, CRM_AT_KEYS) || '')) return false;
    const who = crmMsgWho(m);
    const sign = [(who || {}).name, (who || {}).nick].map(crmKeyOf).filter(Boolean);
    return !(peer.length && sign.some(s2 => peer.some(pk => s2 === pk || s2.indexOf(pk) >= 0 || pk.indexOf(s2) >= 0)));
  });
  const взято = new Set();
  list.forEach(r => {
    const ms = +String(r.t).slice(1);
    if(!ms) return;
    let best = null, bd = Infinity;
    кандидати.forEach(m => {
      if(взято.has(m)) return;
      const d = Math.abs(Date.parse(crmPick(m, CRM_AT_KEYS)) - ms);
      if(d <= CRM_OUT_WIN && d < bd){ bd = d; best = m; }
    });
    if(best){ взято.add(best); out.set(best, r); }
  });
  return out;
}
function crmOutFind(o, text, files){
  const list = crmOutList(o);
  if(!list.length) return null;
  /* Шукаємо і за текстом, і за адресами вкладень — саме вони лишаються
     єдиною прикметою повідомлення, у якому крім картинки нічого немає. */
  const keys = crmOutKeys(text)
    .concat((files || []).map(f => crmOutKey(f && f.url)))
    .filter(Boolean);
  for(let i = list.length - 1; i >= 0; i--)
    if(list[i] && keys.indexOf(list[i].t) >= 0) return list[i];
  return null;
}
/* Наше повідомлення чи клієнтське. Прямі ознаки — першими: коли Sitniks
   сказав словом, віримо йому.

   Коли не сказав — звіряємо підпис із тим, з ким ця розмова. Це працює без
   знання назв полів: підписався клієнт — ліворуч, підписався хтось інший —
   значить хтось із нас, праворуч, і його імʼя ми заразом і показуємо.

   Раніше тут був тільки перебір звичних назв поля «вихідне». У робочому
   акаунті не збіглась жодна, і вся розмова ставала ліворуч: читати, хто
   кому що написав, було неможливо.

   Останній рубіж — памʼять про те, що ми самі відправили з цієї картки. */
const crmSent = new Set();
function crmIsMine(m, text, who, peer){
  if(m.isOutgoing || m.outgoing || m.fromManager || m.isManager || m.isMine || m.mine) return true;
  if(m.isIncoming === true || m.incoming === true || m.fromClient === true) return false;
  if(m.isIncoming === false || m.incoming === false) return true;
  const words = [m.direction, m.type, m.senderType, m.sender, m.author, m.from, m.side, m.who]
    .filter(v => typeof v === 'string').join(' ').toLowerCase();
  if(/\b(out|outgoing|manager|operator|admin|shop|company|staff)\b/.test(words)) return true;
  if(/\b(in|incoming|client|customer|contact|lead)\b/.test(words)) return false;
  const sign = [(who || {}).name, (who || {}).nick].map(crmKeyOf).filter(Boolean);
  if((peer || []).length && sign.length)
    return !sign.some(s => peer.some(pk => s === pk || s.indexOf(pk) >= 0 || pk.indexOf(s) >= 0));
  return crmSent.has(String(text).trim());
}
/* Вкладення приходять голим посиланням просто в тексті — і повідомлення
   перетворювалось на простирадло з двохсот символів адреси. Витягуємо їх
   і показуємо тим, чим вони є: фото — фотографією, голосове — плеєром.

   Тип часто не вгадати: CDN Instagram віддає адреси взагалі без розширення.
   Тому пробуємо показати картинкою, а якщо браузер не зміг — перемикаємось
   на аудіо, і лише потім на звичайне посилання. */
const CRM_URL_RE = /https?:\/\/[^\s<>"']+/g;

function crmFileKind(u){
  const clean = String(u).split('?')[0].toLowerCase();
  if(/\.(jpe?g|png|webp|gif|bmp|heic|avif)$/.test(clean)) return 'img';
  if(/\.(mp3|ogg|oga|m4a|wav|opus|aac)$/.test(clean))     return 'audio';
  if(/\.(mp4|mov|webm|m4v)$/.test(clean))                  return 'video';
  if(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|ai|psd|cdr|svg|eps)$/.test(clean)) return 'file';
  // Медіа-сховища месенджерів: розширення немає, тип зʼясується при показі
  if(/lookaside\.fbsbx\.com|cdninstagram|fbcdn\.net|scontent|t\.me\/|telegram|viber/.test(u)) return 'media';
  return 'link';
}
/* Вийнявши адресу, прибираємо за нею тільки зайві ПРОБІЛИ. Тут довго стояло
   `replace(/\s+/g, ' ')` — і воно збивало в один рядок усе повідомлення разом
   з абзацами. Лист, який клієнт бачив розбитим на абзаци, у нас виглядав
   суцільною кашею, і прочитати його було неможливо. */
function crmSplitFiles(text){
  const tidy = s => String(s)
    .replace(/[ \t]+/g, ' ')        // подвійні пробіли — так, переноси — ні
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')     // абзац лишається, порожнеча на пів екрана — ні
    .trim();
  const urls = String(text).match(CRM_URL_RE) || [];
  if(!urls.length) return { text: tidy(text), files: [] };
  let rest = String(text);
  urls.forEach(u => { rest = rest.replace(u, ''); });
  return {
    text: tidy(rest),
    files: urls.map(u => ({ url: u, kind: crmFileKind(u) }))
  };
}
/* Показ картинкою не вдався — пробуємо аудіо, далі просте посилання.
   Ланцюжок потрібен саме тому, що тип наперед невідомий. */
window.crmMediaFallback = function(el, url, step){
  const box = document.createElement('div');
  if(step === 'audio'){
    box.innerHTML = '<audio controls preload="none" class="od-crm-audio" src="' +
      url.replace(/"/g, '&quot;') + '"></audio>';
    box.firstChild.addEventListener('error', function(){
      window.crmMediaFallback(box.firstChild, url, 'link');
    });
  } else {
    box.innerHTML = '<a class="od-crm-link" href="' + url.replace(/"/g, '&quot;') +
      '" target="_blank" rel="noopener">Вкладення — відкрити ↗</a>';
  }
  const node = box.firstChild;
  if(el && el.parentNode) el.parentNode.replaceChild(node, el);
};

/* ── ВИДАЛЕНЕ ПОВІДОМЛЕННЯ ЧЕРВОНІЄ, А НЕ ЗНИКАЄ ──────────────────────

   Андрій: «якщо клієнт або ми видалили повідомлення в чаті — щоб воно
   горіло червоним».

   Мовчазне зникнення — найгірше, що може статись із перепискою. Клієнт
   написав вимогу й прибрав її; менеджер пообіцяв термін і стер. Розмова
   після цього виглядає бездоганно, а домовленість була. Хто дивиться в
   чат назавтра, не бачить навіть діри на тому місці.

   Sitniks про видалення не каже нічого (у частини записів трапляється
   позначка, у більшості — ні), тож упізнаємо його самі: повідомлення
   стояло в стрічці й зникло з наступної відповіді. Слід кладемо в саме
   замовлення — інакше він живе рівно до перезавантаження сторінки, тобто
   не живе взагалі.

   ОДНЕ АЛЕ, і воно важливе: відповідь буває обрізаною згори. Усе, що
   давніше за найстаріше повідомлення цієї відповіді, могло просто не
   влізти — і фарбувати його червоним було б наклепом.

   Відрізняємо так. Обрізання йде З ГОЛОВИ й рівно на стільки, на скільки
   виріс хвіст: прийшло три нові репліки — випало три найдавніші. Видалення
   ж виймає повідомлення звідки завгодно й нічого натомість не додає. Тож
   мовчимо лише про ті найдавніші, яких рівно стільки, скільки цього разу
   прибуло нових. Нічого не прибуло — значить нічого й не обрізали, і все
   зникле зникло не саме. */
const CRM_GONE_KEEP = 40;
function crmMsgKey(m){
  return crmOutKey(m && m.text) + '|' +
         (((m && m.files) || []).map(f => (f && f.url) || '').join(' ')).slice(0, 200);
}
function crmMarkGone(o, list){
  if(!o || !Array.isArray(list)) return list;
  const now = {};
  list.forEach(m => { now[crmMsgKey(m)] = 1; });
  const gone = Array.isArray(o.crmGone) ? o.crmGone : (o.crmGone = []);
  /* Наші записи фото (local) — не з Sitniks: їх зникнення — не видалення. */
  const було = ((crmChat[o.id] || {}).msgs || []).filter(m => m && !m.gone && !m.local);
  const булоKeys = {};
  було.forEach(m => { булоKeys[crmMsgKey(m)] = 1; });
  const прибуло = list.filter(m => !булоKeys[crmMsgKey(m)]).length;
  const голова = {};
  if(прибуло) було.slice(0, прибуло).forEach(m => { голова[crmMsgKey(m)] = 1; });
  /* І ЩЕ ОДНА ОБЕРЕЖНІСТЬ. Видаляють по одному, зрідка по два. Коли ж із
     розмови зникає одразу половина, це не видалення, а неповна відповідь:
     Sitniks віддав шматок, збився на сторінці, повернув порожнє поле. Якби
     ми повірили такій відповіді, вся переписка спалахнула б червоним — і
     назад її вже не відбілити, слід лежить у замовленні. Тож мовчимо: не
     показати видалене гірше, ніж показати, але оголосити видаленою цілу
     розмову гірше за все. */
  const зникло = було.filter(m => !now[crmMsgKey(m)] && !голова[crmMsgKey(m)]).length;
  const віримо = !(зникло > 2 && зникло * 3 > було.length);
  if(!віримо) console.warn('Sitniks віддав неповну стрічку (' + зникло + ' із ' +
                           було.length + ') — видаленими не вважаємо');
  let змін = false;
  if(віримо) було.forEach(m => {
    const k = crmMsgKey(m);
    if(!k || k === '|' || now[k]) return;
    if(голова[k]) return;                       // не влізло у відповідь, а не видалено
    if(gone.some(g => g && g.t === k)) return;
    gone.push({ t:k, at:m.at || '', text:m.text || '', mine:!!m.mine, by:m.by || '',
                files:((m.files || []).map(f => f && f.url).filter(Boolean)).slice(0, 4) });
    змін = true;
  });
  /* Повернулось — отже не видаляли: у Sitniks трапляється, що повідомлення
     випадає з однієї відповіді й приїжджає в наступній. Червоне, яке
     зникає саме, гірше за червоне, якого не було. */
  const живі = gone.filter(g => g && !now[g.t]);
  if(живі.length !== gone.length){ змін = true; }
  o.crmGone = (живі.length > CRM_GONE_KEEP) ? живі.slice(-CRM_GONE_KEEP) : живі;
  /* Ставимо назад на своє місце за часом: видалене має читатись там, де
     воно стояло в розмові, а не купкою в кінці. */
  o.crmGone.forEach(g => {
    const row = { text:g.text || '', mine:!!g.mine, by:g.by || '', at:g.at || '', gone:true,
                  files:(g.files || []).map(u => ({ url:u, kind:crmFileKind(u) })) };
    let at = list.length;
    if(g.at) for(let i = 0; i < list.length; i++){
      if(list[i].at && list[i].at > g.at){ at = i; break; }
    }
    list.splice(at, 0, row);
  });
  if(змін) saveOrderMeta(o).catch(e => console.warn('слід видаленого', e));
  return list;
}
function crmNormMsgs(data, o){
  const peer = crmPeerKeys(o);
  let arr = Array.isArray(data) ? data
          : (Array.isArray(data && data.items) ? data.items
          : (Array.isArray(data && data.data) ? data.data
          : (Array.isArray(data && data.messages) ? data.messages
          : (Array.isArray(data && data.results) ? data.results : null))));
  if(!arr) return null;
  const заЧасом = crmOutTimePick(o, arr);
  const list = arr.map(m => {
    if(typeof m === 'string'){
      const sp = crmSplitFiles(m);
      return { text: sp.text, files: sp.files, mine: false, at: '' };
    }
    /* «Найдовший рядок в обʼєкті» — здогад на випадок, коли звичних полів
       тексту немає. Але коли у повідомленні Є вкладення, найдовшим рядком
       там завжди буде його адреса, і картинка ставала «текстом». Тому
       здогадуємось лише тоді, коли вкладень немає. */
    const hasFiles = (Array.isArray(m.attachments) && m.attachments.length) ||
                     (typeof m.attachmentUrl === 'string' && /^https?:/.test(m.attachmentUrl));
    const rawText = crmPick(m, CRM_TXT_KEYS) || (hasFiles ? '' : crmLongestString(m));
    const split = crmSplitFiles(rawText);
    const text = split.text;
    // Вкладення можуть приїхати і окремим полем, не лише в тексті
    const extra = [];
    /* Назви полів тут не вгадані, а взяті з самої відповіді Sitniks:
         attachments:[{ mediaType:'image', mediaUrl:'…' }] і attachmentUrl.
       Доти жодної з них у списках не було, і картинки показувались
       ВИПАДКОВО: текст брався як «найдовший рядок в обʼєкті», а
       найдовшим там якраз і виявлялась адреса вкладення. Працювало, доки
       в повідомленні не траплялось довгого тексту. */
    ['attachments','files','media','photos'].forEach(k => {
      const v = m[k];
      if(Array.isArray(v)) v.forEach(x => {
        const u = (typeof x === 'string') ? x
          : (x && (x.mediaUrl || x.url || x.link || x.src || x.path));
        if(u) extra.push({ url: String(u), kind: crmFileKind(u) });
      });
    });
    ['attachmentUrl','url','fileUrl','imageUrl','photo','image','file'].forEach(k => {
      const v = m[k];
      if(typeof v === 'string' && /^https?:/.test(v)) extra.push({ url: v, kind: crmFileKind(v) });
    });
    /* Одна адреса — одне вкладення. Sitniks кладе ту саму картинку двічі:
       і в `attachmentUrl`, і в `attachments[].mediaUrl`. Без цього кожне
       фото показувалось у стрічці двома однаковими. */
    const seenU = {};
    const files = split.files.concat(extra)
      .filter(f => f && f.url && !seenU[f.url] && (seenU[f.url] = 1));
    const at = crmPick(m, CRM_AT_KEYS);
    // «наше» повідомлення визначаємо за будь-якою з ознак, які зустрічаються
    const who = crmMsgWho(m);
    /* Своє надіслане впізнаємо першими: тут ми знаємо напевно, а не
       здогадуємось за підписом, якого в такому повідомленні немає. */
    const own = crmOutOwn(o, m, files, заЧасом) || crmOutFind(o, text, files);
    const mine = own ? true : crmIsMine(m, text, who, peer);
    /* Підпис ставимо лише під нашими — і лише якщо це справді не клієнт:
       коли в записі є сам тільки клієнт, а «наше» ми вирішили памʼяттю про
       відправлене, його імʼям підписувати наше повідомлення не можна. */
    const byKey = crmKeyOf(who.name);
    const by = own ? String(own.by || '')
      : ((mine && who.name && !peer.some(pk => byKey === pk || byKey.indexOf(pk) >= 0))
          ? who.name : '');
    return { text: String(text), files: files, mine: mine, by: by, ownT: own ? String(own.t || '') : '',
             /* Коли Sitniks усе ж сказав словом, що повідомлення видалене, —
                віримо йому одразу, не чекаючи, поки воно зникне зі стрічки. */
             gone: !!(m.deleted || m.isDeleted || m.is_deleted || m.deletedAt),
             /* id і точний час (до секунди) — для позначки «прочитано». Хвилини
                було замало: клієнт, що відповів у ту саму хвилину, ховався. */
             id: String(m.id || m._id || m.messageId || m.message_id || ''),
             ts: at ? crmTime(String(at)) : 0,
             at: at ? String(at).replace('T',' ').slice(0,16) : '' };
  }).filter(m => m.text || (m.files && m.files.length));
  /* Sitniks віддає найновіше першим, і розмова читалась догори ногами.
     Розвертаємо за датами; якщо дат немає — за самим порядком віддачі. */
  const withAt = list.filter(m => m.at);
  if(withAt.length > 1 && withAt[0].at > withAt[withAt.length - 1].at) list.reverse();
  else if(!withAt.length && list.length > 1) list.reverse();
  /* РАЗ ПОКАЗАНЕ НАШИМ — НАШИМ І ЛИШАЄТЬСЯ.

     Андрій: «вліво пригає знову наше повідомлення». Саме ПРИГАЄ: спершу
     репліка стоїть праворуч, а за секунду, коли стрічку перечитано з
     Sitniks, перестрибує ліворуч і без підпису.

     Бік визначається ланцюжком ознак, і кожна ланка в ньому може не
     спрацювати: прямого поля «вихідне» в цьому акаунті немає, підпис
     приходить клієнтський, памʼять про відправлене живе у вкладці й гине
     при перезавантаженні. Ланцюжок латати марно — він і так із чотирьох
     здогадів.

     Але одне ми знаємо твердо: якщо це повідомлення вже стояло праворуч,
     воно наше. Розмова не переписується заднім числом. Тому бік, показаний
     раніше, перечитуванням не скасовується — і заразом лягає в памʼять
     картки, щоб пережити перезавантаження. */
  const було = ((crmChat[o && o.id] || {}).msgs) || [];
  if(було.length){
    const наші = {};
    було.forEach(m => { if(m && m.mine) наші[crmMsgKey(m)] = String(m.by || ''); });
    list.forEach(m => {
      if(m.mine) return;
      const k = crmMsgKey(m);
      if(!Object.prototype.hasOwnProperty.call(наші, k)) return;
      m.mine = true;
      if(!m.by) m.by = наші[k];
      if(m.text) crmOutNote(o, m.text);
    });
  }
  crmMarkGone(o, list);
  list.rawCount = arr.length;
  list.rawKeys = (arr.length && typeof arr[0] === 'object')
    ? Object.keys(arr[0]).slice(0, 14) : [];
  /* Скільки разів озвався КЛІЄНТ. Число потрібне дошці: по ньому кнопка КП
     розуміє, чи відповіли на надіслані картки. Дошка самої розмови не
     читає, тож кладемо його в замовлення — тут, де стрічку вже розібрано
     на «наше» й «їхнє», і рахувати вдруге ніде не доведеться. */
  /* Лічильники рахуємо по ЖИВИХ репліках. Видалене стоїть у стрічці як
     слід, а не як звернення: рахувати його за «клієнт написав» означало б
     тримати кружечок непрочитаного на тому, чого вже немає. */
  const живі = list.filter(m => !m.gone);
  /* Точний час останньої репліки клієнта — від нього Instagram відлічує
     сім днів на відповідь. Фоновий обхід бачить лише останнє повідомлення
     розмови; тут перед нами вся стрічка, тож число чесніше. */
  const остання = живі.filter(m => !m.mine && m.at).map(m => m.at).sort().pop();
  if(остання && остання !== String(o.crmInAt || '')) o.crmInAt = остання;
  crmNoteIn(o, живі.filter(m => !m.mine).length);
  /* Скільки клієнт написав ПІСЛЯ нашої останньої відповіді. Фоновий обхід
     рахує це спостереженнями й може недорахувати (три репліки за одну
     хвилину він побачить як одну); тут же стрічка перед нами вся, тож
     переписуємо точним числом. */
  /* Прочитане руками (👁) чи «ми відповіли» — межа, далі якої не рахуємо.
     Позначка лишається, доки ми не відповімо: стирати її з першою ж новою
     реплікою не можна — наступний такт порахував би й прочитане, і число
     стрибало б 1 → 4 (16.10, «то зʼявляється, то пропадає»). */
  /* Рахуємо ПІСЛЯ злиття з нашими фото: картинка, якої Sitniks у стрічку
     не повертає, — теж наша відповідь, і вона закриває хвіст. */
  const злита = crmPicsMerge(o, list);
  const tail = crmTailOf(o, (злита || []).filter(m => m && !m.gone));
  if((+o.crmUnread || 0) !== tail) o.crmUnread = tail;
  o.crmTheirs = tail > 0;
  return злита;
}
/* ══════════ НАШІ ФОТО — У СТРІЧЦІ ОДРАЗУ (08.10) ══════════
   Андрій: «фото надсилаються, а в діалозі не показуються, або через хвилин
   5». Текст ставав у стрічку одразу (бульбашка «надсилаю…»), а фото — ні:
   стрічку ми беремо з Sitniks, а власні вкладення Sitniks віддає із
   запізненням або не віддає зовсім.

   Тепер фото — так само, як текст: щойно натиснули «надіслати», воно вже
   стоїть праворуч із позначкою «надсилаю…»; прийнято — позначка зникає.
   Запис живе, доки Sitniks не поверне те саме повідомлення (впізнаємо за
   номером із відповіді, або — коли номера немає — за часом і кількістю
   фото); тоді лишається його копія, без дубля. Не поверне ніколи — наша
   стоїть далі: надіслані (sent) зберігаються в картці (o.crmPicsOut) і
   переживають перезавантаження. Ті, що ще летять, — лише в памʼяті: їхні
   адреси тимчасові (blob:). */
const crmPicsMem = {};
const CRM_PICS_KEEP = 40, CRM_PICS_WIN = 10 * 60000;
function crmPicsAll(o){
  if(!o) return [];
  const saved = Array.isArray(o.crmPicsOut) ? o.crmPicsOut : [];
  const mem = crmPicsMem[o.id] || [];
  return saved.concat(mem.filter(e => !saved.some(x => x.k === e.k)));
}
function crmPicsAdd(o, urls, state){
  const e = { k: 'lp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              at: new Date().toISOString().replace('T', ' ').slice(0, 16), urls: (urls || []).slice(0, 10),
              by: myName(), state: state || 'pending', t: '',
              /* Що вже стояло в стрічці з вкладеннями ДО натиску — це точно
                 не наше нове фото, навіть якщо час і кількість збігаються. */
              pre: (((crmChat[o.id] || {}).msgs) || []).filter(m => m && !m.local && (m.files || []).length)
                     .map(crmMsgKey).slice(-20) };
  (crmPicsMem[o.id] || (crmPicsMem[o.id] = [])).push(e);
  if(e.state === 'sent') crmPicsKeep(o, e);
  return e;
}
/* Надіслане — у картку (з адресами хмари), щоб пережило перезавантаження. */
function crmPicsKeep(o, e){
  const rec = { k: e.k, at: e.at, urls: e.urls, by: e.by, state: 'sent', t: e.t || '', pre: (e.pre || []).slice(-20) };
  const live = crmLive(o);
  [o, live].filter((x, i, a) => a.indexOf(x) === i).forEach(x => {
    const l = Array.isArray(x.crmPicsOut) ? x.crmPicsOut : (x.crmPicsOut = []);
    const i = l.findIndex(y => y.k === e.k);
    if(i >= 0) l[i] = rec; else l.push(rec);
    if(l.length > CRM_PICS_KEEP) x.crmPicsOut = l.slice(-CRM_PICS_KEEP);
  });
  crmKeep(o);
}
function crmPicsDrop(o, k){
  const m = crmPicsMem[o.id]; if(m){ const i = m.findIndex(x => x.k === k); if(i >= 0) m.splice(i, 1); }
  const live = crmLive(o);
  [o, live].forEach(x => { if(x && Array.isArray(x.crmPicsOut)) x.crmPicsOut = x.crmPicsOut.filter(y => y.k !== k); });
}
/* Злити наші записи зі стрічкою Sitniks: впізнане — прибрати (його вже
   показує Sitniks), решту — поставити на своє місце за часом. */
function crmPicsMerge(o, list){
  if(!o || !Array.isArray(list)) return list;
  const all = crmPicsAll(o);
  if(!all.length) return list;
  const used = {};
  const лишити = all.filter(e => {
    if(e.state !== 'sent') return true;          // ще летить — показуємо як є
    const te = crmTime(e.at);
    /* За номером — напевно. Без номера — за часом (±1 хв … +10 хв) і
       кількістю фото: Sitniks може повернути наше без жодної ознаки, що
       воно наше, — тоді воно й стане нашим (праворуч, з підписом). */
    const pre = {}; (e.pre || []).forEach(k => { pre[k] = 1; });
    const hit = list.findIndex((m, i) => !used[i] && m && !m.local && !m.gone && (m.files || []).length &&
      ((e.t && m.ownT === e.t) ||
       !pre[crmMsgKey(m)] && !(m.ownT && m.ownT !== e.t && m.ownT.charAt(0) === '#') &&
       (!e.t || !list.some(x => x && x.ownT === e.t)) && te && crmTime(m.at) &&
        crmTime(m.at) >= te - 60000 && crmTime(m.at) - te <= CRM_PICS_WIN &&
        (m.files || []).length === (e.urls || []).length && (m.mine || !m.text)));
    if(hit < 0){
      /* ПАЧКА ПОВЕРТАЄТЬСЯ ПООДИНЦІ (15.10). Три картки ми шлемо одним
         повідомленням, а Sitniks віддає їх трьома — по картинці в кожному.
         Тоді збіг «стільки ж файлів» не знаходився ніколи, і наш запис
         лишався поруч із серверними: картки двічі, одні з ✓, інші з ✓✓.
         Шукаємо кілька наших (або безтекстових) повідомлень у тому самому
         вікні часу, що разом дають рівно стільки картинок. */
      const треба = (e.urls || []).length;
      if(!te || треба < 2) return true;
      const кандидати = [];
      list.forEach((m, i) => {
        if(used[i] || !m || m.local || m.gone || !(m.files || []).length) return;
        if(pre[crmMsgKey(m)] || !(m.mine || !m.text)) return;
        if(m.ownT && m.ownT.charAt(0) === '#' && m.ownT !== e.t) return;
        const tm = crmTime(m.at);
        if(!tm || tm < te - 60000 || tm - te > CRM_PICS_WIN) return;
        кандидати.push(i);
      });
      let n = 0; const взяті = [];
      for(const i of кандидати){ if(n >= треба) break; n += list[i].files.length; взяті.push(i); }
      if(n !== треба) return true;
      взяті.forEach(i => { used[i] = 1; if(!list[i].mine){ list[i].mine = true; if(!list[i].by) list[i].by = e.by || ''; } });
      crmPicsDrop(o, e.k);
      return false;
    }
    used[hit] = 1;
    if(!list[hit].mine){ list[hit].mine = true; if(!list[hit].by) list[hit].by = e.by || ''; }
    crmPicsDrop(o, e.k);
    return false;
  });
  const out = list.filter(m => !(m && m.local));
  лишити.forEach(e => {
    const msg = { text: '', files: (e.urls || []).map(u => ({ url: u, kind: 'img' })), mine: true, by: e.by || '',
                  at: e.state === 'pending' ? '' : e.at, pending: e.state === 'pending', local: e.k, lt: e.t || '' };
    const te = crmTime(e.at);
    const at = te ? out.findIndex(m => m && !m.local && crmTime(m.at) > te) : -1;
    if(at >= 0) out.splice(at, 0, msg); else out.push(msg);
  });
  ['rawCount', 'rawKeys'].forEach(k => { if(list[k] != null) out[k] = list[k]; });
  return out;
}
/* Перемалювати стрічку з нашими записами — без запиту до Sitniks. */
function crmPicsShow(o){
  const st = crmChat[o.id] || (crmChat[o.id] = { chatId: crmChatIdOf(o) });
  st.msgs = crmPicsMerge(o, (st.msgs || []).filter(m => !(m && m.local)));
  renderOrderDrawer();
  if(chatWin && chatWin.id === o.id && chatWin.kind === 'crm') renderChatWin(true);
}
function crmNoteIn(o, n){
  if(!o || !(n >= 0) || (+o.crmIn || 0) === n) return;
  // Клієнт озвався — картка вгору. Так само, як у Telegram, і з тією самою
  // умовою: піднімаємо лише коли реплік стало більше, ніж ми вже знали.
  if(o.crmIn != null && n > (+o.crmIn || 0)) touchOrder(o);
  o.crmIn = n;
  saveOrders({ quiet:true }).then(renderBoard).catch(e => console.warn('лічильник реплік', e));
}

async function crmLoad(o, numFromInput){
  /* Номер беремо з поля, а не з картки: якщо менеджер вписав його і одразу
     натиснув кнопку, до картки він ще не встиг зберегтись. Раніше в такому
     разі кнопка просто мовчала. */
  const num = String(numFromInput != null ? numFromInput : (o.crmOrder || '')).trim();
  if(!num){ toast('Впишіть номер замовлення з Sitniks'); return; }
  if(o.crmOrder !== num){ o.crmOrder = num; saveOrderMeta(o).catch(function(){}); }
  crmChat[o.id] = { loading: true };
  renderOrderDrawer();
  try{
    const ord = await crmFetch('/orders/' + encodeURIComponent(num));
    const st = {
      chatId: ord.chatId || '',
      clientName: ord.clientName || '',
      raw: ord            // весь обʼєкт лишаємо: у ньому шукати поле каналу
    };
    if(!st.chatId){
      st.err = 'Замовлення знайдено, але в ньому немає chatId — переписки для нього Sitniks не веде.';
      crmChat[o.id] = st; renderOrderDrawer(); return;
    }
    try{
      const r = await crmFetchMsgs(st.chatId);
      const data = r.first;
      st.rawAll = r.arr; st.pageInfo = r.info;
      console.log('Sitniks: замовлення', ord, '· повідомлення', data, '·', r.info);
      // Окремим рядком і без розгортання: назви полів потрібні, щоб точно
      // визначати автора повідомлення, а не вгадувати його за ознаками.
      try{
        const one = Array.isArray(data) ? data[0]
                  : (data && (data.items || data.data || data.messages || data.results) || [])[0];
        if(one && typeof one === 'object')
          console.log('Sitniks: поля повідомлення →', Object.keys(one).join(', '));
        console.log('Sitniks: поля замовлення →', Object.keys(ord || {}).join(', '));
      }catch(e){}
      st.rawMsgs = data;
      const msgs = crmNormMsgs(r.arr || data, o);
      if(msgs) st.msgs = msgs;
      else st.noHistory = 'відповідь без списку повідомлень';
    }catch(e){
      // 404/405 означають «такого читання немає» — це не поломка, а межа API
      st.noHistory = (e.status === 404 || e.status === 405)
        ? ('код ' + e.status) : (e.message || 'не вдалось');
    }
    crmChat[o.id] = st;
  }catch(e){
    crmChat[o.id] = { err: e.message || 'не вдалось звʼязатись із Sitniks' };
  }
  renderOrderDrawer();
}

/* ── КАРТИНКА В SITNIKS: ЯК СПРАВЖНЄ ВКЛАДЕННЯ ───────────────────────────
   ПРОБЛЕМА. Картка, надіслана клієнту, приходила в Instagram синім
   посиланням. Клієнт має натиснути, дочекатись, роздивитись у браузері —
   і більшість не натискає. Заради того, щоб картку ПОБАЧИЛИ в стрічці, її
   й малюють.

   ЧОМУ ТАК БУЛО. У коді стояв коментар «Sitniks приймає від нас лише
   текст». Це був не перевірений факт, а здогад: у README перелічено три
   ендпоінти, перевірені в бою, і відправка вкладень серед них навіть не
   пробувалась. А власний застосунок Sitniks картинки надсилає — отже
   спосіб існує.

   ЧОМУ ПЕРЕБІР, А НЕ ОДИН ЗАПИТ. Документація Sitniks закрита. Назву поля
   не можна вгадати з першого разу, а перевірити її можна тільки на живому
   акаунті з живою розмовою — тобто не тут, а в менеджера за роботою. Тому
   код пробує способи по черзі сам, а той, що спрацював, запамʼятовує в
   налаштуваннях і далі йде одразу ним.

   ЯК ВІДРІЗНЯЄМО «ПРИЙНЯВ» ВІД «СПРАЦЮВАЛО». Відповідь 200 нічого не
   доводить: сервер міг мовчки проковтнути невідоме поле й надіслати
   порожнє повідомлення. Тому після кожної спроби ПЕРЕЧИТУЄМО стрічку й
   дивимось, чи побільшало в ній повідомлень із вкладенням. Побільшало —
   спосіб знайдено.

   ЧОМУ БЕЗ ПІДПИСУ. Картинку шлемо саму, а текст окремим повідомленням
   перед нею. По-перше, так і пишуть у Direct: рядок тексту, далі кадри.
   По-друге, спроба з порожнім текстом безпечна: неправильний спосіб
   сервер відхилить як порожнє повідомлення, і клієнту не прилетить сміття
   від наших пошуків. */
const CRM_PIC_WAYS = [
  /* ПОЛЕ НАЗИВАЄТЬСЯ `attachments`, І В НЬОМУ АДРЕСИ РЯДКАМИ.

     Це вже не здогад. Sitniks сам сказав це помилкою на нашу спробу:

       HTTP 400 ["each_attachment_must_be_a_valid_url"]

     Ми клали туди обʼєкти `{ mediaType, mediaUrl }` — рівно в тій формі, у
     якій він ВІДДАЄ вкладення нам, — а він хоче масив адрес. Читання й
     запис у нього різні, і саме на цьому припущенні ми й помилялись.

     Порядок: спершу голі адреси, далі з текстом (раптом порожнє
     повідомлення не приймається), далі з типом. Решта — старі здогадки,
     які так і лишились неперевіреними: до них черга не дійшла, бо після
     пʼятої спроби Sitniks почав віддавати 429. */
  { id:'attach-url',   many:true,  json:u => ({ attachments:u }) },
  { id:'attach-text',  many:true,  json:u => ({ text:'', attachments:u }) },
  { id:'attach-type',  many:true,  json:u => ({ messageType:'image', attachments:u }) },
  /* Ці дві форми Sitniks ПРИЙМАВ — і не робив нічого: вкладення в стрічці
     не зʼявлялось, а клієнту летіло порожнє повідомлення. Тому їх тут
     більше немає: спосіб, який мовчки шле клієнту пустоту, гірший за
     спосіб, який чесно відмовляє. */
  { id:'files',       many:true,  json:u => ({ files:u }) },
  { id:'media',       many:true,  json:u => ({ media:u }) },
  { id:'imageUrl',    many:false, json:u => ({ imageUrl:u[0] }) },
  { id:'photo',       many:false, json:u => ({ photo:u[0] }) },
  // Те саме, але файлом, а не адресою: на випадок, якщо адресу він бере
  // лише зі свого сховища
  { id:'form:file',     many:true, form:'file',  path:id => '/chats/' + id + '/messages' },
  { id:'form:image',    many:true, form:'image', path:id => '/chats/' + id + '/messages' },
  { id:'form:msg-file', many:true, form:'file',  path:id => '/chats/' + id + '/messages/file' },
  { id:'form:attach',   many:true, form:'file',  path:id => '/chats/' + id + '/attachments' }
];
/* Sitniks рахує запити. Перебір бив у нього чергою без пауз, і після
   пʼятої спроби він почав відповідати 429 — чотирнадцять способів із
   дев'ятнадцяти тоді взагалі не перевірились, а виглядало це як «жоден не
   працює». Тому між спробами пауза, а на 429 чекаємо довше й пробуємо той
   самий спосіб ще раз.

   Секунда, а не більше: Андрій каже, що в Sitniks паузи саме до секунди.
   Довша пауза нічого б не додала, зате перебір усіх способів тягнувся б
   пів хвилини — і менеджер устиг би вирішити, що адмінка зависла. */
const CRM_PIC_GAP = 1000;
const CRM_PIC_COOL = 4000;
/* ПАЧКОЮ, А НЕ ПО ОДНІЙ.

   У Direct кілька фото в одному повідомленні йдуть пачкою — одним блоком,
   який гортають. Саме тому поле зветься `attachments` і саме тому воно
   МАСИВ: одне повідомлення, кілька адрес. Ми ж досі слали кожну картку
   окремим запитом, тобто робили з однієї пачки пʼять повідомлень підряд.

   Тож картки одного скрипта складаємо в один масив і шлемо одним запитом.
   Клієнт бачить звичну пачку, а не чергу окремих сповіщень, і Sitniks
   рахує це як один запит — заразом і з обмеженням частоти легше.

   Способи, які беруть лише одну адресу (`imageUrl`, `photo`), для пачки не
   годяться: вони мовчки надіслали б першу картку й загубили решту. Тому в
   них стоїть `many:false`, і на пачці їх не пробуємо взагалі. */
function crmPicList(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
/* ── РОЗВІДКА: ЯКИМ ПОЛЕМ SITNIKS ПРИЙМАЄ КАРТИНКУ ───────────────────────
   Перебір способів рано чи пізно знайде робочий, але робить це навпомацки
   й на живій розмові з клієнтом. А відповідь можна спитати прямо, двома
   способами, і обидва читають, а нічого не надсилають.

   ПЕРШЕ. Багато API вміють описати себе самі. Проксі пропускає будь-який
   шлях, тож питаємо звичні адреси опису. Відповів хоч один — і гадати не
   треба взагалі: там перелічено і методи, і назви полів.

   ДРУГЕ. Подивитись, ЯК SITNIKS ВІДДАЄ ВКЛАДЕННЯ НАМ. Коли клієнт
   надсилає фото, воно приходить із якоюсь назвою поля. Приймають і
   віддають майже завжди однаково, тож це готова підказка — і вона вже
   лежить у наявних розмовах, нічого спеціально робити не треба.

   Третій шлях — відкрити власний застосунок Sitniks із вкладкою Network і
   подивитись, що йде при відправці картинки. Це найточніше, але зробити
   це може лише людина за компʼютером, тож кнопка тут про перші два. */
const CRM_DOC_PATHS = ['/openapi.json', '/swagger.json', '/swagger/v1/swagger.json',
                       '/docs', '/api-docs', '/v1/openapi.json'];
const CRM_FILE_KEYS = ['attachments','files','media','photos','attachment',
                       'url','fileUrl','imageUrl','photo','image','file'];
async function crmSniff(o){
  const out = [];
  out.push('ОПИС API');
  for(const path of CRM_DOC_PATHS){
    try{
      const d = await crmFetch(path);
      const keys = (d && typeof d === 'object') ? Object.keys(d).slice(0, 12).join(', ') : String(d).slice(0, 80);
      out.push('  ' + path + ' → ВІДПОВІВ: ' + keys);
      /* Знайшли опис — витягаємо з нього все, що стосується повідомлень:
         саме там стоїть назва поля, заради якої все й затіяно. */
      const paths = (d && d.paths) ? Object.keys(d.paths).filter(p => /message|chat|attach|file|upload/i.test(p)) : [];
      if(paths.length) out.push('    шляхи: ' + paths.slice(0, 20).join(', '));
    }catch(e){ out.push('  ' + path + ' → ' + (e.status || (e.message || '').slice(0, 40))); }
  }
  out.push('');
  out.push('ЯК SITNIKS ВІДДАЄ ВКЛАДЕННЯ НАМ');
  const st = crmChat[o.id];
  let found = null;
  if(st && st.chatId){
    try{
      const d = await crmFetch('/chats/' + encodeURIComponent(st.chatId) + '/messages');
      const arr = Array.isArray(d) ? d
        : ((d && (d.items || d.data || d.messages || d.results)) || []);
      for(const m of arr){
        if(!m || typeof m !== 'object') continue;
        const hit = CRM_FILE_KEYS.filter(k => m[k] != null &&
          !(Array.isArray(m[k]) && !m[k].length) && m[k] !== '');
        if(hit.length){ found = { m, hit }; break; }
      }
      if(found){
        out.push('  поля з вкладенням: ' + found.hit.join(', '));
        out.push('  саме повідомлення:');
        out.push(JSON.stringify(found.m, null, 1).slice(0, 1500));
      } else {
        out.push('  у цій розмові жодного повідомлення з вкладенням — ' +
                 'відкрийте ту, де клієнт надсилав фото, і натисніть ще раз');
      }
    }catch(e){ out.push('  стрічку не прочитати: ' + (e.message || '')); }
  } else out.push('  розмову не привʼязано');
  out.push('');
  out.push('ЩО ВЖЕ ПРОБУВАЛИ САМІ');
  out.push(crmPicLog.length ? crmPicLog.map(s => '  ' + s).join('\n') : '  ще не пробували');
  const way = String((contentData || {}).crmPicWay || '');
  out.push(way ? '  робочий спосіб: ' + way : '  робочого способу ще не знайдено');
  const txt = out.join('\n');
  console.log(txt);
  return txt;
}
function crmPicTry(way, chatId, urls, blobs){
  const id = encodeURIComponent(chatId);
  if(way.json)
    return crmFetch('/chats/' + id + '/messages',
      { method:'POST', body: JSON.stringify(way.json(urls)), timeoutMs: 90000 });
  const fd = new FormData();
  blobs.forEach((b, i) => {
    // Імʼя файлу за його справжнім типом: частина приймачів дивиться саме на
    // розширення, і .jpg на webp вони відхилять як пошкоджений файл.
    const ty = String((b && b.type) || '');
    const ext = /webp/.test(ty) ? 'webp' : /png/.test(ty) ? 'png' : 'jpg';
    fd.append(way.form, b, 'kartka-' + (i + 1) + '.' + ext);
  });
  /* Файл у Sitniks іде довго — ліміт 20 с, як для тексту, обривав саме
     вдалі відправки (15.10: «не працює надсилання фото»). */
  return crmFetch(way.path(id), { method:'POST', body: fd, timeoutMs: 90000 });
}
let crmPicLog = [];
const crmWait = ms => new Promise(r => setTimeout(r, ms));
/* ПРИЙНЯЛИ — ЗУПИНЯЄМОСЬ. НАСТУПНИЙ СПОСІБ ПРОБУЄМО ЛИШЕ ПІСЛЯ ВІДМОВИ.

   Доти успіх перевірявся так: надіслали — перечитали стрічку Sitniks —
   подивились, чи побільшало в ній повідомлень із вкладенням. Виявилось, що
   Sitniks НЕ ПОВЕРТАЄ нам наші власні вкладення: у стрічці розмови, куди
   ми щойно надіслали картинку, її немає. Тобто перевірка не могла
   спрацювати ніколи — і кожен спосіб оголошувався невдалим, хоча
   спрацював.

   А далі найгірше: після «невдачі» перебір ішов до наступного способу й
   надсилав картинку ЗНОВУ. Андрій отримав три однакові картки поспіль,
   потім посилання, а текст — аж через дві хвилини, бо стояв у черзі за
   ними.

   Помилка була не в паузах, а в правилі. «Прийнято» означає, що клієнту
   вже пішло; пробувати після цього щось іще — це надсилати вдруге. Тому
   правило тепер одне: відповів 200 — зупинились і запамʼятали. Наступний
   спосіб пробуємо лише після справжньої відмови. */
/* ІДЕНТИФІКАТОР РОЗМОВИ ЛЕЖИТЬ У ЗАМОВЛЕННІ, А НЕ В ПАМʼЯТІ СЕАНСУ.

   `crmChat` — це кеш відкритої переписки: він заповнюється, лише коли
   розмову ВІДКРИВАЛИ в розділі чатів. У відділі її не відкривають — там
   тиснуть «Надіслати клієнту» просто з картки, — і надсилання падало з
   «розмову не привʼязано», хоч привʼязка була: номер розмови записаний у
   самому замовленні з тієї миті, як її привʼязали.

   Тому питаємо обидва джерела: спершу памʼять, бо там свіжіше, потім саме
   замовлення. Андрій: «надіслати клієнту, привʼязка не працює». */
function crmChatIdOf(o){
  const st = crmChat[o && o.id];
  return String((st && st.chatId) || (o && o.crmChatId) || '');
}
async function crmSendPic(o, url, blob, local){
  const chatId = crmChatIdOf(o);
  if(!chatId) throw new Error('розмову не привʼязано');
  const st = crmChat[o.id] || { chatId };
  const urls = crmPicList(url), blobs = crmPicList(blob);
  if(!urls.length) throw new Error('немає що надсилати');
  /* ПЕРЕВІРЕНИЙ СПОСІБ — ЗАВЖДИ ПЕРШИМ (15.10). Доти першим ішов
     «запамʼятований», а запамʼятовувався будь-який, що відповів 200. 14.10
     ліміт 20 с обірвав `attach-url`, перебір дійшов до способу, який Sitniks
     ПРИЙМАЄ, але в Instagram не передає, — і він запамʼятався: фото йшли з
     ✓, а клієнт їх не бачив. Тепер `attach-url` першим завжди, а запамʼятати
     інший не можна. */
  const known = 'attach-url';
  let ways = CRM_PIC_WAYS.filter(w => w.many || urls.length === 1);
  const k = ways.findIndex(w => w.id === known);
  if(k > 0){ ways = ways.slice(); ways.unshift(ways.splice(k, 1)[0]); }
  crmPicLog = [];
  for(let i = 0; i < ways.length; i++){
    const w = ways[i];
    /* Пауза перед кожною наступною спробою: Sitniks рахує запити, і черга
       без проміжків добігала до 429 на пʼятій спробі. */
    if(i) await crmWait(CRM_PIC_GAP);
    let res = null, ok = false;
    for(let attempt = 0; attempt < 2 && !ok; attempt++){
      try{ res = await crmPicTry(w, st.chatId, urls, blobs); ok = true; }
      catch(e){
        /* 429 — це не «спосіб не годиться», а «зачасто питаємо». Чекаємо
           довше й пробуємо ЦЕЙ САМИЙ спосіб ще раз; не допоміг і вдруге —
           зупиняємо перебір увесь, бо далі однаково відмовлятиме кожен. */
        /* Не відповів / обірвався звʼязок — Sitniks міг картинку вже
           прийняти. Перебирати інші способи тоді не можна: клієнт отримав
           би її двічі. Кажемо чесно й зупиняємось. */
        if(e && !e.status){
          crmPicLog.push(w.id + ' → ' + (e.message || 'немає відповіді'));
          const stop = new Error((e.message || 'Sitniks не відповів') + ' — перевірте переписку, перш ніж надсилати ще раз');
          stop.log = crmPicLog; stop.status = 0;
          throw stop;
        }
        if(e && e.status === 429){
          if(attempt === 0){ await crmWait(CRM_PIC_COOL); continue; }
          crmPicLog.push(w.id + ' → Sitniks обмежив частоту запитів');
          const stop = new Error('Sitniks обмежив частоту запитів — зачекайте хвилину й спробуйте ще раз');
          stop.log = crmPicLog; stop.status = 429;
          throw stop;
        }
        crmPicLog.push(w.id + ' → ' + (e.message || 'відмова'));
      }
    }
    if(!ok) continue;
    crmPicLog.push(w.id + ' → ПРИЙНЯВ');
    /* Не той, що перевірений, — у журнал, але НЕ запамʼятовуємо. */
    if(w.id !== known) console.warn('Sitniks: фото прийняв запасний спосіб ' + w.id + ' — перевірте, чи дійшло клієнту');
    /* Чим упізнати цю картинку в стрічці: відповідь тримає номер
       створеного повідомлення. Адреси Cloudinary тут марні — Sitniks їх не
       переказує (див. crmOutOwn). */
    const mid = crmOutSent(o, res, true);
    /* Фото — у стрічку одразу, не чекаючи, поки Sitniks його поверне. */
    const rec = (crmOutList(o) || []).slice(-1)[0];
    const e = local || crmPicsAdd(o, urls, 'pending');
    e.state = 'sent'; e.urls = urls.slice(0, 10); e.t = (rec && rec.t) || (mid ? '#' + mid : '');
    e.at = new Date().toISOString().replace('T', ' ').slice(0, 16);
    crmPicsKeep(o, e);
    crmPicsShow(o);
    return w.id;
  }
  console.warn('Sitniks: жоден спосіб надіслати картинку не спрацював\n' + crmPicLog.join('\n'));
  const err = new Error('Sitniks не прийняв картинку жодним із ' + ways.length + ' способів');
  err.log = crmPicLog;
  throw err;
}
/* ══════════ ЧЕРГА ВІДПРАВЛЕНОГО — ЯК У TELEGRAM (14.10) ══════════

   Андрій: «відправив — мені не показує, а клієнту прилітає… якісь
   повідомлення надсилаються, якісь пропускаються». Причина була в тому, що
   власна бульбашка лежала в тому самому списку, який опитування кожні 4 с
   замінює відповіддю Sitniks. Sitniks ще не встиг повернути наше
   повідомлення — і воно зникало з екрана (а то й ставало червоним
   «видалено»), хоча клієнт його вже отримав.

   Тепер відправлене живе окремо, у черзі, і показується ПОВЕРХ стрічки,
   доки сервер не поверне його сам:
     ⏱ надсилаю…   → ✓ надіслано (Sitniks прийняв) → зникає з черги, коли
     те саме повідомлення з'явилось у переписці (там воно вже ✓✓).
   Не вийшло — червоне «не надіслано» з «Повторити» / «Прибрати»: текст не
   губиться ніколи. Однаково для Instagram (Sitniks) і Telegram. */
const chatOutbox = {};      // o.id → [{ id, kind, text, files, state, at, err, pre }]
function obNorm(t){ return String(t || '').replace(/\s+/g, ' ').trim(); }
function obList(o){ return chatOutbox[o.id] || (chatOutbox[o.id] = []); }
function obServer(o, kind){
  return kind === 'tg' ? ((tgChat[o.id] || {}).msgs || []) : ((crmChat[o.id] || {}).msgs || []);
}
/* Скільки повідомлень із тим самим текстом уже було до натиску — за цим
   числом і впізнаємо «наше повернулось», не плутаючи зі старим таким самим. */
function obCount(list, t){ const n = obNorm(t); return list.filter(m => m && !m.gone && obNorm(m.text) === n).length; }
function obAdd(o, kind, x){
  x.id = 'ob' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  x.kind = kind; x.at = new Date().toISOString(); x.by = myName();
  x.pre = obCount(obServer(o, kind), x.text);
  obList(o).push(x);
  return x;
}
function obPaint(o){
  try{ renderOrderDrawer(); }catch(e){}
  if(chatWin && chatWin.id === o.id) try{ renderChatWin(true); }catch(e){}
}
/* Що з черги ще показувати поверх стрічки. Повернулось у переписку —
   прибираємо: далі воно живе як звичайне повідомлення. Надіслане, яке так і
   не повернулось за 15 хв, теж прибираємо — Sitniks міг віддати його іншим
   словами, а вічний «✓ надіслано» нічого вже не додає. */
function obVisible(o, kind){
  const l = chatOutbox[o.id];
  if(!l || !l.length) return [];
  const srv = obServer(o, kind);
  const зараз = Date.now();
  chatOutbox[o.id] = l.filter(x => {
    if(x.kind !== kind) return true;
    /* «Не відповів» ще не значить «не дійшло»: зʼявилось у переписці —
       значить дійшло, і червоне з «Повторити» знімаємо (інакше дубль). */
    if(x.state === 'failed' && x.text && obCount(srv, x.text) > x.pre) return false;
    if(x.state === 'sent'){
      if(x.text && obCount(srv, x.text) > x.pre) return false;
      if(!x.text && x.ownT && srv.some(m => m && m.ownT === x.ownT)) return false;
      if(зараз - Date.parse(x.sentAt || x.at) > 15 * 60000) return false;
    }
    return true;
  });
  return chatOutbox[o.id].filter(x => x.kind === kind);
}
async function obRetry(o, id){
  const x = obList(o).filter(y => y.id === id)[0];
  if(!x || x.state === 'pending') return;
  if(x.kind === 'tg') return tgSend(o, x.text, '', x);
  return crmSend(o, x.text, x);
}
function obDrop(o, id){
  chatOutbox[o.id] = obList(o).filter(y => y.id !== id);
  obPaint(o);
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ob-retry],[data-ob-drop]');
  if(!b) return;
  e.preventDefault(); e.stopPropagation();
  const o = (orders || []).find(x => x.id === b.dataset.obO);
  if(!o) return;
  if(b.dataset.obRetry) obRetry(o, b.dataset.obRetry);
  else obDrop(o, b.dataset.obDrop);
}, true);

/* Картинка з лімітом часу: перебір способів Sitniks не має тягнутись без
   кінця. Один запит — до 90 с (файл важкий), увесь перебір — до 3 хв. */
function crmPicTimed(o, url, blob, local){
  return Promise.race([
    crmSendPic(o, url, blob, local),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Sitniks не відповів за 3 хв — перевірте переписку')), 180000))
  ]);
}
/* Завантаження в хмару теж із лімітом: без нього смужка «надсилаємо»
   висіла вічно, а кнопка мовчки не реагувала. */
function chatTimed(p, ms, what){
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what)), ms))]);
}
async function crmSend(o, text, again){
  const t = scriptMarksOff(text).trim();
  if(!t) return false;
  const chatId = crmChatIdOf(o);
  if(!chatId){ toast('Розмову Instagram не привʼязано — надіслати нікуди'); return false; }
  const st = crmChat[o.id] || (crmChat[o.id] = { chatId });
  if(!st.chatId) st.chatId = chatId;
  const x = again || obAdd(o, 'crm', { text: t });
  x.state = 'pending'; x.err = '';
  obPaint(o);
  try{
    const res = await crmFetch('/chats/' + encodeURIComponent(st.chatId) + '/messages', {
      method: 'POST',
      body: JSON.stringify({ text: t })
    });
    x.state = 'sent'; x.sentAt = new Date().toISOString();
    crmSent.add(t);
    crmOutSent(o, res);          // ще й за номером повідомлення, якщо він є
    /* Хто відповів і скільки клієнт чекав — до того, як кружечок згасне. */
    try{
      const чекав = (o.crmTheirs && o.crmInAt) ? (Date.now() - new Date(String(o.crmInAt).replace(' ', 'T')).getTime()) / 60000 : 0;
      chatReplied(o, 'ig', чекав > 0 && isFinite(чекав) ? чекав : 0);
    }catch(e){ console.warn(e); }
    crmAnswered(o);              // відповіли — кружечок згасає
    /* Записуємо в картку, що це писали ми: Sitniks поверне це повідомлення
       без відправника, і впізнати його більше не буде чим. */
    crmOutNote(o, t);
    saveOrderMeta(o).catch(e => console.warn(e));
    obPaint(o);
    /* Перечитуємо двічі: Sitniks віддає щойно надіслане не одразу. */
    setTimeout(function(){ crmPollOnce(o); }, 1200);
    setTimeout(function(){ crmPollOnce(o); }, 5000);
    return true;
  }catch(e){
    // 400 тут — відома невирішена проблема: Sitniks може не знати, у який
    // саме канал слати, або вікно відповіді закрите. Показуємо його текст.
    x.state = 'failed'; x.err = (e && e.message) || 'помилка';
    obPaint(o);
    toast('Не надіслалось: ' + x.err + ' · «Повторити» — на самому повідомленні');
    console.warn('sitniks send', e, 'обʼєкт замовлення:', st.raw);
    return false;
  }
}

/* Нове повідомлення від клієнта має зʼявлятись саме, поки картка відкрита —
   інакше менеджер сидить і тисне «Оновити», щоб перевірити, чи не відповіли.

   Тягнемо лише стрічку й перемальовуємо ТІЛЬКИ якщо вона змінилась: зайве
   перемальовування збиває фокус і виглядає як смикання. */
let crmTimer = null, crmVisWired = false;
const CRM_POLL_MS = 4000;      // жива розмова — відповідь має зʼявлятись одразу

function crmStopPoll(){ if(crmTimer){ clearInterval(crmTimer); crmTimer = null; } }

async function crmPollOnce(o){
  const d = document.getElementById('orderDrawer');
  // Розмова жива, поки відкрита картка АБО саме вікно діалогу
  const live = (d && d.classList.contains('open') && drawerOrderId === o.id) ||
               (chatWin && chatWin.id === o.id && chatWin.kind === 'crm');
  if(!live){ crmStopPoll(); return; }
  const st = crmChat[o.id];
  if(!st || !st.chatId || st.loading) return;
  if(crmCooling()){ if(chatWin && chatWin.id === o.id && !st.msgs) renderChatWin(); return; }
  /* Перше завантаження не вдалось (429, тайм-аут) — повторюємо його, а не
     лишаємо діалог порожнім назавжди. */
  if(!st.msgs && st.noHistory) return crmLoadChat(o);
  try{
    const data = await crmFetch('/chats/' + encodeURIComponent(st.chatId) + '/messages');
    /* Опитування бере лише свіжу сторінку — гортати всю розмову щохвилини
       ні до чого. Старішу частину доклеюємо з уже завантаженої: інакше
       кожне опитування обрізало б стрічку до останніх десяти. Видалене в
       свіжій сторінці так само видно: старше за неї не доклеюється. */
    const fresh = crmMsgArr(data);
    let src = data;
    if(fresh && Array.isArray(st.rawAll) && st.rawAll.length > fresh.length){
      const ts = fresh.map(crmRawAt).filter(Boolean);
      const межа = ts.length ? Math.min.apply(null, ts) : 0;
      const є = {}; fresh.forEach(m => { є[crmRawId(m)] = 1; });
      const старі = межа ? st.rawAll.filter(m => !є[crmRawId(m)] && crmRawAt(m) && crmRawAt(m) < межа) : [];
      src = fresh.concat(старі);
      if(src.every(m => crmRawAt(m))) src.sort((a, b) => crmRawAt(b) - crmRawAt(a));
      st.rawAll = src;
    }
    const msgs = crmNormMsgs(src, o);
    if(!msgs) return;
    /* Прикмета стрічки — не лише тексти. Бік, підпис, вкладення й слід
       видаленого теж міняють те, що людина бачить; порівнюючи самі тексти,
       ми пропускали саме ці зміни, а перемальовували й тоді, коли не
       змінилось нічого. Одне й друге однаково погано: перше не показує
       нового, друге смикає екран під руками. */
    const sig = l => (l || []).map(m => [m.text, m.mine ? 1 : 0, m.gone ? 1 : 0, m.by || '',
      (m.files || []).map(f => f && f.url).join(' ')].join('\u0001')).join('\u0000');
    const was = sig(st.msgs);
    const now = sig(msgs);
    if(was === now) return;
    st.msgs = msgs;
    renderOrderDrawer();
    // Вікно діалогу — окреме від картки, і воно теж має побачити нове
    if(chatWin && chatWin.id === o.id && chatWin.kind === 'crm') renderChatWin();
  }catch(e){ /* тимчасовий збій мережі не має ламати картку */ }
}

/* ══════════ ФОНОВЕ ОПИТУВАННЯ: ЩОБ ЖОДЕН ДІАЛОГ НЕ ЗАГУБИВСЯ ═══════════

   Telegram і Instagram улаштовані по-різному, і це корінь усього.

   Telegram САМ ШТОВХАЄ повідомлення в базу: бот записує їх, і дошка бачить
   їх одразу, навіть якщо ніхто нічого не відкривав. Тому в Telegram-карток
   давно є і лічильник, і підняття вгору колонки.

   Sitniks не штовхає нічого. Адмінка дізнається про повідомлення лише тоді,
   коли сама спитає, — а питала вона доти ТІЛЬКИ ту розмову, яка зараз
   відкрита. Поки менеджер не відкрив діалог, для дошки його не існувало: ні
   лічильника, ні підняття. А половина звернень приходить саме в Instagram,
   тож це не дрібниця, а дірка в самій основі.

   Тому один запит на хвилину на ВСЮ адмінку. Sitniks віддає список
   діалогів, найсвіжіші згори, з останнім повідомленням у кожному — цього
   досить, щоб знати, у кого щось нове й чиє там останнє слово. По запиту на
   картку робити не можна: у робочому акаунті їх сотні.

   Хвилина затримки — свідома ціна. Миттєво було б вебхуком, але чи вміє його
   Sitniks, невідомо; опитування працює незалежно від їхньої відповіді.

   ПРАВИЛО: розмова неопрацьована, доки ОСТАННЄ СЛОВО ЗА КЛІЄНТОМ. Не «доки
   не прочитали»: прочитати й забути легко, і лічильник, який гасне від
   погляду, бреше вже за хвилину. */
const CRM_SWEEP_MS = 30000;   // 15.10: раз на 30 с — частіше Sitniks починає гальмувати й відмовляти (429)
let crmSweepTimer = null, crmSweepBusy = false;
/* Розмови, у яких замовлення ще немає. У розділі їх більше не показуємо —
   там лише те, що ми самі привʼязали, — але обхід їх усе одно читає: саме з
   цього списку видно, що звʼязок із Sitniks живий, і сюди ж дивляться,
   коли розбираються, чому розмова не підтягнулась. */
let crmInbox = [];
/* Останнє повідомлення розмови лежить у списку то під одним імʼям, то під
   іншим — залежно від того, який це ендпоінт. Дивимось у всі звичні. */
function crmRowLast(r){
  const m = r && (r.lastMessage || r.last_message || r.lastMsg || r.message);
  return (m && typeof m === 'object') ? m : null;
}
/* ══════════ ВІКНО ВІДПОВІДІ: СІМ ДНІВ ══════════════════════════════════

   Instagram не дає писати клієнтові, коли заманеться. Відлік іде від
   ОСТАННЬОЇ РЕПЛІКИ КЛІЄНТА, і триває сім діб; далі канал закривається.
   Найгірше в цьому те, як воно виглядає збоку: Sitniks лист приймає, у
   нашій стрічці він стоїть, а до людини не доходить. Менеджер дізнається
   про це через день-два — або не дізнається зовсім.

   Тому рахуємо самі й кажемо вголос: скільки лишилось, поки ще є, і що
   вікно зачинене, коли вже немає.

   Час зберігається без позначки поясу (його зрізає нормалізація стрічки),
   а приходить в UTC — тож і читаємо як UTC. Помилка на кілька годин у
   семиденному вікні нічого не важить, а от добова — важить, і саме її це
   й уникає. */
const CRM_WIN_MS = 7 * 24 * 60 * 60 * 1000;
function crmTime(s){
  const t = String(s || '').trim();
  if(!t) return 0;
  const n = Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? t : (t.replace(' ', 'T') + 'Z'));
  return isNaN(n) ? 0 : n;
}
/* Коли клієнт озвався востаннє. Відкрита стрічка знає це точно; закрита —
   з того, що лишив фоновий обхід. */
function crmLastInAt(o){
  const st = (o && crmChat[o.id]) || {};
  const live = (st.msgs || []).filter(m => m && !m.gone && !m.mine && m.at)
                              .map(m => m.at).sort().pop();
  if(live) return live;
  if(o && o.crmInAt) return String(o.crmInAt);
  // Стара картка без окремого поля: годиться й crmAt, коли остання репліка їхня
  return (o && o.crmTheirs && o.crmAt) ? String(o.crmAt) : '';
}
function crmWindow(o){
  const at = crmLastInAt(o);
  if(!at) return null;                 // клієнт ще не писав — рахувати нема від чого
  const t = crmTime(at);
  if(!t) return null;
  const left = t + CRM_WIN_MS - Date.now();
  /* `since` — скільки МИНУЛО від репліки клієнта. Виводити його з `left`
     на місці виклику виявилось пасткою: «лишилось мінус дві доби» плюс сім
     дає пʼять, а минуло девʼять. Тому число рахується тут, один раз і
     правильно. */
  return { at: at, left: left, since: Date.now() - t, closed: left <= 0,
           /* Менше двох діб — уже варто поспішати. Саме тут попередження
              ще щось міняє: за дві доби встигнути можна, за дві години —
              як пощастить. */
           soon: left > 0 && left <= 48 * 60 * 60 * 1000 };
}
function crmLeftLabel(ms){
  const m = Math.max(0, Math.round(Math.abs(ms) / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  if(d >= 1) return d + ' ' + (d === 1 ? 'день' : (d < 5 ? 'дні' : 'днів')) +
                    (h ? ' ' + h + ' год' : '');
  if(h >= 1) return h + ' ' + (h === 1 ? 'година' : (h < 5 ? 'години' : 'годин'));
  return m + ' хв';
}
function crmSweepRow(r, o){
  const last = crmRowLast(r);
  const box = last || r;
  const at = String(crmPick(box, CRM_AT_KEYS) || '');
  if(!at) return null;
  const text = String(crmPick(box, CRM_TXT_KEYS) || '');
  /* Чиє воно. Без цього наша ж відповідь піднімала б картку й нарощувала
     лічильник — тобто система повідомляла б нам про нас самих. */
  let mine = last
    ? crmIsMine(last, text, crmMsgWho(last), crmPeerKeys(o))
    : false;
  /* НАША ЖЕ ВІДПОВІДЬ — НЕ «КЛІЄНТ НАПИСАВ» (20.10). Надіслане через API
     Sitniks повертає без ознаки «вихідне», і обхід, побачивши її останньою,
     додавав +1 непрочитаного саме тоді, коли ми відповіли. Звіряємо з
     памʼяттю відправленого: номер, текст, а фото — одне на відправку. */
  if(!mine && last && o && o.id){
    const files = [];
    (Array.isArray(last.attachments) ? last.attachments : []).forEach(x => {
      const u = typeof x === 'string' ? x : (x && (x.mediaUrl || x.url)); if(u) files.push({ url: String(u) }); });
    if(typeof last.attachmentUrl === 'string' && /^https?:/.test(last.attachmentUrl)) files.push({ url: last.attachmentUrl });
    if(crmOutOwn(o, last, files, crmOutTimePick(o, [last])) || (text && crmOutFind(o, text, files))) mine = true;
    /* Без тексту й без вкладень у рядку списку (Sitniks не завжди їх кладе) —
       фото, що зʼявилось поруч із нашою відправкою. Здогад, але безпечний:
       обхід однаково дочитає стрічку й порахує точний хвіст. */
    else if(!text && !files.length){
      const t = Date.parse(at);
      if(t && crmOutList(o).some(r => r && String(r.t).charAt(0) === '@' && Math.abs(t - +String(r.t).slice(1)) <= CRM_OUT_WIN)) mine = true;
    }
  }
  return { at, text, mine };
}
/* СПИСОК РОЗМОВ — НЕ ЛИШЕ ПЕРША СТОРІНКА (17.10). Sitniks віддає список
   сторінками, і розмова, що не влізла в першу, для обходу не існувала.
   Параметр розміру сторінки документація не каже, тож шукаємо один раз:
   невідомий параметр Sitniks ігнорує (та сама кількість), відомий —
   дає більше. Знайдене памʼятаємо. */
let crmChatsWay = null;
try{ crmChatsWay = localStorage.getItem('crmChatsWay') || null; }catch(e){}
const CRM_CHATS_SIZE = ['limit=100', 'perPage=100', 'pageSize=100', 'per_page=100', 'take=100', 'size=100', 'count=100'];
let crmChatsTried = false;
async function crmChatsList(){
  if(crmChatsWay && crmChatsWay !== '-'){
    try{ return crmListOf(await crmFetch('/chats?' + crmChatsWay)); }
    catch(e){ if(e && e.status === 429) throw e; crmChatsWay = null; }
  }
  const base = crmListOf(await crmFetch('/chats'));
  if(crmChatsWay === '-' || crmChatsTried || base.length < 10) return base;
  crmChatsTried = true;
  for(const q of CRM_CHATS_SIZE){
    try{
      const l = crmListOf(await crmFetch('/chats?' + q));
      if(l.length > base.length){
        crmChatsWay = q;
        try{ localStorage.setItem('crmChatsWay', q); }catch(e){}
        return l;
      }
    }catch(e){ if(e && e.status === 429) break; }
  }
  crmChatsWay = '-';
  try{ localStorage.setItem('crmChatsWay', '-'); }catch(e){}
  return base;
}
const crmChecked = {};
let crmSweepInfo = null;
/* Живе замовлення — є сенс стерегти розмову: не закрите й не скасоване. */
function crmSweepLive(o){
  return !(o.status === 'done' || o.status === 'cancel' || o.status === 'archive' || o.archived);
}
/* Стрічку, прочитану обходом напряму, — у картку: лічильник (crmNormMsgs),
   остання репліка й час. true — щось змінилось. */
function crmTakeFeed(o, data){
  const було = [+o.crmUnread || 0, o.crmAt || '', !!o.crmTheirs].join('|');
  const msgs = crmNormMsgs(data, o) || [];
  const живі = msgs.filter(m => m && !m.gone && !m.local && m.ts);
  const ост = живі[живі.length - 1];
  if(ост){
    const at = new Date(ост.ts).toISOString();
    if(at > String(o.crmAt || '')){
      o.crmAt = at;
      o.crmLast = String(ост.text || (ост.files && ост.files.length ? '📎 вкладення' : '')).slice(0, 160);
      if(!ост.mine){ o.crmInAt = ост.at; touchOrder(o); }
    }
  }
  return було !== [+o.crmUnread || 0, o.crmAt || '', !!o.crmTheirs].join('|');
}
async function crmSweepOnce(){
  if(crmSweepBusy || !crmBase() || document.hidden) return;
  /* Пауза після 429 — і поки відкритий діалог ще не дочитав свою стрічку:
     він важливіший за кружечки. */
  if(crmCooling()) return;
  if(chatWin && chatWin.kind === 'crm' && !((crmChat[chatWin.id] || {}).msgs)) return;
  /* Поки щось надсилається — не питаємо: Sitniks рахує запити, і обхід
     у цю мить лише відбирає в картинки ліміт. */
  if(chatWin && (chatWin.sending || chatWin.picsBusy)) return;
  const byChat = {};
  (orders || []).forEach(o => { if(o && o.crmChatId) byChat[String(o.crmChatId)] = o; });
  crmSweepBusy = true;
  try{
    const rows = await crmChatsList();
    let touched = false;
    const recount = [];
    const уСписку = new Set(rows.map(r => String((r && (r.chatId || r.chat_id || r.id)) || '')));
    crmInbox = [];
    rows.forEach(r => {
      const id = String((r && (r.chatId || r.chat_id || r.id)) || '');
      if(!id) return;
      const o = byChat[id];
      const info = crmSweepRow(r, o || {});
      /* Розмова без замовлення. Тримаємо її окремо: на дошці їй місця
         немає, а в списку розмов вона потрібна найбільше — саме такі й
         губляться. */
      if(!o){
        if(info) crmInbox.push({ chatId:id, nick:crmNick(r) || crmName(r), name: crmName(r), rawNick: crmNick(r),
                                 at:info.at, text:info.text, mine:info.mine });
        return;
      }
      if(!info || info.at <= String(o.crmAt || '')) return;
      o.crmAt = info.at;
      o.crmLast = info.text.slice(0, 160);
      o.crmTheirs = !info.mine;
      /* Коли клієнт озвався востаннє. Від цієї миті Instagram відлічує сім
         днів, у які нашу відповідь ще доставлять; далі лист іде в нікуди.
         Тримаємо в замовленні окремо від crmAt: та — «остання репліка
         взагалі», а вікно рахується САМЕ від клієнтської. */
      if(!info.mine) o.crmInAt = info.at;
      if(!info.mine){
        /* Скільки клієнт написав після нашої останньої відповіді. Точне
           число дає лише сама стрічка, і коли розмову відкриють, воно
           перепишеться (див. crmNoteIn). А доти рахуємо спостереженнями:
           це менше за правду, але ніколи не більше, і «одиниця» чесніше за
           порожнечу. */
        o.crmUnread = (+o.crmUnread || 0) + 1;
        touchOrder(o);      // клієнт озвався — картка вгору колонки
        /* Спостереження недораховує: три репліки між тактами — це одна
           «нова остання». Андрій: «скільки пропущених, стільки й
           показується». Тож дочитуємо стрічку й рахуємо точний хвіст. */
        if(!(chatWin && chatWin.id === o.id)) recount.push(o);
      } else {
        /* Ми відповіли (хоч і прямо з Instagram) — лічильник обнуляється.
           Стрічку теж дочитуємо: «наше» тут — здогад з одного рядка списку. */
        o.crmUnread = 0;
        if(!(chatWin && chatWin.id === o.id)) recount.push(o);
      }
      touched = true;
    });
    /* Не більше трьох за такт: Sitniks рахує запити. Решту дорахує
       наступний такт або відкриття розмови. */
    let впер = false;
    for(const o of recount.slice(0, 3)){
      try{ crmNormMsgs(await crmFetch('/chats/' + encodeURIComponent(o.crmChatId) + '/messages'), o); }
      catch(e){ if(e && e.status === 429){ впер = true; break; } }
    }
    /* СТРАХОВКА (17.10, Андрій: «кружечок зʼявляється, лише коли зайду в
       діалог»). Розмови, яких список Sitniks не віддав (він сторінковий),
       обхід не бачив зовсім. Тож по черзі дочитуємо переписку відкритих
       замовлень, яких у списку не було, — по дві за такт, найдавніше
       перевірені першими. */
    if(!впер){
      const черга = (orders || []).filter(o => o && o.crmChatId && !уСписку.has(String(o.crmChatId)) &&
          !(chatWin && chatWin.id === o.id) && crmSweepLive(o))
        .sort((a, b) => (crmChecked[a.id] || 0) - (crmChecked[b.id] || 0)).slice(0, 2);
      for(const o of черга){
        crmChecked[o.id] = Date.now();
        try{ if(crmTakeFeed(o, await crmFetch('/chats/' + encodeURIComponent(o.crmChatId) + '/messages'))) touched = true; }
        catch(e){ if(e && e.status === 429) break; }
      }
    }
    crmSweepInfo = { at: new Date().toISOString(), rows: rows.length, way: crmChatsWay || '' };
    try{ paintSweepInfo(); }catch(e){}
    if(touched){
      try{ await saveOrders({ quiet:true }); }catch(e){ console.warn('обхід розмов', e); }
      renderBoard();
    }
    crmElsewhereScan();
    chatsLive();      // список розмов живий: нове піднімається саме
  }catch(e){
    /* 429 чи тимчасовий збій — просто пропускаємо такт. Наступний буде за
       хвилину, і нічого страшного не сталось. */
    if(!(e && e.status === 429)) console.warn('обхід розмов', e);
  }finally{ crmSweepBusy = false; }
}
/* ══════════ КЛІЄНТ ПИШЕ В ІНШУ РОЗМОВУ (14.10) ══════════
   Андрій: клієнт написав «Пап», а CRM каже «не писав 18 днів». Буває, що
   людина пише нам з того самого профілю, але Sitniks заводить нову
   розмову — а картка привʼязана до старої й нового не бачить. Обхід
   розмов знає всі розмови; якщо неприв'язана розмова має те саме імʼя чи
   нік, що й прив'язана до замовлення, і в ній свіжіше повідомлення —
   кажемо про це в самому чаті кнопкою «Перевʼязати». */
function crmKeyName(v){ return String(v || '').replace(/^@/, '').trim().toLowerCase(); }
function crmElsewhereScan(){
  const по = {};
  /* Розмова, привʼязана до іншого замовлення, — не «інша розмова», а чуже
     замовлення того самого клієнта. */
  const звʼязані = new Set((orders || []).filter(o => o && o.crmChatId).map(o => String(o.crmChatId)));
  (crmInbox || []).forEach(r => {
    if(звʼязані.has(String(r.chatId))) return;
    [r.rawNick, r.name].map(crmKeyName).filter(k => k.length >= 3).forEach(k => {
      if(!по[k] || String(r.at) > String(по[k].at)) по[k] = r;
    });
  });
  (orders || []).forEach(o => {
    if(!o || !o.crmChatId){ if(o) delete o.__elsewhere; return; }
    const k = [o.crmNick, o.crmChatName].map(crmKeyName).filter(x => x.length >= 3);
    const r = k.map(x => по[x]).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    if(r && r.chatId !== String(o.crmChatId) && !r.mine && String(r.at) > String(o.crmAt || ''))
      o.__elsewhere = { chatId: r.chatId, at: r.at, text: String(r.text || '').slice(0, 80), nick: r.rawNick || '', name: r.name || '' };
    else delete o.__elsewhere;
  });
}
function crmElsewhereHtml(o){
  const e = o && o.__elsewhere;
  if(!e) return '';
  return `<div class="cw-else">Клієнт пише в <b>іншу розмову</b> Sitniks${e.at ? ' · ' + escapeHtml(crmKyiv(e.at).slice(5, 16)) : ''}${
    e.text ? ': «' + escapeHtml(e.text) + '»' : ''}. Ця картка привʼязана до старої — нового звідти тут не видно.
    <button type="button" class="ob-b cw-else-b" data-crm-rebind="${escapeHtml(o.id)}">Перевʼязати на нову</button></div>`;
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('[data-crm-rebind]');
  if(!b) return;
  const o = (orders || []).find(x => x.id === b.dataset.crmRebind);
  if(!o || !o.__elsewhere) return;
  const r = o.__elsewhere;
  if(!confirm('Перевʼязати картку на нову розмову' + (r.name ? ' «' + r.name + '»' : '') + '? Стару розмову з картки знімемо.')) return;
  delete o.__elsewhere;
  delete crmChat[o.id];
  await crmPickChat(o, { chatId: r.chatId, name: r.name, nick: r.nick });
  if(chatWin && chatWin.id === o.id) renderChatWin();
  toast('Перевʼязано — тепер видно нову розмову');
});
/* ══════════ СПИСОК РОЗМОВ ══════════════════════════════════════════════
   Канбан упорядкований ЗА ПРОЦЕСОМ: картка стоїть у своїй колонці, і якщо
   їх тридцять, свіже повідомлення все одно треба знайти очима. Переписка
   живе ЗА ЧАСОМ: хто написав останнім, той найвище. Це два різні порядки,
   і жоден не заміняє другого.

   Поводиться список так, як мобільний Direct, і це не про красу, а про
   звичку: менеджер уже вміє ним користуватись. Нове повідомлення піднімає
   розмову вгору живцем, без перезаходу.

   Розділи роздільні — свій на кожен напрям. Один список із перемикачем був
   би тим самим змішуванням, від якого ми й розділяємось: фільтр рано чи
   пізно злітає, і менеджер відповідає не своєму клієнту. */
/* ЯКІ ЗАМОВЛЕННЯ ВВАЖАЮТЬСЯ «НАШИМИ» ДЛЯ ЦЬОГО РОЗДІЛУ ЧАТІВ.

   Було просте правило: напрям замовлення дорівнює напряму розділу. На ділі
   воно розходилось із тим, що людина бачить на екрані. Відділ дизайну B2C
   показує не лише свої замовлення, а й ті замовлення Канбану, у яких
   картка дизайну вже заведена: дороги туди більше немає, але зроблену
   роботу ховати не можна. Виходило, що замовлення стоїть у відділі B2C, а
   розмова по ньому — у чатах B2B, і в B2C її немає ніде.

   Андрій: «саме те, що є в картках замовлення B2C, повинно бути в чатах
   B2C, щоб можна було це все маякувати, бачити, щоб ми нічого не
   втратили».

   Тому чати B2C беруть рівно той самий список, що й відділ. Замовлення,
   яке видно в обох місцях, буде й у обох списках чатів — і це чесно: воно
   справді ведеться з двох боків, і загубити його гірше, ніж показати
   двічі. B2B при цьому не міняється взагалі: там як було, так і лишилось. */
function chatsOrders(dir){
  if(dir === 'b2c'){
    try{ return designOrders(); }
    catch(e){ console.warn('чати B2C', e);
      return (orders || []).filter(o => orderDir(o) === 'b2c'); }
  }
  return (orders || []).filter(o => orderDir(o) === 'b2b');
}
/* ── ОДНА РОЗМОВА, ДВА ЗАМОВЛЕННЯ ────────────────────────────────────────

   Клієнт замовив футболки на компанію, а через місяць худі собі. Розмова
   в Direct у нього одна, а замовлень два — одне B2B, друге B2C. Доти
   система мовчки брала одне з них і відкривала його картку; яке саме —
   вирішував порядок у списку. Андрій: «відкриваю, і справа відкривається
   зовсім інша карточка».

   Вгадати тут не можна в принципі: система не знає, про яке з двох він
   зараз думає. Тому вона й не вгадує — показує обидва й дає обрати, а
   відкриває те, що відповідає місцю, звідки прийшли. */
function ordersOfChat(o){
  if(!o) return [];
  const cid = String(o.crmChatId || '');
  const tid = String(tgChatOf(o) || '');
  if(!cid && !tid) return [o];
  return (orders || []).filter(x => x && (
    (cid && String(x.crmChatId || '') === cid) ||
    (tid && String(tgChatOf(x) || '') === tid)));
}
function chatsRows(dir){
  const out = [];
  chatsOrders(dir).forEach(o => {
    if(!o.crmChatId && !tgChatOf(o)) return;
    out.push({
      o: o,
      who: orderName(o) || o.crmChatName || ('замовлення ' + showNo(o)),
      channel: tgChatOf(o) ? 'Telegram' : 'Instagram',
      at: orderActivityAt(o),
      text: String(o.crmLast || o.tgLast || '').replace(/\s+/g, ' ').slice(0, 90),
      n: orderUnread(o),
      waits: orderWaiting(o)
    });
  });
  /* СЮДИ ПОТРАПЛЯЄ ТІЛЬКИ ТЕ, ЩО МИ САМІ ЗАВЕЛИ.

     Був тут ще один шматок: обхід питає Sitniks про ВЕСЬ список розмов, і
     кожна, не привʼязана до замовлення, лягала в цей список — ще й в обидва
     напрями одразу. Задум був добрий: людина написала вперше, картки немає,
     отже на дошці її немає ніде.

     А вийшла копія Direct усередині CRM. Кілька десятків чужих діалогів, у
     яких нічого не відбувається, у B2B і в B2C водночас, і серед них ті
     кілька, з якими справді працюють. Розділ перестав відповідати на
     питання, заради якого існує: «кому я ще не відповів».

     Тому правило: розмова зʼявляється в розділі тоді, коли її привʼязали до
     замовлення цього напряму, і тільки тоді. Хто написав уперше — живе в
     самому Instagram, доки з нього не зробили замовлення. */
  return out.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}
/* Жива ознака обходу Instagram у «Чатах»: коли перевіряли й скільки розмов
   побачили — щоб на живих даних було видно, що він ходить і бачить усі. */
function sweepInfoTxt(){
  const i = crmSweepInfo;
  if(!i) return 'Instagram: ще не перевіряли';
  return 'Instagram перевірено о ' + crmKyiv(i.at).slice(11, 16) + ' · розмов у списку ' + i.rows +
         (i.way && i.way !== '-' ? '' : ' (перша сторінка)');
}
function paintSweepInfo(){
  document.querySelectorAll('[data-sweep-info]').forEach(el => { el.textContent = sweepInfoTxt(); });
}
function chatsHtml(dir){
  const rows = chatsRows(dir);
  if(!rows.length)
    return '<div class="chl-empty">Розмов тут поки немає. Вони зʼявляються, ' +
           'коли розмову привʼязують до замовлення цього напряму — у картці, ' +
           'кнопкою 🔗 біля клієнта.</div>';
  return rows.map((r, i) => `
    <button class="chl-row${r.waits ? ' waits' : ''}${
      chatWin && chatWin.id === (r.o || {}).id ? ' is-on' : ''}" data-chl="${i}">
      <span class="chl-who">${escapeHtml(r.who)}</span>
      <span class="chl-ch">${escapeHtml(r.channel)}${
        r.o && r.o.orderId ? ' · ' + escapeHtml(showNo(r.o)) : ''}</span>
      <span class="chl-txt">${escapeHtml(r.text || '—')}</span>
      <span class="chl-at">${escapeHtml(crmDayShort(r.at))}</span>
      ${r.n ? `<span class="chl-n">${r.n}</span>` : ''}
    </button>`).join('') +
    `<div class="chl-sweep" data-sweep-info>${escapeHtml(sweepInfoTxt())}</div>`;
}
function crmDayShort(at){
  const s = String(at || '');
  if(!s) return '';
  const d = new Date(crmTime(s) || s);
  if(isNaN(+d)) return '';
  const today = crmKyiv(new Date().toISOString()).slice(0, 10);
  return crmKyiv(s).slice(0, 10) === today
    ? d.toLocaleTimeString('uk-UA', { timeZone:'Europe/Kyiv', hour:'2-digit', minute:'2-digit' })
    : d.toLocaleDateString('uk-UA', { timeZone:'Europe/Kyiv', day:'2-digit', month:'2-digit' });
}
/* ══════════ ДВІ КОЛОНКИ, ЯК У DIRECT ══════════════════════════════════
   Ліворуч список розмов, праворуч сама переписка. Натиснув рядок — розмова
   відкрилась тут же, без переходів і без проміжних кнопок.

   Доти клік вів в інше місце: відкривалась КАРТКА замовлення, а вікно
   переписки випливало поверх неї. Тобто розділ «Чати» насправді був
   списком посилань на дошку, і щоб відповісти двом людям поспіль,
   доводилось щоразу вертатись назад.

   Картка нікуди не поділась — на неї веде номер замовлення в шапці
   розмови. Але вона тепер наслідок, а не умова: у розділі чатів
   відповідають, а не ведуть замовлення. */
function chatsHostId(dir){ return dir === 'b2c' ? 'chatscView' : 'chatsView'; }
function renderChats(dir){
  const root = document.getElementById(dir === 'b2c' ? 'chatscRoot' : 'chatsRoot');
  if(!root) return;
  const rows = chatsRows(dir);
  const host = chatsHostId(dir);
  /* Вузол переписки один на всю адмінку, і він може зараз стояти саме тут.
     Виймаємо його ПЕРЕД тим, як стерти вміст, інакше innerHTML знищить його
     разом із розміткою — разом із живою підпискою на стрічку. */
  const cw = document.getElementById('chatWin');
  const parked = cw && cw.parentNode === document.getElementById(host);
  /* ОНОВЛЮЄМО ЛИШЕ СПИСОК (15.10). Доти обхід розмов кожні 20 с виймав
     вікно переписки з розмітки й ставив назад — і клік по «➤», що припав на
     цю мить, губився: «по Ctrl+Enter надсилає, а кнопка — ні». Вікно,
     що вже стоїть на місці, тепер не чіпаємо взагалі. */
  const list = root.querySelector('.ch2 > .ch2-list');
  if(list && document.getElementById(host)){
    list.innerHTML = chatsHtml(dir);
    if(!parked && !document.getElementById(host).children.length) chatsViewEmpty(dir);
  } else {
    if(parked) (document.querySelector('.workarea') || document.body).appendChild(cw);
    root.innerHTML = '<div class="ch2">' +
        '<div class="ch2-list">' + chatsHtml(dir) + '</div>' +
        '<div class="ch2-view" id="' + host + '"></div>' +
      '</div>';
    if(parked) chatsMount(dir);
    else chatsViewEmpty(dir);
  }
  root.querySelectorAll('[data-chl]').forEach(b => b.addEventListener('click', async ()=>{
    const r = rows[+b.dataset.chl];
    if(!r || !r.o) return;
    chatOpen(r.o, tgChatOf(r.o) ? 'tg' : 'crm', { host: chatsHostId(dir), dir });
    /* Картка праворуч відкрита — переходить на замовлення нової розмови. */
    if(drawerOrderId && drawerOrderId !== r.o.id){
      if(r.o.orderId){ try{ openOrderDrawer(r.o); }catch(e){ console.warn(e); } }
      else { try{ closeOrderDrawer(); }catch(e){} }
    }
    renderChats(dir);
  }));
}
/* Поки нічого не обрано — праворуч не порожнеча, а підказка: порожня
   половина екрана читається як «зламалось». */
function chatsViewEmpty(dir){
  const v = document.getElementById(chatsHostId(dir));
  if(!v) return;
  v.innerHTML = '<div class="ch2-none">' +
    '<b>Оберіть розмову зліва</b>' +
    '<span>Вона відкриється тут. Розмови зʼявляються в списку, коли їх ' +
    'привʼязують до замовлення ' + (dir === 'b2c' ? 'B2C' : 'B2B') + '.</span></div>';
}
// Поставити вузол переписки в праву колонку цього розділу.
function chatsMount(dir){
  const v = document.getElementById(chatsHostId(dir));
  const cw = document.getElementById('chatWin');
  if(!v || !cw) return;
  v.innerHTML = '';
  cw.classList.add('cw-inline');
  v.appendChild(cw);
}
/* Число поруч із назвою розділу: видно, що є неотримана відповідь, не
   заходячи туди. Саме число, а не крапка — «одне питання» і «людина
   написала пʼять разів» це різні за терміновістю речі. */
function paintChatBadges(){
  ['b2b', 'b2c'].forEach(dir => {
    const el = document.querySelector('[data-nav-n="' + (dir === 'b2c' ? 'chatsc' : 'chats') + '"]');
    if(!el) return;
    const n = chatsRows(dir).reduce((a, r) => a + (r.waits ? 1 : 0), 0);
    el.textContent = n ? String(n) : '';
    el.hidden = !n;
  });
}
function chatsLive(){
  const v = document.querySelector('.nav button[data-view].active');
  const k = v && v.dataset.view;
  if(k === 'chats') renderChats('b2b');
  if(k === 'chatsc') renderChats('b2c');
  try{ paintChatBadges(); }catch(e){}
}
function crmSweepStart(){
  if(crmSweepTimer) return;
  crmSweepOnce();
  crmSweepTimer = setInterval(crmSweepOnce, CRM_SWEEP_MS);
  /* Повернулись на вкладку — питаємо одразу, не чекаючи такту: саме в цю
     мить людина й хоче побачити, чи не відповіли. */
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) crmSweepOnce(); });
}
/* Ми відповіли — лічильник згасає. Саме відповіли, а не відкрили: інакше
   він гаснув би від погляду, і «непрацьовано» перестало б щось означати. */
function crmAnswered(o){
  if(!o) return;
  /* Межа «прочитано» — по останню репліку стрічки, а без стрічки (макет
     надіслали з дошки) — по цю мить. Інакше наша відповідь, якої Sitniks
     у стрічку не повертає (картинки), лишала б кружечок на місці. */
  crmSeenMark(o);
  try{ chatsRepaint(); }catch(e){}
}
function crmStartPoll(o){
  crmStopPoll();
  crmTimer = setInterval(function(){
    // У прихованій вкладці питати нема сенсу: ніхто не дивиться, а запити
    // йдуть. Повернулись на вкладку — оновлюємо одразу, не чекаючи такту.
    if(document.hidden) return;
    crmPollOnce(o);
  }, CRM_POLL_MS);
  if(!crmVisWired){
    crmVisWired = true;
    document.addEventListener('visibilitychange', function(){
      if(document.hidden || !drawerOrderId) return;
      const cur = (orders || []).find(x => x.id === drawerOrderId);
      if(cur) crmPollOnce(cur);
    });
  }
}

function wireCrmBlock(panel, o){
  /* Розмова читається знизу вгору, тож за замовчуванням показуємо останнє.
     Але «за замовчуванням» — це до першого дотику: доти цей рядок тягнув
     стрічку вниз на КОЖНОМУ перемальовуванні картки. А картка
     перемальовується від будь-якої дрібниці — свого ж запису в базу,
     чужої правки, такту опитування. Менеджер відгортав розмову на
     позавчора, і за секунду її змітало назад у кінець. Тому памʼятаємо,
     де він стоїть, і липнемо до дна лише поки він сам біля дна. */
  const feedEl = panel.querySelector('.od-crm-feed');
  if(feedEl){
    const st = crmChat[o.id] || {};
    const стик = st.feedStick !== false;
    const треба = стик ? feedEl.scrollHeight : (+st.feedTop || 0);
    if(Math.abs(feedEl.scrollTop - треба) > 1) feedEl.scrollTop = треба;
    feedEl.addEventListener('scroll', ()=>{
      const s = crmChat[o.id];
      if(!s) return;
      s.feedTop = feedEl.scrollTop;
      s.feedStick = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 60;
    });
  }
  if((crmChat[o.id] || {}).chatId){ if(!crmTimer) crmStartPoll(o); }
  else crmStopPoll();
  const load = panel.querySelector('.od-crm-load');
  const numEl = panel.querySelector('.od-crm-num');
  if(load) load.addEventListener('click', ()=>
    o.crmChatId ? crmLoadChat(o) : crmLoad(o, numEl ? numEl.value : null));
  const unlink = panel.querySelector('.od-crm-unlink');
  if(unlink) unlink.addEventListener('click', ()=> crmUnlink(o));
  // Привʼязка живе вгорі картки, біля ніка — але вмикається звідси, разом з
  // рештою Sitniks: усе про цю CRM в одному місці.
  const find = panel.querySelector('.od-ig-find');
  if(find) find.addEventListener('click', ()=> crmSeekOpen(o));
  const urlIn = panel.querySelector('.od-seek-url');
  const bindB = panel.querySelector('[data-seek-bind]');
  const doBind = ()=>{ if(urlIn) crmBindUrl(o, urlIn.value); };
  if(bindB) bindB.addEventListener('click', doBind);
  if(urlIn){
    urlIn.addEventListener('keydown', e=>{
      e.stopPropagation();
      if(e.key === 'Enter'){ e.preventDefault(); doBind(); }
    });
    /* Вставили посилання — привʼязуємо одразу, без другого руху: після
       вставки в цьому полі більше нічого не роблять. */
    urlIn.addEventListener('paste', ()=> setTimeout(doBind, 30));
    /* Курсор одразу в полі: блок відкрився рівно для того, щоб сюди
       вставили адресу, і зайвий клік тут ні до чого. */
    if(!(crmSeek[o.id] || {}).binding && document.activeElement !== urlIn){
      try{ urlIn.focus(); }catch(e){}
    }
  }
  const go = panel.querySelector('.od-crm-go');
  const inp = panel.querySelector('.od-crm-inp');
  if(go && inp){
    // Панель перемальовується від оновлення стрічки — недописане повідомлення
    // не має від цього зникати.
    inp.addEventListener('input', ()=>{ if(crmChat[o.id]) crmChat[o.id].draft = inp.value; });
    const send = ()=>{ const t = inp.value; inp.value = '';
      if(crmChat[o.id]) crmChat[o.id].draft = ''; crmSend(o, t); };
    go.addEventListener('click', send);
    inp.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
    });
  }
}

/* ============================================================
   ВІКНО ДІАЛОГУ — спільне для Telegram і Sitniks

   Переписуватись у вузькій колонці картки незручно: рядок на два слова,
   стрічка на пів екрана, і кожне перемальовування картки збиває місце.
   Тому розмова відкривається окремим вікном у пропорціях телефона — так,
   як менеджер звик у месенджері. На весь монітор не розтягуємо навмисно:
   довгий рядок у переписці читається гірше за вузький.

   Джерело даних лишається тим самим — жива підписка Telegram або опитування
   Sitniks. Вікно тільки показує; воно нічого не знає про те, звідки взялись
   повідомлення, крім однієї літери в chatWin.kind.
   ============================================================ */
let chatWin = null;   // { id, kind:'tg'|'crm', draft, qr, busy }
let cwMainTop = 0;    // прокрутка дошки, поки її ховає зона переписки

/* Одна форма повідомлення на обидва джерела — інакше кожну дрібницю
   (час, підпис автора, картинку) довелось би правити у двох місцях. */
function chatMsgs(o, kind){
  const черга = obVisible(o, kind === 'tg' ? 'tg' : 'crm').map(x => ({
    at: x.at, text: x.text, mine: true, kind: 'text', by: x.by, files: x.files || [],
    pending: x.state === 'pending', ob: x.state, obId: x.id, obErr: x.err, obO: o.id }));
  if(kind === 'tg'){
    return ((tgChat[o.id] || {}).msgs || []).map(m => ({
      at: m.at, text: m.text, mine: m.mine, kind: m.kind, by: m.by, gone: !!m.gone,
      files: m.file ? [{ url: m.file, kind: 'img' }] : [], srv: true
    })).concat(черга);
  }
  const msgs = (crmChat[o.id] || {}).msgs || [];
  return msgs.map((m, i) => {
    /* Своє фото, яке Sitniks прийняв, але ще не повернув у переписку, — ✓.
       Свої вкладення Sitniks у стрічку часто не повертає ЗОВСІМ, і фото,
       яке клієнт давно бачить у Direct, вічно стояло з одною ✓ (Андрій,
       16.10). Доставленим вважаємо, коли Sitniks дав повідомленню номер
       (воно є в його розмові й пішло в Instagram) або коли клієнт уже
       написав після нього. */
    const дійшло = !!(m.local && !m.pending &&
      (String(m.lt || '').charAt(0) === '#' ||
       msgs.slice(i + 1).some(x => x && !x.local && !x.mine && !x.gone)));
    return {
      at: m.at, text: m.text, mine: m.mine, kind: 'text', by: m.by, gone: !!m.gone,
      pending: !!m.pending, files: m.files || [], srv: !m.local || дійшло,
      ob: (m.local && !m.pending && !дійшло) ? 'sent' : undefined
    };
  }).concat(черга);
}
/* Повідомлення підряд від однієї сторони стоять щільніше й з менш зрізаними
   кутами — видно, що це одна репліка.

   А от ЧАС стоїть під кожним. Спершу він був лише під останнім у групі:
   так стрічка виглядала спокійніше. Але в переписці з клієнтом час — не
   прикраса: за ним видно, скільки людина чекала на відповідь і коли саме
   надійшла вимога. Коли він один на п'ять повідомлень, чотири з них
   лишаються без часу зовсім, і відновити його нізвідки.

   Підпис менеджера залишився під останнім: він у групі той самий, і
   повторювати його щоразу — це вже шум, а не відомість. */
/* ══════════ «ПРОЧИТАНО» РУКАМИ ═══════════════════════════════════════

   Непрочитане система рахує сама: скільки клієнт написав після нашої
   останньої відповіді. Правило добре рівно настільки, наскільки вона
   правильно розрізняє, де чия репліка, — а розрізняє вона ланцюжком
   здогадів, бо прямої ознаки Sitniks не дає. Варто нашій відповіді поїхати
   ліворуч, як розмова спалахує «непрочитаною», хоча клієнт там не сказав
   ні слова. Андрій це й побачив: «по факту це наші просто діалоги в ліву
   сторону полетіли».

   Тому додаємо те, чого бракувало: людина дивиться й каже сама. Позначка
   ставиться на МИТЬ останнього повідомлення, а не просто «нуль»: інакше
   наступний же такт опитування перерахував би хвіст і повернув кружечок.
   Знімається так само одним дотиком — помилився або хочеш повернутись
   пізніше. */
function chatWaiting(o, kind){
  if(!o) return false;
  if(kind === 'tg') return tgUnread(o);
  return !!(o.crmTheirs || (+o.crmUnread || 0) > 0);
}
/* До якої миті розмову прочитано. Усе давніше або рівне не рахується
   непрочитаним — ні в кружечку на картці, ні рискою в стрічці. */
function crmSeenAt(o){ return String((o && o.crmSeen) || ''); }
/* СКІЛЬКИ ПРОПУЩЕНО — ОДИН ПІДРАХУНОК НА ВСІ МІСЦЯ (16.10).
   Хвіст клієнтських реплік у кінці стрічки — до нашої репліки або до
   позначки «прочитано». Позначка — конкретне повідомлення (crmSeenK) і
   точна мить (crmSeenTs, мс); стара позначка хвилиною (crmSeen) — лише для
   записаних до 16.10. */
function crmMsgId(m){ return (m && m.id) ? 'id:' + m.id : crmMsgKey(m); }
function crmTailOf(o, живі){
  const key = String((o && o.crmSeenK) || ''), keyT = String((o && o.crmSeenKt) || '');
  const ts = +((o && o.crmSeenTs) || 0), хв = crmSeenAt(o);
  let n = 0;
  for(let i = (живі || []).length - 1; i >= 0; i--){
    const m = живі[i];
    if(!m || m.mine) break;
    /* Те саме повідомлення: за id, коли він є з обох боків, інакше — за
       текстом і файлами. */
    if(m.id && key.indexOf('id:') === 0 ? ('id:' + m.id) === key : (keyT && crmMsgKey(m) === keyT)) break;
    /* Давніше за позначку: точним часом, коли він є з обох боків, інакше —
       хвилиною (записи до 16.10 і стрічки без секунд). */
    if(ts && m.ts){ if(m.ts <= ts) break; }
    else if(хв && m.at && m.at <= хв) break;
    n++;
  }
  return n;
}
/* Поставити позначку «прочитано тут»: на останню репліку стрічки, а як
   стрічки ще немає — на цю мить. */
function crmSeenMark(o){
  const st = crmChat[o.id] || {};
  const живі = (st.msgs || []).filter(m => m && !m.gone && !m.local);
  const ост = живі[живі.length - 1];
  o.crmSeenK = ост ? crmMsgId(ост) : '';
  o.crmSeenKt = ост ? crmMsgKey(ост) : '';
  /* Без стрічки — по останній репліці, яку бачив обхід (час Sitniks, а не
     годинник браузера: той може відставати чи поспішати). */
  o.crmSeenTs = ост ? (ост.ts || 0) : (crmTime(o.crmAt) || Date.now());
  o.crmSeen = (ост && ост.at) || (o.crmAt ? String(o.crmAt).replace('T', ' ').slice(0, 16)
                                           : new Date().toISOString().replace('T', ' ').slice(0, 16));
  o.crmUnread = 0; o.crmTheirs = false;
  /* ЖИВА КАРТКА ТЕЖ (20.10). Дошка дизайну шле зі своєї копії замовлення —
     позначка лягала на копію, а чати й канбан дивляться на живу, і «2»
     висіло далі, хоча ми вже відповіли. */
  const live = crmLive(o);
  if(live && live !== o){
    ['crmSeenK', 'crmSeenKt', 'crmSeenTs', 'crmSeen', 'crmUnread', 'crmTheirs'].forEach(k => { live[k] = o[k]; });
    crmKeep(o);
  }
}
function crmSeenClear(o){ o.crmSeen = ''; o.crmSeenK = ''; o.crmSeenKt = ''; o.crmSeenTs = 0; }
/* ПОЗНАЧИТИ РОЗМОВУ ПРОЧИТАНОЮ — ОДНЕ МІСЦЕ НА ВСІ ПРИВОДИ.

   Приводів два: відкрили й прочитали, або натиснули око. Вони мають робити
   рівно те саме, інакше око «спрацьовує», а відкривання ні, і менеджер не
   розуміє, за яким правилом число зникає.

   Нічого не міняємо, коли непрочитаного й не було: зайвий запис у базу на
   кожне відкривання розмови — це сотні записів за день ні за чим. */
function chatMarkRead(o, kind){
  if(!o || !chatWaiting(o, kind)) return false;
  if(kind === 'tg'){ o.tgSeen = o.tgAt; o.tgSeenWrote = +o.tgWrote || 0; }
  else {
    /* Мить останньої репліки в стрічці, а як її немає — час картки. Саме
       мить, а не «прочитано»: інакше наступний такт опитування перерахує
       хвіст і поверне число назад. */
    crmSeenMark(o);
  }
  /* Число біля розділу гасне ТІЄЇ Ж МИТІ, а не з наступним тактом. Запис у
     базу йде своїм ходом — чекати на мережу, щоб прибрати цифру, яка вже
     неправдива, немає жодних підстав. */
  chatsRepaint();
  saveOrders({ quiet:true }).then(chatsRepaint)
    .catch(e => console.warn('прочитано', e));
  return true;
}
/* Перемалювати все, що показує непрочитане: дошку, список розмов і число
   біля розділу. Доти число оновлювалось лише поки ви стоїте на вкладці
   чатів — тобто саме тоді, коли на нього вже не дивляться. */
function chatsRepaint(){
  try{ renderBoard(); }catch(e){}
  /* chatsLive перемальовує і список розмов, і число біля розділу — тобто
     обидва місця, де непрочитане видно. */
  try{ chatsLive(); }catch(e){}
}
function chatSeenToggle(o, kind){
  if(!o) return;
  const було = chatWaiting(o, kind);
  /* ХТО НАТИСНУВ ОКО (17.10, Андрій): в історії замовлення видно, хто
     позначив розмову прочитаною — і скільки там було непрочитаного, — щоб
     перевірити «прочитав і не відповів». */
  o.seenHist = (Array.isArray(o.seenHist) ? o.seenHist : []).concat([{
    at: new Date().toISOString(), by: myEmail() || '', on: !!було, ch: kind === 'tg' ? 'tg' : 'ig',
    n: було ? (kind === 'tg' ? (tgUnreadCount(o) || 0) : (+o.crmUnread || 0)) : 0 }]).slice(-40);
  if(kind === 'tg'){
    if(було){ o.tgSeen = o.tgAt; o.tgSeenWrote = +o.tgWrote || 0; }
    else { o.tgSeen = ''; o.tgSeenWrote = null; }
  } else if(було){
    crmSeenMark(o);
  } else {
    crmSeenClear(o);
    /* Повертаємо рівно те, що система рахує сама: хвіст клієнтських реплік
       після нашої останньої відповіді. Вигадувати одиницю не можна — вона
       розійдеться з тим, що покаже наступний такт. */
    const st = crmChat[o.id] || {};
    let хвіст = 0;
    хвіст = crmTailOf(o, (st.msgs || []).filter(m => m && !m.gone));
    o.crmUnread = хвіст || 1;
    o.crmTheirs = true;
  }
  /* Натиск на око — це вже свідома дія, а не просто «дивлюсь». Тож і риску
     «нові» він знімає одразу: менеджер сказав «я це бачив», і повертати
     йому червону смугу на тому ж місці означає не вірити. Відкривання
     розмови риску лишає — там вона ще потрібна, щоб знати, звідки читати. */
  if(chatWin && chatWin.id === o.id) chatWin.mark = crmSeenAt(o);
  /* Те саме перемальовування, що й при звичайному прочитанні: число біля
     розділу має згаснути від натиску, а не з наступним тактом. */
  saveOrders({ quiet:true }).then(chatsRepaint).catch(e => console.warn('прочитано', e));
  chatsRepaint();
  renderChatWin();
  try{ renderOrderDrawer(); }catch(e){}
  toast(було ? 'Позначено прочитаним' : 'Повернуто в непрочитані');
}
/* ПЕРЕСЛАТИ ДИЗАЙНЕРУ (20.10, Андрій): ➤ на повідомленні клієнта — одне;
   ➤ унизу біля скріпки вмикає галочки — кілька разом. Саме пересилання
   робить відділ дизайну (`LQDesign.ui.forwardToDesigner`). */
function chatFwdOn(){
  return !!(chatWin && chatWin.kind === 'crm' && window.LQDesign && window.LQDesign.ui &&
            typeof window.LQDesign.ui.forwardToDesigner === 'function');
}
function chatRowsHtml(msgs){
  let lastDay = '';
  const list = msgs || [];
  if(chatWin) chatWin.rows = list;
  const fwd = chatFwdOn();
  const sel = (chatWin && chatWin.fwdSel) || {};
  /* ── МЕЖА НЕПРОЧИТАНОГО ────────────────────────────────────────────────
     Андрій: «одразу заходиш в діалог, одразу бачиш непрочитане
     повідомлення». Доти розмова відкривалась просто в кінці: якщо клієнт
     написав пʼять разів, менеджер бачив пʼяте й мусив гортати вгору,
     вгадуючи, звідки почалось те, чого він ще не читав.

     Межа стоїть там, де починається остання суцільна черга клієнтських
     реплік — тобто все, що надійшло ПІСЛЯ нашої останньої відповіді. Це та
     сама величина, яку показує кружечок на картці, тож дошка й розмова
     кажуть одне й те саме.

     Коли відповіді не було взагалі, межу не малюємо: риска над першим же
     рядком розмови нічого не відділяє. */
  let межа = -1;
  {
    /* Наше з черги відправленого (ще в дорозі чи не вийшло) межі не зсуває. */
    let i = list.length - 1, n = 0;
    while(i >= 0 && list[i] && list[i].ob) i--;
    while(i >= 0 && list[i] && (list[i].gone || !list[i].mine)){
      if(!list[i].gone) n++;
      i--;
    }
    if(n > 0 && i >= 0) межа = i + 1;
  }
  /* Прочитане руками риски не має. Менеджер сказав «я це бачив» — і
     повертати йому червону смугу на тому ж місці означає не вірити. */
  if(межа >= 0){
    /* Межу беремо ТУ, ЩО БУЛА В МИТЬ ВІДКРИТТЯ, а не поточну. Відкривання
       розмови саме ставить позначку «прочитано» — і якби риска рахувалась
       від неї, вона зникала б тієї ж секунди, разом із єдиною відповіддю на
       питання «звідки читати». Поки розмова відкрита, риска стоїть; наступне
       відкриття її вже не покаже, і це правильно: прочитане новим не буває. */
    const до = (chatWin && chatWin.mark != null)
      ? chatWin.mark
      : ((typeof crmSeenAt === 'function' && chatWin)
        ? crmSeenAt((orders || []).find(x => x.id === chatWin.id)) : '');
    if(до){
      let свіже = -1;
      for(let k = межа; k < list.length; k++)
        if(list[k] && !list[k].gone && !list[k].ob && (!list[k].at || list[k].at > до)){ свіже = k; break; }
      межа = свіже;
    }
  }
  const новихN = (межа >= 0) ? list.slice(межа).filter(m => m && !m.gone && !m.ob).length : 0;
  return list.map((m, i) => {
    const loc = crmKyiv(m.at);
    const day = loc.slice(0, 10);
    let sep = '';
    if(day && day !== lastDay){
      lastDay = day;
      sep = `<div class="od-crm-day">${escapeHtml(crmDayLabel(day))}</div>`;
    }
    /* Межа йде ПІСЛЯ дати, а не перед: спершу «сьогодні», потім «нові».
       Навпаки виходило б, що нове почалось учора, а дата стоїть під ним. */
    if(i === межа)
      sep += `<div class="od-crm-new" data-crm-new>` +
        `${новихN === 1 ? 'нове повідомлення' : 'нових повідомлень · ' + новихN}</div>`;
    const time = loc.slice(11, 16);
    // Помітка лише тоді, коли самого файлу немає. Фото, яке воркер переклав
    // у Cloudinary, показуємо картинкою — «відкрийте в Telegram» тут було б
    // неправдою.
    const mark = (m.kind && m.kind !== 'text' && !(m.files || []).length)
      ? `<div class="od-crm-kind">${escapeHtml(TG_KIND_UA[m.kind] || m.kind)} — відкрийте в Telegram</div>` : '';
    const nxt = list[i + 1];
    /* Група — це не просто «підряд з одного боку», а підряд від однієї
       ЛЮДИНИ. Інакше дві репліки різних менеджерів злипались в одну, і
       підпис лишався тільки від останнього: виходило, що написав не той. */
    const grouped = nxt && !!nxt.mine === !!m.mine &&
                    String(nxt.by || '') === String(m.by || '') &&
                    crmKyiv(nxt.at).slice(0, 10) === day;
    // Наведення показує повну дату з секундами: у спорі «коли саме він це
    // написав» хвилин буває замало
    const full = crmFullStamp(m.at);
    /* Підпис — під КОЖНИМ нашим повідомленням, а не лише під останнім у
       групі. Доти підряд надіслані репліки підписувались один раз унизу:
       економія на повторі виглядала розумною, поки менеджерів було видно
       по одному. А в розмові, де відповідали двоє, читати доводилось так:
       «ось три повідомлення, а внизу імʼя — чиє воно, останнього чи всіх
       трьох?». Питання «хто це писав» виникає до кожного рядка окремо, і
       відповідь має стояти при кожному. */
    const sign = (m.mine && m.by) ? String(m.by).split('@')[0] : '';
    return sep + `
      <div class="od-crm-msg ${m.mine ? 'mine' : ''}${grouped ? ' grouped' : ''}${
        m.gone ? ' gone' : ''}${m.pending ? ' pending' : ''}${m.ob === 'failed' ? ' ob-failed' : ''}">
        ${m.gone ? `<div class="od-crm-gone">Видалено ${
          m.mine ? 'нами' : 'клієнтом'} — у чаті цього більше немає</div>` : ''}
        ${crmFilesHtml(m.files)}
        ${m.text ? `<div class="od-crm-txt">${escapeHtml(m.text)}</div>` : ''}
        ${mark}
        ${(fwd && !m.mine && !m.gone && (m.text || (m.files || []).length))
          ? (chatWin.fwdMode
            ? `<label class="od-crm-fwdc"><input type="checkbox" data-cw-fwdc="${i}"${sel[i] ? ' checked' : ''}></label>`
            : `<button type="button" class="od-crm-fwd" data-cw-fwd="${i}" title="Переслати дизайнеру">➤</button>`)
          : ''}
        ${/* Підпис показуємо навіть тоді, коли часу ще немає: щойно надіслане
             повідомлення стоїть у стрічці без позначки часу (її поставить
             сервер), а хто його написав — відомо вже зараз. */''}
        ${/* «Надсилаю…» замість часу, поки репліка ще летить: часу в неї
             поки що немає й бути не може, а сказати щось треба. */''}
        ${/* Стан нашого повідомлення (14.10): ⏱ летить, ✓ Sitniks прийняв,
             ✓✓ уже в переписці, червоне — не вийшло, з «Повторити». */''}
        ${m.ob === 'failed'
          ? `<div class="od-crm-at ob-fail">не надіслано${m.obErr ? ' · ' + escapeHtml(String(m.obErr).slice(0, 90)) : ''}
               <button type="button" class="ob-b" data-ob-retry="${escapeHtml(m.obId)}" data-ob-o="${escapeHtml(m.obO)}">↻ Повторити</button>
               <button type="button" class="ob-b" data-ob-drop="${escapeHtml(m.obId)}" data-ob-o="${escapeHtml(m.obO)}">Прибрати</button></div>`
          : (time || sign || m.pending || m.ob) ? `<div class="od-crm-at"${
          full ? ` title="${escapeHtml(full)}"` : ''}>${
          m.pending ? '<span class="ob-t" title="Надсилаю…">⏱</span> надсилаю…' + (sign ? ' · ' + escapeHtml(sign) : '')
          : m.ob === 'sent' ? escapeHtml([crmKyiv(m.at).slice(11, 16), sign].filter(Boolean).join(' · ')) + ' <span class="ob-t" title="Sitniks прийняв — чекаємо, коли з\'явиться в переписці">✓</span>'
                    : escapeHtml([time, sign].filter(Boolean).join(' · ')) +
                      (m.mine && m.srv && !m.gone ? ' <span class="ob-t ob-2" title="У переписці клієнта">✓✓</span>' : '')}</div>` : ''}
      </div>`;
  }).join('');
}

/* ── Готові відповіді ─────────────────────────────────────────────────────
   Менеджер щодня пише те саме: привітання, питання про тираж, реквізити.
   Набирати це вручну — і довго, і щоразу трохи інакше. Тексти живуть у
   налаштуваннях, а не в коді: правити їх має менеджер, не розробник.

   Підстановки роблять заготовку живою — інакше в чат летіло б «Вітаю,
   {імʼя}» буквально. */
/* Текст, який іде разом із посиланням на КП. Один на всі бренди —
   міняється лише адреса. Порожній рядок між абзацами навмисно: у
   месенджерах це три окремі репліки в одному повідомленні. */
const OFFER_MSG_DEFAULT =
  'Підготувала для вас пропозицію за вашим запитом 👌\n' +
  'Тут є візуалізації з вашим брендингом, розрахунок вартості та всі ' +
  'деталі замовлення.\n\n' +
  'Переглянути пропозицію →\n{кп}\n\n' +
  'Якщо виникнуть питання — із задоволенням на все відповім)';
const CARDS_MSG_DEFAULT =
  'Підготувала для вас прорахунок 👌\n' +
  'Нижче — візуалізації з вашим брендингом, ціни й усі деталі.\n' +
  'Якщо виникнуть питання — із задоволенням на все відповім)\n{картки}';
const UPSELL_MSG_DEFAULT =
  'До цього зазвичай беруть ще ось це 👇\n' +
  'Ціни вже з урахуванням вашого тиражу.\n{допродаж}';
/* ЗАГОТОВКИ B2C (20.10, Андрій і Анастасія). Тексти — лише тут і в
   налаштуваннях, у коді клієнтських слів більше немає. Довгих тире не
   вживаємо. Розкладено по блоках (`g`), як їх шукають у розмові:
   «До картинок» ідуть самі разом з ескізом чи варіантами, решту менеджер
   вставляє з ⚡. Числа ({залишок}, {ціна:tee}, {доплата:18}…) — з картки й
   налаштувань у мить вставки, тож ціна в листі не розійдеться з адмінкою. */
const QR_GROUPS = [
  ['pic',     'До картинок · ідуть самі разом з ескізом чи варіантами'],
  ['order',   'Замовлення'],
  ['pay',     'Оплата й ціни'],
  ['size',    'Розмір вишивки'],
  ['edit',    'Правки й пояснення'],
  ['ship',    'Доставка'],
  ['after',   'Після замовлення'],
  ['problem', 'Проблемні ситуації'],
  ['',        'Інше']
];
const QR_B2C = [
  { g:'pic', t:'Перший ескіз', m:'{макет} Добрий день! Подивіться, як гарно вийшло 😊 Вам подобається?' },
  { g:'pic', t:'Ескіз після правок', m:'{правки} Добрий день! Внесли правки 😊 Вам подобається?' },
  { g:'pic', t:'Варіанти на вибір', m:'{варіанти-вибір} Подивіться, ось варіанти на вибір 😊 Який варіант вам більше подобається?\n{варіанти}' },
  { g:'pic', t:'Напис на картці варіантів', m:'{картка-варіантів} Варіанти на вибір\nНапишіть номер варіанта, який подобається більше' },
  /* Фіксація (20.10, Андрій): привітання, кожна позиція і прохання
     перевірити — ОКРЕМИМИ повідомленнями («---» — межа), без виду й
     розміру вишивки; розмір не вказано — прочерк. */
  { g:'order', t:'Фіксую замовлення', m:'Я рада, що вам подобається 😊 Давайте зафіксуємо ваше замовлення, щоб ніде не помилитись.\n---\n{фіксація}\n---\nПеревірте, будь ласка, уважно й напишіть нам, чи все правильно 🙏' },
  { g:'pay', t:'Оплата залишку: 2 варіанти', m:'Підкажіть, як вам зручніше оплатити залишок по замовленню, {залишок} грн:\n\n1. Повна оплата за реквізитами\n2. Оплата при отриманні (комісія Нової Пошти за переказ 30 грн + 2% від суми)\n\nЯкий спосіб вам зручніший?' },
  { g:'pay', t:'Залишок за тими ж реквізитами', m:'Залишок по вашому замовленню {залишок} грн 😊 Можна сплатити за тими ж реквізитами.' },
  { g:'pay', t:'Ціни на вироби', m:'🏷 футболка з вишивкою, {ціна:tee} грн\n🏷 світшот з вишивкою (кофта без капюшону), {ціна:sweat} грн\n🏷 худі з вишивкою (кофта з капюшоном), {ціна:hoodie} грн\n🏷 кепка з вишивкою, {ціна:cap} грн\n🏷 шопер з вишивкою, {ціна:tote} грн\n\n+ розробка дизайну по вашому фото для вишивки, {розробка} грн' },
  { g:'size', t:'Збільшення вишивки', m:'Стандартна вишивка 10 см входить у вартість 😊\n\nМожна збільшити:\n{збільшення}\n\nБажаєте збільшити зображення?' },
  { g:'size', t:'Широкий напис по центру', m:'Для напису по центру (MOM, DAD тощо) стандарт 20 см завширшки, входить у вартість.\n\nШирше:\n• 23 см, +200 грн\n• 25 см, +400 грн\n• 27 см, +600 грн\nі далі кожні 2-3 см ще +200 грн.' },
  { g:'edit', t:'Правки: усе одразу', m:'Гаразд 😊 Виконуємо, дизайнер внесе правки, і ми надішлемо оновлений варіант.\n\nМаленьке прохання: якщо є ще побажання, напишіть, будь ласка, все одразу одним повідомленням 🙏 Коли правки надходять поступово, це ускладнює роботу й збільшує термін.\n\nЦе вже всі моменти, які хотілося б змінити? 😊' },
  { g:'edit', t:'Риси обличчя: збільшити або обрізати', m:'Виробництво не рекомендує вишивати риси обличчя на такому розмірі: це надто деталізована вишивка, і вона може вийти неохайно 😔\n\nМожемо запропонувати:\n• збільшити вишивку: 18 см, {доплата:18} грн; 23 см, {доплата:23} грн; 25 см, {доплата:25} грн\n• або обрізати фото по плечі, тоді риси гарно вишиваються без збільшення\n\nЯкий варіант вам підійде?' },
  { g:'edit', t:'Риси обличчя: радимо без рис', m:'Виробництво переглянуло фото й рекомендує вишити без рис обличчя: така вишивка надто деталізована і в готовому вигляді може виглядати не так охайно, як хотілося б 😔\n\nЧерез особливості машинної вишивки й товщину нитки дрібні елементи можуть бути менш чіткими, ніж на фото. Тому радимо варіант без рис, він виглядає охайніше й передбачуваніше ✨\n\nЗалишаємо без рис обличчя? 😊' },
  { g:'edit', t:'Ескіз занадто деталізований', m:'Ваш ескіз дуже гарний, але занадто деталізований: через особливості машинної вишивки дрібні деталі можуть втрачатись або виходити неохайно 🙌🏻\n\nПеред виготовленням вишивальний дизайнер адаптує макет під машинну вишивку: підбирає щільність стібків, напрямки ниток, кольори й переходи, щоб виріб виглядав об\'ємно й акуратно.\n\nТому готова вишивка виглядатиме як у наших прикладах на сторінці, а не як плоский цифровий ескіз 🤍' },
  { g:'edit', t:'Ескіз і вишивка відрізняються', m:'Хочемо звернути увагу, що графічний макет і готова вишивка візуально відрізнятимуться 🤍\n\nЕскіз є пласким зображенням, він не передає фактуру й об\'єм ниток. Готова вишивка матиме структуровану поверхню, текстуру й рельєф завдяки переплетенню ниток. Тому зображення з імітацією вишивки може виглядати дещо інакше, ніж графічний макет.\n\nЦе природна особливість вишивки, адже нитки створюють власну фактуру та гру відтінків 🙏' },
  { g:'ship', t:'Дані для відправки', m:'Напишіть, будь ласка, ваші дані для відправки 🤗 ПІБ, телефон, місто й відділення Нової Пошти.' },
  { g:'ship', t:'Дані для відправки за кордон', m:'Для доставки за кордон нам потрібно:\n• країна й місто\n• номер відділення НП або ваша адреса з індексом\n• електронна адреса\n• ПІБ латиницею\n• номер телефону оператора країни, куди буде доставка' },
  { g:'ship', t:'Оплата доставки за кордон', m:'Доставка за кордон сплачується при відправці, тому її потрібно оплатити наперед за тими ж реквізитами 🤗\n\nРозрахували суму доставки за вашими даними: до оплати ... грн.' },
  { g:'after', t:'Передаю на виробництво', m:'Передаю ваше замовлення на виробництво, очікуйте на відправку 🤗\n\nДякуємо за замовлення!' },
  { g:'after', t:'Догляд за виробом', m:'Догляд за виробом:\n• машинне прання при 30 °C\n• прасування при мінімальній температурі\n• не використовувати машинне сушіння\n• не використовувати хлорні відбілювачі\n• не піддавати хімічному чищенню' },
  { g:'problem', t:'Компенсація 300 грн', m:'Добрий день! Дякуємо за звернення. Перепрошуємо за похибку у вашому замовленні, нам дуже шкода, що ця ситуація зіпсувала вам настрій 🤍\n\nДозвольте запропонувати компенсацію 300 грн на вашу картку, щоб хоч частково загладити ситуацію.\n\nНадішліть, будь ласка, номер картки 🙏' },
  { g:'problem', t:'Затримка замовлення', m:'Добрий день! Щиро перепрошуємо за затримку вашого замовлення 🙏\n\nЧерез постійні обстріли й перебої в роботі постачальників одяг надходить із затримкою, а відповідно затримується й виконання замовлень.\n\nДякуємо за розуміння й терпіння 🤍 Ми зробимо все можливе, щоб якнайшвидше виконати й відправити ваше замовлення.' },
  { g:'problem', t:'Повернення коштів', m:'Звичайно, ми поважаємо ваше рішення 🤍\n\nДля повернення коштів надішліть, будь ласка, номер картки. Сума повернення буде за вирахуванням 300 грн: вони покривають уже виконану роботу дизайнера над ескізом і матеріали.\n\nПовернення здійснюється протягом 7 робочих днів. Дякуємо за розуміння! 🙏' }
].map(q => Object.assign({ dir:'b2c' }, q));
const QR_DEFAULT = [
  { t:'Вітання', dir:'b2b', m:'Вітаю! Це {бренд}. Підкажіть, будь ласка, що плануєте нанести і на який одяг — підберемо і порахуємо.' },
  { t:'Тираж', dir:'b2b',   m:'Підкажіть орієнтовну кількість і розмірний ряд — від тиражу суттєво залежить ціна.' },
  /* ДВА СКРИПТИ З КАРТКАМИ: прорахунок і «до цього зазвичай беруть».
     Позначка `{картки}` / `{допродаж}` — команда: відкриває вибір карток. */
  { t:'Надсилаю прорахунок', dir:'b2b', m: CARDS_MSG_DEFAULT },
  { t:'Допродаж', dir:'b2b',            m: UPSELL_MSG_DEFAULT },
  { t:'Оплата', dir:'b2b',  m:'Працюємо за передоплатою 50%, решта — перед відправкою. Рахунок виставляємо на ФОП.' },
  { t:'Макет', dir:'b2b',   m:'Надішліть, будь ласка, логотип у векторі (.ai, .eps, .pdf або .svg). Якщо вектора немає — надішліть що є, підготуємо самі.' },
  { t:'Посилання на КП', dir:'b2b', m: OFFER_MSG_DEFAULT },
  { t:'Макет на погодження · B2B', dir:'b2b',
    m:'{макет} Надсилаємо макет на погодження ({версія}). Розміри нанесення ' +
      'вказані на самій картці.\n\nЯкщо все влаштовує — запускаємо у виробництво. ' +
      'Якщо потрібні зміни, напишіть, будь ласка, які саме.' },
  { t:'Макет після правок · B2B', dir:'b2b',
    m:'{правки} Внесли правки — {версія} на погодження. Решта параметрів ' +
      'без змін.' }
].concat(QR_B2C);
/* Одна заготовка — одна форма запису: назва, текст, напрям і блок. Усі
   місця, що переписують список, ідуть через неї, інакше поле губиться. */
function qrPack(q){
  const o = { t: String((q && q.t) || '').trim().slice(0, 60), m: String((q && q.m) || '').trim().slice(0, 1600) };
  const d = qrDirOf(q); if(d) o.dir = d;
  const g = String((q && q.g) || ''); if(g && QR_GROUPS.some(x => x[0] === g)) o.g = g;
  return o;
}
function quickReplies(){
  const q = (contentData || {}).quickReplies;
  const l = (Array.isArray(q) && q.length) ? q : QR_DEFAULT;
  /* НАПРЯМ, ЯКИЙ ЗЛЕТІВ (14.10). Редактор у налаштуваннях доти зберігав
     заготовки без `dir`, і B2B-скрипти почали показуватись у B2C й навпаки.
     Повертаємо його за назвою («· B2B» / «· B2C»); решту людина розкладе
     сама в редакторі. */
  return l.map(x => {
    if(!x || x.dir) return x;
    const t = String(x.t || '');
    const d = /·\s*B2C\s*$/i.test(t) ? 'b2c' : /·\s*B2B\s*$/i.test(t) ? 'b2b' : '';
    return d ? Object.assign({}, x, { dir: d }) : x;
  });
}
/* ── ЗАГОТОВКИ РІЗНИХ НАПРЯМІВ ────────────────────────────────────────────

   Андрій: «B2B одні скрипти, B2C інші… просто щоб вони не були однакові».

   Він має рацію, і це не про ввічливість. Компанії пишуть «виставимо рахунок
   на ФОП, працюємо за передоплатою 50%»; приватній людині в Директ таке
   слати нема сенсу — вона платить одразу й повністю, і половина слів у
   листі про неї не про неї. А B2C-заготовка з «ти» в листі до відділу
   закупівель виглядає так само не туди.

   Тому в заготовки зʼявився напрям: порожній означає «годиться обом», а
   `b2b`/`b2c` — тільки своєму. Порожній лишається за замовчуванням, щоб усе
   вже написане працювало так само, як працювало. */
function qrDirOf(q){
  const d = String((q && q.dir) || '').toLowerCase();
  return (d === 'b2b' || d === 'b2c') ? d : '';
}
/* Напрям розмови: розділ, з якого її відкрили, інакше — замовлення. */
function chatDirOf(o){
  return (chatWin && o && chatWin.id === o.id && chatWin.sect) ? chatWin.sect : orderDir(o);
}
function quickRepliesFor(o){
  const dir = chatDirOf(o);
  return quickReplies().filter(q => { const d = qrDirOf(q); return !d || d === dir; });
}
/* ── СКРИПТ ЗА ПОЗНАЧКОЮ ──────────────────────────────────────────────────

   Показ макета клієнту робиться з картки одним натиском, і текст до нього
   не пишуть руками щоразу — його беруть звідси. Позначка в тілі заготовки
   каже, який це скрипт; назву менеджер перепише як завгодно, і впізнати
   скрипт по ній не вийде.

   Немає заготовки — беремо запасну. Мовчазне порожнє повідомлення тут
   гірше за просте: клієнт отримав би картинку без жодного слова. */
const SCRIPT_MARK = { design1:'{макет}', design2:'{правки}', vars:'{варіанти-вибір}', varsCard:'{картка-варіантів}' };
const SCRIPT_MARK_RE = /\{макет\}|\{правки\}|\{готовий\}|\{варіанти-вибір\}|\{картка-варіантів\}/g;
/* Готовий дизайн — той самий перший показ (20.10, Андрій: «перший — подивіться,
   як гарно вийшло»): окремого тексту в нього більше немає. */
function scriptKey(key){ return key === 'ready' ? 'design1' : key; }
/* Запасний — стандартна заготовка з того ж списку, а не окремий текст у
   коді: заготовку прибрали зовсім, і клієнт не має отримати картинку без
   жодного слова. */
function scriptFall(key, dir){
  const mark = SCRIPT_MARK[key] || '';
  const q = QR_DEFAULT.filter(x => qrDirOf(x) === dir && String(x.m || '').indexOf(mark) >= 0)[0];
  return q ? String(q.m) : '';
}
function scriptRaw(o, key, dir){
  key = scriptKey(key);
  const mark = SCRIPT_MARK[key] || '';
  if(!mark) return '';
  const d0 = (dir === 'b2c' || dir === 'b2b') ? dir : chatDirOf(o);
  const q = quickReplies().filter(x => { const d = qrDirOf(x); return !d || d === d0; })
    .filter(x => String((x && x.m) || '').indexOf(mark) >= 0)[0];
  return q ? String(q.m) : scriptFall(key, d0);
}
function scriptFor(o, key, vars, dir){
  return qrFill(scriptRaw(o, key, dir), o, vars).trim();
}
/* Напис на картці варіантів: перший рядок — заголовок, решта — примітка. */
function scriptCard(o, dir){
  const l = qrFill(scriptRaw(o, 'varsCard', dir), o).split('\n').map(x => x.trim()).filter(Boolean);
  return { title: l[0] || '', note: l.slice(1).join(' ') };
}
/* ЗБЕРЕГТИ ПРАВЛЕНИЙ ТЕКСТ У ЗАГОТОВКУ НАЗАВЖДИ (14.10). Позначку
   ({макет}, {готовий}…) лишаємо попереду — за нею скрипт і впізнають;
   номер версії повертаємо назад у {версія}. Своєї заготовки для цього
   напряму немає — заводимо. */
async function scriptSave(o, key, text, vars, dir){
  if(!canQuick()){ toast('Правити заготовки — не ваша зона'); return false; }
  key = scriptKey(key);
  const mark = SCRIPT_MARK[key] || '';
  const d0 = (dir === 'b2c' || dir === 'b2b') ? dir : chatDirOf(o);
  let t = String(text || '').trim();
  if(!mark || !t) return false;
  const v = vars && vars.v;
  if(v) t = t.split('v' + v).join('{версія}');
  const list = quickReplies().map(qrPack);
  const i = list.findIndex(x => String(x.m || '').indexOf(mark) >= 0 && qrDirOf(x) === d0);
  if(i >= 0) list[i].m = mark + ' ' + t;
  else list.push(qrPack(Object.assign({}, QR_DEFAULT.filter(x => qrDirOf(x) === d0 && String(x.m).indexOf(mark) >= 0)[0] ||
                   { t: 'Скрипт', g: 'pic' }, { m: mark + ' ' + t, dir: d0 })));
  try{
    await PHOTOS_DOC.set({ quickReplies: list }, { merge:true });
    contentData.quickReplies = list;
    qrDraft = null;
    toast('Заготовку збережено');
    return true;
  }catch(e){ console.error(e); toast('Не збереглось'); return false; }
}
/* СТАНДАРТНІ ЗАГОТОВКИ ДОХОДЯТЬ І ДО НАЛАШТОВАНОГО АКАУНТА.

   Стандартний список бачить лише той, у кого свого немає. У робочому
   акаунті свій список склали давно — і два скрипти з картками, додані
   пізніше, не зʼявились там ніколи. Андрій: «передивляюсь заготовки, немає
   цих прорахунок і допродажу». Тобто вся робота з картками з розмови в
   нього просто не існувала.

   Тому нові скрипти доводимо один раз: чого немає за ПОЗНАЧКОЮ, те
   дописуємо в кінець списку. Саме за позначкою, а не за назвою: назву
   менеджер перепише як завгодно, і впізнати скрипт по ній не вийде.

   Один раз означає один: лишається запис, що вже доводили, і скрипт, який
   менеджер свідомо прибрав, назад не повернеться. */
/* Третє доведення: заготовки показу макета в B2C. Перевірка «позначка +
   напрям» зʼявилась пізніше за саме доведення, і в акаунтах, де воно вже
   пройшло, роздрібних скриптів так і не стало — надсилання йшло запасним
   текстом, без привітання. */
const QR_SEED = 6;   // 6 — фіксація окремими повідомленнями (20.10)
let qrSeeding = false;
async function qrSeedOnce(){
  if(qrSeeding || !canSetup() || !contentLoaded) return;
  const cur = (contentData || {}).quickReplies;
  if(!Array.isArray(cur) || !cur.length) return;   // свого списку немає — стандартний покажеться сам
  if(+(contentData.qrSeed || 0) >= QR_SEED) return;
  /* П'ЯТЕ ДОВЕДЕННЯ (20.10, Андрій: «B2C, чого немає, видаляємо»): старі
     B2C-заготовки — геть, «обом» стають B2B (там їхні слова: ФОП, тираж,
     КП), і весь новий набір B2C по блоках — у кінець. B2B не чіпаємо. */
  let cur2 = cur;
  if(+(contentData.qrSeed || 0) < 5){
    /* Напрям — і той, що виведено з назви «… · B2C». */
    cur2 = quickReplies().map(qrPack).filter(q => qrDirOf(q) !== 'b2c')
      .map(q => qrDirOf(q) ? q : Object.assign(q, { dir: 'b2b' }))
      .concat(QR_B2C.map(qrPack));
  }
  /* ШОСТЕ ДОВЕДЕННЯ (20.10): «Фіксую замовлення» B2C — новий текст, якщо
     менеджер старий не правив (у ньому ще стоїть {вишивка}). */
  if(+(contentData.qrSeed || 0) < 6){
    const нова = QR_B2C.filter(q => q.g === 'order' && /\{фіксація\}/.test(q.m))[0];
    if(нова) cur2 = cur2.map(qrPack).map(q => (qrDirOf(q) === 'b2c' && /\{вишивка\}/.test(String(q.m || '')) && /Фіксую/.test(String(q.m || '')))
      ? Object.assign({}, q, { m: нова.m, t: нова.t, g: нова.g }) : q);
  }
  const have = cur2.map(q => String((q && q.m) || '')).join('\n');
  const add = QR_DEFAULT.filter(q => {
    const m = String(q.m || '');
    const sc = CARD_SCRIPTS[cardScriptOf(m)];
    if(sc) return have.indexOf(sc.mark) < 0;
    /* Скрипти показу макета доводимо тим самим шляхом: за позначкою в тілі,
       а не за назвою. Назву менеджер перепише як завгодно, і впізнати
       скрипт по ній не вийде — а доводити його треба один раз, не щоразу. */
    const mark = Object.keys(SCRIPT_MARK).map(k => SCRIPT_MARK[k])
      .filter(x => m.indexOf(x) >= 0)[0];
    if(!mark) return false;
    /* Кожен напрям свій: у B2B і B2C та сама позначка, і рахувати треба
       пару «позначка + напрям», інакше доїде тільки перший із двох. */
    const d = qrDirOf(q);
    return !cur2.some(x => String((x && x.m) || '').indexOf(mark) >= 0 &&
                          qrDirOf(x) === d);
  });
  qrSeeding = true;
  try{
    if(add.length || cur2 !== cur){
      /* Напрям несемо далі. Доти сівалка перескладала список із двох полів
         і мовчки знімала `dir` з УСІХ заготовок — тобто після першого ж
         доведення B2B-скрипти починали показуватись у B2C і навпаки. */
      const list = cur2.map(qrPack).concat(add.map(qrPack));
      await PHOTOS_DOC.set({ quickReplies: list, qrSeed: QR_SEED }, { merge:true });
      contentData.quickReplies = list;
      toast(cur2 !== cur ? 'Заготовки B2C оновлено: ' + QR_B2C.length + ' по блоках' : 'У заготовки додано: ' + add.map(q => q.t).join(', '));
    }else{
      await PHOTOS_DOC.set({ qrSeed: QR_SEED }, { merge:true });
    }
    contentData.qrSeed = QR_SEED;
  }catch(e){ console.warn('заготовки', e); }
  qrSeeding = false;
}

/* ══════════ КАРТКИ ПРЯМО З РОЗМОВИ ══════════════════════════════════════
   Картки для Direct малювались у вікні пропозиції, і далі їх треба було
   завантажити собі на диск, знайти в теці й перетягнути в месенджер.
   Половина цієї дороги — робота, яку ніхто не замовляв.

   Тепер їх надсилають звідти ж, де говорять. Скрипт відкриває не поле
   вводу, а САМІ КАРТКИ: видно, що саме піде клієнту, і можна зняти зайве.
   Перевірити перед відправкою важливіше, ніж здається: картка збирається з
   замовлення автоматично, і в ній може не виявитись фото спини, яке
   менеджер додати забув.

   Перед картками йде текст скрипта, окремим повідомленням. Так і пишуть у
   Direct: рядок, за ним кадри. */
const CARD_SCRIPTS = {
  kp: { mark:'{картки}',   pick: c => c.kind !== 'reco' },
  up: { mark:'{допродаж}', pick: c => c.kind === 'reco' }
};
function cardScriptOf(text){
  const t = String(text || '');
  for(const k in CARD_SCRIPTS) if(t.indexOf(CARD_SCRIPTS[k].mark) >= 0) return k;
  return '';
}
// Позначка — команда, а не текст. У листі клієнту її бути не може.
function qrNoMarks(text){
  let t = String(text || '');
  for(const k in CARD_SCRIPTS) t = t.split(CARD_SCRIPTS[k].mark).join('');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}
/* Намальовані картки тримаємо на час сеансу: малювання займає секунди, а
   відкривають панель по кілька разів поспіль. Ключ — замовлення, бо картки
   зібрані саме з нього. */
const cardPix = {};
function cardPixDrop(id){
  const store = cardPix[id];
  if(!store) return;
  Object.keys(store).forEach(k => { try{ URL.revokeObjectURL(store[k].url); }catch(e){} });
  delete cardPix[id];
}
async function cardDeckFor(o){
  if(!window.LQCards) throw new Error('малювальник карток ще вантажиться — спробуйте за секунду');
  const models = await cardModelsMap().catch(()=> ({}));
  const offer = offerClean(offerBuild(o));
  const cfg = Object.assign({ models }, o.cards || {});
  const list = window.LQCards.build(offer, cfg).filter(c => !c.hidden);
  if(!list.length) throw new Error('у замовленні немає позицій — картки нема з чого збирати');
  return { list, cfg, offer };
}
async function cardsLoad(o){
  const st = chatWin && chatWin.cards;
  if(!st || st.deck) return;
  st.loading = true; renderChatWin();
  try{
    /* Малюємо наново щоразу: склад замовлення й налаштування карток могли
       змінитись відтоді, як панель відкривали минулого разу, а показувати
       вчорашню ціну — гірше, ніж зачекати дві секунди. */
    cardPixDrop(o.id);
    const deck = await cardDeckFor(o);
    st.deck = deck;
    st.pick = {};
    const sent = o.cardsSent || {};
    /* Галочки за замовчуванням — за скриптом: прорахунок бере основні
       позиції й групи, допродаж — тільки рекомендовані. Те, що вже
       надсилали, не позначаємо: надіслати те саме вдруге — це не турбота,
       а неуважність, і клієнт її бачить. */
    deck.list.forEach(c => {
      st.pick[c.id] = CARD_SCRIPTS[st.kind].pick(c) && !sent[c.id];
    });
  }catch(e){ st.err = (e && e.message) || 'не вдалось зібрати картки'; }
  st.loading = false;
  renderChatWin();
  cardsDraw(o);
}
async function cardsDraw(o){
  const st = chatWin && chatWin.cards;
  if(!st || !st.deck) return;
  const store = cardPix[o.id] || (cardPix[o.id] = {});
  for(const c of st.deck.list){
    if(store[c.id]) continue;
    try{
      const cv = await window.LQCards.draw(c, st.deck.offer, st.deck.cfg);
      /* 0.95, а не 0.92: різниця у вазі — відсотки, а на дрібному тексті
         й тонких лініях логотипа саме вона й з'їдалась артефактами. */
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
      if(blob) store[c.id] = { blob, url: URL.createObjectURL(blob),
                               notes: (cv.lqNotes || []).slice() };
    }catch(e){ console.warn('картка ' + c.id, e); }
    // Показуємо кожну, щойно готова: чекати на всі мовчки — виглядає як зависання
    if(chatWin && chatWin.cards === st){ cardsSync(o); renderChatWin(); }
  }
}
function cardsSentLabel(rec){
  if(!rec || !rec.at) return '';
  const d = new Date(rec.at);
  const day = d.toLocaleDateString('uk-UA', { timeZone:'Europe/Kyiv', day:'2-digit', month:'2-digit' });
  return 'надіслано ' + day + (rec.by ? ' · ' + String(rec.by).split('@')[0] : '');
}
function cardsPanelHtml(o){
  const st = chatWin.cards;
  if(!st) return '';
  if(st.err)
    return `<div class="cw-cards"><div class="cw-cd-note">${escapeHtml(st.err)}</div>
      <div class="cw-cd-acts"><button class="cw-cd-no" data-cd-close>Закрити</button></div></div>`;
  if(st.loading || !st.deck)
    return `<div class="cw-cards"><div class="cw-cd-note">Збираю картки…</div></div>`;
  const store = cardPix[o.id] || {};
  const sent = o.cardsSent || {};
  const n = st.deck.list.filter(c => st.pick[c.id]).length;
  const tiles = st.deck.list.map(c => {
    const pic = store[c.id];
    const was = cardsSentLabel(sent[c.id]);
    const warn = (pic && pic.notes && pic.notes.length) ? pic.notes[0] : '';
    return `<label class="cw-cd${st.pick[c.id] ? ' on' : ''}${was ? ' was' : ''}">
      <input type="checkbox" data-cd="${escapeHtml(c.id)}"${st.pick[c.id] ? ' checked' : ''}>
      <span class="cw-cd-pic">${pic
        ? `<img src="${pic.url}" alt="">`
        : '<i class="cw-cd-wait"></i>'}</span>
      ${pic ? `<button class="cw-cd-big" data-cd-big="${escapeHtml(c.id)}"
        title="Роздивитись">🔍</button>` : ''}
      <span class="cw-cd-nm">${escapeHtml(c.name || 'Картка')}</span>
      ${was ? `<span class="cw-cd-was">${escapeHtml(was)}</span>` : ''}
      ${warn ? `<span class="cw-cd-warn" title="${escapeHtml(warn)}">⚠ неповна</span>` : ''}
    </label>`;
  }).join('');
  return `<div class="cw-cards">
    <div class="cw-cd-head">
      <b>${st.kind === 'up' ? 'Допродаж' : 'Прорахунок'} — що вже в полі</b>
      <span>🔍 — роздивитись · зніміть зайве · текст уже в полі, надішлете самі ➤</span>
      ${/* Хрестик закриває саму панель і НІЧОГО не чіпає: картки лишаються
           в полі, готові до відправки. Це не те саме, що «Прибрати всі», і
           саме тому обидва потрібні: одне ховає вікно, друге скасовує
           підготовку. */''}
      <button class="cw-cd-x" data-cd-hide title="Сховати панель — картки лишаться в полі">✕</button>
    </div>
    <div class="cw-cd-grid">${tiles}</div>
    <div class="cw-cd-acts">
      <button class="cw-cd-go" data-cd-go>${
        n ? 'Готово — ' + n + ' ' + cardWord(n) + ' у полі' : 'Нічого не обрано'}</button>
      <button class="cw-cd-dl" data-cd-dl>Завантажити собі</button>
      <button class="cw-cd-no" data-cd-close>Прибрати всі</button>
    </div>
  </div>`;
}
function cardWord(n){
  const t = n % 10, h = n % 100;
  if(t === 1 && h !== 11) return 'картку';
  if(t >= 2 && t <= 4 && (h < 12 || h > 14)) return 'картки';
  return 'карток';
}
/* КАРТКИ ЛЯГАЮТЬ У СМУЖКУ ОДРАЗУ, БЕЗ ЖОДНОЇ ОКРЕМОЇ ДІЇ.

   Доти між «натиснув заготовку» і «картка готова до відправки» стояла ще
   одна кнопка. Здавалося, що це дрібниця, поки не стало видно наслідок: у
   полі вже лежав текст, панель виглядала як просто показ — і менеджер
   тиснув ➤. Клієнту летів самий текст, а картка лишалась у панелі. У
   звіті це видно рядком «ЩО ВЖЕ ПРОБУВАЛИ САМІ: ще не пробували» —
   відправка картинки не запускалась жодного разу.

   Тепер галочки в панелі й вміст смужки — це одне й те саме. Зняли
   галочку — плитка зникла зі смужки, поставили — зʼявилась. Панель ні
   про що більше не питає: вона показує, ЩО САМЕ лежить у смужці, з
   назвою, датою «надіслано» й позначкою «неповна», яких на маленькій
   мініатюрі не видно.

   Надсилає, як і все інше, тільки ➤ — і тільки коли менеджер перечитав. */
function cardsSync(o){
  const st = chatWin && chatWin.cards;
  if(!st || !st.deck) return;
  const store = cardPix[o.id] || {};
  const pics = chatWin.pics || (chatWin.pics = []);
  for(let i = pics.length - 1; i >= 0; i--){
    const id = pics[i].cardId;
    if(id && !st.pick[id]) chatDropPic(pics.splice(i, 1)[0]);
  }
  st.deck.list.forEach(c => {
    if(!st.pick[c.id] || !store[c.id]) return;
    if(pics.some(x => x.cardId === c.id)) return;
    if(pics.length >= CHAT_PICS_MAX) return;
    /* Своя адреса на ту саму картинку: смужка свою адресу по дорозі
       звільняє, і спільна вбила б мініатюру в самій панелі. `cardId`
       потрібен, щоб після відправки позначити картку надісланою. */
    pics.push({ blob: store[c.id].blob, url: URL.createObjectURL(store[c.id].blob),
                cardId: c.id });
  });
}
/* Запасний шлях: забрати обрані собі й прикріпити руками. Потрібен саме
   тоді, коли автоматика не спрацювала, — а тоді ж найменше хочеться шукати,
   де ті картки взяти. */
async function cardsDownload(o){
  const st = chatWin && chatWin.cards;
  if(!st || !st.deck) return;
  const store = cardPix[o.id] || {};
  const want = st.deck.list.filter(c => st.pick[c.id] && store[c.id]);
  if(!want.length) return toast('Нічого не обрано');
  /* ОДИН АРХІВ, А НЕ ПʼЯТЬ ОКРЕМИХ ФАЙЛІВ.

     Доти картки летіли по одній, через чверть секунди кожна. Андрій: «коли
     ми скачати всі натискаємо, то качаються всі окремими фотками, не
     зіпкою».

     Це не смак. Кілька завантажень поспіль браузер віддає неохоче: Chrome
     питає «дозволити кілька завантажень?», Opera мовчки блокує все після
     першого, а кожне наступне натискання відлітає все далі від справжнього
     кліку — і перестає вважатись його наслідком. Плюс пʼять файлів у теці
     «Завантаження» треба потім зібрати руками, щоб переслати.

     Архів адмінка вже вміє: той самий `zipBlob`, яким їдуть макети
     замовлення й картки з редактора КП. Одна картка архіву не потребує —
     її віддаємо як є. */
  if(want.length === 1){
    const c = want[0];
    docDownload(store[c.id].url,
      window.LQCards.fileName(c, st.deck.list.indexOf(c), st.deck.offer, 'jpg'));
    return toast('Картку збережено');
  }
  toast('Пакую…');
  const files = [];
  const used = {};
  for(const c of want){
    let name = window.LQCards.fileName(c, st.deck.list.indexOf(c), st.deck.offer, 'jpg');
    /* Два однакові імені в архіві — це один файл замість двох: другий
       мовчки затирає перший. */
    if(used[name]){
      const dot = name.lastIndexOf('.');
      name = name.slice(0, dot) + '-' + (++used[name]) + name.slice(dot);
    } else used[name] = 1;
    try{
      files.push({ name, data: new Uint8Array(await store[c.id].blob.arrayBuffer()) });
    }catch(e){ console.warn('картка не прочиталась', name, e); }
  }
  if(!files.length) return toast('Жодна картка не прочиталась');
  docDownload(URL.createObjectURL(zipBlob(files)),
              'kartky-' + (o.orderId || 'loomiq') + '.zip');
  toast(files.length + ' ' + cardWord(files.length) + ' — одним архівом');
}
/* ── Заготовки просто у вікні діалога ────────────────────────────────────
   Правити їх треба там, де їх видно в роботі. Доти єдиний вхід був через
   «Конструктор сайту → Готові відповіді»: менеджер, який щойно побачив, що
   текст незручний, мусив вийти з розмови, знайти налаштування й повернутись
   — тобто не правив ніколи.

   Список один на всіх і лежить там само, куди пише конструктор сайту, тож
   двох різних наборів не буває. */
function qrPanelHtml(o){
  const L = quickReplies();
  const ed = chatWin && chatWin.qrEdit;
  /* Панель мовчала про себе: люди бачили список і не здогадувались, що його
     можна правити. Один рядок згори — і питання «а де редагувати» більше не
     виникає. */
  const head = `<div class="cw-qr-head">
      <b>Заготовлені повідомлення</b>
      <span>натисніть, щоб вставити · ✎ — змінити текст</span>
    </div>`;
  /* Показуємо тільки свої: B2B-заготовка з «виставимо рахунок на ФОП» у
     розмові з приватною людиною виглядає як лист не туди. Номер у списку
     лишається ПОЧАТКОВИЙ — за ним заготовку відкривають на правку, і
     перенумерувати їх означало б редагувати не ту. */
  const dir = chatDirOf(o);
  const row = (q, i) => ed === i ? qrEditHtml(q, i) : `
    <div class="cw-qr-row">
      <button class="cw-qr-b" data-qr="${i}">
        <span class="cw-qr-t">${escapeHtml(q.t || 'Заготовка')}</span>
        <span class="cw-qr-m">${escapeHtml(qrFill(q.m, o).replace(/\n/g, ' '))}</span>
      </button>
      ${canQuick() ? `<button class="cw-qr-e" data-qr-edit="${i}" title="Змінити заготовку">✎</button>` : ''}
    </div>`;
  const мої = L.map((q, i) => ({ q, i })).filter(x => { const d = qrDirOf(x.q); return !d || d === dir; });
  /* ПО БЛОКАХ (20.10): «До картинок», оплата, правки, доставка, проблемні…
     Порядок блоків — сталий, щоб потрібну знаходили на тому ж місці. */
  const rows = мої.some(x => x.q.g)
    ? QR_GROUPS.map(([g, name]) => {
        const l = мої.filter(x => String(x.q.g || '') === g);
        return l.length ? `<div class="cw-qr-grp${g === 'pic' ? ' is-pic' : ''}">${escapeHtml(name)}</div>` + l.map(x => row(x.q, x.i)).join('') : '';
      }).join('')
    : мої.map(x => row(x.q, x.i)).join('');
  /* Заготовки спільні на всіх: змінена тут фраза піде від імені кожного
     менеджера. Тому вставляти їх може будь-хто, а правити — окреме право. */
  return head + rows + (!canQuick() ? ''
    : ed === 'new' ? qrEditHtml({ t:'', m:'' }, 'new')
    : `<button class="cw-qr-add" data-qr-edit="new">＋ Нова заготовка</button>`);
}
function qrEditHtml(q, i){
  return `
    <div class="cw-qr-ed" data-ed="${i}">
      <input class="cw-qr-in-t" type="text" maxlength="40" placeholder="назва"
             value="${escapeHtml(q.t || '')}">
      <textarea class="cw-qr-in-m" rows="6" maxlength="900"
                placeholder="текст повідомлення">${escapeHtml(q.m || '')}</textarea>
      <div class="cw-qr-hint">Підставляється само: {імʼя}, {номер}, {кп}; з картки: {одяг}, {вид},
        {нанесення}, {колір}, {розмір}, {вишивка}, {фіксація} (кожна позиція окремо); з «Грошей»: {залишок}; з налаштувань B2C:
        {ціна:tee} (sweat, hoodie, cap, tote), {розробка}, {доплата:18}, {збільшення}.<br>
        Позначки «До картинок» ідуть клієнту самі: {макет} перший ескіз, {правки} після правок,
        {варіанти-вибір} варіанти ({варіанти} — їхній список), {картка-варіантів} напис на картці.<br>
        Рядок «---» ділить текст на окремі повідомлення.</div>
      <!-- Напрям. Компанії пишуть «виставимо рахунок на ФОП»; приватній
           людині в Директ таке слати нема сенсу, і навпаки. «Обом» лишається
           за замовчуванням — усе вже написане працює, як працювало. -->
      <label class="cw-qr-dir"><span>Кому</span>
        <select class="cw-qr-in-d">
          <option value=""${qrDirOf(q) ? '' : ' selected'}>Обом напрямам</option>
          <option value="b2b"${qrDirOf(q) === 'b2b' ? ' selected' : ''}>Тільки B2B</option>
          <option value="b2c"${qrDirOf(q) === 'b2c' ? ' selected' : ''}>Тільки B2C</option>
        </select></label>
      <label class="cw-qr-dir"><span>Блок</span>
        <select class="cw-qr-in-g">${QR_GROUPS.map(([g, name]) =>
          `<option value="${g}"${String(q.g || '') === g ? ' selected' : ''}>${escapeHtml(name.split(' · ')[0])}</option>`).join('')}
        </select></label>
      <div class="cw-qr-acts">
        <button class="cw-qr-ok" data-qr-save>Зберегти</button>
        <button class="cw-qr-no" data-qr-cancel>Скасувати</button>
        ${i === 'new' ? '' : '<button class="cw-qr-rm" data-qr-del title="Прибрати заготовку">🗑</button>'}
      </div>
    </div>`;
}
async function qrStore(list){
  /* Порожній напрям не пишемо взагалі: «обом» — це відсутність обмеження. */
  const clean = list.map(qrPack).filter(q => q.m);
  await PHOTOS_DOC.set({ quickReplies: clean }, { merge:true });
  /* Знімок бази прийде своєю чергою, але вікно має оновитись одразу —
     інакше здається, що збереження не спрацювало. */
  contentData.quickReplies = clean;
}
/* Службові позначки скриптів ({макет}, {правки}…) клієнту не йдуть
   ніколи (15.10: клієнт отримав «{макет} Зробили макет…»). */
function scriptMarksOff(t){
  return String(t || '').replace(SCRIPT_MARK_RE, '').replace(/^[ \t]+/, '').replace(/\n[ \t]+/g, '\n');
}
/* ОДНЕ ПІДСТАВЛЕННЯ НА ВСІ ЗАГОТОВКИ (20.10). Доти ⚡ і «До картинок»
   підставляли різне ({версія} з ⚡ лишалась буквально). Тепер одна функція:
   з картки замовлення, з «Грошей» і з налаштувань B2C — у мить вставки. */
function qrMoney(n){ return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function qrUnits(o){
  try{ const j = (typeof designJobs === 'object' && designJobs) ? designJobs[o.orderId] : null;
       return ((j && j.units) || []).filter(Boolean); }catch(e){ return []; }
}
function qrUnitVals(u){
  const D = window.LQDesign, U = D && D.ui;
  const g = U && U.catItem ? U.catItem(u.gid) : null;
  const вид = u.ready ? (u.ready.repeat ? 'повторний' : u.ready.link ? 'той самий ескіз' : 'готовий дизайн')
            : u.base ? 'готовий з правками' : 'індивідуальний';
  let spots = [];
  try{
    const l = D.dzList(u, 'graphic').filter(d => d && (d.vers || []).length);
    const d = l[l.length - 1], v = d && d.vers[d.vers.length - 1];
    spots = v ? D.verSpots(v) : [];
  }catch(e){}
  const см = n => (Math.round((+n || 0) * 10) / 10).toString().replace('.', ',');
  const де = sp => { const t = String((sp && (sp.label || sp.side)) || '').toLowerCase();
    return /перед|груд|front/.test(t) ? 'спереду' : /спин|зад|back/.test(t) ? 'ззаду' : /рукав|sleeve/.test(t) ? 'на рукаві' : t; };
  return {
    одяг: (g && g.name) || u.name || '',
    вид,
    нанесення: spots.length ? spots.map(sp => ['вишивка', де(sp)].filter(Boolean).join(' ')).join(', ') : 'вишивка',
    колір: u.color || '',
    розмір: u.size || '',
    вишивка: spots.filter(sp => +sp.wCm > 0).map(sp => см(sp.wCm) + ' × ' + см(sp.hCm) + ' см').join(', '),
    /* Фіксація однієї позиції: одяг одним рядком (модель, колір, розмір —
       не вказано → прочерк) і нанесення без сантиметрів. */
    фіксація: 'Одяг: ' + [(g && g.name) || u.name || '…', String(u.color || '').toLowerCase(), 'розмір ' + (u.size || '—')].filter(Boolean).join(', ') +
              '\nНанесення: ' + (spots.length ? spots.map(sp => ['вишивка', де(sp)].filter(Boolean).join(' ')).join(', ') : 'вишивка')
  };
}
/* «---» окремим рядком — межа повідомлень: текст іде клієнту кількома
   репліками поспіль (20.10, Андрій: «воно не повинно бути змішане»). */
function qrParts(text){
  return String(text || '').split(/\n[ \t]*-{3,}[ \t]*(?=\n|$)/).map(x => x.trim()).filter(Boolean);
}
function qrFill(text, o, vars){
  o = o || {};
  vars = vars || {};
  const first = String(o.crmChatName || o.name || '').trim().split(/\s+/)[0] || '';
  const pr = (contentData && contentData.products) || {};
  const ready = pr.retailReady || {}, full = pr.retail || {};
  const extras = (((contentData || {}).b2c || {}).extras) || [];
  const доплата = cm => { const x = extras.filter(e => e && new RegExp('(^|\\D)' + cm + '\\s*см').test(String(e.name || '')))[0];
    return x ? qrMoney(x.price) : '...'; };
  const us = qrUnits(o).map(qrUnitVals);
  const поле = k => { const l = us.map(x => x[k]).filter(Boolean); return l.length ? l.join(' / ') : '...'; };
  let залишок = '...';
  try{ if(typeof dueSum === 'function'){ const d = dueSum(o); if(d > 0) залишок = qrMoney(d); } }catch(e){}
  return scriptMarksOff(text)
    .replace(/\{імʼя\}|\{ім'я\}|\{імя\}/g, first)
    .replace(/\{бренд\}/g, () => { try{ return brandSnap(o.brand).name; }catch(e){ return ''; } })
    .replace(/\{номер\}/g, o.orderId || '')
    .replace(/\{кп\}/g, () => { try{ return offerUrl(o) || ''; }catch(e){ return ''; } })
    .replace(/\{версія\}/g, 'v' + ((vars.v) || 1))
    .replace(/\{(одяг|вид|нанесення|колір|розмір|вишивка)\}/g, (m0, k) => поле(k))
    .replace(/\{фіксація\}/g, () => us.length ? us.map(x => x.фіксація).join('\n---\n') : '...')
    .replace(/\{залишок\}/g, залишок)
    .replace(/\{ціна:([\w-]+)\}/g, (m0, gid) => ready[gid] ? qrMoney(ready[gid]) : '...')
    .replace(/\{розробка\}/g, () => { const g = ['tee','sweat','hoodie'].filter(k => full[k] && ready[k])[0];
      return g ? qrMoney(full[g] - ready[g]) : '...'; })
    .replace(/\{доплата:(\d+)\}/g, (m0, cm) => доплата(cm))
    .replace(/\{збільшення\}/g, () => { const l = extras.map(e => { const m1 = /(\d+)\s*см/.exec(String((e && e.name) || ''));
        return (m1 && /збільш/i.test(e.name)) ? '• ' + m1[1] + ' см, ' + qrMoney(e.price) + ' грн' : ''; }).filter(Boolean);
      return l.length ? l.join('\n') : '...'; })
    .replace(/\{варіанти\}/g, () => (vars.list || []).map(v => v.n + '. ' + String(v.label || '').split(' · ').join(', ')).join('\n'));
}

function chatWinEl(){
  let d = document.getElementById('chatWin');
  if(d) return d;
  d = document.createElement('div');
  d.id = 'chatWin';
  d.className = 'cw-wrap';
  d.innerHTML = '<div class="cw"></div>';
  /* Зона живе в робочій колонці — там само, де дошка, а не поверх сторінки.
     Тоді її ліву межу рахує сам макет, і згорнуте меню нічого не зсуває. */
  (document.querySelector('.workarea') || document.body).appendChild(d);
  /* Закриття кліком повз вікно тут більше немає: «повз» перестало існувати —
     праворуч тепер картка, і клік по ній закривав би розмову замість того,
     щоб зробити те, на що натиснули. Лишаються хрестик і Escape. */
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && chatWin) chatClose(); });
  return d;
}
function msgWord(n){
  const m10 = n % 10, m100 = n % 100;
  if(m10 === 1 && m100 !== 11) return 'повідомлення';
  if(m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'повідомлення';
  return 'повідомлень';
}
function chatOrder(){ return chatWin && (orders || []).find(x => x.id === chatWin.id); }
function chatOpen(o, kind, opts){
  /* Розмову з дошки відкривали САМУ, без замовлення. А говорять у ній
     рівно про нього: що замовили, на скільки, коли відправка, скільки
     сплачено. Усе це доводилось згадувати або закривати розмову й лізти в
     картку — і повертатись назад.

     Тому картку відкриваємо поруч. Вона ж далі бере на себе підписку на
     стрічку й позначку «прочитано», тож окремий режим «вікно саме по
     собі» лишається тільки для випадків, коли картку відкрити не вдалось. */
  /* У розділі «Чати» картку НЕ відкриваємо: там відповідають, а не ведуть
     замовлення. На картку веде номер у шапці розмови — коли він справді
     знадобиться. */
  const host = opts && opts.host;
  if(!host && !(opts && opts.noDrawer) && drawerOrderId !== o.id){ try{ openOrderDrawer(o); }catch(e){ console.warn(e); } }
  // solo — вікно відкрили з дошки, без картки. Тоді підписку на розмову й
  // позначку «прочитано» бере на себе воно саме: інакше стрічка була б
  // мертвою, а лічильник пропущених не гаснув би ніколи.
  const solo = host ? true : (drawerOrderId !== o.id);
  /* Розділ, звідки відкрили (14.10): «Чати B2C» — заготовки B2C, навіть
     якщо замовлення прийшло з Канбану. Інакше — за напрямом замовлення. */
  const розділ = (opts && (opts.dir === 'b2c' || opts.dir === 'b2b')) ? opts.dir : '';
  chatWin = { id: o.id, kind, solo, dir: host ? (розділ || orderDir(o)) : null, sect: розділ || orderDir(o),
              draft: (kind === 'tg' ? (tgChat[o.id] || {}).draft
                                    : (crmChat[o.id] || {}).draft) || '' };
  if(solo){
    if(kind === 'tg'){
      tgWatch(o);
      /* Лише точка відліку пропущених, якщо її ще немає, — без «прочитано». */
      if(o.tgSeenWrote == null && !tgUnread(o)){ o.tgSeenWrote = +o.tgWrote || 0; saveOrders({ quiet:true }).catch(e=> console.warn(e)); }
    } else if(!((crmChat[o.id] || {}).msgs)){
      crmLoadChat(o).then(()=> crmStartPoll(o));
    } else crmStartPoll(o);
  }
  const d = chatWinEl();
  d.classList.add('open');
  /* Вікно стоїть або поверх робочої зони (з дошки), або просто в правій
     колонці розділу чатів — тим самим вузлом, щоб не тримати двох. */
  d.classList.toggle('cw-inline', !!host);
  if(host){
    const v = document.getElementById(host);
    if(v){ v.innerHTML = ''; v.appendChild(d); }
  } else if(d.parentNode !== (document.querySelector('.workarea') || document.body)){
    (document.querySelector('.workarea') || document.body).appendChild(d);
  }
  /* Розмову відкрили з картки — зона стає рівно на просвіт біля неї. З дошки
     (картки немає) — на всю ширину: лишати порожню смугу під картку, якої
     немає, немає сенсу. */
  d.classList.toggle('with-card', !solo);
  /* Дошка ховається зовсім, а схований елемент забуває прокрутку. Тому
     запамʼятовуємо її тут і повертаємо при закритті: інакше кожна розмова
     викидала б менеджера на початок дошки. */
  const mainEl = document.querySelector('main');
  cwMainTop = mainEl ? mainEl.scrollTop : 0;
  // Дошку ховаємо лише тоді, коли розмова стоїть поверх неї.
  if(!host) document.body.classList.add('cw-open');
  else document.body.classList.remove('cw-open');
  renderChatWin(true);
}
function chatClose(){
  const solo = chatWin && chatWin.solo;
  const dir = chatWin && chatWin.dir;
  // Незібране фото нікуди не піде — зате памʼять під мініатюри звільнимо.
  chatPics().forEach(chatDropPic);
  chatWin = null;
  const d = document.getElementById('chatWin');
  if(d) d.classList.remove('open');
  document.body.classList.remove('cw-open');
  const mainEl = document.querySelector('main');
  if(mainEl && cwMainTop) mainEl.scrollTop = cwMainTop;
  // Підписку, яку відкривало саме вікно, воно ж і згортає
  if(solo){ tgUnwatch(); crmStopPoll(); }
  /* Закрили розмову в розділі чатів — праворуч знову підказка, а не
     порожнеча, і список перемальовується без позначки «обрана». */
  if(dir){ try{ renderChats(dir); }catch(e){} }
}

function renderChatWin(toBottom){
  const d = document.getElementById('chatWin');
  if(!d || !chatWin) return;
  const o = chatOrder();
  if(!o){ chatClose(); return; }
  const box = d.querySelector('.cw');
  const feedOld = box.querySelector('.cw-feed');
  /* Липке дно: поки менеджер унизу стрічки, нові повідомлення підтягують
     її за собою. Але якщо він читає давню переписку вгорі — не смикаємо. */
  const stick = toBottom || !feedOld ||
    (feedOld.scrollHeight - feedOld.scrollTop - feedOld.clientHeight < 60);
  const oldTop = feedOld ? feedOld.scrollTop : 0;
  /* Перемальовування не має виривати людину з-під рук. Вікно оновлюється й
     тоді, коли прийшло нове повідомлення, — а менеджер у цю мить може дописувати
     лист на три абзаци. Тому запамʼятовуємо, де стояли фокус і каретка, і
     повертаємо їх на місце; фокус самі ставимо лише при першому відкритті. */
  const inpOld = box.querySelector('.cw-inp');
  const keep = (inpOld && document.activeElement === inpOld)
    ? { at: inpOld.selectionStart, to: inpOld.selectionEnd } : null;
  /* «Перший показ» — це перший показ ЦІЄЇ розмови, а не порожній вузол.
     Доти воно визначалось наявністю поля вводу — а поле лишається від
     попередньої розмови, і перехід між діалогами першим показом не
     вважався. Наслідок видно рівно там, де він найдорожчий: відкриваєш
     наступний чат, а він стає в кінці стрічки замість межі непрочитаного,
     і фокус у поле не йде. */
  const first = !chatWin.drawn;
  chatWin.drawn = true;
  /* Позначка прочитаного, якою вона була ДО того, як ми відкрили розмову.
     Саме від неї й малюється риска «нові повідомлення» весь час, поки
     вікно відкрите. */
  if(first) chatWin.mark = crmSeenAt(o);

  const msgs = chatMsgs(o, chatWin.kind);
  const isTg = chatWin.kind === 'tg';
  const nm = (o.name || o.instagram || (isTg ? 'Telegram' : 'Клієнт')).trim();
  /* Писати, не бачачи, про що взагалі мова, — найшвидший шлях сказати
     клієнту дурницю. Тому в шапці стоїть стан угоди, а не лише нік. */
  const stLbl = (statusFlow().find(x => x.key === o.status) || {}).label || '';
  const sub = [isTg ? (o.instagram || 'Telegram') : ((crmChat[o.id] || {}).clientName || 'Sitniks'),
               (o.items || []).length ? fmt(o.totalPrice) + ' ₴' : '',
               stLbl,
               msgs.length ? (msgs.length + ' ' + msgWord(msgs.length)) : '']
              .filter(Boolean).join(' · ');

  let feed;
  const cst = isTg ? null : (crmChat[o.id] || {});
  if(!msgs.length && cst && (cst.loading || cst.noHistory || !cst.msgs)){
    /* ПОРОЖНЬО ≠ НЕМАЄ (19.10). Доти невдале завантаження (429, тайм-аут)
       виглядало як «Повідомлень поки немає» — і менеджер вірив, що
       переписка зникла. Тепер — що сталось насправді, і кнопка. */
    const пауза = crmCooling();
    feed = `<div class="cw-empty cw-load${cst.loading ? ' is-busy' : ''}" data-cw-state="${cst.loading ? 'loading' : (cst.noHistory ? 'error' : 'idle')}">` +
      (cst.loading ? 'Завантажуємо переписку…'
        : пауза ? `Sitniks обмежив запити — повторимо за ${Math.ceil(пауза / 1000)} с.`
        : cst.noHistory ? `Переписка не завантажилась: ${escapeHtml(cst.noHistory)}.` : 'Переписка ще не завантажена.') +
      (cst.loading ? '' : `<button type="button" class="cw-reload" data-cw-reload>Оновити</button>`) +
      `</div>`;
  } else if(!msgs.length){
    feed = `<div class="cw-empty">${isTg
      ? 'Людина відкрила бота, але ще нічого не написала. Можна написати першим — вона отримає повідомлення в Telegram.'
      : 'Повідомлень поки немає.'}</div>`;
  } else feed = chatRowsHtml(msgs);
  /* СТРІЧКУ НЕ ПЕРЕБИРАЄМО, КОЛИ В НІЙ НІЧОГО НЕ ЗМІНИЛОСЬ.

     Андрій: «пригає діалог постійно». Вікно перемальовується щочотири
     секунди — стільки триває крок опитування, — і разом із ним щоразу
     народжувалась уся стрічка заново. Для тексту це непомітно, а от кожна
     картинка в ній стає НОВИМ елементом: браузер бере її з кеша, але
     висоту до завантаження не знає, стрічка на мить складається й
     розправляється назад. Саме це й читається як «пригає», і що більше в
     розмові карток, то сильніше.

     Тому порівнюємо стрічку з тією, що вже стоїть, і коли вона та сама —
     повертаємо на місце СТАРИЙ вузол. Картинки в ньому вже завантажені й
     виміряні, прокрутка ціла, виділений текст не злітає. */
  const feedSig = feed;
  const keepFeed = !!feedOld && feedOld.__sig === feedSig;
  // Відправка триває — і текстова, і фото: кнопка одна, стан один
  const busy = !!(chatWin.sending || chatWin.picsBusy);
  /* Вікно відповіді рахуємо лише для Instagram: у Telegram такого
     обмеження немає, і вигадувати його там означало б лякати дарма. */
  const win = isTg ? null : crmWindow(o);
  const прочитано = !chatWaiting(o, chatWin.kind);

  const qr = chatWin.qr ? `<div class="cw-qr">${qrPanelHtml(o)}</div>` : '';
  const cards = chatWin.cards ? cardsPanelHtml(o) : '';

  // Sitniks приймає від нас лише текст — чесно попереджаємо, що фото туди
  // піде посиланням, а не картинкою в чаті.
  const note = (!isTg && chatWin.note)
    ? `<div class="cw-note">Це фото пішло ПОСИЛАННЯМ — Sitniks не прийняв вкладення ` +
      `жодним зі способів. Клієнт побачить адресу, а не картинку.</div>` : '';
  const raw = (!isTg && chatWin.raw && canSetup())
    ? `<pre class="cw-raw">${escapeHtml(crmRawSample(o))}</pre>` : '';
  const sniff = (!isTg && chatWin.sniff && canSetup())
    ? `<pre class="cw-raw">${escapeHtml(chatWin.sniff)}</pre>` : '';

  box.innerHTML = `
    <div class="cw-head">
      ${avatarHtml(nm, 'cw-av')}
      <div class="cw-who">
        <div class="cw-nm">${escapeHtml(nm)}</div>
        <div class="cw-sub">${escapeHtml(sub)}</div>
        ${/* Скільки лишилось вікна відповіді. Стоїть у шапці, під ніком:
             саме там менеджер дивиться, з ким він розмовляє, — і разом із
             цим має бачити, чи розмова ще жива. */''}
        ${win ? `<div class="cw-win ${win.closed ? 'is-out' : (win.soon ? 'is-soon' : '')}"
          title="${escapeHtml(win.closed
            ? 'Instagram дає сім діб від останньої репліки клієнта. Вони минули — Sitniks лист прийме, а до людини він не дійде.'
            : 'Instagram дає сім діб від останньої репліки клієнта. Далі канал закривається.')}">${
          win.closed
            ? 'Вікно відповіді закрите · ' + escapeHtml(crmLeftLabel(win.left)) + ' тому'
            : 'Вікно відповіді · лишилось ' + escapeHtml(crmLeftLabel(win.left))}</div>` : ''}
      </div>
      ${/* Картка — на один дотик, але не замість розмови. У розділі чатів
           відповідають; коли справді треба глянути склад чи оплату,
           натискають номер. */''}
      ${(()=>{ const л = ordersOfChat(o);
        if(л.length < 2)
          return o.orderId ? `<button class="cw-oid" data-cw-card title="Відкрити картку замовлення">${
            escapeHtml(showNo(o))}</button>` : '';
        /* Замовлень по цій розмові кілька — показуємо всі. Відкрите
           підсвічене, решта натискаються. Нічого не ховається, і ніколи не
           буває незрозуміло, на яке саме ви зараз дивитесь. */
        return л.map(x => `<button class="cw-oid${x.id === o.id ? ' is-on' : ''}"
            data-cw-ord="${escapeHtml(x.id)}"
            title="${x.id === o.id ? 'Це замовлення відкрите' : 'Перейти на це замовлення'}">${
            escapeHtml(showNo(x))}<i>${orderDir(x) === 'b2c' ? 'B2C' : 'B2B'}</i></button>`).join('');
      })()}
      ${/* «Картка ▸» у розділі чатів (20.10): діалог ліворуч, картка праворуч. */''}
      ${(chatWin && chatWin.dir && o.orderId)
        ? `<button class="cw-cardb${drawerOrderId === o.id ? ' is-on' : ''}" data-cw-card data-cw-cardb title="${
            drawerOrderId === o.id ? 'Сховати картку' : 'Відкрити картку замовлення праворуч'}">${
            drawerOrderId === o.id ? 'Сховати картку' : 'Картка ▸'}</button>` : ''}
      ${/* Що саме прислав Sitniks. Бік розмови й автор беруться з полів, назв
           яких у закритій документації немає, — тож коли підпис стає не з того
           боку, це єдиний спосіб побачити справжні назви замість здогадок.
           Показуємо лише тому, хто налаштовує систему: менеджеру ця кнопка
           нічого не дає. */''}
      ${(!isTg && canSetup())
        ? `<button class="cw-x" data-cw-raw title="Що прислав Sitniks — назви полів у відповіді">{ }</button>`
        : ''}
      ${/* Розвідка способу надіслати картинку. Питати підтримку Sitniks —
           найкоротший шлях, але не єдиний: API можна спитати, чи опише
           воно себе саме, а заразом подивитись, ЯКОЮ назвою поля Sitniks
           віддає вкладення нам. Приймають і віддають зазвичай однаково,
           тож це вже підказка, і вона лежить у наявних розмовах. */''}
      ${(!isTg && canSetup())
        ? `<button class="cw-x" data-cw-sniff title="Знайти, яким полем Sitniks приймає картинку">🔎</button>`
        : ''}
      ${/* ПРОЧИТАНО — РУКАМИ.

           Непрочитане система рахує сама: скільки клієнт написав після
           нашої останньої відповіді. Правило добре, поки вона правильно
           розрізняє, де чия репліка, — а вона розрізняє її ланцюжком
           здогадів, і Sitniks їй у цьому не помічник. Варто нашій
           відповіді поїхати ліворуч, як розмова стає «непрочитаною», хоча
           там немає жодного слова клієнта.

           Тому останнє слово лишається за людиною: подивився — натиснув.
           І назад так само: помилився або хочеш повернутись до розмови
           пізніше — зняв позначку, кружечок повертається. */''}
      <button class="cw-x cw-seen${прочитано ? ' is-on' : ''}" data-cw-seen
        title="${прочитано ? 'Позначити непрочитаним — кружечок повернеться'
                           : 'Позначити прочитаним — зняти кружечок із картки'}"
        aria-label="${прочитано ? 'Позначити непрочитаним' : 'Позначити прочитаним'}">👁</button>
      <button class="cw-x" data-cw-close aria-label="Закрити">✕</button>
    </div>
    <div class="cw-feed">${keepFeed ? '' : feed}</div>
    ${/* Читати листування й писати в нього — різні права. Без права на
         відповідь показуємо рядок замість поля: порожній низ вікна
         виглядав би поламаним, а поле, з якого нічого не йде, — гірше. */''}
    ${!canWrite() ? `<div class="cw-bar"><div class="cw-tip">Листування доступне для читання: писати клієнту ця роль не може.</div></div>` : `
    <div class="cw-bar">
      ${raw}${sniff}${note}${cards}${qr}
      ${/* Смуга просто над полем — там, де ухвалюють рішення писати. У
           шапці стоїть лічильник, і поки час є, цього досить; коли часу
           немає, попередження мусить бути на дорозі, а не збоку. */''}
      ${chatWin.kind === 'crm' ? crmElsewhereHtml(o) : ''}
      ${(win && win.closed) ? `<div class="cw-dead">Вікно відповіді Instagram закрите —
        клієнт не писав ${escapeHtml(crmLeftLabel(win.since))}.
        Sitniks лист прийме, а до людини він не дійде. Напишіть з іншого каналу
        або дочекайтесь, поки клієнт озветься сам.</div>` : ''}
      ${chatTrayHtml()}
      <div class="cw-row">
        ${/* Підпис окремим вузлом: на телефоні він ховається, і кнопка стає
             самим знаком. Текстом вона з’їдала третину смуги, а поле для
             листа лишалось завширшки в два слова. */''}
        <button class="cw-ic cw-ic--txt${chatWin.qr ? ' on' : ''}" data-cw-qr
          title="Заготовлені повідомлення — вставити або відредагувати">⚡<span
          class="cw-ic-l">Заготовки</span></button>
        ${canSendFiles() ? '<button class="cw-ic" data-cw-clip title="Прикріпити фото">📎</button>' : ''}
        ${chatFwdOn() ? (chatWin.fwdMode
          ? `<button class="cw-ic on" data-cw-fwdgo title="Переслати відмічене дизайнеру">➤ ${
              Object.keys(chatWin.fwdSel || {}).filter(k => chatWin.fwdSel[k]).length || ''}</button><button class="cw-ic" data-cw-fwdoff title="Скасувати вибір">✕</button>`
          : '<button class="cw-ic cw-ic--fwd" data-cw-fwdm title="Переслати дизайнеру кілька повідомлень — відмітити галочками">➤</button>') : ''}
        ${/* Окремої кнопки з посиланням на КП тут немає навмисно. Вона
             вставляла голу адресу, а в «Заготовках» уже лежить заготовка з
             підстановкою {кп} — та сама адреса, але разом із текстом, який
             клієнту й треба прочитати. Дві кнопки на одну дію, і гірша з них
             стояла ближче. */''}
        <textarea class="cw-inp" rows="1" placeholder="${escapeHtml(
          isTg ? 'Написати в Telegram…' : 'Написати клієнту…')}">${escapeHtml(chatWin.draft || '')}</textarea>
        ${/* Поки лист летить — кнопка гасне й крутиться. Це і є відповідь
             на «натиснув, і не зрозуміло, чи пішло»: видно, що система
             зайнята, і другий натиск фізично неможливий. */''}
        <button class="cw-go${busy ? ' is-busy' : ''}" data-cw-go${busy ? ' disabled' : ''}
          title="${busy ? 'Надсилаємо…' : 'Надіслати · Ctrl+Enter'}">${
          busy ? '<i class="cw-spin"></i>' : '➤'}</button>
      </div>
      ${/* Правило треба сказати вголос: доти Enter надсилав, про Shift+Enter
           ніхто не знав, і листи виходили одним рядком. */''}
      <div class="cw-tip">Enter — новий рядок · Ctrl+Enter або ➤ — надіслати</div>
      <input type="file" accept="image/*" multiple data-cw-file hidden>
    </div>`}
    </div>`;

  let feedEl = box.querySelector('.cw-feed');
  if(feedEl && keepFeed){
    /* Старий вузол на своє місце — з усіма завантаженими картинками. */
    feedEl.parentNode.replaceChild(feedOld, feedEl);
    feedEl = feedOld;
  } else if(feedEl){
    feedEl.__sig = feedSig;
  }
  /* Прокрутку чіпаємо лише коли є що міняти: липке дно опускає стрічку
     вниз, а в решті випадків вона має лишитись рівно там, де стояла. Тут
     теж було смикання — при поверненні старого вузла присвоєння того
     самого числа безпечне, а от «підтягнути вниз» без потреби ні. */
  if(feedEl){
    let треба = stick ? feedEl.scrollHeight : oldTop;
    /* ВІДКРИЛИ РОЗМОВУ — СТАЄМО НА МЕЖІ НЕПРОЧИТАНОГО, а не в самому кінці.
       Коли клієнт написав пʼять разів, кінець стрічки показує пʼяте, а
       перші чотири лишаються вище — і менеджер гортає вгору, вгадуючи,
       звідки читати. Так поводиться будь-який месенджер: відкрив і стоїш
       там, де скінчилось прочитане.

       Тільки при ПЕРШІЙ побудові вікна: далі стрічка живе своїм життям, і
       смикати її на кожному такті опитування не можна. */
    if(first){
      const мітка = feedEl.querySelector('[data-crm-new]');
      /* Трохи вище самої риски: так видно, на що саме відповідали
         останнім, і межа не прилипає до верхнього краю. */
      if(мітка) треба = Math.max(0, мітка.offsetTop - 46);
    }
    if(Math.abs(feedEl.scrollTop - треба) > 1) feedEl.scrollTop = треба;
  }
  /* ВІДКРИВ І ПРОЧИТАВ — ЛІЧИЛЬНИК ГАСНЕ ОДРАЗУ.

     Доти він гаснув лише від відповіді або від натиску на око, і виглядало
     це поломкою: розмову прочитано, а в лівій панелі так і висить «1» —
     причому висить, поки не мине такт опитування. Число, яке бреше про
     стан, гірше за його відсутність: на нього перестають дивитись.

     Позначку ставимо ПІСЛЯ того, як стрічку вже намальовано, — тоді риска
     «нові повідомлення» на цьому показі лишається на місці, і людина
     бачить, звідки читати. Зникне вона вже наступного відкриття, і це
     правильно: те, що прочитали, новим більше не буває. */
  /* ВІДКРИЛИ — ЩЕ НЕ ПРОЧИТАЛИ (Андрій, 15.10): «поки ми не натиснули
     глазик, воно висить новим, як непрочитане», і в «Чатах», і на картці
     канбану. Гасне лише око 👁 або наша відповідь клієнту. */
  wireChatWin(box, o, first || !!keep);
  if(keep){
    const el = box.querySelector('.cw-inp');
    if(el){ try{ el.setSelectionRange(keep.at, keep.to); }catch(e){} }
  }
}

/* ── СМУЖКА ЗІБРАНОГО ДО ВІДПРАВКИ ───────────────────────────────────────
   Доти скріпка надсилала картинку тієї ж миті, як її вибрали. Роздивитись
   її перед відправкою, докласти другу чи передумати було ніде, а підпис
   доводилось писати ПІСЛЯ — дочекавшись, поки фото долетить, і набираючи
   текст заново, хоча думка була вже тоді, коли картинку вибирали.

   Тепер вибране лежить тут, скільки треба: додати ще, прибрати зайве,
   натиснути на мініатюру й роздивитись у повний розмір. Текст пишеться
   тим самим полем і тієї ж миті, а «Надіслати» відправляє все разом. */
const CHAT_PICS_MAX = 10;
function chatPics(){ return (chatWin && chatWin.pics) || []; }
function chatTrayHtml(){
  const pics = chatPics();
  if(!pics.length) return '';
  /* Напис не просто «надсилаємо», а З ЧИСЛОМ: коли фото чотири, «надсилаємо»
     не каже, скільки з них уже пішло, і чекання здається довшим, ніж є. */
  const tail = chatWin.picsBusy
    ? '<span class="cw-tip cw-busy" style="align-self:center">' +
      '<i class="cw-spin"></i>Надсилаємо ' + pics.length + '…</span>'
    : '<button class="cw-tr-add" data-cw-clip title="Додати ще">+</button>';
  return '<div class="cw-tray">' + pics.map((p, i) =>
    '<div class="cw-tr' + (p.url ? '' : ' cw-tr--wait') + '">' +
    (p.url ? '<img src="' + escapeHtml(p.url) + '" alt="" data-cw-big="' + i + '">' : '') +
    ((chatWin.picsBusy || !p.url) ? '' :
      '<button class="cw-tr-x" data-cw-unpic="' + i + '" title="Прибрати">\u2715</button>') +
    '</div>').join('') + tail + '</div>';
}
/* Адреси мініатюр живуть у памʼяті вкладки, і браузер сам їх не прибирає:
   без цього рядка кожна переглянута картинка лишалась би висіти до
   перезавантаження сторінки. */
function chatDropPic(p){ if(p && p.url) try{ URL.revokeObjectURL(p.url); }catch(e){} }
/* РОЗДИВИТИСЬ КАРТИНКУ — ТУТ, А НЕ В НОВІЙ ВКЛАДЦІ.

   Спершу мініатюра відкривалась через `window.open`. На адресу виду
   `blob:` браузер дивиться як на спробу відкрити вікно без причини й
   мовчки її блокує — натиснув, і не сталось нічого. Тому показуємо своїм
   шаром: працює завжди, закривається натисканням або Escape. */
function picBig(url){
  if(!url) return;
  let d = document.getElementById('picBig');
  if(!d){
    d = document.createElement('div');
    d.id = 'picBig'; d.className = 'pic-big';
    d.addEventListener('click', picBigOff);
    document.body.appendChild(d);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') picBigOff(); });
  }
  d.innerHTML = '<img src="' + escapeHtml(url) + '" alt="">';
  d.classList.add('open');
}
function picBigOff(){
  const d = document.getElementById('picBig');
  if(d){ d.classList.remove('open'); d.innerHTML = ''; }
}
/* Плитка зʼявляється ОДРАЗУ, ще порожня, і лише потім наповнюється.

   Андрій: «я вам завантажу вже 4 картинки і нічого не відправляється».
   Велике фото зменшується помітну мить, а доти в смужці не було нічого —
   і людина не розуміла, вибралось воно взагалі чи ні. Тому спершу місце
   під картинку, а вже в ньому — сама картинка, коли буде готова. */
async function chatTake(list){
  const pics = chatWin.pics || (chatWin.pics = []);
  const all = Array.from(list || []);
  const imgs = all.filter(f => /^image\//.test(f.type || ''));
  const room = imgs.slice(0, Math.max(0, CHAT_PICS_MAX - pics.length));
  if(all.length > room.length)
    toast('Додаються лише фото, і не більше ' + CHAT_PICS_MAX + ' за раз');
  if(!room.length) return;
  const slots = room.map(f => { const s = { file: f }; pics.push(s); return s; });
  renderChatWin();
  for(const s of slots){
    try{
      s.blob = await shrinkImage(s.file);
      s.url = URL.createObjectURL(s.blob);
    }catch(e){ console.warn('фото', e); s.bad = true; }
    renderChatWin();
  }
  /* Непрочитане фото з смужки прибираємо: лишити порожню плитку означало б
     мовчки надіслати клієнту на одну картинку менше, ніж він бачить. */
  const bad = pics.filter(x => x.bad).length;
  if(bad){
    chatWin.pics = pics.filter(x => !x.bad);
    toast(bad === 1 ? 'Одне фото не відкрилось' : bad + ' фото не відкрились');
    renderChatWin();
  }
}

function wireChatWin(box, o, focusIn){
  box.querySelector('[data-cw-close]').addEventListener('click', chatClose);
  const seenB = box.querySelector('[data-cw-seen]');
  if(seenB) seenB.addEventListener('click', ()=> chatSeenToggle(o, chatWin.kind));
  box.querySelectorAll('[data-cw-card]').forEach(card => card.addEventListener('click', ()=>{
    /* Кнопка «Картка ▸» — перемикач: друге натискання ховає картку, діалог лишається. */
    if(card.hasAttribute('data-cw-cardb') && drawerOrderId === o.id){ try{ closeOrderDrawer(); }catch(e){} return; }
    try{ openOrderDrawer(o); }catch(e){}
  }));
  const rl = box.querySelector('[data-cw-reload]');
  if(rl) rl.addEventListener('click', ()=>{ crmCoolUntil = 0; crmLoadChat(o).then(()=> crmStartPoll(o)); });
  /* Перехід на інше замовлення тієї самої розмови. Переписку не
     перевідкриваємо — вона та сама людина й ті самі повідомлення; міняється
     тільки картка праворуч і те, чиїм замовленням ми зараз зайняті. */
  /* Номери замовлень у шапці — `data-cw-ord`. Доти вони мали той самий
     атрибут, що й «➤» (`data-cw-go`), і там, де замовлень по розмові два,
     кнопка надсилання діставала обробник номера в шапці, а сама лишалась
     глухою (15.10, #2000043 + #1000067: «Ctrl+Enter надсилає, кнопка — ні»). */
  box.querySelectorAll('[data-cw-ord]').forEach(b => b.addEventListener('click', ()=>{
    const t = (orders || []).find(x => x.id === b.dataset.cwOrd);
    if(!t || t.id === o.id) return;
    chatWin.id = t.id;
    try{ openOrderDrawer(t); }catch(e){ console.warn(e); }
    renderChatWin();
  }));
  const inp = box.querySelector('.cw-inp');
  const grow = ()=>{ inp.style.height = 'auto';
                     inp.style.height = Math.min(inp.scrollHeight, 130) + 'px'; };
  grow();
  inp.addEventListener('input', ()=>{ chatWin.draft = inp.value; grow(); });
  /* НАДІСЛАТИ МОЖНА РІВНО ОДИН РАЗ.

     Доти від повторного натиску рятувало те, що поле чиститься: другий
     натиск не бачив тексту й мовчав. З картинками так не виходило — там
     прапорець глушив натиск БЕЗ ЖОДНОЇ ознаки, і збоку це виглядало як
     «застрягло». Тепер стан один на обидва шляхи, і він видимий: кнопка
     гасне й крутиться, поки відправка триває. */
  const send = ()=>{
    const t = inp.value.trim();
    const pics = chatPics();
    /* Мовчазний натиск — найгірше (15.10: «не працює надсилання»). */
    if(chatWin.picsBusy || chatWin.sending) return toast('Ще надсилається попереднє — секунду');
    // Мовчазна кнопка — найгірше: людина тисне й не розуміє, що не так.
    if(!t && !pics.length) return toast('Напишіть повідомлення або додайте фото');
    // Половину пачки надіслати гірше, ніж зачекати секунду.
    if(pics.some(x => !x.url)){ toast('Картинки ще готуються — секунду'); return; }
    /* Вікно закрите — питаємо прямо. Не забороняємо: Sitniks буває має
       інший канал, та й менеджер може знати про цього клієнта більше за
       нас. Але надіслати НАОСЛІП, не знаючи, що лист нікуди не піде, він
       не повинен. */
    const w = (chatWin.kind === 'tg') ? null : crmWindow(o);
    if(w && w.closed && !confirm(
        'Вікно відповіді Instagram закрите: клієнт не писав ' +
        crmLeftLabel(w.since) + '.\n\n' +
        'Sitniks лист прийме, а до людини він найімовірніше не дійде.\n' +
        'Усе одно надіслати?')) return;
    inp.value = ''; chatWin.draft = ''; grow();
    chatWin.sending = true;
    /* Фото — спершу, підпис — під ними (Андрій). Фото не пройшло — підпис
       не губиться: повертається в поле разом із картинками в смужку. */
    /* «---» у тексті — кілька повідомлень поспіль, по порядку. */
    const parts = qrParts(t);
    const go = (async () => {
      if(pics.length){ await chatSendPics(o, pics, parts[0] || ''); parts.shift(); }
      for(const part of parts) await chatSend(o, part);
    })();
    Promise.resolve(go).catch(e => console.warn('відправка', e)).then(()=>{
      chatWin.sending = false;
      if(document.getElementById('chatWin')) renderChatWin();
    });
    renderChatWin(true);
  };
  /* Enter робить НОВИЙ РЯДОК, а надсилає кнопка або Ctrl/⌘+Enter.
     Довго було навпаки — «як у месенджерах». Але месенджер і КП пишуться
     по-різному: клієнту йде лист на кілька абзаців, і з Enter-надсиланням
     він вилітав недописаним після першого ж рядка. Про Shift+Enter ніхто не
     здогадувався, тож листи виходили суцільною кашею.

     Випадково надіслати недописане тепер неможливо — і це важливіше за
     звичку: недописаний лист клієнту не відкликати. */
  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); send(); }
  });
  /* Кнопка спрацьовує на НАТИСК, а не на відпускання (15.10). Клік —
     це натиск і відпускання на тому самому вузлі; якщо вікно
     перемалювалось між ними (прийшло повідомлення, оновився список), клік
     не народжувався зовсім, і кнопка «не реагувала». Натиск — одна подія,
     його не загубиш. Фокус лишається в полі. Клавіатурний «клік»
     (Enter/пробіл на кнопці) теж працює, але не вдруге після натиску. */
  const goB = box.querySelector('button.cw-go[data-cw-go]');
  goB.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    e.preventDefault();
    chatWin.goAt = Date.now();
    send();
  });
  goB.addEventListener('click', () => { if(Date.now() - (chatWin.goAt || 0) < 1500) return; send(); });
  box.querySelector('[data-cw-qr]').addEventListener('click', ()=>{
    chatWin.qr = !chatWin.qr; renderChatWin();
  });
  const rawB = box.querySelector('[data-cw-raw]');
  if(rawB) rawB.addEventListener('click', ()=>{
    chatWin.raw = !chatWin.raw; renderChatWin();
  });
  const snB = box.querySelector('[data-cw-sniff]');
  if(snB) snB.addEventListener('click', async ()=>{
    if(chatWin.sniff){ chatWin.sniff = null; renderChatWin(); return; }
    chatWin.sniff = 'Питаємо Sitniks…'; renderChatWin();
    chatWin.sniff = await crmSniff(o);
    renderChatWin();
  });
  /* Вибір карток: галочки, збільшення, відправка. */
  box.querySelectorAll('[data-cd]').forEach(ch=>{
    ch.addEventListener('change', ()=>{
      if(chatWin.cards) chatWin.cards.pick[ch.dataset.cd] = ch.checked;
      cardsSync(o);            // галочка одразу змінює те, що лежить у смужці
      renderChatWin();
    });
  });
  box.querySelectorAll('.cw-cd-pic img').forEach(im=>{
    /* Натиснули по самому кадру — дивимось його великим, а не перемикаємо
       галочку: «перевірити перед відправкою» без можливості роздивитись —
       це не перевірка. */
    im.addEventListener('click', e=>{
      e.preventDefault(); e.stopPropagation();
      picBig(im.src);
    });
  });
  box.querySelectorAll('[data-cd-big]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const pic = (cardPix[o.id] || {})[b.dataset.cdBig];
    if(pic) picBig(pic.url);
  }));
  const cdGo = box.querySelector('[data-cd-go]');
  if(cdGo) cdGo.addEventListener('click', ()=>{ chatWin.cards = null; renderChatWin();
    const el = document.querySelector('.cw-inp');
    if(el){ el.focus(); try{ el.setSelectionRange(el.value.length, el.value.length); }catch(e){} } });
  const cdDl = box.querySelector('[data-cd-dl]');
  if(cdDl) cdDl.addEventListener('click', ()=> cardsDownload(o));
  const cdHide = box.querySelector('[data-cd-hide]');
  if(cdHide) cdHide.addEventListener('click', ()=>{ chatWin.cards = null; renderChatWin(); });
  const cdNo = box.querySelector('[data-cd-close]');
  if(cdNo) cdNo.addEventListener('click', ()=>{
    /* Закриваючи панель цією кнопкою, картки зі смужки ЗАБИРАЄМО. Інакше
       «Скасувати» лишало б їх напоготові — і вони пішли б клієнту від
       наступного ➤, хоча людина щойно сказала «не треба». */
    const st = chatWin.cards;
    if(st) st.pick = {};
    cardsSync(o);
    chatWin.cards = null;
    renderChatWin();
  });

  box.querySelectorAll('[data-qr]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const q = quickReplies()[+b.dataset.qr];
      if(!q) return;
      /* Скрипт із картками спершу показує САМІ КАРТКИ: видно, що піде
         клієнту, і можна зняти зайве. Але й він нічого не надсилає —
         вибране лягає у смужку, а текст у поле, як і будь-яка інша
         заготовка. Надсилає тільки ➤, і тільки коли менеджер перечитав. */
      const kind = cardScriptOf(q.m);
      if(kind){
        /* Текст іде в поле ТІЄЇ Ж МИТІ, а не після вибору карток. Доти він
           показувався всередині панелі, і виглядало це як «повідомлення
           кудись поділось»: у полі порожньо, правити нічого. */
        const was = String(chatWin.draft || '').trim();
        chatWin.draft = (was ? was + '\n' : '') + qrFill(qrNoMarks(q.m), o);
        chatWin.cards = { kind: kind, pick:null, deck:null, err:'' };
        chatWin.qr = false;
        renderChatWin();
        cardsLoad(o);
        return;
      }
      /* Заготовка з посиланням на пропозицію без самої пропозиції — це лист
         «дивіться КП», у якому нічого відкрити. Помітив би це першим клієнт,
         тож не вставляємо взагалі. */
      if(String(q.m || '').indexOf('{кп}') >= 0 && !offerUrl(o))
        return toast('У замовлення ще немає КП — спершу зберіть пропозицію');
      // Вставляємо, а не надсилаємо: заготовку майже завжди дописують під
      // конкретну людину, і випадкове «надіслалось саме» тут неприпустиме.
      const cur = inp.value.trim();
      chatWin.draft = (cur ? cur + '\n' : '') + qrFill(q.m, o);
      chatWin.qr = false;
      renderChatWin();
      const el = document.querySelector('.cw-inp');
      if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    });
  });
  box.querySelectorAll('[data-qr-edit]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = b.dataset.qrEdit;
      chatWin.qrEdit = (v === 'new') ? 'new' : +v;
      chatWin.draft = inp.value;
      renderChatWin();
    });
  });
  const ed = box.querySelector('.cw-qr-ed');
  if(ed){
    const tIn = ed.querySelector('.cw-qr-in-t'), mIn = ed.querySelector('.cw-qr-in-m');
    const stop = ()=>{ chatWin.qrEdit = null; chatWin.draft = inp.value; renderChatWin(); };
    ed.querySelector('[data-qr-cancel]').addEventListener('click', stop);
    ed.querySelector('[data-qr-save]').addEventListener('click', async ()=>{
      if(!canQuick()) return toast('Заготовки спільні на всіх — правити їх ця роль не може');
      const m = String(mIn.value || '').trim();
      if(!m) return toast('Порожня заготовка нічого не варта');
      const list = quickReplies().map(qrPack);
      const dEl = ed.querySelector('.cw-qr-in-d'), gEl = ed.querySelector('.cw-qr-in-g');
      const dir = dEl ? String(dEl.value || '') : '';
      const g = gEl ? String(gEl.value || '') : '';
      const i = ed.dataset.ed;
      if(i === 'new') list.push({ t:tIn.value, m, dir, g });
      else { list[+i] = { t:tIn.value, m, dir, g }; }
      try{ await qrStore(list); toast('Заготовку збережено'); stop(); }
      catch(e){ console.error(e); toast('Не збереглось'); }
    });
    const del = ed.querySelector('[data-qr-del]');
    if(del) del.addEventListener('click', async ()=>{
      if(!canQuick()) return toast('Заготовки спільні на всіх — правити їх ця роль не може');
      const list = quickReplies().map(qrPack);
      const i = +ed.dataset.ed;
      if(!confirm('Прибрати заготовку «' + (list[i].t || list[i].m.slice(0, 30)) + '»?')) return;
      list.splice(i, 1);
      try{ await qrStore(list); toast('Прибрали'); stop(); }
      catch(e){ console.error(e); toast('Не збереглось'); }
    });
    mIn.focus();
  }
  /* Переслати дизайнеру: одне — ➤ на повідомленні; кілька — ➤ унизу,
     галочки, ➤ N. Повідомлення беремо з того ж списку, що й малювали. */
  const fwdGo = idx => {
    const o2 = chatOrder(), rows = (chatWin && chatWin.rows) || [];
    const ms = idx.map(i => rows[i]).filter(Boolean);
    if(!o2 || !ms.length) return;
    chatWin.fwdMode = false; chatWin.fwdSel = {};
    renderChatWin();
    /* Відділ у цьому сеансі могли ще не відкривати — гачки ядра ставимо самі. */
    if(typeof designHostInit === 'function') try{ designHostInit(); }catch(e){ console.warn(e); }
    window.LQDesign.ui.forwardToDesigner(o2, ms);
  };
  /* Стрічка при перемальовуванні лишається тим самим вузлом (keepFeed), а
     wireChatWin іде щоразу — тож кнопки в ній вʼяжемо один раз, інакше один
     натиск пересилав би стільки разів, скільки було перемальовувань. */
  const once = (el, ev, fn) => { if(el.__fwd) return; el.__fwd = 1; el.addEventListener(ev, fn); };
  box.querySelectorAll('[data-cw-fwd]').forEach(b => once(b, 'click', ()=> fwdGo([+b.dataset.cwFwd])));
  box.querySelectorAll('[data-cw-fwdc]').forEach(c => once(c, 'change', ()=>{
    chatWin.fwdSel = chatWin.fwdSel || {};
    if(c.checked) chatWin.fwdSel[c.dataset.cwFwdc] = 1; else delete chatWin.fwdSel[c.dataset.cwFwdc];
    const go = box.querySelector('[data-cw-fwdgo]');
    if(go) go.textContent = '➤ ' + (Object.keys(chatWin.fwdSel).length || '');
  }));
  const fwdM = box.querySelector('[data-cw-fwdm]');
  if(fwdM) fwdM.addEventListener('click', ()=>{ chatWin.fwdMode = true; chatWin.fwdSel = {}; renderChatWin(); });
  const fwdOff = box.querySelector('[data-cw-fwdoff]');
  if(fwdOff) fwdOff.addEventListener('click', ()=>{ chatWin.fwdMode = false; chatWin.fwdSel = {}; renderChatWin(); });
  const fwdGoB = box.querySelector('[data-cw-fwdgo]');
  if(fwdGoB) fwdGoB.addEventListener('click', ()=>{
    const idx = Object.keys(chatWin.fwdSel || {}).map(Number).sort((a, b) => a - b);
    if(!idx.length) return toast('Відмітьте галочками, що переслати');
    fwdGo(idx);
  });
  const file = box.querySelector('[data-cw-file]');
  // Скріпок дві: у рядку вводу й «+» у смужці. Обидві роблять те саме.
  box.querySelectorAll('[data-cw-clip]').forEach(b => b.addEventListener('click', ()=> file.click()));
  file.addEventListener('change', ()=>{
    /* Копію списку робимо ДО того, як чистимо поле. `file.files` — живий
       список: `file.value = ''` спорожнює і його теж, і вибрані картинки
       зникали в ту саму мить, коли ми їх нібито взяли. Виглядало це як
       «вибрав чотири фото — і нічого не сталось». */
    const list = Array.from(file.files || []);
    file.value = '';
    if(list.length) chatTake(list);
  });
  box.querySelectorAll('[data-cw-unpic]').forEach(b => b.addEventListener('click', ()=>{
    const pics = chatPics();
    chatDropPic(pics.splice(+b.dataset.cwUnpic, 1)[0]);
    renderChatWin();
  }));
  // Роздивитись перед відправкою — те, заради чого смужка й зʼявилась.
  box.querySelectorAll('[data-cw-big]').forEach(img => img.addEventListener('click', ()=>{
    const p = chatPics()[+img.dataset.cwBig];
    if(p) picBig(p.url);
  }));
  /* Вставка з буфера. Скриншот у Windows лягає саме туди, і йти через
     «зберегти файл → скріпка → знайти файл» заради нього — три зайві дії. */
  inp.addEventListener('paste', e => {
    const items = Array.from((e.clipboardData || {}).items || []);
    const imgs = items.filter(it => /^image\//.test(it.type || ''))
                      .map(it => it.getAsFile()).filter(Boolean);
    if(imgs.length){ e.preventDefault(); chatTake(imgs); }
  });
  /* Фокус — так, прокрутка сторінки — ні. Розмова в розділі чатів стоїть у
     потоці, і звичайний focus() тягне сторінку до поля: список зверху
     виїжджав за край, і замість трьох розмов лишалась одна. */
  if(focusIn){ try{ inp.focus({ preventScroll:true }); }catch(e){ inp.focus(); } }
}

async function chatSend(o, text){
  if(!canWrite()){ toast('Писати клієнту — не ваша зона'); return; }
  const вийшло = (chatWin.kind === 'tg') ? await tgSend(o, text) : await crmSend(o, text);
  /* Перемальовуємо саме зону переписки. Доти після надсилання оновлювалась
     лише картка, і власна репліка зʼявлялась у стрічці аж за секунду —
     коли приходила відповідь сервера. Виглядало як «не надіслалось». */
  if(chatWin) renderChatWin(true);
  touchOrder(o);        // написали клієнту — картка йде нагору
  renderBoard();
  return вийшло;
}

/* Фото: спершу в Cloudinary. Telegram забирає картинку за адресою сам, і
   гнати заради нього байти через воркер не треба. Sitniks приймає по-різному
   залежно від акаунта — тому тримаємо напоготові і адресу, і самі байти, і
   віддаємо те, що він візьме (див. crmSendPic).

   ПОРЯДОК: спершу картинки, під ними підпис — окремим повідомленням.
   Андрій: «фотки спочатку відправляються окремим повідомленням, і потім
   внизу ще окремим повідомленням підпис». Так воно й читається: кадри, а
   під ними рядок про них.

   Картинки йдуть ПАЧКОЮ — одним повідомленням із кількома адресами, як і
   пише людина в Direct. Telegram так не вміє, там кожне фото окреме. */
/* ФОРМАТ, ЯКИЙ ПРИЙМАЧ РОЗУМІЄ.

   Instagram у Direct бере jpeg, png і gif. Webp він не бере — а наш
   зменшувач робить саме webp щоразу, коли в картинці є прозорість:
   логотипи, вирізані макети, скриншоти з прозорим тлом. Така картинка
   доходить до Sitniks і зупиняється там: у CRM вона є, у клієнта немає, і
   зрозуміти, чому одні фото доходять, а інші ні, неможливо.

   Тому перед відправкою webp перекладаємо в png: прозорість лишається,
   формат стає тим, який приймач розуміє. Картки малюються в jpeg і цього
   рядка навіть не помічають. */
function picSendable(blob){
  if(!/webp/i.test((blob && blob.type) || '')) return Promise.resolve(blob);
  return new Promise(resolve => {
    const img = new Image();
    const src = URL.createObjectURL(blob);
    const done = b => { try{ URL.revokeObjectURL(src); }catch(e){} resolve(b || blob); };
    img.onload = ()=>{
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      cv.toBlob(done, 'image/png');
    };
    img.onerror = ()=> done(null);
    img.src = src;
  });
}
async function chatSendPics(o, pics, text){
  if(!canSendFiles()){ toast('Надсилати файли — не ваша зона'); return; }
  if(!pics.length) return;
  const isTg = chatWin.kind === 'tg';
  /* СМУЖКА ЛИШАЄТЬСЯ НА МІСЦІ, ПОКИ ЙДЕ ВІДПРАВКА.

     Доти вона очищалась ПЕРШИМ рядком — і разом із нею зникав напис
     «Надсилаємо…», бо він живе всередині неї. Виходило так: натиснув,
     фото зникли, поле порожнє, і три-чотири секунди, поки картинка
     вантажиться в хмару й далі в Sitniks, на екрані не діється нічого.
     Рівно це Андрій і називає «відправляєш, воно висне». Людина тисне ще
     раз — і другий натиск мовчки не робить нічого, бо його глушить
     прапорець.

     Тепер смужка стоїть із позначкою «надсилаємо», і зникає лише тоді,
     коли справді надіслано. */
  chatWin.picsBusy = true;
  renderChatWin(true);
  /* Фото — у стрічку одразу, як і текст: «надсилаю…» поки летить (08.10). */
  const мій = isTg ? null : crmPicsAdd(o, pics.map(p => p.url).filter(Boolean), 'pending');
  if(мій) crmPicsShow(o);
  const back = ()=>{
    if(мій){ crmPicsDrop(o, мій.k); crmPicsShow(o); }
    chatWin.pics = pics; chatWin.picsBusy = false; renderChatWin();
  };
  let urls = [], blobs = [];
  const t0 = Date.now(), сек = () => Math.max(1, Math.round((Date.now() - t0) / 1000));
  let tUp = 0;
  try{
    for(const p of pics){
      const b = await chatTimed(picSendable(p.blob), 30000, 'фото не підготувалось за 30 с');
      blobs.push(b);
      urls.push(await chatTimed(uploadCloudinary(b), 90000, 'хмара не відповіла за 90 с'));
    }
    tUp = сек();
  }
  catch(e){
    console.warn('chat photo', e);
    back();
    if(text){ chatWin.draft = text; renderChatWin(); }   // підпис не губимо
    toast('Фото не завантажилось' + (e && e.message ? ': ' + e.message : '') + ' — спробуйте ще раз');
    return;
  }
  if(isTg){
    /* tgSend тепер чесно каже, чи вийшло (14.10) — доти помилка тут не
       ловилась ніколи, і смужка чистилась, хоч фото не пішло. */
    for(const u of urls){
      if(!(await tgSend(o, '', u))){ back(); if(text){ chatWin.draft = text; renderChatWin(); } return; }
    }
  }else{
    try{
      const way = await crmPicTimed(o, urls, blobs, мій);
      /* Впізнати власне вкладення в стрічці за адресою не вийде: Sitniks
         забирає картинку до себе й віддає вже своєю (див. crmOutOwn).
         Адреси кладемо про запас, а справжня прикмета — номер
         повідомлення, і його запамʼятав сам crmSendPic. */
      urls.forEach(u => { crmOutNote(o, u); crmSent.add(u); });
      crmAnswered(o);            // відповіли картинкою — теж відповіли
      chatWin.note = false;
      /* Скільки йшло й де — щоб «довго» мало число: хмара чи Sitniks. */
      toast(picWord(urls.length) + ' надіслано за ' + сек() + ' с (хмара ' + tUp + ' с' + (way ? ', ' + way : '') + ')');
      console.info('фото: хмара ' + tUp + ' с, разом ' + сек() + ' с\n' + (crmPicLog || []).join('\n'));
    }catch(e){
      /* НІЯКОГО ПОСИЛАННЯ ЗАМІСТЬ КАРТИНКИ. Раніше тут спрацьовував
         запасний шлях: не пройшла картинка — летіла її адреса, щоб робота
         не спинилась. Андрій: «повинна бути тільки картинка». І він має
         рацію: синє посилання в Direct майже ніхто не відкриває, тобто
         замість картки клієнт отримував порожнє місце.

         Тому не надсилаємо нічого. Картинки повертаються у смужку, текст —
         у поле, і менеджер вирішує сам: спробувати ще раз чи написати
         інакше. Половина відправки гірша за жодної. */
      console.warn('Sitniks photo', e);
      back();
      if(text) chatWin.draft = text;
      renderChatWin();
      toast('Картинку не прийняли за ' + сек() + ' с: ' + (e.message || 'Sitniks відмовив') +
            ' · нічого не надіслано, спробуйте ще раз');
      console.warn('фото: хмара ' + tUp + ' с\n' + (crmPicLog || []).join('\n'));
      return;
    }
  }
  /* Тепер — позначка на самих картках. Ставить її саме відправка: панель
     лише готує, і до цієї миті ніхто ще не знає, чи дійшло.

     Мить відправки й лічильник реплік клієнта на неї — те, на чому
     тримається друга галочка на кнопці КП: клієнт озвався ПІСЛЯ карток,
     значить розмова пішла. */
  const cards = pics.filter(x => x.cardId);
  if(cards.length){
    const sent = o.cardsSent || (o.cardsSent = {});
    const now = new Date().toISOString();
    cards.forEach(x => { sent[x.cardId] = { at: now, by: myName() }; });
    o.cardsAt = now;
    o.cardsWrote = cardsWroteNow(o);
  }
  /* Зберігаємо ЗАВЖДИ, а не лише після карток. У памʼяті картки лежить
     прикмета, за якою власне фото впізнають у стрічці; звичайне фото цей
     рядок обходило — і назавтра воно ставало ліворуч, як клієнтське. */
  saveOrderMeta(o).catch(e => console.warn(e));
  /* Аж тепер прибираємо смужку — коли справді надіслано. Доти вона зникала
     першим рядком, ще до завантаження в хмару, і при збої фото доводилось
     шукати заново. */
  pics.forEach(chatDropPic);
  chatWin.pics = (chatWin.pics || []).filter(x => pics.indexOf(x) < 0);
  chatWin.picsBusy = false;
  /* Надіслали — панель зникає сама. Вона показує, ЩО ЛЕЖИТЬ У ПОЛІ; коли в
     полі вже нічого немає, вона висить порожньою обіцянкою, і менеджер
     мимоволі чекає від неї ще одної дії. */
  if(!chatPics().length) chatWin.cards = null;
  if(text){ try{ await chatSend(o, text); }catch(e){ console.warn(e); } }
  renderChatWin(true);
  /* Картинка — таке саме повідомлення клієнту, як і лист, і картка від неї
     так само має піднятись угору колонки. Доти цей рядок стояв лише в
     дорозі для тексту: написали — картка нагорі, надіслали фото — ні, і
     замовлення тонуло під тими, де сьогодні не робили нічого. */
  touchOrder(o);
  renderBoard();
}
function picWord(n){
  const t = n % 10, h = n % 100;
  if(t === 1 && h !== 11) return 'Картинку';
  return n + ' ' + ((t >= 2 && t <= 4 && (h < 12 || h > 14)) ? 'картинки' : 'картинок');
}
