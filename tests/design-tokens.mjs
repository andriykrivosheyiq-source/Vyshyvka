/* Дизайн-система КП не розповзається назад.

   Ревізія звела 33 кеглі до восьми, 31 відступ до дванадцяти, 13 радіусів
   до п'яти й шість ваг до чотирьох. Без сторожа це протримається місяць:
   наступне правило пишеться на око, бо так швидше, і за пів року в файлі
   знову 12.5px поруч із 13px. Тест читає <style> в offer.html і не пускає
   в нього значень поза переліком.

   Браузер не потрібен — це розбір тексту.

   Запуск:  node tests/design-tokens.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(ROOT, 'offer.html'), 'utf8');
/* Коментарі прибираємо: вони прилипають до селектора наступного правила,
   і слово «:hover» у поясненні читалось би як саме правило. */
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'))
                .replace(/\/\*[\s\S]*?\*\//g, ' ');

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const list = a => a.slice(0, 6).map(x => '\n      ' + x).join('') + (a.length > 6 ? `\n      …і ще ${a.length - 6}` : '');

/* ── розбір на правила, з пам'яттю про @media ─────────────────────── */
function rules(text, media = null){
  const out = [];
  let i = 0;
  while(i < text.length){
    const j = text.indexOf('{', i);
    if(j < 0) break;
    const head = text.slice(i, j).trim();
    let d = 1, k = j + 1;
    while(k < text.length && d){
      if(text[k] === '{') d++;
      else if(text[k] === '}') d--;
      k++;
    }
    if(head.startsWith('@')){
      if(/^@(media|supports)\b/.test(head))
        out.push(...rules(text.slice(j + 1, k - 1), media ? media + ' ' + head : head));
    }else{
      out.push({ sel: head.replace(/\s+/g, ' '), body: text.slice(j + 1, k - 1), media });
    }
    i = k;
  }
  return out;
}
const R = rules(css);
const isRoot = r => /^:root\b/.test(r.sel);

/* ── 1. типографіка ───────────────────────────────────────────────── */
/* Стрілки, хрестик галереї, шеврони й плюс на порожньому ракурсі: там
   font-size задає розмір ГЛІФА, а не тексту, і шкала до нього не має
   стосунку. */
const GLYPH = /(pgal-ar|zoom-nav|zoom-x|pstep-b|pgal-plus|::after|::before)/;
const rawFs = [];
for(const r of R){
  if(isRoot(r) || GLYPH.test(r.sel)) continue;
  for(const m of r.body.matchAll(/font-size:\s*([0-9.]+)px/g))
    rawFs.push(`${r.sel} → ${m[1]}px`);
}
console.log('═══ ТИПОГРАФІКА ═══');
ok(rawFs.length === 0,
  'кеглі беруться з --fs-1…--fs-8, у правилах немає сирих пікселів',
  'кегль повз шкалу:' + list(rawFs));

/* 700 — лише там, де число і є головним змістом екрана */
const HEAVY_OK = /(\.hero h1|\.est-pay b|\.pb-total \.pb-v|\.sum-line\.big span:last-child|\.pcard-price)/;
const heavy = [], odd = [];
for(const r of R){
  for(const m of r.body.matchAll(/font-weight:\s*(\d+)/g)){
    const w = +m[1];
    if(![400, 500, 600, 700].includes(w)) odd.push(`${r.sel} → ${w}`);
    else if(w === 700 && !HEAVY_OK.test(r.sel)) heavy.push(r.sel);
  }
}
ok(odd.length === 0,
  'ваги лише 400 / 500 / 600 / 700',
  'вага поза набором:' + list(odd));
ok(heavy.length === 0,
  '700 стоїть тільки на заголовку, «Разом» і ціні — решта не кричить',
  'зайвий 700:' + list(heavy));

/* ── 2. відступи ──────────────────────────────────────────────────── */
const SPACE = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 56];
const offSpace = [];
for(const r of R){
  if(isRoot(r)) continue;
  for(const m of r.body.matchAll(/(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left))?:\s*([^;}]+)/g)){
    const v = m[1];
    if(/var\(|calc\(|env\(|%/.test(v)) continue;
    for(const n of v.matchAll(/(-?[0-9.]+)px/g)){
      const px = Math.abs(parseFloat(n[1]));
      if(!SPACE.includes(px)) offSpace.push(`${r.sel} → ${n[1]}px`);
    }
  }
}
console.log('');
console.log('═══ ВІДСТУПИ ═══');
ok(offSpace.length === 0,
  'відступи з кроку 2·4·6·8·10·12·16·20·24·32·40·56',
  'відступ повз крок:' + list(offSpace));

/* ── 3. радіуси ───────────────────────────────────────────────────── */
/* Складені значення («20px 20px 0 0») і 50% описують форму, а не рівень
   вкладеності — до шкали не належать. */
const offR = [];
for(const r of R){
  if(isRoot(r)) continue;
  for(const m of r.body.matchAll(/border-radius:\s*([^;}]+)/g)){
    const v = m[1].trim();
    if(/var\(|%|\s/.test(v)) continue;
    if(!/^0$/.test(v)) offR.push(`${r.sel} → ${v}`);
  }
}
console.log('');
console.log('═══ РАДІУСИ ═══');
ok(offR.length === 0,
  'радіуси беруться з --r-1…--r-4 і --r-pill',
  'радіус повз шкалу:' + list(offR));

/* ── 4. дотик ─────────────────────────────────────────────────────── */
/* На телефоні :hover залипає після натиску й тримається, доки не
   торкнешся іншого елемента. Кожне таке правило має жити під
   @media (hover:hover). */
const naked = R.filter(r => r.sel.includes(':hover') && !/hover:\s*hover/.test(r.media || ''))
               .map(r => r.sel);
console.log('');
console.log('═══ ДОТИК І КЛАВІАТУРА ═══');
ok(naked.length === 0,
  'усі :hover під @media (hover:hover) — на дотику не залипають',
  ':hover без охорони:' + list(naked));

const focus = R.filter(r => r.sel.includes(':focus-visible')).length;
ok(focus > 0,
  'видимий фокус із клавіатури описаний',
  'правил :focus-visible немає жодного');

/* ── 4½. три рівні, які тримають сторінку ─────────────────────────── */
/* Розділ (26) > назва товару (21) > усе решта. Доти розділ і товар були
   обидва 21 і відрізнялись лише вагою — сторінка йшла суцільною стрічкою
   товарів, і не було видно, де закінчується одна зона й починається інша.
   А ціна була 32: найбільший текст на всій сторінці, більший за заголовок
   розділу, — і картка читалась як цінник.

   Тест тримає саме порядок, а не конкретні пікселі: розділ мусить бути
   більшим за назву товару, а ціна — не більшою за розділ. */
const decl = (sel, prop) => {
  const r = R.filter(x => x.sel === sel && !x.media)[0];
  if(!r) return null;
  const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(r.body);
  return m ? m[1].trim() : null;
};
const FS = { '--fs-1':11, '--fs-2':13, '--fs-3':15, '--fs-4':17,
             '--fs-5':21, '--fs-6':26, '--fs-7':32, '--fs-8':38 };
const px = v => { const m = /var\((--fs-\d)\)/.exec(v || ''); return m ? FS[m[1]] : NaN; };
const hSec = px(decl('.sec-title', 'font-size'));
const hItem = px(decl('.pcard-name', 'font-size'));
const hPrice = px(decl('.pcard-price', 'font-size'));
console.log('');
console.log('═══ ІЄРАРХІЯ ═══');
console.log('  розділ ' + hSec + ' · товар ' + hItem + ' · ціна ' + hPrice);
ok(hSec > hItem,
  'заголовок розділу більший за назву товару: ' + hSec + ' проти ' + hItem,
  'розділ і товар одного кегля (' + hSec + ' / ' + hItem + ') — зони зливаються');
ok(hPrice <= hSec,
  'ціна не більша за заголовок розділу: ' + hPrice + ' проти ' + hSec,
  'ціна (' + hPrice + ') перекрикує заголовок розділу (' + hSec + ')');
ok(decl('.sec-title', 'text-align') === 'left',
  'заголовки розділів ліворуч — сторінка сканується вздовж однієї вертикалі',
  'заголовок розділу вирівняно не ліворуч: ' + decl('.sec-title', 'text-align'));
/* Кожен розділ пояснює, чим він відрізняється від сусіднього: без
   підзаголовка чотири блоки товарів читаються як один довгий. */
const heads = [...src.matchAll(/<h2 class="sec-title">([^<]+)<\/h2>'\s*\+\s*\n?\s*(?:\/\*[\s\S]*?\*\/\s*)?'?<p class="sec-sub">/g)]
  .map(m => m[1]);
const allHeads = [...src.matchAll(/<h2 class="sec-title">([^<]+)<\/h2>/g)].map(m => m[1]);
const MAIN = ['Ваша пропозиція', 'Оберіть варіант', 'Доповніть комплект'];
const noSub = MAIN.filter(h => allHeads.includes(h) && !heads.includes(h));
ok(noSub.length === 0,
  'у головних розділів є підзаголовок про те, що саме в них',
  'розділ без підзаголовка: ' + noSub.join(', '));

/* ── 5. токени оголошені ──────────────────────────────────────────── */
const root = R.filter(isRoot).map(r => r.body).join(' ');
const need = ['--fs-1', '--fs-8', '--s-2', '--s-56', '--r-1', '--r-pill'];
const miss = need.filter(t => !root.includes(t + ':'));
console.log('');
console.log('═══ ТОКЕНИ ═══');
ok(miss.length === 0,
  'шкали оголошені в :root',
  'бракує токенів: ' + miss.join(', '));

console.log('');
console.log(bad ? 'розходжень: ' + bad
                : 'дизайн-система КП ціла: шкали на місці, значень повз них немає');
process.exit(bad ? 1 : 0);
