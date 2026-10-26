/*
 * Flipper – test af spillogikken og fysikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node flipper/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.FlipperGame;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Kør, til fasen skifter (eller max skridt). Returnerer alle hændelser undervejs.
function runUntil(run, maxSteps, stop) {
  var events = [];
  for (var i = 0; i < (maxSteps || 2400) && run.state.phase === 'rolling'; i++) {
    run.step();
    events = events.concat(run.drainEvents());
    if (stop && stop(run, events)) break;
  }
  return events;
}
function types(events) { return events.map(function (e) { return e.type; }); }
// En kugle, der falder ned mod venstre flipper
function fallingLeft() { var run = G.createRun({}); run._place(200, 700, 0, 250); return run; }

test('frysezonen: spillet fryser, før kuglen når venstre flipper', function () {
  var run = fallingLeft();
  var ev = runUntil(run);
  assert.strictEqual(run.state.phase, 'decision');
  assert.strictEqual(run.state.reason, 'zone');
  assert.ok(types(ev).indexOf('freeze') >= 0);
  var b = run.state.ball;
  assert.ok(b.y > G.ZONE_Y && b.y < G.FLIPPERS.left.y, 'kuglen er i zonen over flipperen: y=' + b.y);
  assert.ok(b.vy > 0, 'kuglen er på vej ned');
  // Der er endnu ikke ramt nogen flipper
  assert.strictEqual(run.state.stats.flips, 0);
});

test('frysezonen: spillet fryser også, når kuglen er på vej ud gennem midten', function () {
  var run = G.createRun({}); run._place(280, 700, 0, 200);
  runUntil(run);
  assert.strictEqual(run.state.phase, 'decision');
});

test('frysezonen: kun én frysning pr. tur ned – næste kommer, når kuglen har været oppe igen', function () {
  var run = fallingLeft();
  runUntil(run);
  run.choose('left');
  var ev = runUntil(run, 120 * 3);
  // Efter slaget kommer kuglen op og ned igen, og så fryser spillet igen
  assert.ok(types(ev).indexOf('flipper') >= 0);
  assert.strictEqual(run.state.phase, 'decision');
  assert.strictEqual(run.state.stats.freezes, 2);
});

test('valgt flipper slår kuglen op (automatisk timing)', function () {
  var run = fallingLeft();
  runUntil(run);
  assert.ok(run.choose('left'));
  var ev = runUntil(run, 600, function (r, e) { return types(e).indexOf('flipper') >= 0; });
  var hit = ev.filter(function (e) { return e.type === 'flipper'; })[0];
  assert.ok(hit, 'flipperen slog');
  assert.strictEqual(hit.side, 'left');
  assert.ok(run.state.ball.vy < -1000, 'kuglen er på vej op: vy=' + run.state.ball.vy);
  // Kuglen kommer et godt stykke op ad bordet
  var minY = run.state.ball.y;
  for (var i = 0; i < 60; i++) { run.step(); minY = Math.min(minY, run.state.ball.y); }
  assert.ok(minY < 500, 'minY=' + minY);
});

test('Begge: den flipper, der når kuglen, slår', function () {
  var run = fallingLeft();
  runUntil(run);
  run.choose('both');
  var ev = runUntil(run, 600, function (r, e) { return types(e).indexOf('flipper') >= 0; });
  assert.ok(ev.some(function (e) { return e.type === 'flipper' && e.side === 'left'; }));
});

test('Højre flipper når ikke en kugle i venstre side', function () {
  var run = fallingLeft();
  runUntil(run);
  var p = run.preview('right');
  assert.strictEqual(p.fired, null);
});

test('"Lad være" taber kuglen ved afløbet', function () {
  var run = G.createRun({}); run._place(280, 700, 0, 200);
  runUntil(run);
  assert.strictEqual(run.state.phase, 'decision');
  assert.ok(run.choose('none'));
  var ev = runUntil(run);
  assert.strictEqual(run.state.phase, 'lost');
  assert.ok(types(ev).indexOf('drain') >= 0);
  assert.ok(types(ev).indexOf('flipper') < 0, 'ingen flipper slog');
  assert.strictEqual(run.state.ballsLeft, G.BALLS - 1);
});

test('sigtelinjerne er deterministiske: forhåndsvisningen er præcis den bane, kuglen tager', function () {
  var run = fallingLeft();
  runUntil(run);
  G.OPTIONS.forEach(function (o) {
    var p = run.preview(o);
    var copy = G.createRun({ state: run.state });
    copy.choose(o);
    for (var i = 1; i < p.path.length; i++) {
      copy.step();
      assert.strictEqual(copy.state.ball.x, p.path[i].x, o + ' x ved skridt ' + i);
      assert.strictEqual(copy.state.ball.y, p.path[i].y, o + ' y ved skridt ' + i);
    }
    assert.strictEqual(copy.state.phase === 'rolling' ? 'videre' : copy.state.phase, p.result, o);
  });
  // Forhåndsvisningen ændrer ikke selve spillet
  assert.strictEqual(run.state.phase, 'decision');
});

test('farten (Rolig/Normal/Hurtig) ændrer ikke fysikken', function () {
  var a = G.createRun({ speedId: 'rolig' }), b = G.createRun({ speedId: 'hurtig' });
  [a, b].forEach(function (r) { r.setPower(4); r.shoot(); runUntil(r); });
  assert.deepStrictEqual(a.state.ball, b.state.ball);
  assert.strictEqual(a.state.score, b.state.score);
  assert.strictEqual(G.SPEEDS.rolig.factor < G.SPEEDS.normal.factor && G.SPEEDS.normal.factor < G.SPEEDS.hurtig.factor, true);
});

test('point: bumper giver 100', function () {
  var run = G.createRun({}); run._place(200, 240, 0, 300);
  var ev = runUntil(run, 40, function (r, e) { return types(e).indexOf('bumper') >= 0; });
  var e = ev.filter(function (x) { return x.type === 'bumper'; })[0];
  assert.ok(e); assert.strictEqual(e.points, 100);
  assert.strictEqual(e.index, 0);
});

test('point: lysmål giver 250 og tænder lyset – et tændt mål giver 50', function () {
  var run = G.createRun({}); run._place(180, 215, 0, -700);
  var ev = runUntil(run, 20, function (r, e) { return types(e).indexOf('target') >= 0; });
  var e = ev.filter(function (x) { return x.type === 'target'; })[0];
  assert.ok(e); assert.strictEqual(e.points, 250); assert.strictEqual(e.index, 0);
  assert.deepStrictEqual(run.state.lights, [true, false, false, false, false]);
  run._place(180, 215, 0, -700);
  ev = runUntil(run, 20, function (r, e2) { return types(e2).indexOf('targetLit') >= 0; });
  assert.strictEqual(ev.filter(function (x) { return x.type === 'targetLit'; })[0].points, 50);
});

test('alle fem lys tændt: 2000 point, bonus ×2, og lysene starter forfra', function () {
  var run = G.createRun({});
  run.state.lights = [true, true, true, true, false];
  run._place(380, 215, 0, -700);
  var ev = runUntil(run, 20, function (r, e) { return types(e).indexOf('lights') >= 0; });
  var l = ev.filter(function (x) { return x.type === 'lights'; })[0];
  assert.ok(l); assert.strictEqual(l.points, 2000);
  assert.strictEqual(run.state.mult, 2);
  assert.deepStrictEqual(run.state.lights, [false, false, false, false, false]);
  // Bonussen ganger de næste point
  run._place(200, 240, 0, 300);
  ev = runUntil(run, 40, function (r, e) { return types(e).indexOf('bumper') >= 0; });
  assert.strictEqual(ev.filter(function (x) { return x.type === 'bumper'; })[0].points, 200);
});

test('bonussen går højst til ×5 og nulstilles, når kuglen er tabt', function () {
  var run = G.createRun({});
  for (var k = 0; k < 6; k++) {
    run.state.lights = [true, true, true, true, false];
    run._place(380, 215, 0, -700);
    runUntil(run, 20, function (r, e) { return types(e).indexOf('lights') >= 0; });
  }
  assert.strictEqual(run.state.mult, 5);
  run._place(280, 960, 0, 300); runUntil(run);
  if (run.state.phase === 'decision') { run.choose('none'); runUntil(run); }
  assert.strictEqual(run.state.phase, 'lost');
  assert.strictEqual(run.state.mult, 1);
});

test('sløjfe: kuglen op gennem en sidebane giver 500', function () {
  var run = G.createRun({}); run._place(50, 480, 0, -1200);
  var ev = runUntil(run, 60, function (r, e) { return types(e).indexOf('loop') >= 0; });
  var e = ev.filter(function (x) { return x.type === 'loop'; })[0];
  assert.ok(e); assert.strictEqual(e.points, 500); assert.strictEqual(e.side, 'left');
});

test('kuglen er tabt, og efter tre kugler er spillet slut', function () {
  var run = G.createRun({});
  for (var k = 0; k < G.BALLS; k++) {
    assert.strictEqual(run.state.phase, 'launch');
    run._place(280, 900, 0, 300);
    runUntil(run);
    if (run.state.phase === 'decision') { run.choose('none'); runUntil(run); }
    assert.strictEqual(run.state.phase, 'lost', 'kugle ' + (k + 1));
    assert.strictEqual(run.state.ballsLeft, G.BALLS - k - 1);
    run.nextBall();
  }
  assert.strictEqual(run.state.phase, 'over');
  assert.strictEqual(run.shoot(), false);
  assert.strictEqual(run.choose('left'), false);
});

test('ekstra kugle ved 40 000 point', function () {
  var run = G.createRun({});
  run.state.score = 39950;
  run._place(200, 240, 0, 300);
  var ev = runUntil(run, 40, function (r, e) { return types(e).indexOf('extra') >= 0; });
  assert.ok(types(ev).indexOf('extra') >= 0);
  assert.strictEqual(run.state.ballsLeft, G.BALLS + 1);
});

test('afskydning: kraft 1–5, Skyd sender kuglen op, og stærkere skud kommer højere op', function () {
  var tops = [];
  for (var p = 1; p <= 5; p++) {
    var run = G.createRun({});
    assert.ok(run.setPower(p));
    assert.strictEqual(run.state.power, p);
    var pv = run.previewLaunch(p, 0.5);
    tops.push(Math.min.apply(null, pv.path.map(function (q) { return q.y; })));
    assert.ok(run.shoot());
    assert.strictEqual(run.state.phase, 'rolling');
    runUntil(run, 120 * 6);
    assert.ok(run.state.ball.x < G.LANE_X, 'kraft ' + p + ' kom ud på bordet');
  }
  for (var i = 1; i < tops.length; i++) assert.ok(tops[i] <= tops[i - 1], 'kraft ' + (i + 1) + ' højere end ' + i);
  var r2 = G.createRun({});
  assert.ok(r2.setPower(9)); assert.strictEqual(r2.state.power, 5);
  assert.ok(r2.setPower(0)); assert.strictEqual(r2.state.power, 1);
});

test('stille kugle ved flipperne: spillet fryser (ingen kugle tabes uden et valg)', function () {
  // Uden tyngdekraft kan kuglen ligge stille – det tester sikkerhedsnettet
  var run = G.createRun({ gravity: 0 });
  run._place(250, 860, 3, 0);
  runUntil(run, 240);
  assert.strictEqual(run.state.phase, 'decision');
  assert.strictEqual(run.state.reason, 'stille');
  // "Lad være" puffer kuglen mod afløbet
  var vx0 = run.state.ball.vx;
  run.choose('none');
  var ev = run.drainEvents();
  assert.ok(types(ev).indexOf('nudge') >= 0);
  assert.strictEqual(run.state.phase, 'rolling');
  assert.ok(run.state.ball.vy > 0 && run.state.ball.vx > vx0, 'puffet ned og ind mod midten');
});

test('stille kugle ude på bordet får et lille puf', function () {
  var run = G.createRun({ gravity: 0 });
  run._place(300, 560, 0, 0);
  var ev = runUntil(run, 240, function (r, e) { return types(e).indexOf('nudge') >= 0; });
  assert.ok(types(ev).indexOf('nudge') >= 0);
});

test('ingen tunneling: kuglen bliver på bordet selv ved topfart', function () {
  for (var a = 0; a < 360; a += 15) {
    var run = G.createRun({ gravity: 0 }), rad = a * Math.PI / 180;
    run._place(300, 560, 2400 * Math.cos(rad), 2400 * Math.sin(rad));
    for (var i = 0; i < 240 && run.state.phase === 'rolling'; i++) {
      run.step();
      var b = run.state.ball;
      assert.ok(b.x > 20 && b.x < 580 && b.y > 25, 'vinkel ' + a + ': (' + b.x.toFixed(1) + ', ' + b.y.toFixed(1) + ')');
    }
    run.drainEvents();
  }
});

test('hele spil: en kugle tabes aldrig uden et valg på vejen ned', function () {
  // Spiller med faste valg (skiftevis) og tjekker, at der var en frysning efter
  // sidste gang kuglen var oppe over zonen, før hver tabt kugle.
  var opts = ['left', 'right', 'both', 'none'], n = 0;
  for (var game = 0; game < 4; game++) {
    var run = G.createRun({}), s = run.state, steps = 0, lastAbove = 0, lastFreeze = -1, drains = 0;
    while (s.phase !== 'over' && steps < 120 * 60 * 15) {
      if (s.phase === 'launch') { run.setPower(1 + (n++ % 5)); run.shoot(); }
      else if (s.phase === 'decision') { lastFreeze = steps; run.choose(opts[(n++ + game) % 4]); }
      else if (s.phase === 'lost') run.nextBall();
      else {
        run.step(); steps++;
        if (s.ball.y <= G.ZONE_Y) lastAbove = steps;
        run.drainEvents().forEach(function (e) {
          if (e.type === 'drain') { drains++; assert.ok(lastFreeze >= lastAbove, 'tabt uden valg ved skridt ' + steps); }
        });
      }
    }
    assert.strictEqual(s.phase, 'over', 'spil ' + game + ' sluttede');
    assert.ok(drains >= G.BALLS);
  }
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('OK    ' + t.name); }
  catch (e) { failed++; console.log('FEJL  ' + t.name + '\n      ' + (e && e.stack || e)); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået.');
process.exit(failed ? 1 : 0);
