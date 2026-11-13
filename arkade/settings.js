/*
 * Hojt Arkade – settings.js
 * Små, genbrugelige indstillinger gemt i localStorage.
 *
 *   const s = ArkadeSettings.create('arkade', { dwell: false, dwellTime: 1.2 });
 *   s.get('dwell'); s.set('dwell', true); s.all(); s.flush(); s.reset();
 *   const off = s.onChange((key, value) => { ... }); off();
 *
 * Kun nøgler, der findes i defaults, kan bruges. Gemte værdier med forkert
 * type ignoreres, så et nyt spil aldrig går i stykker på gamle data.
 * Gemte nøgler, som siden ikke kender (fx en ny fælles indstilling), bevares, når der gemmes.
 *
 * ArkadeEffekter: den fælles indstilling "Begræns effekter" (arkade.begraensEffekter).
 * Sættes som <html data-effekter="begraenset">, så snart denne fil indlæses – før spillet tegner.
 *   ArkadeEffekter.begraenset()   // true/false
 *   ArkadeEffekter.anvend(true)   // når indstillingen ændres; sender hændelsen 'arkade:effekter'
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
    var ukendte = {};   // gemte nøgler, som denne side ikke kender: bevares, når der gemmes
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') Object.keys(saved).forEach(function (k) { if (!(k in defaults)) ukendte[k] = saved[k]; });
        Object.keys(defaults).forEach(function (k) {
          if (saved && Object.prototype.hasOwnProperty.call(saved, k) &&
              typeof saved[k] === typeof defaults[k]) {
            values[k] = saved[k];
          }
        });
      } catch (e) { /* ødelagte data: brug defaults */ }
    }

    function save() { storageSet(storageKey, JSON.stringify(Object.assign({}, ukendte, values))); }
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
      flush: save,   // gem nu (fx lige før siden forlades) – bevarer nøgler, siden ikke kender (fx stil)
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

  // ---------- Begræns effekter (fælles for hallen og alle spil) ----------
  var begr = false;
  try { var a = JSON.parse(storageGet('hojtArkade.arkade.indstillinger') || '{}'); begr = !!(a && a.begraensEffekter === true); } catch (e) { begr = false; }
  function saetAttr() {
    var r = global.document && global.document.documentElement;
    if (!r) return;
    if (begr) r.setAttribute('data-effekter', 'begraenset'); else r.removeAttribute('data-effekter');
  }
  saetAttr();
  global.ArkadeEffekter = {
    begraenset: function () { return begr; },
    anvend: function (v) {
      begr = !!v; saetAttr();
      try { global.dispatchEvent(new global.Event('arkade:effekter')); } catch (e) { /* ældre browser */ }
    }
  };
})(window);


/* Statistik: åbner man en side med ?ikketael, tælles den browser ikke med
 * (localStorage hojtArkade.ikkeTael = '1'). ?taelmig slår tællingen til igen.
 * Kører også i hallen, som ikke indlæser highscore.js. */
(function (global) {
  'use strict';
  var KEY = 'hojtArkade.ikkeTael';
  var loc = global.location, doc = global.document;
  if (!loc) return;
  var raw = '';
  try { raw = loc.search || ''; } catch (e) { return; }
  var dele = raw.replace(/^\?/, '').split('&');
  function har(navn) {
    for (var i = 0; i < dele.length; i++) {
      var n = dele[i].split('+').join(' ').split('=')[0];
      try { n = decodeURIComponent(n); } catch (e) {}
      if (n === navn) return true;
    }
    return false;
  }
  var fra = har('ikketael'), til = har('taelmig');
  if (!fra && !til) return;
  try {
    var LS = global.localStorage;
    if (fra) LS.setItem(KEY, '1');
    else LS.removeItem(KEY);
  } catch (e) {}
  try {
    if (global.history && history.replaceState) {
      var behold = [];
      for (var j = 0; j < dele.length; j++) {
        if (!dele[j]) continue;
        var n2 = dele[j].split('+').join(' ').split('=')[0];
        try { n2 = decodeURIComponent(n2); } catch (e) {}
        if (n2 && n2 !== 'ikketael' && n2 !== 'taelmig') behold.push(dele[j]);
      }
      var soeg = behold.length ? '?' + behold.join('&') : '';
      history.replaceState(null, '', loc.pathname + soeg + (loc.hash || ''));
    }
  } catch (e) {}
  function vis(tekst) {
    if (!doc || !doc.createElement) return;
    var el = doc.createElement('div');
    el.id = 'arkade-ikketael';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = tekst;
    var s = el.style;
    if (s) {
      s.position = 'fixed';
      s.left = '50%';
      s.top = '12px';
      s.transform = 'translateX(-50%)';
      s.zIndex = '2147483646';
      s.boxSizing = 'border-box';
      s.maxWidth = 'min(36em, calc(100% - 24px))';
      s.padding = '10px 16px';
      s.margin = '0';
      s.background = 'rgba(12, 6, 18, 0.92)';
      s.color = '#fff';
      s.border = '2px solid #22eaff';
      s.borderRadius = '12px';
      s.font = '600 1rem/1.35 system-ui, sans-serif';
      s.textAlign = 'center';
      s.pointerEvents = 'none';
      s.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
    }
    function sæt() {
      if (!doc.body) return;
      doc.body.appendChild(el);
      global.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
    }
    if (doc.body) sæt();
    else if (doc.addEventListener) doc.addEventListener('DOMContentLoaded', sæt);
  }
  vis(fra
    ? 'Denne browser tælles ikke med i statistikken.'
    : 'Denne browser tælles med i statistikken igen.');
})(window);
