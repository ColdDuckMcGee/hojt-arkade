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

// Alle baners størrelser
function alleMaps() { return [].concat.apply([], L.BANER.map(function (b) { return L.allMaps(b.id); })); }

test('mindst 3 navngivne baner, hver i de samme størrelser', function () {
  assert.ok(L.BANER.length >= 3);
  var navne = {};
  L.BANER.forEach(function (b) {
    assert.ok(b.navn && b.tekst && !navne[b.navn], b.id); navne[b.navn] = 1;
    assert.deepStrictEqual(L.allMaps(b.id).map(function (m) { return m.id; }).sort(), ['4x6', '5x8', '6x4', '8x5'], b.id);
    L.allMaps(b.id).forEach(function (m) { assert.strictEqual(m.bane, b.id); assert.strictEqual(m.navn, b.navn); });
  });
  // Forskellig stiform: ingen to baner har samme sti i samme størrelse
  ['8x5', '6x4', '4x6', '5x8'].forEach(function (size) {
    var seen = {};
    L.BANER.forEach(function (b) {
      var key = JSON.stringify(L.mapById(size, b.id).path);
      assert.ok(!seen[key], 'samme sti ' + size + ' ' + b.id); seen[key] = 1;
    });
  });
  assert.strictEqual(L.baneById('findes-ikke').id, L.BANER[0].id, 'ukendt bane giver den første');
});

test('alle baner er gyldige, stierne rører ikke sig selv, og ind/ud vender ud over kanten', function () {
  L.BANER.forEach(function (b) {
    var maps = L.allMaps(b.id), ids = {};
    maps.forEach(function (m) {
      assert.ok(!ids[m.id], 'dublet ' + m.id); ids[m.id] = 1;
      // To stifelter, der ikke følger efter hinanden, må ikke være naboer (så stien ikke flyder sammen)
      for (var i = 0; i < m.path.length; i++) for (var j = i + 2; j < m.path.length; j++)
        assert.notStrictEqual(Math.abs(m.path[i][0] - m.path[j][0]) + Math.abs(m.path[i][1] - m.path[j][1]), 1, b.id + ' ' + m.id + ' rører ' + i + '/' + j);
      [[m.path[0], L.entryDir(m)], [m.path[m.path.length - 1], L.exitDir(m)]].forEach(function (o) {
        var x = o[0][0] + o[1][0], y = o[0][1] + o[1][1];
        assert.ok(x < 0 || y < 0 || x >= m.w || y >= m.h, b.id + ' ' + m.id + ' kant');
      });
    });
  });
});

test('alle baner er gyldige og forskellige', function () {
  var maps = alleMaps(), ids = {};
  assert.ok(maps.length >= 12);
  maps.forEach(function (m) {
    assert.ok(L.validMap(m), m.id);
    var key = m.bane + m.id; assert.ok(!ids[key], 'dublet ' + key); ids[key] = 1;
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

test('pause midt i bølgen: byg, opgradér og sælg; fuld pris kun i samme pause', function () {
  var g = nyt(), s = g.state, a = idx(g, 1, 0), b = idx(g, 3, 0), c = idx(g, 4, 2);
  g.build(a, 'laser');
  assert.strictEqual(g.pauseWave().ok, false, 'ingen bølge at holde pause i');
  assert.ok(g.startWave().ok);
  // Bølgen kører: ingen byggeri
  assert.strictEqual(g.build(b, 'laser').why, 'boelge');
  assert.strictEqual(g.upgrade(a).why, 'boelge');
  assert.strictEqual(g.sell(a).why, 'boelge');
  g.step(); g.step();
  var tick = s.tick, pos = s.enemies.map(function (e) { return e.p; });
  assert.ok(g.pauseWave().ok); assert.ok(s.wavePaused); assert.strictEqual(g.pauseWave().ok, false);
  // I pausen står bølgen helt stille
  assert.strictEqual(g.step(), null); assert.deepStrictEqual(g.runWave(), []);
  assert.strictEqual(s.tick, tick); assert.deepStrictEqual(s.enemies.map(function (e) { return e.p; }), pos);
  assert.strictEqual(g.startWave().ok, false);
  // Byg, opgradér og sælg midt i bølgen
  s.money = 100; var m0 = s.money;
  assert.ok(g.build(b, 'laser').ok); assert.ok(g.upgrade(b).ok);
  assert.strictEqual(g.sellValue(b), 18, 'bygget i denne pause: alt tilbage');
  assert.ok(g.build(c, 'frost').ok);
  assert.strictEqual(g.sellValue(a), Math.floor(10 * L.RULES.sellRate), 'bygget før bølgen: 70 %');
  assert.ok(g.upgrade(a).ok);
  assert.strictEqual(g.sellValue(a), 8 + Math.floor(10 * L.RULES.sellRate), 'opgradering i pausen: fuld pris for den del');
  assert.strictEqual(g.sell(b).value, 18); assert.strictEqual(s.money, m0 - 14 - 8, 'laser bygget og solgt i pausen koster intet');
  // Fortsæt: bølgen genoptages, og pausens køb giver nu kun 70 %
  assert.ok(g.resumeWave().ok); assert.ok(!s.wavePaused); assert.strictEqual(g.resumeWave().ok, false);
  assert.strictEqual(g.sellValue(c), Math.floor(14 * L.RULES.sellRate));
  assert.strictEqual(g.build(b, 'laser').why, 'boelge');
  assert.ok(g.step()); assert.strictEqual(s.tick, tick + 1);
  // Det nye frosttårn er med i bølgen
  g.runWave();
  assert.strictEqual(s.phase, 'bygge'); assert.ok(s.towers[c]);
});

test('uendeligt: selv et godt forsvar taber til sidst (alle baner)', function () {
  alleMaps().forEach(function (m) {
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
    assert.strictEqual(s.phase, 'slut', 'bane ' + m.bane + ' ' + m.id + ' slutter');
    console.log('    ' + m.bane + ' ' + m.id + ': ' + s.cleared + ' bølger');
    assert.ok(s.cleared >= 8 && s.cleared < 60, 'bane ' + m.bane + ' ' + m.id + ' klarede ' + s.cleared + ' bølger');
  });
});

console.log('\nAlle ' + n + ' test bestået.');
