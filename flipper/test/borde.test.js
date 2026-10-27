/*
 * Flipper – test af alle borde (v1.2): frysning før alle flippere, sigtelinjer,
 * nye dele (rampe, spinner, hul, drop-mål, baner), missioner og jackpot,
 * hele spil uden tabte kugler uden valg, og ingen tunneling gennem ramperne.
 * Kør fra repoets rod:  node flipper/test/borde.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
require('../js/borde/neonbyen.js');
require('../js/borde/rumstationen.js');
require('../js/borde/dybhavet.js');
var G = globalThis.FlipperGame;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function types(events) { return events.map(function (e) { return e.type; }); }
function runUntil(run, maxSteps, stop) {
  var events = [];
  for (var i = 0; i < (maxSteps || 2400) && run.state.phase === 'rolling'; i++) {
    run.step();
    events = events.concat(run.drainEvents());
    if (stop && stop(run, events)) break;
  }
  return events;
}
function first(ev, type) { return ev.filter(function (e) { return e.type === type; })[0]; }
function at(table, x, y, vx, vy, opts) {
  var run = G.createRun(Object.assign({ table: table }, opts || {}));
  run._place(x, y, vx, vy);
  return run;
}
// Skyd kuglen ind i en del og vent på en bestemt hændelse
function shot(run, x, y, vx, vy, type, maxSteps) {
  run._place(x, y, vx, vy);
  var ev = runUntil(run, maxSteps || 240, function (r, e) { return types(e).indexOf(type) >= 0; });
  var e = first(ev, type);
  assert.ok(e, 'hændelsen ' + type + ' kom ikke (' + [x, y, vx, vy] + ') – fik ' + types(ev).join(','));
  return e;
}
function segDist(px, py, s) {
  var dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy;
  var t = l2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2)) : 0;
  var qx = s.ax + dx * t - px, qy = s.ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}
function railDist(rp, x, y) {
  var m = Infinity;
  rp.seg.forEach(function (s) { m = Math.min(m, segDist(x, y, { ax: s.ax, ay: s.ay, bx: s.ax + s.dx, by: s.ay + s.dy })); });
  return m;
}
// Følger et valg på en kopi og sammenligner hvert skridt med forhåndsvisningen
function assertPreviewMatches(run, choice, label) {
  var p = run.preview(choice);
  assert.ok(p, label + ' ' + choice + ': forhåndsvisning');
  var copy = G.createRun({ state: run.state });
  assert.ok(copy.choose(choice), label + ' ' + choice + ': valg');
  for (var i = 1; i < p.path.length; i++) {
    copy.step();
    assert.strictEqual(copy.state.ball.x, p.path[i].x, label + ' ' + choice + ' x ved skridt ' + i);
    assert.strictEqual(copy.state.ball.y, p.path[i].y, label + ' ' + choice + ' y ved skridt ' + i);
  }
  assert.strictEqual(copy.state.phase === 'rolling' ? 'videre' : copy.state.phase, p.result, label + ' ' + choice);
  return p;
}

// Spiller hele spil på et bord med skiftende valg. Tjekker undervejs:
//  - en kugle tabes aldrig uden en frysning efter sidste gang, den var over zonen
//  - kuglen kommer aldrig ind i en flippers rækkevidde på vej ned, uden at spillet
//    først har frosset for netop den flipper (også den øvre)
//  - (valgfrit) sigtelinjen passer med banen for alle valg i de første frysninger
function playGames(table, games, checkPreviews) {
  var n = 0, out = { drains: 0, freezes: { lower: 0, upper: 0 }, previews: { lower: 0, upper: 0 }, flips: 0, score: 0, contacts: 0 };
  for (var game = 0; game < games; game++) {
    var run = G.createRun({ table: table }), s = run.state, T = run.table, steps = 0, lastAbove = 0, lastFreeze = -1;
    var frozen = { lower: false, upper: false }, touching = {}, gameFreezes = 0;
    while (s.phase !== 'over' && steps < 120 * 60 * 20) {
      if (s.phase === 'launch') { run.setPower(1 + (n++ % 5)); run.shoot(); }
      else if (s.phase === 'decision') {
        var ctx = s.ctx, choices = run.choices();
        out.freezes[ctx]++;
        frozen[ctx] = true;
        lastFreeze = steps;
        if (checkPreviews && out.previews[ctx] < 25) { choices.forEach(function (c) { assertPreviewMatches(run, c, table + ' ' + ctx); }); out.previews[ctx]++; }
        // Oftest et slag, der rammer, ellers skiftevis
        var pick = choices[(n++ + game) % choices.length];
        if (n % 3) choices.forEach(function (c) { if (c !== 'none' && run.preview(c).fired && !run.preview(c).drained) pick = c; });
        // Spilleren bliver træt: efter mange frysninger i samme spil vælges ingen flipper, så spillet slutter
        if (++gameFreezes > 250 && choices.indexOf('none') >= 0) pick = 'none';
        assert.ok(run.choose(pick), table + ': valget ' + pick + ' i ' + ctx);
      } else if (s.phase === 'lost') run.nextBall();
      else {
        run.step(); steps++;
        var b = s.ball;
        if (b.y <= G.ZONE_Y) { lastAbove = steps; frozen.lower = false; }
        if (T.flippers.upper && run.upperDist() > G.UPPER_REARM) frozen.upper = false;
        if (s.phase === 'decision') frozen[s.ctx] = true; // frøs netop i dette skridt
        if (!s.rail && !s.hold) T.sides.forEach(function (side) {
          // Inden for flipperens rækkevidde (området, den fejer over) = flipperen kan slå kuglen
          var ctx = side === 'upper' ? 'upper' : 'lower';
          var touch = run.inReach(side) >= 0;
          if (touch && !touching[side] && b.vy > 0) {
            out.contacts++;
            assert.ok(frozen[ctx], table + ': kuglen kom inden for ' + side + ' flippers rækkevidde uden frysning (spil ' + game + ', skridt ' + steps + ')');
          }
          touching[side] = touch;
        });
        run.drainEvents().forEach(function (e) {
          if (e.type === 'drain') { out.drains++; assert.ok(lastFreeze >= lastAbove, table + ': kugle tabt uden valg ved skridt ' + steps); }
          if (e.type === 'flipper') out.flips++;
        });
      }
    }
    assert.strictEqual(s.phase, 'over', table + ': spil ' + game + ' sluttede');
    out.score += s.score;
  }
  return out;
}

// ---------- Fælles for alle borde ----------
test('der er mindst tre borde, sorteret efter sværhed, med navn, tema og beskrivelse', function () {
  assert.ok(G.TABLE_IDS.length >= 3);
  assert.deepStrictEqual(G.TABLE_IDS.slice(0, 3), ['neonbyen', 'rumstationen', 'dybhavet']);
  G.TABLE_IDS.forEach(function (id, i) {
    var d = G.TABLES[id];
    assert.ok(d.name && d.theme && d.desc && d.difficulty, id);
    if (i) assert.ok(d.level > G.TABLES[G.TABLE_IDS[i - 1]].level);
  });
  // Stigende antal dele
  function count(id) { var t = G.table(id); return t.bumpers.length + t.targets.length + t.rollovers.length + t.spinners.length + t.holes.length + t.drops.length * 3 + t.ramps.length * 2 + t.loops.length + (t.flippers.upper ? 2 : 0) + (t.missions ? t.missions.list.length : 0); }
  assert.ok(count('neonbyen') < count('rumstationen') && count('rumstationen') < count('dybhavet'));
});

G.TABLE_IDS.forEach(function (id) {
  test(id + ': hele spil – frysning før alle flippere, ingen kugle tabt uden valg, og sigtelinjerne passer', function () {
    var r = playGames(id, 6, true);
    assert.ok(r.drains >= G.BALLS * 6);
    assert.ok(r.contacts >= 5 && r.freezes.lower >= 20, 'kuglen nåede flipperne: ' + r.contacts + ', frysninger: ' + r.freezes.lower);
    assert.ok(r.previews.lower >= 20, 'tjekkede sigtelinjer: ' + r.previews.lower);
    if (G.table(id).flippers.upper) assert.ok(r.previews.upper >= 10, 'tjekkede sigtelinjer ved den øvre flipper: ' + r.previews.upper);
  });
  test(id + ': ingen tunneling ved topfart (heller ikke gennem rampernes vægge)', function () {
    var T = G.table(id);
    for (var a = 0; a < 360; a += 10) {
      var run = at(id, 300, 580, 2400 * Math.cos(a * Math.PI / 180), 2400 * Math.sin(a * Math.PI / 180), { gravity: 0 });
      for (var i = 0; i < 240 && run.state.phase === 'rolling'; i++) {
        run.step();
        var b = run.state.ball;
        assert.ok(b.x > 18 && b.x < 582 && b.y > 20 && b.y < G.H + 40, id + ' vinkel ' + a + ': (' + b.x.toFixed(1) + ', ' + b.y.toFixed(1) + ')');
        if (!run.state.rail && !run.state.hold) T.walls.forEach(function (w) {
          if (w.kind === 'drop' && run.state.drops[w.bank][w.index]) return;
          var d = segDist(b.x, b.y, w);
          assert.ok(d > G.R + w.r - 4, id + ' vinkel ' + a + ': kuglen er inde i en væg (' + d.toFixed(1) + ')');
        });
      }
      run.drainEvents();
    }
  });
});

// ---------- Ramper: skinnen og ingen tunneling ----------
var RAMP_SHOTS = {
  kredslob: ['rumstationen', 398, 430, 0, -950],
  strommen: ['dybhavet', 175, 470, 0, -950],
  tang: ['dybhavet', 385, 460, 0, -950]
};
Object.keys(RAMP_SHOTS).forEach(function (rid) {
  test('rampe ' + rid + ': giver point, kuglen følger skinnen og kommer ud på bordet igen', function () {
    var c = RAMP_SHOTS[rid];
    [-1, 0, 1].forEach(function (k) {
      [0.75, 1, 1.6].forEach(function (f) {
        var run = at(c[0], c[1] + k * 12, c[2], c[3] + k * 40, c[4] * f);
        var rp = run.table.ramps.filter(function (r) { return r.id === rid; })[0];
        var ev = [], onRail = 0;
        for (var i = 0; i < 600 && run.state.phase === 'rolling'; i++) {
          run.step();
          var b = run.state.ball;
          if (run.state.rail) { onRail++; assert.ok(railDist(rp, b.x, b.y) < 1, 'kuglen er på skinnen'); }
          assert.ok(b.x > 18 && b.x < 582 && b.y > 20, 'på bordet: ' + b.x.toFixed(1) + ',' + b.y.toFixed(1));
          ev = ev.concat(run.drainEvents());
          if (types(ev).indexOf('rampEnd') >= 0 && !run.state.rail && i > 0 && onRail && types(ev).lastIndexOf('rampEnd') < ev.length - 1) break;
        }
        var e = first(ev, 'ramp');
        assert.ok(e, rid + ' ramt (' + k + ', ' + f + ')');
        assert.strictEqual(e.id, rid);
        assert.strictEqual(e.points, run.table.points.ramp);
        assert.ok(types(ev).indexOf('rampEnd') > types(ev).indexOf('ramp'));
        assert.ok(onRail > 10);
        assert.strictEqual(run.state.stats.ramps, 1);
      });
    });
  });
});
test('rampe: Strømmen fører kuglen ned til den øvre flipper, og spillet fryser før den', function () {
  var run = at('dybhavet', 175, 470, 0, -950);
  var ev = runUntil(run, 1200);
  assert.ok(types(ev).indexOf('rampEnd') >= 0);
  assert.strictEqual(run.state.phase, 'decision');
  assert.strictEqual(run.state.ctx, 'upper');
});

// ---------- Nye dele giver point ----------
test('rumstationen: spinneren giver 30 pr. omgang, flere omgange ved højere fart', function () {
  var run = G.createRun({ table: 'rumstationen' });
  var slow = shot(run, 50, 480, 0, -700, 'spinner');
  var fast = shot(run, 50, 480, 0, -1500, 'spinner');
  assert.strictEqual(slow.points, slow.spins * 30);
  assert.ok(fast.spins > slow.spins, fast.spins + ' > ' + slow.spins);
  assert.strictEqual(run.state.stats.spins, slow.spins + fast.spins);
});
test('rumstationen: Sorte hul fanger kuglen (750), holder den og skyder den ud igen', function () {
  var run = G.createRun({ table: 'rumstationen' });
  var e = shot(run, 300, 540, 0, -500, 'hole');
  assert.strictEqual(e.points, 750);
  assert.ok(run.state.hold);
  var ev = runUntil(run, 240, function (r, e2) { return types(e2).indexOf('eject') >= 0; });
  assert.ok(types(ev).indexOf('eject') >= 0);
  assert.ok(!run.state.hold && run.state.ball.vy < 0, 'skudt op igen');
});
test('rumstationen: banerne R-U-M øverst tænder (500), og alle tre giver 2000 og bonus ×2', function () {
  var run = G.createRun({ table: 'rumstationen' });
  var e = shot(run, 290, 170, 0, -500, 'rollover');
  assert.strictEqual(e.points, 500);
  assert.deepStrictEqual(run.state.lights, [false, true, false]);
  var lit = shot(run, 290, 170, 0, -500, 'rolloverLit');
  assert.strictEqual(lit.points, 100);
  run.state.lights = [true, false, true];
  var all = shot(run, 290, 170, 0, -500, 'lights');
  assert.strictEqual(all.points, 2000);
  assert.strictEqual(run.state.mult, 2);
  assert.deepStrictEqual(run.state.lights, [false, false, false]);
});
test('dybhavet: muslingerne (drop-mål) giver 300, går ned, og alle tre giver 3000 og kommer op igen', function () {
  var run = G.createRun({ table: 'dybhavet' });
  var e = shot(run, 240, 600, 0, -600, 'drop');
  assert.strictEqual(e.points, 300);
  assert.deepStrictEqual(run.state.drops[0], [true, false, false]);
  run.state.drops[0] = [true, false, true];
  var e2 = shot(run, 294, 590, 0, -600, 'drop');
  assert.strictEqual(e2.index, 1);
  var ev = run.drainEvents();
  assert.strictEqual(run.state.stats.dropBanks, 1);
  // Banken rejser sig igen, når kuglen er kommet væk
  run._place(300, 300, 0, 0);
  run.state.ball.vy = -1;
  runUntil(run, 360, function (r) { return !r.state.drops[0][0]; });
  assert.deepStrictEqual(run.state.drops[0], [false, false, false]);
});
test('dybhavet: et drop-mål ramt bagfra tæller ikke', function () {
  var run = at('dybhavet', 290, 470, 0, 400);
  var ev = runUntil(run, 120);
  assert.ok(types(ev).indexOf('drop') < 0);
});
test('dybhavet: Skattekisten giver 750 (og er jackpot, når den lyser)', function () {
  var run = G.createRun({ table: 'dybhavet' });
  var e = shot(run, 295, 500, 0, -300, 'hole');
  assert.strictEqual(e.points, 750);
  assert.strictEqual(e.id, 'skattekiste');
});
test('dybhavet: den øvre flipper – spillet fryser, kun Øvre flipper eller Lad være, og sigtelinjen passer', function () {
  var run = at('dybhavet', 470, 420, 0, 150);
  runUntil(run);
  assert.strictEqual(run.state.phase, 'decision');
  assert.strictEqual(run.state.ctx, 'upper');
  assert.deepStrictEqual(run.choices(), ['upper-early', 'upper-late', 'none']);
  assert.deepStrictEqual(run.flipperOptions(), ['upper']);
  assert.strictEqual(run.choose('left-early'), false);
  assert.strictEqual(run.choose('both-late'), false);
  assert.strictEqual(run.choose('upper'), false);
  run.choices().forEach(function (c) { assertPreviewMatches(run, c, 'øvre'); });
  var p = run.preview('upper-early');
  assert.strictEqual(p.fired, 'upper');
  assert.ok(run.choose('upper-early'));
  var ev = runUntil(run, 30);
  var f = first(ev, 'flipper');
  assert.ok(f && f.side === 'upper');
  // De nederste flippere slår ikke ved et valg for den øvre
  assert.ok(ev.filter(function (e) { return e.type === 'flipper' && e.side !== 'upper'; }).length === 0);
});
test('de to første borde har ingen øvre flipper', function () {
  ['neonbyen', 'rumstationen'].forEach(function (id) {
    assert.ok(!G.table(id).flippers.upper);
    var run = at(id, 470, 420, 0, 150);
    runUntil(run);
    assert.notStrictEqual(run.state.ctx, 'upper');
  });
});

// ---------- Missioner og jackpot ----------
test('rumstationen: missionen "Kør Kredsløbet" 3 gange giver 5000 og starter forfra', function () {
  var run = G.createRun({ table: 'rumstationen' });
  assert.deepStrictEqual([G.missionStatus(run.state).short, G.missionStatus(run.state).n, G.missionStatus(run.state).count], ['Rampe', 0, 3]);
  var c = RAMP_SHOTS.kredslob, got = [];
  for (var k = 0; k < 3; k++) {
    run._place(c[1], c[2], c[3], c[4]);
    var ev = runUntil(run, 600, function (r, e) { return types(e).indexOf('rampEnd') >= 0; });
    got = got.concat(ev);
    if (k < 2) assert.strictEqual(G.missionStatus(run.state).n, k + 1);
  }
  var m = first(got, 'mission');
  assert.ok(m, 'missionen klaret');
  assert.strictEqual(m.points, 5000 * run.state.mult);
  assert.strictEqual(run.state.stats.missions, 1);
  assert.strictEqual(G.missionStatus(run.state).n, 0);
  assert.strictEqual(first(got, 'progress').n, 1);
});
test('dybhavet: fire missioner i rækkefølge tænder jackpotten; Skattekisten giver 50 000 (uden bonus) og så starter runde 2', function () {
  var run = G.createRun({ table: 'dybhavet' }), all = [];
  function st() { return G.missionStatus(run.state); }
  assert.strictEqual(st().step, 1); assert.strictEqual(st().steps, 4);
  // En forkert ting tæller ikke: Tangskoven før muslingerne
  run._place(RAMP_SHOTS.tang[1], RAMP_SHOTS.tang[2], 0, -950);
  runUntil(run, 600, function (r, e) { return types(e).indexOf('rampEnd') >= 0; });
  assert.strictEqual(st().step, 1);
  // 1) alle muslinger ned
  run.state.drops[0] = [true, true, false];
  all.push(shot(run, 346, 580, 0, -600, 'mission'));
  assert.strictEqual(st().step, 2);
  // 2) Strømmen ×2 og 3) Tangskoven ×2
  ['strommen', 'strommen', 'tang', 'tang'].forEach(function (rid) {
    var c = RAMP_SHOTS[rid];
    run._place(c[1], c[2], c[3], c[4]);
    all = all.concat(runUntil(run, 600, function (r, e) { return types(e).indexOf('rampEnd') >= 0; }));
  });
  assert.strictEqual(st().step, 4, 'mission 4: ' + JSON.stringify(st()));
  // 4) sløjferne ×2
  shot(run, 50, 480, 0, -1200, 'loop');
  shot(run, 510, 480, 0, -1200, 'loop');
  assert.ok(st().jackpot, 'jackpotten lyser');
  assert.strictEqual(st().value, 50000);
  assert.strictEqual(run.state.stats.missions, 4);
  // Jackpot: ganges ikke med bonussen
  run.state.mult = 3;
  var j = shot(run, 295, 500, 0, -300, 'jackpot');
  assert.strictEqual(j.points, 50000);
  assert.strictEqual(run.state.stats.jackpots, 1);
  assert.ok(!st().jackpot);
  assert.strictEqual(st().step, 1);
  assert.strictEqual(run.state.mission.round, 2);
});
test('missionsstatus: Neonbyen har ingen mission (kun lysene)', function () {
  assert.strictEqual(G.missionStatus(G.createRun({ table: 'neonbyen' }).state), null);
});
test('borde i kopier: en klon af tilstanden bruger samme bord', function () {
  var run = G.createRun({ table: 'dybhavet' });
  var copy = G.createRun({ state: run.state });
  assert.strictEqual(copy.table.id, 'dybhavet');
});

var failed = 0;
tests.forEach(function (t) {
  var t0 = Date.now();
  try { t.fn(); console.log('OK    ' + t.name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { failed++; console.log('FEJL  ' + t.name + '\n      ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
});
console.log('\n' + (tests.length - failed) + ' af ' + tests.length + ' test bestået.');
process.exit(failed ? 1 : 0);
