/*
 * Hojt Arkade – highscores.js
 * Lokal rekordliste (top 10) pr. kategori, fx pr. brætstørrelse.
 * Hver plads gemmes med point, dato og (efter navneindtastning) et navn på 3 bogstaver.
 * Er arkade/highscore.js indlæst, kobles den globale liste på automatisk: efter add()
 * vises navneindtastning og top 10 med fanerne 'Verden' og 'Min maskine'.
 *
 *   const hs = ArkadeHighscores.create('slangen', { max: 10 });
 *   const res = hs.add('15', 230);   // { rank: 3, entry: {...}, list: [...] }  rank = 0 hvis ikke på listen
 *   hs.list('15');                   // [{ id, score, date: ISO-streng }, ...] højeste først
 *   hs.best('15');                   // højeste point eller 0
 *   hs.clear('15');
 *   ArkadeHighscores.formatDate(iso) // "26.10.2026"
 *   ArkadeHighscores.sidst           // { records, kat } fra det seneste list()-kald
 */
(function (global) {
  'use strict';

  function read(key) {
    try { var raw = global.localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return read._mem[key] || {}; }
  }
  read._mem = {};
  function write(key, data) {
    try { global.localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) { read._mem[key] = data; }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function create(namespace, opts) {
    var max = (opts && opts.max) || 10;
    var global_ = !(opts && opts.global === false) && !/-test$/.test(namespace);
    if (global_ && !global.HOJT_SPIL_ID) global.HOJT_SPIL_ID = namespace;
    var storageKey = 'hojtArkade.' + namespace + '.rekorder';

    function getAll() {
      var data = read(storageKey);
      return (data && typeof data === 'object') ? data : {};
    }
    function liste(category) {
      var arr = getAll()[String(category)];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (e) { return e && typeof e.score === 'number'; }).slice(0, max);
    }
    // Spillets rekordskærm kalder list(kategori); den sidst viste liste huskes, så
    // 'Verden'-knappen (data-hs-verden) i highscore.js ved, hvilken top 10 den skal hente.
    function list(category) {
      if (global_) global.ArkadeHighscores.sidst = { records: api, kat: String(category) };
      return liste(category);
    }
    function add(category, score, extra) {
      category = String(category);
      var data = getAll();
      var arr = Array.isArray(data[category]) ? data[category].slice() : [];
      var entry = Object.assign({}, extra || {}, {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        score: score,
        date: new Date().toISOString()
      });
      arr.push(entry);
      // Højeste først; ved lige point står den ældste øverst.
      arr.sort(function (a, b) { return (b.score - a.score) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0); });
      arr = arr.slice(0, max);
      data[category] = arr;
      write(storageKey, data);
      var idx = arr.findIndex(function (e) { return e.id === entry.id; });
      var res = { rank: idx + 1, entry: entry, list: arr };
      if (global_ && global.ArkadeHighscore && typeof global.ArkadeHighscore.efterAdd === 'function') {
        try { global.ArkadeHighscore.efterAdd(api, category, score, res); } catch (e) { /* global liste må aldrig vælte spillet */ }
      }
      return res;
    }
    // Sæt navn (3 bogstaver) på en plads, fx efter navneindtastning.
    function setName(category, id, navn) {
      category = String(category);
      var data = getAll(), arr = data[category];
      if (!Array.isArray(arr)) return false;
      var e = arr.find(function (x) { return x && x.id === id; });
      if (!e) return false;
      e.navn = navn; write(storageKey, data); return true;
    }
    function best(category) { var l = liste(category); return l.length ? l[0].score : 0; }
    function qualifies(category, score) {
      var l = liste(category);
      return score > 0 && (l.length < max || score > l[l.length - 1].score);
    }
    function clear(category) {
      var data = getAll();
      if (category === undefined) data = {}; else delete data[String(category)];
      write(storageKey, data);
    }
    var api = { namespace: namespace, storageKey: storageKey, max: max, list: list, add: add, best: best, qualifies: qualifies, clear: clear, setName: setName };
    return api;
  }

  global.ArkadeHighscores = { create: create, formatDate: formatDate, sidst: null };
})(window);
