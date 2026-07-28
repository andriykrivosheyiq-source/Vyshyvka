/**
 * Заявки й замовлення з сайту → Telegram.
 *
 * Приймає те, що надсилає сайт:
 *   { phone, page, context, files?: [{url, kind, caption}] }
 *
 * Спершу йде текст замовлення, далі кожен файл окремим вкладенням:
 * логотипи — документом (щоб Telegram не стискав і не псував якість друку),
 * макети — фото (їх зручніше дивитись одразу в стрічці).
 *
 * Це заміна старого lead-воркера: старі заявки без files працюють як раніше.
 *
 * Змінні оточення (Cloudflare → Worker → Settings → Variables):
 *   TELEGRAM_BOT_TOKEN — токен бота від @BotFather
 *   TELEGRAM_CHAT_ID   — куди слати (ваш id або id групи)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    const token = env.TELEGRAM_BOT_TOKEN;
    const chat = env.TELEGRAM_CHAT_ID;
    if (!token || !chat) return json({ error: 'not-configured' }, 500);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }

    const phone = String(body.phone || '').slice(0, 40);
    const page = String(body.page || '').slice(0, 200);
    const context = String(body.context || '').slice(0, 3500);
    const files = Array.isArray(body.files) ? body.files.slice(0, 20) : [];

    const text =
      '🆕 ' + (context || 'Нова заявка з сайту') +
      (phone ? '\n\n📞 ' + phone : '') +
      (page ? '\n🔗 ' + page : '');

    const api = (method, payload) =>
      fetch('https://api.telegram.org/bot' + token + '/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ chat_id: chat }, payload)),
      });

    const sent = await api('sendMessage', { text, disable_web_page_preview: true });
    if (!sent.ok) return json({ error: 'telegram', status: sent.status }, 502);

    // Файли надсилаємо по одному: якщо Telegram не візьме якийсь URL,
    // решта все одно дійде, а саме замовлення вже надіслане текстом.
    const failed = [];
    for (const f of files) {
      if (!f || !f.url) continue;
      const caption = String(f.caption || '').slice(0, 900);
      const asDoc = f.kind !== 'mockup';   // лого — документом, без стиснення
      try {
        const r = asDoc
          ? await api('sendDocument', { document: f.url, caption })
          : await api('sendPhoto', { photo: f.url, caption });
        if (!r.ok) failed.push(f.url);
      } catch {
        failed.push(f.url);
      }
    }
    if (failed.length) {
      await api('sendMessage', {
        text: '⚠️ Не вдалося прикріпити ' + failed.length + ' файл(ів). Посилання є в тексті замовлення вище.',
        disable_web_page_preview: true,
      });
    }

    return json({ ok: true, files: files.length, failed: failed.length });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS),
  });
}
