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
  var HIT = D / GAP;
  // hvornår i et træk løberen når forhindringen (0-1)
  var RUNNER_SCALE = 0.86, RUNNER_ALPHA = 0.72; // løberen nærmest kameraet

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
    // datanet i horisonten: trådnet-bjerge og lodrette datastrømme (står stille)
    c.strokeStyle = col.city; c.lineWidth = 1.2; c.globalAlpha = 0.9;
    var peaks = [];
    for (var k = 0, x = -W * 0.05; x <= W * 1.05; x += W / 18, k++) {
      var ph = hy * (0.08 + 0.3 * hash(k + 7));
      if (Math.abs(x - cx) < sr * 0.8) ph *= 0.35;
      peaks.push([x, hy - ph]);
    }
    c.beginPath(); c.moveTo(peaks[0][0], hy);
    peaks.forEach(function (p) { c.lineTo(p[0], p[1]); });
    c.lineTo(peaks[peaks.length - 1][0], hy); c.stroke();
    peaks.forEach(function (p) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] + (cx - p[0]) * 0.08, hy); c.stroke(); });
    c.globalAlpha = 1;
    c.fillStyle = col.cityWin;
    for (k = 0; k < 26; k++) {
      var dx = W * hash(k * 13 + 5), len = hy * (0.15 + 0.5 * hash(k * 7 + 2));
      if (Math.abs(dx - cx) < sr * 1.05) continue;
      for (var dy = 0; dy < len; dy += 7) if (hash(k * 97 + dy) > 0.35) c.fillRect(dx, dy + hy * 0.04 * hash(k), 2, 3);
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
    // Celle i spænder i dybden fra zN (forkant, evt. med rampe foran) til zF.
    var BH = 0.42;               // datablokkens højde (i banebredder)
    var NEAR = 0.1, TAIL = 0.15; // blokkens forkant før stoppet og hale efter hvilestedet
    var prevSeg = anim ? anim.prev : run.state.prev;
    var all = prevSeg ? [prevSeg].concat(segs) : segs.slice();
    var off0 = prevSeg ? -1 : 0;
    var items = [];
    all.forEach(function (seg, j) {
      var i = j + off0;
      var z = PZ + D + i * GAP - scroll;
      if (z > 11) return;
      if (z + GAP < -0.3) return;
      var nextSeg = all[j + 1], lastSeg = all[j - 1];
      if (i >= 0 && z > -0.3) items.push({ z: z + 0.3, kind: 'deco', seg: seg, i: i });
      for (var l = 0; l < 3; l++) {
        var o = seg.lanes[l];
        if (G.isBlock(o)) {
          var cont = nextSeg && G.isBlock(nextSeg.lanes[l]);
          var startRun = !lastSeg || !G.isBlock(lastSeg.lanes[l]);
          var zN = z - NEAR, zF = cont ? z + GAP - NEAR : z + (GAP - D) + TAIL;
          items.push({ z: zF, kind: 'block', lane: l, zN: zN, zF: zF, ramp: o === 'rampe' && startRun, front: startRun, back: !cont });
          if (i >= 0 && o === 'blok-lav') items.push({ z: z, kind: 'lav', lane: l, lift: BH });
          if (i >= 0 && o === 'blok-hoej') items.push({ z: z, kind: 'hoej', lane: l, lift: BH });
        } else if (o !== 'fri' && i >= 0) {
          if (z > -0.3) items.push({ z: z, kind: o, lane: l });
        }
        if (i >= 0 && seg.coins && seg.coins[l] && o !== 'mur' && z > -0.3) items.push({ z: z - 0.01, kind: 'coin', lane: l, seg: seg, i: i, obst: o });
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
      var z = it.z, u = LW(z), y = Y(z);
      c.save();
      c.globalAlpha = fade(z);
      // det, man lige har passeret, toner roligt ud, før det forsvinder bag kameraet
      if (it.kind !== 'block' && it.kind !== 'runner' && it.kind !== 'ghost') c.globalAlpha *= clamp(((it.kind === 'deco' ? z - 0.3 : z) + 0.2) / 0.3, 0, 1);
      if (it.kind === 'deco') decoration(it, z - 0.3);
      else if (it.kind === 'block') { c.globalAlpha = fade(it.zN); block(it); }
      else if (it.kind === 'lav') low(LX(it.lane, z), y - (it.lift || 0) * u, u);
      else if (it.kind === 'hoej') high(LX(it.lane, z), y - (it.lift || 0) * u, u);
      else if (it.kind === 'mur') wall(LX(it.lane, z), y, u);
      else if (it.kind === 'coin') {
        var taken = anim && it.i === 0 && res.coin && res.to === it.lane && t > HIT;
        var up = G.isBlock(it.obst) ? BH : 0;
        var ch = it.obst === 'lav' || it.obst === 'blok-lav' ? 0.62 : 0.34;
        if (!taken) coin(LX(it.lane, z), y - u * (up + ch), u * 0.11);
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
      c.fillText('+' + G.COIN_POINTS, LX(curLane, PZ), Y(PZ) - u0 * (1.25 + BH * res.toH + 0.3 * p));
      c.restore();
    }
    // niveau i hjørnet
    if (opts.level) {
      var fsL = clamp(Math.round(Math.min(W, H) * 0.035), 12, 26);
      c.save(); c.font = '800 ' + fsL + 'px ' + col.font; c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillStyle = 'rgba(0,0,0,0.55)';
      var lt = 'NIVEAU ' + opts.level, lw = c.measureText(lt).width;
      c.fillRect(8, 8, lw + fsL, fsL * 1.5);
      c.fillStyle = col.warn; glow(col.warn, 6); c.fillText(lt, 8 + fsL / 2, 8 + fsL * 0.25);
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
    function P3(l, z, hgt) { return [LX(l, z), Y(z) - hgt * LW(z)]; }
    function poly(pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var q = 1; q < pts.length; q++) c.lineTo(pts[q][0], pts[q][1]); c.closePath(); }
    function decoration(it, z) {
      var s = sc(z), u = LW(z), y = Y(z), id = it.seg.id;
      var edgeL = cx - RW * s, edgeR = cx + RW * s;
      // datasøjler langs vejen med kredsløbsbaner og knudepunkter
      [[-1, edgeL], [1, edgeR]].forEach(function (side) {
        var dir = side[0], ex = side[1];
        var h = u * (1.4 + 2.6 * hash(id * 3 + (dir > 0 ? 1 : 2)));
        var w = u * (0.5 + 0.5 * hash(id * 5 + dir + 3));
        var x0 = dir < 0 ? ex - u * 0.3 - w : ex + u * 0.3;
        c.fillStyle = col.tower;
        c.fillRect(x0, y - h, w, h);
        c.strokeStyle = dir < 0 ? col.towerEdge1 : col.towerEdge2; c.lineWidth = Math.max(1, u * 0.022);
        glow(c.strokeStyle, 8);
        c.strokeRect(x0, y - h, w, h);
        c.shadowBlur = 0;
        c.strokeStyle = col.towerWin; c.fillStyle = col.towerWin; c.lineWidth = Math.max(1, u * 0.015);
        for (var r = 0; r < 4; r++) {
          var tx = x0 + w * (0.2 + 0.6 * hash(id * 17 + r + dir));
          var ty0 = y - h * (0.1 + 0.2 * r), ty1 = ty0 - h * 0.15;
          c.beginPath(); c.moveTo(tx, ty0); c.lineTo(tx, ty1); c.lineTo(tx + w * 0.15 * (hash(r + id) > 0.5 ? 1 : -1), ty1 - h * 0.04); c.stroke();
          c.beginPath(); c.arc(tx, ty0, Math.max(1.2, u * 0.022), 0, Math.PI * 2); c.fill();
        }
      });
      // en sekskantet dataport over vejen ved hvert tredje stop
      if (id % 3 === 0) {
        var top = y - u * 2.1, mid = y - u * 1.8;
        c.strokeStyle = col.gate; c.lineWidth = Math.max(1.5, u * 0.04); glow(col.gate, 12);
        c.beginPath();
        c.moveTo(edgeL - u * 0.1, y); c.lineTo(edgeL - u * 0.1, mid); c.lineTo(edgeL + u * 0.35, top);
        c.lineTo(edgeR - u * 0.35, top); c.lineTo(edgeR + u * 0.1, mid); c.lineTo(edgeR + u * 0.1, y);
        c.stroke();
      }
    }
    // Datablok: en kube med glastag. Med rampe foran kan man løbe op; uden rampe er forkanten en mur.
    function block(it) {
      var l = it.lane, zN = Math.max(-0.25, it.zN), zF = it.zF, w = 0.46;
      if (zF < -0.25) return;
      var uN = LW(zN);
      var bl = function (z, hgt) { return P3(l - w, z, hgt); }, br = function (z, hgt) { return P3(l + w, z, hgt); };
      var sx = l === 0 ? 1 : l === 2 ? -1 : 0;
      c.lineWidth = Math.max(1.2, uN * 0.03);
      // siden mod midten
      if (sx) {
        var sl = sx > 0 ? br : bl;
        c.fillStyle = col.blockSide; poly([sl(zN, 0), sl(zN, BH), sl(zF, BH), sl(zF, 0)]); c.fill();
        c.strokeStyle = col.block; c.globalAlpha *= 0.8; c.stroke(); c.globalAlpha /= 0.8;
      }
      // taget
      c.fillStyle = col.blockTop; poly([bl(zN, BH), br(zN, BH), br(zF, BH), bl(zF, BH)]); c.fill();
      c.strokeStyle = col.block; glow(col.block, 10);
      c.beginPath(); var a = bl(zN, BH), b = bl(zF, BH), d = br(zN, BH), e = br(zF, BH);
      c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.moveTo(d[0], d[1]); c.lineTo(e[0], e[1]);
      if (it.back) { c.moveTo(b[0], b[1]); c.lineTo(e[0], e[1]); }
      c.stroke(); c.shadowBlur = 0;
      // gitter på taget
      c.globalAlpha *= 0.35; c.beginPath();
      for (var gz = zN + 0.25; gz < zF; gz += 0.3) { var g1 = bl(gz, BH), g2 = br(gz, BH); c.moveTo(g1[0], g1[1]); c.lineTo(g2[0], g2[1]); }
      c.stroke(); c.globalAlpha /= 0.35;
      if (!it.front || it.zN < -0.25) return;
      // forsiden
      var f0 = bl(zN, 0), f1 = br(zN, 0), f2 = br(zN, BH), f3 = bl(zN, BH);
      c.fillStyle = col.blockFill; poly([f0, f1, f2, f3]); c.fill();
      c.strokeStyle = it.ramp ? col.block : col.danger; glow(c.strokeStyle, 12);
      c.lineWidth = Math.max(1.5, uN * (it.ramp ? 0.035 : 0.05)); c.stroke(); c.shadowBlur = 0;
      // dataprikker (binært mønster) på forsiden
      c.fillStyle = col.block; c.globalAlpha *= 0.55;
      for (var q = 0; q < 8; q++) for (var r = 0; r < 2; r++) {
        if (hash(l * 31 + q * 7 + r * 3 + Math.round(zF * 10)) > 0.5) c.fillRect(f0[0] + (f1[0] - f0[0]) * (0.1 + q * 0.1), f0[1] - uN * BH * (0.3 + r * 0.35), Math.max(2, uN * 0.04), Math.max(2, uN * 0.04));
      }
      c.globalAlpha /= 0.55;
      if (it.ramp) {
        // rampe foran blokken med pile op
        var zR = Math.max(-0.25, zN - 0.42);
        var r0 = bl(zR, 0), r1 = br(zR, 0);
        c.fillStyle = col.rampFill; poly([r0, r1, f2, f3]); c.fill();
        c.strokeStyle = col.block; c.lineWidth = Math.max(1.2, uN * 0.03); glow(col.block, 8); c.stroke(); c.shadowBlur = 0;
        c.strokeStyle = col.ok; c.lineWidth = Math.max(1.5, uN * 0.035);
        for (var ch = 0; ch < 2; ch++) {
          var zc = zR + (zN - zR) * (0.3 + ch * 0.38), hc = BH * (0.3 + ch * 0.38);
          var cL = P3(l - 0.18, zc - 0.05, hc - 0.05), cM = P3(l, zc + 0.05, hc + 0.05), cR = P3(l + 0.18, zc - 0.05, hc - 0.05);
          c.beginPath(); c.moveTo(cL[0], cL[1]); c.lineTo(cM[0], cM[1]); c.lineTo(cR[0], cR[1]); c.stroke();
        }
      }
    }
    // Lav laserbarriere: to små stolper med vandrette laserstråler
    function low(x, y, u) {
      var w = u * 0.86, h = u * 0.3;
      c.fillStyle = col.lowFill; c.globalAlpha *= 0.6; c.fillRect(x - w / 2, y - h, w, h); c.globalAlpha /= 0.6;
      c.strokeStyle = col.low; c.lineWidth = Math.max(2, u * 0.03); glow(col.low, 12);
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y - h); c.stroke();
      c.lineWidth = Math.max(1.5, u * 0.022);
      for (var k = 0; k < 3; k++) { var yy = y - h * (0.3 + k * 0.32); c.beginPath(); c.moveTo(x - w / 2, yy); c.lineTo(x + w / 2, yy); c.stroke(); }
    }
    // Høj lysbjælke: en port med en lysende bjælke foroven
    function high(x, y, u) {
      var w = u * 0.9, top = u * 1.15, b0 = u * 0.62, b1 = u * 0.9;
      c.strokeStyle = col.high; c.lineWidth = Math.max(1.5, u * 0.04); glow(col.high, 12);
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - top); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y - top); c.stroke();
      c.fillStyle = col.highFill; c.fillRect(x - w / 2, y - b1, w, b1 - b0);
      c.strokeRect(x - w / 2, y - b1, w, b1 - b0);
      c.shadowBlur = 0; c.globalAlpha *= 0.5;
      c.beginPath(); c.moveTo(x - w * 0.3, y - u * 0.02); c.lineTo(x + w * 0.3, y - u * 0.02); c.stroke();
    }
    // Firewall: en høj, gennemsigtig væg af sekskanter – spærrer banen i alle højder
    function wall(x, y, u) {
      var w = u * 0.92, h = u * 1.5;
      c.fillStyle = col.wallFill; c.fillRect(x - w / 2, y - h, w, h);
      c.save(); c.beginPath(); c.rect(x - w / 2, y - h, w, h); c.clip();
      c.strokeStyle = col.wall; c.lineWidth = Math.max(1, u * 0.018); c.globalAlpha *= 0.6;
      var hs = u * 0.13;
      for (var row = 0; row * hs * 1.5 < h + hs; row++) for (var colI = -1; colI * hs * 1.75 < w + hs; colI++) {
        var hx = x - w / 2 + colI * hs * 1.75 + (row % 2 ? hs * 0.87 : 0), hyy = y - row * hs * 1.5;
        c.beginPath();
        for (var a6 = 0; a6 < 6; a6++) { var ang = Math.PI / 6 + a6 * Math.PI / 3; c[a6 ? 'lineTo' : 'moveTo'](hx + Math.cos(ang) * hs * 0.85, hyy + Math.sin(ang) * hs * 0.85); }
        c.closePath(); c.stroke();
      }
      c.restore();
      c.strokeStyle = col.wall; c.lineWidth = Math.max(2, u * 0.04); glow(col.wall, 16);
      c.strokeRect(x - w / 2, y - h, w, h);
    }
    function coin(x, y, r) {
      c.fillStyle = col.coinFill; c.strokeStyle = col.coin; c.lineWidth = Math.max(1.5, r * 0.3); glow(col.coin, 10);
      c.beginPath(); c.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.shadowBlur = 0; c.beginPath(); c.moveTo(x, y - r * 0.5); c.lineTo(x, y + r * 0.5); c.stroke();
    }
    // Løberens højde (0 = nede, 1 = oppe på en blok) under et træk
    function heightNow() {
      if (!anim) return run.state.h || 0;
      var h0 = res.fromH || 0, h1 = res.safe ? (res.toH || 0) : 0;
      if (h0 === h1) return h0;
      if (h1 > h0) return ease((t - (HIT - 0.36)) / 0.3);          // op ad rampen
      if (!res.safe) return 1 - ease((t - HIT) / (1 - HIT));        // falder ned efter at være ramt
      return 1 - ease((t - 0.08) / 0.42);                           // ned fra blokken
    }
    function runner() {
      var u = LW(PZ), y = Y(PZ), x = cx + (curLane - 1) * u;
      var hNow = heightNow(), yb = y - hNow * BH * u;
      var pose = 'run', lift = 0;
      if (anim) {
        var a = res.action;
        if (a === 'hop') { var j = clamp((t - HIT + 0.38) / 0.72, 0, 1); lift = Math.sin(Math.PI * j) * u * 0.55; pose = j > 0 && j < 1 ? 'jump' : 'run'; }
        if (a === 'dyk' && t > HIT - 0.32 && t < HIT + 0.26) pose = 'slide';
        if (a === 'venstre' || a === 'hoejre') pose = t < 0.45 ? 'lean' : 'run';
      }
      // skygge
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.ellipse(x, yb, u * 0.26 * (1 - lift / u * 0.5), u * 0.06, 0, 0, Math.PI * 2); c.fill();
      var color = hitNow ? col.danger : col.runner;
      // Løberen er lidt mindre, lidt lavere og halvgennemsigtig, så den ikke dækker forhindringen bag sig
      c.save(); c.globalAlpha = RUNNER_ALPHA;
      figure(x, yb - lift + u * 0.05, u * RUNNER_SCALE, pose, color, 1, false, anim ? (a === 'venstre' ? -1 : a === 'hoejre' ? 1 : 0) : 0);
      c.restore();
      if (hitNow) {
        var q = clamp((t - HIT) / (1 - HIT), 0, 1);
        c.strokeStyle = col.danger; c.globalAlpha = 0.8 * (1 - q); c.lineWidth = Math.max(2, u * 0.05); glow(col.danger, 16);
        c.beginPath(); c.ellipse(x, yb - u * 0.5, u * (0.4 + 0.3 * q), u * (0.6 + 0.3 * q), 0, 0, Math.PI * 2); c.stroke();
      }
    }
    function ghost(g) {
      var z = PZ + D - 0.02, u = LW(z);
      var lane = G.target(run.state.lane, g.action), x = LX(lane, z);
      var y = Y(z) - (g.h || 0) * BH * u;
      var pose = g.action === 'hop' ? 'jump' : g.action === 'dyk' ? 'slide' : 'run';
      var lift = g.action === 'hop' ? u * 0.5 : 0;
      var colr = g.verdict === 'safe' ? col.ok : g.verdict === 'dead' ? col.warn : g.verdict === 'hit' ? col.danger : col.ghost;
      c.globalAlpha = col.ghostAlpha;
      figure(x, y - lift, u, pose, colr, 1, true, 0);
      // stiplet linje fra løberen hen til skyggen
      var u0 = LW(PZ), y0 = Y(PZ) - (run.state.h || 0) * BH * u0;
      c.globalAlpha = 0.7; c.setLineDash([u * 0.08, u * 0.08]); c.strokeStyle = colr; c.lineWidth = Math.max(1.5, u * 0.025);
      c.beginPath(); c.moveTo(cx + (run.state.lane - 1) * u0, y0); c.lineTo(x, y); c.stroke();
      c.setLineDash([]);
      if (g.label) {
        c.globalAlpha = 1;
        var fs = clamp(Math.round(u * 0.2), 14, 34);
        c.font = '700 ' + fs + 'px ' + col.font;
        var tw = c.measureText(g.label).width, px = clamp(x, tw / 2 + 10, W - tw / 2 - 10), py = Math.max(fs * 1.9, y - lift - u * 1.25);
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
