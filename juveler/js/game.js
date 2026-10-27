/*
 * Juveler – spillogik. Ingen DOM, ingen farver, ingen grafik: kun tal.
 * Kan køres i browseren (window.JuvelerGame) og i Node (globalThis.JuvelerGame).
 *
 * Brættet er et array med n × n felter (indeks = række * n + kolonne).
 * Hvert felt er en juveltype 0 … k−1 (eller −1 = tomt midt i en opløsning).
 * Typerne har navne (TYPES), som temaet bruger til at finde grafikken.
 *
 * Regler (se README):
 *  - Byt to nabojuveler (vandret eller lodret). Byttet er kun gyldigt, hvis der
 *    opstår mindst tre ens på række eller i kolonne. Et ugyldigt byt koster intet.
 *  - Ens juveler på stribe forsvinder, juvelerne ovenover falder ned, og nye
 *    fylder op fra toppen. Giver det nye striber, fortsætter det (kæde).
 *  - Hvert byt koster ét træk. Store kombinationer giver træk tilbage:
 *    en gruppe på 4 giver +1 træk, en gruppe på 5 eller flere (også L og T) +2,
 *    og hvert led i en kæde fra det tredje +1 (en kæde på tre led giver +1, fire led +2 …).
 *  - Er der ingen mulige byt tilbage, blandes brættet gratis.
 *  - Spillet slutter, når der ikke er flere træk.
 */
(function (global) {
  'use strict';

  // Navnene på juveltyperne. Temaet leverer grafik med de samme navne.
  var TYPES = ['rubin', 'safir', 'smaragd', 'topas', 'ametyst', 'opal'];
  var SIZES = {
    '6x6': { id: '6x6', n: 6, types: 6, label: '6 × 6' },
    '7x7': { id: '7x7', n: 7, types: 6, label: '7 × 7' },
    '8x8': { id: '8x8', n: 8, types: 6, label: '8 × 8' }
  };
  var SIZE_ORDER = ['6x6', '7x7', '8x8'];
  var RULES = {
    startMoves: 25,        // træk ved start
    moveCost: 1,           // hvert gyldigt byt
    earn4: 1,              // gruppe på 4
    earn5: 2,              // gruppe på 5+ (også L og T)
    earnChain: 1,          // hvert led i en kæde fra det tredje (kæde på 3+)
    pointsPerJewel: 10,    // ganges med kædens led (1, 2, 3 …)
    chainFrom: 3,
    bonus4: 20,
    bonus5: 50
  };

  // ---------- Tilfældighed (kan sås, så testene kan gentages) ----------
  function rng(seed) {
    var a = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(r, k) { return Math.floor(r() * k); }

  // ---------- Hjælpere ----------
  function adjacent(a, b, n) {
    if (a < 0 || b < 0 || a >= n * n || b >= n * n) return false;
    var ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }
  function neighbours(i, n) {
    var x = i % n, y = Math.floor(i / n), r = [];
    if (y > 0) r.push(i - n);
    if (x < n - 1) r.push(i + 1);
    if (y < n - 1) r.push(i + n);
    if (x > 0) r.push(i - 1);
    return r;
  }
  function fromRows(rows) {
    // Til test: ['01201', …] → array
    var g = [];
    rows.forEach(function (row) { for (var i = 0; i < row.length; i++) g.push(row[i] === '.' ? -1 : +row[i]); });
    return g;
  }

  // ---------- Striber ----------
  // Alle striber på mindst 3 ens: [{ cells: [...], dir: 'r' | 'c' }]
  function findRuns(g, n) {
    var runs = [];
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        var t = g[y * n + x], e = x + 1;
        while (e < n && t >= 0 && g[y * n + e] === t) e++;
        if (t >= 0 && e - x >= 3) { var c = []; for (var k = x; k < e; k++) c.push(y * n + k); runs.push({ cells: c, dir: 'r' }); }
        x = e;
      }
    }
    for (var xx = 0; xx < n; xx++) {
      var yy = 0;
      while (yy < n) {
        var tt = g[yy * n + xx], ee = yy + 1;
        while (ee < n && tt >= 0 && g[ee * n + xx] === tt) ee++;
        if (tt >= 0 && ee - yy >= 3) { var cc = []; for (var kk = yy; kk < ee; kk++) cc.push(kk * n + xx); runs.push({ cells: cc, dir: 'c' }); }
        yy = ee;
      }
    }
    return runs;
  }
  // Striber, der deler et felt (L og T), lægges sammen til én gruppe.
  // [{ cells: [...] (sorteret), type, size, longest, cross }]
  function findGroups(g, n) {
    var runs = findRuns(g, n), owner = {}, groups = [];
    runs.forEach(function (run) {
      var hit = null;
      run.cells.forEach(function (c) { if (owner[c] !== undefined && hit === null) hit = owner[c]; });
      if (hit === null) { hit = groups.length; groups.push({ cells: [], runs: [] }); }
      groups[hit].runs.push(run);
      run.cells.forEach(function (c) { if (groups[hit].cells.indexOf(c) < 0) groups[hit].cells.push(c); owner[c] = hit; });
    });
    return groups.map(function (gr) {
      var longest = 0;
      gr.runs.forEach(function (r) { longest = Math.max(longest, r.cells.length); });
      gr.cells.sort(function (a, b) { return a - b; });
      return { cells: gr.cells, type: g[gr.cells[0]], size: gr.cells.length, longest: longest, cross: gr.runs.length > 1 };
    });
  }
  function hasRun(g, n) { return findRuns(g, n).length > 0; }

  // Giver byttet af a og b en stribe?
  function swapped(g, a, b) { var h = g.slice(); var t = h[a]; h[a] = h[b]; h[b] = t; return h; }
  function wouldMatch(g, n, a, b) {
    if (!adjacent(a, b, n) || g[a] === g[b] || g[a] < 0 || g[b] < 0) return false;
    return hasRun(swapped(g, a, b), n);
  }
  // Alle mulige byt [[a, b], …] (a < b)
  function allMoves(g, n) {
    var res = [];
    for (var i = 0; i < n * n; i++) {
      if (i % n < n - 1 && wouldMatch(g, n, i, i + 1)) res.push([i, i + 1]);
      if (i + n < n * n && wouldMatch(g, n, i, i + n)) res.push([i, i + n]);
    }
    return res;
  }
  function hasMove(g, n) {
    for (var i = 0; i < n * n; i++) {
      if (i % n < n - 1 && wouldMatch(g, n, i, i + 1)) return true;
      if (i + n < n * n && wouldMatch(g, n, i, i + n)) return true;
    }
    return false;
  }
  // Naboerne til a, som giver et gyldigt byt
  function validTargets(g, n, a) {
    return neighbours(a, n).filter(function (b) { return wouldMatch(g, n, a, b); });
  }

  // ---------- Fald og opfyldning ----------
  // Fjerner felterne i `cells`, lader juvelerne falde og fylder op.
  // Returnerer { grid, falls: [{ from, to }], spawns: [{ to, drop }] }
  // drop = hvor mange felter den nye juvel falder (til tegnelagets animation).
  function collapse(g, n, cells, k, r) {
    var h = g.slice(), falls = [], spawns = [];
    cells.forEach(function (c) { h[c] = -1; });
    for (var x = 0; x < n; x++) {
      var write = n - 1;
      for (var y = n - 1; y >= 0; y--) {
        var i = y * n + x;
        if (h[i] >= 0) {
          if (y !== write) { h[write * n + x] = h[i]; h[i] = -1; falls.push({ from: i, to: write * n + x }); }
          write--;
        }
      }
      var empty = write + 1;
      for (var yy = write; yy >= 0; yy--) {
        h[yy * n + x] = randInt(r, k);
        spawns.push({ to: yy * n + x, drop: empty });
      }
    }
    return { grid: h, falls: falls, spawns: spawns };
  }

  // Løser alle striber og kæder. Returnerer led for led (til animationen) og summen.
  function resolve(g, n, k, r) {
    var steps = [], cur = g.slice(), earned = 0, points = 0, guard = 0;
    while (guard++ < 200) {
      var groups = findGroups(cur, n);
      if (!groups.length) break;
      var level = steps.length + 1, removed = [], stepPts = 0, stepEarn = 0;
      groups.forEach(function (gr) {
        gr.cells.forEach(function (c) { if (removed.indexOf(c) < 0) removed.push(c); });
        stepPts += gr.size * RULES.pointsPerJewel * level;
        if (gr.size >= 5 || gr.longest >= 5) { stepPts += RULES.bonus5 * level; stepEarn += RULES.earn5; gr.kind = 'fem'; }
        else if (gr.size === 4) { stepPts += RULES.bonus4 * level; stepEarn += RULES.earn4; gr.kind = 'fire'; }
        else gr.kind = 'tre';
      });
      if (level >= RULES.chainFrom) stepEarn += RULES.earnChain;
      var col = collapse(cur, n, removed, k, r);
      steps.push({ level: level, groups: groups, removed: removed.sort(function (a, b) { return a - b; }), before: cur, falls: col.falls, spawns: col.spawns, grid: col.grid, points: stepPts, earned: stepEarn });
      points += stepPts; earned += stepEarn;
      cur = col.grid;
    }
    return { grid: cur, steps: steps, points: points, earned: earned };
  }

  // ---------- Nyt bræt: ingen striber fra start, mindst ét muligt byt ----------
  function freshBoard(n, k, r) {
    for (var tries = 0; tries < 500; tries++) {
      var g = [];
      for (var i = 0; i < n * n; i++) {
        var x = i % n, y = Math.floor(i / n), t, guard = 0;
        do {
          t = randInt(r, k);
          guard++;
        } while (guard < 50 && ((x >= 2 && g[i - 1] === t && g[i - 2] === t) || (y >= 2 && g[i - n] === t && g[i - 2 * n] === t)));
        g.push(t);
      }
      if (!hasRun(g, n) && hasMove(g, n)) return g;
    }
    throw new Error('Kunne ikke lave et bræt');
  }
  // Bland de juveler, der er (samme antal af hver type), til der ingen striber er og mindst ét byt.
  function shuffle(g, n, k, r) {
    for (var tries = 0; tries < 300; tries++) {
      var h = g.slice();
      for (var i = h.length - 1; i > 0; i--) { var j = randInt(r, i + 1), t = h[i]; h[i] = h[j]; h[j] = t; }
      if (!hasRun(h, n) && hasMove(h, n)) return h;
    }
    return freshBoard(n, k, r);
  }

  // ---------- Et spil ----------
  function createRun(sizeId, opts) {
    opts = opts || {};
    var size = SIZES[sizeId] || SIZES['7x7'];
    var r = rng(opts.seed);
    var n = size.n, k = size.types;
    var state = {
      size: size.id, n: n, k: k,
      grid: freshBoard(n, k, r),
      moves: RULES.startMoves, score: 0, swaps: 0,
      bestChain: 0, earnedTotal: 0, shuffles: 0,
      over: false, ended: false
    };
    function swap(a, b) {
      if (state.over || state.ended) return { ok: false, reason: 'slut' };
      if (!adjacent(a, b, n)) return { ok: false, reason: 'ikke-nabo' };
      if (state.grid[a] === state.grid[b]) return { ok: false, reason: 'ens' };
      if (!wouldMatch(state.grid, n, a, b)) return { ok: false, reason: 'ingen' };
      var before = state.grid.slice();
      var res = resolve(swapped(state.grid, a, b), n, k, r);
      state.grid = res.grid;
      state.swaps++;
      state.score += res.points;
      state.moves += res.earned - RULES.moveCost;
      state.earnedTotal += res.earned;
      state.bestChain = Math.max(state.bestChain, res.steps.length);
      var shuffled = false;
      if (!hasMove(state.grid, n)) { state.grid = shuffle(state.grid, n, k, r); state.shuffles++; shuffled = true; }
      if (state.moves <= 0) { state.moves = 0; state.over = true; }
      return { ok: true, a: a, b: b, before: before, steps: res.steps, points: res.points, earned: res.earned, chain: res.steps.length, shuffled: shuffled, grid: state.grid.slice(), over: state.over };
    }
    return {
      state: state, n: n, k: k,
      swap: swap,
      targets: function (a) { return state.over ? [] : validTargets(state.grid, n, a); },
      canSwap: function (a, b) { return wouldMatch(state.grid, n, a, b); },
      hint: function () { var m = allMoves(state.grid, n); return m.length ? m[randInt(r, m.length)] : null; },
      end: function () { state.ended = true; return { score: state.score, swaps: state.swaps }; },
      // Kun til test: læg et bestemt bræt ind
      _load: function (g, moves) { state.grid = g.slice(); if (moves !== undefined) state.moves = moves; state.over = false; }
    };
  }

  global.JuvelerGame = {
    TYPES: TYPES, SIZES: SIZES, SIZE_ORDER: SIZE_ORDER, RULES: RULES,
    rng: rng, adjacent: adjacent, neighbours: neighbours, fromRows: fromRows,
    findRuns: findRuns, findGroups: findGroups, hasRun: hasRun, wouldMatch: wouldMatch,
    allMoves: allMoves, hasMove: hasMove, validTargets: validTargets,
    collapse: collapse, resolve: resolve, freshBoard: freshBoard, shuffle: shuffle,
    createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
