/*
 * Slangen – spillogik (ingen DOM). Turbaseret: slangen flytter sig kun,
 * når step() kaldes. Der er ingen ure eller tidsgrænser.
 */
(function (global) {
  'use strict';

  var DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  var RULES = {
    startLength: 3,
    foodPoints: 10,
    bonusPoints: 50,
    bonusMoves: 15,     // bonusmad forsvinder efter så mange træk
    bonusEvery: 3,      // ny bonusmad efter hver 3. almindelige mad
    obstacleEvery: 5,   // én ny forhindring for hver 5. mad
    undoPerGame: 3      // fortryd sidste træk: så mange gange pr. spil (et utilsigtet blik må kunne rettes)
  };

  function createGame(size, opts) {
    var rng = (opts && opts.rng) || Math.random;
    var s = {
      size: size, snake: [], dir: 'right', food: null, bonus: null, obstacles: [],
      score: 0, foodEaten: 0, bonusEaten: 0, moves: 0,
      over: false, won: false, reason: null, crash: null,
      undoLeft: RULES.undoPerGame
    };
    var prev = null;   // tilstanden før sidste træk (til fortryd)
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    var key = function (x, y) { return y * size + x; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x < size && y < size; };

    var mid = Math.floor(size / 2);
    var hx = Math.max(RULES.startLength - 1, Math.floor(size / 2) - 1);
    for (var i = 0; i < RULES.startLength; i++) s.snake.push({ x: hx - i, y: mid });

    function obstacleSet(extra) {
      var set = new Set();
      s.obstacles.forEach(function (o) { set.add(key(o.x, o.y)); });
      if (extra) set.add(key(extra.x, extra.y));
      return set;
    }
    function snakeSet(withoutTail) {
      var set = new Set();
      var n = withoutTail ? s.snake.length - 1 : s.snake.length;
      for (var i = 0; i < n; i++) set.add(key(s.snake[i].x, s.snake[i].y));
      return set;
    }
    // Bredde-først-søgning fra (sx,sy). Returnerer Map key -> afstand.
    function bfs(sx, sy, blocked) {
      var dist = new Map();
      var q = [[sx, sy]];
      dist.set(key(sx, sy), 0);
      for (var qi = 0; qi < q.length; qi++) {
        var c = q[qi];
        var d = dist.get(key(c[0], c[1]));
        for (var dn in DIRS) {
          var nx = c[0] + DIRS[dn].x, ny = c[1] + DIRS[dn].y, k = key(nx, ny);
          if (!inside(nx, ny) || blocked.has(k) || dist.has(k)) continue;
          dist.set(k, d + 1);
          q.push([nx, ny]);
        }
      }
      return dist;
    }
    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    function same(a, b) { return a && b && a.x === b.x && a.y === b.y; }
    function isFree(x, y) {
      var k = key(x, y);
      if (snakeSet(false).has(k) || obstacleSet().has(k)) return false;
      if (s.food && same(s.food, { x: x, y: y })) return false;
      if (s.bonus && same(s.bonus, { x: x, y: y })) return false;
      return true;
    }
    function reachableFromHead() {
      var blocked = snakeSet(true);
      obstacleSet().forEach(function (k) { blocked.add(k); });
      var h = s.snake[0];
      blocked.delete(key(h.x, h.y));
      return bfs(h.x, h.y, blocked);
    }
    function freeCells() {
      var out = [];
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (isFree(x, y)) out.push({ x: x, y: y });
      return out;
    }

    function placeFood() {
      var reach = reachableFromHead();
      var cells = freeCells();
      var good = cells.filter(function (c) { return reach.has(key(c.x, c.y)); });
      var pool = good.length ? good : cells;
      if (!pool.length) return null;
      return pool[Math.floor(rng() * pool.length)];
    }
    function placeBonus() {
      var reach = reachableFromHead();
      var cells = freeCells().filter(function (c) {
        var d = reach.get(key(c.x, c.y));
        return d !== undefined && d >= 3 && d <= RULES.bonusMoves - 4;
      });
      if (!cells.length) {
        cells = freeCells().filter(function (c) {
          var d = reach.get(key(c.x, c.y));
          return d !== undefined && d >= 1 && d < RULES.bonusMoves;
        });
      }
      if (!cells.length) return null;
      var c = cells[Math.floor(rng() * cells.length)];
      return { x: c.x, y: c.y, movesLeft: RULES.bonusMoves };
    }
    // Forhindringer: aldrig lige foran hovedet, aldrig tæt på hovedet,
    // må ikke dele brættet i lommer, ikke lave blindgyder, og maden skal
    // stadig kunne nås.
    function obstacleOk(c) {
      var h = s.snake[0];
      if (Math.abs(c.x - h.x) + Math.abs(c.y - h.y) <= 2) return false;
      var d = DIRS[s.dir];
      for (var i = 1; i <= 4; i++) if (c.x === h.x + d.x * i && c.y === h.y + d.y * i) return false;
      var obs = obstacleSet(c);
      // 1) Alle felter uden forhindring skal hænge sammen.
      var total = size * size - obs.size;
      if (bfs(h.x, h.y, obs).size !== total) return false;
      // 2) Ingen nye blindgyder: alle frie naboer skal have mindst 2 frie naboer.
      for (var dn in DIRS) {
        var nx = c.x + DIRS[dn].x, ny = c.y + DIRS[dn].y;
        if (!inside(nx, ny) || obs.has(key(nx, ny))) continue;
        var free = 0;
        for (var dm in DIRS) {
          var mx = nx + DIRS[dm].x, my = ny + DIRS[dm].y;
          if (inside(mx, my) && !obs.has(key(mx, my))) free++;
        }
        if (free < 2) return false;
      }
      // 3) Mad og bonus skal stadig kunne nås fra hovedet nu.
      var blocked = snakeSet(true);
      obs.forEach(function (k) { blocked.add(k); });
      blocked.delete(key(h.x, h.y));
      var reach = bfs(h.x, h.y, blocked);
      if (s.food && !reach.has(key(s.food.x, s.food.y))) return false;
      if (s.bonus && !reach.has(key(s.bonus.x, s.bonus.y))) return false;
      // 4) Hovedet skal have mindst ét frit felt at gå til.
      var exits = 0;
      for (var de in DIRS) {
        var ex = h.x + DIRS[de].x, ey = h.y + DIRS[de].y;
        if (inside(ex, ey) && !blocked.has(key(ex, ey))) exits++;
      }
      return exits >= 1;
    }
    function placeObstacle() {
      var cells = shuffle(freeCells());
      for (var i = 0; i < cells.length; i++) if (obstacleOk(cells[i])) return cells[i];
      return null;
    }

    s.food = placeFood();

    function canMove(dir) { return !s.over && DIRS[dir] && dir !== OPPOSITE[s.dir]; }

    function step(dir) {
      var events = [];
      if (!canMove(dir)) return { ignored: true, events: events };
      prev = clone(s);
      var h = s.snake[0], d = DIRS[dir];
      var nh = { x: h.x + d.x, y: h.y + d.y };
      s.dir = dir;
      s.moves++;
      if (!inside(nh.x, nh.y)) return die('wall', nh, events);
      var eatFood = same(nh, s.food), eatBonus = same(nh, s.bonus);
      var grow = eatFood || eatBonus;
      if (snakeSet(!grow).has(key(nh.x, nh.y))) return die('self', nh, events);
      if (obstacleSet().has(key(nh.x, nh.y))) return die('obstacle', nh, events);

      s.snake.unshift(nh);
      if (!grow) s.snake.pop();
      events.push('move');

      if (eatBonus) {
        s.score += RULES.bonusPoints; s.bonusEaten++; s.bonus = null;
        events.push('bonus');
      } else if (s.bonus) {
        s.bonus.movesLeft--;
        if (s.bonus.movesLeft <= 0) { s.bonus = null; events.push('bonusGone'); }
      }
      if (eatFood) {
        s.score += RULES.foodPoints; s.foodEaten++;
        events.push('eat');
        s.food = null;
        s.food = placeFood();
        if (s.foodEaten % RULES.obstacleEvery === 0) {
          var o = placeObstacle();
          if (o) { s.obstacles.push(o); events.push('obstacle'); }
        }
        if (s.foodEaten % RULES.bonusEvery === 0 && !s.bonus) {
          s.bonus = placeBonus();
          if (s.bonus) events.push('bonusSpawn');
        }
        if (!s.food) { s.over = true; s.won = true; s.reason = 'full'; events.push('won'); }
      }
      return { ignored: false, events: events };
    }
    function die(reason, cell, events) {
      s.over = true; s.reason = reason; s.crash = cell;
      events.push('dead');
      return { ignored: false, events: events };
    }

    // Fortryd sidste træk (også lige efter et sammenstød). Tilstanden sættes tilbage i
    // samme objekt, så game.state stadig peger på den.
    function canUndo() { return !!prev && s.undoLeft > 0 && !s.won; }
    function undo() {
      if (!canUndo()) return false;
      var left = s.undoLeft - 1;
      Object.keys(prev).forEach(function (k) { s[k] = prev[k]; });
      s.undoLeft = left;
      prev = null;
      return true;
    }

    return {
      state: s,
      step: step,
      canMove: canMove,
      canUndo: canUndo,
      undo: undo,
      // kun til test
      _obstacleOk: obstacleOk,
      _placeObstacle: placeObstacle
    };
  }

  global.SlangenGame = { createGame: createGame, DIRS: DIRS, OPPOSITE: OPPOSITE, RULES: RULES };
})(window);
