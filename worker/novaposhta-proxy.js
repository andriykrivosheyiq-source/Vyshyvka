/**
 * Loomiq — проксі до Нової пошти (накладні й відстеження).
 *
 * НАВІЩО ВОРКЕР. Ключ API Нової пошти не можна класти в код адмінки: сайт
 * статичний, його код бачить кожен, хто відкрив вкладку розробника. З цим
 * ключем стороння людина створює накладні за ваш рахунок і читає всі ваші
 * відправлення. Тому ключі живуть ТУТ, у секретах Cloudflare Worker.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * КІЛЬКА ВІДПРАВНИКІВ (04.10)
 *
 * Відправники (ФОПи) заводяться в адмінці: Налаштування → Відправка — назва,
 * код, телефон, місто й відділення, звідки їде посилка, формати посилок.
 * Ключ API кожного ФОПа — секретом тут:
 *
 *   wrangler secret put NP_KEY_<код>       — напр. NP_KEY_yukalchuk
 *
 * Реквізити відправника в Новій пошті (контрагент, контактна особа) воркер
 * бере сам із кабінету за цим ключем — вписувати Ref-и руками не треба.
 *
 * Старий спосіб (один відправник змінними NP_API_KEY, NP_SENDER, NP_SENDER_CITY,
 * NP_SENDER_ADDR, NP_SENDER_PHONE, NP_SENDER_NAME) лишився запасним: працює,
 * поки відправників в адмінці не заведено.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ХТО МОЖЕ СТВОРИТИ НАКЛАДНУ
 *
 * Адреса воркера лежить у публічних налаштуваннях сайту. Тому накладну (і
 * реквізити відправника) воркер дає лише тому, хто увійшов в адмінку: вона
 * додає свій idToken, воркер перевіряє його в Firebase. Довідник міст і
 * відділень і відстеження — без входу, у них нічого чужого немає.
 *
 *   FIREBASE_API_KEY  — вебключ проєкту (необовʼязково: за замовчуванням той,
 *                       що й так стоїть у коді адмінки — він не секретний)
 *   ALLOWED_ORIGINS   — домени, яким дозволено викликати проксі
 *
 * Запити (POST, JSON):
 *   {"op":"cities","q":"Льв"}                       → міста
 *   {"op":"warehouses","city":"<Ref>","q":"12"}     → відділення й поштомати
 *   {"op":"sender","sender":"<код>","idToken":…}    → реквізити відправника
 *   {"op":"create","order":{…},"idToken":…}         → створити накладну
 *   {"op":"track","ttn":"20450…"}                   → статус
 */

const NP_URL = 'https://api.novaposhta.ua/v2.0/json/';
const DEFAULT_ALLOWED = ['https://loomiq.net', 'https://www.loomiq.net'];

function allowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED;
}
function corsHeaders(origin, env) {
  const allow = allowedOrigins(env);
  const ok = origin && allow.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

/* Один виклик до Нової пошти. Її API завжди відповідає 200, а помилки лежать
   у полі errors — тому перевіряємо success, а не код відповіді. */
async function np(env, model, method, props, key) {
  const r = await fetch(NP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: key || env.NP_API_KEY,
      modelName: model,
      calledMethod: method,
      methodProperties: props || {}
    })
  });
  const d = await r.json().catch(() => null);
  if (!d) throw new Error('Нова пошта відповіла не JSON');
  if (!d.success) {
    const errs = [].concat(d.errors || [], d.warnings || []).filter(Boolean);
    throw new Error(errs.join('; ') || 'Нова пошта відмовила без пояснення');
  }
  return d.data || [];
}


/* ══════════ ВІДПРАВНИКИ ══════════ */
const FB_WEB_KEY = 'AIzaSyDf7WmfVlny7T8SBo9N_Xr7TorWYdrDqTc';   // публічний, той самий, що в адмінці
function senderCode(id) { return String(id || '').replace(/[^A-Za-z0-9_]/g, ''); }
function keyFor(env, id) {
  const k = id ? env['NP_KEY_' + senderCode(id)] : '';
  if (k) return k;
  if (id && !env.NP_API_KEY) throw new Error('Немає секрета NP_KEY_' + senderCode(id) + ' — ключ API Нової пошти цього відправника');
  if (!env.NP_API_KEY) throw new Error('Немає ключа API Нової пошти (NP_KEY_<код> або NP_API_KEY)');
  return env.NP_API_KEY;
}
/* Реквізити відправника з кабінету НП за його ключем: контрагент і контактна
   особа. Памʼятаємо на час життя воркера — вони не міняються щохвилини. */
const SENDER_CACHE = {};
async function senderRefs(env, key) {
  const c = SENDER_CACHE[key];
  if (c && c.until > Date.now()) return c.v;
  const cps = await np(env, 'Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender', Page: '1' }, key);
  const cp = cps[0];
  if (!cp) throw new Error('У кабінеті Нової пошти за цим ключем немає відправника');
  const people = await np(env, 'Counterparty', 'getCounterpartyContactPersons', { Ref: cp.Ref, Page: '1' }, key);
  const v = {
    counterparty: { ref: cp.Ref, name: cp.Description || '' },
    contacts: people.map(x => ({ ref: x.Ref, name: x.Description || '', phone: String(x.Phones || '') }))
  };
  SENDER_CACHE[key] = { v, until: Date.now() + 6 * 3600 * 1000 };
  return v;
}
/* Хто питає. Накладну й реквізити — лише тому, хто увійшов в адмінку. */
async function whoAsks(env, token) {
  if (!token) throw Object.assign(new Error('Потрібен вхід в адмінку (немає idToken)'), { status: 401 });
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
    (env.FIREBASE_API_KEY || FB_WEB_KEY), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });
  const d = await r.json().catch(() => null);
  const u = d && d.users && d.users[0];
  if (!r.ok || !u) throw Object.assign(new Error('Вхід в адмінку недійсний — увійдіть ще раз'), { status: 401 });
  return { uid: u.localId, email: u.email || '' };
}

/* Посилка: вага й габарити з адмінки (формат відправника), а не вгадані.
   Немає — запасне правило: 0,3 кг на виріб, не менше 0,5 кг. */
function parcelOf(order) {
  const qty = Math.max(1, Math.round(+order.qty || 1));
  const kg = (+order.weightKg > 0) ? Math.round(+order.weightKg * 100) / 100
           : Math.max(0.5, Math.round(qty * 0.3 * 10) / 10);
  const d = order.dims || {};
  const l = +d.l || 0, w = +d.w || 0, h = +d.h || 0;
  const vol = (l && w && h) ? Math.round(l * w * h / 1e6 * 10000) / 10000
            : Math.max(0.004, Math.round(qty * 0.002 * 1000) / 1000);
  const seat = { weight: String(kg), volumetricVolume: String(vol) };
  if (l && w && h) Object.assign(seat, { volumetricLength: String(l), volumetricWidth: String(w), volumetricHeight: String(h) });
  return {
    weight: String(kg), volume: String(vol), seat,
    description: String(order.description || 'Одяг з нанесенням').slice(0, 120)
  };
}
/* Тіло InternetDocument.save. Окремо від мережі — щоб перевіряти без НП. */
function saveProps(order, refs) {
  const phone = String(order.phone || '').replace(/[^\d]/g, '');
  if (phone.length < 10) throw new Error('Телефон отримувача неповний');
  if (!order.cityRef) throw new Error('Не вибране місто отримувача');
  if (!order.warehouseRef) throw new Error('Не вибране відділення чи поштомат отримувача');
  if (!refs.citySender || !refs.addrSender) throw new Error('У відправника не задані місто й відділення відправки (Налаштування → Відправка)');
  const parts = String(order.name || '').trim().split(/\s+/);
  const p = parcelOf(order);
  const props = {
    PayerType: order.payer === 'sender' ? 'Sender' : 'Recipient',
    PaymentMethod: 'Cash',
    CargoType: 'Parcel',
    ServiceType: 'WarehouseWarehouse',
    DateTime: order.date || '',
    Description: p.description,
    Weight: p.weight,
    VolumeGeneral: p.volume,
    SeatsAmount: '1',
    OptionsSeat: [p.seat],
    Cost: String(Math.max(300, Math.round(+order.cost || 300))),
    CitySender: refs.citySender,
    Sender: refs.sender,
    SenderAddress: refs.addrSender,
    ContactSender: refs.contact,
    SendersPhone: String(refs.phone || '').replace(/[^\d]/g, ''),
    RecipientCityName: order.cityName || '',
    RecipientArea: '',
    RecipientAddressName: order.warehouseNumber || '',
    RecipientHouse: '',
    RecipientName: String(order.name || 'Отримувач').slice(0, 80),
    RecipientType: 'PrivatePerson',
    RecipientsPhone: phone,
    RecipientCity: order.cityRef,
    RecipientAddress: order.warehouseRef,
    FirstName: parts[0] || 'Отримувач',
    LastName: parts[1] || parts[0] || 'Отримувач',
    MiddleName: parts[2] || ''
  };
  /* Контроль оплати: отримувач платить на пошті, гроші йдуть нам на NovaPay. */
  const cod = Math.round(+order.cod || 0);
  if (cod > 0) props.AfterpaymentOnGoodsCost = String(cod);
  return props;
}
async function createTtn(env, order) {
  const s = order.sender || null;
  let key, refs;
  if (s && (s.id || s.cityRef)) {
    key = keyFor(env, s.id);
    const r = await senderRefs(env, key);
    const who = (r.contacts.filter(x => s.contactRef && x.ref === s.contactRef)[0]) || r.contacts[0] || {};
    refs = { sender: r.counterparty.ref, contact: who.ref || r.counterparty.ref,
             phone: s.phone || who.phone || '', citySender: s.cityRef || '', addrSender: s.warehouseRef || '' };
  } else {
    /* Запасний шлях: один відправник змінними воркера, як було доти. */
    if (!env.NP_SENDER || !env.NP_SENDER_CITY || !env.NP_SENDER_ADDR)
      throw new Error('Не вибраний відправник (Налаштування → Відправка)');
    key = keyFor(env, '');
    refs = { sender: env.NP_SENDER, contact: env.NP_SENDER_NAME || env.NP_SENDER,
             phone: env.NP_SENDER_PHONE || '', citySender: env.NP_SENDER_CITY, addrSender: env.NP_SENDER_ADDR };
  }
  const data = await np(env, 'InternetDocument', 'save', saveProps(order, refs), key);
  const d = data[0] || {};
  return { ttn: String(d.IntDocNumber || ''), ref: String(d.Ref || ''),
           cost: +d.CostOnSite || 0, est: String(d.EstimatedDeliveryDate || '') };
}

export const _pure = { parcelOf, saveProps, senderCode };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'Only POST' }, 405, cors);

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ ok: false, error: 'Тіло запиту не JSON' }, 400, cors); }

    try {
      const op = String(body.op || '');
      /* Довідник і відстеження — будь-яким ключем: відправника, якого
         обрали, або першим наявним. */
      const anyKey = () => keyFor(env, body.sender || '') ;
      if (op === 'cities') {
        const d = await np(env, 'Address', 'searchSettlements',
          { CityName: String(body.q || ''), Limit: '20' }, anyKey());
        const list = ((d[0] || {}).Addresses || []).map(x => ({
          ref: x.DeliveryCity, name: x.Present || x.MainDescription || '' }));
        return json({ ok: true, list }, 200, cors);
      }
      if (op === 'warehouses') {
        const d = await np(env, 'Address', 'getWarehouses',
          { CityRef: String(body.city || ''), FindByString: String(body.q || ''), Limit: '50' }, anyKey());
        /* Поштомати теж тут — НП віддає їх тим самим довідником; позначаємо,
           щоб у списку було видно, що це. */
        const list = d.map(x => ({ ref: x.Ref, name: x.Description,
                                   number: String(x.Number || ''),
                                   postomat: /поштомат/i.test(String(x.Description || '') + ' ' + String(x.CategoryOfWarehouse || '')) ||
                                             String(x.CategoryOfWarehouse || '') === 'Postomat' }));
        return json({ ok: true, list }, 200, cors);
      }
      if (op === 'sender') {
        await whoAsks(env, body.idToken || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        const r = await senderRefs(env, keyFor(env, body.sender || ''));
        return json({ ok: true, ...r }, 200, cors);
      }
      if (op === 'create') {
        await whoAsks(env, body.idToken || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        const r = await createTtn(env, body.order || {});
        return json({ ok: true, ...r }, 200, cors);
      }
      /* ── РЕЄСТРИ Й СТАТУСИ ПАЧКОЮ (07.10, дошка цеху) ── */
      /* Реєстр із ТТН одного відправника. Нова пошта приймає внутрішні Ref
         накладних; номери без Ref (вписані руками) шукаємо в його накладних
         за 60 днів. */
      if (op === 'registry') {
        await whoAsks(env, body.idToken || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        const key = keyFor(env, body.sender || '');
        const docs = Array.isArray(body.docs) ? body.docs.slice(0, 500) : [];
        const refs = [], треба = {};
        docs.forEach(d => { const n = String(d.ttn || '').replace(/\D/g, ''); if (d.ref) refs.push(String(d.ref)); else if (n) треба[n] = 1; });
        if (Object.keys(треба).length) {
          const до = new Date(), від = new Date(Date.now() - 60 * 864e5);
          const dd = x => String(x.getDate()).padStart(2, '0') + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + x.getFullYear();
          for (let page = 1; page <= 20 && Object.keys(треба).length; page++) {
            const l = await np(env, 'InternetDocument', 'getDocumentList',
              { DateTimeFrom: dd(від), DateTimeTo: dd(до), GetFullList: '1', Page: String(page), Limit: '100' }, key);
            l.forEach(x => { const n = String(x.IntDocNumber || ''); if (треба[n] && x.Ref) { refs.push(String(x.Ref)); delete треба[n]; } });
            if (l.length < 100) break;
          }
        }
        if (!refs.length) return json({ ok: false, error: 'Жодної накладної цього відправника не знайдено' }, 200, cors);
        const r = await np(env, 'ScanSheet', 'insertDocuments', { DocumentRefs: refs }, key);
        const x = r[0] || {};
        return json({ ok: !!x.Ref, ref: String(x.Ref || ''), number: String(x.Number || ''), date: String(x.Date || ''),
                      notFound: Object.keys(треба), errors: (x.Data && x.Data.Errors) || [] }, 200, cors);
      }
      /* PDF реєстру для друку. Адреса друку НП містить ключ, тож її віддавати
         в браузер не можна — тягнемо файл тут і віддаємо байти. */
      if (op === 'registryPdf') {
        await whoAsks(env, body.idToken || (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
        const ref = String(body.ref || '').replace(/[^A-Za-z0-9-]/g, '');
        if (!ref) return json({ ok: false, error: 'Немає реєстру' }, 400, cors);
        const key = keyFor(env, body.sender || '');
        const pdf = await fetch('https://my.novaposhta.ua/scanSheet/printScanSheet/refs[]/' + ref + '/type/pdf/apiKey/' + key);
        if (!pdf.ok) return json({ ok: false, error: 'Нова пошта не віддала PDF (' + pdf.status + ')' }, 502, cors);
        return new Response(pdf.body, { status: 200, headers: { ...cors, 'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reestr-' + ref.slice(0, 8) + '.pdf"' } });
      }
      /* Статуси до 100 накладних за раз — для автоматичних колонок дошки. */
      if (op === 'trackMany') {
        const list = (Array.isArray(body.ttns) ? body.ttns : []).slice(0, 100)
          .map(t => ({ DocumentNumber: String(t.ttn || t || '').replace(/\D/g, ''), Phone: String(t.phone || '') }))
          .filter(t => t.DocumentNumber);
        if (!list.length) return json({ ok: true, list: [] }, 200, cors);
        const d = await np(env, 'TrackingDocument', 'getStatusDocuments', { Documents: list }, anyKey());
        return json({ ok: true, list: d.map(x => ({ ttn: String(x.Number || ''), code: String(x.StatusCode || ''),
          status: String(x.Status || ''), at: String(x.RecipientDateTime || x.ActualDeliveryDate || x.DateCreated || '') })) }, 200, cors);
      }
      if (op === 'track') {
        const ttn = String(body.ttn || '').replace(/\D/g, '');
        if (!ttn) return json({ ok: false, error: 'Порожній номер накладної' }, 400, cors);
        const d = await np(env, 'TrackingDocument', 'getStatusDocuments',
          { Documents: [{ DocumentNumber: ttn, Phone: String(body.phone || '') }] }, anyKey());
        const x = d[0] || {};
        return json({ ok: true, status: String(x.Status || ''),
                      code: String(x.StatusCode || ''),
                      est: String(x.ScheduledDeliveryDate || ''),
                      city: String(x.CityRecipient || '') }, 200, cors);
      }
      return json({ ok: false, error: 'Невідома операція: ' + op }, 400, cors);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, (e && e.status) || 502, cors);
    }
  }
};
