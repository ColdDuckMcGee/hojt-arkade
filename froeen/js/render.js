/*
 * Frøen – tegner brættet på et <canvas>. Farver kommer fra temaets
 * CSS-variabler (se css/froeen.css), så nye temaer kun kræver CSS.
 * Ingen blink og ingen hvide lysglimt. Uden animation (eller med mindre
 * bevægelse) bliver effekterne til en kort, rolig fade.
 */
(function (global) {
  'use strict';
  var G = global.FroeenGame;

  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function glow(c, col, blur, on) { if (on) { c.shadowColor = col; c.shadowBlur = blur; } else c.shadowBlur = 0; }
  var ROT = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI };
  function progress(f, now) { return Math.max(0, Math.min(1, (now - f.t0) / f.dur)); }

  function draw(canvas, run, col, opts) {
    opts = opts || {};
    var s = run.state;
    var c = canvas.getContext('2d');
    var dpr = canvas.width / (canvas.clientWidth || canvas.width) || 1;
    var W = canvas.clientWidth, H = canvas.clientHeight;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var cell = Math.min(W / s.cols, H / s.rows);
    var ox = (W - cell * s.cols) / 2, oy = (H - cell * s.rows) / 2;
    var on = col.glow, now = opts.now || 0;
    function X(x) { return ox + x * cell; }
    function Y(y) { return oy + y * cell; }

    // ---------- rækkerne ----------
    for (var y = 0; y < s.rows; y++) {
      var k = G.rowKind(y);
      var fill = k === 'river' ? col.water : k === 'road' ? col.road : k === 'top' ? col.top : col.safe;
      c.fillStyle = fill; c.fillRect(X(0), Y(y), cell * s.cols, cell + 0.5);
    }
    // flodens rolige bølgestreger (står stille)
    c.save();
    c.strokeStyle = col.waterLine; c.lineWidth = Math.max(1, cell * 0.03); c.lineCap = 'round';
    G.RIVER.forEach(function (ry) {
      for (var x = 0; x < s.cols; x++) {
        var bx = X(x) + cell * (ry % 2 ? 0.2 : 0.55), by = Y(ry) + cell * (x % 2 ? 0.3 : 0.7);
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + cell * 0.12, by - cell * 0.07, bx + cell * 0.24, by); c.stroke();
      }
    });
    c.restore();
    // vejens stiplede vognbaner
    c.save();
    c.strokeStyle = col.roadLine; c.lineWidth = Math.max(1.5, cell * 0.035);
    c.setLineDash([cell * 0.35, cell * 0.3]);
    for (var ly = G.ROAD[0] + 1; ly <= G.ROAD[G.ROAD.length - 1]; ly++) {
      c.beginPath(); c.moveTo(X(0), Y(ly)); c.lineTo(X(s.cols), Y(ly)); c.stroke();
    }
    c.restore();
    // sikre rækker: neonkant
    c.save();
    c.strokeStyle = col.safeEdge; c.lineWidth = Math.max(2, cell * 0.05);
    glow(c, col.safeEdge, cell * 0.3, on);
    [G.MEDIAN, G.START_ROW].forEach(function (sy) {
      c.beginPath(); c.moveTo(X(0), Y(sy) + 1); c.lineTo(X(s.cols), Y(sy) + 1);
      if (sy !== G.START_ROW) { c.moveTo(X(0), Y(sy + 1) - 1); c.lineTo(X(s.cols), Y(sy + 1) - 1); }
      c.stroke();
    });
    c.restore();

    // ---------- toprækken: mur og huller ----------
    for (var tx = 0; tx < s.cols; tx++) {
      var h = G.HOLES.indexOf(tx);
      if (h < 0) drawWall(c, X(tx), Y(0), cell, col, on);
      else drawHole(c, X(tx), Y(0), cell, col, on, s.holes[h]);
    }

    // ---------- næste træk: svage skygger ----------
    if (opts.preview) {
      s.lanes.forEach(function (lane) {
        if (!run.movesNext(lane)) return;
        var no = run.nextOffset(lane);
        lane.objs.forEach(function (o) {
          run.spans(lane, o, no).forEach(function (sp) { drawGhost(c, lane, o, sp, X, Y, cell, col); });
        });
      });
    }

    // ---------- biler, stammer og skildpadder ----------
    s.lanes.forEach(function (lane, li) {
      lane.objs.forEach(function (o, oi) {
        run.spans(lane, o).forEach(function (sp) {
          c.save();
          c.beginPath(); c.rect(X(0), Y(lane.y), cell * s.cols, cell); c.clip();
          if (lane.kind === 'car') drawCar(c, lane, o, sp, X, Y, cell, col, on, li);
          else if (lane.kind === 'log') drawLog(c, lane, o, sp, X, Y, cell, col, on);
          else drawTurtles(c, lane, o, sp, X, Y, cell, col, on);
          c.restore();
        });
        if (opts.preview && run.movesNext(lane)) {
          run.spans(lane, o).forEach(function (sp) { drawLead(c, lane, o, sp, X, Y, cell, col); });
        }
      });
    });

    // ---------- effekter ----------
    (opts.fx || []).forEach(function (f) {
      var q = progress(f, now); if (q >= 1) return;
      var cx = X(f.x) + cell / 2, cy = Y(f.y) + cell / 2;
      c.save();
      if (f.kind === 'splash') {
        c.strokeStyle = col.splash; c.lineWidth = Math.max(2, cell * 0.05);
        if (opts.calm) { c.globalAlpha = 0.7 * (1 - q); c.beginPath(); c.arc(cx, cy, cell * 0.36, 0, Math.PI * 2); c.stroke(); }
        else [0, 0.25].forEach(function (d) {
          var qq = Math.max(0, q - d); if (qq <= 0) return;
          c.globalAlpha = 0.8 * (1 - qq); c.beginPath(); c.arc(cx, cy, cell * (0.15 + qq * 0.45), 0, Math.PI * 2); c.stroke();
        });
      } else if (f.kind === 'hole') {
        c.globalAlpha = 0.6 * (1 - q);
        c.fillStyle = col.holeGlow;
        roundRect(c, X(f.x) + cell * 0.05, Y(f.y) + cell * 0.05, cell * 0.9, cell * 0.9, cell * 0.25); c.fill();
      } else if (f.kind === 'hit') {
        c.globalAlpha = 0.65 * (1 - q);
        c.fillStyle = col.danger;
        roundRect(c, X(f.x) + cell * 0.08, Y(f.y) + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.2); c.fill();
      }
      c.restore();
    });

    // ---------- frøen ----------
    var fr = s.frog;
    var fx = Math.max(0, Math.min(s.cols - 1, fr.x));
    if (opts.preview && opts.frogNext && !s.dead) drawFrog(c, X(opts.frogNext.x), Y(fr.y), cell, col, false, 0.28, s.facing, true);
    var drowned = s.dead && s.deathCause === 'vand';
    drawFrog(c, X(fx), Y(fr.y), cell, col, on, s.dead ? (drowned ? 0.3 : 0.45) : 1, s.facing);
    if (s.dead) {
      c.save();
      c.strokeStyle = col.danger; c.lineWidth = Math.max(3, cell * 0.08);
      roundRect(c, X(fx) + cell * 0.06, Y(fr.y) + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.18); c.stroke();
      c.restore();
    } else if (opts.preview && opts.waitDanger) {
      // at stå stille er farligt: svag rød, stiplet ring om frøen
      c.save();
      c.strokeStyle = col.danger; c.globalAlpha = 0.85; c.lineWidth = Math.max(2, cell * 0.05);
      c.setLineDash([cell * 0.14, cell * 0.1]);
      c.beginPath(); c.arc(X(fx) + cell / 2, Y(fr.y) + cell / 2, cell * 0.46, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
  }

  function drawWall(c, x, y, s, col, on) {
    var g = s * 0.06;
    c.save();
    c.fillStyle = col.wallFill;
    roundRect(c, x + g, y + g, s - 2 * g, s - 2 * g, s * 0.1); c.fill();
    c.lineWidth = Math.max(2, s * 0.05); c.strokeStyle = col.wall;
    glow(c, col.wall, s * 0.2, on); c.stroke(); c.shadowBlur = 0;
    // murværk
    c.globalAlpha = 0.45; c.lineWidth = Math.max(1, s * 0.025);
    c.beginPath();
    c.moveTo(x + g, y + s * 0.5); c.lineTo(x + s - g, y + s * 0.5);
    c.moveTo(x + s * 0.5, y + g); c.lineTo(x + s * 0.5, y + s * 0.5);
    c.moveTo(x + s * 0.28, y + s * 0.5); c.lineTo(x + s * 0.28, y + s - g);
    c.moveTo(x + s * 0.72, y + s * 0.5); c.lineTo(x + s * 0.72, y + s - g);
    c.stroke();
    c.restore();
  }
  function drawHole(c, x, y, s, col, on, filled) {
    c.save();
    var g = s * 0.08;
    c.fillStyle = col.holeFill;
    roundRect(c, x + g, y + g, s - 2 * g, s - 2 * g, s * 0.3); c.fill();
    c.lineWidth = Math.max(2.5, s * 0.06); c.strokeStyle = col.hole;
    glow(c, col.hole, s * 0.3, on); c.stroke(); c.shadowBlur = 0;
    c.restore();
    if (filled) drawFrog(c, x, y, s, col, on, 0.9, 'down');
  }
  function drawGhost(c, lane, o, sp, X, Y, s, col) {
    var colr = lane.kind === 'car' ? col.ghostCar : col.ghostLog, pad = s * 0.1;
    c.save();
    c.beginPath(); c.rect(X(0), Y(lane.y), X(11) - X(0), s); c.clip();
    c.strokeStyle = colr; c.fillStyle = colr;
    c.lineWidth = Math.max(1.5, s * 0.04);
    c.setLineDash([s * 0.12, s * 0.09]);
    roundRect(c, X(sp.x) + pad * 0.6, Y(lane.y) + pad, o.len * s - pad * 1.2, s - 2 * pad, s * 0.22);
    c.globalAlpha = col.ghostAlpha * 0.3; c.fill();
    c.globalAlpha = col.ghostAlpha; c.stroke();
    c.restore();
  }
  // lille pil foran hvert objekt, der rykker i næste træk
  function drawLead(c, lane, o, sp, X, Y, s, col) {
    var front = lane.dir > 0 ? sp.x + o.len : sp.x;   // kanten, objektet kører mod
    if (front < 0 || front > 11) return;
    var cx = X(front) + (lane.dir > 0 ? -s * 0.02 : s * 0.02), cy = Y(lane.y) + s / 2;
    c.save();
    c.translate(cx, cy); if (lane.dir < 0) c.scale(-1, 1);
    c.globalAlpha = col.ghostAlpha + 0.15;
    c.fillStyle = lane.kind === 'car' ? col.ghostCar : col.ghostLog;
    c.beginPath(); c.moveTo(s * 0.06, -s * 0.16); c.lineTo(s * 0.26, 0); c.lineTo(s * 0.06, s * 0.16); c.closePath(); c.fill();
    c.restore();
  }
  function drawCar(c, lane, o, sp, X, Y, s, col, on, li) {
    var colors = col.cars, colr = colors[li % colors.length];
    var x = X(sp.x), y = Y(lane.y), w = o.len * s, pad = s * 0.12;
    c.fillStyle = col.carFill; c.strokeStyle = colr;
    c.lineWidth = Math.max(2.5, s * 0.06); c.lineJoin = 'round';
    glow(c, colr, s * 0.3, on);
    roundRect(c, x + pad * 0.6, y + pad, w - pad * 1.2, s - 2 * pad, s * 0.22); c.fill(); c.stroke();
    c.shadowBlur = 0;
    var frontX = lane.dir > 0 ? x + w - pad * 0.6 : x + pad * 0.6, sgn = lane.dir > 0 ? -1 : 1;
    // forrude
    c.fillStyle = colr; c.globalAlpha = 0.55;
    var wsX = frontX + sgn * s * 0.42;
    roundRect(c, Math.min(wsX, wsX + sgn * s * 0.16), y + s * 0.26, s * 0.16, s * 0.48, s * 0.05); c.fill();
    if (o.len >= 2) { // varevogn/lastbil: lad med striber
      c.globalAlpha = 0.35; c.lineWidth = Math.max(1, s * 0.03);
      for (var k = 1; k < o.len; k++) { var lx = lane.dir > 0 ? x + k * s - s * 0.1 : x + w - k * s + s * 0.1; c.beginPath(); c.moveTo(lx, y + s * 0.24); c.lineTo(lx, y + s * 0.76); c.stroke(); }
    }
    // forlygter (lyser roligt)
    c.globalAlpha = 1; c.fillStyle = col.lights;
    glow(c, col.lights, s * 0.25, on);
    [0.3, 0.7].forEach(function (fy) { c.beginPath(); c.arc(frontX + sgn * s * 0.08, y + s * fy, Math.max(2, s * 0.055), 0, Math.PI * 2); c.fill(); });
  }
  function drawLog(c, lane, o, sp, X, Y, s, col, on) {
    var x = X(sp.x), y = Y(lane.y), w = o.len * s, pad = s * 0.1;
    var grad = c.createLinearGradient(0, y + pad, 0, y + s - pad);
    grad.addColorStop(0, col.logLight); grad.addColorStop(1, col.logDark);
    c.fillStyle = grad; c.strokeStyle = col.log; c.lineWidth = Math.max(2, s * 0.05);
    glow(c, col.log, s * 0.25, on);
    roundRect(c, x + pad * 0.4, y + pad, w - pad * 0.8, s - 2 * pad, s * 0.35); c.fill(); c.stroke();
    c.shadowBlur = 0;
    c.globalAlpha = 0.5; c.lineWidth = Math.max(1, s * 0.03); c.lineCap = 'round';
    for (var k = 0; k < o.len; k++) { // årer
      c.beginPath(); c.moveTo(x + k * s + s * 0.25, y + s * 0.4); c.lineTo(x + k * s + s * 0.7, y + s * 0.4); c.stroke();
      c.beginPath(); c.moveTo(x + k * s + s * 0.4, y + s * 0.62); c.lineTo(x + k * s + s * 0.85, y + s * 0.62); c.stroke();
    }
    c.globalAlpha = 0.8; // årringe i enderne
    c.beginPath(); c.ellipse(x + w - pad * 0.4 - s * 0.13, y + s / 2, s * 0.09, s * 0.22, 0, 0, Math.PI * 2); c.stroke();
  }
  function drawTurtles(c, lane, o, sp, X, Y, s, col, on) {
    for (var k = 0; k < o.len; k++) {
      var cx = X(sp.x + k) + s / 2, cy = Y(lane.y) + s / 2, r = s * 0.36;
      c.save();
      c.translate(cx, cy); if (lane.dir < 0) c.scale(-1, 1);
      // hoved i kørselsretningen
      c.fillStyle = col.turtle;
      c.beginPath(); c.arc(r * 1.05, 0, r * 0.28, 0, Math.PI * 2); c.fill();
      c.fillStyle = col.turtleFill; c.strokeStyle = col.turtle; c.lineWidth = Math.max(2, s * 0.05);
      glow(c, col.turtle, s * 0.25, on);
      c.beginPath(); c.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.globalAlpha = 0.6; c.lineWidth = Math.max(1, s * 0.03);
      c.beginPath();
      for (var a = 0; a < 6; a++) { var ang = a * Math.PI / 3; c[a ? 'lineTo' : 'moveTo'](Math.cos(ang) * r * 0.42, Math.sin(ang) * r * 0.42); }
      c.closePath(); c.stroke();
      c.restore();
    }
  }
  function drawFrog(c, x, y, s, col, on, alpha, facing, ghost) {
    var cx = x + s / 2, cy = y + s / 2;
    c.save();
    c.globalAlpha = alpha;
    c.translate(cx, cy); c.rotate((ROT[facing] || -Math.PI / 2) + Math.PI / 2);
    c.strokeStyle = col.frog; c.fillStyle = ghost ? 'rgba(0,0,0,0)' : col.frogFill;
    c.lineWidth = Math.max(2.5, s * 0.06); c.lineJoin = 'round'; c.lineCap = 'round';
    if (ghost) c.setLineDash([s * 0.1, s * 0.08]);
    glow(c, col.frog, s * 0.35, on);
    // ben
    c.beginPath();
    c.moveTo(-s * 0.18, -s * 0.12); c.lineTo(-s * 0.36, -s * 0.3);
    c.moveTo(s * 0.18, -s * 0.12); c.lineTo(s * 0.36, -s * 0.3);
    c.moveTo(-s * 0.2, s * 0.14); c.lineTo(-s * 0.38, s * 0.34);
    c.moveTo(s * 0.2, s * 0.14); c.lineTo(s * 0.38, s * 0.34);
    c.stroke();
    // krop
    c.beginPath(); c.ellipse(0, s * 0.03, s * 0.24, s * 0.29, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.shadowBlur = 0;
    if (!ghost) {
      // øjne foran
      c.fillStyle = col.frog;
      [-1, 1].forEach(function (d) { c.beginPath(); c.arc(d * s * 0.12, -s * 0.2, s * 0.075, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = col.frogFill;
      [-1, 1].forEach(function (d) { c.beginPath(); c.arc(d * s * 0.12, -s * 0.21, s * 0.03, 0, Math.PI * 2); c.fill(); });
    }
    c.restore();
  }

  global.FroeenRender = { draw: draw };
})(window);
