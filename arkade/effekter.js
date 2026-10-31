/*
 * Hojt Arkade – effekter.js: foreslå "Begræns effekter" på langsomme computere.
 *
 *  - Måler passivt, mens spilleren er inde i selve spillet (skærmen #game): browseren melder selv
 *    billeder, der tog lang tid (long-animation-frame, ellers longtask). Der tegnes intet ekstra.
 *  - Bruger mindst en fjerdedel af tiden på lange billeder (over 50 ms) i mindst 20 sekunders spil,
 *    regnes computeren for langsom til de fulde effekter.
 *  - Så vises ÉN gang en rolig ja/nej-dialog (arkade/bekraeft.js), næste gang spilleren går til
 *    menuen eller hallen – aldrig midt i et spil. "Nej tak" står først og har fokus.
 *  - Ja: indstillingen slås til, og siden genindlæses i menuen. Nej: der spørges aldrig igen.
 *  - Er effekterne allerede begrænset, eller er der svaret før, måles der ikke.
 *  - Under automatiske tests (navigator.webdriver) kun med localStorage['hojtArkade.effekterTest'] = '1'.
 *
 *   ArkadeEffekterForslag.langsom()   // markér som langsom (test)
 *   ArkadeEffekterForslag.maaling     // { spilMs, langsomMs }
 * Indlæses efter settings.js og bekraeft.js. Kun ES5.
 */
(function (global) {
  'use strict';
  var doc = global.document, ls;
  try { ls = global.localStorage; } catch (e) { ls = null; }
  var SVAR = 'hojtArkade.effekterForslag', INDST = 'hojtArkade.arkade.indstillinger';
  var MIN_SPIL_MS = 20000, ANDEL = 0.25;
  function get(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (ls) ls.setItem(k, v); } catch (e) { /* ignore */ } }

  var maaling = { spilMs: 0, langsomMs: 0 }, flag = false, aktiv = true;
  global.ArkadeEffekterForslag = { langsom: function () { flag = true; vis(); }, get maaling() { return maaling; } };

  if (!doc || !global.PerformanceObserver) { aktiv = false; return; }
  if (global.navigator && global.navigator.webdriver && get('hojtArkade.effekterTest') !== '1') { aktiv = false; }
  function skalSpoerge() {
    return aktiv && !get(SVAR) && !(global.ArkadeEffekter && global.ArkadeEffekter.begraenset());
  }

  // ---------- Hvilken skærm er synlig? ----------
  function skaerm() {
    var s = doc.querySelectorAll('.screen');
    for (var i = 0; i < s.length; i++) if (!s[i].hidden) return s[i].id;
    return '';
  }
  function iSpil() { return doc.visibilityState !== 'hidden' && skaerm() === 'game'; }

  // ---------- Passiv måling ----------
  var sidst = Date.now();
  function tael() {
    var nu = Date.now(), dt = Math.min(1000, nu - sidst); sidst = nu;
    if (iSpil()) maaling.spilMs += dt;
  }
  function lang(dur) {
    if (!skalSpoerge() || flag) return;
    tael();
    if (iSpil()) maaling.langsomMs += dur;
    if (maaling.spilMs >= MIN_SPIL_MS && maaling.langsomMs / maaling.spilMs >= ANDEL) flag = true;
  }
  var typer = (global.PerformanceObserver.supportedEntryTypes || []);
  var type = typer.indexOf('long-animation-frame') >= 0 ? 'long-animation-frame' : typer.indexOf('longtask') >= 0 ? 'longtask' : '';
  if (type && skalSpoerge()) {
    try {
      new global.PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { lang(e.duration); }); }).observe({ type: type });
      global.setInterval(tael, 1000);
    } catch (e) { /* ingen måling */ }
  }

  // ---------- Forslaget ved næste sikre øjeblik ----------
  var SIKRE = { menu: 1, hal: 1 };
  function dialogAaben() {
    if (global.ArkadeBekraeft && global.ArkadeBekraeft.aaben()) return true;
    var d = doc.querySelectorAll('.arkade-hs, [role="dialog"], [role="alertdialog"], .overlay');
    for (var i = 0; i < d.length; i++) {
      var e = d[i]; if (e.hidden || e.closest('[hidden]')) continue;
      var st = global.getComputedStyle(e); if (st.display !== 'none' && st.visibility !== 'hidden') return true;
    }
    return false;
  }
  function vis() {
    if (!flag || !skalSpoerge() || !global.ArkadeBekraeft || !SIKRE[skaerm()] || dialogAaben()) return;
    flag = false;
    global.ArkadeBekraeft.spoerg({
      titel: 'Spillet kører langsomt på denne computer',
      tekst: 'Vil du begrænse effekterne? Så slukkes neon-gløden, og baggrunden står stille, så spillene kører hurtigere. Du kan altid ændre det under Indstillinger → Udseende.',
      nej: 'Nej tak', nejLille: 'spørg ikke igen',
      ja: 'Ja, begræns', jaLille: 'kører hurtigere',
      onNej: function () { set(SVAR, 'nej'); },
      onJa: function () {
        set(SVAR, 'ja');
        var a = {}; try { a = JSON.parse(get(INDST) || '{}') || {}; } catch (e) { a = {}; }
        a.begraensEffekter = true;
        set(INDST, JSON.stringify(a));
        global.location.reload();      // alle spil og baggrunden tegner med de begrænsede effekter
      }
    });
  }
  var forrige = '';
  function start() {
    if (!global.MutationObserver || !doc.querySelector('.screen')) return;
    forrige = skaerm();
    new global.MutationObserver(function () {
      var nu = skaerm();
      if (nu !== forrige) { forrige = nu; if (SIKRE[nu]) vis(); }
    }).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
