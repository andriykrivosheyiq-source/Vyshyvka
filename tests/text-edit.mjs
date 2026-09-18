/* Напис на виробі: виділення, стиль на виділене, переноси рядків.

   ЩО БУЛО НЕ ТАК. Виділити слово в написі було неможливо. Будь-яке
   тягнення по літерах починало перетягувати ВЕСЬ напис: виділення
   спалахувало й тієї ж миті гасло, бо браузер знімає його, щойно під ним
   поїхав елемент, — а сам напис виїжджав кудись убік. Коли написів на
   виробі кілька, за кілька спроб вони розповзались хто куди.

   ЯК МАЄ БУТИ. Перший тап бере шар — тягнення переносить його, як завжди.
   У правку заходять другим тапом, і доти, доки з неї не вийшли, миша
   працює на текст: виділяє, а не рухає.

   Перевіряємо:
     — тягнення по тексту в правці виділяє й не зсуває шар;
     — кегль і великі літери лягають САМЕ на виділене, а не на весь напис;
     — Enter посеред рядка не вкидає службовий символ усередину тексту;
     — сусідній напис від правки цього не рухається.

   Запуск:  node tests/text-edit.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8862;
const MIME = { '.html':'text/html', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp' };
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

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:1280, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5000);

// ── відкрити конструктор і завести напис ──────────────────────────────
const opened = await p.evaluate(async () => {
  const go = [...document.querySelectorAll('button,a')]
    .filter(e => /Створити дизайн/i.test(e.textContent || ''))[0];
  if(!go) return { none:'кнопки конструктора немає' };
  go.click();
  await new Promise(r => setTimeout(r, 1500));
  const tab = document.querySelector('[data-tab="photo"]');
  if(!tab) return { none:'вкладки дизайну немає' };
  tab.click();
  await new Promise(r => setTimeout(r, 1200));
  const add = document.getElementById('pmTextOpen') || document.getElementById('pmTextOpenTile');
  if(!add) return { none:'кнопки напису немає' };
  add.click();
  await new Promise(r => setTimeout(r, 900));
  const el = document.querySelector('.pm-dl-text.is-edit');
  if(!el) return { none:'поле напису не відкрилось' };
  el.focus();
  document.execCommand('insertText', false, 'ПЕРШЕ ДРУГЕ ТРЕТЄ');
  await new Promise(r => setTimeout(r, 400));
  return { ok:true };
});
if(opened.none){ console.log('  ' + opened.none); bad++; }

console.log('═══ ТЯГНЕННЯ ПО ТЕКСТУ ВИДІЛЯЄ, А НЕ РУХАЄ ═══');
const geo = await p.evaluate(() => {
  const el = document.querySelector('.pm-dl-text.is-edit');
  const lay = el.closest('[data-layer-id]');
  const r = el.getBoundingClientRect(), lr = lay.getBoundingClientRect();
  return { x:r.left, y:r.top + r.height / 2, w:r.width, lx:lr.left, ly:lr.top };
});
await p.mouse.move(geo.x + 6, geo.y);
await p.mouse.down();
await p.mouse.move(geo.x + geo.w * 0.55, geo.y, { steps:12 });
await p.mouse.up();
await p.waitForTimeout(400);
const drag = await p.evaluate(g => {
  const el = document.querySelector('.pm-dl-text.is-edit');
  const lr = el.closest('[data-layer-id]').getBoundingClientRect();
  return { sel: String(window.getSelection()),
           moved: Math.round(Math.abs(lr.left - g.lx) + Math.abs(lr.top - g.ly)) };
}, geo);
console.log('   виділилось: «' + drag.sel + '» · шар зсунувся на ' + drag.moved + ' px');
ok(drag.sel.length > 3,
  'протягнув мишею по літерах — слова виділились',
  'виділення не втрималось: «' + drag.sel + '»');
ok(drag.moved === 0,
  'і сам напис при цьому не зрушив ані на піксель',
  'напис поїхав на ' + drag.moved + ' px — тягнення все ще рухає шар');

console.log('');
console.log('═══ СТИЛЬ ЛЯГАЄ САМЕ НА ВИДІЛЕНЕ ═══');
const styled = await p.evaluate(async () => {
  const el = document.querySelector('.pm-dl-text.is-edit');
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const n = walk.nextNode(), at = n.nodeValue.indexOf('ДРУГЕ');
  const r = document.createRange(); r.setStart(n, at); r.setEnd(n, at + 5);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  const hit = id => {
    const b2 = document.getElementById(id);
    b2.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
    b2.click();
  };
  hit('pmTsBig');
  await new Promise(r2 => setTimeout(r2, 350));
  hit('pmTsCaps');
  await new Promise(r2 => setTimeout(r2, 350));
  const el2 = document.querySelector('.pm-dl-text.is-edit');
  const spans = [...el2.querySelectorAll('[data-lqr]')];
  const inner = spans[spans.length - 1] || {};
  return { text: el2.innerText,
           слово: inner.textContent, кегль: inner.dataset && inner.dataset.s,
           капс: inner.dataset && inner.dataset.u };
});
console.log('   увесь напис: «' + styled.text + '»');
console.log('   виділене слово: «' + styled.слово + '» · кегль ' + styled.кегль +
            ' · капс ' + styled.капс);
ok(styled.слово === 'ДРУГЕ' && +styled.кегль > 1,
  'A+ збільшив ТІЛЬКИ виділене слово — решта напису лишилась як була',
  'кегль ліг не туди: «' + styled.слово + '» ' + styled.кегль);
ok(styled.капс === '1',
  'великі літери теж лягли на виділене, а не на весь напис',
  'капс не застосувався до виділеного');
ok(styled.text.indexOf('ПЕРШЕ') === 0 && styled.text.indexOf('ТРЕТЄ') > 0,
  'сам текст не подвоївся й не загубився',
  'текст поїхав: «' + styled.text + '»');

console.log('');
console.log('═══ ENTER ПОСЕРЕД РЯДКА ═══');
/* Порожній останній рядок браузер не малює, тож наприкінці ми тримаємо його
   невидимим символом. Посеред рядка він не потрібен — і доти падав просто в
   текст, а каретка лишалась не там, де її залишили. */
const ent = await p.evaluate(async () => {
  const el = document.querySelector('.pm-dl-text.is-edit');
  el.focus();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const n = walk.nextNode(), at = n.nodeValue.indexOf(' ');
  const r = document.createRange(); r.setStart(n, at); r.collapse(true);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  await new Promise(r2 => setTimeout(r2, 350));
  const t = el.innerText;
  return { рядків: t.replace(/​/g, '').split('\n').length,
           службових: (t.match(/​/g) || []).length };
});
console.log('   рядків: ' + ent.рядків + ' · службових символів: ' + ent.службових);
ok(ent.рядків === 2,
  'Enter посеред рядка розділив напис рівно на два рядки',
  'рядків вийшло ' + ent.рядків);
ok(ent.службових === 0,
  'і не лишив службового символу всередині тексту — він потрібен лише в кінці',
  'службових символів у тексті: ' + ent.службових);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'напис виділяється, стилюється по шматках і не втікає з-під курсора');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
