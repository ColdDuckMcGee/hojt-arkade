/*
 * Bomberne – spillogik (ingen DOM). Turbaseret: intet sker, før spilleren
 * vælger én handling (gå, læg bombe eller vent). Derefter flytter fjenderne
 * ét felt, og bomberne tæller ned. Der er ingen ure eller tidsgrænser.
 *
 * Brættet er et gitter med en kant af faste søjler og en søjle på hvert andet
 * felt indeni. Kasser kan sprænges og kan gemme bonusser og udgangen.
 *
 * Rækkefølge i en tur:
 *   1. Spillerens handling (går man ind på den åbne udgang, er banen klaret).
 *   2. Fjenderne udfører det træk, de viste (pilen). Er feltet spærret, venter de.
 *   3. Bomberne tæller ned. En bombe med 0 springer, og flammer kan udløse andre bomber.
 *   4. Fjenderne planlægger deres næste træk, så det kan vises som en pil.
 */
(function (global) {
  'use strict';

  // Brætstørrelser inkl. kanten af søjler (kanten tegnes som en tynd ramme).
  var SIZES = {
    '9x9':   { id: '9x9',   cols: 9,  rows: 9,  label: '9 × 9',   name: 'Lille',  baseEnemies: 2, maxEnemies: 5 },
    '11x9':  { id: '11x9',  cols: 11, rows: 9,  label: '11 × 9',  name: 'Mellem', baseEnemies: 3, maxEnemies: 7 },
    '13x11': { id: '13x11', cols: 13, rows: 11, label: '13 × 11', name: 'Stor',   baseEnemies: 4, maxEnemies: 9 }
  };
  var RULES = {
    fuse: 3,            // bomben springer efter 3 ture (tallet står på bomben)
    startRange: 2,      // flammens rækkevidde fra start
    maxRange: 6,
    startBombs: 1,      // bomber ad gangen fra start
    maxBombs: 4,
    lives: 3,           // man har altid tre liv fra start
    maxLives: 5,        // ekstra liv fra bonusser kan give op til fem
    points: { wander: 100, slow: 100, chaser: 200 },
    pointsCrate: 10,
    pointsPickup: 50,
    levelBonus: 100,    // bonus for klaret bane: 100 × banens nummer
    minSpawnDist: 5,    // ingen fjende starter tættere end 5 skridt på spilleren
    undoPerLevel: 1
  };
  var DIRS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
  var DIR_LIST = ['up', 'right', 'down', 'left'];
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var FLOOR = 0, PILLAR = 1, CRATE = 2;
  var ENEMY_TYPES = ['wander', 'chaser', 'slow'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Antal fjender og deres typer på bane `level`.
  function enemiesFor(sizeId, level) {
    var s = SIZES[sizeId];
    var count = Math.min(s.maxEnemies, s.baseEnemies + (level - 1));
    var chasers = Math.min(Math.floor(level / 2), Math.floor(count / 2));
    var slow = Math.max(1, Math.round((count - chasers) * 0.35));
    var wander = Math.max(0, count - chasers - slow);
    return { count: count, wander: wander, chaser: chasers, slow: slow };
  }
  function crateDensity(level) { return Math.min(0.62, 0.38 + 0.03 * (level - 1)); }
  function levelBonus(level) { return RULES.levelBonus * level; }

  function createRun(sizeId, opts) {
    var rng = (opts && opts.rng) || Math.random;
    var size = SIZES[sizeId];
    var cols = size.cols, rows = size.rows, N = cols * rows;
    var s = {
      sizeId: sizeId, cols: cols, rows: rows, level: 0,
      tiles: [], items: [], bombs: [], enemies: [],
      player: { x: 1, y: 1 }, start: { x: 1, y: 1 },
      range: RULES.startRange, maxBombs: RULES.startBombs, lives: RULES.lives,
      score: 0, levelsCleared: 0, turn: 0, nextId: 1,
      undoLeft: RULES.undoPerLevel, dead: false, deathCause: null,
      over: false, cleared: false
    };
    var snap = null;   // tilstanden før sidste træk (til Fortryd)

    function idx(x, y) { return y * cols + x; }
    function inside(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows; }
    function tileAt(x, y) { return inside(x, y) ? s.tiles[idx(x, y)] : PILLAR; }
    function bombAt(x, y) { for (var i = 0; i < s.bombs.length; i++) if (s.bombs[i].x === x && s.bombs[i].y === y) return s.bombs[i]; return null; }
    function enemyAt(x, y, except) { for (var i = 0; i < s.enemies.length; i++) { var e = s.enemies[i]; if (e !== except && e.x === x && e.y === y) return e; } return null; }
    function dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var r = Math.floor(rng() * (k + 1)); var t = a[k]; a[k] = a[r]; a[r] = t; } return a; }
    function enemyCanEnter(x, y) { return tileAt(x, y) === FLOOR && !bombAt(x, y); }

    // ---------- Ny bane ----------
    function safeCells() {
      // Startfeltet og en L-formet flugtvej, så første bombe altid kan undviges.
      var st = s.start;
      return [[0, 0], [1, 0], [0, 1], [0, 2], [1, 2]].map(function (d) { return idx(st.x + d[0], st.y + d[1]); });
    }
    function buildLevel(level) {
      s.level = level;
      s.tiles = []; s.items = []; s.bombs = []; s.enemies = [];
      s.player = { x: s.start.x, y: s.start.y };
      s.undoLeft = RULES.undoPerLevel; snap = null;
      s.dead = false; s.deathCause = null; s.cleared = false; s.over = false;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var wall = x === 0 || y === 0 || x === cols - 1 || y === rows - 1 || (x % 2 === 0 && y % 2 === 0);
        s.tiles.push(wall ? PILLAR : FLOOR);
        s.items.push(null);
      }
      var safe = safeCells();
      var dens = crateDensity(level);
      for (var i = 0; i < N; i++) {
        if (s.tiles[i] !== FLOOR || safe.indexOf(i) >= 0) continue;
        if (rng() < dens) s.tiles[i] = CRATE;
      }
      // Fjender: på frie felter langt fra start.
      var plan = enemiesFor(sizeId, level);
      var types = [];
      for (var a = 0; a < plan.slow; a++) types.push('slow');
      for (var b = 0; b < plan.wander; b++) types.push('wander');
      for (var c = 0; c < plan.chaser; c++) types.push('chaser');
      var spots = spawnSpots(types.length, true);
      types.forEach(function (t, k) {
        var p = spots[k];
        s.enemies.push({ id: s.nextId++, type: t, x: p.x, y: p.y, dir: null, plan: null, rest: k % 2 === 1 });
      });
      s.enemies.forEach(function (e) { e.dir = firstDir(e); });
      // Udgang og bonusser under kasser (udgangen helst langt fra start).
      var crates = [];
      for (var j = 0; j < N; j++) if (s.tiles[j] === CRATE) crates.push(j);
      var need = 3;
      if (crates.length < need + 1) { // nødløsning: læg flere kasser
        for (var q = 0; q < N && crates.length < need + 1; q++) {
          if (s.tiles[q] === FLOOR && safe.indexOf(q) < 0 && !enemyAt(q % cols, Math.floor(q / cols))) { s.tiles[q] = CRATE; crates.push(q); }
        }
      }
      crates.sort(function (m, n) { return dist(pos(n), s.start) - dist(pos(m), s.start); });
      var far = crates.slice(0, Math.max(1, Math.ceil(crates.length / 2)));
      var door = far[Math.floor(rng() * far.length)];
      s.items[door] = 'door';
      var rest = shuffle(crates.filter(function (k) { return k !== door; }));
      var bonuses = ['range', 'bomb'];
      if (level >= 2 && rng() < 0.25) bonuses.push('life');
      if (level >= 3 && rng() < 0.5) bonuses.push('range');
      bonuses.forEach(function (it, k) { if (rest[k] !== undefined) s.items[rest[k]] = it; });
      planEnemies();
    }
    function pos(i) { return { x: i % cols, y: Math.floor(i / cols) }; }
    // Frie felter mindst minSpawnDist fra start, spredt ud. Mangler der plads,
    // fjernes kasser (uden noget under) langt fra start.
    function spawnSpots(n, allowClear) {
      var cand = [];
      for (var i = 0; i < N; i++) {
        var p = pos(i);
        if (s.tiles[i] === FLOOR && dist(p, s.start) >= RULES.minSpawnDist && !enemyAt(p.x, p.y) && !bombAt(p.x, p.y) && !(p.x === s.player.x && p.y === s.player.y)) cand.push(p);
      }
      if (cand.length < n && allowClear) {
        for (var k = N - 1; k >= 0 && cand.length < n; k--) {
          var pk = pos(k);
          if (s.tiles[k] === CRATE && !s.items[k] && dist(pk, s.start) >= RULES.minSpawnDist) { s.tiles[k] = FLOOR; cand.push(pk); }
        }
      }
      shuffle(cand);
      // Spred fjenderne: vælg grådigt det felt, der er længst fra de valgte.
      var out = [];
      while (out.length < n && cand.length) {
        if (!out.length) { out.push(cand.shift()); continue; }
        var best = 0, bestD = -1;
        cand.forEach(function (c, ci) {
          var d = Math.min.apply(null, out.map(function (o) { return dist(o, c); }));
          if (d > bestD) { bestD = d; best = ci; }
        });
        out.push(cand.splice(best, 1)[0]);
      }
      while (out.length < n) { // yderste nødløsning: det fjerneste frie felt
        var far = null, fd = -1;
        for (var z = 0; z < N; z++) { var pz = pos(z); if (s.tiles[z] === FLOOR && dist(pz, s.start) > fd && !out.some(function (o) { return o.x === pz.x && o.y === pz.y; })) { fd = dist(pz, s.start); far = pz; } }
        out.push(far);
      }
      return out;
    }
    function openDirs(e) { return DIR_LIST.filter(function (d) { return enemyCanEnter(e.x + DIRS[d].x, e.y + DIRS[d].y); }); }
    function firstDir(e) {
      var open = openDirs(e);
      if (e.type === 'slow') { // den akse med længst fri strækning
        var best = null, bestLen = -1;
        open.forEach(function (d) {
          var len = 0, x = e.x, y = e.y;
          while (enemyCanEnter(x + DIRS[d].x, y + DIRS[d].y) && len < 20) { x += DIRS[d].x; y += DIRS[d].y; len++; }
          if (len > bestLen) { bestLen = len; best = d; }
        });
        return best || 'right';
      }
      return open.length ? open[Math.floor(rng() * open.length)] : 'right';
    }

    // ---------- Fjendernes planer (vises som pile) ----------
    function bfsStep(e, danger) {
      var target = idx(s.player.x, s.player.y), startI = idx(e.x, e.y);
      var prev = {}; prev[startI] = -1;
      var q = [startI];
      for (var qi = 0; qi < q.length; qi++) {
        var c = q[qi];
        if (c === target) break;
        var cp = pos(c);
        for (var di = 0; di < 4; di++) {
          var d = DIRS[DIR_LIST[di]], nx = cp.x + d.x, ny = cp.y + d.y, ni = idx(nx, ny);
          if (prev[ni] !== undefined) continue;
          if (!(enemyCanEnter(nx, ny) || ni === target)) continue;
          prev[ni] = c; q.push(ni);
        }
      }
      if (prev[target] === undefined) return null;
      var step = target;
      while (prev[step] !== startI) step = prev[step];
      var sp = pos(step);
      var dir = DIR_LIST.filter(function (dn) { return e.x + DIRS[dn].x === sp.x && e.y + DIRS[dn].y === sp.y; })[0];
      if (danger[step] === 1) return 'wait'; // går ikke ind i en flamme, der kommer i næste tur
      return dir;
    }
    function wanderPlan(e) {
      var open = openDirs(e);
      if (!open.length) return null;
      var fwd = e.dir && open.indexOf(e.dir) >= 0;
      var side = open.filter(function (d) { return d !== e.dir && d !== OPPOSITE[e.dir]; });
      if (fwd && !(side.length && rng() < 0.25)) return e.dir; // ligeud, af og til et sving
      if (side.length) return side[Math.floor(rng() * side.length)];
      if (fwd) return e.dir;
      return open[0];
    }
    function slowPlan(e) {
      if (e.rest) return null;               // hviler hver anden tur
      if (enemyCanEnter(e.x + DIRS[e.dir].x, e.y + DIRS[e.dir].y)) return e.dir;
      var back = OPPOSITE[e.dir];             // frem og tilbage
      if (enemyCanEnter(e.x + DIRS[back].x, e.y + DIRS[back].y)) return back;
      var open = openDirs(e);
      return open.length ? open[0] : null;
    }
    function planEnemies() {
      var danger = dangerMap();
      s.enemies.forEach(function (e) {
        var p = null;
        if (e.type === 'chaser') {
          p = bfsStep(e, danger);
          if (p === null) p = wanderPlan(e);
          if (p === 'wait') p = null;
        } else if (e.type === 'slow') p = slowPlan(e);
        else p = wanderPlan(e);
        e.plan = p;
      });
    }

    // ---------- Flammer og fare ----------
    function flameCells(b, range) {
      var cells = [idx(b.x, b.y)];
      DIR_LIST.forEach(function (dn) {
        var d = DIRS[dn];
        for (var k = 1; k <= range; k++) {
          var x = b.x + d.x * k, y = b.y + d.y * k, t = tileAt(x, y);
          if (t === PILLAR) break;
          cells.push(idx(x, y));
          if (t === CRATE) break;
          if (bombAt(x, y)) break; // flammen udløser bomben og stopper der
        }
      });
      return cells;
    }
    // Kort: felt -> antal ture til flammen kommer (1 = i næste tur). 0 = ingen fare.
    function dangerMap() {
      var eff = s.bombs.map(function (b) { return b.timer; });
      var cellsOf = s.bombs.map(function (b) { return flameCells(b, b.range); });
      var changed = true, guard = 0;
      while (changed && guard++ < 50) {
        changed = false;
        s.bombs.forEach(function (b, i) {
          s.bombs.forEach(function (c, j) {
            if (i === j || eff[j] <= eff[i]) return;
            if (cellsOf[i].indexOf(idx(c.x, c.y)) >= 0) { eff[j] = eff[i]; changed = true; }
          });
        });
      }
      var map = new Array(N).fill(0);
      cellsOf.forEach(function (cells, i) {
        cells.forEach(function (c) { if (!map[c] || eff[i] < map[c]) map[c] = eff[i]; });
      });
      return map;
    }

    // ---------- Spillerens muligheder ----------
    function canMove(dir) {
      if (!playable()) return false;
      var d = DIRS[dir]; if (!d) return false;
      var x = s.player.x + d.x, y = s.player.y + d.y;
      return tileAt(x, y) === FLOOR && !bombAt(x, y) && !enemyAt(x, y);
    }
    function blockedBy(dir) {
      var d = DIRS[dir], x = s.player.x + d.x, y = s.player.y + d.y, t = tileAt(x, y);
      if (t === PILLAR) return 'søjle';
      if (t === CRATE) return 'kasse';
      if (bombAt(x, y)) return 'bombe';
      if (enemyAt(x, y)) return 'fjende';
      return null;
    }
    function canBomb() { return playable() && s.bombs.length < s.maxBombs && !bombAt(s.player.x, s.player.y); }
    function playable() { return !s.dead && !s.over && !s.cleared; }
    function doorOpen() { return s.enemies.length === 0; }
    function onOpenDoor() { var i = idx(s.player.x, s.player.y); return s.items[i] === 'door' && s.tiles[i] === FLOOR && doorOpen(); }

    // ---------- Én tur ----------
    // action: 'up' | 'down' | 'left' | 'right' | 'bomb' | 'wait'
    function act(action) {
      var ev = { ignored: false, events: [], flames: [], crates: [], killed: [], moved: [], pickup: null, points: 0 };
      if (!playable()) { ev.ignored = true; return ev; }
      if (DIRS[action] && !canMove(action)) { ev.ignored = true; return ev; }
      if (action === 'bomb' && !canBomb()) { ev.ignored = true; return ev; }
      if (!DIRS[action] && action !== 'bomb' && action !== 'wait') { ev.ignored = true; return ev; }
      var before = clone(s);

      // 1. spilleren
      if (DIRS[action]) {
        s.player.x += DIRS[action].x; s.player.y += DIRS[action].y;
        ev.events.push('step');
        var pi = idx(s.player.x, s.player.y), it = s.items[pi];
        if (it && it !== 'door') {
          s.items[pi] = null; ev.pickup = it; ev.events.push('pickup');
          if (it === 'range' && s.range < RULES.maxRange) s.range++;
          else if (it === 'bomb' && s.maxBombs < RULES.maxBombs) s.maxBombs++;
          else if (it === 'life' && s.lives < RULES.maxLives) s.lives++;
          s.score += RULES.pointsPickup; ev.points += RULES.pointsPickup;
        }
        if (onOpenDoor()) return finishLevel(ev, before);
      } else if (action === 'bomb') {
        s.bombs.push({ x: s.player.x, y: s.player.y, timer: RULES.fuse, range: s.range, fresh: true });
        ev.events.push('bomb');
      } else ev.events.push('wait');

      // 2. fjenderne udfører deres viste træk
      s.enemies.forEach(function (e) {
        var p = e.plan;
        if (e.type === 'slow') e.rest = !e.rest;
        if (!p) return;
        var nx = e.x + DIRS[p].x, ny = e.y + DIRS[p].y;
        if (!enemyCanEnter(nx, ny) || enemyAt(nx, ny, e)) return; // spærret: venter
        ev.moved.push({ id: e.id, from: { x: e.x, y: e.y }, to: { x: nx, y: ny } });
        e.x = nx; e.y = ny; e.dir = p;
      });
      if (enemyAt(s.player.x, s.player.y)) { s.dead = true; s.deathCause = 'enemy'; }

      // 3. bomberne tæller ned og springer (kædereaktioner)
      s.bombs.forEach(function (b) { if (b.fresh) b.fresh = false; else b.timer--; });
      if (s.bombs.length) ev.events.push('tick');
      var queue = s.bombs.filter(function (b) { return b.timer <= 0; });
      if (queue.length) {
        var exploded = [], flames = {};
        while (queue.length) {
          var b = queue.shift();
          if (exploded.indexOf(b) >= 0) continue;
          exploded.push(b);
          flameCells(b, b.range).forEach(function (c) {
            flames[c] = true;
            var other = bombAt(c % cols, Math.floor(c / cols));
            if (other && exploded.indexOf(other) < 0 && queue.indexOf(other) < 0) queue.push(other);
          });
        }
        s.bombs = s.bombs.filter(function (b2) { return exploded.indexOf(b2) < 0; });
        ev.flames = Object.keys(flames).map(Number);
        ev.bombsExploded = exploded.length;
        ev.events.push('explode');
        if (exploded.length > 1) ev.events.push('chain');
        ev.flames.forEach(function (c) {
          if (s.tiles[c] === CRATE) {
            s.tiles[c] = FLOOR; ev.crates.push(c);
            s.score += RULES.pointsCrate; ev.points += RULES.pointsCrate;
          }
        });
        s.enemies = s.enemies.filter(function (e) {
          if (!flames[idx(e.x, e.y)]) return true;
          ev.killed.push({ id: e.id, type: e.type, x: e.x, y: e.y });
          s.score += RULES.points[e.type]; ev.points += RULES.points[e.type];
          return false;
        });
        if (ev.killed.length) ev.events.push('enemyKilled');
        if (flames[idx(s.player.x, s.player.y)] && !s.dead) { s.dead = true; s.deathCause = 'flame'; }
        if (ev.killed.length && !s.enemies.length) ev.events.push('doorOpen');
      }

      s.turn++;
      snap = before;
      if (s.dead) {
        s.lives--;
        ev.events.push('died');
        if (s.lives <= 0) { s.over = true; ev.events.push('over'); }
        return ev;
      }
      if (onOpenDoor()) return finishLevel(ev, before);
      planEnemies();
      return ev;
    }
    function finishLevel(ev, before) {
      var bonus = levelBonus(s.level);
      s.score += bonus; s.cleared = true; s.levelsCleared++;
      s.turn++;
      snap = null; // en klaret bane kan ikke fortrydes
      ev.events.push('cleared'); ev.bonus = bonus;
      return ev;
    }

    // Efter et mistet liv: tilbage på startfeltet, bomberne fjernes, og fjender
    // tæt på start flyttes væk. Kasser, bonusser og point bevares.
    function respawn() {
      if (!s.dead || s.over) return false;
      s.dead = false; s.deathCause = null;
      s.bombs = [];
      s.player = { x: s.start.x, y: s.start.y };
      var near = s.enemies.filter(function (e) { return dist(e, s.start) < RULES.minSpawnDist; });
      near.forEach(function (e) { e.x = -9; e.y = -9; });
      var spots = spawnSpots(near.length, true);
      near.forEach(function (e, k) { e.x = spots[k].x; e.y = spots[k].y; e.dir = firstDir(e); });
      planEnemies();
      return true;
    }

    function canUndo() { return !!snap && s.undoLeft > 0 && !s.cleared; }
    function undo() {
      if (!canUndo()) return false;
      var left = s.undoLeft - 1;
      s = snap; snap = null;
      s.undoLeft = left;
      api.state = s;
      return true;
    }
    function nextLevel() {
      buildLevel(s.level + 1);
      return s;
    }

    buildLevel((opts && opts.level) || 1);

    var api = {
      state: s, act: act, canMove: canMove, canBomb: canBomb, blockedBy: blockedBy, respawn: respawn,
      undo: undo, canUndo: canUndo, nextLevel: nextLevel, danger: function () { return dangerMap(); },
      doorOpen: doorOpen, playable: playable, flameCells: function (b) { return flameCells(b, b.range); },
      idx: idx, _setState: function (ns) { s = ns; api.state = s; snap = null; }, _plan: planEnemies
    };
    return api;
  }

  global.BomberneGame = {
    SIZES: SIZES, RULES: RULES, DIRS: DIRS, FLOOR: FLOOR, PILLAR: PILLAR, CRATE: CRATE, ENEMY_TYPES: ENEMY_TYPES,
    enemiesFor: enemiesFor, levelBonus: levelBonus, crateDensity: crateDensity, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
