// Logiktest af Rampen (uden browser): node rampen/test/spillogik.test.js
// Fysik, ting på banen, beslutningspunkter, valgkort, skjult vind og landingsfelter,
// udsyn, ny bane pr. tur, opgraderinger, zoner, mål, Ny bil, gemt fremskridt og balance.
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

// ---------- Beslutningspunkter og valgkort ----------
function vindstille() { return { bx: 0, by: 0, s: 0 }; }
function tilTop(st, crs, angle, power, vind) {
  var f = L.newFlight(st, crs, angle, power, vind || vindstille());
  var r = L.advance(f, st, crs); return { f: f, ev: r.event };
}
test('spillet fryser på toppen og viser 2-3 valgkort med hvert sit felt', function () {
  var g = L.createGame(null);
  g.setAngle(45); g.setPower(10);
  var r = g.launch();
  assert.strictEqual(r.event, 'top');
  assert.ok(r.frames.length > 2);
  var k = g.cards();
  assert.ok(k.length >= 2 && k.length <= 3, k.length + ' kort');
  k.forEach(function (c) { assert.ok(c.titel && c.effekt && c.felt && c.felt.til > c.felt.fra, c.id); });
});
test('kun ét beslutningspunkt pr. bue: toppen (aldrig før landing)', function () {
  var p = L.newProgress(1); Object.assign(p.upg, { motor: 6, daek: 4, raket: 3, braendstof: 3, vinger: 2, aero: 3, karrosseri: 3 });
  [0, 1, 2].forEach(function (valg) {
    var g = L.createGame(p); g.setAngle(35); g.setPower(10);
    var r = g.launch(), k = 0, tops = 0;
    while (r.event !== 'end' && k++ < 200) {
      assert.strictEqual(r.event, 'top');
      var f = g.flight; assert.ok(f.vy <= 0 && f.y >= 3, 'ikke på toppen: y=' + f.y + ' vy=' + f.vy);
      var c = g.cards(); tops++; r = g.decide(c[Math.min(valg, c.length - 1)].id);
    }
    assert.ok(tops >= 1);
  });
});
test('et boost giver en ny bue med et nyt beslutningspunkt på toppen', function () {
  var p = L.newProgress(1); Object.assign(p.upg, { motor: 3, daek: 2, raket: 2, braendstof: 2 });
  var g = L.createGame(p); g.setAngle(35); g.setPower(10);
  var r = g.launch(); assert.strictEqual(r.event, 'top');
  var x1 = g.flight.x, l1 = g.flight.landings;
  r = g.decide('boost'); assert.strictEqual(r.event, 'top');
  assert.ok(g.flight.x > x1 && g.flight.landings === l1, 'ny top uden landing ventet');
});
test('uden boost, vinger og mål inden for udsyn fryser spillet aldrig', function () {
  var st = L.stats(nulOpg()); st.boosts = 0;
  var t = tilTop(st, TOM, 45, 10);
  assert.strictEqual(t.ev, 'end');
});
test('boost bruger brændstof og tæller', function () {
  var g = L.createGame(null); g.setAngle(40); g.setPower(10);
  g.launch(); var b = g.flight.boosts;
  g.decide('boost');
  assert.strictEqual(g.flight ? g.flight.boosts : 0, b - 1);
  assert.strictEqual(g.flight.boostsUsed, 1);
});
test('næse op flyver længere end næse ned, men lander hårdere', function () {
  var p = L.newProgress(1); p.upg.vinger = 3; p.upg.motor = 6;
  var st = L.stats(p.upg), t = tilTop(st, TOM, 45, 10);
  assert.strictEqual(t.ev, 'top');
  var op = L.predict(t.f, st, TOM, { nose: 'op' }), lige = L.predict(t.f, st, TOM, {}), ned = L.predict(t.f, st, TOM, { nose: 'ned' });
  assert.ok(op.x > ned.x, op.x + ' <= ' + ned.x);
  assert.ok(op.hp < lige.hp, 'op ' + op.hp + ' vs lige ' + lige.hp);
  assert.ok(ned.hp >= lige.hp, 'ned ' + ned.hp + ' vs lige ' + lige.hp);
});
test('en hel tur ender altid (stop eller smadret)', function () {
  var g = L.createGame(null);
  for (var t = 0; t < 5; t++) {
    g.setAngle(20 + t * 10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 100) { var c = g.cards(); r = g.decide(c[k % c.length].id); }
    assert.strictEqual(r.event, 'end');
    var res = g.finishTrip();
    assert.ok(res.end === 'stop' || res.end === 'smadret', res.end);
  }
});

// ---------- v1.2: skjult landing, udsyn, ny bane, valgkort ----------
test('intet præcist landingstal: opsendelsen viser kun starten af buen, felter er brede og runde', function () {
  var g = L.createGame(null); g.setAngle(35); g.setPower(10);
  var pv = g.launchPreview();
  assert.strictEqual(pv.x, undefined, 'forhåndslinjen afslører en landing');
  assert.strictEqual(pv.landed, undefined);
  var fuld = L.runToTouch(L.newFlight(g.stats(), TOM, 35, 10, vindstille()), g.stats(), TOM);
  var sidst = pv.pts[pv.pts.length - 1];
  assert.ok(sidst.x < fuld.x * 0.3, 'forhåndslinjen er for lang: ' + sidst.x + ' af ' + fuld.x);
  g.launch();
  g.cards().forEach(function (c) {
    assert.strictEqual(c.felt.fra % 5, 0); assert.strictEqual(c.felt.til % 5, 0);
    assert.ok(c.felt.til - c.felt.fra >= 10, c.id + ' felt ' + c.felt.fra + '-' + c.felt.til);
    assert.ok(c.felt.x === undefined && c.x === undefined, 'kort med præcis landing');
  });
});
function feltData(instr, tom, antal) {
  var bredder = [], inde = 0, alle = 0, rel = [];
  for (var s = 0; s < antal; s++) {
    var p = L.newProgress(1); Object.assign(p.upg, { motor: 4, vinger: 2, braendstof: 2, daek: 2, raket: 2, instrumenter: instr });
    p.seed = 1000 + s * 31; p.trips = s;
    var g = L.createGame(p); if (tom) g.course.range = function () { return []; };
    g.setAngle(30 + (s % 4) * 8); g.setPower(10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 30) {
      var c = g.cards(), q = c[s % c.length], f = g.flight;
      r = g.decide(q.id);
      if (f.touchX !== null) {
        alle++; bredder.push(q.felt.til - q.felt.fra);
        if (f.touchX >= q.felt.fra && f.touchX <= q.felt.til) inde++;
        rel.push((f.touchX - q.felt.raaFra) / Math.max(0.01, q.felt.raaTil - q.felt.raaFra));
      }
    }
  }
  var snit = bredder.reduce(function (a, b) { return a + b; }, 0) / bredder.length;
  return { snit: snit, min: Math.min.apply(null, bredder), inde: inde, alle: alle, rel: rel };
}
var F0 = feltData(0, true, 60), F3 = feltData(3, true, 60), F5 = feltData(5, true, 60);
test('landingsfeltet bliver smallere med Instrumenter, men aldrig helt præcist', function () {
  console.log('     (snitbredde: niv. 0 ' + F0.snit.toFixed(1) + ' m, niv. 3 ' + F3.snit.toFixed(1) + ' m, niv. 5 ' + F5.snit.toFixed(1) + ' m)');
  assert.ok(F0.snit > F3.snit && F3.snit > F5.snit);
  assert.ok(F5.min >= 10, 'niveau 5 er præcist');
  assert.ok(L.stats({ instrumenter: 5 }).usikker > 0);
});
test('udfaldet lander inden for feltet og varierer faktisk i feltet', function () {
  [F0, F3, F5].forEach(function (F) { assert.strictEqual(F.inde, F.alle, F.inde + '/' + F.alle + ' inden for feltet'); });
  var rel = F0.rel, snit = rel.reduce(function (a, b) { return a + b; }, 0) / rel.length;
  var sd = Math.sqrt(rel.reduce(function (a, b) { return a + (b - snit) * (b - snit); }, 0) / rel.length);
  assert.ok(sd > 0.1, 'udfaldet ligger altid samme sted i feltet (sd ' + sd.toFixed(2) + ')');
  assert.ok(Math.min.apply(null, rel) < 0.3 && Math.max.apply(null, rel) > 0.7, 'udfaldet bruger ikke hele feltet');
  // på en rigtig bane (skjulte ting kan skubbe ud af feltet) — langt de fleste lander i feltet
  var B = feltData(0, false, 60);
  console.log('     (rigtig bane: ' + B.inde + '/' + B.alle + ' inden for feltet)');
  assert.ok(B.inde / B.alle >= 0.9);
});
test('den skjulte vind er rigtig: samme opsendelse lander forskelligt fra tur til tur', function () {
  var u = nulOpg(); u.motor = 6; u.vinger = 2;
  var st = L.stats(u), xs = [];
  for (var s = 1; s <= 12; s++) {
    var f = L.newFlight(st, TOM, 35, 10, L.windFor(L.seedForTrip(1, s)));
    xs.push(L.runToTouch(f, st, TOM).x);
  }
  var spred = Math.max.apply(null, xs) - Math.min.apply(null, xs);
  console.log('     (samme opsendelse, 12 ture: ' + Math.round(Math.min.apply(null, xs)) + '-' + Math.round(Math.max.apply(null, xs)) + ' m)');
  assert.ok(spred >= 8, 'vinden gør næsten ingen forskel: ' + spred.toFixed(1) + ' m');
});
test('ny bane pr. tur (deterministisk), og en afbrudt tur kan genoptages', function () {
  assert.strictEqual(L.seedForTrip(1, 4), L.seedForTrip(1, 4));
  var g = L.createGame(null), seeds = {}, baner = {};
  for (var t = 0; t < 4; t++) {
    seeds[g.p.seed] = 1; baner[JSON.stringify(g.course.range(50, 400).map(function (o) { return o.type + Math.round(o.x); }))] = 1;
    g.setAngle(35); g.setPower(10);
    var r = g.launch(); while (r.event !== 'end') r = g.decide(false);
    g.finishTrip();
  }
  assert.strictEqual(Object.keys(seeds).length, 4); assert.strictEqual(Object.keys(baner).length, 4);
  // Gem midt i en tur, genindlæs og fortsæt: præcis samme resultat
  var p = L.newProgress(1); Object.assign(p.upg, { motor: 4, braendstof: 2, raket: 2 });
  var a = L.createGame(p); a.setAngle(40); a.setPower(10);
  assert.strictEqual(a.launch().event, 'top');
  var gemt = JSON.parse(JSON.stringify(a.save()));
  assert.ok(gemt.tur, 'turen blev ikke gemt');
  var b = L.createGame(gemt);
  assert.ok(b.flight && b.flight.x === a.flight.x);
  var ra = a.decide('boost'), rb = b.decide('boost');
  while (ra.event !== 'end') ra = a.decide(false);
  while (rb.event !== 'end') rb = b.decide(false);
  assert.strictEqual(a.flight.x, b.flight.x);
  assert.strictEqual(a.finishTrip().total, b.finishTrip().total);
});
test('ting uden for udsynet er skjulte; Instrumenter giver lidt længere udsyn', function () {
  var g = L.createGame(null); g.setAngle(35); g.setPower(10); g.launch();
  var lim = g.udsyn(), syn = g.synlige();
  assert.ok(syn.every(function (o) { return o.x - (o.r || 0) <= lim; }));
  assert.ok(g.course.range(lim, lim + 400).some(function (o) { return o.x - (o.r || 0) > lim; }), 'testbanen har intet længere fremme');
  g.cards().forEach(function (c) {
    c.felt.pts.forEach(function (q) { assert.ok(q.x <= lim + 0.5, 'kortets linje går forbi udsynet'); });
    if (c.maal) assert.ok(c.maal.x <= lim, 'mål uden for udsyn');
  });
  assert.ok(L.stats({ instrumenter: 5 }).udsyn > L.stats({}).udsyn);
  assert.ok(L.stats({}).udsyn >= 30 && L.stats({ instrumenter: 5 }).udsyn <= 50);
});
test('valgkortene afhænger af situationen', function () {
  var u = nulOpg(); u.braendstof = 1; u.motor = 3;
  var st = L.stats(u), t = tilTop(st, TOM, 40, 10);
  assert.strictEqual(t.ev, 'top');
  var ids = function (cs) { return cs.map(function (c) { return c.id; }).join(','); };
  assert.strictEqual(ids(L.cards(t.f, st, TOM)), 'boost,vent', 'tom bane, boost, ingen vinger');
  // uden boost: intet boostkort
  var f0 = L.clone(t.f); f0.boosts = 0;
  assert.ok(L.cards(f0, st, TOM).every(function (c) { return c.id !== 'boost'; }));
  // med vinger: næsekort i stedet for knapper
  var uv = nulOpg(); uv.braendstof = 1; uv.motor = 3; uv.vinger = 2;
  var stv = L.stats(uv), tv = tilTop(stv, TOM, 40, 10);
  var iv = ids(L.cards(tv.f, stv, TOM));
  assert.ok(/op|ned/.test(iv), iv);
  // en ballon inden for udsyn langs banen giver "Tag ballonen" — samme ballon uden for udsyn gør ikke
  var bane0 = L.predict(t.f, st, TOM, {}).pts, mid = bane0[Math.floor(bane0.length * 0.6)];
  var nær = bane([ting('ballon', mid.x, { y: mid.y + 1.5 })]);
  var kn = L.cards(t.f, st, nær);
  assert.ok(kn.some(function (c) { return c.id === 'sigt' && /ballon/i.test(c.titel); }), ids(kn));
  var fjern = bane([ting('ballon', t.f.x + st.udsyn + 15, { y: 6 })]);
  assert.ok(L.cards(t.f, st, fjern).every(function (c) { return c.id !== 'sigt'; }));
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
  assert.strictEqual(res.distCoins, Math.floor(res.dist * 0.35));
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

// ---------- Balance: en simpel spiller kommer frem, men det tager tid ----------
function spiller(maxTure) {
  var g = L.createGame(null), best = 0, naaet = {};
  for (var trip = 1; trip <= maxTure; trip++) {
    for (;;) {
      var bedst = null;
      L.OPG.forEach(function (o) { var c = g.price(o.id); if (c !== null && c <= g.p.coins && (!bedst || c < bedst.c)) bedst = { id: o.id, c: c }; });
      if (!bedst) break; g.buy(bedst.id);
    }
    g.setAngle(35); g.setPower(10);
    var r = g.launch();
    while (r.event !== 'end') {
      var c = g.cards(), f = g.flight, pick = c[0].id, bs = -1e9;
      c.forEach(function (q) { var s = (q.felt.fra + q.felt.til) / 2 - f.x - 150 * q.felt.skadeMax / g.st.maxHp - (q.felt.smadret ? 200 : 0) + (q.id === 'sigt' ? 15 : 0) - (q.id === 'boost' ? 10 : 0); if (s > bs) { bs = s; pick = q.id; } });
      r = g.decide(pick);
    }
    var res = g.finishTrip(); best = Math.max(best, res.dist);
    L.ZONER.forEach(function (z) { if (res.dist >= z.fra && !naaet[z.id]) naaet[z.id] = trip; });
    if (naaet.skyer) break;
  }
  return { best: best, naaet: naaet };
}
test('en spiller når ørkenen, bjergene og skyerne, men ikke for hurtigt', function () {
  var s = spiller(120);
  console.log('     (bedste ' + s.best + ' m; zoner nået på tur ' + JSON.stringify(s.naaet) + ')');
  assert.ok(s.naaet.oerken >= 12 && s.naaet.oerken <= 25, 'ørken på tur ' + s.naaet.oerken);
  assert.ok(s.naaet.bjerge, 'nåede ikke bjergene');
  assert.ok(s.naaet.skyer && s.naaet.skyer >= 30 && s.naaet.skyer <= 70, 'skyer på tur ' + s.naaet.skyer);
});
test('med fuld bil og gode valg kan man nå rummet', function () {
  var best = 0;
  for (var a = 15; a <= 60; a += 5) for (var s = 0; s < 3; s++) {
    var p = L.newProgress(1); L.OPG.forEach(function (o) { p.upg[o.id] = o.max; }); p.seed = 777 + s * 13 + a;
    var g = L.createGame(p); g.setAngle(a); g.setPower(10);
    var r = g.launch();
    while (r.event !== 'end') {
      var c = g.cards(), f = g.flight, pick = c[0].id, bs = -1e9;
      c.forEach(function (q) { var v = (q.felt.fra + q.felt.til) / 2 - f.x - 150 * q.felt.skadeMax / g.st.maxHp - (q.felt.smadret ? 200 : 0); if (v > bs) { bs = v; pick = q.id; } });
      r = g.decide(pick);
    }
    best = Math.max(best, g.finishTrip().dist);
  }
  console.log('     (bedste med fuld bil: ' + best + ' m)');
  assert.ok(best >= L.ZONER[4].fra, best + ' m');
});

console.log('\n' + (n - failed) + '/' + n + ' tests OK');
if (failed) process.exit(1);
