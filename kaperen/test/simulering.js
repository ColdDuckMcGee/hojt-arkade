// Simulering af tre spillestile på det nye, ukendte hav: handel, kaper (handler og kaprer handelsskibe, når han er stærkest) og pirat.
// Bruges til at vælge berømmelsesfaktoren i pointformlen (point = formue + F × berømmelse).
//   node kaperen/test/simulering.js            (200 spil pr. stil, 150 dage)
'use strict';
require('../js/logik.js');
var L = globalThis.KaperenLogik;
var R = L.RETNINGER;

// Korteste vej over kendt hav til et felt, der opfylder maal(x, y). Returnerer første skridt.
function vej(g, maal, maxN) {
  var st = g.state, s = st.pos, W = L.BREDDE, fra = {}, ko = [[s[0], s[1]]], k0 = s[1] * W + s[0], n = 0;
  fra[k0] = -1;
  while (ko.length && n++ < (maxN || 2000)) {
    var p = ko.shift();
    if ((p[0] !== s[0] || p[1] !== s[1]) && maal(p[0], p[1])) {
      var c = p[1] * W + p[0];
      while (fra[c] !== k0) c = fra[c];
      return [c % W - s[0], Math.floor(c / W) - s[1]];
    }
    for (var r = 0; r < 8; r++) {
      var x = p[0] + R[r][0], y = p[1] + R[r][1], i = y * W + x, f = g.felt(x, y);
      if (f === 'ude' || f === 'land' || fra[i] !== undefined) continue;
      if (!g.sett(x, y)) { if (maal(x, y)) { fra[i] = p[1] * W + p[0]; ko.push([x, y]); } continue; }
      if (f === 'havn' && !maal(x, y)) continue;
      fra[i] = p[1] * W + p[0]; ko.push([x, y]);
    }
  }
  return null;
}
function udforsk(g) {
  // Nærmeste felt, man ikke har set
  return vej(g, function (x, y) { return !g.sett(x, y); });
}
function tilHavn(g, id) {
  var p = g.havnePos(id);
  return vej(g, function (x, y) { return x === p[0] && y === p[1]; });
}
function naermesteHavn(g) {
  var kendte = g.kendteHavne();
  return vej(g, function (x, y) { var h = g.havnVed(x, y); return h && kendte.indexOf(h) >= 0; });
}
function havnAfstand(g) {
  var best = 99; g.kendteHavne().forEach(function (id) { var k = g.kursInfo(id); if (k && k.dage < best) best = k.dage; });
  return best;
}
function fjendtligNaer(g, stil) {
  var st = g.state;
  return g.synligeSkibe().filter(function (s) {
    if (s.slags === 'marine') return st.beroemmelse >= 10;
    return s.slags === 'pirat' && (stil !== 'pirat' || s.skibstype !== 'slup' || st.mandskab < 14);
  })[0];
}
function undvig(g, f) {
  var st = g.state, best = null, bv = -1;
  for (var r = 0; r < 8; r++) {
    var x = st.pos[0] + R[r][0], y = st.pos[1] + R[r][1], ft = g.felt(x, y);
    if (ft === 'ude' || ft === 'land') continue;
    var v = Math.max(Math.abs(x - f.x), Math.abs(y - f.y)) + (ft === 'havn' ? -2 : 0);
    if (v > bv) { bv = v; best = [R[r][0], R[r][1]]; }
  }
  return best;
}
function moedeHandel(g) {
  var st = g.state, m = st.moede, i = 0;
  while (m && !m.slut && !st.over && i++ < 60) {
    if (m.slags === 'storm') g.storm('ride'); else g.handling('flygt');
  }
}
function moedePirat(g) {
  var st = g.state, m = st.moede, i = 0;
  while (m && !m.slut && !st.over && i++ < 60) {
    if (m.slags === 'storm') { g.storm('ride'); continue; }
    if (m.slags === 'marine' && st.beroemmelse >= 10) { g.handling('flygt'); continue; }
    if (m.slags === 'marine') { g.handling('flygt'); continue; }
    var staerk = st.mandskab >= m.mandskab * 1.15;
    if (m.slags === 'pirat' && !(st.mandskab >= m.mandskab * 1.4 && st.skrog > g.maxSkrog() * 0.6)) { g.handling('flygt'); continue; }
    if (st.skrog < g.maxSkrog() * 0.35 || (m.slags === 'pirat' && st.mandskab < m.mandskab * 0.9 && m.afstand <= 1)) { g.handling('flygt'); continue; }
    if (m.afstand > 0 && (staerk || g.effKanoner() === 0)) { var h = g.handling('naermere'); if (h && h.fejl) g.handling('flygt'); }
    else if (m.afstand === 0 && staerk) g.handling('bord');
    else if (g.effKanoner() > 0) g.handling('skyd');
    else g.handling('flygt');
  }
}
function proviantTil(g, dage) {
  var st = g.state, mangler = Math.min(L.PROVIANT_MAX, dage) - st.proviant;
  if (mangler > 0) g.proviant(mangler);
}
function moedeKaper(g) {
  var st = g.state, m = st.moede;
  if (m && m.slags === 'handel' && st.mandskab >= m.mandskab * 1.15 && st.skrog > g.maxSkrog() * 0.5) return moedePirat(g);
  return moedeHandel(g);
}
var MOEDE = { handel: moedeHandel, kaper: moedeKaper, pirat: moedePirat };
function iHavnHandel(g) {
  var st = g.state;
  L.VARER.forEach(function (v) { if (st.last[v.id]) g.saelg(v.id, 'alt'); });
  if (st.skrog < g.maxSkrog() * 0.8) g.reparer('alt');
  if (st.mandskab < 8) g.hyr(8 - st.mandskab);
  if (g.naesteSkib() && st.guld > g.naesteSkib().pris + 600) g.koebSkib();
  if (st.guld > 1200 && g.opgraderPris('lastrum') !== null && st.guld > g.opgraderPris('lastrum') + 600) g.opgrader('lastrum');
  if (g.rygtePris() !== null && st.guld > 150) g.rygteHavn();
  // Bedste handel pr. dag blandt kendte havne, man kan sejle til
  var r = null, bedst = 0;
  L.VARER.forEach(function (v) {
    var her = g.pris(v.id).koeb, n = Math.min(g.fri(), Math.floor(st.guld * 0.8 / her));
    g.kendteHavne().forEach(function (id) {
      if (id === st.havn) return; var k = g.kursInfo(id); if (!k) return;
      var gevinst = (g.pris(v.id, id).salg - her) * n - k.dage * g.proviantPris();
      if (gevinst / k.dage > bedst) { bedst = gevinst / k.dage; r = { vare: v.id, havn: id }; }
    });
  });
  if (r) {
    proviantTil(g, g.kursInfo(r.havn).dage + 7);
    g.koeb(r.vare, 'alt'); return r.havn;
  }
  // Ingen god handel: sejl til en anden kendt havn (priserne ændrer sig) eller udforsk
  var andre = g.kendteHavne().filter(function (id) { return id !== st.havn && g.sti(id); });
  if (andre.length) {
    var til = andre[Math.floor(g._rng() * andre.length)];
    proviantTil(g, g.kursInfo(til).dage + 7); return til;
  }
  proviantTil(g, 16);
  return null;
}
function iHavnKaper(g) {
  var st = g.state;
  if (st.guld > 500) { while (g.kanonPris() !== null && st.kanoner < 4 && st.guld > 400) g.koebKanon(); }
  if (st.mandskab < g.maxMandskab() && st.guld > 300) g.hyr(Math.min(g.maxMandskab() - st.mandskab, Math.floor((st.guld - 250) / g.hyrePris())));
  return iHavnHandel(g);
}
function iHavnPirat(g) {
  var st = g.state;
  L.VARER.forEach(function (v) { if (st.last[v.id]) g.saelg(v.id, 'alt'); });
  g.reparer('alt'); g.proviant('fyld');
  if (g.naesteSkib() && st.guld > g.naesteSkib().pris + 400) g.koebSkib();
  while (g.kanonPris() !== null && st.guld > 300) g.koebKanon();
  g.hyr('alt');
  if (g.kikkertPris() !== null && st.guld > g.kikkertPris() + 400) g.koebKikkert();
  return null;
}
// Spil én rejse i op til `dage` dage og gå i land. stil = 'handel' | 'pirat'
function spil(seed, stil, dage) {
  var g = L.createGame({ seed: seed }), st = g.state, maal = null, skridt = 0;
  while (!st.over && skridt++ < 5000) {
    if (st.havn) {
      if (st.dag >= dage) { g.gaaILand(); break; }
      // En dygtig sørøver ved, hvornår det er nok: med marinen i hælene går han i land
      if (stil === 'pirat' && st.beroemmelse >= PIRAT_STOP) { g.gaaILand(); break; }
      maal = stil === 'handel' ? iHavnHandel(g) : stil === 'kaper' ? iHavnKaper(g) : iHavnPirat(g);
      if (maal && g.saetKurs(maal).ok) {
        while (st.kurs && !st.over) { var r = g.autoTrin(); if (r && r.moede) MOEDE[stil](g); }
        continue;
      }
    }
    if (st.moede && !st.moede.slut) { MOEDE[stil](g); continue; }
    var d = null;
    var fj = fjendtligNaer(g, stil);
    if (fj && !st.havn && st.proviant > havnAfstand(g) && Math.max(Math.abs(fj.x - st.pos[0]), Math.abs(fj.y - st.pos[1])) <= 4) d = undvig(g, fj);
    var hjem = st.dag >= dage || st.proviant < havnAfstand(g) + 3 || st.skrog < g.maxSkrog() * 0.55 || (stil === 'pirat' && (st.mandskab < g.maxMandskab() * 0.6 || g.lastIalt() > g.lastrum() * 0.5)) || (stil !== 'pirat' && g.lastIalt() > 0);
    if (!d && hjem) d = (maal && !st.havn && g.sti(maal)) ? tilHavn(g, maal) : naermesteHavn(g);
    if (!d && (stil === 'pirat' || (stil === 'kaper' && g.lastIalt() === 0)) && !hjem) {
      var bytte = g.synligeSkibe().filter(function (s) { return s.slags === 'handel'; })[0];
      if (bytte) d = vej(g, function (x, y) { return Math.max(Math.abs(x - bytte.x), Math.abs(y - bytte.y)) <= 1; });
    }
    if (!d && maal && !st.havn && g.sti(maal) && st.proviant >= g.kursInfo(maal).dage) d = tilHavn(g, maal);
    if (!d && stil !== 'pirat' && g.kendteHavne().length >= 4 && !st.havn) d = naermesteHavn(g);
    if (!d) d = udforsk(g) || naermesteHavn(g);
    if (!d) { var h = g.kendteHavne()[0]; d = tilHavn(g, h); }
    if (!d) break;
    var res = g.flyt(d[0], d[1]);
    if (st.havn) maal = null;
    if (res.moede) MOEDE[stil](g);
  }
  if (!st.over) g.slut('tid');
  STAT.dage += st.dag; STAT.moeder += st.tal.moeder || 0;
  return { formue: st.over.formue, beroemmelse: st.beroemmelse, over: st.over.grund, kapret: st.tal.kapret, sænket: st.tal.sænket, angrebet: st.tal.angrebet || 0, plyndret: st.tal.plyndret || 0, dage: st.dag };
}
var STAT = { dage: 0, moeder: 0 };
var PIRAT_STOP = +(process.env.PIRAT_STOP || 15);   // den dygtige sørøver går i land, når marinen og de andre sørøvere for alvor jager ham
function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
function koer(n, dage, fra) {
  fra = fra || 0;
  var res = { handel: [], kaper: [], pirat: [] };
  for (var s = fra + 1; s <= fra + n; s++) { res.handel.push(spil(s, 'handel', dage)); res.kaper.push(spil(s, 'kaper', dage)); res.pirat.push(spil(s, 'pirat', dage)); }
  return res;
}
function point(r, F) { return r.formue + F * r.beroemmelse; }
module.exports = { spil: spil, koer: koer, median: median, point: point };

if (require.main === module) {
  var n = +(process.argv[2] || 200), dage = +(process.argv[3] || 150), fra = +(process.argv[4] || 0);
  var res = koer(n, dage, fra);
  ['handel', 'kaper', 'pirat'].forEach(function (k) {
    var a = res[k];
    var over = {}; a.forEach(function (r) { over[r.over] = (over[r.over] || 0) + 1; });
    console.log(k + ': median formue ' + median(a.map(function (r) { return r.formue; })) +
      ', median berømmelse ' + median(a.map(function (r) { return r.beroemmelse; })) +
      ', i land: formue ' + median(a.filter(function (r) { return r.over === 'land'; }).map(function (r) { return r.formue; })) + ' berømmelse ' + median(a.filter(function (r) { return r.over === 'land'; }).map(function (r) { return r.beroemmelse; })) +
      ', slut ' + JSON.stringify(over) + ', kapret i alt ' + a.reduce(function (s, r) { return s + r.kapret; }, 0));
  });
  console.log('møder pr. dag: ' + (STAT.moeder / STAT.dage).toFixed(3));
  [25, 50, 75, 100].forEach(function (F) {
    var h = median(res.handel.map(function (r) { return point(r, F); })), p = median(res.pirat.map(function (r) { return point(r, F); }));
    var vinder = 0; for (var i = 0; i < n; i++) if (point(res.pirat[i], F) > point(res.handel[i], F)) vinder++;
    var kk = median(res.kaper.map(function (r) { return point(r, F); }));
    console.log('F=' + F + ': median point handel ' + h + ', kaper ' + kk + ', pirat ' + p + ', pirat bedst i ' + Math.round(100 * vinder / n) + ' % af spillene');
  });
  // Tabte spil: sunket (også i storm), taget af marinen, sultet (også mistet hele mandskabet)
  console.log('\n| Stil | Median point (F=' + L.BEROEMMELSE_FAKTOR + ') | Tabt i alt | Sunket | Taget | Sultet |');
  console.log('|---|---|---|---|---|---|');
  ['handel', 'kaper', 'pirat'].forEach(function (k) {
    var a = res[k], pct = function (f) { return Math.round(100 * a.filter(f).length / a.length) + ' %'; };
    console.log('| ' + k + ' | ' + median(a.map(function (r) { return point(r, L.BEROEMMELSE_FAKTOR); })) + ' | ' + pct(function (r) { return r.over !== 'land' && r.over !== 'tid'; }) +
      ' | ' + pct(function (r) { return r.over === 'sunket' || r.over === 'storm'; }) + ' | ' + pct(function (r) { return r.over === 'taget'; }) +
      ' | ' + pct(function (r) { return r.over === 'sult' || r.over === 'mandskab'; }) + ' |');
  });
}
