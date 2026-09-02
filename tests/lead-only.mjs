/* На сайті одна дія — залишити заявку.

   Конструктор показував ту саму картину щомісяця: з тих, хто його відкрив,
   до кошика доходили одиниці, і чеки там були найменші. Людина приходить із
   задачею «одягнути команду», а не «зібрати виріб»: збирати їй нічим і
   ніколи, а рішення однаково ухвалюють не за годину і не самі.

   Тому для клієнта дверей у конструктор більше немає. Сам конструктор
   нікуди не дівся — ним щодня працюємо ми, і кожне КП збирається саме в
   ньому, — але вхід у нього тепер за `?manager=1`. Це і є головне, що
   стереже цей тест: одні двері зачинили, другі мусять лишитись відчиненими.

   Наповнення сторінки не змінилось. Змінилось лише те, куди ведуть кнопки.

   Запуск:  node tests/lead-only.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8800;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

/* Заявки нікуди не летять: воркер підмінений, база — заглушка. */
const leads = [];
async function openSite(query){
  const p = await browser.newPage({ viewport:{ width:1280, height:900 } });
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u))
      return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(/loomiq-lead\./.test(u)){
      try{ leads.push(JSON.parse(r.request().postData() || '{}')); }catch(e){ leads.push({}); }
      return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":true}' });
    }
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/index.html' + (query || ''), { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(3000);
  return p;
}
const errs = [];
const p = await openSite('');

console.log('═══ ОДНА ДІЯ НА СТОРІНЦІ ═══');
const cta = await p.evaluate(() => {
  const vis = el => !!(el && el.offsetParent !== null);
  return {
    /* Кожна кнопка, що вела в каталог, тепер кличе до заявки. */
    labels: [...document.querySelectorAll('[data-open-catalog]')]
      .filter(vis).map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    cart: [...document.querySelectorAll('.cart-header-btn')].filter(vis).length,
    menuCatalog: vis(document.getElementById('menuCatalogBtn')),
    menuCart: vis(document.getElementById('menuCartBtn')),
    /* Секції сторінки не чіпали — наповнення лишилось те саме. */
    sections: [...document.querySelectorAll('section')].length,
    catalogSection: !!document.getElementById('catalog')
  };
});
console.log('  кнопки: ' + JSON.stringify(cta.labels));
ok(cta.labels.length > 0 && cta.labels.every(t => /Залишити заявку/.test(t)),
  'усі кнопки, що вели в каталог, тепер ведуть у заявку',
  'лишились кнопки в каталог: ' + JSON.stringify(cta.labels));
ok(cta.cart === 0 && !cta.menuCart,
  'кошика на сайті немає — ні в шапці, ні в меню',
  'кошик лишився видимим: у шапці ' + cta.cart + ', у меню ' + cta.menuCart);
ok(!cta.menuCatalog,
  'пункт «Каталог» із меню прибрано',
  'у меню лишився «Каталог»');
/* Сторінку ми не переписували: секції, тексти й фото ті самі, змінився
   тільки шлях. Якщо секції почнуть зникати — це вже інша задача. */
ok(cta.catalogSection && cta.sections >= 8,
  'наповнення сторінки лишилось на місці (' + cta.sections + ' секцій, вітрина одягу теж)',
  'сторінка втратила секції: ' + cta.sections);

console.log('');
console.log('═══ КУДИ ВЕДЕ КЛІК ═══');
const goes = async (sel, what) => {
  await p.evaluate(() => {
    document.querySelectorAll('.contact-modal.open').forEach(m => m.classList.remove('open'));
  });
  // dispatchEvent, а не click: плаваюча кнопка живе за межами екрана, доки
  // сторінку не прокрутили, а нам треба перевірити шлях, а не видимість.
  await p.locator(sel).first().dispatchEvent('click');
  await p.waitForTimeout(700);
  const st = await p.evaluate(() => ({
    lead: !!document.querySelector('#contactModal.open'),
    catalog: !!document.querySelector('#catalogModal.open'),
    cart: !!document.querySelector('#cartModal.open'),
    product: !!document.querySelector('#productModal.open'),
    starter: !!document.querySelector('.lqs-wrap.open, #lqStarter.open')
  }));
  ok(st.lead && !st.catalog && !st.cart && !st.product && !st.starter,
    what + ' → форма заявки',
    what + ' відкрив не те: ' + JSON.stringify(st));
};
await goes('#floatCta', 'плаваюча кнопка');
await goes('#catalog .product', 'картка одягу у вітрині');
await goes('#promoUploadBtn', 'плашка «Завантажити логотип»');

console.log('');
console.log('═══ ФОРМА ═══');
const form = await p.evaluate(() => {
  const f = document.querySelector('#contactModal form');
  return f ? [...f.querySelectorAll('input')].map(i => i.getAttribute('placeholder') || i.type) : null;
});
console.log('  поля: ' + JSON.stringify(form));
/* Три поля, не більше: імʼя, кількість, телефон. Кожне зайве коштує
   помітної частки заявок, а решту менеджер спитає голосом. */
ok((form || []).length === 3 && /мʼя|м'я/.test(form[0]) && /одиниц/i.test(form[1]),
  'у формі рівно три поля: імʼя, кількість, телефон',
  'поля не ті: ' + JSON.stringify(form));

await p.fill('#contactModal [name="lead-name"]', 'Оксана');
await p.fill('#contactModal [name="lead-qty"]', '50');
await p.fill('#contactModal input[type="tel"]', '671234567');
await p.click('#contactModal .contact-call-btn');
await p.waitForTimeout(1500);
const saved = await p.evaluate(() => (window.__ADDED || [])[0] || null);
console.log('  у Telegram: ' + JSON.stringify((leads[0] || {}).context));
console.log('  у базу: ' + JSON.stringify(saved));
ok(leads.length === 1 && /671234567/.test((leads[0] || {}).phone || ''),
  'заявка пішла з номером — і рівно одна, без попереджень про збій',
  'заявку не надіслано або надіслано двічі: ' + JSON.stringify(leads));
/* Кількість — єдине, без чого не почати прорахунок. Питати її потім у
   переписці означає втратити ще пів дня. */
ok(/Оксана/.test((leads[0] || {}).context || '') && /50 од/.test((leads[0] || {}).context || ''),
  'разом з імʼям і кількістю — менеджеру є з чим дзвонити',
  'імʼя або кількість не доїхали: ' + JSON.stringify((leads[0] || {}).context));
/* І те саме в базу: у Telegram заявка живе в стрічці повідомлень, а в
   Канбан вона потрапляє звідси. */
ok(saved && saved.name === 'Оксана' && +saved.qty === 50,
  'у базу лягли й імʼя, і кількість — картка в Канбані буде з ними',
  'у базу доїхало не те: ' + JSON.stringify(saved));
ok(await p.evaluate(() => /Дякуємо/.test(document.querySelector('#contactModal form').textContent)),
  'людина бачить підтвердження, а не мовчання',
  'подяки після заявки немає');

console.log('');
console.log('═══ А НАМ КОНСТРУКТОР ПОТРІБЕН ═══');
/* Найважливіше в цьому тесті. Ми не вирізали конструктор — ми зачинили
   двері для клієнта. Кожне КП збирається саме в ньому, і якщо він
   зникне разом із каталогом, працювати стане нічим. */
await p.close();
const m = await openSite('?manager=1&start=catalog');
await m.waitForTimeout(1500);
const mgr = await m.evaluate(() => ({
  catalog: !!document.querySelector('#catalogModal.open'),
  cart: [...document.querySelectorAll('.cart-header-btn')].filter(el => el.offsetParent !== null).length,
  cards: document.querySelectorAll('#catalogProductGrid .product, #catalog .product').length
}));
console.log('  каталог відкритий: ' + mgr.catalog + ' · кошик у шапці: ' + mgr.cart +
            ' · карток: ' + mgr.cards);
ok(mgr.catalog && mgr.cart > 0 && mgr.cards > 0,
  'у режимі ?manager=1 каталог, кошик і товари на місці — прорахунок працює',
  'менеджерський режим теж закрився: ' + JSON.stringify(mgr));
await m.close();

console.log('');
console.log('помилки сторінки: ' + errs.length);
errs.slice(0, 4).forEach(e => console.log('  ' + e));
console.log(bad || errs.length
  ? 'розходжень: ' + (bad + errs.length)
  : 'клієнту — одна кнопка, нам — увесь конструктор');
await browser.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
