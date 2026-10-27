/* ПЕРЕХІД ГОДИННИКА НЕ ЗСУВАЄ СТРОКИ (27.10). 25.10.2026 у Києві перевели
   годинник на зимовий час — доба тривала 25 годин. Годинник етапів рахував
   «кінець дня» як «початок дня + 24 год», тож влучав у 23:00 того ж дня,
   стояв на місці до стелі кроків, і строки виробництва, закупівлі, акаунта
   й графічного дизайнера, що перетинали 25.10, зʼїжджали на добу й більше.
   Помітив тест `dz-side` — він рахує від «зараз» і після 25.10 почав падати.

   Тут дати фіксовані, тож тест не залежить від того, коли його запускають.
   Часовий пояс — Київ, як у цеху.

   Запуск:  node tests/dst-hours.mjs      (з кореня репозиторію)  */
process.env.TZ = 'Europe/Kyiv';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const win = {};
const ctx = { window: win, self: win, console, setTimeout, clearTimeout, Date, Math, JSON,
  navigator: { userAgent: '' }, localStorage: { getItem(){ return null; }, setItem(){} },
  document: { addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    createElement(){ return { style:{}, setAttribute(){}, appendChild(){} }; }, body: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'loomiq-design.js'), 'utf8'), ctx);
const D = win.LQDesign;
const H = 3600000;
const at = s => new Date(s).getTime();

console.log('═══ ПЕРЕХІД НА ЗИМОВИЙ ЧАС (25.10.2026, доба — 25 год) ═══');
/* 24.10 10:00 за Києвом (UTC+3) = 07:00 UTC. */
const from = at('2026-10-24T07:00:00Z');
const r72 = D.addWorkHours(from, 72, '');
ok(r72 - from === 72 * H, 'рівні 72 години через ніч переходу — це рівно 72 години, ні більше ні менше',
   'вийшло ' + ((r72 - from) / H) + ' год');
const r24 = D.addWorkHours(at('2026-10-25T00:30:00Z'), 24, '');
ok(r24 - at('2026-10-25T00:30:00Z') === 24 * H, 'старт у сам день переходу — теж рівно 24 години',
   'вийшло ' + ((r24 - at('2026-10-25T00:30:00Z')) / H) + ' год');
ok(D.workMs(from, from + 72 * H, '') === 72 * H, 'робочий час між мітками через 25.10 — 72 години',
   'вийшло ' + (D.workMs(from, from + 72 * H, '') / H) + ' год');

console.log('\n═══ ПЕРЕХІД НА ЛІТНІЙ ЧАС (29.03.2026, доба — 23 год) ═══');
const spring = at('2026-03-28T08:00:00Z');
const s48 = D.addWorkHours(spring, 48, '');
ok(s48 - spring === 48 * H, '48 годин через ніч весняного переходу — рівно 48', 'вийшло ' + ((s48 - spring) / H) + ' год');

console.log('');
console.log(bad ? '✗ Перехід годинника: ' + bad + ' перевірок не пройшло' : '✓ Строки не зʼїжджають через перехід годинника');
process.exit(bad ? 1 : 0);
