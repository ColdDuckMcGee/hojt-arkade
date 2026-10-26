/*
 * Løberen – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node loeberen/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.LoeberenGame;

function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
var DIFFS = ['rolig', 'normal', 'svaer'];
function seg(lanes, coins) { return { id: 1, lanes: lanes, coins: coins || [false, false, false] }; }

// Spiller, der altid vælger et sikkert valg, der ikke er en blindgyde
function goodPlayer(run, rng) {
  var ok = G.ACTIONS.filter(function (a) { return run.possible(a) && run.safe(a) && !run.deadEnd(a); });
  assert.ok(ok.length > 0, 'ingen sikre valg uden blindgyde ved ' + run.state.meters + ' m: ' + JSON.stringify(run.next().lanes) + ' bane ' + run.state.lane);
  return ok[Math.floor(rng() * ok.length)];
}

test('regler: hvad er muligt og sikkert', function () {
  assert.strictEqual(G.possible(0, 'venstre'), false);
  assert.strictEqual(G.possible(2, 'hoejre'), false);
  assert.strictEqual(G.possible(1, 'venstre'), true);
  ['hop', 'dyk', 'bliv'].forEach(function (a) { assert.ok(G.possible(0, a) && G.possible(2, a)); });
  var s = seg(['fri', 'lav', 'hoej']);
  assert.ok(G.safe(s, 0, 'bliv') && G.safe(s, 0, 'hop') && G.safe(s, 0, 'dyk'), 'fri bane: alt er sikkert');
  assert.ok(G.safe(s, 1, 'hop') && !G.safe(s, 1, 'bliv') && !G.safe(s, 1, 'dyk'), 'lav barriere: kun hop');
  assert.ok(G.safe(s, 2, 'dyk') && !G.safe(s, 2, 'hop') && !G.safe(s, 2, 'bliv'), 'høj bjælke: kun dyk');
  assert.ok(G.safe(s, 1, 'venstre') && !G.safe(s, 1, 'hoejre'), 'man kan kun skifte til en fri bane');
  var t = seg(['tog', 'fri', 'tog']);
  ['hop', 'dyk', 'bliv'].forEach(function (a) { assert.ok(!G.safe(t, 0, a), 'tog: intet er sikkert (' + a + ')'); });
  assert.deepStrictEqual(G.safeActions(t, 0), ['hoejre']);
});

DIFFS.forEach(function (d) {
  test(d + ': hvert stop har mindst ét muligt og sikkert valg (20 × 400 stop)', function () {
    for (var s = 1; s <= 20; s++) {
      var rng = seeded(s * 7 + 3), pick = seeded(s * 13 + 1);
      var run = G.createRun(d, { rng: rng });
      for (var i = 0; i < 400; i++) {
        var safeNow = G.ACTIONS.filter(function (a) { return run.possible(a) && run.safe(a); });
        assert.ok(safeNow.length >= 1, 'intet sikkert valg');
        var a = goodPlayer(run, pick);
        var lives = run.state.lives, m = run.state.meters;
        var r = run.act(a);
        assert.ok(r.safe && !r.ignored, 'sikkert valg blev ikke godtaget');
        assert.strictEqual(run.state.lives, lives, 'sikkert valg må ikke koste liv');
        assert.strictEqual(run.state.meters, m + G.METERS, 'sikkert valg giver 10 m');
      }
      assert.strictEqual(run.state.lives, G.START_LIVES);
    }
  });
});

test('rolig: fra hver bane er der altid et sikkert valg (ingen blindgyder)', function () {
  for (var s = 1; s <= 20; s++) {
    var run = G.createRun('rolig', { rng: seeded(s) }), pick = seeded(s + 100);
    for (var i = 0; i < 300; i++) {
      run.state.segs.forEach(function (sg) {
        for (var l = 0; l < 3; l++) assert.ok(G.safeActions(sg, l).length > 0, 'rolig: bane ' + l + ' er fanget: ' + JSON.stringify(sg.lanes));
      });
      run.act(goodPlayer(run, pick));
    }
  }
});

test('normal og svær: blindgyder findes, men der er altid en vej ud, man kan se', function () {
  ['normal', 'svaer'].forEach(function (d) {
    var traps = 0;
    for (var s = 1; s <= 10; s++) {
      var run = G.createRun(d, { rng: seeded(s * 31) }), pick = seeded(s);
      for (var i = 0; i < 400; i++) {
        if (G.ACTIONS.some(function (a) { return run.possible(a) && run.deadEnd(a); })) traps++;
        // fra banen man står i, kan man komme sikkert gennem alt, man kan se
        assert.ok(G.survivable(run.state.segs, 0, run.state.lane), d + ': ingen sikker vej gennem det synlige');
        run.act(goodPlayer(run, pick));
      }
    }
    assert.ok(traps > 0, d + ': der bør være blindgyder at planlægge sig uden om');
  });
});

test('sværhedsgraden stiger med distancen', function () {
  var run = G.createRun('normal', { rng: seeded(5) });
  var l0 = run.level();
  run.state.meters = 3000;
  assert.ok(run.level() > l0, 'niveau bør stige: ' + l0 + ' -> ' + run.level());
  assert.ok(run.level() <= 1);
});

test('forkert valg koster et liv; game over ved 0 liv', function () {
  var run = G.createRun('normal', { rng: seeded(9) });
  for (var k = 1; k <= 3; k++) {
    var bad = G.ACTIONS.filter(function (a) { return run.possible(a) && !run.safe(a); });
    assert.ok(bad.length > 0, 'første stop bør have et forkert valg');
    var m0 = run.state.meters, c0 = run.state.coins;
    var r = run.act(bad[0]);
    assert.strictEqual(r.safe, false);
    assert.strictEqual(run.state.meters, m0, 'forkert valg giver 0 m');
    assert.strictEqual(run.state.coins, c0, 'forkert valg giver ingen mønt');
    assert.ok(r.cause, 'årsag mangler');
    assert.strictEqual(run.state.lives, 3 - k);
    assert.strictEqual(r.over, k === 3);
    assert.strictEqual(run.state.over, k === 3);
    if (k < 3) {
      assert.ok(run.safeActions().length > 0, 'efter mistet liv skal der være et sikkert valg');
      assert.ok(G.survivable(run.state.segs, 0, run.state.lane), 'efter mistet liv må man ikke være fanget');
      // vej forude gøres let: hvis hele vejen er fri, kan vi ikke ramme noget – sæt en forhindring
      run.state.segs[0] = seg(['lav', 'lav', 'lav']);
    }
  }
  assert.strictEqual(run.state.lives, 0);
  var after = run.act('bliv');
  assert.ok(after.ignored, 'ingen træk efter game over');
});

test('umulige valg ignoreres og koster intet', function () {
  var run = G.createRun('normal', { rng: seeded(2) });
  run.state.lane = 0;
  var st = JSON.stringify(run.state);
  var r = run.act('venstre');
  assert.ok(r.ignored);
  assert.strictEqual(JSON.stringify(run.state), st);
  run.state.lane = 2;
  assert.ok(run.act('hoejre').ignored);
});

test('mønter giver bonus, og point = meter + mønter × 10', function () {
  var run = G.createRun('normal', { rng: seeded(4) });
  run.state.lane = 1;
  run.state.segs[0] = seg(['fri', 'lav', 'fri'], [true, true, false]);
  var r = run.act('hop');
  assert.ok(r.safe && r.coin);
  assert.strictEqual(run.state.coins, 1);
  assert.strictEqual(run.state.score, 10 + 10);
  // forkert valg giver ingen mønt
  run.state.lane = 1;
  run.state.segs[0] = seg(['fri', 'lav', 'fri'], [false, true, false]);
  r = run.act('bliv');
  assert.ok(!r.safe && !r.coin);
  assert.strictEqual(run.state.coins, 1);
  assert.strictEqual(run.state.score, run.state.meters + run.state.coins * G.COIN_POINTS);
});

test('mønter: på omkring halvdelen af stoppene, færre på sværere niveauer', function () {
  var dens = {};
  DIFFS.forEach(function (d) {
    var c = 0, n = 0;
    for (var s = 1; s <= 20; s++) {
      var g = G.makeGenerator(G.DIFFS[d], seeded(s)); g.reset(1);
      for (var i = 0; i < 500; i++) { var sg = g.next(i * 10, i === 0); n++; if (sg.coins.some(Boolean)) c++; }
    }
    dens[d] = c / n;
    assert.ok(dens[d] > 0.35 && dens[d] < 0.58, d + ': mønttæthed ' + dens[d].toFixed(2));
  });
  assert.ok(dens.rolig >= dens.svaer, 'Rolig bør have mindst lige så mange mønter som Svær');
  console.log('      (stop med mønt: ' + DIFFS.map(function (d) { return d + ' ' + Math.round(dens[d] * 100) + ' %'; }).join(', ') + ')');
});

test('man kan se et par segmenter forude', function () {
  var run = G.createRun('svaer', { rng: seeded(8) });
  assert.strictEqual(run.state.segs.length, G.VIEW);
  run.act(run.safeActions()[0]);
  assert.strictEqual(run.state.segs.length, G.VIEW);
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK    ' + t.name); }
  catch (e) { failed++; console.log('FEJL  ' + t.name + '\n      ' + (e && e.message)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået.');
process.exit(failed ? 1 : 0);
