/* Перегляд картки має вміщатись у панель, а не прокручуватись.

   ЩО БУЛО НЕ ТАК. Полотно в панелі перегляду завжди розтягувалось на всю
   ширину, а висоту брало за пропорцією. Для широкої картки це добре. Але
   картка порівняння й сітка 2×2 ростуть УНИЗ: у панелі заввишки 704 точки
   полотно виходило на 1290 — тобто видно було трохи більше половини, а
   решту доводилось шукати прокруткою всередині панелі.

   На екрані це читалось як «виріб обрізало»: клієнт бачив у Direct цілу
   картку, а менеджер у себе — половину. Різала не картка, а вікно, у якому
   її показують, — і саме тому виправлення в самій картці нічого не міняли.

   ЯК МАЄ БУТИ. Полотно вписується в панель цілком — і по ширині, і по
   висоті. Картку видно всю, хай би якої вона висоти; роздивитись деталі
   можна в самому файлі, для цього поруч і стоїть «Скачати цю».

   Запуск:  node tests/card-preview.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8884;
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
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

const mock = b => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">' +
  '<rect width="1200" height="1500" fill="#EFEFEC"/>' +
  '<path d="M360 470 L470 400 Q600 470 730 400 L840 470 L950 640 L860 700 L840 640 ' +
  'L840 1150 L360 1150 L360 640 L340 700 L250 640 Z" fill="' + b + '"/>' +
  '<circle cx="600" cy="360" r="90" fill="' + b + '"/></svg>');
const V = (sd, u, l) => ({ id:sd, side:sd, label:l, img:u, show:true });
const it = (n, pr, kind) => ({ kind: kind || 'variant', vgroup: kind ? '' : 'Група 1',
  name:n, color:'Чорний', print:'Вишивка', sizes:'M × 2', qty:2, unitPrice:pr, price:pr * 2,
  mockups:[], views:[V('front', mock('#141414'), 'Спереду'), V('back', mock('#141414'), 'Ззаду')],
  sides:[], techniques:['Вишивка'], tiers:[], specs:[{ k:'Матеріал', v:'100% бавовна' }],
  about:'', prints:[{ side:'front', sideLabel:'Спереду', technique:'Вишивка',
                      widthMm:80, heightMm:45 }] });
const OFFER = { token:'t', orderId:'1000057', client:{ name:'Андрій', company:'Stvory' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' }, trust:[], faq:[], cases:[], state:'',
  items:[ it('Худі оверсайз', 2780, 'main') ],
  variants:[ it('Худі оверсайз', 2780), it('Худі базове', 2691) ] };

const stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:stub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
const VH = path.join(ROOT, '_prev_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8">
 <style>html,body{margin:0;height:100%}iframe{border:0;width:100vw;height:100vh;display:block}</style>
 <iframe id="f" src="offer-edit.html"></iframe><script>
 window.__put = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, offer:o, catalog:[] }, '*');
 </script>`);
await p.goto(HOST + '/_prev_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__put(o), OFFER);
await p.waitForTimeout(2500);
const fr = p.frames()[1];
await fr.evaluate(() => {
  const b = [...document.querySelectorAll('.tab')].find(x => /Картки/.test(x.textContent));
  if(b) b.click();
});
await p.waitForTimeout(3500);

const міра = () => fr.evaluate(() => {
  const m = document.querySelector('.cd-main');
  const c = document.querySelector('.cd-prev canvas');
  if(!m || !c) return null;
  const r = c.getBoundingClientRect();
  const b = document.querySelector('.cd-prev');
  return { панель:{ w: Math.round(m.clientWidth), h: Math.round(m.clientHeight),
                    прокрутка: m.scrollHeight > m.clientHeight + 2 },
           зона:{ w: Math.round(b.clientWidth), h: Math.round(b.clientHeight) },
           полотно:{ w: Math.round(r.width), h: Math.round(r.height) },
           файл:{ w: c.width, h: c.height } };
});

console.log('═══ ВИСОКА КАРТКА ВМІЩАЄТЬСЯ В ПАНЕЛЬ ═══');
/* Беремо найвищу з наявних — саме на ній це й ламалось. */
await fr.evaluate(() => {
  const t = [...document.querySelectorAll('.cd-strip *')]
    .find(x => /порівняння/i.test(x.textContent || ''));
  if(t) t.click();
});
await p.waitForTimeout(2500);
const m1 = await міра();
ok(!!m1, 'перегляд намальовано', 'перегляду немає');
if(m1){
  console.log('  панель ' + m1.панель.w + '×' + m1.панель.h +
              ' · зона ' + m1.зона.w + '×' + m1.зона.h +
              ' · полотно ' + m1.полотно.w + '×' + m1.полотно.h +
              ' · сам файл ' + m1.файл.w + '×' + m1.файл.h);
  ok(m1.полотно.h <= m1.панель.h + 1,
    'полотно не вище за панель — картку видно всю',
    'полотно ' + m1.полотно.h + ' при панелі ' + m1.панель.h +
      ' — видно лише ' + Math.round(m1.панель.h / m1.полотно.h * 100) + '%');
  ok(m1.полотно.w <= m1.панель.w + 1,
    'і не ширше за неї',
    'полотно ширше за панель: ' + m1.полотно.w + ' при ' + m1.панель.w);
  ok(!m1.панель.прокрутка,
    'прокрутки всередині панелі немає',
    'панель прокручується — половина картки за краєм');
  /* Пропорції картки мають лишитись: вписуємо, а не стискаємо. */
  const файл = m1.файл.w / m1.файл.h, екран = m1.полотно.w / m1.полотно.h;
  ok(Math.abs(файл - екран) < 0.03,
    'пропорції картки не спотворені — її вписали, а не сплющили',
    'картку сплющило: ' + екран.toFixed(2) + ' замість ' + файл.toFixed(2));
}

console.log('');
console.log('═══ ШИРОКА КАРТКА НЕ ЗМЕНШИЛАСЬ ═══');
/* Зворотний бік: широка картка має й далі займати всю ширину панелі —
   вписування не повинно робити її дрібнішою, ніж було. */
await fr.evaluate(() => {
  const t = [...document.querySelectorAll('.cd-strip *')]
    .find(x => /позиція/i.test(x.textContent || ''));
  if(t) t.click();
});
await p.waitForTimeout(2500);
const m2 = await міра();
if(m2){
  console.log('  зона ' + m2.зона.w + '×' + m2.зона.h +
              ' · полотно ' + m2.полотно.w + '×' + m2.полотно.h);
  ok(m2.полотно.h <= m2.панель.h + 1 && !m2.панель.прокрутка,
    'широка картка теж уміщається',
    'широка картка не влізла: ' + JSON.stringify(m2));
  /* «Не змаліла» міряємо по зоні перегляду, а не по всій панелі: праворуч
     від неї стоїть колонка налаштувань, і її ширина до картки не належить. */
  const межа = Math.min(m2.зона.w, 1100);
  ok(m2.полотно.w >= межа * 0.92 || m2.полотно.h >= m2.зона.h * 0.92,
    'і займає зону перегляду по ширині або по висоті — вписування не зробило її дрібною',
    'широка картка змаліла: ' + m2.полотно.w + '×' + m2.полотно.h +
      ' у зоні ' + m2.зона.w + '×' + m2.зона.h);
}

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'менеджер бачить ту саму картку, що й клієнт, — цілком');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
