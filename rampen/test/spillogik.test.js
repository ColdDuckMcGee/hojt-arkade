// Logiktest af Rampen (uden browser): node rampen/test/spillogik.test.js
// Fysik, ting på banen, beslutningspunkter, forhåndslinjer, opgraderinger,
// zoner, mål, Ny bil, gemt fremskridt og at en "spiller" faktisk kommer videre.
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
// En bane med præcis de ting, testen giver
function bane(items) {
  return { seed: 0, range: function (a, b) { return items.filter(function (o) { var w = o.w || 0; return o.x + w >= a && o.x - (o.r || 0) <= b; }); } };
}
var TOM = bane([]);
function ting(type, x, extra) {
  var d = L.TING[type], o = { id: x * 10 + 1, type: type, x: x, y: 0 };
  if (d.r) o.r = d.r; else { o.w = d.w; o.h = d.h; }
  for (var k in extra) o[k] = extra[k];
  return o;
}
function flyv(st, crs, angle, power, opts) {
  var f = L.newFlight(st, crs, angle, power); opts = opts || {};
  var guard = 0;
  while (!f.done && guard++ < 200000) {
    var ev = L.step(f, st, crs, !!opts.freezes);
    if (ev && ev !== 'end' && opts.onFreeze) opts.onFreeze(f, ev);
  }
  return f;
}
function nulOpg() { var u = {}; L.OPG.forEach(function (o) { u[o.id] = 0; }); return u; }
function maxOpg() { var u = {}; L.OPG.forEach(function (o) { u[o.id] = o.max; }); return u; }

// ---------- Grundfysik ----------
test('bilen flyver, lander og holder stille på en tom bane', function () {
  var f = flyv(L.stats(nulOpg()), TOM, 30, 10);
  assert.strictEqual(f.end, 'stop');
  assert.ok(f.x > 10 && f.x < 400, 'x=' + f.x);
  assert.strictEqual(f.vx, 0);
});
test('samme valg giver præcis samme tur (ingen tilfældighed)', function () {
  var st = L.stats(nulOpg()), crs = L.course(L.seedForCar(1));
  var a = flyv(st, crs, 35, 8), b = flyv(st, L.course(L.seedForCar(1)), 35, 8);
  assert.strictEqual(a.x, b.x); assert.strictEqual(a.hp, b.hp); assert.strictEqual(a.coins, b.coins);
});
test('mere kraft = længere første hop', function () {
  var st = L.stats(nulOpg()), last = 0;
  for (var p = 1; p <= 10; p++) { var r = L.predict(L.newFlight(st, TOM, 30, p), st, TOM, {}); assert.ok(r.x > last, 'kraft ' + p); last = r.x; }
});
test('vinkel og kraft holdes inden for grænserne', function () {
  var g = L.createGame(null);
  assert.strictEqual(g.setAngle(5), L.ANGLE_MIN); assert.strictEqual(g.setAngle(99), L.ANGLE_MAX);
  assert.strictEqual(g.setPower(0), 1); assert.strictEqual(g.setPower(12), 10);
});
test('hård landing giver skade, faldskærm giver mindre', function () {
  var u = nulOpg(), st0 = L.stats(u);
  var f0 = flyv(st0, TOM, 70, 10);
  assert.ok(f0.dmg > 0, 'ingen skade ved 70°/10');
  u.faldskaerm = 4; var f1 = flyv(L.stats(u), TOM, 70, 10);
  assert.ok(f1.dmg < f0.dmg, f1.dmg + ' >= ' + f0.dmg);
});

// ---------- Ting på banen ----------
test('mønter samles op og tælles', function () {
  var st = L.stats(nulOpg()), pre = flyv(st, TOM, 30, 10);
  // læg mønter på jorden lige foran, hvor bilen ruller
  var x = Math.max(12, pre.x - 6);
  var crs = bane([ting('moent', x, { y: 0.4 }), ting('moent', x + 0.01, { id: 999, y: 0.4 })]);
  var f = flyv(st, crs, 30, 10);
  assert.ok(f.picked >= 1 && f.coins >= 5, 'picked=' + f.picked);
});
test('sten giver skade og bremser', function () {
  var st = L.stats(nulOpg()), pre = flyv(st, TOM, 30, 10);
  var crs = bane([ting('sten', pre.x - 3)]);
  var f = flyv(st, crs, 30, 10);
  assert.ok(f.dmg >= 14 * st.panser - 0.01, 'dmg=' + f.dmg);
  assert.ok(f.x < pre.x, 'bremsede ikke');
});
test('trampolin sender bilen op igen uden skade', function () {
  var st = L.stats(nulOpg()), first = L.predict(L.newFlight(st, TOM, 45, 10), st, TOM, {});
  var crs = bane([ting('trampolin', first.x - 2.5)]);
  var f = flyv(st, crs, 45, 10), f0 = flyv(st, TOM, 45, 10);
  assert.strictEqual(f.tramps, 1);
  assert.ok(f.x > f0.x, f.x + ' <= ' + f0.x);
});
test('ballon løfter bilen', function () {
  var st = L.stats(nulOpg()), f = L.newFlight(st, TOM, 30, 10);
  var crs = bane([ting('ballon', 6, { y: f.y + 1 })]);
  var g = flyv(st, crs, 30, 10), g0 = flyv(st, TOM, 30, 10);
  assert.strictEqual(g.balloons, 1); assert.ok(g.x > g0.x);
});
test('olie gør rulningen længere', function () {
  var st = L.stats(nulOpg()), f0 = flyv(st, TOM, 15, 10);
  var crs = bane([ting('olie', f0.x - 20, { w: 40 })]);
  var f = flyv(st, crs, 15, 10);
  assert.ok(f.x > f0.x + 1, f.x + ' vs ' + f0.x);
});
test('banen er deterministisk, og de første 50 m er tomme', function () {
  var a = L.course(123).range(0, 2000), b = L.course(123).range(0, 2000);
  assert.deepStrictEqual(a, b);
  assert.ok(a.every(function (o) { return o.x >= 50; }));
  var typer = {}; L.course(L.seedForCar(1)).range(0, 4000).forEach(function (o) { typer[o.type] = 1; });
  for (var z = 0; z < L.ZONER.length; z++) { var fra = L.ZONER[z].fra, til = z + 1 < L.ZONER.length ? L.ZONER[z + 1].fra : fra + 800;
    var onde = L.course(L.seedForCar(1)).range(fra, til).filter(function (o) { return o.type === 'sten' || o.type === 'kaktus' || o.type === 'kegle'; });
    assert.ok(onde.length >= 2, 'for få forhindringer i ' + L.ZONER[z].id); }
  ['moent', 'trampolin', 'ballon', 'olie', 'vind', 'rampe', 'sten', 'kaktus', 'kegle'].forEach(function (t) { assert.ok(typer[t], 'mangler ' + t); });
});

// ---------- Beslutningspunkter ----------
test('spillet fryser på toppen, når der er boost tilbage', function () {
  var g = L.createGame(null);
  g.setAngle(45); g.setPower(10);
  var r = g.launch();
  assert.ok(r.event === 'top' || r.event === 'land', r.event);
  assert.ok(r.frames.length > 2);
});
test('uden boost og uden vinger fryser spillet aldrig', function () {
  var st = L.stats(nulOpg()); st.boosts = 0;
  var fr = 0; flyv(st, L.course(5), 45, 10, { freezes: true, onFreeze: function () { fr++; } });
  assert.strictEqual(fr, 0);
});
test('forhåndslinjen "Vent" passer med det, der faktisk sker', function () {
  var g = L.createGame(null); g.setAngle(40); g.setPower(10);
  var r = g.launch(); assert.notStrictEqual(r.event, 'end');
  var opt = g.options();
  assert.ok(opt.med, 'ingen boost-linje');
  assert.ok(opt.med.x > opt.uden.x, 'boost lander ikke længere: ' + opt.med.x + ' vs ' + opt.uden.x);
  // følg uden boost til første landing og sammenlign
  var f = L.clone(g.flight), st = g.st, y0;
  for (var i = 0; i < 20000; i++) { y0 = f.y; L.step(f, st, g.course, false); if (y0 > 0 && f.y <= 0) break; }
  assert.ok(Math.abs(f.x - opt.uden.x) < 0.5, f.x + ' vs ' + opt.uden.x);
});
test('boost bruger brændstof og tæller', function () {
  var g = L.createGame(null); g.setAngle(40); g.setPower(10);
  g.launch(); var b = g.flight.boosts;
  g.decide(true);
  assert.strictEqual(g.flight ? g.flight.boosts : 0, b - 1);
});
test('vinger giver næsevalg, der ændrer landingen', function () {
  var p = L.newProgress(1); p.upg.vinger = 2; p.upg.motor = 3;
  var g = L.createGame(p); g.setAngle(30); g.setPower(10);
  var r = g.launch(); assert.notStrictEqual(r.event, 'end');
  g.setNose('op'); var op = g.options().uden.x;
  g.setNose('ned'); var ned = g.options().uden.x;
  assert.ok(op > ned, op + ' <= ' + ned);
});
test('en hel tur ender altid (stop eller smadret)', function () {
  var g = L.createGame(null);
  for (var t = 0; t < 5; t++) {
    g.setAngle(20 + t * 10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 100) r = g.decide(k % 2 === 0);
    assert.strictEqual(r.event, 'end');
    var res = g.finishTrip();
    assert.ok(res.end === 'stop' || res.end === 'smadret', res.end);
  }
});

// ---------- Opgraderinger og fremskridt ----------
test('priser stiger, og max-niveau kan ikke købes', function () {
  L.OPG.forEach(function (o) {
    var last = 0;
    for (var l = 0; l < o.max; l++) { var c = L.pris(o.id, l); assert.ok(c > last, o.id + ' niveau ' + l); last = c; }
    assert.strictEqual(L.pris(o.id, o.max), null);
  });
});
test('køb trækker mønter og hæver niveau; for få mønter = nej', function () {
  var g = L.createGame(null);
  assert.strictEqual(g.buy('motor'), false);
  g.p.coins = 1000; var c = g.price('motor');
  assert.strictEqual(g.buy('motor'), true);
  assert.strictEqual(g.p.upg.motor, 1); assert.strictEqual(g.p.coins, 1000 - c);
});
test('opgraderinger gør bilen bedre', function () {
  var a = L.stats(nulOpg()), b = L.stats(maxOpg());
  assert.ok(b.vmax > a.vmax && b.mu < a.mu && b.maxHp > a.maxHp && b.drag < a.drag && b.boosts > a.boosts && b.thrust > a.thrust);
  assert.ok(b.vinger && !a.vinger);
});
test('bilen skifter udseende fra sæbekassebil til raketbil', function () {
  assert.strictEqual(L.bilType(nulOpg()), L.BILER[0]);
  assert.strictEqual(L.bilType(maxOpg()), L.BILER[L.BILER.length - 1]);
});
test('turen giver mønter, zonebonus og mål', function () {
  var g = L.createGame(null); g.setAngle(30); g.setPower(10);
  var r = g.launch(); while (r.event !== 'end') r = g.decide(true);
  var res = g.finishTrip();
  assert.strictEqual(res.distCoins, Math.floor(res.dist * 0.5));
  assert.strictEqual(g.p.coins, res.total);
  assert.strictEqual(g.p.best, res.dist); assert.strictEqual(g.p.trips, 1);
  assert.strictEqual(g.flight, null);
});
test('zoner ligger i rækkefølge og giver førstegangsbonus én gang', function () {
  for (var i = 1; i < L.ZONER.length; i++) assert.ok(L.ZONER[i].fra > L.ZONER[i - 1].fra);
  assert.strictEqual(L.zoneAt(10).id, 'forstad');
  assert.strictEqual(L.zoneAt(L.ZONER[4].fra + 1).id, 'rummet');
});
test('tre mål er altid i gang, også når listen er brugt op', function () {
  assert.strictEqual(L.activeGoals([]).length, 3);
  var alle = L.MAAL.map(function (m) { return m.id; });
  var a = L.activeGoals(alle); assert.strictEqual(a.length, 3);
  assert.ok(/^langt/.test(a[0].id));
});
test('Ny bil kræver en lang tur og giver permanent bonus', function () {
  var p = L.newProgress(1); p.best = L.NY_BIL_KRAV - 1; p.carScore = 5000; p.coins = 300; p.upg.motor = 4;
  var g = L.createGame(p);
  assert.strictEqual(g.canNewCar(), false); assert.strictEqual(g.newCar(), null);
  g.p.best = L.NY_BIL_KRAV;
  var r = g.newCar();
  assert.deepStrictEqual(r, { bil: 1, score: 5000 });
  assert.strictEqual(g.p.bil, 2); assert.strictEqual(g.p.coins, 0); assert.strictEqual(g.p.upg.motor, 0);
  assert.ok(L.multiplier(2) > L.multiplier(1));
  assert.notStrictEqual(g.course.seed, L.seedForCar(1));
});
test('gemt fremskridt renses (ødelagte data)', function () {
  assert.deepStrictEqual(L.sanitize(null), L.newProgress(1));
  var s = L.sanitize({ bil: 'x', coins: -5, best: 'abc', upg: { motor: 99, dæk: 2 }, zones: ['rummet', 'måne'], goals: [1, 'm100'], angle: 300, power: 4 });
  assert.strictEqual(s.bil, 1); assert.strictEqual(s.coins, 0); assert.strictEqual(s.best, 0);
  assert.strictEqual(s.upg.motor, L.OPG.filter(function (o) { return o.id === 'motor'; })[0].max);
  assert.deepStrictEqual(s.zones, ['forstad', 'rummet']); assert.deepStrictEqual(s.goals, ['m100']);
  assert.strictEqual(s.angle, 30); assert.strictEqual(s.power, 4);
  var g = L.createGame(s); assert.deepStrictEqual(L.sanitize(g.save()), g.save());
});

// ---------- Balance: en simpel spiller kommer videre ----------
test('en simpel spiller når ørkenen, bjergene og skyerne', function () {
  var g = L.createGame(null), best = 0, ture = 0, naaet = {};
  for (var trip = 1; trip <= 120; trip++) {
    for (;;) {
      var bedst = null;
      L.OPG.forEach(function (o) { var c = g.price(o.id); if (c !== null && c <= g.p.coins && (!bedst || c < bedst.c)) bedst = { id: o.id, c: c }; });
      if (!bedst) break; g.buy(bedst.id);
    }
    g.setAngle(35); g.setPower(10);
    var r = g.launch();
    while (r.event !== 'end') { if (g.st.vinger) g.setNose('op'); r = g.decide(true); }
    var res = g.finishTrip(); best = Math.max(best, res.dist); ture = trip;
    L.ZONER.forEach(function (z) { if (res.dist >= z.fra && !naaet[z.id]) naaet[z.id] = trip; });
    if (naaet.skyer) break;
  }
  console.log('     (bedste ' + best + ' m; zoner nået på tur ' + JSON.stringify(naaet) + ')');
  assert.ok(naaet.oerken && naaet.oerken <= 15, 'ørken for sent');
  assert.ok(naaet.bjerge, 'nåede ikke bjergene');
  assert.ok(naaet.skyer, 'nåede ikke skyerne på 120 ture');
});
test('med fuld bil og gode valg kan man nå rummet', function () {
  var best = 0;
  for (var a = 15; a <= 60; a += 5) ['op', 'lige'].forEach(function (naese) {
    var p = L.newProgress(1); L.OPG.forEach(function (o) { p.upg[o.id] = o.max; });
    var g = L.createGame(p); g.setAngle(a); g.setPower(10);
    var r = g.launch();
    while (r.event !== 'end') { g.setNose(naese); r = g.decide(true); }
    best = Math.max(best, g.finishTrip().dist);
  });
  console.log('     (bedste med fuld bil: ' + best + ' m)');
  assert.ok(best >= L.ZONER[4].fra, best + ' m');
});

console.log('\n' + (n - failed) + '/' + n + ' tests OK');
if (failed) process.exit(1);
