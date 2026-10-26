/*
 * Flipper – tegning af bordet på et canvas. Ingen spillogik her.
 * Farverne kommer fra CSS-variablerne --fl-* (se css/flipper.css), så temaerne
 * virker. Intet blinker: lys tændes og slukkes med en rolig fade, og der bruges
 * aldrig hvide lysglimt.
 */
(function (global) {
  'use strict';
  var G = global.FlipperGame;

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var col = {}, cssW = 0, cssH = 0, scale = 1, dpr = 1;

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      ['board0', 'board1', 'wall', 'bumper', 'sling', 'target', 'flipper', 'zone', 'loop',
       'ball0', 'ball1', 'ball2', 'left', 'right', 'both', 'none', 'launch', 'lost'].forEach(function (k) {
        col[k] = cs.getPropertyValue('--fl-' + k).trim() || '#ff3fd8';
      });
      col.glow = parseFloat(cs.getPropertyValue('--glow')) || 1;
    }
    function resize(w, h) {
      dpr = Math.min(2.5, global.devicePixelRatio || 1);
      cssW = w; cssH = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      scale = w / G.W;
    }
    function alpha(hex, a) {
      // #rrggbb -> rgba
      var m = /^#([0-9a-f]{6})$/i.exec(hex);
      if (!m) return hex;
      var n = parseInt(m[1], 16);
      return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function glow(c, px) { ctx.shadowColor = c; ctx.shadowBlur = px * col.glow * dpr; }
    function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
    function line(ax, ay, bx, by) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }

    // ---------- Bordet ----------
    function drawTable(state, o) {
      var W = G.W, H = G.H;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, col.board0); g.addColorStop(1, col.board1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Svagt gitter (synthwave)
      ctx.strokeStyle = alpha(col.wall, 0.07); ctx.lineWidth = 1.5;
      for (var y = 260; y < H; y += 60) line(20, y, G.LANE_X, y);
      for (var x = 80; x < G.LANE_X; x += 80) line(x, 230, x, H);
      // Frysezonen
      var zk = o.freezeK || 0;
      ctx.fillStyle = alpha(col.zone, 0.05 + 0.05 * zk);
      ctx.fillRect(20, G.ZONE_Y, G.LANE_X - 20, H - G.ZONE_Y);
      ctx.setLineDash([14, 12]); ctx.lineWidth = 2.5; ctx.strokeStyle = alpha(col.zone, 0.35 + 0.3 * zk);
      line(20, G.ZONE_Y, G.LANE_X, G.ZONE_Y);
      ctx.setLineDash([]);
      // Afløbet i midten
      ctx.fillStyle = alpha(col.lost, 0.12);
      ctx.fillRect(G.FLIPPERS.left.x + 40, H - 14, G.FLIPPERS.right.x - G.FLIPPERS.left.x - 80, 14);

      // Sløjfernes pile
      G.LOOPS.forEach(function (lp) {
        var on = o.flash['loop-' + lp.side] || 0, cx = (lp.x0 + lp.x1) / 2;
        ctx.strokeStyle = alpha(col.loop, 0.35 + 0.6 * on); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (on > 0.05) glow(col.loop, 12 * on);
        for (var k = 0; k < 3; k++) {
          var yy = 400 - k * 34;
          ctx.beginPath(); ctx.moveTo(cx - 13, yy + 10); ctx.lineTo(cx, yy - 4); ctx.lineTo(cx + 13, yy + 10); ctx.stroke();
        }
        noGlow();
      });
      // Afskydningsbanen
      ctx.fillStyle = alpha(col.launch, 0.06);
      ctx.fillRect(G.LANE_X, 230, 580 - G.LANE_X, H - 230);

      // Slynger
      G.SLINGS.forEach(function (sl) {
        var on = o.flash['sling-' + sl.side] || 0, p = sl.pts;
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath();
        ctx.fillStyle = alpha(col.sling, 0.18 + 0.3 * on); ctx.fill();
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = col.sling;
        glow(col.sling, 10 + 10 * on); ctx.stroke(); noGlow();
      });
      // Vægge
      ctx.lineCap = 'round';
      G.WALLS.forEach(function (w) {
        if (w.kind === 'target' || w.kind === 'sling') return;
        ctx.strokeStyle = w.kind === 'gate' ? alpha(col.launch, 0.8) : col.wall;
        ctx.lineWidth = w.kind === 'gate' ? 4 : Math.max(5, w.r * 2);
        glow(ctx.strokeStyle, 8);
        line(w.ax, w.ay, w.bx, w.by);
      });
      noGlow();
      // Lysmål
      G.TARGETS.forEach(function (t, i) {
        var lit = state.lights[i], on = o.flash['target-' + i] || 0;
        var x = t.ax - 4, y = t.ay - 8, w = t.bx - t.ax + 8, h = 16;
        ctx.beginPath(); roundRect(x, y, w, h, 6);
        ctx.fillStyle = lit ? col.target : alpha(col.target, 0.12 + 0.3 * on);
        if (lit) glow(col.target, 14);
        ctx.fill(); noGlow();
        ctx.lineWidth = 3; ctx.strokeStyle = col.target; ctx.stroke();
      });
      // Bumpere
      G.BUMPERS.forEach(function (bp, i) {
        var on = o.flash['bumper-' + i] || 0;
        var rg = ctx.createRadialGradient(bp.x - 8, bp.y - 10, 4, bp.x, bp.y, bp.r);
        rg.addColorStop(0, alpha(col.bumper, 0.55 + 0.35 * on)); rg.addColorStop(1, alpha(col.bumper, 0.12 + 0.25 * on));
        ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); ctx.fillStyle = rg;
        glow(col.bumper, 12 + 14 * on); ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = col.bumper; ctx.stroke(); noGlow();
        ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r * 0.45, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = alpha(col.bumper, 0.7); ctx.stroke();
      });
    }
    function roundRect(x, y, w, h, r) {
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    }
    function drawFlippers(run, o) {
      ['left', 'right'].forEach(function (side) {
        var s = run.flipperSegment(side), armed = run.state.armed && run.state.armed[side];
        var c = side === 'left' ? col.left : col.right;
        ctx.lineCap = 'round';
        ctx.strokeStyle = col.flipper; ctx.lineWidth = G.FLIP_R * 2;
        glow(armed ? c : col.flipper, armed ? 18 : 10);
        line(s.ax, s.ay, s.bx, s.by); noGlow();
        ctx.strokeStyle = armed ? c : alpha('#000000', 0.45); ctx.lineWidth = G.FLIP_R * 0.9;
        line(s.ax, s.ay, s.bx, s.by);
        ctx.beginPath(); ctx.arc(s.ax, s.ay, 5, 0, Math.PI * 2); ctx.fillStyle = col.board1; ctx.fill();
      });
    }
    // Stempel og kraftmåler i afskydningsbanen
    function drawPlunger(state, o) {
      var x0 = G.LANE_X + 6, x1 = 574, top = G.REST.y + G.R + 2;
      var p = state.phase === 'launch' ? state.power : 0;
      var pull = p ? 8 + p * 6 : 0;
      ctx.fillStyle = alpha(col.launch, 0.8);
      ctx.fillRect(x0 + 6, top + pull * 0.2, x1 - x0 - 12, 6);
      if (state.phase === 'launch') {
        for (var i = 0; i < 5; i++) {
          var y = 950 - i * 26;
          ctx.beginPath(); roundRect(x0 + 2, y - 16, x1 - x0 - 4, 18, 4);
          ctx.fillStyle = i < p ? alpha(col.launch, 0.75) : alpha(col.launch, 0.1);
          ctx.fill();
        }
      }
    }
    function drawPath(pts, c, width, a, dashed) {
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (dashed) ctx.setLineDash([10, 12]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.restore();
    }
    function drawEnd(p, c, a) {
      var e = p.path[p.path.length - 1];
      ctx.save(); ctx.globalAlpha = a;
      if (p.drained) {
        // Tabt: et kryds ved afløbet
        var x = Math.max(40, Math.min(G.LANE_X - 20, e.x)), y = G.H - 30;
        ctx.strokeStyle = col.lost; ctx.lineWidth = 6; ctx.lineCap = 'round';
        line(x - 13, y - 13, x + 13, y + 13); line(x + 13, y - 13, x - 13, y + 13);
      } else {
        ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
      }
      ctx.restore();
    }
    var ORDER = ['none', 'both', 'right', 'left'];
    function drawPreviews(o) {
      var pv = o.previews; if (!pv) return;
      var k = o.freezeK == null ? 1 : o.freezeK;
      ORDER.forEach(function (opt) {
        var p = pv[opt]; if (!p || opt === o.focus) return;
        var a = (o.focus ? 0.35 : 0.6) * k;
        drawPath(p.path, col[opt], 5, a, opt === 'none');
        drawEnd(p, col[opt], a);
      });
      if (o.focus && pv[o.focus]) {
        var p = pv[o.focus];
        glow(col[o.focus], 10);
        drawPath(p.path, col[o.focus], 8, 0.95 * k, o.focus === 'none');
        noGlow();
        drawEnd(p, col[o.focus], k);
      }
    }
    function drawBall(b, o) {
      // Spor bag kuglen (vises altid med reduceret bevægelse, så banen kan følges)
      var tr = o.trail || [];
      if (tr.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var i = 1; i < tr.length; i++) {
          var a = (i / tr.length) * (o.calm ? 0.5 : 0.3);
          ctx.strokeStyle = alpha(col.ball1, a); ctx.lineWidth = G.R * (o.calm ? 0.9 : 0.7) * (i / tr.length) + 1;
          line(tr[i - 1].x, tr[i - 1].y, tr[i].x, tr[i].y);
        }
      }
      var rg = ctx.createRadialGradient(b.x - 4, b.y - 5, 1, b.x, b.y, G.R);
      rg.addColorStop(0, col.ball0); rg.addColorStop(0.55, col.ball1); rg.addColorStop(1, col.ball2);
      ctx.beginPath(); ctx.arc(b.x, b.y, G.R, 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = alpha('#000000', 0.5); ctx.stroke();
    }

    function draw(run, o) {
      o = o || {};
      o.flash = o.flash || {};
      var state = run.state;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, G.W, G.H);
      ctx.save();
      // Afrundede hjørner
      ctx.beginPath(); roundRect(0, 0, G.W, G.H, 22 / Math.max(scale, 0.01) * 0.6); ctx.clip();
      drawTable(state, o);
      drawPlunger(state, o);
      drawFlippers(run, o);
      var k = o.freezeK || 0;
      // Frys: bordet dæmpes roligt, kuglen og sigtelinjerne står klart frem
      if (k > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (0.42 * k) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
      if (o.launchPreview) {
        drawPath(o.launchPreview.path, col.launch, 5, 0.6, true);
      }
      drawPreviews(o);
      if (state.phase !== 'lost' && state.phase !== 'over') {
        if (k > 0) {
          ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, G.R + 12, 0, Math.PI * 2);
          ctx.strokeStyle = alpha(col.zone, 0.85 * k); ctx.lineWidth = 3; ctx.stroke();
        }
        drawBall(state.ball, o);
      }
      ctx.restore();
      // Ramme
      ctx.lineWidth = 6; ctx.strokeStyle = col.wall;
      glow(col.wall, 14);
      ctx.beginPath(); roundRect(3, 3, G.W - 6, G.H - 6, 18); ctx.stroke(); noGlow();
    }

    readColors();
    return { draw: draw, resize: resize, readColors: readColors, get scale() { return scale; } };
  }

  global.FlipperRender = { create: create };
})(window);
