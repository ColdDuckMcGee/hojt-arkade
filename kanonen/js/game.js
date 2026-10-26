/*
 * Kanonen – spillogik (ingen DOM). Turbaseret: spilleren og computeren skyder
 * på skift, og intet sker, før spilleren vælger. Der er ingen ure eller
 * tidsgrænser.
 *
 * Verden er WORLD.w × WORLD.h enheder med y nedad. Landskabet er en
 * højdekurve (én højde pr. enhed i x), så kratere bare sænker kurven –
 * jord, der hænger frit, falder ned.
 *
 * Man spiller i det uendelige: vinder man, kommer der en ny modstander i et
 * nyt landskab, og computeren sigter lidt bedre for hver sejr. Spillet
 * slutter, når spillerens kanon er ødelagt.
 */
(function (global) {
  'use strict';

  var WORLD = { w: 1600, h: 900 };
  var RULES = {
    gravity: 300,          // enheder/s²
    maxSpeed: 800,         // mundingshastighed ved 100 % krudt
    windAccel: 6,          // vandret acceleration pr. vindstyrke (styrke 0–10)
    maxWind: 10,
    floor: 24,             // jorden går aldrig lavere end WORLD.h - floor
    cannonRadius: 28,      // kanonens "krop" til direkte træffere
    maxHp: 100,
    healBetween: 35,       // liv, spilleren får tilbage mellem kampe
    bombsPerMatch: 3,
    pointsPerDamage: 10,   // point pr. skadepoint på modstanderen
    winPoints: 500,        // point for en sejr (gange modstanderens nummer)
    fewShotsLimit: 8,      // bonus for hvert skud under dette tal ved sejr …
    fewShotsBonus: 100     // … med så mange point pr. skud
  };
  var AMMO = {
    granat: { id: 'granat', name: 'Granat', craterR: 38, dmgR: 64, maxDmg: 42 },
    bombe:  { id: 'bombe',  name: 'Stor bombe', craterR: 78, dmgR: 118, maxDmg: 68 }
  };
  var LIMITS = { angleMin: 0, angleMax: 90, powerMin: 10, powerMax: 100 };

  // ---------- Tilfældighed ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function gauss() { // normalfordelt (Box–Muller)
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- Landskab ----------
  // Bakker og dale: summen af nogle bløde sinusbølger med tilfældig fase,
  // plus et par brede "pukler". Kanonernes pladser jævnes lidt ud.
  function makeTerrain(opts) {
    opts = opts || {};
    var W = WORLD.w, H = WORLD.h, h = new Float32Array(W + 1);
    var waves = [];
    for (var k = 0; k < 3; k++) {
      waves.push({ amp: rnd(25, 75) / (k * 0.8 + 1), len: rnd(700, 1400) / (k * 0.9 + 1), ph: rnd(0, Math.PI * 2) });
    }
    var humps = [];
    var nh = 1 + Math.floor(Math.random() * 3);
    for (k = 0; k < nh; k++) humps.push({ x: rnd(W * 0.3, W * 0.7), w: rnd(90, 220), a: rnd(-170, 150) });
    var base = rnd(H * 0.6, H * 0.7);
    for (var x = 0; x <= W; x++) {
      var y = base;
      waves.forEach(function (wv) { y += wv.amp * Math.sin(x / wv.len * Math.PI * 2 + wv.ph); });
      humps.forEach(function (hp) { var d = (x - hp.x) / hp.w; y -= hp.a * Math.exp(-d * d); });
      h[x] = clamp(y, H * 0.3, H - RULES.floor - 60);
    }
    var px = Math.round(rnd(W * 0.07, W * 0.16));
    var cx = Math.round(W - rnd(W * 0.07, W * 0.16));
    flatten(h, px, 34); flatten(h, cx, 34);
    return { h: h, playerX: px, cpuX: cx };
  }
  function flatten(h, cx, r) {
    var sum = 0, n = 0, x;
    for (x = cx - r; x <= cx + r; x++) { sum += h[x]; n++; }
    var lvl = sum / n;
    for (x = cx - r * 2; x <= cx + r * 2; x++) {
      if (x < 0 || x >= h.length) continue;
      var d = Math.abs(x - cx);
      var t = d <= r ? 1 : 1 - (d - r) / r;
      t = t * t * (3 - 2 * t);
      h[x] = h[x] * (1 - t) + lvl * t;
    }
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function groundAt(h, x) {
    var xi = Math.round(clamp(x, 0, h.length - 1));
    return h[xi];
  }

  // Krater: alt inden for cirklen fjernes; jord over krateret falder ned.
  function carve(h, cx, cy, r) {
    var lo = Math.max(0, Math.floor(cx - r)), hi = Math.min(h.length - 1, Math.ceil(cx + r));
    var maxY = WORLD.h - RULES.floor;
    for (var x = lo; x <= hi; x++) {
      var dx = x - cx, dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      var bottom = cy + dy, top = cy - dy;
      if (bottom <= h[x]) continue;               // cirklen når ikke jorden her
      if (top <= h[x]) h[x] = Math.min(maxY, bottom);
      else h[x] = Math.min(maxY, h[x] + (bottom - top)); // hul under overfladen: jorden synker
    }
  }

  // ---------- Ballistik ----------
  // side: 1 skyder mod højre (spilleren), -1 mod venstre (computeren).
  function muzzle(cannon) {
    var a = cannon.angle * Math.PI / 180;
    return { x: cannon.x + cannon.side * Math.cos(a) * 50, y: cannon.y - 22 - Math.sin(a) * 50 };
  }
  function launch(cannon, wind) {
    var a = cannon.angle * Math.PI / 180, v = RULES.maxSpeed * cannon.power / 100;
    var m = muzzle(cannon);
    return { x: m.x, y: m.y, vx: cannon.side * Math.cos(a) * v, vy: -Math.sin(a) * v, ax: wind * RULES.windAccel, t: 0, done: false };
  }
  // Ét fast tidstrin. Returnerer null under flugt, ellers et resultat.
  function step(p, dt, world, shooter) {
    p.vx += p.ax * dt; p.vy += RULES.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt;
    if (p.x < -60 || p.x > WORLD.w + 60 || p.t > 30) return { type: 'ude', x: p.x, y: p.y };
    // direkte træffer på en kanon (dog ikke ens egen lige efter affyring)
    for (var i = 0; i < world.cannons.length; i++) {
      var c = world.cannons[i];
      if (c === shooter && p.t < 0.4) continue;
      var dx = p.x - c.x, dy = p.y - (c.y - 14);
      if (dx * dx + dy * dy < RULES.cannonRadius * RULES.cannonRadius) return { type: 'kanon', x: p.x, y: p.y, cannon: c };
    }
    if (p.x >= 0 && p.x <= WORLD.w && p.y >= groundAt(world.h, p.x)) return { type: 'jord', x: p.x, y: groundAt(world.h, p.x) };
    if (p.y > WORLD.h) return { type: 'jord', x: p.x, y: WORLD.h - RULES.floor };
    return null;
  }
  // Hele banen på én gang (bruges af computeren til at sigte).
  function simulate(world, shooter, wind, dt) {
    dt = dt || 1 / 60;
    var p = launch(shooter, wind), r = null;
    while (!r) r = step(p, dt, world, shooter);
    return r;
  }

  // Skade efter afstand til nedslaget: tæt på giver mere.
  function damageFor(ammo, dist) {
    if (dist >= ammo.dmgR) return 0;
    var t = 1 - dist / ammo.dmgR;
    return Math.max(1, Math.round(ammo.maxDmg * (0.25 + 0.75 * t * t)));
  }

  // ---------- Computeren ----------
  // Finder det bedste skud mod målet med den aktuelle vind og tilføjer så en
  // tilfældig fejl, der bliver mindre for hver ny modstander.
  function aiSkill(opponentNo) {
    var k = Math.pow(0.8, opponentNo - 1);
    return { angleErr: Math.max(0.8, 5 * k), powerErr: Math.max(1.2, 7 * k) };
  }
  function aiPlan(world, cpu, target, wind, opponentNo, exact) {
    var best = null;
    var probe = { x: cpu.x, y: cpu.y, side: cpu.side, angle: 45, power: 50 };
    for (var a = 20; a <= 80; a += 4) {
      probe.angle = a;
      var lo = LIMITS.powerMin, hi = LIMITS.powerMax;
      for (var it = 0; it < 14; it++) { // halvering: for kort eller for langt?
        probe.power = (lo + hi) / 2;
        var r = simulate(world, probe, wind, 1 / 120);
        var err = (r.x - target.x) * cpu.side; // positiv = for langt
        if (r.type === 'kanon' && r.cannon === target) err = 0;
        var score = Math.abs(r.type === 'kanon' && r.cannon === target ? 0 : r.x - target.x);
        if (!best || score < best.score) best = { angle: a, power: probe.power, score: score };
        if (err > 0) hi = probe.power; else lo = probe.power;
      }
    }
    if (exact) return { angle: best.angle, power: best.power, miss: best.score };
    var s = aiSkill(opponentNo);
    return {
      angle: Math.round(clamp(best.angle + gauss() * s.angleErr, LIMITS.angleMin + 5, LIMITS.angleMax - 2)),
      power: Math.round(clamp(best.power + gauss() * s.powerErr, LIMITS.powerMin, LIMITS.powerMax))
    };
  }

  // ---------- En kamp ----------
  function newWind() {
    // skifter hver tur; heltal fra -10 til 10
    return Math.round(rnd(-RULES.maxWind, RULES.maxWind));
  }
  function createMatch(opponentNo, playerHp) {
    var t = makeTerrain();
    var player = { id: 'spiller', side: 1, x: t.playerX, y: t.h[t.playerX], angle: 45, power: 60, hp: playerHp, bombs: RULES.bombsPerMatch, ammo: 'granat' };
    var cpu = { id: 'computer', side: -1, x: t.cpuX, y: t.h[t.cpuX], angle: 45, power: 60, hp: RULES.maxHp, bombs: RULES.bombsPerMatch, ammo: 'granat' };
    return {
      no: opponentNo, h: t.h, cannons: [player, cpu], player: player, cpu: cpu,
      wind: newWind(), shots: 0, damageDealt: 0, trails: { spiller: null, computer: null }
    };
  }
  // Nedslag: krater, skade på kanoner inden for rækkevidde.
  function impact(match, hit, ammoId) {
    var ammo = AMMO[ammoId];
    var y = hit.y;
    carve(match.h, hit.x, y, ammo.craterR);
    var dmg = [];
    match.cannons.forEach(function (c) {
      var dx = c.x - hit.x, dy = (c.y - 14) - y;
      var d = hit.type === 'kanon' && hit.cannon === c ? 0 : Math.max(0, Math.sqrt(dx * dx + dy * dy) - RULES.cannonRadius * 0.5);
      var n = Math.min(c.hp, damageFor(ammo, d));
      if (n > 0) { c.hp -= n; dmg.push({ cannon: c, amount: n }); }
    });
    return dmg;
  }
  // Hvor kanonen skal stå nu (jorden kan være forsvundet under den).
  function restY(match, c) {
    var g = Infinity;
    for (var x = c.x - 12; x <= c.x + 12; x++) g = Math.min(g, groundAt(match.h, x));
    return g;
  }

  // Point ved sejr: sejr × modstanderens nummer + bonus for få skud.
  function winPoints(opponentNo, shots) {
    return RULES.winPoints * opponentNo + Math.max(0, RULES.fewShotsLimit - shots) * RULES.fewShotsBonus;
  }

  global.KanonenGame = {
    WORLD: WORLD, RULES: RULES, AMMO: AMMO, LIMITS: LIMITS,
    createMatch: createMatch, newWind: newWind, launch: launch, step: step, simulate: simulate,
    impact: impact, restY: restY, carve: carve, damageFor: damageFor, muzzle: muzzle,
    aiPlan: aiPlan, aiSkill: aiSkill, winPoints: winPoints, clamp: clamp
  };
})(window);
