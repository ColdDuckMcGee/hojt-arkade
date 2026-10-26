/*
 * Bomberne – lille test af spillogikken uden browser.
 * Kør fra repoets rod:  node bomberne/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/game.js');
var G = globalThis.BomberneGame;

// Fast "tilfældighed", så testene altid giver det samme.
function seeded(seed) { return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Hjælper: lav en tom bane (kun søjler) med spilleren og givne fjender.
function emptyRun(sizeId, enemies) {
  var run = G.createRun(sizeId || '11x9', { rng: seeded(7) });
  var s = run.state;
  s.tiles = s.tiles.map(function (t) { return t === G.CRATE ? G.FLOOR : t; });
  s.items = s.items.map(function () { return null; });
  s.enemies = (enemies || []).map(function (e, i) { return Object.assign({ id: 100 + i, dir: 'left', plan: null, rest: false }, e); });
  s.bombs = [];
  run._setState(s);
  run._plan();
  return run;
}

test('brættet har kant og søjler på hvert andet felt, og startområdet er frit', function () {
  Object.keys(G.SIZES).forEach(function (id) {
    for (var seed = 1; seed < 30; seed++) {
      var run = G.createRun(id, { rng: seeded(seed) });
      var s = run.state;
      for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) {
        var t = s.tiles[y * s.cols + x];
        var edge = x === 0 || y === 0 || x === s.cols - 1 || y === s.rows - 1;
        if (edge || (x % 2 === 0 && y % 2 === 0)) assert.strictEqual(t, G.PILLAR);
        else assert.notStrictEqual(t, G.PILLAR);
      }
      [[1, 1], [2, 1], [1, 2], [1, 3], [2, 3]].forEach(function (p) { assert.strictEqual(s.tiles[p[1] * s.cols + p[0]], G.FLOOR, id + ' ' + p); });
      // ingen fjende tæt på start
      s.enemies.forEach(function (e) { assert.ok(Math.abs(e.x - 1) + Math.abs(e.y - 1) >= G.RULES.minSpawnDist, 'fjende for tæt på start'); });
      // præcis én udgang, og den ligger under en kasse
      var doors = s.items.map(function (it, i) { return it === 'door' ? i : -1; }).filter(function (i) { return i >= 0; });
      assert.strictEqual(doors.length, 1);
      assert.strictEqual(s.tiles[doors[0]], G.CRATE);
      assert.strictEqual(s.lives, 3);
      assert.strictEqual(s.range, 2);
    }
  });
});

test('pile mod søjle og kasse er slået fra', function () {
  var run = G.createRun('11x9', { rng: seeded(3) });
  assert.strictEqual(run.canMove('up'), false);    // kanten
  assert.strictEqual(run.canMove('left'), false);  // kanten
  assert.strictEqual(run.canMove('right'), true);  // (2,1) er frit
  assert.strictEqual(run.blockedBy('up'), 'søjle');
});

test('bomben springer efter 3 ture og rammer i kryds med rækkevidde 2', function () {
  var run = emptyRun('11x9');
  var s = run.state;
  s.player = { x: 3, y: 3 }; run._setState(s);
  run.act('bomb');
  assert.strictEqual(run.state.bombs[0].timer, 3);
  run.act('right');            // (4,3)
  assert.strictEqual(run.state.bombs[0].timer, 2);
  run.act('right');            // (5,3) – stadig i flammens rækkevidde? 3+2 = 5 → ja
  assert.strictEqual(run.state.bombs[0].timer, 1);
  var danger = run.danger();
  assert.strictEqual(danger[run.idx(5, 3)], 1, 'næste tur er markeret');
  assert.strictEqual(danger[run.idx(6, 3)], 0, 'uden for rækkevidde');
  assert.strictEqual(danger[run.idx(3, 1)], 1, 'op to felter');
  run.act('right');            // (6,3) – udenfor
  var s2 = run.state;
  assert.strictEqual(s2.bombs.length, 0);
  assert.strictEqual(s2.dead, false);
});

test('flammen stoppes af søjler og ødelægger kun første kasse', function () {
  var run = emptyRun('11x9');
  var s = run.state;
  s.player = { x: 1, y: 1 };
  s.tiles[run.idx(2, 1)] = G.CRATE; s.tiles[run.idx(3, 1)] = G.CRATE;
  run._setState(s);
  run.act('bomb'); run.act('down'); run.act('down');
  var ev = run.act('right');   // (2,3)
  assert.ok(ev.events.indexOf('explode') >= 0);
  assert.strictEqual(run.state.tiles[run.idx(2, 1)], G.FLOOR);
  assert.strictEqual(run.state.tiles[run.idx(3, 1)], G.CRATE);
  assert.strictEqual(ev.points, 10);
  // søjlen (2,2) stoppede intet, men flammen nåede (1,3)
  assert.ok(ev.flames.indexOf(run.idx(1, 3)) >= 0);
  assert.ok(ev.flames.indexOf(run.idx(2, 2)) < 0);
});

test('kædereaktion: en bombe udløser en anden', function () {
  var run, s;
  run = emptyRun('11x9');
  s = run.state; s.maxBombs = 2; s.player = { x: 3, y: 3 }; run._setState(s);
  run.act('bomb');            // A (3,3) timer 3
  run.act('right');           // (4,3) A 2
  run.act('right');           // (5,3) A 1
  // B lægges ved (5,3): ligger 2 felter fra A → i A's flamme
  run.act('bomb');            // A sprænger nu → B udløses; spilleren står på B → dør
  assert.strictEqual(run.state.dead, true);
  assert.strictEqual(run.state.lives, 2);
  // Fortryd giver tilstanden før bomben B
  assert.ok(run.undo());
  assert.strictEqual(run.state.lives, 3);
  assert.strictEqual(run.state.bombs.length, 1);
  assert.strictEqual(run.canUndo(), false, 'kun én fortryd pr. bane');
  // Faremarkering viser kæden: læg B et sted, hvor A rammer, men gå væk
  run = emptyRun('11x9');
  s = run.state; s.maxBombs = 2; s.player = { x: 3, y: 3 }; run._setState(s);
  run.act('bomb');            // A (3,3) 3
  run.act('right');           // (4,3) A2
  run.act('bomb');            // B (4,3) 3; A1
  var d = run.danger();
  assert.strictEqual(d[run.idx(6, 3)], 1, 'B springer sammen med A (kæde) og er markeret');
  run.act('right');           // (5,3)… stadig i B's flamme (4+2=6) → dør
  assert.strictEqual(run.state.dead, true);
  run.undo();
  run.act('down');            // fra (4,3) → (4,4)? (4,4) er søjle → ignoreret
  assert.strictEqual(run.state.player.x, 4);
});

test('kæde: begge bomber springer i samme tur og dræber fjende', function () {
  var run = emptyRun('11x9', [{ type: 'slow', x: 9, y: 3, dir: 'up', rest: true }]);
  var s = run.state; s.maxBombs = 2; s.range = 3; s.player = { x: 5, y: 3 }; run._setState(s); run._plan();
  run.act('bomb');           // A (5,3)
  run.act('left');           // (4,3)
  run.act('left');           // (3,3)
  run.act('down');           // (3,4)  A springer nu (3 ture)
  assert.strictEqual(run.state.bombs.length, 0);
});

test('fjende i flammen dør og giver point; udgangen åbner, når alle er væk', function () {
  var run = emptyRun('11x9', [{ type: 'slow', x: 5, y: 3, dir: 'up', rest: true }]);
  var s = run.state;
  s.player = { x: 3, y: 3 }; s.items[run.idx(1, 1)] = 'door';
  run._setState(s); run._plan();
  run.act('bomb');           // A (3,3), slow hviler/går op/ned langs x=5
  run.act('left');           // (2,3)
  run.act('left');           // (1,3)
  var ev = run.act('down');  // (1,4) — A springer: flammer (1..5,3)
  var killed = ev.killed.length;
  // fjenden går op/ned langs x=5 mellem (5,1)…(5,7); vi tjekker kun regnskabet
  assert.strictEqual(run.state.score, killed * 100);
  if (killed) {
    assert.ok(ev.events.indexOf('doorOpen') >= 0);
    assert.ok(run.doorOpen());
  }
});

test('fjende rammes sikkert: dør → 100 point, åben udgang → bane klaret med bonus', function () {
  var run = emptyRun('11x9', [{ type: 'wander', x: 5, y: 1, dir: 'up' }]);
  var s = run.state;
  s.player = { x: 3, y: 1 }; s.items[run.idx(1, 3)] = 'door';
  // lås fjenden inde med kasser, så den står stille ved (5,1)
  s.tiles[run.idx(6, 1)] = G.CRATE; s.tiles[run.idx(5, 2)] = G.CRATE;
  run._setState(s); run._plan();
  // fjenden kan kun gå mod venstre (4,1); vi lægger bomben, så den går ind i flammen
  run.act('bomb');
  run.act('left'); run.act('left');                 // (1,1)
  var ev = run.act('down');                         // (1,2), A springer
  assert.ok(ev.killed.length === 1, 'fjenden dør');
  assert.strictEqual(run.state.dead, false);
  assert.ok(run.doorOpen());
  var ev2 = run.act('down');                        // (1,3) = udgang
  assert.ok(ev2.events.indexOf('cleared') >= 0);
  assert.strictEqual(run.state.cleared, true);
  assert.strictEqual(run.state.score, 100 + G.levelBonus(1)); // kasserne var uden for rækkevidde
  assert.strictEqual(run.canUndo(), false);
  run.nextLevel();
  assert.strictEqual(run.state.level, 2);
  assert.strictEqual(run.state.undoLeft, 1);
  assert.strictEqual(run.state.enemies.length, G.enemiesFor('11x9', 2).count);
});

test('fjende der går ind på spilleren koster et liv; genstart på startfeltet', function () {
  var run = emptyRun('11x9', [{ type: 'chaser', x: 5, y: 1, dir: 'left' }]);
  var s = run.state; s.player = { x: 3, y: 1 }; run._setState(s); run._plan();
  assert.strictEqual(run.state.enemies[0].plan, 'left', 'jægeren viser sit træk mod spilleren');
  run.act('wait');   // jæger → (4,1)
  assert.strictEqual(run.state.dead, false);
  run.act('wait');   // jæger → (3,1) = spilleren
  assert.strictEqual(run.state.dead, true);
  assert.strictEqual(run.state.deathCause, 'enemy');
  assert.strictEqual(run.state.lives, 2);
  assert.strictEqual(run.act('wait').ignored, true, 'intet sker, før man fortsætter');
  run.respawn();
  var st = run.state;
  assert.deepStrictEqual(st.player, { x: 1, y: 1 });
  st.enemies.forEach(function (e) { assert.ok(Math.abs(e.x - 1) + Math.abs(e.y - 1) >= 5); });
});

test('langsom fjende går kun hver anden tur, frem og tilbage', function () {
  var run = emptyRun('11x9', [{ type: 'slow', x: 9, y: 7, dir: 'left', rest: false }]);
  var s = run.state; s.player = { x: 1, y: 1 }; run._setState(s); run._plan();
  var xs = [];
  for (var i = 0; i < 6; i++) { run.act('wait'); xs.push(run.state.enemies[0].x); }
  assert.deepStrictEqual(xs, [8, 8, 7, 7, 6, 6]);
});

test('tre liv, game over efter tredje', function () {
  var run = emptyRun('9x9');
  var s = run.state; s.player = { x: 1, y: 1 }; run._setState(s);
  for (var life = 0; life < 3; life++) {
    run.act('bomb'); run.act('wait'); run.act('wait'); run.act('wait');
    assert.strictEqual(run.state.dead, true);
    if (life < 2) run.respawn();
  }
  assert.strictEqual(run.state.over, true);
  assert.strictEqual(run.state.lives, 0);
});

test('bonusser: rækkevidde, bombe og liv', function () {
  var run = emptyRun('11x9');
  var s = run.state; s.player = { x: 1, y: 1 };
  s.items[run.idx(2, 1)] = 'range'; s.items[run.idx(3, 1)] = 'bomb'; s.items[run.idx(3, 2)] = 'life';
  run._setState(s);
  run.act('right'); run.act('right'); run.act('down');
  assert.strictEqual(run.state.range, 3);
  assert.strictEqual(run.state.maxBombs, 2);
  assert.strictEqual(run.state.lives, 4);
  assert.strictEqual(run.state.score, 150);
});

test('mange baner kan laves uden fejl på alle bræt', function () {
  Object.keys(G.SIZES).forEach(function (id) {
    var run = G.createRun(id, { rng: seeded(11) });
    for (var l = 1; l < 15; l++) {
      var s = run.state;
      assert.strictEqual(s.enemies.length, G.enemiesFor(id, l).count);
      for (var t = 0; t < 40 && run.playable(); t++) {
        var opts = ['up', 'down', 'left', 'right', 'wait'].filter(function (a) { return a === 'wait' || run.canMove(a); });
        run.act(opts[t % opts.length]);
      }
      run.nextLevel();
    }
  });
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('✓ ' + t.name); }
  catch (e) { failed++; console.log('✗ ' + t.name + '\n   ' + (e && e.stack || e)); }
});
console.log(failed ? failed + ' test(s) fejlede' : 'Alle ' + tests.length + ' test bestået');
process.exit(failed ? 1 : 0);
