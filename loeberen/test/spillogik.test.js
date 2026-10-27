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

function sim(d, seed, n, fn) {
  var run = G.createRun(d, { rng: seeded(seed) }), pick = seeded(seed + 1000);
  for (var i = 0; i < n; i++) { if (fn) fn(run, i); run.act(goodPlayer(run, pick)); }
  return run;
}
function ok(s, lane, h, a) { return G.safe(s, lane, h, a); }

test('regler nede på nettet: fri, laser (Hop), lysbjælke (Dyk), firewall (skift bane)', function () {
  assert.strictEqual(G.possible(0, 'venstre'), false);
  assert.strictEqual(G.possible(2, 'hoejre'), false);
  assert.strictEqual(G.possible(1, 'venstre'), true);
  ['hop', 'dyk', 'bliv'].forEach(function (a) { assert.ok(G.possible(0, a) && G.possible(2, a)); });
  var s = seg(['fri', 'lav', 'hoej']);
  assert.ok(ok(s, 0, 0, 'bliv') && ok(s, 0, 0, 'hop') && ok(s, 0, 0, 'dyk'), 'fri bane: alt er sikkert');
  assert.ok(ok(s, 1, 0, 'hop') && !ok(s, 1, 0, 'bliv') && !ok(s, 1, 0, 'dyk'), 'laser: kun hop');
  assert.ok(ok(s, 2, 0, 'dyk') && !ok(s, 2, 0, 'hop') && !ok(s, 2, 0, 'bliv'), 'lysbjælke: kun dyk');
  assert.ok(ok(s, 1, 0, 'venstre') && !ok(s, 1, 0, 'hoejre'), 'man kan kun skifte til en fri bane');
  var t = seg(['mur', 'fri', 'mur']);
  ['hop', 'dyk', 'bliv'].forEach(function (a) { assert.ok(!ok(t, 0, 0, a), 'firewall: intet er sikkert (' + a + ')'); });
  assert.deepStrictEqual(G.safeActions(t, 0, 0), ['hoejre']);
  assert.strictEqual(G.cause(t, 0, 0, 'bliv'), 'mur');
});

test('højde: op ad en rampe, en blok uden rampe er en mur nedefra', function () {
  var s = seg(['rampe', 'blok', 'fri']);
  ['bliv', 'hop', 'dyk'].forEach(function (a) {
    var o = G.outcome(s, 0, 0, a);
    assert.ok(o.ok && o.h === 1 && o.lane === 0, 'rampe: ' + a + ' fører op på blokken');
  });
  var side = G.outcome(s, 1, 0, 'venstre');
  assert.ok(side.ok && side.h === 1, 'man kan også skifte bane op på en rampe');
  ['bliv', 'hop', 'dyk'].forEach(function (a) {
    var o = G.outcome(s, 1, 0, a);
    assert.ok(!o.ok && o.cause === 'blok', 'blok uden rampe nedefra er en mur (' + a + ')');
  });
  assert.ok(!G.outcome(s, 2, 0, 'venstre').ok, 'man kan ikke skifte ind i siden af en blok nedefra');
  // oppefra er samme blok fri
  assert.ok(G.outcome(s, 1, 1, 'bliv').ok && G.outcome(s, 1, 1, 'bliv').h === 1);
});

test('oppe: løb ovenpå, skift til blok ved siden af, hop ned i en side, land når blokken slutter', function () {
  var s = seg(['blok', 'blok', 'fri']);
  var stay = G.outcome(s, 1, 1, 'bliv');
  assert.ok(stay.ok && stay.h === 1, 'bliv oppe');
  var over = G.outcome(s, 1, 1, 'venstre');
  assert.ok(over.ok && over.h === 1 && over.lane === 0, 'skift til blok ved siden af i samme højde');
  var down = G.outcome(s, 1, 1, 'hoejre');
  assert.ok(down.ok && down.h === 0 && down.lane === 2, 'hop ned i en fri sidebane');
  var land = G.outcome(seg(['fri', 'fri', 'fri']), 1, 1, 'bliv');
  assert.ok(land.ok && land.h === 0, 'blokken slutter: man lander');
  // når man lander, gælder reglerne nede
  var g = seg(['fri', 'lav', 'hoej']);
  assert.ok(G.outcome(g, 1, 1, 'hop').ok && !G.outcome(g, 1, 1, 'bliv').ok, 'lander man ved en laser, skal man hoppe');
  assert.ok(!G.outcome(seg(['mur', 'mur', 'fri']), 0, 1, 'bliv').ok, 'firewall spærrer også oppefra');
  // forhindringer oppe på blokken
  var top = seg(['blok-lav', 'blok-hoej', 'blok']);
  assert.ok(ok(top, 0, 1, 'hop') && !ok(top, 0, 1, 'bliv') && !ok(top, 0, 1, 'dyk'), 'laser på taget: kun hop');
  assert.ok(ok(top, 1, 1, 'dyk') && !ok(top, 1, 1, 'hop'), 'bjælke over taget: kun dyk');
  assert.ok(!ok(top, 2, 1, 'venstre') && ok(top, 2, 1, 'bliv'), 'man kan ikke skifte ind i en forhindring oppe');
  assert.strictEqual(G.outcome(top, 0, 0, 'hop').cause, 'blok', 'nedefra er taget med laser stadig en mur');
});

test('oppefra passerer man forhindringer nede på nettet', function () {
  // Firewall-fri vej: blokken løber hen over to stop, mens der er laser og bjælke nede ved siden af
  var run = G.createRun('normal', { rng: seeded(3) });
  run.state.lane = 1; run.state.h = 0;
  run.state.segs[0] = seg(['lav', 'rampe', 'hoej']);
  run.state.segs[1] = seg(['mur', 'blok', 'mur']);
  run.state.segs[2] = seg(['lav', 'blok', 'hoej']);
  var r = run.act('bliv');
  assert.ok(r.safe && r.toH === 1 && run.state.h === 1 && run.state.ups === 1, 'op ad rampen');
  assert.strictEqual(run.state.prev.lanes[1], 'rampe', 'stoppet under løberen huskes til tegningen');
  r = run.act('bliv');
  assert.ok(r.safe && run.state.h === 1, 'løb ovenpå forbi to firewalls');
  r = run.act('bliv');
  assert.ok(r.safe && run.state.h === 1, 'og videre ovenpå');
  assert.strictEqual(run.state.meters, 30);
});

test('ramt: man falder ned (højde 0), vejen laves om, og man er ikke fanget', function () {
  var run = G.createRun('normal', { rng: seeded(6) });
  run.state.lane = 1; run.state.h = 1;
  run.state.segs[0] = seg(['blok', 'blok-lav', 'blok']);
  var r = run.act('bliv');
  assert.ok(!r.safe && r.cause === 'blok-lav' && run.state.h === 0 && run.state.prev === null);
  assert.ok(G.survivable(run.state.segs, 0, G.code(run.state.lane, 0)));
  var first = run.state.segs[0];
  assert.ok(first.lanes.every(function (c) { return !G.isBlock(c); }), 'første stop efter et mistet liv er let');
});

DIFFS.forEach(function (d) {
  test(d + ': hvert stop har mindst ét muligt og sikkert valg (20 × 400 stop)', function () {
    for (var s = 1; s <= 20; s++) {
      var rng = seeded(s * 7 + 3), pick = seeded(s * 13 + 1);
      var run = G.createRun(d, { rng: rng });
      for (var i = 0; i < 400; i++) {
        assert.ok(run.safeActions().length >= 1, 'intet sikkert valg');
        var a = goodPlayer(run, pick);
        var lives = run.state.lives, m = run.state.meters;
        var r = run.act(a);
        assert.ok(r.safe && !r.ignored, 'sikkert valg blev ikke godtaget');
        assert.strictEqual(run.state.lives, lives, 'sikkert valg må ikke koste liv');
        assert.strictEqual(run.state.meters, m + G.METERS, 'sikkert valg giver 10 m');
        assert.ok(run.state.h === 0 || run.state.h === 1);
        if (run.state.h === 1) assert.ok(G.isBlock(r.seg.lanes[run.state.lane]), 'oppe = man står på en blok');
      }
      assert.strictEqual(run.state.lives, G.START_LIVES);
    }
  });
});

test('løberen kommer op på blokke og løber ovenpå (alle niveauer)', function () {
  DIFFS.forEach(function (d) {
    var ups = 0, top = 0, n = 0;
    for (var s = 1; s <= 10; s++) {
      var run = sim(d, s * 17, 200, function (r) { n++; if (r.state.h) top++; });
      ups += run.state.ups;
    }
    assert.ok(ups > 20, d + ': for få ture op på en blok (' + ups + ')');
    assert.ok(top / n > 0.05, d + ': for lidt tid oppe (' + (top / n).toFixed(2) + ')');
  });
});

test('rolig: fra hver bane og den højde, man kan stå i, er der altid et sikkert valg', function () {
  for (var s = 1; s <= 20; s++) {
    var run = G.createRun('rolig', { rng: seeded(s) }), pick = seeded(s + 100);
    for (var i = 0; i < 300; i++) {
      var segs = run.state.segs;
      for (var k = 1; k < segs.length; k++) {
        for (var l = 0; l < 3; l++) {
          var h = G.isBlock(segs[k - 1].lanes[l]) ? 1 : 0;
          assert.ok(G.safeActions(segs[k], l, h).length > 0, 'rolig: bane ' + l + ' højde ' + h + ' er fanget: ' + JSON.stringify(segs[k].lanes));
        }
      }
      assert.ok(!G.ACTIONS.some(function (a) { return run.possible(a) && run.deadEnd(a); }), 'rolig: blindgyde');
      run.act(goodPlayer(run, pick));
    }
  }
});

test('normal og svær: blindgyder findes, men der er altid en synlig sikker vej', function () {
  ['normal', 'svaer'].forEach(function (d) {
    var traps = 0;
    for (var s = 1; s <= 10; s++) {
      var run = G.createRun(d, { rng: seeded(s * 31) }), pick = seeded(s);
      for (var i = 0; i < 400; i++) {
        if (G.ACTIONS.some(function (a) { return run.possible(a) && run.deadEnd(a); })) traps++;
        assert.ok(G.survivable(run.state.segs, 0, G.code(run.state.lane, run.state.h)), d + ': ingen sikker vej gennem det synlige');
        run.act(goodPlayer(run, pick));
      }
    }
    assert.ok(traps > 0, d + ': der bør være blindgyder at planlægge sig uden om');
  });
});

test('sværhedsgraden stiger tydeligt med distancen', function () {
  var run = G.createRun('normal', { rng: seeded(5) });
  var l0 = run.level(), n0 = run.levelNum();
  run.state.meters = 3000;
  assert.ok(run.level() > l0 && run.levelNum() > n0, 'niveau bør stige: ' + n0 + ' -> ' + run.levelNum());
  assert.ok(run.level() <= 1 && run.levelNum() <= G.LEVELS);
  // statistik over vejen tidligt og sent
  function stats(d, from, to) {
    var st = { fri: 0, mur: 0, top: 0, n: 0 };
    for (var s = 1; s <= 15; s++) {
      var g = G.makeGenerator(G.DIFFS[d], seeded(s * 11)); g.reset(1, 0);
      for (var i = 0; i * 10 < to; i++) {
        var sg = g.next(i * 10, i === 0);
        if (i * 10 < from) continue;
        st.n++;
        sg.lanes.forEach(function (c) { if (c === 'fri') st.fri++; if (c === 'mur') st.mur++; if (c === 'blok-lav' || c === 'blok-hoej') st.top++; });
      }
    }
    return { fri: st.fri / st.n, mur: st.mur / st.n, top: st.top / st.n };
  }
  ['normal', 'svaer'].forEach(function (d) {
    var early = stats(d, 0, 200), late = stats(d, 1400, 1800);
    console.log('      (' + d + ': frie baner pr. stop ' + early.fri.toFixed(2) + ' → ' + late.fri.toFixed(2) +
      ', firewalls ' + early.mur.toFixed(2) + ' → ' + late.mur.toFixed(2) + ', forhindringer oppe ' + early.top.toFixed(2) + ' → ' + late.top.toFixed(2) + ')');
    assert.ok(late.fri < early.fri - 0.15, d + ': færre frie baner senere');
    assert.ok(late.mur > early.mur, d + ': flere firewalls senere');
    assert.ok(late.top > early.top, d + ': flere forhindringer oppe på blokkene senere');
  });
  var rol = stats('rolig', 1400, 1800);
  assert.ok(rol.fri > 0.9, 'Rolig forbliver rolig (frie baner ' + rol.fri.toFixed(2) + ')');
});

test('forkert valg koster et liv og giver 0 m; game over ved 0 liv', function () {
  var run = G.createRun('normal', { rng: seeded(9) });
  for (var k = 1; k <= 3; k++) {
    run.state.segs[0] = seg(['lav', 'lav', 'lav']);
    var m0 = run.state.meters, c0 = run.state.coins;
    var r = run.act('bliv');
    assert.strictEqual(r.safe, false);
    assert.strictEqual(run.state.meters, m0, 'forkert valg giver 0 m');
    assert.strictEqual(run.state.coins, c0, 'forkert valg giver ingen mønt');
    assert.strictEqual(r.cause, 'lav');
    assert.strictEqual(run.state.lives, 3 - k);
    assert.strictEqual(r.over, k === 3);
    assert.strictEqual(run.state.over, k === 3);
    if (k < 3) {
      assert.ok(run.safeActions().length > 0, 'efter mistet liv skal der være et sikkert valg');
      assert.ok(G.survivable(run.state.segs, 0, G.code(run.state.lane, run.state.h)), 'efter mistet liv må man ikke være fanget');
    }
  }
  assert.strictEqual(run.state.lives, 0);
  assert.ok(run.act('bliv').ignored, 'ingen træk efter game over');
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

test('mønter giver bonus, også oppe på blokke, og point = meter + mønter × 10', function () {
  var run = G.createRun('normal', { rng: seeded(4) });
  run.state.lane = 1; run.state.h = 0;
  run.state.segs[0] = seg(['fri', 'lav', 'fri'], [true, true, false]);
  var r = run.act('hop');
  assert.ok(r.safe && r.coin);
  assert.strictEqual(run.state.coins, 1);
  assert.strictEqual(run.state.score, 10 + 10);
  run.state.lane = 1; run.state.h = 0;
  run.state.segs[0] = seg(['fri', 'rampe', 'fri'], [false, true, false]);
  r = run.act('bliv');
  assert.ok(r.safe && r.coin && run.state.h === 1, 'mønt på rampen');
  run.state.lane = 1; run.state.h = 0;
  run.state.segs[0] = seg(['fri', 'lav', 'fri'], [false, true, false]);
  r = run.act('bliv');
  assert.ok(!r.safe && !r.coin, 'forkert valg giver ingen mønt');
  assert.strictEqual(run.state.coins, 2);
  assert.strictEqual(run.state.score, run.state.meters + run.state.coins * G.COIN_POINTS);
});

test('mønter: på omtrent hvert andet stop, aldrig i en firewall', function () {
  var dens = {};
  DIFFS.forEach(function (d) {
    var c = 0, n = 0;
    for (var s = 1; s <= 20; s++) {
      var g = G.makeGenerator(G.DIFFS[d], seeded(s)); g.reset(1, 0);
      for (var i = 0; i < 500; i++) {
        var sg = g.next(i * 10, i === 0); n++;
        if (sg.coins.some(Boolean)) c++;
        sg.coins.forEach(function (x, l) { if (x) assert.notStrictEqual(sg.lanes[l], 'mur', 'mønt i en firewall'); });
      }
    }
    dens[d] = c / n;
    assert.ok(dens[d] > 0.3 && dens[d] < 0.6, d + ': mønttæthed ' + dens[d].toFixed(2));
  });
  assert.ok(dens.rolig >= dens.svaer, 'Rolig bør have mindst lige så mange mønter som Svær');
  console.log('      (stop med mønt: ' + DIFFS.map(function (d) { return d + ' ' + Math.round(dens[d] * 100) + ' %'; }).join(', ') + ')');
});

test('man kan se seks stop forude', function () {
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
