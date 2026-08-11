/**
 * Telegram → аналітика і Канбан.
 *
 * Проблема, яку це вирішує. Людина клікає «Написати в Telegram» — і зникає.
 * Далі вона пише боту, менеджер домовляється, замовлення оформлюється руками.
 * У звіті лишається сам клік, але не видно, ЯКА реклама привела того, хто
 * реально написав. Найдорожчі заявки виявляються без джерела.
 *
 * Як замикаємо ланцюжок. Сайт дописує до посилання ?start=v<мітка пристрою>.
 * Telegram передає цей рядок боту першим повідомленням — бот повертає його
 * сюди, і в адмінці діалог зшивається з візитом за тією ж міткою.
 *
 * Переписка. Спочатку воркер тексти НЕ зберігав — рахував лише дотики. Тепер
 * зберігає: звернення з Telegram стають картками Канбану, і картка без самої
 * розмови марна — менеджер однаково йшов читати її в інший застосунок.
 * Кожне повідомлення лягає окремим документом у an_tg/{чат}/msgs. Файли —
 * лише поміткою «фото», «голосове»: посилання Telegram дійсне тільки з
 * токеном бота, а токен не має жити ніде, крім секретів.
 *
 * Відповідь із адмінки — POST /send. Він відкритий в інтернет, тож пускає
 * лише за дійсним входом у Firebase: адмінка додає свій idToken, воркер
 * перевіряє його в Google і аж тоді звертається до Telegram. Без ключа
 * FIREBASE_API_KEY endpoint не працює взагалі — краще мовчазна відмова,
 * ніж відкритий на весь світ ретранслятор нашого бота.
 *
 * Налаштування (worker/README.md, розділ «Telegram-вебхук»):
 *   TELEGRAM_BOT_TOKEN — секрет, той самий бот, що і для заявок
 *   TG_WEBHOOK_SECRET  — секрет, будь-який довгий випадковий рядок
 *   FIREBASE_PROJECT   — звичайна змінна, ідентифікатор проєкту
 *   FIREBASE_API_KEY   — звичайна змінна, вебключ проєкту (він і так у коді
 *                        сторінки). Потрібен лише для перевірки входу в /send.
 */

const FIELDS = 'https://firestore.googleapis.com/v1/projects/';
/* Мітка версії. Міняється разом зі змістом файлу — і /health одразу каже,
   чи в Cloudflare лежить те, що ми зараз обговорюємо, чи копія тижневої
   давнини. Рівно на цьому ми вже двічі втратили по півгодини. */
const BUILD = '2026-08-11 діалог у Канбані';

export default {
  async fetch(request, env, ctx) {
    const reqUrl = new URL(request.url);

    /* Самоперевірка: відкрити в браузері /health і побачити, ЯКА версія коду
       зараз працює і які змінні до неї реально долетіли. Без цього «немає
       змінної» і «стара версія коду» виглядають однаково, а перевірити
       можна лише навпомацки.

       Значень не показуємо — тільки так/ні. Секрет із логів чи чужого
       скріншота не витягнеш. */
    if (reqUrl.pathname === '/health') {
      return jsonRes({
        ok: true,
        build: BUILD,
        vars: {
          TELEGRAM_BOT_TOKEN: !!env.TELEGRAM_BOT_TOKEN,
          TG_WEBHOOK_SECRET: !!env.TG_WEBHOOK_SECRET,
          FIREBASE_PROJECT: env.FIREBASE_PROJECT || '(за замовчуванням loomiq-admin)',
          FIREBASE_API_KEY: !!env.FIREBASE_API_KEY,
          FORWARD_URL: !!env.FORWARD_URL,
        },
        send: env.FIREBASE_API_KEY && env.TELEGRAM_BOT_TOKEN
          ? 'відповідь із адмінки працює'
          : 'відповідь із адмінки НЕ працюватиме: бракує змінної',
      }, 200);
    }

    // Відповідь менеджера з адмінки. Перевіряємо ДО секрету Telegram: цей
    // запит приходить із браузера, підпису Telegram у нього немає й бути не може.
    if (reqUrl.pathname === '/send') return handleSend(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (request.method !== 'POST') return new Response('ok');

    // Адресу вебхука видно у логах Cloudflare, тож самої лише секретної
    // адреси мало: Telegram підписує кожен запит цим заголовком.
    if (env.TG_WEBHOOK_SECRET &&
        request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // Тіло читаємо текстом, бо його ще треба переслати далі байт у байт.
    const raw = await request.text();

    /* Telegram тримає ЛИШЕ ОДИН вебхук на бота. Якщо ботом уже керує ManyChat
       (чи інший конструктор), поставити сюди свою адресу означає його вимкнути:
       перестануть працювати автовідповіді й воронки.

       Тому воркер стає передпокоєм. Він забирає з повідомлення мітку для
       аналітики й одразу пересилає запит далі, у ManyChat — той навіть не
       помічає різниці. Адресу ManyChat кладемо в змінну FORWARD_URL.

       Пересилаємо ДО запису в базу і не чекаємо відповіді: чат живої людини
       не має пригальмовувати через нашу статистику. */
    if (env.FORWARD_URL) {
      const relay = fetch(env.FORWARD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: raw,
      }).then(
        r => { if (!r.ok) console.log('forward: далі не прийняли', r.status); },
        e => console.log('forward: не переслалось', String(e).slice(0, 200))
      );
      if (ctx && ctx.waitUntil) ctx.waitUntil(relay);
    }

    let update;
    try { update = JSON.parse(raw); } catch { return ok(); }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.from || msg.from.is_bot) return ok();

    const chatId = String(msg.chat && msg.chat.id || msg.from.id);
    const text = String(msg.text || '');

    // /start v<мітка> — мітку кладе сайт. Приходить рівно один раз,
    // на першому дотику; далі людина просто пише.
    let vid = '';
    const m = /^\/start\s+v([a-z0-9]{1,32})\b/i.exec(text);
    if (m) vid = m[1].toLowerCase();

    const now = new Date();
    const day = kyivDay(now);
    const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ').slice(0, 60);

    const project = env.FIREBASE_PROJECT || 'loomiq-admin';
    const url = FIELDS + project + '/databases/(default)/documents/an_tg/' + encodeURIComponent(chatId);

    // Читаємо, щоб не загубити мітку й не збити дату першого дотику:
    // друге й наступні повідомлення мітки вже не несуть.
    let prev = null;
    try {
      const r = await fetch(url);
      if (r.ok) prev = parseDoc(await r.json());
    } catch { /* немає — створимо */ }

    /* Що саме прийшло. Файл сам по собі не зберігаємо: пряме посилання
       Telegram дійсне лише разом із токеном бота, а токен живе тільки в
       секретах. Тому в стрічці буде помітка й підпис — менеджер бачить, що
       фото є, і відкриває його в Telegram. */
    const kind = msg.photo ? 'photo'
      : msg.voice ? 'voice'
      : msg.video || msg.video_note ? 'video'
      : msg.document ? 'doc'
      : msg.sticker ? 'sticker'
      : msg.contact ? 'contact'
      : msg.location ? 'location'
      : 'text';
    // «/start v…» — це технічна мітка з посилання, а не слова людини.
    // У стрічці менеджера їй робити нічого.
    const isStart = /^\/start(\s|$)/i.test(text);
    const body = isStart ? '' : (text || String(msg.caption || ''));

    const doc = {
      vid: vid || (prev && prev.vid) || '',
      uid: String(msg.from.id),
      name: name || (prev && prev.name) || '',
      user: String(msg.from.username || (prev && prev.user) || '').slice(0, 40),
      at: (prev && prev.at) || now.toISOString(),
      day: (prev && prev.day) || day,
      lastAt: now.toISOString(),
      last: (body || (isStart ? 'почав діалог' : KIND_UA[kind]) || '').slice(0, 80),
      msgs: Math.min(9999, ((prev && +prev.msgs) || 0) + 1),
      /* Окремо від msgs: скільки людина написала САМА. Натиснути «Запустити»
         і зникнути — теж подія (лід у Канбані буде), але картка має чесно
         казати «ще не писав», а не «1 повідомлення». */
      wrote: Math.min(9999, ((prev && +prev.wrote) || 0) + (isStart ? 0 : 1)),
    };

    /* Запис міг не пройти — найчастіше через неопубліковані правила бази.
       Мовчазна відмова тут коштувала б днів здогадок, тож причину пишемо
       в лог воркера: Cloudflare → цей воркер → Observability → Logs.

       updateMask обовʼязковий. PATCH без нього не «доповнює» документ, а
       замінює його цілком: усе, чого немає в запиті, Firestore ВИДАЛЯЄ.
       Через це кожне нове повідомлення стирало позначку kb, яку ставить
       адмінка, — і картка в Канбані переставала оновлюватись, бо адмінка
       вважала діалог новим. */
    const mask = Object.keys(doc).map(k => 'updateMask.fieldPaths=' + k).join('&');
    try {
      const w = await fetch(url + '?' + mask, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(doc) }),
      });
      if (!w.ok) {
        const errText = await w.text().catch(() => '');
        console.log('an_tg: база відхилила запис', w.status, errText.slice(0, 400));
      } else {
        console.log('an_tg: записано', chatId, doc.vid ? 'мітка ' + doc.vid : 'без мітки');
      }
    } catch (e) {
      console.log('an_tg: не достукались до бази', String(e).slice(0, 200));
    }

    // Саме повідомлення — окремим документом. Окремим, а не полем-масивом:
    // масив довелось би щоразу перечитувати цілком, а два повідомлення
    // підряд затирали б одне одного.
    if (!isStart) {
      await saveMsg(env, chatId, { at: now.toISOString(), text: body, kind, mine: false });
    }

    // Перше повідомлення з міткою вітаємо, щоб людина не дивилась у порожній
    // чат після «/start». Без мітки — мовчимо: пише вже знайомий співрозмовник.
    // Коли ботом керує ManyChat, вітається він — двох привітань не треба.
    if (m && env.TELEGRAM_BOT_TOKEN && !env.FORWARD_URL) {
      try {
        await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Вітаємо! Напишіть, що потрібно нанести і на що — підберемо і порахуємо.',
          }),
        });
      } catch { /* не критично */ }
    }

    return ok();
  },
};

function ok() { return new Response('ok'); }

/* Заголовки для браузера. Ключів тут немає: право написати дає idToken у тілі
   запиту, а не сам факт звернення, тож обмежувати джерело нічого не додає. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const KIND_UA = {
  photo: '📷 фото', voice: '🎤 голосове', video: '🎬 відео',
  doc: '📎 файл', sticker: 'стікер', contact: '📇 контакт', location: '📍 локація',
};

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
  });
}

/* POST /send {chat, text, idToken} — відповідь менеджера з адмінки.
   Порядок навмисний: спершу перевірка входу, потім Telegram, і лише потім
   запис. Якщо Telegram відмовив (людина заблокувала бота), у стрічці не
   зʼявиться повідомлення, якого клієнт не отримував. */
async function handleSend(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return jsonRes({ error: 'method' }, 405);

  if (!env.TELEGRAM_BOT_TOKEN) return jsonRes({ error: 'no-bot-token' }, 500);
  // Без ключа перевірити вхід нічим — відмовляємо. Інакше це був би
  // відкритий ретранслятор: будь-хто писав би нашим ботом кому завгодно.
  if (!env.FIREBASE_API_KEY) return jsonRes({ error: 'not-configured' }, 500);

  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: 'bad-json' }, 400); }

  const chat = String(body.chat || '').trim();
  const text = String(body.text || '').trim().slice(0, 3500);
  const idToken = String(body.idToken || '');
  if (!/^-?\d{3,20}$/.test(chat)) return jsonRes({ error: 'bad-chat' }, 400);
  if (!text) return jsonRes({ error: 'empty' }, 400);
  if (!idToken) return jsonRes({ error: 'no-auth' }, 401);

  let who = '';
  try {
    const v = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + env.FIREBASE_API_KEY,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }) });
    if (!v.ok) return jsonRes({ error: 'auth-failed' }, 401);
    const j = await v.json();
    who = (j.users && j.users[0] && (j.users[0].email || j.users[0].localId)) || '';
    if (!who) return jsonRes({ error: 'auth-failed' }, 401);
  } catch (e) {
    return jsonRes({ error: 'auth-unreachable', detail: String(e).slice(0, 120) }, 502);
  }

  let tg;
  try {
    tg = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch (e) {
    return jsonRes({ error: 'telegram-unreachable', detail: String(e).slice(0, 120) }, 502);
  }
  const tgBody = await tg.json().catch(() => ({}));
  if (!tg.ok || !tgBody.ok) {
    // Текст Telegram лишаємо як є: «bot was blocked by the user» пояснює
    // менеджеру ситуацію, а «помилка надсилання» — ні.
    return jsonRes({ error: 'telegram', detail: String(tgBody.description || tg.status).slice(0, 200) }, 502);
  }

  const at = new Date().toISOString();
  await saveMsg(env, chat, { at, text, kind: 'text', mine: true, by: who.slice(0, 60) });
  await patchDoc(env, 'an_tg/' + encodeURIComponent(chat),
                 { lastAt: at, last: ('Ви: ' + text).slice(0, 80) });
  return jsonRes({ ok: true, at });
}

/* Одне повідомлення = один документ в an_tg/{чат}/msgs. Ідентифікатор —
   час у мілісекундах плюс хвіст: два повідомлення в одну мілісекунду не
   мають затирати одне одного, а сортуємо ми все одно за полем at. */
async function saveMsg(env, chatId, m) {
  const project = env.FIREBASE_PROJECT || 'loomiq-admin';
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const url = FIELDS + project + '/databases/(default)/documents/an_tg/' +
              encodeURIComponent(chatId) + '/msgs?documentId=' + id;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(m) }),
    });
    if (!r.ok) {
      const b = await r.text().catch(() => '');
      console.log('msgs: база відхилила запис', r.status, b.slice(0, 300));
    }
  } catch (e) {
    console.log('msgs: не достукались до бази', String(e).slice(0, 200));
  }
}

// Точкове оновлення полів документа — решта полів лишається як була.
async function patchDoc(env, path, fields) {
  const project = env.FIREBASE_PROJECT || 'loomiq-admin';
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
  try {
    await fetch(FIELDS + project + '/databases/(default)/documents/' + path + '?' + mask, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(fields) }),
    });
  } catch (e) {
    console.log('patch: не достукались до бази', String(e).slice(0, 200));
  }
}

function kyivDay(d) {
  try { return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' }); }
  catch { return d.toISOString().slice(0, 10); }
}

/* Firestore REST зберігає значення з типом: рядок і число описуються по-різному. */
function toFields(o) {
  const f = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    f[k] = typeof v === 'number' ? { integerValue: String(v) }
         : typeof v === 'boolean' ? { booleanValue: v }
         : { stringValue: String(v) };
  }
  return f;
}
function parseDoc(j) {
  const f = (j && j.fields) || {};
  const o = {};
  for (const k of Object.keys(f)) {
    o[k] = f[k].integerValue != null ? +f[k].integerValue : (f[k].stringValue || '');
  }
  return o;
}
