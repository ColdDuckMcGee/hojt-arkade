/*
 * Kasser – tegnelaget. Læser kun spillets tilstand (view) og lader temaet tegne hver del
 * via navn (tema/<navn>/grafik.js). Her står ingen farver, glød eller stregtykkelser.
 * Intet blinker; den eneste bevægelse er en kort glidning ved træk (kun med animation).
 *
 *   KasserRender.draw(canvas, view, tema, T)
 *   view = { w, h, cell, goal, boxes: [{x, y, i, moving}], player: {x, y, dir}, stuck: [i], preview }
 *   tema = KasserTema.hent('neon'),  T = temaets tokens (læst af app.js)
 */
(function (global) {
  'use strict';

  function draw(canvas, v, tema, T) {
    var c = canvas.getContext('2d'), G = tema.tegn;
    var W = canvas.width, H = canvas.height;
    var S = Math.min(W / v.w, H / v.h), ox = (W - S * v.w) / 2, oy = (H - S * v.h) / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.translate(ox, oy);
    var at = function (x, y) { return x >= 0 && y >= 0 && x < v.w && y < v.h ? v.cell[y * v.w + x] : null; };
    var x, y;

    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) if (at(x, y) === 'floor') G.gulv(c, x * S, y * S, S, T);
    var segs = [];
    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) {
      if (at(x, y) !== 'wall') continue;
      G.mur(c, x * S, y * S, S, T);
      if (at(x, y - 1) === 'floor') segs.push([x * S, y * S, x * S + S, y * S]);
      if (at(x, y + 1) === 'floor') segs.push([x * S, y * S + S, x * S + S, y * S + S]);
      if (at(x - 1, y) === 'floor') segs.push([x * S, y * S, x * S, y * S + S]);
      if (at(x + 1, y) === 'floor') segs.push([x * S + S, y * S, x * S + S, y * S + S]);
    }
    G.murkant(c, segs, S, T);
    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) if (v.goal[y * v.w + x]) G.maal(c, x * S + S / 2, y * S + S / 2, S, T);
    if (v.preview) {
      var pv = v.preview;
      G.forhaandsvisning(c, { x: pv.x * S, y: pv.y * S, ok: pv.ok, dir: pv.dir,
        boxTo: pv.boxTo ? { x: pv.boxTo.x * S, y: pv.boxTo.y * S } : null }, S, T);
    }
    v.boxes.forEach(function (b) {
      G.kasse(c, b.x * S, b.y * S, S, T, {
        paaMaal: !!v.goal[b.i] && !b.moving,
        fast: !!(v.stuck && v.stuck.indexOf(b.i) >= 0 && !b.moving)
      });
    });
    G.spiller(c, v.player.x * S + S / 2, v.player.y * S + S / 2, S, T, v.player.dir);
  }

  // Læser temaets tokens fra CSS: tal bliver til tal, resten (farver) forbliver tekst
  function readTokens(tema, cssVar, font) {
    var T = {};
    Object.keys(tema.tokens).forEach(function (k) {
      var s = cssVar(tema.tokens[k]);
      T[k] = /^-?[\d.]+$/.test(s) ? parseFloat(s) : s;
    });
    var g = parseFloat(cssVar('--glow'));
    T.glod = isNaN(g) ? 0 : Math.max(0, Math.min(1, g));
    T.font = font;
    return T;
  }

  global.KasserRender = { draw: draw, readTokens: readTokens };
})(window);
