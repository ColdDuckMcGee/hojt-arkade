/*
 * Rørlægger – spillogikken. Ingen DOM, ingen farver og ingen grafik.
 * Kan bruges både i browseren (window.RorlaeggerLogik) og i Node (test).
 *
 * Gitteret er n × n felter. Hvert felt har en brik med åbninger mod nord, øst,
 * syd og vest (bitmaske N=1, Ø=2, S=4, V=8). En brik har en type med en fast
 * grundform og en drejning 0–3 (antal kvarte omgange med uret).
 *   lige   N+S         knaek  N+Ø        t  N+Ø+S       kryds  alle fire
 *   kilde  N (fast)    afloeb N (fast)   – kilde og afløb kan ikke drejes.
 * Vandet løber fra kilden gennem åbninger, der passer sammen (begge felter har
 * en åbning mod hinanden). Når vandet når afløbet, er banen klaret.
 *
 * Baner laves automatisk og kan altid løses: først et tilfældigt udspændende
 * træ over hele gitteret, så vælges kilde og afløb, og stien mellem dem i træet
 * bliver til rør. De andre felter får tilfældige brikker. Til sidst drejes alle
 * brikker tilfældigt (og aldrig, så banen er løst fra start).
 */
(function (global) {
  'use strict';
  var N = 1, E = 2, S = 4, W = 8;
  var DIRS = [N, E, S, W];
  var DX = {}, DY = {}, OPP = {};
  DX[N] = 0; DY[N] = -1; OPP[N] = S;
  DX[E] = 1; DY[E] = 0; OPP[E] = W;
  DX[S] = 0; DY[S] = 1; OPP[S] = N;
  DX[W] = -1; DY[W] = 0; OPP[W] = E;
  var BASE = { lige: N | S, knaek: N | E, t: N | E | S, kryds: 15, kilde: N, afloeb: N };
  var TYPES = ['lige', 'knaek', 't', 'kryds'];

  // Regler (samlet ét sted, så de kan justeres og testes)
  var RULES = {
    lives: 3,
    lifeEvery: 5,                   // hver 5. klarede bane giver et liv tilbage (højst 3)
    sizes: [4, 5, 6],               // gitterstørrelser i stigende rækkefølge
    sizeFrom: { 4: 1, 5: 4, 6: 9 }, // fra hvilken bane størrelsen bruges
    pointsPerPipe: 10,              // pr. felt vandet løber igennem
    pointsPerSpare: 5,              // pr. sparet drejning
    levelBonus: 5,                  // pr. banenummer
    // Ekstra drejninger ud over dem, banens egen løsning kræver: færre og færre
    buffer: function (level) { return Math.max(2, 7 - Math.floor((level - 1) / 2)); },
    // Ønsket længde på stien fra kilde til afløb (i felter, inkl. kilde og afløb)
    pathLength: function (n, level) { return Math.min(n * n - 2, n + 1 + Math.floor(level * 0.8)); }
  };

  // ---------- Hjælpere ----------
  function rotate(mask, k) {
    k = ((k % 4) + 4) % 4;
    for (var i = 0; i < k; i++) mask = ((mask << 1) | (mask >> 3)) & 15;
    return mask;
  }
  function openings(tile) { return rotate(BASE[tile.type], tile.rot); }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { // mulberry32
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickInt(r, n) { return Math.floor(r() * n); }
  function bits(m) { var c = 0; for (var i = 0; i < 4; i++) if (m & DIRS[i]) c++; return c; }
  // Type og drejning, der giver præcis åbningerne `mask`
  function typeFor(mask) {
    var c = bits(mask), list = c === 4 ? ['kryds'] : c === 3 ? ['t'] : c === 2 ? ['lige', 'knaek'] : [];
    for (var i = 0; i < list.length; i++) for (var k = 0; k < 4; k++) if (rotate(BASE[list[i]], k) === mask) return { type: list[i], rot: k };
    return null;
  }
  // Det mindste antal drejninger med uret, før brikken har alle åbningerne i `need`
  function turnsNeeded(tile, need) {
    for (var k = 0; k < 4; k++) if ((rotate(BASE[tile.type], tile.rot + k) & need) === need) return k;
    return -1;
  }
  function neighbour(i, d, n) {
    var x = i % n + DX[d], y = Math.floor(i / n) + DY[d];
    if (x < 0 || y < 0 || x >= n || y >= n) return -1;
    return y * n + x;
  }

  // ---------- Vandets vej ----------
  // Bredde-først fra kilden. dist[i] = skridt fra kilden (-1 = tørt felt).
  // Vandet løber kun videre, hvor begge brikker har åbninger mod hinanden.
  function flow(board) {
    var n = board.n, tiles = board.tiles, dist = [], i;
    for (i = 0; i < tiles.length; i++) dist.push(-1);
    var q = [board.source]; dist[board.source] = 0;
    var count = 0, maxDist = 0;
    while (q.length) {
      var c = q.shift(); count++;
      var o = openings(tiles[c]);
      for (var k = 0; k < 4; k++) {
        var d = DIRS[k];
        if (!(o & d)) continue;
        var nb = neighbour(c, d, n);
        if (nb < 0 || dist[nb] >= 0) continue;
        if (!(openings(tiles[nb]) & OPP[d])) continue;
        dist[nb] = dist[c] + 1;
        if (dist[nb] > maxDist) maxDist = dist[nb];
        q.push(nb);
      }
    }
    return { dist: dist, reached: dist[board.drain] >= 0, wet: count, maxDist: maxDist };
  }

  // ---------- Generator ----------
  // Tilfældigt udspændende træ (tilfældig dybde-først), som naboliste pr. felt
  function spanningTree(n, r) {
    var N2 = n * n, seen = [], adj = [], i;
    for (i = 0; i < N2; i++) { seen.push(false); adj.push(0); }
    var start = pickInt(r, N2), stack = [start]; seen[start] = true;
    while (stack.length) {
      var c = stack[stack.length - 1], opts = [];
      for (var k = 0; k < 4; k++) { var nb = neighbour(c, DIRS[k], n); if (nb >= 0 && !seen[nb]) opts.push(DIRS[k]); }
      if (!opts.length) { stack.pop(); continue; }
      var d = opts[pickInt(r, opts.length)], to = neighbour(c, d, n);
      adj[c] |= d; adj[to] |= OPP[d]; seen[to] = true; stack.push(to);
    }
    return adj;
  }
  // Afstande og forgængere i træet fra `from`
  function treeDist(adj, n, from) {
    var dist = [], prev = [], i;
    for (i = 0; i < adj.length; i++) { dist.push(-1); prev.push(-1); }
    var q = [from]; dist[from] = 0;
    while (q.length) {
      var c = q.shift();
      for (var k = 0; k < 4; k++) {
        if (!(adj[c] & DIRS[k])) continue;
        var nb = neighbour(c, DIRS[k], n);
        if (dist[nb] >= 0) continue;
        dist[nb] = dist[c] + 1; prev[nb] = c; q.push(nb);
      }
    }
    return { dist: dist, prev: prev };
  }
  function dirTo(a, b, n) {
    for (var k = 0; k < 4; k++) if (neighbour(a, DIRS[k], n) === b) return DIRS[k];
    return 0;
  }
  // Fyldbrikker uden for stien: flest lige og knæk, færre T og få kryds
  function randomType(r) {
    var v = r();
    return v < 0.36 ? 'lige' : v < 0.74 ? 'knaek' : v < 0.93 ? 't' : 'kryds';
  }

  // Laver en bane. Returnerer { n, tiles, source, drain, path, need, solTurns }
  // path: felterne fra kilde til afløb. need[i]: åbninger felt i skal have (0 = ligegyldigt).
  function generate(n, level, seedOrRng) {
    var r = typeof seedOrRng === 'function' ? seedOrRng : rng(seedOrRng || Date.now());
    var want = RULES.pathLength(n, level || 1);
    for (var attempt = 0; attempt < 200; attempt++) {
      var adj = spanningTree(n, r), N2 = n * n;
      var source = pickInt(r, N2), td = treeDist(adj, n, source);
      // Afløbet: et felt, hvor stien har den ønskede længde (eller så tæt på som muligt)
      var best = [], bestDiff = Infinity;
      for (var i = 0; i < N2; i++) {
        if (i === source) continue;
        var len = td.dist[i] + 1, diff = Math.abs(len - want);
        if (diff < bestDiff) { bestDiff = diff; best = [i]; } else if (diff === bestDiff) best.push(i);
      }
      var drain = best[pickInt(r, best.length)];
      if (td.dist[drain] + 1 < Math.min(want, 4)) continue;
      var path = [], c = drain;
      while (c >= 0) { path.unshift(c); c = td.prev[c]; }
      var need = [], tiles = [];
      for (i = 0; i < N2; i++) { need.push(0); tiles.push(null); }
      for (var p = 0; p < path.length; p++) {
        var m = 0;
        if (p > 0) m |= dirTo(path[p], path[p - 1], n);
        if (p < path.length - 1) m |= dirTo(path[p], path[p + 1], n);
        need[path[p]] = m;
      }
      // Kilde og afløb: faste brikker med én åbning
      tiles[source] = { type: 'kilde', rot: typeForSingle(need[source]), fixed: true };
      tiles[drain] = { type: 'afloeb', rot: typeForSingle(need[drain]), fixed: true };
      for (p = 1; p < path.length - 1; p++) {
        var mk = need[path[p]];
        // En gang imellem et ekstra hul (T eller kryds), så stien ikke er så let at se
        var extra = r() < 0.18 ? DIRS[pickInt(r, 4)] : 0;
        var tf = typeFor(mk | extra) || typeFor(mk);
        tiles[path[p]] = { type: tf.type, rot: tf.rot, fixed: false };
      }
      for (i = 0; i < N2; i++) if (!tiles[i]) tiles[i] = { type: randomType(r), rot: 0, fixed: false };
      // Drej alle brikker tilfældigt
      for (i = 0; i < N2; i++) if (!tiles[i].fixed) tiles[i].rot = pickInt(r, 4);
      var board = { n: n, tiles: tiles, source: source, drain: drain, path: path, need: need };
      // Banen må ikke være løst fra start, og stien skal kræve nogle drejninger
      var sol = solutionTurns(board);
      if (flow(board).reached || sol < Math.min(3, path.length - 2)) {
        // Prøv at drejet stien mere, før en helt ny bane laves
        for (var t = 0; t < 20 && (flow(board).reached || solutionTurns(board) < Math.min(3, path.length - 2)); t++) {
          var j = path[1 + pickInt(r, Math.max(1, path.length - 2))];
          if (!tiles[j].fixed) tiles[j].rot = (tiles[j].rot + 1 + pickInt(r, 3)) % 4;
        }
        if (flow(board).reached) continue;
        sol = solutionTurns(board);
      }
      board.solTurns = sol;
      return board;
    }
    throw new Error('Kunne ikke lave en bane');
  }
  function typeForSingle(mask) { for (var k = 0; k < 4; k++) if (rotate(N, k) === mask) return k; return 0; }
  // Drejninger, der skal til for at lægge banens egen sti (en øvre grænse for den bedste løsning)
  function solutionTurns(board) {
    var s = 0;
    for (var p = 0; p < board.path.length; p++) {
      var i = board.path[p], tl = board.tiles[i];
      if (tl.fixed) continue;
      s += turnsNeeded(tl, board.need[i]);
    }
    return s;
  }
  function cloneBoard(b) {
    return { n: b.n, source: b.source, drain: b.drain, path: b.path.slice(), need: b.need.slice(), solTurns: b.solTurns,
      tiles: b.tiles.map(function (t) { return { type: t.type, rot: t.rot, fixed: t.fixed }; }) };
  }

  // ---------- Et spil (en række baner uden ende) ----------
  function sizeForLevel(level, maxN) {
    var n = RULES.sizes[0];
    RULES.sizes.forEach(function (s) { if (level >= RULES.sizeFrom[s] && s <= maxN) n = s; });
    return n;
  }
  function createRun(opts) {
    opts = opts || {};
    var r = rng(opts.seed || (Date.now() ^ (Math.random() * 1e9)));
    var maxN = opts.maxN || 6;
    var state = {
      level: 1, n: 0, board: null, budget: 0, turnsLeft: 0, turnsUsed: 0, lives: RULES.lives,
      score: 0, cleared: 0, solved: false, over: false, ended: false, lastPoints: null,
      flow: null, water: null, undo: [], attempts: 0, maxN: maxN
    };
    function loadLevel() {
      var n = sizeForLevel(state.level, state.maxN);
      var b = generate(n, state.level, r);
      setBoard(b);
    }
    function setBoard(b) {
      state.n = b.n; state.board = b;
      state.budget = b.solTurns + RULES.buffer(state.level);
      state.turnsLeft = state.budget; state.turnsUsed = 0;
      state.solved = false; state.lastPoints = null; state.water = null; state.undo = []; state.attempts = 0;
      state.flow = flow(b);
    }
    loadLevel();

    var api = {
      state: state,
      get n() { return state.n; },
      live: function () { return !state.solved && !state.over && !state.ended; },
      // Drej brikken i felt i en kvart omgang med uret. Koster én drejning.
      rotate: function (i) {
        if (!api.live()) return { ok: false, result: 'slut' };
        var t = state.board.tiles[i];
        if (!t) return { ok: false, result: 'ugyldig' };
        if (t.fixed) return { ok: false, result: t.type };
        if (state.turnsLeft <= 0) return { ok: false, result: 'ingen' };
        t.rot = (t.rot + 1) % 4;
        state.turnsLeft--; state.turnsUsed++;
        state.undo.push(i);
        state.water = null;
        state.flow = flow(state.board);
        return { ok: true, result: 'drejet', connected: state.flow.reached };
      },
      // Fortryd den seneste drejning (giver drejningen tilbage). Kun inden for samme forsøg.
      undo: function () {
        if (!api.live() || !state.undo.length) return { ok: false };
        var i = state.undo.pop(), t = state.board.tiles[i];
        t.rot = (t.rot + 3) % 4;
        state.turnsLeft++; state.turnsUsed--;
        state.water = null;
        state.flow = flow(state.board);
        return { ok: true, index: i };
      },
      // Luk vandet på. Når vandet afløbet, er banen klaret; ellers koster det et liv,
      // og man får banens ekstra drejninger igen, hvis man har færre.
      openWater: function () {
        if (!api.live()) return { ok: false };
        var f = flow(state.board);
        state.flow = f; state.water = f; state.attempts++;
        if (f.reached) {
          var pts = {
            pipes: f.wet * RULES.pointsPerPipe,
            spare: state.turnsLeft * RULES.pointsPerSpare,
            level: state.level * RULES.levelBonus
          };
          pts.total = pts.pipes + pts.spare + pts.level;
          state.lastPoints = pts; state.score += pts.total; state.cleared++; state.solved = true;
          var life = false;
          if (state.cleared % RULES.lifeEvery === 0 && state.lives < RULES.lives) { state.lives++; life = true; }
          pts.life = life;
          return { ok: true, reached: true, points: pts, flow: f, life: life };
        }
        state.lives--;
        state.undo = [];
        if (state.lives <= 0) { state.lives = 0; state.over = true; return { ok: true, reached: false, over: true, flow: f }; }
        var refill = RULES.buffer(state.level), got = 0;
        if (state.turnsLeft < refill) { got = refill - state.turnsLeft; state.turnsLeft = refill; }
        return { ok: true, reached: false, over: false, refill: got, flow: f };
      },
      nextLevel: function () {
        if (!state.solved || state.over) return false;
        state.level++;
        loadLevel();
        return true;
      },
      setMaxN: function (m) { state.maxN = m; },
      end: function () { state.ended = true; return { score: state.score, cleared: state.cleared, level: state.level }; },
      // Til test: læg en bestemt bane ind
      _setBoard: function (b) { setBoard(b); }
    };
    return api;
  }

  global.RorlaeggerLogik = {
    N: N, E: E, S: S, W: W, DIRS: DIRS, BASE: BASE, TYPES: TYPES, RULES: RULES,
    rotate: rotate, openings: openings, typeFor: typeFor, turnsNeeded: turnsNeeded, neighbour: neighbour,
    rng: rng, flow: flow, generate: generate, solutionTurns: solutionTurns, cloneBoard: cloneBoard,
    sizeForLevel: sizeForLevel, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
