/* Бот цеху (08.10): Telegram не бачить нову адресу *.workers.dev — вебхук
   не стає. Тоді /start забираємо самі (getUpdates), і карти все одно
   доходять. Перевіряємо без мережі: fetch і KV підмінені. */
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const ok = (c, yes, no) => { console.log('  ' + (c ? yes + ' ✓' : no + ' ✗')); if(!c) bad++; };
const KV = new Map();
const SUBS = { get: async k => KV.has(k) ? KV.get(k) : null, put: async (k, v) => { KV.set(k, v); }, delete: async k => { KV.delete(k); },
  list: async ({ prefix }) => ({ keys: [...KV.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
const env = { PROD_BOT_TOKEN: 'T', HOOK_SECRET: 'sek', FIREBASE_API_KEY: 'F', SUBS };
const calls = [];
let updates = [{ update_id: 10, message: { chat: { id: 501 }, from: { first_name: 'Володимир' }, text: '/start' } }];
globalThis.fetch = async (url, opt) => {
  url = String(url); const body = opt && opt.body ? JSON.parse(opt.body) : {};
  const m = /\/botT\/(\w+)$/.exec(url);
  const res = o => new Response(JSON.stringify(o));
  if (m) {
    calls.push({ m: m[1], body });
    if (m[1] === 'setWebhook') return res({ ok: false, error_code: 400, description: 'Bad Request: bad webhook: Failed to resolve host' });
    if (m[1] === 'getUpdates') return res({ ok: true, result: updates.filter(u => u.update_id >= (body.offset || 0)) });
    return res({ ok: true });
  }
  if (url.includes('identitytoolkit')) return res({ users: [{}] });
  throw new Error('неочікуваний запит ' + url);
};
const w = (await import(path.join(ROOT, 'worker/prod-bot.js'))).default;
const get = p => w.fetch(new Request('https://loomiq-prod.test' + p), env).then(r => r.json());

console.log('═══ ВЕБХУК НЕ СТАВ — ОПИТУВАННЯ ═══');
const s = await get('/setup?s=sek');
ok(s.ok && /без вебхука/.test(s.режим) && s.підписано === 1 && KV.has('chat:501'),
  'вебхук не став — /start забрали самі, Володимира підписано', JSON.stringify(s));
ok(calls.some(c => c.m === 'sendMessage' && c.body.chat_id === '501' && /Підписано/.test(c.body.text)),
  'у бот прийшло «✅ Підписано»', 'підтвердження немає');
ok(KV.get('offset') === '11', 'дочитане запамʼятали — той самий /start удруге не обробиться', 'offset: ' + KV.get('offset'));

updates.push({ update_id: 11, message: { chat: { id: 777 }, from: { first_name: 'Оператор' }, text: '/start' } });
calls.length = 0;
const r = await w.fetch(new Request('https://loomiq-prod.test/send', { method: 'POST',
  body: JSON.stringify({ idToken: 'x', caption: 'Замовлення #1', photos: ['https://res.cloudinary.com/a/b.png'] }) }), env).then(x => x.json());
ok(r.ok && r.of === 2 && calls.filter(c => c.m === 'sendPhoto').length === 2,
  'перед надсиланням нові /start теж підхоплено — карта пішла обом', JSON.stringify(r));

console.log('');
console.log(bad ? 'розходжень: ' + bad : 'бот цеху працює і без вебхука');
process.exit(bad ? 1 : 0);
