/*
 * Kabalen – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node kabalen/test/spillogik.test.js
 * Dækker: regler, løser, kun løselige spil, point, fortryd, sejr, serien, "sidder fast", Saml og Hint.
 */
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.KabaleLogik, P = L.POINT;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }
var K = function (su, r) { return L.kort(su, r); };      // su: 0 spar, 1 hjerter, 2 klør, 3 ruder; r: 0 = es
var SP = 0, HJ = 1, KL = 2, RU = 3;
function tom(draw) { return { t: [0, 1, 2, 3, 4, 5, 6].map(function () { return { d: 0, c: [] }; }), f: [0, 0, 0, 0], talon: [], w: 0, draw: draw || 1 }; }
function alleKort(s) {
  var a = []; s.t.forEach(function (p) { a.push.apply(a, p.c); }); a.push.apply(a, s.talon);
  s.f.forEach(function (n, su) { for (var r = 0; r < n; r++) a.push(K(su, r)); });
  return a.sort(function (x, y) { return x - y; });
}
// Afspil en løsning fra løseren (træk med p = "klik på bunken, til w = p") med spillets egne træk
function afspil(g, path) {
  path.forEach(function (m) {
    if (m.p !== undefined) {
      var n = 0;
      while (g.state.w !== m.p) { assert.ok(g.draw().ok, 'træk fra bunken'); assert.ok(++n < 100, 'p kan nås'); }
      m = Object.assign({}, m); delete m.p;
    }
    assert.ok(g.play(m).ok, 'lovligt træk ' + JSON.stringify(m));
  });
  var n = 0;
  while (!g.won()) { assert.ok(g.autoStep(), 'automatisk afslutning'); assert.ok(++n < 60); }
}

// ---------- Regler ----------
test('kort: kulør, værdi, farve og navne', function () {
  assert.strictEqual(L.suit(K(KL, 4)), KL); assert.strictEqual(L.rank(K(KL, 4)), 4);
  assert.ok(L.red(K(HJ, 0)) && L.red(K(RU, 12)) && !L.red(K(SP, 3)) && !L.red(K(KL, 3)));
  assert.strictEqual(L.navn(K(HJ, 11)), 'hjerter dame'); assert.strictEqual(L.navn(K(KL, 0)), 'klør es');
  assert.strictEqual(L.kortTekst(K(RU, 9)), '10♦');
});
test('bunker: én lavere og modsat farve', function () {
  assert.ok(L.stacks(K(HJ, 9), K(SP, 10)));      // 10♥ på J♠
  assert.ok(!L.stacks(K(RU, 9), K(HJ, 10)));     // samme farve
  assert.ok(!L.stacks(K(KL, 8), K(HJ, 10)));     // ikke én lavere
});
test('udlægning: 7 bunker med 1–7 kort, øverste vendt, 24 i bunken, alle 52 kort', function () {
  var s = L.deal(L.rng(5), 1);
  s.t.forEach(function (p, i) { assert.strictEqual(p.c.length, i + 1); assert.strictEqual(p.d, i); });
  assert.strictEqual(s.talon.length, 24); assert.strictEqual(s.w, 0);
  assert.deepStrictEqual(alleKort(s), Array.from({ length: 52 }, function (_, i) { return i; }));
  assert.deepStrictEqual(L.deal(L.rng(5), 1), s, 'samme seed giver samme spil');
});
test('tom plads tager kun en konge; grundbunken bygges fra es i samme kulør', function () {
  var s = tom();
  assert.ok(L.canTab(s, K(SP, 12), 0)); assert.ok(!L.canTab(s, K(SP, 11), 0));
  assert.ok(L.canFound(s, K(HJ, 0))); assert.ok(!L.canFound(s, K(HJ, 1)));
  s.f[HJ] = 1; assert.ok(L.canFound(s, K(HJ, 1))); assert.ok(!L.canFound(s, K(RU, 1)));
});
test('flyt en række, og kortet nedenunder vendes (+5)', function () {
  var s = tom(); s.t[0] = { d: 1, c: [K(KL, 5), K(HJ, 9), K(SP, 8)] }; s.t[1] = { d: 0, c: [K(KL, 10)] };
  var r = L.apply(s, { k: 'tt', from: 0, n: 2, to: 1 });
  assert.ok(r && r.flip); assert.strictEqual(r.pts, P.vend);
  assert.deepStrictEqual(s.t[1].c, [K(KL, 10), K(HJ, 9), K(SP, 8)]); assert.deepStrictEqual(s.t[0], { d: 0, c: [K(KL, 5)] });
  assert.strictEqual(L.apply(s, { k: 'tt', from: 1, n: 3, to: 0 }), null, 'ulovligt træk afvises');
});
test('træk 1 og træk 3: bunken vendes om, når den er tom', function () {
  var s = tom(1); s.talon = [1, 2, 3, 4];
  L.apply(s, { k: 'draw' }); assert.strictEqual(L.wasteTop(s), 1);
  L.apply(s, { k: 'draw' }); L.apply(s, { k: 'draw' }); L.apply(s, { k: 'draw' }); assert.strictEqual(s.w, 4);
  L.apply(s, { k: 'draw' }); assert.strictEqual(s.w, 0, 'vendt om');
  var t = tom(3); t.talon = [1, 2, 3, 4, 5];
  L.apply(t, { k: 'draw' }); assert.strictEqual(L.wasteTop(t), 3);
  L.apply(t, { k: 'draw' }); assert.strictEqual(t.w, 5);
  assert.deepStrictEqual(L.reachable(t), [5, 3]);
});
test('point: grundbunke +10, fra bunken +5, tilbage fra grundbunke −15', function () {
  var s = tom(); s.talon = [K(SP, 0)]; s.w = 1; s.t[0].c = [K(HJ, 1)];
  assert.strictEqual(L.apply(s, { k: 'wf' }).pts, P.grund);
  s.f[SP] = 1; s.t[1].c = [K(RU, 2)]; s.f[SP] = 2;      // 2♠ op, kan lægges på 3♦
  assert.strictEqual(L.apply(s, { k: 'ft', s: SP, to: 1 }).pts, P.tilbage);
  var u = tom(); u.talon = [K(SP, 12)]; u.w = 1;
  assert.strictEqual(L.apply(u, { k: 'wt', to: 3 }).pts, P.talon);
});
test('sikre kort: es og 2 altid; højere først når modsatte farver er fulgt med', function () {
  var s = tom(); assert.ok(L.safe(s, K(HJ, 0)));
  s.f = [2, 1, 2, 0];      // spar til 2, hjerter til es, klør til 2, ruder tom
  assert.ok(L.safe(s, K(HJ, 1)), '2♥');
  assert.ok(!L.safe(s, K(SP, 2)), '3♠ venter på ruder');
  s.f = [2, 2, 2, 2]; assert.ok(L.safe(s, K(SP, 2)));
});

// ---------- Løser og kun løselige spil ----------
test('løseren finder en løsning, og den kan spilles færdig med spillets egne træk (træk 1)', function () {
  var gen = L.generate(11, 1);
  assert.ok(gen.loeselig, 'løseligt spil fundet');
  var res = L.solve(gen.deal);
  assert.strictEqual(res.status, 'vundet');
  var g = L.createGame({ deal: gen.deal }); afspil(g, res.path);
  assert.ok(g.won()); assert.deepStrictEqual(g.state.f, [13, 13, 13, 13]);
});
test('også træk 3 giver løselige spil, der kan spilles færdige', function () {
  var gen = L.generate(4, 3); assert.ok(gen.loeselig); assert.strictEqual(gen.deal.draw, 3);
  var g = L.createGame({ deal: gen.deal }); afspil(g, L.solve(gen.deal).path); assert.ok(g.won());
});
test('generatoren kan køres i små bidder (brugerfladen fryser ikke) og giver det samme spil', function () {
  var a = L.createGenerator(23, 1), n = 0, r;
  while (!(r = a.step(40))) { n++; assert.ok(n < 100000); }
  assert.ok(n > 0, 'skulle bruge flere bidder');
  assert.deepStrictEqual(r.deal, L.generate(23, 1).deal);
});
test('20 udgivne spil er alle bevist løselige', function () {
  for (var seed = 100; seed < 120; seed++) {
    var d = seed % 2 ? 1 : 3, gen = L.generate(seed, d);
    assert.ok(gen.loeselig, 'seed ' + seed);
    var g = L.createGame({ deal: gen.deal }); afspil(g, L.solve(gen.deal, { maxNodes: 40000 }).path); assert.ok(g.won(), 'seed ' + seed);
  }
});
test('løseren afviser en umulig stilling', function () {
  // 2♠ ligger over es♠ i samme bunke, og intet kan flyttes: umulig
  var s = tom(); s.t[0] = { d: 1, c: [K(SP, 0), K(SP, 1)] };
  for (var i = 1; i < 7; i++) s.t[i] = { d: 0, c: [] };
  s.f = [0, 13, 13, 13];
  s.talon = []; for (var r = 2; r < 13; r++) s.talon.push(K(SP, r)); s.talon.reverse();
  // sparkortene 3–K ligger i bunken, men kan ikke bruges: ingen røde kort at lægge dem på,
  // og kun kongen kan på en tom plads (dronningen kan ikke på kongen: samme farve)
  var res = L.solve(s);
  assert.notStrictEqual(res.status, 'vundet');
});

// ---------- Ét spil: point, fortryd, sejr, Saml, Hint, fast ----------
function næstenVundet() {
  // Alt ligger på grundbunken undtagen dronning og konge i hjerter (i en bunke) og konge i spar (i bunken)
  var s = tom(1); s.f = [12, 11, 13, 13];
  s.t[0].c = [K(HJ, 11)]; s.t[1].c = [K(HJ, 12)];
  s.talon = [K(SP, 12)]; s.w = 0;
  return s;
}
test('sejr: de sidste kort op, point og bonus for få træk', function () {
  var g = L.createGame({ deal: næstenVundet() });
  assert.ok(!g.won());
  assert.ok(g.draw().ok);
  assert.ok(g.play({ k: 'wf' }).ok);
  assert.ok(g.play({ k: 'tf', from: 0 }).ok);
  var r = g.play({ k: 'tf', from: 1 }); assert.ok(r.won && g.won());
  assert.strictEqual(g.moves, 3); assert.strictEqual(g.draws, 1);
  assert.strictEqual(g.score(), 3 * P.grund);
  var b = g.winBonus(); assert.strictEqual(b.sejr, P.sejr); assert.strictEqual(b.faaTraek, (P.faaTraekGraense - 3) * P.faaTraekFaktor);
});
test('bonus for få træk er aldrig negativ', function () {
  var g = L.createGame({ deal: næstenVundet() }); g.moves = 400; assert.strictEqual(g.winBonus().faaTraek, 0);
});
test('fortryd (ubegrænset): stillingen og trækkets point tages tilbage, og det koster lidt', function () {
  var g = L.createGame({ seed: 9 }), s0 = L.clone(g.state);
  assert.ok(!g.canUndo());
  g.draw(); g.draw(); g.draw();
  var ms = L.cardMoves(g.state);
  if (ms.length) g.play(ms[0]);
  var n = 0; while (g.canUndo()) { assert.ok(g.undo().ok); n++; }
  assert.deepStrictEqual(g.state, s0);
  assert.strictEqual(g.points, 0); assert.strictEqual(g.moves, 0); assert.strictEqual(g.draws, 0);
  assert.strictEqual(g.undos, n); assert.strictEqual(g.score(), n * P.fortryd);
  assert.ok(!g.undo().ok, 'intet at fortryde');
});
test('mål: lovlige mål for et valgt kort (med kortene ovenpå) og trækket dertil', function () {
  var s = tom(); s.t[0] = { d: 0, c: [K(HJ, 9), K(SP, 8)] }; s.t[1].c = [K(KL, 10)]; s.t[2].c = [K(SP, 10)]; s.t[3].c = [K(RU, 9)];
  var g = L.createGame({ deal: s });
  assert.deepStrictEqual(g.targets({ k: 't', col: 0, idx: 0 }), [{ k: 't', col: 1 }, { k: 't', col: 2 }]);
  assert.deepStrictEqual(g.moveFor({ k: 't', col: 0, idx: 0 }, { k: 't', col: 2 }), { k: 'tt', from: 0, n: 2, to: 2 });
  assert.deepStrictEqual(g.targets({ k: 't', col: 0, idx: 1 }), [{ k: 't', col: 3 }], '9♠ kan kun på 10♦');
  assert.strictEqual(g.moveFor({ k: 't', col: 0, idx: 0 }, { k: 'f' }), null, 'to kort kan ikke på grundbunken');
  s = tom(); s.t[0].c = [K(KL, 0)];
  assert.deepStrictEqual(L.targetsFor(s, { k: 't', col: 0, idx: 0 }), [{ k: 'f', s: KL }]);
});
test('Saml lægger alle sikre kort op i ét træk og kan fortrydes', function () {
  var s = tom(); s.t[0].c = [K(SP, 1), K(SP, 0)]; s.t[1].c = [K(HJ, 0)]; s.t[2].c = [K(KL, 8)];
  var g = L.createGame({ deal: s }), r = g.collect();
  assert.ok(r.ok); assert.strictEqual(r.n, 3); assert.deepStrictEqual(g.state.f, [2, 1, 0, 0]);
  assert.strictEqual(g.moves, 1); assert.strictEqual(g.points, 3 * P.grund);
  assert.ok(!g.collect().ok, 'intet mere at samle');
  g.undo(); assert.deepStrictEqual(g.state.f, [0, 0, 0, 0]);
});
test('Saml lægger også usikre kort op, når der ingen sikre er', function () {
  var s = tom(); s.f = [2, 0, 2, 0]; s.t[0].c = [K(SP, 2)];
  var g = L.createGame({ deal: s }); assert.ok(!L.safe(s, K(SP, 2)));
  assert.ok(g.collect().ok); assert.strictEqual(g.state.f[SP], 3);
});
test('Hint giver et lovligt træk, og følger man hint, vinder man', function () {
  var gen = L.generate(31, 1), g = L.createGame({ deal: gen.deal }), n = 0;
  while (!g.won() && !g.allOpen()) {
    var h = g.hint(); assert.ok(h, 'hint findes');
    var m = Object.assign({}, h); delete m.kilde;
    assert.ok(g.play(m).ok, 'hint er lovligt: ' + JSON.stringify(h));
    assert.ok(++n < 600);
  }
  while (!g.won()) assert.ok(g.autoStep());
  assert.ok(g.won());
});
test('automatisk afslutning: når alt er vendt, lægges ét kort op ad gangen, laveste først', function () {
  var s = tom(); s.f = [11, 11, 13, 13]; s.t[0].c = [K(SP, 12), K(HJ, 11)]; s.t[1].c = [K(HJ, 12), K(SP, 11)];
  var g = L.createGame({ deal: s });
  assert.ok(g.allOpen());
  var a = g.autoStep(); assert.strictEqual(a.from, 0, 'dame før konge');
  var n = 1; while (!g.won()) { assert.ok(g.autoStep()); n++; }
  assert.strictEqual(n, 4); assert.strictEqual(g.moves, 0, 'tæller ikke som træk');
  assert.strictEqual(g.autoStep(), null);
});
test('sidder fast: ingen kort kan bruges, og intet kan vendes', function () {
  var s = tom(); s.t[0] = { d: 1, c: [K(SP, 0), K(SP, 1)] }; s.talon = [K(SP, 5), K(KL, 7)];
  var g = L.createGame({ deal: s });
  assert.ok(g.stuck());
  s = tom(); s.t[0] = { d: 1, c: [K(SP, 0), K(SP, 1)] }; s.talon = [K(SP, 5), K(HJ, 0)];
  assert.ok(!L.createGame({ deal: s }).stuck(), 'es♥ i bunken kan bruges');
  s = tom(); s.t[0] = { d: 1, c: [K(KL, 4), K(SP, 12)] };
  assert.ok(!L.createGame({ deal: s }).stuck(), 'kongen kan flyttes til en tom plads, så kortet vendes');
  assert.ok(!L.createGame({ seed: 1 }).stuck(), 'et nyt spil sidder ikke fast');
});
test('sidder ikke fast, hvis man skal flytte rundt for at komme videre', function () {
  // 9♥ skal flyttes fra bunke 0 over på 10♠, så kortet nedenunder vendes
  var s = tom(); s.t[0] = { d: 1, c: [K(KL, 3), K(HJ, 8)] }; s.t[1] = { d: 2, c: [K(KL, 1), K(KL, 2), K(SP, 9)] };
  assert.ok(!L.createGame({ deal: s }).stuck());
});

// ---------- Serien ----------
test('serien: sejr giver point + bonus og næste spil; giv op slutter og gemmer summen', function () {
  var se = L.createSeries({ draw: 1 });
  var g = se.start(næstenVundet());
  g.draw(); g.play({ k: 'wf' }); g.collect();
  assert.ok(g.won());
  var rec = se.winGame();
  assert.strictEqual(rec.kort, 3 * P.grund); assert.strictEqual(rec.score, 3 * P.grund + P.sejr + (P.faaTraekGraense - 2) * P.faaTraekFaktor);
  assert.strictEqual(se.winGame(), null, 'kun én gang');
  assert.strictEqual(se.total(), rec.score);
  var g2 = se.start(null, 77); g2.draw();
  var end = se.end('opgivet');
  assert.deepStrictEqual([end.wins, end.games, end.why], [1, 2, 'opgivet']);
  assert.ok(end.score >= rec.score);
  assert.strictEqual(se.end('opgivet'), null, 'kun én gang');
});
test('serien: summen bliver aldrig negativ', function () {
  var se = L.createSeries({ draw: 3 }); var g = se.start(null, 3);
  g.draw(); g.undo(); g.draw(); g.undo();
  assert.strictEqual(se.total(), 0); assert.strictEqual(se.end('fast').score, 0);
  assert.strictEqual(se.draw, 3);
});

var ok = 0, fail = 0;
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('OK   ' + t.name); }
  catch (e) { fail++; console.log('FEJL ' + t.name + '\n     ' + (e && e.message)); }
});
console.log('\n' + ok + ' af ' + tests.length + ' test bestået');
process.exit(fail ? 1 : 0);
