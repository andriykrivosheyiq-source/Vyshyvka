/**
 * Loomiq — проксі до Gemini (генерація зображень для логотипів).
 *
 * НАВІЩО: як і з Photoroom, ключ не можна класти в код сайту — сайт статичний,
 * його код бачить кожен. Ключ живе ТУТ, у секретах Cloudflare Worker.
 *
 * Налаштування:
 *   wrangler secret put GEMINI_API_KEY --name loomiq-gemini
 *   ALLOWED_ORIGINS (звичайна змінна) — домени, яким дозволено викликати проксі
 *
 * Сайт шле:  POST <worker-url>   {"prompt":"опис зображення"}
 * Проксі віддає: PNG (байти зображення). Помилка — JSON із полем error.
 */

const DEFAULT_ALLOWED = ['https://loomiq.net', 'https://www.loomiq.net'];

// Моделі пробуються по черзі: якщо перша недоступна на акаунті — береться наступна.
const MODELS = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];

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

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Дістає перше зображення з відповіді Gemini (формат: parts[].inlineData).
function pickImage(data) {
  const cands = (data && data.candidates) || [];
  for (const c of cands) {
    const parts = (c.content && c.content.parts) || [];
    for (const p of parts) {
      const d = p.inlineData || p.inline_data;
      if (d && d.data) return { b64: d.data, mime: d.mimeType || d.mime_type || 'image/png' };
    }
  }
  return null;
}

// Правильне ім'я секрету — GEMINI_API_KEY. Але якщо секрет назвали інакше
// (напр. іменем воркера), беремо будь-яке значення, схоже на ключ,
// щоб через одну описку не падала генерація. Значення нікуди не віддається.
function apiKey(env) {
  const direct = env.GEMINI_API_KEY || env.GEMINI_KEY;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const skip = new Set(['ALLOWED_ORIGINS']);
  for (const k of Object.keys(env || {})) {
    if (skip.has(k)) continue;
    const v = env[k];
    if (typeof v !== 'string') continue;
    const s = v.trim();
    // Ключ Google — суцільний рядок без пробілів; адреси й списки доменів відсіюємо.
    if (s.length < 20 || s.length > 200) continue;
    if (/\s/.test(s) || /^https?:\/\//i.test(s) || s.includes(',')) continue;
    return s;
  }
  return null;
}

// Діагностика без витоку: показуємо лише ІМЕНА змінних і чи це рядок,
// щоб було видно, чи секрет узагалі долетів до воркера. Значень тут немає ніколи.
function envReport(env) {
  return Object.keys(env || {}).map(k => k + ':' + (typeof env[k] === 'string' ? 'string' : typeof env[k]));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Only POST', { status: 405, headers: cors });

    // Пускаємо лише свої домени — щоб чужі сайти не витрачали ваш ліміт.
    if (origin && !allowedOrigins(env).includes(origin)) {
      return new Response('Forbidden origin', { status: 403, headers: cors });
    }

    const key = apiKey(env);
    if (!key) {
      return json({ error: 'GEMINI_API_KEY не налаштовано', vars: envReport(env) }, 500, cors);
    }

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: 'bad-json' }, 400, cors); }

    const prompt = String((body && body.prompt) || '').trim();
    if (!prompt) return json({ error: 'empty-prompt' }, 400, cors);
    if (prompt.length > 2000) return json({ error: 'prompt-too-long' }, 400, cors);

    // Просимо саме те, що потрібно для друку: чіткий об'єкт на однорідному тлі,
    // без тіней і фотофону — далі фон прибирає Photoroom.
    const guide = 'Logo/graphic artwork for apparel printing. Single centered subject, ' +
      'clean flat solid white background, no shadow, no mockup, no text watermark, ' +
      'crisp edges, high contrast, vector-like look. Subject: ';

    const payload = {
      contents: [{ role: 'user', parts: [{ text: guide + prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] }
    };

    let lastErr = null;
    for (const model of MODELS) {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
        model + ':generateContent';
      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        lastErr = { error: 'gemini-unreachable', model };
        continue;
      }

      const text = await resp.text();
      if (!resp.ok) {
        // Ключ назовні не віддаємо — лише статус, щоб сайт показав зрозуміле повідомлення.
        lastErr = { error: 'gemini-failed', model, status: resp.status, detail: text.slice(0, 300) };
        continue;
      }

      let data;
      try { data = JSON.parse(text); }
      catch (e) { lastErr = { error: 'gemini-bad-response', model }; continue; }

      const img = pickImage(data);
      if (!img) { lastErr = { error: 'no-image', model, detail: text.slice(0, 300) }; continue; }

      return new Response(b64ToBytes(img.b64), {
        status: 200,
        headers: { ...cors, 'Content-Type': img.mime, 'Cache-Control': 'no-store' }
      });
    }

    return json(lastErr || { error: 'gemini-failed' }, 502, cors);
  }
};
