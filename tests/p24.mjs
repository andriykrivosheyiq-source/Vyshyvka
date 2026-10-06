/* Картка Приват24 фізособи у Фінансах (06.10).

   Андрій: «привʼяжемо ще звичайну картку Зеленої Ірини, окрім Приват ФОП:
   ми туди виводимо кошти з ФОП, щоб заплатити співробітникам».
   «Автоклієнт» бачить лише ФОП — картка йде через «Мерчант Приват24».

   Перевіряємо (на підставному Приват24):
     — MD5 свій (у Workers його немає) — збігається з node:crypto;
     — підпис запиту = sha1(md5(<data> + пароль)) — як вимагає Приват24;
     — рух виписки → платіж: знак, київський час, стійкий id, залишок після;
     — /poll пише рухи й залишок картки; без секретів — зрозуміло, що бракує;
     — /p24/probe — сира виписка; без HOOK_SECRET — немає доступу;
     — помилку Приват24 видно словами.

   Запуск:  node tests/p24.mjs      (з кореня репозиторію)  */
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_PROJECT: 'test',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type:'pkcs8', format:'pem' }) }),
  HOOK_SECRET: 'sek', PRIVAT24_ID_card1: '75482', PRIVAT24_PASS_card1: 'pa55', PRIVAT24_CARD_card1: '5168 7420 6022 1193'
};
const sv = v => ({ stringValue: v });
const DB = {};
DB['loomiq/photos'] = { fin: { mapValue: { fields: { accounts: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('card1'), bank: sv('privat24'), name: sv('Картка Ірини') } } },
  { mapValue: { fields: { id: sv('card2'), bank: sv('privat24'), name: sv('Без секретів') } } } ] } } } } } };
const reqs = [];
let fail = '';
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status || 200 });
  if(url.startsWith('https://oauth2.googleapis.com/token')) return res({ access_token:'tok', expires_in:3600 });
  if(url.startsWith('https://api.privatbank.ua/p24api/')){
    const body = String(opt.body); reqs.push({ url, body });
    if(fail) return res('<?xml version="1.0"?><response version="1.0"><data><error message="' + fail + '"/></data></response>');
    if(/rest_fiz/.test(url)) return res('<?xml version="1.0" encoding="UTF-8"?><response version="1.0"><merchant><id>75482</id><signature>x</signature></merchant><data><oper>cmt</oper><info>' +
      '<statements status="excellent" credit="7500.0" debet="2000.0">' +
      '<statement card="5168742060221193" appcode="991124" trandate="2026-10-05" trantime="14:17:00" amount="7500.00 UAH" cardamount="7500.00 UAH" rest="7612.40 UAH" terminal="ФОП Зелена Ірина" description="Переказ з рахунку ФОП"/>' +
      '<statement card="5168742060221193" appcode="991125" trandate="2026-10-05" trantime="15:02:00" amount="2000.00 UAH" cardamount="-2000.00 UAH" rest="5612.40 UAH" terminal="P24" description="Переказ на картку Оля К."/>' +
      '</statements></info></data></response>');
    if(/balance/.test(url)) return res('<?xml version="1.0"?><response version="1.0"><data><oper>cmt</oper><info><cardbalance><card><account>5168742060221193</account></card><av_balance>5612.40</av_balance><balance>5612.40</balance></cardbalance></info></data></response>');
  }
  const m = /documents\/([^?]+)/.exec(url);
  if(url.endsWith('documents:commit')){
    for(const w of JSON.parse(opt.body).writes){ const p = w.update.name.split('/documents/')[1];
      DB[p] = DB[p] || {}; w.updateMask.fieldPaths.forEach(k => { DB[p][k] = w.update.fields[k]; }); }
    return res({});
  }
  if(m){
    const p = decodeURIComponent(m[1]);
    if((opt.method || 'GET') === 'GET') return DB[p] ? res({ fields: DB[p] }) : res({ error:'nf' }, 404);
    const b = JSON.parse(opt.body);
    const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(x => decodeURIComponent(x[1]));
    DB[p] = DB[p] || {}; mask.forEach(k => { DB[p][k] = b.fields[k]; });
    return res({});
  }
  return res({}, 404);
};
const mod = await import(path.join(ROOT, 'worker/money.js') + '?t=' + Date.now());
const { _pure } = mod, worker = mod.default;
const call = pth => worker.fetch(new Request('https://w.test' + pth), env).then(r => r.json());

console.log('═══ ПІДПИС ═══');
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const samples = ['', 'a', 'abc', 'message digest', '<oper>cmt</oper>Ірина', 'x'.repeat(200)];
ok(samples.every(s => _pure.md5hex(s) === md5(s)), 'свій MD5 збігається з node:crypto (зокрема кирилиця й довгі рядки)', 'MD5: ' + samples.map(s => _pure.md5hex(s) === md5(s)).join());

console.log('');
console.log('═══ /poll — РУХИ Й ЗАЛИШОК ═══');
const p1 = await call('/poll?s=sek');
console.log('   ' + JSON.stringify(p1.privat24));
const r0 = reqs.find(r => /rest_fiz/.test(r.url));
const data = /<data>(.*)<\/data>/.exec(r0.body)[1];
const sign = /<signature>([0-9a-f]+)<\/signature>/.exec(r0.body)[1];
ok(sign === crypto.createHash('sha1').update(md5(data + 'pa55')).digest('hex') && /<id>75482<\/id>/.test(r0.body) && /name="card" value="5168742060221193"/.test(r0.body),
  'запит виписки: ID мерчанта, номер картки без пробілів, підпис sha1(md5(data + пароль))', 'запит: ' + r0.body.slice(0, 300));
const pays = Object.keys(DB).filter(k => /^payments\/p24_/.test(k)).map(k => ({ id: k, f: DB[k] }));
const inn = pays.find(x => +x.f.amount.doubleValue > 0), out = pays.find(x => +x.f.amount.doubleValue < 0);
ok(pays.length === 2 && inn && +inn.f.amount.doubleValue === 7500 && inn.f.src.stringValue === 'privat' && inn.f.acc.stringValue === 'card1' &&
   inn.f.at.stringValue === '2026-10-05T11:17:00.000Z' && +inn.f.balAfter.doubleValue === 7612.4 && /Зелена/.test(inn.f.counter.stringValue),
  'надходження з ФОП: +7 500 ₴, 14:17 за Києвом, залишок після 7 612,40', 'надходження: ' + JSON.stringify(inn));
ok(out && +out.f.amount.doubleValue === -2000 && /Оля/.test(out.f.desc.stringValue), 'виплата співробітнику: −2 000 ₴ з призначенням', 'витрата: ' + JSON.stringify(out));
const bal = ((DB['loomiq/bankBal'] || {}).card1 || {}).mapValue;
ok(bal && +bal.fields.bal.doubleValue === 5612.4, 'залишок картки від Привату — 5 612,40 ₴', 'залишок: ' + JSON.stringify(bal));
const c2 = (p1.privat24 || []).find(x => x.acc === 'card2');
ok(c2 && /PRIVAT24_ID_card2/.test(c2.skip), 'рахунок без секретів — сказано, яких саме бракує', 'card2: ' + JSON.stringify(c2));
const n0 = pays.length;
await call('/poll?s=sek');
ok(Object.keys(DB).filter(k => /^payments\/p24_/.test(k)).length === n0, 'повторний прогін не дублює рухи (стійкий id)', 'дубль');
console.log('');
console.log('═══ /p24/probe ═══');
const pr = await call('/p24/probe/card1?s=sek');
ok(pr.ok && pr.рухи_сирі.length === 2 && pr.рухи_сирі[0].cardamount === '7500.00 UAH', 'probe — сирі рухи виписки', 'probe: ' + JSON.stringify(pr).slice(0, 200));
ok((await call('/p24/probe/card1?s=no')).ok === false, 'без секрету — немає доступу', 'probe відкритий');
fail = 'invalid signature';
const pe = await call('/p24/probe/card1?s=sek');
ok(!pe.ok && /Приват24: invalid signature/.test(pe.error), 'помилка Приват24 — словами: «' + pe.error + '»', 'помилка: ' + JSON.stringify(pe));

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'картка Приват24 фізособи — рухи й залишок у Фінансах');
process.exit(bad ? 1 : 0);
