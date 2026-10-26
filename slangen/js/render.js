/*
 * Slangen – tegner brættet på et <canvas>. Farver kommer fra temaets
 * CSS-variabler, så nye temaer kun kræver CSS.
 */
(function (global) {
  'use strict';

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function draw(canvas, state, colors, opts) {
    opts = opts || {};
    var c = canvas.getContext('2d');
    var dpr = canvas.width / canvas.clientWidth || 1;
    var px = canvas.clientWidth;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, px, px);
    var n = state.size, cell = px / n;
    var glow = colors.glow;

    // bræt
    c.fillStyle = colors.board;
    c.fillRect(0, 0, px, px);
    c.strokeStyle = colors.grid; c.lineWidth = 1;
    c.beginPath();
    for (var i = 1; i < n; i++) {
      var p = Math.round(i * cell) + 0.5;
      c.moveTo(p, 0); c.lineTo(p, px);
      c.moveTo(0, p); c.lineTo(px, p);
    }
    c.stroke();

    function cellRect(x, y, inset) {
      var g = cell * inset;
      return { x: x * cell + g, y: y * cell + g, w: cell - 2 * g };
    }

    // forhindringer: mørk blok med kraftig kant og kryds
    state.obstacles.forEach(function (o) {
      var r = cellRect(o.x, o.y, 0.1);
      c.save();
      c.fillStyle = colors.obstacleFill;
      roundRect(c, r.x, r.y, r.w, r.w, cell * 0.08); c.fill();
      c.lineWidth = Math.max(2, cell * 0.09);
      c.strokeStyle = colors.obstacle;
      if (glow) { c.shadowColor = colors.obstacle; c.shadowBlur = cell * 0.3; }
      c.stroke();
      c.shadowBlur = 0;
      c.lineWidth = Math.max(1.5, cell * 0.07);
      c.beginPath();
      var m = r.w * 0.24;
      c.moveTo(r.x + m, r.y + m); c.lineTo(r.x + r.w - m, r.y + r.w - m);
      c.moveTo(r.x + r.w - m, r.y + m); c.lineTo(r.x + m, r.y + r.w - m);
      c.stroke();
      c.restore();
    });

    // almindelig mad: lysende cyan firkant
    if (state.food) {
      var f = cellRect(state.food.x, state.food.y, 0.16);
      c.save();
      c.fillStyle = colors.food;
      if (glow) { c.shadowColor = colors.food; c.shadowBlur = cell * 0.6; }
      roundRect(c, f.x, f.y, f.w, f.w, cell * 0.08); c.fill();
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.55)';
      var fi = f.w * 0.3;
      roundRect(c, f.x + fi, f.y + fi, f.w - 2 * fi, f.w - 2 * fi, cell * 0.04); c.fill();
      c.restore();
    }

    // bonusmad: diamant med antal træk tilbage
    if (state.bonus) {
      var b = state.bonus, cx = (b.x + 0.5) * cell, cy = (b.y + 0.5) * cell, R = cell * 0.5;
      c.save();
      c.fillStyle = colors.bonus;
      if (glow) { c.shadowColor = colors.bonus; c.shadowBlur = cell * 0.7; }
      c.beginPath();
      c.moveTo(cx, cy - R); c.lineTo(cx + R, cy); c.lineTo(cx, cy + R); c.lineTo(cx - R, cy);
      c.closePath(); c.fill();
      c.shadowBlur = 0;
      c.fillStyle = colors.bonusText;
      c.font = 'bold ' + Math.round(cell * 0.42) + 'px system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(b.movesLeft), cx, cy + cell * 0.03);
      c.restore();
    }

    // slangen: lysende firkanter med små mellemrum, lysere hoved
    var segs = state.snake;
    for (var si = segs.length - 1; si >= 0; si--) {
      var sg = segs[si], head = si === 0;
      var r2 = cellRect(sg.x, sg.y, head ? 0.06 : 0.12);
      c.save();
      c.fillStyle = head ? colors.head : colors.snake;
      if (glow) { c.shadowColor = colors.snake; c.shadowBlur = cell * (head ? 0.7 : 0.45); }
      roundRect(c, r2.x, r2.y, r2.w, r2.w, cell * 0.12); c.fill();
      c.shadowBlur = 0;
      if (head) {
        c.lineWidth = Math.max(2, cell * 0.07);
        c.strokeStyle = colors.headRim;
        c.stroke();
        // øjne vendt i bevægelsesretningen
        var d = global.SlangenGame.DIRS[state.dir];
        var hc = { x: (sg.x + 0.5) * cell, y: (sg.y + 0.5) * cell };
        var fwd = cell * 0.18, side = cell * 0.17, er = Math.max(1.5, cell * 0.08);
        c.fillStyle = colors.eye;
        [-1, 1].forEach(function (sd) {
          c.beginPath();
          c.arc(hc.x + d.x * fwd + (-d.y) * side * sd, hc.y + d.y * fwd + d.x * side * sd, er, 0, Math.PI * 2);
          c.fill();
        });
      }
      c.restore();
    }

    // kollision vises ved game over
    if (opts.crash && state.crash) {
      var cr = state.crash;
      var x = Math.min(n - 1, Math.max(0, cr.x)), y = Math.min(n - 1, Math.max(0, cr.y));
      var r3 = cellRect(x, y, 0.15);
      c.save();
      c.strokeStyle = colors.crash; c.lineWidth = Math.max(3, cell * 0.12);
      c.beginPath();
      c.moveTo(r3.x, r3.y); c.lineTo(r3.x + r3.w, r3.y + r3.w);
      c.moveTo(r3.x + r3.w, r3.y); c.lineTo(r3.x, r3.y + r3.w);
      c.stroke();
      c.restore();
    }
  }

  global.SlangenRender = { draw: draw };
})(window);
