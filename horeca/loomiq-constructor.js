/* ══════════════════════════════════════════════════════════════════════
   КОНСТРУКТОР — спільний код сайту й комерційної пропозиції

   Один файл на два місця. Раніше пропозиція відкривала конструктор кадром,
   і це читалось як «відкрилась ще одна сторінка»; переписати його вдруге
   всередині КП означало б завести другий рушій — а другий рушій рано чи
   пізно розходиться з першим у цінах, зонах нанесення й розмірах. Тому код
   не копіюється й не переписується: і сайт, і пропозиція підключають цей
   самий файл.

   Тримається на глобальних змінних сторінки (cartItems, renderCart,
   escHtml, navGo…) і підключається ПІСЛЯ основного скрипта — саме тому
   кілька з них оголошені через var, а не const.
   ══════════════════════════════════════════════════════════════════════ */
  // ===== Product configurator =====
  (function(){
    var GARMENTS = [
      {id:'kitel', name:'Кухарський кітель', price:0,
        path:'M20 26L5 46h18v64h54V46h18L80 26Q72 16 60 14L50 14L40 14Q28 16 20 26z', extra:'M42 14q8 7 16 0 M46 22v58 M54 22v58'},
      {id:'apron', name:'Фартух', price:0,
        path:'M42 18q8 -5 16 0l-1 10h4l4 62H35l4-62h4z', extra:'M35 50h30'},
      {id:'teeover', name:'Футболка оверсайз', price:0,
        path:'M20 26L5 46h18v44h54V46h18L80 26Q72 16 62 14L54 22 50 16 46 22 38 14Q28 16 20 26z'},
      {id:'tee', name:'Футболка базова', price:0,
        path:'M20 26L5 46h18v44h54V46h18L80 26Q72 16 62 14L54 22 50 16 46 22 38 14Q28 16 20 26z'},
      {id:'hoodieover', name:'Худі оверсайз', price:250,
        path:'M20 28L5 48h18v42h54V48h18L80 28Q72 18 60 16Q56 28 50 28Q44 28 40 16Q28 18 20 28z', extra:'M40 55h20'},
      {id:'hoodieoverfleece', name:'Худі оверсайз з флісом', price:300,
        path:'M20 28L5 48h18v42h54V48h18L80 28Q72 18 60 16Q56 28 50 28Q44 28 40 16Q28 18 20 28z', extra:'M40 55h20'},
      {id:'hoodie', name:'Худі базове', price:250,
        path:'M20 28L5 48h18v42h54V48h18L80 28Q72 18 60 16Q56 28 50 28Q44 28 40 16Q28 18 20 28z', extra:'M40 55h20'},
      {id:'hoodiezip', name:'Худі на застібці', price:300,
        path:'M20 28L5 48h18v42h54V48h18L80 28Q72 18 60 16Q56 28 50 28Q44 28 40 16Q28 18 20 28z', extra:'M50 28v62'},
      {id:'sweat', name:'Світшот', price:200,
        path:'M20 26L5 46h18v44h54V46h18L80 26Q72 16 60 14L50 14L40 14Q28 16 20 26z', extra:'M38 14Q40 22 50 22Q60 22 62 14'},
      {id:'cap', name:'Кепка', price:90,
        path:'M20 55Q20 30 50 28Q80 30 80 55z', extra:'M15 58h55a5 5 0 000-10H15a5 5 0 000 10zM50 28v-10'},
      {id:'tote', name:'Шопер', price:90,
        path:'M25 35h50v55H25z', extra:'M35 35a15 15 0 0130 0'}
    ];
    var COLORS = [
      {id:'black',name:'Чорний',hex:'#1a1a1a'},{id:'white',name:'Білий',hex:'#eeebe4'},
      {id:'sand',name:'Пісочний',hex:'#c9b99a'},{id:'olive',name:'Олівковий',hex:'#5c5d45'},
      {id:'navy',name:'Синій',hex:'#1e2d4a'},{id:'steelblue',name:'Блакитний',hex:'#6c7b99'},{id:'clay',name:'Терактовий',hex:'#9a4a2a'},
      {id:'gray',name:'Сірий',hex:'#8a8a8a'},{id:'lgray',name:'Світло-сірий',hex:'#d0d0d0'},
      {id:'green',name:'Зелений',hex:'#2d5a27'},{id:'mint',name:"М'ятний",hex:'#5a9e8a'},
      {id:'red',name:'Червоний',hex:'#8b1a1a'},{id:'rose',name:'Рожевий',hex:'#d4607a'},
      {id:'purple',name:'Фіолетовий',hex:'#4a2070'},{id:'lilac',name:'Бузковий',hex:'#9b7fc7'},
      {id:'yellow',name:'Жовтий',hex:'#d4a017'},{id:'orange',name:'Помаранчевий',hex:'#d4622a'},
      {id:'brown',name:'Коричневий',hex:'#5c3a1a'},{id:'camel',name:'Верблюд',hex:'#c49a6c'}
    ];
    // Кольори з реальними фото (перед/зад): файли /images/<garment>-<colorId>-<side>.webp
    var GARMENT_COLORS = {
      tee: [
        {id:'black',name:'Чорний',hex:'#1a1a1a'},{id:'white',name:'Білий',hex:'#eeebe4'},
        {id:'lgray',name:'Світло-сірий',hex:'#d0d0d0'},{id:'gray',name:'Сірий',hex:'#8a8a8a'},
        {id:'navy',name:'Синій',hex:'#1e2d4a'},{id:'steelblue',name:'Блакитний',hex:'#6c7b99'},
        {id:'green',name:'Зелений',hex:'#2d5a27'},{id:'sand',name:'Пісочний',hex:'#c9b99a'},
        {id:'olive',name:'Хакі',hex:'#5c5d45'},{id:'red',name:'Бордовий',hex:'#8b1a1a'},
        {id:'rose',name:'Рожевий',hex:'#d4607a'},
        {id:'wine',name:'Вишневий',hex:'#48232a'},{id:'plum',name:'Слива',hex:'#3d2a3d'},
        {id:'orange',name:'Помаранчевий',hex:'#d4602d'},{id:'yellow',name:'Жовтий',hex:'#d89f29'}
      ],
      teeover: [
        {id:'black',name:'Чорний',hex:'#1c1c1c'},{id:'white',name:'Білий',hex:'#efeeee'},
        {id:'cream',name:'Молочний',hex:'#ece7e0'},{id:'greige',name:'Світло-сірий',hex:'#d2cdc6'},
        {id:'sand',name:'Пісочний',hex:'#d9c1b4'},{id:'pink',name:'Рожевий',hex:'#f4b6d0'},
        {id:'lblue',name:'Блакитний',hex:'#aec3dd'},{id:'slate',name:'Сіро-синій',hex:'#6b6d79'},
        {id:'brown',name:'Коричневий',hex:'#58382e'}
      ],
      hoodieover: [
        {id:'white',name:'Білий',hex:'#eeedeb'},{id:'gray',name:'Світло-сірий',hex:'#d4cec9'},
        {id:'khaki',name:'Тауп',hex:'#b7a69d'},{id:'brown',name:'Капучино',hex:'#8d6f63'},
        {id:'coyote',name:'Койот',hex:'#7c5e45'},{id:'fume',name:'Фюме',hex:'#878792'},
        {id:'black',name:'Чорний',hex:'#2c2727'}
      ],
      hoodieoverfleece: [
        {id:'pink',name:'Рожевий',hex:'#f2c8dd'},{id:'blue',name:'Синій',hex:'#283c61'},
        {id:'brown',name:'Шоколадний',hex:'#3f2e2f'}
      ],
      hoodie: [
        {id:'white',name:'Білий',hex:'#f5f5f5'},{id:'vanilla',name:'Ванільний',hex:'#f0e7d2'},
        {id:'skyblue',name:'Блакитний',hex:'#7f9fcc'},{id:'royalblue',name:'Синій',hex:'#4f5e95'},
        {id:'mint',name:'Мʼятний',hex:'#99e2d9'},{id:'lavender',name:'Лавандовий',hex:'#b88fae'},
        {id:'purple',name:'Фіолетовий',hex:'#412757'},{id:'darkgreen',name:'Темно-зелений',hex:'#385343'},
        {id:'sunyellow',name:'Жовтий',hex:'#f4d75f'},{id:'bordo',name:'Бордовий',hex:'#6e2730'},
        {id:'chocolate',name:'Шоколадний',hex:'#392c2a'}
      ],
      sweat: [
        {id:'black',name:'Чорний',hex:'#242424'},{id:'white',name:'Білий',hex:'#ededed'},
        {id:'gray',name:'Сірий',hex:'#cbcdcc'},{id:'graphite',name:'Графіт',hex:'#4d4d4b'},
        {id:'navy',name:'Темно-синій',hex:'#252839'},{id:'blue',name:'Синій',hex:'#325080'},
        {id:'azure',name:'Блакитний',hex:'#0e9fd0'},{id:'darkgreen',name:'Темно-зелений',hex:'#375243'},
        {id:'khaki',name:'Хакі',hex:'#616e54'},{id:'bordo',name:'Бордовий',hex:'#4f1b27'},
        {id:'red',name:'Червоний',hex:'#ba1d30'},{id:'pink',name:'Рожевий',hex:'#f8e5e7'},
        {id:'beige',name:'Бежевий',hex:'#dccbb3'},{id:'purple',name:'Фіолетовий',hex:'#37274c'},
        {id:'yellow',name:'Жовтий',hex:'#ecd048'}
      ],
      cap: [
        {id:'black',name:'Чорний',hex:'#1e1e1e'},{id:'cream',name:'Білий',hex:'#f2f1f4'},
        {id:'beige',name:'Бежевий',hex:'#bebab1'},{id:'graphite',name:'Сірий',hex:'#777779'},
        {id:'navy',name:'Темно-синій',hex:'#222a41'},{id:'azure',name:'Блакитний',hex:'#929eb6'},
        {id:'darkgreen',name:'Темно-зелений',hex:'#313b3c'},{id:'brown',name:'Коричневий',hex:'#58463f'},
        {id:'red',name:'Червоний',hex:'#b22821'},{id:'blue',name:'Електрик',hex:'#2536cc'}
      ],
      hoodiezip: [
        {id:'black',name:'Чорний',hex:'#1d1d1d'},{id:'gray',name:'Сірий',hex:'#cdccd0'},
        {id:'blue',name:'Синій',hex:'#2f59a0'},{id:'navy',name:'Темно-синій',hex:'#32314d'},
        {id:'red',name:'Червоний',hex:'#b6222f'}
      ],
      tote: [
        {id:'beige',name:'Бежевий',hex:'#decec0'},{id:'white',name:'Білий',hex:'#f0eeee'},
        {id:'navy',name:'Темно-синій',hex:'#242739'},{id:'black',name:'Чорний',hex:'#232323'}
      ]
    };
    function getColors(){ return GARMENT_COLORS[pm.garmentId] || COLORS; }
    // Фото-мініатюри для списку одягу (поки є лише для футболок)
    var GARMENT_THUMB = {teeover:'/images/teeover-black-front.webp', tee:'/images/tee-black-front.webp', hoodieover:'/images/hoodieover-black-front.webp', hoodieoverfleece:'/images/hoodieoverfleece-brown-front.webp', hoodie:'/images/thumb-hoodie.webp', hoodiezip:'/images/hoodiezip-black-front.webp', sweat:'/images/thumb-sweat.webp', cap:'/images/cap-black-front.webp', tote:'/images/tote-beige-front.webp'};
    var IMG_BASE = '';
    // Популярні кольори за замовчуванням: поки клієнт не обрав колір, стрічка
    // одягу і рекомендовані показуються різнокольоровими — щоб було видно асортимент.
    var POPULAR_COLOR = {teeover:'black', tee:'white', hoodieover:'khaki', hoodieoverfleece:'blue',
      hoodie:'vanilla', hoodiezip:'gray', sweat:'khaki', cap:'black', tote:'beige'};
    // Найближчий колір палітри до заданого (за RGB-відстанню)
    function lqHexRgb(h){ h=(h||'').replace('#',''); if(h.length<6) return null;
      return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]; }
    function lqClosestColor(pal, hex){
      var t=lqHexRgb(hex); if(!t||!pal||!pal.length) return null;
      var best=null, bd=Infinity;
      pal.forEach(function(c){ var r=lqHexRgb(c.hex); if(!r) return;
        // «redmean» — зважена відстань, ближча до людського сприйняття, ніж проста RGB
        var rm=(r[0]+t[0])/2, dR=r[0]-t[0], dG=r[1]-t[1], dB=r[2]-t[2];
        var d=(2+rm/256)*dR*dR + 4*dG*dG + (2+(255-rm)/256)*dB*dB;
        if(d<bd){bd=d;best=c;} });
      return best;
    }
    // Який колір показувати для виробу gid у стрічках: вибраний клієнтом (або найближчий),
    // а якщо колір ще не чіпали — популярний за замовчуванням.
    function displayColorFor(gid){
      var pal = GARMENT_COLORS[gid];
      if(!pal || !pal.length) return null;
      if(pm.colorPicked){
        var sel = getColor();
        var m = sel ? lqClosestColor(pal, sel.hex) : null;
        if(m) return m;
      }
      var pop = POPULAR_COLOR[gid];
      var hit = pop && pal.filter(function(c){ return c.id === pop; })[0];
      return hit || pal[0];
    }
    // Для власного виробу з адмінки фото існує лише там, куди менеджер його
    // залив. Стокові кольори завжди мають файл у репозиторії.
    function garmentPhotoExists(gid, cid){
      var g = GARMENTS.filter(function(x){ return x.id === gid; })[0];
      if(!g) return false;
      if(!g.custom) return true;
      return !!(window.PHOTO_OVERRIDES && window.PHOTO_OVERRIDES[gid + '-' + cid + '-front']);
    }
    // Колір мініатюри: бажаний, а якщо для нього фото ще не залито — перший
    // із тих, у якого воно є. Інакше картка лишалась порожньою.
    function garmentThumbColor(gid){
      var c = displayColorFor(gid);
      if(c && garmentPhotoExists(gid, c.id)) return c;
      var pal = GARMENT_COLORS[gid] || [];
      for(var i = 0; i < pal.length; i++) if(garmentPhotoExists(gid, pal[i].id)) return pal[i];
      return null;
    }
    function garmentThumbSrc(gid){
      var c = garmentThumbColor(gid);
      return c ? (IMG_BASE + '/images/' + gid + '-' + c.id + '-front.webp') : GARMENT_THUMB[gid];
    }
    // назва виробу для каталогу на головній (в адмінці задається окремо)
    window.LQ_titleFor = function(gid){
      var g = GARMENTS.filter(function(x){ return x.id === gid; })[0];
      return window.LQ_name(gid, g ? g.name : gid);
    };
    // потрібен блоку каталогу на головній, коли обгортку не задано в адмінці
    window.LQ_thumbFor = function(gid){
      try{ return window.LQ_img(garmentThumbSrc(gid) || GARMENT_THUMB[gid] || ''); }
      catch(e){ return GARMENT_THUMB[gid] || ''; }
    };

    // Назва товару з урахуванням крою (для тих, у кого крій уже в назві — без суфікса)
    var NAME_NO_SUFFIX = {teeover:1, tee:1, hoodieover:1, hoodieoverfleece:1, hoodie:1, hoodiezip:1, sweat:1, cap:1, tote:1, kitel:1, apron:1};
    function productName(){ var g = getGarment(); return window.LQ_name(g.id, g.name) + (NAME_NO_SUFFIX[g.id] ? '' : ' оверсайз'); }
    // Фото моделей по крою: /images/<src>.webp + позиції логотипа на грудях (% фото)
    // cx,cy — центр грудей (% фото); sw — ширина виробу на фото (% фото), щоб дзеркалити зсув/розмір лого з мокапа
    var MODEL_PHOTOS = {
      teeover: [
        {src:'model-pair-front', logos:[{cx:33,cy:50,sw:20},{cx:60,cy:54,sw:18}]},
        {src:'model-man', logos:[{cx:50,cy:49,sw:34}]},
        {src:'model-woman', logos:[{cx:47,cy:55,sw:30}]},
        {src:'model-pair-back', logos:[{cx:33,cy:48,sw:20,side:'back'},{cx:58,cy:52,sw:18,side:'back'}]}
      ],
      tee: [
        {src:'model-tee-pair-front', logos:[{cx:27,cy:50,sw:18},{cx:63,cy:48,sw:20}]},
        {src:'model-tee-man', logos:[{cx:50,cy:50,sw:30}]},
        {src:'model-tee-woman', logos:[{cx:50,cy:52,sw:28}]},
        {src:'model-tee-pair-back', logos:[{cx:30,cy:50,sw:18,side:'back'},{cx:63,cy:46,sw:20,side:'back'}]}
      ],
      hoodieover: [
        {src:'model-hoodieover-pair-front', logos:[{cx:30,cy:44,sw:20},{cx:63,cy:48,sw:18}]},
        {src:'model-hoodieover-man', logos:[{cx:50,cy:44,sw:32}]},
        {src:'model-hoodieover-woman', logos:[{cx:48,cy:47,sw:28}]},
        {src:'model-hoodieover-pair-back', logos:[{cx:33,cy:42,sw:20,side:'back'},{cx:63,cy:46,sw:18,side:'back'}]}
      ],
      hoodie: [
        {src:'model-hoodie-pair-front', logos:[{cx:30,cy:46,sw:20},{cx:63,cy:49,sw:18}]},
        {src:'model-hoodie-man', logos:[{cx:50,cy:45,sw:32}]},
        {src:'model-hoodie-woman', logos:[{cx:48,cy:47,sw:28}]},
        {src:'model-hoodie-pair-back', logos:[{cx:33,cy:44,sw:20,side:'back'},{cx:62,cy:47,sw:18,side:'back'}]}
      ]
    };
    // Порядок тут задає і порядок кнопок у перемикачі, і спосіб за замовчуванням:
    // getPrint() бере PRINTS[0], поки клієнт не обрав сам. Вишивка перша й типова.
    var PRINTS = [
      {id:'embro', name:'Вишивка', desc:"Преміум вигляд та об'ємна фактура", price:120,
        icon:'<circle cx="17" cy="7" r="2"/><path d="M15.5 8.5L9 15M5 19s0-4 4-4"/>'},
      {id:'dtf', name:'DTF принт', desc:'Яскраві кольори та складні дизайни', price:0,
        icon:'<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7V4h12v3"/><circle cx="18" cy="12" r="1" fill="currentColor"/><path d="M6 17v3h12v-3"/>'}
    ];
    var SIZES = ['XS','S','M','L','XL','XXL'];
    // Деякі вироби мають єдиний розмір (напр. кепка) — тоді замість сітки XS–XXL
    // показуємо один «One Size» і просто обираємо кількість.
    var GARMENT_SIZES = { cap: ['One Size'] };
    /* Розміри беремо з розмірної сітки товару. Це та сама таблиця, яку
       менеджер редагує в адмінці: якщо він завів 40–66 чи «One Size», то
       саме їх людина й обирає. Раніше список був зашитий XS–XXL, і сітка
       казала одне, а вибір розміру — інше.
       Порядок: сітка товару → окремий перелік для виробу → загальний. */
    function chartSizes(gid){
      var custom = window.SITE_CONTENT.sizecharts && window.SITE_CONTENT.sizecharts[gid];
      var src = (custom && custom.length && !isGenericChart(custom)) ? custom
              : (GARMENT_SIZES[gid] ? null : DEFAULT_GARMENT_CHARTS[gid]);
      var list = (src || []).map(function(r){ return String(r.size || '').trim(); })
                            .filter(Boolean);
      // Дублікати ламали б лічильники: два рядки «M» — це один розмір
      var seen = {}, out = [];
      list.forEach(function(x){ if(!seen[x]){ seen[x] = 1; out.push(x); } });
      return out.length ? out : null;
    }
    var NO_SIZE = 'Без розміру';
    /* Менеджер часто складає пропозицію ще до того, як клієнт назвав
       розкладку: важливі кількість і ціна, а розміри будуть потім. Доти
       доводилось вигадувати їх — і замовлення їхало у виробництво з чужою
       розкладкою. Тому в менеджерському режимі є ще один рядок: «Без
       розміру». Рахується він як звичайний розмір, тож ні тираж, ні знижка,
       ні ціна від цього не міняються. Клієнтові його не показуємо. */
    function isMgrMode(){
      return /[?&]manager=1\b/.test(location.search) || !!window.__lqInline;
    }
    function getSizes(){
      var base = chartSizes(pm.garmentId) || GARMENT_SIZES[pm.garmentId] || SIZES;
      var out = base.slice();
      if(isMgrMode() && base.length > 1 && base.indexOf(NO_SIZE) === -1) out.push(NO_SIZE);
      /* Розмір, у який уже вписано кількість, показуємо завжди — навіть якщо
         сітка виробу його не містить. Інакше вибір «зникав» на очах: сітка
         перемальовується, «Без розміру» в ній цього разу немає, а кількість
         лишилась — і конструктор просив обрати те, що вже обрано. */
      Object.keys(pm.qty || {}).forEach(function(k){
        if((pm.qty[k] || 0) > 0 && out.indexOf(k) === -1) out.push(k);
      });
      return out;
    }
    function isOneSize(){ var s = getSizes(); return s.length === 1; }
    var SIZE_CHART = {XS:{A:64,B:47}, S:{A:66,B:50}, M:{A:68,B:53}, L:{A:72,B:56}, XL:{A:74,B:60}, XXL:{A:77,B:62}};
    // Реальні розмірні сітки виробників (A — довжина, B — ширина, см)
    var DEFAULT_GARMENT_CHARTS = {
      tee: [
        {size:'XS',A:68,B:46},{size:'S',A:69,B:50},{size:'M',A:71,B:53},
        {size:'L',A:73,B:56},{size:'XL',A:75,B:59},{size:'2XL',A:77,B:62},
        {size:'3XL',A:79,B:65},{size:'4XL',A:82,B:68},{size:'5XL',A:88,B:71}
      ],
      hoodie: [
        {size:'XS',A:64,B:49},{size:'S',A:67,B:51},{size:'M',A:70,B:56},
        {size:'L',A:73,B:61},{size:'XL',A:76,B:65},{size:'XXL',A:79,B:69},
        {size:'XXXL',A:82,B:73}
      ],
      teeover: [
        {size:'S',A:66,B:50},{size:'M',A:68,B:53},{size:'L',A:72,B:56},
        {size:'XL',A:74,B:60},{size:'2XL',A:77,B:62}
      ],
      hoodieover: [
        {size:'S',A:70,B:64},{size:'M',A:71.5,B:66.5},{size:'L',A:74,B:68.5},
        {size:'XL',A:76,B:71}
      ],
      sweat: [
        {size:'XS',A:67,B:50},{size:'S',A:68,B:52},{size:'M',A:71,B:56},
        {size:'L',A:74,B:60},{size:'XL',A:77,B:64},{size:'XXL',A:80,B:68},
        {size:'3XL',A:83,B:72}
      ]
    };
    // Сітка, збережена в адмінці як точна копія старого стандарту = не кастомізована
    var GENERIC_CHART = [[64,47],[66,50],[68,53],[72,56],[74,60],[77,62]];
    function isGenericChart(rows){
      if(!rows || rows.length !== 6) return false;
      for(var i = 0; i < 6; i++){
        if(+rows[i].A !== GENERIC_CHART[i][0] || +rows[i].B !== GENERIC_CHART[i][1]) return false;
      }
      return true;
    }
    function effectiveChart(gid){
      var custom = window.SITE_CONTENT.sizecharts[gid];
      if(custom && custom.length && !isGenericChart(custom)) return custom;
      return DEFAULT_GARMENT_CHARTS[gid] || null;
    }
    var TIERS = [
      {min:1,max:2,price:540,label:'1-2 шт',badge:null},
      {min:3,max:9,price:460,label:'3-9 шт',badge:'-15%'},
      {min:10,max:29,price:440,label:'10-29 шт',badge:'-19%'},
      {min:30,max:49,price:420,label:'30-49 шт',badge:'-23%'},
      {min:50,max:99,price:390,label:'50-99 шт',badge:'-27%'},
      {min:100,max:199,price:370,label:'100-199 шт',badge:'-31%'},
      {min:200,max:99999,price:350,label:'200+ шт',badge:'-35%'}
    ];
    // Три кроки замість пʼяти: що наносимо → на що → скільки. Спосіб нанесення
    // живе біля логотипа, колір — біля крою: це не окремі рішення.
    var TABS = [
      {id:'photo',label:'Дизайн'},{id:'garment',label:'Товар'},{id:'size',label:'Розмір і кількість'}
    ];

    var pm = {
      tab:'photo', garmentId:'teeover', colorId:'black', printId:null, side:'front',
      colorPicked:false,   // чи клієнт уже сам обирав колір
      qty:{},   // розміри залежать від сітки товару, тож наперед не перелічуємо
      logos:{front:[], back:[], left:[], right:[]}, activeLogoId:null
    };
    // Додаткові ракурси (сторони) для деяких виробів — теж можна наносити лого
    var GARMENT_ANGLES = { cap:['left','right'] };
    /* Додаткові ракурси заводить менеджер в адмінці (Товари → Фото товару):
       рукав, бік, козирок — що завгодно. Показуємо лише ті, для яких є фото
       саме цього кольору: порожня вкладка «Лівий рукав» гірша за її
       відсутність. Перед і зад лишаються завжди — це каркас конструктора. */
    function adminSides(gid){
      var list = ((window.SITE_CONTENT && window.SITE_CONTENT.sides) || {})[gid];
      return Array.isArray(list) ? list : [];
    }
    function extraViews(gid, colorId){
      return adminSides(gid)
        .filter(function(s){ return s && s.id && s.id !== 'front' && s.id !== 'back'; })
        .filter(function(s){
          return !!(window.PHOTO_OVERRIDES || {})[gid + '-' + colorId + '-' + s.id];
        })
        .map(function(s){ return s.id; });
    }
    // Підпис ракурсу: спершу той, що задав менеджер, потім стандартний
    function sideLabelOf(gid, id){
      var f = adminSides(gid).filter(function(s){ return s && s.id === id; })[0];
      if(f && f.label) return f.label;
      return { front:'Перед', back:'Спина', left:'Лівий бік', right:'Правий бік' }[id] || id;
    }
    window.__sideLabel = sideLabelOf;
    function getViews(){
      var saved = adminSides(pm.garmentId);
      var base;
      if(saved.length){
        /* Склад ракурсів задав менеджер — поважаємо його цілком: і те, що
           додав, і те, що прибрав. Доти перед і зад були вшиті намертво, і
           товар з одним фото — шапка, плед, кружка — все одно показував
           порожню вкладку «Спина». Перед лишається завжди: без жодного
           ракурсу товару не існує. */
        base = saved.map(function(s){ return s && s.id; }).filter(Boolean);
        if(base.indexOf('front') < 0) base.unshift('front');
        // Додаткові показуємо лише коли для них є фото саме цього кольору —
        // порожня вкладка «Лівий рукав» гірша за її відсутність
        base = base.filter(function(v){
          return v === 'front' || v === 'back' ||
                 !!(window.PHOTO_OVERRIDES || {})[pm.garmentId + '-' + pm.colorId + '-' + v];
        });
      } else {
        base = ['front','back'].concat(GARMENT_ANGLES[pm.garmentId] || [])
               .concat(extraViews(pm.garmentId, pm.colorId));
      }
      // порядок фото, заданий перетягуванням в адмінці (viewOrder)
      var order = ((window.SITE_CONTENT.viewOrder || {})[pm.garmentId]) || [];
      var known = order.filter(function(v){ return base.indexOf(v) !== -1; });
      return known.concat(base.filter(function(v){ return known.indexOf(v) === -1; }));
    }

    // ---- Власні товари з адмінки (SITE_CONTENT.products) ----
    var BASE_GARMENTS = GARMENTS.slice();
    var CUSTOM_GARMENT_PATH = 'M20 26L5 46h18v44h54V46h18L80 26Q72 16 62 14L54 22 50 16 46 22 38 14Q28 16 20 26z';
    function applyCustomProducts(){
      var prod = window.SITE_CONTENT.products || {};
      var hidden = prod.hidden || [];
      var custom = prod.custom || [];
      // прибираємо старі кастомні записи і додаємо актуальні
      GARMENTS = BASE_GARMENTS.filter(function(g){ return hidden.indexOf(g.id) === -1; });
      custom.forEach(function(c){
        if(hidden.indexOf(c.id) !== -1) return;
        GARMENTS.push({id:c.id, name:c.name, price:(+c.surcharge||0), path:CUSTOM_GARMENT_PATH, custom:true});
        GARMENT_COLORS[c.id] = (c.colors||[]).map(function(col){ return {id:col.id, name:col.name, hex:col.hex}; });
        NAME_NO_SUFFIX[c.id] = 1;
        // Мініатюра — лише якщо фото вже завантажене
        var c0 = (c.colors && c.colors[0]) ? c.colors[0].id : null;
        if(c0 && window.PHOTO_OVERRIDES[c.id+'-'+c0+'-front']) GARMENT_THUMB[c.id] = '/images/'+c.id+'-'+c0+'-front.webp';
        else delete GARMENT_THUMB[c.id];
      });
      // Кольори, додані/прибрані в адмінці (перекривають стандартні для будь-якого товару)
      var pcols = window.SITE_CONTENT.productColors || {};
      Object.keys(pcols).forEach(function(id){
        var list = pcols[id];
        if(Array.isArray(list) && list.length){
          GARMENT_COLORS[id] = list.map(function(col){ return {id:col.id, name:col.name, hex:col.hex}; });
        }
      });
      // Каталог — єдине джерело правди. У конструкторі показуємо рівно ті вироби
      // і в тому ж порядку, що й у каталозі: інакше в «Одязі» спливали позиції,
      // яких у продажу немає, а порядок не збігався з тим, що налаштовано в адмінці.
      try{
        var catIds = (window.LQ_catalogList ? window.LQ_catalogList() : [])
          .map(function(p){ return p.garment; });
        if(catIds.length){
          var byId = {};
          GARMENTS.forEach(function(g){ byId[g.id] = g; });
          var ordered = [];
          catIds.forEach(function(id){ if(byId[id]) ordered.push(byId[id]); });
          if(ordered.length) GARMENTS = ordered;
        }
      }catch(e){}
      if(!GARMENTS.length) GARMENTS = BASE_GARMENTS.slice();
    }
    applyCustomProducts();
    function ensureLogoSides(){ getViews().forEach(function(v){ if(!pm.logos[v]) pm.logos[v] = []; }); }

    function getGarment(){ return GARMENTS.find(function(g){return g.id===pm.garmentId;}) || GARMENTS[0]; }
    function getColor(){ var cs = getColors(); return cs.find(function(c){return c.id===pm.colorId;}) || cs[0]; }
    function getPrint(){ return PRINTS.find(function(p){return p.id===pm.printId;}) || PRINTS[0]; }
    /* Рахуємо ВСІ вписані кількості, а не лише ті розміри, що зараз у сітці.
       Інакше «Без розміру» зникало з підрахунку щоразу, коли сітка ще не
       встигла його включити: конструктор казав «оберіть розмір і кількість»
       над уже заповненою кількістю. */
    function totalUnits(){
      var q = pm.qty || {}, n = 0;
      Object.keys(q).forEach(function(k){ n += +q[k] || 0; });
      return n;
    }
    function activeTier(){
      var u = totalUnits();
      if(u===0) return TIERS[0];
      for(var i=TIERS.length-1;i>=0;i--){ if(u>=TIERS[i].min) return TIERS[i]; }
      return TIERS[0];
    }
    // Габарити НЕПРОЗОРОГО вмісту лого в мм (без прозорих полів) — саме це друкується/
    // вишивається. Прозорі поля не рахуються ні в лист DTF, ні в розмір друку.
    function layerOpaqueDimsMm(l){
      var d = layerDimsMm(l);
      var ob = l.opaqueBox || {x0:0,y0:0,x1:1,y1:1};
      var fw = Math.max(0, (ob.x1 - ob.x0)) || 1, fh = Math.max(0, (ob.y1 - ob.y0)) || 1;
      return { w: d.w * fw, h: d.h * fh };
    }
    // Ширина друку у см — з непрозорого вмісту (те, за що клієнт реально платить).
    function logoWidthCm(layer){
      if(sitePricing()){ var d = layerOpaqueDimsMm(layer); if(d && d.w>0) return Math.round(d.w/10); }
      return Math.round(layer.scale * 15);   // фолбек для старої моделі
    }
    function activeLogoWidthCm(){
      var l = currentLayers().find(function(x){return x.id===pm.activeLogoId;}) || currentLayers()[0];
      return l ? logoWidthCm(l) : 0;
    }
    // Розмір друку W×H см (з тієї ж геометрії, що й ціна) — щоб було зрозуміло, за яку площу платимо
    function activeLogoSizeLabel(){
      var l = currentLayers().find(function(x){return x.id===pm.activeLogoId;}) || currentLayers()[0];
      if(!l) return '';
      if(sitePricing()){ var d = layerOpaqueDimsMm(l); if(d && d.w>0) return 'Розмір друку ≈ ' + Math.round(d.w/10) + ' × ' + Math.round(d.h/10) + ' см'; }
      return 'Ширина друку ≈ ' + logoWidthCm(l) + ' см';
    }
    // Надбавка за розмір друку: ~25 см ширини ≈ +550 грн (рахуємо всі шари, фронт+бек)
    function logoSurcharge(){
      var total = 0;
      getViews().forEach(function(side){
        (pm.logos[side]||[]).forEach(function(l){ total += Math.round(logoWidthCm(l) * 22 / 5) * 5; });
      });
      return total;
    }
    /* ===== Нова модель прорахунку (від площі дизайну; налаштовується в адмінці) =====
       ціна_за_од = round( (базова_ціна_виробу + Σ нанесень) × коеф_знижки_за_кількість )
       нанесення (кожне розміщення окремо) = max( ставка_грн_мм² × площа_мм² × fill_ratio, мін_ціна ) */
    function sitePricing(){
      var p = window.SITE_CONTENT && window.SITE_CONTENT.pricing;
      // Модель тепер завжди одна (перемикача «увімкнути» більше немає).
      return (p && p.methods) ? p : null;
    }
    // Оплати поточного методу: за штуку (в ціну/шт) і за замовлення (в підсумок).
    // Оплата за дизайн і за штуку — це оплата за НАНЕСЕННЯ. Без лого (дизайну немає) не беремо.
    function hasAnyLogo(){ return logoCount() > 0; }
    // Унікальні дизайни: те саме зображення (на кількох сторонах чи завантажене двічі) — один дизайн.
    // Ключ — origUrl (оригінальний завантажений файл), стабільний і при перемиканні фону.
    function uniqueDesignCount(){
      var seen = {}, n = 0;
      getViews().forEach(function(side){ (pm.logos[side] || []).forEach(function(l){
        var key = l.origUrl || l.url || '';
        if(key && !seen[key]){ seen[key] = 1; n++; }
      }); });
      return n;
    }
    // Кожен ДОДАТКОВИЙ унікальний дизайн (2-й, 3-й…) — окремий ескіз (перший входить в основну оплату).
    // Однакові зображення не рахуються повторно.
    function extraSketchCount(){ return Math.max(0, uniqueDesignCount() - 1); }
    function methodPieceFee(){ if(!hasAnyLogo()) return 0; var m = methodCfgNew(); return m ? (+m.pieceFee || 0) : 0; }
    // Разова оплата за замовлення = основний дизайн + додаткові ескізи (за кожне зайве лого).
    function methodOrderFee(){
      if(!hasAnyLogo()) return 0;
      var m = methodCfgNew(); if(!m) return 0;
      var ks = feeKindsHere(); if(!ks.length) return 0;
      var sum = 0;
      ks.forEach(function(k){ sum += (+methodCfgKind(m, k === 'txt').orderFee || 0); });
      var one = methodCfgKind(m, ks.length === 1 && ks[0] === 'txt');
      return sum + extraSketchCount() * (+one.sketchFee || 0);
    }
    // ── Собівартість (лише для менеджерського прорахунку) ──
    function methodPieceCost(){ if(!hasAnyLogo()) return 0; var m = methodCfgNew(); return m ? (+m.pieceCost || 0) : 0; }
    /* Які види дизайнів зараз на виробі: напис, картинка чи обидва.
       Разові оплати задані ОКРЕМО для написів і для картинок — підготовка
       напису дешевша, — і рушій цін це враховує. Тут раніше не враховувалось:
       за звичайний текст рахувалась разова як за логотип. */
    function feeKindsHere(){
      var out = {};
      getViews().forEach(function(s){
        (pm.logos[s] || []).forEach(function(l){ out[isTextLayer(l) ? 'txt' : 'img'] = 1; });
      });
      return Object.keys(out);
    }
    function methodOrderCost(){
      if(!hasAnyLogo()) return 0;
      var m = methodCfgNew(); if(!m) return 0;
      var ks = feeKindsHere(); if(!ks.length) return 0;
      var sum = 0;
      ks.forEach(function(k){ sum += (+methodCfgKind(m, k === 'txt').orderCost || 0); });
      // Додатковий ескіз рахуємо за ставкою того ж виду, що й сам дизайн
      var one = methodCfgKind(m, ks.length === 1 && ks[0] === 'txt');
      return sum + extraSketchCount() * (+one.sketchCost || 0);
    }
    function garmentCost(){ var pc = (window.SITE_CONTENT && window.SITE_CONTENT.products && window.SITE_CONTENT.products.cost) || {}; return +pc[pm.garmentId] || 0; }
    // собівартість нанесення одного лого: DTF — з таблиці собівартості; вишивка — площа × costPer1000mm2
    // У сітці мінімалок немає: таблиця вже задає всі розміри й тиражі поіменно.
    function dtfGridCost(m, l, uOverride){
      var col = dtfBandCol(m, l); var qf = m.qtyFrom || [];
      var u = Math.max(1, (uOverride != null ? uOverride : totalUnits()));
      var row = 0; for(var j = qf.length-1; j >= 0; j--){ if(u >= qf[j]){ row = j; break; } }
      var c = (m.cost && m.cost[row] && m.cost[row][col] != null) ? +m.cost[row][col] : 0;
      return Math.round(c);
    }
    function placementCost(m, l, idx){ var cleanMm2 = layerInkMm2(l); return Math.max(Math.round(areaSum(m, cleanMm2, true)), minCostForIndex(m, idx || 0)); }
    /* ═══════════ Порядок нанесень для мінімалок ═══════════
       Мінімальна ціна задана списком: перше нанесення 200, друге 150, далі
       менше. «Перше» раніше означало «те, що лежить на передній стороні» —
       і дорога мінімалка могла впасти на маленький значок на грудях, а великий
       друк на спині брав дешеву. Виходило, що ціна залежала від того, в якому
       порядку менеджер клікав.

       Тепер номер дає РОЗМІР: найбільше нанесення отримує найдорожчу мінімалку,
       наступні за ним — дешевші. Так дорога підлога завжди страхує ту роботу,
       якої більше, а не випадкову. Для DTF розмір визначає лист, а не чиста
       площа: два однакові за площею макети можуть лягти на різні листи. */
    function orderedLayers(){
      var m = methodCfgNew() || {};
      var grid = m.mode === 'grid';
      var out = [];
      getViews().forEach(function(side){
        (pm.logos[side] || []).forEach(function(l){
          out.push({ side: side, l: l,
            band: grid ? dtfBandCol(m, l) : 0,
            mm2: layerInkMm2(l) });
        });
      });
      out.sort(function(a, b){ return (b.band - a.band) || (b.mm2 - a.mm2); });
      out.forEach(function(x, i){ x.idx = i; });
      return out;
    }
    function applicationCostSum(uOverride){
      var m = methodCfgNew(); if(!m) return 0; var c = 0;
      orderedLayers().forEach(function(x){
        c += (m.mode === 'grid') ? dtfGridCost(m, x.l, uOverride) : placementCost(m, x.l, x.idx);
      });
      return c;
    }
    // «Сира» продажна ціна нанесення — ДО застосування мінімалки (за площею / за сіткою DTF).
    function placementRaw(m, l){ var cleanMm2 = layerInkMm2(l); return Math.round(areaSum(m, cleanMm2, false)); }
    function dtfGridRaw(m, l, uOverride){
      var col = dtfBandCol(m, l); var qf = m.qtyFrom || [];
      var u = Math.max(1, (uOverride != null ? uOverride : totalUnits()));
      var row = 0; for(var j = qf.length-1; j >= 0; j--){ if(u >= qf[j]){ row = j; break; } }
      return (m.price && m.price[row] && m.price[row][col] != null) ? +m.price[row][col]
           : ((m.cost && m.cost[row] && m.cost[row][col] != null) ? Math.round(+m.cost[row][col] * (+m.markup || 1)) : 0);
    }
    function applicationRawSum(uOverride){
      var m = methodCfgNew(); if(!m) return 0; var s = 0;
      getViews().forEach(function(side){ (pm.logos[side] || []).forEach(function(l){
        s += (m.mode === 'grid') ? dtfGridRaw(m, l, uOverride) : placementRaw(m, l);
      }); });
      return s;
    }
    function logoCount(){ var n = 0; getViews().forEach(function(side){ n += (pm.logos[side] || []).length; }); return n; }
    // собівартість за штуку = одяг + нанесення + оплата за штуку
    function unitCost(){ return garmentCost() + applicationCostSum() + methodPieceCost(); }
    /* Собівартість позиції = собівартість за штуку × тираж, і разова
       собівартість макета входить у неї ЧАСТКОЮ — рівно так само, як разова
       оплата входить у ціну. Доти сюди додавалась уся разова цілком, хоч
       вона ділиться на всі вироби свого способу в замовленні. Тому рядок
       «Ціна за штуку» в прорахунку не сходився з «Сумою собівартості», а в
       замовленні позиція виглядала дорожчою, ніж є. */
    function unitCostShare(qty){
      var sd = (typeof sharedDraftParts === 'function') ? sharedDraftParts(qty) : null;
      if(sd && sd.parts && sd.parts.costShare != null) return +sd.parts.costShare || 0;
      return qty > 0 ? Math.round(methodOrderCost() / qty) : 0;   // рушій недоступний
    }
    function unitCostFull(){
      var u = totalUnits();
      return unitCost() + unitCostShare(u > 0 ? u : 1);
    }
    function orderCostTotal(){
      var u = totalUnits();
      return u > 0 ? Math.round(unitCostFull() * u) : 0;
    }
    // Повна вартість замовлення = ціна/шт × кількість + разова оплата за замовлення.
    function orderTotal(){
      var u = totalUnits();
      if(u <= 0) return 0;
      var sh = sharedUnitPrice(u);
      // Разові оплати вже враховані в ціні за штуку — окремо не додаємо
      return sh != null ? sh * u : (unitPrice() * u + methodOrderFee());
    }
    function pricingTiers(){
      var p = sitePricing();
      if(!p) return null;
      // Пороги знижок належать способу нанесення: у друку свої, у вишивки свої.
      // Якщо для способу їх не задано — беремо старе спільне поле.
      var m = methodCfgNew();
      var list = (m && m.tiers && m.tiers.length) ? m.tiers : p.tiers;
      if(!list || !list.length) return null;
      return list.map(function(t){
        var from = +t.from || 1, to = (t.to == null || t.to === '' ) ? null : +t.to;
        var coef = +t.coef || 1;
        return {min:from, max:(to==null?99999:to), coef:coef,
          label: from + (to ? ('-'+to) : '+') + ' шт',
          badge: coef < 1 ? ('-'+Math.round((1-coef)*100)+'%') : null};
      });
    }
    function activeCoefTier(){
      var pt = pricingTiers(); if(!pt) return null;
      var u = totalUnits();
      if(u === 0) return pt[0];
      for(var i = pt.length-1; i >= 0; i--){ if(u >= pt[i].min) return pt[i]; }
      return pt[0];
    }
    function garmentHeightMm(){
      var p = sitePricing(); var gh = (p && p.heights) || {};
      // 1) явне значення з адмінки для цього товару
      if(+gh[pm.garmentId] > 0) return +gh[pm.garmentId];
      // 2) з розмірної сітки товару: рядок «M» (або середній), колонка A «довжина», см → мм
      var rows = effectiveChart(pm.garmentId);
      if(rows && rows.length){
        var m = null;
        for(var i = 0; i < rows.length; i++){
          if(String(rows[i].size).trim().toUpperCase() === 'M'){ m = rows[i]; break; }
        }
        if(!m) m = rows[Math.floor(rows.length/2)];
        if(m && +m.A > 0) return +m.A * 10;
      }
      // 3) малі вироби (без «довжини футболки»)
      if(pm.garmentId === 'cap') return 180;
      if(pm.garmentId === 'tote') return 400;
      // 4) дефолт з адмінки
      if(+gh.default > 0) return +gh.default;
      // 5) стандартна сітка сайту: розмір M, довжина A = 68 см
      return (SIZE_CHART.M && SIZE_CHART.M.A) ? SIZE_CHART.M.A * 10 : 680;
    }
    function basePriceNew(){
      return baseForGarment(pm.garmentId);
    }
    // Базова ціна конкретного виробу (не залежить від поточного вибору) — для каталогу.
    function baseForGarment(gid){
      var p = sitePricing(); var bp = (p && p.basePrices) || {};
      var v = +bp[gid]; if(v > 0) return v;
      var g = GARMENTS.find(function(x){ return x.id === gid; });
      return TIERS[0].price + (g ? g.price : 0);   // фолбек — стара базова
    }
    // Ціна «від X» для каталогу — рахуємо ТІЄЮ Ж функцією, що й у конструкторі (без нанесення),
    // щоб збігалось цифра-в-цифру. Найдешевша ціна за макс. знижкою автоматично береться з
    // порогів адмінки (жодних зашитих коефіцієнтів). Тимчасово підставляємо виріб і порожні лого.
    window.__catalogPrice = function(gid){
      var sg = pm.garmentId, sl = pm.logos, sp = pm.printId;
      try{
        pm.garmentId = gid; pm.printId = null;   // дефолтний метод (як при відкритті товару)
        pm.logos = { front:[], back:[], left:[], right:[] };
        return cheapestUnitPrice();               // = «від X» у конструкторі при 0 лого
      } catch(e){ return null; }
      finally { pm.garmentId = sg; pm.logos = sl; pm.printId = sp; }
    };
    function methodCfgNew(){
      var p = sitePricing(); if(!p) return null;
      var key = getPrint().id === 'embro' ? 'embro' : 'dtf';
      return (p.methods || {})[key] || null;
    }
    // Масштаб поля нанесення: скільки мм відповідає 1.0 частки контейнера,
    // за калібруванням зони (heightCm + лінії калібрування). Прив'язує площу лого
    // до реального поля: на кепці поле мале → мало мм², на худі велике → більше.
    /* Масштаб «міліметри на одну частку контейнера» рахується з фото виробу:
       його пропорцій і калібрування зони друку. Поки фото не завантажилось,
       раніше бралась зовсім інша формула — просто висота виробу, — і це
       давало інший розмір друку, а отже й іншу ціну, на ті самі секунди
       завантаження. Тепер памʼятаємо порахований масштаб для кожного виробу
       й ракурсу, і на час завантаження беремо його, а не іншу формулу. */
    var ZONE_MM_CACHE = {};
    function zoneCacheKey(){ return pm.garmentId + '|' + pm.side + '|' + (pm.printId || ''); }
    function zoneScaleMmPerFrac(){
      if(typeof currentPrintCfg !== 'function') return null;
      var cfg = currentPrintCfg(); if(!cfg) return null;
      if(!pmGarmentPhoto || pmGarmentPhoto.style.display === 'none'
         || !(pmGarmentPhoto.naturalWidth > 0)){
        return ZONE_MM_CACHE[zoneCacheKey()] != null ? ZONE_MM_CACHE[zoneCacheKey()] : null;
      }
      var natW = pmGarmentPhoto.naturalWidth, natH = pmGarmentPhoto.naturalHeight;
      if(!(natW>0) || !(natH>0)) return null;
      var pa = ((window.SITE_CONTENT||{}).printAreas || {})[pm.garmentId] || {};
      var heightCm = (+pa.heightCm > 0) ? +pa.heightCm : (garmentHeightMm()/10);
      var arImg = natW/natH, rh = (arImg >= 1) ? 1/arImg : 1;   // висота фото як частка квадратного контейнера
      var calT = cfg.calibTop!=null?cfg.calibTop:0.06, calB = cfg.calibBottom!=null?cfg.calibBottom:0.96;
      var ch = (calB - calT) * rh;   // калібрована висота як частка контейнера
      if(!(ch > 0)) return null;
      var mmPerFrac = (heightCm * 10) / ch;   // мм на 1.0 частки контейнера
      ZONE_MM_CACHE[zoneCacheKey()] = mmPerFrac;
      return mmPerFrac;
    }
    /* Пряма дорога з конструктора в наявне замовлення — без кошика й без
       модалки контактів: контакти вже відомі з картки, а «оформлення» тут
       нічого не оформлює, позиція просто дописується в те саме замовлення.

       Живе тут, а не на сторінці, бо конструктор тепер відкривається у двох
       місцях — на сайті й у пропозиції, — і місток має бути один. Пакування
       макетів у хмару робить адмінка: сюди приходить лише сама позиція. */
    function ccTargetOrder(){
      try{ var h = window.__lqAdminHost && window.__lqAdminHost();
           return (h && h.__adminOfferTarget) || null; }
      catch(e){ return null; }   // інший домен — просто немає привʼязки
    }
    window.__lqSendToOrder = function(){
      var tgt = ccTargetOrder();
      if(!tgt || !tgt.id) return Promise.resolve(false);
      var all = (typeof cartItems !== 'undefined' && cartItems) ? cartItems : [];
      /* У кошику лежить усе замовлення — воно потрібне, щоб ціна рахувалась
         від сумарного тиражу, а не від однієї позиції. Але зберігаємо саме
         ту, яку правили: решта в замовленні вже є, і надіслати їх ще раз
         означало б задублювати склад. */
      var only = window.__lqEditOnly;
      var items = (only != null && all[only]) ? [all[only]] : all;
      if(!items.length) return Promise.resolve(false);
      var _h = window.__lqAdminHost && window.__lqAdminHost();
      var saver = (_h && _h.__adminSaveClientOrder) || window.__adminSaveClientOrder;
      if(typeof saver !== 'function'){
        alert('Позицію можна додати лише з адмінки.');
        return Promise.resolve(false);
      }
      var payload = { instagram: tgt.instagram || '', name: tgt.name || '',
                      company: tgt.company || '', phone: tgt.phone || '', dueAt: '',
                      items: JSON.parse(JSON.stringify(items)), targetId: tgt.id };
      if(tgt.replaceIndex != null) payload.replaceIndex = tgt.replaceIndex;
      window.__cartSaving = true;
      return Promise.resolve()
        .then(function(){ return saver(payload); })
        .then(function(){
          /* Чистимо лише після підтвердженого запису — інакше позиція зникає
             з очей, а в базі її немає. У пропозиції кошика немає взагалі,
             тому і renderCart, і вікно кошика тут необовʼязкові. */
          /* Кошик не чистимо, коли правимо одну позицію в пропозиції: там він
             не кошик, а вміст замовлення, і без нього ціна наступної позиції
             порахувалась би як для самотньої. */
          if(only == null) all.length = 0;
          try{ if(typeof renderCart === 'function') renderCart(); }catch(e){}
          try{ document.getElementById('cartModal').classList.remove('open'); }catch(e){}
          return true;
        })
        .catch(function(e){
          alert('Не додано в замовлення: ' + ((e && (e.code || e.message)) || 'невідома помилка') +
                '\n\nПозиція нікуди не поділась — перевірте звʼязок і спробуйте ще раз.');
          try{ if(typeof cartModalCtrl !== 'undefined' && cartModalCtrl) cartModalCtrl.open(); }catch(e2){}
          return false;
        })
        .then(function(ok){ window.__cartSaving = false; return ok; });
    };
    /* Перевірка масштабу нанесення з консолі. Ціна рахується від міліметрів,
       міліметри — від висоти виробу й калібрування зони з адмінки; ширина
       вікна чи картки не має впливати на них узагалі. Один виклик показує
       всі три числа одразу — і видно, чи вони справді не залежать від
       ширини контейнера. */
    /* Стан активного шару однією стрічкою — для перевірки з консолі. Найчастіше
       треба саме відбиток: за ним рушій вирішує, чи це той самий дизайн, а
       отже й чи брати додатковий ескіз. */
    window.__lqLayerInfo = function(){
      var l = findLayerAnySide(pm.activeLogoId) || currentLayers()[0];
      if(!l) return null;
      return { id: l.id, fp: l.fp || '', recolorTo: l.recolorTo || null,
               recolored: !!l.recolorFrom, mm2: Math.round(layerInkMm2(l)) };
    };
    window.__lqPrintScale = function(){
      var pa = ((window.SITE_CONTENT || {}).printAreas || {})[pm.garmentId] || {};
      var cfg = (typeof currentPrintCfg === 'function') ? currentPrintCfg() : null;
      return {
        garment: pm.garmentId,
        heightCm: (+pa.heightCm > 0) ? +pa.heightCm : (garmentHeightMm() / 10),
        calibTop: cfg && cfg.calibTop != null ? cfg.calibTop : 0.06,
        calibBottom: cfg && cfg.calibBottom != null ? cfg.calibBottom : 0.96,
        wrapW: wrapBox().w,
        mmPerFrac: zoneScaleMmPerFrac()
      };
    };
    // Габарити картинки в мм — рівно ті, що видно на екрані. Лого вписується
    // у квадрат 120×scale пікселів: у горизонтального менша висота, у вертикального —
    // менша ширина. Раніше ширина завжди бралася як повна сторона квадрата, тож
    // вертикальні файли рахувались більшими, ніж вони є (площа завищувалась у 1/ar²).
    /* ── Розмір нанесення НЕ залежить від ширини екрана ──────────────────
       Раніше фізичні міліметри рахувались із того, скільки лого займає
       пікселів на екрані: 120 × scale поділити на ширину контейнера. Поки
       конструктор завжди відкривався на всю ширину, це збігалось. Але той
       самий збережений scale у вужчому вікні (наприклад, у колонці збоку від
       пропозиції) давав УДВІЧІ більший друк — і ціна злітала з 1 180 до
       3 949 грн на тій самій позиції.

       Тепер частка ширини виробу зберігається на самому шарі (frac) і є
       єдиним джерелом правди для розміру. Пікселі — лише спосіб намалювати
       її на конкретному екрані. */
    function wrapBox(){
      var el = document.getElementById('pmGarmentWrap');
      return { w: (el && el.clientWidth) || 0, h: (el && el.clientHeight) || 0 };
    }
    function layerFrac(l){
      if(l && +l.frac > 0) return +l.frac;
      var w = wrapBox().w || 300;
      return (120 * ((l && l.scale) || 1)) / w;
    }
    // Запамʼятати поточний стан шару у частках (після додавання чи перетягування)
    function layerSaveFrac(l){
      if(!l) return;
      var b = wrapBox();
      if(!b.w || !b.h) return;
      l.frac = (120 * (l.scale || 1)) / b.w;
      l.fx = (l.x || 0) / b.w;
      l.fy = (l.y || 0) / b.h;
      l.pxAt = b.w;
    }
    // Перевести частки назад у пікселі під поточний розмір контейнера
    function layerApplyFrac(l){
      if(!l || !(+l.frac > 0)) return;
      var b = wrapBox();
      if(!b.w || !b.h || l.pxAt === b.w) return;
      l.scale = Math.max(0.04, Math.min(5, (l.frac * b.w) / 120));
      if(l.fx != null) l.x = l.fx * b.w;
      if(l.fy != null) l.y = l.fy * b.h;
      l.pxAt = b.w;
    }
    function layerDimsMm(l){
      var ar = (l.ar || 1) || 1;
      var frac = layerFrac(l);                       // сторона квадрата як частка контейнера
      var mmPerFrac = zoneScaleMmPerFrac();          // масштаб від поля нанесення (якщо зона задана)
      var szMm = (mmPerFrac != null) ? frac * mmPerFrac : frac * garmentHeightMm();  // фолбек — висота виробу
      return (ar >= 1)
        ? { w: szMm,      h: szMm / ar }
        : { w: szMm * ar, h: szMm };
    }
    function layerAreaMm2(l){ var d = layerDimsMm(l); return d.w * d.h; }
    // Площа, за яку клієнт платить. Береться ГАБАРИТ НЕПРОЗОРОГО вмісту, а не весь
    // прямокутник картинки: прозорі поля навколо лого нічого не коштують. Раніше
    // рахувалось від усього прямокутника, тож один і той самий логотип у файлі
    // з великими полями коштував у рази дорожче, ніж обрізаний упритул.
    // Скільки квадратних міліметрів реально вишивається.
    // fill — частка непрозорих пікселів усередині габариту, тож
    //   габарит(мм²) × fill = сума непрозорих мм².
    // Прозорі поля й порожні середини сюди не входять узагалі.
    function layerInkMm2(l){
      var d = layerOpaqueDimsMm(l);
      return d.w * d.h * (l.fill || 0.85);
    }
    // Ціна одного нанесення від ЧИСТОЇ площі (непрозоре × заповнення) — усе в мм².
    // Головна модель: ціна за 1000 мм². (Підтримка старих полів для сумісності.)
    // Мінімальна ціна нанесення — своя для кожного дизайну (1-й, 2-й, 3-й…). За межами списку — останнє значення.
    function methodMins(m){ if(m && Array.isArray(m.minPrices) && m.minPrices.length) return m.minPrices; if(m && m.minPrice != null) return [+m.minPrice || 0]; return [0]; }
    function minForIndex(m, idx){ var a = methodMins(m); return Math.round(+a[Math.min(idx, a.length-1)] || 0); }

    /* ═══════════ Градація ціни за площею ═══════════
       Ставка за 1000 мм² не одна на будь-який розмір: великий макет має
       виходити дешевшим за квадратний сантиметр, інакше клієнту невигідно
       замовляти більше.

       Шкала СХОДИНКОВА: уся площа рахується ОДНІЄЮ ставкою — тією, у чию
       сходинку ця площа потрапила. Поріг означає «від такої площі і більше
       діє ця ставка».

       Про що треба памʼятати, задаючи пороги: на самому порозі ціна може
       стрибнути ВНИЗ. Скажімо, 9 999 мм² по 3.0 грн/см² — це 300, а 10 000
       по 2.5 — уже 250, і трохи більший макет виходить дешевшим. Це
       властивість сходинкової шкали, а не помилка; щоб такого не було,
       сусідні ставки не мають різнитися сильніше, ніж співвідношення
       сусідніх порогів.

       Порожній список порогів = одна ставка на всю площу.
       Порогів немає й у собівартості, поки їх не задали окремо — тоді
       cost1k просто не змінюється на цьому порозі. */
    function areaTiersOf(m, isCost){
      var a = (m && Array.isArray(m.areaTiers)) ? m.areaTiers : [];
      return a.map(function(t){
          return { from: +t.from || 0, rate: +(isCost ? t.cost1k : t.price1k) };
        })
        /* Ставка 0 у СХОДИНКОВІЙ шкалі означала б «уся площа безкоштовно»,
           щойно вона дотягнулась до порогу. У старій прогресивній шкалі той
           самий нуль читався інакше — «далі не додаємо», — і такі пороги
           лишились у прайсі. Тому нульову ставку пропускаємо: безкоштовну
           сходинку задають відсутністю порога, а не нулем. */
        .filter(function(t){ return t.from > 0 && isFinite(t.rate) && t.rate > 0; })
        .sort(function(a, b){ return a.from - b.from; });
    }
    // Шматки площі зі своїми ставками — щоб розклад для менеджера показував
    // не «площа × ставка», а справжню сходинку.
    function areaParts(m, mm2, isCost){
      mm2 = Math.max(0, +mm2 || 0);
      var rate = +(isCost ? (m || {}).costPer1000mm2 : (m || {}).pricePer1000mm2) || 0;
      var tiers = areaTiersOf(m, isCost);
      // Остання сходинка, до якої площа дотягнулась, і задає ставку на ВСЮ площу
      for(var i = 0; i < tiers.length; i++){
        if(mm2 >= tiers[i].from) rate = tiers[i].rate;
      }
      return [{ mm2: mm2, rate: rate }];
    }
    function areaSum(m, mm2, isCost){
      return areaParts(m, mm2, isCost).reduce(function(s, p){ return s + p.mm2 * p.rate / 1000; }, 0);
    }
    // Мінімальна СОБІВАРТІСТЬ нанесення — своя для кожного дизайну (необов'язкова).
    function minCostForIndex(m, idx){ var a = (m && Array.isArray(m.minCosts)) ? m.minCosts : null; if(!a || !a.length) return 0; return Math.round(+a[Math.min(idx, a.length-1)] || 0); }
    // Стартова ціна вишивки: фіксована сума, з якої нанесення СТАРТУЄ, а вже до
    // неї додається площа. Не плутати з мінімалкою: мінімалка — це підлога
    // (підтягує результат угору), старт — це доданок. Список за дизайнами:
    // перше лого може стартувати з однієї суми, друге з іншої.
    /* ═══════════ Ціни: текст і картинка окремо ═══════════
       Друк однаково лягає на плівку, що текст, що логотип — там відрізняється
       лише підготовка. У вишивці відрізняється й саме виробництво: напис це
       набагато менше стібків на ту саму площу, а програмування напису дешевше
       за програмування картинки.

       Тому текст не має власної повної моделі — він переозначує лише те, що
       справді інше. Порожнє поле означає «як у картинки», тож заповнювати
       треба тільки різницю, а старі прайси працюють без змін. */
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
    function isTextLayer(l){ return !!(l && l.text); }
    function baseForIndex(m, idx){
      var a = (m && Array.isArray(m.basePrices)) ? m.basePrices : null;
      if(!a || !a.length) return 0;
      return Math.round(+a[Math.min(idx, a.length - 1)] || 0);
    }
    // Повертає нанесення по частинах, щоб розклад не доводилось відновлювати
    // відніманням: коли спрацьовує мінімалка, різниця «разом мінус старт» уже
    // не дорівнює площі, і рядок «за площею» показував би неправду.
    function placementDetail(m0, l, idx){
      var m = methodCfgKind(m0, isTextLayer(l));
      var cleanMm2 = layerInkMm2(l);
      var raw;
      if(m.pricePer1000mm2 != null){
        raw = areaSum(m, cleanMm2, false);
      } else if(m.mode === 'stitch'){
        raw = cleanMm2 * (+m.density || 1.6) / 1000 * (+m.pricePer1000 || 0);
      } else {
        raw = (+m.ratePerMm2 || 0) * cleanMm2;
      }
      var area = Math.round(raw), base = baseForIndex(m, idx || 0);
      // Старт + площа, і лише потім підлога: мінімалка страхує знизу весь доданок
      var minAdd = Math.max(0, minForIndex(m, idx || 0) - (area + base));
      return { area: area, base: base, minAdd: minAdd, total: area + base + minAdd };
    }
    function placementPrice(m, l, idx){ return placementDetail(m, l, idx).total; }
    // DTF — собівартість по сітці. Логотип (габаритний прямокутник Ш×В) потрапляє
    // в НАЙМЕНШИЙ лист, у який вписується (з урахуванням повороту), а не за площею.
    // Продажна = собівартість × націнка. Знижка за кількість УЖЕ в сітці.
    function dtfBandCol(m, l){
      var d = layerOpaqueDimsMm(l);       // лист DTF підбираємо під непрозорий вміст, не під прозорі поля
      var lw = d.w / 10, lh = d.h / 10;   // см
      if(m.bands && m.bands.length){
        for(var i = 0; i < m.bands.length; i++){
          var b = m.bands[i], SW = +b.w || 0, SH = +b.h || 0;
          if((lw <= SW && lh <= SH) || (lw <= SH && lh <= SW)) return i;   // влазить (у будь-якому повороті)
        }
        return m.bands.length - 1;   // більше за найбільший лист → остання категорія
      }
      // сумісність зі старим форматом (за площею)
      var areaCm2 = lw * lh, ab = m.areaBands || [];
      for(var k = 0; k < ab.length; k++){ if(areaCm2 <= ab[k]) return k; }
      return Math.max(0, ab.length - 1);
    }
    // Мінімальної ціни в сітці немає навмисно: кожен розмір і кожен тираж уже
    // мають власну клітинку. Мінімалка тут лише підняла б нижні клітинки й
    // зіпсувала знижку за тираж. Вона лишається тільки у вишивці (ціна за площею).
    function dtfGridSell(m, l, uOverride){
      var col = dtfBandCol(m, l);
      var qf = m.qtyFrom || [];
      var u = Math.max(1, (uOverride != null ? uOverride : totalUnits()));
      var row = 0;
      for(var j = qf.length - 1; j >= 0; j--){ if(u >= qf[j]){ row = j; break; } }
      // продажна ціна — з таблиці цін (задається вручну в адмінці), не з націнки
      var sell = (m.price && m.price[row] && m.price[row][col] != null) ? +m.price[row][col]
               : ((m.cost && m.cost[row] && m.cost[row][col] != null) ? +m.cost[row][col] * (+m.markup || 1) : 0);
      return Math.round(sell);
    }
    // Розкладаємо нанесення на дві частини: лінійні (діє коеф. кількості) і «сітка» (свій тираж).
    // uOverride — тираж для рядка DTF-сітки (для показу порогів/«від»).
    function applicationParts(uOverride){
      var m = methodCfgNew(); if(!m) return { coefPart:0, flatPart:0, basePart:0, minPart:0 };
      var coefPart = 0, flatPart = 0, basePart = 0, minPart = 0;
      // Порядок — за розміром: найбільше нанесення бере найдорожчу мінімалку.
      orderedLayers().forEach(function(x){
        if(m.mode === 'grid') flatPart += dtfGridSell(m, x.l, uOverride);
        else {
          var d = placementDetail(m, x.l, x.idx);
          coefPart += d.total; basePart += d.base; minPart += d.minAdd;
        }
      });
      // basePart і minPart уже ВСЕРЕДИНІ coefPart — тримаємо окремо лише щоб
      // показати менеджеру, скільки з нанесення це старт, площа й доплата до мінімуму.
      return { coefPart: coefPart, flatPart: flatPart, basePart: basePart, minPart: minPart };
    }
    function applicationCostNew(){ var ap = applicationParts(); return ap.coefPart + ap.flatPart; }
    function totalAreaMm2(){
      var a = 0;
      getViews().forEach(function(side){ (pm.logos[side] || []).forEach(function(l){ a += layerAreaMm2(l); }); });
      return a;
    }
    function unitPriceBeforeDiscount(){ var ap = applicationParts(); return basePriceNew() + ap.coefPart + ap.flatPart + methodPieceFee(); }
    // Ціна за одиницю при заданому коеф. знижки і тиражі для DTF-сітки.
    // Коеф множить базу + вишивку; DTF (сітка) і оплата за штуку — без коеф.
    // Знижка на сам виріб — окрема шкала, незалежна від нанесення. Потрібна тому,
    // що клієнт може взяти просто футболки чи кепки без жодного логотипа.
    // Якщо шкалу не задано в адмінці — усе працює як раніше (діє коеф. нанесення).
    function garmentTiersList(){
      var p = sitePricing();
      var l = p && p.garmentTiers;
      if(!Array.isArray(l) || !l.length) return null;
      return l.map(function(t){ return { from: +t.from || 1, coef: +t.coef || 1 }; })
              .sort(function(a, b){ return a.from - b.from; });
    }
    function garmentCoefFor(qty){
      return (window.LQ && window.LQ.garmentCoefFor) ? window.LQ.garmentCoefFor(qty) : null;
    }
    function unitPriceCoef(coef, uForGrid){
      var ap = applicationParts(uForGrid);
      var qty = Math.max(1, (uForGrid != null ? uForGrid : totalUnits()) || 1);
      // Знижки не накладаються одна на одну: шкала виробу діє ЛИШЕ на голий виріб.
      // Щойно є нанесення — виріб іде під знижку того способу (друк або вишивка),
      // рівно як було до появи цієї шкали.
      var gc = (logoCount() === 0) ? garmentCoefFor(qty) : null;
      if(gc == null) gc = coef;
      return Math.round(basePriceNew() * gc + ap.coefPart * coef) + ap.flatPart + methodPieceFee();
    }
    // Разова оплата за замовлення (напр. дизайн) розподілена на 1 шт цього тиражу.
    function orderFeePerUnit(qty){ var f = methodOrderFee(); return (qty > 0 && f > 0) ? Math.round(f / qty) : 0; }
    // Ефективна ціна за штуку — саме її фактично платить клієнт: виробнича + частка
    // разової оплати на тираж. Від неї рахуються і ціни, і знижки на картках порогів.
    // Ціна за штуку при заданому тиражі ЦІЄЇ позиції — з урахуванням того,
    // що вже лежить у кошику: спільні макети й спільна знижка за тираж.
    function sharedUnitPrice(qtyOverride){
      if(!sitePricing()) return null;
      var d = draftDescriptor();
      if(qtyOverride != null) d.units = Math.max(1, qtyOverride);
      var list = descriptorsWithDraft(d);
      var r = priceOrder(list);
      var k = draftAt(list, d);
      return (r[k] || r[r.length - 1]).unit;
    }
    function effUnitPriceCoef(coef, qty){
      var sh = sharedUnitPrice(qty);
      return sh != null ? sh : (unitPriceCoef(coef, qty) + orderFeePerUnit(qty));
    }
    /* Розклад ціни поточної позиції ОЧИМА СПІЛЬНОГО РУШІЯ — того самого, що
       рахує кошик, Канбан і комерційну пропозицію. Потрібен менеджерському
       прорахунку: ціна позиції залежить не лише від неї, а від усього
       замовлення (знижка йде від сумарного тиражу способу, підготовка макета
       ділиться на всі вироби цього способу). Рахувати рядки окремо від
       позиції — це і є та розбіжність, коли стовпчик не сходиться з підсумком. */
    function sharedDraftParts(qtyOverride){
      if(!sitePricing()) return null;
      var d = draftDescriptor();
      if(qtyOverride != null) d.units = Math.max(1, qtyOverride);
      var list = descriptorsWithDraft(d);
      var r = priceOrder(list);
      var last = r[draftAt(list, d)] || r[r.length - 1];
      return (last && last.parts) ? { unit: last.unit, parts: last.parts } : null;
    }
    // Ефективна ціна/шт для поточного вибору кількості (для рядка ціни та кошика).
    function effUnitPrice(){
      var u = totalUnits();
      var sh = sharedUnitPrice(u > 0 ? u : 1);
      return sh != null ? sh : (unitPrice() + orderFeePerUnit(u > 0 ? u : 1));
    }
    /* ═══════════ Спільний розрахунок замовлення ═══════════
       Ціна позиції залежить не лише від неї самої, а від усього замовлення:

       • Знижка за тираж рахується від СУМАРНОЇ кількості в межах способу
         нанесення. 5 кепок + 5 футболок із вишивкою — це 10 виробів, а не
         двічі по 5. Скільки там дизайнів — байдуже.
       • Голий одяг (без нанесення) має свою шкалу й свою суму.
       • Підготовка макета платиться ОДИН раз: разова оплата методу ділиться
         на всі вироби цього методу, а кожен додатковий ескіз — на вироби
         саме свого дизайну. Однакове лого на кепці й футболці — один макет.

       Тому ціну не можна порахувати «всередині картки»: потрібен весь список.
       Дескриптор нижче — це все, що потрібно про позицію, щоб її порахувати. */

    function tierCoefFor(methodKey, qty){
      return (window.LQ && window.LQ.tierCoefFor) ? window.LQ.tierCoefFor(methodKey, qty) : 1;
    }

    // list: [{ method, units, base, coefPart, pieceFee, dtfCols:[], designs:[fp], bare }]
    // Повертає ціну за штуку й суму для кожної позиції в тому ж порядку.
    // opts.noVolume — порахувати те саме замовлення так, ніби знижки за тираж
    // немає: потрібно для рядка «Було» в комерційній пропозиції.
    /* Рушій цін живе в окремому файлі loomiq-pricing.js — один на сайт,
       адмінку й сторінку пропозиції. Копія тут була б четвертим місцем, де
       ту саму формулу треба не забути виправити. */
    function priceOrder(list, opts){
      return (window.LQ && window.LQ.priceOrder)
        ? window.LQ.priceOrder(list, opts)
        : list.map(function(){ return { unit:0, sum:0, feeShare:0 }; });
    }

    // Дескриптор поточної позиції конструктора
    function draftDescriptor(){
      var m = methodCfgNew();
      var ap = applicationParts();
      var fps = [], kinds = [];
      getViews().forEach(function(side){ (pm.logos[side] || []).forEach(function(l){
        fps.push(l.fp || ''); kinds.push(isTextLayer(l) ? 'txt' : 'img'); }); });
      var cols = [];
      if(m && m.mode === 'grid'){
        getViews().forEach(function(side){ (pm.logos[side] || []).forEach(function(l){ cols.push(dtfBandCol(m, l)); }); });
      }
      return {
        method: (m && m.mode === 'grid') ? 'dtf' : 'embro',
        units: totalUnits(),
        base: basePriceNew(),
        coefPart: ap.coefPart,
        basePart: ap.basePart || 0,
        minPart: ap.minPart || 0,
        pieceFee: methodPieceFee(),
        dtfCols: cols,
        designs: fps,
        // Вид кожного дизайну — за ним разові оплати діляться на текст і картинку.
        // Старі замовлення цього поля не мають, там усе рахується як картинка.
        designKinds: kinds,
        bare: logoCount() === 0
      };
    }
    window.__priceOrder = priceOrder;   // кошик живе в іншій області видимості
    // Індекс позиції, яку зараз редагують. Конструктор закрили — редагування скасоване.
    function editIndex(){
      if(window.__pmEditIndex == null) return -1;
      var pmEl = document.getElementById('productModal');
      if(!pmEl || !pmEl.classList.contains('open')){
        window.__pmEditIndex = null; pm.editing = false;
        try{ syncAddLabels(); }catch(e){}
        return -1;
      }
      return window.__pmEditIndex;
    }
    // Дескриптори того, що вже лежить у кошику
    function cartDescriptors(){
      var list = (typeof cartItems !== 'undefined' && cartItems) ? cartItems : [];
      // Позицію, яку зараз редагують, не рахуємо двічі: у списку вона є як чернетка.
      // Щойно конструктор закрито — редагування скасовано, стара версія лишається як є.
      var skip = (window.__lqEditOnly != null) ? +window.__lqEditOnly : editIndex();
      return list.filter(function(it, i){ return it.kind !== 'reco' && i !== skip; })
        .map(function(it){ return it.desc || null; }).filter(Boolean);
    }
    /* Список описів РАЗОМ із чернеткою, і чернетка стоїть на своєму місці.
       Порядок тут не косметика: додатковий ескіз ділиться на вироби своєї
       групи дизайнів, а перша група його не платить — тож коли чернетку
       кидали в кінець, вона потрапляла в іншу групу, ніж потрапить у
       замовленні. Звідси й бралася різниця на кілька гривень між ціною в
       конструкторі та ціною, яку показує пропозиція. */
    function descriptorsWithDraft(d){
      var list = (typeof cartItems !== 'undefined' && cartItems) ? cartItems : [];
      /* Номер позиції, яку правлять, беремо з __lqEditOnly, коли він є.
         editIndex() сам себе скидає, щойно вікно конструктора виявилось не
         позначеним відкритим, — а в робочому місці менеджера воно й не
         зобовʼязане бути «модалкою». Варто цьому номеру злетіти, як стара
         версія позиції лишається в розрахунку РАЗОМ із чернеткою: та сама
         футболка рахується двічі, тираж стає 2 замість 1, зʼявляється чужа
         знижка й підготовка макета ділиться навпіл. */
      var skip = (window.__lqEditOnly != null) ? +window.__lqEditOnly : editIndex();
      if(skip == null || skip < 0 || !list[skip]) return cartDescriptors().concat([d]);
      var out = [], at = -1;
      list.forEach(function(it, i){
        if(it.kind === 'reco') return;
        if(i === skip){ at = out.length; out.push(d); return; }
        if(it.desc) out.push(it.desc);
      });
      if(at < 0) out.push(d);
      return out;
    }
    // Де в цьому списку лежить чернетка — щоб узяти саме її рядок результату
    function draftAt(list, d){ var k = list.indexOf(d); return k < 0 ? list.length - 1 : k; }

    function unitPrice(){
      if(sitePricing()){
        var t = activeCoefTier();
        return unitPriceCoef(t ? t.coef : 1);   // фактичний тираж → totalUnits для DTF
      }
      return activeTier().price + getGarment().price + getPrint().price + logoSurcharge();
    }
    // Найдешевша ціна за одиницю (за максимальним тиражем) — для показу «від X».
    function cheapestUnitPrice(){
      var pt = pricingTiers();
      if(pt && pt.length){
        // Пороги знижки на виріб можуть не збігатися з порогами нанесення —
        // перевіряємо і ті, і ті, інакше «від X» буде завищене.
        var qtys = pt.map(function(t){ return t.min; });
        // Пороги виробу враховуємо тільки там, де вони справді діють — без нанесення
        var gts = (logoCount() === 0) ? garmentTiersList() : null;
        if(gts) gts.forEach(function(g){ if(qtys.indexOf(g.from) < 0) qtys.push(g.from); });
        var prices = qtys.map(function(q){
          var t = pt[0];
          for(var i = pt.length - 1; i >= 0; i--){ if(q >= pt[i].min){ t = pt[i]; break; } }
          return effUnitPriceCoef(t.coef, q);
        });
        return Math.min.apply(null, prices);
      }
      return effUnitPriceCoef(1, 1);
    }
    function dayWord(n){
      var m10=n%10, m100=n%100;
      if(m10===1 && m100!==11) return 'день';
      if(m10>=2 && m10<=4 && (m100<12||m100>14)) return 'дні';
      return 'днів';
    }
    function deliveryTerm(){
      var p = sitePricing();
      if(p){
        var u = Math.max(1, totalUnits());
        var m = methodCfgNew() || {};
        var l = m.lead;
        var dmin, i;
        if(l){
          // сума стадій: дизайн + передача + виготовлення + відправка
          dmin = (+l.design||0)+(+l.transfer||0)+(+l.production||0)+(+l.shipping||0);
          (l.qtyTiers || []).forEach(function(t){ if(u >= (+t.from || 0)) dmin += (+t.extraDays || 0); });
        } else {
          // сумісність зі старим форматом leadTime
          var lt = p.leadTime || {};
          dmin = (getPrint().id === 'embro') ? (+lt.baseDaysEmbro || 3) : (+lt.baseDaysDtf || 2);
          (lt.tiers || []).forEach(function(t){ if(u >= (+t.from || 0)) dmin += (+t.extraDays || 0); });
        }
        return dmin + '-' + (dmin + 1);
      }
      var u2 = totalUnits();
      if(u2===0) return '3-4';
      var idx = TIERS.indexOf(activeTier());
      var extra2 = Math.max(0, idx-1);
      return (3+extra2)+'-'+(4+extra2);
    }

    var pmGarmentSvg = document.getElementById('pmGarmentSvg');
    var pmGarmentPhoto = document.getElementById('pmGarmentPhoto');
    var pmPrintAreaSvg = document.getElementById('pmPrintArea');
    var pmUploadZone = document.getElementById('pmUploadZone');
    var pmLogoLayers = document.getElementById('pmLogoLayers');
    var pmTabPanel = document.getElementById('pmTabPanel');
    var pmPriceText = document.getElementById('pmPriceText');
    var pmDeliveryText = document.getElementById('pmDeliveryText');
    // Рядок розміру нанесення живе у вкладці «Логотип», а вона перебудовується —
    // тож елемент шукаємо щоразу, а не кешуємо при завантаженні.
    function syncPrintSizeLabel(){
      var el = document.getElementById('pmPrintSize');
      if(!el) return;
      // Стоїть у рядку «Нанесення», тож слова «Розмір друку» тут зайві — лишаємо цифри
      el.textContent = activeLayer() ? activeLogoSizeLabel().replace(/^[^≈]*≈\s*/, '') : '';
    }
    var pmAddBtnSum = document.getElementById('pmAddBtnSum');
    var pmSwipeWrapEl = document.getElementById('pmSwipeWrap');
    var pmGarmentWrapEl = document.getElementById('pmGarmentWrap');
    // Менеджерський режим (вбудований iframe в адмінці ?manager=1): макап + прорахунок собівартості
    /* Менеджерський режим. Крім ?manager=1 — ще й конструктор, відкритий у
       картці пропозиції: там за кермом теж менеджер, і саме йому потрібен
       прорахунок із площею, ставкою за см² і розміром нанесення. Без цього
       в КП лишався урізаний вигляд для клієнта, і всі деталі зникали. */
    var IS_MANAGER = /[?&]manager=1\b/.test(location.search) || !!window.__lqInline;
    // Позначка для CSS: у прорахунку інші пріоритети, ніж на сайті —
    // менеджеру важливий великий мокап, а не кнопка «в кошик» над згином.
    if(IS_MANAGER) document.documentElement.classList.add('is-mgr');
    var mgrDetailOpen = false;   // розгорнутий покроковий розклад нанесення (по кожному зображенню)

    // Size the garment square to the largest size that fits BOTH the available width
    // and the available height of the stage (so it never overflows the screen sideways
    // the way pure-CSS height-based scaling did).
    // Per-товарний зум мокапа (фото+лого+зона масштабуються разом; краї кропляться overflow:hidden)
    // Зум мокапа під фон-блок: футболки +10%, кепка/шопер лишаються як є,
    // решта одягу — м'який дефолтний +10%, щоб гарно розтягувалось на всю зону.
    var GARMENT_ZOOM = { tote: 1.3, tee: 1.2, teeover: 1.2, cap: 1.0 };
    function garmentZoom(){ var z = GARMENT_ZOOM[pm.garmentId]; return z || 1.1; }
    function fitGarmentStage(){
      if(!pmSwipeWrapEl || !pmGarmentWrapEl) return;
      var cs = getComputedStyle(pmSwipeWrapEl);
      var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var availW = pmSwipeWrapEl.clientWidth - padX;
      var availH = pmSwipeWrapEl.clientHeight - padY;
      var size = Math.max(0, Math.min(availW, availH, 680));
      pmGarmentWrapEl.style.width = size + 'px';
      pmGarmentWrapEl.style.height = size + 'px';
      // від цієї ширини рахується все, що лежить на макеті
      pmGarmentWrapEl.style.setProperty('--pmw', size + 'px');
      var z = garmentZoom();
      pmGarmentWrapEl.style.transform = (z !== 1) ? ('scale(' + z + ')') : '';
    }
    // Висота сцени була в відсотках екрана (54vh, а на низьких — 37vh). На моєму
    // телефоні виходило добре, а на чужому з іншою висотою вікна й іншою панеллю
    // браузера мокап ставав удвічі меншим. Тепер міряємо, скільки місця реально
    // лишається під кнопкою «в кошик», і віддаємо його мокапу — на будь-якому
    // екрані виріб виходить настільки великим, наскільки дозволяє кнопка.
    var STAGE_GAP = 22;          // просвіт під кнопкою, щоб вона не липла до краю
    function fitStageHeight(){
      if(window.innerWidth >= 900) return;        // на десктопі діють свої правила
      if(!productModal || !productModal.classList.contains('open')) return;
      var stage = productModal.querySelector('.pm-stage');
      var btn = productModal.querySelector('.pm-add-btn');
      if(!stage || !btn) return;
      var keep = productModal.scrollTop;
      productModal.scrollTop = 0;                  // кнопку міряємо від верху сторінки
      var h = stage.getBoundingClientRect().height;
      var slack = window.innerHeight - btn.getBoundingClientRect().bottom - STAGE_GAP;
      var lo = 230, hi = Math.round(window.innerHeight * 0.60);
      var next = Math.max(lo, Math.min(hi, Math.round(h + slack)));
      if(Math.abs(next - h) >= 6) stage.style.height = next + 'px';
      productModal.scrollTop = keep;
      fitGarmentStage();
    }
    // Два проходи: після першого міняється висота, і запас треба переміряти.
    function fitStageTwice(){
      requestAnimationFrame(function(){ fitStageHeight();
        requestAnimationFrame(fitStageHeight); });
    }
    window.__fitStage = fitStageTwice;
    /* Підігнати сам виріб під його рамку, не чіпаючи висоту сцени. Потрібно
       там, де конструктор стоїть не на весь екран, а в картці пропозиції:
       рамку задає картка, і після переносу розмір треба переміряти. */
    window.__fitGarment = function(){
      requestAnimationFrame(function(){ fitGarmentStage();
        requestAnimationFrame(fitGarmentStage); });
    };
    (function(){ var _fw = window.innerWidth; window.addEventListener('resize', function(){ if(window.innerWidth !== _fw){ _fw = window.innerWidth; } fitStageTwice(); }); })();
    window.addEventListener('orientationchange', function(){ setTimeout(fitStageTwice, 60); });

    function currentLayers(){ return pm.logos[pm.side]; }
    function activeLayer(){ return currentLayers().find(function(l){return l.id===pm.activeLogoId;}); }
    // Логотип за id, у якій би стороні він не лежав — вкладка «Фото» показує всі сторони,
    // тож перемикачі й інструменти мають знаходити лого поза поточним ракурсом.
    function findLayerAnySide(id){
      var found = null;
      getViews().forEach(function(v){
        (pm.logos[v] || []).forEach(function(l){ if(l.id === id) found = l; });
      });
      return found;
    }
    // Сторона, на якій лежить лого — потрібна, щоб клік по чужій мініатюрі перемкнув ракурс.
    function sideOfLayer(id){
      var side = null;
      getViews().forEach(function(v){
        (pm.logos[v] || []).forEach(function(l){ if(l.id === id) side = v; });
      });
      return side;
    }
    // Групи для вкладки «Фото»: сторони, де є лого, плюс поточна (щоб було куди додавати).
    function photoGroups(){
      return getViews().filter(function(v){
        return (pm.logos[v] || []).length > 0 || v === pm.side;
      }).map(function(v){ return { side: v, layers: (pm.logos[v] || []).slice() }; });
    }
    function logoWordUa(n){
      var d = n % 10, dd = n % 100;
      if(d === 1 && dd !== 11) return 'нанесення';
      if(d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'нанесення';
      return 'нанесень';
    }

    // Накладаємо логотип на фото моделей, дзеркалячи позицію/розмір/поворот із головного мокапа.
    // Спина: показуємо лого беку; якщо його немає — показуємо передній (як прев'ю).
    function updateModelLogos(){
      var wrapEl = document.getElementById('pmGarmentWrap');
      var wrapW = (wrapEl && wrapEl.clientWidth) || 300;
      var frontLogo = pm.logos.front[0], backLogo = pm.logos.back[0];
      document.querySelectorAll('.pm-model-logo').forEach(function(el){
        var l = (el.dataset.side === 'back') ? (backLogo || frontLogo) : frontLogo;
        if(!l || !l.url){ el.style.display='none'; return; }
        var sw = parseFloat(el.dataset.sw);
        var sf = (120*(l.scale||1))/wrapW;   // розмір як частка ширини виробу
        el.style.width = (sf*sw) + '%';
        el.style.transform = 'translate(-50%,-50%) rotate('+(l.rot||0)+'deg)';
        el.style.backgroundImage = 'url("'+l.url+'")';
        if(el.dataset.manual){
          el.style.left = el.dataset.px + '%';
          el.style.top = el.dataset.py + '%';
        } else {
          var cx = parseFloat(el.dataset.cx), cy = parseFloat(el.dataset.cy);
          var u = (l.x||0)/wrapW, v = (l.y||0)/wrapW;   // зсув як частка ширини виробу
          el.style.left = (cx + u*sw) + '%';
          el.style.top = (cy + v*sw) + '%';
        }
        el.style.display = 'block';
      });
    }

    // Перетягування лого прямо на фото моделі (тап по лого = рух; свайп поруч = прокрутка каруселі)
    function startModelDrag(e, el){
      e.preventDefault(); e.stopPropagation();
      var photo = el.closest('.pm-model-photo'); if(!photo) return;
      el.style.cursor = 'grabbing';
      function move(ev){
        var p = ev.touches ? ev.touches[0] : ev;
        var rect = photo.getBoundingClientRect();
        var px = Math.max(0, Math.min(100, ((p.clientX - rect.left)/rect.width)*100));
        var py = Math.max(0, Math.min(100, ((p.clientY - rect.top)/rect.height)*100));
        el.dataset.manual = '1'; el.dataset.px = px; el.dataset.py = py;
        el.style.left = px + '%'; el.style.top = py + '%';
        if(ev.cancelable) ev.preventDefault();
      }
      function up(){
        el.style.cursor = 'grab';
        window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move);
        window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
      }
      window.addEventListener('mousemove', move); window.addEventListener('touchmove', move, {passive:false});
      window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    }

    function renderGarment(){
      try{ if(typeof syncTextBar === 'function') syncTextBar(); }catch(e){}
      fitGarmentStage();
      updateSideMarks();
      var g = getGarment(), c = getColor();
      // Реальні фото базової футболки (перед/зад) для кольорів, де вони є; решта — силуети.
      // на світлих футболках робимо текст пунктира темним (інакше зливається)
      var hx = c.hex.replace('#',''), lr = parseInt(hx.substr(0,2),16), lg = parseInt(hx.substr(2,2),16), lb = parseInt(hx.substr(4,2),16);
      pmUploadZone.classList.toggle('pm-upload-zone--dark', (0.299*lr + 0.587*lg + 0.114*lb) > 170);
      // крій має реальні фото-мокапи по кольорах; для власних товарів — лише якщо фото цього боку завантажене
      var usePhoto = !!GARMENT_COLORS[g.id] && (!g.custom || !!window.PHOTO_OVERRIDES[g.id+'-'+c.id+'-'+pm.side]);
      if(usePhoto){
        var src = window.LQ_img('/images/'+g.id+'-'+c.id+'-'+pm.side+'.webp');
        if(pmGarmentPhoto.getAttribute('src') !== src) pmGarmentPhoto.setAttribute('src', src);
        pmGarmentPhoto.style.display = '';
        pmGarmentSvg.style.display = 'none';
      } else {
        pmGarmentPhoto.style.display = 'none';
        pmGarmentSvg.style.display = '';
        pmGarmentSvg.setAttribute('viewBox','0 0 100 100');
        pmGarmentSvg.style.color = c.hex;
        pmGarmentSvg.innerHTML = '<path d="'+g.path+'" stroke="rgba(0,0,0,.12)" stroke-width="1"/>' +
          (g.extra ? '<path d="'+g.extra+'" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="2.5" stroke-linecap="round"/>' : '');
        // Crop the viewBox tightly around the actual silhouette (union of all paths) so the
        // garment fills the available square instead of floating with built-in empty margins.
        try{
          var paths = pmGarmentSvg.querySelectorAll('path');
          var minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
          paths.forEach(function(p){
            var b = p.getBBox();
            minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x+b.width); maxY = Math.max(maxY, b.y+b.height);
          });
          if(isFinite(minX) && maxX>minX){
            var pad = 2.5;
            var w = maxX-minX, h = maxY-minY;
            var size = Math.max(w,h) + pad*2;
            var cx = minX + w/2, cy = minY + h/2;
            pmGarmentSvg.setAttribute('viewBox', (cx-size/2).toFixed(2)+' '+(cy-size/2).toFixed(2)+' '+size.toFixed(2)+' '+size.toFixed(2));
          }
        }catch(e){}
      }
      pmUploadZone.style.display = currentLayers().length ? 'none' : '';
      renderLogoLayers();
      renderPrintArea();
      try{ matchStageBg(); }catch(e){}
      if(g.id !== lastModelGarment){ lastModelGarment = g.id; renderModelPhotos(); if(pmDetailPanel) renderDetailPanel(); }
      else { updateModelLogos(); }
    }
    var lastModelGarment = null;

    // Коли менеджер міняє фото товарів в адмінці — оновлюємо показ без перезавантаження
    document.addEventListener('lq-photos', function(){
      try{ renderGarment(); }catch(e){}
      try{ if(pm.tab === 'garment') renderTabPanel(); }catch(e){}
    });
    // Назви/описи/моделі/товари з адмінки — оновлюємо відповідні блоки
    document.addEventListener('lq-content', function(){
      try{
        applyCustomProducts();
        if(!GARMENTS.some(function(g){ return g.id === pm.garmentId; })){ pm.garmentId = GARMENTS[0].id; pm.colorId = getColors()[0].id; }
        if(!getColors().some(function(c){ return c.id === pm.colorId; })) pm.colorId = getColors()[0].id;
      }catch(e){}
      try{ if(pmDetailPanel) renderDetailPanel(); }catch(e){}
      try{ renderModelPhotos(); }catch(e){}
      try{ updatePriceBar(); }catch(e){}
      try{ if(pm.tab === 'garment') renderTabPanel(); }catch(e){}
      try{ renderGarment(); }catch(e){}
    });

    var HANDLE_DELETE_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var HANDLE_ROTATE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
    var HANDLE_SCALE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    // Розміри рамки шару — в одному місці: їх треба і при побудові, і при
    // правці на місці, коли шар перебудовувати не можна (загубиться каретка).
    function layerBox(layer){
      var sz = Math.round(120 * layer.scale);
      var ar = layer.ar || 1, bw = sz, bh = sz;
      if(ar >= 1){ bh = Math.round(sz/ar); } else { bw = Math.round(sz*ar); }
      return { w:bw, h:bh };
    }
    // Кегль живого напису рахується з тієї самої геометрії, що й PNG, тож
    // текст у рамці стоїть точно там, де він буде на виробі.
    function styleTextEl(el, sp, bh){
      var lines = textLines(sp.t).length || 1;
      var e = textEdge(sp);
      var pngH = Math.ceil(TXT_FS * TXT_LH * lines) + TXT_PAD * 2 + e.w * 2;
      var k = bh / pngH;
      el.style.fontFamily = textFontCss(sp.font);
      el.style.fontSize   = (TXT_FS * k).toFixed(2) + 'px';
      el.style.lineHeight = TXT_LH;
      el.style.fontWeight = sp.bold ? '700' : '400';
      el.style.fontStyle  = sp.italic ? 'italic' : 'normal';
      el.style.color      = sp.color || TEXT_COLORS[0];
      el.style.padding    = ((TXT_PAD + e.w) * k).toFixed(2) + 'px';
      el.style.webkitTextStroke = e.w * k > 0.4 ? (e.w * k).toFixed(2) + 'px ' + e.color : '';
      // Canvas і браузер міряють ту саму гарнітуру трохи по-різному, тож напис
      // міг вилазити за рамку. Підганяємо кегль під фактичну ширину — і те,
      // що на екрані, збігається з тим, що піде у виробництво.
      if(el.isConnected){
        var cw = el.clientWidth, ch = el.clientHeight;
        var sw = el.scrollWidth, sh = el.scrollHeight;
        if(cw > 0 && ch > 0 && sw > 0 && sh > 0){
          var fit = Math.min(cw / sw, ch / sh);
          if(fit < 0.995) el.style.fontSize = (TXT_FS * k * fit).toFixed(2) + 'px';
        }
      }
    }
    function renderLogoLayers(){
      // Шар, який зараз правлять, НЕ перебудовуємо: заміна вузла збиває
      // фокус і на телефоні згортає клавіатуру просто посеред набору.
      /* Контейнер міг змінити ширину — вікно, колонка збоку, поворот
         телефона. Перераховуємо пікселі з часток, щоб лого лишилось там
         само й того самого фізичного розміру. */
      currentLayers().forEach(layerApplyFrac);
      var keepId = pm.textEdit;
      /* …але лишати його можна тільки поки він на видимій стороні. Інакше
         напис, який правили на спині, лишався висіти й на переді: вузол не
         видалявся, а поверх нього домальовувались шари переду. Виглядало це
         як «текст сам перенісся зі спини наперед», хоча в самому виробі
         нічого не дублювалось — дублювалась тільки картинка на екрані. */
      if(keepId != null && !(pm.logos[pm.side] || []).some(function(l){ return l.id === keepId; })){
        keepId = null;
      }
      Array.prototype.slice.call(pmLogoLayers.children).forEach(function(c){
        if(keepId == null || Number(c.dataset.layerId) !== keepId) c.remove();
      });
      currentLayers().forEach(function(layer){
        var active = pm.activeLogoId === layer.id;
        var rot = layer.rot || 0;
        var box = layerBox(layer), bw = box.w, bh = box.h;
        if(keepId != null && layer.id === keepId){
          var ex = pmLogoLayers.querySelector('[data-layer-id="'+layer.id+'"]');
          if(ex){
            ex.style.width = bw + 'px'; ex.style.height = bh + 'px';
            ex.style.zIndex = active ? 10 : 1;
            ex.style.transform = 'translate(calc(-50% + '+layer.x+'px), calc(-50% + '+layer.y+'px)) rotate('+rot+'deg)';
            var tx = ex.querySelector('.pm-dl-text');
            if(tx && layer.text) styleTextEl(tx, layer.text, bh);
            return;
          }
        }
        var el = document.createElement('div');
        el.className = 'pm-draggable-layer';
        el.dataset.layerId = layer.id;
        el.style.width = bw + 'px';
        el.style.height = bh + 'px';
        el.style.zIndex = active ? 10 : 1;
        el.style.transform = 'translate(calc(-50% + '+layer.x+'px), calc(-50% + '+layer.y+'px)) rotate('+rot+'deg)';
        var inner = layer.text
          ? '<div class="pm-dl-text' + (keepId === layer.id ? ' is-edit' : '') + '" data-tid="' + layer.id + '" ' +
            'data-ph="Ваш напис" spellcheck="false" contenteditable="plaintext-only">' +
            escAttr(layer.text.t || '') + '</div>'
          : '<img src="'+layer.url+'" alt="">';
        el.innerHTML =
          '<div class="pm-dl-img">' + inner + (active ? '<div class="pm-dl-outline"></div>' : '') + '</div>' +
          (active ?
            '<div class="pm-dl-handle pm-dl-handle--delete" data-handle="delete">'+HANDLE_DELETE_SVG+'</div>' +
            '<div class="pm-dl-handle pm-dl-handle--rotate" data-handle="rotate">'+HANDLE_ROTATE_SVG+'</div>' +
            '<div class="pm-dl-handle pm-dl-handle--scale" data-handle="scale">'+HANDLE_SCALE_SVG+'</div>'
          : '');
        pmLogoLayers.appendChild(el);
        var te = el.querySelector('.pm-dl-text');
        if(te){ styleTextEl(te, layer.text, bh); bindTextEl(te, layer); }

        el.querySelector('.pm-dl-img').addEventListener('mousedown', function(e){ onImgDown(e, layer); });
        el.querySelector('.pm-dl-img').addEventListener('touchstart', function(e){ onImgDown(e, layer); }, {passive:false});
        if(active){
          el.querySelector('[data-handle="delete"]').addEventListener('mousedown', function(e){ e.stopPropagation(); openDeleteConfirm(layer.id); });
          el.querySelector('[data-handle="delete"]').addEventListener('touchstart', function(e){ e.stopPropagation(); e.preventDefault(); openDeleteConfirm(layer.id); });
          el.querySelector('[data-handle="rotate"]').addEventListener('mousedown', function(e){ onRotateDown(e, layer, el); });
          el.querySelector('[data-handle="rotate"]').addEventListener('touchstart', function(e){ onRotateDown(e, layer, el); }, {passive:false});
          el.querySelector('[data-handle="scale"]').addEventListener('mousedown', function(e){ onScaleDown(e, layer); });
          el.querySelector('[data-handle="scale"]').addEventListener('touchstart', function(e){ onScaleDown(e, layer); }, {passive:false});
        }
      });
    }

    /* ===== Область нанесення на конструкторі ===== */
    // Повний полігон: дзеркалимо симетричну половину (як fullPoly в адмінці).
    function paFullPoly(cfg){
      var pts = (cfg.pts||[]).map(function(p){ return Array.isArray(p) ? [p[0],p[1]] : [(p&&p.x)||0,(p&&p.y)||0]; });
      if(cfg.symmetric === false) return pts;
      var mir = pts.slice(1,-1).reverse().map(function(p){ return [-p[0], p[1]]; });
      return pts.concat(mir);
    }
    // Конфіг зони для поточного товару / сторони / кольору (свій полігон кольору → base).
    function currentPrintCfg(){
      var pa = (window.SITE_CONTENT && window.SITE_CONTENT.printAreas) || {};
      var area = pa[pm.garmentId]; if(!area) return null;
      var side = area[pm.side]; if(!side) return null;
      var cfg = (side.colors && side.colors[pm.colorId]) ? side.colors[pm.colorId] : side.base;
      return (cfg && cfg.pts && cfg.pts.length >= 3) ? cfg : null;
    }
    function paPointInPoly(pt, poly){
      var x=pt[0], y=pt[1], inside=false;
      for(var i=0,j=poly.length-1;i<poly.length;j=i++){
        var xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
        if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi)) inside=!inside;
      }
      return inside;
    }
    // Чи виходить якесь лого поточної сторони за межі зони (перевіряємо кути рамки з поворотом).
    function logoOutside(l, polyFrac, wrapW){
      var sz=120*(l.scale||1), ar=l.ar||1, bw=sz, bh=sz;
      if(ar>=1) bh=sz/ar; else bw=sz*ar;
      var ob=l.opaqueBox||{x0:0,y0:0,x1:1,y1:1};
      // прямокутник непрозорих пікселів у локальних px відносно центра лого
      var lx0=(ob.x0-0.5)*bw, lx1=(ob.x1-0.5)*bw, ly0=(ob.y0-0.5)*bh, ly1=(ob.y1-0.5)*bh;
      var cxF=0.5+(l.x||0)/wrapW, cyF=0.5+(l.y||0)/wrapW;
      var rot=(l.rot||0)*Math.PI/180, cs=Math.cos(rot), sn=Math.sin(rot);
      var corners=[[lx0,ly0],[lx1,ly0],[lx1,ly1],[lx0,ly1]];
      for(var c=0;c<4;c++){
        var rx=corners[c][0]*cs - corners[c][1]*sn, ry=corners[c][0]*sn + corners[c][1]*cs;
        if(!paPointInPoly([cxF+rx/wrapW, cyF+ry/wrapW], polyFrac)) return true;
      }
      return false;
    }
    function anyLogoOutside(polyFrac, geo){
      var layers = currentLayers();
      for(var k=0;k<layers.length;k++){ if(logoOutside(layers[k], polyFrac, geo.wrapW)) return true; }
      return false;
    }
    // Геометрія зони у частках контейнера: полігон + wrapW. null, якщо зони/фото немає.
    function printAreaGeom(){
      var cfg = currentPrintCfg();
      if(!cfg || pmGarmentPhoto.style.display === 'none') return null;
      var natW = pmGarmentPhoto.naturalWidth, natH = pmGarmentPhoto.naturalHeight;
      if(!(natW>0)||!(natH>0)) return null;
      var wrapW = pmGarmentWrapEl.clientWidth || 1;
      // прямокутник фото в квадратному контейнері (object-fit:contain), у частках контейнера
      var arImg=natW/natH, rw, rh, ox, oy;
      if(arImg>=1){ rw=1; rh=1/arImg; ox=0; oy=(1-rh)/2; } else { rh=1; rw=arImg; oy=0; ox=(1-rw)/2; }
      var calT=cfg.calibTop!=null?cfg.calibTop:0.06, calB=cfg.calibBottom!=null?cfg.calibBottom:0.96;
      // Вісь задає адмінка: виріб на фото рідко стоїть точно по центру
      var calX=cfg.calibCx!=null?cfg.calibCx:0.5;
      var topCal=oy+calT*rh, ch=(calB-calT)*rh, cx=ox+rw*calX;
      var polyFrac = paFullPoly(cfg).map(function(p){ return [cx+p[0]*ch, topCal+p[1]*ch]; });
      return { polyFrac: polyFrac, wrapW: wrapW };
    }
    // Центр зони у пікселях відносно центра контейнера (для стартового положення лого).
    function printAreaAnchorPx(){
      var g = printAreaGeom(); if(!g) return null;
      var sx=0, sy=0, n=g.polyFrac.length;
      g.polyFrac.forEach(function(p){ sx+=p[0]; sy+=p[1]; });
      return { x:(sx/n - 0.5)*g.wrapW, y:(sy/n - 0.5)*g.wrapW };
    }
    // Пунктирна зона — це ПОПЕРЕДЖЕННЯ: показується лише коли лого завантажене
    // і його непрозорі пікселі виходять за межі поля. Якщо все в межах — зони не видно.
    var zoneOutBySide = {};
    function renderPrintArea(){
      var svg = pmPrintAreaSvg; if(!svg) return;
      var g = printAreaGeom();
      var hasLogos = currentLayers().length > 0;
      var over = (g && hasLogos) ? anyLogoOutside(g.polyFrac, { wrapW:g.wrapW }) : false;
      zoneOutBySide[pm.side] = over;
      updateZoneWarn();
      if(!over){ svg.style.display='none'; return; }
      var d = g.polyFrac.map(function(p,i){ return (i?'L':'M')+(p[0]*100).toFixed(2)+' '+(p[1]*100).toFixed(2); }).join(' ')+' Z';
      // контраст до кольору одягу: світла лінія на темному, темна — на світлому
      var hx = getColor().hex.replace('#',''), lum = 0.299*parseInt(hx.substr(0,2),16)+0.587*parseInt(hx.substr(2,2),16)+0.114*parseInt(hx.substr(4,2),16);
      var col = (lum > 170) ? 'rgba(20,22,30,.6)' : 'rgba(255,255,255,.85)';
      svg.innerHTML = '<path d="'+d+'" stroke="'+col+'" stroke-width="1.8" stroke-dasharray="5 4"/>';
      svg.style.display = 'block';
    }
    // Чи виходить якесь лого за межі зони на будь-якій стороні (для блокування кошика).
    function anyLogoOutsideAnySide(){ return Object.keys(zoneOutBySide).some(function(s){ return zoneOutBySide[s]; }); }
    // Напис-попередження + блокування кнопок додавання.
    function updateZoneWarn(){
      var out = anyLogoOutsideAnySide();
      var warn = document.getElementById('pmZoneWarn');
      if(warn) warn.style.display = out ? 'flex' : 'none';
      ['pmAddToCartBtn','pmStickyCartBtn'].forEach(function(id){
        var b = document.getElementById(id); if(b) b.classList.toggle('is-blocked', out);
      });
    }
    // Підлаштовуємо фон блоку-мокапа під фон самого фото (щоб сірого канту навколо не було)
    var STAGE_BG_FALLBACK = 'rgb(233,230,231)';   // беж студії — щоб без білих пробілів, навіть якщо семпл не спрацює
    // Фон блоку підлаштовуємо під фон КОЖНОГО фото окремо. object-fit:contain лишає пробіли
    // по боках (де фото вужче за блок), тож семплимо саме ті краї фото, що межують із пробілом,
    // і усереднюємо — щоб колір блоку співпав із фоном картинки без видимого шва/полос.
    function setStageBg(col){
      var stage = document.getElementById('pmStage');
      if(stage) stage.style.background = col;
      // ВАЖЛИВО: той самий колір і на самому фото-елементі — бо object-fit:contain
      // лишає лeterбокс-смуги в межах фото, і саме вони давали «рамку» іншого кольору
      if(pmGarmentPhoto) pmGarmentPhoto.style.background = col;
    }
    function matchStageBg(){
      var stage = document.getElementById('pmStage'); if(!stage) return;
      if(!pmGarmentPhoto || pmGarmentPhoto.style.display === 'none' || !pmGarmentPhoto.naturalWidth){ setStageBg(STAGE_BG_FALLBACK); return; }
      try{
        var nw = pmGarmentPhoto.naturalWidth, nh = pmGarmentPhoto.naturalHeight;
        var W = 64, H = Math.max(1, Math.round(64 * nh / nw));   // масштаб зі збереженням пропорцій
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var ctx = c.getContext('2d');
        ctx.drawImage(pmGarmentPhoto, 0, 0, nw, nh, 0, 0, W, H);
        var data = ctx.getImageData(0, 0, W, H).data;
        // семплимо всі 4 краї фото (це фон студії) й усереднюємо — щоб і фон блоку,
        // і лeterбокс-смуги фото були одного кольору з фоном самої картинки
        var r = 0, g = 0, b = 0, n = 0;
        function acc(x, y){ var i = (y * W + x) * 4; if(data[i+3] > 200){ r += data[i]; g += data[i+1]; b += data[i+2]; n++; } }
        for(var x = 0; x < W; x++){ acc(x, 0); acc(x, 1); acc(x, H-1); acc(x, H-2); }
        for(var y = 0; y < H; y++){ acc(0, y); acc(1, y); acc(W-1, y); acc(W-2, y); }
        setStageBg(n > 0
          ? ('rgb('+Math.round(r/n)+','+Math.round(g/n)+','+Math.round(b/n)+')')
          : STAGE_BG_FALLBACK);
      }catch(e){ setStageBg(STAGE_BG_FALLBACK); }   // file:// / taint → беж
    }
    // перемальовуємо зону, коли фото-мокап довантажився
    pmGarmentPhoto.addEventListener('load', function(){ try{ renderPrintArea(); }catch(e){} try{ matchStageBg(); }catch(e){} });

    // Міряємо форму лого з КОНКРЕТНОГО url: пропорції, частку непрозорих пікселів (fill)
    // і межі непрозорого (opaqueBox). Викликаємо і при завантаженні, і при перемиканні
    // «З фоном / Без фону» — бо площа вишивки рахується саме з непрозорих пікселів,
    // пропорції лого → рамка щільно облягає контур (зручне перетягування)
    // Форма лого: точні межі малюнка (opaqueBox) і частка непрозорих пікселів
    // усередині них (fill). Разом вони дають площу вишивки: габарит × fill.
    //
    // Два правила, без яких те саме лого в різних файлах давало різну ціну:
    //  1) вимірюємо ВМІСТ, а не файл — прозорі поля не впливають ні на що;
    //  2) вирізаємо строго по цілих пікселях оригіналу — при дробовому зсуві
    //     браузер згладжує, тонкі лінії «розповзаються» і заповнення завищується.
    /* Відбиток дизайну й межі малюнка живуть в окремому файлі
       (loomiq-fingerprint.js): за ними рушій цін вирішує, один це макет чи
       два, тобто це прямо гроші в рахунку. Ту саму формулу мусить бачити й
       адмінка, коли перевіряє збережене замовлення, — а дві копії однієї
       формули рано чи пізно розходяться. */
    function measureShape(img){
      return (window.LQ && window.LQ.measureShape) ? window.LQ.measureShape(img) : null;
    }
    function imageFingerprint(img, box){
      return (window.LQ && window.LQ.imageFingerprint) ? window.LQ.imageFingerprint(img, box) : '';
    }
    function urlFingerprint(url){
      return (window.LQ && window.LQ.urlFingerprint) ? window.LQ.urlFingerprint(url) : '';
    }
    /* Порівняння відбитків і розкладання їх по групах живуть у рушії цін
       (loomiq-pricing.js): саме він вирішує, за який дизайн беруться разові.
       Копія тут була б другим місцем, де ту саму межу «схожості» треба не
       забути виправити, — а розійшовшись, вони давали б різну кількість
       додаткових ескізів у конструкторі й у пропозиції. */
    /* Відбиток напису рахуємо з самих букв, а не з картинки.
       Картинка тут не працює взагалі: у imageFingerprint прозоре тло
       заливається білим, а напис на темному виробі за замовчуванням теж
       білий — після зведення до квадратика 12×12 будь-яке слово ставало
       однаковим білим полем. Через це «LOOMIQ» і «Team 2026» вважались
       ОДНИМ дизайном, і другий ескіз не нараховувався.
       Довжина навмисно інша, ніж у відбитка картинки: напис і малюнок
       ніколи не мають зійтись як один дизайн. */
    function textFingerprint(spec){
      var s = String((spec && spec.t) || '').replace(/\s+/g, ' ').trim().toLowerCase()
            + '|' + ((spec && spec.font) || '')
            + '|' + ((spec && spec.bold) ? 'b' : '') + ((spec && spec.italic) ? 'i' : '');
      var out = '';
      for(var i = 0; i < 64; i++){
        var h = (2166136261 ^ i) >>> 0;
        for(var j = 0; j < s.length; j++){
          h = ((h ^ s.charCodeAt(j)) * 16777619) >>> 0;
        }
        out += (h % 5);
      }
      return out;
    }
    function measureLayerShape(layer, url){
      return loadImgEl(url).then(function(img){
        layer.ar = (img.naturalWidth||1)/(img.naturalHeight||1);
        // Спершу межі малюнка — відбиток знімаємо саме з них, а не з усього
        // полотна разом із прозорими полями (див. imageFingerprint)
        try{
          var m = measureShape(img);
          layer.opaqueBox = m ? m.opaqueBox : { x0:0, y0:0, x1:1, y1:1 };
          layer.fill = m ? m.fill : 1;
        }catch(e){ layer.fill = 0.85; layer.opaqueBox = { x0:0, y0:0, x1:1, y1:1 }; }
        try{ layer.fp = imageFingerprint(img, layer.opaqueBox); }catch(e){ layer.fp = ''; }
        /* Пікселі не прочитались — лишається адреса файлу. Порожній відбиток
           рушій вважає «дизайну немає» й приєднує до першої групи, тож
           другий логотип (найчастіше той, що кладуть на спину) їхав би без
           ескізу: площа порахована, підготовка макета — ні. */
        if(!layer.fp) layer.fp = urlFingerprint(url);
        // Напис звіряємо за текстом — див. textFingerprint вище
        if(layer.text) layer.fp = textFingerprint(layer.text);
      }, function(err){
        /* Картинка взагалі не відкрилась. Через crossOrigin='anonymous' так
           буває з кожним хостингом без CORS: обіцянка відхиляється, і шар
           лишається без відбитка зовсім. Шар при цьому нікуди не дівається —
           його площа рахується від масштабу, — тож дизайн їхав у виробництво
           без підготовки макета. */
        if(!layer.fp) layer.fp = layer.text ? textFingerprint(layer.text) : urlFingerprint(url);
        if(!layer.opaqueBox) layer.opaqueBox = { x0:0, y0:0, x1:1, y1:1 };
        if(layer.fill == null) layer.fill = 0.85;
        console.warn('макет не відкрився, відбиток за адресою файлу', err);
      });
    }
    // Розмір лого зберігається в пікселях (120 × scale), а фізичні міліметри
    // рахуються від ЧАСТКИ ширини виробу. Тому фіксований scale давав різний
    // розмір друку на різних екранах: на низькому мокапі ті самі 120px — це
    // більша частка футболки. Прив'язуємо до частки, і розмір стає однаковим.
    var DEFAULT_LOGO_FRAC = 0.32;
    function defaultLogoScale(){
      var wrapEl = document.getElementById('pmGarmentWrap');
      var wrapW = (wrapEl && wrapEl.clientWidth) || 0;
      if(!wrapW) return 1;
      return Math.round((DEFAULT_LOGO_FRAC * wrapW / 120) * 1000) / 1000;
    }
    // Напис малюємо в canvas із прозорим фоном — далі він живе як звичайний шар:
    // тягнеться, масштабується, рахується за площею. Photoroom тут не потрібен.
    /* ═══════════ Текст як живий шар ═══════════
       Раніше напис одразу перетворювався на PNG і ставав звичайним шаром — він
       більше не знав, що він текст, тож його не можна було ні переписати, ні
       перефарбувати, ні змінити шрифт. Тепер шар зберігає сам напис і його
       властивості, а картинка перемальовується на кожну зміну. */

    // Кольори — реальні нитки й плівка, а не вільна палітра: клієнт обере
    // #7F3FBF, а такої нитки не існує, і замовлення стане на узгодженні.
    // Двадцять зразків прямо в панелі: ряд гортається, а найтонше підбирання
    // лишається палітрі — вона перша в ряду.
    var TEXT_COLORS = ['#ffffff', '#111111', '#8e8e93', '#c9ccd1', '#c8102e',
                       '#7a1220', '#f26b21', '#ffd400', '#c9a227', '#0b3d91',
                       '#1e88e5', '#00a3ad', '#7fd1c1', '#1b7a43', '#14532d',
                       '#7cb342', '#6a3da8', '#e75480', '#6b4423', '#d8c3a5'];
    // Назви — щоб у панелі стояло «Червоний», а не «#C8102E». Для відтінку з
    // палітри беремо найближчу назву: людині важливо, який це колір, а не код.
    var COLOR_NAMES = [
      ['#ffffff','Білий'], ['#f2f2f2','Молочний'], ['#111111','Чорний'],
      ['#8e8e93','Сірий'], ['#4a4a4a','Графіт'], ['#c8102e','Червоний'],
      ['#7a1220','Бордовий'], ['#f26b21','Помаранчевий'], ['#ffd400','Жовтий'],
      ['#c9a227','Золотий'], ['#0b3d91','Темно-синій'], ['#1e88e5','Синій'],
      ['#00a3ad','Бірюзовий'], ['#1b7a43','Зелений'], ['#7cb342','Салатовий'],
      ['#6a3da8','Фіолетовий'], ['#e75480','Рожевий'], ['#6b4423','Коричневий'],
      ['#c9ccd1','Сріблястий'], ['#d8c3a5','Бежевий'], ['#7fd1c1','Мʼятний'],
      ['#14532d','Темно-зелений']
    ];
    function colorName(hex){
      var h = String(hex || '').toLowerCase(), best = COLOR_NAMES[0], bd = 1e9;
      for(var i = 0; i < COLOR_NAMES.length; i++){
        if(COLOR_NAMES[i][0] === h) return COLOR_NAMES[i][1];
        var d = hexDist(h, COLOR_NAMES[i][0]);
        if(d < bd){ bd = d; best = COLOR_NAMES[i]; }
      }
      return best[1];
    }
    // Справжні гарнітури під власними назвами: «Montserrat» людина впізнає з
    // макета, «Гротеск» — ні. Кожна в списку намальована сама собою.
    // Усі — з кирилицею, інакше український напис посипався б на латиницю.
    var TEXT_FONTS = [
      { id:'montserrat', name:'Montserrat',       web:'Montserrat',        css:'"Montserrat",__SF__' },
      { id:'robotocond', name:'Roboto Condensed', web:'Roboto Condensed',  css:'"Roboto Condensed",__SF__' },
      { id:'oswald',     name:'Oswald',           web:'Oswald',            css:'"Oswald",__SF__' },
      { id:'roboto',     name:'Roboto',           web:'Roboto',            css:'"Roboto",__SF__' },
      { id:'opensans',   name:'Open Sans',        web:'Open Sans',         css:'"Open Sans",__SF__' },
      { id:'inter',      name:'Inter',            web:'Inter',             css:'"Inter",__SF__' },
      { id:'russo',      name:'Russo One',        web:'Russo One',         css:'"Russo One",__SF__' },
      { id:'alumni',     name:'Alumni Sans',      web:'Alumni Sans',       css:'"Alumni Sans",__SF__' },
      { id:'rubik',      name:'Rubik',            web:'Rubik',             css:'"Rubik",__SF__' },
      { id:'raleway',    name:'Raleway',          web:'Raleway',           css:'"Raleway",__SF__' },
      { id:'nunito',     name:'Nunito',           web:'Nunito',            css:'"Nunito",__SF__' },
      { id:'ubuntu',     name:'Ubuntu',           web:'Ubuntu',            css:'"Ubuntu",__SF__' },
      { id:'ptsans',     name:'PT Sans',          web:'PT Sans',           css:'"PT Sans",__SF__' },
      { id:'playfair',   name:'Playfair Display', web:'Playfair Display',  css:'"Playfair Display",Georgia,serif' },
      { id:'slab',       name:'Roboto Slab',      web:'Roboto Slab',       css:'"Roboto Slab",Georgia,serif' },
      { id:'merri',      name:'Merriweather',     web:'Merriweather',      css:'"Merriweather",Georgia,serif' },
      { id:'unbounded',  name:'Unbounded',        web:'Unbounded',         css:'"Unbounded",__SF__' },
      { id:'lobster',    name:'Lobster',          web:'Lobster',           css:'"Lobster",cursive' },
      { id:'pacifico',   name:'Pacifico',         web:'Pacifico',          css:'"Pacifico",cursive' },
      { id:'caveat',     name:'Caveat',           web:'Caveat',            css:'"Caveat","Segoe Script",cursive' }
    ];
    function textFont(id){
      return TEXT_FONTS.filter(function(x){ return x.id === id; })[0] || TEXT_FONTS[0];
    }
    function textFontCss(id){
      return textFont(id).css.replace('__SF__', getComputedStyle(document.body).fontFamily);
    }
    // Canvas міряє напис ДО того, як шрифт доїхав, і бере запасну гарнітуру —
    // тоді рамка не збігається з тим, що видно. Тому чекаємо на завантаження.
    var TEXT_FONTS_READY = false;
    function loadTextFonts(){
      if(TEXT_FONTS_READY || !document.fonts) return Promise.resolve();
      var jobs = [];
      TEXT_FONTS.forEach(function(f){
        if(!f.web) return;
        ['400 200px ', '700 200px ', 'italic 400 200px ', 'italic 700 200px '].forEach(function(pre){
          try{ jobs.push(document.fonts.load(pre + '"' + f.web + '"', 'Абв Abc')); }catch(e){}
        });
      });
      return Promise.all(jobs).then(function(){ TEXT_FONTS_READY = true; })
        .catch(function(){ TEXT_FONTS_READY = true; });
    }
    // Яскравість кольору 0..1 — за нею вирішуємо, темний текст чи світлий
    function hexLum(hex){
      var h = String(hex || '').replace('#','');
      if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
      if(isNaN(r) || isNaN(g) || isNaN(b)) return 1;
      return 0.2126*r + 0.7152*g + 0.0722*b;
    }
    function hexDist(a, b){
      var p = function(h){ h = String(h||'').replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0]; };
      var x = p(a), y = p(b);
      return Math.sqrt(Math.pow(x[0]-y[0],2) + Math.pow(x[1]-y[1],2) + Math.pow(x[2]-y[2],2)) / 441;
    }
    // Колір напису під колір виробу: на світлому — темний, на темному — світлий
    function autoTextColor(){
      var g = getColor() || {};
      return hexLum(g.hex || '#ffffff') > 0.55 ? '#111111' : '#ffffff';
    }
    function escAttr(v){ return String(v||'').replace(/[&<>"]/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]; }); }
    // Малюємо напис у canvas. До двох рядків: найчастіший корпоративний напис —
    // назва плюс дрібніший підпис під нею, одним рядком це не зробити.
    // Геометрію напису тримаємо в одному місці: за нею і canvas малює PNG,
    // і жива рамка на виробі рахує кегль. Розійдуться — текст «поїде».
    var TXT_FS = 200, TXT_PAD = 28, TXT_LH = 1.18;
    function textLines(t){
      return String(t || '').split('\n').map(function(x){ return x.trim(); })
               .filter(Boolean).slice(0, 2);
    }
    // Обводки немає: на виробі її ніхто не вишиває й не друкує задарма, а на
    // макеті вона робила напис схожим на наліпку. Контраст тримає сам колір —
    // на темному виробі напис світлий, на світлому темний. Функція лишилась,
    // бо з неї рахується геометрія і PNG, і живої рамки.
    function textEdge(sp){ return { w:0, color:'' }; }
    function textToPng(sp){
      sp = sp || {};
      var lines = textLines(sp.t);
      if(!lines.length) return null;
      var FS = TXT_FS, PAD = TXT_PAD, LH = TXT_LH;
      var weight = sp.bold ? '700' : '400';
      var style = sp.italic ? 'italic ' : '';
      var font = style + weight + ' ' + FS + 'px ' + textFontCss(sp.font);
      var m = document.createElement('canvas').getContext('2d');
      m.font = font;
      var w = 0;
      lines.forEach(function(l){ w = Math.max(w, Math.ceil(m.measureText(l).width)); });
      var col = sp.color || TEXT_COLORS[0];
      var e = textEdge(sp), edge = e.color, lw = e.w;

      var c = document.createElement('canvas');
      c.width  = Math.max(2, w + PAD * 2 + lw * 2);
      c.height = Math.ceil(FS * LH * lines.length) + PAD * 2 + lw * 2;
      var x = c.getContext('2d');
      x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.miterLimit = 2;
      var cx = c.width / 2;
      var top = (c.height - FS * LH * lines.length) / 2 + FS * LH / 2;
      lines.forEach(function(l, i){
        var cy = top + i * FS * LH;
        if(lw){ x.lineWidth = lw; x.strokeStyle = edge; x.strokeText(l, cx, cy); }
        x.fillStyle = col; x.fillText(l, cx, cy);
      });
      return c.toDataURL('image/png');
    }
    // Створити напис як шар. Колір підбирається під виріб, далі його можна змінити.
    // Напис одразу стає на виріб із зразком тексту — його ж і правлять на місці.
    var TEXT_PLACEHOLDER = 'Ваш напис';
    function addTextLayer(initial){
      var sp = { t: initial || TEXT_PLACEHOLDER, font: pm.textFont || TEXT_FONTS[0].id,
                 color: pm.textColor || autoTextColor(), bold: false, italic: false };
      var url = textToPng(sp);
      if(!url) return null;
      addLogo(url, url, sp);       // фон уже прозорий — видаляти нічого
      var l = findLayerAnySide(pm.activeLogoId);
      /* Відбиток напису ставимо одразу, не чекаючи, поки домалюється
         картинка. Інакше позицію можна встигнути додати в замовлення з
         порожнім відбитком — і напис поїде у виробництво безкоштовно. */
      if(l && l.text) l.fp = textFingerprint(l.text);
      // Поки напис не чіпали — це заготовка: підеш назад, і вона зникне сама,
      // щоб «Ваш напис» не поїхав у виробництво.
      if(l) l.textPristine = !initial;
      pm.textDraft = ''; pm.textOpen = false;
      return l;
    }
    // Змінили напис/шрифт/колір — перемальовуємо ту саму картинку на місці.
    // Позиція, масштаб і поворот лишаються: людина вже поставила напис як хотіла.
    function updateTextLayer(layer, patch){
      if(!layer || !layer.text) return;
      Object.keys(patch || {}).forEach(function(k){ layer.text[k] = patch[k]; });
      if(patch && patch.t != null) layer.textPristine = false;
      layer.fp = textFingerprint(layer.text);   // відбиток — за буквами, одразу
      var url = textToPng(layer.text);
      if(!url) return;
      layer.origUrl = layer.cleanUrl = layer.url = url;
      measureLayerShape(layer, url).then(function(){
        renderLogoLayers(); renderTabPanel(); updatePriceBar();
      }).catch(function(){});
      renderLogoLayers(); updatePriceBar();
    }
    function activeTextLayer(){
      var l = findLayerAnySide(pm.activeLogoId);
      return (l && l.text) ? l : null;
    }

    /* ── Правка напису прямо в рамці ──────────────────────────────────── */
    function bindTextEl(el, layer){
      el.addEventListener('input', function(){
        var t = el.innerText.replace(/\u00a0/g, ' ').replace(/\u200b/g, '');
        // Два рядки — стеля: третій уже не напис, а абзац, і на виробі не читається
        var ls = t.split('\n');
        if(ls.length > 2){
          t = ls.slice(0, 2).join('\n');
          el.textContent = t;
          textSetCaret(el, t.length);
        }
        layer.text.t = t; layer.textPristine = false;
        layer.fp = textFingerprint(layer.text);   // відбиток міняється разом із текстом
        var url = textToPng(layer.text);
        if(!url) return;
        layer.origUrl = layer.cleanUrl = layer.url = url;
        measureLayerShape(layer, url).then(function(){
          var host = el.closest('.pm-draggable-layer');
          if(host){
            var b = layerBox(layer);
            host.style.width = b.w + 'px'; host.style.height = b.h + 'px';
            styleTextEl(el, layer.text, b.h);
          }
          renderTabPanel(); updatePriceBar();
        }).catch(function(){});
      });
      el.addEventListener('keydown', function(e){
        if(e.key !== 'Enter') return;
        e.preventDefault();
        // Другий рядок — стеля: третій уже не напис, а абзац
        if(el.innerText.replace(/[\n\u200b]+$/, '').indexOf('\n') >= 0) return;
        // Порожній другий рядок браузер не малює, і каретка зістрибує назад
        // — тримаємо його невидимим символом, який у текст напису не йде.
        try{ document.execCommand('insertText', false, '\n\u200b'); }catch(err){}
      });
    }
    function textSetCaret(el, pos){
      try{
        var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, left = pos, r = document.createRange();
        while((n = walk.nextNode())){
          if(left <= n.nodeValue.length){ r.setStart(n, left); r.collapse(true); break; }
          left -= n.nodeValue.length;
          r = null;
        }
        if(!r){ r = document.createRange(); r.selectNodeContents(el); r.collapse(false); }
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }catch(e){}
    }
    // Взяти напис у правку: клавіатура, каретка в кінці. Заготовку виділяємо
    // цілком — перша ж літера її замінює, як у звичних конструкторах.
    function startTextEdit(layer){
      if(!layer || !layer.text) return;
      var again = pm.textEdit === layer.id;
      pm.textEdit = layer.id;
      renderLogoLayers();
      var el = pmLogoLayers.querySelector('.pm-dl-text[data-tid="'+layer.id+'"]');
      if(!el) return;
      el.classList.add('is-edit');
      el.focus({ preventScroll:true });
      if(again) return;          // уже правимо — каретку не чіпаємо
      if(layer.textPristine){
        try{ var r = document.createRange(); r.selectNodeContents(el);
             var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }catch(e){}
      } else {
        textSetCaret(el, (layer.text.t || '').length);
      }
    }
    function stopTextEdit(){
      if(pm.textEdit == null) return;
      pm.textEdit = null;
      var el = pmLogoLayers.querySelector('.pm-dl-text.is-edit');
      if(el){ el.classList.remove('is-edit'); el.blur(); }
    }
    // Заготовку, якої так і не торкнулись, прибираємо: «Ваш напис» на виробі
    // нікому не потрібен, а платити за нього тим більше.
    function dropPristineText(){
      var out = false;
      getViews().forEach(function(side){
        (pm.logos[side] || []).forEach(function(l){
          if(l.text && l.textPristine){ out = true; }
        });
      });
      if(!out) return false;
      getViews().forEach(function(side){
        pm.logos[side] = (pm.logos[side] || []).filter(function(l){ return !(l.text && l.textPristine); });
      });
      if(!findLayerAnySide(pm.activeLogoId)) pm.activeLogoId = null;
      return true;
    }

    /* ── Панель напису над макетом ─────────────────────────────────────── */
    // Одна панель на два випадки: створення нового напису і правка наявного.
    // Різниця лише в тому, куди йдуть зміни — у чернетку чи одразу в шар.
    function textSpec(){
      var l = activeTextLayer();
      if(l) return l.text;
      return { t: pm.textDraft || '', font: pm.textFont || TEXT_FONTS[0].id,
               color: pm.textColor || autoTextColor(), bold: false, italic: false };
    }
    function textApply(patch){
      // Вибір запам'ятовуємо: наступний напис має початись там само, де скінчився попередній
      if(patch.font) pm.textFont = patch.font;
      if(patch.color) pm.textColor = patch.color;
      var l = activeTextLayer();
      if(l) updateTextLayer(l, patch);
    }
    // Вишивка не бере дрібний текст: нижче ~5 мм літера збивається в кашу.
    // Краще сказати про це тут, ніж переробляти партію за свій рахунок.
    var EMB_MIN_LETTER_MM = 5;
    function textWarnHtml(){
      var l = activeTextLayer();
      if(!l || getPrint().id !== 'embro') return '';
      var d = layerDimsMm(l);
      var lines = String(l.text.t || '').split('\n').filter(function(x){ return x.trim(); }).length || 1;
      var letterMm = d.h / lines / 1.35;      // висота літери без міжрядкового просвіту
      if(letterMm >= EMB_MIN_LETTER_MM) return '';
      return 'Літери ~' + Math.round(letterMm) + ' мм — для вишивки треба від ' +
             EMB_MIN_LETTER_MM + ' мм. Збільште напис.';
    }
    function textMode(){ return !!(pm.textOpen || activeTextLayer()); }
    // Темний виріб — світла рамка і світлий значок, інакше вони зникають.
    function hexIsDark(hex){
      var h = String(hex || '').replace('#', '');
      if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      if(h.length < 6) return false;
      var r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
      return (0.299*r + 0.587*g + 0.114*b) < 140;
    }
    // Подвійний шеврон був потрібен, поки поруч жила стрілка «відкрити».
    // Її замінила кнопка «Змінити», тож гортання лишилось саме — і читається
    // спокійніше одинарним.
    var SCROLL_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 6l6 6-6 6"/></svg>';
    var SCROLL_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 6l-6 6 6 6"/></svg>';
    var TS_CHEV = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    var TS_BACK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
    // Панель форматування: назад · шрифт · B · I · колір. Без рамки й підписів —
    // що роблять ці кнопки, видно з них самих, а висота на першому екрані дорога.
    function textStripHtml(){
      var sp = textSpec();
      if(pm.textScreen === 'colors') return textColorsHtml(sp);
      var f = textFont(sp.font);
      var msg = textWarnHtml();
      var h = '<div class="pm-text-strip"><div class="pm-ts-card">' +
        '<div class="pm-ts">' +
        '<button class="pm-ts-back" id="pmTsBack" aria-label="Назад до дизайну">' + TS_BACK +
          '<b>Назад</b></button>' +
        '<button class="pm-ts-sel" data-tsdrop="font" ' +
          'style="font-family:' + f.css.replace('__SF__', 'inherit') + '">' +
          '<span>' + f.name + '</span>' + TS_CHEV + '</button>' +
        '<button class="pm-ts-tog' + (sp.bold ? ' on' : '') + '" id="pmTsBold" ' +
          'style="font-weight:700" aria-label="Жирний">B</button>' +
        '<button class="pm-ts-tog' + (sp.italic ? ' on' : '') + '" id="pmTsItal" ' +
          'style="font-style:italic" aria-label="Курсив">I</button>' +
        '</div>';
      // Кольори — прямо тут, а не за окремим заходом. Перший кружечок веде в
      // палітру: точний фірмовий відтінок зразками не вгадаєш.
      h += '<div class="pm-tsc"><button class="pm-tsc-pal" data-tsnav="colors" ' +
          'aria-label="Своя палітра"><i></i></button>' +
        '<div class="pm-scroll-wrap pm-tsc-wrap">' +
        '<button class="pm-scroll-arrow pm-scroll-arrow--left" aria-label="Назад">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button><div class="pm-tsc-list pm-scroll-list">' +
        TEXT_COLORS.map(function(c){
          return '<button class="pm-ts-sw' + (c === sp.color ? ' on' : '') + '" data-tc="' + c + '" ' +
                 'style="background:' + c + '" aria-label="' + colorName(c) + '"></button>';
        }).join('') +
        '</div><button class="pm-scroll-arrow pm-scroll-arrow--right" aria-label="Далі">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</button></div></div>';
      if(msg) h += '<div class="pm-ts-warn">' + msg + '</div>';
      return h + '</div></div>';
    }
    // Екран палітри: зразки лишились у панелі, тут — лише точний підбір.
    // Назви кольору немає: вона займала рядок, а що обирають — і так видно.
    function textColorsHtml(sp){
      var cur = pm.pickColor || sp.color || TEXT_COLORS[0];
      var hsv = hexToHsv(cur);
      return '<div class="pm-scr">' +
        '<button class="pm-scr-back" data-tsnav="main" aria-label="Назад">' + TS_BACK + '<b>Назад</b></button>' +
        '<div class="pm-scr-body">' +
          '<div class="pm-ts-sv" id="pmTsSv" style="background:' + svBg(hsv.h) + '">' +
            '<i class="pm-ts-dot" style="left:' + (hsv.s*100).toFixed(1) + '%;top:' +
              ((1-hsv.v)*100).toFixed(1) + '%;background:' + cur + '"></i>' +
          '</div>' +
          '<input type="range" class="pm-ts-sl" id="pmTsH" min="0" max="360" value="' + Math.round(hsv.h) + '" ' +
            'style="background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" aria-label="Відтінок">' +
        '</div></div>';
    }
    // Список гарнітур живе поза панеллю, у body: інакше його ріже прокрутка
    // вкладки, і з двадцяти шрифтів було б видно три.
    function renderFontList(){
      var old = document.getElementById('pmTsFonts');
      if(old) old.remove();
      if(pm.textDrop !== 'font' || !textMode() || pm.textScreen) return;
      var trig = pmTabPanel.querySelector('[data-tsdrop="font"]');
      if(!trig) return;
      var sp = textSpec();
      var d = document.createElement('div');
      d.id = 'pmTsFonts'; d.className = 'pm-ts-fonts';
      // Список накриває макет, і без явного виходу з нього люди тикали в стрілки
      // гортання. Тому вгорі — той самий підписаний «Назад», що й на підекранах.
      d.innerHTML = '<button class="pm-ts-fonts-back" id="pmTsFontsBack">' + TS_BACK +
          '<b>Назад</b></button>' +
        '<div class="pm-ts-fonts-list">' + TEXT_FONTS.map(function(x){
          return '<button class="pm-ts-opt' + (x.id === sp.font ? ' on' : '') + '" data-tf="' + x.id + '" ' +
                 'style="font-family:' + x.css.replace('__SF__', 'inherit') + '">' + x.name + '</button>';
        }).join('') + '</div>';
      document.body.appendChild(d);
      var r = trig.getBoundingClientRect();
      var w = Math.min(window.innerWidth - 20, 208);   // назви короткі — ширше ні до чого
      d.style.left = Math.round(Math.min(Math.max(10, r.left), window.innerWidth - w - 10)) + 'px';
      d.style.width = Math.round(w) + 'px';
      d.style.bottom = Math.round(window.innerHeight - r.top + 8) + 'px';
      d.style.maxHeight = Math.max(150, Math.min(300, r.top - 74)) + 'px';
      var fb = document.getElementById('pmTsFontsBack');
      if(fb) fb.addEventListener('click', function(e){
        e.stopPropagation(); pm.textDrop = null; renderTabPanel();
      });
      d.querySelectorAll('[data-tf]').forEach(function(el){
        el.addEventListener('click', function(){
          pm.textDrop = null;                 // обрали шрифт — список закривається сам
          textApply({ font: el.dataset.tf });
          renderTabPanel();
        });
      });
      setTimeout(function(){
        document.addEventListener('click', function off(e){
          if(e.target.closest('#pmTsFonts') || e.target.closest('[data-tsdrop="font"]')) return;
          document.removeEventListener('click', off);
          if(pm.textDrop === 'font'){ pm.textDrop = null; renderTabPanel(); }
        });
      }, 0);
    }
    function svBg(h){
      return 'linear-gradient(to top,#000,rgba(0,0,0,0)),' +
             'linear-gradient(to right,#fff,' + hsvToHex(h, 1, 1) + ')';
    }
    function hsvToHex(h, sv, v){
      h = ((h % 360) + 360) % 360;
      sv = Math.min(1, Math.max(0, sv)); v = Math.min(1, Math.max(0, v));
      var c = v * sv, x = c * (1 - Math.abs((h/60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
      if(h < 60){ r=c; g=x; } else if(h < 120){ r=x; g=c; } else if(h < 180){ g=c; b=x; }
      else if(h < 240){ g=x; b=c; } else if(h < 300){ r=x; b=c; } else { r=c; b=x; }
      var f = function(z){ return ('0' + Math.round((z+m)*255).toString(16)).slice(-2); };
      return '#' + f(r) + f(g) + f(b);
    }
    function hexToHsv(hex){
      var q = String(hex || '').replace('#','');
      if(q.length === 3) q = q[0]+q[0]+q[1]+q[1]+q[2]+q[2];
      var r = (parseInt(q.slice(0,2),16)||0)/255, g = (parseInt(q.slice(2,4),16)||0)/255,
          b = (parseInt(q.slice(4,6),16)||0)/255;
      var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn, h = 0;
      if(d){
        if(mx === r) h = ((g-b)/d + (g < b ? 6 : 0));
        else if(mx === g) h = (b-r)/d + 2;
        else h = (r-g)/d + 4;
        h *= 60;
      }
      return { h: h, s: mx ? d/mx : 0, v: mx };
    }
    function isHex(v){ return /^#[0-9a-fA-F]{6}$/.test(String(v || '')); }
    // Від поля під макетом лишилась тільки перевірка режиму: вийшли з «Дизайну»
    // або з напису — правку в рамці треба закрити, щоб каретка не зависла.
    function syncTextBar(){
      if(pm.textEdit != null && (!textMode() || pm.tab !== 'photo')) stopTextEdit();
    }
    function openTextBar(layer){
      pm.textDrop = null; pm.textScreen = null; tsLock = 0;
      goTab('photo');
      if(!layer) layer = addTextLayer();      // напис одразу на виробі
      if(!layer) return;
      pm.activeLogoId = layer.id; pm.textOpen = false;
      renderTabPanel();
      startTextEdit(layer);
      // Шрифт міг ще не доїхати — тоді canvas міряв запасну гарнітуру.
      loadTextFonts().then(function(){
        var l = findLayerAnySide(pm.activeLogoId);
        if(l && l.text) updateTextLayer(l, {});
      });
    }
    function closeTextBar(){
      stopTextEdit(); tsLock = 0;
      pm.textOpen = false; pm.textDrop = null; pm.textScreen = null;
      var dropped = dropPristineText();
      if(activeTextLayer()) pm.activeLogoId = null;
      renderGarment(); renderTabPanel();
      if(dropped) updatePriceBar();
    }
    function addLogo(origUrl, cleanUrl, textSpec){
      if(window.lqAn){
        window.lqAn.step('design');
        window.lqAn.track(textSpec ? 'text_add' : 'logo_upload', { garment: pm.garmentId, side: pm.side });
      }
      var hasClean = !!cleanUrl;
      var url = hasClean?cleanUrl:origUrl;
      var off = pm.logos[pm.side].length * 24;   // невеликий зсув, щоб кожне нове лого було видно окремо
      var anc = printAreaAnchorPx() || {x:0, y:0};   // нове лого лягає в центр зони нанесення
      var layer = {id:Date.now(), origUrl:origUrl, cleanUrl:cleanUrl||origUrl,
        url:url, x:anc.x+off, y:anc.y+off, scale:defaultLogoScale(), rot:0, removeBg:hasClean, ar:1,
        // Ознака «це напис» лишається на шарі: за нею і редагування, і окремі ціни
        text: textSpec ? JSON.parse(JSON.stringify(textSpec)) : null};
      layerSaveFrac(layer);            // розмір і місце — одразу в частках
      pm.logos[pm.side].push(layer);   // кілька лого на одній стороні
      pm.activeLogoId = layer.id;
      // Завантажив дизайн — маєш його побачити. Інакше людина лишалась на
      // вкладці «Товар» і не розуміла, чи взагалі щось додалось.
      goTab('photo');
      renderGarment();
      renderTabPanel();
      updatePriceBar();
      // пропорції лого + fill/opaqueBox → рамка облягає контур і площа вишивки коректна
      measureLayerShape(layer, url).then(function(){
        renderLogoLayers();
        updatePriceBar();
        try{ renderRecommended(); }catch(e){}   // рекомендовані одягають те саме лого
      }).catch(function(){});
    }
    // Перегенерація: той самий шар, нова картинка. Позиція, розмір і поворот
    // лишаються — менеджеру не треба вкотре вирівнювати логотип.
    function replaceLayerImage(layer, origUrl, cleanUrl){
      layer.origUrl = origUrl;
      layer.cleanUrl = cleanUrl || origUrl;
      layer.url = layer.removeBg ? layer.cleanUrl : layer.origUrl;
      layer.recolorFrom = null;                // після перегенерації фарбувати нічого повертати
      return measureLayerShape(layer, layer.url).then(function(){
        renderGarment(); renderTabPanel(); updatePriceBar();
      });
    }
    function removeLogo(id){
      pm.logos[pm.side] = pm.logos[pm.side].filter(function(l){return l.id!==id;});
      pm.activeLogoId = null;
      renderGarment();
      renderTabPanel();
      updatePriceBar();
      try{ renderRecommended(); }catch(e){}
    }

    // Drag / rotate / scale — shared pointer state, matches original DraggableLayer exactly
    function getXY(e){ return e.touches ? {x:e.touches[0].clientX, y:e.touches[0].clientY} : {x:e.clientX, y:e.clientY}; }
    function touchDist(e){
      var t = e.touches; if(!t || t.length < 2) return 0;
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    }
    // Прокрутку під час жесту глушить preventDefault у onDlMove — overflow не чіпаємо,
    // щоб інтерфейс не стрибав (інакше ціна "втікала" вниз під час масштабування).
    function lockScroll(){}
    function unlockScroll(){}
    var dlState = {mode:null};

    // Оновлюємо стиль наявного елемента напряму (без перебудови DOM) — щоб не глючило під час жесту
    function applyLayerStyle(el, layer){
      if(!el) return;
      var sz = Math.round(120 * layer.scale);
      var ar = layer.ar || 1;
      var bw = sz, bh = sz;
      if(ar >= 1){ bh = Math.round(sz/ar); } else { bw = Math.round(sz*ar); }
      el.style.width = bw + 'px';
      el.style.height = bh + 'px';
      el.style.transform = 'translate(calc(-50% + '+layer.x+'px), calc(-50% + '+layer.y+'px)) rotate('+(layer.rot||0)+'deg)';
      // Кегль напису має тягнутись за пальцем разом із рамкою. Інакше текст
      // лишався старого розміру й стрибав аж коли палець відпускали.
      if(layer.text){
        var tx = el.querySelector('.pm-dl-text');
        if(tx) styleTextEl(tx, layer.text, bh);
      }
    }

    function onImgDown(e, layer){
      e.stopPropagation();
      // Поки напис правлять, дотик не блокуємо: інакше браузер не поставить
      // каретку й не відкриє клавіатуру. Перетягування все одно працює —
      // onDlMove перехопить рух і зупинить прокрутку сам.
      if(!(layer.text && pm.textEdit === layer.id)) e.preventDefault();
      var wasActive = pm.activeLogoId === layer.id;
      pm.activeLogoId = layer.id;
      if(!wasActive) renderLogoLayers();   // показати рамку/маркери лише при першому виділенні
      lockScroll();
      var el = pmLogoLayers.querySelector('[data-layer-id="'+layer.id+'"]');
      if(e.touches && e.touches.length >= 2){
        if(pmTabPanel) pmTabPanel.style.display = 'none';   // підняти ціну, щоб було видно її зміну
        dlState = {mode:'pinch', layer:layer, el:el, startDist:touchDist(e), startScale:layer.scale};
      } else {
        var p = getXY(e);
        dlState = {mode:'drag', layer:layer, el:el, startX:p.x, startY:p.y,
                   startLX:layer.x, startLY:layer.y, moved:false, wasActive:wasActive};
      }
    }
    function onScaleDown(e, layer){
      e.stopPropagation(); e.preventDefault(); lockScroll();
      if(pmTabPanel) pmTabPanel.style.display = 'none';   // підняти ціну, щоб було видно її зміну
      var el = pmLogoLayers.querySelector('[data-layer-id="'+layer.id+'"]');
      var p = getXY(e);
      dlState = {mode:'scale', layer:layer, el:el, startX:p.x, startY:p.y, startScale:layer.scale};
    }
    function onRotateDown(e, layer, el){
      e.stopPropagation(); e.preventDefault(); lockScroll();
      var rect = el.getBoundingClientRect();
      var cx = rect.left+rect.width/2, cy = rect.top+rect.height/2;
      var p = getXY(e);
      var angle = Math.atan2(p.y-cy, p.x-cx)*(180/Math.PI);
      dlState = {mode:'rotate', layer:layer, el:el, cx:cx, cy:cy, startAngle:angle, startRot:layer.rot||0};
    }
    function onDlMove(e){
      if(!dlState.mode) return;
      e.stopPropagation();
      if(e.cancelable) e.preventDefault();
      var p = getXY(e);
      var layer = dlState.layer;
      if(dlState.mode === 'drag'){
        if(Math.abs(p.x - dlState.startX) > 5 || Math.abs(p.y - dlState.startY) > 5) dlState.moved = true;
        var z = garmentZoom();   // компенсуємо зум мокапа, щоб лого рухалось за пальцем 1:1
        layer.x = dlState.startLX + (p.x - dlState.startX)/z;
        layer.y = dlState.startLY + (p.y - dlState.startY)/z;
      } else if(dlState.mode === 'scale'){
        var dy = p.y - dlState.startY;   // вниз = більше, вгору = менше
        layer.scale = Math.max(0.04, Math.min(5, dlState.startScale + dy/80));
      } else if(dlState.mode === 'pinch'){
        if(e.touches && e.touches.length >= 2){
          var d = touchDist(e);
          if(dlState.startDist > 0) layer.scale = Math.max(0.04, Math.min(5, dlState.startScale * (d / dlState.startDist)));
        }
      } else if(dlState.mode === 'rotate'){
        var a = Math.atan2(p.y-dlState.cy, p.x-dlState.cx)*(180/Math.PI);
        layer.rot = dlState.startRot + (a - dlState.startAngle);
      }
      /* Частку ширини виробу оновлюємо НА КОЖНОМУ русі, а не лише коли жест
         закінчився. Саме в ній живе фізичний розмір нанесення, і саме від неї
         рахується ціна. Доти під час перетягування ціна лишалась старою —
         виглядало це так, ніби вона зависла, — а на відпусканні різко
         стрибала. Гірше: перемальовування посеред жесту брало стару частку й
         повертало логотипу попередній розмір, тож рух читався навпаки:
         зменшуєш, а стає більше. */
      layerSaveFrac(layer);
      applyLayerStyle(dlState.el, layer);              // пряме оновлення без перебудови DOM
      updateModelLogos();                               // синхронізуємо лого на фото моделей наживо
      try{ renderPrintArea(); }catch(e){}               // зона нанесення реагує наживо (червоніє за межами)
      if(dlState.mode === 'scale' || dlState.mode === 'pinch') updatePriceLive();   // легке оновлення ціни наживо
    }
    var dlGuard = 0;
    function onDlUp(){ if(dlState.mode){ if(pmTabPanel) pmTabPanel.style.display = '';
      // Палець відривається вже поза рамкою — і клік летить у фон, знімаючи
      // виділення. Після жесту фон коротко не слухає.
      dlGuard = 1; setTimeout(function(){ dlGuard = 0; }, 350);
      // Тап без руху по вже виділеному напису — це намір його переписати.
      var edit = (dlState.mode === 'drag' && !dlState.moved && dlState.wasActive &&
                  dlState.layer && dlState.layer.text) ? dlState.layer : null;
      // Жест закінчився — фіксуємо результат у частках ширини виробу, щоб
      // на іншому екрані він відтворився один в один
      if(dlState.layer) layerSaveFrac(dlState.layer);
      renderLogoLayers(); renderTabPanel();
      // після зміни розміру напис міг стати замалим для вишивки — попередження
      // рахується від міліметрів, тож має перерахуватись саме тут
      try{ syncTextBar(); }catch(e){}
      // Пересунули чи змінили лого — рекомендовані мають показати те саме,
      // інакше картка обіцяє одне, а на виробі стоїть інше.
      if(dlState.moved) try{ renderRecommended(); }catch(e){}
      if(edit) startTextEdit(edit); }
      dlState = {mode:null}; unlockScroll(); }
    window.addEventListener('mousemove', onDlMove, {passive:false});
    window.addEventListener('touchmove', onDlMove, {passive:false});
    window.addEventListener('mouseup', onDlUp);
    window.addEventListener('touchend', onDlUp);

    // Deselect active layer when tapping the garment background
    document.getElementById('pmGarmentWrap').addEventListener('click', function(e){
      if(e.target.closest('.pm-draggable-layer')) return;
      if(dlGuard) return;
      if(pm.activeLogoId !== null){
        var wasText = !!activeTextLayer();
        stopTextEdit();
        // Знявши виділення з напису, виходимо і з режиму оформлення — інакше
        // у «Дизайні» лишалась смуга без напису, до якого вона належала.
        if(wasText){
          tsLock = 0; pm.textDrop = null; pm.textScreen = null;
          var dropped = dropPristineText();
          pm.activeLogoId = null; renderLogoLayers(); renderTabPanel();
          if(dropped) updatePriceBar();
          return;
        }
        pm.activeLogoId = null; renderLogoLayers();
      }
    });

    // Delete confirmation popup
    var pmDeleteTargetId = null;
    function openDeleteConfirm(id){ pmDeleteTargetId = id; document.getElementById('pmTrashModal').classList.add('open'); }
    document.getElementById('pmTrashCancelBtn').addEventListener('click', function(){
      document.getElementById('pmTrashModal').classList.remove('open');
    });
    document.getElementById('pmTrashConfirmBtn').addEventListener('click', function(){
      if(pmDeleteTargetId !== null) removeLogo(pmDeleteTargetId);
      document.getElementById('pmTrashModal').classList.remove('open');
    });

    var pmLastTab = null;
    var tsLock = 0;
    // «Футболка оверсайз» → «Футболка» + «Оверсайз». Крій — окремим рядком:
    // так у стрічці видно тип одягу, а не обрізану назву.
    function garmentTitleFit(id, fallback){
      var full = String(window.LQ_name(id, fallback) || '').trim();
      var i = full.indexOf(' ');
      if(i < 0) return { title: full, fit: '' };
      var fit = full.slice(i + 1).trim();
      return { title: full.slice(0, i), fit: fit ? fit[0].toUpperCase() + fit.slice(1) : '' };
    }
    function renderTabPanel(){
      // Екран палітри під пальцем перебудовувати не можна — див. tsLock нижче.
      // Але тільки поки лишаємось на тій самій вкладці: кнопки вкладок ставлять
      // pm.tab напряму, і без цієї умови «Товар» просто не малювався.
      if(tsLock && pm.textScreen === 'colors' && pmLastTab === pm.tab) return;
      tsLock = 0;
      if(pm.tab !== 'photo'){ pm.textScreen = null; pm.textDrop = null; }
      // зберігаємо позицію горизонтальної прокрутки списку, якщо вкладка не змінилась
      var sameTab = (pmLastTab === pm.tab);
      var prevList = sameTab ? pmTabPanel.querySelector('.pm-scroll-list') : null;
      var prevScroll = prevList ? prevList.scrollLeft : 0;
      pmLastTab = pm.tab;
      // Поле набору живе на макеті, але належить вкладці «Дизайн»: пішли на
      // «Розмір» — поле ховається разом зі смугою оформлення.
      try{ syncTextBar(); }catch(e){}
      var html = '';
      if(pm.tab === 'photo'){
        var layers = currentLayers();
        if(textMode()){
          // Режим напису: замість плиток — смуга оформлення. Поле набору
          // лишається на макеті, тут лише те, чим напис оформлюють.
          html = textStripHtml();
        } else {
          // Показуємо лого з УСІХ сторін одразу. Інакше клієнт бачить одну картинку
          // і не розуміє, за що саме ціна: перемикати сторони, щоб порахувати
          // нанесення, він не буде. Сторони розділяє риска, підписів немає —
          // панель має лишатись тієї самої висоти.
          var groups = photoGroups();
          var multi = groups.length > 1;
          // Плитка дизайну — того ж кольору, що й виріб: інакше світлий друк
          // на білому тлі просто не видно, і клієнт не розуміє, що там лежить.
          var cThumb = (typeof getColor === 'function' && getColor()) || {};
          var thumbBg = cThumb.hex || '#f0f0f0';
          var thumbDark = hexIsDark(thumbBg);
          // Поки нічого не додано, дві плитки розтягуються на всю ширину по
          // половині: інакше вони тулились дрібними квадратиками зліва, а
          // праворуч зяяла порожнеча. Щойно щось є — стають компактними.
          /* Логотипи, завантажені в картці клієнта, — перед плитками дизайну.
             Один клік, і лого на поточній стороні. Завантажувати той самий
             файл для кожного виробу окремо було найдовшою частиною збирання
             пропозиції. Самі ми лого нікуди не ставимо: для футболки це груди,
             для кепки центр, для худі спина — за менеджера не вгадаєш. */
          html = '<div class="pm-photo-filled'+(logoCount() === 0 ? ' is-empty' : '')+'">' +
            orderLogosHtml();
          groups.forEach(function(gr, gi){
            var isCur = gr.side === pm.side;   // 'multi' лишається для приглушення чужих боків
            html += '<div class="pm-photo-group'+(isCur?'':' is-other')+'">';
            html += '<div class="pm-photo-group-row">';
            gr.layers.forEach(function(l){
              var isActive = isCur && pm.activeLogoId === l.id;
              html += '<div class="pm-photo-col">' +
                '<div class="pm-photo-thumb'+(thumbDark?' on-dark':'')+'" data-id="'+l.id+'" data-side="'+gr.side+'" ' +
                  'style="background:'+thumbBg+';border-color:'+(isActive?(thumbDark?'#fff':'#111'):'rgba(0,0,0,.12)')+';">' +
                  '<img src="'+l.url+'">' + (isActive ? '<div class="pm-photo-thumb-del" data-del="'+l.id+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>' : '') +
                  '<button class="pm-bg-dot'+(l.removeBg?' on':'')+'" data-bgtoggle="'+l.id+'" title="'+(l.removeBg?'Фон прибрано — повернути':'Прибрати фон')+'" aria-label="Прибрати фон">' +
                    (l.removeBg
                      ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
                      : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 20 20 4M4 4l16 16"/></svg>') +
                  '</button>' +
                '</div>' +
              '</div>';
            });
            // «Додати лого» живе в групі поточної сторони — щоб було видно, куди саме додається
            // Обидва способи додати — плитки того ж розміру, що й мініатюри.
            // Раніше велика зона завантаження й дрібна кнопка тексту читались
            // як дві різні функції, хоча дія одна: покласти щось на виріб.
            if(isCur){
              var big = logoCount() === 0;   // плитки на всю ширину — там доречний заклик
              html += '<div class="pm-photo-add" id="pmPhotoAddMore">' +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L6 20"/></svg>' +
                '<span>' + (big ? 'Додайте фото' : 'Додати фото') + '</span></div>' +
              '<div class="pm-photo-add pm-photo-add--text" id="pmTextOpenTile">' +
                '<span class="pm-photo-add-ab">Aa</span>' +
                '<span>' + (big ? 'Додайте текст' : 'Додати текст') + '</span></div>';
            }
            html += '</div></div>';
          });
          html += '</div>';
          // Менеджеру — доробити вже наявний логотип: перегенерувати або перефарбувати
          var actL = findLayerAnySide(pm.activeLogoId) || layers[0];
          if(IS_MANAGER && actL){
            /* Колір нитки — інструмент МЕНЕДЖЕРА, і тільки його. Клієнту цієї
               кнопки немає навмисно: перефарбований на екрані логотип обіцяв
               би вигляд, якого ніхто не погоджував. А от менеджеру вона
               потрібна щодня: те саме лого вишивають однією ниткою, і на
               замовлення в іншому кольорі треба показати саме той колір, а не
               просити дизайнера перемалювати файл заради одного слайда. */
            var recolorOn = pm.recolorFor === actL.id;
            html += '<div class="pm-mgr-tools">' +
              '<button class="pm-mgr-tool" data-ai-regen="'+actL.id+'">✨ Перегенерувати</button>' +
              '<button class="pm-mgr-tool" data-crop="'+actL.id+'">✂ Обрізати</button>' +
              '<button class="pm-mgr-tool" data-recolor="'+actL.id+'">🎨 Колір нитки</button>' +
              (actL.recolorFrom ? '<button class="pm-mgr-tool" data-recolor-reset="'+actL.id+'">↩ Повернути колір</button>' : '') +
            '</div>';
            if(recolorOn){
              /* Зразки — реальні нитки й плівка, ті самі, що й для напису.
                 Вільна палітра поруч, але окремо: фірмовий відтінок буває
                 точний, а вгадувати його зразками — марна справа. */
              var now = actL.recolorTo || '#111111';
              html += '<div class="pm-mgr-recolor">' +
                '<div class="pm-lbl">Звести логотип в один колір</div>' +
                '<div class="pm-mgr-sw">' +
                  '<input type="color" id="pmRecolorPick" value="' + now + '" ' +
                    'aria-label="Точний відтінок">' +
                  TEXT_COLORS.map(function(c){
                    return '<button class="pm-ts-sw' + (c === actL.recolorTo ? ' on' : '') + '" ' +
                           'data-sw="' + c + '" style="background:' + c + '" ' +
                           'aria-label="' + colorName(c) + '"></button>';
                  }).join('') +
                '</div>' +
                '<div class="pm-ts-warn">Форма й розмір не змінюються — отже й ціна теж. ' +
                  'Повернути початкові кольори можна будь-коли.</div>' +
              '</div>';
            }
          }
        }
        // Текст — той самий логотип, лише намальований нами. Тому йде тим самим
        // шляхом: стає шаром, тягнеться, масштабується й рахується за площею.
        // Спосіб нанесення — властивість логотипа, тож і зʼявляється разом із ним.
        // Обирати друк чи вишивку, коли наносити ще нічого, немає сенсу — і рядок
        // дарма займав би висоту на першому екрані.
        // Спосіб нанесення — вибір ОДНОГО з двох, тож сегментна смуга, а не плитки:
        // плитками він читався б як «додай ще щось», а це інша дія. Заголовок
        // відділяє його від дизайну, розмір друку йде в той самий рядок справа,
        // щоб не займати окремий.
        // У режимі напису спосіб нанесення не показуємо: він стосується всього
        // виробу й обирається на основному екрані, а тут лише оформлюють текст.
        if(logoCount() > 0 && !textMode()){
          html += '<div class="pm-way-head"><span class="pm-lbl">Нанесення</span>' +
            '<button class="pm-way-info" id="pmWayInfo" aria-label="Чим відрізняються способи">ⓘ</button>' +
            '<span class="pm-way-size" id="pmPrintSize"></span></div>' +
            '<div class="pm-seg">' +
              PRINTS.map(function(pr){
                return '<button class="pm-seg-btn'+(pr.id===getPrint().id?' on':'')+'" data-print="'+pr.id+'">' +
                  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+pr.icon+'</svg>' +
                  pr.name + '</button>';
              }).join('') +
            '</div>';
          if(pm.wayInfo){
            html += '<div class="pm-way-note">' +
              PRINTS.map(function(pr){ return '<b>'+pr.name+'</b> — '+pr.desc; }).join('<br>') + '</div>';
          }
        }
      } else if(pm.tab === 'garment'){
        var cNow2 = getColor() || {};
        var gName = window.LQ_name(pm.garmentId, (getGarment() || {}).name || '');
        if(pm.garmentPick){
          // Вибір типу одягу розгортається на все поле панелі й закриває собою
          // рядок: одночасно на екрані лишається один рівень, як у кольорі напису.
          html = '<div class="pm-scr">' +
            '<button class="pm-scr-back" id="pmGpBack" aria-label="Назад">' + TS_BACK + '<b>Назад</b></button>' +
            '<div class="pm-scr-body">' +
            '<div class="pm-scroll-wrap"><button class="pm-scroll-arrow pm-scroll-arrow--left" aria-label="Назад">' +
            SCROLL_L +
            '</button><div class="pm-gp-list pm-scroll-list">';
          GARMENTS.forEach(function(g){
            var sel = g.id === pm.garmentId;
            var thumb = window.LQ_img(garmentThumbSrc(g.id) || GARMENT_THUMB[g.id]);
            var ic = thumb
              ? '<img src="' + escAttr(thumb) + '" alt="">'
              : '<svg viewBox="0 0 100 100" fill="none" stroke="' + (sel ? '#111' : '#aaa') + '" ' +
                'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="' + g.path + '"/>' +
                (g.extra ? '<path d="' + g.extra + '"/>' : '') + '</svg>';
            var nm = garmentTitleFit(g.id, g.name);
            html += '<button class="pm-gp-card' + (sel ? ' on' : '') + '" data-garment="' + g.id + '">' +
              (sel ? '<span class="pm-gp-ok"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" ' +
                     'stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">' +
                     '<path d="M20 6 9 17l-5-5"/></svg></span>' : '') +
              ic +
              '<span class="pm-gp-nm">' + escAttr(nm.title) + '</span>' +
              '<span class="pm-gp-fit">' + escAttr(nm.fit) + '</span></button>';
          });
          html += '<button class="pm-gp-card is-cat" id="pmGarmentCatalogCta">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
              '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' +
            '</svg><span class="pm-gp-nm">Каталог</span><span class="pm-gp-fit">усі вироби</span></button>';
          html += '</div><button class="pm-scroll-arrow pm-scroll-arrow--right" aria-label="Далі">' +
            SCROLL_R +
            '</button></div></div></div>';
        } else {
          html = '<button class="pm-grow" id="pmGarmentRow">' +
              '<span class="pm-grow-txt">' +
                '<span class="pm-grow-k">Тип одягу</span>' +
                '<span class="pm-grow-v">' + escAttr(gName) +
                  (cNow2.name ? ' (' + escAttr(cNow2.name) + ')' : '') + '</span>' +
              '</span>' +
              '<span class="pm-grow-btn">Змінити</span>' +
            '</button>';
          // Колір лишається кружечками в рядку: провалюватись заради нього
          // немає сенсу — вибір видно й так, і робиться одним тапом.
          // Кольорів більше, ніж влазить у рядок. Без стрілки ніхто не здогадувався,
          // що ряд гортається, і бачив лише перші сім.
          html += '<div class="pm-color-row"><div class="pm-scroll-wrap">' +
            '<button class="pm-scroll-arrow pm-scroll-arrow--left" aria-label="Назад">' +
              SCROLL_L +
            '</button><div class="pm-color-list pm-scroll-list">' +
            getColors().map(function(c){
              return '<button class="pm-color-swatch' + (c.id === pm.colorId ? ' active' : '') + '" ' +
                     'data-color="' + c.id + '" style="background:' + c.hex + ';" title="' + c.name + '"></button>';
            }).join('') +
            '</div><button class="pm-scroll-arrow pm-scroll-arrow--right" aria-label="Далі">' +
              SCROLL_R +
            '</button></div></div>';
        }
      } else if(pm.tab === 'size'){
        var oneSize = isOneSize();
        var sizes = getSizes();
        // Лічильник керує ОДНИМ розміром — тим, якого торкались востаннє.
        // Якщо ще не торкались, беремо перший набраний, інакше показуємо підказку.
        var foc = sizes.indexOf(pm.sizeFocus) >= 0 ? pm.sizeFocus : null;
        if(!foc) for(var fi = 0; fi < sizes.length; fi++){ if(pm.qty[sizes[fi]] > 0){ foc = sizes[fi]; break; } }
        if(oneSize) foc = sizes[0];
        var fv = foc ? (pm.qty[foc] || 0) : 0;
        var step = foc
          ? ('<div class="pm-size-step">' +
              '<span class="pm-size-step-sz">' + (oneSize ? 'шт' : escAttr(foc)) + '</span>' +
              '<button class="pm-size-step-btn minus"' + (fv > 0 ? '' : ' disabled') +
                ' data-size-minus="' + escAttr(foc) + '" aria-label="Менше">−</button>' +
              '<span class="pm-size-step-val">' + fv + '</span>' +
              '<button class="pm-size-step-btn plus" data-size-plus="' + escAttr(foc) + '" aria-label="Більше">+</button>' +
            '</div>')
          : '<span class="pm-size-hint">Тапніть розмір</span>';
        if(oneSize){
          // розмірна сітка XS–XXL не має сенсу для one-size виробів (кепка) — ховаємо кнопку
          html = '<div class="pm-size-os">' +
            '<button class="pm-size-btn pm-size-btn--os' + (pm.qty[sizes[0]] > 0 ? ' active' : '') +
              '" data-size-select="' + escAttr(sizes[0]) + '">' + escAttr(sizes[0]) + '</button>' +
            step + '</div>';
        } else {
          html = '<div class="pm-size-top">' +
            '<button class="pm-size-chart-btn" id="pmSizeChartBtn">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>Розмірна сітка</button>' +
            step + '</div>';
          html += '<div class="pm-scroll-wrap"><button class="pm-scroll-arrow pm-scroll-arrow--left" aria-label="Назад"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button><div class="pm-size-list pm-scroll-list">';
          sizes.forEach(function(sz){
            var v = pm.qty[sz]||0, active = v>0;
            html += '<div class="pm-size-col">' +
              '<button class="pm-size-btn'+(active?' active':'')+(sz === foc ? ' focus':'')+
                '" data-size-select="'+escAttr(sz)+'">'+escAttr(sz)+'</button>' +
              '<span class="pm-size-cnt">'+(active ? '×'+v : '')+'</span>' +
            '</div>';
          });
          html += '</div><button class="pm-scroll-arrow pm-scroll-arrow--right" aria-label="Далі"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button></div>';
        }
      }
      // Плавно підміняємо вміст ЛИШЕ коли справді змінили вкладку. На кожен
      // перерендер (додали лого, змінили кількість) анімація тільки б заважала.
      pmTabPanel.innerHTML = '<div class="pm-tab-panel-inner'+(sameTab?'':' is-swap')+'">'+html+'</div>';
      pmTabPanel.classList.toggle('is-tall',
        pm.tab === 'photo' && IS_MANAGER && logoCount() > 0);
      // Обʼєднані вкладки мають по два ряди — даємо їм рівно стільки, скільки треба.
      pmTabPanel.classList.toggle('is-two',
        pm.tab === 'garment' || pm.tab === 'photo' || pm.tab === 'size');
      pmTabPanel.style.display = html ? '' : 'none';   // порожня вкладка не займає місця — одразу йде блок ціни
      wireTabPanelEvents();
      setupScrollArrows();
      syncPrintSizeLabel();
      if(prevScroll){
        var newList = pmTabPanel.querySelector('.pm-scroll-list'); if(newList) newList.scrollLeft = prevScroll;
      } else if(pm.tab === 'garment'){
        // при поверненні на вкладку — центруємо вибраний товар/колір, а не скидаємо на початок
        var list2 = pmTabPanel.querySelector('.pm-scroll-list');
        var active = list2 && list2.querySelector('.active');
        if(list2 && active){
          list2.scrollLeft = Math.max(0, active.offsetLeft - (list2.clientWidth - active.clientWidth)/2);
        }
      }
    }

    function wireTabPanelEvents(){
      var garmentCatalogCta = document.getElementById('pmGarmentCatalogCta');
      if(garmentCatalogCta) garmentCatalogCta.addEventListener('click', function(){ catalogModalCtrl.open(); });
      var emptyTrigger = document.getElementById('pmPhotoEmptyTrigger');
      if(emptyTrigger) emptyTrigger.addEventListener('click', function(){ window.__pmPickLogoSource(); });
      var addMore = document.getElementById('pmPhotoAddMore');
      if(addMore) addMore.addEventListener('click', function(){ window.__pmPickLogoSource(); });
      // Логотип замовлення — кладемо як звичайне лого, на поточну сторону
      pmTabPanel.querySelectorAll('[data-order-logo]').forEach(function(el){
        var u = orderLogos()[Number(el.dataset.orderLogo)];
        if(u) el.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")';
        el.addEventListener('click', function(){ if(u) addLogo(u, u, null); });
      });
      pmTabPanel.querySelectorAll('.pm-photo-thumb').forEach(function(el){
        el.addEventListener('click', function(){
          var id = Number(el.dataset.id), side = el.dataset.side;
          if(side && side !== pm.side){
            // мініатюра з іншої сторони — показуємо ту сторону і беремо це лого в роботу
            setSide(side);
            pm.activeLogoId = id;
            renderGarment(); renderTabPanel();
            return;
          }
          var isActive = pm.activeLogoId === id;
          if(isActive){ openDeleteConfirm(id); }
          else { pm.activeLogoId = id; renderGarment(); renderTabPanel(); }
        });
      });
      pmTabPanel.querySelectorAll('[data-ai-regen]').forEach(function(el){
        el.addEventListener('click', function(){
          var id = Number(el.dataset.aiRegen);
          var layer = findLayerAnySide(id);
          if(layer && window.__pmOpenAi) window.__pmOpenAi(layer);
        });
      });
      pmTabPanel.querySelectorAll('[data-crop]').forEach(function(el){
        el.addEventListener('click', function(){
          var id = Number(el.dataset.crop);
          var layer = findLayerAnySide(id);
          if(!layer) return;
          openCropper(layer.url).then(function(res){
            if(!res) return;
            // Ту саму рамку застосовуємо і до версії з фоном, і до версії без —
            // інакше перемикач «З фоном / Без фону» показував би різні кадри.
            return Promise.all([cropImage(layer.origUrl, res.box), cropImage(layer.cleanUrl, res.box)])
              .then(function(p){ return replaceLayerImage(layer, p[0] || res.url, p[1] || res.url); });
          });
        });
      });
      pmTabPanel.querySelectorAll('[data-recolor]').forEach(function(el){
        el.addEventListener('click', function(){
          var id = Number(el.dataset.recolor);
          pm.recolorFor = (pm.recolorFor === id) ? null : id;
          renderTabPanel();
        });
      });
      pmTabPanel.querySelectorAll('[data-recolor-reset]').forEach(function(el){
        el.addEventListener('click', function(){
          var id = Number(el.dataset.recolorReset);
          var layer = findLayerAnySide(id);
          if(layer) resetRecolor(layer);
        });
      });
      pmTabPanel.querySelectorAll('[data-sw]').forEach(function(el){
        el.addEventListener('click', function(){
          var layer = findLayerAnySide(pm.recolorFor);
          if(layer) recolorLogo(layer, el.dataset.sw);
        });
      });
      (function(){
        var pick = pmTabPanel.querySelector('#pmRecolorPick');
        if(!pick) return;
        pick.addEventListener('change', function(){
          var layer = findLayerAnySide(pm.recolorFor);
          if(layer) recolorLogo(layer, pick.value);
        });
      })();
      pmTabPanel.querySelectorAll('[data-bgtoggle]').forEach(function(el){
        el.addEventListener('click', function(e){
          e.stopPropagation();
          var id = Number(el.dataset.bgtoggle);
          var layer = findLayerAnySide(id);
          if(layer){
            layer.removeBg = !layer.removeBg;
            layer.url = layer.removeBg ? layer.cleanUrl : layer.origUrl;
            // перерахунок площі непрозорих пікселів під нову картинку → ціна вишивки міняється
            measureLayerShape(layer, layer.url).then(function(){ renderGarment(); renderTabPanel(); updatePriceBar(); });
          }
        });
      });
      var tOpen = document.getElementById('pmTextOpen') || document.getElementById('pmTextOpenTile');
      if(tOpen) tOpen.addEventListener('click', function(){ openTextBar(null); });
      var tsBack = document.getElementById('pmTsBack');
      if(tsBack) tsBack.addEventListener('click', function(){ closeTextBar(); });
      pmTabPanel.querySelectorAll('.pm-tsc [data-tc]').forEach(function(el){
        el.addEventListener('click', function(){
          pm.pickColor = el.dataset.tc;
          textApply({ color: el.dataset.tc });
          pmTabPanel.querySelectorAll('.pm-tsc [data-tc]').forEach(function(b){
            b.classList.toggle('on', b === el);
          });
        });
      });
      var tsBold = document.getElementById('pmTsBold');
      if(tsBold) tsBold.addEventListener('click', function(){
        textApply({ bold: !textSpec().bold }); renderTabPanel();
      });
      var tsItal = document.getElementById('pmTsItal');
      if(tsItal) tsItal.addEventListener('click', function(){
        textApply({ italic: !textSpec().italic }); renderTabPanel();
      });
      // Один рівень інтерфейсу за раз: екран кольору заміняє панель цілком
      pmTabPanel.querySelectorAll('[data-tsnav]').forEach(function(el){
        el.addEventListener('click', function(){
          tsLock = 0; pm.textScreen = el.dataset.tsnav === 'main' ? null : el.dataset.tsnav;
          renderTabPanel();
        });
      });
      var tsCol = document.getElementById('pmTsColor');
      if(tsCol) tsCol.addEventListener('click', function(){
        // Фокус із напису однаково злітає — знімаємо режим правки чесно,
        // інакше повернення в набір потім не спрацьовувало.
        stopTextEdit();
        pm.textDrop = null; pm.textScreen = 'colors';
        pm.pickColor = textSpec().color; renderTabPanel();
      });
      pmTabPanel.querySelectorAll('[data-tsdrop]').forEach(function(el){
        el.addEventListener('click', function(){
          pm.textDrop = pm.textDrop === el.dataset.tsdrop ? null : el.dataset.tsdrop;
          renderTabPanel();
        });
      });
      (function(){
        var sv = document.getElementById('pmTsSv');
        if(!sv) return;
        var H = document.getElementById('pmTsH');
        var dot = sv.querySelector('.pm-ts-dot');
        var cur = hexToHsv(pm.pickColor || textSpec().color || TEXT_COLORS[0]);
        var st = { h: +H.value, s: cur.s, v: cur.v };
        // Поки водять пальцем, панель перебудовувати не можна: вузол палітри
        // замінився б новим, а жест лишився б на старому — і колір зривався в чорний.
        tsLock = 1;
        function paint(){
          var hex = hsvToHex(st.h, st.s, st.v);
          pm.pickColor = hex;
          sv.style.background = svBg(st.h);
          dot.style.left = (st.s*100).toFixed(1) + '%';
          dot.style.top = ((1-st.v)*100).toFixed(1) + '%';
          dot.style.background = hex;
          textApply({ color: hex });      // видно одразу на виробі
        }
        function pick(e){
          var r = sv.getBoundingClientRect();
          if(!r.width || !r.height) return;
          var t = (e.touches && e.touches[0]) || e;
          st.s = Math.min(1, Math.max(0, (t.clientX - r.left) / r.width));
          st.v = 1 - Math.min(1, Math.max(0, (t.clientY - r.top) / r.height));
          paint();
        }
        function move(e){ if(e.cancelable) e.preventDefault(); pick(e); }
        function up(){
          window.removeEventListener('mousemove', move);
          window.removeEventListener('touchmove', move);
          window.removeEventListener('mouseup', up);
          window.removeEventListener('touchend', up);
        }
        function down(e){
          e.preventDefault(); pick(e);
          window.addEventListener('mousemove', move);
          window.addEventListener('touchmove', move, {passive:false});
          window.addEventListener('mouseup', up);
          window.addEventListener('touchend', up);
        }
        sv.addEventListener('mousedown', down);
        sv.addEventListener('touchstart', down, {passive:false});
        H.addEventListener('input', function(){ st.h = +H.value; paint(); });
      })();
      renderFontList();

      var gRow = document.getElementById('pmGarmentRow');
      if(gRow) gRow.addEventListener('click', function(){ pm.garmentPick = true; renderTabPanel(); });
      var gpBack = document.getElementById('pmGpBack');
      if(gpBack) gpBack.addEventListener('click', function(){ pm.garmentPick = false; renderTabPanel(); });
      // Обраний виріб може стояти сьомим у стрічці — підводимо його під око
      var gpOn = pmTabPanel.querySelector('.pm-gp-card.on');
      if(gpOn) try{ gpOn.scrollIntoView({ block:'nearest', inline:'center' }); }catch(e){}
      var wayInfo = document.getElementById('pmWayInfo');
      if(wayInfo) wayInfo.addEventListener('click', function(){ pm.wayInfo = !pm.wayInfo; renderTabPanel(); });
      pmTabPanel.querySelectorAll('[data-garment]').forEach(function(el){
        el.addEventListener('click', function(){
          pm.garmentPick = false;      // обрали — згортаємось назад у рядок
          pm.garmentId = el.dataset.garment;
          if(window.lqAn) window.lqAn.pick('garment', pm.garmentId);
          pm.sizeFocus = null;         // у нового виробу може бути інша сітка розмірів
          try{ navSetProductGarment(pm.garmentId); }catch(e){}   // reload має повертати саме цей одяг
          // якщо поточний колір недоступний для нового одягу — беремо перший доступний
          if(!getColors().some(function(c){return c.id===pm.colorId;})) pm.colorId = getColors()[0].id;
          // новий виріб може мати іншу кількість ракурсів → скидаємо на «перед» і перебудовуємо крапки
          ensureLogoSides();
          if(getViews().indexOf(pm.side) === -1) pm.side = 'front';
          renderSideDots();
          updateSideArrows();
          renderGarment();
          // Кольори живуть у цій самій вкладці, тож панель треба перебудувати —
          // інакше під новим виробом лишались кольори попереднього. Горизонтальну
          // прокрутку списку renderTabPanel() відновлює сам, тож вона не скидається.
          renderTabPanel();
          updatePriceBar();
        });
      });
      pmTabPanel.querySelectorAll('[data-color]').forEach(function(el){
        el.addEventListener('click', function(){
          pm.colorId = el.dataset.color;
          pm.colorPicked = true;
          if(window.lqAn) window.lqAn.pick('color', (getColor() || {}).name || pm.colorId);
          renderGarment();
          // панель тут не перебудовується (щоб не скидалась прокрутка кольорів),
          // тож назву з кольором у дужках оновлюємо на місці
          var gv = pmTabPanel.querySelector('.pm-grow-v');
          if(gv){
            var cc = getColor() || {};
            gv.textContent = window.LQ_name(pm.garmentId, (getGarment() || {}).name || '') +
                             (cc.name ? ' (' + cc.name + ')' : '');
          }
          // оновлюємо активний колір та назву без перебудови панелі — щоб не скидалась прокрутка списку
          pmTabPanel.querySelectorAll('.pm-color-swatch').forEach(function(s){ s.classList.toggle('active', s.dataset.color === pm.colorId); });
          var nm = pmTabPanel.querySelector('.pm-color-name');
          if(nm) nm.textContent = getColor().name;
          try{ renderRecommended(); }catch(e){}   // рекомендовані — у новому кольорі
        });
      });
      pmTabPanel.querySelectorAll('[data-print]').forEach(function(el){
        el.addEventListener('click', function(){ pm.printId = el.dataset.print;
          if(window.lqAn) window.lqAn.pick('print', (getPrint() || {}).name || pm.printId);
          renderTabPanel(); updatePriceBar(); });
      });
      pmTabPanel.querySelectorAll('[data-size-select]').forEach(function(el){
        el.addEventListener('click', function(){
          // Кожен дотик по розміру = ще одна штука. Раніше перший клік давав 1,
          // а далі доводилось цілитись у маленький «+».
          var sz = el.dataset.sizeSelect;
          pm.qty[sz] = (pm.qty[sz] || 0) + 1;
          if(window.lqAn) window.lqAn.step('size', { garment: pm.garmentId });
          pm.sizeFocus = sz;                     // великий лічильник переходить на цей розмір
          renderTabPanel(); updatePriceBar();
        });
      });
      /* Тираж набирають десятками, тож «+» і «−» тримають натиснутими:
         лічильник розганяється сам. Під час утримання панель НЕ перебудовуємо
         — інакше кнопка зникла б з-під пальця; оновлюємо лише цифри, а повний
         перерендер робимо, коли палець відпустили. */
      function sizeLight(sz){
        var v = pm.qty[sz] || 0;
        var val = pmTabPanel.querySelector('.pm-size-step-val');
        if(val) val.textContent = v;
        var minus = pmTabPanel.querySelector('[data-size-minus]');
        if(minus) minus.disabled = v <= 0;
        var chip = pmTabPanel.querySelector('.pm-size-btn[data-size-select="' + sz + '"]');
        if(chip){
          chip.classList.toggle('active', v > 0);
          var col = chip.parentNode, cnt = col && col.querySelector('.pm-size-cnt');
          if(cnt) cnt.textContent = v > 0 ? '×' + v : '';
        }
        updatePriceBar();
      }
      function bindHold(el, apply){
        var wait = null, rep = null, gap = 0, held = false, lastDown = 0;
        function stop(){
          if(wait) clearTimeout(wait);
          if(rep) clearTimeout(rep);
          wait = rep = null;
          if(held){ held = false; renderTabPanel(); }
        }
        function tick(){
          held = true;
          apply();
          gap = Math.max(32, Math.round(gap * 0.84));   // що довше тримають, то швидше
          rep = setTimeout(tick, gap);
        }
        el.addEventListener('pointerdown', function(e){
          if(e.button) return;
          e.preventDefault();
          lastDown = Date.now();
          apply();                                       // перший крок — одразу
          gap = 150;
          try{ el.setPointerCapture(e.pointerId); }catch(err){}
          wait = setTimeout(tick, 420);                  // пауза, щоб звичайний тап не розганявся
        });
        ['pointerup','pointercancel','pointerleave'].forEach(function(ev){
          el.addEventListener(ev, stop);
        });
        /* Клавіатура (Enter/Пробіл) і програмний виклик теж мають працювати.
           Вони дають click, якому НЕ передував дотик — на відміну від миші й
           пальця, після яких браузер шле click слідом за pointerup. Дивимось
           саме на це, а не на e.detail: різні браузери проставляють його
           по-різному, і тап рахувався б двічі. */
        el.addEventListener('click', function(){
          if(Date.now() - lastDown < 1000) return;
          apply(); renderTabPanel();
        });
        el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
      }
      pmTabPanel.querySelectorAll('[data-size-minus]').forEach(function(el){
        var sz = el.dataset.sizeMinus;
        bindHold(el, function(){
          if((pm.qty[sz] || 0) <= 0) return;
          pm.qty[sz] = Math.max(0, (pm.qty[sz] || 0) - 1);
          pm.sizeFocus = sz;
          sizeLight(sz);
        });
      });
      pmTabPanel.querySelectorAll('[data-size-plus]').forEach(function(el){
        var sz = el.dataset.sizePlus;
        bindHold(el, function(){
          pm.qty[sz] = (pm.qty[sz] || 0) + 1;
          pm.sizeFocus = sz;
          if(window.lqAn) window.lqAn.step('size', { garment: pm.garmentId });
          sizeLight(sz);
        });
      });
      var chartBtn = document.getElementById('pmSizeChartBtn');
      if(chartBtn) chartBtn.addEventListener('click', function(){
        setSizeChartTitle();
        renderSizeChart();
        document.getElementById('pmSizeChartPage').classList.add('open');
      });
    }

    function setupScrollArrows(){
      pmTabPanel.querySelectorAll('.pm-scroll-wrap').forEach(function(wrap){
        var list = wrap.querySelector('.pm-scroll-list');
        var leftBtn = wrap.querySelector('.pm-scroll-arrow--left');
        var rightBtn = wrap.querySelector('.pm-scroll-arrow--right');
        if(!list || !leftBtn || !rightBtn) return;
        function update(){
          var max = list.scrollWidth - list.clientWidth;
          leftBtn.classList.toggle('show', list.scrollLeft > 4);
          rightBtn.classList.toggle('show', max > 4 && list.scrollLeft < max - 4);
        }
        list.addEventListener('scroll', update);
        leftBtn.addEventListener('click', function(){ list.scrollBy({left:-160, behavior:'smooth'}); });
        rightBtn.addEventListener('click', function(){ list.scrollBy({left:160, behavior:'smooth'}); });
        update();
        requestAnimationFrame(update);
      });
    }

    var pmQtyWarning = document.getElementById('pmQtyWarning');
    var pmQtyWarnText = document.getElementById('pmQtyWarnText');
    var pmTierRow = document.getElementById('pmTierRow');
    // Поставити сумарний тираж рівно N: якщо розміри вже обрані — множимо їх
    // пропорційно, якщо ще ні — кладемо все в перший розмір.
    function setTotalUnits(n){
      var sizes = getSizes(), cur = totalUnits();
      if(n <= 0 || !sizes.length) return;
      if(cur > 0){
        var left = n;
        sizes.forEach(function(sz, i){
          var share = (pm.qty[sz] || 0) / cur;
          var v = (i === sizes.length - 1) ? left : Math.round(n * share);
          v = Math.max(0, Math.min(left, v));
          pm.qty[sz] = v; left -= v;
        });
        if(left > 0) pm.qty[sizes[0]] = (pm.qty[sizes[0]] || 0) + left;
      } else {
        sizes.forEach(function(sz){ pm.qty[sz] = 0; });
        pm.qty[sizes[0]] = n;
      }
      renderTabPanel(); updatePriceBar();
    }
    function renderTiers(){
      var pt = pricingTiers();
      var rows;
      if(pt){
        var actT = activeCoefTier();
        // визначальна ціна = ефективна ціна за 1 шт (з повною разовою оплатою). Від неї — знижки.
        var base1 = effUnitPriceCoef(pt[0].coef, pt[0].min);
        rows = pt.map(function(t){
          // ефективна ціна порогу: коеф на базу+вишивку (+ DTF за тираж порогу) + частка разової оплати
          var price = effUnitPriceCoef(t.coef, t.min);
          var pct = base1 > 0 ? Math.round((1 - price / base1) * 100) : 0;
          // Порівнюємо за порогом, а не за посиланням: activeCoefTier() будує свій
          // масив, тож t===actT не збігалося ніколи й активний поріг не визначався.
          return {label:t.label, min:t.min, badge: pct > 0 ? ('−'+pct+'%') : null, price:price,
                  isActive: !!actT && t.min === actT.min};
        });
      } else {
        var active = activeTier();
        rows = TIERS.map(function(t){ return {label:t.label, min:t.min, badge:t.badge, price:t.price, isActive: !!active && t.min === active.min}; });
      }
      // Показуємо саму градацію, а не речення про неї: три найближчі пороги
      // з відсотком і ціною за штуку. Так одразу видно, наскільки дешевшає
      // виріб і на скільки треба збільшити тираж. Тап — ставить цей тираж.
      // Смуга з усіма порогами: одразу видно всю градацію, а не один наступний
      // крок. Гортається вбік, активний поріг центрується сам.
      pmTierRow.innerHTML = rows.map(function(t){
        return '<div class="pm-tier-item' + (t.isActive ? ' active' : '') + '" data-tier-qty="' + t.min + '">' +
          (t.badge ? '<span class="pm-tier-badge">' + t.badge + '</span>' : '') +
          '<div class="pm-tier-label">' + t.label + '</div>' +
          '<div class="pm-tier-price">' + t.price + ' грн</div>' +
        '</div>';
      }).join('');
      // Тап по порогу → ставимо цей тираж і відкриваємо вкладку «Розмір і кількість»
      pmTierRow.querySelectorAll('.pm-tier-item').forEach(function(item){
        item.addEventListener('click', function(){
          var q = +item.dataset.tierQty || 0;
          if(q > 0) setTotalUnits(q);
          goTab('size');
          renderTabPanel();
          // прокручуємо конфігуратор так, щоб табки і вибір розмірів були зверху видимі
          var tabsEl = document.getElementById('pmTabs');
          if(tabsEl && productModal){
            var y = tabsEl.offsetTop - 8;
            productModal.scrollTo({top: Math.max(0, y), behavior:'smooth'});
          }
        });
      });
      // Активний поріг центруємо ГОРИЗОНТАЛЬНО всередині смуги — без прокрутки
      // сторінки: scrollIntoView кидав увесь екран під час перетягування лого.
      var activeEl = pmTierRow.querySelector('.pm-tier-item.active');
      if(activeEl){
        pmTierRow.scrollLeft = activeEl.offsetLeft - (pmTierRow.clientWidth - activeEl.clientWidth) / 2;
      }
    }
    // Ціна «від X» (коли кількість не вибрана): без лого — база виробу (як у каталозі),
    // з лого — база + нанесення + за штуку, щоб одразу було видно ефект лого/розміру/методу.
    function fromPriceDisplay(){
      if(sitePricing()){
        // «від» = найдешевша ціна за одиницю (за максимальним тиражем), поки кількість не вибрана
        return cheapestUnitPrice();
      }
      return TIERS[TIERS.length-1].price + logoSurcharge();
    }
    /* Автозбереження позиції тут навмисно НЕМАЄ. Автоматично зберігається
       сама пропозиція — заголовок, тексти, дати, склад; товар менеджер
       зберігає кнопкою, коли закінчив. Інакше кожен рух логотипа заводив би
       запис у базу й перебудову сторінки — і редактор смикався б під руками
       ще до того, як людина щось вирішила. */
    function updatePriceBar(){
      var u = totalUnits();
      var cmW = currentLayers().length ? activeLogoWidthCm() : 0;
      // Колір у дужках біля назви — так він не займає окремого рядка у вкладці
      // «Товар», а стоїть там, де людина й так читає, що саме вона купує.
      var cNow = getColor();
      syncPrintSizeLabel();
      if(u>0){
        pmPriceText.innerHTML = '<span class="pm-num">'+effUnitPrice()+'</span><span class="pm-unit">грн/шт</span>';
      } else {
        pmPriceText.innerHTML = '<span class="pm-unit">від </span><span class="pm-num">'+fromPriceDisplay()+'</span><span class="pm-unit">грн/шт</span>';
      }
      pmDeliveryText.innerHTML = (u===0?'<span class="pm-unit">від </span>':'') + '<span class="pm-num">'+deliveryTerm()+'</span><span class="pm-unit">'+dayWord(parseInt(deliveryTerm().split('-')[1],10))+'</span>';
      pmAddBtnSum.textContent = u>0 ? (orderTotal())+' грн за '+u+' шт' : '';
      document.getElementById('pmStickyCartSum').textContent = pmAddBtnSum.textContent;
      // Рядок під назвою: спершу нагадує вказати кількість, далі — пояснює,
      // що ціна зібрана з кількох нанесень. Окремого ряду для цього не заводимо.
      var sidesWithLogo = getViews().filter(function(v){ return (pm.logos[v] || []).length > 0; });
      var nLogos2 = logoCount();
      if(u === 0){
        pmQtyWarning.style.display = '';
        pmQtyWarning.classList.remove('is-info');
        pmQtyWarnText.textContent = 'Вкажіть кількість — покажемо точну ціну';
        pmQtyWarning.classList.add('is-tap');   // рядок клікабельний: веде до кількості
      } else if(sidesWithLogo.length > 1){
        pmQtyWarning.style.display = '';
        pmQtyWarning.classList.remove('is-tap');
        pmQtyWarning.classList.add('is-info');
        pmQtyWarnText.textContent = 'Ціна за ' + nLogos2 + ' ' + logoWordUa(nLogos2) + ': ' +
          sidesWithLogo.map(function(v){ return (VIEW_SHORT[v] || v).toLowerCase(); }).join(' + ');
      } else {
        pmQtyWarning.style.display = 'none';
      }
      renderTiers();
      renderPrintArea();
      if(IS_MANAGER) renderManagerPanel();
         /* Робоче місце менеджера слухає це, щоб знати: у позиції є зміни,
         яких ще немає в замовленні. */
      if(window.__lqDirty) window.__lqDirty();
    }
    /* Покроковий розклад нанесення — рядок на кожне зображення й напис, із
       формулою, з якої вийшла сума: площа × ставка, старт, добивка до
       мінімалки; для DTF — лист, рядок тиражу й габарит.

       Той самий текст, що менеджер бачить у «Прорахунку» в конструкторі, — і
       він же їде разом із позицією в замовлення. Інакше в пропозиції стояло
       «Нанесення 436 грн» без жодного пояснення, звідки взялись ці 436, і
       перевірити ціну не було чим: розклад живе тільки поки конструктор
       відкритий, а після збереження відновити його нізвідки. */
    function calcLinesForItem(groupQty){
      var m = methodCfgNew() || {};
      if(!m || logoCount() === 0) return [];
      var imgN = 0, txtN = 0, out = [];
      orderedLayers().forEach(function(x){
        var l = x.l, idx = x.idx, isTxt = isTextLayer(l);
        var label = isTxt ? ('Текст ' + (++txtN)) : ('Зображення ' + (++imgN));
        var sell, cost, note;
        if(m.mode === 'grid'){
          sell = dtfGridSell(m, l, groupQty);
          cost = dtfGridCost(m, l, groupQty);
          var bcol = dtfBandCol(m, l);
          var blab = (m.bands && m.bands[bcol]) ? m.bands[bcol].label : '';
          var qfa = m.qtyFrom || [], uNow = Math.max(1, groupQty), qrow = 0;
          for(var j = qfa.length - 1; j >= 0; j--){ if(uNow >= qfa[j]){ qrow = j; break; } }
          var dmm = layerOpaqueDimsMm(l);
          note = 'лист ' + blab +
                 (qfa.length ? ' · рядок «від ' + qfa[qrow] + ' шт»' : '') +
                 (dmm ? ' · лого ' + Math.round(dmm.w/10) + '×' + Math.round(dmm.h/10) + ' см' : '');
        } else {
          sell = placementPrice(m, l, idx);
          cost = placementCost(methodCfgKind(m, isTxt), l, idx);
          var mk = methodCfgKind(m, isTxt);
          var mm2 = layerInkMm2(l);
          var det = placementDetail(m, l, idx);
          var dm = layerOpaqueDimsMm(l);
          var parts = areaParts(mk, mm2, false);
          /* Ставку називаємо лише тоді, коли вона справді є. Модель цін може
             рахувати нанесення інакше (стібками, за листом) — тоді «× 0
             грн/см²» поруч із живою сумою виглядало б як помилка, хоча це
             просто інша формула. Площу й габарит показуємо завжди: саме їх
             найчастіше й перепитують. */
          var rated = parts.some(function(p){ return p.rate > 0; });
          note = 'лого ' + Math.round(dm.w/10) + '×' + Math.round(dm.h/10) + ' см · площа ' +
                 (mm2/100).toFixed(1) + ' см²' +
                 (rated ? ' × ' + parts.map(function(p){ return (p.rate/10); }).join(' + ') + ' грн/см²' : '') +
                 (det.area ? ' = ' + det.area : '') +
                 (det.base ? ' + старт ' + det.base : '') +
                 (det.minAdd ? ' + ' + det.minAdd + ' до мінімалки ' + minForIndex(mk, idx) : '');
        }
        out.push({ label: label, note: note, sell: Math.round(sell), cost: Math.round(cost) });
      });
      return out;
    }
    // Менеджерський прорахунок — таблиця «Назва | Продажна | Собівартість» + маржа й суми замовлення
    function renderManagerPanel(){
      var box = document.getElementById('pmManagerBox'), out = document.getElementById('pmMgrCalc');
      if(!box || !out) return;
      box.style.display = '';
      var u = totalUnits(), qty = u > 0 ? u : 1;
      var m = methodCfgNew() || {};
      var methodName = getPrint().name;
      /* Усі рядки беремо зі спільного рушія, а не рахуємо тут заново. Інакше
         стовпчик не сходиться з підсумком: знижка йде від сумарного тиражу
         способу по всьому замовленню, а підготовка макета ділиться на всі
         вироби цього способу, а не лише на цю позицію. */
      var sd = sharedDraftParts(qty);
      var P = sd ? sd.parts : null;
      // Скільки виробів цього способу в замовленні — від цього залежить і
      // знижка, і рядок сітки DTF, і на скільки ділиться макет.
      var groupQty = (P && P.groupQty) ? P.groupQty : qty;
      var ap = applicationParts(groupQty);
      var coefPart = ap.coefPart, flatPart = ap.flatPart;   // coefPart (вишивка) — під знижкою; flatPart (DTF) — без
      var appCost = applicationCostSum(groupQty);
      var appSell = P ? P.appBase : (coefPart + flatPart);
      var base = P ? P.garmentBase : basePriceNew(), gCost = garmentCost();
      var t = activeCoefTier();
      var coef = P ? P.coef : (t ? t.coef : 1);
      var pFee = P ? P.pieceFee : methodPieceFee(), pCost = methodPieceCost();
      // Разова оплата ділиться так само, як у рушії: на всі вироби способу
      var feeUnits = (P && P.feeUnits) ? P.feeUnits : qty;
      var oFeePer = P ? P.feeShare : orderFeePerUnit(qty);
      var oCostPer = (P && P.costShare != null) ? P.costShare
                   : (feeUnits > 0 ? Math.round(methodOrderCost()/feeUnits) : 0);
      var uSell = sd ? sd.unit : effUnitPrice(), fullUnitCost = unitCost() + oCostPer;
      /* Знижку показуємо як РІЗНИЦЮ, а не рахуємо окремою формулою: так
         стовпчик сходиться з підсумком до гривні при будь-яких округленнях. */
      var discountAmt = Math.round(base + appSell + pFee + oFeePer - uSell);
      var areaMm2 = 0; getViews().forEach(function(s){ (pm.logos[s]||[]).forEach(function(l){ areaMm2 += layerInkMm2(l); }); });
      var actL = currentLayers().find(function(x){return x.id===pm.activeLogoId;}) || currentLayers()[0];
      var dims = actL ? layerOpaqueDimsMm(actL) : null;
      var money = function(x){ return Math.round(x) + ' грн'; };
      var dash = '<span style="color:#c2c7cf;">—</span>';
      // ── шапка: метод + деталі площі/листа ──
      var head = '<div style="font-weight:800;font-size:14px;color:#0f2034;">Прорахунок (для менеджера)</div>';
      var det = 'Метод: <b>'+methodName+'</b>';
      if(m.mode==='grid' && logoCount()>0){
        if(logoCount()===1){ var col=dtfBandCol(m,actL); var bl=(m.bands&&m.bands[col])?m.bands[col].label:''; det += ' · Лист: <b>'+bl+'</b>'; }
        else det += ' · Листів: <b>'+logoCount()+'</b> (див. розклад)';
      }
      else if(areaMm2>0){
        // За градації ставка не одна — показуємо середню по цій площі, а поруч
        // позначку, щоб менеджер не шукав цю цифру в налаштуваннях.
        var aParts = areaParts(m, areaMm2, false);
        var aRate = areaMm2 > 0 ? (areaSum(m, areaMm2, false) / areaMm2 * 1000) : 0;
        det += ' · Площа: <b>'+(areaMm2/100).toFixed(1)+' см²</b> ('+Math.round(areaMm2)+' мм²) · <b>'+
          (Math.round(aRate*10)/100)+' грн/см²</b>' + (aParts.length > 1 ? ' <span style="color:#8a94a6;">(градація)</span>' : '');
      }
      if(dims) det += ' · '+Math.round(dims.w/10)+'×'+Math.round(dims.h/10)+' см';
      head += '<div style="font-size:11.5px;color:#5a6a80;margin:3px 0 10px;line-height:1.5;">'+det+'</div>';
      /* Дані з адмінки могли не прийти — тоді сайт малює запасні ціни, а
         менеджер бачить правдоподібні, але чужі цифри й не розуміє чому.
         Кажемо це прямо: мовчазний прорахунок гірший за жодного. */
      function warnBox(txt){
        return '<div style="font-size:11.5px;line-height:1.5;margin:-4px 0 10px;padding:8px 10px;' +
          'border-radius:8px;background:#fdecec;color:#8a1f1f;">' + txt + '</div>';
      }
      if(window.__lqContentErr){
        head += warnBox('<b>Дані з адмінки не завантажились</b> (' + window.__lqContentErr + '). ' +
          'Ціни й товари нижче — запасні, не ваші. Найчастіша причина — правила Firestore: ' +
          'потрібен доступ на читання до <code>loomiq/photos</code>.');
      } else if(!sitePricing()){
        head += warnBox('<b>Модель цін не налаштована.</b> Прорахунок працює за старою формулою, ' +
          'а не за тією, що в розділі «Формування цін». Перевірте, чи збережені методи нанесення.');
      }
      /* Найчастіше питання менеджера: «чому при одній штуці вже знижка?».
         Тому що в кошику лежать позиції з попереднього прорахунку, а знижка
         й підготовка макета рахуються на все замовлення разом — так само, як
         для клієнта. Пишемо це прямо і даємо кнопку почати з нуля. */
      /* У пропозиції «кошик» — це склад замовлення, а не чернетки з
         попереднього прорахунку. Попередження про нього тут недоречне, а
         кнопка «почати з нуля» знищила б увесь склад. */
      var inCart = window.__lqInline ? 0
        : (window.__cartItems || []).reduce(function(a, i){ return a + (+i.qty || 0); }, 0);
      if(inCart > 0){
        head += '<div style="font-size:11.5px;line-height:1.5;margin:-4px 0 10px;padding:7px 9px;' +
          'border-radius:8px;background:#fff5e0;color:#8a5b00;">' +
          'У кошику вже <b>' + inCart + ' шт</b> — знижка за тираж і підготовка макета ' +
          'рахуються на все замовлення разом. ' +
          '<button data-mgr-clear style="all:unset;cursor:pointer;color:#8a1f1f;font-weight:700;' +
          'text-decoration:underline;">Почати з нуля</button></div>';
      }
      // ── таблиця ──
      function r(name, sell, cost, o){ o=o||{};
        var pad = o.muted ? '2px 8px' : '5px 8px';
        var trS = o.bold ? 'font-weight:800;color:#0f2034;background:#eef1f6;' : (o.muted ? 'color:#8a94a6;font-size:11px;' : '');
        var cc = o.bold ? '#0f2034' : (o.muted ? '#b0a3a3' : '#8a1f1f');
        return '<tr style="'+trS+'"><td style="padding:'+pad+';">'+name+'</td>'+
          '<td style="padding:'+pad+';text-align:right;white-space:nowrap;">'+sell+'</td>'+
          '<td style="padding:'+pad+';text-align:right;white-space:nowrap;color:'+cc+';">'+cost+'</td></tr>';
      }
      var tb = '<table style="width:100%;border-collapse:collapse;font-size:12.5px;">';
      tb += '<tr style="color:#8a94a6;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;"><td style="padding:0 8px 4px;">Назва</td><td style="padding:0 8px 4px;text-align:right;">Продажна</td><td style="padding:0 8px 4px;text-align:right;">Собівартість</td></tr>';
      tb += r('База виробу', money(base), money(gCost));
      var nLogos = logoCount();
      if(nLogos > 0){
        // рядок нанесення + розкривний розклад по кожному зображенню (як формується сума)
        var caret = mgrDetailOpen ? '▾' : '▸';
        tb += r('Нанесення ('+methodName+') <span data-mgr-toggle style="cursor:pointer;color:#4f5fd4;font-weight:600;">'+caret+' розклад</span>', money(appSell), money(appCost));
        if(mgrDetailOpen){
          // Той самий порядок, що і в розрахунку: спершу найбільше нанесення.
          // Інакше «Нанесення 1» у розкладі і «перша мінімалка» у прайсі
          // означали б різні речі.
          var imgN = 0, txtN = 0;
          orderedLayers().forEach(function(x){
            var l = x.l, idx = x.idx;
            var isTxt = isTextLayer(l);
            var kindLabel = isTxt ? ('Текст ' + (++txtN)) : ('Зображення ' + (++imgN));
            // Рядок сітки DTF беремо за СУМАРНИМ тиражем способу — так само,
            // як його бере спільний рушій. Інакше деталізація не сходиться.
            var sell = (m.mode === 'grid') ? dtfGridSell(m, l, groupQty) : placementPrice(m, l, idx);
            var cost = (m.mode === 'grid') ? dtfGridCost(m, l, groupQty) : placementCost(m, l, idx);
            var raw  = (m.mode === 'grid') ? dtfGridRaw(m, l, groupQty, idx) : placementRaw(m, l);
            var note;
            if(m.mode === 'grid'){
              // Показуємо, з якої саме клітинки таблиці взята сума: розмір листа,
              // рядок тиражу і габарит логотипа. Інакше сума виглядає нізвідки.
              var bcol = dtfBandCol(m, l); var blab = (m.bands && m.bands[bcol]) ? m.bands[bcol].label : '';
              var qfa = m.qtyFrom || [], uNow = Math.max(1, groupQty), qrow = 0;
              for(var jj = qfa.length - 1; jj >= 0; jj--){ if(uNow >= qfa[jj]){ qrow = jj; break; } }
              var dmm = layerOpaqueDimsMm(l);
              var calcG = 'лист ' + blab
                + (qfa.length ? ' · рядок «від ' + qfa[qrow] + ' шт»' : '')
                + (dmm ? ' · лого ' + Math.round(dmm.w/10) + '×' + Math.round(dmm.h/10) + ' см' : '')
                + ' · з таблиці ' + Math.round(raw);
              // мінімалки в сітці немає — сума завжди рівно з клітинки таблиці
              note = ' <span style="color:#8a94a6;">' + calcG + '</span>';
            } else {
              // показуємо, з чого склалась сума: площа × ставка з адмінки.
              // Ставку й мінімалку беремо для потрібного виду: у написа вони
              // свої, і показувати тут цифри з картинки означало б брехати.
              var mk = methodCfgKind(m, isTxt);
              var mm2 = layerInkMm2(l);
              // Ставок може бути кілька: велика площа ділиться порогами на
              // шматки, і кожен рахується своєю. Показуємо саме так, інакше
              // «площа × ставка» не сходилось би із сумою.
              var parts = areaParts(mk, mm2, false);
              var calc = parts.map(function(p){
                  return (p.mm2/100).toFixed(1) + ' см² × ' + (p.rate/10);
                }).join(' + ') + ' грн/см²';
              /* Сума нанесення складається з трьох речей, і всі три треба
                 назвати вголос: старт за це нанесення, площа за ставками і —
                 лише якщо перших двох не вистачило — добивка до мінімалки.

                 Раніше тут писалось «(мін 200)» і показувалась сама лише
                 площа. Мінімалка при цьому майже ніколи не спрацьовувала:
                 позначка зʼявлялась щоразу, коли є старт, бо порівнювалась
                 повна сума з голою площею. Виходило, що рядок називав
                 старт мінімалкою, а арифметика не сходилась із сумою. */
              var det = placementDetail(m, l, idx);
              note = ' <span style="color:#8a94a6;">' +
                (det.base ? 'старт ' + det.base + ' + ' : '') +
                'площа (' + calc + ') = ' + det.area +
                (det.minAdd
                  ? ' <span style="color:#c58a00;">+ ' + det.minAdd +
                    ' до мінімалки ' + minForIndex(mk, idx) + '</span>' : '') +
                '</span>';
            }
            tb += r('↳ ' + kindLabel + note, money(sell), money(cost), {muted:true});
          });
        }
      }
      if(discountAmt>0){
        // Коли в замовленні є ще вироби цього способу — показуємо, від якого
        // саме тиражу йде знижка. Інакше −20% на 6 шт виглядають помилкою.
        var dLbl = 'Знижка за тираж −'+Math.round((1-coef)*100)+'%' +
          (groupQty > qty ? ' <span style="color:#8a94a6;">(від '+groupQty+' шт у замовленні)</span>' : '');
        tb += r(dLbl, '−'+money(discountAmt), dash);
      }
      if(nLogos > 0){
        tb += r('Оплата за штуку', money(pFee), money(pCost));
        /* Разові — кожна окремим рядком. Підготовка картинки і підготовка
           напису це різні роботи за різними ставками, а додатковий ескіз —
           узагалі третя. Складені в одне число, вони перетворювали рядок
           на «звідкись 1100» і перевірити його було нічим.

           Рядки беремо з рушія: він же їх і нарахував, тож стовпчик
           сходиться з підсумком за визначенням. */
        var KIND_UA = { img:'картинка', txt:'напис' };
        var lines = (P && P.feeLines) ? P.feeLines : [];
        var skets = (P && P.sketches) ? P.sketches : [];
        if(lines.length){
          lines.forEach(function(f){
            var per = f.units > 0 ? Math.round(f.fee / f.units) : 0;
            var perC = f.units > 0 ? Math.round(f.cost / f.units) : 0;
            tb += r('Підготовка макета · ' + (KIND_UA[f.kind] || f.kind) +
                    ' <span style="color:#8a94a6;">(' + Math.round(f.fee) + ' грн ÷ ' +
                    f.units + ' шт)</span>', money(per), money(perC));
          });
          skets.forEach(function(x, i){
            var per = x.units > 0 ? Math.round(x.fee / x.units) : 0;
            var perC = x.units > 0 ? Math.round(x.cost / x.units) : 0;
            tb += r('Додатковий ескіз ' + (i + 1) + ' · ' + (KIND_UA[x.kind] || x.kind) +
                    ' <span style="color:#8a94a6;">(' + Math.round(x.fee) + ' грн ÷ ' +
                    x.units + ' шт)</span>', money(per), money(perC));
          });
        } else {
          // Рушій недоступний (чернетку ще не зібрано) — показуємо загальним рядком
          var feeDiv = feeUnits + ' шт' + (feeUnits > qty ? ' цього способу' : '');
          tb += r('Підготовка макета (÷' + feeDiv + ')', money(oFeePer), money(oCostPer));
        }
      }
      tb += r('Ціна за штуку', money(uSell), money(fullUnitCost), {bold:true});
      if(nLogos === 0) tb += '<tr><td colspan="3" style="padding:6px 8px 0;color:#8a94a6;font-size:11px;">Дизайн не завантажено — рахується лише база виробу зі знижкою.</td></tr>';
      tb += '</table>';
      // ── підсумки: маржа + суми замовлення ──
      var marginU = uSell - fullUnitCost, marginUPct = uSell>0 ? Math.round(marginU/uSell*100) : 0;
      var oS = u>0 ? orderTotal() : Math.round(uSell*qty);
      var oC = u>0 ? orderCostTotal() : Math.round(fullUnitCost*qty);
      var oM = oS - oC, oMPct = oS>0 ? Math.round(oM/oS*100) : 0;
      /* Ці три рядки — про ПОЗИЦІЮ, а не про замовлення: orderTotal() рахує
         поточну позицію на її тираж. Поки в кошику лежала одна позиція, це
         збігалось із замовленням, і назва «Маржа замовлення» була правдою.
         У пропозиції в кошику весь склад — і назва почала брехати: зверху
         одна штука, а внизу цифри від усього. Тому підписуємо чесно, а
         справжнє замовлення рахуємо окремо, нижче. */
      var sum = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #d5d8dd;font-size:12.5px;">';
      sum += '<div style="display:flex;justify-content:space-between;font-weight:800;color:#1a7a3a;"><span>Маржа за штуку</span><b>'+money(marginU)+' ('+marginUPct+'%)</b></div>';
      sum += '<div style="font-weight:800;margin:8px 0 4px;color:#0f2034;">Ця позиція ('+qty+' шт'+(u>0?'':' — приклад')+'):</div>';
      sum += '<div style="display:flex;justify-content:space-between;"><span>Сума продажу</span><b>'+money(oS)+'</b></div>';
      sum += '<div style="display:flex;justify-content:space-between;"><span>Сума собівартості</span><b style="color:#8a1f1f;">'+money(oC)+'</b></div>';
      sum += '<div style="display:flex;justify-content:space-between;font-weight:800;color:#1a7a3a;"><span>Маржа позиції</span><b>'+money(oM)+' ('+oMPct+'%)</b></div>';
      /* Усе замовлення — сусідні позиції плюс ця. Основні: рекомендовані
         клієнт ще не обрав, і рахувати їх у суму зарано. */
      var others = (typeof cartItems !== 'undefined' && cartItems) ? cartItems : [];
      var skipI = (window.__lqEditOnly != null) ? +window.__lqEditOnly : editIndex();
      var aS = oS, aC = oC, aQ = u > 0 ? u : 0, aN = 1;
      others.forEach(function(it, i){
        if(i === skipI || !it || it.kind === 'reco') return;
        aS += +it.price || 0; aC += +it.cost || 0; aQ += +it.qty || 0; aN++;
      });
      if(aN > 1){
        var aM = aS - aC, aMPct = aS > 0 ? Math.round(aM / aS * 100) : 0;
        sum += '<div style="font-weight:800;margin:10px 0 4px;color:#0f2034;">Усе замовлення (' +
               aN + ' поз. · ' + aQ + ' шт):</div>';
        sum += '<div style="display:flex;justify-content:space-between;"><span>Сума продажу</span><b>'+money(aS)+'</b></div>';
        sum += '<div style="display:flex;justify-content:space-between;"><span>Сума собівартості</span><b style="color:#8a1f1f;">'+money(aC)+'</b></div>';
        sum += '<div style="display:flex;justify-content:space-between;font-weight:800;color:#1a7a3a;"><span>Маржа замовлення</span><b>'+money(aM)+' ('+aMPct+'%)</b></div>';
      }
      sum += '</div>';
      out.innerHTML = head + tb + sum;
      var tog = out.querySelector('[data-mgr-toggle]');
      if(tog) tog.onclick = function(e){ e.stopPropagation(); mgrDetailOpen = !mgrDetailOpen; renderManagerPanel(); };
      var clr = out.querySelector('[data-mgr-clear]');
      if(clr) clr.onclick = function(e){
        e.stopPropagation();
        if(!confirm('Прибрати з кошика всі позиції й рахувати цю з нуля?')) return;
        if(window.__clearCart) window.__clearCart();
        updatePriceBar();
      };
    }
    // Легке оновлення цін на шкалі (лише текст, без перебудови DOM/скролу) — щоб
    // не смикало під час жесту масштабування логотипа, коли ціна їде за площею.
    function updateTierPricesLive(){
      if(!pmTierRow) return;
      var pt = pricingTiers(); if(!pt) return;
      var priceEls = pmTierRow.querySelectorAll('.pm-tier-item .pm-tier-price');
      pt.forEach(function(t, i){ if(priceEls[i]) priceEls[i].textContent = effUnitPriceCoef(t.coef, t.min) + ' грн'; });
    }
    // Легке оновлення лише ціни/розміру під час жесту (без renderTiers/scrollIntoView — щоб не смикало інтерфейс)
    function updatePriceLive(){
      var u = totalUnits();
      var cmW = currentLayers().length ? activeLogoWidthCm() : 0;
      if(u>0){
        pmPriceText.innerHTML = '<span class="pm-num">'+effUnitPrice()+'</span><span class="pm-unit">грн/шт</span>';
        pmAddBtnSum.textContent = (orderTotal())+' грн за '+u+' шт';
      } else {
        pmPriceText.innerHTML = '<span class="pm-unit">від </span><span class="pm-num">'+fromPriceDisplay()+'</span><span class="pm-unit">грн/шт</span>';
        pmAddBtnSum.textContent = '';
      }
      document.getElementById('pmStickyCartSum').textContent = pmAddBtnSum.textContent;
      syncPrintSizeLabel();
      updateTierPricesLive();   // ціни порогів під кнопкою теж оновлюємо наживо
      renderPrintArea();
      if(IS_MANAGER) renderManagerPanel();
         /* Робоче місце менеджера слухає це, щоб знати: у позиції є зміни,
         яких ще немає в замовленні. */
      if(window.__lqDirty) window.__lqDirty();
    }

    // ─── Видалення заднього фону при завантаженні логотипа (чистий canvas) ───
    function loadImgEl(src){
      return new Promise(function(resolve, reject){
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function(){ resolve(img); };
        img.onerror = reject;
        img.src = src;
      });
    }
    // ── Видалення фону через Photoroom (ключ живе у Worker-проксі, не на сайті) ──
    // Адреса проксі задається в адмінці; якщо її немає або сервіс не відповів —
    // тихо відкочуємось на вбудований алгоритм, щоб конструктор ніколи не ламався.
    function bgApiUrl(){
      var c = (window.SITE_CONTENT && window.SITE_CONTENT.bgApi) || {};
      var u = (c.proxyUrl || '').trim();
      return /^https:\/\//i.test(u) ? u : '';
    }
    function dataUrlToBlob(dataUrl){
      var parts = String(dataUrl).split(',');
      var mime = (parts[0].match(/:(.*?);/) || [null, 'image/png'])[1];
      var bin = atob(parts[1] || '');
      var arr = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    function blobToDataUrl(blob){
      return new Promise(function(res, rej){
        var fr = new FileReader();
        fr.onload = function(){ res(fr.result); };
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    }
    function removeBgViaApi(dataUrl){
      var url = bgApiUrl();
      if(!url) return Promise.reject(new Error('no-proxy'));
      var blob = dataUrlToBlob(dataUrl);
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 20000);
      return fetch(url, { method:'POST', headers:{ 'Content-Type': blob.type || 'image/png' }, body: blob, signal: ctrl.signal })
        .then(function(r){
          clearTimeout(timer);
          if(!r.ok) throw new Error('api-' + r.status);
          return r.blob();
        })
        .then(function(out){
          if(!out || !/^image\//.test(out.type || '')) throw new Error('api-bad-type');
          return blobToDataUrl(out);
        });
    }
    // Головна точка входу: спершу API (якщо налаштоване), інакше — власний алгоритм.
    function removeBgForUpload(dataUrl){
      return removeBgViaApi(dataUrl).catch(function(){ return removeBgLocal(dataUrl); });
    }
    // ── Генерація логотипа через Gemini (ключ живе у Worker-проксі, не на сайті) ──
    var AI_API_DEFAULT = 'https://loomiq-gemini.stvory.workers.dev';
    function aiApiUrl(){
      var c = (window.SITE_CONTENT && window.SITE_CONTENT.bgApi) || {};
      var u = (c.geminiUrl || '').trim();
      return /^https:\/\//i.test(u) ? u : AI_API_DEFAULT;
    }
    // Швидкі промти. Клієнти часто кидають референс поганої якості — фото логотипа
    // на спині, під кутом, з тінями. Дві перші кнопки саме для цього.
    var AI_QUICK = [
      { photo: true, label: 'Витягнути логотип із фото',
        prompt: 'Extract ONLY the logo/emblem from the attached photo and redraw it as clean, ' +
          'flat, perfectly front-facing artwork. Remove perspective distortion, fabric folds, ' +
          'wrinkles, shadows, lighting, reflections and background. Keep the original shapes, ' +
          'proportions, lettering and colours exactly as they are — do not invent new elements. ' +
          'Sharp edges, print-ready, logo alone on a plain flat white background.' },
      { photo: true, label: 'Векторизувати і стилізувати',
        prompt: 'Redraw the logo from the attached photo as clean vector-style artwork: smooth even ' +
          'curves, flat solid colours, crisp edges, no gradients, no noise, no photo texture. ' +
          'Keep the original composition and lettering readable and recognisable. ' +
          'Plain flat white background, print-ready.' },
      { photo: true, label: 'Одноколірний для вишивки',
        prompt: 'Redraw the logo from the attached photo as a single-colour silhouette suitable for ' +
          'machine embroidery: one solid colour on white, simplified fine details, no thin hairlines, ' +
          'no gradients, no shading, clean closed shapes.' }
    ];
    var aiRefImage = null;         // прикріплений референс як data URL
    var aiTargetLayer = null;      // якщо задано — перегенеровуємо цей шар, а не додаємо новий
    var aiChosen = null;           // обрана швидка кнопка (генерація йде окремим натисканням)

    /* ── Обрізання зображень ─────────────────────────────────────────────
       Клієнт кидає фото цілком — з людиною, столом і рештою кадру.
       Обрізавши до самого логотипа, Gemini отримує рівно те, що треба,
       і результат виходить точнішим. Тим самим інструментом підрізаємо
       й готовий логотип, якщо модель домалювала зайве. */
    function cropImage(url, box){
      if(!url) return Promise.resolve(null);
      return loadImgEl(url).then(function(img){
        var W = img.naturalWidth || 1, H = img.naturalHeight || 1;
        var sx = Math.max(0, Math.round(box.x0 * W)), sy = Math.max(0, Math.round(box.y0 * H));
        var sw = Math.max(1, Math.min(W - sx, Math.round((box.x1 - box.x0) * W)));
        var sh = Math.max(1, Math.min(H - sy, Math.round((box.y1 - box.y0) * H)));
        var c = document.createElement('canvas'); c.width = sw; c.height = sh;
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        return c.toDataURL('image/png');       // PNG — щоб не втратити прозорість
      });
    }
    // Повертає { url, box } або null, якщо скасували
    function openCropper(url){
      return new Promise(function(resolve){
        var ov = document.getElementById('pmCropModal');
        var img = document.getElementById('pmCropImg');
        var rect = document.getElementById('pmCropRect');
        var box = { x0:0.06, y0:0.06, x1:0.94, y1:0.94 };
        var MIN = 0.06;                        // менше не даємо, щоб не зникло

        function paint(){
          var w = img.clientWidth || 1, h = img.clientHeight || 1;
          rect.style.left   = (box.x0 * w) + 'px';
          rect.style.top    = (box.y0 * h) + 'px';
          rect.style.width  = ((box.x1 - box.x0) * w) + 'px';
          rect.style.height = ((box.y1 - box.y0) * h) + 'px';
        }
        function onLoad(){ paint(); }
        img.addEventListener('load', onLoad);
        img.src = url;
        ov.classList.add('open');
        if(img.complete) paint();

        var drag = null;
        function pos(e){
          var r = img.getBoundingClientRect();
          return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))),
                   y: Math.min(1, Math.max(0, (e.clientY - r.top)  / (r.height || 1))) };
        }
        function down(e, mode){
          e.preventDefault(); e.stopPropagation();
          drag = { mode: mode, start: pos(e), box: Object.assign({}, box) };
          e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
        }
        function move(e){
          if(!drag) return;
          var p = pos(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y, b = drag.box;
          if(drag.mode === 'move'){
            var w = b.x1 - b.x0, h = b.y1 - b.y0;
            var nx = Math.min(1 - w, Math.max(0, b.x0 + dx));
            var ny = Math.min(1 - h, Math.max(0, b.y0 + dy));
            box = { x0:nx, y0:ny, x1:nx + w, y1:ny + h };
          } else {
            var n = Object.assign({}, b);
            if(drag.mode.indexOf('w') >= 0) n.x0 = Math.min(b.x1 - MIN, Math.max(0, b.x0 + dx));
            if(drag.mode.indexOf('e') >= 0) n.x1 = Math.max(b.x0 + MIN, Math.min(1, b.x1 + dx));
            if(drag.mode.indexOf('n') >= 0) n.y0 = Math.min(b.y1 - MIN, Math.max(0, b.y0 + dy));
            if(drag.mode.indexOf('s') >= 0) n.y1 = Math.max(b.y0 + MIN, Math.min(1, b.y1 + dy));
            box = n;
          }
          paint();
        }
        function up(){ drag = null; }

        rect.onpointerdown = function(e){ down(e, 'move'); };
        rect.querySelectorAll('[data-h]').forEach(function(h){
          h.onpointerdown = function(e){ down(e, h.dataset.h); };
        });
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);

        function finish(res){
          img.removeEventListener('load', onLoad);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          ov.classList.remove('open');
          resolve(res);
        }
        document.getElementById('pmCropCancel').onclick = function(){ finish(null); };
        document.getElementById('pmCropOk').onclick = function(){
          var b = box;
          cropImage(url, b).then(function(out){ finish({ url: out, box: b }); })
                           .catch(function(){ finish(null); });
        };
      });
    }

    // Часті кольори для одноколірного нанесення
    var RECOLOR_SWATCHES = ['#ffffff', '#000000', '#c8a24a', '#c0392b', '#1f4e8c', '#0e7a4a', '#8e8e93'];

    // Перефарбовує весь малюнок в один колір, зберігаючи прозорість.
    // Для одноколірної вишивки це рівно те, що треба: форма та сама, нитка інша.
    function recolorLogo(layer, color){
      var srcUrl = layer.recolorFrom || layer.url;
      /* Відбиток лишається від ПОЧАТКОВОГО малюнка. Інакше те саме лого,
         зведене в іншу нитку, рахувалось би як другий дизайн — і замовлення
         отримувало б додатковий ескіз за роботу, якої немає: для вишивки
         програма та сама, змінюється лише колір нитки. */
      var keepFp = layer.fp;
      return loadImgEl(srcUrl).then(function(img){
        var W = img.naturalWidth || 1, H = img.naturalHeight || 1;
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        var d = x.getImageData(0, 0, W, H);
        var p = d.data;
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color) || [];
        var R = parseInt(m[1], 16) || 0, G = parseInt(m[2], 16) || 0, B = parseInt(m[3], 16) || 0;
        for(var i = 0; i < p.length; i += 4){
          if(p[i+3] === 0) continue;              // прозоре лишаємо прозорим
          p[i] = R; p[i+1] = G; p[i+2] = B;
        }
        x.putImageData(d, 0, 0);
        if(!layer.recolorFrom) layer.recolorFrom = srcUrl;   // щоб можна було повернути як було
        layer.recolorTo = color;                             // яким саме звели — видно на зразку
        var out = c.toDataURL('image/png');
        layer.url = out; layer.cleanUrl = out;
        return measureLayerShape(layer, out);
      }).then(function(){
        if(keepFp) layer.fp = keepFp;      // дизайн той самий, змінилась лише нитка
        renderGarment(); renderTabPanel(); updatePriceBar();
      });
    }
    function resetRecolor(layer){
      if(!layer.recolorFrom) return Promise.resolve();
      var back = layer.recolorFrom;
      layer.recolorFrom = null;
      layer.recolorTo = null;
      layer.url = back; layer.cleanUrl = back;
      return measureLayerShape(layer, back)
        .then(function(){ renderGarment(); renderTabPanel(); updatePriceBar(); });
    }

    // Зменшуємо референс перед відправкою: повнорозмірне фото з телефона
    // важить кілька мегабайтів і просто не долетить.
    function prepRefImage(file){
      return new Promise(function(res, rej){
        var fr = new FileReader();
        fr.onerror = rej;
        fr.onload = function(ev){
          loadImgEl(ev.target.result).then(function(img){
            var MAX = 1400;
            var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
            var k = Math.min(1, MAX / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
            var c = document.createElement('canvas'); c.width = cw; c.height = ch;
            var x = c.getContext('2d');
            x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch);   // прозорість → білий, бо далі JPEG
            x.drawImage(img, 0, 0, cw, ch);
            res(c.toDataURL('image/jpeg', 0.92));
          }).catch(rej);
        };
        fr.readAsDataURL(file);
      });
    }

    function generateLogoViaAi(prompt, image){
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 90000);
      return fetch(aiApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, image: image || null }),
        signal: ctrl.signal
      }).then(function(r){
        clearTimeout(timer);
        var type = r.headers.get('Content-Type') || '';
        // Помилку воркер віддає як JSON — витягуємо причину, щоб показати зрозумілий текст.
        if(!r.ok || !/^image\//.test(type)){
          return r.text().then(function(t){
            var j = {};
            try{ j = JSON.parse(t) || {}; }catch(e){}
            var err = new Error(j.error || ('ai-' + r.status));
            // Список імен змінних воркера (без значень) — щоб було видно,
            // чи взагалі долетів секрет, коли налаштування не спрацювало.
            if(j.vars && j.vars.length) err.vars = j.vars.join(', ');
            err.status = j.status; err.detail = j.detail;
            throw err;
          });
        }
        // Якщо ми надіслали фото, а воркер не підтвердив, що взяв його в роботу —
        // значить у Cloudflare лежить стара версія воркера. Результат у такому разі
        // вигаданий із нуля, і підставляти його на макет не можна.
        if(image && r.headers.get('X-Loomiq-Ref') !== 'used'){
          throw new Error('worker-no-ref');
        }
        return r.blob().then(blobToDataUrl);
      }, function(){ clearTimeout(timer); throw new Error('ai-network'); });
    }
    function removeBgLocal(dataUrl){
      return loadImgEl(dataUrl).then(function(img){
        var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        var corners = [
          ctx.getImageData(0,     0,     1, 1).data,
          ctx.getImageData(W - 1, 0,     1, 1).data,
          ctx.getImageData(0,     H - 1, 1, 1).data,
          ctx.getImageData(W - 1, H - 1, 1, 1).data
        ];
        var cornersTransparent = corners.some(function(p){ return p[3] < 128; });

        var imageData = ctx.getImageData(0, 0, W, H);
        var px = imageData.data;
        var THR = 220;            // поріг "майже білого"
        var TOL = 40;             // допуск по каналах навколо кольору фону
        var visited = new Uint8Array(W * H);
        var NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        // Чи прибирати білі просвіти всередині букв: тільки коли дизайн "темне-на-світлому".
        // Для білого лого на темному/прозорому фоні білий — це сам логотип, його не чіпаємо.
        var removeCounters = false;

        // ── Заливка від країв (лише якщо є суцільний непрозорий фон) ──
        if(!cornersTransparent){
          // реальний колір фону з кутів (білий ТА сірий/кольоровий)
          var br = 0, bgc = 0, bb = 0;
          corners.forEach(function(c){ br += c[0]; bgc += c[1]; bb += c[2]; });
          br /= 4; bgc /= 4; bb /= 4;
          var bgAvg = (br + bgc + bb) / 3;
          var bgMax = Math.max(br, bgc, bb);
          var bgIsLight = bgAvg > 180;
          removeCounters = bgIsLight;
          var isWhiteBg = function(pos){
            var i = pos * 4;
            if(px[i + 3] < 10) return true;
            var r = px[i], g = px[i + 1], b = px[i + 2];
            // "майже білий = фон" лише на світлому фоні (інакше з'їдало б біле лого на темному)
            if(bgIsLight && r > THR && g > THR && b > THR) return true;
            return Math.abs(r - br) <= TOL && Math.abs(g - bgc) <= TOL && Math.abs(b - bb) <= TOL;
          };
          var seeds = [];
          for(var x = 0; x < W; x++){
            [0, H - 1].forEach(function(y){
              var p = y * W + x;
              if(!visited[p] && isWhiteBg(p)){ visited[p] = 1; seeds.push(p); }
            });
          }
          for(var y = 1; y < H - 1; y++){
            [0, W - 1].forEach(function(x2){
              var p = y * W + x2;
              if(!visited[p] && isWhiteBg(p)){ visited[p] = 1; seeds.push(p); }
            });
          }
          var head = 0;
          while(head < seeds.length){
            var pos = seeds[head++];
            var cx0 = pos % W, cy0 = (pos / W) | 0;
            for(var k = 0; k < 4; k++){
              var nx = cx0 + NB[k][0], ny = cy0 + NB[k][1];
              if(nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
              var npos = ny * W + nx;
              if(!visited[npos] && isWhiteBg(npos)){ visited[npos] = 1; seeds.push(npos); }
            }
          }
          // Фаза 2: замкнені "кишені" сірого/кольорового фону (білий вміст захищений)
          if(bgMax < 244){
            var POCKET_TOL = 18;
            for(var i2 = 0; i2 < W * H; i2++){
              if(visited[i2]) continue;
              var j = i2 * 4;
              if(px[j + 3] < 10){ visited[i2] = 1; continue; }
              var r2 = px[j], g2 = px[j + 1], b2 = px[j + 2];
              var matchesBg = Math.abs(r2 - br) <= POCKET_TOL && Math.abs(g2 - bgc) <= POCKET_TOL && Math.abs(b2 - bb) <= POCKET_TOL;
              var brighterThanBg = (r2 + g2 + b2) / 3 > bgAvg + 10;
              if(matchesBg && !brighterThanBg) visited[i2] = 1;
            }
          }
        } else {
          // Прозорий фон: вирізати просвіти лише якщо вміст переважно ТЕМНИЙ (темне лого).
          var bsum = 0, bcnt = 0;
          for(var q = 0; q < W * H; q++){
            if(px[q * 4 + 3] >= 10){ bsum += (px[q*4] + px[q*4+1] + px[q*4+2]) / 3; bcnt++; }
          }
          removeCounters = bcnt > 0 && (bsum / bcnt) < 140;
        }

        // ── Фаза 3: замкнені майже-білі просвіти всередині букв (О, В, А, Q…) —
        // лише для "темне-на-світлому". Видаляємо замкнену (не до краю) майже-білу
        // ділянку, оточену непрозорим вмістом. Прозорі сусіди не рахуються.
        var isNearWhite = function(idx){
          var jj = idx * 4;
          return px[jj + 3] >= 10 && px[jj] > 200 && px[jj + 1] > 200 && px[jj + 2] > 200;
        };
        var OPAQUE_FRAC = 0.5;   // межа просвіту переважно з непрозорого вмісту → це дірка в букві
        if(removeCounters){
          var comp = new Int32Array(W * H); comp.fill(-1);
          for(var s = 0; s < W * H; s++){
            if(visited[s] || comp[s] !== -1 || !isNearWhite(s)) continue;
            var stack = [s]; comp[s] = s;
            var members = [s];
            var opaqueBorder = 0, totalBorder = 0, touchesEdge = false, h2 = 0;
            while(h2 < stack.length){
              var pp = stack[h2++];
              var xx = pp % W, yy = (pp / W) | 0;
              if(xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1) touchesEdge = true;
              for(var kk = 0; kk < 4; kk++){
                var nx2 = xx + NB[kk][0], ny2 = yy + NB[kk][1];
                if(nx2 < 0 || nx2 >= W || ny2 < 0 || ny2 >= H) continue;
                var np = ny2 * W + nx2;
                if(isNearWhite(np)){
                  if(comp[np] === -1){ comp[np] = s; stack.push(np); members.push(np); }
                } else {
                  totalBorder++;
                  if(px[np * 4 + 3] >= 10) opaqueBorder++;   // непрозорий сусід (= обведення букви)
                }
              }
            }
            // замкнений (не торкається краю) білий просвіт, оточений непрозорим вмістом → прибрати
            if(!touchesEdge && totalBorder > 0 && opaqueBorder / totalBorder >= OPAQUE_FRAC){
              members.forEach(function(m){ visited[m] = 1; });
            }
          }
        }

        for(var i3 = 0; i3 < W * H; i3++){
          if(visited[i3]) px[i3 * 4 + 3] = 0;
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/png');
      });
    }

    // Пунктирна зона на футболці = <label for="pmFileInput"> (відкриває вибір файлу нативно)

    // ── Менеджерський режим: вибір джерела логотипа (файл / генерація) ──
    // Для клієнта нічого не змінюється — у нього одразу відкривається файловий діалог.
    (function(){
      var src = document.getElementById('pmSrcModal');
      var ai  = document.getElementById('pmAiModal');
      var zone = document.getElementById('pmUploadZone');
      if(!src || !ai) return;
      function openSrc(){ src.classList.add('open'); }
      function closeAll(){ src.classList.remove('open'); ai.classList.remove('open'); }
      function pickFile(){ closeAll(); document.getElementById('pmFileInput').click(); }
      // у менеджерському режимі перехоплюємо клік по пунктирній зоні (це <label>)
      if(zone && IS_MANAGER){
        zone.removeAttribute('for');
        zone.addEventListener('click', function(e){ e.preventDefault(); openSrc(); });
      }
      window.__pmPickLogoSource = function(){ IS_MANAGER ? openSrc() : document.getElementById('pmFileInput').click(); };
      document.getElementById('pmSrcFile').addEventListener('click', pickFile);
      document.getElementById('pmSrcCancel').addEventListener('click', closeAll);
      document.getElementById('pmAiCancel').addEventListener('click', function(){ ai.classList.remove('open'); openSrc(); });
      src.addEventListener('click', function(e){ if(e.target === src) closeAll(); });
      ai.addEventListener('click', function(e){ if(e.target === ai) closeAll(); });
      document.getElementById('pmSrcAi').addEventListener('click', function(){
        src.classList.remove('open');
        openAi(null);
      });
      // Перегенерація вже наявного логотипа — з вкладки «Фото»
      window.__pmOpenAi = function(layer){ openAi(layer || null); };

      function openAi(layer){
        aiTargetLayer = layer;
        aiChosen = null;
        aiRefImage = layer ? (layer.aiRef || layer.url) : null;
        setRefImage(aiRefImage);
        renderAiBases();
        document.getElementById('pmAiPrompt').value = '';
        document.getElementById('pmAiModal').classList.add('open');
        setTimeout(function(){ document.getElementById('pmAiPrompt').focus(); }, 60);
      }
      // Від чого відштовхуватись: від фото клієнта чи від того, що вже намалював Gemini
      function renderAiBases(){
        var box = document.getElementById('pmAiBases');
        var l = aiTargetLayer;
        if(!l){ box.hidden = true; box.innerHTML = ''; return; }
        var opts = [];
        if(l.aiRef) opts.push({ key:'ref',  label:'Фото клієнта',     url:l.aiRef });
        opts.push({ key:'now', label:'Поточний логотип', url:l.url });
        if(opts.length < 2){ box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = false;
        box.innerHTML = opts.map(function(o){
          return '<button type="button" class="pm-ai-base' + (aiRefImage === o.url ? ' on' : '') +
            '" data-base="' + o.key + '"><img src="' + o.url + '" alt=""><span>' + o.label + '</span></button>';
        }).join('');
        box.querySelectorAll('[data-base]').forEach(function(b){
          b.addEventListener('click', function(){
            var o = opts.filter(function(x){ return x.key === b.dataset.base; })[0];
            if(!o) return;
            setRefImage(o.url);
            renderAiBases();
          });
        });
      }

      function resetAiNote(){
        var n = document.getElementById('pmAiNote');
        n.className = 'pm-ai-note';
        if(aiChosen){
          n.textContent = 'Обрано: «' + aiChosen.label + '». Можна дописати уточнення нижче — ' +
                          'і натиснути «Згенерувати».';
          return;
        }
        n.textContent = aiRefImage
          ? 'Фото прикріплено. Оберіть, що з ним зробити, — або опишіть словами.'
          : 'Прикріпіть фото клієнта — зʼявляться швидкі кнопки. Або опишіть логотип словами.';
      }
      // Показуємо ті кнопки, які мають сенс: із фото — обробка референсу,
      // без фото — генерація з нуля.
      function renderAiChips(){
        var box = document.getElementById('pmAiChips');
        var list = AI_QUICK.filter(function(q){ return q.photo === !!aiRefImage; });
        if(aiChosen && list.indexOf(aiChosen) < 0) aiChosen = null;
        box.innerHTML = list.map(function(q){
          return '<button type="button" class="pm-ai-chip' + (q === aiChosen ? ' on' : '') +
            '" data-quick="' + AI_QUICK.indexOf(q) + '">' + q.label + '</button>';
        }).join('');
        box.querySelectorAll('[data-quick]').forEach(function(b){
          b.addEventListener('click', function(){
            var q = AI_QUICK[+b.dataset.quick];
            aiChosen = (aiChosen === q) ? null : q;   // повторний клік знімає вибір
            renderAiChips();
            resetAiNote();
            var ta = document.getElementById('pmAiPrompt');
            ta.placeholder = aiChosen
              ? 'Що ще уточнити — напр. «зробити білим», «прибрати нижній напис». Необовʼязково.'
              : 'Напр.: мінімалістичний логотип кавʼярні, чорний контур чашки, без тексту';
            if(aiChosen) ta.focus();
          });
        });
      }
      function setRefImage(dataUrl){
        aiRefImage = dataUrl || null;
        var t = document.getElementById('pmAiThumb');
        var cropBtn = document.getElementById('pmAiCrop');
        if(aiRefImage){
          document.getElementById('pmAiThumbImg').src = aiRefImage;
          t.hidden = false; cropBtn.hidden = false;
        } else {
          t.hidden = true; cropBtn.hidden = true;
          document.getElementById('pmAiFile').value = '';
        }
        renderAiChips();
        resetAiNote();
      }
      // Підказка в режимі перегенерації інша: тут не малюють з нуля, а правлять
      var _resetNote = resetAiNote;
      resetAiNote = function(){
        if(aiTargetLayer){
          var n = document.getElementById('pmAiNote');
          n.className = 'pm-ai-note';
          n.textContent = 'Напишіть, що змінити — напр. «зробити білим», «прибрати нижній напис», ' +
                          '«товщі лінії». Або оберіть кнопку вище.';
          return;
        }
        _resetNote();
      };
      document.getElementById('pmAiClip').addEventListener('click', function(){
        document.getElementById('pmAiFile').click();
      });
      document.getElementById('pmAiThumbDel').addEventListener('click', function(){ setRefImage(null); });
      document.getElementById('pmAiCrop').addEventListener('click', function(){
        if(!aiRefImage) return;
        openCropper(aiRefImage).then(function(res){
          if(res && res.url){ setRefImage(res.url); renderAiBases(); }
        });
      });
      document.getElementById('pmAiFile').addEventListener('change', function(e){
        var f = e.target.files && e.target.files[0];
        if(!f) return;
        var n = document.getElementById('pmAiNote');
        n.className = 'pm-ai-note'; n.textContent = 'Готуємо фото…';
        prepRefImage(f).then(setRefImage).catch(function(){
          n.className = 'pm-ai-note is-soon';
          n.textContent = 'Не вдалося прочитати це фото. Спробуйте інший файл.';
        });
      });

      // Генерація: Gemini малює зображення, далі Photoroom прибирає фон —
      // рівно той самий шлях, що й у завантаженого файлу.
      var aiBusy = false;
      document.getElementById('pmAiGo').addEventListener('click', function(){
        var extra = (document.getElementById('pmAiPrompt').value || '').trim();
        // Обрана кнопка задає основну задачу, поле — уточнення до неї
        var prompt = aiChosen
          ? aiChosen.prompt + (extra ? ' Additionally: ' + extra : '')
          : extra;
        if(!prompt){
          var n0 = document.getElementById('pmAiNote');
          n0.className = 'pm-ai-note is-soon';
          n0.textContent = aiRefImage
            ? 'Оберіть кнопку вище або опишіть, що зробити з фото.'
            : 'Спершу опишіть логотип.';
          return;
        }
        runAiGeneration(prompt);
      });
      function runAiGeneration(prompt){
        var go = document.getElementById('pmAiGo');
        var n = document.getElementById('pmAiNote');
        if(aiBusy) return;
        aiBusy = true;
        go.disabled = true;
        go.style.opacity = '.6';
        document.querySelectorAll('#pmAiChips .pm-ai-chip').forEach(function(b){ b.disabled = true; });
        n.className = 'pm-ai-note';
        n.textContent = aiRefImage ? 'Обробляємо фото… це може зайняти до хвилини.'
                                   : 'Малюємо… це може зайняти до хвилини.';
        var usedRef = aiRefImage;
        var target = aiTargetLayer;
        generateLogoViaAi(prompt, aiRefImage).then(function(src){
          n.textContent = 'Прибираємо фон…';
          return removeBgForUpload(src).then(function(clean){ return clean; },
                                            function(){ return src; })
            .then(function(clean){
              if(target) return replaceLayerImage(target, src, clean);
              addLogo(src, clean);
              // запамʼятовуємо референс — щоб потім можна було перегенерувати від нього
              var last = currentLayers()[currentLayers().length - 1];
              if(last) last.aiRef = usedRef || null;
            });
        }).then(function(){
          closeAll();
          document.getElementById('pmAiPrompt').value = '';
          aiTargetLayer = null;
          aiChosen = null;
          setRefImage(null);
          renderAiBases();
        }).catch(function(err){
          var m = String((err && err.message) || '');
          n.className = 'pm-ai-note is-soon';
          n.textContent =
            m === 'ai-network'      ? 'Сервіс генерації не відповів. Спробуйте ще раз або завантажте файл.' :
            m === 'no-image'        ? 'Gemini не намалював зображення за цим описом — сформулюйте інакше.' :
            m === 'empty-prompt'    ? 'Спершу опишіть логотип.' :
            m === 'worker-no-ref'   ? 'Фото не дійшло до Gemini — у Cloudflare стара версія воркера. ' +
                                      'Онови код loomiq-gemini, інакше логотип буде вигаданий.' :
            m === 'gemini-failed'   ? 'Gemini відхилив запит' + (err.status ? ' (код ' + err.status + ')' : '') + '.' :
            'Не вдалося згенерувати (' + (m || 'помилка') + '). Поки завантажте файл.';
          // Пояснення Google показуємо як є — без нього причину не вгадати.
          if(err && err.detail) n.textContent += ' ' + err.detail;
          if(err && err.vars) n.textContent += ' Змінні воркера: ' + err.vars + '.';
        }).then(function(){
          aiBusy = false;
          go.disabled = false;
          go.style.opacity = '';
          document.querySelectorAll('#pmAiChips .pm-ai-chip').forEach(function(b){ b.disabled = false; });
        });
      }
      renderAiChips();
    })();

    document.getElementById('pmFileInput').addEventListener('change', function(e){
      var f = e.target.files && e.target.files[0];
      if(!f) return;
      var rd = new FileReader();
      rd.onload = function(ev){
        var src = ev.target.result;
        removeBgForUpload(src).then(function(clean){ addLogo(src, clean); })
          .catch(function(){ addLogo(src, null); });
      };
      rd.readAsDataURL(f);
      e.target.value = '';
    });

    document.getElementById('pmTabs').querySelectorAll('.pm-tab').forEach(function(tabBtn){
      tabBtn.addEventListener('click', function(){
        pm.tab = tabBtn.dataset.tab;
        document.getElementById('pmTabs').querySelectorAll('.pm-tab').forEach(function(t){t.classList.remove('active');});
        tabBtn.classList.add('active');
        renderTabPanel();
      });
    });

    // Підказка «Вкажіть кількість» — не текст, а шлях: тап веде туди, де її ставлять.
    (function(){
      var w = document.getElementById('pmQtyWarning');
      if(!w) return;
      w.addEventListener('click', function(){
        if(!w.classList.contains('is-tap')) return;
        goTab('size');
        document.getElementById('pmTabs').querySelectorAll('.pm-tab').forEach(function(t){
          t.classList.toggle('active', t.dataset.tab === 'size');
        });
        renderTabPanel();
      });
    })();

    /* Підписи ракурсів. Стандартні — запасний варіант: менеджер може назвати
       сторону як завгодно («Козирок», «Спинка кепки»), бо на кепці «зад» — це
       не спина, і клієнта такий підпис лише плутає. */
    var VIEW_LABEL_DEF = {front:'Перед', back:'Спина', left:'Лівий бік', right:'Правий бік'};
    var VIEW_LABEL = new Proxy({}, { get:function(_, k){
      try{ return sideLabelOf(pm.garmentId, String(k)); }
      catch(e){ return VIEW_LABEL_DEF[k] || String(k); }
    }});
    var VIEW_SHORT = new Proxy({}, { get:function(_, k){
      var full = VIEW_LABEL[k];
      return ({front:'Перед', back:'Спина', left:'Лівий', right:'Правий'})[k] || full;
    }});

    // Підпис і крапки — покажчик стану, кнопкою він не є. Перемикають стрілки
    // по краях фото: вони на своєму звичному місці, а плашка більше не лежить
    // поверх товару.
    // Кнопка має казати, що станеться: при поверненні позиції з кошика це не
    // «додати ще одну», а «оновити ту саму». Інакше люди додавали дубль.
    /* Конструктор відкрили з наявної картки клієнта — тоді кошика в цьому
       сценарії немає взагалі: позиція йде просто в те замовлення, з якого
       прийшли. Менеджера збивало саме слово «кошик»: виглядало так, ніби він
       складає ще одне, нове замовлення. */
    function boundOrder(){
      try{ var h = window.__lqAdminHost(); return (h && h.__adminOfferTarget) || null; }
      catch(e){ return null; }
    }
    /* Логотипи цього замовлення — їх завантажили один раз у картці клієнта.
       Список приходить від адмінки разом із привʼязкою до замовлення. */
    function orderLogos(){
      var t = boundOrder();
      var l = t && t.logos;
      return Array.isArray(l) ? l.filter(function(u){ return typeof u === 'string' && u; }) : [];
    }
    /* Плитки логотипів стоять першими в тому самому ряду, що й дизайни:
       це все «що можна покласти на виріб», і розділяти їх на два поверхи
       немає за чим. Саму картинку ставимо з коду, а не в атрибут style:
       у data-URI трапляються лапки, і розмітка від них розсипається. */
    function orderLogosHtml(){
      var list = orderLogos();
      if(!list.length) return '';
      return '<div class="lqo-row">' + list.map(function(u, i){
          return '<button class="lqo-b" data-order-logo="' + i + '" ' +
                 'title="Логотип замовлення — поставити на цю сторону"></button>';
        }).join('') + '</div><div class="lqo-sep"></div>';
    }
    function syncAddLabels(){
      var edit = !!pm.editing;
      var bound = !!boundOrder();
      var main = document.getElementById('pmAddMain');
      var t1 = document.querySelector('.pm-add-btn'), t2 = document.getElementById('pmStickyCartBtn');
      [t1, t2].forEach(function(b){
        if(!b) return;
        var sum = b.querySelector('.pm-add-btn-sum');
        /* У картці пропозиції менеджер не «додає в кошик» — він править
           позицію, яка вже там стоїть. Кнопка так і має називатись. */
        b.childNodes[0].nodeValue = window.__lqInline ? 'Зберегти зміни'
          : (edit ? (bound ? 'Оновити в замовленні' : 'Оновити в кошику')
                  : (bound ? 'Додати до замовлення' : 'Додати в кошик'));
        if(sum) b.appendChild(sum);
      });
      if(main) main.textContent = edit
        ? (bound ? 'Оновити як основний товар' : 'Оновити як основний товар')
        : (bound ? 'Додати до замовлення як основний' : 'Додати як основний товар');
      var reco = document.getElementById('pmAddReco');
      if(reco) reco.textContent = edit ? 'Оновити як рекомендований'
        : (bound ? 'Додати до замовлення як рекомендацію' : 'Додати як рекомендований');
    }
    window.__syncAddLabels = syncAddLabels;
    // Адмінка відкриває конструктор одразу на потрібній вкладці (?tab=)
    window.__pmGoTab = function(id){ if(id) goTab(id); };
    // Перемикання вкладки з коду: стан і смужка мають мінятись разом, інакше
    // панель показує одне, а підсвічена вкладка — інше.
    function goTab(id){
      if(pm.tab === id) return;
      // Пішли з «Дизайну» — екран кольору закривається разом із замком на
      // перемальовування. Інакше панель лишалась замкненою на палітрі й інші
      // вкладки просто не малювались.
      tsLock = 0; pm.textScreen = null; pm.textDrop = null; pm.garmentPick = false;
      pm.tab = id;
      var tabs = document.getElementById('pmTabs');
      if(tabs) tabs.querySelectorAll('.pm-tab').forEach(function(t){
        t.classList.toggle('active', t.dataset.tab === id);
      });
    }
    function renderSideDots(){
      var box = document.getElementById('pmSideMark');
      if(!box) return;
      var views = getViews();
      box.innerHTML = '<span class="pm-side-mark-name" id="pmSideMarkName"></span>' +
        (views.length > 1
          ? '<span class="pm-side-mark-dots" id="pmSideMarkDots">' +
              views.map(function(){ return '<i></i>'; }).join('') + '</span>'
          : '');
      updateSideMarks();
    }
    // renderGarment() смикається під час перетягування — тут лише текст і класи.
    function updateSideMarks(){
      var box = document.getElementById('pmSideMark');
      if(!box) return;
      var views = getViews(), i = views.indexOf(pm.side);
      var dots = box.querySelectorAll('#pmSideMarkDots i');
      if(views.length > 1 && dots.length !== views.length){ renderSideDots(); return; }
      var nm = box.querySelector('#pmSideMarkName');
      if(nm) nm.textContent = VIEW_SHORT[pm.side] || pm.side;
      dots.forEach(function(d, j){ d.classList.toggle('on', j === i); });
    }
    // Крайні стрілки ховаються на межах списку — як було до плашки.
    function updateSideArrows(){
      var views = getViews(), i = views.indexOf(pm.side);
      var l = document.getElementById('pmArrowLeft'), r = document.getElementById('pmArrowRight');
      if(l) l.style.display = i > 0 ? '' : 'none';
      if(r) r.style.display = i < views.length - 1 ? '' : 'none';
    }
    document.getElementById('pmArrowRight').addEventListener('click', function(){
      var v = getViews(), i = v.indexOf(pm.side); if(i < v.length - 1) setSide(v[i+1]);
    });
    document.getElementById('pmArrowLeft').addEventListener('click', function(){
      var v = getViews(), i = v.indexOf(pm.side); if(i > 0) setSide(v[i-1]);
    });
    function setSide(side){
      ensureLogoSides();
      // Перейшли на іншу сторону — правку напису закриваємо: редагувати те,
      // чого вже не видно, все одно неможливо, а відкрита правка тягла за
      // собою вузол напису на нову сторону.
      stopTextEdit();
      pm.side = side;
      pm.activeLogoId = (pm.logos[side]&&pm.logos[side].length) ? pm.logos[side][0].id : null;
      updateSideMarks();
      updateSideArrows();
      renderGarment();
      if(pm.tab==='photo') renderTabPanel();
    }
    // Свайп для перемикання сторін прибрано — він заважав перетягувати/масштабувати лого.
    // Перемикання сторін — стрілками по краях фото.
    var pmStage = document.getElementById('pmStage');

    // Open/close modal
    var productModal = document.getElementById('productModal');
    /* Прев'ю з адмінки: ?garment=<id> одразу відкриває картку цього товару */
    (function(){
      try{
        var q = new URLSearchParams(location.search);
        var g = q.get('garment');
        if(!g) return;
        window.addEventListener('load', function(){
          setTimeout(function(){ try{ openProductModal(g); }catch(e){} }, 300);
        });
      }catch(e){}
    })();

    function openProductModal(garmentId, carry){
      zoneOutBySide = {};   // скидаємо стан зони від попереднього товару
      // виріб міг бути знятий з продажу (старий кошик, посилання) — беремо перший наявний
      if(garmentId && !GARMENTS.some(function(g){ return g.id === garmentId; })) garmentId = null;
      pm.garmentId = garmentId || GARMENTS[0].id;
      // Прийшли з рекомендованої картки — беремо саме той колір, який на ній
      // показали. Інакше картка обіцяє шоколадне худі, а відкривається біле.
      if(carry && carry.colorId && getColors().some(function(c){ return c.id === carry.colorId; })){
        pm.colorId = carry.colorId;
        pm.colorPicked = true;
      } else {
        if(!getColors().some(function(c){return c.id===pm.colorId;})) pm.colorId = getColors()[0].id;
        pm.colorPicked = false;   // новий товар — колір ще не обирали
      }
      if(window.lqAn){
        window.lqAn.step('ctor');
        window.lqAn.track('open_ctor', { garment: pm.garmentId, from: carry ? 'reco' : 'catalog' });
      }
      pm.tab = 'photo';
      pm.textOpen = false;     // панель напису не тягнемо з попереднього товару
      pm.textDrop = null; pm.textEdit = null; pm.textScreen = null;
      pm.garmentPick = false;
      pm.sizeFocus = null;
      pm.editing = false;      // звичайне відкриття картки — не редагування
      /* Тираж на новий виріб не переїжджає. Кількість базового товару
         визначає менеджер — він знає, скільки саме футболок беруть, і
         успадкована з попередньої картки цифра означала б замовлення на
         30 худі там, де домовлялись про 10.
         Виняток — перехід із рекомендованої картки (carry): там тираж
         навмисно той самий, що й в основної позиції, і питати його вдруге
         немає за чим. */
      if(!carry) pm.qty = {};
      window.__pmEditIndex = null;
      try{ syncAddLabels(); }catch(e){}
      // перше фото = те, що менеджер поставив першим у порядку (перетягуванням в адмінці)
      pm.side = getViews()[0] || 'front';
      ensureLogoSides();
      pm.activeLogoId = (pm.logos[pm.side] && pm.logos[pm.side].length) ? pm.logos[pm.side][0].id : null;
      document.getElementById('pmTabs').querySelectorAll('.pm-tab').forEach(function(t,i){t.classList.toggle('active', i===0);});
      renderSideDots();
      updateSideArrows();
      closeMenu();
      closeAllMainModals();
      productModal.classList.add('open');
      productModal.scrollTop = 0;
      renderGarment();
      renderTabPanel();
      updatePriceBar();
      try{ renderRecommended(); }catch(e){}
      requestAnimationFrame(fitGarmentStage);
      fitStageTwice();
      /* Логотип замовлення сам стає на новий виріб. Менеджер додає худі —
         і бачить його вже з лого, а не порожнім: інакше на кожен товар
         доводилось окремо згадувати про логотип, і в пропозицію потрапляли
         виготовлені «голі» позиції.
         Ставимо лише коли на виробі ще нічого немає і коли конструктор
         відкритий із картки замовлення. Місце типове — центр зони друку;
         менеджер його вільно посуне. Чекаємо на фото виробу: без його
         розмірів зону нанесення не порахувати, а отже й ціну. */
      if(!carry && logoCount() === 0 && orderLogos().length){
        var putLogo = function(){
          try{ if(logoCount() === 0) addLogo(orderLogos()[0], orderLogos()[0], null); }catch(e){}
        };
        if(pmGarmentPhoto && pmGarmentPhoto.complete && pmGarmentPhoto.naturalWidth)
          requestAnimationFrame(function(){ requestAnimationFrame(putLogo); });
        else if(pmGarmentPhoto)
          pmGarmentPhoto.addEventListener('load', function once(){
            pmGarmentPhoto.removeEventListener('load', once);
            requestAnimationFrame(function(){ requestAnimationFrame(putLogo); });
          });
      }
      // Перенесений із рекомендованих дизайн ставимо, коли фото нового виробу
      // вже завантажене: без його розмірів зону нанесення не порахувати.
      if(carry && carry.ctx && carry.ctx.layers && carry.ctx.layers.length){
        var put = function(){ try{ recApplyCarry(carry); }catch(e){} };
        if(pmGarmentPhoto && pmGarmentPhoto.complete && pmGarmentPhoto.naturalWidth)
          requestAnimationFrame(function(){ requestAnimationFrame(put); });
        else if(pmGarmentPhoto)
          pmGarmentPhoto.addEventListener('load', function(){ requestAnimationFrame(put); }, { once:true });
      }
      navGo({kind:'product', garmentId: pm.garmentId});
    }
    document.getElementById('pmBackBtn').addEventListener('click', function(){
      if(!_navInternal && productModal.classList.contains('open')){ history.back(); }
      else productModal.classList.remove('open');
    });
    document.getElementById('pmPhoneBtn').addEventListener('click', function(){ document.getElementById('pmPhoneModal').classList.add('open'); });
    document.getElementById('pmCartBtn').addEventListener('click', function(){ cartModalCtrl.open(); });
    document.getElementById('pmMenuBtn').addEventListener('click', function(){ toggleMenu(); });

    // Wire catalog product cards to open the configurator with the right garment preselected
    var cardGarmentMap = {
      'Худі':'hoodie','Футболки':'tee','Світшоти':'sweat','Кепки':'cap','Шопери':'tee',
      'Фартухи':'tee','Робочі куртки':'hoodie',
      'Дитячі футболки':'tee','Дитячі худі':'hoodie','Боді':'tee','Дитячі шапки':'cap',
      'Парасолі':'tee','Кружки':'tee','Брелоки':'tee',
      // назви в однині — саме так вони підписані на картках лендінгу
      'Футболка':'tee','Світшот':'sweat','Кепка':'cap','Шопер':'tote',
      'Фартух':'apron','Кітель':'kitel'
    };
    document.addEventListener('click', function(e){
      var card = e.target.closest('.product');
      if(!card) return;
      var nameEl = card.querySelector('h3,h4');
      var name = nameEl ? nameEl.textContent.trim() : '';
      openProductModal(card.dataset.garment || cardGarmentMap[name] || 'tee');
    }, true);

    // Add to cart → show mockup confirm popup first (matches original UX exactly)
    // Знімок обраного товару (фото + накладений логотип) → data URL для кошика
    function snapshotSide(side, sizeOverride, asJpeg){
      return new Promise(function(resolve){
        var g = getGarment(), c = getColor();
        var snapSide = side;
        var layers = pm.logos[snapSide];
        var wrapEl = document.getElementById('pmGarmentWrap');
        var wrapW = (wrapEl && wrapEl.clientWidth) || 300;
        var C = sizeOverride || 500, k = C / wrapW;
        var canvas = document.createElement('canvas'); canvas.width = C; canvas.height = C;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';   // чіткіший макап
        ctx.fillStyle = 'rgb(233,230,231)'; ctx.fillRect(0,0,C,C);
        var hasPhoto = !!GARMENT_COLORS[g.id] && (!g.custom || !!window.PHOTO_OVERRIDES[g.id+'-'+c.id+'-'+snapSide]);
        var garmentP = hasPhoto
          ? loadImgEl(window.LQ_img('/images/'+g.id+'-'+c.id+'-'+snapSide+'.webp')).then(function(img){
              var s = Math.min(C/img.naturalWidth, C/img.naturalHeight);
              var dw = img.naturalWidth*s, dh = img.naturalHeight*s;
              ctx.drawImage(img, (C-dw)/2, (C-dh)/2, dw, dh);
            }).catch(function(){})
          : Promise.resolve();
        garmentP.then(function(){
          return layers.reduce(function(p, layer){
            return p.then(function(){
              return loadImgEl(layer.url).then(function(img){
                var sz = 120*layer.scale, ar = layer.ar||1, bw = sz, bh = sz;
                if(ar>=1) bh = sz/ar; else bw = sz*ar;
                var cx = (wrapW/2 + layer.x)*k, cy = (wrapW/2 + layer.y)*k;
                var w = bw*k, h = bh*k;
                ctx.save(); ctx.translate(cx, cy); ctx.rotate((layer.rot||0)*Math.PI/180);
                ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore();
              }).catch(function(){});
            });
          }, Promise.resolve());
        }).then(function(){
          /* JPEG там, де прозорість не потрібна. Сцена завжди має суцільний
             фон, а PNG на 900 px — це під пів мегабайта на кожну сторону:
             саме через це збереження позиції відчутно затягувалось. */
          try { resolve(asJpeg ? canvas.toDataURL('image/jpeg', 0.92)
                               : canvas.toDataURL('image/png')); } catch(e){ resolve(null); }
        });
      });
    }

    function triggerAddToCartFlow(){
      var u = totalUnits();
      if(u===0){ alert('Оберіть розмір і кількість'); return; }
      if(anyLogoOutsideAnySide()){ alert('Логотип виходить за зону друку. Посуньте його всередину пунктирної зони, щоб продовжити.'); return; }
      /* Конструктор стоїть просто в картці пропозиції: аркуш «Додано в кошик»
         тут зайвий. Він розповідає клієнтові про наступні кроки й пропонує
         менеджерові вибрати блок кошика — а в пропозиції і кошика немає, і
         блок уже відомий: правиться конкретна позиція. Тому зберігаємо
         одразу, без проміжного вікна. */
      if(window.__lqInline){ addCurrentToCart(window.__pmAddKind === 'reco' ? 'reco' : 'main'); return; }
      document.getElementById('pmMockupModal').classList.add('open');
      if(window.__markAddKind) window.__markAddKind();
    }
    document.getElementById('pmAddToCartBtn').addEventListener('click', triggerAddToCartFlow);
    document.getElementById('pmStickyCartBtn').addEventListener('click', triggerAddToCartFlow);
    // Менеджер: завантаження макапа поточної сторони (перед/зад/бік) як PNG
    (function(){
      var btn = document.getElementById('pmDownloadMockup'); if(!btn) return;
      btn.addEventListener('click', function(){
        btn.disabled = true; var old = btn.innerHTML; btn.textContent = 'Готуємо…';
        snapshotSide(pm.side, 2000).then(function(url){   // висока роздільна здатність для завантаження
          if(url){
            var a = document.createElement('a');
            a.href = url;
            a.download = 'mockup-' + pm.garmentId + '-' + pm.colorId + '-' + pm.side + '.png';
            document.body.appendChild(a); a.click(); a.remove();
          }
          btn.disabled = false; btn.innerHTML = old;
        }).catch(function(){ btn.disabled = false; btn.innerHTML = old; });
      });
    })();

    // Позиція кошика буває двох видів: 'main' — те, що клієнт просив прорахувати,
    // 'reco' — наша рекомендація, яка не входить у суму, доки клієнт сам її не додасть.
    // Клієнт на сайті завжди додає 'main'; вибір є лише в менеджера.
    window.__pmAddKind = 'main';
    function addCurrentToCart(kind){
      var u = totalUnits();
      /* Беремо всі вписані кількості, а не лише ті розміри, що зараз у сітці:
         інакше «Без розміру» не потрапляло б у склад позиції — тираж є, а
         рядка з розміром немає, і в замовленні незрозуміло, що замовили. */
      var sizesStr = Object.keys(pm.qty || {}).filter(function(s){ return (pm.qty[s] || 0) > 0; })
        .map(function(s){ return s + ' × ' + pm.qty[s]; }).join(', ');
      var nm = productName();
      var item = {
        kind: (kind === 'reco' ? 'reco' : 'main'),
        recoNote: '',                          // пояснення рекомендації — менеджер вписує в кошику
        name: nm,
        color: getColor().name,
        print: getPrint().name,
        sizes: sizesStr,
        price: orderTotal(),
        unitPrice: effUnitPrice(),
        // собівартість/маржа — для менеджерського кошторису (клієнту не показуємо)
        unitCost: (unitCost() + (u>0?Math.round(methodOrderCost()/u):0)),
        cost: orderCostTotal(),
        qty: u,
        // Дескриптор для спільного розрахунку: кошик перераховує ціни щоразу,
        // бо вони залежать від інших позицій (спільний макет, спільний тираж).
        desc: draftDescriptor(),
        // Розклад ціни — щоб комерційна пропозиція могла точно порахувати вартість
        // за будь-якого тиражу («при більшому тиражі»), а не приблизно.
        calc: (function(){
          var m = methodCfgNew();
          var ap = applicationParts();
          var firstLogo = (function(){ var l = null; getViews().forEach(function(s){ if(!l && (pm.logos[s]||[]).length) l = pm.logos[s][0]; }); return l; })();
          return {
            base: basePriceNew(),
            coefPart: ap.coefPart,                 // вишивка — під знижкою за тираж
            pieceFee: methodPieceFee(),
            orderFee: methodOrderFee(),            // разова, ділиться на тираж
            method: (m && m.mode === 'grid') ? 'dtf' : 'embro',
            dtfCols: (m && m.mode === 'grid' && firstLogo)
              ? (function(){ var cols = []; getViews().forEach(function(s){ (pm.logos[s]||[]).forEach(function(l){ cols.push(dtfBandCol(m, l)); }); }); return cols; })()
              : []
          };
        })(),
        imgs: [],
        config: {
          garmentId: pm.garmentId,
          colorId: pm.colorId,
          printId: pm.printId,
          qty: Object.assign({}, pm.qty),
          logos: JSON.parse(JSON.stringify(pm.logos))
        }
      };
      // Розмір нанесення рахуємо тут, поки відкритий конструктор: далі, у кошику,
      // масштабу зони вже немає. Менеджеру в Канбані потрібні саме міліметри.
      item.prints = [];
      getViews().forEach(function(side){
        (pm.logos[side] || []).forEach(function(l){
          /* Той самий габарит, що показує прорахунок і за яким рахується
             ціна, — по непрозорому вмісту. Доти сюди йшов габарит усього
             прямокутника картинки, і в картці замовлення стояв один розмір,
             а в редакторі — інший. */
          var d = layerOpaqueDimsMm(l);
          item.prints.push({
            side: side,
            sideLabel: sideLabelOf(pm.garmentId, side),
            technique: getPrint().name,
            widthMm: Math.round(d.w),
            heightMm: Math.round(d.h),
            file: l.url || null          // оригінал, як його завантажив клієнт
          });
        });
      });
      /* Розклад нанесення їде разом із позицією: після збереження відновити
         його нізвідки — він живе тільки поки конструктор відкритий. */
      try{
        var _sd = sharedDraftParts(totalUnits());
        var _gq = (_sd && _sd.parts && _sd.parts.groupQty) ? _sd.parts.groupQty : totalUnits();
        item.calcLines = calcLinesForItem(_gq);
      }catch(e){ item.calcLines = []; }
      // Редагування з кошика — перезаписуємо ту саму позицію на її місці,
      // щоб порядок не стрибав і не з'являвся дубль.
      var ei = window.__pmEditIndex;
      if(ei != null && cartItems[ei]){
        item.recoNote = cartItems[ei].recoNote || '';
        cartItems[ei] = item;
        if(window.lqAn) window.lqAn.track('cart_edit', { garment: pm.garmentId });
      } else {
        cartItems.push(item);
        if(window.lqAn){
          window.lqAn.step('cart');
          window.lqAn.track('add_cart', { garment: pm.garmentId, qty: item.qty,
            sum: item.price, print: (getPrint() || {}).name || '' });
        }
      }
      /* У робочому місці менеджера позиція лишається відкритою й після
         збереження — отже й далі редагується. Скинути номер тут означало б,
         що наступне збереження ДОДАСТЬ ще одну таку саму позицію замість
         того, щоб оновити цю. */
      if(!window.__lqInline) window.__pmEditIndex = null;
      /* Знімаємо ВСІ сторони виробу, а не тільки ті, де є нанесення.
         Перед і спина показуються клієнту завжди: людина замовляє одяг, а не
         принт, і хоче бачити, як він виглядатиме з обох боків — навіть коли
         ззаду нічого не наносять. Доти в пропозицію потрапляв самий перед, і
         спини просто не існувало.

         Решта сторін (боковинки кепки, рукав) знімаються теж і лежать
         готовими: показати їх клієнту — один клік у пропозиції, без
         повторного відкривання конструктора. Малювати їх наново потім нема
         де: масштаб зони живе тільки поки конструктор відкритий. */
      var allViews = getViews().slice(0, 6);
      if(!allViews.length) allViews = ['front'];
      var baseSides = { front:1, back:1 };
      item.views = allViews.map(function(s, k){
        return { id: s, side: s, label: sideLabelOf(pm.garmentId, s), img: null, auto: k,
                 show: !!(baseSides[s] || (pm.logos[s] || []).length) };
      });
      /* 1600px — для сторін із нанесенням: макет іде у замовлення й Канбан і
         має лишатись чітким. Сторони без нанесення показують сам виріб, і
         тримати їх такими ж важкими немає сенсу — це просто довше
         зберігається.

         Формат — JPEG, і для сторін із нанесенням теж. Полотно макета
         залите непрозорим тлом, тож зберігати нічого прозорого тут не
         треба, — а PNG на 1600×1600 важив кілька мегабайтів. Шість таких
         летіли в хмару одночасно, ділили канал і впирались у тридцять
         секунд на файл: макети просто не довантажувались, і позиція
         зберігалась без жодного фото. JPEG на 0.92 виглядає так само, але
         легший разів у десять. */
      var snapDone = Promise.all(allViews.map(function(s){
        var has = (pm.logos[s] || []).length;
        return snapshotSide(s, has ? 1600 : 900, true);
      }))
        .then(function(imgs){
          /* Номер ракурсу і номер знімка мають збігатись. Якщо якась сторона
             не намалювалась, її треба прибрати РАЗОМ із діркою в списку —
             інакше зсув на один перетворив би «Спину» на «Перед». */
          item.views = item.views.filter(function(v, k){ return !!imgs[k]; })
                                 .map(function(v, n){ v.auto = n; return v; });
          item.imgs = imgs.filter(Boolean);
          renderCart();
        }).catch(function(){});
      renderCart();
      document.getElementById('pmMockupModal').classList.remove('open');
      /* У робочому місці менеджера конструктор — це не вікно, яке закривають
         після покупки, а сам документ, у якому працюють. Закривати його й
         стирати тираж після збереження не можна: вікно перестає вважатись
         відкритим — і позиція знову починає рахуватись двічі, — а порожній
         тираж змушує конструктор просити «оберіть розмір і кількість» одразу
         після того, як позицію з цим розміром щойно зберегли. */
      if(!window.__lqInline) productModal.classList.remove('open');
      /* Прийшли з картки клієнта — кошик пропускаємо. Позиція лягає прямо в
         те замовлення, і менеджер повертається туди, звідки почав. Чекаємо
         на знімки макета: без них у картці буде позиція без картинки. */
      if(boundOrder() && typeof window.__lqSendToOrder === 'function'){
        if(!window.__lqInline){
          window.__pmAddKind = 'main';
          pm.qty = {}; pm.editing = false;
          try{ syncAddLabels(); }catch(e){}
        }
        /* Обіцянку запису лишаємо назовні. Робоче місце менеджера перемикає
           позиції й показує клієнтський вигляд — і те, і те має дочекатись
           саме кінця запису. Доти воно вважало збереженим уже сам клік: поки
           знімалися макети й летів запит, конструктор устигали розібрати й
           засіяти наново, і правки тихо зникали. */
        window.__lqSavePromise = snapDone.then(function(){ return window.__lqSendToOrder(); });
        return;
      }
      cartModalCtrl.open();
      window.__pmAddKind = 'main';            // наступна позиція знову вважається основною
      // Кількість не переносимо на наступну позицію: людина вже «витратила» ці
      // штуки, і мовчки успадкований тираж — це замовлення на 22 футболки замість
      // 10. Логотипи лишаємо: те саме лого на кепці й футболці — звичайна річ.
      pm.qty = {};
      pm.editing = false;
      try{ syncAddLabels(); }catch(e){}
    }
    document.getElementById('pmMockupConfirmBtn').addEventListener('click', function(){ addCurrentToCart('main'); });
    // Менеджерський режим: замість однієї кнопки — вибір, у який блок кошика класти
    (function(){
      if(!IS_MANAGER) return;
      document.getElementById('pmMockupConfirmBtn').style.display = 'none';
      var mgr = document.getElementById('pmMockupMgr');
      mgr.style.display = '';
      document.getElementById('pmAddMain').addEventListener('click', function(){ addCurrentToCart('main'); });
      document.getElementById('pmAddReco').addEventListener('click', function(){ addCurrentToCart('reco'); });
      // Підсвічуємо той варіант, який менеджер обрав, натиснувши кнопку в кошику
      window.__markAddKind = markAddKind;
      function markAddKind(){
        var reco = window.__pmAddKind === 'reco';
        var a = document.getElementById('pmAddMain'), b = document.getElementById('pmAddReco');
        [[a, !reco], [b, reco]].forEach(function(pair){
          pair[0].style.background = pair[1] ? '#0f2034' : '#fff';
          pair[0].style.color      = pair[1] ? '#fff'    : '#0f2034';
        });
      }
    })();
    document.getElementById('pmMockupContinueBtn').addEventListener('click', function(){
      document.getElementById('pmMockupModal').classList.remove('open');
    });

    // Sticky cart bar — shows once the main add-to-cart button scrolls out of view
    var pmStickyCart = document.getElementById('pmStickyCart');
    var pmStickyObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        pmStickyCart.classList.toggle('show', !entry.isIntersecting && entry.boundingClientRect.top < 0);
      });
    }, {root: productModal, threshold:0});
    pmStickyObserver.observe(document.getElementById('pmAddToCartBtn'));

    // Floating Telegram button — shows once the "Відгуки" row scrolls into view,
    // and stays visible while continuing to scroll further down the page.
    var pmFloatTelegram = document.getElementById('pmFloatTelegram');
    var pmTelegramObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        pmFloatTelegram.classList.toggle('show', entry.isIntersecting || entry.boundingClientRect.top < 0);
      });
    }, {root: productModal, threshold:0});
    pmTelegramObserver.observe(document.getElementById('pmRowReviews'));

    // Detail tabs: Про товар / Типи нанесення
    var pmDetailPanel = document.getElementById('pmDetailPanel');
    var detailTab = 'about';
    var SPECS = [
      ['Матеріал','100% бавовна'],['Щільність','240 г/м²'],['Крій','класичний'],
      ['Формат','унісекс'],['Нанесення','DTF друк та вишивка']
    ];
    var PRINT_COMPARE = [
      {name:'DTF-друк', bg:'#f4ede4', color:'#8B5E3C', price:'від 540 грн',
        desc:'Дозволяє точно передати складні дизайни без втрати деталей. Ідеально підходить для яскравих зображень, фотографій і логотипів із дрібними елементами.',
        pros:['Фото, ілюстрацій та градієнтів','Дизайнів, де важлива максимальна точність'],
        icon:'<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7V4h12v3"/><circle cx="18" cy="12" r="1" fill="currentColor"/><path d="M6 17v3h12v-3"/>'},
      {name:'Вишивка', bg:'#fdf4ee', color:'#d4622a', price:'+120 грн до ціни',
        desc:"Має об'ємний преміальний вигляд і зберігає свій вигляд навіть після тривалого використання.",
        pros:['Якщо потрібен преміальний та довговічний результат'],
        icon:'<circle cx="17" cy="7" r="2"/><path d="M15.5 8.5L9 15M5 19s0-4 4-4l4-4"/><path d="M3 21l3-3"/>'}
    ];
    function escHtml(s){ return String(s||'').replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];}); }
    function renderDetailPanel(){
      if(detailTab === 'about'){
        // Опис: якщо менеджер задав власний в адмінці — показуємо його
        var customDesc = window.SITE_CONTENT.descriptions[pm.garmentId];
        var descText = customDesc
          ? escHtml(customDesc).replace(/\n/g,'<br>')
          : productName()+' з якісних матеріалів. Крій вільний, плечовий шов спущений.';
        var html = '<p class="pm-about-text">'+descText+'</p>';
        // Характеристики: якщо менеджер задав власні для товару — показуємо їх
        var customSpecs = window.SITE_CONTENT.specs[pm.garmentId];
        var specRows = (customSpecs && customSpecs.length)
          ? customSpecs.map(function(r){ return [r.label, r.value]; })
          : SPECS;
        specRows.forEach(function(row){
          html += '<div class="pm-spec-row"><div class="pm-spec-label">'+escHtml(row[0])+'</div><div class="pm-spec-value">'+escHtml(row[1])+'</div></div>';
        });
        pmDetailPanel.innerHTML = html;
      } else {
        var html = '';
        PRINT_COMPARE.forEach(function(p){
          html += '<div class="pm-print-compare">' +
            '<div class="pm-print-compare-ic" style="background:'+p.bg+';color:'+p.color+';"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+p.icon+'</svg></div>' +
            '<div style="flex:1;">' +
              '<div style="margin-bottom:5px;"><span class="pm-print-compare-name">'+p.name+'</span></div>' +
              '<div class="pm-print-compare-desc">'+p.desc+'</div>' +
              '<div class="pm-print-compare-pros">'+p.pros.map(function(pro){
                return '<span class="pm-print-compare-pro"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+pro+'</span>';
              }).join('')+'</div>' +
            '</div></div>';
        });
        pmDetailPanel.innerHTML = html;
      }
    }
    document.querySelectorAll('.pm-detail-tab').forEach(function(t){
      t.addEventListener('click', function(){
        detailTab = t.dataset.detailTab;
        document.querySelectorAll('.pm-detail-tab').forEach(function(x){x.classList.remove('active');});
        t.classList.add('active');
        renderDetailPanel();
      });
    });
    renderDetailPanel();

    // Reviews data (shared content for the full reviews page)
    var PM_REVIEWS = [
      {name:'Олексій К.', date:'2 дні тому', stars:5, text:'Дуже якісна форма! Логотип чіткий, колір не блякне.'},
      {name:'Марина В.', date:'тиждень тому', stars:5, text:'Дуже швидко зробили і доставили. Замовлятиму ще.'},
      {name:'Дмитро С.', date:'2 тижні тому', stars:5, text:'Форма сидить бездоганно — саме те. Тканина приємна, не тягнеться.'},
      {name:'Ольга С.', date:'3 тижні тому', stars:5, text:'Замовляли форму для персоналу кафе. Всі задоволені, будемо знову.'},
      {name:'Андрій П.', date:'1 місяць тому', stars:5, text:'Все чітко і вчасно. Буду замовляти ще.'},
      {name:'Катерина М.', date:'1 місяць тому', stars:5, text:'Відмінна якість тканини і друку. Рекомендую!'}
    ];
    document.getElementById('pmReviewsList').innerHTML = PM_REVIEWS.map(function(r){
      return '<div class="pm-review-item">' +
        '<div class="pm-review-item-top"><span class="pm-review-item-name">'+r.name+'</span><span class="pm-review-item-date">'+r.date+'</span></div>' +
        '<div class="pm-review-item-stars">'+'★★★★★'.slice(0,r.stars)+'</div>' +
        '<div class="pm-review-item-text">'+r.text+'</div>' +
      '</div>';
    }).join('');
    var PM_RATING_BARS = [[5,88],[4,8],[3,3],[2,1],[1,0]];
    document.getElementById('pmReviewsBars').innerHTML = PM_RATING_BARS.map(function(b){
      return '<div class="pm-reviews-bar-row"><span>'+b[0]+'</span><div class="pm-reviews-bar-track"><div class="pm-reviews-bar-fill" style="width:'+b[1]+'%;"></div></div></div>';
    }).join('');
    var PM_REVIEW_PHOTOS = ['work-17','work-01','work-06','work-18','work-03','work-08','work-13','work-15','work-07','work-09','work-16','work-05','work-14'];
    function renderReviewPhotosStrip(){
      // Карусель фото відгуків: менеджер може задати власний набір в адмінці
      var custom = window.SITE_CONTENT.reviewPhotos;
      var srcs = (custom && custom.length)
        ? custom.map(function(u){ return /^https?:/.test(u) ? u : '/images/'+u+'.webp'; })
        : PM_REVIEW_PHOTOS.map(function(s){ return '/images/'+s+'.webp'; });
      document.getElementById('pmReviewsPhotos').innerHTML = srcs.map(function(src){
        return '<img class="pm-reviews-photo" src="'+src+'" alt="Фото відгуку" loading="lazy" decoding="async">';
      }).join('');
    }
    renderReviewPhotosStrip();
    document.addEventListener('lq-content', renderReviewPhotosStrip);
    initScrollHint(document.getElementById('pmReviewsPhotos'));

    // Маленькі квадратики-фото відгуків під рядком «Відгуки» (клік → відкрити відгуки)
    function renderReviewSwatches(){
      var box = document.getElementById('pmReviewSwatches');
      if(!box) return;
      var custom = window.SITE_CONTENT.reviewPhotos;
      var srcs = (custom && custom.length)
        ? custom.map(function(u){ return /^https?:/.test(u) ? u : '/images/'+u+'.webp'; })
        : PM_REVIEW_PHOTOS.map(function(s){ return '/images/'+s+'.webp'; });
      box.innerHTML = srcs.map(function(src){
        return '<img class="pm-row-swatch" src="'+src+'" alt="Фото відгуку" loading="lazy" decoding="async" style="object-fit:cover;">';
      }).join('');
    }
    renderReviewSwatches();
    document.addEventListener('lq-content', renderReviewSwatches);
    initScrollHint(document.getElementById('pmTierRow'));

    // Quick rows
    function setSizeChartTitle(){
      document.getElementById('pmSizeChartTitle').innerHTML =
        '<b style="color:#262626;">Розмірна сітка</b> <span style="color:#888;font-weight:400;">('+productName()+')</span>';
    }
    // Розмірна сітка: фото від менеджера (пріоритет) або таблиця (власна чи стандартна)
    /* Мірки задаються для кожного товару в адмінці: у футболки довжина й
       ширина, у жіночого кітеля — обхват грудей і стегон. Тут ми лише
       малюємо те, що задано; товар без налаштування працює як раніше. */
    var SC_COLS_DEF = [
      { key:'A', label:'Довжина', hint:'Вимірюється від найвищої точки на плечі до низу' },
      { key:'B', label:'Ширина',  hint:'Вимірюється від шва під рукавом до іншого рукава' }
    ];
    function scCols(gid){
      var saved = ((window.SITE_CONTENT.sizechartCols || {})[gid]) || [];
      var list = Array.isArray(saved)
        ? saved.filter(function(c){ return c && c.key; })
               .map(function(c){ return { key:c.key, label:c.label || c.key, hint:c.hint || '' }; })
        : [];
      return list.length ? list : SC_COLS_DEF.slice();
    }
    function scIsDefault(cols){
      return cols.length === 2 && cols[0].key === 'A' && cols[1].key === 'B'
             && cols[0].label === SC_COLS_DEF[0].label && cols[1].label === SC_COLS_DEF[1].label;
    }
    function renderSizeChart(){
      var page = document.getElementById('pmSizeChartPage');
      var photoEl = document.getElementById('pmSizeChartPhoto');
      var photo = window.SITE_CONTENT.sizechartPhotos[pm.garmentId];
      var cols = scCols(pm.garmentId);
      var custom = effectiveChart(pm.garmentId);
      var rows = (custom && custom.length)
        ? custom.map(function(r){ return r; })
        : SIZES.map(function(sz){ var v = SIZE_CHART[sz]; return { size:sz, A:v.A, B:v.B }; });

      /* Схема. Своя картинка головніша за вбудовану: вона намальована саме
         під цей виріб. Вбудовану футболку зі стрілками A і B показуємо лише
         тоді, коли мірки стандартні — на обхваті грудей ті стрілки брехали б. */
      var illust = page.querySelector('.pm-sc-illust');
      var side = page.querySelector('.pm-sc-side');
      var hasIllust = true;
      if(photo){
        photoEl.src = photo; photoEl.style.display = '';
        if(illust) illust.style.display = 'none';
      } else {
        photoEl.style.display = 'none';
        hasIllust = scIsDefault(cols);
        if(illust) illust.style.display = hasIllust ? '' : 'none';
      }
      // Немає що показувати — колонка зникає, таблиця займає всю ширину.
      // Порожній стовпець на пів екрана виглядав як загублена картинка.
      if(side) side.style.display = hasIllust ? '' : 'none';

      var legend = document.getElementById('pmSizeChartLegend');
      if(legend) legend.innerHTML = cols.map(function(c){
        return '<div class="pm-sc-legend-row"><span class="pm-sc-badge">' + c.key + '</span>' +
          '<div class="pm-sc-legend-text"><b>' + escHtml(c.label) + '</b>' +
          (c.hint ? '<p>' + escHtml(c.hint) + '</p>' : '') + '</div></div>';
      }).join('');

      var head = document.getElementById('pmSizeChartHead');
      if(head) head.innerHTML = '<th>РОЗМІР</th>' + cols.map(function(c){
        return '<th>' + escHtml(c.key) + ' (см)</th>';
      }).join('');

      document.getElementById('pmSizeChartBody').innerHTML = rows.map(function(r){
        return '<tr><td>' + escHtml(r.size) + '</td>' +
          cols.map(function(c){ return '<td>' + (r[c.key] == null ? '—' : r[c.key]) + '</td>'; }).join('') +
          '</tr>';
      }).join('');
    }
    document.getElementById('pmRowSizeChart').addEventListener('click', function(){
      setSizeChartTitle();
      renderSizeChart();
      document.getElementById('pmSizeChartPage').classList.add('open');
    });
    document.getElementById('pmRowDelivery').addEventListener('click', function(){
      document.getElementById('pmDeliveryModal').classList.add('open');
    });
    /* Відгуки живуть на сторінці сайту, а не в конструкторі. У пропозиції
       їх немає — і це не привід валити весь конструктор: без них він просто
       не показує цього рядка. */
    document.getElementById('pmRowReviews').addEventListener('click', function(){
      // відкриваємо відгуки ПОВЕРХ картки товару (не закриваючи її), щоб «назад» повертало сюди
      var rm = document.getElementById('reviewsModal');
      if(!rm) return;
      closeMenu();
      rm.style.zIndex = '230';
      rm.dataset.overProduct = '1';
      rm.classList.add('open');
      rm.scrollTop = 0;
    });
    // При закритті відгуків, відкритих поверх товару — прибираємо тимчасовий z-index
    (function(){
      var rm = document.getElementById('reviewsModal');
      if(!rm) return;
      var clearOver = function(){ rm.style.zIndex = ''; delete rm.dataset.overProduct; };
      var bk = document.getElementById('reviewsModalBack');
      if(bk) bk.addEventListener('click', clearOver);
      // свайп-назад теж очистить (обробник свайпу викликає remove('open') — слухаємо зміну класу)
      var mo = new MutationObserver(function(){ if(!rm.classList.contains('open')) clearOver(); });
      mo.observe(rm, {attributes:true, attributeFilter:['class']});
    })();
    document.getElementById('pmDeliveryOkBtn').addEventListener('click', function(){
      document.getElementById('pmDeliveryModal').classList.remove('open');
    });
    document.getElementById('pmReviewsPageBack').addEventListener('click', function(){
      document.getElementById('pmReviewsPage').classList.remove('open');
    });
    document.getElementById('pmSizeChartBack').addEventListener('click', function(){
      document.getElementById('pmSizeChartPage').classList.remove('open');
    });
    document.getElementById('pmSizeChartBody').innerHTML = SIZES.map(function(sz){
      var v = SIZE_CHART[sz];
      return '<tr><td>'+sz+'</td><td>'+v.A+'</td><td>'+v.B+'</td></tr>';
    }).join('');
    // Click outside the sheet card closes the popup (matches original onClick={backdrop}/stopPropagation pattern)
    document.querySelectorAll('.pm-sheet-overlay, .pm-center-overlay').forEach(function(overlay){
      overlay.addEventListener('click', function(e){
        if(e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Phone popup → callback request → consultation form
    document.getElementById('pmCallbackBtn').addEventListener('click', function(){
      document.getElementById('pmPhoneModal').classList.remove('open');
      document.getElementById('pmConsultModal').classList.add('open');
    });
    /* Заявка з вікна консультації. Кнопка колись просто закривала вікно —
       ім'я й номер зникали безслідно. Тепер вони йдуть тим самим шляхом,
       що й заявки зі звичайних форм: у Telegram і в базу, звідки адмінка
       забирає їх у Канбан. */
    document.getElementById('pmConsultSubmitBtn').addEventListener('click', function(){
      var box = document.getElementById('pmConsultModal');
      var tel = box.querySelector('input[type="tel"]');
      var nm  = box.querySelector('input[type="text"]');
      var raw = (tel.value || '').trim();
      if(raw.replace(/\D/g, '').length < 7){
        tel.focus(); tel.style.borderColor = '#e4572e'; return;
      }
      var btn = this, orig = btn.textContent;
      btn.disabled = true; btn.textContent = 'Надсилаємо…';
      var done = function(ok){
        if(!ok){
          btn.disabled = false; btn.textContent = orig;
          alert('Не вдалося надіслати заявку. Спробуйте ще раз або напишіть нам у Telegram.');
          return;
        }
        btn.textContent = '✅ Дякуємо — передзвонимо';
        setTimeout(function(){
          box.classList.remove('open');
          btn.disabled = false; btn.textContent = orig;
          tel.value = ''; if(nm) nm.value = '';
        }, 1800);
      };
      if(window.__lqLead) window.__lqLead(raw, nm ? nm.value : '').then(done);
      else done(false);
    });

    /* «Завантажити логотип» → вибір товару. Кнопка обіцяла макет, а вела в
       каталог: людина опинялась перед списком і мусила сама здогадатись, що
       робити далі. Тепер одразу питаємо, на чому друкуємо, — і після вибору
       відкривається конструктор, де зона завантаження перша на екрані.

       Картки не дублюємо, а копіюємо з каталогу: назви, ціни й фото там
       приходять з адмінки, і другий список одразу почав би розходитись. */
    var promoBtn = document.getElementById('promoUploadBtn');
    if(promoBtn) promoBtn.addEventListener('click', function(e){
      e.preventDefault();
      var src = document.querySelectorAll('#catalog .catalog-grid .product');
      var grid = document.getElementById('pmPickGrid');
      if(!src.length || !grid){
        var cat = document.getElementById('catalog');
        if(cat) cat.scrollIntoView({ behavior:'smooth' });
        return;
      }
      grid.innerHTML = '';
      src.forEach(function(card){
        var cl = card.cloneNode(true);
        cl.removeAttribute('id');
        grid.appendChild(cl);
      });
      document.getElementById('pmPickModal').classList.add('open');
      if(window.lqAn) window.lqAn.track('pick_open');
    });
    // Товар обрано — конструктор уже відкривається, вікно вибору зайве
    var pickGrid = document.getElementById('pmPickGrid');
    if(pickGrid) pickGrid.addEventListener('click', function(){
      document.getElementById('pmPickModal').classList.remove('open');
    });

    // FAQ accordion
    document.querySelectorAll('.pm-faq-q').forEach(function(btn){
      btn.addEventListener('click', function(){
        var item = btn.closest('.pm-faq-item');
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.pm-faq-item.open').forEach(function(i){ i.classList.remove('open'); });
        if(!wasOpen) item.classList.add('open');
      });
    });

    // Блок «Вам також може сподобатись» — реальні фото/назви/ціни товарів каталогу
    // Найближчий колір палітри до вибраного (за RGB-відстанню)
    function recHexRgb(h){ h=(h||'').replace('#',''); if(h.length<6) return null; return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]; }
    function recLum(rgb){ return 0.299*rgb[0] + 0.587*rgb[1] + 0.114*rgb[2]; }
    function recNormName(s){ return String(s || '').trim().toLowerCase().replace(/['ʼ’`]/g, ''); }
    function recClosestColor(pal, hex, name){
      if(!pal || !pal.length) return null;
      /* Спершу шукаємо колір з ТІЄЮ САМОЮ назвою. Відтінки «білого» в різних
         кроїв різні: у футболки #eeebe4, у худі #f5f5f5, а ванільний
         #f0e7d2 за числами виявляється ближчим до теплого білого футболки,
         ніж власний білий худі. За назвою такої плутанини немає. */
      var n = recNormName(name);
      if(n){
        for(var i = 0; i < pal.length; i++){
          if(recNormName(pal[i].name) === n) return Object.assign({}, pal[i], { далеко:false });
        }
      }
      var t=recHexRgb(hex); if(!t) return null;
      var best=null, bd=Infinity;
      pal.forEach(function(c){ var r=recHexRgb(c.hex); if(!r) return;
        var rm=(r[0]+t[0])/2, dR=r[0]-t[0], dG=r[1]-t[1], dB=r[2]-t[2];
        var d=(2+rm/256)*dR*dR + 4*dG*dG + (2+(255-rm)/256)*dB*dB;
        if(d<bd){bd=d;best=c;} });
      if(best){
        // Скільки не шукай, у деяких кроїв просто немає нічого близького:
        // у худі з флісом лише рожеве, синє й шоколадне. Тоді чесніше не
        // показувати цей виріб, ніж вішати рожеве під чорну футболку.
        var bl = recLum(recHexRgb(best.hex) || [0,0,0]), tl = recLum(t);
        best = Object.assign({}, best, { далеко: Math.abs(bl - tl) > 90 });
      }
      return best;
    }
    // Рекомендувати те саме, що людина зараз і дивиться, немає сенсу: футболка
    // під футболкою — це не «також може сподобатись». Ріднею вважаємо крої
    // одного типу, а не лише той самий id.
    // Худі на застібці — окремий тип: на картці його ні з чим не сплутати,
    // і клієнти справді обирають між ним і звичайним. А «оверсайз» та
    // «оверсайз із флісом» на фото однакові, тож ідуть однією родиною.
    var REC_FAMILY = {tee:'tee', teeover:'tee',
      hoodie:'hoodie', hoodieover:'hoodie', hoodieoverfleece:'hoodie',
      hoodiezip:'hoodiezip', sweat:'sweat', cap:'cap', tote:'tote'};
    // Куди лягає лого на кожному крої: частка від самого виробу (обрізаного
    // по контуру), тому не залежить від полів фото. w — ширина лого.
    // Аксесуари: друкують строго по центру поля, а сáме поле в них зовсім
    // іншого розміру, ніж на одязі. Тому пропорція з одягу сюди не переноситься.
    var REC_ACCESSORY = { cap:1, tote:1 };
    var REC_SPOT = {
      tee:      {cx:.50, cy:.34, w:.30, heart:.36},
      teeover:  {cx:.50, cy:.34, w:.30, heart:.36},
      sweat:    {cx:.50, cy:.36, w:.30, heart:.36},
      hoodie:   {cx:.50, cy:.42, w:.28, heart:.37},
      hoodieover:{cx:.50, cy:.42, w:.28, heart:.37},
      hoodieoverfleece:{cx:.50, cy:.42, w:.28, heart:.37},
      hoodiezip:{cx:.30, cy:.34, w:.30, fixed:1},              // по центру блискавка — лише серце
      cap:      {cx:.50, cy:.46, w:.42, fixed:1},              // кепка завжди по центру
      tote:     {cx:.50, cy:.56, w:.62, fixed:1}               // шопер завжди по центру
    };
    // УСІ шари з лицьової сторони — і картинки, і написи — у частках ФОТО
    // макета (не квадратного контейнера): фото лежить у ньому по object-fit,
    // тож без цього перерахунку лого поїхало б і по місцю, і по розміру.
    function recLayers(){
      var front = (pm.logos && pm.logos.front) || [];
      var wrapW = (pmGarmentWrapEl && pmGarmentWrapEl.clientWidth) || 0;
      var natW = pmGarmentPhoto ? pmGarmentPhoto.naturalWidth : 0;
      var natH = pmGarmentPhoto ? pmGarmentPhoto.naturalHeight : 0;
      if(!wrapW || !natW || !natH) return [];
      var ar = natW / natH, rw, rh, ox, oy;
      if(ar >= 1){ rw = 1; rh = 1 / ar; ox = 0; oy = (1 - rh) / 2; }
      else       { rh = 1; rw = ar;     oy = 0; ox = (1 - rw) / 2; }
      // cx і w — у частках ШИРИНИ кадру, cy — висоти. Висоту шару не міряємо
      // в частках кадру взагалі: тримаємо співвідношення сторін, інакше на
      // фото з іншими пропорціями лого розтягувало б.
      return front.filter(function(l){ return l.url; }).map(function(l){
        var box = layerBox(l);
        return {
          url: l.url,
          rot: l.rot || 0,
          cx: ((0.5 + (l.x || 0) / wrapW) - ox) / rw,
          cy: ((0.5 + (l.y || 0) / wrapW) - oy) / rh,
          w:  (box.w / wrapW) / rw,
          ar: box.h ? (box.w / box.h) : 1
        };
      });
    }
    // Рамка виробу на макеті — те саме, але для фото, яке зараз під логотипом.
    function recSourceBox(){
      if(!pmGarmentPhoto || !pmGarmentPhoto.naturalWidth) return { x0:0, y0:0, x1:1, y1:1 };
      return recGarmentBox(pmGarmentPhoto, pmGarmentPhoto.src);
    }
    // Кепка й шопер — окрема історія: там немає ані грудей, ані «серця», тож
    // хай куди клієнт поклав лого на футболці, тут воно стає по центру.
    // Худі на застібці — навпаки: по центру там блискавка, тож завжди на серці.
    function recIsAccessory(gid){ return gid === 'cap' || gid === 'tote' || gid === 'hoodiezip'; }
    // Зона нанесення, яку менеджер намалював в адмінці, — у частках самого
    // фото. Це найчесніша основа для розміщення: саме в цих межах друк
    // фізично можливий, і саме там лого має лежати на кожному крої.
    // Виводиться з тієї ж геометрії, що й зона на макеті, тільки без
    // прив'язки до квадратного контейнера: контейнер скорочується.
    function recPrintBox(gid, colorId, natW, natH){
      var pa = (window.SITE_CONTENT && window.SITE_CONTENT.printAreas) || {};
      var area = pa[gid]; if(!area) return null;
      var side = area.front; if(!side) return null;
      var cfg = (side.colors && side.colors[colorId]) ? side.colors[colorId] : side.base;
      if(!cfg || !cfg.pts || cfg.pts.length < 3) return null;
      if(!natW || !natH) return null;
      var calT = cfg.calibTop != null ? cfg.calibTop : 0.06;
      var calB = cfg.calibBottom != null ? cfg.calibBottom : 0.96;
      var calX = cfg.calibCx != null ? cfg.calibCx : 0.5;
      var span = calB - calT, kx = span * (natH / natW);
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      paFullPoly(cfg).forEach(function(p){
        var x = calX + p[0] * kx, y = calT + p[1] * span;
        if(x < x0) x0 = x; if(x > x1) x1 = x;
        if(y < y0) y0 = y; if(y > y1) y1 = y;
      });
      if(!(x1 > x0) || !(y1 > y0)) return null;
      return { x0:x0, y0:y0, x1:x1, y1:y1 };
    }
    // Рамка виробу на фото. Кадри в різних кроїв різні: у худі капюшон з'їдає
    // верх, у шопера виріб вузький. Без цієї міри «та сама частка кадру» падала
    // на груди футболки й на живіт худі. Заливка тут не потрібна — вистачає
    // порахувати, де рядки й стовпці перестають бути кольором кута.
    var REC_BOX = {};
    function recGarmentBox(img, key){
      if(REC_BOX[key]) return REC_BOX[key];
      var box = { x0:0, y0:0, x1:1, y1:1 };
      try{
        var W0 = img.naturalWidth, H0 = img.naturalHeight;
        if(!W0 || !H0) return box;
        var k = Math.min(1, 120 / Math.max(W0, H0));
        var W = Math.max(1, Math.round(W0*k)), H = Math.max(1, Math.round(H0*k));
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d', { willReadFrequently:true });
        x.drawImage(img, 0, 0, W, H);
        var a = x.getImageData(0, 0, W, H).data;
        var br = a[0], bg = a[1], bb = a[2], TOL = 26;
        var rows = new Uint16Array(H), cols = new Uint16Array(W);
        for(var i = 0; i < W*H; i++){
          var o = i*4;
          if(Math.abs(a[o]-br) + Math.abs(a[o+1]-bg) + Math.abs(a[o+2]-bb) <= TOL) continue;
          var px = i % W; rows[(i-px)/W]++; cols[px]++;
        }
        var minR = Math.max(2, Math.round(W * 0.02)), minC = Math.max(2, Math.round(H * 0.02));
        var y0 = -1, y1 = -1, x0 = -1, x1 = -1;
        for(var r = 0; r < H; r++) if(rows[r] > minR){ if(y0 < 0) y0 = r; y1 = r; }
        for(var q = 0; q < W; q++) if(cols[q] > minC){ if(x0 < 0) x0 = q; x1 = q; }
        if(y1 > y0 && x1 > x0) box = { x0:x0/W, y0:y0/H, x1:(x1+1)/W, y1:(y1+1)/H };
      }catch(e){}   // локальний file:// «псує» полотно — лишаємо весь кадр
      REC_BOX[key] = box;
      return box;
    }
    // Фон із фото НЕ знімаємо — фото просто вписується в картку (object-fit:cover).
    // Через це видно не весь кадр, тож частки треба перерахувати під те, що
    // реально показано, інакше лого поїде тим сильніше, чим більший обріз.
    // Де саме опиниться дизайн на конкретному виробі — у частках ЙОГО фото.
    // Одна функція і для картки, і для переходу на товар: інакше картка
    // обіцяє одне, а на виробі виходить інше.
    // Знімок того, що зараз на макеті: шари плюс рамки, від яких рахуємо.
    // Потрібен, щоб перенести дизайн на інший виріб уже після того, як
    // поточний зник з екрана.
    function recSnapshot(){
      var ls = recLayers();
      if(!ls.length || !pmGarmentPhoto || !pmGarmentPhoto.naturalWidth) return null;
      var sg = recSourceBox();
      return {
        layers: ls,
        sb: recPrintBox(pm.garmentId, pm.colorId, pmGarmentPhoto.naturalWidth, pmGarmentPhoto.naturalHeight),
        sg: sg,
        raw: ((pm.logos && pm.logos.front) || []).filter(function(x){ return x.url; })
      };
    }
    /* Стартеру потрібне те саме розміщення, що й рекомендаціям, але в нього
       ще немає зібраного дизайну — лише щойно завантажений логотип. Тому
       складаємо синтетичний контекст: один шар по центру умовної зони,
       шириною 55% від неї. Далі працює та сама механіка, тож логотип на
       картці каталогу стоятиме точно там, де стане в конструкторі. */
    window.LQ_placeLogo = function(gid, img, logo){
      if(!logo || !logo.url || !img || !img.naturalWidth) return null;
      var ctx = {
        layers: [{ url: logo.url, rot: 0, ar: logo.ar || 1, cx: 0.5, cy: 0.5, w: 0.55 }],
        sb: { x0:0, y0:0, x1:1, y1:1 },
        sg: { x0:0, y0:0, x1:1, y1:1 },
        raw: []
      };
      try{ return recPlaceOn(gid, '', img, ctx); }catch(e){ return null; }
    };
    // Логотип зі стартера має потрапити в конструктор тим самим шляхом,
    // що й звичайне завантаження — інакше поведінка розійдеться.
    window.LQ_addLogoFromStart = function(logo){
      if(!logo || !logo.url) return;
      try{ addLogo(logo.raw || logo.url, logo.url); }catch(e){}
    };
    window.LQ_removeBg = function(src){
      try{ return removeBgForUpload(src); }catch(e){ return Promise.reject(e); }
    };
    function recPlaceOn(gid, colorId, img, ctx){
      ctx = ctx || recSnapshot();
      var natW = img && img.naturalWidth, natH = img && img.naturalHeight;
      if(!ctx || !ctx.layers.length || !natW || !natH) return null;
      var arFrame = natW / natH;
      var src = ctx.layers;
      // МІСЦЕ беремо із зони нанесення: тільки вона знає, де в цього крою
      // груди, а де серце. Якщо зони ще не намалювали — з рамки виробу.
      var sb = ctx.sb;
      var tb = recPrintBox(gid, colorId || '', natW, natH);
      var byZone = !!(sb && tb);
      var sg = ctx.sg;
      var tg = recGarmentBox(img, img.src);
      if(!byZone){ sb = sg; tb = tg; }
      // Худі на застібці: по центру там блискавка, друкують на серці. На фото
      // спереду серце — праворуч від центру. Якщо зону намалювали з іншого
      // боку, дзеркалимо її: виріб симетричний, друк там такий самий.
      if(gid === 'hoodiezip' && byZone){
        var mid0 = (tg.x0 + tg.x1) / 2;
        if((tb.x0 + tb.x1) / 2 < mid0) tb = { x0: 2*mid0 - tb.x1, y0: tb.y0, x1: 2*mid0 - tb.x0, y1: tb.y1 };
      }
      var sw = Math.max(1e-4, sb.x1 - sb.x0), sh = Math.max(1e-4, sb.y1 - sb.y0);
      var tw = Math.max(1e-4, tb.x1 - tb.x0), th = Math.max(1e-4, tb.y1 - tb.y0);
      /* РОЗМІР — часткою ЗОНИ нанесення. Займав чверть поля на футболці —
         займе чверть поля й на худі, і на світшоті. Саме це людина й бачить
         як «однаково»: не однакові сантиметри, а однакова частка того місця,
         куди друкують. Якщо зони ще не намалювали — запасний шлях по габариту
         виробу, як було раніше. */
      var kw = byZone
        ? Math.max(1e-4, tb.x1 - tb.x0) / Math.max(1e-4, sb.x1 - sb.x0)
        : Math.max(1e-4, tg.x1 - tg.x0) / Math.max(1e-4, sg.x1 - sg.x0);
      var ls = src.map(function(l){
        return { url:l.url, rot:l.rot, ar:l.ar,
          cx: tb.x0 + (l.cx - sb.x0) / sw * tw,
          cy: tb.y0 + (l.cy - sb.y0) / sh * th,
          w:  l.w * kw };
      });
      var gx0 = 1e9, gx1 = -1e9, gy0 = 1e9, gy1 = -1e9;
      ls.forEach(function(l){
        var hh = l.w / (l.ar || 1) * arFrame;            // висота в частках висоти кадру
        gx0 = Math.min(gx0, l.cx - l.w/2); gx1 = Math.max(gx1, l.cx + l.w/2);
        gy0 = Math.min(gy0, l.cy - hh/2);  gy1 = Math.max(gy1, l.cy + hh/2);
      });
      var mx = (gx0 + gx1) / 2, my = (gy0 + gy1) / 2;
      var gw = Math.max(1e-4, gx1 - gx0), gh = Math.max(1e-4, gy1 - gy0);
      var dx = 0, dy = 0, zoom = 1;
      if(byZone && REC_ACCESSORY[gid]){
        /* Аксесуар. Поле в кепки маленьке, у шопера велике — тягнути на них
           пропорцію з одягу немає сенсу. Тому кладемо строго в центр поля і
           підганяємо під нього, лишаючи поля з боків: так і кепка, і шопер
           виглядають однаково охайно, хоч розміри в них різні. */
        var ACC_FILL = 0.78;
        zoom = Math.min(ACC_FILL * tw / gw, ACC_FILL * th / gh);
        dx = (tb.x0 + tb.x1) / 2 - mx;
        dy = (tb.y0 + tb.y1) / 2 - my;
      } else if(byZone){
        // Худі на застібці — завжди на серці, і саме з того боку, з якого воно
        // на фото: по центру там блискавка. Дзеркалимо, якщо промахнулись.
        if(gid === 'hoodiezip') dx = (tb.x0 + tb.x1) / 2 - mx;   // центр серцевої зони
        // Не влазить у зону — зменшуємо групу цілком і підсуваємо всередину,
        // щоб клієнт не бачив першим ділом «за межами зони друку».
        zoom = Math.min(1, tw / gw, th / gh);
        var nx0 = mx + (gx0 - mx) * zoom + dx, nx1 = mx + (gx1 - mx) * zoom + dx;
        var ny0 = my + (gy0 - my) * zoom + dy, ny1 = my + (gy1 - my) * zoom + dy;
        dx += Math.min(0, tb.x1 - nx1) + Math.max(0, tb.x0 - nx0);
        dy += Math.min(0, tb.y1 - ny1) + Math.max(0, tb.y0 - ny0);
      } else {
        // Зони немає — центруємо по самому виробу, як і раніше
        if(REC_ACCESSORY[gid]) dx = (tg.x0 + tg.x1) / 2 - mx;
        if(gid === 'hoodiezip') dx = (tb.x0 + tb.x1) / 2 - mx;
      }
      return ls.map(function(l){
        return { url:l.url, rot:l.rot, ar:l.ar,
          cx: mx + (l.cx - mx) * zoom + dx,
          cy: my + (l.cy - my) * zoom + dy,
          w:  l.w * zoom };
      });
    }
    function placeRecLayers(ph){
      if(!ph) return;
      ph.querySelectorAll('.pm-rec-logo').forEach(function(n){ n.remove(); });
      var img = ph.querySelector('.pm-rec-g');
      var gid = ph.dataset.recG;
      if(!img || !img.naturalWidth) return;
      var BW = ph.clientWidth, BH = ph.clientHeight;
      if(!BW || !BH) return;
      var sc = Math.min(BW / img.naturalWidth, BH / img.naturalHeight);   // contain
      var IW = img.naturalWidth * sc, IH = img.naturalHeight * sc;
      var offX = (BW - IW) / 2, offY = (BH - IH) / 2;
      var put = recPlaceOn(gid, ph.dataset.recColor || '', img);
      if(!put || !put.length) return;
      ph.insertAdjacentHTML('beforeend', put.map(function(l){
        var wpx = l.w * IW, hpx = wpx / (l.ar || 1);
        return '<img class="pm-rec-logo" src="' + l.url + '" alt="" style="' +
          'left:' + (offX + l.cx * IW).toFixed(1) + 'px;top:' + (offY + l.cy * IH).toFixed(1) + 'px;' +
          'width:' + wpx.toFixed(1) + 'px;height:' + hpx.toFixed(1) + 'px;' +
          (l.rot ? 'transform:translate(-50%,-50%) rotate(' + l.rot + 'deg);' : '') + '">';
      }).join(''));
    }
    // Дизайн, який клієнт зібрав, перенесений у зону нанесення нового виробу.
    // Рахуємо ЗАРАЗ, поки на екрані ще старий виріб: після відкриття нової
    // картки геометрії попереднього вже не буде.
    function recCarryLayers(gid, colorId){
      var snap = recSnapshot();
      if(!snap) return null;
      return { gid:gid, colorId:colorId, ctx:snap };
    }
    // Ставимо перенесений дизайн на новий виріб, коли його фото вже виміряне.
    // Рахуємо тією самою функцією, що й картку, тож вигляд збігається точно.
    function recApplyCarry(carry){
      if(!carry || !carry.ctx) return;
      var im = pmGarmentPhoto;
      if(!im || !im.naturalWidth) return;
      var wrapW = (pmGarmentWrapEl && pmGarmentWrapEl.clientWidth) || 0;
      if(!wrapW) return;
      var put = recPlaceOn(pm.garmentId, pm.colorId, im, carry.ctx);
      if(!put || !put.length) return;
      var ar = im.naturalWidth / im.naturalHeight, rw, rh, ox, oy;
      if(ar >= 1){ rw = 1; rh = 1 / ar; ox = 0; oy = (1 - rh) / 2; }
      else       { rh = 1; rw = ar;     oy = 0; ox = (1 - rw) / 2; }
      var raw = carry.ctx.raw || [];
      pm.logos.front = put.map(function(o, i){
        var src = raw[i] || {};
        // частки фото → пікселі квадратного контейнера
        var x = ((ox + o.cx * rw) - 0.5) * wrapW;
        var y = ((oy + o.cy * rh) - 0.5) * wrapW;
        var boxW = o.w * rw * wrapW;
        var scale = Math.max(0.15, Math.min(3, (o.ar >= 1 ? boxW : boxW / o.ar) / 120));
        return {
          id: Date.now() + i,
          origUrl: src.origUrl || o.url, cleanUrl: src.cleanUrl || o.url, url: o.url,
          x: Math.round(x), y: Math.round(y), scale: scale, rot: o.rot || 0,
          removeBg: !!src.removeBg, ar: o.ar || 1,
          text: src.text ? JSON.parse(JSON.stringify(src.text)) : null
        };
      });
      pm.activeLogoId = pm.logos.front[0].id;
      pm.logos.front.forEach(function(l){
        measureLayerShape(l, l.url).then(function(){ renderLogoLayers(); updatePriceBar(); }).catch(function(){});
      });
      renderGarment(); renderTabPanel(); updatePriceBar();
      try{ renderRecommended(); }catch(e){}
    }
    function renderRecommended(){
      var track = document.getElementById('pmRecommendedScroll');
      if(!track) return;
      // Колір беремо той, що зараз на макеті, навіть якщо його не міняли:
      // людина дивиться на білу футболку — рекомендовані теж мають бути білі.
      var selC = (typeof getColor === 'function' && getColor()) || null;
      var selHex = selC ? selC.hex : null, selName = selC ? selC.name : null;
      var fam = REC_FAMILY[pm.garmentId] || pm.garmentId;
      // Чотири худі поспіль — не вибір, а повтор: «оверсайз» і «оверсайз із
      // флісом» на картці не відрізнити. Тому по одному виробу з кожного
      // типу, і починаємо з тих, що доповнюють обраний, а не дублюють його.
      var ORDER = {
        tee:      ['hoodie','sweat','hoodiezip','cap','tote'],
        hoodie:   ['sweat','tee','hoodiezip','cap','tote'],
        hoodiezip:['hoodie','sweat','tee','cap','tote'],
        sweat:    ['hoodie','tee','hoodiezip','cap','tote'],
        cap:      ['tee','hoodie','sweat','tote','hoodiezip'],
        tote:     ['tee','hoodie','cap','sweat','hoodiezip']
      };
      var want = ORDER[fam] || ['tee','hoodie','sweat','hoodiezip','cap','tote'];
      var all = (window.LQ_catalogList ? window.LQ_catalogList() : [])
        .filter(function(p){
          return p.garment && p.garment !== pm.garmentId
                 && GARMENTS.some(function(g){ return g.id === p.garment; });
        });
      var byFam = {};
      all.forEach(function(p){
        var f = REC_FAMILY[p.garment] || p.garment;
        if(!byFam[f]) byFam[f] = p;          // з родини лишаємо перший за каталогом
      });
      var list = [];
      want.forEach(function(f){ if(byFam[f]) list.push(byFam[f]); });
      // те, чого немає в переліку (власні вироби з адмінки), додаємо в кінець
      Object.keys(byFam).forEach(function(f){
        if(f !== fam && want.indexOf(f) < 0) list.push(byFam[f]);
      });
      list = list.slice(0, 6);
      // Вироби, у яких немає нічого схожого на обраний колір, прибираємо —
      // але лишаємо щонайменше три картки, щоб стрічка не спорожніла.
      var fits = list.filter(function(p){
        var pal = (GARMENT_COLORS[p.garment] || []).filter(function(c){ return garmentPhotoExists(p.garment, c.id); });
        if(!pal.length) pal = GARMENT_COLORS[p.garment];
        var m = selHex ? recClosestColor(pal, selHex, selName) : null;
        return !m || !m.далеко;
      });
      if(fits.length >= 3) list = fits;
      var html = list.map(function(p){
        var nm = window.LQ_name(p.garment, p.name);
        var cs = GARMENT_COLORS[p.garment];
        // підбираємо колір товару, найближчий до вибраного в конструкторі
        /* Шукаємо лише серед кольорів, для яких є фото. Інакше збіг за
           назвою знаходив «Білий», фото не було, і замість нього ставав
           колір-візитівка виробу — під білою футболкою могло вийти чорне
           худі. Тепер береться найближчий із наявних: у худі на застібці
           білого фото немає, і чесно показується сіре. */
        var csHave = (cs || []).filter(function(c){ return garmentPhotoExists(p.garment, c.id); });
        if(!csHave.length) csHave = cs;
        var match = selHex ? recClosestColor(csHave, selHex, selName) : displayColorFor(p.garment);
        if(match && !garmentPhotoExists(p.garment, match.id)) match = garmentThumbColor(p.garment);
        var src = match ? window.LQ_img('/images/'+p.garment+'-'+match.id+'-front.webp')
                        : (p.img ? window.LQ_img(p.img) : null);
        var imgHtml = src
          ? '<div class="pm-rec-img"><span class="pm-rec-ph" data-rec-g="' + p.garment + '" ' +
                'data-rec-color="' + escAttr((match && match.id) || '') + '">' +
              '<img class="pm-rec-g" src="' + escAttr(src) + '" alt="' + nm + '" ' +
                'decoding="async" onerror="this.style.display=\'none\'">' +
            '</span></div>'
          : '<div class="pm-rec-img"></div>';
        // ціну беремо тією ж функцією, що й картки каталогу, — щоб числа не розходились
        var priceLabel = p.price;
        if(window.__catalogPrice){
          var auto = window.__catalogPrice(p.garment);
          if(auto && auto > 0) priceLabel = 'від ' + auto + ' грн';
        }
        return '<div class="pm-rec-card" data-rec-garment="'+p.garment+'" ' +
          'data-rec-color="'+escAttr((match && match.id) || '')+'">'+imgHtml+
          '<div class="pm-rec-info"><div class="pm-rec-name">'+nm+'</div>'+
          (priceLabel ? '<div class="pm-rec-price">'+priceLabel+'</div>' : '')+'</div></div>';
      }).join('');
      html += '<button class="pm-rec-card pm-rec-cta-card" id="pmRecCatalogCta"><span>Перейти в каталог</span></button>';
      track.innerHTML = html;
      track.querySelectorAll('.pm-rec-card[data-rec-garment]').forEach(function(card){
        card.addEventListener('click', function(){
          // Картка обіцяє готовий вигляд — значить, після переходу він має
          // лишитись. Інакше людина бачить кепку з лого, тапає, і потрапляє
          // на порожню кепку: обіцянка не виконана.
          var keep = recCarryLayers(card.dataset.recGarment, card.dataset.recColor || '');
          if(window.lqAn) window.lqAn.track('rec_click', { from: pm.garmentId, to: card.dataset.recGarment });
          openProductModal(card.dataset.recGarment, keep);
        });
      });
      var cta = document.getElementById('pmRecCatalogCta');
      if(cta) cta.addEventListener('click', function(){ catalogModalCtrl.open(); });
      // Лого лягає лише коли фото справді виміряне: без naturalWidth
      // перерахувати обріз неможливо.
      track.querySelectorAll('.pm-rec-ph').forEach(function(ph){
        var img = ph.querySelector('.pm-rec-g');
        if(!img) return;
        if(img.complete && img.naturalWidth) placeRecLayers(ph);
        else img.addEventListener('load', function(){ placeRecLayers(ph); }, {once:true});
      });
      initRecCarousel();
    }

    window.__renderRecommended = renderRecommended;
    document.addEventListener('lq-photos', function(){ try{ renderRecommended(); }catch(e){} });
    document.addEventListener('lq-content', function(){ try{ renderRecommended(); }catch(e){} });

    // iOS: скріншот/поява URL-бару фаєрить resize і збиває скрол модалки — відновлюємо його.
    // Але НЕ втручаємось, поки користувач реально скролить (тумблер тулбара Safari теж фаєрить
    // resize — раніше це "заморожувало" скрол внизу модалки).
    (function(){
      var modalIds = ['productModal','catalogModal','reviewsModal','cartModal','contactModal'];
      var saved = {};
      var touching = false;
      var lastScrollAt = 0;
      window.addEventListener('touchstart', function(){ touching = true; }, {passive:true});
      window.addEventListener('touchend', function(){ touching = false; }, {passive:true});
      window.addEventListener('touchcancel', function(){ touching = false; }, {passive:true});
      modalIds.forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('scroll', function(){ saved[id] = el.scrollTop; lastScrollAt = Date.now(); }, {passive:true});
      });
      var lastW = window.innerWidth;
      window.addEventListener('resize', function(){
        var widthChanged = window.innerWidth !== lastW;
        lastW = window.innerWidth;
        if(widthChanged) return;   // справжня зміна ширини/орієнтації — не заважаємо
        if(touching || Date.now() - lastScrollAt < 500) return;   // активний скрол/палець на екрані
        modalIds.forEach(function(id){
          var el = document.getElementById(id);
          if(el && el.classList.contains('open') && saved[id] != null){
            var y = saved[id];
            requestAnimationFrame(function(){
              // відновлюємо лише якщо позиція реально зіскочила (скріншот), а не на пару px
              if(Math.abs(el.scrollTop - y) > 120) el.scrollTop = y;
            });
          }
        });
      });
    })();

    document.getElementById('pmHelpConsultBtn').addEventListener('click', function(){
      document.getElementById('pmConsultModal').classList.add('open');
    });
    document.getElementById('pmCtaScrollTop').addEventListener('click', function(){
      productModal.scrollTop = 0;
    });

    window.__openProductModal = openProductModal;
    // Відновлення товару з кошика для редагування (доступ до pm/openProductModal лише тут, усередині IIFE)
    /* Позиції, збережені до переходу на частки, знають свій розмір лише в
       пікселях того екрана, де їх складали, — а на іншому це вже інший друк.
       Але поруч із ними лежать МІЛІМЕТРИ, записані в момент збереження:
       саме вони пішли в замовлення й у ціну. З них і відновлюємо частку —
       тоді стара картка відкривається рівно такою, якою її здали.
       Заодно повертаємо позицію: знаючи частку й піксельний scale, можна
       відновити ширину того давнього екрана, а з неї — де саме стояло лого. */
    function fracFromLegacyPrints(prints){
      if(!prints || !prints.length) return;
      var mmPerFrac = zoneScaleMmPerFrac();
      if(mmPerFrac == null) mmPerFrac = garmentHeightMm();
      if(!(mmPerFrac > 0)) return;
      var b = wrapBox(), k = 0;
      getViews().forEach(function(side){
        (pm.logos[side] || []).forEach(function(l){
          var p = prints[k++];
          if(!l || +l.frac > 0 || !p) return;
          var ar = (l.ar || 1) || 1;
          var wMm = +p.widthMm || 0;
          if(!(wMm > 0)) return;
          var szMm = (ar >= 1) ? wMm : (wMm / ar);
          var frac = szMm / mmPerFrac;
          if(!(frac > 0)) return;
          l.frac = frac;
          // Ширина екрана, на якому це складали
          var oldW = (120 * (l.scale || 1)) / frac;
          if(oldW > 0 && b.w > 0){
            var oldH = oldW * (b.h / b.w);
            l.fx = (l.x || 0) / oldW;
            l.fy = oldH ? (l.y || 0) / oldH : 0;
          }
          l.pxAt = null;          // хай renderLogoLayers перерахує під цей екран
        });
      });
    }
    window.__editProduct = function(cfg, editIdx, prints){
      pm.colorId = cfg.colorId;
      pm.printId = cfg.printId;
      pm.qty = Object.assign({}, cfg.qty);
      pm.logos = JSON.parse(JSON.stringify(cfg.logos));
      openProductModal(cfg.garmentId);
      // Відкриття картки скидає тираж (новий виріб рахує менеджер сам) —
      // але позицію ми не відкриваємо, а повертаємо, і її тираж уже відомий
      pm.qty = Object.assign({}, cfg.qty);
      try{ fracFromLegacyPrints(prints); }catch(e){ console.warn('legacy frac', e); }
      pm.colorId = cfg.colorId;
      pm.colorPicked = true;   // з кошика — колір уже обраний
      pm.editing = true;       // позицію повернули з кошика: кнопка каже «Оновити»
      // Індекс ставимо ДО перерахунку: інакше та сама позиція порахується двічі —
      // і як чернетка, і як те, що лежить у кошику, — і ціна вийде завищена.
      window.__pmEditIndex = (editIdx == null) ? null : editIdx;
      try{ syncAddLabels(); }catch(e){}
      try{ renderTabPanel(); renderRecommended(); updatePriceBar(); }catch(e){}
    };
    /* Проставити тираж ззовні. Потрібно рекомендованим: їхня кількість іде за
       найбільшою основною позицією, її вже порахувала адмінка, і питати її в
       менеджера вдруге немає за чим. Базових товарів це не стосується — там
       кількість вносить людина. */
    window.__lqSetQty = function(map){
      pm.qty = Object.assign({}, map || {});
      try{ renderTabPanel(); updatePriceBar(); syncAddLabels(); }catch(e){}
    };
    // Скільки шарів зараз на виробі — робоче місце чекає, поки лягне логотип
    window.__lqLayerCount = function(){ try{ return logoCount(); }catch(e){ return 0; } };
    /* Що саме бачить рушій у цій позиції: скільки дизайнів, які в них
       відбитки й скільки за них береться ескізів. Найчастіше питання
       підтримки — «чому за другий логотип не взяло підготовку макета», і
       відповідь на нього видно тільки тут: у самому конструкторі, до
       збереження. */
    window.__lqDraftDesc = function(){
      try{
        var d = draftDescriptor();
        var r = (window.LQ && window.LQ.priceOrder) ? window.LQ.priceOrder([d])[0] : null;
        return { designs: (d.designs || []).map(function(f){ return String(f || '').slice(0, 14); }),
                 kinds: d.designKinds || [], coefPart: d.coefPart, units: d.units,
                 sketches: (r && r.parts) ? (r.parts.sketches || []).length : -1,
                 designNos: (r && r.parts)
                   ? (r.parts.designNos || []).map(function(x){ return x.kind + '№' + x.no; }) : [],
                 unit: r ? r.unit : -1 };
      }catch(e){ return { err: String(e && e.message || e) }; }
    };
    renderGarment();
    updatePriceBar();

    // Generic scroll-hint arrows for any horizontal carousel — wraps the element,
    // adds fade+chevron buttons on whichever side still has content to scroll to.
    function initScrollHint(el){
      if(!el || el.dataset.scrollHintInit) return;
      el.dataset.scrollHintInit = '1';
      var wrap = document.createElement('div');
      wrap.className = 'pm-scroll-wrap';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      var leftBtn = document.createElement('button');
      leftBtn.className = 'pm-scroll-arrow pm-scroll-arrow--left';
      leftBtn.setAttribute('aria-label','Назад');
      leftBtn.innerHTML = SCROLL_L;
      var rightBtn = document.createElement('button');
      rightBtn.className = 'pm-scroll-arrow pm-scroll-arrow--right';
      rightBtn.setAttribute('aria-label','Далі');
      rightBtn.innerHTML = SCROLL_R;
      wrap.appendChild(leftBtn);
      wrap.appendChild(rightBtn);
      function update(){
        var max = el.scrollWidth - el.clientWidth;
        leftBtn.classList.toggle('show', el.scrollLeft > 4);
        rightBtn.classList.toggle('show', max > 4 && el.scrollLeft < max - 60);
      }
      el.addEventListener('scroll', update);
      leftBtn.addEventListener('click', function(){ el.scrollBy({left:-200, behavior:'smooth'}); });
      rightBtn.addEventListener('click', function(){ el.scrollBy({left:200, behavior:'smooth'}); });
      window.addEventListener('resize', update);
      update();
      requestAnimationFrame(update);
      return update;
    }
    var pmModelTrack = document.getElementById('pmModelPhotos');
    var pmModelDotsEl = document.getElementById('pmModelDots');
    var pmModelNextBtn = document.getElementById('pmModelNext');
    var pmModelSectionEl = document.getElementById('pmModelSection');
    var modelPhotos = [], modelDots = [];
    function modelSetActive(i){ modelDots.forEach(function(d,idx){ d.classList.toggle('active', idx===i); }); }
    function modelClosestIndex(){
      var center = pmModelTrack.scrollLeft + pmModelTrack.clientWidth/2;
      var best=0, bestDist=Infinity;
      modelPhotos.forEach(function(c,idx){
        var dist = Math.abs((c.offsetLeft + c.offsetWidth/2) - center);
        if(dist<bestDist){bestDist=dist;best=idx;}
      });
      return best;
    }
    function renderModelPhotos(){
      if(!pmModelTrack) return;   // карусельний блок ще не ініціалізований (init-виклик renderGarment)
      var custom = window.SITE_CONTENT.models[pm.garmentId];  // фото моделей, додані з адмінки
      var set = MODEL_PHOTOS[pm.garmentId];
      if((!custom || !custom.length) && !set){ if(pmModelSectionEl) pmModelSectionEl.style.display='none'; return; }
      if(pmModelSectionEl) pmModelSectionEl.style.display='';
      if(custom && custom.length){
        // Кастомні фото показуємо як є (без проєкції лого — позиція грудей невідома)
        pmModelTrack.innerHTML = custom.map(function(url){
          return '<div class="pm-model-photo"><img class="pm-model-img" src="'+url+'" alt="" loading="eager" decoding="async"></div>';
        }).join('');
      } else {
      // Лого НЕ проєктуємо на фото моделей (за проханням) — показуємо фото як є
      pmModelTrack.innerHTML = set.map(function(slide){
        return '<div class="pm-model-photo"><img class="pm-model-img" src="/images/'+slide.src+'.webp" alt="" loading="eager" decoding="async" fetchpriority="high"></div>';
      }).join('');
      }
      modelPhotos = Array.prototype.slice.call(pmModelTrack.children);
      pmModelTrack.querySelectorAll('.pm-model-logo').forEach(function(el){
        el.addEventListener('mousedown', function(e){ startModelDrag(e, el); });
        el.addEventListener('touchstart', function(e){ startModelDrag(e, el); }, {passive:false});
      });
      pmModelDotsEl.innerHTML = modelPhotos.map(function(_,i){ return '<span class="dot'+(i===0?' active':'')+'" data-index="'+i+'"></span>'; }).join('');
      modelDots = Array.prototype.slice.call(pmModelDotsEl.children);
      modelDots.forEach(function(d,idx){ d.addEventListener('click', function(){ modelPhotos[idx].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); }); });
      pmModelTrack.scrollLeft = 0;
      updateModelLogos();
    }
    if(pmModelTrack){
      pmModelTrack.addEventListener('scroll', function(){ if(modelPhotos.length) modelSetActive(modelClosestIndex()); }, {passive:true});
      if(pmModelNextBtn){
        pmModelNextBtn.addEventListener('click', function(){
          if(!modelPhotos.length) return;
          var maxScroll = pmModelTrack.scrollWidth - pmModelTrack.clientWidth;
          if(pmModelTrack.scrollLeft >= maxScroll - 4){ pmModelTrack.scrollTo({left:0, behavior:'smooth'}); }
          else { var next = (modelClosestIndex()+1) % modelPhotos.length; modelPhotos[next].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); }
        });
      }
    }
    renderModelPhotos();   // початковий рендер фото моделей (блок уже готовий)
    var pmRecTrack = document.getElementById('pmRecommendedScroll');
    var pmRecDotsEl = document.getElementById('pmRecDots');
    var pmRecNextBtn = document.getElementById('pmRecNext');
    var recDots = [], recCards = [];
    function recClosestIndex(){
      var center = pmRecTrack.scrollLeft + pmRecTrack.clientWidth/2;
      var best=0, bestDist=Infinity;
      recCards.forEach(function(c,idx){
        var dist = Math.abs((c.offsetLeft + c.offsetWidth/2) - center);
        if(dist<bestDist){bestDist=dist;best=idx;}
      });
      return best;
    }
    function recSetActive(i){ recDots.forEach(function(d,idx){ d.classList.toggle('active', idx===i); }); }
    function initRecCarousel(){
      if(!pmRecTrack || !pmRecDotsEl) return;
      recCards = Array.prototype.slice.call(pmRecTrack.children);
      pmRecDotsEl.innerHTML = recCards.map(function(_,i){ return '<span class="dot'+(i===0?' active':'')+'" data-index="'+i+'"></span>'; }).join('');
      recDots = Array.prototype.slice.call(pmRecDotsEl.children);
      recDots.forEach(function(d,idx){
        d.addEventListener('click', function(){ recCards[idx].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'}); });
      });
      pmRecTrack.scrollLeft = 0;
    }
    if(pmRecTrack && pmRecDotsEl){
      pmRecTrack.addEventListener('scroll', function(){ recSetActive(recClosestIndex()); }, {passive:true});
      if(pmRecNextBtn){
        pmRecNextBtn.addEventListener('click', function(){
          var maxScroll = pmRecTrack.scrollWidth - pmRecTrack.clientWidth;
          if(pmRecTrack.scrollLeft >= maxScroll - 4){
            pmRecTrack.scrollTo({left:0, behavior:'smooth'});
          } else {
            var next = (recClosestIndex()+1) % recCards.length;
            recCards[next].scrollIntoView({behavior:'smooth', inline:'center', block:'nearest'});
          }
        });
      }
    }
    renderRecommended();   // початковий рендер із реальними фото
  })();
