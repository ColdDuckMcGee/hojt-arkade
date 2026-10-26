/*
 * Bobler – test af spillogikken uden browser.
 * Kør fra repoets rod:  node bobler/test/spillogik.test.js
 * Tjekker hexgitterets naboer, landing i hul, bane med tilbagespring, match-3
 * med flood fill, fald af løse bobler, loftet, game over, banskift, point og fortryd.
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.BoblerGame;

function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Hjælper: en kørsel med et bestemt bræt. rows: liste af rækker (tal = farve, '.' = tom).
function runWith(rows, opts) {
  opts = opts || {};
  var run = G.createRun(opts.diff || '5', { rng: seeded(opts.seed || 5) });
  var s = run.state;
  s.grid = G.emptyGrid();
  rows.forEach(function (row, r) {
    row.split('').filter(function (ch) { return ch !== ' '; }).forEach(function (ch, c) { s.grid[r][c] = ch === '.' ? -1 : Number(ch); });
  });
  s.current = opts.current !== undefined ? opts.current : 0;
  s.next = opts.next !== undefined ? opts.next : 1;
  s.ceiling = opts.ceiling || 0; s.misses = opts.misses || 0;
  run._setState(s);
  return run;
}
function sameSet(a, b) {
  var f = function (l) { return l.map(function (p) { return p[0] + ',' + p[1]; }).sort().join(' '); };
  assert.strictEqual(f(a), f(b));
}

test('hexgitter: 8 bobler i lige rækker, 7 i ulige, og naboer begge veje', function () {
  assert.strictEqual(G.rowLen(0), 8); assert.strictEqual(G.rowLen(1), 7);
  sameSet(G.neighbors(2, 3), [[2, 2], [2, 4], [1, 2], [1, 3], [3, 2], [3, 3]]);
  sameSet(G.neighbors(1, 3), [[1, 2], [1, 4], [0, 3], [0, 4], [2, 3], [2, 4]]);
  sameSet(G.neighbors(0, 0), [[0, 1], [1, 0]]);
  sameSet(G.neighbors(1, 6), [[1, 5], [0, 6], [0, 7], [2, 6], [2, 7]]);
  // naboskab er symmetrisk, og naboer ligger præcis én boble væk
  for (var r = 0; r < G.ROWS; r++) for (var c = 0; c < G.rowLen(r); c++) {
    G.neighbors(r, c).forEach(function (n) {
      assert.ok(G.neighbors(n[0], n[1]).some(function (m) { return m[0] === r && m[1] === c; }));
      var d = Math.hypot(G.cellX(r, c) - G.cellX(n[0], n[1]), G.cellY(r) - G.cellY(n[0]));
      assert.ok(Math.abs(d - 1) < 1e-9, 'afstand ' + d);
    });
  }
});

test('lige op på et tomt bræt lander i øverste række', function () {
  var run = runWith([]);
  var tr = run.aim(0);
  assert.strictEqual(tr.hit, 'loft');
  assert.strictEqual(tr.bounces, 0);
  assert.strictEqual(tr.cell.r, 0);
  assert.ok(tr.cell.c === 3 || tr.cell.c === 4);
});

test('landing/snap: boblen lander i hullet under den boble, den rammer', function () {
  var run = runWith(['. . . 2 2 . . .']);
  var tr = run.aim(0);           // lige op mellem (0,3) og (0,4)
  assert.strictEqual(tr.hit, 'boble');
  assert.deepStrictEqual(tr.cell, { r: 1, c: 3 });
  var tr2 = run.aim(-6);         // lidt til venstre: rammer (0,3) fra neden-venstre
  assert.strictEqual(tr2.cell.r, 1);
  assert.ok(tr2.cell.c === 2 || tr2.cell.c === 3);
});

test('banen springer tilbage fra væggen, og sigtelinjen viser hvor', function () {
  var run = runWith([]);
  var tr = run.aim(-60);
  assert.ok(tr.bounces >= 1, 'mindst ét tilbagespring');
  var b = tr.path[1];
  assert.ok(Math.abs(b.x - 0.5) < 1e-6, 'første tilbagespring er ved venstre væg');
  // vinkel ind = vinkel ud: efter tilbagespringet går banen mod højre
  assert.ok(tr.path[2].x > b.x);
  // spejlet vinkel giver spejlet bane
  var tr2 = run.aim(60);
  assert.ok(Math.abs(tr2.path[1].x - (G.W - 0.5)) < 1e-6);
  assert.ok(Math.abs(tr2.path[1].y - b.y) < 1e-6);
  assert.strictEqual(tr2.cell.c, G.rowLen(tr2.cell.r) - 1 - tr.cell.c);
  // vinklen holdes inden for grænsen
  assert.deepStrictEqual(run.aim(170).path[1], run.aim(G.MAX_ANGLE).path[1]);
});

test('skuddet lander præcis der, hvor spøgelsesboblen viser', function () {
  for (var seed = 1; seed < 15; seed++) {
    var run = G.createRun('5', { rng: seeded(seed) });
    for (var a = -G.MAX_ANGLE; a <= G.MAX_ANGLE && run.playable(); a += 13) {
      var aim = run.aim(a), col = run.state.current;
      var ev = run.shoot(a);
      assert.deepStrictEqual(ev.cell, aim.cell);
      if (!ev.popped.length && !run.state.cleared && !run.state.over) assert.strictEqual(run.state.grid[aim.cell.r][aim.cell.c], col);
    }
  }
});

test('match-3 med flood fill: tre ens forsvinder, to ens bliver', function () {
  // to røde (0) i række 1 – find en vinkel, der lander ved siden af dem
  var ev, run = runWith(['1 1 . . . . . .', ' 0 0 . . . . .'], { current: 0 });
  var angle = null;
  for (var a = -G.MAX_ANGLE; a <= 0; a += 0.5) { var c = run.aim(a).cell; if (c.r === 1 && c.c === 2) { angle = a; break; } }
  assert.ok(angle !== null, 'fandt en vinkel til hullet (1,2)');
  ev = run.shoot(angle);
  assert.strictEqual(ev.popped.length, 3);
  assert.strictEqual(run.state.grid[1][0], -1);
  assert.strictEqual(run.state.grid[0][0], 1, 'den anden farve bliver');
  assert.strictEqual(G.cluster([[0, 0, 0, -1, -1, -1, -1, -1]].concat(G.emptyGrid().slice(1)), 0, 1).length, 3);
  // to ens forsvinder ikke
  var run2 = runWith(['1 1 1 1 1 1 1 1', ' 0 . . . . . .'], { current: 0 });
  for (a = -G.MAX_ANGLE; a <= 0; a += 0.5) { if (run2.aim(a).cell.r === 1 && run2.aim(a).cell.c === 1) break; }
  var ev2 = run2.shoot(a);
  assert.strictEqual(ev2.popped.length, 0);
  assert.strictEqual(run2.state.misses, 1);
});

test('bobler, der ikke hænger fast i loftet, falder og giver ekstra point', function () {
  // 0 i række 0 holder en kæde af 2'ere nedad. Sprænges 0-klyngen, falder 2'erne.
  var g = G.emptyGrid();
  g[0][0] = 0; g[0][1] = 0; g[0][7] = 3;
  g[1][0] = 2; g[2][0] = 2; g[3][0] = 4;
  assert.strictEqual(G.floating(g).length, 0);
  var g2 = JSON.parse(JSON.stringify(g)); g2[0][0] = -1; g2[0][1] = -1;
  sameSet(G.floating(g2).map(function (p) { return [p.r, p.c]; }), [[1, 0], [2, 0], [3, 0]]);
  // som et rigtigt skud
  var run = runWith(['0 0 . . . . . 3', ' 2 . . . . . .', '2 . . . . . . .', ' 4 . . . . . .'], { current: 0 });
  var angle = null;
  for (var a = -10; a <= 40; a += 0.25) { var c = run.aim(a).cell; if (c.r === 0 && c.c === 2) { angle = a; break; } }
  assert.ok(angle !== null);
  var ev = run.shoot(angle);
  assert.strictEqual(ev.popped.length, 3);
  assert.strictEqual(ev.fallen.length, 3);
  assert.strictEqual(ev.points, 3 * G.RULES.pointsPop + 3 * G.RULES.pointsFall);
  assert.strictEqual(run.state.score, 90);
  assert.strictEqual(G.count(run.state.grid), 1);
});

test('mange faldne på én gang tæller dobbelt', function () {
  var rows = ['0 0 . . . . . 3', ' 2 . . . . . .', '2 . . . . . . .', ' 2 . . . . . .', '2 . . . . . . .', ' 2 . . . . . .', '2 . . . . . . .'];
  var run = runWith(rows, { current: 0 });
  var angle = null;
  for (var a = -10; a <= 40; a += 0.25) { var c = run.aim(a).cell; if (c.r === 0 && c.c === 2) { angle = a; break; } }
  var ev = run.shoot(angle);
  assert.strictEqual(ev.fallen.length, 6);
  assert.strictEqual(ev.fallPoints, 6 * G.RULES.pointsFall * 2);
});

test('loftet rykker kun ned efter 5 skud, der ikke fjerner noget', function () {
  var run = runWith(['1 2 1 2 1 2 1 2'], { current: 3, next: 4 });
  for (var i = 1; i <= 4; i++) {
    run.state.current = (i % 2) ? 3 : 4;
    var ev = run.shoot(i % 2 ? -40 : 40);
    assert.strictEqual(ev.events.indexOf('ceiling'), -1);
    assert.strictEqual(run.shotsToCeiling(), 5 - i);
  }
  assert.strictEqual(run.state.ceiling, 0);
  var tr = run.aim(0);
  ev = run.shoot(0);
  assert.ok(ev.events.indexOf('ceiling') >= 0);
  assert.strictEqual(run.state.ceiling, 1);
  assert.strictEqual(run.shotsToCeiling(), 5);
  // efter loftet er rykket, ligger boblerne en række længere nede
  assert.ok(Math.abs(G.cellY(0, run.state.ceiling) - G.cellY(1, 0)) < 1e-9);
  assert.ok(tr.cell);
});

test('game over, når en boble når bundlinjen', function () {
  var rows = [];
  for (var r = 0; r < G.DEAD_ROW - 1; r++) rows.push(r % 2 ? ' 1 2 1 2 1 2 1' : '1 2 1 2 1 2 1 2');
  var run = runWith(rows, { current: 3, next: 4, misses: 0 });
  var ev = run.shoot(0);            // lander i række 10 (= DEAD_ROW - 1), ingen match
  assert.strictEqual(run.state.over, false);
  run.state.current = 4;
  ev = run.shoot(0);               // lander i række 11 = bundlinjen
  assert.ok(ev.events.indexOf('over') >= 0);
  assert.strictEqual(run.state.over, true);
  assert.strictEqual(run.shoot(0).ignored, true, 'ingen skud efter game over');
  // loftet kan også skubbe boblerne ned til bundlinjen
  var run2 = runWith(rows.slice(0, G.DEAD_ROW - 1), { current: 5, misses: 4 });
  run2.state.grid[G.DEAD_ROW - 1] = run2.state.grid[G.DEAD_ROW - 1].map(function () { return -1; });
  run2.state.grid[G.DEAD_ROW - 2][0] = 1;
  var ev2 = run2.shoot(-30);
  assert.ok(ev2.events.indexOf('ceiling') >= 0);
  assert.strictEqual(run2.state.over, true);
});

test('ryddet bræt giver bonus og ny bane med flere farver', function () {
  var run = runWith(['0 0 . . . . . .'], { current: 0 });
  var angle = null;
  for (var a = -40; a <= 40; a += 0.25) { var c = run.aim(a).cell; if (c.r === 0 && c.c === 2) { angle = a; break; } }
  var ev = run.shoot(angle);
  assert.ok(ev.events.indexOf('cleared') >= 0);
  assert.strictEqual(ev.bonus, G.levelBonus(1));
  assert.strictEqual(run.state.score, 30 + 250);
  assert.strictEqual(run.state.levelsCleared, 1);
  assert.strictEqual(run.canUndo(), false);
  run.nextLevel();
  var s = run.state;
  assert.strictEqual(s.level, 2);
  assert.strictEqual(s.colors, 6);
  assert.strictEqual(s.ceiling, 0); assert.strictEqual(s.misses, 0); assert.strictEqual(s.undoLeft, 1);
  assert.strictEqual(G.presentColors(s.grid).length, 6);
  assert.strictEqual(s.score, 280, 'point følger med');
});

test('ny bane: alle farver er med, ingen løse bobler, og næste boble har en farve fra brættet', function () {
  Object.keys(G.DIFFS).forEach(function (d) {
    for (var seed = 1; seed < 40; seed++) {
      var run = G.createRun(d, { rng: seeded(seed), level: 1 + seed % 5 });
      var s = run.state;
      assert.strictEqual(s.colors, G.colorsFor(d, s.level));
      assert.strictEqual(G.presentColors(s.grid).length, s.colors);
      assert.strictEqual(G.floating(s.grid).length, 0);
      assert.strictEqual(G.count(s.grid) > 0, true);
      var pres = G.presentColors(s.grid);
      assert.ok(pres.indexOf(s.current) >= 0 && pres.indexOf(s.next) >= 0);
    }
  });
  assert.strictEqual(G.colorsFor('4', 1), 4);
  assert.strictEqual(G.colorsFor('6', 9), 7);
});

test('byt bytter nuværende og næste boble', function () {
  var run = runWith(['0 1 2 3 . . . .'], { current: 2, next: 3 });
  assert.strictEqual(run.swap(), true);
  assert.strictEqual(run.state.current, 3); assert.strictEqual(run.state.next, 2);
});

test('fortryd sidste skud én gang pr. bane, også efter game over', function () {
  var run = runWith(['1 2 1 2 1 2 1 2'], { current: 3, next: 4 });
  var before = JSON.stringify(run.state);
  run.shoot(0);
  assert.strictEqual(run.canUndo(), true);
  assert.strictEqual(run.undo(), true);
  var after = JSON.parse(JSON.stringify(run.state)); after.undoLeft = 1;
  assert.strictEqual(JSON.stringify(after), before);
  assert.strictEqual(run.state.undoLeft, 0);
  run.shoot(0);
  assert.strictEqual(run.canUndo(), false, 'kun én gang pr. bane');
  var rows = [];
  for (var r = 0; r < G.DEAD_ROW; r++) rows.push(r % 2 ? ' 1 2 1 2 1 2 1' : '1 2 1 2 1 2 1 2');
  var run2 = runWith(rows, { current: 3 });
  run2.shoot(0);
  assert.strictEqual(run2.state.over, true);
  assert.strictEqual(run2.undo(), true);
  assert.strictEqual(run2.state.over, false);
});

test('lange tilfældige spil på alle sværhedsgrader kører uden fejl', function () {
  Object.keys(G.DIFFS).forEach(function (d) {
    var rng = seeded(99);
    var run = G.createRun(d, { rng: seeded(3) });
    var shots = 0;
    while (shots < 3000) {
      if (run.state.cleared) run.nextLevel();
      if (run.state.over) break;
      var ev = run.shoot(rng() * 160 - 80);
      assert.strictEqual(ev.ignored, false);
      assert.strictEqual(G.floating(run.state.grid).length, 0, 'ingen svævende bobler');
      shots++;
    }
    assert.ok(run.state.over || shots === 3000);
  });
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('✓ ' + t.name); }
  catch (e) { failed++; console.log('✗ ' + t.name + '\n   ' + (e && e.stack || e)); }
});
console.log(failed ? failed + ' test(s) fejlede' : 'Alle ' + tests.length + ' test bestået');
process.exit(failed ? 1 : 0);
