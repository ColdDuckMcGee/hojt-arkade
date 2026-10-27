/*
 * Bord 3 – Dybhavet (avanceret).
 * To ramper, tre drop-mål ("Muslinger"), et kickout-hul ("Skattekisten"),
 * vandmands-bumpere, rollover-baner og en ekstra flipper højt oppe til højre.
 * Missioner i rækkefølge, og til sidst tændes jackpotten i Skattekisten.
 */
(function (global) {
  'use strict';
  var G = global.FlipperGame, P = G.PARTS;
  function posts(xs, y0, y1) {
    var out = [];
    xs.forEach(function (x) { out = out.concat(P.wall(x, y0, x, y1, { r: 4, part: 'post' })); });
    return out;
  }
  G.registerTable({
    id: 'dybhavet',
    level: 3,
    name: 'Dybhavet', hyph: 'Dyb\u00ADhavet',
    difficulty: 'Avanceret',
    theme: 'Neonlys på havets bund',
    desc: 'To ramper, muslinger, skattekiste og en ekstra flipper. Missioner og jackpot.',
    palette: {
      board0: '#021a24', board1: '#06324a', wall: '#45e0d0', bumper: '#ff8fd0', sling: '#45e0d0',
      target: '#ffd166', flipper: '#ff8fd0', loop: '#45e0d0',
      ramp: '#8be37a', spinner: '#ffd166', hole: '#ffd166', lane: '#ffd166', drop: '#ff9f5a'
    },
    upper: { x: 522, y: 500, dir: -1, len: 72 },
    parts: [].concat(
      P.frame(),
      // Sløjfer i begge sider; den højre fører ned til den øvre flipper
      P.wall(85, 300, 85, 440, { r: 4 }),
      P.wall(475, 300, 475, 440, { r: 4 }),
      P.slings(),
      posts([210, 270, 330, 390], 92, 126),
      [{ type: 'rollovers', name: 'Baner', xs: [240, 300, 360], y: 110, labels: ['H', 'A', 'V'] }],
      [{ type: 'bumper', x: 215, y: 235, r: 26, name: 'Vandmand' },
       { type: 'bumper', x: 315, y: 215, r: 26, name: 'Vandmand' },
       { type: 'bumper', x: 270, y: 310, r: 26, name: 'Vandmand' }],
      // Venstre rampe: Strømmen – sender kuglen over til højre sløjfe og ned til den øvre flipper
      [{ type: 'ramp', id: 'strommen', name: 'Strømmen',
         walls: [[140, 385, 140, 480], [210, 385, 210, 480], [140, 385, 175, 362], [175, 362, 210, 385]],
         sensor: { x0: 144, x1: 206, y: 410 },
         rail: [[175, 402], [150, 300], [170, 190], [230, 140], [320, 130], [420, 150], [490, 210], [507, 290], [507, 390]],
         speed: 950, exit: 300 }],
      // Højre rampe: Tangskoven – sender kuglen rundt og ned i venstre side
      [{ type: 'ramp', id: 'tang', name: 'Tangskoven',
         walls: [[345, 375, 345, 450], [425, 375, 425, 450], [345, 375, 385, 350], [385, 350, 425, 375]],
         sensor: { x0: 349, x1: 421, y: 400 },
         rail: [[385, 392], [395, 280], [370, 190], [300, 150], [210, 160], [140, 210], [100, 300], [100, 420], [130, 520]],
         speed: 950, exit: 320 }],
      // Muslinger: tre drop-mål midt på bordet
      [{ type: 'drops', id: 'muslinger', name: 'Muslinger', targets: [[215, 545, 265, 532], [268, 531, 318, 518], [321, 517, 371, 504]] }],
      // Skattekisten
      [{ type: 'hole', id: 'skattekiste', name: 'Skattekisten', x: 295, y: 462, r: 18, cap: 1500, hold: 0.9, eject: [120, -600] }],
      [{ type: 'loop', side: 'left', x0: 20, x1: 85, y: 320 }, { type: 'loop', side: 'right', x0: 475, x1: G.LANE_X, y: 320 }]
    ),
    decor: [
      { type: 'bubbles', n: 40, seed: 11 },
      { type: 'kelp', xs: [45, 85, 480, 520], y: 990, h: 230 }
    ],
    missions: {
      list: [
        { event: 'dropBank', count: 1, reward: 5000, text: 'Slå alle muslinger ned', short: 'Muslinger' },
        { event: 'ramp', id: 'strommen', count: 2, reward: 7500, text: 'Kør Strømmen', short: 'Strømmen' },
        { event: 'ramp', id: 'tang', count: 2, reward: 7500, text: 'Kør Tangskoven', short: 'Tangskoven' },
        { event: 'loop', count: 2, reward: 10000, text: 'Kør sløjferne', short: 'Sløjfer' }
      ],
      jackpot: { event: 'hole', id: 'skattekiste', value: 50000, text: 'Jackpot: ram Skattekisten', short: 'Jackpot' }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
