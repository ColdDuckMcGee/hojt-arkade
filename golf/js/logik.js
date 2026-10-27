/*
 * Golf – spillogikken. Ingen DOM, ingen farver, ingen grafik.
 * Kan køres i browseren (window.GolfLogik) og i Node (module.exports).
 *
 * Banen er set oppefra i et koordinatsystem på W × H enheder (x mod højre,
 * y nedad). Vinkler er i grader: 0° = mod højre (+x), 90° = nedad (+y), altså
 * med uret på skærmen.
 *
 * Banens dele:
 *   vaegge    bander og vægge som tykke linjer med runde ender { ax, ay, bx, by, t }
 *             (yderkanten er fire tynde bander langs kanten).
 *   sand      rektangler { x, y, w, h }: bolden bremses meget.
 *   vand      rektangler: bolden lægges tilbage, hvor den blev slået fra, og
 *             der lægges et strafslag til.
 *   skraaning rektangler med en retning { x, y, w, h, dir }: bolden trækkes svagt
 *             i den retning.
 *   tee, hul  punkter { x, y }.
 *
 * Fysikken er deterministisk (fast tidsskridt), så forhåndslinjen viser præcis
 * den bane, bolden vil rulle.
 *
 * Runden (uendelig række af huller, til man taber):
 *   Der er en slagpulje. Hvert hul lægger sit par i puljen, og hvert slag tager
 *   ét slag fra puljen (vand koster ét ekstra). Går man under par, bliver de
 *   sparede slag i puljen til næste hul; går man over par, tager man af
 *   reserven. Er puljen tom, og bolden ikke i hul, er spillet slut.
 */
(function (global) {
  'use strict';

  var W = 1000, H = 600;
  var RULES = {
    startReserve: 4,        // slag i reserve ved start (hul 1 lægger sit par oveni)
    maxReserve: 9,          // reserven kan højst blive så stor (før hullets par lægges i)
    holeInOneBonus: 1,      // hole-in-one giver et ekstra slag i reserven
    waterPenalty: 1,        // strafslag for vand
    powers: 10,             // kraft 1–10
    distPerPower: 100,      // rullelængde på græs pr. kraft-trin
    ballR: 9, holeR: 15,
    friction: 300,          // opbremsning på græs (enheder/s²)
    sandFactor: 4.5,        // sand bremser så mange gange mere
    slopeAccel: 150,        // skråningens træk (mindre end opbremsningen, så bolden altid stopper)
    restitution: 0.78,      // hvor meget fart bolden beholder i et bandehop
    captureSpeed: 260,      // bolden falder i hul, hvis den passerer hullet langsommere end dette
    dt: 1 / 200,
    maxSteps: 6000,
    points: { base: 100, perUnder: 40, perOver: 25, min: 10, perLevel: 10, holeInOne: 100 },
    preview: { afterBounce: 130, noBounce: 320 }  // kort forhåndslinje
  };

  // ---------- Tilfældige tal med frø ----------
  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Geometri ----------
  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function closestOnSeg(w, px, py) {
    var dx = w.bx - w.ax, dy = w.by - w.ay, L2 = dx * dx + dy * dy;
    var u = L2 ? ((px - w.ax) * dx + (py - w.ay) * dy) / L2 : 0;
    u = Math.max(0, Math.min(1, u));
    return { x: w.ax + u * dx, y: w.ay + u * dy };
  }
  function distToWall(w, x, y) { var q = closestOnSeg(w, x, y); return Math.hypot(x - q.x, y - q.y) - w.t / 2; }
  function rad(deg) { return deg * Math.PI / 180; }
  function normAngle(a) { a = a % 360; return a < 0 ? a + 360 : a; }
  function angleTo(from, to) { return normAngle(Math.round(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI)); }

  function speedFor(power) {
    var p = Math.max(1, Math.min(RULES.powers, power));
    return Math.sqrt(2 * RULES.friction * p * RULES.distPerPower);
  }
  function borders() {
    return [
      { ax: 0, ay: 0, bx: W, by: 0, t: 0, kant: true },
      { ax: W, ay: 0, bx: W, by: H, t: 0, kant: true },
      { ax: W, ay: H, bx: 0, by: H, t: 0, kant: true },
      { ax: 0, ay: H, bx: 0, by: 0, t: 0, kant: true }
    ];
  }

  // ---------- Fysik: ét slag ----------
  // Returnerer { path: [{x,y,t}], bounces: [{x,y,d}], end: {x,y}, result: 'stop'|'hul'|'vand', length }
  function simulate(hole, from, angle, power) {
    var r = RULES.ballR, dt = RULES.dt;
    var x = from.x, y = from.y;
    var v = speedFor(power), a = rad(angle);
    var vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    var path = [{ x: x, y: y, t: 0, d: 0 }], bounces = [];
    var walls = hole.vaegge, len = 0, result = 'stop', step;
    for (step = 1; step <= RULES.maxSteps; step++) {
      // Skråning og opbremsning (sand bremser mere)
      var fric = RULES.friction;
      for (var i = 0; i < hole.sand.length; i++) if (inRect(hole.sand[i], x, y)) { fric *= RULES.sandFactor; break; }
      for (i = 0; i < hole.skraaning.length; i++) {
        var s = hole.skraaning[i];
        if (inRect(s, x, y)) { vx += Math.cos(rad(s.dir)) * RULES.slopeAccel * dt; vy += Math.sin(rad(s.dir)) * RULES.slopeAccel * dt; }
      }
      var sp = Math.hypot(vx, vy);
      if (sp <= fric * dt) { vx = 0; vy = 0; break; }
      vx -= vx / sp * fric * dt; vy -= vy / sp * fric * dt;
      var nx = x + vx * dt, ny = y + vy * dt;
      len += Math.hypot(nx - x, ny - y);
      x = nx; y = ny;
      // Bander og vægge
      var hit = false;
      for (i = 0; i < walls.length; i++) {
        var w = walls[i], q = closestOnSeg(w, x, y);
        var dx = x - q.x, dy = y - q.y, d = Math.hypot(dx, dy), min = r + w.t / 2;
        if (d < min) {
          var ux, uy;
          if (d > 1e-9) { ux = dx / d; uy = dy / d; }
          else { var wl = Math.hypot(w.bx - w.ax, w.by - w.ay) || 1; ux = -(w.by - w.ay) / wl; uy = (w.bx - w.ax) / wl; }
          if (w.kant) { // yderkanten: altid ind mod banen
            if (w.ay === w.by) { ux = 0; uy = w.ay === 0 ? 1 : -1; } else { uy = 0; ux = w.ax === 0 ? 1 : -1; }
            if (w.ay === w.by) y = w.ay + uy * min; else x = w.ax + ux * min;
          } else { x = q.x + ux * min; y = q.y + uy * min; }
          var vn = vx * ux + vy * uy;
          if (vn < 0) {
            vx -= (1 + RULES.restitution) * vn * ux; vy -= (1 + RULES.restitution) * vn * uy;
            hit = true;
          }
        }
      }
      if (hit) bounces.push({ x: x, y: y, d: len });
      path.push({ x: x, y: y, t: step * dt, d: len });
      // Vand: bolden er i vandet, når midten er over vandet
      var wet = false;
      for (i = 0; i < hole.vand.length; i++) if (inRect(hole.vand[i], x, y)) { wet = true; break; }
      if (wet) { result = 'vand'; break; }
      // Hullet
      var hd = Math.hypot(x - hole.hul.x, y - hole.hul.y);
      if (hd < RULES.holeR && Math.hypot(vx, vy) < RULES.captureSpeed) {
        x = hole.hul.x; y = hole.hul.y;
        path.push({ x: x, y: y, t: (step + 1) * dt, d: len + hd });
        result = 'hul'; break;
      }
    }
    var last = path[path.length - 1];
    if (last.x !== x || last.y !== y) path.push({ x: x, y: y, t: step * dt, d: len });
    return { path: path, bounces: bounces, end: { x: x, y: y }, result: result, length: len, duration: path[path.length - 1].t };
  }

  // Forhåndslinjen: 'kort' = første stykke inkl. første bandehop, 'hel' = hele banen
  function preview(hole, from, angle, power, mode) {
    var sim = simulate(hole, from, angle, power);
    if (mode === 'hel') return { path: sim.path, full: true, sim: sim };
    var cut = sim.bounces.length ? sim.bounces[0].d + RULES.preview.afterBounce : RULES.preview.noBounce;
    if (cut >= sim.length) return { path: sim.path, full: true, sim: sim };
    var pts = [];
    for (var i = 0; i < sim.path.length; i++) {
      var p = sim.path[i];
      if (p.d > cut) {
        var prev = sim.path[i - 1], f = (cut - prev.d) / ((p.d - prev.d) || 1);
        pts.push({ x: prev.x + (p.x - prev.x) * f, y: prev.y + (p.y - prev.y) * f, d: cut });
        break;
      }
      pts.push(p);
    }
    return { path: pts, full: false, sim: sim };
  }

  // ---------- Passérbarhed og par (gitter-søgning) ----------
  var CELL = 10, GW = W / CELL, GH = H / CELL;
  function passGrid(hole) {
    var g = new Uint8Array(GW * GH), clear = RULES.ballR + 3;
    for (var j = 0; j < GH; j++) for (var i = 0; i < GW; i++) {
      var x = i * CELL + CELL / 2, y = j * CELL + CELL / 2, ok = 1;
      if (x < clear || y < clear || x > W - clear || y > H - clear) ok = 0;
      for (var k = 0; ok && k < hole.vaegge.length; k++) if (!hole.vaegge[k].kant && distToWall(hole.vaegge[k], x, y) < clear) ok = 0;
      for (k = 0; ok && k < hole.vand.length; k++) {
        var v = hole.vand[k];
        if (x > v.x - 4 && x < v.x + v.w + 4 && y > v.y - 4 && y < v.y + v.h + 4) ok = 0;
      }
      g[j * GW + i] = ok;
    }
    return g;
  }
  function cellOf(p) { return Math.min(GH - 1, Math.floor(p.y / CELL)) * GW + Math.min(GW - 1, Math.floor(p.x / CELL)); }
  function gridPath(hole, g) {
    g = g || passGrid(hole);
    var start = cellOf(hole.tee), goal = cellOf(hole.hul);
    if (!g[start] || !g[goal]) return null;
    var prev = new Int32Array(GW * GH).fill(-1), q = [start], head = 0;
    prev[start] = start;
    while (head < q.length) {
      var c = q[head++];
      if (c === goal) break;
      var cx = c % GW, cy = (c / GW) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
        var n = y * GW + x;
        if (!g[n] || prev[n] >= 0) continue;
        if (dx && dy && (!g[cy * GW + x] || !g[y * GW + cx])) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    var cells = [goal];
    while (cells[cells.length - 1] !== start) cells.push(prev[cells[cells.length - 1]]);
    cells.reverse();
    return cells.map(function (c) { return { x: (c % GW) * CELL + CELL / 2, y: ((c / GW) | 0) * CELL + CELL / 2 }; });
  }
  function lineFree(g, a, b) {
    var L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 4));
    for (var i = 0; i <= n; i++) {
      var x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      if (!g[cellOf({ x: x, y: y })]) return false;
    }
    return true;
  }
  // Antal lige stykker fra tee til hul (snoren strammes)
  function straightLegs(hole, g, pts) {
    var legs = [hole.tee], i = 0;
    pts = pts.slice(); pts[0] = hole.tee; pts[pts.length - 1] = hole.hul;
    while (i < pts.length - 1) {
      var j = pts.length - 1;
      while (j > i + 1 && !lineFree(g, pts[i], pts[j])) j--;
      legs.push(pts[j]); i = j;
    }
    return legs;
  }
  function analyse(hole) {
    var g = passGrid(hole), pts = gridPath(hole, g);
    if (!pts) return null;
    var legs = straightLegs(hole, g, pts), len = 0, sandy = false;
    for (var i = 1; i < legs.length; i++) {
      var a = legs[i - 1], b = legs[i], L = Math.hypot(b.x - a.x, b.y - a.y);
      len += L;
      for (var k = 0; k <= 20; k++) {
        var x = a.x + (b.x - a.x) * k / 20, y = a.y + (b.y - a.y) * k / 20;
        hole.sand.forEach(function (s) { if (inRect(s, x, y)) sandy = true; });
      }
    }
    var segs = legs.length - 1;
    // Lange stykker (over højeste kraft) kræver et ekstra slag
    var long = 0;
    for (i = 1; i < legs.length; i++) long += Math.max(0, Math.ceil(Math.hypot(legs[i].x - legs[i - 1].x, legs[i].y - legs[i - 1].y) / (RULES.powers * RULES.distPerPower * 0.9)) - 1);
    var par = Math.max(2, Math.min(6, segs + 1 + long + (sandy ? 1 : 0)));
    return { par: par, legs: legs, length: len, sandy: sandy };
  }

  // ---------- Banegenerator ----------
  function overlapsRect(a, b, m) { return a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h; }
  function nearPoint(r, p, m) { return p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m; }
  // Sværhed pr. hul: flere vægge og forhindringer, jo længere man kommer
  function plan(level) {
    var L = Math.max(1, level);
    return {
      walls: Math.min(1 + Math.floor((L - 1) / 2), 5),
      diagonal: L >= 3,
      sand: L >= 2 ? Math.min(1 + Math.floor((L - 2) / 4), 2) : 0,
      water: L >= 4 ? Math.min(1 + Math.floor((L - 4) / 5), 2) : 0,
      slope: L >= 6 ? Math.min(1 + Math.floor((L - 6) / 6), 2) : 0
    };
  }
  function generate(level, seed) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var h = tryGenerate(level, (seed >>> 0) + attempt * 7919);
      if (h) return h;
    }
    // Nødudvej (sker ikke i praksis): en åben bane
    return finishHole({ level: level, seed: seed, tee: { x: 120, y: 300 }, hul: { x: 880, y: 300 }, vaegge: borders(), sand: [], vand: [], skraaning: [] });
  }
  function finishHole(h, ex) {
    var an = analyse(h);
    h.legs = an ? an.legs : [];
    ex = ex || expert(h);
    h.expert = ex;
    // Par = det antal slag, en dygtig spiller (søgningen nedenfor) bruger, plus ét
    h.par = Math.max(2, Math.min(6, (ex || 5) + 1));
    h.W = W; h.H = H;
    return h;
  }
  // Afstandsfelt: rulleafstand til hullet uden om vægge og vand (gitter)
  function distField(hole) {
    var g = passGrid(hole), d = new Float64Array(GW * GH).fill(1e9), goal = cellOf(hole.hul);
    d[goal] = 0;
    var q = [goal];
    while (q.length) {
      var nq = [];
      for (var k = 0; k < q.length; k++) {
        var c = q[k], cx = c % GW, cy = (c / GW) | 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var x = cx + dx, y = cy + dy;
          if ((!dx && !dy) || x < 0 || y < 0 || x >= GW || y >= GH) continue;
          var n = y * GW + x;
          if (!g[n]) continue;
          var nd = d[c] + (dx && dy ? 1.4142 : 1) * CELL;
          if (nd < d[n] - 1e-6) { d[n] = nd; nq.push(n); }
        }
      }
      q = nq;
    }
    return function (p) { return d[cellOf(p)]; };
  }
  // En dygtig spiller: prøver retninger i trin af 4° og alle kræfter og vælger
  // det slag, der lander tættest på hullet (ad vejen). Giver antal slag (højst 6, ellers null).
  function expert(hole, step) {
    step = step || 4;
    var f = distField(hole), b = { x: hole.tee.x, y: hole.tee.y }, n = 0;
    while (n < 6) {
      var best = null, bestSc = Infinity;
      for (var a = 0; a < 360; a += step) for (var p = 1; p <= RULES.powers; p++) {
        var s = simulate(hole, b, a, p);
        var sc = s.result === 'hul' ? -1 : (s.result === 'vand' ? Infinity : f(s.end));
        if (sc < bestSc) { bestSc = sc; best = s; }
        if (sc < 0) break;
      }
      n++;
      if (!best) return null;
      if (best.result === 'hul') return n;
      b = best.end;
    }
    return null;
  }
  function tryGenerate(level, seed) {
    var R = rng(seed), p = plan(level);
    var rnd = function (a, b) { return a + R() * (b - a); };
    var flip = R() < 0.5;
    var tee = { x: Math.round(rnd(70, 150)), y: Math.round(rnd(90, H - 90)) };
    var hul = { x: Math.round(rnd(820, 920)), y: Math.round(rnd(90, H - 90)) };
    if (flip) { tee.x = W - tee.x; hul.x = W - hul.x; }
    var hole = { level: level, seed: seed, tee: tee, hul: hul, vaegge: borders(), sand: [], vand: [], skraaning: [] };
    var keepOut = function (x, y, m) { return Math.hypot(x - tee.x, y - tee.y) < m || Math.hypot(x - hul.x, y - hul.y) < m; };
    // Vægge: lodrette eller skrå stykker i midten, fastgjort til kanten eller frit
    var tries = 0;
    while (hole.vaegge.length - 4 < p.walls && tries++ < 60) {
      var t = 18, x = Math.round(rnd(260, 740)), len = Math.round(rnd(160, 340)), w;
      var kind = R();
      if (kind < 0.35) { // fra øverste kant
        w = { ax: x, ay: 0, bx: x, by: len, t: t };
      } else if (kind < 0.7) { // fra nederste kant
        w = { ax: x, ay: H, bx: x, by: H - len, t: t };
      } else { // fri væg, evt. skrå
        var cy = rnd(150, H - 150), ang = p.diagonal && R() < 0.7 ? rnd(25, 65) * (R() < 0.5 ? 1 : -1) : 90;
        len = Math.round(rnd(120, 240));
        var dx = Math.cos(rad(ang)) * len / 2, dy = Math.sin(rad(ang)) * len / 2;
        w = { ax: Math.round(x - dx), ay: Math.round(cy - dy), bx: Math.round(x + dx), by: Math.round(cy + dy), t: t };
      }
      if (distToWall(w, tee.x, tee.y) < 70 || distToWall(w, hul.x, hul.y) < 70) continue;
      var close = hole.vaegge.some(function (o) { return !o.kant && Math.abs((o.ax + o.bx) / 2 - (w.ax + w.bx) / 2) < 90; });
      if (close) continue;
      hole.vaegge.push(w);
    }
    var zones = [];
    function addZone(list, n, minW, maxW, minH, maxH, margin, extra) {
      var tr = 0;
      while (n > 0 && tr++ < 60) {
        var z = { x: Math.round(rnd(200, W - 200 - maxW)), y: Math.round(rnd(30, H - 30 - maxH)), w: Math.round(rnd(minW, maxW)), h: Math.round(rnd(minH, maxH)) };
        if (nearPoint(z, tee, margin) || nearPoint(z, hul, margin)) continue;
        if (zones.some(function (o) { return overlapsRect(o, z, 16); })) continue;
        if (hole.vaegge.some(function (wl) { return !wl.kant && rectNearWall(z, wl, 14); })) continue;
        if (extra) extra(z);
        list.push(z); zones.push(z); n--;
      }
    }
    addZone(hole.vand, p.water, 90, 170, 70, 150, 70);
    addZone(hole.sand, p.sand, 90, 180, 60, 140, 45);
    addZone(hole.skraaning, p.slope, 120, 200, 100, 180, 30, function (z) { z.dir = [0, 45, 90, 135, 180, 225, 270, 315][Math.floor(R() * 8)]; });
    if (hole.vaegge.length - 4 < Math.min(p.walls, 1)) return null;
    var an = analyse(hole);
    if (!an) return null;
    // Ikke for nemt: fra hul 3 skal der være mindst ét knæk eller en forhindring på vejen
    if (level >= 3 && an.legs.length < 3 && !an.sandy) return null;
    // Den direkte linje må ikke være helt fri fra hul 2
    if (level >= 2 && an.legs.length === 2 && !hole.sand.length) return null;
    var ex = expert(hole);
    if (!ex) return null;
    return finishHole(hole, ex);
  }
  function rectNearWall(z, w, m) {
    // Grov test: tjek punkter langs væggen mod det udvidede rektangel
    for (var i = 0; i <= 12; i++) {
      var x = w.ax + (w.bx - w.ax) * i / 12, y = w.ay + (w.by - w.ay) * i / 12;
      if (x > z.x - m - w.t / 2 && x < z.x + z.w + m + w.t / 2 && y > z.y - m - w.t / 2 && y < z.y + z.h + m + w.t / 2) return true;
    }
    return false;
  }

  // ---------- Point ----------
  function holePoints(par, strokes, level) {
    var P = RULES.points, diff = par - strokes;
    var base = diff >= 0 ? P.base + diff * P.perUnder : P.base + diff * P.perOver;
    var pts = Math.max(P.min, base);
    var lv = P.perLevel * level;
    var hio = strokes === 1 ? P.holeInOne : 0;
    return { hole: pts, level: lv, holeInOne: hio, total: pts + lv + hio };
  }

  // ---------- Runden ----------
  function createRun(opts) {
    opts = opts || {};
    var baseSeed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 1e9);
    var state = {
      level: 1, score: 0, cleared: 0, reserve: RULES.startReserve, pool: 0,
      hole: null, ball: null, strokes: 0, penalties: 0, aim: 0, power: 5,
      lastShot: null, holed: false, over: false, ended: false, lastPoints: null, history: [],
      bestStreak: 0
    };
    function setHole(h) {
      state.hole = h;
      state.ball = { x: h.tee.x, y: h.tee.y };
      state.strokes = 0; state.penalties = 0; state.holed = false; state.lastShot = null; state.lastPoints = null;
      state.pool = state.reserve + h.par;
      state.aim = angleTo(h.tee, h.hul);
    }
    setHole(generate(1, baseSeed));
    var run = {
      state: state,
      live: function () { return !state.over && !state.ended && !state.holed; },
      setAim: function (a) { state.aim = normAngle(Math.round(a)); return state.aim; },
      turnAim: function (d) { state.aim = normAngle(state.aim + d); return state.aim; },
      aimAt: function (p) { state.aim = angleTo(state.ball, p); return state.aim; },
      setPower: function (p) { state.power = Math.max(1, Math.min(RULES.powers, Math.round(p))); return state.power; },
      preview: function (mode) { return preview(state.hole, state.ball, state.aim, state.power, mode); },
      // Slå: bolden ruller; tilstanden opdateres med det samme (tegnelaget kan vise rullet bagefter)
      strike: function () {
        if (!run.live()) return { ok: false };
        var from = { x: state.ball.x, y: state.ball.y };
        var sim = simulate(state.hole, from, state.aim, state.power);
        state.strokes++; state.pool--;
        var res = { ok: true, sim: sim, from: from, result: sim.result, holed: false, water: false, over: false };
        if (sim.result === 'vand') {
          state.strokes += RULES.waterPenalty; state.penalties += RULES.waterPenalty; state.pool -= RULES.waterPenalty;
          state.ball = from; res.water = true;
        } else state.ball = { x: sim.end.x, y: sim.end.y };
        state.lastShot = { from: from, path: sim.path, result: sim.result };
        if (sim.result === 'hul') {
          state.holed = true; res.holed = true;
          var pt = holePoints(state.hole.par, state.strokes, state.level);
          var bonus = state.strokes === 1 ? RULES.holeInOneBonus : 0;
          pt.reserveBefore = state.reserve;
          state.reserve = Math.min(RULES.maxReserve, Math.max(0, state.pool) + bonus);
          pt.reserveAfter = state.reserve; pt.bonusStroke = bonus;
          pt.capped = Math.max(0, state.pool) + bonus > RULES.maxReserve;
          state.score += pt.total; state.cleared++;
          state.lastPoints = pt;
          state.history.push({ level: state.level, par: state.hole.par, strokes: state.strokes });
        } else if (state.pool <= 0) {
          state.pool = Math.max(0, state.pool);
          state.over = true; res.over = true;
        }
        return res;
      },
      nextHole: function () {
        if (!state.holed || state.over || state.ended) return false;
        state.level++;
        setHole(generate(state.level, (baseSeed + state.level * 104729) >>> 0));
        return true;
      },
      end: function () { state.ended = true; return { score: state.score, cleared: state.cleared }; },
      _setHole: setHole
    };
    return run;
  }

  var api = {
    W: W, H: H, RULES: RULES, rng: rng, simulate: simulate, preview: preview, speedFor: speedFor,
    generate: generate, analyse: analyse, expert: expert, plan: plan, holePoints: holePoints, createRun: createRun,
    angleTo: angleTo, normAngle: normAngle, borders: borders, inRect: inRect
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.GolfLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
