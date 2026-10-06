/* Ролі цеху на виробничій дошці B2C (Андрій, 06.10).

   Оператори — Передрук, Нове, Очікуємо одяг, Готово до роботи, На станках.
   Контроль якості — На станках, Контроль якості, Чекає погодження, Можна
   відправляти. Виробництво (загальне) — уся дошка. Партія в браку стоїть у
   новій колонці «Передрук».

   Запуск:  node tests/prod-roles.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8893;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
               '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
               '.png':'image/png', '.webp':'image/webp' };
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

/* Замовлення, як його бачить відділ: худі з вишивкою спереду й ззаду —
   це ДВА різні файли, — і футболки з друком, яких вишивка не стосується. */
const ORDER = {
  id:'d1', orderId:'1003100', type:'client', name:'Андрій', company:'ARMORIX',
  phone:'+380670003100', status:'kp', site:'main', payments:[], offerToken:'tokdz',
  createdAt:'2026-09-10T09:00:00.000Z', hist:[], offerDays:7,
  items:[
    { kind:'main', name:'Худі базове', garmentId:'hoodie', color:'Чорний', qty:20,
      sizes:'M × 20', print:'Вишивка', unitPrice:1200, price:24000,
      desc:{ method:'embro' },
      prints:[
        { side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:80, heightMm:45,
          mark:{ topMm:210, centerMm:0 }, file:'https://cdn.test/logo.png' },
        { side:'back',  sideLabel:'Спина', technique:'Вишивка', widthMm:240, heightMm:120,
          mark:{ topMm:180, centerMm:0 }, file:'https://cdn.test/logo.png' }
      ] },
    { kind:'main', name:'Футболка базова', garmentId:'tshirt', color:'Білий', qty:30,
      sizes:'M × 30', print:'Друк', unitPrice:400, price:12000,
      desc:{ method:'dtf' },
      prints:[ { side:'front', sideLabel:'Перед', technique:'DTF', widthMm:200, heightMm:260,
                 file:'https://cdn.test/logo.png' } ] },
    { kind:'reco', name:'Кепка', garmentId:'cap', qty:10, unitPrice:300, price:3000,
      prints:[ { side:'front', sideLabel:'Перед', technique:'Вишивка', widthMm:60, heightMm:40 } ] }
  ]
};

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n  window.__SAVED={};\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace('Doc.prototype.set=function(){ return Promise.resolve(); };',
  'Doc.prototype.set=function(d){ if(this.__col==="designJobs")\n' +
  '    window.__SAVED[this.__id]=JSON.parse(JSON.stringify(d));\n' +
  '  return Promise.resolve(); };');
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      var c = n==='kanbanOrders' ? new SeedCol() : new Col(); c.__n=n; return c; },");

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept());
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5200);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });


const cols = role => p.evaluate(async (role) => {
  contentData.team = [{ email: myEmail() || 'test@loomiq', name:'Тест', role }];
  const U = window.LQDesign.ui;
  U.setTab('acct');
  openDesign();
  U.render(document.getElementById('dzRoot'));
  await new Promise(r => setTimeout(r, 200));
  return { seat: U.tab(), cols: [...document.querySelectorAll('#dzRoot .dz-col-h')]
    .map(e => (e.firstChild && e.firstChild.textContent || e.textContent || '').trim()).filter(Boolean) };
}, role);

console.log('═══ КОЛОНКИ ЗА РОЛЛЮ ═══');
const оп = await cols('operator'), кя = await cols('qcprod'), заг = await cols('production');
console.log('  оператори: ' + JSON.stringify(оп));
console.log('  контроль якості: ' + JSON.stringify(кя));
console.log('  виробництво: ' + JSON.stringify(заг));
const має = (r, l) => r.cols.some(t => t.indexOf(l) === 0);
ok(оп.seat === 'prod' && ['Передрук','Нове','Очікуємо одяг','Готово до роботи','На станках'].every(l => має(оп, l)) &&
   !['Контроль якості','Чекає погодження','Можна відправляти','Відправлено'].some(l => має(оп, l)),
  'оператори бачать передрук … на станках, і нічого далі', 'оператори: ' + JSON.stringify(оп));
ok(кя.seat === 'prod' && ['На станках','Контроль якості','Чекає погодження','Можна відправляти'].every(l => має(кя, l)) &&
   !['Передрук','Нове','Очікуємо одяг','Відправлено'].some(l => має(кя, l)),
  'контроль якості бачить на станках … можна відправляти', 'контроль якості: ' + JSON.stringify(кя));
ok(заг.seat === 'prod' && ['Передрук','Нове','На станках','Можна відправляти','Відправлено'].every(l => має(заг, l)),
  'виробництво (загальне) бачить усю дошку', 'виробництво: ' + JSON.stringify(заг));

console.log('');
console.log('═══ БРАК — У «ПЕРЕДРУК» ═══');
const стан = await p.evaluate(() => {
  const D = window.LQDesign;
  return { брак: D.prodAt({}, { tracks:{ prod:'done', qc:'bad' } }),
           виправлено: D.prodAt({}, { tracks:{ prod:'done', qc:'check' } }),
           зроблено: D.prodAt({}, { tracks:{ prod:'done' } }) };
});
ok(стан.брак === 'redo' && стан.виправлено === 'appr' && стан.зроблено === 'qc',
  'брак → Передрук; брак закрито → Чекає погодження; пошито → Контроль якості', JSON.stringify(стан));

console.log('');
console.log('═══ РОЛІ Є В СПИСКУ, НАВІТЬ ЯКЩО СПИСОК УЖЕ ЗБЕРЕГЛИ ═══');
const ролі = await p.evaluate(() => {
  contentData.roles = [{ key:'owner', name:'Власник', ui:'manager', nav:'*', boards:'*', see:[], can:'*' }];
  return roleDefs().map(r => r.key + ':' + (r.cols || []).join('/'));
});
console.log('  ' + ролі.join(' · '));
ok(ролі.some(r => r.indexOf('operator:redo/') === 0) && ролі.some(r => r.indexOf('qcprod:run/') === 0),
  'оператори й контроль якості додались до збережених ролей', 'ролі: ' + ролі.join(', '));

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
