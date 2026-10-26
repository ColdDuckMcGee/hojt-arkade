/*
 * Søslag – spillogik (ingen DOM). Sænk slagskibe mod computeren.
 *
 * Bræt: 8 × 8 (standard) eller 10 × 10. Hver flåde har fem skibe på 4, 3, 3, 2
 * og 2 felter. Skibene ligger vandret eller lodret og rører aldrig hinanden,
 * heller ikke på skrå.
 *
 * Turene skifter efter hvert skud: du skyder, så skyder computeren.
 * Spillet er uendeligt: vinder man en kamp, kommer en ny med nye flåder.
 * Spillet slutter første gang, computeren sænker hele ens flåde.
 *
 * Computeren snyder aldrig: den får kun det, en menneskelig spiller ved –
 * hvor den har skudt, om det var plask, ramt eller sænket, og hvilke skibe
 * der er tilbage. Den kender reglen om, at skibe ikke rører hinanden.
 *   Rolig:  skyder tilfældigt.
 *   Normal: jagt og mål – leder i et skakternet mønster, og når den rammer,
 *           skyder den på nabofelterne, til skibet er sænket.
 *   Svær:   sandsynlighedskort – tæller for hvert felt, hvor mange måder de
 *           resterende skibe kan ligge på, og skyder, hvor det er størst.
 *
 * Point:
 *   20 point for hvert af computerens skibe, man sænker (også i den tabte kamp).
 *   En vundet kamp giver 100 point plus 10 point for hvert felt på
 *   computerens hav, man aldrig skød på. Færre skud = flere point.
 */
(function (global) {
  'use strict';

  var SIZES = {
    '8x8':   { id: '8x8',   n: 8,  label: '8 × 8',   name: 'Mellem' },
    '10x10': { id: '10x10', n: 10, label: '10 × 10', name: 'Stor' }
  };
  var DEFAULT_SIZE = '8x8';

  var FLEET = [
    { id: 'slagskib', name: 'Slagskib',    len: 4 },
    { id: 'krydser',  name: 'Krydser',     len: 3 },
    { id: 'fregat',   name: 'Fregat',      len: 3 },
    { id: 'korvet',   name: 'Korvet',      len: 2 },
    { id: 'patrulje', name: 'Patruljebåd', len: 2 }
  ];
  var FLEET_CELLS = FLEET.reduce(function (a, s) { return a + s.len; }, 0); // 14

  var LEVELS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  desc: 'Tilfældige skud' },
    normal: { id: 'normal', name: 'Normal', desc: 'Jagt og mål' },
    svaer:  { id: 'svaer',  name: 'Svær',   desc: 'Sandsynlighedskort' }
  };
  var LEVEL_ORDER = ['rolig', 'normal', 'svaer'];
  var DEFAULT_LEVEL = 'normal';

  var RULES = { sunkPoint: 20, winPoint: 100, unshotPoint: 10, aiDelayMs: 1000 };

  // Skud-tilstande på et hav (det, modstanderen ved)
  var NONE = 0, MISS = 1, HIT = 2, SUNK = 3;

  var COLS = 'ABCDEFGHIJ';
  function coord(n, i) { return COLS.charAt(i % n) + (Math.floor(i / n) + 1); }

  function defaultRng() { return Math.random(); }
  function pickRandom(arr, rng) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

  // ---------- Placering ----------
  // Cellerne for et skib med stævnen i (x, y). null, hvis det stikker ud.
  function shipCells(n, len, x, y, horiz) {
    var out = [];
    for (var k = 0; k < len; k++) {
      var cx = x + (horiz ? k : 0), cy = y + (horiz ? 0 : k);
      if (cx < 0 || cy < 0 || cx >= n || cy >= n) return null;
      out.push(cy * n + cx);
    }
    return out;
  }
  // Skubber stævnen ind, så skibet altid ligger på brættet.
  function fitPos(n, len, x, y, horiz) {
    x = Math.max(0, Math.min(n - 1, x)); y = Math.max(0, Math.min(n - 1, y));
    if (horiz) x = Math.min(x, n - len); else y = Math.min(y, n - len);
    return { x: x, y: y };
  }
  // Felter, der er optaget af et skib eller ligger lige ved siden af (også på skrå).
  function haloOf(n, cells) {
    var set = {};
    cells.forEach(function (i) {
      var x = i % n, y = Math.floor(i / n);
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var ax = x + dx, ay = y + dy;
        if (ax >= 0 && ay >= 0 && ax < n && ay < n) set[ay * n + ax] = 1;
      }
    });
    return set;
  }
  function canPlace(n, ships, len, x, y, horiz, ignoreId) {
    var cells = shipCells(n, len, x, y, horiz);
    if (!cells) return false;
    var others = [];
    ships.forEach(function (s) { if (s.id !== ignoreId) others = others.concat(s.cells); });
    var halo = haloOf(n, others);
    return cells.every(function (i) { return !halo[i]; });
  }
  function makeShip(def, n, x, y, horiz) {
    return { id: def.id, name: def.name, len: def.len, x: x, y: y, horiz: horiz, cells: shipCells(n, def.len, x, y, horiz) };
  }
  // Tilfældig flåde, hvor ingen skibe rører hinanden.
  function randomFleet(n, rng) {
    rng = rng || defaultRng;
    for (var attempt = 0; attempt < 200; attempt++) {
      var ships = [], ok = true;
      for (var k = 0; k < FLEET.length && ok; k++) {
        var def = FLEET[k], opts = [];
        for (var h = 0; h < 2; h++) for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
          if (canPlace(n, ships, def.len, x, y, !!h)) opts.push([x, y, !!h]);
        }
        if (!opts.length) { ok = false; break; }
        var o = pickRandom(opts, rng);
        ships.push(makeShip(def, n, o[0], o[1], o[2]));
      }
      if (ok) return ships;
    }
    throw new Error('Kunne ikke placere flåden');
  }
  function validFleet(n, ships) {
    if (ships.length !== FLEET.length) return false;
    return ships.every(function (s) { return s.cells && canPlace(n, ships, s.len, s.x, s.y, s.horiz, s.id); });
  }

  // ---------- Havet og skud ----------
  function createSea(n, ships) {
    var map = new Array(n * n).fill(-1);
    ships = ships.map(function (s, k) { s.cells.forEach(function (i) { map[i] = k; }); return Object.assign({}, s, { hits: 0, sunk: false }); });
    return { n: n, ships: ships, map: map, shots: new Array(n * n).fill(NONE), count: 0 };
  }
  function fire(sea, i) {
    if (i < 0 || i >= sea.shots.length || sea.shots[i] !== NONE) return { ok: false };
    sea.count++;
    var k = sea.map[i];
    if (k < 0) { sea.shots[i] = MISS; return { ok: true, i: i, result: 'miss' }; }
    var ship = sea.ships[k];
    ship.hits++;
    sea.shots[i] = HIT;
    if (ship.hits >= ship.len) {
      ship.sunk = true;
      ship.cells.forEach(function (c) { sea.shots[c] = SUNK; });
      var all = sea.ships.every(function (s) { return s.sunk; });
      return { ok: true, i: i, result: 'sunk', ship: ship, allSunk: all };
    }
    return { ok: true, i: i, result: 'hit', ship: ship };
  }
  // Det, modstanderen må vide: skuddene og længderne på de skibe, der ikke er sænket.
  function viewOf(sea) {
    return {
      n: sea.n, shots: sea.shots.slice(),
      remaining: sea.ships.filter(function (s) { return !s.sunk; }).map(function (s) { return s.len; })
    };
  }

  // ---------- Computeren ----------
  // Felter, hvor der med sikkerhed ikke ligger et skib: rundt om sænkede skibe
  // og på skrå af et ramt felt (skibe rører aldrig hinanden).
  function blockedCells(view) {
    var n = view.n, s = view.shots, sunk = [], blocked = {};
    for (var i = 0; i < s.length; i++) if (s[i] === SUNK) sunk.push(i);
    var h = haloOf(n, sunk);
    Object.keys(h).forEach(function (k) { if (s[k] === NONE) blocked[k] = 1; });
    for (var j = 0; j < s.length; j++) if (s[j] === HIT) {
      var x = j % n, y = Math.floor(j / n);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        var ax = x + d[0], ay = y + d[1];
        if (ax >= 0 && ay >= 0 && ax < n && ay < n && s[ay * n + ax] === NONE) blocked[ay * n + ax] = 1;
      });
    }
    return blocked;
  }
  function openCells(view) {
    var out = [];
    for (var i = 0; i < view.shots.length; i++) if (view.shots[i] === NONE) out.push(i);
    return out;
  }
  function neighbors4(n, i) {
    var x = i % n, y = Math.floor(i / n), out = [];
    if (x > 0) out.push(i - 1); if (x < n - 1) out.push(i + 1);
    if (y > 0) out.push(i - n); if (y < n - 1) out.push(i + n);
    return out;
  }
  // Grupper af ramte felter, der hører til skibe, som ikke er sænket endnu.
  function hitClusters(view) {
    var n = view.n, s = view.shots, seen = {}, groups = [];
    for (var i = 0; i < s.length; i++) {
      if (s[i] !== HIT || seen[i]) continue;
      var g = [], st = [i]; seen[i] = 1;
      while (st.length) {
        var c = st.pop(); g.push(c);
        neighbors4(n, c).forEach(function (m) { if (s[m] === HIT && !seen[m]) { seen[m] = 1; st.push(m); } });
      }
      groups.push(g.sort(function (a, b) { return a - b; }));
    }
    return groups;
  }

  function pickRolig(view, rng) { return pickRandom(openCells(view), rng); }

  function targetCandidates(view, blocked) {
    var n = view.n, s = view.shots, groups = hitClusters(view);
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g], cand = [];
      if (grp.length >= 2) {
        var horiz = Math.floor(grp[0] / n) === Math.floor(grp[1] / n);
        var a = grp[0], b = grp[grp.length - 1];
        if (horiz) { if (a % n > 0) cand.push(a - 1); if (b % n < n - 1) cand.push(b + 1); }
        else { if (a >= n) cand.push(a - n); if (b + n < n * n) cand.push(b + n); }
      } else cand = neighbors4(n, grp[0]);
      cand = cand.filter(function (c) { return s[c] === NONE && !blocked[c]; });
      if (cand.length) return cand;
    }
    return [];
  }
  function pickNormal(view, rng) {
    var blocked = blockedCells(view), n = view.n;
    var cand = targetCandidates(view, blocked);
    if (cand.length) return pickRandom(cand, rng);
    var free = openCells(view).filter(function (i) { return !blocked[i]; });
    if (!free.length) return pickRolig(view, rng);
    var minLen = Math.min.apply(null, view.remaining.length ? view.remaining : [2]);
    var parity = free.filter(function (i) { return ((i % n) + Math.floor(i / n)) % minLen === 0; });
    return pickRandom(parity.length ? parity : free, rng);
  }
  // Sandsynlighedskort: hvor mange lovlige placeringer af de resterende skibe dækker hvert felt?
  function probabilityMap(view) {
    var n = view.n, s = view.shots, blocked = blockedCells(view), heat = new Array(n * n).fill(0);
    var anyHit = s.some(function (v) { return v === HIT; });
    view.remaining.forEach(function (len) {
      for (var h = 0; h < 2; h++) for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var cells = shipCells(n, len, x, y, !!h);
        if (!cells) continue;
        var ok = true, hits = 0, inSet = {};
        for (var k = 0; k < cells.length; k++) {
          var v = s[cells[k]];
          if (v === MISS || v === SUNK || blocked[cells[k]]) { ok = false; break; }
          if (v === HIT) hits++;
          inSet[cells[k]] = 1;
        }
        if (!ok) continue;
        // Et ramt felt lige ved siden af ville betyde, at to skibe rører hinanden
        var halo = haloOf(n, cells);
        for (var key in halo) if (!inSet[key] && s[key] === HIT) { ok = false; break; }
        if (!ok) continue;
        if (anyHit && !hits) continue;  // mål: kun placeringer gennem et ramt felt
        var w = anyHit ? hits * hits : 1;
        cells.forEach(function (c) { if (s[c] === NONE) heat[c] += w; });
      }
    });
    return heat;
  }
  function pickSvaer(view, rng) {
    var heat = probabilityMap(view), best = -1, top = [];
    for (var i = 0; i < heat.length; i++) {
      if (view.shots[i] !== NONE) continue;
      if (heat[i] > best) { best = heat[i]; top = [i]; } else if (heat[i] === best) top.push(i);
    }
    if (best <= 0) return pickNormal(view, rng);
    return pickRandom(top, rng);
  }
  var AI = { rolig: pickRolig, normal: pickNormal, svaer: pickSvaer };
  function aiPick(level, view, rng) { return (AI[level] || pickNormal)(view, rng || defaultRng); }

  // ---------- Point ----------
  function winPoints(n, shots) { return RULES.winPoint + RULES.unshotPoint * Math.max(0, n * n - shots); }

  // ---------- Et helt spil: kamp efter kamp ----------
  function createRun(sizeId, level, opts) {
    opts = opts || {};
    var size = SIZES[sizeId] || SIZES[DEFAULT_SIZE];
    var n = size.n, rng = opts.rng || defaultRng;
    if (!LEVELS[level]) level = DEFAULT_LEVEL;
    var s = {
      sizeId: size.id, n: n, level: level,
      match: 0, wins: 0, score: 0, sunkTotal: 0, totalShots: 0,
      phase: 'place', turn: 'player', over: false,
      fleet: null, enemy: null, home: null,
      shots: 0, aiShots: 0, lastPlayer: -1, lastAi: -1, matchPoints: null
    };
    function newMatch() {
      s.match++;
      s.phase = 'place'; s.turn = 'player';
      s.fleet = randomFleet(n, rng);
      s.enemy = createSea(n, randomFleet(n, rng));
      s.home = null;
      s.shots = 0; s.aiShots = 0; s.lastPlayer = -1; s.lastAi = -1; s.matchPoints = null;
    }
    function shuffle() { if (s.phase !== 'place') return false; s.fleet = randomFleet(n, rng); return true; }
    function shipById(id) { return s.fleet.filter(function (sh) { return sh.id === id; })[0] || null; }
    // Forhåndsvisning af et skib, der flyttes: stævnen i (x, y), skubbet ind på brættet
    function previewMove(id, x, y, horiz) {
      var sh = shipById(id); if (!sh) return null;
      var p = fitPos(n, sh.len, x, y, horiz);
      return { x: p.x, y: p.y, horiz: horiz, cells: shipCells(n, sh.len, p.x, p.y, horiz), ok: canPlace(n, s.fleet, sh.len, p.x, p.y, horiz, id) };
    }
    function moveShip(id, x, y, horiz) {
      if (s.phase !== 'place') return { ok: false };
      var pv = previewMove(id, x, y, horiz);
      if (!pv || !pv.ok) return { ok: false };
      var k = s.fleet.indexOf(shipById(id));
      s.fleet[k] = makeShip(FLEET.filter(function (d) { return d.id === id; })[0], n, pv.x, pv.y, horiz);
      return { ok: true, ship: s.fleet[k] };
    }
    function begin() {
      if (s.phase !== 'place' || !validFleet(n, s.fleet)) return false;
      s.home = createSea(n, s.fleet);
      s.phase = 'battle'; s.turn = 'player';
      return true;
    }
    function playerFire(i) {
      if (s.phase !== 'battle' || s.turn !== 'player') return { ok: false };
      var res = fire(s.enemy, i);
      if (!res.ok) return res;
      s.shots++; s.totalShots++; s.lastPlayer = i;
      res.points = 0;
      if (res.result === 'sunk') { s.sunkTotal++; res.points += RULES.sunkPoint; }
      if (res.allSunk) {
        var wp = winPoints(n, s.shots);
        res.points += wp;
        s.wins++; s.phase = 'won';
        s.matchPoints = { win: RULES.winPoint, unshot: n * n - s.shots, unshotPoints: wp - RULES.winPoint, total: wp + RULES.sunkPoint * FLEET.length };
      } else s.turn = 'ai';
      s.score += res.points;
      return res;
    }
    function aiFire(forceIndex) {
      if (s.phase !== 'battle' || s.turn !== 'ai') return { ok: false };
      var i = typeof forceIndex === 'number' ? forceIndex : aiPick(s.level, viewOf(s.home), rng);
      var res = fire(s.home, i);
      if (!res.ok) return res;
      s.aiShots++; s.lastAi = i;
      if (res.allSunk) { s.phase = 'lost'; s.over = true; }
      else s.turn = 'player';
      return res;
    }
    function nextMatch() { if (s.phase !== 'won') return false; newMatch(); return true; }
    function enemyLeft() { return s.enemy.ships.filter(function (sh) { return !sh.sunk; }).length; }
    function homeLeft() { return s.home ? s.home.ships.filter(function (sh) { return !sh.sunk; }).length : FLEET.length; }

    newMatch();
    return {
      state: s, n: n, shuffle: shuffle, previewMove: previewMove, moveShip: moveShip, shipById: shipById,
      begin: begin, playerFire: playerFire, aiFire: aiFire, nextMatch: nextMatch,
      enemyLeft: enemyLeft, homeLeft: homeLeft,
      _setFleets: function (mine, theirs) { if (mine) s.fleet = mine; if (theirs) s.enemy = createSea(n, theirs); }
    };
  }

  global.SoeslagGame = {
    SIZES: SIZES, DEFAULT_SIZE: DEFAULT_SIZE, FLEET: FLEET, FLEET_CELLS: FLEET_CELLS,
    LEVELS: LEVELS, LEVEL_ORDER: LEVEL_ORDER, DEFAULT_LEVEL: DEFAULT_LEVEL, RULES: RULES,
    NONE: NONE, MISS: MISS, HIT: HIT, SUNK: SUNK, COLS: COLS,
    coord: coord, shipCells: shipCells, fitPos: fitPos, haloOf: haloOf, canPlace: canPlace, makeShip: makeShip,
    randomFleet: randomFleet, validFleet: validFleet, createSea: createSea, fire: fire, viewOf: viewOf,
    blockedCells: blockedCells, hitClusters: hitClusters, probabilityMap: probabilityMap,
    aiPick: aiPick, winPoints: winPoints, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
