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

const FS = 'https://firestore.googleapis.com/v1';
const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';
const PRIVAT_URL = 'https://acp.privatbank.ua/api/statements/transactions';
const PRIVAT_BAL_URL = 'https://acp.privatbank.ua/api/statements/balance';
const MONO_URL = 'https://api.monobank.ua';

/* ── Дрібниці ─────────────────────────────────────────────────────────── */
const json = (body, status) => new Response(JSON.stringify(body, null, 2),
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
async function fsWrite(env, path, obj) {
  const fields = {};
  const mask = [];
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    fields[k] = fval(obj[k]);
    mask.push('updateMask.fieldPaths=' + encodeURIComponent(k));
  }
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
async function payment(env, p) {
  if (!p.id || !p.amount) return false;
  await fsWrite(env, 'payments/' + p.id, {
    at: p.at,                       // ISO, рядком — як його кладе адмінка
    amount: kop(p.amount),          // гривні з копійками; мінус — витрата
    acc: p.acc || '',
    counter: (p.counter || '').slice(0, 120),
    desc: (p.desc || '').slice(0, 300),
    src: p.src || '',               // mono | privat | np — видно, звідки взялось
    /* Залишок після цього руху — коли банк його каже (Монобанк каже). */
    balAfter: p.balAfter == null ? undefined : kop(p.balAfter)
  });
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
      src: 'privat'
    });
    n++;
  }
  /* Залишок — окремим запитом. Не вдався — рухи від цього не гірші. */
  let залишок = null;
  try {
    const b = await privatBalance(env, acc);
    if (b) { await bankBalance(env, acc.id, b.bal, new Date().toISOString(), 'privat'); залишок = b.bal; }
  } catch (e) { залишок = 'не прочитано: ' + e.message; }
  return { acc: acc.id, рухів: n, залишок };
}
/* Приват віддає час як «01.02.2026 13:45:00» або окремими полями. Беремо те,
   що є, і завжди повертаємо ISO: адмінка сортує рядком. */
function privatIso(t) {
  const s = String(t.DATE_TIME_DAT_OD_TIM_P || t.DAT_OD || '').trim();
  const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1],
    +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))).toISOString();
  const d = new Date(s);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
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
async function np(env, model, method, props) {
  const r = await fetch(NP_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.NP_API_KEY, modelName: model,
                           calledMethod: method, methodProperties: props || {} })
  });
  const d = await r.json().catch(() => null);
  if (!d) throw new Error('Нова пошта відповіла не JSON');
  if (!d.success) throw new Error([].concat(d.errors || [], d.warnings || [])
    .filter(Boolean).join('; ') || 'Нова пошта відмовила без пояснення');
  return d.data || [];
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
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1],
    +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))).toISOString();
  const d = new Date(s);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}
async function npPoll(env, accId) {
  if (!env.NP_API_KEY) return { skip: 'немає секрета NP_API_KEY' };
  /* Місяць назад: накладений платіж їде до нас тижнями, і вікно в кілька днів
     просто не побачило б половини виплат. */
  const до = new Date(), від = new Date(Date.now() - 31 * 864e5);
  const docs = await np(env, 'InternetDocument', 'getDocumentList', {
    DateTimeFrom: npDate(від), DateTimeTo: npDate(до), GetFullList: '1'
  });
  const ttns = docs.map(d => String(d.IntDocNumber || d.Number || '')).filter(Boolean);
  let n = 0, виплачено = 0;
  for (let i = 0; i < ttns.length; i += 100) {
    const part = ttns.slice(i, i + 100).map(t => ({ DocumentNumber: t, Phone: '' }));
    const st = await np(env, 'TrackingDocument', 'getStatusDocuments', { Documents: part });
    for (const x of st) {
      const p = npPayout(x);
      /* І сума, І номер переказу. Одне без іншого означає «гроші зібрані, але
         ще не в нас» — а такий рядок у підсумку був би обіцянкою, не грошима. */
      if (!p.сума || !p.переказ) continue;
      await payment(env, {
        id: 'np_' + p.переказ + '_' + String(x.Number || ''),
        at: npIso(p.коли),
        amount: p.сума,
        acc: accId || '',
        counter: 'Нова пошта · ' + String(x.RecipientFullName || x.RecipientFullNameEW || ''),
        desc: 'Накладений платіж ' + String(x.Number || '') +
              ' · переказ ' + p.переказ + (p.стан ? ' · ' + p.стан : ''),
        src: 'np'
      });
      виплачено += p.сума; n++;
    }
  }
  return { накладних: ttns.length, виплат: n, сума: Math.round(виплачено) };
}

/* ══════════════════════════════════════════════════════════════════════════
   ОПИТУВАННЯ

   Один прохід по всіх рахунках. Помилка одного банку НЕ зупиняє інших:
   Приват уміє відповідати технічною помилкою пів години, і зупиняти через
   це Нову пошту означало б втратити виплати за цей час.
   ══════════════════════════════════════════════════════════════════════════ */
async function poll(env) {
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
  try { out.np = await npPoll(env, npAcc); }
  catch (e) { out.np = { error: e.message }; }
  return out;
}

/* Чисті перетворення — назовні, щоб їх можна було перевірити без банку.
   Саме тут і живуть помилки, яких не видно: дата, розібрана не тим форматом,
   і сума, у якої загубився знак, виглядають правильними доти, доки хтось не
   зведе підсумок. Cloudflare зайвий експорт ігнорує. */
export const _pure = { privatIso, privatDate, npIso, npDate, npPayout, fval, fplain, monoPick,
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
      if (parts[0] === 'poll') {
        if (!пускати()) return json({ ok: false, error: 'Немає доступу' }, 403);
        return json({ ok: true, ...(await poll(env)) });
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
    ctx.waitUntil(poll(env).then(r => console.log('опитано', JSON.stringify(r))));
  }
};
