/**
 * Telegram → аналітика.
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
 * Що НЕ зберігаємо: тексти листування. Тільки хто, коли і скільки разів
 * написав — цього достатньо для оцінки реклами, а переписка лишається
 * там, де їй і місце.
 *
 * Налаштування (worker/README.md, розділ «Telegram-вебхук»):
 *   TELEGRAM_BOT_TOKEN — секрет, той самий бот, що і для заявок
 *   TG_WEBHOOK_SECRET  — секрет, будь-який довгий випадковий рядок
 *   FIREBASE_PROJECT   — звичайна змінна, ідентифікатор проєкту
 */

const FIELDS = 'https://firestore.googleapis.com/v1/projects/';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ok');

    // Адресу вебхука видно у логах Cloudflare, тож самої лише секретної
    // адреси мало: Telegram підписує кожен запит цим заголовком.
    if (env.TG_WEBHOOK_SECRET &&
        request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    let update;
    try { update = await request.json(); } catch { return ok(); }

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

    const doc = {
      vid: vid || (prev && prev.vid) || '',
      uid: String(msg.from.id),
      name: name || (prev && prev.name) || '',
      user: String(msg.from.username || (prev && prev.user) || '').slice(0, 40),
      at: (prev && prev.at) || now.toISOString(),
      day: (prev && prev.day) || day,
      lastAt: now.toISOString(),
      msgs: Math.min(9999, ((prev && +prev.msgs) || 0) + 1),
    };

    try {
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(doc) }),
      });
    } catch { /* аналітика не має ламати діалог */ }

    // Перше повідомлення з міткою вітаємо, щоб людина не дивилась у порожній
    // чат після «/start». Без мітки — мовчимо: пише вже знайомий співрозмовник.
    if (m && env.TELEGRAM_BOT_TOKEN) {
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

function kyivDay(d) {
  try { return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' }); }
  catch { return d.toISOString().slice(0, 10); }
}

/* Firestore REST зберігає значення з типом: рядок і число описуються по-різному. */
function toFields(o) {
  const f = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    f[k] = typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) };
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
