/*
 * Sudoku – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/) leverer et objekt med de samme navne.
 * Ikonerne tegnes i et 100 × 100-felt og farves kun med klasser og
 * CSS-variabler fra tema.css (ingen farver her):
 *   .ico-line  streg (farve: --ico-line, tykkelse: --su-stroke-ico)
 *   .ico-fill  flade (farve: --ico-fill)
 * Navne: liv, pause, tilbage, visk, noter, fortryd, tip, oversigt.
 */
(function (global) {
  'use strict';
  var IKONER = {
    liv: '<path d="M50 86 L16 52 A20 20 0 0 1 50 22 A20 20 0 0 1 84 52 Z"/>',
    pause: '<rect x="24" y="20" width="18" height="60" rx="4"/><rect x="58" y="20" width="18" height="60" rx="4"/>',
    tilbage: '<path d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    visk: '<path class="ico-line" d="M30 80 H84"/><path class="ico-line" d="M16 60 L50 26 L78 54 L54 78 H36 Z"/><path class="ico-line" d="M34 42 L62 70"/>',
    noter: '<path class="ico-line" d="M22 78 L28 58 L66 20 L80 34 L42 72 Z"/><path class="ico-line" d="M58 28 L72 42"/><path class="ico-line" d="M22 78 L36 74"/>',
    fortryd: '<path class="ico-line" d="M30 40 H62 A20 20 0 0 1 62 80 H40"/><path class="ico-line" d="M42 24 L26 40 L42 56"/>',
    tip: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>',
    oversigt: '<rect class="ico-line" x="16" y="16" width="68" height="68" rx="4"/><path class="ico-line" d="M38.7 16 V84 M61.3 16 V84 M16 38.7 H84 M16 61.3 H84"/>'
  };
  global.SudokuTema = { navn: 'neon', ikoner: IKONER };
})(typeof window !== 'undefined' ? window : globalThis);
