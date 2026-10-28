/*
 * Rampen – spillogik. Ingen DOM, ingen farver og ingen grafik.
 *
 * En lille bil sendes ud over en rampe. Den flyver, hopper på trampoliner og
 * balloner, samler mønter og tager skade ved hårde landinger, til den holder
 * stille. Afstanden giver mønter, og mønterne køber opgraderinger. Der er ingen
 * grænse for antal ture.
 *
 * Fysikken kører med fast tidsskridt (1/60 s) og er helt deterministisk:
 * samme bil, samme bane og samme valg giver altid samme tur.
 *
 * Turen afspilles i stykker. advance() kører, til bilen enten holder stille,
 * eller til et beslutningspunkt (toppen af et hop – ét pr. hop), hvor
 * spilleren vælger "Boost nu?" (Ja/Vent) og evt. næsens stilling (med vinger).
 * Ingen hurtige reaktioner: intet sker, før der er valgt.
 *
 * Enheder: meter, sekunder. x = afstand fra rampen, y = højde over jorden.
 */
(function (global) {
  'use strict';

  var DT = 1 / 60;
  var G = 9.8;
  var RAMPE = { h: 6, len: 16 };          // startrampen: bilen slipper ved x = 0, y = 6
  var CHUNK = 50;                         // banens ting laves i stykker à 50 m
  var MAX_STEPS = 60 * 900;               // sikkerhedsnet (15 min. simuleret tid)

  var ZONER = [
    { id: 'forstad', navn: 'Forstaden', fra: 0, bonus: 0, tyngde: 1 },
    { id: 'oerken', navn: 'Ørkenen', fra: 250, bonus: 60, tyngde: 1 },
    { id: 'bjerge', navn: 'Bjergene', fra: 700, bonus: 150, tyngde: 1 },
    { id: 'skyer', navn: 'Skyerne', fra: 1300, bonus: 350, tyngde: 0.85 },
    { id: 'rummet', navn: 'Rummet', fra: 2200, bonus: 800, tyngde: 0.6 }
  ];
  function zoneAt(x) { var z = ZONER[0]; for (var i = 0; i < ZONER.length; i++) if (x >= ZONER[i].fra) z = ZONER[i]; return z; }
  function zoneIndex(x) { return ZONER.indexOf(zoneAt(x)); }

  // ---------- Opgraderinger ----------
  var OPG = [
    { id: 'motor', navn: 'Motor', max: 8, base: 25, vaekst: 1.55, tekst: 'Hurtigere ud over rampen' },
    { id: 'daek', navn: 'Dæk', max: 6, base: 20, vaekst: 1.6, tekst: 'Ruller længere og hopper bedre' },
    { id: 'karrosseri', navn: 'Karrosseri', max: 6, base: 30, vaekst: 1.6, tekst: 'Tåler flere hårde landinger' },
    { id: 'aero', navn: 'Aerodynamik', max: 6, base: 35, vaekst: 1.6, tekst: 'Mindre luftmodstand' },
    { id: 'vinger', navn: 'Vinger', max: 5, base: 80, vaekst: 1.75, tekst: 'Svæver længere. Giver valget næse op eller ned' },
    { id: 'raket', navn: 'Raket', max: 5, base: 60, vaekst: 1.7, tekst: 'Kraftigere boost' },
    { id: 'braendstof', navn: 'Brændstof', max: 4, base: 70, vaekst: 1.9, tekst: 'Raketbrændstof til ét boost mere pr. tur' },
    { id: 'faldskaerm', navn: 'Faldskærm', max: 4, base: 45, vaekst: 1.7, tekst: 'Blødere landinger' }
  ];
  var OPG_ID = {}; OPG.forEach(function (o) { OPG_ID[o.id] = o; });
  function pris(id, lvl) { var o = OPG_ID[id]; if (lvl >= o.max) return null; return Math.round(o.base * Math.pow(o.vaekst, lvl) / 5) * 5; }

  // Bilens værdier ud fra opgraderingerne
  function stats(u) {
    u = u || {};
    var g = function (k) { return u[k] || 0; };
    return {
      vmax: 15 + 4.2 * g('motor'),                       // m/s ved kraft 10
      mu: 0.32 - 0.035 * g('daek'),                     // rullemodstand (× tyngde)
      behold: 0.72 + 0.04 * g('daek'),                  // vandret fart, der bevares ved en hård landing
      hop: 0.30 + 0.03 * g('daek'),                     // hvor meget bilen hopper op igen
      maxHp: 60 + 30 * g('karrosseri'),
      panser: 1 - 0.06 * g('karrosseri'),
      drag: 0.010 * (1 - 0.11 * g('aero')),
      lift: 0.0035 * g('vinger'),
      vinger: g('vinger') > 0,
      thrust: 16 + 6 * g('raket'),                      // m/s² i 1,2 s
      boostTid: 1.2,
      boosts: 1 + g('braendstof'),
      skaerm: 0.12 * g('faldskaerm')                    // andel, faldskærmen tager af landingen
    };
  }
  // Bilens udseende: fra sæbekassebil til raketbil (navngivne temaelementer)
  var BILER = ['saebekasse', 'folkevogn', 'sportsvogn', 'raketbil'];
  function bilType(u) {
    var n = 0; OPG.forEach(function (o) { n += (u && u[o.id]) || 0; });
    return n >= 26 ? 'raketbil' : n >= 15 ? 'sportsvogn' : n >= 6 ? 'folkevogn' : 'saebekasse';
  }
  function niveauSum(u) { var n = 0; OPG.forEach(function (o) { n += (u && u[o.id]) || 0; }); return n; }

  // ---------- Banen ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(a, b) { var h = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77)) >>> 0; h ^= h >>> 16; return Math.imul(h, 0x45d9f3b) >>> 0; }

  // Mål på tingene (meter). Jord-ting står på jorden; luft-ting har en højde y.
  var TING = {
    trampolin: { w: 5, h: 1, jord: true, god: true },
    rampe: { w: 6, h: 2.5, jord: true, god: true },
    olie: { w: 12, h: 0.2, jord: true, god: true },
    sten: { w: 1.6, h: 1.4, jord: true },
    kaktus: { w: 1, h: 2.6, jord: true },
    kegle: { w: 0.8, h: 1, jord: true },
    ballon: { r: 1.6, god: true },
    vind: { w: 12, h: 8, god: true },
    moent: { r: 0.8, god: true },
    bonus: { r: 1, god: true }
  };
  // Hvilke ting der kan komme i hver zone (vægte). Hver zone bringer noget nyt.
  var PULJE = {
    forstad: { trampolin: 2, ballon: 2, moenter: 3, olie: 1 },
    oerken: { trampolin: 2, rampe: 2, olie: 1, moenter: 3, vind: 1 },
    bjerge: { rampe: 2, vind: 2, ballon: 2, trampolin: 2, moenter: 2, bonus: 1 },
    skyer: { ballon: 4, vind: 3, moenter: 3, bonus: 1, trampolin: 2 },
    rummet: { vind: 3, moenter: 3, bonus: 2, rampe: 2, ballon: 2 }
  };
  // Forhindringer: der er én i hvert andet stykke bane
  var ONDE = {
    forstad: { kegle: 3, sten: 1 },
    oerken: { kaktus: 3, sten: 1 },
    bjerge: { sten: 3, kaktus: 1 },
    skyer: { kegle: 2, sten: 1 },
    rummet: { sten: 1 }
  };
  function vaelg(r, pulje) {
    var sum = 0, k; for (k in pulje) sum += pulje[k];
    var v = r() * sum; for (k in pulje) { v -= pulje[k]; if (v < 0) return k; }
    return k;
  }
  // Ét stykke bane (deterministisk ud fra frø og nummer)
  function chunk(seed, k) {
    var out = [];
    if (k < 1) return out;                      // de første 50 m er tomme
    var r = rng(hash(seed, k)), x0 = k * CHUNK;
    var n = r() < 0.15 ? 1 : 2, id = k * 100;
    for (var i = 0; i < n; i++) {
      var x = x0 + 4 + (i * CHUNK / n) + r() * (CHUNK / n - 16);
      var z = zoneAt(x).id, type = vaelg(r, (i === n - 1 && k % 2 === 1) ? ONDE[z] : PULJE[z]);
      if (type === 'moenter') {
        var m = 3 + Math.floor(r() * 3), y = 2 + r() * 14;
        for (var j = 0; j < m; j++) out.push({ id: id++, type: 'moent', x: x + j * 2.4, y: y + Math.sin(j / (m - 1) * Math.PI) * 2, zone: z });
        continue;
      }
      var o = { id: id++, type: type, x: x, zone: z };
      var d = TING[type];
      if (d.jord) { o.w = d.w; o.h = d.h; o.y = 0; }
      else if (type === 'vind') { o.w = d.w; o.h = d.h; o.y = 3 + r() * 14; }
      else { o.r = d.r; o.y = 4 + r() * 16; }
      out.push(o);
    }
    return out;
  }
  function course(seed) {
    var cache = {};
    function get(k) { if (!cache[k]) cache[k] = chunk(seed, k); return cache[k]; }
    return {
      seed: seed,
      // Ting med x i [a, b]
      range: function (a, b) {
        var res = [];
        for (var k = Math.max(0, Math.floor((a - 14) / CHUNK)); k <= Math.floor(b / CHUNK); k++) get(k).forEach(function (o) { var w = o.w || 0; if (o.x + w >= a && o.x - (o.r || 0) <= b) res.push(o); });
        return res;
      }
    };
  }
  function seedForCar(bil) { return 1000 + bil * 7919; }

  // ---------- Fysik ----------
  // Turens tilstand (kan klones til forhåndslinjer)
  function newFlight(st, course0, angle, power) {
    var v0 = st.vmax * (0.4 + 0.06 * power), a = angle * Math.PI / 180;
    return {
      t: 0, x: 0, y: RAMPE.h, vx: v0 * Math.cos(a), vy: v0 * Math.sin(a),
      ground: false, hp: st.maxHp, boosts: st.boosts, boostT: 0, nose: 'lige',
      taken: {}, coins: 0, picked: 0, tramps: 0, balloons: 0, boostsUsed: 0, dmg: 0,
      airStart: 0, longestAir: 0, apex: RAMPE.h, topFrozen: false, chuteT: 0, hops: 0, landings: 0,
      done: false, end: null, lastHit: null
    };
  }
  function clone(f) { var c = {}; for (var k in f) c[k] = f[k]; c.taken = {}; for (var t in f.taken) c.taken[t] = f.taken[t]; return c; }
  // Næsen (kun med vinger): op = svæver længere, men lander hårdere (mere skade);
  // ned = kortere hop, men blød landing, der bevarer farten.
  var NOSE = { lige: { lift: 1, drag: 1, land: 1 }, op: { lift: 2, drag: 1.08, land: 1.1 }, ned: { lift: 0.2, drag: 0.85, land: 0.6 } };

  // Et tidsskridt. Returnerer 'top' (beslutningspunkt), 'end' eller null.
  // freezes = false: ingen beslutningspunkter (forhåndslinjer).
  function step(f, st, crs, freezes) {
    var zone = zoneAt(f.x), g = G * zone.tyngde;
    var prevVy = f.vy, wasGround = f.ground;
    var thrust = 0;
    if (f.boostT > 0) {
      thrust = st.thrust; f.boostT = Math.max(0, f.boostT - DT);
      // Et boost giver en ny bue: dens top er et nyt beslutningspunkt
      if (f.boostT === 0) f.topFrozen = false;
    }
    var ca = 0.906, sa = 0.423;                 // boostet skubber 25° op fra vandret
    if (f.ground) {
      var oil = onOil(f, crs);
      f.vx += (thrust * ca - (oil ? 0.03 : st.mu) * g) * DT;
      if (thrust * sa > g * 0.5) { f.ground = false; f.vy = 2; }
      f.x += f.vx * DT;
      if (f.vx <= 0.15 && f.boostT <= 0) { f.vx = 0; f.done = true; f.end = 'stop'; }
    } else {
      var nz = st.vinger ? NOSE[f.nose] : NOSE.lige;
      var v = Math.sqrt(f.vx * f.vx + f.vy * f.vy), dr = st.drag * nz.drag;
      var lift = Math.min(st.lift * f.vx * f.vx * nz.lift, 0.9 * g);
      f.vx += (-dr * v * f.vx + thrust * ca) * DT;
      f.vy += (-g - dr * v * f.vy + lift + thrust * sa) * DT;
      f.x += f.vx * DT; f.y += f.vy * DT;
      if (f.y > f.apex) f.apex = f.y;
      if (f.y <= 0) land(f, st, crs);
    }
    f.t += DT;
    collide(f, st, crs);
    if (f.hp <= 0 && !f.done) { f.hp = 0; f.done = true; f.end = 'smadret'; f.vx = 0; f.vy = 0; f.y = Math.max(0, f.y); f.ground = f.y <= 0; }
    if (!f.ground && wasGround) { f.airStart = f.x; f.apex = f.y; f.topFrozen = false; }
    if (f.done) return 'end';
    if (!freezes || f.ground || f.boostT > 0) return null;
    var canDecide = f.boosts > 0 || st.vinger;
    if (!canDecide) return null;
    // Toppen af et hop (mindst 3 m oppe)
    if (!f.topFrozen && prevVy > 0 && f.vy <= 0 && f.y >= 3) { f.topFrozen = true; return 'top'; }
    return null;
  }
  function onOil(f, crs) {
    var l = crs.range(f.x - 1, f.x + 1);
    for (var i = 0; i < l.length; i++) if (l[i].type === 'olie' && f.x >= l[i].x && f.x <= l[i].x + l[i].w) return true;
    return false;
  }
  function land(f, st, crs) {
    f.y = 0;
    var air = f.x - f.airStart;
    if (air > f.longestAir) f.longestAir = air;
    // Trampolinen tager imod landingen (ingen skade)
    var l = crs.range(f.x - 1, f.x + 1);
    for (var i = 0; i < l.length; i++) {
      var o = l[i];
      if (o.type === 'trampolin' && f.x >= o.x && f.x <= o.x + o.w) {
        f.vy = Math.max(-f.vy * 0.9, 12); f.tramps++; f.hops++; f.lastHit = 'trampolin';
        f.apex = 0; f.airStart = f.x; f.topFrozen = false;
        return;
      }
    }
    var nz = st.vinger ? NOSE[f.nose] : NOSE.lige;
    var impact = -f.vy * (1 - st.skaerm) * nz.land;
    f.landings++;
    if (st.skaerm > 0 && impact > 9) f.chuteT = f.t;
    if (impact > 9) { var d = (impact - 9) * 3.2 * st.panser; f.hp -= d; f.dmg += d; f.lastHit = 'landing'; }
    var oil = onOil(f, crs);
    if (impact > 3) {
      f.vy = impact * st.hop; f.vx *= oil ? 1 : Math.min(1, st.behold + (nz.land < 1 ? 0.15 : 0));
      f.apex = 0; f.airStart = f.x; f.topFrozen = false;
      if (f.vy < 1.5) { f.vy = 0; f.ground = true; }
    } else { f.vy = 0; f.ground = true; }
  }
  function collide(f, st, crs) {
    var l = crs.range(f.x - 2, f.x + 2);
    for (var i = 0; i < l.length; i++) {
      var o = l[i];
      if (f.taken[o.id] !== undefined) continue;
      var hit = false;
      if (o.r) hit = Math.hypot(f.x - o.x, f.y + 0.6 - o.y) < o.r + 0.8;
      else if (o.type === 'vind') hit = f.x >= o.x && f.x <= o.x + o.w && f.y >= o.y && f.y <= o.y + o.h;
      else if (o.type === 'rampe') hit = f.x >= o.x + 0.5 && f.x <= o.x + o.w && f.y <= o.h * (f.x - o.x) / o.w + 0.3 && f.vx > 0;
      else if (o.type === 'olie' || o.type === 'trampolin') hit = false;  // håndteres ved landing/rulning
      else hit = f.x >= o.x - 0.4 && f.x <= o.x + o.w + 0.4 && f.y < o.h;
      if (!hit) continue;
      f.taken[o.id] = f.t;
      f.lastHit = o.type;
      switch (o.type) {
        case 'moent': f.coins += 5; f.picked++; break;
        case 'bonus': f.coins += 10; f.boosts++; break;
        case 'ballon': f.vy = Math.max(f.vy, 0) + 9; f.balloons++; f.ground = false; resetJump(f); break;
        case 'vind': f.vx += 6; f.vy += 3; break;
        case 'rampe':
          var s = Math.max(8, Math.hypot(f.vx, f.vy));
          f.vx = s * 0.866; f.vy = s * 0.5 + 3; f.y = Math.max(f.y, 0.01); f.ground = false; resetJump(f); f.airStart = f.x; break;
        case 'sten': hurt(f, 14 * st.panser); f.vx *= 0.55; if (f.ground && f.vx > 2) { f.vy = 3; f.ground = false; f.apex = f.y; f.topFrozen = false; } break;
        case 'kaktus': hurt(f, 8 * st.panser); f.vx *= 0.75; break;
        case 'kegle': hurt(f, 2 * st.panser); f.vx *= 0.88; break;
      }
    }
  }
  function resetJump(f) { f.apex = f.y; f.topFrozen = false; }
  function hurt(f, d) { f.hp -= d; f.dmg += d; }

  // Et billede til animationen
  function frame(f, st) { return { t: f.t, x: f.x, y: f.y, vx: f.vx, vy: f.vy, hp: f.hp, coins: f.coins, boost: f.boostT > 0, ground: f.ground, nose: f.nose, boosts: f.boosts, hops: f.hops, landings: f.landings, dmg: f.dmg,
    chute: st.skaerm > 0 && !f.ground && f.vy < -9 && f.y < 30 }; }

  // Kør, til der skal vælges, eller til bilen holder stille
  function advance(f, st, crs) {
    var frames = [frame(f, st)], ev = null, n = 0;
    while (!ev && n < MAX_STEPS) {
      ev = step(f, st, crs, true); n++;
      if (n % 2 === 0 || ev) frames.push(frame(f, st));
    }
    if (!ev) { f.done = true; f.end = 'stop'; ev = 'end'; }
    return { frames: frames, event: ev };
  }
  // Forhåndslinje: kør videre (uden beslutninger) til næste landing på jorden
  function predict(f, st, crs, opts) {
    var c = clone(f); opts = opts || {};
    if (opts.nose) c.nose = opts.nose;
    if (opts.boost && c.boosts > 0) { c.boosts--; c.boostT = st.boostTid; }
    var pts = [{ x: c.x, y: c.y }], n = 0, start = c.ground;
    var landed = false;
    while (n < 60 * 120) {
      var y0 = c.y;
      var ev = step(c, st, crs, false); n++;
      if (n % 3 === 0) pts.push({ x: c.x, y: c.y });
      if (ev === 'end') break;
      if (!start && y0 > 0 && c.y <= 0 && c.lastHit !== 'trampolin') { landed = true; break; }
      if (!start && c.ground) { landed = true; break; }
    }
    pts.push({ x: c.x, y: c.y });
    return { pts: pts, x: c.x, landed: landed, end: c.end, hp: c.hp };
  }

  // ---------- Mål ----------
  var MAAL = [
    { id: 'm100', tekst: 'Nå 100 m', test: function (r) { return r.dist >= 100; }, beloen: 20 },
    { id: 'moent10', tekst: 'Saml 10 mønter på én tur', test: function (r) { return r.picked >= 10; }, beloen: 25 },
    { id: 'tramp1', tekst: 'Hop på en trampolin', test: function (r) { return r.tramps >= 1; }, beloen: 25 },
    { id: 'm250', tekst: 'Nå 250 m', test: function (r) { return r.dist >= 250; }, beloen: 40 },
    { id: 'heil150', tekst: 'Kør over 150 m uden skade', test: function (r) { return r.dist >= 150 && r.dmg < 0.5; }, beloen: 50 },
    { id: 'm500nb', tekst: 'Nå 500 m uden boost', test: function (r) { return r.dist >= 500 && r.boostsUsed === 0; }, beloen: 120 },
    { id: 'ballon3', tekst: 'Ram 3 balloner på én tur', test: function (r) { return r.balloons >= 3; }, beloen: 80 },
    { id: 'm1000', tekst: 'Nå 1000 m', test: function (r) { return r.dist >= 1000; }, beloen: 150 },
    { id: 'luft200', tekst: 'Flyv 200 m i ét hop', test: function (r) { return r.longestAir >= 200; }, beloen: 150 },
    { id: 'm2000', tekst: 'Nå 2000 m', test: function (r) { return r.dist >= 2000; }, beloen: 300 },
    { id: 'm1500nb', tekst: 'Nå 1500 m uden boost', test: function (r) { return r.dist >= 1500 && r.boostsUsed === 0; }, beloen: 400 },
    { id: 'm3000', tekst: 'Nå 3000 m', test: function (r) { return r.dist >= 3000; }, beloen: 600 }
  ];
  function goal(id) {
    for (var i = 0; i < MAAL.length; i++) if (MAAL[i].id === id) return MAAL[i];
    var m = /^langt(\d+)$/.exec(id);
    if (m) { var n = +m[1], d = 3500 + 500 * n; return { id: id, tekst: 'Nå ' + d + ' m', test: function (r) { return r.dist >= d; }, beloen: 600 + 100 * n }; }
    return null;
  }
  // De (op til) tre mål, der er i gang
  function activeGoals(done) {
    var out = [];
    for (var i = 0; i < MAAL.length && out.length < 3; i++) if (done.indexOf(MAAL[i].id) < 0) out.push(MAAL[i]);
    for (var n = 0; out.length < 3 && n < 1000; n++) if (done.indexOf('langt' + n) < 0) out.push(goal('langt' + n));
    return out;
  }

  // ---------- Fremskridt ----------
  function newProgress(bil, bonusBil) {
    var u = {}; OPG.forEach(function (o) { u[o.id] = 0; });
    return { version: 1, bil: bil || 1, coins: 0, upg: u, best: 0, carScore: 0, trips: 0,
      zones: ['forstad'], goals: [], angle: 30, power: 10 };
  }
  function sanitize(p) {
    var d = newProgress(1);
    if (!p || typeof p !== 'object') return d;
    var out = newProgress(Math.max(1, Math.floor(+p.bil) || 1));
    ['coins', 'best', 'carScore', 'trips'].forEach(function (k) { var v = +p[k]; if (isFinite(v) && v >= 0) out[k] = Math.floor(v); });
    if (p.upg) OPG.forEach(function (o) { var v = Math.floor(+p.upg[o.id]); if (v >= 0) out.upg[o.id] = Math.min(o.max, v); });
    if (Array.isArray(p.zones)) out.zones = p.zones.filter(function (z) { return ZONER.some(function (Z) { return Z.id === z; }); });
    if (out.zones.indexOf('forstad') < 0) out.zones.unshift('forstad');
    if (Array.isArray(p.goals)) out.goals = p.goals.filter(function (g) { return typeof g === 'string'; });
    var a = Math.round(+p.angle); if (a >= ANGLE_MIN && a <= ANGLE_MAX) out.angle = a;
    var pw = Math.round(+p.power); if (pw >= 1 && pw <= 10) out.power = pw;
    return out;
  }
  var ANGLE_MIN = 10, ANGLE_MAX = 70;
  function multiplier(bil) { return 1 + 0.25 * (bil - 1); }   // Ny bil: +25 % mønter pr. bil
  var NY_BIL_KRAV = 1000;                                      // længste tur, før man kan tage en ny bil

  // Spillet: fremskridt + den aktuelle tur
  function createGame(progress) {
    var p = sanitize(progress);
    var crs = course(seedForCar(p.bil));
    var game = {
      p: p, course: crs, flight: null, st: null, lastResult: null,
      stats: function () { return stats(p.upg); },
      bilType: function () { return bilType(p.upg); },
      price: function (id) { return pris(id, p.upg[id]); },
      canBuy: function (id) { var c = pris(id, p.upg[id]); return c !== null && p.coins >= c && !game.flight; },
      buy: function (id) {
        if (!game.canBuy(id)) return false;
        p.coins -= pris(id, p.upg[id]); p.upg[id]++; return true;
      },
      setAngle: function (a) { p.angle = Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, Math.round(a))); return p.angle; },
      setPower: function (w) { p.power = Math.max(1, Math.min(10, Math.round(w))); return p.power; },
      // Forhåndslinje for opsendelsen (til første landing)
      launchPreview: function () {
        var st = stats(p.upg), f = newFlight(st, crs, p.angle, p.power);
        return predict(f, st, crs, {});
      },
      launch: function () {
        if (game.flight) return null;
        game.st = stats(p.upg);
        game.flight = newFlight(game.st, crs, p.angle, p.power);
        return game.advance();
      },
      advance: function () { return advance(game.flight, game.st, crs); },
      // Beslutningspunkt: forhåndslinjer med og uden boost (med den valgte næse)
      options: function () {
        var f = game.flight, st = game.st;
        return {
          uden: predict(f, st, crs, { boost: false }),
          med: f.boosts > 0 ? predict(f, st, crs, { boost: true }) : null
        };
      },
      setNose: function (n) { if (game.flight && game.st.vinger && NOSE[n]) game.flight.nose = n; return game.flight && game.flight.nose; },
      decide: function (boost) {
        var f = game.flight;
        if (boost && f.boosts > 0) { f.boosts--; f.boostT = game.st.boostTid; f.boostsUsed++; }
        return game.advance();
      },
      // Turen er slut: mønter, zoner, mål og rekord
      finishTrip: function () {
        var f = game.flight; if (!f || !f.done) return null;
        var dist = Math.max(0, Math.floor(f.x));
        var r = { dist: dist, picked: f.picked, tramps: f.tramps, balloons: f.balloons, boostsUsed: f.boostsUsed, dmg: f.dmg, longestAir: Math.floor(f.longestAir), end: f.end, hp: f.hp };
        var mult = multiplier(p.bil);
        r.distCoins = Math.floor(dist * 0.5 * mult);
        r.pickCoins = Math.floor(f.coins * mult);
        r.zoneBonus = []; var zb = 0;
        ZONER.forEach(function (z) { if (dist >= z.fra && p.zones.indexOf(z.id) < 0) { p.zones.push(z.id); r.zoneBonus.push({ id: z.id, navn: z.navn, beloen: z.bonus }); zb += z.bonus; } });
        r.goals = []; var gb = 0;
        activeGoals(p.goals).forEach(function (g) { if (g.test(r)) { p.goals.push(g.id); r.goals.push({ id: g.id, tekst: g.tekst, beloen: g.beloen }); gb += g.beloen; } });
        r.total = r.distCoins + r.pickCoins + zb + gb;
        r.newBest = dist > p.best;
        p.coins += r.total; p.trips++; p.carScore += dist; if (dist > p.best) p.best = dist;
        game.flight = null; game.lastResult = r;
        return r;
      },
      canNewCar: function () { return p.best >= NY_BIL_KRAV && !game.flight; },
      // Ny bil (prestige): alt starter forfra med en permanent bonus. Returnerer bilens samlede score.
      newCar: function () {
        if (!game.canNewCar()) return null;
        var score = p.carScore, bil = p.bil;
        var np = newProgress(bil + 1);
        np.angle = p.angle; np.power = p.power;
        for (var k in np) p[k] = np[k];
        crs = game.course = course(seedForCar(p.bil));
        game.lastResult = null;
        return { bil: bil, score: score };
      },
      goals: function () { return activeGoals(p.goals); },
      save: function () { return JSON.parse(JSON.stringify(p)); }
    };
    return game;
  }

  var api = {
    DT: DT, G: G, RAMPE: RAMPE, ZONER: ZONER, OPG: OPG, BILER: BILER, TING: TING, MAAL: MAAL,
    ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX, NY_BIL_KRAV: NY_BIL_KRAV,
    zoneAt: zoneAt, zoneIndex: zoneIndex, pris: pris, stats: stats, bilType: bilType, niveauSum: niveauSum,
    course: course, chunk: chunk, seedForCar: seedForCar, newFlight: newFlight, clone: clone, step: step,
    advance: advance, predict: predict, activeGoals: activeGoals, goal: goal, multiplier: multiplier,
    newProgress: newProgress, sanitize: sanitize, createGame: createGame
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RampenLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
