/*
 * Slangen – tegner brættet på et <canvas>. Farver kommer fra temaets
 * CSS-variabler, så nye temaer kun kræver CSS.
 *
 * Stilene (arkade/stil.js, colors.stil):
 *   neon        lysende firkanter med glød
 *   tegneserie  flade farver med tyk sort kontur, rundt æble, øjne med pupiller
 *   pixel       tegnes i lav opløsning (et helt antal pixel pr. felt) og forstørres skarpt
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
    if (colors.stil === 'pixel') return drawPixel(canvas, state, colors, opts);
    var ts = colors.stil === 'tegneserie', ink = colors.ink;
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
    c.strokeStyle = colors.grid; c.lineWidth = ts ? 2 : 1;
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
      c.lineWidth = Math.max(2, cell * (ts ? 0.1 : 0.09));
      c.strokeStyle = ts ? ink : colors.obstacle;
      if (glow) { c.shadowColor = colors.obstacle; c.shadowBlur = cell * 0.3; }
      c.stroke();
      c.shadowBlur = 0;
      c.lineWidth = Math.max(1.5, cell * 0.07);
      if (ts) c.strokeStyle = colors.obstacle;
      c.beginPath();
      var m = r.w * 0.24;
      c.moveTo(r.x + m, r.y + m); c.lineTo(r.x + r.w - m, r.y + r.w - m);
      c.moveTo(r.x + r.w - m, r.y + m); c.lineTo(r.x + m, r.y + r.w - m);
      c.stroke();
      c.restore();
    });

    // almindelig mad: lysende cyan firkant
    if (state.food && ts) {
      // tegneserie: rødt æble med sort kontur og et grønt blad
      var fc = { x: (state.food.x + 0.5) * cell, y: (state.food.y + 0.55) * cell }, fr = cell * 0.36;
      c.save();
      c.lineWidth = Math.max(2, cell * 0.1); c.strokeStyle = ink; c.lineJoin = 'round';
      c.fillStyle = colors.food;
      c.beginPath(); c.arc(fc.x, fc.y, fr, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath(); c.arc(fc.x - fr * 0.38, fc.y - fr * 0.38, fr * 0.22, 0, Math.PI * 2); c.fill();
      c.fillStyle = colors.leaf; c.lineWidth = Math.max(1.5, cell * 0.06);
      c.beginPath(); c.ellipse(fc.x + fr * 0.35, fc.y - fr * 1.05, fr * 0.42, fr * 0.22, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.restore();
    } else if (state.food) {
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
      if (ts) { c.lineWidth = Math.max(2, cell * 0.09); c.strokeStyle = ink; c.lineJoin = 'round'; c.stroke(); }
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
      var r2 = cellRect(sg.x, sg.y, head ? (ts ? -0.02 : 0.06) : (ts ? 0.05 : 0.12));
      c.save();
      c.fillStyle = head ? colors.head : colors.snake;
      if (glow) { c.shadowColor = colors.snake; c.shadowBlur = cell * (head ? 0.7 : 0.45); }
      roundRect(c, r2.x, r2.y, r2.w, r2.w, cell * (ts ? 0.26 : 0.12)); c.fill();
      c.shadowBlur = 0;
      if (ts) {
        // tyk sort kontur om hvert led; hovedet får store øjne med pupiller
        c.lineWidth = Math.max(2, cell * 0.1); c.strokeStyle = ink; c.stroke();
        if (head) {
          var dd = global.SlangenGame.DIRS[state.dir];
          var hcc = { x: (sg.x + 0.5) * cell, y: (sg.y + 0.5) * cell };
          var fw = cell * 0.16, sd2 = cell * 0.2, er2 = Math.max(2.5, cell * 0.15);
          [-1, 1].forEach(function (sd) {
            var ex = hcc.x + dd.x * fw + (-dd.y) * sd2 * sd, ey = hcc.y + dd.y * fw + dd.x * sd2 * sd;
            c.fillStyle = '#ffffff'; c.lineWidth = Math.max(1.5, cell * 0.06);
            c.beginPath(); c.arc(ex, ey, er2, 0, Math.PI * 2); c.fill(); c.stroke();
            c.fillStyle = ink;
            c.beginPath(); c.arc(ex + dd.x * er2 * 0.4, ey + dd.y * er2 * 0.4, er2 * 0.45, 0, Math.PI * 2); c.fill();
          });
        }
      } else if (head) {
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
      c.strokeStyle = colors.crash; c.lineWidth = Math.max(3, cell * (ts ? 0.16 : 0.12)); c.lineCap = ts ? 'round' : 'butt';
      c.beginPath();
      c.moveTo(r3.x, r3.y); c.lineTo(r3.x + r3.w, r3.y + r3.w);
      c.moveTo(r3.x + r3.w, r3.y); c.lineTo(r3.x, r3.y + r3.w);
      c.stroke();
      c.restore();
    }
  }

  // ---------- Retro-pixel ----------
  // Lærredet har et helt antal pixel (k) pr. felt; der tegnes kun hele, skarpe pixel.
  var CIFRE = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
               '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
  function drawPixel(canvas, state, colors, opts) {
    var c = canvas.getContext('2d');
    var n = state.size, k = Math.round(canvas.width / n), ink = colors.ink;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    function px(x, y, w, h, f) { c.fillStyle = f; c.fillRect(x, y, w, h); }
    // skakternet bræt
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) px(x * k, y * k, k, k, (x + y) % 2 ? colors.board2 : colors.board);
    var i1 = k >= 6 ? 1 : 0;   // lille luft om hvert led
    // forhindringer: grå sten med lys kant foroven og mørk forneden
    state.obstacles.forEach(function (o) {
      var X = o.x * k, Y = o.y * k;
      px(X, Y, k, k, colors.obstacleFill);
      px(X, Y, k, 1, colors.obstacle); px(X, Y, 1, k, colors.obstacle);
      px(X, Y + k - 1, k, 1, ink); px(X + k - 1, Y, 1, k, ink);
      for (var d = 2; d < k - 2; d++) { px(X + d, Y + d, 1, 1, colors.obstacle); px(X + k - 1 - d, Y + d, 1, 1, colors.obstacle); }
    });
    // mad: et pixel-æble (6 × 6 mønster, skaleret til feltet)
    if (state.food) {
      var AE = ['...g..', '.rrgr.', 'rwrrrr', 'rrrrrr', 'rrrrrd', '.rddr.'];
      var s = Math.max(1, Math.floor((k - 1) / 6)), ox = state.food.x * k + Math.floor((k - 6 * s) / 2), oy = state.food.y * k + Math.floor((k - 6 * s) / 2);
      var FA = { g: colors.leaf, r: colors.food, w: '#fff1e8', d: '#7e2553' };
      if (k < 6) px(state.food.x * k + i1, state.food.y * k + i1, k - 2 * i1, k - 2 * i1, colors.food);
      else AE.forEach(function (row, ry) { for (var rx = 0; rx < 6; rx++) { var ch = row[rx]; if (ch !== '.') px(ox + rx * s, oy + ry * s, s, s, FA[ch]); } });
    }
    // bonus: gul diamant med antal træk i en 3 × 5-pixelskrift
    if (state.bonus) {
      var b = state.bonus, bx = b.x * k, by = b.y * k, h = k / 2;
      for (var ry = 0; ry < k; ry++) {
        var half = Math.floor(h - Math.abs(ry + 0.5 - h));
        if (half > 0) px(bx + Math.floor(h) - half, by + ry, half * 2, 1, colors.bonus);
      }
      var tal = String(Math.min(99, b.movesLeft));
      if (k >= 9) {
        var tw = tal.length * 4 - 1, tx = bx + Math.floor((k - tw) / 2), ty = by + Math.floor((k - 5) / 2);
        for (var ci = 0; ci < tal.length; ci++) {
          var m = CIFRE[+tal[ci]];
          for (var q = 0; q < 15; q++) if (m[q] === '1') px(tx + ci * 4 + (q % 3), ty + Math.floor(q / 3), 1, 1, colors.bonusText);
        }
      }
    }
    // slangen: firkantede led med skygge i nederste/højre kant; hovedet lysere med to øjne
    var segs = state.snake;
    for (var si = segs.length - 1; si >= 0; si--) {
      var sg = segs[si], head = si === 0, X = sg.x * k, Y = sg.y * k;
      px(X, Y, k, k, head ? colors.head : colors.snake);
      var sk = Math.max(1, Math.round(k / 7));
      px(X, Y + k - sk, k, sk, colors.snakeDark); px(X + k - sk, Y, sk, k, colors.snakeDark);
      if (si === segs.length - 1 && k >= 7) px(X + 2, Y + 2, k - 4 - sk, k - 4 - sk, colors.snakeDark);
      if (head) {
        var dir = global.SlangenGame.DIRS[state.dir], e = Math.max(1, Math.round(k / 7));
        var cx = X + k / 2, cy = Y + k / 2, f = k * 0.2, sd = k * 0.22;
        [-1, 1].forEach(function (s2) {
          px(Math.round(cx + dir.x * f + (-dir.y) * sd * s2 - e / 2), Math.round(cy + dir.y * f + dir.x * sd * s2 - e / 2), e, e, ink);
        });
      }
    }
    // kollision: et rødt pixel-kryds
    if (opts.crash && state.crash) {
      var cr = state.crash, cx2 = Math.min(n - 1, Math.max(0, cr.x)) * k, cy2 = Math.min(n - 1, Math.max(0, cr.y)) * k;
      var w = Math.max(1, Math.round(k / 6));
      for (var d2 = 1; d2 < k - 1; d2++) { px(cx2 + d2, cy2 + d2, w, w, colors.crash); px(cx2 + k - 1 - d2 - w + 1, cy2 + d2, w, w, colors.crash); }
    }
  }

  global.SlangenRender = { draw: draw };
})(window);
