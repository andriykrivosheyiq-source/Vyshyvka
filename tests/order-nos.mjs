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

await env.cleanup();
emu.kill();
console.log('');
console.log(bad ? 'розходжень: ' + bad : 'номер замовлення видається лише раз — це гарантує база');
process.exit(bad ? 1 : 0);
