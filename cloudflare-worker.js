/* =====================================================================
   Cloudflare Worker — приймає заявки з сайту і шле їх менеджерам у Telegram.
   Токен бота тут НЕ пишеться в коді — він задається як секрет у Cloudflare.

   ЯК ВСТАНОВИТИ (одноразово, ~5 хв):
   1. Створи Telegram-бота через @BotFather → отримаєш BOT_TOKEN.
   2. Додай бота у груповий чат менеджерів (або напиши боту особисто).
      Дізнайся CHAT_ID: відкрий
      https://api.telegram.org/bot<BOT_TOKEN>/getUpdates  → поле chat.id
      (для груп id зазвичай від'ємний, напр. -1001234567890).
   3. Зайди на dash.cloudflare.com → Workers & Pages → Create → Worker.
   4. Встав цей код, натисни Deploy.
   5. Settings → Variables → додай два Secret:
        BOT_TOKEN = токен з BotFather
        CHAT_ID   = id чату менеджерів
   6. Скопіюй URL воркера (напр. https://lead.твій-домен.workers.dev)
      і встав його в index.html → LOOMIQ_CONFIG.leadEndpoint.
   ===================================================================== */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

    let data = {};
    try { data = await request.json(); } catch (e) {}

    const phone = String(data.phone || '').slice(0, 40).trim();
    if (!phone) {
      return new Response(JSON.stringify({ ok: false, error: 'no phone' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const lines = [
      '🆕 Нова заявка з сайту',
      '📞 ' + phone,
      data.page ? '🔗 ' + data.page : null,
      data.context ? '📄 ' + data.context : null,
    ].filter(Boolean);

    const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text: lines.join('\n'), disable_web_page_preview: true }),
    });

    const ok = tgRes.ok;
    return new Response(JSON.stringify({ ok }),
      { status: ok ? 200 : 502, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
