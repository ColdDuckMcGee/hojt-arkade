/*
 * Pixelgåder – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node pixelgaader/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/motiver.js');
require('../js/game.js');
var G = globalThis.PixelgaaderGame;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Brute force: alle løsninger til små gitre (til at kontrollere løseren)
function bruteCount(cl, n, limit) {
  var N = n * n, count = 0;
  for (var m = 0; m < (1 << N) && count < limit; m++) {
    var b = []; for (var i = 0; i < N; i++) b.push((m >> i) & 1);
    var c = G.clues(b, n);
    if (JSON.stringify(c) === JSON.stringify(cl)) count++;
  }
  return count;
}
var HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
function run5(rows) { var r = G.createRun('5x5', { seed: 1, maxSize: '15x15' }); r._load('5x5', 'Test', rows || HEART); return r; }
function solIdx(r) { var a = []; r.state.puzzle.sol.forEach(function (v, i) { if (v) a.push(i); }); return a; }
function emptyIdx(r) { var a = []; r.state.puzzle.sol.forEach(function (v, i) { if (!v) a.push(i); }); return a; }

// ---------- Hints ----------
test('hint-beregning for en linje', function () {
  assert.deepStrictEqual(G.lineClue([0, 0, 0, 0, 0]), []);
  assert.deepStrictEqual(G.lineClue([1, 1, 1, 1, 1]), [5]);
  assert.deepStrictEqual(G.lineClue([1, 0, 1, 1, 0, 1]), [1, 2, 1]);
  assert.deepStrictEqual(G.lineClue([0, 1, 1, 0, 0, 1, 1, 1]), [2, 3]);
});
test('hints for rækker og kolonner', function () {
  var c = G.clues(G.fromRows(HEART), 5);
  assert.deepStrictEqual(c.rows, [[1, 1], [5], [5], [3], [1]]);
  assert.deepStrictEqual(c.cols, [[2], [4], [4], [4], [2]]);
  assert.strictEqual(G.maxClueLen(c), 2);
  assert.deepStrictEqual(G.toRows(G.fromRows(HEART), 5), HEART);
});

// ---------- Løser ----------
test('linjeløseren finder sikre felter', function () {
  // [3] i 5 felter: midten er sikker
  assert.deepStrictEqual(G.solveLine([-1, -1, -1, -1, -1], [3]), [-1, -1, 1, -1, -1]);
  // [5] i 5 felter: alt farvet
  assert.deepStrictEqual(G.solveLine([-1, -1, -1, -1, -1], [5]), [1, 1, 1, 1, 1]);
  // [] : alt tomt
  assert.deepStrictEqual(G.solveLine([-1, -1, -1], []), [0, 0, 0]);
  // [1,1] i 3 felter: X.X
  assert.deepStrictEqual(G.solveLine([-1, -1, -1], [1, 1]), [1, 0, 1]);
  // umulig linje
  assert.strictEqual(G.solveLine([0, -1, 0], [2]), null);
});
test('antal løsninger stemmer med brute force (tilfældige 4 × 4)', function () {
  var r = G.rng(42);
  for (var t = 0; t < 60; t++) {
    var b = []; for (var i = 0; i < 16; i++) b.push(r() < 0.5 ? 1 : 0);
    var cl = G.clues(b, 4);
    assert.strictEqual(G.countSolutions(cl, 4, 3), bruteCount(cl, 4, 3), 'gitter ' + t);
  }
});
test('linje-løsbar betyder entydig', function () {
  var r = G.rng(9);
  for (var t = 0; t < 80; t++) {
    var b = []; for (var i = 0; i < 16; i++) b.push(r() < 0.6 ? 1 : 0);
    var cl = G.clues(b, 4);
    if (G.lineSolvable(cl, 4)) assert.strictEqual(bruteCount(cl, 4, 2), 1);
  }
});

// ---------- Entydighed af alle gåder ----------
test('alle håndlavede motiver har præcis én løsning og kan løses uden gæt', function () {
  var total = 0;
  [5, 8, 10, 15].forEach(function (n) {
    var names = {};
    G.motiver[n].forEach(function (m) {
      assert.strictEqual(m.rows.length, n, m.navn);
      m.rows.forEach(function (row) { assert.ok(/^[X.]+$/.test(row) && row.length === n, m.navn + ': ' + row); });
      assert.ok(!names[m.navn], 'dobbelt navn ' + m.navn); names[m.navn] = 1;
      var sol = G.fromRows(m.rows), cl = G.clues(sol, n);
      assert.strictEqual(G.countSolutions(cl, n, 2), 1, n + ' ' + m.navn + ' er ikke entydig');
      assert.ok(G.lineSolvable(cl, n), n + ' ' + m.navn + ' kræver gæt');
      assert.ok(G.maxClueLen(cl) <= G.clueSlots(n), n + ' ' + m.navn + ' har for lange hints');
      total++;
    });
  });
  assert.ok(total >= 30, 'kun ' + total + ' motiver');
});
test('genererede gåder er entydige, uden tomme linjer og inden for hint-pladsen', function () {
  [5, 8, 10, 15].forEach(function (n) {
    var r = G.rng(1000 + n), count = n === 15 ? 40 : 100;
    for (var t = 0; t < count; t++) {
      var g = G.generate(n, r);
      assert.ok(g, 'generatoren gav op ved ' + n);
      var cl = G.clues(g.sol, n);
      assert.strictEqual(G.countSolutions(cl, n, 2), 1, n + ' nr. ' + t + ' er ikke entydig');
      assert.ok(G.lineSolvable(cl, n), n + ' nr. ' + t + ' kræver gæt');
      assert.ok(G.maxClueLen(cl) <= G.clueSlots(n));
      cl.rows.concat(cl.cols).forEach(function (c) { assert.ok(c.length > 0, 'tom linje'); });
      var fillPct = g.sol.reduce(function (a, b) { return a + b; }, 0) / (n * n);
      assert.ok(fillPct >= 0.35 && fillPct <= 0.85, 'fyld ' + fillPct);
    }
  });
});
test('en serie giver kun entydige gåder (også langt ude)', function () {
  var r = G.createRun('stigende', { seed: 5, maxSize: '15x15' });
  for (var k = 0; k < 30; k++) {
    var p = r.state.puzzle;
    assert.strictEqual(G.countSolutions(p.clues, p.n, 2), 1, 'gåde ' + k);
    assert.strictEqual(p.size, G.sizeForPuzzle('stigende', k, '15x15'));
    solIdx(r).forEach(function (i) { r.fill(i); });
    assert.ok(r.state.solved);
    assert.ok(r.nextPuzzle());
  }
});

// ---------- Løsningstjek ----------
test('gåden er løst, når alle farvede felter er farvet', function () {
  var r = run5(), s = r.state, idx = solIdx(r);
  idx.slice(0, -1).forEach(function (i) { var res = r.fill(i); assert.ok(res.ok && !res.solved); });
  assert.ok(!r.isSolved() && !s.solved);
  var last = r.fill(idx[idx.length - 1]);
  assert.ok(last.solved && s.solved && r.isSolved());
  // alle tomme felter krydses til sidst
  emptyIdx(r).forEach(function (i) { assert.strictEqual(s.mark[i], 2); });
  assert.strictEqual(s.solvedCount, 1);
  assert.strictEqual(s.score, G.RULES.points[5].base + G.RULES.points[5].perfect);
  assert.strictEqual(s.perfectCount, 1);
  // intet virker efter løsningen
  assert.ok(!r.fill(emptyIdx(r)[0]).ok);
});
test('kryds afgør ikke løsningen, og krydsede felter kan ikke farves', function () {
  var r = run5(), s = r.state, e = emptyIdx(r), f = solIdx(r);
  assert.strictEqual(r.cross(e[0]).result, 'krydset');
  assert.strictEqual(r.cross(e[0]).result, 'allerede');
  // et forkert kryds på et farvet felt koster ikke noget
  assert.strictEqual(r.cross(f[0]).result, 'krydset');
  assert.strictEqual(s.lives, 3);
  assert.strictEqual(r.fill(f[0]).result, 'krydset'); // skal viskes først
  assert.strictEqual(r.erase(f[0]).result, 'visket');
  assert.strictEqual(r.erase(f[0]).result, 'tomt');
  assert.strictEqual(r.fill(f[0]).result, 'farvet');
  assert.strictEqual(r.erase(f[0]).result, 'farvet'); // farvede felter bliver stående
  assert.strictEqual(r.cross(f[0]).result, 'farvet');
});
test('løste rækker og kolonner markeres, og resten krydses automatisk', function () {
  var r = run5(), s = r.state;
  // række 0 er .X.X. – farv felt 1 og 3
  var res1 = r.fill(1); assert.deepStrictEqual(res1.lines, []);
  var res2 = r.fill(3);
  assert.ok(res2.lines.indexOf('r0') >= 0);
  assert.ok(s.rowDone[0] && r.clueDone('r', 0) && !s.rowDone[1]);
  [0, 2, 4].forEach(function (i) { assert.strictEqual(s.mark[i], 2); assert.strictEqual(s.lock[i], 'auto'); });
  assert.strictEqual(r.erase(0).result, 'låst');
  // kolonne 0 (.XX..): farv række 1 og 2
  r.fill(5); var res3 = r.fill(10);
  assert.ok(res3.lines.indexOf('c0') >= 0 && s.colDone[0]);
  assert.strictEqual(s.mark[20], 2);
});

// ---------- Liv og game over ----------
test('en fejl koster et liv og afslører feltet som tomt', function () {
  var r = run5(), s = r.state, e = emptyIdx(r);
  var res = r.fill(e[0]);
  assert.strictEqual(res.result, 'fejl');
  assert.strictEqual(s.lives, 2); assert.strictEqual(s.errors, 1);
  assert.strictEqual(s.mark[e[0]], 2); assert.strictEqual(s.lock[e[0]], 'fejl');
  assert.strictEqual(r.fill(e[0]).result, 'låst');
  assert.strictEqual(r.erase(e[0]).result, 'låst');
  assert.strictEqual(s.lives, 2);
});
test('tre fejl i samme gåde er game over for serien', function () {
  var r = run5(), s = r.state, e = emptyIdx(r);
  r.fill(e[0]); r.fill(e[1]);
  assert.ok(!s.over);
  var res = r.fill(e[2]);
  assert.ok(res.over && s.over && s.lives === 0);
  assert.ok(!r.fill(solIdx(r)[0]).ok);
  assert.strictEqual(r.hint(), -1);
  assert.ok(!r.nextPuzzle());
});
test('livene fyldes op ved en ny gåde, og fejl trækker point', function () {
  var r = run5(), s = r.state, e = emptyIdx(r);
  r.fill(e[0]); r.fill(e[1]);
  solIdx(r).forEach(function (i) { r.fill(i); });
  assert.ok(s.solved && !s.over);
  var P = G.RULES.points[5];
  assert.strictEqual(s.score, P.base - 2 * P.error);
  assert.strictEqual(s.perfectCount, 0);
  r.nextPuzzle();
  assert.strictEqual(s.lives, 3); assert.strictEqual(s.errors, 0);
  assert.strictEqual(s.index, 1);
});
test('point skaleres efter størrelse og er mindst 1', function () {
  var p5 = G.puzzlePoints(5, 0, 0), p15 = G.puzzlePoints(15, 0, 0);
  assert.ok(p15.total > p5.total);
  [5, 8, 10].forEach(function (n) { assert.ok(G.puzzlePoints(n + (n === 10 ? 5 : n === 8 ? 2 : 3), 0, 0).total > G.puzzlePoints(n, 0, 0).total); });
  assert.strictEqual(G.puzzlePoints(5, 2, 9).total, 1);
  var P = G.RULES.points[8];
  assert.strictEqual(G.puzzlePoints(8, 1, 1).total, P.base - P.error - P.hint);
});

// ---------- Tip ----------
test('tip afslører et farvet felt og koster point', function () {
  var r = run5(), s = r.state;
  var i = r.hint();
  assert.ok(i >= 0 && s.puzzle.sol[i] === 1 && s.mark[i] === 1 && s.lock[i] === 'tip');
  assert.strictEqual(s.hints, 1);
  assert.strictEqual(r.hintCost(), G.RULES.points[5].hint);
  solIdx(r).forEach(function (k) { r.fill(k); });
  var P = G.RULES.points[5];
  assert.strictEqual(s.score, P.base - P.hint);
});
test('tip retter først et felt, der fejlagtigt er krydset', function () {
  var r = run5(), s = r.state, f = solIdx(r);
  r.cross(f[4]);
  assert.strictEqual(r.hint(), f[4]);
  assert.strictEqual(s.mark[f[4]], 1);
});
test('tip kan løse gåden helt', function () {
  var r = run5();
  for (var k = 0; k < 30 && !r.state.solved; k++) r.hint();
  assert.ok(r.state.solved);
  assert.strictEqual(r.state.score, 1);
});

// ---------- Serier ----------
test('stigende serie: 5 × 5, så 8 × 8, 10 × 10 og 15 × 15, begrænset af skærmen', function () {
  var seq = []; for (var i = 0; i < 14; i++) seq.push(G.sizeForPuzzle('stigende', i, '15x15'));
  assert.deepStrictEqual(seq.slice(0, 3), ['5x5', '5x5', '5x5']);
  assert.deepStrictEqual(seq.slice(3, 7), ['8x8', '8x8', '8x8', '8x8']);
  assert.deepStrictEqual(seq.slice(7, 12), ['10x10', '10x10', '10x10', '10x10', '10x10']);
  assert.strictEqual(seq[12], '15x15'); assert.strictEqual(G.sizeForPuzzle('stigende', 500, '15x15'), '15x15');
  assert.strictEqual(G.sizeForPuzzle('stigende', 40, '8x8'), '8x8');
  assert.strictEqual(G.sizeForPuzzle('stigende', 40, '5x5'), '5x5');
  assert.strictEqual(G.sizeForPuzzle('10x10', 0, '5x5'), '10x10');
});
test('motiverne kommer først, derefter genererede gåder uden ende', function () {
  var r = G.createRun('5x5', { seed: 3 }), seen = {}, kinds = [];
  for (var k = 0; k < G.motiver[5].length + 5; k++) {
    var p = r.state.puzzle;
    kinds.push(p.kind);
    if (p.kind === 'motiv') { assert.ok(!seen[p.name], 'gentaget ' + p.name); seen[p.name] = 1; }
    else assert.ok(/^Rumvæsen nr\. \d+$/.test(p.name));
    solIdx(r).forEach(function (i) { r.fill(i); });
    r.nextPuzzle();
  }
  assert.strictEqual(kinds.indexOf('genereret'), G.motiver[5].length);
});
test('afslut giver point og antal løste gåder', function () {
  var r = run5();
  solIdx(r).forEach(function (i) { r.fill(i); });
  var out = r.end();
  assert.deepStrictEqual(out, { score: r.state.score, solved: 1 });
  assert.ok(!r.nextPuzzle());
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('ok   ' + t.name); }
  catch (e) { failed++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået');
process.exit(failed ? 1 : 0);
