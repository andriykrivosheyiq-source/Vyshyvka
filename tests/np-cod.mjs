/* КОНТРОЛЬ ОПЛАТИ ПО КОЖНОМУ ФОПУ (21.10). Андрій: «надалі буде 2–3 ФОПи…
   головне, щоб контроль оплати фіксувався і гроші реально приходили».

   Доти воркер грошей питав Нову пошту ОДНИМ ключем — накладні другого
   ФОПа він не бачив би зовсім. Тепер відправники беруться з адмінки
   (Налаштування → Відправка), кожен опитується своїм ключем NP_KEY_<код>,
   рух знає свого ФОПа і лягає на його рахунок НП; немає ключа — помилка
   на видноті (bankSync np_<код>), а не тиша.

   Запуск:  node tests/np-cod.mjs      (з кореня репозиторію)  */
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_PROJECT: 'test',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type:'pkcs8', format:'pem' }) }),
  HOOK_SECRET: 'sek', NP_KEY_yukalchuk: 'KEY-Y'          // у maleeva ключа немає — навмисно
};
const sv = v => ({ stringValue: v });
const DB = {};
DB['loomiq/photos'] = {
  fin: { mapValue: { fields: { accounts: { arrayValue: { values: [
    { mapValue: { fields: { id: sv('np1'), bank: sv('np'), name: sv('НП · Юкальчук'), sender: sv('yukalchuk') } } },
    { mapValue: { fields: { id: sv('np2'), bank: sv('np'), name: sv('НП · Малєєва'), sender: sv('maleeva') } } } ] } } } } },
  ship: { mapValue: { fields: { senders: { arrayValue: { values: [
    { mapValue: { fields: { id: sv('yukalchuk'), name: sv('ФОП Юкальчук') } } },
    { mapValue: { fields: { id: sv('maleeva'), name: sv('ФОП Малєєва') } } } ] } } } } } };
/* Нова пошта: у кожного ключа — свої накладні. */
const NP_DOCS = { 'KEY-Y': ['20450000000101', '20450000000102'], 'KEY-M': ['20450000000201'] };
const NP_ST = {
  '20450000000101': { Number:'20450000000101', StatusCode:'9', Status:'Відправлення отримано', AfterpaymentOnGoodsCost:'1580', RecipientDateTime:'20.10.2026 14:05:00', RecipientFullName:'Мороз Євгенія' },
  '20450000000102': { Number:'20450000000102', StatusCode:'7', Status:'Прибув у відділення', AfterpaymentOnGoodsCost:'900' },
  '20450000000201': { Number:'20450000000201', StatusCode:'9', Status:'Відправлення отримано', AfterpaymentOnGoodsCost:'700', RecipientDateTime:'20.10.2026 11:00:00' }
};
const reqs = [];
let fail = '';
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status || 200 });
  if(url.startsWith('https://oauth2.googleapis.com/token')) return res({ access_token:'tok', expires_in:3600 });
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body); reqs.push(b);
    if(fail) return res({ success:false, errors:[fail] });
    if(!NP_DOCS[b.apiKey]) return res({ success:false, errors:['API key is invalid'] });
    if(b.calledMethod === 'getDocumentList') return res({ success:true, data: NP_DOCS[b.apiKey].map(t => ({ IntDocNumber: t })) });
    if(b.calledMethod === 'getStatusDocuments') return res({ success:true, data: (b.methodProperties.Documents || []).map(d => NP_ST[d.DocumentNumber]).filter(Boolean) });
    return res({ success:true, data:[] });
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
const pay = id => DB['payments/' + id];
const fld = (f, k) => f && f[k] && (f[k].stringValue !== undefined ? f[k].stringValue : f[k].doubleValue);

console.log('═══ 1. ДВА ФОПИ — КОЖЕН СВОЇМ КЛЮЧЕМ ═══');
const p1 = await call('/poll?s=sek');
console.log('   np: ' + JSON.stringify(p1.np));
const keys = reqs.map(r => r.apiKey);
ok(keys.includes('KEY-Y') && !keys.includes('KEY-M') && !keys.includes(undefined),
  'Нову пошту питали ключем Юкальчука; Малєєву без ключа не питали взагалі (і не чужим ключем)', 'ключі в запитах: ' + JSON.stringify([...new Set(keys)]));
const y = (p1.np || []).find(x => x.sender === 'yukalchuk'), m = (p1.np || []).find(x => x.sender === 'maleeva');
ok(y && y.acc === 'np1' && y.контроль_оплати && y.контроль_оплати.отримано === 1 && y.контроль_оплати.сума === 1580,
  'Юкальчук: 1 посилка забрана → 1 контроль оплати на 1 580 ₴, рахунок np1', 'Юкальчук: ' + JSON.stringify(y));
ok(m && /NP_KEY_maleeva/.test(m.skip || ''), 'Малєєва без секрета — сказано, якого саме бракує', 'Малєєва: ' + JSON.stringify(m));

console.log('');
console.log('═══ 2. РУХ ЗНАЄ СВОГО ФОПА Й РАХУНОК ═══');
const c = pay('npc_20450000000101');
ok(c && fld(c, 'amount') === 1580 && fld(c, 'src') === 'np' && fld(c, 'acc') === 'np1' && fld(c, 'ttn') === '20450000000101' && fld(c, 'sender') === 'yukalchuk',
  'рух npc_<ТТН>: 1 580 ₴, src np, рахунок np1, ТТН і відправник yukalchuk — адмінка привʼяже до замовлення за ТТН', 'рух: ' + JSON.stringify(c));
ok(!pay('npc_20450000000102'), 'посилка «прибула у відділення», ще не забрана — руху немає (грошей ще немає)', 'рух за незабрану посилку');
ok(!pay('npc_20450000000201'), 'накладної Малєєвої без її ключа не видно — і руху немає (а не рух на чужий рахунок)', 'чужий рух');

console.log('');
console.log('═══ 3. СТАН ПОСИЛОК І СТАН КЛЮЧІВ — НА ВИДНОТІ ═══');
const st = DB['loomiq/npState'] || {};
const s101 = st.t20450000000101 && st.t20450000000101.mapValue.fields, s102 = st.t20450000000102 && st.t20450000000102.mapValue.fields;
ok(s101 && fld(s101, 'code') === '9' && fld(s101, 'cod') === 1580 && fld(s101, 'sender') === 'yukalchuk' && s102 && fld(s102, 'code') === '7',
  'npState: обидві посилки з контролем оплати, зі станом і ФОПом — Звірка бачить «забрали, а грошей немає»', 'npState: ' + JSON.stringify(Object.keys(st)));
const bs = DB['loomiq/bankSync'] || {};
const ky = bs.np_yukalchuk && bs.np_yukalchuk.mapValue.fields, km = bs.np_maleeva && bs.np_maleeva.mapValue.fields;
ok(ky && ky.ok.booleanValue === true && fld(ky, 'n') === 1, 'bankSync np_yukalchuk: ключ працює, 1 рух', 'np_yukalchuk: ' + JSON.stringify(ky));
ok(km && km.ok.booleanValue === false && /NP_KEY_maleeva/.test(fld(km, 'skip') || ''), 'bankSync np_maleeva: немає секрета — видно в Налаштуваннях біля відправника', 'np_maleeva: ' + JSON.stringify(km));
const a1 = bs.np1 && bs.np1.mapValue.fields, a2 = bs.np2 && bs.np2.mapValue.fields;
ok(a1 && a1.ok.booleanValue === true && a2 && a2.ok.booleanValue === false,
  'рахунок НП Юкальчука у Фінансах — ок, рахунок Малєєвої — «не підключено»', 'рахунки: ' + JSON.stringify({ a1, a2 }));

console.log('');
console.log('═══ 4. ПОВТОР НЕ ДУБЛЮЄ; ПРОТЕРМІНОВАНИЙ КЛЮЧ — ПОМИЛКА, НЕ ТИША ═══');
const n0 = Object.keys(DB).filter(k => /^payments\//.test(k)).length;
await call('/poll?s=sek');
ok(Object.keys(DB).filter(k => /^payments\//.test(k)).length === n0, 'повторний прогін не дублює рухи (стійкий id npc_<ТТН>)', 'дубль');
env.NP_KEY_maleeva = 'KEY-M';
const p3 = await call('/poll?s=sek');
const m3 = (p3.np || []).find(x => x.sender === 'maleeva');
ok(m3 && m3.контроль_оплати.отримано === 1 && pay('npc_20450000000201') && fld(pay('npc_20450000000201'), 'acc') === 'np2' && fld(pay('npc_20450000000201'), 'sender') === 'maleeva',
  'додали секрет Малєєвої — її контроль оплати 700 ₴ зʼявився на її рахунку np2, без перерозгортання', 'Малєєва з ключем: ' + JSON.stringify(m3));
env.NP_KEY_yukalchuk = 'KEY-OLD';
const p4 = await call('/poll?s=sek');
const y4 = (p4.np || []).find(x => x.sender === 'yukalchuk');
const ky4 = DB['loomiq/bankSync'].np_yukalchuk.mapValue.fields;
ok(y4 && /API key is invalid/.test(y4.error || '') && ky4.ok.booleanValue === false && /invalid/.test(fld(ky4, 'error')),
  'ключ Юкальчука не приймається — помилка словами Нової пошти в bankSync, інший ФОП опитаний далі', 'протермінований: ' + JSON.stringify(y4));

console.log('');
console.log('═══ 5. ОДИН ФОП БЕЗ ВІДПРАВНИКІВ — СТАРИЙ ШЛЯХ ЖИВИЙ ═══');
delete DB['loomiq/photos'].ship;
env.NP_API_KEY = 'KEY-Y'; env.NP_KEY_yukalchuk = 'KEY-Y';
const p5 = await call('/poll?s=sek');
ok(p5.np && !Array.isArray(p5.np) && p5.np.контроль_оплати && p5.np.контроль_оплати.отримано === 1,
  'відправників в адмінці немає — працює NP_API_KEY, як було', 'старий шлях: ' + JSON.stringify(p5.np));

console.log('');
console.log('═══ 6. ЧИСТІ ПРАВИЛА ═══');
ok(_pure.npAccFor([{ id:'np1', bank:'np', sender:'a' }, { id:'np2', bank:'np', sender:'b' }], 'b') === 'np2' &&
   _pure.npAccFor([{ id:'np1', bank:'np' }], 'b') === 'np1' && _pure.npAccFor([], 'b', 'x') === 'x',
  'рахунок НП для ФОПа: свій → перший НП → запасний', 'npAccFor');
ok(_pure.senderCode('ФОП yukalchuk-1!') === 'yukalchuk1', 'код відправника — лише латиниця, цифри й _', 'senderCode');

console.log('');
console.log(bad ? 'розходжень: ' + bad + ' — КОНТРОЛЬ ОПЛАТИ ПО ФОПАХ ЗЛАМАНО' : 'контроль оплати фіксується по кожному ФОПу своїм ключем');
process.exit(bad ? 1 : 0);
