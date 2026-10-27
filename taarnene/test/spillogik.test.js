// Test af Tårnenes spillogik (ingen browser): node taarnene/test/spillogik.test.js
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.TaarneneLogik;
var n = 0;
function test(name, fn) { fn(); n++; console.log('OK  ' + name); }

// En bane til test: lige sti gennem midten af 6 × 3
var LIGE = { id: 'test', w: 6, h: 3, path: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]] };
function nyt(opts) { return L.createGame(Object.assign({ map: LIGE, seed: 7 }, opts || {})); }
function idx(g, x, y) { return y * g.state.map.w + x; }

test('alle baner er gyldige og forskellige', function () {
  var maps = L.allMaps(), ids = {};
  assert.ok(maps.length >= 6);
  maps.forEach(function (m) {
    assert.ok(L.validMap(m), m.id);
    assert.ok(!ids[m.id], 'dublet ' + m.id); ids[m.id] = 1;
    var x0 = m.path[0][0], y0 = m.path[0][1], e = m.path[m.path.length - 1];
    assert.ok(x0 === 0 || y0 === 0 || x0 === m.w - 1 || y0 === m.h - 1, 'indgang på kanten ' + m.id);
    assert.ok(e[0] === 0 || e[1] === 0 || e[0] === m.w - 1 || e[1] === m.h - 1, 'udgang på kanten ' + m.id);
    for (var i = 1; i < m.path.length; i++)
      assert.strictEqual(Math.abs(m.path[i][0] - m.path[i - 1][0]) + Math.abs(m.path[i][1] - m.path[i - 1][1]), 1, 'sammenhængende ' + m.id);
  });
  assert.ok(!L.validMap({ id: 'x', w: 3, h: 3, path: [[0, 0], [2, 0]] }), 'hul i stien er ugyldig');
  assert.ok(!L.validMap({ id: 'x', w: 3, h: 3, path: [[0, 1], [1, 1], [1, 1], [2, 1]] }), 'samme felt to gange er ugyldigt');
});

test('posAt: midten af felterne og glidning imellem', function () {
  assert.deepStrictEqual(L.posAt(LIGE, 0), { x: 0.5, y: 1.5 });
  assert.deepStrictEqual(L.posAt(LIGE, 2), { x: 2.5, y: 1.5 });
  var h = L.posAt(LIGE, 2.5); assert.ok(Math.abs(h.x - 3) < 1e-9 && Math.abs(h.y - 1.5) < 1e-9);
  assert.ok(L.posAt(LIGE, -0.6).x < 0.5, 'før indgangen');
  var m = L.MAPS[0], p = L.posAt(m, 7); assert.deepStrictEqual(p, { x: m.path[7][0] + 0.5, y: m.path[7][1] + 0.5 });
});

test('stien kan ikke bebygges, og felter kan kun bruges én gang', function () {
  var g = nyt();
  assert.strictEqual(g.build(idx(g, 2, 1), 'laser').why, 'sti');
  assert.ok(g.build(idx(g, 2, 0), 'laser').ok);
  assert.strictEqual(g.build(idx(g, 2, 0), 'laser').why, 'optaget');
  assert.strictEqual(g.canBuild(99).why, 'udenfor');
});

test('økonomi: byg, opgrader, sælg (fortryd i samme pause = fuld pris)', function () {
  var g = nyt(), s = g.state, i = idx(g, 2, 0);
  assert.strictEqual(s.money, L.RULES.startMoney);
  g.build(i, 'laser'); assert.strictEqual(s.money, 40 - 10);
  var up = L.upgradeCost('laser', 1); assert.strictEqual(up, 8);
  assert.ok(g.upgrade(i).ok); assert.strictEqual(s.towers[i].level, 2); assert.strictEqual(s.money, 22);
  assert.strictEqual(g.sellValue(i), 18, 'alt tilbage, da det er bygget i denne pause');
  assert.strictEqual(g.sell(i).value, 18); assert.strictEqual(s.money, 40);
  // Efter en bølge: 70 % tilbage
  g.build(i, 'laser');
  g.startWave(); g.runWave();
  var before = s.money;
  assert.strictEqual(g.sellValue(i), Math.floor(10 * L.RULES.sellRate));
  g.sell(i); assert.strictEqual(s.money, before + 7);
  // For få penge
  s.money = 5; var r = g.build(i, 'kanon');
  assert.deepStrictEqual([r.ok, r.why, r.mangler], [false, 'penge', 20]);
  // Højeste niveau
  s.money = 1000; g.build(i, 'puls'); g.upgrade(i); g.upgrade(i);
  assert.strictEqual(g.upgrade(i).why, 'max');
});

test('der kan ikke bygges under bølgen', function () {
  var g = nyt(); g.startWave();
  assert.strictEqual(g.build(idx(g, 1, 0), 'laser').why, 'boelge');
  assert.strictEqual(g.startWave().ok, false);
});

test('skade: laser rammer den forreste fjende i rækkevidde', function () {
  var g = nyt(), s = g.state, i = idx(g, 2, 0);
  g.build(i, 'laser'); g.startWave();
  s.queue = [];
  s.enemies = [{ id: 1, type: 'kugle', hp: 10, maxHp: 10, p: 1, slow: 0 }, { id: 2, type: 'kugle', hp: 10, maxHp: 10, p: 2, slow: 0 }];
  var ev = g.step();      // de går til 2 og 3; laser i (2.5,0.5) når begge (afstand 1 og 1,41)
  assert.deepStrictEqual(ev.shots, [{ tower: i, type: 'laser', targets: [2] }]);
  assert.strictEqual(s.enemies[1].hp, 10 - L.towerStats('laser', 1).dmg);
  assert.strictEqual(s.enemies[0].hp, 10);
});

test('skade: puls rammer alle i rækkevidde, kanon venter et trin', function () {
  var g = nyt(), s = g.state;
  g.build(idx(g, 2, 0), 'puls'); s.money = 100; g.build(idx(g, 3, 2), 'kanon'); g.startWave(); s.queue = [];
  s.enemies = [{ id: 1, type: 'kasse', hp: 50, maxHp: 50, p: 1.5, slow: 0 }, { id: 2, type: 'kasse', hp: 50, maxHp: 50, p: 2.5, slow: 0 }];
  var ev = g.step();
  var puls = ev.shots.filter(function (x) { return x.type === 'puls'; })[0];
  assert.deepStrictEqual(puls.targets.sort(), [1, 2]);
  assert.ok(ev.shots.some(function (x) { return x.type === 'kanon'; }));
  var ev2 = g.step();
  assert.ok(!ev2.shots.some(function (x) { return x.type === 'kanon'; }), 'kanonen lader');
  var ev3 = g.step();
  assert.ok(ev3.shots.some(function (x) { return x.type === 'kanon'; }), 'kanonen skyder igen');
});

test('frost gør fjenderne langsommere', function () {
  var g = nyt(), s = g.state;
  g.build(idx(g, 1, 0), 'frost'); g.startWave(); s.queue = [];
  s.enemies = [{ id: 1, type: 'kugle', hp: 10, maxHp: 10, p: 0, slow: 0 }];
  g.step(); assert.strictEqual(s.enemies[0].p, 1); assert.ok(s.enemies[0].slow > 0);
  g.step(); assert.strictEqual(s.enemies[0].p, 1.5, 'halv fart');
  assert.strictEqual(s.enemies[0].hp, 10, 'frost niveau 1 gør ingen skade');
});

test('nedkæmpede fjender giver penge og point, bølgen giver bonus', function () {
  var g = nyt(), s = g.state;
  g.build(idx(g, 2, 0), 'laser'); g.startWave(); s.queue = [];
  s.enemies = [{ id: 1, type: 'pil', hp: 1, maxHp: 1, p: 1, slow: 0 }];
  var m0 = s.money, ev = g.step();
  assert.strictEqual(ev.killed.length, 1);
  assert.ok(ev.waveDone, 'sidste fjende væk = bølgen klaret');
  assert.strictEqual(s.money, m0 + L.ENEMIES.pil.money + L.RULES.waveMoney(1));
  assert.strictEqual(s.score, L.ENEMIES.pil.points + L.RULES.wavePoints(1));
  assert.deepStrictEqual([s.cleared, s.wave, s.phase, s.kills], [1, 2, 'bygge', 1]);
});

test('fjender, der slipper igennem, koster liv (kæmpen 3)', function () {
  var g = nyt(), s = g.state; g.startWave(); s.queue = [];
  s.enemies = [{ id: 1, type: 'kugle', hp: 5, maxHp: 5, p: 5, slow: 0 }, { id: 2, type: 'kaempe', hp: 5, maxHp: 5, p: 5.5, slow: 0 }];
  var ev = g.step();
  assert.strictEqual(ev.leaked.length, 2);
  assert.strictEqual(s.lives, L.RULES.lives - 4);
});

test('bølgerne bliver sværere', function () {
  var a = L.waveSpec(1, 1), b = L.waveSpec(10, 1), c = L.waveSpec(30, 1);
  assert.ok(b.types.length > a.types.length && c.types.length >= b.types.length);
  assert.ok(b.hpMul > a.hpMul && c.hpMul > b.hpMul);
  assert.deepStrictEqual(L.countTypes(a.types), { kugle: 4 });
  assert.ok(!L.waveSpec(4, 1).types.includes('kaempe'));
  assert.strictEqual(L.countTypes(L.waveSpec(5, 1).types).kaempe, 1);
  assert.strictEqual(L.countTypes(L.waveSpec(10, 1).types).kaempe, 2);
  assert.ok(L.waveSpec(3, 1).types.includes('pil'));
  assert.ok(L.waveSpec(4, 1).types.includes('kasse'));
  assert.deepStrictEqual(L.waveSpec(7, 99), L.waveSpec(7, 99), 'samme frø = samme bølge');
});

test('game over: uden tårne er livene brugt i første bølger', function () {
  var g = L.createGame({ map: L.MAPS[0], seed: 3 }), s = g.state, k = 0;
  while (s.phase !== 'slut' && k++ < 50) { g.startWave(); g.runWave(); }
  assert.strictEqual(s.phase, 'slut'); assert.strictEqual(s.lives, 0);
  assert.ok(s.last.gameOver);
  assert.strictEqual(g.startWave().ok, false);
  assert.strictEqual(g.build(0, 'laser').ok, false);
  var out = g.end(); assert.deepStrictEqual(Object.keys(out).sort(), ['cleared', 'score', 'wave']);
});

test('uendeligt: selv et godt forsvar taber til sidst (alle baner)', function () {
  L.allMaps().forEach(function (m) {
    var g = L.createGame({ map: m, seed: 11 }), s = g.state, k = 0;
    var near = [];
    for (var i = 0; i < m.w * m.h; i++) {
      if (g.isPath(i)) continue;
      var x = i % m.w, y = Math.floor(i / m.w);
      var d = m.path.filter(function (p) { return Math.abs(p[0] - x) <= 1 && Math.abs(p[1] - y) <= 1; }).length;
      near.push([d, i]);
    }
    near.sort(function (a, b) { return b[0] - a[0]; });
    var plan = ['laser', 'frost', 'puls', 'kanon'];
    while (s.phase !== 'slut' && k++ < 200) {
      // grådig: byg nye tårne, ellers opgrader
      var built = true;
      while (built) {
        built = false;
        for (var j = 0; j < near.length; j++) {
          var c = near[j][1], t = plan[j % plan.length];
          if (!s.towers[c] && s.money >= L.TOWERS[t].cost) { g.build(c, t); built = true; break; }
          if (s.towers[c] && s.towers[c].level < L.MAX_LEVEL && s.money >= L.upgradeCost(s.towers[c].type, s.towers[c].level)) { g.upgrade(c); built = true; break; }
        }
      }
      g.startWave(); g.runWave();
    }
    assert.strictEqual(s.phase, 'slut', 'bane ' + m.id + ' slutter');
    assert.ok(s.cleared >= 8 && s.cleared < 60, 'bane ' + m.id + ' klarede ' + s.cleared + ' bølger');
  });
});

console.log('\nAlle ' + n + ' test bestået.');
