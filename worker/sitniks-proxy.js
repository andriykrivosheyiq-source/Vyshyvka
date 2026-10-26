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

/* КЕШ ЧИТАННЯ (26.10). Володимир: «Sitniks обмежив запити… діалог довго
   завантажується». Вісім менеджерів, по кілька вкладок, кожна раз на 30 с
   просила список чатів і щочотири секунди — стрічку відкритого діалогу;
   Sitniks отримував 200–300 однакових запитів на хвилину з одного ключа й
   відповідав 429, після чого всі стояли хвилину.

   Тепер читання відповідає з кешу: список чатів — 20 с, стрічка чату — 5 с,
   решта GET — 10 с. Скільки б вкладок не питало, у Sitniks іде один запит;
   однакові, що летять одночасно, склеюються в один. Sitniks відмовив
   (429/5xx), а копія не старша за 10 хв — віддаємо її з заголовком
   `X-Loomiq-Stale: 1`. Після нашої відправки адмінка просить свіже
   (`X-Loomiq-Fresh: 1`) — кеш обходиться й оновлюється. Запис (POST…)
   кеш не чіпає, лише скидає копію стрічки цього чату. */
const TTL = { chats: 20, messages: 5, other: 10 };
const STALE_S = 600;
const inflight = new Map();
export const __test = { mem: null, inflight };          // ключ → Promise<{status, text, ctype}>: однакові одночасні — один запит

function ttlFor(pathname) {
  if (/\/messages$/.test(pathname)) return TTL.messages;
  if (/^\/chats\/?$/.test(pathname)) return TTL.chats;
  return TTL.other;
}

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

    if (request.method === 'GET') return cachedGet(request, target, url, env, cors);

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
    /* Записали в чат — копія його стрічки застаріла; наступне читання піде в Sitniks. */
    if (res.ok && /\/messages$/.test(url.pathname)) {
      try { await cacheDel(target); } catch (e) {}
    }
    return new Response(text, {
      status: res.status,
      headers: Object.assign(
        { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
        cors
      ),
    });
  },
};

/* ── Кеш читання ─────────────────────────────────────────────────────── */
/* Два шари: памʼять ізоляту (є завжди, живе, поки воркер «теплий»; на
   workers.dev це головний шар) і Cache API Cloudflare (`caches.default`,
   спільний для ізолятів того самого вузла; де його немає чи він не пише —
   мовчки минаємо). Копія — {text, ctype, at}; «свіжа» до `at + ttl`,
   «стара» до `at + STALE_S`. */
const mem = new Map();               // target → {text, ctype, at, ttl}
__test.mem = mem;
const MEM_MAX = 500;
function memGet(target, kind) {
  const e = mem.get(target); if (!e) return null;
  const age = (Date.now() - e.at) / 1000;
  if (age > STALE_S) { mem.delete(target); return null; }
  if (kind === 'fresh' && age > e.ttl) return null;
  return e;
}
function memPut(target, text, ctype, ttl) {
  if (mem.size >= MEM_MAX) { const k = mem.keys().next().value; if (k !== undefined) mem.delete(k); }
  mem.set(target, { text, ctype, at: Date.now(), ttl });
}
function cacheStore() {
  try { return (typeof caches !== 'undefined' && caches.default) ? caches.default : null; } catch (e) { return null; }
}
function keyOf(target, kind) { return new Request(target + (target.indexOf('?') >= 0 ? '&' : '?') + '__lq=' + kind, { method: 'GET' }); }
async function cacheGet(target, kind) {
  const m = memGet(target, kind);
  if (m) return m;
  const c = cacheStore(); if (!c) return null;
  try {
    const r = await c.match(keyOf(target, kind));
    if (!r) return null;
    return { text: await r.text(), ctype: r.headers.get('Content-Type') || 'application/json', at: +(r.headers.get('X-Loomiq-At') || 0) || Date.now() };
  } catch (e) { return null; }
}
async function cachePut(target, text, ctype, ttl) {
  memPut(target, text, ctype, ttl);
  const c = cacheStore(); if (!c) return;
  for (const [kind, s] of [['fresh', ttl], ['stale', STALE_S]]) {
    const r = new Response(text, { status: 200, headers: {
      'Content-Type': ctype || 'application/json',
      'Cache-Control': 'public, s-maxage=' + s + ', max-age=' + s,
      'X-Loomiq-At': String(Date.now()),
    } });
    try { await c.put(keyOf(target, kind), r); } catch (e) {}
  }
}
/* Скидає копії шляху з будь-якими параметрами (`?page=…`): у памʼяті —
   усі, у Cache API — лише ті ключі, які можна назвати (сам шлях і сторінки
   1–3); решта доживе свій TTL. */
async function cacheDel(target) {
  const pathOnly = target.split('?')[0];
  for (const k of Array.from(mem.keys())) if (k.split('?')[0] === pathOnly) mem.delete(k);
  const c = cacheStore(); if (!c) return;
  const variants = [pathOnly, pathOnly + '?page=1', pathOnly + '?page=2', pathOnly + '?page=3'];
  for (const v of variants) { try { await c.delete(keyOf(v, 'fresh')); } catch (e) {} }
}
async function upstream(target, env) {
  const res = await fetch(target, { method: 'GET', headers: { 'Authorization': 'Bearer ' + env.SITNIKS_API_KEY } });
  const text = await res.text();
  return { status: res.status, text, ctype: res.headers.get('Content-Type') || 'application/json', retry: res.headers.get('Retry-After') || '' };
}
async function cachedGet(request, target, url, env, cors) {
  const ttl = ttlFor(url.pathname);
  const fresh = request.headers.get('X-Loomiq-Fresh') === '1';
  const reply = (status, text, ctype, extra) => new Response(text, { status, headers: Object.assign({ 'Content-Type': ctype || 'application/json' }, extra || {}, cors) });
  if (!fresh) {
    const hit = await cacheGet(target, 'fresh');
    if (hit) return reply(200, hit.text, hit.ctype, { 'X-Loomiq-Cache': 'hit', 'X-Loomiq-At': String(hit.at) });
  }
  let p = inflight.get(target);
  if (!p) {
    p = upstream(target, env).finally(() => inflight.delete(target));
    inflight.set(target, p);
  }
  let r;
  try { r = await p; }
  catch (e) { r = { status: 502, text: JSON.stringify({ error: 'upstream', detail: String(e).slice(0, 200) }), ctype: 'application/json', retry: '' }; }
  if (r.status >= 200 && r.status < 300) {
    await cachePut(target, r.text, r.ctype, ttl);
    return reply(r.status, r.text, r.ctype, { 'X-Loomiq-Cache': fresh ? 'fresh' : 'miss' });
  }
  /* Sitniks відмовив — є копія до 10 хв? Віддаємо її, а не «повторимо за 36 с». */
  if (r.status === 429 || r.status >= 500) {
    const old = await cacheGet(target, 'stale');
    if (old) return reply(200, old.text, old.ctype, { 'X-Loomiq-Cache': 'stale', 'X-Loomiq-Stale': '1', 'X-Loomiq-Upstream': String(r.status), 'X-Loomiq-At': String(old.at) });
  }
  return reply(r.status, r.text, r.ctype, r.retry ? { 'Retry-After': r.retry } : {});
}

/* null означає «цьому джерелу не можна». Порожній список — пускаємо всіх:
   інакше свіжий воркер мовчки не працював би до налаштування змінної. */
function corsFor(origin, env) {
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Loomiq-Fresh',
    'Access-Control-Expose-Headers': 'Retry-After, X-Loomiq-Cache, X-Loomiq-Stale, X-Loomiq-At, X-Loomiq-Upstream',
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
