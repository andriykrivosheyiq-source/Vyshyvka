/* Воркер Нової пошти: кілька відправників, вага й габарити, контроль оплати,
   накладна — лише з адмінки (04.10).

   Перевіряємо з підставною Новою поштою й підставним Firebase:
     — без входу в адмінку накладну не створити (адреса воркера публічна);
     — з входом — накладна від ВИБРАНОГО відправника: його ключ (NP_KEY_<код>),
       його контрагент і контакт із кабінету НП, його місто й відділення;
     — вага й габарити — ті, що прийшли з картки (формат посилки), а не 0,3 кг;
     — контроль оплати — AfterpaymentOnGoodsCost на суму залишку;
     — без відправника — запасний старий шлях змінними воркера;
     — немає ключа відправника — зрозуміла помилка, а не накладна з чужого;
     — у списку відділень поштомати позначені.

   Запуск:  node tests/np-ship.mjs      (з кореня репозиторію)  */
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const calls = [];
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(JSON.stringify(body), { status: status || 200 });
  if(url.includes('identitytoolkit.googleapis.com')){
    const b = JSON.parse(opt.body);
    return b.idToken === 'good' ? res({ users: [{ localId: 'u1', email: 'test@loomiq' }] })
                                : res({ error: { message: 'INVALID_ID_TOKEN' } }, 400);
  }
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body);
    calls.push(b);
    const k = b.apiKey;
    if(b.calledMethod === 'getCounterparties')
      return res({ success: true, data: [{ Ref: 'CP-' + k, Description: 'ФОП ' + k }] });
    if(b.calledMethod === 'getCounterpartyContactPersons')
      return res({ success: true, data: [{ Ref: 'CT-' + k, Description: 'Контакт ' + k, Phones: '380631112233' }] });
    if(b.calledMethod === 'save')
      return res({ success: true, data: [{ IntDocNumber: '20450000000001', Ref: 'DOC1', CostOnSite: 85, EstimatedDeliveryDate: '06.10.2026' }] });
    if(b.calledMethod === 'getWarehouses')
      return res({ success: true, data: [
        { Ref: 'W1', Description: 'Відділення №1: вул. Соборна, 1', Number: '1', CategoryOfWarehouse: 'Branch' },
        { Ref: 'W2', Description: 'Поштомат "Нова Пошта" №5012', Number: '5012', CategoryOfWarehouse: 'Postomat' } ] });
    return res({ success: true, data: [] });
  }
  throw new Error('неочікуваний запит ' + url);
};

const worker = (await import(path.join(ROOT, 'worker/novaposhta-proxy.js'))).default;
const env = { NP_KEY_yukalchuk: 'KEY-Y', NP_KEY_maleeva: 'KEY-M', ALLOWED_ORIGINS: 'https://loomiq.net' };
const call = (body, e) => worker.fetch(new Request('https://np.test/', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://loomiq.net' },
  body: JSON.stringify(body) }), e || env).then(async r => ({ status: r.status, ...(await r.json()) }));

const ORDER = {
  sender: { id: 'yukalchuk', cityRef: 'CITY-VIN', warehouseRef: 'WH-VIN-12', phone: '380636855494' },
  name: 'Мороз Євгенія', phone: '+38 (068) 832-32-28', qty: 3,
  weightKg: 1.4, dims: { l: 40, w: 30, h: 10 }, cost: 6200, cod: 3100,
  cityRef: 'CITY-K', cityName: 'Київ', warehouseRef: 'WH-K-1', warehouseNumber: '1',
  description: 'Одяг з нанесенням, замовлення 2000104', payer: 'recipient'
};

console.log('═══ БЕЗ ВХОДУ В АДМІНКУ — НАКЛАДНОЇ НЕМАЄ ═══');
const n1 = await call({ op: 'create', order: ORDER });
const n2 = await call({ op: 'create', order: ORDER, idToken: 'forged' });
ok(n1.status === 401 && !n1.ok && n2.status === 401 && !n2.ok && !calls.some(c => c.calledMethod === 'save'),
  'без idToken і з підробленим — 401, до Нової пошти запит навіть не йде',
  'накладну створено без входу: ' + JSON.stringify([n1, n2]));
const s0 = await call({ op: 'sender', sender: 'yukalchuk' });
ok(s0.status === 401, 'реквізити відправника без входу теж не віддаються', 'реквізити віддано без входу');

console.log('');
console.log('═══ НАКЛАДНА ВІД ВИБРАНОГО ВІДПРАВНИКА ═══');
calls.length = 0;
const r = await call({ op: 'create', order: ORDER, idToken: 'good' });
const save = calls.filter(c => c.calledMethod === 'save')[0] || {};
const P = save.methodProperties || {};
console.log('   ' + JSON.stringify({ ttn: r.ttn, key: save.apiKey, Sender: P.Sender, ContactSender: P.ContactSender,
  CitySender: P.CitySender, SenderAddress: P.SenderAddress, Weight: P.Weight, OptionsSeat: P.OptionsSeat, cod: P.AfterpaymentOnGoodsCost }));
ok(r.ok && r.ttn === '20450000000001', 'накладну створено: ' + r.ttn, 'не створено: ' + JSON.stringify(r));
ok(save.apiKey === 'KEY-Y' && P.Sender === 'CP-KEY-Y' && P.ContactSender === 'CT-KEY-Y',
  'ключ, контрагент і контакт — саме цього ФОПа (з кабінету НП за його ключем)',
  'відправник не той: ' + JSON.stringify({ key: save.apiKey, s: P.Sender, c: P.ContactSender }));
ok(P.CitySender === 'CITY-VIN' && P.SenderAddress === 'WH-VIN-12' && P.SendersPhone === '380636855494',
  'місто, відділення й телефон відправки — з налаштувань відправника', 'місце відправки не те');
ok(P.Weight === '1.4' && P.OptionsSeat && P.OptionsSeat[0].volumetricLength === '40' &&
   P.OptionsSeat[0].volumetricWidth === '30' && P.OptionsSeat[0].volumetricHeight === '10' && P.VolumeGeneral === '0.012',
  'вага 1,4 кг і габарити 40×30×10 — з картки (формат посилки), обʼєм 0,012 м³',
  'вага/габарити не ті: ' + JSON.stringify({ w: P.Weight, s: P.OptionsSeat, v: P.VolumeGeneral }));
ok(P.AfterpaymentOnGoodsCost === '3100', 'контроль оплати на залишок — 3 100 ₴', 'контролю оплати немає: ' + P.AfterpaymentOnGoodsCost);
ok(P.RecipientsPhone === '380688323228' && P.RecipientAddress === 'WH-K-1' && P.FirstName === 'Мороз',
  'отримувач — телефон цифрами, відділення, імʼя', 'отримувач не той');

const r2 = await call({ op: 'create', order: Object.assign({}, ORDER, { cod: 0, sender: Object.assign({}, ORDER.sender, { id: 'maleeva' }) }), idToken: 'good' });
const save2 = calls.filter(c => c.calledMethod === 'save').pop() || {};
ok(r2.ok && save2.apiKey === 'KEY-M' && !('AfterpaymentOnGoodsCost' in save2.methodProperties),
  'інший відправник — інший ключ; без контролю оплати поля немає зовсім',
  'другий відправник: ' + JSON.stringify({ key: save2.apiKey, cod: save2.methodProperties && save2.methodProperties.AfterpaymentOnGoodsCost }));

console.log('');
console.log('═══ ПОМИЛКИ — СЛОВАМИ ═══');
const r3 = await call({ op: 'create', order: Object.assign({}, ORDER, { sender: Object.assign({}, ORDER.sender, { id: 'nobody' }) }), idToken: 'good' });
ok(!r3.ok && /NP_KEY_nobody/.test(r3.error), 'немає ключа відправника — каже, якого секрета бракує: ' + r3.error, 'помилка: ' + JSON.stringify(r3));
const r4 = await call({ op: 'create', order: Object.assign({}, ORDER, { sender: { id: 'yukalchuk' } }), idToken: 'good' });
ok(!r4.ok && /місто й відділення відправки/.test(r4.error), 'у відправника не задане місце відправки — так і каже', 'помилка: ' + r4.error);
const r5 = await call({ op: 'create', order: Object.assign({}, ORDER, { warehouseRef: '' }), idToken: 'good' });
ok(!r5.ok && /відділення чи поштомат/.test(r5.error), 'не обране відділення отримувача — так і каже', 'помилка: ' + r5.error);

console.log('');
console.log('═══ ЗАПАСНИЙ ШЛЯХ І ДОВІДНИК ═══');
const old = { NP_API_KEY: 'KEY-OLD', NP_SENDER: 'S-OLD', NP_SENDER_CITY: 'C-OLD', NP_SENDER_ADDR: 'A-OLD', NP_SENDER_NAME: 'N-OLD' };
const r6 = await call({ op: 'create', order: Object.assign({}, ORDER, { sender: null }), idToken: 'good' }, old);
const save6 = calls.filter(c => c.calledMethod === 'save').pop() || {};
ok(r6.ok && save6.apiKey === 'KEY-OLD' && save6.methodProperties.Sender === 'S-OLD',
  'відправників ще не заведено — працює старий спосіб (змінні воркера)', 'запасний шлях: ' + JSON.stringify(r6));
const wh = await call({ op: 'warehouses', city: 'CITY-K', q: '', sender: 'yukalchuk' });
ok(wh.ok && wh.list.length === 2 && !wh.list[0].postomat && wh.list[1].postomat,
  'довідник без входу; поштомати позначені', 'довідник: ' + JSON.stringify(wh));

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'накладна — від вибраного ФОПа, з вагою й контролем оплати, лише з адмінки');
process.exit(bad ? 1 : 0);
