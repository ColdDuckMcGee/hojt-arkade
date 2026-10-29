// Rumhandleren – simulering af strategier for at afprøve balancen.
//   node rumhandleren/test/simulering.js [antal spil] [max dage]
// Strategier:
//   passiv    gør ingenting og venter (skal gå konkurs hurtigt)
//   tilfaeldig flyver til en tilfældig nabo, køber en tilfældig vare og sælger alt ved ankomst
//   handel    grådig handel med ét skib: vælger den bedste vare og planet (fortjeneste pr. dag)
//   imperium  handel + køber skibe på faste ruter, bygger miner/fabrikker/lagre og forsikring
'use strict';
require('../js/logik.js');
var L = globalThis.RumhandlerenLogik;
var N = +process.argv[2] || 200, MAXDAGE = +process.argv[3] || 1500;

function saelgAlt(g) { var s = g.flagskib(); Object.keys(s.last).forEach(function (k) { g.saelg(k, 'alt'); }); }
function pirat(g) {
  var m = g.state.moede; if (!m) return;
  if (g.state.forsikring && g.lastVaerdi(g.flagskib().last) > m.krav * 1.5) g.pirat('forsikring');
  else if (g.state.kredit >= m.krav && m.krav < 0.6 * g.lastVaerdi(g.flagskib().last) + 150) g.pirat('betal');
  else g.pirat('flygt');
}
function flyv(g, til) { var r = g.flyv(til); while (g.state.moede && !g.state.over) pirat(g); return r; }
function leverKontrakter(g) { g.state.kontrakter.slice().forEach(function (k) { if (g.kanLevere(k.id)) g.lever(k.id); }); }

function grådigTur(g, reserve) {
  var s = g.flagskib(); saelgAlt(g); leverKontrakter(g);
  // Kontrakter: tag en, hvis varen kan købes her billigt, og den betaler godt
  g.tilbud().slice().forEach(function (k) {
    if (g.state.kontrakter.length < 2 && g.pris(k.vare).koeb * k.antal < k.betaling * 0.6 && k.antal <= g.ledigPlads(s) && g.state.kredit - g.pris(k.vare).koeb * k.antal > reserve) {
      if (g.tagKontrakt(k.id).ok) g.koeb(k.vare, k.antal);
    }
  });
  var aktiv = g.state.kontrakter.filter(function (k) { return (s.last[k.vare] || 0) >= k.antal; })[0];
  if (aktiv) { flyv(g, aktiv.til); return; }
  var bedst = null;
  L.PLANETER.forEach(function (p) {
    var info = g.rejseInfo(p.id); if (!info.kanFlyve) return;
    var budget = Math.max(0, g.state.kredit - reserve - info.braendstofPris);
    var f = g.bedsteVare(s.pos, p.id, g.ledigPlads(s), budget);
    var v = ((f ? f.gevinst : 0) - info.braendstofPris - info.risiko * 60) / info.dage;
    if (!bedst || v > bedst.v) bedst = { v: v, p: p.id, f: f };
  });
  if (bedst && bedst.v > 0) {
    if (bedst.f) {
      g.koeb(bedst.f.vare, bedst.f.antal);
      // Fyld resten med andre varer, så længe det kan betale sig
      for (var i = 0; i < 10 && g.ledigPlads(s) > 0; i++) {
        var f2 = g.bedsteVare(s.pos, bedst.p, g.ledigPlads(s), Math.max(0, g.state.kredit - reserve - 100));
        if (!f2 || f2.gevinst < 20) break; g.koeb(f2.vare, f2.antal);
      }
    }
    flyv(g, bedst.p);
  } else {
    var naboer = L.NABOER[s.pos].filter(function (n) { return g.adgang(n.til); });
    if (naboer.length && g.rejseInfo(naboer[0].til).kanFlyve) flyv(g, naboer[Math.floor(g.state.dag % naboer.length)].til); else g.vent();
  }
}

var STRATEGIER = {
  passiv: function (g) { g.vent(); },
  tilfaeldig: function (g) {
    var s = g.flagskib(); saelgAlt(g);
    var v = L.VARER[Math.floor(Math.random() * 7)].id; g.koeb(v, 'max');
    var nb = L.NABOER[s.pos].filter(function (n) { return g.adgang(n.til); });
    var til = nb[Math.floor(Math.random() * nb.length)].til;
    var r = flyv(g, til); if (!r.ok) g.vent();
  },
  handel: function (g) {
    grådigTur(g, g.regning().total * 1.1);
    if (g.state.kredit > g.regning().total * 3 && g.state.gaeld > 0) g.betalAf(Math.min(g.state.gaeld, Math.floor(g.state.kredit - g.regning().total * 2)));
  },
  imperium: function (g) {
    var st = g.state, s = g.flagskib(), r = g.regning().total;
    var reserve = r * 1.2;
    // Investér, når der er penge nok
    var fri = st.kredit - reserve * 1.5;
    if (st.skibe.length >= 2 && !st.forsikring) g.saetForsikring(true);
    if (fri > L.SKIBSTYPE.pelikan.pris && st.skibe.length < 7) {
      // Bedste rute (efter estimeret overskud pr. måned) blandt ruter, der ikke allerede bruges
      var brugt = {}; st.skibe.forEach(function (x) { if (x.rute) brugt[x.rute.a + x.rute.b] = brugt[x.rute.b + x.rute.a] = 1; });
      var bedst = null;
      L.PLANETER.forEach(function (a) { L.PLANETER.forEach(function (b) {
        if (a.id >= b.id || brugt[a.id + b.id] || !g.adgang(a.id) || !g.adgang(b.id)) return;
        var e = g.ruteEstimat(a.id, b.id, 'pelikan'); if (e && (!bedst || e.pr_maaned > bedst.e.pr_maaned)) bedst = { a: a.id, b: b.id, e: e };
      }); });
      if (bedst && bedst.e.pr_maaned > 1200) { var k = g.koebSkib(fri > L.SKIBSTYPE.hval.pris * 1.3 && st.skibe.length >= 3 ? 'hval' : 'pelikan'); if (k.ok) g.saetRute(k.skib.id, bedst.a, bedst.b); }
    }
    fri = st.kredit - reserve * 1.5;
    var p = L.PLANET[s.pos];
    if (fri > L.BYGNINGER.fabrik.pris && g.kanBygge('fabrik') && st.skibe.length >= 3) g.byg('fabrik');
    else if (fri > L.BYGNINGER.mine.pris && g.kanBygge('mine') && st.skibe.length >= 3 && p.mine !== 'glimmer') g.byg('mine');
    else if (fri > L.BYGNINGER.lager.pris && st.bygninger[s.pos] && (st.bygninger[s.pos].lager || 0) < 1) g.byg('lager');
    g.hentLager();
    grådigTur(g, r * 1.1);
    if (st.kredit > r * 4 && st.gaeld > 0) g.betalAf(Math.min(st.gaeld, Math.floor(st.kredit - r * 3)));
  }
};

function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; }
function pct(a, f) { return Math.round(100 * a.filter(f).length / a.length); }
if (process.env.DBG) { module.exports = STRATEGIER; return; }
var resultater = {};
Object.keys(STRATEGIER).forEach(function (navn) {
  var dage = [], point = [], ture = 0;
  for (var i = 0; i < N; i++) {
    var g = L.createGame({ seed: 1000 + i });
    var guard = 0;
    while (!g.state.over && g.state.dag < MAXDAGE && guard++ < 20000) STRATEGIER[navn](g);
    dage.push(g.state.over ? g.state.dag : MAXDAGE + 1); point.push(g.point());
  }
  resultater[navn] = {
    'median dage': median(dage), 'konkurs dag 30': pct(dage, function (d) { return d <= 30; }) + ' %',
    'konkurs ≤ 180': pct(dage, function (d) { return d <= 180; }) + ' %', 'konkurs ≤ 365': pct(dage, function (d) { return d <= 365; }) + ' %',
    'konkurs ≤ 730': pct(dage, function (d) { return d <= 730; }) + ' %', 'overlevede alle': pct(dage, function (d) { return d > MAXDAGE; }) + ' %',
    'median point': median(point), 'bedste point': Math.max.apply(null, point)
  };
});
console.log('Rumhandleren – ' + N + ' spil pr. strategi, højst ' + MAXDAGE + ' dage');
console.table(resultater);
