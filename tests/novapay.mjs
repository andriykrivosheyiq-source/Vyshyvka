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
const DB = {};
DB['loomiq/photos'] = { fin: { mapValue: { fields: { accounts: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('np1'), bank: sv('np'), iban: sv('UA29 358710 0000673200 000000190'), name: sv('NovaPay') } } } ] } } } } } };

const soap = (method, inner) => '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><' + method +
  'Response xmlns="http://tempuri.org/"><' + method + 'Result>' + inner + '</' + method + 'Result></' + method + 'Response></s:Body></s:Envelope>';
let valid = 'RT-0', n = 0;
const calls = [];
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
      if(get('refresh_token') !== valid || get('login') !== 'andriy')
        return res(soap(action, '<request_ref>x</request_ref><error><code>logic_error</code><message>Refresh token expired</message></error>'));
      n++; valid = 'RT-' + n;
      return res(soap(action, '<request_ref>x</request_ref><response_ref>y</response_ref><jwt>JWT-' + n + '</jwt><expiration>' +
        new Date(Date.now() + 30 * 60000).toISOString() + '</expiration><refresh_token>' + valid + '</refresh_token><public_certificate>CERT-' + n + '</public_certificate>'));
    }
    if(!/^JWT-/.test(get('jwt'))) return res(soap(action, '<error><message>jwt invalid</message></error>'));
    if(action === 'GetClientsList') return res(soap(action, '<result>ok</result><clients><Clients><id>8</id><name>ФОП Кривошей</name></Clients></clients>'));
    if(action === 'GetAccountsList') return res(soap(action, '<result>ok</result><accounts><Accounts><id>49</id><IBAN>UA293587100000673200000000190</IBAN><name>ФОП Кривошей</name><currency>UAH</currency><statuscode>Active</statuscode></Accounts></accounts>'));
    if(action === 'GetAccountRest') return res(soap(action, '<result>ok</result><confirmed_balance>6593.5800</confirmed_balance><available_balance>6582.3100</available_balance>'));
    if(action === 'GetAccountExtract') return res(soap(action, '<result>ok</result><extract>&lt;Extract&gt;&lt;Docs Amount="50000.00" CurrencyTag="UAH"&gt;&lt;OrgDate&gt;05.10.2026&lt;/OrgDate&gt;&lt;CreditName&gt;ФОП Кривошей&lt;/CreditName&gt;&lt;Purpose&gt;Виплата післяплати&lt;/Purpose&gt;&lt;/Docs&gt;&lt;/Extract&gt;</extract>'));
    return res(soap(action, '<error><message>?</message></error>'));
  }
  const m = /documents\/([^?]+)/.exec(url);
  if(m){
    const p = decodeURIComponent(m[1]);
    if((opt.method || 'GET') === 'GET') return DB[p] ? res({ fields: DB[p] }) : res({ error:'nf' }, 404);
    const b = JSON.parse(opt.body);
    const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(x => decodeURIComponent(x[1]));
    DB[p] = DB[p] || {}; mask.forEach(k => { DB[p][k] = b.fields[k]; });
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
ok(order.indexOf('FS secrets/novapay') === order.indexOf('UserAuthenticationJWT') + 1,
  'ключ зберігається одразу після входу — до будь-якого іншого запиту', 'порядок: ' + order.join(' → '));
const bal = ((DB['loomiq/bankBal'] || {}).np1 || {}).mapValue;
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
console.log('═══ /novapay/probe ═══');
const pr = await call('/novapay/probe?s=sek');
ok(pr.ok && pr.рахунки[0].id === '49' && pr.виписка_рухи[0].Amount === '50000.00' && pr.виписка_рухи[0].Purpose === 'Виплата післяплати',
  'probe показує рахунки й розібрані рухи виписки (сума, призначення)', 'probe: ' + JSON.stringify(pr).slice(0, 300));
const no = await call('/novapay/probe?s=wrong');
ok(no.ok === false, 'без секрету — немає доступу', 'probe відкритий');

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'NovaPay: ключ крутиться без втрат, залишок — від NovaPay');
process.exit(bad ? 1 : 0);
