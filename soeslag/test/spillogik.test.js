/*
 * Søslag – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node soeslag/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.SoeslagGame;

// Fast "tilfældighed", så testene altid giver det samme.
function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

function touches(n, a, b) {
  return a.cells.some(function (i) { return b.cells.some(function (j) {
    return Math.abs(i % n - j % n) <= 1 && Math.abs(Math.floor(i / n) - Math.floor(j / n)) <= 1; }); });
}
function fleetAt(n, list) { // [[id, x, y, vandret], ...]
  return list.map(function (e) { var d = G.FLEET.filter(function (f) { return f.id === e[0]; })[0]; return G.makeShip(d, n, e[1], e[2], e[3]); });
}
// En fast flåde på 8 × 8, som ikke rører sig selv
var FAST8 = [['slagskib', 0, 0, true], ['krydser', 5, 0, false], ['fregat', 0, 2, false], ['korvet', 2, 7, true], ['patrulje', 6, 6, true]];

test('flåden: fem skibe på 4, 3, 3, 2 og 2 felter', function () {
  assert.deepStrictEqual(G.FLEET.map(function (s) { return s.len; }), [4, 3, 3, 2, 2]);
  assert.strictEqual(G.FLEET_CELLS, 14);
  assert.strictEqual(G.SIZES[G.DEFAULT_SIZE].n, 8);
  assert.deepStrictEqual(G.LEVEL_ORDER.map(function (l) { return G.LEVELS[l].name; }), ['Rolig', 'Normal', 'Svær']);
});

test('tilfældig placering: altid på brættet, uden overlap og uden at skibene rører hinanden', function () {
  var rng = seeded(7);
  [8, 10].forEach(function (n) {
    for (var t = 0; t < 300; t++) {
      var ships = G.randomFleet(n, rng);
      assert.strictEqual(ships.length, 5);
      assert.ok(G.validFleet(n, ships));
      ships.forEach(function (s) {
        assert.strictEqual(s.cells.length, s.len);
        s.cells.forEach(function (i) { assert.ok(i >= 0 && i < n * n); });
      });
      for (var a = 0; a < ships.length; a++) for (var b = a + 1; b < ships.length; b++) assert.ok(!touches(n, ships[a], ships[b]), 'skibe rører hinanden');
    }
  });
});

test('placering: et skib kan ikke ligge ved siden af et andet, heller ikke på skrå', function () {
  var ships = fleetAt(8, FAST8);
  assert.ok(G.validFleet(8, ships));
  // Ved siden af slagskibet (række 2)
  assert.strictEqual(G.canPlace(8, ships, 2, 2, 1, true, 'patrulje'), false);
  // På skrå af slagskibets hale (4, 0) -> (4, 1)? (4,1) ligger lige under (3,0) på skrå
  assert.strictEqual(G.canPlace(8, ships, 2, 4, 1, false, 'patrulje'), false);
  // Et frit sted
  assert.strictEqual(G.canPlace(8, ships, 2, 2, 4, true, 'patrulje'), true);
  // Udenfor brættet
  assert.strictEqual(G.canPlace(8, ships, 4, 6, 3, true), false);
  assert.deepStrictEqual(G.fitPos(8, 4, 6, 3, true), { x: 4, y: 3 });
  assert.deepStrictEqual(G.fitPos(8, 3, 2, 7, false), { x: 2, y: 5 });
});

test('selv placere: vælg skib, felt og retning – Læg flytter kun til lovlige felter', function () {
  var run = G.createRun('8x8', 'normal', { rng: seeded(3) });
  run._setFleets(fleetAt(8, FAST8));
  var pv = run.previewMove('patrulje', 3, 3, false);
  assert.ok(pv.ok); assert.deepStrictEqual(pv.cells, [27, 35]);
  assert.ok(run.moveShip('patrulje', 3, 3, false).ok);
  assert.deepStrictEqual(run.shipById('patrulje').cells, [27, 35]);
  // Et skib må gerne flyttes ind over sin egen gamle plads
  assert.ok(run.moveShip('patrulje', 2, 4, true).ok);
  assert.ok(run.moveShip('patrulje', 3, 4, true).ok);
  // Ulovligt: rører krydseren
  assert.strictEqual(run.moveShip('patrulje', 4, 1, true).ok, false);
  assert.deepStrictEqual(run.shipById('patrulje').cells, [35, 36]);
  // Kanten: skubbes ind
  var edge = run.previewMove('slagskib', 7, 7, true);
  assert.strictEqual(edge.x, 4);
  // Bland igen giver en ny, lovlig flåde
  assert.ok(run.shuffle());
  assert.ok(G.validFleet(8, run.state.fleet));
});

test('skud: plask, ramt og sænket – og samme felt kan ikke skydes to gange', function () {
  var sea = G.createSea(8, fleetAt(8, FAST8));
  var r = G.fire(sea, 7 * 8 + 7);
  assert.strictEqual(r.result, 'miss'); assert.strictEqual(sea.shots[63], G.MISS);
  assert.strictEqual(G.fire(sea, 63).ok, false);
  assert.strictEqual(sea.count, 1);
  r = G.fire(sea, 6 * 8 + 6); assert.strictEqual(r.result, 'hit'); assert.strictEqual(sea.shots[54], G.HIT);
  r = G.fire(sea, 6 * 8 + 7); assert.strictEqual(r.result, 'sunk'); assert.strictEqual(r.ship.id, 'patrulje');
  assert.strictEqual(sea.shots[54], G.SUNK); assert.strictEqual(sea.shots[55], G.SUNK);
  assert.ok(!r.allSunk);
  var v = G.viewOf(sea);
  assert.deepStrictEqual(v.remaining, [4, 3, 3, 2]);
  assert.ok(!('ships' in v) && !('map' in v), 'computeren må ikke se skibene');
});

test('sejr: alle skibe sænket giver sejr, point og en ny kamp; turene skifter efter hvert skud', function () {
  var run = G.createRun('8x8', 'normal', { rng: seeded(5) });
  run._setFleets(fleetAt(8, FAST8), fleetAt(8, FAST8));
  assert.strictEqual(run.playerFire(0).ok, false, 'kan ikke skyde under placering');
  assert.ok(run.begin());
  var s = run.state, targets = [];
  s.enemy.ships.forEach(function (sh) { targets = targets.concat(sh.cells); });
  var free = [];
  for (var i = 0; i < 64; i++) if (s.enemy.map[i] < 0 && s.fleet.every(function () { return true; })) free.push(i);
  // Computeren skyder kun på felter uden skibe, så den aldrig vinder her
  var aiFree = free.slice();
  var last;
  targets.forEach(function (t) {
    assert.strictEqual(s.turn, 'player');
    last = run.playerFire(t);
    assert.ok(last.ok);
    assert.strictEqual(run.playerFire(t === 0 ? 1 : 0).ok, false, 'to skud i træk er ikke tilladt');
    if (!last.allSunk) { assert.strictEqual(s.turn, 'ai'); assert.ok(run.aiFire(aiFree.shift()).ok); }
  });
  assert.ok(last.allSunk);
  assert.strictEqual(s.phase, 'won'); assert.strictEqual(s.wins, 1);
  assert.strictEqual(s.shots, 14);
  var expect = 5 * 20 + 100 + 10 * (64 - 14);
  assert.strictEqual(s.score, expect);
  assert.strictEqual(G.winPoints(8, 14), 600);
  assert.strictEqual(G.winPoints(10, 40), 700);
  assert.ok(run.nextMatch());
  assert.strictEqual(s.match, 2); assert.strictEqual(s.phase, 'place'); assert.strictEqual(s.shots, 0);
  assert.strictEqual(s.score, expect, 'pointene følger med til næste kamp');
});

test('nederlag: spillet slutter første gang, computeren sænker hele flåden', function () {
  var run = G.createRun('8x8', 'rolig', { rng: seeded(9) });
  run._setFleets(fleetAt(8, FAST8), fleetAt(8, FAST8));
  run.begin();
  var s = run.state, mine = [], miss = [];
  s.home.ships.forEach(function (sh) { mine = mine.concat(sh.cells); });
  for (var i = 0; i < 64; i++) if (s.enemy.map[i] < 0) miss.push(i);
  var res;
  while (!s.over) { run.playerFire(miss.shift()); res = run.aiFire(mine.shift()); }
  assert.ok(res.allSunk); assert.strictEqual(s.phase, 'lost'); assert.ok(s.over);
  assert.strictEqual(s.wins, 0); assert.strictEqual(s.score, 0);
  assert.strictEqual(run.nextMatch(), false);
  assert.strictEqual(run.playerFire(miss.shift()).ok, false);
});

// Lader computeren skyde mod en flåde, til den er sænket. Giver antal skud.
function aiGame(level, n, rng) {
  var sea = G.createSea(n, G.randomFleet(n, rng)), shots = 0;
  while (!sea.ships.every(function (s) { return s.sunk; })) {
    var v = G.viewOf(sea), i = G.aiPick(level, v, rng);
    assert.strictEqual(v.shots[i], G.NONE, level + ' skød på et felt, der allerede var skudt på');
    G.fire(sea, i); shots++;
    assert.ok(shots <= n * n);
  }
  return shots;
}

test('computeren: skyder aldrig to gange på samme felt og sænker altid hele flåden', function () {
  var rng = seeded(21);
  G.LEVEL_ORDER.forEach(function (l) { [8, 10].forEach(function (n) { for (var t = 0; t < 15; t++) aiGame(l, n, rng); }); });
});

test('Normal (jagt og mål): efter et ramt felt skydes der på et nabofelt, og langs linjen efter to', function () {
  var rng = seeded(4);
  for (var t = 0; t < 30; t++) {
    var v = { n: 8, shots: new Array(64).fill(0), remaining: [4, 3, 3, 2, 2] };
    v.shots[27] = G.HIT; // D4
    var i = G.aiPick('normal', v, rng);
    assert.ok([26, 28, 19, 35].indexOf(i) >= 0, 'nabofelt, fik ' + i);
    v.shots[28] = G.HIT; // E4 – vandret linje
    i = G.aiPick('normal', v, rng);
    assert.ok([26, 29].indexOf(i) >= 0, 'enden af linjen, fik ' + i);
  }
  // Rundt om et sænket skib skydes der ikke (skibe rører aldrig hinanden)
  var w = { n: 8, shots: new Array(64).fill(0), remaining: [4, 3, 3, 2] };
  w.shots[0] = G.SUNK; w.shots[1] = G.SUNK;
  var b = G.blockedCells(w);
  [2, 8, 9, 10].forEach(function (c) { assert.ok(b[c], 'felt ' + c + ' er udelukket'); });
  for (var k = 0; k < 40; k++) assert.ok(!b[G.aiPick('normal', w, rng)]);
});

test('Svær (sandsynlighedskort): midten er varmest på et tomt bræt, og den følger et ramt felt', function () {
  var v = { n: 8, shots: new Array(64).fill(0), remaining: [4, 3, 3, 2, 2] };
  var heat = G.probabilityMap(v);
  assert.ok(heat[27] > heat[0], 'midten over hjørnet');
  v.shots[27] = G.HIT;
  var i = G.aiPick('svaer', v, seeded(1));
  assert.ok([26, 28, 19, 35].indexOf(i) >= 0, 'nabofelt, fik ' + i);
  // Plask på den ene side: den skyder på den anden
  v.shots[26] = G.MISS; v.shots[19] = G.MISS; v.shots[35] = G.MISS;
  assert.strictEqual(G.aiPick('svaer', v, seeded(2)), 28);
});

test('sværhedsgraderne: Svær bruger færrest skud, Rolig flest (gennemsnit af mange kampe)', function () {
  var avg = {};
  G.LEVEL_ORDER.forEach(function (l) {
    var rng = seeded(1234), sum = 0, N = 60;
    for (var t = 0; t < N; t++) sum += aiGame(l, 8, rng);
    avg[l] = sum / N;
  });
  console.log('     gennemsnit skud på 8 × 8: ' + JSON.stringify(avg));
  assert.ok(avg.svaer < avg.normal, 'svær < normal');
  assert.ok(avg.normal < avg.rolig, 'normal < rolig');
  assert.ok(avg.rolig > 50, 'rolig er tilfældig');
});

test('computeren snyder ikke: samme skudhistorik giver samme valg, uanset hvor skibene ligger', function () {
  var rngA = seeded(77), rngB = seeded(77);
  var seaA = G.createSea(8, G.randomFleet(8, seeded(1))), seaB = G.createSea(8, G.randomFleet(8, seeded(2)));
  // Begge have får de samme plask, så computeren ser det samme
  [0, 9, 18, 45, 63].forEach(function (i) { seaA.shots[i] = G.MISS; seaB.shots[i] = G.MISS; });
  G.LEVEL_ORDER.forEach(function (l) {
    var a = G.aiPick(l, { n: 8, shots: seaA.shots.slice(), remaining: [4, 3, 3, 2, 2] }, rngA);
    var b = G.aiPick(l, { n: 8, shots: seaB.shots.slice(), remaining: [4, 3, 3, 2, 2] }, rngB);
    assert.strictEqual(a, b, l);
  });
});

test('koordinater: A1 øverst til venstre', function () {
  assert.strictEqual(G.coord(8, 0), 'A1');
  assert.strictEqual(G.coord(8, 63), 'H8');
  assert.strictEqual(G.coord(10, 99), 'J10');
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('ok   ' + t.name); }
  catch (e) { failed++; console.log('FEJL ' + t.name + '\n     ' + (e && e.stack || e)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået');
process.exit(failed ? 1 : 0);
