/* Грошовий воркер: залишок від банку й копійки — наскрізно, з підставними
   Монобанком, Приватом і Firestore.

   Що перевіряємо:
     — рух Монобанку пишеться з копійками і з залишком після руху (balAfter);
     — залишок Монобанку лягає в loomiq/bankBal саме тому рахунку Фінансів;
     — старіший вебхук, що прийшов пізніше, НЕ затирає свіжіший залишок;
     — підключення (/mono/setup) одразу пише залишок із client-info;
     — опитування Привату пише рухи з копійками й залишок із balances[];
     — Приват не віддав залишок — рухи все одно пишуться, залишок не вигадується;
     — /privat/balance/<acc> показує сирий відгук банку.

   Запуск:  node tests/money-balance.mjs      (з кореня репозиторію)  */
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  FIREBASE_PROJECT: 'test',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type:'pkcs8', format:'pem' }) }),
  HOOK_SECRET: 'sek',
  MONO_TOKEN_mono1: 'mt',
  PRIVAT_TOKEN_mono3: 'pt',
  NP_API_KEY: 'npk'
};

/* ── Підставний світ ──────────────────────────────────────────────────── */
const DB = {};                 // шлях → { поле: значення Firestore }
const npCalls = []; let npDeny = 1;
const writes = [];
let privatBal = { status:'SUCCESS', balances:[
  { acc:'UA111', balanceOut:'4980.10', dpd:'02.10.2026 00:00:00' },
  { acc:'UA111', balanceOut:'5123.45', dpd:'03.10.2026 00:00:00' },
  { acc:'UA999', balanceOut:'1.00',    dpd:'04.10.2026 00:00:00' } ] };
const sv = v => ({ stringValue: v });
DB['loomiq/photos'] = { fin: { mapValue: { fields: { accounts: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('mono1'), bank: sv('mono'), iban: sv('UA 222'), name: sv('Моно ФОП') } } },
  { mapValue: { fields: { id: sv('mono3'), bank: sv('privat'), iban: sv('UA111'), name: sv('Приват ФОП') } } }
] } } } } } };
DB['loomiq/monoMap'] = { mono1: sv('monoAcc1') };

globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(JSON.stringify(body), { status: status || 200 });
  if(url.startsWith('https://oauth2.googleapis.com/token')) return res({ access_token:'tok', expires_in:3600 });
  const m = /documents\/([^?]+)/.exec(url);
  if(m){
    const p = decodeURIComponent(m[1]);
    if((opt.method || 'GET') === 'GET') return DB[p] ? res({ fields: DB[p] }) : res({ error:'nf' }, 404);
    const body = JSON.parse(opt.body);
    const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(x => decodeURIComponent(x[1]));
    DB[p] = DB[p] || {};
    mask.forEach(k => { DB[p][k] = body.fields[k]; });
    writes.push({ p, fields: body.fields });
    return res({});
  }
  if(url.includes('/personal/client-info'))
    return res({ accounts: [ { id:'monoAcc1', iban:'UA222', balance: 5257235, type:'fop' },
                             { id:'personal', iban:'UA333', balance: 100, type:'black' } ] });
  if(url.includes('/personal/webhook')) return new Response('');
  if(url.startsWith('https://acp.privatbank.ua/api/statements/transactions'))
    return res({ status:'SUCCESS', transactions: [
      { REF:'R1', SUM:'1500.55', TRANTYPE:'C', DATE_TIME_DAT_OD_TIM_P:'03.10.2026 10:00:00', AUT_CNTR_NAM:'ТОВ Ромашка', OSND:'Оплата' },
      { REF:'R2', SUM:'320.20',  TRANTYPE:'D', DATE_TIME_DAT_OD_TIM_P:'03.10.2026 11:00:00', AUT_CNTR_NAM:'Постачальник', OSND:'Тканина' } ] });
  if(url.startsWith('https://acp.privatbank.ua/api/statements/balance')) return res(privatBal);
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body);
    npCalls.push(Date.now());
    /* Перший запит до НП — відмова за частотою, як 03.10. */
    if(npDeny > 0){ npDeny--; return res({ success:false, errors:['To many requests'], data:[] }); }
    if(b.calledMethod === 'getDocumentList'){
      /* 130 накладних за місяць: сторінка 1 — 100, сторінка 2 — 30. */
      const page = +b.methodProperties.Page || 1;
      const from = (page - 1) * 100, to = Math.min(130, page * 100);
      const data = [];
      for(let i = from; i < to; i++) data.push({ IntDocNumber: String(20450000000000 + i) });
      return res({ success:true, data });
    }
    if(b.calledMethod === 'getStatusDocuments')
      return res({ success:true, data: b.methodProperties.Documents.map(d => {
        const n = d.DocumentNumber, k = +n.slice(-3);
        if(k === 105) return { Number:n, Status:'Відправлення отримано', RedeliverySum:'1500.50',
          AmountPaid:'1500.50', MoneyTransferNumber:'TR77', PaymentStatusDate:'02.10.2026 12:00:00',
          PaymentStatus:'Виплачено', RecipientFullName:'Олена' };
        /* Контроль оплати: 110 — отримано (2 080), 111 — відмова, 112 — ще в дорозі. */
        if(k === 110) return { Number:n, StatusCode:'9', Status:'Відправлення отримано', AfterpaymentOnGoodsCost:2080,
          RecipientDateTime:'28.09.2026 08:34:37', RecipientFullName:'Мороз  Євгенія', LastAmountTransferGM:'' };
        if(k === 111) return { Number:n, StatusCode:'102', Status:'Відмова від отримання', AfterpaymentOnGoodsCost:1500 };
        if(k === 112) return { Number:n, StatusCode:'7', Status:'Прибув у відділення', AfterpaymentOnGoodsCost:990 };
        if(k === 107) return { Number:n, Status:'Відправлення отримано', RedeliverySum:'640', PaymentStatus:'PAYED' };
        if(k % 10 === 0) return { Number:n, Status:'Відправлення отримано', RedeliverySum:'800', PaymentStatus:'' };
        return { Number:n, Status:'Відправлення отримано' };
      }) });
    return res({ success:true, data:[] });
  }
  throw new Error('неочікуваний запит ' + url);
};

const worker = (await import(path.join(ROOT, 'worker/money.js'))).default;
const call = (pth, method, body) => worker.fetch(new Request('https://w.test' + pth,
  { method: method || 'GET', body: body ? JSON.stringify(body) : undefined }), env).then(r => r.json());
const num = f => f ? (f.doubleValue !== undefined ? f.doubleValue : +f.integerValue) : undefined;
const bb = acc => {
  const f = DB['loomiq/bankBal'] && DB['loomiq/bankBal'][acc];
  if(!f) return null;
  const x = f.mapValue.fields;
  return { bal: num(x.bal), at: x.at.stringValue, src: x.src.stringValue };
};

console.log('═══ МОНОБАНК: ПІДКЛЮЧЕННЯ ОДРАЗУ ДАЄ ЗАЛИШОК ═══');
const su = await call('/mono/setup/mono1?s=sek');
ok(su.ok, 'підключення пройшло', 'підключення впало: ' + JSON.stringify(su));
ok(bb('mono1') && bb('mono1').bal === 52572.35 && bb('mono1').src === 'mono',
  'залишок рахунку ФОПа з client-info — 52 572,35, а не особистої картки',
  'залишку після підключення немає або не той: ' + JSON.stringify(bb('mono1')));

console.log('');
console.log('═══ МОНОБАНК: РУХ З КОПІЙКАМИ Й ЗАЛИШКОМ ПІСЛЯ ═══');
const t1 = Math.floor(Date.now() / 1000) + 60;
const w1 = await call('/mono/mono1?s=sek', 'POST', { type:'StatementItem', data:{ account:'monoAcc1',
  statementItem:{ id:'tx1', time: t1, amount: 150055, balance: 5407290, description:'Оплата', counterName:'Іван' } } });
const pay = DB['payments/mono_tx1'] || {};
ok(w1.written === 1 && num(pay.amount) === 1500.55,
  'сума руху з копійками — 1 500,55, а не 1 501', 'сума: ' + num(pay.amount));
ok(num(pay.balAfter) === 54072.9, 'у русі записано залишок після нього — 54 072,90', 'balAfter: ' + num(pay.balAfter));
ok(bb('mono1').bal === 54072.9, 'залишок рахунку оновився до 54 072,90', 'залишок: ' + JSON.stringify(bb('mono1')));
ok(!pay.orderId && !pay.tag, 'привʼязку й підпис воркер не чіпає', 'воркер записав orderId/tag');

/* Старіший рух прийшов після свіжішого — залишок не відкочується */
await call('/mono/mono1?s=sek', 'POST', { type:'StatementItem', data:{ account:'monoAcc1',
  statementItem:{ id:'tx0', time: t1 - 3600, amount: -10000, balance: 5257235, description:'Раніше' } } });
ok(bb('mono1').bal === 54072.9,
  'запізнілий старіший вебхук не затер свіжіший залишок',
  'старий вебхук відкотив залишок до ' + bb('mono1').bal);
ok(num((DB['payments/mono_tx0'] || {}).amount) === -100, 'а сам рух записано — з мінусом', 'старий рух не записано');

/* Особиста картка того ж токена — нічого не пишемо */
const before = writes.length;
await call('/mono/mono1?s=sek', 'POST', { type:'StatementItem', data:{ account:'personal',
  statementItem:{ id:'txp', time: t1, amount: -5000, balance: 1 } } });
ok(writes.length === before, 'рух особистої картки не пишеться ні в рухи, ні в залишок', 'особиста картка потрапила у Фінанси');

console.log('');
console.log('═══ ПРИВАТ: РУХИ З КОПІЙКАМИ Й ЗАЛИШОК ═══');
const po = await call('/poll?s=sek');
const pr = (po.privat || [])[0] || {};
console.log('   опитування: ' + JSON.stringify(pr));
ok(num((DB['payments/privat_R1'] || {}).amount) === 1500.55 && num((DB['payments/privat_R2'] || {}).amount) === -320.2,
  'рухи Привату з копійками й знаком', 'рухи: ' + JSON.stringify([DB['payments/privat_R1'], DB['payments/privat_R2']].map(x => x && num(x.amount))));
ok(bb('mono3') && bb('mono3').bal === 5123.45 && bb('mono3').src === 'privat',
  'залишок Привату — найсвіжіший день саме цього IBAN (5 123,45)', 'залишок: ' + JSON.stringify(bb('mono3')));
ok(pr.залишок === 5123.45, 'і опитування каже, який залишок прочитало', 'відповідь опитування: ' + JSON.stringify(pr));

/* Приват не віддав залишок — рухи є, залишок не вигадується */
privatBal = { status:'ERROR', message:'technical' };
const prevBal = bb('mono3');
const po2 = await call('/poll?s=sek');
ok(((po2.privat || [])[0] || {}).рухів === 2 && JSON.stringify(bb('mono3')) === JSON.stringify(prevBal),
  'банк не віддав залишок — рухи пишуться, а залишок лишається попереднім, не нуль',
  'без залишку: ' + JSON.stringify({ po2: po2.privat, bal: bb('mono3') }));

console.log('');
console.log('═══ НОВА ПОШТА: УСІ СТОРІНКИ НАКЛАДНИХ І ВИПЛАТА ═══');
const npo = po2.np || {};
console.log('   ' + JSON.stringify(npo));
ok(npo.накладних === 130, 'перевірено всі 130 накладних — обидві сторінки, а не перші 100',
  'накладних: ' + npo.накладних);
ok(npo.виплат === 1 && npo.сума === 1501 && num((DB['payments/np_TR77_20450000000105'] || {}).amount) === 1500.5,
  'виплачена наложка записана рухом — з копійками й номером переказу', 'виплати: ' + JSON.stringify(npo));
const ко = DB['payments/npc_20450000000110'] || {};
ok(npo.контроль_оплати && npo.контроль_оплати.отримано === 1 && npo.контроль_оплати.сума === 2080,
  'контроль оплати: отримана посилка — одна, 2 080 ₴; відмова й «у відділенні» не рахуються',
  'контроль оплати: ' + JSON.stringify(npo.контроль_оплати));
ok(num(ко.amount) === 2080 && (ко.ttn || {}).stringValue === '20450000000110' &&
   (ко.at || {}).stringValue === '2026-09-28T08:34:37.000Z' &&
   /NovaPay · Мороз Євгенія/.test((ко.counter || {}).stringValue || '') &&
   /ТТН 20450000000110/.test((ко.desc || {}).stringValue || ''),
  'рух записано: сума клієнта, дата отримання, хто, номер ТТН — за ним привʼяжеться замовлення',
  'рух не той: ' + JSON.stringify(ко));
ok(!DB['payments/npc_20450000000111'] && !DB['payments/npc_20450000000112'],
  'для відмови й не забраної посилки руху немає', 'зайві рухи для незабраних посилок');
ok((npo.виплачено_але_не_розпізнано || []).join() === '20450000000107',
  'накладна, яку НП називає виплаченою (PAYED), але без суми з переказом, — окремим списком для /np/probe',
  'виплачену без переказу не видно: ' + JSON.stringify(npo.виплачено_але_не_розпізнано));
ok(npo.з_наложкою === 17 && (npo.перевірити_через_probe || []).length === 5,
  'і видно, скільки накладних з наложкою та які ТТН перевірити через /np/probe',
  'підказки немає: ' + JSON.stringify(npo));

const gaps = npCalls.slice(1).map((t, i) => t - npCalls[i]);
ok(gaps.length && Math.min(...gaps) >= 1100,
  'між запитами до НП — пауза не менше секунди (ліміт частоти)', 'запити впритул: ' + JSON.stringify(gaps));
ok(gaps.some(g => g >= 4500),
  '«To many requests» — воркер почекав і повторив, а не здався', 'повтору не було: ' + JSON.stringify(gaps));

console.log('');
console.log('═══ РОЗКЛАД: НОВА ПОШТА — РАЗ НА ПІВ ГОДИНИ ═══');
const { _pure } = await import(path.join(ROOT, 'worker/money.js'));
const at = m => Date.UTC(2026, 9, 3, 12, m);
ok(_pure.npDue(at(0)) && _pure.npDue(at(4)) && !_pure.npDue(at(5)) && !_pure.npDue(at(25)) && _pure.npDue(at(30)),
  'з 5-хвилинного розкладу НП питаємо лише на :00 і :30', 'npDue не те');
const npBefore = npCalls.length;
let job = null;
await worker.scheduled({ scheduledTime: at(10) }, env, { waitUntil: p => { job = p; } });
await job;
ok(npCalls.length === npBefore, 'о :10 Нову пошту не питаємо — лише банки', 'НП питали поза своїм часом');

console.log('');
console.log('═══ ЩО КАЖЕ ПРИВАТ ПРО ЗАЛИШОК ═══');
privatBal = { status:'SUCCESS', balances:[{ acc:'UA111', balanceOut:'777.70', dpd:'03.10.2026 00:00:00' }] };
const raw = await call('/privat/balance/mono3?s=sek');
ok(raw.ok && raw.сире && raw.розібрано && raw.розібрано.bal === 777.7,
  '/privat/balance показує сирий відгук і розібране число', 'відповідь: ' + JSON.stringify(raw).slice(0, 200));
const no = await call('/privat/balance/mono3?s=wrong');
ok(no.ok === false, 'без секрету — немає доступу', 'адреса відкрита без секрету');

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'залишок — від банку, копійки на місці');
process.exit(bad ? 1 : 0);
