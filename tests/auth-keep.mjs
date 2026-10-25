/* ВХІД НЕ ЗЛІТАЄ Й НЕ ВИСИТЬ (25.10) — на СПРАВЖНЬОМУ Firebase Auth
   (compat-збірка з npm-пакета firebase), мережа Google підмінена.

   Менеджер з iPhone: «після кожного збереження вибиває, входжу з Face ID…
   і коли перезавантажую», «Вхід…» висить. Блок auth-ls у loomiqadmin.html
   (між «▶ auth-ls» і «◀ auth-ls») тримає вхід у localStorage і не чекає
   Google-iframe. Тут той самий блок — у чисту сторінку з SDK:

   1. Як було: IndexedDB не відповідає — setPersistence не повертається
      (так і виникало «Вхід…» назавжди).
   2. З блоком: при тій самій «глухій» IndexedDB вхід проходить, лягає в
      localStorage.
   3. Перезавантаження: вхід відновлюється без IndexedDB.
   4. Як було на телефоні: SDK чекає apis.google.com — форма входу стоїть,
      хоч вхід збережено.
   5. З блоком: вхід відновлюється одразу, до Google ніхто не ходить.
   6. IndexedDB справна: вхід усе одно в localStorage, базу SDK не створює,
      а наша (передача з телефона) відкривається як і доти.
   7. Адмінка: «Вхід…» не висить — за LQ_AUTH_WAIT_MS кажемо словами й
      повертаємо кнопку.

   Потрібна збірка firebase (LQ_FB_DIR або /tmp/claude-0/emu/node_modules/firebase,
   див. handoff.md); без неї кроки 1–6 кажуть «пропущено», крок 7 іде зі стубом.

   Запуск:  node tests/auth-keep.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 9141;
const FB = process.env.LQ_FB_DIR || '/tmp/claude-0/emu/node_modules/firebase';
const HAVE_FB = fs.existsSync(path.join(FB, 'firebase-auth-compat.js')) && fs.existsSync(path.join(FB, 'firebase-app-compat.js'));
const ADMIN = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
const BLOCK = (ADMIN.match(/\/\* ▶ auth-ls[\s\S]*?\/\* ◀ auth-ls \*\//) || [''])[0];
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const PAGE = `<!doctype html><meta charset="utf-8"><body>
<script>
  const q = new URLSearchParams(location.search);
  /* «Глуха» IndexedDB — лише для бази SDK: відкриття не відповідає ніколи. */
  if(q.get('hang') === '1'){
    const o = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(name){
      if(name === 'firebaseLocalStorageDb') return { addEventListener(){}, removeEventListener(){} };
      return o.apply(this, arguments);
    };
  }
  if(q.get('fix') !== '1') window.LQ_AUTH_IDB = 1;
</script>
<script src="/fb/firebase-app-compat.js"></script>
<script src="/fb/firebase-auth-compat.js"></script>
<script>
  firebase.initializeApp({ apiKey:'test-key', authDomain:'loomiq-admin.firebaseapp.com', projectId:'loomiq-admin' });
  ${BLOCK}
  const fbAuth = firebase.auth();
  window.__state = [];
  fbAuth.onAuthStateChanged(u => { window.__state.push(u ? u.email : null); });
  window.__setP = () => fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => 'ok');
  window.__login = async mail => {
    await fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await fbAuth.signInWithEmailAndPassword(mail, 'x');
    return 'ok';
  };
</script></body>`;

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if(u === '/page.html'){ res.writeHead(200, { 'Content-Type':'text/html' }); return res.end(PAGE); }
  const f = u.startsWith('/fb/') ? path.join(FB, u.slice(4)) : path.join(ROOT, u.replace(/^\/+/, ''));
  try{
    const body = await readFile(f);
    const ext = path.extname(f);
    res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : 'application/octet-stream' });
    res.end(body);
  }catch(e){ res.writeHead(404); res.end('no'); }
});
await new Promise(r => srv.listen(PORT, r));
const HOST = 'http://127.0.0.1:' + PORT;

/* Підмінена мережа Google: вхід паролем, профіль, оновлення ключа. */
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(mail){
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg:'RS256', typ:'JWT' }) + '.' + b64({ iss:'https://securetoken.google.com/loomiq-admin', aud:'loomiq-admin',
    auth_time: now, user_id:'u1', sub:'u1', iat: now, exp: now + 3600, email: mail, email_verified: false,
    firebase:{ identities:{ email:[mail] }, sign_in_provider:'password' } }) + '.sig';
}
let gapiHits = 0, googleSlow = false;
async function wire(ctx){
  await ctx.route(/identitytoolkit\.googleapis\.com/, async route => {
    const url = route.request().url();
    let body = {};
    if(/accounts:signInWithPassword/.test(url)){
      const mail = (JSON.parse(route.request().postData() || '{}').email) || 'x@loomiq';
      body = { kind:'identitytoolkit#VerifyPasswordResponse', localId:'u1', email: mail, displayName:'', idToken: jwt(mail), registered:true, refreshToken:'r1', expiresIn:'3600' };
    }else if(/accounts:lookup/.test(url)){
      body = { kind:'identitytoolkit#GetAccountInfoResponse', users:[{ localId:'u1', email:'ddbura@loomiq', emailVerified:false,
        providerUserInfo:[{ providerId:'password', email:'ddbura@loomiq', rawId:'ddbura@loomiq' }], createdAt:'0', lastLoginAt:'0' }] };
    }else if(/getProjectConfig/.test(url)){
      body = { projectId:'loomiq-admin', authorizedDomains:['127.0.0.1', 'localhost'] };
    }
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(body) });
  });
  await ctx.route(/securetoken\.googleapis\.com/, async route => {
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ access_token: jwt('ddbura@loomiq'), id_token: jwt('ddbura@loomiq'),
      expires_in:'3600', refresh_token:'r1', token_type:'Bearer', user_id:'u1', project_id:'loomiq-admin' }) });
  });
  await ctx.route(/apis\.google\.com|firebaseapp\.com/, async route => {
    gapiHits++;
    if(googleSlow){ await sleep(90000); }
    await route.fulfill({ status:404, body:'' });
  });
}

const browser = await chromium.launch();
try{
  if(!HAVE_FB){
    console.log('пропущено: немає збірки firebase (' + FB + ') — кроки 1–6');
  }else{
    const ctx = await browser.newContext({ userAgent: IPHONE });
    await wire(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('  [помилка сторінки]', String(e).slice(0, 160)));

    console.log('1. Як було: IndexedDB не відповідає');
    await p.goto(HOST + '/page.html?hang=1&fix=0');
    let r = await p.evaluate(() => Promise.race([window.__setP(), new Promise(res => setTimeout(() => res('висить'), 5000))]));
    ok(r === 'висить', 'setPersistence без блока — висить (так і було «Вхід…»)', 'setPersistence повернувся: ' + r);

    console.log('2. З блоком: та сама IndexedDB — вхід проходить у localStorage');
    await p.goto(HOST + '/page.html?hang=1&fix=1');
    r = await p.evaluate(() => Promise.race([window.__setP(), new Promise(res => setTimeout(() => res('висить'), 5000))]));
    ok(r === 'ok', 'setPersistence повернувся одразу', 'setPersistence: ' + r);
    r = await p.evaluate(() => Promise.race([window.__login('ddbura@loomiq'), new Promise(res => setTimeout(() => res('висить'), 15000))]));
    ok(r === 'ok', 'вхід паролем пройшов', 'вхід: ' + r);
    await p.waitForFunction(() => window.__state.includes('ddbura@loomiq'), null, { timeout: 5000 }).catch(() => {});
    let st = await p.evaluate(() => ({ state: window.__state, ls: Object.keys(localStorage).filter(k => /^firebase:authUser:/.test(k)) }));
    ok(st.state.includes('ddbura@loomiq'), 'onAuthStateChanged дав користувача', 'стан: ' + JSON.stringify(st.state));
    ok(st.ls.length === 1, 'вхід лежить у localStorage', 'localStorage без входу');

    console.log('3. Перезавантаження: вхід відновлюється без IndexedDB');
    await p.goto(HOST + '/page.html?hang=1&fix=1');
    await p.waitForFunction(() => window.__state.length, null, { timeout: 8000 }).catch(() => {});
    st = await p.evaluate(() => window.__state);
    ok(st[0] === 'ddbura@loomiq', 'після перезавантаження — та сама людина', 'стан після перезавантаження: ' + JSON.stringify(st));

    console.log('4. Як було на телефоні: SDK чекає apis.google.com');
    /* Окреме вікно: без блока SDK переніс би вхід у IndexedDB — і кроки 5–6
       перевіряли б уже не те. */
    googleSlow = true; gapiHits = 0;
    const ctx4 = await browser.newContext({ userAgent: IPHONE });
    await wire(ctx4);
    const p4 = await ctx4.newPage();
    await p4.goto(HOST + '/page.html?hang=0&fix=0');
    await sleep(5000);
    st = await p4.evaluate(() => window.__state);
    ok(!st.length, 'без блока 5 с — SDK ще не сказав, хто ввійшов (форма входу стоїть)', 'стан: ' + JSON.stringify(st));
    ok(gapiHits > 0, 'SDK пішов на Google (' + gapiHits + ')', 'SDK на Google не ходив');
    await ctx4.close();

    console.log('5. З блоком: вхід одразу, до Google ніхто не йде');
    gapiHits = 0;
    await p.goto(HOST + '/page.html?hang=0&fix=1');
    await p.waitForFunction(() => window.__state.length, null, { timeout: 5000 }).catch(() => {});
    st = await p.evaluate(() => window.__state);
    ok(st[0] === 'ddbura@loomiq', 'користувач відновився за секунди', 'стан: ' + JSON.stringify(st));
    ok(gapiHits === 0, 'на apis.google.com не ходили', 'ходили на Google: ' + gapiHits);
    googleSlow = false;

    console.log('6. IndexedDB справна: вхід усе одно в localStorage, наша база відкривається');
    r = await p.evaluate(async () => {
      const dbs = (await indexedDB.databases()).map(d => d.name);
      const ours = await new Promise((res, rej) => { const q = indexedDB.open('lq_handoff_test', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => { q.result.close(); res('ok'); }; q.onerror = () => rej(q.error); setTimeout(() => res('висить'), 3000); });
      return { dbs, ours };
    });
    ok(!r.dbs.includes('firebaseLocalStorageDb'), 'бази SDK в IndexedDB немає', 'SDK створив IndexedDB: ' + r.dbs.join(', '));
    ok(r.ours === 'ok', 'своя IndexedDB (передача з телефона) відкривається', 'своя IndexedDB: ' + r.ours);
    await ctx.close();
  }

  console.log('7. Адмінка: «Вхід…» не висить');
  const ctx2 = await browser.newContext();
  let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
  fbstub = fbstub.replace("onAuthStateChanged:function(cb){ setTimeout(function(){ cb({ uid:'test', email:'test@loomiq' }); }, 0); return function(){}; },",
    "onAuthStateChanged:function(cb){ setTimeout(function(){ cb(null); }, 0); return function(){}; }, setPersistence:function(){ return Promise.resolve(); },")
    .replace("signInWithEmailAndPassword:function(){ return Promise.resolve(); },", "signInWithEmailAndPassword:function(){ return new Promise(function(){}); },")
    .replace("window.firebase.auth.EmailAuthProvider = {", "window.firebase.auth.Auth = { Persistence:{ LOCAL:'local', SESSION:'session', NONE:'none' } };\n  window.firebase.auth.EmailAuthProvider = {");
  await ctx2.route(/firebasejs|gstatic\.com/, route => {
    if(/firebase-app-compat/.test(route.request().url())) return route.fulfill({ status:200, contentType:'application/javascript', body: fbstub });
    return route.fulfill({ status:200, contentType:'application/javascript', body:'' });
  });
  const a = await ctx2.newPage();
  await a.addInitScript(() => { window.LQ_AUTH_WAIT_MS = 800; window.LQ_NO_CACHE = 1; });
  await a.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
  await a.fill('#auth-email', 'ddbura@loomiq'); await a.fill('#auth-pass', 'x');
  await a.click('#auth-submit');
  await sleep(300);
  let b = await a.evaluate(() => ({ txt: document.getElementById('auth-submit').textContent, dis: document.getElementById('auth-submit').disabled }));
  ok(b.txt === 'Вхід…' && b.dis, 'поки чекаємо — «Вхід…»', 'кнопка: ' + JSON.stringify(b));
  await a.waitForFunction(() => document.getElementById('auth-submit').textContent === 'Увійти', null, { timeout: 4000 }).catch(() => {});
  b = await a.evaluate(() => ({ txt: document.getElementById('auth-submit').textContent, dis: document.getElementById('auth-submit').disabled,
    err: document.getElementById('auth-err').textContent, shown: document.getElementById('auth-err').style.display }));
  ok(b.txt === 'Увійти' && !b.dis, 'за таймаутом кнопка повернулась', 'кнопка: ' + JSON.stringify(b));
  ok(/не відповідає/.test(b.err) && b.shown === 'block', 'сказано словами: «' + b.err + '»', 'помилка: ' + JSON.stringify(b));
  await ctx2.close();
}finally{
  await browser.close();
  srv.close();
}
console.log(bad ? ('✗ не пройшло: ' + bad) : '✓ вхід тримається й не висить');
process.exit(bad ? 1 : 0);
