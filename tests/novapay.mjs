/* NovaPay: вхід з ротацією ключа, рахунки й залишок (05.10).

   Андрій: «давай спробуємо NovaPay підключити». API бізнес-кабінету —
   SOAP; кожен вхід видає НОВИЙ refresh_token, старий гасне. Тут — найважливіше:
     — новий ключ лягає в базу (secrets/novapay) одразу після входу;
     — поки jwt живий, повторно не входимо (ключ не крутимо даремно);
     — наступний вхід — уже зі збереженого ключа, а не з секрету;
     — новий секрет у Cloudflare (новий ключ із кабінету) — воркер бере його;
     — протермінований ключ — зрозуміла помилка;
     — залишок рахунку NovaPay лягає в loomiq/bankBal рахунку Фінансів з тим
       самим IBAN.

   Запуск:  node tests/novapay.mjs      (з кореня репозиторію)  */
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_PROJECT: 'test',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type:'pkcs8', format:'pem' }) }),
  HOOK_SECRET: 'sek', NOVAPAY_LOGIN: 'andriy', NOVAPAY_REFRESH_TOKEN: 'RT-0', NOVAPAY_CERT: 'CERT-0'
};
const sv = v => ({ stringValue: v });
const DBT = {}; let TICK = 0;
const DB = {};
DB['loomiq/photos'] = { fin: { mapValue: { fields: { accounts: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('np1'), bank: sv('np'), iban: sv('UA29 358710 0000673200 000000190'), name: sv('NovaPay') } } } ] } } } } } };

const soap = (method, inner) => '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><' + method +
  'Response xmlns="http://tempuri.org/"><' + method + 'Result>' + inner + '</' + method + 'Result></' + method + 'Response></s:Body></s:Envelope>';
let valid = 'RT-0', n = 0, expFmt = 'iso', staticKey = false, crCert = false, validCert = '';
const calls = [];
/* Виписка — як справжня (05.10, з /novapay/probe): пул від «НоваПей»,
   переказ собі на особистий рахунок, звичайна витрата. */
const МІЙ = 'UA293587100000673200000000190';
const doc = (amt, id, d, cr, crName, crCode, db, dbName, dbCode, purpose) => '<Docs Amount="' + amt + '" CurrencyTag="UAH">' +
  '<ID>' + id + '</ID><OrgDate>' + d + '</OrgDate><DayDate>' + d + '</DayDate><CreditCodeIBAN>' + cr + '</CreditCodeIBAN><CreditName>' + crName +
  '</CreditName><CreditStateCode>' + crCode + '</CreditStateCode><DebitCodeIBAN>' + db + '</DebitCodeIBAN><DebitName>' + dbName +
  '</DebitName><DebitStateCode>' + dbCode + '</DebitStateCode><Purpose>' + purpose + '</Purpose></Docs>';
const EXTRACT = '<Extract><ExtractHead><GetExtractForXML><Date>04.10.2026</Date><IBAN>' + МІЙ + '</IBAN>' +
  doc('50000.00', '58236056', '04.10.2026', МІЙ, 'ФОП Кривошей', '3755906355', 'UA669358710000068603000000022', 'НоваПей', '38324133',
    'Переказ коштів по платежам, прийнятим від населення за товари/послуги згідно реєстру № 18321608 від 04.10.2026') +
  doc('1000.00', '58194299', '04.10.2026', 'UA789358710000067406000279221', 'Кривошей Андрій Ігорович', '3755906355', МІЙ, 'ФОП Кривошей', '3755906355',
    'Перерахування чистого підприємницького доходу. Податки сплачено') +
  doc('320.50', '58190001', '03.10.2026', 'UA111111111111111111111111111', 'ФОП Постачальник', '1111111111', МІЙ, 'ФОП Кривошей', '3755906355',
    'Оплата за нитки') +
  '</GetExtractForXML></ExtractHead></Extract>';
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status || 200 });
  if(url.startsWith('https://oauth2.googleapis.com/token')) return res({ access_token:'tok', expires_in:3600 });
  if(url.startsWith('https://business.novapay.ua')){
    const action = String((opt.headers || {}).SOAPAction || '').split('/').pop();
    const body = String(opt.body);
    const get = k => ((new RegExp('<tem:' + k + '>([^<]*)</tem:' + k + '>')).exec(body) || [])[1] || '';
    calls.push({ action, body });
    if(action === 'UserAuthenticationJWT'){
      /* Як справжня NovaPay (08.10): сертифікат віддає з CRLF, \r — «&#xD;»,
         і наступний вхід приймає лише з тим самим сертифікатом. */
      const certIn = get('public_certificate').replace(/&#xD;/g, '\r').replace(/&amp;/g, '&');
      if(get('refresh_token') !== valid || get('login') !== 'andriy' || (crCert && validCert && certIn !== validCert))
        return res(soap(action, '<request_ref>x</request_ref><error><code>logic_error</code><message>Refresh token expired</message></error>'));
      n++; if(!staticKey) valid = 'RT-' + n;
      if(crCert) validCert = '-----BEGIN-----\r\nK' + n + '\r\n-----END-----\r\n';
      return res(soap(action, '<request_ref>x</request_ref><response_ref>y</response_ref><jwt>JWT-' + n + '</jwt><expiration>' +
        (expFmt === 'dmy' ? new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now() + 30 * 60000)).replace(',', '')
          : new Date(Date.now() + 30 * 60000).toISOString()) + '</expiration><refresh_token>' + (staticKey ? 'BOGUS-' + n : valid) + '</refresh_token><public_certificate>' + (crCert ? validCert.replace(/\r/g, '&#xD;') : 'CERT-' + n) + '</public_certificate>'));
    }
    if(!/^JWT-/.test(get('jwt'))) return res(soap(action, '<error><message>jwt invalid</message></error>'));
    if(action === 'GetClientsList') return res(soap(action, '<result>ok</result><clients><Clients><id>8</id><name>ФОП Кривошей</name></Clients></clients>'));
    if(action === 'GetAccountsList') return res(soap(action, '<result>ok</result><accounts><Accounts><id>49</id><IBAN>UA293587100000673200000000190</IBAN><name>ФОП Кривошей</name><currency>UAH</currency><statuscode>Active</statuscode></Accounts></accounts>'));
    if(action === 'GetAccountRest') return res(soap(action, '<result>ok</result><confirmed_balance>6593.5800</confirmed_balance><available_balance>6582.3100</available_balance>'));
    if(action === 'GetAccountExtract') return res(soap(action, '<result>ok</result><extract>' + EXTRACT.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</extract>'));
    return res(soap(action, '<error><message>?</message></error>'));
  }
  if(url.endsWith('documents:commit')){
    for(const w of JSON.parse(opt.body).writes){
      const p = w.update.name.split('/documents/')[1];
      DB[p] = DB[p] || {}; w.updateMask.fieldPaths.forEach(k => { DB[p][k] = w.update.fields[k]; });
      DBT[p] = 't' + (++TICK);
      calls.push({ action: 'FS ' + p });
    }
    return res({});
  }
  const m = /documents\/([^?]+)/.exec(url);
  if(m){
    const p = decodeURIComponent(m[1]);
    if((opt.method || 'GET') === 'GET') return DB[p] ? res({ fields: DB[p], updateTime: DBT[p] || 't0' }) : res({ error:'nf' }, 404);
    /* Умовний запис, як у Firestore: документ змінили після читання — 400. */
    const ut = /currentDocument\.updateTime=([^&]+)/.exec(url), ex = /currentDocument\.exists=(true|false)/.exec(url);
    if(ut && decodeURIComponent(ut[1]) !== (DBT[p] || 't0')) return res({ error:'FAILED_PRECONDITION' }, 400);
    if(ex && (ex[1] === 'true') !== !!DB[p]) return res({ error:'FAILED_PRECONDITION' }, 400);
    const b = JSON.parse(opt.body);
    const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(x => decodeURIComponent(x[1]));
    DB[p] = DB[p] || {}; mask.forEach(k => { DB[p][k] = b.fields[k]; });
    DBT[p] = 't' + (++TICK);
    calls.push({ action: 'FS ' + p });
    return res({});
  }
  throw new Error('неочікуваний запит ' + url);
};
const worker = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + Date.now())).default;
const call = pth => worker.fetch(new Request('https://w.test' + pth), env).then(r => r.json());

console.log('═══ SOAP-КОНВЕРТ ═══');
const { _pure } = await import(path.join(ROOT, 'worker/money.js') + '?t=' + Date.now());
const env1 = _pure.novapayEnvelope('GetAccountRest', { jwt: 'J<1>', account_id: 49, empty: '' });
ok(/<tem:GetAccountRest><tem:request><tem:jwt>J&lt;1&gt;<\/tem:jwt><tem:account_id>49<\/tem:account_id><\/tem:request><\/tem:GetAccountRest>/.test(env1) && !/empty/.test(env1),
  'конверт як у NovaPay: tem:Method / tem:request / поля; спецсимволи екрановано, порожні — пропущено', 'конверт: ' + env1);

console.log('');
console.log('═══ ПЕРШИЙ ВХІД І ЗАЛИШОК ═══');
const p1 = await call('/novapay/poll?s=sek');
console.log('   ' + JSON.stringify(p1));
const saved = DB['secrets/novapay'] || {};
const order = calls.map(c => c.action);
ok(p1.ok && saved.refresh_token && saved.refresh_token.stringValue === 'RT-1' && saved.public_certificate.stringValue === 'CERT-1',
  'новий ключ (RT-1) і сертифікат збережено в secrets/novapay', 'збереження ключа: ' + JSON.stringify(saved));
ok(order[order.indexOf('UserAuthenticationJWT') + 1] === 'FS secrets/novapay',
  'ключ зберігається одразу після входу — до будь-якого іншого запиту', 'порядок: ' + order.join(' → '));
const bal = ((DB['loomiq/bankBal'] || {}).np1 || {}).mapValue;
const P = id => (DB['payments/' + id] || {});
const pool = P('novapay_58236056'), self = P('novapay_58194299'), out = P('novapay_58190001');
ok(pool.amount && +pool.amount.doubleValue === 50000 && pool.flow.stringValue === 'pool' && pool.src.stringValue === 'novapay' &&
   pool.acc.stringValue === 'np1' && pool.at.stringValue === '2026-10-04T09:00:00.000Z',
  'пул від «НоваПей» за реєстром — +50 000 ₴ у рахунок NovaPay, позначено pool (доходом удруге не буде)', 'пул: ' + JSON.stringify(pool));
ok(self.amount && +self.amount.doubleValue === -1000 && self.flow.stringValue === 'self',
  'переказ собі (той самий ІПН) — −1 000 ₴, позначено self (між своїми)', 'собі: ' + JSON.stringify(self));
ok(out.amount && +out.amount.doubleValue === -320.5 && !out.flow && out.counter.stringValue === 'ФОП Постачальник' && /нитки/.test(out.desc.stringValue),
  'звичайна витрата — −320,50 ₴, отримувач і призначення як у банку', 'витрата: ' + JSON.stringify(out));
ok(_pure.novapayRow({ Amount: '5.00', ID: '1', OrgDate: '04.10.2026', CreditCodeIBAN: 'UA1', DebitCodeIBAN: 'UA2' }, МІЙ, 'np1') === null,
  'рух чужого рахунку (нашого IBAN ні там, ні там) — не пишемо', 'чужий рух записано');
ok(bal && +bal.fields.bal.doubleValue === 6582.31 && bal.fields.src.stringValue === 'novapay' && /np1/.test(JSON.stringify(p1.novapay)),
  'залишок NovaPay 6 582,31 ₴ — у рахунку Фінансів з тим самим IBAN (пробіли в IBAN не заважають)', 'залишок: ' + JSON.stringify(bal));

console.log('');
console.log('═══ JWT ЖИВИЙ — КЛЮЧ НЕ КРУТИМО ═══');
calls.length = 0;
await call('/novapay/poll?s=sek');
ok(!calls.some(c => c.action === 'UserAuthenticationJWT'), 'другий запит — тим самим jwt, без нового входу', 'зайвий вхід');

console.log('');
console.log('═══ ВОРКЕР ПЕРЕЗАПУСТИВСЯ, JWT ПРОСТРОЧЕНО ═══');
const fresh = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 1))).default;
DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
calls.length = 0;
const p3 = await fresh.fetch(new Request('https://w.test/novapay/poll?s=sek'), env).then(r => r.json());
const auth3 = calls.filter(c => c.action === 'UserAuthenticationJWT')[0];
ok(p3.ok && auth3 && /RT-1/.test(auth3.body) && /CERT-1/.test(auth3.body) && DB['secrets/novapay'].refresh_token.stringValue === 'RT-2',
  'вхід — зі збереженого ключа RT-1 (не з секрету), новий RT-2 збережено', 'повторний вхід: ' + JSON.stringify(p3).slice(0, 200));

console.log('');
console.log('═══ НОВИЙ КЛЮЧ ІЗ КАБІНЕТУ ═══');
const fresh2 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 2))).default;
valid = 'NEW-KEY';
const env2 = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'NEW-KEY', NOVAPAY_CERT: 'NEW-CERT' });
DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
const p4 = await fresh2.fetch(new Request('https://w.test/novapay/poll?s=sek'), env2).then(r => r.json());
ok(p4.ok, 'поклали в Cloudflare новий ключ — воркер помітив і почав з нього', 'новий ключ: ' + JSON.stringify(p4).slice(0, 200));

console.log('');
console.log('═══ ПРОТЕРМІНОВАНИЙ КЛЮЧ ═══');
const fresh3 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 3))).default;
const env3 = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'OLD-DEAD' });
const p5 = await fresh3.fetch(new Request('https://w.test/novapay/poll?s=sek'), env3).then(r => r.json());
ok(!p5.ok && /Refresh token expired/.test(p5.error) && /згенеруйте новий/.test(p5.error) && /логін «andriy» \(6 симв.\), токен 8 симв./.test(p5.error) && !/OLD-DEAD/.test(p5.error),
  'протермінований ключ — зрозуміло: «' + String(p5.error).slice(0, 90) + '…»', 'помилка: ' + JSON.stringify(p5));

console.log('');
console.log('═══ СТРОК «05.10.2026 21:59» — ОДИН ВХІД ЗА ЗАПУСК ═══');
const U = _pure.novapayUntil, T0 = Date.parse('2026-10-05T18:00:00Z');
ok(U('05.10.2026 21:59', T0) === Date.parse('2026-10-05T18:59:00Z'), 'строк dd.mm.yyyy hh:mm читається за Києвом', 'строк: ' + new Date(U('05.10.2026 21:59', T0)).toISOString());
ok(U('01.01.2027', T0) === T0 + 20 * 60000 && U('03.10.2026 10:00', T0) === T0 + 20 * 60000 && U('', T0) === T0 + 20 * 60000,
  'лише дата, минулий чи порожній строк — 20 хв, а не «вже протух»', 'запасний строк');
const fresh4 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 4))).default;
expFmt = 'dmy'; valid = 'NEW-KEY-2';
const env4 = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'NEW-KEY-2', NOVAPAY_CERT: 'NEW-CERT' });
calls.length = 0;
const p6 = await fresh4.fetch(new Request('https://w.test/novapay/probe?s=sek'), env4).then(r => r.json());
const a6 = calls.filter(c => c.action === 'UserAuthenticationJWT').length;
calls.length = 0;
await fresh4.fetch(new Request('https://w.test/novapay/poll?s=sek'), env4).then(r => r.json());
const a7 = calls.filter(c => c.action === 'UserAuthenticationJWT').length;
ok(p6.ok && a6 === 1 && a7 === 0, 'NovaPay дає строк як «dd.mm.yyyy hh:mm» — вхід один, ключ не крутиться вдруге', 'входів: ' + a6 + ' + ' + a7 + ' · ' + JSON.stringify(p6).slice(0, 200));
expFmt = 'iso';

console.log('');
console.log('═══ ДВА ПРОГОНИ РАЗОМ — ОДИН ВХІД ═══');
/* Розклад і ручний /novapay/poll в ту саму мить: обидва з тим самим ключем.
   Доти обидва входили, і в базі міг лишитись не той ключ (07.10:
   «Refresh token does not apply to login»). Тепер другий чекає на першого. */
{
  const fa = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 5))).default;
  const fb = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 6))).default;
  valid = 'PAR-KEY';
  const envP = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'PAR-KEY', NOVAPAY_CERT: 'NEW-CERT' });
  calls.length = 0;
  const [ra, rb] = await Promise.all([fa, fb].map(w => w.fetch(new Request('https://w.test/novapay/poll?s=sek'), envP).then(r => r.json())));
  const входів = calls.filter(c => c.action === 'UserAuthenticationJWT').length;
  ok(ra.ok && rb.ok && входів === 1, 'два прогони одночасно — вхід один, другий бере jwt першого', 'входів: ' + входів + ' · ' + JSON.stringify([ra.error, rb.error]));
}

console.log('');
console.log('═══ СЕРТИФІКАТ З «&#xD;» ═══');
/* 08.10, справжня причина двох поломок: NovaPay віддає сертифікат із CRLF,
   де \r — «&#xD;». Доти він зберігався буквально (466 симв. замість 425), і
   наступний вхід відкидали. Тепер — розкодовано, і ключ крутиться далі. */
{
  const w1 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 21))).default;
  const w2 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 22))).default;
  const w3 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 23))).default;
  crCert = true; valid = 'CR-KEY'; validCert = '';
  const envC = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'CR-KEY', NOVAPAY_CERT: 'CR-CERT' });
  const c1 = await w1.fetch(new Request('https://w.test/novapay/poll?s=sek'), envC).then(r => r.json());
  const збережено = DB['secrets/novapay'].public_certificate.stringValue;
  DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
  const c2 = await w2.fetch(new Request('https://w.test/novapay/poll?s=sek'), envC).then(r => r.json());
  DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
  calls.length = 0;
  const c3 = await w3.fetch(new Request('https://w.test/novapay/poll?s=sek'), envC).then(r => r.json());
  const входи = calls.filter(c => c.action === 'UserAuthenticationJWT').length;
  ok(!/&#x/i.test(збережено) && /\r\n/.test(збережено), 'сертифікат з відповіді збережено розкодованим (CRLF, без «&#xD;»)', JSON.stringify(збережено));
  ok(c1.ok && c2.ok && c3.ok && входи === 1 && DB['secrets/novapay'].static.booleanValue === false,
    'другий і третій вхід — збереженим ключем з першої спроби, ключ крутиться далі', JSON.stringify([c1.error, c2.error, c3.error, входи]));
  /* Уже зіпсований у базі (як 05–07.10) — чиститься при читанні. */
  const w4 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 24))).default;
  DB['secrets/novapay'].public_certificate = sv(validCert.replace(/\r/g, '&#xD;'));
  DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
  calls.length = 0;
  const c4 = await w4.fetch(new Request('https://w.test/novapay/poll?s=sek'), envC).then(r => r.json());
  ok(c4.ok && calls.filter(c => c.action === 'UserAuthenticationJWT').length === 1,
    'сертифікат, збережений з «&#xD;» (як зараз у базі), — розкодовується, вхід з першої спроби', JSON.stringify([c4.error, c4.кроки]).slice(0, 300));
  crCert = false; validCert = '';
}

console.log('');
console.log('═══ КЛЮЧ ІЗ КАБІНЕТУ БАГАТОРАЗОВИЙ ═══');
/* 08.10: як справжня NovaPay — ключ із кабінету живе свій строк, а ключ із
   відповіді наступного разу не приймають. Воркер має сам перейти на ключ
   із секрету й далі ходити тільки ним. */
{
  const fs1 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 11))).default;
  const fs2 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 12))).default;
  const fs3 = (await import(path.join(ROOT, 'worker/money.js') + '?t=' + (Date.now() + 13))).default;
  staticKey = true; valid = 'CAB-KEY';
  const envS = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'CAB-KEY', NOVAPAY_CERT: 'CAB-CERT' });
  const r1 = await fs1.fetch(new Request('https://w.test/novapay/poll?s=sek'), envS).then(r => r.json());
  DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
  const r2 = await fs2.fetch(new Request('https://w.test/novapay/poll?s=sek'), envS).then(r => r.json());
  DB['secrets/novapay'].until = sv(new Date(Date.now() - 1000).toISOString());
  calls.length = 0;
  const r3 = await fs3.fetch(new Request('https://w.test/novapay/poll?s=sek'), envS).then(r => r.json());
  const входи3 = calls.filter(c => c.action === 'UserAuthenticationJWT').length;
  ok(r1.ok && r2.ok && /пробую: ключ із секрету/.test(JSON.stringify(r2.кроки)) && DB['secrets/novapay'].static.booleanValue === true,
    'збережений ключ не прийняли — воркер сам увійшов ключем із секрету й запамʼятав це', JSON.stringify([r1.error, r2.error, r2.кроки]).slice(0, 300));
  ok(r3.ok && входи3 === 1, 'далі — одразу ключем із секрету, без зайвої відмови', 'входів: ' + входи3 + ' · ' + r3.error);
  staticKey = false;
}

console.log('');
console.log('═══ ДОГНАТИ ПРОПУЩЕНІ ДНІ ═══');
/* Ключ не пускали тиждень — виписку беремо від останнього вдалого прогону
   (з запасом у добу), а не лише за 3 дні: інакше рухи між загубились би. */
const дата = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
DB['loomiq/novapayOk'] = { at: sv(new Date(Date.now() - 7 * 864e5).toISOString()) };
calls.length = 0;
await fresh4.fetch(new Request('https://w.test/novapay/poll?s=sek'), Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'NEW-KEY-2', NOVAPAY_CERT: 'NEW-CERT' })).then(r => r.json());
const ex8 = calls.filter(c => c.action === 'GetAccountExtract')[0];
const від8 = ex8 && (/<tem:date_from>([^<]*)</.exec(ex8.body) || [])[1];
ok(від8 === дата(new Date(Date.now() - 8 * 864e5)) && DB['loomiq/novapayOk'] && Date.parse(DB['loomiq/novapayOk'].at.stringValue) > Date.now() - 60000,
  'після перерви виписка — від останнього вдалого прогону (−1 доба), і мітку оновлено', 'від: ' + від8);

console.log('');
console.log('═══ ВИВЕДЕНЕ НА СВОЮ КАРТКУ ═══');
/* Особисту картку NovaPay API не віддає, але переказ на неї видно у виписці
   ФОП. Немає рахунку з її IBAN — poll підказує IBAN; є («NovaPay · картка
   фізособи») — переказ лягає туди дзеркалом, між своїми. */
{
  const КАРТКА = 'UA789358710000067406000279221';
  const envK = Object.assign({}, env, { NOVAPAY_REFRESH_TOKEN: 'NEW-KEY-2', NOVAPAY_CERT: 'NEW-CERT' });
  const k1 = await fresh4.fetch(new Request('https://w.test/novapay/poll?s=sek'), envK).then(r => r.json());
  const підказка = ((k1.novapay || [])[0] || {}).картка_без_рахунку || [];
  const accs = DB['loomiq/photos'].fin.mapValue.fields.accounts.arrayValue.values;
  accs.push({ mapValue: { fields: { id: sv('npc1'), bank: sv('novapaycard'), iban: sv('UA78 9358710000067406000279221'), name: sv('Картка NovaPay') } } });
  const k2 = await fresh4.fetch(new Request('https://w.test/novapay/poll?s=sek'), envK).then(r => r.json());
  const дз = DB['payments/novapay_58194299_in'] || {};
  ok(підказка.indexOf(КАРТКА) >= 0, 'переказ собі на рахунок поза Фінансами — poll підказує IBAN картки', JSON.stringify(k1).slice(0, 300));
  ok(дз.acc && дз.acc.stringValue === 'npc1' && дз.amount.doubleValue === 1000 && дз.flow.stringValue === 'self' &&
     ((k2.novapay || [])[0] || {}).виведено_на_картку === 1,
    'з рахунком «NovaPay · картка фізособи» переказ лягає на картку надходженням 1000, між своїми', JSON.stringify(дз));
  ok(!DB['payments/novapay_58190001_in'] && !DB['payments/novapay_58236056_in'], 'чужі витрати й пул на картку не дзеркаляться', 'зайве дзеркало');
  accs.pop();
}

console.log('');
console.log('═══ /novapay/probe ═══');
const pr = await call('/novapay/probe?s=sek');
ok(pr.ok && pr.рахунки[0].id === '49' && pr.виписка_рухи[0].Amount === '50000.00' && /реєстру/.test(pr.виписка_рухи[0].Purpose),
  'probe показує рахунки й розібрані рухи виписки (сума, призначення)', 'probe: ' + JSON.stringify(pr).slice(0, 300));
const no = await call('/novapay/probe?s=wrong');
ok(no.ok === false, 'без секрету — немає доступу', 'probe відкритий');

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'NovaPay: ключ крутиться без втрат, залишок — від NovaPay');
process.exit(bad ? 1 : 0);
