/*
 * Juveler – spillogik. Ingen DOM, ingen farver, ingen grafik: kun tal.
 * Kan køres i browseren (window.JuvelerGame) og i Node (globalThis.JuvelerGame).
 *
 * Brættet er to arrays med n × n felter (indeks = række * n + kolonne):
 *  - grid: juveltypen 0 … k−1, eller STJERNE (−2), STEN (−3) eller TOM (−1 midt i en opløsning).
 *  - fx:   ekstra egenskaber som bits: LYN (1) = lynjuvel, IS (2) = frossen juvel.
 * Typerne har navne (TYPES), som temaet bruger til at finde grafikken.
 *
 * Regler (se README):
 *  - Byt to nabojuveler, så der opstår mindst tre ens på stribe. Et ugyldigt byt koster intet.
 *  - Striberne forsvinder, alt ovenover falder ned (også sten og frosne juveler), og nye
 *    juveler fylder op fra toppen. Giver det nye striber, fortsætter det (kæde).
 *  - Hvert byt koster ét træk. 4 på stribe +1 træk, 5/L/T +2, kæde fra 3. led +1 pr. led.
 *  - Niveauer: et stigende pointmål. Når det nås: niveau op og +5 træk.
 *    Niv. 2: 4 på stribe efterlader en lynjuvel (rydder rækken eller kolonnen, når den ryddes).
 *    Niv. 3: 5 på stribe, L eller T efterlader en stjernejuvel (byttes med enhver nabo og
 *            fjerner alle juveler af naboens type).
 *    Niv. 4: is – frosne juveler kan ikke byttes, men kan indgå i striber.
 *    Niv. 5: sten – kan ikke byttes og indgår ikke i striber; knuses af en rydning ved siden af (+1 træk).
 *    Niv. 6: opgaver – fx "fjern 8 safirer på 5 træk" giver bonustræk. Ingen straf ved fejl.
 *  - "Vis et tip" koster 20 point (scoren bliver aldrig negativ).
 *  - Spillet slutter, når trækkene er brugt, eller når brættet ikke har flere mulige byt.
 *    Et nyt bræt og et nyt niveau starter aldrig uden et muligt byt.
 */
(function (global) {
  'use strict';

  // Navnene på juveltyperne. Temaet leverer grafik med de samme navne.
  var TYPES = ['rubin', 'safir', 'smaragd', 'topas', 'ametyst', 'opal', 'rav'];
  var TOM = -1, STJERNE = -2, STEN = -3;
  var LYN = 1, IS = 2;
  var SIZES = {
    '6x6': { id: '6x6', n: 6, types: 6, label: '6 × 6' },
    '7x7': { id: '7x7', n: 7, types: 6, label: '7 × 7' },
    '8x8': { id: '8x8', n: 8, types: 6, label: '8 × 8' }
  };
  var SIZE_ORDER = ['6x6', '7x7', '8x8'];
  var RULES = {
    startMoves: 25,        // træk ved start
    moveCost: 1,           // hvert gyldigt byt
    earn4: 1,              // gruppe på 4
    earn5: 2,              // gruppe på 5+ (også L og T)
    earnChain: 1,          // hvert led i en kæde fra det tredje (kæde på 3+)
    earnStone: 1,          // hver knust sten
    maxEarn: 2,            // højst så mange træk tilbage pr. byt fra 4/5/L/T og kæder (sten tæller ikke med)
    pointsPerJewel: 10,    // ganges med kædens led (1, 2, 3 …)
    chainFrom: 3,
    bonus4: 20,
    bonus5: 50,
    bonusStar: 50,         // når en stjernejuvel bruges
    pointsIce: 20,         // pr. brudt is
    pointsStone: 30,       // pr. knust sten
    tipCost: 20,           // "Vis et tip" koster point (scoren bliver aldrig negativ)
    levelMoves: 5,         // ekstra træk ved nyt niveau
    // Pointmål (se goal()): niveau 1 → 2 kræver goalFirst point på 6 × 6, og hvert nyt niveau
    // kræver goalGrowth gange så mange point som det forrige. Større bræt giver flere point pr.
    // byt, så målene ganges med (n / 6)^goalSizePow.
    goalFirst: 500,
    goalGrowth: 1.4,
    goalSizePow: 2,
    lynFrom: 2, starFrom: 3, iceFrom: 4, stoneFrom: 5, taskFrom: 6,
    taskMoves: 5,          // træk til en opgave
    taskReward: 3,         // bonustræk for en klaret opgave
    extraTypeFrom: 8,      // niveau hvor den syvende juveltype (rav) kommer med (0 = aldrig)
    // Hjælpsom opfyldning: de nye juveler, der falder ind, slås om (op til så mange gange),
    // hvis brættet ellers ikke har et muligt byt. Mindre hjælp på højere niveauer.
    help: function (level) { return level <= 3 ? 12 : level <= 6 ? 3 : 1; },
    // Is og sten, der lægges på brættet ved et nyt niveau
    iceFor: function (level, n) { return level < 4 ? 0 : Math.min(Math.floor(n * n / 6), 2 + (level - 3)); },
    stoneFor: function (level, n) { return level < 5 ? 0 : Math.min(n - 1, 1 + (level - 4)); },
    // Fra niveau 7 kan nye juveler, der falder ind fra toppen, være frosne
    iceSpawn: function (level) { return level < 7 ? 0 : Math.min(0.1, 0.02 * (level - 6)); }
  };
  // Pointmålet for at gå fra niveau L til L+1 (samlet point)
  function goal(level, n) {
    var sum = 0, scale = Math.pow((n || 6) / 6, RULES.goalSizePow);
    for (var l = 1; l <= level; l++) sum += Math.round(RULES.goalFirst * scale * Math.pow(RULES.goalGrowth, l - 1) / 50) * 50;
    return sum;
  }
  var ELEMENTS = { 2: 'lyn', 3: 'stjerne', 4: 'is', 5: 'sten', 6: 'opgave' };

  // ---------- Tilfældighed (kan sås, så testene kan gentages) ----------
  function rng(seed) {
    var a = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(r, k) { return Math.floor(r() * k); }
  function zeros(len) { var a = []; for (var i = 0; i < len; i++) a.push(0); return a; }

  // ---------- Hjælpere ----------
  function adjacent(a, b, n) {
    if (a < 0 || b < 0 || a >= n * n || b >= n * n) return false;
    var ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }
  function neighbours(i, n) {
    var x = i % n, y = Math.floor(i / n), r = [];
    if (y > 0) r.push(i - n);
    if (x < n - 1) r.push(i + 1);
    if (y < n - 1) r.push(i + n);
    if (x > 0) r.push(i - 1);
    return r;
  }
  // Til test: ['01201', …] → typer. Tegn: 0–9 type, . tom, * stjernejuvel, # sten,
  // a–g lynjuvel af type 0–6, A–G frossen juvel af type 0–6.
  function parse(rows) {
    var g = [], fx = [];
    rows.forEach(function (row) {
      for (var i = 0; i < row.length; i++) {
        var c = row[i], t, f = 0;
        if (c === '.') t = TOM;
        else if (c === '*') t = STJERNE;
        else if (c === '#') t = STEN;
        else if (c >= 'a' && c <= 'g') { t = c.charCodeAt(0) - 97; f = LYN; }
        else if (c >= 'A' && c <= 'G') { t = c.charCodeAt(0) - 65; f = IS; }
        else t = +c;
        g.push(t); fx.push(f);
      }
    });
    return { grid: g, fx: fx };
  }
  function fromRows(rows) { return parse(rows).grid; }
  function isJewel(t) { return t >= 0; }
  // Kan feltet byttes? (juvel eller stjernejuvel, ikke frossen og ikke sten)
  function movable(g, fx, i) { return (g[i] >= 0 || g[i] === STJERNE) && !(fx && (fx[i] & IS)); }

  // ---------- Striber ----------
  // Alle striber på mindst 3 ens: [{ cells: [...], dir: 'r' | 'c' }]
  // Stjernejuveler, sten og tomme felter indgår aldrig. Frosne juveler gør.
  function findRuns(g, n) {
    var runs = [];
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        var t = g[y * n + x], e = x + 1;
        while (e < n && t >= 0 && g[y * n + e] === t) e++;
        if (t >= 0 && e - x >= 3) { var c = []; for (var k = x; k < e; k++) c.push(y * n + k); runs.push({ cells: c, dir: 'r' }); }
        x = e;
      }
    }
    for (var xx = 0; xx < n; xx++) {
      var yy = 0;
      while (yy < n) {
        var tt = g[yy * n + xx], ee = yy + 1;
        while (ee < n && tt >= 0 && g[ee * n + xx] === tt) ee++;
        if (tt >= 0 && ee - yy >= 3) { var cc = []; for (var kk = yy; kk < ee; kk++) cc.push(kk * n + xx); runs.push({ cells: cc, dir: 'c' }); }
        yy = ee;
      }
    }
    return runs;
  }
  // Striber, der deler et felt (L og T), lægges sammen til én gruppe.
  // [{ cells: [...] (sorteret), type, size, longest, cross, dirs: { felt: 'r' | 'c' | 'rc' } }]
  function findGroups(g, n) {
    var runs = findRuns(g, n), owner = {}, groups = [];
    runs.forEach(function (run) {
      var hit = null;
      run.cells.forEach(function (c) { if (owner[c] !== undefined && hit === null) hit = owner[c]; });
      if (hit === null) { hit = groups.length; groups.push({ cells: [], runs: [] }); }
      groups[hit].runs.push(run);
      run.cells.forEach(function (c) { if (groups[hit].cells.indexOf(c) < 0) groups[hit].cells.push(c); owner[c] = hit; });
    });
    return groups.map(function (gr) {
      var longest = 0, dirs = {};
      gr.runs.forEach(function (r) {
        longest = Math.max(longest, r.cells.length);
        r.cells.forEach(function (c) { dirs[c] = dirs[c] && dirs[c] !== r.dir ? 'rc' : r.dir; });
      });
      gr.cells.sort(function (a, b) { return a - b; });
      return { cells: gr.cells, type: g[gr.cells[0]], size: gr.cells.length, longest: longest, cross: gr.runs.length > 1, dirs: dirs };
    });
  }
  function hasRun(g, n) { return findRuns(g, n).length > 0; }

  // Giver byttet af a og b en stribe (eller bruges en stjernejuvel)?
  function swapped(g, a, b) { var h = g.slice(); var t = h[a]; h[a] = h[b]; h[b] = t; return h; }
  function wouldMatch(g, n, a, b, fx) {
    if (!adjacent(a, b, n) || !movable(g, fx, a) || !movable(g, fx, b)) return false;
    if (g[a] === STJERNE || g[b] === STJERNE) return true;
    if (g[a] === g[b]) return false;
    return hasRun(swapped(g, a, b), n);
  }
  // Alle mulige byt [[a, b], …] (a < b)
  function allMoves(g, n, fx) {
    var res = [];
    for (var i = 0; i < n * n; i++) {
      if (i % n < n - 1 && wouldMatch(g, n, i, i + 1, fx)) res.push([i, i + 1]);
      if (i + n < n * n && wouldMatch(g, n, i, i + n, fx)) res.push([i, i + n]);
    }
    return res;
  }
  function hasMove(g, n, fx) {
    for (var i = 0; i < n * n; i++) {
      if (i % n < n - 1 && wouldMatch(g, n, i, i + 1, fx)) return true;
      if (i + n < n * n && wouldMatch(g, n, i, i + n, fx)) return true;
    }
    return false;
  }
  // Naboerne til a, som giver et gyldigt byt
  function validTargets(g, n, a, fx) {
    return neighbours(a, n).filter(function (b) { return wouldMatch(g, n, a, b, fx); });
  }

  // ---------- Fald og opfyldning ----------
  // Fjerner felterne i `cells`, lader alt andet falde (sten og frosne juveler falder med)
  // og fylder op med nye juveler ovenfra.
  // Returnerer { grid, fx, falls: [{ from, to }], spawns: [{ to, drop }] }
  // haz: { ice, stone } = sandsynlighed for, at en ny juvel er frossen eller en sten (høje niveauer)
  function collapse(g, fx, n, cells, k, r, haz) {
    var h = g.slice(), f = fx ? fx.slice() : zeros(g.length), falls = [], spawns = [];
    cells.forEach(function (c) { h[c] = TOM; f[c] = 0; });
    for (var x = 0; x < n; x++) {
      var write = n - 1;
      for (var y = n - 1; y >= 0; y--) {
        var i = y * n + x;
        if (h[i] !== TOM) {
          if (y !== write) { var to = write * n + x; h[to] = h[i]; f[to] = f[i]; h[i] = TOM; f[i] = 0; falls.push({ from: i, to: to }); }
          write--;
        }
      }
      var empty = write + 1;
      for (var yy = write; yy >= 0; yy--) {
        h[yy * n + x] = randInt(r, k); f[yy * n + x] = 0;
        if (haz && (haz.ice || haz.stone)) {
          var p = r();
          if (p < haz.stone) h[yy * n + x] = STEN;
          else if (p < haz.stone + haz.ice) f[yy * n + x] = IS;
        }
        spawns.push({ to: yy * n + x, drop: empty });
      }
    }
    return { grid: h, fx: f, falls: falls, spawns: spawns };
  }

  // Løser alle striber og kæder (og en brugt stjernejuvel). Returnerer led for led
  // (til animationen) og summen.
  // o: { level: spillets niveau, moved: [a, b] (byttede felter), star: { at, other } }
  function resolve(g, fx, n, k, r, o) {
    o = o || {};
    var lvl = o.level || 1;
    var steps = [], cur = g.slice(), cf = fx ? fx.slice() : zeros(g.length), guard = 0;
    var tot = { points: 0, earned: 0, crushed: 0, ice: 0, lyn: 0, stars: 0, made: { lyn: 0, stjerne: 0 }, byType: zeros(TYPES.length) };
    var first = true;
    while (guard++ < 200) {
      var chain = steps.length + 1;
      var removed = {}, order = [], created = [], spot = {}, fired = [], crushed = [], broken = [], lynQ = [];
      var groups = [], stepEarn = 0, bonusPts = 0, starUse = null;
      var rem = function (i, dir) {
        if (removed[i] || spot[i] || cur[i] === TOM) return;
        removed[i] = true; order.push(i);
        if (cur[i] === STEN) { crushed.push(i); return; }
        if ((cf[i] & LYN) && cur[i] >= 0) lynQ.push({ i: i, dir: dir });
      };
      if (first && o.star) {
        // Stjernejuvel: fjerner alle juveler af naboens type (to stjerner: alle juveler)
        var ot = cur[o.star.other];
        starUse = { at: o.star.at, other: o.star.other, type: ot };
        rem(o.star.at, 'r');
        if (ot === STJERNE) { for (var a = 0; a < cur.length; a++) if (cur[a] >= 0 || cur[a] === STJERNE) rem(a, 'r'); }
        else for (var b = 0; b < cur.length; b++) if (cur[b] === ot) rem(b, 'r');
        bonusPts += RULES.bonusStar;
        tot.stars++;
      } else {
        groups = findGroups(cur, n);
        if (!groups.length) break;
        groups.forEach(function (gr) {
          var make = null;
          if (gr.size >= 5 || gr.longest >= 5) {
            bonusPts += RULES.bonus5 * chain; stepEarn += RULES.earn5; gr.kind = 'fem';
            if (lvl >= RULES.starFrom) make = 'stjerne';
          } else if (gr.size === 4) {
            bonusPts += RULES.bonus4 * chain; stepEarn += RULES.earn4; gr.kind = 'fire';
            if (lvl >= RULES.lynFrom) make = 'lyn';
          } else gr.kind = 'tre';
          if (make) {
            // Den nye juvel lægges, hvor spilleren byttede (ellers midt i gruppen)
            var cand = gr.cells.filter(function (c) { return !(cf[c] & (IS | LYN)) && !spot[c]; });
            var at = null;
            if (first && o.moved) o.moved.forEach(function (m) { if (at === null && cand.indexOf(m) >= 0) at = m; });
            if (at === null && cand.length) at = cand[Math.floor((cand.length - 1) / 2)];
            if (at !== null) { spot[at] = true; created.push({ i: at, kind: make, type: gr.type }); gr.made = make; }
          }
        });
        groups.forEach(function (gr) { gr.cells.forEach(function (c) { rem(c, gr.dirs[c]); }); });
      }
      first = false;
      // Lynjuveler, der ryddes, rydder deres linje: langs striben, på tværs af et andet lyn,
      // rækken ved en stjernejuvel. Sten i linjen knuses.
      while (lynQ.length) {
        var q = lynQ.shift();
        fired.push(q.i);
        var qx = q.i % n, qy = Math.floor(q.i / n);
        if (q.dir.indexOf('r') >= 0) for (var x1 = 0; x1 < n; x1++) rem(qy * n + x1, 'c');
        if (q.dir.indexOf('c') >= 0) for (var y1 = 0; y1 < n; y1++) rem(y1 * n + qx, 'r');
      }
      // Ved siden af en rydning: sten knuses, og is brydes (juvelen bliver fri)
      var jewelsGone = order.filter(function (i) { return cur[i] !== STEN; });
      jewelsGone.forEach(function (i) {
        neighbours(i, n).forEach(function (j) {
          if (removed[j] || spot[j]) return;
          if (cur[j] === STEN) { removed[j] = true; order.push(j); crushed.push(j); }
          else if ((cf[j] & IS) && broken.indexOf(j) < 0) broken.push(j);
        });
      });
      var iceGone = jewelsGone.filter(function (i) { return cf[i] & IS; });
      var counted = jewelsGone.filter(function (i) { return cur[i] >= 0; }).length + created.length;
      var stepPts = counted * RULES.pointsPerJewel * chain + bonusPts + (broken.length + iceGone.length) * RULES.pointsIce + crushed.length * RULES.pointsStone;
      if (chain >= RULES.chainFrom) stepEarn += RULES.earnChain;
      stepEarn += crushed.length * RULES.earnStone;
      var byType = zeros(TYPES.length);
      jewelsGone.forEach(function (i) { if (cur[i] >= 0) byType[cur[i]]++; });
      // Nyt bræt: is brydes, nye lyn- og stjernejuveler lægges, så falder alt
      var nx = cur.slice(), nf = cf.slice();
      broken.forEach(function (i) { nf[i] &= ~IS; });
      created.forEach(function (c) { nx[c.i] = c.kind === 'stjerne' ? STJERNE : c.type; nf[c.i] = c.kind === 'lyn' ? LYN : 0; });
      var col = collapse(nx, nf, n, order, k, r, o.haz);
      steps.push({
        level: chain, groups: groups, removed: order.slice().sort(function (a, b) { return a - b; }),
        crushed: crushed, broken: broken, iceGone: iceGone, fired: fired, created: created, star: starUse,
        before: cur, beforeFx: cf, falls: col.falls, spawns: col.spawns, grid: col.grid, fx: col.fx,
        points: stepPts, earned: stepEarn, byType: byType
      });
      tot.points += stepPts; tot.earned += stepEarn; tot.crushed += crushed.length;
      tot.ice += broken.length + iceGone.length; tot.lyn += fired.length;
      created.forEach(function (c) { tot.made[c.kind]++; });
      byType.forEach(function (v, t) { tot.byType[t] += v; });
      cur = col.grid; cf = col.fx;
    }
    return { grid: cur, fx: cf, steps: steps, points: tot.points, earned: tot.earned, crushed: tot.crushed, ice: tot.ice, lyn: tot.lyn, stars: tot.stars, made: tot.made, byType: tot.byType };
  }

  // ---------- Nyt bræt: ingen striber fra start, mindst ét muligt byt ----------
  function freshBoard(n, k, r) {
    for (var tries = 0; tries < 500; tries++) {
      var g = [];
      for (var i = 0; i < n * n; i++) {
        var x = i % n, y = Math.floor(i / n), t, guard = 0;
        do {
          t = randInt(r, k);
          guard++;
        } while (guard < 50 && ((x >= 2 && g[i - 1] === t && g[i - 2] === t) || (y >= 2 && g[i - n] === t && g[i - 2 * n] === t)));
        g.push(t);
      }
      if (!hasRun(g, n) && hasMove(g, n)) return g;
    }
    throw new Error('Kunne ikke lave et bræt');
  }

  // Læg `count` is eller sten på almindelige juveler, så brættet stadig har et muligt byt.
  // Returnerer felterne (måske færre, hvis der ikke er plads).
  function place(g, fx, n, kind, count, r) {
    for (var want = count; want > 0; want--) {
      for (var tries = 0; tries < 60; tries++) {
        var free = [];
        for (var i = 0; i < g.length; i++) if (g[i] >= 0 && !fx[i]) free.push(i);
        if (free.length < want) break;
        var pick = [];
        while (pick.length < want) { var c = free.splice(randInt(r, free.length), 1)[0]; pick.push(c); }
        var h = g.slice(), f = fx.slice();
        pick.forEach(function (c) { if (kind === 'sten') h[c] = STEN; else f[c] |= IS; });
        if (hasMove(h, n, f)) {
          pick.forEach(function (c) { if (kind === 'sten') g[c] = STEN; else fx[c] |= IS; });
          return pick.sort(function (a, b) { return a - b; });
        }
      }
    }
    return [];
  }

  // ---------- Opgaver (fra niveau 6) ----------
  function makeTask(state, r) {
    var L = state.level, g = state.grid, fx = state.fx, iceN = 0, stoneN = 0, present = [];
    for (var i = 0; i < g.length; i++) {
      if (fx[i] & IS) iceN++;
      if (g[i] === STEN) stoneN++;
      if (g[i] >= 0 && present.indexOf(g[i]) < 0) present.push(g[i]);
    }
    var kinds = ['fjern', 'fjern'];
    if (iceN >= 3) kinds.push('is');
    if (stoneN >= 2) kinds.push('sten');
    var kind = kinds[randInt(r, kinds.length)], step = Math.max(0, L - RULES.taskFrom);
    var t = { kind: kind, progress: 0, left: RULES.taskMoves, moves: RULES.taskMoves, reward: RULES.taskReward, id: (state.tasksMade = (state.tasksMade || 0) + 1) };
    if (kind === 'fjern') { t.type = present[randInt(r, present.length)]; t.goal = Math.min(16, 7 + step); }
    else if (kind === 'is') t.goal = Math.min(iceN, 3 + Math.floor(step / 3));
    else t.goal = Math.min(stoneN, 2 + Math.floor(step / 3));
    return t;
  }

  // ---------- Et spil ----------
  function createRun(sizeId, opts) {
    opts = opts || {};
    var size = SIZES[sizeId] || SIZES['7x7'];
    var r = rng(opts.seed);
    var n = size.n, k = size.types;
    var state = {
      size: size.id, n: n, k: k,
      grid: freshBoard(n, k, r), fx: zeros(n * n),
      moves: RULES.startMoves, score: 0, swaps: 0, level: 1, goal: goal(1, n), prevGoal: 0,
      bestChain: 0, earnedTotal: 0, tips: 0, tipPoints: 0,
      made: { lyn: 0, stjerne: 0 }, iceBroken: 0, stonesCrushed: 0, tasksDone: 0, tasksFailed: 0, task: null,
      over: false, overReason: null, ended: false
    };
    // Nyt niveau: +træk, nye elementer, mere is og sten. Brættet har bagefter altid et muligt byt.
    function levelUp() {
      var L = ++state.level;
      state.prevGoal = state.goal;
      state.goal = goal(L, n);
      state.moves += RULES.levelMoves;
      var ev = { level: L, moves: RULES.levelMoves, element: ELEMENTS[L] || null, ice: [], stones: [], newBoard: false, extraType: false };
      if (RULES.extraTypeFrom && L === RULES.extraTypeFrom && state.k < TYPES.length) { state.k = k = TYPES.length; ev.extraType = true; ev.element = 'rav'; }
      if (!hasMove(state.grid, n, state.fx)) { state.grid = freshBoard(n, k, r); state.fx = zeros(n * n); ev.newBoard = true; }
      var iceOn = 0; state.fx.forEach(function (f) { if (f & IS) iceOn++; });
      var stoneOn = 0; state.grid.forEach(function (t) { if (t === STEN) stoneOn++; });
      var cap = Math.floor(n * n / 4);
      ev.ice = place(state.grid, state.fx, n, 'is', Math.max(0, Math.min(RULES.iceFor(L, n), cap - iceOn)), r);
      ev.stones = place(state.grid, state.fx, n, 'sten', Math.max(0, Math.min(RULES.stoneFor(L, n), n + 2 - stoneOn)), r);
      if (L >= RULES.taskFrom && !state.task) { state.task = makeTask(state, r); ev.task = state.task; }
      return ev;
    }
    function updateTask(res) {
      var t = state.task;
      if (!t) return null;
      var add = t.kind === 'fjern' ? res.byType[t.type] : t.kind === 'is' ? res.ice : res.crushed;
      t.progress = Math.min(t.goal, t.progress + add);
      t.left--;
      if (t.progress >= t.goal) {
        state.moves += t.reward; state.tasksDone++;
        state.task = makeTask(state, r);
        return { done: true, task: t, next: state.task };
      }
      if (t.left <= 0) {
        state.tasksFailed++;
        state.task = makeTask(state, r);
        return { failed: true, task: t, next: state.task };
      }
      return null;
    }
    function swap(a, b) {
      if (state.over || state.ended) return { ok: false, reason: 'slut' };
      if (!adjacent(a, b, n)) return { ok: false, reason: 'ikke-nabo' };
      var g = state.grid, fx = state.fx;
      if (g[a] === STEN || g[b] === STEN) return { ok: false, reason: 'sten' };
      if ((fx[a] & IS) || (fx[b] & IS)) return { ok: false, reason: 'is' };
      if (g[a] === g[b] && g[a] !== STJERNE) return { ok: false, reason: 'ens' };
      if (!wouldMatch(g, n, a, b, fx)) return { ok: false, reason: 'ingen' };
      var before = g.slice(), beforeFx = fx.slice();
      var sg = swapped(g, a, b), sf = swapped(fx, a, b);
      var o = { level: state.level, moved: [a, b], haz: { ice: RULES.iceSpawn(state.level), stone: 0 } };
      if (sg[b] === STJERNE) o.star = { at: b, other: a };
      else if (sg[a] === STJERNE) o.star = { at: a, other: b };
      // Hjælpsom opfyldning: de nye juveler slås om, hvis brættet ellers ikke har et muligt byt
      var res, tries = RULES.help(state.level);
      for (var t = 0; t < tries; t++) {
        res = resolve(sg, sf, n, k, r, o);
        if (hasMove(res.grid, n, res.fx)) break;
      }
      state.grid = res.grid; state.fx = res.fx;
      state.swaps++;
      state.score += res.points;
      // Højst RULES.maxEarn træk tilbage fra kombinationer pr. byt (knuste sten giver altid +1)
      var stoneEarn = res.crushed * RULES.earnStone;
      res.earned = Math.min(RULES.maxEarn, res.earned - stoneEarn) + stoneEarn;
      state.moves += res.earned - RULES.moveCost;
      state.earnedTotal += res.earned;
      state.bestChain = Math.max(state.bestChain, res.steps.length);
      state.made.lyn += res.made.lyn; state.made.stjerne += res.made.stjerne;
      state.iceBroken += res.ice; state.stonesCrushed += res.crushed;
      var movesBeforeTask = state.moves;
      var task = updateTask(res);
      var taskMoves = state.moves - movesBeforeTask;
      var levels = [];
      while (state.score >= state.goal) levels.push(levelUp());
      // Game over: trækkene er brugt, eller brættet har ikke flere mulige byt
      if (state.moves <= 0) { state.moves = 0; state.over = true; state.overReason = 'traek'; }
      else if (!hasMove(state.grid, n, state.fx)) { state.over = true; state.overReason = 'ingen-byt'; }
      return {
        ok: true, a: a, b: b, before: before, beforeFx: beforeFx, star: !!o.star, steps: res.steps,
        points: res.points, earned: res.earned, chain: res.steps.length, crushed: res.crushed, ice: res.ice, lyn: res.lyn,
        made: res.made, task: task, taskMoves: taskMoves, levels: levels,
        grid: state.grid.slice(), fx: state.fx.slice(), over: state.over, overReason: state.overReason
      };
    }
    function moves() { return allMoves(state.grid, n, state.fx); }
    return {
      state: state, n: n, get k() { return k; },
      swap: swap,
      targets: function (a) { return state.over ? [] : validTargets(state.grid, n, a, state.fx); },
      canSwap: function (a, b) { return wouldMatch(state.grid, n, a, b, state.fx); },
      // Et muligt byt uden at betale (til test og intern brug)
      hint: function () { var m = moves(); return m.length ? m[randInt(r, m.length)] : null; },
      // "Vis et tip": et muligt byt for RULES.tipCost point (aldrig under 0 point)
      tip: function () {
        if (state.over || state.ended) return null;
        var m = moves();
        if (!m.length) return null;
        var paid = Math.min(RULES.tipCost, state.score);
        state.score -= paid; state.tips++; state.tipPoints += paid;
        return { move: m[randInt(r, m.length)], cost: paid };
      },
      end: function () { state.ended = true; return { score: state.score, swaps: state.swaps, level: state.level }; },
      // Kun til test: læg et bestemt bræt ind (grid, træk, point, fx)
      _load: function (g, mv, score, fx) {
        state.grid = g.slice(); state.fx = fx ? fx.slice() : zeros(g.length);
        if (mv !== undefined) state.moves = mv;
        if (score !== undefined) state.score = score;
        state.over = false; state.overReason = null;
      },
      // Kun til test: spring til et niveau (som om målet var nået)
      _level: function (L) { var evs = []; while (state.level < L) evs.push(levelUp()); state.score = Math.max(state.score, state.prevGoal); return evs; },
      _task: function (t) { state.task = t; }
    };
  }

  // ---------- Rekorder ----------
  // Ekstra felter i en rekord: levels = antal byt (som i de gamle rekorder), niveau = nået niveau
  function recordExtra(out) { return { levels: out.swaps, niveau: out.level }; }
  // " · niv. 4 · 37 byt" – gamle rekorder uden niveau vises kun med byt
  function recordLabel(e) {
    var swaps = typeof e.levels === 'number' ? e.levels : 0;
    return (typeof e.niveau === 'number' ? ' · niv. ' + e.niveau : '') + ' · ' + swaps + ' byt';
  }

  global.JuvelerGame = {
    recordExtra: recordExtra, recordLabel: recordLabel,
    TYPES: TYPES, SIZES: SIZES, SIZE_ORDER: SIZE_ORDER, RULES: RULES, ELEMENTS: ELEMENTS,
    TOM: TOM, STJERNE: STJERNE, STEN: STEN, LYN: LYN, IS: IS,
    rng: rng, adjacent: adjacent, neighbours: neighbours, fromRows: fromRows, parse: parse,
    movable: movable, isJewel: isJewel, goal: goal,
    findRuns: findRuns, findGroups: findGroups, hasRun: hasRun, wouldMatch: wouldMatch,
    allMoves: allMoves, hasMove: hasMove, validTargets: validTargets,
    collapse: collapse, resolve: resolve, freshBoard: freshBoard, place: place, makeTask: makeTask,
    createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
