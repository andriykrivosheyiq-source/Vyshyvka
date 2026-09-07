/**
 * Loomiq — проксі до Нової пошти (накладні й відстеження).
 *
 * НАВІЩО ВОРКЕР. Ключ API Нової пошти не можна класти в код адмінки: сайт
 * статичний, його код бачить кожен, хто відкрив вкладку розробника. З цим
 * ключем стороння людина створює накладні за ваш рахунок і читає всі ваші
 * відправлення. Тому ключ живе ТУТ, у секретах Cloudflare Worker, і нікуди
 * звідси не виходить — адмінка знає лише адресу воркера.
 *
 * Налаштування:
 *   wrangler secret put NP_API_KEY --name loomiq-np
 *   NP_SENDER        (звичайна змінна) — Ref відправника
 *   NP_SENDER_CITY   — Ref міста відправника
 *   NP_SENDER_ADDR   — Ref відділення/адреси відправника
 *   NP_SENDER_PHONE  — телефон відправника
 *   NP_SENDER_NAME   — контактна особа (Ref контакту)
 *   ALLOWED_ORIGINS  — домени, яким дозволено викликати проксі
 *
 * Адмінка шле POST <worker-url> з одним із таких тіл:
 *
 *   {"op":"cities","q":"Льв"}            → список міст
 *   {"op":"warehouses","city":"<Ref>","q":"12"}  → відділення міста
 *   {"op":"create", "order":{...}}       → створити накладну
 *   {"op":"track","ttn":"20450..."}      → статус відправлення
 *
 * Відповідь завжди JSON: {ok:true, ...} або {ok:false, error:"текст"}.
 *
 * ЧОМУ САМЕ ТАК. Адмінка не знає структури запитів Нової пошти й не має її
 * знати: у неї є замовлення — імʼя, телефон, місто, відділення, кількість
 * місць і опис. Переклад на мову API — робота воркера. Зміниться версія
 * API — правиться один файл, а не адмінка на кожному пристрої.
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
    'Access-Control-Allow-Headers': 'Content-Type',
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
async function np(env, model, method, props) {
  const r = await fetch(NP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: env.NP_API_KEY,
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

/* Опис відправлення. Вага й обʼєм — не вигадані числа: для одягу беремо
   0,3 кг на одиницю, але не менше 0,5 кг, бо менше НП не приймає. */
function parcel(order) {
  const qty = Math.max(1, Math.round(+order.qty || 1));
  const weight = Math.max(0.5, Math.round(qty * 0.3 * 10) / 10);
  return {
    weight: String(weight),
    volumeGeneral: String(Math.max(0.004, Math.round(qty * 0.002 * 1000) / 1000)),
    seatsAmount: String(Math.max(1, Math.round(+order.seats || 1))),
    description: String(order.description || 'Одяг з нанесенням').slice(0, 120)
  };
}

async function createTtn(env, order) {
  if (!env.NP_SENDER || !env.NP_SENDER_CITY || !env.NP_SENDER_ADDR) {
    throw new Error('У воркері не заповнені дані відправника (NP_SENDER, NP_SENDER_CITY, NP_SENDER_ADDR)');
  }
  const phone = String(order.phone || '').replace(/[^\d]/g, '');
  if (phone.length < 10) throw new Error('Телефон отримувача неповний');
  if (!order.cityRef) throw new Error('Не вибране місто отримувача');
  if (!order.warehouseRef) throw new Error('Не вибране відділення отримувача');

  /* Отримувача заводимо як приватну особу разовим контрагентом: так НП сама
     створює контакт, і нам не треба вести довідник клієнтів у двох місцях. */
  const parts = String(order.name || '').trim().split(/\s+/);
  const p = parcel(order);
  const data = await np(env, 'InternetDocument', 'save', {
    PayerType: order.payer === 'sender' ? 'Sender' : 'Recipient',
    PaymentMethod: 'Cash',
    CargoType: 'Parcel',
    ServiceType: 'WarehouseWarehouse',
    DateTime: order.date || '',
    Description: p.description,
    Weight: p.weight,
    VolumeGeneral: p.volumeGeneral,
    SeatsAmount: p.seatsAmount,
    Cost: String(Math.max(300, Math.round(+order.cost || 300))),
    CitySender: env.NP_SENDER_CITY,
    Sender: env.NP_SENDER,
    SenderAddress: env.NP_SENDER_ADDR,
    ContactSender: env.NP_SENDER_NAME || env.NP_SENDER,
    SendersPhone: env.NP_SENDER_PHONE || '',
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
  });
  const d = data[0] || {};
  return { ttn: String(d.IntDocNumber || ''), ref: String(d.Ref || ''),
           cost: +d.CostOnSite || 0, est: String(d.EstimatedDeliveryDate || '') };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'Only POST' }, 405, cors);
    if (!env.NP_API_KEY) return json({ ok: false, error: 'NP_API_KEY не заданий у секретах воркера' }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ ok: false, error: 'Тіло запиту не JSON' }, 400, cors); }

    try {
      const op = String(body.op || '');
      if (op === 'cities') {
        const d = await np(env, 'Address', 'searchSettlements',
          { CityName: String(body.q || ''), Limit: '20' });
        const list = ((d[0] || {}).Addresses || []).map(x => ({
          ref: x.DeliveryCity, name: x.Present || x.MainDescription || '' }));
        return json({ ok: true, list }, 200, cors);
      }
      if (op === 'warehouses') {
        const d = await np(env, 'Address', 'getWarehouses',
          { CityRef: String(body.city || ''), FindByString: String(body.q || ''), Limit: '50' });
        const list = d.map(x => ({ ref: x.Ref, name: x.Description,
                                   number: String(x.Number || '') }));
        return json({ ok: true, list }, 200, cors);
      }
      if (op === 'create') {
        const r = await createTtn(env, body.order || {});
        return json({ ok: true, ...r }, 200, cors);
      }
      if (op === 'track') {
        const ttn = String(body.ttn || '').replace(/\D/g, '');
        if (!ttn) return json({ ok: false, error: 'Порожній номер накладної' }, 400, cors);
        const d = await np(env, 'TrackingDocument', 'getStatusDocuments',
          { Documents: [{ DocumentNumber: ttn, Phone: String(body.phone || '') }] });
        const x = d[0] || {};
        return json({ ok: true, status: String(x.Status || ''),
                      code: String(x.StatusCode || ''),
                      est: String(x.ScheduledDeliveryDate || ''),
                      city: String(x.CityRecipient || '') }, 200, cors);
      }
      return json({ ok: false, error: 'Невідома операція: ' + op }, 400, cors);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 502, cors);
    }
  }
};
