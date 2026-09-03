/* Знижка на виріб — своя в кожного товару й не залежить від нанесення.

   Було так: виріб БЕЗ друку дисконтувався шкалою виробу, а виріб ІЗ друком
   не отримував її зовсім — увесь його рядок, і одяг, і нанесення, йшов за
   шкалою способу. Тобто перемикання DTF↔вишивка мовчки міняло ціну самої
   футболки, хоч футболка та сама й куплена за ті самі гроші.

   А ще шкала була одна на всі товари. Але футболка й худі куплені за різні
   гроші й з різною маржею: однакова знижка на них означає, що на одному ми
   заробляємо, а на другому дотуємо.

   Тепер:
     — виріб завжди йде за шкалою виробу — своєю в товара або загальною;
     — нанесення завжди йде за шкалою свого способу;
     — кількість для знижки на виріб рахується по ЦЬОМУ товару: 20 футболок
       і 20 худі — це не 40 футболок, бо в постачальника ціна падає за
       кожним товаром окремо;
     — немає жодної шкали виробу — усе рахується, як рахувалось.

   Браузер не потрібен: рушій цін — окремий файл, і тест викликає його
   напряму. Так само, як його викликають конструктор, сторінка КП і адмінка.

   Запуск:  node tests/garment-discount.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

/* Рушій в ізольованому кадрі: жодного браузера, жодної мережі. */
function engine(pricing){
  const win = { SITE_CONTENT: { pricing } };
  const ctx = vm.createContext({ window: win, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'loomiq-pricing.js'), 'utf8'), ctx);
  return win.LQ;
}

/* Модель цін навмисно з різними числами в кожній шкалі — щоб було видно,
   яка саме спрацювала. */
const PRICING = {
  methods: {
    dtf:   { price:[[100]], cost:[[40]], qtyFrom:[1], markup:2, minPrice:0,
             orderFee:0, orderCost:0, sketchFee:0, sketchCost:0, pieceFee:0, pieceCost:0,
             lead:{ qtyTiers:[] } },
    embro: { pricePer1000mm2:50, costPer1000mm2:20, minPrice:0, basePrices:[],
             orderFee:0, orderCost:0, sketchFee:0, sketchCost:0, pieceFee:0, pieceCost:0,
             tiers:[{from:1,coef:1},{from:10,coef:0.50}],   // шкала вишивки
             lead:{ qtyTiers:[] } }
  },
  tiers: [{from:1,coef:1},{from:10,coef:0.80}],             // загальна
  garmentTiers: [{from:1,coef:1},{from:10,coef:0.90}],      // на виріб, для всіх
  garmentTiersBy: { tshirt:[{from:1,coef:1},{from:10,coef:0.95}] }  // своя, у футболки
};

/* Позиція: виріб 1000 грн, нанесення 200 грн, вишивка. */
const item = (gid, units, extra) => Object.assign({
  method:'embro', units, gid, base:1000, coefPart:200, pieceFee:0,
  dtfCols:[], designs:['d1'], designKinds:['img']
}, extra || {});

console.log('═══ ВИРІБ І НАНЕСЕННЯ ДИСКОНТУЮТЬСЯ ОКРЕМО ═══');
{
  const LQ = engine(PRICING);
  const r = LQ.priceOrder([item('tshirt', 20)])[0];
  const p = r.parts;
  console.log('  виріб: ' + p.garmentBase + ' → ' + p.garment + ' (коеф ' + p.gcoef + ')');
  console.log('  нанесення: ' + p.appBase + ' → ' + p.app + ' (коеф ' + p.coef + ')');
  console.log('  за штуку: ' + r.unit);
  /* Головне. Футболка йде за СВОЄЮ шкалою — 0,95, — а не за шкалою вишивки
     (0,50) і не за загальною (0,80). */
  ok(p.garment === 950 && p.gcoef === 0.95,
    'виріб дисконтується власною шкалою товару: 1000 → 950',
    'виріб порахований не тією шкалою: ' + p.garment + ' (коеф ' + p.gcoef + ')');
  ok(p.app === 100 && p.coef === 0.5,
    'нанесення дисконтується шкалою вишивки: 200 → 100',
    'нанесення порахувалось не за своєю шкалою: ' + p.app);
  ok(r.unit === 1050,
    'за штуку 1050 грн — виріб і нанесення склались, кожен зі своєю знижкою',
    'ціна за штуку не та: ' + r.unit);
}

console.log('');
console.log('═══ СПОСІБ НАНЕСЕННЯ НЕ ЧІПАЄ ЦІНУ ВИРОБУ ═══');
/* Та сама футболка, той самий тираж — тільки друк замість вишивки. Ціна
   самої футболки не має зрушити ні на гривню: вона куплена за ті самі
   гроші. Доти вона дисконтувалась шкалою способу й змінювалась. */
{
  const LQ = engine(PRICING);
  const emb = LQ.priceOrder([item('tshirt', 20)])[0].parts;
  const dtf = LQ.priceOrder([item('tshirt', 20, { method:'dtf', dtfCols:[0] })])[0].parts;
  console.log('  вишивка: виріб ' + emb.garment + ' · друк: виріб ' + dtf.garment);
  ok(emb.garment === dtf.garment,
    'футболка коштує однаково і з вишивкою, і з друком: ' + emb.garment + ' грн',
    'ціна виробу поїхала від способу нанесення: ' + emb.garment + ' проти ' + dtf.garment);
}

console.log('');
console.log('═══ БЕЗ СВОЄЇ ШКАЛИ — ЗАГАЛЬНА НА ВИРІБ ═══');
{
  const LQ = engine(PRICING);
  const p = LQ.priceOrder([item('hoodie', 20)])[0].parts;
  console.log('  худі: 1000 → ' + p.garment + ' (коеф ' + p.gcoef + ')');
  ok(p.garment === 900 && p.gcoef === 0.9,
    'худі своєї шкали не має — працює загальна шкала виробу: 1000 → 900',
    'худі порахувалось не загальною шкалою: ' + p.garment);
}

console.log('');
console.log('═══ КІЛЬКІСТЬ РАХУЄТЬСЯ ПО ТОВАРУ ═══');
/* 6 футболок і 6 худі — це не 12 футболок. У постачальника ціна падає за
   кожним товаром окремо, і поріг «від 10» тут не досягнутий жодним. */
{
  const LQ = engine(PRICING);
  const res = LQ.priceOrder([item('tshirt', 6), item('hoodie', 6)]);
  console.log('  футболка: коеф ' + res[0].parts.gcoef + ' (тираж ' + res[0].parts.garmentQty + ')');
  console.log('  худі: коеф ' + res[1].parts.gcoef + ' (тираж ' + res[1].parts.garmentQty + ')');
  ok(res[0].parts.gcoef === 1 && res[1].parts.gcoef === 1,
    '6 футболок і 6 худі не дають порогу «від 10» жодному з них',
    'кількості змішались: ' + JSON.stringify([res[0].parts.gcoef, res[1].parts.gcoef]));
  const res2 = LQ.priceOrder([item('tshirt', 10), item('hoodie', 6)]);
  ok(res2[0].parts.gcoef === 0.95 && res2[1].parts.gcoef === 1,
    'а 10 футболок поріг дають — і тільки футболкам',
    'поріг спрацював не там: ' + JSON.stringify([res2[0].parts.gcoef, res2[1].parts.gcoef]));
}

console.log('');
console.log('═══ ШКАЛИ ВИРОБУ НЕМАЄ — УСЕ ЯК БУЛО ═══');
/* Найважливіша обіцянка для тих, хто нічого не налаштовував: поки шкала
   виробу порожня, ціни не змінюються ні на гривню. */
{
  const noGar = JSON.parse(JSON.stringify(PRICING));
  delete noGar.garmentTiers; delete noGar.garmentTiersBy;
  const LQ = engine(noGar);
  const p = LQ.priceOrder([item('tshirt', 20)])[0].parts;
  console.log('  виріб ' + p.garment + ' · нанесення ' + p.app + ' · за штуку ' +
    LQ.priceOrder([item('tshirt', 20)])[0].unit);
  ok(p.garment === 500 && p.app === 100,
    'без шкали виробу все йде за шкалою способу, як і раніше: 1000 → 500',
    'запасний шлях зламався: виріб ' + p.garment + ', нанесення ' + p.app);
}

console.log('');
console.log(bad
  ? 'розходжень: ' + bad
  : 'виріб має свою знижку, нанесення — свою, і вони не плутаються');
process.exit(bad ? 1 : 0);
