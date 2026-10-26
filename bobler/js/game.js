/*
 * Bobler – spillogik (ingen DOM). Turbaseret bobleskydespil i stil med
 * Puzzle Bobble: sigt, skyd én boble, og saml tre eller flere i samme farve,
 * så de forsvinder. Bobler, der ikke længere hænger fast i loftet, falder.
 * Der er ingen ure eller tidsgrænser: loftet rykker kun ned efter et antal
 * skud, der ikke fjerner noget.
 *
 * Koordinater er i "boblebredder": brættet er COLS bobler bredt.
 * Gitteret er sekskantet: lige rækker har 8 bobler, ulige rækker har 7 og
 * er rykket en halv boble til højre. Række r ligger i den synlige række
 * r + ceiling (loftet skubber hele gitteret ned).
 *
 * Et skud:
 *   1. Boblen flyver i en lige linje og springer tilbage fra væggene.
 *   2. Den lander i det frie hul ved siden af den boble, den rammer (eller i
 *      øverste række, hvis den rammer loftet).
 *   3. Er der nu 3 eller flere i samme farve i en sammenhængende klynge,
 *      forsvinder de (flood fill). Bobler, der ikke længere hænger fast i
 *      loftet, falder.
 *   4. Fjernede skuddet intet, tæller loft-tælleren op. For hvert 5. af
 *      den slags skud rykker loftet en række ned.
 *   5. Er brættet tomt, er banen klaret. Når en boble når bundlinjen, er
 *      spillet slut.
 */
(function (global) {
  'use strict';

  var COLS = 8;                         // bobler i en lige række
  var ROW_H = Math.sqrt(3) / 2;         // lodret afstand mellem rækker
  var DEAD_ROW = 11;                    // en boble i synlig række 11 (den 12.) = game over
  var ROWS = DEAD_ROW + 1;              // rækker i gitteret
  var W = COLS;                         // brættets bredde
  var SHOOT_Y = DEAD_ROW * ROW_H + 0.5 + 1.2;  // kanonens midte
  var H = SHOOT_Y + 0.8;                // brættets højde
  var MAX_ANGLE = 78;                   // grader fra lodret
  var COLLIDE = 0.8;                    // to bobler rører hinanden under denne afstand (lidt tilgivende)
  var STEP = 0.01;

  // Farver: hver har også sin egen form, så de kan skelnes uden farvesyn.
  var COLORS = [
    { id: 'rod',    name: 'rød',    shape: 'prik' },
    { id: 'gul',    name: 'gul',    shape: 'trekant' },
    { id: 'gron',   name: 'grøn',   shape: 'firkant' },
    { id: 'bla',    name: 'blå',    shape: 'plus' },
    { id: 'lilla',  name: 'lilla',  shape: 'ruder' },
    { id: 'orange', name: 'orange', shape: 'stjerne' },
    { id: 'cyan',   name: 'cyan',   shape: 'ring' }
  ];
  var SHAPE_NAMES = { prik: 'prik', trekant: 'trekant', firkant: 'firkant', plus: 'plus', ruder: 'ruder', stjerne: 'stjerne', ring: 'ring' };

  // Sværhedsgrader: antal farver på første bane. Hver ny bane får én farve mere (op til 7).
  var DIFFS = {
    '4': { id: '4', colors: 4, name: 'Rolig',  label: '4 farver' },
    '5': { id: '5', colors: 5, name: 'Normal', label: '5 farver' },
    '6': { id: '6', colors: 6, name: 'Svær',   label: '6 farver' }
  };
  var RULES = {
    match: 3,             // mindst 3 ens forsvinder
    ceilingEvery: 5,      // loftet rykker efter 5 skud, der ikke fjerner noget
    pointsPop: 10,        // pr. sprængt boble
    pointsFall: 20,       // pr. faldet boble
    bigFall: 6,           // falder 6 eller flere på én gang, tæller de dobbelt
    levelBonus: 250,      // ryddet bane: 250 × banens nummer
    startRows: 5,         // fyldte rækker på bane 1
    maxRows: 8,
    maxColors: COLORS.length,
    undoPerLevel: 1
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rowLen(r) { return r % 2 === 0 ? COLS : COLS - 1; }
  function inGrid(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < rowLen(r); }
  function cellX(r, c) { return c + (r % 2 ? 1 : 0.5); }
  function cellY(r, ceiling) { return (r + (ceiling || 0)) * ROW_H + 0.5; }
  function neighbors(r, c) {
    var out = [[r, c - 1], [r, c + 1]];
    var d = r % 2 === 0 ? [c - 1, c] : [c, c + 1];   // naboer i rækken over og under
    [r - 1, r + 1].forEach(function (rr) { d.forEach(function (cc) { out.push([rr, cc]); }); });
    return out.filter(function (p) { return inGrid(p[0], p[1]); });
  }
  function colorsFor(diffId, level) { return Math.min(RULES.maxColors, DIFFS[diffId].colors + (level - 1)); }
  function rowsFor(level) { return Math.min(RULES.maxRows, RULES.startRows + (level - 1)); }
  function levelBonus(level) { return RULES.levelBonus * level; }
  function clampAngle(a) { return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a)); }
  function emptyGrid() {
    var g = [];
    for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < rowLen(r); c++) row.push(-1); g.push(row); }
    return g;
  }

  // ---------- Skudbanen (ren funktion, bruges både til sigtelinjen og skuddet) ----------
  // grid: rækker med farve (-1 = tom). angle: grader fra lodret (negativ = venstre).
  // Svar: { path: [{x,y}...], bounces, cell: {r,c}, hit: 'boble'|'loft' }
  function trace(grid, ceiling, angle) {
    var a = clampAngle(angle) * Math.PI / 180;
    var dx = Math.sin(a), dy = -Math.cos(a);
    var x = W / 2, y = SHOOT_Y;
    var path = [{ x: x, y: y }], bounces = 0;
    var top = cellY(0, ceiling);
    var hitCell = null, hitKind = null;
    var occupied = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < rowLen(r); c++) if (grid[r][c] >= 0) occupied.push({ r: r, c: c, x: cellX(r, c), y: cellY(r, ceiling) });
    for (var i = 0; i < 200000; i++) {
      x += dx * STEP; y += dy * STEP;
      if (x < 0.5 || x > W - 0.5) {
        var wall = x < 0.5 ? 0.5 : W - 0.5, over = Math.abs(x - wall), t = over / Math.abs(dx);
        path.push({ x: wall, y: y - dy * t });
        x = wall + (x < 0.5 ? over : -over); dx = -dx; bounces++;
      }
      if (y <= top) {
        // ret op til præcis loftets højde
        var back = (top - y) / -dy; x -= dx * back; y = top;
        hitKind = 'loft'; break;
      }
      var best = null, bestD = COLLIDE * COLLIDE;
      for (var k = 0; k < occupied.length; k++) {
        var o = occupied[k], d2 = (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y);
        if (d2 < bestD) { bestD = d2; best = o; }
      }
      if (best) { hitCell = best; hitKind = 'boble'; break; }
    }
    path.push({ x: x, y: y });
    var cell = snap(grid, ceiling, x, y, hitCell, hitKind);
    return { path: path, bounces: bounces, cell: cell, hit: hitKind, end: { x: x, y: y } };
  }
  // Det frie hul, boblen lander i: nærmeste tomme nabo til den ramte boble
  // (eller nærmeste felt i øverste række, når den rammer loftet).
  function snap(grid, ceiling, x, y, hitCell, hitKind) {
    var cand = [];
    if (hitKind === 'boble') cand = neighbors(hitCell.r, hitCell.c);
    else for (var c = 0; c < rowLen(0); c++) cand.push([0, c]);
    var best = null, bestD = Infinity;
    function consider(p) {
      if (grid[p[0]][p[1]] >= 0) return;
      var d = Math.pow(cellX(p[0], p[1]) - x, 2) + Math.pow(cellY(p[0], ceiling) - y, 2);
      if (d < bestD) { bestD = d; best = { r: p[0], c: p[1] }; }
    }
    cand.forEach(consider);
    if (!best) { // nødløsning: nærmeste tomme felt, der hænger fast
      for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < rowLen(r); cc++) {
        if (r === 0 || neighbors(r, cc).some(function (n) { return grid[n[0]][n[1]] >= 0; })) consider([r, cc]);
      }
    }
    return best;
  }
  // Klyngen af samme farve, som (r, c) hører til (flood fill).
  function cluster(grid, r, c) {
    var col = grid[r][c], seen = {}, out = [], stack = [[r, c]];
    if (col < 0) return out;
    while (stack.length) {
      var p = stack.pop(), key = p[0] + ',' + p[1];
      if (seen[key] || grid[p[0]][p[1]] !== col) continue;
      seen[key] = true; out.push({ r: p[0], c: p[1] });
      neighbors(p[0], p[1]).forEach(function (n) { if (!seen[n[0] + ',' + n[1]]) stack.push(n); });
    }
    return out;
  }
  // Bobler, der ikke hænger fast i loftet (via andre bobler).
  function floating(grid) {
    var seen = {}, stack = [];
    for (var c = 0; c < rowLen(0); c++) if (grid[0][c] >= 0) stack.push([0, c]);
    while (stack.length) {
      var p = stack.pop(), key = p[0] + ',' + p[1];
      if (seen[key]) continue;
      seen[key] = true;
      neighbors(p[0], p[1]).forEach(function (n) { if (grid[n[0]][n[1]] >= 0 && !seen[n[0] + ',' + n[1]]) stack.push(n); });
    }
    var out = [];
    for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < rowLen(r); cc++) if (grid[r][cc] >= 0 && !seen[r + ',' + cc]) out.push({ r: r, c: cc });
    return out;
  }
  function count(grid) { var n = 0; grid.forEach(function (row) { row.forEach(function (v) { if (v >= 0) n++; }); }); return n; }
  function lowestRow(grid) { for (var r = ROWS - 1; r >= 0; r--) if (grid[r].some(function (v) { return v >= 0; })) return r; return -1; }
  function presentColors(grid) {
    var seen = {};
    grid.forEach(function (row) { row.forEach(function (v) { if (v >= 0) seen[v] = true; }); });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  function createRun(diffId, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    if (!DIFFS[diffId]) diffId = '5';
    var s = {
      diff: diffId, level: 0, colors: 0, grid: emptyGrid(), ceiling: 0, misses: 0,
      current: 0, next: 0, score: 0, shots: 0, levelsCleared: 0,
      undoLeft: RULES.undoPerLevel, over: false, cleared: false
    };
    var snapState = null;

    function pickColor() {
      var pres = presentColors(s.grid);
      if (!pres.length) { pres = []; for (var i = 0; i < s.colors; i++) pres.push(i); }
      return pres[Math.floor(rng() * pres.length)];
    }
    function buildLevel(level) {
      s.level = level; s.colors = colorsFor(diffId, level);
      s.grid = emptyGrid(); s.ceiling = 0; s.misses = 0;
      s.undoLeft = RULES.undoPerLevel; snapState = null;
      s.over = false; s.cleared = false;
      var rows = rowsFor(level);
      // Tilfældige farver, men med klynger: ofte samme farve som naboen til venstre eller over.
      for (var r = 0; r < rows; r++) for (var c = 0; c < rowLen(r); c++) {
        var col = Math.floor(rng() * s.colors);
        if (rng() < 0.45) {
          var ns = neighbors(r, c).filter(function (n) { return n[0] < r || (n[0] === r && n[1] < c); });
          if (ns.length) { var n = ns[Math.floor(rng() * ns.length)]; col = s.grid[n[0]][n[1]]; }
        }
        s.grid[r][c] = col;
      }
      // Alle banens farver skal være med mindst én gang
      // (en manglende farve erstatter en boble, hvis farve findes mindst to gange)
      for (var k = 0; k < s.colors; k++) {
        for (var guard = 0; guard < 200 && presentColors(s.grid).indexOf(k) < 0; guard++) {
          var rr = Math.floor(rng() * rows), cc = Math.floor(rng() * rowLen(rr)), old = s.grid[rr][cc];
          var n = 0; s.grid.forEach(function (row) { row.forEach(function (v) { if (v === old) n++; }); });
          if (n >= 2) s.grid[rr][cc] = k;
        }
      }
      s.current = pickColor(); s.next = pickColor();
    }
    function playable() { return !s.over && !s.cleared; }

    // Skyd med vinklen `angle` (grader fra lodret).
    function shoot(angle) {
      var ev = { ignored: false, events: [], popped: [], fallen: [], points: 0 };
      if (!playable()) { ev.ignored = true; return ev; }
      var before = clone(s);
      var tr = trace(s.grid, s.ceiling, angle);
      if (!tr.cell) { ev.ignored = true; return ev; }
      ev.trace = tr; ev.cell = tr.cell; ev.color = s.current; ev.bounces = tr.bounces;
      s.grid[tr.cell.r][tr.cell.c] = s.current;
      s.shots++;
      ev.events.push('shot');
      if (tr.bounces) ev.events.push('bounce');
      ev.events.push('land');
      var cl = cluster(s.grid, tr.cell.r, tr.cell.c);
      if (cl.length >= RULES.match) {
        cl.forEach(function (p) { ev.popped.push({ r: p.r, c: p.c, color: s.grid[p.r][p.c] }); s.grid[p.r][p.c] = -1; });
        ev.events.push('pop');
        floating(s.grid).forEach(function (p) { ev.fallen.push({ r: p.r, c: p.c, color: s.grid[p.r][p.c] }); s.grid[p.r][p.c] = -1; });
        if (ev.fallen.length) ev.events.push('fall');
        var pts = ev.popped.length * RULES.pointsPop;
        var fallPts = ev.fallen.length * RULES.pointsFall;
        if (ev.fallen.length >= RULES.bigFall) fallPts *= 2;
        ev.points = pts + fallPts; ev.fallPoints = fallPts;
        s.score += ev.points;
      } else {
        s.misses++;
        if (s.misses >= RULES.ceilingEvery) {
          s.misses = 0; s.ceiling++;
          ev.events.push('ceiling');
        }
      }
      snapState = before;
      if (count(s.grid) === 0) {
        var bonus = levelBonus(s.level);
        s.score += bonus; s.cleared = true; s.levelsCleared++;
        snapState = null;     // en klaret bane kan ikke fortrydes
        ev.events.push('cleared'); ev.bonus = bonus;
        return ev;
      }
      if (lowestRow(s.grid) + s.ceiling >= DEAD_ROW) {
        s.over = true; ev.events.push('over');
        return ev;
      }
      // Næste boble: kun farver, der stadig er på brættet
      var pres = presentColors(s.grid);
      s.current = s.next;
      if (pres.indexOf(s.current) < 0) s.current = pickColor();
      s.next = pickColor();
      return ev;
    }
    function swap() {
      if (!playable()) return false;
      var t = s.current; s.current = s.next; s.next = t;
      return true;
    }
    function canUndo() { return !!snapState && s.undoLeft > 0 && !s.cleared; }
    function undo() {
      if (!canUndo()) return false;
      var left = s.undoLeft - 1;
      s = snapState; snapState = null;
      s.undoLeft = left;
      api.state = s;
      return true;
    }
    function nextLevel() { buildLevel(s.level + 1); return s; }
    function shotsToCeiling() { return RULES.ceilingEvery - s.misses; }

    buildLevel(opts.level || 1);

    var api = {
      state: s, shoot: shoot, swap: swap, undo: undo, canUndo: canUndo, nextLevel: nextLevel,
      playable: playable, shotsToCeiling: shotsToCeiling,
      aim: function (angle) { return trace(s.grid, s.ceiling, angle); },
      _setState: function (ns) { s = ns; api.state = s; snapState = null; }
    };
    return api;
  }

  global.BoblerGame = {
    COLS: COLS, ROWS: ROWS, ROW_H: ROW_H, DEAD_ROW: DEAD_ROW, W: W, H: H, SHOOT_Y: SHOOT_Y, MAX_ANGLE: MAX_ANGLE,
    COLORS: COLORS, SHAPE_NAMES: SHAPE_NAMES, DIFFS: DIFFS, RULES: RULES,
    rowLen: rowLen, cellX: cellX, cellY: cellY, neighbors: neighbors, emptyGrid: emptyGrid,
    trace: trace, cluster: cluster, floating: floating, count: count, presentColors: presentColors,
    colorsFor: colorsFor, rowsFor: rowsFor, levelBonus: levelBonus, clampAngle: clampAngle, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
