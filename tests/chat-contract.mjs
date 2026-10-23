/* ДОГОВІР ДІАЛОГУ (23.10). Андрій: «діалог — в окрему зону, щоб ми його
   взагалі ніяк не чіпали наступними правками… розділити системи на блоки».

   loomiq-chat.js — окремий блок. Усе, що він бере з адмінки, і все, що
   адмінка бере з нього, — тут, явним переліком. Нове імʼя в будь-якому
   напрямку = нова залежність; тест падає, доки її не впишуть сюди свідомо
   (і не скажуть Андрію). Переліки лише звужуються.

   Запуск:  node tests/chat-contract.mjs      (з кореня репозиторію)  */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adm = fs.readFileSync(path.join(ROOT, 'loomiqadmin.html'), 'utf8');
const chat = fs.readFileSync(path.join(ROOT, 'loomiq-chat.js'), 'utf8');

/* Що діалог має право брати з адмінки (23.10 — стан на момент договору). */
const CHAT_MAY_USE = new Set(`PHOTOS_DOC avatarHtml brandSnap canBindChat canQuick canSendFiles canSetup canWrite
  cardModelsMap cardsWroteNow chanFill chanSet chatReplied closeOrderDrawer contentData contentLoaded crmCanUnlink
  crmForget crmWhoHtml crmWhoLabel designHostInit designJobs designOrders docDownload drawerOrderId dueSum escapeHtml
  fbAuth fbDb fmt myEmail myName offerBuild offerClean offerUrl openOrderDrawer orderActivityAt orderDir orderName
  orderUnread orderWaiting orders ordersHeld qrDraft renderBoard renderOrderDrawer saveOrderMeta saveOrders showNo
  shrinkImage statusFlow tgUnread tgUnreadCount toast touchOrder uploadCloudinary waitingMin zipBlob`.split(/\s+/).filter(Boolean));
/* Що адмінка має право брати з діалогу. */
const ADMIN_MAY_USE = new Set(`OFFER_MSG_DEFAULT QR_DEFAULT QR_GROUPS cardsDownload chatClose chatOpen chatOutbox chatWin
  crmAnswered crmBindUrl crmBlockHtml crmChat crmChatIdFromUrl crmChatIdOf crmFetch crmHeldIds crmLoadChat crmNick
  crmNormFound crmOutNote crmPicTimed crmPicsAdd crmPicsDrop crmPicsShow crmSeekBtnHtml crmSeekHtml crmSend crmSent crmShow
  crmStopPoll crmSweepStart igLinkHtml igLinkMode qrDirOf qrFill qrPack qrSeedOnce quickReplies renderChatWin renderChats
  scriptCard scriptFor scriptSave tgChatOf tgSend tgUnwatch tgWatch wireCrmBlock wireTgBlock`.split(/\s+/).filter(Boolean));

const defs = s => { const m = new Set();
  for(const r of s.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) m.add(r[1] || r[2]);
  return m; };
const A = defs(adm), C = defs(chat);
const idents = s => { const u = new Set(); for(const r of s.matchAll(/\b([A-Za-z_$][\w$]{1,})\b/g)) u.add(r[1]); return u; };
const chatUses = [...idents(chat)].filter(n => A.has(n) && !C.has(n)).sort();
const admUses = [...idents(adm)].filter(n => C.has(n) && !A.has(n)).sort();

let bad = 0;
const ok = (c, good, wrong) => { console.log('  ' + (c ? good + ' ✓' : wrong + ' ✗')); if(!c) bad++; };
console.log('═══ ДІАЛОГ БЕРЕ З АДМІНКИ ═══');
const нове1 = chatUses.filter(n => !CHAT_MAY_USE.has(n));
ok(!нове1.length, 'лише те, що в договорі (' + chatUses.length + ')', 'нова залежність діалогу від адмінки: ' + нове1.join(', ') + ' — впишіть у договір свідомо');
const зайве1 = [...CHAT_MAY_USE].filter(n => chatUses.indexOf(n) < 0);
if(зайве1.length) console.log('  (у договорі вже не потрібні — можна прибрати: ' + зайве1.join(', ') + ')');
console.log('═══ АДМІНКА БЕРЕ З ДІАЛОГУ ═══');
const нове2 = admUses.filter(n => !ADMIN_MAY_USE.has(n));
ok(!нове2.length, 'лише те, що в договорі (' + admUses.length + ')', 'нова залежність адмінки від діалогу: ' + нове2.join(', ') + ' — впишіть у договір свідомо');
const зайве2 = [...ADMIN_MAY_USE].filter(n => admUses.indexOf(n) < 0);
if(зайве2.length) console.log('  (у договорі вже не потрібні — можна прибрати: ' + зайве2.join(', ') + ')');
/* Стан діалогу належить діалогу: адмінка його не переозначує. */
const переозначено = ['crmChat', 'chatWin', 'chatOutbox', 'crmSent'].filter(n => new RegExp('^(?:const|let|var)\\s+' + n + '\\b', 'm').test(adm));
ok(!переозначено.length, 'стан діалогу (crmChat, chatWin, chatOutbox, crmSent) оголошений лише в діалозі', 'адмінка переозначує: ' + переозначено.join(', '));
console.log(bad ? 'розходжень: ' + bad : 'договір діалогу дотримано');
process.exit(bad ? 1 : 0);
