/**
 * Проксі до Sitniks CRM.
 *
 * Навіщо. З браузера до Sitniks не достукатись з двох причин: він не віддає
 * CORS-заголовків, і ключ у коді сторінки побачив би кожен. Тому між адмінкою
 * і Sitniks стоїть цей воркер: він додає ключ і CORS, а ключ живе лише в його
 * секретах.
 *
 * Проксі НАВМИСНЕ універсальний — пропускає будь-який шлях. Документація
 * Sitniks закрита, і частину ендпоінтів доводиться перевіряти навпомацки;
 * з універсальним проксі це робиться з консолі браузера, без правок коду.
 *
 * Статус і тіло відповіді віддаємо як є, не згладжуючи: без справжнього
 * коду помилки причину 400 від Sitniks не вгадати.
 *
 * Змінні (Cloudflare → Worker → Settings → Variables):
 *   SITNIKS_API_KEY — секрет, обовʼязково з Encrypt
 *   ALLOWED_ORIGINS — необовʼязково, домени через кому. Без цієї змінної
 *                     проксі відкритий для всіх: ключ не витікає, але чужі
 *                     можуть читати ваші замовлення, тож задайте її.
 */

const SITNIKS_BASE = 'https://crm.sitniks.com/open-api';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsFor(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (cors === null) return json({ error: 'origin-not-allowed' }, 403, {});

    if (!env.SITNIKS_API_KEY) return json({ error: 'not-configured' }, 500, cors);

    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('ok', { headers: cors });
    }

    const target = SITNIKS_BASE + url.pathname + url.search;

    /* Тіло веземо БАЙТАМИ і з його власним Content-Type.

       Доти воно читалось як текст, а заголовок ставився `application/json`
       завжди. Для листів це працювало, а от файл так не проходить: у
       multipart тіло двійкове, і в самому заголовку стоїть межа частин
       (`boundary=...`) — вирізавши її, ми перетворювали вкладення на кашу,
       якої приймач не розбирає. Вийшло б «Sitniks не вміє картинок», хоча
       не вміли ми.

       Свій заголовок ставимо лише тоді, коли його не прислали зовсім: тоді
       це наш власний JSON, і назвати його треба самим. */
    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.arrayBuffer();
    const ctype = request.headers.get('Content-Type') || 'application/json';

    let res;
    try {
      res = await fetch(target, {
        method: request.method,
        headers: {
          'Content-Type': ctype,
          'Authorization': 'Bearer ' + env.SITNIKS_API_KEY,
        },
        body: (body && body.byteLength) ? body : undefined,
      });
    } catch (e) {
      return json({ error: 'upstream', detail: String(e).slice(0, 200) }, 502, cors);
    }

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: Object.assign(
        { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
        cors
      ),
    });
  },
};

/* null означає «цьому джерелу не можна». Порожній список — пускаємо всіх:
   інакше свіжий воркер мовчки не працював би до налаштування змінної. */
function corsFor(origin, env) {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return Object.assign({ 'Access-Control-Allow-Origin': '*' }, base);
  if (origin && list.indexOf(origin) >= 0) {
    return Object.assign({ 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }, base);
  }
  return null;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors || {}),
  });
}
