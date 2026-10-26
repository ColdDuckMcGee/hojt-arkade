/*
 * Minestryger – spillogik (ingen DOM). Turbaseret: intet sker, før spilleren
 * vælger et felt. Der er ingen ure eller tidsgrænser.
 *
 * Én plade ad gangen. Minerne lægges først, når det første felt åbnes, så det
 * første felt og dets naboer aldrig er miner (første valg åbner altid et
 * område). Generatoren prøver at lave plader, der kan løses uden at gætte.
 */
(function (global) {
  'use strict';

  // Brætstørrelser: kolonner × rækker, miner på første plade og loft.
  var SIZES = {
    '6x6':  { id: '6x6',  cols: 6,  rows: 6, startMines: 4,  maxMines: 8,  label: '6 × 6' },
    '8x8':  { id: '8x8',  cols: 8,  rows: 8, startMines: 8,  maxMines: 14, label: '8 × 8' },
    '10x8': { id: '10x8', cols: 10, rows: 8, startMines: 10, maxMines: 18, label: '10 × 8' }
  };
  var RULES = {
    pointsPerCell: 10,     // point for hvert sikkert felt, der åbnes
    bonusPerMine: 25,      // bonus for ryddet plade: 25 point pr. mine på pladen
    minesPerPlate: 1,      // én mine mere for hver ny plade …
    generatorTries: 400    // forsøg på at finde en plade uden gæt
  };

  // Antal miner på plade nr. `plate` (1, 2, 3 …), op til loftet (ca. 22 %).
  function minesFor(sizeId, plate) {
    var s = SIZES[sizeId];
    return Math.min(s.maxMines, s.startMines + (plate - 1) * RULES.minesPerPlate);
  }
  function plateBonus(mines) { return mines * RULES.bonusPerMine; }

  function neighborsOf(cols, rows) {
    var list = [];
    for (var i = 0; i < cols * rows; i++) {
      var x = i % cols, y = (i - x) / cols, n = [];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) n.push(ny * cols + nx);
      }
      list.push(n);
    }
    return list;
  }

  /*
   * Logisk løser: åbner fra startfeltet og bruger kun sikre slutninger
   * (enkeltfelt-regler, delmængde-regel mellem to tal og det samlede minetal).
   * Returnerer true, hvis hele pladen kan løses uden at gætte.
   */
  function solvable(mine, counts, nb, start, totalMines) {
    var N = mine.length, known = new Array(N).fill(0); // 0 ukendt, 1 åben, 2 mine
    var safeLeft = N - totalMines, flagged = 0;
    function open(i) {
      var stack = [i];
      while (stack.length) {
        var c = stack.pop();
        if (known[c] !== 0) continue;
        if (mine[c]) return false;
        known[c] = 1; safeLeft--;
        if (counts[c] === 0) nb[c].forEach(function (k) { if (known[k] === 0) stack.push(k); });
      }
      return true;
    }
    function flag(i) { if (known[i] === 0) { known[i] = 2; flagged++; } }
    open(start);
    var guard = 0;
    while (safeLeft > 0 && guard++ < 500) {
      var changed = false, cons = [];
      for (var i = 0; i < N; i++) {
        if (known[i] !== 1 || counts[i] === 0) continue;
        var unk = [], f = 0;
        nb[i].forEach(function (k) { if (known[k] === 0) unk.push(k); else if (known[k] === 2) f++; });
        if (!unk.length) continue;
        var need = counts[i] - f;
        if (need === 0) { unk.forEach(open); changed = true; }
        else if (need === unk.length) { unk.forEach(flag); changed = true; }
        else cons.push({ set: unk, need: need });
      }
      if (changed) continue;
      // Delmængde-regel: A ⊆ B giver viden om B \ A.
      for (var a = 0; a < cons.length && !changed; a++) {
        for (var b = 0; b < cons.length && !changed; b++) {
          if (a === b) continue;
          var A = cons[a], B = cons[b];
          if (A.set.length >= B.set.length) continue;
          if (!A.set.every(function (k) { return B.set.indexOf(k) >= 0; })) continue;
          var diff = B.set.filter(function (k) { return A.set.indexOf(k) < 0; });
          var dn = B.need - A.need;
          if (dn === 0) { diff.forEach(open); changed = true; }
          else if (dn === diff.length) { diff.forEach(flag); changed = true; }
        }
      }
      if (changed) continue;
      // Det samlede minetal.
      var unknownAll = [];
      for (var u = 0; u < N; u++) if (known[u] === 0) unknownAll.push(u);
      var rem = totalMines - flagged;
      if (rem === 0) { unknownAll.forEach(open); continue; }
      if (rem === unknownAll.length) { unknownAll.forEach(flag); continue; }
      return false;
    }
    return safeLeft === 0;
  }

  function createPlate(sizeId, plateNo, opts) {
    var rng = (opts && opts.rng) || Math.random;
    var size = SIZES[sizeId];
    var cols = size.cols, rows = size.rows, N = cols * rows;
    var mines = minesFor(sizeId, plateNo);
    var nb = neighborsOf(cols, rows);
    var cells = [];
    for (var i = 0; i < N; i++) cells.push({ mine: false, n: 0, open: false, flag: false, revealed: false });
    var s = {
      sizeId: sizeId, cols: cols, rows: rows, plate: plateNo, mines: mines, cells: cells,
      generated: false, guessFree: false, opened: 0, safeTotal: N - mines,
      cleared: false, hits: 0
    };

    function layout(first) {
      var banned = {}; banned[first] = true;
      nb[first].forEach(function (k) { banned[k] = true; });
      var pool = [];
      for (var i = 0; i < N; i++) if (!banned[i]) pool.push(i);
      if (pool.length < mines) { // nødløsning: kun selve feltet er fredet
        pool = []; for (var j = 0; j < N; j++) if (j !== first) pool.push(j);
      }
      for (var k = pool.length - 1; k > 0; k--) {
        var r = Math.floor(rng() * (k + 1)); var t = pool[k]; pool[k] = pool[r]; pool[r] = t;
      }
      var mine = new Array(N).fill(false);
      for (var m = 0; m < mines; m++) mine[pool[m]] = true;
      var counts = mine.map(function (_, c) { return nb[c].filter(function (q) { return mine[q]; }).length; });
      return { mine: mine, counts: counts };
    }
    function generate(first) {
      var best = null;
      for (var t = 0; t < RULES.generatorTries; t++) {
        var l = layout(first);
        if (!best) best = l;
        if (solvable(l.mine, l.counts, nb, first, mines)) { best = l; s.guessFree = true; break; }
      }
      cells.forEach(function (c, i) { c.mine = best.mine[i]; c.n = best.counts[i]; });
      s.generated = true;
    }

    function flags() { return cells.filter(function (c) { return c.flag; }).length; }
    function revealedMines() { return cells.filter(function (c) { return c.revealed; }).length; }
    function minesLeft() { return mines - flags() - revealedMines(); }

    // Åbn et felt. Returnerer { ignored, hit, opened: [indeks …], cleared }.
    function open(i) {
      var c = cells[i];
      if (!c || s.cleared || c.open || c.flag || c.revealed) return { ignored: true, opened: [] };
      if (!s.generated) generate(i);
      if (c.mine) {
        c.revealed = true; s.hits++;
        return { ignored: false, hit: true, index: i, opened: [] };
      }
      var opened = [], stack = [i];
      while (stack.length) {
        var k = stack.pop(), q = cells[k];
        if (q.open || q.mine || q.revealed) continue;
        if (q.flag) q.flag = false; // et forkert flag i en klynge fjernes
        q.open = true; opened.push(k); s.opened++;
        if (q.n === 0) nb[k].forEach(function (z) { if (!cells[z].open) stack.push(z); });
      }
      if (s.opened >= s.safeTotal) s.cleared = true;
      return { ignored: false, hit: false, opened: opened, cleared: s.cleared, points: opened.length * RULES.pointsPerCell };
    }
    function toggleFlag(i) {
      var c = cells[i];
      if (!c || s.cleared || c.open || c.revealed) return { ignored: true };
      c.flag = !c.flag;
      return { ignored: false, flag: c.flag };
    }

    return {
      state: s, open: open, toggleFlag: toggleFlag, minesLeft: minesLeft,
      neighbors: function (i) { return nb[i].slice(); }
    };
  }

  global.MinestrygerGame = {
    SIZES: SIZES, RULES: RULES, minesFor: minesFor, plateBonus: plateBonus,
    createPlate: createPlate, _solvable: solvable, _neighborsOf: neighborsOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
