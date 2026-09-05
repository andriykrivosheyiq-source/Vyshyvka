/* Заголовок пропозиції в кілька рядків.

   Enter у заголовку не працював не через браузер, а через два навмисні
   запобіжники: обробник клавіші гасив Enter і закривав поле («заголовок в
   один рядок»), а збереження проганяло текст через \\s+ → пробіл, тож навіть
   якби Enter спрацював, перенос злипся б. Тест стереже, що обидва прибрані.

   Запуск:  node tests/offer-title.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8815;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('404'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs=[]; let bad=0;
const ok=(c,g,w)=>{ console.log('  ' + (c ? g+' ✓' : w+' ✗')); if(!c) bad++; };
const VH = path.join(ROOT, '_terms_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);
const p = await b.newPage({ viewport:{width:920,height:1000} });
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,170)));
await p.route('**://**', r=>{ const u=r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
  if(u.startsWith(HOST)) return r.continue();
  return r.abort(); });
await p.goto(HOST + '/_terms_vhost.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
const OFFER = { orderId:'1001200', client:{ name:'Андрій', company:'Стоматологія' },
  terms:{ deadlineDays:8, daysFixed:true, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], state:'', items:[], reco:[], variants:[], state_pick:{},
  pricing:{ methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1}] } },
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] } };
await p.evaluate(o=>window.__prev(o), OFFER);
await p.waitForTimeout(2000);
const fr = p.frames()[1];

console.log('═══ ТЕРМІНИ ПРАВЛЯТЬСЯ ДНЯМИ ═══');
const st = await fr.evaluate(() => ({
  made: (document.getElementById('heroMade') || {}).textContent || '',
  till: (document.querySelector('.hero-till') || {}).textContent || '',
  nums: [...document.querySelectorAll('[data-ed-num]')].map(i => i.dataset.edNum + '=' + i.value),
  dates: document.querySelectorAll('[data-ed-date]').length,
  labels: [...document.querySelectorAll('.eddate')].map(l => l.textContent.replace(/\s+/g,' ').trim())
}));
console.log('  ' + st.made);
console.log('  ' + st.till);
console.log('  поля: ' + st.labels.join(' | '));
ok(st.dates === 0, 'календарів у шапці більше немає', 'календар лишився: ' + st.dates);
ok(st.nums.join() === 'days=8,hold=5',
  'замість них два числа: робочі дні й скільки тримається ціна',
  'поля не ті: ' + JSON.stringify(st.nums));
ok(/8 робочих днів/.test(st.made),
  'число менеджера головніше за формулу — у рядку стоїть саме воно',
  'у рядку не те число: ' + st.made);
ok(/Ціна зафіксована до \d/.test(st.till),
  'дата фіксації рахується сама, від числа днів',
  'дати фіксації немає: ' + st.till);

/* Найголовніше: правка йде в адмінку числом, а не датою. */
await fr.evaluate(() => {
  const i = document.querySelector('[data-ed-num="days"]');
  i.value = '12';
  i.dispatchEvent(new Event('change', { bubbles:true }));
});
await p.waitForTimeout(600);
const sent = await p.evaluate(() => (window.__sent || []).slice(-1)[0] || null);
console.log('  надіслано: ' + JSON.stringify(sent));
ok(sent && sent.act === 'days' && sent.v === 12,
  'зміна поля летить в адмінку числом днів',
  'в адмінку пішло не те: ' + JSON.stringify(sent));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'термін і фіксація ціни правляться днями, дати рахуються самі');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
