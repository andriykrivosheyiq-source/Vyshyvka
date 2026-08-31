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
const PORT = 8793;
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
const VH = path.join(ROOT, '_title_vhost.html');
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
await p.goto(HOST + '/_title_vhost.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
const OFFER = { orderId:'1', client:{name:'Андрій', company:'ARMORIX'},
  terms:{deadlineDays:7, payment:'50%'}, trust:[], faq:[], state:'',
  items:[], reco:[], variants:[], state_pick:{},
  heroTitle:'Комерційна пропозиція\nдля компанії ARMORIX',
  pricing:{ methods:{embro:{orderFee:900, tiers:[{from:1,coef:1}]}},
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] } };
await p.evaluate(o=>window.__prev(o), OFFER);
await p.waitForTimeout(2000);
const fr = p.frames()[1];
const r = await fr.evaluate(()=>{
  const h = document.querySelector('.hero h1');
  return { html: h ? h.innerHTML : '', text: h ? h.innerText : '',
           рядків: h ? h.innerHTML.split(/<br>/i).length : 0,
           редагується: h ? h.getAttribute('contenteditable') : null };
});
console.log('═══ ЗАГОЛОВОК У ДВА РЯДКИ ═══');
console.log('  html:', JSON.stringify(r.html));
console.log('  видно:', JSON.stringify(r.text));
ok(/<br>/i.test(r.html) && r.рядків === 2,
  'перенос малюється як <br>: два рядки', 'рядків: ' + r.рядків);
ok(!/&lt;|&gt;/.test(r.text), 'текст не екранований двічі', 'подвійне екранування: ' + r.text);
ok(r.редагується === 'plaintext-only', 'поле лишається редагованим', 'contenteditable: ' + r.редагується);

// Enter має вставляти перенос, а не завершувати правку
const typed = await p.evaluate(async ()=>{
  const f = document.getElementById('f').contentWindow;
  const h = f.document.querySelector('.hero h1');
  h.focus();
  const sel = f.getSelection(); sel.selectAllChildren(h); sel.collapseToEnd();
  return h.getAttribute('contenteditable');
});
await fr.click('.hero h1');
await p.keyboard.press('End');
await p.keyboard.press('Enter');
await p.keyboard.type('третій рядок');
const afterEnter = await fr.evaluate(()=>{
  const h = document.querySelector('.hero h1');
  return { текст: h.innerText, вФокусі: document.activeElement === h };
});
console.log('');
console.log('  після Enter:', JSON.stringify(afterEnter.текст));
ok(/третій рядок/.test(afterEnter.текст) && afterEnter.текст.split('\n').length === 3,
  'Enter вставив третій рядок, а не закрив поле',
  'вийшло: ' + JSON.stringify(afterEnter.текст));
ok(afterEnter.вФокусі, 'поле лишилось у фокусі', 'фокус злетів');
// Esc завершує правку й надсилає текст із переносами
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
const sent = await p.evaluate(()=>JSON.stringify(window.__sent.filter(x=>x.act === 'heroTitle')));
console.log('  надіслано:', sent);
const msgs = JSON.parse(sent);
ok(msgs.length > 0 && /\n/.test(msgs[msgs.length-1].text || ''),
  'у збереження поїхав текст із переносами: ' + JSON.stringify((msgs[msgs.length-1]||{}).text),
  'переноси злиплись: ' + sent);
console.log('');
console.log('помилки:', errs.length); errs.slice(0,3).forEach(e=>console.log(' ', e));
try{ fs.unlinkSync(VH); }catch(e){}
await b.close();
srv.close();
process.exit(bad || errs.length ? 1 : 0);
