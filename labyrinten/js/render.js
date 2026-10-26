/*
 * Labyrinten – tegner brættet på et <canvas>. Farverne kommer fra temaets
 * CSS-variabler (se css/labyrinten.css), så nye temaer kun kræver CSS.
 * Ingen blink: alt tegnes stille. Den eneste bevægelse er en kort, rolig glidning
 * fra ét felt til det næste (og et lille ryk, når man går mod en væg).
 *
 * Figurer: spilleren er en rund lygte med en lille pil, der viser retningen.
 * Vagterne er firkantede robotvagter med et visir; prikken i visiret kigger den vej,
 * vagten går. Sårbare vagter er mørkeblå med et tal, der tæller ned.
 */
(function (global) {
  'use strict';

  var DIRS = { up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } };
  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  // Vagtens krop: afrundet firkant med en lille "hjelmkam" foroven.
  function guardBody(c, cx, cy, r) {
    roundRect(c, cx - r * 0.86, cy - r * 0.72, r * 1.72, r * 1.6, r * 0.32);
  }
  function guardCrest(c, cx, cy, r) {
    roundRect(c, cx - r * 0.3, cy - r * 0.98, r * 0.6, r * 0.3, r * 0.12);
  }
  // Visir: en vandret bjælke med en lys prik, der kigger i gåretningen.
  function visor(c, cx, cy, r, dir, band, dot) {
    var d = DIRS[dir] || { x: 0, y: 0 };
    c.fillStyle = band;
    roundRect(c, cx - r * 0.62, cy - r * 0.32, r * 1.24, r * 0.46, r * 0.2); c.fill();
    c.fillStyle = dot;
    c.beginPath(); c.arc(cx + d.x * r * 0.36, cy - r * 0.09 + d.y * r * 0.08, r * 0.17, 0, Math.PI * 2); c.fill();
  }
  function badge(c, x, y, r, text, fill, color, font) {
    c.fillStyle = fill;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = color; c.lineWidth = Math.max(1, r * 0.15); c.stroke();
    c.fillStyle = color;
    c.font = 'bold ' + Math.round(r * 1.2) + 'px ' + font;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y + r * 0.06);
  }
  function arrowHead(c, x, y, dir, size, fill, stroke, lw) {
    c.save();
    c.translate(x, y); c.rotate(ANG[dir]);
    c.beginPath(); c.moveTo(size, 0); c.lineTo(-size * 0.6, -size * 0.85); c.lineTo(-size * 0.6, size * 0.85); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
    c.restore();
  }
  function guardColor(g, colors) {
    return g.mode === 'eyes' ? colors.eyes : g.scared ? colors.scared : colors.guard[g.type];
  }

  /*
   * view = { maze, items, player:{x,y,dir}, guards:[{x,y,type,mode,scared,wait,plan}],
   *          fright, showPlans, preview:{ path, guards, caughtAt } | { bump, dir } | null,
   *          bump:{ dir } | null }
   */
  function draw(canvas, view, colors) {
    var c = canvas.getContext('2d');
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    var dpr = canvas.width / cw || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    var m = view.maze, cell = cw / m.w;
    var glow = colors.glow;
    var font = 'system-ui, "Segoe UI", sans-serif';

    c.fillStyle = colors.board;
    c.fillRect(0, 0, cw, ch);

    // vægge: mørk fyld og en neonkant langs alle sider, der vender mod en gang
    c.fillStyle = colors.wallFill;
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) {
      if (m.walls[y * m.w + x]) c.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
    c.save();
    c.strokeStyle = colors.wall;
    c.lineWidth = Math.max(2, cell * 0.08);
    c.lineCap = 'round';
    if (glow) { c.shadowColor = colors.wall; c.shadowBlur = cell * 0.35; }
    c.beginPath();
    var inset = cell * 0.14;
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      if (!m.walls[y * m.w + x]) continue;
      var x0 = x * cell, y0 = y * cell, x1 = x0 + cell, y1 = y0 + cell;
      if (m.open(x, y - 1)) { c.moveTo(x0, y0 + inset); c.lineTo(x1, y0 + inset); }
      if (m.open(x, y + 1)) { c.moveTo(x0, y1 - inset); c.lineTo(x1, y1 - inset); }
      if (m.open(x - 1, y)) { c.moveTo(x0 + inset, y0); c.lineTo(x0 + inset, y1); }
      if (m.open(x + 1, y)) { c.moveTo(x1 - inset, y0); c.lineTo(x1 - inset, y1); }
    }
    c.stroke();
    c.restore();

    // prikker og kraftpiller
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var it = view.items[y * m.w + x];
      if (!it) continue;
      var px = (x + 0.5) * cell, py = (y + 0.5) * cell;
      c.save();
      if (it === 1) {
        c.fillStyle = colors.dot;
        c.beginPath(); c.arc(px, py, Math.max(2.5, cell * 0.11), 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = colors.pellet;
        if (glow) { c.shadowColor = colors.pellet; c.shadowBlur = cell * 0.5; }
        c.beginPath(); c.arc(px, py, cell * 0.27, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = colors.board; c.lineWidth = Math.max(1.5, cell * 0.05);
        c.beginPath(); c.arc(px, py, cell * 0.13, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
    }

    // vagternes næste træk (svagt): stiplet omrids i feltet, de går til, og en lille pil
    if (view.showPlans) {
      view.guards.forEach(function (g) {
        if (!g.plan) return;
        var col = guardColor(g, colors);
        var last = g.plan.path[g.plan.path.length - 1];
        c.save();
        c.globalAlpha = 0.5;
        c.strokeStyle = col; c.lineWidth = Math.max(1.5, cell * 0.05);
        c.setLineDash([cell * 0.1, cell * 0.09]);
        guardBody(c, (last.x + 0.5) * cell, (last.y + 0.5) * cell, cell * 0.36);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha = 0.75;
        var d = DIRS[g.plan.dir];
        arrowHead(c, (g.x + 0.5 + d.x * 0.62) * cell, (g.y + 0.5 + d.y * 0.62) * cell, g.plan.dir, cell * 0.15, col, colors.board, Math.max(1, cell * 0.03));
        c.restore();
      });
    }

    // forhåndsvisning af det træk, blikket hviler på
    var pv = view.preview;
    if (pv && pv.bump) {
      // pilen peger ind i en væg: en kort bjælke ved væggen
      var bd = DIRS[pv.dir], bx = (view.player.x + 0.5 + bd.x * 0.5) * cell, by = (view.player.y + 0.5 + bd.y * 0.5) * cell;
      c.save();
      c.strokeStyle = colors.preview; c.lineWidth = Math.max(3, cell * 0.1); c.lineCap = 'round';
      c.beginPath();
      if (bd.x) { c.moveTo(bx, by - cell * 0.32); c.lineTo(bx, by + cell * 0.32); }
      else { c.moveTo(bx - cell * 0.32, by); c.lineTo(bx + cell * 0.32, by); }
      c.stroke();
      c.restore();
    } else if (pv && pv.path && pv.path.length) {
      c.save();
      var end = pv.path[pv.path.length - 1];
      c.strokeStyle = colors.preview; c.lineWidth = Math.max(2, cell * 0.07);
      c.beginPath(); c.arc((end.x + 0.5) * cell, (end.y + 0.5) * cell, cell * 0.44, 0, Math.PI * 2); c.stroke();
      // hvor vagterne står bagefter (stiplede omrids) – kun når næste træk ikke allerede vises
      if (!view.showPlans) {
        (pv.guards || []).forEach(function (g) {
          var gv = view.guards[g.id];
          if (!gv || (gv.x === g.x && gv.y === g.y)) return;
          c.strokeStyle = guardColor({ mode: g.mode, scared: g.scared, type: gv.type }, colors);
          c.lineWidth = Math.max(2, cell * 0.06);
          c.setLineDash([cell * 0.12, cell * 0.1]);
          guardBody(c, (g.x + 0.5) * cell, (g.y + 0.5) * cell, cell * 0.36);
          c.stroke();
          c.setLineDash([]);
        });
      }
      if (pv.caughtAt) {
        var kx = (pv.caughtAt.x + 0.5) * cell, ky = (pv.caughtAt.y + 0.5) * cell, kr = cell * 0.34;
        c.strokeStyle = colors.danger; c.lineWidth = Math.max(4, cell * 0.13); c.lineCap = 'round';
        c.beginPath();
        c.moveTo(kx - kr, ky - kr); c.lineTo(kx + kr, ky + kr);
        c.moveTo(kx + kr, ky - kr); c.lineTo(kx - kr, ky + kr);
        c.stroke();
      }
      c.restore();
    }

    // vagter
    view.guards.forEach(function (g) {
      var gx = (g.x + 0.5) * cell, gy = (g.y + 0.5) * cell, r = cell * 0.4;
      var col = guardColor(g, colors);
      var look = g.plan ? g.plan.dir : g.dir;
      c.save();
      if (g.mode === 'eyes') {
        // slået ud: kun visiret er tilbage, og det løber hjem
        visor(c, gx, gy + r * 0.1, r, look, colors.eyes, colors.pupil);
      } else {
        c.fillStyle = col;
        if (glow && !g.scared) { c.shadowColor = col; c.shadowBlur = cell * 0.35; }
        guardBody(c, gx, gy, r); c.fill();
        guardCrest(c, gx, gy, r); c.fill();
        c.shadowBlur = 0;
        if (g.scared) {
          c.strokeStyle = colors.scaredRim; c.lineWidth = Math.max(1.5, cell * 0.05);
          guardBody(c, gx, gy, r); c.stroke();
          // sårbar: tallet viser, hvor mange træk endnu (ingen blink)
          c.fillStyle = colors.scaredText;
          c.font = 'bold ' + Math.round(cell * 0.46) + 'px ' + font;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(view.fright), gx, gy + r * 0.12);
        } else {
          visor(c, gx, gy, r, look, colors.visor, colors.visorDot);
        }
      }
      // venter hjemme: tallet er antal træk, til den går ud
      if (g.wait > 0 && g.mode !== 'eyes') {
        badge(c, gx + r * 0.85, gy - r * 0.85, Math.max(8, cell * 0.2), String(g.wait), colors.board, col, font);
      }
      c.restore();
    });

    // spilleren: rund lygte med en lille retningspil
    var p = view.player, pcx = (p.x + 0.5) * cell, pcy = (p.y + 0.5) * cell, pr = cell * 0.38;
    c.save();
    c.fillStyle = colors.player;
    if (glow) { c.shadowColor = colors.player; c.shadowBlur = cell * 0.5; }
    c.beginPath(); c.arc(pcx, pcy, pr, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = colors.playerRim; c.lineWidth = Math.max(1.5, cell * 0.05); c.stroke();
    c.fillStyle = colors.board;
    c.beginPath(); c.arc(pcx, pcy, pr * 0.42, 0, Math.PI * 2); c.fill();
    var pd = DIRS[p.dir] || DIRS.left;
    arrowHead(c, pcx + pd.x * pr * 0.62, pcy + pd.y * pr * 0.62, p.dir || 'left', pr * 0.3, colors.board, null, 0);
    c.restore();

    // lille ryk mod væggen: en kort, stille streg ved væggen (bruges også uden animation)
    if (view.bump) {
      var wd = DIRS[view.bump.dir];
      var wx = (Math.round(p.x) + 0.5 + wd.x * 0.5) * cell, wy = (Math.round(p.y) + 0.5 + wd.y * 0.5) * cell;
      c.save();
      c.strokeStyle = colors.playerRim; c.lineWidth = Math.max(3, cell * 0.09); c.lineCap = 'round';
      c.beginPath();
      if (wd.x) { c.moveTo(wx, wy - cell * 0.25); c.lineTo(wx, wy + cell * 0.25); }
      else { c.moveTo(wx - cell * 0.25, wy); c.lineTo(wx + cell * 0.25, wy); }
      c.stroke();
      c.restore();
    }
  }

  global.LabyrintenRender = { draw: draw };
})(window);
