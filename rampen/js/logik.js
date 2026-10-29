/*
 * Rampen – spillogik. Ingen DOM, ingen farver og ingen grafik.
 *
 * En lille bil sendes ud over en rampe. Den flyver, hopper på trampoliner og
 * balloner, samler mønter og tager skade ved hårde landinger, til den holder
 * stille. Afstanden giver mønter, og mønterne køber opgraderinger. Der er ingen
 * grænse for antal ture.
 *
 * Fysikken kører med fast tidsskridt (1/60 s) og er helt deterministisk:
 * samme bil, samme bane, samme vind og samme valg giver altid samme tur.
 * Hver tur har sin egen bane og sin egen vind (et frø pr. tur, som gemmes).
 *
 * Skjult for spilleren: vinden (en fast del pr. tur + vindstød, der skifter
 * langs banen) og alt, der ligger længere fremme end udsynet (35–50 m). Derfor
 * viser spillet aldrig, præcis hvor bilen lander, men et landingsfelt ("ca.
 * 60–90 m"), som regnes ud fra det, bilen kan se, og et skøn over vinden.
 * Instrumenter gør skønnet bedre (smallere felt), men vindstødene kendes aldrig.
 *
 * Turen afspilles i stykker. advance() kører, til bilen enten holder stille,
 * eller til et beslutningspunkt (toppen af et hop – ét pr. hop), hvor
 * spilleren vælger ét af 2–3 valgkort (fx "Brug boost nu", "Tag ballonen",
 * "Næse op"). Ingen hurtige reaktioner: intet sker, før der er valgt.
 *
 * Fund (v1.6): på toppen af et hop kan der dukke et fund op i luften lige foran
 * bilen (fra turens frø). Det giver en fordel, der kun gælder resten af turen –
 * fx Reservehjul, Kompas eller Mønt-magnet – eller er et risikofund med en bagside
 * (Guldfeber, Nitro). Fundet tages med valgkortet "Tag fundet" (bilen styrer
 * igennem det og taber lidt fart) i stedet for fx et boost.
 * Fundene nulstilles, når turen slutter.
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
    { id: 'vinger', navn: 'Vinger', max: 5, base: 80, vaekst: 1.75, tekst: 'Svæver længere. Giver næsekort (op eller ned)' },
    { id: 'raket', navn: 'Raket', max: 5, base: 60, vaekst: 1.7, tekst: 'Kraftigere boost' },
    { id: 'braendstof', navn: 'Brændstof', max: 4, base: 70, vaekst: 1.9, tekst: 'Raketbrændstof til ét boost mere pr. tur' },
    { id: 'faldskaerm', navn: 'Faldskærm', max: 4, base: 45, vaekst: 1.7, tekst: 'Blødere landinger' },
    { id: 'instrumenter', navn: 'Instrumenter', max: 5, base: 40, vaekst: 1.8, tekst: 'Smallere landingsfelt og længere udsyn' }
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
      thrust: 13 + 5 * g('raket'),                      // m/s² i 1,2 s
      boostTid: 1.2,
      boosts: 1 + g('braendstof'),
      skaerm: 0.12 * g('faldskaerm'),                   // andel, faldskærmen tager af landingen
      instr: g('instrumenter'),
      udsyn: 35 + 3 * g('instrumenter'),                // meter, bilen kan se frem
      usikker: 1 - 0.15 * g('instrumenter')             // hvor usikkert vindskønnet er (1 = intet skøn)
    };
  }
  // Bilens udseende: fra sæbekassebil til raketbil (navngivne temaelementer)
  var BILER = ['saebekasse', 'folkevogn', 'sportsvogn', 'raketbil'];
  function bilType(u) {
    var n = 0; OPG.forEach(function (o) { n += (u && u[o.id]) || 0; });
    return n >= 29 ? 'raketbil' : n >= 17 ? 'sportsvogn' : n >= 6 ? 'folkevogn' : 'saebekasse';
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
  // Forhindringer: én i hvert stykke bane (i forstaden i hvert andet)
  var ONDE = {
    forstad: { kegle: 3, sten: 1 },
    oerken: { kaktus: 3, sten: 1 },
    bjerge: { sten: 3, kaktus: 1 },
    skyer: { kegle: 2, sten: 1 },
    rummet: { sten: 1 }
  };
  // ---------- Fund (v1.6): fordele, der kun gælder resten af turen ----------
  // stak = hvor mange der kan være aktive ad gangen (et ekstra fund giver ellers FUND_DUBLET mønter)
  var FUND = [
    { id: 'reservehjul', navn: 'Reservehjul', kort: 'Næste hårde landing uden skade', tekst: 'Den næste hårde landing giver ingen skade', stak: 2 },
    { id: 'kompas', navn: 'Kompas', kort: 'Smallere felter, længere udsyn', tekst: 'Smallere landingsfelter og 8 m længere udsyn resten af turen', stak: 1 },
    { id: 'magnet', navn: 'Mønt-magnet', kort: 'Trækker mønter til sig', tekst: 'Mønter i nærheden bliver trukket til bilen resten af turen', stak: 1 },
    { id: 'koeler', navn: 'Køler', kort: 'Boost uden overophedning', tekst: 'Boost overopheder ikke og lander blødere resten af turen', stak: 1 },
    { id: 'vimpel', navn: 'Vindvimpel', kort: 'Viser vinden svagt', tekst: 'Viser svagt, hvordan vinden blæser, og gør felterne lidt smallere', stak: 1 },
    { id: 'guldfeber', navn: 'Guldfeber', kort: 'Dobbelt mønter, skrøbelig bil', tekst: 'Dobbelt mønter, men bilen tager 50 % mere skade resten af turen', stak: 1, risiko: true },
    { id: 'nitro', navn: 'Nitro', kort: '+2 boost, dobbelt overophedning', tekst: '+2 boost nu, men boost overopheder dobbelt og giver ingen mønter ved slut', stak: 3, risiko: true }
  ];
  var FUND_ID = {}; FUND.forEach(function (d) { FUND_ID[d.id] = d; });
  var FUND_DUBLET = 15;                         // mønter for et fund, man allerede har
  var FUND_CHANCE = 0.4;                        // chance for et fund ved hver top
  var FUND_PULJE = {
    forstad: { reservehjul: 3, magnet: 3, kompas: 2, vimpel: 2, koeler: 1, guldfeber: 1 },
    oerken: { reservehjul: 2, magnet: 2, kompas: 2, vimpel: 2, koeler: 2, guldfeber: 2, nitro: 1 },
    bjerge: { reservehjul: 2, magnet: 2, kompas: 2, vimpel: 1, koeler: 2, guldfeber: 2, nitro: 2 },
    skyer: { reservehjul: 2, magnet: 2, kompas: 1, vimpel: 1, koeler: 2, guldfeber: 2, nitro: 2 },
    rummet: { reservehjul: 2, magnet: 2, kompas: 1, vimpel: 1, koeler: 2, guldfeber: 2, nitro: 2 }
  };
  // Et fund dukker op i luften ved et beslutningspunkt (frø: turens vind + toppens nummer).
  // Det svæver lidt foran bilen, over eller under den vej, bilen ellers tager, så man
  // skal vælge kortet "Tag fundet" (og tabe lidt fart) for at få det.
  function spawnFund(f, st) {
    f.topN = (f.topN | 0) + 1;
    if (!f.vind || !f.fundSpawns || !FUND_TIL.til) return null;
    var r = rng(hash((f.vind.s >>> 0) ^ 0x46554E44, f.topN));
    if (r() >= FUND_CHANCE) return null;
    var z = zoneAt(f.x).id, id = vaelg(r, FUND_PULJE[z]), d = FUND_ID[id];
    var D = 13 + r() * 6, side = r() < 0.5 ? 1 : -1, off = 4 + r() * 1.5;
    // Hvor bilen er D m fremme, hvis intet vælges – fundet lægges ved siden af den vej
    var c = clone(f); c.luftI = -1;
    var n = 0, vej = [];
    while (c.x < f.x + D + 6 && n++ < 900) { step(c, st, TOM_BANE, false); vej.push(c.x, c.y + 0.6); if (c.ground || c.done) break; }
    var yAt = null; for (var i = 0; i < vej.length; i += 2) if (vej[i] >= f.x + D) { yAt = vej[i + 1] - 0.6; break; }
    if (yAt === null) return null;
    var y = 0;
    for (var forsoeg = 0; forsoeg < 4; forsoeg++, off += 1) {
      y = yAt + side * off; if (y < 2.5) { side = 1; y = yAt + off; }
      var naer = 1e9; for (var j = 0; j < vej.length; j += 2) naer = Math.min(naer, Math.hypot(vej[j] - f.x - D, vej[j + 1] - y));
      if (naer > 3.4) break;
    }
    var o = { id: 1000000 + f.topN, type: 'fund', fund: id, risiko: !!d.risiko, x: f.x + D, y: y, r: 1.8, t0: f.t, t1: null };
    f.fundSpawns.push(o); f.luftI = f.fundSpawns.length - 1;
    return o;
  }
  var FUND_TIL = { til: true };                 // kun til tests/sammenligning: fund slået fra
  var TOM_BANE = { seed: 0, range: function () { return []; } };
  function aktivtFund(f) { return f.fundSpawns && f.luftI >= 0 ? f.fundSpawns[f.luftI] : null; }
  function harFund(f, id) { return !!(f && f.fund && f.fund[id] > 0); }
  // Bilens værdier med fundene (kompas og vimpel) – samme objekt, hvis intet ændres
  function eff(f, st) {
    var b = st.base || st;
    if (!f || !f.fund || !(harFund(f, 'kompas') || harFund(f, 'vimpel'))) return b;
    var c = {}; for (var k in b) c[k] = b[k];
    c.base = b;
    if (harFund(f, 'kompas')) { c.usikker = Math.min(1, b.usikker) * 0.65; c.udsyn = b.udsyn + 8; }
    if (harFund(f, 'vimpel')) c.usikker = Math.min(1, c.usikker) * 0.85;
    return c;
  }
  function skadeFaktor(f) { return harFund(f, 'guldfeber') ? 1.5 : 1; }
  function tagFund(f, o) {
    var d = FUND_ID[o.fund]; if (!d) return;
    if (!f.fund) f.fund = {};
    if (!f.fundListe) f.fundListe = [];
    if (!f.fundStat) f.fundStat = nyFundStat();
    var n = f.fund[d.id] || 0;
    if (f.fundListe.indexOf(d.id) < 0) f.fundListe.push(d.id);
    if (d.id === 'nitro') { f.boosts += 2; f.fundStat.nitro += 2; f.fund.nitro = n + 1; return; }
    if (d.id !== 'nitro' && n >= d.stak) { f.coins += FUND_DUBLET; f.fundStat.dublet += FUND_DUBLET; return; }
    f.fund[d.id] = n + 1;
  }
  function nyFundStat() { return { reddet: 0, sparet: 0, ekstraMoent: 0, ekstraSkade: 0, nitro: 0, dublet: 0, magnet: 0 }; }
  // Vindvimplens svage vink: kun retningen, og kun når vinden er tydelig
  function vimpelVink(f) {
    if (!harFund(f, 'vimpel') || !f.vind) return null;
    var bx = f.vind.bx, by = f.vind.by;
    return { x: bx > 0.25 ? 'medvind' : bx < -0.25 ? 'modvind' : 'svag', y: by > 0.3 ? 'opvind' : by < -0.3 ? 'nedvind' : 'svag' };
  }

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
      // Den sidste ting i hvert stykke er en forhindring (i forstaden kun i hvert andet)
      var ond = i === n - 1 && (n === 2 || k % 2 === 1) && (k % 2 === 1 || zoneAt(x).id !== 'forstad');
      var z = zoneAt(x).id, type = vaelg(r, ond ? ONDE[z] : PULJE[z]);
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
  // Ny bane (og ny vind) for hver tur: frøet afhænger af bilen og turens nummer
  function seedForTrip(bil, trips) { return hash(seedForCar(bil), (trips | 0) + 1); }

  // Kun det, bilen kan se: ting, der starter efter grænsen, findes ikke (endnu)
  function synlig(crs, lim) {
    return {
      seed: crs.seed, lim: lim,
      range: function (a, b) {
        if (a > lim) return [];
        return crs.range(a, Math.min(b, lim)).filter(function (o) { return o.x - (o.r || 0) <= lim; });
      }
    };
  }

  // ---------- Vind (skjult) ----------
  // Fast vind pr. tur (bx, by i [-1, 1]) + vindstød, der skifter hver 20. m.
  // Virker som en skjult kraft på bilen i luften (m/s²), stærkere i de høje zoner.
  var VIND = { sx: 1.3, sy: 0.9, stoed: 0.4, knude: 20 };
  var VIND_ZONE = { forstad: 0.8, oerken: 1, bjerge: 1.2, skyer: 1.4, rummet: 1.1 };
  function unit(h) { return (h >>> 0) / 4294967296 * 2 - 1; }
  function windFor(seed) { return { bx: unit(hash(seed, 99991)), by: unit(hash(seed, 99992)), s: hash(seed, 4242) }; }
  function gust(w, x, akse) {
    var q = x / VIND.knude, k = Math.floor(q), t = q - k;
    var a = unit(hash(w.s + akse * 7777, k)), b = unit(hash(w.s + akse * 7777, k + 1));
    t = t * t * (3 - 2 * t);
    return a + (b - a) * t;
  }
  // vmod (kun i forhåndsberegninger): {bx, by, gx, gy} i stedet for den rigtige vind
  function windAcc(f, x) {
    var w = f.vind; if (!w) return null;
    var zs = VIND_ZONE[zoneAt(x).id] || 1, m = f.vmod;
    var bx = m ? m.bx : w.bx, by = m ? m.by : w.by;
    var gx = m ? m.gx : gust(w, x, 0), gy = m ? m.gy : gust(w, x, 1);
    return { ax: VIND.sx * zs * (bx + VIND.stoed * gx), ay: VIND.sy * zs * (by + VIND.stoed * gy) };
  }
  // Instrumenternes skøn over den faste vind ved beslutning nr. f.valg: et interval,
  // der altid indeholder den rigtige vind, men hvis midte er skævt (skjult fejl).
  function windEstimate(f, st) {
    var w = f.vind, u = st.usikker;
    function akse(v, salt) {
      if (!w || u >= 1) return [-1, 0, 1];
      var e = unit(hash(w.s ^ salt, f.valg | 0)) * (harFund(f, 'vimpel') ? 0.4 : 1), mid = v + e * u;
      var lo = Math.max(-1, mid - u), hi = Math.min(1, mid + u);
      return [lo, (lo + hi) / 2, hi];
    }
    return { bx: akse(w ? w.bx : 0, 0x5151), by: akse(w ? w.by : 0, 0x7373) };
  }

  // ---------- Fysik ----------
  // Turens tilstand (kan klones til forhåndslinjer)
  function newFlight(st, course0, angle, power, vind) {
    var v0 = st.vmax * (0.4 + 0.06 * power), a = angle * Math.PI / 180;
    return {
      vind: vind || null, vmod: null, sigt: null, touchX: null, valg: 0,
      t: 0, x: 0, y: RAMPE.h, vx: v0 * Math.cos(a), vy: v0 * Math.sin(a),
      ground: false, hp: st.maxHp, boosts: st.boosts, boostT: 0, nose: 'lige', boostedHop: false,
      taken: {}, coins: 0, picked: 0, tramps: 0, balloons: 0, boostsUsed: 0, dmg: 0,
      airStart: 0, longestAir: 0, apex: RAMPE.h, topFrozen: false, chuteT: 0, hops: 0, landings: 0,
      done: false, end: null, lastHit: null,
      fund: {}, fundListe: [], fundStat: nyFundStat(), fundSpawns: [], luftI: -1, topN: 0
    };
  }
  function clone(f) {
    var c = {}; for (var k in f) c[k] = f[k];
    c.taken = {}; for (var t in f.taken) c.taken[t] = f.taken[t];
    if (f.sigt) c.sigt = { pts: f.sigt.pts, i: f.sigt.i, type: f.sigt.type };
    c.fund = {}; for (var u in f.fund) c.fund[u] = f.fund[u];
    c.fundListe = (f.fundListe || []).slice();
    c.fundStat = {}; var fs = f.fundStat || nyFundStat(); for (var q in fs) c.fundStat[q] = fs[q];
    c.fundSpawns = (f.fundSpawns || []).slice();
    if (c.luftI >= 0 && c.fundSpawns[c.luftI]) { var a0 = c.fundSpawns[c.luftI], a1 = {}; for (var w in a0) a1[w] = a0[w]; c.fundSpawns[c.luftI] = a1; }
    return c;
  }
  // Næsen (kun med vinger, valgt med et kort for ét hop ad gangen): op = svæver
  // længere, men lander hårdere (mere skade); ned = kortere hop, men blød landing,
  // der bevarer farten.
  var AIM_A = 16;                               // m/s²: hvor hårdt bilen kan styre mod et mål
  // Næse: pitch er ekstra op/ned-acceleration (andel af g). Op og ned skal give tydeligt forskellige landinger.
  var NOSE = {
    lige: { lift: 1, drag: 1, land: 1, pitch: 0 },
    op:   { lift: 2.6, drag: 1.08, land: 1.2, pitch: 0.18 },
    ned:  { lift: 0.05, drag: 0.75, land: 0.5, pitch: -0.4 }
  };

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
      var wa = windAcc(f, f.x) || { ax: 0, ay: 0 };
      // Medvind skubber mindre, jo hurtigere bilen kører; opdrift + opvind kan aldrig bære hele bilen
      var wx = wa.ax > 0 ? wa.ax * Math.max(0, 1 - f.vx / 40) : wa.ax;
      var up = Math.min(lift + wa.ay, 0.9 * g);
      f.vx += (-dr * v * f.vx + thrust * ca + wx) * DT;
      // Pitch (næse) lægges på før loftet, så opdrift+pitch+opvind aldrig bærer hele bilen
      var vert = Math.min(up + nz.pitch * g, 0.9 * g);
      if (nz.pitch < 0) vert = up + nz.pitch * g;       // næse ned: fuld nedadgående pitch
      f.vy += (-g - dr * v * f.vy + vert + thrust * sa) * DT;
      if (f.sigt) steer(f, g);
      f.x += f.vx * DT; f.y += f.vy * DT;
      if (f.y > f.apex) f.apex = f.y;
      if (f.y <= 0) land(f, st, crs);
    }
    f.t += DT;
    collide(f, st, crs);
    if (f.luftI >= 0) fundCollide(f);
    if (f.hp <= 0 && !f.done) { f.hp = 0; f.done = true; f.end = 'smadret'; f.vx = 0; f.vy = 0; f.y = Math.max(0, f.y); f.ground = f.y <= 0; }
    if (!f.ground && wasGround) { f.airStart = f.x; f.apex = f.y; f.topFrozen = false; }
    if (f.done) return 'end';
    if (!freezes || f.ground || f.boostT > 0) return null;
    // Toppen af et hop (mindst 3 m oppe). advance() afgør, om der er noget at vælge.
    if (!f.topFrozen && prevVy > 0 && f.vy <= 0 && f.y >= 3) { f.topFrozen = true; return 'top'; }
    return null;
  }
  // Styr mod et mål (valgkortet "Tag ballonen", "Dyk mod mønterne" …): bilen
  // retter sin bue ind, så den rammer målet, men kan højst styre med AIM_A.
  function steer(f, g) {
    var s = f.sigt;
    while (s.i < s.pts.length && (s.pts[s.i].x - f.x < 0.3 || f.taken[s.pts[s.i].id] !== undefined)) s.i++;
    if (s.i >= s.pts.length) { f.sigt = null; return; }
    var p = s.pts[s.i], tt = (p.x - f.x) / Math.max(f.vx, 2);
    var vyd = (p.y - f.y) / tt + 0.5 * g * tt;
    f.vy += Math.max(-AIM_A, Math.min(AIM_A, (vyd - f.vy) * 5)) * DT;
  }
  function onOil(f, crs) {
    var l = crs.range(f.x - 1, f.x + 1);
    for (var i = 0; i < l.length; i++) if (l[i].type === 'olie' && f.x >= l[i].x && f.x <= l[i].x + l[i].w) return true;
    return false;
  }
  function land(f, st, crs) {
    f.y = 0;
    if (f.touchX === null) f.touchX = f.x;
    f.sigt = null;
    var air = f.x - f.airStart;
    if (air > f.longestAir) f.longestAir = air;
    // Trampolinen tager imod landingen (ingen skade)
    var l = crs.range(f.x - 1, f.x + 1);
    for (var i = 0; i < l.length; i++) {
      var o = l[i];
      if (o.type === 'trampolin' && f.x >= o.x && f.x <= o.x + o.w) {
        f.vy = Math.max(-f.vy * 0.9, 12); f.tramps++; f.hops++; f.lastHit = 'trampolin';
        f.apex = 0; f.airStart = f.x; f.topFrozen = false; f.boostedHop = false;
        return;
      }
    }
    var nz = st.vinger ? NOSE[f.nose] : NOSE.lige;
    var boostLand = f.boostedHop ? (harFund(f, 'koeler') ? 1.35 : 1.9) : 1;     // boost giver hårdere landing (Køler: blødere)
    var impact = -f.vy * (1 - st.skaerm) * nz.land * boostLand;
    f.nose = 'lige'; f.boostedHop = false;       // næse og boost-skade gælder ét hop
    f.landings++;
    if (st.skaerm > 0 && impact > 9) f.chuteT = f.t;
    if (impact > 9) {
      var d = (impact - 9) * 3.2 * st.panser * skadeFaktor(f);
      if (harFund(f, 'reservehjul')) { f.fund.reservehjul--; f.fundStat.reddet++; f.fundStat.sparet += d; f.lastHit = 'reservehjul'; }
      else { f.hp -= d; f.dmg += d; f.lastHit = 'landing'; if (harFund(f, 'guldfeber')) f.fundStat.ekstraSkade += d / 3; }
    }
    var oil = onOil(f, crs);
    if (impact > 3) {
      f.vy = impact * st.hop; f.vx *= oil ? 1 : Math.min(1, st.behold + (nz.land < 1 ? 0.15 : 0));
      f.apex = 0; f.airStart = f.x; f.topFrozen = false;
      if (f.vy < 1.5) { f.vy = 0; f.ground = true; }
    } else { f.vy = 0; f.ground = true; }
  }
  function collide(f, st, crs) {
    var mag = harFund(f, 'magnet'), l = crs.range(f.x - (mag ? 5 : 2), f.x + (mag ? 5 : 2));
    for (var i = 0; i < l.length; i++) {
      var o = l[i];
      if (f.taken[o.id] !== undefined) continue;
      var hit = false;
      if (o.r) {
        var dd = Math.hypot(f.x - o.x, f.y + 0.6 - o.y);
        hit = dd < o.r + 0.8;
        if (!hit && mag && o.type === 'moent' && dd < o.r + 4.2) { hit = true; f.fundStat.magnet++; }
      }
      else if (o.type === 'vind') hit = f.x >= o.x && f.x <= o.x + o.w && f.y >= o.y && f.y <= o.y + o.h;
      else if (o.type === 'rampe') hit = f.x >= o.x + 0.5 && f.x <= o.x + o.w && f.y <= o.h * (f.x - o.x) / o.w + 0.3 && f.vx > 0;
      else if (o.type === 'olie' || o.type === 'trampolin') hit = false;  // håndteres ved landing/rulning
      else hit = f.x >= o.x - 0.4 && f.x <= o.x + o.w + 0.4 && f.y < o.h;
      if (!hit) continue;
      f.taken[o.id] = f.t;
      f.lastHit = o.type;
      switch (o.type) {
        case 'moent': f.coins += guld(f, 5); f.picked++; break;
        case 'bonus': f.coins += guld(f, 10); f.boosts++; break;
        case 'fund': tagFund(f, o); break;
        case 'ballon': f.vy = Math.max(f.vy, 0) + 9; f.balloons++; f.ground = false; resetJump(f); break;
        case 'vind': f.vx += 6; f.vy += 3; break;
        case 'rampe':
          if (f.touchX === null) f.touchX = f.x;
          var s = Math.max(8, Math.hypot(f.vx, f.vy));
          f.vx = s * 0.866; f.vy = s * 0.5 + 3; f.y = Math.max(f.y, 0.01); f.ground = false; resetJump(f); f.airStart = f.x; break;
        case 'sten': hurt(f, 14 * st.panser); f.vx *= 0.55; if (f.ground && f.vx > 2) { f.vy = 3; f.ground = false; f.apex = f.y; f.topFrozen = false; } break;
        case 'kaktus': hurt(f, 8 * st.panser); f.vx *= 0.75; break;
        case 'kegle': hurt(f, 2 * st.panser); f.vx *= 0.88; break;
      }
    }
  }
  // Fundet i luften: tages, når bilen flyver igennem; forsvinder, når bilen er forbi eller lander
  function fundCollide(f) {
    var o = aktivtFund(f); if (!o) return;
    if (Math.hypot(f.x - o.x, f.y + 0.6 - o.y) < o.r + 0.8) { f.taken[o.id] = f.t; f.lastHit = 'fund'; f.luftI = -1; tagFund(f, o); return; }
    if (f.x > o.x + 3 || f.ground) { o.t1 = f.t; f.luftI = -1; }
  }
  function resetJump(f) { f.apex = f.y; f.topFrozen = false; }
  function hurt(f, d) { var k = skadeFaktor(f); f.hp -= d * k; f.dmg += d * k; if (k > 1) f.fundStat.ekstraSkade += d * (k - 1); }
  // Guldfeber: dobbelt mønter
  function guld(f, n) { if (!harFund(f, 'guldfeber')) return n; f.fundStat.ekstraMoent += n; return n * 2; }

  // Et billede til animationen
  function frame(f, st) { return { t: f.t, x: f.x, y: f.y, vx: f.vx, vy: f.vy, hp: f.hp, coins: f.coins, boost: f.boostT > 0, ground: f.ground, nose: f.nose, boosts: f.boosts, hops: f.hops, landings: f.landings, dmg: f.dmg,
    fundN: f.fundListe ? f.fundListe.length : 0, reddet: f.fundStat ? f.fundStat.reddet : 0,
    chute: st.skaerm > 0 && !f.ground && f.vy < -9 && f.y < 30 }; }

  // Kør, til der skal vælges, eller til bilen holder stille.
  // Et top-stop kræver mindst to valgkort (ellers kører bilen bare videre).
  function advance(f, st, crs) {
    var frames = [frame(f, st)], ev = null, n = 0;
    while (!ev && n < MAX_STEPS) {
      ev = step(f, st, crs, true); n++;
      if (ev === 'top') spawnFund(f, st);
      if (ev === 'top' && cards(f, st, crs).length < 2) ev = null;
      if (n % 2 === 0 || ev) frames.push(frame(f, st));
    }
    if (!ev) { f.done = true; f.end = 'stop'; ev = 'end'; }
    return { frames: frames, event: ev };
  }
  // Kør en kopi videre (uden beslutninger), til den rører jorden første gang
  // (eller en trampolin eller rampe), eller holder stille.
  function runToTouch(c, st, crs, maxN) {
    c.touchX = null;
    var pts = [{ x: c.x, y: c.y }], n = 0, start = c.ground;
    maxN = maxN || 60 * 90;
    while (n < maxN) {
      var ev = step(c, st, crs, false); n++;
      if (n % 3 === 0) pts.push({ x: c.x, y: c.y });
      if (ev === 'end' || c.touchX !== null || (start && c.done)) break;
    }
    pts.push({ x: c.x, y: c.y });
    return { pts: pts, x: c.touchX !== null ? c.touchX : c.x, end: c.end, hp: c.hp, taken: c.taken, done: c.done };
  }
  // Forhåndslinje med den rigtige vind og hele banen (bruges KUN af tests og
  // fejlfinding – spillet viser den aldrig).
  function predict(f, st, crs, opts) {
    var c = clone(f); opts = opts || {};
    if (opts.card) applyCard(c, st, opts.card);
    else if (opts.nose) applyCard(c, st, { id: opts.nose });
    else if (opts.boost) applyCard(c, st, { id: 'boost' });
    var r = runToTouch(c, st, crs, 60 * 120);
    return { pts: r.pts, x: r.x, landed: !r.done, end: r.end, hp: r.hp };
  }

  // ---------- Valgkort ----------
  // Et kort er én handling på toppen af et hop:
  //   boost  – tænd raketten (bruger 1 boost)
  //   sigt   – styr mod en god ting inden for udsyn (ballon, mønter, dunk, trampolin); taber 10 % fart
  //   op/ned – næsens stilling for dette hop (kun med vinger)
  //   vent   – ingenting ("Gem boostet" / "Glid videre")
  function applyCard(c, st, card) {
    var id = card && card.id || 'vent';
    c.nose = 'lige'; c.sigt = null;
    if (id === 'boost' && c.boosts > 0) {
      c.boosts--; c.boostT = st.boostTid; c.boostsUsed++;
      c.boostedHop = true;                          // dette hop lander hårdere
      // overophedning (Køler: ingen; Nitro: dobbelt; Guldfeber: +50 %)
      var burn = harFund(c, 'koeler') ? 0 : st.maxHp * 0.11 * (harFund(c, 'nitro') ? 2 : 1) * skadeFaktor(c);
      c.hp -= burn; c.dmg += burn;
    } else if (id === 'sigt' && card.target) { c.sigt = { pts: card.target.pts, i: 0, type: card.target.type }; c.vx *= 0.9; }
    else if (id === 'op' && st.vinger) { c.nose = 'op'; c.vy += 6; }
    else if (id === 'ned' && st.vinger) { c.nose = 'ned'; c.vy -= 5; c.vx *= 1.06; }
  }
  var MAAL_NAVN = {
    bonus: { titel: 'Tag brændstofdunken', effekt: '+1 boost og +10 mønter. Taber lidt fart', ikon: 'braendstof' },
    ballon: { titel: 'Tag ballonen', effekt: 'Løft og et nyt hop. Taber lidt fart', ikon: 'ballon' },
    moenter: { titel: 'Styr mod mønterne', effekt: 'Saml mønter. Taber lidt fart', ikon: 'moent' },
    dyk: { titel: 'Dyk mod mønterne', effekt: 'Saml mønter. Hårdere landing', ikon: 'moent' },
    trampolin: { titel: 'Land på trampolinen', effekt: 'Højt hop uden skade. Taber lidt fart', ikon: 'trampolin' }
  };
  // Mulige mål inden for udsyn (nærmeste først, gode ting først)
  function targets(f, st, vis) {
    var lim = f.x + st.udsyn, out = { fund: [], bonus: [], ballon: [], moenter: [], trampolin: [] };
    var l = vis.range(f.x + 5, lim).filter(function (o) { return f.taken[o.id] === undefined && o.x > f.x + 5; });
    var af = aktivtFund(f);
    if (af && f.taken[af.id] === undefined && af.x <= lim) l.push(af);
    l.sort(function (a, b) { return a.x - b.x; });
    var grp = null;
    l.forEach(function (o) {
      if (o.type === 'moent') {
        if (grp && o.x - grp.last < 3) { grp.pts.push({ id: o.id, x: o.x, y: o.y - 0.6 }); grp.last = o.x; }
        else { grp = { type: 'moenter', pts: [{ id: o.id, x: o.x, y: o.y - 0.6 }], last: o.x }; out.moenter.push(grp); }
      } else if (o.type === 'bonus' || o.type === 'ballon') out[o.type].push({ type: o.type, pts: [{ id: o.id, x: o.x, y: o.y - 0.6 }] });
      else if (o.type === 'fund') out.fund.push({ type: 'fund', fund: o.fund, pts: [{ id: o.id, x: o.x, y: o.y - 0.6 }] });
      else if (o.type === 'trampolin') out.trampolin.push({ type: 'trampolin', pts: [{ id: o.id, x: o.x + o.w / 2, y: 0 }] });
    });
    return out;
  }
  function midModel(f, st) { var e = windEstimate(f, st); return { bx: e.bx[1], by: e.by[1], gx: 0, gy: 0 }; }
  // Kortene for denne situation (2–3 stk., eller færre, hvis der intet er at vælge)
  function cards(f, st, crs) {
    st = eff(f, st);
    var vis = synlig(crs, f.x + st.udsyn), list = [];
    var boost = f.boosts > 0 ? { id: 'boost', ikon: 'boost', titel: 'Brug boost nu', effekt: 'Længere hop. Hårdere landing og overophedning' } : null;
    // Sigt: det første mål, bilen faktisk kan nå (prøvet med skønnet over vinden)
    var sigt = null, tg = targets(f, st, vis), mm = midModel(f, st);
    ['fund', 'bonus', 'ballon', 'moenter', 'trampolin'].some(function (type) {
      return tg[type].slice(0, 2).some(function (t) {
        if (type === 'moenter' && t.pts.length < 2) return false;
        var c = clone(f); c.vmod = mm;
        applyCard(c, st, { id: 'sigt', target: t });
        var r = runToTouch(c, st, vis);
        var hit = t.pts.filter(function (p) { return r.taken[p.id] !== undefined; }).length;
        if (hit < (type === 'moenter' ? 2 : 1)) return false;
        var key = type === 'moenter' && t.pts[0].y < f.y - 3 ? 'dyk' : type, nv = MAAL_NAVN[key];
        if (type === 'fund') {
          var fd = FUND_ID[t.fund], dub = fd.id !== 'nitro' && (f.fund[fd.id] || 0) >= fd.stak;
          nv = { titel: 'Tag fundet: ' + fd.navn, effekt: dub ? 'Har det allerede: +' + FUND_DUBLET + ' mønter. Taber lidt fart' : fd.kort + '. Taber lidt fart', ikon: 'fund-' + fd.id };
        }
        sigt = { id: 'sigt', ikon: nv.ikon, titel: nv.titel, effekt: nv.effekt, target: { type: type, pts: t.pts }, fund: type === 'fund' ? t.fund : undefined, risiko: type === 'fund' ? !!FUND_ID[t.fund].risiko : undefined };
        return true;
      });
    });
    var vent = { id: 'vent', ikon: 'vent', titel: f.boosts > 0 ? 'Gem boostet' : 'Glid videre',
      effekt: f.boosts > 0 ? 'Spar det (+' + SPARE_BOOST + ' mønter pr. ubrugt ved slut)' : 'Ingen ændring' };
    var noser = [], nosePar = false;
    if (st.vinger) {
      var op = { id: 'op', ikon: 'naese-op', titel: 'Næse op', effekt: 'Længere og højere. Hårdere landing' };
      var ned = { id: 'ned', ikon: 'naese-ned', titel: 'Næse ned', effekt: 'Kortere, blød landing. Bevarer fart' };
      // Kun begge næsekort, når felterne er tydeligt forskellige (ellers det mest nyttige)
      var fOp = field(f, st, crs, op), fNed = field(f, st, crs, ned);
      var midOp = (fOp.fra + fOp.til) / 2, midNed = (fNed.fra + fNed.til) / 2;
      nosePar = midOp - midNed >= 8 && (fOp.fra !== fNed.fra || fOp.til !== fNed.til);
      if (nosePar) {
        noser = fNed.skadeMax + 2 < fOp.skadeMax ? [ned, op] : [op, ned];
      } else {
        var hard = fOp.skadeMax >= st.maxHp * 0.2 || fNed.skadeMax >= st.maxHp * 0.2;
        noser = [hard ? (fNed.skadeMax <= fOp.skadeMax ? ned : op) : (midOp >= midNed ? op : ned)];
      }
    }
    // Med boost: "Gem boostet" er med, medmindre begge næsekort er det tydelige valg
    // (næse bruger ikke boost, så gemning stadig er mulig ved at vælge næse).
    if (boost) {
      if (nosePar && !sigt) list = [boost].concat(noser);           // boost, næse, næse
      else {
        list = [boost, vent];
        var ekstra = (sigt ? [sigt] : []).concat(noser);
        if (ekstra.length) list.splice(1, 0, ekstra[0]);            // boost, (mål|næse), gem
      }
    } else {
      list = (sigt ? [sigt] : []).concat(noser);
      list.push(vent);
      list = list.slice(0, 3);
      if (!sigt && !st.vinger) list = [];                           // kun "Glid videre": intet at vælge
    }
    return list;
  }
  // Landingsfeltet for et kort: hvor bilen første gang rører jorden, regnet med det,
  // bilen kan se, og ni bud på vinden inden for instrumenternes skøn (± vindstød).
  // Afrundes udad til hele 5 m og er mindst 10 m bredt – aldrig et præcist tal.
  function field(f, st, crs, card) {
    st = eff(f, st);
    var lim = f.x + st.udsyn, vis = synlig(crs, lim), est = windEstimate(f, st);
    var lo = Infinity, hi = -Infinity, hpMin = Infinity, hpMax = -Infinity, smadret = false, mid = null, hits = 0;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      var c = clone(f);
      applyCard(c, st, card);
      c.vmod = { bx: est.bx[i], by: est.by[j], gx: i - 1, gy: j - 1 };
      var r = runToTouch(c, st, vis);
      if (r.x < lo) lo = r.x; if (r.x > hi) hi = r.x;
      if (r.hp < hpMin) hpMin = r.hp; if (r.hp > hpMax) hpMax = r.hp;
      if (r.end === 'smadret') smadret = true;
      if (i === 1 && j === 1) mid = r;
    }
    var a = Math.floor(lo / 5) * 5, b = Math.ceil(hi / 5) * 5;
    if (b - a < 10) { var m = Math.round((a + b) / 10) * 5; a = m - 5; b = m + 5; if (a > lo) { a -= 5; } if (b < hi) b += 5; }
    a = Math.max(0, a);
    // Den skønnede vej vises kun, så langt bilen kan se
    var pts = mid.pts.filter(function (q) { return q.x <= lim; });
    return { fra: a, til: b, raaFra: lo, raaTil: hi, skadeMin: Math.max(0, f.hp - hpMax), skadeMax: Math.max(0, f.hp - hpMin), smadret: smadret, pts: pts };
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
    return { version: 2, bil: bil || 1, coins: 0, upg: u, best: 0, carScore: 0, trips: 0,
      zones: ['forstad'], goals: [], angle: 30, power: 10, seed: seedForTrip(bil || 1, 0) };
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
    out.seed = seedForTrip(out.bil, out.trips);
    if (typeof p.seed === 'number' && p.seed >= 0 && p.seed <= 4294967295 && p.seed === Math.floor(p.seed)) out.seed = p.seed;
    var t = p.tur;
    if (t && typeof t === 'object' && typeof t.seed === 'number' && t.f && typeof t.f === 'object' && !t.f.done &&
      ['x', 'y', 'vx', 'vy', 'hp', 't', 'coins', 'boosts'].every(function (k) { return typeof t.f[k] === 'number' && isFinite(t.f[k]); }) &&
      t.f.taken && typeof t.f.taken === 'object' && t.f.vind && typeof t.f.vind.bx === 'number') {
      out.tur = { seed: t.seed >>> 0, f: t.f };
      if (NOSE[t.f.nose] === undefined) t.f.nose = 'lige';
      // Fund: kun kendte navne og hele tal
      var fu = {}, fl = [], fs0 = nyFundStat();
      if (t.f.fund && typeof t.f.fund === 'object') FUND.forEach(function (d) { var v = Math.floor(+t.f.fund[d.id]); if (v > 0) fu[d.id] = Math.min(v, d.id === 'nitro' ? 9 : d.stak); });
      if (Array.isArray(t.f.fundListe)) t.f.fundListe.forEach(function (id) { if (FUND_ID[id] && fl.indexOf(id) < 0) fl.push(id); });
      if (t.f.fundStat && typeof t.f.fundStat === 'object') for (var q in fs0) { var w = +t.f.fundStat[q]; if (isFinite(w) && w >= 0) fs0[q] = w; }
      var sp = [];
      if (Array.isArray(t.f.fundSpawns)) t.f.fundSpawns.forEach(function (o) {
        if (o && FUND_ID[o.fund] && ['id', 'x', 'y', 't0'].every(function (k) { return typeof o[k] === 'number' && isFinite(o[k]); }))
          sp.push({ id: o.id, type: 'fund', fund: o.fund, risiko: !!FUND_ID[o.fund].risiko, x: o.x, y: o.y, r: 1.8, t0: o.t0, t1: typeof o.t1 === 'number' ? o.t1 : null });
      });
      var li = Math.floor(+t.f.luftI);
      t.f.fund = fu; t.f.fundListe = fl; t.f.fundStat = fs0; t.f.fundSpawns = sp;
      t.f.luftI = li >= 0 && li < sp.length ? li : -1; t.f.topN = Math.max(0, Math.floor(+t.f.topN) || 0);
      t.f.sigt = null; t.f.vmod = null;
    }
    return out;
  }
  var ANGLE_MIN = 10, ANGLE_MAX = 70;
  function multiplier(bil) { return 1 + 0.25 * (bil - 1); }   // Ny bil: +25 % mønter pr. bil
  var NY_BIL_KRAV = 1000;
  var SPARE_BOOST = 55;                       // mønter pr. ubrugt boost ved turens slut

  // Spillet: fremskridt + den aktuelle tur
  function createGame(progress) {
    var p = sanitize(progress);
    var crs = course(p.seed), tur = null, valgCache = null;
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
      // Forhåndslinje for opsendelsen: kun den første korte del af buen (ingen landing).
      // Regnet uden vind og kun med det, bilen kan se.
      launchPreview: function () {
        var st = stats(p.upg), f = newFlight(st, crs, p.angle, p.power, { bx: 0, by: 0, s: 0 });
        f.vmod = { bx: 0, by: 0, gx: 0, gy: 0 };
        var r = runToTouch(f, st, synlig(crs, st.udsyn));
        var n = Math.max(3, Math.ceil(r.pts.length * 0.18));
        return { pts: r.pts.slice(0, n) };
      },
      launch: function () {
        if (game.flight) return null;
        game.st = stats(p.upg);
        game.flight = newFlight(game.st, crs, p.angle, p.power, windFor(p.seed));
        return game.advance();
      },
      advance: function () {
        var r = advance(game.flight, game.st, crs);
        valgCache = null;
        // Gem turen ved hvert beslutningspunkt, så den kan genoptages
        tur = r.event === 'top' ? { seed: p.seed, f: JSON.parse(JSON.stringify(game.flight)) } : null;
        return r;
      },
      // Det, bilen kan se lige nu (til tegning og test)
      udsyn: function () { var f = game.flight, st = eff(f, game.st || stats(p.upg)); return (f ? f.x : 0) + st.udsyn; },
      // Bilens værdier med turens fund (udsyn, usikkerhed)
      effStats: function () { return eff(game.flight, game.st || stats(p.upg)); },
      // Turens fund til visning: [{id, navn, tekst, risiko, antal, brugt}] (n = kun de første n, fx under animationen)
      fund: function (n) {
        var f = game.flight; if (!f || !f.fundListe) return [];
        return f.fundListe.slice(0, n === undefined ? f.fundListe.length : n).map(function (id) {
          var d = FUND_ID[id], a = f.fund[id] || 0;
          return { id: id, navn: d.navn, tekst: d.tekst, kort: d.kort, risiko: !!d.risiko, antal: a, brugt: id === 'reservehjul' && a === 0 };
        });
      },
      vimpel: function () { return vimpelVink(game.flight); },
      synlige: function () { return synlig(crs, game.udsyn()).range(-20, game.udsyn()); },
      // Beslutningspunkt: valgkortene med hver sit usikre landingsfelt
      cards: function () {
        var f = game.flight; if (!f || f.done) return [];
        if (valgCache && valgCache.t === f.t) return valgCache.list;
        var list = cards(f, game.st, crs);
        list.forEach(function (k) { k.felt = field(f, game.st, crs, k); });
        valgCache = { t: f.t, list: list };
        return list;
      },
      options: function () { return { kort: game.cards() }; },
      // Vælg et kort (id), eller true = boost / false = fortsæt uden noget
      decide: function (valg) {
        var f = game.flight; if (!f || f.done) return null;
        var id = valg === true ? 'boost' : valg === false || valg === undefined ? 'vent' : valg;
        var card = game.cards().filter(function (k) { return k.id === id; })[0] || { id: id === 'boost' && f.boosts > 0 ? 'boost' : 'vent' };
        applyCard(f, game.st, card);
        f.valg++; f.touchX = null;
        return game.advance();
      },
      // Turen er slut: mønter, zoner, mål og rekord
      finishTrip: function () {
        var f = game.flight; if (!f || !f.done) return null;
        var dist = Math.max(0, Math.floor(f.x));
        var r = { dist: dist, picked: f.picked, tramps: f.tramps, balloons: f.balloons, boostsUsed: f.boostsUsed, dmg: f.dmg, longestAir: Math.floor(f.longestAir), end: f.end, hp: f.hp };
        var mult = multiplier(p.bil);
        r.distCoins = Math.floor(dist * 0.35 * mult);
        r.pickCoins = Math.floor(f.coins * mult);
        // Ubrugte boost er værdifulde: +SPARE_BOOST mønter pr. stk. (gør "Gem boostet" konkurrencedygtigt)
        // Nitro-boost giver ingen mønter ved slut
        var fs = f.fundStat || nyFundStat();
        r.spareBoosts = Math.max(0, (f.boosts | 0) - Math.min(f.boosts | 0, fs.nitro | 0));
        r.spareCoins = dist >= 60 ? Math.floor(r.spareBoosts * SPARE_BOOST * mult) : 0;
        r.zoneBonus = []; var zb = 0;
        ZONER.forEach(function (z) { if (dist >= z.fra && p.zones.indexOf(z.id) < 0) { p.zones.push(z.id); r.zoneBonus.push({ id: z.id, navn: z.navn, beloen: z.bonus }); zb += z.bonus; } });
        r.goals = []; var gb = 0;
        activeGoals(p.goals).forEach(function (g) { if (g.test(r)) { p.goals.push(g.id); r.goals.push({ id: g.id, tekst: g.tekst, beloen: g.beloen }); gb += g.beloen; } });
        // Fund på turen (de nulstilles nu)
        r.fund = (f.fundListe || []).map(function (id) { var d = FUND_ID[id]; return { id: id, navn: d.navn, risiko: !!d.risiko }; });
        r.fundStat = { reddet: fs.reddet, sparet: Math.round(fs.sparet), ekstraMoent: Math.floor(fs.ekstraMoent * mult), ekstraSkade: Math.round(fs.ekstraSkade), nitro: fs.nitro, dublet: Math.floor(fs.dublet * mult), magnet: fs.magnet };
        r.total = r.distCoins + r.pickCoins + r.spareCoins + zb + gb;
        r.newBest = dist > p.best;
        p.coins += r.total; p.trips++; p.carScore += dist; if (dist > p.best) p.best = dist;
        game.flight = null; game.lastResult = r; tur = null;
        // Næste tur: ny bane og ny vind
        p.seed = seedForTrip(p.bil, p.trips);
        crs = game.course = course(p.seed);
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
        crs = game.course = course(p.seed);
        game.lastResult = null;
        return { bil: bil, score: score };
      },
      goals: function () { return activeGoals(p.goals); },
      save: function () { var o = JSON.parse(JSON.stringify(p)); if (tur && game.flight && !game.flight.done) o.tur = tur; return o; }
    };
    // En tur, der var i gang (gemt ved et beslutningspunkt), fortsætter
    if (p.tur) {
      crs = game.course = course(p.tur.seed);
      game.st = stats(p.upg); game.flight = p.tur.f; tur = p.tur;
      delete p.tur;
    }
    return game;
  }

  var api = {
    DT: DT, G: G, RAMPE: RAMPE, ZONER: ZONER, OPG: OPG, BILER: BILER, TING: TING, MAAL: MAAL,
    ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX, NY_BIL_KRAV: NY_BIL_KRAV,
    zoneAt: zoneAt, zoneIndex: zoneIndex, pris: pris, stats: stats, bilType: bilType, niveauSum: niveauSum,
    SPARE_BOOST: SPARE_BOOST, FUND: FUND, FUND_DUBLET: FUND_DUBLET, spawnFund: spawnFund, FUND_TIL: FUND_TIL, eff: eff, vimpelVink: vimpelVink,
    course: course, chunk: chunk, seedForCar: seedForCar, seedForTrip: seedForTrip, synlig: synlig, newFlight: newFlight, clone: clone, step: step,
    advance: advance, predict: predict, runToTouch: runToTouch, cards: cards, field: field, applyCard: applyCard,
    windFor: windFor, windEstimate: windEstimate, VIND: VIND, activeGoals: activeGoals, goal: goal, multiplier: multiplier,
    newProgress: newProgress, sanitize: sanitize, createGame: createGame
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RampenLogik = api;
})(typeof window !== 'undefined' ? window : globalThis);
