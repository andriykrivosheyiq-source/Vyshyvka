/* НОМЕР ЗАМОВЛЕННЯ — ЛИШЕ ЗАБРОНЬОВАНИЙ (22.10). Правила бази на емуляторі.

   Андрій: «як так вийшло, що однаковий номер… щоб більше ніколи це не
   трапилось». Бронь — документ orderNos/<номер>: база створює його лише
   раз; картка без броні (або з чужою) не створюється.

   Запуск:  node tests/order-nos.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EMU = process.env.LQ_EMU_DIR || '/tmp/claude-0/emu';
const JAR = (() => { try{ const d = path.join(process.env.HOME || '/root', '.cache/firebase/emulators');
  return fs.readdirSync(d).filter(f => /^cloud-firestore-emulator.*\.jar$/.test(f)).map(f => path.join(d, f))[0]; }catch(e){ return ''; } })();
let RUT;
try{ RUT = createRequire(path.join(EMU, 'x.js'))('@firebase/rules-unit-testing'); }catch(e){}
if(!RUT || !JAR){
  console.log('пропущено: немає емулятора Firestore (' + (!JAR ? 'jar' : '@firebase/rules-unit-testing') + ')');
  process.exit(0);
}
const req = createRequire(path.join(EMU, 'x.js'));
const { doc, getDoc, setDoc, deleteDoc, addDoc, collection, setLogLevel } = req('firebase/firestore');
setLogLevel('silent');

const PORT = 8790 + Math.floor(Math.random() * 50);
const emu = spawn('java', ['-jar', JAR, '--host', '127.0.0.1', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('емулятор не стартував')), 40000);
  const on = b => { if(/Dev App Server is now running|is now running/.test(String(b))){ clearTimeout(t); res(); } };
  emu.stdout.on('data', on); emu.stderr.on('data', on);
});

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const env = await RUT.initializeTestEnvironment({ projectId: 'loomiq-rules',
  firestore: { host: '127.0.0.1', port: PORT, rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') } });
const can = async p => { try{ await p; return true; }catch(e){ return false; } };

await env.withSecurityRulesDisabled(async c => {
  const db = c.firestore();
  await setDoc(doc(db, 'loomiq/photos'), { acl: { test_loomiq: { pay: true }, art_loomiq: { edit: true }, boss_loomiq: { edit: true, setup: true } } });
  await setDoc(doc(db, 'payments/mono_1'), { at: '2026-10-01T10:00:00Z', amount: 1500, acc: 'mono1', src: 'mono', counter: 'Асія', desc: 'за футболки' });
  await setDoc(doc(db, 'payments/npc_2045'), { at: '2026-10-02T10:00:00Z', amount: 2080, acc: 'np1', src: 'np', ttn: '2045', orderId: '2000777', tag: 'cod' });
  await setDoc(doc(db, 'payments/novapay_1'), { at: '2026-10-04T09:00:00Z', amount: 50000, acc: 'npay1', src: 'novapay', flow: 'pool' });
  await setDoc(doc(db, 'payments/man_1'), { at: '2026-10-02T10:00:00Z', amount: -9000, acc: 'mono1', src: 'salary' });
});
const fin = env.authenticatedContext('u1', { email: 'test@loomiq' }).firestore();
const art = env.authenticatedContext('u2', { email: 'art@loomiq' }).firestore();


const mgr = env.authenticatedContext('u2', { email: 'art@loomiq' }).firestore();   // право «редагувати»
const own = env.authenticatedContext('u3', { email: 'boss@loomiq' }).firestore();
const noRight = env.authenticatedContext('u1', { email: 'test@loomiq' }).firestore(); // лише «оплата»

console.log('═══ БЕЗ БРОНІ КАРТКА НЕ СТВОРЮЄТЬСЯ ═══');
const картка = { orderId: '1000147', name: 'Денис', status: 'prorahunok', createdAt: '2026-10-19T23:00:00Z' };
ok(!(await can(setDoc(doc(mgr, 'kanbanOrders/A'), картка))), 'картка з незаброньованим номером — відмова', 'картку без броні записано!');
ok(await can(setDoc(doc(mgr, 'orderNos/1000147'), { id: 'A', by: 'art@loomiq', at: '2026-10-19T23:00:00Z', dir: 'b2b' })), 'бронь номера 1000147 для картки A', 'бронь не створилась');
ok(await can(setDoc(doc(mgr, 'kanbanOrders/A'), картка)), 'тепер картка A записується', 'картка A не записалась');

console.log('');
console.log('═══ ДРУГА КАРТКА НА ТОЙ САМИЙ НОМЕР — НІ ═══');
ok(!(await can(setDoc(doc(mgr, 'orderNos/1000147'), { id: 'B', by: 'dasha@loomiq', at: '2026-10-21T19:44:00Z', dir: 'b2b' }))),
  'друга бронь того самого номера (інша картка) — відмова', 'номер заброньовано двічі!');
ok(!(await can(setDoc(doc(mgr, 'orderNos/1000147'), { id: 'B' }, { merge: true }))), 'перепідписати бронь на іншу картку — відмова', 'бронь перепідписано!');
ok(!(await can(setDoc(doc(mgr, 'kanbanOrders/B'), { ...картка, name: '—', createdAt: '2026-10-21T19:44:00Z' }))),
  'картка B з номером 1000147 (бронь належить A) — відмова', 'двійник записано!');
ok(await can(setDoc(doc(mgr, 'orderNos/1000148'), { id: 'B', by: 'dasha@loomiq', at: '2026-10-21T19:44:00Z', dir: 'b2b' })) &&
   await can(setDoc(doc(mgr, 'kanbanOrders/B'), { ...картка, orderId: '1000148', name: '—' })),
  'з наступним номером 1000148 — бронь і картка проходять', 'наступний номер не пройшов');

console.log('');
console.log('═══ ФОРМА БРОНІ Й ПРАВА ═══');
ok(!(await can(setDoc(doc(mgr, 'orderNos/abc'), { id: 'C', by: '', at: '', dir: 'b2b' }))), 'бронь не-номера — відмова', 'заброньовано «abc»');
ok(!(await can(setDoc(doc(mgr, 'orderNos/1000149'), { id: 'C', extra: 1 }))), 'зайві поля в броні — відмова', 'бронь із зайвими полями');
ok(!(await can(setDoc(doc(noRight, 'orderNos/1000150'), { id: 'D', by: '', at: '', dir: 'b2b' }))), 'без права «редагувати» бронювати не можна', 'без права заброньовано');
ok(!(await can(deleteDoc(doc(mgr, 'orderNos/1000148')))), 'менеджер бронь не знімає', 'менеджер зняв бронь');
ok(await can(deleteDoc(doc(own, 'orderNos/1000148'))), 'власник (ремонт) — може', 'власник не зміг зняти');
ok(await can(setDoc(doc(mgr, 'kanbanOrders/A'), { status: 'kp' }, { merge: true })), 'правка існуючої картки броні не вимагає', 'правку заблоковано');
/* Лічильники-підказки (orderSeq / orderSeqC) пише будь-хто з команди — інакше
   менеджер B2C бачив «лічильник не зберігся» на кожному замовленні (23.10). */
ok(await can(setDoc(doc(mgr, 'loomiq/photos'), { orderSeqC: 5000123 }, { merge: true })) &&
   await can(setDoc(doc(mgr, 'loomiq/photos'), { orderSeq: 1000200 }, { merge: true })),
  'лічильники B2B і B2C пише менеджер без права «налаштування»', 'лічильник не записався');
ok(!(await can(setDoc(doc(mgr, 'loomiq/photos'), { orderNosSeed: 1 }, { merge: true }))), 'а позначку «номери заброньовано» — лише власник', 'менеджер поставив позначку бронювання');
/* Мітка збірки (27.10): перша свіжа вкладка будь-кого з команди кладе її,
   щоб старі вкладки опустили заслону «Вийшло оновлення». Лише ключ `build`. */
ok(await can(setDoc(doc(mgr, 'loomiq/photos'), { build: { v: 'abc123', at: '2026-10-27T10:00:00Z', by: 'art@loomiq' } }, { merge: true })),
  'мітку збірки пише менеджер без права «налаштування»', 'мітка збірки не записалась');
ok(!(await can(setDoc(doc(mgr, 'loomiq/photos'), { build: { v: 'abc124' }, archSeed: 1 }, { merge: true }))), 'а разом з іншим ключем — ні', 'менеджер записав чужий ключ під виглядом мітки');

console.log('');
console.log('═══ НЕПОДІЛЬНЕ СТВОРЕННЯ (28.10): БРОНЬ, КАРТКА, КАРТКА ВІДДІЛУ Й ПЛАТІЖ — ОДНІЄЮ ТРАНЗАКЦІЄЮ ═══');
/* 27.10: девʼять «не дописалась» — бронь, одяг і платіж лягли, картки немає.
   Тепер усе чотири пишеться однією транзакцією (orderCreateAtomic), а правила
   (existsAfter/getAfter) не пускають ні картку відділу, ні платіж до номера,
   за бронню якого немає живої картки. */
const { runTransaction } = req('firebase/firestore');
await env.withSecurityRulesDisabled(async c => {
  const db = c.firestore();
  await setDoc(doc(db, 'loomiq/photos'), { acl: { dasha_loomiq: { edit: true, pay: true } } }, { merge: true });
  await setDoc(doc(db, 'payments/mono_9'), { at: '2026-10-28T10:00:00Z', amount: 1560, acc: 'mono1', src: 'mono', counter: 'Олена' });
  await setDoc(doc(db, 'payments/mono_10'), { at: '2026-10-28T10:05:00Z', amount: 900, acc: 'mono1', src: 'mono', counter: 'Іра' });
});
const sale = env.authenticatedContext('u4', { email: 'dasha@loomiq' }).firestore();   // «редагувати» + «оплата» — як менеджер B2C
const карткаC = { dir: 'b2c', name: '', status: 'new', createdAt: '2026-10-28T10:00:00Z', arch: false };
const разом = (db, no, id, opt) => runTransaction(db, async t => {
  await t.get(doc(db, 'orderNos/' + no));
  t.set(doc(db, 'orderNos/' + no), { id, by: 'dasha@loomiq', at: '2026-10-28T10:00:00Z', dir: 'b2c' });
  if(!(opt && opt.noCard)) t.set(doc(db, 'kanbanOrders/' + id), { ...карткаC, orderId: no });
  t.set(doc(db, 'designJobs/' + no), { orderId: no, state: 'new', units: [] });
  if(opt && opt.pay) t.set(doc(db, 'payments/' + opt.pay), { orderId: no, tag: 'prepay', linkedBy: 'dasha@loomiq' }, { merge: true });
});
ok(await can(разом(sale, '5000401', 'C1', { pay: 'mono_9' })), 'менеджер («редагувати» + «оплата»): бронь, картка, картка відділу й платіж однією транзакцією — пройшло', 'неподільне створення не пройшло');
let після = null;
await env.withSecurityRulesDisabled(async c => { const db = c.firestore();
  після = { card: (await getDoc(doc(db, 'kanbanOrders/C1'))).exists(), job: (await getDoc(doc(db, 'designJobs/5000401'))).exists(),
            pay: ((await getDoc(doc(db, 'payments/mono_9'))).data() || {}).orderId || '' }; });
ok(після.card && після.job && після.pay === '5000401', 'у базі всі чотири документи', JSON.stringify(після));
ok(!(await can(разом(sale, '5000402', 'C2', { noCard: true, pay: 'mono_10' }))), 'та сама транзакція БЕЗ картки замовлення (як 27.10: бронь, одяг, платіж) — відмова цілком', 'сирота пройшла!');
let сл = null;
await env.withSecurityRulesDisabled(async c => { const db = c.firestore();
  сл = { nos: (await getDoc(doc(db, 'orderNos/5000402'))).exists(), job: (await getDoc(doc(db, 'designJobs/5000402'))).exists(),
         pay: ((await getDoc(doc(db, 'payments/mono_10'))).data() || {}).orderId || '' }; });
ok(!сл.nos && !сл.job && !сл.pay, 'і нічого з неї не лягло: ні броні, ні картки відділу, ні привʼязки', JSON.stringify(сл));
ok(!(await can(runTransaction(sale, async t => {
  await t.get(doc(sale, 'orderNos/5000403'));
  t.set(doc(sale, 'orderNos/5000403'), { id: 'C3', by: 'dasha@loomiq', at: '2026-10-28T10:00:00Z', dir: 'b2c' });
  t.set(doc(sale, 'kanbanOrders/C3x'), { ...карткаC, orderId: '5000403' });
}))), 'картка з ключем, на який бронь не вказує, — відмова й у транзакції', 'картка з чужою бронню пройшла');

console.log('');
console.log('═══ КАРТКА ВІДДІЛУ Й ПЛАТІЖ — ЛИШЕ ДО ЖИВОЇ КАРТКИ (28.10) ═══');
ok(await can(setDoc(doc(mgr, 'orderNos/5000404'), { id: 'C4', by: 'art@loomiq', at: '2026-10-28T10:00:00Z', dir: 'b2c' })), 'бронь 5000404 на картку C4, якої в базі немає (як після збою)', 'бронь не створилась');
ok(!(await can(setDoc(doc(mgr, 'designJobs/5000404'), { orderId: '5000404', state: 'new' }))), 'картка відділу під номером без живої картки — відмова (сирота не зʼявиться)', 'сирота-картка відділу записалась!');
ok(await can(setDoc(doc(mgr, 'designJobs/5000405'), { orderId: '5000405', state: 'new' })), 'номер без броні (стара картка) — картка відділу пишеться, як доти', 'стару картку відділу не пустило');
ok(await can(setDoc(doc(own, 'designJobs/5000404'), { orderId: '5000404', state: 'new' })), 'власник (ремонт у Звірці) — може й під номер без картки', 'власника не пустило');
ok(await can(setDoc(doc(mgr, 'designJobs/5000404'), { state: 'design' }, { merge: true })), 'правка наявної картки відділу — як доти', 'правку не пустило');
ok(!(await can(setDoc(doc(fin, 'payments/mono_10'), { orderId: '5000404', tag: 'prepay' }, { merge: true }))), 'платіж до номера, за бронню якого картки немає, — відмова', 'платіж пішов на мертвий номер!');
ok(await can(setDoc(doc(fin, 'payments/mono_10'), { orderId: '5000401', tag: 'prepay' }, { merge: true })), 'до живої картки #5000401 — привʼязується', 'до живої не привʼязався');
ok(await can(setDoc(doc(fin, 'payments/mono_10'), { tag: 'final' }, { merge: true })), 'підпис без зміни номера — як доти', 'тег не міняється');
ok(await can(setDoc(doc(fin, 'payments/mono_10'), { orderId: null, tag: null }, { merge: true })) &&
   await can(setDoc(doc(fin, 'payments/mono_10'), { orderId: '5000406', tag: 'prepay' }, { merge: true })), 'відвʼязали; номер без броні (стара картка) — привʼязується, як доти', 'до старої не привʼязався');

console.log('');
console.log('═══ ВЕРСІЇ КАРТОК (23.10): СТВОРЮЄ КОЖЕН, НЕ ПРАВИТЬ НІХТО, ПРИБИРАЄ ВЛАСНИК ═══');
const версія = { orderId: '1000147', name: 'Денис', state: 'design', _v: { at: '2026-10-23T10:00:00Z', by: 'art@loomiq', why: 'save' } };
ok(await can(setDoc(doc(mgr, 'designJobs/1000147/hist/2026-10-23T10-00-00Z'), версія)), 'версію картки відділу пише менеджер', 'версія відділу не записалась');
ok(await can(setDoc(doc(noRight, 'kanbanOrders/A/hist/2026-10-23T10-00-00Z'), { ...картка, _v: { at: '2026-10-23T10:00:00Z', by: 'test@loomiq', why: 'save' } })),
  'версію картки замовлення пише будь-хто з команди (і з правом лише «оплата»)', 'версія замовлення не записалась');
ok(!(await can(setDoc(doc(mgr, 'designJobs/1000147/hist/2026-10-23T10-00-00Z'), { ...версія, name: 'Інший' }))), 'версію не перепишеш', 'версію переписано!');
ok(!(await can(deleteDoc(doc(mgr, 'designJobs/1000147/hist/2026-10-23T10-00-00Z')))), 'менеджер версію не стирає', 'менеджер стер версію');
ok(await can(deleteDoc(doc(own, 'designJobs/1000147/hist/2026-10-23T10-00-00Z'))), 'власник (прибирання старих) — може', 'власник не зміг');

await env.cleanup();
emu.kill();
console.log('');
console.log(bad ? 'розходжень: ' + bad : 'номер замовлення видається лише раз, замовлення створюється неподільно — це гарантує база');
process.exit(bad ? 1 : 0);
