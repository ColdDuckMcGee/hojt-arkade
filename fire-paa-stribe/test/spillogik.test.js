/*
 * Fire på stribe – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node fire-paa-stribe/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.FirePaaStribeGame;
var X = G.YOU, O = G.CPU;

function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
var B = G.fromRows;

test('brættet er 7 × 6, og brikken lander nederst i kolonnen', function () {
  assert.strictEqual(G.COLS, 7); assert.strictEqual(G.ROWS, 6); assert.strictEqual(G.WINDOWS.length, 69);
  var b = G.emptyBoard();
  assert.strictEqual(G.landingRow(b, 3), 5);
  b = G.dropped(b, 3, X); assert.strictEqual(b[G.idx(5, 3)], X);
  assert.strictEqual(G.landingRow(b, 3), 4);
  for (var i = 0; i < 5; i++) b = G.dropped(b, 3, i % 2 ? X : O);
  assert.strictEqual(G.landingRow(b, 3), -1); assert.strictEqual(G.canDrop(b, 3), false);
  assert.strictEqual(G.dropped(b, 3, X), null);
  assert.deepStrictEqual(G.validMoves(b), [2, 4, 1, 5, 0, 6]);
});

test('vinder: vandret', function () {
  var b = B(['.......', '.......', '.......', '.......', '.......', '.XXXX..']);
  var w = G.findWin(b); assert.strictEqual(w.player, X); assert.deepStrictEqual(w.cells, [36, 37, 38, 39]);
  assert.deepStrictEqual(G.lineThrough(b, 5, 2), [36, 37, 38, 39]);
  assert.strictEqual(G.status(b).state, 'win');
});
test('vinder: lodret', function () {
  var b = B(['.......', '.......', 'O......', 'O......', 'O......', 'OXXX...']);
  var w = G.findWin(b); assert.strictEqual(w.player, O); assert.deepStrictEqual(w.cells, [14, 21, 28, 35]);
});
test('vinder: diagonalt begge veje', function () {
  var up = B(['.......', '.......', '...X...', '..XO...', '.XOO...', 'XOOX...']);
  assert.deepStrictEqual(G.findWin(up).cells, [17, 23, 29, 35]); assert.strictEqual(G.findWin(up).player, X);
  var down = B(['.......', '.......', 'O......', 'XO.....', 'XXO....', 'XXXO...']);
  assert.deepStrictEqual(G.findWin(down).cells, [14, 22, 30, 38]); assert.strictEqual(G.findWin(down).player, O);
});
test('ingen vinder ved tre på stribe eller blandede firer', function () {
  assert.strictEqual(G.findWin(B(['.......', '.......', '.......', '.......', '.......', 'XXX.XXX'])), null);
  assert.strictEqual(G.findWin(B(['.......', '.......', '.......', '.......', '.......', 'XXOX...'])), null);
  assert.strictEqual(G.status(G.emptyBoard()).state, 'play');
});
test('fem på stribe markerer alle fem', function () {
  assert.deepStrictEqual(G.findWin(B(['.......', '.......', '.......', '.......', '.......', 'XXXXX..'])).cells, [35, 36, 37, 38, 39]);
});
test('fuld plade uden fire = uafgjort', function () {
  var b = B(['XXOOXXO', 'OOXXOOX', 'XXOOXXO', 'OOXXOOX', 'XXOOXXO', 'OOXXOOX']);
  assert.strictEqual(G.findWin(b), null);
  assert.strictEqual(G.isFull(b), true);
  assert.strictEqual(G.status(b).state, 'draw');
  assert.strictEqual(G.cpuMove(b, 'svaer'), -1);
});

test('AI tager en vindende brik (alle niveauer)', function () {
  var b = B(['.......', '.......', '.......', '.......', 'XX.....', 'XXOOO..']);   // O vinder i kolonne 5 (og 1)
  G.LEVEL_IDS.forEach(function (lv) {
    for (var s = 1; s < 30; s++) {
      var c = G.cpuMove(b, lv, seeded(s));
      var nb = G.dropped(b, c, O); assert.strictEqual(G.findWin(nb) && G.findWin(nb).player, O, lv + ' kolonne ' + c);
    }
  });
});
test('AI blokerer en åben tre-stribe (Normal og Svær)', function () {
  // Du har tre i bunden med begge ender åbne: computeren skal lukke en af enderne
  var b = B(['.......', '.......', '.......', '.......', '...O...', '.XXX.O.']);
  ['normal', 'svaer'].forEach(function (lv) {
    for (var s = 1; s < 10; s++) {
      var c = G.cpuMove(b, lv, seeded(s));
      assert.ok(c === 0 || c === 4, lv + ' valgte ' + c);
    }
  });
  // Tre med én åben ende
  var one = B(['.......', '.......', '.......', '.......', '.......', 'OXXX...']);
  ['normal', 'svaer'].forEach(function (lv) { assert.strictEqual(G.cpuMove(one, lv, seeded(7)), 4, lv); });
  // Lodret tre: skal lægges ovenpå
  var v = B(['.......', '.......', '.......', '..X....', '..X....', 'O.X.O..']);
  ['normal', 'svaer'].forEach(function (lv) { assert.strictEqual(G.cpuMove(v, lv, seeded(3)), 2, lv); });
  // Diagonal tre: skal blokere hullet
  var d = B(['.......', '.......', '.......', '...XO..', '..XOO..', '.XOOX..']);
  ['normal', 'svaer'].forEach(function (lv) { assert.strictEqual(G.cpuMove(d, lv, seeded(5)), 4, lv); });
});
test('AI blokerer en åben tre-stribe allerede ved to brikker med åbne ender (Svær)', function () {
  // .XX.. i bunden: lader computeren dig få .XXX. med begge ender åbne, har du vundet
  var b = B(['.......', '.......', '.......', '.......', '.......', '..XX..O']);
  var c = G.cpuMove(b, 'svaer', seeded(1));
  assert.ok(c === 1 || c === 4, 'valgte ' + c);
});
test('AI vælger sejr frem for at blokere', function () {
  var b = B(['.......', '.......', '.......', 'O......', 'O.X....', 'O.XX.X.']);
  ['rolig', 'normal', 'svaer'].forEach(function (lv) { assert.strictEqual(G.cpuMove(b, lv, seeded(2)), 0, lv); });
});
test('Svær slår Rolig i de fleste partier', function () {
  var wins = 0, rng = seeded(11);
  for (var g = 0; g < 10; g++) {
    var b = G.emptyBoard(), p = g % 2 ? X : O;
    while (G.status(b).state === 'play') {
      var c = p === O ? G.bestMove(b, O, 8, rng).col : (function () { var m = G.cpuMove(b.map(function (v) { return v ? 3 - v : 0; }), 'rolig', rng); return m; })();
      b = G.dropped(b, c, p); p = 3 - p;
    }
    var st = G.status(b); if (st.state === 'win' && st.player === O) wins++;
  }
  assert.ok(wins >= 8, 'Svær vandt ' + wins + ' af 10');
});
test('Svær tænker hurtigt nok (under 300 ms på en tom plade)', function () {
  var t = Date.now(); G.bestMove(G.emptyBoard(), O, G.LEVELS.svaer.depth); assert.ok(Date.now() - t < 300);
  assert.ok(G.LEVELS.svaer.depth >= 6);
});
test('tip peger på din vindende brik eller den, der blokerer', function () {
  assert.strictEqual(G.hintMove(B(['.......', '.......', '.......', '.......', '.......', 'XXX.OO.'])), 3);
  assert.strictEqual(G.hintMove(B(['.......', '.......', '.......', '.......', 'X......', 'XXOOO..'])), 5);
});

test('point: sejr med få træk giver mest, uafgjort giver færre, niveauet ganger', function () {
  var R = G.RULES;
  assert.strictEqual(G.gamePoints('win', 4, 'rolig', 0).total, R.win + R.perMove * 17);
  assert.strictEqual(G.gamePoints('win', 21, 'rolig', 0).total, R.win);
  assert.ok(G.gamePoints('win', 6, 'normal', 0).total > G.gamePoints('win', 10, 'normal', 0).total);
  assert.strictEqual(G.gamePoints('win', 10, 'svaer', 0).total, 3 * (R.win + R.perMove * 11));
  assert.strictEqual(G.gamePoints('draw', 21, 'normal', 0).total, 2 * R.draw);
  assert.ok(G.gamePoints('draw', 21, 'rolig', 0).total < G.gamePoints('win', 21, 'rolig', 0).total);
  assert.strictEqual(G.gamePoints('win', 10, 'rolig', 35).total, R.win + R.perMove * 11 - 35);
  assert.strictEqual(G.gamePoints('loss', 5, 'svaer', 0).total, 0);
  assert.strictEqual(G.gamePoints('win', 21, 'rolig', 9999).total, R.minWin);
});

test('serie: sejr og uafgjort fortsætter, tab afslutter', function () {
  var run = G.createSeries('normal', { rng: seeded(4) }), s = run.state;
  assert.strictEqual(s.game, 1); assert.strictEqual(s.turn, X); assert.strictEqual(s.starter, X);
  // Du vinder: fire i bunden
  run._setBoard(B(['.......', '.......', '.......', '.......', 'OOO....', '.XXX...']), X);
  var r = run.play(0); assert.strictEqual(r.result, 'win'); assert.strictEqual(s.wins, 1); assert.ok(s.score > 0); assert.ok(!s.ended);
  assert.deepStrictEqual(s.winCells, [35, 36, 37, 38]);
  assert.strictEqual(run.play(4).ok, false);   // partiet er slut
  assert.ok(run.nextGame()); assert.strictEqual(s.game, 2); assert.strictEqual(s.turn, O); assert.strictEqual(s.starter, O);
  // Uafgjort
  run._setBoard(B(['XXOOXX.', 'OOXXOOX', 'XXOOXXO', 'OOXXOOX', 'XXOOXXO', 'OOXXOOX']), O);
  var sc = s.score; r = run.cpuPlay(6); assert.strictEqual(r.result, 'draw'); assert.strictEqual(s.draws, 1);
  assert.strictEqual(s.score - sc, 2 * G.RULES.draw); assert.ok(!s.ended);
  run.nextGame(); assert.strictEqual(s.game, 3); assert.strictEqual(s.turn, X);
  // Tab
  run._setBoard(B(['.......', '.......', '.......', 'O......', 'O.X....', 'O.XX...']), O);
  sc = s.score; r = run.cpuPlay(); assert.strictEqual(r.result, 'loss'); assert.ok(s.ended);
  assert.strictEqual(s.score, sc); assert.strictEqual(run.nextGame(), false);
});
test('serie: computeren svarer, og du kan ikke lægge, når det er dens tur', function () {
  var run = G.createSeries('svaer', { rng: seeded(1) });
  assert.ok(run.play(3).ok); assert.strictEqual(run.state.turn, O);
  assert.strictEqual(run.play(3).ok, false);
  var r = run.cpuPlay(); assert.ok(r.ok); assert.strictEqual(run.state.turn, X);
  assert.strictEqual(run.state.history.length, 2);
});
test('fortryd: ét træk pr. parti, tager computerens svar med og koster point', function () {
  var run = G.createSeries('normal', { rng: seeded(2) }), s = run.state;
  assert.strictEqual(run.canUndo(), false);
  run.play(3); run.cpuPlay(); run.play(2); run.cpuPlay();
  var before = s.board.slice();
  assert.ok(run.canUndo());
  var u = run.undo(); assert.ok(u.ok); assert.strictEqual(u.removed.length, 2);
  assert.strictEqual(s.history.length, 2); assert.strictEqual(s.youMoves, 1); assert.strictEqual(s.penalty, G.RULES.undoCost);
  assert.notDeepStrictEqual(s.board, before); assert.strictEqual(s.turn, X);
  run.play(2); run.cpuPlay();
  assert.strictEqual(run.canUndo(), false); assert.strictEqual(run.undo().ok, false);
});
test('tip: koster point én gang pr. visning', function () {
  var run = G.createSeries('normal'), s = run.state;
  run._setBoard(B(['.......', '.......', '.......', '.......', '.......', 'XXX.OO.']), X);
  assert.strictEqual(run.hint(), 3); assert.strictEqual(run.hint(), 3);
  assert.strictEqual(s.hintsUsed, 1); assert.strictEqual(s.penalty, G.RULES.hintCost);
  run.play(3); assert.strictEqual(s.hintCol, -1);
  assert.strictEqual(s.lastPoints.penalty, G.RULES.hintCost);
});
test('et helt parti mellem to computere ender altid korrekt', function () {
  var rng = seeded(9);
  for (var g = 0; g < 20; g++) {
    var b = G.emptyBoard(), p = X, n = 0;
    while (G.status(b).state === 'play') { b = G.dropped(b, G.cpuMove(b.map(function (v) { return p === X && v ? 3 - v : v; }), g % 2 ? 'rolig' : 'normal', rng), p); p = 3 - p; n++; }
    assert.ok(n <= 42);
  }
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK   ' + t.name); }
  catch (e) { failed++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået');
process.exit(failed ? 1 : 0);
