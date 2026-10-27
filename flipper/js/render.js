/*
 * Flipper – tegning af bordet på et canvas. Ingen spillogik her.
 * Farverne kommer fra CSS-variablerne --fl-* (se css/flipper.css), så temaerne
 * virker. Intet blinker: lys tændes og slukkes med en rolig fade, og der bruges
 * aldrig hvide lysglimt.
 * Hvert bord har sin egen farvepalet (def.palette), som lægges oven på temaet –
 * undtagen i temaet Høj kontrast, hvor kontrastfarverne altid bruges.
 * Alt tegnes ud fra bordets data (run.table), så nye borde tegnes automatisk.
 */
(function (global) {
  'use strict';
  var G = global.FlipperGame;

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var col = {}, base = {}, cssW = 0, cssH = 0, scale = 1, dpr = 1, T = null, colFor = null;
    var KEYS = ['board0', 'board1', 'wall', 'bumper', 'sling', 'target', 'flipper', 'zone', 'loop',
      'ball0', 'ball1', 'ball2', 'left', 'right', 'both', 'none', 'upper', 'launch', 'lost'];
    // Farver bordets palet må ændre (valgfarverne og frysezonen er altid temaets)
    var TABLE_KEYS = ['board0', 'board1', 'wall', 'bumper', 'sling', 'target', 'flipper', 'loop', 'ramp', 'spinner', 'hole', 'lane', 'drop'];

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      KEYS.forEach(function (k) { base[k] = cs.getPropertyValue('--fl-' + k).trim() || '#ff3fd8'; });
      base.glow = parseFloat(cs.getPropertyValue('--glow')) || 1;
      base.kontrast = document.documentElement.getAttribute('data-theme') === 'kontrast';
      colFor = null;
    }
    function useTable(t) {
      if (T === t && colFor === t.id) return;
      T = t; colFor = t.id;
      col = Object.assign({}, base);
      // Afledte farver til de nye dele
      col.ramp = base.loop; col.spinner = base.target; col.hole = base.bumper; col.lane = base.target; col.drop = base.sling;
      var pal = t.def.palette;
      if (pal && !base.kontrast) TABLE_KEYS.forEach(function (k) { if (pal[k]) col[k] = pal[k]; });
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
      var W = G.W, H = G.H, F = T.flippers;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, col.board0); g.addColorStop(1, col.board1);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Svagt gitter (synthwave)
      ctx.strokeStyle = alpha(col.wall, 0.07); ctx.lineWidth = 1.5;
      for (var y = 260; y < H; y += 60) line(20, y, G.LANE_X, y);
      for (var x = 80; x < G.LANE_X; x += 80) line(x, 230, x, H);
      drawDecor();
      // Frysezonen
      var zk = o.freezeK || 0;
      ctx.fillStyle = alpha(col.zone, 0.05 + 0.05 * zk);
      ctx.fillRect(20, G.ZONE_Y, G.LANE_X - 20, H - G.ZONE_Y);
      ctx.setLineDash([14, 12]); ctx.lineWidth = 2.5; ctx.strokeStyle = alpha(col.zone, 0.35 + 0.3 * zk);
      line(20, G.ZONE_Y, G.LANE_X, G.ZONE_Y);
      ctx.setLineDash([]);
      // Afløbet i midten
      ctx.fillStyle = alpha(col.lost, 0.12);
      ctx.fillRect(F.left.x + 40, H - 14, F.right.x - F.left.x - 80, 14);

      // Sløjfernes pile
      T.loops.forEach(function (lp) {
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
      T.slings.forEach(function (sl) {
        var on = o.flash['sling-' + sl.side] || 0, p = sl.pts;
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath();
        ctx.fillStyle = alpha(col.sling, 0.18 + 0.3 * on); ctx.fill();
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = col.sling;
        glow(col.sling, 10 + 10 * on); ctx.stroke(); noGlow();
      });
      // Vægge
      ctx.lineCap = 'round';
      drawSpinners(o);
      drawRollovers(state, o);
      T.walls.forEach(function (w) {
        if (w.kind === 'target' || w.kind === 'sling' || w.kind === 'drop') return;
        ctx.strokeStyle = w.kind === 'gate' ? alpha(col.launch, 0.8) : w.kind === 'ramp' ? col.ramp : col.wall;
        ctx.lineWidth = w.kind === 'gate' ? 4 : Math.max(5, w.r * 2);
        glow(ctx.strokeStyle, 8);
        line(w.ax, w.ay, w.bx, w.by);
      });
      noGlow();
      // Lysmål
      T.targets.forEach(function (t, i) {
        var lit = state.lights[i], on = o.flash['target-' + i] || 0;
        var x = t.ax - 4, y = t.ay - 8, w = t.bx - t.ax + 8, h = 16;
        ctx.beginPath(); roundRect(x, y, w, h, 6);
        ctx.fillStyle = lit ? col.target : alpha(col.target, 0.12 + 0.3 * on);
        if (lit) glow(col.target, 14);
        ctx.fill(); noGlow();
        ctx.lineWidth = 3; ctx.strokeStyle = col.target; ctx.stroke();
      });
      // Bumpere
      drawDrops(state, o);
      drawHoles(state, o);
      T.bumpers.forEach(function (bp, i) {
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
    // ---------- Pynt (påvirker ikke kuglen) ----------
    function rng(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function drawDecor() {
      (T.def.decor || []).forEach(function (d) {
        var r = rng(d.seed || 5), i;
        ctx.save();
        if (d.type === 'skyline') {
          // Bygninger i silhuet med enkelte tændte vinduer
          ctx.fillStyle = alpha(col.wall, 0.07); ctx.strokeStyle = alpha(col.wall, 0.22); ctx.lineWidth = 2;
          for (var x = d.x0; x < d.x1;) {
            var bw = 22 + Math.floor(r() * 26), bh = 40 + Math.floor(r() * 110);
            bw = Math.min(bw, d.x1 - x);
            ctx.fillRect(x, d.y - bh, bw - 4, bh); ctx.strokeRect(x, d.y - bh, bw - 4, bh);
            ctx.fillStyle = alpha(col.target, 0.22);
            for (var wy = d.y - bh + 10; wy < d.y - 10; wy += 16) for (var wx = x + 5; wx < x + bw - 12; wx += 10) if (r() < 0.3) ctx.fillRect(wx, wy, 4, 6);
            ctx.fillStyle = alpha(col.wall, 0.07);
            x += bw;
          }
        } else if (d.type === 'stars') {
          ctx.fillStyle = alpha(col.wall, 0.35);
          for (i = 0; i < d.n; i++) { var sx = 30 + r() * 500, sy = 40 + r() * 760, sr = 0.8 + r() * 1.8; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); }
        } else if (d.type === 'planet') {
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fillStyle = alpha(col.bumper, 0.08); ctx.fill();
          ctx.strokeStyle = alpha(col.bumper, 0.25); ctx.lineWidth = 3; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 1.7, d.r * 0.35, -0.3, 0, Math.PI * 2);
          ctx.strokeStyle = alpha(col.target, 0.22); ctx.stroke();
        } else if (d.type === 'bubbles') {
          ctx.strokeStyle = alpha(col.wall, 0.25); ctx.lineWidth = 2;
          for (i = 0; i < d.n; i++) { var bx = 30 + r() * 500, by = 60 + r() * 740, br = 2 + r() * 7; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke(); }
        } else if (d.type === 'kelp') {
          ctx.strokeStyle = alpha(col.ramp, 0.2); ctx.lineWidth = 6; ctx.lineCap = 'round';
          (d.xs || [d.x]).forEach(function (kx) {
            ctx.beginPath(); ctx.moveTo(kx, d.y);
            for (var ky = d.y; ky > d.y - (d.h || 260); ky -= 20) ctx.quadraticCurveTo(kx + (((d.y - ky) / 20) % 2 ? 14 : -14), ky - 10, kx, ky - 20);
            ctx.stroke();
          });
        }
        ctx.restore();
      });
    }
    // ---------- Bordets dele ----------
    function label(text, x, y, size, c, a) {
      ctx.save();
      ctx.font = '700 ' + size + 'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = alpha(c, a == null ? 0.85 : a);
      ctx.fillText(text, x, y);
      ctx.restore();
    }
    function drawRamps(state, o) {
      T.ramps.forEach(function (rp, i) {
        var on = o.flash['ramp-' + rp.id] || 0, pts = rp.rail;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Rampen er et gennemsigtigt rør hævet over bordet
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.strokeStyle = alpha(col.ramp, 0.13 + 0.12 * on); ctx.lineWidth = 34; ctx.stroke();
        ctx.strokeStyle = alpha(col.ramp, 0.55 + 0.3 * on); ctx.lineWidth = 3; ctx.setLineDash([16, 12]); ctx.stroke();
        ctx.restore();
        // Pile i indgangen
        var sn = rp.sensor, cx = (sn.x0 + sn.x1) / 2;
        ctx.strokeStyle = alpha(col.ramp, 0.45 + 0.5 * on); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (on > 0.05) glow(col.ramp, 12 * on);
        for (var a = 0; a < 2; a++) {
          var yy = sn.y + 70 - a * 30;
          ctx.beginPath(); ctx.moveTo(cx - 13, yy + 10); ctx.lineTo(cx, yy - 4); ctx.lineTo(cx + 13, yy + 10); ctx.stroke();
        }
        noGlow();
      });
    }
    function drawSpinners(o) {
      T.spinners.forEach(function (sp, i) {
        var on = o.flash['spinner-' + i] || 0, cx = (sp.x0 + sp.x1) / 2, hw = (sp.x1 - sp.x0) / 2 - 6;
        ctx.strokeStyle = alpha(col.spinner, 0.5 + 0.45 * on); ctx.lineWidth = 3;
        line(sp.x0 + 4, sp.y, sp.x1 - 4, sp.y);
        // Bladet: tegnes smallere, mens det drejer (roligt, uden blink)
        ctx.fillStyle = alpha(col.spinner, 0.35 + 0.4 * on);
        var h = 10 * (1 - 0.7 * on);
        ctx.beginPath(); roundRect(cx - hw, sp.y - h / 2, hw * 2, Math.max(2, h), 3); ctx.fill();
      });
    }
    function drawRollovers(state, o) {
      if (!T.rollovers.length) return;
      T.rollovers.forEach(function (ro, i) {
        var lit = state.lights[i], on = o.flash['rollover-' + i] || 0, lbl = T.bank.labels && T.bank.labels[i];
        ctx.beginPath(); roundRect(ro.x - 13, ro.y - 17, 26, 34, 8);
        ctx.fillStyle = lit ? alpha(col.lane, 0.9) : alpha(col.lane, 0.1 + 0.3 * on);
        if (lit) glow(col.lane, 12);
        ctx.fill(); noGlow();
        ctx.lineWidth = 3; ctx.strokeStyle = col.lane; ctx.stroke();
        if (lbl) label(lbl, ro.x, ro.y + 1, 19, lit ? col.board1 : col.lane, lit ? 1 : 0.8);
      });
    }
    function drawDrops(state, o) {
      T.drops.forEach(function (bank, bi) {
        bank.targets.forEach(function (w, i) {
          var down = state.drops[bi][i];
          ctx.lineCap = 'round';
          if (down) {
            ctx.strokeStyle = alpha(col.drop, 0.25); ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
            line(w.ax, w.ay, w.bx, w.by); ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = col.drop; ctx.lineWidth = w.r * 2 + 4; glow(col.drop, 10);
            line(w.ax, w.ay, w.bx, w.by); noGlow();
            ctx.strokeStyle = alpha('#000000', 0.35); ctx.lineWidth = 3;
            line(w.ax, w.ay, w.bx, w.by);
          }
        });
      });
    }
    function drawHoles(state, o) {
      var ms = T.missions, jack = ms && ms.jackpot && state.mission.jackpot;
      T.holes.forEach(function (ho, i) {
        var on = o.flash['hole-' + i] || 0, isJack = jack && ms.jackpot.event === 'hole' && (ms.jackpot.id == null || ms.jackpot.id === ho.id);
        ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = '#000'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = alpha(col.hole, 0.7 + 0.3 * on);
        glow(col.hole, isJack ? 18 : 8 + 10 * on); ctx.stroke(); noGlow();
        if (isJack) {
          ctx.beginPath(); ctx.arc(ho.x, ho.y, ho.r + 16, 0, Math.PI * 2);
          ctx.lineWidth = 3; ctx.strokeStyle = alpha(col.hole, 0.8); ctx.stroke();
          label('JACKPOT', ho.x, ho.y - ho.r - 30, 18, col.hole, 0.95);
        }
      });
    }
    function roundRect(x, y, w, h, r) {
      ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    }
    function drawFlippers(run, o) {
      T.sides.forEach(function (side) {
        var s = run.flipperSegment(side), armed = (run.state.armed && run.state.armed[side]) || (o.mark && o.mark[side]);
        var c = col[side] || col.both;
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
    // Kun ét valg vises ad gangen: det, der er fokus på (blik, mus eller tastatur).
    function drawPreviews(o) {
      var p = o.preview; if (!p) return;
      var k = o.freezeK == null ? 1 : o.freezeK, c = col[o.previewKey] || col.both, dashed = p.option === 'none';
      glow(c, 10);
      drawPath(p.path, c, 8, 0.95 * k, dashed);
      noGlow();
      drawEnd(p, c, k);
      // Slagpunktet: en ring der, hvor flipperen rammer kuglen
      if (p.hit) {
        ctx.save(); ctx.globalAlpha = k;
        ctx.beginPath(); ctx.arc(p.hit.x, p.hit.y, G.R + 7, 0, Math.PI * 2);
        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.stroke();
        ctx.restore();
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
      if (!colFor) readColors();
      useTable(run.table);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, G.W, G.H);
      ctx.save();
      // Afrundede hjørner
      ctx.beginPath(); roundRect(0, 0, G.W, G.H, 22 / Math.max(scale, 0.01) * 0.6); ctx.clip();
      drawTable(state, o);
      drawPlunger(state, o);
      drawFlippers(run, o);
      drawRamps(state, o);
      var k = o.freezeK || 0;
      // Frys: bordet dæmpes roligt, kuglen og sigtelinjerne står klart frem
      if (k > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (0.42 * k) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
      if (o.launchPreview) {
        drawPath(o.launchPreview.path, col.launch, 5, 0.6, true);
      }
      drawPreviews(o);
      if (state.phase !== 'lost' && state.phase !== 'over' && !o.noBall) {
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
