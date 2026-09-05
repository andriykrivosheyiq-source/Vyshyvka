/* Тираж рекомендованого товару слухається менеджера.

   За замовчуванням він іде за найбільшою основною позицією: 50 худі — шопер
   теж на 50. Це правильна заготовка, але не рішення: шопер до тих самих 50
   худі беруть і на 20, і на 100.

   Змінити його не виходило. Ознаку «тираж вписали руками» (qtyAuto:false) не
   ставив ніхто, тож найближчий перерахунок мовчки повертав число до тиражу
   складу — на екрані кількість «не мінялась» узагалі. А в лівій панелі
   лічильника рекомендованої не було зовсім: єдиним шляхом лишався
   конструктор, звідки правку так само стирало.

   Перевіряємо:
     — вписане число тримається й після перерахунку;
     — тираж складу від цього не рухається;
     — число, що збігається з автоматичним, лишає позицію на автоматі: далі
       вона знову йде за складом;
     — у лівій панелі є лічильник, і він шле правку в адмінку;
     — у КП лічильник рекомендованої править ЗАМОВЛЕННЯ, а не клієнтський
       вибір, коли сторінку відкрито менеджером.

   Запуск:  node tests/reco-edit.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8822;
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

let bad = 0;
const ok = (c, g, w) => { console.log('  ' + (c ? g + ' ✓' : w + ' ✗')); if(!c) bad++; };
const errs = [];
const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

console.log('═══ ВПИСАНЕ ЧИСЛО ТРИМАЄТЬСЯ ═══');
{
  const ap = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  ap.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
  await ap.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await ap.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await ap.waitForTimeout(5000);

  /* Склад: 50 худі. Рекомендований шопер за замовчуванням теж на 50. */
  const st = await ap.evaluate(() => {
    const o = { id:'t1', orderId:'1009001', items:[
      { kind:'main', name:'Худі', garmentId:'hoodie', qty:50, unitPrice:1000, price:50000 },
      { kind:'reco', name:'Шопер', garmentId:'tote', qty:50, unitPrice:200, price:10000,
        qtyAuto:true }
    ] };
    const auto = recoQtyFor(o);
    syncRecoQty(o);
    const beforeQty = o.items[1].qty;

    // менеджер вписав 20 — і саме це число має пережити перерахунок
    o.items[1].qty = 20;
    o.items[1].qtyAuto = (20 === recoQtyFor(o));
    syncRecoQty(o);
    const afterOwn = o.items[1].qty;
    syncRecoQty(o); syncRecoQty(o);          // ще два перерахунки поспіль
    const stillOwn = o.items[1].qty;

    // а число, що збігається з автоматичним, лишає позицію на автоматі
    o.items[1].qty = 50;
    o.items[1].qtyAuto = (50 === recoQtyFor(o));
    o.items[0].qty = 80;                     // склад виріс
    syncRecoQty(o);
    const followsAgain = o.items[1].qty;

    return { auto, beforeQty, afterOwn, stillOwn, followsAgain, mainQty: o.items[0].qty };
  });
  console.log('  автоматично: ' + st.auto + ' · вписали 20 → ' + st.stillOwn +
              ' · повернули 50, склад виріс до 80 → ' + st.followsAgain);
  ok(st.beforeQty === 50,
    'без втручання тираж рекомендованого йде за найбільшою основною позицією',
    'заготовка не та: ' + st.beforeQty);
  ok(st.afterOwn === 20 && st.stillOwn === 20,
    'вписане число переживає перерахунок, і не один',
    'число повернулось до складу: ' + st.afterOwn + ' / ' + st.stillOwn);
  ok(st.mainQty === 80,
    'склад від правки рекомендованого не рухається',
    'зрушився склад: ' + st.mainQty);
  ok(st.followsAgain === 80,
    'число, рівне автоматичному, лишає позицію на автоматі',
    'позиція замерзла на 50: ' + st.followsAgain);
  await ap.close();
}

console.log('');
console.log('═══ ЛІЧИЛЬНИК У ЛІВІЙ ПАНЕЛІ ═══');
{
  const VH = path.join(ROOT, '_reco_vhost.html');
  fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:1100px;height:900px}</style>
 <iframe id="f" src="offer-edit.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__put = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, offer:o, catalog:[] }, '*');
 </script>`);
  const p = await browser.newPage({ viewport:{ width:1140, height:900 } });
  p.on('pageerror', e => errs.push('панель: ' + e.message.slice(0, 160)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/_reco_vhost.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(3000);
  const OFFER = {
    orderId:'1009001', client:{ name:'Андрій', company:'ARMORIX' },
    terms:{ deadlineDays:7, holdDays:5 },
    items:[{ kind:'main', name:'Худі', qty:50, unitPrice:1000, sum:50000, mockups:[] }],
    reco:[{ kind:'reco', name:'Шопер', qty:50, unitPrice:200, sum:10000, mockups:[] }],
    variants:[{ kind:'variant', name:'Поло', vgroup:'Футболки', qty:30,
                unitPrice:700, sum:21000, mockups:[] }],
    vqty:{ 'Футболки':30 }
  };
  await p.evaluate(o => window.__put(o), OFFER);
  await p.waitForTimeout(1200);
  const fr = p.frames()[1];
  const has = await fr.evaluate(() => ({
    minus: !!document.querySelector('[data-rq="0"][data-d="-1"]'),
    plus: !!document.querySelector('[data-rq="0"][data-d="1"]'),
    val: (document.querySelector('[data-rqedit="0"]') || {}).textContent || ''
  }));
  console.log('  лічильник: −  ' + has.val + '  ＋');
  ok(has.minus && has.plus && has.val.trim() === '50',
    'біля рекомендованої позиції стоїть тираж із кнопками',
    'лічильника немає: ' + JSON.stringify(has));

  await fr.click('[data-rq="0"][data-d="1"]');
  await p.waitForTimeout(400);
  const sent = await p.evaluate(() => (window.__sent || []).slice(-1)[0] || null);
  console.log('  надіслано: ' + JSON.stringify(sent));
  ok(sent && sent.act === 'qty' && sent.kind === 'reco' && sent.i === 0 && sent.v === 55,
    'кнопка править саме замовлення, з кроком під розмір числа',
    'в адмінку пішло не те: ' + JSON.stringify(sent));

  console.log('');
  console.log('═══ ГРУПУ ВАРІАНТІВ ОБИРАЮТЬ ЗІ СПИСКУ ═══');
  await fr.click('[data-newgroup]');
  await p.waitForTimeout(400);
  const gp = await fr.evaluate(() => ({
    box: !!document.querySelector('.pick .is-groups'),
    groups: [...document.querySelectorAll('[data-g]')].map(x => x.dataset.g),
    input: !!document.querySelector('#gNew')
  }));
  console.log('  наявні групи: ' + (gp.groups.join(', ') || 'немає'));
  ok(gp.box && gp.groups.join() === 'Футболки' && gp.input,
    'вікно показує групи, які вже є в цьому КП, і поле для нової',
    'вибору груп немає: ' + JSON.stringify(gp));

  await fr.click('[data-g="Футболки"]');
  await p.waitForTimeout(400);
  const after = await fr.evaluate(() => ({
    pick: !!document.querySelector('.pick'),
    head: (document.querySelector('.pick-h b') || {}).textContent || ''
  }));
  console.log('  ' + after.head);
  ok(after.pick && /Футболки/.test(after.head),
    'клік по наявній групі веде просто в каталог — назву не набирають удруге',
    'у групу не потрапили: ' + JSON.stringify(after));
  try{ fs.unlinkSync(VH); }catch(e){}
  await p.close();
}

console.log('');
console.log('═══ ЛІЧИЛЬНИК У САМОМУ КП ПРАВИТЬ ЗАМОВЛЕННЯ ═══');
{
  const VH = path.join(ROOT, '_reco_kp.html');
  fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__sent = [];
 window.addEventListener('message', e => { if(e.data && e.data.lqEdit) window.__sent.push(e.data); });
 window.__edit = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, offer:o }, '*');
 </script>`);
  const p = await browser.newPage({ viewport:{ width:920, height:1000 } });
  p.on('pageerror', e => errs.push('КП: ' + e.message.slice(0, 160)));
  await p.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await p.goto(HOST + '/_reco_kp.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  const O = {
    orderId:'1009002', client:{ name:'Андрій', company:'ARMORIX' },
    terms:{ deadlineDays:7, holdDays:5 },
    trust:[], faq:[], cases:[], variants:[], state:'',
    items:[{ kind:'main', name:'Худі', qty:50, unitPrice:1000, price:50000,
             mockups:[], prints:[], views:[], sides:[], techniques:[], tiers:[], specs:[] }],
    reco:[{ kind:'reco', name:'Шопер', qty:50, unitPrice:200, price:10000,
            mockups:[], prints:[], views:[], sides:[], techniques:[], tiers:[], specs:[] }]
  };
  await p.evaluate(o => window.__edit(o), O);
  await p.waitForTimeout(1500);
  const fr = p.frames()[1];
  /* Лічильник живе в КАРТЦІ доданої рекомендації — саме там менеджер і
     дивиться на неї разом з рештою складу. */
  await fr.evaluate(() => {
    const add = document.querySelector('.rc-add[data-reco="0"]');
    if(add) add.click();
  });
  await p.waitForTimeout(600);
  const shown = await fr.evaluate(() => {
    const b = document.querySelector('.pstep-b[data-rq="0"][data-d="1"]');
    if(b){ b.click(); return true; }
    return false;
  });
  await p.waitForTimeout(500);
  const sent = await p.evaluate(() => (window.__sent || []).slice(-1)[0] || null);
  console.log('  надіслано: ' + JSON.stringify(sent));
  ok(shown && sent && sent.act === 'qty' && sent.kind === 'reco' && sent.v === 51,
    'лічильник у картці рекомендованої править замовлення, а не клієнтський вибір',
    'правка не дійшла до адмінки: ' + JSON.stringify(sent));
  try{ fs.unlinkSync(VH); }catch(e){}
  await p.close();
}

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'тираж рекомендованого — рішення менеджера, а не наслідок складу');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
