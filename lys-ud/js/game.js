/*
 * Lys ud – spillogik (ingen DOM). Klassisk Lights Out: vælger man et felt,
 * skifter feltet og dets fire naboer (op, ned, venstre, højre) mellem tændt
 * og slukket. Målet er at slukke alle lamper.
 *
 * Matematikken (GF(2), dvs. regning med 0 og 1, hvor 1 + 1 = 0):
 *   Et tryk to gange på samme felt ophæver sig selv, og rækkefølgen er
 *   ligegyldig. En løsning er derfor blot en MÆNGDE af felter, x, så A·x = b,
 *   hvor b er pladen og A er "hvem skifter, når jeg trykker"-matricen.
 *   Ligningen løses med gausselimination over GF(2). Har A en kerne (4 × 4 og
 *   5 × 5 har det), er der flere løsninger. Så prøves alle kombinationer af
 *   kernen, og den med færrest tryk er den optimale ("færrest mulige træk").
 *     3 × 3: kernen er tom – hver plade har netop én løsning.
 *     4 × 4: kernen har 4 dimensioner (16 løsninger pr. løsbar plade).
 *     5 × 5: kernen har 2 dimensioner (4 løsninger pr. løsbar plade).
 *
 * Plader: laves ved tilfældige tryk fra en slukket plade, så de altid kan
 * løses. En plade bruges kun, hvis færrest mulige træk ligger i banens
 * interval (stiger med banen), så der aldrig kommer trivielle plader.
 *
 * Point for en klaret bane (se RULES):
 *   grund  = 20 × færrest mulige træk
 *   bonus  = 100 ved færrest mulige træk, 20 mindre for hvert ekstra træk (mindst 0)
 *   tip    = −25 pr. tip på banen
 *   i alt  = grund + bonus − tip, dog mindst 10 point for en klaret bane.
 * Træk = tryk, der står på pladen lige nu: Fortryd tager det sidste tryk
 * tilbage (også i tælleren), og Start forfra stiller tælleren på 0.
 * Fortryd er ubegrænset inden for banen. Tip, der er brugt, koster stadig.
 */
(function (global) {
  'use strict';

  var SIZES = {
    '3x3': { id: '3x3', n: 3, label: '3 × 3', name: 'Lille' },
    '4x4': { id: '4x4', n: 4, label: '4 × 4', name: 'Mellem' },
    '5x5': { id: '5x5', n: 5, label: '5 × 5', name: 'Stor' }
  };
  var DEFAULT_SIZE = '5x5';

  var RULES = {
    basePoint: 20,       // pr. færrest mulige træk
    perfectBonus: 100,   // ved færrest mulige træk
    extraPenalty: 20,    // bonus falder pr. træk ud over færrest mulige
    hintCost: 25,        // pr. tip
    minLevelPoints: 10,  // en klaret bane giver altid mindst dette
    // Færrest mulige træk pr. bane: [start, loft]. Stiger med 1 for hver 2. bane.
    difficulty: { 3: [3, 7], 4: [3, 7], 5: [4, 13] },
    levelsPerStep: 2,
    genTries: 1500
  };

  // ---------- Grundlæggende ----------
  function emptyBoard(n) { var b = new Array(n * n); for (var i = 0; i < b.length; i++) b[i] = 0; return b; }
  // Felterne, der skifter ved et tryk på i (feltet selv først, så naboerne)
  function affected(n, i) {
    var x = i % n, y = Math.floor(i / n), out = [i];
    if (y > 0) out.push(i - n);
    if (x > 0) out.push(i - 1);
    if (x < n - 1) out.push(i + 1);
    if (y < n - 1) out.push(i + n);
    return out;
  }
  // Tryk: returnerer en ny plade (ændrer ikke `board`)
  function press(board, n, i) {
    var b = board.slice();
    affected(n, i).forEach(function (k) { b[k] ^= 1; });
    return b;
  }
  function applyPresses(board, n, list) {
    var b = board.slice();
    list.forEach(function (i) { affected(n, i).forEach(function (k) { b[k] ^= 1; }); });
    return b;
  }
  function isDark(board) { for (var i = 0; i < board.length; i++) if (board[i]) return false; return true; }
  function litCount(board) { var c = 0; for (var i = 0; i < board.length; i++) if (board[i]) c++; return c; }

  // ---------- GF(2) ----------
  // Gausselimination én gang pr. størrelse: rref-matricen og hvordan b skal behandles,
  // så hver løsning kun koster et par XOR'er. Rækker gemmes som arrays af 0/1.
  var cache = {};
  function system(n) {
    if (cache[n]) return cache[n];
    var N = n * n, A = [], E = [], r, c;
    for (r = 0; r < N; r++) {
      A.push(new Array(N).fill(0)); E.push(new Array(N).fill(0)); E[r][r] = 1;
      affected(n, r).forEach(function (k) { A[r][k] = 1; }); // A er symmetrisk
    }
    var pivots = [], row = 0;
    for (c = 0; c < N && row < N; c++) {
      var p = -1;
      for (r = row; r < N; r++) if (A[r][c]) { p = r; break; }
      if (p < 0) continue;
      var t = A[p]; A[p] = A[row]; A[row] = t; t = E[p]; E[p] = E[row]; E[row] = t;
      for (r = 0; r < N; r++) if (r !== row && A[r][c]) {
        for (var k = 0; k < N; k++) { A[r][k] ^= A[row][k]; E[r][k] ^= E[row][k]; }
      }
      pivots.push(c); row++;
    }
    var rank = row, isPivot = {};
    pivots.forEach(function (pc) { isPivot[pc] = true; });
    // Kernen: én vektor pr. fri søjle
    var nullspace = [];
    for (c = 0; c < N; c++) {
      if (isPivot[c]) continue;
      var v = new Array(N).fill(0); v[c] = 1;
      for (r = 0; r < rank; r++) if (A[r][c]) v[pivots[r]] = 1;
      nullspace.push(v);
    }
    cache[n] = { N: N, A: A, E: E, rank: rank, pivots: pivots, nullspace: nullspace };
    return cache[n];
  }
  function dot(row, b) { var s = 0; for (var i = 0; i < b.length; i++) if (row[i] && b[i]) s ^= 1; return s; }
  // Kan pladen slukkes helt?
  function solvable(board, n) {
    var S = system(n);
    for (var r = S.rank; r < S.N; r++) if (dot(S.E[r], board)) return false;
    return true;
  }
  // Én løsning (ikke nødvendigvis den korteste) som 0/1-vektor, eller null
  function particular(board, n) {
    if (!solvable(board, n)) return null;
    var S = system(n), x = new Array(S.N).fill(0);
    for (var r = 0; r < S.rank; r++) x[S.pivots[r]] = dot(S.E[r], board);
    return x;
  }
  function weight(v) { var c = 0; for (var i = 0; i < v.length; i++) if (v[i]) c++; return c; }
  // Den optimale løsning: liste af felter med færrest mulige tryk, eller null.
  // Ved lige mange tryk vælges den løsning, der kommer først (fast rækkefølge).
  function solve(board, n) {
    var x = particular(board, n);
    if (!x) return null;
    var S = system(n), K = S.nullspace.length, best = x, bw = weight(x);
    for (var m = 1; m < (1 << K); m++) {
      var y = x.slice();
      for (var k = 0; k < K; k++) if (m & (1 << k)) {
        var v = S.nullspace[k];
        for (var i = 0; i < y.length; i++) y[i] ^= v[i];
      }
      var w = weight(y);
      if (w < bw) { bw = w; best = y; }
    }
    var out = [];
    for (var j = 0; j < best.length; j++) if (best[j]) out.push(j);
    return out;
  }
  function minMoves(board, n) { var s = solve(board, n); return s ? s.length : -1; }

  // ---------- Baner ----------
  function targetFor(n, level) {
    var d = RULES.difficulty[n] || [3, 9];
    var step = Math.floor((Math.max(1, level) - 1) / RULES.levelsPerStep);
    return Math.min(d[1], d[0] + step);
  }
  // Lav en plade, hvor færrest mulige træk er præcis `target` (eller så tæt som muligt,
  // men altid mindst banens start). `avoid` er en plade, der ikke må komme igen.
  function generate(n, level, rng, avoid) {
    rng = rng || Math.random;
    var N = n * n, target = targetFor(n, level), floor = (RULES.difficulty[n] || [3])[0];
    var best = null, bestDiff = Infinity, avoidKey = avoid ? avoid.join('') : null;
    for (var t = 0; t < RULES.genTries; t++) {
      // Tilfældige forskellige tryk fra en slukket plade. Antallet ligger lidt over målet,
      // fordi nogle tryk kan "lægges sammen" til færre (kernen på 4 × 4 og 5 × 5).
      var k = Math.min(N, target + Math.floor(rng() * 3)), cells = [], used = {};
      while (cells.length < k) { var i = Math.floor(rng() * N); if (!used[i]) { used[i] = 1; cells.push(i); } }
      var b = applyPresses(emptyBoard(n), n, cells);
      if (isDark(b) || (avoidKey && b.join('') === avoidKey)) continue;
      var m = minMoves(b, n);
      if (m < floor) continue;
      var diff = Math.abs(m - target);
      if (diff < bestDiff) { best = { board: b, min: m }; bestDiff = diff; }
      if (diff === 0) break;
    }
    return { board: best.board, minMoves: best.min, target: target };
  }

  function levelPoints(min, moves, hints) {
    var base = RULES.basePoint * min;
    var bonus = Math.max(0, RULES.perfectBonus - RULES.extraPenalty * Math.max(0, moves - min));
    var cost = RULES.hintCost * hints;
    var total = Math.max(RULES.minLevelPoints, base + bonus - cost);
    return { base: base, bonus: bonus, hintCost: cost, total: total };
  }

  // ---------- En session (baner uden ende, til man vælger Afslut) ----------
  function createRun(sizeId, opts) {
    opts = opts || {};
    var size = SIZES[sizeId] || SIZES[DEFAULT_SIZE];
    var n = size.n, rng = opts.rng || Math.random;
    var s = {
      sizeId: size.id, n: n, level: 0, board: null, start: null, minMoves: 0,
      moves: 0, hintsUsed: 0, hintCell: -1, score: 0, levelsSolved: 0, perfectLevels: 0,
      hintsTotal: 0, solved: false, lastPoints: null, ended: false
    };
    var history = []; // felterne, der er trykket på i denne bane (fortryd tager det sidste)

    function startLevel(board) {
      s.level++;
      var g;
      if (board) g = { board: board.slice(), minMoves: minMoves(board, n) };
      else g = generate(n, s.level, rng, s.start);
      s.start = g.board.slice(); s.board = g.board.slice(); s.minMoves = g.minMoves;
      s.moves = 0; s.hintsUsed = 0; s.hintCell = -1; s.solved = false; s.lastPoints = null;
      history = [];
    }
    function live() { return !s.solved && !s.ended; }

    function tap(i) {
      if (!live() || i < 0 || i >= n * n) return { ok: false };
      s.board = press(s.board, n, i);
      history.push(i);
      s.moves = history.length;
      // Tippet gælder kun, til man trykker. Trykker man på tip-feltet, er det brugt;
      // trykker man et andet sted, skal der et nyt tip til (løsningen kan ændre sig).
      s.hintCell = -1;
      var res = { ok: true, cell: i, changed: affected(n, i), solved: false };
      if (isDark(s.board)) {
        s.solved = true;
        var pts = levelPoints(s.minMoves, s.moves, s.hintsUsed);
        s.lastPoints = pts;
        s.score += pts.total;
        s.levelsSolved++;
        if (s.moves <= s.minMoves && !s.hintsUsed) s.perfectLevels++;
        res.solved = true; res.points = pts;
      }
      return res;
    }
    function canUndo() { return live() && history.length > 0; }
    function undo() {
      if (!canUndo()) return false;
      var i = history.pop();
      s.board = press(s.board, n, i);
      s.moves = history.length;
      s.hintCell = -1;
      return i;
    }
    function canRestart() { return live() && history.length > 0; }
    function restart() {
      if (!canRestart()) return false;
      s.board = s.start.slice(); history = []; s.moves = 0; s.hintCell = -1;
      return true;
    }
    // Tip: ét felt fra en optimal løsning af pladen, som den ser ud nu. Koster point.
    // Står der allerede et tip, vises det samme igen uden at koste mere.
    function hint() {
      if (!live()) return -1;
      if (s.hintCell >= 0) return s.hintCell;
      var sol = solve(s.board, n);
      if (!sol || !sol.length) return -1;
      // Vælg et felt fra løsningen, der ligger tæt på midten (roligt for blikket),
      // og ellers det første. Fast valg, så samme plade altid giver samme tip.
      var c = (n - 1) / 2, best = sol[0], bd = Infinity;
      sol.forEach(function (k) { var d = Math.abs(k % n - c) + Math.abs(Math.floor(k / n) - c); if (d < bd) { bd = d; best = k; } });
      s.hintCell = best; s.hintsUsed++; s.hintsTotal++;
      return best;
    }
    function nextLevel() {
      if (!s.solved || s.ended) return false;
      startLevel();
      return true;
    }
    function end() { s.ended = true; return { score: s.score, levelsSolved: s.levelsSolved, level: s.level }; }
    function preview(i) { return (i >= 0 && i < n * n) ? affected(n, i) : []; }
    function remainingMin() { return minMoves(s.board, n); }

    startLevel(opts.board || null);

    return {
      state: s, n: n, tap: tap, undo: undo, canUndo: canUndo, restart: restart, canRestart: canRestart,
      hint: hint, nextLevel: nextLevel, end: end, preview: preview, remainingMin: remainingMin,
      history: function () { return history.slice(); },
      _setBoard: function (b) { s.start = b.slice(); s.board = b.slice(); s.minMoves = minMoves(b, n); history = []; s.moves = 0; s.hintCell = -1; s.hintsUsed = 0; s.solved = false; }
    };
  }

  global.LysUdGame = {
    SIZES: SIZES, DEFAULT_SIZE: DEFAULT_SIZE, RULES: RULES,
    emptyBoard: emptyBoard, affected: affected, press: press, applyPresses: applyPresses,
    isDark: isDark, litCount: litCount, system: system, solvable: solvable, particular: particular,
    solve: solve, minMoves: minMoves, targetFor: targetFor, generate: generate, levelPoints: levelPoints,
    createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
