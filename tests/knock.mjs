/* Людина заходить, а її немає в команді — і це більше не глухий кут.

   ЩО СТАЛОСЬ. Менеджери одного ранку загубили доступ. Кожна бачила табличку
   «вас ще не додали в команду» — і все. Далі вона могла тільки написати в
   Telegram, а власник міг тільки повірити на слово: у самій системі про ці
   спроби не було жодного сліду. Поки листувались, люди не працювали.

   Найгірше тут не сама втрата, а те, що система про неї мовчала. Доступ
   видають у ній, впираються в неї ж — а дізнаються про це месенджером.

   ЯК ТЕПЕР. Кожна спроба входу без доступу пише рядок у журнал. Журнал —
   єдине, у що така людина має право писати: правила бази дозволяють їй лише
   дописувати `accessLog`. У «Команді й доступах» ці пошти стоять окремою
   смугою, над усім іншим, із кнопкою «додати в команду». Той, кого прибрали
   раніше, повертається зі своїми доступами з «Прибраних», а не заводиться
   наново.

   Запуск:  node tests/knock.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8881;
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

/* Команда є, і чужої пошти в ній немає — рівно та ситуація, у якій людина
   бачить табличку. */
const CONTENT = {
  ownerEmail:'boss@loomiq.net',
  team:[{ email:'boss@loomiq.net', name:'Володимир', role:'owner' },
        { email:'mgr@loomiq.net',  name:'Ігор',      role:'manager' }],
  teamGone:[{ email:'olya@loomiq.net', name:'Оля', role:'manager',
              goneAt:'2026-09-20T08:00:00.000Z' }],
  accessLog:[]
};

let stub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
stub = stub.replace('window.firebase={',
  'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
stub = stub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
stub = stub.replace(
  "Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
stub = stub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
/* Запамʼятовуємо, що саме пішло в базу: слід має бути НЕ тільки на екрані. */
stub = stub.replace('Doc.prototype.set=function(',
  'Doc.prototype.set=function(d){ try{ window.__WROTE=(window.__WROTE||[]).concat([d]); }catch(e){} return Doc.prototype.__set.apply(this, arguments); };\n' +
  '  Doc.prototype.__set=function(');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const open = async mail => {
  const pg = await browser.newPage({ viewport:{ width:1400, height:1000 } });
  pg.on('pageerror', e => errs.push(mail + ': ' + e.message.slice(0, 150)));
  await pg.route('**://**', r => {
    const u = r.request().url();
    if(/gstatic\.com\/firebasejs/.test(u))
      return r.fulfill({ contentType:'application/javascript',
                         body: stub.replace(/email:'test@loomiq'/g, "email:'" + mail + "'") });
    if(u.startsWith(HOST)) return r.continue();
    return r.abort();
  });
  await pg.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(5200);
  return pg;
};

console.log('═══ ЧУЖА ПОШТА ВПИРАЄТЬСЯ В ТАБЛИЧКУ — І ЛИШАЄ СЛІД ═══');
const she = await open('olya@loomiq.net');
const seen = await she.evaluate(() => ({
  box: !!document.getElementById('no-access'),
  mail: (document.querySelector('#no-access .na-mail') || {}).textContent || '',
  сказано: (document.querySelector('#no-access .na-sub') || {}).textContent || '',
  журнал: (accLogList() || []).filter(r => r.kind === 'knock').map(r => r.by + ' · ' + r.text),
  вбазу: (window.__WROTE || []).filter(d => d && d.accessLog)
           .map(d => (d.accessLog[d.accessLog.length - 1] || {}).kind)
}));
console.log('  ' + JSON.stringify(seen.журнал));
ok(seen.box && /olya@loomiq\.net/.test(seen.mail),
  'табличка на місці й називає пошту, якою зайшли',
  'таблички немає або вона мовчить: ' + JSON.stringify(seen));
ok(seen.журнал.length === 1 && /olya@loomiq\.net/.test(seen.журнал[0]),
  'спроба входу лягла в журнал — інших слідів така людина лишити не може',
  'сліду немає: ' + JSON.stringify(seen.журнал));
ok(seen.вбазу.indexOf('knock') >= 0,
  'і саме в базу, а не лише на екран: інакше власник цього не побачить',
  'у базу нічого не пішло: ' + JSON.stringify(seen.вбазу));
ok(/записали вашу спробу/.test(seen.сказано),
  'людині сказано, що її спробу побачать — а не просто «попросіть когось»',
  'екран лишився глухим кутом: ' + seen.сказано);

/* Десяток «оновити» поспіль не має перетворювати журнал на шум. */
const вдруге = await she.evaluate(() => {
  applyNoAccess(); applyNoAccess(); applyNoAccess();
  return (accLogList() || []).filter(r => r.kind === 'knock').length;
});
ok(вдруге === 1,
  'десять спроб поспіль лишають один слід, а не десять рядків шуму',
  'журнал засипало: ' + вдруге + ' рядків');
await she.close();

console.log('');
console.log('═══ ВЛАСНИК БАЧИТЬ ЦЕ В «КОМАНДІ Й ДОСТУПАХ» ═══');
const boss = await open('boss@loomiq.net');
const смуга = await boss.evaluate(() => {
  /* Той самий журнал, що вона щойно записала, приїхав до власника. */
  contentData.accessLog = (contentData.accessLog || []).concat([
    { at:new Date().toISOString(), by:'olya@loomiq.net', kind:'knock',
      text:'спроба входу без доступу: olya@loomiq.net' },
    { at:new Date().toISOString(), by:'olya@loomiq.net', kind:'knock',
      text:'спроба входу без доступу: olya@loomiq.net' },
    { at:new Date().toISOString(), by:'mgr@loomiq.net', kind:'knock',
      text:'спроба входу без доступу: mgr@loomiq.net' }
  ]);
  document.querySelector('.nav button[data-view="team"]').click();
  const rows = [...document.querySelectorAll('.tm-knock-row')];
  return { видно: rows.map(r => (r.querySelector('b') || {}).textContent),
           підпис: (rows[0] && (rows[0].querySelector('span') || {}).textContent) || '',
           кнопок: document.querySelectorAll('[data-knock]').length };
});
console.log('  у смузі: ' + смуга.видно.join(', ') + ' · ' + смуга.підпис);
ok(смуга.видно.join() === 'olya@loomiq.net',
  'у смузі лише той, кого в команді немає — Ігор у ній є, і його тут бути не має',
  'смуга показує не тих: ' + JSON.stringify(смуга.видно));
ok(/2 спроби/.test(смуга.підпис),
  'і видно, скільки разів людина стукала — одна спроба це чи цілий ранок',
  'кількості спроб не видно: ' + смуга.підпис);

console.log('');
console.log('═══ ОДИН КЛІК ПОВЕРТАЄ ЛЮДИНУ РАЗОМ ІЗ ДОСТУПАМИ ═══');
const назад = await boss.evaluate(() => {
  document.querySelector('[data-knock="olya@loomiq.net"]').click();
  const p = teamList().filter(x => x.email === 'olya@loomiq.net')[0];
  return { уСписку: !!p, роль: p && p.role, імʼя: p && p.name,
           уПрибраних: (contentData.teamGone || []).some(g => g.email === 'olya@loomiq.net'),
           смугаЗникла: !document.querySelector('[data-knock="olya@loomiq.net"]') };
});
console.log('  ' + JSON.stringify(назад));
ok(назад.уСписку && назад.роль === 'manager' && назад.імʼя === 'Оля',
  'повернувся саме її рядок із «Прибраних» — з імʼям і роллю, а не порожній новий',
  'людину завели наново: ' + JSON.stringify(назад));
ok(!назад.уПрибраних,
  'і з «Прибраних» вона пішла — інакше та сама людина стояла б у двох місцях',
  'рядок лишився в «Прибраних»');
ok(назад.смугаЗникла,
  'зі смуги «заходили, але доступу немає» вона зникла одразу',
  'смуга й далі кличе додати вже додану');

const новий = await boss.evaluate(() => {
  document.querySelector('[data-knock="mgr@loomiq.net"]');
  contentData.accessLog = contentData.accessLog.concat([
    { at:new Date().toISOString(), by:'new@loomiq.net', kind:'knock',
      text:'спроба входу без доступу: new@loomiq.net' }]);
  renderTeamList();
  const b = document.querySelector('[data-knock="new@loomiq.net"]');
  if(!b) return { немаєКнопки:true };
  b.click();
  const p = teamList().filter(x => x.email === 'new@loomiq.net')[0];
  return { роль: p && p.role, доступи: !!(p && p.acc && p.acc.nav && p.acc.nav.length) };
});
ok(новий.роль === 'manager' && новий.доступи,
  'а зовсім нову пошту заводить менеджером з робочими доступами — не порожнім рядком',
  'нову пошту завели без прав: ' + JSON.stringify(новий));
await boss.close();

console.log('');
ok(!errs.length, 'сторінки без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'втрачений доступ видно в самій системі, а не лише в Telegram');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
