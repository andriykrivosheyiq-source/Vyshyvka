/* ══════════════════════════════════════════════════════════════════════
   ВИПАДАЮЧІ СПИСКИ — один вигляд на весь Loomiq

   НАВІЩО. Звичайний <select> малює операційна система, і ми на це не
   впливаємо: у Windows це сірий список 1995 року з квадратними кутами, у
   Chrome на Android — шторка на пів екрана. Поруч із рештою інтерфейсу —
   заокругленою, світлою, з повітрям — він виглядає як шматок чужої
   програми. А списків у роботі менеджера десятки: дошка, фільтр, статус,
   роль, спосіб нанесення, товар.

   ЩО РОБИТЬ ЦЕЙ ФАЙЛ. Лишає нативний <select> на місці — з ним і далі
   працює весь код сторінки: value, change, disabled, форми. Поверх нього
   малює свою кнопку й список. Тобто це не заміна елемента, а його одяг:
   якщо файл не завантажиться, усе працюватиме як раніше, просто виглядатиме
   по-старому.

   ЧОМУ САМЕ ТАК. Переписати всі select на власні компоненти означало б
   переписати й кожне місце, яке читає їхнє значення, — а таких місць у
   адмінці сотні. Одяг зверху не чіпає жодного з них.

   ЩО ВМІЄ:
     — клавіатура: Enter/Пробіл відкриває, стрілки ведуть, Esc закриває,
       літери шукають;
     — пошук у списках, довших за десяток пунктів;
     — групи <optgroup> лишаються групами;
     — меню відкривається вгору, коли внизу немає місця;
     — опції можуть мінятись коли завгодно: список збирається в мить
       відкриття, а не запамʼятовується наперед.

   ЯК ВИМКНУТИ для конкретного поля: <select data-native>.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(window.__lqSelectOn) return;
  window.__lqSelectOn = true;

  var CSS = [
    '.lq-sel{position:relative;display:inline-flex;align-items:center;gap:10px;',
      'font:inherit;font-size:14px;font-weight:500;color:#1B1F28;background:#fff;',
      'border:1px solid #E5E8EF;border-radius:13px;padding:0 14px;height:44px;',
      'cursor:pointer;user-select:none;max-width:100%;box-sizing:border-box;',
      'transition:border-color .14s,box-shadow .14s;}',
    '.lq-sel-v{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.lq-sel-c{flex:none;width:16px;height:16px;opacity:.5;transition:transform .16s;}',
    '.lq-sel.is-open .lq-sel-c{transform:rotate(180deg);}',
    '.lq-sel.is-open{border-color:#3B6FD4;box-shadow:0 0 0 3px rgba(59,111,212,.14);}',
    '.lq-sel.is-off{opacity:.55;cursor:not-allowed;}',
    '.lq-sel:focus-visible{outline:2px solid #3B6FD4;outline-offset:2px;}',
    '@media (hover:hover){ .lq-sel:not(.is-off):hover{border-color:#C9D0DC;} }',
    /* Меню живе в body: усередині картки з overflow воно різалось би краєм. */
    '.lq-menu{position:fixed;z-index:12000;background:#fff;border:1px solid #E5E8EF;',
      'border-radius:16px;box-shadow:0 18px 44px rgba(16,24,40,.16);padding:6px;',
      'max-height:min(60vh,420px);overflow:auto;font:inherit;font-size:14px;',
      'animation:lqMenuIn .12s ease-out;}',
    '@keyframes lqMenuIn{from{opacity:0;transform:translateY(-4px);}to{opacity:1;transform:none;}}',
    '@media (prefers-reduced-motion:reduce){ .lq-menu{animation:none;} }',
    '.lq-menu-s{position:sticky;top:-6px;background:#fff;padding:4px 4px 8px;margin:-6px -6px 4px;',
      'border-bottom:1px solid #F1F3F7;}',
    '.lq-menu-s input{width:100%;font:inherit;font-size:14px;color:#1B1F28;background:#F7F8FA;',
      'border:1px solid transparent;border-radius:11px;padding:10px 12px;outline:none;box-sizing:border-box;}',
    '.lq-menu-s input:focus{border-color:#3B6FD4;background:#fff;}',
    '.lq-o{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;',
      'color:#1B1F28;cursor:pointer;white-space:normal;line-height:1.35;}',
    '.lq-o[aria-selected="true"]{background:#EFF4FF;color:#2B5CB8;font-weight:600;}',
    '.lq-o.is-cur{background:#F2F4F8;}',
    '.lq-o[aria-selected="true"].is-cur{background:#E4EDFD;}',
    '.lq-o.is-off{opacity:.45;cursor:not-allowed;}',
    '.lq-o-t{flex:1;min-width:0;}',
    '.lq-o-i{flex:none;width:16px;height:16px;opacity:0;}',
    '.lq-o[aria-selected="true"] .lq-o-i{opacity:1;}',
    '.lq-g{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;',
      'color:#98A2B3;padding:10px 12px 4px;}',
    '.lq-none{padding:14px 12px;color:#98A2B3;}',
    /* Нативний список лишається в розмітці — просто його не видно. Саме
       лишається, а не display:none: прихований так елемент зникає і для
       програм читання з екрана, і для автозаповнення, і для будь-якої
       перевірки, яка вибирає значення програмно. Тут він живий, лише
       винесений за край екрана. */
    '.lq-native{position:absolute!important;left:-9999px!important;top:0!important;',
      'width:1px!important;height:1px!important;opacity:0!important;',
      'margin:0!important;padding:0!important;border:0!important;pointer-events:none!important;}'
  ].join('');

  var CHEV = '<svg class="lq-sel-c" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  var TICK = '<svg class="lq-o-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';

  function css(){
    if(document.getElementById('lq-sel-css')) return;
    var st = document.createElement('style');
    st.id = 'lq-sel-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  /* Підпис кнопки — те саме, що показував би нативний список. Порожній
     вибір лишає placeholder, якщо він заданий: «— оберіть —» краще за
     порожню кнопку, у якої не видно навіть висоти тексту. */
  function label(sel){
    var o = sel.options[sel.selectedIndex];
    var t = o ? String(o.textContent || '').trim() : '';
    return t || sel.getAttribute('data-placeholder') || '';
  }

  var openOne = null;   // { sel, box, menu } — відкритий може бути лише один

  function close(){
    if(!openOne) return;
    var o = openOne;
    openOne = null;
    if(o.menu && o.menu.parentNode) o.menu.parentNode.removeChild(o.menu);
    o.box.classList.remove('is-open');
    o.box.setAttribute('aria-expanded', 'false');
  }

  /* Список збирається в мить відкриття — саме тому він завжди свіжий.
     Адмінка перемальовує опції десятками способів (додали товар, змінили
     дошку, приїхали дані з бази), і запамʼятований наперед список показував
     би позавчорашнє. */
  function build(sel){
    var out = [], i, o;
    for(i = 0; i < sel.options.length; i++){
      o = sel.options[i];
      var g = o.parentNode && o.parentNode.tagName === 'OPTGROUP'
        ? String(o.parentNode.label || '') : '';
      out.push({ i:i, t:String(o.textContent || '').trim(), g:g, off:o.disabled });
    }
    return out;
  }

  function open(sel, box){
    if(openOne && openOne.sel === sel){ close(); return; }
    close();
    var list = build(sel);
    var menu = document.createElement('div');
    menu.className = 'lq-menu';
    menu.setAttribute('role', 'listbox');
    var withSearch = list.length > 9;

    function paint(q){
      var qq = String(q || '').trim().toLowerCase();
      var seen = '', html = '';
      list.forEach(function(x){
        if(qq && x.t.toLowerCase().indexOf(qq) < 0) return;
        if(x.g && x.g !== seen){ html += '<div class="lq-g">' + esc(x.g) + '</div>'; seen = x.g; }
        if(!x.g) seen = '';
        html += '<div class="lq-o' + (x.off ? ' is-off' : '') + '" role="option" data-i="' + x.i +
          '" aria-selected="' + (x.i === sel.selectedIndex ? 'true' : 'false') + '">' +
          '<span class="lq-o-t">' + esc(x.t) + '</span>' + TICK + '</div>';
      });
      if(!html) html = '<div class="lq-none">Нічого не знайшлось</div>';
      var body = menu.querySelector('.lq-menu-b');
      if(body) body.innerHTML = html;
    }

    menu.innerHTML = (withSearch
      ? '<div class="lq-menu-s"><input type="text" placeholder="Пошук" ' +
        'autocomplete="off" spellcheck="false"></div>' : '') +
      '<div class="lq-menu-b"></div>';
    document.body.appendChild(menu);
    paint('');

    /* Місце під меню: під кнопкою, а якщо там не влазить — над нею. Ширину
       беремо не меншу за саму кнопку, щоб підпис не переносився інакше, ніж
       у закритому стані. */
    function place(){
      var r = box.getBoundingClientRect();
      var w = Math.max(r.width, 200);
      menu.style.width = Math.min(w, window.innerWidth - 16) + 'px';
      menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
      var h = menu.offsetHeight;
      var below = window.innerHeight - r.bottom - 10;
      menu.style.top = (below >= h || below >= r.top - 10 ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
    }
    place();

    box.classList.add('is-open');
    box.setAttribute('aria-expanded', 'true');
    openOne = { sel:sel, box:box, menu:menu };

    var cur = sel.selectedIndex;
    function mark(i){
      cur = i;
      var all = menu.querySelectorAll('.lq-o');
      for(var k = 0; k < all.length; k++)
        all[k].classList.toggle('is-cur', +all[k].dataset.i === i);
      var el = menu.querySelector('.lq-o.is-cur');
      if(el && el.scrollIntoView) el.scrollIntoView({ block:'nearest' });
    }
    mark(cur);

    function pick(i){
      if(i == null || !sel.options[i] || sel.options[i].disabled) return;
      if(sel.selectedIndex !== i){
        sel.selectedIndex = i;
        /* Подія — така сама, як від нативного вибору: усі наявні обробники
           change спрацьовують і не помічають різниці. */
        sel.dispatchEvent(new Event('input', { bubbles:true }));
        sel.dispatchEvent(new Event('change', { bubbles:true }));
      }
      close();
      dress(sel);
      box.focus();
    }

    menu.addEventListener('mousedown', function(e){ e.preventDefault(); });
    menu.addEventListener('click', function(e){
      var o = e.target.closest ? e.target.closest('.lq-o') : null;
      if(o && !o.classList.contains('is-off')) pick(+o.dataset.i);
    });
    var inp = menu.querySelector('input');
    if(inp){
      inp.addEventListener('input', function(){ paint(inp.value); mark(cur); });
      inp.addEventListener('keydown', keys);
      setTimeout(function(){ inp.focus(); }, 10);
    }

    function step(d){
      var vis = [].map.call(menu.querySelectorAll('.lq-o:not(.is-off)'), function(x){ return +x.dataset.i; });
      if(!vis.length) return;
      var at = vis.indexOf(cur);
      mark(vis[Math.max(0, Math.min(vis.length - 1, (at < 0 ? 0 : at + d)))]);
    }
    function keys(e){
      if(e.key === 'Escape'){ e.preventDefault(); close(); box.focus(); return; }
      if(e.key === 'ArrowDown'){ e.preventDefault(); step(1); return; }
      if(e.key === 'ArrowUp'){ e.preventDefault(); step(-1); return; }
      if(e.key === 'Enter'){ e.preventDefault(); pick(cur); return; }
      if(e.key === 'Tab'){ close(); }
    }
    menu.addEventListener('keydown', keys);
    box.addEventListener('keydown', keys);
    /* Прокрутили сторінку чи змінили розмір вікна — меню має лишитись під
       своєю кнопкою, а не висіти посеред екрана. */
    var track = function(){ if(openOne && openOne.sel === sel) place(); else off(); };
    var off = function(){
      window.removeEventListener('scroll', track, true);
      window.removeEventListener('resize', track);
    };
    window.addEventListener('scroll', track, true);
    window.addEventListener('resize', track);
  }

  /* Одягаємо один список. Нативний лишається в DOM — просто його не видно:
     значення, форма й усі обробники живуть далі на ньому. */
  function dress(sel){
    if(!sel || sel.multiple || sel.size > 1) return;
    if(sel.hasAttribute('data-native')) return;
    var box = sel.__lqBox;
    if(!box){
      box = document.createElement('div');
      box.className = 'lq-sel';
      box.tabIndex = 0;
      box.setAttribute('role', 'combobox');
      box.setAttribute('aria-haspopup', 'listbox');
      box.setAttribute('aria-expanded', 'false');
      box.innerHTML = '<span class="lq-sel-v"></span>' + CHEV;
      /* Ширину, поля й вирівнювання нерідко задають самому select — inline
         або класом. Переносимо їх на кнопку, інакше поле, розтягнуте на всю
         ширину картки, після одягання стало б вузьким. */
      var cs = window.getComputedStyle(sel);
      if(sel.style.width) box.style.width = sel.style.width;
      else if(cs.width && cs.display !== 'none') box.style.width = cs.width;
      if(sel.style.flex) box.style.flex = sel.style.flex;
      if(sel.style.minWidth) box.style.minWidth = sel.style.minWidth;
      if(sel.style.maxWidth) box.style.maxWidth = sel.style.maxWidth;
      if(sel.style.margin) box.style.margin = sel.style.margin;
      if(cs.height && parseFloat(cs.height) > 20) box.style.height = cs.height;
      sel.parentNode.insertBefore(box, sel);
      sel.classList.add('lq-native');
      sel.setAttribute('tabindex', '-1');
      sel.__lqBox = box;
      box.__lqSel = sel;
      box.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        if(sel.disabled) return;
        open(sel, box);
      });
      box.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown'){
          e.preventDefault();
          if(!sel.disabled) open(sel, box);
        }
      });
      /* Значення міняють і програмно — тоді підпис має оновитись сам. */
      sel.addEventListener('change', function(){ dress(sel); });
    }
    box.querySelector('.lq-sel-v').textContent = label(sel);
    box.classList.toggle('is-off', !!sel.disabled);
    box.hidden = !!sel.hidden;
    return box;
  }

  function scan(root){
    css();
    var list = (root || document).querySelectorAll('select');
    for(var i = 0; i < list.length; i++){
      try{ dress(list[i]); }catch(e){ console.warn('select не одягнувся', e); }
    }
  }

  /* Сторінки перемальовують шматки розмітки постійно — новий список має
     одягнутись сам, без жодного виклику з боку сторінки. */
  var tid = null;
  function later(){
    if(tid) return;
    tid = setTimeout(function(){ tid = null; scan(document); }, 60);
  }

  function start(){
    scan(document);
    try{
      new MutationObserver(function(){ later(); })
        .observe(document.body, { childList:true, subtree:true });
    }catch(e){}
    document.addEventListener('click', function(e){
      if(!openOne) return;
      if(openOne.menu.contains(e.target) || openOne.box.contains(e.target)) return;
      close();
    }, true);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') close();
    });
  }

  if(document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start);
  else start();

  window.LQSelect = { scan: scan, close: close };
})();
