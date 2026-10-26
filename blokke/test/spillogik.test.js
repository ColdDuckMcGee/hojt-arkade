/*
 * Blokke – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node blokke/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.BlokkeGame;

// Fast "tilfældighed", så testene altid giver det samme.
function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Hjælper: bræt ud fra tekst ('.' tomt, alt andet optaget)
function boardFrom(rows) {
  var b = [];
  rows.forEach(function (r) { for (var i = 0; i < r.length; i++) b.push(r[i] === '.' ? 0 : 1); });
  return b;
}
function runWith(sizeId, rows, tray) {
  var run = G.createRun(sizeId, { rng: seeded(3), tray: tray });
  if (rows) run._setBoard(boardFrom(rows));
  return run;
}
var EMPTY8 = ['........', '........', '........', '........', '........', '........', '........', '........'];

test('brikkerne: alle har et ankerfelt, der er en del af brikken, og ingen dubletter', function () {
  var seen = {};
  G.PIECE_LIST.forEach(function (p) {
    assert.ok(p.cells.some(function (c) { return c[0] === p.anchor[0] && c[1] === p.anchor[1]; }), p.id + ' anker');
    var key = p.cells.map(function (c) { return c.join(','); }).sort().join(';');
    assert.ok(!seen[key], 'dublet ' + p.id + ' = ' + seen[key]);
    seen[key] = p.id;
    assert.ok(p.w <= 5 && p.h <= 5);
  });
  assert.deepStrictEqual(G.PIECES['tre-1'].anchor, [1, 0]);
  assert.deepStrictEqual(G.PIECES['storkv'].anchor, [1, 1]);
});

test('nyt spil: tomt bræt, tre brikker, 0 point, 3 fortryd', function () {
  Object.keys(G.SIZES).forEach(function (id) {
    var run = G.createRun(id, { rng: seeded(11) });
    var s = run.state;
    assert.strictEqual(s.board.length, s.n * s.n);
    assert.ok(s.board.every(function (v) { return v === 0; }));
    assert.strictEqual(s.tray.filter(Boolean).length, 3);
    assert.strictEqual(s.score, 0);
    assert.strictEqual(s.undoLeft, 3);
    assert.strictEqual(s.over, false);
  });
  assert.strictEqual(G.SIZES[G.DEFAULT_SIZE].n, 8);
});

test('placering: ankerfeltet lander på det valgte felt, og brikken skubbes ind fra kanten', function () {
  var run = runWith('8x8', EMPTY8, ['tre-1', 'storkv', 'prik']);
  var pv = run.preview(0, 4, 2); // vandret 3'er, anker i midten
  assert.ok(pv.ok);
  assert.deepStrictEqual(pv.cells, [2 * 8 + 3, 2 * 8 + 4, 2 * 8 + 5]);
  assert.strictEqual(pv.anchor, 2 * 8 + 4);
  // ved kanten: 3×3 med anker i midten, valgt i hjørnet (0,0) → lægges med øverste venstre i (0,0)
  pv = run.preview(1, 0, 0);
  assert.strictEqual(pv.x, 0); assert.strictEqual(pv.y, 0);
  pv = run.preview(1, 7, 7);
  assert.strictEqual(pv.x, 5); assert.strictEqual(pv.y, 5);
  assert.ok(pv.cells.every(function (i) { return i >= 0 && i < 64; }));
});

test('placering: optagne felter giver ugyldig skygge, og place afviser uden at ændre noget', function () {
  var rows = EMPTY8.slice(); rows[3] = '...X....';
  var run = runWith('8x8', rows, ['tre-1', 'prik', 'prik']);
  var pv = run.preview(0, 3, 3);
  assert.strictEqual(pv.ok, false);
  assert.deepStrictEqual(pv.blocked, [3 * 8 + 3]);
  var before = run.state.board.slice();
  var res = run.place(0, 3, 3);
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(run.state.board, before);
  assert.ok(run.state.tray[0]);
  // et ledigt sted virker og koster brikken
  res = run.place(0, 5, 5);
  assert.ok(res.ok);
  assert.strictEqual(run.state.tray[0], null);
  assert.strictEqual(run.state.score, 3);
  [5 * 8 + 4, 5 * 8 + 5, 5 * 8 + 6].forEach(function (i) { assert.ok(run.state.board[i]); });
});

test('rydning: en række og en kolonne ryddes samtidigt, og forhåndsvisningen viser dem', function () {
  // Række 7 mangler kun (0,7); kolonne 0 mangler kun (0,7). Et enkelt felt i hjørnet rydder begge.
  var rows = ['X.......', 'X.......', 'X.......', 'X.......', 'X.......', 'X.......', 'X.......', '.XXXXXXX'];
  rows[2] = 'X...XX..';
  var run = runWith('8x8', rows, ['prik', 'prik', 'tre-1']);
  var pv = run.preview(0, 0, 7);
  assert.ok(pv.ok);
  assert.deepStrictEqual(pv.lines, { rows: [7], cols: [0] });
  assert.strictEqual(pv.k, 2);
  assert.strictEqual(pv.cleared.length, 15); // 8 + 8 − det fælles hjørne
  var res = run.place(0, 0, 7);
  assert.ok(res.ok);
  assert.strictEqual(res.k, 2);
  // Alt i række 7 og kolonne 0 er tomt – resten står
  for (var i = 0; i < 8; i++) { assert.strictEqual(run.state.board[7 * 8 + i], 0); assert.strictEqual(run.state.board[i * 8], 0); }
  assert.ok(run.state.board[2 * 8 + 4] && run.state.board[2 * 8 + 5]);
  assert.strictEqual(run.state.lines, 2);
});

test('rydning: flere rækker på én gang med en lodret brik', function () {
  var rows = EMPTY8.slice();
  rows[4] = 'XXX.XXXX'; rows[5] = 'XXX.XXXX'; rows[6] = 'XXX.XXXX';
  var run = runWith('8x8', rows, ['tre-2', 'prik', 'prik']);
  var res = run.place(0, 3, 5); // lodret 3'er, anker i midten
  assert.ok(res.ok);
  assert.deepStrictEqual(res.lines.rows, [4, 5, 6]);
  assert.ok(run.state.board.every(function (v) { return v === 0; }), 'brættet er tomt');
});

test('point: felter, linjer med bonus for flere på én gang, kombo og tomt bræt', function () {
  assert.deepStrictEqual(G.scoreFor(4, 0, 0, false), { cells: 4, lines: 0, combo: 0, empty: 0, total: 4 });
  assert.strictEqual(G.scoreFor(1, 1, 1, false).total, 1 + 10);
  assert.strictEqual(G.scoreFor(3, 2, 1, false).total, 3 + 40);
  assert.strictEqual(G.scoreFor(3, 3, 1, false).total, 3 + 90);
  assert.strictEqual(G.scoreFor(1, 1, 3, false).total, 1 + 10 + 40);   // kombo 3: 2 × 20
  assert.strictEqual(G.scoreFor(1, 1, 1, true).total, 1 + 10 + 100);   // tomt bræt
  // I et rigtigt spil: tre rækker på én gang og tomt bræt
  var rows = EMPTY8.slice(); rows[4] = 'XXX.XXXX'; rows[5] = 'XXX.XXXX'; rows[6] = 'XXX.XXXX';
  var run = runWith('8x8', rows, ['tre-2', 'prik', 'prik']);
  var pv = run.preview(0, 3, 5);
  assert.strictEqual(pv.score.total, 3 + 90 + 100);
  run.place(0, 3, 5);
  assert.strictEqual(run.state.score, 193);
  assert.strictEqual(run.state.combo, 1);
});

test('kombo: tæller op ved rydning i træk og nulstilles af et træk uden rydning', function () {
  var rows = EMPTY8.slice(); rows[0] = '.XXXXXXX'; rows[1] = '.XXXXXXX';
  var run = runWith('8x8', rows, ['prik', 'prik', 'prik']);
  var r1 = run.place(0, 0, 0);
  assert.strictEqual(r1.combo, 1); assert.strictEqual(r1.points.total, 11);
  var r2 = run.place(1, 0, 1);
  assert.strictEqual(r2.combo, 2); assert.strictEqual(r2.points.total, 1 + 10 + 20 + 100); // også tomt bræt
  var r3 = run.place(2, 4, 4);
  assert.strictEqual(r3.combo, 0); assert.strictEqual(r3.points.total, 1);
  assert.strictEqual(run.state.bestCombo, 2);
});

test('nye brikker: når alle tre er lagt, kommer tre nye', function () {
  var run = runWith('8x8', EMPTY8, ['prik', 'prik', 'prik']);
  assert.strictEqual(run.place(0, 0, 0).newSet, false);
  assert.strictEqual(run.place(1, 2, 0).newSet, false);
  var r = run.place(2, 4, 0);
  assert.strictEqual(r.newSet, true);
  assert.strictEqual(run.state.tray.filter(Boolean).length, 3);
});

test('game over: når ingen tilbageværende brik kan lægges', function () {
  // Skakbræt: kun enkeltfelter passer
  var rows = [];
  for (var y = 0; y < 8; y++) { var r = ''; for (var x = 0; x < 8; x++) r += (x + y) % 2 ? 'X' : '.'; rows.push(r); }
  var run = runWith('8x8', rows, ['to-1', 'kvadrat', 'tre-2']);
  assert.strictEqual(run.state.over, true);
  assert.strictEqual(run.anyFits(), false);
  assert.strictEqual(run.place(0, 0, 0).ok, false);
  // Med en prik er spillet ikke slut
  run._setTray(['to-1', 'prik', null]);
  assert.strictEqual(run.state.over, false);
  assert.strictEqual(run.slotFits(0), false);
  assert.strictEqual(run.slotFits(1), true);
  // Lægges prikken, og kan den sidste brik ikke være der, er spillet slut
  var res = run.place(1, 0, 0);
  assert.ok(res.ok);
  assert.strictEqual(res.over, true);
  assert.strictEqual(run.state.over, true);
});

test('fortryd: sidste træk rulles tilbage med point, linjer, kombo og brikker – 3 gange pr. spil', function () {
  var rows = EMPTY8.slice(); rows[0] = '.XXXXXXX';
  var run = runWith('8x8', rows, ['prik', 'prik', 'tre-1']);
  var before = JSON.stringify(run.state.board);
  assert.strictEqual(run.canUndo(), false); // intet at fortryde endnu
  run.place(0, 0, 0);
  assert.strictEqual(run.state.lines, 1);
  assert.ok(run.undo());
  assert.strictEqual(JSON.stringify(run.state.board), before);
  assert.strictEqual(run.state.score, 0);
  assert.strictEqual(run.state.lines, 0);
  assert.strictEqual(run.state.combo, 0);
  assert.strictEqual(run.state.tray[0].id, 'prik');
  assert.strictEqual(run.state.undoLeft, 2);
  run.place(0, 3, 3); run.undo();
  run.place(0, 3, 3); run.undo();
  assert.strictEqual(run.state.undoLeft, 0);
  run.place(0, 3, 3);
  assert.strictEqual(run.canUndo(), false);
  assert.strictEqual(run.undo(), false);
});

test('fortryd: virker også efter game over og efter et nyt sæt brikker', function () {
  var rows = [];
  for (var y = 0; y < 8; y++) { var r = ''; for (var x = 0; x < 8; x++) r += (x + y) % 2 ? 'X' : '.'; rows.push(r); }
  var run = runWith('8x8', rows, ['to-1', 'prik', null]);
  run.place(1, 0, 0);
  assert.strictEqual(run.state.over, true);
  assert.ok(run.undo());
  assert.strictEqual(run.state.over, false);
  assert.strictEqual(run.state.tray[1].id, 'prik');
  // nyt sæt fortrydes: de gamle brikker kommer tilbage
  var run2 = runWith('8x8', EMPTY8, ['prik', null, null]);
  var res = run2.place(0, 0, 0);
  assert.ok(res.newSet);
  run2.undo();
  assert.deepStrictEqual(run2.state.tray.map(function (p) { return p && p.id; }), ['prik', null, null]);
});

test('retfærdige sæt: på et tomt eller let fyldt bræt kan alle tre brikker altid lægges', function () {
  var fairCount = {};
  for (var seed = 1; seed < 120; seed++) {
    var rng = seeded(seed);
    ['6x6', '8x8', '10x10'].forEach(function (id) {
      var n = G.SIZES[id].n, b = G.emptyBoard(n);
      for (var i = 0; i < b.length; i++) if (rng() < 0.25) b[i] = 1;
      var set = G.dealSet(b, n, rng, 0);
      var e = G.dealSet(G.emptyBoard(n), n, rng, 0);
      assert.strictEqual(e.fair, 'alle', 'tomt bræt ' + id + ' seed ' + seed);
      assert.ok(G.solvable(G.emptyBoard(n), n, e.pieces));
      // let fyldt bræt: sættet er "alle" (og kan løses) eller mindst én brik passer
      if (set.fair === 'alle') assert.ok(G.solvable(b, n, set.pieces));
      else if (set.fair === 'en') assert.ok(set.pieces.some(function (p) { return G.fitsAnywhere(b, n, p); }));
      fairCount[set.fair] = (fairCount[set.fair] || 0) + 1;
    });
  }
  assert.ok(fairCount.alle > 300, 'næsten altid alle tre: ' + JSON.stringify(fairCount));
});

test('retfærdige sæt: de første sæt har aldrig to store brikker på én gang', function () {
  for (var seed = 1; seed < 300; seed++) {
    var set = G.dealSet(G.emptyBoard(8), 8, seeded(seed), 0).pieces;
    assert.ok(set.filter(function (p) { return p.size >= 5; }).length <= 1, 'seed ' + seed);
  }
});

test('et helt spil med en enkel spiller ender roligt med game over og point', function () {
  ['6x6', '8x8', '10x10'].forEach(function (id) {
    var run = G.createRun(id, { rng: seeded(5) }), moves = 0;
    while (!run.state.over && moves < 5000) {
      var done = false;
      for (var sl = 0; sl < 3 && !done; sl++) for (var y = 0; y < run.n && !done; y++) for (var x = 0; x < run.n && !done; x++) {
        var pv = run.preview(sl, x, y);
        if (pv && pv.ok) { run.place(sl, x, y); done = true; }
      }
      assert.ok(done || run.state.over, 'intet træk, men ikke game over');
      moves++;
    }
    assert.ok(run.state.over, id + ' sluttede');
    assert.ok(run.state.score > 0);
    assert.ok(!run.anyFits());
  });
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK    ' + t.name); }
  catch (e) { failed++; console.log('FEJL  ' + t.name + '\n      ' + (e && e.stack || e)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået.');
process.exit(failed ? 1 : 0);
