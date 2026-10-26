/*
 * Løberen – tegner banen i pseudo-3D på et <canvas>. Farver kommer fra
 * temaets CSS-variabler (css/loeberen.css). Ingen blink og ingen hvide
 * lysglimt. Uden animation (eller med mindre bevægelse) står alt stille, og
 * et træk vises med en kort, rolig fade.
 */
(function (global) {
  'use strict';
  var G = global.LoeberenGame;

  var PZ = 0.2;       // løberens dybde
  var D = 1.0;        // afstand fra løberen til næste forhindring, når spillet står stille
  var GAP = 1.4;      // afstand mellem forhindringerne (= hvor langt banen ruller pr. valg)
  var K = 0.5;        // perspektiv
  var HIT = D / GAP;  // hvornår i et træk løberen når forhindringen (0-1)

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function hash(n) { n = (n * 2654435761) >>> 0; n ^= n >>> 13; n = (n * 1274126177) >>> 0; return (n >>> 8) / 16777216; }

  function draw(canvas, run, col, opts) {
    opts = opts || {};
    var c = canvas.getContext('2d');
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    var dpr = canvas.width / W || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var on = col.glow;
    var anim = opts.anim || null;           // { t, res, segs, from, to } under et træk
    var t = anim ? anim.t : 0;
    var segs = anim ? anim.segs : run.state.segs;
    var scroll = anim ? t * GAP : 0;

    var hy = Math.round(H * 0.3), cx = W / 2;
    var RW = Math.min(W * 0.62, (H - hy) * 1.15);    // vejens halve bredde ved z = 0
    function sc(z) { return 1 / (1 + Math.max(-0.9, z) * K); }
    function Y(z) { return hy + (H - hy) * sc(z); }
    function LW(z) { return (2 * RW * sc(z)) / 3; }
    function LX(l, z) { return cx + (l - 1) * LW(z); }
    function glow(color, blur) { if (on) { c.shadowColor = color; c.shadowBlur = blur; } else c.shadowBlur = 0; }

    // ---------- himmel ----------
    var sky = c.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, col.sky0); sky.addColorStop(0.7, col.sky1); sky.addColorStop(1, col.sky2);
    c.fillStyle = sky; c.fillRect(0, 0, W, hy + 1);
    // sol med striber
    var sr = Math.min(W, H) * 0.2;
    c.save();
    c.beginPath(); c.rect(0, 0, W, hy); c.clip();
    var sun = c.createLinearGradient(0, hy - sr, 0, hy);
    sun.addColorStop(0, col.sun0); sun.addColorStop(1, col.sun1);
    c.fillStyle = sun; c.globalAlpha = 0.85;
    c.beginPath(); c.arc(cx, hy, sr, Math.PI, 0); c.fill();
    c.globalAlpha = 1; c.fillStyle = col.sky1;
    for (var i = 0; i < 6; i++) { var sy = hy - sr * (0.12 + i * 0.13); c.fillRect(cx - sr, sy, sr * 2, Math.max(1, sr * 0.025 * (6 - i) * 0.6)); }
    // skyline (står stille)
    c.fillStyle = col.city;
    var bw = Math.max(14, W / 34);
    for (var x = 0, k = 0; x < W; x += bw, k++) {
      var h = hy * (0.12 + 0.32 * hash(k + 7));
      if (Math.abs(x + bw / 2 - cx) < sr * 0.55) h *= 0.45;
      c.fillRect(x, hy - h, bw - 2, h);
    }
    c.fillStyle = col.cityWin;
    for (x = 0, k = 0; x < W; x += bw, k++) {
      var hh = hy * (0.12 + 0.32 * hash(k + 7));
      if (Math.abs(x + bw / 2 - cx) < sr * 0.55) hh *= 0.45;
      for (var wy = hy - hh + 6; wy < hy - 4; wy += 9) if (hash(k * 31 + wy) > 0.62) c.fillRect(x + 3, wy, bw - 8, 2);
    }
    c.restore();

    // ---------- jorden og vejen ----------
    c.fillStyle = col.ground; c.fillRect(0, hy, W, H - hy);
    var zFar = 40;
    c.fillStyle = col.road;
    c.beginPath();
    c.moveTo(cx - RW * sc(zFar), Y(zFar)); c.lineTo(cx + RW * sc(zFar), Y(zFar));
    c.lineTo(cx + RW * sc(-0.2), Y(-0.2)); c.lineTo(cx - RW * sc(-0.2), Y(-0.2)); c.closePath(); c.fill();
    // løberens bane er lidt lysere
    var curLane = anim ? anim.from + (anim.to - anim.from) * ease(t / 0.45) : run.state.lane;
    c.fillStyle = col.laneHi;
    c.beginPath();
    var la = curLane - 0.5, lb = curLane + 0.5;
    c.moveTo(LX(la, zFar), Y(zFar)); c.lineTo(LX(lb, zFar), Y(zFar));
    c.lineTo(LX(lb, -0.2), Y(-0.2)); c.lineTo(LX(la, -0.2), Y(-0.2)); c.closePath(); c.fill();
    // tværgående gitterlinjer (følger med, når banen ruller)
    c.strokeStyle = col.grid; c.lineWidth = 1.2;
    var off = (scroll % 0.5);
    for (var gz = -off; gz < 14; gz += 0.5) {
      if (gz < -0.2) continue;
      c.globalAlpha = clamp(1.1 - gz / 14, 0.15, 1) * 0.7;
      c.beginPath(); c.moveTo(cx - RW * sc(gz), Y(gz)); c.lineTo(cx + RW * sc(gz), Y(gz)); c.stroke();
    }
    c.globalAlpha = 1;
    // banelinjer og kanter
    c.save();
    glow(col.edge, 10);
    [-0.5, 2.5].forEach(function (e) {
      c.strokeStyle = col.edge; c.lineWidth = 3;
      c.beginPath(); c.moveTo(LX(e, zFar), Y(zFar)); c.lineTo(LX(e, -0.2), Y(-0.2)); c.stroke();
    });
    glow(col.laneLine, 6);
    [0.5, 1.5].forEach(function (e) {
      c.strokeStyle = col.laneLine; c.lineWidth = 2;
      c.beginPath(); c.moveTo(LX(e, zFar), Y(zFar)); c.lineTo(LX(e, -0.2), Y(-0.2)); c.stroke();
    });
    c.restore();
    // stoplinje: her fryser spillet, til du har valgt
    var zs = PZ + D - scroll;
    if (zs > -0.2) {
      c.save(); glow(col.warn, 8);
      c.strokeStyle = col.warn; c.globalAlpha = 0.75; c.lineWidth = Math.max(2, LW(zs) * 0.03);
      c.setLineDash([LW(zs) * 0.12, LW(zs) * 0.08]);
      c.beginPath(); c.moveTo(LX(-0.5, zs), Y(zs) + LW(zs) * 0.1); c.lineTo(LX(2.5, zs), Y(zs) + LW(zs) * 0.1); c.stroke();
      c.restore();
    }

    // ---------- ting i verden (tegnes bagfra og frem) ----------
    var items = [];
    segs.forEach(function (seg, i) {
      var z = PZ + D + i * GAP - scroll;
      if (z > 11) return;
      if (z < -0.3) return;
      items.push({ z: z + 0.3, kind: 'deco', seg: seg, i: i });
      for (var l = 0; l < 3; l++) {
        var o = seg.lanes[l];
        if (o !== 'fri') items.push({ z: z, kind: o, lane: l, seg: seg, i: i, next: segs[i + 1] });
        if (seg.coins && seg.coins[l] && o !== 'tog') items.push({ z: z - 0.01, kind: 'coin', lane: l, seg: seg, i: i, obst: o });
      }
    });
    // løberen
    var res = anim ? anim.res : null;
    var hitNow = res && !res.safe && t >= HIT;
    items.push({ z: PZ, kind: 'runner' });
    // ghost-forhåndsvisning af det valg, man kigger på
    var gv = !anim && opts.preview ? opts.preview : null;
    if (gv) items.push({ z: PZ + D - 0.02, kind: 'ghost', g: gv });
    items.sort(function (a, b) { return b.z - a.z; });

    var fade = function (z) { return clamp((10.5 - z) / 3, 0, 1); };
    items.forEach(function (it) {
      var z = it.z, u = LW(z), y = Y(z), x;
      c.save();
      c.globalAlpha = fade(z);
      if (it.kind === 'deco') decoration(it, z - 0.3);
      else if (it.kind === 'lav') low(LX(it.lane, z), y, u);
      else if (it.kind === 'hoej') high(LX(it.lane, z), y, u);
      else if (it.kind === 'tog') train(it, z);
      else if (it.kind === 'coin') {
        var taken = anim && it.i === 0 && res.coin && res.to === it.lane && t > HIT;
        if (!taken) coin(LX(it.lane, z), y - u * (it.obst === 'lav' ? 0.62 : 0.34), u * 0.11);
      }
      else if (it.kind === 'runner') runner();
      else if (it.kind === 'ghost') ghost(it.g);
      c.restore();
    });

    // +10 for en mønt (stiger roligt op og forsvinder)
    if (anim && res.coin && t > HIT) {
      var p = (t - HIT) / (1 - HIT), u0 = LW(PZ);
      c.save(); c.globalAlpha = 1 - p;
      c.font = '800 ' + Math.round(u0 * 0.22) + 'px ' + col.font;
      c.textAlign = 'center'; c.fillStyle = col.coin; glow(col.coin, 8);
      c.fillText('+' + G.COIN_POINTS, LX(curLane, PZ), Y(PZ) - u0 * (1.25 + 0.3 * p));
      c.restore();
    }
    // rolig fade efter et træk uden animation
    if (opts.fadeIn > 0) { c.fillStyle = 'rgba(0,0,0,' + (0.45 * opts.fadeIn) + ')'; c.fillRect(0, 0, W, H); }
    // rød, rolig kant ved et mistet liv
    if (opts.hitGlow > 0) {
      c.save(); c.strokeStyle = col.danger; c.globalAlpha = opts.hitGlow; c.lineWidth = Math.max(8, W * 0.012);
      glow(col.danger, 24); c.strokeRect(0, 0, W, H); c.restore();
    }

    // ---------- tegnefunktioner ----------
    function decoration(it, z) {
      var s = sc(z), u = LW(z), y = Y(z), id = it.seg.id;
      var edgeL = cx - RW * s, edgeR = cx + RW * s;
      [[-1, edgeL], [1, edgeR]].forEach(function (side) {
        var dir = side[0], ex = side[1];
        var h = u * (1.6 + 2.4 * hash(id * 3 + (dir > 0 ? 1 : 2)));
        var w = u * (0.9 + 0.6 * hash(id * 5 + dir + 3));
        var x0 = dir < 0 ? ex - u * 0.25 - w : ex + u * 0.25;
        c.fillStyle = col.tower;
        c.fillRect(x0, y - h, w, h);
        c.strokeStyle = dir < 0 ? col.towerEdge1 : col.towerEdge2; c.lineWidth = Math.max(1, u * 0.025);
        glow(c.strokeStyle, 8);
        c.strokeRect(x0, y - h, w, h);
        c.shadowBlur = 0;
        c.fillStyle = col.towerWin;
        for (var r = 0; r < 6; r++) {
          var yy = y - h + h * (0.1 + r * 0.14);
          if (hash(id * 11 + r + dir * 7) > 0.45) c.fillRect(x0 + w * 0.15, yy, w * 0.7, Math.max(1, u * 0.03));
        }
      });
      // en neonport over vejen ved hvert tredje stop (labyrintfølelse)
      if (id % 3 === 0) {
        var top = y - u * 2.1;
        c.strokeStyle = col.gate; c.lineWidth = Math.max(1.5, u * 0.04); glow(col.gate, 12);
        c.beginPath();
        c.moveTo(edgeL - u * 0.1, y); c.lineTo(edgeL - u * 0.1, top + u * 0.3);
        c.quadraticCurveTo(edgeL - u * 0.1, top, edgeL + u * 0.3, top);
        c.lineTo(edgeR - u * 0.3, top);
        c.quadraticCurveTo(edgeR + u * 0.1, top, edgeR + u * 0.1, top + u * 0.3);
        c.lineTo(edgeR + u * 0.1, y);
        c.stroke();
      }
    }
    function low(x, y, u) {
      var w = u * 0.84, h = u * 0.3;
      c.fillStyle = col.lowFill; c.fillRect(x - w / 2, y - h, w, h);
      c.save(); c.beginPath(); c.rect(x - w / 2, y - h, w, h * 0.62); c.clip();
      c.fillStyle = col.low; c.globalAlpha *= 0.55;
      for (var sx = -w; sx < w; sx += u * 0.16) {
        c.beginPath(); c.moveTo(x - w / 2 + sx, y - h * 0.38); c.lineTo(x - w / 2 + sx + u * 0.08, y - h * 0.38);
        c.lineTo(x - w / 2 + sx + u * 0.08 + h, y - h); c.lineTo(x - w / 2 + sx + h, y - h); c.closePath(); c.fill();
      }
      c.restore();
      c.strokeStyle = col.low; c.lineWidth = Math.max(1.5, u * 0.035); glow(col.low, 12);
      c.strokeRect(x - w / 2, y - h, w, h * 0.62);
      c.beginPath(); c.moveTo(x - w * 0.38, y - h * 0.38); c.lineTo(x - w * 0.38, y); c.moveTo(x + w * 0.38, y - h * 0.38); c.lineTo(x + w * 0.38, y); c.stroke();
    }
    function high(x, y, u) {
      var w = u * 0.9, top = u * 1.15, b0 = u * 0.62, b1 = u * 0.9;
      c.strokeStyle = col.high; c.lineWidth = Math.max(1.5, u * 0.04); glow(col.high, 12);
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - top); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y - top); c.stroke();
      c.fillStyle = col.highFill; c.fillRect(x - w / 2, y - b1, w, b1 - b0);
      c.strokeRect(x - w / 2, y - b1, w, b1 - b0);
      // markering på jorden: "dyk her"
      c.shadowBlur = 0; c.globalAlpha *= 0.5;
      c.beginPath(); c.moveTo(x - w * 0.3, y - u * 0.02); c.lineTo(x + w * 0.3, y - u * 0.02); c.stroke();
    }
    function train(it, z) {
      var l = it.lane, x = LX(l, z), y = Y(z), u = LW(z);
      var cont = it.next && it.next.lanes[l] === 'tog';
      var z2 = z + (cont ? GAP : 0.8), x2 = LX(l, z2), y2 = Y(z2), u2 = LW(z2);
      var w = 0.88, h = 1.25;
      // tag (set ovenfra) og side mod midten
      c.fillStyle = col.trainSide;
      c.beginPath();
      c.moveTo(x - u * w / 2, y - u * h); c.lineTo(x + u * w / 2, y - u * h);
      c.lineTo(x2 + u2 * w / 2, y2 - u2 * h); c.lineTo(x2 - u2 * w / 2, y2 - u2 * h); c.closePath(); c.fill();
      var sx = l === 0 ? 1 : l === 2 ? -1 : 0;
      if (sx) {
        c.beginPath();
        c.moveTo(x + sx * u * w / 2, y); c.lineTo(x + sx * u * w / 2, y - u * h);
        c.lineTo(x2 + sx * u2 * w / 2, y2 - u2 * h); c.lineTo(x2 + sx * u2 * w / 2, y2); c.closePath(); c.fill();
      }
      // fronten
      c.fillStyle = col.trainFill; c.fillRect(x - u * w / 2, y - u * h, u * w, u * h);
      c.strokeStyle = col.train; c.lineWidth = Math.max(1.5, u * 0.04); glow(col.train, 14);
      c.strokeRect(x - u * w / 2, y - u * h, u * w, u * h);
      c.shadowBlur = 0;
      c.fillStyle = col.glass;
      c.fillRect(x - u * w * 0.38, y - u * h * 0.86, u * w * 0.76, u * h * 0.32);
      c.strokeStyle = col.train; c.lineWidth = Math.max(1, u * 0.02);
      c.strokeRect(x - u * w * 0.38, y - u * h * 0.86, u * w * 0.76, u * h * 0.32);
      c.fillStyle = col.lights; glow(col.lights, 10);
      c.beginPath(); c.arc(x - u * w * 0.28, y - u * h * 0.2, u * 0.055, 0, Math.PI * 2); c.arc(x + u * w * 0.28, y - u * h * 0.2, u * 0.055, 0, Math.PI * 2); c.fill();
      // stribe
      c.shadowBlur = 0; c.fillStyle = col.train; c.fillRect(x - u * w / 2, y - u * h * 0.42, u * w, Math.max(1, u * 0.03));
    }
    function coin(x, y, r) {
      c.fillStyle = col.coinFill; c.strokeStyle = col.coin; c.lineWidth = Math.max(1.5, r * 0.3); glow(col.coin, 10);
      c.beginPath(); c.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.shadowBlur = 0; c.beginPath(); c.moveTo(x, y - r * 0.5); c.lineTo(x, y + r * 0.5); c.stroke();
    }
    function runner() {
      var u = LW(PZ), y = Y(PZ), x = cx + (curLane - 1) * u;
      var pose = 'run', lift = 0;
      if (anim) {
        var a = res.action;
        if (a === 'hop') { var j = clamp((t - HIT + 0.38) / 0.72, 0, 1); lift = Math.sin(Math.PI * j) * u * 0.55; pose = j > 0 && j < 1 ? 'jump' : 'run'; }
        if (a === 'dyk' && t > HIT - 0.32 && t < HIT + 0.26) pose = 'slide';
        if (a === 'venstre' || a === 'hoejre') pose = t < 0.45 ? 'lean' : 'run';
      }
      // skygge
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.ellipse(x, y, u * 0.26 * (1 - lift / u * 0.5), u * 0.06, 0, 0, Math.PI * 2); c.fill();
      var color = hitNow ? col.danger : col.runner;
      figure(x, y - lift, u, pose, color, 1, false, anim ? (a === 'venstre' ? -1 : a === 'hoejre' ? 1 : 0) : 0);
      if (hitNow) {
        var q = clamp((t - HIT) / (1 - HIT), 0, 1);
        c.strokeStyle = col.danger; c.globalAlpha = 0.8 * (1 - q); c.lineWidth = Math.max(2, u * 0.05); glow(col.danger, 16);
        c.beginPath(); c.ellipse(x, y - u * 0.5, u * (0.4 + 0.3 * q), u * (0.6 + 0.3 * q), 0, 0, Math.PI * 2); c.stroke();
      }
    }
    function ghost(g) {
      var z = PZ + D - 0.02, u = LW(z), y = Y(z);
      var lane = G.target(run.state.lane, g.action), x = LX(lane, z);
      var pose = g.action === 'hop' ? 'jump' : g.action === 'dyk' ? 'slide' : 'run';
      var lift = g.action === 'hop' ? u * 0.5 : 0;
      var colr = g.verdict === 'safe' ? col.ok : g.verdict === 'dead' ? col.warn : g.verdict === 'hit' ? col.danger : col.ghost;
      c.globalAlpha = col.ghostAlpha;
      figure(x, y - lift, u, pose, colr, 1, true, 0);
      // stiplet linje fra løberen hen til skyggen
      c.globalAlpha = 0.7; c.setLineDash([u * 0.08, u * 0.08]); c.strokeStyle = colr; c.lineWidth = Math.max(1.5, u * 0.025);
      c.beginPath(); c.moveTo(cx + (run.state.lane - 1) * LW(PZ), Y(PZ)); c.lineTo(x, y); c.stroke();
      c.setLineDash([]);
      if (g.label) {
        c.globalAlpha = 1;
        var fs = clamp(Math.round(u * 0.2), 14, 34);
        c.font = '700 ' + fs + 'px ' + col.font;
        var tw = c.measureText(g.label).width, px = clamp(x, tw / 2 + 10, W - tw / 2 - 10), py = y - lift - u * 1.25;
        c.fillStyle = 'rgba(0,0,0,0.78)';
        c.beginPath();
        if (c.roundRect) c.roundRect(px - tw / 2 - 10, py - fs, tw + 20, fs * 1.45, 8); else c.rect(px - tw / 2 - 10, py - fs, tw + 20, fs * 1.45);
        c.fill();
        c.strokeStyle = colr; c.lineWidth = 2; c.stroke();
        c.fillStyle = colr; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillText(g.label, px, py + fs * 0.18);
      }
    }
    // Neonfigur set bagfra. pose: run, jump, slide, lean
    function figure(x, y, u, pose, color, alpha, dashed, leanDir) {
      u *= 0.8;
      c.save();
      c.translate(x, y);
      c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
      c.lineWidth = Math.max(2, u * 0.065);
      if (dashed) c.setLineDash([u * 0.07, u * 0.05]);
      glow(color, dashed ? 6 : 14);
      var P;
      if (pose === 'jump') P = { head: [0, -0.92], neck: [0, -0.8], hip: [0, -0.5], hands: [[-0.26, -1.02], [0.26, -1.02]], elbows: [[-0.2, -0.86], [0.2, -0.86]], knees: [[-0.16, -0.4], [0.16, -0.4]], feet: [[-0.12, -0.22], [0.12, -0.22]] };
      else if (pose === 'slide') P = { head: [0, -0.4], neck: [0, -0.32], hip: [0, -0.14], hands: [[-0.36, -0.08], [0.36, -0.08]], elbows: [[-0.24, -0.22], [0.24, -0.22]], knees: [[-0.22, -0.08], [0.22, -0.08]], feet: [[-0.34, 0], [0.34, 0]] };
      else {
        var lean = pose === 'lean' ? leanDir * 0.12 : 0;
        P = { head: [lean, -0.92], neck: [lean * 0.8, -0.8], hip: [0, -0.48], hands: [[-0.24, -0.5], [0.2, -0.78]], elbows: [[-0.2, -0.64], [0.18, -0.64]], knees: [[-0.1, -0.24], [0.12, -0.3]], feet: [[-0.12, 0], [0.16, -0.12]] };
      }
      function pt(p) { return [p[0] * u, p[1] * u]; }
      function line(a, b, cc) { a = pt(a); b = pt(b); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); if (cc) { cc = pt(cc); c.lineTo(cc[0], cc[1]); } c.stroke(); }
      line(P.neck, P.hip);
      for (var s = 0; s < 2; s++) {
        line(P.neck, P.elbows[s], P.hands[s]);
        line(P.hip, P.knees[s], P.feet[s]);
      }
      var hd = pt(P.head);
      c.beginPath(); c.arc(hd[0], hd[1], u * 0.095, 0, Math.PI * 2);
      if (dashed) c.stroke(); else { c.fillStyle = col.runnerFill; c.fill(); c.stroke(); }
      c.restore();
    }
  }

  global.LoeberenRender = { draw: draw, PZ: PZ, D: D, GAP: GAP, HIT: HIT };
})(window);
