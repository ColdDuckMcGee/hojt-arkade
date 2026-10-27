/*
 * Bord 1 – Neonbyen (begynder).
 * Det oprindelige, enkle bord: tre bumpere, fem lysmål, to sløjfer og to slynger.
 * Tænd alle fem lys for at hæve bonussen (op til ×5).
 */
(function (global) {
  'use strict';
  var G = global.FlipperGame, P = G.PARTS;
  G.registerTable({
    id: 'neonbyen',
    level: 1,
    name: 'Neonbyen', hyph: 'Neon\u00ADbyen',
    difficulty: 'Begynder',
    theme: 'Natteby med neonskilte',
    desc: 'Tre bumpere, fem lys og to sløjfer. Enkelt og roligt.',
    // Farver (CSS-variabler --fl-*), samme som før
    palette: null,
    parts: [].concat(
      P.frame(),
      P.loopLanes(),
      P.slings(),
      [{ type: 'lights', name: 'Lys', xs: [180, 230, 280, 330, 380], y: 165 }],
      [{ type: 'bumper', x: 200, y: 300, name: 'Bumper' }, { type: 'bumper', x: 360, y: 300, name: 'Bumper' }, { type: 'bumper', x: 280, y: 410, name: 'Bumper' }],
      [{ type: 'loop', side: 'left', x0: 20, x1: 85, y: 320 }, { type: 'loop', side: 'right', x0: 475, x1: G.LANE_X, y: 320 }]
    ),
    // Pynt (tegnes bag spillet, påvirker ikke kuglen): en skyline nederst
    decor: [
      { type: 'skyline', y: 560, x0: 160, x1: 400, seed: 3 }
    ],
    missions: null
  });
})(typeof window !== 'undefined' ? window : globalThis);
