/* КОД СТОРІНОК МАЄ ХОЧА Б РОЗБИРАТИСЬ.

   Найдешевша й найдорожча поломка одночасно. Одне повторне оголошення —
   `const mainEl` там, де `mainEl` уже є, — і ВЕСЬ скрипт адмінки перестає
   розбиратись. Не «частина не працює»: не працює нічого, бо браузер навіть
   не доходить до виконання. Розділи порожні, кнопки мовчать, у консолі
   один рядок, якого ніхто не читає.

   Перевірки в наборі відкривають сторінку й дивляться на її поведінку —
   тобто вони це побачать, але дорогою ціною: браузер, три секунди,
   незрозумілий симптом «нічого не малюється». А відповідь на питання «чи
   розбирається код» коштує мілісекунди й називає рядок.

   Тому вона стоїть окремо й першою. Вона нічого не стверджує про поведінку
   — лише про те, що код взагалі є кодом.

   Запуск:  node tests/syntax.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

/* Окремі файли рушіїв. Їх підключають усі сторінки, тож поламаний файл
   валить одразу все — і сайт, і адмінку, і сторінку пропозиції. */
console.log('\n── Окремі файли');
['loomiq-pricing.js', 'loomiq-fingerprint.js', 'loomiq-design.js',
 'loomiq-cards.js', 'loomiq-select.js', 'loomiq-constructor.js'].forEach(f => {
  const p = path.join(ROOT, f);
  if(!fs.existsSync(p)) return;
  let err = '';
  try{ new Function(fs.readFileSync(p, 'utf8')); }catch(e){ err = e.message; }
  ok(!err, f, f + ' — ' + err);
});

/* Скрипти, вбудовані в сторінки. Саме тут і ховається повторне оголошення:
   файл великий, редагують його по шматочку, а область видимості одна на
   двадцять тисяч рядків. */
console.log('\n── Скрипти всередині сторінок');
const СТОРІНКИ = ['loomiqadmin.html', 'index.html', 'offer.html', 'offer-edit.html'];
СТОРІНКИ.forEach(name => {
  const p = path.join(ROOT, name);
  if(!fs.existsSync(p)) return;
  const html = fs.readFileSync(p, 'utf8');
  let i = 0, n = 0, поганих = [];
  while(true){
    const a = html.indexOf('<script', i);
    if(a < 0) break;
    const head = html.slice(a, html.indexOf('>', a) + 1);
    const b = html.indexOf('</script>', a);
    if(b < 0) break;
    i = b + 9;
    /* Підключені файли перевірено вище, а тип не-JS тут і не код. */
    if(/\ssrc=/.test(head)) continue;
    if(/type=/.test(head) && !/type=["']?(text\/javascript|module)/.test(head)) continue;
    const code = html.slice(html.indexOf('>', a) + 1, b);
    if(!code.trim()) continue;
    n++;
    try{ new Function(code); }
    catch(e){ поганих.push('блок ' + n + ' (рядок ~' +
      (html.slice(0, a).split('\n').length) + '): ' + e.message); }
  }
  ok(!поганих.length, name + ' — ' + n + ' ' + (n === 1 ? 'блок' : 'блоки') + ', усі розбираються',
     name + ' НЕ РОЗБИРАЄТЬСЯ:\n      ' + поганих.join('\n      '));
});

console.log(bad ? '\n✗ провалено перевірок: ' + bad : '\nкод розбирається');
process.exit(bad ? 1 : 0);
