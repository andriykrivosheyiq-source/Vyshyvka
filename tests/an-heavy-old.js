/* ЕТАЛОН для tests/an-heavy.mjs: anDayOf, anInOf і renderAnAll такими, як
   вони були до прискорення 04.11 (коміт 9d6a236), під іменами *_old.
   Не правити: тест рівняє з ними нову Аналітику цифра в цифру. */
function anDayOf_old(t){
  if(!t) return '';
  const d = new Date(t);
  if(isNaN(d)) return '';
  try{ return d.toLocaleDateString('sv-SE', { timeZone:'Europe/Kyiv' }); }
  catch(e){ return d.toISOString().slice(0, 10); }
}
function anInOf_old(o, set){
  return paidRows(o).reduce((a, x) => a + ((x.counted && set[anDayOf_old(x.at)]) ? x.sum : 0), 0);
}
function renderAnAll_old(days, month, spend){
  const box = document.getElementById('an-all');
  if(!box) return;
  try{ watchPayments(); }catch(e){}
  days = days || [];
  const set = {};
  days.forEach(d => { set[d] = 1; });
  const гр = n => fmt(Math.round(n || 0)) + ' ₴';
  const E = escapeHtml;
  const живі = (orders || []).filter(o => o && o.orderId && o.status !== 'cancel');
  /* Гроші зараз. */
  const наРахунках = finAccounts().reduce((a, x) => a + (finIsPass(x.id) ? 0 : finBalance(x.id)), 0);
  const винні = { b2b: 0, b2c: 0 };
  живі.forEach(o => {
    if(typeof orderMade === 'function' && !orderMade(o)) return;
    const t = Math.round(+o.totalPrice || 0);
    if(t > 0) винні[orderDir(o)] += Math.max(0, t - anPaidOf(o));
  });
  /* Гроші за період — по джерелах і напрямах. */
  const рядки = {};
  AN_SRC.forEach(x => { рядки[x[0]] = { n: 0, сума: 0, b2b: 0, b2c: 0 }; });
  живі.forEach(o => {
    const r = рядки[orderSrc(o)];
    const dir = orderDir(o);
    if(set[anDayOf_old(o.createdAt || ((o.hist || [])[0] || {}).at)] && (typeof orderMade !== 'function' || orderMade(o))){
      r.n++; r.сума += Math.round(+o.totalPrice || 0);
    }
    r[dir] += anInOf_old(o, set);
  });
  const ids = {};
  (orders || []).forEach(o => { if(o && o.orderId) ids[String(o.orderId)] = 1; });
  let безПривʼязки = 0, витрачено = 0, зарплати = 0, міжСвоїми = 0;
  const поДнях = {};
  const день = d => (поДнях[d] = поДнях[d] || { in: 0, out: 0 });
  const свої = finOwnSet();
  (payments || []).forEach(p => {
    const d = anDayOf_old(p.at);
    if(!set[d]) return;
    const n = Math.round(+p.amount || 0);
    /* Переказ між своїми рахунками — гроші просто переїхали. */
    if(свої[p.id]){ if(n > 0) міжСвоїми += n; return; }
    if(n > 0 && !ids[String(p.orderId || '')]){ безПривʼязки += n; день(d).in += n; }
    if(n < 0){ витрачено += -n; день(d).out += -n; if(p.src === 'salary') зарплати += -n; }
  });
  /* Надходження по замовленнях — у рух по днях теж. */
  живі.forEach(o => {
    if(orderDir(o) === 'b2b' && payList(o).length){
      payList(o).forEach(p => { const d = anDayOf_old(p.at); if(set[d]) день(d).in += Math.round(+p.sum || 0); });
    } else {
      const id = String(o.orderId || '');
      (payments || []).forEach(p => {
        const d = anDayOf_old(p.at);
        if(set[d] && String(p.orderId || '') === id && (+p.amount || 0) > 0) день(d).in += Math.round(+p.amount);
      });
    }
  });
  const поЗамовл = AN_SRC.reduce((a, x) => a + рядки[x[0]].b2b + рядки[x[0]].b2c, 0);
  const надійшло = поЗамовл + безПривʼязки;
  const підпис = month ? finMonthLabel(month) : (days.length ? days[0] + ' — ' + days[days.length - 1] : '');
  const частка = v => надійшло ? ' <i>' + Math.round(v / надійшло * 100) + '%</i>' : '';
  box.innerHTML =
    '<div class="an-h">Гроші зараз</div>' +
    '<div class="an-row">' +
      '<div class="an-c"><span>На рахунках</span><b>' + гр(наРахунках) + '</b></div>' +
      '<div class="an-c"><span>Клієнти винні · B2B</span><b>' + гр(винні.b2b) + '</b></div>' +
      '<div class="an-c"><span>Клієнти винні · B2C</span><b>' + гр(винні.b2c) + '</b></div>' +
      '<div class="an-c"><span>Разом очікуємо</span><b>' + гр(винні.b2b + винні.b2c) + '</b></div>' +
    '</div>' +
    '<div class="an-h">За період · ' + E(підпис) + '</div>' +
    '<div class="an-row">' +
      '<div class="an-c"><span>Надійшло</span><b>' + гр(надійшло) + '</b></div>' +
      '<div class="an-c"><span>Витрачено' + (зарплати ? ' (з них зарплати ' + гр(зарплати) + ')' : '') + '</span><b>' + гр(витрачено) + '</b></div>' +
      '<div class="an-c is-net"><span>Кешфлоу</span><b>' + гр(надійшло - витрачено) + '</b></div>' +
      '<div class="an-c"><span>Реклама (внесена в аналітиці)</span><b>' + (spend ? гр(spend) : '—') + '</b></div>' +
    '</div>' +
    '<div class="an-h">Звідки прийшли замовлення й гроші</div>' +
    '<table class="an-t an-src-t"><thead><tr><th>Джерело</th><th>Нових замовлень</th><th>Сума замовлень</th>' +
      '<th>Надійшло B2B</th><th>Надійшло B2C</th><th>Разом надійшло</th></tr></thead><tbody>' +
    AN_SRC.map(x => { const r = рядки[x[0]];
      return '<tr><td>' + E(x[1]) + '</td><td>' + r.n + '</td><td>' + гр(r.сума) + '</td><td>' + гр(r.b2b) + '</td><td>' +
        гр(r.b2c) + '</td><td><b>' + гр(r.b2b + r.b2c) + '</b>' + частка(r.b2b + r.b2c) + '</td></tr>'; }).join('') +
    '<tr><td>Не привʼязано до замовлення</td><td>—</td><td>—</td><td>—</td><td>—</td><td><b>' + гр(безПривʼязки) + '</b>' + частка(безПривʼязки) + '</td></tr>' +
    '<tr class="on"><td>Разом</td><td>' + AN_SRC.reduce((a, x) => a + рядки[x[0]].n, 0) + '</td><td>' +
      гр(AN_SRC.reduce((a, x) => a + рядки[x[0]].сума, 0)) + '</td><td>' + гр(AN_SRC.reduce((a, x) => a + рядки[x[0]].b2b, 0)) +
      '</td><td>' + гр(AN_SRC.reduce((a, x) => a + рядки[x[0]].b2c, 0)) + '</td><td>' + гр(надійшло) + '</td></tr>' +
    '</tbody></table>' +
    '<div class="an-h">Рух грошей по днях</div>' +
    '<table class="an-t"><thead><tr><th>День</th><th>Надійшло</th><th>Витрачено</th><th>Різниця</th></tr></thead><tbody>' +
    (days.filter(d => поДнях[d]).reverse().map(d => { const r = поДнях[d];
      return '<tr><td>' + E(d) + '</td><td>' + гр(r.in) + '</td><td>' + (r.out ? гр(r.out) : '—') + '</td><td>' + гр(r.in - r.out) + '</td></tr>'; })
      .join('') || '<tr><td colspan="4" class="an-empty">За цей період руху грошей не записано</td></tr>') +
    '</tbody></table>' +
    (міжСвоїми ? '<div class="tm-hint">Перекази між своїми рахунками за період: ' + гр(міжСвоїми) +
      ' — не враховані ні в надходженнях, ні у витратах.</div>' : '') +
    '<div class="tm-hint">Нові замовлення — створені за період (у B2B — від «Чекаємо оплату» й далі). Надійшло — оплати за період; ' +
      'у B2B беремо оплати з картки, якщо вони є, інакше привʼязані платежі з рахунків. Джерело — позначка в картці, а якщо її немає, ' +
      'канал розмови з клієнтом.</div>';
}
