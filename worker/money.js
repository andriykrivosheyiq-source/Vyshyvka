/**
 * Loomiq — гроші: Монобанк, Приват для бізнесу, накладений платіж Нової пошти.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ЩО ЦЕ Й ЧОМУ САМЕ ВОРКЕР
 *
 * Питання «клієнт заплатив?» задають щодня й багато разів. Доти на нього
 * відповідали пʼятьма вкладками банку, застосунком Нової пошти й памʼяттю —
 * і кожна така відповідь коштувала хвилин, а іноді була неправдою.
 *
 * Ключі банків не можна класти в адмінку НІ ЗА ЯКИХ УМОВ. Адмінка — статична
 * сторінка: усе, що в ній написано, віддається браузеру й читається кожним,
 * хто відкрив вкладку розробника. З токеном ФОПа стороння людина бачить усі
 * ваші рухи, а з ключем Нової пошти створює накладні за ваш рахунок.
 *
 * Тому ключі живуть ТУТ, секретами Cloudflare Worker, і назовні не виходять
 * ніколи. Адмінка їх не знає й знати не може: вона читає вже готові рядки з
 * Firestore, як читала б їх від людини, що вводила руками.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ТРИ ДЖЕРЕЛА Й ТРИ РІЗНІ ХАРАКТЕРИ
 *
 *   МОНОБАНК шле сам, вебхуком. Платіж зʼявляється за секунди. Це найкращий
 *   випадок, і саме так усе мало б працювати скрізь.
 *
 *   ПРИВАТ для бізнесу вебхуків не дає. Виписку доводиться питати самим, і
 *   робить це розклад — раз на кілька хвилин. Тобто платіж зʼявиться не
 *   миттєво, і з цим нічого не вдіяти: так влаштований їхній Автоклієнт.
 *
 *   НОВА ПОШТА взагалі не банк. Накладений платіж вона збирає з отримувача й
 *   переказує пачками, із власним номером переказу. Тому тут два кроки:
 *   спершу беремо свої накладні за період, потім питаємо їхній платіжний
 *   стан — і рядок заводимо лише тоді, коли гроші справді виплачені.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ОДНЕ ПРАВИЛО НА ВСІ ТРИ: ЖОДНИХ ДУБЛІВ
 *
 * Вебхук Монобанку приходить двічі, якщо ми відповіли повільно. Розклад
 * Привату питає той самий день кілька разів поспіль. Накладна Нової пошти
 * лишається в списку тижнями. Якщо кожен прогін додаватиме рядок, підсумок
 * за тиждень виросте втричі — і цього ніхто не помітить, бо кожен окремий
 * рядок виглядає правильним.
 *
 * Тому в кожного руху є СВІЙ СТІЙКИЙ НОМЕР, і пишемо ми завжди в документ із
 * цим номером. Другий запис просто перезапише перший тим самим вмістом.
 * Привʼязку до замовлення й підпис, зроблені людиною, при цьому не чіпаємо:
 * вони наші, а не банківські.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * НАЛАШТУВАННЯ (значень тут немає й бути не може)
 *
 *   wrangler secret put FIREBASE_SA        — JSON службового акаунта Firebase
 *   wrangler secret put HOOK_SECRET        — довгий випадковий рядок для адрес
 *   wrangler secret put MONO_TOKEN_mono1   — і так для кожного рахунку Моно
 *   wrangler secret put PRIVAT_ID_privat1
 *   wrangler secret put PRIVAT_TOKEN_privat1
 *   wrangler secret put NP_API_KEY         — той самий ключ, що й у накладних
 *
 * Самі рахунки заводяться в адмінці (Фінанси → Рахунки): назва, банк, IBAN.
 * Воркер читає цей список із Firestore — тож додати пʼятий ФОП означає
 * завести його в адмінці й покласти сюди один секрет, а не правити код.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * АДРЕСИ
 *
 *   POST /mono/<acc>?s=<HOOK_SECRET>   — сюди шле Монобанк
 *   GET  /mono/setup/<acc>?s=...       — сказати Монобанку цю адресу
 *   GET  /poll?s=...                   — опитати Приват і Нову пошту зараз
 *   GET  /np/probe/<ttn>?s=...         — показати, що САМЕ каже НП про накладну
 *   GET  /privat/balance/<acc>?s=...   — що САМЕ каже Приват про залишок
 *
 * Розклад (у wrangler.toml) викликає опитування сам, без жодного натиску.
 */

/* Версія коду — у кожній відповіді. Код у Cloudflare вставляють руками, і
   «а що зараз стоїть» інакше не перевірити. Міняти при кожній правці. */
const VERSION = '2026-10-07.2 · NovaPay: один вхід одночасно, догонить пропущені дні';
const FS = 'https://firestore.googleapis.com/v1';
const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';
const PRIVAT_URL = 'https://acp.privatbank.ua/api/statements/transactions';
const PRIVAT_BAL_URL = 'https://acp.privatbank.ua/api/statements/balance';
const MONO_URL = 'https://api.monobank.ua';

/* ── Дрібниці ─────────────────────────────────────────────────────────── */
const json = (body, status) => new Response(JSON.stringify(
    (body && typeof body === 'object' && !Array.isArray(body)) ? Object.assign({ версія: VERSION }, body) : body, null, 2),
  { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pad = n => (n < 10 ? '0' : '') + n;

/* ══════════════════════════════════════════════════════════════════════════
   FIRESTORE

   Пишемо REST-ом від імені службового акаунта. Бібліотек тут немає й не
   треба: весь обмін — два запити, а підпис JWT уміє сам браузерний WebCrypto,
   який у воркері є.
   ══════════════════════════════════════════════════════════════════════════ */
let TOKEN = null;         // кешуємо: токен живе годину, а прогонів за годину багато

async function accessToken(env) {
  if (TOKEN && TOKEN.until > Date.now() + 60000) return TOKEN.value;
  const sa = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now
  })));
  /* Ключ у файлі службового акаунта лежить у PEM; WebCrypto хоче голий DER. */
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(head + '.' + body));
  const jwt = head + '.' + body + '.' + b64url(sig);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Firebase не дав токен: ' + JSON.stringify(d));
  TOKEN = { value: d.access_token, until: Date.now() + (d.expires_in || 3600) * 1000 };
  return TOKEN.value;
}
const docPath = (env, path) =>
  FS + '/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents/' + path;

/* Значення Firestore. Числа пишемо doubleValue, дати — рядком ISO: адмінка
   сортує їх порівнянням рядків і питає `where('at','>=',ISO)`, тож тип має
   збігатись із тим, що вона кладе руками. */
function fval(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'object') {
    const fields = {};
    for (const k of Object.keys(v)) if (v[k] !== undefined) fields[k] = fval(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
/* Мапа з fsGet приходить сирими полями Firestore — розбираємо до звичайних. */
function fplain(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) {
    const f = fields[k] || {};
    out[k] = f.stringValue !== undefined ? f.stringValue
           : f.doubleValue !== undefined ? f.doubleValue
           : f.integerValue !== undefined ? +f.integerValue
           : f.booleanValue !== undefined ? f.booleanValue
           : null;
  }
  return out;
}
async function fsGet(env, path) {
  const r = await fetch(docPath(env, path),
    { headers: { Authorization: 'Bearer ' + await accessToken(env) } });
  if (r.status === 404) return null;
  const d = await r.json();
  if (!d.fields) return null;
  const out = {};
  for (const k of Object.keys(d.fields)) {
    const f = d.fields[k];
    out[k] = f.stringValue !== undefined ? f.stringValue
           : f.doubleValue !== undefined ? f.doubleValue
           : f.integerValue !== undefined ? +f.integerValue
           : f.booleanValue !== undefined ? f.booleanValue
           : f.mapValue ? f.mapValue.fields
           : f.arrayValue ? (f.arrayValue.values || [])
           : null;
  }
  return out;
}
/* Записуємо ТІЛЬКИ свої поля. `updateMask` тут не оптимізація, а суть: у
   документі вже можуть лежати `orderId` і `tag`, проставлені людиною, і
   перезаписати їх банківським прогоном означало б щоночі втрачати ручну
   роботу. */
function fsFields(obj) {
  const fields = {}, keys = [];
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    fields[k] = fval(obj[k]);
    keys.push(k);
  }
  return { fields, keys };
}
/* ПАКЕТОМ. Cloudflare на безкоштовному тарифі дає воркеру 50 звернень
   назовні за один запуск («Too many subrequests», 03.10). Кілька сотень
   отриманих посилок, записані по одній, у це не влазили. Тому рухи
   опитування складаємо в пакет і пишемо одним зверненням на 300 записів —
   з тим самим updateMask, тобто ручну привʼязку так само не чіпаємо. */
async function fsCommit(env, list) {
  for (let i = 0; i < list.length; i += 300) {
    const writes = list.slice(i, i + 300).map(w => {
      const { fields, keys } = fsFields(w.obj);
      return { update: { name: 'projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents/' + w.path, fields },
               updateMask: { fieldPaths: keys } };
    });
    const r = await fetch(FS + '/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents:commit', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes })
    });
    if (!r.ok) throw new Error('Firestore commit ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }
  return list.length;
}
async function fsWrite(env, path, obj) {
  const { fields, keys } = fsFields(obj);
  const mask = keys.map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k));
  const r = await fetch(docPath(env, path) + '?' + mask.join('&'), {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + await accessToken(env),
               'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error('Firestore ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   ОДИН РУХ

   `id` — стійкий номер руху в його джерелі. Саме він і робить повторний
   прогін нешкідливим: другий запис просто ляже на перший.
   ══════════════════════════════════════════════════════════════════════════ */
/* З копійками. Доти суму округлювали до гривні, і на сотнях рухів залишок,
   порахований з них, розходився з банком на десятки гривень (03.10). */
const kop = n => Math.round((+n || 0) * 100) / 100;
async function payment(env, p, batch) {
  if (!p.id || !p.amount) return false;
  const obj = {
    at: p.at,                       // ISO, рядком — як його кладе адмінка
    amount: kop(p.amount),          // гривні з копійками; мінус — витрата
    acc: p.acc || '',
    counter: (p.counter || '').slice(0, 120),
    desc: (p.desc || '').slice(0, 300),
    src: p.src || '',               // mono | privat | np — видно, звідки взялось
    ttn: p.ttn || undefined,        // номер накладної — за ним адмінка привʼязує рух до замовлення
    /* Залишок після цього руху — коли банк його каже (Монобанк каже). */
    balAfter: p.balAfter == null ? undefined : kop(p.balAfter),
    /* Що це за рух за словами самого банку (NovaPay): pool — пул наложок
       (гроші вже пораховані поштучно за ТТН), self — переказ собі ж, на
       рахунок з тим самим ІПН. Адмінка не рахує їх доходом чи витратою. */
    flow: p.flow || undefined,
    tz: 1                           // час уже правильний (по Києву) — див. fixTz
  };
  if (batch) batch.push({ path: 'payments/' + p.id, obj });
  else await fsWrite(env, 'payments/' + p.id, obj);
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   ЗАЛИШОК ВІД БАНКУ

   Скільки на рахунку — питання до банку, а не до нашої арифметики. Сума
   «початковий залишок + рухи» розходиться з банком щоразу, коли рух пройшов
   повз нас (вебхук ще не стояв, Приват не віддав), або коли початковий
   залишок вписали не на ту дату. Тому банк, який називає залишок, і є
   правдою: пишемо його в loomiq/bankBal, по полю на рахунок.

   `at` — момент, на який банк назвав це число. Вебхуки Монобанку бувають не
   по порядку: старіший рух, що прийшов пізніше, не має права затерти
   свіжіший залишок.
   ══════════════════════════════════════════════════════════════════════════ */
async function bankBalance(env, acc, bal, at, src) {
  if (!acc || !/^[A-Za-z0-9_]+$/.test(acc) || !isFinite(+bal)) return false;
  const doc = await fsGet(env, 'loomiq/bankBal');
  const was = doc && doc[acc] ? fplain(doc[acc]) : null;
  if (was && was.at && String(was.at) > String(at)) return false;
  await fsWrite(env, 'loomiq/bankBal', {
    [acc]: { bal: kop(bal), at: String(at), src: src || '', got: new Date().toISOString() }
  });
  return true;
}

/* Список рахунків — із самої адмінки. Заводити тут другий довідник означало б
   мати дві правди про те, скільки в нас ФОПів. */
async function accounts(env) {
  const doc = await fsGet(env, 'loomiq/photos');
  const fin = (doc && doc.fin) || null;
  const raw = (fin && fin.accounts && fin.accounts.arrayValue)
    ? fin.accounts.arrayValue.values : (fin && fin.accounts ? fin.accounts.values : null);
  const list = [];
  (raw || []).forEach(v => {
    const f = (v.mapValue && v.mapValue.fields) || {};
    list.push({
      id: (f.id && f.id.stringValue) || '',
      bank: (f.bank && f.bank.stringValue) || '',
      iban: ((f.iban && f.iban.stringValue) || '').replace(/\s+/g, ''),
      name: (f.name && f.name.stringValue) || ''
    });
  });
  return list.filter(a => a.id);
}

/* ══════════════════════════════════════════════════════════════════════════
   МОНОБАНК

   Шле сам. Тіло: {type:'StatementItem', data:{account, statementItem:{...}}}.
   Суми в копійках і зі знаком: надходження додатне, витрата відʼємна.

   Відповідати треба ШВИДКО й завжди 200. Монобанк вважає повільну або
   ненульову відповідь невдачею й шле те саме ще раз; а оскільки номер руху в
   нас стійкий, повтор і так нешкідливий — але краще його не викликати.
   ══════════════════════════════════════════════════════════════════════════ */
/* ТІЛЬКИ РАХУНОК ФОПА. Токен Монобанку — людини, а не рахунку: з ним видно
   всі її рахунки, і особисті картки теж, і вебхук шле рухи по кожному.
   Записати їх усі в рахунок ФОПа означало б покласти у Фінанси особисті
   покупки власника. Тому під час підключення (/mono/setup) знаходимо в
   Монобанку рахунок із тим IBAN, що вписаний у Фінансах, запамʼятовуємо
   його номер, і далі пишемо лише рухи цього рахунку. */
let MONO_MAP = null;
async function monoMap(env, fresh) {
  if (MONO_MAP && !fresh && MONO_MAP.until > Date.now()) return MONO_MAP.map;
  const d = await fsGet(env, 'loomiq/monoMap');
  MONO_MAP = { map: d || {}, until: Date.now() + 5 * 60000 };
  return MONO_MAP.map;
}
/* Рахунок Монобанку за IBAN — чисте перетворення, перевіряється без банку. */
function monoPick(info, iban) {
  const want = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!want) return null;
  return ((info && info.accounts) || []).filter(a =>
    String(a.iban || '').replace(/\s+/g, '').toUpperCase() === want)[0] || null;
}
async function monoHook(env, acc, body) {
  const data = (body || {}).data || {};
  const it = data.statementItem;
  if (!it || !it.id) return 0;
  const map = await monoMap(env);
  /* Рух кладемо в той рахунок Фінансів, якому належить рахунок Монобанку.
     Вебхук у Монобанку один на токен: якщо в однієї людини кілька
     рахунків ФОП (гривня й валюта, кілька ФОПів), адреса в нього остання з
     підключених — тому шукаємо рахунок за номером, а не за адресою.
     Підключення не зроблене чи рахунок у Фінансах не заведений — не пишемо. */
  const mono = String(data.account || '');
  const куди = Object.keys(map).filter(k => mono && String(map[k]) === mono)[0];
  if (!куди) return 0;
  acc = куди;
  const at = new Date((+it.time || 0) * 1000).toISOString();
  /* `balance` у Монобанку — залишок ПІСЛЯ цього руху, у копійках. */
  const після = it.balance == null ? null : (+it.balance || 0) / 100;
  await payment(env, {
    id: 'mono_' + it.id,
    at,
    amount: (+it.amount || 0) / 100,
    acc,
    counter: it.counterName || it.counterEdrpou || '',
    desc: [it.description, it.comment].filter(Boolean).join(' · '),
    src: 'mono',
    balAfter: після
  });
  if (після != null) await bankBalance(env, acc, після, at, 'mono');
  return 1;
}
/* Сказати Монобанку, куди слати. Робиться один раз на рахунок; повторний
   виклик просто замінює адресу. */
async function monoSetup(env, acc, url) {
  const token = env['MONO_TOKEN_' + acc];
  if (!token) throw new Error('Немає секрета MONO_TOKEN_' + acc);
  /* Спершу — який саме рахунок цієї людини наш (за IBAN із Фінансів). */
  const mine = (await accounts(env)).filter(a => a.id === acc)[0];
  if (!mine) throw new Error('У Фінансах немає рахунку з кодом ' + acc);
  if (!mine.iban) throw new Error('У рахунку ' + acc + ' (Фінанси → Рахунки) не вписаний IBAN — без нього не відрізнити рахунок ФОПа від особистих карток');
  const ci = await fetch(MONO_URL + '/personal/client-info', { headers: { 'X-Token': token } });
  const info = await ci.json().catch(() => null);
  if (!ci.ok || !info) throw new Error('Монобанк не віддав список рахунків: ' + JSON.stringify(info).slice(0, 200));
  const hit = monoPick(info, mine.iban);
  if (!hit) throw new Error('Серед рахунків цього токена немає IBAN ' + mine.iban +
    '. Є: ' + ((info.accounts || []).map(a => '…' + String(a.iban || '').slice(-4) + ' (' + (a.type || '') + ')').join(', ') || 'жодного'));
  await fsWrite(env, 'loomiq/monoMap', { [acc]: hit.id });
  MONO_MAP = null;
  /* Залишок — одразу, не чекаючи першого руху: інакше картка рахунку до
     першої покупки показувала б нашу арифметику, а не банк. */
  if (hit.balance != null)
    await bankBalance(env, acc, (+hit.balance || 0) / 100, new Date().toISOString(), 'mono');
  const r = await fetch(MONO_URL + '/personal/webhook', {
    method: 'POST',
    headers: { 'X-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webHookUrl: url })
  });
  const t = await r.text();
  if (!r.ok) throw new Error('Монобанк відмовив: ' + t.slice(0, 200));
  return t;
}

/* ══════════════════════════════════════════════════════════════════════════
   ПРИВАТ ДЛЯ БІЗНЕСУ (Автоклієнт)

   Вебхуків немає — питаємо самі. Автоклієнт хоче заголовки `id` і `token` і
   віддає рухи за період по конкретному рахунку, тому IBAN обовʼязковий.

   Беремо ДВА останні дні, а не один: виписка за сьогодні дописується
   протягом дня, і рух, який прийшов о 23:58, інакше не потрапив би нікуди.
   Повтори нешкідливі — номер руху в Привату свій, стійкий (REF).
   ══════════════════════════════════════════════════════════════════════════ */
/* Залишок Привату. Автоклієнт віддає `balances[]` — по запису на день, з
   вихідним залишком `balanceOut`. Беремо найсвіжіший день саме цього IBAN.
   Імена полів читаємо з запасом, але не вигадуємо: немає числа — немає
   залишку, і картка лишається на нашій арифметиці. Що саме віддає банк,
   видно за адресою /privat/balance/<acc>. */
function privatDay(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s || '').trim());
  return m ? m[3] + '-' + m[2] + '-' + m[1] : String(s || '');
}
function privatBalPick(d, iban) {
  const want = String(iban || '').replace(/\s+/g, '').toUpperCase();
  const list = ((d && d.balances) || []).filter(b =>
    !want || !b.acc || String(b.acc).replace(/\s+/g, '').toUpperCase() === want);
  let best = null;
  for (const b of list) {
    const v = parseFloat(String(b.balanceOut ?? b.balanceOutEq ?? '').replace(',', '.'));
    if (!isFinite(v)) continue;
    const day = privatDay(b.dpd || b.date || '');
    if (!best || day >= best.day) best = { bal: v, day };
  }
  return best;
}
async function privatBalance(env, acc, raw) {
  const id = env['PRIVAT_ID_' + acc.id], token = env['PRIVAT_TOKEN_' + acc.id];
  if (!token || !acc.iban) return null;
  const h = { token: String(token).trim(), 'Content-Type': 'application/json;charset=utf8' };
  if (id) h.id = String(id).trim();
  const r = await fetch(PRIVAT_BAL_URL + '?acc=' + encodeURIComponent(acc.iban) +
                        '&startDate=' + privatDate(new Date(Date.now() - 3 * 864e5)) +
                        '&limit=20', { headers: h });
  const d = await r.json().catch(() => null);
  if (raw) return d;
  if (!d || (d.status && d.status !== 'SUCCESS')) return null;
  return privatBalPick(d, acc.iban);
}
function privatDate(d) {
  return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
}
async function privatPoll(env, acc) {
  const пакет = [];
  /* Новий Автоклієнт видає лише токен; старий — ще й ID. Шлемо, що є. */
  const id = env['PRIVAT_ID_' + acc.id], token = env['PRIVAT_TOKEN_' + acc.id];
  if (!token) return { acc: acc.id, skip: 'немає секрета PRIVAT_TOKEN_' + acc.id };
  if (!acc.iban) return { acc: acc.id, skip: 'у рахунку не заповнений IBAN' };
  const від = new Date(Date.now() - 2 * 864e5);
  const url = PRIVAT_URL + '?acc=' + encodeURIComponent(acc.iban) +
              '&startDate=' + privatDate(від) + '&limit=200';
  const h = { token: String(token).trim(), 'Content-Type': 'application/json;charset=utf8' };
  if (id) h.id = String(id).trim();
  const r = await fetch(url, { headers: h });
  const d = await r.json().catch(() => null);
  if (!d) return { acc: acc.id, error: 'Приват відповів не JSON (' + r.status + ')' };
  if (d.status && d.status !== 'SUCCESS')
    return { acc: acc.id, error: 'Приват: ' + (d.message || d.status) };
  let n = 0;
  for (const t of (d.transactions || [])) {
    const сума = Math.abs(parseFloat(String(t.SUM || t.SUM_E || '0').replace(',', '.'))) || 0;
    if (!сума) continue;
    /* TRANTYPE: C — прийшло, D — пішло. Знак ставимо ми, бо Приват віддає
       модуль, і без знака витрата лягла б у підсумок як дохід. */
    const дохід = String(t.TRANTYPE || 'C').toUpperCase() === 'C';
    await payment(env, {
      id: 'privat_' + (t.REF || t.ID || (t.DAT_OD + '_' + сума)),
      at: privatIso(t),
      amount: дохід ? сума : -сума,
      acc: acc.id,
      counter: t.AUT_CNTR_NAM || t.AUT_MY_CRF_NAM || '',
      desc: t.OSND || '',
      /* «Переказ власних коштів» (06.10) — ФОП виводить собі на картку: не
         витрата, між своїми, навіть поки саму картку не підключено. */
      flow: /переказ\s+власних\s+кошт/i.test(String(t.OSND || '')) ? 'self' : undefined,
      src: 'privat'
    }, пакет);
    n++;
  }
  await fsCommit(env, пакет);
  /* Залишок — окремим запитом. Не вдався — рухи від цього не гірші. */
  let залишок = null;
  try {
    const b = await privatBalance(env, acc);
    if (b) { await bankBalance(env, acc.id, b.bal, new Date().toISOString(), 'privat'); залишок = b.bal; }
  } catch (e) { залишок = 'не прочитано: ' + e.message; }
  return { acc: acc.id, рухів: n, залишок };
}
/* КИЇВСЬКИЙ ЧАС → ISO (05.10). Приват і Нова пошта кажуть час так, як він
   на годиннику в Києві («05.10.2026 14:17»), без поясу. Доти ми читали його
   як UTC — і в адмінці (вона показує по Києву) рух стояв на 2–3 години
   пізніше, ніж був. Тепер рахуємо зсув Києва саме на ту дату (літо +3,
   зима +2). */
function kyivIso(y, mo, d, h, mi, s) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kyiv', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const off = t => {
    const p = fmt.formatToParts(new Date(t));
    const g = k => +(p.find(x => x.type === k) || {}).value;
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - t;
  };
  const guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  let t = guess - off(guess);
  t = guess - off(t);              // другий крок — на випадок переходу на літній/зимовий час
  return new Date(t).toISOString();
}
/* Приват віддає час як «01.02.2026 13:45:00» або окремими полями. Беремо те,
   що є, і завжди повертаємо ISO: адмінка сортує рядком. */
function privatIso(t) {
  const s = String(t.DATE_TIME_DAT_OD_TIM_P || t.DAT_OD || '').trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) return kyivIso(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

/* ══════════════════════════════════════════════════════════════════════════
   КАРТКА ПРИВАТ24 ФІЗОСОБИ (06.10)

   Андрій: «привʼяжемо ще звичайну картку Зеленої Ірини, окрім Приват ФОП:
   ми туди виводимо кошти з ФОП, щоб, наприклад, заплатити співробітникам».
   «Автоклієнт» бачить лише рахунки ФОП, тож тут — API «Мерчант Приват24
   для фізосіб»: Приват24 → Усі послуги → Бізнес → Мерчант → Зареєструвати
   (на цю картку) → ID мерчанта й пароль. Секрети на рахунок <код>:
     PRIVAT24_ID_<код>, PRIVAT24_PASS_<код>, PRIVAT24_CARD_<код> (номер картки).
   Запит — XML; підпис = sha1(md5(вміст <data> + пароль)). MD5 у Workers
   немає (crypto.subtle його не знає) — тому свій, нижче.
   Рухи пишемо як src: 'privat' (банківські — незмінні правилами бази),
   id: p24_<…> — стійкий з дати, часу, коду авторизації й суми.
   ══════════════════════════════════════════════════════════════════════════ */
function md5hex(str){
  const b = new TextEncoder().encode(str);
  const n = (((b.length + 8) >>> 6) + 1) * 16, w = new Array(n).fill(0);
  for (let i = 0; i < b.length; i++) w[i >> 2] |= b[i] << ((i % 4) * 8);
  w[b.length >> 2] |= 0x80 << ((b.length % 4) * 8);
  w[n - 2] = (b.length * 8) >>> 0; w[n - 1] = Math.floor(b.length / 0x20000000);
  const K = [], S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  const rol = (x, c) => (x << c) | (x >>> (32 - c));
  for (let o = 0; o < n; o += 16) {
    let A = a0, B = b0, C = c0, Dd = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & Dd); g = i; }
      else if (i < 32) { F = (Dd & B) | (~Dd & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ Dd; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~Dd); g = (7 * i) % 16; }
      const t = Dd; Dd = C; C = B;
      B = (B + rol((A + F + K[i] + w[o + g]) | 0, S[i])) | 0; A = t;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + Dd) | 0;
  }
  return [a0, b0, c0, d0].map(x => { let h = ''; for (let i = 0; i < 4; i++) h += ((x >>> (i * 8)) & 255).toString(16).padStart(2, '0'); return h; }).join('');
}
async function sha1hex(str){
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function p24Request(env, acc, url, props){
  const id = String(env['PRIVAT24_ID_' + acc.id] || '').trim(), pass = String(env['PRIVAT24_PASS_' + acc.id] || '').trim();
  const data = '<oper>cmt</oper><wait>0</wait><test>0</test><payment id="">' +
    props.map(p => '<prop name="' + p[0] + '" value="' + xmlEsc(p[1]) + '" />').join('') + '</payment>';
  const sign = await sha1hex(md5hex(data + pass));
  const body = '<?xml version="1.0" encoding="UTF-8"?><request version="1.0"><merchant><id>' + xmlEsc(id) +
    '</id><signature>' + sign + '</signature></merchant><data>' + data + '</data></request>';
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/xml; charset=utf-8' }, body });
  const t = await r.text();
  /* Помилка в Приват24 — <error message="…"/> або <response><data><error …>. */
  const err = /<error[^>]*message="([^"]*)"/i.exec(t) || /<error>([^<]*)<\/error>/i.exec(t);
  if (err) throw new Error('Приват24: ' + xmlUnesc(err[1]));
  if (!r.ok) throw new Error('Приват24 ' + r.status + ': ' + t.slice(0, 200));
  return t;
}
function p24Attrs(tag){
  const o = {}; const re = /([\w-]+)="([^"]*)"/g; let m;
  while ((m = re.exec(tag))) o[m[1]] = xmlUnesc(m[2]);
  return o;
}
/* Рух виписки → платіж. Сума — «cardamount» зі знаком у валюті картки. */
function p24Row(st, accId){
  const amt = parseFloat(String(st.cardamount || st.amount || '').replace(',', '.'));
  if (!isFinite(amt) || !amt) return null;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(st.trandate || '').trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(st.trantime || '').trim()) || [];
  if (!d) return null;
  const key = [st.trandate, st.trantime, st.appcode || '', String(st.cardamount || '').replace(/\s+/g, '')].join('_');
  return {
    id: 'p24_' + accId + '_' + key.replace(/[^\w.-]/g, ''),
    at: kyivIso(+d[1], +d[2], +d[3], +(t[1] || 12), +(t[2] || 0), +(t[3] || 0)),
    amount: amt, acc: accId,
    counter: String(st.terminal || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    desc: String(st.description || '').replace(/\s+/g, ' ').trim(),
    src: 'privat',
    balAfter: (() => { const v = parseFloat(String(st.rest || '').replace(',', '.')); return isFinite(v) ? v : null; })()
  };
}
function p24Date(d){ return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
async function p24Poll(env, acc, raw){
  const card = String(env['PRIVAT24_CARD_' + acc.id] || '').replace(/\D/g, '');
  if (!env['PRIVAT24_ID_' + acc.id] || !env['PRIVAT24_PASS_' + acc.id] || !card)
    return { acc: acc.id, skip: 'немає секретів PRIVAT24_ID_' + acc.id + ' / PRIVAT24_PASS_' + acc.id + ' / PRIVAT24_CARD_' + acc.id };
  const до = new Date(), від = new Date(Date.now() - 3 * 864e5);
  const xml = await p24Request(env, acc, 'https://api.privatbank.ua/p24api/rest_fiz',
    [['sd', p24Date(від)], ['ed', p24Date(до)], ['card', card]]);
  const rows = (xml.match(/<statement\b[^>]*\/?>/gi) || []).map(p24Attrs);
  if (raw) return { рухи_сирі: rows.slice(0, 10), відповідь: xml.replace(/\s+/g, ' ').slice(0, 1500) };
  const пакет = []; let n = 0;
  for (const st of rows) { const r = p24Row(st, acc.id); if (r && await payment(env, r, пакет)) n++; }
  await fsCommit(env, пакет);
  /* Залишок — окремим запитом; не вдався — рухи від цього не гірші. */
  let залишок = null;
  try {
    const b = await p24Request(env, acc, 'https://api.privatbank.ua/p24api/balance', [['cardnum', card], ['country', 'UA']]);
    const v = parseFloat(String((/<av_balance>([^<]*)</i.exec(b) || /<balance>([^<]*)</i.exec(b) || [])[1] || '').replace(',', '.'));
    if (isFinite(v)) { await bankBalance(env, acc.id, v, new Date().toISOString(), 'privat'); залишок = v; }
  } catch (e) { залишок = 'не прочитано: ' + e.message; }
  return { acc: acc.id, рухів: n, залишок };
}

/* ══════════════════════════════════════════════════════════════════════════
   НАКЛАДЕНИЙ ПЛАТІЖ НОВОЇ ПОШТИ

   Нова пошта не банк, і рух тут не один, а два: спершу вона забирає гроші в
   отримувача на відділенні, потім переказує їх нам — пачкою, зі своїм
   номером переказу й за кілька днів.

   Тому рядок заводимо ЛИШЕ на виплачене. Заводити його в мить видачі посилки
   означало б показувати в підсумку гроші, яких на рахунку ще немає, — а саме
   цим числом і вирішують, чи вистачає на закупівлю.

   Два кроки:
     1. `InternetDocument.getDocumentList` — наші накладні за період;
     2. `TrackingDocument.getStatusDocuments` — їхній платіжний стан, по сто.

   ЧЕСНО ПРО ПОЛЯ. Набір полів у відповіді Нової пошти залежить від договору,
   і в документації він описаний неповно. Тому читаємо кілька можливих імен і
   заводимо рух тільки тоді, коли є І сума, І номер переказу — тобто коли
   виплата справді сталась. Побачити, що саме віддає НП конкретно вам, можна
   адресою /np/probe/<ttn>: вона показує сирий відгук, не вигадуючи нічого.
   ══════════════════════════════════════════════════════════════════════════ */
/* ЧАСТОТА. НП обмежує, як часто до неї звертаються («To many requests»,
   03.10): опитування кожні 5 хв плюс кілька запитів поспіль (сторінки
   накладних, стани) упирались у ліміт. Тому між запитами — пауза, а на
   «забагато запитів» — повтор після очікування, двічі. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let NP_LAST = 0;
const NP_GAP = 1200, NP_WAIT = [5000, 15000];
async function np(env, model, method, props) {
  for (let спроба = 0; ; спроба++) {
    const чекати = NP_LAST + NP_GAP - Date.now();
    if (чекати > 0) await sleep(чекати);
    NP_LAST = Date.now();
    const r = await fetch(NP_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: env.NP_API_KEY, modelName: model,
                             calledMethod: method, methodProperties: props || {} })
    });
    const d = await r.json().catch(() => null);
    const помилка = !d ? 'Нова пошта відповіла не JSON (' + r.status + ')'
      : d.success ? '' : ([].concat(d.errors || [], d.warnings || [])
          .filter(Boolean).join('; ') || 'Нова пошта відмовила без пояснення');
    if (!помилка) return d.data || [];
    const частота = r.status === 429 || /many requests/i.test(помилка);
    if (частота && спроба < NP_WAIT.length) {
      await sleep(NP_WAIT[спроба]);
      continue;
    }
    /* Словами, щоб було видно: це вже нова версія, вона чекала й повторювала,
       і НП досі просить паузу — отже треба просто почекати довше. */
    if (частота) throw new Error('Нова пошта: забагато запитів (' + помилка + '). Спробував ' +
      (NP_WAIT.length + 1) + ' рази з паузами — НП досі просить зачекати. Повторіть за 15–30 хв.');
    throw new Error(помилка);
  }
}
function npDate(d) {
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
}
/* Скільки виплачено й яким переказом. Імена полів у різних договорах різні,
   тому пробуємо по черзі — але НЕ вигадуємо: немає жодного, значить нуль. */
function npPayout(x) {
  const сума = parseFloat(String(
    x.AmountPaid ?? x.RedeliveryPaymentCardMoneyPayout ??
    x.RedeliverySum ?? x.BackwardDeliverySum ?? 0).replace(',', '.')) || 0;
  const переказ = String(x.MoneyTransferNumber || x.RedeliveryNum ||
                         x.RedeliveryPayment || '').trim();
  const коли = String(x.PaymentStatusDate || x.RecipientDateTime ||
                      x.ActualDeliveryDate || '').trim();
  const стан = String(x.PaymentStatus || '').trim();
  return { сума, переказ, коли, стан };
}
function npIso(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(s || '').trim());
  if (m) return kyivIso(+m[3], +m[2], +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}
/* Скільки накладеного платежу на накладній (зібрати з отримувача) — щоб
   відрізнити накладні з наложкою від звичайних і підказати, що перевірити. */
function npCod(x) {
  const v = [x.RedeliverySum, x.AfterpaymentOnGoodsCost, x.BackwardDeliverySum]
    .map(a => parseFloat(String(a ?? '').replace(',', '.')) || 0);
  return Math.max(0, ...v);
}
/* Посилка з контролем оплати, яку отримувач уже забрав, — скільки він
   заплатив. Коди НП: 9 «отримано», 10 і 11 — «отримано, переказ готується /
   виданий», 106 — «отримано, створено зворотну доставку». Відмова,
   повернення й не забрані — нуль. */
function npControl(x) {
  const сума = parseFloat(String(x.AfterpaymentOnGoodsCost ?? '').replace(',', '.')) || 0;
  if (сума <= 0) return 0;
  const код = String(x.StatusCode || '');
  const забрали = ['9', '10', '11', '106'].indexOf(код) >= 0 ||
    (!код && /^Відправлення отримано/i.test(String(x.Status || '')));
  return забрали ? сума : 0;
}
async function npPoll(env, accId) {
  if (!env.NP_API_KEY) return { skip: 'немає секрета NP_API_KEY' };
  const пакет = [];
  /* Місяць назад: накладений платіж їде до нас тижнями, і вікно в кілька днів
     просто не побачило б половини виплат. */
  const до = new Date(), від = new Date(Date.now() - 31 * 864e5);
  /* СТОРІНКАМИ. НП віддає список по 100; доти брали лише першу сторінку —
     і «накладних: 100» означало «перші сто», а решта місяця не перевірялась. */
  const ttns = [], бачили = {};
  for (let page = 1; page <= 30; page++) {
    const docs = await np(env, 'InternetDocument', 'getDocumentList', {
      DateTimeFrom: npDate(від), DateTimeTo: npDate(до), GetFullList: '1',
      Page: String(page), Limit: '100'
    });
    let нових = 0;
    for (const d of docs) {
      const t = String(d.IntDocNumber || d.Number || '');
      if (t && !бачили[t]) { бачили[t] = 1; ttns.push(t); нових++; }
    }
    if (docs.length < 100 || !нових) break;
  }
  let n = 0, виплачено = 0, зНаложкою = 0, ко = 0, коСума = 0;
  const перевірити = [], оплачені = [], стани = {};
  const посилки = {};   // loomiq/npState: стан кожної посилки з контролем оплати
  for (let i = 0; i < ttns.length; i += 100) {
    const part = ttns.slice(i, i + 100).map(t => ({ DocumentNumber: t, Phone: '' }));
    const st = await np(env, 'TrackingDocument', 'getStatusDocuments', { Documents: part });
    for (const x of st) {
      /* КОНТРОЛЬ ОПЛАТИ (03.10). Гроші за такі посилки NovaPay переказує
         пулом — один платіж на 20–30 посилок, і розібрати його не можна, а
         поля виплати (…GM) у трекінгу лишаються порожніми й через тиждень.
         Тому домовились з Андрієм: посилку з контролем оплати ОТРИМАЛИ —
         значить, її сума надійшла на рахунок NovaPay. Пишемо повну суму
         клієнта (комісію поки не віднімаємо), один рух на ТТН. */
      const ко_сума = npControl(x);
      /* СТАН ПОСИЛКИ ДЛЯ ЗВІРКИ (04.10). Забрали — гроші мають бути за 2
         дні; відмова чи повернення — грошей не буде, треба стежити за
         товаром. Без цього адмінка знала б про посилку лише те, що їй
         вручну сказали кнопкою «Оновити статус». */
      const ко_план = parseFloat(String(x.AfterpaymentOnGoodsCost ?? '').replace(',', '.')) || 0;
      if (ко_план > 0 && x.Number) {
        const коли = String(x.RecipientDateTime || x.ActualDeliveryDate || '').trim();
        посилки['t' + String(x.Number).replace(/\D/g, '')] = {
          code: String(x.StatusCode || ''), status: String(x.Status || '').slice(0, 120),
          at: коли ? npIso(коли) : '', cod: ко_план, seen: new Date().toISOString() };
      }
      if (ко_сума > 0) {
        await payment(env, {
          id: 'npc_' + String(x.Number || ''),
          at: npIso(x.RecipientDateTime || x.ActualDeliveryDate || ''),
          amount: ко_сума,
          acc: accId || '',
          counter: 'NovaPay · ' + String(x.RecipientFullName || x.RecipientFullNameEW || '').replace(/\s+/g, ' ').trim(),
          desc: 'Контроль оплати · ТТН ' + String(x.Number || ''),
          src: 'np',
          ttn: String(x.Number || '')
        }, пакет);
        ко++; коСума += ко_сума;
      }
      const p = npPayout(x);
      if (npCod(x) > 0) {
        зНаложкою++;
        const k = p.стан || String(x.Status || '') || '—';
        стани[k] = (стани[k] || 0) + 1;
      }
      /* І сума, І номер переказу. Одне без іншого означає «гроші зібрані, але
         ще не в нас» — а такий рядок у підсумку був би обіцянкою, не грошима. */
      if (!p.сума || !p.переказ) {
        /* НП сама каже «виплачено» (PaymentStatus, напр. PAYED), а суми з
           переказом ми не знайшли — значить, у цьому договорі поля звуться
           інакше. Саме такі ТТН і треба показати через /np/probe (03.10). */
        if (npCod(x) > 0 && /payed|paid|виплач|оплач/i.test(p.стан) && оплачені.length < 5)
          оплачені.push(String(x.Number || ''));
        /* Наложка, яку отримувач уже забрав, а виплати ми не бачимо, —
           саме її варто показати через /np/probe: там видно справжні поля. */
        if (npCod(x) > 0 && /отрим|вручен|received/i.test(String(x.Status || '')) && перевірити.length < 5)
          перевірити.push(String(x.Number || ''));
        continue;
      }
      await payment(env, {
        id: 'np_' + p.переказ + '_' + String(x.Number || ''),
        at: npIso(p.коли),
        amount: p.сума,
        acc: accId || '',
        counter: 'Нова пошта · ' + String(x.RecipientFullName || x.RecipientFullNameEW || ''),
        desc: 'Накладений платіж ' + String(x.Number || '') +
              ' · переказ ' + p.переказ + (p.стан ? ' · ' + p.стан : ''),
        src: 'np'
      }, пакет);
      виплачено += p.сума; n++;
    }
  }
  if (Object.keys(посилки).length) пакет.push({ path: 'loomiq/npState', obj: посилки });
  await fsCommit(env, пакет);
  return { накладних: ttns.length, з_наложкою: зНаложкою,
           контроль_оплати: { отримано: ко, сума: Math.round(коСума) },
           виплат: n,
           сума: Math.round(виплачено), стани_наложки: стани,
           виплачено_але_не_розпізнано: оплачені,
           перевірити_через_probe: перевірити };
}

/* ══════════════════════════════════════════════════════════════════════════
   ОПИТУВАННЯ

   Один прохід по всіх рахунках. Помилка одного банку НЕ зупиняє інших:
   Приват уміє відповідати технічною помилкою пів години, і зупиняти через
   це Нову пошту означало б втратити виплати за цей час.
   ══════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════
   NOVAPAY — БІЗНЕС-РАХУНОК (05.10)

   API: SOAP, https://business.novapay.ua/Services/ClientAPIService.svc.
   Вхід — UserAuthenticationJWT: login + refresh_token + public_certificate
   (бізнес-кабінет NovaPay → Система → Налаштування → API). Кожен вхід
   ВИДАЄ НОВИЙ refresh_token і сертифікат, а старі гасить. Тому:
     • новий ключ зберігаємо в базі (secrets/novapay) ОДРАЗУ, до будь-якого
       іншого кроку; документ закритий правилами — адмінка його не читає;
     • jwt живе до своєї expiration — поки він живий, повторно не входимо
       (менше обертів ключа — менше шансів його загубити);
     • секрет у Cloudflare (NOVAPAY_REFRESH_TOKEN) — лише перша ланка.
       Згенерували в кабінеті новий і поклали в секрет — воркер помітить, що
       секрет змінився, і почне з нього.
   Секрети: NOVAPAY_LOGIN, NOVAPAY_REFRESH_TOKEN, NOVAPAY_CERT.

   Перша частина — вхід, рахунки, залишок і /novapay/probe (показати сирий
   відгук). Рухи у Фінанси — коли побачимо справжній формат виписки. */
const NOVAPAY_URL = 'https://business.novapay.ua/Services/ClientAPIService.svc';
function xmlEsc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function xmlUnesc(v) {
  return String(v || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
/* Перший вміст тега (з будь-яким префіксом простору імен) — сирим текстом. */
function xmlTag(xml, name) {
  const m = new RegExp('<(?:[\\w-]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?' + name + '>').exec(String(xml || ''));
  return m ? m[1] : null;
}
function xmlTags(xml, name) {
  const re = new RegExp('<(?:[\\w-]+:)?' + name + '(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?' + name + '>)', 'g');
  const out = []; let m;
  while ((m = re.exec(String(xml || '')))) out.push({ attrs: xmlAttrs(m[1] || ''), body: m[2] || '' });
  return out;
}
function xmlAttrs(s) {
  const o = {}; const re = /([\w:-]+)="([^"]*)"/g; let m;
  while ((m = re.exec(s))) if (!/^xmlns/.test(m[1])) o[m[1]] = xmlUnesc(m[2]);
  return o;
}
/* Плоский запис: атрибути + прості дочірні теги. */
function xmlFlat(node) {
  const o = Object.assign({}, node.attrs || {});
  const re = /<([\w-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g; let m;
  while ((m = re.exec(node.body || ''))) o[m[1]] = xmlUnesc(m[2]);
  return o;
}
function novapayEnvelope(method, params) {
  const body = Object.keys(params).filter(k => params[k] != null && params[k] !== '')
    .map(k => '<tem:' + k + '>' + xmlEsc(params[k]) + '</tem:' + k + '>').join('');
  return '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">' +
    '<soapenv:Header/><soapenv:Body><tem:' + method + '><tem:request>' + body +
    '</tem:request></tem:' + method + '></soapenv:Body></soapenv:Envelope>';
}
function novapayRef() { return 'LQ-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
/* Кроки останнього звернення — щоб бачити, ЯКИЙ запит упав і що відповів
   NovaPay (без ключів). Пишемо в loomiq/novapayLog. */
let NOVAPAY_TRACE = [];
/* Один виклик: повертає вміст <Method>Result> і помилку, якщо NovaPay її назвав. */
async function novapaySoap(method, params) {
  const r = await fetch(NOVAPAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'http://tempuri.org/IClientAPIService/' + method },
    body: novapayEnvelope(method, Object.assign({ request_ref: novapayRef() }, params))
  });
  const text = await r.text();
  const res = xmlTag(text, method + 'Result');
  if (res == null) throw new Error('NovaPay ' + method + ': ' + r.status + ' ' + text.replace(/\s+/g, ' ').slice(0, 300));
  const err = xmlTag(res, 'error');
  const msg = err ? (xmlUnesc(xmlTag(err, 'message') || xmlTag(err, 'Message') || err).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'помилка') : '';
  NOVAPAY_TRACE.push({ at: new Date().toISOString(), крок: method, ok: !msg, відповідь: msg ||
    (method === 'UserAuthenticationJWT' ? 'вхід успішний, новий ключ видано' : 'ok') });
  return { res, error: msg, result: xmlUnesc(xmlTag(res, 'result') || '') };
}
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s || '')));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}
/* Строк jwt від NovaPay: «05.10.2026 21:59[:00]» за Києвом (Date.parse
   читає це як місяць.день — і jwt виходив «протермінованим» одразу), або
   ISO. Лише дата без часу чи вже минулий строк — вважаємо 20 хв. */
function novapayUntil(exp, now) {
  const s = String(exp || '').trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  let t = m ? Date.parse(kyivIso(+m[3], +m[2], +m[1], +m[4], +m[5], +(m[6] || 0)))
    : /^\d{4}-\d{2}-\d{2}T/.test(s) ? Date.parse(s) : NaN;
  if (isNaN(t) || t - 60000 <= now) t = now + 20 * 60000;
  return t;
}
let NOVAPAY_JWT = null;   // { jwt, until } — у памʼяті живого воркера
/* ОДИН ВХІД ОДНОЧАСНО (07.10). Ключ NovaPay одноразовий. Два прогони, що
   входять тим самим ключем одночасно (розклад + ручний /novapay/poll),
   можуть лишити в базі не той ключ, який NovaPay вважає живим, — і далі
   «Refresh token does not apply to login», доки не згенерують новий. Тому
   перед входом займаємо замок: пишемо lockAt лише за умови, що документ
   ніхто не змінив з моменту читання (precondition updateTime). Не вийшло
   або замок свіжий (< 60 с) — хтось уже входить: чекаємо й беремо його jwt. */
async function novapayLock(env) {
  const r = await fetch(docPath(env, 'secrets/novapay'),
    { headers: { Authorization: 'Bearer ' + await accessToken(env) } });
  const d = r.status === 404 ? null : await r.json().catch(() => null);
  const lockAt = d && d.fields && d.fields.lockAt && d.fields.lockAt.stringValue;
  if (lockAt && Date.now() - Date.parse(lockAt) < 60000) return false;
  const pre = d && d.updateTime ? '&currentDocument.updateTime=' + encodeURIComponent(d.updateTime)
    : '&currentDocument.exists=' + (d && d.fields ? 'true' : 'false');
  const w = await fetch(docPath(env, 'secrets/novapay') + '?updateMask.fieldPaths=lockAt' + pre, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { lockAt: { stringValue: new Date().toISOString() } } })
  });
  return w.ok;
}
async function novapayJwt(env, force) {
  if (!env.NOVAPAY_LOGIN || !env.NOVAPAY_REFRESH_TOKEN || !env.NOVAPAY_CERT)
    throw new Error('Немає секретів NOVAPAY_LOGIN / NOVAPAY_REFRESH_TOKEN / NOVAPAY_CERT');
  const now = Date.now();
  /* Щойно увійшли (до 5 хв) — той самий jwt, навіть якщо строк прочитали
     криво: кожен зайвий вхід крутить ключ, а NovaPay другого не пускає. */
  if (!force && NOVAPAY_JWT && (NOVAPAY_JWT.until - 60000 > now || now - (NOVAPAY_JWT.at || 0) < 5 * 60000))
    return NOVAPAY_JWT.jwt;
  let saved = await fsGet(env, 'secrets/novapay').catch(() => null);
  const seed = await sha(env.NOVAPAY_REFRESH_TOKEN);
  let savedOk = saved && saved.seed === seed;
  if (!force && savedOk && saved.jwt && Date.parse(saved.until || '') - 60000 > now) {
    NOVAPAY_JWT = { jwt: saved.jwt, until: Date.parse(saved.until) };
    return saved.jwt;
  }
  if (!(await novapayLock(env).catch(() => true))) {
    /* Інший прогін саме входить — чекаємо на його jwt, а не крутимо ключ удруге. */
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const s2 = await fsGet(env, 'secrets/novapay').catch(() => null);
      if (s2 && s2.seed === seed && s2.jwt && Date.parse(s2.until || '') - 60000 > Date.now()) {
        NOVAPAY_JWT = { jwt: s2.jwt, until: Date.parse(s2.until), at: Date.now() };
        return s2.jwt;
      }
    }
    throw new Error('NovaPay: інший прогін саме входить — спробуйте за хвилину');
  }
  /* Замок наш — перечитуємо: поки чекали, інший прогін міг уже ввійти й
     покласти новий ключ, а старий, прочитаний вище, вже мертвий. */
  const fresh = await fsGet(env, 'secrets/novapay').catch(() => null);
  if (fresh && fresh.seed === seed) {
    if (!force && fresh.jwt && Date.parse(fresh.until || '') - 60000 > Date.now()) {
      await fsWrite(env, 'secrets/novapay', { lockAt: '' }).catch(() => null);
      NOVAPAY_JWT = { jwt: fresh.jwt, until: Date.parse(fresh.until), at: Date.now() };
      return fresh.jwt;
    }
    saved = fresh; savedOk = true;
  }
  const token = savedOk && saved.refresh_token ? saved.refresh_token : env.NOVAPAY_REFRESH_TOKEN;
  NOVAPAY_TRACE.push({ at: new Date().toISOString(), крок: 'ключ', відповідь: savedOk && saved.refresh_token
    ? 'беру збережений (від ' + (saved.at || '?') + ')' : 'беру з секрету NOVAPAY_REFRESH_TOKEN' });
  const cert = savedOk && saved.public_certificate ? saved.public_certificate : env.NOVAPAY_CERT;
  const a = await novapaySoap('UserAuthenticationJWT', { refresh_token: token, login: env.NOVAPAY_LOGIN, public_certificate: cert });
  if (a.error) {
    await fsWrite(env, 'secrets/novapay', { lockAt: '' }).catch(() => null);
    /* Що саме пішло в NovaPay — без самих значень ключа: логін, довжина
       токена, чи схожий сертифікат на цілий (BEGIN…END). Щоб розібратись,
       чого не так, без пересилання секретів. */
    const t = String(token || ''), c = String(cert || '');
    const діаг = 'логін «' + env.NOVAPAY_LOGIN + '» (' + String(env.NOVAPAY_LOGIN).length + ' симв.)' +
      ', токен ' + t.length + ' симв.' + (/^\*+$/.test(t) ? ' — ЦЕ ЗІРОЧКИ, а не токен' : '') +
      (/\s/.test(t) ? ' — у токені є пробіл чи перенос' : '') +
      ', сертифікат ' + c.length + ' симв.' + (/BEGIN/.test(c) && /END/.test(c) ? '' : ' — НЕМАЄ рядків BEGIN/END') +
      (savedOk ? ', ключ зі збереженого' : ', ключ із секрету');
    /* Збережений ключ NovaPay більше не приймає (07.10: «Refresh token does
       not apply to login» — ключ перегенерували в кабінеті чи погасили) —
       вихід той самий, що й з протермінованим: новий ключ у Cloudflare. */
    throw new Error('NovaPay вхід: ' + a.error + ' · ' + діаг +
      ' · ' + (savedOk ? 'збережений ключ NovaPay більше не приймає — ' : 'якщо ключ протермінований — ') +
      'згенеруйте новий у кабінеті й покладіть у NOVAPAY_REFRESH_TOKEN і NOVAPAY_CERT');
  }
  const jwt = xmlUnesc(xmlTag(a.res, 'jwt') || '');
  const next = xmlUnesc(xmlTag(a.res, 'refresh_token') || '');
  const nextCert = xmlUnesc(xmlTag(a.res, 'public_certificate') || '');
  const exp = xmlUnesc(xmlTag(a.res, 'expiration') || '');
  if (!jwt || !next) throw new Error('NovaPay вхід: у відповіді немає jwt чи нового ключа');
  const until = novapayUntil(exp, now);
  /* Новий ключ — у базу першим ділом: старий уже не діє. */
  await fsWrite(env, 'secrets/novapay', { seed, refresh_token: next, public_certificate: nextCert || cert,
    jwt, until: new Date(until).toISOString(), at: new Date().toISOString(), lockAt: '' });
  NOVAPAY_JWT = { jwt, until, at: now };
  return jwt;
}
async function novapayCall(env, method, params) {
  let jwt = await novapayJwt(env);
  let r = await novapaySoap(method, Object.assign({ jwt }, params || {}));
  /* jwt раптом прострочений — один повторний вхід. */
  /* Лише коли NovaPay прямо каже, що протух jwt: зайвий вхід крутить ключ. */
  if (r.error && /jwt/i.test(r.error) && /expir|invalid|протерм|недійс/i.test(r.error)) {
    jwt = await novapayJwt(env, true);
    r = await novapaySoap(method, Object.assign({ jwt }, params || {}));
  }
  if (r.error) throw new Error('NovaPay ' + method + ': ' + r.error);
  return r.res;
}
async function novapayAccounts(env) {
  const cl = await novapayCall(env, 'GetClientsList', {});
  const clients = xmlTags(xmlTag(cl, 'clients') || cl, 'Clients').map(xmlFlat);
  const out = [];
  for (const c of clients) {
    const al = await novapayCall(env, 'GetAccountsList', { client_id: c.id });
    xmlTags(xmlTag(al, 'accounts') || al, 'Accounts').map(xmlFlat)
      .forEach(a => out.push(Object.assign({ client: c.name || '', client_id: c.id }, a)));
  }
  return out;
}
/* Залишки рахунків NovaPay → loomiq/bankBal для рахунку Фінансів з тим
   самим IBAN (банк «NovaPay» або «Нова пошта»). */
async function novapayPoll(env) {
  if (!env.NOVAPAY_LOGIN) return { skip: 'немає секретів NOVAPAY_*' };
  const fin = await accounts(env);
  const list = await novapayAccounts(env);
  /* ДОГНАТИ ПРОПУЩЕНЕ (07.10). Ключ кілька днів не пускали — виписка за
     3 дні загубила б рухи між. Тож беремо від останнього вдалого прогону
     (з запасом у добу), але не далі 14 днів. Повтори не страшні: id руху
     стійкий, двічі він не запишеться. */
  const було = await fsGet(env, 'loomiq/novapayOk').catch(() => null);
  const з = Date.parse((було && було.at) || '');
  const від = new Date(Math.max(Date.now() - 14 * 864e5,
    Math.min(Date.now() - 3 * 864e5, isNaN(з) ? Infinity : з - 864e5)));
  const out = [];
  for (const a of list) {
    const iban = String(a.IBAN || a.iban || '').replace(/\s+/g, '');
    const наш = fin.filter(f => f.iban && f.iban === iban)[0];
    const rest = await novapayCall(env, 'GetAccountRest', { account_id: a.id });
    const bal = parseFloat(String(xmlUnesc(xmlTag(rest, 'available_balance') || xmlTag(rest, 'confirmed_balance') || '')).replace(',', '.'));
    if (наш && isFinite(bal)) await bankBalance(env, наш.id, bal, new Date().toISOString(), 'novapay');
    /* Рухи — лише в рахунок Фінансів з тим самим IBAN: без нього нема куди. */
    let рухів = 0;
    if (наш) {
      const до = new Date();
      const ex = await novapayCall(env, 'GetAccountExtract', { account_id: a.id, date_from: npDate(від), date_to: npDate(до) });
      const пакет = [];
      for (const d of xmlTags(xmlUnesc(xmlTag(ex, 'extract') || ''), 'Docs').map(xmlFlat)) {
        const r = novapayRow(d, iban, наш.id);
        if (r && await payment(env, r, пакет)) рухів++;
      }
      await fsCommit(env, пакет);
    }
    out.push({ рахунок: a.name || a.client, iban: iban.slice(0, 6) + '…' + iban.slice(-4), фінанси: наш ? наш.id : 'не знайдено за IBAN',
               залишок: isFinite(bal) ? bal : null, рухів });
  }
  await fsWrite(env, 'loomiq/novapayOk', { at: new Date().toISOString() }).catch(() => null);
  return out;
}
/* Рух виписки NovaPay → платіж Фінансів. Напрям — за нашим IBAN: ми в
   Credit — прийшло, у Debit — пішло. Часу виписка не дає, лише дату, тож
   ставимо полудень за Києвом (стійко: повтор не зсуне рух).
   ПУЛ НАЛОЖОК (05.10): «НоваПей» (ЄДРПОУ 38324133) переказує гроші «згідно
   реєстру №…» — це сума посилок з контролем оплати, які вже записані
   поштучно (npc_<ТТН>) і привʼязані до замовлень. Доходом удруге не є.
   СОБІ (05.10): той самий ІПН з обох боків — «перерахування чистого
   підприємницького доходу» на свій особистий рахунок: між своїми. */
function novapayRow(d, iban, accId) {
  const сума = Math.abs(parseFloat(String(d.Amount || '').replace(',', '.'))) || 0;
  const id = String(d.ID || '').trim();
  if (!сума || !id) return null;
  const я = String(iban || '').replace(/\s+/g, '');
  const cr = String(d.CreditCodeIBAN || '').replace(/\s+/g, ''), db = String(d.DebitCodeIBAN || '').replace(/\s+/g, '');
  const прийшло = cr === я;
  if (!прийшло && db !== я) return null;
  const інший = прийшло ? 'Debit' : 'Credit';
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(d.OrgDate || d.DayDate || ''));
  if (!m) return null;
  const purpose = String(d.Purpose || '').replace(/\s+/g, ' ').trim();
  const хто = String(d[інший + 'Name'] || '').trim();
  const пул = прийшло && (String(d.DebitStateCode || '') === '38324133' || /нова\s*пей|новапей|novapay/i.test(хто)) &&
    /реєстр/i.test(purpose);
  const собі = !пул && d.DebitStateCode && String(d.DebitStateCode) === String(d.CreditStateCode || '');
  return {
    id: 'novapay_' + id,
    at: kyivIso(+m[3], +m[2], +m[1], 12, 0, 0),
    amount: прийшло ? сума : -сума,
    acc: accId,
    counter: пул ? 'NovaPay · пул наложок' : хто,
    desc: purpose,
    src: 'novapay',
    flow: пул ? 'pool' : собі ? 'self' : undefined
  };
}
/* Сирий погляд: рахунки, залишок і виписка за 3 дні — щоб побачити поля. */
async function novapayProbe(env) {
  const list = await novapayAccounts(env);
  const до = new Date(), від = new Date(Date.now() - 3 * 864e5);
  const out = { рахунки: list.map(a => ({ id: a.id, name: a.name, client: a.client, iban: a.IBAN, currency: a.currency, status: a.statuscode })) };
  const a = list[0];
  if (a) {
    out.залишок_сире = xmlUnesc(await novapayCall(env, 'GetAccountRest', { account_id: a.id })).replace(/\s+/g, ' ').slice(0, 600);
    const ex = await novapayCall(env, 'GetAccountExtract', { account_id: a.id, date_from: npDate(від), date_to: npDate(до) });
    const xml = xmlUnesc(xmlTag(ex, 'extract') || '');
    out.виписка_заголовок = xmlTags(xml, 'ExtractHead').map(xmlFlat).slice(0, 2);
    out.виписка_рухи = xmlTags(xml, 'Docs').map(xmlFlat).slice(0, 8);
    out.виписка_сире = xml.replace(/\s+/g, ' ').slice(0, 2500);
  }
  return out;
}
/* ВИПРАВИТИ ЧАС СТАРИХ РУХІВ (05.10). Рухи Привату й НП, записані до
   kyivIso, лежать на 2–3 години пізніше. Адмінка їх не виправить (правила
   бази не дають чіпати час банківського руху) — виправляємо тут, службовим
   акаунтом, один раз: позначка tz:1 є — не чіпаємо, немає — зсуваємо.
   Позначка самої правки — loomiq/moneyMeta.tzFixed. */
async function fixTz(env, force) {
  if (!force) {
    const meta = await fsGet(env, 'loomiq/moneyMeta').catch(() => null);
    if (meta && meta.tzFixed) return { skip: 'уже виправлено ' + meta.tzFixed };
  }
  const r = await fetch(FS + '/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents:runQuery', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'payments' }],
      where: { fieldFilter: { field: { fieldPath: 'src' }, op: 'IN',
        value: { arrayValue: { values: [{ stringValue: 'privat' }, { stringValue: 'np' }] } } } },
      select: { fields: [{ fieldPath: 'at' }, { fieldPath: 'tz' }] } } })
  });
  if (!r.ok) throw new Error('Firestore runQuery ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  const list = [];
  for (const x of rows || []) {
    const d = x && x.document;
    if (!d || !d.fields) continue;
    if (d.fields.tz) continue;
    const at = (d.fields.at || {}).stringValue || '';
    const t = new Date(at);
    if (isNaN(t)) continue;
    list.push({ path: d.name.split('/documents/')[1], obj: { tz: 1, at: kyivIso(t.getUTCFullYear(), t.getUTCMonth() + 1,
      t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds()) } });
  }
  await fsCommit(env, list);
  await fsWrite(env, 'loomiq/moneyMeta', { tzFixed: new Date().toISOString(), tzFixedN: list.length });
  return { виправлено: list.length };
}
/* За розкладом Нову пошту питаємо раз на пів години, а не кожні 5 хв:
   наложка приходить днями, а частіші запити впираються в ліміт НП. */
function npDue(t) {
  return new Date(t || Date.now()).getUTCMinutes() % 30 < 5;
}
async function poll(env, opts) {
  opts = opts || {};
  const out = { at: new Date().toISOString(), privat: [], np: null };
  let accs = [];
  try { accs = await accounts(env); }
  catch (e) { out.error = 'Не прочитав рахунки: ' + e.message; return out; }
  for (const a of accs.filter(x => x.bank === 'privat')) {
    try { out.privat.push(await privatPoll(env, a)); }
    catch (e) { out.privat.push({ acc: a.id, error: e.message }); }
  }
  /* Накладений платіж лягає на той рахунок, який ми позначили як приймач
     виплат НП; немає такого — лишаємо порожнім, і в адмінці рух видно з
     підписом «рахунок не вказано». Вигадувати рахунок не можна: гроші
     лягли б у чужий підсумок. */
  const npAcc = (accs.filter(x => x.bank === 'np')[0] || {}).id || env.NP_ACCOUNT || '';
  /* Картки Приват24 фізосіб — разом із НП, раз на 30 хв: Приват24 обмежує
     частоту запитів виписки. */
  const p24 = accs.filter(x => x.bank === 'privat24');
  if (p24.length) {
    out.privat24 = [];
    if (opts.np === false) out.privat24.push({ skip: 'за розкладом — раз на 30 хв' });
    else for (const a of p24) {
      try { out.privat24.push(await p24Poll(env, a)); }
      catch (e) { out.privat24.push({ acc: a.id, error: e.message }); }
    }
  }
  if (opts.np === false) out.np = { skip: 'за розкладом — раз на 30 хв' };
  else {
    try { out.np = await npPoll(env, npAcc); }
    catch (e) { out.np = { error: e.message }; }
  }
  return out;
}

/* Чисті перетворення — назовні, щоб їх можна було перевірити без банку.
   Саме тут і живуть помилки, яких не видно: дата, розібрана не тим форматом,
   і сума, у якої загубився знак, виглядають правильними доти, доки хтось не
   зведе підсумок. Cloudflare зайвий експорт ігнорує. */
export const _pure = { md5hex, p24Row, novapayEnvelope, novapayUntil, novapayRow, xmlTag, xmlTags, xmlFlat, xmlUnesc, kyivIso, privatIso, privatDate, npIso, npDate, npPayout, npCod, npDue, npControl, fval, fplain, monoPick,
                       privatBalPick, kop };

/* ══════════════════════════════════════════════════════════════════════════ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const секрет = url.searchParams.get('s') || '';

    /* Адреса вебхука — не таємниця сама по собі, тому в ній стоїть секрет.
       Без нього будь-хто, хто її вгадає, дописував би нам рухи в підсумок. */
    const пускати = () => env.HOOK_SECRET && секрет === env.HOOK_SECRET;

    try {
      if (!env.FIREBASE_SA || !env.FIREBASE_PROJECT)
        return json({ ok: false, error: 'Не задані FIREBASE_SA / FIREBASE_PROJECT' }, 500);

      /* Монобанк перевіряє адресу вебхука порожнім GET: маємо відповісти 200,
         інакше він її навіть не збереже. */
      if (parts[0] === 'mono' && parts[1] !== 'setup' && request.method === 'GET')
        return new Response('ok');

      if (parts[0] === 'mono' && parts[1] === 'setup') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        const acc = parts[2] || '';
        const hook = url.origin + '/mono/' + acc + '?s=' + env.HOOK_SECRET;
        const r = await monoSetup(env, acc, hook);
        return json({ ok: true, acc, monobank: r, рахунок: 'знайдено за IBAN — пишемо лише його рухи' });
      }
      if (parts[0] === 'mono' && request.method === 'POST') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        const acc = parts[1] || '';
        const body = await request.json().catch(() => null);
        /* Відповідаємо одразу, а пишемо у фоні: Монобанк чекає на 200 кілька
           секунд і на повільну відповідь шле те саме ще раз. */
        return json({ ok: true, written: await monoHook(env, acc, body) });
      }
      if (parts[0] === 'novapay' && (parts[1] === 'probe' || parts[1] === 'poll' || parts[1] === 'log')) {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        if (parts[1] === 'log') {
          const l = await fsGet(env, 'loomiq/novapayLog').catch(() => null);
          return json({ ok: true, останній_прогін: l ? JSON.parse(l.json || '{}') : null });
        }
        NOVAPAY_TRACE = [];
        let out;
        try { out = { ok: true, ...(parts[1] === 'probe' ? await novapayProbe(env) : { novapay: await novapayPoll(env) }) }; }
        catch (e) { out = { ok: false, error: String((e && e.message) || e) }; }
        out.кроки = NOVAPAY_TRACE;
        await fsWrite(env, 'loomiq/novapayLog', { json: JSON.stringify({ at: new Date().toISOString(), ok: out.ok,
          error: out.error || '', кроки: NOVAPAY_TRACE }) }).catch(() => null);
        return json(out, out.ok ? 200 : 502);
      }
      if (parts[0] === 'fix-tz') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        return json({ ok: true, ...(await fixTz(env, url.searchParams.get('force') === '1')) });
      }
      if (parts[0] === 'poll') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        return json({ ok: true, ...(await poll(env)) });
      }
      /* Картка Приват24 фізособи: /p24/probe/<код> — сира виписка за 3 дні;
         /p24/poll/<код> — записати рухи й залишок зараз. */
      if (parts[0] === 'p24' && (parts[1] === 'probe' || parts[1] === 'poll')) {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        const a = (await accounts(env)).filter(x => x.id === parts[2])[0];
        if (!a) return json({ ok: false, error: 'У Фінансах немає рахунку ' + (parts[2] || '') }, 404);
        try { return json({ ok: true, ...(await p24Poll(env, a, parts[1] === 'probe')) }); }
        catch (e) { return json({ ok: false, error: String((e && e.message) || e) }); }
      }
      /* Що САМЕ каже Приват про залишок рахунку — сирий відгук і розібране. */
      if (parts[0] === 'privat' && parts[1] === 'balance') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        const a = (await accounts(env)).filter(x => x.id === parts[2])[0];
        if (!a) return json({ ok: false, error: 'У Фінансах немає рахунку ' + (parts[2] || '') }, 404);
        const d = await privatBalance(env, a, true);
        return json({ ok: true, сире: d, розібрано: privatBalPick(d, a.iban) });
      }
      /* Показати, що САМЕ каже Нова пошта про накладну. Потрібно рівно один
         раз — коли підключаємо накладений платіж і хочемо бачити справжні
         імена полів, а не здогадуватись про них. */
      if (parts[0] === 'np' && parts[1] === 'probe') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        const d = await np(env, 'TrackingDocument', 'getStatusDocuments',
          { Documents: [{ DocumentNumber: parts[2] || '', Phone: '' }] });
        return json({ ok: true, сире: d[0] || null, розібрано: npPayout(d[0] || {}) });
      }
      return json({ ok: false, error: 'Невідома адреса' }, 404);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 502);
    }
  },

  /* Розклад. Приват і Нова пошта самі нічого не шлють, тож питаємо їх ми. */
  async scheduled(event, env, ctx) {
    const зНП = npDue(event && event.scheduledTime);
    ctx.waitUntil(poll(env, { np: зНП })
      .then(r => console.log('опитано', JSON.stringify(r)))
      /* Старі рухи з часом «не по Києву» — виправляємо один раз сам, у
         прогоні без Нової пошти (щоб не впертись у ліміт звернень). */
      .then(() => зНП ? null : fixTz(env).then(x => console.log('час', JSON.stringify(x))))
      /* NovaPay — раз на пів години, зі зсувом від Нової пошти (:15 і :45). */
      .then(() => npDue((event && event.scheduledTime || Date.now()) - 15 * 60000)
        ? (NOVAPAY_TRACE = [], novapayPoll(env)
            .then(x => ({ ok: true, x }), e => ({ ok: false, error: String((e && e.message) || e) }))
            .then(r => fsWrite(env, 'loomiq/novapayLog', { json: JSON.stringify({ at: new Date().toISOString(), за_розкладом: true,
              ok: r.ok, error: r.error || '', кроки: NOVAPAY_TRACE }) }).catch(() => null))) : null)
      .catch(e => console.warn('розклад', e && e.message)));
  }
};
