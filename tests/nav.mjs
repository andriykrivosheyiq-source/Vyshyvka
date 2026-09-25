/* Ліве меню: порядок розділів і група «Налаштування».

   ЧОГО БРАКУВАЛО. Дванадцять пунктів поспіль, однаковим кеглем, без жодної
   групи. Щоденне — замовлення й чати — лежало впереміш із тим, куди
   заходять раз на тиждень: ставки, розмірні сітки, підрядники, доступи.
   Око щоразу перечитувало весь список, щоб знайти той самий Канбан.

   ЯК ТЕПЕР. Два напрями стоять парами — «Замовлення B2B + Чати B2B», далі
   «Замовлення B2C + Чати B2C», — бо це те саме замовлення, лише інший
   клієнт. «Канбан» і «B2C» перестали бути назвами: у меню написано, що це
   замовлення, і якого саме напряму. Рідкісне складено в одну кнопку
   «Налаштування» в самому низу.

   ПРОРАХУНОК. Розділ лишився, пунктом меню бути перестав: у конструктор
   заходять із картки замовлення, а не зі списку зліва. Кнопка жива — саме
   вона й перемикає вид, — просто її не показують.

   Запуск:  node tests/nav.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8876;
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
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];

const CONTENT = { team:[{ email:'test@loomiq', name:'Андрій', role:'owner' }] };

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);

/* Видно — це «займає місце на екрані», а не «є в розмітці». Саме цю
   різницю ми й перевіряємо: пункти групи в DOM стоять завжди. */
const SEEN = `(el => !!el && !!el.offsetParent && el.getBoundingClientRect().height > 0)`;

console.log('═══ ПОРЯДОК РОЗДІЛІВ ═══');
const top = await p.evaluate(`(() => {
  const seen = ${SEEN};
  return [...document.querySelectorAll('.nav > button, .nav > .nav-grp > .nav-grp-h')]
    .filter(seen).map(b => (b.querySelector('span') || {}).textContent.trim());
})()`);
console.log('  ' + top.join(' → '));
/* Фінанси стоять під аналітикою: обидва про те, «як ідуть справи», просто
   одне числами замовлень, а інше грошима. Налаштування лишаються в самому
   низу — у них заходять раз на тиждень. */
ok(top.join(' → ') === 'Задачі → Замовлення B2B → Чати B2B → Замовлення B2C → ' +
                       'Чати B2C → Аналітика → Фінанси → Налаштування',
  'напрями йдуть парами «замовлення + чати», далі аналітика й гроші, налаштування — внизу',
  'порядок не той: ' + top.join(' → '));

console.log('');
console.log('═══ ПРОРАХУНОК — НЕ ПУНКТ МЕНЮ, АЛЕ РОЗДІЛ ═══');
const calc = await p.evaluate(`(() => {
  const seen = ${SEEN};
  const b = document.querySelector('.nav button[data-view="calc"]');
  b.click();
  const v = document.getElementById('view-calc');
  return { there: !!b, seen: seen(b), opened: !!v && v.style.display === 'block',
           active: (document.querySelector('.nav button[data-view].active') || {}).dataset.view };
})()`);
console.log('  кнопка в меню: ' + calc.there + ' · видно: ' + calc.seen +
            ' · розділ відкрився: ' + calc.opened);
ok(calc.there && !calc.seen,
  'кнопка «Прорахунок» лишилась у меню, але її не показують',
  'кнопка або зникла, або її видно: ' + JSON.stringify(calc));
ok(calc.opened && calc.active === 'calc',
  'із картки замовлення розділ і далі відкривається тією самою кнопкою',
  'розділ не відкрився: ' + JSON.stringify(calc));

console.log('');
console.log('═══ ГРУПА ЗГОРНУТА, ПОКИ ЇЇ НЕ ВІДКРИЛИ ═══');
const shut = await p.evaluate(`(() => {
  const seen = ${SEEN};
  const g = document.getElementById('nav-set');
  const kids = [...g.querySelectorAll('button[data-view]')];
  return { open: g.classList.contains('is-open'),
           inDom: kids.map(b => b.dataset.view),
           seen: kids.filter(seen).length,
           aria: g.querySelector('.nav-grp-h').getAttribute('aria-expanded') };
})()`);
console.log('  всередині: ' + shut.inDom.join(', ') + ' · видно: ' + shut.seen);
/* Налаштування приватних замовлень стоять окремим розділом, а не в тому
   самому блоці, що формування цін: там машина корпоративного замовлення —
   шкали за тиражем, площа нанесення, поділ підготовки макета, — а в
   роздрібу цього немає зовсім. Поруч вони змушували б щоразу згадувати,
   яка з двох моделей діє зараз. */
ok(shut.inDom.join() === 'b2c,settings,photos,reviews,suppliers,team',
  'у групі шість розділів: B2C, ціни, конструктор, відгуки, підрядники, доступи',
  'склад групи не той: ' + shut.inDom.join(','));
ok(!shut.open && shut.seen === 0 && shut.aria === 'false',
  'згорнута група не показує жодного свого пункту',
  'група розкрита без запиту: ' + JSON.stringify(shut));

console.log('');
console.log('═══ ЗАГОЛОВОК ГРУПИ НІКУДИ НЕ ВЕДЕ ═══');
await p.click('#nav-set .nav-grp-h');
await p.waitForTimeout(300);
const open = await p.evaluate(`(() => {
  const seen = ${SEEN};
  const g = document.getElementById('nav-set');
  return { seen: [...g.querySelectorAll('button[data-view]')].filter(seen).length,
           /* Заголовок не має data-view, тож обробник розділів його не бере:
              вид лишився тим самим, який був до кліку. */
           still: (document.getElementById('view-calc') || {}).style.display,
           active: (document.querySelector('.nav button[data-view].active') || {}).dataset.view };
})()`);
console.log('  видно пунктів: ' + open.seen + ' · розділ на екрані: ' + open.active);
ok(open.seen === 6,
  'клік по заголовку показує всі шість пунктів',
  'група не розкрилась: ' + JSON.stringify(open));
ok(open.still === 'block' && open.active === 'calc',
  'сам заголовок розділів не перемикає — людина лишилась там, де була',
  'заголовок відкрив чужий розділ: ' + JSON.stringify(open));

console.log('');
console.log('═══ РОЗДІЛ ІЗ ГРУПИ ВІДКРИЛИ КОДОМ — ГРУПА РОЗКРИВАЄТЬСЯ САМА ═══');
const auto = await p.evaluate(`(() => {
  const seen = ${SEEN};
  const g = document.getElementById('nav-set');
  navGrpOpen(g, false);
  document.querySelector('.nav button[data-view="suppliers"]').click();
  return { open: g.classList.contains('is-open'),
           seen: [...g.querySelectorAll('button[data-view]')].filter(seen).length,
           mark: g.classList.contains('has-active'),
           on: (document.getElementById('view-suppliers') || {}).style.display };
})()`);
console.log('  розкрита: ' + auto.open + ' · видно: ' + auto.seen + ' · розділ: ' + auto.on);
ok(auto.open && auto.seen === 6 && auto.on === 'block',
  'відкритий розділ видно в меню, навіть коли групу перед тим згорнули',
  'людина стоїть у розділі, якого в меню не видно: ' + JSON.stringify(auto));

console.log('');
console.log('═══ УСЯ ГРУПА ЗАКРИТА ДОСТУПАМИ — ЗАГОЛОВКА НЕМАЄ ═══');
const denied = await p.evaluate(`(() => {
  const seen = ${SEEN};
  const g = document.getElementById('nav-set');
  g.querySelectorAll('button[data-view]').forEach(b => b.hidden = true);
  navGrpSync();
  const head = { gone: !seen(g.querySelector('.nav-grp-h')) };
  g.querySelectorAll('button[data-view]').forEach(b => b.hidden = false);
  g.querySelector('[data-view="team"]').hidden = true;
  navGrpSync();
  head.back = seen(g.querySelector('.nav-grp-h'));
  g.querySelectorAll('button[data-view]').forEach(b => b.hidden = false);
  navGrpSync();
  return head;
})()`);
ok(denied.gone && denied.back,
  'кнопка, яка розгортає порожнечу, зникає; лишився хоч один пункт — лишається й вона',
  'заголовок живе своїм життям: ' + JSON.stringify(denied));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'меню читається згори вниз: спершу робота, наприкінці — налаштування');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
