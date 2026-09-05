/* Шапка пропозиції: повна назва документа й одна головна дія.

   Заголовок за замовчуванням звався «Пропозиція для…». Так документ не
   називають ніде: у листуванні, у бухгалтерії й усередині компанії клієнта
   це «комерційна пропозиція», і саме під цією назвою його пересилають
   керівнику. Коротке слово читалось як лист від знайомого.

   Поруч стояла кнопка «Подивитись пропозицію ↓». Склад починається одразу
   під шапкою — його видно, варто прокрутити на палець, — а кнопка забирала
   увагу й робила вигляд, ніби рішень на сторінці два. Головна дія одна:
   «Підтвердити пропозицію».

   І ще одне слово: сторона виробу зветься «Спина». «Зад» лишався в назвах
   ракурсів адмінки, звідки їхав у підписи фото й у документи на виробництво.

   Запуск:  node tests/offer-head.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8821;
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

const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E8EDF3"/></svg>');
/* Позиція зі СТАРИМ підписом сторони: такі КП уже надіслані, і клієнт не
   має читати «Зад» у документі, який ми йому щойно оновили. */
const OFFER = {
  orderId:'1001600', client:{ name:'Андрій', company:'ARMORIX' },
  terms:{ deadlineDays:7, holdDays:5, payment:'50%' },
  trust:[], faq:[], cases:[], reco:[], variants:[], state:'',
  items:[{ kind:'main', vgroup:'', name:'Худі', color:'Чорний', print:'Вишивка',
    sizes:'M × 10', qty:10, unitPrice:1200, price:12000, basePrice:12000, baseUnitPrice:1200,
    mockups:[PH], prints:[],
    views:[{ side:'front', label:'Перед', img:PH, show:true },
           { side:'back', label:'Зад', img:PH, show:true }],
    sides:[{ side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:100, heightMm:60 },
           { side:'back', sideLabel:'Зад', technique:'Вишивка', widthMm:250, heightMm:180 }],
    techniques:['Вишивка'], tiers:[], specs:[], about:'' }]
};

const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
const VH = path.join(ROOT, '_head_vhost.html');
fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1200px}</style>
 <iframe id="f" src="offer.html"></iframe><script>
 window.__prev = o => document.getElementById('f').contentWindow.postMessage(
   { lqEditInit:true, preview:true, offer:o }, '*');
 </script>`);

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{ width:920, height:1000 } });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 170)));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/_head_vhost.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(4000);
await p.evaluate(o => window.__prev(o), OFFER);
await p.waitForTimeout(1500);
const fr = p.frames()[1];

console.log('═══ ДОКУМЕНТ НАЗИВАЄ СЕБЕ ПОВНІСТЮ ═══');
const head = await fr.evaluate(() => ({
  h1: (document.querySelector('.hero h1') || {}).textContent || '',
  go: !!document.getElementById('goOffer'),
  heroBtns: [...document.querySelectorAll('.hero button')]
              .map(x => x.textContent.trim()).filter(Boolean),
  confirm: !!document.getElementById('estConfirmBtn')
}));
console.log('  ' + head.h1.trim());
ok(/^Комерційна пропозиція для ARMORIX$/.test(head.h1.trim()),
  'типовий заголовок — «Комерційна пропозиція для <компанія>»',
  'заголовок не той: ' + head.h1);

console.log('');
console.log('═══ ГОЛОВНА ДІЯ ОДНА ═══');
console.log('  кнопки в шапці: ' + (head.heroBtns.join(' · ') || 'немає'));
ok(!head.go, 'кнопки «Подивитись пропозицію» в шапці більше немає',
  'кнопка лишилась у шапці');
ok(head.confirm,
  'єдина головна дія — «Підтвердити пропозицію» в кошторисі',
  'кнопки підтвердження немає');

console.log('');
console.log('═══ СТОРОНА ЗВЕТЬСЯ СПИНОЮ ═══');
const words = await fr.evaluate(() => {
  document.querySelectorAll('details').forEach(d => { d.open = true; });
  const t = document.body.innerText;
  return {
    zad: /(^|[^а-яіїєґ])зад([^а-яіїєґ]|$)/i.test(t),
    spina: /спина/i.test(t),
    tabs: [...document.querySelectorAll('.pgal-cap, .sl-k')].map(x => x.textContent.trim())
  };
});
console.log('  згадки «спина»: ' + words.spina + ' · «зад»: ' + words.zad);
ok(!words.zad, 'слова «зад» на сторінці немає ніде',
  'десь лишилось «зад»');
ok(words.spina,
  'стара позиція з підписом «Зад» показується як «Спина»',
  'підпис сторони не виправився');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
try{ fs.unlinkSync(VH); }catch(e){}
console.log(bad ? 'розходжень: ' + bad
                : 'шапка називає документ повністю й веде до однієї дії');
await b.close(); srv.close();
process.exit(bad ? 1 : 0);
