/*
 * Rørlægger – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.RorlaeggerTema. Alt tegnes i et 100 × 100-felt og farves KUN med
 * klasser og CSS-variabler fra tema.css (ingen farver, streger eller glød her).
 *
 * brikker (én pr. brik i grundstilling; tegnelaget drejer dem):
 *   lige    åbning mod nord og syd        knaek  nord og øst
 *   t       nord, øst og syd              kryds  alle fire
 *   kilde   vandkilden, åbning mod nord   afloeb afløbet, åbning mod nord
 * Klasser i brikkerne:
 *   rl-ror-kant  rørets yderkant (kontur)   rl-ror   selve røret
 *   rl-flange    samlingen ved hver åbning  rl-vand  vandet (vises, når feltet er vådt)
 *   rl-kilde, rl-kilde-ikon, rl-afloeb, rl-afloeb-rist  kilde og afløb
 * ikoner (100 × 100, klasserne ico-line og ico-fill):
 *   drej, fortryd, pause, tilbage
 * felt: baggrunden i et felt (klassen rl-felt-bund).
 */
(function (global) {
  'use strict';
  // Rørets midterlinje for hver åbning i grundstillingen
  var LINJER = {
    lige: 'M50 0 V100',
    knaek: 'M50 0 V22 Q50 50 78 50 H100',
    t: 'M50 0 V100 M50 50 H100',
    kryds: 'M50 0 V100 M0 50 H100',
    kilde: 'M50 0 V50',
    afloeb: 'M50 0 V50'
  };
  // Åbninger (til flanger): n, o, s, v
  var AABNINGER = { lige: 'ns', knaek: 'no', t: 'nos', kryds: 'nosv', kilde: 'n', afloeb: 'n' };
  var FLANGE = {
    n: '<rect class="rl-flange" x="28" y="0" width="44" height="9"/>',
    o: '<rect class="rl-flange" x="91" y="28" width="9" height="44"/>',
    s: '<rect class="rl-flange" x="28" y="91" width="44" height="9"/>',
    v: '<rect class="rl-flange" x="0" y="28" width="9" height="44"/>'
  };
  function ror(navn) {
    var d = LINJER[navn], fl = AABNINGER[navn].split('').map(function (k) { return FLANGE[k]; }).join('');
    return '<path class="rl-ror-kant" d="' + d + '"/>' + fl +
      '<path class="rl-ror" d="' + d + '"/>' +
      '<path class="rl-vand" d="' + d + '"/>';
  }
  var BRIKKER = {
    lige: ror('lige'),
    knaek: ror('knaek'),
    t: ror('t'),
    kryds: ror('kryds'),
    // Kilden: en rund tank med en dråbe. Vandet står altid i kilden.
    kilde: ror('kilde') +
      '<circle class="rl-kilde" cx="50" cy="56" r="27"/>' +
      '<path class="rl-kilde-ikon" d="M50 38 C44 48 39 54 39 61 A11 11 0 0 0 61 61 C61 54 56 48 50 38 Z"/>',
    // Afløbet: en rund rist
    afloeb: ror('afloeb') +
      '<circle class="rl-afloeb" cx="50" cy="56" r="27"/>' +
      '<path class="rl-afloeb-rist" d="M36 48 H64 M33 56 H67 M36 64 H64"/>'
  };
  var IKONER = {
    // Drej: en pil en kvart omgang med uret
    drej: '<path class="ico-line" d="M26 58 A26 26 0 1 1 52 84"/><path class="ico-fill" d="M12 52 L40 52 L26 72 Z"/>',
    fortryd: '<path class="ico-line" d="M30 40 H62 A20 20 0 0 1 62 80 H40"/><path class="ico-fill" d="M14 40 L36 22 L36 58 Z"/>',
    pause: '<rect x="24" y="20" width="18" height="60" rx="4"/><rect x="58" y="20" width="18" height="60" rx="4"/>',
    tilbage: '<path d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>'
  };
  global.RorlaeggerTema = {
    navn: 'neon',
    brikker: BRIKKER,
    ikoner: IKONER,
    felt: '<rect class="rl-felt-bund" x="3" y="3" width="94" height="94"/>'
  };
})(typeof window !== 'undefined' ? window : globalThis);
