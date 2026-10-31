/*
 * Labyrinten – spillets regler uden brugerflade (kan også køres i Node til test).
 *
 *   const run = LabyrintenGame.createRun({ difficulty: 'normal' });
 *   run.canMove('left');              // er der en gang den vej?
 *   const r = run.move('left');       // { bump } ved væg, ellers { frames, events, result }
 *   run.preview('up');                // samme som move, men på en kopi (ændrer intet)
 *   run.guardPlan(g);                 // vagtens næste træk: { dir, path } eller null
 *   run.continueAfterCatch();         // efter et mistet liv: alle stiller sig på plads
 *   run.nextLevel();                  // efter en ryddet bane
 *
 * ÉT TRÆK = ÉT FELT. Går man mod en væg, sker der intet, og det koster ikke et træk.
 * Efter hvert træk tager vagterne ét skridt (på Rolig kun efter hvert andet træk).
 * Vagterne beslutter deres skridt, FØR spilleren flytter, så det skridt, der vises
 * på brættet, altid er præcis det, de tager. Der er ingen tilfældighed, og spiller og
 * vagter flytter samtidig: man bliver fanget, hvis man ender i samme felt, eller hvis
 * man bytter felt med en vagt (krydser hinanden).
 */
(function (global) {
  'use strict';

  var DIRS = {
    up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 }
  };
  var ORDER = ['up', 'left', 'down', 'right'];   // fast rækkefølge, når to veje er lige gode
  var REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // Vagternes typer, i den rækkefølge de kommer med.
  var TYPES = ['jaeger', 'afskaerer', 'patrulje', 'lurer'];
  var TYPE_NAMES = { jaeger: 'Jægeren', afskaerer: 'Afskæreren', patrulje: 'Patruljen', lurer: 'Lureren' };

  var POINTS = {
    dot: 10, pellet: 50, guards: [200, 400, 800, 1600],
    level: function (level) { return 250 * level; }     // ryddet bane: 250 × banens nummer
  };

  /*
   * Sværhedsgrader. Banerne bliver gradvist sværere.
   *   guards(level)     antal vagter på banen
   *   every             vagterne tager ét skridt efter hvert 'every' træk
   *   smart(level)      jægeren og afskæreren finder den korteste vej (ellers luftlinje)
   *   fright(level)     antal træk, vagterne er sårbare efter en kraftpille
   *   waits             hvor mange træk hver vagt venter hjemme, før den går ud
   */
  var DIFFICULTIES = {
    rolig: {
      label: 'Rolig', every: 2,
      guards: function (level) { return level < 3 ? 2 : 3; },
      smart: function (level) { return level >= 5; },
      fright: function (level) { return Math.max(14, 20 - (level - 1)); },
      waits: [4, 10, 16, 22]
    },
    normal: {
      label: 'Normal', every: 1,
      guards: function (level) { return level < 2 ? 3 : 4; },
      smart: function (level) { return level >= 3; },
      fright: function (level) { return Math.max(8, 12 - Math.floor((level - 1) / 2)); },
      waits: [2, 6, 10, 14]
    },
    svaer: {
      label: 'Svær', every: 1,
      guards: function () { return 4; },
      smart: function () { return true; },
      fright: function (level) { return Math.max(5, 8 - Math.floor((level - 1) / 2)); },
      waits: [0, 2, 4, 6]
    }
  };

  // ---------- Labyrint ----------
  var mazeCache = {};
  function mazeList() { return global.LabyrintenMazes; }
  function loadMaze(index) {
    var list = mazeList(), n = ((index % list.length) + list.length) % list.length;
    if (mazeCache[n]) return mazeCache[n];
    var def = list[n], rows = def.rows, h = rows.length, w = rows[0].length;
    var walls = new Array(w * h), items = new Array(w * h);
    var start = null, home = null, pellets = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var c = rows[y][x], i = y * w + x;
        walls[i] = c === '#';
        items[i] = c === '.' ? 1 : c === 'o' ? 2 : 0;
        if (c === 'o') pellets.push({ x: x, y: y });
        if (c === 'P') start = { x: x, y: y };
        if (c === 'G') home = { x: x, y: y };
      }
    }
    var maze = { name: def.navn, index: n, w: w, h: h, walls: walls, items: items, start: start, home: home };
    maze.open = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && !walls[y * w + x]; };
    // Hjørnemål til patruljen: kraftpillerne med uret fra øverst til venstre.
    var cx = (w - 1) / 2, cy = (h - 1) / 2;
    function angle(p) { return (Math.atan2(p.y - cy, p.x - cx) + Math.PI * 2 + Math.PI * 0.75) % (Math.PI * 2); }
    pellets.sort(function (a, b) { return angle(a) - angle(b); });
    maze.corners = pellets.length >= 2 ? pellets : [{ x: 1, y: 1 }, { x: w - 2, y: 1 }, { x: w - 2, y: h - 2 }, { x: 1, y: h - 2 }];
    maze.guardStarts = bfsOrder(maze, home, 4);
    mazeCache[n] = maze;
    return maze;
  }
  function bfsOrder(maze, from, n) {
    var out = [from], seen = {}, q = [from];
    seen[from.x + ',' + from.y] = true;
    while (q.length && out.length < n) {
      var p = q.shift();
      ['left', 'right', 'up', 'down'].forEach(function (d) {
        var nx = p.x + DIRS[d].x, ny = p.y + DIRS[d].y, k = nx + ',' + ny;
        if (maze.open(nx, ny) && !seen[k]) { seen[k] = true; q.push({ x: nx, y: ny }); if (out.length < n) out.push({ x: nx, y: ny }); }
      });
    }
    while (out.length < n) out.push(from);
    return out;
  }
  function distanceMap(maze, tx, ty) {
    var d = new Array(maze.w * maze.h).fill(Infinity);
    if (!maze.open(tx, ty)) return d;
    var q = [[tx, ty]]; d[ty * maze.w + tx] = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var x = q[qi][0], y = q[qi][1], cur = d[y * maze.w + x];
      for (var k = 0; k < 4; k++) {
        var dd = DIRS[ORDER[k]], nx = x + dd.x, ny = y + dd.y;
        if (maze.open(nx, ny) && d[ny * maze.w + nx] === Infinity) { d[ny * maze.w + nx] = cur + 1; q.push([nx, ny]); }
      }
    }
    return d;
  }
  function homeMap(maze) {
    if (!maze.homeDist) maze.homeDist = distanceMap(maze, maze.home.x, maze.home.y);
    return maze.homeDist;
  }

  // ---------- Tilstand ----------
  function freshLevelState(s) {
    var maze = loadMaze(s.level - 1);
    s.maze = maze;
    s.items = maze.items.slice();
    s.dotsLeft = s.items.filter(function (v) { return v > 0; }).length;
    s.dotsTotal = s.dotsLeft;
    placeActors(s);
  }
  function placeActors(s) {
    var maze = s.maze, diff = DIFFICULTIES[s.difficulty];
    var n = diff.guards(s.level), lvlCut = Math.min(s.level - 1, 3);
    s.player = { x: maze.start.x, y: maze.start.y, dir: 'left' };
    s.guards = [];
    for (var i = 0; i < n; i++) {
      var st = maze.guardStarts[i];
      s.guards.push({
        id: i, type: TYPES[i], x: st.x, y: st.y, dir: i % 2 ? 'right' : 'left',
        wait: Math.max(0, diff.waits[i] - lvlCut), mode: 'normal', scared: false, corner: i % maze.corners.length
      });
    }
    s.fright = 0;
    s.chain = 0;
    s.turn = 0;          // træk på denne bane siden sidste start (styrer Rolig-takten)
    s.status = 'play';
  }
  function cloneState(s) {
    var c = {};
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) c[k] = s[k];
    c.items = s.items.slice();
    c.player = Object.assign({}, s.player);
    c.guards = s.guards.map(function (g) { return Object.assign({}, g); });
    return c;
  }

  // ---------- Hjælpere ----------
  function idx(s, x, y) { return y * s.maze.w + x; }
  function canMoveFrom(s, x, y, dir) { var d = DIRS[dir]; return !!d && s.maze.open(x + d.x, y + d.y); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  // ---------- Vagternes adfærd ----------
  function targetFor(s, g) {
    var p = s.player, maze = s.maze;
    if (g.type === 'jaeger') return { x: p.x, y: p.y };
    if (g.type === 'afskaerer') {
      var d = DIRS[p.dir];
      return { x: Math.max(0, Math.min(maze.w - 1, p.x + d.x * 4)), y: Math.max(0, Math.min(maze.h - 1, p.y + d.y * 4)) };
    }
    if (g.type === 'patrulje') return maze.corners[g.corner];
    // lureren: jager på afstand, men trækker sig tilbage til sit hjørne, når den kommer tæt på
    if (dist2(g.x, g.y, p.x, p.y) > 36) return { x: p.x, y: p.y };
    return maze.corners[(g.id + 2) % maze.corners.length];
  }
  function options(s, g) {
    var opts = ORDER.filter(function (d) { return d !== REVERSE[g.dir] && canMoveFrom(s, g.x, g.y, d); });
    if (!opts.length) opts = ORDER.filter(function (d) { return canMoveFrom(s, g.x, g.y, d); });
    return opts;
  }
  // Hvilken vej vil vagten gå fra (x, y) med retning dir? Rører ikke tilstanden.
  function chooseDir(s, g) {
    if (g.mode === 'eyes') {
      var hm = homeMap(s.maze), best = null, bv = Infinity;
      ORDER.forEach(function (d) {
        if (!canMoveFrom(s, g.x, g.y, d)) return;
        var v = hm[idx(s, g.x + DIRS[d].x, g.y + DIRS[d].y)];
        if (v < bv) { bv = v; best = d; }
      });
      return best;
    }
    var opts = options(s, g);
    if (!opts.length) return null;
    var p = s.player;
    if (g.scared) {
      // Sårbar: vælg den vej, der fører længst væk fra spilleren (luftlinje).
      var far = opts[0], fv = -1;
      opts.forEach(function (d) {
        var v = dist2(g.x + DIRS[d].x, g.y + DIRS[d].y, p.x, p.y);
        if (v > fv) { fv = v; far = d; }
      });
      return far;
    }
    var t = targetFor(s, g);
    var smart = DIFFICULTIES[s.difficulty].smart(s.level) && (g.type === 'jaeger' || g.type === 'afskaerer');
    var dm = smart ? distanceMap(s.maze, t.x, t.y) : null;
    var pick = opts[0], pv = Infinity;
    opts.forEach(function (d) {
      var nx = g.x + DIRS[d].x, ny = g.y + DIRS[d].y;
      var v = dm ? dm[idx(s, nx, ny)] : dist2(nx, ny, t.x, t.y);
      if (dm && v === Infinity) v = 1e6 + dist2(nx, ny, t.x, t.y);
      if (v < pv) { pv = v; pick = d; }
    });
    return pick;
  }
  // Tager vagten et skridt i det næste træk? (venter hjemme, Rolig-takt, sårbare går halvt så hurtigt)
  function stepsNextTurn(s, g) {
    var every = DIFFICULTIES[s.difficulty].every, t = s.turn + 1;
    if (g.mode === 'eyes') return 2;                 // løber hjem med dobbelt fart
    if (g.wait > 0) return 0;
    if (g.scared) return t % (every * 2) === 0 ? 1 : 0;
    return t % every === 0 ? 1 : 0;
  }
  // Vagtens plan for næste træk – besluttet ud fra brættet, som det står nu.
  function planFor(s, g) {
    var n = stepsNextTurn(s, g);
    if (!n) return null;
    var tmp = { id: g.id, type: g.type, x: g.x, y: g.y, dir: g.dir, mode: g.mode, scared: g.scared, corner: g.corner };
    var path = [];
    for (var k = 0; k < n; k++) {
      var d = chooseDir(s, tmp);
      if (!d) break;
      tmp.dir = d; tmp.x += DIRS[d].x; tmp.y += DIRS[d].y;
      path.push({ x: tmp.x, y: tmp.y, dir: d });
      if (tmp.mode === 'eyes' && tmp.x === s.maze.home.x && tmp.y === s.maze.home.y) break;
    }
    return path.length ? { dir: path[0].dir, path: path } : null;
  }
  function applyPlan(s, g, plan) {
    plan.path.forEach(function (p) {
      g.x = p.x; g.y = p.y; g.dir = p.dir;
      if (g.mode === 'eyes' && g.x === s.maze.home.x && g.y === s.maze.home.y) {
        g.mode = 'normal'; g.scared = false; g.wait = 2;
      }
      if (g.type === 'patrulje' && g.mode === 'normal') {
        var c = s.maze.corners[g.corner];
        if (g.x === c.x && g.y === c.y) g.corner = (g.corner + 1) % s.maze.corners.length;
      }
    });
  }

  // Spiller og vagt mødes. Returnerer 'caught', 'eaten' eller null.
  function meet(s, g, events) {
    if (g.mode === 'eyes') return null;
    if (g.scared) {
      var pts = POINTS.guards[Math.min(s.chain, POINTS.guards.length - 1)];
      s.chain++;
      s.score += pts;
      g.mode = 'eyes'; g.scared = false; g.wait = 0;
      events.push({ type: 'guard', id: g.id, points: pts, x: g.x, y: g.y });
      return 'eaten';
    }
    events.push({ type: 'caught', id: g.id, x: s.player.x, y: s.player.y });
    return 'caught';
  }
  function snapshot(s) {
    return {
      player: { x: s.player.x, y: s.player.y, dir: s.player.dir },
      guards: s.guards.map(function (g) { return { id: g.id, x: g.x, y: g.y, mode: g.mode, scared: g.scared, wait: g.wait, dir: g.dir }; }),
      fright: s.fright, score: s.score
    };
  }

  // ---------- Ét træk ----------
  function doMove(s, dir) {
    if (s.status !== 'play' || !DIRS[dir]) return { ignored: true };
    if (!canMoveFrom(s, s.player.x, s.player.y, dir)) return { bump: true, dir: dir };   // væg: intet sker
    var diff = DIFFICULTIES[s.difficulty];
    var ev = [], result = 'ok';
    // 1) Vagterne lægger deres plan ud fra brættet, som det står nu (det er det, der vises).
    var plans = s.guards.map(function (g) { return planFor(s, g); });
    var gPrev = s.guards.map(function (g) { return { x: g.x, y: g.y }; });
    // 2) Spilleren flytter ét felt og spiser.
    var p = s.player, pPrev = { x: p.x, y: p.y };
    p.dir = dir; p.x += DIRS[dir].x; p.y += DIRS[dir].y;
    s.turn++; s.moves++;
    var pellet = false, i = idx(s, p.x, p.y);
    if (s.items[i] === 1) { s.items[i] = 0; s.dotsLeft--; s.score += POINTS.dot; ev.push({ type: 'dot', x: p.x, y: p.y }); }
    else if (s.items[i] === 2) {
      s.items[i] = 0; s.dotsLeft--; s.score += POINTS.pellet; pellet = true;
      s.fright = diff.fright(s.level); s.chain = 0;
      s.guards.forEach(function (g) { if (g.mode !== 'eyes') g.scared = true; });
      ev.push({ type: 'pellet', x: p.x, y: p.y, fright: s.fright });
    }
    // 3) Vagterne tager deres planlagte skridt.
    s.guards.forEach(function (g, k) {
      if (plans[k]) applyPlan(s, g, plans[k]);
      else if (g.wait > 0) g.wait--;
      // efter en kraftpille vender vagterne om (de går væk ad den vej, de kom)
      if (pellet && g.mode !== 'eyes' && g.wait === 0) g.dir = REVERSE[g.dir];
    });
    // 4) Mødes de? Samme felt bagefter, eller de har byttet felt (krydset hinanden).
    var caught = false;
    s.guards.forEach(function (g, k) {
      if (caught) return;
      var same = g.x === p.x && g.y === p.y;
      var crossed = gPrev[k].x === p.x && gPrev[k].y === p.y && g.x === pPrev.x && g.y === pPrev.y;
      // øjne, der løber hjem to felter, kan ikke fange, så kun første felt er relevant for dem
      if ((same || crossed) && meet(s, g, ev) === 'caught') caught = true;
    });
    // 5) Sårbarheden tæller ned for hvert træk (ikke i det træk, hvor pillen blev spist).
    if (!caught && !pellet && s.fright > 0) {
      s.fright--;
      if (s.fright === 0) { s.guards.forEach(function (g) { g.scared = false; }); ev.push({ type: 'frightEnd' }); }
    }
    if (caught) {
      s.lives--;
      s.status = s.lives > 0 ? 'caught' : 'over';
      result = s.status;
    } else if (s.dotsLeft === 0) {
      var bonus = POINTS.level(s.level);
      s.score += bonus;
      s.status = 'cleared';
      result = 'cleared';
      ev.push({ type: 'cleared', bonus: bonus });
    }
    // Vejen hver vagt gik (til animationen): startfeltet og de felter, den gik igennem.
    var paths = gPrev.map(function (g0, k) { return [g0].concat(plans[k] ? plans[k].path : []); });
    return { frames: [snapshot(s)], from: { player: pPrev, guards: gPrev }, paths: paths, events: ev, result: result };
  }

  // ---------- Et helt spil ----------
  var UNDO_PER_LEVEL = 1;
  function createRun(opts) {
    opts = opts || {};
    var s = {
      difficulty: DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'normal',
      level: 1, score: 0, lives: 3, maxLives: 3, cleared: 0, moves: 0
    };
    freshLevelState(s);
    // Fortryd sidste træk: én gang pr. bane, også lige efter man er fanget (et utilsigtet blik
    // på en pil må kunne rettes). Spillet er deterministisk, så en kopi af tilstanden er nok.
    var snap = null, undoLeft = UNDO_PER_LEVEL;

    var api = {
      get state() { return s; },
      get undoLeft() { return undoLeft; },
      canMove: function (dir) { return s.status === 'play' && canMoveFrom(s, s.player.x, s.player.y, dir); },
      move: function (dir) {
        var before = s.status === 'play' ? cloneState(s) : null;
        var r = doMove(s, dir);
        if (before && !r.ignored && !r.bump) snap = before;
        return r;
      },
      canUndo: function () { return !!snap && undoLeft > 0 && s.status !== 'cleared'; },
      undo: function () {
        if (!api.canUndo()) return false;
        s = snap; snap = null; undoLeft--;
        return true;
      },
      // Forhåndsvisning af et træk på en kopi af tilstanden.
      preview: function (dir) {
        if (s.status !== 'play') return null;
        var c = cloneState(s);
        var r = doMove(c, dir);
        if (r.ignored) return null;
        if (r.bump) return { bump: true, dir: dir };
        return {
          path: [{ x: c.player.x, y: c.player.y }],
          guards: c.guards.map(function (g) { return { id: g.id, x: g.x, y: g.y, mode: g.mode, scared: g.scared }; }),
          result: r.result,
          caughtAt: (r.events.filter(function (e) { return e.type === 'caught'; })[0]) || null,
          score: c.score - s.score
        };
      },
      guardPlan: function (g) { return s.status === 'play' ? planFor(s, g) : null; },
      continueAfterCatch: function () {
        if (s.status !== 'caught') return false;
        snap = null;      // efter Fortsæt kan fangsten ikke fortrydes
        placeActors(s);   // prikkerne bliver liggende
        return true;
      },
      nextLevel: function () {
        if (s.status !== 'cleared') return false;
        s.level++; s.cleared++;
        freshLevelState(s);
        snap = null; undoLeft = UNDO_PER_LEVEL;
        return true;
      }
    };
    return api;
  }

  global.LabyrintenGame = {
    DIRS: DIRS, ORDER: ORDER, DIFFICULTIES: DIFFICULTIES, TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, POINTS: POINTS,
    createRun: createRun, loadMaze: loadMaze
  };
})(typeof window !== 'undefined' ? window : globalThis);
