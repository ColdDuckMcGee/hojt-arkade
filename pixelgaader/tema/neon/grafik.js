/*
 * Pixelgåder – tema "neon": navngivne grafikelementer.
 *
 * Et tema leverer de samme navne. Ikonerne tegnes i et 100 × 100-felt og farves
 * kun med klasser og CSS-variabler fra tema.css (ingen farver her):
 *   .ico-line  streg (farve: --ico-line, tykkelse: --pg-stroke-ico)
 *   .ico-fill  flade (farve: --ico-fill)
 * Navne: udfyld, kryds, visk, tip, liv, pause, tilbage.
 *
 * pixelbillede(sol, n) tegner et løst motiv (bruges ved "Gåde løst" og game over);
 * felterne får klassen pic-px og farven --pg-fill.
 */
(function (global) {
  'use strict';
  var IKONER = {
    udfyld: '<rect x="18" y="18" width="64" height="64" rx="8" class="ico-fill"/>',
    kryds: '<path class="ico-line" d="M24 24 L76 76 M76 24 L24 76"/>',
    visk: '<path class="ico-line" d="M30 78 H82"/><path class="ico-line" d="M18 60 L52 26 L78 52 L52 78 H36 Z"/><path class="ico-line" d="M36 42 L62 68"/>',
    tip: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>',
    liv: '<path d="M50 86 L16 52 A20 20 0 0 1 50 22 A20 20 0 0 1 84 52 Z"/>',
    pause: '<rect x="24" y="20" width="18" height="60" rx="4"/><rect x="58" y="20" width="18" height="60" rx="4"/>',
    tilbage: '<path d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>'
  };
  function pixelbillede(sol, n, rx) {
    var r = [];
    for (var i = 0; i < sol.length; i++) if (sol[i]) r.push('<rect class="pic-px" x="' + (i % n) + '" y="' + Math.floor(i / n) + '" width="1.02" height="1.02"/>');
    return '<svg viewBox="-0.5 -0.5 ' + (n + 1) + ' ' + (n + 1) + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect class="pic-bg" x="-0.4" y="-0.4" width="' + (n + 0.8) + '" height="' + (n + 0.8) + '" rx="' + rx + '"/>' + r.join('') + '</svg>';
  }
  global.PixelgaaderTema = {
    navn: 'neon',
    ikoner: IKONER,
    pixelbillede: pixelbillede
  };
})(typeof window !== 'undefined' ? window : globalThis);
