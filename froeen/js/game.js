/*
 * Frøen – spillogik (ingen DOM). Turbaseret Frogger: intet sker, før
 * spilleren vælger ét træk (ét hop eller Vent). Derefter rykker alle baner
 * med biler, stammer og skildpadder ét felt. Nogle baner rykker kun hvert
 * andet træk, men altid forudsigeligt. Der er ingen ure eller tidsgrænser.
 *
 * Brættet er 11 kolonner × 13 rækker (række 0 øverst):
 *   række 0       toprækken med fem huller (x = 1, 3, 5, 7, 9) og mur imellem
 *   række 1–5     floden: stammer og skildpadder (frøen følger med)
 *   række 6       sikker midterrække
 *   række 7–11    vejen: biler, varevogne og lastbiler
 *   række 12      startrækken (sikker)
 *
 * Rækkefølge i et træk:
 *   1. Frøen hopper (eller venter). Lander den på en bil eller i vandet,
 *      eller hopper den ind i muren eller et optaget hul, mister den et liv.
 *      Lander den i et ledigt hul, fyldes hullet, og frøen starter forfra.
 *   2. Banerne rykker. Står frøen på en stamme eller skildpadde, følger den
 *      med. Bliver den ført ud over kanten, eller kører en bil ind i den,
 *      mister den et liv.
 *
 * Hver bane er en ring af felter (lidt længere end brættet), så bilerne og
 * stammerne kører ud i den ene side og kommer ind i den anden.
 */
(function (global) {
  'use strict';

  var COLS = 11, ROWS = 13;
  var START = { x: 5, y: 12 };
  var HOLES = [1, 3, 5, 7, 9];
  var RIVER = [1, 2, 3, 4, 5], MEDIAN = 6, ROAD = [7, 8, 9, 10, 11], START_ROW = 12;
  var MODES = {
    '3': { id: '3', lives: 3, name: 'Tre liv', short: 'tre liv' },
    '1': { id: '1', lives: 1, name: 'Ét liv', short: 'ét liv' }
  };
  var RULES = {
    pointsStep: 10,     // hvert nyt skridt fremad (ny højeste række i dette forsøg)
    pointsHole: 50,     // hvert fyldt hul
    levelBonus: 200,    // klaret bane: 200 × banens nummer
    minRing: 14         // hver bane er mindst 14 felter rundt (brættet er 11)
  };
  var DIRS = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function levelBonus(level) { return RULES.levelBonus * level; }
  function rowKind(y) {
    if (y === 0) return 'top';
    if (RIVER.indexOf(y) >= 0) return 'river';
    if (y === MEDIAN) return 'median';
    if (ROAD.indexOf(y) >= 0) return 'road';
    return 'start';
  }

  // Opskrift på banerne for bane nummer `level`. Bruges også af brugerfladen
  // til at fortælle, hvad næste bane byder på.
  function levelPlan(level) {
    var n = level - 1;
    var slowRoad = Math.max(0, 3 - Math.floor(n / 2));   // baner, der kun rykker hvert andet træk
    var slowRiver = Math.max(0, 2 - Math.floor(n / 3));
    return {
      level: level,
      // vej: længde på køretøjer pr. bane (nederst først) og mellemrum
      carLen: [1, 1, 2, 1, 2].map(function (b, i) { return Math.min(3, b + Math.floor((n + (i % 2)) / 3)); }),
      carGap: [2, Math.max(3, 5 - n)],                          // 2–3 felter mellem biler, aldrig under 2
      roadPeriod: [0, 1, 2, 3, 4].map(function (i) { return [1, 3, 0, 4, 2].indexOf(i) < slowRoad ? 2 : 1; }),
      // flod: stammer bliver kortere, og vandet imellem bliver bredere
      riverKind: ['turtle', 'log', 'log', 'turtle', 'log'],     // række 5, 4, 3, 2, 1
      logLen: [3, 4, 3].map(function (b) { return Math.max(2, b - Math.floor(n / 2)); }),
      turtleLen: Math.max(2, 3 - Math.floor(n / 2)),
      waterGap: [Math.min(2, 1 + Math.floor(n / 3)), Math.min(3, 2 + Math.floor(n / 2))],
      riverPeriod: [0, 1, 2, 3, 4].map(function (i) { return (slowRiver >= 1 && i === 1) || (slowRiver >= 2 && i === 3) ? 2 : 1; })
    };
  }

  function createRun(modeId, opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random;
    var mode = MODES[modeId] || MODES['3'];
    var s = {
      modeId: mode.id, cols: COLS, rows: ROWS, level: 0,
      lives: mode.lives, score: 0, levelsCleared: 0, turn: 0,
      frog: { x: START.x, y: START.y }, facing: 'up', bestY: START.y,
      holes: HOLES.map(function () { return false; }),
      lanes: [], dead: false, deathCause: null, over: false, cleared: false
    };
    function randInt(a, b) { return a + Math.floor(rng() * (b - a + 1)); }

    // ---------- Banerne ----------
    function makeLane(y, kind, dir, period, phase, lenFn, gap) {
      var objs = [], pos = 0;
      while (pos < RULES.minRing || objs.length < 2) {
        var len = lenFn(objs.length);
        objs.push({ start: pos, len: len });
        pos += len + randInt(gap[0], gap[1]);
      }
      return { y: y, kind: kind, dir: dir, period: period, phase: phase, ring: pos, offset: randInt(0, pos - 1), objs: objs };
    }
    function buildLevel(level) {
      var p = levelPlan(level);
      s.level = level;
      s.holes = HOLES.map(function () { return false; });
      s.cleared = false;
      s.lanes = [];
      // vej: nederste bane kører mod venstre, derefter skiftevis
      ROAD.slice().reverse().forEach(function (y, i) {
        var len = p.carLen[i];
        s.lanes.push(makeLane(y, 'car', i % 2 ? 1 : -1, p.roadPeriod[i], i % 2, function () { return len; }, p.carGap));
      });
      RIVER.slice().reverse().forEach(function (y, i) {
        var kind = p.riverKind[i];
        var logs = p.logLen;
        var fn = kind === 'turtle' ? function () { return p.turtleLen; } : function (k) { return logs[(i + k) % logs.length]; };
        s.lanes.push(makeLane(y, kind, i % 2 ? 1 : -1, p.riverPeriod[i], (i + 1) % 2, fn, p.waterGap));
      });
      resetFrog();
    }
    function resetFrog() {
      s.frog = { x: START.x, y: START.y };
      s.facing = 'up';
      s.bestY = START.y;
    }
    function laneAt(y) { for (var i = 0; i < s.lanes.length; i++) if (s.lanes[i].y === y) return s.lanes[i]; return null; }
    // Hvilket objekt dækker felt x i banen (eller null)?
    function objAt(lane, x, offset) {
      var off = offset === undefined ? lane.offset : offset;
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (mod(x - (o.start + off), lane.ring) < o.len) return o;
      }
      return null;
    }
    function movesOn(lane, turn) { return lane.period === 1 || mod(turn, lane.period) === lane.phase; }
    function movesNext(lane) { return movesOn(lane, s.turn + 1); }
    function nextOffset(lane) { return movesNext(lane) ? mod(lane.offset + lane.dir, lane.ring) : lane.offset; }
    // Synlige felter for et objekt ved en given forskydning: [{x, len}] (kan være delt i to ved kanten)
    function spans(lane, o, offset) {
      var off = offset === undefined ? lane.offset : offset;
      var x0 = mod(o.start + off, lane.ring), out = [];
      // objektet kan ligge over ringens "søm"; vis den del, der er på brættet
      [x0, x0 - lane.ring].forEach(function (x) {
        var a = Math.max(0, x), b = Math.min(COLS, x + o.len);
        if (b > a) out.push({ x: x, from: a, to: b });
      });
      return out;
    }

    // Hvad er farligt for frøen, hvor den står nu?
    function hazard() {
      var f = s.frog;
      if (f.x < 0 || f.x >= COLS) return 'kant';
      var k = rowKind(f.y);
      var lane = laneAt(f.y);
      if (k === 'road' && objAt(lane, f.x)) return 'bil';
      if (k === 'river' && !objAt(lane, f.x)) return 'vand';
      return null;
    }

    // ---------- Træk ----------
    function playable() { return !s.dead && !s.over && !s.cleared; }
    function canMove(dir) {
      var d = DIRS[dir];
      if (!d || !playable()) return false;
      var nx = s.frog.x + d.x, ny = s.frog.y + d.y;
      return nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS;
    }
    // Hvad rammer frøen i toprækken ved x?
    function topAt(x) {
      var h = HOLES.indexOf(x);
      if (h < 0) return 'mur';
      return s.holes[h] ? 'optaget' : 'hul';
    }
    function die(ev, cause) {
      s.dead = true; s.deathCause = cause;
      s.lives--;
      ev.events.push('died'); ev.cause = cause;
      if (s.lives <= 0) { s.over = true; ev.events.push('over'); }
      return ev;
    }
    function advanceLanes(ev) {
      s.turn++;
      s.lanes.forEach(function (lane) {
        if (!movesOn(lane, s.turn)) return;
        lane.offset = mod(lane.offset + lane.dir, lane.ring);
        if (lane.y === s.frog.y && lane.kind !== 'car') { s.frog.x += lane.dir; ev.events.push('carried'); ev.carriedBy = lane.dir; }
      });
    }
    function act(action) {
      var ev = { events: [], points: 0 };
      if (!playable()) { ev.ignored = true; return ev; }
      if (action === 'wait') {
        ev.events.push('wait');
      } else {
        if (!canMove(action)) { ev.ignored = true; return ev; }
        var d = DIRS[action];
        s.frog.x += d.x; s.frog.y += d.y; s.facing = action;
        ev.events.push('hop');
        if (s.frog.y < s.bestY) {
          s.bestY = s.frog.y;
          s.score += RULES.pointsStep; ev.points += RULES.pointsStep;
        }
        if (s.frog.y === 0) {
          var t = topAt(s.frog.x);
          if (t !== 'hul') return die(ev, t);
          var h = HOLES.indexOf(s.frog.x);
          s.holes[h] = true;
          s.score += RULES.pointsHole; ev.points += RULES.pointsHole;
          ev.events.push('hole'); ev.hole = h; ev.holeX = s.frog.x;
          if (s.holes.every(Boolean)) {
            var bonus = levelBonus(s.level);
            s.score += bonus; ev.points += bonus; ev.bonus = bonus;
            s.cleared = true; s.levelsCleared++;
            s.turn++;
            ev.events.push('cleared');
            return ev;
          }
          resetFrog();
          advanceLanes(ev);   // startrækken er sikker
          return ev;
        }
        var h1 = hazard();
        if (h1) return die(ev, h1);
      }
      advanceLanes(ev);
      var h2 = hazard();
      if (h2) return die(ev, h2);
      return ev;
    }
    // Hvad ville der ske ved dette træk? (uden at ændre noget) – null = sikkert
    function simulate(action) {
      var keep = clone(s);
      var ev = act(action);
      var res = ev.ignored ? 'ugyldigt' : (ev.cause || null);
      s = keep; api.state = s;
      return res;
    }
    // Efter et mistet liv: frøen starter i bunden, når spilleren er klar.
    function respawn() {
      if (!s.dead || s.over) return false;
      s.dead = false; s.deathCause = null;
      resetFrog();
      return true;
    }
    function nextLevel() {
      if (!s.cleared) return s;
      buildLevel(s.level + 1);
      return s;
    }

    buildLevel(opts.level || 1);

    var api = {
      state: s, act: act, canMove: canMove, playable: playable, respawn: respawn, nextLevel: nextLevel,
      simulate: simulate, hazard: function () { return hazard(); }, topAt: topAt,
      laneAt: laneAt, objAt: objAt, spans: spans, movesNext: movesNext, nextOffset: nextOffset,
      _setState: function (ns) { s = ns; api.state = s; }
    };
    return api;
  }

  global.FroeenGame = {
    COLS: COLS, ROWS: ROWS, START: START, HOLES: HOLES, RIVER: RIVER, ROAD: ROAD, MEDIAN: MEDIAN, START_ROW: START_ROW,
    MODES: MODES, RULES: RULES, DIRS: DIRS, rowKind: rowKind, levelPlan: levelPlan, levelBonus: levelBonus, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
