/* Разові за дизайн у B2B — уся таблиця правил і 300 випадкових замовлень.

   Правила (Андрій, 30.09):
     • повна підготовка — ОДНА на спосіб нанесення (вишивка й DTF окремо);
     • її несе логотип — завантажена картинка; з кількох логотипів той, що
       стоїть на найбільшій кількості виробів (за рівної — завжди той самий,
       хай як переставили позиції);
     • кожен інший логотип — додатковий ескіз, ділиться на свої вироби;
     • напис поруч із логотипом — ескіз напису; кожен ІНШИЙ текст свій ескіз,
       той самий текст на кількох виробах — один;
     • самі написи — повна підготовка напису, решта ескізи напису;
     • «не рахувати» — дизайн не платить нічого;
     • перефарбований логотип — той самий дизайн;
     • рекомендована з тим самим дизайном — нуль, з новим — ескіз (повну
       підготовку вже оплатив склад).

   Числа нижче — з тестової моделі цін. Вишивка: логотип 850 / ескіз 350,
   напис 480 / ескіз напису 250. DTF: 450 / 150 (написи тих самих ставок).

   Запуск:  node tests/b2b-fees.mjs  (з кореня репозиторію, без браузера)  */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PRICING = {
  methods: {
    embro: { orderFee:850, orderCost:300, sketchFee:350, sketchCost:150,
             text:{ orderFee:480, orderCost:200, sketchFee:250, sketchCost:150 },
             tiers:[{ from:1, coef:1 }] },
    dtf:   { orderFee:450, orderCost:120, sketchFee:150, sketchCost:30,
             tiers:[{ from:1, coef:1 }] }
  },
  tiers:[{ from:1, coef:1 }], garmentTiers:[{ from:1, coef:1 }]
};
const ctx = { window:{ SITE_CONTENT:{ pricing:PRICING } } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'loomiq-pricing.js'), 'utf8'), ctx);
const LQ = ctx.window.LQ;

let bad = 0, total = 0;
const ok = (c, g, w) => { total++; console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };

/* Відбитки. Картинка — 144 цифри 0–9, напис — 64 цифри 0–4 (так їх знімає
   конструктор). Різні малюнки розходяться набагато більше за межу злиття. */
function rnd(seed){ let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function fpOf(name, len, base){
  let h = 2166136261;
  for(const ch of name) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  const r = rnd(h); let out = '';
  for(let i = 0; i < len; i++) out += Math.floor(r() * base);
  return out;
}
/* Дизайн: L… — логотип, T… — напис. «L1~біж» — той самий L1, перефарбований:
   інші пікселі, але той самий вихідний файл. «!» у кінці — «не рахувати». */
function design(tok){
  const off = tok.endsWith('!'); if(off) tok = tok.slice(0, -1);
  const [name, recolor] = tok.split('~');
  const txt = name[0] === 'T';
  return {
    fp: txt ? fpOf(name, 64, 5) : fpOf(name + (recolor ? '~' + recolor : ''), 144, 10),
    url: 'https://cdn.test/' + name + '.png',
    kind: off ? 'off' : (txt ? 'txt' : 'img')
  };
}
function item(units, toks, extra){
  const ds = toks.map(design);
  return Object.assign({ method:'embro', units, base:0, coefPart:0, pieceFee:0, gid:'tee',
    bare:false, designs:ds.map(d => d.fp), designUrls:ds.map(d => d.url),
    designKinds:ds.map(d => d.kind), designMm2:ds.map(() => 1000), dtfCols:[] }, extra || {});
}
const fees = (list, opts) => LQ.priceOrder(list, opts).map(r => r.feeShare);
function check(name, list, want, opts){
  const got = fees(list, opts);
  ok(got.join() === want.join(), name + ': ' + got.join(' · ') + ' ₴/шт',
     name + ': вийшло ' + got.join(' · ') + ', а має бути ' + want.join(' · '));
}

console.log('═══ 1. ОДИН ТОВАР, 10 ШТ ═══');
check('1.1 один логотип', [item(10, ['L1'])], [85]);
check('1.2 той самий логотип спереду й на рукаві — один дизайн', [item(10, ['L1', 'L1'])], [85]);
check('1.3 логотип + інший логотип ззаду', [item(10, ['L1', 'L2'])], [120]);
check('1.4 логотип + напис: напис — ескіз напису, не друга підготовка', [item(10, ['L1', 'T1'])], [110]);
check('1.5 лише напис — підготовка напису', [item(10, ['T1'])], [48]);
check('1.6 два різні написи — підготовка напису + ескіз напису', [item(10, ['T1', 'T2'])], [73]);
check('1.7 той самий напис спереду й ззаду — один дизайн', [item(10, ['T1', 'T1'])], [48]);
check('1.8 логотип + той самий, перефарбований', [item(10, ['L1', 'L1~біж'])], [85]);
check('1.9 напис «не рахувати» — за нього нуль', [item(10, ['L1', 'T1!'])], [85]);
check('1.10 логотип «не рахувати» — підготовку несе напис', [item(10, ['L1!', 'T1'])], [48]);
check('1.11 усе «не рахувати» — разових немає', [item(10, ['L1!', 'T1!'])], [0]);
check('1.12 логотип + два різні написи', [item(10, ['L1', 'T1', 'T2'])], [135]);

console.log('');
console.log('═══ 2. КІЛЬКА ТОВАРІВ ═══');
check('2.1 світшоти 2+2: спереду той самий логотип, ззаду різні картинки',
  [item(2, ['L1', 'L2']), item(2, ['L1', 'L3'])], [388, 388]);
check('2.2 те саме, але ззаду різні написи',
  [item(2, ['L1', 'T1']), item(2, ['L1', 'T2'])], [338, 338]);
check('2.3 ззаду однаковий напис — один ескіз напису на 4 шт',
  [item(2, ['L1', 'T1']), item(2, ['L1', 'T1'])], [275, 275]);
check('2.4 худі 4 (логотип білий) + футболка 4 (той самий, бежевий)',
  [item(4, ['L1~біл'], { gid:'hoodie' }), item(4, ['L1~біж'])], [106, 106]);
check('2.5 худі 4 з логотипом A + кепка 6 з логотипом Б: підготовку несе Б',
  [item(4, ['L1'], { gid:'hoodie' }), item(6, ['L2'], { gid:'cap' })], [88, 142]);
check('2.6 логотип на 2 шт + напис на 10 шт: підготовку все одно несе логотип',
  [item(2, ['L1']), item(10, ['T1'])], [425, 25]);
check('2.7 порядок позицій переставлено — ті самі цифри',
  [item(6, ['L2'], { gid:'cap' }), item(4, ['L1'], { gid:'hoodie' })], [142, 88]);
check('2.8 рівний тираж — підготовку несе завжди той самий логотип',
  [item(5, ['L1']), item(5, ['L2'])], [170, 70]);
check('2.9 і після перестановки — той самий, а не «перший»',
  [item(5, ['L2']), item(5, ['L1'])], [70, 170]);

console.log('');
console.log('═══ 3. РІЗНІ СПОСОБИ НАНЕСЕННЯ ═══');
check('3.1 худі вишивка 5 + футболка DTF 5, той самий логотип — кожен спосіб свою підготовку',
  [item(5, ['L1'], { gid:'hoodie' }), item(5, ['L1'], { method:'dtf' })], [170, 90]);
check('3.2 DTF: два різні логотипи', [item(10, ['L1', 'L2'], { method:'dtf' })], [60]);
check('3.3 DTF: лише напис', [item(10, ['T1'], { method:'dtf' })], [45]);
check('3.4 вишивка логотип + DTF напис — у DTF логотипа немає, напис несе свою підготовку',
  [item(10, ['L1']), item(10, ['T1'], { method:'dtf' })], [85, 45]);

console.log('');
console.log('═══ 4. РЕКОМЕНДОВАНІ ═══');
check('4.1 рекомендована з тим самим логотипом — за дизайн нуль',
  [item(10, ['L1']), item(10, ['L1'], { upsell:true, gid:'cap' })], [85, 0]);
check('4.2 рекомендована з тим самим, але перефарбованим логотипом — теж нуль',
  [item(10, ['L1']), item(10, ['L1~біж'], { upsell:true, gid:'cap' })], [85, 0]);
check('4.3 рекомендована з новим логотипом — ескіз, а не друга підготовка',
  [item(10, ['L1']), item(10, ['L2'], { upsell:true, gid:'cap' })], [85, 35]);
check('4.4 рекомендована з тим самим написом — нуль',
  [item(10, ['L1', 'T1']), item(10, ['T1'], { upsell:true, gid:'cap' })], [110, 0]);
check('4.5 рекомендована з іншим написом — ескіз напису',
  [item(10, ['L1', 'T1']), item(10, ['T2'], { upsell:true, gid:'cap' })], [110, 25]);
check('4.6 склад без вишивки, рекомендована з вишивкою — вона й несе підготовку',
  [item(10, ['L1'], { method:'dtf' }), item(10, ['L2'], { upsell:true, gid:'cap' })], [45, 85]);

console.log('');
console.log('═══ 5. БЕЗ ОПЛАТИ ЗА ДИЗАЙН ═══');
check('5.1 «не брати за дизайн» — разових немає ніде',
  [item(2, ['L1', 'L2']), item(2, ['L1', 'T1'])], [0, 0], { noDesignFee:true });

console.log('');
console.log('═══ 6. РОЗКЛАД КАЖЕ ТЕ САМЕ, ЩО ЦІНА ═══');
{
  const r = LQ.priceOrder([item(2, ['L1', 'T1']), item(2, ['L1', 'T2'])]);
  const b = r[0].parts;
  const lines = (b.feeLines || []).map(l => l.kind + ':' + l.fee + '/' + l.units)
    .concat((b.sketches || []).map(s => 'ескіз ' + s.kind + ':' + s.fee + '/' + s.units));
  console.log('  ' + lines.join(' · '));
  ok(lines.join() === 'img:850/4,ескіз txt:250/2',
    'підготовка логотипа на 4 шт і ескіз свого напису на 2 шт',
    'розклад не той: ' + lines.join(' · '));
  const sum = (b.feeLines || []).concat(b.sketches || []).reduce((a, l) => a + l.fee / l.units, 0);
  ok(Math.round(sum) === b.feeShare, 'рядки розкладу дають рівно разову в ціні: ' + b.feeShare + ' ₴',
     'рядки дають ' + sum + ', а в ціні ' + b.feeShare);
  ok(Math.round(b.costShare) === Math.round(300 / 4 + 150 / 2),
    'собівартість разових іде тими самими рядками: ' + b.costShare + ' ₴',
    'собівартість розійшлась: ' + b.costShare);
}

console.log('');
console.log('═══ 7. 300 ВИПАДКОВИХ ЗАМОВЛЕНЬ ═══');
/* Кожне замовлення — від 1 до 7 позицій, обидва способи, логотипи з
   перефарбованими копіями, написи, «не рахувати», рекомендовані. Для
   кожного перевіряємо закони, а не числа: числа тут невідомі наперед. */
const R = rnd(20260930);
const pick = a => a[Math.floor(R() * a.length)];
const LOGOS = ['L1', 'L1~біж', 'L1~біл', 'L2', 'L3', 'L4'], TEXTS = ['T1', 'T2', 'T3'];
function randomOrder(){
  const n = 1 + Math.floor(R() * 7), list = [];
  for(let i = 0; i < n; i++){
    const toks = [], k = Math.floor(R() * 4);
    for(let j = 0; j < k; j++){
      let t = R() < 0.6 ? pick(LOGOS) : pick(TEXTS);
      if(R() < 0.1) t += '!';
      toks.push(t);
    }
    list.push(item(1 + Math.floor(R() * 20), toks, {
      method: R() < 0.7 ? 'embro' : 'dtf', gid: pick(['tee', 'hoodie', 'cap']),
      upsell: i > 0 && R() < 0.2, bare: !toks.length, id: 'p' + i }));
  }
  return list;
}
const who = d => d.url.replace(/~.*$/, '');                     // особа дизайну
const identity = (it, i) => (it.designKinds[i] === 'txt' ? 'T' : 'I') + ':' + who({ url: it.designUrls[i] });
const fail = {};
const note = (law, c, info) => { if(!c){ fail[law] = fail[law] || []; if(fail[law].length < 3) fail[law].push(info); } };
for(let n = 0; n < 300; n++){
  const list = randomOrder();
  const res = LQ.priceOrder(list);
  const tag = 'замовлення №' + n + ': ' + JSON.stringify(list.map(x =>
    [x.method, x.units, x.upsell ? 'u' : '', x.designKinds.join('/')]));
  // Закон 1. Той самий склад у будь-якому порядку — ті самі ціни кожної позиції.
  const perm = list.slice().sort(() => R() - 0.5);
  const res2 = LQ.priceOrder(perm);
  perm.forEach((x, k) => note('порядок', res2[k].unit === res[list.indexOf(x)].unit, tag));
  // Закон 2. Двічі той самий розрахунок — те саме (перевідкриття).
  note('повтор', JSON.stringify(LQ.priceOrder(list)) === JSON.stringify(res), tag);
  ['embro', 'dtf'].forEach(mk => {
    const base = list.map((x, k) => ({ x, r: res[k] }))
      .filter(o => !o.x.upsell && !o.x.bare && o.x.method === mk);
    const up = list.map((x, k) => ({ x, r: res[k] }))
      .filter(o => o.x.upsell && !o.x.bare && o.x.method === mk);
    // Закон 3. Повна підготовка в складі — рівно одна, якщо є що рахувати.
    const mains = {};
    base.forEach(o => (o.r.parts.feeLines || []).forEach(l => { mains[l.kind + '#' + l.gi] = l; }));
    const paid = base.some(o => o.x.designKinds.some(k => k !== 'off'));
    note('одна підготовка', Object.keys(mains).length === (paid ? 1 : 0), tag + ' ' + mk);
    // Закон 4. Є логотип — підготовку несе логотип.
    const hasImg = base.some(o => o.x.designKinds.some(k => k === 'img'));
    const main = Object.values(mains)[0];
    note('на логотипі', !hasImg || (main && main.kind === 'img'), tag + ' ' + mk);
    // Закон 5. Підготовку несе дизайн із найбільшим тиражем свого виду.
    if(main){
      const units = {};
      base.forEach(o => {
        const seen = {};
        o.x.designs.forEach((fp, i) => {
          if(o.x.designKinds[i] !== main.kind) return;
          const id = identity(o.x, i); if(seen[id]) return; seen[id] = 1;
          units[id] = (units[id] || 0) + o.x.units;
        });
      });
      note('найбільший тираж', main.units === Math.max(...Object.values(units)), tag + ' ' + mk);
    }
    // Закон 6. Кожен дизайн складу оплачено рівно один раз: підготовка або ескіз.
    const want = {}, got = {};
    base.forEach(o => o.x.designs.forEach((fp, i) => {
      const k = o.x.designKinds[i]; if(k === 'off') return;
      want[identity(o.x, i)] = 1;
    }));
    base.forEach(o => {
      (o.r.parts.feeLines || []).concat(o.r.parts.sketches || []).forEach(l => {
        const id = identity(o.x, l.di);
        got[id] = (got[id] || 0) + l.fee / l.units * o.x.units;
      });
    });
    note('кожен дизайн один раз', Object.keys(want).sort().join() === Object.keys(got).sort().join(),
      tag + ' ' + mk + ' треба ' + Object.keys(want) + ' взято ' + Object.keys(got));
    Object.keys(got).forEach(id => {
      const txt = id[0] === 'T', m = PRICING.methods[mk], t = (txt && m.text) ? m.text : m;
      const isMain = !!main &&
        base.some(o => (o.r.parts.feeLines || []).some(l => identity(o.x, l.di) === id));
      const rate = isMain ? (+t.orderFee || 0) : (+t.sketchFee || 0);
      note('зібрано рівно ставку', Math.abs(got[id] - rate) < 0.01,
        tag + ' ' + mk + ' ' + id + ': зібрано ' + got[id].toFixed(2) + ' з ' + rate);
    });
    // Закон 7. Рекомендована не несе повної підготовки, якщо склад її вже оплатив.
    up.forEach(o => note('рекомендована без підготовки',
      !paid || !(o.r.parts.feeLines || []).length, tag + ' ' + mk));
    // Закон 8. Рекомендована не платить за дизайн, який уже є в складі.
    const inBase = {};
    base.forEach(o => o.x.designs.forEach((fp, i) => { if(o.x.designKinds[i] !== 'off') inBase[identity(o.x, i)] = 1; }));
    up.forEach(o => (o.r.parts.feeLines || []).concat(o.r.parts.sketches || []).forEach(l =>
      note('рекомендована не платить за наявне', !inBase[identity(o.x, l.di)], tag + ' ' + mk)));
  });
  // Закон 9. «Не рахувати» — дизайн не з'являється ні в підготовці, ні в ескізах.
  list.forEach((x, k) => (res[k].parts.feeLines || []).concat(res[k].parts.sketches || [])
    .forEach(l => note('не рахувати', x.designKinds[l.di] !== 'off', tag)));
  // Закон 10. Перефарбування логотипа нічого не міняє.
  const recol = list.map(x => Object.assign({}, x, {
    designs: x.designs.map((fp, i) => x.designKinds[i] === 'img' ? fpOf('recolor' + n + '/' + list.indexOf(x) + '/' + i, 144, 10) : fp) }));
  const res3 = LQ.priceOrder(recol);
  note('перефарбування', res3.map(r => r.unit).join() === res.map(r => r.unit).join(), tag);
  // Закон 11. Розклад сходиться з ціною.
  res.forEach((r, k) => {
    const b = r.parts; if(b.bare) return;
    const s = (b.feeLines || []).concat(b.sketches || []).reduce((a, l) => a + l.fee / l.units, 0);
    note('розклад = ціна', Math.round(s) === b.feeShare, tag);
  });
}
['порядок', 'повтор', 'одна підготовка', 'на логотипі', 'найбільший тираж', 'кожен дизайн один раз',
 'зібрано рівно ставку', 'рекомендована без підготовки', 'рекомендована не платить за наявне',
 'не рахувати', 'перефарбування', 'розклад = ціна'].forEach(law =>
  ok(!fail[law], 'закон «' + law + '» тримається на всіх 300',
     'закон «' + law + '» порушено: ' + (fail[law] || []).join(' | ')));

console.log('');
console.log(bad ? 'розходжень: ' + bad + ' з ' + total : 'усі ' + total + ' перевірок зійшлись');
process.exit(bad ? 1 : 0);
