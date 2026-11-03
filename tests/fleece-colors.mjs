/* Кольори флісу — разова дія (03.11.2026).

   Андрій: «у худі з флісом лишився один синій… щоб там було 6 позицій, як
   у звичайного оверсайзу; синій не видаляти, а перейменувати в Індіго».

   Перевіряємо на тих самих даних, що лежали в базі 03.11:
     — фліс отримує ті самі кольори в тому ж порядку, що й «Худі оверсайз»;
     — «Синій» флісу лишається тим самим id `blue`, лише зветься «Індіго»
       (заведені замовлення не губляться, фото флісу своє);
     — решта кольорів беруть фото звичайного оверсайзу посиланням, усі ракурси;
     — фото, що вже лежить у флісу, не перезаписується;
     — колір флісу без пари не видаляється;
     — дія разова: прапорець `fleeceColors1`, вдруге нічого не пише;
     — без права «налаштування» нічого не пише.

   Запуск:  node tests/fleece-colors.mjs   (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
let bad = 0;
const ok = (c, msg) => { console.log('  ' + msg + (c ? ' ✓' : ' ✗')); if(!c) bad++; };

const a = html.indexOf("const FLEECE_SRC = 'hoodieover'");
const b = html.indexOf('function colorIdFromHex(', a);
ok(a > 0 && b > a, 'разова дія кольорів флісу є в адмінці');
const src = html.slice(a, b);
ok(/setTimeout\(\(\) => \{ try\{ fleeceColorsOnce\(\); \}catch\(e\)\{\} \}, 2500\);/.test(html),
  'запускається зі знімка документа контенту');

const SRC = [
  { id:'fume', name:'Фюме', hex:'#878792' }, { id:'black', name:'Чорний', hex:'#2c2727' },
  { id:'hf4b6d0', name:'Рожевий', hex:'#f4b6d0' }, { id:'hf0e7d2', name:'Кремовий', hex:'#f0e7d2' },
  { id:'h325080', name:'Індіго', hex:'#325080' }, { id:'h3f2e2f', name:'Шоколадний', hex:'#3f2e2f' }
];
const MAP = {};
SRC.forEach(c => ['front','back','view2','view3'].forEach(s => { MAP['hoodieover-' + c.id + '-' + s] = 'https://x/' + c.id + '-' + s; }));

function sandbox(content, setup){
  const sets = [];
  const ctx = {
    console, window: {}, contentLoaded: true, contentData: content, photosMap: Object.assign({}, content.map || {}),
    canSetup: () => setup,
    effectiveColors: id => { const ov = (ctx.contentData.productColors || {})[id]; return Array.isArray(ov) && ov.length ? ov.map(c => Object.assign({}, c)) : []; },
    PHOTOS_DOC: { set: (d, o) => { sets.push({ d: JSON.parse(JSON.stringify(d)), o }); return Promise.resolve(); } },
    syncSiteContent(){}, accLog(){}, toast(){}
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.fleeceColorsPlan = fleeceColorsPlan; this.fleeceColorsOnce = fleeceColorsOnce;', ctx);
  return { ctx, sets };
}

console.log('1. План на даних 03.11');
{
  const { ctx } = sandbox({}, true);
  const p = ctx.fleeceColorsPlan(SRC, [{ id:'blue', name:'Синій', hex:'#283c61' }], MAP);
  ok(JSON.stringify(p.list.map(c => c.name)) === JSON.stringify(['Фюме','Чорний','Рожевий','Кремовий','Індіго','Шоколадний']),
    'шість кольорів у порядку оверсайзу');
  const ind = p.list.find(c => c.name === 'Індіго');
  ok(ind && ind.id === 'blue' && ind.hex === '#325080', 'Синій → Індіго, той самий id blue, кружечок як в оверсайзу');
  ok(!p.list.some(c => c.id === 'h325080'), 'другого Індіго немає');
  ok(!Object.keys(p.photos).some(k => k.indexOf('-blue-') > 0 || k.indexOf('h325080') > 0), 'фото Індіго флісу — своє, не з оверсайзу');
  ok(Object.keys(p.photos).length === 20, 'п’ять нових кольорів × чотири ракурси = 20 фото');
  ok(p.photos['hoodieoverfleece-hf4b6d0-view3'] === 'https://x/hf4b6d0-view3', 'фото — те саме посилання');
  ok(!Object.keys(p.photos).some(k => k.indexOf('hoodieoverfleece-') !== 0), 'звичайний оверсайз не чіпаємо');
}

console.log('2. Нічого не губимо');
{
  const { ctx } = sandbox({}, true);
  const m = Object.assign({ 'hoodieoverfleece-black-front': 'https://own/black' }, MAP);
  const p = ctx.fleeceColorsPlan(SRC, [{ id:'blue', name:'Синій' }, { id:'olive', name:'Оливковий', hex:'#556b2f' }], m);
  ok(p.list[p.list.length - 1].id === 'olive', 'колір флісу без пари лишається в кінці');
  ok(!('hoodieoverfleece-black-front' in p.photos), 'фото, що вже лежить у флісу, не перезаписуємо');
  ok(p.photos['hoodieoverfleece-black-back'] === 'https://x/black-back', 'бракуючий ракурс додаємо');
}

console.log('3. Разово і лише з правом налаштувань');
{
  const content = { productColors: { hoodieover: SRC, hoodieoverfleece: [{ id:'blue', name:'Синій', hex:'#283c61' }] }, map: Object.assign({}, MAP) };
  const s1 = sandbox(content, true);
  await s1.ctx.fleeceColorsOnce();
  ok(s1.sets.length === 1, 'записано один раз');
  const d = s1.sets[0] && s1.sets[0].d;
  ok(d && d.fleeceColors1 === 1 && s1.sets[0].o && s1.sets[0].o.merge === true, 'з прапорцем, злиттям');
  ok(d && Object.keys(d.productColors).join() === 'hoodieoverfleece', 'список пишемо лише флісу');
  ok(d && d.productColors.hoodieoverfleece.length === 6, 'у базу — шість кольорів');
  await s1.ctx.fleeceColorsOnce();
  ok(s1.sets.length === 1, 'вдруге нічого не пише');
  const s2 = sandbox({ productColors: { hoodieover: SRC }, map: {} }, false);
  await s2.ctx.fleeceColorsOnce();
  ok(s2.sets.length === 0, 'без права налаштувань — нічого');
  const s3 = sandbox({ productColors: {}, map: {} }, true);
  await s3.ctx.fleeceColorsOnce();
  ok(s3.sets.length === 0, 'немає кольорів оверсайзу — нічого');
}

console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ усе гаразд');
process.exit(bad ? 1 : 0);
