/*
 * Labyrinten – spillets regler uden brugerflade (kan også køres i Node til test).
 *
 *   const run = LabyrintenGame.createRun({ size: 'mellem', difficulty: 'normal' });
 *   run.canMove('left');              // er der en gang den vej?
 *   const r = run.move('left');       // { ignored } eller { frames, events, result }
 *   run.preview('up');                // samme som move, men på en kopi (ændrer intet)
 *   run.continueAfterCatch();         // efter et mistet liv: alle stiller sig på plads
 *   run.nextLevel();                  // efter en ryddet bane
 *
 * Alt er turbaseret og helt forudsigeligt (ingen tilfældighed), så forhåndsvisningen
 * af et træk altid viser præcis, hvad der vil ske.
 *
 * Ét træk: spilleren glider i den valgte retning, indtil der er et kryds, et sving
 * eller en væg (eller en kraftpille er spist). For hvert felt, spilleren glider,
 * tager spøgelserne deres skridt – på Rolig kun ét skridt for hvert andet felt.
 */
(function (global) {
  'use strict';

  var DIRS = {
    up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, right: { x: 1, y: 0 }
  };
  var ORDER = ['up', 'left', 'down', 'right'];   // fast rækkefølge ved lige valg (som i Pac-Man)
  var REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  var SIZES = {
    lille:  { label: 'Lille',  dims: '11 × 11' },
    mellem: { label: 'Mellem', dims: '15 × 13' },
    stor:   { label: 'Stor',   dims: '19 × 15' }
  };

  // Spøgelsernes typer, i den rækkefølge de kommer med.
  var TYPES = ['jager', 'afskaerer', 'vandrer', 'lurer'];
  var TYPE_NAMES = { jager: 'Jægeren', afskaerer: 'Afskæreren', vandrer: 'Vandreren', lurer: 'Lureren' };

  var POINTS = { dot: 10, pellet: 50, ghosts: [200, 400, 800, 1600] };

  /*
   * Sværhedsgrader.
   *   ghosts(level)   antal spøgelser på banen
   *   every           spøgelserne tager ét skridt for hvert 'every' felt, spilleren glider
   *   fright(level)   antal felter, spøgelserne er bange efter en kraftpille
   *   waits           hvor mange felter hvert spøgelse venter hjemme, før det går ud
   *   smart           jægeren og afskæreren finder den korteste vej (i stedet for luftlinje)
   */
  var DIFFICULTIES = {
    rolig: {
      label: 'Rolig', every: 2, smart: false,
      ghosts: function (level) { return Math.min(3, 2 + Math.floor((level - 1) / 2)); },
      fright: function (level) { return Math.max(20, 30 - 2 * (level - 1)); },
      waits: [4, 12, 20, 28]
    },
    normal: {
      label: 'Normal', every: 1, smart: false,
      ghosts: function (level) { return level === 1 ? 3 : 4; },
      fright: function (level) { return Math.max(10, 20 - 2 * (level - 1)); },
      waits: [2, 6, 10, 14]
    },
    svaer: {
      label: 'Svær', every: 1, smart: true,
      ghosts: function () { return 4; },
      fright: function (level) { return Math.max(6, 12 - (level - 1)); },
      waits: [0, 2, 4, 6]
    }
  };

  // ---------- Labyrint ----------
  var mazeCache = {};
  function loadMaze(size, index) {
    var list = global.LabyrintenMazes[size];
    var def = list[index % list.length];
    var key = size + ':' + (index % list.length);
    if (mazeCache[key]) return mazeCache[key];
    var rows = def.rows, h = rows.length, w = rows[0].length;
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
    var maze = { name: def.navn, index: index % list.length, w: w, h: h, walls: walls, items: items, start: start, home: home };
    maze.open = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && !walls[y * w + x]; };
    // Hjørnemål til vandreren: kraftpillerne med uret fra øverst til venstre.
    var cx = (w - 1) / 2, cy = (h - 1) / 2;
    pellets.sort(function (a, b) { return angle(a) - angle(b); });
    function angle(p) { return (Math.atan2(p.y - cy, p.x - cx) + Math.PI * 2 + Math.PI * 0.75) % (Math.PI * 2); }
    maze.corners = pellets.length >= 2 ? pellets : [{ x: 1, y: 1 }, { x: w - 2, y: 1 }, { x: w - 2, y: h - 2 }, { x: 1, y: h - 2 }];
    // Startfelter til spøgelserne: hjemmet og de nærmeste gange omkring det (bredde-først).
    maze.ghostStarts = bfsOrder(maze, home, 4);
    mazeCache[key] = maze;
    return maze;
  }
  function bfsOrder(maze, from, n) {
    var out = [from], seen = {}, q = [from];
    seen[from.x + ',' + from.y] = true;
    while (q.length && out.length < n) {
      var p = q.shift();
      // vandret først, så spøgelserne står på række ved siden af hjemmet
      ['left', 'right', 'up', 'down'].forEach(function (d) {
        var nx = p.x + DIRS[d].x, ny = p.y + DIRS[d].y, k = nx + ',' + ny;
        if (maze.open(nx, ny) && !seen[k]) { seen[k] = true; q.push({ x: nx, y: ny }); if (out.length < n) out.push({ x: nx, y: ny }); }
      });
    }
    while (out.length < n) out.push(from);
    return out;
  }
  // Afstande (antal skridt) fra et felt til alle andre – bruges til "klog" jagt og til at finde hjem.
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
    var maze = loadMaze(s.size, s.level - 1);
    s.maze = maze;
    s.items = maze.items.slice();
    s.dotsLeft = s.items.filter(function (v) { return v > 0; }).length;
    s.dotsTotal = s.dotsLeft;
    placeActors(s);
  }
  function placeActors(s) {
    var maze = s.maze, diff = DIFFICULTIES[s.difficulty];
    var n = diff.ghosts(s.level), lvlCut = Math.min(s.level - 1, 3);
    s.player = { x: maze.start.x, y: maze.start.y, dir: 'left' };
    s.ghosts = [];
    for (var i = 0; i < n; i++) {
      var st = maze.ghostStarts[i];
      s.ghosts.push({
        id: i, type: TYPES[i], x: st.x, y: st.y, dir: i % 2 ? 'right' : 'left',
        wait: Math.max(0, diff.waits[i] - lvlCut), mode: 'normal', scared: false, corner: i % maze.corners.length
      });
    }
    s.fright = 0;
    s.chain = 0;
    s.tick = 0;
    s.status = 'play';
  }
  function cloneState(s) {
    var c = {};
    for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) c[k] = s[k];
    c.items = s.items.slice();
    c.player = Object.assign({}, s.player);
    c.ghosts = s.ghosts.map(function (g) { return Object.assign({}, g); });
    return c;
  }

  // ---------- Hjælpere ----------
  function idx(s, x, y) { return y * s.maze.w + x; }
  function canMoveFrom(s, x, y, dir) { var d = DIRS[dir]; return !!d && s.maze.open(x + d.x, y + d.y); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function snapshot(s, extra) {
    var f = {
      player: { x: s.player.x, y: s.player.y, dir: s.player.dir },
      ghosts: s.ghosts.map(function (g) { return { id: g.id, x: g.x, y: g.y, mode: g.mode, scared: g.scared, wait: g.wait, dir: g.dir }; }),
      fright: s.fright, score: s.score, events: []
    };
    return Object.assign(f, extra || {});
  }

  // Spilleren skal stoppe her, hvis der er et sving eller kryds, eller hvis vejen ligeud er lukket.
  function shouldStop(s) {
    var p = s.player, d = p.dir;
    if (!canMoveFrom(s, p.x, p.y, d)) return true;
    var sides = (d === 'up' || d === 'down') ? ['left', 'right'] : ['up', 'down'];
    return canMoveFrom(s, p.x, p.y, sides[0]) || canMoveFrom(s, p.x, p.y, sides[1]);
  }

  // ---------- Spøgelsernes adfærd ----------
  function targetFor(s, g) {
    var p = s.player, maze = s.maze;
    var small = s.size === 'lille';
    if (g.type === 'jager') return { x: p.x, y: p.y };
    if (g.type === 'afskaerer') {
      var ahead = small ? 2 : 4, d = DIRS[p.dir];
      return { x: Math.max(0, Math.min(maze.w - 1, p.x + d.x * ahead)), y: Math.max(0, Math.min(maze.h - 1, p.y + d.y * ahead)) };
    }
    if (g.type === 'vandrer') return maze.corners[g.corner];
    // lureren: jager på afstand, men trækker sig tilbage til sit hjørne, når den kommer tæt på
    var near = small ? 4 : 6;
    if (dist2(g.x, g.y, p.x, p.y) > near * near) return { x: p.x, y: p.y };
    return maze.corners[(g.id + 2) % maze.corners.length];
  }
  function options(s, g) {
    var opts = ORDER.filter(function (d) { return d !== REVERSE[g.dir] && canMoveFrom(s, g.x, g.y, d); });
    if (!opts.length) opts = ORDER.filter(function (d) { return canMoveFrom(s, g.x, g.y, d); });
    return opts;
  }
  // Hvilken vej vil spøgelset gå nu? (Rører ikke tilstanden – bruges også til pilene på skærmen.)
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
      // Bange: vælg den vej, der fører længst væk fra spilleren (luftlinje).
      var far = opts[0], fv = -1;
      opts.forEach(function (d) {
        var v = dist2(g.x + DIRS[d].x, g.y + DIRS[d].y, p.x, p.y);
        if (v > fv) { fv = v; far = d; }
      });
      return far;
    }
    var t = targetFor(s, g);
    var smart = DIFFICULTIES[s.difficulty].smart && (g.type === 'jager' || g.type === 'afskaerer');
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
  function stepGhost(s, g) {
    var d = chooseDir(s, g);
    if (!d) return;
    g.dir = d;
    g.x += DIRS[d].x; g.y += DIRS[d].y;
    if (g.mode === 'eyes' && g.x === s.maze.home.x && g.y === s.maze.home.y) {
      g.mode = 'normal'; g.scared = false; g.wait = 2;
    }
    if (g.type === 'vandrer' && g.mode === 'normal') {
      var c = s.maze.corners[g.corner];
      if (g.x === c.x && g.y === c.y) g.corner = (g.corner + 1) % s.maze.corners.length;
    }
  }

  // Spiller og spøgelse mødes. Returnerer 'caught', 'eaten' eller null.
  function meet(s, g, events) {
    if (g.mode === 'eyes') return null;
    if (g.scared) {
      var pts = POINTS.ghosts[Math.min(s.chain, POINTS.ghosts.length - 1)];
      s.chain++;
      s.score += pts;
      g.mode = 'eyes'; g.scared = false; g.wait = 0;
      events.push({ type: 'ghost', id: g.id, points: pts, x: g.x, y: g.y });
      return 'eaten';
    }
    events.push({ type: 'caught', id: g.id, x: s.player.x, y: s.player.y });
    return 'caught';
  }

  // ---------- Ét træk ----------
  function doMove(s, dir) {
    if (s.status !== 'play' || !DIRS[dir] || !canMoveFrom(s, s.player.x, s.player.y, dir)) return { ignored: true };
    var diff = DIFFICULTIES[s.difficulty];
    var frames = [], allEvents = [], result = 'ok';
    var p = s.player;
    p.dir = dir;
    var guard = s.maze.w * s.maze.h;
    while (guard-- > 0) {
      var ev = [];
      var pPrev = { x: p.x, y: p.y };
      p.x += DIRS[dir].x; p.y += DIRS[dir].y;
      s.tick++;
      var ate = false, pellet = false;
      var i = idx(s, p.x, p.y);
      if (s.items[i] === 1) { s.items[i] = 0; s.dotsLeft--; s.score += POINTS.dot; ate = true; ev.push({ type: 'dot', x: p.x, y: p.y }); }
      else if (s.items[i] === 2) {
        s.items[i] = 0; s.dotsLeft--; s.score += POINTS.pellet; pellet = true;
        s.fright = diff.fright(s.level); s.chain = 0;
        s.ghosts.forEach(function (g) { if (g.mode !== 'eyes') { g.scared = true; if (g.wait === 0) g.dir = REVERSE[g.dir]; } });
        ev.push({ type: 'pellet', x: p.x, y: p.y, fright: s.fright });
      }
      // 1) Går spilleren ind i et spøgelse?
      var caught = false;
      s.ghosts.forEach(function (g) {
        if (!caught && g.x === p.x && g.y === p.y && meet(s, g, ev) === 'caught') caught = true;
      });
      if (!caught && s.dotsLeft === 0) {
        result = 'cleared';
        ev.push({ type: 'cleared' });
        frames.push(snapshot(s, { events: ev }));
        allEvents = allEvents.concat(ev);
        break;
      }
      // 2) Spøgelserne tager deres skridt
      if (!caught) {
        s.ghosts.forEach(function (g) {
          if (caught) return;
          var steps;
          if (g.mode === 'eyes') steps = 2;
          else if (g.wait > 0) { g.wait--; steps = 0; }
          else if (g.scared) steps = (s.tick % (diff.every * 2) === 0) ? 1 : 0;   // bange spøgelser er langsommere
          else steps = (s.tick % diff.every === 0) ? 1 : 0;
          for (var k = 0; k < steps && !caught; k++) {
            var gPrev = { x: g.x, y: g.y };
            stepGhost(s, g);
            var same = g.x === p.x && g.y === p.y;
            var crossed = gPrev.x === p.x && gPrev.y === p.y && g.x === pPrev.x && g.y === pPrev.y;
            if (same || crossed) { if (meet(s, g, ev) === 'caught') caught = true; }
          }
        });
      }
      // 3) Bange-tælleren tæller ned for hvert felt (ikke i det felt, hvor pillen blev spist)
      if (!caught && !pellet && s.fright > 0) {
        s.fright--;
        if (s.fright === 0) { s.ghosts.forEach(function (g) { g.scared = false; }); ev.push({ type: 'frightEnd' }); }
      }
      if (caught) {
        s.lives--;
        s.status = s.lives > 0 ? 'caught' : 'over';
        result = s.status;
      }
      frames.push(snapshot(s, { events: ev, ate: ate }));
      allEvents = allEvents.concat(ev);
      if (caught || pellet || shouldStop(s)) break;
    }
    if (result === 'cleared') s.status = 'cleared';
    s.moves++;
    return { frames: frames, events: allEvents, result: result };
  }

  // ---------- Et helt spil ----------
  function createRun(opts) {
    opts = opts || {};
    var s = {
      size: SIZES[opts.size] ? opts.size : 'mellem',
      difficulty: DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'normal',
      level: 1, score: 0, lives: opts.lives || 3, maxLives: opts.lives || 3, cleared: 0, moves: 0
    };
    freshLevelState(s);

    var api = {
      get state() { return s; },
      canMove: function (dir) { return s.status === 'play' && canMoveFrom(s, s.player.x, s.player.y, dir); },
      move: function (dir) { return doMove(s, dir); },
      // Forhåndsvisning af et træk på en kopi af tilstanden.
      preview: function (dir) {
        var c = cloneState(s);
        var r = doMove(c, dir);
        if (r.ignored) return null;
        return {
          path: r.frames.map(function (f) { return { x: f.player.x, y: f.player.y }; }),
          ghosts: c.ghosts.map(function (g) { return { id: g.id, x: g.x, y: g.y, mode: g.mode, scared: g.scared }; }),
          result: r.result,
          caughtAt: (r.events.filter(function (e) { return e.type === 'caught'; })[0]) || null,
          score: c.score - s.score
        };
      },
      ghostIntent: function (g) { return (g.wait > 0) ? null : chooseDir(s, g); },
      continueAfterCatch: function () {
        if (s.status !== 'caught') return false;
        placeActors(s);   // prikkerne bliver liggende
        return true;
      },
      nextLevel: function () {
        if (s.status !== 'cleared') return false;
        s.level++; s.cleared++;
        freshLevelState(s);
        return true;
      }
    };
    return api;
  }

  global.LabyrintenGame = {
    DIRS: DIRS, ORDER: ORDER, SIZES: SIZES, DIFFICULTIES: DIFFICULTIES, TYPES: TYPES, TYPE_NAMES: TYPE_NAMES, POINTS: POINTS,
    createRun: createRun, loadMaze: loadMaze
  };
})(typeof window !== 'undefined' ? window : globalThis);
