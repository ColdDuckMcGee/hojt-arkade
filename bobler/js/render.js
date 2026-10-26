/*
 * Bobler – tegner brættet på et <canvas>. Farver kommer fra temaets
 * CSS-variabler (se css/bobler.css), så nye temaer kun kræver CSS.
 * Hver farve har også sin egen form i boblen (prik, trekant, firkant, plus,
 * ruder, stjerne og ring), så farverne kan skelnes uden farvesyn.
 * Ingen blink og ingen hvide lysglimt: sprængte bobler skrumper og toner
 * roligt ud, faldne bobler glider ned. Uden animation bliver det en rolig fade.
 */
(function (global) {
  'use strict';
  var G = global.BoblerGame;

  function glow(c, col, blur, on) { if (on) { c.shadowColor = col; c.shadowBlur = blur; } else c.shadowBlur = 0; }
  function progress(f, now) { return Math.max(0, Math.min(1, (now - f.t0) / f.dur)); }

  // Formen inde i boblen (radius r, centreret i 0,0)
  function shape(c, name, r) {
    c.beginPath();
    var k, a;
    switch (name) {
      case 'prik': c.arc(0, 0, r * 0.34, 0, Math.PI * 2); c.fill(); break;
      case 'trekant': c.moveTo(0, -r * 0.48); c.lineTo(r * 0.44, r * 0.32); c.lineTo(-r * 0.44, r * 0.32); c.closePath(); c.fill(); break;
      case 'firkant': c.rect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64); c.fill(); break;
      case 'plus': var t = r * 0.15, l = r * 0.46;
        c.moveTo(-t, -l); c.lineTo(t, -l); c.lineTo(t, -t); c.lineTo(l, -t); c.lineTo(l, t); c.lineTo(t, t); c.lineTo(t, l);
        c.lineTo(-t, l); c.lineTo(-t, t); c.lineTo(-l, t); c.lineTo(-l, -t); c.lineTo(-t, -t); c.closePath(); c.fill(); break;
      case 'ruder': c.moveTo(0, -r * 0.5); c.lineTo(r * 0.36, 0); c.lineTo(0, r * 0.5); c.lineTo(-r * 0.36, 0); c.closePath(); c.fill(); break;
      case 'stjerne':
        for (k = 0; k < 10; k++) { a = -Math.PI / 2 + k * Math.PI / 5; var rr = k % 2 ? r * 0.2 : r * 0.5; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath(); c.fill(); break;
      case 'ring': c.lineWidth = r * 0.16; c.arc(0, 0, r * 0.32, 0, Math.PI * 2); c.stroke(); break;
    }
  }

  // Én boble i (x, y) i pixel med radius r. color = farveindeks.
  function bubble(c, x, y, r, color, col, opts) {
    opts = opts || {};
    var base = col.c[color], info = G.COLORS[color];
    c.save();
    c.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
    c.translate(x, y);
    if (opts.scale) c.scale(opts.scale, opts.scale);
    if (opts.ghost) {
      c.setLineDash([r * 0.28, r * 0.2]);
      c.lineWidth = Math.max(2, r * 0.12); c.strokeStyle = base;
      c.beginPath(); c.arc(0, 0, r * 0.9, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
      c.globalAlpha *= 0.55; c.fillStyle = base; c.strokeStyle = base;
      shape(c, info.shape, r);
      c.restore();
      return;
    }
    var grad = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, col.c2[color]); grad.addColorStop(1, base);
    c.fillStyle = grad;
    glow(c, base, r * 0.5, col.glow && !opts.noGlow);
    c.beginPath(); c.arc(0, 0, r * 0.94, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.lineWidth = Math.max(1.5, r * 0.07); c.strokeStyle = col.rim; c.stroke();
    // symbol
    c.fillStyle = col.sym; c.strokeStyle = col.sym;
    shape(c, info.shape, r);
    // glasrefleks (farvet, aldrig en hvid flade)
    c.globalAlpha *= 0.45; c.strokeStyle = col.c2[color]; c.lineWidth = Math.max(1.5, r * 0.09); c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
    c.restore();
  }

  function draw(canvas, s, col, opts) {
    opts = opts || {};
    var c = canvas.getContext('2d');
    var dpr = canvas.width / (canvas.clientWidth || canvas.width) || 1;
    var Wp = canvas.clientWidth, Hp = canvas.clientHeight;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, Wp, Hp);
    var u = Math.min(Wp / G.W, Hp / G.H);    // pixel pr. boblebredde
    var ox = (Wp - G.W * u) / 2, oy = 0;
    function X(x) { return ox + x * u; }
    function Y(y) { return oy + y * u; }
    var r = u / 2, now = opts.now || 0, on = col.glow;

    c.fillStyle = col.floor; c.fillRect(0, 0, Wp, Hp);

    // loftet: en plade, der vokser nedad. Riller viser, hvor mange rækker den er rykket.
    var ceilY = Y(s.ceiling * G.ROW_H);
    if (s.ceiling > 0) {
      c.fillStyle = col.ceilingFill; c.fillRect(0, 0, Wp, ceilY);
      c.strokeStyle = col.ceiling; c.globalAlpha = 0.35; c.lineWidth = 1;
      c.beginPath();
      for (var k = 1; k <= s.ceiling; k++) { var yy = Math.round(Y(k * G.ROW_H)) - 0.5; c.moveTo(0, yy); c.lineTo(Wp, yy); }
      c.stroke(); c.globalAlpha = 1;
    }
    c.strokeStyle = col.ceiling; c.lineWidth = Math.max(3, u * 0.08);
    glow(c, col.ceiling, u * 0.3, on);
    c.beginPath(); c.moveTo(0, ceilY); c.lineTo(Wp, ceilY); c.stroke();
    c.shadowBlur = 0;

    // bundlinjen
    var deadY = Y(G.cellY(G.DEAD_ROW) - 0.5);
    c.save();
    c.strokeStyle = col.dead; c.lineWidth = Math.max(2, u * 0.05); c.globalAlpha = 0.8;
    c.setLineDash([u * 0.25, u * 0.18]);
    c.beginPath(); c.moveTo(0, deadY); c.lineTo(Wp, deadY); c.stroke();
    c.restore();

    // boblerne
    var hide = opts.hideCell;
    for (var rr = 0; rr < G.ROWS; rr++) for (var cc = 0; cc < G.rowLen(rr); cc++) {
      var v = s.grid[rr][cc];
      if (v < 0) continue;
      if (hide && hide.r === rr && hide.c === cc) continue;
      bubble(c, X(G.cellX(rr, cc)), Y(G.cellY(rr, s.ceiling)), r, v, col);
    }

    // sigtelinje og spøgelsesboble
    var aim = opts.aim;
    if (aim && opts.showAim) {
      c.save();
      c.fillStyle = col.aim;
      glow(c, col.aim, u * 0.2, on);
      var gap = 0.34, carry = 0.2, dotR = Math.max(2, u * 0.06);
      for (var i = 0; i < aim.path.length - 1; i++) {
        var a = aim.path[i], b = aim.path[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
        for (var d = carry; d < len; d += gap) {
          if (i === 0 && d < 0.75) continue; // ikke oven i kanonen
          var t = d / len;
          c.beginPath(); c.arc(X(a.x + (b.x - a.x) * t), Y(a.y + (b.y - a.y) * t), dotR, 0, Math.PI * 2); c.fill();
        }
        carry = (d - len);
      }
      c.shadowBlur = 0;
      // tilbagespring: en lille ring på væggen
      c.strokeStyle = col.aim; c.lineWidth = Math.max(2, u * 0.05);
      for (var j = 1; j < aim.path.length - 1; j++) { c.beginPath(); c.arc(X(aim.path[j].x), Y(aim.path[j].y), u * 0.14, 0, Math.PI * 2); c.stroke(); }
      c.restore();
      if (aim.cell) bubble(c, X(G.cellX(aim.cell.r, aim.cell.c)), Y(G.cellY(aim.cell.r, s.ceiling)), r, s.current, col, { ghost: true });
    }

    // kanonen
    var sx = X(G.W / 2), sy = Y(G.SHOOT_Y);
    c.save();
    c.translate(sx, sy);
    c.rotate((opts.angle || 0) * Math.PI / 180);
    c.fillStyle = col.cannonFill; c.strokeStyle = col.cannon; c.lineWidth = Math.max(2, u * 0.06); c.lineJoin = 'round';
    glow(c, col.cannon, u * 0.3, on);
    c.beginPath(); c.moveTo(-u * 0.2, -u * 0.45); c.lineTo(-u * 0.12, -u * 1.0); c.lineTo(u * 0.12, -u * 1.0); c.lineTo(u * 0.2, -u * 0.45); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.save();
    c.strokeStyle = col.cannon; c.lineWidth = Math.max(2, u * 0.06); c.fillStyle = col.cannonFill;
    glow(c, col.cannon, u * 0.3, on);
    c.beginPath(); c.arc(sx, sy, u * 0.66, Math.PI, 0); c.lineTo(sx + u * 0.66, sy + u * 0.8); c.lineTo(sx - u * 0.66, sy + u * 0.8); c.closePath(); c.fill(); c.stroke();
    c.restore();
    if (!opts.flying) bubble(c, sx, sy, r, s.current, col);

    // næste boble (nederst til venstre)
    var nx = X(1.05), ny = Y(G.SHOOT_Y + 0.05);
    c.save();
    c.fillStyle = col.label; c.font = '700 ' + Math.round(Math.max(12, u * 0.3)) + 'px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillText('Næste', nx, ny - r * 0.85);
    c.restore();
    bubble(c, nx, ny, r * 0.82, s.next, col);

    // loft-tæller (nederst til højre): prikker for de skud, der er tilbage
    var left = opts.shotsToCeiling, every = G.RULES.ceilingEvery;
    if (left !== undefined) {
      var px0 = X(G.W - 1.05), py0 = Y(G.SHOOT_Y + 0.05);
      c.save();
      c.fillStyle = col.label; c.font = '700 ' + Math.round(Math.max(12, u * 0.3)) + 'px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText('Loft om ' + left, px0, py0 - r * 0.6);
      var pr = u * 0.09, pg = u * 0.27;
      for (var q = 0; q < every; q++) {
        var cx = px0 + (q - (every - 1) / 2) * pg;
        c.beginPath(); c.arc(cx, py0, pr, 0, Math.PI * 2);
        if (q < left) { c.fillStyle = col.ceiling; c.fill(); }
        else { c.strokeStyle = col.ceiling; c.lineWidth = Math.max(1.5, u * 0.03); c.globalAlpha = 0.6; c.stroke(); c.globalAlpha = 1; }
      }
      c.restore();
    }

    // effekter: flyvende boble, sprængte og faldne
    (opts.fx || []).forEach(function (f) {
      var q = progress(f, now);
      if (f.kind === 'fly') {
        if (q >= 1) return;
        var p = pointAt(f.path, f.len * q);
        bubble(c, X(p.x), Y(p.y), r, f.color, col);
      } else if (f.kind === 'pop') {
        if (q >= 1) return;
        f.items.forEach(function (b) {
          bubble(c, X(G.cellX(b.r, b.c)), Y(G.cellY(b.r, f.ceiling)), r, b.color, col,
            { alpha: 1 - q, scale: opts.calm ? 1 : 1 + q * 0.25, noGlow: true });
        });
      } else if (f.kind === 'fall') {
        if (q >= 1) return;
        f.items.forEach(function (b) {
          var dy = opts.calm ? 0 : q * q * 3;
          bubble(c, X(G.cellX(b.r, b.c)), Y(G.cellY(b.r, f.ceiling) + dy), r, b.color, col, { alpha: 1 - q, noGlow: true });
        });
      }
    });
  }
  function pointAt(path, d) {
    for (var i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= len) { var t = len ? d / len : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
      d -= len;
    }
    return path[path.length - 1];
  }
  function pathLength(path) {
    var L = 0;
    for (var i = 0; i < path.length - 1; i++) L += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    return L;
  }
  // Afstand langs banen til hvert tilbagespring (til lyd på det rigtige tidspunkt)
  function bounceDistances(path) {
    var out = [], L = 0;
    for (var i = 0; i < path.length - 2; i++) { L += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y); out.push(L); }
    return out;
  }
  // Pixel → brætkoordinater (til at sigte ved at klikke på brættet)
  function toBoard(canvas, px, py) {
    var Wp = canvas.clientWidth, Hp = canvas.clientHeight, u = Math.min(Wp / G.W, Hp / G.H);
    return { x: (px - (Wp - G.W * u) / 2) / u, y: py / u };
  }

  global.BoblerRender = { draw: draw, bubble: bubble, pathLength: pathLength, bounceDistances: bounceDistances, toBoard: toBoard };
})(window);
