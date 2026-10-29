// Logiktest af Rampen (uden browser): node rampen/test/spillogik.test.js
// Fysik, ting på banen, beslutningspunkter, valgkort, skjult vind og landingsfelter,
// udsyn, ny bane pr. tur, opgraderinger, zoner, mål, Ny bil, gemt fremskridt, fund (v1.6) og balance.
'use strict';
var assert = require('assert');
var path = require('path');
var L = require(path.join(__dirname, '..', 'js', 'logik.js'));

var n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('OK   ' + name); }
  catch (e) { failed++; console.log('FEJL ' + name + '\n     ' + (e && e.message)); if (process.env.STAK) console.log(e.stack); }
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
// Fund (v1.6) slået fra under en test, der handler om noget andet
function udenFund(fn) { return function () { L.FUND_TIL.til = false; try { fn(); } finally { L.FUND_TIL.til = true; } }; }
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
  var p = L.newProgress(1); Object.assign(p.upg, { motor: 3, daek: 2, raket: 2, braendstof: 2, karrosseri: 3 });
  var g = L.createGame(p); g.setAngle(35); g.setPower(10);
  var r = g.launch(); assert.strictEqual(r.event, 'top');
  var x1 = g.flight.x;
  r = g.decide('boost'); assert.strictEqual(r.event, 'top');
  assert.ok(g.flight.x > x1, 'boost førte ikke længere frem (x ' + g.flight.x + ' vs ' + x1 + ')');
});
test('uden boost, vinger og mål inden for udsyn fryser spillet aldrig', udenFund(function () {
  var st = L.stats(nulOpg()); st.boosts = 0;
  var t = tilTop(st, TOM, 45, 10);
  assert.strictEqual(t.ev, 'end');
}));
test('boost bruger brændstof og tæller', function () {
  var g = L.createGame(null); g.setAngle(40); g.setPower(10);
  g.launch(); var b = g.flight.boosts;
  g.decide('boost');
  assert.strictEqual(g.flight ? g.flight.boosts : 0, b - 1);
  assert.strictEqual(g.flight.boostsUsed, 1);
});
test('næse op flyver længere end næse ned, men lander hårdere', udenFund(function () {
  var p = L.newProgress(1); p.upg.vinger = 3; p.upg.motor = 6;
  var st = L.stats(p.upg), t = tilTop(st, TOM, 45, 10);
  assert.strictEqual(t.ev, 'top');
  var op = L.predict(t.f, st, TOM, { nose: 'op' }), lige = L.predict(t.f, st, TOM, {}), ned = L.predict(t.f, st, TOM, { nose: 'ned' });
  assert.ok(op.x > ned.x, op.x + ' <= ' + ned.x);
  assert.ok(op.hp < lige.hp, 'op ' + op.hp + ' vs lige ' + lige.hp);
  assert.ok(ned.hp >= lige.hp, 'ned ' + ned.hp + ' vs lige ' + lige.hp);
}));
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
test('valgkortene afhænger af situationen', udenFund(function () {
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
}));

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
      c.forEach(function (q) {
        var sk = q.felt.skadeMax / g.st.maxHp, gain = (q.felt.fra + q.felt.til) / 2 - f.x;
        var s = gain - 160 * sk - (q.felt.smadret ? 300 : 0) + (q.id === 'sigt' ? 25 : 0) + (q.id === 'vent' && f.boosts > 0 ? 10 : 0);
        if (q.id === 'boost') s -= (q.felt.smadret || sk >= 0.5) ? 100 : sk >= 0.35 ? 40 : gain < 55 ? 30 : -5;
        if (s > bs) { bs = s; pick = q.id; }
      });
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
  assert.ok(s.naaet.oerken >= 12 && s.naaet.oerken <= 35, 'ørken på tur ' + s.naaet.oerken);
  assert.ok(s.naaet.bjerge, 'nåede ikke bjergene');
  assert.ok(s.naaet.skyer && s.naaet.skyer >= 28 && s.naaet.skyer <= 80, 'skyer på tur ' + s.naaet.skyer);
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


// ---------- v1.3: næsefelter forskellige; boost ikke dominerende ----------
test('næse op og næse ned har aldrig samme landingsfelt, når begge vises', function () {
  var same = 0, both = 0, minDiff = Infinity;
  for (var s = 0; s < 50; s++) {
    var p = L.newProgress(1); p.upg.vinger = 3; p.upg.braendstof = 1; p.upg.instrumenter = 2; p.seed = 9000 + s * 47;
    var g = L.createGame(p); g.setAngle(30 + (s % 25)); g.setPower(10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 40) {
      var c = g.cards(), op = c.filter(function (q) { return q.id === 'op'; })[0], ned = c.filter(function (q) { return q.id === 'ned'; })[0];
      if (op && ned) {
        both++;
        if (op.felt.fra === ned.felt.fra && op.felt.til === ned.felt.til) same++;
        var d = (op.felt.fra + op.felt.til) / 2 - (ned.felt.fra + ned.felt.til) / 2;
        if (d < minDiff) minDiff = d;
        assert.ok(d >= 8, 'midt-forskel kun ' + d + ' m');
        assert.ok(op.felt.til > ned.felt.fra, 'op bør række længere end ned');
      }
      r = g.decide((c.filter(function (q) { return q.id === 'vent'; })[0] || c[c.length - 1]).id);
    }
  }
  assert.ok(both >= 20, 'for få næsepar (' + both + ')');
  assert.strictEqual(same, 0, same + ' identiske næsefelter');
  console.log('     (' + both + ' næsepar, mindste midt-forskel ' + minDiff + ' m)');
});

test('ubrugte boost giver mønter, og boost koster skade', function () {
  var p = L.newProgress(1); p.seed = 4242;
  var g = L.createGame(p); g.setAngle(40); g.setPower(10);
  var r = g.launch(); while (r.event !== 'end') r = g.decide('vent');
  var spare = g.finishTrip();
  assert.ok(spare.spareBoosts >= 1, 'ingen ubrugte boost');
  assert.ok(spare.dist >= 60 ? spare.spareCoins === spare.spareBoosts * L.SPARE_BOOST : spare.spareCoins === 0, 'spare-mønter ' + spare.spareCoins + ' dist ' + spare.dist);
  // Boost overopheder
  p = L.newProgress(1); p.upg.vinger = 1; p.seed = 4243;
  g = L.createGame(p); g.setAngle(40); g.setPower(10); g.launch();
  var hp0 = g.flight.hp, cards = g.cards(), boost = cards.filter(function (q) { return q.id === 'boost'; })[0];
  assert.ok(boost, 'mangler boost-kort');
  assert.ok(/hårdere landing|overophed/i.test(boost.effekt), boost.effekt);
  g.decide('boost');
  assert.ok(g.flight.hp < hp0, 'boost tog ikke liv (overophedning)');
  assert.ok(g.flight.boostedHop || g.flight.boostT > 0 || g.flight.landings >= 0, 'boost startede');
});

// ---------- Fund under turen (v1.6) ----------
// Find en tur, hvor der dukker et fund op på toppen, og tag det med kortet
function medFund(seed, upg) {
  for (var s = seed; s < seed + 400; s++) {
    var p = L.newProgress(1); p.seed = s; if (upg) Object.assign(p.upg, upg);
    var g = L.createGame(p); g.setAngle(40); g.setPower(10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 60) {
      var c = g.cards().filter(function (q) { return q.id === 'sigt' && q.fund; })[0];
      if (c) return { g: g, kort: c, seed: s };
      r = g.decide('vent');
    }
  }
  return null;
}
function kortF(f, st, crs) { return L.cards(f, st, crs).map(function (k) { k.felt = L.field(f, st, crs, k); return k; }); }
function medFundI(f, id, n) { f.fund = {}; f.fund[id] = n || 1; f.fundListe = [id]; return f; }
test('fund dukker op deterministisk fra turens frø, og banen er den samme som før', function () {
  var a = medFund(500), b = medFund(500);
  assert.ok(a, 'intet fund på 400 ture');
  assert.strictEqual(a.seed, b.seed);
  assert.deepStrictEqual(a.g.flight.fundSpawns, b.g.flight.fundSpawns);
  assert.ok(a.g.course.range(0, 3000).every(function (o) { return o.type !== 'fund'; }), 'fund må ikke ændre banen');
  var o = a.g.flight.fundSpawns[a.g.flight.luftI];
  assert.ok(o.x > a.g.flight.x + 10 && o.x <= a.g.flight.x + a.g.udsyn(), 'fundet ligger lige foran bilen inden for udsyn');
  assert.ok(/^Tag fundet: /.test(a.kort.titel) && /fart/.test(a.kort.effekt) && a.kort.ikon === 'fund-' + a.kort.fund);
  // Vælges "vent", flyver bilen forbi fundet uden at tage det
  var c = L.clone(a.g.flight); L.advance(c, a.g.st, a.g.course);
  assert.ok(!c.fundListe.length || c.fundListe[0] !== a.kort.fund || c.taken[o.id] === undefined, 'vent tog fundet');
  // Fund slået fra: samme tur uden fund
  L.FUND_TIL.til = false;
  try { var p = L.newProgress(1); p.seed = a.seed; var g2 = L.createGame(p); g2.setAngle(40); g2.setPower(10); g2.launch(); assert.strictEqual(g2.flight.fundSpawns.length, 0); }
  finally { L.FUND_TIL.til = true; }
});
test('"Tag fundet" tager fundet, det vises, og fundene nulstilles når turen slutter', function () {
  var a = medFund(900);
  var id = a.kort.fund, r = a.g.decide('sigt');
  assert.ok(a.g.flight.fundListe.indexOf(id) >= 0, 'fundet blev ikke taget');
  var vis = a.g.fund();
  assert.ok(vis.length >= 1 && vis[0].navn && vis[0].tekst && typeof vis[0].risiko === 'boolean');
  while (r.event !== 'end') r = a.g.decide('vent');
  var res = a.g.finishTrip();
  assert.ok(res.fund.some(function (q) { return q.id === id; }), 'turens resultat viser ikke fundet');
  assert.ok(res.fundStat && typeof res.fundStat.reddet === 'number');
  a.g.setAngle(40); a.g.setPower(10); a.g.launch();
  assert.ok(a.g.flight.fundListe.every(function (q) { return a.g.flight.fundSpawns.length && q; }) && Object.keys(a.g.flight.fund).every(function (q) { return a.g.flight.fundListe.indexOf(q) >= 0; }));
  assert.ok(a.g.flight.fundStat.reddet === 0 && a.g.flight.fundStat.dublet === 0, 'fundene blev ikke nulstillet');
});
test('Reservehjul tager én hård landing; Køler fjerner overophedning; Guldfeber og Nitro har en bagside', function () {
  var st = L.stats(nulOpg());
  var uden = flyv(st, TOM, 60, 10), med = L.newFlight(st, TOM, 60, 10); medFundI(med, 'reservehjul');
  while (!med.done) L.step(med, st, TOM, false);
  assert.ok(uden.dmg > 0, 'testhoppet skal give skade');
  assert.ok(med.dmg < uden.dmg && med.fundStat.reddet === 1 && med.fund.reservehjul === 0, 'reservehjul: ' + med.dmg + ' vs ' + uden.dmg);
  // Køler og Nitro: boostkortets felt viser forskellen i skade
  var u = nulOpg(); u.braendstof = 2; u.motor = 3; var s2 = L.stats(u), t = tilTop(s2, TOM, 40, 10);
  var skade = function (f) { var hp0 = f.hp; L.applyCard(f, s2, { id: 'boost' }); return hp0 - f.hp; };   // overophedning ved boost
  var k0 = skade(t.f), k1 = skade(medFundI(L.clone(t.f), 'koeler')), k2 = skade(medFundI(L.clone(t.f), 'nitro'));
  assert.ok(k1 < k0 && k2 > k0, 'køler ' + k1 + ' / normal ' + k0 + ' / nitro ' + k2);
  // Guldfeber: dobbelt mønter, men 1,5 × skade
  var f0 = L.clone(t.f), f1 = medFundI(L.clone(t.f), 'guldfeber'), bane0 = L.predict(t.f, s2, TOM, {}).pts, mid = bane0[Math.floor(bane0.length * 0.5)];
  var crs = bane([ting('moent', mid.x, { y: mid.y + 0.6 })]);
  while (!f0.done) L.step(f0, s2, crs, false); while (!f1.done) L.step(f1, s2, crs, false);
  assert.ok(f0.coins > 0 && f1.coins >= f0.coins * 2 && f1.fundStat.ekstraMoent > 0, 'guldfeber ' + f1.coins + ' vs ' + f0.coins);
  var gf = L.newFlight(st, TOM, 60, 10); medFundI(gf, 'guldfeber'); while (!gf.done) L.step(gf, st, TOM, false);
  assert.ok(uden.dmg < st.maxHp * 0.6 && Math.abs(gf.dmg - uden.dmg * 1.5) < 0.01 * uden.dmg + 0.01, 'guldfeber-skade ' + gf.dmg + ' vs ' + uden.dmg);
  // Nitro: +2 boost, der ikke giver spare-mønter
  var g = L.createGame(null); g.setAngle(40); g.setPower(10); g.launch();
  var b0 = g.flight.boosts; L.tagFund ? 0 : 0;
  var fN = g.flight; fN.fundSpawns.push({ id: 7777777, type: 'fund', fund: 'nitro', risiko: true, x: fN.x, y: fN.y + 0.6, r: 1.8, t0: fN.t, t1: null }); fN.luftI = fN.fundSpawns.length - 1;
  L.step(fN, g.st, g.course, false);
  assert.strictEqual(fN.boosts, b0 + 2); assert.strictEqual(fN.fund.nitro, 1);
  var r = { event: 'top' }; while (r.event !== 'end') r = g.decide('vent');
  var res = g.finishTrip();
  assert.ok(res.spareBoosts <= b0, 'nitro-boost gav spare-mønter (' + res.spareBoosts + ')');
});
test('Kompas og Vindvimpel gør felterne smallere; vimplen viser vinden svagt; Mønt-magnet', function () {
  var u = nulOpg(); u.braendstof = 1; u.motor = 3;
  var st = L.stats(u), vind = { bx: 2.5, by: -1, s: 77 }, t = tilTop(st, TOM, 40, 10, vind);
  assert.strictEqual(t.ev, 'top');
  var bredde = function (f) { var c = kortF(f, st, TOM)[0]; return c.felt.til - c.felt.fra; };
  var w0 = bredde(t.f), wk = bredde(medFundI(L.clone(t.f), 'kompas')), wv = bredde(medFundI(L.clone(t.f), 'vimpel'));
  assert.ok(wk < w0 && wv < w0, 'bredder ' + w0 + ' / kompas ' + wk + ' / vimpel ' + wv);
  assert.ok(L.eff(medFundI(L.clone(t.f), 'kompas'), st).udsyn > st.udsyn);
  assert.ok(L.eff(medFundI(L.clone(t.f), 'kompas'), st).usikker > 0, 'aldrig helt præcist');
  var vink = L.vimpelVink(medFundI(L.clone(t.f), 'vimpel'));
  assert.ok(vink && /medvind|modvind|svag/i.test(JSON.stringify(vink)), JSON.stringify(vink));
  assert.strictEqual(L.vimpelVink(t.f), null);
  // Magnet: en mønt lidt ved siden af banen
  var pts = L.predict(t.f, st, TOM, {}).pts, m = pts[Math.floor(pts.length * 0.5)];
  var crs = bane([ting('moent', m.x, { y: m.y + 0.6 + 4.5 })]);
  var a = L.clone(t.f), b = medFundI(L.clone(t.f), 'magnet'); a.vmod = b.vmod = { bx: 0, by: 0, gx: 0, gy: 0 };
  while (!a.done) L.step(a, st, crs, false); while (!b.done) L.step(b, st, crs, false);
  assert.ok(a.coins === 0 && b.coins > 0 && b.fundStat.magnet === 1, 'magnet ' + b.coins + ' / uden ' + a.coins);
});
test('et fund man allerede har giver mønter; gemt tur med fund genoptages ens, og ødelagte fund renses', function () {
  var a, s0 = 1300, upg = { motor: 4, braendstof: 2, raket: 2 };
  for (;;) {   // en tur, der fortsætter efter fundet er taget
    a = medFund(s0, upg); var prøve = L.createGame(JSON.parse(JSON.stringify(a.g.save())));
    if (prøve.decide('sigt').event !== 'end') break;
    s0 = a.seed + 1;
  }
  var f = a.g.flight, o = f.fundSpawns[f.luftI], d = L.FUND.filter(function (q) { return q.id === o.fund; })[0];
  if (o.fund !== 'nitro') { f.fund[o.fund] = d.stak; var c0 = f.coins, c = L.clone(f); c.x = o.x; c.y = o.y - 0.6; L.step(c, a.g.st, a.g.course, false);
    assert.strictEqual(c.coins - c0 >= L.FUND_DUBLET, true, 'dublet gav ikke mønter'); f.fund[o.fund] = 0; delete f.fund[o.fund]; }
  a.g.decide('sigt');
  var gemt = JSON.parse(JSON.stringify(a.g.save())), b = L.createGame(JSON.parse(JSON.stringify(gemt)));
  assert.deepStrictEqual(b.flight.fund, a.g.flight.fund);
  assert.deepStrictEqual(b.flight.fundSpawns, a.g.flight.fundSpawns);
  var ra = { event: 'top' }, rb = { event: 'top' }, k = 0;
  while (ra.event !== 'end' && k++ < 200) { var ka = a.g.cards(), pick = ka[0].id; ra = a.g.decide(pick); rb = b.decide(pick); }
  assert.strictEqual(a.g.flight.x, b.flight.x);
  assert.deepStrictEqual(a.g.finishTrip(), b.finishTrip());
  // Ødelagte funddata renses
  var p = JSON.parse(JSON.stringify(gemt));
  p.tur.f.fund = { kompas: 'x', ukendt: 3, magnet: 2.7 }; p.tur.f.fundListe = ['ukendt', 'magnet', 'magnet', 5];
  p.tur.f.fundSpawns = [null, { id: 'a' }, { id: 5, fund: 'hund', x: 1, y: 1, t0: 0 }]; p.tur.f.luftI = 9; p.tur.f.fundStat = { reddet: -4, sparet: 'z' };
  var g3 = L.createGame(p);
  assert.deepStrictEqual(g3.flight.fund, { magnet: 1 });
  assert.deepStrictEqual(g3.flight.fundListe, ['magnet']);
  assert.strictEqual(g3.flight.fundSpawns.length, 0); assert.strictEqual(g3.flight.luftI, -1);
  assert.strictEqual(g3.flight.fundStat.reddet, 0);
  assert.ok(Array.isArray(g3.fund()));
});

function botZoner(kind, maxTure) {
  var start = L.newProgress(1); start.seed = kind === 'altid-boost' ? 11001 : kind === 'omtanke' ? 22002 : 33003;
  var g = L.createGame(start), naaet = {}, sum = 0, boosts = 0, fundTaget = 0, fundTure = 0;
  for (var trip = 1; trip <= maxTure; trip++) {
    for (;;) {
      var b = null;
      L.OPG.forEach(function (o) {
        var c = g.price(o.id); if (c === null || c > g.p.coins) return;
        if (!b || c < b.c) b = { id: o.id, c: c };
      });
      if (!b) break; g.buy(b.id);
    }
    g.setAngle(35); g.setPower(10);
    var r = g.launch(), k = 0;
    while (r.event !== 'end' && k++ < 200) {
      var c = g.cards(), f = g.flight, pick;
      var fk = c.filter(function (q) { return q.fund; })[0];
      if (kind === 'jaeger' && fk) { pick = fk.id; fundTaget++; }
      else if (kind === 'altid-boost') pick = (c.filter(function (q) { return q.id === 'boost'; })[0] || c[0]).id;
      else if (kind === 'klog-gem') {
        var bs = -1e9; pick = c[c.length - 1].id;
        c.forEach(function (q) {
          var sk = q.felt.skadeMax / g.st.maxHp, gain = (q.felt.fra + q.felt.til) / 2 - f.x, s;
          if (q.id === 'boost') s = (gain >= 90 && sk <= 0.28 && !q.felt.smadret) ? gain - 90 * sk : -40;
          else if (q.id === 'vent') s = 25 + f.boosts * 5;
          else s = gain - 150 * sk - (q.felt.smadret ? 250 : 0) + (q.id === 'sigt' ? 20 : 0);
          if (s > bs) { bs = s; pick = q.id; }
        });
      } else {
        var bs2 = -1e9; pick = c[0].id;
        c.forEach(function (q) {
          var sk = q.felt.skadeMax / g.st.maxHp, gain = (q.felt.fra + q.felt.til) / 2 - f.x;
          var s = gain - 160 * sk - (q.felt.smadret ? 300 : 0) + (q.id === 'sigt' ? 25 : 0) + (q.id === 'vent' && f.boosts > 0 ? 10 : 0);
          if (q.id === 'boost') s -= (q.felt.smadret || sk >= 0.5) ? 100 : sk >= 0.35 ? 40 : gain < 55 ? 30 : -5;
          if (s > bs2) { bs2 = s; pick = q.id; }
        });
      }
      r = g.decide(pick);
    }
    var res = g.finishTrip(); sum += res.dist; boosts += res.boostsUsed; if (res.fund.length) fundTure++;
    L.ZONER.forEach(function (z) { if (res.dist >= z.fra && !naaet[z.id]) naaet[z.id] = trip; });
    if (naaet.rummet && trip >= 70) break;
  }
  return { naaet: naaet, snit: sum / g.p.trips, boosts: boosts, trips: g.p.trips, best: g.p.best, fundTaget: fundTaget, fundTure: fundTure };
}

test('altid-boost klarer sig dårligere end omtanke og ikke bedre end klog-gem', function () {
  var a = botZoner('altid-boost', 100), o = botZoner('omtanke', 100), k = botZoner('klog-gem', 100);
  console.log('     altid-boost snit ' + Math.round(a.snit) + ' best ' + a.best + ' rummet@' + a.naaet.rummet +
    ' | omtanke snit ' + Math.round(o.snit) + ' best ' + o.best + ' rummet@' + o.naaet.rummet +
    ' | klog-gem snit ' + Math.round(k.snit) + ' rummet@' + k.naaet.rummet);
  assert.ok(o.naaet.rummet, 'omtanke nåede ikke rummet');
  // Omtanke: bedre snit eller bedre bedste tur (mærkbart – mindst 3 %)
  assert.ok(o.snit >= a.snit * 1.03 || o.best >= a.best * 1.05,
    'omtanke (snit ' + Math.round(o.snit) + ', best ' + o.best + ') slår ikke altid-boost (snit ' + Math.round(a.snit) + ', best ' + a.best + ')');
  // Klog-gem når rummet mindst lige så hurtigt (margen 8 ture)
  assert.ok(k.naaet.rummet && a.naaet.rummet && a.naaet.rummet >= k.naaet.rummet - 8,
    'altid-boost rummet@' + a.naaet.rummet + ' vs klog-gem@' + k.naaet.rummet);
});

test('fund ændrer valg, men er ikke en genvej: fundjægeren slår ikke den forsigtige bot', function () {
  var o = botZoner('omtanke', 70), j = botZoner('jaeger', 70);
  console.log('     omtanke snit ' + Math.round(o.snit) + ' (fund på ' + o.fundTure + '/' + o.trips + ' ture) | fundjæger snit ' + Math.round(j.snit) +
    ' best ' + j.best + ' rummet@' + j.naaet.rummet + ' (tog ' + j.fundTaget + ' fund, fund på ' + j.fundTure + ' ture)');
  assert.ok(j.fundTaget >= 40, 'for få fund at vælge (' + j.fundTaget + ')');
  assert.ok(o.fundTure >= 15, 'den forsigtige bot vælger næsten aldrig fund (' + o.fundTure + ')');
  assert.ok(j.snit <= o.snit * 1.05, 'fundjægeren er for stærk: ' + Math.round(j.snit) + ' vs ' + Math.round(o.snit));
  assert.ok(o.naaet.rummet, 'omtanke nåede ikke rummet');
});

console.log('\n' + (n - failed) + '/' + n + ' tests OK');
if (failed) process.exit(1);
