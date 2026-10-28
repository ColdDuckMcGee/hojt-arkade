/*
 * Sudoku – spillogikken. Ingen DOM, ingen farver, ingen grafik.
 *
 * Pladen er et array med 81 tal (række for række), 0 = tomt felt.
 * Generatoren laver en fuld løsning med tilfældig backtracking og fjerner så
 * tal (først parvis punktsymmetrisk, på Svær og Ekspert derefter enkeltvis), så
 * længe gåden har præcis én løsning og kan løses af teknikløseren med de
 * teknikker, sværheden tillader. Bagefter graderes gåden: Svær skal kræve
 * pointing/box-line, Ekspert skal kræve nøgne eller skjulte par.
 *
 * En serie: gåder i træk med samme sværhed, uden ende, til spilleren selv afslutter.
 * Der er ingen liv: et forkert tal og et tip trækker straks point fra (totalen
 * bliver aldrig negativ). Ét fortryd pr. gåde (giver ikke point tilbage).
 * Point pr. løst gåde efter sværhed, bonus for fejlfri gåde uden tip.
 * Kan bruges i browseren (window.SudokuGame) og i Node (globalThis.SudokuGame).
 */
(function (global) {
  'use strict';

  var DIFFS = {
    // givens: antal tal, generatoren forsøger at komme ned på (aldrig færre)
    // teknik: højeste teknik, gåden må kræve (1 nøgne singler, 2 skjulte singler,
    //         3 pointing/box-line, 4 nøgne/skjulte par)
    // kraever: teknik, gåden skal kræve (graderes; ellers laves en ny, højst forsøg gange)
    // enkelt: fjern også enkelte tal efter de symmetriske par (færre tal)
    let:     { id: 'let',     label: 'Let',     givens: 38, teknik: 1, kraever: 1, forsoeg: 1 },
    mellem:  { id: 'mellem',  label: 'Mellem',  givens: 28, teknik: 2, kraever: 2, forsoeg: 6 },
    svaer:   { id: 'svaer',   label: 'Svær',    givens: 24, teknik: 3, kraever: 3, forsoeg: 60, enkelt: true },
    ekspert: { id: 'ekspert', label: 'Ekspert', givens: 22, teknik: 4, kraever: 4, forsoeg: 60, enkelt: true }
  };
  var DIFF_ORDER = ['let', 'mellem', 'svaer', 'ekspert'];
  // Højst så lang tid må en gåde tage at lave; derefter bruges den bedste indtil nu
  var GEN_BUDGET_MS = 400;
  var RULES = {
    undo: 1,
    // base: point for løst gåde, perfect: bonus for fejlfri uden tip,
    // error: straf pr. forkert tal, tip: pris pr. tip (trækkes straks fra)
    points: {
      let:     { base: 20,  perfect: 10, error: 5,  tip: 4 },
      mellem:  { base: 40,  perfect: 20, error: 8,  tip: 6 },
      svaer:   { base: 70,  perfect: 35, error: 12, tip: 10 },
      ekspert: { base: 110, perfect: 55, error: 16, tip: 14 }
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
  // ---------- Teknikløser (gradering) ----------
  // Løser som et menneske, uden gæt, med kandidater (blyantsnoter) og disse teknikker:
  //   1 nøgne singler   2 skjulte singler   3 pointing / box-line (boks mod række/kolonne)
  //   4 nøgne og skjulte par
  // Hver gang bruges den letteste teknik, der giver fremskridt. Resultatet er den
  // sværeste teknik, der var nødvendig (level), eller 5, hvis teknikkerne ikke rækker.
  var BOX_UNITS = [], LINE_UNITS = [];
  for (var uu = 0; uu < 27; uu++) (uu % 3 === 2 ? BOX_UNITS : LINE_UNITS).push(UNITS[uu]);
  function digitOf(m) { for (var d = 1; d <= 9; d++) if (m === bit(d)) return d; return 0; }
  function techSolve(g0, maxLevel) {
    var g = g0.slice(), cand = new Array(81), level = 0, left = 0;
    maxLevel = maxLevel || 4;
    for (var i = 0; i < 81; i++) { cand[i] = g[i] ? 0 : candidates(g, i); if (!g[i]) left++; }
    function assign(i, d) {
      g[i] = d; cand[i] = 0; left--;
      var p = PEERS[i];
      for (var k = 0; k < p.length; k++) cand[p[k]] &= ~bit(d);
    }
    function nakedSingle() {
      var any = false;
      for (var i = 0; i < 81; i++) if (!g[i] && popcount(cand[i]) === 1) { assign(i, digitOf(cand[i])); any = true; }
      return any;
    }
    function hiddenSingle() {
      for (var u = 0; u < 27; u++) {
        var unit = UNITS[u];
        for (var d = 1; d <= 9; d++) {
          var where = -1, n = 0;
          for (var k = 0; k < 9; k++) { var c = unit[k]; if (g[c] === d) { n = -1; break; } if (cand[c] & bit(d)) { where = c; n++; } }
          if (n === 1) { assign(where, d); return true; }
        }
      }
      return false;
    }
    // Fjern d fra felterne i unit, der ikke står i keep. Sand, hvis noget blev fjernet.
    function elim(unit, keep, d) {
      var any = false;
      for (var k = 0; k < 9; k++) { var c = unit[k]; if (keep.indexOf(c) < 0 && (cand[c] & bit(d))) { cand[c] &= ~bit(d); any = true; } }
      return any;
    }
    function intersections() {
      var any = false;
      // Pointing: d i en boks står kun i én række/kolonne → fjern d fra resten af linjen
      for (var b = 0; b < 9; b++) for (var d = 1; d <= 9; d++) {
        var cells = BOX_UNITS[b].filter(function (c) { return cand[c] & bit(d); });
        if (cells.length < 2) continue;
        var r0 = row(cells[0]), c0 = col(cells[0]);
        if (cells.every(function (c) { return row(c) === r0; })) any = elim(UNITS[r0 * 3], cells, d) || any;
        if (cells.every(function (c) { return col(c) === c0; })) any = elim(UNITS[c0 * 3 + 1], cells, d) || any;
      }
      // Box-line: d i en række/kolonne står kun i én boks → fjern d fra resten af boksen
      for (var l = 0; l < 18; l++) for (var dd = 1; dd <= 9; dd++) {
        var cs = LINE_UNITS[l].filter(function (c) { return cand[c] & bit(dd); });
        if (cs.length < 2) continue;
        var b0 = box(cs[0]);
        if (cs.every(function (c) { return box(c) === b0; })) any = elim(BOX_UNITS[b0], cs, dd) || any;
      }
      return any;
    }
    function pairs() {
      var any = false;
      for (var u = 0; u < 27; u++) {
        var unit = UNITS[u];
        // Nøgne par: to felter med de samme to kandidater
        for (var a = 0; a < 9; a++) {
          var ma = cand[unit[a]];
          if (popcount(ma) !== 2) continue;
          for (var b = a + 1; b < 9; b++) {
            if (cand[unit[b]] !== ma) continue;
            for (var k = 0; k < 9; k++) {
              var c = unit[k];
              if (k !== a && k !== b && (cand[c] & ma)) { cand[c] &= ~ma; any = true; }
            }
          }
        }
        // Skjulte par: to tal, der kun kan stå i de samme to felter
        var pos = [];
        for (var d = 1; d <= 9; d++) { var w = []; for (var k2 = 0; k2 < 9; k2++) if (cand[unit[k2]] & bit(d)) w.push(unit[k2]); pos[d] = w; }
        for (var d1 = 1; d1 <= 9; d1++) {
          if (pos[d1].length !== 2) continue;
          for (var d2 = d1 + 1; d2 <= 9; d2++) {
            if (pos[d2].length !== 2 || pos[d2][0] !== pos[d1][0] || pos[d2][1] !== pos[d1][1]) continue;
            var m = bit(d1) | bit(d2);
            pos[d1].forEach(function (c) { if (cand[c] & ~m) { cand[c] &= m; any = true; } });
          }
        }
      }
      return any;
    }
    var steps = [nakedSingle, hiddenSingle, intersections, pairs];
    while (left > 0) {
      for (var z = 0; z < 81; z++) if (!g[z] && !cand[z]) return { level: 5, grid: null, broken: true };
      var moved = false;
      for (var t = 0; t < maxLevel && !moved; t++) if (steps[t]()) { moved = true; if (t + 1 > level) level = t + 1; }
      if (!moved) return { level: 5, grid: null };
    }
    if (!isComplete(g)) return { level: 5, grid: null, broken: true };
    return { level: level || 1, grid: g };
  }
  // Logisk løsning uden gæt med teknikker op til maxLevel (1–4). null, hvis det ikke rækker.
  function logicSolve(g, maxLevel) { return techSolve(g, maxLevel).grid; }
  // Sværeste teknik, gåden kræver (1–4), eller 5 = kræver mere end teknikløseren kan.
  function grade(g) { return techSolve(g, 4).level; }

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
  // Laver en gåde. Svær og Ekspert graderes: der laves nye, til gåden kræver den
  // ønskede teknik (højst D.forsoeg gange og ca. GEN_BUDGET_MS). Ellers bruges den
  // sværeste, der blev fundet (den er altid entydig og kan løses uden gæt).
  function generate(diffId, r, budgetMs) {
    var D = DIFFS[diffId] || DIFFS.let;
    r = r || rng((Math.random() * 4294967296) >>> 0);
    var t0 = Date.now(), budget = budgetMs || GEN_BUDGET_MS, best = null;
    for (var t = 0; t < (D.forsoeg || 1); t++) {
      var p = generateOnce(D, r);
      p.level = grade(p.givens);
      p.tries = t + 1;
      if (!best || p.level > best.level || (p.level === best.level && p.clues < best.clues)) best = p;
      if (p.level >= D.kraever) break;
      if (Date.now() - t0 > budget) break;
    }
    return best;
  }
  function generateOnce(D, r) {
    var sol = fullGrid(r), g = sol.slice();
    function ok() { return countSolutions(g, 2) === 1 && !!logicSolve(g, D.teknik); }
    var order = shuffle(Array.from({ length: 41 }, function (_, i) { return i; }), r);
    for (var k = 0; k < order.length; k++) {
      var a = order[k], b = 80 - a;
      var n = count(g) - (a === b ? 1 : 2);
      if (n < D.givens) continue;
      var va = g[a], vb = g[b];
      g[a] = 0; g[b] = 0;
      if (!ok()) { g[a] = va; g[b] = vb; }
    }
    if (D.enkelt) {
      var order2 = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }), r);
      for (var m = 0; m < 81; m++) {
        var c = order2[m];
        if (!g[c] || count(g) - 1 < D.givens) continue;
        var v = g[c]; g[c] = 0;
        if (!ok()) g[c] = v;
      }
    }
    return { diff: D.id, givens: g, sol: sol, clues: count(g) };
  }

  // ---------- Point ----------
  // Opgørelse for én gåde. award = det, man får, når gåden er løst. Fejl og tip er
  // allerede trukket fra undervejs (errorCost/tipCost); net = award − errorCost − tipCost.
  function points(diffId, errors, tips) {
    var P = RULES.points[diffId] || RULES.points.let;
    var errorCost = errors * P.error, tipCost = tips * P.tip;
    var bonus = (!errors && !tips) ? P.perfect : 0;
    return { base: P.base, bonus: bonus, errorCost: errorCost, tipCost: tipCost,
      award: P.base + bonus, net: P.base + bonus - errorCost - tipCost };
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
      errors: 0, tips: 0, undoLeft: RULES.undo, totalErrors: 0, totalTips: 0, lost: 0,
      solved: false, over: false, lastPoints: null, lastPenalty: 0
    };
    var snap = null, prefetched = null;
    function load(p) {
      s.puzzle = p;
      s.grid = p.givens.slice();
      s.notes = new Array(81).fill(0);
      s.wrong = new Array(81).fill(0);   // seneste forkerte tal i feltet (vises overstreget)
      s.tipped = new Array(81).fill(false);
      s.errors = 0; s.tips = 0; s.undoLeft = RULES.undo; s.lastPenalty = 0;
      s.solved = false; s.lastPoints = null; snap = null;
    }
    load(opts.puzzle ? { diff: diffId, givens: opts.puzzle.givens.slice(), sol: opts.puzzle.sol.slice(), clues: count(opts.puzzle.givens) } : generate(diffId, r));

    function live() { return !s.solved && !s.over; }
    function isGiven(i) { return !!s.puzzle.givens[i]; }
    function save() { snap = { grid: s.grid.slice(), notes: s.notes.slice(), wrong: s.wrong.slice() }; }
    // Træk point fra totalen (aldrig under 0). Giver det faktisk fratrukne tal.
    function penalize(n) { var before = s.score; s.score = Math.max(0, s.score - n); s.lost += before - s.score; s.lastPenalty = n; return before - s.score; }
    function units(i) {
      var g = s.grid, done = [];
      var groups = { row: UNITS[row(i) * 3], col: UNITS[col(i) * 3 + 1], box: UNITS[box(i) * 3 + 2] };
      Object.keys(groups).forEach(function (k) { if (groups[k].every(function (c) { return g[c]; })) done.push(k); });
      return done;
    }
    function finishPuzzle() {
      s.solved = true;
      var pt = points(s.diff, s.errors, s.tips);
      s.lastPoints = pt; s.score += pt.award; s.solvedCount++;
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
      s.wrong[i] = d; s.errors++; s.totalErrors++;
      var cost = RULES.points[s.diff].error;
      penalize(cost);
      // Reglen, som tallet bryder (til en forklarende tekst), hvis nogen
      var clash = PEERS[i].filter(function (p) { return s.grid[p] === d; });
      return { ok: true, result: 'fejl', cost: cost, clash: clash };
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
    // Ét fortryd pr. gåde: sidste træk (tal, note eller visk). Et forkert tal fjernes
    // fra pladen, men strafpointene kommer ikke tilbage, og fejlen tæller stadig.
    function undo() {
      if (!live() || !snap || s.undoLeft <= 0) return { ok: false };
      s.grid = snap.grid; s.notes = snap.notes; s.wrong = snap.wrong;
      snap = null; s.undoLeft--;
      return { ok: true };
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
      s.tips++; s.totalTips++;
      penalize(RULES.points[s.diff].tip);
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
      load(prefetched || generate(s.diff, r));
      prefetched = null;
      return true;
    }
    // Laver næste gåde i forvejen (kaldes, mens "Gåde løst" vises), så Næste gåde er øjeblikkelig
    function prefetch() { if (!prefetched) prefetched = generate(s.diff, r); return prefetched; }
    function end() { s.over = true; return { score: s.score, solved: s.solvedCount }; }
    // Hvor mange af tallet d står på pladen (til talpanelet: 9 = alle sat)
    function digitCount(d) { var n = 0; for (var i = 0; i < 81; i++) if (s.grid[i] === d) n++; return n; }
    function boxDone(b) { return boxCells(b).every(function (c) { return s.grid[c]; }); }

    return {
      state: s, place: place, toggleNote: toggleNote, erase: erase, undo: undo, canUndo: canUndo,
      hint: hint, hintCost: function () { return RULES.points[s.diff].tip; }, errorCost: function () { return RULES.points[s.diff].error; },
      nextPuzzle: nextPuzzle, prefetch: prefetch, end: end,
      digitCount: digitCount, boxDone: boxDone, isGiven: isGiven,
      _load: function (p) { load({ diff: s.diff, givens: p.givens.slice(), sol: p.sol.slice(), clues: count(p.givens) }); }
    };
  }

  global.SudokuGame = {
    DIFFS: DIFFS, DIFF_ORDER: DIFF_ORDER, RULES: RULES,
    rng: rng, row: row, col: col, box: box, boxCells: boxCells, peers: function (i) { return PEERS[i].slice(); },
    candidates: candidates, canPlace: canPlace, conflicts: conflicts, isComplete: isComplete,
    countSolutions: countSolutions, solve: solve, logicSolve: logicSolve, grade: grade, techSolve: techSolve,
    fullGrid: fullGrid, generate: generate, points: points, createRun: createRun, bit: bit
  };
})(typeof window !== 'undefined' ? window : globalThis);
