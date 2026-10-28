/*
 * Billard – spillogikken: fysik og regler. Ingen DOM, ingen farver, ingen grafik.
 * Kører i browseren (window.BillardLogik) og i Node (module.exports).
 *
 * Bordet ses oppefra. Spillefladen (inden for banderne) er W × H = 1000 × 500
 * enheder; x mod højre, y nedad. Vinkler er i grader: 0° = mod højre (+x),
 * 90° = nedad (+y), altså med uret på skærmen. Bagfeltet (hvor man slår op fra)
 * er til venstre, og kuglerne stilles op i trekanten til højre.
 *
 * Kuglerne: 0 = stødbolden, 1–7 = hele, 8 = 8'eren, 9–15 = halve (stribede).
 *
 * Fysikken er deterministisk (fast tidsskridt, ingen tilfældighed): kuglerne
 * ruller med jævn opbremsning (friktion), støder elastisk sammen (lige tunge
 * kugler) og kastes tilbage fra banderne med lidt mindre fart. I de seks huller
 * er der en åbning i banden; ruller en kugles midtpunkt ud over bandens linje i
 * en åbning, er den i hul.
 *
 * Reglerne (forenklet 8-ball):
 *   - Bordet er åbent, til den første kugle er nedlagt lovligt. Den, der nedlagde
 *     den, får den slags (hele eller halve), modstanderen den anden.
 *   - Man skal ramme en af sine egne kugler først (på åbent bord en vilkårlig
 *     kugle undtagen 8'eren). Har man nedlagt alle sine, skal man ramme 8'eren.
 *   - Nedlægger man en af sine egne kugler, må man støde igen.
 *   - Fejlstød: stødbolden rammer ingen kugle, rammer en forkert kugle først eller
 *     ryger i hul. Modstanderen får så kuglen i hånden (placeres frit).
 *   - 8'eren skal nedlægges til sidst. Kommer den i hul før tid eller med et
 *     fejlstød, taber man partiet. Kommer den i hul på åbningsstødet, sættes den op igen.
 *
 * Serien: man spiller partier mod computeren, til man taber et. Hvert vundet
 * parti og hver af ens egne kugler, man nedlægger, giver point.
 */
(function (global) {
  'use strict';

  var W = 1000, H = 500, R = 12;
  var RULES = {
    powers: 10,              // kraft 1–10
    speed0: 170, speedStep: 150,   // fart (enheder/s) for kraft 1 og pr. trin
    friction: 230,           // opbremsning på filten (enheder/s²)
    ballE: 0.95,             // hvor meget fart der bevares i et stød mellem to kugler
    cushionE: 0.72,          // ... og i et hop fra banden
    stopSpeed: 4,            // under denne fart ligger kuglen stille
    dt: 1 / 360,             // tidsskridt (s)
    maxSteps: 360 * 30,
    rec: 3,                  // gem kuglernes stilling hvert 3. skridt (til animationen)
    mouthCorner: 34,         // åbning i banden ved hjørnehullerne (målt fra hjørnet)
    mouthMiddle: 28,         // halv bredde af åbningen ved midterhullerne
    headSpot: { x: 250, y: 250 },
    footSpot: { x: 750, y: 250 },
    points: { ball: 10, frame: 100 }
  };
  // Hullerne: midtpunkt og radius (bruges til tegning og til at sigte efter);
  // aim er punktet, man sigter objektkuglen mod.
  var POCKETS = [
    { id: 0, navn: 'øverst til venstre', x: -6, y: -6, r: 27, aim: { x: 6, y: 6 }, kind: 'hjoerne' },
    { id: 1, navn: 'øverst i midten', x: W / 2, y: -10, r: 25, aim: { x: W / 2, y: 2 }, kind: 'midte' },
    { id: 2, navn: 'øverst til højre', x: W + 6, y: -6, r: 27, aim: { x: W - 6, y: 6 }, kind: 'hjoerne' },
    { id: 3, navn: 'nederst til venstre', x: -6, y: H + 6, r: 27, aim: { x: 6, y: H - 6 }, kind: 'hjoerne' },
    { id: 4, navn: 'nederst i midten', x: W / 2, y: H + 10, r: 25, aim: { x: W / 2, y: H - 2 }, kind: 'midte' },
    { id: 5, navn: 'nederst til højre', x: W + 6, y: H + 6, r: 27, aim: { x: W - 6, y: H - 6 }, kind: 'hjoerne' }
  ];
  var LEVELS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  mult: 1, noise: 1.8, pick: 3, cands: 5,  position: 0 },
    normal: { id: 'normal', name: 'Normal', mult: 2, noise: 1.0, pick: 2, cands: 8,  position: 0.5 },
    svaer:  { id: 'svaer',  name: 'Svær',   mult: 3, noise: 0.3, pick: 1, cands: 12, position: 1 }
  };
  var LEVEL_IDS = ['rolig', 'normal', 'svaer'];

  // ---------- Hjælpere ----------
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
  function normAngle(a) { a = a % 360; if (a < 0) a += 360; return Math.round(a * 1000) / 1000; }
  function angleTo(a, b) { return normAngle(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI); }
  function dirOf(a) { var r = a * Math.PI / 180; return { x: Math.cos(r), y: Math.sin(r) }; }
  function speedOf(power) { return RULES.speed0 + RULES.speedStep * (power - 1); }
  function rollDistance(power) { var v = speedOf(power); return v * v / (2 * RULES.friction); }
  function groupOf(id) { return id === 0 ? 'stoed' : id === 8 ? 'otte' : id < 8 ? 'hel' : 'halv'; }
  function other(g) { return g === 'hel' ? 'halv' : g === 'halv' ? 'hel' : null; }
  function cloneBalls(balls) { return balls.map(function (b) { return { id: b.id, x: b.x, y: b.y, in: b.in }; }); }
  function ballById(balls, id) { for (var i = 0; i < balls.length; i++) if (balls[i].id === id) return balls[i]; return null; }

  // Er (x, y) i en åbning i banden? side: 'v', 'h', 'o', 'n' (venstre, højre, øverst, nederst)
  function inMouth(side, x, y) {
    var mc = RULES.mouthCorner, mm = RULES.mouthMiddle;
    if (side === 'v' || side === 'h') return y < mc || y > H - mc;
    return x < mc || x > W - mc || Math.abs(x - W / 2) < mm;
  }
  // Nærmeste hul til et punkt (til tegning af kuglen, der falder i)
  function nearestPocket(x, y) {
    var best = POCKETS[0], bd = Infinity;
    POCKETS.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
    return best;
  }

  // ---------- Opstilling ----------
  // Trekanten: spidsen på fodpunktet, 8'eren i midten af tredje række, et hel
  // og en halv i de bageste hjørner. Resten blandes med frøet.
  function rack(rand) {
    rand = rand || rng(1);
    var gap = 2 * R + 0.3, dx = gap * Math.sqrt(3) / 2, pos = [];
    for (var row = 0; row < 5; row++) for (var k = 0; k <= row; k++)
      pos.push({ x: RULES.footSpot.x + row * dx, y: RULES.footSpot.y + (k - row / 2) * gap });
    var full = [1, 2, 3, 4, 5, 6, 7], half = [9, 10, 11, 12, 13, 14, 15];
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    shuffle(full); shuffle(half);
    var ids = new Array(15);
    ids[4] = 8;                           // midten af tredje række
    var fullCorner = rand() < 0.5;
    ids[10] = fullCorner ? full.pop() : half.pop();
    ids[14] = fullCorner ? half.pop() : full.pop();
    ids[0] = full.length > half.length ? full.pop() : half.pop();
    var rest = shuffle(full.concat(half));
    for (var i = 0; i < 15; i++) if (ids[i] === undefined) ids[i] = rest.pop();
    var balls = [{ id: 0, x: RULES.headSpot.x, y: RULES.headSpot.y, in: true }];
    for (var j = 0; j < 15; j++) balls.push({ id: ids[j], x: pos[j].x, y: pos[j].y, in: true });
    return balls;
  }
  function overlapsAny(balls, x, y, skipId) {
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.in || b.id === skipId) continue;
      if (Math.hypot(b.x - x, b.y - y) < 2 * R + 0.5) return true;
    }
    return false;
  }
  function onTable(x, y) { return x >= R && x <= W - R && y >= R && y <= H - R; }
  // Nærmeste frie plads ved et punkt (spiraler udad)
  function freeSpotNear(balls, p, skipId) {
    if (onTable(p.x, p.y) && !overlapsAny(balls, p.x, p.y, skipId)) return { x: p.x, y: p.y };
    for (var r = 2 * R; r < 600; r += R) for (var k = 0; k < 24; k++) {
      var a = k / 24 * Math.PI * 2, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (onTable(x, y) && !overlapsAny(balls, x, y, skipId)) return { x: x, y: y };
    }
    return { x: p.x, y: p.y };
  }

  // ---------- Fysik ----------
  // simulate(balls, aim, power) – kuglerne efter et stød.
  // Returnerer { balls, frames: [{t, p: [x,y,...] (NaN for kugler i hul)}], first,
  //              pocketed: [id ...], pocketAt: {id: hul}, cushions, time }
  function simulate(balls, aim, power) {
    var bs = balls.map(function (b) { return { id: b.id, x: b.x, y: b.y, in: b.in, vx: 0, vy: 0 }; });
    var n = bs.length, cue = null, i, j;
    for (i = 0; i < n; i++) if (bs[i].id === 0) cue = bs[i];
    var d = dirOf(aim), v = speedOf(Math.max(1, Math.min(RULES.powers, power)));
    if (cue && cue.in) { cue.vx = d.x * v; cue.vy = d.y * v; }
    var dt = RULES.dt, fr = RULES.friction * dt, e = RULES.cushionE, eb = RULES.ballE, stopV = RULES.stopSpeed;
    var frames = [], first = null, pocketed = [], pocketAt = {}, cushions = 0, cushionsAfterHit = 0;
    function snap(t) {
      var p = new Array(n * 2);
      for (var k = 0; k < n; k++) { p[2 * k] = bs[k].in ? bs[k].x : NaN; p[2 * k + 1] = bs[k].in ? bs[k].y : NaN; }
      frames.push({ t: t, p: p });
    }
    snap(0);
    var step = 0;
    for (; step < RULES.maxSteps; step++) {
      var moving = false;
      for (i = 0; i < n; i++) {
        var b = bs[i];
        if (!b.in || (b.vx === 0 && b.vy === 0)) continue;
        moving = true;
        b.x += b.vx * dt; b.y += b.vy * dt;
        // Banderne (ikke i hullernes åbninger)
        if (b.x < R && b.vx < 0 && !inMouth('v', b.x, b.y)) { b.x = 2 * R - b.x; b.vx = -b.vx * e; b.vy *= e; cushions++; if (first !== null) cushionsAfterHit++; }
        else if (b.x > W - R && b.vx > 0 && !inMouth('h', b.x, b.y)) { b.x = 2 * (W - R) - b.x; b.vx = -b.vx * e; b.vy *= e; cushions++; if (first !== null) cushionsAfterHit++; }
        if (b.y < R && b.vy < 0 && !inMouth('o', b.x, b.y)) { b.y = 2 * R - b.y; b.vy = -b.vy * e; b.vx *= e; cushions++; if (first !== null) cushionsAfterHit++; }
        else if (b.y > H - R && b.vy > 0 && !inMouth('n', b.x, b.y)) { b.y = 2 * (H - R) - b.y; b.vy = -b.vy * e; b.vx *= e; cushions++; if (first !== null) cushionsAfterHit++; }
        // I hul: midtpunktet er ude over bandens linje (det sker kun i en åbning)
        if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
          b.in = false; b.vx = 0; b.vy = 0;
          pocketed.push(b.id); pocketAt[b.id] = nearestPocket(b.x, b.y).id;
        }
      }
      if (!moving) break;
      // Stød mellem kugler
      for (i = 0; i < n; i++) {
        var a = bs[i];
        if (!a.in) continue;
        for (j = i + 1; j < n; j++) {
          var c = bs[j];
          if (!c.in) continue;
          if (a.vx === 0 && a.vy === 0 && c.vx === 0 && c.vy === 0) continue;
          var dx = c.x - a.x; if (dx > 2 * R || dx < -2 * R) continue;
          var dy = c.y - a.y; if (dy > 2 * R || dy < -2 * R) continue;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 2 * R || dist === 0) continue;
          var nx = dx / dist, ny = dy / dist;
          var rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
          if (rel > 0) {
            var J = (1 + eb) / 2 * rel;
            a.vx -= J * nx; a.vy -= J * ny; c.vx += J * nx; c.vy += J * ny;
            if (first === null) { if (a.id === 0) first = c.id; else if (c.id === 0) first = a.id; }
          }
          var push = (2 * R - dist) / 2;
          a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
        }
      }
      // Friktion
      for (i = 0; i < n; i++) {
        var f = bs[i];
        if (f.vx === 0 && f.vy === 0) continue;
        var sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        if (sp <= stopV || sp <= fr) { f.vx = 0; f.vy = 0; continue; }
        var k = (sp - fr) / sp; f.vx *= k; f.vy *= k;
      }
      if (step % RULES.rec === 0) snap((step + 1) * dt);
    }
    snap((step + 1) * dt);
    return {
      balls: bs.map(function (b) { return { id: b.id, x: b.x, y: b.y, in: b.in }; }),
      frames: frames, first: first, pocketed: pocketed, pocketAt: pocketAt,
      cushions: cushions, cushionsAfterHit: cushionsAfterHit, time: (step + 1) * dt
    };
  }

  // ---------- Forhåndslinjen ----------
  // Ren geometri: stødboldens vej til den første kugle eller bande.
  // hit.type: 'kugle' (med spøgelseskugle, objektkuglens retning og stødboldens
  // retning bagefter), 'bande' (med retningen efter hoppet) eller 'hul'.
  function preview(balls, aim) {
    var cue = ballById(balls, 0);
    if (!cue || !cue.in) return null;
    var d = dirOf(aim), best = Infinity, hit = null;
    balls.forEach(function (b) {
      if (!b.in || b.id === 0) return;
      var fx = cue.x - b.x, fy = cue.y - b.y;
      var bb = fx * d.x + fy * d.y, cc = fx * fx + fy * fy - 4 * R * R;
      var disc = bb * bb - cc;
      if (disc < 0) return;
      var t = -bb - Math.sqrt(disc);
      if (t > 0.001 && t < best) { best = t; hit = b; }
    });
    // Banderne
    var tw = Infinity, side = null;
    if (d.x < -1e-9) { var t1 = (R - cue.x) / d.x; if (t1 < tw) { tw = t1; side = 'v'; } }
    if (d.x > 1e-9) { var t2 = (W - R - cue.x) / d.x; if (t2 < tw) { tw = t2; side = 'h'; } }
    if (d.y < -1e-9) { var t3 = (R - cue.y) / d.y; if (t3 < tw) { tw = t3; side = 'o'; } }
    if (d.y > 1e-9) { var t4 = (H - R - cue.y) / d.y; if (t4 < tw) { tw = t4; side = 'n'; } }
    tw = Math.max(0, tw);
    var out = { from: { x: cue.x, y: cue.y }, aim: aim };
    if (hit && best <= tw) {
      var g = { x: cue.x + d.x * best, y: cue.y + d.y * best };
      var nx = (hit.x - g.x) / (2 * R), ny = (hit.y - g.y) / (2 * R);
      var cos = d.x * nx + d.y * ny;           // 1 = lige på, 0 = strejf
      var tx = d.x - cos * nx, ty = d.y - cos * ny, tl = Math.hypot(tx, ty);
      out.to = g;
      out.hit = { type: 'kugle', id: hit.id, ghost: g, ball: { x: hit.x, y: hit.y },
        obj: { x: nx, y: ny }, objLen: cos, cue: tl > 1e-6 ? { x: tx / tl, y: ty / tl } : null, cueLen: tl };
      return out;
    }
    var p = { x: cue.x + d.x * tw, y: cue.y + d.y * tw };
    out.to = p;
    if (side && inMouth(side, p.x, p.y)) { out.hit = { type: 'hul', pocket: nearestPocket(p.x, p.y).id }; return out; }
    var r = { x: d.x, y: d.y };
    if (side === 'v' || side === 'h') r.x = -r.x; else r.y = -r.y;
    out.hit = { type: 'bande', side: side, refl: r };
    return out;
  }

  // ---------- Skudmuligheder (geometri, til "Næste kugle" og computeren) ----------
  function segClear(balls, a, b, skip, margin) {
    var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    for (var i = 0; i < balls.length; i++) {
      var o = balls[i];
      if (!o.in || skip.indexOf(o.id) >= 0) continue;
      var t = L2 > 0 ? ((o.x - a.x) * dx + (o.y - a.y) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      var px = a.x + dx * t - o.x, py = a.y + dy * t - o.y;
      if (px * px + py * py < margin * margin) return false;
    }
    return true;
  }
  // Direkte skud: objektkugle id i hul p. ease 0–1 (0 = umuligt)
  function shotOption(balls, cue, id, pocket) {
    var b = ballById(balls, id);
    if (!b || !b.in) return null;
    var p = pocket.aim, bx = p.x - b.x, by = p.y - b.y, bl = Math.hypot(bx, by);
    if (bl < 1) return null;
    var ux = bx / bl, uy = by / bl;
    // Midterhuller: kuglen skal komme nogenlunde vinkelret ind
    if (pocket.kind === 'midte' && Math.abs(ux) > 0.72) return null;
    var g = { x: b.x - ux * 2 * R, y: b.y - uy * 2 * R };
    if (g.x < R - 1 || g.x > W - R + 1 || g.y < R - 1 || g.y > H - R + 1) return null;
    var cx = g.x - cue.x, cy = g.y - cue.y, cl = Math.hypot(cx, cy);
    if (cl < 1) return null;
    var cos = (cx * ux + cy * uy) / cl;      // cut-vinklens cosinus
    if (cos < 0.25) return null;
    if (!segClear(balls, cue, g, [0, id], 2 * R - 0.5)) return null;
    if (!segClear(balls, b, p, [0, id], 2 * R - 0.5)) return null;
    var ease = cos * cos / (1 + (cl + bl) / 900);
    return { id: id, pocket: pocket.id, aim: angleTo(cue, g), ease: ease, cut: Math.acos(Math.min(1, cos)) * 180 / Math.PI, dist: cl + bl, ghost: g };
  }
  function shotOptions(balls, targets, cuePos) {
    var cue = cuePos || ballById(balls, 0), out = [];
    targets.forEach(function (id) {
      POCKETS.forEach(function (p) { var o = shotOption(balls, cue, id, p); if (o) out.push(o); });
    });
    out.sort(function (a, b) { return b.ease - a.ease || a.id - b.id || a.pocket - b.pocket; });
    return out;
  }
  // Den kraft, der lige når frem med lidt overskud
  function powerFor(dist, cut) {
    var need = dist * 1.35 + 120 + (cut || 0) * 6;
    for (var p = 1; p <= RULES.powers; p++) if (rollDistance(p) >= need) return p;
    return RULES.powers;
  }

  // ---------- Reglerne for ét stød ----------
  // ctx: { group: 'hel'|'halv'|null, onEight: bool, breakShot: bool }
  // Returnerer { foul, reason, eightIn, assign, own, opp, continues, frame: 'win'|'lose'|null, respotEight }
  function judge(ctx, sim) {
    var pk = sim.pocketed, res = { foul: false, reason: '', own: [], opp: [], assign: null, continues: false, frame: null, respotEight: false };
    var cueIn = pk.indexOf(0) >= 0, eightIn = pk.indexOf(8) >= 0;
    var g = ctx.group;
    if (sim.first === null) { res.foul = true; res.reason = 'ingen'; }
    else if (g && !ctx.onEight && groupOf(sim.first) !== g) { res.foul = true; res.reason = 'forkert'; }
    else if (ctx.onEight && sim.first !== 8) { res.foul = true; res.reason = 'ikke8'; }
    else if (!g && sim.first === 8 && !ctx.breakShot) { res.foul = true; res.reason = 'aaben8'; }
    if (cueIn) { res.foul = true; res.reason = res.reason || 'stoed'; res.cueIn = true; if (res.reason !== 'stoed') res.alsoCue = true; }
    res.eightIn = eightIn;
    // Gruppen tildeles ved første lovlige nedlægning
    if (!g && !res.foul) {
      for (var i = 0; i < pk.length; i++) { var gg = groupOf(pk[i]); if (gg === 'hel' || gg === 'halv') { res.assign = gg; break; } }
    }
    var mine = g || res.assign;
    pk.forEach(function (id) {
      var gr = groupOf(id);
      if (gr === 'hel' || gr === 'halv') { if (mine && gr === mine) res.own.push(id); else res.opp.push(id); }
    });
    if (eightIn) {
      if (ctx.breakShot) res.respotEight = true;
      else res.frame = (ctx.onEight && !res.foul) ? 'win' : 'lose';
    }
    res.continues = !res.foul && !res.frame && (res.own.length > 0 || (!mine && pk.some(function (id) { return id !== 0 && id !== 8; })));
    return res;
  }

  // ---------- Serien ----------
  function createSeries(level, seed) {
    level = LEVELS[level] ? level : 'normal';
    var rand = rng(seed === undefined ? (Date.now() >>> 0) : seed);
    var st = {
      level: level, mult: LEVELS[level].mult, frame: 0, score: 0, framesWon: 0, potted: 0,
      over: false, ended: false, balls: null, groups: { human: null, cpu: null },
      turn: 'human', breaker: 'human', breakShot: true, ballInHand: false, handSpots: null, handIndex: 0,
      aim: 0, power: 8, frameOver: null, last: null, targetIndex: -1, shots: 0, lastPoints: 0, framePoints: 0
    };
    function remaining(group) {
      if (!group) return 7;
      return st.balls.filter(function (b) { return b.in && groupOf(b.id) === group; }).length;
    }
    function onEight(who) { var g = st.groups[who]; return !!g && remaining(g) === 0; }
    function legalTargets(who) {
      who = who || st.turn;
      var g = st.groups[who];
      if (!g) return st.balls.filter(function (b) { return b.in && b.id !== 0 && b.id !== 8; }).map(function (b) { return b.id; });
      if (remaining(g) === 0) return [8];
      return st.balls.filter(function (b) { return b.in && groupOf(b.id) === g; }).map(function (b) { return b.id; });
    }
    function cue() { return ballById(st.balls, 0); }
    // Steder til stødbolden, når man har den i hånden: de bedste først
    function handSpots(who) {
      var targets = legalTargets(who), spots = [];
      for (var x = 60; x <= W - 60; x += 45) for (var y = 45; y <= H - 45; y += 41.25) {
        if (overlapsAny(st.balls, x, y, 0)) continue;
        var opts = shotOptions(st.balls, targets, { x: x, y: y });
        var e = opts.length ? opts[0].ease : 0;
        spots.push({ x: x, y: y, ease: e });
      }
      spots.sort(function (a, b) { return b.ease - a.ease || a.x - b.x || a.y - b.y; });
      var out = [];
      for (var i = 0; i < spots.length && out.length < 6; i++) {
        var s = spots[i];
        if (out.every(function (o) { return Math.hypot(o.x - s.x, o.y - s.y) > 150; })) out.push(s);
      }
      var hs = freeSpotNear(st.balls, RULES.headSpot, 0);
      if (!out.length || out.every(function (o) { return Math.hypot(o.x - hs.x, o.y - hs.y) > 40; })) out.push({ x: hs.x, y: hs.y, ease: 0 });
      return out;
    }
    function placeCue(p) {
      var c = cue();
      c.in = true;
      var f = freeSpotNear(st.balls, p, 0);
      c.x = f.x; c.y = f.y;
    }
    function aimDefault() {
      var t = legalTargets(st.turn), c = cue();
      if (st.breakShot) { st.aim = 0; return; }
      var opts = shotOptions(st.balls, t);
      if (opts.length) { st.aim = angleTo(c, ballById(st.balls, opts[0].id)); return; }
      var near = null, nd = Infinity;
      t.forEach(function (id) { var b = ballById(st.balls, id); var d = Math.hypot(b.x - c.x, b.y - c.y); if (d < nd) { nd = d; near = b; } });
      if (near) st.aim = angleTo(c, near);
    }
    function newFrame() {
      st.frame++;
      st.balls = rack(rand);
      st.groups = { human: null, cpu: null };
      st.breaker = st.frame % 2 === 1 ? 'human' : 'cpu';
      st.turn = st.breaker; st.breakShot = true; st.ballInHand = false; st.handSpots = null; st.handIndex = 0;
      st.frameOver = null; st.last = null; st.targetIndex = -1; st.framePoints = 0;
      st.aim = 0; st.power = 8;
    }
    function setHand(who) {
      st.ballInHand = true;
      st.handSpots = handSpots(who);
      st.handIndex = 0;
      placeCue(st.handSpots[0]);
    }
    function startTurn() {
      st.targetIndex = -1;
      if (st.turn === 'human') aimDefault();
    }
    var run = {
      state: st,
      rand: rand,
      level: LEVELS[level],
      live: function () { return !st.over && !st.ended && !st.frameOver; },
      legalTargets: legalTargets,
      handSpots: handSpots,
      remaining: function (who) { return remaining(st.groups[who]); },
      onEight: onEight,
      setAim: function (a) { st.aim = normAngle(a); st.targetIndex = -1; return st.aim; },
      turnAim: function (d) { st.aim = normAngle(st.aim + d); st.targetIndex = -1; return st.aim; },
      aimAt: function (p) { var c = cue(); if (Math.hypot(p.x - c.x, p.y - c.y) < 1) return st.aim; st.aim = normAngle(Math.round(angleTo(c, p) * 10) / 10); st.targetIndex = -1; return st.aim; },
      setPower: function (p) { st.power = Math.max(1, Math.min(RULES.powers, Math.round(p))); return st.power; },
      // Næste lovlige kugle: sigter, så den går mod det letteste hul (hjælp=true),
      // eller mod kuglens midte (hjælp=false). Kugler uden et frit skud kommer sidst.
      nextTarget: function (help) {
        var t = legalTargets(st.turn), c = cue();
        if (!t.length) return null;
        var opts = shotOptions(st.balls, t), order = [], seen = {};
        opts.forEach(function (o) { if (!seen[o.id]) { seen[o.id] = o; order.push(o.id); } });
        t.slice().sort(function (a, b) {
          var A = ballById(st.balls, a), B = ballById(st.balls, b);
          return Math.hypot(A.x - c.x, A.y - c.y) - Math.hypot(B.x - c.x, B.y - c.y);
        }).forEach(function (id) { if (!seen[id]) { seen[id] = null; order.push(id); } });
        st.targetIndex = (st.targetIndex + 1) % order.length;
        var id = order[st.targetIndex], o = seen[id], b = ballById(st.balls, id);
        var idx = st.targetIndex;
        if (o && help !== false) { st.aim = Math.round(o.aim * 10) / 10; st.power = powerFor(o.dist, o.cut); }
        else st.aim = normAngle(Math.round(angleTo(c, b) * 10) / 10);
        st.targetIndex = idx;
        return { id: id, pocket: o ? o.pocket : null, count: order.length, index: idx };
      },
      // Kuglen i hånden: flyt stødbolden til næste gode sted
      moveCue: function () {
        if (!st.ballInHand || !st.handSpots) return null;
        st.handIndex = (st.handIndex + 1) % st.handSpots.length;
        placeCue(st.handSpots[st.handIndex]);
        startTurn();
        return { index: st.handIndex, count: st.handSpots.length };
      },
      placeCue: function (p) { if (!st.ballInHand) return false; placeCue(p); return true; },
      preview: function () { return preview(st.balls, st.aim); },
      // Stødet: fysikken afgør med det samme, hvor kuglerne ender; reglerne anvendes.
      shoot: function () {
        if (!run.live()) return { ok: false };
        var who = st.turn, g = st.groups[who];
        var ctx = { group: g, onEight: onEight(who), breakShot: st.breakShot };
        var before = cloneBalls(st.balls);
        var sim = simulate(st.balls, st.aim, st.power);
        var j = judge(ctx, sim);
        st.shots++;
        st.balls = sim.balls;
        if (j.assign) { st.groups[who] = j.assign; st.groups[who === 'human' ? 'cpu' : 'human'] = other(j.assign); }
        if (j.respotEight) { var e8 = ballById(st.balls, 8); var f8 = freeSpotNear(st.balls, RULES.footSpot, 8); e8.in = true; e8.x = f8.x; e8.y = f8.y; }
        var pts = 0;
        if (who === 'human' && !j.foul) { pts += j.own.length * RULES.points.ball * st.mult; st.potted += j.own.length; }
        var res = { ok: true, who: who, sim: sim, judge: j, before: before, aim: st.aim, power: st.power, breakShot: st.breakShot };
        st.breakShot = false; st.ballInHand = false; st.handSpots = null;
        if (j.frame) {
          var winner = j.frame === 'win' ? who : (who === 'human' ? 'cpu' : 'human');
          st.frameOver = winner;
          if (winner === 'human') { st.framesWon++; pts += RULES.points.frame * st.mult; }
          else st.over = true;
          res.winner = winner;
        } else {
          var next = j.continues ? who : (who === 'human' ? 'cpu' : 'human');
          st.turn = next;
          if (j.foul) {
            if (next === 'human') setHand('human');
            else { st.ballInHand = true; st.handSpots = null; if (!cue().in) placeCue(RULES.headSpot); }
          } else if (!cue().in) placeCue(RULES.headSpot);
          startTurn();
        }
        st.score += pts; st.framePoints += pts; st.lastPoints = pts; res.points = pts;
        st.last = res;
        return res;
      },
      // Computerens stød: plan = { aim, power, spot } (fra js/ai.js)
      prepareCpu: function (plan) {
        if (st.turn !== 'cpu' || !run.live()) return false;
        if (st.ballInHand && plan.spot) placeCue(plan.spot);
        st.aim = normAngle(plan.aim); st.power = Math.max(1, Math.min(RULES.powers, plan.power));
        return true;
      },
      nextFrame: function () {
        if (st.over || st.frameOver !== 'human') return false;
        newFrame(); startTurn();
        return true;
      },
      end: function () { st.ended = true; return { score: st.score, framesWon: st.framesWon, potted: st.potted, level: st.level }; },
      context: function (who) { return { group: st.groups[who], onEight: onEight(who), breakShot: st.breakShot }; },
      // Til test: læg en bestemt stilling ind
      _setBalls: function (balls, opts) {
        opts = opts || {};
        st.balls = cloneBalls(balls);
        if (opts.groups) st.groups = { human: opts.groups.human, cpu: opts.groups.cpu };
        if (opts.turn) st.turn = opts.turn;
        st.breakShot = !!opts.breakShot; st.ballInHand = false; st.handSpots = null; st.frameOver = null;
        if (opts.hand) setHand(st.turn);
        startTurn();
      }
    };
    newFrame(); startTurn();
    return run;
  }

  var api = {
    W: W, H: H, R: R, RULES: RULES, POCKETS: POCKETS, LEVELS: LEVELS, LEVEL_IDS: LEVEL_IDS, DEFAULT_LEVEL: 'normal',
    rng: rng, normAngle: normAngle, angleTo: angleTo, dirOf: dirOf, speedOf: speedOf, rollDistance: rollDistance,
    groupOf: groupOf, other: other, rack: rack, simulate: simulate, preview: preview, judge: judge,
    shotOption: shotOption, shotOptions: shotOptions, powerFor: powerFor, segClear: segClear,
    inMouth: inMouth, nearestPocket: nearestPocket, freeSpotNear: freeSpotNear, overlapsAny: overlapsAny,
    cloneBalls: cloneBalls, ballById: ballById, createSeries: createSeries
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BillardLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
