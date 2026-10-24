/* РОЛІ ПО НАПРЯМАХ (Андрій, 20.10).

   Менеджер B2B — лише замовлення й чати B2B; менеджер B2C — лише B2C;
   графічний і вишивальний дизайнер — лише «Замовлення B2C», кожен на своїй
   дошці. Збережені ролі міняються один раз, права не чіпаються.

   Запуск:  node tests/roles-dir.mjs  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9127;
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

const OLD = [
  { key:'owner', name:'Власник', ui:'manager', nav:'*', boards:'*', see:['client','chat','cost'], can:['new','setup'] },
  { key:'manager', name:'Менеджер', ui:'manager', nav:['today','dash','board','chats','calc','photos','reviews','suppliers'], boards:'*', see:['client','chat'], can:['new','edit','write'] },
  { key:'designer', name:'Дизайнер', ui:'designer', nav:['today','dash','board','design'], boards:['design'], see:[], can:['art','stage'] },
  { key:'embroidery', name:'Вишивальний дизайнер', ui:'designer', nav:['today','dash','board','design'], boards:['embro'], see:[], can:['stitch'] },
  { key:'designmgr', name:'Акаунт-менеджер', ui:'manager', nav:['chatsc','design'], boards:['acct'], see:['client','chat'], can:['new'] }
];
const CONTENT = { team:[{ email:'test@loomiq', name:'Оля', role:'owner' }], roles: OLD };
const ORDERS = [];

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify(ORDERS) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(){}\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{ cb({\n' +
  '    docs:window.__ORDERS.map(function(o){ return new Snap(o.id,o); }),\n' +
  '    forEach:function(f){ window.__ORDERS.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '    empty:false }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol();\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1500, height:940 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept(''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u))
    return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3500);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });

const r = await p.evaluate(async () => {
  contentLoaded = true;
  await rolesSeedOnce();
  const roles = contentData.roles;
  const nav = k => { const x = roles.find(r => r.key === k); return x ? (x.nav === '*' ? '*' : x.nav.slice().sort().join(',')) : null; };
  const name = k => (roles.find(r => r.key === k) || {}).name;
  const can = k => ((roles.find(r => r.key === k) || {}).can || []).join(',');
  /* Що бачить людина: міняємо роль і дивимось меню. */
  const меню = role => {
    contentData.team = [{ email:'test@loomiq', name:'Оля', role }];
    applyRoleUi();
    return [...document.querySelectorAll('.nav button[data-view]')].filter(b => !b.hidden).map(b => b.dataset.view).sort().join(',');
  };
  const out = { seed: contentData.rolesSeed, manager: nav('manager'), managerName: name('manager'), managerb2c: nav('managerb2c'), b2cName: name('managerb2c'),
    designer: nav('designer'), embroidery: nav('embroidery'), canDesigner: can('designer'), canEmbro: can('embroidery'),
    меню: { designer: меню('designer'), embroidery: меню('embroidery'), manager: меню('manager'), managerb2c: меню('managerb2c') } };
  contentData.team = [{ email:'test@loomiq', name:'Оля', role:'owner' }]; applyRoleUi();
  return out;
});
console.log('  ' + JSON.stringify(r));
ok(r.seed >= 1 && r.manager === 'board,chats' && r.managerName === 'Менеджер B2B', '«Менеджер B2B» — лише Замовлення B2B і Чати B2B', JSON.stringify(r));
ok(r.managerb2c === 'chatsc,design' && r.b2cName === 'Менеджер B2C', 'новий «Менеджер B2C» — лише Замовлення B2C і Чати B2C', JSON.stringify(r));
ok(r.designer === 'design' && r.embroidery === 'design', 'графічний і вишивальний — лише «Замовлення B2C»', JSON.stringify(r));
ok(r.canDesigner === 'art,stage' && r.canEmbro === 'stitch', 'права дизайнерів не змінились', JSON.stringify(r));
ok(r.меню.designer === 'design' && r.меню.embroidery === 'design' && r.меню.manager === 'board,chats' && r.меню.managerb2c === 'chatsc,design',
  'у меню рівно ці пункти', JSON.stringify(r.меню));

ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'ролі по напрямах — як домовились');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
