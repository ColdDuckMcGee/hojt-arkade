/*
 * Kabalen – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/) leverer et objekt med de samme navne.
 * Alt tegnes i et 100 × 100-felt og farves kun med klasser og CSS-variabler
 * fra tema.css (ingen farver her):
 *   Kulører (kulorer): spar, hjerter, klor, ruder.
 *     .ks-flade  selve symbolet (farve: --ka-sort / --ka-rod)
 *     .ks-ind    indre felt i de røde kulører (farve: --ka-kort-bg). Det gør de røde
 *                symboler "hule" og de sorte "fyldte", så farverne også kan skelnes uden farve.
 *   Bagsidens mærke (bagside): .bg-line og .bg-fill (farver: --ka-bag-line / --ka-bag-fill).
 *   Ikoner (ikoner): tilbage, fortryd, hint, saml, opgiv, pause, vend, traek.
 *     .ico-line streg, .ico-fill flade.
 */
(function (global) {
  'use strict';
  var SPAR = 'M50 6 C62 26 92 40 92 62 C92 76 80 84 68 84 C60 84 55 80 52 75 C53 84 56 90 63 95 H37 C44 90 47 84 48 75 C45 80 40 84 32 84 C20 84 8 76 8 62 C8 40 38 26 50 6 Z';
  var HJERTER = 'M50 92 C34 76 6 60 6 34 C6 18 18 8 31 8 C40 8 47 14 50 22 C53 14 60 8 69 8 C82 8 94 18 94 34 C94 60 66 76 50 92 Z';
  var KLOR = 'M50 9 A19 19 0 0 1 66.5 37.5 A19 19 0 1 1 55 69 C55 80 58 88 65 95 H35 C42 88 45 80 45 69 A19 19 0 1 1 33.5 37.5 A19 19 0 0 1 50 9 Z';
  var RUDER = 'M50 4 Q65 30 88 50 Q65 70 50 96 Q35 70 12 50 Q35 30 50 4 Z';
  var IND = ' transform="translate(50 50) scale(0.56) translate(-50 -50)"';
  var KULORER = {
    spar: '<path class="ks-flade" d="' + SPAR + '"/>',
    hjerter: '<path class="ks-flade" d="' + HJERTER + '"/><path class="ks-ind" d="' + HJERTER + '"' + IND + '/>',
    klor: '<path class="ks-flade" d="' + KLOR + '"/>',
    ruder: '<path class="ks-flade" d="' + RUDER + '"/><path class="ks-ind" d="' + RUDER + '"' + IND + '/>'
  };
  // Bagsidens mærke midt på kortet: en ruder-ramme med et H
  var BAGSIDE = '<path class="bg-line" d="M50 8 L90 50 L50 92 L10 50 Z"/><path class="bg-line" d="M36 32 V68 M64 32 V68 M36 50 H64"/>';
  var IKONER = {
    tilbage: '<path d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    fortryd: '<path class="ico-line" d="M30 40 H62 A20 20 0 0 1 62 80 H40"/><path class="ico-line" d="M42 24 L26 40 L42 56"/>',
    hint: '<path class="ico-line" d="M36 62 C26 54 22 46 22 38 A28 28 0 0 1 78 38 C78 46 74 54 64 62 V70 H36 Z"/><path class="ico-line" d="M40 82 H60"/><path class="ico-line" d="M44 92 H56"/>',
    saml: '<rect class="ico-line" x="24" y="56" width="52" height="34" rx="6"/><path class="ico-line" d="M50 46 V10 M34 26 L50 10 L66 26"/>',
    opgiv: '<path class="ico-line" d="M26 92 V10"/><path class="ico-line" d="M26 14 C42 6 54 22 76 14 V52 C54 60 42 44 26 52"/>',
    pause: '<rect class="ico-fill" x="24" y="20" width="18" height="60" rx="4"/><rect class="ico-fill" x="58" y="20" width="18" height="60" rx="4"/>',
    vend: '<path class="ico-line" d="M78 50 A28 28 0 1 1 64 25.8"/><path class="ico-line" d="M56 12 L68 26 L52 36"/>',
    traek: '<rect class="ico-line" x="18" y="22" width="40" height="56" rx="6"/><path class="ico-line" d="M66 50 H88 M78 40 L88 50 L78 60"/>'
  };
  global.KabaleTema = { navn: 'neon', kulorer: KULORER, bagside: BAGSIDE, ikoner: IKONER };
})(typeof window !== 'undefined' ? window : globalThis);
