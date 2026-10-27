/*
 * Løberen – spillogik (ingen DOM). Turbaseret løbespil i tre baner gennem et
 * digitalt neonnet (datanet). Ingen ure og ingen tidsgrænser: spillet fryser
 * foran hvert stop, til spilleren har valgt én handling.
 *
 * Spilleren har en bane (0 = venstre, 1 = midten, 2 = højre) og en højde
 * (0 = nede på nettet, 1 = oppe på en datablok).
 *
 * Hvert segment (stop) har én celle pr. bane:
 *   Nede på nettet
 *     'fri'        intet – alt, der ender her, er sikkert
 *     'lav'        lav laserbarriere – kun Hop
 *     'hoej'       høj lysbjælke/port – kun Dyk
 *     'mur'        firewall – spærrer banen i alle højder
 *   Datablokke (man står oppe på dem)
 *     'rampe'      blokkens start med rampe – man løber op ad den (alt er sikkert)
 *     'blok'       bloktag uden noget – sikkert oppefra; nedefra er det en mur
 *     'blok-lav'   laserbarriere på taget – kun Hop (oppefra)
 *     'blok-hoej'  lavthængende bjælke over taget – kun Dyk (oppefra)
 * og evt. en mønt pr. bane.
 *
 * Handlinger: venstre, hoejre (skift én bane i samme højde), hop, dyk, bliv.
 *  - Nede: en blok kan kun nås ad en rampe ('rampe'). En blok uden rampe er en mur.
 *  - Oppe: man kan blive oppe, skifte til en blok ved siden af i samme højde,
 *    eller hoppe ned i en side (skift bane ned i en fri bane). Slutter blokken,
 *    lander man nede på nettet (her gælder de almindelige regler: fri = alt,
 *    lav = Hop, høj = Dyk).
 *  - Skift af bane er kun sikkert ind i en fri celle ('fri', 'rampe', 'blok').
 *
 * Forkert valg koster et liv og giver 0 m. Ved 0 liv er spillet slut.
 * Point = meter + mønter × 10. Hvert sikkert stop er 10 meter.
 *
 * Generatoren holder styr på de tilstande (bane, højde), man kan nå uden at
 * blive ramt. Hvert nyt segment skal kunne passeres sikkert, og alle
 * tilstande, der indtil nu så ud til at føre et sted hen, skal stadig gøre
 * det – så en blindgyde altid kan ses i tide. På Rolig er der altid et sikkert
 * valg fra alle baner og højder (ingen blindgyder).
 */
(function (global) {
  'use strict';

  var LANES = 3;
  var VIEW = 6;               // antal segmenter, man kan se forude
  var METERS = 10;            // meter pr. segment
  var COIN_POINTS = 10;
  var START_LIVES = 3;
  var LEVELS = 10;            // niveau 1-10 vises i spillet
  var ACTIONS = ['venstre', 'hoejre', 'hop', 'dyk', 'bliv'];
  var GROUND = ['fri', 'lav', 'hoej', 'mur'];
  var BLOCKS = ['rampe', 'blok', 'blok-lav', 'blok-hoej'];
  var OBST = GROUND.concat(BLOCKS);

  var DIFFS = {
    rolig:  { id: 'rolig',  name: 'Rolig',  traps: false, ramp: 3000, base: 0.0,  coins: 0.26,  noRampMax: 0,    maxP: 0.5 },
    normal: { id: 'normal', name: 'Normal', traps: true,  ramp: 1500, base: 0.08, coins: 0.235, noRampMax: 0.45, maxP: 1 },
    svaer:  { id: 'svaer',  name: 'Svær',   traps: true,  ramp: 750,  base: 0.3,  coins: 0.22,  noRampMax: 0.6,  maxP: 1 }
  };

  function isBlock(c) { return BLOCKS.indexOf(c) >= 0; }
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
  // Resultatet af en handling: { ok, lane, h, cause }
  function outcome(seg, lane, h, action) {
    if (!possible(lane, action)) return null;
    var t = target(lane, action), c = seg.lanes[t], side = t !== lane;
    var r = { ok: false, lane: t, h: 0, cause: c };
    if (isBlock(c)) {
      if (h === 0 && c !== 'rampe') { r.cause = 'blok'; return r; }   // blok uden rampe = mur
      r.h = 1;
      if (c === 'rampe' || c === 'blok') r.ok = true;
      else if (c === 'blok-lav') r.ok = !side && action === 'hop';
      else if (c === 'blok-hoej') r.ok = !side && action === 'dyk';
    } else {
      r.h = 0;
      if (c === 'fri') r.ok = true;
      else if (c === 'lav') r.ok = !side && action === 'hop';
      else if (c === 'hoej') r.ok = !side && action === 'dyk';
      else r.ok = false;   // mur
    }
    if (r.ok) r.cause = null;
    return r;
  }
  function safe(seg, lane, h, action) { var o = outcome(seg, lane, h, action); return !!(o && o.ok); }
  function cause(seg, lane, h, action) { var o = outcome(seg, lane, h, action); return o && !o.ok ? o.cause : null; }
  function safeActions(seg, lane, h) {
    return ACTIONS.filter(function (a) { return safe(seg, lane, h, a); });
  }
  // Tilstande kodes som tal: bane + 3 × højde
  function code(lane, h) { return lane + 3 * h; }
  function nextStates(seg, st) {
    var out = [], lane = st % 3, h = st >= 3 ? 1 : 0;
    ACTIONS.forEach(function (a) {
      var o = outcome(seg, lane, h, a);
      if (o && o.ok) { var k = code(o.lane, o.h); if (out.indexOf(k) < 0) out.push(k); }
    });
    return out;
  }
  function reach(seg, from) {
    var out = [];
    from.forEach(function (s) { nextStates(seg, s).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); }); });
    return out.sort();
  }
  // Kan man komme sikkert igennem alle segmenterne segs[start..] fra tilstanden?
  function survivable(segs, start, st) {
    var cur = [st];
    for (var i = start; i < segs.length; i++) {
      cur = reach(segs[i], cur);
      if (!cur.length) return false;
    }
    return true;
  }

  // ---------- Generator ----------
  function makeGenerator(diff, rng) {
    var R = [code(1, 0)], startState = R[0];
    var hist = [], rhist = [];
    var blocks = [0, 0, 0];      // resterende celler i en datablok pr. bane
    var coinRun = { lane: -1, left: 0 };
    var count = 0;

    function pick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
    function level(meters) { return Math.min(diff.maxP, diff.base + meters / diff.ramp); }

    function candidate(p, easy) {
      var lanes = ['fri', 'fri', 'fri'], nb = blocks.slice();
      if (easy) {
        nb = [0, 0, 0];
        lanes[pick([0, 1, 2])] = pick(['lav', 'hoej']);
        return { lanes: lanes, blocks: nb };
      }
      // fortsæt datablokke (oppe på taget kan der være forhindringer)
      for (var l = 0; l < LANES; l++) {
        if (nb[l] > 0) {
          nb[l]--;
          lanes[l] = p > 0.15 && rng() < 0.12 + 0.4 * p ? pick(['blok-lav', 'blok-hoej']) : 'blok';
        }
      }
      var free = [0, 1, 2].filter(function (x) { return blocks[x] === 0; });
      // nye datablokke: flere og længere, jo længere man er nået
      free.forEach(function (x) {
        if (rng() < 0.08 + 0.12 * p) {
          var len = 2 + Math.floor(rng() * (1 + Math.round(3 * p)));
          lanes[x] = rng() < diff.noRampMax * p ? 'blok' : 'rampe';
          nb[x] = len - 1;
        }
      });
      // forhindringer nede på nettet: flere og hårdere med distancen
      var ground = free.filter(function (x) { return lanes[x] === 'fri'; });
      ground.forEach(function (x) {
        if (rng() < 0.22 + 0.45 * p) {
          var r = rng();
          lanes[x] = r < 0.1 + 0.3 * p ? 'mur' : r < 0.55 + 0.15 * p ? 'lav' : 'hoej';
        }
      });
      // altid mindst én ting at tage stilling til
      if (lanes.every(function (c) { return c === 'fri'; })) lanes[pick([0, 1, 2])] = pick(['lav', 'hoej']);
      return { lanes: lanes, blocks: nb };
    }

    function mustSurvive() {
      var n = hist.length, start = Math.max(0, n - VIEW + 1);
      var from = start === 0 ? [startState] : rhist[start - 1];
      var seen = hist.slice(start);
      return { seen: seen, states: from.filter(function (s) { return survivable(seen, 0, s); }) };
    }
    function valid(seg) {
      if (!reach(seg, R).length) return false;
      var m = mustSurvive(), seen = m.seen.concat([seg]);
      for (var i = 0; i < m.states.length; i++) if (!survivable(seen, 0, m.states[i])) return false;
      if (!diff.traps) {
        // Rolig: fra alle baner (i den højde, man kan stå i dér) er der et sikkert valg
        var prev = hist[hist.length - 1];
        for (var l = 0; l < LANES; l++) {
          var h = prev && isBlock(prev.lanes[l]) ? 1 : 0;
          if (!nextStates(seg, code(l, h)).length) return false;
        }
      }
      return true;
    }

    function addCoins(seg) {
      seg.coins = [false, false, false];
      if (coinRun.left <= 0 && rng() < diff.coins) {
        coinRun = { lane: Math.floor(rng() * 3) % 3, left: 2 + Math.floor(rng() * 3) };
      }
      if (coinRun.left > 0) {
        coinRun.left--;
        var l = coinRun.lane;
        if (seg.lanes[l] === 'mur') {
          var alt = [l - 1, l + 1].filter(function (x) { return x >= 0 && x < 3 && seg.lanes[x] !== 'mur'; });
          if (alt.length) { l = alt[0]; coinRun.lane = l; } else l = -1;
        }
        if (l >= 0) seg.coins[l] = true;
      }
    }

    return {
      level: level,
      reset: function (lane, h) {
        startState = code(lane, h || 0); R = [startState]; hist = []; rhist = [];
        blocks = [0, 0, 0]; coinRun = { lane: -1, left: 0 };
      },
      get R() { return R.slice(); },
      next: function (meters, easy) {
        var p = easy ? 0 : level(meters);
        var seg = null, c = null;
        for (var tries = 0; tries < 80; tries++) {
          c = candidate(p, easy);
          var s = { lanes: c.lanes };
          if (valid(s)) { seg = s; break; }
          if (tries > 30) blocks = [0, 0, 0];   // drop blokkene og prøv igen
        }
        if (!seg) {
          // nødløsning: alt frit – sikkert fra alle baner og højder
          seg = { lanes: ['fri', 'fri', 'fri'] };
          c = { blocks: [0, 0, 0] };
        }
        blocks = c.blocks;
        R = reach(seg, R);
        hist.push(seg); rhist.push(R.slice());
        if (hist.length > 4 * VIEW) { hist.splice(0, VIEW); rhist.splice(0, VIEW); }
        addCoins(seg);
        seg.level = p;
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
      diff: diff.id, lane: 1, h: 0, lives: START_LIVES, meters: 0, coins: 0, score: 0,
      segs: [], over: false, hits: 0, turns: 0, lastCause: null, ups: 0, maxLevel: 1,
      prev: null   // stoppet man lige har passeret (tegnes under løberen, fx en blok man står på)
    };
    function fill(easyFirst) {
      while (state.segs.length < VIEW) {
        state.segs.push(gen.next(state.meters + state.segs.length * METERS, easyFirst && state.segs.length === 0));
      }
    }
    gen.reset(state.lane, 0);
    fill(true);

    function score() { state.score = state.meters + state.coins * COIN_POINTS; }
    function levelNum() { return 1 + Math.min(LEVELS - 1, Math.floor(gen.level(state.meters) * LEVELS)); }

    var api = {
      state: state,
      diff: diff,
      get gen() { return gen; },
      next: function () { return state.segs[0]; },
      possible: function (a) { return !state.over && possible(state.lane, a); },
      outcome: function (a) { return outcome(state.segs[0], state.lane, state.h, a); },
      safe: function (a) { return !state.over && safe(state.segs[0], state.lane, state.h, a); },
      cause: function (a) { return cause(state.segs[0], state.lane, state.h, a); },
      safeActions: function () { return safeActions(state.segs[0], state.lane, state.h); },
      // Fører handlingen til en blindgyde i de segmenter, man kan se?
      deadEnd: function (a) {
        var o = api.outcome(a);
        if (!o || !o.ok) return false;
        return !survivable(state.segs, 1, code(o.lane, o.h));
      },
      level: function () { return gen.level(state.meters); },
      levelNum: levelNum,
      act: function (a) {
        if (state.over || !possible(state.lane, a)) return { ignored: true };
        var seg = state.segs[0], from = state.lane, fromH = state.h;
        var o = outcome(seg, from, fromH, a);
        var res = { action: a, from: from, to: o.lane, fromH: fromH, toH: o.ok ? o.h : 0, seg: seg, safe: o.ok, coin: false, cause: null, over: false };
        state.lane = o.lane;
        state.turns++;
        if (o.ok) {
          state.meters += METERS;   // kun et sikkert valg giver meter
          state.h = o.h;
          if (o.h > fromH) state.ups++;
          if (seg.coins && seg.coins[o.lane]) { state.coins++; res.coin = true; }
        } else {
          state.h = 0;              // man falder ned på nettet
          state.lives--; state.hits++;
          res.cause = state.lastCause = o.cause;
          if (state.lives <= 0) { state.lives = 0; state.over = true; res.over = true; }
        }
        state.prev = o.ok ? seg : null;
        state.segs.shift();
        if (!o.ok && !state.over) {
          // Mistet liv: vejen forude laves igen fra den bane, man står i,
          // og første stop er let, så man ikke er fanget i en blindgyde.
          state.segs = [];
          gen.reset(state.lane, 0);
          fill(true);
        } else {
          fill(false);
        }
        state.maxLevel = Math.max(state.maxLevel, levelNum());
        score();
        return res;
      }
    };
    return api;
  }

  global.LoeberenGame = {
    LANES: LANES, VIEW: VIEW, METERS: METERS, COIN_POINTS: COIN_POINTS, START_LIVES: START_LIVES, LEVELS: LEVELS,
    ACTIONS: ACTIONS, OBST: OBST, GROUND: GROUND, BLOCKS: BLOCKS, DIFFS: DIFFS,
    isBlock: isBlock, target: target, possible: possible, outcome: outcome, safe: safe, cause: cause,
    safeActions: safeActions, code: code, nextStates: nextStates, reach: reach, survivable: survivable,
    makeGenerator: makeGenerator, createRun: createRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
