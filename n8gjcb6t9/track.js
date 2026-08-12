/* Куди йдуть відповіді гості.
   ----------------------------------------------------------------------
   Без Firebase і взагалі без акаунтів: пишемо в ntfy.sh — безкоштовний
   сервіс сповіщень, де «тема» створюється сама з першого повідомлення.
   Тема має випадкову назву, тож сторонній її не вгадає.

   Читати можна двома способами:
     • застосунок ntfy на телефоні → підписка на тему → миттєвий пуш;
     • сторінка-адмінка, яка тягне ті самі повідомлення й малює стрічку.

   Публікуємо через POST на адресу теми з тілом text/plain — це «простий»
   запит у розумінні CORS, тож браузер не робить зайвого preflight і
   нічого не блокує. Заголовок і мітку передаємо параметрами адреси.

   Якщо мережа не пустила — сторінка мовчки працює далі: для гості нічого
   не змінюється. Виняток — фото, там результат їй показуємо. */

(function (global) {
  'use strict';

  var HOST = 'https://ntfy.sh';
  var TOPIC = 'lera-75m2bg';

  // Мітки ntfy — це emoji-shortcodes: у пуші на телефоні видно саме емодзі.
  var TAGS = {
    open: 'eyes',
    no: 'no_entry',
    yes: 'green_heart',
    time: 'clock6',
    plan: 'sparkles',
    done: 'tada',
    kiss: 'kiss'
  };

  var TITLES = {
    open: 'Лера открыла приглашение',
    no: 'Лера жмёт «Нет»',
    yes: 'Лера согласилась!',
    time: 'Выбрала время',
    plan: 'Выбрала, что делаем',
    done: 'Договорились!',
    kiss: 'Прислала поцелуй'
  };

  function address(type, extra) {
    var query = '?title=' + encodeURIComponent(TITLES[type] || 'Приглашение') +
      '&tags=' + encodeURIComponent(TAGS[type] || 'love_letter');
    return HOST + '/' + TOPIC + query + (extra || '');
  }

  function send(type, info) {
    try {
      fetch(address(type), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: info || type,
        keepalive: true
      })['catch'](function () { /* мовчки: подія не критична */ });
    } catch (e) { /* так само мовчки */ }
  }

  /* Фото їде вкладенням: PUT з тілом-картинкою. На відміну від решти подій
     тут важливо знати результат — сторінка показує його гості. */
  function sendPhoto(blob) {
    return fetch(address('kiss', '&filename=kiss.jpg'), {
      method: 'PUT',
      body: blob
    }).then(function (response) {
      if (!response.ok) throw new Error('ntfy ' + response.status);
      return response;
    })['catch'](function (error) {
      // Вкладення не пройшло — хай хоч звістка дійде.
      send('kiss', 'прислала поцелуй, но фото не долетело');
      throw error;
    });
  }

  global.Track = { send: send, sendPhoto: sendPhoto, topic: TOPIC, host: HOST };
})(window);
