/*
 * Rumhandleren – tema "neon": navngivne grafikelementer.
 *
 * Et andet tema (fx tema/ligneclaire/grafik.js) leverer de samme navne og sætter
 * window.RumhandlerenTema. Her står INGEN farver, streger, glød eller skygger: alt
 * farves med klasser og CSS-variabler fra tema.css (--rh-...). Tegnelaget
 * (js/tegn.js) lægger elementerne ind som <symbol> og bruger dem ved navn:
 *   #rh-ikon-<navn>, #rh-vare-<id>, #rh-skib-<type>, #rh-planet-<fraktion>,
 *   #rh-markoer-<navn> og mønstret #rh-rum-moenster.
 *
 * ikoner (100 × 100): klasserne ico-line (streg) og ico-fill (fyld). Se IKONER.
 * varer  (100 × 100): mad, vand, malm, metal, maskiner, medicin, luksus, glimmer –
 *   samme klasser som ikonerne. Varerne kan skelnes på formen, ikke kun farven.
 * skibe  (100 × 100, set fra siden, næsen mod højre): spurv, pelikan, hval –
 *   klasserne rh-skrog, rh-skrog-kant, rh-motor, rh-vindue. Jo større last, jo større skrog.
 * planeter (100 × 100, centrum 50,50, radius ca. 30): vega, orion, kant – én form pr.
 *   fraktion (ring, bånd, krater), så fraktionen ses uden farve. Klasserne
 *   rh-planet-fyld, rh-planet-kant og rh-planet-detalje (fraktionens farve sættes af
 *   tegnelaget med klassen rh-fr-<fraktion> på gruppen).
 * markører (100 × 100): skib (dit flagskib på kortet), ruteskib (skibe på ruter),
 *   valg (ring om den valgte planet), laas (låst planet), begivenhed (nyhed på planeten),
 *   bygning (du ejer bygninger her). Klasser: rh-m-<navn>.
 * rumMoenster: indholdet af et <pattern> (40 × 40) med stjerner og en svag tåge
 *   (rh-stjerne, rh-taage). Et papirtema kan i stedet levere fibre, et lertema fingeraftryk.
 */
(function (global) {
  'use strict';

  var L = function (d) { return '<path class="ico-line" d="' + d + '"/>'; };
  var F = function (d) { return '<path class="ico-fill" d="' + d + '"/>'; };
  var C = function (cx, cy, r, fyld) { return '<circle class="' + (fyld ? 'ico-fill' : 'ico-line') + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; };

  var IKONER = {
    tilbage: L('M44 22 L16 50 L44 78 M18 50 H86'),
    dag: L('M18 26 H82 V84 H18 Z M18 42 H82 M34 14 V30 M66 14 V30') + F('M30 52 h12 v10 h-12 Z M46 52 h12 v10 h-12 Z M62 52 h10 v10 h-10 Z M30 66 h12 v10 h-12 Z'),
    kredit: C(50, 50, 32) + L('M60 36 A16 16 0 1 0 60 64') + F('M44 46 h18 v8 h-18 Z'),
    gaeld: L('M26 18 H66 L80 32 V84 H26 Z M66 18 V32 H80 M38 56 H68'),
    forfald: L('M28 14 H72 M28 86 H72 M32 14 C32 40 68 44 68 50 C68 56 32 60 32 86 M68 14 C68 40 32 44 32 50 C32 56 68 60 68 86') + F('M40 78 L60 78 L50 66 Z'),
    braendstof: L('M50 12 C38 34 26 48 26 62 A24 24 0 0 0 74 62 C74 48 62 34 50 12 Z') + F('M40 64 A10 10 0 0 0 52 74 A14 14 0 0 1 40 64 Z'),
    last: L('M16 34 L50 18 L84 34 V70 L50 86 L16 70 Z M16 34 L50 50 L84 34 M50 50 V86'),
    menu: L('M18 28 H82 M18 50 H82 M18 72 H82'),
    kort: C(22, 30, 8, true) + C(74, 22, 8, true) + C(58, 74, 8, true) + C(24, 76, 6, true) + L('M22 30 L74 22 L58 74 L24 76 L22 30'),
    marked: L('M50 14 V84 M30 84 H70 M14 30 H86 M22 30 L10 58 H34 Z M78 30 L66 58 H90 Z'),
    skibe: L('M14 50 C30 32 62 30 88 50 C62 70 30 68 14 50 Z M14 50 L6 34 M14 50 L6 66') + C(58, 50, 7, true),
    bygninger: L('M10 86 H90 M16 86 V46 L36 58 V46 L56 58 V30 H72 V86 M78 86 V18 H86 V86'),
    kontrakter: L('M24 12 H70 L80 22 V88 H24 Z M34 34 H66 M34 48 H66 M36 70 L46 78 L64 60'),
    oekonomi: L('M12 36 L50 14 L88 36 Z M20 44 V76 M40 44 V76 M60 44 V76 M80 44 V76 M12 86 H88'),
    flyv: L('M14 70 C34 66 46 50 56 30 L84 16 L70 44 C50 54 34 66 30 86 Z M40 60 L28 72') + C(64, 34, 5, true),
    vent: C(50, 52, 34) + L('M50 30 V52 L66 62'),
    forrige: L('M62 18 L30 50 L62 82'),
    naeste: L('M38 18 L70 50 L38 82'),
    koeb: L('M18 44 H82 L74 86 H26 Z M50 10 V36 M38 26 L50 38 L62 26'),
    saelg: L('M18 44 H82 L74 86 H26 Z M50 38 V10 M38 22 L50 10 L62 22'),
    pirat: C(50, 44, 28) + F('M36 38 a7 7 0 1 0 0.1 0 Z M64 38 a7 7 0 1 0 0.1 0 Z') + L('M38 72 V86 M50 72 V88 M62 72 V86 M44 56 L50 50 L56 56'),
    laas: L('M24 46 H76 V86 H24 Z M34 46 V32 A16 16 0 0 1 66 32 V46') + C(50, 64, 5, true),
    forsikring: L('M50 10 L84 22 V48 C84 70 68 82 50 90 C32 82 16 70 16 48 V22 Z M34 50 L46 62 L68 38'),
    rute: C(18, 50, 9, true) + C(82, 50, 9, true) + L('M28 40 C40 18 60 18 72 40 M72 60 C60 82 40 82 28 60 M64 30 L72 40 L82 32 M36 70 L28 60 L18 68'),
    nyrute: C(18, 66, 8, true) + C(82, 66, 8, true) + L('M28 60 C40 40 60 40 72 60 M50 10 V34 M38 22 H62'),
    stop: L('M30 30 H70 V70 H30 Z'),
    flagskib: L('M24 88 V14 M24 16 H76 L64 32 L76 48 H24'),
    mine: L('M14 86 L56 44 M30 24 C48 18 70 26 82 46 M30 24 L62 56') + F('M64 70 L80 86 H48 Z'),
    fabrik: L('M10 86 H90 M16 86 V46 L36 58 V46 L56 58 V46 L76 58 V86 M70 46 V20 H80 V58'),
    lager: L('M12 40 L50 18 L88 40 V86 H12 Z M28 86 V56 H72 V86 M28 66 H72 M28 76 H72'),
    hent: L('M16 44 H84 V86 H16 Z M50 12 V60 M36 46 L50 60 L64 46'),
    betal: C(40, 42, 22) + C(62, 62, 22) + L('M62 52 V72 M52 62 H72'),
    laan: L('M50 14 V86 M14 50 H86') + C(50, 50, 36),
    flygt: L('M10 60 H42 M18 44 H50 M26 76 H54') + L('M48 26 L88 50 L48 74 L58 50 Z'),
    pension: C(50, 50, 16) + L('M50 12 V24 M50 76 V88 M12 50 H24 M76 50 H88 M23 23 L32 32 M68 68 L77 77 M77 23 L68 32 M32 68 L23 77'),
    tilbud: L('M14 30 H66 V86 H14 Z M66 46 L86 34 V70 L66 58 M28 46 H52 M28 60 H52 M28 72 H44'),
    dine: L('M24 12 H76 V88 H24 Z M36 32 H64 M36 48 H64 M36 64 H54') + F('M58 70 L66 78 L82 60 L78 56 L66 70 L62 66 Z'),
    omdoemme: L('M50 12 L61 38 L88 40 L67 58 L74 86 L50 70 L26 86 L33 58 L12 40 L39 38 Z'),
    nyhed: L('M14 24 H76 V82 H22 A8 8 0 0 1 14 74 Z M76 40 H86 V74 A8 8 0 0 1 78 82 M26 38 H64 M26 52 H64 M26 66 H50'),
    ok: L('M18 52 L42 74 L84 28'),
    kryds: L('M24 24 L76 76 M76 24 L24 76')
  };

  var VARER = {
    mad: L('M50 90 V30 M50 34 C40 30 36 22 38 12 C46 16 50 24 50 34 M50 34 C60 30 64 22 62 12 C54 16 50 24 50 34 M50 54 C40 50 34 42 36 32 C44 36 50 44 50 54 M50 54 C60 50 66 42 64 32 C56 36 50 44 50 54 M50 74 C40 70 34 62 36 52 C44 56 50 64 50 74 M50 74 C60 70 66 62 64 52 C56 56 50 64 50 74'),
    vand: L('M50 10 C36 34 22 50 22 64 A28 28 0 0 0 78 64 C78 50 64 34 50 10 Z M36 64 A14 14 0 0 0 50 78'),
    malm: L('M16 70 L28 38 L52 26 L78 36 L88 64 L62 82 L30 82 Z M28 38 L46 52 L52 26 M46 52 L62 82 M46 52 L78 36') ,
    metal: L('M10 66 L26 44 H74 L90 66 Z M26 44 L34 30 H66 L74 44 M10 66 V76 H90 V66'),
    maskiner: C(50, 50, 16) + L('M50 12 V24 M50 76 V88 M12 50 H24 M76 50 H88 M23 23 L32 32 M68 68 L77 77 M77 23 L68 32 M32 68 L23 77') + C(50, 50, 28),
    medicin: L('M38 14 H62 V38 H86 V62 H62 V86 H38 V62 H14 V38 H38 Z'),
    luksus: L('M14 38 L30 18 H70 L86 38 L50 86 Z M14 38 H86 M30 18 L42 38 L50 86 L58 38 L70 18 M42 38 L50 18 L58 38'),
    glimmer: L('M50 8 L58 42 L92 50 L58 58 L50 92 L42 58 L8 50 L42 42 Z') + C(78, 20, 5, true) + C(22, 80, 4, true)
  };

  // Set fra siden, næsen mod højre. Vandret skrog, motorflamme bagved, vinduer.
  var SKIBE = {
    spurv:
      '<path class="rh-motor" d="M20 50 L6 44 L10 50 L6 56 Z"/>' +
      '<path class="rh-skrog" d="M20 40 H60 L84 50 L60 60 H20 Z"/>' +
      '<path class="rh-skrog-kant" d="M20 40 H60 L84 50 L60 60 H20 Z M36 40 L28 28 H40 L48 40 M36 60 L28 72 H40 L48 60"/>' +
      '<circle class="rh-vindue" cx="64" cy="50" r="4"/>',
    pelikan:
      '<path class="rh-motor" d="M16 50 L2 42 L6 50 L2 58 Z"/>' +
      '<path class="rh-skrog" d="M16 34 H68 L90 46 V54 L68 66 H16 Z"/>' +
      '<path class="rh-skrog-kant" d="M16 34 H68 L90 46 V54 L68 66 H16 Z M24 40 H56 V60 H24 Z M40 40 V60 M30 34 L24 24 H40 L46 34 M30 66 L24 76 H40 L46 66"/>' +
      '<circle class="rh-vindue" cx="74" cy="48" r="4"/>',
    hval:
      '<path class="rh-motor" d="M12 42 L0 36 L4 42 L0 48 Z M12 60 L0 54 L4 60 L0 66 Z"/>' +
      '<path class="rh-skrog" d="M12 28 H74 C86 30 96 42 96 51 C96 60 86 72 74 74 H12 Z"/>' +
      '<path class="rh-skrog-kant" d="M12 28 H74 C86 30 96 42 96 51 C96 60 86 72 74 74 H12 Z M20 36 H40 V66 H20 Z M44 36 H64 V66 H44 Z M20 51 H64 M26 28 L20 16 H38 L44 28"/>' +
      '<circle class="rh-vindue" cx="80" cy="46" r="4"/><circle class="rh-vindue" cx="86" cy="56" r="3"/>'
  };

  // Planeter: én form pr. fraktion
  var PLANETER = {
    vega:
      '<circle class="rh-planet-fyld" cx="50" cy="50" r="26"/>' +
      '<path class="rh-planet-detalje" d="M30 40 C42 46 58 46 70 40 M28 56 C42 62 58 62 72 56"/>' +
      '<circle class="rh-planet-kant" cx="50" cy="50" r="26"/>' +
      '<ellipse class="rh-planet-kant" cx="50" cy="50" rx="44" ry="11" transform="rotate(-18 50 50)"/>',
    orion:
      '<circle class="rh-planet-fyld" cx="50" cy="50" r="30"/>' +
      '<path class="rh-planet-detalje" d="M22 38 H78 M20 50 H80 M22 62 H78"/>' +
      '<circle class="rh-planet-kant" cx="50" cy="50" r="30"/>' +
      '<circle class="rh-planet-kant" cx="80" cy="24" r="6"/>',
    kant:
      '<path class="rh-planet-fyld" d="M24 40 L34 22 L56 18 L76 28 L82 50 L74 72 L52 82 L30 76 L18 58 Z"/>' +
      '<circle class="rh-planet-detalje" cx="42" cy="40" r="7"/><circle class="rh-planet-detalje" cx="60" cy="60" r="9"/><circle class="rh-planet-detalje" cx="62" cy="34" r="4"/>' +
      '<path class="rh-planet-kant" d="M24 40 L34 22 L56 18 L76 28 L82 50 L74 72 L52 82 L30 76 L18 58 Z"/>'
  };

  var MARKOERER = {
    skib: '<path class="rh-m-skib" d="M18 30 L86 50 L18 70 L32 50 Z"/>',
    ruteskib: '<path class="rh-m-ruteskib" d="M22 34 L82 50 L22 66 L34 50 Z"/>',
    valg: '<circle class="rh-m-valg" cx="50" cy="50" r="44"/><path class="rh-m-valg" d="M50 0 V14 M50 86 V100 M0 50 H14 M86 50 H100"/>',
    laas: '<path class="rh-m-laas" d="M28 46 H72 V84 H28 Z"/><path class="rh-m-laas-boejle" d="M36 46 V34 A14 14 0 0 1 64 34 V46"/>',
    begivenhed: '<path class="rh-m-begivenhed" d="M50 8 L94 88 H6 Z"/><path class="rh-m-begivenhed-tegn" d="M50 36 V62 M50 72 V76"/>',
    bygning: '<path class="rh-m-bygning" d="M10 90 V40 L36 56 V40 L62 56 V20 H80 V90 Z"/>'
  };

  // Stjernemønster til rummet (40 × 40)
  var RUM_MOENSTER =
    '<circle class="rh-stjerne" cx="4" cy="6" r="0.35"/><circle class="rh-stjerne" cx="17" cy="3" r="0.22"/>' +
    '<circle class="rh-stjerne" cx="29" cy="11" r="0.3"/><circle class="rh-stjerne" cx="37" cy="27" r="0.22"/>' +
    '<circle class="rh-stjerne" cx="9" cy="23" r="0.25"/><circle class="rh-stjerne" cx="22" cy="31" r="0.4"/>' +
    '<circle class="rh-stjerne" cx="33" cy="37" r="0.2"/><circle class="rh-stjerne" cx="13" cy="36" r="0.18"/>' +
    '<circle class="rh-stjerne" cx="25" cy="19" r="0.18"/>';

  global.RumhandlerenTema = {
    navn: 'neon', ikoner: IKONER, varer: VARER, skibe: SKIBE, planeter: PLANETER, markoerer: MARKOERER,
    rumMoenster: { w: 40, h: 40, indhold: RUM_MOENSTER }
  };
})(typeof window !== 'undefined' ? window : globalThis);
