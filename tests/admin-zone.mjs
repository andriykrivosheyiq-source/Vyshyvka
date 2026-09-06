/* Два входи, яких бракувало: позиція у варіанти й розділ доступів.

   ПЕРШЕ. Зібрану позицію можна було посунути вище-нижче й перекинути в
   рекомендовані — і все. Порахував менеджер худі, клієнт просить «а
   покажіть ще оверсайз»: позиція вже зібрана, а покласти її поруч як
   варіант нема як. Лишався один шлях — завести товар з нуля в групі
   варіантів і викинути цей.

   ДРУГЕ. Список команди лежав усередині «Формування цін» — між ставками
   друку й термінами. Знайти його міг хіба той, хто знав, що він там є, а
   доступи — це не довідник цін, це керування людьми.

   Перевіряємо:
     — у панелі позиції є «У варіанти», і вона питає, у яку саме групу;
     — вибір летить в адмінку разом із назвою групи;
     — «Команда й доступи» — окремий розділ бічного меню;
     — його не видно тому, кому не дозволено міняти налаштування, навіть
       якщо розділ стоїть у його списку;
     — у розділі справді редактор команди, і людину заводять поштою.

   Запуск:  node tests/admin-zone.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8823;
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
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

console.log('═══ ПОЗИЦІЮ МОЖНА ПЕРЕНЕСТИ У ВАРІАНТИ ═══');
{
  const fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  const VH = path.join(ROOT, '_zone_kp.html');
  fs.writeFileSync(VH,
`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}iframe{border:0;width:900px;height:1400px}</style>
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
  await p.goto(HOST + '/_zone_kp.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(4000);
  const item = (n, extra) => Object.assign({ kind:'main', name:n, qty:20, unitPrice:600,
    price:12000, mockups:[], prints:[], views:[], sides:[], techniques:[], tiers:[],
    specs:[], about:'' }, extra || {});
  await p.evaluate(o => window.__edit(o), {
    orderId:'1009100', client:{ name:'Андрій', company:'ARMORIX' },
    terms:{ deadlineDays:7, holdDays:5 }, trust:[], faq:[], cases:[], reco:[], state:'',
    items:[ item('Худі базове') ],
    /* Одна група вже є — саме її й мають запропонувати першою. */
    variants:[ item('Футболка поло', { kind:'variant', vgroup:'Футболки' }) ],
    vqty:{ 'Футболки':30 }
  });
  await p.waitForTimeout(1500);
  const fr = p.frames()[1];

  const bar = await fr.evaluate(() =>
    [...document.querySelectorAll('.edbar [data-ed]')].map(b => b.dataset.ed));
  console.log('  панель позиції: ' + bar.join(' · '));
  ok(bar.indexOf('tovariant') >= 0,
    'у панелі позиції є перенесення у варіанти',
    'кнопки «У варіанти» немає: ' + bar.join(','));

  await fr.evaluate(() => {
    const b = document.querySelector('.edbar [data-ed="tovariant"][data-k="main"]');
    if(b) b.click();
  });
  await p.waitForTimeout(500);
  const pick = await fr.evaluate(() => ({
    box: !!document.querySelector('.edpick .is-groups'),
    groups: [...document.querySelectorAll('.edpick [data-g]')].map(x => x.dataset.g),
    input: !!document.querySelector('#edGName')
  }));
  console.log('  пропонують групи: ' + (pick.groups.join(', ') || 'немає'));
  ok(pick.box && pick.groups.join() === 'Футболки' && pick.input,
    'спершу показують групи цього КП, і поруч — поле для нової',
    'вибору групи немає: ' + JSON.stringify(pick));

  await fr.click('.edpick [data-g="Футболки"]');
  await p.waitForTimeout(500);
  const sent = await p.evaluate(() => (window.__sent || []).slice(-1)[0] || null);
  console.log('  надіслано: ' + JSON.stringify(sent));
  ok(sent && sent.act === 'tovariant' && sent.kind === 'main' && sent.vgroup === 'Футболки',
    'вибір летить в адмінку разом із назвою групи',
    'в адмінку пішло не те: ' + JSON.stringify(sent));
  try{ fs.unlinkSync(VH); }catch(e){}
  await p.close();
}

console.log('');
console.log('═══ ДОСТУПИ — ОКРЕМИЙ РОЗДІЛ, І ТІЛЬКИ ДЛЯ АДМІНА ═══');
{
  /* Двоє в команді: власник і менеджер. Заходить менеджер — розділу доступів
     він бачити не має, навіть якщо той стоїть у його списку розділів. */
  const TEAM = [
    { email:'boss@loomiq.net', name:'Андрій', role:'owner' },
    { email:'mgr@loomiq.net',  name:'Оксана', role:'manager',
      acc:{ ui:'manager', nav:['board','calc','team'], boards:'*',
            see:['client','chat'], can:['edit','pay'] } }
  ];
  const mk = async (who) => {
    let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
    fbstub = fbstub.replace('window.firebase={',
      'window.__CONTENT=' + JSON.stringify({ team: TEAM }) + ';\n' +
      '  window.__WHO=' + JSON.stringify(who) + ';\n  window.firebase={');
    fbstub = fbstub.replace(
      'Col.prototype.doc=function(){ return new Doc(); };',
      'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
    fbstub = fbstub.replace(
      "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
      'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
      "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
      "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
    fbstub = fbstub.replace(
      'var fs=function(){ return { collection:function(){ return new Col(); },',
      'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
    /* Хто саме зайшов — це і є весь механізм прав: пошта з авторизації. */
    fbstub = fbstub.split("email:'test@loomiq'").join('email:window.__WHO');
    const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
    p.on('pageerror', e => errs.push('адмінка: ' + e.message.slice(0, 160)));
    await p.route('**://**', r => {
      const u = r.request().url();
      if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
      if(u.startsWith(HOST)) return r.continue();
      return r.abort();
    });
    await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(5500);
    return p;
  };

  const boss = await mk('boss@loomiq.net');
  const seen = await boss.evaluate(() => ({
    email: (typeof myEmail === 'function') ? myEmail() : '',
    nav: [...document.querySelectorAll('.nav button[data-view]')]
           .filter(b => !b.hidden).map(b => b.dataset.view),
    setup: (typeof canSetup === 'function') ? canSetup() : null
  }));
  console.log('  власник ' + seen.email + ': ' + seen.nav.join(' · '));
  ok(seen.nav.indexOf('team') >= 0,
    'у власника в меню є «Команда й доступи»',
    'розділу немає в меню: ' + seen.nav.join(','));

  await boss.evaluate(() => {
    const b = document.querySelector('.nav button[data-view="team"]');
    if(b) b.click();
  });
  await boss.waitForTimeout(1200);
  const inside = await boss.evaluate(() => {
    const v = document.getElementById('view-team');
    return {
      open: !!v && v.style.display === 'block',
      title: (v && v.querySelector('h1') || {}).textContent || '',
      rows: v ? v.querySelectorAll('#team-list [data-i]').length : 0,
      mails: v ? [...v.querySelectorAll('#team-list input[type=email], #team-list input')]
                   .map(i => i.value).filter(x => /@/.test(x)) : [],
      add: !!(v && v.querySelector('#team-add')),
      save: !!(v && v.querySelector('#team-save'))
    };
  });
  console.log('  ' + inside.title + ' · людей: ' + inside.rows + ' · ' + inside.mails.join(', '));
  ok(inside.open && /Команда/.test(inside.title) && inside.add && inside.save,
    'розділ відкривається, і в ньому редактор команди',
    'розділ не той: ' + JSON.stringify(inside));
  ok(inside.mails.indexOf('mgr@loomiq.net') >= 0,
    'людина в списку заведена поштою — нею ж вона й заходить',
    'пошти в списку немає: ' + JSON.stringify(inside.mails));
  await boss.close();

  const mgr = await mk('mgr@loomiq.net');
  const hidden = await mgr.evaluate(() => ({
    email: (typeof myEmail === 'function') ? myEmail() : '',
    nav: [...document.querySelectorAll('.nav button[data-view]')]
           .filter(b => !b.hidden).map(b => b.dataset.view),
    setup: (typeof canSetup === 'function') ? canSetup() : null,
    /* Розділ у списку менеджера СТОЇТЬ — і все одно не показується. */
    inList: (typeof myAcc === 'function') && (myAcc().nav || []).indexOf('team') >= 0
  }));
  console.log('  менеджер ' + hidden.email + ': ' + hidden.nav.join(' · ') +
              ' · у списку зон team: ' + hidden.inList);
  ok(hidden.inList && hidden.nav.indexOf('team') < 0,
    'менеджеру розділ доступів не показують, навіть коли він у його списку',
    'менеджер бачить доступи: ' + hidden.nav.join(','));
  ok(hidden.setup === false,
    'і права міняти налаштування в нього немає',
    'у менеджера є право setup');
  await mgr.close();
}

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'позиція їде у варіанти, а доступи роздає тільки адміністратор');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
