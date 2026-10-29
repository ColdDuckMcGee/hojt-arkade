/*
 * Muren – spillogikken. Ingen DOM, ingen farver og ingen grafik.
 *
 * Brættet er W × H = 700 × 1000 enheder: 7 kolonner og 10 rækker à 100.
 * Række 0 er øverst. Række 9 er bundlinjen: når en sten rykker derned, er
 * spillet slut. Kanonen står på gulvet (y = H) og skyder opad.
 *
 * En tur:
 *   1. Spilleren sigter (vinkel i grader: 0 = lige op, negativ = mod venstre,
 *      positiv = mod højre, højst ±80°) og skyder en salve med N kugler.
 *   2. Kuglerne sendes af sted én ad gangen og hopper på vægge, loft og sten.
 *      Hvert træf trækker 1 fra stenens tal; ved 0 forsvinder stenen.
 *      Rammer en kugle en "+1 kugle"-ring, samles den op (gælder fra næste tur).
 *   3. Når alle kugler er landet på gulvet, rykker muren ét trin ned, og en ny
 *      række kommer ind øverst. Næste salve skydes fra dér, hvor den FØRSTE
 *      kugle landede.
 *
 * Fysikken kører i faste tidsskridt (step) og er helt deterministisk: samme
 * frø og samme vinkler giver altid samme spil. Tilfældighed (nye rækker) kommer
 * fra en lille, seedet generator, hvis tilstand ligger i state.rng.
 *
 * Point: 1 point for hvert træf på en sten og 10 point i bonus for hver knust sten.
 */
(function (global) {
  'use strict';

  var COLS = 7, ROWS = 10, CELL = 100;
  var W = COLS * CELL, H = ROWS * CELL;
  var RULES = {
    gap: 8,            // luft mellem stenene (mindre end en kugle, så de ikke kan smutte imellem)
    ballR: 9,          // kuglens radius
    ringR: 22,         // "+1 kugle"-ringens radius
    speed: 12,         // enheder pr. tidsskridt
    sub: 3,            // delskridt pr. tidsskridt (ingen kugle springer gennem en sten)
    launchGap: 5,      // tidsskridt mellem to kugler i salven
    maxAngle: 80,      // største vinkel fra lodret (grader)
    maxSteps: 40000,   // sikkerhedsnet: salven afsluttes, hvis den aldrig lander
    hitPoints: 1,      // point pr. træf
    breakBonus: 10,    // grundbonus pr. knust sten; hertil lægges stenens OPRINDELIGE tal (n0)
    startBalls: 1
  };

  // Bonus for en knust sten: grundbonus + stenens oprindelige tal
  function breakPoints(b) { return RULES.breakBonus + (b.n0 !== undefined ? b.n0 : b.n); }

  // Spillets egne indstillinger og deres standardværdier (bruges af app.js).
  // fart: tidsskridt pr. sekund for salven; standard er Normal.
  var SETTINGS = { fart: 'normal', gloed: true };
  var FART = { rolig: 50, normal: 80, hurtig: 130 };
  function fartAf(v) { return FART[v] ? v : SETTINGS.fart; }

  // ---------- Seedet tilfældighed (mulberry32) ----------
  function rand(state) {
    var t = (state.rng = (state.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clampAngle(a) { return clamp(Math.round(a * 10) / 10, -RULES.maxAngle, RULES.maxAngle); }
  function dirOf(a) { var r = a * Math.PI / 180; return { x: Math.sin(r), y: -Math.cos(r) }; }

  // Stenens rektangel og ringens midte i brættets enheder
  function brickRect(b) {
    var g = RULES.gap / 2;
    return { x: b.c * CELL + g, y: b.r * CELL + g, w: CELL - RULES.gap, h: CELL - RULES.gap };
  }
  function ringPos(o) { return { x: o.c * CELL + CELL / 2, y: o.r * CELL + CELL / 2, r: RULES.ringR }; }

  function overlaps(x, y, R, b) {
    var q = brickRect(b);
    var cx = clamp(x, q.x, q.x + q.w), cy = clamp(y, q.y, q.y + q.h);
    var dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy < R * R;
  }

  // Ny række øverst (række 0) med tal = turen. Flere og stærkere sten med tiden.
  function spawnRow(state) {
    var turn = state.turn;
    var count = 1 + Math.floor(rand(state) * 3) + Math.min(2, Math.floor(turn / 12));
    count = clamp(count, 1, COLS - 1);
    var cells = [];
    for (var c = 0; c < COLS; c++) cells.push(c);
    for (var i = cells.length - 1; i > 0; i--) { var j = Math.floor(rand(state) * (i + 1)); var t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    for (var k = 0; k < count; k++) {
      var n = turn;
      if (turn >= 4 && rand(state) < 0.2) n = turn * 2;
      state.bricks.push({ c: cells[k], r: 0, n: n, n0: n });
    }
    // Én "+1 kugle"-ring i et frit felt i hver ny række
    state.rings.push({ c: cells[count], r: 0 });
  }

  function newState(seed) {
    var s = {
      seed: seed >>> 0, rng: seed | 0,
      turn: 1, balls: RULES.startBalls, score: 0, hits: 0, broken: 0, ringsTaken: 0,
      originX: W / 2, aim: 0,
      bricks: [], rings: [],
      volley: null, over: false, ended: false,
      lastVolley: null      // opsummering af sidste salve
    };
    spawnRow(s);
    return s;
  }

  // ---------- Kuglernes bevægelse (ét delskridt) ----------
  // Bevægelsen deles i x og y hver for sig: rammer kuglen noget på den ene akse,
  // trækkes bevægelsen tilbage, og farten vendes på den akse. Det er enkelt,
  // robust og deterministisk. onHit(brick) kaldes for hver ramt sten (eller ingenting).
  function moveSub(ball, bricks, onHit) {
    var R = RULES.ballR, sub = RULES.sub, hitAny = false;
    // x
    var nx = ball.x + ball.vx / sub;
    if (nx < R) { nx = 2 * R - nx; ball.vx = -ball.vx; hitAny = 'vaeg'; }
    else if (nx > W - R) { nx = 2 * (W - R) - nx; ball.vx = -ball.vx; hitAny = 'vaeg'; }
    var hx = [];
    for (var i = 0; i < bricks.length; i++) if (overlaps(nx, ball.y, R, bricks[i])) hx.push(bricks[i]);
    if (hx.length) { ball.vx = -ball.vx; hitAny = 'sten'; hx.forEach(onHit); }
    else ball.x = nx;
    // y
    var ny = ball.y + ball.vy / sub;
    if (ny < R) { ny = 2 * R - ny; ball.vy = -ball.vy; hitAny = hitAny || 'loft'; }
    var hy = [];
    for (var j = 0; j < bricks.length; j++) if (hx.indexOf(bricks[j]) < 0 && overlaps(ball.x, ny, R, bricks[j])) hy.push(bricks[j]);
    if (hy.length) { ball.vy = -ball.vy; hitAny = 'sten'; hy.forEach(onHit); }
    else ball.y = ny;
    return hitAny;
  }

  // ---------- Forhåndslinjen ----------
  // En "spøgelseskugle" med samme fysik, men uden at skade stenene. Linjen går
  // til den første flade, kuglen rammer, og (bounces = 1) videre til den næste.
  function preview(state, angle, bounces) {
    if (bounces === undefined) bounces = 1;
    var d = dirOf(angle), R = RULES.ballR;
    var ball = { x: state.originX, y: H - R, vx: d.x * RULES.speed, vy: d.y * RULES.speed };
    var pts = [{ x: ball.x, y: ball.y }], first = null, n = 0;
    for (var step = 0; step < 4000; step++) {
      for (var k = 0; k < RULES.sub; k++) {
        var hitBrick = null;
        var h = moveSub(ball, state.bricks, function (b) { if (!hitBrick) hitBrick = b; });
        if (h) {
          pts.push({ x: ball.x, y: ball.y });
          if (!first) first = { x: ball.x, y: ball.y, what: h, brick: hitBrick };
          if (n++ >= bounces) return { pts: pts, first: first };
        }
        if (ball.y >= H - R && ball.vy > 0) { pts.push({ x: ball.x, y: H - R }); return { pts: pts, first: first, floor: true }; }
      }
    }
    pts.push({ x: ball.x, y: ball.y });
    return { pts: pts, first: first };
  }

  // ---------- Salven ----------
  function startVolley(state) {
    var d = dirOf(state.aim), R = RULES.ballR, list = [];
    for (var i = 0; i < state.balls; i++) list.push({ x: state.originX, y: H - R, vx: d.x * RULES.speed, vy: d.y * RULES.speed, st: 0 });
    state.volley = { balls: list, step: 0, launched: 0, landed: 0, firstX: null, gained: 0, hits: 0, broken: 0, points: 0, done: false };
  }

  // Ét tidsskridt. Returnerer hændelser (til lyd): { hits, breaks, rings, landed, wall }
  function stepVolley(state) {
    var v = state.volley, ev = { hits: 0, breaks: 0, rings: 0, landed: 0, wall: 0 };
    if (!v || v.done) return ev;
    var R = RULES.ballR;
    if (v.launched < v.balls.length && v.step % RULES.launchGap === 0) { v.balls[v.launched].st = 1; v.launched++; }
    var onHit = function (b) {
      if (b.n0 === undefined) b.n0 = b.n;   // det oprindelige tal (til bonussen)
      b.n -= 1; ev.hits++; v.hits++; state.hits++;
      v.points += RULES.hitPoints; state.score += RULES.hitPoints;
      if (b.n <= 0) {
        var i = state.bricks.indexOf(b);
        if (i >= 0) state.bricks.splice(i, 1);
        ev.breaks++; v.broken++; state.broken++;
        var bonus = breakPoints(b);
        v.points += bonus; state.score += bonus;
      }
    };
    for (var i = 0; i < v.balls.length; i++) {
      var ball = v.balls[i];
      if (ball.st !== 1) continue;
      for (var k = 0; k < RULES.sub && ball.st === 1; k++) {
        var h = moveSub(ball, state.bricks, onHit);
        if (h === 'vaeg' || h === 'loft') ev.wall++;
        // Ringe: kuglen samler dem op og flyver videre
        for (var j = state.rings.length - 1; j >= 0; j--) {
          var p = ringPos(state.rings[j]), dx = ball.x - p.x, dy = ball.y - p.y, rr = p.r + R;
          if (dx * dx + dy * dy < rr * rr) { state.rings.splice(j, 1); v.gained++; ev.rings++; state.ringsTaken++; }
        }
        // Gulvet: kuglen lander
        if (ball.y >= H - R && ball.vy > 0) {
          ball.y = H - R; ball.st = 2; v.landed++; ev.landed++;
          if (v.firstX === null) v.firstX = clamp(ball.x, R, W - R);
        }
      }
    }
    v.step++;
    if (v.landed === v.balls.length) v.done = true;
    else if (v.step >= RULES.maxSteps) {
      // Sikkerhedsnet (bør aldrig ske): resten lander, hvor de er
      v.balls.forEach(function (b) { if (b.st !== 2) { b.st = 2; b.y = H - R; v.landed++; if (v.firstX === null) v.firstX = clamp(b.x, R, W - R); } });
      v.done = true;
    }
    return ev;
  }

  // Muren rykker ned, ny række ind, og game over tjekkes.
  function endTurn(state) {
    var v = state.volley;
    state.originX = v.firstX === null ? state.originX : v.firstX;
    var gained = v.gained;
    state.bricks.forEach(function (b) { b.r += 1; });
    state.rings.forEach(function (o) { o.r += 1; });
    // Ringe, der glider ud under bundlinjen, samles automatisk op
    var auto = 0;
    for (var j = state.rings.length - 1; j >= 0; j--) if (state.rings[j].r >= ROWS) { state.rings.splice(j, 1); auto++; }
    gained += auto; state.ringsTaken += auto;
    state.balls += gained;
    state.lastVolley = { hits: v.hits, broken: v.broken, points: v.points, gained: gained, autoRings: auto, firstX: v.firstX };
    state.volley = null;
    var reached = state.bricks.some(function (b) { return b.r >= ROWS - 1; });
    if (reached) { state.over = true; return state.lastVolley; }
    state.turn += 1;
    spawnRow(state);
    return state.lastVolley;
  }

  function createRun(opts) {
    opts = opts || {};
    var seed = opts.seed !== undefined ? opts.seed : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    var state = newState(seed);
    var run = {
      get state() { return state; },
      live: function () { return !state.over && !state.ended; },
      volleyActive: function () { return !!state.volley; },
      setAim: function (a) { state.aim = clampAngle(a); return state.aim; },
      turnAim: function (d) { return run.setAim(state.aim + d); },
      // Sigt mod et punkt på brættet (klik eller tryk)
      aimAt: function (p) {
        var dx = p.x - state.originX, dy = (H - RULES.ballR) - p.y;
        if (dy < 1) dy = 1;
        return run.setAim(Math.round(Math.atan2(dx, dy) * 180 / Math.PI));
      },
      preview: function (bounces) { return preview(state, state.aim, bounces); },
      fire: function () {
        if (!run.live() || state.volley) return false;
        startVolley(state);
        return true;
      },
      // Kør n tidsskridt. Returnerer summerede hændelser; done = salven er færdig (og turen afsluttet).
      step: function (n) {
        var sum = { hits: 0, breaks: 0, rings: 0, landed: 0, wall: 0, done: false, turnEnded: null };
        if (!state.volley) return sum;
        for (var i = 0; i < (n || 1) && state.volley && !state.volley.done; i++) {
          var e = stepVolley(state);
          sum.hits += e.hits; sum.breaks += e.breaks; sum.rings += e.rings; sum.landed += e.landed; sum.wall += e.wall;
        }
        if (state.volley && state.volley.done) { sum.turnEnded = endTurn(state); sum.done = true; }
        return sum;
      },
      // Spring frem: hele resten af salven med det samme
      finish: function () { return run.step(RULES.maxSteps + 10); },
      end: function () { state.ended = true; return { score: state.score, turns: state.turn, broken: state.broken }; }
    };
    return run;
  }

  var api = {
    W: W, H: H, COLS: COLS, ROWS: ROWS, CELL: CELL, RULES: RULES,
    SETTINGS: SETTINGS, FART: FART, fartAf: fartAf, breakPoints: breakPoints,
    brickRect: brickRect, ringPos: ringPos, dirOf: dirOf, clampAngle: clampAngle,
    newState: newState, spawnRow: spawnRow, preview: preview, createRun: createRun,
    startVolley: startVolley, stepVolley: stepVolley, endTurn: endTurn
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MurenLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
