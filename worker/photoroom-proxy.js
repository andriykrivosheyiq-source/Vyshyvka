/**
 * Loomiq — проксі до Photoroom API (видалення фону).
 *
 * НАВІЩО: сайт статичний (GitHub Pages), тож будь-який ключ у його коді видно всім
 * і його можуть використати за ваш рахунок. Тому ключ зберігається ТУТ, у секретах
 * Cloudflare Worker, і ніколи не потрапляє в браузер.
 *
 * Налаштування (див. worker/README.md):
 *   wrangler secret put PHOTOROOM_API_KEY     — ваш ключ Photoroom
 *   ALLOWED_ORIGINS (змінна) — домени, яким дозволено викликати проксі
 *
 * Сайт шле: POST <worker-url>  (тіло — байти зображення, Content-Type: image/*)
 * Проксі віддає: PNG із прозорим фоном.
 */

const DEFAULT_ALLOWED = ['https://loomiq.net', 'https://www.loomiq.net'];

function allowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED;
}

function corsHeaders(origin, env) {
  const allow = allowedOrigins(env);
  const ok = origin && allow.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') {
      return new Response('Only POST', { status: 405, headers: cors });
    }

    // Пускаємо лише свої домени — щоб чужі сайти не витрачали ваш ліміт Photoroom.
    if (origin && !allowedOrigins(env).includes(origin)) {
      return new Response('Forbidden origin', { status: 403, headers: cors });
    }

    const key = env.PHOTOROOM_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: 'PHOTOROOM_API_KEY не налаштовано' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const bytes = await request.arrayBuffer();
    if (!bytes || bytes.byteLength === 0) {
      return new Response('Empty body', { status: 400, headers: cors });
    }
    // М'який запобіжник від великих файлів (Photoroom і так має свої ліміти).
    if (bytes.byteLength > 12 * 1024 * 1024) {
      return new Response('Image too large', { status: 413, headers: cors });
    }

    const type = request.headers.get('Content-Type') || 'image/png';
    const form = new FormData();
    form.append('image_file', new Blob([bytes], { type }), 'logo.png');
    form.append('format', 'png');

    let resp;
    try {
      resp = await fetch('https://sdk.photoroom.com/v1/segment', {
        method: 'POST',
        headers: { 'x-api-key': key, 'Accept': 'image/png, application/json' },
        body: form
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'photoroom-unreachable' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      // Ключ назовні не віддаємо — лише статус, щоб сайт зміг відкотитись на свій алгоритм.
      return new Response(JSON.stringify({ error: 'photoroom-failed', status: resp.status, detail: detail.slice(0, 300) }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const out = await resp.arrayBuffer();
    return new Response(out, {
      status: 200,
      headers: { ...cors, 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
    });
  }
};
