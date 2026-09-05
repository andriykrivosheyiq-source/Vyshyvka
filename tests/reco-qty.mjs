/* Під ціною рекомендації — тираж, а не опис товару.

   У плитці «Доповніть комплект» під ціною стояло «Чорний · Вишивка ·
   Перед». Це повторювало саме фото й не відповідало на єдине питання, яке
   виникає в цю секунду: «678 — це за скільки?». Ціна рекомендації рахується
   на конкретний тираж, і саме його там і треба назвати.

   Перевіряємо:
     — під ціною стоїть «від N штук», де N — тираж, на який порахована
       плитка;
     — однина після «від» у родовому: «від 1 штуки», а не «від 1 штук»;
     — кольору, способу нанесення й сторони в цьому рядку більше немає.

   Запуск:  node tests/reco-qty.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8814;
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const srv=createServer(async(req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''));
 try{const b=await readFile(f);res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(b);}catch(e){res.writeHead(404);res.end('no');}});
await new Promise(r=>srv.listen(PORT,r));
const HOST='http://127.0.0.1:'+PORT;
const PH='data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#EEF0F4"/></svg>');
const FP=Array.from({length:144},(_,i)=>(i*1)%5).join('');
const item=(name,color,qty,up)=>({kind:'main',vgroup:'',name,color,print:'Вишивка логотипа',sizes:'M × '+qty,qty,
  unitPrice:up,price:up*qty,basePrice:up*qty*2,baseUnitPrice:up*2,mockups:[PH],prints:[],
  views:[{side:'front',label:'Перед',img:PH,show:true}],sides:[{side:'front',sideLabel:'Перед'}],
  techniques:['Вишивка'],tiers:[],specs:[],about:'',
  desc:{method:'embro',units:qty,base:300,coefPart:200,pieceFee:20,dtfCols:[],designs:[FP],designKinds:['img'],bare:false}});
const OFFER={orderId:'1001100',client:{name:'Андрій',company:'Стоматологія'},
  terms:{deadlineDays:7,payment:'50%',startWith:'',validUntil:'2026-12-02T12:00:00.000Z'},
  trust:[],faq:[],cases:[],variants:[],state:'',
  items:[item('Худі','Чорний',30,1200)],
  reco:[item('Футболка базова','Чорний',10,678), item('Футболка поло','Білий',5,975), item('Кепка','Чорний',1,606)],
  manager:{name:'Олег',role:'Менеджер',phone:'+380671112233'},
  pricing:{methods:{embro:{orderFee:900,tiers:[{from:1,coef:1}]}},tiers:[{from:1,coef:1}],garmentTiers:[{from:1,coef:1}]}};
let fb=fs.readFileSync(ROOT+'/tests/fbstub.js','utf8');
fb=fb.replace('window.firebase={','window.__DOC='+JSON.stringify(OFFER)+';\n window.firebase={');
fb=fb.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
 'Doc.prototype.get=function(){ return Promise.resolve(new Snap(this.__id||"x", window.__DOC)); };');
fb=fb.replace('Col.prototype.doc=function(){ return new Doc(); };','Col.prototype.doc=function(id){var d=new Doc();d.__id=id;return d;};');
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await br.newPage({viewport:{width:430,height:1000},deviceScaleFactor:2});
p.on('pageerror',e=>console.log('ERR',e.message.slice(0,140)));
await p.route('**://**',r=>{const u=r.request().url();
 if(/gstatic\.com\/firebasejs/.test(u))return r.fulfill({contentType:'application/javascript',body:fb});
 if(u.startsWith(HOST)||/fonts\.(googleapis|gstatic)\.com/.test(u))return r.continue();
 return r.abort();});
await p.goto(HOST+'/offer.html?o=tok123456',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

console.log('═══ ПІД ЦІНОЮ — ТИРАЖ ═══');
const kits = await p.evaluate(() =>
  [...document.querySelectorAll('.rc-kit')].map(x => x.textContent.trim()));
kits.forEach(k => console.log('  ' + k));
ok(kits.join(' | ') === 'від 10 штук | від 5 штук | від 1 штуки',
  'кожна плитка каже, на який тираж порахована її ціна',
  'підписи не ті: ' + JSON.stringify(kits));
ok(kits.every(k => !/Чорний|Білий|Вишивк|Перед/i.test(k)),
  'кольору, нанесення й сторони в цьому рядку немає — їх видно на фото',
  'у рядок повернувся опис товару: ' + JSON.stringify(kits));
ok(/від 1 штуки$/.test(kits[2]),
  'однина після «від» стоїть у родовому',
  'однина написана неправильно: ' + kits[2]);

console.log('');
console.log(bad ? 'розходжень: ' + bad
                : 'плитка відповідає на питання «це за скільки?»');
await br.close(); srv.close();
process.exit(bad ? 1 : 0);
