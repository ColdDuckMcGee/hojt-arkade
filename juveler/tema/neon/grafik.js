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
 *   topas    trekant        ametyst  sekskant      opal     stjerne
 *   Klasser: .jv-krop (fladen, farve --jv-farve), .jv-lys (lys facet), .jv-skygge
 *   (mørk facet), .jv-kant (kontur: --jv-kant, tykkelse --jv-kant-w), .jv-glans (lille glimt).
 *
 * Ikoner: tilbage, pause, tip, fortryd.
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
    opal: juvel('M50 4 L61.5 36 L95 37 L68.5 57.5 L78 90 L50 71 L22 90 L31.5 57.5 L5 37 L38.5 36 Z', 'M50 4 L61.5 36 L50 50 L38.5 36 Z M5 37 L38.5 36 L50 50 L31.5 57.5 Z', 'M68.5 57.5 L78 90 L50 71 L50 50 Z', 'M44 30 L49 16 L50 28 Z')
  };
  var IKONER = {
    tilbage: '<path class="ico-fill" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    pause: '<rect class="ico-fill" x="24" y="20" width="18" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="18" height="60" rx="4"/>',
    tip: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>',
    fortryd: '<path class="ico-line" d="M30 30 L70 70 M70 30 L30 70"/><circle class="ico-line" cx="50" cy="50" r="38"/>'
  };
  global.JuvelerTema = { navn: 'neon', juveler: JUVELER, ikoner: IKONER };
})(typeof window !== 'undefined' ? window : globalThis);
