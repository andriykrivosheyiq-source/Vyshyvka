/* B2B: разова оплата за замовлення окремо від дизайну (Андрій, 06.10.2026).

   • `pricing.orderFeeAll` — одна на все замовлення (пакування, обробка),
     ділиться на ВСІ вироби погодженої частини, і на вироби без нанесення теж;
   • кожен ескіз — своя ставка за видом, «перший включено» немає:
     лого на грудях + напис на спині = картинка 450 + напис 350;
     те саме лого на кількох виробах — один ескіз;
   • допродаж разову за замовлення не платить;
   • поле порожнє (null) — стара модель, як була.

   Запуск:  node tests/b2b-order-fee.mjs  */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'loomiq-pricing.js'), 'utf8');
function engine(extra){
  const PRICING = Object.assign({
    methods: {
      embro: { orderFee:850, orderCost:300, sketchFee:450, sketchCost:150,
               text:{ sketchFee:350, sketchCost:100 }, tiers:[{ from:1, coef:1 }] },
      dtf:   { orderFee:450, orderCost:120, sketchFee:450, sketchCost:150,
               text:{ sketchFee:350, sketchCost:100 }, tiers:[{ from:1, coef:1 }] }
    },
    tiers:[{ from:1, coef:1 }], garmentTiers:[{ from:1, coef:1 }]
  }, extra);
  const ctx = { window:{ SITE_CONTENT:{ pricing:PRICING } } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.window.LQ;
}
const LQ = engine({ orderFeeAll:450, orderCostAll:100 });

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };

function fp(name, len, base){
  let h = 2166136261;
  for(const ch of name) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  let s = h, out = '';
  for(let i = 0; i < len; i++){ s = (s * 1664525 + 1013904223) >>> 0; out += Math.floor(s / 4294967296 * base); }
  return out;
}
function item(units, toks, extra){
  const ds = toks.map(t => ({ fp: t[0] === 'T' ? fp(t, 64, 5) : fp(t, 144, 10),
                              url: 'https://cdn.test/' + t + '.png', kind: t[0] === 'T' ? 'txt' : 'img' }));
  return Object.assign({ method:'embro', units, base:100, coefPart:0, pieceFee:0, gid:'tee',
    bare:false, designs:ds.map(d => d.fp), designUrls:ds.map(d => d.url),
    designKinds:ds.map(d => d.kind), designMm2:ds.map(() => 1000), dtfCols:[] }, extra || {});
}
const bare = (units, extra) => Object.assign({ bare:true, units, base:100, gid:'cap' }, extra || {});
function check(name, lq, list, want, opts){
  const got = lq.priceOrder(list, opts).map(r => r.feeShare);
  ok(got.join() === want.join(), name + ': ' + got.join(' · ') + ' ₴/шт',
     name + ': вийшло ' + got.join(' · ') + ', а має бути ' + want.join(' · '));
}

console.log('═══ Нова модель: 450 разово + кожен ескіз ═══');
// 450/10 разова + 450/10 лого + 350/10 напис
check('лого на грудях + напис на спині, 10 шт', LQ, [item(10, ['L1', 'T1'])], [125]);
check('лише лого, 10 шт', LQ, [item(10, ['L1'])], [90]);
// те саме лого на двох виробах — один ескіз: 450/20 + 450/20
check('те саме лого на футболці й худі', LQ, [item(10, ['L1']), item(10, ['L1'], { gid:'hood' })], [45, 45]);
// два різні лого — два ескізи, кожен на свої вироби
check('два різні лого', LQ, [item(10, ['L1']), item(10, ['L2'])], [68, 68]);
// виріб без нанесення теж несе частку разової: 450/10
check('виріб без нанесення поруч', LQ, [item(5, ['L1']), bare(5)], [135, 45]);
check('лише вироби без нанесення', LQ, [bare(9)], [50]);
// допродаж разову не платить, новий дизайн — ескіз
check('допродаж із новим лого', LQ, [item(10, ['L1']), item(5, ['L2'], { upsell:true })], [90, 90]);
check('допродаж із тим самим лого', LQ, [item(10, ['L1']), item(5, ['L1'], { upsell:true })], [90, 0]);
// «готовий макет» — дизайн нуль, разова лишається
check('макет клієнта готовий', LQ, [item(10, ['L1', 'T1'])], [45], { noDesignFee:true });
// DTF і вишивка в одному замовленні — разова одна на все
check('вишивка + DTF', LQ, [item(10, ['L1']), item(10, ['L1'], { method:'dtf' })], [68, 68]);

console.log('═══ Розклад ═══');
{
  const r = LQ.priceOrder([item(10, ['L1', 'T1'])])[0];
  const fl = r.parts.feeLines, sk = r.parts.sketches;
  ok(fl.length === 1 && fl[0].kind === 'order' && fl[0].fee === 450 && fl[0].units === 10,
     'рядок «Разова оплата за замовлення» 450 на 10 шт', 'рядки разових: ' + JSON.stringify(fl));
  ok(sk.length === 2 && sk.map(s => s.kind + s.fee).sort().join() === 'img450,txt350',
     'ескізи: картинка 450, напис 350', 'ескізи: ' + JSON.stringify(sk));
  ok(r.parts.costShare === 10 + 15 + 10, 'собівартість разових 35 ₴/шт', 'собівартість ' + r.parts.costShare);
  ok(r.unit === 100 + 125, 'ціна за штуку 225', 'ціна ' + r.unit);
  const b = LQ.priceOrder([bare(5), item(5, ['L1'])])[0];
  ok(b.parts.feeLines.length === 1 && b.parts.feeShare === 45 && b.unit === 145,
     'виріб без нанесення: 100 + 45 разової', 'без нанесення: ' + JSON.stringify(b));
}

console.log('═══ Порожнє поле — стара модель ═══');
const OLD = engine({ orderFeeAll:null });
check('лого + напис: підготовка 850 + ескіз напису 350', OLD, [item(10, ['L1', 'T1'])], [120]);
check('виріб без нанесення не платить', OLD, [item(5, ['L1']), bare(5)], [170, 0]);

console.log(bad ? '\n✗ ' + bad + ' не так' : '\n✓ усе так');
process.exit(bad ? 1 : 0);
