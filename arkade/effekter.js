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
 *  - Tegner browseren uden grafikkort (WebGL-rendereren er SwiftShader, llvmpipe, Microsoft Basic
 *    Render Driver …, eller WebGL mangler helt), spørges der med det samme i menuen/hallen –
 *    også ved første besøg, uden at vente på målingen.
 *  - Under automatiske tests (navigator.webdriver) kun med localStorage['hojtArkade.effekterTest'] = '1';
 *    grafikkort-tjekket tæller da kun med localStorage['hojtArkade.effekterTestGpu'] = 'ja'.
 *
 *   ArkadeEffekterForslag.langsom()   // markér som langsom (test)
 *   ArkadeEffekterForslag.maaling     // { spilMs, langsomMs }
 *   ArkadeEffekterForslag.utenGrafikkort()   // true når browseren tegner i software
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
  global.ArkadeEffekterForslag = { langsom: function () { flag = true; vis(); }, get maaling() { return maaling; },
                                   utenGrafikkort: function () { return utenGrafikkort(); } };

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
  // ---------- Tegner browseren uden grafikkort? ----------
  // Så kan der spørges med det samme (ved første besøg i hallen) i stedet for efter 20 s hakken.
  // Software-tegning ses på WebGL-rendereren (SwiftShader, llvmpipe, Microsoft Basic Render Driver …);
  // giver browseren slet ingen WebGL, har den som regel også slået grafikkortet fra (blokeret driver).
  var SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
  function utenGrafikkort() {
    try {
      var c = doc.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return true;
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      var navn = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      var tab = gl.getExtension('WEBGL_lose_context'); if (tab) tab.loseContext();   // frigiv med det samme
      return SOFTWARE.test(navn);
    } catch (e) { return false; }
  }
  var grund = 'langsom';

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
    var gpu = grund === 'grafikkort';
    global.ArkadeBekraeft.spoerg({
      titel: gpu ? 'Computeren tegner uden grafikkort' : 'Spillet kører langsomt på denne computer',
      tekst: (gpu ? 'Browseren får ikke hjælp fra grafikkortet, så spillene kan hakke. ' : '') +
        'Vil du begrænse effekterne? Så slukkes neon-gløden, og baggrunden står stille, så spillene kører hurtigere. Du kan altid ændre det under Indstillinger → Udseende.',
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
    // Uden grafikkort: spørg kort efter indlæsning, hvis siden allerede står i menuen/hallen
    // (ellers ved næste skærmskift dertil). Står en anden dialog åben, prøves igen lidt senere.
    global.setTimeout(function () {
      var test = global.navigator && global.navigator.webdriver;   // under tests: kun når testen beder om det
      if (!skalSpoerge() || !(test ? get('hojtArkade.effekterTestGpu') === 'ja' : utenGrafikkort())) return;
      flag = true; grund = 'grafikkort';
      var forsoeg = 0;
      (function proev() {
        vis();
        if (flag && ++forsoeg < 20) global.setTimeout(proev, 3000);
      })();
    }, 1500);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(window);
