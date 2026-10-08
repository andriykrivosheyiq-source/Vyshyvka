/* ══════════ ПРИБИРАННЯ ФОНУ — ВНУТРІШНІЙ СЕРВІС (07.10.2026) ══════════

   Андрій: «спочатку внутрішній сервіс, одиничка — внутрішній, двійка —
   зовнішній… щоб економити на токенах». Зовнішній — PhotoRoom через наш
   Worker, і кожен виклик коштує грошей. Внутрішній — тут, у браузері,
   безкоштовно й без жодних ключів.

   Внутрішній вирішує сам, чим різати:
     • логотип на рівному тлі (по краях кадру один колір або прозоро) —
       швидкий алгоритм «заливка від країв» з loomiq-mock.js: миттєво й
       точно до пікселя, тонкі лінії не їсть;
     • фото, складне тло — нейромережа BiRefNet lite (ліцензія MIT) через
       transformers.js (Apache-2.0). Модель вантажиться з CDN при ПЕРШОМУ
       виклику (~100 МБ), далі лежить у кеші браузера. Є WebGPU — рахує на
       відеокарті, немає — на процесорі (повільніше, але працює).

   Не вийшло з моделлю (старий браузер, мережа) — повертаємось до швидкого
   алгоритму: людина отримує хоч щось і бачить кнопку «2 — PhotoRoom».

   Для тестів: `window.LQBgPipeline = async src => dataUrl` підміняє модель. */
(function(){
  'use strict';
  var LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
  /* Від кращої до простішої. fp16 — удвічі легша за fp32 і майже не
     гірша; MODNet — запасний (портретний, 25 МБ). */
  var MODELS = [
    { id: 'onnx-community/BiRefNet_lite-ONNX', dtype: 'fp16' },
    { id: 'onnx-community/BiRefNet_lite', dtype: 'fp16' },
    { id: 'onnx-community/BiRefNet_lite-ONNX', dtype: 'fp32' },
    { id: 'onnx-community/BiRefNet_lite', dtype: 'fp32' },
    { id: 'Xenova/modnet', dtype: 'fp32' }
  ];
  var seg = null, loading = null, lastErr = '';

  function img(src){
    return new Promise(function(res, rej){
      var im = new Image();
      if(!/^data:/i.test(String(src))) im.crossOrigin = 'anonymous';
      im.onload = function(){ res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  /* РІВНЕ ТЛО? Дивимось на рамку кадру в зменшеній копії: якщо майже вся
     вона одного кольору (або прозора) — це логотип на підкладці, і швидкий
     алгоритм тут кращий за будь-яку нейромережу. */
  function plain(src){
    return img(src).then(function(im){
      var N = 96, k = Math.min(1, N / Math.max(im.width, im.height));
      var w = Math.max(8, Math.round(im.width * k)), h = Math.max(8, Math.round(im.height * k));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h).data, px = [];
      var take = function(xx, yy){ var i = (yy * w + xx) * 4; px.push([d[i], d[i + 1], d[i + 2], d[i + 3]]); };
      for(var i = 0; i < w; i++){ take(i, 0); take(i, h - 1); }
      for(var j = 1; j < h - 1; j++){ take(0, j); take(w - 1, j); }
      var прозорих = px.filter(function(p){ return p[3] < 20; }).length;
      if(прозорих > px.length * 0.6) return true;
      var з = px.filter(function(p){ return p[3] >= 20; });
      var m = [0, 0, 0];
      з.forEach(function(p){ m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; });
      m = m.map(function(v){ return v / (з.length || 1); });
      var близьких = з.filter(function(p){
        return Math.abs(p[0] - m[0]) < 28 && Math.abs(p[1] - m[1]) < 28 && Math.abs(p[2] - m[2]) < 28; }).length;
      return близьких >= з.length * 0.9;
    });
  }

  /* ЧИ ПРИБРАВСЯ ФОН (08.10). Частка прозорих пікселів на рамці кадру вже
     ПІСЛЯ прибирання. Логотип на білому, що внизу переходить у сірий (фото
     аркуша), «рівним» здається, а заливка від країв лишає тло — і клієнт
     бачить свій білий прямокутник. Мало прозорого по краях — не впорались. */
  function edgeClear(src){
    return img(src).then(function(im){
      var N = 96, k = Math.min(1, N / Math.max(im.width, im.height));
      var w = Math.max(8, Math.round(im.width * k)), h = Math.max(8, Math.round(im.height * k));
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h).data, n = 0, t = 0;
      var take = function(xx, yy){ n++; if(d[(yy * w + xx) * 4 + 3] < 20) t++; };
      for(var i = 0; i < w; i++){ take(i, 0); take(i, h - 1); }
      for(var j = 1; j < h - 1; j++){ take(0, j); take(w - 1, j); }
      return n ? t / n : 1;
    });
  }

  function load(onProgress){
    if(window.LQBgPipeline) return Promise.resolve(window.LQBgPipeline);
    if(seg) return Promise.resolve(seg);
    if(loading) return loading;
    loading = (async function(){
      var T = await import(LIB);
      try{ T.env.allowLocalModels = false; }catch(e){}
      var devs = (typeof navigator !== 'undefined' && navigator.gpu) ? ['webgpu', 'wasm'] : ['wasm'];
      for(var i = 0; i < MODELS.length; i++){
        for(var k = 0; k < devs.length; k++){
          try{
            var p = await T.pipeline('background-removal', MODELS[i].id, {
              dtype: MODELS[i].dtype, device: devs[k],
              progress_callback: function(e){
                if(onProgress && e && e.status === 'progress' && e.total)
                  onProgress('завантажую модель… ' + Math.round(e.loaded / e.total * 100) + '%');
              }
            });
            seg = async function(src){
              var out = await p(src);
              var r = Array.isArray(out) ? out[0] : out;
              var cv = r.toCanvas ? r.toCanvas() : null;
              if(!cv) throw new Error('модель не віддала зображення');
              return cv.toDataURL('image/png');
            };
            seg.model = MODELS[i].id + ' · ' + MODELS[i].dtype + ' · ' + devs[k];
            return seg;
          }catch(e){ lastErr = String((e && e.message) || e).slice(0, 160); }
        }
      }
      throw new Error('модель не завантажилась: ' + lastErr);
    })();
    loading.catch(function(){ loading = null; });
    return loading;
  }

  /* Розумне прибирання: dataURL → dataURL (PNG з прозорістю). */
  async function smart(src, onProgress){
    var f = await load(onProgress);
    if(onProgress) onProgress('прибираю фон…');
    return await f(src);
  }

  window.LQBg = {
    plain: plain,
    edgeClear: edgeClear,
    smart: smart,
    /* Чи модель уже в памʼяті — щоб попередити про перше завантаження. */
    ready: function(){ return !!seg || !!window.LQBgPipeline; },
    model: function(){ return (seg && seg.model) || ''; },
    lastError: function(){ return lastErr; }
  };
})();
