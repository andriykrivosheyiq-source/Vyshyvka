/**
 * Loomiq — Telegram-бот ЦЕХУ (07.10.2026).
 *
 * Володимир: «на станках — автоматично виробнича карта в бота». Окремий бот,
 * не той, що для клієнтів: у ньому лише цех. Хто натиснув /start — отримує
 * виробничі карти; /stop — більше не отримує.
 *
 * Маршрути:
 *   POST /tg            — вебхук Telegram (/start, /stop). Перевіряється
 *                          заголовком X-Telegram-Bot-Api-Secret-Token = HOOK_SECRET.
 *   GET  /setup?s=…     — один раз: сказати Telegram, куди слати (setWebhook).
 *   POST /send          — з адмінки: { idToken, caption, photos:[https://…] }.
 *                          Вхід перевіряється в Firebase — інакше це був би
 *                          відкритий ретранслятор нашим ботом.
 *   GET  /subs?s=…      — хто підписаний (для перевірки); заодно забирає /start.
 *   Без вебхука (Telegram не бачить адресу) — /start забираємо getUpdates:
 *   перед кожним надсиланням, у /subs і за розкладом (Settings → Triggers →
 *   Cron, напр. щохвилини — необовʼязково).
 *
 * Налаштування (Cloudflare → Workers → Create → вставити цей файл):
 *   PROD_BOT_TOKEN  — секрет: токен бота з @BotFather
 *   HOOK_SECRET     — секрет: будь-який довгий пароль (для /setup і вебхука)
 *   FIREBASE_API_KEY — змінна: той самий ключ, що в telegram-webhook
 *   SUBS            — KV-привʼязка (Storage → KV → створити простір → Bindings)
 *   ALLOWED_ORIGINS — необовʼязково: домени адмінки через кому
 */

const DEFAULT_ALLOWED = ['https://loomiq.net', 'https://www.loomiq.net'];

function cors(origin, env) {
  const list = String((env && env.ALLOWED_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  const allow = list.length ? list : DEFAULT_ALLOWED;
  return {
    'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}
function json(obj, status, h) {
  return new Response(JSON.stringify(obj), { status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, h || {}) });
}
async function tg(env, method, payload) {
  const r = await fetch('https://api.telegram.org/bot' + env.PROD_BOT_TOKEN + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return r.json().catch(() => ({ ok: false }));
}
async function subs(env) {
  if (!env.SUBS) return [];
  const out = [];
  let cursor;
  do {
    const l = await env.SUBS.list({ prefix: 'chat:', cursor });
    l.keys.forEach(k => out.push(k.name.slice(5)));
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return out;
}

/* /start і /stop — одне місце, і для вебхука, і для опитування. */
async function onMessage(env, m) {
  if (!m || !m.chat) return;
  const chat = String(m.chat.id), text = String(m.text || '').trim();
  if (/^\/start/.test(text)) {
    if (!env.SUBS) {
      await tg(env, 'sendMessage', { chat_id: chat, text: 'Бот ще не налаштовано (немає KV SUBS). Скажіть адміністратору.' });
    } else {
      await env.SUBS.put('chat:' + chat, JSON.stringify({ name: (m.chat.title || [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ') || ''), at: new Date().toISOString() }));
      await tg(env, 'sendMessage', { chat_id: chat, text: '✅ Підписано. Сюди приходитимуть виробничі карти, щойно замовлення стає «На станках». Відписатись — /stop' });
    }
  } else if (/^\/stop/.test(text)) {
    if (env.SUBS) await env.SUBS.delete('chat:' + chat);
    await tg(env, 'sendMessage', { chat_id: chat, text: 'Відписано. Повернутись — /start' });
  }
}
/* БЕЗ ВЕБХУКА (08.10). Telegram не завжди одразу бачить нову адресу
   *.workers.dev («Failed to resolve host»). Тоді /start забираємо самі —
   getUpdates, з памʼяттю, до якого місця дочитали (KV offset). Кличемо
   перед кожним надсиланням, у /subs і щохвилини за розкладом, якщо він є.
   Коли вебхук стоїть, Telegram getUpdates не дає (409) — і не треба. */
async function pull(env) {
  if (!env.SUBS) return { ok: false, error: 'немає KV SUBS' };
  const offset = +(await env.SUBS.get('offset')) || 0;
  const r = await tg(env, 'getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
  if (!r.ok) return { ok: false, webhook: r.error_code === 409 };
  let last = offset - 1, n = 0;
  for (const up of r.result || []) {
    last = Math.max(last, up.update_id);
    if (up.message) { await onMessage(env, up.message); n++; }
  }
  if (last >= offset) await env.SUBS.put('offset', String(last + 1));
  return { ok: true, нових: n };
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(pull(env).catch(() => null)); },

  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (!env.PROD_BOT_TOKEN) return json({ ok: false, error: 'Немає секрета PROD_BOT_TOKEN' }, 500, h);
    const secretOk = env.HOOK_SECRET && url.searchParams.get('s') === env.HOOK_SECRET;

    // Один раз: сказати Telegram, куди слати /start і /stop
    if (url.pathname === '/setup') {
      if (!secretOk) return json({ ok: false, error: 'Немає доступу' }, 403);
      const r = await tg(env, 'setWebhook', { url: url.origin + '/tg', secret_token: env.HOOK_SECRET,
                                              allowed_updates: ['message'] });
      if (r.ok) return json({ ok: true, telegram: r, kv: !!env.SUBS });
      /* Вебхук не став — працюємо опитуванням: /start заберемо самі. */
      await tg(env, 'deleteWebhook', {});
      const p = await pull(env);
      return json({ ok: !!(p.ok && env.SUBS), режим: 'без вебхука — /start забираємо самі', вебхук: r.description || '',
                    kv: !!env.SUBS, підписано: (await subs(env)).length });
    }
    if (url.pathname === '/subs') {
      if (!secretOk) return json({ ok: false, error: 'Немає доступу' }, 403);
      const p = await pull(env).catch(() => null);
      return json({ ok: true, опитування: p, chats: await subs(env) });
    }

    // Вебхук Telegram: підписка цеху
    if (url.pathname === '/tg' && request.method === 'POST') {
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.HOOK_SECRET)
        return new Response('forbidden', { status: 403 });
      const up = await request.json().catch(() => null);
      await onMessage(env, up && up.message);
      return new Response('ok');
    }

    // З адмінки: виробничі карти всім підписаним
    if (url.pathname === '/send' && request.method === 'POST') {
      if (!env.FIREBASE_API_KEY) return json({ ok: false, error: 'Немає змінної FIREBASE_API_KEY' }, 500, h);
      const body = await request.json().catch(() => null);
      if (!body) return json({ ok: false, error: 'bad-json' }, 400, h);
      const idToken = String(body.idToken || '');
      if (!idToken) return json({ ok: false, error: 'no-auth' }, 401, h);
      const v = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + env.FIREBASE_API_KEY,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      if (!v.ok) return json({ ok: false, error: 'auth-failed' }, 401, h);
      const photos = (Array.isArray(body.photos) ? body.photos : [])
        .map(String).filter(u => /^https:\/\/[a-z0-9.-]+\/\S+$/i.test(u)).slice(0, 10);
      const caption = String(body.caption || '').slice(0, 900);
      if (!photos.length) return json({ ok: false, error: 'no-photos' }, 400, h);
      await pull(env).catch(() => null);
      const chats = await subs(env);
      if (!chats.length) return json({ ok: false, error: 'Ніхто не підписаний — у боті цеху треба натиснути /start' }, 200, h);
      let sent = 0;
      for (const chat of chats) {
        const r = photos.length === 1
          ? await tg(env, 'sendPhoto', { chat_id: chat, photo: photos[0], caption })
          : await tg(env, 'sendMediaGroup', { chat_id: chat,
              media: photos.map((p, i) => ({ type: 'photo', media: p, caption: i === 0 ? caption : undefined })) });
        if (r.ok) sent++;
        // Людина заблокувала бота — прибираємо зі списку, щоб не стукати марно
        else if (r.error_code === 403 && env.SUBS) await env.SUBS.delete('chat:' + chat);
      }
      return json({ ok: sent > 0, sent, of: chats.length }, 200, h);
    }

    return new Response('Loomiq · бот цеху', { headers: h });
  }
};
