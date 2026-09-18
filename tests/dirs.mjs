/* Два напрями: B2B і B2C.

   B2B — те, що працює сьогодні: логотипи для компаній, іменна пропозиція,
   тираж під замовника. B2C — інший бізнес-процес: принти, фото, приватна
   людина замість компанії. Тримати їх в одній воронці означало б щодня
   пояснювати кожному, які колонки його, а які чужі.

   Тому замовлення лежать РІЗНИМИ колекціями — і гроші рахуються по напряму
   самі собою, бо аналітика читає ті самі замовлення. А вхід, люди, каталог
   і постачальники спільні: худі базове чорне — той самий виріб, кому б його
   не продавали, а два однакові списки розійшлися б за місяць.

   Перевіряємо:
     — перемикач напряму стоїть у шапці й показує, де людина зараз;
     — він справді міняє колекцію, з якої читаються замовлення;
     — напрям роздається так само, як дошка: новий не відкривається всім;
     — кому відкрито один напрям, перемикати нема чого — кнопок немає;
     — і чужий напрям не можна ввімкнути в обхід.

   Запуск:  node tests/dirs.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8866;
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
const p = await b.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);

console.log('═══ ПЕРЕМИКАЧ У ШАПЦІ ═══');
const sw = await p.evaluate(() => {
  const box = document.getElementById('dir-switch');
  if(!box) return null;
  const inTop = !!box.closest('.topbar');
  return { inTop, кнопки: [...box.querySelectorAll('button')].map(x => x.textContent.trim()),
           обраний: (box.querySelector('.is-on') || {}).textContent || '' };
});
console.log('   ' + (sw ? sw.кнопки.join(' · ') + ' → зараз «' + sw.обраний.trim() + '»' : 'немає'));
ok(sw && sw.inTop, 'перемикач напряму стоїть у шапці, поруч із назвою',
  'перемикача немає або він не в шапці');
ok(sw && sw.кнопки.length === 2,
  'обидва напрями на видноті — людина бачить не лише де вона, а й що є друге місце',
  'напрямів не два: ' + JSON.stringify(sw && sw.кнопки));

console.log('');
console.log('═══ НАПРЯМ МІНЯЄ КОЛЕКЦІЮ ЗАМОВЛЕНЬ ═══');
/* Це і є вся суть: замовлення B2C не мають лежати поруч із B2B. Якби напрям
   міняв лише вигляд, перше ж збереження поклало б картку не туди. */
const cols = await p.evaluate(() => {
  const was = LQ_DIR;
  const a = dirMeta(LQ_DIR).col;
  setDir('b2c'); const b2 = dirMeta(LQ_DIR).col;
  setDir(was);   const c = dirMeta(LQ_DIR).col;
  return { a, b2, c, різні: a !== b2 };
});
console.log('   ' + cols.a + ' → ' + cols.b2 + ' → ' + cols.c);
ok(cols.різні && cols.a === 'kanbanOrders' && cols.b2 === 'b2cOrders',
  'кожен напрям читає свою колекцію — замовлення не змішуються',
  'колекція не міняється: ' + JSON.stringify(cols));
ok(cols.c === cols.a, 'і повернення назад повертає ту саму колекцію',
  'назад не повернулось: ' + cols.c);

console.log('');
console.log('═══ НАПРЯМ РОЗДАЄТЬСЯ, А НЕ ВІДКРИВАЄТЬСЯ ВСІМ ═══');
const acc = await p.evaluate(() => ({
  дизайнер: presetOf('designer').dirs,
  виробництво: presetOf('production').dirs,
  власник: presetOf('owner').dirs,
  менеджер: presetOf('manager').dirs
}));
console.log('   ' + Object.keys(acc).map(k => k + ': ' + acc[k].join('+')).join(' · '));
ok(acc.дизайнер.join() === 'b2b' && acc.виробництво.join() === 'b2b',
  'новий напрям не відкрився всім у день, коли його завели',
  'B2C роздався сам: ' + JSON.stringify(acc));
ok(acc.власник.length === 2,
  'власник бачить обидва — інакше він не зміг би налаштувати другий',
  'власнику B2C не видно');

console.log('');
console.log('═══ ЧУЖИЙ НАПРЯМ НЕ ВВІМКНУТИ ═══');
/* Кнопки в такої людини немає, але виклик у консолі має теж нічого не
   дати: обмеження, яке тримається на схованій кнопці, — не обмеження. */
const guard = await p.evaluate(() => {
  /* Доступи читаються з contentData.team, а не з чернетки редактора —
     саме тому підміняємо там. */
  const back = contentData.team;
  contentData.team = [{ email: myEmail(), name:'Дизайнер', role:'designer',
                        acc: { ui:'designer', dirs:['b2b'], nav:['today','board'],
                               boards:['design'], see:[], can:[] } }];
  applyRoleUi();
  const кнопок = document.querySelectorAll('#dir-switch button').length;
  setDir('b2c');
  const після = LQ_DIR;
  contentData.team = back;
  applyRoleUi();
  return { кнопок, після };
});
console.log('   кнопок у дизайнера: ' + guard.кнопок + ' · після спроби: ' + guard.після);
ok(guard.кнопок === 0,
  'один напрям — перемикати нема чого, кнопок немає',
  'кнопки показані там, де перемикати нічого');
ok(guard.після === 'b2b',
  'і перемкнутись у чужий напрям не вдається навіть в обхід кнопки',
  'чужий напрям увімкнувся: ' + guard.після);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'B2B і B2C — різні замовлення, спільні люди й каталог');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
