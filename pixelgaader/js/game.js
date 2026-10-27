/*
 * Pixelgåder – spillogik (ingen DOM). Nonogram/picross.
 *
 * Gitteret har talhints for hver række og kolonne: tallene er længderne af
 * de sammenhængende farvede felter i rækkefølge. Man farver felterne og
 * afslører et pixelbillede.
 *
 * Felternes tilstand (mark):  0 = tomt (ukendt), 1 = farvet, 2 = krydset.
 * lock: '' = spillerens eget, 'fejl' = afsløret efter en fejl, 'tip' = afsløret
 * af et tip, 'auto' = krydset automatisk, fordi rækken/kolonnen er løst.
 *
 * Regler (klassisk picross med liv):
 *  - Udfyld: hører feltet til billedet, farves det. Hvis ikke, er det en fejl:
 *    man mister et liv, og feltet afsløres (krydses) og låses.
 *  - Kryds: en note fra spilleren ("her er tomt"). Den tjekkes ikke.
 *    Et krydset felt kan ikke udfyldes ved et uheld – visk krydset ud først.
 *  - Visk: fjerner spillerens eget kryds. Farvede felter er altid rigtige
 *    (forkerte bliver aldrig stående), så de kan ikke viskes.
 *  - Tip: afslører ét felt i billedet. Koster point.
 *  - Er en række eller kolonne løst, krydses dens tomme felter automatisk.
 *  - 3 liv pr. gåde, fyldes op ved hver ny gåde. Mister man alle liv i en
 *    gåde, er spillet slut.
 *
 * Point pr. løst gåde (se RULES.points): grundpoint efter størrelsen, minus
 * fejl og tip, plus bonus for en fejlfri gåde uden tip. Mindst 1 point.
 *
 * Alle gåder har præcis én løsning, og den kan findes uden at gætte
 * (løseren nøjes med at kigge på én række eller kolonne ad gangen).
 */
(function (global) {
  'use strict';

  var MOTIVER = global.PixelgaaderMotiver || {};

  var SIZES = {
    '5x5': { id: '5x5', n: 5, label: '5 × 5' },
    '8x8': { id: '8x8', n: 8, label: '8 × 8' },
    '10x10': { id: '10x10', n: 10, label: '10 × 10' },
    '15x15': { id: '15x15', n: 15, label: '15 × 15' }
  };
  var SIZE_ORDER = ['5x5', '8x8', '10x10', '15x15'];
  // Serier: 'stigende' går fra 5 × 5 og op til den største størrelse, skærmen kan bære.
  var MODES = ['stigende', '5x5', '8x8', '10x10', '15x15'];
  var DEFAULT_MODE = 'stigende';
  // Stigende: så mange gåder pr. størrelse, før gitteret bliver større
  var STEPS = [{ size: '5x5', count: 3 }, { size: '8x8', count: 4 }, { size: '10x10', count: 5 }, { size: '15x15', count: Infinity }];

  var RULES = {
    lives: 3,
    points: {
      5: { base: 10, error: 2, hint: 2, perfect: 5 },
      8: { base: 30, error: 5, hint: 5, perfect: 15 },
      10: { base: 50, error: 8, hint: 8, perfect: 25 },
      15: { base: 120, error: 20, hint: 20, perfect: 60 }
    },
    minPuzzlePoints: 1,
    // Genererede gåder: hvor mange tal et hint højst må have (så hint-felterne
    // har en fast størrelse og kan læses), og hvor tæt billedet må være
    maxClue: { 5: 3, 8: 3, 10: 4, 15: 5 },
    density: { 5: [0.5, 0.75], 8: [0.5, 0.7], 10: [0.5, 0.68], 15: [0.5, 0.66] },
    genTries: 4000
  };

  // ---------- Tilfældige tal (med frø, så test kan gentages) ----------
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- Billeder og hints ----------
  function fromRows(rows) {
    var n = rows.length, sol = [];
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) sol.push(rows[y].charAt(x) === 'X' ? 1 : 0);
    return sol;
  }
  function toRows(sol, n) {
    var out = [];
    for (var y = 0; y < n; y++) { var r = ''; for (var x = 0; x < n; x++) r += sol[y * n + x] ? 'X' : '.'; out.push(r); }
    return out;
  }
  function lineClue(line) {
    var c = [], run = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] === 1) run++;
      else if (run) { c.push(run); run = 0; }
    }
    if (run) c.push(run);
    return c; // tom liste = ingen farvede felter (vises som 0)
  }
  function rowOf(arr, n, y) { return arr.slice(y * n, y * n + n); }
  function colOf(arr, n, x) { var c = []; for (var y = 0; y < n; y++) c.push(arr[y * n + x]); return c; }
  function clues(sol, n) {
    var rows = [], cols = [];
    for (var i = 0; i < n; i++) { rows.push(lineClue(rowOf(sol, n, i))); cols.push(lineClue(colOf(sol, n, i))); }
    return { rows: rows, cols: cols };
  }
  function maxClueLen(cl) {
    var m = 1;
    cl.rows.concat(cl.cols).forEach(function (c) { if (c.length > m) m = c.length; });
    return m;
  }

  // ---------- Løser ----------
  // Én linje: line[i] er -1 (ukendt), 0 (tom) eller 1 (farvet). Returnerer en ny
  // linje, hvor alt, der følger af hintet, er udfyldt – eller null ved modstrid.
  function solveLine(line, clue) {
    var n = line.length, m = clue.length;
    // f[i][k]: kan felterne i..n-1 forklares med blok k..m-1?
    var f = [];
    for (var i = 0; i <= n + 1; i++) { f.push(new Array(m + 1)); }
    function can(i, k) {
      if (i > n) i = n;
      var v = f[i][k];
      if (v !== undefined) return v;
      var ok = false;
      if (k === m) {
        ok = true;
        for (var j = i; j < n; j++) if (line[j] === 1) { ok = false; break; }
      } else {
        if (i < n && line[i] !== 1 && can(i + 1, k)) ok = true;
        if (!ok && placeOk(i, k) && can(i + clue[k] + 1, k + 1)) ok = true;
      }
      f[i][k] = ok;
      return ok;
    }
    function placeOk(i, k) {
      var L = clue[k];
      if (i + L > n) return false;
      for (var j = i; j < i + L; j++) if (line[j] === 0) return false;
      if (i + L < n && line[i + L] === 1) return false;
      return true;
    }
    if (!can(0, 0)) return null;
    var can0 = new Array(n), can1 = new Array(n), seen = {};
    // Gå alle gyldige veje igennem (fremad) og notér, hvad hvert felt kan være
    function walk(i, k) {
      if (i > n) i = n;
      var key = i * (m + 1) + k;
      if (seen[key]) return;
      seen[key] = 1;
      if (k === m) { for (var j = i; j < n; j++) can0[j] = true; return; }
      if (i < n && line[i] !== 1 && can(i + 1, k)) { can0[i] = true; walk(i + 1, k); }
      if (placeOk(i, k) && can(i + clue[k] + 1, k + 1)) {
        var L = clue[k];
        for (var q = i; q < i + L; q++) can1[q] = true;
        if (i + L < n) can0[i + L] = true;
        walk(i + L + 1, k + 1);
      }
    }
    walk(0, 0);
    var out = line.slice();
    for (var p = 0; p < n; p++) {
      if (can0[p] && !can1[p]) out[p] = 0;
      else if (can1[p] && !can0[p]) out[p] = 1;
      else if (!can0[p] && !can1[p]) return null;
    }
    return out;
  }
  // Hele gitteret med linjeløsning, til intet mere kan udledes.
  // Returnerer { grid, solved, contradiction }.
  function propagate(cl, n, start) {
    var g = start ? start.slice() : fill(n * n, -1);
    var dirtyR = fill(n, true), dirtyC = fill(n, true), changed = true;
    while (changed) {
      changed = false;
      for (var y = 0; y < n; y++) {
        if (!dirtyR[y]) continue;
        dirtyR[y] = false;
        var r = solveLine(rowOf(g, n, y), cl.rows[y]);
        if (!r) return { grid: g, solved: false, contradiction: true };
        for (var x = 0; x < n; x++) if (r[x] !== g[y * n + x]) { g[y * n + x] = r[x]; dirtyC[x] = true; changed = true; }
      }
      for (var cx = 0; cx < n; cx++) {
        if (!dirtyC[cx]) continue;
        dirtyC[cx] = false;
        var c = solveLine(colOf(g, n, cx), cl.cols[cx]);
        if (!c) return { grid: g, solved: false, contradiction: true };
        for (var cy = 0; cy < n; cy++) if (c[cy] !== g[cy * n + cx]) { g[cy * n + cx] = c[cy]; dirtyR[cy] = true; changed = true; }
      }
    }
    return { grid: g, solved: g.indexOf(-1) < 0, contradiction: false };
  }
  function fill(len, v) { var a = new Array(len); for (var i = 0; i < len; i++) a[i] = v; return a; }
  // Kan gåden løses uden at gætte (kun linje for linje)?
  function lineSolvable(cl, n) { var r = propagate(cl, n); return r.solved && !r.contradiction; }
  // Antal løsninger (stopper ved `limit`, standard 2). Linjeløsning + forgrening.
  function countSolutions(cl, n, limit) {
    limit = limit || 2;
    var count = 0;
    (function search(g) {
      if (count >= limit) return;
      var r = propagate(cl, n, g);
      if (r.contradiction) return;
      if (r.solved) { count++; return; }
      var i = r.grid.indexOf(-1);
      var a = r.grid.slice(); a[i] = 1; search(a);
      var b = r.grid.slice(); b[i] = 0; search(b);
    })(null);
    return count;
  }

  // ---------- Generator ----------
  // Spejlsymmetriske pixelfigurer (som rumvæsner i en gammel arkadehal).
  // Kun figurer med præcis én løsning, der kan findes uden at gætte, bruges.
  function generate(n, rand, opts) {
    opts = opts || {};
    var dens = RULES.density[n] || [0.5, 0.7], maxC = opts.maxClue || RULES.maxClue[n] || Math.ceil(n / 2);
    var half = Math.ceil(n / 2);
    for (var t = 0; t < RULES.genTries; t++) {
      var p = dens[0] + rand() * (dens[1] - dens[0]);
      var sol = fill(n * n, 0);
      for (var y = 0; y < n; y++) for (var x = 0; x < half; x++) {
        var v = rand() < p ? 1 : 0;
        sol[y * n + x] = v; sol[y * n + (n - 1 - x)] = v;
      }
      // Ingen helt tomme eller helt fyldte rækker/kolonner (kedelige)
      var cl = clues(sol, n), bad = false;
      for (var i = 0; i < n && !bad; i++) {
        var rs = sum(rowOf(sol, n, i)), cs = sum(colOf(sol, n, i));
        if (rs === 0 || cs === 0) bad = true;
      }
      if (bad || maxClueLen(cl) > maxC) continue;
      var filled = sum(sol);
      if (filled < n * n * 0.4 || filled > n * n * 0.8) continue;
      if (!lineSolvable(cl, n)) continue;
      return { sol: sol, clues: cl, tries: t + 1 };
    }
    return null;
  }
  // Hvor mange tal et hint højst kan have for en størrelse (håndlavede og genererede).
  // Bruges til at give hint-felterne en fast størrelse, så gitteret ikke hopper.
  function clueSlots(n) {
    var m = RULES.maxClue[n] || Math.ceil(n / 2);
    (MOTIVER[n] || []).forEach(function (mo) { var l = maxClueLen(clues(fromRows(mo.rows), n)); if (l > m) m = l; });
    return m;
  }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  // ---------- Point ----------
  function puzzlePoints(n, errors, hints) {
    var P = RULES.points[n];
    var bonus = (errors === 0 && hints === 0) ? P.perfect : 0;
    var total = Math.max(RULES.minPuzzlePoints, P.base - errors * P.error - hints * P.hint + bonus);
    return { base: P.base, errorCost: errors * P.error, hintCost: hints * P.hint, bonus: bonus, total: total };
  }

  // ---------- Serie ----------
  // mode: 'stigende' eller en størrelse. maxSize: største størrelse, skærmen kan bære.
  function sizeForPuzzle(mode, index, maxSize) {
    if (mode !== 'stigende') return mode;
    var maxI = SIZE_ORDER.indexOf(maxSize || '15x15'), left = index;
    for (var s = 0; s < STEPS.length; s++) {
      var size = STEPS[s].size;
      if (SIZE_ORDER.indexOf(size) >= maxI) return SIZE_ORDER[maxI];
      if (left < STEPS[s].count) return size;
      left -= STEPS[s].count;
    }
    return SIZE_ORDER[maxI];
  }

  function makePuzzle(size, name, sol, kind) {
    var n = SIZES[size].n;
    return { size: size, n: n, name: name, sol: sol, clues: clues(sol, n), kind: kind };
  }

  function createRun(mode, opts) {
    opts = opts || {};
    if (MODES.indexOf(mode) < 0) mode = DEFAULT_MODE;
    var rand = rng(opts.seed || (Date.now() ^ Math.floor(Math.random() * 1e9)));
    var maxSize = opts.maxSize || '15x15';
    var decks = {}, genCount = {};
    function nextPuzzleFor(size) {
      var n = SIZES[size].n;
      if (!decks[size]) decks[size] = shuffle((MOTIVER[n] || []).map(function (m) { return m; }), rand);
      var m = decks[size].shift();
      if (m) return makePuzzle(size, m.navn, fromRows(m.rows), 'motiv');
      genCount[size] = (genCount[size] || 0) + 1;
      var g = generate(n, rand);
      if (!g) { // nødløsning (sker ikke i praksis): et håndlavet motiv igen
        var list = MOTIVER[n] || MOTIVER[5];
        var mm = list[Math.floor(rand() * list.length)];
        return makePuzzle(SIZES[size] && MOTIVER[n] ? size : '5x5', mm.navn, fromRows(mm.rows), 'motiv');
      }
      return makePuzzle(size, 'Rumvæsen nr. ' + genCount[size], g.sol, 'genereret');
    }

    var state = {
      mode: mode, maxSize: maxSize, index: 0, score: 0, solvedCount: 0, perfectCount: 0,
      puzzle: null, mark: [], lock: [], lives: RULES.lives, errors: 0, hints: 0,
      rowDone: [], colDone: [], solved: false, over: false, ended: false, lastPoints: null,
      lastError: -1, lastHint: -1, history: []
    };
    function load(p) {
      var N = p.n * p.n;
      state.puzzle = p;
      state.mark = fill(N, 0); state.lock = fill(N, '');
      state.lives = RULES.lives; state.errors = 0; state.hints = 0;
      state.rowDone = fill(p.n, false); state.colDone = fill(p.n, false);
      state.solved = false; state.lastPoints = null; state.lastError = -1; state.lastHint = -1;
      updateLines();
    }
    function sol(i) { return state.puzzle.sol[i]; }
    function lineDone(cells) { for (var k = 0; k < cells.length; k++) if (sol(cells[k]) && state.mark[cells[k]] !== 1) return false; return true; }
    function rowCells(y) { var n = state.puzzle.n, a = []; for (var x = 0; x < n; x++) a.push(y * n + x); return a; }
    function colCells(x) { var n = state.puzzle.n, a = []; for (var y = 0; y < n; y++) a.push(y * n + x); return a; }
    // Markér løste rækker/kolonner og kryds deres tomme felter automatisk
    function updateLines() {
      var n = state.puzzle.n, newly = [];
      for (var i = 0; i < n; i++) {
        var r = lineDone(rowCells(i)), c = lineDone(colCells(i));
        if (r && !state.rowDone[i]) newly.push('r' + i);
        if (c && !state.colDone[i]) newly.push('c' + i);
        state.rowDone[i] = r; state.colDone[i] = c;
        if (r) autoCross(rowCells(i));
        if (c) autoCross(colCells(i));
      }
      return newly;
    }
    function autoCross(cells) {
      cells.forEach(function (k) { if (!sol(k) && state.mark[k] === 0) { state.mark[k] = 2; state.lock[k] = 'auto'; } });
    }
    function checkSolved() {
      var p = state.puzzle;
      for (var i = 0; i < p.sol.length; i++) if (p.sol[i] && state.mark[i] !== 1) return false;
      return true;
    }
    function finishPuzzle() {
      state.solved = true;
      // Billedet vises helt: resten af felterne krydses
      for (var i = 0; i < state.mark.length; i++) if (!sol(i) && state.mark[i] === 0) { state.mark[i] = 2; state.lock[i] = 'auto'; }
      var pts = puzzlePoints(state.puzzle.n, state.errors, state.hints);
      state.lastPoints = pts;
      state.score += pts.total;
      state.solvedCount++;
      if (!state.errors && !state.hints) state.perfectCount++;
      state.history.push({ name: state.puzzle.name, size: state.puzzle.size, points: pts.total, errors: state.errors, hints: state.hints });
    }
    function live() { return !state.solved && !state.over && !state.ended; }
    function inRange(i) { return i >= 0 && i < state.mark.length; }

    var api = {
      state: state, RULES: RULES,
      get n() { return state.puzzle.n; },
      // Udfyld: { ok, result: 'farvet'|'fejl'|'krydset'|'låst'|'allerede', solved, over, lines }
      fill: function (i) {
        if (!live() || !inRange(i)) return { ok: false, result: 'ingen' };
        if (state.lock[i]) return { ok: false, result: 'låst' };
        if (state.mark[i] === 1) return { ok: false, result: 'allerede' };
        if (state.mark[i] === 2) return { ok: false, result: 'krydset' };
        if (sol(i)) {
          state.mark[i] = 1;
          var lines = updateLines();
          if (checkSolved()) { finishPuzzle(); return { ok: true, result: 'farvet', solved: true, lines: lines }; }
          return { ok: true, result: 'farvet', lines: lines };
        }
        // Fejl: et liv mindre, og feltet afsløres som tomt (krydset og låst)
        state.mark[i] = 2; state.lock[i] = 'fejl';
        state.lives--; state.errors++; state.lastError = i;
        updateLines();
        if (state.lives <= 0) { state.over = true; return { ok: true, result: 'fejl', over: true }; }
        return { ok: true, result: 'fejl' };
      },
      cross: function (i) {
        if (!live() || !inRange(i)) return { ok: false, result: 'ingen' };
        if (state.lock[i]) return { ok: false, result: 'låst' };
        if (state.mark[i] === 1) return { ok: false, result: 'farvet' };
        if (state.mark[i] === 2) return { ok: false, result: 'allerede' };
        state.mark[i] = 2;
        return { ok: true, result: 'krydset' };
      },
      erase: function (i) {
        if (!live() || !inRange(i)) return { ok: false, result: 'ingen' };
        if (state.lock[i]) return { ok: false, result: 'låst' };
        if (state.mark[i] === 1) return { ok: false, result: 'farvet' };
        if (state.mark[i] === 0) return { ok: false, result: 'tomt' };
        state.mark[i] = 0;
        return { ok: true, result: 'visket' };
      },
      apply: function (tool, i) { return tool === 'kryds' ? api.cross(i) : tool === 'visk' ? api.erase(i) : api.fill(i); },
      // Tip: afslør ét felt i billedet. Først et felt, spilleren har krydset ved en
      // fejl, ellers et felt i en række/kolonne med flest manglende felter.
      hint: function () {
        if (!live()) return -1;
        var p = state.puzzle, n = p.n, best = -1, bestScore = -1;
        for (var i = 0; i < p.sol.length; i++) {
          if (!p.sol[i] || state.mark[i] === 1) continue;
          var y = Math.floor(i / n), x = i % n;
          var sc = (state.mark[i] === 2 ? 1000 : 0) + missing(rowCells(y)) + missing(colCells(x)) + rand() * 0.5;
          if (sc > bestScore) { bestScore = sc; best = i; }
        }
        if (best < 0) return -1;
        state.mark[best] = 1; state.lock[best] = 'tip'; state.hints++; state.lastHint = best;
        updateLines();
        if (checkSolved()) finishPuzzle();
        return best;
      },
      hintCost: function () { return RULES.points[state.puzzle.n].hint; },
      nextPuzzle: function () {
        if (state.over || state.ended) return false;
        if (state.puzzle && !state.solved) return false;
        if (state.puzzle) state.index++;
        load(nextPuzzleFor(sizeForPuzzle(state.mode, state.index, maxSize)));
        return true;
      },
      end: function () { state.ended = true; return { score: state.score, solved: state.solvedCount }; },
      isSolved: checkSolved,
      clueDone: function (axis, i) { return axis === 'r' ? state.rowDone[i] : state.colDone[i]; },
      // Til test: læg en bestemt gåde ind
      _load: function (size, name, rows) { load(makePuzzle(size, name, fromRows(rows), 'motiv')); },
      _loadPuzzle: function (p) { load(p); }
    };
    function missing(cells) { var c = 0; cells.forEach(function (k) { if (sol(k) && state.mark[k] !== 1) c++; }); return c; }
    api.nextPuzzle();
    return api;
  }

  global.PixelgaaderGame = {
    SIZES: SIZES, SIZE_ORDER: SIZE_ORDER, MODES: MODES, DEFAULT_MODE: DEFAULT_MODE, STEPS: STEPS, RULES: RULES,
    rng: rng, fromRows: fromRows, toRows: toRows, lineClue: lineClue, clues: clues, maxClueLen: maxClueLen,
    solveLine: solveLine, propagate: propagate, lineSolvable: lineSolvable, countSolutions: countSolutions,
    generate: generate, clueSlots: clueSlots, puzzlePoints: puzzlePoints, sizeForPuzzle: sizeForPuzzle, createRun: createRun,
    motiver: MOTIVER
  };
})(typeof window !== 'undefined' ? window : globalThis);
