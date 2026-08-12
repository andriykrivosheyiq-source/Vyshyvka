/* Спільна логіка сайту-запрошення.
   Дані про побачення їдуть у query-рядку внутрішніх посилань (what.html?d=...&t=...),
   а sessionStorage — лише запасний варіант, щоб сторінка пережила перезавантаження. */

(function (global) {
  'use strict';

  var KEY = 'date-invite';

  /* Тексти на сторінках — російською, як просив замовник. */
  var MONTHS = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  var PLANS = {
    pizza:  { emoji: '🍕', name: 'Пицца' },
    sushi:  { emoji: '🍣', name: 'Суши' },
    burger: { emoji: '🍔', name: 'Бургеры' },
    hookah: { emoji: '💨', name: 'Кальян' },
    cinema: { emoji: '🎬', name: 'Кино' },
    wine:   { emoji: '🍷', name: 'Вино' }
  };

  function stored() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function remember(data) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* приватний режим — просто працюємо без пам'яті */ }
  }

  function forget() {
    try {
      sessionStorage.removeItem(KEY);
    } catch (e) { /* нічого страшного */ }
  }

  /* Читає стан: спершу з посилання, потім із пам'яті вкладки. */
  function read() {
    var query = new URLSearchParams(global.location.search);
    var saved = stored();
    var data = {
      date: query.get('d') || saved.date || '',
      time: query.get('t') || saved.time || '',
      plan: query.get('p') || saved.plan || ''
    };
    if (data.date || data.time || data.plan) remember(data);
    return data;
  }

  /* Додає наявні дані до внутрішнього посилання: 'done.html' -> 'done.html?d=…&t=…' */
  function link(page, extra) {
    var data = read();
    var query = new URLSearchParams();
    if (data.date) query.set('d', data.date);
    if (data.time) query.set('t', data.time);
    if (extra) {
      Object.keys(extra).forEach(function (name) {
        if (extra[name]) query.set(name, extra[name]);
      });
    }
    var tail = query.toString();
    return tail ? page + '?' + tail : page;
  }

  /* '2026-07-29' -> '29 липня' */
  function humanDate(iso) {
    var parts = String(iso).split('-');
    if (parts.length !== 3) return '';
    var day = parseInt(parts[2], 10);
    var month = parseInt(parts[1], 10) - 1;
    if (isNaN(day) || !MONTHS[month]) return '';
    return day + ' ' + MONTHS[month];
  }

  function plan(code) {
    return PLANS[code] || null;
  }

  /* 'sushi,wine' -> [{emoji,name}, {emoji,name}] */
  function chosen(codes) {
    return String(codes || '').split(',').map(function (code) {
      return PLANS[code];
    }).filter(Boolean);
  }

  /* [Пицца, Суши, Вино] -> 'Пицца, суши и вино' */
  function listNames(items) {
    var names = items.map(function (item, index) {
      return index === 0 ? item.name : item.name.toLowerCase();
    });
    if (names.length < 2) return names.join('');
    return names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1];
  }

  /* Сьогоднішня дата у форматі '2026-08-12' */
  function today() {
    var now = new Date();
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  global.DateInvite = {
    read: read,
    link: link,
    forget: forget,
    plan: plan,
    plans: PLANS,
    chosen: chosen,
    listNames: listNames,
    today: today,
    humanDate: humanDate
  };
})(window);
