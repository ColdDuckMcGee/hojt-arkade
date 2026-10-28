// Logiktest af Muren (uden browser): node muren/test/spillogik.test.js
// Fysik (lige skud, afprelning på vægge, loft og sten), træf og knuste sten,
// point, +1-ringe, muren rykker ned, næste skud fra første landing, game over,
// Spring frem og at alt er deterministisk (samme seed + samme vinkler = samme spil).
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
var R = L.RULES.ballR, MID = L.W / 2;
// Et tomt bræt (ingen sten og ringe) med valgfrie sten/ringe og antal kugler
function board(opts) {
  opts = opts || {};
  var run = L.createRun({ seed: opts.seed || 1 }), s = run.state;
  s.bricks = (opts.bricks || []).map(function (b) { return { c: b.c, r: b.r, n: b.n, n0: b.n, test: true }; });
  s.rings = []; (opts.rings || []).forEach(function (o) { s.rings.push({ c: o.c, r: o.r, test: true }); });
  if (opts.balls) s.balls = opts.balls;
  if (opts.x !== undefined) s.originX = opts.x;
  return run;
}
// Kun de sten og ringe, testen selv har lagt (ikke den nye række efter turen)
function mine(list) { return list.filter(function (x) { return x.test; }); }
// Følg én kugle skridt for skridt (spejl af salven) og saml dens stød
function trace(run, maxSteps) {
  var s = run.state, out = [];
  run.fire();
  var b = s.volley.balls[0], prev = { vx: b.vx, vy: b.vy };
  for (var i = 0; i < (maxSteps || 5000) && s.volley && !s.volley.done; i++) {
    L.stepVolley(s);
    if (b.vx !== prev.vx || b.vy !== prev.vy) out.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, pvx: prev.vx, pvy: prev.vy });
    prev = { vx: b.vx, vy: b.vy };
  }
  if (s.volley) run.step(1); // salven er færdig: afslut turen
  return out;
}

// ---------- Start ----------
test('nyt spil: tur 1, 1 kugle, 0 point, kanonen i midten, første række øverst', function () {
  var run = L.createRun({ seed: 42 }), s = run.state;
  assert.deepStrictEqual([s.turn, s.balls, s.score, s.originX, s.aim], [1, 1, 0, MID, 0]);
  assert.ok(s.bricks.length >= 1 && s.bricks.length <= 6, 'antal sten ' + s.bricks.length);
  assert.ok(s.bricks.every(function (b) { return b.r === 0 && b.n === 1; }), 'første række skal have tallet 1');
  assert.strictEqual(s.rings.length, 1);
  var cells = s.bricks.map(function (b) { return b.c; }).concat(s.rings.map(function (o) { return o.c; }));
  assert.strictEqual(new Set(cells).size, cells.length, 'to ting i samme felt');
});
test('vinklen holdes inden for ±80° og drejes i trin', function () {
  var run = board();
  assert.strictEqual(run.turnAim(10), 10);
  assert.strictEqual(run.turnAim(-2), 8);
  assert.strictEqual(run.setAim(200), 80);
  assert.strictEqual(run.setAim(-95), -80);
  run.setAim(0);
  assert.strictEqual(run.aimAt({ x: MID, y: 100 }), 0);
  assert.ok(run.aimAt({ x: MID + 300, y: L.H - R - 300 }) === 45, 'aimAt 45° gav ' + run.state.aim);
  assert.ok(run.aimAt({ x: 0, y: L.H }) === -80, 'aimAt under kanonen holdes inden for grænsen');
});

// ---------- Fysik og afprelning ----------
test('lige op: kuglen rammer loftet, vender og lander samme sted', function () {
  var run = board(), hits = trace(run);
  assert.strictEqual(hits.length, 1, 'stød: ' + hits.length);
  assert.ok(hits[0].y <= R + 1e-9 + L.RULES.speed, 'stødet skete ikke ved loftet: ' + hits[0].y);
  assert.ok(hits[0].pvy < 0 && hits[0].vy === -hits[0].pvy && hits[0].vx === hits[0].pvx);
  assert.ok(Math.abs(run.state.originX - MID) < 1e-6, 'landede ' + run.state.originX);
});
test('afprelning på en sidevæg: vandret fart vender, lodret fart bevares (indfaldsvinkel = udfaldsvinkel)', function () {
  var run = board(); run.setAim(60);
  var hits = trace(run);
  var wall = hits.filter(function (h) { return h.vx !== h.pvx; })[0];
  assert.ok(wall, 'ramte ingen væg');
  assert.ok(wall.x >= L.W - R - L.RULES.speed, 'væggen er ikke højre side: ' + wall.x);
  assert.strictEqual(wall.vx, -wall.pvx); assert.strictEqual(wall.vy, wall.pvy);
  var sp = Math.hypot(wall.vx, wall.vy);
  assert.ok(Math.abs(sp - L.RULES.speed) < 1e-9, 'farten ændrede sig: ' + sp);
});
test('kuglen holder sig altid inden for brættet og aldrig inde i en sten', function () {
  var run = L.createRun({ seed: 99 }), s = run.state;
  var aims = [-73, 61, -12, 44, 5, -38, 79, -80, 22];
  for (var t = 0; t < aims.length && run.live(); t++) {
    s.balls = Math.max(s.balls, 6);
    run.setAim(aims[t]); run.fire();
    while (s.volley) {
      run.step(1);
      if (!s.volley) break;
      s.volley.balls.forEach(function (b) {
        if (b.st !== 1) return;
        assert.ok(b.x >= R - 1e-6 && b.x <= L.W - R + 1e-6 && b.y >= R - 1e-6 && b.y <= L.H - R + 1e-6, 'uden for: ' + b.x + ',' + b.y);
        s.bricks.forEach(function (q) {
          var r = L.brickRect(q), cx = Math.max(r.x, Math.min(b.x, r.x + r.w)), cy = Math.max(r.y, Math.min(b.y, r.y + r.h));
          assert.ok((b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy) >= R * R - 1e-6, 'kugle inde i sten ' + q.c + ',' + q.r);
        });
      });
    }
  }
});
test('forhåndslinjen viser det første stød, som kuglen faktisk får', function () {
  var run = board({ bricks: [{ c: 5, r: 3, n: 9 }, { c: 1, r: 2, n: 9 }] });
  [0, 25, 40, -30, -60].forEach(function (a) {
    var r2 = board({ bricks: [{ c: 5, r: 3, n: 9 }, { c: 1, r: 2, n: 9 }] });
    r2.setAim(a);
    var pv = r2.preview(1), hits = trace(r2);
    assert.ok(pv.first, 'ingen første flade ved ' + a + '°');
    // Kuglen følges pr. tidsskridt, forhåndslinjen pr. delskridt: højst ét skridt imellem
    assert.ok(Math.hypot(pv.first.x - hits[0].x, pv.first.y - hits[0].y) <= L.RULES.speed, a + '°: forhånd ' + JSON.stringify(pv.first) + ' vs ' + JSON.stringify(hits[0]));
    assert.strictEqual(pv.first.what === 'sten', !!(pv.first.brick), 'stenen skal følge med');
    assert.ok(pv.pts.length >= 3, 'linjen skal gå videre efter første hop');
  });
  void run;
});

// ---------- Sten, point og ringe ----------
test('træf tæller stenens tal ét ned og giver 1 point', function () {
  var run = board({ bricks: [{ c: 3, r: 4, n: 3 }] });
  run.fire(); run.finish();
  var s = run.state;
  assert.strictEqual(mine(s.bricks).length, 1);
  assert.strictEqual(mine(s.bricks)[0].n, 2, 'tal ' + mine(s.bricks)[0].n);
  assert.strictEqual(s.score, L.RULES.hitPoints);
  assert.strictEqual(s.lastVolley.hits, 1);
});
test('ved 0 forsvinder stenen og giver bonus', function () {
  var run = board({ bricks: [{ c: 3, r: 4, n: 1 }] });
  run.fire(); run.finish();
  var s = run.state;
  assert.strictEqual(mine(s.bricks).length, 0, 'stenen er der stadig');
  assert.strictEqual(s.broken, 1);
  assert.strictEqual(s.score, L.RULES.hitPoints + L.RULES.breakBonus);
});
test('en salve med 3 kugler knuser en 3-sten: 3 træf + bonus', function () {
  var run = board({ bricks: [{ c: 3, r: 4, n: 3 }], balls: 3 });
  run.fire(); run.finish();
  var s = run.state;
  assert.strictEqual(s.lastVolley.hits, 3);
  assert.strictEqual(s.lastVolley.broken, 1);
  assert.strictEqual(s.score, 3 * L.RULES.hitPoints + L.RULES.breakBonus);
});
test('kuglerne sendes af sted én ad gangen med fast afstand', function () {
  var run = board({ balls: 4 }), s = run.state;
  run.fire();
  run.step(1); assert.strictEqual(s.volley.launched, 1);
  run.step(L.RULES.launchGap); assert.strictEqual(s.volley.launched, 2);
  run.step(2 * L.RULES.launchGap); assert.strictEqual(s.volley.launched, 4);
});
test('+1-ring: kuglen samler den op og flyver videre, næste tur har én kugle mere', function () {
  var run = board({ rings: [{ c: 3, r: 5 }] }), s = run.state;
  var hits = trace(run);
  assert.strictEqual(hits.length, 1, 'ringen må ikke få kuglen til at prelle af');
  assert.strictEqual(mine(s.rings).length, 0);
  assert.strictEqual(s.balls, 2);
  assert.strictEqual(s.lastVolley.gained, 1);
});
test('en ring, der glider ud under bundlinjen, samles automatisk op', function () {
  var run = board({ rings: [{ c: 0, r: L.ROWS - 1 }] }), s = run.state;
  run.setAim(30); run.fire(); run.finish();
  assert.strictEqual(mine(s.rings).length, 0, 'ringen er der stadig');
  assert.strictEqual(s.balls, 2);
  assert.strictEqual(s.lastVolley.autoRings, 1);
});

// ---------- Tur, række ned og næste affyringspunkt ----------
test('efter salven rykker muren ét trin ned, og en ny række kommer ind øverst', function () {
  var run = board({ bricks: [{ c: 0, r: 0, n: 5 }, { c: 6, r: 2, n: 5 }] }), s = run.state;
  run.setAim(0); run.fire(); run.finish();
  assert.strictEqual(s.turn, 2);
  var old = mine(s.bricks).map(function (b) { return b.c + ',' + b.r; }).sort();
  assert.deepStrictEqual(old, ['0,1', '6,3']);
  var fresh = s.bricks.filter(function (b) { return b.r === 0; });
  assert.ok(fresh.length >= 1 && fresh.every(function (b) { return b.n === 2 || b.n === 4; }), 'ny række med tallet for tur 2');
  assert.strictEqual(s.volley, null);
});
test('stenenes tal stiger med turen', function () {
  var run = L.createRun({ seed: 3 }), s = run.state;
  for (var t = 0; t < 7; t++) { s.bricks = []; run.setAim(0); run.fire(); run.finish(); }
  assert.strictEqual(s.turn, 8);
  assert.ok(s.bricks.every(function (b) { return b.n === 8 || b.n === 16; }), JSON.stringify(s.bricks));
});
test('hvor den FØRSTE kugle lander, bliver næste affyringspunkt', function () {
  var run, s, first = null;
  for (var a = 10; a <= 70 && (first === null || Math.abs(first - MID) < 40); a += 4) {
    run = board({ balls: 3 }); s = run.state; first = null;
    run.setAim(a); run.fire();
    while (s.volley) {
      var v = s.volley;
      run.step(1);
      if (first === null && v.firstX !== null) first = v.firstX;
    }
  }
  assert.ok(first !== null);
  assert.ok(Math.abs(first - MID) >= 40, 'landede for tæt på midten til at teste: ' + first);
  assert.strictEqual(s.originX, first);
  assert.strictEqual(s.lastVolley.firstX, first);
  // Næste salve skydes derfra
  run.fire();
  assert.strictEqual(s.volley.balls[0].x, first);
});
test('kan ikke skyde igen, mens salven er i luften', function () {
  var run = board({ balls: 2 });
  assert.strictEqual(run.fire(), true);
  assert.strictEqual(run.fire(), false);
});

// ---------- Game over ----------
test('game over, når en sten når bundlinjen', function () {
  var run = board({ bricks: [{ c: 0, r: L.ROWS - 2, n: 50 }] }), s = run.state;
  assert.ok(run.live());
  run.setAim(0); run.fire(); run.finish();
  assert.strictEqual(s.over, true);
  assert.strictEqual(run.live(), false);
  assert.strictEqual(s.turn, 1, 'turen tæller ikke op efter game over');
  assert.strictEqual(run.fire(), false);
});
test('en sten én række over bundlinjen er ikke game over endnu', function () {
  var run = board({ bricks: [{ c: 0, r: L.ROWS - 3, n: 50 }] }), s = run.state;
  run.fire(); run.finish();
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.turn, 2);
});
test('knuses stenen ved bundlinjen i sidste øjeblik, fortsætter spillet', function () {
  var run = board({ bricks: [{ c: 3, r: L.ROWS - 2, n: 1 }] }), s = run.state;
  run.setAim(0); run.fire(); run.finish();
  assert.strictEqual(s.over, false);
});
test('end() giver point, ture og knuste sten', function () {
  var run = board({ bricks: [{ c: 3, r: 4, n: 1 }] });
  run.fire(); run.finish();
  assert.deepStrictEqual(run.end(), { score: 11, turns: 2, broken: 1 });
  assert.strictEqual(run.live(), false);
});

// ---------- Spring frem og determinisme ----------
function play(seed, aims, stepper) {
  var run = L.createRun({ seed: seed }), s = run.state, k = 0;
  while (run.live() && k < 400) {
    run.setAim(aims[k % aims.length]); run.fire(); stepper(run); k++;
  }
  return { score: s.score, turn: s.turn, balls: s.balls, broken: s.broken, origin: s.originX, over: s.over, bricks: JSON.stringify(s.bricks) };
}
var AIMS = [-33, 47, 12, -61, 70, -5, 28, -48, 3, 55];
test('Spring frem giver præcis samme resultat som at se salven til ende', function () {
  var a = play(2024, AIMS, function (r) { r.finish(); });
  var b = play(2024, AIMS, function (r) { while (r.volleyActive()) r.step(1); });
  var c = play(2024, AIMS, function (r) { r.step(37); r.finish(); });
  assert.deepStrictEqual(a, b); assert.deepStrictEqual(a, c);
});
test('samme seed og samme vinkler giver samme spil; andet seed giver et andet', function () {
  var a = play(777, AIMS, function (r) { r.finish(); }), b = play(777, AIMS, function (r) { r.finish(); });
  assert.deepStrictEqual(a, b);
  var c = play(778, AIMS, function (r) { r.finish(); });
  assert.notDeepStrictEqual(a.bricks, c.bricks);
});
test('hele spil ender altid med game over (uendelig mur, ingen hængende salver)', function () {
  var t0 = Date.now(), turns = [];
  for (var seed = 1; seed <= 25; seed++) {
    var res = play(seed, AIMS.map(function (a) { return a + seed % 7; }), function (r) { r.finish(); });
    assert.ok(res.over, 'seed ' + seed + ' sluttede ikke');
    turns.push(res.turn);
  }
  console.log('     (25 spil: ' + Math.min.apply(null, turns) + '–' + Math.max.apply(null, turns) + ' ture, ' + (Date.now() - t0) + ' ms)');
});

console.log('\n' + (n - failed) + ' af ' + n + ' test bestået');
process.exit(failed ? 1 : 0);
