/* Галерея макетів замовлення: другого файлу того самого логотипа не буває.

   ЧОМУ ЦЕ ІСНУЄ. Рушій цін упізнає макет за пікселями. Той самий логотип,
   завантажений двічі — окремо на худі й окремо на світшот, — після зняття
   фону дає два різні файли й два різні відбитки. Рушій чесно бачить два
   макети: один платить повну підготовку 850, другий додатковий ескіз 350.
   Замовлення з трьома дизайнами рахується як пʼять, і клієнт платить за
   роботу, якої не робили.

   Пояснити це машині неможливо: файли справді різні, а сітки прозорості в
   тонкого білого логотипа майже не перетинаються. Тож питання не в тому,
   як упізнати другий файл, а в тому, щоб він не зʼявлявся. Усі макети
   замовлення лежать плиткою, натиснув — лягає ТОЙ САМИЙ файл.

   ЩО ТУТ ПЕРЕВІРЯЄТЬСЯ:
     • у збереженій позиції лишається, ЩО це за макет, а не лише де він
       лежить: відбиток, адреса файлу, розмір і місце в частках. Без цього
       галереї нема з чого складатись, і вся система адрес не працює;
     • галерея збирає макети з усіх позицій замовлення, без повторів;
     • натиснув — лягає той самий файл, з тим самим розміром і місцем;
     • рішення «напис / не рахувати» знаходить СХОЖИЙ відбиток, а не лише
       точно такий самий: один макет не може нести два протилежні рішення.

   Запуск:  node tests/design-gallery.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8886;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1280, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});

console.log('═══ ЗБЕРЕЖЕНА ПОЗИЦІЯ ПАМʼЯТАЄ, ЩО ЦЕ ЗА МАКЕТ ═══');
/* `slimConfig` живе всередині сторінки й назовні не виставлений — беремо
   його з вихідного коду й виконуємо як є. Так перевіряється саме той код,
   що працює, а не його переказ у тесті. */
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const тіло = /function slimConfig\(cfg\)\{[\s\S]*?\n  \}/.exec(src);
ok(!!тіло, 'функцію збереження конфігурації знайдено в коді сторінки',
  'slimConfig у index.html не знайшлась — тест дивиться не туди');
if(тіло){
  const збережено = await p.evaluate((код) => {
    const f = new Function(код + '; return slimConfig;')();
    const шар = { x:12, y:-30, scale:1.4, rot:0, ar:1.5, fill:0.2, removeBg:true,
                  opaqueBox:{ x0:0.1, y0:0.1, x1:0.9, y1:0.9 },
                  url:'https://cdn/лого.png', cleanUrl:'https://cdn/лого.png',
                  fp:'444|0104', frac:0.31, fx:0.02, fy:-0.08,
                  text:null, kindFix:'txt' };
    /* Ще один шар — із base64 замість адреси. Саме через нього документ
       колись переставав уміщатись у базу, тож він має лишитись без адреси. */
    const важкий = Object.assign({}, шар, { url:'data:image/png;base64,AAAA',
                                            cleanUrl:'', origUrl:'', fp:'555|0202' });
    const out = f({ garmentId:'hoodie', colorId:'black', logos:{ front:[шар], back:[важкий] } });
    return { перед: out.logos.front[0], зад: out.logos.back[0],
             вага: JSON.stringify(out).length };
  }, тіло[0]);
  console.log('   у записі: ' + Object.keys(збережено.перед).join(' · '));
  ok(збережено.перед.fp === '444|0104' && збережено.перед.url === 'https://cdn/лого.png',
    'відбиток і адреса файлу лишаються в замовленні — за ними макет і впізнають',
    'макет зберігся без того, що його визначає: ' + JSON.stringify(збережено.перед));
  ok(збережено.перед.frac === 0.31 && збережено.перед.fx === 0.02 && збережено.перед.fy === -0.08,
    'і розмір із місцем у частках — щоб той самий макет ліг на сусідній виріб так само',
    'розкладка не збереглась: ' + JSON.stringify(збережено.перед));
  ok(збережено.перед.kindFix === 'txt',
    'вид дизайну їде разом із шаром, а не лишається в одній позиції',
    'вид не зберігся: ' + збережено.перед.kindFix);
  ok(збережено.зад.url === '' && збережено.зад.fp === '555|0202',
    'base64 в замовлення не потрапляє — саме через нього документ колись не вміщався',
    'у запис поїхав base64: ' + String(збережено.зад.url).slice(0, 40));
}

console.log('');
console.log('═══ ОДИН МАКЕТ — ОДНЕ РІШЕННЯ, НАВІТЬ КОЛИ ВІДБИТКИ РІЗНІ ═══');
/* Рівно випадок Андрія: два відбитки того самого напису, між якими
   0.0156 при порозі 0.03. Рушій вважає їх одним макетом; рішення
   менеджера доти шукалось за точним рядком і накривало лише один. */
const SHIM = path.join(ROOT, '_gallery_shim.html');
fs.writeFileSync(SHIM,
  '<!doctype html><meta charset="utf-8"><title>шим</title>' +
  '<script src="loomiq-fingerprint.js"></' + 'script>' +
  '<script src="loomiq-pricing.js"></' + 'script>');
await p.goto(HOST + '/_gallery_shim.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(400);
const близькі = await p.evaluate(() => {
  /* Два майже однакові відбитки: та сама сітка, різниця у дві клітинки. */
  const кол = '4'.repeat(432);
  const a = кол + '|' + '0'.repeat(140) + '4004';
  const b = кол + '|' + '0'.repeat(140) + '4044';
  const далекий = кол + '|' + '4'.repeat(144);
  return { однакові: window.LQ.sameFingerprint(a, b),
           відстань: window.LQ.fpDistance(a, b),
           різні: window.LQ.sameFingerprint(a, далекий),
           a, b, далекий };
});
console.log('   відстань між копіями: ' + близькі.відстань.toFixed(4));
ok(близькі.однакові && !близькі.різні,
  'рушій віддає назовні своє правило схожості — і воно розрізняє копію від іншого малюнка',
  'правило схожості працює не так: ' + JSON.stringify(близькі));

console.log('');
console.log('═══ РІШЕННЯ ЗНАХОДИТЬ СХОЖУ КОПІЮ ═══');
const адмін = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
const kw = /function kindWanted\(fix, fp\)\{[\s\S]*?\n\}/.exec(адмін);
ok(!!kw, 'пошук виду дизайну знайдено в коді адмінки',
  'kindWanted у loomiqadmin.html не знайшлась');
if(kw){
  const рішення = await p.evaluate(([код, f]) => {
    const kindWanted = new Function(код + '; return kindWanted;')();
    const мапа = {}; мапа[f.a] = 'txt';
    return { точно: kindWanted(мапа, f.a),
             схоже: kindWanted(мапа, f.b),
             чуже:  kindWanted(мапа, f.далекий) };
  }, [kw[0], близькі]);
  console.log('   точний збіг: ' + рішення.точно + ' · схожа копія: ' + рішення.схоже +
              ' · інший малюнок: ' + рішення.чуже);
  ok(рішення.точно === 'txt',
    'точний збіг працює, як і працював',
    'точний збіг зламався: ' + рішення.точно);
  ok(рішення.схоже === 'txt',
    'схожа копія того самого макета дістає те саме рішення — 240 ₴/шт замість 96 більше не буде',
    'схожа копія лишилась без рішення: ' + рішення.схоже);
  ok(!рішення.чуже,
    'а інший малюнок чужого рішення не підхоплює',
    'рішення розповзлось на інший малюнок: ' + рішення.чуже);
}

console.log('');
console.log('═══ ГАЛЕРЕЯ ЗБИРАЄ МАКЕТИ ЗАМОВЛЕННЯ БЕЗ ПОВТОРІВ ═══');
const кон = fs.readFileSync(path.join(ROOT, 'loomiq-constructor.js'), 'utf8');
const od = /function orderDesigns\(\)\{[\s\S]*?\n    \}/.exec(кон);
ok(!!od, 'галерею знайдено в коді конструктора', 'orderDesigns не знайшлась');
if(od){
  const список = await p.evaluate((код) => {
    /* Замовлення з чотирьох позицій. Той самий логотип стоїть на трьох із
       них — у галереї він має бути один. */
    const шар = (url, fp, extra) => Object.assign({ url, fp, frac:0.3, fx:0.01, fy:-0.05,
                                                    rot:0, removeBg:true }, extra || {});
    const cartItems = [
      { name:'Худі', config:{ logos:{ front:[шар('https://cdn/лого.png','A')],
                                      back:[шар('https://cdn/напис.png','B',{ kindFix:'txt' })] } } },
      { name:'Світшот', config:{ logos:{ front:[шар('https://cdn/лого.png','A')] } } },
      { name:'Кепка', config:{ logos:{ front:[шар('https://cdn/лого.png','A')] } } },
      { name:'Шопер', config:{ logos:{ front:[шар('https://cdn/інше.png','C')] } } }
    ];
    const orderLogos = () => ['https://cdn/з-картки.png'];
    const f = new Function('cartItems', 'orderLogos', код + '; return orderDesigns;')(cartItems, orderLogos);
    return f().map(d => ({ url:d.url, fp:d.fp, from:d.from, frac:d.frac,
                           fx:d.fx, kindFix:d.kindFix }));
  }, od[0]);
  console.log('   у галереї: ' + список.map(d => d.url.split('/').pop()).join(' · '));
  ok(список.length === 4,
    'три різні макети замовлення плюс логотип із картки клієнта — по одній плитці на файл',
    'галерея зібралась не так: ' + JSON.stringify(список.map(d => d.url)));
  ok(список.filter(d => /лого\.png/.test(d.url)).length === 1,
    'той самий логотип із трьох позицій стоїть у галереї ОДИН раз',
    'логотип задублювався: ' + JSON.stringify(список.map(d => d.url)));
  const напис = список.filter(d => /напис/.test(d.url))[0];
  ok(напис && напис.kindFix === 'txt' && напис.frac === 0.3 && напис.fx === 0.01,
    'плитка везе з собою вид дизайну, розмір і місце — макет ляже так, як стоїть на сусідній позиції',
    'плитка приїхала без розкладки: ' + JSON.stringify(напис));
  ok(список.some(d => /з-картки/.test(d.url)),
    'логотипи з картки клієнта лишаються в тому ж ряду — вони теж «що можна покласти»',
    'логотип із картки клієнта зник із галереї');
}

console.log('');
console.log('═══ ГАЛЕРЕЮ ВИДНО Й ЗРОЗУМІЛО, ЩО ВОНА РОБИТЬ ═══');
/* Андрій: «а де картинки, які повинні бути зверху в збиранні». Плитки
   малювались, але стояли всередині ряду «додати», нижче списку шарів, і
   без жодного підпису — ряд квадратиків, про який не здогадаєшся. Блок
   стоїть першим у панелі «Дизайн» і сам каже, що він таке. */
/* Розмітку плиток складають дві функції — сама галерея й спільний
   плиткороб, яким користується ще й смужка на сцені. Беремо обидві. */
const ot = /function orderTilesHtml\(list\)\{[\s\S]*?\n    \}/.exec(кон);
const olhOnly = /function orderLogosHtml\(\)\{[\s\S]*?\n    \}/.exec(кон);
const olh = (ot && olhOnly) ? [ot[0] + '\n' + olhOnly[0]] : null;
ok(!!olh, 'розмітку галереї знайдено в коді конструктора', 'orderLogosHtml не знайшлась');
if(olh && od){
  const вигляд = await p.evaluate(([код1, код2]) => {
    const f = new Function(код1 + '\n' + код2 + '; return orderLogosHtml;')();
    return { є: f(), пусто: (function(){
      /* Порожнє замовлення — блока не має бути взагалі: рамка з написом
         «макетів 0» гірша за її відсутність. */
      const g = new Function('orderDesigns', код2 + '; return orderLogosHtml;')(() => []);
      return g();
    })() };
  }, [
    od[0].replace('var cart = (typeof cartItems !== \'undefined\' && cartItems) ? cartItems : [];',
      'var cart = [{ name:"Худі", config:{ logos:{ front:[{ url:"https://cdn/a.png", fp:"A" }] } } },' +
      ' { name:"Кепка", config:{ logos:{ front:[{ url:"https://cdn/b.png", fp:"B" }] } } }];')
      .replace('orderLogos().forEach', '[].forEach'),
    olh[0]
  ]);
  console.log('   ' + (вигляд.є.match(/<div class="lqo-l">([^<]*)/) || [])[1]);
  ok(/lqo-box/.test(вигляд.є) && /Макети замовлення/.test(вигляд.є),
    'блок підписаний «Макети замовлення» — ряд квадратиків без підпису не читається',
    'галерея лишилась безіменним рядом: ' + вигляд.є.slice(0, 120));
  ok(/натисніть/.test(вигляд.є),
    'і сам каже, що робить натиск — інакше про це нізвідки дізнатись',
    'пояснення до галереї немає');
  ok(вигляд.пусто === '',
    'у замовленні без макетів блока немає зовсім — порожня рамка гірша за її відсутність',
    'порожня галерея все одно малюється: ' + вигляд.пусто);
}

console.log('');
console.log('═══ СТИЛІ ГАЛЕРЕЇ ДОЇЖДЖАЮТЬ У ПРОПОЗИЦІЮ ═══');
/* Андрій прислав знімок робочого місця: підпис є, а замість плиток — сірі
   рисочки, і «10 макетівнатисніть» одним словом. Конструктор усередині
   пропозиції бере стилі не з index.html, а з окремого файлу, який
   складальник вибирає ЗА ПЕРЕЛІКОМ СЕЛЕКТОРІВ. Галереї в тому переліку не
   було — і жодне її правило туди не потрапляло. На самому сайті все
   виглядало правильно, тому поламане було видно лише там, де працюють. */
const css = fs.readFileSync(path.join(ROOT, 'loomiq-constructor.css'), 'utf8');
['.lqo-box', '.lqo-l', '.lqo-b', '.lqo-row'].forEach(sel => {
  ok(css.indexOf(sel) >= 0,
    'правило ' + sel + ' є у стилях конструктора пропозиції',
    'правило ' + sel + ' туди не потрапило — саме так плитки й стали рисочками');
});
/* І сама причина: перелік складальника має знати про галерею. Перевіряємо
   його, а не лише наслідок, — інакше наступне правило галереї знову тихо
   лишиться на сайті. */
const build = fs.readFileSync(path.join(ROOT, 'tools/build-sites.py'), 'utf8');
ok(/CTOR_SELECTORS[\s\S]{0,400}\\\.lqo-/.test(build),
  'і складальник знає про галерею — наступне її правило теж доїде',
  'у переліку складальника галереї немає: правила губитимуться й далі');

console.log('');
console.log('═══ ГАЛЕРЕЯ НЕ ЗАЙМАЄ ВИСОТИ ПАНЕЛІ ═══');
/* Андрій: «щоб знизу воно не забивало там ціну». Блок у панелі відтісняв
   ціну й вибір нанесення вниз — а це те, заради чого панель і відкривають.
   Тепер макети стоять смужкою в правому верхньому куті самої сцени: панелі
   не коштують нічого й видні на будь-якій вкладці, навіть на «Розмірі». */
const body = fs.readFileSync(path.join(ROOT, 'loomiq-constructor-body.html'), 'utf8');
ok(/id="pmOrderArt"/.test(body) && /lqo-side/.test(body),
  'смужка макетів є в розмітці сцени, яка їде в пропозицію',
  'смужки на сцені немає — у пропозиції макети лишаться в панелі');
ok(css.indexOf('.lqo-side') >= 0,
  'і її правила теж у стилях конструктора пропозиції',
  'правил смужки в стилях немає — вона розсиплеться так само, як плитки');
if(olh && od){
  const уПанелі = await p.evaluate(([код1, код2]) => {
    const зроби = () => new Function(код1 + '\n' + код2 + '; return orderLogosHtml;')();
    const без = зроби()();
    /* А тепер сцена зі своїм кутом для макетів — панель має промовчати. */
    const el = document.createElement('div'); el.id = 'pmOrderArt';
    document.body.appendChild(el);
    const зі = зроби()();
    el.remove();
    return { без: без.length > 0, зі: зі };
  }, [
    od[0].replace('var cart = (typeof cartItems !== \'undefined\' && cartItems) ? cartItems : [];',
      'var cart = [{ name:"Худі", config:{ logos:{ front:[{ url:"https://cdn/a.png", fp:"A" }] } } }];')
      .replace('orderLogos().forEach', '[].forEach'),
    olh[0]
  ]);
  ok(уПанелі.без,
    'на сайті, де такого кута немає, блок у панелі лишається — макети мають бути десь',
    'на сайті галерея зникла зовсім');
  ok(уПанелі.зі === '',
    'а коли сцена має свою смужку — у панелі блока немає, і висота йде ціні',
    'макети малюються двічі: і на сцені, і в панелі');
}

console.log('');
try{ fs.unlinkSync(SHIM); }catch(e){}
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'той самий логотип лишається одним макетом на все замовлення');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
