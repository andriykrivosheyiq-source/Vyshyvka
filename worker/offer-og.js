/**
 * Loomiq — заставка посилання на КП.
 *
 * НАВІЩО. Менеджер копіює посилання й вставляє в Telegram. Telegram (як і
 * Viber, Instagram, Slack, пошта) читає теги <meta og:…> із HTML — і читає їх
 * ДО того, як у сторінці виконається бодай один рядок JavaScript. А сторінка
 * пропозиції статична: сам документ у неї один на всіх, а хто клієнт і що
 * йому порахували, вона дізнається вже в браузері.
 *
 * Через це в заставці стояла загальна назва сайту замість пропозиції, і
 * клієнт отримував посилання, яке виглядало як реклама, а не як лист саме
 * йому.
 *
 * ЩО РОБИТЬ ЦЕЙ ВОРКЕР. Перехоплює запит на /offer.html?o=<токен>, дістає
 * документ пропозиції (він і так відкритий на читання за точною адресою — на
 * цьому тримається саме посилання клієнта), бере з нього ті самі дані, що
 * стоять у першому екрані сторінки, і вписує їх у теги заставки:
 *
 *   заголовок  — той самий, що в шапці КП: «Комерційна пропозиція для Grand Cafe»;
 *   опис       — склад і сума: «50 футболок · 42 300 ₴ · дійсна до 12.09»;
 *   картинка   — перший макет позиції, тобто те, що клієнт бачить угорі.
 *
 * Сама сторінка не змінюється: воркер лише додає теги в <head> і віддає її
 * далі. Людина відкриває те саме, що й раніше.
 *
 * ЯК УВІМКНУТИ (одноразово, ~5 хв):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker → вставити цей
 *      код → Deploy.
 *   2. У воркера: Settings → Domains & Routes → Add route:
 *        loomiq.net/offer.html*        (зона loomiq.net)
 *      Так само для www, якщо він використовується.
 *   3. Settings → Variables:
 *        ORIGIN = https://andriykrivosheyiq-source.github.io/Vyshyvka
 *                 (звідки брати саму сторінку; за замовчуванням — той самий
 *                  домен, тож змінна потрібна, лише якщо сторінка лежить
 *                  окремо)
 *   Ключів і секретів тут немає: документ пропозиції читається за тим самим
 *   публічним правилом, що й у браузері клієнта.
 *
 * ЯК ПЕРЕВІРИТИ: t.me/webpagebot — надіслати посилання, він покаже, що саме
 * бачить Telegram, і скине кеш заставки.
 */

const PROJECT = 'loomiq-admin';
const API_KEY = 'AIzaSyDf7WmfVlny7T8SBo9N_Xr7TorWYdrDqTc';   // публічний ключ сайту, не секрет
const FALLBACK_TITLE = 'Loomiq · комерційна пропозиція';

/* Firestore REST віддає значення в обгортках: { stringValue: '…' }. Тут
   розгортаємо рівно те, що нам треба, і не більше. */
function val(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return +v.doubleValue;
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('mapValue' in v) return v.mapValue.fields || {};
  if ('arrayValue' in v) return v.arrayValue.values || [];
  return null;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function money(n) {
  const v = Math.round(+n || 0);
  return v ? v.toLocaleString('uk-UA').replace(/ /g, ' ') + ' ₴' : '';
}
function dayMonth(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '';
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
}

/* Те саме, що показує перший екран сторінки: заголовок, склад, сума, дата й
   макет. Якщо чогось немає — рядок просто не зʼявляється, а не стає
   порожнім «· ·». */
async function offerMeta(token) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
              '/databases/(default)/documents/offers/' + encodeURIComponent(token) +
              '?key=' + API_KEY;
  const r = await fetch(url, { cf: { cacheTtl: 60, cacheEverything: true } });
  if (!r.ok) return null;
  const doc = await r.json();
  const f = (doc && doc.fields) || {};
  const client = val(f.client) || {};
  const who = val(client.company) || val(client.name) || val(client.instagram) || '';
  const hero = String(val(f.heroTitle) || '').trim();
  const title = hero || (who ? 'Комерційна пропозиція для ' + who : 'Комерційна пропозиція');

  const items = val(f.items) || [];
  let qty = 0, shot = '';
  const names = [];
  items.forEach(it => {
    const m = val(it) || {};
    const n = +val(m.qty) || 0;
    qty += n;
    const nm = String(val(m.name) || '').trim();
    if (nm && names.length < 2) names.push(n ? n + ' × ' + nm : nm);
    if (!shot) {
      const mocks = val(m.mockups) || [];
      if (mocks.length) shot = String(val(mocks[0]) || '');
    }
  });
  if (!shot) shot = String(val(f.clientLogo) || '');

  const totals = val(f.totals) || {};
  const terms = val(f.terms) || {};
  const till = dayMonth(val(terms.validUntil));
  const desc = [
    names.join(' · ') || (qty ? qty + ' виробів' : ''),
    money(val(totals.total)),
    till ? 'дійсна до ' + till : ''
  ].filter(Boolean).join(' · ');

  return { title, desc, image: shot };
}

/* Теги вписуємо в <head>, а наявні (загальні для сайту) прибираємо — інакше
   месенджер може взяти перший-ліпший. */
function injectMeta(html, meta, pageUrl) {
  const tags = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Loomiq">',
    '<meta property="og:url" content="' + esc(pageUrl) + '">',
    '<meta property="og:title" content="' + esc(meta.title) + '">',
    meta.desc ? '<meta property="og:description" content="' + esc(meta.desc) + '">' : '',
    meta.image ? '<meta property="og:image" content="' + esc(meta.image) + '">' : '',
    '<meta name="twitter:card" content="' + (meta.image ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + esc(meta.title) + '">',
    meta.desc ? '<meta name="twitter:description" content="' + esc(meta.desc) + '">' : '',
    meta.image ? '<meta name="twitter:image" content="' + esc(meta.image) + '">' : ''
  ].filter(Boolean).join('\n');

  let out = html
    .replace(/<meta[^>]+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(meta.title) + '</title>');
  return out.replace(/<head([^>]*)>/i, '<head$1>\n' + tags + '\n');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = (url.searchParams.get('o') || '').trim();

    /* Саму сторінку завжди беремо з походження — воркер її не зберігає й не
       версіонує. Оновили сайт — оновилось і тут. */
    const origin = (env && env.ORIGIN) ? env.ORIGIN.replace(/\/+$/, '') : url.origin;
    const pageReq = new Request(origin + url.pathname + url.search, request);
    const page = await fetch(pageReq);

    // Не сторінка пропозиції, немає токена або щось пішло не так — віддаємо як є
    if (!token || !/^[a-z0-9]{6,40}$/i.test(token) || !page.ok) return page;
    const ct = page.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return page;

    let meta = null;
    try { meta = await offerMeta(token); }
    catch (e) { meta = null; }
    if (!meta) return page;
    if (!meta.title) meta.title = FALLBACK_TITLE;

    const html = await page.text();
    const out = injectMeta(html, meta, url.origin + url.pathname + '?o=' + token);
    const headers = new Headers(page.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.delete('content-length');
    /* Заставку месенджери кешують у себе; нам вистачає короткого кешу на
       краю, щоб десять пересилань не били по базі. */
    headers.set('cache-control', 'public, max-age=60');
    return new Response(out, { status: page.status, headers });
  }
};
