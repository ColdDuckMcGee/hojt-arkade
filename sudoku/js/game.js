/*
 * Sudoku – spillogikken. Ingen DOM, ingen farver, ingen grafik.
 *
 * Pladen er et array med 81 tal (række for række), 0 = tomt felt.
 * Generatoren laver en fuld løsning med tilfældig backtracking og fjerner så
 * tal parvis (punktsymmetrisk), så længe gåden har præcis én løsning og – på
 * Let og Mellem – kan løses med enkle teknikker uden at gætte.
 *
 * En serie: gåder i træk med samme sværhed. 3 liv pr. gåde; et forkert tal
 * koster et liv. Ét fortryd pr. gåde. Tip afslører et felt og koster point.
 * Point pr. løst gåde efter sværhed, bonus for fejlfri gåde uden tip.
 * Kan bruges i browseren (window.SudokuGame) og i Node (globalThis.SudokuGame).
 */
(function (global) {
  'use strict';

  var DIFFS = {
    // givens: antal tal, generatoren forsøger at komme ned på (aldrig færre)
    // teknik: 1 = kun nøgne singler, 2 = også skjulte singler, 0 = blot entydig
    // svaerere: forsøg at finde en gåde, der IKKE kan løses med singler alene
    let:    { id: 'let',    label: 'Let',    givens: 38, teknik: 1 },
    mellem: { id: 'mellem', label: 'Mellem', givens: 28, teknik: 2 },
    svaer:  { id: 'svaer',  label: 'Svær',   givens: 24, teknik: 0, svaerere: 6 }
  };
  var DIFF_ORDER = ['let', 'mellem', 'svaer'];
  var RULES = {
    lives: 3,
    undo: 1,
    points: {
      let:    { base: 20, perfect: 10, error: 5,  tip: 4 },
      mellem: { base: 40, perfect: 20, error: 8,  tip: 6 },
      svaer:  { base: 70, perfect: 35, error: 12, tip: 10 }
    }
  };

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
  function shuffle(a, r) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function row(i) { return Math.floor(i / 9); }
  function col(i) { return i % 9; }
  function box(i) { return Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3); }
  // Felterne i boks b (0–8), række for række
  function boxCells(b) {
    var r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3, out = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) out.push((r0 + r) * 9 + c0 + c);
    return out;
  }
  var PEERS = [], UNITS = [];
  (function () {
    var u;
    for (var k = 0; k < 9; k++) {
      u = []; for (var c = 0; c < 9; c++) u.push(k * 9 + c); UNITS.push(u);
      u = []; for (var r = 0; r < 9; r++) u.push(r * 9 + k); UNITS.push(u);
      UNITS.push(boxCells(k));
    }
    for (var i = 0; i < 81; i++) {
      var p = [];
      for (var j = 0; j < 81; j++) if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) p.push(j);
      PEERS.push(p);
    }
  })();
  function bit(d) { return 1 << d; }
  function popcount(m) { var n = 0; while (m) { m &= m - 1; n++; } return n; }
  // Mulige tal i felt i (bitmaske, bit 1–9)
  function candidates(g, i) {
    var used = 0, p = PEERS[i];
    for (var k = 0; k < p.length; k++) used |= bit(g[p[k]]);
    return 0x3FE & ~used;
  }
  // Regelkontrol: må d stå i felt i (uden at se på løsningen)?
  function canPlace(g, i, d) {
    if (d < 1 || d > 9) return false;
    var p = PEERS[i];
    for (var k = 0; k < p.length; k++) if (g[p[k]] === d) return false;
    return true;
  }
  // Felter, der bryder reglerne (samme tal to gange i en række, kolonne eller boks)
  function conflicts(g) {
    var out = [];
    for (var i = 0; i < 81; i++) if (g[i] && !canPlace(g, i, g[i])) out.push(i);
    return out;
  }
  function isComplete(g) {
    for (var i = 0; i < 81; i++) if (!g[i]) return false;
    return conflicts(g).length === 0;
  }

  // ---------- Løser ----------
  // Tæller løsninger (højst limit) med backtracking og "færrest muligheder først".
  function countSolutions(g0, limit, out) {
    var g = g0.slice(), count = 0;
    limit = limit || 2;
    function rec() {
      var best = -1, bestM = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = candidates(g, i), n = popcount(m);
        if (n === 0) return;
        if (n < bestN) { best = i; bestM = m; bestN = n; if (n === 1) break; }
      }
      if (best < 0) { count++; if (out && !out.length) Array.prototype.push.apply(out, g); return; }
      for (var d = 1; d <= 9 && count < limit; d++) {
        if (bestM & bit(d)) { g[best] = d; rec(); g[best] = 0; }
      }
    }
    rec();
    return count;
  }
  function solve(g) { var out = []; return countSolutions(g, 1, out) ? out : null; }
  // Logisk løsning uden gæt. teknik 1: nøgne singler, 2: + skjulte singler.
  function logicSolve(g0, teknik) {
    var g = g0.slice(), progress = true;
    while (progress) {
      progress = false;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = candidates(g, i);
        if (!m) return null;
        if (popcount(m) === 1) { for (var d = 1; d <= 9; d++) if (m === bit(d)) g[i] = d; progress = true; }
      }
      if (!progress && teknik >= 2) {
        for (var u = 0; u < UNITS.length && !progress; u++) {
          var unit = UNITS[u];
          for (var dd = 1; dd <= 9 && !progress; dd++) {
            var where = -1, n = 0, have = false;
            for (var k = 0; k < 9; k++) {
              var c = unit[k];
              if (g[c] === dd) { have = true; break; }
              if (!g[c] && (candidates(g, c) & bit(dd))) { where = c; n++; }
            }
            if (!have && n === 1) { g[where] = dd; progress = true; }
          }
        }
      }
    }
    for (var j = 0; j < 81; j++) if (!g[j]) return null;
    return g;
  }

  // ---------- Generator ----------
  function fullGrid(r) {
    var g = new Array(81).fill(0);
    function rec(i) {
      if (i === 81) return true;
      var ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r);
      for (var k = 0; k < 9; k++) {
        if (canPlace(g, i, ds[k])) { g[i] = ds[k]; if (rec(i + 1)) return true; g[i] = 0; }
      }
      return false;
    }
    rec(0);
    return g;
  }
  function count(g) { var n = 0; for (var i = 0; i < 81; i++) if (g[i]) n++; return n; }
  function generate(diffId, r) {
    var D = DIFFS[diffId] || DIFFS.let;
    r = r || rng((Math.random() * 4294967296) >>> 0);
    var p = generateOnce(D, r);
    for (var t = 1; t < (D.svaerere || 0) && logicSolve(p.givens, 2); t++) p = generateOnce(D, r);
    return p;
  }
  function generateOnce(D, r) {
    var sol = fullGrid(r), g = sol.slice();
    var order = shuffle(Array.from({ length: 41 }, function (_, i) { return i; }), r);
    for (var k = 0; k < order.length; k++) {
      var a = order[k], b = 80 - a;
      var n = count(g) - (a === b ? 1 : 2);
      if (n < D.givens) continue;
      var va = g[a], vb = g[b];
      g[a] = 0; g[b] = 0;
      var ok = countSolutions(g, 2) === 1 && (!D.teknik || logicSolve(g, D.teknik));
      if (!ok) { g[a] = va; g[b] = vb; }
    }
    return { diff: D.id, givens: g, sol: sol, clues: count(g) };
  }

  // ---------- Point ----------
  function points(diffId, errors, tips) {
    var P = RULES.points[diffId];
    var errorCost = errors * P.error, tipCost = tips * P.tip;
    var bonus = (!errors && !tips) ? P.perfect : 0;
    return { base: P.base, bonus: bonus, errorCost: errorCost, tipCost: tipCost,
      total: Math.max(1, P.base + bonus - errorCost - tipCost) };
  }

  // ---------- En serie ----------
  // opts: { seed, puzzle (til test: { givens, sol }) }
  function createRun(diffId, opts) {
    opts = opts || {};
    if (!DIFFS[diffId]) diffId = 'let';
    var r = rng(opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0);
    var s = {
      diff: diffId, index: 0, score: 0, solvedCount: 0, perfectCount: 0,
      puzzle: null, grid: null, notes: null, wrong: null, tipped: null,
      lives: RULES.lives, errors: 0, tips: 0, undoLeft: RULES.undo,
      solved: false, over: false, lastPoints: null
    };
    var snap = null;
    function load(p) {
      s.puzzle = p;
      s.grid = p.givens.slice();
      s.notes = new Array(81).fill(0);
      s.wrong = new Array(81).fill(0);   // seneste forkerte tal i feltet (vises overstreget)
      s.tipped = new Array(81).fill(false);
      s.lives = RULES.lives; s.errors = 0; s.tips = 0; s.undoLeft = RULES.undo;
      s.solved = false; s.lastPoints = null; snap = null;
    }
    load(opts.puzzle ? { diff: diffId, givens: opts.puzzle.givens.slice(), sol: opts.puzzle.sol.slice(), clues: count(opts.puzzle.givens) } : generate(diffId, r));

    function live() { return !s.solved && !s.over; }
    function isGiven(i) { return !!s.puzzle.givens[i]; }
    function save() { snap = { grid: s.grid.slice(), notes: s.notes.slice(), wrong: s.wrong.slice(), lives: s.lives, errors: s.errors }; }
    function units(i) {
      var g = s.grid, done = [];
      var groups = { row: UNITS[row(i) * 3], col: UNITS[col(i) * 3 + 1], box: UNITS[box(i) * 3 + 2] };
      Object.keys(groups).forEach(function (k) { if (groups[k].every(function (c) { return g[c]; })) done.push(k); });
      return done;
    }
    function finishPuzzle() {
      s.solved = true;
      var pt = points(s.diff, s.errors, s.tips);
      s.lastPoints = pt; s.score += pt.total; s.solvedCount++;
      if (!s.errors && !s.tips) s.perfectCount++;
    }
    function setDigit(i, d) {
      s.grid[i] = d; s.notes[i] = 0; s.wrong[i] = 0;
      PEERS[i].forEach(function (p) { s.notes[p] &= ~bit(d); });
    }
    // Sæt tallet d i felt i. result: rigtig | fejl | låst | udfyldt | ugyldig
    function place(i, d) {
      if (!live()) return { ok: false, result: 'slut' };
      if (!(d >= 1 && d <= 9) || !(i >= 0 && i < 81)) return { ok: false, result: 'ugyldig' };
      if (isGiven(i)) return { ok: false, result: 'låst' };
      if (s.grid[i]) return { ok: false, result: 'udfyldt' };
      save();
      if (s.puzzle.sol[i] === d) {
        setDigit(i, d);
        var done = units(i);
        var solved = isComplete(s.grid);
        if (solved) finishPuzzle();
        return { ok: true, result: 'rigtig', done: done, solved: solved };
      }
      s.wrong[i] = d; s.lives--; s.errors++;
      // Reglen, som tallet bryder (til en forklarende tekst), hvis nogen
      var clash = PEERS[i].filter(function (p) { return s.grid[p] === d; });
      if (s.lives <= 0) { s.over = true; snap = null; }
      return { ok: true, result: 'fejl', over: s.over, clash: clash };
    }
    function toggleNote(i, d) {
      if (!live() || s.grid[i] || !(d >= 1 && d <= 9)) return { ok: false, result: s.grid[i] ? 'udfyldt' : 'ugyldig' };
      save();
      s.notes[i] ^= bit(d);
      return { ok: true, result: (s.notes[i] & bit(d)) ? 'note' : 'note-fjernet' };
    }
    function erase(i) {
      if (!live()) return { ok: false, result: 'slut' };
      if (isGiven(i) || s.grid[i]) return { ok: false, result: 'låst' };
      if (!s.notes[i] && !s.wrong[i]) return { ok: false, result: 'tomt' };
      save();
      s.notes[i] = 0; s.wrong[i] = 0;
      return { ok: true, result: 'visket' };
    }
    // Ét fortryd pr. gåde: sidste træk (tal, note eller visk). Fortrydes et forkert tal, kommer livet igen.
    function undo() {
      if (!live() || !snap || s.undoLeft <= 0) return { ok: false };
      var gotLife = snap.lives > s.lives;
      s.grid = snap.grid; s.notes = snap.notes; s.wrong = snap.wrong; s.lives = snap.lives; s.errors = snap.errors;
      snap = null; s.undoLeft--;
      return { ok: true, life: gotLife };
    }
    function canUndo() { return live() && !!snap && s.undoLeft > 0; }
    // Tip: afslører felt i (eller, hvis i ikke er et tomt felt, det tomme felt med færrest muligheder).
    function hint(i) {
      if (!live()) return { ok: false };
      if (!(i >= 0 && i < 81) || s.grid[i]) {
        i = -1; var bestN = 10;
        for (var k = 0; k < 81; k++) if (!s.grid[k]) { var n = popcount(candidates(s.grid, k)); if (n < bestN) { bestN = n; i = k; } }
      }
      if (i < 0) return { ok: false };
      s.tips++;
      s.tipped[i] = true;
      setDigit(i, s.puzzle.sol[i]);
      snap = null; // et tip kan ikke fortrydes
      var solved = isComplete(s.grid);
      if (solved) finishPuzzle();
      return { ok: true, cell: i, digit: s.grid[i], solved: solved };
    }
    function nextPuzzle() {
      if (!s.solved) return false;
      s.index++;
      load(generate(s.diff, r));
      return true;
    }
    function end() { s.over = true; return { score: s.score, solved: s.solvedCount }; }
    // Hvor mange af tallet d står på pladen (til talpanelet: 9 = alle sat)
    function digitCount(d) { var n = 0; for (var i = 0; i < 81; i++) if (s.grid[i] === d) n++; return n; }
    function boxDone(b) { return boxCells(b).every(function (c) { return s.grid[c]; }); }

    return {
      state: s, place: place, toggleNote: toggleNote, erase: erase, undo: undo, canUndo: canUndo,
      hint: hint, hintCost: function () { return RULES.points[s.diff].tip; }, nextPuzzle: nextPuzzle, end: end,
      digitCount: digitCount, boxDone: boxDone, isGiven: isGiven,
      _load: function (p) { load({ diff: s.diff, givens: p.givens.slice(), sol: p.sol.slice(), clues: count(p.givens) }); }
    };
  }

  global.SudokuGame = {
    DIFFS: DIFFS, DIFF_ORDER: DIFF_ORDER, RULES: RULES,
    rng: rng, row: row, col: col, box: box, boxCells: boxCells, peers: function (i) { return PEERS[i].slice(); },
    candidates: candidates, canPlace: canPlace, conflicts: conflicts, isComplete: isComplete,
    countSolutions: countSolutions, solve: solve, logicSolve: logicSolve,
    fullGrid: fullGrid, generate: generate, points: points, createRun: createRun, bit: bit
  };
})(typeof window !== 'undefined' ? window : globalThis);
