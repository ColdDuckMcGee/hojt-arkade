/*
 * Labyrinten – tegner brættet på et <canvas>. Farverne kommer fra temaets
 * CSS-variabler (se css/labyrinten.css), så nye temaer kun kræver CSS.
 * Ingen blink: alt tegnes stille, og bevægelse er kun den rolige glidning.
 */
(function (global) {
  'use strict';

  var DIRS = { up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 } };
  var ANG = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

  function ghostPath(c, cx, cy, r) {
    // kuppel foroven og tre bløde "takker" forneden
    var top = cy - r * 0.15, bottom = cy + r * 0.92, left = cx - r * 0.9, right = cx + r * 0.9;
    c.beginPath();
    c.moveTo(left, bottom);
    c.lineTo(left, top);
    c.arc(cx, top, r * 0.9, Math.PI, 0, false);
    c.lineTo(right, bottom);
    var w = (right - left) / 3;
    for (var i = 0; i < 3; i++) {
      var x0 = right - i * w;
      c.quadraticCurveTo(x0 - w / 2, bottom - r * 0.32, x0 - w, bottom);
    }
    c.closePath();
  }
  function eyes(c, cx, cy, r, dir, col, pupil) {
    var d = DIRS[dir] || { x: 0, y: 0 };
    [-1, 1].forEach(function (s) {
      var ex = cx + s * r * 0.34, ey = cy - r * 0.18;
      c.fillStyle = col;
      c.beginPath(); c.ellipse(ex, ey, r * 0.22, r * 0.27, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = pupil;
      c.beginPath(); c.arc(ex + d.x * r * 0.1, ey + d.y * r * 0.12, r * 0.11, 0, Math.PI * 2); c.fill();
    });
  }
  function badge(c, x, y, r, text, fill, color, font) {
    c.fillStyle = fill;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = color;
    c.font = 'bold ' + Math.round(r * 1.25) + 'px ' + font;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, x, y + r * 0.06);
  }

  /*
   * view = { maze, items, player:{x,y,dir}, ghosts:[{x,y,type,mode,scared,wait,intent}],
   *          fright, preview:{ path, ghosts, caughtAt } | null }
   */
  function draw(canvas, view, colors) {
    var c = canvas.getContext('2d');
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    var dpr = canvas.width / (cw || 1) || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    var m = view.maze, cell = cw / m.w;
    var glow = colors.glow;
    var font = 'system-ui, "Segoe UI", sans-serif';

    // gange
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

    // forhåndsvisning af det træk, blikket hviler på
    var pv = view.preview;
    if (pv && pv.path && pv.path.length) {
      c.save();
      c.strokeStyle = colors.preview; c.lineWidth = Math.max(3, cell * 0.12);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.setLineDash([cell * 0.05, cell * 0.25]);
      c.beginPath();
      c.moveTo((view.player.x + 0.5) * cell, (view.player.y + 0.5) * cell);
      pv.path.forEach(function (p) { c.lineTo((p.x + 0.5) * cell, (p.y + 0.5) * cell); });
      c.stroke();
      c.setLineDash([]);
      var end = pv.path[pv.path.length - 1];
      c.lineWidth = Math.max(2, cell * 0.07);
      c.beginPath(); c.arc((end.x + 0.5) * cell, (end.y + 0.5) * cell, cell * 0.42, 0, Math.PI * 2); c.stroke();
      // hvor spøgelserne står bagefter (stiplede omrids)
      (pv.ghosts || []).forEach(function (g) {
        var gv = view.ghosts[g.id];
        if (!gv || (gv.x === g.x && gv.y === g.y)) return;
        c.strokeStyle = g.mode === 'eyes' ? colors.eyes : g.scared ? colors.scared : colors.ghost[gv.type];
        c.lineWidth = Math.max(2, cell * 0.06);
        c.setLineDash([cell * 0.12, cell * 0.1]);
        ghostPath(c, (g.x + 0.5) * cell, (g.y + 0.5) * cell, cell * 0.4);
        c.stroke();
        c.setLineDash([]);
      });
      if (pv.caughtAt) {
        var kx = (pv.caughtAt.x + 0.5) * cell, ky = (pv.caughtAt.y + 0.5) * cell, kr = cell * 0.36;
        c.strokeStyle = colors.danger; c.lineWidth = Math.max(4, cell * 0.14);
        c.beginPath();
        c.moveTo(kx - kr, ky - kr); c.lineTo(kx + kr, ky + kr);
        c.moveTo(kx + kr, ky - kr); c.lineTo(kx - kr, ky + kr);
        c.stroke();
      }
      c.restore();
    }

    // spøgelser
    view.ghosts.forEach(function (g) {
      var gx = (g.x + 0.5) * cell, gy = (g.y + 0.5) * cell, r = cell * 0.42;
      var col = g.mode === 'eyes' ? colors.eyes : g.scared ? colors.scared : colors.ghost[g.type];
      c.save();
      if (g.mode !== 'eyes') {
        c.fillStyle = col;
        if (glow) { c.shadowColor = col; c.shadowBlur = cell * 0.4; }
        ghostPath(c, gx, gy, r); c.fill();
        c.shadowBlur = 0;
        if (g.scared) {
          // bange: tallet viser, hvor mange felter de er bange endnu (ingen blink)
          c.fillStyle = colors.scaredText;
          c.font = 'bold ' + Math.round(cell * 0.4) + 'px ' + font;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(view.fright), gx, gy + r * 0.12);
        } else {
          eyes(c, gx, gy, r, g.intent || g.dir, colors.eyeWhite, colors.pupil);
        }
      } else {
        eyes(c, gx, gy + r * 0.2, r * 1.1, g.intent || g.dir, colors.eyes, colors.pupil);
      }
      // pil: hvor spøgelset er på vej hen
      if (g.intent && !view.moving) {
        var d = DIRS[g.intent], ax = gx + d.x * cell * 0.62, ay = gy + d.y * cell * 0.62;
        c.translate(ax, ay); c.rotate(ANG[g.intent]);
        c.fillStyle = col;
        c.strokeStyle = colors.board; c.lineWidth = Math.max(1, cell * 0.03);
        c.beginPath(); c.moveTo(cell * 0.17, 0); c.lineTo(-cell * 0.1, -cell * 0.15); c.lineTo(-cell * 0.1, cell * 0.15); c.closePath();
        c.fill(); c.stroke();
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      // venter hjemme: tallet er antal felter, til det går ud
      if (g.wait > 0 && g.mode !== 'eyes') {
        badge(c, gx + r * 0.75, gy - r * 0.75, Math.max(8, cell * 0.2), String(g.wait), colors.board, col, font);
      }
      c.restore();
    });

    // spilleren
    var p = view.player, pcx = (p.x + 0.5) * cell, pcy = (p.y + 0.5) * cell, pr = cell * 0.42;
    var a = ANG[p.dir] || 0, mouth = Math.PI * 0.22;
    c.save();
    c.fillStyle = colors.player;
    if (glow) { c.shadowColor = colors.player; c.shadowBlur = cell * 0.5; }
    c.beginPath();
    c.moveTo(pcx, pcy);
    c.arc(pcx, pcy, pr, a + mouth, a - mouth + Math.PI * 2, false);
    c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = colors.playerRim; c.lineWidth = Math.max(1.5, cell * 0.04); c.stroke();
    c.restore();
  }

  global.LabyrintenRender = { draw: draw };
})(window);
