/*
 * Juveler – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node juveler/test/spillogik.test.js
 *
 * Testnotation (G.parse): 0–6 juveltype, . tom, * stjernejuvel, # sten,
 * a–g lynjuvel af type 0–6, A–G frossen juvel af type 0–6.
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
  var c = G.collapse(g, null, 3, [6, 7, 8], 6, seq([5]));
  // Række 0 og 1 falder ét felt; øverste række er ny
  assert.deepStrictEqual(c.grid, G.fromRows(['555', '012', '345']));
  assert.strictEqual(c.falls.length, 6);
  assert.ok(c.falls.every(function (f) { return f.to === f.from + 3; }));
  assert.strictEqual(c.spawns.length, 3);
  assert.ok(c.spawns.every(function (s) { return s.drop === 1; }));
});
test('lodret stribe: kolonnen falder tre felter', function () {
  var g = G.fromRows(['4123', '0451', '0123', '0345']);
  var c = G.collapse(g, null, 4, [4, 8, 12], 6, seq([5]));
  assert.deepStrictEqual(c.grid.filter(function (v, i) { return i % 4 === 0; }), [5, 5, 5, 4]);
  assert.deepStrictEqual(c.falls, [{ from: 0, to: 12 }]);
  assert.ok(c.spawns.every(function (s) { return s.drop === 3; }));
  assert.ok(c.grid.every(function (v) { return v >= 0; }), 'ingen huller');
});

// ---------- Kæder og point ----------
test('en enkelt stribe: 3 juveler × 10 point, ingen ekstra træk', function () {
  var g = G.fromRows(['000', '123', '451']);
  var r = G.resolve(g, null, 3, 6, seq([2, 3, 4]));
  assert.strictEqual(r.steps.length, 1);
  assert.strictEqual(r.points, 30);
  assert.strictEqual(r.earned, 0);
});
test('kædereaktion: nye juveler giver en stribe mere, og led 2 tæller dobbelt', function () {
  // Fjerner 000 i bunden; to 1-taller falder ned og danner 111 med en ny 1 ovenfra
  var g = G.fromRows(['123', '145', '000']);
  var r = G.resolve(g, null, 3, 6, seq([1, 3, 4, 2, 5, 3, 4, 2, 5, 3]));
  assert.ok(r.steps.length >= 2, 'mindst to led');
  assert.strictEqual(r.steps[0].points, 30);
  assert.strictEqual(r.steps[1].level, 2);
  assert.strictEqual(r.steps[1].points, 3 * 10 * 2);
  assert.strictEqual(G.hasRun(r.grid, 3), false, 'brættet er roligt bagefter');
});
test('fire på stribe giver +1 træk, fem giver +2', function () {
  var g4 = G.fromRows(['11110', '23452', '34523', '45234', '52345']);
  var r4 = G.resolve(g4, null, 5, 6, noRuns6());
  assert.strictEqual(r4.steps[0].earned, G.RULES.earn4);
  assert.strictEqual(r4.steps[0].points, 40 + G.RULES.bonus4);
  var g5 = G.fromRows(['11111', '23452', '34523', '45234', '52345']);
  var r5 = G.resolve(g5, null, 5, 6, noRuns6());
  assert.strictEqual(r5.steps[0].earned, G.RULES.earn5);
});
test('kæde på tre led giver et ekstra træk fra tredje led', function () {
  // Kun 0'ere fyldes på: tre søjler af 0'ere giver lange kæder
  var g = G.fromRows(['123', '456', '000']);
  var r = G.resolve(g, null, 3, 6, seq([0]));
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
      run._load(run.state.grid, 50, undefined, run.state.fx);           // nok træk, så kun manglende byt kan slutte spillet
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

// ---------- Niveau 2: lynjuvel ----------
function P(rows) { return G.parse(rows); }
test('lynjuvel: 4 på stribe giver en lynjuvel fra niveau 2 (før kun bonus)', function () {
  var p = P(['11110', '23452', '34523', '45234', '52345']);
  var r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 2, moved: [3, 8] });
  assert.deepStrictEqual(r.steps[0].created, [{ i: 3, kind: 'lyn', type: 1 }], 'lynet ligger, hvor der blev byttet');
  assert.strictEqual(r.steps[0].grid[3], 1);
  assert.ok(r.steps[0].fx[3] & G.LYN);
  assert.strictEqual(r.steps[0].earned, G.RULES.earn4);
  var r1 = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 1 });
  assert.deepStrictEqual(r1.steps[0].created, [], 'niveau 1: ingen lynjuvel');
  assert.strictEqual(r1.steps[0].points, 40 + G.RULES.bonus4);
});
test('lynjuvel i en vandret stribe fjerner hele rækken, i en lodret hele kolonnen', function () {
  var p = P(['23452', '34523', '1b134', '45234', '52345']);
  var r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 2 });
  assert.deepStrictEqual(r.steps[0].removed, [10, 11, 12, 13, 14]);
  assert.deepStrictEqual(r.steps[0].fired, [11]);
  p = P(['23145', '34b52', '45123', '52334', '23445']);
  r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 2 });
  assert.deepStrictEqual(r.steps[0].removed, [2, 7, 12, 17, 22]);
  assert.strictEqual(r.lyn, 1);
});
test('lynet knuser sten i sin linje (+1 træk, 30 point)', function () {
  var p = P(['23452', '34523', '1b13#', '45234', '52345']);
  var r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 5 });
  assert.deepStrictEqual(r.steps[0].crushed, [14]);
  assert.strictEqual(r.steps[0].earned, G.RULES.earnStone);
  assert.strictEqual(r.steps[0].points, 4 * 10 + G.RULES.pointsStone);
});

// ---------- Niveau 3: stjernejuvel ----------
test('stjernejuvel: 5 på stribe eller L/T giver en stjerne fra niveau 3', function () {
  var p = P(['11111', '23452', '34523', '45234', '52345']);
  var r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 3 });
  assert.strictEqual(r.steps[0].created[0].kind, 'stjerne');
  assert.strictEqual(r.steps[0].grid[2], G.STJERNE);
  assert.strictEqual(G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 2 }).steps[0].created.length, 0, 'niveau 2: ingen stjerne');
  p = P(['11123', '14534', '12345', '34512', '45123']);
  r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 3, moved: [0, 1] });
  assert.deepStrictEqual(r.steps[0].created, [{ i: 0, kind: 'stjerne', type: 1 }]);
});
test('stjernejuvel byttet med en nabo fjerner alle juveler af naboens slags', function () {
  var p = P(['2*013', '45201', '12340', '20134', '34012']);
  assert.ok(G.wouldMatch(p.grid, 5, 0, 1, p.fx), 'stjernen kan byttes med enhver nabo');
  var r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 3, star: { at: 1, other: 0 } });
  assert.deepStrictEqual(r.steps[0].removed, [0, 1, 7, 11, 15, 24]);
  assert.strictEqual(r.steps[0].byType[2], 5);
  assert.strictEqual(r.steps[0].points, 5 * 10 + G.RULES.bonusStar);
  // To stjerner: alle juveler forsvinder (sten knuses kun, hvis de ligger ved siden af)
  p = P(['**013', '45201', '12340', '20134', '3#012']);
  r = G.resolve(p.grid, p.fx, 5, 6, noRuns6(), { level: 3, star: { at: 1, other: 0 } });
  assert.strictEqual(r.steps[0].removed.length, 25);
});
test('mulige byt: en stjerne tæller, men ikke hvis naboerne er sten', function () {
  assert.strictEqual(G.hasMove(G.fromRows(['0123', '1230', '2301', '3012']), 4), false);
  assert.strictEqual(G.hasMove(G.fromRows(['*123', '1230', '2301', '3012']), 4), true);
  var p = P(['*#23', '#230', '2301', '3012']);
  assert.strictEqual(G.hasMove(p.grid, 4, p.fx), false);
});
test('et rigtigt byt med en stjerne i spillet', function () {
  var run = G.createRun('6x6', { seed: 3 });
  var p = P(['*01234', '123450', '234501', '345012', '450123', '501234']);
  run._load(p.grid, 10, 0, p.fx);
  run.state.level = 3;
  assert.deepStrictEqual(run.targets(0).sort(), [1, 6]);
  var r = run.swap(0, 1);
  assert.ok(r.ok && r.star);
  assert.ok(r.steps[0].byType[0] >= 6, 'alle rubiner forsvandt');
});

// ---------- Niveau 4: is ----------
test('is: en frossen juvel kan ikke byttes, men kan være med i en stribe', function () {
  var p = P(['A0123', 'D4052', '12345', '45201', '20314']);
  assert.strictEqual(G.wouldMatch(p.grid, 5, 0, 1, p.fx), false);
  assert.strictEqual(G.movable(p.grid, p.fx, 0), false);
  assert.ok(G.wouldMatch(p.grid, 5, 2, 7, p.fx), 'byttet giver A00 – den frosne er med');
  var sg = p.grid.slice(); sg[2] = 0; sg[7] = 1;
  var r = G.resolve(sg, p.fx, 5, 6, noRuns6(), { level: 4, moved: [2, 7] });
  assert.deepStrictEqual(r.steps[0].removed, [0, 1, 2]);
  assert.deepStrictEqual(r.steps[0].iceGone, [0], 'den frosne i striben forsvinder med isen');
  assert.deepStrictEqual(r.steps[0].broken, [5], 'isen ved siden af brydes');
  assert.strictEqual(r.steps[0].grid[5], 3, 'juvelen under isen bliver liggende');
  assert.strictEqual(r.steps[0].fx[5] & G.IS, 0, 'og er fri');
  assert.strictEqual(r.ice, 2);
  assert.strictEqual(r.steps[0].points, 3 * 10 + 2 * G.RULES.pointsIce);
});
test('is og sten falder med tyngdekraften', function () {
  var p = P(['0#1', '234', '452']);
  var c = G.collapse(p.grid, p.fx, 3, [4], 6, seq([5]));
  assert.strictEqual(c.grid[4], G.STEN);
  assert.deepStrictEqual(c.falls, [{ from: 1, to: 4 }]);
  p = P(['0A1', '234', '452']);
  c = G.collapse(p.grid, p.fx, 3, [4], 6, seq([5]));
  assert.strictEqual(c.grid[4], 0); assert.ok(c.fx[4] & G.IS);
  assert.strictEqual(c.fx[1], 0, 'den nye juvel øverst er ikke frossen');
});
test('mulige byt: et byt, der kræver en frossen juvel, tæller ikke', function () {
  var g = G.fromRows(['0010', '2342', '3423', '4234']);
  assert.deepStrictEqual(G.allMoves(g, 4), [[2, 3]]);
  var p = P(['00B0', '2342', '3423', '4234']);
  assert.strictEqual(G.hasMove(p.grid, 4, p.fx), false);
  assert.strictEqual(G.hasMove(p.grid, 4), true, 'uden is ville byttet være muligt');
});

// ---------- Niveau 5: sten ----------
test('sten: kan ikke byttes og knuses af en stribe ved siden af (+1 træk, 30 point)', function () {
  var run = G.createRun('6x6', { seed: 4 });
  var p = P(['#01234', '012345', '234501', '345012', '450123', '501234']);
  run._load(p.grid, 10, 0, p.fx);
  assert.strictEqual(run.swap(0, 1).reason, 'sten');
  var q = P(['A01234', '123450', '234501', '345012', '450123', '501234']);
  run._load(q.grid, 10, 0, q.fx);
  assert.strictEqual(run.swap(0, 1).reason, 'is');
  // 111 i række 1, lige under stenen
  var r = G.resolve(G.fromRows(['23#52', '31112', '24345', '45234', '52345']), null, 5, 6, noRuns6(), { level: 5 });
  assert.deepStrictEqual(r.steps[0].crushed, [2]);
  assert.strictEqual(r.steps[0].earned, G.RULES.earnStone);
  assert.strictEqual(r.steps[0].points, 3 * 10 + G.RULES.pointsStone);
});

// ---------- Niveau 6: opgaver ----------
test('opgave klaret giver bonustræk og en ny opgave', function () {
  var run = G.createRun('6x6', { seed: 21 });
  run._level(6);
  var t0 = run.state.task;
  assert.ok(t0, 'niveau 6 giver en opgave');
  assert.strictEqual(t0.left, G.RULES.taskMoves);
  assert.ok(['fjern', 'is', 'sten'].indexOf(t0.kind) >= 0);
  var m = run.hint();
  var sg = run.state.grid.slice(); var x = sg[m[0]]; sg[m[0]] = sg[m[1]]; sg[m[1]] = x;
  var type = G.findGroups(sg, 6)[0].type;
  run._task({ kind: 'fjern', type: type, goal: 1, progress: 0, left: 5, moves: 5, reward: G.RULES.taskReward, id: 99 });
  var mv = run.state.moves, L = run.state.level;
  var r = run.swap(m[0], m[1]);
  assert.ok(r.task && r.task.done);
  assert.strictEqual(r.taskMoves, G.RULES.taskReward);
  var lvMoves = (run.state.level - L) * G.RULES.levelMoves;
  assert.strictEqual(run.state.moves, mv - 1 + r.earned + G.RULES.taskReward + lvMoves);
  assert.ok(run.state.task && run.state.task.id !== 99, 'ny opgave');
  assert.strictEqual(run.state.tasksDone, 1);
});
test('opgave ikke klaret: ingen straf, bare en ny opgave', function () {
  var run = G.createRun('6x6', { seed: 22 });
  run._level(6);
  run._task({ kind: 'fjern', type: 0, goal: 99, progress: 0, left: 1, moves: 5, reward: 3, id: 77 });
  var mv = run.state.moves, L = run.state.level;
  var m = run.hint(), r = run.swap(m[0], m[1]);
  assert.ok(r.task && r.task.failed);
  assert.strictEqual(r.taskMoves, 0);
  assert.strictEqual(run.state.moves, mv - 1 + r.earned + (run.state.level - L) * G.RULES.levelMoves);
  assert.ok(run.state.task.id !== 77);
  assert.strictEqual(run.state.tasksFailed, 1);
});
test('opgaverne: fjern N af en type, bryd is eller knus sten – målene kan nås', function () {
  for (var seed = 1; seed <= 40; seed++) {
    var run = G.createRun('7x7', { seed: seed });
    run._level(6 + seed % 8);
    var s = run.state, t = G.makeTask(s, G.rng(seed));
    assert.ok(t.goal >= 1 && t.left === G.RULES.taskMoves && t.reward === G.RULES.taskReward);
    if (t.kind === 'is') assert.ok(t.goal <= s.fx.filter(function (f) { return f & G.IS; }).length);
    if (t.kind === 'sten') assert.ok(t.goal <= s.grid.filter(function (v) { return v === G.STEN; }).length);
    if (t.kind === 'fjern') assert.ok(s.grid.indexOf(t.type) >= 0, 'typen findes på brættet');
  }
});

// ---------- Niveauer ----------
test('pointmålet stiger for hvert niveau og skalerer med brættet', function () {
  assert.strictEqual(G.goal(1, 6), G.RULES.goalFirst);
  var prevStep = 0;
  for (var L = 2; L <= 15; L++) {
    var step = G.goal(L, 6) - G.goal(L - 1, 6);
    assert.ok(step > prevStep, 'hvert niveau kræver flere point end det forrige');
    prevStep = step;
  }
  assert.ok(G.goal(3, 8) > G.goal(3, 7) && G.goal(3, 7) > G.goal(3, 6));
});
test('nyt niveau: målet nås, +5 træk, og elementet meldes', function () {
  var run = G.createRun('6x6', { seed: 31 });
  run._load(run.state.grid, 10, run.state.goal - 1);
  var m = run.hint(), r = run.swap(m[0], m[1]);
  assert.strictEqual(r.levels.length, 1);
  assert.strictEqual(r.levels[0].level, 2);
  assert.strictEqual(r.levels[0].element, 'lyn');
  assert.strictEqual(run.state.level, 2);
  assert.strictEqual(run.state.moves, 10 - 1 + r.earned + G.RULES.levelMoves);
  assert.strictEqual(run.state.goal, G.goal(2, 6));
  assert.deepStrictEqual(Object.keys(G.ELEMENTS).map(function (k) { return G.ELEMENTS[k]; }), ['lyn', 'stjerne', 'is', 'sten', 'opgave']);
});
test('niveau 4 lægger is, niveau 5 sten, niveau 8 giver en syvende juvel', function () {
  var run = G.createRun('7x7', { seed: 41 });
  var ev = run._level(4);
  assert.ok(ev[2].ice.length > 0 && run.state.fx.some(function (f) { return f & G.IS; }));
  ev = run._level(5);
  assert.ok(ev[0].stones.length > 0 && run.state.grid.indexOf(G.STEN) >= 0);
  assert.strictEqual(run.k, 6);
  ev = run._level(8);
  assert.strictEqual(ev[ev.length - 1].element, 'rav');
  assert.strictEqual(run.k, 7);
});
test('et nyt niveau starter aldrig uden et muligt byt (is, sten og stjerner tæller med)', function () {
  G.SIZE_ORDER.forEach(function (id) {
    for (var seed = 1; seed <= 40; seed++) {
      var run = G.createRun(id, { seed: seed });
      for (var L = 2; L <= 14; L++) {
        run._level(L);
        assert.ok(G.hasMove(run.state.grid, run.n, run.state.fx), id + ' frø ' + seed + ' niveau ' + L);
        assert.strictEqual(G.hasRun(run.state.grid, run.n), false);
        // spil et par byt, så brættet ændrer sig
        for (var k = 0; k < 3 && !run.state.over; k++) { var m = run.hint(); run._load(run.state.grid, 50, undefined, run.state.fx); run.swap(m[0], m[1]); }
        if (run.state.over) break;
      }
    }
  });
});
test('højst ' + G.RULES.maxEarn + ' træk tilbage pr. byt fra kombinationer (sten tæller ud over)', function () {
  for (var seed = 1; seed <= 30; seed++) {
    var run = G.createRun('8x8', { seed: seed });
    for (var i = 0; i < 60 && !run.state.over; i++) {
      var m = run.hint(), r = run.swap(m[0], m[1]);
      assert.ok(r.earned - r.crushed * G.RULES.earnStone <= G.RULES.maxEarn);
    }
  }
});
test('høje niveauer: nye juveler kan falde ned frosne', function () {
  assert.strictEqual(G.RULES.iceSpawn(6), 0);
  assert.ok(G.RULES.iceSpawn(9) > 0);
  var g = G.fromRows(['000', '123', '451']);
  var c = G.collapse(g, null, 3, [0, 1, 2], 6, seq([1, 0, 2, 0, 3, 0]), { ice: 1, stone: 0 });
  assert.ok(c.fx[0] & G.IS && c.fx[1] & G.IS && c.fx[2] & G.IS);
});

// ---------- Rekorder med niveau ----------
test('rekorder gemmer point, niveau og byt – gamle rekorder uden niveau virker stadig', function () {
  var store = {};
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); } };
  require('../../arkade/highscores.js');
  var hs = globalThis.ArkadeHighscores.create('juveler-test', { max: 10 });
  hs.add('6x6', 900, { levels: 31 });                         // gammel rekord (fase 1–2)
  var res = hs.add('6x6', 2400, G.recordExtra({ score: 2400, swaps: 57, level: 4 }));
  assert.strictEqual(res.rank, 1);
  var l = hs.list('6x6');
  assert.strictEqual(l[0].niveau, 4); assert.strictEqual(l[0].levels, 57);
  assert.strictEqual(G.recordLabel(l[0]), ' · niv. 4 · 57 byt');
  assert.strictEqual(G.recordLabel(l[1]), ' · 31 byt');
  assert.strictEqual(hs.list('7x7').length, 0, 'pr. brætstørrelse');
  var run = G.createRun('6x6', { seed: 1 }); run._level(3);
  assert.strictEqual(run.end().level, 3);
});

// ---------- Indstillingen "Vis introkort for nye elementer" ----------
test('introkort: til viser et kort pr. nyt element, fra viser ingen (kun note)', function () {
  var run = G.createRun('6x6', { seed: 51 });
  var evs = run._level(3).concat(run._level(4));          // lyn, stjerne og is
  var shown = G.introEvents(evs, true).map(function (e) { return e.element; });
  assert.deepStrictEqual(shown, ['lyn', 'stjerne', 'is']);
  assert.deepStrictEqual(G.introEvents(evs, false), []);
  assert.deepStrictEqual(G.introEvents(run._level(8).slice(-1), true).map(function (e) { return e.element; }), ['rav']);
  assert.ok(G.introEvents([{ level: 7, element: null }], true).length === 0, 'niveau uden nyt element: intet kort');
  // spillet er det samme med og uden kort: niveau, træk og bræt påvirkes ikke
  assert.strictEqual(run.state.level, 8);
});
test('introkort-indstillingen gemmes via arkade/settings.js (standard: til)', function () {
  var store = {};
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
  require('../../arkade/settings.js');
  var a = globalThis.ArkadeSettings.create('juveler-introtest', { introKort: true });
  assert.strictEqual(a.get('introKort'), true, 'standard: til');
  a.set('introKort', false);
  var b = globalThis.ArkadeSettings.create('juveler-introtest', { introKort: true });
  assert.strictEqual(b.get('introKort'), false, 'valget huskes');
});

var fail = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('ok   ' + t.name); }
  catch (e) { fail++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + (tests.length - fail) + ' af ' + tests.length + ' test bestået');
process.exit(fail ? 1 : 0);
