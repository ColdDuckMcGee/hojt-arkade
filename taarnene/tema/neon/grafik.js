/*
 * Tårnene – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.TaarneneTema. Alt tegnes i et 100 × 100-felt med midten i (50, 50) og
 * farves KUN med klasser og CSS-variabler fra tema.css (ingen farver, streger
 * eller glød her). Tegnelaget (js/tegn.js) lægger dem ind som <symbol>:
 *   #tt-taarn-<navn>, #tt-fjende-<navn>, #tt-ikon-<navn>, #tt-niveau, #tt-indgang, #tt-maal
 *
 * taarne (tårnene, set ovenfra):
 *   laser   enkelt skud på den forreste fjende
 *   puls    rammer alle fjender i rækkevidde
 *   frost   sænker alle fjender i rækkevidde
 *   kanon   tungt skud langt væk, hvert andet trin
 *   Klasser: tt-taarn-fod, tt-taarn-krop, tt-taarn-detalje, tt-taarn-kerne
 *   (farven pr. tårntype kommer fra --tt-s-taarn, som css/taarnene.css sætter)
 * fjender (skal kunne skelnes på FORMEN, ikke kun farven):
 *   kugle   rund (almindelig)        pil     trekant/pil (hurtig)
 *   kasse   firkant med plader (pansret, langsom)
 *   kaempe  stor sekskant med stjerne (boss, koster 3 liv)
 *   Klasser: tt-fjende-krop, tt-fjende-kant, tt-fjende-detalje
 * niveau: ét mærke for tårnets niveau (tegnes 1–3 gange). Klassen tt-niveau.
 * indgang og maal: markeringer, hvor stien starter og slutter (peger mod øst;
 *   tegnelaget drejer dem). Klasser tt-indgang, tt-maal, tt-pil.
 * felt: bunden i et felt, man kan bygge på (klassen tt-felt-bund).
 * ikoner (klasserne ico-line og ico-fill):
 *   boelge, hurtig, trin, pause, tilbage, liv, penge, opgrader, saelg, luk, byg
 */
(function (global) {
  'use strict';
  var TAARNE = {
    laser:
      '<rect class="tt-taarn-fod" x="18" y="18" width="64" height="64" rx="14"/>' +
      '<circle class="tt-taarn-krop" cx="50" cy="50" r="22"/>' +
      '<rect class="tt-taarn-detalje" x="44" y="8" width="12" height="34" rx="4"/>' +
      '<circle class="tt-taarn-kerne" cx="50" cy="50" r="9"/>',
    puls:
      '<rect class="tt-taarn-fod" x="18" y="18" width="64" height="64" rx="14"/>' +
      '<circle class="tt-taarn-krop" cx="50" cy="50" r="24"/>' +
      '<circle class="tt-taarn-detalje" cx="50" cy="50" r="15" fill="none"/>' +
      '<circle class="tt-taarn-kerne" cx="50" cy="50" r="7"/>',
    frost:
      '<rect class="tt-taarn-fod" x="18" y="18" width="64" height="64" rx="14"/>' +
      '<path class="tt-taarn-krop" d="M50 22 L74 50 L50 78 L26 50 Z"/>' +
      '<path class="tt-taarn-detalje" fill="none" d="M50 30 V70 M33 40 L67 60 M33 60 L67 40"/>' +
      '<circle class="tt-taarn-kerne" cx="50" cy="50" r="6"/>',
    kanon:
      '<rect class="tt-taarn-fod" x="14" y="14" width="72" height="72" rx="10"/>' +
      '<path class="tt-taarn-krop" d="M50 24 L73 37 L73 63 L50 76 L27 63 L27 37 Z"/>' +
      '<rect class="tt-taarn-detalje" x="40" y="4" width="20" height="40" rx="5"/>' +
      '<circle class="tt-taarn-kerne" cx="50" cy="52" r="10"/>'
  };
  var FJENDER = {
    kugle:
      '<circle class="tt-fjende-krop" cx="50" cy="50" r="30"/>' +
      '<circle class="tt-fjende-detalje" cx="50" cy="50" r="11"/>',
    // Peger mod øst (gåretningen); tegnelaget drejer den
    pil:
      '<path class="tt-fjende-krop" d="M84 50 L22 20 L36 50 L22 80 Z"/>' +
      '<circle class="tt-fjende-detalje" cx="52" cy="50" r="7"/>',
    kasse:
      '<rect class="tt-fjende-krop" x="20" y="20" width="60" height="60" rx="6"/>' +
      '<path class="tt-fjende-detalje" fill="none" d="M20 40 H80 M20 60 H80 M40 20 V80 M60 20 V80"/>',
    kaempe:
      '<path class="tt-fjende-krop" d="M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z"/>' +
      '<path class="tt-fjende-detalje" d="M50 26 L56 43 L74 43 L60 54 L65 72 L50 61 L35 72 L40 54 L26 43 L44 43 Z"/>'
  };
  var IKONER = {
    // Start bølgen: tre fjender på en pil
    boelge: '<path class="ico-line" d="M12 50 H80"/><path class="ico-fill" d="M92 50 L70 32 V68 Z"/>' +
      '<circle class="ico-fill" cx="22" cy="28" r="9"/><circle class="ico-fill" cx="44" cy="28" r="9"/><circle class="ico-fill" cx="33" cy="74" r="9"/>',
    hurtig: '<path class="ico-fill" d="M10 22 L48 50 L10 78 Z"/><path class="ico-fill" d="M50 22 L88 50 L50 78 Z"/>',
    trin: '<path class="ico-fill" d="M18 20 L62 50 L18 80 Z"/><rect class="ico-fill" x="68" y="20" width="14" height="60" rx="3"/>',
    pause: '<rect x="24" y="20" width="18" height="60" rx="4"/><rect x="58" y="20" width="18" height="60" rx="4"/>',
    tilbage: '<path d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    liv: '<path class="ico-fill" d="M50 86 C20 64 10 48 10 34 A20 20 0 0 1 50 26 A20 20 0 0 1 90 34 C90 48 80 64 50 86 Z"/>',
    penge: '<circle class="ico-line" cx="50" cy="50" r="34"/><path class="ico-line" d="M50 30 V70 M38 40 H58 A8 8 0 0 1 58 52 H42 A8 8 0 0 0 42 64 H62"/>',
    opgrader: '<path class="ico-fill" d="M50 12 L84 48 H62 V86 H38 V48 H16 Z"/>',
    saelg: '<circle class="ico-line" cx="50" cy="56" r="28"/><path class="ico-line" d="M50 6 V40 M36 26 L50 40 L64 26"/>',
    luk: '<path class="ico-line" d="M24 24 L76 76 M76 24 L24 76"/>',
    byg: '<path class="ico-line" d="M50 18 V82 M18 50 H82"/>'
  };
  global.TaarneneTema = {
    navn: 'neon',
    taarne: TAARNE,
    fjender: FJENDER,
    ikoner: IKONER,
    niveau: '<path class="tt-niveau" d="M50 20 L80 50 L50 80 L20 50 Z"/>',
    indgang: '<path class="tt-indgang" d="M14 30 H54 V14 L90 50 L54 86 V70 H14 Z"/>',
    maal: '<rect class="tt-maal" x="16" y="16" width="68" height="68" rx="12"/><path class="tt-pil" d="M30 50 H68 M52 34 L68 50 L52 66"/>',
    felt: '<rect class="tt-felt-bund" x="4" y="4" width="92" height="92"/>'
  };
})(typeof window !== 'undefined' ? window : globalThis);
