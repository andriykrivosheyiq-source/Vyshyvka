/* ══════════════════════════════════════════════════════════════════════
   ВІДБИТОК ДИЗАЙНУ — один на весь Loomiq

   За ним рушій цін вирішує, чи два нанесення це один малюнок (тоді макет
   готують один раз) чи різні (тоді за кожен наступний береться ескіз).
   Тобто це прямо гроші в рахунку, і рахувати його двома різними способами
   не можна: конструктор писав би одні відбитки, а адмінка при перевірці
   отримувала б інші — і те саме лого розʼїжджалось би на два дизайни.

   Тому він живе тут, окремо, і його беруть обидві сторони.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  function measureShape(img){
    var W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    var THR = 25;                       // нижче цієї прозорості пікселя ніби немає

    // 1) Грубі межі — щоб не тягнути в памʼять величезний файл цілком.
    var S0 = 512;
    var cw = Math.max(1, Math.min(S0, W)), ch = Math.max(1, Math.round(cw * H / W));
    var c0 = document.createElement('canvas'); c0.width = cw; c0.height = ch;
    var x0c = c0.getContext('2d'); x0c.drawImage(img, 0, 0, cw, ch);
    var d0 = x0c.getImageData(0, 0, cw, ch).data;
    var aX = cw, aY = ch, bX = -1, bY = -1;
    for(var y = 0; y < ch; y++) for(var x = 0; x < cw; x++){
      if(d0[(y*cw + x)*4 + 3] > THR){
        if(x < aX) aX = x; if(x > bX) bX = x;
        if(y < aY) aY = y; if(y > bY) bY = y;
      }
    }
    if(bX < aX || bY < aY) return null;                  // порожня картинка

    // 2) Переходимо до цілих пікселів оригіналу, із запасом на похибку грубого проходу.
    var pad = 2;
    var sx  = Math.max(0, Math.floor((aX - pad) * W / cw));
    var sy  = Math.max(0, Math.floor((aY - pad) * H / ch));
    var sx1 = Math.min(W, Math.ceil((bX + 1 + pad) * W / cw));
    var sy1 = Math.min(H, Math.ceil((bY + 1 + pad) * H / ch));
    var sw = Math.max(1, sx1 - sx), sh = Math.max(1, sy1 - sy);

    // 3) Точний прохід по самому малюнку. Поки він уміщається — копія 1:1,
    //    без жодного перемальовування, тож рахуються справжні пікселі.
    var S1 = 1024;
    var k  = Math.min(1, S1 / Math.max(sw, sh));
    var dw = Math.max(1, Math.round(sw * k)), dh = Math.max(1, Math.round(sh * k));
    var c1 = document.createElement('canvas'); c1.width = dw; c1.height = dh;
    c1.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    var d1 = c1.getContext('2d').getImageData(0, 0, dw, dh).data;
    var mnX = dw, mnY = dh, mxX = -1, mxY = -1, opaque = 0;
    for(var yy = 0; yy < dh; yy++) for(var xx = 0; xx < dw; xx++){
      if(d1[(yy*dw + xx)*4 + 3] > THR){
        opaque++;
        if(xx < mnX) mnX = xx; if(xx > mxX) mxX = xx;
        if(yy < mnY) mnY = yy; if(yy > mxY) mxY = yy;
      }
    }
    if(mxX < mnX || mxY < mnY) return null;

    var boxW = mxX - mnX + 1, boxH = mxY - mnY + 1;
    return {
      opaqueBox: {
        x0: (sx + mnX / dw * sw) / W,
        y0: (sy + mnY / dh * sh) / H,
        x1: (sx + (mxX + 1) / dw * sw) / W,
        y1: (sy + (mxY + 1) / dh * sh) / H
      },
      // Нижня межа лише щоб не отримати нуль на майже порожній картинці.
      fill: Math.min(1, Math.max(0.01, opaque / (boxW * boxH)))
    };
  }
  // Відбиток зображення. Те саме лого, завантажене окремо для кепки й окремо
  // для футболки, отримує різні адреси — порівнювати URL марно.
  //
  // Беремо сітку 12×12, у кожній клітинці — колір, огрублений до 5 рівнів на
  // канал. Колір обовʼязково: без нього червоне коло й синє коло виходили
  // однаковими. Порівнюємо не на точний збіг, а за відстанню — масштабування
  // й перезбереження трохи міняють краї.
  //
  // Заміряно на тестових малюнках: той самий дизайн у різному розмірі — 0…0.1%,
  // різні дизайни — 11…23%. Поріг 3% розділяє їх із запасом.
  var FP_N = 12, FP_SAME = 0.03;
  /* Дивимось на САМ малюнок, а не на прозоре поле навколо нього. Логотип
     майже завжди лежить невеликою плямою посеред великого прозорого полотна.
     Якщо стиснути все полотно в квадратик 12×12, від малюнка лишиться кілька
     блідих пікселів, а решта — біле тло. Два зовсім різні логотипи виходили
     тоді «майже однаково білими», відстань між ними падала нижче порогу — і
     рушій вважав їх ОДНИМ дизайном. На практиці це виглядало так: менеджер
     прибрав лого, завантажив зовсім інше, а додатковий ескіз не додався.

     Тому спершу знаходимо межі непрозорого вмісту (opaqueBox) і стискаємо в
     сітку саме його. Тоді малюнок заповнює всю сітку, і відмінності видно.

     Альфа теж іде у відбиток: два силуети однакового кольору, але різної
     форми, за самим лише кольором нерозрізненні. */
  function imageFingerprint(img, box){
    try{
      var W = img.naturalWidth || 1, H = img.naturalHeight || 1;
      var sx = 0, sy = 0, sw = W, sh = H;
      if(box && box.x1 > box.x0 && box.y1 > box.y0){
        sx = Math.max(0, Math.floor(box.x0 * W));
        sy = Math.max(0, Math.floor(box.y0 * H));
        sw = Math.max(1, Math.ceil((box.x1 - box.x0) * W));
        sh = Math.max(1, Math.ceil((box.y1 - box.y0) * H));
      }
      var c = document.createElement('canvas'); c.width = FP_N; c.height = FP_N;
      var x = c.getContext('2d', { willReadFrequently:true });
      x.fillStyle = '#fff'; x.fillRect(0, 0, FP_N, FP_N);   // прозоре → біле
      x.drawImage(img, sx, sy, sw, sh, 0, 0, FP_N, FP_N);
      var d = x.getImageData(0, 0, FP_N, FP_N).data, out = '';
      // Прозорість беремо з ОКРЕМОГО проходу: на білому тлі вона вже злилась
      var ca = document.createElement('canvas'); ca.width = FP_N; ca.height = FP_N;
      var xa = ca.getContext('2d', { willReadFrequently:true });
      xa.drawImage(img, sx, sy, sw, sh, 0, 0, FP_N, FP_N);
      var a = xa.getImageData(0, 0, FP_N, FP_N).data;
      /* Колір і прозорість — двома блоками через «|», а не впереміш. Старі
         відбитки складались лише з кольору; якби прозорість вклинилась між
         цифрами, вони перестали б збігатися з новими взагалі — і кожне
         замовлення, збережене раніше, отримало б «інші дизайни» разом із
         додатковими ескізами. Двома блоками старий відбиток лишається
         першою половиною нового, і порівняння працює в обидва боки. */
      var alpha = '';
      for(var i = 0; i < d.length; i += 4){
        out += Math.round(d[i]/64) + '' + Math.round(d[i+1]/64) + '' + Math.round(d[i+2]/64);
        alpha += Math.round(a[i+3]/64);
      }
      return out + '|' + alpha;
    }catch(e){ return ''; }
  }
  /* ── Запасний відбиток: сама адреса файлу ────────────────────────────
     Прочитати пікселі вдається не завжди: чужий домен без CORS псує
     полотно, картинка може ще не догрузитись, у теці може не бути дозволу.
     Раніше в такому разі відбиток лишався порожнім, а порожній рушій
     приєднував до першої групи — і другий, справді інший логотип (типово
     той, що кладуть на спину) мовчки їхав без ескізу: площа рахувалась,
     підготовка макета — ні.

     Адреса файлу — теж чесна ознака дизайну, просто грубіша: той самий
     файл дає той самий рядок, інший файл — інший. Помилитись вона може
     лише в один бік (два різні посилання на однакову картинку), і це
     видно в розкладі як «Дизайн №2», тоді як безкоштовний ескіз не видно
     ніяк. */
  function urlFingerprint(url){
    var s = String(url || '').split(/[?#]/)[0];
    if(!s) return '';
    var h = 5381;
    for(var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'u:' + h.toString(36) + ':' + s.length;
  }
  /* Порахувати відбиток просто з адреси картинки. Потрібно адмінці: у
     збережених замовленнях лежать відбитки, пораховані тодішньою версією
     формули, і щоб перевірити або оновити їх, треба вміти зняти відбиток
     із самого файлу, не відкриваючи конструктор. */
  function fpFromUrl(url){
    return new Promise(function(res){
      if(!url){ return res(''); }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function(){
        var fp = '';
        try{
          var m = measureShape(img);
          fp = imageFingerprint(img, m ? m.opaqueBox : null);
        }catch(e){ fp = ''; }
        res(fp || urlFingerprint(url));
      };
      // Картинка не відкрилась — лишається її адреса. Порожнього відбитка
      // тут бути не повинно: він означає «дизайну немає», а він є.
      img.onerror = function(){ res(urlFingerprint(url)); };
      img.src = url;
    });
  }

  window.LQ = window.LQ || {};
  window.LQ.measureShape = measureShape;
  window.LQ.imageFingerprint = imageFingerprint;
  window.LQ.urlFingerprint = urlFingerprint;
  window.LQ.fpFromUrl = fpFromUrl;
})();
