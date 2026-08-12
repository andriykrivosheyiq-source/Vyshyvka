/* Події запрошення.
   Пишемо напряму в Firestore через REST — без SDK, щоб сторінки лишалися
   легкими. Пише сюди лише той, хто відкрив запрошення; читає адмінка,
   знаючи токен гілки. Токен випадковий, колекція списком не віддається.
   Якщо мережа чи правила не пускають — сторінка просто працює далі. */

(function (global) {
  'use strict';

  var PROJECT = 'loomiq-admin';
  var API_KEY = 'AIzaSyDf7WmfVlny7T8SBo9N_Xr7TorWYdrDqTc';
  var TOKEN = 'gmrx94e9g8dszu';

  var URL_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
    '/databases/(default)/documents/dateInvite/' + TOKEN + '/events?key=' + API_KEY;

  function once(key) {
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, '1');
      return true;
    } catch (e) {
      return true;
    }
  }

  function send(type, info) {
    var fields = {
      type: { stringValue: String(type).slice(0, 24) },
      ts: { integerValue: String(Date.now()) }
    };

    if (info) fields.info = { stringValue: String(info).slice(0, 120) };

    // Пристрій пишемо один раз за сесію — далі це вже нічого не додає.
    if (once('invite-ua')) {
      fields.ua = { stringValue: String(navigator.userAgent).slice(0, 200) };
    }

    try {
      fetch(URL_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields }),
        keepalive: true
      })['catch'](function () { /* мовчки: подія не критична */ });
    } catch (e) { /* так само мовчки */ }
  }

  global.Track = { send: send };
})(window);
