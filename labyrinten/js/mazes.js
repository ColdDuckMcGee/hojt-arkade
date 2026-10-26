/*
 * Labyrinten – håndlavede labyrinter i én størrelse (15 × 13). Banerne går på omgang,
 * og hver ny bane bliver lidt sværere (flere og klogere vagter, kortere sårbarhed).
 *   #  væg        .  prik (10 point)     o  kraftpille (50 point)
 *   P  spillerens start                  G  vagternes hjem (midten)
 *      (mellemrum) gang uden prik
 * Alle labyrinter er spejlvendt symmetriske og har ingen blindgyder,
 * så vagterne aldrig skal vende om (tjekkes i labyrinten/test/test-logik.js).
 */
(function (global) {
  'use strict';
  global.LabyrintenMazes = [
    { navn: 'Korridorerne', rows: [
      '###############',
      '#o.....#.....o#',
      '#.##.#...#.##.#',
      '#....#.#.#....#',
      '##.#.......#.##',
      '#..#.#.#.#.#..#',
      '#.##.#.G.#.##.#',
      '#....#.#.#....#',
      '#.##.#.#.#.##.#',
      '#.##...P...##.#',
      '#.##.#.#.#.##.#',
      '#o.....#.....o#',
      '###############'
    ] },
    { navn: 'Søjlerne', rows: [
      '###############',
      '#o...........o#',
      '#.##.##.##.##.#',
      '#.#.........#.#',
      '#.#.#.###.#.#.#',
      '#...#..G..#...#',
      '###.#.###.#.###',
      '#.............#',
      '#.##.#.#.#.##.#',
      '#.##.#.P.#.##.#',
      '#.##.#.#.#.##.#',
      '#o.....#.....o#',
      '###############'
    ] },
    { navn: 'Diamanten', rows: [
      '###############',
      '#......#......#',
      '#o#.##.#.##.#o#',
      '#.#....#....#.#',
      '#...##.#.##...#',
      '###....G....###',
      '#...##.#.##...#',
      '#.#....#....#.#',
      '#.#.##.#.##.#.#',
      '#......P......#',
      '#.##.#.#.#.##.#',
      '#o.....#.....o#',
      '###############'
    ] }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
