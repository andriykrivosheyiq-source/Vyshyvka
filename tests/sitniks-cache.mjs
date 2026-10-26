/* ВОРКЕР SITNIKS: ЧИТАННЯ — З КЕШУ, У SITNIKS — ОДИН ЗАПИТ (26.10).

   Володимир: «Sitniks обмежив запити… довго завантажується діалог».
   Вісім менеджерів, кожна вкладка раз на 30 с просила список чатів і
   кожні 4 с — стрічку відкритого діалогу; Sitniks отримував сотні однакових
   запитів на хвилину з одного ключа й відповідав 429, після чого всі стояли
   хвилину. Тепер воркер `worker/sitniks-proxy.js` відповідає на читання з
   кешу. Перевіряємо сам воркер (без браузера, Sitniks підмінено):
   1. Вісім одночасних однакових GET — у Sitniks один запит, усім та сама
      відповідь.
   2. Стрічка чату: повторний запит за 5 с — з кешу; після 5 с — знову в
      Sitniks. Список чатів — 20 с.
   3. Sitniks відповів 429 — віддаємо копію до 10 хв з `X-Loomiq-Stale: 1`
      (і 200), а не 429. Копії немає — чесний 429 з `Retry-After`.
   4. `X-Loomiq-Fresh: 1` — кеш обходиться, у Sitniks іде запит, копія
      оновлюється.
   5. POST не кешується й не бере з кешу; POST у стрічку чату скидає її
      копію — наступне читання йде в Sitniks.
   6. Різні шляхи (інший чат, інша сторінка) — різні копії.
   7. CORS: заголовок `X-Loomiq-Fresh` дозволено, `Retry-After` і
      `X-Loomiq-Stale` відкрито.

   Запуск:  node tests/sitniks-cache.mjs      (з кореня репозиторію)  */
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

/* Годинник у руках тесту: воркер бере Date.now(). */
let NOW = 1_700_000_000_000;
const realNow = Date.now; Date.now = () => NOW;
const tick = s => { NOW += s * 1000; };

/* Sitniks підмінений: рахуємо запити, задаємо відповідь. */
let up = [];                       // {url, method}
let answer = () => ({ status: 200, body: JSON.stringify({ data: [1, 2, 3], n: up.length }) });
let hold = null;                   // Promise, яку тримаємо, щоб запити «летіли одночасно»
globalThis.fetch = async (url, opt) => {
  up.push({ url: String(url), method: (opt && opt.method) || 'GET' });
  if(hold) await hold;
  const a = answer(up[up.length - 1]);
  return new Response(a.body, { status: a.status, headers: Object.assign({ 'Content-Type': 'application/json' }, a.headers || {}) });
};
/* Cache API немає (як на workers.dev) — працює шар памʼяті. */
delete globalThis.caches;

const W = (await import(path.join(ROOT, 'worker/sitniks-proxy.js'))).default;
const env = { SITNIKS_API_KEY: 'k', ALLOWED_ORIGINS: 'https://loomiq.example' };
const BASE = 'https://loomiq-sitniks.test.workers.dev';
const req = (p, o) => W.fetch(new Request(BASE + p, Object.assign({ headers: { Origin: 'https://loomiq.example' } }, o || {})), env);
const body = async r => { const t = await r.text(); try{ return JSON.parse(t); }catch(e){ return t; } };

console.log('═══ 1. ВІСІМ ОДНОЧАСНИХ — ОДИН ЗАПИТ У SITNIKS ═══');
let release; hold = new Promise(r => release = r);
const eight = Array.from({ length: 8 }, () => req('/chats/77/messages?page=1'));
await new Promise(r => setTimeout(r, 20));
ok(up.length === 1, 'поки Sitniks думає — у нього лише один запит', 'запитів: ' + up.length);
release(); hold = null;
const rs = await Promise.all(eight);
const bs = await Promise.all(rs.map(body));
ok(up.length === 1 && rs.every(r => r.status === 200) && bs.every(b => b.n === 1), 'усі вісім отримали ту саму відповідь, Sitniks — один запит', JSON.stringify({ up: up.length, ns: bs.map(b => b.n) }));
ok(rs[0].headers.get('Access-Control-Allow-Origin') === 'https://loomiq.example', 'CORS на місці', 'CORS: ' + rs[0].headers.get('Access-Control-Allow-Origin'));

console.log('═══ 2. СТРІЧКА — 5 С, СПИСОК — 20 С ═══');
up = [];
let r = await req('/chats/77/messages?page=1');
ok(up.length === 0 && r.headers.get('X-Loomiq-Cache') === 'hit', 'повторне читання стрічки — з кешу', JSON.stringify({ up: up.length, c: r.headers.get('X-Loomiq-Cache') }));
tick(4); r = await req('/chats/77/messages?page=1');
ok(up.length === 0, 'за 4 с — ще з кешу', 'пішов у Sitniks');
tick(2); r = await req('/chats/77/messages?page=1');
ok(up.length === 1 && r.headers.get('X-Loomiq-Cache') === 'miss', 'за 6 с — знову в Sitniks', JSON.stringify({ up: up.length, c: r.headers.get('X-Loomiq-Cache') }));
up = [];
await req('/chats?page=1'); tick(15); await req('/chats?page=1');
ok(up.length === 1, 'список чатів за 15 с — з кешу', 'запитів: ' + up.length);
tick(6); await req('/chats?page=1');
ok(up.length === 2, 'список за 21 с — знову в Sitniks', 'запитів: ' + up.length);

console.log('═══ 3. SITNIKS 429 — КОПІЯ ДО 10 ХВ, А НЕ ВІДМОВА ═══');
up = [];
answer = () => ({ status: 429, body: JSON.stringify({ message: 'Too Many Requests' }), headers: { 'Retry-After': '36' } });
tick(10); r = await req('/chats/77/messages?page=1');
let b = await body(r);
ok(r.status === 200 && r.headers.get('X-Loomiq-Stale') === '1' && r.headers.get('X-Loomiq-Upstream') === '429' && b.data && b.data.length === 3,
   '429 від Sitniks → 200 з копією і X-Loomiq-Stale: 1', JSON.stringify({ s: r.status, st: r.headers.get('X-Loomiq-Stale'), b }));
tick(601); r = await req('/chats/77/messages?page=1');
ok(r.status === 429 && r.headers.get('Retry-After') === '36', 'копія старша за 10 хв — чесний 429 з Retry-After', JSON.stringify({ s: r.status, ra: r.headers.get('Retry-After') }));
r = await req('/chats/999/messages');
ok(r.status === 429, 'чат, якого не читали, — 429 як є', 'статус: ' + r.status);
answer = () => ({ status: 503, body: 'bad gateway' });
up = []; await req('/chats?page=1'); tick(30);
r = await req('/chats?page=1');
ok(r.status === 503, '5xx без копії — як є', 'статус: ' + r.status);

console.log('═══ 4. X-LOOMIQ-FRESH — ОБХІД КЕШУ ═══');
answer = () => ({ status: 200, body: JSON.stringify({ data: ['fresh'], n: up.length }) });
up = [];
await req('/chats/77/messages?page=1');          // копія n=1
r = await req('/chats/77/messages?page=1', { headers: { Origin: 'https://loomiq.example', 'X-Loomiq-Fresh': '1' } });
b = await body(r);
ok(up.length === 2 && r.headers.get('X-Loomiq-Cache') === 'fresh' && b.n === 2, 'з X-Loomiq-Fresh — запит у Sitniks попри копію', JSON.stringify({ up: up.length, c: r.headers.get('X-Loomiq-Cache'), n: b.n }));
r = await req('/chats/77/messages?page=1'); b = await body(r);
ok(up.length === 2 && b.n === 2, 'наступне звичайне читання бере вже оновлену копію', JSON.stringify({ up: up.length, n: b.n }));

console.log('═══ 5. POST — НЕ З КЕШУ; ПОСТ У ЧАТ СКИДАЄ ЙОГО СТРІЧКУ ═══');
up = [];
r = await req('/chats/77/messages', { method: 'POST', body: JSON.stringify({ text: 'привіт' }), headers: { Origin: 'https://loomiq.example', 'Content-Type': 'application/json' } });
ok(up.length === 1 && up[0].method === 'POST' && r.status === 200, 'POST пішов у Sitniks', JSON.stringify(up));
r = await req('/chats/77/messages', { method: 'POST', body: JSON.stringify({ text: 'ще' }), headers: { Origin: 'https://loomiq.example', 'Content-Type': 'application/json' } });
ok(up.length === 2 && up[1].method === 'POST', 'другий POST — теж у Sitniks, не з кешу', JSON.stringify(up));
up = [];
r = await req('/chats/77/messages?page=1');
ok(up.length === 1, 'після POST у чат його стрічка читається заново', 'запитів: ' + up.length);

console.log('═══ 6. РІЗНІ ШЛЯХИ — РІЗНІ КОПІЇ ═══');
up = [];
await req('/chats/77/messages?page=1'); await req('/chats/78/messages?page=1'); await req('/chats/77/messages?page=2');
ok(up.length === 2 && up.map(u => u.url).join('|').indexOf('/chats/78/messages') > 0, 'інший чат і інша сторінка — окремі запити, той самий — з кешу', JSON.stringify(up.map(u => u.url)));

console.log('═══ 7. CORS ═══');
r = await req('/chats', { method: 'OPTIONS', headers: { Origin: 'https://loomiq.example', 'Access-Control-Request-Headers': 'x-loomiq-fresh' } });
const ah = r.headers.get('Access-Control-Allow-Headers') || '', eh = r.headers.get('Access-Control-Expose-Headers') || '';
ok(r.status === 204 && /X-Loomiq-Fresh/i.test(ah), 'OPTIONS дозволяє X-Loomiq-Fresh', 'allow: ' + ah);
ok(/Retry-After/i.test(eh) && /X-Loomiq-Stale/i.test(eh), 'Retry-After і X-Loomiq-Stale відкрито для сторінки', 'expose: ' + eh);
r = await req('/chats', { headers: { Origin: 'https://evil.example' } });
ok(r.status === 403, 'чужий Origin — 403', 'статус: ' + r.status);

Date.now = realNow;
console.log('');
console.log(bad ? 'розходжень: ' + bad : 'воркер Sitniks: читання з кешу, у Sitniks — один запит');
process.exit(bad ? 1 : 0);
