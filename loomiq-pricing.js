/* ══════════════════════════════════════════════════════════════════════
   РУШІЙ ЦІН — один на весь Loomiq

   Ціна позиції залежить не лише від неї самої, а від усього замовлення:
   знижка за тираж рахується від сумарної кількості в межах способу
   нанесення, а підготовка макета ділиться на всі вироби цього способу.
   Саме тому рахувати позицію окремо не можна — і саме тому рушій має бути
   один. Він жив у двох копіях (конструктор і адмінка), а сторінці клієнта
   не діставався зовсім: додаючи рекомендований товар, вона не вміла
   перерахувати решту складу, хоч тираж від цього зростав.

   Тепер це один файл. Три сторінки підключають його й дістають ті самі
   числа — розійтись їм нема як.

   Дані про ціни беруться з window.SITE_CONTENT.pricing — того самого
   документа, який менеджер редагує в розділі «Формування цін».
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  function sitePricing(){
    var p = window.SITE_CONTENT && window.SITE_CONTENT.pricing;
    // Модель тепер завжди одна (перемикача «увімкнути» більше немає).
    return (p && p.methods) ? p : null;
  }

  /* Шкала знижки на САМ ВИРІБ. У кожного товару може бути своя: футболка й
     худі куплені за різні гроші й з різною маржею, і однакова знижка на них
     означає, що на одному ми заробляємо, а на другому дотуємо.

     Не задали свою — працює загальна. Немає й загальної — лишається старий
     запасний шлях: загальна шкала сайту (`tiers`), як було завжди. */
  function garmentTiersList(gid){
    var p = sitePricing();
    if(!p) return null;
    var own = gid && (p.garmentTiersBy || {})[gid];
    var l = (Array.isArray(own) && own.length) ? own : p.garmentTiers;
    if(!Array.isArray(l) || !l.length) return null;
    return l.map(function(t){ return { from: +t.from || 1, coef: +t.coef || 1 }; })
            .sort(function(a, b){ return a.from - b.from; });
  }

  function garmentCoefFor(qty, gid){
    var l = garmentTiersList(gid);
    if(!l) return null;
    var c = 1;
    for(var i = l.length - 1; i >= 0; i--){ if(qty >= l[i].from){ c = l[i].coef; break; } }
    return c;
  }

  function tierCoefFor(methodKey, qty){
    var p = sitePricing(); if(!p) return 1;
    var m = (p.methods || {})[methodKey] || {};
    var list = (m.tiers && m.tiers.length) ? m.tiers : p.tiers;
    if(!list || !list.length) return 1;
    var c = 1;
    var rows = list.map(function(t){ return { from:+t.from || 1, coef:+t.coef || 1 }; })
                   .sort(function(a,b){ return a.from - b.from; });
    for(var i = rows.length - 1; i >= 0; i--){ if(qty >= rows[i].from){ c = rows[i].coef; break; } }
    return c;
  }

  function priceOrder(list, opts){
    opts = opts || {};
    var p = sitePricing();
    if(!p) return list.map(function(){ return { unit:0, sum:0, feeShare:0 }; });

    /* ── Дві полички: погоджене й допродаж ────────────────────────────────
       Позиція з ознакою upsell — це те, що клієнт бере ЗВЕРХУ вже
       погодженого складу: рекомендований товар, друга партія.

       Коли перерахувати все разом, дешевшає й те, на що клієнт уже
       погодився. Виглядає це так, ніби перша ціна була завищена, і кожне
       «додайте ще» перетворюється на нову розмову про всі попередні
       позиції.

       Тож погоджене рахується між собою й не рухається, а весь виграш від
       зрослого тиражу дістається новому товару: він іде за порогом УСЬОГО
       складу й не платить удруге за макет, який уже підготували під
       погоджені позиції. Клієнт бачить не «ціни змінились», а «кепки
       виходять помітно дешевші, бо тираж уже набраний».

       Без жодної позначки upsell поличка одна, і все рахується як раніше —
       саме тому старі виклики нічого не помічають. */
    var U = { dtf:0, embro:0, bare:0 };          // весь склад
    var B = { dtf:0, embro:0, bare:0 };          // тільки погоджене
    var anyUp = false;
    list.forEach(function(it){
      var u = Math.max(0, +it.units || 0);
      var k = it.bare ? 'bare' : (it.method === 'embro' ? 'embro' : 'dtf');
      U[k] += u;
      if(it.upsell) anyUp = true; else B[k] += u;
    });
    if(!anyUp) B = U;
    function coefSet(V){
      return { dtf: tierCoefFor('dtf', opts.noVolume ? 1 : (V.dtf || 1)),
               embro: tierCoefFor('embro', opts.noVolume ? 1 : (V.embro || 1)) };
    }
    var coefAll = coefSet(U), coefBase = coefSet(B);
    // Тираж, від якого рахується ця позиція: погоджене — від погодженого,
    // допродаж — від усього складу разом
    function volFor(it, k){ return (it.upsell ? U : B)[k] || 0; }
    function coefFor(it, mk){ return (it.upsell ? coefAll : coefBase)[mk]; }
    // Шкала на голий виріб може бути не задана — тоді, як і раніше, діє шкала
    // способу нанесення від кількості голих виробів. Без цього запасного шляху
    // товари без друку залишились би зовсім без знижки за тираж.
    // Голий виріб не має стосунку до способу нанесення, тож коли власної шкали
    // виробу не задано, він іде за ЗАГАЛЬНОЮ шкалою сайту, а не за шкалою того
    // способу, який зараз вибраний у конструкторі. Інакше зміна типового
    // способу мовчки міняла б ціни на футболки без друку.
    /* Скільки одиниць КОЖНОГО товару в замовленні. Знижка на виріб рахується
       саме від цього числа: 20 футболок і 20 худі — це не 40 футболок, бо в
       постачальника ціна падає за кожним товаром окремо. Позиція без ознаки
       товару (старі замовлення) рахується від усього одягу разом, як було. */
    var Ug = {}, Bg = {}, Uall = 0, Ball = 0;
    list.forEach(function(it){
      var u = Math.max(0, +it.units || 0);
      var g = it.gid || '';
      Ug[g] = (Ug[g] || 0) + u; Uall += u;
      if(!it.upsell){ Bg[g] = (Bg[g] || 0) + u; Ball += u; }
    });
    if(!anyUp){ Bg = Ug; Ball = Uall; }
    /* Коефіцієнт на виріб цієї позиції. Він НЕ залежить від способу
       нанесення: футболка коштує стільки, скільки коштує, і те, що на ній
       надрукували, до її ціни стосунку не має. Доти виріб із друком
       дисконтувався шкалою способу — і перемикання DTF↔вишивка мовчки
       міняло ціну самої футболки. */
    function garmentQty(it){
      if(opts.noVolume) return 1;
      var g = it.gid || '';
      var map = it.upsell ? Ug : Bg;
      return (g ? map[g] : (it.upsell ? Uall : Ball)) || 1;
    }
    function gcoefOf(it){ return garmentCoefFor(garmentQty(it), it.gid || ''); }

    // Разові оплати рахуються окремо для картинок і окремо для написів:
    // підготовка напису дешевша за підготовку логотипа, тож змішувати їх в
    // одну суму означало б переплату на одному й недоплату на іншому.
    // Ключ відра — спосіб + вид: dtf:img, dtf:txt, embro:img, embro:txt.
    function kindOf(it, i){
      var ks = it.designKinds;
      return (Array.isArray(ks) && ks[i] === 'txt') ? 'txt' : 'img';
    }
    /* Відро разових. Погоджені позиції й допродаж рахуються в РІЗНИХ відрах:
       інакше поява рекомендованого товару переділила б макет на більший
       тираж — і погоджена ціна поїхала б, чого ми саме й уникаємо.

       doneReps — відбитки дизайнів, макет яких уже оплачено в погодженій
       частині. Допродаж із таким самим дизайном за макет не платить: його
       вже підготували, і брати за нього вдруге немає за що. */
    function buildFees(mine, mk, kind, doneReps){
      var flat = [];                     // відбитки цього виду, у порядку появи
      mine.forEach(function(it){
        (it.designs || []).forEach(function(fp, i){ if(kindOf(it, i) === kind) flat.push(fp || ''); });
      });
      if(!flat.length) return null;
      var cfg = methodCfgKind((p.methods || {})[mk] || {}, kind === 'txt');
      var g = designGroups(flat);
      // скільки виробів припадає на кожен дизайн і на весь вид загалом
      var unitsOf = new Array(g.count).fill(0), k = 0, total = 0;
      mine.forEach(function(it){
        var seen = {}, has = false;
        (it.designs || []).forEach(function(fp, i){
          if(kindOf(it, i) !== kind) return;
          has = true;
          var gi = g.index[k++];
          if(seen[gi]) return;           // те саме лого двічі на одному виробі — один дизайн
          seen[gi] = 1;
          unitsOf[gi] += Math.max(0, +it.units || 0);
        });
        if(has) total += Math.max(0, +it.units || 0);
      });
      /* Які групи вже оплачені раніше. Порожній відбиток теж вважаємо
         оплаченим, коли в погодженій частині взагалі є дизайни цього виду:
         довести, що це ІНШИЙ малюнок, нічим, а виставити за нього окремий
         макет — це рахунок за роботу, якої, найімовірніше, не було. */
      var done = null;
      if(doneReps){
        done = {};
        g.reps.forEach(function(r, i){
          done[i] = r
            ? doneReps.some(function(x){ return sameFingerprint(x, r); })
            : doneReps.length > 0;
        });
      }
      // Перша ПЛАТНА група входить у разову підготовку, наступні — ескізи
      var firstIdx = -1;
      for(var i = 0; i < g.count; i++){ if(!done || !done[i]){ firstIdx = i; break; } }
      return { cfg: cfg, groups: g, unitsOf: unitsOf, total: total || 1,
               done: done, firstIdx: firstIdx };
    }
    function feeKey(it, mk, kind){ return mk + ':' + kind + (it.upsell ? ':u' : ''); }
    var fees = {};
    ['dtf','embro'].forEach(function(mk){
      var mine = list.filter(function(it){ return !it.bare && (it.method === 'embro' ? 'embro' : 'dtf') === mk; });
      var base = mine.filter(function(it){ return !it.upsell; });
      var up   = mine.filter(function(it){ return  it.upsell; });
      ['img','txt'].forEach(function(kind){
        var fb = buildFees(base, mk, kind, null);
        fees[mk + ':' + kind] = fb;
        if(!up.length){ fees[mk + ':' + kind + ':u'] = null; return; }
        fees[mk + ':' + kind + ':u'] = buildFees(up, mk, kind, (fb && fb.groups.reps) || []);
      });
    });

    // Для кожної позиції — її частка разових. Курсор свій на кожне відро,
    // бо дизайни всередині відра нумеруються окремо.
    var cursor = {};
    return list.map(function(it){
      var u = Math.max(0, +it.units || 0);
      if(it.bare){
        var gcSet = gcoefOf(it);
        var gc = (gcSet != null) ? gcSet
               : tierCoefFor(null, opts.noVolume ? 1 : (volFor(it, 'bare') || 1));
        var ub = Math.round((+it.base || 0) * gc) + (+it.pieceFee || 0);
        return { unit: ub, sum: ub * u, feeShare: 0, parts: {
          bare: true, coef: gc, gcoef: gc, garmentQty: garmentQty(it),
          groupQty: volFor(it, 'bare'), upsell: !!it.upsell,
          garmentBase: +it.base || 0, garment: Math.round((+it.base || 0) * gc),
          appBase: 0, app: 0, pieceFee: +it.pieceFee || 0,
          feeShare: 0, feeTotal: 0, feeUnits: 0, sketches: []
        } };
      }
      var mk = it.method === 'embro' ? 'embro' : 'dtf';
      var c = coefFor(it, mk);
      // DTF: рядок сітки береться за СУМАРНИМ тиражем методу
      var flat = 0;
      if(mk === 'dtf' && (it.dtfCols || []).length){
        var cfg = (p.methods || {}).dtf || {}, qf = cfg.qtyFrom || [], row = 0;
        var qRow = opts.noVolume ? 1 : (volFor(it, 'dtf') || 1);
        for(var j = qf.length - 1; j >= 0; j--){ if(qRow >= qf[j]){ row = j; break; } }
        var grid = cfg.price || [];
        it.dtfCols.forEach(function(col){
          flat += Math.round((grid[row] && grid[row][col] != null) ? +grid[row][col] : 0);
        });
      }
      // Частка разових: базова оплата методу — на всі вироби методу,
      // додатковий ескіз — лише на вироби свого дизайну.
      var feeShare = 0, costShare = 0, sketches = [], feeLines = [], feeTotal = 0, feeUnits = 0;
      /* Номери дизайнів цієї позиції — рівно ті, за якими рушій вирішує, що
         з чим збігається. Без них «чому тут ескіз, а тут ні» доводилось
         брати на віру: на екрані видно картинки, а рахунок іде за групами. */
      var paid = {}, freeDesigns = 0, designNos = [];
      (it.designs || []).forEach(function(fp, i){
    /* Дизайн без відбитка — усе одно дизайн. Раніше такий рядок мовчки
       пропускався, і замовлення втрачало гроші: напис, відбиток якого ще
       не встиг порахуватись, ставав безкоштовним — ні разової підготовки
       макета, ні ескізу. Тепер він рахується, а порожній відбиток просто
       не збігається ні з чим і утворює власну групу. */
        var kind = kindOf(it, i), key = feeKey(it, mk, kind), f = fees[key];
        if(!f) return;
        if(cursor[key] == null) cursor[key] = 0;
        var gi = f.groups.index[cursor[key]++];
        /* i — номер дизайну ВСЕРЕДИНІ позиції, той самий, що в designs,
           designKinds і designMm2. Без нього прорахунок не може сказати
           адмінці, який саме рядок перемикають на напис. */
        designNos.push({ i: i, kind: kind, no: gi + 1, first: gi === f.firstIdx,
                         units: f.unitsOf[gi] || 0 });
        /* Макет цього дизайну вже оплачено погодженою частиною замовлення —
           допродаж за нього не платить. Саме звідси й береться вигода
           рекомендованого товару: та сама вишивка, але без підготовки. */
        if(f.done && f.done[gi]){ freeDesigns++; return; }
        if(!paid[kind]){                            // разова за вид — один раз на позицію
          paid[kind] = {};
          feeShare += (+f.cfg.orderFee || 0) / (f.total || 1);
          costShare += (+f.cfg.orderCost || 0) / (f.total || 1);
          feeTotal += (+f.cfg.orderFee || 0); feeUnits = f.total || 1;
          /* Кожну разову запамʼятовуємо окремим рядком. Раніше вони
             складались в одне число, і в прорахунку стояло «підготовка
             макета 1100», де 700 за картинку і 400 за напис — різні
             роботи за різними ставками — були нерозрізненні. */
          /* di — номер дизайну ВСЕРЕДИНІ позиції, з якого ця разова й
             почалась. Без нього прорахунок не може сказати адмінці, який
             саме дизайн перемикати на рядку «Підготовка макета»: сама
             разова належить видові, а перемикають конкретний дизайн. */
          feeLines.push({ kind: kind, di: i, gi: gi, first: gi === f.firstIdx,
                          fee: +f.cfg.orderFee || 0,
                          cost: +f.cfg.orderCost || 0, units: f.total || 1 });
        }
        // Перший ПЛАТНИЙ дизайн виду входить у разову підготовку
        if(paid[kind][gi] || gi === f.firstIdx) return;
        paid[kind][gi] = 1;
        feeShare += (+f.cfg.sketchFee || 0) / (f.unitsOf[gi] || 1);
        costShare += (+f.cfg.sketchCost || 0) / (f.unitsOf[gi] || 1);
        // Той самий di: ескіз завжди належить одному конкретному дизайну
        sketches.push({ kind: kind, di: i, gi: gi, no: gi + 1,
                        fee: +f.cfg.sketchFee || 0,
                        cost: +f.cfg.sketchCost || 0, units: f.unitsOf[gi] || 1 });
      });
      /* Виріб іде за СВОЄЮ шкалою, нанесення — за шкалою способу. Округлення
         одне на обидві частини: два окремі давали б розбіжність у гривню з
         тим, що бачить клієнт у кошторисі. */
      var gcv = gcoefOf(it);
      if(gcv == null) gcv = c;          // шкали виробу немає — усе як раніше
      var unit = Math.round((+it.base || 0) * gcv + (+it.coefPart || 0) * c) + flat +
                 (+it.pieceFee || 0) + Math.round(feeShare);
      return { unit: unit, sum: unit * u, feeShare: Math.round(feeShare), parts: {
        bare: false, method: mk, coef: c, gcoef: gcv, garmentQty: garmentQty(it),
        groupQty: volFor(it, mk) || u,
        /* Позначки для прорахунку: чи це допродаж і скільки дизайнів пішло
           без оплати макета. Менеджер має бачити, чому рекомендований товар
           вийшов дешевшим, — інакше цифра виглядає як помилка. */
        upsell: !!it.upsell, freeDesigns: freeDesigns, designNos: designNos,
        garmentBase: +it.base || 0, garment: Math.round((+it.base || 0) * gcv),
        appBase: (+it.coefPart || 0) + flat, app: Math.round((+it.coefPart || 0) * c) + flat,
        basePart: +it.basePart || 0, minPart: +it.minPart || 0,
        gridPriced: mk === 'dtf' && flat > 0,
        pieceFee: +it.pieceFee || 0,
        feeShare: Math.round(feeShare),
        /* Собівартість разових рахує той самий обхід, що й продажну.
           Доти вона бралась окремою функцією, яка рахувала «унікальні
           дизайни мінус один» на всі види разом — а рушій звільняє
           перший дизайн КОЖНОГО виду. На картинці з написом це давало
           зайвий платний ескіз у собівартості й занижену маржу. */
        costShare: Math.round(costShare),
        feeTotal: feeTotal, feeUnits: feeUnits,
        feeLines: feeLines, sketches: sketches
      } };
    });
  }
  /* ══════════ Ціна одного нанесення від його площі ══════════
     Жила в конструкторі й лишалась там, поки типом дизайну ніхто не керував
     вручну: конструктор рахував число один раз при збереженні, і всі решта
     просто його отримували.

     Тепер тип можна перемкнути в прорахунку — картинку рахувати як напис. А
     в вишивці в напису СВОЯ ставка за площу, тож перемикання мусить
     перерахувати й нанесення, не відкриваючи позицію. Отже формула потрібна
     обом сторонам — і живе там само, де решта рушія.

     Площа при перемиканні НЕ міняється: 17.1 см² лишається 17.1 см².
     Міняються лише ставки, за якими ця площа рахується. */
  function areaTiersOf(m, isCost){
    var a = (m && Array.isArray(m.areaTiers)) ? m.areaTiers : [];
    return a.map(function(t){
        return { from: +t.from || 0, rate: +(isCost ? t.cost1k : t.price1k) };
      })
      /* Ставка 0 у СХОДИНКОВІЙ шкалі означала б «уся площа безкоштовно»,
         щойно вона дотягнулась до порогу. У старій прогресивній шкалі той
         самий нуль читався інакше — «далі не додаємо», — і такі пороги
         лишились у прайсі. Тому нульову ставку пропускаємо. */
      .filter(function(t){ return t.from > 0 && isFinite(t.rate) && t.rate > 0; })
      .sort(function(a, b){ return a.from - b.from; });
  }
  function areaParts(m, mm2, isCost){
    mm2 = Math.max(0, +mm2 || 0);
    var rate = +(isCost ? (m || {}).costPer1000mm2 : (m || {}).pricePer1000mm2) || 0;
    var tiers = areaTiersOf(m, isCost);
    // Остання сходинка, до якої площа дотягнулась, задає ставку на ВСЮ площу
    for(var i = 0; i < tiers.length; i++){ if(mm2 >= tiers[i].from) rate = tiers[i].rate; }
    return [{ mm2: mm2, rate: rate }];
  }
  function areaSum(m, mm2, isCost){
    return areaParts(m, mm2, isCost).reduce(function(s, p){ return s + p.mm2 * p.rate / 1000; }, 0);
  }
  function listAt(a, idx){
    if(!Array.isArray(a) || !a.length) return 0;
    return Math.round(+a[Math.min(idx || 0, a.length - 1)] || 0);
  }
  function minForIndex(m, idx){
    if(m && Array.isArray(m.minPrices) && m.minPrices.length) return listAt(m.minPrices, idx);
    if(m && m.minPrice != null) return Math.round(+m.minPrice || 0);
    return 0;
  }
  function minCostForIndex(m, idx){ return listAt(m && m.minCosts, idx); }
  function baseForIndex(m, idx){ return listAt(m && m.basePrices, idx); }
  // Продажна ціна одного нанесення: старт + площа, і лише потім підлога —
  // мінімалка страхує знизу весь доданок, а не саму площу.
  function placeSell(m0, isText, mm2, idx){
    var m = methodCfgKind(m0 || {}, !!isText);
    var raw;
    if(m.pricePer1000mm2 != null) raw = areaSum(m, mm2, false);
    else if(m.mode === 'stitch') raw = (+mm2 || 0) * (+m.density || 1.6) / 1000 * (+m.pricePer1000 || 0);
    else raw = (+m.ratePerMm2 || 0) * (+mm2 || 0);
    var area = Math.round(raw), base = baseForIndex(m, idx || 0);
    var minAdd = Math.max(0, minForIndex(m, idx || 0) - (area + base));
    return { area: area, base: base, minAdd: minAdd, total: area + base + minAdd };
  }
  function placeCost(m0, isText, mm2, idx){
    var m = methodCfgKind(m0 || {}, !!isText);
    return Math.max(Math.round(areaSum(m, mm2, true)), minCostForIndex(m, idx || 0));
  }

  function methodCfgKind(m, isText){
    if(!m || !isText || !m.text) return m || {};
    var t = m.text, out = {};
    Object.keys(m).forEach(function(k){ out[k] = m[k]; });
    Object.keys(t).forEach(function(k){
      var v = t[k];
      if(v === null || v === undefined || v === '') return;
      if(Array.isArray(v) && !v.length) return;
      out[k] = v;
    });
    return out;
  }

  /* Розкладаємо відбитки по групах: однакові малюнки — одна група. Перша
     група входить у разову підготовку макета, кожна наступна — це платний
     додатковий ескіз.

     Дизайни БЕЗ відбитка йдуть у першу групу, а не кожен у свою. Відбиток
     може не порахуватись із цілком буденних причин: картинка ще не
     завантажилась, прийшла з чужого домену й полотно закрилось, макет
     перемальовується просто зараз. Раніше кожен такий рядок ставав окремою
     групою — і в замовленні зʼявлявся «додатковий ескіз», якого в макеті
     немає й ніколи не було: те саме лого на футболці й на худі рахувалось
     як два різні макети.

     Дизайном такий рядок лишається: разова підготовка за нього береться, як
     і за будь-який інший. Ми лише не беремо грошей за ДРУГИЙ макет, поки не
     можемо показати, чим він відрізняється від першого. */
  function designGroups(fps){
    var reps = [], index = new Array(fps.length), blank = false;
    fps.forEach(function(fp, n){
      if(!fp){ blank = true; return; }
      var k = -1;
      for(var i = 0; i < reps.length; i++){ if(sameFingerprint(reps[i], fp)){ k = i; break; } }
      if(k < 0){ reps.push(fp); k = reps.length - 1; }
      index[n] = k;
    });
    if(blank){
      if(!reps.length) reps.push('');
      fps.forEach(function(fp, n){ if(!fp) index[n] = 0; });
    }
    return { count: reps.length, index: index, reps: reps };
  }

  function sameFingerprint(a, b){ return fpDistance(a, b) <= FP_SAME; }

  /* Відбиток складається з двох блоків через «|»: колір і прозорість.
     Прозорість зʼявилась пізніше, тож у замовленнях, збережених раніше, її
     немає. Коли її немає хоч в одного — порівнюємо за самим кольором:
     інакше кожна стара позиція раптом стала б «іншим дизайном» і привела
     за собою додатковий ескіз. */
  function fpPart(a, b){
    if(!a || !b || a.length !== b.length || !a.length) return null;
    var n = 0;
    for(var i = 0; i < a.length; i++) n += Math.abs((+a[i]||0) - (+b[i]||0));
    return n / (a.length * 4);
  }
  function fpDistance(a, b){
    a = String(a || ''); b = String(b || '');
    if(!a || !b) return 1;
    /* Запасний відбиток «u:…» — це адреса файлу, а не пікселі. Порівнювати
       його поцифрово немає сенсу: два різні хеші однаково несхожі, а
       однакові збігаються повністю. Тож або той самий файл, або інший
       дизайн — жодної «схожості» посередині. */
    if(a.indexOf('u:') === 0 || b.indexOf('u:') === 0) return a === b ? 0 : 1;
    var pa = a.split('|'), pb = b.split('|');
    var col = fpPart(pa[0], pb[0]);
    if(col == null) return 1;
    var alp = (pa[1] && pb[1]) ? fpPart(pa[1], pb[1]) : null;
    // Колір — три цифри на клітинку, прозорість одна: звідси й ваги 3 до 1
    return alp == null ? col : (col * 3 + alp) / 4;
  }

  /* Наскільки два відбитки мають бути схожі, щоб вважатись одним дизайном.
     Те саме число, що й у конструкторі: інакше однакове лого рахувалось би
     як два різні макети — або, навпаки, різні зливались би в один. */
  var FP_N = 12, FP_SAME = 0.03;

  /* Як рахувати допродаж. 'all' — перерахувати весь склад разом (так було
     завжди й так лишається за замовчуванням), 'keep' — погоджене не рухати,
     а виграш від зрослого тиражу віддати новому товару. Задається в
     Налаштуваннях → Формування цін → «Ціни при допродажу». */
  function upsellMode(){
    var p = window.SITE_CONTENT && window.SITE_CONTENT.pricing;
    return ((p && p.upsellMode) === 'keep') ? 'keep' : 'all';
  }

  window.LQ = window.LQ || {};
  window.LQ.upsellMode = upsellMode;
  window.LQ.areaParts = areaParts;
  window.LQ.areaSum = areaSum;
  window.LQ.minForIndex = minForIndex;
  window.LQ.minCostForIndex = minCostForIndex;
  window.LQ.baseForIndex = baseForIndex;
  window.LQ.placeSell = placeSell;
  window.LQ.placeCost = placeCost;
  window.LQ.methodCfgKind = methodCfgKind;
  window.LQ.priceOrder = priceOrder;
  window.LQ.tierCoefFor = tierCoefFor;
  window.LQ.garmentCoefFor = garmentCoefFor;
  window.LQ.sitePricing = sitePricing;
})();
