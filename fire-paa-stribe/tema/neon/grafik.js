/* Fire på stribe – tema "neon": navngivne grafikelementer.
 * Et tema leverer de samme navne. Ikonerne tegnes ind i <svg data-ikon="navn">
 * af js/tegn.js. Farver, streger og glød står ikke her, men i tema.css via
 * klasserne (ico-line, ico-fill), så de følger farvetema og glød-indstilling. */
(function (global) {
  'use strict';
  var ikoner = {
    hallen:   { viewBox: '0 0 100 100', indhold: '<path class="ico-hall" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>' },
    pause:    { viewBox: '0 0 100 100', indhold: '<rect class="ico-fill" x="24" y="20" width="18" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="18" height="60" rx="4"/>' },
    fortryd:  { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M30 40 H62 A20 20 0 0 1 62 80 H40"/><path class="ico-line" d="M42 24 L26 40 L42 56"/>' },
    tip:      { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>' },
    venstre:  { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M62 18 L30 50 L62 82"/>' },
    hoejre:   { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M38 18 L70 50 L38 82"/>' },
    slip:     { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M50 12 V66"/><path class="ico-line" d="M28 46 L50 68 L72 46"/><path class="ico-line" d="M24 88 H76"/>' },
    naeste:   { viewBox: '0 0 100 100', indhold: '<path class="ico-line" d="M30 18 L70 50 L30 82 Z"/>' }
  };
  // Brikkerne: indholdet af et hul i brættet. Klasserne styles i tema.css
  // (dig = skive med ring, computer = skive med rombe; formen skal kunne ses uden farve).
  var brikker = {
    hul: '<span class="disc"></span>',
    mini: function (spiller) { return '<span class="mini-disc ' + (spiller === 1 ? 'p1' : 'p2') + '" aria-hidden="true"></span>'; }
  };
  global.FirePaaStribeTema = { navn: 'neon', ikoner: ikoner, brikker: brikker };
})(typeof window !== 'undefined' ? window : globalThis);
