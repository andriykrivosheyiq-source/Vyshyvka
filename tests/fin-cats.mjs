/* Категорії витрат і перекази між своїми одним рядком (05.10).

   Андрій: «витрати повторюються на конкретний канал трафіку чи конкретні
   реквізити — підписувати, куди йдуть кошти: Facebook — реклама, конкретний
   ФОП — підрядник одягу; категорії й підкатегорії». І: «7 500 з Моно
   Малєєвої на картку — це переказ між своїми, одним рядком; а вже
   списання з картки — це витрата».

   Запуск:  node tests/fin-cats.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8983;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const srv = createServer(async (req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
  catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const HOST = 'http://127.0.0.1:' + PORT;

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const errs = [];

/* «Я» — власник: бачу і Фінанси, і всю аналітику. */
const CONTENT = { team: [{ email:'test@loomiq', name:'Андрій', role:'owner' }] };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
/* Документи знають, хто вони: так видно, що саме записали у Фінанси й у
   постійні витрати, і що саме стерли. */
fbstub = fbstub.replace('Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
  "Doc.prototype.set=function(v){ (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)) }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.delete=function(){ return Promise.resolve(); };",
  "Doc.prototype.delete=function(){ (window.__DELS=window.__DELS||[]).push({ col:this.__col, id:this.__id }); return Promise.resolve(); };");
fbstub = fbstub.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
  "Doc.prototype.get=function(){ var s=(window.__SETS||[]).filter(function(x){ return x.col===this.__col && x.id===this.__id; }, this).pop();" +
  " return Promise.resolve(new Snap(this.__id||'x', s ? s.v : null)); };");
fbstub = fbstub.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
  "Doc.prototype.onSnapshot=function(cb){ var d=null; if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
  " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace("return Promise.resolve({ id:'stub' });",
  "return Promise.resolve({ id:'pay' + (window.__ADDED.length) });");
fbstub = fbstub.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
  'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
/* prompt «скільки виплачено» — приймаємо запропоноване число; confirm — так. */
p.on('dialog', d => d.accept(d.defaultValue() || ''));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
await p.evaluate(() => { const g = document.getElementById('auth-gate'); if(g) g.style.display = 'none'; });




const T = Date.parse('2026-10-05T09:00:00.000Z');
const iso = m => new Date(T + m * 60000).toISOString();
await p.evaluate(([a, b, c, d, e, f, g, h, i]) => {
  payWatching = true; payLoaded = true;
  contentData.fin = Object.assign({}, contentData.fin, { accounts:[
    { id:'mono1', name:'Моно Малєєва', bank:'mono' }, { id:'mono2', name:'Картка Катерини', bank:'mono' },
    { id:'mono3', name:'Приват ФОП', bank:'privat' } ] });
  payments.length = 0;
  payments.push(
    { id:'t1', at:a, amount:-7500, acc:'mono1', counter:'Катерина М.', desc:'Переказ на картку', src:'mono' },
    { id:'t2', at:b, amount: 7500, acc:'mono2', counter:'Малєєва К.', desc:'Поповнення', src:'mono' },
    { id:'p1', at:a, amount:-3000, acc:'mono1', counter:'ФОП Зелена', src:'mono' },
    { id:'p2', at:c, amount: 3000, acc:'mono3', counter:'Малєєва К.', src:'privat' },
    { id:'s1', at:a, amount:-1200, acc:'mono1', counter:'Хтось', src:'mono' },
    { id:'s2', at:c, amount: 1200, acc:'mono2', counter:'Хтось', src:'mono' },
    { id:'f1', at:d, amount:-2500, acc:'mono2', counter:'Facebook Ads', desc:'FACEBK *ADS', src:'mono' },
    { id:'f2', at:e, amount:-1800, acc:'mono2', counter:'Facebook Ads', src:'mono' },
    { id:'k1', at:f, amount:-9000, acc:'mono1', counter:'ФОП Коваленко', desc:'за футболки', src:'mono' },
    { id:'z1', at:g, amount:-5000, acc:'mono1', counter:'Оля', desc:'Зарплата · жовтень', src:'salary' });
}, [iso(0), iso(2), iso(180), iso(240), iso(300), iso(360), iso(420)]);
await p.click('[data-view="fin"]');
await p.waitForTimeout(400);

console.log('═══ ПЕРЕКАЗИ МІЖ СВОЇМИ — ОДНИМ РЯДКОМ ═══');
const rows = () => p.evaluate(() => [...document.querySelectorAll('#fin-list .fin-row')].map(r => ({ id: r.dataset.finId, t: r.textContent.replace(/\s+/g, ' ').trim() })));
const r0 = await rows();
r0.forEach(r => console.log('   · ' + r.t.slice(0, 120)));
const ids = r0.map(r => r.id);
const t1 = r0.find(r => r.id === 't1');
ok(t1 && /Переказ між своїми рахунками/.test(t1.t) && /Моно Малєєва → Картка Катерини/.test(t1.t) && /7 500/.test(t1.t) && !ids.includes('t2'),
  '7 500 Моно Малєєва → Картка Катерини — один рядок «переказ між своїми», друга половина не дублюється', 'переказ: ' + JSON.stringify(t1));
ok(ids.includes('p1') && !ids.includes('p2') && /Моно Малєєва → Приват ФОП/.test((r0.find(r => r.id === 'p1') || {}).t),
  'між різними банками (Моно → Приват, зарахування через 3 год) — теж зʼєднано', 'Моно → Приват не зʼєднано');
ok(ids.includes('s1') && ids.includes('s2') && !/між своїми/.test((r0.find(r => r.id === 's1') || {}).t.replace('між своїми рахунками', '')),
  'той самий банк, але через 3 години — не вгадуємо: це два окремі рухи', 'зʼєднали зайве');
const sum = await p.evaluate(() => (document.getElementById('fin-sum') || {}).textContent || '');
ok(/Між своїми рахунками: 10 500/.test(sum), 'перекази не рахуються ні доходом, ні витратою: «' + sum.replace(/\s+/g, ' ').trim() + '»', 'підсумок: ' + sum);

console.log('');
console.log('═══ КАТЕГОРІЇ Й ПРАВИЛО «ЗАВЖДИ ТАК» ═══');
const chip = id => p.evaluate(i => ((document.querySelector('.fin-row[data-fin-id="' + i + '"] .fin-chip') || {}).textContent || '').trim(), id);
ok(/категорія\?/.test(await chip('f1')) && /Команда · Зарплата/.test(await chip('z1')),
  'витрата без підпису — «категорія?»; зарплата підписана сама', 'чипи: ' + await chip('f1') + ' / ' + await chip('z1'));
await p.evaluate(() => document.querySelector('.fin-row[data-fin-id="f1"] .fin-chip').click());
await p.waitForTimeout(200);
const вікно = await p.evaluate(() => ({ cats: [...document.querySelectorAll('[data-fc]')].map(b => b.textContent),
  rule: ((document.querySelector('.fin-rule') || {}).textContent || '').trim(), income: !!document.querySelector('[data-fin-tag]') }));
ok(вікно.cats.includes('Реклама') && вікно.cats.includes('Закупівля') && /Завжди так для «Facebook Ads»/.test(вікно.rule) && !вікно.income,
  'у витрати — категорії й «Завжди так для «Facebook Ads»» (без підписів надходжень)', 'вікно: ' + JSON.stringify(вікно));
await p.evaluate(() => [...document.querySelectorAll('[data-fc]')].find(b => b.textContent === 'Реклама').click());
await p.waitForTimeout(100);
const subs = await p.evaluate(() => [...document.querySelectorAll('[data-fs]')].map(b => b.textContent));
ok(subs.includes('Facebook / Instagram') && subs.includes('Google'), 'обрали категорію — зʼявились підкатегорії: ' + subs.join(', '), 'підкатегорії: ' + subs);
await p.evaluate(() => { [...document.querySelectorAll('[data-fs]')].find(b => /Facebook/.test(b.textContent)).click(); });
await p.waitForTimeout(100);
await p.evaluate(() => { document.querySelector('[data-fc-rule]').checked = true; document.querySelector('[data-fc-save]').click(); });
await p.waitForTimeout(400);
const після = { f1: await chip('f1'), f2: await chip('f2'), k1: await chip('k1'),
  rules: await p.evaluate(() => finRules().map(r => r.q + '→' + r.cat + '/' + r.sub)) };
console.log('   ' + JSON.stringify(після));
ok(/Реклама · Facebook \/ Instagram/.test(після.f1) && /Реклама · Facebook \/ Instagram/.test(після.f2) && /⚙/.test(після.f2),
  'правило підписало й іншу витрату «Facebook Ads» (позначка ⚙ — правилом)', 'f2: ' + після.f2);
ok(після.rules.join() === 'facebook ads→ads/meta' && /категорія\?/.test(після.k1), 'правило одне; чужі витрати не чіпає', 'правила: ' + після.rules);
/* Нова витрата з тим самим платником — підписується сама. */
await p.evaluate(at => { payments.push({ id:'f3', at, amount:-900, acc:'mono2', counter:'Facebook Ads', src:'mono' }); renderFin(); }, iso(500));
await p.waitForTimeout(200);
ok(/Реклама · Facebook/.test(await chip('f3')), 'нова витрата від Facebook Ads — одразу «Реклама · Facebook / Instagram»', 'f3: ' + await chip('f3'));

console.log('');
console.log('═══ ПІДСУМОК І ФІЛЬТР ЗА КАТЕГОРІЯМИ ═══');
const cs = await p.evaluate(() => [...document.querySelectorAll('.fin-cs')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
console.log('   ' + cs.join(' | '));
ok(cs.some(t => /Реклама 5 200/.test(t)) && cs.some(t => /Команда 5 000/.test(t)) && cs.some(t => /без категорії 10 200/.test(t)) && !cs.some(t => /7 500|10 500/.test(t)),
  'витрати за категоріями: Реклама 5 200, Команда 5 000, без категорії 10 200 — перекази між своїми не рахуються', 'підсумок: ' + cs.join(' | '));
await p.evaluate(() => [...document.querySelectorAll('.fin-cs')].find(b => /Реклама/.test(b.textContent)).click());
await p.waitForTimeout(200);
const фільтр = (await rows()).map(r => r.id).sort().join();
ok(фільтр === 'f1,f2,f3', 'клік по категорії — у списку лише її витрати', 'фільтр: ' + фільтр);
await p.evaluate(() => { finView.cat = ''; renderFin(); });

console.log('');
console.log('═══ НАЛАШТУВАННЯ КАТЕГОРІЙ ═══');
await p.click('#fin-cats');
await p.waitForTimeout(200);
const кільк = await p.evaluate(() => document.querySelectorAll('.fc-c').length);
await p.evaluate(() => { const i = [...document.querySelectorAll('[data-fcn]')].findIndex(x => x.value === 'Закупівля');
  document.querySelector('[data-fs-add="' + i + '"]').click(); });
await p.waitForTimeout(100);
await p.evaluate(() => { const ins = [...document.querySelectorAll('[data-fsn]')]; const l = ins.filter(x => x.value === 'Нова')[0]; l.value = 'Сировина'; });
await p.evaluate(() => document.querySelector('[data-fc-save-all]').click());
await p.waitForTimeout(300);
const нові = await p.evaluate(() => (finCats().find(c => c.name === 'Закупівля').subs || []).map(x => x.name));
ok(кільк >= 8 && нові.includes('Сировина') && нові.includes('Підрядник одягу'), 'категорії правляться: додали підкатегорію «Сировина» до «Закупівля»', 'підкатегорії: ' + нові);

console.log('');
console.log('═══ NOVAPAY: ПУЛ НАЛОЖОК І ПЕРЕКАЗ СОБІ ═══');
const доПулу = await p.evaluate(() => (document.getElementById('fin-sum') || {}).textContent.replace(/\s+/g, ' '));
await p.evaluate(at => { payments.push(
  { id:'novapay_1', at, amount: 50000, acc:'mono3', counter:'NovaPay · пул наложок', desc:'згідно реєстру № 18321608', src:'novapay', flow:'pool' },
  { id:'novapay_2', at, amount: -1000, acc:'mono3', counter:'Кривошей Андрій Ігорович', desc:'Перерахування чистого підприємницького доходу', src:'novapay', flow:'self' });
  finView.cat = ''; renderFin(); }, iso(400));
await p.waitForTimeout(200);
const пул = await chip('novapay_1'), собі = await chip('novapay_2');
const зПулом = await p.evaluate(() => (document.getElementById('fin-sum') || {}).textContent.replace(/\s+/g, ' '));
const над = t => (/Надійшло: ([^₴]+)₴/.exec(t) || [])[1], вит = t => (/Витрачено: ([^₴]+)₴/.exec(t) || [])[1];
ok(/пул наложок/.test(пул) && /між своїми/.test(собі) && над(доПулу) === над(зПулом) && вит(доПулу) === вит(зПулом),
  'пул NovaPay — «пул наложок», переказ собі — «між своїми»; ні доходом, ні витратою не порахувались', 'пул: ' + пул + ' / ' + собі + ' · ' + доПулу + ' → ' + зПулом);

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad : 'витрати підписані категоріями, перекази між своїми — одним рядком');
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
