/*
 * Løberen – spillogik (ingen DOM). Turbaseret løbespil i tre baner.
 *
 * Verden består af segmenter. Hvert segment er ét stop: spillet fryser foran
 * det, og spilleren vælger én handling. Intet sker, før der er valgt, og der er
 * ingen ure eller tidsgrænser.
 *
 * Hvert segment har én ting pr. bane (0 = venstre, 1 = midten, 2 = højre):
 *   'fri'   ingenting – alle handlinger, der ender her, er sikre
 *   'lav'   lav barriere – kun Hop er sikkert
 *   'hoej'  høj bjælke – kun Dyk er sikkert
 *   'tog'   tog/mur – banen er spærret, intet er sikkert her
 * og evt. en mønt pr. bane (samles, når man passerer banen uden at blive ramt).
 *
 * Handlinger: venstre, hoejre (skift én bane – sikkert kun ind i en fri bane),
 * hop (bliv i banen og hop), dyk (bliv i banen og glid), bliv (løb lige ud).
 * Venstre i venstre bane og højre i højre bane er umulige (slået fra).
 *
 * Forkert valg koster et liv. Ved 0 liv er spillet slut.
 * Point = meter + mønter × 10. Hvert segment er 10 meter.
 *
 * Generatoren holder styr på, hvilke baner man kan nå uden at blive ramt
 * (R). Hvert nyt segment skal kunne passeres sikkert fra mindst én af de
 * baner, så der altid findes en sikker vej. På Normal og Svær kan nogle baner
 * føre ind i en blindgyde (fx to spærrede baner), så man skal planlægge et par
 * stop frem. På Rolig findes der aldrig blindgyder: fra alle baner er der
 * altid mindst ét sikkert valg.
 */
(function (global) {
  'use strict';

  var LANES = 3;
  var VIEW = 6;               // antal segmenter, man kan se forude
  var METERS = 10;            // meter pr. segment
  var COIN_POINTS = 10;
  var START_LIVES = 3;
  var ACTIONS = ['venstre', 'hoejre', 'hop', 'dyk', 'bliv'];
  var OBST = ['fri', 'lav', 'hoej', 'tog'];

  var DIFFS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  traps: false, ramp: 3000, base: 0.0,  coins: 0.5 },
    normal: { id: 'normal', name: 'Normal', traps: true,  ramp: 1600, base: 0.1,  coins: 0.45 },
    svaer:  { id: 'svaer',  name: 'Svær',   traps: true,  ramp: 800,  base: 0.35, coins: 0.4 }
  };

  function target(lane, action) {
    if (action === 'venstre') return lane - 1;
    if (action === 'hoejre') return lane + 1;
    return lane;
  }
  function possible(lane, action) {
    if (ACTIONS.indexOf(action) < 0) return false;
    var t = target(lane, action);
    return t >= 0 && t < LANES;
  }
  // Er handlingen sikker i dette segment fra denne bane?
  function safe(seg, lane, action) {
    if (!possible(lane, action)) return false;
    var o = seg.lanes[target(lane, action)];
    if (o === 'tog') return false;
    if (o === 'fri') return true;
    if (o === 'lav') return action === 'hop';
    if (o === 'hoej') return action === 'dyk';
    return false;
  }
  // Hvad rammer man? (null = sikkert)
  function cause(seg, lane, action) {
    if (safe(seg, lane, action)) return null;
    return seg.lanes[target(lane, action)];
  }
  function safeActions(seg, lane) {
    return ACTIONS.filter(function (a) { return safe(seg, lane, a); });
  }
  function nextLanes(seg, lane) {
    var out = [];
    safeActions(seg, lane).forEach(function (a) { var t = target(lane, a); if (out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function reach(seg, from) {
    var out = [];
    from.forEach(function (l) { nextLanes(seg, l).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); }); });
    return out.sort();
  }
  // Kan man komme sikkert igennem alle segmenterne segs[start..] fra banen?
  function survivable(segs, start, lane) {
    var cur = [lane];
    for (var i = start; i < segs.length; i++) {
      cur = reach(segs[i], cur);
      if (!cur.length) return false;
    }
    return true;
  }

  // ---------- Generator ----------
  function makeGenerator(diff, rng) {
    var R = [1];
    var startLane = 1;
    var hist = [];               // segmenter siden sidste nulstilling
    var rhist = [];              // R efter hvert af dem
    var trains = [0, 0, 0];      // resterende segmenter med tog pr. bane
    var divider = 0;             // midterbanen er spærret (vejen deler sig)
    var coinRun = { lane: -1, left: 0 };
    var sinceNarrow = 9;
    var count = 0;

    function pick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

    function level(meters) { return Math.min(1, diff.base + meters / diff.ramp); }

    function candidate(p) {
      var lanes = ['fri', 'fri', 'fri'];
      var newTrains = trains.slice(), newDivider = divider, narrow = false;
      // fortsæt tog og skillevæg
      for (var l = 0; l < LANES; l++) if (newTrains[l] > 0) { lanes[l] = 'tog'; newTrains[l]--; }
      if (newDivider > 0) { lanes[1] = 'tog'; newDivider--; }
      var free = [0, 1, 2].filter(function (x) { return lanes[x] === 'fri'; });
      // nye ting
      var r = rng();
      if (free.length === 3) {
        if (diff.traps && p > 0.25 && sinceNarrow >= 3 && r < 0.12 + 0.12 * p) {
          // to spærrede baner: kun én er åben (planlæg frem)
          var open = pick([0, 1, 2]);
          [0, 1, 2].forEach(function (x) { if (x !== open) lanes[x] = 'tog'; });
          lanes[open] = rng() < p * 0.5 ? pick(['lav', 'hoej']) : 'fri';
          narrow = true;
        } else if (p > 0.15 && r < 0.12 + 0.08 * p) {
          // vejen deler sig: midterbanen spærres i 2-4 stop
          lanes[1] = 'tog';
          newDivider = Math.floor(rng() * (1 + Math.round(2.4 * p)));
          if (rng() < 0.3 + 0.5 * p) lanes[pick([0, 2])] = pick(['lav', 'hoej']);
        } else if (r < 0.45) {
          // et tog i én bane i flere stop
          var tl = pick([0, 1, 2]);
          lanes[tl] = 'tog';
          newTrains[tl] = Math.floor(rng() * (1 + Math.round(2.6 * p)));
          var others = [0, 1, 2].filter(function (x) { return x !== tl; });
          others.forEach(function (x) { if (rng() < 0.15 + 0.55 * p) lanes[x] = pick(['lav', 'hoej']); });
        } else {
          // barrierer og bjælker
          var n = 1 + (rng() < 0.2 + 0.6 * p ? 1 : 0) + (rng() < 0.6 * p ? 1 : 0);
          var order = [0, 1, 2].sort(function () { return rng() - 0.5; });
          for (var k = 0; k < n; k++) lanes[order[k]] = pick(['lav', 'hoej', p > 0.3 && rng() < 0.3 ? 'tog' : 'lav']);
        }
      } else {
        free.forEach(function (x) { if (rng() < 0.2 + 0.5 * p) lanes[x] = pick(['lav', 'hoej']); });
      }
      return { lanes: lanes, trains: newTrains, divider: newDivider, narrow: narrow };
    }

    // Baner, hvor spilleren kan stå, når det nye segment først bliver synligt,
    // og som indtil da ser ud til at føre et sted hen. De skal stadig føre et
    // sted hen med det nye segment, så en blindgyde altid kan ses i tide.
    function mustSurvive() {
      var n = hist.length, start = Math.max(0, n - VIEW + 1);
      var from = start === 0 ? [startLane] : rhist[start - 1];
      var seen = hist.slice(start);
      return { seen: seen, lanes: from.filter(function (l) { return survivable(seen, 0, l); }) };
    }
    function valid(seg) {
      if (seg.lanes.every(function (o) { return o === 'fri'; })) return false;
      if (!reach(seg, R).length) return false;
      var m = mustSurvive(), seen = m.seen.concat([seg]);
      for (var i = 0; i < m.lanes.length; i++) if (!survivable(seen, 0, m.lanes[i])) return false;
      if (!diff.traps) {
        for (var l = 0; l < LANES; l++) if (!nextLanes(seg, l).length) return false;
      }
      return true;
    }

    function addCoins(seg) {
      seg.coins = [false, false, false];
      if (coinRun.left <= 0 && rng() < diff.coins) {
        coinRun = { lane: Math.floor(rng() * 3) % 3, left: 2 + Math.floor(rng() * 4) };
      }
      if (coinRun.left > 0) {
        coinRun.left--;
        var l = coinRun.lane;
        if (seg.lanes[l] === 'tog') {
          // flyt mønterne til en nabobane, der ikke er spærret
          var alt = [l - 1, l + 1].filter(function (x) { return x >= 0 && x < 3 && seg.lanes[x] !== 'tog'; });
          if (alt.length) { l = alt[0]; coinRun.lane = l; } else l = -1;
        }
        if (l >= 0) seg.coins[l] = true;
      }
    }

    return {
      level: level,
      reset: function (lane) {
        R = [lane]; startLane = lane; hist = []; rhist = []; trains = [0, 0, 0]; divider = 0; sinceNarrow = 0; coinRun = { lane: -1, left: 0 };
      },
      get R() { return R.slice(); },
      next: function (meters, easy) {
        var p = easy ? 0 : level(meters);
        var seg = null, c = null;
        for (var tries = 0; tries < 60; tries++) {
          c = candidate(p);
          var s = { lanes: c.lanes };
          if (valid(s)) { seg = s; break; }
          // ugyldigt: drop fortsatte tog og prøv igen
          if (tries > 20) { trains = [0, 0, 0]; divider = 0; }
        }
        if (!seg) {
          // nødløsning: én lav barriere i en tilfældig bane – altid sikker fra alle baner
          var b = Math.floor(rng() * 3) % 3;
          seg = { lanes: ['fri', 'fri', 'fri'] }; seg.lanes[b] = 'lav';
          c = { trains: [0, 0, 0], divider: 0, narrow: false };
        }
        trains = c.trains; divider = c.divider;
        sinceNarrow = c.narrow ? 0 : sinceNarrow + 1;
        R = reach(seg, R);
        hist.push(seg); rhist.push(R.slice());
        if (hist.length > 4 * VIEW) { hist.splice(0, VIEW); rhist.splice(0, VIEW); }
        addCoins(seg);
        seg.id = ++count;
        return seg;
      }
    };
  }

  // ---------- Et spil ----------
  function createRun(diffId, opts) {
    opts = opts || {};
    var diff = DIFFS[diffId] || DIFFS.normal;
    var rng = opts.rng || Math.random;
    var gen = makeGenerator(diff, rng);
    var state = {
      diff: diff.id, lane: 1, lives: START_LIVES, meters: 0, coins: 0, score: 0,
      segs: [], over: false, hits: 0, turns: 0, lastCause: null
    };
    function fill(easyFirst) {
      while (state.segs.length < VIEW) {
        state.segs.push(gen.next(state.meters + state.segs.length * METERS, easyFirst && state.segs.length === 0));
      }
    }
    gen.reset(state.lane);
    fill(true);

    function score() { state.score = state.meters + state.coins * COIN_POINTS; }

    var api = {
      state: state,
      diff: diff,
      get gen() { return gen; },
      next: function () { return state.segs[0]; },
      possible: function (a) { return !state.over && possible(state.lane, a); },
      safe: function (a) { return !state.over && safe(state.segs[0], state.lane, a); },
      cause: function (a) { return cause(state.segs[0], state.lane, a); },
      safeActions: function () { return safeActions(state.segs[0], state.lane); },
      // Fører handlingen til en blindgyde i de segmenter, man kan se?
      deadEnd: function (a) {
        if (!api.safe(a)) return false;
        return !survivable(state.segs, 1, target(state.lane, a));
      },
      level: function () { return gen.level(state.meters); },
      act: function (a) {
        if (state.over || !possible(state.lane, a)) return { ignored: true };
        var seg = state.segs[0], from = state.lane, t = target(from, a);
        var ok = safe(seg, from, a);
        var res = { action: a, from: from, to: t, seg: seg, safe: ok, coin: false, cause: null, over: false };
        state.lane = t;
        state.turns++;
        state.meters += METERS;
        if (ok) {
          if (seg.coins && seg.coins[t]) { state.coins++; res.coin = true; }
        } else {
          state.lives--; state.hits++;
          res.cause = state.lastCause = seg.lanes[t];
          if (state.lives <= 0) { state.lives = 0; state.over = true; res.over = true; }
        }
        state.segs.shift();
        if (!ok && !state.over) {
          // Mistet liv: vejen forude laves igen fra den bane, man står i,
          // og første stop er let, så man ikke er fanget i en blindgyde.
          state.segs = [];
          gen.reset(t);
          fill(true);
        } else {
          fill(false);
        }
        score();
        return res;
      }
    };
    return api;
  }

  global.LoeberenGame = {
    LANES: LANES, VIEW: VIEW, METERS: METERS, COIN_POINTS: COIN_POINTS, START_LIVES: START_LIVES,
    ACTIONS: ACTIONS, OBST: OBST, DIFFS: DIFFS,
    target: target, possible: possible, safe: safe, cause: cause, safeActions: safeActions,
    nextLanes: nextLanes, reach: reach, survivable: survivable,
    makeGenerator: makeGenerator, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
