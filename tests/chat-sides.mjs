/* Наші повідомлення праворуч, клієнтські ліворуч — і видно, хто з менеджерів
   писав.

   ЯК БУЛО. У стрічці Sitniks уся розмова ставала ліворуч: і питання
   менеджера, і відповіді клієнта. Прочитати, хто кому що написав, було
   неможливо — а це єдине, заради чого стрічку взагалі відкривають.

   ЧОМУ. Бік визначався перебором звичних назв поля («isOutgoing»,
   «direction», «senderType»…). Документація Sitniks закрита, у робочому
   акаунті не збіглась жодна назва, і все падало у «не наше». Помилки при
   цьому немає — просто мовчки неправильно.

   ЯК СТАЛО. Прямі ознаки лишились першими: сказав Sitniks словом — віримо.
   А коли не сказав, звіряємо підпис із тим, з ким ця розмова: ми ж знаємо
   співрозмовника, бо самі привʼязали діалог. Підписався клієнт — ліворуч;
   підписався хтось інший — це наш менеджер, праворуч, і його імʼя заразом
   стає підписом під повідомленням.

   Перевіряємо:
     — клієнт ліворуч, менеджер праворуч, коли поля «вихідне» немає зовсім;
     — під нашими повідомленнями стоїть імʼя менеджера, під клієнтськими — ні;
     — імʼя клієнта ніколи не стає підписом нашого повідомлення;
     — прямій ознаці від Sitniks віримо навіть проти підпису;
     — свіжовідправлене з Loomiq одразу праворуч і підписане собою;
     — сиру відповідь Sitniks видно, і лише тому, хто налаштовує систему.

   Запуск:  node tests/chat-sides.mjs      (з кореня репозиторію)  */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 8848;
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp' };

const CHAT_ID = '6aa910231444b9f4123817a1';
/* Відповідь, схожа на справжню: поля «вихідне» немає взагалі, є лише
   відправник. Саме на такій розмова й ставала вся ліворуч. */
const MSGS = [
  { id:'m1', createdAt:'2026-09-15T11:50:00Z', text:'Доброго дня, цікавлять футболки',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m2', createdAt:'2026-09-15T11:52:00Z', text:'Який одяг потрібен?)',
    user:{ name:'Катерина Шевчук' } },
  { id:'m3', createdAt:'2026-09-15T15:18:00Z', text:'Футболки',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m4', createdAt:'2026-09-15T15:24:00Z', text:'Яка кількість має бути?',
    user:{ name:'Катерина Шевчук' } },
  { id:'m5', createdAt:'2026-09-15T15:30:00Z', text:'Від 20 шт',
    client:{ clientName:'Anastasia Dera', userName:'asia_dera' } },
  { id:'m6', createdAt:'2026-09-15T15:35:00Z', text:'Дякую за інформацію, передаю на розрахунок',
    user:{ name:'Олег Марченко' } },
  /* Пряма ознака від Sitniks, і вона суперечить підпису: у записі стоїть сам
     клієнт, але сказано «вхідне = ні». Слову маємо вірити більше. */
  { id:'m7', createdAt:'2026-09-15T15:40:00Z', text:'Надсилаю пропозицію',
    isIncoming:false, client:{ clientName:'Anastasia Dera' } },
  /* Лист на кілька абзаців із посиланням усередині. Саме такий і виходив
     кашею: адресу ми виймали, а разом із нею збивали всі переноси. */
  { id:'m8', createdAt:'2026-09-15T15:45:00Z',
    text:'Вітаю! Підготувала пропозицію за вашим запитом.\n' +
         'Тут є візуалізації з вашим брендингом.\n\n' +
         'Переглянути пропозицію →\nhttps://loomiq.net/offer.html?o=wk4wuvidrxnc\n\n' +
         'Якщо виникнуть питання — відповім)',
    user:{ name:'Катерина Шевчук' } }
];

let sent = [];
const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if(u.pathname.indexOf('/crm/') === 0){
    const json = (code, b) => { res.writeHead(code, { 'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(b)); };
    if(req.method === 'OPTIONS'){ res.writeHead(204, {
      'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS' }); return res.end(); }
    if(/\/messages$/.test(u.pathname)){
      if(req.method === 'POST'){
        let body = ''; req.on('data', c => body += c);
        await new Promise(r => req.on('end', r));
        try{ sent.push(JSON.parse(body).text); }catch(e){}
        return json(200, { ok:true });
      }
      return json(200, MSGS);
    }
    if(/\/chats\/[0-9a-f]{8,}$/i.test(u.pathname))
      return json(200, { id:CHAT_ID, client:{ clientName:'Anastasia Dera', userName:'asia_dera' } });
    return json(200, []);
  }
  const f = path.join(ROOT, decodeURIComponent(u.pathname).replace(/^\/+/, ''));
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

const ORDER = {
  id:'1', orderId:'1001001', type:'client', name:'Anastasia Dera', instagram:'asia_dera',
  ig:'asia_dera', phone:'+380670001001', status:'kp', site:'main', payments:[],
  crmChatId:CHAT_ID, crmChatName:'Anastasia Dera',
  createdAt:new Date().toISOString(), hist:[], totalPrice:12000,
  items:[{ kind:'main', name:'Футболка', color:'чорна', garmentId:'tshirt',
           qty:20, unitPrice:600, price:12000 }]
};
const CONTENT = { team: [], bgApi: { sitniksUrl: HOST + '/crm' } };

let fbstub = fs.readFileSync(path.join(ROOT, 'tests/fbstub.js'), 'utf8');
fbstub = fbstub.replace('window.firebase={',
  'window.__ORDERS=' + JSON.stringify([ORDER]) + ';\n' +
  '  window.__CONTENT=' + JSON.stringify(CONTENT) + ';\n  window.firebase={');
fbstub = fbstub.replace(
  'Col.prototype.doc=function(){ return new Doc(); };',
  'Col.prototype.doc=function(id){ var d=new Doc(); d.__id=id; d.__col=this.__n; return d; };');
fbstub = fbstub.replace(
  'Doc.prototype.onSnapshot=function(cb){ try{ cb(new Snap(\'x\', null)); }catch(e){} return function(){}; };',
  'Doc.prototype.onSnapshot=function(cb){ var d=null;\n' +
  "    if(this.__col==='loomiq' && this.__id==='photos') d=window.__CONTENT;\n" +
  "    try{ cb(new Snap(this.__id||'x', d)); }catch(e){ console.error(e); } return function(){}; };");
fbstub = fbstub.replace(
  'var fs=function(){ return { collection:function(){ return new Col(); },',
  'function SeedCol(src){ this.__src=src; }\n' +
  '  SeedCol.prototype=Object.create(Col.prototype);\n' +
  '  SeedCol.prototype.onSnapshot=function(cb){ try{\n' +
  '    var L=this.__src(); cb({ docs:L.map(function(o){ return new Snap(o.id,o); }),\n' +
  '      forEach:function(f){ L.forEach(function(o){ f(new Snap(o.id,o)); }); },\n' +
  '      empty:!L.length }); }catch(e){ console.error(e); } return function(){}; };\n' +
  '  var fs=function(){ return { collection:function(n){\n' +
  "      if(n==='kanbanOrders') return new SeedCol(function(){ return window.__ORDERS; });\n" +
  '      var c=new Col(); c.__n=n; return c; },');

const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport:{ width:1400, height:1000 } });
p.on('pageerror', e => errs.push(e.message.slice(0, 180)));
p.on('dialog', d => d.accept('ok'));
await p.route('**://**', r => {
  const u = r.request().url();
  if(/gstatic\.com\/firebasejs/.test(u)) return r.fulfill({ contentType:'application/javascript', body:fbstub });
  if(u.startsWith(HOST)) return r.continue();
  return r.abort();
});
await p.goto(HOST + '/loomiqadmin.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(5500);
await p.evaluate(async () => { await openOrderDrawer(orders[0]); chatOpen(orders[0], 'crm'); });
await p.waitForTimeout(2200);

const feed = () => p.evaluate(() => [...document.querySelectorAll('.cw-feed .od-crm-msg')].map(el => ({
  txt: ((el.querySelector('.od-crm-txt') || {}).textContent || '').trim(),
  lines: ((el.querySelector('.od-crm-txt') || {}).textContent || '').split('\n').length,
  gap: /\n\s*\n/.test(((el.querySelector('.od-crm-txt') || {}).textContent || '')),
  mine: el.classList.contains('mine'),
  at: ((el.querySelector('.od-crm-at') || {}).textContent || '').trim()
})));

console.log('═══ БОКИ РОЗМОВИ ═══');
const rows = await feed();
rows.forEach(r => console.log('   ' + (r.mine ? '→ ' : '← ') + r.txt.slice(0, 44) +
                              (r.at ? '   [' + r.at + ']' : '')));
const side = t => (rows.find(r => r.txt.indexOf(t) === 0) || {}).mine;
ok(rows.length === MSGS.length,
  'усі повідомлення на місці',
  'повідомлень не стільки: ' + rows.length + ' із ' + MSGS.length);
ok(side('Доброго дня') === false && side('Футболки') === false && side('Від 20') === false,
  'клієнт ліворуч',
  'клієнтські повідомлення опинились праворуч');
ok(side('Який одяг') === true && side('Яка кількість') === true && side('Дякую за інформацію') === true,
  'менеджер праворуч — навіть коли поля «вихідне» у відповіді немає зовсім',
  'наші повідомлення лишились ліворуч, як і були');
ok(side('Надсилаю пропозицію') === true,
  'прямій ознаці від Sitniks віримо навіть проти підпису в записі',
  'пряму ознаку «вхідне = ні» проігноровано');

console.log('');
console.log('═══ ХТО САМЕ ПИСАВ ═══');
const by = t => (rows.find(r => r.txt.indexOf(t) === 0) || {}).at || '';
console.log('  «Який одяг…» → ' + by('Який одяг'));
console.log('  «Дякую…»     → ' + by('Дякую за інформацію'));
ok(/Катерина/.test(by('Який одяг')) && /Олег/.test(by('Дякую за інформацію')),
  'під нашими повідомленнями видно, хто саме з менеджерів писав',
  'підпису менеджера немає: «' + by('Який одяг') + '» / «' + by('Дякую за інформацію') + '»');
ok(!/Anastasia|Dera/.test(rows.map(r => r.at).join(' ')),
  'імʼям клієнта наші повідомлення не підписуються',
  'клієнт став підписом нашого повідомлення');
ok(!/Катерина|Олег/.test(by('Футболки') + by('Від 20')),
  'під клієнтськими підпису немає — там і так видно, хто пише',
  'клієнтське повідомлення підписане менеджером');

console.log('');
console.log('═══ АБЗАЦИ ЛИШАЮТЬСЯ АБЗАЦАМИ ═══');
/* Лист клієнту пишеться абзацами. Ми виймали з нього адресу — і разом із нею
   збивали всі переноси в один пробіл: на екрані лишалась суцільна каша. */
const long = rows.find(r => r.txt.indexOf('Вітаю!') === 0);
console.log('  рядків: ' + (long || {}).lines + ' · порожній рядок між абзацами: ' +
            ((long || {}).gap ? 'є' : 'немає'));
ok(long && long.lines >= 4,
  'переноси рядків лишились на місці',
  'повідомлення злиплось в один рядок — та сама каша');
ok(long && long.gap,
  'порожній рядок між абзацами теж лишився',
  'абзаци злиплись в суцільний текст');
ok(long && long.txt.indexOf('http') < 0,
  'саму адресу з тексту, як і раніше, виймаємо — вона йде окремою кнопкою',
  'адреса лишилась у тексті простирадлом');
const pre = await p.evaluate(() => {
  const el = document.querySelector('.cw-feed .od-crm-txt');
  return el ? getComputedStyle(el).whiteSpace : '';
});
ok(/pre-wrap/.test(pre),
  'і браузер їх показує, а не згортає',
  'переноси є в тексті, але на екрані не видно: ' + pre);

console.log('');
console.log('═══ ENTER — НОВИЙ РЯДОК, НЕ НАДСИЛАННЯ ═══');
/* Доти Enter надсилав, і лист вилітав недописаним після першого ж рядка.
   Про Shift+Enter ніхто не здогадувався. Недописаний лист клієнту не
   відкликати, тож випадкове надсилання тут дорожче за звичку. */
sent = [];
await p.click('.cw-inp');
await p.keyboard.type('Перший рядок');
await p.keyboard.press('Enter');
await p.keyboard.type('Другий рядок');
await p.waitForTimeout(400);
const typed = await p.evaluate(() => (document.querySelector('.cw-inp') || {}).value || '');
console.log('  у полі: ' + JSON.stringify(typed) + ' · надіслано: ' + sent.length);
ok(typed.indexOf('\n') > 0,
  'Enter робить новий рядок — лист на кілька абзаців нарешті можна набрати',
  'Enter не переносить рядок: ' + JSON.stringify(typed));
ok(!sent.length,
  'і нічого не надсилає — недописане не вилітає клієнту',
  'Enter усе одно надіслав: ' + JSON.stringify(sent));
await p.keyboard.press('Control+Enter');
await p.waitForTimeout(800);
console.log('  після Ctrl+Enter надіслано: ' + JSON.stringify(sent));
ok(sent.length === 1 && /Перший рядок\nДругий рядок/.test(sent[0]),
  'Ctrl+Enter надсилає, і обидва рядки доходять цілими',
  'Ctrl+Enter не надіслав або зіпсував текст: ' + JSON.stringify(sent));
const tip = await p.evaluate(() =>
  ((document.querySelector('.cw-tip') || {}).textContent || '').trim());
ok(/Enter/.test(tip) && /надіслати/i.test(tip),
  'правило написане під полем — здогадуватись не треба: «' + tip + '»',
  'підказки під полем немає');

console.log('');
console.log('═══ СВОЄ НАДІСЛАНЕ — ОДРАЗУ ПРАВОРУЧ І ПІДПИСАНЕ ═══');
/* Перечитування з сервера тут лише заважає: воно поверне стрічку без нашого
   свіжого рядка, а перевіряємо ми саме те, що показується ДО відповіді.
   Тому глушимо і сам опит, і відкладені його виклики. */
await p.evaluate(() => {
  crmStopPoll();
  window.crmPollOnce = async () => {};
  const i = document.querySelector('.cw-inp');
  i.value = ''; i.dispatchEvent(new Event('input', { bubbles:true }));
});
await p.click('.cw-inp');
await p.keyboard.type('Порахували, надсилаю');
await p.evaluate(async () => {
  document.querySelector('[data-cw-go]').click();
  await new Promise(r => setTimeout(r, 500));
});
const after = await feed();
const own = after.find(r => r.txt.indexOf('Порахували') === 0);
console.log('  ' + JSON.stringify(own));
ok(own && own.mine,
  'щойно надіслане стоїть праворуч, не чекаючи відповіді Sitniks',
  'власне повідомлення пішло ліворуч: ' + JSON.stringify(own));
ok(own && own.at && own.at.length > 1,
  'і підписане тим, хто його надіслав',
  'власне повідомлення без підпису');

console.log('');
console.log('═══ ВЛАСНЕ НАДІСЛАНЕ ЛИШАЄТЬСЯ НАШИМ І ПОТІМ ═══');
/* Повідомлення, надіслані через API з Loomiq, Sitniks повертає БЕЗ
   відправника — зовні вони нічим не відрізняються від клієнтських. Доти
   такий лист ставав ліворуч, щойно стрічку перечитували з сервера. */
const back = await p.evaluate(async () => {
  const o = orders[0];
  const saved = JSON.parse(JSON.stringify(o.crmOut || []));
  /* Те саме, що прислав би Sitniks: наш текст і жодного відправника. */
  const list = crmNormMsgs([{ id:'x1', createdAt:'2026-09-15T16:00:00Z',
    text:'Порахували, надсилаю' }], o);
  const one = list[0] || {};
  return { kept: saved.length, mine: !!one.mine, by: one.by || '' };
});
console.log('  памʼять: ' + back.kept + ' · бік: ' + (back.mine ? 'наше' : 'клієнтське') +
            ' · підпис: «' + back.by + '»');
ok(back.kept > 0,
  'картка памʼятає, що ми це писали — памʼять переживе перезавантаження',
  'памʼять про власне надіслане ніде не зберігається');
ok(back.mine,
  'перечитане з сервера власне повідомлення лишилось праворуч',
  'своє ж повідомлення повернулось із сервера ліворуч — та сама помилка');
ok(back.by && back.by.length > 0,
  'і підписане тим, хто його надсилав',
  'підпис загубився після перечитування');

console.log('');
console.log('═══ СИРА ВІДПОВІДЬ — ЛИШЕ ДЛЯ НАЛАШТУВАННЯ ═══');
const raw = await p.evaluate(async () => {
  const b = document.querySelector('[data-cw-raw]');
  if(!b) return { none:true };
  b.click();
  await new Promise(r => setTimeout(r, 400));
  const el = document.querySelector('.cw-raw');
  return { txt: el ? el.textContent.slice(0, 400) : '' };
});
if(raw.none){ console.log('  кнопки немає'); bad++; }
else ok(/clientName|userName|isIncoming/.test(raw.txt),
  'видно справжню відповідь Sitniks — саме з неї й дізнаються назви полів',
  'відповідь Sitniks не показується');
/* Менеджеру ця кнопка нічого не дає — і бачити її він не повинен. */
const hidden = await p.evaluate(async () => {
  window.canSetup = () => false;
  renderChatWin();
  await new Promise(r => setTimeout(r, 300));
  return !document.querySelector('[data-cw-raw]');
});
ok(hidden, 'менеджеру службової кнопки не видно',
   'службова кнопка показується всім');

console.log('');
ok(!errs.length, 'сторінка без помилок', 'помилки: ' + errs.join(' | '));
console.log(bad ? 'розходжень: ' + bad
                : 'розмова читається: свої праворуч, клієнт ліворуч, автор підписаний');
await browser.close();
srv.close();
process.exit(bad ? 1 : 0);
