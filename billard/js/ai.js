/*
 * Billard – computermodstanderen. Ingen DOM, ingen farver, ingen grafik.
 * Kører i browseren (window.BillardAI) og i Node (module.exports).
 *
 * Computeren finder kandidatstød (direkte skud på en lovlig kugle mod et hul,
 * målt med geometri), prøver hvert af dem med den samme fysik som spillet
 * (BillardLogik.simulate) og flere kræfter, og giver hvert resultat point:
 * egne kugler i hul, at den må støde igen, en god stilling til næste stød, og
 * store minuspoint for fejlstød og for at tabe partiet. Findes der intet frit
 * skud, prøves en vifte af vinkler mod de lovlige kugler (også via banden).
 * Til sidst lægges lidt støj på retningen efter niveauet:
 *   Rolig  ±2,6° (og vælger tit et af de fire bedste stød)
 *   Normal ±1,0° (et af de to bedste)
 *   Svær   ±0,3° (det bedste, og tænker på stillingen bagefter)
 */
(function (global) {
  'use strict';
  var L = global.BillardLogik || (typeof require !== 'undefined' ? require('./logik.js') : null);

  function gauss(rand) {
    var u = Math.max(1e-9, rand()), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // Point for et simuleret stød set fra den, der støder
  function score(ctx, sim, lvl, who, oppTargetsFn) {
    var j = L.judge(ctx, sim);
    if (j.frame === 'win') return { s: 10000, j: j };
    if (j.frame === 'lose') return { s: -10000, j: j };
    var s = 0;
    if (j.foul) s -= 400;
    s += j.own.length * 120 - j.opp.length * 40;
    if (j.continues) {
      s += 80;
      // Stillingen bagefter: hvor let er næste stød?
      if (lvl.position > 0) {
        var mine = ctx.group || j.assign;
        var targets = nextTargets(sim.balls, mine);
        var cue = L.ballById(sim.balls, 0);
        if (cue && cue.in && targets.length) {
          var o = L.shotOptions(sim.balls, targets);
          s += lvl.position * (o.length ? 120 * o[0].ease : -40);
        }
      }
    } else if (!j.foul && lvl.position > 0) {
      // Ikke i hul: giv helst modstanderen et svært stød
      var oppG = ctx.group ? L.other(ctx.group) : null;
      var ot = nextTargets(sim.balls, oppG);
      var oo = L.shotOptions(sim.balls, ot);
      s -= lvl.position * (oo.length ? 60 * oo[0].ease : 0);
    }
    return { s: s, j: j };
  }
  function nextTargets(balls, group) {
    var ids = balls.filter(function (b) { return b.in && b.id !== 0 && b.id !== 8 && (!group || L.groupOf(b.id) === group); }).map(function (b) { return b.id; });
    if (group && ids.length === 0) return L.ballById(balls, 8).in ? [8] : [];
    return ids;
  }
  function candidatesFor(balls, targets, lvl) {
    var out = [];
    var opts = L.shotOptions(balls, targets).slice(0, lvl.cands);
    opts.forEach(function (o) {
      var p0 = L.powerFor(o.dist, o.cut);
      [p0, Math.min(10, p0 + 2), Math.max(1, p0 - 1)].forEach(function (p, k) {
        if (k && p === p0) return;
        out.push({ aim: o.aim, power: p, ease: o.ease, id: o.id, pocket: o.pocket });
      });
    });
    return out;
  }
  function fallback(balls, targets) {
    // Intet frit skud: en vifte af retninger mod de lovlige kugler og nogle bandestød
    var cue = L.ballById(balls, 0), out = [];
    targets.forEach(function (id) {
      var b = L.ballById(balls, id), a = L.angleTo(cue, b);
      [-6, -3, 0, 3, 6].forEach(function (d) { [4, 7].forEach(function (p) { out.push({ aim: L.normAngle(a + d), power: p, ease: 0, id: id }); }); });
    });
    for (var a = 0; a < 360; a += 15) out.push({ aim: a, power: 6, ease: 0, id: null });
    return out;
  }
  // Det bedste stød fra en stilling: { aim, power, score, id, pocket }
  function bestFrom(balls, ctx, targets, lvl, rand) {
    var cands = candidatesFor(balls, targets, lvl);
    if (cands.length < 3) cands = cands.concat(fallback(balls, targets));
    var scored = cands.map(function (c) {
      var sim = L.simulate(balls, c.aim, c.power);
      var r = score(ctx, sim, lvl);
      return { aim: c.aim, power: c.power, score: r.s + c.ease * 30, id: c.id, pocket: c.pocket, foul: r.j.foul };
    });
    scored.sort(function (a, b) { return b.score - a.score || a.aim - b.aim; });
    return scored;
  }
  // plan(run) – computerens næste stød. Med kuglen i hånden vælges også stedet.
  function plan(run) {
    var st = run.state, lvl = run.level, rand = run.rand;
    var ctx = run.context('cpu'), targets = run.legalTargets('cpu');
    var spots = [null];
    if (st.ballInHand) spots = run.handSpots('cpu').slice(0, lvl.id === 'svaer' ? 4 : lvl.id === 'normal' ? 3 : 2);
    var best = null, bestList = null;
    spots.forEach(function (spot) {
      var balls = L.cloneBalls(st.balls);
      if (spot) { var c = L.ballById(balls, 0); c.in = true; c.x = spot.x; c.y = spot.y; }
      if (st.breakShot) {
        // Åbningsstødet: hårdt mod trekantens spids (lidt skævt)
        var apex = { x: L.RULES.footSpot.x, y: L.RULES.footSpot.y };
        var cb = L.ballById(balls, 0);
        bestList = [{ aim: L.normAngle(L.angleTo(cb, apex) + (rand() - 0.5) * 1.2), power: 10, score: 0 }];
        best = { list: bestList, spot: spot };
        return;
      }
      var list = bestFrom(balls, ctx, targets, lvl, rand);
      if (!best || list[0].score > best.list[0].score) best = { list: list, spot: spot };
    });
    var list = best.list;
    // Rolig og Normal vælger af og til et af de næstbedste (men aldrig et sikkert fejlstød, hvis der er andre)
    var k = 0;
    if (lvl.pick > 1) {
      var pool = list.slice(0, lvl.pick).filter(function (c) { return !c.foul && c.score > list[0].score - 300; });
      if (pool.length) k = list.indexOf(pool[Math.floor(rand() * pool.length)]);
    }
    var choice = list[k];
    var noise = st.breakShot ? 0 : gauss(rand) * lvl.noise;
    return { aim: L.normAngle(choice.aim + noise), power: choice.power, spot: best.spot, target: choice.id, pocket: choice.pocket, planned: choice.aim, score: choice.score };
  }

  var api = { plan: plan, score: score, bestFrom: bestFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BillardAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
