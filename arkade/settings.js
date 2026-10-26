/*
 * Hojt Arkade – settings.js
 * Små, genbrugelige indstillinger gemt i localStorage.
 *
 *   const s = ArkadeSettings.create('arkade', { dwell: false, dwellTime: 1.2 });
 *   s.get('dwell'); s.set('dwell', true); s.all(); s.reset();
 *   const off = s.onChange((key, value) => { ... }); off();
 *
 * Kun nøgler, der findes i defaults, kan bruges. Gemte værdier med forkert
 * type ignoreres, så et nyt spil aldrig går i stykker på gamle data.
 */
(function (global) {
  'use strict';

  var memory = {};
  function storageGet(key) {
    try { return global.localStorage.getItem(key); }
    catch (e) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; }
  }
  function storageSet(key, value) {
    try { global.localStorage.setItem(key, value); }
    catch (e) { memory[key] = value; }
  }
  function storageRemove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    delete memory[key];
  }

  function create(namespace, defaults) {
    if (!namespace) throw new Error('ArkadeSettings.create: namespace mangler');
    defaults = Object.assign({}, defaults || {});
    var storageKey = 'hojtArkade.' + namespace + '.indstillinger';
    var values = Object.assign({}, defaults);
    var listeners = [];

    var raw = storageGet(storageKey);
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        Object.keys(defaults).forEach(function (k) {
          if (saved && Object.prototype.hasOwnProperty.call(saved, k) &&
              typeof saved[k] === typeof defaults[k]) {
            values[k] = saved[k];
          }
        });
      } catch (e) { /* ødelagte data: brug defaults */ }
    }

    function save() { storageSet(storageKey, JSON.stringify(values)); }
    function emit(key, value) {
      listeners.slice().forEach(function (fn) {
        try { fn(key, value, api); } catch (e) { console.error(e); }
      });
    }

    var api = {
      storageKey: storageKey,
      get: function (key) {
        if (!(key in defaults)) throw new Error('Ukendt indstilling: ' + key);
        return values[key];
      },
      set: function (key, value) {
        if (!(key in defaults)) throw new Error('Ukendt indstilling: ' + key);
        if (typeof value !== typeof defaults[key]) throw new Error('Forkert type for ' + key);
        if (values[key] === value) return;
        values[key] = value;
        save();
        emit(key, value);
      },
      toggle: function (key) { api.set(key, !values[key]); return values[key]; },
      all: function () { return Object.assign({}, values); },
      defaults: function () { return Object.assign({}, defaults); },
      reset: function () {
        values = Object.assign({}, defaults);
        storageRemove(storageKey);
        Object.keys(values).forEach(function (k) { emit(k, values[k]); });
      },
      onChange: function (fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
      }
    };
    return api;
  }

  global.ArkadeSettings = { create: create };
})(window);
