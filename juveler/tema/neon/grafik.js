/*
 * Juveler – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/) leverer et objekt med de samme navne.
 * Alt tegnes i et 100 × 100-felt og farves kun med klasser og CSS-variabler fra
 * tema.css (ingen farver her):
 *
 * Juveler (navnene kommer fra JuvelerGame.TYPES – hver har sin egen FORM, så de kan
 * skelnes uden farver):
 *   rubin    rombe          safir    cirkel        smaragd  ottekant (smaragdslib)
 *   topas    trekant        ametyst  sekskant      opal     stjerne (5 takker)
 *   rav      dråbe (den syvende type, fra niveau 8)
 *   Klasser: .jv-krop (fladen, farve --jv-farve), .jv-lys (lys facet), .jv-skygge
 *   (mørk facet), .jv-kant (kontur: --jv-kant, tykkelse --jv-kant-w), .jv-glans (lille glimt).
 *
 * Særlige brikker (fylder et felt ligesom en juvel, lægges ind som #jv-juvel-<navn>):
 *   stjerne  stjernejuvel: farveløs 8-takket stjerne med flerfarvede takker
 *            (.jv-stjerne-1 … .jv-stjerne-4, farver --jv-stjerne-1 … 4) og en hvid kerne
 *   sten     fast blok: afrundet firkant med revner (.jv-sten-krop, .jv-sten-revne)
 *
 * Mærker (lægges oven på en juvel, #jv-mark-<navn>):
 *   lyn      lynjuvel: et lyn midt på juvelen (.jv-lyn-krop med mørk kant .jv-lyn-kant)
 *   is       frossen juvel: isflade over hele feltet med skrå frost-striber og hjørner
 *            (.jv-is-flade, .jv-is-streg) – mønsteret skelner isen, ikke kun farven
 *
 * Ikoner: tilbage, pause, tip, fortryd, opgave (et mål med en pil), niveau (en trappe).
 *   Klasser: .ico-line (streg) og .ico-fill (flade).
 */
(function (global) {
  'use strict';
  function juvel(form, lys, skygge, glans) {
    return '<path class="jv-krop" d="' + form + '"/>' +
      (lys ? '<path class="jv-lys" d="' + lys + '"/>' : '') +
      (skygge ? '<path class="jv-skygge" d="' + skygge + '"/>' : '') +
      '<path class="jv-kant" d="' + form + '"/>' +
      (glans ? '<path class="jv-glans" d="' + glans + '"/>' : '');
  }
  var JUVELER = {
    // Rombe
    rubin: juvel('M50 6 L93 50 L50 94 L7 50 Z', 'M50 6 L50 50 L7 50 Z M50 50 L93 50 L50 94 Z', 'M50 50 L50 94 L7 50 Z', 'M36 34 L46 24 L48 30 Z'),
    // Cirkel med indre ring
    safir: juvel('M50 7 A43 43 0 1 1 49.9 7 Z', 'M50 7 A43 43 0 0 0 7 50 L30 50 A20 20 0 0 1 50 30 Z', 'M93 50 A43 43 0 0 1 50 93 L50 70 A20 20 0 0 0 70 50 Z', 'M26 32 A30 30 0 0 1 40 18 L42 24 A24 24 0 0 0 31 35 Z'),
    // Ottekant (smaragdslib) med indre rektangel
    smaragd: juvel('M30 8 H70 L92 30 V70 L70 92 H30 L8 70 V30 Z', 'M30 8 H70 L60 28 H40 Z M8 30 L28 40 V60 L8 70 Z', 'M92 30 V70 L72 60 V40 Z M30 92 H70 L60 72 H40 Z', 'M26 22 L34 14 L36 20 L30 26 Z'),
    // Trekant med spidsen opad
    topas: juvel('M50 7 L95 88 H5 Z', 'M50 7 L50 60 L5 88 Z', 'M95 88 H5 L50 60 Z', 'M40 34 L48 20 L49 30 Z'),
    // Sekskant
    ametyst: juvel('M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 Z', 'M50 5 L89 27.5 L50 50 L11 27.5 Z', 'M50 50 L89 72.5 L50 95 L11 72.5 Z', 'M28 34 L42 26 L40 32 Z'),
    // Femtakket stjerne
    opal: juvel('M50 4 L61.5 36 L95 37 L68.5 57.5 L78 90 L50 71 L22 90 L31.5 57.5 L5 37 L38.5 36 Z', 'M50 4 L61.5 36 L50 50 L38.5 36 Z M5 37 L38.5 36 L50 50 L31.5 57.5 Z', 'M68.5 57.5 L78 90 L50 71 L50 50 Z', 'M44 30 L49 16 L50 28 Z'),
    // Dråbe med spidsen opad (syvende type)
    rav: juvel('M50 5 C62 26 82 44 82 62 A32 32 0 0 1 18 62 C18 44 38 26 50 5 Z', 'M50 5 C38 26 18 44 18 62 L50 62 Z', 'M82 62 A32 32 0 0 1 50 94 L50 62 Z', 'M32 56 C33 46 38 40 42 36 L40 48 Z'),
    // Stjernejuvel: 8 takker i skiftende farver og en hvid kerne
    stjerne: (function () {
      var s = '', pts = [];
      for (var i = 0; i < 16; i++) {
        var a = (i * 22.5 - 90) * Math.PI / 180, r = i % 2 ? 22 : 47;
        pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
      }
      function p(q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
      for (var t = 0; t < 8; t++) {
        var a0 = pts[(2 * t + 15) % 16], tip = pts[2 * t], a1 = pts[2 * t + 1];
        s += '<path class="jv-stjerne-' + (t % 4 + 1) + '" d="M50 50 L' + p(a0) + ' L' + p(tip) + ' L' + p(a1) + ' Z"/>';
      }
      var outline = 'M' + pts.map(p).join(' L') + ' Z';
      return s + '<path class="jv-kant" d="' + outline + '"/><circle class="jv-stjerne-kerne" cx="50" cy="50" r="13"/><circle class="jv-kant" cx="50" cy="50" r="13"/>';
    })(),
    // Sten: afrundet blok med revner
    sten: '<rect class="jv-sten-krop" x="6" y="6" width="88" height="88" rx="14"/>' +
      '<path class="jv-sten-lys" d="M20 6 H80 A14 14 0 0 1 94 20 L80 30 H20 Z"/>' +
      '<path class="jv-sten-revne" d="M30 18 L42 40 L34 56 L46 80 M62 22 L58 44 L74 60 M42 40 L58 44 M20 68 L34 56 M74 60 L84 78"/>' +
      '<rect class="jv-sten-kant" x="6" y="6" width="88" height="88" rx="14"/>'
  };
  var MAERKER = {
    // Lyn midt på juvelen: lys flade med mørk kant, så det ses på alle farver
    lyn: '<path class="jv-lyn-kant" d="M58 8 L26 56 H46 L38 92 L74 40 H54 L66 8 Z"/><path class="jv-lyn-krop" d="M58 8 L26 56 H46 L38 92 L74 40 H54 L66 8 Z"/>',
    // Is over hele feltet: flade, skrå frost-striber og hjørner
    is: '<rect class="jv-is-flade" x="2" y="2" width="96" height="96" rx="12"/>' +
      '<path class="jv-is-streg" d="M8 30 L30 8 M8 54 L54 8 M46 92 L92 46 M70 92 L92 70"/>' +
      '<path class="jv-is-kant" d="M2 26 V14 A12 12 0 0 1 14 2 H26 M74 2 H86 A12 12 0 0 1 98 14 V26 M98 74 V86 A12 12 0 0 1 86 98 H74 M26 98 H14 A12 12 0 0 1 2 86 V74"/>'
  };
  var IKONER = {
    tilbage: '<path class="ico-fill" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    pause: '<rect class="ico-fill" x="24" y="20" width="18" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="18" height="60" rx="4"/>',
    tip: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>',
    fortryd: '<path class="ico-line" d="M30 30 L70 70 M70 30 L30 70"/><circle class="ico-line" cx="50" cy="50" r="38"/>',
    opgave: '<circle class="ico-line" cx="46" cy="54" r="36"/><circle class="ico-line" cx="46" cy="54" r="18"/><path class="ico-line" d="M46 54 L88 12 M74 12 H88 V26"/>',
    niveau: '<path class="ico-line" d="M10 86 H34 V64 H58 V42 H82 V18"/><path class="ico-line" d="M70 18 H82 V30"/>'
  };
  global.JuvelerTema = { navn: 'neon', juveler: JUVELER, maerker: MAERKER, ikoner: IKONER };
})(typeof window !== 'undefined' ? window : globalThis);
