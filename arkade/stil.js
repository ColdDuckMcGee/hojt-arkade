/*
 * Hojt Arkade – stil.js: arkadens grafiske stil.
 *
 *   neon        synthwave-neon på mørk baggrund (som altid)
 *   tegneserie  tykke sorte konturer, flade farver, rasterprikker og hårde skygger
 *   pixel       retro-pixel: firkantede former, få klare farver, pixelskrift
 *
 * Stilen vælges i hallen (Indstillinger → Udseende → Stil) og gemmes som arkade.stil i
 * hojtArkade.arkade.indstillinger. Filen indlæses i <head> lige efter arkade.css, så
 * <html data-stil="…"> er sat, før noget tegnes. Alle fælles flader (knapper, paneler,
 * dialoger, rekorder, kigge-klik-ringen, skrift, logo og baggrund) følger data-stil.
 *
 * Spil med temamappe (tema/neon/, tema/tegneserie/, tema/pixel/) indlæser temaet sådan –
 * i stedet for faste <link>/<script>-mærker. Listen er de stile, spillet har EGNE filer til;
 * mangler en stil, bruges neon-filen (fx samme tegnefunktioner med pixel-farverne):
 *   <script>ArkadeStil.css(['neon', 'tegneserie', 'pixel'])</script>      i <head>
 *   <script>ArkadeStil.grafik(['neon', 'tegneserie'])</script>            hvor grafik.js stod
 *
 *   ArkadeStil.stil()          // 'neon' | 'tegneserie' | 'pixel'
 *   ArkadeStil.pixel()         // true i retro-pixel
 *   ArkadeStil.pixelStr        // CSS-px pr. "pixel" i pixel-stil (lærreder tegnes i lav opløsning)
 *   ArkadeStil.skift('pixel')  // gem og genindlæs siden
 *
 * Kun ES5, virker fra file://.
 */
(function (global) {
  'use strict';
  var doc = global.document;
  var STILE = ['neon', 'tegneserie', 'pixel'];
  var KEY = 'hojtArkade.arkade.indstillinger';
  function get(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  var stil = 'neon';
  try { var a = JSON.parse(get(KEY) || '{}'); if (a && STILE.indexOf(a.stil) >= 0) stil = a.stil; } catch (e) { stil = 'neon'; }
  if (doc && doc.documentElement) doc.documentElement.setAttribute('data-stil', stil);

  function valgt(har) { return har && har.indexOf(stil) >= 0 ? stil : 'neon'; }

  global.ArkadeStil = {
    STILE: STILE,
    pixelStr: 4,
    stil: function () { return stil; },
    pixel: function () { return stil === 'pixel'; },
    css: function (har) { doc.write('<link rel="stylesheet" href="tema/' + valgt(har) + '/tema.css">'); },
    grafik: function (har) { doc.write('<script src="tema/' + valgt(har) + '/grafik.js"><\/script>'); },
    skift: function (v) {
      if (STILE.indexOf(v) < 0 || v === stil) return;
      var o = {}; try { o = JSON.parse(get(KEY) || '{}') || {}; } catch (e) { o = {}; }
      o.stil = v; set(KEY, JSON.stringify(o));
      global.location.reload();
    }
  };
})(window);
