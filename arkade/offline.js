/*
 * Hojt Arkade – offline.js
 * Registrerer arkadens service worker (sw.js i roden) og sørger for, at spillerne altid har den
 * nyeste udgave – også når en side står åben i timevis.
 *
 *  - Kun over http/https. Åbnes arkaden fra disken (file://), sker der intet.
 *  - Ved hvert besøg spørger browseren efter en ny sw.js (uden om sin cache), og service workeren
 *    henter altid siderne friskt fra serveren, når der er net (se sw.js).
 *  - En åben side tjekker selv for en ny udgave: kort efter indlæsning, hver 10. minut, når siden
 *    bliver synlig igen, og når nettet kommer tilbage. Den sammenligner hver af sidens filer med
 *    serverens (ETag eller Last-Modified, uden at hente filerne).
 *  - Er der en ny udgave, genindlæses siden ved næste sikre øjeblik: når spilleren går til menuen
 *    (eller tilbage til hallen) – aldrig midt i et spil, en dialog eller på andre skærme.
 *    Sider uden skærme (fx Tobii-vejledningen) genindlæses ikke af sig selv; de er nye ved næste besøg.
 *  - Fejler noget, kører alt som før.
 *
 *   ArkadeOffline.tjek()      // tjek nu; giver et løfte med true, hvis der er en ny udgave
 *   ArkadeOffline.ventende    // true, når en ny udgave venter på et sikkert øjeblik
 */
(function (global) {
  'use strict';
  var nav = global.navigator, loc = global.location, doc = global.document;
  if (!nav || !('serviceWorker' in nav) || !loc || !/^https?:$/.test(loc.protocol)) return;
  var src = doc && doc.currentScript && doc.currentScript.src;
  if (!src) return;
  var sw, scope;
  try { sw = new URL('../sw.js', src).href; scope = new URL('../', src).href; } catch (e) { return; }

  var TJEK_MS = 10 * 60 * 1000, MIN_MELLEM_MS = 2 * 60 * 1000;
  var SIKRE = { menu: 1, hal: 1 };          // skærme, hvor siden må genindlæses
  var reg = null, ventende = false, sidst = 0, igang = null, snapshot = null;

  function registrer() {
    try {
      nav.serviceWorker.register(sw, { scope: scope, updateViaCache: 'none' })
        .then(function (r) { reg = r; try { r.update(); } catch (e) {} })
        .catch(function () { /* kører som før */ });
    } catch (e) { /* kører som før */ }
  }

  // ---------- Hvilke filer kører siden med? ----------
  function sidensFiler() {
    var ud = {}, egen = loc.origin;
    function tilfoej(u) {
      try { var x = new URL(u, loc.href); if (x.origin !== egen) return; x.hash = ''; if (/\/sw\.js$/.test(x.pathname)) return; ud[x.href] = 1; } catch (e) {}
    }
    tilfoej(loc.href);
    try {
      (global.performance.getEntriesByType('resource') || []).forEach(function (r) {
        if (/^(script|link|css|img)$/.test(r.initiatorType)) tilfoej(r.name);
      });
    } catch (e) {}
    return Object.keys(ud);
  }
  function maerke(res) { return res ? (res.headers.get('ETag') || res.headers.get('Last-Modified') || '') : ''; }
  // Mærket på den udgave, siden kører med: kopien, service workeren gemte, da siden blev hentet
  function lavSnapshot() {
    if (!global.caches) return Promise.resolve(null);
    var filer = sidensFiler(), ud = {};
    return Promise.all(filer.map(function (u) {
      return global.caches.match(u).then(function (r) { var m = maerke(r); if (m) ud[u] = m; }).catch(function () {});
    })).then(function () { return ud; });
  }

  // ---------- Tjek for en ny udgave ----------
  function tjek() {
    if (igang) return igang;
    if (nav.onLine === false || !global.fetch) return Promise.resolve(false);
    sidst = Date.now();
    igang = (snapshot ? Promise.resolve(snapshot) : lavSnapshot().then(function (s) { snapshot = s; return s; })).then(function (s) {
      var filer = Object.keys(s || {});
      if (reg) { try { reg.update(); } catch (e) {} }
      // Ét ad gangen, og stop ved første forskel: få og små forespørgsler
      var i = 0;
      function naeste() {
        if (i >= filer.length) return false;
        var u = filer[i++];
        return global.fetch(u, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
          var m = res.ok ? maerke(res) : '';
          return (m && m !== s[u]) ? true : naeste();
        }, function () { return false; });   // intet net: intet at sige
      }
      return naeste();
    }).then(function (ny) {
      igang = null;
      if (ny) { ventende = true; anvendHvisSikkert(false); }
      return ny;
    }, function () { igang = null; return false; });
    return igang;
  }
  function maaske() { if (Date.now() - sidst >= MIN_MELLEM_MS) tjek(); }

  // ---------- Genindlæs ved næste sikre øjeblik ----------
  function synligSkaerm() {
    var s = doc.querySelectorAll('.screen');
    for (var i = 0; i < s.length; i++) if (!s[i].hidden) return s[i].id;
    return '';
  }
  function dialogAaben() {
    if (global.ArkadeBekraeft && global.ArkadeBekraeft.aaben()) return true;
    var d = doc.querySelectorAll('.arkade-hs, [role="dialog"], [role="alertdialog"], .overlay');
    for (var i = 0; i < d.length; i++) {
      var e = d[i]; if (e.hidden || e.closest('[hidden]')) continue;
      var st = global.getComputedStyle(e); if (st.display !== 'none' && st.visibility !== 'hidden') return true;
    }
    return false;
  }
  var forrige = '';
  function anvendHvisSikkert(skift) {
    if (!ventende) return;
    var nu = synligSkaerm();
    // Kun når spilleren selv går til menuen (skift), så siden ikke skifter under blikket uden grund
    if (skift && SIKRE[nu] && !dialogAaben()) { ventende = false; loc.reload(); }
  }
  function overvaagSkaerme() {
    if (!global.MutationObserver || !doc.querySelector('.screen')) return;
    forrige = synligSkaerm();
    new global.MutationObserver(function () {
      var nu = synligSkaerm();
      if (nu !== forrige) { forrige = nu; anvendHvisSikkert(true); }
    }).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }

  function start() {
    registrer();
    overvaagSkaerme();
    // Mærkerne tages lidt efter indlæsning, når service workeren har gemt det, siden blev hentet med
    global.setTimeout(function () { lavSnapshot().then(function (s) { snapshot = s; }); }, 5000);
    global.setTimeout(maaske, 60 * 1000);
    global.setInterval(tjek, TJEK_MS);
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') maaske(); });
    global.addEventListener('online', function () { tjek(); });
  }
  // Efter indlæsning, så intet af det forsinker spillets start
  if (doc.readyState === 'complete') start(); else global.addEventListener('load', start);

  global.ArkadeOffline = {
    tjek: tjek,
    get ventende() { return ventende; },
    snapshot: function () { return lavSnapshot().then(function (s) { snapshot = s; return s; }); }
  };
})(window);
