/*
 * Kasser – spillets regler uden brugerflade (kan også køres i Node til test).
 *   var g = KasserGame.createLevel(0);   // bane 1 (0-baseret)
 *   g.move('up')  -> { moved, pushed, bump: 'wall' | 'box', from, to, box: {from, to}, solved }
 *   g.walkTo(x, y) -> liste af træk (korteste vej uden at skubbe; et nabofelt med kasse skubbes)
 *   g.undo(), g.restart(), g.stuckBoxes()
 * Fremskridt og runder: KasserGame.createProgress(storage).
 */
(function (global) {
  'use strict';

  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var ORDER = ['up', 'down', 'left', 'right'];
  function levels() { return global.KasserBaner || []; }

  // ---------- Bane ----------
  function parse(rows) {
    var h = rows.length, w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var cell = [], goal = [], boxes = [], player = null;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var c = rows[y][x] || '-', i = y * w + x;
      cell[i] = c === '#' ? 'wall' : c === '-' ? 'void' : 'floor';
      goal[i] = c === '.' || c === '*' || c === '+';
      if (c === '$' || c === '*') boxes.push(i);
      if (c === '@' || c === '+') player = i;
    }
    return { w: w, h: h, cell: cell, goal: goal, boxes: boxes, player: player };
  }

  // Point for en løst bane: op til 100 + 20 pr. bane efter den første, fuldt ved par-træk,
  // mindre jo flere træk ud over par (aldrig under en fjerdedel). Rundet til nærmeste 5.
  function maxPoints(n) { return 100 + 20 * n; }
  function points(n, moves, par) {
    var ratio = moves <= par ? 1 : Math.max(0.25, par / moves);
    return Math.max(5, Math.round(maxPoints(n) * ratio / 5) * 5);
  }

  function createLevel(n, defOverride) {
    var def = defOverride || levels()[n];
    if (!def) throw new Error('Ukendt bane ' + n);
    var L = parse(def.rows);
    var s = {
      level: n, par: def.par, w: L.w, h: L.h, cell: L.cell, goal: L.goal,
      boxes: L.boxes.slice(), player: L.player, dir: 'down', moves: 0, pushes: 0, solved: false
    };
    var history = [];

    function idx(x, y) { return y * s.w + x; }
    function xy(i) { return { x: i % s.w, y: Math.floor(i / s.w) }; }
    function inside(x, y) { return x >= 0 && y >= 0 && x < s.w && y < s.h; }
    function free(i) { return s.cell[i] === 'floor' && s.boxes.indexOf(i) < 0; }
    function wallAt(x, y) { return !inside(x, y) || s.cell[idx(x, y)] !== 'floor'; }
    function isSolved() { return s.boxes.every(function (b) { return s.goal[b]; }); }
    function snapshot() { return { boxes: s.boxes.slice(), player: s.player, dir: s.dir, moves: s.moves, pushes: s.pushes, solved: s.solved }; }
    function restore(o) { s.boxes = o.boxes.slice(); s.player = o.player; s.dir = o.dir; s.moves = o.moves; s.pushes = o.pushes; s.solved = o.solved; }

    // Hvad sker der, hvis man går i en retning? ('move', 'push', 'wall' eller 'box' = kassen kan ikke skubbes)
    function check(dir) {
      var d = DIRS[dir], p = xy(s.player), nx = p.x + d.x, ny = p.y + d.y;
      if (wallAt(nx, ny)) return { kind: 'wall', to: idx(nx, ny) };
      var n = idx(nx, ny), bi = s.boxes.indexOf(n);
      if (bi < 0) return { kind: 'move', to: n };
      var bx = nx + d.x, by = ny + d.y;
      if (wallAt(bx, by) || s.boxes.indexOf(idx(bx, by)) >= 0) return { kind: 'box', to: n, boxTo: idx(bx, by), behind: wallAt(bx, by) ? 'wall' : 'box' };
      return { kind: 'push', to: n, boxTo: idx(bx, by), bi: bi };
    }
    function step(dir) {
      var c = check(dir), from = s.player;
      s.dir = dir;
      if (c.kind === 'wall' || c.kind === 'box') return { moved: false, bump: c.kind, behind: c.behind, dir: dir, from: from, to: from };
      var res = { moved: true, dir: dir, from: from, to: c.to, pushed: false };
      if (c.kind === 'push') {
        s.boxes[c.bi] = c.boxTo; s.pushes++;
        res.pushed = true; res.box = { from: c.to, to: c.boxTo, onGoal: !!s.goal[c.boxTo], offGoal: !!s.goal[c.to] && !s.goal[c.boxTo] };
      }
      s.player = c.to; s.moves++;
      if (isSolved()) { s.solved = true; res.solved = true; }
      return res;
    }
    function move(dir) {
      if (s.solved || !DIRS[dir]) return { moved: false, ignored: true };
      var snap = snapshot(), res = step(dir);
      if (res.moved) history.push(snap); else s.dir = snap.dir;
      return res;
    }
    // Korteste vej (bredde-først) uden at skubbe. Returnerer en liste af retninger eller null.
    function pathTo(x, y) {
      if (!inside(x, y)) return null;
      var target = idx(x, y);
      if (target === s.player) return [];
      if (!free(target)) return null;
      var prev = {}, q = [s.player]; prev[s.player] = null;
      for (var qi = 0; qi < q.length; qi++) {
        var c = q[qi], p = xy(c);
        for (var k = 0; k < 4; k++) {
          var d = DIRS[ORDER[k]], nx = p.x + d.x, ny = p.y + d.y;
          if (!inside(nx, ny)) continue;
          var n = idx(nx, ny);
          if (n in prev || !free(n)) continue;
          prev[n] = { from: c, dir: ORDER[k] };
          if (n === target) {
            var path = [], cur = n;
            while (prev[cur]) { path.unshift(prev[cur].dir); cur = prev[cur].from; }
            return path;
          }
          q.push(n);
        }
      }
      return null;
    }
    // Tryk på et felt: et nabofelt med kasse skubbes; ellers gås korteste vej. Ét fortryd for det hele.
    function walkTo(x, y) {
      if (s.solved || !inside(x, y)) return { steps: [], ignored: true };
      var p = xy(s.player), dx = x - p.x, dy = y - p.y;
      if (Math.abs(dx) + Math.abs(dy) === 1 && s.boxes.indexOf(idx(x, y)) >= 0) {
        var dir = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
        var r = move(dir);
        return { steps: r.moved ? [r] : [], bump: r.bump ? r : null };
      }
      var path = pathTo(x, y);
      if (!path || path.length === 0) return { steps: [], unreachable: !path };
      var snap = snapshot(), steps = path.map(step);
      history.push(snap);
      return { steps: steps };
    }
    function undo() {
      if (!history.length) return false;
      restore(history.pop());
      return true;
    }
    function restart() {
      if (s.moves === 0 && !history.length) return false;
      history.push(snapshot());
      s.boxes = L.boxes.slice(); s.player = L.player; s.dir = 'down'; s.moves = 0; s.pushes = 0; s.solved = false;
      return true;
    }
    // Fastlåste kasser (ikke på mål): i et hjørne, eller i en 2 × 2-klump af mure og kasser.
    function stuckBoxes() {
      var out = [];
      s.boxes.forEach(function (b) {
        if (s.goal[b]) return;
        var p = xy(b);
        var corner = (wallAt(p.x - 1, p.y) || wallAt(p.x + 1, p.y)) && (wallAt(p.x, p.y - 1) || wallAt(p.x, p.y + 1));
        if (corner) { out.push(b); return; }
        var solid = function (x, y) { return wallAt(x, y) || s.boxes.indexOf(idx(x, y)) >= 0; };
        for (var oy = -1; oy <= 0; oy++) for (var ox = -1; ox <= 0; ox++) {
          if (solid(p.x + ox, p.y + oy) && solid(p.x + ox + 1, p.y + oy) && solid(p.x + ox, p.y + oy + 1) && solid(p.x + ox + 1, p.y + oy + 1)) {
            if (out.indexOf(b) < 0) out.push(b);
          }
        }
      });
      return out;
    }
    function boxesOnGoal() { return s.boxes.filter(function (b) { return s.goal[b]; }).length; }

    return {
      state: s, move: move, check: check, pathTo: pathTo, walkTo: walkTo, undo: undo, restart: restart,
      canUndo: function () { return history.length > 0; }, stuckBoxes: stuckBoxes, boxesOnGoal: boxesOnGoal,
      xy: xy, idx: idx, isSolved: isSolved, points: function () { return points(n, s.moves, s.par); }
    };
  }

  // ---------- Fremskridt og runder ----------
  // Gemmes i localStorage under hojtArkade.kasser.fremskridt:
  //   best:  { "1": { moves, points }, ... }   bedste resultat pr. bane (nøgle = banenummer)
  //   round: { "1": points, ... } | null       den igangværende runde: bedste point pr. bane
  //   last:  sidst spillede bane (0-baseret)
  var UNLOCK_AHEAD = 3;   // man kan altid vælge de næste tre baner efter de løste
  function createProgress(storage, key) {
    key = key || 'hojtArkade.kasser.fremskridt';
    var mem = null;
    function read() {
      var d = null;
      try { var raw = storage && storage.getItem(key); d = raw ? JSON.parse(raw) : null; } catch (e) { d = mem; }
      if (!d || typeof d !== 'object') d = {};
      if (!d.best || typeof d.best !== 'object') d.best = {};
      if (d.round && typeof d.round !== 'object') d.round = null;
      if (typeof d.last !== 'number') d.last = 0;
      return d;
    }
    function write(d) { mem = d; try { storage && storage.setItem(key, JSON.stringify(d)); } catch (e) { /* privat tilstand */ } }
    var data = read();
    function solvedCount() { return Object.keys(data.best).length; }
    function unlocked() { return Math.min(levels().length, solvedCount() + UNLOCK_AHEAD); }
    function isUnlocked(n) { return n < unlocked() || !!data.best[n + 1]; }
    function roundTotal() { var r = data.round || {}; return Object.keys(r).reduce(function (a, k) { return a + r[k]; }, 0); }
    function roundLevels() { return data.round ? Object.keys(data.round).length : 0; }
    // En løst bane: opdatér bedste resultat og rundens point. Returnerer, hvad der ændrede sig.
    function record(n, moves, pts) {
      var k = String(n + 1), prev = data.best[k], newBest = !prev || moves < prev.moves;
      var wasUnlocked = unlocked();
      if (newBest) data.best[k] = { moves: moves, points: pts };
      if (!data.round) data.round = {};
      var before = data.round[k] || 0, gained = Math.max(0, pts - before);
      if (pts > before) data.round[k] = pts;
      write(data);
      return { newBest: newBest, prevMoves: prev ? prev.moves : null, gained: gained, roundBefore: before,
               roundTotal: roundTotal(), newlyUnlocked: unlocked() - wasUnlocked };
    }
    function endRound() {
      var res = { total: roundTotal(), levels: roundLevels() };
      data.round = null; write(data);
      return res;
    }
    function nextLevel() {
      var N = levels().length;
      for (var i = 0; i < N; i++) if (!data.best[i + 1] && isUnlocked(i)) return i;
      return Math.min(N - 1, data.last);
    }
    return {
      get data() { return data; }, reload: function () { data = read(); },
      best: function (n) { return data.best[n + 1] || null; },
      roundPoints: function (n) { return data.round ? (data.round[n + 1] || 0) : 0; },
      solvedCount: solvedCount, unlocked: unlocked, isUnlocked: isUnlocked, record: record,
      roundActive: function () { return !!data.round && roundLevels() > 0; },
      roundTotal: roundTotal, roundLevels: roundLevels, endRound: endRound, nextLevel: nextLevel,
      setLast: function (n) { data.last = n; write(data); }, last: function () { return data.last; },
      reset: function () { data = { best: {}, round: null, last: 0 }; write(data); }
    };
  }

  global.KasserGame = {
    DIRS: DIRS, ORDER: ORDER, parse: parse, createLevel: createLevel, createProgress: createProgress,
    points: points, maxPoints: maxPoints, count: function () { return levels().length; }, UNLOCK_AHEAD: UNLOCK_AHEAD
  };
})(typeof window !== 'undefined' ? window : globalThis);
