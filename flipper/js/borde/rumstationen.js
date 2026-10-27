/*
 * Bord 2 – Rumstationen (mellem).
 * Tre rollover-baner øverst, tre planet-bumpere, en rampe ("Kredsløbet"),
 * en spinner i venstre sløjfe og et kickout-hul ("Sorte hul").
 * Mission: kør Kredsløbet tre gange (Rampe 0/3) – belønningen vokser for hver runde.
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
    id: 'rumstationen',
    level: 2,
    name: 'Rumstationen', hyph: 'Rum\u00ADstationen',
    difficulty: 'Mellem',
    theme: 'Rumstation i kredsløb om en planet',
    desc: 'Rampe, spinner, sort hul og tre baner øverst. Mission: kør rampen tre gange.',
    palette: {
      board0: '#070a24', board1: '#141a4a', wall: '#7fd6ff', bumper: '#ffb347', sling: '#ff7ad9',
      target: '#c7a6ff', flipper: '#ff7ad9', loop: '#7fd6ff',
      ramp: '#6ff2c8', spinner: '#ffe066', hole: '#b388ff', lane: '#ffe066', drop: '#ffb347'
    },
    parts: [].concat(
      P.frame(),
      // Venstre sløjfe (med spinner) – højre side er rampen
      P.loopLanes(true, false),
      P.wall(475, 300, 475, 470, { r: 4 }),
      P.slings(),
      // Rollover-baner øverst: stolper mellem banerne
      posts([200, 260, 320, 380], 92, 126),
      [{ type: 'rollovers', name: 'Baner', xs: [230, 290, 350], y: 110, labels: ['R', 'U', 'M'] }],
      // Planeter
      [{ type: 'bumper', x: 190, y: 245, r: 30, name: 'Planet' },
       { type: 'bumper', x: 300, y: 215, r: 26, name: 'Måne' },
       { type: 'bumper', x: 250, y: 330, r: 30, name: 'Planet' }],
      // Rampen: indgang (kanal) mellem x 360 og 440 med låg foroven
      [{ type: 'ramp', id: 'kredslob', name: 'Kredsløbet',
         walls: [[355, 342, 355, 455], [440, 312, 440, 455], [355, 342, 475, 300]],
         sensor: { x0: 359, x1: 436, y: 368 },
         rail: [[400, 360], [415, 250], [400, 170], [340, 110], [260, 92], [170, 110], [110, 170], [95, 260], [110, 380], [150, 480], [175, 560]],
         speed: 950, exit: 320 }],
      // Spinner i venstre sløjfe
      [{ type: 'spinner', id: 'solsejl', name: 'Solsejlet', x0: 20, x1: 85, y: 400 }],
      // Sorte hul
      [{ type: 'hole', id: 'sortehul', name: 'Sorte hul', x: 300, y: 470, r: 18, cap: 1200, hold: 0.9, eject: [-160, -620] }],
      [{ type: 'loop', side: 'left', x0: 20, x1: 85, y: 320 }]
    ),
    decor: [
      { type: 'stars', n: 70, seed: 7 },
      { type: 'planet', x: 300, y: 610, r: 42 }
    ],
    missions: {
      list: [{ event: 'ramp', id: 'kredslob', count: 3, reward: 5000, text: 'Kør Kredsløbet', short: 'Rampe' }]
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
