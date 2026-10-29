/*
 * Rumhandleren – spillogik. Ingen DOM, ingen farver, ingen grafik.
 * Alt er turbaseret og tælles i dage. En fast tilfældighedsgenerator (seed)
 * gør spillet gemmeligt og testbart i Node.
 *
 *   var g = RumhandlerenLogik.createGame({ seed: 7 });   // eller createGame(gemtTilstand)
 *   Marked:     g.pris(vare[, planet])  g.koeb(vare, n | 'max')  g.saelg(vare, n | 'alt')
 *   Rejse:      g.rejseInfo(planet)  g.flyv(planet)  g.vent()  g.pirat('betal' | 'flygt' | 'forsikring')
 *   Skibe:      g.koebSkib(type)  g.saetRute(id, a, b)  g.stopRute(id)  g.goerFlagskib(id)  g.ruteEstimat(a, b, type)
 *   Bygninger:  g.byg('mine' | 'fabrik' | 'lager')  g.hentLager()
 *   Kontrakter: g.tilbud()  g.tagKontrakt(id)  g.lever(id)  g.kanLevere(id)
 *   Gæld:       g.regning()  g.naesteForfald()  g.betalAf(n | 'alt')  g.laan(n)  g.saetForsikring(bool)
 *   Point:      g.nettoformue()  g.point()  g.pension()  g.save()
 */
(function (global) {
  'use strict';

  var VARER = [
    { id: 'mad', navn: 'Mad', pris: 24 },
    { id: 'vand', navn: 'Vand', pris: 16 },
    { id: 'malm', navn: 'Malm', pris: 40 },
    { id: 'metal', navn: 'Metal', pris: 90 },
    { id: 'maskiner', navn: 'Maskiner', pris: 190 },
    { id: 'medicin', navn: 'Medicin', pris: 140 },
    { id: 'luksus', navn: 'Luksus', pris: 240 },
    { id: 'glimmer', navn: 'Glimmer', pris: 300, forbudt: 'vega' }   // forbudt i Vega-unionen
  ];
  var FRAKTIONER = [
    { id: 'vega', navn: 'Vega-unionen', told: 0.05, kontrol: 0.4 },
    { id: 'orion', navn: 'Orion-kompagniet', told: 0.03, kontrol: 0 },
    { id: 'kant', navn: 'Kantlauget', told: 0, kontrol: 0 }
  ];
  // n: niveau pr. vare: 2 = stor producent (billig) … −2 = stor forbruger (dyr)
  var PLANETER = [
    { id: 'sirius', navn: 'Sirius', fraktion: 'vega', x: 12, y: 14, br: 12, n: { vand: 2, mad: 1, medicin: -2, maskiner: -1, luksus: -1, glimmer: -1 }, mine: 'vand' },
    { id: 'kepler', navn: 'Kepler', fraktion: 'vega', x: 13, y: 42, br: 11, n: { mad: 2, vand: 1, maskiner: -2, metal: -1, medicin: -1, glimmer: -1 }, mine: 'mad' },
    { id: 'vega', navn: 'Vega', fraktion: 'vega', x: 31, y: 27, br: 13, n: { medicin: 2, luksus: 1, mad: -2, vand: -1, metal: -1, malm: -1, glimmer: -2 }, fabrik: { ind: 'mad', ud: 'medicin' } },
    { id: 'altair', navn: 'Altair', fraktion: 'vega', x: 29, y: 54, br: 14, laast: 25, n: { luksus: 2, medicin: 1, maskiner: -2, mad: -1, metal: -1, glimmer: -2 }, fabrik: { ind: 'metal', ud: 'luksus' } },
    { id: 'orion', navn: 'Orion', fraktion: 'orion', x: 52, y: 9, br: 10, n: { maskiner: 2, metal: -2, mad: -1, medicin: -1, vand: -1 }, fabrik: { ind: 'metal', ud: 'maskiner' } },
    { id: 'rigel', navn: 'Rigel', fraktion: 'orion', x: 50, y: 33, br: 9, n: { metal: 2, maskiner: 1, malm: -2, vand: -1, luksus: -1 }, fabrik: { ind: 'malm', ud: 'metal' } },
    { id: 'bellatrix', navn: 'Bellatrix', fraktion: 'orion', x: 71, y: 21, br: 10, n: { malm: 2, metal: 1, mad: -2, vand: -1, maskiner: -1, medicin: -1 }, mine: 'malm' },
    { id: 'betelgeuse', navn: 'Betelgeuse', fraktion: 'orion', x: 90, y: 8, br: 12, laast: 25, n: { malm: 2, vand: 1, luksus: -2, medicin: -2, mad: -1 }, mine: 'malm' },
    { id: 'kanthavn', navn: 'Kanthavn', fraktion: 'kant', x: 70, y: 45, br: 8, n: { vand: 1, metal: -1, luksus: -1, glimmer: -1, maskiner: -1 } },
    { id: 'nova', navn: 'Novaport', fraktion: 'kant', x: 90, y: 32, br: 9, n: { luksus: 1, mad: 1, metal: -2, maskiner: -1, medicin: -1 }, mine: 'mad' },
    { id: 'tau', navn: 'Tau', fraktion: 'kant', x: 89, y: 55, br: 7, n: { glimmer: 2, malm: 1, vand: -2, mad: -2, medicin: -1 }, mine: 'glimmer' },
    { id: 'proxima', navn: 'Proxima', fraktion: 'kant', x: 50, y: 56, br: 11, laast: 25, n: { medicin: 2, maskiner: 1, glimmer: -1, luksus: -2, malm: -1 }, fabrik: { ind: 'vand', ud: 'medicin' } }
  ];
  var KORT = { bredde: 100, hoejde: 64 };
  // [a, b, dage, risiko for pirater 0–2]
  var RUTER = [
    ['sirius', 'kepler', 2, 0], ['sirius', 'vega', 2, 0], ['kepler', 'vega', 2, 0], ['kepler', 'altair', 2, 0], ['vega', 'altair', 3, 0],
    ['vega', 'orion', 3, 0], ['vega', 'rigel', 2, 1], ['sirius', 'orion', 4, 1],
    ['orion', 'rigel', 2, 0], ['orion', 'bellatrix', 2, 0], ['rigel', 'bellatrix', 2, 0], ['bellatrix', 'betelgeuse', 2, 1],
    ['rigel', 'kanthavn', 2, 1], ['bellatrix', 'nova', 2, 1], ['kanthavn', 'nova', 2, 1], ['kanthavn', 'tau', 2, 2], ['nova', 'tau', 2, 2],
    ['nova', 'betelgeuse', 3, 2], ['kanthavn', 'proxima', 2, 1], ['rigel', 'proxima', 3, 1], ['altair', 'proxima', 3, 1]
  ];
  var SKIBSTYPER = [
    { id: 'spurv', navn: 'Spurv', last: 20, tank: 10, forbrug: 1, flugt: 0.65, pris: 5000 },
    { id: 'pelikan', navn: 'Pelikan', last: 45, tank: 14, forbrug: 2, flugt: 0.5, pris: 8000 },
    { id: 'hval', navn: 'Hval', last: 100, tank: 21, forbrug: 3, flugt: 0.35, pris: 19000 }
  ];
  var BYGNINGER = {
    mine: { navn: 'Mine', pris: 7000, pr_dag: 4, drift: 120 },
    fabrik: { navn: 'Fabrik', pris: 14000, pr_dag: 4, drift: 200 },
    lager: { navn: 'Lager', pris: 2500, plads: 200, drift: 40, max: 3 }
  };
  var BEGIVENHEDER = [
    { id: 'hunger', tekst: 'Hungersnød på {p}: mad +200 %', varer: ['mad'], f: 3 },
    { id: 'strejke', tekst: 'Minestrejke på {p}: malm og metal +120 %', varer: ['malm', 'metal'], f: 2.2 },
    { id: 'epidemi', tekst: 'Epidemi på {p}: medicin +150 %', varer: ['medicin'], f: 2.5 },
    { id: 'festival', tekst: 'Festival på {p}: luksus +100 %, mad +40 %', varer: ['luksus', 'mad'], f: [2, 1.4] },
    { id: 'hoest', tekst: 'Rekordhøst på {p}: mad −50 %', varer: ['mad'], f: 0.5 },
    { id: 'brand', tekst: 'Fabriksbrand på {p}: maskiner +130 %', varer: ['maskiner'], f: 2.3 },
    { id: 'toerke', tekst: 'Tørke på {p}: vand +150 %', varer: ['vand'], f: 2.5 },
    { id: 'overskud', tekst: 'Overskud af metal på {p}: metal −45 %', varer: ['metal'], f: 0.55 },
    { id: 'braendstof', tekst: 'Brændstofmangel på {p}: brændstof +100 %', varer: ['braendstof'], f: 2 },
    { id: 'razzia', tekst: 'Razzia på {p}: dobbelt så mange toldkontroller', varer: ['kontrol'], f: 2, kunFraktion: 'vega' },
    { id: 'piratjagt', tekst: 'Piratjagt omkring {p}: ingen pirater på ruterne derfra', varer: ['pirater'], f: 0 }
  ];

  var START = { kredit: 2500, gaeld: 6000, planet: 'kepler', omdoemme: 10 };
  var MAANED = 30;                 // en regning forfalder hver 30. dag
  var RENTE = 0.05;                // rente pr. måned af gælden
  var AFDRAG0 = 250, AFDRAG_VAEKST = 1.2;   // afdraget vokser 20 % om måneden
  var LICENS0 = 60, LICENS_EKS = 1.7;       // handelslicensen vokser: 60 × måned^1,7
  // Startperiode: de første START_MDR regninger (dag 30, 60 og 90) er afdragsfri, og renten er
  // kun START_RENTE_ANDEL af den normale. Afdraget starter derefter på AFDRAG0 og vokser derfra.
  var START_MDR = 3, START_RENTE_ANDEL = 0.5;
  var SKIB_DRIFT = 150;            // pr. skib ud over det første
  var FORSIKRING0 = 150, FORSIKRING_SKIB = 100;
  var LAAN_MAX = 40000, LAAN_TRIN = 2000;
  var KONKURS_ANDEL = 0.25;          // ved konkurs tæller kun 25 % af nettoformuen som point
  var MAX_SKIBE = 8;   // flagskibet + 7 skibe – så oversigten kan stå uden rulning
  var SALG = 0.9;                  // salgspris = 90 % af købsprisen
  var SORTBOERS = 1.4;             // forbudte varer sælges dyrt, hvor de er forbudt
  var BOEDE = 60;                  // bøde pr. konfiskeret enhed
  var PIRAT = [0, 0.18, 0.35];     // chance pr. hop efter rutens risiko
  var NIVEAU_LAGER = { '2': 175, '1': 133, '0': 100, '-1': 75, '-2': 55 };   // markedets lager i ro (lille lager = dit eget køb/salg flytter prisen mærkbart)
  var VAERDI = 0.6;                // skibe og bygninger tæller 60 % af prisen i nettoformuen
  var LAST_VAERDI = 0.7;           // last og lagre tæller 70 % af basisprisen
  var ADGANG = 25, TOLDFRI = 50;

  function byId(arr) { var m = {}; arr.forEach(function (x) { m[x.id] = x; }); return m; }
  var VARE = byId(VARER), PLANET = byId(PLANETER), FRAKTION = byId(FRAKTIONER), SKIBSTYPE = byId(SKIBSTYPER);
  var NABOER = {};
  PLANETER.forEach(function (p) { NABOER[p.id] = []; });
  RUTER.forEach(function (r) { NABOER[r[0]].push({ til: r[1], dage: r[2], risiko: r[3] }); NABOER[r[1]].push({ til: r[0], dage: r[2], risiko: r[3] }); });

  function rng(st) {     // mulberry32
    var t = (st.rng = (st.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sumLast(last) { var n = 0; for (var k in last) n += last[k] || 0; return n; }
  function kopi(o) { return JSON.parse(JSON.stringify(o)); }

  function nytSkib(st, type, planet) {
    var t = SKIBSTYPE[type];
    st.skibNr = (st.skibNr || 0) + 1;
    var antal = st.skibe.filter(function (s) { return s.type === type; }).length + 1;
    var s = { id: 's' + st.skibNr, type: type, navn: t.navn + ' ' + antal, pos: planet, rejse: null, last: {}, braendstof: t.tank, rute: null };
    st.skibe.push(s);
    return s;
  }

  function createGame(opts) {
    var st;
    if (opts && opts.planeter) st = kopi(opts);
    else {
      opts = opts || {};
      st = {
        version: 1, rng: (opts.seed === undefined ? Math.floor(Math.random() * 1e9) : opts.seed) | 0,
        dag: 1, kredit: START.kredit, gaeld: START.gaeld, forsikring: false,
        planeter: {}, events: [], nyheder: [], skibe: [], skibNr: 0, flagskib: null,
        bygninger: {}, omdoemme: {}, kontrakter: [], kontraktNr: 0, moede: null, rejse: null,
        over: false, grund: null, peak: 0, maaneder: 0, betalt: 0,
        stat: { handel: 0, kontrakter: 0, pirater: 0, konfiskeret: 0, ruteIndtaegt: 0, produktion: 0 }
      };
      FRAKTIONER.forEach(function (f) { st.omdoemme[f.id] = START.omdoemme; });
      PLANETER.forEach(function (p) {
        var lager = {}, sidst = {};
        VARER.forEach(function (v) { var m = maalLager(p, v.id); lager[v.id] = Math.round(m * (0.85 + rng(st) * 0.3)); });
        st.planeter[p.id] = { lager: lager, sidst: sidst, tilbud: [], tilbudDag: -99 };
      });
      VARER.forEach(function () {});
      var f = nytSkib(st, 'spurv', START.planet);
      st.flagskib = f.id;
      PLANETER.forEach(function (p) { VARER.forEach(function (v) { st.planeter[p.id].sidst[v.id] = rawPris(p.id, v.id); }); });
      fornyTilbud(START.planet);
      nyhed('Velkommen til Kepler. Lånet på ' + START.gaeld + ' cr skal afdrages hver 30. dag.', 'info');
    }

    // ---------- Grundlæggende ----------
    function maalLager(p, vare) { var n = p.n[vare] || 0; return NIVEAU_LAGER[String(n)]; }
    function flagskib() { for (var i = 0; i < st.skibe.length; i++) if (st.skibe[i].id === st.flagskib) return st.skibe[i]; return null; }
    function skib(id) { for (var i = 0; i < st.skibe.length; i++) if (st.skibe[i].id === id) return st.skibe[i]; return null; }
    function her() { return flagskib().pos; }
    function nyhed(tekst, slags) { st.nyheder.unshift({ dag: st.dag, tekst: tekst, slags: slags || 'info' }); if (st.nyheder.length > 30) st.nyheder.length = 30; }
    function eventFaktor(planet, hvad) {
      var f = 1;
      st.events.forEach(function (e) { if (e.planet === planet) { var i = e.varer.indexOf(hvad); if (i >= 0) f *= e.f[i]; } });
      return f;
    }
    function adgang(planet) { var p = PLANET[planet]; return !p.laast || st.omdoemme[p.fraktion] >= p.laast; }
    function rabat(planet) { return clamp(st.omdoemme[PLANET[planet].fraktion] / 1000, 0, 0.1); }

    // ---------- Marked ----------
    function rawPris(planet, vare) {
      var lager = Math.max(4, st.planeter[planet].lager[vare]);
      return VARE[vare].pris * Math.pow(100 / lager, 0.65) * eventFaktor(planet, vare);
    }
    function forbudt(vare, planet) { return VARE[vare].forbudt && VARE[vare].forbudt === PLANET[planet].fraktion; }
    function enhedKoeb(planet, vare) { return Math.max(1, Math.round(rawPris(planet, vare) * (1 - rabat(planet)))); }
    function enhedSalg(planet, vare) { return Math.max(1, Math.round(rawPris(planet, vare) * SALG * (forbudt(vare, planet) ? SORTBOERS : 1))); }
    function pris(vare, planet) {
      planet = planet || her();
      var p = PLANET[planet], raw = rawPris(planet, vare), base = VARE[vare].pris;
      var r = raw / base;
      var sidst = st.planeter[planet].sidst[vare] || raw;
      return {
        koeb: enhedKoeb(planet, vare), salg: enhedSalg(planet, vare),
        niveau: r < 0.82 ? 'billig' : r > 1.25 ? 'dyr' : 'normal',
        trend: raw > sidst * 1.03 ? 1 : raw < sidst * 0.97 ? -1 : 0,
        forbudt: !!forbudt(vare, planet), producent: (p.n[vare] || 0) > 0, forbruger: (p.n[vare] || 0) < 0
      };
    }
    // Pris for n enheder: hver enhed flytter lageret én enhed (dit eget køb/salg påvirker prisen)
    function prisFor(planet, vare, n, koeb) {
      var lager = st.planeter[planet].lager, gem = lager[vare], sum = 0;
      for (var i = 0; i < n; i++) {
        sum += koeb ? enhedKoeb(planet, vare) : enhedSalg(planet, vare);
        lager[vare] += koeb ? -1 : 1;
        if (lager[vare] < 4) lager[vare] = 4;
      }
      lager[vare] = gem;
      return sum;
    }
    function handel(planet, vare, n, koeb) {
      var lager = st.planeter[planet].lager, sum = 0;
      for (var i = 0; i < n; i++) {
        sum += koeb ? enhedKoeb(planet, vare) : enhedSalg(planet, vare);
        lager[vare] = Math.max(4, lager[vare] + (koeb ? -1 : 1));
      }
      return sum;
    }
    function ledigPlads(s) { return SKIBSTYPE[s.type].last - sumLast(s.last); }
    function maxKoeb(vare, s, planet, budget) {
      var plads = ledigPlads(s), n = 0, lager = st.planeter[planet].lager, gem = lager[vare], sum = 0;
      while (n < plads) {
        var p = enhedKoeb(planet, vare);
        if (sum + p > budget) break;
        sum += p; n++; lager[vare] = Math.max(4, lager[vare] - 1);
      }
      lager[vare] = gem;
      return n;
    }
    function koeb(vare, n) {
      var s = flagskib();
      if (st.over || st.moede || !VARE[vare]) return { ok: false, grund: 'kan-ikke' };
      var max = maxKoeb(vare, s, s.pos, st.kredit);
      if (n === 'max') n = max;
      if (ledigPlads(s) <= 0) return { ok: false, grund: 'fuld' };
      if (n <= 0 || n > max) return { ok: false, grund: max === 0 ? 'penge' : n > ledigPlads(s) ? 'fuld' : 'penge' };
      var sum = handel(s.pos, vare, n, true);
      st.kredit -= sum; s.last[vare] = (s.last[vare] || 0) + n;
      return { ok: true, antal: n, sum: sum };
    }
    function saelg(vare, n) {
      var s = flagskib(), har = s.last[vare] || 0;
      if (st.over || st.moede) return { ok: false, grund: 'kan-ikke' };
      if (n === 'alt') n = har;
      if (n <= 0 || n > har) return { ok: false, grund: 'ingen' };
      var sum = handel(s.pos, vare, n, false);
      st.kredit += sum; s.last[vare] = har - n; if (!s.last[vare]) delete s.last[vare];
      st.stat.handel += sum;
      return { ok: true, antal: n, sum: sum };
    }
    function braendstofPris(planet) { return Math.round(PLANET[planet].br * eventFaktor(planet, 'braendstof')); }

    // ---------- Stjernekort og rejser ----------
    function sti(fra, til, type) {
      if (fra === til) return { sti: [fra], hop: [], dage: 0, braendstof: 0, risiko: 0 };
      var dist = {}, fraP = {}, hopP = {}, aaben = [fra]; dist[fra] = 0;
      var besoegt = {};
      while (aaben.length) {
        aaben.sort(function (a, b) { return dist[a] - dist[b]; });
        var u = aaben.shift(); if (besoegt[u]) continue; besoegt[u] = true;
        if (u === til) break;
        NABOER[u].forEach(function (nb) {
          if (!adgang(nb.til)) return;
          var d = dist[u] + nb.dage + nb.risiko * 0.01;
          if (dist[nb.til] === undefined || d < dist[nb.til]) { dist[nb.til] = d; fraP[nb.til] = u; hopP[nb.til] = nb; aaben.push(nb.til); }
        });
      }
      if (dist[til] === undefined) return null;
      var vej = [til], hop = [];
      while (vej[0] !== fra) { hop.unshift({ fra: fraP[vej[0]], til: vej[0], dage: hopP[vej[0]].dage, risiko: hopP[vej[0]].risiko }); vej.unshift(fraP[vej[0]]); }
      var forbrug = SKIBSTYPE[type || 'spurv'].forbrug, dage = 0, risiko = 0;
      hop.forEach(function (h) { dage += h.dage; risiko = Math.max(risiko, h.risiko); });
      return { sti: vej, hop: hop, dage: dage, braendstof: dage * forbrug, risiko: risiko };
    }
    function lastVaerdi(last) { var v = 0; for (var k in last) v += (last[k] || 0) * VARE[k].pris; return v; }
    // Bedste vare at købe her og sælge på planet til (pr. enhed og for hele lastrummet)
    function bedsteVare(fra, til, plads, budget) {
      var bedst = null;
      VARER.forEach(function (v) {
        if (forbudt(v.id, til) || forbudt(v.id, fra)) return;
        var max = budget === undefined ? plads : Math.min(plads, maxKoebPlanet(v.id, fra, plads, budget));
        if (max <= 0) return;
        // Prøv flere mængder – store mængder flytter prisen, så "fuldt lastrum" er ikke altid bedst
        [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25)].forEach(function (n) {
          if (n <= 0) return;
          var k = prisFor(fra, v.id, n, true), s = prisFor(til, v.id, n, false), g = s - k;
          if (g > 0 && (!bedst || g > bedst.gevinst)) bedst = { vare: v.id, antal: n, gevinst: g, koeb: k };
        });
      });
      return bedst;
    }
    function maxKoebPlanet(vare, planet, plads, budget) {
      var n = 0, lager = st.planeter[planet].lager, gem = lager[vare], sum = 0;
      while (n < plads) { var p = enhedKoeb(planet, vare); if (sum + p > budget) break; sum += p; n++; lager[vare] = Math.max(4, lager[vare] - 1); }
      lager[vare] = gem; return n;
    }
    function rejseInfo(til) {
      var s = flagskib(), t = SKIBSTYPE[s.type];
      var info = { planet: til, adgang: adgang(til), her: til === s.pos };
      if (!info.adgang) { info.kanFlyve = false; info.grund = 'laast'; return info; }
      if (info.her) { info.kanFlyve = false; info.grund = 'her'; return info; }
      var v = sti(s.pos, til, s.type);
      if (!v) { info.kanFlyve = false; info.grund = 'ingen-vej'; return info; }
      info.sti = v.sti; info.dage = v.dage; info.braendstof = v.braendstof; info.risiko = v.risiko; info.hop = v.hop.length;
      var foerste = v.hop[0].dage * t.forbrug;
      var behov = Math.min(t.tank, v.braendstof) - s.braendstof;
      info.koebBraendstof = Math.max(0, behov);
      info.braendstofPris = info.koebBraendstof * braendstofPris(s.pos);
      info.kanFlyve = s.braendstof + info.koebBraendstof >= foerste && st.kredit >= info.braendstofPris;
      if (!info.kanFlyve) info.grund = 'braendstof';
      info.ankomst = st.dag + v.dage;
      info.forfaldUndervejs = info.ankomst >= naesteForfald();
      // Forventet fortjeneste: sælg lasten derude, eller køb den bedste vare her og sælg den der
      var salg = 0, kostLast = 0;
      for (var k in s.last) if (s.last[k]) { salg += prisFor(til, k, s.last[k], false); }
      info.lastSalg = salg;
      info.forslag = bedsteVare(s.pos, til, ledigPlads(s), Math.max(0, st.kredit - info.braendstofPris));
      info.told = toldFor(til, s.last);
      return info;
    }
    function toldFor(planet, last) {
      var f = PLANET[planet].fraktion, sats = FRAKTION[f].told;
      if (st.omdoemme[f] >= TOLDFRI) return 0;
      var v = 0; for (var k in last) if (!forbudt(k, planet)) v += (last[k] || 0) * VARE[k].pris;
      return Math.round(v * sats * (1 - st.omdoemme[f] / 100));
    }
    function flyv(til) {
      if (st.over || st.moede) return { ok: false, grund: 'kan-ikke' };
      var info = rejseInfo(til);
      if (!info.kanFlyve) return { ok: false, grund: info.grund };
      st.rejse = { maal: til, sti: info.sti.slice(1) };
      return fortsaet();
    }
    function fortsaet() {
      var s = flagskib(), t = SKIBSTYPE[s.type], beskeder = [], dage = 0;
      while (st.rejse && st.rejse.sti.length && !st.over) {
        var naeste = st.rejse.sti[0];
        var hop = null; NABOER[s.pos].forEach(function (nb) { if (nb.til === naeste) hop = nb; });
        var resten = 0, tmp = s.pos; st.rejse.sti.forEach(function (p) { NABOER[tmp].forEach(function (nb) { if (nb.til === p) resten += nb.dage; }); tmp = p; });
        var behov = hop.dage * t.forbrug;
        if (s.braendstof < behov) {
          var koebes = Math.min(t.tank, resten * t.forbrug) - s.braendstof, bp = braendstofPris(s.pos);
          koebes = Math.min(koebes, Math.floor(st.kredit / bp));
          if (s.braendstof + koebes < behov) { st.rejse = null; beskeder.push({ slags: 'fejl', tekst: 'Ikke penge nok til brændstof på ' + PLANET[s.pos].navn + '.' }); break; }
          st.kredit -= koebes * bp; s.braendstof += koebes;
        }
        // Pirater lurer ved afgang på farlige ruter
        if (!st.rejse.piratTjekket && hop.risiko > 0 && eventFaktor(s.pos, 'pirater') > 0 && eventFaktor(naeste, 'pirater') > 0 && rng(st) < PIRAT[hop.risiko]) {
          st.rejse.piratTjekket = true;
          st.moede = { slags: 'pirat', fra: s.pos, til: naeste, krav: piratKrav(s), flugt: t.flugt, lastVaerdi: lastVaerdi(s.last) };
          st.stat.pirater++;
          return { ok: true, moede: st.moede, dage: dage, beskeder: beskeder };
        }
        st.rejse.piratTjekket = false;
        s.braendstof -= behov;
        s.pos = null;
        for (var d = 0; d < hop.dage && !st.over; d++) { dag(); dage++; }
        s.pos = naeste;
        st.rejse.sti.shift();
        if (st.over) break;
        if (!st.rejse.sti.length) { st.rejse = null; ankomst(s, beskeder); }
      }
      return { ok: true, dage: dage, beskeder: beskeder, planet: s.pos, over: st.over };
    }
    function ankomst(s, beskeder) {
      var p = PLANET[s.pos], f = p.fraktion;
      // Toldkontrol af forbudte varer
      var forb = []; for (var k in s.last) if (s.last[k] && forbudt(k, s.pos)) forb.push(k);
      if (forb.length && rng(st) < FRAKTION[f].kontrol * eventFaktor(s.pos, 'kontrol')) {
        var n = 0; forb.forEach(function (k) { n += s.last[k]; delete s.last[k]; });
        var boede = Math.min(st.kredit, n * BOEDE);
        st.kredit -= boede; st.omdoemme[f] = clamp(st.omdoemme[f] - 15, 0, 100); st.stat.konfiskeret += n;
        beskeder.push({ slags: 'fejl', tekst: 'Toldkontrol! ' + n + ' glimmer konfiskeret, bøde ' + boede + ' cr, omdømmet faldt.' });
        nyhed('Toldkontrol på ' + p.navn + ': ' + n + ' glimmer konfiskeret.', 'fejl');
      }
      var told = Math.min(st.kredit, toldFor(s.pos, s.last));
      if (told > 0) { st.kredit -= told; beskeder.push({ slags: 'info', tekst: 'Told på ' + p.navn + ': ' + told + ' cr.' }); }
      if (st.dag - st.planeter[s.pos].tilbudDag >= 10) fornyTilbud(s.pos);
      beskeder.unshift({ slags: 'ok', tekst: 'Fremme ved ' + p.navn + ' på dag ' + st.dag + '.' });
    }
    function piratKrav(s) { return Math.max(100, Math.round(lastVaerdi(s.last) * 0.2)); }
    function pirat(valg) {
      var m = st.moede; if (!m || m.slags !== 'pirat') return { ok: false };
      var s = flagskib(), res = { ok: true, valg: valg };
      if (valg === 'betal') {
        if (st.kredit < m.krav) return { ok: false, grund: 'penge' };
        st.kredit -= m.krav; res.tekst = 'Du betalte ' + m.krav + ' cr, og piraterne lod dig flyve videre.';
      } else if (valg === 'flygt') {
        if (rng(st) < m.flugt) { res.tekst = 'Du slap væk fra piraterne!'; res.slap = true; }
        else {
          var tab = 0; for (var k in s.last) { var x = Math.ceil(s.last[k] / 2); tab += x; s.last[k] -= x; if (!s.last[k]) delete s.last[k]; }
          if (!tab) { var t = Math.min(st.kredit, Math.max(100, Math.round(st.kredit * 0.1))); st.kredit -= t; res.tekst = 'Piraterne indhentede dig og tog ' + t + ' cr.'; }
          else res.tekst = 'Piraterne indhentede dig og tog halvdelen af lasten (' + tab + ' enheder).';
          res.slap = false;
        }
      } else if (valg === 'forsikring') {
        if (!st.forsikring) return { ok: false, grund: 'ingen-forsikring' };
        var v = Math.round(lastVaerdi(s.last) * 0.8); s.last = {}; st.kredit += v;
        res.tekst = 'Piraterne tog hele lasten. Forsikringen udbetalte ' + v + ' cr.';
      } else return { ok: false };
      st.moede = null;
      nyhed(res.tekst, 'info');
      var f = fortsaet(); res.rejse = f;
      return res;
    }

    // ---------- En dag går ----------
    function dag() {
      st.dag++;
      // Markederne
      PLANETER.forEach(function (p) {
        var pl = st.planeter[p.id];
        VARER.forEach(function (v) {
          pl.sidst[v.id] = rawPris(p.id, v.id);
          var m = maalLager(p, v.id);
          pl.lager[v.id] = Math.max(4, pl.lager[v.id] + (m - pl.lager[v.id]) * 0.12 + (rng(st) - 0.5) * m * 0.08);
        });
      });
      // Begivenheder
      st.events = st.events.filter(function (e) { if (e.slut <= st.dag) { nyhed('Slut: ' + e.tekst.split(':')[0] + '.', 'info'); return false; } return true; });
      if (st.events.length < 4 && rng(st) < 0.14) nyBegivenhed();
      // Bygninger producerer
      for (var pid in st.bygninger) produktion(pid, st.bygninger[pid]);
      // Skibe på ruter
      st.skibe.forEach(function (s) { if (s.rute) ruteDag(s); });
      // Kontrakter, der udløber
      st.kontrakter = st.kontrakter.filter(function (k) {
        if (st.dag > k.frist) {
          st.omdoemme[k.fraktion] = clamp(st.omdoemme[k.fraktion] - 8, 0, 100);
          nyhed('Kontrakten om ' + k.antal + ' ' + VARE[k.vare].navn.toLowerCase() + ' til ' + PLANET[k.til].navn + ' udløb. ' + FRAKTION[k.fraktion].navn + ' er skuffet.', 'fejl');
          return false;
        }
        return true;
      });
      // Advarsel og forfald
      var nf = naesteForfald();
      if (nf - st.dag === 5) { var r = regning(); if (st.kredit < r.total) nyhed('Om 5 dage forfalder ' + r.total + ' cr – du har kun ' + Math.round(st.kredit) + ' cr.', 'fejl'); }
      if (st.dag % MAANED === 0) forfald();
      st.peak = Math.max(st.peak, nettoformue());
    }
    function nyBegivenhed() {
      var b = BEGIVENHEDER[Math.floor(rng(st) * BEGIVENHEDER.length)];
      var kand = PLANETER.filter(function (p) { return (!b.kunFraktion || p.fraktion === b.kunFraktion) && !st.events.some(function (e) { return e.planet === p.id && e.id === b.id; }); });
      if (!kand.length) return;
      var p = kand[Math.floor(rng(st) * kand.length)];
      var f = Array.isArray(b.f) ? b.f : b.varer.map(function () { return b.f; });
      var e = { id: b.id, planet: p.id, varer: b.varer.slice(), f: f, slut: st.dag + 8 + Math.floor(rng(st) * 8), tekst: b.tekst.replace('{p}', p.navn) };
      st.events.push(e);
      nyhed(e.tekst, 'nyhed');
    }
    function lagerPlads(b) { return 30 + (b.lager || 0) * BYGNINGER.lager.plads; }
    function produktion(pid, b) {
      var p = PLANET[pid];
      b.varer = b.varer || {};
      function laeg(vare, n) {
        var plads = lagerPlads(b) - sumLast(b.varer), ind = Math.min(n, Math.max(0, plads));
        if (ind > 0) b.varer[vare] = (b.varer[vare] || 0) + ind;
        var over = n - ind;
        if (over > 0) { var sum = handel(pid, vare, over, false) * 0.8; st.kredit += sum; st.stat.produktion += sum; }
      }
      if (b.mine && p.mine) laeg(p.mine, BYGNINGER.mine.pr_dag);
      if (b.fabrik && p.fabrik) {
        var n = BYGNINGER.fabrik.pr_dag, fra = Math.min(n, b.varer[p.fabrik.ind] || 0);
        if (fra) { b.varer[p.fabrik.ind] -= fra; if (!b.varer[p.fabrik.ind]) delete b.varer[p.fabrik.ind]; }
        var koebes = n - fra, pr = prisFor(pid, p.fabrik.ind, koebes, true);
        if (koebes > 0 && st.kredit - pr >= regning().total * 0.5) { st.kredit -= handel(pid, p.fabrik.ind, koebes, true); } else koebes = 0;
        if (fra + koebes > 0) laeg(p.fabrik.ud, fra + koebes);
      }
    }

    // ---------- Skibe og ruter ----------
    function koebSkib(type) {
      var t = SKIBSTYPE[type]; if (!t || st.over || st.moede) return { ok: false };
      if (st.skibe.length >= MAX_SKIBE) return { ok: false, grund: 'max' };
      if (st.kredit < t.pris) return { ok: false, grund: 'penge' };
      st.kredit -= t.pris;
      var s = nytSkib(st, type, her());
      nyhed('Du købte ' + s.navn + ' på ' + PLANET[her()].navn + '.', 'ok');
      return { ok: true, skib: s };
    }
    function saetRute(id, a, b) {
      var s = skib(id);
      if (!s || s.id === st.flagskib || a === b || !adgang(a) || !adgang(b)) return { ok: false };
      if (!sti(a, b, s.type)) return { ok: false };
      s.rute = { a: a, b: b, maal: a, tur: 0, indtaegt: 0 };
      if (s.pos && s.pos !== a) { s.rejse = nyRejse(s, s.pos, a); }
      else if (s.pos === a) { rutePlanet(s); }
      return { ok: true };
    }
    function stopRute(id) {
      var s = skib(id); if (!s || !s.rute) return { ok: false };
      s.rute = null;   // skibet flyver færdigt til næste planet og venter der
      return { ok: true };
    }
    function nyRejse(s, fra, til) {
      var v = sti(fra, til, s.type); if (!v) return null;
      return { til: til, dage: v.dage, ialt: v.dage, hop: v.hop };
    }
    function ruteDag(s) {
      if (s.rejse) {
        s.rejse.dage--;
        if (s.rejse.dage > 0) return;
        s.pos = s.rejse.til; s.rejse = null;
        rutePlanet(s);
      }
    }
    function rutePlanet(s) {
      var r = s.rute; if (!r) return;
      var here = s.pos, t = SKIBSTYPE[s.type];
      // Sælg lasten
      var ind = 0;
      for (var k in s.last) if (s.last[k]) { ind += handel(here, k, s.last[k], false); }
      s.last = {};
      if (ind) { st.kredit += ind; r.indtaegt += ind; st.stat.ruteIndtaegt += ind; }
      var til = here === r.a ? r.b : r.a;
      if (here !== r.a && here !== r.b) til = r.a;
      var v = sti(here, til, s.type); if (!v) { s.rute = null; return; }
      // Told ved ankomst betales med det samme (forenklet)
      // Tank op
      var behov = Math.min(t.tank, v.braendstof) - s.braendstof, bp = braendstofPris(here);
      if (behov > 0) { var kan = Math.min(behov, Math.floor(Math.max(0, st.kredit) / bp)); st.kredit -= kan * bp; s.braendstof += kan; r.indtaegt -= kan * bp; }
      if (s.braendstof < v.hop[0].dage * t.forbrug) return;   // venter på brændstof (prøver igen næste dag)
      // Hent egne varer fra lageret her
      var b = st.bygninger[here];
      if (b && b.varer) {
        VARER.forEach(function (vv) {
          var n = Math.min(b.varer[vv.id] || 0, ledigPlads(s));
          if (n > 0 && !forbudt(vv.id, til) && prisFor(til, vv.id, 1, false) > 0) { s.last[vv.id] = (s.last[vv.id] || 0) + n; b.varer[vv.id] -= n; if (!b.varer[vv.id]) delete b.varer[vv.id]; }
        });
      }
      // Køb den bedste vare (behold en reserve til næste regning)
      var reserve = regning().total * 1.5;
      var budget = Math.max(0, st.kredit - reserve);
      // Fyld lastrummet i bidder på 5 med den vare, der giver mest lige nu (flere varer, når prisen flytter sig)
      for (var i = 0; i < 40 && ledigPlads(s) > 0; i++) {
        var bv = bedsteVare(here, til, Math.min(5, ledigPlads(s)), budget);
        if (!bv || bv.gevinst <= bv.koeb * 0.15) break;
        var sum = handel(here, bv.vare, bv.antal, true);
        st.kredit -= sum; budget -= sum; r.indtaegt -= sum; s.last[bv.vare] = (s.last[bv.vare] || 0) + bv.antal;
      }
      // Pirater og told undervejs
      var risiko = 0; v.hop.forEach(function (h) { if (h.risiko && eventFaktor(h.fra, 'pirater') > 0 && rng(st) < PIRAT[h.risiko]) risiko++; });
      if (risiko) {
        if (st.forsikring) nyhed(s.navn + ' blev stoppet af pirater. Forsikringen dækkede tabet.', 'info');
        else {
          var krav = piratKrav(s);
          if (st.kredit >= krav + reserve * 0.5) { st.kredit -= krav; r.indtaegt -= krav; nyhed(s.navn + ' betalte ' + krav + ' cr til pirater.', 'fejl'); }
          else { s.last = {}; nyhed('Pirater tog hele lasten fra ' + s.navn + '.', 'fejl'); }
        }
      }
      var told = toldFor(til, s.last); if (told) { told = Math.min(told, Math.max(0, st.kredit)); st.kredit -= told; r.indtaegt -= told; }
      s.braendstof -= v.braendstof <= s.braendstof ? v.braendstof : s.braendstof;
      s.rejse = { til: til, dage: v.dage, ialt: v.dage, hop: v.hop };
      r.maal = til; r.tur++;
      s.pos = null;
    }
    // Forventet overskud for én tur frem og tilbage med en skibstype (ved priserne lige nu)
    function ruteEstimat(a, b, type) {
      var t = SKIBSTYPE[type || 'pelikan'], v = sti(a, b, type);
      if (!v || a === b) return null;
      var ud = bedsteVare(a, b, t.last), hjem = bedsteVare(b, a, t.last);
      var br = 2 * v.braendstof * (braendstofPris(a) + braendstofPris(b)) / 2;
      var g = (ud ? ud.gevinst : 0) + (hjem ? hjem.gevinst : 0) - br;
      return { dage: 2 * v.dage, gevinst: Math.round(g), pr_maaned: Math.round(g * MAANED / (2 * v.dage)), ud: ud && ud.vare, hjem: hjem && hjem.vare, risiko: v.risiko };
    }
    function goerFlagskib(id) {
      var s = skib(id), f = flagskib();
      if (!s || s === f || s.pos !== f.pos || s.rejse || s.rute || st.moede) return { ok: false };
      for (var k in f.last) {
        var n = Math.min(f.last[k], ledigPlads(s));
        if (n > 0) { s.last[k] = (s.last[k] || 0) + n; f.last[k] -= n; if (!f.last[k]) delete f.last[k]; }
      }
      st.flagskib = s.id;
      return { ok: true };
    }

    // ---------- Bygninger ----------
    function bygPris(type) { return BYGNINGER[type].pris; }
    function kanBygge(type, planet) {
      planet = planet || her();
      var p = PLANET[planet], b = st.bygninger[planet] || {};
      if (type === 'mine') return !!p.mine && !b.mine;
      if (type === 'fabrik') return !!p.fabrik && !b.fabrik;
      if (type === 'lager') return (b.lager || 0) < BYGNINGER.lager.max;
      return false;
    }
    function byg(type) {
      var planet = her();
      if (st.over || st.moede || !kanBygge(type, planet)) return { ok: false, grund: 'kan-ikke' };
      if (st.kredit < bygPris(type)) return { ok: false, grund: 'penge' };
      st.kredit -= bygPris(type);
      var b = st.bygninger[planet] = st.bygninger[planet] || { mine: false, fabrik: false, lager: 0, varer: {} };
      if (type === 'lager') b.lager++; else b[type] = true;
      nyhed('Du byggede ' + BYGNINGER[type].navn.toLowerCase() + ' på ' + PLANET[planet].navn + '.', 'ok');
      return { ok: true };
    }
    function hentLager() {
      var s = flagskib(), b = st.bygninger[s.pos];
      if (!b || !b.varer) return { ok: false };
      var n = 0;
      VARER.forEach(function (v) {
        var x = Math.min(b.varer[v.id] || 0, ledigPlads(s));
        if (x > 0) { s.last[v.id] = (s.last[v.id] || 0) + x; b.varer[v.id] -= x; if (!b.varer[v.id]) delete b.varer[v.id]; n += x; }
      });
      return { ok: n > 0, antal: n, grund: n ? null : (ledigPlads(s) ? 'tomt' : 'fuld') };
    }
    function antalBygninger() { var n = 0; for (var k in st.bygninger) { var b = st.bygninger[k]; n += (b.mine ? 1 : 0) + (b.fabrik ? 1 : 0) + (b.lager || 0); } return n; }

    // ---------- Kontrakter og omdømme ----------
    function fornyTilbud(planet) {
      var p = PLANET[planet], pl = st.planeter[planet];
      pl.tilbudDag = st.dag; pl.tilbud = [];
      var maal = PLANETER.filter(function (q) { return q.fraktion === p.fraktion && q.id !== planet && adgang(q.id); });
      if (!maal.length) return;
      for (var i = 0; i < 3; i++) {
        var q = maal[Math.floor(rng(st) * maal.length)];
        var varer = VARER.filter(function (v) { return (q.n[v.id] || 0) < 0 && !v.forbudt; });
        var v = varer[Math.floor(rng(st) * varer.length)];
        var maaned = Math.floor(st.dag / MAANED);
        var antal = Math.min(80, 10 + 5 * Math.floor(rng(st) * 5) + 3 * maaned);
        if (v.pris >= 140) antal = Math.max(4, Math.round(antal / 2));
        var vej = sti(planet, q.id, 'spurv');
        st.kontraktNr++;
        pl.tilbud.push({
          id: 'k' + st.kontraktNr, fraktion: p.fraktion, fra: planet, til: q.id, vare: v.id, antal: antal,
          frist: st.dag + (vej ? vej.dage : 6) + 10 + Math.floor(rng(st) * 12),
          betaling: Math.round(antal * v.pris * (1.7 + rng(st) * 0.5)), rep: 6 + Math.floor(antal / 8)
        });
      }
    }
    function tilbud() {
      var pl = st.planeter[her()]; if (!pl) return [];
      // Tilbud, hvis frist er overskredet, forsvinder
      if (pl.tilbud.some(function (k) { return k.frist <= st.dag; })) pl.tilbud = pl.tilbud.filter(function (k) { return k.frist > st.dag; });
      return pl.tilbud;
    }
    function tagKontrakt(id) {
      var pl = st.planeter[her()], i = -1;
      pl.tilbud.forEach(function (k, j) { if (k.id === id) i = j; });
      if (i < 0 || st.kontrakter.length >= 3) return { ok: false, grund: i < 0 ? 'ukendt' : 'fuld' };
      var k = pl.tilbud.splice(i, 1)[0]; st.kontrakter.push(k);
      return { ok: true, kontrakt: k };
    }
    function kanLevere(id) {
      var k = st.kontrakter.filter(function (x) { return x.id === id; })[0], s = flagskib();
      return !!k && s.pos === k.til && (s.last[k.vare] || 0) >= k.antal;
    }
    function lever(id) {
      if (!kanLevere(id)) return { ok: false };
      var k = st.kontrakter.filter(function (x) { return x.id === id; })[0], s = flagskib();
      s.last[k.vare] -= k.antal; if (!s.last[k.vare]) delete s.last[k.vare];
      st.kredit += k.betaling; st.omdoemme[k.fraktion] = clamp(st.omdoemme[k.fraktion] + k.rep, 0, 100);
      st.kontrakter = st.kontrakter.filter(function (x) { return x.id !== id; });
      st.stat.kontrakter++;
      var aabnet = PLANETER.filter(function (p) { return p.laast && p.fraktion === k.fraktion && st.omdoemme[k.fraktion] >= p.laast && st.omdoemme[k.fraktion] - k.rep < p.laast; });
      aabnet.forEach(function (p) { nyhed(FRAKTION[k.fraktion].navn + ' giver dig adgang til ' + p.navn + '.', 'ok'); });
      nyhed('Kontrakt leveret på ' + PLANET[k.til].navn + ': +' + k.betaling + ' cr og +' + k.rep + ' omdømme.', 'ok');
      return { ok: true, betaling: k.betaling, rep: k.rep, aabnet: aabnet.map(function (p) { return p.id; }) };
    }

    // ---------- Gæld og månedens regning ----------
    function naesteForfald() { return Math.ceil((st.dag + (st.dag % MAANED === 0 ? 1 : 0)) / MAANED) * MAANED; }
    function regning() {
      var m = st.maaneder + 1;
      var start = m <= START_MDR;
      var renter = Math.round(st.gaeld * RENTE * (start ? START_RENTE_ANDEL : 1));
      var afdrag = start ? 0 : Math.min(st.gaeld, Math.round(AFDRAG0 * Math.pow(AFDRAG_VAEKST, m - 1 - START_MDR)));
      var licens = Math.round(LICENS0 * Math.pow(m, LICENS_EKS));
      var drift = Math.max(0, st.skibe.length - 1) * SKIB_DRIFT;
      for (var k in st.bygninger) { var b = st.bygninger[k]; drift += (b.mine ? BYGNINGER.mine.drift : 0) + (b.fabrik ? BYGNINGER.fabrik.drift : 0) + (b.lager || 0) * BYGNINGER.lager.drift; }
      var forsikring = st.forsikring ? FORSIKRING0 + FORSIKRING_SKIB * Math.max(0, st.skibe.length - 1) : 0;
      return { maaned: m, start: start, rentesats: RENTE * (start ? START_RENTE_ANDEL : 1), renter: renter, afdrag: afdrag, licens: licens, drift: drift, forsikring: forsikring, total: renter + afdrag + licens + drift + forsikring };
    }
    function forfald() {
      var r = regning();
      if (st.kredit < r.total) {
        st.over = true; st.grund = 'konkurs'; st.manglede = Math.round(r.total - st.kredit); st.slutFormue = nettoformue();
        nyhed('Konkurs! Regningen på ' + r.total + ' cr kunne ikke betales.', 'fejl');
        return;
      }
      st.kredit -= r.total; st.gaeld -= r.afdrag; st.maaneder++; st.betalt += r.total;
      nyhed('Månedens regning på ' + r.total + ' cr er betalt.' + (st.gaeld <= 0 && r.afdrag ? ' Lånet er betalt ud!' : ''), 'ok');
    }
    function betalAf(n) {
      if (n === 'alt') n = Math.min(st.gaeld, Math.floor(st.kredit));
      n = Math.min(n, st.gaeld);
      if (n <= 0 || st.kredit < n) return { ok: false };
      st.kredit -= n; st.gaeld -= n; return { ok: true, beloeb: n };
    }
    function laan(n) {
      n = n || LAAN_TRIN;
      if (st.gaeld + n > LAAN_MAX || st.over) return { ok: false };
      st.gaeld += n; st.kredit += n; return { ok: true, beloeb: n };
    }
    function saetForsikring(v) { st.forsikring = !!v; return { ok: true }; }

    // ---------- Formue og point ----------
    function nettoformue() {
      var v = st.kredit - st.gaeld;
      st.skibe.forEach(function (s) { v += SKIBSTYPE[s.type].pris * VAERDI + lastVaerdi(s.last) * LAST_VAERDI; });
      for (var k in st.bygninger) {
        var b = st.bygninger[k];
        v += ((b.mine ? BYGNINGER.mine.pris : 0) + (b.fabrik ? BYGNINGER.fabrik.pris : 0) + (b.lager || 0) * BYGNINGER.lager.pris) * VAERDI;
        v += lastVaerdi(b.varer || {}) * LAST_VAERDI;
      }
      return Math.round(v);
    }
    // Point = nettoformuen, når spillet slutter. Ved pension tæller hele formuen,
    // ved konkurs kun KONKURS_ANDEL af den (kreditorerne tager resten), og aldrig under 0.
    // Mens spillet kører, viser point(), hvad du får, hvis du går på pension nu.
    function slutFormue() { return st.over && st.slutFormue != null ? st.slutFormue : nettoformue(); }
    function point() {
      var f = slutFormue();
      if (st.over && st.grund === 'konkurs') f = f * KONKURS_ANDEL;
      return Math.max(0, Math.round(f));
    }
    function pension() { if (st.over || st.moede) return { ok: false }; st.peak = Math.max(st.peak, nettoformue()); st.over = true; st.grund = 'pension'; st.slutFormue = nettoformue(); return { ok: true }; }
    function vent() { if (st.over || st.moede) return { ok: false }; dag(); return { ok: true, dag: st.dag }; }

    return {
      state: st,
      flagskib: flagskib, skib: skib, her: her, adgang: adgang, rabat: rabat,
      pris: pris, prisFor: prisFor, koeb: koeb, saelg: saelg, maxKoeb: function (vare) { var s = flagskib(); return maxKoeb(vare, s, s.pos, st.kredit); },
      ledigPlads: ledigPlads, braendstofPris: braendstofPris, lastVaerdi: lastVaerdi, forbudt: forbudt,
      sti: sti, rejseInfo: rejseInfo, flyv: flyv, fortsaet: fortsaet, pirat: pirat, vent: vent, toldFor: toldFor,
      koebSkib: koebSkib, saetRute: saetRute, stopRute: stopRute, ruteEstimat: ruteEstimat, goerFlagskib: goerFlagskib,
      byg: byg, kanBygge: kanBygge, bygPris: bygPris, hentLager: hentLager, lagerPlads: lagerPlads, antalBygninger: antalBygninger,
      tilbud: tilbud, tagKontrakt: tagKontrakt, kanLevere: kanLevere, lever: lever, fornyTilbud: fornyTilbud,
      regning: regning, naesteForfald: naesteForfald, betalAf: betalAf, laan: laan, saetForsikring: saetForsikring,
      nettoformue: nettoformue, point: point, pension: pension, bedsteVare: bedsteVare,
      save: function () { return kopi(st); },
      _dag: dag, _nyBegivenhed: nyBegivenhed, _forfald: forfald
    };
  }

  global.RumhandlerenLogik = {
    createGame: createGame, VARER: VARER, VARE: VARE, PLANETER: PLANETER, PLANET: PLANET, FRAKTIONER: FRAKTIONER, FRAKTION: FRAKTION,
    RUTER: RUTER, NABOER: NABOER, SKIBSTYPER: SKIBSTYPER, SKIBSTYPE: SKIBSTYPE, BYGNINGER: BYGNINGER, BEGIVENHEDER: BEGIVENHEDER,
    KORT: KORT, START: START, KONKURS_ANDEL: KONKURS_ANDEL, START_MDR: START_MDR, START_RENTE_ANDEL: START_RENTE_ANDEL, MAANED: MAANED, RENTE: RENTE, LAAN_MAX: LAAN_MAX, LAAN_TRIN: LAAN_TRIN, MAX_SKIBE: MAX_SKIBE, PIRAT: PIRAT,
    ADGANG: ADGANG, TOLDFRI: TOLDFRI, BOEDE: BOEDE, SALG: SALG
  };
})(typeof window !== 'undefined' ? window : globalThis);
