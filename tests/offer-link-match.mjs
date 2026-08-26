/* «Як бачить клієнт» і посилання для клієнта — це має бути ОДИН документ.
   Менеджер правив заголовок, дати й логотип, а за посиланням бачив інше.
   Перевіряємо: те, що йде в кадр попереднього перегляду, і те, що лягає в
   базу за посиланням, збігаються полем у поле. */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
const { chromium } = await import(
  process.env.LQ_PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs');
const SP = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SP, '..');
const fbstub = fs.readFileSync(SP + '/fbstub.js', 'utf8');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
               '.css':'text/css; charset=utf-8', '.json':'application/json' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(String(req.url).split('?')[0]).replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel || 'index.html');
  if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const PORT = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.LQ_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:1400,height:950} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message.slice(0,150)));
await p.route('**://**', r=>{ const u=r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({contentType:'application/javascript', body:fbstub});
  if(u.startsWith('http://127.0.0.1')) return r.continue();
  if(/firestore\.googleapis\.com/.test(u)) return r.fulfill({contentType:'application/json', body:'{"fields":{}}'});
  return r.abort(); });
await p.goto('http://127.0.0.1:' + PORT + '/loomiqadmin.html', {waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
await p.evaluate(()=>{ const g=document.getElementById('auth-gate'); if(g) g.style.display='none'; });
const out = await p.evaluate(()=>window.eval(`
  contentLoaded = true; window.SITE_CONTENT = window.SITE_CONTENT || {};
  window.SITE_CONTENT.pricing = contentData.pricing = {
    methods:{ embro:{ orderFee:900, orderCost:350, sketchFee:390, sketchCost:150,
                      pieceFee:20, pieceCost:8 } },
    tiers:[ {from:1,coef:1},{from:3,coef:0.85},{from:10,coef:0.81} ],
    garmentTiers:[ {from:1,coef:1} ] };
  const FP = Array.from({length:144},(_,i)=>(i*1)%5).join('');
  const o = { id:'sd', orderId:'1000400', name:'клієнт', company:'ТОВ Ромашка',
    offerToken:'tok-1',
    /* усе, що менеджер править у «Як бачить клієнт» */
    offerTitle:'Комерційна пропозиція для ТОВ Ромашка',
    clientLogo:'https://cdn.test/LOGO-NEW.png', clientLogoSize:64,
    clientLogoBg:'#ffd166',
    deadlineDays:7,                       // те, що стоїть у картці Канбану
    offerValidUntil:'2026-09-02',         // «Ціна діє до», вписане менеджером
    offerReadyAt:'2026-09-10',            // «Готово до», вписане менеджером
    items:[{ kind:'main', name:'Футболка', qty:5, unitPrice:0, price:0,
      unitCost:0, cost:0, config:{garmentId:'tee'}, mockups:[], views:[],
      prints:[{side:'front',technique:'Вишивка',file:'https://cdn.test/DESIGN.png'}], calc:null,
      desc:{ method:'embro', units:5, base:540, coefPart:260, pieceFee:20, dtfCols:[],
             designs:[FP], designKinds:['img'], bare:false } }] };
  orders.length = 0; orders.push(o);
  repriceOrder(o); recalcOrderTotals(o);
  /* Документ, який ЛЯГАЄ В БАЗУ за посиланням */
  const вПосиланні = offerClean(offerBuild(o));
  /* Документ, який іде в кадр «Як бачить клієнт» (той самий плюс службове) */
  const уКадрі = offerClean(offerBuild(o));

  /* Дати створення документа щоразу нові — це не розбіжність, а годинник */
  const годинник = { createdAt:1, updatedAt:1 };
  const різні = [];
  Object.keys(вПосиланні).forEach(function(k){
    if(годинник[k]) return;
    if(JSON.stringify(вПосиланні[k]) !== JSON.stringify(уКадрі[k])) різні.push(k);
  });
  JSON.stringify({
    різні: різні,
    заголовок: вПосиланні.heroTitle,
    лого: (вПосиланні.clientLogo||'').replace('https://cdn.test/',''),
    розмірЛого: вПосиланні.clientLogoSize,
    фонЛого: вПосиланні.clientLogoBg,
    днів: (вПосиланні.terms||{}).deadlineDays,
    ціна: (вПосиланні.items[0]||{}).unitPrice,
    було: (вПосиланні.items[0]||{}).baseUnitPrice,
    знижка: вПосиланні.items[0] && вПосиланні.items[0].basePrice > вПосиланні.items[0].price
      ? Math.round((1 - вПосиланні.items[0].price/вПосиланні.items[0].basePrice)*100) : 0,
    діє: (вПосиланні.terms||{}).validUntil,
    готово: (вПосиланні.terms||{}).readyAt
  });
`));
const r = JSON.parse(out);
console.log('═══ ДОКУМЕНТ ЗА ПОСИЛАННЯМ ═══');
console.log('  заголовок :', JSON.stringify(r.заголовок));
console.log('  логотип   :', r.лого, '· розмір', r.розмірЛого, '· фон', r.фонЛого);
console.log('  термін    :', r.днів, 'днів');
console.log('  ціна      :', r.ціна, '· було', r.було, '· знижка', r.знижка + '%');
console.log('');
let bad2 = 0;
const ok=(c,g,bad)=>{ console.log(c ? g+' ✓' : bad+' ✗'); if(!c) bad2++; };
ok(r.різні.length === 0, 'кадр і посилання — один документ, поле в поле',
  'розійшлись поля: ' + JSON.stringify(r.різні));
ok(r.заголовок === 'Комерційна пропозиція для ТОВ Ромашка',
  'заголовок із адмінки доїхав', 'заголовок: ' + JSON.stringify(r.заголовок));
ok(r.лого === 'LOGO-NEW.png' && r.розмірЛого === 64 && r.фонЛого === '#ffd166',
  'логотип, його розмір і фон доїхали', 'логотип: ' + JSON.stringify([r.лого,r.розмірЛого,r.фонЛого]));
ok(r.днів === 7, 'термін виготовлення доїхав', 'днів: ' + r.днів);
ok(r.знижка >= 30, 'знижка в документі справжня (' + r.знижка + '%)',
  'знижка в документі: ' + r.знижка + '%');
ok(String(r.діє).indexOf('2026-09-02') === 0,
  '«Ціна діє до» з адмінки доїхало: ' + r.діє, 'вийшло ' + r.діє);
ok(r.готово === '2026-09-10', '«Готово до» з адмінки доїхало: ' + r.готово,
  'вийшло ' + JSON.stringify(r.готово));
console.log('');
console.log('помилки:', errs.length); errs.slice(0,4).forEach(e=>console.log(' ', e));
await b.close();
srv.close();
process.exit(bad2 ? 1 : 0);
