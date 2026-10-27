/*
 * Fire på stribe – ren spillogik uden DOM (virker også i Node til test).
 *
 * Brættet er 7 kolonner × 6 rækker, gemt som et array med 42 felter:
 * felt = række * 7 + kolonne, række 0 er øverst. 0 = tomt, 1 = dig, 2 = computeren.
 *
 * Computeren bruger minimax (negamax) med alfa-beta-beskæring:
 *   Rolig  – dybde 2 og bevidst lidt tilfældig (tager altid en vindende brik)
 *   Normal – dybde 4
 *   Svær   – dybde 8
 *
 * Et spil er en serie af partier. Sejr og uafgjort giver point, og serien
 * fortsætter. Et tab afslutter serien.
 */
(function (global) {
  'use strict';

  var COLS = 7, ROWS = 6, N = COLS * ROWS;
  var EMPTY = 0, YOU = 1, CPU = 2;
  var ORDER = [3, 2, 4, 1, 5, 0, 6];      // midten først: bedre beskæring og pænere valg
  var WIN = 1000000;

  var LEVELS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  sub: 'svag modstander',  depth: 2, mult: 1 },
    normal: { id: 'normal', name: 'Normal', sub: 'tænker 4 træk frem', depth: 4, mult: 2 },
    svaer:  { id: 'svaer',  name: 'Svær',   sub: 'tænker 8 træk frem', depth: 8, mult: 3 }
  };
  var LEVEL_IDS = ['rolig', 'normal', 'svaer'];
  var DEFAULT_LEVEL = 'normal';
  var HINT_DEPTH = 7;

  // Point pr. parti (ganges med niveauets faktor, derefter trækkes fortryd og tip fra)
  var RULES = {
    win: 100,          // sejr
    perMove: 10,       // pr. træk under 21 (få træk giver flere point)
    maxMoves: 21,      // så mange brikker har hver spiller højst
    draw: 50,          // uafgjort
    undoCost: 25,      // fortryd
    hintCost: 10,      // tip
    maxUndo: 1,        // fortryd ét træk pr. parti
    minWin: 10, minDraw: 5
  };

  function idx(r, c) { return r * COLS + c; }
  function emptyBoard() { var b = []; for (var i = 0; i < N; i++) b.push(EMPTY); return b; }
  function landingRow(b, c) {
    if (c < 0 || c >= COLS) return -1;
    for (var r = ROWS - 1; r >= 0; r--) if (!b[idx(r, c)]) return r;
    return -1;
  }
  function canDrop(b, c) { return c >= 0 && c < COLS && !b[c]; }
  function validMoves(b) { return ORDER.filter(function (c) { return !b[c]; }); }
  function isFull(b) { for (var c = 0; c < COLS; c++) if (!b[c]) return false; return true; }
  function count(b, p) { var n = 0; for (var i = 0; i < N; i++) if (b[i] === p) n++; return n; }
  // Ny plade med brikken lagt i (originalen ændres ikke). Returnerer null, hvis kolonnen er fuld.
  function dropped(b, c, p) {
    var r = landingRow(b, c); if (r < 0) return null;
    var nb = b.slice(); nb[idx(r, c)] = p; return nb;
  }

  // Alle 69 mulige firer (vandret, lodret og begge diagonaler)
  var WINDOWS = [];
  (function () {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) dirs.forEach(function (d) {
      var er = r + 3 * d[0], ec = c + 3 * d[1];
      if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) return;
      WINDOWS.push([idx(r, c), idx(r + d[0], c + d[1]), idx(r + 2 * d[0], c + 2 * d[1]), idx(er, ec)]);
    });
  })();

  // Vinder brikken på (r, c)? Returnerer felterne på stribe (mindst fire) eller null.
  function lineThrough(b, r, c) {
    var p = b[idx(r, c)]; if (!p) return null;
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var k = 0; k < 4; k++) {
      var dr = dirs[k][0], dc = dirs[k][1], cells = [idx(r, c)];
      for (var s = 1; s < 4; s++) { var rr = r + dr * s, cc = c + dc * s; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[idx(rr, cc)] !== p) break; cells.push(idx(rr, cc)); }
      for (s = 1; s < 4; s++) { rr = r - dr * s; cc = c - dc * s; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[idx(rr, cc)] !== p) break; cells.unshift(idx(rr, cc)); }
      if (cells.length >= 4) return cells;
    }
    return null;
  }
  // Find en vinder på hele pladen: { player, cells } (alle vindende felter) eller null
  function findWin(b) {
    var cells = {}, player = 0;
    WINDOWS.forEach(function (w) {
      var p = b[w[0]];
      if (p && b[w[1]] === p && b[w[2]] === p && b[w[3]] === p) { if (!player) player = p; if (p === player) w.forEach(function (i) { cells[i] = 1; }); }
    });
    if (!player) return null;
    return { player: player, cells: Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }) };
  }
  function status(b) {
    var w = findWin(b);
    if (w) return { state: 'win', player: w.player, cells: w.cells };
    if (isFull(b)) return { state: 'draw', player: 0, cells: [] };
    return { state: 'play', player: 0, cells: [] };
  }

  // ---------- Computeren: negamax med alfa-beta ----------
  // Vurdering af en stilling set fra spiller p: åbne firer med 2 og 3 brikker + midterkolonnen.
  function evaluate(b, p) {
    var o = 3 - p, s = 0;
    for (var r = 0; r < ROWS; r++) { var m = b[idx(r, 3)]; if (m === p) s += 3; else if (m === o) s -= 3; }
    for (var k = 0; k < WINDOWS.length; k++) {
      var w = WINDOWS[k], mine = 0, theirs = 0;
      for (var j = 0; j < 4; j++) { var v = b[w[j]]; if (v === p) mine++; else if (v === o) theirs++; }
      if (mine && theirs) continue;
      if (mine === 3) s += 5; else if (mine === 2) s += 2;
      else if (theirs === 3) s -= 5; else if (theirs === 2) s -= 2;
    }
    return s;
  }
  function makeHeights(b) { var h = []; for (var c = 0; c < COLS; c++) h.push(landingRow(b, c)); return h; }
  function winsAt(b, r, c, p) {
    var dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var k = 0; k < 4; k++) {
      var dr = dirs[k][0], dc = dirs[k][1], n = 1;
      for (var s = 1; s < 4; s++) { var rr = r + dr * s, cc = c + dc * s; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== p) break; n++; }
      for (s = 1; s < 4; s++) { rr = r - dr * s; cc = c - dc * s; if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== p) break; n++; }
      if (n >= 4) return true;
    }
    return false;
  }
  function negamax(b, h, depth, alpha, beta, p, st) {
    st.nodes++;
    var any = false, k, c, r;
    // Kan p vinde med det samme?
    for (k = 0; k < 7; k++) {
      c = ORDER[k]; r = h[c]; if (r < 0) continue; any = true;
      b[r * COLS + c] = p; var w = winsAt(b, r, c, p); b[r * COLS + c] = EMPTY;
      if (w) return WIN + depth;
    }
    if (!any) return 0;            // fuld plade: uafgjort
    if (depth <= 0) return evaluate(b, p);
    var best = -Infinity;
    for (k = 0; k < 7; k++) {
      c = ORDER[k]; r = h[c]; if (r < 0) continue;
      b[r * COLS + c] = p; h[c] = r - 1;
      var v = -negamax(b, h, depth - 1, -beta, -alpha, 3 - p, st);
      b[r * COLS + c] = EMPTY; h[c] = r;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  // Bedste kolonne for spiller p. Lige gode træk vælges tilfældigt med rng.
  function bestMove(board, p, depth, rng) {
    rng = rng || Math.random;
    var b = board.slice(), h = makeHeights(b), st = { nodes: 0 };
    var scores = {}, best = -Infinity, cols = [];
    for (var k = 0; k < 7; k++) {
      var c = ORDER[k], r = h[c]; if (r < 0) continue;
      var v;
      b[r * COLS + c] = p;
      if (winsAt(b, r, c, p)) v = WIN + depth + 1;
      else { h[c] = r - 1; v = -negamax(b, h, depth - 1, -Infinity, best === -Infinity ? Infinity : -(best - 1), 3 - p, st); h[c] = r; }
      b[r * COLS + c] = EMPTY;
      scores[c] = v;
      if (v > best) { best = v; cols = [c]; } else if (v === best) cols.push(c);
    }
    if (!cols.length) return { col: -1, score: 0, scores: scores, nodes: st.nodes };
    return { col: cols[Math.floor(rng() * cols.length) % cols.length], score: best, scores: scores, nodes: st.nodes, ties: cols };
  }
  function winningMoves(b, p) {
    return validMoves(b).filter(function (c) { var r = landingRow(b, c); var nb = b.slice(); nb[idx(r, c)] = p; return winsAt(nb, r, c, p); });
  }
  // Computerens træk på et niveau
  function cpuMove(b, levelId, rng) {
    rng = rng || Math.random;
    var lv = LEVELS[levelId] || LEVELS[DEFAULT_LEVEL];
    var moves = validMoves(b);
    if (!moves.length) return -1;
    var win = winningMoves(b, CPU);
    if (win.length) return win[0];                            // alle niveauer tager en vindende brik
    var block = winningMoves(b, YOU);
    // Normal og Svær lukker altid din vindende brik (har du to, lukkes den ene – det er tabt alligevel)
    if (lv.id !== 'rolig' && block.length) return block[0];
    if (lv.id === 'rolig') {
      if (block.length) return rng() < 0.6 ? block[0] : moves[Math.floor(rng() * moves.length) % moves.length];
      if (rng() < 0.45) {
        // Et tilfældigt træk, som ikke giver dig en vindende brik lige ovenpå
        var safe = moves.filter(function (c) { var nb = dropped(b, c, CPU); return !winningMoves(nb, YOU).length; });
        var pool = safe.length ? safe : moves;
        return pool[Math.floor(rng() * pool.length) % pool.length];
      }
    }
    return bestMove(b, CPU, lv.depth, rng).col;
  }
  function hintMove(b, rng) { return bestMove(b, YOU, HINT_DEPTH, rng || function () { return 0; }).col; }

  // ---------- Point ----------
  function gamePoints(result, youMoves, levelId, penalty) {
    var mult = (LEVELS[levelId] || LEVELS[DEFAULT_LEVEL]).mult;
    if (result === 'win') {
      var base = RULES.win + RULES.perMove * Math.max(0, RULES.maxMoves - youMoves);
      return { base: base, mult: mult, penalty: penalty, total: Math.max(RULES.minWin, base * mult - penalty) };
    }
    if (result === 'draw') return { base: RULES.draw, mult: mult, penalty: penalty, total: Math.max(RULES.minDraw, RULES.draw * mult - penalty) };
    return { base: 0, mult: mult, penalty: penalty, total: 0 };
  }

  // ---------- Serie af partier ----------
  function createSeries(levelId, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    if (!LEVELS[levelId]) levelId = DEFAULT_LEVEL;
    var s = {
      level: levelId, score: 0, game: 0, wins: 0, draws: 0, ended: false,
      board: null, starter: CPU, turn: YOU, history: [], youMoves: 0,
      undosUsed: 0, hintsUsed: 0, penalty: 0, hintCol: -1,
      result: null, winCells: [], lastMove: null, lastPoints: null
    };
    function newGame() {
      s.game++;
      s.board = emptyBoard();
      s.starter = s.game % 2 === 1 ? YOU : CPU;   // I skiftes til at starte. Du starter første parti.
      s.turn = s.starter;
      s.history = []; s.youMoves = 0; s.undosUsed = 0; s.hintsUsed = 0; s.penalty = 0; s.hintCol = -1;
      s.result = null; s.winCells = []; s.lastMove = null; s.lastPoints = null;
    }
    function settle() {
      var st = status(s.board);
      if (st.state === 'play') return null;
      s.winCells = st.cells;
      s.result = st.state === 'draw' ? 'draw' : (st.player === YOU ? 'win' : 'loss');
      s.lastPoints = gamePoints(s.result, s.youMoves, s.level, s.penalty);
      s.score += s.lastPoints.total;
      if (s.result === 'win') s.wins++;
      else if (s.result === 'draw') s.draws++;
      else s.ended = true;                       // et tab afslutter serien
      return s.result;
    }
    function place(c, p) {
      var r = landingRow(s.board, c);
      s.board[idx(r, c)] = p;
      s.history.push({ col: c, row: r, p: p });
      s.lastMove = { col: c, row: r, p: p };
      if (p === YOU) s.youMoves++;
      s.hintCol = -1;
      var res = settle();
      if (!res) s.turn = 3 - p;
      return { ok: true, col: c, row: r, player: p, result: res };
    }
    function play(c) {
      if (s.ended || s.result || s.turn !== YOU || !canDrop(s.board, c)) return { ok: false };
      return place(c, YOU);
    }
    function cpuChoose() { return cpuMove(s.board, s.level, rng); }
    function cpuPlay(c) {
      if (s.ended || s.result || s.turn !== CPU) return { ok: false };
      if (c === undefined || c === null) c = cpuChoose();
      if (!canDrop(s.board, c)) return { ok: false };
      return place(c, CPU);
    }
    function canUndo() {
      return !s.ended && !s.result && s.turn === YOU && s.undosUsed < RULES.maxUndo &&
        s.history.some(function (m) { return m.p === YOU; });
    }
    // Fortryd: din seneste brik (og computerens svar på den) tages tilbage
    function undo() {
      if (!canUndo()) return { ok: false };
      var removed = [];
      while (s.history.length) {
        var m = s.history.pop(); s.board[idx(m.row, m.col)] = EMPTY; removed.push(m);
        if (m.p === YOU) break;
      }
      s.youMoves--; s.undosUsed++; s.penalty += RULES.undoCost; s.hintCol = -1;
      s.lastMove = s.history.length ? s.history[s.history.length - 1] : null;
      s.turn = YOU;
      return { ok: true, removed: removed };
    }
    function hint() {
      if (s.ended || s.result || s.turn !== YOU) return -1;
      if (s.hintCol >= 0) return s.hintCol;
      s.hintCol = hintMove(s.board);
      s.hintsUsed++; s.penalty += RULES.hintCost;
      return s.hintCol;
    }
    function nextGame() {
      if (s.ended || !s.result) return false;
      newGame(); return true;
    }
    function end() { s.ended = true; return { score: s.score, wins: s.wins, draws: s.draws, games: s.game }; }
    newGame();
    return {
      state: s, play: play, cpuChoose: cpuChoose, cpuPlay: cpuPlay, canUndo: canUndo, undo: undo,
      hint: hint, nextGame: nextGame, end: end,
      // Kun til test: sæt en bestemt plade
      _setBoard: function (b, turn) { s.board = b.slice(); s.turn = turn || YOU; s.result = null; s.winCells = []; s.hintCol = -1; s.history = []; s.youMoves = count(b, YOU); }
    };
  }

  // Plade ud fra tekst (til test): 6 linjer à 7 tegn, '.' tom, 'X' dig, 'O' computeren
  function fromRows(rows) {
    var b = [];
    rows.forEach(function (r) { for (var i = 0; i < COLS; i++) b.push(r[i] === 'X' ? YOU : r[i] === 'O' ? CPU : EMPTY); });
    return b;
  }

  global.FirePaaStribeGame = {
    COLS: COLS, ROWS: ROWS, N: N, EMPTY: EMPTY, YOU: YOU, CPU: CPU, ORDER: ORDER, WINDOWS: WINDOWS,
    LEVELS: LEVELS, LEVEL_IDS: LEVEL_IDS, DEFAULT_LEVEL: DEFAULT_LEVEL, RULES: RULES, HINT_DEPTH: HINT_DEPTH,
    idx: idx, emptyBoard: emptyBoard, landingRow: landingRow, canDrop: canDrop, validMoves: validMoves,
    isFull: isFull, dropped: dropped, lineThrough: lineThrough, findWin: findWin, status: status,
    evaluate: evaluate, bestMove: bestMove, winningMoves: winningMoves, cpuMove: cpuMove, hintMove: hintMove,
    gamePoints: gamePoints, createSeries: createSeries, fromRows: fromRows
  };
})(typeof window !== 'undefined' ? window : globalThis);
