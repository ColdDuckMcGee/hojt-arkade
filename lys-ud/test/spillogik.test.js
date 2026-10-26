/*
 * Lys ud – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node lys-ud/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.LysUdGame;

// Fast "tilfældighed", så testene altid giver det samme.
function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Hjælper: plade ud fra tekst ('.' slukket, 'X' tændt)
function boardFrom(rows) {
  var b = [];
  rows.forEach(function (r) { for (var i = 0; i < r.length; i++) b.push(r[i] === 'X' ? 1 : 0); });
  return b;
}
function allBoards(n, fn) {
  var N = n * n;
  for (var m = 0; m < (1 << N); m++) { var b = []; for (var i = 0; i < N; i++) b.push((m >> i) & 1); fn(b); }
}
// Brute force: færrest mulige tryk (kun til 3 × 3 og 4 × 4)
function bruteMin(board, n) {
  var N = n * n, best = -1;
  for (var m = 0; m < (1 << N); m++) {
    var cells = []; for (var i = 0; i < N; i++) if ((m >> i) & 1) cells.push(i);
    if (best >= 0 && cells.length >= best) continue;
    if (G.isDark(G.applyPresses(board, n, cells))) best = cells.length;
  }
  return best;
}

test('størrelser: 3 × 3, 4 × 4 og 5 × 5, med 5 × 5 som standard', function () {
  assert.deepStrictEqual(Object.keys(G.SIZES), ['3x3', '4x4', '5x5']);
  assert.strictEqual(G.DEFAULT_SIZE, '5x5');
  assert.strictEqual(G.SIZES[G.DEFAULT_SIZE].n, 5);
});

test('tryk: feltet og de fire naboer skifter – i hjørner og ved kanten kun dem, der findes', function () {
  var n = 5, b = G.emptyBoard(5);
  assert.deepStrictEqual(G.press(b, n, 12), boardFrom(['.....', '..X..', '.XXX.', '..X..', '.....']));
  assert.deepStrictEqual(G.press(b, n, 0), boardFrom(['XX...', 'X....', '.....', '.....', '.....']));
  assert.deepStrictEqual(G.press(b, n, 24), boardFrom(['.....', '.....', '.....', '....X', '...XX']));
  assert.deepStrictEqual(G.press(b, n, 2), boardFrom(['.XXX.', '..X..', '.....', '.....', '.....']));
  assert.deepStrictEqual(G.affected(3, 4).slice().sort(), [1, 3, 4, 5, 7]);
  // tænd → sluk: samme tryk to gange giver den oprindelige plade, og originalen ændres ikke
  var once = G.press(b, n, 7);
  assert.ok(G.isDark(b));
  assert.deepStrictEqual(G.press(once, n, 7), b);
});

test('tryk: rækkefølgen er ligegyldig', function () {
  var n = 4, b = boardFrom(['X..X', '.XX.', 'X...', '...X']);
  assert.deepStrictEqual(G.applyPresses(b, n, [0, 5, 10, 15]), G.applyPresses(b, n, [15, 10, 5, 0]));
});

test('GF(2): rang og kerne passer med det kendte (3 × 3: 9/0, 4 × 4: 12/4, 5 × 5: 23/2)', function () {
  assert.strictEqual(G.system(3).rank, 9); assert.strictEqual(G.system(3).nullspace.length, 0);
  assert.strictEqual(G.system(4).rank, 12); assert.strictEqual(G.system(4).nullspace.length, 4);
  assert.strictEqual(G.system(5).rank, 23); assert.strictEqual(G.system(5).nullspace.length, 2);
  // Kernevektorer ændrer intet: trykker man på dem, er pladen uændret
  [4, 5].forEach(function (n) {
    G.system(n).nullspace.forEach(function (v) {
      var cells = []; v.forEach(function (x, i) { if (x) cells.push(i); });
      assert.ok(G.isDark(G.applyPresses(G.emptyBoard(n), n, cells)));
    });
  });
});

test('løsbarhed: alle 3 × 3-plader kan løses, præcis 1/16 af 4 × 4 og 1/4 af 5 × 5', function () {
  var c3 = 0; allBoards(3, function (b) { if (G.solvable(b, 3)) c3++; });
  assert.strictEqual(c3, 512);
  var c4 = 0; allBoards(4, function (b) { if (G.solvable(b, 4)) c4++; });
  assert.strictEqual(c4, 65536 / 16);
  var rng = seeded(7), c5 = 0, T = 4000;
  for (var t = 0; t < T; t++) { var b = []; for (var i = 0; i < 25; i++) b.push(rng() < 0.5 ? 1 : 0); if (G.solvable(b, 5)) c5++; }
  assert.ok(Math.abs(c5 / T - 0.25) < 0.04, '5 × 5 løsbar andel ' + c5 / T);
  // En kendt uløselig 5 × 5: kun ét hjørne tændt
  assert.strictEqual(G.solvable(boardFrom(['X....', '.....', '.....', '.....', '.....']), 5), false);
  assert.strictEqual(G.solve(boardFrom(['X....', '.....', '.....', '.....', '.....']), 5), null);
});

test('løser: løsningen slukker pladen, og den er minimal (sammenlignet med brute force)', function () {
  allBoards(3, function (b) {
    var sol = G.solve(b, 3);
    assert.ok(G.isDark(G.applyPresses(b, 3, sol)));
    assert.strictEqual(sol.length, bruteMin(b, 3));
  });
  var rng = seeded(21), checked = 0;
  while (checked < 120) {
    var cells = []; for (var i = 0; i < 16; i++) if (rng() < 0.4) cells.push(i);
    var b = G.applyPresses(G.emptyBoard(4), 4, cells);
    var sol = G.solve(b, 4);
    assert.ok(sol, 'løsbar plade fik ingen løsning');
    assert.ok(G.isDark(G.applyPresses(b, 4, sol)));
    assert.strictEqual(sol.length, bruteMin(b, 4));
    checked++;
  }
});

test('løser 5 × 5: løsningen slukker, og ingen af de 4 løsninger er kortere', function () {
  var rng = seeded(33);
  for (var t = 0; t < 300; t++) {
    var cells = []; for (var i = 0; i < 25; i++) if (rng() < 0.5) cells.push(i);
    var b = G.applyPresses(G.emptyBoard(5), 5, cells);
    var sol = G.solve(b, 5);
    assert.ok(G.isDark(G.applyPresses(b, 5, sol)));
    // Alle løsninger = én løsning + kombinationer af kernen (2 vektorer → 4 løsninger)
    var x = new Array(25).fill(0); sol.forEach(function (k) { x[k] = 1; });
    var K = G.system(5).nullspace;
    [0, 1, 2, 3].forEach(function (m) {
      var y = x.slice();
      K.forEach(function (v, k) { if (m & (1 << k)) for (var j = 0; j < 25; j++) y[j] ^= v[j]; });
      var w = y.reduce(function (a, c) { return a + c; }, 0);
      assert.ok(w >= sol.length);
      var list = []; y.forEach(function (c, j) { if (c) list.push(j); });
      assert.ok(G.isDark(G.applyPresses(b, 5, list)));
    });
    // Løsningen er aldrig længere end de tryk, pladen blev lavet med
    assert.ok(sol.length <= cells.length);
  }
  // Klassisk: alle 25 lamper tændt kan slukkes med 15 tryk
  var all = new Array(25).fill(1);
  assert.strictEqual(G.minMoves(all, 5), 15);
});

test('generator: kun løsbare, ikke-trivielle plader, og færrest mulige træk stiger med banen', function () {
  ['3x3', '4x4', '5x5'].forEach(function (id) {
    var n = G.SIZES[id].n, rng = seeded(n * 13), floor = G.RULES.difficulty[n][0], cap = G.RULES.difficulty[n][1];
    var prev = 0;
    for (var level = 1; level <= 30; level++) {
      var g = G.generate(n, level, rng);
      assert.strictEqual(g.board.length, n * n);
      assert.ok(!G.isDark(g.board), 'tom plade');
      assert.ok(G.solvable(g.board, n), id + ' bane ' + level + ' kan ikke løses');
      assert.strictEqual(g.minMoves, G.minMoves(g.board, n));
      assert.ok(g.minMoves >= floor, id + ' bane ' + level + ' for let: ' + g.minMoves);
      assert.ok(g.minMoves <= cap + 1);
      var t = G.targetFor(n, level);
      assert.ok(t >= prev, 'målet falder'); prev = t;
      assert.ok(Math.abs(g.minMoves - t) <= 1, id + ' bane ' + level + ': ' + g.minMoves + ' mod mål ' + t);
    }
    assert.strictEqual(G.targetFor(n, 1), floor);
    assert.strictEqual(G.targetFor(n, 200), cap);
  });
  // Mindst 3 nødvendige træk allerede på første bane
  assert.ok(G.RULES.difficulty[3][0] >= 3 && G.RULES.difficulty[4][0] >= 3 && G.RULES.difficulty[5][0] >= 4);
});

test('session: første bane, tryk, træk og klaret bane med point', function () {
  var b = G.press(G.press(G.press(G.emptyBoard(5), 5, 6), 5, 12), 5, 18); // 3 tryk på diagonalen
  var run = G.createRun('5x5', { rng: seeded(1), board: b });
  var s = run.state;
  assert.strictEqual(s.level, 1);
  assert.strictEqual(s.minMoves, 3);
  assert.strictEqual(s.moves, 0);
  run.tap(6); assert.strictEqual(s.moves, 1); assert.ok(!s.solved);
  run.tap(12);
  var res = run.tap(18);
  assert.ok(res.solved && s.solved);
  assert.ok(G.isDark(s.board));
  assert.strictEqual(s.levelsSolved, 1);
  assert.deepStrictEqual(res.points, { base: 60, bonus: 100, hintCost: 0, total: 160 });
  assert.strictEqual(s.score, 160);
  assert.strictEqual(s.perfectLevels, 1);
  // Når banen er klaret, gør tryk, fortryd og tip intet
  assert.strictEqual(run.tap(0).ok, false);
  assert.strictEqual(run.undo(), false);
  assert.strictEqual(run.hint(), -1);
});

test('point: bonus falder 20 pr. ekstra træk, tip koster 25, og en klaret bane giver mindst 10', function () {
  assert.deepStrictEqual(G.levelPoints(5, 5, 0), { base: 100, bonus: 100, hintCost: 0, total: 200 });
  assert.strictEqual(G.levelPoints(5, 7, 0).total, 100 + 60);
  assert.strictEqual(G.levelPoints(5, 10, 0).bonus, 0);
  assert.strictEqual(G.levelPoints(5, 30, 0).total, 100);
  assert.strictEqual(G.levelPoints(5, 5, 2).total, 200 - 50);
  assert.strictEqual(G.levelPoints(3, 20, 9).total, 10);
});

test('fortryd: ubegrænset inden for banen, og tælleren følger med', function () {
  var run = G.createRun('4x4', { rng: seeded(4) }), s = run.state, start = s.board.slice();
  assert.strictEqual(run.canUndo(), false);
  var taps = [0, 5, 5, 9, 15, 3, 3, 3, 10, 2, 7, 11];
  var boards = [start.slice()];
  taps.forEach(function (i) { if (!s.solved) { run.tap(i); boards.push(s.board.slice()); } });
  var made = boards.length - 1;
  for (var k = made; k > 0; k--) {
    assert.deepStrictEqual(s.board, boards[k]);
    assert.strictEqual(s.moves, k);
    assert.ok(run.undo() !== false);
  }
  assert.deepStrictEqual(s.board, start);
  assert.strictEqual(s.moves, 0);
  assert.strictEqual(run.undo(), false);
});

test('start forfra: pladen er som ved banens start, og trækkene nulstilles (brugte tip koster stadig)', function () {
  var run = G.createRun('5x5', { rng: seeded(8) }), s = run.state, start = s.board.slice();
  assert.strictEqual(run.canRestart(), false);
  var h = run.hint();
  assert.ok(h >= 0 && s.hintsUsed === 1);
  run.tap((h + 7) % 25); run.tap((h + 3) % 25);
  assert.ok(run.restart());
  assert.deepStrictEqual(s.board, start);
  assert.strictEqual(s.moves, 0);
  assert.strictEqual(s.hintsUsed, 1);
  assert.strictEqual(s.level, 1);
});

test('tip: et felt fra en optimal løsning – følger man tippene, klares banen med færrest mulige træk', function () {
  ['3x3', '4x4', '5x5'].forEach(function (id) {
    var run = G.createRun(id, { rng: seeded(id.length * 5 + 1) }), s = run.state;
    for (var lv = 0; lv < 6; lv++) {
      var min = s.minMoves, guard = 0;
      // Lav først et forkert træk, så tippet skal regnes ud fra pladen, som den er nu
      var wrong = 0; while (G.solve(s.board, run.n).indexOf(wrong) >= 0) wrong++;
      run.tap(wrong);
      var need = run.remainingMin();
      while (!s.solved && guard++ < 40) {
        var before = run.remainingMin();
        var h = run.hint();
        assert.ok(h >= 0);
        assert.strictEqual(G.minMoves(G.press(s.board, run.n, h), run.n), before - 1, 'tip er ikke fra en optimal løsning');
        assert.strictEqual(run.hint(), h, 'samme tip vises igen');
        run.tap(h);
        if (!s.solved) assert.strictEqual(run.remainingMin(), before - 1);
      }
      assert.ok(s.solved);
      assert.strictEqual(s.moves, 1 + need, 'tippene gav ikke færrest mulige træk');
      assert.ok(need <= min + 1);
      assert.ok(s.lastPoints.hintCost === 25 * s.hintsUsed);
      run.nextLevel();
    }
  });
});

test('tip koster point, også når man fortryder bagefter', function () {
  var run = G.createRun('5x5', { rng: seeded(12) }), s = run.state;
  var h1 = run.hint(); run.tap(h1); run.undo();
  var h2 = run.hint();
  assert.strictEqual(s.hintsUsed, 2);
  assert.strictEqual(h2, h1);
  // Løs med løseren og se, at prisen er trukket fra
  G.solve(s.board, 5).forEach(function (i) { run.tap(i); });
  assert.ok(s.solved);
  assert.strictEqual(s.lastPoints.hintCost, 50);
  assert.strictEqual(s.lastPoints.total, Math.max(10, 20 * s.minMoves + 100 - 50));
});

test('banskift: ny plade, bane + 1, træk og tip nulstilles, point og klarede baner følger med', function () {
  var run = G.createRun('3x3', { rng: seeded(2) }), s = run.state, total = 0, seen = [];
  assert.strictEqual(run.nextLevel(), false, 'kan ikke springe en bane over');
  for (var lv = 1; lv <= 12; lv++) {
    assert.strictEqual(s.level, lv);
    assert.strictEqual(s.moves, 0); assert.strictEqual(s.hintsUsed, 0); assert.strictEqual(s.hintCell, -1);
    assert.ok(s.minMoves >= G.targetFor(3, lv) - 1);
    var prev = seen[seen.length - 1];
    assert.ok(!prev || prev !== s.board.join(''), 'samme plade to gange i træk');
    seen.push(s.board.join(''));
    G.solve(s.board, 3).forEach(function (i) { run.tap(i); });
    assert.ok(s.solved);
    total += s.lastPoints.total;
    assert.strictEqual(s.score, total);
    assert.strictEqual(s.levelsSolved, lv);
    assert.ok(run.nextLevel());
  }
  var res = run.end();
  assert.deepStrictEqual(res, { score: total, levelsSolved: 12, level: 13 });
  assert.ok(s.ended);
  assert.strictEqual(run.tap(0).ok, false);
});

test('mange baner på alle størrelser: altid løsbare og aldrig allerede slukkede', function () {
  ['3x3', '4x4', '5x5'].forEach(function (id) {
    var run = G.createRun(id, { rng: seeded(99) }), s = run.state;
    for (var lv = 0; lv < 40; lv++) {
      assert.ok(!G.isDark(s.board));
      var sol = G.solve(s.board, run.n);
      assert.ok(sol && sol.length === s.minMoves);
      sol.forEach(function (i) { run.tap(i); });
      assert.ok(s.solved);
      assert.strictEqual(s.lastPoints.bonus, 100);
      run.nextLevel();
    }
  });
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK    ' + t.name); }
  catch (e) { failed++; console.log('FEJL  ' + t.name + '\n      ' + (e && e.stack || e)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået.');
process.exit(failed ? 1 : 0);
