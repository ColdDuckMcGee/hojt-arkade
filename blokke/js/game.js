/*
 * Blokke – spillogik (ingen DOM). Et roligt blokpuslespil: læg brikker på et
 * kvadratisk bræt, og fyld hele rækker og kolonner, så de forsvinder.
 *
 * Der er ingen tid og ingen liv. Man får tre brikker ad gangen (ingen rotation).
 * Når alle tre er lagt, kommer tre nye. Spillet slutter, når ingen af de
 * tilbageværende brikker kan være på brættet.
 *
 * Forankring: hver brik har et fast "ankerfelt" (feltet nærmest brikkens midte).
 * Man peger på et felt på brættet, og brikken lægges, så ankerfeltet ligger dér.
 * Ville brikken stikke ud over kanten, skubbes den ind, så den altid ligger på
 * brættet. Den kan kun være ugyldig, hvis den dækker felter, der er optaget.
 *
 * Point:
 *   1 point for hvert felt i den lagte brik.
 *   10 point pr. ryddet række/kolonne, og bonus for flere på én gang:
 *     k linjer giver 10·k² point (1 → 10, 2 → 40, 3 → 90, 4 → 160 …).
 *   Kombo: rydder man linjer med flere brikker i træk, giver hver ny rydning
 *     20 point ekstra gange (kombo − 1).
 *   Tomt bræt: 100 point i bonus, når hele brættet bliver tomt.
 *
 * Fortryd: man kan fortryde sidste træk et lille antal gange pr. spil (RULES.undos).
 */
(function (global) {
  'use strict';

  var SIZES = {
    '6x6':   { id: '6x6',   n: 6,  label: '6 × 6',   name: 'Lille' },
    '8x8':   { id: '8x8',   n: 8,  label: '8 × 8',   name: 'Mellem' },
    '10x10': { id: '10x10', n: 10, label: '10 × 10', name: 'Stor' }
  };
  var DEFAULT_SIZE = '8x8';

  var RULES = {
    trayCount: 3,
    undos: 3,          // fortryd sidste træk op til 3 gange pr. spil
    cellPoint: 1,
    linePoint: 10,     // k linjer på én gang: linePoint · k²
    comboPoint: 20,    // pr. kombotrin ud over det første
    emptyBonus: 100,
    fairTries: 40      // forsøg på at finde tre brikker, der alle kan lægges
  };

  // ---------- Brikker ----------
  // Familier med vægt i starten (w0) og senere (w1). Vægten deles ligeligt
  // mellem familiens retninger. Farve 1–7 (se css/blokke.css).
  function S() { return Array.prototype.slice.call(arguments).join('/'); }
  var FAMILIES = [
    { fam: 'prik',   color: 1, w0: 1.2, w1: 0.6, shapes: ['X'] },
    { fam: 'to',     color: 2, w0: 2.0, w1: 1.2, shapes: ['XX', S('X', 'X')] },
    { fam: 'tre',    color: 3, w0: 2.4, w1: 1.6, shapes: ['XXX', S('X', 'X', 'X')] },
    { fam: 'fire',   color: 4, w0: 1.6, w1: 1.8, shapes: ['XXXX', S('X', 'X', 'X', 'X')] },
    { fam: 'fem',    color: 5, w0: 0.7, w1: 1.6, shapes: ['XXXXX', S('X', 'X', 'X', 'X', 'X')] },
    { fam: 'hjorne', color: 6, w0: 2.4, w1: 1.4, shapes: [S('XX', 'X.'), S('XX', '.X'), S('X.', 'XX'), S('.X', 'XX')] },
    { fam: 'kvadrat',color: 7, w0: 2.0, w1: 1.6, shapes: [S('XX', 'XX')] },
    { fam: 'storkv', color: 2, w0: 0.5, w1: 1.3, shapes: [S('XXX', 'XXX', 'XXX')] },
    { fam: 'stortL', color: 4, w0: 0.7, w1: 1.5, shapes: [S('XXX', 'X..', 'X..'), S('XXX', '..X', '..X'), S('X..', 'X..', 'XXX'), S('..X', '..X', 'XXX')] },
    { fam: 'T',      color: 5, w0: 1.4, w1: 1.4, shapes: [S('XXX', '.X.'), S('.X.', 'XXX'), S('X.', 'XX', 'X.'), S('.X', 'XX', '.X')] },
    { fam: 'S',      color: 1, w0: 1.0, w1: 1.3, shapes: [S('XX.', '.XX'), S('.XX', 'XX.'), S('X.', 'XX', '.X'), S('.X', 'XX', 'X.')] },
    { fam: 'L',      color: 3, w0: 1.4, w1: 1.5, shapes: [S('X.', 'X.', 'XX'), S('.X', '.X', 'XX'), S('XX', 'X.', 'X.'), S('XX', '.X', '.X'),
                                                              S('XXX', 'X..'), S('XXX', '..X'), S('X..', 'XXX'), S('..X', 'XXX')] },
    { fam: 'rekt',   color: 6, w0: 0.6, w1: 1.2, shapes: [S('XX', 'XX', 'XX'), S('XXX', 'XXX')] }
  ];

  function parseShape(str) {
    var rows = str.split('/'), cells = [];
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === 'X') cells.push([x, y]); });
    var w = 0, h = rows.length;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    // Ankerfelt: det felt i brikken, der ligger nærmest midten (ved lige mål: øverst til venstre for midten)
    var cx = (w - 1) / 2, cy = (h - 1) / 2, best = null, bd = Infinity;
    cells.forEach(function (c) {
      var d = Math.pow(c[0] - cx, 2) + Math.pow(c[1] - cy, 2);
      if (d < bd - 1e-9) { bd = d; best = c; }
    });
    return { cells: cells, w: w, h: h, anchor: [best[0], best[1]] };
  }

  var PIECES = {};
  var PIECE_LIST = [];
  FAMILIES.forEach(function (f) {
    f.shapes.forEach(function (sh, i) {
      var p = parseShape(sh);
      p.id = f.fam + (f.shapes.length > 1 ? '-' + (i + 1) : '');
      p.fam = f.fam; p.color = f.color; p.size = p.cells.length;
      p.w0 = f.w0 / f.shapes.length; p.w1 = f.w1 / f.shapes.length;
      PIECES[p.id] = p; PIECE_LIST.push(p);
    });
  });

  // ---------- Brættet ----------
  function emptyBoard(n) { var b = new Array(n * n); for (var i = 0; i < b.length; i++) b[i] = 0; return b; }

  function originFor(n, piece, cx, cy) {
    var ox = cx - piece.anchor[0], oy = cy - piece.anchor[1];
    ox = Math.max(0, Math.min(n - piece.w, ox));
    oy = Math.max(0, Math.min(n - piece.h, oy));
    return { x: ox, y: oy };
  }
  function cellsAt(n, piece, ox, oy) {
    return piece.cells.map(function (c) { return (oy + c[1]) * n + (ox + c[0]); });
  }
  function fitsAt(board, n, piece, ox, oy) {
    if (ox < 0 || oy < 0 || ox + piece.w > n || oy + piece.h > n) return false;
    for (var i = 0; i < piece.cells.length; i++) {
      var c = piece.cells[i];
      if (board[(oy + c[1]) * n + ox + c[0]]) return false;
    }
    return true;
  }
  function fitsAnywhere(board, n, piece) {
    for (var y = 0; y + piece.h <= n; y++) for (var x = 0; x + piece.w <= n; x++) if (fitsAt(board, n, piece, x, y)) return true;
    return false;
  }
  // Hvilke rækker og kolonner er fulde, hvis felterne `extra` også fyldes?
  function fullLines(board, n, extra) {
    var filled = board.slice();
    (extra || []).forEach(function (i) { filled[i] = 1; });
    var rows = [], cols = [], x, y, full;
    for (y = 0; y < n; y++) { full = true; for (x = 0; x < n && full; x++) if (!filled[y * n + x]) full = false; if (full) rows.push(y); }
    for (x = 0; x < n; x++) { full = true; for (y = 0; y < n && full; y++) if (!filled[y * n + x]) full = false; if (full) cols.push(x); }
    return { rows: rows, cols: cols };
  }
  function lineCells(n, lines) {
    var set = {}, out = [];
    lines.rows.forEach(function (y) { for (var x = 0; x < n; x++) set[y * n + x] = 1; });
    lines.cols.forEach(function (x) { for (var y = 0; y < n; y++) set[y * n + x] = 1; });
    Object.keys(set).forEach(function (k) { out.push(+k); });
    return out.sort(function (a, b) { return a - b; });
  }
  // Point for et træk: k = antal linjer, combo = kombo efter trækket (0 = ingen rydning)
  function scoreFor(pieceSize, k, combo, emptied) {
    var parts = { cells: pieceSize * RULES.cellPoint, lines: 0, combo: 0, empty: 0 };
    if (k > 0) {
      parts.lines = RULES.linePoint * k * k;
      if (combo > 1) parts.combo = RULES.comboPoint * (combo - 1);
      if (emptied) parts.empty = RULES.emptyBonus;
    }
    parts.total = parts.cells + parts.lines + parts.combo + parts.empty;
    return parts;
  }
  // Læg brikken og ryd linjerne (ændrer ikke `board`, returnerer et nyt bræt)
  function applyPlace(board, n, piece, ox, oy) {
    var cells = cellsAt(n, piece, ox, oy);
    var lines = fullLines(board, n, cells);
    var nb = board.slice();
    cells.forEach(function (i) { nb[i] = piece.color; });
    var cleared = lineCells(n, lines);
    cleared.forEach(function (i) { nb[i] = 0; });
    return { board: nb, cells: cells, lines: lines, cleared: cleared };
  }

  // Kan alle brikkerne lægges i en eller anden rækkefølge (med rydning undervejs)?
  function solvable(board, n, pieces) {
    if (!pieces.length) return true;
    var tried = {};
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (tried[p.id]) continue;
      tried[p.id] = true;
      var rest = pieces.slice(0, i).concat(pieces.slice(i + 1));
      for (var y = 0; y + p.h <= n; y++) for (var x = 0; x + p.w <= n; x++) {
        if (!fitsAt(board, n, p, x, y)) continue;
        if (!rest.length) return true;
        if (solvable(applyPlace(board, n, p, x, y).board, n, rest)) return true;
      }
    }
    return false;
  }

  // Vægtet lodtrækning. d = sværhed 0..1 (stiger langsomt med antal sæt).
  function weightOf(p, n, d) {
    var w = p.w0 + (p.w1 - p.w0) * d;
    if (n <= 6) { // lille bræt: færre store brikker
      if (p.fam === 'storkv' || p.fam === 'fem' || p.fam === 'rekt') w *= 0.45;
    }
    return w;
  }
  function drawPiece(rng, n, d, list) {
    list = list || PIECE_LIST;
    var total = 0;
    list.forEach(function (p) { total += weightOf(p, n, d); });
    var r = rng() * total;
    for (var i = 0; i < list.length; i++) { r -= weightOf(list[i], n, d); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function difficulty(setsDealt) { return Math.min(1, setsDealt / 40); }

  // Retfærdige sæt: prøv først at finde tre brikker, der alle kan lægges.
  // Lykkes det ikke, så tre brikker, hvor mindst én kan lægges.
  // Kun hvis heller ikke det lykkes, kommer et sæt, der ender spillet.
  function dealSet(board, n, rng, setsDealt) {
    var d = difficulty(setsDealt), i, set;
    var draw3 = function () {
      var out = [];
      for (var k = 0; k < RULES.trayCount; k++) out.push(drawPiece(rng, n, d));
      // De første sæt: aldrig to store brikker på én gang
      if (setsDealt < 3) {
        var big = out.filter(function (p) { return p.size >= 5; }).length;
        var small = PIECE_LIST.filter(function (p) { return p.size <= 3; });
        for (var j = out.length - 1; j >= 0 && big >= 2; j--) {
          if (out[j].size >= 5) { out[j] = drawPiece(rng, n, 0, small); big--; }
        }
      }
      return out;
    };
    for (i = 0; i < RULES.fairTries; i++) { set = draw3(); if (solvable(board, n, set)) return { pieces: set, fair: 'alle' }; }
    for (i = 0; i < RULES.fairTries; i++) {
      set = draw3();
      if (set.some(function (p) { return fitsAnywhere(board, n, p); })) return { pieces: set, fair: 'en' };
    }
    return { pieces: draw3(), fair: 'ingen' };
  }

  // ---------- Et spil ----------
  function createRun(sizeId, opts) {
    opts = opts || {};
    var size = SIZES[sizeId] || SIZES[DEFAULT_SIZE];
    var n = size.n;
    var rng = opts.rng || Math.random;
    var s = {
      sizeId: size.id, n: n, board: emptyBoard(n), tray: [], score: 0, lines: 0, moves: 0,
      combo: 0, bestCombo: 0, setsDealt: 0, undoLeft: RULES.undos, over: false, lastFair: null
    };
    var history = []; // øjebliksbilleder til fortryd (kun det seneste bruges, men flere gemmes)
    // Alle sæt, der er givet i spillet, efter nummer. Fortryder man og lægger igen, kommer
    // præcis det samme sæt nummer k igen – man kan ikke fiske efter bedre brikker.
    // Listen overlever fortryd (den er ikke en del af øjebliksbilledet).
    var dealt = [];

    function deal() {
      var k = s.setsDealt, res = dealt[k];
      if (!res) { res = dealSet(s.board, n, rng, k); dealt[k] = res; }
      s.tray = res.pieces.slice();
      s.lastFair = res.fair;
      s.setsDealt++;
    }
    function remaining() { return s.tray.filter(function (p) { return !!p; }); }
    function slotFits(slot) { var p = s.tray[slot]; return !!p && fitsAnywhere(s.board, n, p); }
    function anyFits() { for (var i = 0; i < s.tray.length; i++) if (slotFits(i)) return true; return false; }
    function checkOver() { s.over = remaining().length > 0 && !anyFits(); return s.over; }

    // Forhåndsvisning: hvor havner brikken, er det muligt, og hvad ryddes?
    function preview(slot, cx, cy) {
      var p = s.tray[slot];
      if (!p || cx < 0 || cy < 0 || cx >= n || cy >= n) return null;
      var o = originFor(n, p, cx, cy);
      var cells = cellsAt(n, p, o.x, o.y);
      var ok = fitsAt(s.board, n, p, o.x, o.y);
      var blocked = cells.filter(function (i) { return !!s.board[i]; });
      var lines = ok ? fullLines(s.board, n, cells) : { rows: [], cols: [] };
      var k = lines.rows.length + lines.cols.length;
      var cleared = ok ? lineCells(n, lines) : [];
      var emptied = false;
      if (ok && k) {
        var after = applyPlace(s.board, n, p, o.x, o.y).board;
        emptied = after.every(function (v) { return !v; });
      }
      var score = ok ? scoreFor(p.size, k, k ? s.combo + 1 : 0, emptied) : null;
      return { slot: slot, piece: p, x: o.x, y: o.y, anchor: (o.y + p.anchor[1]) * n + o.x + p.anchor[0],
               cells: cells, ok: ok, blocked: blocked, lines: lines, k: k, cleared: cleared, score: score, emptied: emptied };
    }

    function snapshot() {
      return { board: s.board.slice(), tray: s.tray.slice(), score: s.score, lines: s.lines, moves: s.moves,
               combo: s.combo, bestCombo: s.bestCombo, setsDealt: s.setsDealt, over: s.over, lastFair: s.lastFair };
    }

    function place(slot, cx, cy) {
      if (s.over) return { ok: false, reason: 'over' };
      var pv = preview(slot, cx, cy);
      if (!pv) return { ok: false, reason: 'ingen brik' };
      if (!pv.ok) return { ok: false, reason: 'optaget', preview: pv };
      history.push(snapshot());
      if (history.length > 20) history.shift();
      var res = applyPlace(s.board, n, pv.piece, pv.x, pv.y);
      s.board = res.board;
      s.tray[slot] = null;
      s.moves++;
      var k = res.lines.rows.length + res.lines.cols.length;
      if (k) { s.combo++; s.lines += k; } else s.combo = 0;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      var emptied = k > 0 && s.board.every(function (v) { return !v; });
      var pts = scoreFor(pv.piece.size, k, k ? s.combo : 0, emptied);
      s.score += pts.total;
      var newSet = false;
      if (!remaining().length) { deal(); newSet = true; }
      checkOver();
      return { ok: true, slot: slot, piece: pv.piece, cells: res.cells, lines: res.lines, k: k, cleared: res.cleared,
               points: pts, combo: s.combo, emptied: emptied, newSet: newSet, over: s.over };
    }

    function canUndo() { return s.undoLeft > 0 && history.length > 0; }
    function undo() {
      if (!canUndo()) return false;
      var h = history.pop();
      s.board = h.board; s.tray = h.tray; s.score = h.score; s.lines = h.lines; s.moves = h.moves;
      s.combo = h.combo; s.bestCombo = h.bestCombo; s.setsDealt = h.setsDealt; s.over = h.over; s.lastFair = h.lastFair;
      s.undoLeft--;
      checkOver();
      return true;
    }

    if (opts.tray) {
      s.tray = opts.tray.map(function (id) { return id ? PIECES[id] : null; }); s.setsDealt = 1;
      dealt = [{ pieces: s.tray.slice(), fair: null }];
    }
    else deal();
    checkOver();

    var api = {
      state: s, n: n, preview: preview, place: place, undo: undo, canUndo: canUndo,
      slotFits: slotFits, anyFits: anyFits, remaining: remaining, checkOver: checkOver,
      _setBoard: function (b) { s.board = b.slice(); checkOver(); },
      _setTray: function (ids) { s.tray = ids.map(function (id) { return id ? PIECES[id] : null; }); checkOver(); }
    };
    return api;
  }

  global.BlokkeGame = {
    SIZES: SIZES, DEFAULT_SIZE: DEFAULT_SIZE, RULES: RULES, PIECES: PIECES, PIECE_LIST: PIECE_LIST,
    originFor: originFor, cellsAt: cellsAt, fitsAt: fitsAt, fitsAnywhere: fitsAnywhere, fullLines: fullLines,
    lineCells: lineCells, scoreFor: scoreFor, applyPlace: applyPlace, solvable: solvable, dealSet: dealSet,
    emptyBoard: emptyBoard, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
