/*
 * Sudoku – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node sudoku/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.SudokuGame;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// En kendt gyldig løsning (mønster) og en gåde med præcis én løsning
function pattern() { var g = []; for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) g.push(((r * 3 + Math.floor(r / 3) + c) % 9) + 1); return g; }
function validSolution(g) {
  if (g.length !== 81) return false;
  for (var u = 0; u < 9; u++) {
    var rs = new Set(), cs = new Set(), bs = new Set();
    for (var k = 0; k < 9; k++) { rs.add(g[u * 9 + k]); cs.add(g[k * 9 + u]); bs.add(g[G.boxCells(u)[k]]); }
    if ([rs, cs, bs].some(function (s) { return s.size !== 9 || s.has(0); })) return false;
  }
  return true;
}
var P = G.generate('let', G.rng(7));
function run(diff) { return G.createRun(diff || 'let', { seed: 3, puzzle: { givens: P.givens, sol: P.sol } }); }
function empties(r) { var a = []; r.state.grid.forEach(function (v, i) { if (!v) a.push(i); }); return a; }
function wrongDigit(r, i) { for (var d = 1; d <= 9; d++) if (d !== r.state.puzzle.sol[i]) return d; }

// ---------- Regler ----------
test('hjælpere: række, kolonne, boks og naboer', function () {
  assert.strictEqual(G.row(80), 8); assert.strictEqual(G.col(80), 8); assert.strictEqual(G.box(80), 8);
  assert.strictEqual(G.box(30), 4); assert.deepStrictEqual(G.boxCells(4), [30, 31, 32, 39, 40, 41, 48, 49, 50]);
  assert.strictEqual(G.peers(0).length, 20);
});
test('regelkontrol: canPlace og conflicts', function () {
  var g = new Array(81).fill(0);
  g[0] = 5;
  assert.strictEqual(G.canPlace(g, 8, 5), false);   // samme række
  assert.strictEqual(G.canPlace(g, 72, 5), false);  // samme kolonne
  assert.strictEqual(G.canPlace(g, 20, 5), false);  // samme boks
  assert.strictEqual(G.canPlace(g, 40, 5), true);
  assert.strictEqual(G.canPlace(g, 40, 0), false);
  g[40] = 5; g[44] = 5;
  assert.deepStrictEqual(G.conflicts(g), [40, 44]);
  assert.ok(validSolution(pattern()));
  assert.ok(G.isComplete(pattern()));
  var bad = pattern(); bad[0] = bad[1];
  assert.ok(!G.isComplete(bad));
});
test('løseren tæller løsninger', function () {
  var s = pattern();
  assert.strictEqual(G.countSolutions(s, 2), 1);
  assert.strictEqual(G.countSolutions(new Array(81).fill(0), 2), 2);
  // to rækker i samme bånd kan byttes: tømmes de, er der mindst to løsninger
  var two = s.slice();
  for (var c = 0; c < 18; c++) two[c] = 0;
  assert.ok(G.countSolutions(two, 2) === 2, "mindst to løsninger (tæller stopper ved 2)");
  assert.deepStrictEqual(G.solve(P.givens), P.sol);
});
test('logisk løser: singler', function () {
  var g = pattern(); g[0] = 0; g[40] = 0;
  assert.deepStrictEqual(G.logicSolve(g, 1), pattern());
  assert.strictEqual(G.logicSolve(new Array(81).fill(0), 2), null);
  assert.strictEqual(G.grade(g), 1);
  assert.strictEqual(G.grade(new Array(81).fill(0)), 5, 'tom plade kan ikke løses med teknikker');
});
test('teknikløseren: skjult singel kræver niveau 2', function () {
  // Række 0 mangler kun 1 og 2; 1 kan kun stå ét sted pga. kolonnerne
  var g = pattern();
  var holes = []; for (var i = 0; i < 81; i++) if (g[i] === 1 || g[i] === 2) holes.push(i);
  holes.forEach(function (i) { g[i] = 0; });
  var lvl = G.grade(g);
  assert.ok(lvl >= 1 && lvl <= 5);
  if (lvl <= 4) assert.deepStrictEqual(G.logicSolve(g, lvl), pattern());
});

// ---------- Generator ----------
G.DIFF_ORDER.forEach(function (d) {
  test('generatoren: 40 gyldige, graderede gåder med entydig løsning (' + d + ')', function () {
    var D = G.DIFFS[d], r = G.rng(1000 + d.length), clues = [], levels = {}, t0 = Date.now(), slow = 0;
    for (var k = 0; k < 40; k++) {
      var t1 = Date.now();
      var p = G.generate(d, r);
      assert.ok(validSolution(p.sol), 'løsningen er gyldig');
      for (var i = 0; i < 81; i++) if (p.givens[i]) assert.strictEqual(p.givens[i], p.sol[i]);
      assert.deepStrictEqual(G.conflicts(p.givens), []);
      assert.strictEqual(G.countSolutions(p.givens, 2), 1, 'præcis én løsning');
      assert.ok(p.clues >= D.givens, 'mindst ' + D.givens + ' tal');
      slow = Math.max(slow, Date.now() - t1);
      assert.deepStrictEqual(G.logicSolve(p.givens, D.teknik), p.sol, 'kan løses uden gæt med de tilladte teknikker');
      assert.strictEqual(G.grade(p.givens), p.level);
      assert.ok(p.level <= D.teknik);
      // Let og Mellem er punktsymmetriske (Svær og Ekspert fjerner også enkelte tal)
      if (!D.enkelt) for (var j = 0; j < 81; j++) assert.strictEqual(!!p.givens[j], !!p.givens[80 - j]);
      clues.push(p.clues); levels[p.level] = (levels[p.level] || 0) + 1;
    }
    // Næsten alle gåder kræver præcis den teknik, sværheden står for
    assert.ok((levels[D.kraever] || 0) >= 38, JSON.stringify(levels));
    var avg = clues.reduce(function (a, b) { return a + b; }) / clues.length;
    console.log('     ' + d + ': ' + Math.min.apply(null, clues) + '–' + Math.max.apply(null, clues) + ' tal, gennemsnit ' + avg.toFixed(1) +
      ', teknikniveauer ' + JSON.stringify(levels) + ', ' + ((Date.now() - t0) / 40).toFixed(0) + ' ms i snit, højst ' + slow + ' ms');
    assert.ok(slow < 1000, 'ingen gåde tager over 1 s at lave');
  });
});
test('Svær og Ekspert er reelt forskellige', function () {
  var r = G.rng(77);
  for (var k = 0; k < 10; k++) {
    var sv = G.generate('svaer', r), ek = G.generate('ekspert', r);
    // Svær kan ikke løses med singler, men med pointing/box-line
    assert.strictEqual(G.logicSolve(sv.givens, 2), null);
    assert.ok(G.logicSolve(sv.givens, 3));
    // Ekspert kan ikke løses med pointing/box-line, men kræver par
    assert.strictEqual(G.logicSolve(ek.givens, 3), null);
    assert.ok(G.logicSolve(ek.givens, 4));
  }
});
test('generatoren giver op i tide og bruger den bedste gåde (fallback)', function () {
  var p = G.generate('ekspert', G.rng(3), 1);   // 1 ms budget
  assert.strictEqual(G.countSolutions(p.givens, 2), 1);
  assert.ok(p.tries >= 1 && p.level >= 1 && p.level <= 4);
});
test('samme frø giver samme gåde', function () {
  assert.deepStrictEqual(G.generate('mellem', G.rng(5)).givens, G.generate('mellem', G.rng(5)).givens);
});

// ---------- Spillet: tal og fejl (ingen liv) ----------
test('rigtigt tal sættes, givne tal er låst', function () {
  var r = run(), i = empties(r)[0], given = r.state.grid.findIndex(function (v) { return v; });
  assert.strictEqual(r.place(given, 1).result, 'låst');
  var res = r.place(i, P.sol[i]);
  assert.strictEqual(res.result, 'rigtig');
  assert.strictEqual(r.state.grid[i], P.sol[i]);
  assert.strictEqual(r.place(i, P.sol[i]).result, 'udfyldt');
  assert.strictEqual(r.state.lives, undefined, 'der er ingen liv');
});
test('forkert tal trækker point fra, vises som forkert og giver aldrig game over', function () {
  var r = run(), e = empties(r);
  r.state.score = 12;
  var res = r.place(e[0], wrongDigit(r, e[0]));
  assert.strictEqual(res.result, 'fejl'); assert.strictEqual(res.cost, 5);
  assert.strictEqual(r.state.score, 7); assert.strictEqual(r.state.errors, 1);
  assert.strictEqual(r.state.grid[e[0]], 0); assert.strictEqual(r.state.wrong[e[0]], wrongDigit(r, e[0]));
  for (var k = 1; k < 10; k++) r.place(e[k], wrongDigit(r, e[k]));
  assert.ok(!r.state.over, 'ingen game over ved fejl');
  assert.strictEqual(r.state.errors, 10);
  assert.strictEqual(r.state.score, 0, 'totalen bliver aldrig negativ');
  assert.strictEqual(r.place(e[11], P.sol[e[11]]).result, 'rigtig', 'man kan spille videre');
});
test('fejlstraffen afhænger af sværheden', function () {
  ['let', 'mellem', 'svaer', 'ekspert'].forEach(function (d, k) {
    var r = run(d), e = empties(r);
    r.state.score = 100;
    r.place(e[0], wrongDigit(r, e[0]));
    assert.strictEqual(r.state.score, 100 - [5, 8, 12, 16][k]);
    assert.strictEqual(r.errorCost(), [5, 8, 12, 16][k]);
  });
});
test('et forkert tal, der bryder reglerne, peger på det tal, det støder mod', function () {
  var r = run();
  for (var i = 0; i < 81; i++) {
    if (r.state.grid[i]) continue;
    var peer = G.peers(i).find(function (p) { return r.state.grid[p]; });
    var res = r.place(i, r.state.grid[peer]);
    assert.strictEqual(res.result, 'fejl');
    assert.ok(res.clash.indexOf(peer) >= 0);
    return;
  }
});

// ---------- Noter, visk, fortryd og tip ----------
test('noter slås til og fra og fjernes fra naboerne, når tallet sættes', function () {
  var r = run(), e = empties(r), i = e[0];
  var nb = G.peers(i).find(function (p) { return !r.state.grid[p]; });
  var d = P.sol[i];
  r.toggleNote(nb, d); r.toggleNote(nb, (d % 9) + 1);
  assert.strictEqual(r.state.notes[nb], G.bit(d) | G.bit((d % 9) + 1));
  r.place(i, d);
  assert.strictEqual(r.state.notes[nb], G.bit((d % 9) + 1));
  r.toggleNote(nb, (d % 9) + 1);
  assert.strictEqual(r.state.notes[nb], 0);
  assert.strictEqual(r.state.errors, 0, 'noter tæller aldrig som fejl');
  assert.strictEqual(r.state.score, 0);
});
test('visk fjerner noter og forkerte tal, men ikke rigtige tal', function () {
  var r = run(), e = empties(r);
  assert.strictEqual(r.erase(e[0]).result, 'tomt');
  r.toggleNote(e[0], 3);
  assert.strictEqual(r.erase(e[0]).result, 'visket');
  assert.strictEqual(r.state.notes[e[0]], 0);
  r.place(e[1], wrongDigit(r, e[1]));
  assert.ok(r.erase(e[1]).ok);
  assert.strictEqual(r.state.wrong[e[1]], 0);
  r.place(e[2], P.sol[e[2]]);
  assert.strictEqual(r.erase(e[2]).result, 'låst');
});
test('ét fortryd pr. gåde – fjerner det forkerte tal, men giver ikke point tilbage', function () {
  var r = run(), e = empties(r);
  assert.ok(!r.canUndo());
  r.state.score = 50;
  r.place(e[0], wrongDigit(r, e[0]));
  assert.strictEqual(r.state.score, 45);
  var u = r.undo();
  assert.ok(u.ok); assert.strictEqual(u.life, undefined);
  assert.strictEqual(r.state.score, 45, 'ingen refusion'); assert.strictEqual(r.state.errors, 1, 'fejlen tæller stadig');
  assert.strictEqual(r.state.wrong[e[0]], 0);
  assert.strictEqual(r.state.undoLeft, 0);
  r.place(e[1], P.sol[e[1]]);
  assert.ok(!r.canUndo()); assert.strictEqual(r.undo().ok, false);
});
test('fortryd af en note og af et rigtigt tal', function () {
  var r = run(), e = empties(r);
  r.toggleNote(e[0], 4);
  r.undo();
  assert.strictEqual(r.state.notes[e[0]], 0);
  var r2 = run(); r2.place(e[0], P.sol[e[0]]); r2.undo();
  assert.strictEqual(r2.state.grid[e[0]], 0);
});
test('tip udfylder det valgte felt (eller et let felt) og kan ikke fortrydes', function () {
  var r = run(), e = empties(r);
  var t = r.hint(e[5]);
  assert.ok(t.ok); assert.strictEqual(t.cell, e[5]); assert.strictEqual(r.state.grid[e[5]], P.sol[e[5]]);
  assert.ok(r.state.tipped[e[5]]); assert.strictEqual(r.state.tips, 1);
  assert.strictEqual(r.state.score, 0, 'tip trækker fra, men aldrig under 0');
  assert.ok(!r.canUndo());
  var t2 = r.hint(-1);
  assert.ok(t2.ok && t2.cell !== e[5]);
  assert.strictEqual(r.state.grid[t2.cell], P.sol[t2.cell]);
});

// ---------- Point, løst gåde og serien ----------
test('point: grundpoint, bonus for fejlfri uden tip og fradrag', function () {
  assert.deepStrictEqual(G.points('let', 0, 0), { base: 20, bonus: 10, errorCost: 0, tipCost: 0, award: 30, net: 30 });
  assert.deepStrictEqual(G.points('let', 1, 0), { base: 20, bonus: 0, errorCost: 5, tipCost: 0, award: 20, net: 15 });
  assert.strictEqual(G.points('let', 0, 1).net, 16);
  assert.strictEqual(G.points('mellem', 0, 0).award, 60);
  assert.strictEqual(G.points('svaer', 0, 0).award, 105);
  assert.strictEqual(G.points('ekspert', 0, 0).award, 165);
  assert.strictEqual(G.points('ekspert', 1, 1).net, 110 - 16 - 14);
  assert.strictEqual(G.points('let', 2, 9).net, 20 - 10 - 36, 'net kan være negativ for én gåde; totalen klemmes ved 0');
});
function solveAll(r) { var res; empties(r).forEach(function (i) { res = r.place(i, r.state.puzzle.sol[i]); }); return res; }
test('løst gåde giver point; næste gåde nulstiller fortryd og fejl', function () {
  var r = run();
  r.place(empties(r)[0], wrongDigit(r, empties(r)[0]));
  var res = solveAll(r);
  assert.ok(res.solved && r.state.solved);
  assert.strictEqual(r.state.score, 20, 'fejlen kostede 5 fra 0 (klemt), gåden gav 20 uden bonus');
  assert.strictEqual(r.state.solvedCount, 1); assert.strictEqual(r.state.perfectCount, 0);
  assert.strictEqual(r.place(0, 1).ok, false);
  assert.ok(r.nextPuzzle());
  var s = r.state;
  assert.strictEqual(s.index, 1); assert.strictEqual(s.undoLeft, 1); assert.strictEqual(s.errors, 0); assert.strictEqual(s.totalErrors, 1);
  assert.ok(!s.solved);
  assert.strictEqual(G.countSolutions(s.puzzle.givens, 2), 1);
  solveAll(r);
  assert.strictEqual(r.state.score, 20 + 30); assert.strictEqual(r.state.perfectCount, 1);
  // fejl i gåde 3 trækker fra totalen med det samme
  r.nextPuzzle();
  r.place(empties(r)[0], wrongDigit(r, empties(r)[0]));
  assert.strictEqual(r.state.score, 45);
  assert.deepStrictEqual(r.end(), { score: 45, solved: 2 });
  assert.ok(r.state.over);
});
test('prefetch: næste gåde kan laves i forvejen og bruges af nextPuzzle', function () {
  var r = G.createRun('ekspert', { seed: 9 });
  solveAll(r);
  var pre = r.prefetch();
  assert.strictEqual(r.prefetch(), pre, 'laves kun én gang');
  r.nextPuzzle();
  assert.strictEqual(r.state.puzzle, pre);
  assert.strictEqual(r.state.puzzle.diff, 'ekspert');
});
test('sidste felt via tip løser gåden (uden bonus)', function () {
  var r = run(), e = empties(r);
  e.slice(0, -1).forEach(function (i) { r.place(i, P.sol[i]); });
  var t = r.hint(-1);
  assert.ok(t.solved); assert.strictEqual(r.state.score, 20, 'tip fra 0 klemmes, gåden giver 20 uden bonus');
});
test('ukendt sværhed bliver Let', function () {
  assert.strictEqual(G.createRun('xx', { seed: 1 }).state.diff, 'let');
});

var ok = 0, fail = 0;
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('OK   ' + t.name); }
  catch (e) { fail++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + ok + ' af ' + tests.length + ' test bestået');
process.exit(fail ? 1 : 0);
