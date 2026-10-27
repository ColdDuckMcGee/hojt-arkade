/*
 * Kasser – tegner lageret på et <canvas>. Farverne kommer fra temaets CSS-variabler
 * (css/kasser.css). Intet blinker: alt tegnes stille. Den eneste bevægelse er en kort,
 * rolig glidning, når man går eller skubber (kun når animation er slået til).
 *
 *   KasserRender.draw(canvas, view, colors)
 *   view = { w, h, cell, goal, boxes: [{x, y, i}], player: {x, y, dir}, stuck: [i], preview, done }
 */
(function (global) {
  'use strict';
  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  function glow(c, colors, color, blur) { if (colors.glow) { c.shadowColor = color; c.shadowBlur = blur; } }
  function noGlow(c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }

  function draw(canvas, v, colors) {
    var c = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var S = Math.min(W / v.w, H / v.h), ox = (W - S * v.w) / 2, oy = (H - S * v.h) / 2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.translate(ox, oy);
    var lw = Math.max(1.5, S * 0.045);

    // Gulv
    for (var y = 0; y < v.h; y++) for (var x = 0; x < v.w; x++) {
      var i = y * v.w + x;
      if (v.cell[i] !== 'floor') continue;
      c.fillStyle = colors.floor;
      c.fillRect(x * S, y * S, S, S);
      c.strokeStyle = colors.floorLine; c.lineWidth = Math.max(1, S * 0.02);
      c.strokeRect(x * S + S * 0.04, y * S + S * 0.04, S * 0.92, S * 0.92);
    }
    // Mure: en samlet glasmasse; neonkanten følger kun grænsen ind mod gulvet
    var isWall = function (x, y) { return x >= 0 && y >= 0 && x < v.w && y < v.h && v.cell[y * v.w + x] === 'wall'; };
    var isFloor = function (x, y) { return x >= 0 && y >= 0 && x < v.w && y < v.h && v.cell[y * v.w + x] === 'floor'; };
    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) {
      if (!isWall(x, y)) continue;
      c.fillStyle = colors.wallFill;
      c.fillRect(x * S, y * S, S, S);
      // svage diagonale striber som glas
      c.save(); c.beginPath(); c.rect(x * S, y * S, S, S); c.clip();
      c.strokeStyle = colors.wallShine; c.lineWidth = Math.max(1, S * 0.025);
      c.beginPath();
      for (var t = -1; t <= 1; t += 0.5) { c.moveTo(x * S + (t) * S, y * S + S); c.lineTo(x * S + (t + 1) * S, y * S); }
      c.stroke(); c.restore();
    }
    c.beginPath();
    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) {
      if (!isWall(x, y)) continue;
      if (isFloor(x, y - 1)) { c.moveTo(x * S, y * S); c.lineTo(x * S + S, y * S); }
      if (isFloor(x, y + 1)) { c.moveTo(x * S, y * S + S); c.lineTo(x * S + S, y * S + S); }
      if (isFloor(x - 1, y)) { c.moveTo(x * S, y * S); c.lineTo(x * S, y * S + S); }
      if (isFloor(x + 1, y)) { c.moveTo(x * S + S, y * S); c.lineTo(x * S + S, y * S + S); }
    }
    glow(c, colors, colors.wall, S * 0.3);
    c.strokeStyle = colors.wall; c.lineWidth = lw * 1.3; c.lineCap = 'round'; c.stroke();
    noGlow(c); c.lineCap = 'butt';
    // Mål: en lysende ruderamme
    for (y = 0; y < v.h; y++) for (x = 0; x < v.w; x++) {
      i = y * v.w + x;
      if (!v.goal[i]) continue;
      var cx = x * S + S / 2, cy = y * S + S / 2, r = S * 0.3;
      c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath();
      c.fillStyle = colors.goalFill; c.fill();
      glow(c, colors, colors.goal, S * 0.3);
      c.strokeStyle = colors.goal; c.lineWidth = lw * 1.2; c.stroke();
      noGlow(c);
    }
    // Forhåndsvisning (blik eller mus på en pil): målfeltet markeres
    if (v.preview) {
      var pv = v.preview, px = pv.x * S, py = pv.y * S;
      c.setLineDash([S * 0.12, S * 0.1]);
      c.strokeStyle = pv.ok ? colors.preview : colors.stuck; c.lineWidth = lw * 1.3;
      rr(c, px + S * 0.08, py + S * 0.08, S * 0.84, S * 0.84, S * 0.16); c.stroke();
      c.setLineDash([]);
      if (pv.boxTo) {
        var bx2 = pv.boxTo.x * S + S / 2, by2 = pv.boxTo.y * S + S / 2;
        c.fillStyle = pv.ok ? colors.preview : colors.stuck;
        c.save(); c.translate(bx2, by2); c.rotate(ANG[pv.dir]);
        c.globalAlpha = 0.7;
        c.beginPath(); c.moveTo(S * 0.22, 0); c.lineTo(-S * 0.14, -S * 0.2); c.lineTo(-S * 0.14, S * 0.2); c.closePath(); c.fill();
        c.restore();
      }
    }
    // Kasser
    v.boxes.forEach(function (b) {
      var onGoal = !!v.goal[b.i] && !b.moving, stuck = v.stuck && v.stuck.indexOf(b.i) >= 0 && !b.moving;
      var x0 = b.x * S, y0 = b.y * S, m = S * 0.12, s = S - 2 * m;
      var edge = stuck ? colors.stuck : onGoal ? colors.boxDone : colors.box;
      rr(c, x0 + m, y0 + m, s, s, S * 0.1);
      c.fillStyle = onGoal ? colors.boxDoneFill : colors.boxFill; c.fill();
      glow(c, colors, edge, S * 0.3);
      c.strokeStyle = edge; c.lineWidth = lw * 1.4; c.stroke();
      noGlow(c);
      // indre ramme og kryds som en lagerkasse
      var k = S * 0.1;
      c.strokeStyle = edge; c.lineWidth = lw * 0.8; c.globalAlpha = 0.75;
      c.strokeRect(x0 + m + k, y0 + m + k, s - 2 * k, s - 2 * k);
      c.beginPath();
      c.moveTo(x0 + m + k, y0 + m + k); c.lineTo(x0 + m + s - k, y0 + m + s - k);
      c.moveTo(x0 + m + s - k, y0 + m + k); c.lineTo(x0 + m + k, y0 + m + s - k);
      c.stroke();
      c.globalAlpha = 1;
      if (onGoal) {   // et flueben i midten
        c.strokeStyle = colors.check; c.lineWidth = lw * 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x0 + S * 0.34, y0 + S * 0.52); c.lineTo(x0 + S * 0.46, y0 + S * 0.64); c.lineTo(x0 + S * 0.68, y0 + S * 0.38); c.stroke();
        c.lineCap = 'butt';
      }
      if (stuck) {    // et lille udråbstegn-skilt i hjørnet
        var sx = x0 + S * 0.8, sy = y0 + S * 0.2, sr = S * 0.15;
        c.fillStyle = colors.stuck; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
        c.fillStyle = colors.stuckText; c.font = 'bold ' + Math.round(sr * 1.5) + 'px ' + colors.font;
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', sx, sy + sr * 0.08);
      }
    });
    // Lagerarbejderen: en rund neonrobot med visir, der kigger i gåretningen
    var p = v.player, pcx = p.x * S + S / 2, pcy = p.y * S + S / 2, pr = S * 0.32, d = DIRS[p.dir] || DIRS.down;
    c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2);
    c.fillStyle = colors.playerFill; c.fill();
    glow(c, colors, colors.player, S * 0.35);
    c.strokeStyle = colors.player; c.lineWidth = lw * 1.6; c.stroke();
    noGlow(c);
    c.save(); c.translate(pcx + d.x * pr * 0.25, pcy + d.y * pr * 0.25);
    c.rotate(ANG[p.dir] || 0);
    rr(c, -pr * 0.2, -pr * 0.55, pr * 0.62, pr * 1.1, pr * 0.25);
    c.fillStyle = colors.player; c.fill();
    c.restore();
  }

  global.KasserRender = { draw: draw };
})(window);
