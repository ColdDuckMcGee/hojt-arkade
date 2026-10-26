/*
 * Frøen – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node froeen/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.FroeenGame;

// Fast "tilfældighed", så testene altid giver det samme.
function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Hjælper: en bane, hvor vi selv bestemmer en række. objs = [[start, len], ...]
function setLane(run, y, kind, dir, objs, opts) {
  opts = opts || {};
  var lane = run.laneAt(y);
  lane.kind = kind; lane.dir = dir; lane.period = opts.period || 1; lane.phase = opts.phase || 0;
  lane.ring = opts.ring || 16; lane.offset = 0;
  lane.objs = objs.map(function (o) { return { start: o[0], len: o[1] }; });
  return lane;
}
// Ryd vejen (ingen biler) og læg én lang stamme i hver flodbane, der står stille.
function calmRun(mode) {
  var run = G.createRun(mode || '3', { rng: seeded(5) });
  G.ROAD.forEach(function (y) { setLane(run, y, 'car', -1, [[14, 1]], { ring: 16, period: 99, phase: 98 }); });
  G.RIVER.forEach(function (y) { setLane(run, y, 'log', 1, [[0, 11]], { ring: 16, period: 99, phase: 98 }); });
  return run;
}
function frogAt(run, x, y) { run.state.frog = { x: x, y: y }; run.state.bestY = Math.min(run.state.bestY, y); }

test('brættet: 11 × 13, fem huller, vej og flod med fem baner hver', function () {
  var run = G.createRun('3', { rng: seeded(1) });
  var s = run.state;
  assert.strictEqual(s.cols, 11); assert.strictEqual(s.rows, 13);
  assert.deepStrictEqual(G.HOLES, [1, 3, 5, 7, 9]);
  assert.strictEqual(s.holes.length, 5);
  assert.strictEqual(s.lanes.length, 10);
  G.ROAD.forEach(function (y) { assert.strictEqual(run.laneAt(y).kind, 'car'); });
  G.RIVER.forEach(function (y) { assert.ok(['log', 'turtle'].indexOf(run.laneAt(y).kind) >= 0); });
  assert.strictEqual(G.rowKind(0), 'top'); assert.strictEqual(G.rowKind(6), 'median'); assert.strictEqual(G.rowKind(12), 'start');
  assert.deepStrictEqual(s.frog, { x: 5, y: 12 });
  assert.strictEqual(s.lives, 3);
  assert.strictEqual(G.createRun('1').state.lives, 1);
  // nabobaner kører hver sin vej, og ingen bil står tættere end 2 felter på den næste
  for (var lvl = 1; lvl <= 15; lvl++) {
    var r = G.createRun('3', { rng: seeded(lvl), level: lvl });
    r.state.lanes.forEach(function (l) {
      assert.ok(l.ring >= G.RULES.minRing);
      l.objs.forEach(function (o, i) {
        var nxt = l.objs[(i + 1) % l.objs.length];
        var gap = ((nxt.start - (o.start + o.len)) % l.ring + l.ring) % l.ring;
        if (l.kind === 'car') assert.ok(gap >= 2, 'mindst 2 felter mellem biler (bane ' + lvl + ')');
        else assert.ok(gap >= 1, 'vand mellem stammer');
      });
    });
  }
});

test('bevægelse: ét hop pr. træk, ingen hop ud over brættet', function () {
  var run = calmRun();
  assert.strictEqual(run.canMove('down'), false, 'kan ikke gå ned fra startrækken');
  assert.strictEqual(run.canMove('up'), true);
  run.act('left'); assert.deepStrictEqual(run.state.frog, { x: 4, y: 12 });
  run.act('right'); run.act('right'); assert.deepStrictEqual(run.state.frog, { x: 6, y: 12 });
  frogAt(run, 0, 12); assert.strictEqual(run.canMove('left'), false);
  frogAt(run, 10, 12); assert.strictEqual(run.canMove('right'), false);
  var before = run.state.turn;
  assert.ok(run.act('left').events.indexOf('hop') >= 0);
  assert.strictEqual(run.state.turn, before + 1, 'et hop er ét træk');
  run.act('wait');
  assert.strictEqual(run.state.turn, before + 2, 'Vent er ét træk');
  assert.ok(run.act('fly').ignored);
});

test('banerne rykker ét felt pr. træk; langsomme baner kun hvert andet', function () {
  var run = calmRun();
  var a = setLane(run, 9, 'car', 1, [[0, 1]], { ring: 16 });
  var b = setLane(run, 8, 'car', -1, [[5, 1]], { ring: 16, period: 2, phase: 0 });
  run.state.turn = 0;
  assert.strictEqual(run.movesNext(a), true);
  assert.strictEqual(run.movesNext(b), false, 'næste træk er nr. 1 – den langsomme bane står');
  assert.strictEqual(run.nextOffset(a), 1);
  run.act('wait');
  assert.strictEqual(a.offset, 1); assert.strictEqual(b.offset, 0);
  run.act('wait');
  assert.strictEqual(a.offset, 2); assert.strictEqual(b.offset, 15);
  assert.ok(run.objAt(a, 2)); assert.ok(!run.objAt(a, 1));
  assert.ok(run.objAt(b, 4), 'bilen kører mod venstre');
  // ringen: bilen kører ud i højre side og kommer ind i venstre
  a.offset = 15; assert.ok(!run.objAt(a, 0), 'bilen er lige uden for brættet');
  run.act('wait'); assert.strictEqual(a.offset, 0); assert.ok(run.objAt(a, 0));
});

test('kollision: hop ind i en bil, og en bil der kører ind i frøen', function () {
  var run = calmRun();
  setLane(run, 11, 'car', 1, [[5, 1]]);
  var ev = run.act('up');
  assert.ok(ev.events.indexOf('died') >= 0); assert.strictEqual(ev.cause, 'bil');
  assert.strictEqual(run.state.lives, 2);
  // bilen står lige bag feltet: frøen hopper ind, bilen kører ind i den
  var run2 = calmRun();
  setLane(run2, 11, 'car', 1, [[4, 1]]);
  var ev2 = run2.act('up');
  assert.strictEqual(ev2.cause, 'bil');
  // bilen kører væk fra frøen: sikkert
  var run3 = calmRun();
  setLane(run3, 11, 'car', -1, [[4, 1]]);
  var ev3 = run3.act('up');
  assert.ok(ev3.events.indexOf('died') < 0);
  assert.strictEqual(run3.simulate('wait'), null, 'at vente er sikkert, bilen er kørt forbi');
  // simulate ændrer ikke noget
  assert.deepStrictEqual(run3.state.frog, { x: 5, y: 11 });
});

test('floden: vand dræber, stammen bærer frøen med sig', function () {
  var run = calmRun();
  frogAt(run, 5, 6);
  setLane(run, 5, 'log', 1, [[7, 3]]);
  var ev = run.act('up');
  assert.strictEqual(ev.cause, 'vand');
  var run2 = calmRun();
  frogAt(run2, 5, 6);
  setLane(run2, 5, 'log', 1, [[4, 3]]);   // dækker 4–6
  var ev2 = run2.act('up');
  assert.ok(ev2.events.indexOf('died') < 0);
  assert.ok(ev2.events.indexOf('carried') >= 0);
  assert.deepStrictEqual(run2.state.frog, { x: 6, y: 5 }, 'frøen følger stammen');
  run2.act('wait');
  assert.deepStrictEqual(run2.state.frog, { x: 7, y: 5 });
  // hop af stammen og ud i vandet
  var ev3 = run2.act('right');
  assert.ok(ev3.events.indexOf('died') < 0, 'stammen dækker 6–8, frøen lander på 8');
  assert.strictEqual(run2.state.frog.x, 9);
  var ev4 = run2.act('right');  // lander på 10 – stammen dækker 7–9 → vand
  assert.strictEqual(ev4.cause, 'vand');
  // skildpadder bærer også
  var run3 = calmRun();
  frogAt(run3, 5, 6);
  setLane(run3, 5, 'turtle', -1, [[5, 2]]);
  run3.act('up');
  assert.deepStrictEqual(run3.state.frog, { x: 4, y: 5 });
  assert.strictEqual(run3.state.dead, false);
});

test('kanten: stammen fører frøen ud over kanten', function () {
  var run = calmRun();
  frogAt(run, 10, 6);
  setLane(run, 5, 'log', 1, [[8, 4]], { ring: 16 });   // dækker 8–11 (11 er uden for brættet)
  var ev = run.act('up');
  assert.strictEqual(ev.cause, 'kant');
  assert.strictEqual(run.state.dead, true);
  // venstre kant
  var run2 = calmRun();
  frogAt(run2, 0, 6);
  setLane(run2, 5, 'turtle', -1, [[0, 2]], { ring: 16 });
  assert.strictEqual(run2.act('up').cause, 'kant');
});

test('huller: ledigt hul fyldes, og frøen starter forfra', function () {
  var run = calmRun();
  frogAt(run, 3, 1);
  var score0 = run.state.score;
  var ev = run.act('up');
  assert.ok(ev.events.indexOf('hole') >= 0);
  assert.strictEqual(ev.hole, 1);
  assert.strictEqual(run.state.holes[1], true);
  assert.deepStrictEqual(run.state.frog, { x: 5, y: 12 }, 'frøen starter forfra i bunden');
  assert.strictEqual(run.state.score - score0, G.RULES.pointsStep + G.RULES.pointsHole);
  assert.strictEqual(run.topAt(3), 'optaget'); assert.strictEqual(run.topAt(4), 'mur'); assert.strictEqual(run.topAt(5), 'hul');
});

test('mur og optaget hul: pil op er slået fra, og hoppet afvises uden træk og uden livstab', function () {
  var run = calmRun();
  frogAt(run, 3, 1); run.act('up');               // hul 1 (x = 3) er nu optaget
  [[3, 'optaget'], [4, 'mur'], [0, 'mur'], [10, 'mur']].forEach(function (c) {
    frogAt(run, c[0], 1);
    var before = JSON.stringify(run.state);
    assert.strictEqual(run.blocked('up'), c[1], 'x=' + c[0]);
    assert.strictEqual(run.canMove('up'), false, 'pil op er slået fra ved x=' + c[0]);
    assert.strictEqual(run.simulate('up'), 'ugyldigt');
    var ev = run.act('up');
    assert.ok(ev.ignored, 'hoppet afvises');
    assert.strictEqual(ev.blocked, c[1]);
    assert.strictEqual(ev.cause, undefined, 'ingen dødsårsag');
    assert.strictEqual(JSON.stringify(run.state), before, 'intet har flyttet sig, ingen tur, ingen point');
    assert.strictEqual(run.state.lives, 3, 'intet liv er mistet');
    assert.strictEqual(run.state.dead, false);
  });
  // under et ledigt hul er pil op slået til
  frogAt(run, 5, 1);
  assert.strictEqual(run.blocked('up'), null);
  assert.strictEqual(run.canMove('up'), true);
  // andre retninger er ikke berørt af muren
  frogAt(run, 4, 1);
  assert.strictEqual(run.blocked('left'), null);
  assert.strictEqual(run.blocked('down'), null);
});

test('banskift: alle fem huller giver bonus og en sværere bane', function () {
  var run = calmRun();
  var p1 = G.levelPlan(1), p6 = G.levelPlan(6);
  [1, 3, 5, 7].forEach(function (x) { frogAt(run, x, 1); run.act('up'); });
  assert.strictEqual(run.state.cleared, false);
  frogAt(run, 9, 1);
  var before = run.state.score;
  var ev = run.act('up');
  assert.ok(ev.events.indexOf('cleared') >= 0);
  assert.strictEqual(ev.bonus, G.levelBonus(1));
  assert.strictEqual(run.state.score - before, G.RULES.pointsStep + G.RULES.pointsHole + G.levelBonus(1));
  assert.strictEqual(run.playable(), false, 'intet træk, før næste bane er valgt');
  run.nextLevel();
  assert.strictEqual(run.state.level, 2);
  assert.strictEqual(run.state.levelsCleared, 1);
  assert.ok(run.state.holes.every(function (h) { return !h; }));
  assert.deepStrictEqual(run.state.frog, { x: 5, y: 12 });
  assert.strictEqual(G.levelBonus(3), 3 * G.RULES.levelBonus);
  // sværere: længere køretøjer, færre langsomme baner, kortere stammer, bredere vand
  var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  assert.ok(sum(p6.carLen) > sum(p1.carLen));
  assert.ok(sum(p6.roadPeriod) < sum(p1.roadPeriod));
  assert.ok(sum(p6.logLen) < sum(p1.logLen));
  assert.ok(p6.waterGap[1] > p1.waterGap[1]);
  assert.ok(p6.turtleLen <= p1.turtleLen);
  // flere biler på vejen
  function cars(level) { var t = 0; for (var sd = 1; sd <= 20; sd++) G.createRun('3', { rng: seeded(sd), level: level }).state.lanes.forEach(function (l) { if (l.kind === 'car') l.objs.forEach(function (o) { t += o.len / l.ring; }); }); return t; }
  assert.ok(cars(6) > cars(1), 'mere af vejen er dækket af biler');
});

test('point: kun nye skridt fremad i dette forsøg tæller', function () {
  var run = calmRun();
  run.act('up'); assert.strictEqual(run.state.score, 10);
  run.act('down'); run.act('up'); assert.strictEqual(run.state.score, 10, 'samme række igen giver intet');
  run.act('up'); assert.strictEqual(run.state.score, 20);
  run.act('left'); run.act('wait'); assert.strictEqual(run.state.score, 20);
  // efter et mistet liv tæller rækkerne igen
  setLane(run, 9, 'car', 1, [[4, 1]]);
  run.act('up'); assert.strictEqual(run.state.dead, true);
  assert.strictEqual(run.state.score, 30);
  run.respawn();
  setLane(run, 9, 'car', -1, [[14, 1]], { period: 99, phase: 98 });
  run.act('up'); assert.strictEqual(run.state.score, 40);
});

test('liv: tre eller ét, respawn i bunden og game over', function () {
  var run = calmRun('3');
  setLane(run, 11, 'car', 1, [[5, 1]], { period: 99, phase: 98 });
  for (var i = 0; i < 3; i++) {
    var ev = run.act('up');
    assert.strictEqual(ev.cause, 'bil');
    assert.strictEqual(run.playable(), false);
    assert.ok(run.act('left').ignored, 'intet sker, mens frøen er død');
    if (i < 2) { assert.ok(run.respawn()); assert.deepStrictEqual(run.state.frog, { x: 5, y: 12 }); }
  }
  assert.strictEqual(run.state.lives, 0);
  assert.strictEqual(run.state.over, true);
  assert.strictEqual(run.respawn(), false);
  var one = calmRun('1');
  setLane(one, 11, 'car', 1, [[5, 1]], { period: 99, phase: 98 });
  var e1 = one.act('up');
  assert.ok(e1.events.indexOf('over') >= 0);
});

// Kan banen klares? Bredde-først søgning over (træk, x, y): banerne er
// forudsigelige og afhænger ikke af frøen, så vi prøver alle træk fra alle
// felter, frøen kan nå. Målet er et ledigt hul.
function reachable(run, maxTurns) {
  var world = clone(run.state), front = {};
  front[world.frog.x + ',' + world.frog.y] = true;
  for (var t = 0; t < maxTurns; t++) {
    var nextFront = {}, keys = Object.keys(front), worldAfter = null;
    for (var k = 0; k < keys.length; k++) {
      var p = keys[k].split(',').map(Number);
      var acts = ['up', 'down', 'left', 'right', 'wait'];
      for (var a = 0; a < acts.length; a++) {
        var st = clone(world); st.frog = { x: p[0], y: p[1] }; st.bestY = 12;
        run._setState(st);
        var ev = run.act(acts[a]);
        if (ev.ignored || ev.cause) continue;
        if (ev.events.indexOf('hole') >= 0) return t + 1;
        nextFront[st.frog.x + ',' + st.frog.y] = true;
        if (acts[a] === 'wait' && !worldAfter) worldAfter = st;
      }
    }
    if (!worldAfter) { var w = clone(world); w.frog = { x: 5, y: 12 }; run._setState(w); run.act('wait'); worldAfter = w; }
    world = clone(worldAfter);
    front = nextFront;
    if (!Object.keys(front).length) return -1;
  }
  return -1;
}
test('alle baner kan klares (søgning på bane 1–15)', function () {
  var worst = 0;
  for (var lvl = 1; lvl <= 15; lvl++) for (var sd = 1; sd <= 6; sd++) {
    var run = G.createRun('3', { rng: seeded(sd * 31 + lvl), level: lvl });
    var n = reachable(run, 160);
    assert.ok(n > 0, 'bane ' + lvl + ' (frø ' + sd + ') kan ikke nås');
    worst = Math.max(worst, n);
  }
  console.log('    (længste korteste vej til et hul: ' + worst + ' træk)');
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK   ' + t.name); }
  catch (e) { failed++; console.log('FEJL ' + t.name + '\n     ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n     ') : e)); }
});
console.log(failed ? '\n' + failed + ' af ' + tests.length + ' test fejlede' : '\nAlle ' + tests.length + ' test bestod');
process.exit(failed ? 1 : 0);
