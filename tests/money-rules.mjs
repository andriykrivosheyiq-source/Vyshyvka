/* Правила бази для грошей (firestore.rules → payments) — на емуляторі
   Firestore (04.10).

   Андрій: «щоб платежі ніяк ніде нікуди не утікали». Інтерфейс можна
   обійти; база — ні. Перевіряємо саме базу:
     — рух із банку не видалити й не підправити (сума, дата, рахунок, ТТН);
     — рух «від банку» з адмінки не створити;
     — привʼязаний рух не перекинути в інше замовлення одним записом —
       лише відвʼязати й привʼязати;
     — привʼязати / відвʼязати / підписати — можна;
     — записи руками (зарплата, готівка) — як і доти, можна прибрати;
     — без права «Записувати оплату» — ні читати, ні писати.

   Потрібні Java, firebase-tools і @firebase/rules-unit-testing. Де їх
   немає — тест каже «пропущено» і не падає (у хмарній сесії їх ставить
   npm i у /tmp/claude-0/emu, див. handoff.md).

   Запуск:  node tests/money-rules.mjs      (з кореня репозиторію)  */
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
  await setDoc(doc(db, 'loomiq/photos'), { acl: { test_loomiq: { pay: true }, art_loomiq: { edit: true } } });
  await setDoc(doc(db, 'payments/mono_1'), { at: '2026-10-01T10:00:00Z', amount: 1500, acc: 'mono1', src: 'mono', counter: 'Асія', desc: 'за футболки' });
  await setDoc(doc(db, 'payments/npc_2045'), { at: '2026-10-02T10:00:00Z', amount: 2080, acc: 'np1', src: 'np', ttn: '2045', orderId: '2000777', tag: 'cod' });
  await setDoc(doc(db, 'payments/man_1'), { at: '2026-10-02T10:00:00Z', amount: -9000, acc: 'mono1', src: 'salary' });
});
const fin = env.authenticatedContext('u1', { email: 'test@loomiq' }).firestore();
const art = env.authenticatedContext('u2', { email: 'art@loomiq' }).firestore();

console.log('═══ РУХ ІЗ БАНКУ НЕ ЧІПАЄТЬСЯ ═══');
ok(await can(getDoc(doc(fin, 'payments/mono_1'))), 'з правом на гроші рухи читаються', 'не читаються');
ok(!(await can(deleteDoc(doc(fin, 'payments/mono_1')))), 'рух із банку не видалити', 'рух із банку видалено!');
ok(!(await can(setDoc(doc(fin, 'payments/mono_1'), { amount: 15000 }, { merge: true }))), 'суму руху з банку не змінити', 'суму змінено!');
ok(!(await can(setDoc(doc(fin, 'payments/mono_1'), { at: '2025-01-01T00:00:00Z', acc: 'mono2' }, { merge: true }))),
  'дату й рахунок — теж', 'дату/рахунок змінено!');
ok(!(await can(setDoc(doc(fin, 'payments/npc_2045'), { ttn: '9999' }, { merge: true }))), 'ТТН у русі наложки не підмінити', 'ТТН змінено!');
ok(!(await can(setDoc(doc(fin, 'payments/mono_1'), { src: 'manual' }, { merge: true }))),
  'і «перетворити» його на ручний запис, щоб потім видалити, — не можна', 'src змінено!');
ok(!(await can(setDoc(doc(fin, 'payments/fake'), { at: '2026-10-03T00:00:00Z', amount: 50000, acc: 'mono1', src: 'mono' }))),
  'рух «від банку» з адмінки не створити', 'підроблене надходження створено!');

console.log('');
console.log('═══ ПРИВʼЯЗКА ═══');
ok(await can(setDoc(doc(fin, 'payments/mono_1'), { orderId: '1000501', tag: 'prepay', linkedBy: 'test@loomiq',
  linkHist: [{ to: '1000501' }] }, { merge: true })), 'вільний рух привʼязується до замовлення', 'не привʼязався');
ok(!(await can(setDoc(doc(fin, 'payments/mono_1'), { orderId: '2000101' }, { merge: true }))),
  'привʼязаний рух не перекинути в інше замовлення одним записом', 'платіж перекинуто мовчки!');
ok(await can(setDoc(doc(fin, 'payments/mono_1'), { tag: 'final' }, { merge: true })), 'підпис (тег) міняється', 'тег не міняється');
ok(await can(setDoc(doc(fin, 'payments/mono_1'), { orderId: null, tag: null }, { merge: true })), 'відвʼязати — можна', 'не відвʼязався');
ok(await can(setDoc(doc(fin, 'payments/mono_1'), { orderId: '2000101', tag: 'prepay' }, { merge: true })),
  'і після відвʼязки — привʼязати до іншого', 'не привʼязався після відвʼязки');
ok(await can(setDoc(doc(fin, 'payments/npc_2045'), { auditOk: ['cod_back:2045'] }, { merge: true })),
  'позначка Звірки «гаразд» пишеться', 'позначка не пишеться');

console.log('');
console.log('═══ ЗАПИСИ РУКАМИ Й ПРАВА ═══');
ok(await can(addDoc(collection(fin, 'payments'), { at: '2026-10-03T00:00:00Z', amount: 700, acc: 'mono1', src: 'manual' })),
  'платіж руками записується', 'ручний не записався');
ok(await can(setDoc(doc(fin, 'payments/man_1'), { amount: -9500 }, { merge: true })) && await can(deleteDoc(doc(fin, 'payments/man_1'))),
  'ручний запис (зарплата) — правиться й прибирається, як доти', 'ручний не прибрався');
ok(!(await can(getDoc(doc(art, 'payments/mono_1')))) && !(await can(setDoc(doc(art, 'payments/x'), { amount: 1, src: 'manual' }))),
  'без права «Записувати оплату» — ні читати, ні писати', 'дизайнер бачить гроші!');

await env.cleanup();
emu.kill();
console.log('');
console.log(bad ? 'розходжень: ' + bad : 'база сама не дає загубити чи підмінити платіж');
process.exit(bad ? 1 : 0);
