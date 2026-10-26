/*
 * Bomberne – tegner brættet på et <canvas>. Farver kommer fra temaets
 * CSS-variabler (se css/bomberne.css), så nye temaer kun kræver CSS.
 * Kanten af søjler tegnes ikke som felter, men som brættets neonramme,
 * så felterne indeni bliver så store som muligt.
 * Ingen blink og ingen hvide lysglimt: flammer er orange og gule og
 * toner roligt ud. Uden animation bliver de til en kort, rolig fade.
 */
(function (global) {
  'use strict';
  var G = global.BomberneGame;

  function roundRect(c, x, y, w, h, r) {
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

  function draw(canvas, s, col, opts) {
    opts = opts || {};
    var c = canvas.getContext('2d');
    var dpr = canvas.width / (canvas.clientWidth || canvas.width) || 1;
    var W = canvas.clientWidth, H = canvas.clientHeight;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var ic = s.cols - 2, ir = s.rows - 2;
    var cell = Math.min(W / ic, H / ir);
    var on = col.glow;
    var now = opts.now || 0;
    function X(x) { return (x - 1) * cell; }
    function Y(y) { return (y - 1) * cell; }
    function at(i) { return { x: i % s.cols, y: Math.floor(i / s.cols) }; }

    // gulv og fint gitter
    c.fillStyle = col.floor; c.fillRect(0, 0, W, H);
    c.strokeStyle = col.grid; c.lineWidth = 1;
    c.beginPath();
    for (var gx = 1; gx < ic; gx++) { var px = Math.round(gx * cell) + 0.5; c.moveTo(px, 0); c.lineTo(px, H); }
    for (var gy = 1; gy < ir; gy++) { var py = Math.round(gy * cell) + 0.5; c.moveTo(0, py); c.lineTo(W, py); }
    c.stroke();

    var fxCrates = {};
    (opts.fx || []).forEach(function (f) { if (f.kind === 'crate') fxCrates[f.i] = f; });

    // felter: søjler, kasser og synlige ting (udgang og bonusser)
    for (var y = 1; y < s.rows - 1; y++) for (var x = 1; x < s.cols - 1; x++) {
      var i = y * s.cols + x, t = s.tiles[i];
      if (t === G.PILLAR) drawPillar(c, X(x), Y(y), cell, col, on);
      else if (t === G.CRATE) drawCrate(c, X(x), Y(y), cell, col, on, 1, 1);
      else if (s.items[i]) drawItem(c, s.items[i], X(x), Y(y), cell, col, on, s.enemies.length === 0);
    }
    // kasser, der lige er sprængt, toner ud
    Object.keys(fxCrates).forEach(function (k) {
      var f = fxCrates[k], p = at(Number(k)), q = progress(f, now);
      if (q >= 1) return;
      drawCrate(c, X(p.x), Y(p.y), cell, col, on, 1 - q, opts.calm ? 1 : 1 - q * 0.35);
    });

    // faremarkering: rød skravering. Kraftig = springer i næste tur.
    if (opts.danger) {
      opts.danger.forEach(function (d, k) {
        if (!d) return;
        var p = at(k);
        if (p.x < 1 || p.y < 1 || p.x > s.cols - 2 || p.y > s.rows - 2) return;
        drawDanger(c, X(p.x), Y(p.y), cell, col, d === 1);
      });
    }

    // fjendernes næste træk som svage pile
    if (opts.arrows) {
      s.enemies.forEach(function (e) { if (e.plan) drawArrow(c, e, cell, col, X, Y); });
    }

    // bomber
    s.bombs.forEach(function (b) { drawBomb(c, X(b.x), Y(b.y), cell, col, on, b.timer); });

    // fjender (og dem, der lige er ramt, toner ud)
    s.enemies.forEach(function (e) { drawEnemy(c, e, X(e.x), Y(e.y), cell, col, on, 1, 1); });
    (opts.fx || []).forEach(function (f) {
      if (f.kind !== 'enemy') return;
      var q = progress(f, now); if (q >= 1) return;
      drawEnemy(c, f.e, X(f.e.x), Y(f.e.y), cell, col, on, 1 - q, opts.calm ? 1 : 1 - q * 0.5);
    });

    // spilleren
    var pl = s.player;
    var pAlpha = s.dead ? 0.35 : 1;
    drawPlayer(c, X(pl.x), Y(pl.y), cell, col, on, pAlpha);

    // flammer øverst
    (opts.fx || []).forEach(function (f) {
      if (f.kind !== 'flame') return;
      var q = progress(f, now); if (q >= 1) return;
      f.cells.forEach(function (k) {
        var p = at(k);
        if (p.x < 1 || p.y < 1 || p.x > s.cols - 2 || p.y > s.rows - 2) return;
        drawFlame(c, X(p.x), Y(p.y), cell, col, on, q, opts.calm);
      });
    });

    // markering af det felt, hvor man mistede livet
    if (s.dead) {
      c.save();
      c.strokeStyle = col.danger; c.lineWidth = Math.max(3, cell * 0.08);
      roundRect(c, X(pl.x) + cell * 0.06, Y(pl.y) + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.16); c.stroke();
      c.restore();
    }
  }
  function progress(f, now) { return Math.max(0, Math.min(1, (now - f.t0) / f.dur)); }

  function drawPillar(c, x, y, s, col, on) {
    var g = s * 0.06;
    c.save();
    c.fillStyle = col.pillarFill;
    roundRect(c, x + g, y + g, s - 2 * g, s - 2 * g, s * 0.1); c.fill();
    c.lineWidth = Math.max(2, s * 0.05);
    c.strokeStyle = col.pillarEdge;
    glow(c, col.pillarEdge, s * 0.18, on);
    c.stroke();
    c.shadowBlur = 0;
    // indre ramme: massiv, fast blok
    c.globalAlpha = 0.45; c.lineWidth = Math.max(1, s * 0.025);
    var g2 = s * 0.2;
    roundRect(c, x + g2, y + g2, s - 2 * g2, s - 2 * g2, s * 0.06); c.stroke();
    c.restore();
  }
  // Kasse: glødende glasblok i varm farve, tydeligt anderledes end søjlerne.
  function drawCrate(c, x, y, s, col, on, alpha, scale) {
    c.save();
    c.globalAlpha = alpha;
    var cx = x + s / 2, cy = y + s / 2;
    c.translate(cx, cy); c.scale(scale, scale); c.translate(-cx, -cy);
    var g = s * 0.1, w = s - 2 * g;
    var grad = c.createLinearGradient(x + g, y + g, x + g + w, y + g + w);
    grad.addColorStop(0, col.crateGlass1); grad.addColorStop(1, col.crateGlass2);
    c.fillStyle = grad;
    roundRect(c, x + g, y + g, w, w, s * 0.12); c.fill();
    c.lineWidth = Math.max(2, s * 0.05);
    c.strokeStyle = col.crate;
    glow(c, col.crate, s * 0.3, on);
    c.stroke();
    c.shadowBlur = 0;
    // glasrefleks og fuger
    c.globalAlpha = alpha * 0.55;
    c.lineWidth = Math.max(1.5, s * 0.03);
    c.beginPath();
    c.moveTo(x + s * 0.5, y + g + s * 0.06); c.lineTo(x + s * 0.5, y + s - g - s * 0.06);
    c.moveTo(x + g + s * 0.06, y + s * 0.5); c.lineTo(x + s - g - s * 0.06, y + s * 0.5);
    c.stroke();
    c.globalAlpha = alpha * 0.5;
    c.strokeStyle = col.crateShine; c.lineWidth = Math.max(2, s * 0.04); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + s * 0.24, y + s * 0.36); c.lineTo(x + s * 0.36, y + s * 0.24); c.stroke();
    c.restore();
  }
  function drawItem(c, it, x, y, s, col, on, open) {
    c.save();
    var cx = x + s / 2, cy = y + s / 2;
    if (it === 'door') {
      // udgang: portal. Lukket = dæmpet med lås-streg. Åben = lysende med pil.
      var w = s * 0.6, h = s * 0.72, lx = cx - w / 2, ty = cy - h / 2;
      var colr = open ? col.door : col.doorClosed;
      c.lineWidth = Math.max(2.5, s * 0.06);
      c.strokeStyle = colr;
      c.fillStyle = open ? col.doorFill : 'rgba(0,0,0,0.35)';
      glow(c, colr, s * 0.35, on && open);
      c.beginPath();
      c.moveTo(lx, ty + h); c.lineTo(lx, ty + w / 2); c.arc(cx, ty + w / 2, w / 2, Math.PI, 0); c.lineTo(lx + w, ty + h); c.closePath();
      c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (open) {
        c.beginPath(); c.moveTo(cx, cy + h * 0.25); c.lineTo(cx, cy - h * 0.12);
        c.moveTo(cx - w * 0.22, cy + h * 0.02); c.lineTo(cx, cy - h * 0.16); c.lineTo(cx + w * 0.22, cy + h * 0.02); c.stroke();
      } else {
        c.beginPath(); c.moveTo(cx - w * 0.28, cy + h * 0.08); c.lineTo(cx + w * 0.28, cy + h * 0.08); c.stroke();
        c.beginPath(); c.arc(cx, cy + h * 0.08, s * 0.05, 0, Math.PI * 2); c.fillStyle = colr; c.fill();
      }
      c.restore();
      return;
    }
    // bonus: lille neonplade med ikon
    var r = s * 0.34;
    c.fillStyle = col.pickupFill;
    c.strokeStyle = col.pickup; c.lineWidth = Math.max(2, s * 0.045);
    glow(c, col.pickup, s * 0.3, on);
    roundRect(c, cx - r, cy - r, 2 * r, 2 * r, s * 0.1); c.fill(); c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = col.pickup; c.fillStyle = col.pickup; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = Math.max(2, s * 0.05);
    if (it === 'range') { // flamme-kryds med pile ud
      var a = r * 0.72, hd = r * 0.25;
      c.beginPath();
      c.moveTo(cx - a, cy); c.lineTo(cx + a, cy); c.moveTo(cx, cy - a); c.lineTo(cx, cy + a);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var ex = cx + d[0] * a, ey = cy + d[1] * a;
        c.moveTo(ex - d[0] * hd + d[1] * hd, ey - d[1] * hd + d[0] * hd); c.lineTo(ex, ey);
        c.lineTo(ex - d[0] * hd - d[1] * hd, ey - d[1] * hd - d[0] * hd);
      });
      c.stroke();
    } else if (it === 'bomb') { // lille bombe med plus
      c.beginPath(); c.arc(cx - r * 0.12, cy + r * 0.12, r * 0.46, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx + r * 0.5, cy - r * 0.62); c.lineTo(cx + r * 0.5, cy - r * 0.12);
      c.moveTo(cx + r * 0.25, cy - r * 0.37); c.lineTo(cx + r * 0.75, cy - r * 0.37); c.stroke();
    } else if (it === 'life') { // hjerte
      var hs = r * 0.75;
      c.beginPath();
      c.moveTo(cx, cy + hs * 0.8);
      c.bezierCurveTo(cx - hs * 1.3, cy - hs * 0.05, cx - hs * 0.55, cy - hs * 1.05, cx, cy - hs * 0.35);
      c.bezierCurveTo(cx + hs * 0.55, cy - hs * 1.05, cx + hs * 1.3, cy - hs * 0.05, cx, cy + hs * 0.8);
      c.fill();
    }
    c.restore();
  }
  function drawDanger(c, x, y, s, col, strong) {
    c.save();
    c.beginPath(); c.rect(x, y, s, s); c.clip();
    c.globalAlpha = strong ? 0.26 : 0.08;
    c.fillStyle = col.danger; c.fillRect(x, y, s, s);
    c.globalAlpha = strong ? 0.85 : 0.35;
    c.strokeStyle = col.danger;
    c.lineWidth = Math.max(strong ? 3 : 1.5, s * (strong ? 0.07 : 0.035));
    var step = s * (strong ? 0.25 : 0.33);
    c.beginPath();
    for (var k = -s; k < s * 2; k += step) { c.moveTo(x + k, y + s); c.lineTo(x + k + s, y); }
    c.stroke();
    if (strong) {
      c.globalAlpha = 0.95; c.lineWidth = Math.max(3, s * 0.06);
      roundRect(c, x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.12); c.stroke();
    }
    c.restore();
  }
  function drawArrow(c, e, s, col, X, Y) {
    var cx = X(e.x) + s / 2, cy = Y(e.y) + s / 2;
    c.save();
    c.translate(cx, cy); c.rotate(ROT[e.plan]);
    c.globalAlpha = col.arrowAlpha;
    c.fillStyle = col['e_' + e.type];
    // pilen ligger mellem fjenden og feltet, den går til
    var x0 = s * 0.42, x1 = s * 0.92, hw = s * 0.2, sw = s * 0.07;
    c.beginPath();
    c.moveTo(x0, -sw); c.lineTo(x1 - hw, -sw); c.lineTo(x1 - hw, -hw); c.lineTo(x1, 0);
    c.lineTo(x1 - hw, hw); c.lineTo(x1 - hw, sw); c.lineTo(x0, sw); c.closePath();
    c.fill();
    c.restore();
  }
  function drawBomb(c, x, y, s, col, on, timer) {
    var cx = x + s / 2, cy = y + s * 0.54, r = s * 0.33;
    c.save();
    // lunte med lysende spids (lyser roligt, blinker ikke)
    c.strokeStyle = col.fuse; c.lineWidth = Math.max(2, s * 0.045); c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + r * 0.55, cy - r * 0.75); c.quadraticCurveTo(cx + r * 0.9, cy - r * 1.35, cx + r * 1.15, cy - r * 1.2); c.stroke();
    c.fillStyle = col.fuseTip; glow(c, col.fuseTip, s * 0.35, on);
    c.beginPath(); c.arc(cx + r * 1.15, cy - r * 1.2, Math.max(2.5, s * 0.06), 0, Math.PI * 2); c.fill();
    // kuglen
    var grad = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, col.bombCore); grad.addColorStop(1, col.bombFill);
    c.fillStyle = grad;
    glow(c, col.bomb, s * 0.4, on);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.lineWidth = Math.max(2.5, s * 0.055); c.strokeStyle = col.bomb; c.stroke();
    c.shadowBlur = 0;
    // stort tal
    c.fillStyle = col.bombText;
    c.font = '800 ' + Math.round(s * 0.42) + 'px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(timer), cx, cy + s * 0.02);
    c.restore();
  }
  function drawEnemy(c, e, x, y, s, col, on, alpha, scale) {
    var cx = x + s / 2, cy = y + s / 2, colr = col['e_' + e.type];
    c.save();
    c.globalAlpha = alpha;
    c.translate(cx, cy); c.scale(scale, scale);
    c.fillStyle = col.enemyFill; c.strokeStyle = colr;
    c.lineWidth = Math.max(2.5, s * 0.06); c.lineJoin = 'round';
    glow(c, colr, s * 0.35, on);
    var r = s * 0.34;
    if (e.type === 'wander') {
      // vandrer: kugle med ring
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.lineWidth = Math.max(1.5, s * 0.03);
      c.beginPath(); c.arc(0, 0, r * 0.62, 0, Math.PI * 2); c.stroke();
      c.fillStyle = colr;
      c.beginPath(); c.arc(-r * 0.3, -r * 0.08, r * 0.13, 0, Math.PI * 2); c.arc(r * 0.3, -r * 0.08, r * 0.13, 0, Math.PI * 2); c.fill();
    } else if (e.type === 'chaser') {
      // jæger: spids trekant, der peger i sin retning
      c.rotate(ROT[e.plan || e.dir || 'right']);
      c.beginPath(); c.moveTo(r * 1.1, 0); c.lineTo(-r * 0.8, -r * 0.92); c.lineTo(-r * 0.45, 0); c.lineTo(-r * 0.8, r * 0.92); c.closePath();
      c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = colr;
      c.beginPath(); c.moveTo(r * 0.05, -r * 0.3); c.lineTo(r * 0.45, -r * 0.1); c.lineTo(r * 0.05, -r * 0.05); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(r * 0.05, r * 0.3); c.lineTo(r * 0.45, r * 0.1); c.lineTo(r * 0.05, r * 0.05); c.closePath(); c.fill();
    } else {
      // langsom: tung sekskant med visir. Hviler den, er visiret slukket.
      c.beginPath();
      for (var k = 0; k < 6; k++) { var a = Math.PI / 6 + k * Math.PI / 3; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); }
      c.closePath(); c.fill(); c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = colr; c.globalAlpha = alpha * (e.plan ? 1 : 0.35);
      roundRect(c, -r * 0.6, -r * 0.2, r * 1.2, r * 0.32, r * 0.14); c.fill();
    }
    c.restore();
  }
  function drawPlayer(c, x, y, s, col, on, alpha) {
    var cx = x + s / 2, cy = y + s / 2;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = col.player; c.fillStyle = col.playerFill;
    c.lineWidth = Math.max(2.5, s * 0.06); c.lineJoin = 'round'; c.lineCap = 'round';
    glow(c, col.player, s * 0.4, on);
    // skuldre
    c.beginPath();
    c.moveTo(cx - s * 0.32, cy + s * 0.38);
    c.quadraticCurveTo(cx - s * 0.32, cy + s * 0.1, cx, cy + s * 0.1);
    c.quadraticCurveTo(cx + s * 0.32, cy + s * 0.1, cx + s * 0.32, cy + s * 0.38);
    c.closePath(); c.fill(); c.stroke();
    // hjelm
    c.beginPath(); c.arc(cx, cy - s * 0.1, s * 0.24, 0, Math.PI * 2); c.fill(); c.stroke();
    c.shadowBlur = 0;
    // visir
    c.fillStyle = col.player;
    roundRect(c, cx - s * 0.17, cy - s * 0.15, s * 0.34, s * 0.1, s * 0.05); c.fill();
    c.restore();
  }
  function drawFlame(c, x, y, s, col, on, q, calm) {
    var cx = x + s / 2, cy = y + s / 2;
    c.save();
    var alpha, sc;
    if (calm) { alpha = 0.75 * (1 - q); sc = 1; }
    else { sc = q < 0.25 ? 0.55 + q / 0.25 * 0.45 : 1; alpha = q < 0.25 ? 0.95 : 0.95 * (1 - (q - 0.25) / 0.75); }
    c.globalAlpha = alpha;
    var r = s * 0.48 * sc;
    var grad = c.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, col.flameCore); grad.addColorStop(0.6, col.flame); grad.addColorStop(1, col.flameEdge);
    c.fillStyle = grad;
    glow(c, col.flame, s * 0.4, on && !calm);
    roundRect(c, cx - r, cy - r, 2 * r, 2 * r, r * 0.45); c.fill();
    c.restore();
  }

  global.BomberneRender = { draw: draw };
})(window);
