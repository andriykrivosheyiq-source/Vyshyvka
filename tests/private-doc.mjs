/* ГРОШІ Й ЛЮДИ — У ЗАКРИТОМУ ДОКУМЕНТІ (27.10). Аудит: `loomiq/photos`
   читає будь-хто без входу (з нього вантажиться сайт), а адмінка складала
   туди ж рахунки з IBAN, зарплати, команду з правами, журнал доступу,
   постачальників і відправників НП. Тепер ці ключі живуть у `loomiq/private`,
   який правила віддають лише команді.

   Що стережемо:
   1. Список закритих ключів повний, і жоден з них не потрібен публічним
      сторінкам (сайт, КП, каталог, квіз).
   2. Правила: `loomiq/private` читає лише команда; права (`acl`) беруться
      звідти, а до переїзду — зі старого місця.
   3. Воркер грошей знаходить рахунки й відправників і до переїзду, і після;
      після — не ходить у публічний документ; ставить мітку `moneyCfg`.
   4. Адмінка: запис закритого ключа йде в `loomiq/private`; закритий не
      віддається (правила ще старі) — пише по-старому, нічого не ламається;
      переїзд робить вкладка власника лише після мітки воркера: копія →
      перевірка → лише тоді стирання зі старого.
   5. Емулятор (якщо є): чужий без входу й увійшовший не з команди закритий
      документ не читають; людина з команди читає; права з закритого діють.

   Запуск:  node tests/private-doc.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ═══ 1. СПИСОК ЗАКРИТИХ КЛЮЧІВ ═══ */
console.log('═══ 1. ЗАКРИТІ КЛЮЧІ ═══');
const ADMIN = read('loomiqadmin.html');
const m = /const PRIVATE_KEYS = \[([^\]]+)\]/.exec(ADMIN);
const KEYS = m ? m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
const MUST = ['fin','payroll','team','acl','ownerEmail','teamBak','teamGone','roles','profiles',
              'accessLog','suppliers','ship','shifts'];
ok(MUST.every(k => KEYS.includes(k)), 'рахунки, зарплати, команда, права, журнал, постачальники, відправники, зміни — закриті',
   'не закриті: ' + MUST.filter(k => !KEYS.includes(k)).join(', '));
const PUBLIC = ['index.html', 'offer.html', 'offer-edit.html', 'catalog.html', 'loomiq-kit.js', 'loomiq-constructor.js',
                'quiz/index.html', 'k/index.html', 'loomiq-cards.js', 'loomiq-pricing.js', 'catalog-base.js']
  .filter(f => fs.existsSync(path.join(ROOT, f)));
const uses = [];
PUBLIC.forEach(f => { const s = read(f); KEYS.forEach(k => { if(new RegExp('[.\'"]' + k + '\\b').test(s)) uses.push(f + ':' + k); }); });
ok(!uses.length, 'жодна публічна сторінка не читає закритих ключів (їм вистачає loomiq/photos)',
   'публічні сторінки читають закрите: ' + uses.join(', '));
ok(/PHOTOS_DOC\.set\(/.test(ADMIN) && !/SHARED_DOC\.set\(\{ *(fin|payroll|team|acl|accessLog|suppliers|ship|shifts|profiles)\b/.test(ADMIN),
   'повз обгортку закриті ключі в публічний документ не пишуться', 'прямий запис закритого ключа в SHARED_DOC');

/* ═══ 2. ПРАВИЛА (текстом) ═══ */
console.log('\n═══ 2. ПРАВИЛА ═══');
const RULES = read('firestore.rules');
const blk = (/match \/loomiq\/private \{([\s\S]*?)\n    \}/.exec(RULES) || [])[1] || '';
ok(/allow read: if known\(\);/.test(blk), 'loomiq/private читає лише команда (known())', 'правило читання: ' + blk.slice(0, 120));
ok(!/if true/.test(blk), 'жодного «if true» у закритому документі', 'знайдено if true');
ok(/function aclMap\(\)[\s\S]{0,200}pcfg\(\)[\s\S]{0,80}cfg\(\)\.get\('acl'/.test(RULES),
   'права беруться із закритого, а до переїзду — зі старого місця', 'aclMap не читає loomiq/private');
/* Рев'ю 27.10, Б1: дозволи у Firestore додаються — загальне правило
   `loomiq/{doc}` не має пускати в private, інакше закритий блок нічого не закриває. */
const catchAll = (/match \/loomiq\/\{doc\} \{([\s\S]*?)\n    \}/.exec(RULES) || [])[1] || '';
ok(/!\(doc in \['photos', 'private'\]\)/.test(catchAll), 'загальне правило loomiq/{doc} не пускає в private (і в photos)',
   'загальне правило: ' + catchAll.trim().slice(0, 120));
ok(/function aclOn\(\)[^\n]*migrated/.test(RULES), 'після переїзду порожня карта прав — не «доступ усім»', 'aclOn без страховки migrated');
const knk = (/match \/knocks\/\{key\} \{([\s\S]*?)\n    \}/.exec(RULES) || [])[1] || '';
ok(/key == aclKey\(\)/.test(knk) && /allow read, delete: if may\('setup'\)/.test(knk),
   'стуки: кожен пише лише свій, читає лише той, хто налаштовує доступи', 'правила knocks: ' + knk.trim().slice(0, 120));

/* ═══ 3. ВОРКЕР ГРОШЕЙ ═══ */
console.log('\n═══ 3. ВОРКЕР ГРОШЕЙ: ДО ПЕРЕЇЗДУ Й ПІСЛЯ ═══');
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { FIREBASE_PROJECT: 'test', HOOK_SECRET: 'sek', NP_KEY_yukalchuk: 'KEY-Y',
  FIREBASE_SA: JSON.stringify({ client_email: 'sa@test', private_key: privateKey.export({ type:'pkcs8', format:'pem' }) }) };
const sv = v => ({ stringValue: v });
const DB = {};
const FIN = { mapValue: { fields: { accounts: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('np1'), bank: sv('np'), name: sv('НП · Юкальчук'), sender: sv('yukalchuk') } } } ] } } } } };
const SHIP = { mapValue: { fields: { senders: { arrayValue: { values: [
  { mapValue: { fields: { id: sv('yukalchuk'), name: sv('ФОП Юкальчук') } } } ] } } } } };
DB['loomiq/photos'] = { fin: FIN, ship: SHIP };
const NP_ST = { '20450000000101': { Number:'20450000000101', StatusCode:'9', Status:'Відправлення отримано',
  AfterpaymentOnGoodsCost:'1580', RecipientDateTime:'20.10.2026 14:05:00' } };
const gets = [];
const FAIL = {};
const npKeys = [];
const realFetch = globalThis.fetch;            // повертаємо перед емулятором: він вантажить правила через fetch
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status || 200 });
  if(url.startsWith('https://oauth2.googleapis.com/token')) return res({ access_token:'tok', expires_in:3600 });
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body); npKeys.push(b.apiKey);
    if(b.apiKey !== 'KEY-Y') return res({ success:false, errors:['API key is invalid'] });
    if(b.calledMethod === 'getDocumentList') return res({ success:true, data: [{ IntDocNumber:'20450000000101' }] });
    if(b.calledMethod === 'getStatusDocuments') return res({ success:true, data: (b.methodProperties.Documents || []).map(d => NP_ST[d.DocumentNumber]).filter(Boolean) });
    return res({ success:true, data:[] });
  }
  if(url.endsWith('documents:commit')){
    for(const w of JSON.parse(opt.body).writes){ const p = w.update.name.split('/documents/')[1];
      DB[p] = DB[p] || {}; w.updateMask.fieldPaths.forEach(k => { DB[p][k] = w.update.fields[k]; }); }
    return res({});
  }
  const mm = /documents\/([^?]+)/.exec(url);
  if(mm){
    const p = decodeURIComponent(mm[1]);
    if((opt.method || 'GET') === 'GET'){ gets.push(p);
      if(FAIL[p]) return res({ error:'boom' }, FAIL[p]);
      return DB[p] ? res({ fields: DB[p] }) : res({ error:'nf' }, 404); }
    const b = JSON.parse(opt.body);
    const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(x => decodeURIComponent(x[1]));
    DB[p] = DB[p] || {}; mask.forEach(k => { DB[p][k] = b.fields[k]; });
    return res({});
  }
  return res({}, 404);
};
const wmod = await import(path.join(ROOT, 'worker/money.js') + '?t=' + Date.now());
const call = pth => wmod.default.fetch(new Request('https://w.test' + pth), env).then(r => r.json());
const mark = () => { const f = DB['loomiq/private'] && DB['loomiq/private'].moneyCfg;
  return f ? +(f.integerValue !== undefined ? f.integerValue : f.doubleValue) : 0; };

const p1 = await call('/poll?s=sek');
ok(npKeys.includes('KEY-Y'), 'до переїзду: відправник знайдений у старому місці, НП опитана своїм ключем',
   'ключі НП: ' + JSON.stringify(npKeys) + ' · ' + JSON.stringify(p1.np));
ok(mark() >= 2, 'воркер поставив мітку moneyCfg у закритому документі — адмінка знає, що можна переносити',
   'мітки немає: ' + JSON.stringify(DB['loomiq/private']));

/* Переїзд: fin і ship — у закритому, зі старого стерто. */
DB['loomiq/private'].fin = FIN; DB['loomiq/private'].ship = SHIP;
delete DB['loomiq/photos'].fin; delete DB['loomiq/photos'].ship;
npKeys.length = 0; gets.length = 0;
const p2 = await call('/poll?s=sek');
ok(npKeys.includes('KEY-Y'), 'після переїзду: відправник і рахунок НП знайдені в закритому документі',
   'ключі НП: ' + JSON.stringify(npKeys) + ' · ' + JSON.stringify(p2.np));
ok(gets.includes('loomiq/private') && !gets.includes('loomiq/photos'),
   'після переїзду воркер у публічний документ за налаштуваннями не ходить (той самий один запит, що й був)',
   'читання: ' + JSON.stringify([...new Set(gets)]));
ok(gets.filter(g => g === 'loomiq/private').length === 1,
   'налаштування читаються один раз за запуск, хоч рахунки й відправники потрібні багато разів',
   'читань loomiq/private за запуск: ' + gets.filter(g => g === 'loomiq/private').length);

/* Рев'ю 27.10, В4: база відповіла помилкою — це не «рахунків немає». */
FAIL['loomiq/private'] = 503;
npKeys.length = 0;
const before = JSON.stringify(Object.keys(DB).filter(k => k.startsWith('payments/')).sort());
let p3 = null; try{ p3 = await call('/poll?s=sek'); }catch(e){ p3 = { thrown: String(e && e.message || e) }; }
const after = JSON.stringify(Object.keys(DB).filter(k => k.startsWith('payments/')).sort());
ok(!npKeys.length && before === after,
   'база впала — воркер не опитує НП запасним ключем і не пише рухи без рахунку',
   'ключі НП: ' + JSON.stringify(npKeys) + ' · відповідь: ' + JSON.stringify(p3).slice(0, 160));
delete FAIL['loomiq/private'];
globalThis.fetch = realFetch;

/* ═══ 4. АДМІНКА ═══ */
console.log('\n═══ 4. АДМІНКА: КУДИ ПИШЕ Й ЯК ПЕРЕНОСИТЬ ═══');
const PW = '/opt/node22/lib/node_modules/playwright/index.mjs';
const CHROME = process.env.LQ_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let chromium = null;
try{ ({ chromium } = await import(PW)); }catch(e){}
if(!chromium || !fs.existsSync(CHROME)){
  console.log('  пропущено: немає Playwright/Chromium (' + CHROME + ')');
} else {
  const PORT = 8990 + Math.floor(Math.random() * 40);
  const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
  const srv = createServer(async (req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    try{ const body = await readFile(f); res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(body); }
    catch(e){ res.writeHead(404); res.end('no'); }
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const HOST = 'http://127.0.0.1:' + PORT;
  const browser = await chromium.launch({ executablePath: CHROME });

  const TEAM = [{ email:'test@loomiq', name:'Андрій', role:'owner' }, { email:'sales@loomiq', name:'Марта', role:'manager' }];
  const OLD = { at:'2026-10-20T10:00:00Z', by:'sales@loomiq', kind:'open', text:'старий рядок' };
  const BASE = { team: TEAM, acl: { test_loomiq: { setup: true } }, ownerEmail: 'test@loomiq',
    payroll: { staff: [{ id:'s1', name:'Марта' }] }, fin: { accounts: [{ id:'mono1', bank:'mono', iban:'UA00 0000' }] },
    suppliers: [{ id:'sp1', name:'Постачальник' }], profiles: { sales_loomiq: { name:'Марта' } },
    accessLog: [OLD], products: { hidden: [] }, faq: [] };

  /* content — що лежить у loomiq/photos; priv — що віддає закритий
     ('deny' — правила не пускають). Транзакція стуба виконується справді:
     читання й записи йдуть через ті самі get/set/update. */
  async function open(content, priv){
    let fb = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
    fb = fb.replace('window.firebase={', 'window.__CONTENT=' + JSON.stringify(content) + ';window.__PRIV=' +
      JSON.stringify(priv) + ';\n  window.firebase={');
    fb = fb.replace('Col.prototype.doc=function(){ return new Doc(); };',
      'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
    fb = fb.replace("Doc.prototype.set=function(){ return Promise.resolve(); };",
      "Doc.prototype.set=function(v){ if(this.__id==='private' && window.__PRIV==='deny') return Promise.reject({code:'permission-denied'});" +
      " if(this.__via!=='update') (window.__SETS=window.__SETS||[]).push({ col:this.__col, id:this.__id, v:JSON.parse(JSON.stringify(v)) }); return Promise.resolve(); };");
    fb = fb.replace("Doc.prototype.get=function(){ return Promise.resolve(new Snap('x', null)); };",
      "Doc.prototype.get=function(){ var id=this.__id, col=this.__col;" +
      " if(col==='loomiq' && id==='private'){ if(window.__PRIV==='deny') return Promise.reject({code:'permission-denied'});" +
      "   var acc=JSON.parse(JSON.stringify(window.__PRIV||{})); (window.__SETS||[]).filter(function(x){ return x.col===col && x.id===id; }).forEach(function(x){ Object.assign(acc, x.v); });" +
      "   return Promise.resolve(new Snap(id, Object.keys(acc).length ? acc : null)); }" +
      " if(col==='loomiq' && id==='photos') return Promise.resolve(new Snap(id, window.__CONTENT));" +
      " return Promise.resolve(new Snap(id||'x', null)); };");
    fb = fb.replace("Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap('x', null)); }catch(e){} return function(){}; };",
      "Doc.prototype.onSnapshot=function(cb, err){ var d=null;" +
      " if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;" +
      " if(this.__col==='loomiq' && this.__id==='private'){ if(window.__PRIV==='deny'){ setTimeout(function(){ err && err({code:'permission-denied'}); }, 0); return function(){}; } d=window.__PRIV; }" +
      " try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
    fb = fb.replace('var fs=function(){ return { collection:function(){ return new Col(); },',
      'var fs=function(){ return { collection:function(n){ var c=new Col(); c.__n=n; return c; },');
    fb = fb.replace('runTransaction:function(f){ return Promise.resolve(); },',
      'runTransaction:function(f){ window.__TX=(window.__TX||0)+1; var tx={ get:function(r){ return r.get(); }, set:function(r,v,o){ return r.set(v,o); }, update:function(r,v){ return r.update(v); } }; return Promise.resolve(f(tx)); },');
    const p = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
    p.on('dialog', d => d.accept(d.defaultValue() || ''));
    await p.route('**://**', r => {
      const u = r.request().url();
      if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body: fb });
      if(u.startsWith(HOST)) return r.continue();
      return r.abort();
    });
    await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
    await p.waitForTimeout(3500);
    p.__errs = errs;
    return p;
  }
  const sets = p => p.evaluate(() => (window.__SETS || []).map(x => ({ col: x.col, id: x.id, keys: Object.keys(x.v), v: x.v })));
  const upd = p => p.evaluate(() => (window.__UPDATES || []).filter(x => x.col === 'loomiq').map(x => ({ id: x.id, keys: x.keys })));
  const keysOf = (L, id) => L.filter(s => s.col === 'loomiq' && s.id === id).map(s => s.keys).flat();

  /* а) Закритого ще немає, воркер старий: читаємо зі старого; зарплати —
        у закритий; рахунки (їх читає воркер) — поки в старий; нічого не стираємо. */
  const a = await open(BASE, null);
  const A = await a.evaluate(async () => {
    const r = { team: (contentData.team || []).length, ok: PRIV_OK, payroll: !!contentData.payroll };
    await PHOTOS_DOC.set({ payroll: { staff: [] } }, { merge:true });
    await PHOTOS_DOC.set({ fin: { accounts: [] } }, { merge:true });
    await PHOTOS_DOC.set({ faq: [{ q:'?' }] }, { merge:true });
    return r;
  });
  const aS = await sets(a), aU = await upd(a);
  ok(A.team === 2 && A.payroll && A.ok === true, 'до переїзду команда й зарплати читаються зі старого місця — доступи на місці',
     'стан: ' + JSON.stringify(A));
  ok(keysOf(aS, 'private').includes('payroll') && !keysOf(aS, 'photos').includes('payroll'),
     'зарплати пишуться в закритий документ, не в публічний', 'записи: ' + JSON.stringify(aS.map(x => [x.id, x.keys])));
  ok(keysOf(aS, 'photos').includes('fin') && !keysOf(aS, 'private').includes('fin'),
     'рахунки до мітки воркера — ще в старе місце: воркер грошей бачить нові рахунки', 'записи: ' + JSON.stringify(aS.map(x => [x.id, x.keys])));
  ok(keysOf(aS, 'photos').includes('faq'), 'контент сайту (FAQ) пишеться, як і доти, у публічний', 'записи: ' + JSON.stringify(aS.map(x => [x.id, x.keys])));
  ok(!aU.some(u => u.id === 'photos'), 'без мітки воркера зі старого документа нічого не стирається', 'стирання: ' + JSON.stringify(aU));
  ok(!a.__errs.length, 'без помилок на сторінці', 'помилки: ' + a.__errs.join(' | '));
  await a.close();

  /* б) Воркер оновлений: власник переносить усе однією транзакцією.
        У закритому вже є свій рядок журналу, свій профіль і ІНША зарплата. */
  const NEW = { at:'2026-10-27T10:00:00Z', by:'test@loomiq', kind:'open', text:'новий рядок' };
  const b = await open(BASE, { moneyCfg: 2, accessLog: [NEW], profiles: { test_loomiq: { name:'Андрій' } },
                                payroll: { staff: [{ id:'s2', name:'Нова' }] } });
  await b.waitForTimeout(1500);
  const bS = await sets(b), bU = await upd(b);
  const bP = Object.assign({}, ...bS.filter(s => s.col === 'loomiq' && s.id === 'private').map(s => s.v));
  const wiped = bU.filter(u => u.id === 'photos').map(u => u.keys).flat();
  const need = ['team', 'acl', 'ownerEmail', 'payroll', 'fin', 'suppliers', 'profiles', 'accessLog'];
  ok(await b.evaluate(() => (window.__TX || 0) > 0), 'переїзд — однією транзакцією над обома документами', 'транзакції не було');
  ok(['team', 'acl', 'ownerEmail', 'fin', 'suppliers'].every(k => k in bP) && bP.migrated === true,
     'власник переніс команду, права, рахунки, постачальників і поставив migrated', 'у закритий лягло: ' + JSON.stringify(Object.keys(bP)));
  ok(Array.isArray(bP.accessLog) && bP.accessLog.some(r => r.text === 'старий рядок') && bP.accessLog.some(r => r.text === 'новий рядок'),
     'журнал обʼєднано: жоден рядок не загубився', 'журнал: ' + JSON.stringify(bP.accessLog));
  ok(bP.profiles && bP.profiles.sales_loomiq && bP.profiles.test_loomiq,
     'профілі злиті по людях: і ті, що були в старому місці, і нові', 'профілі: ' + JSON.stringify(bP.profiles));
  ok(bP.migrBak && bP.migrBak.keys && bP.migrBak.keys.payroll && bP.migrBak.keys.payroll.staff[0].id === 's1',
     'інша зарплата зі старого місця не зникла — лягла в резервну копію migrBak', 'migrBak: ' + JSON.stringify(bP.migrBak));
  ok(need.every(k => wiped.includes(k)) && !wiped.includes('products') && !wiped.includes('faq'),
     'і лише в тій самій транзакції стерто зі старого; товари й FAQ лишились для сайту', 'стерто: ' + JSON.stringify(wiped));
  ok(!b.__errs.length, 'без помилок на сторінці', 'помилки: ' + b.__errs.join(' | '));
  await b.close();

  /* в) Правила ще старі (закритий не віддається), команда в старому місці:
        все по-старому. */
  const c = await open(BASE, 'deny');
  const C = await c.evaluate(async () => {
    const r = { team: (contentData.team || []).length, ok: PRIV_OK, loaded: contentLoaded };
    await PHOTOS_DOC.set({ payroll: { staff: [] } }, { merge:true });
    return r;
  });
  const cS = await sets(c);
  ok(C.loaded && C.team === 2 && C.ok === false, 'правила ще старі — сторінка відкрилась, команда на місці', 'стан: ' + JSON.stringify(C));
  ok(keysOf(cS, 'photos').includes('payroll') && !keysOf(cS, 'private').length,
     'і запис іде по-старому — код раніше за правила нічого не ламає', 'записи: ' + JSON.stringify(cS.map(x => [x.id, x.keys])));
  await c.close();

  /* г) Рев'ю 27.10, Б3: після переїзду людина не з команди (закритий не
        віддається, у старому місці команди вже немає) — не власник. */
  const PUB = { products: { hidden: [] }, faq: [] };
  const d = await open(PUB, 'deny');
  await d.waitForTimeout(800);
  const D = await d.evaluate(async () => {
    const r = { none: JSON.stringify(myAccReal()) === JSON.stringify(ACC_NONE), gate: !!document.getElementById('no-access'),
                setup: (typeof canSetup === 'function') ? canSetup() : null };
    let rejected = false;
    try{ await PHOTOS_DOC.set({ payroll: { staff: [] } }, { merge:true }); }catch(e){ rejected = true; }
    r.rejected = rejected;
    return r;
  });
  const dS = await sets(d);
  ok(D.none && D.gate && D.setup === false, 'людина не з команди після переїзду бачить «Вас ще не додали», а не інтерфейс власника',
     'стан: ' + JSON.stringify(D));
  ok(D.rejected && !keysOf(dS, 'photos').some(k => ['payroll', 'accessLog', 'team'].includes(k)),
     'і нічого закритого не пише в публічний документ', 'записи: ' + JSON.stringify(dS.map(x => [x.col, x.id, x.keys])));
  ok(dS.some(s => s.col === 'knocks' && s.v && s.v.email === 'test@loomiq'),
     'її спроба входу лягла окремим стуком (knocks) — власник побачить, кого додати', 'стуки: ' + JSON.stringify(dS.filter(s => s.col === 'knocks')));
  await d.close();

  await browser.close();
  srv.close();
}

/* ═══ 5. ЕМУЛЯТОР ═══ */
console.log('\n═══ 5. ПРАВИЛА НА ЕМУЛЯТОРІ ═══');
const EMU = process.env.LQ_EMU_DIR || '/tmp/claude-0/emu';
const JAR = (() => { try{ const d = path.join(process.env.HOME || '/root', '.cache/firebase/emulators');
  return fs.readdirSync(d).filter(f => /^cloud-firestore-emulator.*\.jar$/.test(f)).map(f => path.join(d, f))[0]; }catch(e){ return ''; } })();
let RUT;
try{ RUT = createRequire(path.join(EMU, 'x.js'))('@firebase/rules-unit-testing'); }catch(e){}
if(!RUT || !JAR){
  console.log('  пропущено: немає емулятора Firestore (' + (!JAR ? 'jar' : '@firebase/rules-unit-testing') + ')');
} else {
  const req = createRequire(path.join(EMU, 'x.js'));
  const { doc, getDoc, setDoc, setLogLevel } = req('firebase/firestore');
  setLogLevel('silent');
  const PORT = 8840 + Math.floor(Math.random() * 40);
  const emu = spawn('java', ['-jar', JAR, '--host', '127.0.0.1', '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('емулятор не стартував')), 40000);
    const on = s => { if(/Dev App Server is now running|is now running/.test(String(s))){ clearTimeout(t); res(); } };
    emu.stdout.on('data', on); emu.stderr.on('data', on);
  });
  const tenv = await RUT.initializeTestEnvironment({ projectId: 'loomiq-private',
    firestore: { host: '127.0.0.1', port: PORT, rules: read('firestore.rules') } });
  const can = async pr => { try{ await pr; return true; }catch(e){ return false; } };
  await tenv.withSecurityRulesDisabled(async cx => {
    const db = cx.firestore();
    await setDoc(doc(db, 'loomiq/photos'), { products: {}, faq: [] });
    await setDoc(doc(db, 'loomiq/private'), { acl: { own_loomiq: { setup: true }, mgr_loomiq: { edit: true } },
      payroll: { staff: [] }, fin: { accounts: [{ iban: 'UA00' }] } });
  });
  const anon = tenv.unauthenticatedContext().firestore();
  const stranger = tenv.authenticatedContext('x', { email: 'stranger@mail' }).firestore();
  const mgr = tenv.authenticatedContext('m', { email: 'mgr@loomiq' }).firestore();
  const own = tenv.authenticatedContext('o', { email: 'own@loomiq' }).firestore();
  ok(await can(getDoc(doc(anon, 'loomiq/photos'))), 'сайт без входу читає loomiq/photos, як і доти', 'публічний документ закрився');
  ok(!(await can(getDoc(doc(anon, 'loomiq/private')))), 'без входу loomiq/private не читається', 'анонім читає зарплати');
  ok(!(await can(getDoc(doc(stranger, 'loomiq/private')))), 'увійшовший не з команди — теж ні', 'чужий акаунт читає зарплати');
  ok(await can(getDoc(doc(mgr, 'loomiq/private'))), 'людина з команди читає', 'менеджер не читає закритий');
  ok(!(await can(setDoc(doc(mgr, 'loomiq/private'), { payroll: { x: 1 } }, { merge: true }))),
     'менеджер без права налаштувань зарплати не пише', 'менеджер переписав зарплати');
  ok(await can(setDoc(doc(own, 'loomiq/private'), { payroll: { x: 1 } }, { merge: true })), 'власник пише', 'власник не пише');
  ok(!(await can(setDoc(doc(stranger, 'kanbanOrders/z'), { a: 1 }))), 'права з закритого діють: чужий картку не створить', 'чужий пише картки');
  ok(!(await can(setDoc(doc(mgr, 'loomiq/private'), { acl: { mgr_loomiq: { setup: true } } }, { merge: true }))),
     'менеджер не дасть собі setup через загальне правило loomiq/{doc}', 'менеджер переписав права');
  ok(await can(setDoc(doc(stranger, 'knocks/stranger_mail'), { email: 'stranger@mail', at: '2026-10-27T10:00:00Z', n: 1 })),
     'чужий лишає свій стук', 'стук не пускають');
  ok(!(await can(setDoc(doc(stranger, 'knocks/mgr_loomiq'), { email: 'stranger@mail', at: 'x', n: 1 }))),
     'чужий не пише стук під чужою поштою', 'стук під чужою поштою пройшов');
  ok(!(await can(getDoc(doc(mgr, 'knocks/stranger_mail')))), 'стуки читає лише той, хто налаштовує доступи', 'менеджер читає стуки');
  await tenv.cleanup();
  emu.kill();
}

console.log('');
console.log(bad ? '✗ Закритий документ: ' + bad + ' перевірок не пройшло' : '✓ Гроші й люди — у закритому документі');
process.exit(bad ? 1 : 0);
