/*
 * Rørlægger – test af spillogikken uden browser og uden afhængigheder.
 * Kør fra repoets rod:  node rorlaegger/test/spillogik.test.js
 */
'use strict';
var assert = require('assert');
require('../js/logik.js');
var L = globalThis.RorlaeggerLogik;
var N = L.N, E = L.E, S = L.S, W = L.W;

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// Læg banens egen løsning: drej hver brik på stien, til den har de nødvendige åbninger
function solve(board) {
  var used = 0;
  board.path.forEach(function (i) {
    var t = board.tiles[i]; if (t.fixed) return;
    var k = L.turnsNeeded(t, board.need[i]);
    t.rot = (t.rot + k) % 4; used += k;
  });
  return used;
}
// Uafhængig kontrol af flow: dybde-først med egen nabokode
function reachesDFS(b) {
  var n = b.n, seen = {}, st = [b.source];
  var d = [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]];
  seen[b.source] = 1;
  while (st.length) {
    var c = st.pop(), o = L.openings(b.tiles[c]), x = c % n, y = (c - x) / n;
    d.forEach(function (q) {
      if (!(o & q[0])) return;
      var nx = x + q[1], ny = y + q[2];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) return;
      var j = ny * n + nx;
      if (seen[j] || !(L.openings(b.tiles[j]) & q[3])) return;
      seen[j] = 1; st.push(j);
    });
  }
  return !!seen[b.drain];
}

// ---------- Rotation ----------
test('drejning med uret: N → Ø → S → V → N', function () {
  assert.strictEqual(L.rotate(N, 1), E);
  assert.strictEqual(L.rotate(N, 2), S);
  assert.strictEqual(L.rotate(N, 3), W);
  assert.strictEqual(L.rotate(N, 4), N);
  assert.strictEqual(L.rotate(N | E, 1), E | S);
  assert.strictEqual(L.rotate(W | N, 1), N | E);
  assert.strictEqual(L.rotate(N | S, 1), E | W);
  assert.strictEqual(L.rotate(15, 3), 15);
  assert.strictEqual(L.rotate(N | E | S, -1), W | N | E);
});
test('grundformer og typeFor', function () {
  assert.deepStrictEqual(L.typeFor(N | S), { type: 'lige', rot: 0 });
  assert.deepStrictEqual(L.typeFor(E | W), { type: 'lige', rot: 1 });
  assert.deepStrictEqual(L.typeFor(S | W), { type: 'knaek', rot: 2 });
  assert.deepStrictEqual(L.typeFor(W | N | E), { type: 't', rot: 3 });
  assert.deepStrictEqual(L.typeFor(15), { type: 'kryds', rot: 0 });
  assert.strictEqual(L.typeFor(N), null);
});
test('turnsNeeded tager højde for symmetri', function () {
  assert.strictEqual(L.turnsNeeded({ type: 'lige', rot: 0 }, N | S), 0);
  assert.strictEqual(L.turnsNeeded({ type: 'lige', rot: 1 }, N | S), 1);
  assert.strictEqual(L.turnsNeeded({ type: 'lige', rot: 3 }, N | S), 1);
  assert.strictEqual(L.turnsNeeded({ type: 'knaek', rot: 1 }, N | E), 3);
  assert.strictEqual(L.turnsNeeded({ type: 'kryds', rot: 2 }, N | E), 0);
  assert.strictEqual(L.turnsNeeded({ type: 't', rot: 0 }, E | W), 1);  // T med N+Ø+S drejet: Ø+S+V
  assert.strictEqual(L.turnsNeeded({ type: 'knaek', rot: 0 }, N | S), -1);
});

// ---------- Flow ----------
function hand(rows) {
  // rows: liste af [type, rot] pr. felt; kilde 'K', afløb 'A'
  var n = Math.sqrt(rows.length), tiles = [], src = -1, dr = -1;
  rows.forEach(function (r, i) {
    if (r[0] === 'K') { src = i; tiles.push({ type: 'kilde', rot: r[1], fixed: true }); }
    else if (r[0] === 'A') { dr = i; tiles.push({ type: 'afloeb', rot: r[1], fixed: true }); }
    else tiles.push({ type: r[0], rot: r[1], fixed: false });
  });
  return { n: n, tiles: tiles, source: src, drain: dr, path: [], need: tiles.map(function () { return 0; }) };
}
test('flow: lige rør fra kilde til afløb', function () {
  // 2 × 2: kilde (0) mod øst, knæk (1) Ø? -> vest+syd, afløb (3) mod nord
  var b = hand([['K', 1], ['knaek', 2], ['lige', 0], ['A', 0]]);
  var f = L.flow(b);
  assert.strictEqual(f.reached, true);
  assert.deepStrictEqual(f.dist, [0, 1, -1, 2]);
  assert.strictEqual(f.wet, 3);
  // Drej knækket: forbindelsen brydes
  b.tiles[1].rot = 3;
  f = L.flow(b);
  assert.strictEqual(f.reached, false);
  assert.deepStrictEqual(f.dist, [0, 1, -1, -1]);
});
test('flow kræver åbninger i begge felter', function () {
  // kilde mod øst, nabo er lige N-S: ingen forbindelse
  var b = hand([['K', 1], ['lige', 0], ['lige', 0], ['A', 0]]);
  assert.deepStrictEqual(L.flow(b).dist, [0, -1, -1, -1]);
});
test('flow løber ikke ud af gitteret', function () {
  var b = hand([['K', 0], ['lige', 0], ['lige', 0], ['A', 0]]);
  var f = L.flow(b);
  assert.strictEqual(f.wet, 1);
  assert.strictEqual(f.reached, false);
});

// ---------- Generator: altid løsbar ----------
test('genererede baner kan altid løses (600 baner, 4 × 4 til 6 × 6)', function () {
  var r = L.rng(7);
  [4, 5, 6].forEach(function (n) {
    for (var lv = 1; lv <= 200; lv++) {
      var b = L.generate(n, lv, r);
      assert.strictEqual(b.tiles.length, n * n);
      assert.strictEqual(L.flow(b).reached, false, 'løst fra start');
      assert.strictEqual(b.tiles[b.source].type, 'kilde');
      assert.strictEqual(b.tiles[b.drain].type, 'afloeb');
      assert.notStrictEqual(b.source, b.drain);
      assert.ok(b.path.length >= 4, 'for kort sti');
      // Alle felter har en brik med mindst to åbninger (undtagen kilde og afløb)
      b.tiles.forEach(function (t) { if (!t.fixed) assert.ok(L.TYPES.indexOf(t.type) >= 0); });
      var c = L.cloneBoard(b), used = solve(c);
      assert.strictEqual(used, b.solTurns);
      assert.strictEqual(L.flow(c).reached, true, 'løsningen virker ikke');
      assert.strictEqual(reachesDFS(c), true);
      assert.ok(b.solTurns >= 1);
    }
  });
});
test('stien bliver længere med banerne', function () {
  var r = L.rng(3), a = 0, z = 0;
  for (var i = 0; i < 40; i++) { a += L.generate(5, 1, r).path.length; z += L.generate(5, 15, r).path.length; }
  assert.ok(z > a, 'bane 15 (' + z / 40 + ') skal have længere sti end bane 1 (' + a / 40 + ')');
});
test('samme frø giver samme bane', function () {
  var a = L.generate(5, 3, 99), b = L.generate(5, 3, 99);
  assert.deepStrictEqual(a, b);
});

// ---------- Et spil ----------
test('størrelse efter bane og skærm', function () {
  assert.strictEqual(L.sizeForLevel(1, 6), 4);
  assert.strictEqual(L.sizeForLevel(4, 6), 5);
  assert.strictEqual(L.sizeForLevel(9, 6), 6);
  assert.strictEqual(L.sizeForLevel(20, 5), 5);
  assert.strictEqual(L.sizeForLevel(20, 4), 4);
});
// Drej banens sti på plads med rigtige drejninger (det sidste træk løser banen)
function solveRun(run) {
  var s = run.state, b = s.board, last = null;
  b.path.forEach(function (i) {
    var t = b.tiles[i]; if (t.fixed) return;
    var k = L.turnsNeeded(t, b.need[i]);
    for (var j = 0; j < k && !s.solved; j++) { last = run.rotate(i); assert.strictEqual(last.ok, true); }
  });
  return last;
}
// En brik uden for stien, som aldrig er en del af løsningen
function filler(s) { return s.board.tiles.findIndex(function (t, i) { return !t.fixed && !s.board.need[i]; }); }

test('drej, fortryd og drejninger', function () {
  var run = L.createRun({ seed: 5 }), s = run.state;
  assert.strictEqual(s.n, 4);
  assert.strictEqual(s.budget, s.board.solTurns + L.RULES.buffer(1, 4));
  assert.strictEqual(s.lives, undefined); // ingen liv
  var i = s.board.tiles.findIndex(function (t) { return !t.fixed; });
  var r0 = s.board.tiles[i].rot, left = s.turnsLeft;
  assert.strictEqual(run.rotate(i).ok, true);
  assert.strictEqual(s.board.tiles[i].rot, (r0 + 1) % 4);
  assert.strictEqual(s.turnsLeft, left - 1);
  assert.strictEqual(run.undo().ok, true);
  assert.strictEqual(s.board.tiles[i].rot, r0);
  assert.strictEqual(s.turnsLeft, left);
  assert.strictEqual(run.undo().ok, false);
  // Kilde og afløb kan ikke drejes
  assert.strictEqual(run.rotate(s.board.source).result, 'kilde');
  assert.strictEqual(run.rotate(s.board.drain).result, 'afloeb');
  assert.strictEqual(typeof run.openWater, 'undefined'); // ingen Luk vandet på
});
test('bufferen: 8 → mindst 4, plus én pr. række over 4', function () {
  assert.strictEqual(L.RULES.buffer(1, 4), 8);
  assert.strictEqual(L.RULES.buffer(3, 4), 8);
  assert.strictEqual(L.RULES.buffer(4, 5), 8);
  assert.strictEqual(L.RULES.buffer(9, 6), 8);
  assert.strictEqual(L.RULES.buffer(13, 4), 4);
  assert.strictEqual(L.RULES.buffer(40, 6), 6);
});
test('vandet løber af sig selv, når drejningen løser banen', function () {
  var run = L.createRun({ seed: 11 }), s = run.state;
  assert.strictEqual(s.flow.reached, false);
  var b = s.board, pre = 0;
  // Tæl drejningerne, der skal til, og læg dem: kun den sidste melder løst
  b.path.forEach(function (i) { if (!b.tiles[i].fixed) pre += L.turnsNeeded(b.tiles[i], b.need[i]); });
  var left0 = s.turnsLeft, solvedCount = 0;
  b.path.forEach(function (i) {
    var t = b.tiles[i]; if (t.fixed) return;
    var k = L.turnsNeeded(t, b.need[i]);
    for (var j = 0; j < k && !s.solved; j++) { var r = run.rotate(i); if (r.solved) solvedCount++; else assert.strictEqual(s.water, null); }
  });
  assert.strictEqual(solvedCount, 1);
  assert.strictEqual(s.solved, true);
  assert.ok(s.water && s.water.reached && s.water.dist[b.drain] >= 1);
  assert.ok(left0 - s.turnsLeft <= pre);
  var p = s.lastPoints;
  assert.strictEqual(p.pipes, s.water.wet * L.RULES.pointsPerPipe);
  assert.strictEqual(p.spare, s.turnsLeft * L.RULES.pointsPerSpare);
  assert.strictEqual(p.level, L.RULES.levelBonus);
  assert.strictEqual(s.score, p.total);
  assert.strictEqual(run.rotate(filler(s)).ok, false); // banen er klaret
  assert.strictEqual(run.undo().ok, false);
  assert.strictEqual(run.nextLevel(), true);
  assert.strictEqual(s.level, 2);
  assert.strictEqual(s.solved, false);
  assert.strictEqual(s.cleared, 1);
  assert.strictEqual(s.water, null);
});
test('løses banen med den sidste drejning, er den klaret (ikke game over)', function () {
  var run = L.createRun({ seed: 21 }), s = run.state;
  s.turnsLeft = s.board.solTurns; // præcis nok
  var r = solveRun(run);
  assert.strictEqual(r.solved, true);
  assert.strictEqual(s.over, false);
  assert.strictEqual(s.lastPoints.spare, s.turnsLeft * L.RULES.pointsPerSpare);
});
test('game over, når drejningerne er brugt, og banen ikke er løst', function () {
  var run = L.createRun({ seed: 2 }), s = run.state, f = filler(s);
  assert.ok(f >= 0);
  var last;
  while (s.turnsLeft > 0) { last = run.rotate(f); assert.strictEqual(last.ok, true); if (last.solved) break; }
  assert.strictEqual(last.solved, false);
  assert.strictEqual(last.over, true);
  assert.strictEqual(s.over, true);
  assert.strictEqual(s.turnsLeft, 0);
  assert.strictEqual(run.rotate(f).ok, false);
  assert.strictEqual(run.undo().ok, false); // fortryd kan ikke redde et tabt spil
  assert.strictEqual(run.nextLevel(), false);
  assert.deepStrictEqual(run.end(), { score: 0, cleared: 0, level: 1 });
});
test('fortryd giver drejningen tilbage, før de er brugt', function () {
  var run = L.createRun({ seed: 3 }), s = run.state, f = filler(s);
  while (s.turnsLeft > 1) run.rotate(f);
  assert.strictEqual(run.undo().ok, true);
  assert.strictEqual(s.turnsLeft, 2);
  assert.strictEqual(s.over, false);
});
test('mange baner i træk kan klares (60 baner)', function () {
  var run = L.createRun({ seed: 123, maxN: 6 }), s = run.state;
  for (var lv = 1; lv <= 60; lv++) {
    var r = solveRun(run);
    assert.strictEqual(r.solved, true, 'bane ' + lv);
    assert.ok(s.turnsLeft >= L.RULES.buffer(lv, s.n));
    assert.strictEqual(run.nextLevel(), true);
  }
  assert.strictEqual(s.n, 6);
  assert.strictEqual(s.cleared, 60);
});

var ok = 0;
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('OK   ' + t.name); }
  catch (e) { console.log('FEJL ' + t.name + '\n     ' + (e && e.stack || e)); }
});
console.log('\n' + ok + ' af ' + tests.length + ' test bestået');
process.exit(ok === tests.length ? 0 : 1);
