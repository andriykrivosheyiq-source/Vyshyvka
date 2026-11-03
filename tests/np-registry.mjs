/* tests/np-registry.mjs — РЕЄСТР НОВОЇ ПОШТИ: ПРИЧИНА ВІДМОВИ ЗАВЖДИ СЛОВАМИ (03.11.2026).

   Цех, 03.11: перестворили кожну ТТН, натиснули «Створити реєстр» — на
   кожній плитці «НП не взяла в реєстр: Нова пошта не створила реєстр», без
   причини. Воркер шукав причини лише в рядку реєстру (data[0].Errors /
   Data.Errors), а загальні warnings / errors відповіді при success:true і
   попередження (Warnings) відкидав; помилки обʼєктом-мапою
   {"<Ref>": "текст"} читав як порожні. Тепер (worker/novaposhta-proxy.js →
   npFull, npReasons) причина береться звідусіль, а як НП не сказала нічого —
   у картку йде шматок її відповіді, не «не створила».
   Запуск: node tests/np-registry.mjs (у pre-commit на зміну воркера). */
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };

let SCAN = null;          // що відповість ScanSheet.insertDocuments у цьому кроці
globalThis.fetch = async (url, opt) => {
  url = String(url); opt = opt || {};
  const res = (body, status) => new Response(JSON.stringify(body), { status: status || 200 });
  if(url.includes('identitytoolkit.googleapis.com')) return res({ users: [{ localId: 'u1', email: 'test@loomiq' }] });
  if(url.startsWith('https://api.novaposhta.ua')){
    const b = JSON.parse(opt.body);
    if(b.modelName === 'ScanSheet' && b.calledMethod === 'insertDocuments') return res(SCAN);
    return res({ success: true, data: [] });
  }
  throw new Error('неочікуваний запит ' + url);
};
const worker = (await import(path.join(ROOT, 'worker/novaposhta-proxy.js'))).default;
const env = { NP_KEY_yukalchuk: 'KEY-Y', ALLOWED_ORIGINS: 'https://loomiq.net' };
const reg = () => worker.fetch(new Request('https://np.test/', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://loomiq.net' },
  body: JSON.stringify({ op: 'registry', sender: 'yukalchuk', idToken: 'good',
    docs: [{ ttn: '20451300000001', ref: 'DOC1' }, { ttn: '20451300000002', ref: 'DOC2' }] }) }), env).then(r => r.json());

console.log('═══ 1. ПРИЧИНА В ЗАГАЛЬНИХ WARNINGS (success:true, data порожня) ═══');
SCAN = { success: true, data: [], errors: [], warnings: ['Documents DOC1, DOC2 are already in scan sheet 105-00123'] };
let r = await reg();
ok(!r.ok && /already in scan sheet/.test(r.error) && !/не сказала чому/.test(r.error), 'причина з warnings відповіді — у тексті відмови', JSON.stringify(r));

console.log('═══ 2. ПОМИЛКИ ОБʼЄКТОМ-МАПОЮ {Ref: текст} ═══');
SCAN = { success: true, data: [{ Ref: '', Errors: { DOC1: 'Document is printed more than 3 days ago', DOC2: 'Document is printed more than 3 days ago' } }] };
r = await reg();
ok(!r.ok && (r.errors || []).some(e => e.Ref === 'DOC1' && /more than 3 days/.test(e.Error)) && /more than 3 days/.test(r.error),
  'причина по кожній накладній (Ref → текст), адмінка покладе її в картку', JSON.stringify(r));

console.log('═══ 3. ПОПЕРЕДЖЕННЯ В DATA.WARNINGS ═══');
SCAN = { success: true, data: [{ Ref: '', Data: { Errors: [], Warnings: [{ Number: '20451300000001', Warning: 'Document deleted' }], Success: [] } }] };
r = await reg();
ok(!r.ok && /Document deleted/.test(r.error) && (r.errors || []).some(e => e.Number === '20451300000001'), 'попередження по накладній — причиною', JSON.stringify(r));

console.log('═══ 4. НП НЕ СКАЗАЛА НІЧОГО — ПОКАЗУЄМО ВІДПОВІДЬ ═══');
SCAN = { success: true, data: [{ Ref: '' }], info: { totalCount: 0 } };
r = await reg();
ok(!r.ok && /не сказала чому · відповідь НП: \{/.test(r.error) && /totalCount/.test(r.error), 'замість «не створила реєстр» — що саме відповіла НП', JSON.stringify(r));

console.log('═══ 5. РЕЄСТР СТВОРЕНО — ЯК ДОТИ ═══');
SCAN = { success: true, data: [{ Ref: 'SS1', Number: '105-00200', Date: '03.11.2026', Data: { Errors: [], Warnings: [], Success: [{ Ref: 'DOC1', Number: '20451300000001' }, { Ref: 'DOC2', Number: '20451300000002' }] } }] };
r = await reg();
ok(r.ok && r.ref === 'SS1' && r.number === '105-00200' && r.success.length === 2 && !r.error, 'реєстр 105-00200, обидві накладні прийнято', JSON.stringify(r));

console.log('═══ 6. ВІДМОВА success:false — ТЕКСТ ПОМИЛКИ, ЯК ДОТИ ═══');
SCAN = { success: false, errors: ['API key expired'], warnings: [] };
r = await reg();
ok(!r.ok && /API key expired/.test(r.error || ''), 'success:false — текст НП', JSON.stringify(r));

console.log(bad ? '\n✗ ' + bad + ' перевірок не пройшло' : '\n✓ np-registry: причина відмови реєстру — завжди словами');
process.exit(bad ? 1 : 0);
