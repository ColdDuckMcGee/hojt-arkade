/*
 * Tårnene – spillogikken. Ingen DOM, ingen farver, ingen grafik.
 * Kan køres i Node (test) og i browseren (window.TaarneneLogik).
 *
 * Banen er et gitter (w × h) med en fast sti. Fjenderne går ad stien fra
 * første til sidste felt og ud. Alle andre felter kan bebygges med tårne.
 *
 * Spillet er turbaseret: i byggefasen bygger, opgraderer og sælger man i ro og
 * mag. "Start bølgen" skifter til bølgefasen, som afvikles i trin (step()).
 * Hvert trin: 1) fjenderne går, 2) én ny fjende kommer ind, 3) frosttårne
 * sænker, 4) de andre tårne skyder. Bølgerne bliver sværere uden ende.
 *
 * Positioner er "fremdrift" p langs stien: p = 0 er midten af første felt,
 * p = længde − 1 er midten af sidste felt, og p >= længde betyder ude (et liv tabt).
 */
(function (global) {
  'use strict';

  // ---------- Baner ----------
  // Stien som felter i rækkefølge [x, y]. Første felt ligger ved kanten (indgang),
  // sidste felt ved kanten (udgang). Spillet vælger den største bane, skærmen kan bære.
  var MAPS = [
    { id: '8x5', w: 8, h: 5, path: [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[6,2],[6,3],[5,3],[4,3],[3,3],[2,3],[1,3],[1,4]] },
    { id: '7x5', w: 7, h: 5, path: [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[4,3],[3,3],[2,3],[1,3],[1,4]] },
    { id: '6x4', w: 6, h: 4, path: [[0,0],[1,0],[2,0],[2,1],[2,2],[3,2],[4,2],[4,1],[5,1]] },
    { id: '4x6', w: 4, h: 6, path: [[1,0],[1,1],[1,2],[2,2],[2,3],[2,4],[1,4],[1,5]] }
  ];
  // Spejlet over diagonalen (fx 8 × 5 bliver 5 × 8 på en høj skærm)
  function transpose(m) {
    return { id: m.h + 'x' + m.w, w: m.h, h: m.w, path: m.path.map(function (c) { return [c[1], c[0]]; }) };
  }
  function allMaps() {
    // De håndlavede først; en spejlet bane bruges kun, hvis der ikke er en håndlavet i samme størrelse
    var out = MAPS.slice(), seen = {};
    MAPS.forEach(function (m) { seen[m.id] = 1; });
    MAPS.forEach(function (m) { var t = transpose(m); if (!seen[t.id]) { seen[t.id] = 1; out.push(t); } });
    return out;
  }
  function mapById(id) { return allMaps().filter(function (m) { return m.id === id; })[0] || null; }
  // Udgangens retning: fra sidste felt ud over kanten
  function exitDir(m) {
    var e = m.path[m.path.length - 1];
    if (e[0] === 0) return [-1, 0];
    if (e[0] === m.w - 1) return [1, 0];
    if (e[1] === 0) return [0, -1];
    return [0, 1];
  }
  function entryDir(m) {
    var s = m.path[0];
    if (s[0] === 0) return [-1, 0];
    if (s[0] === m.w - 1) return [1, 0];
    if (s[1] === 0) return [0, -1];
    return [0, 1];
  }
  // Midten af et felt i felt-enheder (0,5 = midten af første felt)
  function posAt(m, p) {
    var n = m.path.length;
    if (p <= 0) { var s = m.path[0], d0 = entryDir(m); return { x: s[0] + 0.5 - d0[0] * p, y: s[1] + 0.5 - d0[1] * p }; }
    if (p >= n - 1) { var e = m.path[n - 1], d = exitDir(m), k = p - (n - 1); return { x: e[0] + 0.5 + d[0] * k, y: e[1] + 0.5 + d[1] * k }; }
    var i = Math.floor(p), f = p - i, a = m.path[i], b = m.path[i + 1];
    return { x: a[0] + 0.5 + (b[0] - a[0]) * f, y: a[1] + 0.5 + (b[1] - a[1]) * f };
  }
  function validMap(m) {
    var seen = {};
    for (var i = 0; i < m.path.length; i++) {
      var c = m.path[i];
      if (c[0] < 0 || c[1] < 0 || c[0] >= m.w || c[1] >= m.h) return false;
      if (seen[c[0] + ',' + c[1]]) return false;
      seen[c[0] + ',' + c[1]] = 1;
      if (i && Math.abs(c[0] - m.path[i - 1][0]) + Math.abs(c[1] - m.path[i - 1][1]) !== 1) return false;
    }
    var s = m.path[0], e = m.path[m.path.length - 1];
    function edge(c) { return c[0] === 0 || c[1] === 0 || c[0] === m.w - 1 || c[1] === m.h - 1; }
    return edge(s) && edge(e);
  }

  // ---------- Tårne ----------
  // dmg: skade pr. skud. range: rækkevidde i felter (fra feltets midte).
  // cd: skyder hvert cd. trin. area: rammer alle i rækkevidde. slow: sænker alle i rækkevidde.
  var TOWERS = {
    laser: { cost: 10, levels: [
      { dmg: 2, range: 1.5, cd: 1 }, { dmg: 4, range: 1.5, cd: 1 }, { dmg: 6, range: 2, cd: 1 } ] },
    puls: { cost: 18, area: true, levels: [
      { dmg: 1, range: 1.5, cd: 1 }, { dmg: 2, range: 1.5, cd: 1 }, { dmg: 3, range: 1.5, cd: 1 } ] },
    frost: { cost: 14, slow: true, levels: [
      { dmg: 0, range: 1.5, cd: 1, factor: 0.5 }, { dmg: 0, range: 2, cd: 1, factor: 0.5 }, { dmg: 1, range: 2.5, cd: 1, factor: 0.4 } ] },
    kanon: { cost: 25, levels: [
      { dmg: 7, range: 2.5, cd: 2 }, { dmg: 12, range: 2.5, cd: 2 }, { dmg: 18, range: 3, cd: 2 } ] }
  };
  var TOWER_TYPES = ['laser', 'puls', 'frost', 'kanon'];
  var MAX_LEVEL = 3;
  function towerStats(type, level) { return TOWERS[type].levels[level - 1]; }
  // Opgradering: fra niveau 1 til 2 og fra 2 til 3
  function upgradeCost(type, level) {
    if (level >= MAX_LEVEL) return 0;
    return Math.round(TOWERS[type].cost * (level === 1 ? 0.8 : 1.2));
  }

  // ---------- Fjender ----------
  // hp ganges med bølgens styrke. speed: felter pr. trin. lives: liv, man mister, hvis den slipper ud.
  var ENEMIES = {
    kugle: { hp: 6, speed: 1, money: 2, points: 10, lives: 1 },
    pil: { hp: 4, speed: 1.5, money: 2, points: 15, lives: 1 },
    kasse: { hp: 16, speed: 0.5, money: 4, points: 25, lives: 1 },
    kaempe: { hp: 60, speed: 0.5, money: 15, points: 100, lives: 3 }
  };

  var RULES = {
    startMoney: 40, lives: 10,
    sellRate: 0.7,                     // salg giver 70 % af det investerede …
    // … men tårne, der er bygget eller opgraderet i denne byggefase, giver alt tilbage (fortryd)
    waveMoney: function (n) { return 5 + n; },
    wavePoints: function (n) { return 20 * n; },
    hpMul: function (n) { return (1 + 0.15 * (n - 1)) * Math.pow(1.07, n - 1); },
    count: function (n) { return Math.min(40, 3 + n); }
  };

  // ---------- Tilfældige tal med frø ----------
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bølge n: hvilke fjender og i hvilken rækkefølge
  function waveSpec(n, seed) {
    var r = rng((seed || 1) * 7919 + n * 104729);
    var count = RULES.count(n), list = [];
    var bosses = n % 5 === 0 ? Math.floor(n / 5) : 0;
    for (var i = 0; i < count; i++) {
      var x = r(), t = 'kugle';
      if (n >= 4 && x < 0.22) t = 'kasse';
      else if (n >= 3 && x < 0.5) t = 'pil';
      list.push(t);
    }
    // Lidt at starte med: de første to bølger er rene kugler
    for (var b = 0; b < bosses; b++) list.push('kaempe');
    return { n: n, types: list, hpMul: RULES.hpMul(n) };
  }
  function countTypes(types) {
    var c = {};
    types.forEach(function (t) { c[t] = (c[t] || 0) + 1; });
    return c;
  }

  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  // ---------- Et spil ----------
  function createGame(opts) {
    opts = opts || {};
    var map = opts.map || MAPS[0];
    var seed = opts.seed || ((Math.random() * 1e9) >>> 0) || 1;
    var onPath = {};
    map.path.forEach(function (c) { onPath[c[1] * map.w + c[0]] = true; });
    var nextId = 1;

    var state = {
      map: map, seed: seed,
      money: RULES.startMoney, lives: RULES.lives, score: 0,
      wave: 1,                // næste (eller igangværende) bølge
      cleared: 0,             // klarede bølger
      phase: 'bygge',         // 'bygge' | 'boelge' | 'slut'
      towers: {},             // felt-indeks -> { type, level, invested, fresh }
      enemies: [],            // { id, type, hp, maxHp, p, slow }
      queue: [], tick: 0, kills: 0, leaked: 0,
      spec: waveSpec(1, seed),
      last: null              // seneste trins hændelser
    };

    function cellXY(i) { return { x: i % map.w + 0.5, y: Math.floor(i / map.w) + 0.5 }; }
    function isPath(i) { return !!onPath[i]; }
    function inside(i) { return i >= 0 && i < map.w * map.h; }

    function canBuild(i, type) {
      if (state.phase !== 'bygge') return { ok: false, why: 'boelge' };
      if (!inside(i)) return { ok: false, why: 'udenfor' };
      if (isPath(i)) return { ok: false, why: 'sti' };
      if (state.towers[i]) return { ok: false, why: 'optaget' };
      if (type && !TOWERS[type]) return { ok: false, why: 'type' };
      if (type && state.money < TOWERS[type].cost) return { ok: false, why: 'penge', mangler: TOWERS[type].cost - state.money };
      return { ok: true };
    }
    function build(i, type) {
      var c = canBuild(i, type);
      if (!type) return { ok: false, why: 'type' };
      if (!c.ok) return c;
      var cost = TOWERS[type].cost;
      state.money -= cost;
      state.towers[i] = { type: type, level: 1, invested: cost, fresh: cost, cd: 0 };
      return { ok: true, cost: cost };
    }
    function upgrade(i) {
      var t = state.towers[i];
      if (state.phase !== 'bygge') return { ok: false, why: 'boelge' };
      if (!t) return { ok: false, why: 'tom' };
      if (t.level >= MAX_LEVEL) return { ok: false, why: 'max' };
      var cost = upgradeCost(t.type, t.level);
      if (state.money < cost) return { ok: false, why: 'penge', mangler: cost - state.money };
      state.money -= cost; t.level++; t.invested += cost; t.fresh += cost;
      return { ok: true, cost: cost, level: t.level };
    }
    function sellValue(i) {
      var t = state.towers[i];
      if (!t) return 0;
      return t.fresh + Math.floor((t.invested - t.fresh) * RULES.sellRate);
    }
    function sell(i) {
      var t = state.towers[i];
      if (state.phase !== 'bygge') return { ok: false, why: 'boelge' };
      if (!t) return { ok: false, why: 'tom' };
      var v = sellValue(i);
      state.money += v;
      delete state.towers[i];
      return { ok: true, value: v };
    }

    function startWave() {
      if (state.phase !== 'bygge') return { ok: false };
      state.spec = waveSpec(state.wave, seed);
      state.queue = state.spec.types.slice();
      state.enemies = [];
      state.tick = 0;
      state.phase = 'boelge';
      Object.keys(state.towers).forEach(function (k) { state.towers[k].cd = 0; state.towers[k].fresh = 0; });
      state.last = null;
      return { ok: true, spec: state.spec };
    }

    function spawn(type) {
      var d = ENEMIES[type], hp = Math.max(1, Math.round(d.hp * state.spec.hpMul));
      var e = { id: nextId++, type: type, hp: hp, maxHp: hp, p: 0, slow: 0 };
      state.enemies.push(e);
      return e;
    }

    // Ét trin i bølgen. Returnerer hændelserne (til tegnelaget og lyden).
    function step() {
      if (state.phase !== 'boelge') return null;
      var ev = { tick: ++state.tick, moved: [], spawned: [], shots: [], slowed: [], killed: [], leaked: [], waveDone: false, gameOver: false, bonus: null };
      var n = map.path.length;
      // 1) Fjenderne går
      state.enemies.forEach(function (e) {
        var sp = ENEMIES[e.type].speed * (e.slow > 0 ? e.slowFactor : 1);
        var from = e.p;
        e.p = Math.round((e.p + sp) * 1000) / 1000;
        if (e.slow > 0) e.slow--;
        ev.moved.push({ id: e.id, from: from, to: e.p });
      });
      // Ude: liv tabt
      state.enemies = state.enemies.filter(function (e) {
        if (e.p >= n) {
          var l = ENEMIES[e.type].lives;
          state.lives = Math.max(0, state.lives - l); state.leaked++;
          ev.leaked.push({ id: e.id, type: e.type, lives: l, p: e.p });
          return false;
        }
        return true;
      });
      if (state.lives <= 0) {
        state.phase = 'slut'; ev.gameOver = true; state.last = ev; return ev;
      }
      // 2) Én ny fjende kommer ind
      if (state.queue.length) {
        var e0 = spawn(state.queue.shift());
        ev.spawned.push(e0.id);
        ev.moved.push({ id: e0.id, from: -0.6, to: 0 });
      }
      // 3) og 4) Tårnene: frost først (sænker), så de andre. Faste rækkefølger (felt-indeks).
      var keys = Object.keys(state.towers).map(Number).sort(function (a, b) { return a - b; });
      var order = keys.filter(function (k) { return state.towers[k].type === 'frost'; })
        .concat(keys.filter(function (k) { return state.towers[k].type !== 'frost'; }));
      order.forEach(function (k) {
        var t = state.towers[k], def = TOWERS[t.type], st = towerStats(t.type, t.level), c = cellXY(k);
        if (t.cd > 0) { t.cd--; return; }
        var inRange = state.enemies.filter(function (e) { return e.hp > 0 && dist(posAt(map, e.p), c) <= st.range + 1e-9; });
        if (!inRange.length) return;
        // Mål: den fjende, der er længst fremme
        inRange.sort(function (a, b) { return b.p - a.p || a.id - b.id; });
        var targets = (def.area || def.slow) ? inRange : [inRange[0]];
        targets.forEach(function (e) {
          if (def.slow) { e.slow = 1; e.slowFactor = st.factor; ev.slowed.push(e.id); }
          if (st.dmg > 0) e.hp -= st.dmg;
        });
        ev.shots.push({ tower: k, type: t.type, targets: targets.map(function (e) { return e.id; }) });
        t.cd = st.cd - 1;
      });
      // Nedkæmpede fjender: penge og point
      state.enemies = state.enemies.filter(function (e) {
        if (e.hp <= 0) {
          var d = ENEMIES[e.type];
          state.money += d.money; state.score += d.points; state.kills++;
          ev.killed.push({ id: e.id, type: e.type, p: e.p, money: d.money, points: d.points });
          return false;
        }
        return true;
      });
      // Bølgen er slut, når alle er kommet ind og ingen er tilbage
      if (!state.queue.length && !state.enemies.length) {
        var nWave = state.wave;
        var bonus = { money: RULES.waveMoney(nWave), points: RULES.wavePoints(nWave), wave: nWave };
        state.money += bonus.money; state.score += bonus.points;
        state.cleared++; state.wave++;
        state.phase = 'bygge';
        state.spec = waveSpec(state.wave, seed);
        ev.waveDone = true; ev.bonus = bonus;
      }
      state.last = ev;
      return ev;
    }
    // Hele resten af bølgen på én gang (til "Vis resten" og test)
    function runWave(maxSteps) {
      var evs = [], k = 0;
      while (state.phase === 'boelge' && k++ < (maxSteps || 10000)) evs.push(step());
      return evs;
    }
    function end() { state.ended = true; if (state.phase !== 'slut') state.phase = 'slut'; return { score: state.score, cleared: state.cleared, wave: state.wave }; }

    return {
      state: state,
      isPath: isPath, cellXY: cellXY, canBuild: canBuild, build: build, upgrade: upgrade,
      sell: sell, sellValue: sellValue, startWave: startWave, step: step, runWave: runWave, end: end,
      posAt: function (p) { return posAt(map, p); },
      enemy: function (id) { return state.enemies.filter(function (e) { return e.id === id; })[0] || null; },
      inRange: function (i, type, level) {
        var st = towerStats(type, level), c = cellXY(i), out = [];
        map.path.forEach(function (pc, k) { if (dist({ x: pc[0] + 0.5, y: pc[1] + 0.5 }, c) <= st.range + 1e-9) out.push(k); });
        return out;
      }
    };
  }

  global.TaarneneLogik = {
    MAPS: MAPS, allMaps: allMaps, mapById: mapById, transpose: transpose, validMap: validMap,
    posAt: posAt, entryDir: entryDir, exitDir: exitDir,
    TOWERS: TOWERS, TOWER_TYPES: TOWER_TYPES, MAX_LEVEL: MAX_LEVEL, towerStats: towerStats, upgradeCost: upgradeCost,
    ENEMIES: ENEMIES, RULES: RULES, rng: rng, waveSpec: waveSpec, countTypes: countTypes,
    createGame: createGame
  };
})(typeof window !== 'undefined' ? window : globalThis);
