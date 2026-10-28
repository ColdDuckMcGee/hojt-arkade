/*
 * Kaperen – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/tegneserie/grafik.js) leverer de samme navne og sætter
 * window.KaperenTema. Her står INGEN farver, streger, glød eller skygger: alt
 * farves med klasser og CSS-variabler fra tema.css (--kap-...). Tegnelaget
 * (js/tegn.js) lægger elementerne ind som <symbol> og bruger dem ved navn:
 *   #kap-skib-<navn>, #kap-flag-<navn>, #kap-ikon-<navn>, #kap-felt-land,
 *   #kap-felt-top-<n>, #kap-felt-havn, #kap-maal, #kap-kortskib, #kap-plask,
 *   #kap-traef, #kap-roeg, #kap-storm og mønstrene #kap-hav-moenster og #kap-taage-moenster
 *
 * skibe (set fra siden, stævnen mod højre, 100 × 100, vandlinjen ved y = 80):
 *   slup, brig, fregat, galeon  – klasser kap-skrog, kap-skrog-kant, kap-mast,
 *   kap-sejl, kap-kanonport. `flagPunkt` angiver, hvor flaget sidder (toppen af masten).
 * flag (40 × 26): spiller, handel, pirat, marine – klasser kap-flag-dug, kap-flag-tegn.
 *   Flagene kan skelnes på tegnet, ikke kun på farven.
 * felter (havfelterne set oppefra, 100 × 100):
 *   land – et helt landfelt (må strækkes en anelse): kap-felt-land-flade.
 *   top  – liste med pynt, der står på nogle landfelter (palme, bjerg, skov): kap-felt-top-streg, kap-felt-top-fyld.
 *   havn – en havn i et vandfelt (mole, hus og fyr): kap-havn-mole, kap-havn-hus, kap-havn-lys.
 *   Kystlinjen tegnes af tegnelaget (klassen kap-kyst), tågen af taage-mønstret.
 * taage: indholdet af et <pattern> (40 × 40) med tågeskyer og slør over det ukendte hav
 *   (kap-taage-sky, kap-taage-sloer).
 * maal (100 × 100): ring om den valgte havn på kortet – kap-maal-ring.
 * kortskib (40 × 40, set oppefra, peger mod højre): kap-kortskib-krop, kap-kortskib-sejl.
 *   Bruges til alle skibe på havet; skibets slags vises med flaget ved siden af.
 * effekter (40 × 40): plask (vandsøjle ved forbier), traef (træf), roeg (krudtrøg),
 *   storm (100 × 60: sky, regn og et fast lyn – intet blinker).
 * havMoenster: indholdet af et <pattern> (60 × 30) med bølger til havet (klassen kap-hav-boelge).
 * ikoner (100 × 100, klasserne ico-line og ico-fill): se IKONER nederst.
 */
(function (global) {
  'use strict';

  var SKIBE = {
    slup:
      '<path class="kap-mast" d="M50 70 V12"/>' +
      '<path class="kap-sejl" d="M53 16 L53 62 L84 62 Z"/>' +
      '<path class="kap-sejl" d="M47 20 L47 62 L22 62 Z"/>' +
      '<path class="kap-skrog" d="M8 64 H92 L82 80 H20 Z"/>' +
      '<path class="kap-skrog-kant" d="M14 70 H86"/>' +
      '<rect class="kap-kanonport" x="40" y="72" width="6" height="4"/><rect class="kap-kanonport" x="58" y="72" width="6" height="4"/>',
    brig:
      '<path class="kap-mast" d="M36 66 V10 M66 66 V14"/>' +
      '<path class="kap-sejl" d="M22 16 H50 L48 34 H24 Z M20 38 H52 L50 58 H22 Z"/>' +
      '<path class="kap-sejl" d="M54 20 H78 L76 36 H56 Z M52 40 H80 L78 58 H54 Z"/>' +
      '<path class="kap-sejl" d="M70 22 L96 60 H70 Z"/>' +
      '<path class="kap-skrog" d="M4 62 H96 L86 82 H14 Z"/>' +
      '<path class="kap-skrog-kant" d="M10 68 H90"/>' +
      '<rect class="kap-kanonport" x="22" y="72" width="6" height="4"/><rect class="kap-kanonport" x="38" y="72" width="6" height="4"/>' +
      '<rect class="kap-kanonport" x="54" y="72" width="6" height="4"/><rect class="kap-kanonport" x="70" y="72" width="6" height="4"/>',
    fregat:
      '<path class="kap-mast" d="M26 64 V12 M52 64 V6 M76 64 V14"/>' +
      '<path class="kap-sejl" d="M14 18 H38 L36 34 H16 Z M12 38 H40 L38 56 H14 Z"/>' +
      '<path class="kap-sejl" d="M38 12 H66 L64 30 H40 Z M36 34 H68 L66 56 H38 Z"/>' +
      '<path class="kap-sejl" d="M66 20 H86 L84 36 H68 Z M64 40 H88 L86 56 H66 Z"/>' +
      '<path class="kap-skrog" d="M2 60 H98 L88 84 H12 Z"/>' +
      '<path class="kap-skrog-kant" d="M8 66 H92 M10 74 H90"/>' +
      '<rect class="kap-kanonport" x="16" y="67" width="5" height="4"/><rect class="kap-kanonport" x="30" y="67" width="5" height="4"/>' +
      '<rect class="kap-kanonport" x="44" y="67" width="5" height="4"/><rect class="kap-kanonport" x="58" y="67" width="5" height="4"/>' +
      '<rect class="kap-kanonport" x="72" y="67" width="5" height="4"/><rect class="kap-kanonport" x="84" y="67" width="5" height="4"/>',
    galeon:
      '<path class="kap-mast" d="M30 60 V8 M58 60 V4 M82 60 V18"/>' +
      '<path class="kap-sejl" d="M16 14 H44 L42 32 H18 Z M14 36 H46 L44 54 H16 Z"/>' +
      '<path class="kap-sejl" d="M44 10 H72 L70 28 H46 Z M42 32 H74 L72 54 H44 Z"/>' +
      '<path class="kap-sejl" d="M82 22 L98 54 H82 Z"/>' +
      '<path class="kap-skrog" d="M2 50 H24 V58 H98 L88 84 H12 L2 66 Z"/>' +
      '<path class="kap-skrog-kant" d="M4 60 H24 M8 68 H92 M10 76 H90"/>' +
      '<rect class="kap-kanonport" x="20" y="70" width="5" height="4"/><rect class="kap-kanonport" x="34" y="70" width="5" height="4"/>' +
      '<rect class="kap-kanonport" x="48" y="70" width="5" height="4"/><rect class="kap-kanonport" x="62" y="70" width="5" height="4"/>' +
      '<rect class="kap-kanonport" x="76" y="70" width="5" height="4"/>'
  };
  var FLAGPUNKT = { slup: [50, 12], brig: [36, 10], fregat: [52, 6], galeon: [58, 4] };

  var FLAG = {
    // Spilleren: kryds-sværd
    spiller: '<rect class="kap-flag-dug" x="1" y="1" width="38" height="24"/><path class="kap-flag-tegn" fill="none" d="M10 6 L30 20 M30 6 L10 20"/>',
    // Handelsskib: vandrette striber
    handel: '<rect class="kap-flag-dug" x="1" y="1" width="38" height="24"/><path class="kap-flag-tegn" fill="none" d="M1 9 H39 M1 17 H39"/>',
    // Sørøver: kranie
    pirat: '<rect class="kap-flag-dug" x="1" y="1" width="38" height="24"/><circle class="kap-flag-tegn" cx="20" cy="11" r="6"/>' +
      '<path class="kap-flag-tegn" fill="none" d="M12 18 L28 23 M28 18 L12 23"/>',
    // Marinen: krone
    marine: '<rect class="kap-flag-dug" x="1" y="1" width="38" height="24"/><path class="kap-flag-tegn" d="M10 19 L10 8 L15 13 L20 6 L25 13 L30 8 L30 19 Z"/>'
  };

  var FELTER = {
    land: '<rect class="kap-felt-land-flade" x="0" y="0" width="100" height="100"/>',
    top: [
      // Palme
      '<path class="kap-felt-top-streg" d="M50 88 C52 70 52 52 48 36 M48 36 C38 26 24 28 16 36 M48 36 C56 24 72 22 84 30 M48 36 C46 24 50 14 60 10 M48 36 C36 34 30 44 28 52"/>',
      // Bjerg
      '<path class="kap-felt-top-fyld" d="M10 84 L40 30 L54 52 L64 40 L90 84 Z"/><path class="kap-felt-top-streg" d="M32 44 L40 30 L48 44"/>',
      // Skov
      '<path class="kap-felt-top-fyld" d="M18 80 L32 40 L46 80 Z M46 82 L62 30 L78 82 Z"/><path class="kap-felt-top-streg" d="M32 80 V90 M62 82 V92"/>'
    ],
    havn: '<path class="kap-havn-mole" d="M8 74 H70 V86 H8 Z M70 86 V28 H84 V86 Z"/>' +
      '<path class="kap-havn-hus" d="M16 70 V42 L32 28 L48 42 V70 Z"/><path class="kap-havn-hus" d="M50 70 V50 L60 42 L70 50 V70 Z"/>' +
      '<circle class="kap-havn-lys" cx="77" cy="18" r="9"/>'
  };
  var TAAGE = '<ellipse class="kap-taage-sky" cx="14" cy="10" rx="13" ry="6"/><ellipse class="kap-taage-sky" cx="34" cy="30" rx="12" ry="5"/>' +
    '<path class="kap-taage-sloer" d="M3 22 Q12 19 21 22 M24 6 H37 M6 36 Q12 34 18 36"/>';
  var MAAL = '<circle class="kap-maal-ring" cx="50" cy="50" r="36"/><path class="kap-maal-ring" d="M50 2 V18 M50 82 V98 M2 50 H18 M82 50 H98"/>';

  var KORTSKIB = '<path class="kap-kortskib-krop" d="M4 20 C10 10 28 10 38 20 C28 30 10 30 4 20 Z"/>' +
    '<path class="kap-kortskib-sejl" d="M18 8 V32 M18 8 C26 12 26 28 18 32"/>';
  var EFFEKTER = {
    plask: '<path class="kap-plask" d="M8 36 C10 24 14 18 14 10 C16 18 18 22 20 6 C22 22 24 18 26 10 C26 18 30 24 32 36 Z"/>',
    traef: '<path class="kap-traef" d="M20 2 L24 14 L36 10 L28 20 L38 28 L24 26 L20 38 L16 26 L2 28 L12 20 L4 10 L16 14 Z"/>',
    roeg: '<circle class="kap-roeg" cx="12" cy="24" r="9"/><circle class="kap-roeg" cx="24" cy="18" r="11"/><circle class="kap-roeg" cx="30" cy="28" r="8"/>',
    storm: '<path class="kap-storm-sky" d="M10 30 C4 30 2 18 12 16 C14 6 30 4 36 12 C42 2 62 4 64 16 C76 12 90 18 86 30 Z"/>' +
      '<path class="kap-storm-regn" d="M20 36 L14 56 M36 36 L30 56 M66 36 L60 56 M82 36 L76 56"/>' +
      '<path class="kap-storm-lyn" d="M50 32 L42 46 H50 L44 60 L58 42 H50 L56 32 Z"/>'
  };
  var HAV_MOENSTER = '<path class="kap-hav-boelge" d="M0 15 Q7.5 9 15 15 T30 15 M30 15 Q37.5 9 45 15 T60 15"/>';

  var IKONER = {
    rom: '<path class="ico-line" d="M40 10 H60 M44 10 V30 C30 36 28 46 28 56 V84 C28 88 32 90 36 90 H64 C68 90 72 88 72 84 V56 C72 46 70 36 56 30 V10"/><path class="ico-fill" d="M34 58 H66 V78 H34 Z"/>',
    sukker: '<path class="ico-line" d="M22 40 C22 30 78 30 78 40 L72 86 H28 Z"/><path class="ico-line" d="M30 40 C40 46 60 46 70 40"/><path class="ico-fill" d="M38 14 h10 v10 h-10z M54 18 h10 v10 h-10z"/>',
    krydderier: '<path class="ico-line" d="M18 56 H82 C82 76 68 88 50 88 C32 88 18 76 18 56 Z"/><path class="ico-fill" d="M30 56 C34 40 44 34 50 34 C56 34 66 40 70 56 Z"/><path class="ico-line" d="M60 14 L48 34"/>',
    tobak: '<path class="ico-fill" d="M50 88 C20 70 18 36 50 10 C82 36 80 70 50 88 Z"/><path class="ico-line ico-paa-fyld" d="M50 20 V80 M50 40 L36 30 M50 52 L66 40 M50 64 L36 56"/>',
    silke: '<path class="ico-line" d="M14 30 C30 18 46 42 62 30 C72 22 82 24 86 30 V70 C82 64 72 62 62 70 C46 82 30 58 14 70 Z"/><path class="ico-line" d="M30 46 C40 52 56 48 70 46"/>',
    guld: '<circle class="ico-line" cx="50" cy="50" r="34"/><circle class="ico-line" cx="50" cy="50" r="20"/>',
    skrog: '<path class="ico-line" d="M10 46 H90 L78 76 H22 Z"/><path class="ico-line" d="M50 46 V14 L74 40 H50"/>',
    kanon: '<path class="ico-fill" d="M14 40 L72 30 L76 52 L18 62 Z"/><circle class="ico-line" cx="38" cy="66" r="14"/><path class="ico-line" d="M76 40 H90"/>',
    mandskab: '<circle class="ico-fill" cx="36" cy="32" r="12"/><circle class="ico-fill" cx="66" cy="36" r="10"/><path class="ico-fill" d="M14 84 C14 60 26 50 36 50 C46 50 58 60 58 84 Z M60 84 C60 66 64 56 66 56 C76 56 88 64 88 84 Z"/>',
    proviant: '<path class="ico-line" d="M22 30 H78 V86 H22 Z M22 52 H78"/><path class="ico-fill" d="M40 12 H60 L64 30 H36 Z"/>',
    last: '<path class="ico-line" d="M14 34 L50 16 L86 34 V70 L50 88 L14 70 Z M14 34 L50 52 L86 34 M50 52 V88"/>',
    beroemmelse: '<path class="ico-fill" d="M50 8 L61 36 L92 38 L68 58 L76 88 L50 72 L24 88 L32 58 L8 38 L39 36 Z"/>',
    dag: '<circle class="ico-fill" cx="50" cy="50" r="18"/><path class="ico-line" d="M50 8 V20 M50 80 V92 M8 50 H20 M80 50 H92 M20 20 L28 28 M72 72 L80 80 M80 20 L72 28 M28 72 L20 80"/>',
    sejl: '<path class="ico-line" d="M36 10 V88"/><path class="ico-fill" d="M42 14 C70 28 76 54 68 76 H42 Z"/><path class="ico-line" d="M10 88 H90"/>',
    lastrum: '<path class="ico-line" d="M12 30 H88 V86 H12 Z M12 50 H88 M32 30 V86 M68 30 V86"/><path class="ico-fill" d="M42 8 H58 V22 H70 L50 30 L30 22 H42 Z"/>',
    nytskib: '<path class="ico-line" d="M8 60 H80 L70 82 H18 Z M40 60 V20 L66 52 H40"/><path class="ico-line" d="M82 14 V38 M70 26 H94"/>',
    reparer: '<path class="ico-line" d="M20 80 L56 44"/><path class="ico-fill" d="M52 22 C58 10 76 8 84 16 L70 28 L74 36 L84 40 L90 30 C94 44 82 56 66 50 Z"/><path class="ico-fill" d="M12 74 L26 88 L32 82 L18 68 Z"/>',
    skyd: '<path class="ico-fill" d="M8 46 L56 38 L60 58 L12 64 Z"/><path class="ico-line" d="M66 44 L80 40 M66 52 L86 52 M66 60 L80 64"/><circle class="ico-fill" cx="92" cy="52" r="6"/>',
    naermere: '<path class="ico-fill" d="M8 50 L40 24 V40 H62 V60 H40 V76 Z"/><path class="ico-line" d="M76 22 V78 M90 22 V78"/>',
    bord: '<path class="ico-line" d="M18 82 L78 22 M60 22 H78 V40"/><path class="ico-line" d="M82 82 L22 22 M40 22 H22 V40"/>',
    flygt: '<path class="ico-fill" d="M92 50 L58 22 V38 H22 V62 H58 V78 Z"/><path class="ico-line" d="M8 38 H14 M4 50 H14 M8 62 H14"/>',
    videre: '<path class="ico-line" d="M10 70 C30 60 50 60 64 50"/><path class="ico-fill" d="M90 40 L60 34 L70 62 Z"/><path class="ico-line" d="M10 84 H90"/>',
    kort: '<path class="ico-line" d="M10 22 L36 12 L64 22 L90 12 V78 L64 88 L36 78 L10 88 Z M36 12 V78 M64 22 V88"/>',
    marked: '<path class="ico-line" d="M14 40 H86 L80 86 H20 Z"/><path class="ico-line" d="M34 40 C34 18 66 18 66 40"/>',
    vaerft: '<path class="ico-line" d="M12 86 H88 M24 86 V40 L50 20 L76 40 V86"/><path class="ico-fill" d="M36 60 H64 L60 72 H40 Z"/>',
    vaerthus: '<path class="ico-line" d="M24 26 H66 V84 C66 88 62 90 58 90 H32 C28 90 24 88 24 84 Z M66 40 H78 C84 40 86 44 86 50 V60 C86 66 84 70 78 70 H66"/><path class="ico-fill" d="M28 30 H62 V44 H28 Z"/>',
    anker: '<circle class="ico-line" cx="50" cy="18" r="8"/><path class="ico-line" d="M50 26 V88 M32 40 H68 M16 62 C18 80 34 88 50 88 C66 88 82 80 84 62"/>',
    menu: '<path class="ico-line" d="M18 26 H82 M18 50 H82 M18 74 H82"/>',
    tilbage: '<path class="ico-fill" d="M44 22 L14 50 L44 78 V60 H86 V40 H44 Z"/>',
    rygte: '<path class="ico-line" d="M14 20 H86 V66 H44 L24 84 V66 H14 Z"/><path class="ico-line" d="M30 38 H70 M30 50 H58"/>',
    land: '<path class="ico-line" d="M10 80 C30 70 70 70 90 80"/><path class="ico-fill" d="M40 66 V30 H66 L58 40 L66 50 H44 V66 Z"/>',
    storm: '<path class="ico-line" d="M18 50 C8 50 8 32 20 32 C24 16 46 14 52 26 C60 18 82 22 80 38 C92 40 90 56 78 56 H24"/><path class="ico-fill" d="M50 56 L38 76 H50 L42 94 L64 70 H52 L60 56 Z"/>',
    pil: '<path class="ico-fill" d="M50 6 L88 48 H62 V94 H38 V48 H12 Z"/>',
    vent: '<path class="ico-line" d="M24 10 H76 M24 90 H76 M30 10 C30 40 70 50 70 90 M70 10 C70 40 30 50 30 90"/><path class="ico-fill" d="M38 80 H62 L50 66 Z"/>',
    kikkert: '<path class="ico-fill" d="M8 60 L64 30 L74 48 L18 78 Z"/><path class="ico-line" d="M72 24 L88 54 M40 70 L30 94 M46 66 L62 94"/>',
    kurs: '<path class="ico-line" d="M14 84 C26 58 44 70 54 46 C62 28 72 22 84 18"/><circle class="ico-fill" cx="84" cy="18" r="10"/><circle class="ico-fill" cx="14" cy="84" r="8"/>',
    stop: '<rect class="ico-fill" x="20" y="20" width="60" height="60" rx="8"/>',
    laa: '<path class="ico-line" d="M8 70 C30 40 70 40 92 70"/><path class="ico-fill" d="M30 76 H70 L64 88 H36 Z"/><path class="ico-line" d="M50 76 V56"/>'
  };

  global.KaperenTema = {
    navn: 'neon',
    skibe: SKIBE, flagPunkt: FLAGPUNKT, flag: FLAG,
    felter: FELTER, taage: TAAGE, maal: MAAL,
    kortskib: KORTSKIB, effekter: EFFEKTER, havMoenster: HAV_MOENSTER,
    ikoner: IKONER
  };
})(typeof window !== 'undefined' ? window : globalThis);
