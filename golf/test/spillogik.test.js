// Logiktest af Golf (uden browser): node golf/test/spillogik.test.js
// Fysik (rul, friktion, bander, sand, skråninger), hul og vand, slagtælling,
// slagpuljen, game over, point, rekorder og at de genererede huller kan spilles.
'use strict';
var assert = require('assert');
var path = require('path');
var L = require(path.join(__dirname, '..', 'js', 'logik.js'));

var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.message)); }
}
function hole(extra) {
  var h = { W: L.W, H: L.H, level: 1, seed: 1, tee: { x: 150, y: 300 }, hul: { x: 850, y: 300 }, par: 3, legs: 1, expert: 2,
    vaegge: L.borders(), sand: [], vand: [], skraaning: [] };
  for (var k in extra) h[k] = extra[k];
  return h;
}
function near(a, b, eps) { return Math.abs(a - b) <= eps; }

// ---------- Fysik ----------
test('bolden ruller ligeud og stopper (ingen vægge)', function () {
  var h = hole({ hul: { x: 900, y: 80 } });
  var r = L.simulate(h, h.tee, 0, 3);
  assert.strictEqual(r.result, 'stop');
  assert.ok(near(r.end.y, 300, 0.01), 'y ændrede sig: ' + r.end.y);
  assert.ok(near(r.end.x - 150, 3 * L.RULES.distPerPower, 12), 'rullede ' + (r.end.x - 150));
  assert.strictEqual(r.bounces.length, 0);
});
test('mere kraft = længere rul (monotont)', function () {
  var h = hole({ hul: { x: 900, y: 80 } }), last = 0;
  for (var p = 1; p <= 6; p++) { var d = L.simulate(h, h.tee, 0, p).end.x; assert.ok(d > last, 'kraft ' + p); last = d; }
});
test('bander: indfaldsvinkel = udfaldsvinkel, og farten falder', function () {
  var h = hole({ tee: { x: 300, y: 300 }, hul: { x: 900, y: 80 } });
  var r = L.simulate(h, h.tee, 45, 8);   // ned mod højre → rammer underkanten (y = 600)
  assert.ok(r.bounces.length >= 1, 'intet hop');
  var b = r.bounces[0];
  assert.ok(near(b.y, L.H - L.RULES.ballR, 2), 'hoppede ved y=' + b.y);
  // Punkter lige før og efter hoppet: x vokser, y skifter retning
  var i = r.path.findIndex(function (q) { return q.d >= b.d; });
  var before = r.path[Math.max(0, i - 3)], after = r.path[Math.min(r.path.length - 1, i + 3)];
  assert.ok(after.x > before.x, 'x vendte');
  var a1 = Math.atan2(b.y - before.y, b.x - before.x), a2 = Math.atan2(after.y - b.y, after.x - b.x);
  assert.ok(near(Math.abs(a1), Math.abs(a2), 0.15), 'vinkler ' + a1 + ' / ' + a2);
  // Ingen del af vejen går gennem kanten
  r.path.forEach(function (q) { assert.ok(q.y <= L.H - L.RULES.ballR + 0.5 && q.y >= L.RULES.ballR - 0.5 && q.x >= L.RULES.ballR - 0.5 && q.x <= L.W - L.RULES.ballR + 0.5); });
});
test('en indre bande stopper bolden (den går aldrig igennem)', function () {
  var h = hole({ vaegge: L.borders().concat([{ ax: 500, ay: 0, bx: 500, by: 600, t: 18 }]), hul: { x: 850, y: 300 } });
  for (var p = 1; p <= L.RULES.powers; p++) {
    var r = L.simulate(h, h.tee, 0, p);
    r.path.forEach(function (q) { assert.ok(q.x < 500, 'kraft ' + p + ' kom igennem ved x=' + q.x); });
  }
});
test('sand bremser bolden', function () {
  var h0 = hole({ hul: { x: 900, y: 80 } });
  var h1 = hole({ hul: { x: 900, y: 80 }, sand: [{ x: 300, y: 200, w: 300, h: 200 }] });
  var d0 = L.simulate(h0, h0.tee, 0, 6).end.x, d1 = L.simulate(h1, h1.tee, 0, 6).end.x;
  assert.ok(d1 < d0 - 50, 'sand ' + d1 + ' vs ' + d0);
});
test('en skråning trækker bolden til siden', function () {
  var h = hole({ hul: { x: 900, y: 80 }, skraaning: [{ x: 250, y: 150, w: 400, h: 300, dir: 90 }] });
  var r = L.simulate(h, h.tee, 0, 5);
  assert.ok(r.end.y > 310, 'y=' + r.end.y);
});
test('simuleringen er deterministisk', function () {
  var h = L.generate(5, 99);
  var a = L.simulate(h, h.tee, 33, 7), b = L.simulate(h, h.tee, 33, 7);
  assert.deepStrictEqual(a.end, b.end); assert.strictEqual(a.path.length, b.path.length);
});

// ---------- Hul og vand ----------
test('ligeud mod hullet: der findes en kraft, der går i hul', function () {
  var h = hole(), ok = [];
  for (var p = 1; p <= L.RULES.powers; p++) if (L.simulate(h, h.tee, 0, p).result === 'hul') ok.push(p);
  assert.ok(ok.length >= 1, 'ingen kraft gik i hul');
  var r = L.simulate(h, h.tee, 0, ok[0]);
  assert.ok(near(r.end.x, 850, 0.5) && near(r.end.y, 300, 0.5), 'slutter ikke i hullet');
});
test('for hård bold ruller hen over hullet', function () {
  var h = hole();
  var r = L.simulate(h, h.tee, 0, L.RULES.powers);
  assert.notStrictEqual(r.result, 'hul');
});
test('vand: result = vand', function () {
  var h = hole({ vand: [{ x: 420, y: 250, w: 160, h: 100 }] });
  assert.strictEqual(L.simulate(h, h.tee, 0, 10).result, 'vand');
});

// ---------- Forhåndslinjen ----------
test('forhåndslinjen (kort) stopper kort efter første hop', function () {
  var h = hole({ tee: { x: 300, y: 300 }, hul: { x: 900, y: 80 } });
  var full = L.simulate(h, h.tee, 45, 9), pv = L.preview(h, h.tee, 45, 9, 'kort');
  assert.ok(full.bounces.length >= 1 && full.length > full.bounces[0].d + L.RULES.preview.afterBounce + 20, 'vejen er for kort til testen');
  assert.strictEqual(pv.full, false);
  var last = pv.path[pv.path.length - 1];
  assert.ok(near(last.d, full.bounces[0].d + L.RULES.preview.afterBounce, 15), 'slutter ved ' + last.d);
});
test('forhåndslinjen (hel) viser hele vejen', function () {
  var h = hole({ tee: { x: 300, y: 300 }, hul: { x: 900, y: 80 } });
  var pv = L.preview(h, h.tee, 45, 9, 'hel');
  assert.strictEqual(pv.full, true);
  assert.deepStrictEqual(pv.path[pv.path.length - 1].x, L.simulate(h, h.tee, 45, 9).end.x);
});

// ---------- Runden ----------
function runOn(h) { var r = L.createRun({ seed: 5 }); r._setHole(h); return r; }
test('et slag tæller 1 og koster 1 fra puljen', function () {
  var r = runOn(hole({ hul: { x: 900, y: 80 } })), s = r.state, pool = s.pool;
  assert.strictEqual(pool, L.RULES.startReserve + 3);
  r.setAim(0); r.setPower(3);
  var res = r.strike();
  assert.ok(res.ok && !res.holed);
  assert.strictEqual(s.strokes, 1); assert.strictEqual(s.pool, pool - 1);
  assert.ok(s.ball.x > 150);
});
test('vand: +1 strafslag, bolden tilbage, puljen −2', function () {
  var r = runOn(hole({ vand: [{ x: 420, y: 250, w: 160, h: 100 }] })), s = r.state, pool = s.pool;
  r.setAim(0); r.setPower(10);
  var res = r.strike();
  assert.ok(res.water);
  assert.deepStrictEqual([s.strokes, s.penalties, s.pool, s.ball.x, s.ball.y], [2, 1, pool - 2, 150, 300]);
});
test('i hul: point, klaret, reserve = resten af puljen (+1 ved hole-in-one, højst 9)', function () {
  var h = hole(), p = 0;
  for (var k = 1; k <= 10; k++) if (L.simulate(h, h.tee, 0, k).result === 'hul') { p = k; break; }
  var r = runOn(h), s = r.state, pool = s.pool;
  r.setAim(0); r.setPower(p);
  var res = r.strike();
  assert.ok(res.holed);
  assert.ok(s.holed && s.cleared === 1 && s.score > 0);
  assert.strictEqual(s.reserve, Math.min(L.RULES.maxReserve, pool - 1 + L.RULES.holeInOneBonus));
  assert.strictEqual(s.lastPoints.holeInOne, L.RULES.points.holeInOne);
  assert.strictEqual(r.strike().ok, false, 'kan slå efter hul');
  assert.ok(r.nextHole());
  assert.deepStrictEqual([s.level, s.strokes, s.holed, s.pool], [2, 0, false, s.reserve + s.hole.par]);
});
test('reserven er højst ' + L.RULES.maxReserve, function () {
  var h = hole(), p = 0;
  for (var k = 1; k <= 10; k++) if (L.simulate(h, h.tee, 0, k).result === 'hul') { p = k; break; }
  var r = runOn(h); r.state.pool = 20; r.setAim(0); r.setPower(p); r.strike();
  assert.strictEqual(r.state.reserve, L.RULES.maxReserve); assert.ok(r.state.lastPoints.capped);
});
test('game over: puljen tom og bolden ikke i hul', function () {
  var r = runOn(hole({ hul: { x: 900, y: 80 } })), s = r.state;
  r.setAim(0); r.setPower(1);
  var guard = 0;
  while (!s.over && guard++ < 50) r.strike();
  assert.ok(s.over); assert.strictEqual(s.pool, 0);
  assert.strictEqual(s.strokes, L.RULES.startReserve + 3);
  assert.strictEqual(r.live(), false); assert.strictEqual(r.strike().ok, false); assert.strictEqual(r.nextHole(), false);
});
test('game over også når vandet tømmer puljen (aldrig negativ)', function () {
  var r = runOn(hole({ vand: [{ x: 420, y: 250, w: 160, h: 100 }] })), s = r.state;
  s.pool = 1; r.setAim(0); r.setPower(10); r.strike();
  assert.ok(s.over); assert.strictEqual(s.pool, 0);
});
test('det sidste slag går i hul: ikke game over', function () {
  var h = hole(), p = 0;
  for (var k = 1; k <= 10; k++) if (L.simulate(h, h.tee, 0, k).result === 'hul') { p = k; break; }
  var r = runOn(h); r.state.pool = 1; r.setAim(0); r.setPower(p); r.strike();
  assert.ok(r.state.holed && !r.state.over); assert.strictEqual(r.state.reserve, 0 + L.RULES.holeInOneBonus);
});
test('point: under par giver mere, over par mindre, aldrig under minimum', function () {
  var a = L.holePoints(4, 3, 1).total, b = L.holePoints(4, 4, 1).total, c = L.holePoints(4, 6, 1).total, d = L.holePoints(3, 20, 1).hole;
  assert.ok(a > b && b > c, [a, b, c].join(','));
  assert.strictEqual(d, L.RULES.points.min);
  assert.ok(L.holePoints(4, 4, 5).total > L.holePoints(4, 4, 1).total, 'højere hul giver ikke flere point');
});
test('retning og kraft holdes inden for grænserne', function () {
  var r = runOn(hole());
  assert.strictEqual(r.turnAim(-10), L.normAngle(r.state.aim));
  r.setAim(355); assert.strictEqual(r.turnAim(10), 5);
  assert.strictEqual(r.setPower(0), 1); assert.strictEqual(r.setPower(99), L.RULES.powers);
});
test('end() afslutter runden og returnerer point og huller', function () {
  var r = runOn(hole()); r.state.score = 140; r.state.cleared = 2;
  assert.deepStrictEqual(r.end(), { score: 140, cleared: 2 });
  assert.strictEqual(r.live(), false);
});

// ---------- Genererede huller ----------
test('genererede huller: deterministiske, kan løses, par 2–6, sværere med tiden', function () {
  var a = L.generate(3, 1234), b = L.generate(3, 1234);
  assert.deepStrictEqual(a, b);
  var walls1 = 0, walls9 = 0, zones9 = 0;
  for (var s = 0; s < 6; s++) {
    var h1 = L.generate(1, 100 + s), h9 = L.generate(9, 200 + s);
    [h1, h9].forEach(function (h) {
      assert.ok(h.par >= 2 && h.par <= 6, 'par ' + h.par);
      assert.ok(h.expert >= 1 && h.expert < h.par + 1, 'ekspert ' + h.expert);
      assert.ok(L.analyse(h), 'kan ikke nås');
      assert.ok(!h.vand.some(function (z) { return L.inRect(h.tee, z, L.RULES.ballR) || L.inRect(h.hul, z, L.RULES.holeR); }), 'vand på tee/hul');
    });
    walls1 += h1.vaegge.length; walls9 += h9.vaegge.length; zones9 += h9.sand.length + h9.vand.length + h9.skraaning.length;
  }
  assert.ok(walls9 > walls1, 'flere bander senere: ' + walls1 + ' / ' + walls9);
  assert.ok(zones9 > 0, 'ingen sand/vand/skråning på hul 9');
});
test('en hel runde: 15 huller med en simpel spiller (ingen fejl, puljen holder regnskab)', function () {
  var r = L.createRun({ seed: 42 }), s = r.state, holes = 0;
  while (!s.over && holes < 15) {
    var tries = 0;
    while (r.live() && tries++ < 12) {
      // Bedste af 36 retninger × 10 kræfter mod hullet (grådig)
      var best = null;
      for (var a = 0; a < 360; a += 10) for (var p = 1; p <= 10; p++) {
        var sim = L.simulate(s.hole, s.ball, a, p);
        var d = sim.result === 'hul' ? -1 : sim.result === 'vand' ? 1e9 : Math.hypot(sim.end.x - s.hole.hul.x, sim.end.y - s.hole.hul.y);
        if (!best || d < best.d) best = { a: a, p: p, d: d };
      }
      r.setAim(best.a); r.setPower(best.p);
      var pool = s.pool, st = s.strokes, res = r.strike();
      assert.strictEqual(s.strokes - st, res.water ? 2 : 1);
      if (!res.holed && !s.over) assert.strictEqual(pool - s.pool, res.water ? 2 : 1);
    }
    if (s.holed) { holes++; r.nextHole(); } else if (r.live()) break;
  }
  assert.ok(holes >= 1, 'klarede ingen huller');
  console.log('     (klarede ' + holes + ' huller, ' + s.score + ' point, game over: ' + s.over + ')');
});

console.log('\n' + (n - failed) + ' af ' + n + ' test bestået');
process.exit(failed ? 1 : 0);
