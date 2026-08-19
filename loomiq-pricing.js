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

  function garmentTiersList(){
    var p = sitePricing();
    var l = p && p.garmentTiers;
    if(!Array.isArray(l) || !l.length) return null;
    return l.map(function(t){ return { from: +t.from || 1, coef: +t.coef || 1 }; })
            .sort(function(a, b){ return a.from - b.from; });
  }

  function garmentCoefFor(qty){
    var l = garmentTiersList();
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

    var U = { dtf:0, embro:0, bare:0 };
    list.forEach(function(it){
      var u = Math.max(0, +it.units || 0);
      if(it.bare) U.bare += u; else U[it.method === 'embro' ? 'embro' : 'dtf'] += u;
    });
    var coef  = { dtf: tierCoefFor('dtf', opts.noVolume ? 1 : (U.dtf || 1)),
                  embro: tierCoefFor('embro', opts.noVolume ? 1 : (U.embro || 1)) };
    // Шкала на голий виріб може бути не задана — тоді, як і раніше, діє шкала
    // способу нанесення від кількості голих виробів. Без цього запасного шляху
    // товари без друку залишились би зовсім без знижки за тираж.
    // Голий виріб не має стосунку до способу нанесення, тож коли власної шкали
    // виробу не задано, він іде за ЗАГАЛЬНОЮ шкалою сайту, а не за шкалою того
    // способу, який зараз вибраний у конструкторі. Інакше зміна типового
    // способу мовчки міняла б ціни на футболки без друку.
    var gcoefSet = garmentCoefFor(opts.noVolume ? 1 : (U.bare || 1));

    // Разові оплати рахуються окремо для картинок і окремо для написів:
    // підготовка напису дешевша за підготовку логотипа, тож змішувати їх в
    // одну суму означало б переплату на одному й недоплату на іншому.
    // Ключ відра — спосіб + вид: dtf:img, dtf:txt, embro:img, embro:txt.
    function kindOf(it, i){
      var ks = it.designKinds;
      return (Array.isArray(ks) && ks[i] === 'txt') ? 'txt' : 'img';
    }
    var fees = {};
    ['dtf','embro'].forEach(function(mk){
      var mine = list.filter(function(it){ return !it.bare && (it.method === 'embro' ? 'embro' : 'dtf') === mk; });
      ['img','txt'].forEach(function(kind){
        var flat = [];                     // відбитки цього виду, у порядку появи
        mine.forEach(function(it){
          (it.designs || []).forEach(function(fp, i){ if(kindOf(it, i) === kind) flat.push(fp || ''); });
        });
        if(!flat.length){ fees[mk + ':' + kind] = null; return; }
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
        fees[mk + ':' + kind] = { cfg: cfg, groups: g, unitsOf: unitsOf, total: total || 1 };
      });
    });

    // Для кожної позиції — її частка разових. Курсор свій на кожне відро,
    // бо дизайни всередині відра нумеруються окремо.
    var cursor = {};
    return list.map(function(it){
      var u = Math.max(0, +it.units || 0);
      if(it.bare){
        var gc = (gcoefSet != null) ? gcoefSet
               : tierCoefFor(null, opts.noVolume ? 1 : (U.bare || 1));
        var ub = Math.round((+it.base || 0) * gc) + (+it.pieceFee || 0);
        return { unit: ub, sum: ub * u, feeShare: 0, parts: {
          bare: true, coef: gc, groupQty: U.bare,
          garmentBase: +it.base || 0, garment: Math.round((+it.base || 0) * gc),
          appBase: 0, app: 0, pieceFee: +it.pieceFee || 0,
          feeShare: 0, feeTotal: 0, feeUnits: 0, sketches: []
        } };
      }
      var mk = it.method === 'embro' ? 'embro' : 'dtf';
      var c = coef[mk];
      // DTF: рядок сітки береться за СУМАРНИМ тиражем методу
      var flat = 0;
      if(mk === 'dtf' && (it.dtfCols || []).length){
        var cfg = (p.methods || {}).dtf || {}, qf = cfg.qtyFrom || [], row = 0;
        var qRow = opts.noVolume ? 1 : (U.dtf || 1);
        for(var j = qf.length - 1; j >= 0; j--){ if(qRow >= qf[j]){ row = j; break; } }
        var grid = cfg.price || [];
        it.dtfCols.forEach(function(col){
          flat += Math.round((grid[row] && grid[row][col] != null) ? +grid[row][col] : 0);
        });
      }
      // Частка разових: базова оплата методу — на всі вироби методу,
      // додатковий ескіз — лише на вироби свого дизайну.
      var feeShare = 0, costShare = 0, sketches = [], feeLines = [], feeTotal = 0, feeUnits = 0;
      var paid = {};
      (it.designs || []).forEach(function(fp, i){
    /* Дизайн без відбитка — усе одно дизайн. Раніше такий рядок мовчки
       пропускався, і замовлення втрачало гроші: напис, відбиток якого ще
       не встиг порахуватись, ставав безкоштовним — ні разової підготовки
       макета, ні ескізу. Тепер він рахується, а порожній відбиток просто
       не збігається ні з чим і утворює власну групу. */
        var kind = kindOf(it, i), key = mk + ':' + kind, f = fees[key];
        if(!f) return;
        if(cursor[key] == null) cursor[key] = 0;
        var gi = f.groups.index[cursor[key]++];
        if(!paid[kind]){                            // разова за вид — один раз на позицію
          paid[kind] = {};
          feeShare += (+f.cfg.orderFee || 0) / (f.total || 1);
          costShare += (+f.cfg.orderCost || 0) / (f.total || 1);
          feeTotal += (+f.cfg.orderFee || 0); feeUnits = f.total || 1;
          /* Кожну разову запамʼятовуємо окремим рядком. Раніше вони
             складались в одне число, і в прорахунку стояло «підготовка
             макета 1100», де 700 за картинку і 400 за напис — різні
             роботи за різними ставками — були нерозрізненні. */
          feeLines.push({ kind: kind, fee: +f.cfg.orderFee || 0,
                          cost: +f.cfg.orderCost || 0, units: f.total || 1 });
        }
        if(paid[kind][gi] || gi === 0) return;      // перший дизайн виду входить у разову
        paid[kind][gi] = 1;
        feeShare += (+f.cfg.sketchFee || 0) / (f.unitsOf[gi] || 1);
        costShare += (+f.cfg.sketchCost || 0) / (f.unitsOf[gi] || 1);
        sketches.push({ kind: kind, fee: +f.cfg.sketchFee || 0,
                        cost: +f.cfg.sketchCost || 0, units: f.unitsOf[gi] || 1 });
      });
      var unit = Math.round((+it.base || 0) * c + (+it.coefPart || 0) * c) + flat +
                 (+it.pieceFee || 0) + Math.round(feeShare);
      return { unit: unit, sum: unit * u, feeShare: Math.round(feeShare), parts: {
        bare: false, method: mk, coef: c, groupQty: U[mk] || u,
        garmentBase: +it.base || 0, garment: Math.round((+it.base || 0) * c),
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

  function fpDistance(a, b){
    if(!a || !b || a.length !== b.length || !a.length) return 1;
    var n = 0;
    for(var i = 0; i < a.length; i++) n += Math.abs((+a[i]||0) - (+b[i]||0));
    return n / (a.length * 4);
  }

  /* Наскільки два відбитки мають бути схожі, щоб вважатись одним дизайном.
     Те саме число, що й у конструкторі: інакше однакове лого рахувалось би
     як два різні макети — або, навпаки, різні зливались би в один. */
  var FP_N = 12, FP_SAME = 0.03;

  window.LQ = window.LQ || {};
  window.LQ.priceOrder = priceOrder;
  window.LQ.tierCoefFor = tierCoefFor;
  window.LQ.garmentCoefFor = garmentCoefFor;
  window.LQ.sitePricing = sitePricing;
})();
