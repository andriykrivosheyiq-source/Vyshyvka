/* ЗАМОК ГРОШОВОГО ЯДРА (loomiq-money-core.js) — 04.10.

   Андрій: «закласти в основну логіку, щоб вона не змінювалася, не ламалася
   при подальших змінах… щоб ми ніяк не втратили гроші».

   Цей тест запускає хук перед кожним комітом (.githooks/pre-commit). Якщо
   якась майбутня зміна ламає правило нижче — коміт не пройде. Правила
   змінювати лише свідомо і разом із цим тестом.

   Без браузера й бази: за пів секунди.
   Запуск:  node tests/money-core.mjs      (з кореня репозиторію)  */
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const M = createRequire(import.meta.url)(path.join(ROOT, 'loomiq-money-core.js'));
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const D = '2026-10-0';
const NOW = Date.parse('2026-10-10T12:00:00Z');

console.log('═══ 1. ОДНЕ «СПЛАЧЕНО» ДЛЯ ВСІХ ═══');
{
  const o = { orderId: '1000501', totalPrice: 6000, payments: [{ sum: 2900, at: D + '1T10:00:00Z' }] };
  const pays = [
    { id: 'npc_1', amount: 3100, orderId: '1000501', tag: 'cod', ttn: '2045', src: 'np', at: D + '5T10:00:00Z' },
    { id: 'm1', amount: 500, orderId: '1000999', src: 'mono', at: D + '2T10:00:00Z' },
    { id: 'x1', amount: -300, orderId: '1000501', src: 'mono', at: D + '3T10:00:00Z' } ];
  ok(M.paid(o, pays).sum === 6000 && M.state(o, pays) === 'full' && M.due(o, pays) === 0,
    'наложка, що сама привʼязалась у Фінансах, рахується в картці B2B (2 900 руками + 3 100 з НП = 6 000)',
    'наложка не рахується в картці: ' + M.paid(o, pays).sum);
  ok(M.paid(o, null).sum === 2900, 'рухи ще не завантажені — рахуємо лише записи картки (не нуль)', 'без рухів: ' + M.paid(o, null).sum);
  ok(!M.paid(o, pays).rows.some(r => r.payId === 'x1'), 'витрата, привʼязана до замовлення, оплатою клієнта не рахується', 'витрата в оплаті');
}
console.log('');
console.log('═══ 2. КОПІЯ В КАРТЦІ НЕ ДВОЇТЬСЯ ═══');
{
  const o = { orderId: '7', totalPrice: 5000, payments: [{ sum: 2000, payId: 'p1', at: D + '1T00:00:00Z' }] };
  const linked = [{ id: 'p1', amount: 2000, orderId: '7', src: 'mono', at: D + '1T00:00:00Z' }];
  ok(M.paid(o, linked).sum === 2000, 'запис картки з payId і сам рух — один платіж, а не два', 'дубль: ' + M.paid(o, linked).sum);
  const moved = [{ id: 'p1', amount: 2000, orderId: '8', src: 'mono', at: D + '1T00:00:00Z' }];
  ok(M.paid(o, moved).sum === 0 && M.paid(o, moved).rows[0].src === 'stale',
    'рух перенесли в інше замовлення — тут копія вже не рахується', 'гроші рахуються у двох замовленнях');
  const unlinked = [{ id: 'p1', amount: 2000, src: 'mono', at: D + '1T00:00:00Z' }];
  ok(M.paid(o, unlinked).sum === 0, 'рух відвʼязали у Фінансах — у картці теж не рахується', 'відвʼязаний рахується');
  ok(M.paid(o, []).sum === 2000, 'руху немає у завантаженому півроці — рахується копія (давня оплата не стає боргом)',
    'давня оплата зникла: ' + M.paid(o, []).sum);
}
console.log('');
console.log('═══ 3. ПЛАТІЖ НЕ ПЕРЕКИДАЄТЬСЯ МОВЧКИ ═══');
{
  const p = { id: 'p1', amount: 2000, orderId: '7' };
  ok(/уже привʼязаний до #7/.test(M.linkCheck(p, '8')), 'привʼязаний до #7 — у #8 не привʼязати без відвʼязки', 'перекинуто мовчки');
  ok(M.linkCheck(p, '8', { move: true }) === '' && M.linkCheck(p, '') === '' && M.linkCheck(p, '7') === '',
    'свідоме перенесення, відвʼязка й повтор — дозволені', 'зайва заборона');
  ok(/між своїми/.test(M.linkCheck({ id: 'q', amount: 5, tag: 'own' }, '7')), 'переказ між своїми до замовлення не привʼязати', 'own привʼязано');
}
console.log('');
console.log('═══ 4. КОНТРОЛЬ ОПЛАТИ = ЗАЛИШОК ═══');
{
  const o = { orderId: '9', totalPrice: 6000, payments: [{ sum: 2900 }] };
  ok(M.codFor(o, []) === 3100, 'контроль оплати для ТТН — рівно залишок 3 100 ₴', 'сума ТТН: ' + M.codFor(o, []));
  const full = { orderId: '9', totalPrice: 6000, payments: [{ sum: 6000 }] };
  ok(M.codFor(full, []) === 0, 'сплачено все — контролю оплати немає', 'з повністю сплаченого просимо гроші');
}
console.log('');
console.log('═══ 5. ЗВІРКА ═══');
const kinds = a => a.map(x => x.kind).sort().join(',');
{
  const orders = [
    // посилку забрали 3 дні тому, гроші не прийшли
    { orderId: 'A', totalPrice: 3000, ttn: '111', ttnCod: 3000, payments: [] },
    // забрали 1 день тому — ще рано
    { orderId: 'B', totalPrice: 1000, ttn: '222', ttnCod: 1000, payments: [] },
    // забрали, гроші прийшли, але не привʼязались
    { orderId: 'C', totalPrice: 900, ttn: '333', ttnCod: 900, payments: [] },
    // відмова
    { orderId: 'D', totalPrice: 700, ttn: '444', ttnCod: 700, payments: [] },
    // після ТТН клієнт доплатив — контроль оплати більший за залишок
    { orderId: 'E', totalPrice: 2000, ttn: '555', ttnCod: 2000, payments: [{ sum: 1500, at: D + '8T00:00:00Z' }] },
    // переплата + дубль руками
    { orderId: 'F', totalPrice: 1000, payments: [{ sum: 1000, at: D + '6T00:00:00Z' }] },
    // стара ТТН з контролем оплати замінена — гроші за неї знайдуть замовлення
    { orderId: 'G', totalPrice: 800, ttn: '777', ttnCod: 0, ttnHist: [{ ttn: '666', cod: 800 }], payments: [] },
    // скасоване — не чіпаємо
    { orderId: 'H', status: 'cancel', totalPrice: 100, ttn: '888', ttnCod: 100 } ];
  const pays = [
    { id: 'npc_333', amount: 900, ttn: '333', src: 'np', acc: 'np1', at: D + '6T00:00:00Z' },
    { id: 'mF', amount: 1000, orderId: 'F', src: 'mono', acc: 'mono1', at: D + '6T09:00:00Z' },
    { id: 'lost', amount: 450, orderId: 'ZZZ', src: 'mono', acc: 'mono1', at: D + '6T00:00:00Z' },
    { id: 'np_in', amount: 50000, src: 'mono', acc: 'mono1', counter: 'ТОВ «НоваПей»', at: D + '7T00:00:00Z' },
    { id: 'np_own', amount: 30000, src: 'mono', acc: 'mono1', counter: 'NovaPay', tag: 'own', at: D + '7T00:00:00Z' },
    { id: 'orph', amount: 1200, ttn: '999', src: 'np', acc: 'np1', at: D + '5T00:00:00Z' },
    { id: 'npc_666', amount: 800, ttn: '666', src: 'np', acc: 'np1', orderId: 'G', tag: 'cod', at: D + '5T00:00:00Z' } ];
  const np = {
    '111': { code: '9', at: '2026-10-07T10:00:00Z' }, '222': { code: '9', at: '2026-10-09T18:00:00Z' },
    '333': { code: '9', at: '2026-10-06T00:00:00Z' }, '444': { code: '103', status: 'Відмова одержувача' },
    '888': { code: '9', at: '2026-10-01T00:00:00Z' } };
  const a = M.audit(orders, pays, { now: NOW, np, accs: [{ id: 'mono1', bank: 'mono' }, { id: 'np1', bank: 'np' }] });
  console.log('   ' + a.map(x => x.kind + ':' + (x.orderId || x.payId || '')).join(' '));
  const of = (k, id) => a.filter(x => x.kind === k && (x.orderId === id || x.payId === id))[0];
  ok(of('cod_late', 'A') && of('cod_late', 'A').sev === 'red' && /грошей немає вже 3 дн/.test(of('cod_late', 'A').text),
    'посилку забрали 3 дні тому, грошей немає — червоний пункт', 'A: ' + JSON.stringify(of('cod_late', 'A')));
  ok(!a.some(x => x.orderId === 'B'), 'забрали вчора — ще не тривога (2 дні)', 'B завчасно');
  ok(of('cod_late', 'C') && of('cod_late', 'C').fix === 'link' && of('cod_late', 'C').payId === 'npc_333',
    'гроші прийшли, але не привʼязались — кнопка «Привʼязати» до потрібного руху', 'C: ' + JSON.stringify(of('cod_late', 'C')));
  ok(of('cod_back', 'D'), 'відмова — пункт «грошей не буде, перевірте товар»', 'D немає');
  ok(of('cod_over', 'E') && of('cod_over', 'E').sum === 1500, 'контроль оплати більший за залишок на 1 500 ₴ — червоний', 'E: ' + JSON.stringify(of('cod_over', 'E')));
  ok(of('overpay', 'F') && of('dup', 'F'), 'переплата і можливий дубль (руками + з банку)', 'F: ' + kinds(a.filter(x => x.orderId === 'F')));
  ok(of('lost_order', 'lost') && of('lost_order', 'lost').fix === 'unlink', 'платіж привʼязаний до неіснуючого замовлення', 'lost немає');
  ok(of('np_in', 'np_in') && !of('np_in', 'np_own'), 'переказ з NovaPay на банк — «позначте між своїми»; позначений — ні', 'np_in');
  const sir = a.filter(x => x.kind === 'cod_orphan')[0];
  ok(sir && sir.list.join() === 'orph', 'гроші за ТТН, якої немає в CRM, — одним пунктом зі списком', 'сироти: ' + JSON.stringify(sir));
  ok(!a.some(x => x.orderId === 'G') && !a.some(x => x.orderId === 'H'),
    'стара ТТН (ttnHist) — гроші знайшли замовлення; скасоване не чіпаємо', 'G/H: ' + kinds(a.filter(x => x.orderId === 'G' || x.orderId === 'H')));
  ok(a[0].sev === 'red' && a[a.length - 1].sev === 'amber', 'спершу термінове', 'порядок');

  orders[3].moneyOk = { [M.keyOf(of('cod_back', 'D'))]: { by: 't' } };
  pays[3].auditOk = ['np_in:np_in'];
  const b = M.audit(orders, pays, { now: NOW, np, accs: [{ id: 'mono1', bank: 'mono' }, { id: 'np1', bank: 'np' }] });
  ok(!b.some(x => x.kind === 'cod_back') && !b.some(x => x.kind === 'np_in') && b.length === a.length - 2,
    '«Гаразд» закриває саме цей пункт, решта лишається', 'гаразд: ' + kinds(b));
}
console.log('');
console.log('═══ 6. ТТН ═══');
ok(M.ttnsOf({ ttn: '20 4500 0000 0001', ttnHist: [{ ttn: '20450000000002' }, { ttn: '20450000000001' }] }).join() === '20450000000001,20450000000002',
  'ТТН замовлення — поточна й замінені, без пробілів і повторів', 'ttnsOf');
ok(M.BANK_SRC.join() === 'mono,privat,np' && M.COD_DAYS === 2, 'банківські джерела й 2 дні — як домовлено', 'константи змінено');

console.log('');
console.log(bad ? 'розходжень: ' + bad + ' — ЗМІНА ЛАМАЄ ГРОШОВЕ ЯДРО' : 'грошове ядро тримає всі правила');
process.exit(bad ? 1 : 0);
