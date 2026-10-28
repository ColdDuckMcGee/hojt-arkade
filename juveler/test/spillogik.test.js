/*
 * Juveler – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node juveler/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.JuvelerGame;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
// Opfyldning med en fast række typer (så kæder kan styres i testen)
function seq(list) { var i = 0; return function () { var v = list[i % list.length]; i++; return (v + 0.5) / 6; }; }
function noRuns6() { return seq([0, 1, 2, 3, 4, 5, 1, 2]); }

// ---------- Striber ----------
test('vandret og lodret stribe på tre findes', function () {
  var g = G.fromRows(['000', '123', '145']);
  var runs = G.findRuns(g, 3);
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(runs[0].cells, [0, 1, 2]);
  g = G.fromRows(['012', '034', '051']);
  runs = G.findRuns(g, 3);
  assert.strictEqual(runs.length, 1);
  assert.deepStrictEqual(runs[0].cells, [0, 3, 6]);
  assert.strictEqual(runs[0].dir, 'c');
});
test('to ens er ikke en stribe', function () {
  assert.strictEqual(G.hasRun(G.fromRows(['001', '220', '113']), 3), false);
});
test('fire og fem på stribe', function () {
  var g = G.fromRows(['11110', '23452', '34523', '45234', '52345']);
  var gr = G.findGroups(g, 5);
  assert.strictEqual(gr.length, 1); assert.strictEqual(gr[0].size, 4); assert.strictEqual(gr[0].longest, 4);
  g = G.fromRows(['11111', '23452', '34523', '45234', '52345']);
  gr = G.findGroups(g, 5);
  assert.strictEqual(gr[0].size, 5);
});
test('L og T lægges sammen til én gruppe', function () {
  var g = G.fromRows(['11123', '14534', '12345', '34512', '45123']);
  var gr = G.findGroups(g, 5);
  assert.strictEqual(gr.length, 1);
  assert.strictEqual(gr[0].size, 5);
  assert.strictEqual(gr[0].cross, true);
  assert.deepStrictEqual(gr[0].cells, [0, 1, 2, 5, 10]);
});
test('to adskilte striber er to grupper', function () {
  var g = G.fromRows(['11123', '23452', '34523', '45222', '52345']);
  assert.strictEqual(G.findGroups(g, 5).length, 2);
});

// ---------- Byt ----------
test('naboer og wouldMatch', function () {
  assert.ok(G.adjacent(0, 1, 3)); assert.ok(G.adjacent(0, 3, 3));
  assert.ok(!G.adjacent(2, 3, 3), 'ikke rundt om kanten');
  assert.ok(!G.adjacent(0, 4, 3), 'ikke diagonalt');
  var g = G.fromRows(['0010', '2342', '3423', '4234']);
  assert.ok(G.wouldMatch(g, 4, 2, 3), 'byt 1↔0 giver 000');
  assert.ok(!G.wouldMatch(g, 4, 0, 1), 'ens juveler');
  assert.ok(!G.wouldMatch(g, 4, 0, 4), 'giver ingen stribe');
  assert.deepStrictEqual(G.validTargets(g, 4, 3), [2]);
});
test('allMoves og hasMove', function () {
  var none = G.fromRows(['0123', '1230', '2301', '3012']);
  assert.strictEqual(G.hasMove(none, 4), false);
  assert.strictEqual(G.allMoves(none, 4).length, 0);
  var some = G.fromRows(['0010', '2342', '3423', '4234']);
  assert.ok(G.hasMove(some, 4));
  G.allMoves(some, 4).forEach(function (m) { assert.ok(G.wouldMatch(some, 4, m[0], m[1])); });
});

// ---------- Fald og opfyldning ----------
test('juveler falder ned, og hullerne fyldes oppefra', function () {
  var g = G.fromRows(['012', '345', '000']);
  var c = G.collapse(g, 3, [6, 7, 8], 6, seq([5]));
  // Række 0 og 1 falder ét felt; øverste række er ny
  assert.deepStrictEqual(c.grid, G.fromRows(['555', '012', '345']));
  assert.strictEqual(c.falls.length, 6);
  assert.ok(c.falls.every(function (f) { return f.to === f.from + 3; }));
  assert.strictEqual(c.spawns.length, 3);
  assert.ok(c.spawns.every(function (s) { return s.drop === 1; }));
});
test('lodret stribe: kolonnen falder tre felter', function () {
  var g = G.fromRows(['4123', '0451', '0123', '0345']);
  var c = G.collapse(g, 4, [4, 8, 12], 6, seq([5]));
  assert.deepStrictEqual(c.grid.filter(function (v, i) { return i % 4 === 0; }), [5, 5, 5, 4]);
  assert.deepStrictEqual(c.falls, [{ from: 0, to: 12 }]);
  assert.ok(c.spawns.every(function (s) { return s.drop === 3; }));
  assert.ok(c.grid.every(function (v) { return v >= 0; }), 'ingen huller');
});

// ---------- Kæder og point ----------
test('en enkelt stribe: 3 juveler × 10 point, ingen ekstra træk', function () {
  var g = G.fromRows(['000', '123', '451']);
  var r = G.resolve(g, 3, 6, seq([2, 3, 4]));
  assert.strictEqual(r.steps.length, 1);
  assert.strictEqual(r.points, 30);
  assert.strictEqual(r.earned, 0);
});
test('kædereaktion: nye juveler giver en stribe mere, og led 2 tæller dobbelt', function () {
  // Fjerner 000 i bunden; to 1-taller falder ned og danner 111 med en ny 1 ovenfra
  var g = G.fromRows(['123', '145', '000']);
  var r = G.resolve(g, 3, 6, seq([1, 3, 4, 2, 5, 3, 4, 2, 5, 3]));
  assert.ok(r.steps.length >= 2, 'mindst to led');
  assert.strictEqual(r.steps[0].points, 30);
  assert.strictEqual(r.steps[1].level, 2);
  assert.strictEqual(r.steps[1].points, 3 * 10 * 2);
  assert.strictEqual(G.hasRun(r.grid, 3), false, 'brættet er roligt bagefter');
});
test('fire på stribe giver +1 træk, fem giver +2', function () {
  var g4 = G.fromRows(['11110', '23452', '34523', '45234', '52345']);
  var r4 = G.resolve(g4, 5, 6, noRuns6());
  assert.strictEqual(r4.steps[0].earned, G.RULES.earn4);
  assert.strictEqual(r4.steps[0].points, 40 + G.RULES.bonus4);
  var g5 = G.fromRows(['11111', '23452', '34523', '45234', '52345']);
  var r5 = G.resolve(g5, 5, 6, noRuns6());
  assert.strictEqual(r5.steps[0].earned, G.RULES.earn5);
});
test('kæde på tre led giver et ekstra træk fra tredje led', function () {
  // Kun 0'ere fyldes på: tre søjler af 0'ere giver lange kæder
  var g = G.fromRows(['123', '456', '000']);
  var r = G.resolve(g, 3, 6, seq([0]));
  // Når alt fyldes med 0 bliver det ved, til vagten stopper; kontrollér reglen for led 3
  assert.ok(r.steps.length >= 3);
  assert.ok(r.steps[2].earned >= G.RULES.earnChain);
  assert.strictEqual(r.steps[1].earned - (r.steps[1].groups.reduce(function (s, gr) { return s + (gr.kind === 'fem' ? 2 : gr.kind === 'fire' ? 1 : 0); }, 0)), 0, 'led 2 giver ingen kædebonus');
});

// ---------- Nyt bræt ----------
test('nyt bræt har aldrig striber fra start og altid et muligt byt', function () {
  G.SIZE_ORDER.forEach(function (id) {
    var s = G.SIZES[id];
    for (var seed = 1; seed <= 200; seed++) {
      var g = G.freshBoard(s.n, s.types, G.rng(seed));
      assert.strictEqual(g.length, s.n * s.n);
      assert.strictEqual(G.hasRun(g, s.n), false, id + ' frø ' + seed);
      assert.ok(G.hasMove(g, s.n), id + ' frø ' + seed);
      assert.ok(g.every(function (v) { return v >= 0 && v < s.types; }));
    }
  });
});
// ---------- Et spil ----------
test('ugyldigt byt koster intet', function () {
  var run = G.createRun('6x6', { seed: 5 });
  var s = run.state, before = s.grid.slice();
  var bad = null;
  for (var i = 0; i < 36 && !bad; i++) G.neighbours(i, 6).forEach(function (j) { if (!bad && s.grid[i] !== s.grid[j] && !G.wouldMatch(s.grid, 6, i, j)) bad = [i, j]; });
  var r = run.swap(bad[0], bad[1]);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'ingen');
  assert.strictEqual(run.swap(0, 7).reason, 'ikke-nabo');
  assert.strictEqual(s.moves, G.RULES.startMoves);
  assert.deepStrictEqual(s.grid, before);
  assert.strictEqual(s.swaps, 0);
});
test('gyldigt byt koster ét træk og giver point', function () {
  var run = G.createRun('7x7', { seed: 9 });
  var m = run.hint();
  assert.ok(run.canSwap(m[0], m[1]));
  assert.ok(run.targets(m[0]).indexOf(m[1]) >= 0);
  var r = run.swap(m[0], m[1]);
  assert.ok(r.ok);
  assert.ok(r.points >= 30);
  assert.strictEqual(run.state.moves, G.RULES.startMoves - 1 + r.earned);
  assert.strictEqual(run.state.swaps, 1);
  assert.strictEqual(G.hasRun(run.state.grid, 7), false);
  assert.strictEqual(G.hasMove(run.state.grid, 7), !run.state.over || run.state.overReason === 'traek');
});
test('game over når trækkene er brugt', function () {
  var run = G.createRun('6x6', { seed: 2 });
  run._load(run.state.grid, 1);
  var m = run.hint(), r = run.swap(m[0], m[1]);
  if (r.earned === 0) {
    assert.ok(r.over); assert.ok(run.state.over); assert.strictEqual(run.state.moves, 0);
    assert.strictEqual(run.swap(m[0], m[1]).reason, 'slut');
    assert.deepStrictEqual(run.targets(0), []);
  } else assert.ok(!r.over);
});
test('game over når brættet ikke har flere mulige byt', function () {
  // Spil med rigeligt træk, til et bræt løber tør for mulige byt
  var run, found = false;
  for (var seed = 1; seed <= 400 && !found; seed++) {
    run = G.createRun('6x6', { seed: seed });
    while (!run.state.over) {
      run._load(run.state.grid, 50);            // nok træk, så kun manglende byt kan slutte spillet
      var m = run.hint(), r = run.swap(m[0], m[1]);
      if (r.over) {
        assert.strictEqual(r.overReason, 'ingen-byt');
        assert.strictEqual(run.state.overReason, 'ingen-byt');
        assert.strictEqual(G.hasMove(run.state.grid, 6), false, 'brættet har ingen byt');
        assert.strictEqual(G.hasRun(run.state.grid, 6), false);
        assert.ok(run.state.moves > 0, 'der var træk tilbage');
        assert.strictEqual(run.swap(0, 1).reason, 'slut');
        assert.strictEqual(run.tip(), null);
        found = true;
      }
      if (run.state.swaps > 3000) break;
    }
  }
  assert.ok(found, 'fandt et spil, der sluttede på manglende byt');
});
test('trækkene brugt giver årsagen "traek"', function () {
  for (var seed = 1; seed <= 50; seed++) {
    var run = G.createRun('7x7', { seed: seed });
    run._load(run.state.grid, 1);
    var m = run.hint(), r = run.swap(m[0], m[1]);
    if (r.earned === 0) { assert.strictEqual(r.overReason, 'traek'); return; }
  }
  assert.fail('ingen frø gav et byt uden ekstra træk');
});
test('der blandes aldrig: brættet efter et byt er det opløste bræt', function () {
  assert.strictEqual(G.shuffle, undefined);
  var run = G.createRun('6x6', { seed: 8 });
  for (var i = 0; i < 30 && !run.state.over; i++) {
    var m = run.hint(), r = run.swap(m[0], m[1]);
    assert.deepStrictEqual(r.grid, r.steps[r.steps.length - 1].grid);
  }
});
test('Vis et tip koster 20 point og intet træk', function () {
  var run = G.createRun('7x7', { seed: 12 });
  run._load(run.state.grid, 25, 100);
  var t = run.tip();
  assert.ok(t && t.move && G.wouldMatch(run.state.grid, 7, t.move[0], t.move[1]), 'tippet er et muligt byt');
  assert.strictEqual(G.RULES.tipCost, 20);
  assert.strictEqual(t.cost, 20);
  assert.strictEqual(run.state.score, 80);
  assert.strictEqual(run.state.moves, 25);
  assert.strictEqual(run.state.tips, 1);
  assert.strictEqual(run.state.tipPoints, 20);
});
test('tip gør aldrig scoren negativ', function () {
  var run = G.createRun('6x6', { seed: 13 });
  run._load(run.state.grid, 25, 15);
  var t = run.tip();
  assert.strictEqual(t.cost, 15); assert.strictEqual(run.state.score, 0);
  t = run.tip();
  assert.ok(t.move); assert.strictEqual(t.cost, 0); assert.strictEqual(run.state.score, 0);
  assert.strictEqual(run.state.tips, 2); assert.strictEqual(run.state.tipPoints, 15);
});
test('spillet slutter altid (tilfældig spiller)', function () {
  G.SIZE_ORDER.forEach(function (id) {
    for (var seed = 1; seed <= 20; seed++) {
      var run = G.createRun(id, { seed: seed }), n = 0;
      while (!run.state.over && n < 5000) { var m = run.hint(); run.swap(m[0], m[1]); n++; }
      assert.ok(run.state.over, id + ' frø ' + seed);
    }
  });
});

var fail = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('ok   ' + t.name); }
  catch (e) { fail++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + (tests.length - fail) + ' af ' + tests.length + ' test bestået');
process.exit(fail ? 1 : 0);
