/* Покращення логотипа через AI: підтвердження, відкат, стара версія воркера.

   Ключ Gemini живе в секретах Cloudflare Worker; тут воркер підмінений
   заглушкою, тож тест нікуди не ходить і нічого не витрачає.

   Стереже три речі, кожна з яких коштувала б довіри клієнта:
   · до підтвердження менеджера нічого не зберігається — відхилений результат
     не має й на секунду поїхати за посиланням;
   · попередній файл лягає в лінію відкоту, тож ↶ повертає оригінал;
   · стара версія воркера не знає слова enhance і мовчки виконає ІНШУ
     інструкцію (поставить логотип по центру на білий фон) — це видно одразу,
     і результат не показується.

   Запуск:  node tests/logo-ai.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8794;
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
// маленькі PNG: «до» — сірий квадрат, «після» — синій
const png = hex => Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
  '<rect width="120" height="120" fill="' + hex + '"/></svg>');
const AI = 'https://ai.test/gemini';
let sawBody = null, oldWorker = false;

const p = await b.newPage({ viewport:{width:1500,height:1000} });
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,170)));
await p.route('**://**', async r=>{ const u=r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
  if(u.startsWith(HOST)) return r.continue();
  if(u === AI){
    try{ sawBody = JSON.parse(r.request().postData() || '{}'); }catch(e){ sawBody = null; }
    /* Той самий набір заголовків, що віддає справжній воркер. Без
       Access-Control-Expose-Headers браузер ховає власні заголовки
       відповіді від сторінки — і сайт вирішив би, що воркер старий. */
    const cors = { 'Access-Control-Allow-Origin':'*',
                   'Access-Control-Expose-Headers':'X-Loomiq-Ref, X-Loomiq-Mode' };
    return r.fulfill({ status:200, contentType:'image/svg+xml',
      headers: oldWorker ? cors : Object.assign({ 'X-Loomiq-Mode':'enhance' }, cors),
      body: png('#2F6BEA') });
  }
  if(/cdn\.test/.test(u)) return r.fulfill({ status:200, contentType:'image/svg+xml', body: png('#AAB4C2') });
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({contentType:'application/json', body:'{"fields":{}}'});
  return r.abort(); });
await p.goto(HOST + '/loomiqadmin.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
await p.evaluate(()=>{ const g=document.getElementById('auth-gate'); if(g) g.style.display='none'; });

// Готуємо замовлення й підміняємо сховище — щоб тест нічого нікуди не вивантажував
const prep = await p.evaluate(api=>window.eval(`
  contentLoaded = true; window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.bgApi = { geminiUrl: ${JSON.stringify(api)} };
  window.SITE_CONTENT.pricing = contentData.pricing = {
    methods:{ embro:{ orderFee:900, tiers:[{from:1,coef:1}] } },
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] };
  window.__uploads = 0;
  window.uploadCloudinary = async function(f){ window.__uploads++;
    return 'https://cdn.test/ai-' + window.__uploads + '.png'; };
  window.offerEdSave = async function(){ return true; };
  window.__notes = [];
  window.offerEdNote = function(t){ window.__notes.push(String(t||'')); };
  const o = { id:'ai1', orderId:'1000950', name:'ТОВ Ромашка', items:[],
    clientLogo:'https://cdn.test/old.png', logos:['https://cdn.test/old.png'] };
  orders.length = 0; orders.push(o);
  window.__o = o;
  window.offerEdOrder = function(){ return window.__o; };
  window.renderOfferEd = function(){};
  window.paintCalcTarget = function(){};
  window.offerEdPreview = function(){};
  window.toast = function(){};
  // ловимо те, що адмінка шле в кадр
  window.__toFrame = [];
  Object.defineProperty(document, '__q', { value: document.querySelector.bind(document) });
  window.__origQS = document.querySelector.bind(document);
  document.querySelector = function(sel){
    if(sel === '#offerEd iframe')
      return { contentWindow: { postMessage: m => window.__toFrame.push(m) } };
    return window.__origQS(sel);
  };
  'ok';
`), AI);
const act = async a => { await p.evaluate(async d=>{
    await window.offerEdApply({ act: d });
  }, a);
  await p.waitForTimeout(900);
  return JSON.parse(await p.evaluate(()=>JSON.stringify({
    лого: window.__o.clientLogo,
    історія: (window.__o.clientLogoHist || []).slice(),
    вивантажень: window.__uploads,
    нотатки: window.__notes.slice(-2),
    вКадр: window.__toFrame.filter(m=>m && m.aiLogo).map(m=>({
      було: String(m.aiLogo.before||'').slice(0,24),
      стало: String(m.aiLogo.after||'').slice(0,24),
      розмірДо: m.aiLogo.beforeSize, розмірПісля: m.aiLogo.afterSize }))
  })));
};

console.log('═══ ПОКРАЩЕННЯ ЛОГОТИПА ═══');
let r = await act('logoai');
console.log('  запит до воркера:', JSON.stringify(sawBody && { mode:sawBody.mode,
  картинка: String(sawBody.image||'').slice(0,22) + '…', prompt: sawBody.prompt }));
console.log('  у кадр:', JSON.stringify(r.вКадр));
console.log('  лого поки:', r.лого, '· вивантажень:', r.вивантажень);
ok(sawBody && sawBody.mode === 'enhance' && /^data:image/.test(sawBody.image || ''),
  'у воркер поїхав режим enhance і сама картинка',
  'запит не той: ' + JSON.stringify(sawBody && sawBody.mode));
ok(r.вКадр.length === 1 && r.вКадр[0].розмірДо && r.вКадр[0].розмірПісля,
  'у кадр пішло порівняння з розмірами: ' + JSON.stringify(r.вКадр[0]),
  'порівняння не пішло: ' + JSON.stringify(r.вКадр));
ok(r.лого === 'https://cdn.test/old.png' && r.вивантажень === 0,
  'до підтвердження логотип не змінився й нічого не вивантажено',
  'логотип підмінили без згоди: ' + r.лого);

console.log('');
console.log('── Скасували ──');
r = await act('logoaiDrop');
console.log('  ' + JSON.stringify(r.нотатки) + ' · лого: ' + r.лого);
ok(r.лого === 'https://cdn.test/old.png' && r.вивантажень === 0,
  'після «Скасувати» все лишилось як було', 'щось змінилось після скасування');
r = await act('logoaiKeep');
ok(r.вивантажень === 0 && /Немає що зберігати/.test((r.нотатки||[]).join(' ')),
  'скасований результат не можна зберегти заднім числом',
  'скасоване все ще зберігається');

console.log('');
console.log('── Залишили новий ──');
await act('logoai');
r = await act('logoaiKeep');
console.log('  лого: ' + r.лого + ' · історія: ' + JSON.stringify(r.історія));
ok(r.лого === 'https://cdn.test/ai-1.png' && r.вивантажень === 1,
  'логотип замінено на покращений', 'лого: ' + r.лого);
ok(r.історія.length === 1 && r.історія[0] === 'https://cdn.test/old.png',
  'попередній файл лежить у лінії відкоту — ↶ поверне його',
  'історія: ' + JSON.stringify(r.історія));

console.log('');
console.log('── Стара версія воркера ──');
oldWorker = true;
r = await act('logoai');
console.log('  ' + JSON.stringify(r.нотатки));
ok(/стара версія воркера/.test((r.нотатки||[]).join(' ')),
  'стару версію воркера видно одразу, результат не показуємо',
  'мовчазна підміна: ' + JSON.stringify(r.нотатки));
ok(r.лого === 'https://cdn.test/ai-1.png',
  'логотип не зачеплено', 'логотип змінився: ' + r.лого);

// ── Вікно порівняння «було / стало» в кадрі пропозиції ──────────────────
// Той самий квадратик, тільки як data-URL: кадру пропозиції потрібні пікселі
const sq = h => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
  '<rect width="160" height="160" fill="' + h + '"/></svg>');
const VH2 = path.join(ROOT, '_ai_vhost.html');
fs.writeFileSync(VH2,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1100px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 window.__ai = d => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, aiLogo:d }, '*');
 </script>`);
const p2 = await b.newPage({ viewport:{width:920,height:1000} });
p2.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,170)));
await p2.route('**://**', r=>{ const u=r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
  if(u.startsWith(HOST)) return r.continue();
  return r.abort(); });
await p2.goto(HOST + '/_ai_vhost.html', {waitUntil:'domcontentloaded'});
await p2.waitForTimeout(4000);
await p2.evaluate(o=>window.__prev(o), {
  orderId:'1', client:{name:'Андрій', company:'ARMORIX'},
  terms:{deadlineDays:7, payment:'50%'}, trust:[], faq:[], state:'',
  items:[], reco:[], variants:[], state_pick:{},
  clientLogo: sq('#AAB4C2'), clientLogoSize:44,
  pricing:{ methods:{embro:{orderFee:900, tiers:[{from:1,coef:1}]}},
    tiers:[{from:1,coef:1}], garmentTiers:[{from:1,coef:1}] } });
await p2.waitForTimeout(1500);
const fr = p2.frames()[1];
const btn = await fr.evaluate(()=>{
  const b2 = document.querySelector('.edlogo [data-ed="logoai"]');
  return b2 ? { текст: b2.textContent.trim(), поруч:
    [...document.querySelectorAll('.edlogo [data-ed]')].map(x=>x.dataset.ed) } : null;
});
console.log('═══ КНОПКА В РЯДКУ ЛОГОТИПА ═══');
console.log('  ' + JSON.stringify(btn));
ok(btn && /Якість/.test(btn.текст), 'кнопка «✦ Якість» стоїть у рядку логотипа',
  'кнопки немає: ' + JSON.stringify(btn));
// натиснули — дія полетіла в адмінку
if(btn){
  await fr.click('.edlogo [data-ed="logoai"]');
  await p2.waitForTimeout(300);
  const sent = JSON.parse(await p2.evaluate(()=>JSON.stringify(window.__sent.map(x=>x.act))));
  ok(sent.indexOf('logoai') >= 0, 'клік шле дію logoai: ' + JSON.stringify(sent),
    'дія не полетіла: ' + JSON.stringify(sent));
}
// вікно порівняння
await p2.evaluate(d=>window.__ai(d), { before: sq('#AAB4C2'), after: sq('#2F6BEA'),
  beforeSize:'160×160 px', afterSize:'640×640 px' });
await p2.waitForTimeout(600);
const ov = await fr.evaluate(()=>{
  const o = document.getElementById('ovAiLogo');
  if(!o) return null;
  return { видно: o.classList.contains('show'),
    заголовок: (o.querySelector('.ai-h')||{}).textContent||'',
    підписи: [...o.querySelectorAll('figcaption')].map(x=>x.textContent),
    розміри: [...o.querySelectorAll('.ai-pair span')].map(x=>x.textContent),
    кнопки: [...o.querySelectorAll('.ai-cta .btn')].map(x=>x.textContent.trim()),
    попередження: (o.querySelector('.ai-sub')||{}).textContent||'' };
});
console.log('');
console.log('═══ ВІКНО ПОРІВНЯННЯ ═══');
console.log('  ' + JSON.stringify(ov, null, 0));
ok(ov && ov.видно, 'вікно відкрилось', 'вікно не відкрилось');
ok(ov && ov.підписи.join('/') === 'Було/Стало', 'дві колонки: було й стало',
  'підписи: ' + JSON.stringify(ov && ov.підписи));
ok(ov && ov.розміри.join(' → ') === '160×160 px → 640×640 px',
  'видно, наскільки виросла роздільність: ' + (ov && ov.розміри.join(' → ')),
  'розмірів немає: ' + JSON.stringify(ov && ov.розміри));
ok(ov && /не гарантує/.test(ov.попередження),
  'вікно чесно попереджає, що AI міг зачепити деталі', 'попередження немає');
ok(ov && ov.кнопки.length === 2 && /Скасувати/.test(ov.кнопки[0]) && /Залишити/.test(ov.кнопки[1]),
  'дві дії: скасувати й залишити', 'кнопки: ' + JSON.stringify(ov && ov.кнопки));
// натиснули «Залишити» — полетіла дія підтвердження, вікно закрилось
await fr.click('#aiYes');
await p2.waitForTimeout(300);
const after = JSON.parse(await p2.evaluate(()=>JSON.stringify({
  дії: window.__sent.map(x=>x.act) })));
const closed = await fr.evaluate(()=>{
  const o = document.getElementById('ovAiLogo'); return o ? !o.classList.contains('show') : true; });
console.log('');
ok(after.дії.indexOf('logoaiKeep') >= 0 && closed,
  '«Залишити» надсилає підтвердження й закриває вікно: ' + JSON.stringify(after.дії),
  'дії: ' + JSON.stringify(after.дії) + ' закрито: ' + closed);
const shot = await fr.$('#ovAiLogo');

try{ fs.unlinkSync(VH2); }catch(e){}
console.log('');
console.log('помилки:', errs.length); errs.slice(0,3).forEach(e=>console.log(' ', e));
if(errs.length) bad++;
await b.close();
srv.close();
process.exit(bad ? 1 : 0);
